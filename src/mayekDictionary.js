// mayekDictionary.js
//
// English -> Meetei Mayek translation, built on a Supabase-backed dictionary
// (table: mayek_dictionary). Sits alongside meetei_mayek.js (which handles
// BMEI04 keystroke <-> Unicode conversion for text you already have in one
// script or the other) — this module is for going from real English words
// to Meetei Mayek, which meetei_mayek.js cannot do on its own.
//
// Design:
//   1. Whole-sentence exact match first (covers repeated phrasing like
//      "find the value of x", common in the math question bank).
//   2. Otherwise, per-word dictionary lookup against english_norm.
//   3. Any word with no dictionary entry is left untranslated and wrapped
//      as [?word?] -- NEVER silently guessed or machine-translated. This
//      keeps the tool honest about what it doesn't know yet, and gives you
//      a visible list of gaps to fill in via the Dictionary tab.

import { supabase } from './supabase'
import { romanToMeetei } from './meetei_mayek'

export function normalizeEnglish(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s']+/g, ' ')   // strip punctuation except apostrophes
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a sentence into translatable word tokens while preserving
 * whitespace/punctuation layout for reassembly.
 */
function tokenize(text) {
  const parts = text.split(/(\s+|[^\w']+)/g).filter(p => p !== '')
  return parts.map(p => ({ text: p, isWord: /\w/.test(p) }))
}

async function fetchWordEntries(normWords) {
  if (!normWords.length) return new Map()
  const { data, error } = await supabase
    .from('mayek_dictionary')
    .select('english_norm, bmei04, mayek_unicode')
    .eq('entry_type', 'word')
    .in('english_norm', normWords)
  if (error) throw error
  const map = new Map()
  for (const row of data || []) map.set(row.english_norm, row)
  return map
}

async function fetchSentenceEntry(norm) {
  const { data, error } = await supabase
    .from('mayek_dictionary')
    .select('bmei04, mayek_unicode')
    .eq('entry_type', 'sentence')
    .eq('english_norm', norm)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Translate English text to Meetei Mayek (Unicode) using the dictionary.
 *
 * @returns {
 *   mayek: string,           // best-effort Unicode Meetei Mayek output
 *   bmei04: string,          // same, as BMEI04 keystrokes
 *   matchedSentence: boolean,// true if a whole-sentence match was used
 *   missingWords: string[],  // normalized words with no dictionary entry
 *   coverage: number         // 0-1, fraction of word tokens that were matched
 * }
 */
export async function translateText(englishInput) {
  const raw = englishInput || ''
  const sentenceNorm = normalizeEnglish(raw)
  if (!sentenceNorm) {
    return { mayek: '', bmei04: '', matchedSentence: false, missingWords: [], coverage: 0 }
  }

  const sentenceHit = await fetchSentenceEntry(sentenceNorm)
  if (sentenceHit) {
    return {
      mayek: sentenceHit.mayek_unicode,
      bmei04: sentenceHit.bmei04,
      matchedSentence: true,
      missingWords: [],
      coverage: 1,
    }
  }

  const tokens = tokenize(raw)
  const wordTokens = tokens.filter(t => t.isWord)
  const normWords = [...new Set(wordTokens.map(t => normalizeEnglish(t.text)))].filter(Boolean)
  const entryMap = await fetchWordEntries(normWords)

  const missingWords = []
  let matchedCount = 0
  const outBmei04Parts = []
  const outUnicodeParts = []

  for (const tok of tokens) {
    if (!tok.isWord) {
      outBmei04Parts.push(tok.text)
      outUnicodeParts.push(tok.text)
      continue
    }
    const norm = normalizeEnglish(tok.text)
    const entry = entryMap.get(norm)
    if (entry) {
      matchedCount++
      outBmei04Parts.push(entry.bmei04)
      outUnicodeParts.push(entry.mayek_unicode)
    } else {
      missingWords.push(norm)
      outBmei04Parts.push(`[?${tok.text}?]`)
      outUnicodeParts.push(`[?${tok.text}?]`)
    }
  }

  return {
    mayek: outUnicodeParts.join(''),
    bmei04: outBmei04Parts.join(''),
    matchedSentence: false,
    missingWords: [...new Set(missingWords)],
    coverage: wordTokens.length ? matchedCount / wordTokens.length : 0,
  }
}

/**
 * Save/upsert a dictionary entry. bmei04 is the source of truth for the
 * Meetei Mayek keystrokes; mayek_unicode is always derived from it via
 * romanToMeetei so the two never drift apart.
 */
export async function saveDictionaryEntry({
  entryType,       // 'word' | 'sentence'
  english,
  bmei04,
  category = null,
  source = null,
  notes = null,
  createdBy = null,
}) {
  const english_norm = normalizeEnglish(english)
  if (!english_norm) throw new Error('English text is empty')
  if (!bmei04 || !bmei04.trim()) throw new Error('BMEI04 keystrokes are empty')

  const mayek_unicode = romanToMeetei(bmei04)

  const { data, error } = await supabase
    .from('mayek_dictionary')
    .upsert({
      entry_type: entryType,
      english: english.trim(),
      english_norm,
      bmei04: bmei04.trim(),
      mayek_unicode,
      category,
      source,
      notes,
      created_by: createdBy,
    }, { onConflict: 'english_norm' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteDictionaryEntry(id) {
  const { error } = await supabase.from('mayek_dictionary').delete().eq('id', id)
  if (error) throw error
}

/**
 * Bulk import from CSV rows already parsed into objects.
 * Expected columns: entry_type (optional, defaults 'word'), english, bmei04,
 * category (optional), source (optional).
 * Returns { inserted, failed: [{ row, error }] }.
 */
export async function bulkImportEntries(rows, { defaultSource = null, createdBy = null } = {}) {
  let inserted = 0
  const failed = []
  for (const row of rows) {
    const english = row.english || row.English || ''
    const bmei04 = row.bmei04 || row.BMEI04 || row.meetei_mayek || ''
    const entryType = (row.entry_type || (english.trim().split(/\s+/).length > 1 ? 'sentence' : 'word')).toLowerCase()
    if (!english.trim() || !bmei04.trim()) {
      failed.push({ row, error: 'Missing english or bmei04' })
      continue
    }
    try {
      await saveDictionaryEntry({
        entryType: entryType === 'sentence' ? 'sentence' : 'word',
        english,
        bmei04,
        category: row.category || null,
        source: row.source || defaultSource,
        createdBy,
      })
      inserted++
    } catch (err) {
      failed.push({ row, error: err.message })
    }
  }
  return { inserted, failed }
}

/**
 * Search dictionary entries by English substring (for the browse/edit view).
 */
export async function searchDictionary({ query = '', entryType = null, limit = 200 } = {}) {
  let q = supabase.from('mayek_dictionary').select('*').order('english', { ascending: true }).limit(limit)
  if (entryType) q = q.eq('entry_type', entryType)
  if (query.trim()) q = q.ilike('english', `%${query.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return data
}

/**
 * How many dictionary entries currently have no bmei04 filled in yet
 * (relevant for words imported from the open wordlist with blank bmei04 —
 * those never get inserted by bulkImportEntries since it requires bmei04,
 * so this is really for a future "gaps" view if entries are pre-seeded
 * with empty bmei04 by some other path).
 */
export async function countDictionaryEntries() {
  const { count, error } = await supabase
    .from('mayek_dictionary')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

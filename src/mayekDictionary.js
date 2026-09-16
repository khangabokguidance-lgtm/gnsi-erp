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

/**
 * PHRASE TEMPLATES — a small, explicitly-curated set of full-sentence
 * translations for phrasings that repeat constantly across the math/GK
 * question bank ("find the value of x", "which of the following", etc).
 *
 * These are NOT generated or guessed by any rule/model. Each row is a
 * `sentence`-type dictionary entry, saved the normal way through
 * saveDictionaryEntry with source='phrase_template', by a fluent Meetei
 * speaker/teacher reviewing the sentence as a whole (word-by-word dictionary
 * lookup gets English word order and function words wrong for a real
 * sentence — that's exactly the gap this closes, without machine
 * translation). This constant is just a checklist of which recurring
 * phrasings are worth that one-time review; it holds no translations
 * itself, so there's nothing here to accidentally trust.
 */
export const COMMON_QUESTION_PHRASES = [
  'find the value of x',
  'find the value of x and y',
  'which of the following is correct',
  'which of the following is not correct',
  'what is the value of',
  'solve for x',
  'find the missing number',
  'choose the correct answer',
  'select the odd one out',
  'find the next number in the series',
  'what is the capital of',
  'fill in the blank',
  'find the area of the given figure',
  'find the perimeter of the given figure',
  'complete the series',
  'find the correct option',
]

/**
 * Which of COMMON_QUESTION_PHRASES already have a verified sentence entry
 * in the dictionary, and which are still open — the checklist to hand a
 * fluent speaker/teacher for one-time review.
 */
export async function getPhraseTemplateStatus() {
  const norms = COMMON_QUESTION_PHRASES.map(normalizeEnglish)
  const { data, error } = await supabase
    .from('mayek_dictionary')
    .select('english_norm, mayek_unicode')
    .eq('entry_type', 'sentence')
    .in('english_norm', norms)
  if (error) throw error
  const doneSet = new Map((data || []).map(r => [r.english_norm, r.mayek_unicode]))
  return COMMON_QUESTION_PHRASES.map(phrase => {
    const norm = normalizeEnglish(phrase)
    return { phrase, norm, done: doneSet.has(norm), mayek_unicode: doneSet.get(norm) || null }
  })
}

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
    .select('english_norm, bmei04, mayek_unicode, needs_review')
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
 *   reviewWords: string[],   // normalized words matched but flagged needs_review
 *   coverage: number         // 0-1, fraction of word tokens that were matched
 * }
 *
 * IMPORTANT: this remains dictionary lookup only, word-by-word (or one
 * verified whole-sentence template — see COMMON_QUESTION_PHRASES). It does
 * not, and should not, attempt grammar reordering or any form of guessed/
 * machine translation: Meetei is SOV/agglutinative and nothing like English
 * word order, so a rule-based or model-based re-ordering pass would produce
 * fluent-looking but linguistically wrong output with no visible sign it's
 * wrong — worse than the honest [?word?] gaps this returns instead.
 */
export async function translateText(englishInput) {
  const raw = englishInput || ''
  const sentenceNorm = normalizeEnglish(raw)
  if (!sentenceNorm) {
    return { mayek: '', bmei04: '', matchedSentence: false, missingWords: [], reviewWords: [], coverage: 0 }
  }

  const sentenceHit = await fetchSentenceEntry(sentenceNorm)
  if (sentenceHit) {
    return {
      mayek: sentenceHit.mayek_unicode,
      bmei04: sentenceHit.bmei04,
      matchedSentence: true,
      missingWords: [],
      reviewWords: [],
      coverage: 1,
    }
  }

  const tokens = tokenize(raw)
  const wordTokens = tokens.filter(t => t.isWord)
  const normWords = [...new Set(wordTokens.map(t => normalizeEnglish(t.text)))].filter(Boolean)
  const entryMap = await fetchWordEntries(normWords)

  const missingWords = []
  const reviewWords = []
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
    if (entry && entry.bmei04 && entry.bmei04.trim()) {
      matchedCount++
      if (entry.needs_review) reviewWords.push(norm)
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
    reviewWords: [...new Set(reviewWords)],
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

  const { text: mayek_unicode, warnings } = romanToMeetei(bmei04.trim(), {}, true)

  // A word/sentence that still contains an unresolved [?x?] flag (an
  // e/i/o/x-initial vowel problem the transliterator can't safely fix on
  // its own — see meetei_mayek.js) is saved anyway, so nothing is lost,
  // but flagged via needs_review so it surfaces in the coverage/gap tools
  // instead of quietly looking correct.
  const needsReview = warnings.some(w => w.substituted === null) || mayek_unicode.includes('[?')

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
      needs_review: needsReview,
    }, { onConflict: 'english_norm' })
    .select()
    .single()

  if (error) throw error
  return { ...data, warnings }
}

export async function deleteDictionaryEntry(id) {
  const { error } = await supabase.from('mayek_dictionary').delete().eq('id', id)
  if (error) throw error
}

/**
 * Bulk import from CSV rows already parsed into objects.
 * Expected columns: entry_type (optional, defaults 'word'), english, bmei04,
 * category (optional), source (optional).
 * Returns { inserted, needsReview, failed: [{ row, error }] }.
 * needsReview counts (and is included in) inserted rows whose BMEI04 hit an
 * unresolved word-initial vowel case (see romanToMeetei) — they're saved,
 * not dropped, but worth a look before trusting them.
 */
export async function bulkImportEntries(rows, { defaultSource = null, createdBy = null } = {}) {
  let inserted = 0
  let needsReview = 0
  const failed = []
  const reviewRows = []
  for (const row of rows) {
    const english = row.english || row.English || ''
    const bmei04 = row.bmei04 || row.BMEI04 || row.meetei_mayek || ''
    const entryType = (row.entry_type || (english.trim().split(/\s+/).length > 1 ? 'sentence' : 'word')).toLowerCase()
    if (!english.trim() || !bmei04.trim()) {
      failed.push({ row, error: 'Missing english or bmei04' })
      continue
    }
    try {
      const saved = await saveDictionaryEntry({
        entryType: entryType === 'sentence' ? 'sentence' : 'word',
        english,
        bmei04,
        category: row.category || null,
        source: row.source || defaultSource,
        createdBy,
      })
      inserted++
      if (saved.needs_review) { needsReview++; reviewRows.push({ english, mayek_unicode: saved.mayek_unicode, warnings: saved.warnings }) }
    } catch (err) {
      failed.push({ row, error: err.message })
    }
  }
  return { inserted, needsReview, reviewRows, failed }
}

/**
 * Seed placeholder dictionary rows (blank bmei04) from a plain English
 * wordlist — one word per line, or comma/tab separated. This is the fast
 * path for growing coverage: paste a wordlist from a textbook/exam glossary
 * with no BMEI04 typing needed yet, then fill in keystrokes later via
 * Browse/Edit, tracked by findMissingCoverage()/getUnfilledEntries() below.
 * Words that already exist (filled or not) are skipped, never overwritten.
 * Returns { seeded, skippedExisting }.
 */
export async function seedWordlist(rawText, { category = null, source = 'wordlist', createdBy = null } = {}) {
  const words = [...new Set(
    (rawText || '')
      .split(/[\n,\t]+/)
      .map(w => normalizeEnglish(w))
      .filter(Boolean)
  )]
  if (!words.length) return { seeded: 0, skippedExisting: 0 }

  const { data: existing, error: exErr } = await supabase
    .from('mayek_dictionary')
    .select('english_norm')
    .in('english_norm', words)
  if (exErr) throw exErr
  const existingSet = new Set((existing || []).map(r => r.english_norm))

  const toInsert = words
    .filter(w => !existingSet.has(w))
    .map(w => ({
      entry_type: 'word',
      english: w,
      english_norm: w,
      bmei04: '',
      mayek_unicode: '',
      category,
      source,
      created_by: createdBy,
      needs_review: false,
    }))

  if (!toInsert.length) return { seeded: 0, skippedExisting: words.length }

  const { error } = await supabase.from('mayek_dictionary').insert(toInsert)
  if (error) throw error
  return { seeded: toInsert.length, skippedExisting: words.length - toInsert.length }
}

/**
 * Dictionary rows that exist but still need their BMEI04 keystrokes typed
 * in (seeded via seedWordlist, or any row saved with blank bmei04 by some
 * other path) — the actionable "fill these in" queue.
 */
export async function getUnfilledEntries({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from('mayek_dictionary')
    .select('*')
    .or('bmei04.is.null,bmei04.eq.')
    .order('english', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

/**
 * Dictionary rows saved WITH bmei04 but flagged needs_review (an
 * unresolved word-initial vowel case — see romanToMeetei/saveDictionaryEntry).
 * Different queue from getUnfilledEntries: these have a translation, it's
 * just unverified.
 */
export async function getNeedsReviewEntries({ limit = 500 } = {}) {
  const { data, error } = await supabase
    .from('mayek_dictionary')
    .select('*')
    .eq('needs_review', true)
    .order('english', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

/**
 * Coverage gap scan: given a list of raw English texts (e.g. every
 * question.question + option_a..d in the question bank), tokenize each,
 * normalize, and report which distinct words have no dictionary entry at
 * all (not even an unfilled placeholder) versus which exist but are
 * unfilled/needing review. Does not call the network per-word — pulls the
 * full distinct word set once and diffs client-side.
 *
 * @param texts string[]
 * @returns {
 *   totalDistinctWords: number,
 *   missing: string[],        // no dictionary row at all
 *   unfilled: string[],       // row exists, bmei04 still blank
 *   needsReview: string[],    // row exists, filled, but flagged
 *   coveredCount: number,
 * }
 */
export async function findCoverageGaps(texts) {
  const wordSet = new Set()
  for (const t of texts || []) {
    const norm = normalizeEnglish(t)
    if (!norm) continue
    for (const w of norm.split(' ')) if (w) wordSet.add(w)
  }
  const words = [...wordSet]
  if (!words.length) return { totalDistinctWords: 0, missing: [], unfilled: [], needsReview: [], coveredCount: 0 }

  // Supabase .in() has practical size limits; chunk to be safe on large banks.
  const CHUNK = 300
  const found = new Map()
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('mayek_dictionary')
      .select('english_norm, bmei04, needs_review')
      .eq('entry_type', 'word')
      .in('english_norm', chunk)
    if (error) throw error
    for (const row of data || []) found.set(row.english_norm, row)
  }

  const missing = [], unfilled = [], needsReview = []
  let coveredCount = 0
  for (const w of words) {
    const row = found.get(w)
    if (!row) { missing.push(w); continue }
    if (!row.bmei04 || !row.bmei04.trim()) { unfilled.push(w); continue }
    if (row.needs_review) { needsReview.push(w); continue }
    coveredCount++
  }

  return {
    totalDistinctWords: words.length,
    missing: missing.sort(),
    unfilled: unfilled.sort(),
    needsReview: needsReview.sort(),
    coveredCount,
  }
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

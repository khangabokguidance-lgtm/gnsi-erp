// mayekTranslate.js — meaning-level translation for the Mayek Tool
// (English / Hindi / Bengali <-> Manipuri in Meetei Mayek, Bengali script or
// Roman).
//
// Pipeline, per translation:
//   1. The school's own dictionary (mayek_dictionary) first: any line that
//      exactly matches a verified entry is taken from it, never re-translated.
//   2. The rest goes to Google Translate (/api/translate) when the language
//      pair is one Google supports and the server has a key,
//   3. otherwise to Gemini (/api/gemini), with dictionary words passed along
//      as a glossary.
// Staff corrections can be saved back into the dictionary (saveCorrections),
// so the next translation of that line uses the corrected wording.
//
// Unlike meetei_mayek.js (a letter-for-letter BMEI04 <-> Unicode converter
// that never guesses), steps 2–3 are machine translation: results can be
// wrong and are shown for a human to check and edit before use.
import { supabase } from './supabase'
import { bmeiToUnicode } from './mayekSegments'
import { meeteiToRoman } from './meetei_mayek'
import { normalizeEnglish } from './mayekDictionary'

export const LANGS = [
  { code: 'auto',     label: 'Detect language',              source: true,  target: false },
  { code: 'en',       label: 'English',                      source: true,  target: true, name: 'English' },
  { code: 'mni-Mtei', label: 'Manipuri (Meetei Mayek)',      source: true,  target: true, name: 'Manipuri (Meiteilon) written in Unicode Meetei Mayek script (U+ABC0–U+ABFF)' },
  { code: 'hi',       label: 'Hindi',                        source: true,  target: true, name: 'Hindi in Devanagari script' },
  { code: 'mni-Beng', label: 'Manipuri (Bengali script)',    source: true,  target: true, name: 'Manipuri (Meiteilon) written in Bengali script' },
  { code: 'mni-Latn', label: 'Manipuri (Roman letters)',     source: true,  target: true, name: 'Manipuri (Meiteilon) written phonetically in Roman/Latin letters' },
  { code: 'bn',       label: 'Bengali',                      source: true,  target: true, name: 'Bengali' },
  { code: 'bmei04',   label: 'BMEI04 keystrokes (Mayek)',    source: true,  target: false },
]
export const langLabel = code => LANGS.find(l => l.code === code)?.label || code
const langName = code => LANGS.find(l => l.code === code)?.name || langLabel(code)
export const ENGINE_LABELS = { google: 'Google Translate', gemini: 'Gemini AI', dictionary: 'Your dictionary' }

const MTEI = /[ꯀ-꯿]/g
const BENG = /[ঀ-৿]/g
const DEVA = /[ऀ-ॿ]/g
const count = (s, re) => (String(s).match(re) || []).length
const nonBlank = s => String(s || '').split('\n').filter(l => l.trim())

// Which language a text is in, by script — only where the script decides it.
function guessLang(text) {
  const m = count(text, MTEI), d = count(text, DEVA), l = count(text, /[A-Za-z]/g)
  if (m && m >= d && m >= l) return 'mni-Mtei'
  if (d && d >= l) return 'hi'
  if (l && !count(text, BENG)) return 'en'
  return null
}

// ── 1. Dictionary ──────────────────────────────────────────────────────────
// Only the English <-> Meetei Mayek pair: that's what the dictionary holds.
const dictPair = (from, to) =>
  from === 'en' && to === 'mni-Mtei' ? 'toMayek' : from === 'mni-Mtei' && to === 'en' ? 'toEnglish' : null

const verified = rows => (rows || []).filter(r => r.mayek_unicode && !r.needs_review && !r.mayek_unicode.includes('[?'))

async function dictLookup(column, values) {
  const out = []
  const uniq = [...new Set(values)].filter(Boolean)
  for (let i = 0; i < uniq.length; i += 100) {
    const { data, error } = await supabase.from('mayek_dictionary')
      .select('english, english_norm, mayek_unicode, needs_review, entry_type')
      .in(column, uniq.slice(i, i + 100))
    if (error) return out // the dictionary is a bonus; never block a translation on it
    out.push(...verified(data))
  }
  return out
}

// line text -> dictionary translation, for lines that match an entry exactly.
async function dictionaryLines(lines, pair) {
  const hits = new Map()
  if (!pair) return hits
  const cands = lines.map(l => l.trim()).filter(l => l && l.length <= 200)
  if (pair === 'toMayek') {
    const rows = await dictLookup('english_norm', cands.map(normalizeEnglish))
    const byNorm = new Map(rows.map(r => [r.english_norm, r.mayek_unicode]))
    cands.forEach(l => { const t = byNorm.get(normalizeEnglish(l)); if (t) hits.set(l, t) })
  } else {
    const rows = await dictLookup('mayek_unicode', cands)
    const byMayek = new Map(rows.map(r => [r.mayek_unicode.trim(), r.english]))
    cands.forEach(l => { const t = byMayek.get(l); if (t) hits.set(l, t) })
  }
  return hits
}

// Word-level glossary for the AI prompt: dictionary words that appear in the text.
async function glossary(text, pair) {
  if (!pair) return []
  if (pair === 'toMayek') {
    const words = [...new Set(normalizeEnglish(text).split(' '))].filter(w => w.length > 1).slice(0, 300)
    return (await dictLookup('english_norm', words)).filter(r => r.entry_type === 'word').slice(0, 120)
  }
  const tokens = [...new Set(String(text).split(/(?:[\s,.;:!?()"'“”‘’\-–—]|\uABEB|\uABEC)+/))].filter(t => count(t, MTEI)).slice(0, 300)
  return (await dictLookup('mayek_unicode', tokens)).filter(r => r.entry_type === 'word').slice(0, 120)
}

// ── 2. Google Translate ────────────────────────────────────────────────────
const GOOGLE_LANGS = new Set(['en', 'hi', 'bn', 'mni-Mtei'])
let googleOff = false // set once the server says it has no key, to skip the round trip

async function viaGoogle(segments, from, to) {
  if (googleOff || !GOOGLE_LANGS.has(to) || (from !== 'auto' && !GOOGLE_LANGS.has(from))) return null
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, from, to }),
  }).catch(() => null)
  if (!res) return null
  const data = await res.json().catch(() => ({}))
  if (res.status === 501 || res.status === 404) { googleOff = true; return null }
  if (!res.ok || !Array.isArray(data.segments) || data.segments.length !== segments.length) return null
  return { segments: data.segments, detected: data.detected ? langLabel(data.detected) : '' }
}

// ── 3. Gemini ──────────────────────────────────────────────────────────────
const CHUNK = 900 // characters per request, so one reply is never cut off

function buildPrompt(segments, from, to, terms) {
  const src = from === 'auto' ? 'the language it is written in (detect it; Manipuri may be in Meetei Mayek, Bengali or Roman script)' : langName(from)
  return [
    'You are a careful professional translator for a school in Manipur, India.',
    `Translate each text in the JSON array below from ${src} into ${langName(to)}.`,
    'Rules:',
    '- Translate the meaning naturally, as a fluent native writer would; do not transliterate word by word.',
    '- Keep line breaks inside each text, numbering, question numbers, option labels such as (a), (k), k), numbers and proper names.',
    '- Do not add explanations, notes, alternatives or quotation marks.',
    to === 'mni-Mtei'
      ? '- Write the Manipuri ONLY in Unicode Meetei Mayek letters (U+ABC0–U+ABFF), using Cheikhei (꯫) as the full stop. Never use Bengali script or Latin letters for Manipuri words.'
      : '',
    terms.length
      ? '- Use these school-approved translations wherever the word appears:\n' + terms.map(t => `  ${t.english} = ${t.mayek_unicode}`).join('\n')
      : '',
    `Reply with strict JSON only, no code fences: {"detected": "<source language name>", "segments": [<exactly ${segments.length} translated strings, same order>]}`,
    '',
    'TEXTS:',
    JSON.stringify(segments),
  ].filter(Boolean).join('\n')
}

function parseReply(raw) {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
    if (Array.isArray(j.segments)) return { segments: j.segments.map(x => String(x ?? '')), detected: j.detected || '' }
  } catch { /* not JSON */ }
  return { segments: null, detected: '', raw: s }
}

async function callGemini(prompt) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens: 8192 }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Translation service error (${res.status})`)
  if (!data.text) throw new Error('The translation service returned nothing — try a shorter text.')
  return data.text
}

async function viaGemini(segments, from, to, terms, onProgress) {
  // Group segments into requests of about CHUNK characters.
  const groups = []
  let cur = [], size = 0
  segments.forEach((s, i) => {
    if (cur.length && size + s.length > CHUNK) { groups.push(cur); cur = []; size = 0 }
    cur.push(i); size += s.length
  })
  if (cur.length) groups.push(cur)

  const out = new Array(segments.length)
  let detected = ''
  for (let g = 0; g < groups.length; g++) {
    onProgress && onProgress(g + 1, groups.length)
    const idx = groups[g], texts = idx.map(i => segments[i])
    const r = parseReply(await callGemini(buildPrompt(texts, from, to, terms)))
    detected = detected || r.detected
    if (r.segments && r.segments.length === texts.length) { idx.forEach((i, k) => { out[i] = r.segments[k] }); continue }
    if (texts.length === 1 && r.raw) { out[idx[0]] = r.raw; continue }
    // Reply didn't line up with the request: redo this group one text at a time.
    for (const i of idx) {
      const one = parseReply(await callGemini(buildPrompt([segments[i]], from, to, terms)))
      out[i] = one.segments?.[0] ?? one.raw ?? ''
    }
  }
  return { segments: out, detected }
}

/**
 * Translate text. BMEI04 keystroke input is first converted to Unicode
 * Meetei Mayek locally, then translated as Manipuri.
 * Returns { text, source, from, detected, engine, dictLines, warnings[] }, where
 * `source` is the text actually translated (BMEI04 converted to Unicode) and
 * `from` is the source language actually used (resolved from 'auto' when
 * the script makes it clear).
 */
export async function translate(text, from, to, onProgress) {
  let src = String(text || '').replace(/\r\n?/g, '\n')
  let fromCode = from
  if (from === 'bmei04') { src = bmeiToUnicode(src); fromCode = 'mni-Mtei' }
  if (!src.trim()) return { text: '', source: src, from: fromCode, detected: '', engine: '', dictLines: 0, warnings: [] }
  const known = fromCode === 'auto' ? guessLang(src) : fromCode
  const pair = dictPair(known, to)

  // Lines the dictionary knows are kept; the rest are grouped into blocks
  // (runs of consecutive lines) so the engine keeps sentence context.
  const lines = src.split('\n')
  const hits = await dictionaryLines(lines, pair)
  const parts = [] // { keep } | { seg: index into segments }
  const segments = []
  let block = null
  for (const line of lines) {
    const hit = line.trim() && hits.get(line.trim())
    if (hit || !line.trim()) {
      if (block) { parts.push({ seg: segments.length }); segments.push(block.join('\n')); block = null }
      parts.push({ keep: hit ? line.match(/^\s*/)[0] + hit : line })
    } else (block = block || []).push(line)
  }
  if (block) { parts.push({ seg: segments.length }); segments.push(block.join('\n')) }

  let engine = segments.length ? '' : 'dictionary'
  let detected = ''
  let translated = []
  if (segments.length) {
    // The engines get the user's choice ('auto' stays auto): a script guess
    // can't tell Roman-letter Manipuri from English.
    const g = await viaGoogle(segments, fromCode, to)
    if (g) { engine = 'google'; translated = g.segments; detected = g.detected }
    else {
      const terms = await glossary(segments.join('\n'), pair)
      const r = await viaGemini(segments, fromCode, to, terms, onProgress)
      engine = 'gemini'; translated = r.segments; detected = r.detected
    }
  }
  const result = parts.map(p => ('keep' in p ? p.keep : translated[p.seg] ?? '')).join('\n')

  const warnings = []
  if (to === 'mni-Mtei') {
    const m = count(result, MTEI), b = count(result, BENG), l = count(result, /[A-Za-z]/g)
    if (!m) warnings.push('The result has no Meetei Mayek letters — translate again or edit it by hand.')
    else if (b) warnings.push('Some words came back in Bengali script instead of Meetei Mayek.')
    else if (l > m / 4) warnings.push('Some words were left in Latin letters.')
  }
  return {
    text: result, source: src,
    from: from === 'bmei04' ? 'mni-Mtei' : known || fromCode,
    detected: from === 'bmei04' ? 'Manipuri (BMEI04)' : detected,
    engine, dictLines: lines.filter(l => hits.has(l.trim())).length, warnings,
  }
}

/**
 * The English <-> Meetei Mayek line pairs a staff member corrected: lines of
 * `edited` that differ from what the engine gave (`machine`), matched to the
 * source line in the same position. Returns [] when nothing changed, or null
 * when the texts don't line up line-for-line (so it can't tell which source
 * line a correction belongs to).
 */
export function correctionPairs(source, machine, edited, from, to) {
  const pair = dictPair(from, to)
  if (!pair) return null
  const s = nonBlank(source), m = nonBlank(machine), e = nonBlank(edited)
  if (s.length !== e.length || m.length !== e.length) return null
  const out = []
  e.forEach((line, i) => {
    if (line.trim() === m[i].trim()) return
    const english = (pair === 'toMayek' ? s[i] : line).trim()
    const mayek = (pair === 'toMayek' ? line : s[i]).trim()
    if (english.length > 300 || !count(mayek, MTEI) || count(mayek, BENG) || !normalizeEnglish(english)) return
    out.push({ english, mayek })
  })
  return out
}

/** Save corrected pairs into mayek_dictionary as reviewed entries. */
export async function saveCorrections(pairs, createdBy = null) {
  const byNorm = new Map()
  for (const { english, mayek } of pairs) {
    const english_norm = normalizeEnglish(english)
    byNorm.set(english_norm, {
      entry_type: english_norm.includes(' ') ? 'sentence' : 'word',
      english, english_norm,
      bmei04: meeteiToRoman(mayek),
      mayek_unicode: mayek,
      source: 'translator_correction',
      created_by: createdBy,
      needs_review: false,
    })
  }
  const rows = [...byNorm.values()]
  if (!rows.length) return 0
  const { data, error } = await supabase.from('mayek_dictionary').upsert(rows, { onConflict: 'english_norm' }).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Nothing was saved — you may need to be signed in as staff')
  return data.length
}

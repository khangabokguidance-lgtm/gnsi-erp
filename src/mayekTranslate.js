// mayekTranslate.js — meaning-level translation for the Mayek Tool
// (English / Hindi / Bengali <-> Manipuri in Meetei Mayek, Bengali script or
// Roman).
//
// Pipeline, per translation:
//   1. The school's own dictionary (mayek_dictionary) first: any line that
//      exactly matches a verified entry is taken from it, never re-translated.
//   2. The rest goes to a translation service that supports the language
//      pair. The offline translator (IndicTrans2 running on this computer,
//      tools/offline-translator) is tried first where it is switched on.
//      Then the services the server has keys for: Bhashini (/api/bhashini,
//      the Government of India's Indian-language models) first when
//      Manipuri is involved, Google Translate (/api/translate) first
//      otherwise,
//   3. and to Gemini (/api/gemini) when neither can, with dictionary words
//      passed along as a glossary.
// Staff corrections can be saved back into the dictionary (saveCorrections),
// so the next translation of that line uses the corrected wording.
//
// Unlike meetei_mayek.js (a letter-for-letter BMEI04 <-> Unicode converter
// that never guesses), steps 2–3 are machine translation: results can be
// wrong and are shown for a human to check and edit before use.
import { supabase } from './supabase'
import { bmeiToUnicode, bmeiSegments } from './mayekSegments'
import { meeteiToRoman, fixApunOrder } from './meetei_mayek'
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
export const ENGINE_LABELS = { indictrans: 'Offline translator', bhashini: 'Bhashini', google: 'Google Translate', gemini: 'Gemini AI', dictionary: 'Your dictionary' }

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
    cands.forEach(l => { const t = byNorm.get(normalizeEnglish(l)); if (t) hits.set(l, fixApunOrder(t)) })
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

// ── 2. Translation services ────────────────────────────────────────────────
// The offline translator is a program on the staff member's own computer
// (tools/offline-translator), so it is used only in browsers where it has
// been switched on — other devices never try to reach a program that isn't
// there. It translates from English only.
export const OFFLINE_URL = 'http://127.0.0.1:8765'
const OFFLINE_KEY = 'gnsi_offline_translator'
export const offlineEnabled = () => { try { return localStorage.getItem(OFFLINE_KEY) === '1' } catch { return false } }
export const setOfflineEnabled = on => {
  try { if (on) localStorage.setItem(OFFLINE_KEY, '1'); else localStorage.removeItem(OFFLINE_KEY) } catch { /* storage blocked */ }
}
/** Whether the offline translator program is running on this computer. */
export async function offlineRunning() {
  try {
    const res = await fetch(OFFLINE_URL + '/health', { signal: AbortSignal.timeout(2500) })
    return res.ok && (await res.json()).engine === 'indictrans'
  } catch { return false }
}

// Bhashini and the offline translator need a known source language (they
// have no text language detection). `from` narrows the source languages
// where they differ from the targets.
const SERVICES = {
  indictrans: { url: OFFLINE_URL + '/translate', from: new Set(['en']), langs: new Set(['mni-Mtei', 'mni-Beng', 'hi', 'bn']), auto: false, enabled: offlineEnabled },
  bhashini: { url: '/api/bhashini', langs: new Set(['en', 'hi', 'bn', 'mni-Mtei', 'mni-Beng']), auto: false },
  google:   { url: '/api/translate', langs: new Set(['en', 'hi', 'bn', 'mni-Mtei']), auto: true },
}
const serviceOff = new Set() // services whose server said "no key", to skip the round trip
// Online services that just failed or timed out are skipped for a few
// minutes, so every translation doesn't wait for the same failure again
// before falling back. (The offline translator is not: it fails at once when
// it isn't running, and staff start it while the page is open.)
const serviceDown = new Map() // name -> time it failed
const RETRY_AFTER = 5 * 60 * 1000
const SERVICE_TIMEOUT = 45 * 1000

async function viaService(name, segments, from, to) {
  const svc = SERVICES[name]
  if (serviceOff.has(name) || (svc.enabled && !svc.enabled()) || !svc.langs.has(to) || from === to) return null
  if (from === 'auto' ? !svc.auto : !(svc.from || svc.langs).has(from)) return null
  const online = name !== 'indictrans'
  if (online && Date.now() - (serviceDown.get(name) || 0) < RETRY_AFTER) return null
  const failed = () => { if (online) serviceDown.set(name, Date.now()); return null }
  const res = await fetch(svc.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, from, to }),
    ...(online ? { signal: AbortSignal.timeout(SERVICE_TIMEOUT) } : {}),
  }).catch(() => null)
  if (!res) return failed()
  const data = await res.json().catch(() => ({}))
  if (res.status === 501 || res.status === 404) { serviceOff.add(name); return null }
  if (!res.ok || !Array.isArray(data.segments) || data.segments.length !== segments.length) return failed()
  serviceDown.delete(name)
  return { segments: data.segments, detected: data.detected ? langLabel(data.detected) : '' }
}

// ── 3. Gemini ──────────────────────────────────────────────────────────────
const CHUNK = 900 // characters per request, so one reply is never cut off
const GEMINI_PARALLEL = 3 // Gemini requests in flight at once, across the whole page

/** Run fn over items with at most `limit` running at a time. */
export async function inParallel(items, limit, fn) {
  let next = 0
  const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i) } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

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

// All translator calls to Gemini share one small pool, so a long document
// can't fire more requests at once than the key's per-minute limit allows;
// a "too many requests" answer is retried after a short wait.
let geminiActive = 0
const geminiQueue = []
const GEMINI_RETRY_WAIT = [3000, 8000, 20000]
async function geminiSlot(fn) {
  if (geminiActive >= GEMINI_PARALLEL) await new Promise(r => geminiQueue.push(r)) // handed a slot
  else geminiActive++
  try { return await fn() } finally {
    const next = geminiQueue.shift()
    if (next) next() // pass the slot straight on
    else geminiActive--
  }
}

async function callGemini(prompt) {
  for (let attempt = 0; ; attempt++) {
    const { res, data } = await geminiSlot(async () => {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 8192, thinking: false }),
      })
      return { res, data: await res.json().catch(() => ({})) }
    })
    if ((res.status === 429 || res.status === 503) && attempt < GEMINI_RETRY_WAIT.length) {
      await new Promise(r => setTimeout(r, GEMINI_RETRY_WAIT[attempt]))
      continue
    }
    if (!res.ok) throw new Error(data.error || `Translation service error (${res.status})`)
    if (!data.text) throw new Error('The translation service returned nothing — try a shorter text.')
    return data.text
  }
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
  let detected = '', done = 0
  const doGroup = async idx => {
    const texts = idx.map(i => segments[i])
    const r = parseReply(await callGemini(buildPrompt(texts, from, to, terms)))
    detected = detected || r.detected
    if (r.segments && r.segments.length === texts.length) idx.forEach((i, k) => { out[i] = r.segments[k] })
    else if (texts.length === 1 && r.raw) out[idx[0]] = r.raw
    else {
      // Reply didn't line up with the request: redo this group one text at a time.
      await inParallel(idx, GEMINI_PARALLEL, async i => {
        const one = parseReply(await callGemini(buildPrompt([segments[i]], from, to, terms)))
        out[i] = one.segments?.[0] ?? one.raw ?? ''
      })
    }
    onProgress && onProgress(++done, groups.length)
  }
  onProgress && groups.length > 1 && onProgress(0, groups.length)
  await inParallel(groups, GEMINI_PARALLEL, doGroup)
  return { segments: out, detected }
}

/**
 * Translate text. BMEI04 keystroke input is first converted to Unicode
 * Meetei Mayek locally, then translated as Manipuri.
 * Returns { text, source, from, detected, engine, dictLines, warnings[] }, where
 * `source` is the text actually translated (BMEI04 converted to Unicode) and
 * `from` is the source language actually used (resolved from 'auto' when
 * the script makes it clear).
 * With { eachLine: true } every line is translated as its own item instead
 * of in blocks, so the result always has one line per source line (for
 * documents whose lines must stay paired; costs a little sentence context).
 */
export async function translate(text, from, to, onProgress, { eachLine = false } = {}) {
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
    } else if (eachLine) {
      parts.push({ seg: segments.length }); segments.push(line)
    } else (block = block || []).push(line)
  }
  if (block) { parts.push({ seg: segments.length }); segments.push(block.join('\n')) }

  let engine = segments.length ? '' : 'dictionary'
  let detected = ''
  let translated = []
  if (segments.length) {
    // Google and Gemini get the user's choice ('auto' stays auto) and detect
    // it themselves; the others can't, so they get the script-based guess.
    const manipuri = /^mni/.test(known || '') || /^mni/.test(to)
    let s = null
    for (const name of ['indictrans', ...(manipuri ? ['bhashini', 'google'] : ['google', 'bhashini'])]) {
      s = await viaService(name, segments, !SERVICES[name].auto && fromCode === 'auto' ? known || 'auto' : fromCode, to)
      if (s) { engine = name; translated = s.segments; detected = s.detected || (fromCode === 'auto' && known ? langLabel(known) : ''); break }
    }
    if (!s) {
      const terms = await glossary(segments.join('\n'), pair)
      const r = await viaGemini(segments, fromCode, to, terms, onProgress)
      engine = 'gemini'; translated = r.segments; detected = r.detected
    }
  }
  if (eachLine) translated = translated.map(t => String(t ?? '').replace(/\s*\n\s*/g, ' '))
  const result = parts.map(p => ('keep' in p ? p.keep : translated[p.seg] ?? '')).join('\n')

  // Machine-translated lines paired with their source line, where a block
  // came back with the same number of lines (else which line is which is
  // unknown). Used to save translations into the dictionary as drafts.
  const pairs = []
  if (pair) segments.forEach((seg, i) => {
    const s = seg.split('\n'), t = String(translated[i] ?? '').split('\n')
    if (s.length !== t.length) return
    s.forEach((line, k) => {
      const english = (pair === 'toMayek' ? line : t[k]).trim()
      const mayek = (pair === 'toMayek' ? t[k] : line).trim()
      if (english && mayek) pairs.push({ english, mayek })
    })
  })

  const warnings = []
  if (engine && engine !== 'indictrans' && engine !== 'dictionary' && offlineEnabled() && known === 'en' && SERVICES.indictrans.langs.has(to))
    warnings.push(`The offline translator on this computer did not answer, so ${ENGINE_LABELS[engine]} was used. Start it (start-translator.bat) and translate again.`)
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
    engine, dictLines: lines.filter(l => hits.has(l.trim())).length, warnings, pairs,
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

/**
 * English -> Meetei Mayek with the offline translator alone, one result per
 * input text (null where it gave no usable Meetei Mayek). Returns null when
 * the offline translator is switched off in this browser or not running.
 */
export async function offlineToMayek(texts) {
  if (!texts?.length || !offlineEnabled()) return null
  const s = await viaService('indictrans', texts.map(t => String(t)), 'en', 'mni-Mtei')
  return s ? s.segments.map(cleanDraft) : null
}

// ── Dictionary drafting ────────────────────────────────────────────────────
// Blank dictionary entries (English -> Meetei Mayek) are filled as DRAFTS by
// the offline translator where it is switched on and running, else by Gemini:
// saved with needs_review = true and source 'offline_draft' / 'gemini_draft',
// so the translator ignores them (it only uses reviewed entries) until a
// teacher approves or corrects each one in Dictionary → Coverage → Needs Review.
export const AI_DRAFT_SOURCE = 'gemini_draft'
export const OFFLINE_DRAFT_SOURCE = 'offline_draft'
// Draft source per translation engine, and who made it, for Needs Review.
const DRAFT_SOURCES = { indictrans: OFFLINE_DRAFT_SOURCE, gemini: AI_DRAFT_SOURCE, bhashini: 'bhashini_draft', google: 'google_draft' }
export const DRAFT_BY = { [OFFLINE_DRAFT_SOURCE]: 'the offline translator', [AI_DRAFT_SOURCE]: 'Gemini', bhashini_draft: 'Bhashini', google_draft: 'Google Translate' }
// What a draft's source becomes once a teacher has checked it.
export const reviewedSource = src => (src && src.endsWith('_draft') ? src.replace(/_draft$/, '_reviewed') : src)

/**
 * Save the line pairs of a translation (translate()'s `pairs`) into the
 * dictionary as drafts for a teacher to approve. Lines already in the
 * dictionary, drafted or approved, are left as they are.
 * Returns the number of new entries.
 */
export async function saveTranslationDrafts(pairs, engine, createdBy = null) {
  const source = DRAFT_SOURCES[engine]
  if (!source || !pairs?.length) return 0
  const byNorm = new Map()
  for (const { english, mayek } of pairs) {
    const english_norm = normalizeEnglish(english)
    const m = cleanDraft(mayek)
    if (!english_norm || !m || english.length > 300) continue
    byNorm.set(english_norm, {
      entry_type: english_norm.includes(' ') ? 'sentence' : 'word',
      english, english_norm, bmei04: meeteiToRoman(m), mayek_unicode: m,
      source, created_by: createdBy, needs_review: true,
    })
  }
  const rows = [...byNorm.values()]
  if (!rows.length) return 0
  const { data, error } = await supabase.from('mayek_dictionary')
    .upsert(rows, { onConflict: 'english_norm', ignoreDuplicates: true }).select('id')
  if (error) throw new Error(error.message)
  return data?.length || 0
}
const DRAFT_BATCH = 40
const DRAFT_BATCH_CHARS = 2500 // sentences are long; keep each request's reply well inside the token budget

function draftPrompt(words) {
  return [
    'You are helping a school in Manipur, India build an English to Manipuri (Meiteilon) dictionary for school exam papers.',
    'For each English word, phrase or sentence in the JSON array, give the Manipuri equivalent a Manipur school textbook would use. Translate sentences naturally as whole sentences, keeping numbers, option labels and names.',
    'Rules:',
    '- Write the Manipuri ONLY in Unicode Meetei Mayek letters (U+ABC0–U+ABFF). Never Bengali script, never Latin letters.',
    '- Give one best equivalent, no alternatives, notes or brackets.',
    '- For English loanwords that Manipuri normally borrows (e.g. apple, school, bus), write the borrowed word in Meetei Mayek.',
    `Reply with strict JSON only, no code fences: {"items": [{"english": "<as given>", "mayek": "<Meetei Mayek>"}]} with exactly ${words.length} items in the same order.`,
    '',
    'WORDS:',
    JSON.stringify(words),
  ].join('\n')
}

// A usable draft: Meetei Mayek (no Bengali script; Latin only for the odd
// label such as "(A)" inside a sentence).
const cleanDraft = s => {
  const t = String(s || '').trim()
  const m = count(t, MTEI)
  return t && m && !count(t, BENG) && count(t, /[A-Za-z]/g) <= m / 10 ? t : null
}

async function saveDrafts(updates) {
  if (!updates.length) return 0
  const { data, error } = await supabase.from('mayek_dictionary').upsert(updates, { onConflict: 'english_norm' }).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Nothing was saved — you may need to be signed in as staff')
  return data.length
}
const draftRow = (r, mayek, source) => ({ ...r, mayek_unicode: mayek, bmei04: meeteiToRoman(mayek), source, needs_review: true })

const OFFLINE_BATCH = 100 // texts per request to the offline translator

/**
 * Fill dictionary rows (rows as returned by getUnfilledEntries: full
 * mayek_dictionary rows) with Meetei Mayek drafts and save them as drafts.
 * The offline translator does what it can first (when switched on and
 * running); Gemini gets the rest, unless `offlineOnly`.
 * Returns { filled, offline, gemini, failed: [english…] }.
 */
export async function aiDraftEntries(rows, onProgress, { offlineOnly = false } = {}) {
  let todo = (rows || []).filter(r => r.english && r.english_norm)
  const total = todo.length
  let filled = 0, offline = 0
  const failed = []

  if (offlineEnabled() && todo.length) {
    const left = []
    for (let i = 0; i < todo.length; i += OFFLINE_BATCH) {
      const batch = todo.slice(i, i + OFFLINE_BATCH)
      onProgress && onProgress(Math.min(i + OFFLINE_BATCH, total), total, 'indictrans')
      const out = await offlineToMayek(batch.map(r => r.english))
      if (!out) { left.push(...todo.slice(i)); break } // not running: the rest goes to Gemini
      const updates = []
      batch.forEach((r, k) => { if (out[k]) updates.push(draftRow(r, out[k], OFFLINE_DRAFT_SOURCE)); else left.push(r) })
      const n = await saveDrafts(updates)
      offline += n; filled += n
    }
    todo = left
  }
  if (offlineOnly) return { filled, offline, gemini: 0, failed: todo.map(r => r.english) }
  // Batches of up to DRAFT_BATCH entries / DRAFT_BATCH_CHARS characters.
  const batches = []
  for (const r of todo) {
    const last = batches[batches.length - 1]
    if (last && last.length < DRAFT_BATCH && last.reduce((n, x) => n + x.english.length, 0) + r.english.length <= DRAFT_BATCH_CHARS) last.push(r)
    else batches.push([r])
  }
  let done = 0
  for (const batch of batches) {
    done += batch.length
    onProgress && onProgress(done, todo.length, 'gemini')
    let items = []
    try {
      const raw = String(await callGemini(draftPrompt(batch.map(r => r.english)))).trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      items = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).items || []
    } catch (e) {
      if (/GEMINI_API_KEY|quota|429|40[13]/i.test(e.message || '')) throw e // not worth retrying the rest
      failed.push(...batch.map(r => r.english)); continue
    }
    // Match by English text first, position second (the model may reorder).
    const byWord = new Map(items.map(it => [normalizeEnglish(it?.english), it?.mayek]))
    const updates = []
    batch.forEach((r, k) => {
      const mayek = cleanDraft(byWord.get(r.english_norm) ?? items[k]?.mayek)
      if (!mayek) { failed.push(r.english); return }
      updates.push(draftRow(r, mayek, AI_DRAFT_SOURCE))
    })
    filled += await saveDrafts(updates)
  }
  return { filled, offline, gemini: filled - offline, failed }
}

/** Mark dictionary entries as checked by a teacher (the translator then uses them). */
export async function approveEntries(ids) {
  if (!ids?.length) return 0
  const { data, error } = await supabase.from('mayek_dictionary')
    .update({ needs_review: false }).in('id', ids).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Nothing was updated — you may need to be signed in as staff')
  // Keep a record that an AI draft was checked by a person.
  for (const src of Object.keys(DRAFT_BY))
    await supabase.from('mayek_dictionary').update({ source: reviewedSource(src) }).in('id', ids).eq('source', src)
  return data.length
}

// ── Sentence database ──────────────────────────────────────────────────────
// Sentence entries (entry_type 'sentence') are what the translator matches
// line-for-line. The Question Bank is the best source: many questions hold
// the same text in English (question) and Meetei Mayek (question_mayek,
// BMEI04 keystrokes or Unicode), written by teachers.
export const QB_SOURCE = 'question_bank'
export const REVIEWABLE_SOURCES = new Set([...Object.keys(DRAFT_BY), QB_SOURCE])
const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d']

const cleanLine = t => String(t || '').replace(/\s+/g, ' ').trim()
// Worth a sentence entry: real English words (not a number, formula or one-word option).
const sentenceLike = t => t.length <= 300 && (t.match(/[A-Za-z]{2,}/g) || []).length >= 3
const mayekOf = q => {
  const m = String(q.question_mayek || '').trim()
  if (!m || q.question_mayek_font !== 'bmei04') return fixApunOrder(m)
  // A BMEI04 word the key table can't convert stays in Latin letters; such a
  // line isn't a trustworthy pair, so the question counts as English-only.
  // (All-capital runs are Roman numerals, which are meant to stay Latin.)
  if (bmeiSegments(m).some(seg => seg.latin && /[a-z]/.test(seg.text))) return ''
  return bmeiToUnicode(m)
}
// Mayek side of a pair must be clean Meetei Mayek (no leftover Latin or [?x?] flags).
const cleanMayek = t => {
  const s = cleanLine(t)
  return s && count(s, MTEI) && !count(s, BENG) && !s.includes('[?') && count(s, /[A-Za-z]/g) <= count(s, MTEI) / 10 ? s : null
}

/** Distinct English sentences in the Question Bank, with a teacher-written Meetei Mayek version where one exists. */
export function questionSentences(questions) {
  const out = new Map() // english_norm -> { english, mayek|null }
  const add = (english, mayek) => {
    const norm = normalizeEnglish(english)
    if (!norm || !sentenceLike(english)) return
    const prev = out.get(norm)
    if (!prev || (!prev.mayek && mayek)) out.set(norm, { english, mayek: mayek || null })
  }
  for (const q of questions || []) {
    const en = String(q.question || '').split('\n').map(cleanLine).filter(Boolean)
    const mm = mayekOf(q).split('\n').map(cleanLine).filter(Boolean)
    if (mm.length && mm.length === en.length) en.forEach((l, i) => add(l, cleanMayek(mm[i])))
    else if (mm.length && en.join(' ').length <= 300) add(en.join(' '), cleanMayek(mm.join(' ')))
    else en.forEach(l => add(l, null))
    for (const k of OPTION_KEYS) if (q[k]) add(cleanLine(q[k]), q[`${k}_mayek`] ? cleanMayek(q[`${k}_mayek`]) : null)
  }
  return [...out.entries()].map(([english_norm, v]) => ({ english_norm, ...v }))
}

/** How much of the Question Bank's sentences the dictionary already covers. */
export async function scanSentences(questions) {
  const all = questionSentences(questions)
  const found = new Map()
  const norms = all.map(s => s.english_norm)
  for (let i = 0; i < norms.length; i += 100) {
    const { data, error } = await supabase.from('mayek_dictionary')
      .select('english_norm, mayek_unicode, needs_review').in('english_norm', norms.slice(i, i + 100))
    if (error) throw new Error(error.message)
    for (const r of data || []) found.set(r.english_norm, r)
  }
  const res = { total: all.length, approved: 0, waiting: 0, blank: 0, missingPairs: [], missingEnglish: [] }
  for (const s of all) {
    const r = found.get(s.english_norm)
    if (!r) (s.mayek ? res.missingPairs : res.missingEnglish).push(s)
    else if (!r.mayek_unicode) res.blank++
    else if (r.needs_review) res.waiting++
    else res.approved++
  }
  return res
}

/**
 * Add sentences to the dictionary. Ones with a Meetei Mayek version are saved
 * filled (source 'question_bank', needs_review so a teacher confirms the pair);
 * English-only ones are saved blank for auto-fill. Existing entries are left alone.
 */
export async function addSentences(sentences, createdBy = null) {
  const rows = (sentences || []).map(s => ({
    entry_type: 'sentence', english: s.english, english_norm: s.english_norm,
    bmei04: s.mayek ? meeteiToRoman(s.mayek) : '', mayek_unicode: s.mayek || '',
    source: QB_SOURCE, created_by: createdBy, needs_review: !!s.mayek,
  }))
  let added = 0
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabase.from('mayek_dictionary')
      .upsert(rows.slice(i, i + 200), { onConflict: 'english_norm', ignoreDuplicates: true }).select('id')
    if (error) throw new Error(error.message)
    added += data?.length || 0
  }
  return added
}

// ── Question Bank translation ──────────────────────────────────────────────
// Fills a question's Meetei Mayek fields (question_mayek, option_x_mayek)
// with the offline translator. Only questions with no Meetei Mayek yet.
const hasWords = t => /[A-Za-z]{2,}/.test(String(t || ''))
const usableMayek = t => { const s = String(t || '').trim(); return s && count(s, MTEI) && !count(s, BENG) ? s : null }

/** Questions that have English text and no Meetei Mayek at all yet. */
export const needsMayek = q => hasWords(q.question) && !String(q.question_mayek || '').trim() &&
  !OPTION_KEYS.some(k => String(q[`${k}_mayek`] || '').trim())

/**
 * Translate questions to Meetei Mayek with the offline translator.
 * Returns null when it is switched off or not running, else
 * { patches: [{ id, patch }], failed: number }. A patch holds the question
 * and option Meetei Mayek in Unicode; options with no words (numbers,
 * formulas) are copied as they are.
 */
export async function translateQuestionsOffline(questions, onProgress) {
  if (!offlineEnabled()) return null
  const todo = (questions || []).filter(needsMayek)
  const patches = []
  let failed = 0
  const PER_REQUEST = 15 // questions per request (up to 5 texts each)
  for (let i = 0; i < todo.length; i += PER_REQUEST) {
    const batch = todo.slice(i, i + PER_REQUEST)
    onProgress && onProgress(Math.min(i + PER_REQUEST, todo.length), todo.length)
    const texts = [], at = []
    batch.forEach(q => {
      const keys = ['question', ...OPTION_KEYS].filter(k => k === 'question' || hasWords(q[k]))
      at.push(keys.map(k => { texts.push(String(q[k])); return [k, texts.length - 1] }))
    })
    const s = await viaService('indictrans', texts, 'en', 'mni-Mtei')
    if (!s) { if (!i) return null; failed += todo.length - i; break }
    batch.forEach((q, b) => {
      const got = Object.fromEntries(at[b].map(([k, idx]) => [k, s.segments[idx]]))
      const question = usableMayek(got.question)
      if (!question) { failed++; return }
      const patch = { question_mayek: question, question_mayek_font: 'unicode' }
      for (const k of OPTION_KEYS) {
        if (!String(q[k] || '').trim()) continue
        patch[`${k}_mayek`] = k in got ? usableMayek(got[k]) || String(q[k]).trim() : String(q[k]).trim()
      }
      patches.push({ id: q.id, patch })
    })
  }
  return { patches, failed }
}

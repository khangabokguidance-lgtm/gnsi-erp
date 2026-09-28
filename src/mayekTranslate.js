// mayekTranslate.js — meaning-level translation for the Mayek Tool
// (English / Hindi / Bengali <-> Manipuri in Meetei Mayek, Bengali script or
// Roman), through the existing /api/gemini endpoint.
//
// Unlike meetei_mayek.js (a letter-for-letter BMEI04 <-> Unicode converter
// that never guesses), this is AI translation: results can be wrong and are
// shown for a human to check and edit before use.
import { bmeiToUnicode } from './mayekSegments'

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

const MTEI = /[ꯀ-꯿]/g
const BENG = /[ঀ-৿]/g
const count = (s, re) => (String(s).match(re) || []).length

// Long passages go in paragraph-sized pieces so one reply is never cut off.
const CHUNK = 900
function chunks(text) {
  const out = []
  let cur = ''
  for (const para of text.split(/(\n\s*\n)/)) {
    if (cur && (cur + para).length > CHUNK) { out.push(cur); cur = '' }
    if (para.length <= CHUNK) { cur += para; continue }
    for (const line of para.split(/(\n)/)) {
      if (cur && (cur + line).length > CHUNK) { out.push(cur); cur = '' }
      cur += line
    }
  }
  if (cur) out.push(cur)
  return out
}

function buildPrompt(text, from, to) {
  const src = from === 'auto' ? 'the language it is written in (detect it; Manipuri may be in Meetei Mayek, Bengali or Roman script)' : langName(from)
  return [
    'You are a careful professional translator for a school in Manipur, India.',
    `Translate the text below from ${src} into ${langName(to)}.`,
    'Rules:',
    '- Translate the meaning naturally, as a fluent native writer would; do not transliterate word by word.',
    '- Keep line breaks, numbering, question numbers, option labels such as (a), (k), k), punctuation layout, numbers, and proper names.',
    '- Do not add explanations, notes, alternatives or quotation marks.',
    to === 'mni-Mtei'
      ? '- Write the Manipuri ONLY in Unicode Meetei Mayek letters (U+ABC0–U+ABFF), using Cheikhei (꯫) as the full stop. Never use Bengali script or Latin letters for Manipuri words.'
      : '',
    'Reply with strict JSON only, no code fences: {"detected": "<source language name>", "translation": "<translated text>"}',
    '',
    'TEXT:',
    text,
  ].filter(Boolean).join('\n')
}

function parseReply(raw) {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
    if (typeof j.translation === 'string') return { translation: j.translation, detected: j.detected || '' }
  } catch { /* fall through to raw text */ }
  return { translation: s, detected: '' }
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

/**
 * Translate text. BMEI04 keystroke input is first converted to Unicode
 * Meetei Mayek locally, then translated as Manipuri.
 * Returns { text, detected, warnings[] }.
 */
export async function translate(text, from, to, onProgress) {
  let src = String(text || '')
  let fromCode = from
  if (from === 'bmei04') { src = bmeiToUnicode(src); fromCode = 'mni-Mtei' }
  if (!src.trim()) return { text: '', detected: '', warnings: [] }

  const parts = chunks(src)
  const out = []
  let detected = ''
  for (let i = 0; i < parts.length; i++) {
    onProgress && onProgress(i + 1, parts.length)
    const lead = parts[i].match(/^\s*/)[0], tail = parts[i].match(/\s*$/)[0]
    if (!parts[i].trim()) { out.push(parts[i]); continue }
    const r = parseReply(await callGemini(buildPrompt(parts[i].trim(), fromCode, to)))
    detected = detected || r.detected
    out.push(lead + r.translation.trim() + tail)
  }
  const result = out.join('')

  const warnings = []
  if (to === 'mni-Mtei') {
    const m = count(result, MTEI), b = count(result, BENG), l = count(result, /[A-Za-z]/g)
    if (!m) warnings.push('The result has no Meetei Mayek letters — translate again or edit it by hand.')
    else if (b) warnings.push('Some words came back in Bengali script instead of Meetei Mayek.')
    else if (l > m / 4) warnings.push('Some words were left in Latin letters.')
  }
  return { text: result, detected: from === 'bmei04' ? 'Manipuri (BMEI04)' : detected, warnings }
}

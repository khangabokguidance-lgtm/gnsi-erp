/* global process */
// Google Cloud Translation (v2) for the Mayek Tool translator.
// Needs GOOGLE_TRANSLATE_API_KEY (Cloud Translation API enabled). Without it
// this answers 501 { fallback: true } and the browser uses /api/gemini.
// POST { segments: string[], from: 'auto'|code, to: code }
//   -> { segments: string[], detected: code|null, engine: 'google' }
const GOOGLE_LANGS = new Set(['en', 'hi', 'bn', 'mni-Mtei'])
const MAX_SEGMENTS = 400
const MAX_CHARS = 60000
const BATCH_SEGMENTS = 100
const BATCH_CHARS = 20000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) return res.status(501).json({ error: 'GOOGLE_TRANSLATE_API_KEY not set', fallback: true })

  const { segments, from, to } = req.body || {}
  if (!Array.isArray(segments) || !segments.length || segments.some(s => typeof s !== 'string'))
    return res.status(400).json({ error: 'segments must be a non-empty array of strings' })
  if (!GOOGLE_LANGS.has(to) || (from !== 'auto' && !GOOGLE_LANGS.has(from)))
    return res.status(400).json({ error: 'Language pair not supported by Google', fallback: true })
  if (segments.length > MAX_SEGMENTS || segments.join('').length > MAX_CHARS)
    return res.status(413).json({ error: 'Text too long — translate it in parts' })

  // Google caps one request at 128 segments and recommends < 30k characters.
  const batches = []
  let cur = [], size = 0
  for (const s of segments) {
    if (cur.length && (cur.length >= BATCH_SEGMENTS || size + s.length > BATCH_CHARS)) { batches.push(cur); cur = []; size = 0 }
    cur.push(s); size += s.length
  }
  if (cur.length) batches.push(cur)

  try {
    const out = []
    let detected = null
    for (const q of batches) {
      const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, target: to, format: 'text', ...(from === 'auto' ? {} : { source: from }) }),
      })
      const data = await r.json()
      if (!r.ok) {
        console.error('Google Translate error:', data)
        return res.status(r.status).json({ error: data?.error?.message || 'Google Translate error', fallback: true })
      }
      for (const t of data.data.translations) {
        out.push(t.translatedText)
        detected = detected || t.detectedSourceLanguage || null
      }
    }
    res.status(200).json({ segments: out, detected, engine: 'google' })
  } catch (e) {
    console.error('Handler error:', e)
    res.status(500).json({ error: e.message, fallback: true })
  }
}

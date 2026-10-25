// Gemini with page images: Learning Hub → Model Sets → "Import paper" sends each page of a
// question paper (as a JPEG) to /api/gemini with an `images` list and gets back the questions it
// found as JSON. api/gemini.js checks the caller is staff, then hands such requests here.
// This lives in a "_" folder so Vercel does not count it as another serverless function: the
// Hobby plan allows 12 per deployment, and adding a separate endpoint made the build fail.
import { rateLimit } from '../_guard/guard.js'

const MODEL = 'gemini-2.5-flash'
const MAX_IMAGES = 2
const MAX_IMAGE_B64 = 3_000_000              // per image; Vercel caps the whole request near 4.5 MB
const MAX_PROMPT = 20_000
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Returns an error message for a bad request body, or '' when it is fine.
export function checkVisionBody(body) {
  const { prompt, images } = body || {}
  if (!prompt || typeof prompt !== 'string') return 'No prompt provided'
  if (prompt.length > MAX_PROMPT) return 'Prompt too long'
  if (!Array.isArray(images) || !images.length) return 'No page image provided'
  if (images.length > MAX_IMAGES) return `At most ${MAX_IMAGES} images per request`
  for (const im of images) {
    if (!im || !IMAGE_TYPES.includes(im.mimeType)) return 'Images must be JPEG, PNG or WebP'
    if (typeof im.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(im.data)) return 'Image data must be base64'
    if (im.data.length > MAX_IMAGE_B64) return 'Image too large'
  }
  return ''
}

// Called by api/gemini.js after requireStaff, for a request body that carries `images`.
export async function handleVision(req, res, user) {
  if (!rateLimit(req, res, { key: 'gemini-vision', max: 20, id: user.id })) return

  const bad = checkVisionBody(req.body)
  if (bad) return res.status(bad === 'Image too large' ? 413 : 400).json({ error: bad })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  const { prompt, images } = req.body
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...images.map((im) => ({ inline_data: { mime_type: im.mimeType, data: im.data } }))] }],
          // Google advises no thinking pass for finding boxes: with it, 2.5 Flash's figure
          // boxes drift (crops took in neighbouring labels or missed part of a figure).
          generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    )
    const data = await response.json()
    if (!response.ok) {
      console.error('Gemini vision error:', data)
      // Gemini's per-minute limit says how long to wait (RetryInfo.retryDelay, e.g. "23s"); pass it on
      if (response.status === 429) {
        const info = (data?.error?.details || []).find((d) => /RetryInfo/.test(d?.['@type'] || ''))
        const wait = Math.ceil(parseFloat(info?.retryDelay) || 0)
        if (wait > 0) res.setHeader('Retry-After', String(Math.min(wait, 120)))
      }
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini API error' })
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
    res.status(200).json({ text })
  } catch (e) {
    console.error('Gemini vision handler error:', e)
    res.status(500).json({ error: e.message })
  }
}

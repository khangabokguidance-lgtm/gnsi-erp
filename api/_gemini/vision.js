// AI models with page images: Learning Hub → Model Sets → "Import paper" sends each page of a
// question paper (as a JPEG) to /api/gemini with an `images` list and gets back the questions it
// found as JSON. Gemini reads it first; other free models take over when one is busy (visionModels.js).
// api/gemini.js checks the caller is staff, then hands such requests here.
// This lives in a "_" folder so Vercel does not count it as another serverless function: the
// Hobby plan allows 12 per deployment, and adding a separate endpoint made the build fail.
import { rateLimit } from '../_guard/guard.js'
import { readWithChain, visionChain } from './visionModels.js'

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
  if (!rateLimit(req, res, { key: 'gemini-vision', max: 40, id: user.id })) return

  const bad = checkVisionBody(req.body)
  if (bad) return res.status(bad === 'Image too large' ? 413 : 400).json({ error: bad })

  const { prompt, images } = req.body
  try {
    // Gemini first, then the other free models when one is busy or down (see visionModels.js).
    // Google advises no thinking pass for finding boxes: with it, 2.5 Flash's figure boxes drift.
    const r = await readWithChain({ chain: visionChain(process.env), env: process.env, prompt, images, log: (...a) => console.error('Vision model:', ...a) })
    if (r.ok) return res.status(200).json({ text: r.text, model: r.model })
    if (r.status === 429 && r.retryAfter) res.setHeader('Retry-After', String(Math.min(Math.max(1, r.retryAfter), 120)))
    return res.status(r.status).json({ error: r.error })
  } catch (e) {
    console.error('Vision handler error:', e)
    res.status(500).json({ error: e.message })
  }
}

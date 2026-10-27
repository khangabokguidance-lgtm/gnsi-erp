// aiVision.js — the text AI models return for page images (or plain text with
// textOnly), through api/gemini.js. Used by Model Sets → Import paper and
// Model Set Maker → Import questions. Errors carry the codes those pages
// branch on: rate_limited, not_granted, no_models, upstream_error.
import { authFetch } from './apiFetch'

export async function vision(prompt, images) {
  const res = await authFetch('/api/gemini', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, images, textOnly: !images.length }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const code = res.status === 429 ? 'rate_limited' : res.status === 401 || res.status === 403 ? 'not_granted'
      : res.status === 503 && Array.isArray(body.details) ? 'no_models' : 'upstream_error'
    // details: what each AI model answered, e.g. { model: 'groq:…', why: 'API key refused…' }
    throw { code, message: body.error || `HTTP ${res.status}`, retryAfter: Number(res.headers.get('Retry-After')) || null, details: Array.isArray(body.details) ? body.details : [] }
  }
  return body.text
}

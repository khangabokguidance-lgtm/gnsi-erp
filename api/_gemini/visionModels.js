// Free AI models that can read a page image, tried in order (Model Sets → Import paper).
//
// Every free plan allows only so many requests a minute, and each model has its own allowance.
// So when one model says "too many" (or is down), the page goes to the next one instead of
// making the teacher wait.
//
//   Gemini (GEMINI_API_KEY, already set): gemini-2.5-flash, then gemini-2.5-flash-lite,
//     gemini-2.0-flash, gemini-2.0-flash-lite. Same key, a separate free limit per model.
//     Change the list with GEMINI_VISION_MODELS="model-a,model-b".
//   Groq (optional, free key from console.groq.com → API Keys): set GROQ_API_KEY.
//     Models: GROQ_VISION_MODEL (comma list), default the Llama 4 Scout and Maverick vision models.
//   OpenRouter (optional, free key from openrouter.ai → Keys): set OPENROUTER_API_KEY.
//     Models: OPENROUTER_VISION_MODEL (comma list), default a few free (":free") vision models.
//     Free models there come and go: one that no longer exists is skipped for an hour.
//
// Keys are added in Vercel → Project → Settings → Environment Variables, then redeploy.
// No Supabase import here, so this file can be tested with `node --test`.

export const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
export const DEFAULT_GROQ_MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
export const DEFAULT_OPENROUTER_MODELS = ['qwen/qwen2.5-vl-72b-instruct:free', 'meta-llama/llama-4-maverick:free', 'google/gemma-3-27b-it:free', 'mistralai/mistral-small-3.2-24b-instruct:free']

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)

// The models this deployment can use, in the order they are tried.
export function visionChain(env = {}) {
  const chain = []
  if (env.GEMINI_API_KEY) {
    const models = list(env.GEMINI_VISION_MODELS)
    for (const model of models.length ? models : DEFAULT_GEMINI_MODELS) chain.push({ provider: 'gemini', model })
  }
  const add = (provider, set, defaults) => { const m = list(set); for (const model of m.length ? m : defaults) chain.push({ provider, model }) }
  if (env.GROQ_API_KEY) add('groq', env.GROQ_VISION_MODEL, DEFAULT_GROQ_MODELS)
  if (env.OPENROUTER_API_KEY) add('openrouter', env.OPENROUTER_VISION_MODEL, DEFAULT_OPENROUTER_MODELS)
  return chain
}

// Models that said "too many" (or that cannot be used now) are skipped until their wait is over,
// with the reason kept to tell the teacher (kept while the function is warm).
const resting = new Map()
const key = (e) => `${e.provider}:${e.model}`
export function markBusy(entry, seconds, now = Date.now(), why = 'busy this minute', perMinute = true) {
  resting.set(key(entry), { until: now + Math.max(5, seconds || 30) * 1000, why, perMinute })
}
export function restingFor(entry, now = Date.now()) { const r = resting.get(key(entry)); return r && r.until > now ? Math.ceil((r.until - now) / 1000) : 0 }
const restInfo = (entry) => resting.get(key(entry))
export function clearBusy() { resting.clear() }

// The request each provider expects for one prompt and its page images.
export function buildRequest(entry, env, prompt, images) {
  if (entry.provider === 'gemini') {
    // the thinking pass is turned off for better boxes; only 2.5 and later models take that setting
    const thinking = /gemini-(2\.5|[3-9])/.test(entry.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(entry.model)}:generateContent?key=${env.GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{ parts: [{ text: prompt }, ...images.map((im) => ({ inline_data: { mime_type: im.mimeType, data: im.data } }))] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: 'application/json', ...thinking },
      },
    }
  }
  // Groq and OpenRouter speak the OpenAI chat format
  const groq = entry.provider === 'groq'
  return {
    url: groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groq ? env.GROQ_API_KEY : env.OPENROUTER_API_KEY}`,
      ...(groq ? {} : { 'X-Title': 'GNSI Model Sets' }),
    },
    body: {
      model: entry.model,
      temperature: 0.1,
      ...(groq ? { max_completion_tokens: 8192, response_format: { type: 'json_object' } } : { max_tokens: 8192 }),
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mimeType};base64,${im.data}` } }))] }],
    },
  }
}

// The reply text, from either format.
export function replyText(entry, data) {
  if (entry.provider === 'gemini') return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  const c = data?.choices?.[0]?.message?.content
  return Array.isArray(c) ? c.map((p) => p.text || '').join('') : String(c || '')
}

// How long a provider asks to wait after "too many" (seconds), or 0.
export function retryDelay(entry, data, headers) {
  if (entry.provider === 'gemini') {
    const info = (data?.error?.details || []).find((d) => /RetryInfo/.test(d?.['@type'] || ''))
    return Math.ceil(parseFloat(info?.retryDelay) || 0)
  }
  return Math.ceil(Number(headers?.get?.('retry-after')) || 0)
}

// Gemini says which allowance ran out: a daily one will not come back by waiting a minute.
export function isDailyLimit(entry, data) {
  const v = (data?.error?.details || []).flatMap((d) => d?.violations || []).map((x) => `${x.quotaId || ''} ${x.quotaMetric || ''}`).join(' ')
  return /per ?day|PerDay|daily/i.test(v) || /per ?day|daily/i.test(String(data?.error?.message || ''))
}

// A short, plain reason for the teacher, from a failed answer.
export function reasonFor(entry, status, message) {
  const m = String(message || '')
  if (status === 401 || status === 403) return 'API key refused: check it in Vercel → Environment Variables'
  if (status === 404) return /data policy|privacy|guardrail/i.test(m) ? 'free models are turned off in OpenRouter → Settings → Privacy' : 'model not available'
  if (status === 402) return 'needs credit on this account'
  if (status === 413) return 'page image too large for this model'
  if (status >= 500) return 'service down right now'
  if (status === 400) return `refused the request (${m.slice(0, 90)})`
  return m.slice(0, 90) || `HTTP ${status}`
}

// Try each model in turn. fetchFn is injected so this can be tested without the network.
// Returns { ok: true, text, model } or { ok: false, status, error, retryAfter, details }.
// status 429 means "wait retryAfter seconds and try again"; 503 means no model can read pages now
// (keys refused, daily limits used up, models gone), and details say why for each one.
export async function readWithChain({ chain, env, prompt, images, fetchFn = fetch, log = () => {}, budgetMs = 45_000, now = Date.now }) {
  const start = now()
  if (!chain.length) return { ok: false, status: 503, error: 'No AI model is set up: add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) in Vercel.', details: [] }
  const details = []
  for (const entry of chain) {
    const rest = restInfo(entry), wait = restingFor(entry, now())
    if (wait) { details.push({ model: key(entry), why: rest.why, wait: rest.perMinute ? wait : 0 }); continue }
    if (now() - start > budgetMs) { details.push({ model: key(entry), why: 'not tried (out of time)', wait: 0 }); continue }
    let res, data
    try {
      const r = buildRequest(entry, env, prompt, images)
      res = await fetchFn(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body) })
      data = await res.json().catch(() => ({}))
    } catch (e) {
      log(`${key(entry)} failed`, e?.message)
      details.push({ model: key(entry), why: 'could not connect', wait: 0 })
      continue
    }
    if (res.ok) {
      const text = replyText(entry, data)
      if (text.trim()) return { ok: true, text, model: key(entry) }
      details.push({ model: key(entry), why: 'empty reply', wait: 0 })
      continue
    }
    const error = data?.error?.message || data?.error || `HTTP ${res.status}`
    log(`${key(entry)} → ${res.status}`, error)
    if (res.status === 429) {
      if (isDailyLimit(entry, data)) { markBusy(entry, 3600, now(), 'daily free limit used up', false); details.push({ model: key(entry), why: 'daily free limit used up', wait: 0 }) }
      else { const w = retryDelay(entry, data, res.headers) || 30; markBusy(entry, w, now()); details.push({ model: key(entry), why: 'busy this minute', wait: w }) }
      continue
    }
    const why = reasonFor(entry, res.status, error)
    // a model that is gone, or a key that is refused, will not work on the next page either
    if ([401, 402, 403, 404].includes(res.status)) markBusy(entry, 3600, now(), why, false)
    details.push({ model: key(entry), why, wait: 0 })
  }
  const waits = details.map((d) => d.wait).filter((w) => w > 0)
  if (waits.length) return { ok: false, status: 429, error: 'Every free AI model is busy this minute.', retryAfter: Math.min(...waits), details }
  return { ok: false, status: 503, error: 'No AI model could read the page.', details }
}

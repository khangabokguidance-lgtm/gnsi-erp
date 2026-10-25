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

// A failure that the next model may not have: its limit is used up, it is down, it does not exist
// (any more), it refused this request's options, or its key is wrong.
export const tryNext = (status) => status === 429 || status >= 500 || [400, 401, 403, 404].includes(status)

// Models that said "too many" are skipped until their wait is over (kept while the function is warm).
const resting = new Map()
export function markBusy(entry, seconds, now = Date.now()) { resting.set(`${entry.provider}:${entry.model}`, now + Math.max(5, seconds || 30) * 1000) }
export function restingFor(entry, now = Date.now()) { const t = resting.get(`${entry.provider}:${entry.model}`) || 0; return t > now ? Math.ceil((t - now) / 1000) : 0 }
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

// Try each model in turn. fetchFn is injected so this can be tested without the network.
// Returns { ok: true, text, model } or { ok: false, status, error, retryAfter }.
export async function readWithChain({ chain, env, prompt, images, fetchFn = fetch, log = () => {}, budgetMs = 45_000, now = Date.now }) {
  const start = now()
  if (!chain.length) return { ok: false, status: 500, error: 'No AI model is set up: add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY).' }
  const awake = chain.filter((e) => !restingFor(e))
  if (!awake.length) return { ok: false, status: 429, error: 'Every free AI model is busy this minute.', retryAfter: Math.min(...chain.map((e) => restingFor(e))) }
  let last = { status: 500, error: 'AI service error' }, busy = []
  for (const entry of awake) {
    if (now() - start > budgetMs) break               // api/gemini.js may run 60 s; leave time to answer
    let res, data
    try {
      const r = buildRequest(entry, env, prompt, images)
      res = await fetchFn(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body) })
      data = await res.json().catch(() => ({}))
    } catch (e) {
      log(`${entry.provider}:${entry.model} failed`, e?.message)
      last = { status: 502, error: e?.message || 'Network error' }
      continue
    }
    if (res.ok) {
      const text = replyText(entry, data)
      if (text.trim()) return { ok: true, text, model: `${entry.provider}:${entry.model}` }
      last = { status: 502, error: 'Empty reply' }
      continue
    }
    const error = data?.error?.message || data?.error || `HTTP ${res.status}`
    log(`${entry.provider}:${entry.model} → ${res.status}`, error)
    if (res.status === 429) { const wait = retryDelay(entry, data, res.headers); markBusy(entry, wait); busy.push(wait || 30) }
    else if (res.status === 404) markBusy(entry, 3600)   // no such model (any more): skip it for an hour
    last = { status: res.status, error: String(error) }
    if (!tryNext(res.status)) break
  }
  // all were busy (or the rest failed): say how long until the first one is free again
  if (busy.length) return { ok: false, status: 429, error: 'Every free AI model is busy this minute.', retryAfter: Math.min(...chain.map((e) => restingFor(e) || Infinity), ...busy) }
  return { ok: false, ...last }
}

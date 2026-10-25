// Free AI models that can read a page image, tried in order (Model Sets → Import paper).
//
// Every free plan allows only so many requests a minute, and each model has its own allowance.
// So when one model says "too many" (or is down), the page goes to the next one instead of
// making the teacher wait.
//
// Providers retire models every few months, so the models are not fixed here: each provider is asked
// which models it offers now (cached 6 hours), and the ones that can read images are used.
//
//   Gemini (GEMINI_API_KEY, already set): the newest Flash and Flash-Lite models, then Google's
//     Gemma models (same key, a much larger free daily allowance). Same key, a separate free limit
//     per model. Fix the list with GEMINI_VISION_MODELS="model-a,model-b".
//   Groq (optional, free key from console.groq.com → API Keys): set GROQ_API_KEY.
//     Its vision models; fix them with GROQ_VISION_MODEL (comma list).
//   OpenRouter (optional, free key from openrouter.ai → Keys): set OPENROUTER_API_KEY.
//     Its free models that take images; fix them with OPENROUTER_VISION_MODEL (comma list).
//   If a provider's list cannot be read, the defaults below are tried.
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

// ---------- which models each provider offers now ----------
const DISCOVER_TTL = 6 * 3600 * 1000
const found = new Map()                                   // provider → { at, models }
export function clearDiscovered() { found.clear() }
const ver = (id) => parseFloat((id.match(/-(\d+(?:\.\d+)?)/) || [])[1] || 0)

// Gemini: newest Flash first, then Flash-Lite, previews after released models; then Gemma (12B and up).
export function pickGemini(models) {
  const ids = (models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name || '').replace(/^models\//, ''))
  const flash = ids.filter((id) => /^gemini-\d+(\.\d+)?-flash(-lite)?(-preview[\w-]*|-\d{3})?$/.test(id) && !/image|tts|audio|live|thinking|exp|computer|robot|native/.test(id))
    .map((id) => ({ id, score: ver(id) * 10 - (/-lite/.test(id) ? 3 : 0) - (/preview/.test(id) ? 10 : 0) - (/-\d{3}$/.test(id) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score).map((x) => x.id)
  const gemma = ids.filter((id) => /^gemma-\d+n?-(\d+)b-it$/.test(id) && +id.match(/-(\d+)b-it$/)[1] >= 12)
    .sort((a, b) => ver(b) - ver(a) || +b.match(/-(\d+)b-it$/)[1] - +a.match(/-(\d+)b-it$/)[1])
  return [...flash.slice(0, 5), ...gemma.slice(0, 2)]
}
// Groq: its models that can read images.
const GROQ_VISION = [/llama-4-scout/, /llama-4-maverick/, /llama-4/, /qwen.*(vl|omni)/, /gemma/, /kimi.*vl|vision|-vl\b/]
export function pickGroq(data) {
  const ids = (data || []).filter((m) => m && m.id && m.active !== false).map((m) => m.id)
  return GROQ_VISION.flatMap((re) => ids.filter((id) => re.test(id))).filter((id, i, a) => a.indexOf(id) === i).slice(0, 3)
}
// OpenRouter: free models that take images, the families known to read pages well first.
const OR_PREFER = [/qwen.*vl/i, /gemma-3/i, /llama-4/i, /mistral-small|pixtral/i, /kimi.*vl/i, /glm.*v/i]
export function pickOpenRouter(data) {
  const free = (data || []).filter((m) => m && m.id && (m.architecture?.input_modalities || []).includes('image')
    && (/:free$/.test(m.id) || (String(m.pricing?.prompt) === '0' && String(m.pricing?.completion) === '0')))
  const rank = (id) => { const i = OR_PREFER.findIndex((re) => re.test(id)); return i < 0 ? OR_PREFER.length : i }
  return free.map((m) => m.id).sort((a, b) => rank(a) - rank(b)).slice(0, 4)
}
async function discover(provider, env, fetchFn, now) {
  const hit = found.get(provider)
  if (hit && now() - hit.at < DISCOVER_TTL) return hit.models
  let models = null
  try {
    if (provider === 'gemini') {
      const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${env.GEMINI_API_KEY}`)
      if (r.ok) models = pickGemini((await r.json()).models)
    } else if (provider === 'groq') {
      const r = await fetchFn('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } })
      if (r.ok) models = pickGroq((await r.json()).data)
    } else {
      const r = await fetchFn('https://openrouter.ai/api/v1/models')
      if (r.ok) models = pickOpenRouter((await r.json()).data)
    }
  } catch (e) { models = null }
  if (models && models.length) found.set(provider, { at: now(), models })
  return models && models.length ? models : null
}
// The chain for this request: a fixed list from the settings, else what each provider offers now,
// else the defaults.
export async function resolveChain(env = {}, { fetchFn = fetch, now = Date.now } = {}) {
  const want = [['gemini', 'GEMINI_API_KEY', 'GEMINI_VISION_MODELS', DEFAULT_GEMINI_MODELS], ['groq', 'GROQ_API_KEY', 'GROQ_VISION_MODEL', DEFAULT_GROQ_MODELS], ['openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_VISION_MODEL', DEFAULT_OPENROUTER_MODELS]]
    .filter(([, k]) => env[k])
  const lists = await Promise.all(want.map(async ([provider, , setting, defaults]) => {
    const fixed = list(env[setting])
    return fixed.length ? fixed : (await discover(provider, env, fetchFn, now)) || defaults
  }))
  return want.flatMap(([provider], i) => lists[i].map((model) => ({ provider, model })))
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

// Settings a model refused once (a 400 naming them) are left out for it from then on.
const relaxed = new Map()
const relaxedOf = (e) => relaxed.get(key(e)) || {}
export function relax(entry, what) { relaxed.set(key(entry), { ...relaxedOf(entry), [what]: true }) }

// The request each provider expects for one prompt and its page images.
export function buildRequest(entry, env, prompt, images) {
  const rx = relaxedOf(entry)
  if (entry.provider === 'gemini') {
    // the thinking pass is turned off for better boxes; only Gemini 2.5 and later take that setting,
    // and Gemma takes neither it nor JSON mode
    const gemma = /^gemma/.test(entry.model)
    const thinking = !rx.thinking && !gemma && /gemini-(2\.5|[3-9])/.test(entry.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}
    const json = rx.json || gemma ? {} : { responseMimeType: 'application/json' }
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(entry.model)}:generateContent?key=${env.GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{ parts: [{ text: prompt }, ...images.map((im) => ({ inline_data: { mime_type: im.mimeType, data: im.data } }))] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384, ...json, ...thinking },
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
      ...(groq ? { max_completion_tokens: 8192, ...(rx.json ? {} : { response_format: { type: 'json_object' } }) } : { max_tokens: 8192 }),
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
  if (status === 404) return /data policy|privacy|guardrail/i.test(m) ? 'free models are turned off in OpenRouter → Settings → Privacy' : `model not available${m ? ` (${m.slice(0, 60)})` : ''}`
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
  const details = [], name = (e) => `${e.provider === 'gemini' ? '' : `${e.provider} `}${e.model.split('/').pop()}`
  for (let n = 0; n < chain.length; n++) {
    const entry = chain[n]
    const rest = restInfo(entry), wait = restingFor(entry, now())
    if (wait) { details.push({ model: key(entry), name: name(entry), why: rest.why, wait: rest.perMinute ? wait : 0 }); continue }
    if (now() - start > budgetMs) { details.push({ model: key(entry), name: name(entry), why: 'not tried (out of time)', wait: 0 }); continue }
    let res, data
    try {
      const r = buildRequest(entry, env, prompt, images)
      res = await fetchFn(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body) })
      data = await res.json().catch(() => ({}))
    } catch (e) {
      log(`${key(entry)} failed`, e?.message)
      details.push({ model: key(entry), name: name(entry), why: 'could not connect', wait: 0 })
      continue
    }
    if (res.ok) {
      const text = replyText(entry, data)
      if (text.trim()) return { ok: true, text, model: key(entry) }
      details.push({ model: key(entry), name: name(entry), why: 'empty reply', wait: 0 })
      continue
    }
    const error = data?.error?.message || data?.error || `HTTP ${res.status}`
    log(`${key(entry)} → ${res.status}`, error)
    if (res.status === 429) {
      if (isDailyLimit(entry, data)) { markBusy(entry, 3600, now(), 'daily free limit used up', false); details.push({ model: key(entry), name: name(entry), why: 'daily free limit used up', wait: 0 }) }
      else { const w = retryDelay(entry, data, res.headers) || 30; markBusy(entry, w, now()); details.push({ model: key(entry), name: name(entry), why: 'busy this minute', wait: w }) }
      continue
    }
    // a 400 about one setting: try this model once more without it
    if (res.status === 400 && !entry.retried) {
      const what = /thinking/i.test(error) ? 'thinking' : /json|mime|response_format|responseMimeType/i.test(error) ? 'json' : null
      if (what && !relaxedOf(entry)[what]) { relax(entry, what); chain = [...chain.slice(0, n + 1), { ...entry, retried: true }, ...chain.slice(n + 1)]; continue }
    }
    const why = reasonFor(entry, res.status, error)
    // a model that is gone, or a key that is refused, will not work on the next page either
    if ([401, 402, 403, 404].includes(res.status)) markBusy(entry, 3600, now(), why, false)
    details.push({ model: key(entry), name: name(entry), why, wait: 0 })
  }
  const waits = details.map((d) => d.wait).filter((w) => w > 0)
  if (waits.length) return { ok: false, status: 429, error: 'Every free AI model is busy this minute.', retryAfter: Math.min(...waits), details }
  return { ok: false, status: 503, error: 'No AI model could read the page.', details }
}

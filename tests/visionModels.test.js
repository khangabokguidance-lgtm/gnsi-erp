// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { visionChain, buildRequest, readWithChain, clearBusy, DEFAULT_GEMINI_MODELS, DEFAULT_GROQ_MODELS, DEFAULT_OPENROUTER_MODELS, resolveChain, clearDiscovered, pickGemini, pickGroq, pickOpenRouter } from '../api/_gemini/visionModels.js'

const page = { mimeType: 'image/jpeg', data: 'QUJD' }
const json = (status, body, headers = {}) => ({ ok: status < 400, status, json: async () => body, headers: { get: (k) => headers[k.toLowerCase()] ?? null } })
const geminiOk = (text) => json(200, { candidates: [{ content: { parts: [{ text }] } }] })
const geminiBusy = (s) => json(429, { error: { message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${s}s` }] } })

test('the chain is the Gemini models on one key, then Groq and OpenRouter only when their keys are set', () => {
  assert.deepEqual(visionChain({}), [])
  assert.deepEqual(visionChain({ GEMINI_API_KEY: 'g' }).map((e) => e.model), DEFAULT_GEMINI_MODELS)
  const all = visionChain({ GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'a, b', GROQ_API_KEY: 'q', OPENROUTER_API_KEY: 'o', OPENROUTER_VISION_MODEL: 'x:free' })
  assert.deepEqual(all.map((e) => `${e.provider}:${e.model}`), ['gemini:a', 'gemini:b', ...DEFAULT_GROQ_MODELS.map((m) => `groq:${m}`), 'openrouter:x:free'])
  assert.equal(visionChain({ OPENROUTER_API_KEY: 'o' }).length, DEFAULT_OPENROUTER_MODELS.length)
})

test('only 2.5 and later Gemini models get the no-thinking setting; Groq gets the page as a data URL', () => {
  const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }
  assert.ok(buildRequest({ provider: 'gemini', model: 'gemini-2.5-flash-lite' }, env, 'p', [page]).body.generationConfig.thinkingConfig)
  assert.equal(buildRequest({ provider: 'gemini', model: 'gemini-2.0-flash' }, env, 'p', [page]).body.generationConfig.thinkingConfig, undefined)
  const g = buildRequest({ provider: 'groq', model: 'm' }, env, 'p', [page])
  assert.equal(g.headers.Authorization, 'Bearer q')
  assert.equal(g.body.messages[0].content[1].image_url.url, 'data:image/jpeg;base64,QUJD')
})

test('a busy model hands the page to the next one, and is skipped while it rests', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'm1,m2', GROQ_API_KEY: 'q', GROQ_VISION_MODEL: 'scout' }
  const calls = []
  const fetchFn = async (url) => {
    calls.push(url.includes('groq') ? 'groq' : url.match(/models\/([^:]+)/)[1])
    if (url.includes('/m1:')) return geminiBusy(40)
    if (url.includes('/m2:')) return json(503, { error: { message: 'overloaded' } })
    return json(200, { choices: [{ message: { content: '{"items":[]}' } }] })
  }
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.deepEqual(r, { ok: true, text: '{"items":[]}', model: 'groq:scout' })
  assert.deepEqual(calls, ['m1', 'm2', 'groq'])
  calls.length = 0
  await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.deepEqual(calls, ['m2', 'groq'])                       // m1 is resting for 40 s
})

test('when every model is busy the caller is told how long to wait', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'm1,m2' }
  const fetchFn = async (url) => geminiBusy(url.includes('/m1:') ? 50 : 20)
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.equal(r.ok, false); assert.equal(r.status, 429); assert.equal(r.retryAfter, 20)
  const again = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn: async () => { throw new Error('not called') } })
  assert.equal(again.status, 429); assert.ok(again.retryAfter > 0 && again.retryAfter <= 20)
})

test('the first model that works answers, and a missing key is a clear error', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g' }
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn: async () => geminiOk('{"items":[1]}') })
  assert.equal(r.model, 'gemini:gemini-2.5-flash')
  const none = await readWithChain({ chain: [], env: {}, prompt: 'p', images: [page] })
  assert.match(none.error, /GEMINI_API_KEY/)
})

test('a free model that no longer exists is skipped for later pages', async () => {
  clearBusy()
  const env = { OPENROUTER_API_KEY: 'o', OPENROUTER_VISION_MODEL: 'gone:free,here:free' }
  const calls = []
  const fetchFn = async (url, o) => {
    const m = JSON.parse(o.body).model; calls.push(m)
    return m === 'gone:free' ? json(404, { error: { message: 'No endpoints found' } }) : json(200, { choices: [{ message: { content: '{}' } }] })
  }
  assert.equal((await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })).model, 'openrouter:here:free')
  await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.deepEqual(calls, ['gone:free', 'here:free', 'here:free'])
})

test('a used-up daily limit or a refused key is reported, not waited for', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'm1', GROQ_API_KEY: 'bad', GROQ_VISION_MODEL: 'scout', OPENROUTER_API_KEY: 'o', OPENROUTER_VISION_MODEL: 'q:free' }
  const daily = json(429, { error: { message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '69s' }] } })
  const fetchFn = async (url) => url.includes('generativelanguage') ? daily
    : url.includes('groq') ? json(401, { error: { message: 'Invalid API Key' } })
    : json(404, { error: { message: 'No endpoints found matching your data policy' } })
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.equal(r.status, 503)                                    // not 429: waiting will not help, and not 401 (the page would ask the teacher to sign in)
  assert.deepEqual(r.details.map((d) => d.why), ['daily free limit used up', 'API key refused: check it in Vercel → Environment Variables', 'free models are turned off in OpenRouter → Settings → Privacy'])
  // the next page does not call them again, but still says why
  const again = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn: async () => { throw new Error('not called') } })
  assert.equal(again.status, 503); assert.equal(again.details.length, 3)
})

test('one model busy for a minute and the others unusable: wait for that one', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'm1', GROQ_API_KEY: 'bad' }
  const fetchFn = async (url) => url.includes('groq') ? json(401, {}) : geminiBusy(25)
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.equal(r.status, 429); assert.equal(r.retryAfter, 25)
})

test('Gemini: the newest Flash models first, previews after released ones, then large Gemma models', () => {
  const m = (name, gen = true) => ({ name: `models/${name}`, supportedGenerationMethods: gen ? ['generateContent', 'countTokens'] : ['embedContent'] })
  const got = pickGemini([m('gemini-2.0-flash'), m('gemini-3.1-flash-lite'), m('gemini-3.1-flash'), m('gemini-3.5-flash-preview-09-2026'), m('gemini-3.1-flash-image'),
    m('gemini-3.1-pro'), m('gemini-2.5-flash-preview-tts'), m('text-embedding-004', false), m('gemma-3-27b-it'), m('gemma-3-4b-it'), m('gemma-3-12b-it')])
  assert.deepEqual(got, ['gemini-3.1-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-preview-09-2026', 'gemini-2.0-flash', 'gemma-3-27b-it', 'gemma-3-12b-it'])
})

test('Groq and OpenRouter: only models that read images (and on OpenRouter, only free ones)', () => {
  assert.deepEqual(pickGroq([{ id: 'llama-3.3-70b-versatile' }, { id: 'meta-llama/llama-4-scout-17b-16e-instruct' }, { id: 'whisper-large-v3' }, { id: 'meta-llama/llama-4-maverick-x', active: false }]),
    ['meta-llama/llama-4-scout-17b-16e-instruct'])
  const or = (id, image, price = '0') => ({ id, architecture: { input_modalities: image ? ['text', 'image'] : ['text'] }, pricing: { prompt: price, completion: price } })
  assert.deepEqual(pickOpenRouter([or('a/text-only:free', false), or('x/paid-vision', true, '0.000001'), or('mistralai/mistral-small-3.3:free', true), or('qwen/qwen3-vl-30b:free', true)]),
    ['qwen/qwen3-vl-30b:free', 'mistralai/mistral-small-3.3:free'])
})

test('the chain uses what each provider offers now, falls back to the defaults, and a fixed list wins', async () => {
  clearDiscovered()
  const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', OPENROUTER_API_KEY: 'o' }
  const fetchFn = async (url) => url.includes('generativelanguage') ? json(200, { models: [{ name: 'models/gemini-3.1-flash', supportedGenerationMethods: ['generateContent'] }] })
    : url.includes('groq') ? json(500, {})
    : json(200, { data: [{ id: 'qwen/qwen3-vl:free', architecture: { input_modalities: ['image'] }, pricing: {} }] })
  const chain = await resolveChain(env, { fetchFn })
  assert.deepEqual(chain.map((e) => `${e.provider}:${e.model}`), ['gemini:gemini-3.1-flash', ...DEFAULT_GROQ_MODELS.map((m) => `groq:${m}`), 'openrouter:qwen/qwen3-vl:free'])
  // cached: the lists are not fetched again
  const again = await resolveChain(env, { fetchFn: async (url) => (url.includes('groq') ? json(500, {}) : assert.fail('fetched again')) })
  assert.equal(again[0].model, 'gemini-3.1-flash')
  assert.deepEqual((await resolveChain({ GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'mine' }, { fetchFn })).map((e) => e.model), ['mine'])
})

test('a model that refuses one setting is asked again without it', async () => {
  clearBusy()
  const env = { GEMINI_API_KEY: 'g' }
  const bodies = []
  const fetchFn = async (url, o) => {
    const b = JSON.parse(o.body); bodies.push(b.generationConfig)
    return b.generationConfig.thinkingConfig ? json(400, { error: { message: 'Thinking budget is not supported for this model.' } }) : geminiOk('{"items":[]}')
  }
  const r = await readWithChain({ chain: [{ provider: 'gemini', model: 'gemini-3.5-flash' }], env, prompt: 'p', images: [page], fetchFn })
  assert.equal(r.ok, true); assert.equal(bodies.length, 2); assert.equal(bodies[1].thinkingConfig, undefined)
  assert.equal(buildRequest({ provider: 'gemini', model: 'gemma-3-27b-it' }, env, 'p', [page]).body.generationConfig.responseMimeType, undefined)
})

test('reasons name the whole model, and a gone model says what the provider said', async () => {
  clearBusy()
  const env = { OPENROUTER_API_KEY: 'o' }
  const r = await readWithChain({ chain: [{ provider: 'openrouter', model: 'qwen/qwen2.5-vl-72b-instruct:free' }], env, prompt: 'p', images: [page], fetchFn: async () => json(404, { error: { message: 'No endpoints found for qwen/qwen2.5-vl-72b-instruct:free.' } }) })
  assert.equal(r.details[0].name, 'openrouter qwen2.5-vl-72b-instruct:free')
  assert.match(r.details[0].why, /^model not available \(No endpoints found/)
})

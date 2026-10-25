// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { visionChain, buildRequest, readWithChain, clearBusy, DEFAULT_GEMINI_MODELS } from '../api/_gemini/visionModels.js'

const page = { mimeType: 'image/jpeg', data: 'QUJD' }
const json = (status, body, headers = {}) => ({ ok: status < 400, status, json: async () => body, headers: { get: (k) => headers[k.toLowerCase()] ?? null } })
const geminiOk = (text) => json(200, { candidates: [{ content: { parts: [{ text }] } }] })
const geminiBusy = (s) => json(429, { error: { message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${s}s` }] } })

test('the chain is the Gemini models on one key, then Groq and OpenRouter only when their keys are set', () => {
  assert.deepEqual(visionChain({}), [])
  assert.deepEqual(visionChain({ GEMINI_API_KEY: 'g' }).map((e) => e.model), DEFAULT_GEMINI_MODELS)
  const all = visionChain({ GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'a, b', GROQ_API_KEY: 'q', OPENROUTER_API_KEY: 'o', OPENROUTER_VISION_MODEL: 'x:free' })
  assert.deepEqual(all.map((e) => `${e.provider}:${e.model}`), ['gemini:a', 'gemini:b', 'groq:meta-llama/llama-4-scout-17b-16e-instruct', 'openrouter:x:free'])
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
  const env = { GEMINI_API_KEY: 'g', GEMINI_VISION_MODELS: 'm1,m2', GROQ_API_KEY: 'q' }
  const calls = []
  const fetchFn = async (url) => {
    calls.push(url.includes('groq') ? 'groq' : url.match(/models\/([^:]+)/)[1])
    if (url.includes('/m1:')) return geminiBusy(40)
    if (url.includes('/m2:')) return json(503, { error: { message: 'overloaded' } })
    return json(200, { choices: [{ message: { content: '{"items":[]}' } }] })
  }
  const r = await readWithChain({ chain: visionChain(env), env, prompt: 'p', images: [page], fetchFn })
  assert.deepEqual(r, { ok: true, text: '{"items":[]}', model: 'groq:meta-llama/llama-4-scout-17b-16e-instruct' })
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

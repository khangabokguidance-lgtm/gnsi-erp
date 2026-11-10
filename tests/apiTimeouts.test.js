import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { timedFetch, razorpayOrder, DB_TIMEOUT_MS, PAY_TIMEOUT_MS } from '../api/_entrance/_lib.js'

const realFetch = globalThis.fetch
// AbortSignal.timeout() uses an unref'd timer: in a real server other open connections keep the process alive; in a bare test we must
const keepAlive = () => { const i = setInterval(() => {}, 20); return () => clearInterval(i) }
const hangUntilAborted = (_u, init = {}) => new Promise((_res, rej) => { init.signal?.addEventListener('abort', () => rej(init.signal.reason || new Error('aborted'))) })

test('a request that never answers is cut off at the time limit (instead of waiting for Vercel\'s 300 s)', async () => {
  globalThis.fetch = hangUntilAborted
  const stop = keepAlive()
  try {
    const t0 = Date.now()
    await assert.rejects(() => timedFetch(60)('https://example.test/x'), /timed? ?out|abort/i)
    assert.ok(Date.now() - t0 < 1000, 'gave up quickly')
  } finally { globalThis.fetch = realFetch; stop() }
})
test('a caller\'s own abort signal still works, and a fast answer passes through untouched', async () => {
  globalThis.fetch = hangUntilAborted
  try {
    const c = new AbortController(); const p = timedFetch(5000)('https://example.test/x', { signal: c.signal }); c.abort(new Error('caller cancelled'))
    await assert.rejects(() => p, /caller cancelled/)
    globalThis.fetch = async (u, init) => ({ ok: true, status: 200, u, hasSignal: !!init.signal, json: async () => ({ hi: 1 }) })
    const r = await timedFetch(5000)('https://example.test/ok'); assert.equal(r.ok, true); assert.equal(r.hasSignal, true)
  } finally { globalThis.fetch = realFetch }
})
test('limits are sane: well under the function limit', () => { assert.ok(DB_TIMEOUT_MS <= 25000 && PAY_TIMEOUT_MS <= 20000 && PAY_TIMEOUT_MS >= 5000) })

test('the Razorpay order is created with a plain authenticated POST (same body the SDK sent) and errors are reported', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_k'; process.env.RAZORPAY_KEY_SECRET = 'sec'
  let seen
  globalThis.fetch = async (u, init) => { seen = { u, init }; return { ok: true, status: 200, json: async () => ({ id: 'order_1', amount: 50000, currency: 'INR' }) } }
  try {
    const o = await razorpayOrder({ amount: 50000, currency: 'INR', receipt: 'APP1', notes: { a: 1 } })
    assert.equal(o.id, 'order_1'); assert.equal(seen.u, 'https://api.razorpay.com/v1/orders'); assert.equal(seen.init.method, 'POST')
    assert.equal(seen.init.headers.Authorization, 'Basic ' + Buffer.from('rzp_test_k:sec').toString('base64'))
    assert.deepEqual(JSON.parse(seen.init.body), { amount: 50000, currency: 'INR', receipt: 'APP1', notes: { a: 1 } })
    assert.ok(seen.init.signal, 'it carries a time limit')
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { description: 'Amount too low' } }) })
    await assert.rejects(() => razorpayOrder({ amount: 1 }), /Razorpay 400: Amount too low/)
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error('not json') } })
    await assert.rejects(() => razorpayOrder({ amount: 1 }), /Razorpay 502/)
  } finally { globalThis.fetch = realFetch }
})
test('no handler loads the Razorpay SDK (its HTTP library logged the url.parse() warnings) or makes an un-timed outside call', () => {
  for (const dir of ['api/_entrance', 'api/_admission']) for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const src = readFileSync(`${dir}/${f}`, 'utf8')
    assert.ok(!/from 'razorpay'/.test(src), `${dir}/${f} imports the SDK`)
    if (f !== '_lib.js') assert.ok(!/[^a-zA-Z.]fetch\(/.test(src.replace(/\/\/.*$/gm, '')), `${dir}/${f} calls fetch() without a time limit`)
  }
})
test('the entrance function is capped at 30 s in vercel.json', () => {
  assert.equal(JSON.parse(readFileSync('vercel.json', 'utf8')).functions['api/entrance.js'].maxDuration, 30)
})

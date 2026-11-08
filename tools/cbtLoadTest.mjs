// cbtLoadTest.mjs — simulates a batch of candidates taking an online CBT exam against a REAL Postgres that has the CBT
// migrations applied (20261034 … 20261064), calling the same functions the exam page calls, as the `anon` role.
//   node tools/cbtLoadTest.mjs [--students 300] [--save-every 20] [--minutes 3] [--ip nat|spread] [--pool 40]
// Needs:  npm i --no-save pg     and   PGURL=postgres://user@host:port/db   (a scratch database — it creates and deletes its own test).
// It measures the database work only (no web / PostgREST layer in front), so treat the numbers as the floor.
import pg from 'pg'
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const N = Number(arg('students', 300)), EVERY = Number(arg('save-every', 20)), MIN = Number(arg('minutes', 3)), IPMODE = arg('ip', 'nat'), POOL = Number(arg('pool', 40))
const pool = new pg.Pool({ connectionString: process.env.PGURL, max: POOL })
const lat = {}, errs = {}
const rec = (k, ms, err) => { (lat[k] ||= []).push(ms); if (err) errs[k + ' · ' + err] = (errs[k + ' · ' + err] || 0) + 1 }
const headers = i => JSON.stringify(IPMODE === 'nat' ? { 'x-forwarded-for': '203.0.113.7' } : { 'x-forwarded-for': `198.51.${Math.floor(i / 250)}.${i % 250 + 1}` })

async function rpc(i, name, fnCall, params) {
  const c = await pool.connect(), t0 = performance.now()
  try {
    await c.query('begin'); await c.query('set local role anon'); await c.query('select set_config($1,$2,true)', ['request.headers', headers(i)])
    const r = await c.query(`select public.${fnCall} as r`, params); await c.query('commit')
    const out = r.rows[0].r; rec(name, performance.now() - t0, out?.error ? String(out.error).slice(0, 40) : null); return out
  } catch (e) { await c.query('rollback').catch(() => {}); rec(name, performance.now() - t0, e.message.slice(0, 40)); return null } finally { c.release() }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }

const TEST = 'loadtest-' + Date.now().toString(36)
const sections = [0, 1, 2, 3].map(s => ({ id: 's' + s, title: 'S' + s, questions: Array.from({ length: 25 }, (_, q) => ({ no: s * 25 + q + 1, text: 'Q', options: ['A', 'B', 'C', 'D'].map(k => ({ key: k, text: k })) })) }))
await pool.query(`insert into public.cbt_tests (id, name, duration_min, sections, status, access_code) values ($1,'Load test',60,$2,'live','246810')`, [TEST, JSON.stringify(sections)])
await pool.query(`insert into public.cbt_keys (test_id, answers) values ($1,$2)`, [TEST, JSON.stringify(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i + 1, 'ABCD'[i % 4]])))])

async function student(i) {
  const gcc = String(i + 1), phone = '9' + String(100000000 + i + 1).padStart(9, '0')
  await sleep(Math.random() * 60000 * Math.min(1, N / 300))                     // starts spread over the first minute
  const l1 = await rpc(i, 'lookup (GCC)', 'cbt_lookup($1,$2,$3)', [TEST, '246810', gcc]); if (!l1 || l1.error) return
  const dob = l1[0]?.hasDob ? (process.env.DOB || '01022010') : null          // second check when the student has a date of birth on file
  const l2 = await rpc(i, 'lookup (verify)', 'cbt_lookup($1,$2,$3,$4,$5)', [TEST, '246810', gcc, phone, dob]); if (!l2 || l2.error || l2[0]?.verified !== true) return
  const st = await rpc(i, 'start', 'cbt_start($1,$2,$3,$4,null,$5)', [TEST, '246810', gcc, phone, dob]); if (!st || st.error) return
  const { attempt: { id }, token, session } = st; const answers = {}
  const end = Date.now() + MIN * 60000
  while (Date.now() < end) {
    await sleep(EVERY * 1000 * (0.8 + Math.random() * 0.4))
    for (let k = 0; k < 2; k++) answers[1 + Math.floor(Math.random() * 100)] = 'ABCD'[Math.floor(Math.random() * 4)]
    await rpc(i, 'save', 'cbt_save($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8)', [id, token, JSON.stringify(answers), JSON.stringify({ m: {}, v: {} }), 1, 'en', 0, session])
  }
  await rpc(i, 'submit', 'cbt_submit($1,$2,$3::jsonb,$4::jsonb,$5,$6)', [id, token, JSON.stringify(answers), JSON.stringify({ m: {}, v: {} }), 0, session])
}

const t0 = Date.now()
await Promise.all(Array.from({ length: N }, (_, i) => student(i)))
console.log(`\n${N} students · save every ${EVERY}s for ${MIN} min · ${IPMODE === 'nat' ? 'ONE shared network address (a school / lab)' : 'a different address each'} · db pool ${POOL} · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log('call'.padEnd(18), 'count'.padStart(7), 'p50 ms'.padStart(8), 'p95 ms'.padStart(8), 'p99 ms'.padStart(8), 'max ms'.padStart(8))
for (const [k, a] of Object.entries(lat)) console.log(k.padEnd(18), String(a.length).padStart(7), pct(a, .5).toFixed(1).padStart(8), pct(a, .95).toFixed(1).padStart(8), pct(a, .99).toFixed(1).padStart(8), Math.max(...a).toFixed(1).padStart(8))
const started = lat.start?.length || 0, ok = (await pool.query(`select count(*)::int n, count(*) filter (where state='submitted')::int s from public.cbt_attempts where test_id=$1`, [TEST])).rows[0]
console.log(`\nattempts created: ${ok.n} of ${N} · submitted: ${ok.s}`)
console.log('problems:', Object.keys(errs).length ? errs : 'none')
await pool.query('delete from public.cbt_tests where id=$1', [TEST]); await pool.query(`delete from public.cbt_hits`); await pool.end()

// Run:  PGURL=postgres://user@host:port/db node tools/cbt-e2e/shim.cjs
// A tiny PostgREST stand-in: POST /rpc/<fn> with named args -> runs the real SQL function as role anon on the real Postgres.
const http = require('http')
const pg = require('pg')   // npm i --no-save pg
const pool = new pg.Pool({ connectionString: process.env.PGURL, max: 10 })
http.createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  let body = ''
  for await (const c of req) body += c
  const m = req.url.match(/^\/rpc\/(\w+)/)
  if (!m) { res.writeHead(404, cors); return res.end('{}') }
  const args = body ? JSON.parse(body) : {}
  const keys = Object.keys(args)
  const c = await pool.connect()
  try {
    await c.query('begin')
    await c.query('set local role anon')
    await c.query('select set_config($1,$2,true)', ['request.headers', JSON.stringify({ 'x-forwarded-for': '203.0.113.7' })])
    const sql = 'select public.' + m[1] + '(' + keys.map((k, i) => k + ' => $' + (i + 1)).join(', ') + ') as r'
    const vals = keys.map(k => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k])
    const r = await c.query(sql, vals)
    await c.query('commit')
    res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, cors))
    res.end(JSON.stringify(r.rows[0].r))
  } catch (e) {
    await c.query('rollback').catch(() => {})
    res.writeHead(400, Object.assign({ 'content-type': 'application/json' }, cors))
    res.end(JSON.stringify({ code: e.code, message: e.message }))
  } finally { c.release() }
}).listen(3999, () => console.log('shim up'))

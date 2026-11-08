// Stands in for src/supabase.js in the test bundle: only rpc() works, and it talks to shim.cjs (which runs the real SQL).
const call = async (fn, args) => {
  const r = await fetch('http://127.0.0.1:3999/rpc/' + fn, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args || {}) })
  const j = await r.json()
  return r.ok ? { data: j, error: null } : { data: null, error: { code: j.code, message: j.message } }
}
export const supabase = {
  rpc: call,
  from: () => { throw new Error('table access is not available in the candidate page test') },
  auth: { getSession: async () => ({ data: { session: null } }) },
}

// Shared access checks for the serverless endpoints. The folder starts with "_" so Vercel does not
// count it as a function (same pattern as api/_entrance). Nothing here trusts the request body:
// the caller must present their Supabase Auth access token as "Authorization: Bearer <token>".
//
// "Staff" is decided by the DATABASE (qbank_is_staff(), the same check the RLS policies use), not by
// the e-mail address — the login flow self-registers accounts, so an e-mail suffix proves nothing.
import { createClient } from '@supabase/supabase-js'

const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

let _svc
export const service = () => (_svc ||= createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

// A client that acts AS the caller, so RLS and auth.uid() apply exactly as they do in the browser.
export const asUser = (token) => createClient(url(), anonKey(), {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
})

export const bearer = (req) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || '')
  return m ? m[1].trim() : ''
}

export const clientIp = (req) =>
  String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()

// Signed-in user (staff OR parent) or null.
export async function getUser(req) {
  const token = bearer(req)
  if (!token) return null
  try {
    const { data, error } = await service().auth.getUser(token)
    return error || !data?.user ? null : { ...data.user, token }
  } catch { return null }
}

const rpcCache = new Map() // `${fn}:${userId}` -> { at, ok } — keeps repeated calls cheap
async function rpcFlag(user, fn) {
  const k = `${fn}:${user.id}`, hit = rpcCache.get(k)
  if (hit && Date.now() - hit.at < 60_000) return hit.ok
  const ok = await asUser(user.token).rpc(fn).then(({ data }) => data === true, () => false)
  rpcCache.set(k, { at: Date.now(), ok })
  return ok
}
export const isStaff = (user) => rpcFlag(user, 'qbank_is_staff')
export const isAdmin = (user) => rpcFlag(user, 'qbank_is_admin')

export async function requireUser(req, res) {
  const user = await getUser(req)
  if (!user) { res.status(401).json({ error: 'Please sign in again.' }); return null }
  return user
}

export async function requireStaff(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  if (!(await isStaff(user))) { res.status(403).json({ error: 'Staff access only.' }); return null }
  return user
}

// Best-effort limiter (per warm serverless instance). Stops casual abuse and runaway loops; it is not
// a substitute for a shared store if you ever need hard guarantees.
const buckets = new Map()
export function rateLimit(req, res, { key, max, windowMs = 60_000, id }) {
  const now = Date.now(), k = `${key}:${id || clientIp(req)}`
  const b = buckets.get(k)
  if (!b || now > b.reset) { buckets.set(k, { n: 1, reset: now + windowMs }); if (buckets.size > 5000) for (const [kk, v] of buckets) if (now > v.reset) buckets.delete(kk); return true }
  if (++b.n > max) {
    res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000))
    res.status(429).json({ error: 'Too many requests — please wait a minute.' })
    return false
  }
  return true
}

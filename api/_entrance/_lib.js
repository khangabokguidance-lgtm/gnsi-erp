// api/entrance/_lib.js — shared helpers for the entrance-exam registration functions (not a route: leading underscore).
//
// These run with the Supabase SERVICE ROLE, because a visitor registering online has no staff session and the
// entrance tables are staff-only. Everything a visitor sends is therefore treated as untrusted: the amount is
// decided here from the exam, the fee is only marked paid after Razorpay confirms it, and a candidate is
// identified by application number + date of birth (never by a guessable id).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from '@supabase/supabase-js'
import { sameDob } from './entranceReg.js'

export const BUCKET = 'gnsi'
export const EXAM_FIELDS = 'id, exam_name, exam_type, exam_date, exam_time, reporting_time, duration_mins, venue, class_target, application_fee, app_open, app_close, status, instructions, course'

// Every call to the outside has a time limit. Without one, a database or payment request that never answers keeps the function
// alive until Vercel stops it ("Task timed out after 300 seconds") while the visitor waits and the bill grows.
export const DB_TIMEOUT_MS = 20000
export const PAY_TIMEOUT_MS = 15000
const combine = (outer, ms) => {
  const t = AbortSignal.timeout(ms)
  if (!outer) return t
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([outer, t])
  const c = new AbortController(); const on = () => c.abort(); outer.addEventListener('abort', on); t.addEventListener('abort', on); return c.signal
}
/** A fetch that gives up after `ms` (and still honours a signal the caller passes). */
export const timedFetch = ms => (input, init = {}) => fetch(input, { ...init, signal: combine(init.signal, ms) })
export const payFetch = timedFetch(PAY_TIMEOUT_MS)

let _db
export const db = () => (_db ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, global: { fetch: timedFetch(DB_TIMEOUT_MS) } }))

// A Razorpay order, created with a plain HTTPS call (no SDK → no extra HTTP library loaded, and a hard time limit).
export async function razorpayOrder(order) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const r = await payFetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(order) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Razorpay ${r.status}: ${j?.error?.description || 'could not create the order'}`)
  return j
}

export const send = (res, code, body) => res.status(code).json(body)
export function only(req, res, method) {
  if (req.method !== method) { res.setHeader('Allow', method); send(res, 405, { error: 'Method not allowed' }); return false }
  return true
}
export const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))

// A failed login costs the caller a moment, which blunts guessing application numbers + dates of birth.
const slow = () => new Promise(r => setTimeout(r, 400))

// Candidate + exam for application number + date of birth, or null.
export async function findCandidate(applicationNo, dob) {
  const no = String(applicationNo || '').trim().toUpperCase()
  if (!no || !dob) { await slow(); return null }
  const { data: rows, error } = await db().from('entrance_candidates').select('*').eq('application_no', no).limit(5)
  if (error) throw new Error(error.message)
  const c = (rows || []).find(r => sameDob(r.dob, dob))
  if (!c) { await slow(); return null }
  const { data: exam } = await db().from('entrance_exams').select('*').eq('id', c.exam_id).maybeSingle()
  return { candidate: c, exam }
}

// "data:image/jpeg;base64,...." → { buffer, type } (images only), or null.
export function parseDataUrl(s, maxBytes) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''))
  if (!m) return null
  const buffer = Buffer.from(m[2], 'base64')
  if (!buffer.length || buffer.length > maxBytes) return null
  return { buffer, type: m[1] }
}

// Insert, dropping any column the database does not have yet (the 20261029 migration may not be run).
export async function insertTolerant(table, row) {
  let body = { ...row }
  for (let i = 0; i < 10; i++) {
    const { data, error } = await db().from(table).insert(body).select().single()
    const m = error && /Could not find the '([^']+)' column|column "?([a-z_]+)"? (?:of relation "?[a-z_]+"? )?does not exist/i.exec(error.message || '')
    const col = m && (m[1] || m[2])
    if (col && col in body) { delete body[col]; continue }
    return { data, error, dropped: Object.keys(row).filter(k => !(k in body)) }
  }
  return { data: null, error: { message: 'Too many unknown columns' }, dropped: [] }
}
export async function updateTolerant(table, patch, match) {
  let body = { ...patch }
  for (let i = 0; i < 10; i++) {
    let q = db().from(table).update(body)
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
    const { error } = await q
    const m = error && /Could not find the '([^']+)' column|column "?([a-z_]+)"? (?:of relation "?[a-z_]+"? )?does not exist/i.exec(error.message || '')
    const col = m && (m[1] || m[2])
    if (col && col in body) { delete body[col]; continue }
    return { error }
  }
  return { error: { message: 'Too many unknown columns' } }
}

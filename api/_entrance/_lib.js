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

let _db
export const db = () => (_db ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

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

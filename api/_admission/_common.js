// api/_admission/_common.js — helpers shared by the online admission portal functions (not a route: leading underscore).
// Service-role access; see api/_entrance/_lib.js. An applicant is identified by reference number + date of birth.
import { db, sameDobFn, BUCKET } from './_deps.js'
import { OPEN_STATUSES } from './portalApply.js'

export { BUCKET }
const slow = () => new Promise(r => setTimeout(r, 400))

// The admission session that is taking applications, or null when none is active / it is locked.
export async function openSession() {
  const { data } = await db().from('admission_sessions').select('session_name, is_active, is_locked').eq('is_active', true).limit(1)
  const s = (data || [])[0]
  return s && !s.is_locked ? s.session_name : null
}

// Course / batch / hostel combinations the office has priced for the session, with the admission fee for each.
export async function feeOptions(session) {
  const { data, error } = await db().from('fee_structures').select('course, batch, hostel_type, admission_fee').eq('session_year', session)
  if (error) throw new Error(error.message)
  return (data || []).filter(r => r.course && r.batch && r.hostel_type).map(r => ({ course: r.course, batch: r.batch, hostel_type: r.hostel_type, admission_fee: Number(r.admission_fee) || 0 }))
}

export async function findApplication(reference, dob) {
  const ref = String(reference || '').trim().toUpperCase()
  if (!ref || !dob) { await slow(); return null }
  const { data, error } = await db().from('portal_applications').select('*').eq('reference_no', ref).limit(1)
  if (error) throw new Error(error.message)
  const a = (data || [])[0]
  if (!a || !sameDobFn(a.dob, dob)) { await slow(); return null }
  return a
}

export const isOpen = a => OPEN_STATUSES.includes(a.status)

export async function logEvent(applicationId, actor, action, detail = null) {
  await db().from('portal_application_events').insert({ application_id: applicationId, actor, action, detail }).then(() => {}, () => {})
}

// courseModeRpc.js — the database side of a course / hostel type change.
//
// With 20261129_student_course_mode_change.sql run, a change (or an undo) is ONE
// database call: the history row, the student record, the admissions mirror and the
// audit entry are saved together, admin only, reason required. Before that update is
// run the callers fall back to their older step-by-step saves (rpc() returns
// { missing: true }), so nothing breaks in between.
import { supabase } from './supabase'

export const MIN_REASON = 3
export const reasonError = (reason, what = 'the change') =>
  String(reason || '').trim().length >= MIN_REASON ? '' : `Give a reason for ${what} (at least ${MIN_REASON} letters).`

// PostgREST / Postgres "no such function" → the update hasn't been run yet.
export const rpcMissing = err => !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''))

// { data } on success, { missing: true } when the function isn't installed; throws otherwise.
async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (!error) return { data: data || {} }
  if (rpcMissing(error)) return { missing: true }
  throw new Error(error.message || 'Could not save.')
}

// toType and/or toCourse (null = unchanged). toBatch null = keep current batch.
export const rpcChange = ({ student, effectiveFrom, reason, toType = null, toCourse = null, toBatch = null, by = null }) =>
  call('student_change_course_mode', {
    p_student_id: String(student.id), p_effective_from: effectiveFrom, p_reason: String(reason || '').trim(),
    p_to_type: toType, p_to_course: toCourse, p_to_batch: toBatch, p_by: by,
  })

export const rpcUndo = ({ student, kind, reason, by = null }) =>
  call('student_undo_course_mode_change', { p_student_id: String(student.id), p_kind: kind, p_reason: String(reason || '').trim(), p_by: by })

export const rpcClearHostel = ({ gcc, reason, by = null }) =>
  call('student_clear_hostel_history', { p_gcc: String(gcc ?? ''), p_reason: String(reason || '').trim(), p_by: by })

// ── change requests (Admin approval) ─────────────────────────────────────────
export const REQUESTS_SETUP_MSG = 'Course / hostel type change requests need the database update 20261129_student_course_mode_change.sql — run it in Supabase (SQL editor) first.'
const missingRequests = err => !!err && (err.code === '42P01' || err.code === 'PGRST205' || /student_course_mode_requests/.test(err.message || ''))

async function must(fn, args) {
  const r = await call(fn, args)
  if (r.missing) throw new Error(REQUESTS_SETUP_MSG)
  return r.data
}

// Staff: ask for a change. Nothing is re-priced until an admin approves it.
export const requestChange = ({ student, effectiveFrom, reason, toType = null, toCourse = null, toBatch = null, by = null, feeImpact = null }) =>
  must('student_request_course_mode', {
    p_student_id: String(student.id), p_effective_from: effectiveFrom, p_reason: String(reason || '').trim(),
    p_to_type: toType, p_to_course: toCourse, p_to_batch: toBatch, p_by: by, p_fee_impact: feeImpact,
  })

// Admin: approve (applies the change) or reject (note required).
export const decideRequest = ({ id, approve, note = '', by = null }) =>
  must('student_decide_course_mode_request', { p_request_id: id, p_approve: !!approve, p_note: note, p_by: by })

// The requester or an admin, while pending.
export const cancelRequest = ({ id, note = '' }) => must('student_cancel_course_mode_request', { p_request_id: id, p_note: note })

// Newest first. { rows, setupNeeded, error }
export async function loadRequests({ status = null, gcc = null, limit = 300 } = {}) {
  let q = supabase.from('student_course_mode_requests').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  if (gcc != null) q = q.eq('gcc_no', String(parseInt(gcc) || 0))
  const { data, error } = await q
  if (error) return { rows: [], setupNeeded: missingRequests(error), error: missingRequests(error) ? null : error.message }
  return { rows: data || [], setupNeeded: false, error: null }
}

export async function countPendingRequests() {
  const { count, error } = await supabase.from('student_course_mode_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return error ? 0 : (count || 0)
}

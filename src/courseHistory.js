// courseHistory.js — course / batch changes with an effective month (storage side).
// See lib/courseHistory.js for the rules and supabase/migrations/20261111_student_course_history.sql.
import { supabase } from './supabase'
import { validateCourseChange, sortChanges } from './lib/courseHistory'

export const COURSE_HISTORY_SETUP_MSG = 'Changing a course with an effective month needs the database update 20261111_student_course_history.sql — run it in Supabase (SQL editor) first.'
const gccKey = v => String(parseInt(v) || 0)
const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /student_course_history/.test(err.message || ''))

// One student's course changes, oldest first. Staff read the table; a parent (no staff
// session) goes through public_course_history(). Never throws; no table = no changes.
export async function loadStudentCourseHistory(gcc, { staff = true } = {}) {
  try {
    if (staff) {
      const { data, error } = await supabase.from('student_course_history').select('*').eq('gcc_no', gccKey(gcc))
      if (!error) return sortChanges(data)
    }
    const { data, error } = await supabase.rpc('public_course_history', { p_gcc: gccKey(gcc) })
    return error ? [] : sortChanges(data)
  } catch { return [] }
}

// Every student's changes, grouped by GCC (oldest first) — for the bulk checks. { map, setupNeeded }
export async function loadAllCourseHistory() {
  const map = new Map()
  const { data, error } = await supabase.from('student_course_history').select('*')
  if (error) return { map, setupNeeded: missingTable(error) }
  for (const r of data || []) { const k = gccKey(r.gcc_no); if (!map.has(k)) map.set(k, []); map.get(k).push(r) }
  for (const [k, list] of map) map.set(k, sortChanges(list))
  return { map, setupNeeded: false }
}

// For the ledger engine. Staff: ONE query for every student's changes (the table only
// holds changes, so it is small), shared and cached for a minute — never one query per
// student, which would swamp the bulk ledgers and dues lists. A parent (no staff
// session, RLS hides the table) gets just their own child's timeline through the
// public function. Cleared when a change is saved or undone.
const TTL = 60000
let _bulk = null                 // { at, promise }
const _own = new Map()           // parent view: gcc -> { at, list }
export function clearCourseHistoryCache() { _bulk = null; _own.clear() }
async function hasStaffSession() {
  try { const { data } = await supabase.auth.getSession(); return !!data?.session } catch { return false }
}
export async function courseChangesFor(student) {
  const k = gccKey(student?.gcc_no)
  if (k === '0') return []
  if (await hasStaffSession()) {
    if (!_bulk || Date.now() - _bulk.at > TTL) _bulk = { at: Date.now(), promise: loadAllCourseHistory().catch(() => ({ map: new Map() })) }
    const { map } = await _bulk.promise
    return map.get(k) || []
  }
  const hit = _own.get(k)
  if (hit && Date.now() - hit.at < TTL) return hit.list
  const list = await loadStudentCourseHistory(student.gcc_no, { staff: false })
  _own.set(k, { at: Date.now(), list })
  return list
}

// Move a student to another course / batch from a month onward. Earlier months keep
// the old course's rates. Admin only (enforced by RLS). effectiveFrom: 'YYYY-MM-01'.
export async function changeCourse({ student, toCourse, toBatch, effectiveFrom, reason, by, changes = [] }) {
  const err = validateCourseChange({ student, toCourse, toBatch, effectiveFrom, changes })
  if (err) throw new Error(err)
  const newBatch = toBatch ?? student.batch ?? ''
  const { error } = await supabase.from('student_course_history').insert({
    student_id: student.id != null ? String(student.id) : null, gcc_no: gccKey(student.gcc_no), student_name: student.name || null,
    from_course: student.course || '', to_course: toCourse, from_batch: student.batch || '', to_batch: newBatch,
    effective_from: effectiveFrom, reason: reason || null, changed_by: by || null,
  })
  // Without the history row, updating the student would re-price every past month — stop.
  if (error) throw new Error(missingTable(error) ? COURSE_HISTORY_SETUP_MSG : error.message)
  const { error: sErr } = await supabase.from('students').update({ course: toCourse, batch: newBatch }).eq('id', student.id)
  if (sErr) throw new Error(`History saved, but the student record could not be updated: ${sErr.message}`)
  clearCourseHistoryCache()
  try {
    await supabase.from('audit_log').insert({
      action: 'course_changed', changed_by: by || 'Admin', target_id: String(student.id ?? ''),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, from: student.course, from_batch: student.batch, to: toCourse, to_batch: newBatch, effective_from: effectiveFrom, reason: reason || null }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
  return { course: toCourse, batch: newBatch }
}

// Undo the latest course change (admin): the student goes back to its previous course / batch.
export async function undoLastCourseChange({ student, changes, by }) {
  const last = changes?.[changes.length - 1]
  if (!last) return null
  const { error } = await supabase.from('student_course_history').delete().eq('id', last.id)
  if (error) throw new Error(error.message)
  const { error: sErr } = await supabase.from('students').update({ course: last.from_course, batch: last.from_batch ?? student.batch ?? '' }).eq('id', student.id)
  if (sErr) throw new Error(sErr.message)
  clearCourseHistoryCache()
  try {
    await supabase.from('audit_log').insert({
      action: 'course_change_undone', changed_by: by || 'Admin', target_id: String(student.id ?? ''),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, from: last.to_course, to: last.from_course, effective_from: last.effective_from }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
  return { course: last.from_course, batch: last.from_batch ?? student.batch ?? '' }
}

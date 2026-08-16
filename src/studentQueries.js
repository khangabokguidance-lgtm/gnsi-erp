// studentQueries.js — SINGLE SOURCE OF TRUTH for reading the `students` table
// ─────────────────────────────────────────────────────────────────────────────
// Every module in the portal (Students, Hostel, Attendance, Fees, Exams,
// Reception, ...) used to run its own `supabase.from('students').select(...)`
// with its own idea of what counts as "active" and its own (often missing)
// pagination. That produced real, confirmed mismatches:
//   - Students.jsx only checked deleted_at; Hostel.jsx only checked status —
//     a student where those two disagreed vanished from one module and not
//     the other.
//   - Attendance.jsx's roster query required status === 'Active' (exact
//     match), while its batch-health check allowed anything except
//     'Dropout' (so e.g. a 'Passed Out' status was treated differently by
//     the two features in the SAME file).
//   - Fees.jsx, Exams.jsx, and Reception.jsx loaded the FULL students table
//     with no filter at all — dropouts and soft-deleted students included —
//     and (Exams/Reception) with no pagination, so counts there could
//     silently both overcount (dead records) and undercount (>1000 rows)
//     at once relative to Students.jsx.
//
// Fix: every module imports getActiveStudents() / getAllStudents() /
// getStudentById() from here instead of querying `students` directly for
// roster-level reads. There is now exactly one definition of "active
// student" and exactly one pagination strategy, used everywhere.
//
// Writes (insert/update/delete) still happen in each module, since those
// are feature-specific — this file only owns READS of student rosters.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

const PAGE = 1000

// Pagination-safe fetch — Supabase/PostgREST caps a single .select() at
// 1000 rows. Any module that queries `students` directly for a full or
// filtered roster WILL silently lose the newest rows once the school
// crosses that many student records — this happened for real in
// Admissions/Fees against adm_fee_collections before those were fixed.
async function fetchAllRows(select, extra) {
  let from = 0, all = []
  while (true) {
    let q = supabase.from('students').select(select)
    if (extra) q = extra(q)
    q = q.order('name').range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) { console.error('studentQueries fetchAllRows error:', error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// THE single definition of "currently enrolled / active" student, used by
// every module that means "real, current students" — rosters, headcounts,
// attendance marking, hostel occupancy, fee dashboards, exam rolls, the
// Reception student picker, etc. A student is active when:
//   - not soft-deleted (deleted_at IS NULL)
//   - status is not Dropout and not Inactive
// This intentionally allows any other status value (e.g. "Active",
// "Passed Out" is excluded separately where a module needs that — see
// note below) so the same rule can't drift into per-module variants again.
export function activeStudentFilter(q) {
  return q.is('deleted_at', null).neq('status', 'Inactive').neq('status', 'Dropout')
}

// Fast headcount using the same active-student definition, without pulling
// full rows — for dashboard "enrolled" counters (Attendance Overview,
// Hostel summary cards, etc.) that only need a number.
export async function getActiveStudentCount() {
  const { count, error } = await supabase.from('students').select('id', { count: 'exact', head: true })
    .is('deleted_at', null).neq('status', 'Inactive').neq('status', 'Dropout')
  if (error) { console.error('getActiveStudentCount error:', error.message); return null }
  return count
}

// Active roster — this is what almost every module should use.
// Pass a column list to keep payload small (e.g. 'id,name,house,status');
// defaults to '*'.
export async function getActiveStudents(select = '*') {
  return fetchAllRows(select, activeStudentFilter)
}

// Full roster including dropout/inactive/soft-deleted — for admin/audit
// screens that explicitly need to see everyone (Hostel's dropout-tracking
// view, Attendance's trash/dropout toggle, the Students.jsx archive tab).
// Anything using this should be a deliberate "show me everything" screen,
// not a headcount or default list.
export async function getAllStudents(select = '*') {
  return fetchAllRows(select, null)
}

// Single student by internal id.
export async function getStudentById(id, select = '*') {
  if (!id) return null
  const { data, error } = await supabase.from('students').select(select).eq('id', id).maybeSingle()
  if (error) { console.error('getStudentById error:', error.message); return null }
  return data
}

// Single student by GCC number — several modules (Admissions, Fees) look
// students up by gcc_no instead of id.
export async function getStudentByGcc(gccNo, select = '*') {
  if (!gccNo) return null
  const { data, error } = await supabase.from('students').select(select).eq('gcc_no', String(gccNo)).maybeSingle()
  if (error) { console.error('getStudentByGcc error:', error.message); return null }
  return data
}
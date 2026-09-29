// hostelFeeCheck.js — wrong-hostel-type fee checks.
//
// Flat and course fees depend on hostel type (Boarder > Day Boarder > Day
// Scholar), so charging a student at another type's rate quietly changes
// what they pay. Two ways that happens:
//   1. A fee line is charged at a different hostel type than the student's
//      record (e.g. a Boarder's course fee at the Day Scholar rate).
//   2. The student's record itself disagrees with the hostel: recorded as a
//      Day Scholar / Day Boarder but holding an active hostel bed, or
//      recorded as a Boarder with no bed.
// Either needs an admin: a cheaper rate goes through the low-fee approval
// (reason HOSTEL_MISMATCH_REASON), anything else is admin-only.
import { supabase } from './supabase'
import { clearHistory, loadHostelHistory, typeOnMonth } from './hostelHistory'

export const HOSTEL_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']
export const HOSTEL_MISMATCH_REASON = 'Hostel type mismatch'

// Students with an active hostel bed, as a Set of student ids (strings).
// null when the allocations can't be read — callers then skip the bed check.
export async function loadActiveBeds(studentIds = null) {
  let q = supabase.from('hostel_allocations').select('student_id').eq('status', 'Active')
  if (studentIds?.length) q = q.in('student_id', studentIds)
  const { data, error } = await q
  if (error) return null
  return new Set((data || []).map(r => String(r.student_id)))
}

// Record vs hostel bed. hasBed: true / false / null (unknown).
export function bedConflict(recordedType, hasBed) {
  const t = recordedType || 'Day Scholar'
  if (hasBed === true && t !== 'Boarder') {
    return { kind: 'bed_not_boarder', should: 'Boarder', message: `recorded as ${t} but has an active hostel bed — fees are being charged at the ${t} rate instead of Boarder` }
  }
  if (hasBed === false && t === 'Boarder') {
    return { kind: 'boarder_no_bed', should: null, message: 'recorded as Boarder but has no active hostel bed — fees may be charged at the Boarder rate by mistake' }
  }
  return null
}

// Every active student whose hostel type disagrees with the hostel beds.
export async function scanBedConflicts(students) {
  const active = (students || []).filter(s => (s.status || 'Active') === 'Active' && s.id != null)
  const beds = await loadActiveBeds()
  if (!beds) return { rows: [], error: 'Could not read hostel allocations.' }
  const rows = active
    .map(s => ({ student: s, conflict: bedConflict(s.hostel_type, beds.has(String(s.id))) }))
    .filter(r => r.conflict)
  return { rows, error: null }
}

// Admin fix: set the student's hostel type to match the hostel. Audited.
export async function fixHostelType(student, newType, by) {
  const { error } = await supabase.from('students').update({ hostel_type: newType }).eq('id', student.id)
  if (error) throw new Error(error.message)
  // A correction means the type was wrong all along — it applies to every month.
  await clearHistory(student.gcc_no)
  try {
    await supabase.from('audit_log').insert({
      action: 'hostel_type_corrected', changed_by: by || 'Admin', target_id: String(student.id),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, from: student.hostel_type || null, to: newType, source: 'fee hostel check' }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}

// Audit trail for an admin collecting despite a hostel issue.
export async function logHostelOverride({ student, by, detail }) {
  try {
    await supabase.from('audit_log').insert({
      action: 'fee_hostel_issue_approved', changed_by: by || 'Admin', target_id: String(student?.id ?? ''),
      new_values: JSON.stringify({ gcc: student?.gcc_no, student_name: student?.name, recorded: student?.hostel_type || null, detail }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}

// ── Hostel Issues tab ────────────────────────────────────────────────────────
const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
const inSession = (month, year, session) => {
  const m = MONTH_NUM[month], st = Number(String(session || '').slice(0, 4))
  if (!m || !st) return false
  return Number(year) === (m >= 4 ? st : st + 1)
}
const gccKey = v => String(parseInt(v) || 0)

// Configured rate for a session/course/batch/hostel type (any batch as a fallback,
// the same way getFeeRates does). field: 'course_fee' | 'flat_fee'.
export function rateFrom(structures, { session, course, batch, type, field }) {
  const same = r => r.session_year === session && r.course === course && r.hostel_type === type
  const hit = structures.find(r => same(r) && (r.batch || '') === (batch || '')) || (!batch ? structures.find(same) : null)
  return hit ? Number(hit[field]) || 0 : 0
}

// This session's flat/course payments made at ANOTHER hostel type's rate:
// paid less than the student's own-type rate and exactly the rate of a cheaper
// type. Rows already carrying a concession decision are counted as reviewed.
export function scanWrongRatePayments({ students, structures, courseRows = [], flatRows = [], overrideGccs = new Set(), session, history = new Map() }) {
  const issues = []
  let reviewed = 0
  const byGcc = new Map((students || []).filter(s => (s.status || 'Active') === 'Active').map(s => [gccKey(s.gcc_no), s]))
  const check = (st, kind, row, paid, month, year) => {
    const rateSession = st.session || session
    const field = kind === 'flat' ? 'flat_fee' : 'course_fee'
    // The type in effect for that month (a mid-session change keeps earlier months at the old type).
    const ownType = typeOnMonth(st, history.get(gccKey(st.gcc_no)), month, year)
    const course = kind === 'course' ? (row.course || st.course) : st.course
    const args = { session: rateSession, course, batch: st.batch || '', field }
    const own = rateFrom(structures, { ...args, type: ownType })
    if (!(own > 0) || !(paid > 0) || paid >= own) return
    const match = HOSTEL_TYPES.filter(t => t !== ownType).map(t => ({ type: t, rate: rateFrom(structures, { ...args, type: t }) })).find(x => x.rate > 0 && x.rate === paid)
    if (!match) return
    if (row.concession_status) { reviewed++; return }
    issues.push({
      student: st, kind, month, year, paid, own, ownType, matchType: match.type, shortBy: own - paid,
      table: kind === 'flat' ? 'adm_flat_fees' : 'adm_course_fees', rowId: row.id, receipt: row.receipt_no, date: row.pay_date, by: row.collected_by,
    })
  }
  for (const r of courseRows) {
    if (r.reverted || !inSession(r.for_month, r.year, session)) continue
    const st = byGcc.get(gccKey(r.adm_app_id)); if (!st) continue
    check(st, 'course', r, Number(r.amount_paid) || 0, r.for_month, r.year)
  }
  for (const r of flatRows) {
    if (!r.paid || r.reverted || !inSession(r.month, r.year, session)) continue
    const st = byGcc.get(gccKey(r.adm_app_id)); if (!st) continue
    if (overrideGccs.has(gccKey(st.gcc_no))) continue   // a custom flat fee is set for this student
    check(st, 'flat', r, Number(r.amount) || 0, r.month, r.year)
  }
  return { issues: issues.sort((a, b) => b.shortBy - a.shortBy), reviewed }
}

export async function loadWrongRateScan({ students, courseRows, flatRows, session }) {
  const [{ data: structures, error }, { data: ov }, { map: history }] = await Promise.all([
    supabase.from('fee_structures').select('session_year, course, batch, hostel_type, flat_fee, course_fee'),
    supabase.from('student_fee_overrides').select('gcc_no, session_year'),
    loadHostelHistory(),
  ])
  if (error) throw new Error(error.message)
  const overrideGccs = new Set((ov || []).map(o => gccKey(o.gcc_no)))
  return scanWrongRatePayments({ students, structures: structures || [], courseRows, flatRows, overrideGccs, session, history })
}

// Pending wrong-hostel-type approvals + record/bed conflicts, for the tab badge.
export async function countHostelIssues(students) {
  const [{ count }, bed] = await Promise.all([
    supabase.from('fee_concessions').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('reason', HOSTEL_MISMATCH_REASON),
    scanBedConflicts(students).catch(() => ({ rows: [] })),
  ])
  return (count || 0) + (bed.rows?.length || 0)
}

export async function loadHostelAudit() {
  const { data, error } = await supabase.from('audit_log').select('*').in('action', ['fee_hostel_issue_approved', 'hostel_type_corrected', 'hostel_type_changed', 'hostel_type_change_undone']).order('created_at', { ascending: false }).limit(100)
  if (error) return []
  return (data || []).map(a => { let v = {}; try { v = typeof a.new_values === 'string' ? JSON.parse(a.new_values) : (a.new_values || {}) } catch { /* not JSON */ } return { ...a, v } })
}

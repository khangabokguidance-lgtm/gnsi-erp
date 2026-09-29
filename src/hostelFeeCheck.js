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

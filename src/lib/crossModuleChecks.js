// Cross-module detail checks: Students vs Hostel vs Fees (via Admissions).
// Pure — no React / Supabase — so it is unit-tested with `npm test`.
//
// How the three databases are linked:
//   students            ← the roster row every module reads
//   hostel_allocations  ← keyed by student_id; carries its OWN copy of
//                         gcc_no / student_name / class_name / hostel_name
//   admissions          ← keyed by gcc_no; fee collections (adm_*_fees) are
//                         keyed by the same gcc_no (adm_app_id), and fee rates
//                         are derived from course / batch / hostel_type
// A copy that drifts from the students row is what these checks report.
// editField() already pushes students edits to admissions, so the usual fix
// is to correct the students row (or re-allocate for hostel mismatches).

const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const has = v => String(v ?? '').trim() !== ''
const differs = (a, b) => has(a) && has(b) && norm(a) !== norm(b)
const isDayScholarHouse = h => norm(h) === 'dayscholar' || norm(h) === 'day scholar'
const HOSTEL_FEE = /hostel|boarding|mess/i

export function detectCrossModuleMismatches(student, profile) {
  const flags = []
  if (!student || !profile) return flags
  const hostel = profile.hostel || null
  const adm = profile.admission || null
  const add = (key, level, text) => flags.push({ key, level, text })
  const type = norm(student.hostel_type)

  // ── Students ↔ Hostel ────────────────────────────────────────────────────
  if (hostel) {
    if (differs(hostel.hostel_name, student.house) && !isDayScholarHouse(student.house)) {
      add('hostel_house_differs', 'red', `Hostel allocation says "${hostel.hostel_name}" but the student record says house "${student.house}".`)
    }
    if (has(hostel.gcc_no) && has(student.gcc_no) && String(hostel.gcc_no).trim() !== String(student.gcc_no).trim()) {
      add('hostel_gcc_differs', 'red', `Hostel allocation is filed under GCC ${hostel.gcc_no} but the student's GCC is ${student.gcc_no}.`)
    }
    if (differs(hostel.student_name, student.name)) {
      add('hostel_name_differs', 'amber', `Hostel allocation name "${hostel.student_name}" differs from student name "${student.name}".`)
    }
    const cls = [student.class_name, student.batch].filter(has)
    if (has(hostel.class_name) && cls.length && !cls.some(c => norm(c) === norm(hostel.class_name))) {
      add('hostel_class_differs', 'amber', `Hostel allocation class "${hostel.class_name}" differs from the student's class "${cls[0]}".`)
    }
    if (type === 'day scholar') {
      add('dayscholar_has_room', 'red', 'Hostel type is Day Scholar but the student holds a hostel room.')
    }
    if (has(hostel.status) && norm(hostel.status) !== 'active' && has(student.house) && !isDayScholarHouse(student.house)) {
      add('hostel_allocation_inactive', 'amber', `Student shows house "${student.house}" but the hostel allocation status is "${hostel.status}".`)
    }
  } else if (type === 'boarder' && !has(student.house)) {
    add('boarder_no_room', 'amber', 'Hostel type is Boarder but the student has no house and no hostel allocation.')
  }

  // ── Students ↔ Admissions (the record fees are keyed and rated on) ───────
  if (adm) {
    if (differs(adm.applicant_name, student.name)) add('adm_name_differs', 'amber', `Admission record name "${adm.applicant_name}" differs from student name "${student.name}".`)
    if (differs(adm.course, student.course)) add('adm_course_differs', 'amber', `Admission course "${adm.course}" differs from student course "${student.course}" — fee rates follow the course.`)
    if (differs(adm.batch, student.batch)) add('adm_batch_differs', 'amber', `Admission batch "${adm.batch}" differs from student batch "${student.batch}" — fee rates follow the batch.`)
    if (differs(adm.hostel_type, student.hostel_type)) add('adm_hostel_type_differs', 'red', `Admission hostel type "${adm.hostel_type}" differs from student hostel type "${student.hostel_type}" — hostel fees will be wrong.`)
    if (differs(adm.house, student.house)) add('adm_house_differs', 'amber', `Admission house "${adm.house}" differs from student house "${student.house}".`)
  }

  // ── Fees ↔ Hostel ────────────────────────────────────────────────────────
  if (type === 'day scholar' && !hostel) {
    const rows = [...(profile.fees?.admFlatFees || []), ...(profile.fees?.admCourseFees || []), ...(profile.fees?.admFeeCols || [])]
    const paid = rows.filter(r => HOSTEL_FEE.test(`${r.description || ''} ${r.fee_type || ''}`))
    if (paid.length) add('hostel_fee_no_hostel', 'amber', `${paid.length} hostel-type fee payment(s) recorded for a Day Scholar with no hostel allocation.`)
  }

  return flags
}

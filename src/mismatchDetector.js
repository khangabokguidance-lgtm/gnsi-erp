// mismatchDetector.js — pure detection logic, no React, no Supabase writes.
// ─────────────────────────────────────────────────────────────────────────────
// Takes a student row (from studentQueries.js) and a full cross-module
// profile (from Student360.jsx's loadFullProfile) and returns the list of
// mismatches found. Both Student360.jsx's on-screen flags AND the
// background auto-scanner (mismatchScanner.js) call THIS function — so
// there's exactly one definition of "what counts as a mismatch," the same
// principle studentQueries.js applies to "what counts as an active
// student."
//
// Each flag has a stable `key` — this is what student_mismatch_log dedupes
// on (student_id, flag_key), so re-detecting the same issue on a later
// scan updates the existing open row instead of spamming a new
// notification.
// ─────────────────────────────────────────────────────────────────────────────

export function detectMismatches(student, profile) {
  const flags = []

  if (student.status !== 'Dropout' && student.status !== 'Inactive' && profile.attendance.totalMarked === 0) {
    flags.push({
      key: 'active_no_attendance',
      level: 'amber',
      text: 'Marked active but has zero attendance records — new admission not yet rostered, or a data entry gap.',
    })
  }

  if ((student.status === 'Dropout' || student.status === 'Inactive') && profile.attendance.records.some(r => r.status === 'Present')) {
    flags.push({
      key: 'dropout_has_attendance',
      level: 'amber',
      text: 'Marked dropout/inactive but has present attendance records — check if status change date is correct.',
    })
  }

  if (!profile.admission) {
    flags.push({
      key: 'no_admission_record',
      level: 'red',
      text: 'No matching admissions record for this GCC number — this student may have been added directly to the roster.',
    })
  }

  if (profile.fees.total === 0 && student.status !== 'Dropout') {
    flags.push({
      key: 'no_fees_recorded',
      level: 'amber',
      text: 'No fee payments on record for an active/inactive student.',
    })
  }

  if (student.house && !profile.hostel) {
    flags.push({
      key: 'house_no_allocation',
      level: 'red',
      text: `Student record shows house "${student.house}" but no matching hostel allocation record exists.`,
    })
  }

  if (!student.house && profile.hostel) {
    flags.push({
      key: 'allocation_no_house',
      level: 'red',
      text: 'Has a hostel allocation record but no house assigned on the student profile.',
    })
  }

  return flags
}
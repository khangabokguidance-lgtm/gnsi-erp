// scanProfile.js — the small student profile the background mismatch scan uses.
// ─────────────────────────────────────────────────────────────────────────────
// detectMismatches (mismatchDetector.js) only looks at: the student's status
// and house, whether any class attendance exists (and whether any is
// "Present" for a dropout), whether an admissions record exists, the total of
// fees paid, and whether a hostel allocation exists. The full profile that
// Student 360 shows (studentProfileLoader.js) loads ~25 queries of complete
// histories per student; the scan runs over every student, so it loads just
// those facts instead — about 4 tiny requests per student.
//
// If detectMismatches starts reading another field, add it here. It takes the
// database client as an argument so it can be tested without a network.
// ─────────────────────────────────────────────────────────────────────────────

const sum = (rows, col) => (rows || []).reduce((s, r) => s + Number(r?.[col] || 0), 0)

export async function loadScanProfile(student, db) {
  const gcc = String(student.gcc_no || '')
  const id = student.id
  let failedQueries = 0
  const ok = res => { if (res?.error) failedQueries++; return res }
  const att = () => db.from('attendance_records').select('id').not('session_id', 'is', null)

  // Class attendance is keyed inconsistently (student_id, gcc_no or name), so
  // look under each key, stopping at the first that has any.
  let hasAttendance = false
  const keys = [['student_id', id], ...(gcc ? [['gcc_no', gcc]] : []), ['student_name', student.name]]
  for (const [col, val] of keys) {
    if (val === undefined || val === null || val === '') continue
    const res = ok(await att().eq(col, val).limit(1))
    if ((res.data || []).length) { hasAttendance = true; break }
  }

  // A dropout / inactive student is flagged only if some attendance is Present.
  let presentRecords = []
  if (student.status === 'Dropout' || student.status === 'Inactive') {
    for (const [col, val] of keys) {
      if (val === undefined || val === null || val === '') continue
      const res = ok(await att().eq(col, val).eq('status', 'Present').limit(1))
      if ((res.data || []).length) { presentRecords = [{ status: 'Present' }]; break }
    }
  }

  let admission = null
  let feeTotal = 0
  if (gcc) {
    const adm = ok(await db.from('admissions').select('id').eq('gcc_no', gcc).limit(1))
    admission = (adm.data || [])[0] || null

    // Same three payment tables and filters as the full profile; stop as soon
    // as a total is found, since only "is it zero" matters to the flags.
    const collections = ok(await db.from('adm_fee_collections').select('amount_paid').eq('adm_app_id', gcc).eq('reverted', false))
    feeTotal += sum(collections.data, 'amount_paid')
    if (feeTotal === 0) {
      const flat = ok(await db.from('adm_flat_fees').select('amount').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false))
      feeTotal += sum(flat.data, 'amount')
    }
    if (feeTotal === 0) {
      const course = ok(await db.from('adm_course_fees').select('amount_paid').eq('adm_app_id', gcc).eq('reverted', false))
      feeTotal += sum(course.data, 'amount_paid')
    }
  }

  const alloc = ok(await db.from('hostel_allocations').select('id').eq('student_id', id).limit(1))

  return {
    failedQueries,
    admission,
    fees: { total: feeTotal },
    attendance: { records: presentRecords, totalMarked: hasAttendance ? 1 : 0 },
    hostel: (alloc.data || [])[0] || null,
  }
}

// requiredFields.js — per-table "what counts as a complete record" checklist.
// ─────────────────────────────────────────────────────────────────────────────
// Drives the completion percentage shown at the top of the registration-
// style card in Table Browser: for a given row, (# of these columns that
// are non-empty) / (total listed) * 100.
//
// One entry per table key from tableRegistry.js. Seeded with a reasonable
// starting checklist (identity fields, status, and whatever searchCols
// already implied was important) — edit these arrays freely; they're just
// plain lists of column names, no logic to touch elsewhere.
//
// A table key with no entry here (or an empty array) shows no completion
// bar at all, rather than a misleading 100%/0%.
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRED_FIELDS = {
  admissions: [
    'name', 'gcc_no', 'phone', 'course', 'dob', 'gender',
    'father_name', 'mother_name', 'address', 'status',
  ],
  students: [
    'name', 'gcc_no', 'course', 'batch', 'dob', 'gender',
    'admission_date', 'hostel_type', 'father_name', 'mother_name',
    'phone', 'address', 'status',
  ],
  adm_fee_collections: [
    'adm_app_id', 'amount_paid', 'pay_mode', 'pay_date',
  ],
  adm_flat_fees: [
    'adm_app_id', 'month', 'year', 'amount', 'pay_mode', 'pay_date',
  ],
  adm_course_fees: [
    'adm_app_id', 'for_month', 'year', 'amount_paid', 'course', 'pay_mode', 'pay_date',
  ],
  attendance_records: [
    'gcc_no', 'student_name', 'status',
  ],
  exam_marks: [
    'student_id', 'subject', 'marks_obtained', 'exam_date',
  ],
  hostel_allocations: [
    'student_id', 'house',
  ],
  discipline_records: [
    'student_id', 'category', 'status', 'date', 'description',
  ],
  sickbay_records: [
    'student_id', 'condition', 'status', 'date',
  ],
  leave_records: [
    'student_id', 'leave_type', 'status', 'from_date',
  ],
  reception_gatepasses: [
    'student_name', 'reason', 'status',
  ],
  reception_enquiries: [
    'student_name', 'phone', 'subject', 'status',
  ],
  reception_parent_items: [
    'student_name', 'item_type', 'description', 'status',
  ],
  reception_complaints: [
    'student_name', 'category', 'status',
  ],
}

/** Returns the required-fields list for a table, or [] if none defined. */
export function getRequiredFields(tableKey) {
  return REQUIRED_FIELDS[tableKey] || []
}

/**
 * Computes completion for one row against its table's checklist.
 * A field counts as filled if it's not null/undefined/empty-string.
 * Returns null (not 0) when the table has no checklist defined, so
 * callers can distinguish "0% complete" from "no checklist to show".
 */
export function getCompletion(tableKey, row) {
  const fields = getRequiredFields(tableKey)
  if (!fields.length || !row) return null
  const filled = fields.filter(f => row[f] !== null && row[f] !== undefined && row[f] !== '').length
  return {
    filled,
    total: fields.length,
    percent: Math.round((filled / fields.length) * 100),
    missing: fields.filter(f => row[f] === null || row[f] === undefined || row[f] === ''),
  }
}
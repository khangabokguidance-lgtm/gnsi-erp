// studentFeeSetup.js — a student's custom fee setup (pure helpers).
//
// Everyone is on the default rates from Fee Setup. An admin can give ONE student
// their own flat / course / admission fee for a session; each fee the admin leaves
// empty (null) stays at the standard rate. Stored in student_fee_overrides
// (migration 20261110_student_fee_setup.sql adds the course/admission columns).

const numOrNull = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v)

// Raw table row -> { flat_fee_override, course_fee_override, admission_fee_override } (number | null each) + metadata.
export const shapeOverride = r => ({
  flat_fee_override:      numOrNull(r?.flat_fee_override),
  course_fee_override:    numOrNull(r?.course_fee_override),
  admission_fee_override: numOrNull(r?.admission_fee_override),
  reason: r?.reason, updated_by: r?.updated_by, updated_at: r?.updated_at,
})

export const hasAnyOverride = o => !!o && (o.flat_fee_override !== null || o.course_fee_override !== null || o.admission_fee_override !== null)

// Standard rates with the student's custom fees laid over them (a copy; `rates` is not changed).
export function applyFeeOverride(rates, o) {
  if (!hasAnyOverride(o)) return rates
  return {
    ...rates,
    ...(o.flat_fee_override !== null && { flatFee: o.flat_fee_override }),
    ...(o.course_fee_override !== null && { courseFee: o.course_fee_override }),
    ...(o.admission_fee_override !== null && { admissionFee: o.admission_fee_override }),
  }
}

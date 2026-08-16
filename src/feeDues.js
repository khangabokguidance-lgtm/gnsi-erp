// feeDues.js — computes what a student SHOULD owe vs what they've paid.
// ─────────────────────────────────────────────────────────────────────────────
// Built directly on feeEngine.js's real rate-resolution logic (getFeeRates,
// getFlatFees, checkFlatFeeExists, checkCourseFeeExists) rather than
// guessing at a formula — so overrides, admission-date exclusions, and the
// Feb/Mar-only flat-fee window are all respected exactly the way Fees.jsx
// and FeeSetup.jsx already apply them.
//
// Deliberately reads adm_fee_collections / adm_flat_fees / adm_course_fees
// — the tables collectFee() actually writes to — and NOT feeEngine.js's
// fee_invoices/fee_payments/getStudentFeeSummary. That parallel table pair
// exists in feeEngine.js but collectFee (the live payment path used by
// Fees.jsx) never writes to it, so building on it would show ₹0 owed for
// every student regardless of reality.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import {
  getFeeRates, getFlatFees, isCourseFeeMonth, isPreAdmissionMonth,
  MONTHS_LIST, getSessionYear, ADM_FEE_BASE,
} from './feeEngine'

// Course fee has no auto-generated month list the way flat fee does (staff
// pick the month manually per collectFee's design) — so "due" months for
// course fee are: every non-flat-fee month from the session's start
// (April) through the current calendar month, minus any month that ended
// before the student's admission date. This mirrors getFlatFees' own
// admission-date rule (isPreAdmissionMonth) so flat and course fee agree
// on what counts as "before admission."
function courseFeeDueMonths(admissionDate) {
  const now = new Date()
  const currentCalYear = now.getFullYear()
  const currentCalMonth = now.getMonth() + 1 // 1-12

  return MONTHS_LIST.filter(isCourseFeeMonth).map(month => {
    let year = currentCalYear
    const calMonth = new Date(`${month} 1, ${year}`).getMonth() + 1
    // Session runs April→March; Jan/Feb/Mar-named months belong to the
    // following calendar year relative to an April start. Same logic
    // getFlatFees uses for its own year resolution.
    if (calMonth > currentCalMonth) year = currentCalYear - 1
    return { month, year }
  }).filter(({ month, year }) => {
    // Only months that have actually started/passed count as "due" —
    // don't bill for a future month that hasn't arrived yet.
    const calMonth = new Date(`${month} 1, ${year}`).getMonth() + 1
    const monthStart = new Date(year, calMonth - 1, 1)
    if (monthStart > now) return false
    if (isPreAdmissionMonth(month, year, admissionDate)) return false
    return true
  })
}

// Computes the full dues picture for one student. `student` needs at
// least: gcc_no, course, batch, hostel_type, admission_date (falls back
// to fail-open/no-exclusion if admission_date is missing, same as
// feeEngine.js's own functions).
export async function getStudentDues(student, sessionYear = getSessionYear()) {
  const gcc = String(student.gcc_no || '')
  if (!gcc) return null

  const [rates, flatFeeMonths, admFeeRows, flatFeeRows, courseFeeRows] = await Promise.all([
    getFeeRates(sessionYear, student.course, student.batch, student.hostel_type, gcc),
    getFlatFees(student.hostel_type, student.course, student.batch, sessionYear, gcc, student.admission_date),
    supabase.from('adm_fee_collections').select('amount_paid').eq('adm_app_id', gcc).eq('reverted', false),
    supabase.from('adm_flat_fees').select('month,year,amount').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false),
    supabase.from('adm_course_fees').select('for_month,year,amount_paid').eq('adm_app_id', gcc).eq('reverted', false),
  ])

  // Admission fee — one-time, ADM_FEE_BASE (or fee_structures override via
  // rates.admissionFee). Paid if ANY adm_fee_collections row exists.
  const admissionPaid = (admFeeRows.data || []).length > 0
  const admissionExpected = rates.admissionFee ?? ADM_FEE_BASE
  const admissionDue = admissionPaid ? 0 : admissionExpected

  // Flat fee — check each Feb/Mar month getFlatFees says this student owes
  // against what's actually been paid for that exact month/year.
  const paidFlatKeys = new Set((flatFeeRows.data || []).map(r => `${r.month}|${r.year}`))
  const flatFeeItems = flatFeeMonths.map(f => ({
    month: f.month, year: f.year, expected: f.amount,
    paid: paidFlatKeys.has(`${f.month}|${f.year}`),
  }))
  const flatFeeDue = flatFeeItems.filter(i => !i.paid).reduce((s, i) => s + i.expected, 0)

  // Course fee — every non-flat month from session start through now,
  // minus pre-admission months, checked against what's actually paid.
  const dueMonths = courseFeeDueMonths(student.admission_date)
  const paidCourseKeys = new Set((courseFeeRows.data || []).map(r => `${r.for_month}|${r.year}`))
  const courseFeeItems = dueMonths.map(m => ({
    month: m.month, year: m.year, expected: rates.courseFee,
    paid: paidCourseKeys.has(`${m.month}|${m.year}`),
  }))
  const courseFeeDue = courseFeeItems.filter(i => !i.paid).reduce((s, i) => s + i.expected, 0)

  const totalPaid =
    (admFeeRows.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0) +
    (flatFeeRows.data || []).reduce((s, r) => s + Number(r.amount || 0), 0) +
    (courseFeeRows.data || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)

  const totalDue = admissionDue + flatFeeDue + courseFeeDue

  return {
    gcc, sessionYear,
    rates,
    admission: { expected: admissionExpected, paid: admissionPaid, due: admissionDue },
    flatFee: { items: flatFeeItems, due: flatFeeDue },
    courseFee: { items: courseFeeItems, due: courseFeeDue },
    totalPaid,
    totalDue,
    monthsOverdue: courseFeeItems.filter(i => !i.paid).length + flatFeeItems.filter(i => !i.paid).length,
  }
}

// Batch version — for a defaulters list across many students. Runs in
// small batches (same courtesy pattern as mismatchScanner.js) so this
// doesn't fire hundreds of parallel multi-query lookups at once.
export async function getDuesForStudents(students, sessionYear = getSessionYear(), { batchSize = 8, onProgress } = {}) {
  const results = []
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(async s => {
      try {
        const dues = await getStudentDues(s, sessionYear)
        return dues ? { student: s, dues } : null
      } catch (e) {
        console.error(`getDuesForStudents: failed for ${s.name} (${s.gcc_no}):`, e.message)
        return null
      }
    }))
    results.push(...batchResults.filter(Boolean))
    onProgress?.({ done: Math.min(i + batchSize, students.length), total: students.length })
  }
  return results
}
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
  MONTHS_LIST, getSessionYear, ADM_FEE_BASE, resolveFeeMonthYear,
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

  return MONTHS_LIST.filter(isCourseFeeMonth).map(month => {
    // Session runs April→March; Jan/Feb/Mar-named months belong to the
    // following calendar year relative to an April start. Shared with
    // getFlatFees' own year resolution via resolveFeeMonthYear so the two
    // can't drift apart.
    const year = resolveFeeMonthYear(month, now)
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

  // Each query wrapped individually rather than relying on Promise.all's
  // own rejection: a single dropped connection (confirmed in the wild —
  // "adm_course_fees query failed — TypeError: Failed to fetch") used to
  // reject the WHOLE Promise.all, throwing out of getStudentDues entirely
  // and losing admission/flat-fee data that had already succeeded. Each
  // query now fails to an empty result on its own and the dues object
  // reports which source(s) failed, so a network blip under-reports one
  // fee type instead of silently reporting zero dues for the student.
  //
  // Promise.resolve(p) before .catch(): a Supabase query builder
  // (supabase.from(...).select(...).eq(...)) is thenable but NOT
  // guaranteed to expose .catch() as a real method on every client
  // version — calling p.catch() directly on it threw "e.catch is not a
  // function" for every single student (confirmed in the wild), which
  // is worse than the bug this wrapping was meant to fix. Promise.resolve()
  // coerces it into a real native Promise first, which always has .catch().
  const wrap = (p, label) => Promise.resolve(p).catch(e => {
    console.error(`getStudentDues(${gcc}): ${label} query failed —`, e.message)
    return { data: null, error: e, _failed: true }
  })

  // ✦ getFeeRates/getFlatFees are wrapped the same way as the three raw
  // Supabase calls below. Previously they weren't — if either threw (e.g.
  // a dropped connection while resolving a fee_structures row or a student
  // override), the whole Promise.all rejected, and getDuesForStudents'
  // per-student try/catch would then drop this student from the batch
  // entirely (returns null, filtered out of the results) with NO signal
  // to the caller — worse than the three collection-table queries, which
  // degrade to a flagged zero-rows result instead of vanishing the student.
  // On failure here, rates/flatFeeMonths fall back to safe empty defaults
  // (0 rates, no flat-fee months) and the failure is recorded in
  // failedSources just like the other three sources, so a rate-fetch
  // blip under-reports dues for one student instead of hiding them.
  const wrapRates = (p, label) => Promise.resolve(p).catch(e => {
    console.error(`getStudentDues(${gcc}): ${label} query failed —`, e.message)
    return { _failed: true }
  })

  const [ratesResult, flatFeeMonthsResult, admFeeRows, flatFeeRows, courseFeeRows] = await Promise.all([
    wrapRates(getFeeRates(sessionYear, student.course, student.batch, student.hostel_type, gcc), 'fee_rates'),
    wrapRates(getFlatFees(student.hostel_type, student.course, student.batch, sessionYear, gcc, student.admission_date), 'flat_fee_months'),
    wrap(supabase.from('adm_fee_collections').select('amount_paid, description, fee_type').eq('adm_app_id', gcc).eq('reverted', false), 'adm_fee_collections'),
    wrap(supabase.from('adm_flat_fees').select('month,year,amount').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false), 'adm_flat_fees'),
    wrap(supabase.from('adm_course_fees').select('for_month,year,amount_paid').eq('adm_app_id', gcc).eq('reverted', false), 'adm_course_fees'),
  ])

  const rates = ratesResult._failed ? { flatFee: 0, courseFee: 0, admissionFee: 0 } : ratesResult
  const flatFeeMonths = flatFeeMonthsResult._failed ? [] : flatFeeMonthsResult

  const failedSources = [
    ratesResult._failed && 'fee_rates',
    flatFeeMonthsResult._failed && 'flat_fee_months',
    admFeeRows._failed && 'admission_fee',
    flatFeeRows._failed && 'flat_fee',
    courseFeeRows._failed && 'course_fee',
  ].filter(Boolean)

  // Admission fee — one-time, ADM_FEE_BASE (or fee_structures override via
  // rates.admissionFee).
  //
  // ✦ Fix: previously "paid" meant ANY adm_fee_collections row existed for
  // this student, with no amount check — a ₹1 token payment (or a partial
  // installment) against a ₹6000 admission fee marked the entire fee as
  // fully paid, silently hiding a real ₹5999 shortfall from every dues
  // view. Now sums actual amount_paid across admission-fee rows specifically
  // (not dress/prospectus/advance items, which also live in
  // adm_fee_collections) and compares against the expected amount.
  //
  // adm_fee_collections holds admission/item/advance rows together (see
  // collectFee in feeEngine.js), so this filters to just the admission-kind
  // rows — identified by fee_type === 'admission', with description ===
  // 'Admission Fee' as a fallback for any legacy row written before
  // fee_type existed on this table.
  const admissionRows = (admFeeRows.data || []).filter(r => r.description === 'Admission Fee' || r.fee_type === 'admission')
  const admissionPaidAmount = admissionRows.reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const admissionExpected = rates.admissionFee ?? ADM_FEE_BASE
  const admissionPaid = admissionPaidAmount >= admissionExpected && admissionExpected > 0
  const admissionDue = Math.max(0, admissionExpected - admissionPaidAmount)

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
    admission: { expected: admissionExpected, paid: admissionPaid, paidAmount: admissionPaidAmount, due: admissionDue },
    flatFee: { items: flatFeeItems, due: flatFeeDue },
    courseFee: { items: courseFeeItems, due: courseFeeDue },
    totalPaid,
    totalDue,
    monthsOverdue: courseFeeItems.filter(i => !i.paid).length + flatFeeItems.filter(i => !i.paid).length,
    // Non-empty when one or more of the five fee-source queries above
    // failed (e.g. a dropped connection) and fell back to a safe default
    // (zero rows / zero rates / no months) rather than throwing. Callers
    // should treat totalDue/totalPaid as a LOWER BOUND, not exact, when
    // this is non-empty — surfacing that beats silently showing a wrong
    // number as if it were reliable.
    failedSources,
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
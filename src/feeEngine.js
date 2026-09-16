// feeEngine.js
// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH for all fee logic across GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════════
// 1. LEGACY HARDCODED RATES  (kept as fallback only — DB is now source of truth)
// ═══════════════════════════════════════════════════════════════════════════

export const FLAT_RATES = {
  'Boarder':     5500,
  'Day Boarder': 4000,
  'Day Scholar': 2000,
}

export const COURSE_RATES = {
  Navodaya: { 'Boarder': 4500, 'Day Boarder': 3500, 'Day Scholar': 2500 },
  Sainik:   { 'Boarder': 5000, 'Day Boarder': 4000, 'Day Scholar': 3000 },
  Foundation: { 'Boarder': 4000, 'Day Boarder': 3000, 'Day Scholar': 2000 },
  'Combined Course': { 'Boarder': 5500, 'Day Boarder': 4500, 'Day Scholar': 3000 },
}

export const ADM_FEE_BASE   = 6000
export const PROSPECTUS_FEE = 200

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const TABLES = {
  students:           'students',
  admissions:         'admissions',
  fees:               'fee_invoices',
  feeInvoices:        'fee_invoices',
  feePayments:        'fee_payments',
  admFeeCollections:  'adm_fee_collections',
  admFlatFees:        'adm_flat_fees',
  admCourseFees:      'adm_course_fees',
  accounts:           'accounts',
  feeStructures:      'fee_structures',
  studentFeeOverrides:'student_fee_overrides',   // ← NEW
}

export const INVOICE_STATUS = {
  PENDING: 'Pending', PARTIAL: 'Partial', PAID: 'Paid',
  OVERDUE: 'Overdue', WAIVED: 'Waived',  CANCELLED: 'Cancelled',
}

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Cheque', 'Bank Transfer', 'DD', 'Other']
export const PAY_MODES        = PAYMENT_METHODS

export const MONTHS_LIST = [
  'April','May','June','July','August','September',
  'October','November','December','January','February','March',
]

export const INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  short:   'GNSI',
  address: 'Khangabok, Thoubal District, Manipur',
  phone:   '',
}

export const CURRENT_YEAR = (() => {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 4 ? y : y - 1
})()

export const COURSE_STRUCTURE = {
  Sainik:            ['Achiever', 'Leader', 'Champion'],
  Navodaya:          ['Umeed', 'Lakshya A', 'Lakshya B'],
  Foundation:        ['Prime', 'Elite'],
  'Combined Course': ['—'],
}

// ✦ Session-year format normalizer — canonicalizes to "YYYY-YYYY".
//   Some older student/admission records store session as "2026-27"
//   (2-digit end year) instead of "2026-2027" (4-digit), which caused
//   getFeeRates' exact-string match against fee_structures.session_year
//   to silently miss configured rows and fall back to legacy rates.
//   All session_year lookups/writes should pass through this first.
export const normalizeSessionYear = (sessionYear) => {
  if (!sessionYear || typeof sessionYear !== 'string') return sessionYear
  const m = sessionYear.match(/^(\d{4})-(\d{2}|\d{4})$/)
  if (!m) return sessionYear
  const startYear = parseInt(m[1], 10)
  const endPart = m[2]
  const endYear = endPart.length === 4 ? parseInt(endPart, 10) : startYear + 1
  return `${startYear}-${endYear}`
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

export const fmt = n =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

export const fmtMoney = fmt

export const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fmtMonth = m => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

// LOCAL-DATE FIX: toISOString() returns the UTC date, which lags a day behind
// IST between 12:00 AM and 5:30 AM. This caused payDate (used when SAVING a
// payment) to disagree with todayStr in Fees.jsx's dashboard (used when
// FILTERING "today's collection"), so a payment saved as "today" could be
// invisible on the dashboard until the next day. en-CA locale formats as
// YYYY-MM-DD in the browser's local timezone — same method used everywhere
// else in the app (Fees.jsx dashboard, Accounts.jsx) — so this must match.
export const today = () => new Date().toLocaleDateString('en-CA')

export const gccStr = v => String(parseInt(v) || 0)

export const rcptNo = (prefix = 'INV') => {
  const d = new Date()
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${prefix}-${stamp}`
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. FEE RATE HELPERS  — DB-fetched (fee_structures + student_fee_overrides)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In-memory caches — both cleared on save via clearFeeRateCache().
 *
 * ✦ Fix: clearFeeRateCache() only runs in the SAME browser tab/session that
 * made the edit (FeeSetup.jsx and FeeCollectionModal's override editor both
 * call it after their own writes). If a second admin has Fees.jsx or
 * FeeCollectionModal already open in another tab/device when the first
 * admin edits fee_structures or a student override, the second admin's
 * client keeps serving whatever it already cached — potentially for the
 * rest of their session — with no way to know it's stale. There's no
 * cross-client invalidation channel here (would need realtime/pub-sub), so
 * as a bounded mitigation each cache entry now carries a fetch timestamp
 * and is treated as expired after RATE_CACHE_TTL_MS, forcing a fresh fetch
 * periodically even without an explicit clear. This doesn't make stale
 * reads impossible, only bounds how long they can persist.
 */
const RATE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const _rateCache     = {}   // key = session__course__batch__hostel -> { ...rates, _cachedAt }
const _overrideCache = {}   // key = gcc__session -> { value, _cachedAt }

const _isFresh = (cachedAt) => typeof cachedAt === 'number' && (Date.now() - cachedAt) < RATE_CACHE_TTL_MS

/** Clear both caches (call after saving fee_structures or student_fee_overrides) */
export const clearFeeRateCache = () => {
  Object.keys(_rateCache).forEach(k => delete _rateCache[k])
  Object.keys(_overrideCache).forEach(k => delete _overrideCache[k])
}

// ─── 4a. Per-student flat fee override ───────────────────────────────────────

/**
 * Fetch the flat_fee_override for one student in a session.
 * Returns null if no override exists.
 */
export const getStudentFlatFeeOverride = async (gccNo, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`) => {
  sessionYear = normalizeSessionYear(sessionYear)
  const key = `${gccNo}__${sessionYear}`
  const cached = _overrideCache[key]
  if (cached !== undefined && _isFresh(cached._cachedAt)) return cached.value

  const { data } = await supabase
    .from(TABLES.studentFeeOverrides)
    .select('flat_fee_override, reason, updated_by, updated_at')
    .eq('gcc_no', gccNo)
    .eq('session_year', sessionYear)
    .maybeSingle()

  const result = data ?? null
  _overrideCache[key] = { value: result, _cachedAt: Date.now() }
  return result
}

/**
 * Save (upsert) a per-student flat fee override.
 * Pass null / undefined flatFeeOverride to REMOVE the override.
 */
export const saveStudentFlatFeeOverride = async (gccNo, sessionYear, flatFeeOverride, reason = '', updatedBy = '') => {
  sessionYear = normalizeSessionYear(sessionYear)
  // Remove override
  if (flatFeeOverride === null || flatFeeOverride === undefined) {
    await supabase
      .from(TABLES.studentFeeOverrides)
      .delete()
      .eq('gcc_no', gccNo)
      .eq('session_year', sessionYear)
  } else {
    const { error } = await supabase
      .from(TABLES.studentFeeOverrides)
      .upsert(
        { gcc_no: gccNo, session_year: sessionYear, flat_fee_override: flatFeeOverride, reason, updated_by: updatedBy },
        { onConflict: 'gcc_no,session_year', ignoreDuplicates: false }
      )
    if (error) throw error
  }
  // Bust override cache for this student
  delete _overrideCache[`${gccNo}__${sessionYear}`]
}

// ─── 4b. Structural rates ─────────────────────────────────────────────────────

/**
 * Fetch flat_fee, course_fee, admission_fee from fee_structures.
 * Falls back to legacy FLAT_RATES / COURSE_RATES if not configured in DB.
 *
 * ✦ NEW: if gccNo is supplied, checks student_fee_overrides first and
 *        substitutes flatFee with the override value when present.
 *
 * ✦ Bug fix #4: previously this fell back to hardcoded legacy rates with
 *   zero indication anything unusual happened — a newly-added course/batch/
 *   hostel combo not yet configured in Fee Setup would silently bill the
 *   old hardcoded amount. Now returns `usingFallbackRates: true` and logs a
 *   console.warn whenever fee_structures has no row for this combo, so
 *   callers (and anyone watching the console) can tell the amount shown
 *   isn't actually configured yet. Existing callers that only destructure
 *   { flatFee, courseFee, admissionFee } are unaffected — this is an
 *   additive field, not a shape change.
 */
export const getFeeRates = async (
  sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  course      = '',
  batch       = '',
  hostelType  = 'Day Scholar',
  gccNo       = null,   // ← NEW optional param
) => {
  sessionYear = normalizeSessionYear(sessionYear)
  const structKey = `${sessionYear}__${course}__${batch}__${hostelType}`

  // Fetch structural rates (cached, subject to RATE_CACHE_TTL_MS — see cache
  // declaration above for why this isn't a permanent cache)
  if (!_rateCache[structKey] || !_isFresh(_rateCache[structKey]._cachedAt)) {
    let { data } = await supabase
      .from(TABLES.feeStructures)
      .select('flat_fee, course_fee, admission_fee')
      .eq('session_year', sessionYear)
      .eq('course',       course)
      .eq('batch',        batch)
      .eq('hostel_type',  hostelType)
      .maybeSingle()

    // ✦ Batch-less fallback: if batch wasn't supplied (student record has no
    //   batch assigned yet), the exact match above can never succeed because
    //   Fee Setup always writes real batch names. Rather than drop straight
    //   to hardcoded legacy rates, try any configured row for this
    //   session/course/hostel regardless of batch — closer to the real
    //   configured rate than the static fallback constants. This does NOT
    //   fix the underlying missing-batch data; it's a stopgap so billing
    //   isn't silently stale while that gets cleaned up.
    let usedBatchlessFallback = false
    if (!data && !batch) {
      const { data: anyBatchRow } = await supabase
        .from(TABLES.feeStructures)
        .select('flat_fee, course_fee, admission_fee')
        .eq('session_year', sessionYear)
        .eq('course',       course)
        .eq('hostel_type',  hostelType)
        .limit(1)
        .maybeSingle()
      if (anyBatchRow) {
        data = anyBatchRow
        usedBatchlessFallback = true
      }
    }

    const usingFallbackRates = !data
    if (usingFallbackRates) {
      console.warn(
        `getFeeRates: no fee_structures row for session=${sessionYear} course=${course} ` +
        `batch=${batch} hostelType=${hostelType} — falling back to legacy hardcoded rates. ` +
        `Configure this combination in Fee Setup to avoid billing stale amounts.`
      )
    } else if (usedBatchlessFallback) {
      console.warn(
        `getFeeRates: student has no batch set (session=${sessionYear} course=${course} ` +
        `hostelType=${hostelType}) — used a configured rate from another batch in this ` +
        `course/hostel as a stopgap. Assign this student a batch to bill the correct amount.`
      )
    }

    _rateCache[structKey] = {
      flatFee:      data?.flat_fee      ?? FLAT_RATES[hostelType]             ?? 0,
      courseFee:    data?.course_fee    ?? COURSE_RATES[course]?.[hostelType] ?? 0,
      admissionFee: data?.admission_fee ?? ADM_FEE_BASE,
      usingFallbackRates,
      usedBatchlessFallback,
      _cachedAt: Date.now(),
    }
  }

  // Strip the internal cache-bookkeeping field before returning — callers
  // that spread/serialize this object (e.g. into React state, JSON, or a
  // fee_structures upsert) shouldn't see or persist it.
  const { _cachedAt, ...rates } = _rateCache[structKey]

  // ✦ Apply per-student flat fee override if gcc supplied
  if (gccNo) {
    const override = await getStudentFlatFeeOverride(gccNo, sessionYear)
    if (override !== null) {
      rates.flatFee         = Number(override.flat_fee_override)
      rates.flatFeeOverride = override   // attach metadata so callers can show badge
    }
  }

  return rates
}

/** Async — returns flat fee amount for this student (respects override) */
export const getFlatFeeAmt = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccNo = null) => {
  const r = await getFeeRates(sessionYear, course, batch, hostelType, gccNo)
  return r.flatFee
}

/**
 * Sync — quick flat fee estimate using the legacy hardcoded rate tables only
 * (no DB lookup, no per-student override). For inline/render-time aggregates
 * (dashboard totals, running sums in reduce/useMemo) where awaiting a DB
 * round-trip per row isn't practical. NOT for actual billing/invoicing —
 * those must use the async getFlatFeeAmt so overrides are respected.
 */
export const getFlatFeeAmtSync = (hostelType, course) => {
  if (course && COURSE_RATES[course]?.[hostelType] != null) return COURSE_RATES[course][hostelType]
  return FLAT_RATES[hostelType] ?? 0
}

/** Async — returns course fee amount for this student */
export const getCourseFeeAmt = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`) => {
  const r = await getFeeRates(sessionYear, course, batch, hostelType)
  return r.courseFee
}

// ─── Flat-fee month helpers ───────────────────────────────────────────────────

export const FLAT_FEE_MONTHS = ['February', 'March']
export const isFlatFeeMonth   = (month) => FLAT_FEE_MONTHS.includes(month)
export const isCourseFeeMonth = (month) => !FLAT_FEE_MONTHS.includes(month)

// ✦ Single source of truth for "which calendar year does this named fee
// month belong to, given the session runs April→March." Previously this
// exact rule (if the month's calendar position falls after today's, it
// belongs to last calendar year) was independently re-implemented in
// getFlatFees below AND in feeDues.js's courseFeeDueMonths — two copies of
// the same formula that could silently drift apart if this logic ever
// changed (e.g. a different session start date). Both now call this.
export const resolveFeeMonthYear = (monthName, referenceDate = new Date()) => {
  const currentCalYear  = referenceDate.getFullYear()
  const currentCalMonth = referenceDate.getMonth() + 1
  let year = currentCalYear
  const calMonth = new Date(`${monthName} 1, ${year}`).getMonth() + 1
  if (calMonth > currentCalMonth) year = currentCalYear - 1
  return year
}

/**
 * Async — returns ONLY flat fee months (Feb & Mar) for the session.
 * Respects per-student override when gccNo is supplied.
 *
 * ✦ NEW: admissionDate (YYYY-MM-DD or Date) — when supplied, any flat-fee
 *        month that ENDED before the student's admission date is excluded.
 *        This stops repeaters/late admissions from being billed for months
 *        that predate when they actually joined. When admissionDate is not
 *        supplied (student record still missing it), behavior is unchanged
 *        from before — every caller should be moving toward always passing
 *        it now that admission_date is a required field going forward.
 */
export const getFlatFees = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccNo = null, admissionDate = null) => {
  const amount = await getFlatFeeAmt(hostelType, course, batch, sessionYear, gccNo)
  const admDate = admissionDate ? new Date(admissionDate) : null

  return FLAT_FEE_MONTHS.map(month => {
    const year = resolveFeeMonthYear(month)
    return {
      id: `flat_${month.slice(0, 3).toLowerCase()}_${year}`,
      month, year, amount, hostelType,
    }
  }).filter(f => {
    if (!admDate || isNaN(admDate.getTime())) return true
    // Last calendar day of the fee month — student owes this month's fee
    // only if they'd already joined by the time that month ended.
    const feeMonthIdx = new Date(`${f.month} 1, ${f.year}`).getMonth()
    const feeMonthEnd = new Date(f.year, feeMonthIdx + 1, 0)
    return feeMonthEnd >= admDate
  })
}

/**
 * True if the given fee month (name + calendar year) ENDED before the
 * student's admission date — i.e. the student hadn't joined yet during
 * that month, so it shouldn't be billed.
 *
 * Shares the exact rule getFlatFees() already uses internally (line ~314
 * above) so flat fee and course fee agree on what counts as "before
 * admission." Course fee has no auto-generated month list the way flat
 * fee does (staff pick the month manually via a dropdown), so this is
 * exposed standalone for FeeCollectionModal to call per-selection rather
 * than baked into a list-filter like getFlatFees.
 *
 * Returns false (never blocks) if admissionDate is missing/invalid —
 * same fail-open behavior as getFlatFees when admission_date isn't set yet.
 */
export const isPreAdmissionMonth = (monthName, year, admissionDate) => {
  if (!admissionDate) return false
  const admDate = new Date(admissionDate)
  if (isNaN(admDate.getTime())) return false
  const monthIdx = MONTHS_LIST.indexOf(monthName)
  if (monthIdx === -1) return false
  const feeMonthIdx = new Date(`${monthName} 1, ${year}`).getMonth()
  const feeMonthEnd = new Date(year, feeMonthIdx + 1, 0)
  return feeMonthEnd < admDate
}

export const getSessionYear = () => `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

// ═══════════════════════════════════════════════════════════════════════════
// 5. SOURCE REF HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const sourceRef = {
  admission:  (gcc)                    => `adm_${gcc}`,
  admItem:    (gcc, itemName)          => `adm_item_${gcc}_${itemName.toLowerCase().replace(/\s+/g, '_')}`,
  flatFee:    (gcc, month, year)       => `flat_${gcc}_${month.slice(0, 3).toLowerCase()}_${year}`,
  courseFee:  (gcc, month, year)       => `course_${gcc}_${month.slice(0, 3).toLowerCase()}_${year}`,
  advance:    (gcc, ts)                => `adv_${gcc}_${ts}`,
  invoice:    (gcc, feeType, invMonth) => `${gcc}_${feeType.toLowerCase().replace(/\s+/g, '_')}_${invMonth}`,
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. DUPLICATE-CHECK GUARDS
// ═══════════════════════════════════════════════════════════════════════════

export const checkFlatFeeExists = async (gcc, month, year) => {
  const { data } = await supabase
    .from(TABLES.admFlatFees)
    .select('id')
    .eq('adm_app_id', gcc)
    .eq('month', month)
    .eq('year', year)
    .eq('paid', true)
    .eq('reverted', false)
    .maybeSingle()
  return !!data
}

export const checkCourseFeeExists = async (gcc, forMonth, year) => {
  const { data } = await supabase
    .from(TABLES.admCourseFees)
    .select('id')
    .eq('adm_app_id', gcc)
    .eq('for_month', forMonth)
    .eq('year', year)
    .eq('reverted', false)
    .maybeSingle()
  return !!data
}

/**
 * Fix #2 — Admission Fee and item (dress/prospectus) lines had no
 * server-side duplicate guard; only the modal's client-side "already paid"
 * filter stopped a double-charge, which fails under concurrent staff use or
 * a stale client cache. This mirrors checkFlatFeeExists/checkCourseFeeExists
 * for the admission-side items, keyed the same way collectFee derives rowId
 * so it catches the exact same row a second attempt would try to (re)write.
 */
export const checkAdmItemExists = async (gcc, label) => {
  const { data } = await supabase
    .from(TABLES.admFeeCollections)
    .select('id')
    .eq('adm_app_id', gcc)
    .eq('description', label)
    .eq('reverted', false)
    .maybeSingle()
  return !!data
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. ACCOUNTS UPSERT
// ═══════════════════════════════════════════════════════════════════════════

export const upsertAccount = async ({
  entry_date, payment_date, type, category, amount,
  payment_mode, note, source_ref: sRef, source_type,
  is_recurring = false, receipt_url = null,
}) => {
  const resolvedEntryDate = entry_date || today() // local date, matches `today` fixed above
  const { error } = await supabase
    .from(TABLES.accounts)
    .upsert(
      {
        entry_date: resolvedEntryDate,
        // ACTUAL PAYMENT DATE FIX: every fee-driven income row must carry the
        // real payment date too, not just entry_date — falls back to entry_date
        // only if a caller forgets to pass it (should never happen going forward).
        payment_date: payment_date || resolvedEntryDate,
        type, category, amount, payment_mode, note,
        source_ref: sRef, source_type,
        is_recurring, receipt_url,
      },
      { onConflict: 'source_ref,source_type', ignoreDuplicates: false }
    )
  if (error) {
    console.error('upsertAccount error:', error.message)
    throw new Error('Account update failed: ' + error.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. FEE INVOICE MIRROR
// ═══════════════════════════════════════════════════════════════════════════

export const mirrorToFeeInvoice = async ({
  gcc, studentId, studentName, course, hostelType, className,
  feeType, amount, payDate, invoiceMonth,
}) => {
  const invRef    = sourceRef.invoice(gcc, feeType, invoiceMonth)
  const sessionYr = getSessionYear()

  try {
    const { data: existing } = await supabase
      .from(TABLES.feeInvoices)
      .select('id, amount_paid, total_amount')
      .eq('source_ref', invRef)
      .maybeSingle()

    if (existing) {
      const newPaid = parseFloat(existing.amount_paid || 0) + amount
      await supabase
        .from(TABLES.feeInvoices)
        .update({ amount_paid: newPaid, amount_due: 0, status: INVOICE_STATUS.PAID, last_payment_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from(TABLES.feeInvoices).insert({
        source_ref: invRef, student_id: studentId, student_name: studentName,
        gcc_no: gcc, course: course || '', hostel_type: hostelType,
        class_name: className || '', session_year: sessionYr,
        invoice_month: invoiceMonth, fee_type: feeType,
        base_amount: amount, discount_amount: 0, penalty_amount: 0,
        total_amount: amount, amount_paid: amount, amount_due: 0,
        due_date: payDate, status: INVOICE_STATUS.PAID,
        generated_at: new Date().toISOString(), generated_by: 'collection',
        last_payment_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('mirrorToFeeInvoice error:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8b. REVERT FEE COLLECTION — admin-only undo of a single collected item
// ═══════════════════════════════════════════════════════════════════════════
//
// Design: SOFT revert, not delete. The source row stays (reverted=true,
// reverted_at/by/reason recorded) so there's a permanent audit trail of who
// collected it and who undid it and why. It's filtered out of every "paid"
// view and out of every total. The matching `accounts` income entry (the
// double-entry bookkeeping row) IS hard-deleted, since a reverted fee should
// not appear as income in the books.
//
// Requires these columns on adm_fee_collections / adm_flat_fees / adm_course_fees:
//   reverted boolean DEFAULT false NOT NULL, reverted_at timestamptz,
//   reverted_by text, revert_reason text
// (see migration SQL provided alongside this change)
//
// NOTE: this does NOT roll back the `fee_invoices` mirror table. That table
// aggregates by calendar month at save-time and doesn't store enough back-
// reference to safely un-aggregate a single item without risking touching
// the wrong month. It's a reporting mirror, not the source of truth — the
// real ledger (`accounts`) and the source collection tables are both
// corrected here.
export const revertFeeCollection = async ({
  table, id, accountSourceRef = null, accountSourceType = null,
  revertedBy = 'Admin', staffId = null, reason = '',
}) => {
  if (!table || !id) throw new Error('revertFeeCollection: table and id are required')

  // ✦ staff_id + explicit timestamp on this action, same as collectFee.
  // revertedBy is a display name (kept for backward compatibility with the
  // reverted_by column and existing UI); resolvedStaffId is the stable
  // identifier to attribute the action to, falling back to revertedBy when
  // no separate id is supplied.
  const resolvedStaffId = staffId || revertedBy || 'Unknown'
  const revertedAt = new Date().toISOString()

  // Fetch the row BEFORE updating it, so the audit log can carry the real
  // amount/mode/gcc/student_name of what's being reverted — without this,
  // fee_revert audit entries only ever had source_ref/source_type/reason,
  // leaving Amount and Mode permanently blank in the Activity Log no matter
  // how the display layer parses source_ref (GCC and a description can be
  // recovered from source_ref, but amount and pay_mode never appear in it).
  // Column names differ per table (adm_fee_collections uses amount_paid,
  // adm_flat_fees uses amount; adm_app_id is the GCC column on all three).
  let originalRow = null
  try {
    const { data } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
    originalRow = data || null
  } catch (e) { console.warn('revertFeeCollection: could not fetch original row for audit log', e) }

  const updates = {
    reverted: true,
    reverted_at: revertedAt,
    reverted_by: revertedBy,
    revert_reason: reason || null,
  }
  // Flat fees are also gated on `paid` everywhere else in the app —
  // flip it so every existing filter keeps working with zero other changes.
  if (table === TABLES.admFlatFees) updates.paid = false

  const { error } = await supabase.from(table).update(updates).eq('id', id)
  if (error) throw error

  // ✦ Fix: previously this audit_log write only ran INSIDE the
  // `if (accountSourceRef && accountSourceType)` block below — a revert
  // call made without those two params (they're optional) logged NOTHING
  // to audit_log at all, so the revert itself (not just its accounts-side
  // cleanup) could go completely unrecorded in the Activity Log. Logging
  // the revert action now always happens, independent of whether there's
  // a matching accounts row to also soft-delete.
  try {
    await supabase.from('audit_log').insert({
      action: 'fee_revert', changed_by: resolvedStaffId, target_id: id,
      old_values: JSON.stringify({
        table, source_ref: accountSourceRef, source_type: accountSourceType, revert_reason: reason,
        gcc: originalRow?.adm_app_id ?? null,
        student_name: originalRow?.student_name ?? null,
        amount: originalRow?.amount ?? originalRow?.amount_paid ?? null,
        pay_mode: originalRow?.pay_mode ?? null,
        receipt_no: originalRow?.receipt_no ?? null,
        staff_id: resolvedStaffId, reverted_at: revertedAt,
      }),
      created_at: revertedAt,
    })
  } catch (e) { console.warn('Audit log failed during revert', e) }

  if (accountSourceRef && accountSourceType) {
    // Soft-delete the accounts ledger row so it is recoverable and auditable
    const { data: acctRows } = await supabase.from(TABLES.accounts)
      .select('id')
      .eq('source_ref', accountSourceRef)
      .eq('source_type', accountSourceType)
    for (const row of (acctRows || [])) {
      await supabase.from(TABLES.accounts).update({
        is_soft_deleted: true,
        deleted_by: revertedBy,
        deleted_at: revertedAt,
      }).eq('id', row.id)
    }
  }
}

// ─── Correct a mistakenly-entered payment date (admin) ───────────────────────
// Fixes the date on the source row AND on the matching `accounts` entry, so
// the books and the collection record never disagree. Does not touch

// =============================================================================
// 8c. collectFee — SINGLE SOURCE OF TRUTH FOR ALL FEE WRITES
// =============================================================================
// Every fee write in the portal goes through this one function.
// Fees.jsx (FeePaymentTab) and FeeCollectionModal.jsx both call this.
// Fixes: INSERT vs UPSERT, missing revert fields, wrong source_type,
//        missing subtype column, no audit trail from FeeCollectionModal.
//
// items[] shapes:
//   { kind: 'admission', amount }
//   { kind: 'item',      label, amount }          <- dress/prospectus
//   { kind: 'flat',      month, year, amount, isAdvance?, advanceAuthorizedBy?, standardAmount?, underpaymentAmount?, underpaymentReason?, note? }
//   { kind: 'course',    course, subtype, month, year, amount, isAdvance?, advanceAuthorizedBy? }
//   { kind: 'advance',   label, amount }
//
// isAdvance / advanceAuthorizedBy (flat + course only): set when the caller
// is collecting for a month that hasn't started yet — a genuine authorized
// advance, not the "staff picked the wrong month by accident" bug this was
// built to distinguish from (see the future_month_tag anomaly check in
// Fees.jsx). advanceAuthorizedBy should be the admin's name/id who entered
// their PIN to approve it; the caller (FeeCollectionModal) is responsible
// for actually verifying the PIN before setting these fields — collectFee
// just persists whatever it's given, so the same claim shows up consistently
// on the row, the receipt, and every report/anomaly check downstream.
//
// Requires these ADDITIONAL columns (nullable) on adm_flat_fees and
// adm_course_fees, alongside the existing revert columns:
//   is_advance boolean DEFAULT false NOT NULL,
//   advance_authorized_by text
//
// Returns { sections, total, skipped } ready for printReceipt(). `skipped`
// lists any items that were not charged because they were already paid
// (server-side check, not just the client's cache) — callers can surface
// this to staff instead of silently under-charging or double-charging.
//
// ── Bug fix #1 (data-integrity): the collection-table write (adm_fee_
//    collections / adm_flat_fees / adm_course_fees) and the accounts-ledger
//    write (upsertAccount) are two separate Supabase calls — Supabase's JS
//    client has no cross-table transaction. Previously, if the accounts
//    write failed after the collection write succeeded, the fee was
//    recorded as paid in the collection table but silently missing from
//    the books — exactly the ₹86,300 gap found in an earlier session.
//    Fix: every write below is now wrapped so that if upsertAccount throws,
//    the just-written collection row is deleted again (rolled back) before
//    the error propagates — so a failure always leaves BOTH tables in their
//    pre-call state, never one-written-one-missing. Nothing is left
//    half-saved either way.
//
// ── Bug fix #2 (duplicate charge): admission/item kinds previously had no
//    server-side "already paid" check — only the modal's client-side cache
//    stopped a double-charge. Now uses checkAdmItemExists the same way
//    flat/course already used checkFlatFeeExists/checkCourseFeeExists.
// =============================================================================
export const collectFee = async ({
  gcc, studentName, admNo = '--', className = '', course = '',
  hostelType = 'Day Scholar', payDate, payMode = 'Cash',
  txnRef = null, collectedBy = 'Admin', staffId = null,
  studentId = null, receiptNo, items = [],
}) => {
  if (!gcc)       throw new Error('collectFee: gcc is required')
  if (!payDate)   throw new Error('collectFee: payDate is required')
  if (!receiptNo) throw new Error('collectFee: receiptNo is required')
  if (!items.length) throw new Error('collectFee: at least one item is required')

  // ✦ staff_id + collected_at on every write: previously the only staff
  // attribution on a collection row was `collected_by`, a free-text name
  // string with no stable identifier and no explicit write timestamp
  // separate from the fee-period pay_date (which staff can backdate). Every
  // collection-table row below now also carries staff_id (falls back to
  // collectedBy when no separate id is supplied — callers should pass the
  // logged-in user's stable id/username here once available) and
  // collected_at (the real wall-clock moment the write happened, always
  // "now", independent of payDate). Every audit_log entry this function
  // and revertFeeCollection/correctFeeCollectionDate write carries the same
  // two fields for the same reason — attribution and correctness should
  // not depend on parsing a display name out of a note field.
  const resolvedStaffId = staffId || collectedBy || 'Unknown'
  const collectedAt = new Date().toISOString()
  const staffFields = { staff_id: resolvedStaffId, collected_at: collectedAt }

  const noRevert = { reverted: false, reverted_at: null, reverted_by: null, revert_reason: null }
  const admItems = [], flatItems = [], crsfItems = [], sections = [], skipped = []

  // ✦ Admin-visible audit trail for every successful collection — not just
  // reverts/corrections/deletes/underpayments. Previously collectFee wrote
  // NO audit_log entry at all for a normal payment; the Activity Log tab's
  // UI already had a 'fee_collection' action type wired up (meta/label/
  // column extraction all exist for it), but nothing ever produced that
  // action, so it silently never appeared. Logged per-item (not once per
  // collectFee call) so each row/receipt line has its own auditable entry
  // with its own target_id matching the actual collection-table row.
  // Best-effort: a logging failure must never block the payment itself.
  const logCollectionAudit = async (targetId, values) => {
    try {
      await supabase.from('audit_log').insert({
        action: 'fee_collection', changed_by: resolvedStaffId, target_id: targetId,
        new_values: JSON.stringify({ ...values, staff_id: resolvedStaffId, collected_at: collectedAt }),
        created_at: collectedAt,
      })
    } catch (e) { console.warn('Audit log failed for fee_collection', e) }
  }

  // Runs an upsertAccount call; if it throws, deletes the collection-table
  // row just written (by table+id) so nothing is left half-saved, then
  // re-throws so the caller sees the original failure.
  const upsertAccountOrRollback = async (accountPayload, rollbackTable, rollbackId) => {
    try {
      await upsertAccount(accountPayload)
    } catch (err) {
      try {
        await supabase.from(rollbackTable).delete().eq('id', rollbackId)
      } catch (rollbackErr) {
        console.error(`collectFee: rollback of ${rollbackTable} id=${rollbackId} also failed after accounts write failed`, rollbackErr)
        throw new Error(
          `Payment save failed AND rollback failed — ${rollbackTable} row "${rollbackId}" may be ` +
          `recorded as paid without a matching accounts entry. Please check manually. Original error: ${err.message}`
        )
      }
      throw err
    }
  }

  for (const item of items) {

    // 1. ADMISSION FEE
    if (item.kind === 'admission') {
      const already = await checkAdmItemExists(gcc, 'Admission Fee')
      if (already) { skipped.push('Admission Fee'); continue }
      const rowId = `${receiptNo}-adm`
      const { error } = await supabase.from(TABLES.admFeeCollections).upsert({
        id: rowId, adm_app_id: gcc, fee_type: 'admission',
        amount_paid: item.amount, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, description: 'Admission Fee',
        receipt_no: receiptNo, student_name: studentName,
        adm_no: admNo, class_name: className || null, collected_by: collectedBy,
        ...staffFields, ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error('Admission fee save failed: ' + error.message)
      await upsertAccountOrRollback({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Admission',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · Admission Fee · ${receiptNo}`,
        source_ref: sourceRef.admission(gcc), source_type: 'adm_fee',
      }, TABLES.admFeeCollections, rowId)
      await logCollectionAudit(rowId, { gcc, student_name: studentName, receipt_no: receiptNo, pay_mode: payMode, table: TABLES.admFeeCollections, items: [{ label: 'Admission Fee', amount: item.amount }], total: item.amount })
      admItems.push({ label: 'Admission Fee', amount: item.amount })
    }

    // 2. DRESS / ITEM
    else if (item.kind === 'item') {
      const lbl = item.label || 'Item'
      const already = await checkAdmItemExists(gcc, lbl)
      if (already) { skipped.push(lbl); continue }
      const itemKey = lbl.replace(/^Dress Kit — /, '').toLowerCase().replace(/\s+/g, '_')
      const rowId   = `${receiptNo}-item-${itemKey}`
      const sRef    = lbl.toLowerCase().includes('prospectus')
        ? sourceRef.admItem(gcc, 'prospectus')
        : sourceRef.admItem(gcc, lbl.replace(/^Dress Kit — /, ''))
      const { error } = await supabase.from(TABLES.admFeeCollections).upsert({
        id: rowId, adm_app_id: gcc, fee_type: 'item',
        amount_paid: item.amount, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, description: lbl,
        receipt_no: receiptNo, student_name: studentName,
        adm_no: admNo, class_name: className || null, collected_by: collectedBy,
        ...staffFields, ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Item (${lbl}) save failed: ` + error.message)
      await upsertAccountOrRollback({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Admission',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · ${lbl} · ${receiptNo}`,
        source_ref: sRef, source_type: 'adm_fee',
      }, TABLES.admFeeCollections, rowId)
      await logCollectionAudit(rowId, { gcc, student_name: studentName, receipt_no: receiptNo, pay_mode: payMode, table: TABLES.admFeeCollections, items: [{ label: lbl, amount: item.amount }], total: item.amount })
      admItems.push({ label: lbl, amount: item.amount })
    }

    // 3. FLAT FEE
    else if (item.kind === 'flat') {
      const alreadyPaid = await checkFlatFeeExists(gcc, item.month, item.year)
      if (alreadyPaid) { skipped.push(`${item.month} ${item.year} Flat Fee`); console.warn(`collectFee: flat ${item.month} ${item.year} already paid for GCC-${gcc}`); continue }
      const flatId = `${gcc}_flat_${item.month.slice(0, 3).toLowerCase()}_${item.year}`
      const sRef   = sourceRef.flatFee(gcc, item.month, item.year)
      // Fee-period month (e.g. "2026-02"), not the entry/pay date's month —
      // so mirrorToFeeInvoice files a backdated Feb payment under Feb, not
      // under whatever month it was actually keyed in.
      const invoiceMonth = `${item.year}-${String(new Date(`${item.month} 1, ${item.year}`).getMonth() + 1).padStart(2, '0')}`
      const { error } = await supabase.from(TABLES.admFlatFees).upsert({
        id: flatId, adm_app_id: gcc, month: item.month, year: item.year,
        amount: item.amount, hostel_type: hostelType, paid: true,
        pay_date: payDate, pay_mode: payMode, txn_ref: txnRef || null,
        receipt_no: receiptNo, student_name: studentName, adm_no: admNo,
        is_advance: !!item.isAdvance, advance_authorized_by: item.isAdvance ? (item.advanceAuthorizedBy || null) : null,
        // Underpayment note (set by FeeCollectionModal when the collected
        // amount was edited below the configured flat-fee rate by more than
        // its discrepancy threshold, with a reason selected from the
        // required dropdown). Mirrors the course-fee override_note pattern
        // so a below-standard flat fee payment is explained on the row
        // itself, not just discoverable later by cross-referencing
        // fee_structures/student_fee_overrides.
        ...(item.note ? { underpayment_note: item.note } : {}),
        ...staffFields, ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Flat fee ${item.month} save failed: ` + error.message)
      await upsertAccountOrRollback({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Hostel',
        amount: item.amount, payment_mode: payMode,
        note: item.note
          ? `${studentName} · ${item.month} ${item.year} Flat Fee [${hostelType}] · ${receiptNo} · ${item.note}`
          : `${studentName} · ${item.month} ${item.year} Flat Fee [${hostelType}] · ${receiptNo}`,
        source_ref: sRef, source_type: 'flat_fee',
      }, TABLES.admFlatFees, flatId)
      await mirrorToFeeInvoice({
        gcc, studentId, studentName, course, hostelType, className,
        feeType: 'Monthly Flat Fee', amount: item.amount, payDate, invoiceMonth,
      })
      await logCollectionAudit(flatId, { gcc, student_name: studentName, receipt_no: receiptNo, pay_mode: payMode, table: TABLES.admFlatFees, month: item.month, year: item.year, hostel_type: hostelType, items: [{ label: `${item.month} ${item.year}`, amount: item.amount }], total: item.amount })
      // ✦ Admin-visible underpayment warning — logged to audit_log so it
      // shows up wherever the Activity Log tab reads from (same table
      // revertFeeCollection and deleteLegacyFeeRecord already write to),
      // in addition to the inline warning banner FeeCollectionModal shows
      // at collection time. Best-effort: a logging failure must never
      // block the payment itself from being recorded.
      if (item.underpaymentAmount > 0) {
        try {
          await supabase.from('audit_log').insert({
            action: 'flat_fee_underpayment', changed_by: resolvedStaffId, target_id: flatId,
            old_values: JSON.stringify({
              gcc, student_name: studentName, month: item.month, year: item.year,
              hostel_type: hostelType, standard_amount: item.standardAmount ?? null,
              collected_amount: item.amount, shortfall: item.underpaymentAmount,
              reason: item.underpaymentReason || null, receipt_no: receiptNo,
              staff_id: resolvedStaffId, collected_at: collectedAt,
            }),
            created_at: collectedAt,
          })
        } catch (e) { console.warn('Audit log failed for flat fee underpayment', e) }
      }
      flatItems.push({ label: `${item.month} ${item.year} [${hostelType}]${item.isAdvance ? ' · ADVANCE (authorized)' : ''}${item.underpaymentAmount > 0 ? ' · UNDERPAID' : ''}`, amount: item.amount })
    }

    // 4. COURSE FEE
    else if (item.kind === 'course') {
      const yr  = item.year || CURRENT_YEAR
      const crs = item.course || course
      const sub = item.subtype || ''
      const alreadyPaid = await checkCourseFeeExists(gcc, item.month, yr)
      if (alreadyPaid) { skipped.push(`${item.month} ${yr} Course Fee`); console.warn(`collectFee: course ${item.month} ${yr} already paid for GCC-${gcc}`); continue }
      const recId = `${gcc}_course_${item.month.slice(0, 3).toLowerCase()}_${yr}`
      const sRef  = sourceRef.courseFee(gcc, item.month, yr)
      // Fee-period month, same reasoning as the flat-fee branch above.
      const invoiceMonth = `${yr}-${String(new Date(`${item.month} 1, ${yr}`).getMonth() + 1).padStart(2, '0')}`
      const { error } = await supabase.from(TABLES.admCourseFees).upsert({
        id: recId, adm_app_id: gcc, course: crs, subtype: sub,
        hostel_type: hostelType, for_month: item.month, year: yr,
        amount_paid: item.amount, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, receipt_no: receiptNo,
        student_name: studentName, adm_no: admNo,
        is_advance: !!item.isAdvance, advance_authorized_by: item.isAdvance ? (item.advanceAuthorizedBy || null) : null,
        // Rate-override note (set by FeeCollectionModal when the collected
        // amount was edited away from the configured course fee by more
        // than its discrepancy threshold). Explains WHY a below/above-rate
        // amount was collected, instead of the shortfall only being
        // discoverable later by cross-referencing fee_structures.
        ...(item.note ? { override_note: item.note } : {}),
        ...staffFields, ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Course fee ${item.month} save failed: ` + error.message)
      await upsertAccountOrRollback({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Fees',
        amount: item.amount, payment_mode: payMode,
        note: item.note
          ? `${studentName} · ${crs}${sub ? ' ' + sub : ''} ${item.month} · ${receiptNo} · ${item.note}`
          : `${studentName} · ${crs}${sub ? ' ' + sub : ''} ${item.month} · ${receiptNo}`,
        source_ref: sRef, source_type: 'course_fee',
      }, TABLES.admCourseFees, recId)
      await mirrorToFeeInvoice({
        gcc, studentId, studentName, course: crs, hostelType, className,
        feeType: 'Course Fee', amount: item.amount, payDate, invoiceMonth,
      })
      await logCollectionAudit(recId, { gcc, student_name: studentName, receipt_no: receiptNo, pay_mode: payMode, table: TABLES.admCourseFees, month: item.month, year: yr, course: crs, subtype: sub, items: [{ label: `${crs}${sub ? ' ' + sub : ''} — ${item.month}`, amount: item.amount }], total: item.amount })
      // Same admin-visible warning pattern as flat fee, for a course-fee
      // amount edited below the standard rate past the discrepancy
      // threshold (courseAmtNeedsReason in FeeCollectionModal). Previously
      // this discrepancy only lived in the row's own override_note — no
      // separate flagged audit_log entry existed for it the way flat fee
      // now has, so it never surfaced in a dedicated warnings view either.
      if (item.underpaymentAmount > 0) {
        try {
          await supabase.from('audit_log').insert({
            action: 'course_fee_underpayment', changed_by: resolvedStaffId, target_id: recId,
            old_values: JSON.stringify({
              gcc, student_name: studentName, month: item.month, year: yr,
              course: crs, subtype: sub, standard_amount: item.standardAmount ?? null,
              collected_amount: item.amount, shortfall: item.underpaymentAmount,
              reason: item.underpaymentReason || null, receipt_no: receiptNo,
              staff_id: resolvedStaffId, collected_at: collectedAt,
            }),
            created_at: collectedAt,
          })
        } catch (e) { console.warn('Audit log failed for course fee underpayment', e) }
      }
      crsfItems.push({ label: `${crs}${sub ? ' · ' + sub : ''} — ${item.month}${item.isAdvance ? ' · ADVANCE (authorized)' : ''}${item.underpaymentAmount > 0 ? ' · UNDERPAID' : ''}`, amount: item.amount })
    }

    // 5. ADVANCE
    else if (item.kind === 'advance') {
      const advId = sourceRef.advance(gcc, Date.now())
      const { error } = await supabase.from(TABLES.admFeeCollections).upsert({
        id: advId, adm_app_id: gcc, fee_type: 'advance',
        amount_paid: item.amount, advance_for: item.label || '',
        pay_date: payDate, pay_mode: payMode, txn_ref: txnRef || null,
        description: 'Advance — ' + (item.label || ''),
        receipt_no: receiptNo, student_name: studentName,
        adm_no: admNo, class_name: className || null, collected_by: collectedBy,
        ...staffFields, ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error('Advance fee save failed: ' + error.message)
      await upsertAccountOrRollback({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Advance',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · Advance (${item.label || ''}) · ${receiptNo}`,
        source_ref: advId, source_type: 'advance_fee',
      }, TABLES.admFeeCollections, advId)
      await logCollectionAudit(advId, { gcc, student_name: studentName, receipt_no: receiptNo, pay_mode: payMode, table: TABLES.admFeeCollections, items: [{ label: item.label || 'Advance', amount: item.amount }], total: item.amount })
      sections.push({ title: 'Advance', color: '#b45309',
        items: [{ label: item.label || 'Advance', amount: item.amount }],
        subtotal: item.amount })
    }
  }

  // Build receipt sections
  if (admItems.length)  sections.unshift({ title: 'Admission Package',           color: '#4f46e5', items: admItems,  subtotal: admItems.reduce((s, i) => s + i.amount, 0) })
  if (flatItems.length) sections.push(   { title: `Monthly Flat Fees — ${hostelType}`, color: '#059669', items: flatItems, subtotal: flatItems.reduce((s, i) => s + i.amount, 0) })
  if (crsfItems.length) sections.push(   { title: 'Course Fees',                 color: '#7c3aed', items: crsfItems, subtotal: crsfItems.reduce((s, i) => s + i.amount, 0) })

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0)
  return { sections, total, skipped }
}

// deleteLegacyFeeRecord — admin hard-delete for the legacy `fees` table only.
// Live tables (adm_fee_collections / adm_flat_fees / adm_course_fees) are
// always soft-reverted via revertFeeCollection so there is always an audit trail.
export const deleteLegacyFeeRecord = async (id, role = 'admin', staffId = null) => {
  if (!id) throw new Error('deleteLegacyFeeRecord: id is required')
  const { data: original } = await supabase.from('fees').select('*').eq('id', id).maybeSingle()
  const { error } = await supabase.from('fees').delete().eq('id', id)
  if (error) throw new Error('Delete failed: ' + error.message)
  const resolvedStaffId = staffId || role || 'Unknown'
  const deletedAt = new Date().toISOString()
  try {
    await supabase.from('audit_log').insert({
      action: 'legacy_fee_delete', changed_by: resolvedStaffId, target_id: id,
      old_values: original ? JSON.stringify({ ...original, staff_id: resolvedStaffId, deleted_at: deletedAt }) : JSON.stringify({ staff_id: resolvedStaffId, deleted_at: deletedAt }),
      created_at: deletedAt,
    })
  } catch (e) { console.warn('Audit log failed', e) }
}

// amount/mode/anything else — date-only correction.
export const correctFeeCollectionDate = async ({
  table, id, newDate, accountSourceRef = null, accountSourceType = null,
  correctedBy = 'Admin', staffId = null,
}) => {
  if (!table || !id || !newDate) throw new Error('correctFeeCollectionDate: table, id and newDate are required')

  const resolvedStaffId = staffId || correctedBy || 'Unknown'
  const correctedAt = new Date().toISOString()

  // Fetch the old date BEFORE updating, so the audit entry shows the actual
  // before → after change rather than just the new value.
  let oldDate = null
  try {
    const { data } = await supabase.from(table).select('pay_date, adm_app_id, student_name, receipt_no').eq('id', id).maybeSingle()
    oldDate = data?.pay_date ?? null
    var oldRow = data || null
  } catch (e) { console.warn('correctFeeCollectionDate: could not fetch original row for audit log', e) }

  const { error } = await supabase.from(table).update({ pay_date: newDate }).eq('id', id)
  if (error) throw error

  if (accountSourceRef && accountSourceType) {
    await supabase.from(TABLES.accounts)
      .update({ entry_date: newDate, payment_date: newDate })
      .eq('source_ref', accountSourceRef)
      .eq('source_type', accountSourceType)
  }

  // ✦ Fix: this function previously wrote NO audit_log entry at all — the
  // Activity Log UI already had a 'fee_date_correction' action wired up
  // (activityActionMeta/activityLine both handle it), but nothing ever
  // produced it, so date corrections were invisible in the audit trail
  // despite silently changing a payment's recorded date.
  try {
    await supabase.from('audit_log').insert({
      action: 'fee_date_correction', changed_by: resolvedStaffId, target_id: id,
      old_values: JSON.stringify({ table, pay_date: oldDate, gcc: oldRow?.adm_app_id ?? null, student_name: oldRow?.student_name ?? null, receipt_no: oldRow?.receipt_no ?? null }),
      new_values: JSON.stringify({ table, pay_date: newDate, staff_id: resolvedStaffId, corrected_at: correctedAt }),
      created_at: correctedAt,
    })
  } catch (e) { console.warn('Audit log failed during date correction', e) }
}

export const getStudentFeeSummary = async (studentId, sessionYear) => {
  const [invRes, payRes] = await Promise.all([
    supabase.from(TABLES.feeInvoices).select('*').eq('student_id', studentId).eq('session_year', sessionYear).order('invoice_month', { ascending: true }),
    supabase.from(TABLES.feePayments).select('*').eq('student_id', studentId).order('paid_at', { ascending: false }),
  ])
  const invoices = invRes.data || []
  const payments = payRes.data || []
  return {
    invoices, payment_history: payments,
    total_expected: invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0),
    total_paid:     invoices.reduce((s, i) => s + (Number(i.amount_paid)  || 0), 0),
    total_due:      invoices.reduce((s, i) => s + (Number(i.amount_due)   || 0), 0),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. RECORD PAYMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✦ Bug fix #7: this was the one fee-write path in the file that never
 *   touched `accounts` at all — every payment recorded here (fee_invoices +
 *   fee_payments) was completely invisible to the books, with no equivalent
 *   of the rollback-guarded upsertAccount used everywhere else in collectFee.
 *   Now inserts a matching Income row the same way collectFee does. If that
 *   accounts write fails, the fee_payments insert and the fee_invoices
 *   balance update are rolled back so this path has the same all-or-nothing
 *   guarantee as collectFee, rather than a silent books gap.
 */
export const recordPayment = async ({ invoiceId, amount, method }) => {
  const amt = parseFloat(amount)
  if (!amt || amt <= 0) throw new Error('Invalid payment amount')
  const { data: inv, error: invErr } = await supabase.from(TABLES.feeInvoices).select('*').eq('id', invoiceId).single()
  if (invErr) throw invErr
  const newPaid = parseFloat(inv.amount_paid || 0) + amt
  const newDue  = Math.max(0, parseFloat(inv.total_amount || 0) - newPaid)
  const status  = newDue <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL

  const { data: payment, error: payErr } = await supabase.from(TABLES.feePayments)
    .insert({ invoice_id: invoiceId, student_id: inv.student_id, amount: amt, method: method || 'Cash', paid_at: new Date().toISOString() })
    .select().single()
  if (payErr) throw payErr

  const { error: updErr } = await supabase.from(TABLES.feeInvoices).update({ amount_paid: newPaid, amount_due: newDue, status, last_payment_at: new Date().toISOString() }).eq('id', invoiceId)
  if (updErr) {
    await supabase.from(TABLES.feePayments).delete().eq('id', payment.id)
    throw updErr
  }

  const payDate = new Date().toLocaleDateString('en-CA')
  try {
    await upsertAccount({
      entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Fees',
      amount: amt, payment_mode: method || 'Cash',
      note: `${inv.student_name || 'Student'} · ${inv.fee_type || 'Fee'} (${inv.invoice_month || ''}) · Payment ${payment.id}`,
      source_ref: `fee_payment_${payment.id}`, source_type: 'fee_payment',
    })
  } catch (err) {
    // Roll back both writes above so this stays all-or-nothing, same as collectFee.
    await supabase.from(TABLES.feePayments).delete().eq('id', payment.id)
    await supabase.from(TABLES.feeInvoices).update({
      amount_paid: inv.amount_paid, amount_due: inv.amount_due, status: inv.status, last_payment_at: inv.last_payment_at,
    }).eq('id', invoiceId)
    throw new Error('Payment save failed while updating accounts: ' + err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. HOUSE OCCUPANCY — SHARED SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════
// Both Admissions.jsx (assigning a house to an applicant) and Hostel.jsx's
// HouseTab (assigning/reassigning a house to an existing student) need the
// same answer to "how full is this house, right now?" — this is that one
// answer, computed live from real data instead of two separate hardcoded
// guesses living in two separate files.
//
// "Occupancy" counts BOTH:
//   - students already in the `students` table with this house (Hostel side)
//   - admissions in flight (status Admitted/Enrolled) with this house, that
//     haven't been promoted to a student row yet (Admissions side) — an
//     applicant who has been assigned a bed but hasn't formally enrolled
//     yet still occupies that bed in practice.
// Counting only one side would let the two modules independently overbook
// the same house without either one ever seeing the other's bookings.

const _houseCapacityCache = {}  // key = house name, cleared on demand

export const clearHouseCapacityCache = () => {
  Object.keys(_houseCapacityCache).forEach(k => delete _houseCapacityCache[k])
}

/**
 * Returns { capacity, occupied, available, isFull } for one house, OR for
 * every house if `houseName` is omitted (returns an array instead).
 *
 * @param houseName - exact house name as stored in houses.name, or omit for all houses
 * @param excludeGcc - GCC number to exclude from the admissions-side count
 *                     (use this when re-checking a house an applicant is
 *                     ALREADY assigned to, so they don't count against
 *                     their own seat)
 */
/**
 * ✦ Bug fix: house names are reused every session (e.g. "Kombirei" exists
 *   as a separate cohort in 2024-2025, 2025-2026, 2026-2027...). This
 *   previously summed EVERY student and admission ever assigned to that
 *   house name across ALL sessions combined — so occupancy could read
 *   wildly over capacity (e.g. 91/43) once a house name had been reused
 *   for a few years. Now scoped to a single session — pass the session
 *   whose occupancy you actually want to check.
 */
export const getHouseOccupancy = async (houseName = null, excludeGcc = null, sessionName = null) => {
  const { data: houses, error: housesErr } = await supabase
    .from('houses')
    .select('name, capacity')
    .order('name')
  if (housesErr) throw housesErr

  const targetHouses = houseName
    ? houses.filter(h => h.name.toLowerCase() === houseName.toLowerCase())
    : houses
  if (houseName && targetHouses.length === 0) {
    throw new Error(`getHouseOccupancy: no house named "${houseName}" found in houses table`)
  }

  let studentsQuery = supabase.from(TABLES.students).select('house, session').not('house', 'is', null)
  let admissionsQuery = supabase.from(TABLES.admissions).select('gcc_no, house, session').not('house', 'is', null).in('status', ['Admitted', 'Enrolled'])
  if (sessionName) {
    studentsQuery = studentsQuery.eq('session', sessionName)
    admissionsQuery = admissionsQuery.eq('session', sessionName)
  }

  const [{ data: students, error: studentsErr }, { data: admissions, error: admissionsErr }] = await Promise.all([
    studentsQuery, admissionsQuery,
  ])
  if (studentsErr) throw studentsErr
  if (admissionsErr) throw admissionsErr

  const norm = h => (h || '').toString().trim().toLowerCase()

  const result = targetHouses.map(h => {
    const studentCount = students.filter(s => norm(s.house) === norm(h.name)).length
    const admissionCount = admissions.filter(a =>
      norm(a.house) === norm(h.name) &&
      String(a.gcc_no) !== String(excludeGcc)
    ).length
    const occupied = studentCount + admissionCount
    const capacity = h.capacity ?? 40
    return {
      name: h.name,
      capacity,
      occupied,
      available: Math.max(0, capacity - occupied),
      isFull: occupied >= capacity,
    }
  })

  return houseName ? result[0] : result
}

/**
 * Convenience check used right before assigning a house to an applicant or
 * student. Returns { ok: true } or { ok: false, reason } — never throws for
 * the "house is full" case, only for actual lookup errors, so callers can
 * show a clean toast instead of catching exceptions for normal business logic.
 */
export const checkHouseCapacity = async (houseName, excludeGcc = null, sessionName = null) => {
  if (!houseName) return { ok: true }  // unassigning / no house selected is always fine
  try {
    const occ = await getHouseOccupancy(houseName, excludeGcc, sessionName)
    if (!occ) return { ok: false, reason: `House "${houseName}" not found` }
    if (occ.isFull) {
      return { ok: false, reason: `${houseName} is full (${occ.occupied}/${occ.capacity}) — choose another house or increase capacity in Hostel → Houses` }
    }
    return { ok: true, occupied: occ.occupied, capacity: occ.capacity }
  } catch (err) {
    // Lookup failure (network, etc.) — fail OPEN with a warning rather than
    // blocking staff from completing an admission over a transient error.
    console.error('checkHouseCapacity lookup failed:', err)
    return { ok: true, warning: 'Could not verify house capacity — proceeding anyway' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. PROMOTE ADMISSION → STUDENT
// ═══════════════════════════════════════════════════════════════════════════

export const promoteToStudent = async (admission) => {
  const gccNo = parseInt(admission.gcc || admission.gcc_no)
  const { data: existing } = await supabase.from(TABLES.students).select('id').eq('gcc_no', gccNo).maybeSingle()
  if (existing) return { created: false, id: existing.id }

  // Re-verify house capacity at the actual moment of enrollment, not just
  // at the moment the house was first picked in the Admissions form. Time
  // may have passed; other students may have filled the house since.
  // `excludeGcc: gccNo` because this exact applicant already "occupies" a
  // notional seat in getHouseOccupancy's admissions-side count — we don't
  // want them double-counted against their own seat.
  let houseWarning = null
  if (admission.house) {
    const check = await checkHouseCapacity(admission.house, gccNo, admission.session)
    if (!check.ok) {
      // Don't silently drop the house — don't silently keep it either.
      // Surface this back to the caller (Admissions.jsx's handleEnroll) so
      // staff sees it, rather than the student landing in an invisible
      // overflow the way the old code allowed.
      throw new Error(`Cannot enroll: ${check.reason}`)
    }
    if (check.warning) houseWarning = check.warning
  }

  const payload = {
    gcc_no: gccNo, name: admission.name || admission.applicant_name || '',
    dob: admission.dob || null, gender: admission.gender || null,
    course: admission.course || null, batch: admission.cls || admission.batch || null,
    house: admission.house || null, session: admission.session || null,
    hostel_type: admission.hostel_type || 'Day Scholar', status: 'Active',
    father_name: admission.father || admission.father_name || null,
    mother_name: admission.mother || admission.mother_name || null,
    phone: admission.phone || null, address: admission.address || null,
  }
  const { data, error } = await supabase.from(TABLES.students).insert(payload).select().single()
  if (error) throw error
  clearHouseCapacityCache()
  return { created: true, id: data.id, houseWarning }
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. PRINT RECEIPT
// ═══════════════════════════════════════════════════════════════════════════

export const buildReceiptHTML = ({
  receipt_no, pay_date, pay_mode, txn_ref, collected_by,
  student_name, adm_no, gcc_no, class_name, course, hostel_type,
  sections = [], items = [], total = 0,
}) => {
  const fmtAmt = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
  const allSections = [
    ...sections,
    ...(items.length > 0 ? [{ title: '', color: '#1e3a5f', items, subtotal: items.reduce((s, i) => s + (Number(i.amount) || 0), 0) }] : []),
  ]
  const sectionHtml = allSections.map(sec => `
    <div style="margin-bottom:14px;">
      ${sec.title ? `<div style="background:${sec.color}18;border-left:3px solid ${sec.color};padding:6px 10px;font-weight:700;font-size:13px;color:${sec.color};margin-bottom:6px;">${sec.title}</div>` : ''}
      ${sec.items.map(it => `<div style="display:flex;justify-content:space-between;padding:4px 10px;font-size:12px;color:#334155;"><span>${it.label}</span><span style="font-weight:600;">${fmtAmt(it.amount)}</span></div>`).join('')}
      ${allSections.length > 1 ? `<div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:12px;font-weight:700;border-top:1px solid #e2e8f0;margin-top:4px;color:${sec.color||'#1e3a5f'}"><span>Subtotal</span><span>${fmtAmt(sec.subtotal)}</span></div>` : ''}
    </div>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto;color:#0f172a;}@media print{body{padding:0}}</style></head><body>
    <div style="text-align:center;margin-bottom:18px;border-bottom:2px solid #1e3a5f;padding-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:#1e3a5f;">${INSTITUTE.name}</div>
      <div style="font-size:12px;color:#64748b;margin-top:3px;">${INSTITUTE.address}</div>
      <div style="font-size:20px;font-weight:900;color:#4f46e5;margin-top:8px;letter-spacing:1px;">FEE RECEIPT</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${receipt_no}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;">
      <div><span style="color:#94a3b8;">Student</span><br/><strong>${student_name}</strong></div>
      <div><span style="color:#94a3b8;">Adm. No.</span><br/><strong>${adm_no}</strong></div>
      <div><span style="color:#94a3b8;">GCC No.</span><br/><strong>${gcc_no || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Class</span><br/><strong>${class_name || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Course</span><br/><strong>${course || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Hostel Type</span><br/><strong>${hostel_type || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Date</span><br/><strong>${pay_date}</strong></div>
      <div><span style="color:#94a3b8;">Mode</span><br/><strong>${pay_mode}${txn_ref ? ' · ' + txn_ref : ''}</strong></div>
      ${collected_by ? `<div><span style="color:#94a3b8;">Collected By</span><br/><strong>${collected_by}</strong></div>` : ''}
    </div>
    ${sectionHtml}
    <div style="display:flex;justify-content:space-between;background:linear-gradient(135deg,#1e3a5f,#3730a3);color:white;padding:12px 14px;border-radius:8px;font-size:16px;font-weight:900;margin-top:8px;">
      <span>GRAND TOTAL</span><span>${fmtAmt(total)}</span>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;">This is a computer-generated receipt. No signature required.<br/>${INSTITUTE.short} · ${INSTITUTE.address}</div>
    </body></html>`
}

export const printReceipt = ({
  receipt_no, pay_date, pay_mode, txn_ref, collected_by,
  student_name, adm_no, gcc_no, class_name, course, hostel_type,
  sections = [], items = [], total = 0,
}) => {
  const html = buildReceiptHTML({ receipt_no, pay_date, pay_mode, txn_ref, collected_by, student_name, adm_no, gcc_no, class_name, course, hostel_type, sections, items, total })
  const win = window.open('', '_blank', 'width=520,height=750')
  if (!win) { alert('Allow pop-ups to print receipt'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOLARSHIP / FEE WAIVER — printable request form & approval certificate
// ═══════════════════════════════════════════════════════════════════════════
// Two documents for the stepwise scholarship/waiver process: a signed
// request form (printed at submission, before admin review) and a signed
// approval certificate (printed after admin approves). Both reuse the same
// letterhead style as printReceipt above for visual consistency across the
// portal's printed documents.

const _fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

function buildScholarshipRequestFormHTML({ ref_no, type, amount, reason, student_name, gcc_no, course, batch, hostel_type, requested_by, requested_at }) {
  const typeLabel = type === 'scholarship' ? 'Scholarship' : 'Fee Waiver'
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:auto;color:#0f172a;}@media print{body{padding:0}}</style></head><body>
    <div style="text-align:center;margin-bottom:18px;border-bottom:2px solid #1e3a5f;padding-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:#1e3a5f;">${INSTITUTE.name}</div>
      <div style="font-size:12px;color:#64748b;margin-top:3px;">${INSTITUTE.address}</div>
      <div style="font-size:20px;font-weight:900;color:#059669;margin-top:8px;letter-spacing:1px;">${typeLabel.toUpperCase()} REQUEST FORM</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${ref_no}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;">
      <div><span style="color:#94a3b8;">Student</span><br/><strong>${student_name}</strong></div>
      <div><span style="color:#94a3b8;">GCC No.</span><br/><strong>${gcc_no || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Course</span><br/><strong>${course || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Batch</span><br/><strong>${batch || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Hostel Type</span><br/><strong>${hostel_type || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Request Date</span><br/><strong>${_fmtDate(requested_at)}</strong></div>
    </div>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:11px;color:#065f46;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">${typeLabel} Requested</div>
      <div style="font-size:22px;font-weight:900;color:#059669;margin-top:4px;">₹${Number(amount || 0).toLocaleString('en-IN')} / month</div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.5px;margin-bottom:4px;">Reason</div>
      <div style="font-size:13px;line-height:1.6;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;min-height:44px;">${reason || '—'}</div>
    </div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:24px;">Requested by: <strong style="color:#334155;">${requested_by || 'Staff'}</strong></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#64748b;">Requesting Staff Signature</div>
      </div>
      <div style="text-align:center;">
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#64748b;">Parent / Guardian Signature</div>
      </div>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;">This request is pending admin approval and does not take effect until approved.<br/>${INSTITUTE.short} · ${INSTITUTE.address}</div>
    </body></html>`
}

export const printScholarshipRequestForm = (record, student) => {
  const html = buildScholarshipRequestFormHTML({
    ref_no: `GNSI/SW-REQ/${record.id || 'DRAFT'}`,
    type: record.type, amount: record.amount, reason: record.reason,
    student_name: student?.name, gcc_no: student?.gcc_no,
    course: student?.course, batch: student?.batch, hostel_type: student?.hostel_type,
    requested_by: record.requested_by, requested_at: record.requested_at || new Date().toISOString(),
  })
  const win = window.open('', '_blank', 'width=560,height=750')
  if (!win) { alert('Allow pop-ups to print the request form'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
}

function buildScholarshipCertificateHTML({ ref_no, type, amount, reason, student_name, gcc_no, course, batch, hostel_type, requested_by, requested_at, approved_by, approved_at }) {
  const typeLabel = type === 'scholarship' ? 'Scholarship' : 'Fee Waiver'
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:auto;color:#0f172a;}@media print{body{padding:0}}</style></head><body>
    <div style="text-align:center;margin-bottom:18px;border-bottom:3px double #1e3a5f;padding-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:#1e3a5f;">${INSTITUTE.name}</div>
      <div style="font-size:12px;color:#64748b;margin-top:3px;">${INSTITUTE.address}</div>
      <div style="font-size:20px;font-weight:900;color:#1e3a5f;margin-top:8px;letter-spacing:1px;">${typeLabel.toUpperCase()} APPROVAL CERTIFICATE</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${ref_no}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;">
      <div><span style="color:#94a3b8;">Student</span><br/><strong>${student_name}</strong></div>
      <div><span style="color:#94a3b8;">GCC No.</span><br/><strong>${gcc_no || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Course</span><br/><strong>${course || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Batch</span><br/><strong>${batch || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Hostel Type</span><br/><strong>${hostel_type || '—'}</strong></div>
      <div><span style="color:#94a3b8;">Requested</span><br/><strong>${_fmtDate(requested_at)}</strong></div>
    </div>
    <div style="background:linear-gradient(135deg,#1e3a5f,#3730a3);color:white;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:11px;opacity:.8;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">${typeLabel} Approved</div>
      <div style="font-size:24px;font-weight:900;margin-top:4px;">₹${Number(amount || 0).toLocaleString('en-IN')} / month</div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.5px;margin-bottom:4px;">Reason</div>
      <div style="font-size:13px;line-height:1.6;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">${reason || '—'}</div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:24px;">
      <span>Requested by: <strong style="color:#334155;">${requested_by || 'Staff'}</strong></span>
      <span>Approved: <strong style="color:#334155;">${_fmtDate(approved_at)}</strong></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:48px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#64748b;">${approved_by || 'Administrator'}<br/>Approving Administrator</div>
      </div>
      <div style="text-align:center;">
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#64748b;">Institutional Seal</div>
      </div>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;">This certificate confirms the ${typeLabel.toLowerCase()} is now in effect on the student's fee account.<br/>${INSTITUTE.short} · ${INSTITUTE.address}</div>
    </body></html>`
}

export const printScholarshipApprovalCertificate = (record, student) => {
  const html = buildScholarshipCertificateHTML({
    ref_no: `GNSI/SW-APP/${record.id}`,
    type: record.type, amount: record.amount, reason: record.reason,
    student_name: student?.name, gcc_no: student?.gcc_no,
    course: student?.course, batch: student?.batch, hostel_type: student?.hostel_type,
    requested_by: record.requested_by, requested_at: record.requested_at,
    approved_by: record.approved_by, approved_at: record.approved_at,
  })
  const win = window.open('', '_blank', 'width=560,height=750')
  if (!win) { alert('Allow pop-ups to print the certificate'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
}
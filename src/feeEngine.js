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
  Navodaya:          ['Umeed', 'Lakshya'],
  Foundation:        ['Prime', 'Elite'],
  'Combined Course': ['—'],
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

/** In-memory caches — both cleared on save */
const _rateCache     = {}   // key = session__course__batch__hostel
const _overrideCache = {}   // key = gcc__session

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
  const key = `${gccNo}__${sessionYear}`
  if (_overrideCache[key] !== undefined) return _overrideCache[key]

  const { data } = await supabase
    .from(TABLES.studentFeeOverrides)
    .select('flat_fee_override, reason, updated_by, updated_at')
    .eq('gcc_no', gccNo)
    .eq('session_year', sessionYear)
    .maybeSingle()

  const result = data ?? null
  _overrideCache[key] = result
  return result
}

/**
 * Save (upsert) a per-student flat fee override.
 * Pass null / undefined flatFeeOverride to REMOVE the override.
 */
export const saveStudentFlatFeeOverride = async (gccNo, sessionYear, flatFeeOverride, reason = '', updatedBy = '') => {
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
 */
export const getFeeRates = async (
  sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  course      = '',
  batch       = '',
  hostelType  = 'Day Scholar',
  gccNo       = null,   // ← NEW optional param
) => {
  const structKey = `${sessionYear}__${course}__${batch}__${hostelType}`

  // Fetch structural rates (cached)
  if (!_rateCache[structKey]) {
    const { data } = await supabase
      .from(TABLES.feeStructures)
      .select('flat_fee, course_fee, admission_fee')
      .eq('session_year', sessionYear)
      .eq('course',       course)
      .eq('batch',        batch)
      .eq('hostel_type',  hostelType)
      .maybeSingle()

    _rateCache[structKey] = {
      flatFee:      data?.flat_fee      ?? FLAT_RATES[hostelType]             ?? 0,
      courseFee:    data?.course_fee    ?? COURSE_RATES[course]?.[hostelType] ?? 0,
      admissionFee: data?.admission_fee ?? ADM_FEE_BASE,
    }
  }

  const rates = { ..._rateCache[structKey] }

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
  const now = new Date()
  const currentCalYear  = now.getFullYear()
  const currentCalMonth = now.getMonth() + 1
  const admDate = admissionDate ? new Date(admissionDate) : null

  return FLAT_FEE_MONTHS.map(month => {
    let year = currentCalYear
    const d  = new Date(`${month} 1, ${year}`)
    const calMonth = d.getMonth() + 1
    if (calMonth > currentCalMonth) year = currentCalYear - 1
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
  revertedBy = 'Admin', reason = '',
}) => {
  if (!table || !id) throw new Error('revertFeeCollection: table and id are required')

  const updates = {
    reverted: true,
    reverted_at: new Date().toISOString(),
    reverted_by: revertedBy,
    revert_reason: reason || null,
  }
  // Flat fees are also gated on `paid` everywhere else in the app —
  // flip it so every existing filter keeps working with zero other changes.
  if (table === TABLES.admFlatFees) updates.paid = false

  const { error } = await supabase.from(table).update(updates).eq('id', id)
  if (error) throw error

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
        deleted_at: new Date().toISOString(),
      }).eq('id', row.id)
      try {
        await supabase.from('audit_log').insert({
          action: 'fee_revert', changed_by: revertedBy, target_id: row.id,
          old_values: JSON.stringify({ source_ref: accountSourceRef, source_type: accountSourceType, revert_reason: reason }),
          created_at: new Date().toISOString(),
        })
      } catch (e) { console.warn('Audit log failed during revert', e) }
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
//   { kind: 'flat',      month, year, amount }
//   { kind: 'course',    course, subtype, month, year, amount }
//   { kind: 'advance',   label, amount }
//
// Returns { sections, total } ready for printReceipt().
// =============================================================================
export const collectFee = async ({
  gcc, studentName, admNo = '--', className = '', course = '',
  hostelType = 'Day Scholar', payDate, payMode = 'Cash',
  txnRef = null, collectedBy = 'Admin',
  studentId = null, receiptNo, items = [],
}) => {
  if (!gcc)       throw new Error('collectFee: gcc is required')
  if (!payDate)   throw new Error('collectFee: payDate is required')
  if (!receiptNo) throw new Error('collectFee: receiptNo is required')
  if (!items.length) throw new Error('collectFee: at least one item is required')

  const noRevert = { reverted: false, reverted_at: null, reverted_by: null, revert_reason: null }
  const invoiceMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const admItems = [], flatItems = [], crsfItems = [], sections = []

  for (const item of items) {

    // 1. ADMISSION FEE
    if (item.kind === 'admission') {
      const { error } = await supabase.from(TABLES.admFeeCollections).upsert({
        id: `${receiptNo}-adm`, adm_app_id: gcc, fee_type: 'admission',
        amount_paid: item.amount, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, description: 'Admission Fee',
        receipt_no: receiptNo, student_name: studentName,
        adm_no: admNo, class_name: className || null, collected_by: collectedBy,
        ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error('Admission fee save failed: ' + error.message)
      await upsertAccount({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Admission',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · Admission Fee · ${receiptNo}`,
        source_ref: sourceRef.admission(gcc), source_type: 'adm_fee',
      })
      admItems.push({ label: 'Admission Fee', amount: item.amount })
    }

    // 2. DRESS / ITEM
    else if (item.kind === 'item') {
      const lbl     = item.label || 'Item'
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
        ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Item (${lbl}) save failed: ` + error.message)
      await upsertAccount({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Admission',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · ${lbl} · ${receiptNo}`,
        source_ref: sRef, source_type: 'adm_fee',
      })
      admItems.push({ label: lbl, amount: item.amount })
    }

    // 3. FLAT FEE
    else if (item.kind === 'flat') {
      const alreadyPaid = await checkFlatFeeExists(gcc, item.month, item.year)
      if (alreadyPaid) { console.warn(`collectFee: flat ${item.month} ${item.year} already paid for GCC-${gcc}`); continue }
      const flatId = `${gcc}_flat_${item.month.slice(0, 3).toLowerCase()}_${item.year}`
      const sRef   = sourceRef.flatFee(gcc, item.month, item.year)
      const { error } = await supabase.from(TABLES.admFlatFees).upsert({
        id: flatId, adm_app_id: gcc, month: item.month, year: item.year,
        amount: item.amount, hostel_type: hostelType, paid: true,
        pay_date: payDate, pay_mode: payMode, txn_ref: txnRef || null,
        receipt_no: receiptNo, student_name: studentName, adm_no: admNo,
        ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Flat fee ${item.month} save failed: ` + error.message)
      await upsertAccount({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Hostel',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · ${item.month} ${item.year} Flat Fee [${hostelType}] · ${receiptNo}`,
        source_ref: sRef, source_type: 'flat_fee',
      })
      await mirrorToFeeInvoice({
        gcc, studentId, studentName, course, hostelType, className,
        feeType: 'Monthly Flat Fee', amount: item.amount, payDate, invoiceMonth,
      })
      flatItems.push({ label: `${item.month} ${item.year} [${hostelType}]`, amount: item.amount })
    }

    // 4. COURSE FEE
    else if (item.kind === 'course') {
      const yr  = item.year || CURRENT_YEAR
      const crs = item.course || course
      const sub = item.subtype || ''
      const alreadyPaid = await checkCourseFeeExists(gcc, item.month, yr)
      if (alreadyPaid) { console.warn(`collectFee: course ${item.month} ${yr} already paid for GCC-${gcc}`); continue }
      const recId = `${gcc}_course_${item.month.slice(0, 3).toLowerCase()}_${yr}`
      const sRef  = sourceRef.courseFee(gcc, item.month, yr)
      const { error } = await supabase.from(TABLES.admCourseFees).upsert({
        id: recId, adm_app_id: gcc, course: crs, subtype: sub,
        hostel_type: hostelType, for_month: item.month, year: yr,
        amount_paid: item.amount, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, receipt_no: receiptNo,
        student_name: studentName, adm_no: admNo,
        ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error(`Course fee ${item.month} save failed: ` + error.message)
      await upsertAccount({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Fees',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · ${crs}${sub ? ' ' + sub : ''} ${item.month} · ${receiptNo}`,
        source_ref: sRef, source_type: 'course_fee',
      })
      await mirrorToFeeInvoice({
        gcc, studentId, studentName, course: crs, hostelType, className,
        feeType: 'Course Fee', amount: item.amount, payDate, invoiceMonth,
      })
      crsfItems.push({ label: `${crs}${sub ? ' · ' + sub : ''} — ${item.month}`, amount: item.amount })
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
        ...noRevert,
      }, { onConflict: 'id' })
      if (error) throw new Error('Advance fee save failed: ' + error.message)
      await upsertAccount({
        entry_date: payDate, payment_date: payDate, type: 'Income', category: 'Advance',
        amount: item.amount, payment_mode: payMode,
        note: `${studentName} · Advance (${item.label || ''}) · ${receiptNo}`,
        source_ref: advId, source_type: 'advance_fee',
      })
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
  return { sections, total }
}

// deleteLegacyFeeRecord — admin hard-delete for the legacy `fees` table only.
// Live tables (adm_fee_collections / adm_flat_fees / adm_course_fees) are
// always soft-reverted via revertFeeCollection so there is always an audit trail.
export const deleteLegacyFeeRecord = async (id, role = 'admin') => {
  if (!id) throw new Error('deleteLegacyFeeRecord: id is required')
  const { data: original } = await supabase.from('fees').select('*').eq('id', id).maybeSingle()
  const { error } = await supabase.from('fees').delete().eq('id', id)
  if (error) throw new Error('Delete failed: ' + error.message)
  try {
    await supabase.from('audit_log').insert({
      action: 'legacy_fee_delete', changed_by: role, target_id: id,
      old_values: original ? JSON.stringify(original) : null,
      created_at: new Date().toISOString(),
    })
  } catch (e) { console.warn('Audit log failed', e) }
}

// amount/mode/anything else — date-only correction.
export const correctFeeCollectionDate = async ({
  table, id, newDate, accountSourceRef = null, accountSourceType = null,
}) => {
  if (!table || !id || !newDate) throw new Error('correctFeeCollectionDate: table, id and newDate are required')

  const { error } = await supabase.from(table).update({ pay_date: newDate }).eq('id', id)
  if (error) throw error

  if (accountSourceRef && accountSourceType) {
    await supabase.from(TABLES.accounts)
      .update({ entry_date: newDate, payment_date: newDate })
      .eq('source_ref', accountSourceRef)
      .eq('source_type', accountSourceType)
  }
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

export const recordPayment = async ({ invoiceId, amount, method }) => {
  const amt = parseFloat(amount)
  if (!amt || amt <= 0) throw new Error('Invalid payment amount')
  const { data: inv, error: invErr } = await supabase.from(TABLES.feeInvoices).select('*').eq('id', invoiceId).single()
  if (invErr) throw invErr
  const newPaid = parseFloat(inv.amount_paid || 0) + amt
  const newDue  = Math.max(0, parseFloat(inv.total_amount || 0) - newPaid)
  const status  = newDue <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL
  const { error: payErr } = await supabase.from(TABLES.feePayments).insert({ invoice_id: invoiceId, student_id: inv.student_id, amount: amt, method: method || 'Cash', paid_at: new Date().toISOString() })
  if (payErr) throw payErr
  const { error: updErr } = await supabase.from(TABLES.feeInvoices).update({ amount_paid: newPaid, amount_due: newDue, status, last_payment_at: new Date().toISOString() }).eq('id', invoiceId)
  if (updErr) throw updErr
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
export const getHouseOccupancy = async (houseName = null, excludeGcc = null) => {
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

  const [{ data: students, error: studentsErr }, { data: admissions, error: admissionsErr }] = await Promise.all([
    supabase.from(TABLES.students).select('house').not('house', 'is', null),
    supabase.from(TABLES.admissions).select('gcc_no, house').not('house', 'is', null).in('status', ['Admitted', 'Enrolled']),
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
export const checkHouseCapacity = async (houseName, excludeGcc = null) => {
  if (!houseName) return { ok: true }  // unassigning / no house selected is always fine
  try {
    const occ = await getHouseOccupancy(houseName, excludeGcc)
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
    const check = await checkHouseCapacity(admission.house, gccNo)
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
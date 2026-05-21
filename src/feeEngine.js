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
  students:          'students',
  admissions:        'admissions',
  fees:              'fees',
  feeInvoices:       'fee_invoices',
  feePayments:       'fee_payments',
  admFeeCollections: 'adm_fee_collections',
  admFlatFees:       'adm_flat_fees',
  admCourseFees:     'adm_course_fees',
  accounts:          'accounts',
  feeStructures:     'fee_structures',
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

export const today = () => new Date().toISOString().slice(0, 10)

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
// 4. FEE RATE HELPERS  — DB-fetched (fee_structures table)
// ═══════════════════════════════════════════════════════════════════════════

/** In-memory cache — cleared on save */
const _rateCache = {}

/**
 * Fetch flat_fee, course_fee, admission_fee from fee_structures.
 * Falls back to legacy FLAT_RATES / COURSE_RATES if not configured in DB.
 */
export const getFeeRates = async (
  sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  course      = '',
  batch       = '',
  hostelType  = 'Day Scholar',
) => {
  const key = `${sessionYear}__${course}__${batch}__${hostelType}`
  if (_rateCache[key]) return _rateCache[key]

  const { data } = await supabase
    .from(TABLES.feeStructures)
    .select('flat_fee, course_fee, admission_fee')
    .eq('session_year', sessionYear)
    .eq('course',       course)
    .eq('batch',        batch)
    .eq('hostel_type',  hostelType)
    .maybeSingle()

  const rates = {
    flatFee:      data?.flat_fee      ?? FLAT_RATES[hostelType]                ?? 0,
    courseFee:    data?.course_fee    ?? COURSE_RATES[course]?.[hostelType]    ?? 0,
    admissionFee: data?.admission_fee ?? ADM_FEE_BASE,
  }

  _rateCache[key] = rates
  return rates
}

/** Call after saving fee_structures so modal picks up new rates */
export const clearFeeRateCache = () => {
  Object.keys(_rateCache).forEach(k => delete _rateCache[k])
}

/** Async — returns flat fee amount for this student */
export const getFlatFeeAmt = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`) => {
  const r = await getFeeRates(sessionYear, course, batch, hostelType)
  return r.flatFee
}

/** Async — returns course fee amount for this student */
export const getCourseFeeAmt = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`) => {
  const r = await getFeeRates(sessionYear, course, batch, hostelType)
  return r.courseFee
}

/**
 * Async — returns full 12-month flat fee list for the academic year.
 * Each row has the correct amount from fee_structures.
 */
/**
 * Months that always use FLAT FEE (same every session, every course/batch).
 * All other months use COURSE FEE.
 */
export const FLAT_FEE_MONTHS = ["February", "March"]

/** Returns true if a given month should use flat fee. */
export const isFlatFeeMonth = (month) => FLAT_FEE_MONTHS.includes(month)

/** Returns true if a given month should use course fee. */
export const isCourseFeeMonth = (month) => !FLAT_FEE_MONTHS.includes(month)

/**
 * Async — returns ONLY flat fee months (Feb & Mar) for the session.
 * Only includes months up to the current date.
 */
export const getFlatFees = async (hostelType, course, batch, sessionYear = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`) => {
  const amount = await getFlatFeeAmt(hostelType, course, batch, sessionYear)
  const now = new Date()
  const currentCalYear  = now.getFullYear()
  const currentCalMonth = now.getMonth() + 1  // 1-based

  // MONTHS_LIST: Apr(0)-Dec(8) = CURRENT_YEAR, Jan(9)-Mar(11) = CURRENT_YEAR+1
  // But Feb & Mar in calendar are always the actual next calendar year from April start.
  // e.g. CURRENT_YEAR=2026 → Feb/Mar entries get year=2027 (future, filtered out).
  // Fix: for FLAT_FEE_MONTHS, always use the most recent past occurrence.
  return FLAT_FEE_MONTHS.map(month => {
    // Try current calendar year first, fall back to previous year
    let year = currentCalYear
    const d = new Date(`${month} 1, ${year}`)
    const calMonth = d.getMonth() + 1
    // If this month hasn't happened yet this calendar year, use previous year
    if (calMonth > currentCalMonth) year = currentCalYear - 1
    return {
      id:     `flat_${month.slice(0, 3).toLowerCase()}_${year}`,
      month, year, amount, hostelType,
    }
  })
}

/** Session year string: "2025-2026" */
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
    .maybeSingle()
  return !!data
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 7. ACCOUNTS UPSERT
// ═══════════════════════════════════════════════════════════════════════════
export const upsertAccount = async ({
  entry_date, type, category, amount,
  payment_mode, note, source_ref: sRef, source_type,
  is_recurring = false, receipt_url = null,  // ← add these
}) => {
  const { error } = await supabase
    .from(TABLES.accounts)
    .upsert(
      {
        entry_date: new Date().toISOString().slice(0, 10),
        type, category, amount, payment_mode, note,
        source_ref: sRef, source_type,
        is_recurring, receipt_url,  // ← add these
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
// 9. FEE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

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
// 11. PROMOTE ADMISSION → STUDENT
// ═══════════════════════════════════════════════════════════════════════════

export const promoteToStudent = async (admission) => {
  const gccNo = parseInt(admission.gcc || admission.gcc_no)
  const { data: existing } = await supabase.from(TABLES.students).select('id').eq('gcc_no', gccNo).maybeSingle()
  if (existing) return { created: false, id: existing.id }
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
  return { created: true, id: data.id }
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
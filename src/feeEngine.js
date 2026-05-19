// feeEngine.js
// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH for all fee logic across GNSI Portal
//
//  Replaces:
//    • src/shared/feeHelpers.js   (used by Admissions.jsx, Fees.jsx)
//    • src/feeEngine.js           (used by Students.jsx)
//
//  Update imports everywhere:
//    import { ... } from './feeEngine'          ← Students.jsx
//    import { ... } from '../feeEngine'         ← Fees.jsx, Admissions.jsx
//    import { ... } from './shared/feeEngine'   ← or move to shared/
//
//  RULES:
//    • fmt()     → always includes ₹  (never prefix manually with ₹)
//    • fmtMoney() → alias of fmt(), same behaviour
//    • All fee rates defined ONCE in FEE_RATES
//    • All Supabase table names defined ONCE in TABLES
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'   // adjust path if needed

// ═══════════════════════════════════════════════════════════════════════════
// 1. FEE RATES  — edit here only
// ═══════════════════════════════════════════════════════════════════════════

export const FLAT_RATES = {
  'Boarder':     5500,
  'Day Boarder': 4000,
  'Day Scholar': 2000,
}

// Course fees vary by hostel type
export const COURSE_RATES = {
  Navodaya: {
    'Boarder':     4500,
    'Day Boarder': 3500,
    'Day Scholar': 2500,
  },
  Sainik: {
    'Boarder':     5000,
    'Day Boarder': 4000,
    'Day Scholar': 3000,
  },
  Foundation: {
    'Boarder':     4000,
    'Day Boarder': 3000,
    'Day Scholar': 2000,
  },
  'Combined Course': {
    'Boarder':     5500,
    'Day Boarder': 4500,
    'Day Scholar': 3000,
  },
}

export const ADM_FEE_BASE   = 6000
export const PROSPECTUS_FEE = 200

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const TABLES = {
  students:           'students',
  admissions:         'admissions',
  fees:               'fees',
  feeInvoices:        'fee_invoices',
  feePayments:        'fee_payments',
  admFeeCollections:  'adm_fee_collections',
  admFlatFees:        'adm_flat_fees',
  admCourseFees:      'adm_course_fees',
  accounts:           'accounts',
}

export const INVOICE_STATUS = {
  PENDING:   'Pending',
  PARTIAL:   'Partial',
  PAID:      'Paid',
  OVERDUE:   'Overdue',
  WAIVED:    'Waived',
  CANCELLED: 'Cancelled',
}

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Cheque', 'Bank Transfer', 'DD', 'Other']
export const PAY_MODES        = PAYMENT_METHODS   // alias used by Fees.jsx

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
  const m = new Date().getMonth() + 1   // 1-based
  const y = new Date().getFullYear()
  return m >= 4 ? y : y - 1
})()

// ═══════════════════════════════════════════════════════════════════════════
// 3. FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

/** Always returns ₹N,NN,NNN — NEVER prefix with ₹ manually */
export const fmt = n =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

/** Alias — used by Students.jsx FeeStatementPanel */
export const fmtMoney = fmt

/** Date: 12 Jan 2025 */
export const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** Month label: January 2025 */
export const fmtMonth = m => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

/** Today as YYYY-MM-DD */
export const today = () => new Date().toISOString().slice(0, 10)

/** Normalise GCC to zero-padded string, e.g. 729 → "729" */
export const gccStr = v => String(parseInt(v) || 0)

/** Receipt / invoice number */
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
// 4. FEE RATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Single monthly flat fee amount for a hostel type */
export const getFlatFeeAmt = (hostelType = 'Day Scholar') =>
  FLAT_RATES[hostelType] ?? FLAT_RATES['Day Scholar']

/**
 * Full list of monthly flat fee rows for the academic year
 * (April of CURRENT_YEAR → March of CURRENT_YEAR+1)
 */
export const getFlatFees = (hostelType = 'Day Scholar') => {
  const amount = getFlatFeeAmt(hostelType)
  return MONTHS_LIST.map((month, i) => {
    const year = i <= 8 ? CURRENT_YEAR : CURRENT_YEAR + 1  // Apr(0)-Dec(8)=current, Jan(9)-Mar(11)=next   // Apr-Dec = current, Jan-Mar = next
    return {
      id:     `flat_${month.slice(0, 3).toLowerCase()}_${year}`,
      month,
      year,
      amount,
      hostelType,
    }
  })
}

/** Course fee for a given course + hostel type */
export const getCourseFeeAmt = (course = '', hostelType = 'Day Scholar') =>
  COURSE_RATES[course]?.[hostelType] ?? 0

/** Session year string: "2025-2026" */
export const getSessionYear = () => `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

// ═══════════════════════════════════════════════════════════════════════════
// 5. SOURCE REF HELPERS  (stable dedup keys for accounts + fee_invoices)
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
// 7. ACCOUNTS UPSERT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Write one income/expense line to the accounts table.
 * Idempotent via source_ref unique index.
 *
 * SQL (run once):
 *   ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source_ref  text;
 *   ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source_type text;
 *   CREATE UNIQUE INDEX IF NOT EXISTS accounts_source_ref_idx ON accounts(source_ref);
 */
export const upsertAccount = async ({
  entry_date, type, category, amount,
  payment_mode, note, source_ref: sRef, source_type,
}) => {
  const { error } = await supabase
    .from(TABLES.accounts)
    .upsert(
      { entry_date, type, category, amount, payment_mode, note, source_ref: sRef, source_type },
      { onConflict: 'source_ref', ignoreDuplicates: false }
    )
  if (error) console.error('upsertAccount error:', error.message)
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. FEE INVOICE MIRROR
//    Write / update fee_invoices so Fee Statement (Students.jsx) always
//    reflects payments made via the Fees.jsx collection flow.
//
//    SQL (run once):
//      ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS source_ref text;
//      CREATE UNIQUE INDEX IF NOT EXISTS fee_invoices_source_ref_idx
//        ON fee_invoices(source_ref);
// ═══════════════════════════════════════════════════════════════════════════

export const mirrorToFeeInvoice = async ({
  gcc, studentId, studentName, course, hostelType, className,
  feeType, amount, payDate, invoiceMonth,
}) => {
  const invRef     = sourceRef.invoice(gcc, feeType, invoiceMonth)
  const sessionYr  = getSessionYear()

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
        .update({
          amount_paid:     newPaid,
          amount_due:      0,
          status:          INVOICE_STATUS.PAID,
          last_payment_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from(TABLES.feeInvoices)
        .insert({
          source_ref:      invRef,
          student_id:      studentId,
          student_name:    studentName,
          gcc_no:          gcc,
          course:          course    || '',
          hostel_type:     hostelType,
          class_name:      className || '',
          session_year:    sessionYr,
          invoice_month:   invoiceMonth,
          fee_type:        feeType,
          base_amount:     amount,
          discount_amount: 0,
          penalty_amount:  0,
          total_amount:    amount,
          amount_paid:     amount,
          amount_due:      0,
          due_date:        payDate,
          status:          INVOICE_STATUS.PAID,
          generated_at:    new Date().toISOString(),
          generated_by:    'collection',
          last_payment_at: new Date().toISOString(),
        })
    }
  } catch (err) {
    // Never block a receipt — log only
    console.error('mirrorToFeeInvoice error:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. FEE SUMMARY  (used by Students.jsx → FeeStatementPanel)
// ═══════════════════════════════════════════════════════════════════════════

export const getStudentFeeSummary = async (studentId, sessionYear) => {
  const [invRes, payRes] = await Promise.all([
    supabase
      .from(TABLES.feeInvoices)
      .select('*')
      .eq('student_id', studentId)
      .eq('session_year', sessionYear)
      .order('invoice_month', { ascending: true }),
    supabase
      .from(TABLES.feePayments)
      .select('*')
      .eq('student_id', studentId)
      .order('paid_at', { ascending: false }),
  ])

  const invoices = invRes.data || []
  const payments = payRes.data || []

  const total_expected = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0)
  const total_paid     = invoices.reduce((s, i) => s + (Number(i.amount_paid)  || 0), 0)
  const total_due      = invoices.reduce((s, i) => s + (Number(i.amount_due)   || 0), 0)

  return { invoices, payment_history: payments, total_expected, total_paid, total_due }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. RECORD PAYMENT  (used by Students.jsx → FeeStatementPanel)
// ═══════════════════════════════════════════════════════════════════════════

export const recordPayment = async ({ invoiceId, amount, method }) => {
  const amt = parseFloat(amount)
  if (!amt || amt <= 0) throw new Error('Invalid payment amount')

  // Fetch current invoice
  const { data: inv, error: invErr } = await supabase
    .from(TABLES.feeInvoices)
    .select('*')
    .eq('id', invoiceId)
    .single()
  if (invErr) throw invErr

  const newPaid = parseFloat(inv.amount_paid || 0) + amt
  const newDue  = Math.max(0, parseFloat(inv.total_amount || 0) - newPaid)
  const status  = newDue <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIAL

  // Insert payment row
  const { error: payErr } = await supabase
    .from(TABLES.feePayments)
    .insert({
      invoice_id:  invoiceId,
      student_id:  inv.student_id,
      amount:      amt,
      method:      method || 'Cash',
      paid_at:     new Date().toISOString(),
    })
  if (payErr) throw payErr

  // Update invoice
  const { error: updErr } = await supabase
    .from(TABLES.feeInvoices)
    .update({
      amount_paid:     newPaid,
      amount_due:      newDue,
      status,
      last_payment_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
  if (updErr) throw updErr
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. PROMOTE ADMISSION → STUDENT
//     Used by Admissions.jsx → handleEnroll
// ═══════════════════════════════════════════════════════════════════════════

export const promoteToStudent = async (admission) => {
  const gccNo = parseInt(admission.gcc || admission.gcc_no)

  // Check if student already exists
  const { data: existing } = await supabase
    .from(TABLES.students)
    .select('id')
    .eq('gcc_no', gccNo)
    .maybeSingle()

  if (existing) return { created: false, id: existing.id }

  const payload = {
    gcc_no:      gccNo,
    name:        admission.name        || admission.applicant_name || '',
    dob:         admission.dob         || null,
    gender:      admission.gender      || null,
    course:      admission.course      || null,
    batch:       admission.cls         || admission.batch || null,
    house:       admission.house       || null,
    session:     admission.session     || null,
    hostel_type: admission.hostel_type || 'Day Scholar',
    status:      'Active',
    father_name: admission.father      || admission.father_name || null,
    mother_name: admission.mother      || admission.mother_name || null,
    phone:       admission.phone       || null,
    address:     admission.address     || null,
  }

  const { data, error } = await supabase
    .from(TABLES.students)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return { created: true, id: data.id }
}
/** Returns receipt HTML as a string — for bulk/multi-receipt print flows */
export const buildReceiptHTML = ({
  receipt_no, pay_date, pay_mode, txn_ref, collected_by,
  student_name, adm_no, gcc_no, class_name, course, hostel_type,
  sections = [],
  items    = [],
  total    = 0,
}) => {
  const fmtAmt = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

  const allSections = [
    ...sections,
    ...(items.length > 0
      ? [{ title: '', color: '#1e3a5f', items, subtotal: items.reduce((s, i) => s + (Number(i.amount) || 0), 0) }]
      : []),
  ]

  const sectionHtml = allSections.map(sec => `
    <div style="margin-bottom:14px;">
      ${sec.title ? `<div style="background:${sec.color}18;border-left:3px solid ${sec.color};padding:6px 10px;font-weight:700;font-size:13px;color:${sec.color};margin-bottom:6px;">${sec.title}</div>` : ''}
      ${sec.items.map(it => `
        <div style="display:flex;justify-content:space-between;padding:4px 10px;font-size:12px;color:#334155;">
          <span>${it.label}</span><span style="font-weight:600;">${fmtAmt(it.amount)}</span>
        </div>`).join('')}
      ${allSections.length > 1 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:12px;font-weight:700;border-top:1px solid #e2e8f0;margin-top:4px;color:${sec.color||'#1e3a5f'}">
          <span>Subtotal</span><span>${fmtAmt(sec.subtotal)}</span>
        </div>` : ''}
    </div>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto;color:#0f172a;}@media print{body{padding:0}}</style>
    </head><body>
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
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;">
      This is a computer-generated receipt. No signature required.<br/>
      ${INSTITUTE.short} · ${INSTITUTE.address}
    </div>
    </body></html>`
}
// ═══════════════════════════════════════════════════════════════════════════
// 12. PRINT RECEIPT
//
//  Supports TWO call patterns — both produce identical receipt output:
//
//  Pattern A — sections[] (used by Fees.jsx, multi-category invoice):
//    printReceipt({
//      ...fields,
//      sections: [
//        { title: 'Admission Package', color: '#4f46e5',
//          items: [{ label, amount }], subtotal: 9200 },
//        { title: 'Monthly Flat Fees', color: '#059669',
//          items: [{ label, amount }], subtotal: 5500 },
//      ],
//      total: 14700,
//    })
//
//  Pattern B — items[] (used by FeeCollectionModal, single-category):
//    printReceipt({
//      ...fields,
//      items: [{ label: 'Admission Fee', amount: 6000 }],
//      total: 6000,
//    })
//    → auto-wrapped into one section internally, no title/color needed
//
//  Both patterns can be mixed: pass sections[] AND items[] together.
//  items[] will be appended as an untitled section after sections[].
// ═══════════════════════════════════════════════════════════════════════════

export const printReceipt = ({
  receipt_no, pay_date, pay_mode, txn_ref, collected_by,
  student_name, adm_no, gcc_no, class_name, course, hostel_type,
  sections = [],   // Pattern A — Fees.jsx
  items    = [],   // Pattern B — FeeCollectionModal
  total    = 0,
}) => {
  const fmtAmt = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

  // Merge: convert loose items[] into an untitled section and append
  const allSections = [
    ...sections,
    ...(items.length > 0
      ? [{ title: '', color: '#1e3a5f', items, subtotal: items.reduce((s, i) => s + (Number(i.amount) || 0), 0) }]
      : []),
  ]

  const sectionHtml = allSections.map(sec => `
    <div style="margin-bottom:14px;">
      ${sec.title ? `
        <div style="background:${sec.color}18;border-left:3px solid ${sec.color};padding:6px 10px;font-weight:700;font-size:13px;color:${sec.color};margin-bottom:6px;">
          ${sec.title}
        </div>` : ''}
      ${sec.items.map(it => `
        <div style="display:flex;justify-content:space-between;padding:4px 10px;font-size:12px;color:#334155;">
          <span>${it.label}</span><span style="font-weight:600;">${fmtAmt(it.amount)}</span>
        </div>
      `).join('')}
      ${allSections.length > 1 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:12px;font-weight:700;border-top:1px solid #e2e8f0;margin-top:4px;color:${sec.color||'#1e3a5f'}">
          <span>Subtotal</span><span>${fmtAmt(sec.subtotal)}</span>
        </div>` : ''}
    </div>
  `).join('')

  const html = `
    <html><head>
      <title>Receipt ${receipt_no}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; max-width: 480px; margin: auto; color: #0f172a; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
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
        <div><span style="color:#94a3b8;">Hostel Type</span><br/><strong>${hostel_type}</strong></div>
        <div><span style="color:#94a3b8;">Date</span><br/><strong>${pay_date}</strong></div>
        <div><span style="color:#94a3b8;">Mode</span><br/><strong>${pay_mode}${txn_ref ? ' · ' + txn_ref : ''}</strong></div>
        ${collected_by ? `<div><span style="color:#94a3b8;">Collected By</span><br/><strong>${collected_by}</strong></div>` : ''}
      </div>

      ${sectionHtml}

      <div style="display:flex;justify-content:space-between;background:linear-gradient(135deg,#1e3a5f,#3730a3);color:white;padding:12px 14px;border-radius:8px;font-size:16px;font-weight:900;margin-top:8px;">
        <span>GRAND TOTAL</span><span>${fmtAmt(total)}</span>
      </div>

      <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;">
        This is a computer-generated receipt. No signature required.<br/>
        ${INSTITUTE.short} · ${INSTITUTE.address}
      </div>
    </body></html>
  `

  const win = window.open('', '_blank', 'width=520,height=750')
  if (!win) { alert('Allow pop-ups to print receipt'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}
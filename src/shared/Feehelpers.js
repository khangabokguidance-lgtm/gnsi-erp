// shared/feeHelpers.js
// ─────────────────────────────────────────────────────────────────────────────
//  Single source of truth for all fee modules.
//  Import from here — never re-declare these in individual files.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase'

// ── Formatting ───────────────────────────────────────────────────────────────

export const fmt   = n  => Number(n || 0).toLocaleString('en-IN')
export const today = () => new Date().toISOString().split('T')[0]

/** Strip .0 float artifacts from GCC numbers stored as numeric in Postgres.
 *  "715.0" → "715"  |  715 → "715"  |  "715" → "715"
 */
export const gccStr = gcc => String(parseInt(gcc) || gcc || '')

/** Collision-safe receipt number: prefix + timestamp base36 + 4 random chars */
export const rcptNo = (prefix = 'GNSI') =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// ── Database helpers ──────────────────────────────────────────────────────────

/**
 * upsertAccount
 * Insert or update a row in `accounts` keyed by source_ref.
 * All fee modules must use this — never plain .insert() on accounts.
 *
 * @param {object} row — must include: source_ref, source_type, entry_date,
 *                       type, category, amount, payment_mode, note
 */
export async function upsertAccount(row) {
  const { error } = await supabase
    .from('accounts')
    .upsert(row, { onConflict: 'source_ref' })
  if (error) throw error
}

/**
 * checkCourseFeeExists
 * Returns true if a course fee row already exists for this student + month.
 * Use before inserting into adm_course_fees to prevent duplicates.
 *
 * @param {string} adm_app_id  — gcc_no as string
 * @param {string} for_month   — e.g. "April"
 * @param {number} year        — e.g. 2026
 */
export async function checkCourseFeeExists(adm_app_id, for_month, year) {
  const { data, error } = await supabase
    .from('adm_course_fees')
    .select('id')
    .eq('adm_app_id', adm_app_id)
    .eq('for_month', for_month)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return !!data
}

// ── Institute config (shared across invoice/receipt builders) ─────────────────

export const INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  short:   'GNSI',
  address: 'Khangabok, Thoubal, Manipur — 795128',
  phone:   '+91 9876543210',
}

// ── Fee constants ─────────────────────────────────────────────────────────────

export const CURRENT_YEAR = new Date().getFullYear()

export const FLAT_FEES = [
  { id: `flat_feb_${CURRENT_YEAR}`, month: 'February', amount: 5500, year: CURRENT_YEAR },
  { id: `flat_mar_${CURRENT_YEAR}`, month: 'March',    amount: 5500, year: CURRENT_YEAR },
]

export const COURSE_FEES = {
  Sainik:            { Boarder: 6000, 'Day Scholar': 2500, 'Day Boarder': 4500 },
  Navodaya:          { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  Foundation:        { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  'Combined Course': { Boarder: 6500, 'Day Scholar': 3000, 'Day Boarder': 4500 },
}

export const PAY_MODES = ['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'DD']

export const MONTHS_LIST = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const getCourseFeeAmt = (course, hostelType) => {
  const c = Object.keys(COURSE_FEES).find(k =>
    (course || '').toLowerCase().includes(k.toLowerCase())
  ) || course
  const h = hostelType === 'Hostel' || hostelType === 'Boarder'
    ? 'Boarder'
    : hostelType === 'Day Boarder'
    ? 'Day Boarder'
    : 'Day Scholar'
  return COURSE_FEES[c]?.[h] || COURSE_FEES[c]?.['Day Scholar'] || 2000
}

// ── Receipt / Invoice HTML builder ────────────────────────────────────────────

/**
 * buildReceiptHTML
 * Generates a self-contained printable HTML receipt.
 * Used by FeeCollectionModal, Fees.jsx FeePaymentTab, and BulkAdmissionFee.
 *
 * @param {object} d
 *   receipt_no, pay_date, pay_mode, txn_ref, collected_by,
 *   student_name, adm_no, gcc_no, class_name, course,
 *   items: [{ label, amount }],
 *   total
 */
export function buildReceiptHTML(d) {
  const {
    receipt_no, pay_date, pay_mode, txn_ref, collected_by,
    student_name, adm_no, gcc_no, class_name, course,
    items = [],
    total,
  } = d

  const dateStr = pay_date
    ? new Date(pay_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const rows = items.map(it => `
    <tr>
      <td>${it.label}</td>
      <td style="text-align:right;font-weight:700;color:#0f2744">₹${fmt(it.amount)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Receipt ${receipt_no}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia',serif;background:#f5f5f0;padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:20px}
    .card{background:#fff;border:2px solid #0f2744;border-radius:4px;width:100%;max-width:620px;overflow:hidden}
    .hdr{background:#0f2744;color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start}
    .inst{font-size:16px;font-weight:700}
    .sub{font-size:10px;color:#c9a84c;margin-top:3px;letter-spacing:1px;text-transform:uppercase}
    .addr{font-size:10px;color:#94a3b8;margin-top:4px}
    .rno{font-size:13px;font-weight:700;color:#c9a84c;text-align:right}
    .rdate{font-size:10px;color:#94a3b8;margin-top:2px;text-align:right}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e2e8f0}
    .mc{padding:10px 18px;border-right:1px solid #e2e8f0}
    .mc:last-child{border-right:none}
    .ml{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
    .mv{font-weight:700;color:#1e293b;font-size:12px}
    table{width:100%;border-collapse:collapse}
    td{padding:8px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155}
    .info-lbl{color:#64748b;width:38%}
    .total-row td{background:#0f2744;color:white;font-weight:700;font-size:14px;padding:14px 18px;border:none}
    .total-row td:last-child{text-align:right;color:#c9a84c;font-size:16px}
    .ftr{padding:16px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end}
    .sig-box{font-size:11px;color:#94a3b8;margin-bottom:4px}
    .sig-line{width:130px;border-top:1.5px dashed #cbd5e1;margin-top:32px}
    .wm{text-align:center;font-size:10px;color:#94a3b8;margin-top:10px}
    .btns{display:flex;gap:10px}
    .btn{padding:11px 28px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
    .bp{background:#0f2744;color:white}
    @media print{.btns{display:none}body{background:white;padding:0}.card{box-shadow:none}}
  </style></head><body>
  <div class="card">
    <div class="hdr">
      <div>
        <div class="inst">${INSTITUTE.name}</div>
        <div class="sub">Official Fee Receipt</div>
        <div class="addr">${INSTITUTE.address} · ${INSTITUTE.phone}</div>
      </div>
      <div>
        <div class="rno">${receipt_no}</div>
        <div class="rdate">${dateStr}</div>
      </div>
    </div>
    <div class="meta">
      <div class="mc"><div class="ml">Pay mode</div><div class="mv">${pay_mode || '—'}</div></div>
      <div class="mc"><div class="ml">Collected by</div><div class="mv">${collected_by || 'Admin'}</div></div>
      <div class="mc"><div class="ml">Txn ref</div><div class="mv">${txn_ref || '—'}</div></div>
    </div>
    <table><tbody>
      <tr><td class="info-lbl">Student</td><td style="font-weight:700;color:#0f172a">${student_name || '—'}</td></tr>
      <tr><td class="info-lbl">GCC No.</td><td style="font-weight:700;color:#0f172a">${gcc_no ? 'GCC-' + gcc_no : '—'}</td></tr>
      <tr><td class="info-lbl">Adm. No.</td><td>${adm_no || '—'}</td></tr>
      <tr><td class="info-lbl">Class / Course</td><td>${[class_name, course].filter(Boolean).join(' · ') || '—'}</td></tr>
    </tbody></table>
    <table style="margin-top:8px"><thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px 18px;font-size:11px;font-weight:700;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.05em">Description</th>
        <th style="padding:8px 18px;font-size:11px;font-weight:700;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.05em">Amount</th>
      </tr>
    </thead><tbody>
      ${rows}
      <tr class="total-row"><td>Total amount paid</td><td>₹${fmt(total)}</td></tr>
    </tbody></table>
    <div class="ftr">
      <div>
        <div class="sig-box">Authorised signatory</div>
        <div class="sig-line"></div>
      </div>
      <div style="text-align:right;font-size:11px;color:#94a3b8">
        <div style="font-weight:700;color:#1e293b;font-size:13px">${INSTITUTE.short}</div>
        <div>${INSTITUTE.address}</div>
      </div>
    </div>
    <div class="wm">Computer-generated receipt · ${INSTITUTE.short} · ${receipt_no}</div>
  </div>
  <div class="btns">
    <button class="btn bp" onclick="window.print()">Print receipt</button>
  </div>
  </body></html>`
}

/**
 * printReceipt
 * Opens the receipt HTML in a new window and triggers print.
 */
export function printReceipt(data) {
  const html = buildReceiptHTML(data)
  const pw = window.open('', '_blank', 'width=720,height=840,scrollbars=yes')
  if (!pw) {
    const blob = new Blob([html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
    return
  }
  pw.document.write(html)
  pw.document.close()
}
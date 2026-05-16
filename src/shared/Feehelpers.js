// shared/feeHelpers.js
// ─────────────────────────────────────────────────────────────────────────────
//  Single source of truth for all fee modules.
//  ✅ Fixed: flat fee now varies by hostel type
//      Boarder     → ₹5500/month
//      Day Boarder → ₹4000/month
//      Day Scholar → ₹2000/month
//  ✅ Fixed: only February and March are flat fee months
//  ✅ Fixed: getFlatFees(hostelType) returns correct amounts per student
//  ✅ Fixed: stable source_refs — no timestamp-based keys
//  ✅ Fixed: single unified printReceipt used everywhere
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase'

// ── Formatting ────────────────────────────────────────────────────────────────

export const fmt   = n  => Number(n || 0).toLocaleString('en-IN')
export const today = () => new Date().toISOString().split('T')[0]

export const gccStr = gcc => String(parseInt(gcc) || gcc || '')

export const rcptNo = (prefix = 'GNSI') =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// ── Institute config ──────────────────────────────────────────────────────────

export const INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  short:   'GNSI',
  address: 'Khangabok, Thoubal, Manipur — 795128',
  phone:   '+91 8974298074',
}

// ── Year ──────────────────────────────────────────────────────────────────────

export const CURRENT_YEAR = new Date().getFullYear()

// ── Flat fee structure ────────────────────────────────────────────────────────
//
//  Flat fee = the only monthly charge for all students.
//  Amount differs by hostel type.
//  Currently only February and March are flat fee months.
//
//  To add more months → add entries to FLAT_FEE_MONTHS.
//  To change amounts  → edit FLAT_FEE_RATES.

export const FLAT_FEE_RATES = {
  'Boarder':     5500,
  'Day Boarder': 4000,
  'Day Scholar': 2000,
}

// Which months flat fee is charged this session
export const FLAT_FEE_MONTHS = [
  { month: 'February', year: CURRENT_YEAR },
  { month: 'March',    year: CURRENT_YEAR },
]

/**
 * getFlatFeeAmt
 * Returns the flat fee amount for a given hostel type.
 * Falls back to Day Scholar rate if type not recognised.
 */
export const getFlatFeeAmt = (hostelType) => {
  const raw = (hostelType || '').toString().trim()
  return FLAT_FEE_RATES[raw] ?? FLAT_FEE_RATES['Day Scholar']
}

/**
 * getFlatFees
 * Returns the flat fee rows for a student based on their hostel type.
 * Each row: { id, month, year, amount }
 *
 * Always call this with the student's hostelType — never use a hardcoded list.
 *
 * Example:
 *   getFlatFees('Boarder')     → Feb ₹5500, Mar ₹5500
 *   getFlatFees('Day Scholar') → Feb ₹2000, Mar ₹2000
 *   getFlatFees('Day Boarder') → Feb ₹4000, Mar ₹4000
 */
export const getFlatFees = (hostelType) => {
  const amount = getFlatFeeAmt(hostelType)
  return FLAT_FEE_MONTHS.map(m => ({
    id:     `flat_${m.month.slice(0, 3).toLowerCase()}_${m.year}`,
    month:  m.month,
    year:   m.year,
    amount,
  }))
}

// ── Course fee structure ──────────────────────────────────────────────────────
//  Separate from flat fees — used for specific course charges only.

export const COURSE_FEES = {
  Sainik:            { Boarder: 6000, 'Day Scholar': 2500, 'Day Boarder': 4500 },
  Navodaya:          { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  Foundation:        { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  'Combined Course': { Boarder: 6500, 'Day Scholar': 3000, 'Day Boarder': 4500 },
}

export const PAY_MODES   = ['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'DD']
export const MONTHS_LIST = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const getCourseFeeAmt = (course, hostelType) => {
  const courseKey = Object.keys(COURSE_FEES).find(k =>
    (course || '').toLowerCase().includes(k.toLowerCase())
  ) || course
  const raw = (hostelType || '').toString().trim().toLowerCase()
  const h =
    raw === 'hostel' || raw === 'boarder' ? 'Boarder' :
    raw === 'day boarder'                 ? 'Day Boarder' :
                                            'Day Scholar'
  const amount = COURSE_FEES[courseKey]?.[h]
  if (amount == null) return COURSE_FEES[courseKey]?.['Day Scholar'] || 2000
  return amount
}

// ── Stable source_ref builders ────────────────────────────────────────────────

export const sourceRef = {
  admission: (gcc)              => `${gcc}_admission`,
  admItem:   (gcc, label)       => `${gcc}_admitem_${label.toLowerCase().replace(/\s+/g, '_')}`,
  flatFee:   (gcc, month, year) => `${gcc}_flat_${month.slice(0,3).toLowerCase()}_${year}`,
  courseFee: (gcc, month, year) => `${gcc}_course_${month.slice(0,3).toLowerCase()}_${year}`,
  advance:   (gcc, ts)          => `${gcc}_advance_${ts}`,
}

// ── Database helpers ──────────────────────────────────────────────────────────

export async function upsertAccount(row) {
  const { error } = await supabase
    .from('accounts')
    .upsert(row, { onConflict: 'source_ref' })
  if (error) throw error
}

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

export async function checkFlatFeeExists(adm_app_id, month, year) {
  const { data, error } = await supabase
    .from('adm_flat_fees')
    .select('id')
    .eq('adm_app_id', adm_app_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function promoteToStudent(app) {
  const gccInt = parseInt(app.gcc || app.gcc_no)
  if (!gccInt) throw new Error('GCC number is required to promote student.')

  const { data: existing, error: checkErr } = await supabase
    .from('students')
    .select('id, name, gcc_no')
    .eq('gcc_no', gccInt)
    .maybeSingle()
  if (checkErr) throw checkErr
  if (existing) return { created: false, student: existing }

  const payload = {
    gcc_no:       gccInt,
    admission_no: app.admNo       || app.adm_no     || null,
    name:         app.name        || '',
    gender:       app.gender      || null,
    dob:          app.dob         || null,
    father_name:  app.father      || app.father_name || null,
    mother_name:  app.mother      || app.mother_name || null,
    phone:        app.phone       || null,
    address:      app.address     || null,
    course:       app.course      || null,
    batch:        app.cls         || app.batch       || null,
    house:        app.house       || null,
    hostel_type:  app.hostel_type || 'Day Scholar',
    session:      app.session     || null,
    status:       'Active',
    remarks:      app.remarks     || null,
  }

  const { data: created, error: insertErr } = await supabase
    .from('students')
    .insert(payload)
    .select()
    .single()
  if (insertErr) throw insertErr

  return { created: true, student: created }
}

// ── Unified Receipt HTML builder ──────────────────────────────────────────────

export function buildReceiptHTML(d) {
  const {
    receipt_no, pay_date, pay_mode, txn_ref, collected_by,
    student_name, adm_no, gcc_no, class_name, course, hostel_type,
    items = [], sections, total,
  } = d

  const dateStr = pay_date
    ? new Date(pay_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  let itemsHTML = ''
  if (sections && sections.length > 0) {
    sections.forEach(sec => {
      if (!sec.items?.length) return
      itemsHTML += `<tr><td colspan="2" style="background:#f8fafc;font-size:10px;font-weight:800;color:${sec.color||'#1e3a5f'};text-transform:uppercase;letter-spacing:.08em;padding:7px 18px;border-bottom:1px solid #e2e8f0">${sec.title}</td></tr>`
      sec.items.forEach(it => {
        itemsHTML += `<tr><td style="padding:7px 18px 7px 28px;font-size:13px;color:#334155">${it.label}</td><td style="padding:7px 18px;text-align:right;font-weight:600;color:${sec.color||'#1e3a5f'};font-size:13px">₹${fmt(it.amount)}</td></tr>`
      })
      if (sec.subtotal != null) {
        itemsHTML += `<tr style="background:#f8fafc"><td style="padding:6px 18px;font-size:11px;font-weight:700;color:#94a3b8">Subtotal</td><td style="padding:6px 18px;text-align:right;font-weight:700;color:#475569;font-size:12px">₹${fmt(sec.subtotal)}</td></tr>`
      }
    })
  } else {
    items.forEach(it => {
      itemsHTML += `<tr><td style="padding:8px 18px;font-size:13px;color:#334155">${it.label}</td><td style="padding:8px 18px;text-align:right;font-weight:700;color:#0f2744;font-size:13px">₹${fmt(it.amount)}</td></tr>`
    })
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${receipt_no}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia',serif;background:#f5f5f0;padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:20px}
    .card{background:#fff;border:2px solid #0f2744;border-radius:4px;width:100%;max-width:640px;overflow:hidden;position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:rgba(15,39,68,.04);white-space:nowrap;pointer-events:none;z-index:0}
    .hdr{background:#0f2744;color:white;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
    .inst{font-size:16px;font-weight:700}
    .sub{font-size:10px;color:#c9a84c;margin-top:3px;letter-spacing:1px;text-transform:uppercase}
    .addr{font-size:10px;color:#94a3b8;margin-top:4px}
    .rno{font-size:13px;font-weight:700;color:#c9a84c;text-align:right}
    .rdate{font-size:10px;color:#94a3b8;margin-top:2px;text-align:right}
    .accent{height:4px;background:linear-gradient(90deg,#c9a84c,#0f2744);position:relative;z-index:1}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e2e8f0;position:relative;z-index:1}
    .mc{padding:10px 18px;border-right:1px solid #e2e8f0}
    .mc:last-child{border-right:none}
    .ml{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
    .mv{font-weight:700;color:#1e293b;font-size:12px}
    table{width:100%;border-collapse:collapse;position:relative;z-index:1}
    .info-lbl{color:#64748b;width:38%;font-size:13px}
    .info-val{font-weight:700;color:#0f172a;font-size:13px}
    td{padding:8px 18px;border-bottom:1px solid #f1f5f9}
    .total-row td{background:#0f2744;color:white;font-weight:700;font-size:14px;padding:14px 18px;border:none}
    .total-row td:last-child{text-align:right;color:#c9a84c;font-size:18px}
    .ftr{padding:16px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;position:relative;z-index:1}
    .sig-line{width:130px;border-top:1.5px dashed #cbd5e1;margin-top:32px}
    .wm{text-align:center;font-size:10px;color:#94a3b8;padding:8px;border-top:1px solid #f1f5f9;position:relative;z-index:1}
    .btns{display:flex;gap:10px}
    .btn{padding:11px 28px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
    .bp{background:#0f2744;color:white}
    @media print{.btns{display:none}body{background:white;padding:0}.card{box-shadow:none}.hdr,.total-row,.accent{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="card">
    <div class="watermark">GNSI</div>
    <div class="hdr">
      <div>
        <div class="inst">${INSTITUTE.name}</div>
        <div class="sub">Official Fee Receipt</div>
        <div class="addr">${INSTITUTE.address} · ${INSTITUTE.phone}</div>
      </div>
      <div><div class="rno">${receipt_no}</div><div class="rdate">${dateStr}</div></div>
    </div>
    <div class="accent"></div>
    <div class="meta">
      <div class="mc"><div class="ml">Pay mode</div><div class="mv">${pay_mode||'—'}</div></div>
      <div class="mc"><div class="ml">Collected by</div><div class="mv">${collected_by||'Admin'}</div></div>
      <div class="mc"><div class="ml">Txn ref</div><div class="mv">${txn_ref||'—'}</div></div>
    </div>
    <table><tbody>
      <tr><td class="info-lbl">Student</td><td class="info-val">${student_name||'—'}</td></tr>
      <tr><td class="info-lbl">GCC No.</td><td class="info-val">${gcc_no?'GCC-'+gcc_no:'—'}</td></tr>
      <tr><td class="info-lbl">Adm. No.</td><td style="font-size:13px;color:#334155">${adm_no||'—'}</td></tr>
      <tr><td class="info-lbl">Class / Course</td><td style="font-size:13px;color:#334155">${[class_name,course].filter(Boolean).join(' · ')||'—'}</td></tr>
      ${hostel_type?`<tr><td class="info-lbl">Hostel Type</td><td style="font-size:13px;font-weight:700;color:#0f172a">${hostel_type}</td></tr>`:''}
    </tbody></table>
    <table style="margin-top:6px"><thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px 18px;font-size:11px;font-weight:700;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.05em">Description</th>
        <th style="padding:8px 18px;font-size:11px;font-weight:700;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.05em">Amount</th>
      </tr>
    </thead><tbody>
      ${itemsHTML}
      <tr class="total-row"><td>Total amount paid</td><td>₹${fmt(total)}</td></tr>
    </tbody></table>
    <div class="ftr">
      <div><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Authorised signatory</div><div class="sig-line"></div></div>
      <div style="text-align:right;font-size:11px;color:#94a3b8">
        <div style="font-weight:700;color:#1e293b;font-size:13px">${INSTITUTE.short}</div>
        <div>${INSTITUTE.address}</div>
      </div>
    </div>
    <div class="wm">Computer-generated receipt · ${INSTITUTE.short} · ${receipt_no}</div>
  </div>
  <div class="btns"><button class="btn bp" onclick="window.print()">Print receipt</button></div>
  </body></html>`
}

export function printReceipt(data) {
  const html = buildReceiptHTML(data)
  const pw = window.open('', '_blank', 'width=720,height=860,scrollbars=yes')
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  pw.document.write(html)
  pw.document.close()
  setTimeout(() => pw.print(), 400)
}
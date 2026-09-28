// feeLedgerBulk.js — "Print all ledgers": builds every selected student's
// fee register for one session and prints them as one document (a summary
// page, then one page per student). Uses the same model as the single-student
// register (feeLedgerModel.js), so the numbers match what each ledger shows.
import { supabase } from './supabase'
import { fetchAllPages } from './StudyMaterialBridge'
import { getFeeRates, gccStr, normalizeSessionYear } from './feeEngine'
import { fmt, fmtDate, escH, shortSession, toEntries, buildRegister } from './feeLedgerModel'

const groupByGcc = rows => {
  const m = new Map()
  for (const r of rows || []) { const g = gccStr(r.adm_app_id); if (!m.has(g)) m.set(g, []); m.get(g).push(r) }
  return m
}

// Every non-reverted payment row, paged past the 1000-row cap.
async function loadAllFeeRows() {
  const [a, f, c] = await Promise.all([
    fetchAllPages(() => supabase.from('adm_fee_collections').select('*').eq('reverted', false).order('id', { ascending: true })),
    fetchAllPages(() => supabase.from('adm_flat_fees').select('*').eq('paid', true).eq('reverted', false).order('id', { ascending: true })),
    fetchAllPages(() => supabase.from('adm_course_fees').select('*').eq('reverted', false).order('id', { ascending: true })),
  ])
  const err = a.error || f.error || c.error
  if (err) throw new Error(`Could not load fee records: ${err.message}`)
  return { adm: groupByGcc(a.data), flat: groupByGcc(f.data), crs: groupByGcc(c.data) }
}

// Per-student flat-fee overrides for the session (one query instead of one per student).
async function loadOverrides(session) {
  const { data, error } = await fetchAllPages(() => supabase.from('student_fee_overrides').select('gcc_no, flat_fee_override').eq('session_year', session).order('gcc_no', { ascending: true }))
  if (error) return new Map() // overrides are optional — fall back to structural rates
  return new Map((data || []).map(r => [gccStr(r.gcc_no), Number(r.flat_fee_override)]))
}

export async function buildAllLedgers(students, session, { onProgress } = {}) {
  session = normalizeSessionYear(session)
  onProgress?.('Loading fee records…')
  const [rows, overrides] = await Promise.all([loadAllFeeRows(), loadOverrides(session)])
  onProgress?.('Working out each register…')
  const rateCache = new Map()
  const out = []
  for (const s of students) {
    const key = [s.course || '', s.batch || '', s.hostel_type || 'Day Scholar'].join('|')
    if (!rateCache.has(key)) rateCache.set(key, await getFeeRates(session, s.course || '', s.batch || '', s.hostel_type || 'Day Scholar'))
    const base = rateCache.get(key)
    const g = gccStr(s.gcc_no)
    const rates = overrides.has(g) ? { ...base, flatFee: overrides.get(g) } : base
    const entries = toEntries(s, rows.adm.get(g) || [], rows.flat.get(g) || [], rows.crs.get(g) || [])
    out.push({ student: s, entries, rates, reg: buildRegister(s, entries, session, rates) })
  }
  return out
}

const STATUS_LABEL = { paid: 'PAID', advance: 'ADVANCE', short: 'SHORT', due: 'DUE', upcoming: 'Upcoming', before: '—' }

// win: a window opened synchronously on the click (so pop-up blockers allow it)
// that this fills in once the ledgers are ready.
export function printLedgerBook(items, session, { includeDayBook = true, title = 'Fee Ledgers', win = null } = {}) {
  const totalPaid = items.reduce((s, x) => s + x.reg.totalPaid, 0)
  const totalDue = items.reduce((s, x) => s + x.reg.totalDue, 0)
  const withDues = items.filter(x => x.reg.totalDue > 0).length
  const printed = new Date().toLocaleString('en-IN')

  const summary = `<section class="page">
    <div class="inst">Guidance Navodaya &amp; Sainik Institute · Khangabok, Thoubal, Manipur</div>
    <h1>${escH(title)} — Session ${escH(shortSession(session))}</h1>
    <div class="kpis">
      <div><b>Students</b><span>${items.length}</span></div>
      <div><b>Collected this session</b><span class="ok">₹${fmt(totalPaid)}</span></div>
      <div><b>Balance due</b><span class="bad">₹${fmt(totalDue)}</span></div>
      <div><b>Students with dues</b><span>${withDues}</span></div>
    </div>
    <table><thead><tr><th>#</th><th>GCC</th><th>Student</th><th>Course · Batch</th><th>Hostel</th><th class="num">Paid (₹)</th><th class="num">Due (₹)</th><th>Months due</th></tr></thead>
    <tbody>${items.map((x, i) => `<tr><td>${i + 1}</td><td>${escH(x.student.gcc_no)}</td><td>${escH(x.student.name)}</td><td>${escH([x.student.course, x.student.batch].filter(Boolean).join(' · '))}</td><td>${escH(x.student.hostel_type || '—')}</td><td class="num">${fmt(x.reg.totalPaid)}</td><td class="num${x.reg.totalDue ? ' bad' : ''}">${fmt(x.reg.totalDue)}</td><td>${x.reg.rows.filter(r => r.status === 'due').map(r => r.month.slice(0, 3)).join(', ') || '—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="5">Total</td><td class="num">${fmt(totalPaid)}</td><td class="num">${fmt(totalDue)}</td><td></td></tr></tfoot></table>
    <div class="foot">Printed ${escH(printed)} · ${items.length} ledger${items.length === 1 ? '' : 's'} follow, one per page.</div>
  </section>`

  const pages = items.map(({ student: s, entries, reg }) => {
    const mRows = [
      ...(reg.admission ? [`<tr><td class="hand">Admission</td><td>Admission Fee</td><td class="num">${fmt(reg.admission.expected)}</td><td class="num">${reg.admission.paidAmt ? fmt(reg.admission.paidAmt) : '—'}</td><td>${escH(reg.admission.paid[0] ? fmtDate(reg.admission.paid[0].date) : '—')}</td><td>${escH(reg.admission.paid.map(x => x.receipt).filter(Boolean).join(', ') || '—')}</td><td class="${reg.admission.due ? 'bad' : 'ok'}">${reg.admission.due ? `DUE ₹${fmt(reg.admission.due)}` : 'PAID'}</td></tr>`] : []),
      ...reg.rows.map(r => `<tr><td class="hand">${r.month.slice(0, 3)} ${r.year}</td><td>${r.head}</td><td class="num">${fmt(r.expected)}</td><td class="num">${r.paidAmt ? fmt(r.paidAmt) : '—'}</td><td>${escH(r.paid[0] ? fmtDate(r.paid[0].date) : '—')}</td><td>${escH(r.paid.map(x => x.receipt).filter(Boolean).join(', ') || '—')}</td><td class="${r.status === 'due' ? 'bad' : r.status === 'paid' || r.status === 'advance' ? 'ok' : r.status === 'short' ? 'warn' : 'muted'}">${STATUS_LABEL[r.status]}${r.status === 'due' ? ` ₹${fmt(r.due)}` : r.status === 'short' ? ` ₹${fmt(r.shortBy)}` : ''}</td></tr>`),
      ...reg.other.map(x => `<tr><td class="hand">${x.kind === 'advance' ? 'Advance' : 'Kit'}</td><td>${escH(x.particulars)}</td><td class="num">—</td><td class="num">${fmt(x.amount)}</td><td>${escH(fmtDate(x.date))}</td><td>${escH(x.receipt || '—')}</td><td class="ok">PAID</td></tr>`),
    ].join('')
    const book = entries.filter(x => x.session === session)
    let run = 0
    const bRows = book.map((x, i) => `<tr><td>${i + 1}</td><td>${escH(fmtDate(x.date))}</td><td>${escH(x.receipt || '—')}</td><td>${escH(x.particulars)}</td><td>${escH(x.period)}</td><td>${escH(x.mode || '—')}</td><td class="num">${fmt(x.amount)}</td><td class="num">${fmt((run += x.amount))}</td></tr>`).join('')
    return `<section class="page">
      <div class="inst">Guidance Navodaya &amp; Sainik Institute · Fee Collection Register</div>
      <h2>${escH(s.name)} <small>GCC-${escH(s.gcc_no)} · Session ${escH(shortSession(session))}</small></h2>
      <div class="f"><div><b>Adm. No.</b>${escH(s.admission_no || '—')}</div><div><b>Course</b>${escH([s.course, s.batch].filter(Boolean).join(' · ') || '—')}</div><div><b>Hostel</b>${escH(s.hostel_type || '—')}</div><div><b>Admitted</b>${escH(fmtDate(s.admission_date))}</div><div><b>Paid this session</b>₹${fmt(reg.totalPaid)}</div><div><b>Balance due</b><span class="${reg.totalDue ? 'bad' : 'ok'}">₹${fmt(reg.totalDue)}</span></div></div>
      <table><thead><tr><th>Month</th><th>Fee head</th><th class="num">Due (₹)</th><th class="num">Paid (₹)</th><th>Date</th><th>Receipt</th><th>Status</th></tr></thead><tbody>${mRows}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${fmt(reg.totalPaid)}</td><td colspan="2" style="text-align:right">Balance due</td><td class="num">₹${fmt(reg.totalDue)}</td></tr></tfoot></table>
      ${includeDayBook ? `<h3>Day book</h3><table><thead><tr><th>#</th><th>Date</th><th>Receipt</th><th>Particulars</th><th>For</th><th>Mode</th><th class="num">Amount (₹)</th><th class="num">Progressive (₹)</th></tr></thead><tbody>${bRows || '<tr><td colspan="8" class="muted">No payments this session.</td></tr>'}</tbody></table>` : ''}
      <div class="sig"><span>Printed ${escH(printed)}</span><div>Accounts Office</div></div>
    </section>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escH(title)} — ${escH(shortSession(session))}</title><style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@600&family=Caveat:wght@600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f2a44;background:#ece7db;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{background:#fffdf6;width:277mm;max-width:100%;margin:14px auto;padding:12mm 12mm 10mm 20mm;position:relative;box-shadow:0 10px 30px rgba(0,0,0,.12);page-break-after:always;break-after:page}
  .page:last-child{page-break-after:auto;break-after:auto}
  .page:before{content:'';position:absolute;top:0;bottom:0;left:12mm;width:3px;border-left:1.2px solid rgba(192,57,43,.6);border-right:1.2px solid rgba(192,57,43,.6)}
  .inst{font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}
  h1{font-family:'Playfair Display',serif;color:#1d3a78;font-size:22px;margin:3px 0 12px}h2{font-family:'Playfair Display',serif;color:#1d3a78;font-size:19px;margin:3px 0 8px}h2 small{font-family:'Plus Jakarta Sans';font-size:11px;color:#6b7690;font-weight:700;margin-left:8px}
  h3{font-family:'Playfair Display',serif;color:#1d3a78;font-size:13.5px;margin:12px 0 4px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.kpis div{border:1px solid #e6dcc3;border-radius:8px;padding:8px 10px;background:#fff}.kpis b,.f b{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b7690}.kpis span{font-family:'Playfair Display',serif;font-size:18px;font-weight:700}
  .f{display:grid;grid-template-columns:repeat(6,1fr);gap:4px 14px;border-bottom:2px solid #1d3a78;padding-bottom:7px;margin-bottom:6px;font-size:11.5px}
  table{width:100%;border-collapse:collapse;font-size:10.5px}th{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#1d3a78;text-align:left;padding:4px 6px;border-top:1.3px solid #1d3a78;border-bottom:1.3px solid #1d3a78;background:#f3f6fd}
  td{padding:3.5px 6px;border-bottom:1px solid #c9d6ee}td+td,th+th{border-left:1px solid #dde5f3}.num{text-align:right;font-family:'JetBrains Mono',monospace}.hand{font-family:'Caveat',cursive;font-size:14px;color:#1d3a78}
  tfoot td{font-weight:800;border-top:1.3px solid #1d3a78;border-bottom:3px double #1d3a78;background:#f7f4ea}
  .ok{color:#146c3a;font-weight:700}.bad{color:#b42318;font-weight:700}.warn{color:#9a5b00;font-weight:700}.muted{color:#9aa3b5}
  .sig{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;font-size:9.5px;color:#6b7690}.sig div{border-top:1px solid #1f2a44;padding-top:3px;width:160px;text-align:center}
  .foot{margin-top:10px;font-size:10px;color:#6b7690}
  .np{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:10px;background:#0b1e3d}.np button{padding:9px 22px;border-radius:999px;border:none;font-weight:800;cursor:pointer;background:#E2C57E;color:#0b1e3d}
  @page{size:A4 landscape;margin:8mm}@media print{body{background:#fff}.np{display:none}.page{box-shadow:none;margin:0;width:auto;padding:4mm 4mm 4mm 14mm}}
  </style></head><body><div class="np"><button onclick="window.print()">🖨 Print ${items.length + 1} page${items.length ? 's' : ''}</button><button onclick="window.close()" style="background:#fff">Close</button></div>${summary}${pages}</body></html>`
  const w = win && !win.closed ? win : window.open('', '_blank', 'width=1200,height=900')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

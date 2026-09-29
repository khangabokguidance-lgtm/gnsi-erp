// feeBooks.js — institute-wide fee books for the Student Fee Ledger:
//   • Day Book — every receipt taken in a date range, grouped by day
//   • Monthly Fee Ledger — every student × April→March register grid
// Built on the same model as each student's own ledger (feeLedgerModel.js).
import { gccStr } from './feeEngine'
import { fmt, fmtDate, escH, shortSession, toEntries } from './feeLedgerModel'
import { instNameHTML } from './systemSettings'

export const HEAD = { admission: 'Admission', item: 'Kit / Items', advance: 'Advance', course: 'Course Fee', flat: 'Flat Fee' }
export const localISO = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

// Every payment (all students, active or not — money received is money
// received) with its student attached, oldest first.
export function allEntries(students, rows) {
  const byGcc = new Map(students.map(s => [gccStr(s.gcc_no), s]))
  const gccs = new Set([...rows.adm.keys(), ...rows.flat.keys(), ...rows.crs.keys()])
  const out = []
  for (const g of gccs) {
    const any = (rows.adm.get(g) || rows.flat.get(g) || rows.crs.get(g) || [])[0] || {}
    const st = byGcc.get(g) || { gcc_no: g, name: any.student_name || `GCC-${g}`, admission_no: any.adm_no }
    for (const e of toEntries(st, rows.adm.get(g) || [], rows.flat.get(g) || [], rows.crs.get(g) || [])) out.push({ ...e, student: st, gcc: g })
  }
  return out.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.receipt || '').localeCompare(String(b.receipt || '')))
}

export function dayBook(entries, from, to) {
  const rows = entries.filter(e => e.date && e.date.slice(0, 10) >= from && e.date.slice(0, 10) <= to)
  const sum = xs => xs.reduce((s, x) => s + x.amount, 0)
  const group = key => Object.entries(rows.reduce((m, x) => { const k = key(x) || '—'; m[k] = (m[k] || 0) + x.amount; return m }, {})).sort((a, b) => b[1] - a[1])
  const days = Object.entries(rows.reduce((m, x) => { const d = x.date.slice(0, 10); (m[d] ||= []).push(x); return m }, {}))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, xs]) => ({ date, rows: xs, total: sum(xs), receipts: new Set(xs.map(x => x.receipt).filter(Boolean)).size }))
  return {
    rows, days, total: sum(rows),
    receipts: new Set(rows.map(x => x.receipt).filter(Boolean)).size,
    students: new Set(rows.map(x => x.gcc)).size,
    byMode: group(x => x.mode), byHead: group(x => HEAD[x.kind]), byCollector: group(x => x.by || 'Not recorded'),
  }
}

// ── Print ────────────────────────────────────────────────────────────────────
const CSS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f2a44;padding:14px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inst{font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}h1{font-family:'Playfair Display',serif;color:#1d3a78;font-size:20px;margin:2px 0 10px}
h2{font-family:'Playfair Display',serif;color:#1d3a78;font-size:14px;margin:12px 0 4px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}.kpis div{border:1px solid #e6dcc3;border-radius:8px;padding:6px 9px}.kpis b{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b7690}.kpis span{font-family:'Playfair Display',serif;font-size:16px;font-weight:700}
.split{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px;font-size:10.5px}.split div{border:1px solid #e6dcc3;border-radius:8px;padding:6px 9px}.split p{display:flex;justify-content:space-between;border-bottom:1px dotted #d9d2c2;padding:2px 0}
table{width:100%;border-collapse:collapse;font-size:10px}th{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#1d3a78;text-align:left;padding:4px 5px;border-top:1.3px solid #1d3a78;border-bottom:1.3px solid #1d3a78;background:#f3f6fd}
td{padding:3px 5px;border-bottom:1px solid #d6dff0}td+td,th+th{border-left:1px solid #e3e9f5}.num{text-align:right;font-family:'JetBrains Mono',monospace}
tfoot td,.sub td{font-weight:800;background:#f7f4ea;border-top:1.3px solid #1d3a78}tfoot td{border-bottom:3px double #1d3a78}
.P{color:#146c3a}.D{color:#b42318;font-weight:800}.S{color:#9a5b00}.A{color:#0b5c8a}.U,.B{color:#a0a8b8}
.sig{display:flex;justify-content:space-between;margin-top:22px;font-size:9.5px;color:#6b7690}.sig div{border-top:1px solid #1f2a44;padding-top:3px;width:160px;text-align:center}
.np{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:8px;background:#0b1e3d;margin:-14px -16px 12px}.np button{padding:8px 20px;border-radius:999px;border:none;font-weight:800;cursor:pointer;background:#E2C57E;color:#0b1e3d}
@media print{.np{display:none}}`

function openDoc(title, body, landscape = true) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escH(title)}</title><style>${CSS}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:8mm}</style></head><body><div class="np"><button onclick="window.print()">🖨 Print</button><button onclick="window.close()" style="background:#fff">Close</button></div>${body}</body></html>`
  const w = window.open('', '_blank', 'width=1200,height=900')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.write(html); w.document.close()
}

const range = (from, to) => from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`

export function printDayBook(book, from, to) {
  const list = pairs => pairs.map(([k, v]) => `<p><span>${escH(k)}</span><b>₹${fmt(v)}</b></p>`).join('') || '<p>—</p>'
  let n = 0
  const days = book.days.map(d => d.rows.map(x => `<tr><td>${++n}</td><td>${escH(fmtDate(x.date))}</td><td>${escH(x.receipt || '—')}</td><td>${escH(x.student.name)}</td><td>${escH(x.gcc)}</td><td>${escH(x.particulars)}</td><td>${escH(x.period)}</td><td>${escH(x.mode || '—')}${x.ref ? ' · ' + escH(x.ref) : ''}</td><td>${escH(x.by || '—')}</td><td class="num">${fmt(x.amount)}</td></tr>`).join('')
    + `<tr class="sub"><td colspan="9">${escH(fmtDate(d.date))} — ${d.rows.length} entr${d.rows.length === 1 ? 'y' : 'ies'}, ${d.receipts} receipt${d.receipts === 1 ? '' : 's'}</td><td class="num">${fmt(d.total)}</td></tr>`).join('')
  openDoc(`Day Book ${range(from, to)}`, `<div class="inst">${instNameHTML()} · Fee Day Book</div><h1>Day Book — ${escH(range(from, to))}</h1>
  <div class="kpis"><div><b>Collected</b><span class="P">₹${fmt(book.total)}</span></div><div><b>Receipts</b><span>${book.receipts}</span></div><div><b>Students</b><span>${book.students}</span></div><div><b>Days</b><span>${book.days.length}</span></div></div>
  <div class="split"><div><h2>By payment mode</h2>${list(book.byMode)}</div><div><h2>By fee head</h2>${list(book.byHead)}</div><div><h2>By collector (cash closing)</h2>${list(book.byCollector)}</div></div>
  <table><thead><tr><th>#</th><th>Date</th><th>Receipt</th><th>Student</th><th>GCC</th><th>Particulars</th><th>For</th><th>Mode / Ref</th><th>Collected by</th><th>Amount (₹)</th></tr></thead><tbody>${days || '<tr><td colspan="10">No receipts in this period.</td></tr>'}</tbody>
  <tfoot><tr><td colspan="9">Total</td><td class="num">${fmt(book.total)}</td></tr></tfoot></table>
  <div class="sig"><span>Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Cashier</div><div>Accounts Office</div></div>`)
}

const CELL = { paid: ['P', '✓'], advance: ['A', 'Adv'], short: ['S', 'Short'], due: ['D', 'DUE'], upcoming: ['U', '·'], before: ['B', '—'] }
export const cellText = r => r.status === 'paid' || r.status === 'advance' || r.status === 'short' ? fmt(r.paidAmt) : r.status === 'due' ? `DUE ${fmt(r.due)}` : r.status === 'upcoming' ? '·' : '—'

export function monthTotals(items) {
  const months = items[0]?.reg.rows.map(r => ({ month: r.month, year: r.year })) || []
  return months.map((m, i) => ({
    ...m,
    collected: items.reduce((s, x) => s + x.reg.rows[i].paidAmt, 0),
    outstanding: items.reduce((s, x) => s + x.reg.rows[i].due, 0),
    paidCount: items.filter(x => ['paid', 'advance', 'short'].includes(x.reg.rows[i].status)).length,
    dueCount: items.filter(x => x.reg.rows[i].status === 'due').length,
  }))
}

export function printMonthlyLedger(items, session, scope) {
  const totals = monthTotals(items)
  const head = totals.map(t => `<th class="num">${t.month.slice(0, 3)} ${String(t.year).slice(2)}</th>`).join('')
  const body = items.map((x, i) => `<tr><td>${i + 1}</td><td>${escH(x.student.name)}<br><small style="color:#6b7690">GCC-${escH(x.student.gcc_no)} · ${escH(x.student.hostel_type || '')}</small></td>
    <td class="num ${x.reg.admission ? (x.reg.admission.due ? 'D' : 'P') : 'B'}">${x.reg.admission ? (x.reg.admission.due ? `DUE ${fmt(x.reg.admission.due)}` : fmt(x.reg.admission.paidAmt)) : '—'}</td>
    ${x.reg.rows.map(r => `<td class="num ${CELL[r.status][0]}">${cellText(r)}</td>`).join('')}
    <td class="num P">${fmt(x.reg.totalPaid)}</td><td class="num ${x.reg.totalDue ? 'D' : 'P'}">${fmt(x.reg.totalDue)}</td></tr>`).join('')
  openDoc(`Monthly Fee Ledger ${shortSession(session)}`, `<div class="inst">${instNameHTML()} · Monthly Fee Ledger</div><h1>Monthly Fee Ledger — Session ${escH(shortSession(session))}${scope ? ' · ' + escH(scope) : ''}</h1>
  <table><thead><tr><th>#</th><th>Student</th><th class="num">Admission</th>${head}<th class="num">Paid</th><th class="num">Due</th></tr></thead><tbody>${body}</tbody>
  <tfoot><tr><td colspan="3">Collected</td>${totals.map(t => `<td class="num P">${fmt(t.collected)}</td>`).join('')}<td class="num">${fmt(items.reduce((s, x) => s + x.reg.totalPaid, 0))}</td><td></td></tr>
  <tr><td colspan="3">Outstanding</td>${totals.map(t => `<td class="num D">${t.outstanding ? fmt(t.outstanding) : '—'}</td>`).join('')}<td></td><td class="num D">${fmt(items.reduce((s, x) => s + x.reg.totalDue, 0))}</td></tr></tfoot></table>
  <div class="sig"><span>✓ amount paid · DUE unpaid · · upcoming · — before admission · Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Accounts Office</div></div>`)
}

// ── Excel ────────────────────────────────────────────────────────────────────
async function saveWorkbook(fill, filename) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook(); wb.creator = 'GNSI ERP'; wb.created = new Date()
  fill(wb)
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const styleHeader = row => { row.font = { bold: true, color: { argb: 'FFFFFFFF' } }; row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3A78' } } }) }

export const exportDayBookExcel = (book, from, to) => saveWorkbook(wb => {
  const ws = wb.addWorksheet('Day book')
  ws.addRow([`Day Book — ${range(from, to)}`]).font = { bold: true, size: 13 }; ws.addRow([])
  styleHeader(ws.addRow(['#', 'Date', 'Receipt', 'Student', 'GCC', 'Particulars', 'For', 'Mode', 'Ref', 'Collected by', 'Amount']))
  book.rows.forEach((x, i) => ws.addRow([i + 1, x.date.slice(0, 10), x.receipt || '', x.student.name, x.gcc, x.particulars, x.period, x.mode || '', x.ref || '', x.by || '', x.amount]))
  ws.addRow(['', '', '', '', '', '', '', '', '', 'Total', book.total]).font = { bold: true }
  ;[5, 12, 16, 24, 8, 30, 16, 10, 14, 16, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w }); ws.getColumn(11).numFmt = '#,##0'
  const sm = wb.addWorksheet('Summary')
  const block = (title, pairs) => { sm.addRow([title]).font = { bold: true }; pairs.forEach(([k, v]) => sm.addRow([k, v])); sm.addRow([]) }
  block('Collected', [['Total', book.total], ['Receipts', book.receipts], ['Students', book.students]])
  block('By payment mode', book.byMode); block('By fee head', book.byHead); block('By collector', book.byCollector)
  block('By day', book.days.map(d => [d.date, d.total]))
  sm.getColumn(1).width = 24; sm.getColumn(2).width = 14; sm.getColumn(2).numFmt = '#,##0'
}, `Day-Book-${from}${from === to ? '' : '_to_' + to}.xlsx`)

export const exportMonthlyExcel = (items, session) => saveWorkbook(wb => {
  const ws = wb.addWorksheet('Monthly ledger')
  const totals = monthTotals(items)
  ws.addRow([`Monthly Fee Ledger — Session ${shortSession(session)}`]).font = { bold: true, size: 13 }; ws.addRow([])
  styleHeader(ws.addRow(['GCC', 'Student', 'Course', 'Batch', 'Hostel', 'Admission', ...totals.map(t => `${t.month.slice(0, 3)} ${t.year}`), 'Paid', 'Due']))
  items.forEach(x => ws.addRow([Number(x.student.gcc_no) || x.student.gcc_no, x.student.name, x.student.course || '', x.student.batch || '', x.student.hostel_type || '',
    x.reg.admission ? (x.reg.admission.due ? `DUE ${x.reg.admission.due}` : x.reg.admission.paidAmt) : '',
    ...x.reg.rows.map(r => r.status === 'due' ? `DUE ${r.due}` : r.paidAmt ? r.paidAmt : r.status === 'upcoming' ? '' : '—'),
    x.reg.totalPaid, x.reg.totalDue]))
  ws.addRow(['', 'Collected', '', '', '', '', ...totals.map(t => t.collected), items.reduce((s, x) => s + x.reg.totalPaid, 0), '']).font = { bold: true }
  ws.addRow(['', 'Outstanding', '', '', '', '', ...totals.map(t => t.outstanding), '', items.reduce((s, x) => s + x.reg.totalDue, 0)]).font = { bold: true }
  ws.getColumn(2).width = 24; ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
}, `Monthly-Fee-Ledger-${shortSession(session)}.xlsx`)

// Reprint one receipt with every line paid on it (same shape as the single-student ledger).
export async function reprintBookReceipt(entries, receiptNo) {
  const lines = entries.filter(x => x.receipt === receiptNo)
  if (!lines.length) return
  const { printFeeReceipt } = await import('./premiumReceipt')
  const first = lines[0], s = first.student
  printFeeReceipt({
    receipt_no: receiptNo, pay_date: first.date, pay_mode: first.mode, txn_ref: first.ref, collected_by: first.by,
    student_name: s.name, adm_no: s.admission_no, gcc_no: s.gcc_no,
    class_name: [s.class_name, s.batch].filter(Boolean).join(' · '), course: s.course, hostel_type: s.hostel_type,
    items: lines.map(x => ({ particulars: x.particulars, period: x.period, category: x.category, amount: x.amount })),
  })
}

// Date presets for the Day Book.
export function presetRange(key, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const iso = localISO
  if (key === 'today') return [iso(d), iso(d)]
  if (key === 'yesterday') { const y = new Date(d); y.setDate(d.getDate() - 1); return [iso(y), iso(y)] }
  if (key === 'week') { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(m), iso(d)] }
  if (key === 'month') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]
  if (key === 'lastmonth') return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]
  return null
}
export const shiftDay = (isoDate, n) => { const [y, m, dd] = isoDate.split('-').map(Number); return localISO(new Date(y, m - 1, dd + n)) }

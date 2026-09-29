// feeLedgerActions.js — print, WhatsApp and Excel actions for the Student Fee Ledger.
import { fmt, fmtDate, escH, shortSession, parentPhone, reminderText } from './feeLedgerModel'
import { nextPayByDate, instNameHTML, instAddressHTML } from './systemSettings'

// ── Actions ──────────────────────────────────────────────────────────────────
export function openWhatsAppReminder(student, reg, session, arrears = []) {
  const text = reminderText(student, reg, session, arrears)
  const phone = parentPhone(student)
  const url = `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener')
  return { phone, text }
}

const PRINT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f2a44;padding:28px 34px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inst{font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}h1{font-family:'Playfair Display',serif;color:#1d3a78;font-size:22px;margin:2px 0 12px}
.hdr{border-bottom:2px solid #1d3a78;padding-bottom:10px;margin-bottom:14px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 18px;font-size:12px}.meta b{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#6b7690;margin-right:6px}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}th{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#1d3a78;text-align:left;padding:6px 7px;border-top:1.5px solid #1d3a78;border-bottom:1.5px solid #1d3a78;background:#f3f6fd}
td{padding:6px 7px;border-bottom:1px solid #c9d6ee}.num{text-align:right;font-family:'JetBrains Mono',monospace}tfoot td{font-weight:800;border-top:1.5px solid #1d3a78;border-bottom:3px double #1d3a78}
p{font-size:13px;line-height:1.7;margin:10px 0}.sig{display:flex;justify-content:space-between;margin-top:44px;font-size:11px;color:#6b7690}.sig div{border-top:1px solid #1f2a44;padding-top:4px;width:190px;text-align:center}
@page{size:A4;margin:12mm}.np{margin-top:16px}@media print{.np{display:none}}`

function openPrint(title, body) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escH(title)}</title><style>${PRINT_CSS}</style></head><body>${body}<div class="np"><button onclick="window.print()">🖨 Print</button></div></body></html>`
  const w = window.open('', '_blank', 'width=920,height=900')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.write(html); w.document.close()
  setTimeout(() => { try { w.focus(); w.print() } catch { /* user can press Print */ } }, 700)
}

const header = (student, title, session) => `<div class="hdr"><div class="inst">${instNameHTML()} · ${instAddressHTML()}</div><h1>${escH(title)}</h1>
<div class="meta"><div><b>Student</b>${escH(student.name)}</div><div><b>GCC No.</b>GCC-${escH(student.gcc_no)}</div><div><b>Adm. No.</b>${escH(student.admission_no || '—')}</div>
<div><b>Course</b>${escH([student.course, student.batch].filter(Boolean).join(' · ') || '—')}</div><div><b>Hostel</b>${escH(student.hostel_type || '—')}</div><div><b>Session</b>${escH(shortSession(session))}</div></div></div>`

export function printStatement(student, st, session, from, to) {
  const period = from || to ? `${from ? fmtDate(from) : 'start'} to ${to ? fmtDate(to) : 'today'}` : `whole session ${shortSession(session)}`
  const rows = st.lines.map(l => `<tr><td>${escH(fmtDate(l.date))}</td><td>${escH(l.particulars)}</td><td>${escH(l.receipt || '')}</td><td class="num">${l.debit ? fmt(l.debit) : ''}</td><td class="num">${l.credit ? fmt(l.credit) : ''}</td><td class="num">${fmt(Math.abs(l.balance))} ${l.balance > 0 ? 'Dr' : l.balance < 0 ? 'Cr' : ''}</td></tr>`).join('')
  openPrint(`Statement — ${student.name}`, `${header(student, 'Statement of Account', session)}
  <div style="font-size:12px;color:#6b7690">Period: ${escH(period)}</div>
  <table><thead><tr><th>Date</th><th>Particulars</th><th>Receipt</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead>
  <tbody><tr><td></td><td><b>Opening balance</b></td><td></td><td></td><td></td><td class="num">${fmt(Math.abs(st.opening))} ${st.opening > 0 ? 'Dr' : st.opening < 0 ? 'Cr' : ''}</td></tr>${rows}</tbody>
  <tfoot><tr><td colspan="3">Closing balance</td><td class="num">${fmt(st.debits)}</td><td class="num">${fmt(st.credits)}</td><td class="num">${fmt(Math.abs(st.closing))} ${st.closing > 0 ? 'Dr' : st.closing < 0 ? 'Cr' : ''}</td></tr></tfoot></table>
  <div class="sig"><span>Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Accounts Office</div></div>`)
}

export function printDuesNotice(student, reg, session, arrears = []) {
  // Unpaid months, the balance of part-paid ones, and earlier sessions' dues.
  const dueRows = reg.rows.filter(r => r.due > 0)
  const items = [
    ...arrears.map(a => [`Brought forward from session ${shortSession(a.session)} (${a.months.join(', ')})`, a.due]),
    ...(reg.admission?.due ? [['Admission fee', reg.admission.due]] : []),
    ...dueRows.map(r => [`${r.head} — ${r.month} ${r.year}${r.status === 'short' ? ' (balance)' : ''}`, r.due]),
  ]
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  // Next fee due day from System Settings → Academic (else one week).
  const dueBy = nextPayByDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const body = items.length
    ? `<p>Date: ${escH(today)}</p><p>To,<br/>${escH(student.father_name || 'The Parent / Guardian')}<br/>of ${escH(student.name)} (GCC-${escH(student.gcc_no)})</p>
       <p><b>Subject: Reminder for pending fees — session ${escH(shortSession(session))}</b></p>
       <p>Dear Parent/Guardian, this is to inform you that the following fees are pending as per our records:</p>
       <table><thead><tr><th>#</th><th>Particulars</th><th>Amount (₹)</th></tr></thead><tbody>${items.map(([l, v], i) => `<tr><td>${i + 1}</td><td>${escH(l)}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody>
       <tfoot><tr><td colspan="2">Total due</td><td class="num">${fmt(items.reduce((t, [, v]) => t + v, 0))}</td></tr></tfoot></table>
       <p>You are kindly requested to clear the dues on or before <b>${escH(dueBy)}</b> at the institute office. Please ignore this notice if the amount has already been paid, and keep the receipt for your records.</p>`
    : `<p>Date: ${escH(today)}</p><p>All fees for ${escH(student.name)} (GCC-${escH(student.gcc_no)}) are paid up to date for session ${escH(shortSession(session))}. Thank you.</p>`
  openPrint(`Dues notice — ${student.name}`, `${header(student, 'Fee Dues Notice', session)}${body}<div class="sig"><div>Accounts Office</div><div>Principal</div></div>`)
}

export async function exportLedgerExcel(student, reg, bookRows, statement, session) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook(); wb.creator = 'GNSI ERP'; wb.created = new Date()
  const title = `${student.name} (GCC-${student.gcc_no}) · Session ${shortSession(session)}`
  const sheet = (name, cols, rows) => {
    const ws = wb.addWorksheet(name)
    ws.addRow([title]).font = { bold: true, size: 13 }
    ws.addRow([])
    const h = ws.addRow(cols.map(c => c[0])); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3A78' } } })
    rows.forEach(r => ws.addRow(r))
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c[1]; if (c[2]) ws.getColumn(i + 1).numFmt = '#,##0' })
    return ws
  }
  sheet('Register', [['Month', 12], ['Fee head', 14], ['Due', 10, 1], ['Paid', 10, 1], ['Date', 14], ['Receipt', 16], ['Status', 16]], [
    ...(reg.admission ? [['Admission', 'Admission Fee', reg.admission.expected, reg.admission.paidAmt, reg.admission.paid[0] ? fmtDate(reg.admission.paid[0].date) : '', reg.admission.paid.map(x => x.receipt).join(', '), reg.admission.due ? 'DUE' : 'PAID']] : []),
    ...reg.rows.map(r => [`${r.month.slice(0, 3)} ${r.year}`, r.head, r.expected, r.paidAmt || null, r.paid[0] ? fmtDate(r.paid[0].date) : '', r.paid.map(x => x.receipt).join(', '), r.status.toUpperCase()]),
    ...reg.other.map(x => ['Kit/Advance', x.particulars, null, x.amount, fmtDate(x.date), x.receipt || '', 'PAID']),
    [], ['Total', '', null, reg.totalPaid, '', 'Balance due', reg.totalDue],
  ])
  sheet('Day book', [['S.No', 6], ['Date', 14], ['Receipt', 16], ['Particulars', 32], ['For', 16], ['Mode', 12], ['Collected by', 16], ['Amount', 12, 1], ['Progressive', 14, 1]],
    bookRows.map((x, i) => [i + 1, fmtDate(x.date), x.receipt || '', x.particulars, x.period, x.mode || '', x.by || '', x.amount, x.running]))
  sheet('Statement', [['Date', 14], ['Particulars', 44], ['Receipt', 16], ['Debit', 12, 1], ['Credit', 12, 1], ['Balance', 14, 1]], [
    ['', 'Opening balance', '', null, null, statement.opening],
    ...statement.lines.map(l => [fmtDate(l.date), l.particulars, l.receipt || '', l.debit || null, l.credit || null, l.balance]),
    ['', 'Closing balance', '', statement.debits, statement.credits, statement.closing],
  ])
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = `Fee-Ledger-GCC-${student.gcc_no}-${shortSession(session)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

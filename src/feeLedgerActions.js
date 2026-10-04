// feeLedgerActions.js — print, WhatsApp and Excel actions for the Student Fee Ledger.
import { fmt, fmtDate, escH, shortSession, parentPhone, reminderText } from './feeLedgerModel'
import { nextPayByDate } from './systemSettings'
import { receiptHeader, infoGrid, receiptSheet, receiptDocument, openReceiptWindow, amountInWords } from './premiumReceipt'

// ── Actions ──────────────────────────────────────────────────────────────────
export function openWhatsAppReminder(student, reg, session, arrears = []) {
  const text = reminderText(student, reg, session, arrears)
  const phone = parentPhone(student)
  const url = `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener')
  return { phone, text }
}

const EXTRA_CSS = `.items td.num,.items th.num{text-align:right}.items td.num{font-family:'JetBrains Mono',monospace}.items tfoot td{background:#F1F5F9;font-weight:800}.letter p{font-size:12.5px;line-height:1.75;margin:8px 0}.foot .sig{min-width:0}`

const studentGrid = (student, session) => infoGrid([
  [['Student Name', escH(student.name), 2], ['GCC No.', `<span class="mono">GCC-${escH(student.gcc_no)}</span>`], ['Admission No.', escH(student.admission_no || '—')]],
  [['Course / Batch', escH([student.course, student.batch].filter(Boolean).join(' · ') || '—'), 2], ['Hostel Type', escH(student.hostel_type || '—')], ['Session', escH(shortSession(session))]],
])

const drCr = n => `${fmt(Math.abs(n))} ${n > 0 ? 'Dr' : n < 0 ? 'Cr' : ''}`

export function printStatement(student, st, session, from, to) {
  const period = from || to ? `${from ? fmtDate(from) : 'start'} to ${to ? fmtDate(to) : 'today'}` : `whole session ${shortSession(session)}`
  const rows = st.lines.map((l, i) => `<tr><td>${escH(fmtDate(l.date))}</td><td style="font-weight:700">${escH(l.particulars)}</td><td>${escH(l.receipt || '')}</td><td class="num">${l.debit ? fmt(l.debit) : ''}</td><td class="num">${l.credit ? fmt(l.credit) : ''}</td><td class="num">${drCr(l.balance)}</td></tr>`).join('')
  const body = `<div class="wrap">
    ${studentGrid(student, session)}
    <div class="words" style="margin-top:10px"><span class="l" style="margin-right:6px">Period:</span><b>${escH(period)}</b></div>
    <table class="items"><thead><tr><th style="width:90px">Date</th><th>Particulars</th><th style="width:110px">Receipt</th><th class="num" style="width:90px">Debit (₹)</th><th class="num" style="width:90px">Credit (₹)</th><th class="num" style="width:110px">Balance (₹)</th></tr></thead>
    <tbody><tr><td></td><td><b>Opening balance</b></td><td></td><td></td><td></td><td class="num">${drCr(st.opening)}</td></tr>${rows}</tbody>
    <tfoot><tr><td colspan="3">Closing balance</td><td class="num">${fmt(st.debits)}</td><td class="num">${fmt(st.credits)}</td><td class="num">${drCr(st.closing)}</td></tr></tfoot></table>
    <div class="foot"><div class="note" style="font-style:italic">This is a computer-generated statement.</div>
      <div class="sig"><div class="line"></div><div class="who">Accounts Office</div><div class="l">Authorised signatory</div></div></div>
  </div>`
  const title = `Statement — ${student.name}`
  openReceiptWindow(title, receiptDocument(title, receiptSheet(receiptHeader('STATEMENT OF ACCOUNT', `SESSION ${shortSession(session)}`) + body), { extraCss: EXTRA_CSS, printLabel: '🖨 Print statement' }))
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
  const total = items.reduce((t, [, v]) => t + v, 0)
  const content = items.length
    ? `<div class="letter"><p>Date: ${escH(today)}</p><p>To,<br/>${escH(student.father_name || 'The Parent / Guardian')}<br/>of ${escH(student.name)} (GCC-${escH(student.gcc_no)})</p>
       <p><b>Subject: Reminder for pending fees — session ${escH(shortSession(session))}</b></p>
       <p>Dear Parent/Guardian, this is to inform you that the following fees are pending as per our records:</p></div>
       <table class="items"><thead><tr><th style="width:40px">Sl.</th><th>Particulars</th><th class="num" style="width:130px">Amount (₹)</th></tr></thead><tbody>${items.map(([l, v], i) => `<tr><td>${i + 1}</td><td style="font-weight:700">${escH(l)}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody>
       <tfoot><tr><td colspan="2">Total due</td><td class="num">${fmt(total)}</td></tr></tfoot></table>
       <div class="words"><span class="l" style="margin-right:6px">Amount in words:</span><b>${amountInWords(total)}</b></div>
       <div class="letter"><p>You are kindly requested to clear the dues on or before <b>${escH(dueBy)}</b> at the institute office. Please ignore this notice if the amount has already been paid, and keep the receipt for your records.</p></div>`
    : `<div class="letter"><p>Date: ${escH(today)}</p><p>All fees for ${escH(student.name)} (GCC-${escH(student.gcc_no)}) are paid up to date for session ${escH(shortSession(session))}. Thank you.</p></div>`
  const body = `<div class="wrap">${studentGrid(student, session)}<div style="margin-top:10px">${content}</div>
    <div class="foot" style="padding-top:40px"><div class="sig"><div class="line"></div><div class="who">Accounts Office</div><div class="l">Prepared by</div></div>
      <div class="sig"><div class="line"></div><div class="who">Principal</div><div class="l">Authorised signatory</div></div></div></div>`
  const title = `Dues notice — ${student.name}`
  openReceiptWindow(title, receiptDocument(title, receiptSheet(receiptHeader('FEE DUES NOTICE', items.length ? 'PAYMENT PENDING' : 'NO DUES') + body), { extraCss: EXTRA_CSS, printLabel: '🖨 Print notice' }))
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

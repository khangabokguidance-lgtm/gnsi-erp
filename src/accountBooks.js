// accountBooks.js — books built from the Accounts ledger (`accounts` table):
//   • Expenditure Day Book — every confirmed expense in a date range
//   • Income & Expenditure Register (Cash Book) — receipts and payments side
//     by side, day by day, with opening/closing balance, plus an Income &
//     Expenditure summary (surplus / deficit) by head.
// Fee collections post into `accounts` (feeEngine.upsertAccount), so income
// here is every fee, store sale and manual income entry.
import { supabase } from './supabase'
import { fetchAllPages } from './StudyMaterialBridge'
import { fmt, fmtDate, escH } from './feeLedgerModel'
import { instNameHTML } from './systemSettings'

// Same rule as Accounts.jsx: absent status = legacy Confirmed; anything but
// 'Confirmed' (Pending, Void, …) is not real money.
export const isConfirmed = e => e.status == null || e.status === '' || e.status === 'Confirmed'
// Income counts on the day the money actually came in; expenses on their entry date.
export const bookDate = e => String((e.type === 'Income' ? e.payment_date || e.entry_date : e.entry_date) || '').slice(0, 10)
export const isCash = e => String(e.mode ?? e.payment_mode ?? '').toLowerCase() === 'cash'

export async function loadAccountRows() {
  const [a, v, p] = await Promise.all([
    fetchAllPages(() => supabase.from('accounts').select('*').eq('is_soft_deleted', false).order('id', { ascending: true })),
    supabase.from('vendors').select('id,name'),
    supabase.from('payers').select('id,name'),
  ])
  if (a.error) throw new Error(`Could not load accounts: ${a.error.message}`)
  return { rows: a.data || [], vendors: new Map((v.data || []).map(x => [x.id, x.name])), payers: new Map((p.data || []).map(x => [x.id, x.name])) }
}

// Normalise rows once: confirmed only, with the book date, party and head.
export function normalise(rows, { vendors = new Map(), payers = new Map() } = {}) {
  return (rows || []).filter(e => !e.is_soft_deleted && isConfirmed(e) && Number(e.amount) > 0 && (e.type === 'Income' || e.type === 'Expense'))
    .map(e => ({
      id: e.id, type: e.type, date: bookDate(e), amount: Number(e.amount) || 0,
      head: e.category || 'Uncategorised', sub: e.sub_category || '',
      party: (e.type === 'Expense' ? vendors.get(e.vendor_id) : payers.get(e.payer_id)) || e.voucher_head || '',
      mode: e.payment_mode || '', account: e.account_type || '', by: e.added_by || '',
      note: e.note || e.description || '', voucher: e.voucher_head || '', source: e.source_type || '', receipt: e.receipt_url || '',
    }))
    .filter(e => e.date)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
}

const sum = xs => xs.reduce((s, x) => s + x.amount, 0)
const groupSum = (xs, key) => Object.entries(xs.reduce((m, x) => { const k = key(x) || '—'; m[k] = (m[k] || 0) + x.amount; return m }, {})).sort((a, b) => b[1] - a[1])
const byDay = xs => Object.entries(xs.reduce((m, x) => { (m[x.date] ||= []).push(x); return m }, {})).sort((a, b) => a[0].localeCompare(b[0]))

export function expenseBook(entries, from, to) {
  const rows = entries.filter(e => e.type === 'Expense' && e.date >= from && e.date <= to)
  return {
    rows, total: sum(rows), count: rows.length,
    days: byDay(rows).map(([date, xs]) => ({ date, rows: xs, total: sum(xs) })),
    byHead: groupSum(rows, x => x.head), byMode: groupSum(rows, x => x.mode), byParty: groupSum(rows, x => x.party || 'Not recorded'),
    byBy: groupSum(rows, x => x.by || 'Not recorded'), byAccount: groupSum(rows, x => x.account),
  }
}

// money: 'all' | 'cash' | 'bank' — which money the running balance tracks.
export function cashBook(entries, from, to, money = 'all') {
  const pool = entries.filter(e => money === 'all' || (money === 'cash' ? isCash(e) : !isCash(e)))
  const signed = e => e.type === 'Income' ? e.amount : -e.amount
  const opening = pool.filter(e => e.date < from).reduce((s, e) => s + signed(e), 0)
  const inRange = pool.filter(e => e.date >= from && e.date <= to)
  let bal = opening
  const days = byDay(inRange).map(([date, xs]) => {
    const receipts = xs.filter(x => x.type === 'Income'), payments = xs.filter(x => x.type === 'Expense')
    const open = bal, r = sum(receipts), p = sum(payments)
    bal = open + r - p
    return { date, receipts, payments, open, in: r, out: p, close: bal }
  })
  const income = inRange.filter(e => e.type === 'Income'), expense = inRange.filter(e => e.type === 'Expense')
  return {
    opening, closing: bal, days, totalIn: sum(income), totalOut: sum(expense),
    incomeByHead: groupSum(income, x => x.head), expenseByHead: groupSum(expense, x => x.head),
    inByMode: groupSum(income, x => x.mode), outByMode: groupSum(expense, x => x.mode),
  }
}

// ── Print ────────────────────────────────────────────────────────────────────
const CSS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f2a44;padding:14px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inst{font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}h1{font-family:'Playfair Display',serif;color:#1d3a78;font-size:20px;margin:2px 0 10px}
h2{font-family:'Playfair Display',serif;color:#1d3a78;font-size:13px;margin:10px 0 4px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}.kpis div{border:1px solid #e6dcc3;border-radius:8px;padding:6px 9px}.kpis b{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b7690}.kpis span{font-family:'Playfair Display',serif;font-size:16px;font-weight:700}
.split{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px;font-size:10.5px}.split div{border:1px solid #e6dcc3;border-radius:8px;padding:6px 9px}.split p{display:flex;justify-content:space-between;border-bottom:1px dotted #d9d2c2;padding:2px 0}
table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px}th{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#1d3a78;text-align:left;padding:4px 5px;border-top:1.3px solid #1d3a78;border-bottom:1.3px solid #1d3a78;background:#f3f6fd}
td{padding:3px 5px;border-bottom:1px solid #d6dff0;vertical-align:top}td+td,th+th{border-left:1px solid #e3e9f5}.num{text-align:right;font-family:'JetBrains Mono',monospace;white-space:nowrap}
tfoot td,.sub td{font-weight:800;background:#f7f4ea;border-top:1.3px solid #1d3a78}tfoot td{border-bottom:3px double #1d3a78}
.in{color:#146c3a}.out{color:#b42318}.muted{color:#6b7690}
.day{page-break-inside:avoid;margin-bottom:8px}.dayh{display:flex;justify-content:space-between;font-weight:800;background:#0b1e3d;color:#fff;padding:4px 8px;border-radius:5px 5px 0 0;font-size:10.5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0}.two table{margin:0}.two>div+div{border-left:2px solid #1d3a78}
.sig{display:flex;justify-content:space-between;margin-top:22px;font-size:9.5px;color:#6b7690}.sig div{border-top:1px solid #1f2a44;padding-top:3px;width:160px;text-align:center}
.np{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:8px;background:#0b1e3d;margin:-14px -16px 12px}.np button{padding:8px 20px;border-radius:999px;border:none;font-weight:800;cursor:pointer;background:#E2C57E;color:#0b1e3d}
@media print{.np{display:none}}`
function openDoc(title, body, landscape = false) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escH(title)}</title><style>${CSS}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:8mm}</style></head><body><div class="np"><button onclick="window.print()">🖨 Print</button><button onclick="window.close()" style="background:#fff">Close</button></div>${body}</body></html>`
  const w = window.open('', '_blank', 'width=1100,height=900')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.write(html); w.document.close()
}
const range = (from, to) => from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
const list = pairs => pairs.map(([k, v]) => `<p><span>${escH(k)}</span><b>₹${fmt(v)}</b></p>`).join('') || '<p>—</p>'
const head = () => `<div class="inst">${instNameHTML()}</div>`
const bal = v => v < 0 ? `(${fmt(-v)})` : fmt(v)
export const MONEY_LABEL = { all: 'All money (cash + bank)', cash: 'Cash in hand', bank: 'Bank / UPI / Card' }

export function printExpenseBook(book, from, to) {
  let n = 0
  const body = book.days.map(d => d.rows.map(x => `<tr><td>${++n}</td><td>${escH(fmtDate(x.date))}</td><td>${escH(x.head)}${x.sub ? ' › ' + escH(x.sub) : ''}</td><td>${escH(x.party || '—')}</td><td>${escH(x.note)}</td><td>${escH(x.mode)}</td><td>${escH(x.account)}</td><td>${escH(x.by || '—')}</td><td class="num">${fmt(x.amount)}</td></tr>`).join('')
    + `<tr class="sub"><td colspan="8">${escH(fmtDate(d.date))} — ${d.rows.length} entr${d.rows.length === 1 ? 'y' : 'ies'}</td><td class="num">${fmt(d.total)}</td></tr>`).join('')
  openDoc(`Expenditure Day Book ${range(from, to)}`, `${head()}<h1>Expenditure Day Book — ${escH(range(from, to))}</h1>
  <div class="kpis"><div><b>Spent</b><span class="out">₹${fmt(book.total)}</span></div><div><b>Entries</b><span>${book.count}</span></div><div><b>Days</b><span>${book.days.length}</span></div><div><b>Heads</b><span>${book.byHead.length}</span></div></div>
  <div class="split"><div><h2>By head</h2>${list(book.byHead)}</div><div><h2>By payment mode</h2>${list(book.byMode)}</div><div><h2>By paid to</h2>${list(book.byParty.slice(0, 12))}</div></div>
  <table><thead><tr><th>#</th><th>Date</th><th>Head</th><th>Paid to</th><th>Particulars</th><th>Mode</th><th>Account</th><th>Entered by</th><th>Amount (₹)</th></tr></thead><tbody>${body || '<tr><td colspan="9">No expenditure in this period.</td></tr>'}</tbody>
  <tfoot><tr><td colspan="8">Total expenditure</td><td class="num">${fmt(book.total)}</td></tr></tfoot></table>
  <div class="sig"><span>Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Accountant</div><div>Principal / Director</div></div>`, true)
}

export function printCashBook(cb, from, to, money) {
  const side = (xs, cls) => `<table><thead><tr><th>Particulars</th><th>Mode</th><th>Amount</th></tr></thead><tbody>${xs.map(x => `<tr><td>${escH(x.head)}${x.party ? ` <span class="muted">· ${escH(x.party)}</span>` : ''}${x.note ? `<br><span class="muted">${escH(x.note)}</span>` : ''}</td><td>${escH(x.mode)}</td><td class="num ${cls}">${fmt(x.amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>'}</tbody></table>`
  const days = cb.days.map(d => `<div class="day"><div class="dayh"><span>${escH(fmtDate(d.date))}</span><span>Opening ₹${bal(d.open)} · In ₹${fmt(d.in)} · Out ₹${fmt(d.out)} · Closing ₹${bal(d.close)}</span></div>
    <div class="two"><div><h2 class="in" style="padding:0 5px">Receipts (Income)</h2>${side(d.receipts, 'in')}</div><div><h2 class="out" style="padding:0 5px">Payments (Expenditure)</h2>${side(d.payments, 'out')}</div></div></div>`).join('')
  const maxN = Math.max(cb.incomeByHead.length, cb.expenseByHead.length)
  const ie = Array.from({ length: maxN }, (_, i) => { const a = cb.incomeByHead[i], b = cb.expenseByHead[i]; return `<tr><td>${a ? escH(a[0]) : ''}</td><td class="num in">${a ? fmt(a[1]) : ''}</td><td>${b ? escH(b[0]) : ''}</td><td class="num out">${b ? fmt(b[1]) : ''}</td></tr>` }).join('')
  const net = cb.totalIn - cb.totalOut
  openDoc(`Income & Expenditure Register ${range(from, to)}`, `${head()}<h1>Income &amp; Expenditure Register — ${escH(range(from, to))}</h1>
  <div class="muted" style="margin:-6px 0 8px;font-size:10.5px">Balance tracks: ${escH(MONEY_LABEL[money])}</div>
  <div class="kpis"><div><b>Opening balance</b><span>₹${bal(cb.opening)}</span></div><div><b>Income</b><span class="in">₹${fmt(cb.totalIn)}</span></div><div><b>Expenditure</b><span class="out">₹${fmt(cb.totalOut)}</span></div><div><b>Closing balance</b><span>₹${bal(cb.closing)}</span></div></div>
  <h2>Income &amp; Expenditure account</h2>
  <table><thead><tr><th>Income head</th><th class="num">₹</th><th>Expenditure head</th><th class="num">₹</th></tr></thead><tbody>${ie || '<tr><td colspan="4" class="muted">No entries.</td></tr>'}</tbody>
  <tfoot><tr><td>Total income</td><td class="num">${fmt(cb.totalIn)}</td><td>Total expenditure</td><td class="num">${fmt(cb.totalOut)}</td></tr>
  <tr><td colspan="3">${net >= 0 ? 'Surplus (income over expenditure)' : 'Deficit (expenditure over income)'}</td><td class="num ${net >= 0 ? 'in' : 'out'}">${fmt(Math.abs(net))}</td></tr></tfoot></table>
  <h2>Day-wise register</h2>${days || '<p class="muted">No entries in this period.</p>'}
  <div class="sig"><span>Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Accountant</div><div>Principal / Director</div></div>`)
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
const header = (ws, cells) => { const r = ws.addRow(cells); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3A78' } } }) }
const fname = (base, from, to) => `${base}-${from}${from === to ? '' : '_to_' + to}.xlsx`

export const exportExpenseExcel = (book, from, to) => saveWorkbook(wb => {
  const ws = wb.addWorksheet('Expenditure')
  ws.addRow([`Expenditure Day Book — ${range(from, to)}`]).font = { bold: true, size: 13 }; ws.addRow([])
  header(ws, ['#', 'Date', 'Head', 'Sub-head', 'Paid to', 'Particulars', 'Mode', 'Account', 'Entered by', 'Amount'])
  book.rows.forEach((x, i) => ws.addRow([i + 1, x.date, x.head, x.sub, x.party, x.note, x.mode, x.account, x.by, x.amount]))
  ws.addRow(['', '', '', '', '', '', '', '', 'Total', book.total]).font = { bold: true }
  ;[5, 12, 16, 14, 20, 32, 10, 12, 16, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w }); ws.getColumn(10).numFmt = '#,##0'
  const sm = wb.addWorksheet('Summary')
  const block = (t, pairs) => { sm.addRow([t]).font = { bold: true }; pairs.forEach(p => sm.addRow(p)); sm.addRow([]) }
  block('By head', book.byHead); block('By payment mode', book.byMode); block('By paid to', book.byParty); block('By day', book.days.map(d => [d.date, d.total]))
  sm.getColumn(1).width = 26; sm.getColumn(2).width = 14; sm.getColumn(2).numFmt = '#,##0'
}, fname('Expenditure-Day-Book', from, to))

export const exportCashBookExcel = (cb, from, to, money) => saveWorkbook(wb => {
  const ws = wb.addWorksheet('Register')
  ws.addRow([`Income & Expenditure Register — ${range(from, to)} (${MONEY_LABEL[money]})`]).font = { bold: true, size: 13 }; ws.addRow([])
  header(ws, ['Date', 'Type', 'Head', 'Party', 'Particulars', 'Mode', 'Account', 'Receipts', 'Payments', 'Balance'])
  ws.addRow(['', 'Opening balance', '', '', '', '', '', '', '', cb.opening]).font = { bold: true }
  for (const d of cb.days) {
    let b = d.open
    for (const x of [...d.receipts, ...d.payments]) {
      b += x.type === 'Income' ? x.amount : -x.amount
      ws.addRow([x.date, x.type === 'Income' ? 'Receipt' : 'Payment', x.head, x.party, x.note, x.mode, x.account, x.type === 'Income' ? x.amount : '', x.type === 'Expense' ? x.amount : '', b])
    }
    ws.addRow([d.date, 'Day total', '', '', '', '', '', d.in, d.out, d.close]).font = { bold: true }
  }
  ws.addRow(['', 'Closing balance', '', '', '', '', '', cb.totalIn, cb.totalOut, cb.closing]).font = { bold: true }
  ;[12, 14, 18, 18, 30, 10, 12, 12, 12, 13].forEach((w, i) => { ws.getColumn(i + 1).width = w }); [8, 9, 10].forEach(c => { ws.getColumn(c).numFmt = '#,##0' })
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  const ie = wb.addWorksheet('Income & Expenditure')
  header(ie, ['Income head', 'Amount', '', 'Expenditure head', 'Amount'])
  const n = Math.max(cb.incomeByHead.length, cb.expenseByHead.length)
  for (let i = 0; i < n; i++) ie.addRow([...(cb.incomeByHead[i] || ['', '']), '', ...(cb.expenseByHead[i] || ['', ''])])
  ie.addRow(['Total income', cb.totalIn, '', 'Total expenditure', cb.totalOut]).font = { bold: true }
  const net = cb.totalIn - cb.totalOut
  ie.addRow([net >= 0 ? 'Surplus' : 'Deficit', Math.abs(net)]).font = { bold: true }
  ie.getColumn(1).width = 24; ie.getColumn(4).width = 24; ie.getColumn(2).numFmt = '#,##0'; ie.getColumn(5).numFmt = '#,##0'
}, fname('Income-Expenditure-Register', from, to))

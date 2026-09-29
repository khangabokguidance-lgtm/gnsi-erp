// receiptHistory.js — the "fee position" block printed on every fee receipt:
// the session's month-wise status (April → March), the previous month, the
// student's recent earlier payments with who received them, and the balance
// still due after this receipt. Built with the same model as the Student Fee
// Ledger (feeLedgerModel.js), so a receipt never disagrees with the ledger.
import { supabase } from './supabase'
import { getFeeRates, gccStr } from './feeEngine'
import { toEntries, buildRegister, sessionOfDate } from './feeLedgerModel'
import { loadStudentHistory, sessionRates } from './hostelHistory'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export async function loadReceiptHistory(d) {
  const gcc = gccStr(d.gcc_no)
  if (!gcc || gcc === '--') return null
  const [st, a, f, c] = await Promise.all([
    supabase.from('students').select('*').eq('gcc_no', gcc).limit(1),
    supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false),
    supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false),
    supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false),
  ])
  if (a.error || f.error || c.error) return null // never print a wrong history — leave the block out
  const student = { gcc_no: gcc, course: d.course, hostel_type: d.hostel_type, ...(st.data?.[0] || {}) }
  const payDate = String(d.pay_date || new Date().toISOString()).slice(0, 10)
  // A snapshot as of the receipt date: a reprinted old receipt shows the
  // position on that day, not today's.
  const entries = toEntries(student, a.data || [], f.data || [], c.data || []).filter(e => !e.date || String(e.date).slice(0, 10) <= payDate)
  const session = sessionOfDate(payDate)
  const changes = await loadStudentHistory(gcc)
  const rates = await sessionRates(student, session, changes, type => getFeeRates(session, student.course || '', student.batch || '', type, gcc))
  const [py, pmo, pdd] = payDate.split('-').map(Number)
  const reg = buildRegister(student, entries, session, rates, new Date(py, pmo - 1, pdd, 23, 59, 59))

  const thisRcpt = d.receipt_no
  const onThis = new Set(entries.filter(e => thisRcpt && e.receipt === thisRcpt && e.month).map(e => `${e.month} ${e.year}`))
  const months = reg.rows.map(r => ({ month: r.month, year: r.year, status: r.status, paidAmt: r.paidAmt, due: r.due, shortBy: r.shortBy, thisReceipt: onThis.has(`${r.month} ${r.year}`) }))

  // Previous month = the calendar month before the payment date.
  const pd = new Date(py, pmo - 1, pdd)
  const pm = new Date(pd.getFullYear(), pd.getMonth() - 1, 1)
  const pmName = MONTHS[pm.getMonth()], pmYear = pm.getFullYear()
  const pmRow = reg.rows.find(r => r.month === pmName && Number(r.year) === pmYear)
  const pmPaid = entries.filter(e => e.month === pmName && Number(e.year) === pmYear && (e.kind === 'course' || e.kind === 'flat'))
  const previousMonth = {
    label: `${pmName} ${pmYear}`,
    status: pmRow ? pmRow.status : pmPaid.length ? 'paid' : 'unknown',
    paidAmt: pmPaid.reduce((s, e) => s + e.amount, 0),
    due: pmRow?.due || 0, shortBy: pmRow?.shortBy || 0,
    payments: pmPaid.map(e => ({ date: e.date, receipt: e.receipt, amount: e.amount, by: e.by })),
  }

  // Earlier receipts (one line per receipt), newest first.
  const byRcpt = new Map()
  for (const e of entries) {
    if (!e.receipt || e.receipt === thisRcpt) continue
    const r = byRcpt.get(e.receipt) || { receipt: e.receipt, date: e.date, amount: 0, by: e.by, mode: e.mode, periods: [] }
    r.amount += e.amount
    r.periods.push(e.month ? `${e.month.slice(0, 3)} ${e.year}` : e.particulars)
    byRcpt.set(e.receipt, r)
  }
  const previous = [...byRcpt.values()].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 5)

  return { session, months, previousMonth, previous, dueAfter: reg.totalDue, dueMonths: reg.rows.filter(r => r.due > 0).map(r => `${r.month.slice(0, 3)} ${r.year}${r.status === 'short' ? ' (bal.)' : ''}`), sessionPaid: reg.totalPaid }
}

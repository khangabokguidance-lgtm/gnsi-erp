// incomeCollection.js — pure maths for the "Income vs Collection" tab: why Accounts' Total Income and the fee
// tables' actual collection differ for a period. Matching is by receipt number, which every fee payment writes
// into its Accounts row's note ("… · GNSI-1234"). No Supabase here so it can be unit-tested.

export const FEE_SOURCES = new Set(['adm_fee', 'flat_fee', 'course_fee', 'advance_fee', 'fee_payment'])
const num = v => Number(v) || 0
const sum = xs => xs.reduce((s, x) => s + num(x.amount), 0)
const d10 = v => String(v || '').slice(0, 10)
const isConfirmed = e => e.status == null || e.status === '' || e.status === 'Confirmed'
export const receiptIn = note => (String(note || '').split(' · ').map(s => s.trim()).find(p => /^[A-Z]{2,}[-/]\S+$/.test(p)) || null)
const inRange = (d, from, to) => !!d && (!from || d >= from) && (!to || d <= to)

// accounts: Income rows incl. soft-deleted ones. adm/flat/course: non-reverted fee rows (flat: paid only).
// Fee rows are { amount, receipt_no, pay_date, student_name, adm_app_id, kind }.
export function reconcileIncomeCollection({ accounts = [], feePayments = [], from, to }) {
  const income = accounts.filter(a => a.type == null || a.type === 'Income')
  const paidOn = a => d10(a.payment_date || a.entry_date)
  const live = income.filter(a => !a.is_soft_deleted)
  const confirmed = live.filter(isConfirmed)
  const inPeriod = confirmed.filter(a => inRange(paidOn(a), from, to))
  const feeAcc = inPeriod.filter(a => FEE_SOURCES.has(a.source_type))
  const other = inPeriod.filter(a => !FEE_SOURCES.has(a.source_type))
  const split = {
    store: sum(other.filter(a => a.source_type === 'store_sale')),
    manual: sum(other.filter(a => !a.source_type)),
    other: sum(other.filter(a => a.source_type && a.source_type !== 'store_sale')),
  }

  const fees = feePayments.filter(p => inRange(d10(p.pay_date), from, to))
  const noReceipt = fees.filter(p => !p.receipt_no)
  const byReceipt = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r) } return m }
  const feeByR = byReceipt(fees, p => p.receipt_no)
  // Accounts rows for the same receipts, whatever their date or state — used to explain a miss.
  const allAccByR = byReceipt(income.filter(a => FEE_SOURCES.has(a.source_type)), a => receiptIn(a.note))
  const feeAccByR = byReceipt(feeAcc, a => receiptIn(a.note))

  const missing = [], deleted = [], pending = [], moved = [], mismatch = []
  for (const [r, rows] of feeByR) {
    const fAmt = sum(rows), accRows = feeAccByR.get(r)
    const first = rows[0], base = { receipt: r, name: first.student_name || '—', gcc: first.adm_app_id || '', date: d10(first.pay_date), fee: fAmt }
    if (accRows) {
      const aAmt = sum(accRows)
      if (Math.abs(aAmt - fAmt) > 0.5) mismatch.push({ ...base, accounts: aAmt, diff: aAmt - fAmt })
      continue
    }
    const any = allAccByR.get(r) || []
    if (!any.length) missing.push({ ...base, reason: 'No Accounts entry was ever written for this receipt' })
    else if (any.every(a => a.is_soft_deleted)) deleted.push({ ...base, reason: 'The Accounts entry was deleted' })
    else if (any.some(a => !a.is_soft_deleted && !isConfirmed(a))) pending.push({ ...base, reason: 'The Accounts entry is waiting for approval' })
    else moved.push({ ...base, reason: `Accounts dates it ${paidOn(any[0])} (outside this period)` })
  }
  // Accounts fee rows with no matching fee payment in the period.
  const orphan = []
  for (const a of feeAcc) {
    const r = receiptIn(a.note)
    if (r && feeByR.has(r)) continue
    orphan.push({ id: a.id, receipt: r || '', amount: num(a.amount), date: paidOn(a), source: a.source_type, note: a.note || '',
      reason: r ? 'No fee payment with this receipt falls in the period (reverted, or dated differently in Fees)' : 'No receipt number — cannot be matched to a fee payment' })
  }
  const pendingAll = live.filter(a => !isConfirmed(a) && inRange(paidOn(a), from, to))

  const feeTotal = sum(fees.map(p => ({ amount: p.amount })))
  return {
    accountsTotal: sum(inPeriod), accountsFee: sum(feeAcc), accountsOther: sum(other), split,
    feeTotal, feeCount: fees.length, gap: feeTotal - sum(feeAcc),
    noReceipt: { rows: noReceipt, total: sum(noReceipt) },
    missing, deleted, pending, moved, mismatch, orphan,
    totals: {
      missing: sum(missing.map(m => ({ amount: m.fee }))), deleted: sum(deleted.map(m => ({ amount: m.fee }))),
      pending: sum(pending.map(m => ({ amount: m.fee }))), moved: sum(moved.map(m => ({ amount: m.fee }))),
      mismatch: sum(mismatch.map(m => ({ amount: m.diff }))), orphan: sum(orphan),
    },
    pendingAllTotal: sum(pendingAll), pendingAllCount: pendingAll.length,
  }
}

// registerExcess.js — money collected above what a month's fee was, shown in the fee register.
// A month paid with MORE than its due used to read as a plain "PAID"; staff could not see the extra.
// Waived/concession amounts count towards the due, so only a real overpayment is flagged.
const TOL = 0.5

/** ₹ collected above the month's due (0 when paid exactly, short, or not yet paid). */
export function rowExcess(r) {
  if (!r || r.status !== 'paid') return 0
  const over = Number(r.paidAmt || 0) - Number(r.expected || 0)
  return over > TOL ? Math.round(over * 100) / 100 : 0
}

/** Total excess across a register's month rows, and how many months it covers. */
export function registerExcess(reg) {
  const rows = (reg?.rows || []).map(rowExcess).filter(x => x > 0)
  return { total: Math.round(rows.reduce((s, x) => s + x, 0) * 100) / 100, months: rows.length }
}

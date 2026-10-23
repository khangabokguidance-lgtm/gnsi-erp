// monthwiseDues.js — pure helpers for the Fee Dashboard's Month-wise Dues card.

// What the month card owes for one register row, net of concession; 0 for months that are not chargeable yet.
export function monthlyOwed(r) {
  if (!r || r.status === 'before' || r.status === 'upcoming' || !(r.expected > 0)) return null
  const expected = Math.max(0, r.expected - (r.waived || 0))
  const due = r.status === 'due' ? r.due : (sh => (sh >= 0.5 ? sh : 0))(r.expected - r.paidAmt - (r.waived || 0))
  return { expected, paid: r.paidAmt, due }
}

// Dues written off (Refunds & Transfers → "Write-off dues") are a credit against the session's balance, not
// against a particular month. Spread them oldest month first, then the admission fee, so each month and the
// admission part show what is still really owed. Returns { byMonth: Map('Month|year' → amount), adm }.
export function writeOffShares(reg, writtenOff) {
  let left = Math.max(0, Number(writtenOff) || 0)
  const byMonth = new Map()
  for (const r of reg?.rows || []) {
    if (left <= 0) break
    const m = monthlyOwed(r)
    if (!m || m.due <= 0) continue
    const take = Math.min(left, m.due)
    byMonth.set(`${r.month}|${r.year}`, take); left -= take
  }
  const adm = Math.min(left, Math.max(0, reg?.admission?.due || 0))
  return { byMonth, adm: adm > 0 ? adm : 0 }
}

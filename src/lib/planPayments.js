// planPayments.js — apply fee payments to an instalment plan (pure).
// Each instalment keeps `payments: [{ ref, amount, date, receipt }]` next to the
// existing paid_amount / paid_date / receipt_no, so a payment can be taken off
// again if its fee row is reverted. `ref` is the fee row id.
const r2 = v => Math.round(v * 100) / 100
const owed = i => Math.max(0, r2(Number(i.amount) - Number(i.paid_amount || 0)))
export const planDone = installments => installments.every(i => owed(i) < 0.01)

// Fill the oldest unpaid instalments first. Money beyond the plan stays unapplied.
// The same ref is never applied twice.
export function applyPaymentToPlan(installments, { ref, amount, date, receipt }) {
  if (installments.some(i => (i.payments || []).some(p => p.ref === ref))) return { installments, applied: 0 }
  let left = Number(amount) || 0, applied = 0
  const next = [...installments].sort((a, b) => a.no - b.no).map(i => {
    const take = Math.min(left, owed(i))
    if (!(take > 0)) return i
    left = r2(left - take); applied = r2(applied + take)
    return { ...i, paid_amount: r2(Number(i.paid_amount || 0) + take), paid_date: date, receipt_no: receipt || i.receipt_no || null,
      payments: [...(i.payments || []), { ref, amount: take, date, receipt: receipt || null }] }
  })
  return { installments: next, applied }
}

// Take back whatever a reverted fee row had paid into the plan.
export function removePaymentFromPlan(installments, ref) {
  let removed = 0
  const next = installments.map(i => {
    const mine = (i.payments || []).filter(p => p.ref === ref)
    if (!mine.length) return i
    const amt = mine.reduce((t, p) => t + p.amount, 0)
    removed = r2(removed + amt)
    const rest = i.payments.filter(p => p.ref !== ref)
    const last = rest[rest.length - 1]
    return { ...i, paid_amount: Math.max(0, r2(Number(i.paid_amount || 0) - amt)), payments: rest,
      paid_date: last?.date || null, receipt_no: last?.receipt || null }
  })
  return { installments: next, removed }
}

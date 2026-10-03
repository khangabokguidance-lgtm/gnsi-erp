// standingMath.js — pure helpers for standing concessions (fee_concession_register)
// and instalment plans. No imports, so they can be unit-tested directly.

const monthStart = (month, year) => new Date(`${month} 1, ${year}`)

// How much of a month's fee is waived by the student's standing concessions.
// entries: that student's fee_concession_register rows. head: 'course' | 'flat'.
export function standingWaiver(entries, month, year, head, expected) {
  const exp = Number(expected) || 0
  if (!entries?.length || exp <= 0) return 0
  const ms = monthStart(month, year)
  if (Number.isNaN(ms.getTime())) return 0
  let total = 0
  for (const e of entries) {
    if (e.status && e.status !== 'active') continue
    if (e.applies_to && e.applies_to !== 'both' && e.applies_to !== 'all' && e.applies_to !== head) continue
    const from = e.valid_from ? new Date(String(e.valid_from).slice(0, 7) + '-01T00:00:00') : null
    const to = e.valid_to ? new Date(String(e.valid_to).slice(0, 10) + 'T00:00:00') : null
    if (from && ms < from) continue
    if (to && ms > to) continue
    const v = Number(e.value) || 0
    if (e.basis === 'percent') total += exp * Math.min(v, 100) / 100
    else if (e.basis === 'one_time') { if (from && ms.getFullYear() === from.getFullYear() && ms.getMonth() === from.getMonth()) total += v }
    else total += v   // fixed_per_month
  }
  return Math.min(exp, Math.round(total * 100) / 100)
}

// Summary of one student's instalment plan relative to a date.
export function planState(plan, todayStr) {
  if (!plan || plan.status !== 'active') return null
  const inst = Array.isArray(plan.installments) ? plan.installments : []
  const open = inst.filter(i => !(Number(i.paid_amount) >= Number(i.amount) - 0.5))
  if (!open.length) return null
  const next = open.map(i => i.due_date).filter(Boolean).sort()[0] || null
  return { planId: plan.id, nextDue: next, overdue: !!next && next < todayStr, openCount: open.length, openAmount: open.reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0) }
}

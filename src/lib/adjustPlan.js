// adjustPlan.js — turns an admin's choices in the Fee adjustments panel into
// rows for the concession register (fee_concession_register). Pure; unit-tested.
//
// The register is already honoured everywhere dues are worked out (ledger, register
// book, dues lists, receipts) through standingMath.standingWaiver, so a discount or a
// waiver recorded here changes a month's due without touching any payment.
import { consecutiveRuns, monthEnd } from './courseHistory.js'
import { MONTH_IDX } from './courseHistory.js'

const MONTH_NAMES = Object.keys(MONTH_IDX)
export const monthKey = (month, year) => `${year}-${String(MONTH_IDX[month]).padStart(2, '0')}`
export const keyLabel = k => { const [y, m] = k.split('-').map(Number); return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}` }
const lastDayOf = k => { const [y, m] = k.split('-').map(Number); return monthEnd(MONTH_NAMES[m - 1], y) }

// The reason text stored with an entry: the chosen reason, plus the staff name for a
// staff ward and any note. Returns { kind, reason } or { error }.
export function reasonText({ kind, staffName = '', note = '' }) {
  if (!kind) return { error: 'Choose a reason.' }
  const name = String(staffName || '').trim()
  if (kind === 'Staff ward' && !name) return { error: 'Enter the name of the staff (required for Staff ward).' }
  const reason = [kind === 'Staff ward' ? `Staff ward: ${name}` : kind, String(note || '').trim()].filter(Boolean).join(' — ')
  return { kind, reason }
}

// DISCOUNT on chosen months: a percentage or a fixed ₹ off each month's fee.
// monthKeys: ['2026-10', ...]. appliesTo: 'course' | 'flat' | 'both'. One register row per run of
// consecutive months (valid_from first of the first month … valid_to last day of the last).
export function planDiscount({ student, monthKeys, basis, value, appliesTo = 'both', kind, staffName, note, by }) {
  if (!monthKeys?.length) return { error: 'Select at least one month.' }
  const v = Number(value)
  if (!(v > 0)) return { error: 'Enter the discount.' }
  if (basis === 'percent' && v > 100) return { error: 'A percentage cannot be more than 100.' }
  if (basis !== 'percent' && basis !== 'fixed_per_month') return { error: 'Choose percent or fixed amount.' }
  const r = reasonText({ kind, staffName, note })
  if (r.error) return r
  const rows = consecutiveRuns(monthKeys).map(run => ({
    gcc: String(student.gcc_no), student_name: student.name || null, kind: r.kind, basis, value: v, applies_to: appliesTo,
    valid_from: run.from, valid_to: lastDayOf(run.to.slice(0, 7)), reason: r.reason, approved_by: by || 'Admin', status: 'active',
  }))
  return { rows }
}

// WAIVE the due of chosen months (financial condition etc.): a one-time concession of the given ₹ in each month.
// items: [{ key:'2026-10', amount }] — amount is that month's due (or part of it).
export function planWaiver({ student, items, kind = 'Financial hardship', staffName, note, by }) {
  const live = (items || []).filter(i => Number(i.amount) > 0)
  if (!live.length) return { error: 'Select at least one month that has a due to waive.' }
  const r = reasonText({ kind, staffName, note })
  if (r.error) return r
  return {
    rows: live.map(i => ({
      gcc: String(student.gcc_no), student_name: student.name || null, kind: r.kind, basis: 'one_time', value: Math.round(Number(i.amount) * 100) / 100, applies_to: 'both',
      valid_from: `${i.key}-01`, valid_to: lastDayOf(i.key), reason: r.reason, approved_by: by || 'Admin', status: 'active',
    })),
    total: live.reduce((t, i) => t + Number(i.amount), 0),
  }
}

// What a discount would take off a month whose fee is `expected` (mirrors standingWaiver for one entry).
export const discountOf = (expected, basis, value) => {
  const e = Number(expected) || 0, v = Number(value) || 0
  return Math.min(e, Math.round((basis === 'percent' ? e * Math.min(v, 100) / 100 : v) * 100) / 100)
}

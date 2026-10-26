// amountFinder.js — "who pays ₹X?": find every student with fee payments of an exact amount.
// Pure (unit-tested). Rows are the raw fee rows the Fees module already loads:
//   course fee  adm_course_fees { adm_app_id (GCC), amount_paid, for_month, year, receipt_no, pay_date }
//   flat fee    adm_flat_fees   { adm_app_id (GCC), amount, month, year, receipt_no, pay_date }
const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }

export const gccKeyOf = v => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? String(n) : '' }

/** "April"+2026 → "2026-2027"; "February"+2027 → "2026-2027" (session runs April–March). */
export function sessionOfMonth(month, year) {
  const m = MONTH_NUM[month], y = Number(year)
  if (!m || !y) return ''
  const s = m >= 4 ? y : y - 1
  return `${s}-${s + 1}`
}

const norm = (kind, r) => kind === 'course'
  ? { kind, gcc: gccKeyOf(r.adm_app_id), amount: Number(r.amount_paid) || 0, month: r.for_month, year: r.year, receipt: r.receipt_no || '', date: r.pay_date || '' }
  : { kind, gcc: gccKeyOf(r.adm_app_id), amount: Number(r.amount) || 0, month: r.month, year: r.year, receipt: r.receipt_no || '', date: r.pay_date || '' }

/**
 * @param students  student rows (need gcc_no)
 * @param rows      { crs: Map|Array, flat: Map|Array } — as returned by loadAllFeeRows (Map gcc → rows) or plain arrays
 * @param amount    exact ₹ amount to look for
 * @param kind      'all' | 'course' | 'flat'
 * @param session   '' for every session, or '2026-2027'
 * @returns [{ student, matches: [...], payments: n }] — most matching months first
 */
export function findStudentsByAmount({ students, rows, amount, kind = 'all', session = '' }) {
  const target = Number(amount)
  if (!Number.isFinite(target) || target <= 0) return []
  const flatten = x => x instanceof Map ? [...x.values()].flat() : (x || [])
  const all = [
    ...(kind === 'flat' ? [] : flatten(rows?.crs).map(r => norm('course', r))),
    ...(kind === 'course' ? [] : flatten(rows?.flat).map(r => norm('flat', r))),
  ].filter(p => p.gcc && p.amount > 0 && (!session || sessionOfMonth(p.month, p.year) === session))

  const byGcc = new Map((students || []).map(s => [gccKeyOf(s.gcc_no), s]))
  const groups = new Map()
  for (const p of all) {
    if (!byGcc.has(p.gcc)) continue
    const g = groups.get(p.gcc) || { student: byGcc.get(p.gcc), matches: [], payments: 0 }
    g.payments++
    if (Math.abs(p.amount - target) < 0.5) g.matches.push(p)
    groups.set(p.gcc, g)
  }
  return [...groups.values()].filter(g => g.matches.length).sort((a, b) => b.matches.length - a.matches.length || String(a.student.name).localeCompare(String(b.student.name)))
}

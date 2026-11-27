// courseLedger.js — pure helpers for the Course-wise Fee Ledger tab: each
// student's billed / paid / due for the whole session or one month, a payment
// status (paid / partial / unpaid), course-wise totals and the search that also
// matches receipt numbers. Works on the items buildAllLedgers() returns, so the
// figures agree with the Monthly Fee Ledger and each student's own register.
import { netRows } from './monthwiseDues.js'
import { courseOf, canonicalBatch, COURSE_ORDER } from '../courseMap.js'

// Course used for grouping: the resolved course, or the saved one if unknown.
export const ledgerCourse = s => { const c = courseOf(s); return c === 'Unassigned' ? (String(s?.course || '').trim() || 'Unassigned') : c }
export const ledgerBatch = s => canonicalBatch(s?.batch) || 'No batch'

export const STATUS_LABEL = { paid: 'Fully paid', partial: 'Partly paid', due: 'Unpaid', na: 'Not due yet' }

const statusOf = (billed, paid, due) => due > 0.5 ? (paid > 0 ? 'partial' : 'due') : billed > 0 || paid > 0 ? 'paid' : 'na'

// One student's figures. month = index into the April → March rows, or null for the whole session
// (this session's dues plus earlier sessions' dues brought forward, as on the Monthly Fee Ledger).
export function ledgerFigures(x, month = null) {
  if (month === null || month === undefined || month === '') {
    const paid = Number(x.reg?.totalPaid) || 0
    const due = (Number(x.reg?.totalDue) || 0) + (Number(x.arrears) || 0)
    const billed = paid + due
    const dueMonths = netRows(x.reg).filter(r => r.due > 0).map(r => `${r.month.slice(0, 3)}${r.status === 'short' ? ' (bal.)' : ''}`)
    if (x.reg?.admission?.due > 0) dueMonths.unshift('Admission')
    if (x.arrears > 0) dueMonths.unshift('b/f')
    return { billed, paid, due, status: statusOf(billed, paid, due), dueMonths }
  }
  const r = netRows(x.reg)[Number(month)]
  if (!r || r.status === 'before' || (r.status === 'upcoming' && !r.paidAmt)) return { billed: 0, paid: 0, due: 0, status: 'na', dueMonths: [] }
  const billed = r.expected, paid = r.paidAmt, due = r.due
  return { billed, paid, due, status: statusOf(billed, paid, due), dueMonths: due > 0 ? [`${r.month.slice(0, 3)}${r.status === 'short' ? ' (bal.)' : ''}`] : [] }
}

// status filter: 'all' | 'paid' | 'partial' | 'due' (nothing paid) | 'owing' (partial + unpaid)
export function statusMatches(status, filter) {
  if (!filter || filter === 'all') return true
  if (filter === 'owing') return status === 'partial' || status === 'due'
  return status === filter
}

// Name, GCC no., admission no., father's name — or any receipt number on the student's account.
export function matchesSearch(x, q) {
  const t = String(q || '').trim().toLowerCase()
  if (!t) return true
  const s = x.student || {}
  if ([s.name, s.gcc_no, `gcc-${s.gcc_no}`, s.admission_no, s.father_name].some(v => String(v ?? '').toLowerCase().includes(t))) return true
  return (x.entries || []).some(e => String(e.receipt || '').toLowerCase().includes(t))
}

// Totals per course, in the standard course order (others after, alphabetically).
// rows: [{ x, f }] where f = ledgerFigures(x, month).
export function courseTotals(rows) {
  const m = new Map()
  for (const row of rows) {
    const c = ledgerCourse(row.x.student)
    if (!m.has(c)) m.set(c, { course: c, students: 0, billed: 0, paid: 0, due: 0, withDues: 0 })
    const t = m.get(c)
    t.students++; t.billed += row.f.billed; t.paid += row.f.paid; t.due += row.f.due
    if (row.f.due > 0.5) t.withDues++
  }
  const rank = c => { const i = COURSE_ORDER.indexOf(c); return i < 0 ? COURSE_ORDER.length : i }
  return [...m.values()].sort((a, b) => rank(a.course) - rank(b.course) || a.course.localeCompare(b.course))
}

export const sumFigures = rows => rows.reduce((t, { f }) => ({ billed: t.billed + f.billed, paid: t.paid + f.paid, due: t.due + f.due, withDues: t.withDues + (f.due > 0.5 ? 1 : 0) }), { billed: 0, paid: 0, due: 0, withDues: 0 })

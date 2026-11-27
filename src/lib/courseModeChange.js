// courseModeChange.js — pure helpers for the Fees → "Course / Mode Change" tab:
// the session's months, the fee impact preview and plain-language labels.

const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']
const NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }

// April → March of a session '2026-2027' (or '2026-27'): [{ value: '2026-04-01', label: 'April 2026' }, …]
export function sessionMonths(session) {
  const start = Number(String(session || '').slice(0, 4))
  if (!start) return []
  return MONTHS.map(m => {
    const y = NUM[m] >= 4 ? start : start + 1
    return { value: `${y}-${String(NUM[m]).padStart(2, '0')}-01`, label: `${m} ${y}` }
  })
}

export const monthLabel = ymd => {
  const m = /^(\d{4})-(\d{2})/.exec(String(ymd || ''))
  if (!m) return '—'
  const name = Object.keys(NUM).find(k => NUM[k] === Number(m[2]))
  return `${name} ${m[1]}`
}

const num = v => Math.round(Number(v) || 0)

// now / next: { courseFee, flatFee } a month. Months affected = the session's months
// from effectiveFrom to March. Returns figures for the preview and the printed form.
export function feeImpact({ now, next, effectiveFrom, session }) {
  const months = sessionMonths(session).filter(m => m.value >= String(effectiveFrom || '9999'))
  const before = { course: num(now?.courseFee), flat: num(now?.flatFee) }
  const after = { course: num(next?.courseFee), flat: num(next?.flatFee) }
  before.total = before.course + before.flat
  after.total = after.course + after.flat
  const perMonth = after.total - before.total
  return {
    monthsAffected: months.length,
    firstMonth: months[0]?.label || '',
    lastMonth: months[months.length - 1]?.label || '',
    before, after, perMonth,
    total: perMonth * months.length,
  }
}

// "Boarder → Day Scholar" / "Foundation · Udaan → Foundation · Pragati"
export const courseText = (course, batch) => [course, batch && batch !== '—' ? batch : ''].filter(Boolean).join(' · ') || '—'
export function changeLines(r) {
  const out = []
  if (r.to_type) out.push({ what: 'Hostel type', from: r.from_type || '—', to: r.to_type })
  if (r.to_course) out.push({ what: 'Course / batch', from: courseText(r.from_course, r.from_batch), to: courseText(r.to_course, r.to_batch) })
  return out
}

export const STATUS = {
  pending: { label: 'Waiting for admin approval', color: '#9a5b00', bg: '#fff4dc' },
  approved: { label: 'Approved', color: '#146c3a', bg: '#e7f6ec' },
  rejected: { label: 'Rejected', color: '#b42318', bg: '#fde8e6' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: '#f1f5f9' },
}

// Validate the form before sending. Returns '' when fine.
export function validateRequest({ student, toType, toCourse, toBatch, effectiveFrom, reason }) {
  if (!student) return 'Choose a student.'
  const curType = student.hostel_type || 'Day Scholar'
  const typeChanges = !!toType && toType !== curType
  const courseChanges = !!toCourse && (toCourse !== (student.course || '') || (toBatch || student.batch || '') !== (student.batch || ''))
  if (!typeChanges && !courseChanges) return 'Choose a new hostel type or a new course / batch.'
  if (!/^\d{4}-\d{2}-01$/.test(effectiveFrom || '')) return 'Choose the month the change starts.'
  if (String(reason || '').trim().length < 3) return 'Give a reason for the change.'
  return ''
}

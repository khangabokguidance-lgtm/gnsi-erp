// courseHistory.js — pure helpers for a mid-session COURSE change (and the
// month planning shared with hostel-type changes). No imports; unit-tested.
//
// A student can move to another course/batch during a session. Each change keeps
// the month it takes effect, so months before it stay at the OLD course's rates
// (past payments and dues unchanged) and months from it use the new course.
// students.course / students.batch always hold the CURRENT course.

export const MONTH_IDX = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
export const SESSION_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']

export const monthStart = (month, year) => `${year}-${String(MONTH_IDX[month] || 1).padStart(2, '0')}-01`
export const monthEnd = (month, year) => { const d = new Date(Date.UTC(Number(year), (MONTH_IDX[month] || 1), 0)); return d.toISOString().slice(0, 10) }
// Calendar year of a session month: April–December fall in the session's first year, January–March in the next.
export const yearOfSessionMonth = (month, sessionStartYear) => (MONTH_IDX[month] >= 4 ? Number(sessionStartYear) : Number(sessionStartYear) + 1)
export const nextMonthStart = iso => { const [y, m] = String(iso).slice(0, 7).split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` }

const byDate = (a, b) => String(a.effective_from).localeCompare(String(b.effective_from)) || String(a.created_at || '').localeCompare(String(b.created_at || ''))
export const sortChanges = list => [...(list || [])].sort(byDate)

// The course/batch in effect for a fee month. `current` is true when it is the
// student's present course (so live Fee Setup rates apply, not a stored one).
export function courseOnMonth(student, changes, month, year) {
  const cur = { course: student?.course || '', batch: student?.batch || '', current: true }
  if (!changes?.length) return cur
  const ms = monthStart(month, year)
  let idx = -1
  changes.forEach((c, i) => { if (String(c.effective_from).slice(0, 10) <= ms) idx = i })
  if (idx === -1) return { course: changes[0].from_course || cur.course, batch: changes[0].from_batch || '', current: false }
  if (idx === changes.length - 1) return cur
  return { course: changes[idx].to_course || cur.course, batch: changes[idx].to_batch || '', current: false }
}

// Segments for display: [{ course, batch, from: iso|null, to: iso|null }]
export function courseTimeline(student, changes) {
  if (!changes?.length) return [{ course: student?.course || '', batch: student?.batch || '', from: null, to: null }]
  const segs = [{ course: changes[0].from_course, batch: changes[0].from_batch || '', from: null, to: changes[0].effective_from }]
  changes.forEach((c, i) => segs.push({ course: i === changes.length - 1 ? (student?.course || c.to_course) : c.to_course, batch: i === changes.length - 1 ? (student?.batch || c.to_batch || '') : (c.to_batch || ''), from: c.effective_from, to: changes[i + 1]?.effective_from || null }))
  return segs
}

// Distinct non-current "course|batch" segments used by a session's months (their rates are fetched once each).
export function otherCoursesInSession(student, changes, sessionStartYear, months = SESSION_MONTHS) {
  const out = new Map()
  for (const m of months) {
    const c = courseOnMonth(student, changes, m, yearOfSessionMonth(m, sessionStartYear))
    if (!c.current) out.set(`${c.course}|${c.batch}`, { course: c.course, batch: c.batch })
  }
  return [...out.values()]
}

// ── Planning ─────────────────────────────────────────────────────────────────
// Validate a change of course. Returns an error string or ''.
export function validateCourseChange({ student, toCourse, toBatch, effectiveFrom, changes = [] }) {
  if (!toCourse) return 'Choose the new course.'
  if (String(toCourse) === String(student?.course || '') && String(toBatch || '') === String(student?.batch || '')) return `${student?.name || 'The student'} is already in this course and batch.`
  if (!/^\d{4}-\d{2}-01$/.test(effectiveFrom || '')) return 'Choose the month the new course starts.'
  const last = changes[changes.length - 1]
  if (last && String(effectiveFrom) < String(last.effective_from).slice(0, 10)) return `The last course change took effect on ${String(last.effective_from).slice(0, 10)} — a new change can't start before it.`
  return ''
}

// Plan a hostel type change for months. `until` (a 'YYYY-MM-01', optional) makes it
// TEMPORARY: the new type applies from `from` through the `until` month, then the
// student goes back to their current type. Returns [{ toType, effectiveFrom }] in
// the order they must be saved, or { error }.
export function planHostelRange({ currentType, toType, from, until = '' }) {
  if (!toType) return { error: 'Choose the new hostel type.' }
  if (toType === currentType) return { error: `The student is already a ${toType}.` }
  if (!/^\d{4}-\d{2}-01$/.test(from || '')) return { error: 'Choose the month the new hostel type starts.' }
  if (!until) return { steps: [{ toType, effectiveFrom: from }] }
  if (!/^\d{4}-\d{2}-01$/.test(until)) return { error: 'Choose the last month of the temporary change.' }
  if (until < from) return { error: 'The last month cannot be before the first month.' }
  return { steps: [{ toType, effectiveFrom: from }, { toType: currentType, effectiveFrom: nextMonthStart(until) }] }
}

// Group a set of 'YYYY-MM' month keys into runs of consecutive months: [{ from:'YYYY-MM-01', to:'YYYY-MM-01' }].
export function consecutiveRuns(keys) {
  const sorted = [...new Set(keys)].sort()
  const runs = []
  for (const k of sorted) {
    const iso = `${k}-01`
    const last = runs[runs.length - 1]
    if (last && nextMonthStart(last.to) === iso) last.to = iso
    else runs.push({ from: iso, to: iso })
  }
  return runs
}

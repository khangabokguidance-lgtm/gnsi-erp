// concessionPlan.js — pure helpers for the Concession / Special Fee tab: a lower
// fee for a student in the SAME course (sibling, staff ward, scholarship, merit,
// hardship …). Entries live in fee_concession_register; the fee engine applies
// active ones month by month (lib/standingMath.js). No imports, unit-tested.

export const KINDS = ['Sibling', 'Staff ward', 'Scholarship-merit', 'Financial hardship', 'Management', 'Other']

// How the lower fee is worked out.
export const BASES = [
  ['fixed_per_month', 'Less ₹ every month'],
  ['percent', 'Less a percentage'],
  ['fixed_fee', 'Pays a special fee of ₹ a month'],
  ['one_time', 'One-time ₹ off'],
]
export const BASIS_SHORT = { fixed_per_month: 'Less ₹/month', percent: 'Percent off', fixed_fee: 'Special fee', one_time: 'One-time' }
export const APPLIES = [['course', 'Course fee'], ['flat', 'Flat (hostel / day) fee'], ['both', 'Course + flat fee']]
export const appliesLabel = v => (APPLIES.find(a => a[0] === v) || [0, v === 'all' ? 'All fees' : v || '—'])[1]

export const STATUS = {
  pending:  { label: 'Waiting for approval', color: '#9a5b00', bg: '#fff4dc' },
  active:   { label: 'Approved · active',    color: '#166534', bg: '#dcfce7' },
  expiring: { label: 'Ends within 30 days',  color: '#92400e', bg: '#fef3c7' },
  expired:  { label: 'Ended',                color: '#4b5563', bg: '#e5e7eb' },
  rejected: { label: 'Rejected',             color: '#991b1b', bg: '#fee2e2' },
  revoked:  { label: 'Cancelled',            color: '#991b1b', bg: '#fee2e2' },
}

const r2 = n => Math.round((Number(n) || 0) * 100) / 100
const pad = n => String(n).padStart(2, '0')
export const dayOf = v => String(v || '').slice(0, 10)
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 'YYYY-MM' → first / last day of that month.
export const monthStartOf = ym => (/^\d{4}-\d{2}$/.test(ym || '') ? `${ym}-01` : '')
export function monthEndOf(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) return ''
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${pad(new Date(y, m, 0).getDate())}`
}
export function monthLabel(d) {
  const s = dayOf(d)
  if (!s) return 'open (no end)'
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// One head's fee after the concession. std = the standard monthly fee for that head.
export function feeAfter(entry, std) {
  const s = Number(std) || 0, v = Number(entry?.value) || 0
  if (s <= 0) return 0
  switch (entry?.basis) {
    case 'percent': return r2(Math.max(0, s - s * Math.min(v, 100) / 100))
    case 'fixed_fee': return r2(Math.min(s, Math.max(0, v)))
    case 'fixed_per_month': return r2(Math.max(0, s - v))
    default: return s   // one_time: the monthly fee is unchanged
  }
}

const hits = (entry, head) => !entry?.applies_to || entry.applies_to === 'both' || entry.applies_to === 'all' || entry.applies_to === head

// Before / after for the course fee and the flat fee, given the standard rates
// { course, flat } for the student's course, batch and hostel type.
export function feeImpact(entry, rates) {
  const head = h => {
    const std = r2(rates?.[h])
    return { std, after: hits(entry, h) ? feeAfter(entry, std) : std }
  }
  const course = head('course'), flat = head('flat')
  return {
    course, flat,
    perMonth: r2(course.std - course.after),          // course fee is charged every month
    flatLess: r2(flat.std - flat.after),              // flat fee: only in its own months
    oneTime: entry?.basis === 'one_time' ? r2(entry.value) : 0,
  }
}

// A ₹0 fee for a head the concession covers.
export function isFullWaiver(entry, rates) {
  const v = Number(entry?.value) || 0
  if (entry?.basis === 'percent') return v >= 100
  if (entry?.basis === 'fixed_fee') return v <= 0
  if (entry?.basis === 'fixed_per_month' && rates) {
    const heads = ['course', 'flat'].filter(h => hits(entry, h) && Number(rates[h]) > 0)
    return heads.length > 0 && heads.some(h => v >= Number(rates[h]) - 0.5)
  }
  return false
}

// form: { student, kind, basis, value, applies_to, from (YYYY-MM), to (YYYY-MM|''), reason }
export function validateRequest(f, rates = null) {
  if (!f?.student) return 'Pick the student.'
  if (!KINDS.includes(f.kind)) return 'Pick a reason category.'
  if (!BASES.some(b => b[0] === f.basis)) return 'Pick how the lower fee is worked out.'
  const v = Number(f.value)
  if (f.value === '' || f.value === null || !Number.isFinite(v) || v < 0) return 'Enter the amount.'
  if (f.basis !== 'fixed_fee' && v <= 0) return 'The amount must be more than 0.'
  if (f.basis === 'percent' && v > 100) return 'A percentage can be at most 100.'
  if (f.basis === 'fixed_fee' && f.applies_to === 'both') return 'A special fee is set for one fee at a time — pick Course fee or Flat fee.'
  if (f.basis === 'fixed_fee' && rates) {
    const std = Number(rates[f.applies_to === 'flat' ? 'flat' : 'course']) || 0
    if (std > 0 && v >= std) return `The special fee must be less than the standard fee (₹${std.toLocaleString('en-IN')}).`
  }
  if (!monthStartOf(f.from)) return 'Pick the month it starts from.'
  if (f.to && !monthEndOf(f.to)) return 'The end month is not valid.'
  if (f.to && f.to < f.from) return 'The end month is before the start month.'
  const why = String(f.reason || '').trim()
  if (why.length < 5) return 'Write the reason (at least 5 characters).'
  return null
}

// The row to insert (status pending unless an admin approves it straight away).
export function requestRow(f, { by, impact = null, approveNow = false, note = '' } = {}) {
  const s = f.student
  return {
    gcc: String(s.gcc_no), student_name: s.name || null,
    course: s.course || null, batch: s.batch || null, hostel_type: s.hostel_type || null,
    kind: f.kind, basis: f.basis, value: Number(f.value), applies_to: f.applies_to || 'course',
    valid_from: monthStartOf(f.from), valid_to: f.to ? monthEndOf(f.to) : null,
    reason: String(f.reason).trim(), requested_by: by || null, fee_impact: impact,
    status: approveNow ? 'active' : 'pending',
    ...(approveNow ? { approved_by: by || null, decided_by: by || null, decision_note: String(note || '').trim() || null } : {}),
  }
}

// Effective state on a date: pending | rejected | revoked | expired | expiring | active
export function stateOf(r, onDate = iso(new Date())) {
  if (['pending', 'rejected', 'revoked', 'expired'].includes(r?.status)) return r.status
  const to = dayOf(r?.valid_to)
  if (to && to < onDate) return 'expired'
  if (to) {
    const lim = new Date(onDate + 'T00:00:00'); lim.setDate(lim.getDate() + 30)
    if (to <= iso(lim)) return 'expiring'
  }
  return 'active'
}
export const isLive = st => st === 'active' || st === 'expiring'

export function describe(r) {
  const n = v => Number(v || 0).toLocaleString('en-IN')
  const on = appliesLabel(r?.applies_to).toLowerCase()
  switch (r?.basis) {
    case 'percent': return `${n(r.value)}% off the ${on}`
    case 'fixed_fee': return `Pays ₹${n(r.value)} a month for the ${on}`
    case 'one_time': return `₹${n(r.value)} off once (${on})`
    default: return `₹${n(r.value)} less every month (${on})`
  }
}

// Monthly ₹ given up on the course fee (for totals): from the saved impact when
// there is one, else what can be known without the rates.
export function monthlyValue(r) {
  const f = r?.fee_impact
  if (f && Number.isFinite(Number(f.perMonth))) return Number(f.perMonth)
  if (r?.basis === 'fixed_per_month' && hits(r, 'course')) return Number(r.value) || 0
  return 0
}

// Report: live concessions grouped by course (course saved with the request,
// else the student's current course). courseOf(row) is passed in.
export function courseReport(rows, courseOf, onDate) {
  const by = new Map()
  for (const r of rows || []) {
    const st = stateOf(r, onDate)
    if (!isLive(st) && st !== 'pending') continue
    const c = courseOf(r) || 'Unassigned'
    if (!by.has(c)) by.set(c, { course: c, entries: 0, students: new Set(), monthly: 0, pending: 0, kinds: {} })
    const g = by.get(c)
    if (st === 'pending') { g.pending++; continue }
    g.entries++; g.students.add(String(r.gcc)); g.monthly = r2(g.monthly + monthlyValue(r))
    g.kinds[r.kind] = (g.kinds[r.kind] || 0) + 1
  }
  return [...by.values()].map(g => ({ ...g, students: g.students.size })).sort((a, b) => b.entries - a.entries || a.course.localeCompare(b.course))
}

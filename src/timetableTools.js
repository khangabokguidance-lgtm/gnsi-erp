// timetableTools.js — scheduling logic behind HR → Timetable's advanced views
// (Today board, Teachers, Clashes, smart substitutes). Pure functions over
// timetable_master rows ({ day_name, period_name, class_name, subject_name,
// teacher_name }), so they are tested without a database (tests/timetableTools.test.js).

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// "7:30 AM" → minutes since midnight (null when it is not a time)
export function clockMinutes(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/)
  if (!m) return null
  let h = parseInt(m[1], 10) % 12
  if (/p/i.test(m[3])) h += 12
  return h * 60 + parseInt(m[2], 10)
}

// "7:30 AM–8:20 AM" (en dash or hyphen) → { start, end } in minutes; a point in time ("10:30 PM") has end = start
export function periodSpan(name) {
  const [a, b] = String(name || '').split(/\s*[–-]\s*(?=\d)/)
  const start = clockMinutes(a)
  const end = clockMinutes(b)
  return { start: start ?? 0, end: end ?? start ?? 0 }
}
export const periodStartMinutes = name => periodSpan(name).start
const overlaps = (a, b) => a.start < b.end && b.start < a.end

export const isWhole = e => !!e && (e.class_name === 'ALL' || /TEA BREAK|LUNCH|DINNER|BREAK/i.test(e.subject_name || ''))
const hasTeacher = e => !!e && !isWhole(e) && !!String(e.teacher_name || '').trim()

// "Sir Himan", "himanshu singh", "Mr. Himan" → "himan…" key used to match one person across the
// timetable (titles + first names) and staff records (full names).
const TITLES = /^(sir|madam|mam|maam|ma'am|mr|mrs|ms|miss|dr|prof|shri|smt)\.?\s+/i
export function teacherKey(name) {
  let s = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  while (TITLES.test(s)) s = s.replace(TITLES, '')
  return s.split(' ')[0].replace(/[^a-z]/g, '')
}
// Same person when one first name starts with the other (Himan / Himanshu), at least 3 letters.
export function sameTeacher(a, b) {
  const x = teacherKey(a), y = teacherKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const [s, l] = x.length < y.length ? [x, y] : [y, x]
  return s.length >= 3 && l.startsWith(s)
}
// The staff record for a timetable teacher name (or null)
export function matchStaff(teacherName, staff = []) {
  return staff.find(s => sameTeacher(s.name, teacherName)) || null
}

// One person, many spellings: group every teacher_name in the timetable under one display name.
export function teacherList(entries, staff = []) {
  const groups = []
  for (const e of entries) {
    if (!hasTeacher(e)) continue
    let g = groups.find(x => sameTeacher(x.name, e.teacher_name))
    if (!g) { g = { name: e.teacher_name.trim(), names: new Set(), staff: matchStaff(e.teacher_name, staff) }; groups.push(g) }
    g.names.add(e.teacher_name.trim())
  }
  return groups.map(g => ({ ...g, names: [...g.names] })).sort((a, b) => a.name.localeCompare(b.name))
}

// Teacher → weekly load: periods per day, total, batches, subjects
export function teacherLoad(entries, staff = []) {
  return teacherList(entries, staff).map(t => {
    const mine = entries.filter(e => hasTeacher(e) && sameTeacher(e.teacher_name, t.name))
    // a joint class (several batches, one room, one teacher) is one period of work
    const slots = new Set(mine.map(e => `${e.day_name}|${e.period_name}`))
    const perDay = Object.fromEntries(DAYS.map(d => [d, [...slots].filter(k => k.startsWith(d + '|')).length]))
    return {
      ...t, perDay, total: slots.size,
      maxDay: Math.max(0, ...Object.values(perDay)),
      batches: [...new Set(mine.map(e => e.class_name))].sort(),
      subjects: [...new Set(mine.map(e => e.subject_name))].sort(),
    }
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

// A teacher in two places at once. Same subject in overlapping slots = a joint class
// (batches sitting together, e.g. a revision class) and is reported separately, not as a clash.
export function findClashes(entries) {
  const out = []
  for (const day of DAYS) {
    const rows = entries.filter(e => e.day_name === day && hasTeacher(e))
    const seen = new Set()
    rows.forEach((a, i) => {
      const group = [a]
      rows.forEach((b, j) => {
        if (j === i || !sameTeacher(a.teacher_name, b.teacher_name)) return
        if (overlaps(periodSpan(a.period_name), periodSpan(b.period_name)) || a.period_name === b.period_name) group.push(b)
      })
      if (group.length < 2) return
      const key = group.map(g => `${g.class_name}|${g.period_name}`).sort().join('~')
      if (seen.has(key)) return
      seen.add(key)
      const subjects = new Set(group.map(g => String(g.subject_name || '').trim().toLowerCase()))
      const samePeriod = new Set(group.map(g => g.period_name)).size === 1
      out.push({
        day, teacher: a.teacher_name, entries: group.sort((x, y) => x.class_name.localeCompare(y.class_name)),
        kind: subjects.size === 1 && samePeriod ? 'joint' : 'clash',
      })
    })
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'clash' ? -1 : 1) || DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
}

// Is this teacher busy (in the timetable) on that day during that period?
export function isBusy(entries, teacherName, day, periodName) {
  const span = periodSpan(periodName)
  return entries.some(e => e.day_name === day && hasTeacher(e) && sameTeacher(e.teacher_name, teacherName) && overlaps(periodSpan(e.period_name), span))
}

// Teachers who can cover a class: not teaching then, not absent, not already substituting then.
// Ranked: same subject first, then the lightest day, then name.
export function suggestSubstitutes(entries, { day, periodName, subject, staff = [], absentNames = [], subsToday = [] }) {
  const span = periodSpan(periodName)
  const pool = new Map()
  for (const s of staff) pool.set(s.name, { name: s.name, staff: s })
  for (const t of teacherList(entries, staff)) if (![...pool.keys()].some(n => sameTeacher(n, t.name))) pool.set(t.name, { name: t.name, staff: t.staff })
  const subjWord = String(subject || '').toLowerCase().replace(/\b(revision|practice|i|ii|iii)\b/g, '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || ''
  return [...pool.values()]
    .filter(p => !absentNames.some(a => sameTeacher(a, p.name)))
    .filter(p => !isBusy(entries, p.name, day, periodName))
    .filter(p => !subsToday.some(s => sameTeacher(s.substitute_teacher, p.name) && overlaps(periodSpan(s.period_name), span)))
    .map(p => {
      const mine = entries.filter(e => e.day_name === day && hasTeacher(e) && sameTeacher(e.teacher_name, p.name))
      const dayLoad = new Set(mine.map(e => e.period_name)).size
      const teaches = entries.filter(e => hasTeacher(e) && sameTeacher(e.teacher_name, p.name)).map(e => String(e.subject_name || '').toLowerCase())
      const subjectMatch = !!subjWord && subjWord.length > 2 && teaches.some(t => t.includes(subjWord))
      return { ...p, dayLoad, subjectMatch }
    })
    .sort((a, b) => (b.subjectMatch - a.subjectMatch) || (a.dayLoad - b.dayLoad) || a.name.localeCompare(b.name))
}

// What is on now and next for one batch (or the whole institute) at a moment.
// `minutes` = minutes since midnight. Whole-institute rows count for every batch.
export function nowAndNext(entries, { day, batch, minutes }) {
  const rows = entries
    .filter(e => e.day_name === day && (e.class_name === batch || e.class_name === 'ALL'))
    .map(e => ({ ...e, span: periodSpan(e.period_name) }))
    .sort((a, b) => a.span.start - b.span.start)
  const now = rows.find(r => r.span.start <= minutes && minutes < Math.max(r.span.end, r.span.start + 1)) || null
  const next = rows.find(r => r.span.start > minutes) || null
  return { now, next, rows }
}

// Weekday name for an ISO date ("2026-10-26" → "Monday"); Sunday has no timetable.
export const dayOf = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })

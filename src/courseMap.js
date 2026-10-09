// courseMap.js — ONE definition of "which course / batch is this student in",
// shared by Students (Courses tab) and Attendance (roll call, Student DB).
//
// Why this exists: many `students` rows have `course` blank (older imports
// only filled `batch`). Attendance's roll call filtered `.eq('course', …)`,
// so those students never appeared on the register at all, while Students
// showed them — the two modules disagreed about who is in a class.
// Both now derive the course the same way: explicit `course` first, then
// the batch name (Achiever → Sainik, Lakshya A → Navodaya, …).

export const COURSE_BATCHES = {
  Sainik:            ['Achiever', 'Leader', 'Champion'],
  Navodaya:          ['Umeed', 'Lakshya A', 'Lakshya B', 'Lakshya'],   // 'Lakshya' = older, unsplit records
  Foundation:        ['Pragati', 'Udaan'],
  'Combined Course': [],
}
export const COURSE_ORDER = ['Sainik', 'Navodaya', 'Foundation', 'Combined Course']

const BATCH_TO_COURSE = (() => {
  const m = {}
  Object.entries(COURSE_BATCHES).forEach(([c, bs]) => bs.forEach(b => { m[b.toLowerCase()] = c }))
  return m
})()

// Foundation batches were renamed (Elite → Udaan, Prime → Pragati); rows not
// yet renamed still mean the new batch.
const RENAMED_BATCHES = { elite: 'Udaan', prime: 'Pragati' }
const STANDARD_BATCHES = Object.values(COURSE_BATCHES).flat()

// Spellings a batch may still be saved under elsewhere (e.g. Fee Setup rows
// written before the rename) — used to look those rows up.
export const BATCH_ALIASES = {
  Udaan: ['Udaan', 'UDAAN', 'Elite', 'ELITE'],
  Pragati: ['Pragati', 'PRAGATI', 'Prime', 'PRIME'],
}

export const isStandardBatch = b => STANDARD_BATCHES.includes(b)

// A batch as the standard name: case and spacing don't matter, a section
// suffix is dropped ("UDAAN — ENG" → Udaan) and the old names map to the
// new ones ("ELITE" → Udaan). Unknown names come back trimmed, unchanged.
export function canonicalBatch(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  // Whole value first, ignoring spaces and dashes ("LAKSHYA - A" → Lakshya A).
  const squash = v => v.toLowerCase().replace(/[^a-z0-9]/g, '')
  const whole = STANDARD_BATCHES.find(b => squash(b) === squash(s)) || RENAMED_BATCHES[squash(s)]
  if (whole) return whole
  const base = s.split(/\s*[—–-]\s*/)[0].trim()
  const low = base.toLowerCase()
  return RENAMED_BATCHES[low] || STANDARD_BATCHES.find(b => b.toLowerCase() === low) || s
}

export function normalizeCourse(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return ''
  if (s.startsWith('sainik')) return 'Sainik'
  if (s.startsWith('navodaya')) return 'Navodaya'
  if (s.startsWith('found')) return 'Foundation'
  if (s.startsWith('combined')) return 'Combined Course'
  return ''
}

// Course for a student row — 'Unassigned' when neither course nor batch tells us.
export function courseOf(s) {
  return normalizeCourse(s?.course)
    || BATCH_TO_COURSE[canonicalBatch(s?.batch).toLowerCase()]
    || BATCH_TO_COURSE[canonicalBatch(s?.class_name).toLowerCase()]
    || 'Unassigned'
}

// Batch for a student row (students.batch, falling back to class_name).
export function batchOf(s) {
  return String(s?.batch || s?.class_name || '').trim() || 'No batch'
}

// Batches to offer for a course: the standard list, plus any other batch
// names actually found on students in that course (so nobody is unreachable).
export function batchesFor(course, students = []) {
  const std = (COURSE_BATCHES[course] || []).filter(b => b !== 'Lakshya' || students.some(s => batchOf(s) === 'Lakshya'))
  const found = [...new Set(students.filter(s => courseOf(s) === course).map(batchOf))]
  return [...std, ...found.filter(b => !std.includes(b) && b !== 'No batch').sort()]
}

// ── Cross-module hand-off (Students ⇄ Attendance) ──────────────────────────
// A module writes an intent, then navigates; the target reads it once on load.
const KEY_ATT = 'gnsi_handoff_attendance'
const KEY_STU = 'gnsi_handoff_students'
const put = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify({ ...v, at: Date.now() })) } catch {} }
const take = k => {
  try {
    const v = JSON.parse(sessionStorage.getItem(k) || 'null')
    sessionStorage.removeItem(k)
    return v && Date.now() - (v.at || 0) < 5 * 60 * 1000 ? v : null
  } catch { return null }
}
// Attendance: { page:'mark'|'student360', course, subtype, gcc }
export const handoffToAttendance = v => put(KEY_ATT, v)
export const takeAttendanceHandoff = () => take(KEY_ATT)
// Students: { gcc }  → opens that student's profile
export const handoffToStudents = v => put(KEY_STU, v)
export const takeStudentsHandoff = () => take(KEY_STU)

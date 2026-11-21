// missionSainikExam.js — the mock tests of Mission Sainik as exams: admit card schedule, per-student marks entry and merit ranking
// (pure, unit-tested). Marks are saved in the same table the Pre / Mega analyzers read (mock_test_results), so analysis follows automatically.
import { TESTS, MOCK_TESTS, SUBJECTS, MOCK_SECTIONS } from '../missionSainikData.js'

export const EXAM_KINDS = {
  pre:  { label: 'Pre Mock Test',  series: 'Pre Mock Test 2027',  tests: () => TESTS.map(t => ({ no: t.no, id: t.id, date: t.date })) },
  mega: { label: 'Mega Mock Test', series: 'Mega Mock Test 2027', tests: () => MOCK_TESTS.map(t => ({ no: t.no, id: t.id, date: t.date })) },
}

// The subjects (sections) of a test and their maximum marks.
export function examSections(kind) {
  if (kind === 'mega') return MOCK_SECTIONS.map(s => ({ subject: s.label, max: s.marks }))
  return SUBJECTS.map(s => ({ subject: s.label, max: 50 }))   // Pre Mock: six sections of 25 questions × 2 marks
}

// Rows of the admit card schedule table: one per section, same date / time / hall.
export function admitSchedule(kind, test, { time = '', room = '', shift = 'Morning' } = {}) {
  return examSections(kind).map(s => ({ exam_date: test?.date || '', subject: s.subject, shift, time, room, total_marks: s.max }))
}

export const admitTitle = (kind, test) => `Mission Sainik 2027 · ${test?.id || EXAM_KINDS[kind]?.label || 'Mock Test'}`

// A mark typed in a box: '' = not entered, otherwise a number from 0 to max. Returns { value, error }.
export function parseMark(raw, max) {
  const t = String(raw ?? '').trim()
  if (t === '') return { value: null, error: '' }
  const v = Number(t)
  if (!Number.isFinite(v) || v < 0) return { value: null, error: 'Enter a number, 0 or more' }
  if (v > max) return { value: null, error: `At most ${max}` }
  return { value: Math.round(v * 100) / 100, error: '' }
}

const keyOf = r => (String(r.gcc_no || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '') || String(r.student_name || '').toLowerCase().replace(/\s+/g, ' ').trim())

// Rows for mock_test_results from the entry sheet. Students marked Absent are NOT saved (the analyzer then shows them as having skipped the test).
// entries: { [studentId]: { marks: { subject: '12.5' }, absent: bool } }; students: roster rows ({ id, name, gcc }).
export function buildMarkRows({ series, test, batch, kind, students, entries, who = '' }) {
  const sections = examSections(kind)
  const maxMarks = Object.fromEntries(sections.map(s => [s.subject, s.max]))
  const rows = []
  for (const s of students || []) {
    const e = entries?.[s.id]
    if (!e || e.absent) continue
    const marks = {}
    for (const sec of sections) { const { value } = parseMark(e.marks?.[sec.subject], sec.max); if (value !== null) marks[sec.subject] = value }
    if (!Object.keys(marks).length) continue
    const total = Math.round(Object.values(marks).reduce((a, b) => a + b, 0) * 100) / 100
    rows.push({ series, test_no: test.no, test_name: test.id, test_date: test.date || null, batch, gcc_no: s.gcc || null, student_name: s.name,
      marks, max_marks: maxMarks, total, max_total: sections.reduce((a, x) => a + x.max, 0), rank: null, source_file: 'Mission Sainik marks entry', uploaded_by: who || null })
  }
  rows.sort((a, b) => b.total - a.total || a.student_name.localeCompare(b.student_name))
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1 })
  return rows
}

// Existing saved rows of one (series, test, batch) → the entry sheet again, so marks can be corrected.
export function entriesFromRows(rows, students) {
  const by = new Map((rows || []).map(r => [keyOf(r), r]))
  const out = {}
  for (const s of students || []) {
    const r = by.get(keyOf({ gcc_no: s.gcc, student_name: s.name }))
    if (r) out[s.id] = { marks: Object.fromEntries(Object.entries(r.marks || {}).map(([k, v]) => [k, String(v)])), absent: false }
  }
  return out
}

// Merit ranking over mock result rows (optionally one test): total, percentage, rank (ties share). Highest first.
export function rankResults(rows, { testNo = 0 } = {}) {
  const use = (rows || []).filter(r => !testNo || Number(r.test_no) === Number(testNo))
  const by = new Map()
  use.forEach(r => {
    const k = keyOf(r)
    const e = by.get(k) || { key: k, name: r.student_name, gcc: r.gcc_no || '', batch: r.batch || '', total: 0, max: 0, tests: 0 }
    e.total += Number(r.total) || 0; e.max += Number(r.max_total) || 0; e.tests++
    by.set(k, e)
  })
  const list = [...by.values()].map(e => ({ ...e, total: Math.round(e.total * 100) / 100, pct: e.max ? Math.round((e.total / e.max) * 1000) / 10 : 0 }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total || a.name.localeCompare(b.name))
  list.forEach((e, i) => { e.rank = i && list[i - 1].pct === e.pct ? list[i - 1].rank : i + 1 })
  return list
}

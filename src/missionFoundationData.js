// missionFoundationData.js — defaults and pure helpers for "Mission Foundation 2026-27"
// (8 weekly Monday tests for the Foundation batches Udaan and Pragati, December 2026 – January 2027).
import { canonicalBatch, courseOf } from './courseMap.js'
// The schedule, papers, panel and marks live in Supabase (migration 20261216_mission_foundation.sql);
// this file only holds the starting values the admin can change on screen, and logic that is unit-tested.

export const MISSION_NAME = 'Mission Foundation 2026-27'
export const BATCHES = ['Udaan', 'Pragati']

// The six Foundation subjects, from the Udaan / Pragati timetable. Pattern values are placeholders.
// All six are written in one sitting; the time is set once per test (mission_foundation_tests.duration_min).
export const DEFAULT_TEST_MINUTES = 120
export const SUBJECTS = [
  { key: 'maths1',    label: 'Mathematics I',   short: 'Maths I',   questions: 25, marks_each: 2 },
  { key: 'maths2',    label: 'Mathematics II',  short: 'Maths II',  questions: 25, marks_each: 2 },
  { key: 'reasoning', label: 'Reasoning',       short: 'Reasoning', questions: 25, marks_each: 2 },
  { key: 'grammar',   label: 'English Grammar', short: 'Grammar',   questions: 25, marks_each: 2 },
  { key: 'evs',       label: 'EVS',             short: 'EVS',       questions: 25, marks_each: 2 },
  { key: 'passage',   label: 'Passage',         short: 'Passage',   questions: 25, marks_each: 2 },
]
export const subjectByLabel = label => SUBJECTS.find(s => s.label === label)
export const maxMarks = p => (Number(p?.questions) || 0) * (Number(p?.marks_each) || 0)

// Foundation teachers on the October 2026 timetable (Udaan / Pragati columns). Editable in the Teachers tab.
export const DEFAULT_PANEL = {
  'Mathematics I':   ['Kabiraj', 'Lenin'],
  'Mathematics II':  ['Lenin', 'Kabiraj'],
  'Reasoning':       ['Roshan'],
  'English Grammar': ['Manglemba', 'Adison'],
  'EVS':             ['Arjun'],
  'Passage':         ['Sandhya'],
}

export const PAPER_FLOW = ['Pending', 'Submitted', 'Checked', 'Approved']
export const TEST_FLOW = ['Planned', 'Ready', 'Conducted', 'Results out']

// 8 weekly tests, every Monday, from 7 Dec 2026 to 25 Jan 2027 (all six subjects each time).
export const DEFAULT_PLAN = { start: '2026-12-07', count: 8, weekday: 1 }

const iso = d => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const weekdayOf = s => new Date(s + 'T00:00:00Z').getUTCDay() // 0 = Sunday, 1 = Monday

// `count` dates, one a week on `weekday`, starting on the first such day on or after `start`.
export function weeklyDates(start, count = DEFAULT_PLAN.count, weekday = DEFAULT_PLAN.weekday) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) return []
  const first = addDays(start, (weekday - weekdayOf(start) + 7) % 7)
  return Array.from({ length: Math.max(0, Math.min(52, Number(count) || 0)) }, (_, i) => addDays(first, i * 7))
}

// Who checks a setter's paper: the next teacher of the same subject; with one teacher, the next subject's first teacher.
export function checkerFor(subject, setter, panel) {
  const list = panel[subject] || []
  if (list.length > 1) {
    const i = list.indexOf(setter)
    return list[((i < 0 ? 0 : i) + 1) % list.length]
  }
  const subjects = SUBJECTS.map(s => s.label)
  for (let k = 1; k < subjects.length; k++) {
    const other = panel[subjects[(subjects.indexOf(subject) + k) % subjects.length]] || []
    const pick = other.find(t => t !== setter)
    if (pick) return pick
  }
  return ''
}

// The rows to create for a schedule: one test a week, each with all six subject papers.
// Setters take turns within each subject. startNo numbers the tests after any that already exist.
export function buildSchedule({ start = DEFAULT_PLAN.start, count = DEFAULT_PLAN.count, weekday = DEFAULT_PLAN.weekday, panel = DEFAULT_PANEL, startNo = 1, skipDates = [] }) {
  const turns = {}
  const nextSetter = subject => {
    const list = panel[subject] || []
    if (!list.length) return ''
    const n = turns[subject] || 0
    turns[subject] = n + 1
    return list[n % list.length]
  }
  const taken = new Set(skipDates)
  return weeklyDates(start, count, weekday).filter(d => !taken.has(d)).map((date, i) => {
    const no = startNo + i
    return {
      test: { test_no: no, test_date: date, title: `Test ${String(no).padStart(2, '0')}`, batches: [...BATCHES], status: 'Planned' },
      papers: SUBJECTS.map(s => {
        const setter = nextSetter(s.label)
        return { subject: s.label, questions: s.questions, marks_each: s.marks_each, setter, verifier: setter ? checkerFor(s.label, setter, panel) : '', status: 'Pending' }
      }),
    }
  })
}

// Rank a test's results. rows: [{ student_id, student_name, batch, subject, marks, absent }]; papers give the max marks.
// Returns one row per student with total, max, percentage and rank (ties share a rank; fully absent students last, unranked).
export function rankResults(rows, papers) {
  const max = Object.fromEntries(papers.map(p => [p.subject, maxMarks(p)]))
  const by = new Map()
  for (const r of rows) {
    if (!(r.subject in max)) continue
    const s = by.get(r.student_id) || { student_id: r.student_id, student_name: r.student_name, gcc_no: r.gcc_no, batch: r.batch, total: 0, max: 0, sat: 0, subjects: {} }
    s.subjects[r.subject] = r.absent ? 'AB' : r.marks
    if (!r.absent && r.marks !== null && r.marks !== '' && r.marks !== undefined) { s.total += Number(r.marks) || 0; s.max += max[r.subject]; s.sat++ }
    by.set(r.student_id, s)
  }
  const list = [...by.values()].map(s => ({ ...s, pct: s.max ? Math.round((s.total / s.max) * 1000) / 10 : null }))
  list.sort((a, b) => (b.sat > 0) - (a.sat > 0) || (b.pct ?? -1) - (a.pct ?? -1) || String(a.student_name).localeCompare(String(b.student_name)))
  let rank = 0, prev = null
  list.forEach((s, i) => {
    if (!s.sat) { s.rank = null; return }
    if (s.pct !== prev) { rank = i + 1; prev = s.pct }
    s.rank = rank
  })
  return list
}

// A marks entry is valid when it is empty, or a number from 0 to the paper's maximum.
export function markError(value, max) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Not a number'
  if (n < 0) return 'Below 0'
  if (max && n > max) return `More than ${max}`
  return ''
}

// Whole-word, case-insensitive match of a panel name ("Roshan") inside a login name ("Sir Roshan Singh").
export function nameMatches(who, name) {
  if (!who || !name) return false
  const words = String(who).toLowerCase().split(/[^a-z0-9]+/)
  const want = cleanTeacherName(name).toLowerCase()
  return !!want && (words.includes(want) || want.split(/[^a-z0-9]+/).filter(Boolean).every(w => words.includes(w)))
}
// Honorifics typed into a name ("Sir Umesh") are dropped when it is saved, and never doubled when shown.
const HONORIFIC = /^(?:(?:sir|madam|mam|ma'am|mr|mrs|ms|miss|dr|prof)\.?\s+)+/i
export const cleanTeacherName = raw => String(raw || '').replace(/\s+/g, ' ').trim().replace(HONORIFIC, '').trim()
export const titled = n => {
  const raw = String(n || '').trim()
  if (HONORIFIC.test(raw + ' ')) return raw.replace(/\s+/g, ' ')
  return (/^(Sandhya)$/i.test(raw) ? 'Madam ' : 'Sir ') + raw
}

// Share one subject's papers out between its teachers in turn, test by test (approved papers are left alone).
// subjectPapers: that subject's papers in test order; teachers: the subject's teacher list. Returns [{ id, setter, verifier }].
export function shareTests(subjectPapers, teachers, panel = {}) {
  const list = (teachers || []).filter(Boolean)
  if (!list.length) return []
  let turn = 0
  return subjectPapers.filter(p => p.status !== 'Approved').map(p => {
    const setter = list[turn++ % list.length]
    const verifier = list.length > 1 ? list[(list.indexOf(setter) + 1) % list.length] : (checkerFor(p.subject, setter, panel) || p.verifier || '')
    return { id: p.id, setter, verifier }
  })
}

// Only http(s) links may be stored or opened.
export function safeUrl(u) {
  try { const x = new URL(String(u || '').trim()); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '' } catch { return '' }
}

// ── Analyser ──────────────────────────────────────────────────────────────────
const round1 = n => Math.round(n * 10) / 10
const sat = r => !r.absent && r.marks !== null && r.marks !== '' && r.marks !== undefined && Number.isFinite(Number(r.marks))

// Per-subject figures for one test: average, highest, lowest, average %, absent count, count below `weakPct`.
export function subjectStats(rows, papers, weakPct = 40) {
  return papers.map(p => {
    const max = maxMarks(p)
    const mine = rows.filter(r => r.subject === p.subject)
    const vals = mine.filter(sat).map(r => Number(r.marks))
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return {
      subject: p.subject, max, sat: vals.length, absent: mine.filter(r => r.absent).length,
      avg: avg == null ? null : round1(avg), high: vals.length ? Math.max(...vals) : null, low: vals.length ? Math.min(...vals) : null,
      avgPct: avg == null || !max ? null : round1((avg / max) * 100),
      weak: max ? vals.filter(v => (v / max) * 100 < weakPct).length : 0,
    }
  })
}

export const BANDS = [
  { label: '90% and above', min: 90 }, { label: '75 – 89%', min: 75 }, { label: '50 – 74%', min: 50 },
  { label: '35 – 49%', min: 35 }, { label: 'Below 35%', min: -Infinity },
]
// How many ranked students fall in each percentage band (absent students are left out).
export function scoreBands(ranked) {
  const out = BANDS.map(b => ({ ...b, count: 0 }))
  ranked.forEach(r => { if (r.pct == null) return; out.find(b => r.pct >= b.min).count++ })
  return out
}

// Average % of each batch from ranked results.
export function batchAverages(ranked) {
  return BATCHES.map(b => {
    const l = ranked.filter(r => r.batch === b && r.pct != null)
    return { batch: b, students: l.length, avgPct: l.length ? round1(l.reduce((a, r) => a + r.pct, 0) / l.length) : null }
  })
}

// The whole series: each student's % in every test, their average across the tests they sat, and a series rank.
// marks: all mark rows (with test_id); tests: in date order; papersByTest: { test_id: papers }.
export function seriesRanking(marks, tests, papersByTest) {
  const byTest = {}
  marks.forEach(m => { (byTest[m.test_id] ||= []).push(m) })
  const people = new Map()
  tests.forEach(t => {
    rankResults(byTest[t.id] || [], papersByTest[t.id] || []).forEach(r => {
      const p = people.get(r.student_id) || { student_id: r.student_id, student_name: r.student_name, gcc_no: r.gcc_no, batch: r.batch, perTest: {} }
      p.perTest[t.id] = r.pct
      people.set(r.student_id, p)
    })
  })
  const list = [...people.values()].map(p => {
    const vals = tests.map(t => p.perTest[t.id]).filter(v => v != null)
    const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null
    return { ...p, tests: vals.length, pct: avg, change: vals.length > 1 ? round1(vals[vals.length - 1] - vals[0]) : null }
  })
  list.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || String(a.student_name).localeCompare(String(b.student_name)))
  let rank = 0, prev = null
  list.forEach((s, i) => { if (s.pct == null) { s.rank = null; return } if (s.pct !== prev) { rank = i + 1; prev = s.pct } s.rank = rank })
  return list
}

// The top `n` ranks of each batch (ties included), for merit certificates.
export function topPerBatch(ranked, n = 3) {
  return BATCHES.flatMap(b => {
    const l = ranked.filter(r => r.batch === b && r.pct != null)
    let rank = 0, prev = null
    const withRank = l.map((r, i) => { if (r.pct !== prev) { rank = i + 1; prev = r.pct } return { ...r, batchRank: rank } })
    return withRank.filter(r => r.batchRank <= n)
  })
}
export const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th')

// ── Teaching, test day and prizes ─────────────────────────────────────────────
// A paper's syllabus is stored as "A; B; C".
export const splitChapters = v => String(v || '').split(/;|\n/).map(s => s.trim()).filter(Boolean)

// Test-day checklist. `auto` steps are worked out from the data; the others are ticked by staff.
export const CONDUCT_STEPS = [
  { key: 'papers',    label: 'All question papers approved', auto: true },
  { key: 'printed',   label: 'Question papers printed and counted' },
  { key: 'hall',      label: 'Hall, seating and roll numbers ready' },
  { key: 'staff',     label: 'Invigilators told their duty' },
  { key: 'conducted', label: 'Test conducted' },
  { key: 'collected', label: 'Answer sheets collected and counted' },
  { key: 'checked',   label: 'Answer sheets checked by teachers' },
  { key: 'marks',     label: 'Marks entered for every student', auto: true },
  { key: 'published', label: 'Results published to students' },
]

// Where a test is in the cycle Teach → Papers → Conduct → Marks → Results → Prizes, with each step's progress (0–1).
// info: { papers: [...], teaching: [{ subject, chapter, done }], checklist: {key:{done}}, marksRows: n, students: n, prizesGiven: n, prizes: n }
export function testCycle(info) {
  const papers = info.papers || []
  const chapters = papers.flatMap(p => splitChapters(p.syllabus).map(c => `${p.subject}|${c}`))
  const taught = new Set((info.teaching || []).filter(t => t.done).map(t => `${t.subject}|${t.chapter}`))
  const done = k => !!info.checklist?.[k]?.done
  const manual = CONDUCT_STEPS.filter(s => !s.auto && s.key !== 'published')
  const expectedMarks = (info.students || 0) * papers.length
  const steps = [
    { key: 'teach',   label: 'Teach',   value: chapters.length ? chapters.filter(c => taught.has(c)).length / chapters.length : 0, note: chapters.length ? `${chapters.filter(c => taught.has(c)).length}/${chapters.length} chapters` : 'add syllabus' },
    { key: 'papers',  label: 'Papers',  value: papers.length ? papers.filter(p => p.status === 'Approved').length / papers.length : 0, note: `${papers.filter(p => p.status === 'Approved').length}/${papers.length} approved` },
    { key: 'conduct', label: 'Test day', value: manual.filter(s => done(s.key)).length / manual.length, note: `${manual.filter(s => done(s.key)).length}/${manual.length} ticked` },
    { key: 'marks',   label: 'Marks',   value: expectedMarks ? Math.min(1, (info.marksRows || 0) / expectedMarks) : 0, note: `${info.marksRows || 0}${expectedMarks ? '/' + expectedMarks : ''} entered` },
    { key: 'results', label: 'Results', value: done('published') ? 1 : 0, note: done('published') ? 'published' : 'not yet' },
    { key: 'prizes',  label: 'Prizes',  value: info.prizes ? (info.prizesGiven || 0) / info.prizes : 0, note: info.prizes ? `${info.prizesGiven || 0}/${info.prizes} given` : 'after results' },
  ]
  const current = steps.findIndex(s => s.value < 1)
  return { steps, current: current < 0 ? steps.length : current }
}

// Average % per student per subject. rows: mark rows (with test_id); papersByTest gives each paper's full marks.
function subjectPercents(rows, papersByTest) {
  const acc = new Map()
  rows.forEach(r => {
    if (!sat(r)) return
    const p = (papersByTest[r.test_id] || []).find(x => x.subject === r.subject)
    const max = maxMarks(p)
    if (!max) return
    const key = r.student_id + '|' + r.subject
    const a = acc.get(key) || { student_id: r.student_id, student_name: r.student_name, gcc_no: r.gcc_no, batch: r.batch, subject: r.subject, sum: 0, n: 0 }
    a.sum += (Number(r.marks) / max) * 100; a.n++
    acc.set(key, a)
  })
  return [...acc.values()].map(a => ({ ...a, pct: round1(a.sum / a.n) }))
}

// Prize list for one test (scopeTests = [that test]) or the whole series (all tests).
// Awards: top `topN` of each batch; topper of each subject (both batches together);
// for the series also the most improved student of each batch and full attendance (sat every test that has marks).
export function prizeList({ marks, tests, papersByTest, series = false, topN = 3 }) {
  const ids = new Set(tests.map(t => t.id))
  const rows = marks.filter(m => ids.has(m.test_id))
  const ranked = series ? seriesRanking(rows, tests, papersByTest) : rankResults(rows, papersByTest[tests[0]?.id] || [])
  const out = []
  topPerBatch(ranked, topN).forEach(w => out.push({ award_key: `rank-${w.batchRank}-${w.batch}`, group: 'Toppers', award: `${ordinal(w.batchRank)} Position · ${w.batch}`,
    student_id: w.student_id, student_name: w.student_name, gcc_no: w.gcc_no, batch: w.batch, pct: w.pct, detail: `${w.pct}% overall` }))
  const subj = subjectPercents(rows, papersByTest)
  SUBJECTS.forEach(s => {
    const l = subj.filter(x => x.subject === s.label)
    if (!l.length) return
    const best = Math.max(...l.map(x => x.pct))
    l.filter(x => x.pct === best).forEach(x => out.push({ award_key: `subject-${s.key}`, group: 'Subject toppers', award: `Subject Topper · ${s.label}`,
      student_id: x.student_id, student_name: x.student_name, gcc_no: x.gcc_no, batch: x.batch, pct: x.pct, detail: `${x.pct}% in ${s.label}` }))
  })
  if (series) {
    BATCHES.forEach(b => {
      const l = ranked.filter(r => r.batch === b && r.change != null && r.change > 0)
      if (!l.length) return
      const best = Math.max(...l.map(r => r.change))
      l.filter(r => r.change === best).forEach(r => out.push({ award_key: `improved-${b}`, group: 'Most improved', award: `Most Improved · ${b}`,
        student_id: r.student_id, student_name: r.student_name, gcc_no: r.gcc_no, batch: r.batch, pct: r.pct, detail: `up ${r.change} points from the first test` }))
    })
    const held = tests.filter(t => rows.some(m => m.test_id === t.id))
    if (held.length > 1) ranked.filter(r => r.tests === held.length).forEach(r => out.push({ award_key: 'attendance', group: 'Full attendance', award: 'Full Attendance · All Tests',
      student_id: r.student_id, student_name: r.student_name, gcc_no: r.gcc_no, batch: r.batch, pct: r.pct, detail: `sat all ${held.length} tests` }))
  }
  return out
}

// The test to focus on: today's, else the next one, else the latest one not finished.
export function focusTest(tests, today) {
  return tests.find(t => t.test_date === today) || tests.find(t => t.test_date > today) || [...tests].reverse()[0]
}

// ctx: { papersByTest, students, teaching, prizes, marksCount, allMarks }
export function cycleFor(test, ctx) {
  const papers = ctx.papersByTest[test.id] || []
  const students = ctx.students ? ctx.students.filter(s => (test.batches || BATCHES).includes(s.batchName)).length : 0
  const given = ctx.prizes.filter(p => p.scope === test.id && p.given).length
  const winners = ctx.allMarks ? prizeList({ marks: ctx.allMarks, tests: [test], papersByTest: ctx.papersByTest }).length : 0
  return testCycle({
    papers, teaching: ctx.teaching.filter(t => t.test_id === test.id), checklist: test.checklist || {},
    marksRows: ctx.marksCount[test.id] || 0, students, prizes: winners, prizesGiven: Math.min(given, winners),
  })
}


// ── Copy a test's paper format to other tests ─────────────────────────────────
// source: the papers of one test; targets: [{ test_id, papers }].
// opts.pattern copies questions and marks each (the test's total time is copied by the screen, it belongs to the test); opts.teachers the setter and checker; opts.syllabus the chapters.
// A subject the target test lacks is added (with what is copied). Approved papers are left alone and counted in `skipped`.
export function copyFormatPlan(source, targets, opts = { pattern: true }) {
  const updates = [], inserts = []
  let skipped = 0
  const pick = p => ({
    ...(opts.pattern ? { questions: p.questions ?? null, marks_each: p.marks_each ?? null } : {}),
    ...(opts.teachers ? { setter: p.setter || '', verifier: p.verifier || '' } : {}),
    ...(opts.syllabus ? { syllabus: p.syllabus || '' } : {}),
  })
  for (const t of targets) {
    for (const p of source) {
      const patch = pick(p)
      const hit = (t.papers || []).find(x => x.subject === p.subject)
      if (hit) {
        if (hit.status === 'Approved') { skipped++; continue }
        if (Object.keys(patch).some(k => (hit[k] ?? null) !== (patch[k] ?? null))) updates.push({ id: hit.id, patch })
      } else {
        const d = subjectByLabel(p.subject) || {}
        inserts.push({ test_id: t.test_id, subject: p.subject, questions: d.questions ?? null, marks_each: d.marks_each ?? null, setter: '', verifier: '', status: 'Pending', ...patch })
      }
    }
  }
  return { updates, inserts, skipped }
}

// Every active Foundation student from the ERP students table.
// placed: batch reads as Udaan or Pragati (old names Elite / Prime and section suffixes like "UDAAN — ENG" count);
// unplaced: course is Foundation but the batch is blank or unknown, so they would miss marks entry until it is fixed.
export function foundationRoster(rows) {
  const placed = [], unplaced = []
  ;(rows || []).forEach(s => {
    const batchName = canonicalBatch(s.batch)
    if (BATCHES.includes(batchName)) placed.push({ ...s, batchName })
    else if (courseOf(s) === 'Foundation') unplaced.push({ ...s, batchName: '' })
  })
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''))
  return { placed: placed.sort(byName), unplaced: unplaced.sort(byName) }
}

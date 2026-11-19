import test from 'node:test'
import assert from 'node:assert/strict'
import {
  weeklyDates, buildSchedule, checkerFor, rankResults, markError, subjectStats, scoreBands, seriesRanking, topPerBatch,
  batchAverages, ordinal, DEFAULT_PANEL, SUBJECTS, nameMatches, safeUrl,
} from '../src/missionFoundationData.js'

test('8 Monday tests from 7 Dec 2026 to 25 Jan 2027', () => {
  const d = weeklyDates('2026-12-07', 8, 1)
  assert.deepEqual(d, ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25'])
  assert.equal(weeklyDates('2026-12-01', 1, 1)[0], '2026-12-07')   // a Tuesday start moves to the next Monday
  assert.deepEqual(weeklyDates('bad', 3), [])
})

test('schedule: every test has all six subjects; setters take turns; nobody checks their own paper', () => {
  const rows = buildSchedule({ start: '2026-12-07', count: 8 })
  assert.equal(rows.length, 8)
  assert.equal(rows[0].test.title, 'Test 01')
  rows.forEach(r => {
    assert.equal(r.papers.length, SUBJECTS.length)
    r.papers.forEach(p => { assert.ok(p.setter); assert.ok(p.verifier); assert.notEqual(p.setter, p.verifier) })
  })
  const m1 = rows.map(r => r.papers.find(p => p.subject === 'Mathematics I').setter)
  assert.deepEqual(m1.slice(0, 4), ['Kabiraj', 'Lenin', 'Kabiraj', 'Lenin'])
  const more = buildSchedule({ start: '2026-12-07', count: 8, startNo: 9, skipDates: ['2026-12-07'] })
  assert.equal(more.length, 7)
  assert.equal(more[0].test.test_no, 9)
})

test('checker for a one-teacher subject comes from another subject', () => {
  assert.equal(checkerFor('Reasoning', 'Roshan', DEFAULT_PANEL), 'Manglemba')
  assert.equal(checkerFor('English Grammar', 'Manglemba', DEFAULT_PANEL), 'Adison')
})

const papers = [{ subject: 'Mathematics I', questions: 25, marks_each: 2 }, { subject: 'EVS', questions: 10, marks_each: 2 }]
const rows = [
  { student_id: 'a', student_name: 'Asha', batch: 'Udaan', subject: 'Mathematics I', marks: 40 },
  { student_id: 'a', student_name: 'Asha', batch: 'Udaan', subject: 'EVS', marks: 20 },
  { student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'Mathematics I', marks: 30 },
  { student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'EVS', absent: true, marks: null },
  { student_id: 'c', student_name: 'Chaoba', batch: 'Udaan', subject: 'Mathematics I', absent: true },
  { student_id: 'd', student_name: 'Dina', batch: 'Pragati', subject: 'Mathematics I', marks: 30 },
]

test('ranking uses % of papers sat; ties share a rank; fully absent last', () => {
  const r = rankResults(rows, papers)
  assert.deepEqual(r.map(x => [x.student_name, x.rank, x.pct]), [['Asha', 1, 85.7], ['Bina', 2, 60], ['Dina', 2, 60], ['Chaoba', null, null]])
  assert.equal(r[1].subjects.EVS, 'AB')
})

test('mark validation', () => {
  assert.equal(markError('', 50), '')
  assert.equal(markError('51', 50), 'More than 50')
  assert.equal(markError('-1', 50), 'Below 0')
  assert.equal(markError('x', 50), 'Not a number')
  assert.equal(markError('49.5', 50), '')
})

test('analyser figures', () => {
  const s = subjectStats(rows, papers)
  assert.deepEqual(s[0], { subject: 'Mathematics I', max: 50, sat: 3, absent: 1, avg: 33.3, high: 40, low: 30, avgPct: 66.7, weak: 0 })
  const ranked = rankResults(rows, papers)
  assert.deepEqual(scoreBands(ranked).map(b => b.count), [0, 1, 2, 0, 0])
  assert.deepEqual(batchAverages(ranked), [{ batch: 'Udaan', students: 1, avgPct: 85.7 }, { batch: 'Pragati', students: 2, avgPct: 60 }])
  assert.deepEqual(topPerBatch(ranked, 1).map(w => [w.student_name, w.batchRank]), [['Asha', 1], ['Bina', 1], ['Dina', 1]])
})

test('series ranking averages across tests and shows the change', () => {
  const tests = [{ id: 't1' }, { id: 't2' }]
  const p = { t1: papers, t2: papers }
  const marks = [
    ...rows.map(r => ({ ...r, test_id: 't1' })),
    { test_id: 't2', student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'Mathematics I', marks: 50 },
    { test_id: 't2', student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'EVS', marks: 20 },
  ]
  const s = seriesRanking(marks, tests, p)
  const bina = s.find(x => x.student_name === 'Bina')
  assert.equal(bina.pct, 80); assert.equal(bina.change, 40); assert.equal(bina.rank, 2)
  assert.equal(s[0].student_name, 'Asha')
})

test('helpers', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'])
  assert.ok(nameMatches('Sir Roshan Singh', 'Roshan')); assert.ok(!nameMatches('Roshani', 'Roshan'))
  assert.equal(safeUrl('javascript:alert(1)'), ''); assert.equal(safeUrl('https://x.org/a'), 'https://x.org/a')
})

import { prizeList, testCycle, splitChapters } from '../src/missionFoundationData.js'

test('prize list: toppers, subject toppers, most improved and full attendance', () => {
  const tests = [{ id: 't1' }, { id: 't2' }]
  const p = { t1: papers, t2: papers }
  const marks = [
    ...rows.map(r => ({ ...r, test_id: 't1' })),
    { test_id: 't2', student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'Mathematics I', marks: 50 },
    { test_id: 't2', student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'EVS', marks: 20 },
  ]
  const one = prizeList({ marks, tests: [tests[0]], papersByTest: p, topN: 1 })
  assert.deepEqual(one.filter(x => x.group === 'Toppers').map(x => x.student_name), ['Asha', 'Bina', 'Dina'])
  assert.deepEqual(one.filter(x => x.group === 'Subject toppers').map(x => [x.award, x.student_name]), [['Subject Topper · Mathematics I', 'Asha'], ['Subject Topper · EVS', 'Asha']])
  const all = prizeList({ marks, tests, papersByTest: p, series: true, topN: 1 })
  assert.deepEqual(all.filter(x => x.group === 'Most improved').map(x => x.student_name), ['Bina'])
  assert.deepEqual(all.filter(x => x.group === 'Full attendance').map(x => x.student_name), ['Bina'])
  // Maths I: Asha 80% (one test), Bina (60 + 100) / 2 = 80% → a tie, both get the prize
  assert.deepEqual(all.filter(x => x.award_key === 'subject-maths1').map(x => x.student_name).sort(), ['Asha', 'Bina'])
})

test('test cycle shows the next step', () => {
  const papers2 = [{ subject: 'EVS', syllabus: 'Plants; Water', status: 'Approved' }]
  const c = testCycle({ papers: papers2, teaching: [{ subject: 'EVS', chapter: 'Plants', done: true }], checklist: {}, marksRows: 0, students: 10 })
  assert.equal(c.current, 0)
  assert.equal(c.steps[0].value, 0.5)
  assert.equal(c.steps[1].value, 1)
  assert.deepEqual(splitChapters('A; B\nC;'), ['A', 'B', 'C'])
})

import { copyFormatPlan } from '../src/missionFoundationData.js'

test('copy format: updates matching papers, adds missing subjects, skips approved ones', () => {
  const src = [
    { subject: 'Mathematics I', questions: 20, marks_each: 1, setter: 'Kabiraj', verifier: 'Roshan', syllabus: 'Fractions' },
    { subject: 'EVS', questions: 20, marks_each: 1, setter: 'Arjun', verifier: 'Roshan' },
  ]
  const targets = [
    { test_id: 't2', papers: [{ id: 'p1', subject: 'Mathematics I', questions: 25, marks_each: 2, setter: 'Lenin', status: 'Pending' }] },
    { test_id: 't3', papers: [
      { id: 'p2', subject: 'Mathematics I', questions: 20, marks_each: 1, status: 'Pending' },
      { id: 'p3', subject: 'EVS', questions: 25, marks_each: 2, status: 'Approved' },
    ] },
  ]
  const plan = copyFormatPlan(src, targets, { pattern: true })
  assert.deepEqual(plan.updates, [{ id: 'p1', patch: { questions: 20, marks_each: 1 } }])
  assert.equal(plan.inserts.length, 1)
  assert.deepEqual([plan.inserts[0].test_id, plan.inserts[0].subject, plan.inserts[0].questions, plan.inserts[0].setter], ['t2', 'EVS', 20, ''])
  assert.equal(plan.skipped, 1)
  const withTeachers = copyFormatPlan(src, targets.slice(0, 1), { pattern: true, teachers: true, syllabus: true })
  assert.deepEqual(withTeachers.updates[0].patch, { questions: 20, marks_each: 1, setter: 'Kabiraj', verifier: 'Roshan', syllabus: 'Fractions' })
})

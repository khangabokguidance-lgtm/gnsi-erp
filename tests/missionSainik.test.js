import test from 'node:test'
import assert from 'node:assert/strict'
import { TESTS, MOCK_TESTS, HOLIDAYS, buildSeedRows, nameMatches, safeUrl, PANEL, PRACTICE_PANEL, SUBJECTS } from '../src/missionSainikData.js'
import { parseQuestions, fetchAll } from '../src/lib/missionSainikQuestions.js'

test('schedule: 20 Pre Mock tests on alternate days, none on a holiday, ending 8 Jan 2027', () => {
  assert.equal(TESTS.length, 20)
  assert.equal(TESTS[0].date, '2026-11-30'); assert.equal(TESTS[19].date, '2027-01-08')
  for (const t of TESTS) assert.ok(!HOLIDAYS.includes(t.date), t.id)
  for (const t of TESTS) assert.ok(t.drafts <= t.verify && t.verify <= t.print && t.print <= t.date, t.id)
})
test('mock series: 20 tests, 10-30 Jan 2027, 26 Jan skipped', () => {
  assert.equal(MOCK_TESTS.length, 20)
  assert.equal(MOCK_TESTS[0].date, '2027-01-10'); assert.equal(MOCK_TESTS[19].date, '2027-01-30')
  assert.ok(!MOCK_TESTS.some(t => t.date === '2027-01-26'))
})
test('allotment: 20 tests x 6 sections + practice sets, unique per (test, subject, setter), nobody verifies themselves', () => {
  const rows = buildSeedRows()
  assert.equal(rows.filter(r => r.kind === 'test').length, 120)
  const keys = rows.map(r => [r.kind, r.test_no, r.subject, r.setter].join('|'))
  assert.equal(new Set(keys).size, keys.length)
  for (const r of rows) assert.notEqual(r.setter, r.verifier)
  assert.ok(Object.keys(PANEL).every(k => SUBJECTS.some(s => s.key === k) && PRACTICE_PANEL[k]))
})
test('name matching is whole-word and case-insensitive', () => {
  assert.equal(nameMatches('Sir Sumanta Singh', 'Sumanta'), true)
  assert.equal(nameMatches('sumanta.staff', 'Sumanta'), true)
  assert.equal(nameMatches('Boyd', 'Boy'), false)
  assert.equal(nameMatches('', 'Boy'), false); assert.equal(nameMatches('Boy', ''), false)
})
test('only http(s) links are accepted', () => {
  assert.equal(safeUrl('javascript:alert(1)'), ''); assert.equal(safeUrl('data:text/html,x'), ''); assert.equal(safeUrl('not a url'), '')
  assert.equal(safeUrl(' https://drive.google.com/a '), 'https://drive.google.com/a')
})
const Q = `Q1. 3/4 + 1/4?
A) 1/2
B) 1
C) 3/4
D) 2
Ans: B
Exp: add numerators
Topic: Fractions
Level: hard

2. Capital of Manipur?
(A) Imphal
(B) Kohima
(C) Aizawl
(D) Shillong
Answer: (a)`
test('parser reads both numbering styles, options, answer, explanation, topic, level', () => {
  const { questions, errors } = parseQuestions(Q)
  assert.equal(errors.length, 0); assert.equal(questions.length, 2)
  assert.deepEqual([questions[0].answer, questions[0].difficulty, questions[0].topic], ['B', 'Hard', 'Fractions'])
  assert.equal(questions[1].answer, 'A'); assert.equal(questions[1].option_d, 'Shillong')
})
test('parser rejects incomplete questions and keeps wrapped lines', () => {
  const bad = parseQuestions('Q1. Only a stem\nA) x')
  assert.equal(bad.questions.length, 0); assert.match(bad.errors[0], /option B.*Ans/)
  const wrap = parseQuestions('Q1. A very long\nquestion text\nA) a\nB) b\nC) c\nD) d\nAns: C')
  assert.equal(wrap.questions[0].question, 'A very long question text')
  assert.equal(parseQuestions('').questions.length, 0)
})
test('fetchAll pages past the 1000-row API limit', async () => {
  const rows = Array.from({ length: 2300 }, (_, i) => ({ id: i }))
  const make = () => ({ range: async (a, b) => ({ data: rows.slice(a, b + 1), error: null }) })
  const { data } = await fetchAll(make)
  assert.equal(data.length, 2300); assert.equal(data[2299].id, 2299)
  const err = await fetchAll(() => ({ range: async () => ({ data: null, error: { message: 'x' } }) }))
  assert.equal(err.data, null)
})

import { buildNoticeHtml } from '../src/lib/missionSainikNotice.js'
test('printed notice carries the clauses, all five annexures, live syllabus and escapes input', () => {
  const html = buildNoticeHtml({ orderNo: 'GNSI/MS-2027/PMT/2026/01', orderDate: '2026-11-16', deadline: '2026-11-28', syl: { '1|Mathematics': 'Fractions <b>' }, institute: { name: 'GNSI' } })
  for (const t of ['GNSI/MS-2027/PMT/2026/01', 'Subject_SetterName_PMT-XX.docx', '40% easy', 'ANNEXURE-I<', 'ANNEXURE-II<', 'ANNEXURE-III<', 'ANNEXURE-IV<', 'ANNEXURE-V<', 'Use of the GNSI Portal', 'PMT-20', 'Sir Sumanta', '28 November 2026'])
    assert.ok(html.includes(t), t)
  assert.ok(html.includes('Fractions &lt;b&gt;') && !html.includes('Fractions <b>'))
})

import { computeGame } from '../src/lib/missionSainikGame.js'
test('game: xp, level, streak and badges are computed from my own work only', () => {
  const me = n => n === 'Sumanta'
  const rows = [
    { setter: 'Sumanta', status: 'Submitted', updated_by: 'Sir Sumanta', updated_at: '2026-11-16T09:00:00Z', due: '2026-11-28' },
    { setter: 'Sumanta', status: 'Approved', updated_by: 'Sir Sumanta', updated_at: '2026-11-15T09:00:00Z', due: '2026-11-28' },
    { setter: 'Sumanta', status: 'Pending', due: '2026-11-10' },
    { setter: 'Johny', status: 'Approved', verifier: 'Sumanta', updated_by: 'x', updated_at: '2026-11-14T00:00:00Z', due: '2026-11-28' },
    { setter: 'Johny', status: 'Submitted', due: '2026-11-28' },
  ]
  const g = computeGame({ rows, mats: [{ uploaded_by: 'Sir Sumanta', created_at: '2026-11-14T10:00:00Z' }], userName: 'Sir Sumanta', isMe: me, today: '2026-11-16' })
  assert.equal(g.xp, 2 * 20 + 10 + 15 + 5)               // 2 submitted-or-beyond, 1 approved, 1 verified for others, 1 upload
  assert.equal(g.level, 1); assert.equal(g.levelTitle, 'Cadet')
  assert.equal(g.streak, 3)                               // 14th, 15th, 16th
  assert.equal(g.badges.find(b => b.id === 'first').on, true)
  assert.equal(g.badges.find(b => b.id === 'clean').on, false)   // one of mine is overdue
  const none = computeGame({ rows: [], mats: [], userName: '', isMe: () => false, today: '2026-11-16' })
  assert.equal(none.xp, 0); assert.equal(none.streak, 0); assert.equal(none.levelTitle, 'Recruit')
})

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

import { makeVersion, paperHealth, csvToQuestionText, parseCsv, omrHtml } from '../src/lib/missionSainikPaper.js'
const mk = (n, ans = 'B') => ({ id: n, test_no: 1, question: 'Question number ' + n, option_a: 'a' + n, option_b: 'b' + n, option_c: 'c' + n, option_d: 'd' + n, answer: ans, difficulty: ['Easy', 'Medium', 'Hard'][n % 3], topic: 't', explanation: 'e' })
test('versions: same seed gives the same paper, different seed differs, and the answer follows its option', () => {
  const items = Array.from({ length: 12 }, (_, i) => mk(i + 1, ['A', 'B', 'C', 'D'][i % 4]))
  const a1 = makeVersion(items, { seed: 'x|A', shuffleQ: true, shuffleOpts: true }), a2 = makeVersion(items, { seed: 'x|A', shuffleQ: true, shuffleOpts: true }), b = makeVersion(items, { seed: 'x|B', shuffleQ: true, shuffleOpts: true })
  assert.deepEqual(a1.map(q => q.id), a2.map(q => q.id))
  assert.notDeepEqual(a1.map(q => q.id), b.map(q => q.id))
  for (const q of b) { assert.equal(q.opts.find(o => o.k === q.answer).orig, q.origAnswer); assert.deepEqual(q.opts.map(o => o.k), ['A', 'B', 'C', 'D']) }
  const plain = makeVersion(items, {}); assert.deepEqual(plain.map(q => q.id), items.map(q => q.id)); assert.equal(plain[0].answer, items[0].answer)
})
test('health: flags answer bias, repeats inside a test and reuse across tests', () => {
  const items = Array.from({ length: 25 }, (_, i) => mk(i + 1, 'B'))
  const repeat = { ...mk(99), question: 'Question number 1' }
  const h = paperHealth([{ label: 'Maths', q: 26, items: [...items, repeat] }], [{ test_no: 2, question: 'Question number 5' }], 1)
  const byId = Object.fromEntries(h.checks.map(c => [c.id, c.ok]))
  assert.equal(byId.bias, false); assert.equal(byId.dup, false); assert.equal(byId.across, false); assert.equal(byId.count, true)
  assert.ok(h.score < 100)
  const clean = paperHealth([{ label: 'M', q: 4, items: [mk(1, 'A'), mk(2, 'B'), mk(3, 'C'), mk(4, 'D')] }], [], 1)
  assert.equal(clean.checks.find(c => c.id === 'dup').ok, true)
})
test('csv: quoted commas and a header row convert to the builder text format and parse back', async () => {
  const csv = 'Question,A,B,C,D,Answer,Explanation,Topic,Level\n"Which is bigger, 3 or 5?",3,5,"1,000",0,b,"Five is bigger",Numbers,easy\n'
  assert.equal(parseCsv(csv).length, 2)
  const text = csvToQuestionText(csv)
  assert.match(text, /Q1\. Which is bigger, 3 or 5\?/); assert.match(text, /C\) 1,000/); assert.match(text, /Ans: B/)
  const { parseQuestions } = await import('../src/lib/missionSainikQuestions.js')
  const r = parseQuestions(text); assert.equal(r.errors.length, 0); assert.equal(r.questions[0].answer, 'B'); assert.equal(r.questions[0].difficulty, 'Easy')
})
test('omr sheet has one row per question with four bubbles', () => {
  const html = omrHtml({ title: 'PMT-01', total: 150, autoPrint: false })
  assert.equal((html.match(/class="r"/g) || []).length, 150); assert.equal((html.match(/class="b"/g) || []).length, 600)
})

test('parser: Passage blocks attach to the questions that follow until End passage', () => {
  const { questions, errors } = parseQuestions(`Passage: The ancient Greeks made a list of wonders.
It was called the Seven Wonders.
Q1. What was the list called?
A) Wonders
B) Seven Wonders
C) Greek list
D) Nothing
Ans: B
Q2. Who made the list?
A) Greeks
B) Romans
C) Persians
D) Indians
Ans: A
End passage
Q3. Plain question?
A) a
B) b
C) c
D) d
Ans: C`)
  assert.equal(errors.length, 0); assert.equal(questions.length, 3)
  assert.equal(questions[0].passage, 'The ancient Greeks made a list of wonders. It was called the Seven Wonders.')
  assert.equal(questions[1].passage, questions[0].passage); assert.equal(questions[2].passage, undefined)
})
test('versions: questions sharing a passage stay together and in order when shuffled', () => {
  const items = [1, 2, 3, 4, 5, 6].map(n => ({ ...mk(n), passage: n <= 3 ? 'P1' : n === 4 ? '' : 'P2' }))
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const ids = makeVersion(items, { seed, shuffleQ: true }).map(q => q.id)
    const i1 = ids.indexOf(1); assert.deepEqual(ids.slice(i1, i1 + 3), [1, 2, 3])
    const i5 = ids.indexOf(5); assert.deepEqual(ids.slice(i5, i5 + 2), [5, 6])
  }
})

import { mergePaperConfig, orderedSections, defaultPaperConfig } from '../src/lib/missionSainikPaper.js'
test('paper settings: defaults, saved order, hidden sections, bad values clamped', () => {
  const secs = [{ label: 'Maths', q: 25 }, { label: 'Reasoning', q: 25 }, { label: 'GK', q: 25 }]
  assert.equal(defaultPaperConfig(secs).columns, 2)
  const pc = mergePaperConfig(secs, { columns: 3, size: 99, font: 'nope', sections: [{ label: 'GK', title: 'General Knowledge', include: true }, { label: 'Maths', include: false }, { label: 'Gone' }] })
  assert.equal(pc.columns, 2); assert.equal(pc.size, 14); assert.equal(pc.font, 'times')
  assert.deepEqual(pc.sections.map(s => s.label), ['GK', 'Maths', 'Reasoning'])           // saved order, unknown dropped, new appended
  assert.deepEqual(orderedSections(secs, pc).map(s => s.title), ['General Knowledge', 'Reasoning'])   // Maths hidden
  assert.equal(orderedSections(secs, pc, { onlyIncluded: false }).length, 3)
  assert.equal(mergePaperConfig(secs, null).sections.length, 3)
})

import { toCsv, buildIcs, parseSyllabusText, parseMarksText } from '../src/lib/missionSainikExport.js'
test('csv export neutralises formulas and quotes; ics has all-day events with the next day as the end', () => {
  const csv = toCsv([['a', '=SUM(1)'], ['x,y', 'say "hi"']])
  assert.ok(csv.includes("\"'=SUM(1)\"")); assert.ok(csv.includes('"x,y"')); assert.ok(csv.includes('"say ""hi"""'))
  const text = buildIcs([{ uid: 'pmt-1', date: '2026-12-31', title: 'PMT-01, test; part', description: 'line1\nline2' }], 'Cal', new Date('2026-11-16T00:00:00Z'))
  assert.match(text, /BEGIN:VCALENDAR/); assert.match(text, /DTSTART;VALUE=DATE:20261231/); assert.match(text, /DTEND;VALUE=DATE:20270101/)
  assert.match(text, /SUMMARY:PMT-01\\, test\\; part/); assert.match(text, /DESCRIPTION:line1\\nline2/); assert.ok(text.endsWith('END:VCALENDAR\r\n'))
})
test('syllabus and marks imports validate lines', () => {
  const subjects = [{ key: 'maths', label: 'Mathematics', short: 'Maths' }, { key: 'gk', label: 'General Knowledge', short: 'GK' }]
  const s = parseSyllabusText('Test,Subject,Chapter\n1,Maths,Fractions, decimals\nT2\tGK\tRivers\n25,Maths,x\n3,Art,y', subjects)
  assert.deepEqual(s.rows, [{ test_no: 1, subject: 'Mathematics', chapter: 'Fractions, decimals' }, { test_no: 2, subject: 'General Knowledge', chapter: 'Rivers' }])
  assert.equal(s.errors.length, 2)
  const maxima = [['maths', 'Maths', 60], ['reasoning', 'Reasoning', 20]]
  const m = parseMarksText('1,Batch A,45,18\n2,Batch A,70,10\n3,Batch B,30,', maxima)
  assert.equal(m.rows.length, 2); assert.equal(m.rows[1].reasoning, null); assert.match(m.errors[0], /maths must be 0–60/)
})

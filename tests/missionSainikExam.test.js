import test from 'node:test'
import assert from 'node:assert/strict'
import { EXAM_KINDS, examSections, admitSchedule, admitTitle, parseMark, buildMarkRows, entriesFromRows, rankResults } from '../src/lib/missionSainikExam.js'

test('Pre Mock has six sections of 50 (300 marks); Mega Mock follows the AISSEE pattern (300 marks)', () => {
  const pre = examSections('pre'), mega = examSections('mega')
  assert.equal(pre.length, 6); assert.equal(pre.reduce((a, s) => a + s.max, 0), 300)
  assert.equal(mega.reduce((a, s) => a + s.max, 0), 300); assert.equal(mega[0].max, 150)
  assert.equal(EXAM_KINDS.pre.tests().length, 20); assert.equal(EXAM_KINDS.mega.tests().length, 20)
})

test('admit card schedule: one row per section with the same date, time and hall', () => {
  const t = EXAM_KINDS.pre.tests()[4]
  const rows = admitSchedule('pre', t, { time: '10:00 AM', room: 'Hall A' })
  assert.equal(rows.length, 6); assert.ok(rows.every(r => r.exam_date === t.date && r.time === '10:00 AM' && r.room === 'Hall A' && r.shift === 'Morning'))
  assert.equal(admitTitle('pre', t), 'Mission Sainik 2027 · PMT-05')
})

test('parseMark: blank, number, out of range and not a number', () => {
  assert.deepEqual(parseMark('', 50), { value: null, error: '' })
  assert.deepEqual(parseMark(' 12.256 ', 50), { value: 12.26, error: '' })
  assert.match(parseMark('51', 50).error, /At most 50/); assert.match(parseMark('-1', 50).error, /0 or more/); assert.match(parseMark('abc', 50).error, /number/)
})

test('buildMarkRows saves only students who appeared, totals the marks and ranks (ties share)', () => {
  const test = EXAM_KINDS.pre.tests()[0]
  const students = [{ id: 1, name: 'Asha', gcc: '101' }, { id: 2, name: 'Bimol', gcc: '102' }, { id: 3, name: 'Chaoba', gcc: '103' }, { id: 4, name: 'Deepa', gcc: '104' }, { id: 5, name: 'Eben', gcc: '105' }]
  const entries = {
    1: { marks: { Mathematics: '40', Reasoning: '30' }, absent: false },
    2: { marks: { Mathematics: '40', Reasoning: '30' }, absent: false },
    3: { marks: { Mathematics: '45' }, absent: false },
    4: { marks: { Mathematics: '50' }, absent: true },          // absent: not saved even though a mark was typed
    5: { marks: {}, absent: false },                            // nothing entered: not saved
  }
  const rows = buildMarkRows({ series: 'Pre Mock Test 2027', test, batch: 'Achiever', kind: 'pre', students, entries, who: 'Admin' })
  assert.deepEqual(rows.map(r => [r.student_name, r.total, r.rank]), [['Asha', 70, 1], ['Bimol', 70, 1], ['Chaoba', 45, 3]])
  assert.equal(rows[0].max_total, 300); assert.equal(rows[0].series, 'Pre Mock Test 2027'); assert.equal(rows[0].test_no, 1); assert.equal(rows[0].batch, 'Achiever')
  assert.deepEqual(rows[0].max_marks.Mathematics, 50)
})

test('entriesFromRows puts saved marks back on the sheet by GCC number, ignoring leading zeros', () => {
  const students = [{ id: 1, name: 'Asha', gcc: '000101' }, { id: 2, name: 'Bimol', gcc: '102' }]
  const e = entriesFromRows([{ gcc_no: '101', student_name: 'Asha D', marks: { Mathematics: 12.5 } }], students)
  assert.deepEqual(e, { 1: { marks: { Mathematics: '12.5' }, absent: false } })
})

test('rankResults: percentage over all tests (or one test), highest first, ties share a rank', () => {
  const rows = [
    { gcc_no: '1', student_name: 'A', batch: 'X', test_no: 1, total: 200, max_total: 300 }, { gcc_no: '1', student_name: 'A', batch: 'X', test_no: 2, total: 100, max_total: 300 },
    { gcc_no: '2', student_name: 'B', batch: 'X', test_no: 1, total: 150, max_total: 300 }, { gcc_no: '2', student_name: 'B', batch: 'X', test_no: 2, total: 150, max_total: 300 },
    { gcc_no: '3', student_name: 'C', batch: 'Y', test_no: 1, total: 240, max_total: 300 },
  ]
  const all = rankResults(rows)
  assert.deepEqual(all.map(x => [x.name, x.pct, x.rank]), [['C', 80, 1], ['A', 50, 2], ['B', 50, 2]])
  assert.deepEqual(rankResults(rows, { testNo: 1 }).map(x => [x.name, x.rank]), [['C', 1], ['A', 2], ['B', 3]])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { TIMETABLE, TT_CLASSES, TT_PERIODS, subjectKey, classOfBatch, periodsOf, checkTimetable, teacherLoad, revisionPlan } from '../src/lib/revisionPlan.js'

test('every class has one subject in each of the 6 periods', () => {
  TT_CLASSES.forEach((c) => { const p = periodsOf(c.id); assert.equal(p.length, 6, c.id); assert.deepEqual(p.map((x) => x.period), [1, 2, 3, 4, 5, 6]) })
  assert.equal(TT_PERIODS.length, 6)
})
test('printed time table has no clashes', () => assert.deepEqual(checkTimetable(), []))
test('a teacher in two classes at once is flagged', () => {
  const bad = [...TIMETABLE, { period: 1, classes: ['CH'], subject: 'X', teacher: 'Bronson', key: 'x' }]
  assert.equal(checkTimetable(bad).filter((i) => i.type === 'teacher').length, 1)
  assert.equal(checkTimetable([...TIMETABLE, { period: 1, classes: ['LA'], subject: 'Y', teacher: 'Zed', key: 'y' }]).filter((i) => i.type === 'class').length, 1)
})
test('subjects line up with mock-test columns', () => {
  assert.equal(subjectKey('Mathematics'), 'maths'); assert.equal(subjectKey('Maths II Revision'), 'maths')
  assert.equal(subjectKey('Passage & Vocabulary'), 'passage'); assert.equal(subjectKey('Passage'), 'passage')
  assert.equal(subjectKey('Mental Ability'), 'mental'); assert.equal(subjectKey('EVS Revision I'), 'evs')
  assert.equal(classOfBatch('Lakshya A').id, 'LA'); assert.equal(classOfBatch('Umeed (Eng)').id, 'UM'); assert.equal(classOfBatch('Lakshya'), null)
})
test('Lakshya B and Umeed share the Maths revision with Himan', () => {
  const p = periodsOf('UM').find((x) => x.period === 2); assert.equal(p.teacher, 'Himan'); assert.ok(p.shared)
})
test('teacher load counts periods', () => {
  const him = teacherLoad().find((t) => t.teacher === 'Himan'); assert.equal(him.periods, 3)
})
const row = (sid, batch, marks) => ({ sid, student_name: sid, batch, test_no: 1, marks, max_marks: { Mathematics: 100, EVS: 100, Passage: 100, 'Mental Ability': 100 }, total: Object.values(marks).reduce((a, b) => a + b, 0), max_total: 400 })
test('revision plan matches weak subjects to periods', () => {
  const rows = [row('a', 'Lakshya A', { Mathematics: 30, EVS: 80, Passage: 70, 'Mental Ability': 60 }), row('b', 'Lakshya A', { Mathematics: 40, EVS: 90, Passage: 70, 'Mental Ability': 50 }), row('c', 'Umeed', { Mathematics: 90, EVS: 90, Passage: 90, 'Mental Ability': 90 })]
  const r = revisionPlan(rows, 'LA')
  assert.equal(r.students, 2)
  assert.equal(r.subjects[0].name, 'Mathematics'); assert.equal(r.subjects[0].count, 2); assert.equal(r.subjects[0].avg, 35)
  assert.equal(r.subjects.find((s) => s.key === 'evs').count, 2)
  assert.equal(r.subjects.find((s) => s.key === 'mental').count, 1)
  assert.ok(r.advice.some((a) => /below the pass mark/.test(a)))
  assert.equal(revisionPlan([], 'LA').hasResults, false)
  assert.equal(revisionPlan(rows, 'ZZ'), null)
})

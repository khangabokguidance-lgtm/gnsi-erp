// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clockMinutes, periodSpan, teacherKey, sameTeacher, matchStaff, teacherList, teacherLoad,
  findClashes, isBusy, suggestSubstitutes, nowAndNext, dayOf,
} from '../src/timetableTools.js'

const row = (day, period, cls, subject, teacher) => ({ day_name: day, period_name: period, class_name: cls, subject_name: subject, teacher_name: teacher })
const P1 = '7:30 AM–8:20 AM', P2 = '8:20 AM–9:10 AM'

test('times and periods are read in minutes, including PM and a point in time', () => {
  assert.equal(clockMinutes('7:30 AM'), 450)
  assert.equal(clockMinutes('12:20 PM'), 740)
  assert.equal(clockMinutes('12:05 AM'), 5)
  assert.deepEqual(periodSpan('9:00 PM–10:30 PM'), { start: 1260, end: 1350 })
  assert.deepEqual(periodSpan('7:10 AM - 7:25 AM'), { start: 430, end: 445 })
  assert.deepEqual(periodSpan('10:30 PM'), { start: 1350, end: 1350 })
})

test('the same teacher is recognised across titles and short or full first names', () => {
  assert.equal(teacherKey('Sir Himan'), 'himan')
  assert.equal(teacherKey('Madam  Sandhya Devi'), 'sandhya')
  assert.ok(sameTeacher('Sir Himan', 'Himanshu Singh'))
  assert.ok(sameTeacher('Mr. Lenin', 'sir lenin'))
  assert.ok(!sameTeacher('Sir Arjun', 'Sir Arunkumar'))
  assert.ok(!sameTeacher('Sir Al', 'Alok'), 'two letters is too short to match')
  assert.equal(matchStaff('Sir Kabiraj', [{ name: 'Lenin' }, { name: 'Kabiraj Sharma' }]).name, 'Kabiraj Sharma')
})

test('one teacher is listed once however the name is written', () => {
  const list = teacherList([row('Monday', P1, 'A', 'Maths', 'Sir Himan'), row('Monday', P2, 'B', 'Maths', 'Himanshu')])
  assert.equal(list.length, 1)
  assert.deepEqual(list[0].names.sort(), ['Himanshu', 'Sir Himan'])
})

test('workload counts a joint class as one period and spreads periods over the week', () => {
  const load = teacherLoad([
    row('Monday', P1, 'Lakshya B', 'Mathematics Revision', 'Sir Himan'),
    row('Monday', P1, 'Umeed', 'Mathematics Revision', 'Sir Himan'),
    row('Monday', P2, 'Champion', 'Maths', 'Sir Himan'),
    row('Tuesday', P1, 'Umeed', 'Maths', 'Sir Himan'),
    row('Monday', P1, 'ALL', 'Morning Assembly', null),
  ])
  assert.equal(load.length, 1)
  assert.equal(load[0].total, 3)
  assert.equal(load[0].perDay.Monday, 2)
  assert.equal(load[0].maxDay, 2)
  assert.deepEqual(load[0].batches, ['Champion', 'Lakshya B', 'Umeed'])
})

test('a teacher in two batches at once is a clash; the same subject together is a joint class', () => {
  const found = findClashes([
    row('Monday', P1, 'Lakshya B', 'Mathematics Revision', 'Sir Himan'),
    row('Monday', P1, 'Umeed', 'Mathematics Revision', 'Sir Himan'),
    row('Monday', P2, 'Champion', 'GK', 'Sir Deepak'),
    row('Monday', '8:40 AM–9:30 AM', 'Leader', 'Science', 'Sir Deepak'),
    row('Tuesday', P2, 'Champion', 'GK', 'Sir Deepak'),
  ])
  assert.equal(found.length, 2)
  assert.equal(found[0].kind, 'clash')
  assert.equal(found[0].teacher, 'Sir Deepak')
  assert.equal(found[1].kind, 'joint')
  assert.deepEqual(found[1].entries.map(e => e.class_name), ['Lakshya B', 'Umeed'])
})

test('substitutes are free, present and not already covering; same subject and lighter days first', () => {
  const entries = [
    row('Monday', P1, 'Umeed', 'Environmental Studies I', 'Sir Pawan'),
    row('Monday', P1, 'Champion', 'Science', 'Sir Basanta'),
    row('Monday', P2, 'Leader', 'Environmental Studies II', 'Sir Chetan'),
    row('Monday', '9:40 AM–10:30 AM', 'Leader', 'EVS', 'Sir Chetan'),
    row('Monday', P2, 'Udaan', 'Reasoning', 'Sir Roshan'),
    row('Tuesday', P1, 'Udaan', 'Reasoning', 'Sir Roshan'),
  ]
  const staff = [{ name: 'Pawan Kumar' }, { name: 'Basanta' }, { name: 'Chetan' }, { name: 'Roshan' }, { name: 'Deepak' }]
  const s = suggestSubstitutes(entries, { day: 'Monday', periodName: P1, subject: 'Environmental Studies I', staff, absentNames: ['Pawan Kumar'], subsToday: [{ substitute_teacher: 'Deepak', period_name: P1 }] })
  const names = s.map(x => x.name)
  assert.ok(!names.includes('Pawan Kumar'), 'absent')
  assert.ok(!names.includes('Basanta'), 'teaching then')
  assert.ok(!names.includes('Deepak'), 'already covering another class then')
  assert.equal(names[0], 'Chetan', 'teaches Environmental Studies')
  assert.ok(s[0].subjectMatch)
  assert.equal(names[1], 'Roshan')
  assert.ok(isBusy(entries, 'Sir Basanta', 'Monday', '8:00 AM–8:30 AM'))
  assert.ok(!isBusy(entries, 'Sir Basanta', 'Tuesday', P1))
})

test('now and next follow the clock, with whole-institute rows counting for every batch', () => {
  const entries = [
    row('Monday', '7:10 AM–7:25 AM', 'ALL', 'Morning Assembly', null),
    row('Monday', P1, 'Umeed', 'EVS', 'Sir Pawan'),
    row('Monday', P2, 'Umeed', 'Maths', 'Sir Himan'),
    row('Monday', P1, 'Leader', 'GK', 'Sir Deepak'),
  ]
  const at = m => nowAndNext(entries, { day: 'Monday', batch: 'Umeed', minutes: m })
  assert.equal(at(435).now.subject_name, 'Morning Assembly')
  assert.equal(at(435).next.subject_name, 'EVS')
  assert.equal(at(460).now.subject_name, 'EVS')
  assert.equal(at(445).now, null, 'between assembly and period 1')
  assert.equal(at(600).next, null)
  assert.equal(at(460).rows.length, 3)
  assert.equal(dayOf('2026-10-26'), 'Monday')
})

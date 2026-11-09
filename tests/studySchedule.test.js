import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SCHEDULE, mergeSchedule, slotFor, roomFor, withSchedule, stripScheduleDefaults } from '../src/lib/studySchedule.js'
import { slotText, slotClashes, roomClashes } from '../src/lib/dutyInstruction.js'

test('the default schedule is the one asked for: Passage 6-7 am, Maths 3:15-4:45 pm, EVS 5:30-7 pm, Group n in Room n', () => {
  assert.equal(slotText(slotFor(DEFAULT_SCHEDULE, 'Passage')), '6:00 am–7:00 am')
  assert.equal(slotText(slotFor(DEFAULT_SCHEDULE, 'Mathematics')), '3:15 pm–4:45 pm')
  assert.equal(slotText(slotFor(DEFAULT_SCHEDULE, 'EVS')), '5:30 pm–7:00 pm')
  assert.equal(slotText(slotFor(DEFAULT_SCHEDULE, 'Mental Ability')), '')     // no slot given for it
  for (let g = 1; g <= 7; g++) assert.equal(roomFor(DEFAULT_SCHEDULE, g), `Room ${g}`)
  assert.equal(roomFor(DEFAULT_SCHEDULE, 0), ''); assert.equal(roomFor(DEFAULT_SCHEDULE, 8), '')
})
test('saved entries override the defaults, and a saved empty time clears a default', () => {
  const m = mergeSchedule({ subjects: { Mathematics: { from: '16:00', to: '17:00', days: ['Mon'] }, EVS: { from: '', to: '' } }, rooms: { 3: 'Lab A' } })
  assert.equal(slotText(slotFor(m, 'Mathematics')), 'Mon · 4:00 pm–5:00 pm')
  assert.equal(slotText(slotFor(m, 'EVS')), '')
  assert.equal(slotText(slotFor(m, 'Passage')), '6:00 am–7:00 am')          // untouched default stays
  assert.equal(roomFor(m, 3), 'Lab A'); assert.equal(roomFor(m, 4), 'Room 4')
  assert.deepEqual(mergeSchedule(null), DEFAULT_SCHEDULE)
})
test('the schedule fills in what an assignment leaves empty; the assignment still wins where it is set', () => {
  const e = withSchedule({ reason: 'Maths booster' }, DEFAULT_SCHEDULE, 'Mathematics', 3)
  assert.deepEqual([e.venue, e.from, e.to, e.reason], ['Room 3', '15:15', '16:45', 'Maths booster'])
  const own = withSchedule({ venue: 'Lab', from: '10:00', to: '11:00', days: ['Fri'] }, DEFAULT_SCHEDULE, 'Mathematics', 3)
  assert.deepEqual([own.venue, own.from, own.to, own.days], ['Lab', '10:00', '11:00', ['Fri']])
  const overall = withSchedule({}, DEFAULT_SCHEDULE, 'Overall marks', 2)
  assert.deepEqual([overall.venue, overall.from], ['Room 2', ''])          // a room, but no time slot for overall marks
  const manual = withSchedule({}, DEFAULT_SCHEDULE, 'Passage', 0)
  assert.deepEqual([manual.venue, manual.from, manual.to], ['', '06:00', '07:00'])   // manual groups: the subject's slot, no room
})
test('saving an instruction drops what only repeats the schedule', () => {
  const s = stripScheduleDefaults({ venue: 'Room 3', from: '15:15', to: '16:45', days: [], reason: 'x', instruction: 'y' }, DEFAULT_SCHEDULE, 'Mathematics', 3)
  assert.deepEqual([s.venue, s.from, s.to, s.reason, s.instruction], ['', '', '', 'x', 'y'])
  const t = stripScheduleDefaults({ venue: 'Lab', from: '10:00', to: '11:00' }, DEFAULT_SCHEDULE, 'Mathematics', 3)
  assert.deepEqual([t.venue, t.from, t.to], ['Lab', '10:00', '11:00'])
})
test('a slot with no days means every day, for person clashes and for room clashes', () => {
  const sec = (label, from, to, days = []) => ({ label, instruction: { from, to, days } })
  assert.deepEqual(slotClashes([sec('A', '15:15', '16:45'), sec('B', '16:00', '17:00', ['Tue'])]).map((c) => c.day), ['Tue'])
  assert.equal(slotClashes([sec('A', '15:15', '16:45'), sec('B', '16:45', '17:30')]).length, 0)         // touching is not a clash
  const it = (label, venue, from, to) => ({ label, venue, instruction: { from, to, days: [] } })
  const c = roomClashes([it('M-G1', 'Room 1', '15:15', '16:45'), it('M-G1b', 'room 1', '15:30', '16:00'), it('E-G1', 'Room 1', '17:30', '19:00'), it('M-G2', 'Room 2', '15:15', '16:45'), it('none', '', '15:15', '16:45')])
  assert.deepEqual(c.map((x) => [x.venue, x.a, x.b, x.days.length]), [['Room 1', 'M-G1', 'M-G1b', 7]])
})

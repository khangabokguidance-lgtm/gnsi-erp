import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyInstruction, pickInstruction, hasInstruction, slotText, slotClashes, instructionMessage, daysFromText, daysToText } from '../src/lib/dutyInstruction.js'

test('days round-trip between the app and the database', () => {
  assert.deepEqual(daysFromText('Mon, Wed,Xyz'), ['Mon', 'Wed']); assert.deepEqual(daysFromText(['Fri']), ['Fri']); assert.deepEqual(daysFromText(null), [])
  assert.equal(daysToText(['Wed', 'Mon']), 'Mon,Wed')   // always in week order
})
test('pickInstruction reads app and database field names', () => {
  assert.deepEqual(pickInstruction({ venue: ' Room 4 ', days: 'Mon,Tue', time_from: '17:00', time_to: '18:00', name: 'ignored' }), { venue: 'Room 4', reason: '', days: ['Mon', 'Tue'], from: '17:00', to: '18:00', instruction: '' })
  assert.deepEqual(pickInstruction(null), emptyInstruction())
  assert.equal(hasInstruction({ name: 'x' }), false); assert.equal(hasInstruction({ reason: 'Maths revision' }), true)
})
test('time slot reads naturally, in week order, 12-hour', () => {
  assert.equal(slotText({ days: ['Wed', 'Mon'], from: '17:00', to: '18:30' }), 'Mon, Wed · 5:00 pm–6:30 pm')
  assert.equal(slotText({ days: ['Sat'], from: '09:05', to: '12:00' }), 'Sat · 9:05 am–12:00 pm')
  assert.equal(slotText({ from: '00:30', to: '01:00' }), '12:30 am–1:00 am')
  assert.equal(slotText({ days: ['Tue'] }), 'Tue'); assert.equal(slotText({}), '')
  assert.equal(slotText({ from: '16:00' }), 'from 4:00 pm')
})
test('clashing slots on the same day are found; touching or different-day slots are not', () => {
  const s = (label, days, from, to) => ({ label, instruction: { days, from, to } })
  const c = slotClashes([s('A', ['Mon', 'Tue'], '17:00', '18:00'), s('B', ['Tue', 'Wed'], '17:30', '18:30'), s('C', ['Mon'], '18:00', '19:00'), s('D', ['Thu'], '17:00', '18:00'), s('E', ['Mon'], '', '')])
  assert.deepEqual(c, [{ a: 'A', b: 'B', day: 'Tue' }])
  assert.deepEqual(slotClashes([s('X', ['Mon'], '18:00', '17:00'), s('Y', ['Mon'], '17:00', '18:00')]), [])   // an invalid (end before start) slot is ignored
})
test('the message to the person has where, why, when and the instruction', () => {
  const person = { name: 'Meera Singh', sections: [
    { label: 'Maths booster', subject: 'Mathematics', students: [1, 2, 3], instruction: { venue: 'Room 4', reason: 'Maths revision', days: ['Tue', 'Thu'], from: '17:00', to: '18:00', instruction: 'Take attendance; report absentees to the House Master.' } },
    { label: 'Combined English · Group 1 · Weakest', subject: 'Overall marks', students: [1], instruction: {} },
  ] }
  const m = instructionMessage(person, 'Pre Mock Test 2026')
  for (const t of ['Dear Meera Singh', 'Maths booster — Mathematics (3 students)', 'Where: Room 4', 'Why: Maths revision', 'When: Tue, Thu · 5:00 pm–6:00 pm', 'Instruction: Take attendance', '2. Combined English · Group 1 · Weakest (1 student)']) assert.ok(m.includes(t), t)
  assert.equal(m.split('Where:').length, 2)   // the second group has no instruction yet, so no empty lines
})

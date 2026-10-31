import test from 'node:test'
import assert from 'node:assert/strict'
import { DUTY_SLOTS, currentSlotKey, slotItems, allItemKeys, dutyProgress } from '../src/dutyRoster.js'

test('four duty slots in time order', () => {
  assert.deepEqual(DUTY_SLOTS.map(s => s.start), ['05:30', '06:00', '15:15', '17:40'])
})
test('currentSlotKey', () => {
  assert.equal(currentSlotKey('05:45'), 'self_duties')
  assert.equal(currentSlotKey('06:00'), 'morning_study')
  assert.equal(currentSlotKey('12:00'), null)
  assert.equal(currentSlotKey('18:59'), 'evening_study')
})
test('per-course items', () => {
  assert.equal(slotItems(DUTY_SLOTS[0]).length, 1)
  assert.equal(slotItems(DUTY_SLOTS[2]).length, 3)
  assert.equal(allItemKeys().length, 10)
})
test('dutyProgress', () => {
  assert.deepEqual(dutyProgress({}), { done: 0, total: 10, pct: 0 })
  const all = Object.fromEntries(allItemKeys().map(k => [k, true]))
  assert.equal(dutyProgress(all).pct, 100)
})

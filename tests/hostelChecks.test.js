import test from 'node:test'
import assert from 'node:assert/strict'
import { checkHostelData, houseGenderMix } from '../src/lib/hostelChecks.js'

const mk = (id, o = {}) => ({ id, name: 'S' + id, gender: 'Male', hostel_type: 'Boarder', house: 'Kabui', emergency_contact: '9', ...o })
const alloc = (id, o = {}) => ({ student_id: id, hostel_name: 'Kabui', room_number: '12', bed_number: '3', allotment_date: '2026-04-12', status: 'Active', ...o })
const keys = (r, id) => r.rows.find(x => x.st.id === id)?.issues.map(i => i.key).sort() || []

test('clean boarder with a complete allocation → no issues', () => {
  const r = checkHostelData([mk(1)], [alloc(1)], { viewPII: true })
  assert.equal(r.rows.length, 0); assert.equal(r.allocCompleteness, 100)
})

test('boarder vs day scholar conflicts', () => {
  const r = checkHostelData([
    mk(1, { house: 'Dayscholar' }),                                  // boarder in a day house
    mk(2, { hostel_type: 'Day Scholar', house: 'Dayscholar' }),      // day scholar holding a room
    mk(3, { hostel_type: 'Day Scholar', house: 'Kabui' }),           // day scholar in a hostel house
    mk(4, { house: '' }),                                            // boarder without house
    mk(5, { hostel_type: '' }),
  ], [alloc(2)], {})
  assert.deepEqual(keys(r, 1), ['boarder_no_allocation', 'type_house_conflict'])
  assert.deepEqual(keys(r, 2), ['dayscholar_has_room'])
  assert.deepEqual(keys(r, 3), ['type_house_conflict'])
  assert.deepEqual(keys(r, 4), ['boarder_no_allocation', 'boarder_no_house'])
  assert.ok(keys(r, 5).includes('type_missing'))
})

test('allocation fields: missing room (incl. TBD placeholder), bed, date, status; inactive', () => {
  const r = checkHostelData([mk(1), mk(2), mk(3)], [
    alloc(1, { room_number: 'TBD', bed_number: '', allotment_date: null, status: '' }),
    alloc(2, { status: 'Vacated' }),
    alloc(3),
  ], {})
  assert.deepEqual(keys(r, 1), ['bed_missing', 'date_missing', 'room_missing', 'status_missing'])
  assert.deepEqual(keys(r, 2), ['alloc_inactive'])
  assert.equal(r.allocCompleteness, Math.round(((12 - 4) / 12) * 100))
})

test('gender: unknown gender flagged; minority in a clear single-gender house flagged', () => {
  const boys = [1, 2, 3, 4, 5].map(i => mk(i))
  const girl = mk(6, { gender: 'Female' })
  const none = mk(7, { gender: '' })
  const r = checkHostelData([...boys, girl, none], [...boys, girl, none].map(s => alloc(s.id)), {})
  assert.deepEqual(keys(r, 6), ['gender_house_mismatch'])
  assert.deepEqual(keys(r, 7), ['gender_missing'])
  assert.deepEqual(keys(r, 1), [])
  const mix = houseGenderMix([...boys, girl])
  assert.equal(mix.Kabui.majority, 'Male'); assert.equal(mix.Kabui.minority, 'Female')
})

test('gender: small or genuinely mixed houses are not judged', () => {
  const small = [mk(1), mk(2), mk(3, { gender: 'Female' })]
  assert.equal(houseGenderMix(small).Kabui.majority, null)
  const mixed = [1, 2, 3].map(i => mk(i)).concat([4, 5, 6].map(i => mk(i, { gender: 'Female' })))
  assert.equal(houseGenderMix(mixed).Kabui.majority, null)
})

test('emergency contact only checked when viewPII; empty inputs are safe', () => {
  const s = mk(1, { emergency_contact: '' })
  assert.deepEqual(keys(checkHostelData([s], [alloc(1)], {}), 1), [])
  assert.deepEqual(keys(checkHostelData([s], [alloc(1)], { viewPII: true }), 1), ['contact_missing'])
  assert.equal(checkHostelData([], []).rows.length, 0)
  assert.equal(checkHostelData([mk(1)], undefined).rows.length, 1)
})

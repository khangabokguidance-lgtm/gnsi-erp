import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHouseDirectory, hmTitle } from '../src/lib/houseMasters.js'

const students = [
  { gcc_no: 11, house: 'Shivaji', status: 'Active' },
  { gcc_no: '0012', house: ' Ashoka ', status: 'Active' },
  { gcc_no: 13, house: 'Shivaji', status: 'Dropout' },
  { gcc_no: 14, house: '', status: 'Active' },
]
const staff = [{ id: 7, name: 'Rohit Sharma', designation: 'House Master', phone: '999' }, { id: 8, name: 'Anita Devi', designation: 'House Mistress' }]
const housemasters = [
  { name: 'old name', house: 'Shivaji', staff_profile_id: 7, status: 'Active' },
  { name: 'Anita D', house: 'ashoka', staff_profile_id: 8, status: 'Active' },
  { name: 'Gone', house: 'Shivaji', status: 'inactive' },
]

test('title comes from the staff designation', () => {
  assert.equal(hmTitle('House Master'), 'House Master')
  assert.equal(hmTitle('Senior House Mistress'), 'House Mistress')
  assert.equal(hmTitle('Teacher'), 'House Master/Mistress')
})
test('the master/mistress name is read from the Staff Record, not the assignment row', () => {
  const d = buildHouseDirectory({ students, housemasters, staff })
  const a = d.lookup(11)
  assert.equal(a.house, 'Shivaji')
  assert.deepEqual(a.masters.map((m) => [m.name, m.title, m.fromStaffRecord]), [['Rohit Sharma', 'House Master', true]])
  assert.equal(a.label, 'Rohit Sharma')
})
test('GCC and house matching ignore zeros and case; mistress is recognised', () => {
  const d = buildHouseDirectory({ students, housemasters, staff })
  const b = d.lookup('12')
  assert.equal(b.house, 'Ashoka')
  assert.equal(b.masters[0].title, 'House Mistress')
})
test('inactive assignments, non-active students and unknown GCCs give nothing', () => {
  const d = buildHouseDirectory({ students, housemasters, staff })
  assert.deepEqual(d.lookup(13), { house: '', masters: [], label: '' })
  assert.deepEqual(d.lookup(14), { house: '', masters: [], label: '' })
  assert.deepEqual(d.lookup(999), { house: '', masters: [], label: '' })
  assert.deepEqual(d.houses, ['Ashoka', 'Shivaji'])
})
test('an assignment with no linked staff record falls back to its own name', () => {
  const d = buildHouseDirectory({ students: [{ gcc_no: 1, house: 'Z' }], housemasters: [{ name: 'Local HM', house: 'Z', status: 'Active' }], staff: [] })
  assert.deepEqual(d.lookup(1).masters.map((m) => [m.name, m.fromStaffRecord]), [['Local HM', false]])
})

test('the list of people who can be chosen: one entry each, names from the Staff Records', () => {
  const d = buildHouseDirectory({ students, housemasters: [...housemasters, { name: 'Rohit Sharma', house: 'Ashoka', staff_profile_id: 7, status: 'Active' }], staff })
  assert.deepEqual(d.masters.map((m) => [m.name, m.title]), [['Anita Devi', 'House Mistress'], ['Rohit Sharma', 'House Master']])
})

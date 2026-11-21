import test from 'node:test'
import assert from 'node:assert/strict'
import { firstName, staffOptions, filterStaff } from '../src/lib/teacherPick.js'

test('firstName drops honorifics and keeps one token', () => {
  assert.equal(firstName('Sir Sumanta Singh'), 'Sumanta')
  assert.equal(firstName('  Madam   Sandhya Devi '), 'Sandhya')
  assert.equal(firstName('Dr. Lenin'), 'Lenin')
  assert.equal(firstName('Kabiraj'), 'Kabiraj')
  assert.equal(firstName(''), '')
  assert.equal(firstName(null), '')
})

test('staffOptions: unique, sorted, flags shared first names', () => {
  const o = staffOptions([{ name: 'Roshan Singh' }, { name: 'Arjun Devi', designation: 'Teacher' }, { name: 'roshan singh' }, { name: 'Roshan Kumar' }, { name: '' }, null])
  assert.deepEqual(o.map(x => x.name), ['Arjun Devi', 'Roshan Kumar', 'Roshan Singh'])
  assert.equal(o[0].pick, 'Arjun'); assert.equal(o[0].shared, false); assert.equal(o[0].designation, 'Teacher')
  assert.ok(o[1].shared && o[2].shared)
})

test('filterStaff searches name, designation and department, and marks people already on the panel', () => {
  const o = staffOptions([{ name: 'Kabiraj Singh', department: 'Maths' }, { name: 'Roshan Das', designation: 'Reasoning teacher' }])
  assert.deepEqual(filterStaff(o, 'math').map(x => x.name), ['Kabiraj Singh'])
  assert.deepEqual(filterStaff(o, 'reasoning').map(x => x.name), ['Roshan Das'])
  assert.equal(filterStaff(o, '').length, 2)
  const t = filterStaff(o, '', ['kabiraj'])
  assert.equal(t.find(x => x.pick === 'Kabiraj').taken, true); assert.equal(t.find(x => x.pick === 'Roshan').taken, false)
})

test('staffOptions sorts by first name, ignoring a leading title', () => {
  const o = staffOptions([{ name: 'Sir Kabiraj Singh' }, { name: 'Arjun Devi' }, { name: 'Madam Sandhya' }])
  assert.deepEqual(o.map(x => x.pick), ['Arjun', 'Kabiraj', 'Sandhya'])
})

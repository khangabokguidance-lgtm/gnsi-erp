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

import { givenName } from '../src/lib/teacherPick.js'

test('family-name-first staff are saved by their given name, and each person stays a separate choice', () => {
  const staff = [
    { name: 'Khundrakpam Sunder Singh' }, { name: 'Khundrakpam Bronson Singh' }, { name: 'Laishram Bidyachandra' }, { name: 'Laishram Bronson Singh' },
    { name: 'Sir Kabiraj Singh' }, { name: 'Madam Sandhya' }, { name: 'Haobam Ibemhal Devi' },
  ]
  const by = Object.fromEntries(staffOptions(staff).map(o => [o.name, o]))
  assert.equal(by['Khundrakpam Sunder Singh'].pick, 'Sunder')
  assert.equal(by['Khundrakpam Bronson Singh'].pick, 'Bronson')
  assert.equal(by['Laishram Bidyachandra'].pick, 'Bidyachandra')   // two Laishram → the first word is a family name
  assert.equal(by['Laishram Bronson Singh'].pick, 'Bronson')
  assert.equal(by['Sir Kabiraj Singh'].pick, 'Kabiraj'); assert.equal(by['Madam Sandhya'].pick, 'Sandhya')
  assert.equal(by['Haobam Ibemhal Devi'].pick, 'Ibemhal')
  assert.ok(by['Khundrakpam Bronson Singh'].shared && by['Laishram Bronson Singh'].shared)   // same stored name: flagged
  assert.equal(new Set(staffOptions(staff).map(o => o.name)).size, 7)                       // yet all seven are distinct people
  assert.equal(givenName('Sir Sunder Singh'), 'Sunder'); assert.equal(givenName(''), '')
})

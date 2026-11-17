import test from 'node:test'
import assert from 'node:assert/strict'
import { findStaff, creatorOf, initials } from '../src/lib/staffLookup.js'

const dir = [
  { name: 'Sumanta Singh', designation: 'Mathematics Teacher', department: 'Academics' },
  { name: 'Kabiraj Devi', designation: 'Senior Teacher', department: 'Academics' },
  { name: 'Roshan Khan', designation: 'Reasoning Teacher', department: 'Academics' },
  { name: 'Roshan Das', designation: 'Office Assistant', department: 'Admin' },
]

test('matches "Sir <first name>" to the staff member', () => {
  assert.equal(findStaff(dir, 'Sir Sumanta').designation, 'Mathematics Teacher')
  assert.equal(findStaff(dir, 'miss kabiraj').name, 'Kabiraj Devi')
})

test('a full name beats an ambiguous first name', () => {
  assert.equal(findStaff(dir, 'Roshan Das').designation, 'Office Assistant')
})

test('an ambiguous first name returns nobody rather than the wrong person', () => {
  assert.equal(findStaff(dir, 'Sir Roshan'), null)
})

test('unknown, empty and bad input', () => {
  assert.equal(findStaff(dir, 'Sir Nobody'), null)
  assert.equal(findStaff(dir, ''), null)
  assert.equal(findStaff(null, 'Sir Sumanta'), null)
})

test('creatorOf falls back to department, then to an empty designation', () => {
  assert.equal(creatorOf(dir, 'Sir Sumanta').designation, 'Mathematics Teacher')
  assert.equal(creatorOf([{ name: 'Anil', department: 'Academics' }], 'Sir Anil').designation, 'Academics')
  assert.deepEqual(creatorOf(dir, 'Sir Nobody'), { name: 'Sir Nobody', designation: '' })
})

test('initials', () => { assert.equal(initials('Sir Sumanta Singh'), 'SS'); assert.equal(initials(''), '?') })

import test from 'node:test'
import assert from 'node:assert/strict'
import { nameMatches, matchesOne, staffMatching } from '../src/missionSainikData.js'

const STAFF = ['Kabiraj Singh', 'Sunder Devi', 'Ningthoujam Manglemba Singh', 'Sandhyarani Devi', 'Sandhya Kumari', 'Rakesh Singh']

test('a unique panel name matches its one person', () => {
  assert.equal(matchesOne('Kabiraj Singh', 'Kabiraj', STAFF), true)
  assert.equal(matchesOne('Sunder Devi', 'Kabiraj', STAFF), false)
})

test('a shared surname used as a panel name identifies nobody', () => {
  assert.equal(nameMatches('Kabiraj Singh', 'Singh'), true)            // the old, loose rule would have said yes
  assert.equal(staffMatching('Singh', STAFF).length, 3)
  assert.equal(matchesOne('Kabiraj Singh', 'Singh', STAFF), false)
  assert.equal(matchesOne('Rakesh Singh', 'Singh', STAFF), false)
})

test('a short name that is the start of two staff names is ambiguous (Sandhya vs Sandhyarani)', () => {
  assert.equal(staffMatching('Sandhya', STAFF).length, 2)
  assert.equal(matchesOne('Sandhyarani Devi', 'Sandhya', STAFF), false)
})

test('with no staff list the old behaviour is kept (so nobody is locked out by a failed load)', () => {
  assert.equal(matchesOne('Kabiraj Singh', 'Singh', []), true)
  assert.equal(matchesOne('Kabiraj Singh', 'Singh'), true)
})

test('staff given as records work too', () => {
  assert.equal(matchesOne('Kabiraj Singh', 'Kabiraj', STAFF.map(name => ({ name, designation: 'x' }))), true)
})

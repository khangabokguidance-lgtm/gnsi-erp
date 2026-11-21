import test from 'node:test'
import assert from 'node:assert/strict'
import { pickVerifier, setterLoad, shareEvenly, copyPrevious } from '../src/lib/missionSainikAllot.js'

const row = (id, test_no, setter, status = 'Pending', subject = 'Mathematics') => ({ id, test_no, subject, setter, status })

test('verifier: two verify each other, three rotate, GK is Arunkumar, a lone setter has none', () => {
  assert.equal(pickVerifier('maths', 'A', ['A', 'B']), 'B'); assert.equal(pickVerifier('maths', 'B', ['A', 'B']), 'A')
  assert.equal(pickVerifier('maths', 'C', ['A', 'B', 'C']), 'A')
  assert.equal(pickVerifier('gk', 'Deepak', ['Deepak']), 'Arunkumar')
  assert.equal(pickVerifier('maths', 'A', ['A']), ''); assert.equal(pickVerifier('maths', 'Z', ['A', 'B']), '')
})

test('setterLoad counts tests per person', () => {
  assert.deepEqual(setterLoad([row(1, 1, 'A'), row(2, 2, 'A'), row(3, 3, 'B'), row(4, 4, '')]), { A: 2, B: 1 })
})

test('shareEvenly splits Pending tests as evenly as possible, in test order', () => {
  const rows = [1, 2, 3, 4, 5].map(n => row(n, n, 'A'))
  const out = shareEvenly(rows, ['A', 'B'])
  const final = Object.fromEntries(rows.map(r => [r.id, r.setter])); out.forEach(o => { final[o.id] = o.setter })
  const n = who => Object.values(final).filter(x => x === who).length
  assert.deepEqual([n('A'), n('B')], [3, 2])
  assert.ok(out.every(o => o.setter === 'B'))   // only the rows that change are returned
})

test('shareEvenly keeps submitted tests and counts them toward that person', () => {
  const rows = [row(1, 1, 'A', 'Submitted'), row(2, 2, 'A', 'Approved'), row(3, 3, 'A'), row(4, 4, 'A')]
  const out = shareEvenly(rows, ['A', 'B'])
  assert.deepEqual(out.map(o => [o.id, o.setter]), [[3, 'B'], [4, 'B']])
  assert.deepEqual(shareEvenly(rows, []), [])
})

test('copyPrevious copies last test\'s setter onto Pending papers of the same subject', () => {
  const rows = [row(1, 1, 'A'), row(2, 2, 'B'), row(3, 2, 'C', 'Submitted', 'Reasoning'), row(4, 1, 'D', 'Pending', 'Reasoning')]
  assert.deepEqual(copyPrevious(rows, 2).map(x => [x.id, x.setter]), [[2, 'A']])
})

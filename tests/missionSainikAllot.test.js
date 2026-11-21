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

import { currentCounts, assignByCounts } from '../src/lib/missionSainikAllot.js'

test('currentCounts lists the panel at 0 and everyone who sets a test', () => {
  assert.deepEqual(currentCounts([row(1, 1, 'A'), row(2, 2, 'A'), row(3, 3, 'Z')], ['A', 'B']), { A: 2, B: 0, Z: 1 })
})

test('assignByCounts: raising one teacher takes tests from the others, in test order, changing as little as possible', () => {
  const rows = [1, 2, 3, 4, 5, 6].map(n => row(n, n, n <= 3 ? 'A' : 'B'))
  const r = assignByCounts(rows, { A: 4, B: 2 })
  const final = Object.fromEntries(rows.map(x => [x.id, x.setter])); r.changes.forEach(c => { final[c.id] = c.setter })
  assert.equal(Object.values(final).filter(x => x === 'A').length, 4)
  assert.equal(Object.values(final).filter(x => x === 'B').length, 2)
  assert.equal(r.changes.length, 1)                       // one test moves from B to A; the rest stay put
})

test('assignByCounts keeps submitted tests and refuses to go below them or to miscount', () => {
  const rows = [row(1, 1, 'A', 'Approved'), row(2, 2, 'A', 'Submitted'), row(3, 3, 'B'), row(4, 4, 'B')]
  assert.match(assignByCounts(rows, { A: 1, B: 3 }).error, /already handed in 2/)
  assert.match(assignByCounts(rows, { A: 2, B: 1 }).error, /add up to 3/)
  assert.match(assignByCounts(rows, { B: 4 }).error, /A has already handed in/)
  const ok = assignByCounts(rows, { A: 3, B: 1 })
  assert.deepEqual(ok.changes.map(c => [c.id, c.setter]), [[4, 'A']])   // B keeps the earlier test, the later one moves
  assert.match(assignByCounts(rows, { A: -1, B: 5 }).error, /0 or more/)
})

import { retarget, nextVerifier, practiceGive } from '../src/lib/missionSainikAllot.js'

test('retarget: a new teacher gets exactly N tests taken from the busiest, submitted tests stay', () => {
  const rows = [1, 2, 3, 4, 5, 6].map(n => row(n, n, n <= 4 ? 'A' : 'B', n === 1 ? 'Approved' : 'Pending'))
  const r = retarget(rows, 'C', 3, ['A', 'B'])
  const final = Object.fromEntries(rows.map(x => [x.id, x.setter])); r.changes.forEach(c => { final[c.id] = c.setter })
  const n = who => Object.values(final).filter(x => x === who).length
  assert.deepEqual([n('C'), n('A') + n('B')], [3, 3]); assert.equal(final[1], 'A')
  assert.ok(n('A') >= 1)                                   // A keeps the submitted test
})

test('retarget: lowering gives tests to the teacher with the fewest; errors are explained', () => {
  const rows = [1, 2, 3, 4].map(n => row(n, n, n <= 3 ? 'A' : 'B'))
  const r = retarget(rows, 'A', 1, ['A', 'B'])
  const final = Object.fromEntries(rows.map(x => [x.id, x.setter])); r.changes.forEach(c => { final[c.id] = c.setter })
  assert.equal(Object.values(final).filter(x => x === 'A').length, 1)
  assert.match(retarget(rows, 'A', 9, ['A', 'B']).error, /only 4 tests/)
  assert.match(retarget(rows, 'A', -1, ['A']).error, /0 or a whole/)
  const done = [row(1, 1, 'A', 'Approved'), row(2, 2, 'A', 'Approved')]
  assert.match(retarget(done, 'A', 0, ['A']).error, /already handed in 2/)
  assert.match(retarget([row(1, 1, 'A'), row(2, 2, 'A')], 'B', 1, ['A']).error === undefined ? 'ok' : 'x', /ok/)
})

test('nextVerifier keeps a hand-picked verifier and follows the rule otherwise', () => {
  const settersList = ['A', 'B']
  assert.equal(nextVerifier({ setter: 'A', verifier: 'B' }, 'maths', 'B', settersList), 'A')   // B was automatic for A, so follow the rule
  assert.equal(nextVerifier({ setter: 'A', verifier: 'Z' }, 'maths', 'B', settersList), 'Z')   // hand-picked: kept
  assert.equal(nextVerifier({ setter: 'A', verifier: '' }, 'gk', 'A', settersList), 'Arunkumar')
})

test('practiceGive hands over Pending sets that are not already theirs, lowest id first', () => {
  const rows = [row(1, 0, 'A'), row(2, 0, 'B'), row(3, 0, 'B', 'Submitted'), row(4, 0, 'C')]
  assert.deepEqual(practiceGive(rows, 'Z', 2).changes, [{ id: 1, setter: 'Z' }, { id: 2, setter: 'Z' }])
  assert.match(practiceGive(rows, 'Z', 4).error, /Only 3 more/)
  assert.match(practiceGive([row(1, 0, 'Z'), row(2, 0, 'Z')], 'Z', 1).error, /already has 2/)
  assert.deepEqual(practiceGive(rows, 'A', 1).changes, [])
})

import { coSettersOf, settersOfRow, joinCoSetters, toggleCoSetter, settersLabel } from '../src/lib/missionSainikAllot.js'

test('co-setters: parsing, listing, adding and removing', () => {
  const r = { setter: 'A', co_setters: 'B; C ;; B' }
  assert.deepEqual(coSettersOf(r), ['B', 'C', 'B'])
  assert.deepEqual(settersOfRow(r), ['A', 'B', 'C'])
  assert.deepEqual(settersOfRow({ setter: 'A' }), ['A']); assert.deepEqual(settersOfRow({}), [])
  assert.equal(joinCoSetters(['B', ' C ', 'B', '']), 'B; C')
  assert.equal(toggleCoSetter({ setter: 'A', co_setters: 'B' }, 'C', true), 'B; C')
  assert.equal(toggleCoSetter({ setter: 'A', co_setters: 'B; C' }, 'B', false), 'C')
  assert.equal(toggleCoSetter({ setter: 'A', co_setters: '' }, 'A', true), '')          // the main setter is not a co-setter
  assert.equal(settersLabel({ setter: 'A', co_setters: 'B' }, n => 'Sir ' + n), 'Sir A + Sir B')
})

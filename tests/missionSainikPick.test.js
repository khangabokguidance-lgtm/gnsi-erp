import test from 'node:test'
import assert from 'node:assert/strict'
import { usedQuestions, pickSummary, contributors } from '../src/lib/missionSainikPick.js'

const qs = (n, chosen = [], by = i => (i % 2 ? 'A' : 'B')) => Array.from({ length: n }, (_, i) => ({ id: i + 1, uploaded_by: by(i), in_paper: chosen.includes(i + 1) }))
const ids = l => l.map(x => x.id)

test('nothing chosen: the first q questions are used (old behaviour)', () => {
  assert.deepEqual(ids(usedQuestions(qs(8), 5)), [1, 2, 3, 4, 5])
  assert.deepEqual(ids(usedQuestions(qs(3), 5)), [1, 2, 3])
  assert.deepEqual(usedQuestions([], 5), []); assert.deepEqual(usedQuestions(null, 5), [])
})

test('chosen questions are used; a short choice is topped up with the earliest unchosen, keeping upload order', () => {
  assert.deepEqual(ids(usedQuestions(qs(8, [2, 7, 8]), 5)), [1, 2, 3, 7, 8])      // 3 chosen + fill 1, 3
  assert.deepEqual(ids(usedQuestions(qs(8, [2, 4, 6, 7, 8]), 5)), [2, 4, 6, 7, 8]) // exactly q chosen
})

test('more chosen than needed: the first q chosen', () => {
  assert.deepEqual(ids(usedQuestions(qs(8, [1, 3, 4, 5, 6, 8]), 5)), [1, 3, 4, 5, 6])
})

test('pickSummary reports extras, chosen, used and what is auto-filled', () => {
  assert.deepEqual(pickSummary(qs(8, [2, 7, 8]), 5), { total: 8, chosen: 3, used: 5, extra: 3, over: false, short: true, filled: 2 })
  assert.deepEqual(pickSummary(qs(8), 5), { total: 8, chosen: 0, used: 5, extra: 3, over: false, short: false, filled: 0 })
  assert.equal(pickSummary(qs(8, [1, 2, 3, 4, 5, 6]), 5).over, true)
})

test('contributors counts uploads, choices and what is used per teacher', () => {
  const c = contributors(qs(6, [2, 4]), 4)    // A uploads odd indexes (ids 2,4,6), B the rest (ids 1,3,5)
  assert.deepEqual(c.map(x => [x.name, x.n, x.chosen]), [['A', 3, 2], ['B', 3, 0]])
  assert.equal(c.reduce((n, x) => n + x.used, 0), 4)
})

import { flavours, flavourItems, flavourStatus } from '../src/lib/missionSainikPick.js'

const mk = (by, n, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i, uploaded_by: by }))

test('practice flavours: one entry per teacher in upload order, with a version letter and completeness', () => {
  const list = [...mk('A', 3, 1), ...mk('B', 2, 10), ...mk('A', 1, 20)]       // A's questions are not contiguous
  const f = flavours(list, 3)
  assert.deepEqual(f.map(x => [x.by, x.count, x.complete, x.letter]), [['A', 4, true, 'A'], ['B', 2, false, 'B']])
  assert.deepEqual(flavours([], 3), [])
})

test('flavourItems: version A is the first teacher, B the second; wraps; prefers complete sets; one teacher = first q', () => {
  const list = [...mk('A', 4, 1), ...mk('B', 4, 10), ...mk('C', 1, 20)]
  assert.deepEqual(flavourItems(list, 3, 0).map(x => x.id), [1, 2, 3])
  assert.deepEqual(flavourItems(list, 3, 1).map(x => x.id), [10, 11, 12])
  assert.deepEqual(flavourItems(list, 3, 2).map(x => x.id), [1, 2, 3])          // C is incomplete, so only A and B are versions: wraps back to A
  assert.deepEqual(flavourItems(mk('A', 5, 1), 3, 1).map(x => x.id), [1, 2, 3])  // single teacher
  assert.deepEqual(flavourItems(mk('A', 2, 1), 3, 0).map(x => x.id), [1, 2])     // nobody complete: show what exists
  assert.deepEqual(flavourItems([], 3, 0), [])
})

test('flavourStatus: ok only when every teacher has a full set', () => {
  assert.equal(flavourStatus([], 3), 'none')
  assert.equal(flavourStatus([...mk('A', 3, 1), ...mk('B', 3, 10)], 3), 'ok')
  assert.equal(flavourStatus([...mk('A', 3, 1), ...mk('B', 1, 10)], 3), 'part')
})

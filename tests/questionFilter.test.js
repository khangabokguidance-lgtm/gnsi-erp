import test from 'node:test'
import assert from 'node:assert/strict'
import { filterQuestions, activeFilters, filterChoices, EMPTY_FILTER } from '../src/lib/questionFilter.js'

const Q = [
  { id: 1, question: 'Area of a circle', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', answer: 'A', difficulty: 'Easy', topic: 'Mensuration', uploaded_by: 'Ravi', explanation: 'pi r^2' },
  { id: 2, question: 'Prime numbers', option_a: 'a', option_b: 'b', option_c: 'c', option_d: '', answer: 'B', difficulty: 'Hard', topic: 'Numbers', uploaded_by: 'Bina', image_data: 'data:image/png;base64,x', in_paper: true },
  { id: 3, question: 'Speed and time', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', answer: '', difficulty: null, topic: '', uploaded_by: 'Ravi' },
]
const ids = (f, o) => filterQuestions(Q, { ...EMPTY_FILTER, ...f }, o).map(q => q.id)

test('each filter narrows the list', () => {
  assert.deepEqual(ids({ search: 'prime' }), [2])
  assert.deepEqual(ids({ search: 'bina' }), [2])
  assert.deepEqual(ids({ level: 'Hard' }), [2])
  assert.deepEqual(ids({ level: 'none' }), [3])
  assert.deepEqual(ids({ setter: 'Ravi' }), [1, 3])
  assert.deepEqual(ids({ topic: 'none' }), [3])
  assert.deepEqual(ids({ explain: 'yes' }), [1])
  assert.deepEqual(ids({ figure: 'yes' }), [2])
  assert.deepEqual(ids({ chosen: 'no' }), [1, 3])
  assert.deepEqual(ids({ problem: 'fix' }), [2, 3])
  assert.deepEqual(ids({ problem: 'off' }, { offIds: new Set([3]) }), [3])
  assert.deepEqual(ids({ setter: 'Ravi', level: 'Easy' }), [1])
})

test('sorting and the helpers', () => {
  assert.deepEqual(ids({ sort: 'hard' }), [2, 1, 3])
  assert.deepEqual(ids({ sort: 'newest' }), [3, 2, 1])
  assert.equal(activeFilters({ ...EMPTY_FILTER, search: 'x', level: 'Easy', sort: 'hard' }), 1)
  assert.deepEqual(filterChoices(Q), { setters: ['Bina', 'Ravi'], topics: ['Mensuration', 'Numbers'] })
})

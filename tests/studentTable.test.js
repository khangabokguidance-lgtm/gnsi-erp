import test from 'node:test'
import assert from 'node:assert/strict'
import { sortStudents, nextSort } from '../src/lib/studentTable.js'

const L = [
  { id: 1, name: 'Zoya', gcc_no: '1010', course: 'JEE' },
  { id: 2, name: 'anil', gcc_no: '1002', course: '' },
  { id: 3, name: 'Bela', gcc_no: '', course: 'Sainik' },
  { id: 4, name: 'Chen', gcc_no: '1005', course: 'Navodaya' },
]
const ids = l => l.map(s => s.id)

test('sort: case-insensitive names, numeric GCC (not alphabetical)', () => {
  assert.deepEqual(ids(sortStudents(L, 'name', 'asc')), [2, 3, 4, 1])
  assert.deepEqual(ids(sortStudents(L, 'gcc', 'asc')), [2, 4, 1, 3])
  assert.deepEqual(ids(sortStudents(L, 'gcc', 'desc')), [1, 4, 2, 3])
})

test('sort: blanks stay last in both directions', () => {
  assert.equal(sortStudents(L, 'course', 'asc').at(-1).id, 2)
  assert.equal(sortStudents(L, 'course', 'desc').at(-1).id, 2)
})

test('sort: attendance / dues / score come from the lookup maps', () => {
  const ctx = { attData: { 1: 90, 2: 40, 4: 75 }, feeData: { 1: { dues: 0 }, 2: { dues: 9000 }, 4: { dues: 500 } }, examData: { 4: [{ total: 81 }], 1: [{ total: 64 }] } }
  assert.deepEqual(ids(sortStudents(L, 'att', 'asc', ctx)).slice(0, 3), [2, 4, 1])
  assert.deepEqual(ids(sortStudents(L, 'dues', 'desc', ctx)).slice(0, 3), [2, 4, 1])
  assert.deepEqual(ids(sortStudents(L, 'score', 'desc', ctx)).slice(0, 2), [4, 1])
})

test('sort: unknown key and empty input are safe; input is not mutated', () => {
  assert.equal(sortStudents(L, 'nope'), L)
  assert.deepEqual(sortStudents([], 'name'), [])
  const copy = [...L]; sortStudents(L, 'name'); assert.deepEqual(L, copy)
})

test('nextSort cycles asc → desc → default', () => {
  let s = { key: null, dir: 'asc' }
  s = nextSort(s, 'att'); assert.deepEqual(s, { key: 'att', dir: 'asc' })
  s = nextSort(s, 'att'); assert.deepEqual(s, { key: 'att', dir: 'desc' })
  s = nextSort(s, 'att'); assert.deepEqual(s, { key: null, dir: 'asc' })
  assert.deepEqual(nextSort({ key: 'att', dir: 'desc' }, 'name'), { key: 'name', dir: 'asc' })
})

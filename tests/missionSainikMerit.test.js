import test from 'node:test'
import assert from 'node:assert/strict'
import { meritList } from '../src/lib/missionSainikMerit.js'

const COLS = [['maths', 'Maths', 60], ['reasoning', 'Reasoning', 20], ['grammar', 'Grammar', 20], ['gk', 'GK', 20]]
const m = (test_no, batch, maths, reasoning, grammar, gk) => ({ test_no, batch, maths, reasoning, grammar, gk })

test('ranks by percentage; ties share a rank', () => {
  const { rows } = meritList([m(1, 'A', 60, 20, 20, 20), m(1, 'B', 30, 10, 10, 10), m(1, 'C', 30, 10, 10, 10), m(1, 'D', 0, 0, 0, 0)], COLS, 1)
  assert.deepEqual(rows.map(r => [r.name, r.rank]), [['A', 1], ['B', 2], ['C', 2], ['D', 4]])
  assert.equal(rows[0].pct, 100); assert.equal(rows[1].total, 60); assert.equal(rows[1].max, 120)
})

test('all tests together: marks add up and the maximum grows with each test sat', () => {
  const { rows, tests } = meritList([m(1, 'A', 60, 20, 20, 20), m(2, 'A', 30, 10, 10, 10), m(2, 'B', 60, 20, 20, 20)], COLS, 0)
  assert.equal(tests, 2)
  const a = rows.find(r => r.name === 'A'), b = rows.find(r => r.name === 'B')
  assert.equal(a.total, 180); assert.equal(a.max, 240); assert.equal(a.pct, 75)
  assert.equal(b.pct, 100); assert.equal(b.rank, 1)
})

test('blank marks count as 0 and a missing name is shown', () => {
  const { rows } = meritList([{ test_no: 1, batch: '', maths: '', reasoning: null }], COLS, 1)
  assert.equal(rows[0].name, '(no name)'); assert.equal(rows[0].total, 0)
  assert.deepEqual(meritList([], COLS).rows, [])
})

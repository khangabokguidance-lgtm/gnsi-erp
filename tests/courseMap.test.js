// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalBatch, courseOf } from '../src/courseMap.js'

test('batch: renamed and differently written Foundation batches', () => {
  for (const b of ['Udaan', 'UDAAN', ' udaan ', 'Udaan — ENG', 'Elite', 'ELITE — HIN']) assert.equal(canonicalBatch(b), 'Udaan')
  for (const b of ['Pragati', 'PRAGATI', 'Prime', 'PRIME - ENG']) assert.equal(canonicalBatch(b), 'Pragati')
  assert.equal(canonicalBatch('LAKSHYA  A'), 'Lakshya A')
  assert.equal(canonicalBatch('Primetime'), 'Primetime')
  assert.equal(canonicalBatch(''), '')
})

test('course: a blank course on a Udaan / Pragati batch is Foundation', () => {
  assert.equal(courseOf({ course: '', batch: 'UDAAN' }), 'Foundation')
  assert.equal(courseOf({ course: null, batch: 'Elite' }), 'Foundation')
  assert.equal(courseOf({ batch: '', class_name: 'Prime' }), 'Foundation')
  assert.equal(courseOf({ course: 'Navodaya', batch: 'Udaan' }), 'Navodaya')
  assert.equal(courseOf({ batch: '???' }), 'Unassigned')
})

// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { examKeyFor, COMBINED_COURSE_BATCH_LABEL } from '../src/examBatchKey.js'

test('exam key: Udaan / Pragati under every spelling', () => {
  for (const batch of ['Udaan', 'UDAAN', 'Udaan — ENG', 'UDAAN-ENG', 'Elite']) assert.equal(examKeyFor({ batch, class_name: '9A' }), 'UDAAN')
  for (const batch of ['Pragati', 'PRAGATI', 'Prime', 'PRIME — HIN']) assert.equal(examKeyFor({ batch, class_name: 'ENG' }), 'PRAGATI')
  assert.equal(examKeyFor({ batch: '', class_name: 'Udaan' }), 'UDAAN')
})

test('exam key: other batches and Combined Course', () => {
  assert.equal(examKeyFor({ batch: 'Lakshya A' }), 'LAKSHYA - A')
  assert.equal(examKeyFor({ batch: 'Achiever', class_name: 'ACHIEVER — ENG' }), 'ACHIEVER')
  assert.equal(examKeyFor({ course: 'Combined Course', batch: '—' }), COMBINED_COURSE_BATCH_LABEL)
})

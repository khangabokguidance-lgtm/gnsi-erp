import test from 'node:test'
import assert from 'node:assert/strict'
import { batchKeysFor, pickFeeRow } from '../src/feeRateLookup.js'

test('Combined students also look up the "—" row, whatever their batch says', () => {
  assert.deepEqual(batchKeysFor({ course: 'Combined Course', batch: 'Class 8', rawBatch: 'Class 8' }), ['Class 8', '—'])
  assert.deepEqual(batchKeysFor({ course: 'Combined Course', batch: '—', rawBatch: '—' }), ['—'])
  assert.deepEqual(batchKeysFor({ course: 'Combined Course', batch: '', rawBatch: '' }), ['', '—'])
})

test('other courses are unchanged — no "—" lookup', () => {
  assert.deepEqual(batchKeysFor({ course: 'Sainik', batch: 'Achiever', rawBatch: 'ACHIEVER' }), ['Achiever', 'ACHIEVER'])
  assert.deepEqual(batchKeysFor({ course: 'Foundation', batch: 'Udaan', rawBatch: 'Udaan', aliases: ['Elite'] }), ['Udaan', 'Elite'])
})

test('a Combined student with an unknown batch gets the configured "—" row, not nothing', () => {
  const rows = [{ course: 'Combined Course', batch: '—', course_fee: 4200 }]
  assert.equal(pickFeeRow(rows, { course: 'Combined Course', batch: 'Class 8' }).course_fee, 4200)
})

test('an exact batch match still wins over the "—" row', () => {
  const rows = [{ course: 'Combined Course', batch: '—', course_fee: 4200 }, { course: 'Combined Course', batch: 'Class 8', course_fee: 3900 }]
  assert.equal(pickFeeRow(rows, { course: 'Combined Course', batch: 'Class 8' }).course_fee, 3900)
})

test('no rows means no match, so the caller can show the default-rates warning', () => {
  assert.equal(pickFeeRow([], { course: 'Combined Course', batch: '—' }), null)
  assert.equal(pickFeeRow(null, { course: 'Sainik', batch: 'Achiever' }), null)
})

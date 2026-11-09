import test from 'node:test'
import assert from 'node:assert/strict'
import { shapeOverride, hasAnyOverride, applyFeeOverride } from '../src/lib/studentFeeSetup.js'

const STD = { flatFee: 4000, courseFee: 3000, admissionFee: 1000, usingFallbackRates: false }

test('no custom setup leaves the standard rates exactly as they are', () => {
  assert.equal(applyFeeOverride(STD, null), STD)
  const empty = shapeOverride({ flat_fee_override: null, course_fee_override: null, admission_fee_override: null })
  assert.equal(hasAnyOverride(empty), false)
  assert.equal(applyFeeOverride(STD, empty), STD)
})

test('only the fees the admin set are replaced; the rest stay at the default', () => {
  const o = shapeOverride({ flat_fee_override: null, course_fee_override: 2500, admission_fee_override: null })
  assert.equal(hasAnyOverride(o), true)
  assert.deepEqual(applyFeeOverride(STD, o), { ...STD, courseFee: 2500 })
})

test('all three can be customised, and 0 is a real custom fee (not "default")', () => {
  const o = shapeOverride({ flat_fee_override: 0, course_fee_override: '1800', admission_fee_override: 500 })
  assert.equal(o.flat_fee_override, 0)
  assert.deepEqual(applyFeeOverride(STD, o), { ...STD, flatFee: 0, courseFee: 1800, admissionFee: 500 })
})

test('an old row with only a flat fee (no new columns yet) still works', () => {
  const o = shapeOverride({ flat_fee_override: 3500, reason: 'Scholarship' })
  assert.equal(o.course_fee_override, null)
  assert.deepEqual(applyFeeOverride(STD, o), { ...STD, flatFee: 3500 })
})

test('the standard rates object is not mutated', () => {
  const copy = { ...STD }
  applyFeeOverride(STD, shapeOverride({ course_fee_override: 1 }))
  assert.deepEqual(STD, copy)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { checkOrderRequest } from '../api/_razorpay/orderCheck.js'
import { computeFeeAmountPaise } from '../supabase/functions/_shared/feeCalc.ts'

const items = [{ kind: 'course', amount: 4000 }, { kind: 'flat', amount: 1500.5 }]

test('order amount must equal the itemised total', () => {
  assert.deepEqual(checkOrderRequest({ amount: 5500.5, items }), { ok: true, amountPaise: 550050 })
  assert.equal(checkOrderRequest({ amount: 1, items }).ok, false)
  assert.equal(checkOrderRequest({ amount: 5500, items }).ok, false)
})
test('missing, unknown or non-positive items are refused', () => {
  assert.equal(checkOrderRequest({ amount: 100 }).ok, false)
  assert.equal(checkOrderRequest({ amount: 100, items: [] }).ok, false)
  assert.equal(checkOrderRequest({ amount: 100, items: [{ kind: 'x', amount: 100 }] }).ok, false)
  assert.equal(checkOrderRequest({ amount: 0, items: [{ kind: 'flat', amount: 0 }] }).ok, false)
  assert.equal(checkOrderRequest({ amount: -5, items: [{ kind: 'flat', amount: -5 }] }).ok, false)
  assert.equal(checkOrderRequest({ amount: 'abc', items }).ok, false)
})
test('over the per-order cap is refused', () => {
  assert.equal(checkOrderRequest({ amount: 100001, items: [{ kind: 'flat', amount: 100001 }] }).ok, false)
})

test('feeCalc: known types, scholarship and concession', () => {
  assert.equal(computeFeeAmountPaise({ hostel_type: 'Boarder' }), 550000)
  assert.equal(computeFeeAmountPaise({ hostel_type: 'Day Boarder', scholarship_pct: 50 }), 200000)
  assert.equal(computeFeeAmountPaise({ hostel_type: 'Day Scholar', concession_amt: 500 }), 150000)
})
test('feeCalc: unknown hostel type is refused, not charged as Day Scholar', () => {
  assert.throws(() => computeFeeAmountPaise({ hostel_type: 'Boardr' }))
  assert.throws(() => computeFeeAmountPaise({ hostel_type: '' }))
})
test('feeCalc: bad scholarship never yields a negative amount', () => {
  assert.throws(() => computeFeeAmountPaise({ hostel_type: 'Boarder', scholarship_pct: 150 }))
  assert.equal(computeFeeAmountPaise({ hostel_type: 'Boarder', scholarship_pct: 100 }), 0)
  assert.equal(computeFeeAmountPaise({ hostel_type: 'Boarder', concession_amt: 99999 }), 0)
})

test('advance lines (sent by Fees.jsx) are accepted', () => {
  assert.equal(checkOrderRequest({ amount: 3000, items: [{ kind: 'advance', label: 'May', amount: 3000 }] }).ok, true)
})

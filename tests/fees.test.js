// Run with: npm test   (node's built-in test runner — no extra packages)
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSaneAmount, assertSanePayDate, MAX_FEE_AMOUNT } from '../src/lib/feeValidation.js'
import { standingWaiver, planState } from '../src/lib/standingMath.js'

test('amount: rejects zero, negative, NaN, text and huge values', () => {
  for (const bad of [0, -5, NaN, 'abc', Infinity, MAX_FEE_AMOUNT + 1]) assert.throws(() => assertSaneAmount(bad), /greater than 0|limit/)
  assert.equal(assertSaneAmount('5500'), 5500)
  assert.equal(assertSaneAmount(MAX_FEE_AMOUNT), MAX_FEE_AMOUNT)
})

test('date: rejects future, invalid and ancient dates', () => {
  assert.throws(() => assertSanePayDate('2026-13-45', 'd', '2026-10-03'), /not a valid/)
  assert.throws(() => assertSanePayDate('2026-10-04', 'd', '2026-10-03'), /future/)
  assert.throws(() => assertSanePayDate('2010-01-01', 'd', '2026-10-03'), /too far/)
  assert.equal(assertSanePayDate('2026-10-03', 'd', '2026-10-03'), '2026-10-03')
})

const fixed = (v, extra = {}) => ({ status: 'active', basis: 'fixed_per_month', value: v, applies_to: 'course', valid_from: '2026-06-01', valid_to: null, ...extra })

test('standing concession: fixed amount inside the window, capped at the fee', () => {
  assert.equal(standingWaiver([fixed(1000)], 'August', 2026, 'course', 5000), 1000)
  assert.equal(standingWaiver([fixed(9000)], 'August', 2026, 'course', 5000), 5000)
  assert.equal(standingWaiver([fixed(1000)], 'May', 2026, 'course', 5000), 0)          // before valid_from
  assert.equal(standingWaiver([fixed(1000, { valid_to: '2026-07-31' })], 'August', 2026, 'course', 5000), 0)   // after valid_to
})

test('standing concession: head, percent, one-time, status', () => {
  assert.equal(standingWaiver([fixed(1000)], 'February', 2027, 'flat', 47000), 0)       // course-only entry
  assert.equal(standingWaiver([fixed(1000, { applies_to: 'both' })], 'February', 2027, 'flat', 47000), 1000)
  assert.equal(standingWaiver([fixed(10, { basis: 'percent' })], 'August', 2026, 'course', 5000), 500)
  assert.equal(standingWaiver([fixed(2000, { basis: 'one_time' })], 'June', 2026, 'course', 5000), 2000)
  assert.equal(standingWaiver([fixed(2000, { basis: 'one_time' })], 'July', 2026, 'course', 5000), 0)
  assert.equal(standingWaiver([fixed(1000, { status: 'revoked' })], 'August', 2026, 'course', 5000), 0)
  assert.equal(standingWaiver([], 'August', 2026, 'course', 5000), 0)
})

test('instalment plan state', () => {
  const plan = { id: 1, status: 'active', installments: [
    { due_date: '2026-09-01', amount: 1000, paid_amount: 1000 },
    { due_date: '2026-10-01', amount: 1000, paid_amount: 0 },
    { due_date: '2026-11-01', amount: 1000, paid_amount: 0 },
  ] }
  const s = planState(plan, '2026-10-03')
  assert.equal(s.overdue, true); assert.equal(s.nextDue, '2026-10-01'); assert.equal(s.openCount, 2); assert.equal(s.openAmount, 2000)
  assert.equal(planState(plan, '2026-09-15').overdue, false)
  assert.equal(planState({ ...plan, status: 'cancelled' }, '2026-10-03'), null)
  assert.equal(planState({ ...plan, installments: plan.installments.map(i => ({ ...i, paid_amount: i.amount })) }, '2026-10-03'), null)
})

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

import { admRowKind, balanceRowId, balanceSuffix, isBalanceRowId, instituteNow } from '../src/lib/feeMath.js'

test('admission rows: one rule for dues and ledger', () => {
  assert.equal(admRowKind({ fee_type: 'admission' }), 'admission')
  assert.equal(admRowKind({ fee_type: null, description: 'Admission Fee' }), 'admission')
  assert.equal(admRowKind({ fee_type: 'advance' }), 'advance')
  assert.equal(admRowKind({ fee_type: 'item', description: 'Prospectus' }), 'item')
  assert.equal(admRowKind({ fee_type: null, description: 'Dress Kit — Shirt' }), 'item')   // legacy unknown row is not admission
})

test('balance rows: ids and account refs', () => {
  const id = balanceRowId('12_course_aug_2026', 1)
  assert.equal(id, '12_course_aug_2026_b1')
  assert.ok(isBalanceRowId(id)); assert.ok(!isBalanceRowId('12_course_aug_2026'))
  assert.equal(balanceSuffix(id), '_b1'); assert.equal(balanceSuffix('12_course_aug_2026'), '')
})

test('institute clock reads as IST whatever the device zone', () => {
  const n = instituteNow(new Date('2026-03-31T20:00:00Z'))   // 01:30 IST on 1 April
  assert.equal(n.getMonth(), 3); assert.equal(n.getDate(), 1)
})

import { excludeRepeaterFees, repeaterWaivedTotal } from '../src/lib/feeMath.js'

test('repeater: admission and items excluded, monthly fees kept', () => {
  const items = [{ kind: 'admission', amount: 6000 }, { kind: 'item', amount: 3000 }, { kind: 'flat', amount: 100 }, { kind: 'course', amount: 50 }, { kind: 'advance', amount: 10 }]
  const r = excludeRepeaterFees(true, items)
  assert.deepEqual(r.items.map(i => i.kind), ['flat', 'course', 'advance'])
  assert.equal(repeaterWaivedTotal(items), 9000)
  assert.equal(excludeRepeaterFees(false, items).items.length, 5)
})

import { detectLateEntryStudents } from '../src/lib/lateEntry.js'

test('late entry: joined mid-session, fees start from the joining month', () => {
  const students = [
    { gcc_no: 1, name: 'Early', admission_date: '2026-04-10' },
    { gcc_no: 2, name: 'Late paid', admission_date: '2026-08-12' },
    { gcc_no: 3, name: 'Late none', admission_date: '2026-09-02' },
    { gcc_no: 4, name: 'Last session', admission_date: '2025-08-01' },
    { gcc_no: 5, name: 'Late skipped', admission_date: '2026-06-20' },
  ]
  const course = [
    { adm_app_id: '2', for_month: 'August', year: 2026, amount_paid: 5000, reverted: false },
    { adm_app_id: '5', for_month: 'August', year: 2026, amount_paid: 5000, reverted: false },
    { adm_app_id: '5', for_month: 'June', year: 2026, amount_paid: 5000, reverted: true },
  ]
  const r = detectLateEntryStudents(students, course, [], '2026-2027')
  assert.deepEqual(r.map(x => x.gcc_no), [3, 5, 2])         // not-started first
  const by = Object.fromEntries(r.map(x => [x.gcc_no, x]))
  assert.equal(by[2].firstFeeMonth, 'August 2026'); assert.equal(by[2].started, true); assert.equal(by[2].skippedJoiningMonth, false)
  assert.equal(by[2].monthsNotCharged.length, 4)
  assert.equal(by[3].started, false)
  assert.equal(by[5].skippedJoiningMonth, true)             // joined June, first paid August
})

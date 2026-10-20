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

import { applyPaymentToPlan, removePaymentFromPlan, planDone } from '../src/lib/planPayments.js'
import { refundStatementLines, writtenOffFor } from '../src/lib/refundLedger.js'

const mkPlan = () => [1, 2, 3].map(no => ({ no, due_date: `2026-0${no + 5}-10`, amount: 1000, paid_amount: 0, paid_date: null, receipt_no: null }))

test('plan: payments fill the oldest instalment first, partial and spill-over', () => {
  let r = applyPaymentToPlan(mkPlan(), { ref: 'a', amount: 1500, date: '2026-06-01', receipt: 'R1' })
  assert.equal(r.applied, 1500)
  assert.deepEqual(r.installments.map(i => i.paid_amount), [1000, 500, 0])
  r = applyPaymentToPlan(r.installments, { ref: 'b', amount: 5000, date: '2026-07-01', receipt: 'R2' })
  assert.equal(r.applied, 1500)                       // only 1500 was still owed
  assert.ok(planDone(r.installments))
})

test('plan: the same fee row is never applied twice; revert takes it back', () => {
  const once = applyPaymentToPlan(mkPlan(), { ref: 'a', amount: 800, date: '2026-06-01', receipt: 'R1' })
  const twice = applyPaymentToPlan(once.installments, { ref: 'a', amount: 800, date: '2026-06-01', receipt: 'R1' })
  assert.equal(twice.applied, 0)
  const back = removePaymentFromPlan(twice.installments, 'a')
  assert.equal(back.removed, 800)
  assert.deepEqual(back.installments.map(i => i.paid_amount), [0, 0, 0])
  assert.ok(!planDone(back.installments))
})

test('refunds on the ledger: refund, sibling transfer both ways, write-off, carry-credit ignored', () => {
  const rows = [
    { kind: 'Refund to parent', status: 'paid', gcc: '5', amount: 2000, decided_at: '2026-08-01T10:00:00Z', reason: 'left' },
    { kind: 'Refund to parent', status: 'approved', gcc: '5', amount: 900, decided_at: '2026-08-02T10:00:00Z' },   // not paid yet
    { kind: 'Adjust to sibling GCC', status: 'approved', gcc: '5', target_gcc: '9', amount: 700, decided_at: '2026-08-03T10:00:00Z' },
    { kind: 'Write-off dues', status: 'approved', gcc: '5', amount: 300, decided_at: '2026-09-01T10:00:00Z' },
    { kind: 'Carry credit to next session', status: 'approved', gcc: '5', amount: 100, decided_at: '2026-09-02T10:00:00Z' },
  ]
  const src = refundStatementLines(5, rows)
  assert.deepEqual(src.map(l => [l.debit, l.credit]), [[2000, 0], [700, 0], [0, 300]])
  assert.deepEqual(refundStatementLines('09', rows).map(l => [l.debit, l.credit]), [[0, 700]])
  const sessionOf = d => (d >= '2026-04-01' ? '2026-2027' : '2025-2026')
  assert.equal(writtenOffFor(5, rows, '2026-2027', sessionOf), 300)
  assert.equal(writtenOffFor(5, rows, '2025-2026', sessionOf), 0)
})

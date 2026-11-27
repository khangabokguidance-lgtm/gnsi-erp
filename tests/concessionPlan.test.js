import test from 'node:test'
import assert from 'node:assert/strict'
import { feeAfter, feeImpact, isFullWaiver, validateRequest, requestRow, stateOf, courseReport, monthStartOf, monthEndOf } from '../src/lib/concessionPlan.js'
import { standingWaiver } from '../src/lib/standingMath.js'

const rates = { course: 3000, flat: 5000 }
const st = { gcc_no: 101, name: 'A', course: 'Udaan', batch: 'Class 6', hostel_type: 'Day Scholar' }
const form = o => ({ student: st, kind: 'Sibling', basis: 'fixed_per_month', value: 500, applies_to: 'course', from: '2026-12', to: '', reason: 'Younger brother in Pragati', ...o })

test('fee after each basis', () => {
  assert.equal(feeAfter({ basis: 'fixed_per_month', value: 500 }, 3000), 2500)
  assert.equal(feeAfter({ basis: 'percent', value: 25 }, 3000), 2250)
  assert.equal(feeAfter({ basis: 'fixed_fee', value: 2000 }, 3000), 2000)
  assert.equal(feeAfter({ basis: 'one_time', value: 900 }, 3000), 3000)
  assert.equal(feeAfter({ basis: 'fixed_per_month', value: 5000 }, 3000), 0)
})

test('impact only touches the heads it applies to', () => {
  const f = feeImpact({ basis: 'percent', value: 10, applies_to: 'course' }, rates)
  assert.deepEqual([f.course.after, f.flat.after, f.perMonth, f.flatLess], [2700, 5000, 300, 0])
  const g = feeImpact({ basis: 'fixed_per_month', value: 1000, applies_to: 'both' }, rates)
  assert.deepEqual([g.course.after, g.flat.after], [2000, 4000])
})

test('full waivers (₹0 fee) are recognised', () => {
  assert.equal(isFullWaiver({ basis: 'percent', value: 100 }), true)
  assert.equal(isFullWaiver({ basis: 'fixed_fee', value: 0 }), true)
  assert.equal(isFullWaiver({ basis: 'fixed_per_month', value: 3000, applies_to: 'course' }, rates), true)
  assert.equal(isFullWaiver({ basis: 'fixed_per_month', value: 500, applies_to: 'course' }, rates), false)
})

test('validation', () => {
  assert.equal(validateRequest(form()), null)
  assert.match(validateRequest(form({ basis: 'percent', value: 120 })), /at most 100/)
  assert.match(validateRequest(form({ basis: 'fixed_fee', applies_to: 'both', value: 1000 })), /one fee at a time/)
  assert.match(validateRequest(form({ basis: 'fixed_fee', value: 3500 }), rates), /less than the standard/)
  assert.equal(validateRequest(form({ basis: 'fixed_fee', value: 0 }), rates), null)
  assert.match(validateRequest(form({ value: 0 })), /more than 0/)
  assert.match(validateRequest(form({ to: '2026-11' })), /before the start/)
  assert.match(validateRequest(form({ reason: 'no' })), /reason/)
})

test('request row: month range, pending unless approved now', () => {
  const r = requestRow(form({ to: '2027-02' }), { by: 'Staff' })
  assert.deepEqual([r.valid_from, r.valid_to, r.status, r.gcc, r.course], ['2026-12-01', '2027-02-28', 'pending', '101', 'Udaan'])
  assert.equal(requestRow(form(), { by: 'Admin', approveNow: true }).status, 'active')
  assert.equal(monthStartOf('bad'), '')
  assert.equal(monthEndOf('2028-02'), '2028-02-29')
})

test('pending and rejected entries never reduce a fee', () => {
  const e = { basis: 'fixed_fee', value: 2000, applies_to: 'course', valid_from: '2026-04-01' }
  assert.equal(standingWaiver([{ ...e, status: 'active' }], 'December', 2026, 'course', 3000), 1000)
  assert.equal(standingWaiver([{ ...e, status: 'pending' }], 'December', 2026, 'course', 3000), 0)
  assert.equal(standingWaiver([{ ...e, status: 'rejected' }], 'December', 2026, 'course', 3000), 0)
  assert.equal(standingWaiver([{ ...e, status: 'active', valid_from: '2027-01-01' }], 'December', 2026, 'course', 3000), 0)
})

test('state and the by-course report', () => {
  assert.equal(stateOf({ status: 'active', valid_to: '2026-12-10' }, '2026-11-27'), 'expiring')
  assert.equal(stateOf({ status: 'active', valid_to: '2026-10-31' }, '2026-11-27'), 'expired')
  assert.equal(stateOf({ status: 'pending' }, '2026-11-27'), 'pending')
  const rows = [
    { gcc: '1', course: 'Udaan', kind: 'Sibling', status: 'active', basis: 'fixed_per_month', value: 500, applies_to: 'course' },
    { gcc: '2', course: 'Udaan', kind: 'Staff ward', status: 'active', fee_impact: { perMonth: 1500 } },
    { gcc: '3', course: 'Pragati', kind: 'Sibling', status: 'pending' },
    { gcc: '4', course: 'Pragati', kind: 'Sibling', status: 'revoked' },
  ]
  const rep = courseReport(rows, r => r.course, '2026-11-27')
  assert.deepEqual(rep.map(g => [g.course, g.entries, g.students, g.monthly, g.pending]), [['Udaan', 2, 2, 2000, 0], ['Pragati', 0, 0, 0, 1]])
})

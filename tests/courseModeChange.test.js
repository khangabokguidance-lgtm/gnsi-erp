import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionMonths, feeImpact, changeLines, validateRequest, monthLabel } from '../src/lib/courseModeChange.js'

test('session months run April to March across two years', () => {
  const m = sessionMonths('2026-2027')
  assert.equal(m.length, 12)
  assert.deepEqual(m[0], { value: '2026-04-01', label: 'April 2026' })
  assert.deepEqual(m[11], { value: '2027-03-01', label: 'March 2027' })
  assert.equal(sessionMonths('2026-27')[9].value, '2027-01-01')
})

test('fee impact counts the months from the start month to March', () => {
  const f = feeImpact({ now: { courseFee: 2000, flatFee: 6000 }, next: { courseFee: 2000, flatFee: 2500 }, effectiveFrom: '2026-12-01', session: '2026-2027' })
  assert.equal(f.monthsAffected, 4)
  assert.equal(f.firstMonth, 'December 2026')
  assert.equal(f.before.total, 8000)
  assert.equal(f.after.total, 4500)
  assert.equal(f.perMonth, -3500)
  assert.equal(f.total, -14000)
})

test('change lines name only what changes', () => {
  assert.deepEqual(changeLines({ from_type: 'Boarder', to_type: 'Day Scholar' }), [{ what: 'Hostel type', from: 'Boarder', to: 'Day Scholar' }])
  const l = changeLines({ from_course: 'Foundation', from_batch: 'Udaan', to_course: 'Foundation', to_batch: 'Pragati' })
  assert.equal(l[0].to, 'Foundation · Pragati')
})

test('a request needs a real change, a month and a reason', () => {
  const s = { course: 'Foundation', batch: 'Udaan', hostel_type: 'Boarder' }
  assert.match(validateRequest({ student: s, toType: 'Boarder', effectiveFrom: '2026-12-01', reason: 'x y z' }), /new hostel type/)
  assert.match(validateRequest({ student: s, toType: 'Day Scholar', effectiveFrom: '', reason: 'left' }), /month/)
  assert.match(validateRequest({ student: s, toType: 'Day Scholar', effectiveFrom: '2026-12-01', reason: ' ' }), /reason/)
  assert.equal(validateRequest({ student: s, toCourse: 'Foundation', toBatch: 'Pragati', effectiveFrom: '2026-12-01', reason: 'promoted' }), '')
  assert.equal(monthLabel('2027-01-01'), 'January 2027')
})

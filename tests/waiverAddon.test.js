import test from 'node:test'
import assert from 'node:assert/strict'
import { detectWaivers } from '../src/lib/waiverDetect.js'
import { detectFeeTypes } from '../src/lib/feeTypeDetect.js'

const student = { gcc_no: 7, course: 'Combined Course', batch: '—', hostel_type: 'Boarder' }
const item = expected => ({
  student,
  reg: { writtenOff: 0, rows: [{ month: 'May', year: 2026, head: 'Course Fee', status: 'paid', expected, paid: [], paidAmt: expected, standingAmt: 0 }] },
})

test('rateOf receives the student so the Combined add-on can be added to the standard rate', () => {
  let seen = null
  detectWaivers(item(3500), a => { seen = a; return 3500 })
  assert.equal(seen.student, student)
})

test('a ₹200 reduction on a Combined month is found once the standard rate includes the add-on', () => {
  const base = 3000, addon = 500
  const withAddon = detectWaivers(item(3300), a => base + (a.student ? addon : 0))
  assert.equal(withAddon.byType.course, 200)          // standard 3500, charged 3300 → ₹200 below
  assert.equal(detectWaivers(item(3300), () => base), null)   // base only: the reduction is invisible
})

test('feeTypeDetect passes the student to rateOf', () => {
  const calls = []
  detectFeeTypes({
    students: [student], courseRows: [{ adm_app_id: 7, amount_paid: 3500, for_month: 'May', year: 2026, course: 'Combined Course' }], flatRows: [],
    rateOf: a => { calls.push(a); return 0 },
  })
  assert.ok(calls.length > 0 && calls.every(c => c.student === student))
})

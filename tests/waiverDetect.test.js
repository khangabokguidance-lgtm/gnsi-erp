import test from 'node:test'
import assert from 'node:assert/strict'
import { detectWaivers, waiverTags } from '../src/lib/waiverDetect.js'

const RATE = { course_fee: 5500, flat_fee: 6000 }
const rateOf = ({ field }) => RATE[field]
const st = (o = {}) => ({ gcc_no: '1', name: 'A', course: 'Navodaya', batch: 'B', hostel_type: 'Boarder', ...o })
const row = (month, o = {}) => ({ month, year: 2026, head: 'Course Fee', expected: 5500, paidAmt: 5500, paid: [], waived: 0, standingAmt: 0, status: 'paid', due: 0, shortBy: 0, hostelType: 'Boarder', ...o })
const reg = (rows, o = {}) => ({ rows, writtenOff: 0, ...o })

test('a normal fully-paid student has no waiver', () => {
  assert.equal(detectWaivers({ student: st(), reg: reg([row('April'), row('May')]) }, rateOf), null)
})

test('approved concession, standing scholarship and custom fee are split by fee type', () => {
  const rows = [
    row('April', { paid: [{ concession: 2500 }], paidAmt: 3000 }),
    row('May', { standingAmt: 1000, expected: 5500 }),
    row('February', { head: 'Flat Fee', expected: 4500, paidAmt: 4500 }),
  ]
  const d = detectWaivers({ student: st(), reg: reg(rows) }, rateOf)
  assert.equal(d.sources.approved, 2500)
  assert.equal(d.sources.standing, 1000)
  assert.equal(d.sources.custom, 1500)
  assert.deepEqual(d.byType, { course: 3500, flat: 1500 })
  assert.equal(d.waived, 5000)
  assert.deepEqual(waiverTags(d), ['approved', 'standing', 'custom'])
})

test('write-offs, repeaters and pending concessions are detected', () => {
  const d = detectWaivers({ student: st({ is_repeater: true }), reg: reg([row('April', { paid: [{ concessionStatus: 'pending', concession: 0 }], paidAmt: 3000, status: 'short', shortBy: 2500, due: 2500 })], { writtenOff: 3000 }) }, rateOf)
  assert.equal(d.sources.writtenOff, 3000)
  assert.equal(d.sources.pending, 1)
  assert.equal(d.repeater, true)
  assert.equal(d.waived, 3000)
})

test('the same reduced amount paid in two or more months is an unrecorded waiver', () => {
  const short = m => row(m, { paidAmt: 4000, status: 'short', shortBy: 1500, due: 1500, paid: [{ concession: 0 }] })
  const d = detectWaivers({ student: st(), reg: reg([short('April'), short('May'), short('June'), row('July', { paidAmt: 1000, status: 'short', shortBy: 4500, due: 4500, paid: [{}] })]) }, rateOf)
  assert.equal(d.unrecorded.length, 1)
  assert.deepEqual(d.unrecorded[0], { paid: 4000, fee: 5500, months: ['Apr 2026', 'May 2026', 'Jun 2026'], shortBy: 4500 })
  assert.equal(d.waived, 0)
  // a single part payment is not flagged
  assert.equal(detectWaivers({ student: st(), reg: reg([short('April')]) }, rateOf), null)
})

test('a lower rate because the hostel type changed is not a custom fee', () => {
  const lower = ({ type, field }) => (type === 'Day Scholar' ? 3000 : RATE[field])
  const d = detectWaivers({ student: st({ hostel_type: 'Day Scholar' }), reg: reg([row('April', { expected: 3000, paidAmt: 3000, hostelType: 'Day Scholar' })]) }, lower)
  assert.equal(d, null)
})

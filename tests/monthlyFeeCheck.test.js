import test from 'node:test'
import assert from 'node:assert/strict'
import { checkMonthlyFees } from '../src/lib/monthlyFeeCheck.js'

const RATES = { Boarder: { course_fee: 5500, flat_fee: 6500 }, 'Day Boarder': { course_fee: 4500, flat_fee: 5500 }, 'Day Scholar': { course_fee: 3000, flat_fee: 4000 } }
const rateOf = ({ type, field, course }) => (course === 'None' ? 0 : RATES[type][field])
const st = (o = {}) => ({ gcc_no: '1', name: 'A', status: 'Active', course: 'Navodaya', batch: 'B', hostel_type: 'Day Scholar', ...o })
const crs = (month, amount, o = {}) => ({ adm_app_id: '1', for_month: month, year: 2026, amount_paid: amount, course: 'Navodaya', hostel_type: 'Day Scholar', reverted: false, ...o })
const run = (courseRows, student = st(), extra = {}) => checkMonthlyFees({ students: [student], courseRows, flatRows: [], rateOf, ...extra })
const one = (r, i = 0) => r.results[0].months[i]

test('exact rate is ok', () => {
  const r = run([crs('April', 3000)])
  assert.equal(one(r).verdict, 'ok')
  assert.equal(r.results[0].problems.length, 0)
})
test('less than the rate is short, more is excess', () => {
  assert.deepEqual([one(run([crs('April', 2500)])).verdict, one(run([crs('April', 2500)])).diff], ['short', -500])
  assert.equal(one(run([crs('April', 3500)])).verdict, 'excess')
})
test('a balance paid later joins its month', () => {
  const r = run([crs('April', 2000), crs('April', 1000)])
  assert.equal(r.results[0].months.length, 1)
  assert.equal(one(r).verdict, 'ok')
})
test('paying another type\'s rate is wrong-type, with the detected type', () => {
  const m = one(run([crs('April', 5500, { hostel_type: 'Boarder' })]))
  assert.equal(m.verdict, 'wrong-type')
  assert.equal(m.detectedType, 'Boarder')
  assert.ok(m.flags.includes('tag-differs'))
})
test('hostel type is taken per month when typeAt is given', () => {
  const typeAt = (s, month) => (month === 'April' ? 'Day Scholar' : 'Boarder')
  const r = run([crs('April', 3000), crs('May', 5500, { hostel_type: 'Boarder' })], st(), { typeAt })
  assert.deepEqual(r.results[0].months.map(m => m.verdict), ['ok', 'ok'])
  assert.equal(r.results[0].problems.length, 0)
})
test('a recorded concession is not an error; reverted and inactive are ignored', () => {
  assert.equal(one(run([crs('April', 2000, { concession_status: 'approved' })])).verdict, 'concession')
  assert.equal(run([crs('April', 100, { reverted: true })]).results.length, 0)
  assert.equal(run([crs('April', 3000)], st({ status: 'Inactive' })).results.length, 0)
})
test('flat fee uses the flat rate; course differs is flagged; missing rate is no-rate', () => {
  const r = checkMonthlyFees({ students: [st({ hostel_type: 'Boarder' })], courseRows: [crs('May', 5500, { course: 'Sainik' })], flatRows: [{ adm_app_id: '1', paid: true, month: 'February', year: 2027, amount: 6500 }], rateOf })
  const [may, feb] = [r.results[0].months.find(m => m.month === 'May'), r.results[0].months.find(m => m.month === 'February')]
  assert.equal(may.verdict, 'ok'); assert.ok(may.flags.includes('course-differs'))
  assert.equal(feb.verdict, 'ok'); assert.equal(feb.session, '2026-2027')
  assert.equal(one(run([crs('April', 3000)], st({ course: 'None' }))).verdict, 'no-rate')
})
test('students with problems sort first and the summary counts them', () => {
  const r = checkMonthlyFees({ students: [st({ gcc_no: '1', name: 'Good' }), st({ gcc_no: '2', name: 'Bad' })], courseRows: [crs('April', 3000), crs('April', 1000, { adm_app_id: '2' })], flatRows: [], rateOf })
  assert.equal(r.results[0].student.name, 'Bad')
  assert.deepEqual([r.summary.students, r.summary.withProblems, r.summary.short, r.summary.ok], [2, 1, 1, 1])
})

import { roundingCandidates } from '../src/lib/monthlyFeeCheck.js'
test('rounding candidates: a single payment a few rupees off the rate, nothing else', () => {
  const rows = [
    crs('April', 2998, { id: 1 }),                                  // 2 short  -> candidate (to 3000)
    crs('May', 3003, { id: 2 }),                                    // 3 over   -> candidate
    crs('June', 2000, { id: 3 }),                                   // 1000 short -> not a rounding
    crs('July', 2995, { id: 4, concession_status: 'approved' }),    // concession -> skip
    crs('August', 2999, { id: 5, pay_mode: 'Razorpay' }),           // online -> skip
    crs('September', 1500, { id: 6 }), crs('September', 1498, { id: 7 }), // two payments -> skip
  ]
  const c = roundingCandidates(run(rows).results)
  assert.deepEqual(c.map((x) => [x.month, x.id, x.from, x.to, x.diff]), [['April', 1, 2998, 3000, -2], ['May', 2, 3003, 3000, 3]])
  assert.equal(c[0].table, 'adm_course_fees')
})
test('rounding candidates: the limit is adjustable', () => {
  const c = roundingCandidates(run([crs('April', 2985, { id: 1 })]).results, { maxDiff: 20 })
  assert.equal(c.length, 1)
  assert.equal(roundingCandidates(run([crs('April', 2985, { id: 1 })]).results).length, 0)
})

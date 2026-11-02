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

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectFeeTypes, sessionOfMonthYear } from '../src/lib/feeTypeDetect.js'

const RATES = { 'Boarder': { course_fee: 5500, flat_fee: 6500 }, 'Day Boarder': { course_fee: 4500, flat_fee: 5500 }, 'Day Scholar': { course_fee: 3000, flat_fee: 4000 } }
const rateOf = ({ type, field }) => RATES[type][field]
const st = (over = {}) => ({ id: 1, gcc_no: '1', name: 'A', status: 'Active', course: 'Navodaya', batch: 'B', hostel_type: 'Day Scholar', ...over })
const crs = (id, month, amount, tag, extra = {}) => ({ id, adm_app_id: '1', for_month: month, year: 2026, amount_paid: amount, hostel_type: tag, pay_date: `2026-${String(id).padStart(2, '0')}-10`, reverted: false, ...extra })
const run = (rows, student = st(), extra = {}) => detectFeeTypes({ students: [student], courseRows: rows, flatRows: [], rateOf, ...extra })

test('session of a fee month', () => {
  assert.equal(sessionOfMonthYear('April', 2026), '2026-2027')
  assert.equal(sessionOfMonth('February', 2027), '2026-2027')
  function sessionOfMonth(m, y) { return sessionOfMonthYear(m, y) }
})

test('payments tagged and priced as Boarder flag a Day Scholar record', () => {
  const r = run([crs(4, 'April', 5500, 'Boarder'), crs(5, 'May', 5500, 'Boarder'), crs(6, 'June', 5500, 'Boarder')])
  assert.equal(r.mismatches.length, 1)
  const m = r.mismatches[0]
  assert.equal(m.detected, 'Boarder')
  assert.equal(m.recorded, 'Day Scholar')
  assert.equal(m.confidence, 'high')
  assert.match(m.evidence.join(' | '), /3 of the last 3 payments charged as Boarder/)
  assert.match(m.evidence.join(' | '), /3 payment amounts match the Boarder rate/)
})

test('payments that match the recorded type are not flagged', () => {
  const r = run([crs(4, 'April', 3000, 'Day Scholar'), crs(5, 'May', 3000, 'Day Scholar')])
  assert.equal(r.mismatches.length, 0)
  assert.equal(r.matched, 1)
})

test('a hostel bed counts for Boarder', () => {
  const r = run([crs(4, 'April', 3000, 'Day Scholar')], st(), { beds: new Set(['1']) })
  // Day Scholar 1+2 = 3, Boarder bed 3: not at least double, so no flag
  assert.equal(r.mismatches.length, 0)
  const r2 = run([crs(4, 'April', 5500, 'Boarder')], st(), { beds: new Set(['1']) })
  assert.equal(r2.mismatches[0].detected, 'Boarder')
  assert.ok(r2.mismatches[0].evidence.includes('holds an active hostel bed'))
})

test('concessions, reverted rows, custom flat fees and part payments are not evidence', () => {
  const r = run([crs(4, 'April', 5500, null, { concession_status: 'approved' }), crs(5, 'May', 5500, null, { reverted: true }), crs(6, 'June', 2000, null)])
  assert.equal(r.mismatches.length, 0)
  assert.equal(r.noData, 1)
  const flat = [{ id: 1, adm_app_id: '1', paid: true, reverted: false, month: 'February', year: 2027, amount: 6500, hostel_type: null, pay_date: '2027-02-05' }]
  assert.equal(detectFeeTypes({ students: [st()], courseRows: [], flatRows: flat, rateOf, overrideGccs: new Set(['1']) }).noData, 1)
})

test('an amount shared by two types votes for neither; inactive students are skipped', () => {
  const same = ({ type }) => (type === 'Day Scholar' ? 0 : 5000)
  const r = detectFeeTypes({ students: [st()], courseRows: [crs(4, 'April', 5000, null)], flatRows: [], rateOf: same })
  assert.equal(r.mismatches.length, 0)
  assert.equal(detectFeeTypes({ students: [st({ status: 'Left' })], courseRows: [crs(4, 'April', 5500, 'Boarder')], flatRows: [], rateOf }).mismatches.length, 0)
})

test('only the most recent payments count, so a corrected type is not re-flagged', () => {
  const old = [1, 2, 3, 4].map(i => crs(i, 'April', 5500, 'Boarder', { pay_date: `2025-0${i}-10` }))
  const recent = [5, 6, 7, 8, 9, 10].map(i => crs(i, 'May', 3000, 'Day Scholar', { pay_date: `2026-${String(i).padStart(2, '0')}-10` }))
  assert.equal(run([...old, ...recent]).mismatches.length, 0)
})

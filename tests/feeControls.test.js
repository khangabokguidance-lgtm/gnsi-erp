import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFeeCollection, revertReasonError, normaliseFeeRows, runFeeChecks, receiptSeries, isDigitalFeeMode, FEE_CONTROL_DEFAULTS } from '../src/lib/feeControls.js'

const C = FEE_CONTROL_DEFAULTS

test('digital modes need a reference, cash does not', () => {
  for (const m of ['UPI', 'Cheque', 'Bank Transfer', 'DD']) assert.equal(isDigitalFeeMode(m), true, m)
  for (const m of ['Cash', 'Other', '', null]) assert.equal(isDigitalFeeMode(m), false, String(m))
  assert.match(validateFeeCollection({ payMode: 'UPI', txnRef: '', controls: C }), /reference/)
  assert.match(validateFeeCollection({ payMode: 'UPI', txnRef: '12', controls: C }), /reference/)
  assert.equal(validateFeeCollection({ payMode: 'UPI', txnRef: '412345678901', controls: C }), '')
  assert.equal(validateFeeCollection({ payMode: 'Cash', txnRef: '', controls: C }), '')
})

test('a closed day refuses non-admins but not admins', () => {
  const base = { payMode: 'Cash', controls: C, closedStatus: 'closed', payDate: '2026-10-22' }
  assert.match(validateFeeCollection({ ...base, isAdmin: false }), /already closed/)
  assert.equal(validateFeeCollection({ ...base, isAdmin: true }), '')
  assert.equal(validateFeeCollection({ ...base, closedStatus: 'reopened' }), '')
  assert.equal(validateFeeCollection({ ...base, closedStatus: null }), '')
})

test('nothing is enforced before the migration (controls = null) or when switched off', () => {
  assert.equal(validateFeeCollection({ payMode: 'UPI', txnRef: '', controls: null, closedStatus: 'closed' }), '')
  assert.equal(validateFeeCollection({ payMode: 'UPI', txnRef: '', controls: { ...C, require_digital_ref: false } }), '')
  assert.equal(validateFeeCollection({ payMode: 'Cash', closedStatus: 'closed', controls: { ...C, lock_closed_days: false } }), '')
})

test('revert needs a real reason', () => {
  assert.match(revertReasonError('', C), /reason/)
  assert.match(revertReasonError('ab', C), /reason/)
  assert.equal(revertReasonError('Wrong student charged', C), '')
  assert.equal(revertReasonError('', null), '')
  assert.equal(revertReasonError('', { ...C, require_revert_reason: false }), '')
})

const adm = [{ id: 1, adm_app_id: '1', amount_paid: 500, pay_date: '2026-10-01', pay_mode: 'Cash', receipt_no: 'R1', collected_by: 'A', receipt_serial: 'R/2026-27/000001' }]
const flat = [
  { id: 2, adm_app_id: '2', amount: 3000, paid: true, pay_date: '2026-10-02', pay_mode: 'UPI', txn_ref: '', receipt_no: 'R2', collected_by: 'A' },
  { id: 3, adm_app_id: '9', amount: 3000, paid: false, pay_date: null },                         // unpaid placeholder: ignored
  { id: 4, adm_app_id: '4', amount: 3000, paid: false, reverted: true, pay_date: '2026-10-03', pay_mode: 'Cash', receipt_no: 'R4', reverted_by: 'Admin', revert_reason: '' },
]
const course = [
  { id: 5, adm_app_id: '5', amount_paid: 1500, pay_date: '2026-10-04', pay_mode: 'Cash', receipt_no: 'R5', collected_by: 'B', collected_at: '2026-10-05T09:00:00Z' },
  { id: 6, adm_app_id: '6', amount_paid: 1500, pay_date: '2026-10-04', pay_mode: 'Cash', receipt_no: 'R5', collected_by: 'B' },   // same receipt, different student
  { id: 7, adm_app_id: '7', amount_paid: 1500, pay_date: '2026-10-04', pay_mode: '', receipt_no: 'R7', collected_by: 'B' },
  { id: 8, adm_app_id: '8', amount_paid: 1500, pay_date: '2026-10-04', pay_mode: 'Bank Transfer', txn_ref: 'NEFT998877', receipt_no: 'R8', collected_by: 'B' },
]

test('normalise: unpaid placeholders and zero rows are dropped, reverts kept (not live)', () => {
  const rows = normaliseFeeRows(adm, flat, course)
  assert.equal(rows.some(r => r.id === 'adm_flat_fees:3'), false)
  const rev = rows.find(r => r.id === 'adm_flat_fees:4'); assert.equal(rev.live, false); assert.equal(rev.reverted, true)
  assert.equal(rows.filter(r => r.live).length, 6)
})

test('fee checks find each problem and ignore reverted / placeholder rows', () => {
  const rows = normaliseFeeRows(adm, flat, course)
  const refunds = [
    { id: 'a', gcc: '1', kind: 'refund', amount: 800, status: 'approved', requested_by: 'Rita', decided_by: 'rita ', created_at: '2026-10-06T10:00:00Z' },
    { id: 'b', gcc: '1', kind: 'refund', amount: 800, status: 'approved', requested_by: 'Rita', decided_by: 'Admin' },
    { id: 'c', gcc: '1', kind: 'refund', amount: 800, status: 'pending', requested_by: 'Rita', decided_by: 'Rita' },
  ]
  const closes = [{ close_date: '2026-10-04', status: 'closed', created_at: '2026-10-04T18:00:00Z' }, { close_date: '2026-10-02', status: 'reopened', created_at: '2026-10-02T18:00:00Z' }]
  const by = Object.fromEntries(runFeeChecks({ rows, refunds, closes }, { serialReady: true }).map(c => [c.code, c]))
  assert.deepEqual(by.FC1.rows.map(r => r.id), ['adm_flat_fees:2'])                       // UPI, no ref; bank transfer with ref is fine
  assert.deepEqual(by.FC2.rows.map(r => r.id), ['adm_flat_fees:4'])                       // revert with empty reason
  assert.deepEqual(by.FC3.rows.map(r => r.id), ['adm_course_fees:5'])                     // entered 5 Oct after the 4 Oct close
  assert.deepEqual(by.FC4.rows.map(r => r.id), ['refund:a'])                              // only the approved self-approved one
  assert.deepEqual(by.FC5.rows.map(r => r.gcc).sort(), ['5', '6'])                        // receipt R5 on two students
  assert.deepEqual(by.FC6.rows.map(r => r.id), ['adm_course_fees:7'])                     // no payment mode
  assert.equal(by.FC8.aggregate, true)
  assert.equal(by.FC1.severity, 'High')
})

test('reversal concentration needs five or more', () => {
  const mk = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, adm_app_id: String(i), amount_paid: 100, pay_date: '2026-10-01', pay_mode: 'Cash', receipt_no: `X${i}`, reverted: true, reverted_by: 'Admin', revert_reason: 'Entered twice by mistake' }))
  assert.equal(runFeeChecks({ rows: normaliseFeeRows(mk(4)) }).some(c => c.code === 'FC7'), false)
  assert.equal(runFeeChecks({ rows: normaliseFeeRows(mk(5)) }).some(c => c.code === 'FC7'), true)
})

test('a clean ledger raises nothing', () => {
  const rows = normaliseFeeRows([adm[0]], [], [course[3]])
  assert.deepEqual(runFeeChecks({ rows, refunds: [], closes: [] }), [])
})

test('receipt series: one line per receipt, summed, newest serial first', () => {
  const rows = normaliseFeeRows(
    [{ id: 1, adm_app_id: '1', amount_paid: 500, pay_date: '2026-10-01', pay_mode: 'Cash', receipt_no: 'RA', receipt_serial: 'R/2026-27/000001' }],
    [{ id: 2, adm_app_id: '1', amount: 3000, paid: true, pay_date: '2026-10-01', pay_mode: 'Cash', receipt_no: 'RA', receipt_serial: 'R/2026-27/000001' }],
    [{ id: 3, adm_app_id: '2', amount_paid: 1500, pay_date: '2026-10-02', pay_mode: 'Cash', receipt_no: 'RB', receipt_serial: 'R/2026-27/000002' }])
  const s = receiptSeries(rows)
  assert.deepEqual(s.map(x => [x.receipt, x.amount, x.serial]), [['RB', 1500, 'R/2026-27/000002'], ['RA', 3500, 'R/2026-27/000001']])
})

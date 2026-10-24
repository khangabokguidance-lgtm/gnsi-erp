import test from 'node:test'
import assert from 'node:assert/strict'
import { pickNextDue } from '../src/lib/portalPay.js'
import { buildOnlineRecords, receiptFor } from '../api/_razorpay/record.js'

const item = (month, year, o = {}) => ({ month, year, expected: 5500, due: 5500, paid: false, ...o })

test('the payment link is for what is still owed, not the full month fee', () => {
  const dues = { admission: { paid: true, due: 0 }, flatFee: { items: [] }, courseFee: { items: [item('April', 2026, { due: 3500 }), item('May', 2026)] } }
  assert.deepEqual(pickNextDue(dues), { kind: 'course', amount: 3500, for_month: 'April', year: 2026 })
})

test('a month covered by a scholarship is skipped, and the oldest month wins across flat and course', () => {
  const dues = { admission: { paid: true, due: 0 }, flatFee: { items: [item('February', 2027, { expected: 6000, due: 6000 })] }, courseFee: { items: [item('April', 2026, { paid: true, due: 0 }), item('October', 2026, { due: 4500 })] } }
  assert.deepEqual(pickNextDue(dues), { kind: 'course', amount: 4500, for_month: 'October', year: 2026 })
})

test('admission first, nothing owed gives null', () => {
  assert.deepEqual(pickNextDue({ admission: { paid: false, due: 2000 }, flatFee: { items: [] }, courseFee: { items: [item('April', 2026)] } }), { kind: 'admission', amount: 2000 })
  assert.equal(pickNextDue({ admission: { paid: true, due: 0 }, flatFee: { items: [] }, courseFee: { items: [item('April', 2026, { paid: true, due: 0 })] } }), null)
  assert.equal(pickNextDue(null), null)
})

test('online course payment: fee row, receipt number and an Accounts row that counts as fee income', () => {
  const r = buildOnlineRecords({ notes: { gcc: '12', kind: 'course', for_month: 'June', year: '2026', course: 'Navodaya', studentName: 'Asha' }, paymentId: 'pay_Abc123', amount: 4500, payDate: '2026-06-10' })
  assert.equal(r.table, 'adm_course_fees')
  assert.equal(r.receipt, 'RZP-ABC123')
  assert.equal(receiptFor('pay_Abc123'), 'RZP-ABC123')
  assert.deepEqual(r.row, { adm_app_id: '12', course: 'Navodaya', for_month: 'June', year: 2026, amount_paid: 4500, student_name: 'Asha', pay_date: '2026-06-10', pay_mode: 'Razorpay', txn_ref: 'pay_Abc123', receipt_no: 'RZP-ABC123', collected_by: 'Online (Razorpay)', reverted: false })
  assert.equal(r.account.source_type, 'fee_payment')
  assert.equal(r.account.source_ref, 'pay_Abc123')
  assert.equal(r.account.category, 'Fees')
  assert.equal(r.account.payment_mode, 'Razorpay')
  assert.equal(r.account.note, 'Asha · Course Fee June 2026 · RZP-ABC123')
  // the Accounts check finds the receipt number in the note
  assert.match(r.account.note.split(' · ').find(p => /^[A-Z]{2,}[-/]\S+$/.test(p)), /^RZP-ABC123$/)
})

test('online flat and admission payments go to the right tables', () => {
  const f = buildOnlineRecords({ notes: { gcc: '12', kind: 'flat', for_month: 'February', year: '2027' }, paymentId: 'pay_X', amount: 6000, payDate: '2027-02-05' })
  assert.equal(f.table, 'adm_flat_fees'); assert.equal(f.row.paid, true); assert.equal(f.row.month, 'February'); assert.equal(f.account.category, 'Hostel')
  assert.equal(f.account.note, 'GCC-12 · Flat Fee February 2027 · RZP-X')
  const a = buildOnlineRecords({ notes: { gcc: '12', kind: 'admission' }, paymentId: 'pay_Y', amount: 3000, payDate: '2026-04-06' })
  assert.equal(a.table, 'adm_fee_collections'); assert.equal(a.row.fee_type, 'admission'); assert.equal(a.row.description, 'Admission Fee')
})

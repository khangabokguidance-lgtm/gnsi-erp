import test from 'node:test'
import assert from 'node:assert/strict'
import { findStudentsByAmount, sessionOfMonth, gccKeyOf } from '../src/lib/amountFinder.js'

const students = [{ gcc_no: 11, name: 'Asha' }, { gcc_no: 12, name: 'Bimal' }, { gcc_no: 13, name: 'Chen' }]
const crs = [
  { adm_app_id: 11, amount_paid: 6500, for_month: 'April', year: 2026 },
  { adm_app_id: 11, amount_paid: 6500, for_month: 'May', year: 2026 },
  { adm_app_id: 11, amount_paid: 6000, for_month: 'June', year: 2026 },
  { adm_app_id: 12, amount_paid: 6500, for_month: 'April', year: 2025 },
  { adm_app_id: 13, amount_paid: 6000, for_month: 'April', year: 2026 },
  { adm_app_id: 99, amount_paid: 6500, for_month: 'April', year: 2026 },   // not on the student list
]
const flat = [{ adm_app_id: 12, amount: 6500, month: 'February', year: 2027 }]

test('finds students with payments of the exact amount, most months first', () => {
  const r = findStudentsByAmount({ students, rows: { crs, flat }, amount: 6500 })
  assert.deepEqual(r.map(x => [x.student.name, x.matches.length, x.payments]), [['Asha', 2, 3], ['Bimal', 2, 2]])
})

test('can be limited to course fee, flat fee or one session', () => {
  assert.deepEqual(findStudentsByAmount({ students, rows: { crs, flat }, amount: 6500, kind: 'flat' }).map(x => x.student.name), ['Bimal'])
  assert.deepEqual(findStudentsByAmount({ students, rows: { crs, flat }, amount: 6500, kind: 'course', session: '2026-2027' }).map(x => x.student.name), ['Asha'])
})

test('accepts the Map-by-GCC shape the ledger loader returns', () => {
  const rows = { crs: new Map([['11', crs.filter(r => r.adm_app_id === 11)]]), flat: new Map() }
  assert.equal(findStudentsByAmount({ students, rows, amount: 6500 })[0].matches.length, 2)
})

test('bad amounts and unknown students give nothing', () => {
  assert.deepEqual(findStudentsByAmount({ students, rows: { crs, flat }, amount: 0 }), [])
  assert.deepEqual(findStudentsByAmount({ students, rows: { crs, flat }, amount: 'abc' }), [])
  assert.deepEqual(findStudentsByAmount({ students, rows: { crs, flat }, amount: 7777 }), [])
})

test('sessions run April to March', () => {
  assert.equal(sessionOfMonth('April', 2026), '2026-2027')
  assert.equal(sessionOfMonth('March', 2027), '2026-2027')
  assert.equal(sessionOfMonth('Nope', 2026), '')
  assert.equal(gccKeyOf('GCC-0042'), '42')
})

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

import { amountDistribution, studentAmounts } from '../src/lib/amountFinder.js'

test('distribution counts payments and distinct students for each amount', () => {
  const d = amountDistribution({ students, rows: { crs, flat } })
  const a6500 = d.find(x => x.amount === 6500), a6000 = d.find(x => x.amount === 6000)
  assert.deepEqual([a6500.students, a6500.payments, a6500.course, a6500.flat], [2, 4, 3, 1])   // Asha, Bimal (3 course + 1 flat)
  assert.deepEqual([a6000.students, a6000.payments], [2, 2])
  assert.equal(d[0].amount, 6500)                                                              // most payments first
  assert.ok(!d.some(x => x.amount === 7777))
})

test('distribution can be limited by fee type and session', () => {
  assert.deepEqual(amountDistribution({ students, rows: { crs, flat }, kind: 'flat' }).map(x => [x.amount, x.payments]), [[6500, 1]])
  const s = amountDistribution({ students, rows: { crs, flat }, kind: 'course', session: '2026-2027' })
  assert.deepEqual(s.map(x => [x.amount, x.payments]), [[6500, 2], [6000, 2]])
})

test('per-student summary gives the usual amount, range, total and number of different amounts', () => {
  const r = studentAmounts({ students, rows: { crs, flat } })
  const asha = r.find(x => x.student.name === 'Asha')
  assert.deepEqual([asha.usual, asha.usualCount, asha.min, asha.max, asha.total, asha.distinct, asha.payments], [6500, 2, 6000, 6500, 19000, 2, 3])
  const chen = r.find(x => x.student.name === 'Chen')
  assert.deepEqual([chen.usual, chen.distinct], [6000, 1])
  assert.equal(r.length, 3)   // GCC 99 is not a listed student
})

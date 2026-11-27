import test from 'node:test'
import assert from 'node:assert/strict'
import { ledgerFigures, statusMatches, matchesSearch, courseTotals, ledgerCourse } from '../src/lib/courseLedger.js'

const row = (month, status, expected, paidAmt, due) => ({ month, year: 2026, status, expected, paidAmt, due, waived: 0 })
const item = (student, rows, { totalPaid, totalDue, arrears = 0, entries = [] }) => ({ student, entries, arrears, reg: { rows, totalPaid, totalDue, writtenOff: 0, admission: null } })

const a = item({ name: 'Asha', gcc_no: 11, batch: 'Udaan' }, [row('April', 'paid', 6500, 6500, 0), row('May', 'due', 6500, 0, 6500)], { totalPaid: 6500, totalDue: 6500, entries: [{ receipt: 'GN-0042' }] })
const b = item({ name: 'Bimal', gcc_no: 12, course: 'Sainik' }, [row('April', 'paid', 7000, 7000, 0), row('May', 'paid', 7000, 7000, 0)], { totalPaid: 14000, totalDue: 0 })
const c = item({ name: 'Chen', gcc_no: 13, batch: 'Pragati' }, [row('April', 'due', 6500, 0, 6500), row('May', 'upcoming', 6500, 0, 0)], { totalPaid: 0, totalDue: 6500, arrears: 1000 })

test('whole-session figures: partial, paid and unpaid, with dues brought forward', () => {
  assert.deepEqual(ledgerFigures(a), { billed: 13000, paid: 6500, due: 6500, concession: 0, status: 'partial', dueMonths: ['May'] })
  assert.equal(ledgerFigures(b).status, 'paid')
  const fc = ledgerFigures(c)
  assert.equal(fc.due, 7500); assert.equal(fc.status, 'due'); assert.deepEqual(fc.dueMonths, ['b/f', 'Apr'])
})

test('one month: that month only; an upcoming month is not due yet', () => {
  assert.deepEqual(ledgerFigures(a, 1), { billed: 6500, paid: 0, due: 6500, concession: 0, status: 'due', dueMonths: ['May'] })
  assert.equal(ledgerFigures(a, 0).status, 'paid')
  assert.equal(ledgerFigures(c, 1).status, 'na')
})

test('status filter', () => {
  assert.ok(statusMatches('partial', 'owing')); assert.ok(statusMatches('due', 'owing')); assert.ok(!statusMatches('paid', 'owing'))
  assert.ok(statusMatches('paid', 'all')); assert.ok(!statusMatches('due', 'partial'))
})

test('search finds name, GCC and receipt number', () => {
  assert.ok(matchesSearch(a, 'asha')); assert.ok(matchesSearch(a, 'gcc-11')); assert.ok(matchesSearch(a, 'gn-0042')); assert.ok(!matchesSearch(b, 'gn-0042'))
})

test('course totals in the standard course order', () => {
  const rows = [a, b, c].map(x => ({ x, f: ledgerFigures(x) }))
  assert.equal(ledgerCourse(a.student), 'Foundation')
  const t = courseTotals(rows)
  assert.deepEqual(t.map(x => [x.course, x.students, x.paid, x.due, x.withDues]), [['Sainik', 1, 14000, 0, 0], ['Foundation', 2, 6500, 14000, 2]])
})

test('approved concession: billed is net of it, and it is shown on its own', () => {
  const w = (month, status, expected, paidAmt, due, waived) => ({ ...row(month, status, expected, paidAmt, due), waived })
  const d = item({ name: 'Dina', gcc_no: 14, batch: 'Udaan' }, [w('April', 'paid', 6500, 5000, 0, 1500), w('May', 'due', 6500, 0, 5000, 1500), w('June', 'upcoming', 6500, 0, 0, 1500)], { totalPaid: 5000, totalDue: 5000 })
  const s = ledgerFigures(d)
  assert.equal(s.billed, 10000); assert.equal(s.concession, 3000)   // June has not started
  const m = ledgerFigures(d, 1)
  assert.equal(m.billed, 5000); assert.equal(m.concession, 1500); assert.equal(m.due, 5000)
  assert.equal(ledgerFigures(d, 2).concession, 0)
  const t = courseTotals([a, d].map(x => ({ x, f: ledgerFigures(x) })))
  assert.deepEqual([t[0].concession, t[0].withConcession], [3000, 1])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyOwed, writeOffShares } from '../src/lib/monthwiseDues.js'

const row = (month, year, status, expected, paidAmt, due, waived = 0) => ({ month, year, status, expected, paidAmt, due, waived })

test('monthlyOwed: net of concession, ignores upcoming / before', () => {
  assert.equal(monthlyOwed(row('May', 2026, 'upcoming', 1000, 0, 0)), null)
  assert.equal(monthlyOwed(row('May', 2026, 'before', 1000, 0, 0)), null)
  assert.deepEqual(monthlyOwed(row('May', 2026, 'due', 1000, 0, 800, 200)), { expected: 800, paid: 0, due: 800 })
  assert.equal(monthlyOwed(row('May', 2026, 'short', 1000, 400, 0)).due, 600)
})

test('writeOffShares: oldest month first, then admission', () => {
  const reg = { rows: [row('April', 2026, 'due', 1000, 0, 1000), row('May', 2026, 'due', 1000, 0, 1000), row('June', 2026, 'paid', 1000, 1000, 0)], admission: { due: 500 } }
  const s = writeOffShares(reg, 1200)
  assert.equal(s.byMonth.get('April|2026'), 1000)
  assert.equal(s.byMonth.get('May|2026'), 200)
  assert.equal(s.adm, 0)
  assert.equal(writeOffShares(reg, 2300).adm, 300)
  assert.equal(writeOffShares(reg, 0).byMonth.size, 0)
  assert.equal(writeOffShares(reg, 99999).adm, 500)
})

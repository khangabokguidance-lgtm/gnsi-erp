import test from 'node:test'
import assert from 'node:assert/strict'
import { rowExcess, registerExcess } from '../src/lib/registerExcess.js'

const row = (status, expected, paidAmt) => ({ status, expected, paidAmt })

test('a month paid above its due shows the extra', () => {
  assert.equal(rowExcess(row('paid', 6000, 6500)), 500)
})

test('exact, short, unpaid and advance months have no excess', () => {
  assert.equal(rowExcess(row('paid', 6000, 6000)), 0)
  assert.equal(rowExcess(row('paid', 6000, 6000.3)), 0)     // rounding noise
  assert.equal(rowExcess(row('short', 6000, 4000)), 0)
  assert.equal(rowExcess(row('due', 6000, 0)), 0)
  assert.equal(rowExcess(row('advance', 6000, 12000)), 0)   // advance is already shown as its own status
  assert.equal(rowExcess(null), 0)
})

test('the register total adds the extra of every overpaid month', () => {
  const reg = { rows: [row('paid', 6000, 6500), row('paid', 6000, 6500), row('paid', 6000, 6000), row('due', 6000, 0)] }
  assert.deepEqual(registerExcess(reg), { total: 1000, months: 2 })
  assert.deepEqual(registerExcess({ rows: [] }), { total: 0, months: 0 })
  assert.deepEqual(registerExcess(undefined), { total: 0, months: 0 })
})

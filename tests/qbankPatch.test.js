// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyBankPatch } from '../src/qbankPatch.js'

const bank = [{ id: 1, question: 'A', correct_option: 'A' }, { id: 2, question: 'B', correct_option: 'B' }, { id: 3, question: 'C', correct_option: 'C' }]

test('remove drops only the listed ids and leaves the original list alone', () => {
  const next = applyBankPatch(bank, { remove: [1, 3] })
  assert.deepEqual(next.map(q => q.id), [2])
  assert.equal(bank.length, 3)
})

test('update changes only the given fields of the matching row', () => {
  const next = applyBankPatch(bank, { update: [{ id: 2, question: 'B2' }] })
  assert.deepEqual(next[1], { id: 2, question: 'B2', correct_option: 'B' })
  assert.equal(next[0], bank[0], 'untouched rows keep their identity')
  assert.equal(bank[1].question, 'B')
})

test('add appends new rows once, even if applied twice', () => {
  const rows = [{ id: 4, question: 'D' }]
  const once = applyBankPatch(bank, { add: rows })
  assert.deepEqual(once.map(q => q.id), [1, 2, 3, 4])
  assert.deepEqual(applyBankPatch(once, { add: rows }).map(q => q.id), [1, 2, 3, 4])
})

test('several changes together, and nothing to do', () => {
  const next = applyBankPatch(bank, { remove: [1], update: [{ id: 3, question: 'C2' }], add: [{ id: 9, question: 'Z' }] })
  assert.deepEqual(next.map(q => `${q.id}:${q.question}`), ['2:B', '3:C2', '9:Z'])
  assert.equal(applyBankPatch(bank, {}), bank)
  assert.equal(applyBankPatch(bank), bank)
  assert.deepEqual(applyBankPatch(bank, { update: [{ id: 99, question: 'x' }] }).map(q => q.id), [1, 2, 3])
})

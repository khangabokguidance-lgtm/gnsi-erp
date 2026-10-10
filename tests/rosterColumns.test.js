// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseColumns, covers, pickColumns } from '../src/rosterColumns.js'

test('parseColumns: plain lists, spacing and *', () => {
  assert.deepEqual(parseColumns('id, name ,gcc_no'), ['id', 'name', 'gcc_no'])
  assert.deepEqual(parseColumns('*'), ['*'])
  assert.deepEqual(parseColumns(undefined), ['*'])
  assert.equal(parseColumns('id, house:houses(name)'), null)
  assert.equal(parseColumns('id,'), null)
})

test('covers: a list covers its own subsets, * covers everything', () => {
  assert.equal(covers(['id', 'name', 'house'], ['id', 'house']), true)
  assert.equal(covers(['id', 'name'], ['id', 'house']), false)
  assert.equal(covers(['*'], ['id', 'house']), true)
  assert.equal(covers(['*'], ['*']), true)
  assert.equal(covers(['id', 'name'], ['*']), false)
  assert.equal(covers(null, ['id']), false)
  assert.equal(covers(['id'], null), false)
})

test('pickColumns: keeps only the wanted columns, in the wanted order', () => {
  const rows = [{ id: 1, name: 'A', house: 'X', phone: '9' }, { id: 2, name: 'B', house: null }]
  assert.deepEqual(pickColumns(rows, ['house', 'id']), [{ house: 'X', id: 1 }, { house: null, id: 2 }])
  assert.deepEqual(pickColumns(rows, ['phone']), [{ phone: '9' }, { phone: null }])
  assert.equal(pickColumns(rows, ['*']), rows)
})

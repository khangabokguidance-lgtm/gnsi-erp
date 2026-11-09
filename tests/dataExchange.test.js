// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { toCsv, parseCsv, cleanValue, rowsForUpsert, chunk, tablesFromJson, forSheet } from '../src/dataExchange.js'
import { BACKUP_TABLES, pkOf, tablesForTier, importableNames, exportableTables } from '../src/backupTables.js'

test('csv: round trip with commas, quotes, line breaks and blanks', () => {
  const rows = [{ id: 1, name: 'Asha, K', note: 'said "hi"\nbye', empty: null }, { id: 2, name: 'Bo', note: '', empty: null }]
  const parsed = parseCsv(toCsv(rows))
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].name, 'Asha, K')
  assert.equal(parsed[0].note, 'said "hi"\nbye')
  assert.equal(parsed[1].id, '2')
})

test('csv: objects are written as JSON and read back by cleanValue', () => {
  const text = toCsv([{ id: 1, meta: { a: [1, 2] } }])
  const row = parseCsv(text)[0]
  assert.deepEqual(cleanValue(row.meta), { a: [1, 2] })
})

test('csv: byte order mark, CRLF and blank lines', () => {
  const rows = parseCsv('﻿id,name\r\n1,A\r\n\r\n2,B\r\n')
  assert.deepEqual(rows, [{ id: '1', name: 'A' }, { id: '2', name: 'B' }])
  assert.deepEqual(parseCsv('id,name'), [])
  assert.deepEqual(parseCsv(''), [])
})

test('cleanValue: empty is null, broken JSON stays text', () => {
  assert.equal(cleanValue('  '), null)
  assert.equal(cleanValue(undefined), null)
  assert.equal(cleanValue(5), 5)
  assert.equal(cleanValue('{not json}'), '{not json}')
  assert.equal(cleanValue('abc'), 'abc')
})

test('rowsForUpsert: skips rows without a key, keeps the last of duplicates', () => {
  const { rows, skipped } = rowsForUpsert([{ id: 1, a: 'x' }, { id: '', a: 'y' }, { a: 'z' }, { id: 1, a: 'last' }, null], 'id')
  assert.equal(skipped, 3)
  assert.deepEqual(rows, [{ id: 1, a: 'last' }])
  assert.deepEqual(rowsForUpsert([{ key: 'k', value: '{"a":1}' }], 'key').rows, [{ key: 'k', value: { a: 1 } }])
})

test('chunk and tablesFromJson', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(tablesFromJson({ tables: { students: [{ id: 1 }], bad: 3 } }), { students: [{ id: 1 }] })
  assert.deepEqual(tablesFromJson({ students: [{ id: 1 }] }), { students: [{ id: 1 }] })
  assert.deepEqual(tablesFromJson([{ id: 1 }], 'houses'), { houses: [{ id: 1 }] })
  assert.deepEqual(tablesFromJson([{ id: 1 }]), {})
  assert.deepEqual(tablesFromJson('x'), {})
})

test('forSheet trims huge cells and blanks nulls', () => {
  assert.equal(forSheet(null), '')
  assert.equal(forSheet('a'.repeat(40000)).length, 32000)
  assert.equal(forSheet({ a: 1 }), '{"a":1}')
})

test('backup table list: unique names, sensible tiers and keys', () => {
  const names = BACKUP_TABLES.map(t => t.name)
  assert.equal(new Set(names).size, names.length)
  assert.equal(pkOf('system_settings'), 'key')
  assert.equal(pkOf('students'), 'id')
  assert.ok(tablesForTier(false).every(t => t.tier === 'daily'))
  assert.ok(tablesForTier(true).length > tablesForTier(false).length)
  assert.ok(!exportableTables().some(t => t.name === 'portal_users'))
  assert.ok(!importableNames().has('portal_users') && !importableNames().has('audit_log'))
  assert.ok(importableNames().has('students'))
})

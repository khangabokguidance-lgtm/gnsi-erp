import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMaterial, storagePath, subjectSummary, subjectContent, searchRows, fileTypeOf, fmtSize, MAX_BYTES } from '../src/lib/classMaterialLogic.js'

const f = (name, size = 1000) => ({ name, size })
test('file types: only pdf and images', () => {
  assert.equal(fileTypeOf('a.PDF'), 'pdf'); assert.equal(fileTypeOf('a.jpeg'), 'image'); assert.equal(fileTypeOf('a.docx'), ''); assert.equal(fileTypeOf('a.exe'), '')
})
test('validation', () => {
  const ok = { title: 'Fractions', course: 'Navodaya', subject: 'Maths' }
  assert.equal(buildMaterial({ ...ok, title: ' ' }, f('a.pdf'), 'A').ok, false)
  assert.equal(buildMaterial({ ...ok, course: 'Combined Course' }, f('a.pdf'), 'A').ok, false)
  assert.equal(buildMaterial({ ...ok, subject: '' }, f('a.pdf'), 'A').ok, false)
  assert.equal(buildMaterial(ok, null, 'A').ok, false)
  assert.equal(buildMaterial(ok, f('a.docx'), 'A').ok, false)
  assert.equal(buildMaterial(ok, f('a.pdf', MAX_BYTES + 1), 'A').ok, false)
  assert.equal(buildMaterial({ ...ok, kind: 'test_series' }, f('a.pdf'), 'A').ok, false)
  assert.equal(buildMaterial({ ...ok, kind: 'test_series', series_name: 'S1', test_no: 0 }, f('a.pdf'), 'A').ok, false)
  const r = buildMaterial({ ...ok, kind: 'test_series', series_name: ' S1 ', test_no: '3' }, f('a.pdf'), 'Admin')
  assert.equal(r.row.series_name, 'S1'); assert.equal(r.row.test_no, 3); assert.equal(r.row.file_type, 'pdf'); assert.equal(r.row.uploaded_by, 'Admin')
  assert.equal(buildMaterial(ok, f('a.pdf'), 'A').row.series_name, '')
})
test('storage path is safe', () => {
  assert.equal(storagePath('Navodaya', 'Mental Ability', 'My File (1).PDF', 5), 'navodaya/mental-ability/5-my-file-1.pdf')
})
const rows = [
  { id: 1, kind: 'material', course: 'Navodaya', subject: 'Maths', title: 'Ch 10', batch: '' },
  { id: 2, kind: 'material', course: 'Navodaya', subject: 'Maths', title: 'Ch 2', batch: '' },
  { id: 3, kind: 'test_series', course: 'Navodaya', subject: 'Maths', title: 'T10', series_name: 'Series A', test_no: 10 },
  { id: 4, kind: 'test_series', course: 'Navodaya', subject: 'Maths', title: 'T2', series_name: 'Series A', test_no: 2 },
  { id: 5, kind: 'material', course: 'Sainik', subject: 'GK', title: 'x' },
  { id: 6, kind: 'material', course: 'Navodaya', subject: 'EVS', title: 'hidden', active: false },
  { id: 7, kind: 'material', course: 'Navodaya', subject: 'EVS', title: 'Umeed only', batch: 'Umeed' },
]
test('subject cards count materials and tests, skip hidden', () => {
  assert.deepEqual(subjectSummary(rows, 'Navodaya'), [{ subject: 'EVS', materials: 1, tests: 0 }, { subject: 'Maths', materials: 2, tests: 2 }])
  assert.deepEqual(subjectSummary(rows, 'Navodaya', 'Lakshya A').map((s) => s.subject), ['Maths'])
  assert.deepEqual(subjectSummary(rows, 'Foundation'), [])
})
test('content: natural order and tests in number order', () => {
  const c = subjectContent(rows, 'Navodaya', 'Maths')
  assert.deepEqual(c.materials.map((m) => m.title), ['Ch 2', 'Ch 10'])
  assert.deepEqual(c.series[0].tests.map((t) => t.test_no), [2, 10])
})
test('search and size', () => {
  assert.equal(searchRows(rows, 'series a').length, 2); assert.equal(searchRows(rows, '').length, rows.length)
  assert.equal(fmtSize(2 * 1048576), '2.0 MB'); assert.equal(fmtSize(10), '1 KB')
})

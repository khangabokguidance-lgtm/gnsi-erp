import test from 'node:test'
import assert from 'node:assert/strict'
import { sainikKitRows, foundationKitRows, kitCsv, kitCountLine, EXAM_KIT_TOOLS } from '../src/lib/examKit.js'

const roster = [
  { gcc: '1114', name: 'ABHINAV LAISHRAM', group: 'sainik', batch: 'Achiever' },
  { gcc: '1055', name: 'ALBERT YENGKOKPAM', group: 'sainik', batch: 'Leader' },
  { gcc: '827', name: 'CHABUNGBAM, CHINGLEMBI', group: 'sainik', batch: 'Champion' },
  { gcc: '2001', name: 'COMBINED KID', group: 'combined', batch: 'Combined · English' },
  { gcc: '', name: 'NO GCC', group: 'sainik', batch: 'Leader' },
]

test('Sainik rows use the sheet class names and leave out Combined unless asked', () => {
  const rows = sainikKitRows(roster)
  assert.deepEqual(rows.map(r => r.cls), ['Sainik Achiever', 'Sainik Leader', 'Sainik Champion'])
  assert.equal(rows[2].name, 'CHABUNGBAM CHINGLEMBI')   // a comma would break the CSV
  assert.equal(sainikKitRows(roster, { includeCombined: true }).length, 4)
})

test('Foundation rows take gcc_no, then admission_no, and the placed batch', () => {
  const rows = foundationKitRows([
    { gcc_no: '787', name: 'ABHUJAM AIMLIEN CHANU', batchName: 'Udaan' },
    { admission_no: 'A-9', name: 'NEW CHILD', batchName: 'Pragati' },
    { gcc_no: '1', name: 'NO CLASS', batchName: '' },
  ])
  assert.deepEqual(rows, [
    { gcc: '787', name: 'ABHUJAM AIMLIEN CHANU', cls: 'Udaan' },
    { gcc: 'A-9', name: 'NEW CHILD', cls: 'Pragati' },
  ])
})

test('CSV has the header, keeps class order and sorts by name inside a class', () => {
  const csv = kitCsv([
    { gcc: '2', name: 'ZED', cls: 'Udaan' }, { gcc: '3', name: 'AMY', cls: 'Pragati' }, { gcc: '1', name: 'BEN', cls: 'Udaan' },
  ])
  assert.equal(csv, 'GCC No,Name,Class\n1,BEN,Udaan\n2,ZED,Udaan\n3,AMY,Pragati')
  assert.equal(kitCountLine([{ cls: 'Udaan' }, { cls: 'Udaan' }, { cls: 'Pragati' }]), 'Udaan 2 · Pragati 1')
})

test('each mission lists its tools with a file under /exam-kit', () => {
  assert.deepEqual(EXAM_KIT_TOOLS.sainik.map(t => t.id), ['roll', 'omr'])
  assert.deepEqual(EXAM_KIT_TOOLS.foundation.map(t => t.id), ['book', 'roll', 'omr'])
  for (const t of [...EXAM_KIT_TOOLS.sainik, ...EXAM_KIT_TOOLS.foundation]) assert.match(t.file, /^[a-z-]+\.html$/)
})

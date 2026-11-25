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

import { sainikSeries, foundationSeries, pickTest, examMessage, longDate, durationText } from '../src/lib/examKit.js'

const SUBJ = [{ label: 'Mathematics' }, { label: 'Reasoning' }, { label: 'Science' }, { label: 'General Knowledge' }, { label: 'English Grammar' }, { label: 'Vocabulary' }]
const MOCK = [{ label: 'Mathematics', q: 50, marks: 150 }, { label: 'Intelligence', q: 25, marks: 50 }, { label: 'Grammar + Vocabulary', q: 25, marks: 50 }, { label: 'Science + GK', q: 25, marks: 50 }]

test('Pre Mock is six sections of 25 × 2 marks; Mega Mock is the AISSEE pattern in 150 minutes', () => {
  const [pre] = sainikSeries('pre', [{ id: 'PMT-03', date: '2026-12-04' }], { subjects: SUBJ })
  assert.equal(pre.q, 150); assert.equal(pre.marks, 300); assert.equal(pre.tag, 'pre-PMT-03'); assert.equal(pre.title, 'Pre Mock Test · PMT-03')
  const [mega] = sainikSeries('mega', [{ id: 'MT-01', date: '2027-01-10' }], { mockSections: MOCK })
  assert.equal(mega.q, 125); assert.equal(mega.marks, 300); assert.equal(mega.sections[0].each, 3); assert.equal(mega.minutes, 150)
})

test('Foundation sections come from the test papers, with the subject defaults filling gaps', () => {
  const defaults = [{ label: 'Mathematics I', questions: 25, marks_each: 2 }, { label: 'EVS', questions: 25, marks_each: 2 }]
  const [a, b] = foundationSeries(
    [{ id: 7, test_no: 1, title: 'Test 01', test_date: '2026-12-07', duration_min: 120, start_time: '10:00:00' }, { id: 8, test_no: 2, test_date: '2026-12-14' }],
    { 7: [{ subject: 'Mathematics I', questions: 30, marks_each: 1 }, { subject: 'EVS' }] }, defaults)
  assert.deepEqual(a.sections, [{ name: 'Mathematics I', q: 30, each: 1 }, { name: 'EVS', q: 25, each: 2 }])
  assert.equal(a.marks, 80); assert.equal(a.tag, 'mf-7')
  assert.equal(b.id, 'Test 02'); assert.equal(b.q, 50)   // no papers yet → every default subject
  const m = examMessage(a)
  assert.equal(m.time, '10:00 · 2 Hours'); assert.equal(m.date, '7 December 2026'); assert.equal(m.secs, 'Mathematics I, 30, 1\nEVS, 25, 2'); assert.equal(m.marks, '80')
})

test('dates, durations and the test to open on', () => {
  assert.equal(longDate('2027-01-31'), '31 January 2027'); assert.equal(longDate(''), '')
  assert.equal(durationText(150), '2 Hours 30 Minutes'); assert.equal(durationText(60), '1 Hour'); assert.equal(durationText(45), '45 Minutes'); assert.equal(durationText(0), '')
  const s = [{ date: '2026-12-01' }, { date: '2026-12-08' }]
  assert.equal(pickTest(s, '2026-12-05'), s[1]); assert.equal(pickTest(s, '2027-01-01'), s[1]); assert.equal(pickTest([], 'x'), null)
})

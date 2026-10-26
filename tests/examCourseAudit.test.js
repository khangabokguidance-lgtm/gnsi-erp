import test from 'node:test'
import assert from 'node:assert/strict'
import { auditStudent, auditStudents, KEY_TRACK } from '../src/examCourseAudit.js'
import { COMBINED_COURSE_BATCH_LABEL as CB } from '../src/examBatchKey.js'

const keys = new Set(Object.keys(KEY_TRACK))
const ids = (s, sec = []) => auditStudent(s, keys, sec).issues

test('a clean Combined student (course Combined, batch "—") has only the section note', () => {
  assert.deepEqual(ids({ course: 'Combined Course', batch: '—' }), ['combined_no_section'])
  assert.deepEqual(ids({ course: 'Combined Course', batch: '—' }, ['Combined Navodaya Course(ENG)']), [])
})

test('Combined with a real batch is flagged: exams will not list them as Combined', () => {
  assert.ok(ids({ course: 'Combined Course', batch: 'Achiever' }).includes('combined_wrong_batch'))
})

test('blank batch on a non-Combined course silently becomes Combined in Exams', () => {
  const r = auditStudent({ course: 'Sainik', batch: '' }, keys)
  assert.equal(r.examKey, CB)
  assert.ok(r.issues.includes('blank_batch_in_combined'))
})

test('no course and no batch is flagged', () => {
  assert.ok(ids({ course: '', batch: '' }).includes('no_course_no_batch'))
})

test('course and batch from different courses conflict', () => {
  assert.ok(ids({ course: 'Sainik', batch: 'Udaan' }).includes('course_batch_conflict'))
  assert.ok(!ids({ course: 'Sainik', batch: 'Achiever' }).includes('course_batch_conflict'))
})

test('a batch missing from Exam setup is flagged', () => {
  const small = new Set(['ACHIEVER'])
  assert.ok(auditStudent({ course: 'Foundation', batch: 'Udaan' }, small).issues.includes('batch_not_in_exam_setup'))
})

test('empty course derived from batch is only an info note', () => {
  assert.deepEqual(ids({ course: '', batch: 'Udaan' }), ['course_blank_derived'])
})

test('summary counts live students, sections and ignores phantom secondary rows', () => {
  const students = [
    { id: 1, course: 'Combined Course', batch: '—' },
    { id: 2, course: 'Combined Course', batch: '—' },
    { id: 3, course: 'Sainik', batch: 'Achiever' },
    { id: 3, course: 'Sainik', batch: 'Achiever', _isSecondaryBatchView: true },
    { id: 4, course: 'Combined Course', batch: '—', status: 'Dropout' },
  ]
  const cs = Object.fromEntries([...keys].map(k => [k, []]))
  const { summary } = auditStudents(students, cs, { 1: ['Combined Navodaya Course(ENG)'], 2: ['Combined Navodaya Course (MM)'] })
  assert.equal(summary.total, 3)
  assert.equal(summary.combined, 2)
  assert.equal(summary.combinedEng, 1)
  assert.equal(summary.combinedMm, 1)
  assert.equal(summary.combinedNoSection, 0)
})

test('a blank-batch student is in the Exam Combined list but is not a declared Combined student', () => {
  const r = auditStudent({ course: 'Sainik', batch: '' }, keys)
  assert.equal(r.examSaysCombined, true)
  assert.equal(r.declaredCombined, false)
  assert.ok(!r.issues.includes('combined_no_section'))
  const cs = Object.fromEntries([...keys].map(k => [k, []]))
  const { summary } = auditStudents([{ id: 1, course: 'Combined Course', batch: '—' }, { id: 2, course: 'Sainik', batch: '' }], cs)
  assert.equal(summary.combined, 1)
  assert.equal(summary.examListCombined, 2)
})

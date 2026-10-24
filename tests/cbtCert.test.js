import test from 'node:test'
import assert from 'node:assert/strict'
import { findStudent, attemptForGcc, certNumber, band, parentPhoneOf } from '../src/lib/cbtCertLogic.js'

const students = [
  { id: 1, name: 'Asha Devi', gcc_no: '0042', father_phone: '+91 98765-43210' },
  { id: 2, name: 'Ashok Singh', gcc_no: 43 },
  { id: 3, name: 'Twin One', gcc_no: 50 }, { id: 4, name: 'twin  one', gcc_no: 51 },
]
const att = (o = {}) => ({ candidate: { name: 'x', roll: 'r' }, ...o })

test('student is found by GCC, then by roll equal to a GCC, then by a unique name', () => {
  assert.equal(findStudent(students, att({ gcc: '42' })).student.id, 1)
  assert.equal(findStudent(students, att({ gcc: '42' })).how, 'gcc')
  assert.equal(findStudent(students, att({ candidate: { name: 'zz', roll: '43' } })).how, 'roll')
  assert.equal(findStudent(students, att({ candidate: { name: 'ASHOK  singh', roll: 'q' } })).student.id, 2)
  assert.equal(findStudent(students, att({ candidate: { name: 'Twin One', roll: 'q' } })).student, null, 'two students with the same name: not guessed')
  assert.equal(findStudent(students, att({ candidate: { name: 'Nobody', roll: 'q' } })).how, null)
})

test('attemptForGcc picks that student\'s best submitted attempt', () => {
  const rows = [
    { submitted: true, g: { marks: 10 }, attempt: att({ gcc: '42' }) },
    { submitted: true, g: { marks: 30 }, attempt: att({ gcc: '42' }) },
    { submitted: false, g: { marks: 99 }, attempt: att({ gcc: '42' }) },
    { submitted: true, g: { marks: 50 }, attempt: att({ gcc: '43' }) },
  ]
  assert.equal(attemptForGcc(rows, students, '0042').g.marks, 30)
  assert.equal(attemptForGcc(rows, students, '50'), null)
})

test('parent phone, certificate number and band', () => {
  assert.equal(parentPhoneOf(students[0]), '9876543210')
  assert.equal(parentPhoneOf(students[1]), '')
  assert.equal(certNumber({ id: 'cbt-abc123xyz' }, students[0], 2026), 'GNSI/CBT/2026/123XYZ-0042')
  assert.equal(band(92).label, 'Outstanding'); assert.equal(band(65).label, 'Very good'); assert.equal(band(10).label, 'Participation'); assert.equal(band(null).label, 'Participation')
})

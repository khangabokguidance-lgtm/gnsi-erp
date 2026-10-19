import test from 'node:test'
import assert from 'node:assert/strict'
import { detectCrossModuleMismatches as run } from '../src/lib/crossModuleChecks.js'
import { detectMismatches } from '../src/mismatchDetector.js'

const student = { id: 1, name: 'Ahanthem Singh', gcc_no: '142', house: 'Tamenglong', hostel_type: 'Boarder', course: 'Navodaya', batch: 'Class 6', class_name: 'Class 6' }
const hostel = { hostel_name: 'Tamenglong', gcc_no: '142', student_name: 'Ahanthem  Singh', class_name: 'class 6', status: 'Active' }
const adm = { applicant_name: 'AHANTHEM SINGH', course: 'navodaya', batch: 'Class 6', hostel_type: 'Boarder', house: 'Tamenglong' }
const keys = fl => fl.map(f => f.key).sort()

test('consistent student / hostel / admission → no flags (case + spacing ignored)', () => {
  assert.deepEqual(run(student, { hostel, admission: adm, fees: {} }), [])
})

test('hostel copy drift is reported', () => {
  const f = run(student, { hostel: { ...hostel, hostel_name: 'Kabui', gcc_no: '143', student_name: 'A Singh', class_name: 'Class 9' }, admission: null, fees: {} })
  assert.deepEqual(keys(f), ['hostel_class_differs', 'hostel_gcc_differs', 'hostel_house_differs', 'hostel_name_differs'])
  assert.equal(f.find(x => x.key === 'hostel_house_differs').level, 'red')
})

test('day scholar with a room, boarder with none', () => {
  assert.deepEqual(keys(run({ ...student, hostel_type: 'Day Scholar', house: 'Dayscholar' }, { hostel, admission: null, fees: {} })), ['dayscholar_has_room'])
  assert.deepEqual(keys(run({ ...student, house: '' }, { hostel: null, admission: null, fees: {} })), ['boarder_no_room'])
})

test('admission drift is reported; blank admission fields are ignored', () => {
  const f = run(student, { hostel, admission: { ...adm, course: 'JEE', hostel_type: 'Day Scholar', house: '' }, fees: {} })
  assert.deepEqual(keys(f), ['adm_course_differs', 'adm_hostel_type_differs'])
  assert.equal(f.find(x => x.key === 'adm_hostel_type_differs').level, 'red')
})

test('hostel fees paid by a day scholar with no room', () => {
  const day = { ...student, hostel_type: 'Day Scholar', house: 'Dayscholar' }
  const fees = { admFlatFees: [{ description: 'Hostel fee Aug' }, { description: 'Tuition' }], admCourseFees: [], admFeeCols: [] }
  assert.deepEqual(keys(run(day, { hostel: null, admission: null, fees })), ['hostel_fee_no_hostel'])
  assert.deepEqual(run(day, { hostel: null, admission: null, fees: { admFlatFees: [{ description: 'Tuition' }] } }), [])
})

test('tolerates missing inputs; wired into detectMismatches', () => {
  assert.deepEqual(run(), [])
  const profile = { attendance: { totalMarked: 5, records: [] }, admission: { ...adm, course: 'JEE' }, fees: { total: 100 }, hostel }
  assert.ok(detectMismatches(student, profile).some(f => f.key === 'adm_course_differs'))
})

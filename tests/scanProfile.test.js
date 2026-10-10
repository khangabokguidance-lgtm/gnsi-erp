// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadScanProfile } from '../src/scanProfile.js'
import { detectMismatches } from '../src/mismatchDetector.js'

// A tiny stand-in for the database client: tables are arrays of rows, and the
// filters used by loadScanProfile (eq / not-null / limit) are applied to them.
function fakeDb(tables, { failTable } = {}) {
  return {
    from(name) {
      const rows = tables[name] || []
      const filters = []
      let max = Infinity
      const q = {
        select() { return q },
        eq(col, val) { filters.push(r => r[col] === val); return q },
        not(col) { filters.push(r => r[col] !== null && r[col] !== undefined); return q },
        limit(n) { max = n; return q },
        then(ok, err) {
          const res = name === failTable ? { data: null, error: { message: 'boom' } }
            : { data: rows.filter(r => filters.every(f => f(r))).slice(0, max), error: null }
          return Promise.resolve(res).then(ok, err)
        },
      }
      return q
    },
  }
}
const keysOf = (student, tables, opts) => loadScanProfile(student, fakeDb(tables, opts)).then(p => detectMismatches(student, p).map(f => f.key).sort())

const student = { id: 's1', name: 'Asha', gcc_no: 101, status: 'Active', house: 'Alpha' }
const healthy = {
  attendance_records: [{ id: 1, student_id: 's1', session_id: 7, status: 'Present' }],
  admissions: [{ id: 1, gcc_no: '101' }],
  adm_fee_collections: [{ adm_app_id: '101', reverted: false, amount_paid: 5000 }],
  hostel_allocations: [{ id: 1, student_id: 's1' }],
}

test('a complete student raises no flags', async () => {
  assert.deepEqual(await keysOf(student, healthy), [])
})

test('missing records raise the matching flags', async () => {
  assert.deepEqual(await keysOf(student, {}), ['active_no_attendance', 'house_no_allocation', 'no_admission_record', 'no_fees_recorded'])
  assert.deepEqual(await keysOf(student, { ...healthy, attendance_records: [] }), ['active_no_attendance'])
  assert.deepEqual(await keysOf(student, { ...healthy, hostel_allocations: [] }), ['house_no_allocation'])
})

test('attendance is found under gcc_no or the name too', async () => {
  const byGcc = { ...healthy, attendance_records: [{ id: 1, gcc_no: '101', session_id: 3, status: 'Absent' }] }
  assert.deepEqual(await keysOf(student, byGcc), [])
  const byName = { ...healthy, attendance_records: [{ id: 1, student_name: 'Asha', session_id: 3, status: 'Absent' }] }
  assert.deepEqual(await keysOf(student, byName), [])
  const hostelOnly = { ...healthy, attendance_records: [{ id: 1, student_id: 's1', session_id: null, status: 'Present' }] }
  assert.deepEqual(await keysOf(student, hostelOnly), ['active_no_attendance'])
})

test('fees: any of the three payment tables counts, reverted payments do not', async () => {
  const noFees = { ...healthy, adm_fee_collections: [] }
  assert.deepEqual(await keysOf(student, noFees), ['no_fees_recorded'])
  assert.deepEqual(await keysOf(student, { ...noFees, adm_fee_collections: [{ adm_app_id: '101', reverted: true, amount_paid: 900 }] }), ['no_fees_recorded'])
  assert.deepEqual(await keysOf(student, { ...noFees, adm_flat_fees: [{ adm_app_id: '101', paid: true, reverted: false, amount: 1200 }] }), [])
  assert.deepEqual(await keysOf(student, { ...noFees, adm_flat_fees: [{ adm_app_id: '101', paid: false, reverted: false, amount: 1200 }] }), ['no_fees_recorded'])
  assert.deepEqual(await keysOf(student, { ...noFees, adm_course_fees: [{ adm_app_id: '101', reverted: false, amount_paid: 800 }] }), [])
})

test('dropout with a Present attendance record is flagged; without one it is not', async () => {
  const dropout = { ...student, status: 'Dropout' }
  assert.deepEqual(await keysOf(dropout, healthy), ['dropout_has_attendance'])
  const absentOnly = { ...healthy, attendance_records: [{ id: 1, student_id: 's1', session_id: 7, status: 'Absent' }] }
  assert.deepEqual(await keysOf(dropout, absentOnly), [])
})

test('house and allocation must agree', async () => {
  const noHouse = { ...student, house: '' }
  assert.deepEqual(await keysOf(noHouse, healthy), ['allocation_no_house'])
  const day = { ...student, house: 'Dayscholar' }
  assert.deepEqual(await keysOf(day, { ...healthy, hostel_allocations: [] }), [])
})

test('a failed query is reported so the scan skips the student', async () => {
  const p = await loadScanProfile(student, fakeDb(healthy, { failTable: 'admissions' }))
  assert.equal(p.failedQueries, 1)
})

test('a healthy student takes only a handful of requests', async () => {
  let calls = 0
  const db = fakeDb(healthy)
  const counting = { from(n) { calls++; return db.from(n) } }
  await loadScanProfile(student, counting)
  assert.ok(calls <= 4, `expected at most 4 requests, got ${calls}`)
})

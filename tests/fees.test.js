// Run with: npm test   (node's built-in test runner — no extra packages)
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSaneAmount, assertSanePayDate, MAX_FEE_AMOUNT } from '../src/lib/feeValidation.js'
import { standingWaiver, planState } from '../src/lib/standingMath.js'

test('amount: rejects zero, negative, NaN, text and huge values', () => {
  for (const bad of [0, -5, NaN, 'abc', Infinity, MAX_FEE_AMOUNT + 1]) assert.throws(() => assertSaneAmount(bad), /greater than 0|limit/)
  assert.equal(assertSaneAmount('5500'), 5500)
  assert.equal(assertSaneAmount(MAX_FEE_AMOUNT), MAX_FEE_AMOUNT)
})

test('date: rejects future, invalid and ancient dates', () => {
  assert.throws(() => assertSanePayDate('2026-13-45', 'd', '2026-10-03'), /not a valid/)
  assert.throws(() => assertSanePayDate('2026-10-04', 'd', '2026-10-03'), /future/)
  assert.throws(() => assertSanePayDate('2010-01-01', 'd', '2026-10-03'), /too far/)
  assert.equal(assertSanePayDate('2026-10-03', 'd', '2026-10-03'), '2026-10-03')
})

const fixed = (v, extra = {}) => ({ status: 'active', basis: 'fixed_per_month', value: v, applies_to: 'course', valid_from: '2026-06-01', valid_to: null, ...extra })

test('standing concession: fixed amount inside the window, capped at the fee', () => {
  assert.equal(standingWaiver([fixed(1000)], 'August', 2026, 'course', 5000), 1000)
  assert.equal(standingWaiver([fixed(9000)], 'August', 2026, 'course', 5000), 5000)
  assert.equal(standingWaiver([fixed(1000)], 'May', 2026, 'course', 5000), 0)          // before valid_from
  assert.equal(standingWaiver([fixed(1000, { valid_to: '2026-07-31' })], 'August', 2026, 'course', 5000), 0)   // after valid_to
})

test('standing concession: head, percent, one-time, status', () => {
  assert.equal(standingWaiver([fixed(1000)], 'February', 2027, 'flat', 47000), 0)       // course-only entry
  assert.equal(standingWaiver([fixed(1000, { applies_to: 'both' })], 'February', 2027, 'flat', 47000), 1000)
  assert.equal(standingWaiver([fixed(10, { basis: 'percent' })], 'August', 2026, 'course', 5000), 500)
  assert.equal(standingWaiver([fixed(2000, { basis: 'one_time' })], 'June', 2026, 'course', 5000), 2000)
  assert.equal(standingWaiver([fixed(2000, { basis: 'one_time' })], 'July', 2026, 'course', 5000), 0)
  assert.equal(standingWaiver([fixed(1000, { status: 'revoked' })], 'August', 2026, 'course', 5000), 0)
  assert.equal(standingWaiver([], 'August', 2026, 'course', 5000), 0)
})

test('instalment plan state', () => {
  const plan = { id: 1, status: 'active', installments: [
    { due_date: '2026-09-01', amount: 1000, paid_amount: 1000 },
    { due_date: '2026-10-01', amount: 1000, paid_amount: 0 },
    { due_date: '2026-11-01', amount: 1000, paid_amount: 0 },
  ] }
  const s = planState(plan, '2026-10-03')
  assert.equal(s.overdue, true); assert.equal(s.nextDue, '2026-10-01'); assert.equal(s.openCount, 2); assert.equal(s.openAmount, 2000)
  assert.equal(planState(plan, '2026-09-15').overdue, false)
  assert.equal(planState({ ...plan, status: 'cancelled' }, '2026-10-03'), null)
  assert.equal(planState({ ...plan, installments: plan.installments.map(i => ({ ...i, paid_amount: i.amount })) }, '2026-10-03'), null)
})

import { admRowKind, balanceRowId, balanceSuffix, isBalanceRowId, instituteNow } from '../src/lib/feeMath.js'

test('admission rows: one rule for dues and ledger', () => {
  assert.equal(admRowKind({ fee_type: 'admission' }), 'admission')
  assert.equal(admRowKind({ fee_type: null, description: 'Admission Fee' }), 'admission')
  assert.equal(admRowKind({ fee_type: 'advance' }), 'advance')
  assert.equal(admRowKind({ fee_type: 'item', description: 'Prospectus' }), 'item')
  assert.equal(admRowKind({ fee_type: null, description: 'Dress Kit — Shirt' }), 'item')   // legacy unknown row is not admission
})

test('balance rows: ids and account refs', () => {
  const id = balanceRowId('12_course_aug_2026', 1)
  assert.equal(id, '12_course_aug_2026_b1')
  assert.ok(isBalanceRowId(id)); assert.ok(!isBalanceRowId('12_course_aug_2026'))
  assert.equal(balanceSuffix(id), '_b1'); assert.equal(balanceSuffix('12_course_aug_2026'), '')
})

test('institute clock reads as IST whatever the device zone', () => {
  const n = instituteNow(new Date('2026-03-31T20:00:00Z'))   // 01:30 IST on 1 April
  assert.equal(n.getMonth(), 3); assert.equal(n.getDate(), 1)
})

import { excludeRepeaterFees, repeaterWaivedTotal } from '../src/lib/feeMath.js'

test('repeater: admission and items excluded, monthly fees kept', () => {
  const items = [{ kind: 'admission', amount: 6000 }, { kind: 'item', amount: 3000 }, { kind: 'flat', amount: 100 }, { kind: 'course', amount: 50 }, { kind: 'advance', amount: 10 }]
  const r = excludeRepeaterFees(true, items)
  assert.deepEqual(r.items.map(i => i.kind), ['flat', 'course', 'advance'])
  assert.equal(repeaterWaivedTotal(items), 9000)
  assert.equal(excludeRepeaterFees(false, items).items.length, 5)
})

import { detectLateEntryStudents } from '../src/lib/lateEntry.js'

test('late entry: joined mid-session, fees start from the joining month', () => {
  const students = [
    { gcc_no: 1, name: 'Early', admission_date: '2026-04-10' },
    { gcc_no: 2, name: 'Late paid', admission_date: '2026-08-12' },
    { gcc_no: 3, name: 'Late none', admission_date: '2026-09-02' },
    { gcc_no: 4, name: 'Last session', admission_date: '2025-08-01' },
    { gcc_no: 5, name: 'Late skipped', admission_date: '2026-06-20' },
  ]
  const course = [
    { adm_app_id: '2', for_month: 'August', year: 2026, amount_paid: 5000, reverted: false },
    { adm_app_id: '5', for_month: 'August', year: 2026, amount_paid: 5000, reverted: false },
    { adm_app_id: '5', for_month: 'June', year: 2026, amount_paid: 5000, reverted: true },
  ]
  const r = detectLateEntryStudents(students, course, [], '2026-2027')
  assert.deepEqual(r.map(x => x.gcc_no), [3, 5, 2])         // not-started first
  const by = Object.fromEntries(r.map(x => [x.gcc_no, x]))
  assert.equal(by[2].firstFeeMonth, 'August 2026'); assert.equal(by[2].started, true); assert.equal(by[2].skippedJoiningMonth, false)
  assert.equal(by[2].monthsNotCharged.length, 4)
  assert.equal(by[3].started, false)
  assert.equal(by[5].skippedJoiningMonth, true)             // joined June, first paid August
})

import { applyPaymentToPlan, removePaymentFromPlan, planDone } from '../src/lib/planPayments.js'
import { refundStatementLines, writtenOffFor } from '../src/lib/refundLedger.js'

const mkPlan = () => [1, 2, 3].map(no => ({ no, due_date: `2026-0${no + 5}-10`, amount: 1000, paid_amount: 0, paid_date: null, receipt_no: null }))

test('plan: payments fill the oldest instalment first, partial and spill-over', () => {
  let r = applyPaymentToPlan(mkPlan(), { ref: 'a', amount: 1500, date: '2026-06-01', receipt: 'R1' })
  assert.equal(r.applied, 1500)
  assert.deepEqual(r.installments.map(i => i.paid_amount), [1000, 500, 0])
  r = applyPaymentToPlan(r.installments, { ref: 'b', amount: 5000, date: '2026-07-01', receipt: 'R2' })
  assert.equal(r.applied, 1500)                       // only 1500 was still owed
  assert.ok(planDone(r.installments))
})

test('plan: the same fee row is never applied twice; revert takes it back', () => {
  const once = applyPaymentToPlan(mkPlan(), { ref: 'a', amount: 800, date: '2026-06-01', receipt: 'R1' })
  const twice = applyPaymentToPlan(once.installments, { ref: 'a', amount: 800, date: '2026-06-01', receipt: 'R1' })
  assert.equal(twice.applied, 0)
  const back = removePaymentFromPlan(twice.installments, 'a')
  assert.equal(back.removed, 800)
  assert.deepEqual(back.installments.map(i => i.paid_amount), [0, 0, 0])
  assert.ok(!planDone(back.installments))
})

test('refunds on the ledger: refund, sibling transfer both ways, write-off, carry-credit ignored', () => {
  const rows = [
    { kind: 'Refund to parent', status: 'paid', gcc: '5', amount: 2000, decided_at: '2026-08-01T10:00:00Z', reason: 'left' },
    { kind: 'Refund to parent', status: 'approved', gcc: '5', amount: 900, decided_at: '2026-08-02T10:00:00Z' },   // not paid yet
    { kind: 'Adjust to sibling GCC', status: 'approved', gcc: '5', target_gcc: '9', amount: 700, decided_at: '2026-08-03T10:00:00Z' },
    { kind: 'Write-off dues', status: 'approved', gcc: '5', amount: 300, decided_at: '2026-09-01T10:00:00Z' },
    { kind: 'Carry credit to next session', status: 'approved', gcc: '5', amount: 100, decided_at: '2026-09-02T10:00:00Z' },
  ]
  const src = refundStatementLines(5, rows)
  assert.deepEqual(src.map(l => [l.debit, l.credit]), [[2000, 0], [700, 0], [0, 300]])
  assert.deepEqual(refundStatementLines('09', rows).map(l => [l.debit, l.credit]), [[0, 700]])
  const sessionOf = d => (d >= '2026-04-01' ? '2026-2027' : '2025-2026')
  assert.equal(writtenOffFor(5, rows, '2026-2027', sessionOf), 300)
  assert.equal(writtenOffFor(5, rows, '2025-2026', sessionOf), 0)
})

import { monthlyCollection, keepRow } from '../src/lib/reportMath.js'

test('monthly collection: by payment date, oldest first, locale-free names', () => {
  const rows = monthlyCollection({
    flat: [{ month: 'February', year: 2027, amount: 47000, pay_date: '2026-12-20' }],       // paid in advance in December
    course: [{ for_month: 'August', year: 2026, amount_paid: 5000, pay_date: '2026-08-05' }, { for_month: 'September', year: 2026, amount_paid: 5000 }],  // no pay_date → fee month
    adm: [{ amount_paid: 6000, pay_date: '2026-08-02' }],
  })
  assert.deepEqual(rows.map(r => r.Month), ['August 2026', 'September 2026', 'December 2026'])
  assert.equal(rows[0]['Course Fee'], 5000); assert.equal(rows[0]['Admission Fee'], 6000); assert.equal(rows[0].Total, 11000)
  assert.equal(rows[2]['Flat Fee'], 47000)
})

test('report filters: scope by student and by payment date', () => {
  const keep = keepRow({ scope: new Set(['5']), from: '2026-08-01', to: '2026-08-31' })
  assert.ok(keep({ adm_app_id: '05', pay_date: '2026-08-10' }))
  assert.ok(!keep({ adm_app_id: '6', pay_date: '2026-08-10' }))     // other student
  assert.ok(!keep({ adm_app_id: '5', pay_date: '2026-09-01' }))     // outside range
  assert.ok(!keep({ adm_app_id: '5' }))                             // no date while a range is set
  assert.ok(keepRow()({ adm_app_id: '9' }))                         // no filters keeps everything
})

import { mergeLiveBatches } from '../src/lib/courseCatalog.js'

test('course batches: new Active batches are added to the standard lists, nothing removed', () => {
  const s = { Sainik: { subtypes: ['Achiever', 'Leader'] }, 'Combined Course': ['—'], Foundation: ['Udaan'] }
  const rows = [
    { course: 'Sainik', subtype: 'Champion', status: 'Active' },
    { course: 'Sainik', subtype: 'Leader', status: 'Active' },            // already there
    { course: 'Sainik', subtype: 'Old batch', status: 'Closed' },          // not active
    { course: 'Combined Course', subtype: 'Combo A', status: 'Active' },   // replaces the placeholder
    { course: 'Mystery', subtype: 'X', status: 'Active' },                 // unknown course is ignored
  ]
  assert.equal(mergeLiveBatches(s, rows), true)
  assert.deepEqual(s.Sainik.subtypes, ['Achiever', 'Leader', 'Champion'])
  assert.deepEqual(s['Combined Course'], ['Combo A'])
  assert.deepEqual(s.Foundation, ['Udaan'])
  assert.equal(mergeLiveBatches(s, rows), false)                          // second run changes nothing
})

import { admissionMonth } from '../src/lib/reportMath.js'

test('month-wise dues: admission counts in the month of the admission date', () => {
  const rangeStart = new Date(2026, 0, 1)   // card starts January 2026
  const w = (admissionDate, extra = {}) => admissionMonth({ admissionDate, sessionStartYear: 2026, rangeStart, ...extra })
  assert.deepEqual(w('2026-01-20'), { year: 2026, month: 0 })      // admitted in January for the coming session: January, not April
  assert.deepEqual(w('2026-02-03'), { year: 2026, month: 1 })
  assert.deepEqual(w('2026-05-12'), { year: 2026, month: 4 })      // a genuine May admission
  assert.deepEqual(w('2025-08-01'), { year: 2026, month: 3 })      // before the card's range → April of the session
  assert.deepEqual(w(null), { year: 2026, month: 3 })              // no date at all → April
  assert.deepEqual(w(null, { firstPaymentDate: '2026-02-10' }), { year: 2026, month: 1 })   // no admission date, but a payment date
})

import { crossModuleChecks } from '../src/lib/crossChecks.js'

test('cross-module checks: each link reports the records that do not line up', () => {
  const helpers = {
    courseOf: s => s.course || 'Unassigned', batchOf: s => s.batch || 'No batch', canonicalBatch: b => b,
    sourceRef: { flatFee: (g, m, y, id) => `flat_${g}_${m}_${y}`, courseFee: (g, m, y, id) => `course_${g}_${m}_${y}`, admission: g => `adm_${g}` },
  }
  const students = [
    { id: 1, gcc_no: 10, name: 'A', course: 'Sainik', batch: 'Achiever', hostel_type: 'Boarder', admission_date: '2026-04-02' },
    { id: 2, gcc_no: 11, name: 'B', course: 'Sainik', batch: 'Leader', hostel_type: 'Day Scholar' },                 // no rate, no admission date
    { id: 3, gcc_no: 12, name: 'C', hostel_type: 'Boarder', admission_date: '2026-04-02' },                         // no course; boarder, no bed
    { id: 4, gcc_no: 13, name: 'D', course: 'Sainik', batch: 'Achiever', hostel_type: 'Boarder', status: 'Left' },  // not active: ignored
  ]
  const r = crossModuleChecks({
    ...helpers, students,
    admissions: [{ id: 'a1', gcc_no: 99, applicant_name: 'Z', status: 'Enrolled' }, { id: 'a2', gcc_no: 10, applicant_name: 'A', status: 'Enrolled' }, { id: 'a3', gcc_no: 98, status: 'Admitted' }],
    feeStructures: [{ course: 'Sainik', batch: 'Achiever', hostel_type: 'Boarder' }],
    allocations: [{ student_id: 1, status: 'Active' }],
    courseRows: [{ id: 'c1', adm_app_id: 10, for_month: 'August', year: 2026, amount_paid: 5000, pay_date: '2026-08-05' },
                 { id: 'c2', adm_app_id: 10, for_month: 'September', year: 2026, amount_paid: 5000, pay_date: '2026-09-05' }],
    accountRefs: new Set(['course_10_August_2026|course_fee']), sessionStart: '2026-04-01',
  })
  const by = Object.fromEntries(r.map(c => [c.key, c.items.map(i => i.id)]))
  assert.deepEqual(by.adm_no_student, ['a1'])          // Enrolled but no student; 'Admitted' is not expected to have one yet
  assert.deepEqual(by.stu_no_course, [3])
  assert.deepEqual(by.stu_no_rate, [2])                // C has no course so it is reported once, under "no course"
  assert.deepEqual(by.stu_no_admdate, [2])
  assert.deepEqual(by.boarder_no_bed, [3])
  assert.deepEqual(by.pay_no_account, ['c2'])
})

import { reconcileIncomeCollection } from '../src/lib/incomeCollection.js'
test('income vs collection: explains each kind of gap by receipt', () => {
  const acc = (id, amt, receipt, extra = {}) => ({ id, type: 'Income', amount: amt, source_type: 'course_fee', entry_date: '2026-10-05', payment_date: '2026-10-05', note: `Oct · ${receipt}`, ...extra })
  const fee = (receipt, amt, date = '2026-10-05') => ({ amount: amt, receipt_no: receipt, pay_date: date, student_name: receipt })
  const r = reconcileIncomeCollection({
    from: '2026-10-01', to: '2026-10-31',
    accounts: [
      acc(1, 1000, 'GNSI-1'),
      acc(2, 500, 'GNSI-2'),                                   // fee says 700 → mismatch
      acc(3, 800, 'GNSI-3', { is_soft_deleted: true }),       // deleted
      acc(4, 900, 'GNSI-4', { status: 'Pending' }),           // awaiting approval
      acc(5, 600, 'GNSI-5', { payment_date: '2026-11-02' }),  // dated outside period
      acc(6, 300, 'GNSI-9'),                                   // orphan
      { id: 7, type: 'Income', amount: 250, source_type: 'store_sale', entry_date: '2026-10-06' },
    ],
    feePayments: [fee('GNSI-1', 1000), fee('GNSI-2', 700), fee('GNSI-3', 800), fee('GNSI-4', 900), fee('GNSI-5', 600), fee('GNSI-6', 400), { amount: 100, pay_date: '2026-10-07' }],
  })
  assert.equal(r.accountsFee, 1800)
  assert.equal(r.split.store, 250)
  assert.equal(r.accountsTotal, 2050)
  assert.equal(r.feeTotal, 4500)
  assert.equal(r.gap, 2700)
  assert.deepEqual([r.missing, r.deleted, r.pending, r.moved, r.mismatch, r.orphan].map(x => x.length), [1, 1, 1, 1, 1, 1])
  assert.equal(r.mismatch[0].diff, -200)
  assert.equal(r.noReceipt.total, 100)
  // The gap is fully explained: missing+deleted+pending+moved+no-receipt − mismatch(diff) − orphan
  const explained = r.totals.missing + r.totals.deleted + r.totals.pending + r.totals.moved + r.noReceipt.total - r.totals.mismatch - r.totals.orphan
  assert.equal(explained, r.gap)
})

import { matchAdmissionsStudents } from '../src/lib/admStudentMatch.js'
test('admissions vs students: one-sided records, duplicates and field differences', () => {
  const r = matchAdmissionsStudents({
    admissions: [
      { gcc_no: '101', applicant_name: 'Asha Devi', status: 'Enrolled', phone: '98620-12345', course: 'NVS', batch: 'A', dob: '2014-03-02' },
      { gcc_no: '102', applicant_name: 'Ravi', status: 'Enrolled' },                       // no student
      { gcc_no: '103', applicant_name: 'Meena', status: 'Applied' },                        // student exists, not Enrolled
      { gcc_no: '104', applicant_name: 'Dup', status: 'Enrolled' }, { gcc_no: '104', applicant_name: 'Dup', status: 'Enrolled' },
    ],
    students: [
      { gcc_no: 101, name: 'asha  devi', status: 'Active', phone: '9862012345', course: 'NVS', batch: 'B', dob: '2014-03-02T00:00:00' },
      { gcc_no: 103, name: 'Meena', status: 'Active' },
      { gcc_no: 104, name: 'Dup', status: 'Dropout' },
      { gcc_no: 105, name: 'Direct add', status: 'Active' },                               // no admission
      { gcc_no: 106, name: 'Gone', status: 'Active', deleted_at: '2026-01-01' },           // ignored
    ],
  })
  assert.deepEqual(r.enrolledNoStudent.map(x => x.gcc), ['102'])
  assert.deepEqual(r.studentNoAdmission.map(x => x.gcc), ['105'])
  assert.deepEqual(r.studentButNotEnrolled.map(x => x.gcc), ['103'])
  assert.deepEqual(r.duplicates.map(x => x.gcc), ['104'])
  assert.deepEqual(r.statusDiff.map(x => x.gcc), ['104'])
  assert.deepEqual(r.fieldDiffs.map(x => `${x.gcc}:${x.field}`), ['101:Batch'])   // name/phone/dob formatting differences are not mismatches
})

import { admissionLinks } from '../src/lib/admStudentMatch.js'
test('admission links: per-GCC state for badges', () => {
  const l = admissionLinks({
    admissions: [{ gcc_no: 1, applicant_name: 'A', status: 'Enrolled', course: 'NVS' }, { gcc_no: 2, status: 'Enrolled' }, { gcc_no: 3, status: 'Applied' }, { gcc_no: 4, status: 'Applied' }],
    students: [{ gcc_no: 1, name: 'A', status: 'Active', course: 'Sainik' }, { gcc_no: 4, name: 'D', status: 'Active' }],
  })
  assert.equal(l.get('1').state, 'diff')
  assert.equal(l.get('1').diffs[0].field, 'Course')
  assert.equal(l.get('2').state, 'noStudent')
  assert.equal(l.has('3'), false)
  assert.equal(l.get('4').state, 'notEnrolled')
})

import { countHouseOccupancy } from '../src/lib/houseOccupancy.js'
test('house occupancy: no double count of enrolled, inactive students take no seat', () => {
  const r = countHouseOccupancy({
    houses: [{ name: 'Loktak', capacity: 3 }, { name: 'Block-B' }],
    students: [
      { gcc_no: 1, house: 'Loktak', status: 'Active' }, { gcc_no: 2, house: 'loktak ', status: 'Active' },
      { gcc_no: 3, house: 'Loktak', status: 'Dropout' }, { gcc_no: 4, house: 'Loktak', status: 'Active', deleted_at: '2026-01-01' },
    ],
    admissions: [
      { gcc_no: 1, house: 'Loktak', status: 'Enrolled' },   // has a student row already
      { gcc_no: 5, house: 'Loktak', status: 'Admitted' },   // waiting seat
      { gcc_no: 6, house: 'Loktak', status: 'Applied' }, { gcc_no: 7, house: 'Loktak', status: 'Rejected' },
    ],
  })
  assert.equal(r[0].occupied, 3); assert.equal(r[0].studentCount, 2); assert.equal(r[0].applicantCount, 1)
  assert.equal(r[0].isFull, true); assert.equal(r[1].capacity, 40)
  assert.equal(countHouseOccupancy({ houses: [{ name: 'Loktak', capacity: 3 }], students: [], admissions: [{ gcc_no: 5, house: 'Loktak', status: 'Admitted' }], excludeGcc: '5' })[0].occupied, 0)
})

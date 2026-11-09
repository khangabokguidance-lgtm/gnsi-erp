import test from 'node:test'
import assert from 'node:assert/strict'
import { courseOnMonth, courseTimeline, otherCoursesInSession, validateCourseChange, planHostelRange, consecutiveRuns, monthEnd, nextMonthStart, yearOfSessionMonth } from '../src/lib/courseHistory.js'

const st = { name: 'A', course: 'Sainik', batch: 'Class 9' }
const ch = (from, to, eff, fb = '', tb = '') => ({ from_course: from, to_course: to, from_batch: fb, to_batch: tb, effective_from: eff })

test('no changes: the student is in their current course all year', () => {
  assert.deepEqual(courseOnMonth(st, [], 'October', 2026), { course: 'Sainik', batch: 'Class 9', current: true })
})

test('months before a change keep the old course; from the effective month the new (current) one', () => {
  const changes = [ch('Navodaya', 'Sainik', '2026-10-01', 'Class 6', 'Class 9')]
  assert.deepEqual(courseOnMonth(st, changes, 'September', 2026), { course: 'Navodaya', batch: 'Class 6', current: false })
  assert.equal(courseOnMonth(st, changes, 'October', 2026).current, true)
  assert.equal(courseOnMonth(st, changes, 'January', 2027).course, 'Sainik')
})

test('two changes give three segments', () => {
  const changes = [ch('Navodaya', 'Udaan', '2026-07-01'), ch('Udaan', 'Sainik', '2026-11-01')]
  assert.equal(courseOnMonth(st, changes, 'May', 2026).course, 'Navodaya')
  assert.equal(courseOnMonth(st, changes, 'August', 2026).course, 'Udaan')
  assert.equal(courseOnMonth(st, changes, 'December', 2026).course, 'Sainik')
  assert.deepEqual(courseTimeline(st, changes).map(s => s.course), ['Navodaya', 'Udaan', 'Sainik'])
  assert.deepEqual(otherCoursesInSession(st, changes, 2026).map(o => o.course).sort(), ['Navodaya', 'Udaan'])
})

test('validation', () => {
  assert.match(validateCourseChange({ student: st, toCourse: '', effectiveFrom: '2026-10-01' }), /new course/)
  assert.match(validateCourseChange({ student: st, toCourse: 'Sainik', toBatch: 'Class 9', effectiveFrom: '2026-10-01' }), /already/)
  assert.match(validateCourseChange({ student: st, toCourse: 'Navodaya', effectiveFrom: '2026-10-15' }), /month/)
  assert.match(validateCourseChange({ student: st, toCourse: 'Navodaya', effectiveFrom: '2026-08-01', changes: [ch('A', 'B', '2026-09-01')] }), /can't start before/)
  assert.equal(validateCourseChange({ student: st, toCourse: 'Navodaya', effectiveFrom: '2026-10-01' }), '')
})

test('hostel type: onward, or temporary for a range of months', () => {
  assert.deepEqual(planHostelRange({ currentType: 'Boarder', toType: 'Day Scholar', from: '2026-10-01' }).steps, [{ toType: 'Day Scholar', effectiveFrom: '2026-10-01' }])
  // Oct–Dec as Day Scholar, then back to Boarder from January
  assert.deepEqual(planHostelRange({ currentType: 'Boarder', toType: 'Day Scholar', from: '2026-10-01', until: '2026-12-01' }).steps,
    [{ toType: 'Day Scholar', effectiveFrom: '2026-10-01' }, { toType: 'Boarder', effectiveFrom: '2027-01-01' }])
  assert.match(planHostelRange({ currentType: 'Boarder', toType: 'Boarder', from: '2026-10-01' }).error, /already/)
  assert.match(planHostelRange({ currentType: 'Boarder', toType: 'Day Scholar', from: '2026-10-01', until: '2026-09-01' }).error, /before/)
})

test('month helpers', () => {
  assert.equal(monthEnd('February', 2027), '2027-02-28')
  assert.equal(monthEnd('December', 2026), '2026-12-31')
  assert.equal(nextMonthStart('2026-12-01'), '2027-01-01')
  assert.equal(yearOfSessionMonth('March', 2026), 2027)
  assert.equal(yearOfSessionMonth('April', 2026), 2026)
  assert.deepEqual(consecutiveRuns(['2026-10', '2026-11', '2026-12', '2027-02', '2026-10']), [{ from: '2026-10-01', to: '2026-12-01' }, { from: '2027-02-01', to: '2027-02-01' }])
  assert.deepEqual(consecutiveRuns(['2026-12', '2027-01']), [{ from: '2026-12-01', to: '2027-01-01' }])
})

import { planDiscount, planWaiver, reasonText, discountOf, monthKey } from '../src/lib/adjustPlan.js'
const stu = { gcc_no: '1042', name: 'Rohan' }

test('discount: one register row per run of consecutive months', () => {
  const p = planDiscount({ student: stu, monthKeys: ['2026-10', '2026-11', '2027-01'], basis: 'percent', value: 25, kind: 'Fee adjustment', by: 'Admin' })
  assert.equal(p.rows.length, 2)
  assert.deepEqual([p.rows[0].valid_from, p.rows[0].valid_to], ['2026-10-01', '2026-11-30'])
  assert.deepEqual([p.rows[1].valid_from, p.rows[1].valid_to], ['2027-01-01', '2027-01-31'])
  assert.equal(p.rows[0].basis, 'percent'); assert.equal(p.rows[0].value, 25); assert.equal(p.rows[0].applies_to, 'both')
})

test('discount: validation', () => {
  assert.match(planDiscount({ student: stu, monthKeys: [], basis: 'percent', value: 10, kind: 'Repeater' }).error, /month/)
  assert.match(planDiscount({ student: stu, monthKeys: ['2026-10'], basis: 'percent', value: 120, kind: 'Repeater' }).error, /100/)
  assert.match(planDiscount({ student: stu, monthKeys: ['2026-10'], basis: 'fixed_per_month', value: 0, kind: 'Repeater' }).error, /discount/)
  assert.match(planDiscount({ student: stu, monthKeys: ['2026-10'], basis: 'percent', value: 10 }).error, /reason/)
})

test('staff ward needs the staff name and keeps it in the reason', () => {
  assert.match(reasonText({ kind: 'Staff ward' }).error, /name of the staff/)
  assert.equal(reasonText({ kind: 'Staff ward', staffName: ' Mr Singh ', note: 'wife of teacher' }).reason, 'Staff ward: Mr Singh — wife of teacher')
  assert.equal(reasonText({ kind: 'Financial hardship' }).reason, 'Financial hardship')
})

test('waiver: one one-time entry per month for the amount due', () => {
  const p = planWaiver({ student: stu, items: [{ key: '2026-10', amount: 3000 }, { key: '2026-11', amount: 0 }, { key: '2026-12', amount: 1500.456 }], by: 'Admin' })
  assert.equal(p.rows.length, 2)
  assert.deepEqual(p.rows.map(r => [r.basis, r.value, r.valid_from, r.valid_to, r.kind]), [['one_time', 3000, '2026-10-01', '2026-10-31', 'Financial hardship'], ['one_time', 1500.46, '2026-12-01', '2026-12-31', 'Financial hardship']])
  assert.match(planWaiver({ student: stu, items: [{ key: '2026-10', amount: 0 }] }).error, /due/)
})

test('discount preview mirrors the register math', () => {
  assert.equal(discountOf(4000, 'percent', 25), 1000)
  assert.equal(discountOf(4000, 'fixed_per_month', 5000), 4000)
  assert.equal(monthKey('March', 2027), '2027-03')
})

import { checkMonthlyFees } from '../src/lib/monthlyFeeCheck.js'

test('monthly check prices a pre-change month at the OLD course, not the current one', () => {
  const student = { gcc_no: '1', name: 'A', status: 'Active', course: 'Sainik', batch: 'B9', hostel_type: 'Day Scholar' }
  // Navodaya 3000 / Sainik 5000. The September payment of 3000 was right for Navodaya.
  const rateOf = ({ course }) => (course === 'Navodaya' ? 3000 : 5000)
  const courseRows = [{ id: 1, adm_app_id: '1', for_month: 'September', year: 2026, amount_paid: 3000, hostel_type: 'Day Scholar', course: 'Navodaya', pay_date: '2026-09-10' }]
  const changes = [{ from_course: 'Navodaya', to_course: 'Sainik', from_batch: 'B6', to_batch: 'B9', effective_from: '2026-10-01' }]
  const courseAt = (st, month, year) => courseOnMonth(st, changes, month, year)
  const without = checkMonthlyFees({ students: [student], courseRows, flatRows: [], rateOf })
  const withHist = checkMonthlyFees({ students: [student], courseRows, flatRows: [], rateOf, courseAt })
  const verdict = r => (r.students?.[0]?.months || r.rows?.[0]?.months || JSON.stringify(r)).toString()
  assert.ok(JSON.stringify(without).includes('"short"') || JSON.stringify(without).includes('differs'), 'without history it looks wrong')
  assert.ok(JSON.stringify(withHist).includes('"ok"'), 'with history it is right: ' + verdict(withHist))
})

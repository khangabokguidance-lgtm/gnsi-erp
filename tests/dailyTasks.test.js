import test from 'node:test'
import assert from 'node:assert/strict'
import { dateKey, shiftDate, dayLabel, cleanUrl, buildTask, buildMaterial, groupByCourse, progress, carryOver, dropDuplicates, sameOwner } from '../src/lib/dailyTaskLogic.js'

test('dates shift across month and year', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28')
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(dayLabel('2026-11-02', '2026-11-02'), 'Today')
  assert.equal(dayLabel('2026-11-03', '2026-11-02'), 'Tomorrow')
  assert.equal(dayLabel('2026-11-01', '2026-11-02'), 'Yesterday')
})
test('links are cleaned and unsafe schemes rejected', () => {
  assert.equal(cleanUrl('drive.google.com/x'), 'https://drive.google.com/x')
  assert.equal(cleanUrl('javascript:alert(1)'), '')
  assert.equal(cleanUrl('  '), '')
})
test('task and material validation', () => {
  assert.equal(buildTask({ title: ' ', course: 'Sainik' }, 'A', '2026-11-02').ok, false)
  assert.equal(buildTask({ title: 'Teach', course: 'Combined Course' }, 'A', 'd').ok, false)
  const t = buildTask({ title: ' Teach Ch 4 ', course: 'Navodaya', batch: 'Umeed', subject: 'Maths' }, 'A', '2026-11-02')
  assert.equal(t.row.title, 'Teach Ch 4'); assert.equal(t.row.done, false)
  assert.equal(buildMaterial({ title: 'x', course: 'Sainik', kind: 'link', url: '' }, 'A', 'd').ok, false)
  assert.equal(buildMaterial({ title: 'x', course: 'Sainik', kind: 'note', body: '' }, 'A', 'd').ok, false)
  assert.equal(buildMaterial({ title: 'x', course: 'Sainik', kind: 'file' }, 'A', 'd').ok, false)
  assert.equal(buildMaterial({ title: 'x', course: 'Sainik', kind: 'link', url: 'a.com' }, 'A', 'd').row.url, 'https://a.com')
})
test('grouping, progress, carry over', () => {
  const tasks = [{ course: 'Sainik', done: true, title: 'a' }, { course: 'Sainik', done: false, title: 'b', owner_name: 'A', batch: '', subject: '', notes: '' }, { course: 'Foundation', done: false, title: 'c', owner_name: 'A', batch: '', subject: '', notes: '' }]
  const g = groupByCourse(tasks, [{ course: 'Navodaya' }])
  assert.deepEqual(g.map(x => x.course), ['Navodaya', 'Sainik', 'Foundation'])
  assert.equal(groupByCourse(tasks, [], 'Sainik').length, 1)
  assert.deepEqual(progress(tasks), { total: 3, done: 1, pct: 33 })
  assert.deepEqual(progress([]), { total: 0, done: 0, pct: 0 })
  const c = carryOver(tasks, '2026-11-03')
  assert.equal(c.length, 2); assert.ok(c.every(r => r.task_date === '2026-11-03' && !r.done))
  assert.equal(dropDuplicates(c, [{ course: 'Sainik', batch: '', subject: '', title: 'B' }]).length, 1)
})
test('owner match ignores case/space', () => assert.ok(sameOwner({ owner_name: ' Anil ' }, 'anil')))

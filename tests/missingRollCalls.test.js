// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { findMissingRollCalls } from '../src/missingRollCalls.js'

const norm = h => String(h || '').trim().toLowerCase()
const days = ['2026-10-12', '2026-10-11', '2026-10-10']
const students = [
  { id: 1, house: 'Kombirei' }, { id: 2, house: 'Kombirei' }, { id: 3, house: 'Kombirei' },
  { id: 4, house: 'Alpha' }, { id: 5, house: 'Alpha' },
  { id: 6, house: 'Day Scholar' },
]
const all = (date, session, ids) => ids.map(id => ({ student_id: id, house: id <= 3 ? 'Kombirei' : 'Alpha', date, session }))
const closedAll = () => true
const run = (rows, isClosed = closedAll, sts = students) => findMissingRollCalls({ rows, students: sts, days, isClosed, normalizeHouse: norm })

test('a complete day raises nothing', () => {
  const rows = days.flatMap(d => ['morning', 'night'].flatMap(s => all(d, s, [1, 2, 3, 4, 5])))
  assert.deepEqual(run(rows), [])
})

test('an incomplete roll call is reported with its counts, and day scholars are ignored', () => {
  const rows = days.flatMap(d => ['morning', 'night'].flatMap(s => all(d, s, [1, 2, 3, 4, 5])))
    .filter(r => !(r.date === '2026-10-11' && r.session === 'night' && r.student_id === 2))
  const out = run(rows)
  assert.equal(out.length, 1)
  assert.deepEqual(out[0], { house: 'Kombirei', date: '2026-10-11', session: 'night', marked: 2, total: 3, today: false, yesterday: true })
})

test('a past day nobody marked is a holiday, not a miss', () => {
  const rows = ['morning', 'night'].flatMap(s => all('2026-10-12', s, [1, 2, 3, 4, 5]))
  assert.deepEqual(run(rows), [])
})

test("today's roll call is a miss once its window has closed, even if nobody marked it", () => {
  const closedMorningOnly = (d, s) => s === 'morning'
  // Three days, nobody marked anything: the past days read as holidays, today does not.
  const out = run([], closedMorningOnly)
  assert.deepEqual(out.map(m => `${m.house}|${m.date}|${m.session}|${m.marked}/${m.total}`).sort(),
    ['Alpha|2026-10-12|morning|0/2', 'Kombirei|2026-10-12|morning|0/3'])
})

test('a roll call whose window is still open is not reported', () => {
  const openToday = (d) => d !== days[0]
  const rows = days.slice(1).flatMap(d => ['morning', 'night'].flatMap(s => all(d, s, [1, 2, 3, 4, 5])))
  assert.deepEqual(run(rows, openToday), [])
})

test('only the houses in scope are reported', () => {
  const rows = days.flatMap(d => ['morning', 'night'].flatMap(s => all(d, s, [4, 5])))
  const out = run(rows, closedAll, students.filter(s => s.house === 'Kombirei'))
  assert.ok(out.length > 0 && out.every(m => m.house === 'Kombirei'))
})

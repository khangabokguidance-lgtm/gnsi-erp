import test from 'node:test'
import assert from 'node:assert/strict'
import { sainikRow, sainikRoster, filterRoster, rosterCounts } from '../src/lib/missionSainikStudents.js'

const stu = (name, course, batch, extra = {}) => ({ id: name, name, course, batch, gcc_no: 'G-' + name, phone: '9' + name.length, ...extra })
const ALL = [
  stu('Asha', 'Sainik', 'Achiever'), stu('Bimol', 'Sainik', 'Leader'), stu('Chaoba', 'Sainik', 'Champion'),
  stu('Deepa', 'Combined Course', 'Combined Navodaya Course(ENG)'), stu('Eben', 'Combined Course', 'Combined (MM)'),
  stu('Farid', 'Navodaya', 'Lakshya A'), stu('Gita', 'Foundation', 'Udaan'),
]

test('only Sainik and Combined Course students are listed, sorted by name', () => {
  const r = sainikRoster(ALL)
  assert.deepEqual(r.map(x => x.name), ['Asha', 'Bimol', 'Chaoba', 'Deepa', 'Eben'])
  assert.equal(sainikRow(ALL[5]), null); assert.equal(sainikRow(ALL[6]), null)
  assert.deepEqual([sainikRow(ALL[0]).group, sainikRow(ALL[3]).group], ['sainik', 'combined'])
  assert.equal(sainikRow({ id: 1, name: 'Photo', course: 'Sainik', batch: 'Leader', photo_url: 'https://x/p.jpg' }).photo, 'https://x/p.jpg')
})

test('views and batch chips filter the list; search matches name, GCC, phone and batch', () => {
  const r = sainikRoster(ALL)
  assert.deepEqual(filterRoster(r, { view: 'sainik' }).map(x => x.name), ['Asha', 'Bimol', 'Chaoba'])
  assert.deepEqual(filterRoster(r, { view: 'combined' }).map(x => x.name), ['Deepa', 'Eben'])
  assert.equal(filterRoster(r, { view: 'all' }).length, 5)
  assert.deepEqual(filterRoster(r, { batchKey: 'leader' }).map(x => x.name), ['Bimol'])
  assert.deepEqual(filterRoster(r, { q: 'g-chaoba' }).map(x => x.name), ['Chaoba'])
  assert.deepEqual(filterRoster(r, { q: 'achiever' }).map(x => x.name), ['Asha'])
  assert.deepEqual(filterRoster(r, { view: 'sainik', q: 'deepa' }), [])
})

test('counts per view and per batch, Sainik batches first', () => {
  const c = rosterCounts(sainikRoster(ALL), 'all')
  assert.deepEqual([c.all, c.sainik, c.combined], [5, 3, 2])
  assert.equal(c.batches[0].group, 'sainik'); assert.equal(c.batches.reduce((n, b) => n + b.n, 0), 5)
  assert.equal(rosterCounts(sainikRoster(ALL), 'combined').batches.reduce((n, b) => n + b.n, 0), 2)
})

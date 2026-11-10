import test from 'node:test'
import assert from 'node:assert/strict'
import { shortName, makeTop5Snapshot, trendOf } from '../src/lib/cbtTop5.js'

const e = (name, classKey, classLabel, marks, o = {}) => ({ name, classKey, classLabel, marks, max: 100, percent: marks, submitted: o.submitted !== false, took: o.took ?? 30, flags: o.flags || 0 })
const entries = [
  e('Moirangthem Himan Singh', 'lakshya-a', 'Lakshya A', 95), e('Anil Kumar', 'lakshya-a', 'Lakshya A', 90), e('Bina Devi', 'lakshya-b', 'Lakshya B', 92),
  e('Chaoba', 'umeed', 'Umeed', 88), e('Dolly Chanu', 'combined-mm', 'Combined · Manipuri', 91), e('Ema Singh', 'combined-eng', 'Combined · English', 85),
  e('Fem Devi', 'lakshya-a', 'Lakshya A', 80), e('Gita Singh', 'lakshya-a', 'Lakshya A', 70), e('Guest Kid', 'guest', 'Guest / not in ERP', 99),
  e('Cheat Case', 'lakshya-b', 'Lakshya B', 97, { flags: 3 }), e('Still Writing', 'umeed', 'Umeed', 60, { submitted: false }),
]
test('names are shortened for the public by default', () => {
  assert.equal(shortName('Moirangthem Himan Singh'), 'Moirangthem S.'); assert.equal(shortName('Chaoba'), 'Chaoba'); assert.equal(shortName('  '), ''); assert.equal(shortName(null), '')
})
test('the snapshot holds only the top 5, never the whole list', () => {
  const s = makeTop5Snapshot({ entries, now: new Date('2026-11-10T10:00:00Z') })
  assert.equal(s.overall.length, 5); assert.deepEqual(s.overall.map(x => x.rank), [1, 2, 3, 4, 5])
  assert.deepEqual(s.overall.map(x => x.name), ['Guest K.', 'Moirangthem S.', 'Bina D.', 'Dolly C.', 'Anil K.'])
  const overallJson = JSON.stringify(s.overall)
  for (const hidden of ['Gita', 'Ema', 'Still Writing', 'Chaoba', 'Fem']) assert.ok(!overallJson.includes(hidden), `${hidden} (rank 6 or lower, or unfinished) is not in the overall board`)
  assert.ok(!JSON.stringify(s).includes('Still Writing'), 'an unfinished attempt is never published')
  assert.ok(!('gcc' in s.overall[0]) && !('parentPhone' in s.overall[0]), 'no GCC no. or phone is ever published')
})
test('flagged candidates are left out by default, and an admin can include them', () => {
  assert.ok(!makeTop5Snapshot({ entries }).overall.some(x => x.name.startsWith('Cheat')))
  assert.ok(makeTop5Snapshot({ entries, skipFlagged: false }).overall.some(x => x.name.startsWith('Cheat')))
})
test('per class: the top of each class in the school order, guests and unclassified not listed as classes', () => {
  const s = makeTop5Snapshot({ entries })
  assert.deepEqual(s.byClass.map(c => c.label), ['Lakshya A', 'Lakshya B', 'Umeed', 'Combined · Manipuri', 'Combined · English'])
  assert.deepEqual(s.byClass[0].list.map(x => x.name), ['Moirangthem S.', 'Anil K.', 'Fem D.', 'Gita S.'])
  assert.equal(s.byClass[0].list[0].rank, 1); assert.equal(s.byClass[1].list[0].name, 'Bina D.')
  assert.equal(makeTop5Snapshot({ entries, byClass: false }).byClass.length, 0)
})
test('full names only when the admin asks; ties share a rank; totals for the trend', () => {
  assert.equal(makeTop5Snapshot({ entries, nameStyle: 'full' }).overall[1].name, 'Moirangthem Himan Singh')
  const tie = makeTop5Snapshot({ entries: [e('A One', 'umeed', 'Umeed', 90), e('B Two', 'umeed', 'Umeed', 90), e('C Three', 'umeed', 'Umeed', 80)] })
  assert.deepEqual(tie.overall.map(x => x.rank), [1, 1, 3])
  const s = makeTop5Snapshot({ entries })
  assert.equal(s.stats.appeared, 10); assert.equal(s.stats.topPercent, 99); assert.equal(s.stats.max, 100)
})
test('trend: oldest to newest, last 8, and which way the top score moved', () => {
  const item = (id, at, top, avg) => ({ id, name: id, publishedAt: at, top5: { publishedAt: at, stats: { topPercent: top, avgPercent: avg, appeared: 30 } } })
  const t = trendOf([item('m3', '2026-11-10T00:00:00Z', 92, 55), item('m2', '2026-11-03T00:00:00Z', 88, 50), item('m1', '2026-10-27T00:00:00Z', 85, 48), { id: 'bad' }, null])
  assert.deepEqual(t.points.map(p => p.id), ['m1', 'm2', 'm3']); assert.equal(t.direction, 'up'); assert.equal(t.change, 4)
  assert.equal(trendOf([item('a', '2026-11-03T00:00:00Z', 90, 50), item('b', '2026-11-10T00:00:00Z', 90, 50)]).direction, 'flat')
  assert.equal(trendOf([]).direction, null); assert.equal(trendOf(undefined).points.length, 0)
  assert.equal(trendOf(Array.from({ length: 12 }, (_, i) => item('t' + i, new Date(2026, 0, i + 1).toISOString(), 50 + i, 40))).points.length, 8)
})

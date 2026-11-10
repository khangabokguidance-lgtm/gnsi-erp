import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyStudent, mediumOf, CLASS_DEFS, classDef } from '../src/lib/studentClass.js'

const k = (s, tags) => classifyStudent(s, tags).key
test('Navodaya batches: Lakshya A, Lakshya B, Umeed in any spelling', () => {
  assert.equal(k({ batch: 'Lakshya A' }), 'lakshya-a')
  assert.equal(k({ batch: 'LAKSHYA - B' }), 'lakshya-b')
  assert.equal(k({ batch: 'umeed', course: 'Navodaya' }), 'umeed')
  assert.equal(k({ batch: 'Lakshya' }), 'lakshya', 'the older unsplit record is shown as its own group, not guessed')
})
test('Combined Course: the medium comes from the secondary batch (or ENG/MM text), otherwise it is "not set"', () => {
  assert.equal(k({ course: 'Combined Course', batch: '—' }, ['Combined Navodaya Course(ENG)']), 'combined-eng')
  assert.equal(k({ course: 'Combined Course', batch: '—' }, ['Combined Navodaya Course (MM)']), 'combined-mm')
  assert.equal(k({ course: 'Combined Course', batch: '' }, []), 'combined')
  assert.equal(k({ course: 'Combined Course', batch: '', class_name: 'MM' }), 'combined-mm')
  assert.equal(k({ course: 'Combined Course', batch: '', class_name: 'English' }), 'combined-eng')
  assert.equal(k({ batch: '', course: '' }, ['Combined Navodaya Course(MM)']), 'combined-mm', 'a secondary Combined tag is enough')
  assert.equal(classifyStudent({ course: 'Combined Course', batch: '—' }, ['Combined Navodaya Course(ENG)']).course, 'Combined Course')
})
test('other courses, a batch left in class_name, nobody in the ERP, and unknowns', () => {
  assert.equal(k({ batch: 'Achiever' }), 'achiever'); assert.equal(k({ batch: 'Leader' }), 'leader'); assert.equal(k({ batch: 'Champion' }), 'champion')
  assert.equal(k({ batch: 'Elite' }), 'udaan', 'renamed batches resolve'); assert.equal(k({ batch: 'Prime' }), 'pragati')
  assert.equal(k({ batch: '', class_name: 'Udaan' }), 'udaan')
  assert.equal(k(null), 'guest'); assert.equal(k({ batch: 'something else', course: '' }), 'unclassified')
})
test('a real batch beats a Combined tag only when the course is not Combined', () => {
  assert.equal(k({ batch: 'Lakshya A', course: 'Navodaya' }, ['Combined Navodaya Course(ENG)']), 'lakshya-a')
})
test('medium detection and definitions', () => {
  assert.equal(mediumOf('Combined Navodaya Course(ENG)'), 'eng'); assert.equal(mediumOf('', 'Manipuri medium'), 'mm'); assert.equal(mediumOf('9A'), '')
  assert.ok(CLASS_DEFS.every(d => d.key && d.label)); assert.equal(classDef('nope').key, 'unclassified'); assert.equal(classDef('umeed').course, 'Navodaya')
})

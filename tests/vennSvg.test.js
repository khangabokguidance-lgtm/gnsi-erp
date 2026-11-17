import test from 'node:test'
import assert from 'node:assert/strict'
import { vennSvg, vennPresetSvg, VENN_PRESETS } from '../src/lib/vennSvg.js'

test('two-set diagram has two circles and the labels and values', () => {
  const s = vennSvg({ sets: 2, labels: ['Doctors', 'Men'], v: { a: '5', ab: '3', b: '8', out: '2' } })
  assert.equal((s.match(/<circle/g) || []).length, 2)
  for (const t of ['Doctors', 'Men', '>5<', '>3<', '>8<', '>2<']) assert.ok(s.includes(t), t)
  assert.ok(s.startsWith('<svg'))
})

test('three-set diagram has three circles and the centre value', () => {
  const s = vennSvg({ sets: 3, labels: ['A', 'B', 'C'], v: { abc: '1' } })
  assert.equal((s.match(/<circle/g) || []).length, 3)
  assert.ok(s.includes('>1<'))
})

test('labels are escaped', () => {
  const s = vennSvg({ sets: 2, labels: ['<script>x</script>', 'B'] })
  assert.ok(!s.includes('<script>'))
  assert.ok(s.includes('&lt;script&gt;'))
})

test('empty values draw no text for that region', () => {
  const s = vennSvg({ sets: 2, labels: [], v: {} })
  assert.ok(!s.includes('<text'))
})

test('every preset draws, with the right number of circles', () => {
  for (const p of VENN_PRESETS) assert.equal((vennPresetSvg(p.id).match(/<circle/g) || []).length, p.circles.length, p.id)
  assert.ok(vennPresetSvg('nope').includes('<circle'))
  assert.equal(new Set(VENN_PRESETS.map(p => p.id)).size, VENN_PRESETS.length)
})

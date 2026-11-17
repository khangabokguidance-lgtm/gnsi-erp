import test from 'node:test'
import assert from 'node:assert/strict'
import { autoLevels, otsu, blackAndWhite, trimBox } from '../src/lib/scanImage.js'

const make = (w, h, fn) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y), i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255 } return { data, width: w, height: h } }
const px = (img, x, y) => img.data[(y * img.width + x) * 4]

test('auto-levels makes grey paper white and keeps ink dark', () => {
  const img = make(20, 20, (x, y) => (x < 4 ? 60 : 190))     // dull photo: ink 60, paper 190
  autoLevels(img)
  assert.ok(px(img, 15, 5) > 245)
  assert.ok(px(img, 1, 5) < 10)
})

test('auto-levels leaves a flat image alone', () => {
  const img = make(10, 10, () => 128)
  autoLevels(img)
  assert.equal(px(img, 3, 3), 128)
})

test('otsu finds a threshold between ink and paper', () => {
  const img = make(20, 20, (x) => (x < 10 ? 30 : 220))
  const t = otsu(img)
  assert.ok(t >= 30 && t < 220)
})

test('black and white output has only two values', () => {
  const img = make(20, 20, (x, y) => (x + y) * 6)
  blackAndWhite(img)
  const vals = new Set(); for (let i = 0; i < img.data.length; i += 4) vals.add(img.data[i])
  assert.ok([...vals].every(v => v === 0 || v === 255))
})

test('trim box wraps the drawing with padding', () => {
  const img = make(100, 80, (x, y) => (x >= 30 && x < 50 && y >= 20 && y < 40 ? 0 : 255))
  assert.deepEqual(trimBox(img, { pad: 5 }), { x: 25, y: 15, w: 30, h: 30 })
})

test('trim box is null on a blank page and clamps at the edges', () => {
  assert.equal(trimBox(make(10, 10, () => 255)), null)
  const edge = make(10, 10, (x, y) => (x === 0 && y === 0 ? 0 : 255))
  assert.deepEqual(trimBox(edge, { pad: 3 }), { x: 0, y: 0, w: 4, h: 4 })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { inkCounts, findDivider, findCaptionCut, optionColumns, inkBox, planSplit, findOptionRuns } from '../src/lib/stripSplit.js'

// Draw a synthetic strip: question box on the left, a divider, four option boxes, caption text rows underneath.
function strip({ w = 1000, h = 250, div = 200, captions = true } = {}) {
  const lum = new Uint8Array(w * h).fill(255)
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lum[y * w + x] = 0 }
  rect(div, 0, div + 2, h)                                   // divider line, full height
  rect(40, 30, 150, 140)                                     // question figure
  const colW = (w - div - 3) / 4
  for (let i = 0; i < 4; i++) {
    const x = Math.round(div + 3 + colW * i + 30)
    rect(x, 30, x + 90, 140)                                 // option figure
    if (captions) rect(x + 35, 200, x + 55, 214)             // "(A)" caption band
  }
  return { lum, w, h }
}

test('finds the divider line', () => {
  const { lum, w, h } = strip()
  const { colInk } = inkCounts(lum, w, h)
  const d = findDivider(colInk, h)
  assert.ok(d >= 199 && d <= 202, 'divider at ' + d)
})

test('no divider when the picture has none', () => {
  const w = 400, h = 100, lum = new Uint8Array(w * h).fill(255)
  for (let y = 20; y < 60; y++) for (let x = 100; x < 140; x++) lum[y * w + x] = 0
  assert.equal(findDivider(inkCounts(lum, w, h).colInk, h), null)
})

test('finds where the printed captions start', () => {
  const { lum, w, h } = strip()
  const rows = new Array(h).fill(0)
  for (let y = 0; y < h; y++) for (let x = 205; x < w; x++) if (lum[y * w + x] < 150) rows[y]++
  const cut = findCaptionCut(rows)
  assert.ok(cut >= 140 && cut <= 200, 'cut at ' + cut)
})

test('keeps the whole height when there are no captions', () => {
  const { lum, w, h } = strip({ captions: false })
  const rows = new Array(h).fill(0)
  for (let y = 0; y < h; y++) for (let x = 205; x < w; x++) if (lum[y * w + x] < 150) rows[y]++
  // figures end at 140 followed by blank rows: that trailing blank is not a caption band
  assert.equal(findCaptionCut(rows), h)
})

test('four equal option columns', () => {
  const c = optionColumns(100, 500)
  assert.deepEqual(c, [[100, 200], [200, 300], [300, 400], [400, 500]])
})

test('inkBox pads and clips', () => {
  const w = 50, lum = new Uint8Array(w * 50).fill(255)
  lum[10 * w + 10] = 0
  assert.deepEqual(inkBox(lum, w, 0, 50, 0, 50, 3), { x0: 7, x1: 14, y0: 7, y1: 14 })
  assert.equal(inkBox(new Uint8Array(100).fill(255), 10, 0, 10, 0, 10), null)
})

test('plan: question box, four equal-height option boxes, captions dropped', () => {
  const { lum, w, h } = strip()
  const p = planSplit(lum, w, h)
  assert.ok(p.detected.divider && p.detected.caption)
  assert.ok(p.cut < 200)
  assert.equal(p.options.length, 4)
  assert.ok(p.options.every(o => o.y0 === p.options[0].y0 && o.y1 === p.options[0].y1))
  assert.ok(p.question.x1 <= p.divider)
  assert.ok(p.options[0].x0 > p.divider)
})

test('manual overrides win over detection', () => {
  const { lum, w, h } = strip()
  const p = planSplit(lum, w, h, { dividerX: 300, cutY: 180 })
  assert.equal(p.divider, 300); assert.equal(p.cut, 180)
})

test('option frames: specks are ignored and touching frames are split', () => {
  const w = 1000, h = 200, lum = new Uint8Array(w * h).fill(255)
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lum[y * w + x] = 0 }
  rect(204, 20, 206, 150)                       // speck right after the divider
  rect(300, 20, 400, 150); rect(500, 20, 700, 150); rect(800, 20, 900, 150)   // middle run is two frames side by side
  const runs = findOptionRuns(lum, w, 203, 150, 6)
  assert.equal(runs.length, 4)
  assert.ok(runs[1][1] <= runs[2][0] + 1)
})

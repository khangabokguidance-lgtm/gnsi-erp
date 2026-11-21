import test from 'node:test'
import assert from 'node:assert/strict'
import { niceScale, cleanRows, drawChart } from '../src/lib/chartDraw.js'

test('niceScale gives tidy ticks that cover the largest value', () => {
  assert.deepEqual(niceScale(240).ticks, [0, 50, 100, 150, 200, 250])
  const s = niceScale(7); assert.ok(s.top >= 7 && s.ticks[0] === 0 && s.ticks.length >= 4 && s.ticks.length <= 9)
  const big = niceScale(48500); assert.ok(big.top >= 48500 && big.step % 1000 === 0)
  const tiny = niceScale(0.9); assert.ok(tiny.top >= 0.9)
  assert.ok(niceScale(0).top > 0)
})

test('cleanRows keeps only labelled, non-negative numbers', () => {
  const r = cleanRows([{ label: 'JUN', value: '150' }, { label: '', value: 5 }, { label: 'X', value: 'abc' }, { label: 'Y', value: -3 }, { label: ' ꯖꯨꯟ ', value: 90 }])
  assert.deepEqual(r, [{ label: 'JUN', value: 150 }, { label: 'ꯖꯨꯟ', value: 90 }])
})

// A recording stand-in for a canvas 2D context.
function fakeCtx() {
  const calls = { fillRect: [], fillText: [], arc: 0 }
  const g = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, setLineDash() {},
    measureText: s => ({ width: String(s).length * 7 }),
    fillRect: (...a) => calls.fillRect.push(a), fillText: (s) => calls.fillText.push(s), arc: () => { calls.arc++ } }
  return { g, calls }
}

test('bar chart draws one bar per row, with every label and the axis names', () => {
  const { g, calls } = fakeCtx()
  drawChart(g, { type: 'bar', title: 'Rainfall', xLabel: 'MONTH', yLabel: 'Rainfall (mm)', rows: [{ label: 'JUN', value: 150 }, { label: 'JUL', value: 240 }, { label: 'AUG', value: 180 }] }, 640, 360)
  assert.equal(calls.fillRect.length, 1 + 3)            // background + 3 bars
  for (const t of ['Rainfall', 'MONTH', 'Rainfall (mm)', 'JUN', 'JUL', 'AUG', '250']) assert.ok(calls.fillText.includes(t), t)
})

test('line chart draws a dot per point; pie draws a legend with every label', () => {
  const a = fakeCtx(); drawChart(a.g, { type: 'line', rows: [{ label: 'a', value: 1 }, { label: 'b', value: 3 }] }, 600, 300)
  assert.equal(a.calls.arc, 2)
  const b = fakeCtx(); drawChart(b.g, { type: 'pie', percent: true, rows: [{ label: 'Rice', value: 50 }, { label: 'Dal', value: 50 }] }, 600, 300)
  assert.ok(b.calls.fillText.includes('Rice') && b.calls.fillText.includes('Dal') && b.calls.fillText.includes('50%'))
})

test('an empty chart does not throw', () => {
  const { g } = fakeCtx(); assert.doesNotThrow(() => drawChart(g, { type: 'bar', rows: [] }, 300, 200))
})

// Draws a simple exam chart (bar, line or pie) onto a canvas 2D context. Labels are plain strings, so they can be in
// any language — Meetei Mayek included, as long as the font is loaded before drawing (ChartMaker does that).

export const CHART_FONT = '"Noto Sans Meetei Mayek", "Noto Sans", Arial, sans-serif'
const PALETTE = ['#3b4a6b', '#c0392b', '#2e8b57', '#d4a017', '#6c3fa0', '#1f8fbf', '#e67e22', '#7f8c8d']
const INK = '#111', GRID = '#b9bfca'

// A tidy axis: a "nice" step (1, 2, 5 × 10ⁿ) and the top of the axis, so 0…max always has 4–8 ticks.
export function niceScale(maxValue, want = 6) {
  const max = Number(maxValue) > 0 ? Number(maxValue) : 1
  const raw = max / want
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { step, top, ticks }
}

// Rows the chart can draw: a label and a positive number.
export const cleanRows = rows => (rows || []).map(r => ({ label: String(r.label ?? '').trim(), value: Number(r.value) })).filter(r => r.label !== '' && Number.isFinite(r.value) && r.value >= 0)

const num = v => (Math.abs(v) >= 1000 && Number.isInteger(v) ? v.toLocaleString('en-IN') : String(v))

function text(g, s, x, y, { size = 14, weight = 400, align = 'left', base = 'alphabetic', rotate = 0, color = INK } = {}) {
  g.save(); g.fillStyle = color; g.font = `${weight} ${size}px ${CHART_FONT}`; g.textAlign = align; g.textBaseline = base
  g.translate(x, y); if (rotate) g.rotate(rotate); g.fillText(s, 0, 0); g.restore()
}

// Wrap a label onto at most two lines so long names do not run into each other.
function wrap(g, s, maxW, size) {
  g.save(); g.font = `600 ${size}px ${CHART_FONT}`
  if (g.measureText(s).width <= maxW || !/\s/.test(s)) { g.restore(); return [s] }
  const words = s.split(/\s+/); let a = ''
  for (let i = 0; i < words.length; i++) { const t = a ? a + ' ' + words[i] : words[i]; if (g.measureText(t).width > maxW && a) { g.restore(); return [a, words.slice(i).join(' ')] } a = t }
  g.restore(); return [a]
}

export function drawChart(g, spec, w, h) {
  const rows = cleanRows(spec.rows)
  g.save(); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)
  if (!rows.length) { text(g, '—', w / 2, h / 2, { align: 'center', size: 18 }); g.restore(); return }
  const title = (spec.title || '').trim()
  const top = title ? 44 : 16
  if (title) text(g, title, w / 2, 28, { align: 'center', size: 17, weight: 700 })
  if (spec.type === 'pie') drawPie(g, spec, rows, w, h, top)
  else drawAxes(g, spec, rows, w, h, top)
  g.restore()
}

function drawAxes(g, spec, rows, w, h, top) {
  const left = spec.yLabel ? 72 : 52, right = 20, bottom = spec.xLabel ? 78 : 52
  const pw = w - left - right, ph = h - top - bottom
  const { top: yMax, ticks } = niceScale(Math.max(...rows.map(r => r.value)))
  const y = v => top + ph - (v / yMax) * ph
  g.save(); g.strokeStyle = GRID; g.lineWidth = 1; g.setLineDash([4, 4])
  ticks.forEach(t => { g.beginPath(); g.moveTo(left, y(t)); g.lineTo(left + pw, y(t)); g.stroke() })
  g.restore()
  ticks.forEach(t => text(g, num(t), left - 8, y(t), { align: 'right', base: 'middle', size: 13, weight: 600 }))
  g.save(); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(left, top); g.lineTo(left, top + ph); g.lineTo(left + pw, top + ph); g.stroke(); g.restore()
  const slot = pw / rows.length
  if (spec.type === 'line') {
    g.save(); g.strokeStyle = PALETTE[0]; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath()
    rows.forEach((r, i) => { const px = left + slot * (i + 0.5), py = y(r.value); i ? g.lineTo(px, py) : g.moveTo(px, py) }); g.stroke()
    rows.forEach((r, i) => { const px = left + slot * (i + 0.5), py = y(r.value); g.fillStyle = PALETTE[0]; g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fill() })
    g.restore()
  } else {
    const bw = Math.min(70, slot * 0.6)
    rows.forEach((r, i) => { const px = left + slot * (i + 0.5) - bw / 2; g.fillStyle = PALETTE[0]; g.fillRect(px, y(r.value), bw, top + ph - y(r.value)) })
  }
  if (spec.values) rows.forEach((r, i) => text(g, num(r.value), left + slot * (i + 0.5), y(r.value) - 7, { align: 'center', size: 12.5, weight: 700 }))
  rows.forEach((r, i) => wrap(g, r.label, slot - 4, 13).forEach((ln, k) => text(g, ln, left + slot * (i + 0.5), top + ph + 20 + k * 16, { align: 'center', size: 13, weight: 600 })))
  if (spec.xLabel) text(g, spec.xLabel, left + pw / 2, h - 12, { align: 'center', size: 14, weight: 700 })
  if (spec.yLabel) text(g, spec.yLabel, 18, top + ph / 2, { align: 'center', size: 14, weight: 700, rotate: -Math.PI / 2 })
}

function drawPie(g, spec, rows, w, h, top) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  const legendW = Math.min(190, w * 0.38)
  const r = Math.min((w - legendW - 40) / 2, (h - top - 20) / 2)
  const cx = 24 + r, cy = top + (h - top) / 2
  let a = -Math.PI / 2
  rows.forEach((row, i) => {
    const sweep = (row.value / total) * Math.PI * 2
    g.fillStyle = PALETTE[i % PALETTE.length]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a, a + sweep); g.closePath(); g.fill()
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke()
    if (spec.values || spec.percent) {
      const m = a + sweep / 2, lx = cx + Math.cos(m) * r * 0.62, ly = cy + Math.sin(m) * r * 0.62
      text(g, spec.percent ? Math.round((row.value / total) * 100) + '%' : num(row.value), lx, ly, { align: 'center', base: 'middle', size: 13, weight: 700, color: '#fff' })
    }
    a += sweep
  })
  const lx = cx + r + 28
  rows.forEach((row, i) => {
    const ly = cy - (rows.length * 22) / 2 + i * 22 + 11
    g.fillStyle = PALETTE[i % PALETTE.length]; g.fillRect(lx, ly - 7, 14, 14)
    text(g, row.label, lx + 22, ly, { base: 'middle', size: 13.5, weight: 600 })
  })
}

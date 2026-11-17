// Venn-diagram drawing for Intelligence questions: labelled diagrams for the question stem, and plain relationship
// diagrams (circles only) to use as picture options. Pure string output so it can be tested and drawn anywhere.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const COLORS = ['#2563eb', '#dc2626', '#16a34a']
const circle = (x, y, r, i, fill = true) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill ? COLORS[i % 3] : 'none'}" fill-opacity="${fill ? 0.18 : 0}" stroke="${fill ? COLORS[i % 3] : '#111'}" stroke-width="2.2"/>`
const text = (x, y, t, { size = 15, weight = 600, fill = '#111', anchor = 'middle' } = {}) => (String(t ?? '').trim() ? `<text x="${x}" y="${y + size * 0.35}" font-family="Georgia,serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(String(t).trim().slice(0, 14))}</text>` : '')
const wrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`

// Labelled Venn: sets = 2 | 3; labels = [A, B, C names]; v = region values { a, b, c, ab, ac, bc, abc, out }.
export function vennSvg({ sets = 2, labels = [], v = {}, universe = true } = {}) {
  if (sets === 3) {
    const W = 320, H = 290, r = 68
    const body = `${universe ? `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#111" stroke-width="1.6"/>` : ''}`
      + circle(122, 108, r, 0) + circle(198, 108, r, 1) + circle(160, 172, r, 2)
      + text(78, 30, labels[0], { size: 14, weight: 700, fill: COLORS[0] }) + text(242, 30, labels[1], { size: 14, weight: 700, fill: COLORS[1] }) + text(160, 276, labels[2], { size: 14, weight: 700, fill: COLORS[2] })
      + text(96, 92, v.a) + text(224, 92, v.b) + text(160, 218, v.c) + text(160, 78, v.ab) + text(122, 160, v.ac) + text(198, 160, v.bc) + text(160, 130, v.abc)
      + (universe ? text(26, 270, v.out, { size: 14 }) : '')
    return wrap(W, H, body)
  }
  const W = 320, H = 210, r = 74
  const body = `${universe ? `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#111" stroke-width="1.6"/>` : ''}`
    + circle(124, 108, r, 0) + circle(196, 108, r, 1)
    + text(92, 26, labels[0], { size: 14, weight: 700, fill: COLORS[0] }) + text(228, 26, labels[1], { size: 14, weight: 700, fill: COLORS[1] })
    + text(88, 108, v.a) + text(160, 108, v.ab) + text(232, 108, v.b) + (universe ? text(28, 190, v.out, { size: 14 }) : '')
  return wrap(W, H, body)
}

// Plain relationship diagrams, for options like "which diagram shows Doctors, Men and Teachers?"
export const VENN_PRESETS = [
  { id: 'sep2', name: 'Two separate', circles: [[60, 60, 34], [140, 60, 34]] },
  { id: 'ov2', name: 'Two overlapping', circles: [[70, 60, 38], [112, 60, 38]] },
  { id: 'in2', name: 'One inside other', circles: [[100, 60, 46], [100, 66, 22]] },
  { id: 'sep3', name: 'Three separate', circles: [[36, 62, 26], [100, 62, 26], [164, 62, 26]] },
  { id: 'ov3', name: 'Three overlapping', circles: [[78, 48, 34], [122, 48, 34], [100, 84, 34]] },
  { id: 'two_in_one', name: 'Two separate inside a third', circles: [[100, 60, 52], [78, 60, 18], [124, 60, 18]] },
  { id: 'nest3', name: 'Nested (one in one in one)', circles: [[100, 60, 54], [100, 66, 36], [100, 72, 18]] },
  { id: 'ov_in', name: 'Two overlapping inside a third', circles: [[100, 60, 54], [84, 60, 24], [116, 60, 24]] },
  { id: 'in_sep', name: 'One inside, one outside', circles: [[66, 60, 42], [66, 66, 20], [158, 60, 26]] },
]
export function vennPresetSvg(id, labels = []) {
  const p = VENN_PRESETS.find(x => x.id === id) || VENN_PRESETS[0]
  const body = p.circles.map(([x, y, r], i) => circle(x, y, r, i, false)).join('')
  return wrap(200, 120, body)
}

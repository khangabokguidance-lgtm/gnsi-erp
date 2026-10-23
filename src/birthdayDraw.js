// Canvas renderer for the Design Studio "Birthday" card (1080 × 1080, WhatsApp-square).
// Pure drawing code — no React — so the preview and the PNG download are identical.
export const SIZE = 1080

export const THEMES = {
  navy:    { label: 'Royal Navy & Gold',  bg: ['#1d3f86', '#0d2350', '#050f26'], ink: '#ffffff', sub: '#d9b25a', body: '#f6e3a1', gold: ['#fff3c4', '#d9b25a', '#a77d2a'], line: '#d9b25a', photo: '#0a1d46', pattern: '#d9b25a' },
  maroon:  { label: 'Maroon & Gold',      bg: ['#9a2a40', '#5e1121', '#2c050d'], ink: '#ffffff', sub: '#e2bf68', body: '#f6e3a1', gold: ['#fff3c4', '#d9b25a', '#a77d2a'], line: '#d9b25a', photo: '#2c050d', pattern: '#d9b25a' },
  emerald: { label: 'Emerald & Gold',     bg: ['#118060', '#0a4a38', '#042a20'], ink: '#ffffff', sub: '#e2bf68', body: '#f3e6b8', gold: ['#fff3c4', '#d9b25a', '#a77d2a'], line: '#d9b25a', photo: '#042a20', pattern: '#d9b25a' },
  black:   { label: 'Black & Gold',       bg: ['#2a2a34', '#111116', '#050507'], ink: '#ffffff', sub: '#d9b25a', body: '#f6e3a1', gold: ['#fff3c4', '#d9b25a', '#a77d2a'], line: '#d9b25a', photo: '#111116', pattern: '#d9b25a' },
  ivory:   { label: 'Ivory & Gold',       bg: ['#fffdf6', '#f6edd6', '#e6d7ab'], ink: '#0d2350', sub: '#9a6f1c', body: '#4a3410', gold: ['#d8a93f', '#9a6f1c', '#6b4a0f'], line: '#b8892b', photo: '#fffdf6', pattern: '#9a6f1c' },
}

export const LAYOUTS = { round: 'Centred · round photo', arch: 'Side by side · arch photo' }

export const MESSAGES = {
  loyalty: 'Through every season, you have stood like a wall — steady, loyal and unshakable. Thank you for your unwavering loyalty and for being our strength.',
  family: 'Some people hold up a roof; you hold up a family. Thank you for standing by GNSI — firm as a wall, faithful always. May your year be as strong as your loyalty.',
  wish: 'Wishing you a year filled with good health, happiness and success. Thank you for your dedication and for inspiring every student at GNSI.',
}

const SERIF = "'Playfair Display', Georgia, serif", CINZEL = "'Cinzel', Georgia, serif", SCRIPT = "'Great Vibes', cursive"

const spaced = (ctx, px) => { ctx.letterSpacing = px + 'px' }
const goldGrad = (ctx, t, y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); t.gold.forEach((c, i) => g.addColorStop(i / 2, c)); return g }
const diagGrad = (ctx, t, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); [0, .4, .6, 1].forEach((s, i) => g.addColorStop(s, [t.gold[0], t.gold[2], t.gold[0], t.gold[2]][i])); return g }

// centred text with letter-spacing (canvas adds the trailing gap, so shift half of it back)
function centred(ctx, text, x, y, ls) {
  spaced(ctx, ls); ctx.textAlign = 'center'
  ctx.fillText(text, x + ls / 2, y); spaced(ctx, 0)
}

function wrap(ctx, text, maxW) {
  const out = []; let line = ''
  for (const w of String(text || '').split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + w : w
    if (line && ctx.measureText(next).width > maxW) { out.push(line); line = w } else line = next
  }
  if (line) out.push(line)
  return out
}

function archPath(ctx, x, y, w, h, r) {
  const b = 10
  ctx.beginPath(); ctx.moveTo(x, y + h - b); ctx.lineTo(x, y + r)
  ctx.arc(x + w / 2, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h - b)
  ctx.quadraticCurveTo(x + w, y + h, x + w - b, y + h); ctx.lineTo(x + b, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - b); ctx.closePath()
}

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.12, sw, sh, x, y, w, h)
}

function photoFrame(ctx, t, img, shape, x, y, w, h) {
  const path = (i) => shape === 'round'
    ? (ctx.beginPath(), ctx.arc(x + w / 2, y + h / 2, w / 2 - i, 0, Math.PI * 2))
    : archPath(ctx, x + i, y + i, w - 2 * i, h - 2 * i, w / 2 - i)
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16
  path(0); ctx.fillStyle = diagGrad(ctx, t, x, y, x + w, y + h); ctx.fill(); ctx.restore()
  path(9); ctx.fillStyle = t.photo; ctx.fill()
  ctx.save(); path(14); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h)
  if (img) cover(ctx, img, x, y, w, h)
  else { ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * .38, w * .16, 0, 7); ctx.fill(); ctx.fillRect(x + w * .2, y + h * .58, w * .6, h) }
  ctx.restore()
}

export function drawBirthday(ctx, o, img) {
  const t = THEMES[o.theme] || THEMES.navy, round = o.layout !== 'arch'
  const S = SIZE, C = S / 2
  // background
  const bg = ctx.createRadialGradient(round ? C : 320, round ? 410 : 540, 0, round ? C : 320, round ? 410 : 540, 760)
  bg.addColorStop(0, t.bg[0]); bg.addColorStop(.5, t.bg[1]); bg.addColorStop(1, t.bg[2])
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
  ctx.save(); ctx.globalAlpha = .07; ctx.strokeStyle = t.pattern; ctx.lineWidth = 1; ctx.beginPath()
  for (let k = -S; k < S * 2; k += 18) { ctx.moveTo(k, 0); ctx.lineTo(k + S, S); ctx.moveTo(k, 0); ctx.lineTo(k - S, S) }
  ctx.stroke(); ctx.restore()
  // borders
  ctx.strokeStyle = diagGrad(ctx, t, 0, 0, S, S); ctx.lineWidth = 7; ctx.strokeRect(29.5, 29.5, S - 59, S - 59)
  ctx.strokeStyle = t.line; ctx.lineWidth = 1.5; ctx.strokeRect(46.75, 46.75, S - 93.5, S - 93.5)

  // header
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 21px ${CINZEL}`; ctx.fillStyle = o.theme === 'ivory' ? t.ink : t.sub
  centred(ctx, 'GUIDANCE NAVODAYA & SAINIK INSTITUTE', C, 94, 5)
  const hy = round ? 188 : 196
  ctx.font = `400 ${round ? 104 : 112}px ${SCRIPT}`; ctx.fillStyle = goldGrad(ctx, t, hy - 90, hy + 20); ctx.textAlign = 'center'; ctx.fillText('Happy', C, hy)
  ctx.font = `800 ${round ? 40 : 46}px ${CINZEL}`; ctx.fillStyle = t.ink
  ctx.save(); if (o.theme !== 'ivory') { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2 }
  centred(ctx, 'BIRTHDAY', C, round ? 252 : 262, 14); ctx.restore()

  const name = String(o.name || '').toUpperCase().trim()
  if (round) {
    const r = 165, cy = 457
    ctx.save(); ctx.strokeStyle = t.line; ctx.globalAlpha = .7; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(C, cy, r + 24, 0, 7); ctx.stroke(); ctx.restore()
    photoFrame(ctx, t, img, 'round', C - r, cy - r, r * 2, r * 2)
    let px = 40; ctx.font = `700 ${px}px ${CINZEL}`; spaced(ctx, 5)
    while (px > 24 && ctx.measureText(name).width > 880) { px -= 2; ctx.font = `700 ${px}px ${CINZEL}` }
    spaced(ctx, 0); ctx.fillStyle = t.ink; centred(ctx, name, C, 704, 5)
    ctx.font = `italic 400 21px ${SERIF}`; ctx.fillStyle = t.sub; centred(ctx, o.role, C, 752, 0)
    ctx.fillStyle = t.line; ctx.fillRect(C - 150, 782, 300, 1)
    ctx.save(); ctx.translate(C, 782.5); ctx.rotate(Math.PI / 4); ctx.fillRect(-4.5, -4.5, 9, 9); ctx.restore()
    ctx.font = `italic 400 26px ${SERIF}`; ctx.fillStyle = t.body
    wrap(ctx, o.msg, 820).forEach((l, i) => centred(ctx, l, C, 830 + i * 38, 0))
    ctx.font = `700 15px ${CINZEL}`; ctx.fillStyle = t.sub
    centred(ctx, `✦ ${o.date} · ${o.from} ✦`.toUpperCase(), C, 1010, 4)
  } else {
    photoFrame(ctx, t, img, 'arch', 96, 395, 340, 430)
    ctx.save(); ctx.strokeStyle = t.line; ctx.globalAlpha = .4; ctx.lineWidth = 1; archPath(ctx, 74, 373, 384, 474, 192); ctx.stroke(); ctx.restore()
    const X = 742, W = 484
    ctx.font = `700 33px ${CINZEL}`; spaced(ctx, 3)
    const lines = wrap(ctx, name, W); spaced(ctx, 0)
    ctx.fillStyle = t.line; ctx.fillRect(500, 405, W, 1)
    ctx.fillStyle = t.ink; ctx.font = `700 33px ${CINZEL}`
    lines.forEach((l, i) => centred(ctx, l, X, 452 + i * 42, 3))
    const ny = 405 + 24 + lines.length * 42 + 14
    ctx.fillStyle = t.line; ctx.fillRect(500, ny, W, 1)
    ctx.font = `italic 400 20px ${SERIF}`; ctx.fillStyle = t.sub; centred(ctx, o.role, X, ny + 38, 0)
    ctx.font = `italic 400 24px ${SERIF}`; ctx.fillStyle = t.body
    const ml = wrap(ctx, o.msg, W), my = ny + 90
    ml.forEach((l, i) => centred(ctx, l, X, my + i * 37, 0))
    const fy = my + ml.length * 37 + 22
    ctx.font = `500 12px ${CINZEL}`; ctx.fillStyle = t.sub; centred(ctx, 'WITH LOVE & RESPECT, FROM', X, fy, 4)
    ctx.font = `400 46px ${SCRIPT}`; ctx.fillStyle = t.body; centred(ctx, o.from, X, fy + 50, 0)
    ctx.font = `700 17px ${CINZEL}`; ctx.fillStyle = t.ink; centred(ctx, `✦ ${o.date} ✦`.toUpperCase(), C, 1012, 4)
  }
}

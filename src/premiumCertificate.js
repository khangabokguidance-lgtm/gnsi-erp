// premiumCertificate.js — the GNSI premium certificate (A4 landscape).
//
// One design for every certificate the portal issues: Attendance "Best
// Student of the Month", Hostel "Housemaster of the Month" and the Awards
// categories. White guilloche paper, a navy wave with a gold swoosh across
// the top, "CERTIFICATE" in gold, a navy ribbon down the left carrying a gold
// award badge (value + label), the recipient in script on a rule at right,
// two signature lines with a crest and a wax seal between them, the date of
// issue and a certificate number.
//
//   const canvas = await drawPremiumCertificate({ … })
//   canvas.toDataURL('image/jpeg', .95)        → image
//   certificatePdf(canvas, 'Certificate.pdf')  → A4 PDF download
import jsPDF from 'jspdf'
import { LOGO_BASE64 } from './logo'
import { getInstitute } from './systemSettings'

const NAVY = '#0B1E3D', NAVY2 = '#1C3A6B', GOLD = '#B8913F', GOLD_LIGHT = '#E2C57E', GOLD_DEEP = '#8C6A22'
const INK = '#2B3445', MUTED = '#6B7280'

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&family=Playfair+Display:wght@700;800&display=swap'
const CINZEL = '"Cinzel", "Trajan Pro", Georgia, serif'
const CORMORANT = '"Cormorant Garamond", Georgia, serif'
const SCRIPT = '"Great Vibes", "Brush Script MT", cursive'
const PLAYFAIR = '"Playfair Display", Georgia, serif'

let fontsReady = null
/** Loads the certificate fonts once (falls back to Georgia if offline). */
function loadFonts() {
  if (fontsReady) return fontsReady
  fontsReady = (async () => {
    try {
      if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
        const l = document.createElement('link')
        l.rel = 'stylesheet'; l.href = FONTS_HREF
        document.head.appendChild(l)
      }
      const want = ['700 40px "Cinzel"', '600 40px "Cinzel"', '500 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"',
        '600 40px "Cormorant Garamond"', '400 40px "Great Vibes"', '800 40px "Playfair Display"']
      await Promise.race([
        Promise.all(want.map(f => document.fonts.load(f))),
        new Promise(res => setTimeout(res, 4000)),
      ])
    } catch { /* fonts are optional */ }
  })()
  return fontsReady
}

const loadImage = src => new Promise(res => {
  const im = new Image()
  im.onload = () => res(im); im.onerror = () => res(null); im.src = src
  setTimeout(() => res(null), 5000)
})

// Text with letter spacing (canvas letterSpacing where supported).
function spaced(g, text, x, y, spacing) {
  if ('letterSpacing' in g) { g.letterSpacing = `${spacing}px`; g.fillText(text, x + spacing / 2, y); g.letterSpacing = '0px'; return }
  const chars = [...text]
  const w = chars.reduce((t, c) => t + g.measureText(c).width, 0) + spacing * (chars.length - 1)
  let cx = g.textAlign === 'center' ? x - w / 2 : x
  const align = g.textAlign; g.textAlign = 'left'
  for (const c of chars) { g.fillText(c, cx, y); cx += g.measureText(c).width + spacing }
  g.textAlign = align
}
// Largest font size (≤ size) at which the text fits maxW.
function fit(g, text, maxW, size, font, weight = '') {
  let s = size
  do { g.font = `${weight} ${s}px ${font}`; s -= 2 } while (g.measureText(text).width > maxW && s > 14)
  return s + 2
}
function goldGradient(g, x0, x1) {
  const gr = g.createLinearGradient(x0, 0, x1, 0)
  gr.addColorStop(0, GOLD_DEEP); gr.addColorStop(0.3, GOLD_LIGHT); gr.addColorStop(0.5, '#F6E7B8')
  gr.addColorStop(0.7, GOLD_LIGHT); gr.addColorStop(1, GOLD_DEEP)
  return gr
}
// Gold award badge: scalloped rosette with ribbon tails; label on top, value big.
function badge(g, cx, cy, r, value, label) {
  g.fillStyle = GOLD
  ;[-1, 1].forEach(s => {
    g.beginPath(); g.moveTo(cx + s * r * 0.15, cy + r * 0.6); g.lineTo(cx + s * r * 0.95, cy + r * 1.7)
    g.lineTo(cx + s * r * 0.62, cy + r * 1.58); g.lineTo(cx + s * r * 0.42, cy + r * 1.85); g.lineTo(cx - s * r * 0.15, cy + r * 0.7); g.closePath(); g.fill()
  })
  const pts = 32
  g.beginPath()
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.92
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
  gr.addColorStop(0, '#FBEFC4'); gr.addColorStop(0.5, GOLD_LIGHT); gr.addColorStop(1, GOLD_DEEP)
  g.fillStyle = gr; g.fill()
  g.strokeStyle = GOLD_DEEP; g.lineWidth = 3
  g.beginPath(); g.arc(cx, cy, r * 0.78, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 0.7, 0, Math.PI * 2); g.stroke()
  g.textAlign = 'center'; g.fillStyle = NAVY
  if (label) { fit(g, label, r * 1.1, r * 0.2, CINZEL, '800'); spaced(g, label, cx, cy - r * 0.3, 1) }
  fit(g, value, r * 1.2, r * 0.6, PLAYFAIR, '800')
  g.fillText(value, cx, cy + r * 0.28)
}
// Small round stamp: laurel ring around the crest (or a star).
function stamp(g, cx, cy, r, logo, wax) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = wax ? '#9B1C24' : NAVY; g.fill()
  g.strokeStyle = wax ? '#C4505A' : GOLD_LIGHT; g.lineWidth = 3
  g.beginPath(); g.arc(cx, cy, r * 0.84, 0, Math.PI * 2); g.stroke()
  g.fillStyle = wax ? '#E8A6AB' : GOLD_LIGHT
  if (logo && !wax) {
    g.save(); g.beginPath(); g.arc(cx, cy, r * 0.66, 0, Math.PI * 2); g.clip(); g.fillStyle = '#fff'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r)
    g.drawImage(logo, cx - r * 0.66, cy - r * 0.66, r * 1.32, r * 1.32); g.restore()
  } else {
    g.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.26 : r * 0.6; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) }
    g.closePath(); g.fill()
  }
}

/**
 * Draws the certificate and returns the canvas (2000 × 1414, A4 landscape).
 * opts: {
 *   kind: 'Excellence' | 'Appreciation' | …   ("OF …" under CERTIFICATE)
 *   subtitle: 'Best Student of the Month · Attendance'
 *   presented: 'This certificate is proudly presented to'
 *   name, detail: 'GCC No. 925 · Foundation · Udaan',
 *   body: ['has achieved …', '…'],
 *   seal: { value: '100%', label: 'ATTENDANCE' },   (gold badge on the ribbon)
 *   signatures: [{ title: 'Principal', name? }, { title, name? }],
 *   issued: Date, certNo: 'GNSI/ATT/2026-10/925'
 * }
 */
export async function drawPremiumCertificate(opts) {
  await loadFonts()
  const inst = getInstitute({ name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur — 795134' })
  const W = 2000, H = 1414
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const logo = await loadImage(`data:image/png;base64,${LOGO_BASE64}`)
  const R = W - 150            // right text edge

  // ── paper: white to pale blue-grey with fine guilloche waves ──
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#E9EEF6')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.lineWidth = 1
  for (let k = 0; k < 90; k++) {
    g.strokeStyle = k % 5 === 0 ? 'rgba(184,145,63,.16)' : 'rgba(100,115,145,.10)'
    g.beginPath()
    for (let x = 0; x <= W; x += 8) {
      const y = 200 + k * 15 + Math.sin(x / 260 + k * 0.12) * 60 + Math.sin(x / 40 + k) * 3
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
  }

  // ── navy ribbon down the left, gold rules either side ──
  const rx0 = 230, rx1 = 520, rcx = (rx0 + rx1) / 2
  const rb = g.createLinearGradient(rx0, 0, rx1, 0)
  rb.addColorStop(0, NAVY); rb.addColorStop(0.5, NAVY2); rb.addColorStop(1, NAVY)
  g.fillStyle = rb; g.fillRect(rx0, 0, rx1 - rx0, H)
  g.fillStyle = GOLD
  ;[rx0 + 14, rx1 - 17].forEach(x => g.fillRect(x, 0, 3, H))

  // ── navy wave across the top ──
  const wave = new Path2D()
  wave.moveTo(0, 0); wave.lineTo(W, 0); wave.lineTo(W, H * 0.17)
  wave.bezierCurveTo(W * 0.78, H * 0.17, W * 0.58, H * 0.27, W * 0.4, H * 0.38)
  wave.bezierCurveTo(W * 0.24, H * 0.48, W * 0.1, H * 0.54, 0, H * 0.55)
  wave.closePath()
  const nv = g.createLinearGradient(0, 0, W, H * 0.4)
  nv.addColorStop(0, NAVY); nv.addColorStop(1, NAVY2)
  g.save(); g.shadowColor = 'rgba(11,30,61,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 8
  g.fillStyle = nv; g.fill(wave); g.restore()
  // the ribbon's gold rules continue over nothing here: wave sits above them
  // gold swoosh along the right
  const sw = new Path2D()
  sw.moveTo(W * 0.6, H * 0.2)
  sw.bezierCurveTo(W * 0.74, H * 0.145, W * 0.88, H * 0.145, W, H * 0.12)
  sw.lineTo(W, H * 0.2)
  sw.bezierCurveTo(W * 0.9, H * 0.165, W * 0.74, H * 0.17, W * 0.6, H * 0.2)
  sw.closePath()
  g.fillStyle = goldGradient(g, W * 0.6, W); g.fill(sw)

  // ── header: crest + institute (white on navy) ──
  const lx = 90
  if (logo) {
    g.save(); g.beginPath(); g.arc(lx + 56, 110, 56, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip()
    g.drawImage(logo, lx, 54, 112, 112); g.restore()
    g.strokeStyle = GOLD_LIGHT; g.lineWidth = 4; g.beginPath(); g.arc(lx + 56, 110, 60, 0, Math.PI * 2); g.stroke()
  }
  g.textAlign = 'left'; g.fillStyle = '#fff'
  fit(g, inst.name.toUpperCase(), 900, 38, CINZEL, '700')
  spaced(g, inst.name.toUpperCase(), lx + 150, 106, 3)
  g.fillStyle = GOLD_LIGHT; g.font = `italic 500 28px ${CORMORANT}`
  g.fillText(inst.address, lx + 150, 148)

  // ── title ──
  g.textAlign = 'left'
  g.fillStyle = goldGradient(g, lx, lx + 900)
  g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowOffsetY = 4; g.shadowBlur = 6
  g.font = `800 190px ${CINZEL}`
  const cw = g.measureText('C').width
  g.fillText('C', lx, 395)
  g.font = `800 130px ${CINZEL}`
  spaced(g, 'ERTIFICATE', lx + cw + 6, 395, 6)
  g.restore()
  g.fillStyle = '#fff'; g.font = `600 44px ${CINZEL}`
  spaced(g, `OF ${(opts.kind || 'Excellence').toUpperCase()}`, lx + 6, 470, 6)
  if (opts.subtitle) {
    g.fillStyle = GOLD_LIGHT
    fit(g, opts.subtitle, 880, 34, CORMORANT, 'italic 600')
    g.fillText(opts.subtitle, lx + 6, 520)
  }

  // ── gold badge on the ribbon ──
  if (opts.seal) badge(g, rcx, 1010, 150, String(opts.seal.value), opts.seal.label)

  // ── recipient (right-aligned) ──
  g.textAlign = 'right'; g.fillStyle = NAVY
  const pres = (opts.presented || 'This certificate is proudly presented to').toUpperCase()
  fit(g, pres, 1000, 38, CORMORANT, '700')
  spaced(g, pres, R, 650, 2)
  g.fillStyle = NAVY
  fit(g, opts.name || '', 1100, 150, SCRIPT, '400')
  g.fillText(opts.name || '', R, 800)
  g.strokeStyle = INK; g.lineWidth = 2.5
  g.beginPath(); g.moveTo(W * 0.37, 828); g.lineTo(R, 828); g.stroke()
  let y = 900
  if (opts.detail) {
    g.fillStyle = NAVY; fit(g, opts.detail.toUpperCase(), 1100, 40, CINZEL, '700')
    g.fillText(opts.detail.toUpperCase(), R, y); y += 52
  }
  g.fillStyle = INK
  for (const line of opts.body || []) { fit(g, line, 1100, 32, CORMORANT, '600'); g.fillText(line, R, y); y += 40 }

  // ── signatures with crest + wax seal between ──
  const sigs = opts.signatures || [{ title: 'Principal' }, { title: 'Founder & Director' }]
  const sxs = [[W * 0.37, W * 0.37 + 330], [R - 330, R]]
  sxs.forEach(([a, b], i) => {
    const s = sigs[i]; if (!s) return
    g.strokeStyle = INK; g.lineWidth = 2
    g.beginPath(); g.moveTo(a, 1235); g.lineTo(b, 1235); g.stroke()
    g.textAlign = 'center'; g.fillStyle = NAVY
    fit(g, s.title.toUpperCase(), 320, 22, CINZEL, '700'); spaced(g, s.title.toUpperCase(), (a + b) / 2, 1272, 3)
    if (s.name) { g.fillStyle = MUTED; fit(g, s.name, 320, 26, CORMORANT, 'italic 600'); g.fillText(s.name, (a + b) / 2, 1304) }
  })
  const mid = (sxs[0][1] + sxs[1][0]) / 2
  stamp(g, mid - 58, 1190, 52, logo, false)
  stamp(g, mid + 58, 1190, 52, null, true)

  // ── issue date and number ──
  const issued = (opts.issued || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  g.textAlign = 'center'; g.fillStyle = MUTED; g.font = `600 19px ${CINZEL}`
  spaced(g, `ISSUED ${issued.toUpperCase()}`, (sxs[0][0] + sxs[0][1]) / 2, 1360, 2)
  if (opts.certNo) spaced(g, `NO. ${opts.certNo}`, (sxs[1][0] + sxs[1][1]) / 2, 1360, 2)
  return c
}

/** Downloads the certificate canvas as an A4-landscape PDF. */
export function certificatePdf(canvas, fileName) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210)
  doc.save(fileName)
}

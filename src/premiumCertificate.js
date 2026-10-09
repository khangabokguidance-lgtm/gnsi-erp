// premiumCertificate.js — the GNSI premium certificate (A4 landscape).
//
// One design for every certificate the portal issues: Attendance "Best
// Student of the Month", Hostel "Housemaster of the Month" and the Awards
// categories. Ivory parchment with a fine gold guilloche, a navy band frame
// with gold rules and corner ornaments, the institute crest, "CERTIFICATE"
// in gold capitals with a script "of Excellence", the name on a gold
// flourish, a gold rosette seal with the score, two signature lines, the
// date of issue and a certificate number.
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
// Gold flourish: a line fading at both ends with a diamond in the middle.
function flourish(g, cx, y, half) {
  const gr = g.createLinearGradient(cx - half, 0, cx + half, 0)
  gr.addColorStop(0, 'rgba(184,145,63,0)'); gr.addColorStop(0.5, GOLD); gr.addColorStop(1, 'rgba(184,145,63,0)')
  g.strokeStyle = gr; g.lineWidth = 2.2
  g.beginPath(); g.moveTo(cx - half, y); g.lineTo(cx + half, y); g.stroke()
  g.fillStyle = GOLD
  g.beginPath(); g.moveTo(cx, y - 9); g.lineTo(cx + 9, y); g.lineTo(cx, y + 9); g.lineTo(cx - 9, y); g.closePath(); g.fill()
  ;[-22, 22].forEach(d => { g.beginPath(); g.arc(cx + d, y, 3.2, 0, Math.PI * 2); g.fill() })
}
// Corner ornament: nested gold quarter arcs, a diamond and dots.
function cornerOrnament(g, x, y, sx, sy) {
  g.save(); g.translate(x, y); g.scale(sx, sy)
  g.strokeStyle = GOLD; g.lineWidth = 2.4
  ;[46, 66].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI / 2); g.stroke() })
  g.lineWidth = 1.4
  g.beginPath(); g.moveTo(0, 86); g.lineTo(0, 150); g.moveTo(86, 0); g.lineTo(150, 0); g.stroke()
  g.fillStyle = GOLD
  g.beginPath(); g.moveTo(0, -14); g.lineTo(14, 0); g.lineTo(0, 14); g.lineTo(-14, 0); g.closePath(); g.fill()
  g.beginPath(); g.arc(28, 28, 5, 0, Math.PI * 2); g.fill()
  ;[[0, 160], [160, 0]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 4, 0, Math.PI * 2); g.fill() })
  g.restore()
}
// Navy ribbon banner with notched ends.
function ribbon(g, cx, y, w, h, text) {
  const x0 = cx - w / 2, x1 = cx + w / 2, n = h * 0.42
  g.fillStyle = NAVY2
  ;[[x0 - 40, x0 + 6], [x1 + 40, x1 - 6]].forEach(([outer, inner]) => {
    g.beginPath(); g.moveTo(inner, y + 10); g.lineTo(outer, y + 10); g.lineTo(outer + (outer < cx ? n : -n), y + 10 + h / 2)
    g.lineTo(outer, y + 10 + h); g.lineTo(inner, y + 10 + h); g.closePath(); g.fill()
  })
  const gr = g.createLinearGradient(0, y, 0, y + h)
  gr.addColorStop(0, '#16305A'); gr.addColorStop(1, NAVY)
  g.fillStyle = gr; g.fillRect(x0, y, w, h)
  g.strokeStyle = GOLD; g.lineWidth = 1.6
  g.strokeRect(x0 + 6, y + 6, w - 12, h - 12)
  g.fillStyle = GOLD_LIGHT; g.textAlign = 'center'
  fit(g, text, w - 80, 26, CINZEL, '700')
  spaced(g, text, cx, y + h / 2 + 9, 4)
}
// Gold rosette seal with ribbon tails; value in the middle.
function seal(g, cx, cy, r, value, label) {
  g.fillStyle = NAVY2
  ;[-1, 1].forEach(s => {
    g.beginPath(); g.moveTo(cx + s * r * 0.25, cy + r * 0.5); g.lineTo(cx + s * r * 0.8, cy + r * 1.45)
    g.lineTo(cx + s * r * 0.55, cy + r * 1.3); g.lineTo(cx + s * r * 0.38, cy + r * 1.55); g.lineTo(cx - s * r * 0.05, cy + r * 0.6); g.closePath(); g.fill()
  })
  const pts = 36
  g.beginPath()
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.9
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
  gr.addColorStop(0, '#F6E7B8'); gr.addColorStop(0.55, GOLD_LIGHT); gr.addColorStop(1, GOLD_DEEP)
  g.fillStyle = gr; g.fill()
  g.beginPath(); g.arc(cx, cy, r * 0.74, 0, Math.PI * 2)
  const inner = g.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r * 0.74)
  inner.addColorStop(0, NAVY2); inner.addColorStop(1, NAVY)
  g.fillStyle = inner; g.fill()
  g.strokeStyle = GOLD_LIGHT; g.lineWidth = 2
  g.beginPath(); g.arc(cx, cy, r * 0.68, 0, Math.PI * 2); g.stroke()
  g.textAlign = 'center'; g.fillStyle = '#F6E7B8'
  fit(g, value, r * 1.15, r * 0.48, CINZEL, '800')
  g.fillText(value, cx, cy + r * 0.12)
  if (label) {
    g.fillStyle = GOLD_LIGHT
    fit(g, label, r * 0.82, r * 0.15, CINZEL, '700')
    spaced(g, label, cx, cy + r * 0.38, 1)
  }
}

/**
 * Draws the certificate and returns the canvas (2000 × 1414, A4 landscape).
 * opts: {
 *   kind: 'Excellence' | 'Appreciation' | …   (script line under CERTIFICATE)
 *   subtitle: 'Best Student of the Month · Attendance'   (ribbon)
 *   presented: 'This certificate is proudly presented to'
 *   name, detail: 'GCC No. 925 · Foundation · Udaan',
 *   body: ['has achieved …', '…'],
 *   seal: { value: '100%', label: 'ATTENDANCE' },
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

  // ── parchment ──
  const bg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7)
  bg.addColorStop(0, '#FFFDF7'); bg.addColorStop(1, '#F3EBD8')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // guilloche: fine interlaced gold waves
  g.lineWidth = 1
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = `rgba(184,145,63,${k % 2 ? 0.05 : 0.07})`
    g.beginPath()
    for (let x = 120; x <= W - 120; x += 6) {
      const y = 140 + k * 44 + Math.sin(x / 70 + k * 0.7) * 16 + Math.sin(x / 23 + k) * 4
      x === 120 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
  }
  // crest watermark
  if (logo) { g.save(); g.globalAlpha = 0.035; g.drawImage(logo, W / 2 - 300, H / 2 - 250, 600, 600); g.restore() }

  // ── frame ──
  g.fillStyle = NAVY
  g.fillRect(28, 28, W - 56, 40); g.fillRect(28, H - 68, W - 56, 40); g.fillRect(28, 28, 40, H - 56); g.fillRect(W - 68, 28, 40, H - 56)
  g.strokeStyle = GOLD; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44)
  g.lineWidth = 2; g.strokeRect(74, 74, W - 148, H - 148)
  g.lineWidth = 1; g.strokeRect(86, 86, W - 172, H - 172)
  // dotted gold pattern in the navy band
  g.fillStyle = 'rgba(226,197,126,.55)'
  for (let x = 60; x < W - 60; x += 18) { g.beginPath(); g.arc(x, 48, 1.6, 0, 7); g.fill(); g.beginPath(); g.arc(x, H - 48, 1.6, 0, 7); g.fill() }
  for (let y = 60; y < H - 60; y += 18) { g.beginPath(); g.arc(48, y, 1.6, 0, 7); g.fill(); g.beginPath(); g.arc(W - 48, y, 1.6, 0, 7); g.fill() }
  cornerOrnament(g, 100, 100, 1, 1); cornerOrnament(g, W - 100, 100, -1, 1)
  cornerOrnament(g, 100, H - 100, 1, -1); cornerOrnament(g, W - 100, H - 100, -1, -1)

  // ── header: crest + institute ──
  const cx = W / 2
  if (logo) {
    g.save(); g.beginPath(); g.arc(cx, 186, 66, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip()
    g.drawImage(logo, cx - 62, 124, 124, 124); g.restore()
  }
  g.strokeStyle = goldGradient(g, cx - 72, cx + 72); g.lineWidth = 5
  g.beginPath(); g.arc(cx, 186, 70, 0, Math.PI * 2); g.stroke()
  g.textAlign = 'center'; g.fillStyle = NAVY
  fit(g, inst.name.toUpperCase(), W - 520, 44, CINZEL, '700')
  spaced(g, inst.name.toUpperCase(), cx, 318, 5)
  g.fillStyle = MUTED; g.font = `italic 500 28px ${CORMORANT}`
  g.fillText(inst.address, cx, 356)
  flourish(g, cx, 384, 210)

  // ── title ──
  g.fillStyle = goldGradient(g, cx - 520, cx + 520)
  g.font = `800 118px ${CINZEL}`
  g.save(); g.shadowColor = 'rgba(140,106,34,.25)'; g.shadowOffsetY = 3; g.shadowBlur = 4
  spaced(g, 'CERTIFICATE', cx, 512, 18); g.restore()
  g.fillStyle = NAVY; g.font = `400 92px ${SCRIPT}`
  g.fillText(`of ${opts.kind || 'Excellence'}`, cx, 600)
  if (opts.subtitle) ribbon(g, cx, 636, Math.min(1040, Math.max(640, opts.subtitle.length * 21)), 62, opts.subtitle.toUpperCase())

  // ── recipient ──
  g.fillStyle = INK; g.font = `italic 500 34px ${CORMORANT}`
  g.fillText(opts.presented || 'This certificate is proudly presented to', cx, 766)
  g.fillStyle = NAVY
  fit(g, opts.name || '', W - 560, 96, PLAYFAIR, '800')
  g.fillText(opts.name || '', cx, 868)
  const nw = Math.min(W - 560, g.measureText(opts.name || '').width)
  flourish(g, cx, 900, Math.max(260, nw / 2 + 80))
  let y = 952
  if (opts.detail) {
    g.fillStyle = NAVY2; fit(g, opts.detail, W - 600, 32, CORMORANT, '700')
    g.fillText(opts.detail, cx, y); y += 46
  }
  g.fillStyle = INK
  for (const line of opts.body || []) { fit(g, line, W - 640, 32, CORMORANT, '500'); g.fillText(line, cx, y); y += 42 }

  // ── seal ──
  if (opts.seal) seal(g, cx, Math.max(1140, y + 92), 92, String(opts.seal.value), opts.seal.label)

  // ── signatures ──
  const sigs = opts.signatures || [{ title: 'Principal' }, { title: 'Founder & Director' }]
  ;[[430, sigs[0]], [W - 430, sigs[1]]].forEach(([sx, s]) => {
    if (!s) return
    g.strokeStyle = goldGradient(g, sx - 190, sx + 190); g.lineWidth = 2
    g.beginPath(); g.moveTo(sx - 190, 1200); g.lineTo(sx + 190, 1200); g.stroke()
    g.textAlign = 'center'; g.fillStyle = NAVY
    fit(g, s.title.toUpperCase(), 380, 24, CINZEL, '700'); spaced(g, s.title.toUpperCase(), sx, 1236, 3)
    if (s.name) { g.fillStyle = MUTED; fit(g, s.name, 380, 26, CORMORANT, 'italic 600'); g.fillText(s.name, sx, 1270) }
  })

  // ── issue date and number ──
  // under the two signature columns, clear of the corner ornaments
  const issued = (opts.issued || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  g.textAlign = 'center'; g.fillStyle = MUTED; g.font = `600 19px ${CINZEL}`
  spaced(g, `ISSUED ${issued.toUpperCase()}`, 430, 1306, 2)
  if (opts.certNo) spaced(g, `NO. ${opts.certNo}`, W - 430, 1306, 2)
  return c
}

/** Downloads the certificate canvas as an A4-landscape PDF. */
export function certificatePdf(canvas, fileName) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210)
  doc.save(fileName)
}

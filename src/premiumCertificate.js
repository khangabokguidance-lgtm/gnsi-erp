// premiumCertificate.js — the GNSI premium certificate (A4 landscape).
//
// One design for every certificate the portal issues: Attendance "Best
// Student of the Month", Hostel "Housemaster of the Month" and the Awards
// categories. Award-certificate layout: a navy wave across the top with a
// gold swoosh, "CERTIFICATE / OF EXCELLENCE" in gold and white, a navy band
// down the left carrying a gold award medal (score and year), right-aligned
// wording with the name in script on a line, two signature lines with the
// institute crest emblem and a wax seal between, the issue date and a
// certificate number.
//
//   const canvas = await drawPremiumCertificate({ … })
//   canvas.toDataURL('image/jpeg', .95)        → image
//   certificatePdf(canvas, 'Certificate.pdf')  → A4 PDF download
import jsPDF from 'jspdf'
import { LOGO_BASE64 } from './logo'
import { getInstitute } from './systemSettings'

const GOLD = '#B8913F', GOLD_LIGHT = '#E2C57E', GOLD_DEEP = '#8C6A22', MUTED = '#6B7280'

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&display=swap'
const CINZEL = '"Cinzel", "Trajan Pro", Georgia, serif'
const CORMORANT = '"Cormorant Garamond", Georgia, serif'
const SCRIPT = '"Great Vibes", "Brush Script MT", "Segoe Script", Georgia, serif'

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
        '600 40px "Cormorant Garamond"', '400 40px "Great Vibes"']
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
// Gold award medal: scalloped rim, gold face, ribbon tails; script "Best",
// the value, and the year — as on a classic award certificate.
function medal(g, cx, cy, r, { top = 'Best', value, label, year }) {
  // ribbon tails
  ;[-1, 1].forEach(s => {
    const gr = g.createLinearGradient(cx, cy, cx + s * r, cy + r * 1.8)
    gr.addColorStop(0, GOLD_DEEP); gr.addColorStop(0.5, GOLD_LIGHT); gr.addColorStop(1, GOLD)
    g.fillStyle = gr
    g.beginPath(); g.moveTo(cx + s * r * 0.15, cy + r * 0.55); g.lineTo(cx + s * r * 0.95, cy + r * 1.85)
    g.lineTo(cx + s * r * 0.62, cy + r * 1.7); g.lineTo(cx + s * r * 0.45, cy + r * 2.05); g.lineTo(cx - s * r * 0.25, cy + r * 0.7); g.closePath(); g.fill()
  })
  // scalloped rim
  const n = 30
  g.beginPath()
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2
    const rr = r * (0.94 + 0.06 * Math.cos(a * n))
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  const rim = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
  rim.addColorStop(0, '#FFF3C4'); rim.addColorStop(0.5, '#E3B94E'); rim.addColorStop(1, '#9A6E14')
  g.fillStyle = rim; g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6; g.fill(); g.restore()
  // face
  g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
  const face = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r * 0.8)
  face.addColorStop(0, '#FFF6D2'); face.addColorStop(0.6, '#EAC35C'); face.addColorStop(1, '#B88A24')
  g.fillStyle = face; g.fill()
  g.strokeStyle = 'rgba(122,86,16,.55)'; g.lineWidth = 2.5
  g.beginPath(); g.arc(cx, cy, r * 0.74, 0, Math.PI * 2); g.stroke()
  g.textAlign = 'center'; g.fillStyle = '#3A2A08'
  g.font = `400 ${Math.round(r * 0.36)}px ${SCRIPT}`; g.fillText(top, cx, cy - r * 0.22)
  fit(g, value, r * 1.2, r * 0.42, CINZEL, '800'); g.fillText(value, cx, cy + r * 0.2)
  if (label) { fit(g, label, r * 1.05, r * 0.15, CINZEL, '700'); spaced(g, label, cx, cy + r * 0.4, 1) }
  if (year) { g.font = `800 ${Math.round(r * 0.2)}px ${CINZEL}`; g.fillText(year, cx, cy + r * 0.62) }
}

// Round emblem: the institute crest in a laurel ring with stars.
function emblem(g, cx, cy, r, logo) {
  g.strokeStyle = '#2B3445'; g.fillStyle = '#2B3445'; g.lineWidth = 2
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.arc(cx, cy, r * 0.86, 0, Math.PI * 2); g.stroke()
  for (let i = 0; i < 9; i++) { // laurel leaves round the lower half
    ;[-1, 1].forEach(s => {
      const a = Math.PI / 2 + s * (0.35 + i * 0.27)
      const x = cx + Math.cos(a) * r * 1.12, y = cy + Math.sin(a) * r * 1.12
      g.save(); g.translate(x, y); g.rotate(a + s * 0.9); g.beginPath(); g.ellipse(0, 0, r * 0.13, r * 0.05, 0, 0, Math.PI * 2); g.fill(); g.restore()
    })
  }
  if (logo) { g.save(); g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.clip(); g.drawImage(logo, cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6); g.restore() }
  g.textAlign = 'center'; g.font = `700 ${Math.round(r * 0.22)}px ${CINZEL}`
  ;[-1, 0, 1].forEach(k => g.fillText('★', cx + k * r * 0.28, cy - r * 1.05))
}

// Red wax seal with a ribbon banner.
function waxSeal(g, cx, cy, r, text) {
  g.fillStyle = '#1F2937'
  g.beginPath(); g.moveTo(cx - r * 1.5, cy + r * 0.55); g.lineTo(cx + r * 1.5, cy + r * 0.55); g.lineTo(cx + r * 1.3, cy + r * 0.9); g.lineTo(cx + r * 1.5, cy + r * 1.2)
  g.lineTo(cx - r * 1.5, cy + r * 1.2); g.lineTo(cx - r * 1.3, cy + r * 0.9); g.closePath(); g.fill()
  g.beginPath()
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2, rr = r * (0.93 + 0.07 * Math.sin(a * 11) * Math.cos(a * 3))
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
  gr.addColorStop(0, '#E0473F'); gr.addColorStop(1, '#8E1B17')
  g.fillStyle = gr; g.fill()
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2
  g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#FFE9E4'; g.textAlign = 'center'
  fit(g, text, r * 1.1, r * 0.36, CINZEL, '800'); g.fillText(text, cx, cy + r * 0.13)
  g.fillStyle = '#fff'; g.font = `700 ${Math.round(r * 0.22)}px ${CINZEL}`; g.fillText('SEAL', cx, cy + r * 1.0)
}

/**
 * Draws the certificate and returns the canvas (2000 × 1414, A4 landscape).
 * opts: {
 *   kind: 'Excellence' | 'Appreciation' | …   ("OF EXCELLENCE" under CERTIFICATE)
 *   subtitle: 'Best Student of the Month · Attendance'
 *   presented: 'This certificate is proudly presented to'
 *   name, detail: 'GCC No. 925 · Foundation · Udaan',
 *   body: ['has achieved …', '…'],
 *   seal: { value: '100%', label: 'ATTENDANCE' },        (gold award medal)
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
  const issuedDate = opts.issued || new Date()

  // ── silver-white paper with fine wave lines ──
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#ECEFF4')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.lineWidth = 1.1
  for (let k = 0; k < 70; k++) {
    g.strokeStyle = k % 2 ? 'rgba(148,163,184,.16)' : 'rgba(148,163,184,.10)'
    g.beginPath()
    g.ellipse(W * 0.95, H * 1.05, 220 + k * 26, 140 + k * 20, -0.25, Math.PI, Math.PI * 1.6)
    g.stroke()
  }

  // ── navy wave across the top, gold swoosh under it ──
  const navyGr = g.createLinearGradient(0, 0, W, 520)
  navyGr.addColorStop(0, '#0E2550'); navyGr.addColorStop(0.55, '#173B70'); navyGr.addColorStop(1, '#1E4A86')
  g.fillStyle = navyGr
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 210)
  g.bezierCurveTo(W * 0.78, 190, W * 0.55, 230, W * 0.36, 380)
  g.bezierCurveTo(W * 0.24, 470, W * 0.1, 520, 0, 510); g.closePath(); g.fill()
  // lighter navy layer for depth
  g.fillStyle = 'rgba(46,92,156,.35)'
  g.beginPath(); g.moveTo(W, 210); g.bezierCurveTo(W * 0.78, 190, W * 0.55, 230, W * 0.36, 380)
  g.bezierCurveTo(W * 0.5, 300, W * 0.72, 262, W, 300); g.closePath(); g.fill()
  // gold swoosh
  const sw = g.createLinearGradient(W * 0.55, 0, W, 0)
  sw.addColorStop(0, 'rgba(184,145,63,0)'); sw.addColorStop(0.35, GOLD); sw.addColorStop(0.7, '#F1D58A'); sw.addColorStop(1, GOLD_DEEP)
  g.fillStyle = sw
  g.beginPath(); g.moveTo(W * 0.55, 300); g.bezierCurveTo(W * 0.72, 250, W * 0.88, 262, W, 300)
  g.lineTo(W, 360); g.bezierCurveTo(W * 0.9, 300, W * 0.74, 280, W * 0.55, 300); g.closePath(); g.fill()
  g.fillStyle = 'rgba(255,255,255,.55)'
  g.beginPath(); g.moveTo(W * 0.6, 292); g.bezierCurveTo(W * 0.76, 256, W * 0.9, 268, W, 302)
  g.lineTo(W, 308); g.bezierCurveTo(W * 0.9, 274, W * 0.76, 264, W * 0.6, 292); g.closePath(); g.fill()

  // ── title on the navy ──
  g.textAlign = 'left'
  const titleX = 120
  g.fillStyle = goldGradient(g, titleX, titleX + 760)
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowOffsetY = 4; g.shadowBlur = 6
  g.font = `700 150px ${CINZEL}`; g.fillText('C', titleX, 230)
  const cw = g.measureText('C').width
  g.font = `700 112px ${CINZEL}`; g.fillText('ERTIFICATE', titleX + cw + 2, 230)
  g.restore()
  g.fillStyle = '#FFFFFF'; g.font = `600 44px ${CINZEL}`
  spaced(g, `OF ${(opts.kind || 'Excellence').toUpperCase()}`, titleX + 6, 300, 6)
  // institute on the right of the navy
  g.textAlign = 'right'
  if (logo) {
    g.save(); g.beginPath(); g.arc(W - 170, 110, 62, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip()
    g.drawImage(logo, W - 228, 52, 116, 116); g.restore()
    g.strokeStyle = GOLD_LIGHT; g.lineWidth = 4; g.beginPath(); g.arc(W - 170, 110, 64, 0, Math.PI * 2); g.stroke()
  }
  g.fillStyle = GOLD_LIGHT
  fit(g, inst.name.toUpperCase(), 620, 26, CINZEL, '700'); spaced(g, inst.name.toUpperCase(), W - 260, 104, 2)
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `italic 500 24px ${CORMORANT}`
  g.fillText(inst.address, W - 262, 140)

  // ── navy band on the left with gold rules, and the award medal ──
  const bx = 300, bw = 170
  const band = g.createLinearGradient(bx, 0, bx + bw, 0)
  band.addColorStop(0, '#0E2550'); band.addColorStop(0.5, '#1E4A86'); band.addColorStop(1, '#0E2550')
  g.fillStyle = band; g.fillRect(bx, 420, bw, H - 420)
  g.fillStyle = GOLD; g.fillRect(bx - 16, 440, 5, H - 440); g.fillRect(bx + bw + 11, 440, 5, H - 440)
  const year = String(issuedDate.getFullYear())
  if (opts.seal) medal(g, bx + bw / 2, 860, 175, { top: 'Best', value: String(opts.seal.value), label: opts.seal.label, year })

  // ── wording, right side ──
  const rx = W - 160, lx = 700 // right edge and left edge of the text block
  g.textAlign = 'right'; g.fillStyle = '#1F2937'; g.font = `600 34px ${CINZEL}`
  const presented = (opts.presented || 'This certificate is proudly presented to').toUpperCase()
  // split the presented line into two, like the reference layout
  const words = presented.split(' '), half = Math.ceil(words.length / 2)
  spaced(g, words.slice(0, half).join(' '), rx, 470, 2)
  spaced(g, words.slice(half).join(' '), rx, 516, 2)
  // name in script on a line
  g.textAlign = 'center'
  const nameCx = (lx + rx) / 2
  g.fillStyle = '#111827'
  fit(g, opts.name || '', rx - lx - 40, 124, SCRIPT, '400')
  g.fillText(opts.name || '', nameCx, 680)
  g.strokeStyle = '#1F2937'; g.lineWidth = 2.5
  g.beginPath(); g.moveTo(lx, 712); g.lineTo(rx, 712); g.stroke()
  // subtitle + details + body, right-aligned
  g.textAlign = 'right'
  let y = 790
  if (opts.subtitle) {
    g.fillStyle = '#0E2550'; fit(g, opts.subtitle.toUpperCase(), rx - lx, 40, CINZEL, '700')
    spaced(g, opts.subtitle.toUpperCase(), rx, y, 2); y += 54
  }
  if (opts.detail) {
    g.fillStyle = GOLD_DEEP; fit(g, opts.detail, rx - lx, 34, CORMORANT, '700')
    g.fillText(opts.detail, rx, y); y += 46
  }
  g.fillStyle = '#374151'
  for (const line of opts.body || []) { fit(g, line.toUpperCase(), rx - lx, 26, CINZEL, '600'); g.fillText(line.toUpperCase(), rx, y); y += 40 }

  // ── signatures with the crest emblem and the wax seal between ──
  const sigY = 1210
  const sigs = opts.signatures || [{ title: 'Principal' }, { title: 'Head of the Institution' }]
  ;[[lx + 170, sigs[0]], [rx - 170, sigs[1]]].forEach(([sx, sgn]) => {
    if (!sgn) return
    g.strokeStyle = '#4B5563'; g.lineWidth = 2
    g.beginPath(); g.moveTo(sx - 170, sigY); g.lineTo(sx + 170, sigY); g.stroke()
    g.textAlign = 'center'; g.fillStyle = '#1F2937'
    fit(g, sgn.title.toUpperCase(), 330, 26, CINZEL, '700'); spaced(g, sgn.title.toUpperCase(), sx, sigY + 40, 2)
    if (sgn.name) { g.fillStyle = MUTED; fit(g, sgn.name, 340, 26, CORMORANT, 'italic 600'); g.fillText(sgn.name, sx, sigY + 74) }
  })
  emblem(g, nameCx - 95, sigY - 40, 62, logo)
  waxSeal(g, nameCx + 95, sigY - 48, 58, 'GNSI')

  // ── issue date and number ──
  const issued = issuedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  g.fillStyle = MUTED; g.font = `600 20px ${CINZEL}`; g.textAlign = 'right'
  spaced(g, `ISSUED ${issued.toUpperCase()}${opts.certNo ? `   ·   NO. ${opts.certNo}` : ''}`, rx, H - 60, 2)
  g.textAlign = 'center'
  return c
}


// ── Formal "Heritage" design helpers ────────────────────────────────────────
const FF = '/design-studio/fonts/'
let formalFontsReady = null
/** Bundled fonts (work offline): Cinzel, Playfair Display italic, Pinyon Script. */
function loadFormalFonts() {
  if (formalFontsReady) return formalFontsReady
  const faces = [
    ['Cinzel', 'cinzel-latin-600-normal.woff2', '600'], ['Cinzel', 'cinzel-latin-700-normal.woff2', '700'], ['Cinzel', 'cinzel-latin-800-normal.woff2', '800'],
    ['Playfair Display', 'playfair-display-latin-400-italic.woff2', '400', 'italic'], ['Playfair Display', 'playfair-display-latin-700-italic.woff2', '700', 'italic'],
    ['Playfair Display', 'playfair-display-latin-700-normal.woff2', '700'], ['Pinyon Script', 'pinyon-script-latin-400-normal.woff2', '400'],
  ]
  formalFontsReady = Promise.race([
    Promise.all(faces.map(async ([fam, file, weight, style = 'normal']) => {
      try { const f = new FontFace(fam, `url(${FF}${file}) format('woff2')`, { weight, style }); await f.load(); document.fonts.add(f) } catch { /* falls back to serif */ }
    })),
    new Promise(res => setTimeout(res, 5000)),
  ])
  return formalFontsReady
}
const F_HEAD = '"Cinzel", "Trajan Pro", Georgia, serif'
const F_BODY = '"Playfair Display", Georgia, serif'
const F_SCRIPT = '"Pinyon Script", "Great Vibes", "Brush Script MT", Georgia, serif'

// Gold foil: a diagonal multi-stop gradient with bright highlights.
function foil(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1)
  ;[[0, '#7A5714'], [0.18, '#C9A24D'], [0.34, '#F7E7B0'], [0.5, '#B88A2C'], [0.66, '#F1D789'], [0.84, '#C9A24D'], [1, '#6E4E10']].forEach(([o, c]) => gr.addColorStop(o, c))
  return gr
}
// Guilloche rosette: interlaced loops plus fine concentric rings.
function rosette(g, x, y, R, color, alpha, loops = 44) {
  g.save(); g.translate(x, y); g.strokeStyle = color; g.lineWidth = 1; g.globalAlpha = alpha
  for (let i = 0; i < loops; i++) { g.save(); g.rotate((i / loops) * Math.PI); g.beginPath(); g.ellipse(0, 0, R, R * 0.34, 0, 0, Math.PI * 2); g.stroke(); g.restore() }
  for (let r = R * 0.18; r <= R; r += R * 0.09) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke() }
  g.restore()
}
// Ornamental rule: fading line, centre diamond and two small side diamonds.
function flourish(g, cx, y, half, gold) {
  const gr = g.createLinearGradient(cx - half, 0, cx + half, 0)
  gr.addColorStop(0, 'rgba(184,138,44,0)'); gr.addColorStop(0.25, '#B88A2C'); gr.addColorStop(0.5, '#F1D789'); gr.addColorStop(0.75, '#B88A2C'); gr.addColorStop(1, 'rgba(184,138,44,0)')
  g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - half, y); g.lineTo(cx + half, y); g.stroke()
  const dia = (x, s) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill() }
  g.fillStyle = gold; dia(cx, 11); dia(cx - 46, 6); dia(cx + 46, 6)
}
// Starburst gold seal with ribbon tails.
function goldSeal(g, cx, cy, r, line1, line2) {
  ;[-1, 1].forEach(s => { // ribbon tails
    g.fillStyle = s < 0 ? '#0E2550' : '#173B70'
    g.beginPath(); g.moveTo(cx + s * r * 0.15, cy + r * 0.5); g.lineTo(cx + s * r * 0.85, cy + r * 1.75); g.lineTo(cx + s * r * 0.5, cy + r * 1.55)
    g.lineTo(cx + s * r * 0.2, cy + r * 1.8); g.lineTo(cx - s * r * 0.15 + s * r * 0.05, cy + r * 0.5); g.closePath(); g.fill()
    g.strokeStyle = '#C9A24D'; g.lineWidth = 2; g.stroke()
  })
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 8
  g.beginPath()
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2, rr = i % 2 ? r * 0.93 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) }
  g.closePath(); g.fillStyle = foil(g, cx - r, cy - r, cx + r, cy + r); g.fill(); g.restore()
  g.strokeStyle = 'rgba(90,62,10,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.stroke()
  const face = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r * 0.78)
  face.addColorStop(0, '#1F4685'); face.addColorStop(1, '#0A1B42')
  g.fillStyle = face; g.beginPath(); g.arc(cx, cy, r * 0.72, 0, Math.PI * 2); g.fill()
  g.strokeStyle = foil(g, cx - r, cy, cx + r, cy); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r * 0.64, 0, Math.PI * 2); g.stroke()
  g.fillStyle = foil(g, cx - r, cy - r, cx + r, cy + r); g.textAlign = 'center'
  g.font = `700 ${Math.round(r * 0.2)}px ${F_HEAD}`; g.fillText('★ ★ ★', cx, cy - r * 0.3)
  g.font = `800 ${Math.round(r * 0.36)}px ${F_HEAD}`; g.fillText(line1, cx, cy + r * 0.1)
  g.font = `600 ${Math.round(r * 0.14)}px ${F_HEAD}`; g.fillText(line2, cx, cy + r * 0.38)
}

/**
 * The formal "Heritage" design (A4 landscape, 2000 × 1414): navy frame with a
 * gold-foil rule, ivory security paper with guilloche rosettes in the corners
 * and behind the text, a crest medallion over the top edge, gold-foil title,
 * script name, ornamental rules, and a starburst gold seal with ribbon tails
 * between the two signatures. Same opts as drawPremiumCertificate. It carries
 * the institute's own crest and seal only — no national emblem, and no claim
 * that a government body issued it.
 */
export async function drawFormalCertificate(opts) {
  await Promise.all([loadFonts(), loadFormalFonts()])
  const inst = getInstitute({ name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur — 795134' })
  const W = 2000, H = 1414, cx = W / 2
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const logo = await loadImage(`data:image/png;base64,${LOGO_BASE64}`)
  const issuedDate = opts.issued || new Date()
  const NAVY = '#0F2A5C', INK = '#1B2433'
  const gold = foil(g, 0, 0, W, H)

  // navy frame with engraved gold hatch
  const fr = g.createLinearGradient(0, 0, W, H); fr.addColorStop(0, '#0A1B42'); fr.addColorStop(0.5, '#173B70'); fr.addColorStop(1, '#0A1B42')
  g.fillStyle = fr; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(226,197,126,.10)'; g.lineWidth = 1
  for (let d = -H; d < W; d += 14) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + H, H); g.stroke() }
  rosette(g, 0, 0, 330, '#E2C57E', 0.25, 36); rosette(g, W, 0, 330, '#E2C57E', 0.25, 36); rosette(g, 0, H, 330, '#E2C57E', 0.25, 36); rosette(g, W, H, 330, '#E2C57E', 0.25, 36)

  // ivory panel with a gold-foil double rule
  const PX = 78, PY = 78, PW = W - 156, PH = H - 156
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.fillStyle = '#000'; g.fillRect(PX, PY, PW, PH); g.restore()
  const paper = g.createLinearGradient(PX, PY, PX + PW, PY + PH); paper.addColorStop(0, '#FFFEF8'); paper.addColorStop(0.5, '#FBF6E6'); paper.addColorStop(1, '#F3EAD0')
  g.fillStyle = paper; g.fillRect(PX, PY, PW, PH)
  g.save(); g.beginPath(); g.rect(PX, PY, PW, PH); g.clip()
  rosette(g, cx, H / 2 + 40, 700, NAVY, 0.07, 60)
  rosette(g, cx, H / 2 + 40, 430, '#B88A2C', 0.10, 40)
  ;[[PX, PY], [PX + PW, PY], [PX, PY + PH], [PX + PW, PY + PH]].forEach(([x, y]) => { rosette(g, x, y, 260, NAVY, 0.22, 48); rosette(g, x, y, 170, '#B88A2C', 0.45, 32) })
  if (logo) { g.globalAlpha = 0.045; g.drawImage(logo, cx - 300, H / 2 - 250, 600, 600); g.globalAlpha = 1 }
  g.restore()
  g.strokeStyle = gold; g.lineWidth = 7; g.strokeRect(PX + 22, PY + 22, PW - 44, PH - 44)
  g.lineWidth = 2; g.strokeRect(PX + 40, PY + 40, PW - 80, PH - 80)
  // corner studs
  ;[[PX + 22, PY + 22], [PX + PW - 22, PY + 22], [PX + 22, PY + PH - 22], [PX + PW - 22, PY + PH - 22]].forEach(([x, y]) => {
    g.fillStyle = gold; g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill()
    g.fillStyle = NAVY; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill()
  })

  // crest medallion over the top edge
  const my = 132
  g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 20; g.shadowOffsetY = 6
  g.fillStyle = gold; g.beginPath(); g.arc(cx, my, 112, 0, Math.PI * 2); g.fill(); g.restore()
  g.fillStyle = '#FFFEF8'; g.beginPath(); g.arc(cx, my, 100, 0, Math.PI * 2); g.fill()
  g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.arc(cx, my, 90, 0, Math.PI * 2); g.stroke()
  if (logo) { g.save(); g.beginPath(); g.arc(cx, my, 84, 0, Math.PI * 2); g.clip(); g.drawImage(logo, cx - 84, my - 84, 168, 168); g.restore() }

  // letterhead
  g.textAlign = 'center'
  g.fillStyle = NAVY; fit(g, inst.name.toUpperCase(), 1300, 44, F_HEAD, '800'); spaced(g, inst.name.toUpperCase(), cx, 306, 5)
  g.fillStyle = '#5B6678'; g.font = `italic 400 27px ${F_BODY}`; g.fillText(inst.address, cx, 346)
  // slim tricolour ribbon between gold rules
  ;[['#FF9933', 0], ['#FFFFFF', 1], ['#138808', 2]].forEach(([col, k]) => { g.fillStyle = col; g.fillRect(cx - 105 + k * 70, 366, 70, 7) })
  g.strokeStyle = 'rgba(15,42,92,.35)'; g.lineWidth = 1; g.strokeRect(cx - 105, 366, 210, 7)
  g.fillStyle = gold; g.fillRect(cx - 360, 369, 230, 2); g.fillRect(cx + 130, 369, 230, 2)

  // title, gold foil with an engraved shadow
  g.save(); g.shadowColor = 'rgba(80,55,8,.35)'; g.shadowOffsetY = 5; g.shadowBlur = 5
  g.fillStyle = foil(g, cx - 560, 410, cx + 560, 530); g.font = `800 124px ${F_HEAD}`; spaced(g, 'CERTIFICATE', cx, 500, 12); g.restore()
  g.fillStyle = NAVY; g.font = `700 42px ${F_HEAD}`
  spaced(g, `OF ${(opts.kind || 'Appreciation').toUpperCase()}`, cx, 562, 14)
  flourish(g, cx, 598, 420, gold)

  // wording
  g.fillStyle = '#3B4556'; g.font = `italic 400 34px ${F_BODY}`
  g.fillText(opts.presented || 'This certificate is proudly presented to', cx, 660)
  g.save(); g.shadowColor = 'rgba(15,42,92,.18)'; g.shadowOffsetY = 4; g.shadowBlur = 6
  g.fillStyle = '#0B1B3F'; fit(g, opts.name || '', 1350, 150, F_SCRIPT, '400'); g.fillText(opts.name || '', cx, 782); g.restore()
  flourish(g, cx, 836, 520, gold)
  let y = 892
  if (opts.subtitle) { g.fillStyle = NAVY; fit(g, opts.subtitle.toUpperCase(), 1400, 36, F_HEAD, '700'); spaced(g, opts.subtitle.toUpperCase(), cx, y, 4); y += 46 }
  if (opts.detail) { g.fillStyle = '#8C6A22'; fit(g, opts.detail, 1400, 32, F_BODY, 'italic 700'); g.fillText(opts.detail, cx, y); y += 44 }
  g.fillStyle = INK
  for (const [i, raw] of (opts.body || []).entries()) { const line = i === 0 ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw; fit(g, line, 1400, 28, F_BODY, 'italic 400'); g.fillText(line, cx, y); y += 38 }

  // signatures, with the gold seal between them
  const sigY = 1170, sigs = opts.signatures || [{ title: 'Principal' }, { title: 'Head of the Institution' }]
  ;[[420, sigs[0]], [W - 420, sigs[1]]].forEach(([sx, sgn]) => {
    if (!sgn) return
    g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.moveTo(sx - 210, sigY); g.lineTo(sx + 210, sigY); g.stroke()
    g.fillStyle = NAVY; fit(g, sgn.title.toUpperCase(), 400, 26, F_HEAD, '700'); spaced(g, sgn.title.toUpperCase(), sx, sigY + 42, 3)
    if (sgn.name) { g.fillStyle = '#5B6678'; g.font = `italic 400 25px ${F_BODY}`; g.fillText(sgn.name, sx, sigY + 78) }
  })
  goldSeal(g, cx, 1100, 72, 'GNSI', opts.seal ? `${opts.seal.label} ${opts.seal.value}`.trim() : 'AWARD')

  // issue line and micro-text security border
  const issued = issuedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  g.fillStyle = '#5B6678'; g.font = `600 19px ${F_HEAD}`
  spaced(g, `ISSUED ${issued.toUpperCase()}${opts.certNo ? `   ·   NO. ${opts.certNo}` : ''}`, cx, H - 150, 3)
  g.save(); g.fillStyle = 'rgba(15,42,92,.42)'; g.font = `600 11px ${F_HEAD}`
  const micro = `${inst.name.toUpperCase()} · AUTHENTIC · `.repeat(14)
  g.textAlign = 'center'; if ('letterSpacing' in g) g.letterSpacing = '2px'
  let mt = micro; while (mt.length > 20 && g.measureText(mt).width > 1380) mt = mt.slice(0, -4)
  g.fillText(mt, cx, H - 128); g.restore()
  return c
}

/** Downloads the certificate canvas as an A4-landscape PDF. */
export function certificatePdf(canvas, fileName) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210)
  doc.save(fileName)
}

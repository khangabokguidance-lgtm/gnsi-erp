// mayekDocx.js — reading English question papers (.docx / .txt) and writing
// the Meetei Mayek version as a Word document with the institute letterhead,
// a paper details block and a watermark behind the text on every page.
//
// Reading: a .docx is a zip; its paragraphs are read in document order
// (tables included) from word/document.xml. Automatic list numbers ("1.",
// "(a)") are not part of the paragraph text in Word, so they are rebuilt
// from word/numbering.xml — question papers rely on them.
//
// Writing (buildPaperDocx): from the paper model in mayekPaper.js, in three
// layouts ("Meetei Mayek", "Mayek + English", "Side by side"), one or two
// columns, with an instructions box, a marks column, and optional answer key
// and OMR sheet pages.
// The Meetei Mayek font (Noto Sans Meetei Mayek, SIL OFL) is embedded
// in the file, so it shows correctly on computers that do not have it. The
// watermark is a faded PNG (institute name or logo) anchored behind the text
// in the page header, so Word repeats it on every page.
import JSZip from 'jszip'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun,
  PageNumber, Packer, Paragraph, SectionType, Table, TableCell, TableRow, TabStopType, TextRun,
  VerticalAlign, VerticalPositionRelativeFrom, WidthType,
} from 'docx'
import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'
import { LETTERS, answerKey, numbered, optionsPerRow, answerLineCount, LOOKS } from './mayekPaper.js'

export const MAYEK_FONT = 'Noto Sans Meetei Mayek'
const LATIN_FONT = 'Calibri'
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
export const MAX_LINES = 800

// ── Reading ────────────────────────────────────────────────────────────────
const tidy = s => String(s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/ +$/gm, '').trim()

/** Lines of a plain-text paper. */
export function linesFromText(text) {
  return String(text || '').replace(/\r\n?/g, '\n').split('\n').map(tidy)
}

const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
const roman = n => ROMAN.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v } return s }, '')
const letter = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26) } return s }
function formatNumber(n, fmt) {
  switch (fmt) {
    case 'lowerLetter': return letter(n)
    case 'upperLetter': return letter(n).toUpperCase()
    case 'lowerRoman': return roman(n)
    case 'upperRoman': return roman(n).toUpperCase()
    case 'bullet': case 'none': return ''
    default: return String(n)
  }
}

// numId -> { [ilvl]: { fmt, text, start } }
function readNumbering(xml) {
  const out = {}
  if (!xml) return out
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const attr = (el, name) => el && (el.getAttributeNS(W_NS, name) ?? el.getAttribute('w:' + name))
  const child = (el, name) => el && Array.from(el.childNodes).find(c => c.localName === name)
  const abstract = {}
  for (const a of Array.from(doc.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
    const levels = {}
    for (const lvl of Array.from(a.getElementsByTagNameNS(W_NS, 'lvl'))) {
      levels[attr(lvl, 'ilvl')] = {
        fmt: attr(child(lvl, 'numFmt'), 'val') || 'decimal',
        text: attr(child(lvl, 'lvlText'), 'val') ?? '%1.',
        start: parseInt(attr(child(lvl, 'start'), 'val') || '1', 10),
      }
    }
    abstract[attr(a, 'abstractNumId')] = levels
  }
  for (const n of Array.from(doc.getElementsByTagNameNS(W_NS, 'num'))) {
    const levels = abstract[attr(child(n, 'abstractNumId'), 'val')]
    if (levels) out[attr(n, 'numId')] = levels
  }
  return out
}

/**
 * Paragraph texts of a .docx, in order, with list numbers put back.
 * Returns { lines, pictures } — pictures: how many images were left out.
 */
export async function linesFromDocx(data) {
  const zip = await JSZip.loadAsync(data)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) throw new Error('This is not a Word document (.docx).')
  const numbering = readNumbering(await zip.file('word/numbering.xml')?.async('string'))
  const doc = new DOMParser().parseFromString(docXml, 'application/xml')
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
  if (!body) return { lines: [], pictures: 0 }
  const attr = (el, name) => el && (el.getAttributeNS(W_NS, name) ?? el.getAttribute('w:' + name))
  const counters = {} // numId -> [count per level]
  const lines = []
  for (const p of Array.from(body.getElementsByTagNameNS(W_NS, 'p'))) {
    // Text boxes are stored twice (new format + fallback): read only the first copy.
    let skip = false
    for (let n = p.parentNode; n && n !== body; n = n.parentNode) if (n.localName === 'Fallback') { skip = true; break }
    if (skip) continue
    let text = ''
    const walk = el => {
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType !== 1) continue
        if (c.localName === 'pPr' || c.localName === 'rPr' || c.localName === 'txbxContent' || c.localName === 'Fallback') continue
        if (c.localName === 't') text += c.textContent
        else if (c.localName === 'tab') text += ' '
        else if (c.localName === 'br' || c.localName === 'cr') text += ' '
        else if (c.localName === 'p') continue // nested paragraph (text box): visited on its own
        else walk(c)
      }
    }
    walk(p)
    let label = ''
    const numPr = p.getElementsByTagNameNS(W_NS, 'numPr')[0]
    if (numPr) {
      const numId = attr(numPr.getElementsByTagNameNS(W_NS, 'numId')[0], 'val')
      const ilvl = parseInt(attr(numPr.getElementsByTagNameNS(W_NS, 'ilvl')[0], 'val') || '0', 10)
      const levels = numbering[numId]
      if (levels && levels[ilvl]) {
        const c = counters[numId] || (counters[numId] = [])
        c[ilvl] = (c[ilvl] ?? (levels[ilvl].start - 1)) + 1
        c.length = ilvl + 1 // a new item resets deeper levels
        label = levels[ilvl].text.replace(/%(\d)/g, (_, k) => {
          const lv = parseInt(k, 10) - 1
          const v = c[lv] ?? levels[lv]?.start ?? 1
          return formatNumber(v, levels[lv]?.fmt)
        })
      }
    }
    const t = tidy(text)
    lines.push(label && t ? `${label} ${t}` : t)
  }
  const pictures = doc.getElementsByTagNameNS(W_NS, 'drawing').length + doc.getElementsByTagName('w:pict').length
  return { lines, pictures }
}

/** Read an uploaded file: .docx or plain text. Returns { lines, pictures }. */
export async function readPaperFile(file) {
  const name = (file?.name || '').toLowerCase()
  if (name.endsWith('.doc')) throw new Error('Old Word files (.doc) cannot be read. Open it in Word and "Save As" .docx first.')
  if (name.endsWith('.docx')) return linesFromDocx(await file.arrayBuffer())
  if (name.endsWith('.txt') || (file.type || '').startsWith('text/')) return { lines: linesFromText(await file.text()), pictures: 0 }
  throw new Error('Choose a Word (.docx) or text (.txt) file.')
}

/** Drop leading/trailing blank lines and squeeze runs of blank lines to one. */
export function cleanLines(lines) {
  const out = []
  for (const l of lines || []) { if (!l && (!out.length || !out[out.length - 1])) continue; out.push(l) }
  while (out.length && !out[out.length - 1]) out.pop()
  return out
}

// ── Watermark ────────────────────────────────────────────────────────────────
async function loadImage(src) {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}
const dataUrlBytes = async url => new Uint8Array(await (await fetch(url)).arrayBuffer())

/**
 * Faded watermark as a PNG data URL: the institute name set diagonally, or
 * the logo. The logo's light parts become faint ink and its dark background
 * is dropped, so it reads as a mark on the paper, not a grey box.
 * `strength` 0–1 sets how visible it is.
 */
export async function watermarkDataUrl({ kind, text, logoSrc, strength = 0.5, color = [19, 42, 79] }) {
  const size = 1400
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const alpha = 0.05 + 0.13 * Math.max(0, Math.min(1, strength))
  if (kind === 'logo' && logoSrc) {
    const img = await loadImage(logoSrc)
    const s = size * 0.8, r = Math.min(s / img.width, s / img.height)
    g.drawImage(img, (size - img.width * r) / 2, (size - img.height * r) / 2, img.width * r, img.height * r)
    const px = g.getImageData(0, 0, size, size), d = px.data
    const lumAt = i => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    // Light pixels joined to the picture's edge are its margin, not part of the mark.
    const margin = new Uint8Array(size * size), stack = []
    for (let k = 0; k < size; k++) stack.push(k, (size - 1) * size + k, k * size, k * size + size - 1)
    while (stack.length) {
      const q = stack.pop()
      if (margin[q]) continue
      const i = q * 4
      if (d[i + 3] && lumAt(i) < 0.8) continue
      margin[q] = 1
      const x = q % size
      if (x > 0) stack.push(q - 1)
      if (x < size - 1) stack.push(q + 1)
      if (q >= size) stack.push(q - size)
      if (q < size * (size - 1)) stack.push(q + size)
    }
    for (let i = 0; i < d.length; i += 4) {
      const ink = d[i + 3] && !margin[i / 4] ? Math.max(0, (lumAt(i) - 0.45) / 0.55) : 0
      d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]
      d[i + 3] = Math.round(255 * alpha * 1.6 * ink)
    }
    g.putImageData(px, 0, 0)
  } else {
    const words = String(text || '').trim().toUpperCase() || 'CONFIDENTIAL'
    g.translate(size / 2, size / 2)
    g.rotate(-Math.PI / 4)
    g.globalAlpha = alpha
    g.fillStyle = `rgb(${color.join(',')})`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const setFont = f => { g.font = `700 ${f}px Georgia, 'Times New Roman', serif` }
    setFont(100)
    // Fill the diagonal: about 1.2 × the square's side, never taller than a third of it.
    const font = Math.min(size / 3, 100 * (size * 1.2) / g.measureText(words).width)
    setFont(font)
    g.fillText(words, 0, 0)
  }
  return c.toDataURL('image/png')
}

// ── Writing ──────────────────────────────────────────────────────────────────
const NAVY = '132A4F', GOLD = 'B8923A', GREY = '5D6B82', INK = '0F1B2E', LINE = 'E8E3D8'
const fontBytes = () => Uint8Array.from(atob(NotoSansMeeteiMayek), ch => ch.charCodeAt(0))
const hasMayek = s => /[ꯀ-꯿]/.test(s || '')
// Meetei Mayek runs in the Mayek font, everything else (numbers, labels) in the Latin one.
function runs(text, { size, bold, color, italics }) {
  const parts = String(text || '').match(/[ꯀ-꯿]+(?:\s+[ꯀ-꯿]+)*|[^ꯀ-꯿]+/g) || []
  return parts.map(p => new TextRun({
    text: p, size, bold, italics, color,
    font: hasMayek(p) ? { ascii: MAYEK_FONT, hAnsi: MAYEK_FONT, cs: MAYEK_FONT } : LATIN_FONT,
  }))
}
const latin = (text, o = {}) => new TextRun({ text, font: LATIN_FONT, ...o })
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const thin = (color = LINE) => ({ style: BorderStyle.SINGLE, size: 4, color })
const boxBorders = c => ({ top: thin(c), bottom: thin(c), left: thin(c), right: thin(c) })

// Page geometry (twips): A4 with 1000-twip margins leaves 9906 for text.
const PAGE = { margin: { top: 1000, bottom: 900, left: 1000, right: 1000, header: 450, footer: 450 } }
const FULL = 9900, GAP = 425
const widthFor = columns => (columns === 2 ? Math.floor((FULL - GAP) / 2) : FULL)

function letterhead(inst, logo) {
  const contact = [inst.phone, inst.email, inst.website].filter(Boolean).join('   ·   ')
  const textCol = [
    new Paragraph({ spacing: { after: 20 }, children: [latin(inst.name || '', { bold: true, size: 34, color: NAVY })] }),
    inst.tagline ? new Paragraph({ spacing: { after: 20 }, children: [latin(inst.tagline, { italics: true, size: 18, color: GOLD })] }) : null,
    inst.address ? new Paragraph({ spacing: { after: 10 }, children: [latin(inst.address, { size: 18, color: GREY })] }) : null,
    contact ? new Paragraph({ children: [latin(contact, { size: 17, color: GREY })] }) : null,
  ].filter(Boolean)
  const LOGO_W = 1400
  const cells = []
  if (logo) cells.push(new TableCell({ borders: noBorders, verticalAlign: VerticalAlign.CENTER, width: { size: LOGO_W, type: WidthType.DXA },
    children: [new Paragraph({ children: [new ImageRun({ type: logo.type, data: logo.data, transformation: { width: 72, height: 72 } })] })] }))
  cells.push(new TableCell({ borders: noBorders, verticalAlign: VerticalAlign.CENTER, width: { size: logo ? FULL - LOGO_W : FULL, type: WidthType.DXA }, children: textCol }))
  return [
    new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: logo ? [LOGO_W, FULL - LOGO_W] : [FULL],
      borders: { ...noBorders, insideHorizontal: NONE, insideVertical: NONE }, rows: [new TableRow({ children: cells })] }),
    new Paragraph({ spacing: { before: 80, after: 160 }, border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: GOLD, space: 1 } }, children: [] }),
  ]
}

function paperBlock(paper, setName) {
  const out = []
  if (paper.title) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: runs(paper.title, { size: 30, bold: true, color: INK }) }))
  if (paper.titleMayek) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: runs(paper.titleMayek, { size: 26, bold: true, color: NAVY }) }))
  const facts = [['Class', paper.klass], ['Subject', paper.subject], ['Date', paper.date], ['Time', paper.time], ['Full Marks', paper.marks], ['Set', setName]].filter(([, v]) => v)
  if (facts.length) {
    const cell = ([k, v]) => new TableCell({
      shading: { fill: k === 'Set' ? NAVY : 'F6EFDC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, borders: boxBorders('EADBB2'),
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        latin(k.toUpperCase(), { size: 14, bold: true, color: k === 'Set' ? 'E9D9B0' : GOLD }),
        latin('  ' + v, { size: 20, bold: true, color: k === 'Set' ? 'FFFFFF' : INK }),
      ] })],
    })
    out.push(new Table({ width: { size: FULL, type: WidthType.DXA }, rows: [new TableRow({ children: facts.map(cell) })] }))
    out.push(new Paragraph({ spacing: { after: 140 }, children: [] }))
  }
  return out
}

// Name / Roll No. strip for the candidate, under the paper details.
function rollStrip() {
  const cell = (label, w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: boxBorders('D9D2C2'), margins: { top: 110, bottom: 110, left: 120, right: 120 },
    children: [new Paragraph({ children: [latin(label.toUpperCase(), { size: 14, bold: true, color: GOLD })] })] })
  return [
    new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: [5100, 2400, 2400], rows: [new TableRow({ cantSplit: true, children: [cell('Name', 5100), cell('Roll No.', 2400), cell('Class / Section', 2400)] })] }),
    new Paragraph({ spacing: { after: 140 }, children: [] }),
  ]
}

// "General Instructions" box: (i), (ii)… in the chosen language.
function instructionsBox(list, lang) {
  const items = (list || []).filter(x => x.en || x.mm)
  if (!items.length) return []
  const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv']
  const paras = [new Paragraph({ spacing: { after: 60 }, children: [latin('General Instructions', { bold: true, size: 20, color: NAVY })] })]
  items.forEach((x, i) => {
    const label = `(${roman[i] || i + 1})\t`
    paras.push(new Paragraph({ indent: { left: 440, hanging: 440 }, spacing: { after: lang === 'mayek' ? 30 : 0 }, children: [latin(label, { size: 19, color: GOLD, bold: true }), ...runs(lang === 'english' ? x.en : (x.mm || x.en), { size: 20, color: INK })] }))
    if (lang !== 'mayek' && x.mm && x.en && x.mm !== x.en) paras.push(new Paragraph({ indent: { left: 440 }, spacing: { after: 30 }, children: runs(x.en, { size: 16, color: GREY, italics: true }) }))
  })
  return [
    new Table({ width: { size: FULL, type: WidthType.DXA }, rows: [new TableRow({ children: [new TableCell({
      shading: { fill: 'FBF8F1' }, borders: { ...boxBorders('EADBB2'), left: { style: BorderStyle.SINGLE, size: 24, color: GOLD } },
      margins: { top: 100, bottom: 100, left: 160, right: 160 }, children: paras })] })] }),
    new Paragraph({ spacing: { after: 140 }, children: [] }),
  ]
}

const marksText = m => (m ? `[${m}]` : '')
const mainText = (x, lang) => (lang === 'english' ? x.en : (x.mm || x.en))

// One question in the "Meetei Mayek" or "Mayek + English" layout.
// Text size, spacing, options per row and answer lines for the paper body.
function lookFor(opts) {
  const k = LOOKS.size[opts.textSize] || 1, g = LOOKS.spacing[opts.spacing] || 1
  return {
    sz: n => Math.round(n * k),
    sp: (before = 0, after = 0) => ({ before: Math.round(before * g), after: Math.round(after * g), line: Math.round(240 * (LOOKS.line[opts.spacing] || 1.08)) }),
    perRow: opts.optionsPerRow || 'auto',
    answerLines: opts.answerLines || 'off',
  }
}

// Lines to write the answer on: a dotted tab leader across the column (a
// bottom border would not do — Word joins the borders of paragraphs that
// follow each other into one box, leaving a single line).
const answerLinesParas = (n, L, width) => Array.from({ length: n }, () => new Paragraph({
  indent: { left: 440 }, spacing: { before: 0, after: 0, line: Math.round(440 * (L.sz(100) / 100)), lineRule: 'exact' },
  tabStops: [{ type: TabStopType.RIGHT, position: width - 20, leader: 'dot' }],
  children: [latin('\t', { size: L.sz(22), color: 'B9B2A2' })],
}))

function questionParas(q, lang, width, L) {
  const out = []
  const tabs = [{ type: TabStopType.RIGHT, position: width - 20 }]
  const both = lang === 'bilingual' && q.mm && q.en && q.mm !== q.en
  const lines = q.body.filter(b => b.kind === 'line'), opts = q.body.filter(b => b.kind === 'option')
  const ruled = answerLineCount(q, L.answerLines)
  // "Keep with next" only inside a question: on its last line it would tie
  // the question to whatever comes after (in LibreOffice, a blank page).
  const more = lines.length + opts.length + ruled > 0
  out.push(new Paragraph({
    keepNext: both || more, keepLines: true, indent: { left: 440, hanging: 440 }, tabStops: tabs, spacing: L.sp(150, both ? 0 : 40),
    children: [latin(`${q.no}.\t`, { bold: true, size: L.sz(22), color: NAVY }), ...runs(mainText(q, lang), { size: L.sz(23), bold: true, color: INK }),
      ...(q.marks ? [latin(`\t${marksText(q.marks)}`, { size: L.sz(19), bold: true, color: GOLD })] : [])],
  }))
  if (both) out.push(new Paragraph({ keepNext: more, indent: { left: 440 }, spacing: L.sp(0, 40), children: runs(q.en, { size: L.sz(17), color: GREY, italics: true }) }))
  lines.forEach((l, i) => {
    const next = i < lines.length - 1 || opts.length + ruled > 0
    const en = lang === 'bilingual' && l.mm && l.en && l.mm !== l.en
    out.push(new Paragraph({ keepNext: next || en, indent: { left: 440 }, spacing: L.sp(0, 20), children: runs(mainText(l, lang), { size: L.sz(22), color: INK }) }))
    if (en) out.push(new Paragraph({ keepNext: next, indent: { left: 440 }, spacing: L.sp(0, 0), children: runs(l.en, { size: L.sz(16), color: GREY, italics: true }) }))
  })
  if (ruled) out.push(...answerLinesParas(ruled, L, width))
  if (!opts.length) return out
  const label = i => `(${LETTERS[i]})`
  const bilingual = lang === 'bilingual'
  const perRow = optionsPerRow(opts.map(o => mainText(o, lang)), L.perRow, { bilingual, wide: width > 6000 })
  if (perRow === 1) {
    opts.forEach((o, i) => {
      const last = i === opts.length - 1
      const en = bilingual && o.mm && o.en && o.mm !== o.en
      out.push(new Paragraph({ keepNext: !last || en, indent: { left: 880, hanging: 440 }, spacing: L.sp(0, en ? 0 : 20),
        children: [latin(`${label(i)}\t`, { size: L.sz(20), bold: true, color: GOLD }), ...runs(mainText(o, lang), { size: L.sz(22), color: INK })] }))
      if (en) out.push(new Paragraph({ keepNext: !last, indent: { left: 880 }, spacing: L.sp(0, 20), children: runs(o.en, { size: L.sz(16), color: GREY, italics: true }) }))
    })
    return out
  }
  // Options side by side on tab stops; in "Mayek + English" the English
  // follows on a second line at the same tab stops.
  const step = Math.floor((width - 440) / perRow)
  const stops = Array.from({ length: perRow }, (_, k) => ({ type: TabStopType.LEFT, position: 440 + k * step })).slice(1)
  for (let r = 0; r < opts.length; r += perRow) {
    const row = opts.slice(r, r + perRow)
    const last = r + perRow >= opts.length
    const en = bilingual && row.some(o => o.mm && o.en && o.mm !== o.en)
    out.push(new Paragraph({
      keepNext: !last || en, indent: { left: 440 }, spacing: L.sp(0, en ? 0 : 30), tabStops: stops,
      children: row.flatMap((o, k) => [latin(`${k ? '\t' : ''}${label(r + k)} `, { size: L.sz(20), bold: true, color: GOLD }), ...runs(mainText(o, lang), { size: L.sz(22), color: INK })]),
    }))
    if (en) out.push(new Paragraph({
      keepNext: !last, indent: { left: 440 }, spacing: L.sp(0, 30), tabStops: stops,
      children: row.flatMap((o, k) => [latin(`${k ? '\t' : ''}     `, { size: L.sz(16) }), ...runs(o.en, { size: L.sz(16), color: GREY, italics: true })]),
    }))
  }
  return out
}

function sectionPara(b, lang, L) {
  const out = [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: L.sp(220, lang === 'bilingual' ? 0 : 100),
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EADBB2', space: 2 } }, children: runs(mainText(b, lang), { size: L.sz(24), bold: true, color: NAVY }) })]
  if (lang === 'bilingual' && b.mm && b.en && b.mm !== b.en) out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: L.sp(0, 100), children: runs(b.en, { size: L.sz(17), color: GREY, italics: true }) }))
  return out
}

function textParas(b, lang, L) {
  const out = [new Paragraph({ spacing: L.sp(60, lang === 'bilingual' ? 0 : 60), children: runs(mainText(b, lang), { size: L.sz(22), color: INK }) })]
  if (lang === 'bilingual' && b.mm && b.en && b.mm !== b.en) out.push(new Paragraph({ spacing: L.sp(0, 60), children: runs(b.en, { size: L.sz(16), color: GREY, italics: true }) }))
  return out
}

// "Side by side": English | Meetei Mayek in a table, with a number and a marks column.
function sideBySide(blocks, L) {
  const W = [620, 4290, 4290, 700]
  const cell = (children, i, o = {}) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, borders: { ...noBorders, bottom: thin('F1EDE3') }, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children, ...o })
  const p = (text, o = {}) => new Paragraph({ alignment: o.align, spacing: L.sp(0, 0), children: runs(text, { size: L.sz(o.size || 21), bold: o.bold, color: o.color || INK, italics: o.italics }) })
  const head = new TableRow({ tableHeader: true, children: ['No.', 'English', 'Meetei Mayek', 'Marks'].map((t, i) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, shading: { fill: NAVY }, borders: noBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ alignment: i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [latin(t, { bold: true, size: 17, color: 'FFFFFF' })] })] })) })
  const rows = [head]
  for (const b of blocks) {
    if (b.type === 'section') {
      rows.push(new TableRow({ cantSplit: true, children: [new TableCell({ columnSpan: 4, shading: { fill: 'F6EFDC' }, borders: noBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [...runs(b.en, { size: 21, bold: true, color: NAVY }), latin('   ·   ', { color: GOLD }), ...runs(b.mm || '', { size: 22, bold: true, color: NAVY })] })] })] }))
    } else if (b.type === 'text') {
      rows.push(new TableRow({ cantSplit: true, children: [cell([p('')], 0), cell([p(b.en)], 1), cell([p(b.mm || '')], 2), cell([p('')], 3)] }))
    } else {
      rows.push(new TableRow({ cantSplit: true, children: [
        cell([p(`${b.no}.`, { bold: true, color: NAVY })], 0),
        cell([p(b.en, { bold: true }), ...b.body.filter(x => x.kind === 'line').map(x => p(x.en))], 1),
        cell([p(b.mm || '', { bold: true, size: 22 }), ...b.body.filter(x => x.kind === 'line').map(x => p(x.mm || ''))], 2),
        cell([p(marksText(b.marks), { bold: true, color: GOLD, align: AlignmentType.CENTER })], 3),
      ] }))
      b.body.filter(x => x.kind === 'option').forEach((o, i) => rows.push(new TableRow({ cantSplit: true, children: [
        cell([p('')], 0),
        cell([new Paragraph({ indent: { left: 200 }, spacing: L.sp(0, 0), children: [latin(`(${LETTERS[i]}) `, { bold: true, color: GOLD, size: L.sz(19) }), ...runs(o.en, { size: L.sz(20), color: INK })] })], 1),
        cell([new Paragraph({ indent: { left: 200 }, spacing: L.sp(0, 0), children: [latin(`(${LETTERS[i]}) `, { bold: true, color: GOLD, size: L.sz(19) }), ...runs(o.mm || '', { size: L.sz(21), color: INK })] })], 2),
        cell([p('')], 3),
      ] })))
    }
  }
  return [new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: W, rows })]
}

function bodyFor(model, lang, columns, L) {
  const blocks = numbered(model)
  if (lang === 'sidebyside') return sideBySide(blocks, L)
  const width = widthFor(columns)
  return blocks.flatMap(b => (b.type === 'question' ? questionParas(b, lang, width, L) : b.type === 'section' ? sectionPara(b, lang, L) : textParas(b, lang, L)))
}

const pageTitle = (text, sub, pageBreakBefore = false) => [
  new Paragraph({ pageBreakBefore, alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [latin(text, { bold: true, size: 30, color: NAVY })] }),
  ...(sub ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [latin(sub, { size: 19, color: GREY })] })] : []),
]

// Answer key: number → answer, five per row.
function keyPage(model, paper, setName, newPage = false) {
  const key = answerKey(model)
  const COLS = 5, W = Math.floor(FULL / COLS)
  const rows = []
  for (let r = 0; r < key.length; r += COLS) {
    rows.push(new TableRow({ cantSplit: true, children: Array.from({ length: COLS }, (_, k) => {
      const e = key[r + k]
      return new TableCell({ width: { size: W, type: WidthType.DXA }, borders: boxBorders('EADBB2'), shading: { fill: (Math.floor(r / COLS) % 2) ? 'FFFFFF' : 'FBF8F1' }, margins: { top: 70, bottom: 70, left: 100, right: 80 },
        children: [new Paragraph({ children: e ? [latin(`${e.no}.  `, { bold: true, size: 20, color: NAVY }), ...(e.letter ? [latin(`(${e.letter})  `, { bold: true, size: 21, color: GOLD })] : []), ...runs(e.text || '—', { size: e.letter ? 17 : 19, color: e.letter ? GREY : INK })] : [] })] })
    }) }))
  }
  const missing = key.filter(e => !e.text).length
  return [
    ...pageTitle(`Answer Key${setName ? ` — Set ${setName}` : ''}`, [paper.title, paper.subject, paper.klass && `Class ${paper.klass}`].filter(Boolean).join('  ·  '), newPage),
    key.length ? new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: Array(COLS).fill(W), rows }) : new Paragraph({ children: [latin('No questions found.', { color: GREY })] }),
    ...(missing ? [new Paragraph({ spacing: { before: 160 }, children: [latin(`${missing} question${missing === 1 ? ' has' : 's have'} no answer in the paper ("—").`, { size: 17, italics: true, color: GREY })] })] : []),
  ]
}

// OMR answer sheet for the multiple-choice questions.
const BUBBLES = ['Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ']
function omrPage(model, paper, setName, newPage = false) {
  const qs = numbered(model).filter(b => b.type === 'question' && b.body.some(x => x.kind === 'option'))
  const n = Math.min(8, Math.max(2, ...qs.map(q => q.body.filter(x => x.kind === 'option').length)))
  const field = (label, value = '') => new TableCell({ borders: boxBorders('D9D2C2'), margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [new Paragraph({ children: [latin(label.toUpperCase(), { size: 14, bold: true, color: GOLD }), latin('  ' + value, { size: 22, bold: true, color: INK })] })] })
  const COLS = 4, W = Math.floor(FULL / COLS), perCol = Math.ceil(qs.length / COLS)
  const rows = []
  for (let r = 0; r < perCol; r++) {
    rows.push(new TableRow({ cantSplit: true, children: Array.from({ length: COLS }, (_, c) => {
      const q = qs[c * perCol + r]
      return new TableCell({ width: { size: W, type: WidthType.DXA }, borders: { ...noBorders, right: c < COLS - 1 ? thin('EADBB2') : NONE }, margins: { top: 40, bottom: 40, left: 120, right: 60 },
        children: [new Paragraph({ children: q ? [latin(`${String(q.no).padStart(2, ' ')}  `, { bold: true, size: 19, color: NAVY }), new TextRun({ text: BUBBLES.slice(0, n).join(' '), size: 26, color: '5D6B82', font: 'Segoe UI Symbol' })] : [] })] })
    }) }))
  }
  return [
    ...pageTitle('OMR Answer Sheet', [paper.title, setName && `Set ${setName}`].filter(Boolean).join('  ·  '), newPage),
    new Table({ width: { size: FULL, type: WidthType.DXA }, rows: [
      new TableRow({ children: [field('Name of candidate'), field('Roll No.')] }),
      new TableRow({ children: [field('Set', setName || ''), field('Signature of invigilator')] }),
    ] }),
    new Paragraph({ spacing: { before: 140, after: 140 }, children: [latin('Use a blue or black ball pen. Darken one circle fully for each question. Do not make any stray marks.', { size: 17, italics: true, color: GREY })] }),
    qs.length ? new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: Array(COLS).fill(W), rows }) : new Paragraph({ children: [latin('This paper has no multiple-choice questions.', { color: GREY })] }),
  ]
}

/**
 * Build a paper .docx from a model (mayekPaper.js).
 * opts: { lang: 'mayek'|'bilingual'|'sidebyside', columns: 1|2, institute, paper,
 *   instructions: [{ en, mm }], watermark: { kind: 'text'|'logo'|'none', text, strength },
 *   logoSrc, showLogo, setName, withKey, withOmr, keyOnly }
 * Returns a Blob.
 */
export async function buildPaperDocx(model, opts = {}) {
  const { lang = 'mayek', institute = {}, paper = {}, instructions = [], watermark = {}, logoSrc, showLogo = true, setName = '', withKey = false, withOmr = false, keyOnly = false } = opts
  const columns = lang === 'sidebyside' ? 1 : opts.columns === 2 ? 2 : 1
  const logo = showLogo && logoSrc ? { type: /png/i.test(logoSrc.slice(0, 30)) ? 'png' : 'jpg', data: await dataUrlBytes(logoSrc) } : null
  const wm = watermark.kind && watermark.kind !== 'none'
    ? await dataUrlBytes(await watermarkDataUrl({ kind: watermark.kind, text: watermark.text || institute.short || institute.name, logoSrc, strength: watermark.strength }))
    : null
  const header = new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      ...(wm ? [new ImageRun({ type: 'png', data: wm, transformation: { width: 520, height: 520 },
        floating: { behindDocument: true, allowOverlap: true,
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: 'center' },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: 'center' } } })] : []),
      latin([institute.short || institute.name, paper.title, setName && `Set ${setName}`].filter(Boolean).join('  ·  '), { size: 15, color: '8A93A6' }),
    ],
  })] })
  const footer = new Footer({ children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: FULL }],
    children: [
      latin([institute.name, institute.website].filter(Boolean).join('  ·  '), { size: 15, color: '8A93A6' }),
      new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 15, color: '8A93A6', font: LATIN_FONT }),
    ],
  })] })
  const first = { properties: { page: PAGE }, headers: { default: header }, footers: { default: footer } }
  const top = [...letterhead(institute, logo)]
  const sections = []
  if (keyOnly) {
    sections.push({ ...first, children: [...top, ...keyPage(model, paper, setName)] })
  } else {
    const intro = [...top, ...paperBlock(paper, setName), ...(opts.rollBox ? rollStrip() : []), ...instructionsBox(instructions, lang)]
    const body = bodyFor(model, lang, columns, lookFor(opts))
    if (columns === 2) {
      sections.push({ ...first, children: intro })
      sections.push({ properties: { page: PAGE, type: SectionType.CONTINUOUS, column: { count: 2, space: GAP, separate: true } }, children: body })
    } else sections.push({ ...first, children: [...intro, ...body] })
    // After two columns: an empty continuous section makes Word and
    // LibreOffice share a short paper evenly between the columns; the key
    // that follows is continuous too and starts its page with a page break
    // (a next-page break there leaves a blank page).
    if (columns === 2) sections.push({ properties: { page: PAGE, type: SectionType.CONTINUOUS }, children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })] })
    const after = [withKey && (b => keyPage(model, paper, setName, b)), withOmr && (b => omrPage(model, paper, setName, b))].filter(Boolean)
    after.forEach((page, i) => {
      const join = columns === 2 && i === 0
      sections.push({ properties: { page: PAGE, type: join ? SectionType.CONTINUOUS : SectionType.NEXT_PAGE }, children: page(join) })
    })
  }
  const doc = new Document({
    creator: institute.name || 'GNSI ERP',
    title: [paper.title || 'Question paper', setName && `Set ${setName}`].filter(Boolean).join(' — '),
    fonts: [{ name: MAYEK_FONT, data: fontBytes() }],
    styles: { default: { document: { run: { font: LATIN_FONT, size: 22 } } } },
    sections,
  })
  return fixFontEmbedding(await Packer.toBlob(doc))
}

// The docx library writes the embedded font's key in lowercase; Word writes it
// in uppercase and LibreOffice only reads it that way (lowercase = the font is
// silently ignored). Also switch on "embed fonts" so Word keeps the font when
// the file is edited and saved again.
async function fixFontEmbedding(blob) {
  const zip = await JSZip.loadAsync(blob)
  const ft = zip.file('word/fontTable.xml'), st = zip.file('word/settings.xml')
  if (ft) zip.file('word/fontTable.xml', (await ft.async('string')).replace(/w:fontKey="(\{[^"]+\})"/g, (_, k) => `w:fontKey="${k.toUpperCase()}"`))
  if (st) {
    const xml = await st.async('string')
    if (!xml.includes('embedTrueTypeFonts')) zip.file('word/settings.xml', xml.replace(/(<w:settings\b[^>]*>)/, '$1<w:embedTrueTypeFonts/>'))
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' })
}

/** A safe file name from the paper title. */
export const docxFileName = (paper, suffix = 'Mayek') =>
  `${String(paper?.title || 'Question-paper').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'Question-paper'}-${suffix}.docx`

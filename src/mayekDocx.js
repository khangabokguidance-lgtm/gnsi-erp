// mayekDocx.js — reading English question papers (.docx / .txt) and writing
// the Meetei Mayek version as a Word document with the institute letterhead,
// a paper details block and a watermark behind the text on every page.
//
// Reading: a .docx is a zip; its paragraphs are read in document order
// (tables included) from word/document.xml. Automatic list numbers ("1.",
// "(a)") are not part of the paragraph text in Word, so they are rebuilt
// from word/numbering.xml — question papers rely on them.
//
// Writing: the Meetei Mayek font (Noto Sans Meetei Mayek, SIL OFL) is embedded
// in the file, so it shows correctly on computers that do not have it. The
// watermark is a faded PNG (institute name or logo) anchored behind the text
// in the page header, so Word repeats it on every page.
import JSZip from 'jszip'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun,
  PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TabStopType, TextRun,
  VerticalAlign, VerticalPositionRelativeFrom, WidthType,
} from 'docx'
import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'

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

// ── Line kinds (for layout) ──────────────────────────────────────────────────
const Q_NUM = /^(?:Q\.?\s*)?\d{1,3}\s*[.)]\s*\S|^\(\d{1,3}\)\s*\S/i
const OPT = /^\(?(?:[a-hA-H]|i{1,3}|iv|v|vi{0,3}|[ꯀ-ꯪ])\s*[.)]\s*\S|^\([a-hA-H]\)/
const SECTION = /^(?:section|part|group)\s+[A-Z0-9]+\b/i
/** 'blank' | 'section' | 'question' | 'option' | 'text' */
export function lineKind(text) {
  const t = String(text || '').trim()
  if (!t) return 'blank'
  if (SECTION.test(t) && t.length <= 60) return 'section'
  if (Q_NUM.test(t)) return 'question'
  if (OPT.test(t) && t.length <= 160) return 'option'
  return 'text'
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
const NAVY = '132A4F', GOLD = 'B8923A', GREY = '5D6B82', INK = '0F1B2E'
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
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }

function letterhead(inst, logo) {
  const contact = [inst.phone, inst.email, inst.website].filter(Boolean).join('   ·   ')
  const textCol = [
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: inst.name || '', bold: true, size: 34, color: NAVY, font: LATIN_FONT })] }),
    inst.tagline ? new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: inst.tagline, italics: true, size: 18, color: GOLD, font: LATIN_FONT })] }) : null,
    inst.address ? new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: inst.address, size: 18, color: GREY, font: LATIN_FONT })] }) : null,
    contact ? new Paragraph({ children: [new TextRun({ text: contact, size: 17, color: GREY, font: LATIN_FONT })] }) : null,
  ].filter(Boolean)
  const cells = []
  const LOGO_W = 1400, FULL = 9900 // twips; the text block takes the rest of the line
  if (logo) cells.push(new TableCell({ borders: noBorders, verticalAlign: VerticalAlign.CENTER, width: { size: LOGO_W, type: WidthType.DXA },
    children: [new Paragraph({ children: [new ImageRun({ type: logo.type, data: logo.data, transformation: { width: 72, height: 72 } })] })] }))
  cells.push(new TableCell({ borders: noBorders, verticalAlign: VerticalAlign.CENTER, width: { size: logo ? FULL - LOGO_W : FULL, type: WidthType.DXA }, children: textCol }))
  return [
    new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: logo ? [LOGO_W, FULL - LOGO_W] : [FULL],
      borders: { ...noBorders, insideHorizontal: noBorders.top, insideVertical: noBorders.top }, rows: [new TableRow({ children: cells })] }),
    new Paragraph({ spacing: { before: 80, after: 160 }, border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: GOLD, space: 1 } }, children: [] }),
  ]
}

function paperBlock(paper) {
  const out = []
  if (paper.title) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: runs(paper.title, { size: 30, bold: true, color: INK }) }))
  if (paper.titleMayek) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: runs(paper.titleMayek, { size: 26, bold: true, color: NAVY }) }))
  const facts = [['Class', paper.klass], ['Subject', paper.subject], ['Date', paper.date], ['Time', paper.time], ['Full Marks', paper.marks]].filter(([, v]) => v)
  if (facts.length) {
    const cell = ([k, v]) => new TableCell({
      shading: { fill: 'F6EFDC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'EADBB2' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EADBB2' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'EADBB2' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'EADBB2' } },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: k.toUpperCase(), size: 14, bold: true, color: GOLD, font: LATIN_FONT }),
        new TextRun({ text: '  ' + v, size: 20, bold: true, color: INK, font: LATIN_FONT }),
      ] })],
    })
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: facts.map(cell) })] }))
    out.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
  }
  return out
}

function bodyParagraphs(pairs, layout) {
  const out = []
  const indent = { question: { left: 360, hanging: 360 }, option: { left: 720, hanging: 360 }, text: undefined, section: undefined }
  for (const { en, mm } of pairs) {
    const kind = lineKind(en || mm)
    if (kind === 'blank') { out.push(new Paragraph({ spacing: { after: 60 }, children: [] })); continue }
    const strong = kind === 'question' || kind === 'section'
    const base = { indent: indent[kind], keepNext: kind === 'question' }
    if (kind === 'section') {
      const text = layout === 'english' ? en : (mm || en)
      out.push(new Paragraph({ ...base, alignment: AlignmentType.CENTER, spacing: { before: 200, after: layout === 'bilingual' ? 0 : 120 }, children: runs(text, { size: 24, bold: true, color: NAVY }) }))
      if (layout === 'bilingual' && mm && en && mm !== en) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: runs(en, { size: 18, color: GREY, italics: true }) }))
      continue
    }
    const before = kind === 'question' ? 140 : 20
    if (layout === 'bilingual') {
      out.push(new Paragraph({ ...base, keepNext: true, spacing: { before, after: 0 }, children: runs(mm || en, { size: 23, bold: strong, color: INK }) }))
      if (en && mm && en !== mm) out.push(new Paragraph({ indent: indent[kind], keepNext: kind === 'question', spacing: { after: 40 }, children: runs(en, { size: 17, color: GREY, italics: true }) }))
    } else {
      out.push(new Paragraph({ ...base, spacing: { before, after: 40 }, children: runs(mm || en, { size: 23, bold: strong, color: INK }) }))
    }
  }
  return out
}

/**
 * Build the .docx. pairs: [{ en, mm }] in order (blank lines kept).
 * opts: { layout: 'mayek'|'bilingual', institute, paper, watermark: { kind:
 * 'text'|'logo'|'none', text, strength }, logoSrc, logo: true|false }
 * Returns a Blob.
 */
export async function buildMayekDocx(pairs, opts) {
  const { layout = 'mayek', institute = {}, paper = {}, watermark = {}, logoSrc, showLogo = true } = opts || {}
  const logo = showLogo && logoSrc ? { type: /png/i.test(logoSrc.slice(0, 30)) ? 'png' : 'jpg', data: await dataUrlBytes(logoSrc) } : null
  const wm = watermark.kind && watermark.kind !== 'none'
    ? await dataUrlBytes(await watermarkDataUrl({ kind: watermark.kind, text: watermark.text || institute.short || institute.name, logoSrc, strength: watermark.strength }))
    : null
  const headerChildren = [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      ...(wm ? [new ImageRun({ type: 'png', data: wm, transformation: { width: 520, height: 520 },
        floating: { behindDocument: true, allowOverlap: true,
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: 'center' },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: 'center' } } })] : []),
      new TextRun({ text: [institute.short || institute.name, paper.title].filter(Boolean).join('  ·  '), size: 15, color: '8A93A6', font: LATIN_FONT }),
    ],
  })]
  const footer = new Footer({ children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E8E3D8', space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
    children: [
      new TextRun({ text: [institute.name, institute.website].filter(Boolean).join('  ·  '), size: 15, color: '8A93A6', font: LATIN_FONT }),
      new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 15, color: '8A93A6', font: LATIN_FONT }),
    ],
  })] })
  const doc = new Document({
    creator: institute.name || 'GNSI ERP',
    title: paper.title || 'Question paper',
    fonts: [{ name: MAYEK_FONT, data: fontBytes() }],
    styles: { default: { document: { run: { font: LATIN_FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 900, left: 1000, right: 1000, header: 450, footer: 450 } } },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: footer },
      children: [...letterhead(institute, logo), ...paperBlock(paper), ...bodyParagraphs(pairs, layout)],
    }],
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

// bookletBuilder.js — GNSI Premium Booklet Builder, in the browser.
//
// Same job as tools/booklet/gnsi_booklet.py (Sir Moirangthem Himan Singh's
// design): turns a chapter question file (.docx) into the navy-and-gold
// premium booklet — cover, contents, questions sorted by type (two columns),
// answer key and worked solutions. English in Calibri/Cambria, Manipuri in
// Bmei04 (the font is embedded in the file, so it shows on any computer).
//
// Source file layout (as the chapter files):
//   Q1. English question               (bold, starts with "Q" + number + ".")
//   Manipuri line                      (Bmei04)
//   (A) ...  (B) ...  (C) ...  (D) ...
//   Q1. B   Q2. C ...                  (answer key at the end — optional)
//
// Settings are the same JSON as the Python program's (source / output /
// title / title_mm / label / groups / answers / solutions / set_english /
// replace_english / set_options / set_option / replace_manipuri /
// instructions), so a settings file works in both.
import JSZip from 'jszip'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, LineRuleType, Packer, PageNumber, Paragraph, SectionType,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, WidthType,
} from 'docx'
import { BMEI04_BASE64 } from '../bmei04_font_base64.js'
import { fixFontEmbedding } from '../mayekDocx.js'

// ═════════════════════════════════════════════════════════════════════════════
//  DESIGN — change the look of every booklet here (same values as the Python)
// ═════════════════════════════════════════════════════════════════════════════
export const DESIGN = {
  navy: '1B2A4A', gold: 'B8892B', gold_light: 'D8C08A', cream: 'F3E6C4',
  ink: '222222', ink_mm: '333333', muted: '6B7280', tint: 'F4EFE3', rule: 'D9D2C0',
  font_head: 'Cambria', font_body: 'Calibri', font_mm: 'Bmei04',
  size_title: 34, size_body: 11, size_q: 10, size_mm: 11, size_opt: 9.5, size_bar: 11.5,
  page_w: 21.0, page_h: 29.7, margin_lr: 2.0, margin_top: 2.2, margin_bottom: 2.0,
  column_gap: 0.8, question_indent: 0.75,
  institute: 'Guidance Navodaya and Sainik Institute',
  motto: 'Excellence  ·  Discipline  ·  Guidance',
  author: 'Sir Moirangthem Himan Singh',
  author_role: 'Founder, Guidance Navodaya and Sainik Institute',
  footer: 'Prepared by Sir Moirangthem Himan Singh, Founder',
  audience: 'For Sainik School and Navodaya Vidyalaya entrance preparation',
}
const D = DESIGN

export const DEFAULT_INSTRUCTIONS = [
  'Each question is given in English, with the Manipuri (Meitei Mayek) line below it in the Bmei04 font.',
  'Questions are grouped by type, so a student can practise one skill at a time.',
  'Try every question in a group before turning to the answer key; then read the worked solution for any you missed.',
  'The Manipuri lines need the Bmei04 font installed on the computer to display correctly.',
]

// ═════════════════════════════════════════════════════════════════════════════
//  1. READ THE SOURCE FILE
// ═════════════════════════════════════════════════════════════════════════════
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
/** Bmei04 text is often stored as Symbol private-use characters (U+F0xx). */
export const decodeBmei = t => Array.from(t || '').map(c => {
  const o = c.codePointAt(0)
  return o >= 0xF000 && o < 0xF100 ? String.fromCharCode(o - 0xF000) : c
}).join('')

const kids = (el, name) => Array.from(el.childNodes).filter(c => c.localName === name)
const kid = (el, name) => el && Array.from(el.childNodes).find(c => c.localName === name)
const attr = (el, name) => el && (el.getAttributeNS(W_NS, name) ?? el.getAttribute('w:' + name))

// A run: its text (w:t, tabs, breaks, w:sym), font and whether it is bold.
function readRun(r) {
  const rPr = kid(r, 'rPr')
  const fonts = kid(rPr, 'rFonts')
  const b = kid(rPr, 'b')
  const bold = !!b && !['0', 'false', 'off'].includes(String(attr(b, 'val') ?? 'true').toLowerCase())
  let text = ''
  for (const c of Array.from(r.childNodes)) {
    if (c.localName === 't') text += c.textContent
    else if (c.localName === 'tab') text += '\t'
    else if (c.localName === 'br' || c.localName === 'cr') text += '\n'
    else if (c.localName === 'sym') {
      const code = parseInt(attr(c, 'char') || '', 16)
      if (Number.isFinite(code)) text += String.fromCharCode(code >= 0xF000 ? code - 0xF000 : code)
    }
  }
  return { text, bold, font: attr(fonts, 'ascii') || attr(fonts, 'hAnsi') || '' }
}

// Top-level body paragraphs (like python-docx Document.paragraphs).
function readParagraphs(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
  if (!body) throw new Error('This is not a Word document (no document body).')
  return kids(body, 'p').map(p => {
    const runs = []
    for (const c of Array.from(p.childNodes)) {
      if (c.localName === 'r') runs.push(readRun(c))
      else if (c.localName === 'hyperlink' || c.localName === 'smartTag' || c.localName === 'ins') kids(c, 'r').forEach(r => runs.push(readRun(r)))
    }
    return { runs: runs.filter(r => r.text), text: runs.map(r => r.text).join('') }
  })
}

/**
 * Questions and answer key from a chapter .docx.
 * → { Q: { [n]: { eng, mm: [[text, isBmei]], opts: [] } }, key: { [n]: 'A'|… } }
 */
export async function readChapterDocx(file) {
  const zip = await JSZip.loadAsync(file)
  const xmlFile = zip.file('word/document.xml')
  if (!xmlFile) throw new Error('This file has no Word document inside — save it as .docx and try again.')
  const ps = readParagraphs(await xmlFile.async('string'))
  const starts = {}, key = {}
  ps.forEach((p, i) => {
    const firstBold = !!(p.runs[0] && p.runs[0].bold)
    const m = p.text.match(/^\s*Q(\d+)\.\s/)
    if (m && firstBold && !(Number(m[1]) in starts)) starts[Number(m[1])] = i
    if (!firstBold) for (const k of p.text.matchAll(/Q(\d+)\.\s*([A-D])\b(?!\w)/g)) key[Number(k[1])] = k[2]
  })
  const nums = Object.keys(starts).map(Number).sort((a, b) => a - b)
  const Q = {}
  nums.forEach((n, k) => {
    const end = k + 1 < nums.length ? starts[nums[k + 1]] : ps.length
    const block = ps.slice(starts[n], end).filter(p => p.text.trim())
    const eng = block[0].text.replace(/^\s*Q\d+\.\s*/, '').trim()
    let mm = []
    const optLines = []
    for (const p of block.slice(1)) {
      if (/^\s*\(A\)/.test(p.text) || (optLines.length && /^\s*\([B-D]\)/.test(p.text))) optLines.push(p.text)
      else if (optLines.length) break // anything after the options (e.g. the key) ends the block
      else if (!mm.length) mm = p.runs.map(r => [decodeBmei(r.text), r.font === D.font_mm])
    }
    const opts = optLines.join('\t').split(/\([A-D]\)/).slice(1).map(o => o.trim()).slice(0, 4)
    Q[n] = { eng, mm, opts }
  })
  if (!nums.length) throw new Error('No questions found. Each question must start with a bold "Q1." line.')
  return { Q, key }
}

// ═════════════════════════════════════════════════════════════════════════════
//  2. APPLY CORRECTIONS FROM THE SETTINGS
// ═════════════════════════════════════════════════════════════════════════════
/** A copy of the questions with the settings' corrections applied. */
export function applyEdits(source, cfg = {}) {
  const Q = {}
  for (const [n, q] of Object.entries(source)) Q[n] = { eng: q.eng, mm: q.mm.map(r => [...r]), opts: [...q.opts] }
  const at = n => Q[Number(n)]
  for (const [n, text] of Object.entries(cfg.set_english || {})) if (at(n)) at(n).eng = text
  for (const [n, pairs] of Object.entries(cfg.replace_english || {})) {
    if (at(n)) for (const [o, nw] of pairs) at(n).eng = at(n).eng.split(o).join(nw)
  }
  for (const [n, opts] of Object.entries(cfg.set_options || {})) if (at(n)) at(n).opts = [...opts]
  for (const [n, ch] of Object.entries(cfg.set_option || {})) {
    if (at(n)) for (const [letter, text] of Object.entries(ch)) at(n).opts['ABCD'.indexOf(letter)] = text
  }
  for (const [n, edits] of Object.entries(cfg.replace_manipuri || {})) {
    const runs = at(n)?.mm
    if (!runs) continue
    for (const e of edits) { // [find, replace, which occurrence (1-based, optional)]
      const [old, nw] = e, nth = e[2] || 1
      let seen = 0
      for (let k = 0; k < runs.length; k++) {
        const t = runs[k][0], c = old ? t.split(old).length - 1 : 0
        if (seen + c >= nth) {
          let pos = -1
          for (let i = 0; i < nth - seen; i++) pos = t.indexOf(old, pos + 1)
          runs[k] = [t.slice(0, pos) + nw + t.slice(pos + old.length), runs[k][1]]
          break
        }
        seen += c
      }
    }
  }
  // tidy multiplication signs: "2x2" / "2 x 3" → "2 × 3"
  for (const q of Object.values(Q)) {
    q.opts = q.opts.map(o => (/\d\s*x\s*\d/.test(o) ? o.replace(/\s*x\s*/g, ' × ') : o))
    q.eng = q.eng.replace(/(\d) x (\d)/g, '$1 × $2')
  }
  return Q
}

/** Groups as listed in the settings, plus "Other Questions" for the rest. */
export function resolveGroups(Q, cfg = {}) {
  const all = Object.keys(Q).map(Number).sort((a, b) => a - b)
  const groups = (cfg.groups && cfg.groups.length ? cfg.groups : [{ code: 'A', name: 'Practice Questions', questions: all }])
    .map(g => ({ ...g, questions: (g.questions || []).map(Number).filter(n => Q[n]) }))
    .filter(g => g.questions.length)
  const listed = new Set(groups.flatMap(g => g.questions))
  const missing = all.filter(n => !listed.has(n))
  if (missing.length) {
    const code = groups.length ? String.fromCharCode(groups[groups.length - 1].code.charCodeAt(0) + 1) : 'A'
    groups.push({ code, name: 'Other Questions', questions: missing })
  }
  return groups
}

// ═════════════════════════════════════════════════════════════════════════════
//  3. WORD HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const CM = 567 // twips per cm
const cm = v => Math.round(v * CM)
const pt = v => Math.round(v * 20) // twips
const run = (text, { font = D.font_body, size = D.size_body, bold = false, color = D.ink, italics = false, caps = false, spacing, shade } = {}) =>
  new TextRun({
    text, bold, italics, color, allCaps: caps || undefined, size: Math.round(size * 2),
    font: { ascii: font, hAnsi: font, cs: font, eastAsia: font },
    ...(spacing != null ? { characterSpacing: spacing } : {}),
    ...(shade ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: shade } } : {}),
  })
const line = (color, size, space) => ({ style: BorderStyle.SINGLE, size, color, space })
const para = (children = [], o = {}) => new Paragraph({
  children,
  alignment: o.align,
  spacing: { before: pt(o.before || 0), after: pt(o.after || 0) },
  indent: o.indent, tabStops: o.tabs, keepNext: o.keepNext || undefined,
  border: o.border, shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined,
  pageBreakBefore: o.pageBreakBefore || undefined,
})
const text = (t, o = {}, p = {}) => para(t ? [run(t, o)] : [], p)
const NO_BORDERS = { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideHorizontal: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL } }
const RULE_BORDERS = () => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: D.rule }
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }
}
const cell = (children, { fill, pad = [0, 0, 0, 0], width } = {}) => new TableCell({
  children: children.length ? children : [para()],
  shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
  margins: { top: pad[0], bottom: pad[1], left: pad[2], right: pad[3] },
  width: width ? { size: width, type: WidthType.DXA } : undefined,
})
const table = (rows, widths, borders = RULE_BORDERS(), align = AlignmentType.CENTER) => new Table({
  rows, columnWidths: widths, layout: TableLayoutType.FIXED, borders, alignment: align,
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
})
const mmRuns = (runs, size) => runs.map(([t, isMm]) => run(t, { font: isMm ? D.font_mm : D.font_body, size: isMm ? size : size - 1, color: D.ink_mm }))
const bullet = t => para([run('■  ', { size: 7, color: D.gold }), run(t, { size: 10.5 })], { after: 3, indent: { left: cm(0.6), hanging: cm(0.4) } })
const heading = (t, size = 22, newPage = false) => [
  text(t, { font: D.font_head, size, bold: true, color: D.navy }, { after: 2, pageBreakBefore: newPage }),
  para([], { after: size >= 22 ? 14 : 10, border: { bottom: line(D.gold, 12, 2) }, indent: { right: cm(13) } }),
]

// ═════════════════════════════════════════════════════════════════════════════
//  4. BUILD THE BOOKLET
// ═════════════════════════════════════════════════════════════════════════════
/**
 * The booklet as a .docx Blob.
 * source = readChapterDocx() result; cfg = settings; columns = 1 or 2.
 * → { blob, count, groups, noAnswer: [new numbers without an answer] }
 */
export async function buildBooklet(source, cfg = {}, { columns = 2 } = {}) {
  const Q = applyEdits(source.Q, cfg)
  const ANS = { ...source.key }
  for (const [n, a] of Object.entries(cfg.answers || {})) if (a) ANS[Number(n)] = String(a).toUpperCase()
  const SOL = {}
  for (const [n, s] of Object.entries(cfg.solutions || {})) if (s) SOL[Number(n)] = s
  const groups = resolveGroups(Q, cfg)
  const title = cfg.title || 'Question Booklet'
  const total = Object.keys(Q).length

  const CW = cm(D.page_w - 2 * D.margin_lr)
  const COLW = columns === 2 ? Math.round((CW - cm(D.column_gap)) / 2) : CW
  const IND = cm(D.question_indent)
  const C = AlignmentType.CENTER

  // header & footer (not on the cover page)
  const header = new Header({ children: [para([
    run(D.institute, { font: D.font_head, size: 9, bold: true, color: D.navy, caps: true, spacing: 10 }),
    run('\t' + title, { font: D.font_head, size: 9, color: D.gold, italics: true }),
  ], { tabs: [{ type: TabStopType.RIGHT, position: CW }], border: { bottom: line(D.gold, 6, 4) } })] })
  const footer = new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CW }],
    border: { top: line(D.rule, 4, 6) },
    children: [
      run(D.footer, { size: 8.5, color: D.muted, italics: true }),
      run('\tPage ', { size: 9, color: D.muted }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, color: D.navy, font: D.font_body }),
    ],
  })] })
  const page = {
    size: { width: cm(D.page_w), height: cm(D.page_h) },
    margin: { top: cm(D.margin_top), bottom: cm(D.margin_bottom), left: cm(D.margin_lr), right: cm(D.margin_lr), header: cm(1), footer: cm(1) },
  }
  const headers = { default: header }, footers = { default: footer }

  // ---- cover ----
  const cover = [
    para([], { before: 40 }),
    text(D.institute.toUpperCase(), { font: D.font_head, size: 12, bold: true, color: D.gold, spacing: 40 }, { align: C }),
    text(D.motto, { size: 9.5, color: D.muted, italics: true }, { align: C, before: 4 }),
    para([], { before: 60 }),
    table([new TableRow({ children: [cell([
      text((cfg.label || 'MATHEMATICS').toUpperCase(), { size: 10, bold: true, color: D.gold_light, spacing: 30 }, { align: C }),
      text(title, { font: D.font_head, size: D.size_title, bold: true, color: 'FFFFFF' }, { align: C, before: 10 }),
      ...(cfg.title_mm ? [text(cfg.title_mm, { font: D.font_mm, size: 20, color: D.cream }, { align: C, before: 6 })] : []),
      text(`${total} objective questions  ·  English with Manipuri`, { size: 12, color: 'E5E7EB' }, { align: C, before: 16 }),
      text('Sorted by type  ·  Answer key' + (Object.keys(SOL).length ? '  ·  Worked solutions' : ''), { size: 11, color: 'C9CED8' }, { align: C, before: 2 }),
    ], { fill: D.navy, pad: [500, 500, 400, 400], width: CW })] })], [CW], NO_BORDERS),
    para([], { before: 50 }),
    para([], { align: C, border: { top: line(D.gold, 12, 1) }, indent: { left: cm(6), right: cm(6) } }),
    text('PREPARED BY', { size: 9, bold: true, color: D.muted, spacing: 40 }, { align: C, before: 10 }),
    text(D.author, { font: D.font_head, size: 20, bold: true, color: D.navy }, { align: C, before: 6 }),
    text(D.author_role, { size: 11.5, color: D.gold, italics: true }, { align: C, before: 4 }),
    para([], { before: 70 }),
    text(D.audience, { size: 9.5, color: D.muted, italics: true }, { align: C }),
  ]

  // ---- contents ----
  const RANGE = {}
  let num = 1
  const contentRows = [new TableRow({ tableHeader: true, children: ['Type', 'Topic', 'Questions', 'Count'].map(h =>
    cell([text(h, { size: 10, bold: true, color: 'FFFFFF' })], { fill: D.navy, pad: [90, 90, 120, 120] })) })]
  groups.forEach((g, k) => {
    RANGE[g.code] = [num, num + g.questions.length - 1]; num += g.questions.length
    const vals = [g.code, g.name, `${RANGE[g.code][0]} – ${RANGE[g.code][1]}`, String(g.questions.length)]
    contentRows.push(new TableRow({ children: vals.map((v, j) => cell([text(v, j === 0
      ? { font: D.font_head, size: 11, bold: true, color: D.navy }
      : { size: 10.5 })], { fill: k % 2 ? D.tint : undefined, pad: [80, 80, 120, 120] })) }))
  })
  contentRows.push(new TableRow({ children: ['', 'Total', '', String(total)].map(v =>
    cell([text(v, { size: 10.5, bold: true, color: D.navy })], { pad: [80, 80, 120, 120] })) }))
  const contents = [
    ...heading('Contents', 22, true),
    table(contentRows, [cm(1.6), cm(9.4), cm(3.4), cm(2.6)]),
    para([], { before: 18 }),
    text('How to use this booklet', { font: D.font_head, size: 13, bold: true, color: D.navy }, { after: 4 }),
    ...(cfg.instructions || DEFAULT_INSTRUCTIONS).map(bullet),
  ]

  // ---- questions ----
  const NEW = {}
  const qParas = []
  num = 1
  for (const g of groups) {
    qParas.push(para([
      run(` ${g.code} `, { font: D.font_head, size: D.size_bar + 1.5, bold: true, color: 'FFFFFF', shade: D.gold }),
      run('  ' + g.name, { font: D.font_head, size: D.size_bar, bold: true, color: 'FFFFFF' }),
      run(`\t${RANGE[g.code][0]}–${RANGE[g.code][1]}`, { size: 9, color: D.gold_light }),
    ], {
      before: 10, after: 8, keepNext: true, shade: D.navy,
      border: { top: line(D.navy, 24, 3), bottom: line(D.navy, 24, 3), left: line(D.gold, 48, 0) },
      indent: { left: cm(0.25), right: cm(0.1) },
      tabs: [{ type: TabStopType.RIGHT, position: COLW - cm(0.45) }],
    }))
    for (const n of g.questions) {
      NEW[n] = num
      const q = Q[n]
      qParas.push(para([
        run(`${num}.`, { font: D.font_head, size: D.size_q + 0.5, bold: true, color: D.navy }),
        run('\t' + q.eng, { size: D.size_q, bold: true }),
      ], { before: 7, after: 1, keepNext: true, indent: { left: IND, hanging: IND }, tabs: [{ type: TabStopType.LEFT, position: IND }] }))
      if (q.mm.length) qParas.push(para(mmRuns(q.mm, D.size_mm), { after: 3, keepNext: true, indent: { left: IND } }))
      const opts = q.opts, longest = Math.max(0, ...opts.map(o => o.length))
      const avail = (COLW - IND) / CM // cm available for options
      const per = longest * 0.19 + 0.8 <= avail / 4 ? 4 : (longest * 0.19 + 0.8 <= avail / 2 ? 2 : 1)
      const rows = []
      for (let i = 0; i < opts.length; i += per) rows.push(opts.slice(i, i + per))
      let li = 0
      rows.forEach((row, ri) => {
        const step = (COLW - IND) / per
        const tabs = Array.from({ length: per - 1 }, (_, k) => ({ type: TabStopType.LEFT, position: Math.round(IND + step * (k + 1)) }))
        const children = []
        row.forEach((o, k) => {
          if (k) children.push(new TextRun({ text: '\t' }))
          children.push(run(`(${'ABCD'[li++]}) `, { size: D.size_opt, bold: true, color: D.gold }), run(o, { size: D.size_opt }))
        })
        qParas.push(para(children, { after: 1, indent: { left: IND }, tabs, keepNext: ri < rows.length - 1 }))
      })
      num++
    }
    qParas.push(para([], { after: 6 }))
  }

  // ---- answer key ----
  const ordered = Object.keys(NEW).map(Number).sort((a, b) => NEW[a] - NEW[b])
  const COLS = 8, nrows = Math.ceil(ordered.length / COLS)
  const keyCell = n => {
    const c = [para(n == null ? [] : [run(`${NEW[n]}. `, { size: 10, color: D.muted }), run(ANS[n] || '–', { font: D.font_head, size: 11, bold: true, color: D.navy })], { align: C })]
    return c
  }
  const keyRows = Array.from({ length: nrows }, (_, r) => new TableRow({ children: Array.from({ length: COLS }, (_, c) => {
    const n = ordered[c * nrows + r]
    return cell(keyCell(n), { fill: r % 2 ? D.tint : undefined, pad: [60, 60, 80, 80] })
  }) }))
  const answers = [...heading('Answer Key'), ...(nrows ? [table(keyRows, Array(COLS).fill(Math.floor(CW / COLS)))] : [])]

  if (Object.keys(SOL).length) {
    answers.push(para([], { before: 20 }), ...heading('Worked Solutions', 18))
    for (const g of groups) {
      answers.push(para([
        run(`${g.code}  `, { font: D.font_head, size: 11.5, bold: true, color: D.gold }),
        run(g.name, { font: D.font_head, size: 11.5, bold: true, color: D.navy }),
      ], { before: 8, after: 3, keepNext: true }))
      answers.push(table(g.questions.map(n => new TableRow({ children: [
        cell([text(String(NEW[n]), { size: 10, bold: true, color: D.navy })], { fill: D.tint, pad: [50, 50, 100, 100] }),
        cell([text(ANS[n] || '–', { font: D.font_head, size: 10.5, bold: true, color: D.navy }, { align: C })], { fill: D.tint, pad: [50, 50, 100, 100] }),
        cell([text(SOL[n] || '', { size: 10 })], { pad: [50, 50, 100, 100] }),
      ] })), [cm(1.2), cm(1.2), CW - cm(2.4)], RULE_BORDERS(), AlignmentType.LEFT))
    }
  }
  answers.push(
    para([], { before: 26 }),
    para([], { align: C, border: { top: line(D.gold, 8, 1) }, indent: { left: cm(5), right: cm(5) } }),
    text(D.author, { font: D.font_head, size: 13, bold: true, color: D.navy }, { align: C, before: 8 }),
    text(D.author_role, { size: 10, color: D.gold, italics: true }, { align: C, before: 2 }),
  )

  const doc = new Document({
    creator: D.author,
    title: `${title} – ${D.institute}`,
    fonts: [{ name: D.font_mm, data: Uint8Array.from(atob(BMEI04_BASE64), ch => ch.charCodeAt(0)) }],
    styles: { default: { document: { run: { font: D.font_body, size: D.size_body * 2, color: D.ink }, paragraph: { spacing: { after: 0, line: 264, lineRule: LineRuleType.AUTO } } } } },
    sections: [
      // cover + contents: no header/footer on the cover page
      { properties: { page, titlePage: true }, headers: { ...headers, first: new Header({ children: [para()] }) }, footers: { ...footers, first: new Footer({ children: [para()] }) },
        children: [...cover, ...contents] },
      { properties: { page, type: SectionType.NEXT_PAGE, column: { count: columns, space: cm(D.column_gap), separate: columns > 1 } }, headers, footers, children: qParas },
      { properties: { page, type: SectionType.NEXT_PAGE, column: { count: 1 } }, headers, footers, children: answers },
    ],
  })
  const blob = await fixFontEmbedding(await Packer.toBlob(doc))
  return { blob, count: total, groups, noAnswer: ordered.filter(n => !ANS[n]).map(n => NEW[n]) }
}

/** A file name for the booklet from the settings. */
export const bookletFileName = cfg =>
  (cfg.output && /\.docx$/i.test(cfg.output) ? cfg.output
    : `${String(cfg.title || 'Booklet').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '') || 'Booklet'}_GNSI.docx`)

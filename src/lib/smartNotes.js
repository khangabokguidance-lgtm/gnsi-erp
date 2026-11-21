// Smart study-material maker: turns text pasted from Word / PDF / a book into the notes markup the study material
// editor prints. It recognises
//   • questions and their (a)(b)(c)(d) options — even several options run together on one line,
//   • headings that only look like options ("A. Evaporation"),
//   • fractions typed as 3/4 or 2 1/2,
//   • Meetei Mayek typed with the Bmei04 font (it arrives as Latin letters when the font is lost),
//   • questions that talk about a figure, with or without a picture attached.
// Everything here is plain text in, plain text out, so it can be tested without a browser.
import { bmeiToUnicode } from '../mayekSegments.js'

const MARK_AT_START = /^\s*\(?([A-Da-d])[.)]\s*(?=\S)/
const QUESTION = /^\s*(?:Q(?:uestion)?\.?\s*)?\(?(\d{1,3})[.)]\s*(\S.*)$/i
const FIG_LINE = /^\[\[img:/
const FIG_WORDS = /\b(figure|fig\.|diagram|graph|chart|picture|map|pie\s*chart|bar\s*graph|table\s+given|shown\s+(?:below|above|here)|given\s+(?:below|above)|see\s+the)\b/i

// ── options ─────────────────────────────────────────────────────────────────────
// "(a) Freezing   (b) Condensation" → [['a','Freezing'],['b','Condensation']]; null when the line is not an option line.
// The letters must start the line and run in order (a, b, c, d), so ordinary words in brackets are left alone.
export function splitOptions(line) {
  const s = String(line ?? '')
  if (!MARK_AT_START.test(s)) return null
  // "(b)" may touch the text before it ("(A) 50(B) 100"); "b)" and "B." need a space before them
  const re = /(?:(?<=^|\s|\S)\(([A-Da-d])\)|(?:^|(?<=\s))([A-Da-d])[.)])(?=\s|$|\S)/g
  const hits = []
  for (let m; (m = re.exec(s)); ) hits.push({ at: m.index, end: m.index + m[0].length, letter: (m[1] || m[2]) })
  if (!hits.length || s.slice(0, hits[0].at).trim() !== '') return null
  const ok = [hits[0]]
  const lower = l => l === l.toLowerCase()
  for (const h of hits.slice(1)) {
    const prev = ok[ok.length - 1]
    if (h.letter.toLowerCase().charCodeAt(0) === prev.letter.toLowerCase().charCodeAt(0) + 1 && lower(h.letter) === lower(prev.letter)) ok.push(h)
    else break
  }
  return ok.map((h, i) => [h.letter, s.slice(h.end, i + 1 < ok.length ? ok[i + 1].at : s.length).trim()])
}

// ── fractions ───────────────────────────────────────────────────────────────────
// 3/4 → \frac{3}{4}; 2 1/2 → 2\frac{1}{2}. Dates (12/12/2026), units (km/h) and ratios inside words are left alone.
export function fractionsIn(text) {
  let n = 0
  const out = String(text ?? '')
    .replace(/(?<![\w./\\])(\d{1,4})[ ]+(\d{1,3})\s*\/\s*(\d{1,3})(?![\w/])/g, (m, w, a, b) => { n++; return `${w}\\frac{${a}}{${b}}` })
    .replace(/(?<![\w./\\{])(\d{1,4})\s*\/\s*(\d{1,4})(?![\w/}])/g, (m, a, b) => { n++; return `\\frac{${a}}{${b}}` })
  return { text: out, count: n }
}

// ── Bmei04 ──────────────────────────────────────────────────────────────────────
// Bmei04 text pasted without its font is Latin letters with capitals in the middle of words ("HudiZmKt paUHuM") and
// underscores for halant. English almost never does that, so a line where most longer words do is Bmei04.
export function looksBmei(line) {
  const s = String(line ?? '')
  if (/[ꫠ-꫿ꯀ-꯿]/.test(s)) return false           // already Meetei Mayek
  const words = s.match(/[A-Za-z][A-Za-z_]*/g) || []
  const long = words.filter(w => w.length >= 3)
  if (long.length < 2) return false
  // Bmei words carry two or more capitals inside them, or end in a capital ("HudiZmKt", "paUHuM", "sruK"); a brand name
  // such as iPhone or YouTube has just one, in the middle, so it does not count.
  const caps = w => (w.slice(1).match(/[A-Z]/g) || []).length
  const odd = long.filter(w => (w !== w.toUpperCase() && (caps(w) >= 2 || /[a-z][A-Z]$/.test(w))) || /[A-Za-z]_[A-Za-z]/.test(w))
  return odd.length >= 2 && odd.length / long.length >= 0.4
}

// ── the formatter ───────────────────────────────────────────────────────────────
export function smartFormat(src, { fractions = true, bmei = true } = {}) {
  const report = { questions: 0, optionLines: 0, split: 0, headings: 0, fractions: 0, bmeiLines: 0, joined: 0, figureQuestions: [] }
  const raw = String(src ?? '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n')
  // pass 1: classify every line
  const items = []
  for (const line of raw) {
    const t = line.trim()
    if (!t) { items.push({ kind: 'blank' }); continue }
    if (FIG_LINE.test(t)) { items.push({ kind: 'fig', text: t }); continue }
    const opts = splitOptions(t)
    if (opts) { items.push({ kind: 'opt', opts, raw: t }); continue }
    const q = t.match(QUESTION)
    if (q && !/^#/.test(t)) { items.push({ kind: 'q', no: q[1], text: q[2] }); continue }
    items.push({ kind: /^(#{1,3}\s|[-*•]\s|>|\||(?:answer|ans)\s*[:\-–])/i.test(t) ? 'struct' : 'text', text: t })
  }
  // pass 2: a run of option lines that does not start A, B… is really a heading ("A. Evaporation" above question 1)
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== 'opt') continue
    let j = i; const letters = []
    while (j < items.length && items[j].kind === 'opt') { items[j].opts.forEach(([l]) => letters.push(l.toLowerCase())); j++ }
    const valid = letters[0] === 'a' && letters.length >= 2
    if (!valid) for (let k = i; k < j; k++) { items[k] = { kind: 'heading', text: items[k].raw }; report.headings++ }
    i = j - 1
  }
  // pass 3: wrapped lines belong to the question / option above (PDF line breaks)
  const merged = []
  for (const it of items) {
    const prev = merged[merged.length - 1]
    if (it.kind === 'text' && prev && (prev.kind === 'q' || prev.kind === 'opt' || prev.kind === 'text') && !/[.?!:;]$/.test((prev.kind === 'opt' ? prev.opts[prev.opts.length - 1][1] : prev.text) || '') && /^[a-z(]/.test(it.text) && !splitOptions(it.text) && !looksBmei(it.text) && !(prev.text && looksBmei(prev.text))) {
      if (prev.kind === 'opt') prev.opts[prev.opts.length - 1][1] += ' ' + it.text
      else prev.text += ' ' + it.text
      report.joined++; continue
    }
    merged.push(it)
  }
  // pass 4: write it out
  const out = []
  let qBlock = null
  const finishBlock = () => { if (qBlock && FIG_WORDS.test(qBlock.text) && !qBlock.hasFig) report.figureQuestions.push(qBlock.no); qBlock = null }
  const frac = s => { if (!fractions) return s; const r = fractionsIn(s); report.fractions += r.count; return r.text }
  const mei = s => { if (bmei && looksBmei(s)) { report.bmeiLines++; return bmeiToUnicode(s) } return s }
  for (const it of merged) {
    if (it.kind === 'blank') { out.push(''); continue }
    if (it.kind === 'fig') { if (qBlock) qBlock.hasFig = true; out.push(it.text); continue }
    if (it.kind === 'q') { finishBlock(); report.questions++; qBlock = { no: it.no, text: it.text, hasFig: false }; out.push(`${it.no}. ${frac(mei(it.text))}`); continue }
    if (it.kind === 'opt') {
      if (it.opts.length > 1) report.split++
      for (const [l, t] of it.opts) { report.optionLines++; out.push(`(${l.toLowerCase()}) ${frac(mei(t))}`) }
      continue
    }
    if (it.kind === 'heading') { finishBlock(); out.push(`### ${it.text}`); continue }
    if (it.kind === 'struct') { out.push(it.text); continue }
    finishBlock()
    out.push(frac(mei(it.text)))
  }
  finishBlock()
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), report }
}

// ── figures ─────────────────────────────────────────────────────────────────────
// Questions that mention a figure, and whether a picture line already sits under them:
// [{ no, line, hasFigure }]. line is the question's line number in the text.
export function figureQuestions(src) {
  const lines = String(src ?? '').split('\n'), out = []
  for (let i = 0; i < lines.length; i++) {
    const q = lines[i].match(QUESTION)
    if (!q || /^\s*#/.test(lines[i])) continue
    let j = i + 1, text = q[2], has = false
    for (; j < lines.length && !QUESTION.test(lines[j]) && !/^\s*#{1,3}\s/.test(lines[j]); j++) { if (FIG_LINE.test(lines[j].trim())) has = true; else if (!splitOptions(lines[j]) && lines[j].trim()) text += ' ' + lines[j] }
    if (FIG_WORDS.test(text) || has) out.push({ no: q[1], line: i, hasFigure: has })
  }
  return out
}

// Put a figure line straight under a question's stem (before its options).
export function insertFigureAfterQuestion(src, line, figLine) {
  const lines = String(src ?? '').split('\n')
  let at = line + 1
  while (at < lines.length && lines[at].trim() && !splitOptions(lines[at]) && !QUESTION.test(lines[at])) at++   // wrapped stem lines
  lines.splice(at, 0, figLine)
  return lines.join('\n')
}

// Word paragraphs ({ text, images:[{dataUrl}] }, see cbtDocs.paragraphsFromDocx) → notes text with the pictures in place.
export function paragraphsToNotes(paras, figLine) {
  const lines = []
  for (const p of paras || []) {
    const t = String(p.text || '').trim()
    if (t) lines.push(t)
    for (const im of p.images || []) lines.push(figLine(im.dataUrl))
    if (!t && !(p.images || []).length) lines.push('')
  }
  return lines.join('\n')
}

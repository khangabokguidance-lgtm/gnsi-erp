// mayekPaper.js — the structure of a question paper for the Document
// Translator: which lines are questions, options, sections and instructions,
// the marks and answers written in the paper, and shuffled paper sets.
//
// Pipeline:
//   prepareSource(lines)  English lines -> items { en, marks, answer }:
//                         "Ans: b" lines are taken out and attached to their
//                         question, "(a) x (b) y" on one line is split into
//                         one option per line, "[2]" / "(2 marks)" at the end
//                         of a question becomes its marks.
//   (translation adds mm to each item)
//   buildModel(items)     -> { blocks } with questions grouped with their
//                         options. Numbers and option labels are taken off
//                         the text (English and Meetei Mayek) and printed by
//                         the renderers, so shuffled sets renumber cleanly.
//   makeSet(model, n)     -> the same paper shuffled for set n (0 = as written).
//   answerKey(model)      -> [{ no, answer }] for the key page.
// Pure functions, no DOM: the renderers are mayekDocx.js and mayekPaperHtml.js.

const MTEI_LETTER = 'ꯀ-ꯪ'
const Q_LABEL = /^\s*(?:Q\.?\s*|Question\s+)?\(?(\d{1,3})\s*[.):]\)?\s+(?=\S)/i
const OPT_LABEL = new RegExp(`^\\s*\\(?\\s*([a-hA-H]|i{1,3}|iv|vi{0,3}|[${MTEI_LETTER}])\\s*[.)]\\s*(?=\\S)|^\\s*\\(([a-hA-H])\\)\\s*(?=\\S)`)
const SECTION = /^(?:section|part|group)\s+[A-Z0-9]+\b/i
const ANSWER = /^\s*(?:ans(?:wer)?|correct\s+answer|key)\s*[:.\-–=]\s*(.+?)\s*$/i
const ANSWER_TAIL = /\s+(?:ans(?:wer)?)\s*[:.\-–=]\s*(\(?[a-hA-H]\)?|[^()]{1,40})\s*$/i
const MARKS_TAIL = /\s*(?:[[(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|m)?\s*[\])]|[-–]\s*(\d+(?:\.\d+)?)\s*marks?|(\d+(?:\.\d+)?)\s*marks?)\s*$/i
// Two or more option labels on one line: "(a) Delhi (b) Mumbai" / "a) 3  b) 4".
const INLINE_OPT = /(?:^|\s)\(?([a-hA-H])\s*[.)]\s+/g

export const LETTERS = 'abcdefgh'

/** 'blank' | 'section' | 'question' | 'option' | 'text' (from the English line) */
export function kindOf(text) {
  const t = String(text || '').trim()
  if (!t) return 'blank'
  if (SECTION.test(t) && t.length <= 60) return 'section'
  if (Q_LABEL.test(t)) return 'question'
  if (OPT_LABEL.test(t) && t.length <= 200) return 'option'
  return 'text'
}

/**
 * Split "(a) Delhi (b) Mumbai (c) …" into one option per line. A question
 * with its options on the same line ("1. Capital? (a) Delhi (b) Mumbai")
 * becomes the question line followed by the options. Labels must run a, b,
 * c… in order, so a stray "A." inside a sentence is left alone.
 */
export function splitInlineOptions(line) {
  const t = String(line || '')
  const hits = [...t.matchAll(INLINE_OPT)]
  if (hits.length < 2) return [t]
  const start = LETTERS.indexOf(hits[0][1].toLowerCase())
  if (hits.some((h, i) => LETTERS.indexOf(h[1].toLowerCase()) !== start + i)) return [t]
  const opts = hits.map((h, i) => t.slice(h.index, i + 1 < hits.length ? hits[i + 1].index : undefined).trim())
  if (hits[0].index <= 1) return opts
  const head = t.slice(0, hits[0].index).trim()
  return start === 0 && kindOf(head) === 'question' ? [head, ...opts] : [t]
}

const splitMarks = text => {
  const m = String(text).match(MARKS_TAIL)
  if (!m || m.index < 6) return { text, marks: '' }
  return { text: text.slice(0, m.index).trim(), marks: m[1] || m[2] || m[3] }
}

/** English lines -> items { en, marks, answer } (answer lines removed, inline options split). */
export function prepareSource(lines) {
  const items = []
  let lastQ = -1
  for (const raw of lines || []) {
    const line = String(raw || '').trim()
    const ans = line.match(ANSWER)
    if (ans && lastQ >= 0) { items[lastQ].answer = ans[1].trim(); continue }
    for (const part of splitInlineOptions(line)) {
      let en = part
      let answer = ''
      const tail = en.match(ANSWER_TAIL)
      if (tail && kindOf(en) === 'question') { answer = tail[1].trim(); en = en.slice(0, tail.index).trim() }
      let marks = ''
      if (kindOf(en) === 'question') ({ text: en, marks } = splitMarks(en))
      items.push({ en, marks, answer })
      if (kindOf(en) === 'question') lastQ = items.length - 1
      else if (kindOf(en) === 'section') lastQ = -1
    }
  }
  return items
}

/** Take the question number off a line (English or Meetei Mayek). */
export const stripQuestionLabel = t => String(t || '').replace(Q_LABEL, '').trim()
/** Take the option label off a line (English or Meetei Mayek). */
export const stripOptionLabel = t => String(t || '').replace(OPT_LABEL, '').trim()
const optionLetter = t => {
  const m = String(t || '').match(OPT_LABEL)
  const l = (m && (m[1] || m[2]) || '').toLowerCase()
  return LETTERS.includes(l) && l.length === 1 ? l : ''
}

/**
 * Items (with mm) -> { blocks }. A question block holds its own lines and
 * options in order: { type:'question', en, mm, marks, answer, body:[{ kind:
 * 'line'|'option', en, mm }] }. Other blocks: section, text.
 */
export function buildModel(items) {
  const blocks = []
  let q = null
  for (const it of items || []) {
    const kind = kindOf(it.en || it.mm)
    if (kind === 'blank') continue
    const en = it.en || '', mm = it.mm || ''
    if (kind === 'question') {
      q = { type: 'question', en: stripQuestionLabel(en), mm: stripQuestionLabel(mm), marks: it.marks || '', answer: it.answer || '', body: [] }
      blocks.push(q)
    } else if (kind === 'option' && q) {
      q.body.push({ kind: 'option', letter: optionLetter(en), en: stripOptionLabel(en), mm: stripOptionLabel(mm) })
    } else if (kind === 'section') {
      q = null
      blocks.push({ type: 'section', en, mm })
    } else if (q && !q.body.some(b => b.kind === 'option')) {
      q.body.push({ kind: 'line', en, mm }) // more of the question, before its options
    } else {
      q = null
      blocks.push({ type: 'text', en, mm })
    }
  }
  return { blocks }
}

/** Index of the answer among a question's options, or -1. */
export function answerIndex(q) {
  const opts = q.body.filter(b => b.kind === 'option')
  const a = String(q.answer || '').trim()
  if (!a || !opts.length) return -1
  const m = a.match(/^\(?([a-hA-H])\)?(?:[.)\s]|$)/)
  if (m) {
    const i = LETTERS.indexOf(m[1].toLowerCase())
    return i < opts.length ? i : -1
  }
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return opts.findIndex(o => norm(o.en) === norm(a))
}

// Small seeded random generator, so a set is the same every time it is made.
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function shuffle(list, rand) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export const SET_NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * The paper for set n: set 0 is the paper as written; others shuffle the
 * questions within each section (sections, instructions and text stay put)
 * and, when `options` is true, the options of each question whose options
 * come last. Answers move with their option.
 */
export function makeSet(model, n, { options = true, seed = 1 } = {}) {
  const copyQ = q => ({ ...q, body: q.body.map(b => ({ ...b })) })
  if (!n) return { blocks: model.blocks.map(b => (b.type === 'question' ? copyQ(b) : { ...b })) }
  const rand = rng(seed * 7919 + n * 104729)
  const out = []
  let run = []
  const flush = () => { out.push(...shuffle(run, rand)); run = [] }
  for (const b of model.blocks) {
    if (b.type !== 'question') { flush(); out.push({ ...b }); continue }
    const q = copyQ(b)
    const opts = q.body.filter(x => x.kind === 'option')
    const optionsLast = opts.length >= 2 && q.body.findIndex(x => x.kind === 'option') === q.body.length - opts.length
    if (options && optionsLast) {
      const ai = answerIndex(q)
      const order = shuffle(opts.map((_, i) => i), rand)
      q.body = [...q.body.filter(x => x.kind !== 'option'), ...order.map(i => opts[i])]
      if (ai >= 0) q.answer = LETTERS[order.indexOf(ai)]
    }
    run.push(q)
  }
  flush()
  return { blocks: out }
}

/** Display numbers: questions 1…N in order. */
export function numbered(model) {
  let n = 0
  return model.blocks.map(b => (b.type === 'question' ? { ...b, no: ++n } : b))
}

/** [{ no, letter, text }] for the answer key. letter is '' when the answer isn't an option. */
export function answerKey(model) {
  return numbered(model).filter(b => b.type === 'question').map(q => {
    const i = answerIndex(q)
    const opt = i >= 0 ? q.body.filter(b => b.kind === 'option')[i] : null
    return { no: q.no, letter: i >= 0 ? LETTERS[i] : '', text: opt ? (opt.mm || opt.en) : q.answer }
  })
}

/** Paper statistics for the screen. */
export function paperStats(model) {
  const qs = model.blocks.filter(b => b.type === 'question')
  const marks = qs.reduce((t, q) => t + (parseFloat(q.marks) || 0), 0)
  return {
    questions: qs.length,
    mcq: qs.filter(q => q.body.some(b => b.kind === 'option')).length,
    withMarks: qs.filter(q => q.marks).length,
    marks: Math.round(marks * 100) / 100,
    answers: qs.filter(q => q.answer).length,
    maxOptions: Math.max(0, ...qs.map(q => q.body.filter(b => b.kind === 'option').length)),
  }
}

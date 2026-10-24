// cbtPaper.js — turn a question paper (paragraph lines) into a CBT test.
// Pure: no browser or database. The English paper decides the structure (sections, passages,
// questions, options); the Meitei Mayek paper, parsed the same way, is matched question by number.
//
// Recognised: "SECTION - A MENTAL ABILITY TEST" (title on the same or the next line), "Directions: …",
// "Q12. text" (the Q may be missing — "64. text" — when the number follows the last one), (A) … (D)
// options on their own lines or two to a line, a long paragraph before questions as a reading passage,
// and a question with no text and no options as a figure question (its picture holds the options).

export const OPTION_KEYS = ['A', 'B', 'C', 'D']
const PASSAGE_MIN = 140

const SECTION = /^SECTION\s*[-–—:]?\s*([A-Za-z0-9]+)\s*[-–—:]?\s*(.*)$/i
const MM_SECTION = /^seKsN\b\s*[-–—:]?\s*(\S+)?\s*(.*)$/
const QLABEL = /^(Q\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i
const OPTION = /^\(?\s*([A-Da-d])\s*\)\s*/
const DIRECTIONS = /^Directions?\s*:/i
// "Page - 3" (or the BMEI04 spelling) left behind by a footer — never part of a question or option.
const PAGE_MARK = /^(page|pesej)\s*[-–—.:]?\s*\d{1,3}$/i
const MM_DIRECTIONS = /^mwoZ\s*taKp\s*:/

function splitOptions(line) {
  const parts = []
  const re = /\(\s*([A-Da-d])\s*\)/g
  const hits = []
  let m
  while ((m = re.exec(line))) hits.push({ key: m[1].toUpperCase(), at: m.index, end: re.lastIndex })
  hits.forEach((h, i) => parts.push({ key: h.key, text: line.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : undefined).trim() }))
  return parts
}

// lines: [{ text, raw, images }] (or plain strings). mm: parsing the Meitei Mayek paper (its section words are BMEI04).
// A picture belongs to the question it follows (its own paragraph, or the Q line itself).
export function parseLines(lines, { mm = false } = {}) {
  const sections = []
  const warnings = []
  let orphans = 0
  let sec = null, q = null, passage = '', lastNo = 0, titleNext = false
  const need = () => { if (!sec) { sec = { label: '', title: '', directions: '', questions: [] }; sections.push(sec) } return sec }
  const step = (text, raw) => {
    if (PAGE_MARK.test(text) || PAGE_MARK.test(raw)) return
    if (!text) { if (q && q.options.length) q.done = true; return }
    const sm = mm ? raw.match(MM_SECTION) : text.match(SECTION)
    if (sm && !QLABEL.test(text)) {
      q = null; passage = ''
      sec = { label: mm ? '' : sm[1], title: mm ? '' : (sm[2] || '').trim(), directions: '', questions: [] }
      if (mm) { const t = text.replace(/^\S+\s*[-–—:]?\s*\S*\s*/, ''); sec.title = t.trim() }
      sections.push(sec); titleNext = !sec.title
      return
    }
    if (titleNext && !QLABEL.test(text) && !OPTION.test(text) && !(mm ? MM_DIRECTIONS.test(raw) : DIRECTIONS.test(text))) { sec.title = text; titleNext = false; return }
    titleNext = false
    if (mm ? MM_DIRECTIONS.test(raw) : DIRECTIONS.test(text)) { need().directions = text.replace(mm ? /^\S+\s*\S*\s*:\s*/ : /^Directions?\s*:\s*/i, '').trim() || text; q = null; return }
    const ql = text.match(QLABEL)
    if (ql && (ql[1] || (ql[2] && Number(ql[2]) === lastNo + 1 && lastNo > 0))) {
      const no = Number(ql[2])
      q = { no, text: ql[3].trim(), options: [], passage, done: false, figures: [] }
      need().questions.push(q); lastNo = no
      return
    }
    if (OPTION.test(text) && q) {
      for (const o of splitOptions(text)) {
        if (q.options.some(x => x.key === o.key)) warnings.push(`Q${q.no}: option (${o.key}) appears twice`)
        q.options.push(o)
      }
      return
    }
    if (q && !q.options.length) { q.text = q.text ? `${q.text}\n${text}` : text; return }
    if (text.length >= PASSAGE_MIN || (!q && text.length > 60)) { passage = text; q = null; return }
    // Right after an option (no blank line yet) a short line continues that option; after a blank line it is a
    // label such as "PASSAGE" or "Passage - 2" and is skipped.
    if (q && q.options.length && !q.done) { const last = q.options[q.options.length - 1]; last.text = `${last.text} ${text}`.trim() }
  }
  for (const item of lines || []) {
    const text = String(typeof item === 'string' ? item : item.text || '').trim()
    const raw = String(typeof item === 'string' ? item : item.raw ?? item.text ?? '').trim()
    step(text, raw)
    const imgs = typeof item === 'string' ? [] : item.images || []
    if (imgs.length) { if (q) q.figures.push(...imgs); else orphans += imgs.length }
  }
  if (orphans) warnings.push(`${orphans} picture${orphans === 1 ? '' : 's'} sit outside any question (a logo or a heading picture?) and were left out`)
  return { sections, warnings }
}

// English paper (+ optional Meitei Mayek paper) → test sections.
export function buildTest(enLines, mmLines = null) {
  const en = parseLines(enLines)
  const mm = mmLines ? parseLines(mmLines, { mm: true }) : null
  const warnings = [...en.warnings]
  const mmByNo = new Map()
  if (mm) {
    warnings.push(...mm.warnings.map(w => `Meitei Mayek paper — ${w}`))
    for (const s of mm.sections) for (const q of s.questions) mmByNo.set(q.no, q)
  }
  const seen = new Set()
  const sections = en.sections.filter(s => s.questions.length).map((s, si) => {
    const ms = mm?.sections.filter(x => x.questions.length)[si]
    return {
      id: `s${si + 1}`, label: s.label, title: s.title, titleMm: ms?.title || '', directions: s.directions, directionsMm: ms?.directions || '',
      questions: s.questions.map(q => {
        if (seen.has(q.no)) warnings.push(`Question ${q.no} appears twice`)
        seen.add(q.no)
        const m = mmByNo.get(q.no)
        const isFigure = !q.text && !q.options.length
        const mf = m?.figures || []
        const options = OPTION_KEYS.map(k => {
          const e = q.options.find(o => o.key === k), t = m?.options.find(o => o.key === k)
          return isFigure ? { key: k, text: '', textMm: '' } : e || t ? { key: k, text: e?.text || '', textMm: t?.text || '' } : null
        }).filter(Boolean)
        if (!isFigure && options.length !== 4) warnings.push(`Question ${q.no} has ${options.length} option${options.length === 1 ? '' : 's'} (expected 4)`)
        if (mm && !m) warnings.push(`Question ${q.no} is missing from the Meitei Mayek paper`)
        if (m && !isFigure && !m.text) warnings.push(`Question ${q.no}: Meitei Mayek text is empty`)
        const pics = q.figures.map(f => f.dataUrl) // the English paper's own pictures; the Meitei Mayek paper's are only used to cross-check
        return { no: q.no, figure: isFigure, text: q.text, textMm: m?.text || '', options, passage: q.passage || '', passageMm: m?.passage || '', image: pics[0] || null, images: pics, figHash: q.figures.map(f => f.hash), figHashMm: mf.map(f => f.hash), answer: null }
      }),
    }
  })
  const nos = [...seen].sort((a, b) => a - b)
  for (let i = 1; i <= (nos[nos.length - 1] || 0); i++) if (!seen.has(i)) warnings.push(`Question ${i} was not found — check the paper`)
  if (mm) for (const n of mmByNo.keys()) if (!seen.has(n)) warnings.push(`Question ${n} is only in the Meitei Mayek paper`)
  return { sections, warnings }
}

// Pictures are matched to questions by position (the question they follow). Only when the paper gave no
// positioned pictures at all — pictures stored in a separate place — do figure questions take pictures in order.
export function attachImages(sections, images) {
  const qs = sections.flatMap(s => s.questions)
  const fig = qs.filter(q => q.figure)
  const warnings = []
  if (qs.some(q => q.images?.length)) {
    for (const q of fig) if (!q.image) warnings.push(`Question ${q.no} looks like a figure question but no picture was found with it`)
    return warnings
  }
  if (!images.length) { for (const q of fig) warnings.push(`Question ${q.no} looks like a figure question but the paper has no pictures`); return warnings }
  if (fig.length !== images.length) warnings.push(`${fig.length} figure question${fig.length === 1 ? '' : 's'} but ${images.length} picture${images.length === 1 ? '' : 's'} in the paper — check the order`)
  fig.forEach((q, i) => { q.image = images[i]?.dataUrl || null; q.images = q.image ? [q.image] : []; if (!q.image) warnings.push(`Question ${q.no} has no picture`) })
  return warnings
}

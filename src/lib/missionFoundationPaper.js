// Mission Foundation combined question paper: all six subjects in one booklet, one sitting.
// Pure functions (unit-tested): the section model with continuous numbering, and the printable HTML.
import { mathToHtml, mathPlain, MATH_CSS } from './mathText.js'
import { makeVersion } from './missionSainikPaper.js'
import { SOFTWARE_CREDIT } from './credit.js'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const LETTERS = 'ABCDEFGHIJ'

// papers: the test's subject papers in order; questions: rows of mission_foundation_questions for the test.
// set 'A' keeps the order as typed; 'B' / 'C' shuffle the questions inside each section and their options (same seed → same paper).
export function paperModel(papers, questions, { set = 'A', seed = '' } = {}) {
  let no = 1
  const sections = papers.map((p, i) => {
    const raw = questions.filter(q => q.subject === p.subject).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
    const items = makeVersion(raw, { seed: `${seed}:${set}:${p.subject}`, shuffleQ: set !== 'A', shuffleOpts: set !== 'A' })
    const start = no
    no += items.length
    const marksEach = Number(p.marks_each) || 0
    return { letter: LETTERS[i] || String(i + 1), subject: p.subject, wanted: Number(p.questions) || 0, marksEach, items, start, end: no - 1, marks: items.length * marksEach }
  })
  return { sections, total: no - 1, marks: sections.reduce((n, s) => n + s.marks, 0), wanted: sections.reduce((n, s) => n + s.wanted, 0) }
}

function optionsHtml(opts) {
  const len = Math.max(...opts.map(o => mathPlain(o.text).length))
  const cls = len <= 11 ? 'o4' : len <= 27 ? 'o2' : 'o1'
  return `<div class="op ${cls}">${opts.map(o => `<span>(${o.k}) ${mathToHtml(o.text)}</span>`).join('')}</div>`
}

// The question booklet. o: { institute, title, subtitle, date, minutes, columns (1|2), size (px), set, instructions }
export function paperHtml(model, o = {}) {
  const cols = Number(o.columns) === 2 ? 2 : 1
  const size = Number(o.size) || 13
  let lastPassage = ''
  const body = model.sections.map(s => {
    if (!s.items.length) return ''
    lastPassage = ''
    const qs = s.items.map((q, i) => {
      const p = q.passage && q.passage !== lastPassage ? `<div class="ps"><i>Read the passage and answer the questions that follow:</i><div>${mathToHtml(q.passage)}</div></div>` : ''
      lastPassage = q.passage || ''
      return `${p}<div class="q"><div class="qt"><b>${s.start + i}.</b><span>${mathToHtml(q.question)}</span></div>${q.image_data && /^data:image\//.test(q.image_data) ? `<img class="oi" src="${esc(q.image_data)}" alt="Figure">` : ''}${optionsHtml(q.opts)}</div>`
    }).join('')
    return `<div class="sec"><div class="sh">Section ${esc(s.letter)} · ${esc(s.subject)} <small>(Q ${s.start}–${s.end} · ${s.items.length} × ${s.marksEach} = ${s.marks} marks)</small></div>${qs}</div>`
  }).join('')
  const instructions = String(o.instructions || '').split(/\r?\n/).filter(x => x.trim())
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title || 'Question paper')}</title><style>
@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media screen{body{padding:14px 18px}}
body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:${size}px;line-height:1.45;margin:0}
.hd{text-align:center;border-bottom:2px solid #132a4f;padding-bottom:6px;margin-bottom:8px}.hd h1{margin:0;font-size:${size + 6}px;color:#132a4f}.hd h2{margin:2px 0 0;font-size:${size + 2}px}
.mt{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:${size - 1}px;margin:6px 0}
.st{display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;font-family:Arial,sans-serif;font-size:${size - 1}px;margin:6px 0}.st div{border:1px solid #555;padding:5px 7px}
.in{font-family:Arial,sans-serif;font-size:${size - 2}px;border:1px solid #999;padding:6px 10px;margin:6px 0 10px}.in ol{margin:2px 0;padding-left:18px}
.cols{column-count:${cols};column-gap:22px;${cols === 2 ? 'column-rule:1px solid #bbb;' : ''}}
.sec{margin-bottom:6px}.sh{break-after:avoid;background:#e8ecf4;border:1px solid #132a4f;font-family:Arial,sans-serif;font-weight:700;padding:4px 8px;margin:6px 0;font-size:${size}px}.sh small{font-weight:400}
.q{break-inside:avoid;margin:0 0 8px}.qt{display:flex;gap:6px}.qt b{min-width:24px}
.op{margin:2px 0 0 30px;display:grid;gap:2px 12px}.op.o4{grid-template-columns:repeat(4,auto);justify-content:start}.op.o2{grid-template-columns:1fr 1fr}.op.o1{grid-template-columns:1fr}
.ps{break-inside:avoid;border-left:3px solid #132a4f;padding:2px 8px;margin:4px 0 6px;font-size:${size - 0.5}px}
img.oi{max-width:100%;max-height:160px;display:block;margin:4px 0}
.end{text-align:center;font-family:Arial,sans-serif;margin-top:10px;font-weight:700}.cr{text-align:center;font:italic 9px Georgia,serif;color:#8a6118;margin-top:4px}
${MATH_CSS}</style></head><body>
<div class="hd"><h1>${esc(o.institute || 'Guidance Navodaya & Sainik Institute')}</h1><h2>${esc(o.title || '')}${o.set && o.set !== 'A' ? ` · Set ${esc(o.set)}` : ''}</h2>${o.subtitle ? `<div>${esc(o.subtitle)}</div>` : ''}</div>
<div class="mt"><span>Date: ${esc(o.date || '')}</span><span>Time: ${esc(o.minutes || '—')} minutes</span><span>Questions: ${model.total}</span><span>Full marks: ${model.marks}</span></div>
<div class="st"><div>Name:</div><div>Batch:</div><div>GCC / Roll no.:</div></div>
${instructions.length ? `<div class="in"><b>Instructions</b><ol>${instructions.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
<div class="cols">${body}</div><div class="end">— End of paper —</div><div class="cr">${esc(SOFTWARE_CREDIT)}</div>
${o.autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)<' + '/script>' : ''}</body></html>`
}

// Answer key: section by section, question number → letter (with the explanation when there is one).
export function answerKeyHtml(model, o = {}) {
  const rows = model.sections.filter(s => s.items.length).map(s => `<h3>Section ${esc(s.letter)} · ${esc(s.subject)}</h3><div class="g">${s.items.map((q, i) => `<div><b>${s.start + i}.</b> ${esc(q.answer)}</div>`).join('')}</div>
    ${o.explanations ? `<ol start="${s.start}" class="ex">${s.items.map(q => `<li>${esc(q.answer)}${q.explanation ? ' — ' + mathToHtml(q.explanation) : ''}</li>`).join('')}</ol>` : ''}`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Answer key</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px}
h1{font-size:16px;text-align:center;margin:0}h2{font-size:13px;text-align:center;margin:2px 0 10px;font-weight:600}h3{font-size:13px;margin:10px 0 4px;color:#132a4f}
.g{display:grid;grid-template-columns:repeat(10,1fr);gap:3px}.g div{border:1px solid #ccc;padding:3px 5px}.ex{font-size:11px;color:#333}${MATH_CSS}</style></head><body>
<h1>${esc(o.institute || 'Guidance Navodaya & Sainik Institute')}</h1><h2>Answer key · ${esc(o.title || '')}${o.set && o.set !== 'A' ? ` · Set ${esc(o.set)}` : ''}</h2>${rows}
${o.autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)<' + '/script>' : ''}</body></html>`
}

export const PAPER_INSTRUCTIONS = 'This paper has all six subjects. Answer every section in the same sitting.\nEach question has four options. Choose the one correct answer.\nWrite or darken your answer on the OMR / answer sheet with a blue or black pen.\nThere is no negative marking.\nMobile phones and calculators are not allowed.'

// Next position for new questions in a subject (keeps typed order after deletes).
export const nextPosition = (questions, subject) => questions.filter(q => q.subject === subject).reduce((m, q) => Math.max(m, Number(q.position) || 0), 0) + 1

// detectQuestions.js — does this pasted / imported text contain questions? A question is a numbered line ("1." "Q2)" "3:")
// followed by at least two lettered options (A) B) …). Pure function: used by the study-material editor and the question uploaders.
const STEM = /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):-]\s*(\S.*)$/i
const OPT = /^(?:[-*•]\s*)?\(?([A-Da-d])\s*[.):]\s*\S/
// options written side by side on one line: "(A) one  (B) two  (C) three  (D) four"
const INLINE = /(?:^|\s)\(?([A-Da-d])\s*[.)]\s+\S/g
const optsIn = ln => Math.max(1, new Set([...ln.matchAll(INLINE)].map(m => m[1].toUpperCase())).size)
const ANS = /^(?:ans(?:wer)?|correct(?: answer)?)\s*[:-]\s*\(?([A-Da-d])\b/i

// → { kind: 'empty' | 'notes' | 'questions' | 'mixed', questions, withAnswers, numberedNoOptions, lines, text }
//   kind: 'questions' when almost everything is questions, 'mixed' when questions sit among notes, 'notes' when there are none.
export function detectQuestions(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean)
  if (!lines.length) return { kind: 'empty', questions: 0, withAnswers: 0, numberedNoOptions: 0, lines: 0, text: '' }
  let questions = 0, withAnswers = 0, numberedNoOptions = 0, inQ = false, opts = 0, ans = false, qLines = 0, stems = 0
  const close = () => { if (!stems) return; if (opts >= 2) { questions++; if (ans) withAnswers++ } else numberedNoOptions++; stems = 0; opts = 0; ans = false }
  for (const ln of lines) {
    if (OPT.test(ln) && stems) { opts += optsIn(ln); qLines++; continue }
    if (ANS.test(ln) && stems) { ans = true; qLines++; continue }
    if (STEM.test(ln) && !/^(ans|exp|topic|level|difficulty)/i.test(ln)) {
      // a numbered line that follows a finished question starts a new one; a numbered list inside notes without options is counted separately
      close(); stems = 1; inQ = true; qLines++; continue
    }
    if (stems && opts === 0) qLines++       // a wrapped second line of the question stem
    else if (stems && opts > 0 && !OPT.test(ln) && !ANS.test(ln) && !/^(exp|explanation|topic|level|difficulty)\s*[:-]/i.test(ln)) { close(); inQ = false }
    else if (stems) qLines++
  }
  close()
  const share = qLines / lines.length
  const kind = !questions ? 'notes' : share >= .7 ? 'questions' : 'mixed'
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  const message = kind === 'notes'
    ? (numberedNoOptions ? `No questions found. ${plural(numberedNoOptions, 'numbered line')} had no A–D options.` : 'No questions found — this looks like notes.')
    : `${kind === 'questions' ? 'Question paper' : 'Notes with questions'}: ${plural(questions, 'question')}${withAnswers === questions ? ', all with answers' : withAnswers ? `, ${withAnswers} with answers` : ', no answers'}${numberedNoOptions ? ` · ${plural(numberedNoOptions, 'numbered line')} without options` : ''}.`
  return { kind, questions, withAnswers, numberedNoOptions, lines: lines.length, text: message }
}

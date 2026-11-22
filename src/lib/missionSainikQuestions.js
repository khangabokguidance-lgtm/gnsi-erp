// Pure helpers for the Mission Sainik question builders (kept out of the component so they can be unit-tested).

import { applyAnswerKey } from './questionPaste.js'

// Free-text format, one question after another:
//   Q1. question text
//   A) option   B) option   C) option   D) option   (each on its own line)
//   Ans: B
//   Exp: one-line explanation        (optional)
//   Topic: Fractions                 (optional)
//   Level: Easy | Medium | Hard      (optional)
export function parseQuestions(text) {
  const out = [], errors = []
  let cur = null, field = null, passage = ''
  const push = () => {
    if (!cur) return
    const miss = []
    if (!cur.question) miss.push('question')
    ;['a', 'b', 'c', 'd'].forEach(k => { if (!cur['option_' + k]) miss.push('option ' + k.toUpperCase()) })
    if (!cur.answer) miss.push('Ans')
    if (miss.length) errors.push(`Question ${out.length + errors.length + 1}: missing ${miss.join(', ')}`)
    else out.push(cur)
    cur = null; field = null
  }
  for (const raw of String(text || '').split(/\r?\n/)) {
    const ln = raw.trim()
    if (!ln) continue
    let m
    if ((m = ln.match(/^passage\s*[:-]\s*(.*)$/i))) { push(); passage = /^(none|-)$/i.test(m[1].trim()) ? '' : m[1].trim(); field = 'passage'; continue }
    if (/^end\s*passage/i.test(ln)) { push(); passage = ''; field = null; continue }
    if ((m = ln.match(/^(?:Q(?:uestion)?\s*\d*|\d+)\s*[.):-]\s*(.*)$/i)) && !/^(ans|exp|topic|level|difficulty)/i.test(ln)) {
      push(); cur = { question: m[1].trim(), option_a: '', option_b: '', option_c: '', option_d: '', answer: '', explanation: '', topic: '', difficulty: null, ...(passage ? { passage } : {}) }; field = 'question'; continue
    }
    if (!cur) { if (field === 'passage' && !/^end\s*passage/i.test(ln)) passage = (passage + ' ' + ln).trim(); continue }
    if ((m = ln.match(/^(\()?([A-D])\s*([.):])\s*(.*)$/i))) {
      // Several options on one line: "(a) Freezing (b) Condensation". The next marker must be the next letter in sequence AND
      // written the same way as the first ("(b)" after "(a)", "B)" after "A)", "B." after "A."), so text like "and d. both" is not split.
      const paren = !!m[1], punct = m[3].replace(/[.)]/, c => '\\' + c)
      let letter = m[2].toLowerCase(), rest = m[4]
      for (;;) {
        const next = String.fromCharCode(letter.charCodeAt(0) + 1)
        const re = paren ? new RegExp('\\s+\\(' + next + '\\)\\s*\\S', 'i') : new RegExp('\\s+' + next + punct + '\\s*\\S', 'i')
        const cut = next <= 'd' ? rest.search(re) : -1
        if (cut < 0) break
        cur['option_' + letter] = rest.slice(0, cut).trim()
        rest = rest.slice(cut).trim().replace(/^\(?[A-D]\s*[.):]\s*/i, '')
        letter = next
      }
      field = 'option_' + letter; cur[field] = rest.trim(); continue
    }
    if ((m = ln.match(/^(?:ans(?:wer)?|correct(?: answer)?)\s*[:-]\s*\(?([A-D])\b/i))) { cur.answer = m[1].toUpperCase(); field = null; continue }
    if ((m = ln.match(/^(?:exp(?:lanation)?)\s*[:-]\s*(.*)$/i))) { cur.explanation = m[1].trim(); field = 'explanation'; continue }
    if ((m = ln.match(/^topic\s*[:-]\s*(.*)$/i))) { cur.topic = m[1].trim(); field = 'topic'; continue }
    if ((m = ln.match(/^(?:level|difficulty)\s*[:-]\s*(easy|medium|hard)/i))) { cur.difficulty = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); field = null; continue }
    if (field) cur[field] = (cur[field] + ' ' + ln).trim()
  }
  push()
  return { questions: out, errors }
}


// PostgREST returns at most 1000 rows per request. The question bank can hold ~3000 rows (20 tests × 150 questions),
// so load it page by page; otherwise questions silently vanish from papers and duplicate checks.
export async function fetchAll(makeQuery, page = 1000) {
  const all = []
  for (let from = 0; ; from += page) {
    const { data, error } = await makeQuery().range(from, from + page - 1)
    if (error) return { data: null, error }
    all.push(...(data || []))
    if (!data || data.length < page) return { data: all, error: null }
  }
}


// Questions pasted as text + an optional separate answer key ("1-C 2-B 3-A"): the key fills in the missing "Ans:" lines by question number.
export function parseWithKey(text, keyText = '') {
  const t = String(text || ''), k = String(keyText || '').trim()
  return parseQuestions(k ? applyAnswerKey(t.replace(/\s+$/, '') + '\nAnswer key: ' + k) : t)
}

// "Question 3: missing option B, option D, Ans" → "Q3: add option B, option D and the answer" (short and plain, for phones)
export function friendlyErrors(errors = []) {
  return errors.map(e => {
    const m = String(e).match(/^Question (\d+): missing (.*)$/)
    if (!m) return String(e)
    const parts = m[2].split(', ').map(x => (x === 'Ans' ? 'the answer' : x))
    return `Q${m[1]}: add ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}`
  })
}

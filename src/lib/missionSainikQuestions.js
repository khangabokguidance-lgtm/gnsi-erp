// Pure helpers for the Mission Sainik question builders (kept out of the component so they can be unit-tested).

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
    if ((m = ln.match(/^\(?([A-D])\s*[.):]\s*(.*)$/i))) { field = 'option_' + m[1].toLowerCase(); cur[field] = m[2].trim(); continue }
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
export async function fetchAll(makeQuery, page = 1000, parallel = 4) {
  // The first page alone (most lists fit in it). If it is full, the rest is requested a few pages at a time; the queries must be ordered so the pages line up.
  const first = await makeQuery().range(0, page - 1)
  if (first.error) return { data: null, error: first.error }
  const all = [...(first.data || [])]
  if (all.length < page) return { data: all, error: null }
  for (let start = page; ; start += page * parallel) {
    const batch = await Promise.all(Array.from({ length: parallel }, (_, i) => makeQuery().range(start + i * page, start + (i + 1) * page - 1)))
    for (const r of batch) if (r.error) return { data: null, error: r.error }
    for (const { data } of batch) {
      all.push(...(data || []))
      if (!data || data.length < page) return { data: all, error: null }
    }
  }
}

// Helpers that make pasting questions forgiving: split one pasted question into card fields, and apply a trailing answer key.

// One pasted question (question text, then options A–D, optional "Ans: B") → card fields, or null if it has no options.
export function splitPastedQuestion(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 3) return null
  const optRe = /^\(?([A-Da-d])\s*[.):]\s*(.*)$/
  const out = { question: '', a: '', b: '', c: '', d: '', ans: '', exp: '' }
  let cur = 'question', seen = 0
  for (const ln of lines) {
    let m
    if ((m = ln.match(/^(?:ans(?:wer)?|correct(?: answer)?)\s*[:\-.]?\s*\(?([A-Da-d])\b/i))) { out.ans = m[1].toUpperCase(); cur = null; continue }
    if ((m = ln.match(/^exp(?:lanation)?\s*[:\-]\s*(.*)$/i))) { out.exp = m[1].trim(); cur = 'exp'; continue }
    if ((m = ln.match(optRe)) && (seen > 0 || m[1].toLowerCase() === 'a')) { cur = m[1].toLowerCase(); out[cur] = m[2].trim(); seen++; continue }
    if (cur) out[cur] = (out[cur] + ' ' + ln).trim()
  }
  out.question = out.question.replace(/^(?:Q(?:uestion)?\s*\d*|\d+)\s*[.):-]\s*/i, '').trim()
  return seen >= 2 && out.question ? out : null
}

// How many separate questions does this text hold? (lines that start like "Q3." / "3)")
export const countQuestionStarts = text => String(text || '').split(/\r?\n/).filter(l => /^\s*(?:Q(?:uestion)?\s*\d*|\d+)\s*[.):-]\s*\S/i.test(l) && !/^\s*(ans|exp|topic|level)/i.test(l)).length

// "Answer key: 1-B 2-C 3.A …" at the end of a paste → "Ans: X" added to questions that have none. Returns the cleaned text.
export function applyAnswerKey(text) {
  const lines = String(text || '').split(/\r?\n/)
  const at = lines.findIndex(l => /^\s*(?:answers?|answer\s*key|key)\b\s*[:\-]?/i.test(l) && !/^\s*answer\s*[:\-]?\s*\(?[A-D]\)?\s*$/i.test(l))
  if (at < 0) return text
  const keyText = lines.slice(at).join(' ')
  const key = {}
  for (const m of keyText.matchAll(/(\d+)\s*[.):\-–]?\s*\(?([A-Da-d])\)?(?![a-z])/g)) key[Number(m[1])] = m[2].toUpperCase()
  if (!Object.keys(key).length) return text
  const body = lines.slice(0, at)
  const out = []; let n = 0, block = []
  const flush = () => {
    if (!block.length) return
    if (!block.some(l => /^\s*(?:ans(?:wer)?|correct)/i.test(l)) && key[block.num]) block.push('Ans: ' + key[block.num])
    out.push(...block); block = []
  }
  for (const l of body) {
    const m = l.match(/^\s*(?:Q(?:uestion)?\s*)?(\d+)\s*[.):-]\s*\S/i)
    if (m && !/^\s*(ans|exp|topic|level)/i.test(l)) { flush(); n++; block = []; block.num = Number(m[1]) || n }
    if (block.num != null || out.length === 0 && !block.length) block.push(l); else out.push(l)
  }
  flush()
  return out.join('\n')
}

// cbtCompare.js — the English ⇄ Meitei Mayek side-by-side view in the CBT builder. Pure.
// Numbers do not change with language (Meitei Mayek digits are read as the same digits), so a number that is
// in one language and has no partner in the other points at a mistake in the translation or the conversion.
import { toAscii } from './cbtVerify.js'

const tokens = t => (toAscii(t).match(/\d+(?:[.,]\d+)*/g) || []).map(x => x.replace(/,/g, ''))

// { en: [{ n, miss }], mm: [{ n, miss }], same, any } — numbers in the order they appear; `miss` = this
// occurrence has no partner in the other language (matched one-for-one, so a repeated number counts).
export function numberDiff(enText, mmText) {
  const a = tokens(enText), b = tokens(mmText)
  const pool = new Map()
  for (const n of b) pool.set(n, (pool.get(n) || 0) + 1)
  const en = a.map(n => { const left = pool.get(n) || 0; if (left > 0) { pool.set(n, left - 1); return { n, miss: false } } return { n, miss: true } })
  const pool2 = new Map()
  for (const n of a) pool2.set(n, (pool2.get(n) || 0) + 1)
  const mm = b.map(n => { const left = pool2.get(n) || 0; if (left > 0) { pool2.set(n, left - 1); return { n, miss: false } } return { n, miss: true } })
  return { en, mm, same: en.every(x => !x.miss) && mm.every(x => !x.miss), any: a.length + b.length > 0 }
}

// Aligned rows of one question: the question, each option, the passage. For a figure question only the passage
// row is meaningful (the picture holds the problem and options).
export function compareRows(q) {
  const rows = []
  if (!q.figure) {
    rows.push({ id: 'q', label: 'Q', title: 'Question', en: q.text || '', mm: q.textMm || '' })
    for (const o of q.options || []) rows.push({ id: 'o' + o.key, label: o.key, title: `Option ${o.key}`, en: o.text || '', mm: o.textMm || '' })
  }
  if (q.passage || q.passageMm) rows.push({ id: 'p', label: 'P', title: 'Passage', en: q.passage || '', mm: q.passageMm || '' })
  return rows.map(r => ({ ...r, diff: numberDiff(r.en, r.mm), missingMm: !String(r.mm).trim() && !!String(r.en).trim(), missingEn: !String(r.en).trim() && !!String(r.mm).trim() }))
}

// How many rows have numbers that do not agree, and how many have text in one language only.
export const compareSummary = rows => ({
  numberMismatch: rows.filter(r => r.diff.any && !r.diff.same).length,
  oneSided: rows.filter(r => r.missingMm || r.missingEn).length,
})

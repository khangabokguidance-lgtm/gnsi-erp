// missionSainikSimilar.js — spot questions that are the same question reworded (exact copies are already refused elsewhere).
// A question is "near" an existing one when
//   • its wording is almost the same (85 % or more), or
//   • it has the same options and the same correct answer, and the wording overlaps enough to be the same idea
//     (30 % when the options are words; 50 % when they are only numbers, because many different sums share the same four numbers).
// This is a warning for a person to judge, never a silent block: two different sums can look alike.

const tokens = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}+\-*/=<>.%]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 1; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n) }
const grams = t => [...t, ...t.slice(1).map((w, i) => t[i] + ' ' + w)]   // words and neighbouring pairs, so word ORDER and numbers matter a little
const opt = (q, k) => String(q?.['option_' + k.toLowerCase()] ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const OPTS = ['a', 'b', 'c', 'd']
const numeric = s => /^[\d\s.,/%+\-×x÷*=]+$/.test(s)

export const stemSimilarity = (a, b) => jaccard(grams(tokens(a?.question)), grams(tokens(b?.question)))

export function nearDuplicate(a, b) {
  const qs = stemSimilarity(a, b)
  if (qs >= 0.85) return { near: true, why: 'almost the same wording', score: qs }
  const oa = OPTS.map(k => opt(a, k)), ob = OPTS.map(k => opt(b, k))
  if (oa.some(x => !x) || ob.some(x => !x)) return { near: false, score: qs }
  const os = jaccard(oa, ob)
  const ansA = opt(a, String(a?.answer || 'A')), ansB = opt(b, String(b?.answer || 'A'))
  if (os >= 0.75 && ansA && ansA === ansB && qs >= (oa.every(numeric) ? 0.5 : 0.3)) return { near: true, why: 'same options and answer, similar wording', score: qs }
  return { near: false, score: qs }
}

// For each new question, the first existing question it is near (skipping exact copies of the same text, which are handled separately).
export function findNear(newList, existing, same = (a, b) => String(a?.question || '').trim() === String(b?.question || '').trim()) {
  const out = []
  for (const q of newList) {
    const hit = (existing || []).find(e => !same(q, e) && nearDuplicate(q, e).near)
    if (hit) out.push({ q, like: hit, ...nearDuplicate(q, hit) })
  }
  return out
}

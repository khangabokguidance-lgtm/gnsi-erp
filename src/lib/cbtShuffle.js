// cbtShuffle.js — per-candidate shuffling for the CBT exam screen. Pure: no browser, no database.
// A test can ask (marking.shuffle = { questions, options }) for each candidate to see a different order.
// ONLY what is shown changes. Every question keeps its own `no` and every option keeps its own `key` (A–D), and those
// are what answers are stored and marked by — so scoring, the answer key, the server and the integrity report are
// untouched. Presented questions get `pos` (the number shown on screen); presented options get `label` (the letter
// shown on screen, A–D by position).
//
// Safe rules — a question is left alone when shuffling it would make it wrong:
//   • questions that share one reading passage stay together, in their original order (the block moves as a whole);
//   • a figure question keeps its options (the picture holds A–D);
//   • options that refer to each other ("all of the above", "both A and B", "option C") are not shuffled.

// Small seeded generator: the same seed always gives the same order, so a reload or a resumed attempt looks the same.
function rng(seed) {
  let h = 1779033703 ^ String(seed).length
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = (h ^ 0x9e3779b9) >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const shuffled = (arr, rand) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const REFERS = /\b(all|none|both|neither|any)\b[^.]{0,20}\b(of\s+)?(the\s+)?(above|these|them|options?)\b|\b[A-D]\s*(and|&|,|or)\s*[A-D]\b|\b(option|options|statement)\s*\(?[A-D1-4]\b/i
export const optionsDependOnEachOther = q => (q.options || []).some(o => REFERS.test(`${o.text || ''} ${o.textMm || ''}`))

export const shuffleCfg = test => ({ questions: !!test?.marking?.shuffle?.questions, options: !!test?.marking?.shuffle?.options })
export const isShuffled = test => { const c = shuffleCfg(test); return c.questions || c.options }

export function presentTest(test, seed) {
  const cfg = shuffleCfg(test)
  if (!test || !seed || (!cfg.questions && !cfg.options)) return test
  const rand = rng(`${test.id}|${seed}`)
  let pos = 0
  const sections = test.sections.map(s => {
    let qs = s.questions
    if (cfg.questions) {
      const blocks = []
      for (const q of qs) {
        const last = blocks[blocks.length - 1]
        if (q.passage && last && last[0].passage === q.passage) last.push(q); else blocks.push([q])
      }
      qs = shuffled(blocks, rand).flat()
    }
    return {
      ...s,
      questions: qs.map(q => {
        const move = cfg.options && !q.figure && (q.options || []).length > 1 && !optionsDependOnEachOther(q)
        const opts = move ? shuffled(q.options, rand) : q.options
        pos += 1
        return { ...q, ...(cfg.questions ? { pos } : {}), options: opts.map((o, i) => ({ ...o, label: 'ABCD'[i] || o.key })) }
      }),
    }
  })
  return { ...test, sections }
}

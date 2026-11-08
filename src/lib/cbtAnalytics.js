// cbtAnalytics.js — deeper results for staff: how hard each question was, which options were picked, how each section
// went, and each student's rank / percentile. Pure. `rows` come from resultRows(test, attempts); only SUBMITTED attempts
// are counted. Answers are by the original question no. and option key, so shuffled papers analyse correctly.
import { flatQuestions } from './cbtEngine.js'

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0)
const r2 = n => Math.round(n * 100) / 100

export function questionStats(test, rows) {
  const done = rows.filter(r => r.submitted)
  return flatQuestions(test).map(q => {
    const picks = { A: 0, B: 0, C: 0, D: 0 }
    let skipped = 0
    for (const r of done) { const g = r.attempt.answers[q.no]; if (g && picks[g] !== undefined) picks[g]++; else skipped++ }
    const attempted = done.length - skipped
    const correct = q.answer ? picks[q.answer] || 0 : 0
    const pCorrect = pct(correct, done.length)
    // the option most often chosen among the wrong ones — a sign the question or key may be off when it beats the key
    const wrongTop = Object.entries(picks).filter(([k]) => k !== q.answer).sort((a, b) => b[1] - a[1])[0]
    const level = !q.answer ? 'nokey' : pCorrect >= 70 ? 'easy' : pCorrect >= 35 ? 'medium' : 'hard'
    const suspect = !!q.answer && done.length >= 5 && wrongTop && wrongTop[1] > correct && wrongTop[1] / Math.max(1, attempted) >= 0.4
    return { no: q.no, section: q.sectionId, answer: q.answer || null, picks, skipped, attempted, correct, pCorrect, level, suspect, topWrong: wrongTop && wrongTop[1] ? wrongTop[0] : null }
  })
}

export function sectionStats(test, rows) {
  const done = rows.filter(r => r.submitted)
  return test.sections.map((s, i) => {
    const max = done[0]?.g.sections[i]?.max || 0
    const marks = done.map(r => r.g.sections[i]?.marks ?? 0)
    const avg = done.length ? r2(marks.reduce((a, b) => a + b, 0) / done.length) : 0
    const acc = done.length ? r2(done.reduce((a, r) => a + (r.g.sections[i]?.accuracy || 0), 0) / done.length) : 0
    return { id: s.id, label: s.label || '', title: s.title || `Section ${i + 1}`, max, avg, avgPct: pct(avg, max), accuracy: acc }
  })
}

// rank (ties share a rank) and percentile (share of submitted candidates who scored lower) per attempt id.
export function standings(rows) {
  const done = rows.filter(r => r.submitted)
  const out = new Map()
  for (const r of done) {
    const lower = done.filter(x => x.g.marks < r.g.marks).length
    const higher = done.filter(x => x.g.marks > r.g.marks).length
    out.set(r.attempt.id, { rank: higher + 1, of: done.length, percentile: done.length > 1 ? r2((lower / (done.length - 1)) * 100) : 100 })
  }
  return out
}

export function summary(rows) {
  const done = rows.filter(r => r.submitted)
  const m = done.map(r => r.g.marks).sort((a, b) => a - b)
  const sum = m.reduce((a, b) => a + b, 0)
  const med = m.length ? (m.length % 2 ? m[(m.length - 1) / 2] : (m[m.length / 2 - 1] + m[m.length / 2]) / 2) : 0
  return { count: done.length, avg: done.length ? r2(sum / done.length) : 0, median: r2(med), high: m.at(-1) ?? 0, low: m[0] ?? 0, max: done[0]?.g.max ?? 0 }
}

// A student's weak sections: lowest percent of the section maximum first.
export function weakSections(row) {
  return row.g.sections.map(s => ({ title: s.title || s.label, pct: pct(s.marks, s.max), marks: s.marks, max: s.max })).sort((a, b) => a.pct - b.pct)
}

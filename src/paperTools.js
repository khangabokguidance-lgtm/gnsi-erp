// paperTools.js — GNSI Portal · Question Bank → Create Paper helpers (no React)
//
// Question picking (multi-chapter blocks, difficulty mix, skip recently used,
// quality filter, de-duplication), sets A–D with question + option shuffling,
// marks schemes, sections, the teacher blueprint, saved templates / history,
// and Word / text exports.

import { similar } from './studioTools'

export const LETTERS = ['A', 'B', 'C', 'D']
const DIFFS = ['Easy', 'Medium', 'Hard']

export const PAPER_OPTIONS_DEFAULT = {
  institute: 'Guidance Navodaya & Sainik Institute',
  tagline: 'Khangabok, Thoubal, Manipur  ·  Est. 2016',
  examLine: '',                      // e.g. "Class 6 · Unit Test 2"
  paperDate: '',                     // '' = today
  watermark: '',
  fields: { name: true, roll: true, cls: true, section: false, date: false, sign: false },
  marksMode: 'bank',                 // bank | flat | difficulty
  marksFlat: 1,
  weights: { Easy: 1, Medium: 2, Hard: 3 },
  negative: 0,
  sections: 'none',                  // none | chapter | subsection
  sets: 1,                           // 1–4
  shuffleOptions: true,
  omr: false,
  answerSpace: 0,                    // writing lines under each question
  showMayek: true,
  answerKey: 'page',                 // page | inline | none
  blueprint: false,
  endMarker: true,
}

// ── Seeded randomness (a set prints the same every time) ────────────────────
export function seeded(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6 }
}
export function shuffle(arr, rand = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ── Quality filter ───────────────────────────────────────────────────────────
export const isComplete = q => !!(String(q.question || '').trim() && String(q.option_a || '').trim() && String(q.option_b || '').trim() && LETTERS.includes(q.correct_option))

// ── Picking ──────────────────────────────────────────────────────────────────
// blocks: [{ chapter, sub, count }]. For each block, pick `count` from the
// matching pool, honouring the difficulty mix when given (otherwise random),
// skipping excluded ids, incomplete rows and near-duplicates of anything
// already picked.
export function pickPaper(questions, { course, subject, blocks, difficulty = 'All', mix = null, exclude = new Set(), quality = true, dedupe = true, rand = Math.random }) {
  const picked = []
  const shortfalls = []
  const dupOf = q => dedupe && picked.some(p => similar(p.question, q.question))
  for (const b of blocks) {
    let pool = questions.filter(q => (q.course || '') === course && q.subject === subject && q.chapter === b.chapter &&
      (q.subsection || 'General') === b.sub && (difficulty === 'All' || q.difficulty === difficulty) &&
      !exclude.has(q.id) && (!quality || isComplete(q)))
    pool = shuffle(pool, rand)
    const take = []
    const tryAdd = q => { if (take.length < b.count && !take.includes(q) && !dupOf(q) && !take.some(t => dedupe && similar(t.question, q.question))) take.push(q) }
    if (mix) {
      const total = DIFFS.reduce((t, d) => t + (Number(mix[d]) || 0), 0) || 100
      const want = { Easy: Math.round(b.count * (Number(mix.Easy) || 0) / total), Hard: Math.round(b.count * (Number(mix.Hard) || 0) / total) }
      want.Medium = Math.max(0, b.count - want.Easy - want.Hard)
      for (const d of DIFFS) {
        let n = 0
        for (const q of pool) { if (n >= want[d]) break; if ((q.difficulty || 'Medium') === d) { const before = take.length; tryAdd(q); if (take.length > before) n++ } }
      }
    }
    for (const q of pool) tryAdd(q)            // top up (or plain random when no mix)
    if (take.length < b.count) shortfalls.push({ ...b, got: take.length })
    picked.push(...take)
  }
  return { picked, shortfalls }
}

// A fresh question for the same block as `q`, not already in the paper.
export function swapCandidate(questions, q, inPaper, { exclude = new Set(), quality = true, rand = Math.random } = {}) {
  const ids = new Set(inPaper.map(x => x.id))
  const pool = questions.filter(x => x.course === q.course && x.subject === q.subject && x.chapter === q.chapter &&
    (x.subsection || 'General') === (q.subsection || 'General') && !ids.has(x.id) && !exclude.has(x.id) && (!quality || isComplete(x)))
  const same = pool.filter(x => (x.difficulty || 'Medium') === (q.difficulty || 'Medium'))
  const list = same.length ? same : pool
  return list.length ? list[Math.floor(rand() * list.length)] : null
}

const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 }
export function sortPaper(qs, by, rand = Math.random) {
  if (by === 'shuffle') return shuffle(qs, rand)
  const key = q => (by === 'difficulty' ? `${DIFF_ORDER[q.difficulty] ?? 1}|${q.chapter}` : `${q.chapter}|${q.subsection || ''}|${DIFF_ORDER[q.difficulty] ?? 1}`)
  return [...qs].sort((a, b) => key(a).localeCompare(key(b)))
}

// ── Marks ────────────────────────────────────────────────────────────────────
export function marksOf(q, o) {
  if (o.marksMode === 'flat') return Number(o.marksFlat) || 1
  if (o.marksMode === 'difficulty') return Number(o.weights?.[q.difficulty || 'Medium']) || 1
  return Number(q.marks) || 1
}

// ── Sets ─────────────────────────────────────────────────────────────────────
// Reorder a question's options and move the answer letter with them.
export function permuteOptions(q, rand) {
  const keys = LETTERS.map(l => l.toLowerCase()).filter(k => q[`option_${k}`])
  const order = shuffle(keys.map((_, i) => i), rand)
  const out = { ...q }
  keys.forEach((k, i) => {
    const src = keys[order[i]]
    out[`option_${k}`] = q[`option_${src}`]
    out[`option_${k}_mayek`] = q[`option_${src}_mayek`] || ''
  })
  const ci = keys.indexOf(String(q.correct_option || '').toLowerCase())
  if (ci >= 0) out.correct_option = keys[order.indexOf(ci)].toUpperCase()
  return out
}

// Set A keeps the paper as built; B–D shuffle questions within each section
// and (optionally) the options, seeded by the paper so reprints match.
export function buildSets(qs, o, seed) {
  const n = Math.max(1, Math.min(4, Number(o.sets) || 1))
  return 'ABCD'.slice(0, n).split('').map((code, v) => {
    if (v === 0) return { code, questions: qs }
    const rand = seeded(`${seed}|${code}`)
    const groups = groupSections(qs, o.sections)
    const out = groups.flatMap(g => shuffle(g.items, rand)).map(q => (o.shuffleOptions ? permuteOptions(q, rand) : q))
    return { code, questions: out }
  })
}

// ── Sections ─────────────────────────────────────────────────────────────────
export function groupSections(qs, mode) {
  if (!mode || mode === 'none') return [{ name: '', items: qs }]
  const m = new Map()
  for (const q of qs) {
    const k = mode === 'subsection' ? `${q.chapter} — ${q.subsection || 'General'}` : q.chapter || 'General'
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(q)
  }
  return [...m].map(([name, items]) => ({ name, items }))
}
export const sectionLetter = i => String.fromCharCode(65 + i)

// ── Blueprint: chapter × difficulty ─────────────────────────────────────────
export function blueprint(qs, o) {
  const rows = new Map()
  for (const q of qs) {
    const k = q.chapter || 'Other'
    if (!rows.has(k)) rows.set(k, { Easy: 0, Medium: 0, Hard: 0, marks: 0 })
    const r = rows.get(k); r[DIFFS.includes(q.difficulty) ? q.difficulty : 'Medium']++; r.marks += marksOf(q, o)
  }
  const list = [...rows].map(([chapter, r]) => ({ chapter, ...r, total: r.Easy + r.Medium + r.Hard }))
  const tot = list.reduce((t, r) => ({ Easy: t.Easy + r.Easy, Medium: t.Medium + r.Medium, Hard: t.Hard + r.Hard, total: t.total + r.total, marks: t.marks + r.marks }), { Easy: 0, Medium: 0, Hard: 0, total: 0, marks: 0 })
  return { rows: list, total: tot }
}

// ── Templates & history (per browser) ────────────────────────────────────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } },
}
export const loadTemplates = () => store.get('gnsi_paper_templates', [])
export const saveTemplates = list => store.set('gnsi_paper_templates', list)
export const loadPaperHistory = () => store.get('gnsi_paper_history', [])
export function pushPaperHistory(entry) {
  const list = [{ ...entry, id: `p${Date.now()}`, at: new Date().toISOString() }, ...loadPaperHistory()].slice(0, 20)
  store.set('gnsi_paper_history', list)
  return list
}
// Question ids used in the last `n` papers (for "skip recently used").
export const recentlyUsedIds = (n = 5) => new Set(loadPaperHistory().slice(0, n).flatMap(h => h.questionIds || []))

// ── Exports ──────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function answerKeyText(sets, title) {
  return [`${title} — Answer key`, ...sets.map(s => `${sets.length > 1 ? `Set ${s.code}: ` : ''}${s.questions.map((q, i) => `${i + 1}-${q.correct_option || '?'}`).join(', ')}`)].join('\n')
}

export function paperText(qs, title, o) {
  const lines = [`*${title}*`, '']
  qs.forEach((q, i) => {
    lines.push(`*${i + 1}.* ${q.question}${o.marksMode !== 'bank' || q.marks > 1 ? ` [${marksOf(q, o)}]` : ''}`)
    for (const l of LETTERS) if (q[`option_${l.toLowerCase()}`]) lines.push(`   (${l}) ${q[`option_${l.toLowerCase()}`]}`)
    lines.push('')
  })
  return lines.join('\n')
}

// Word opens HTML saved with the Word namespace as a normal document.
export function paperWordHtml({ title, subject, chapterLabel, sets, o, timeMinutes, instructions }) {
  const fields = [['name', 'Name'], ['roll', 'Roll No.'], ['cls', 'Class'], ['section', 'Section'], ['date', 'Date'], ['sign', 'Signature']].filter(([k]) => o.fields?.[k])
  const body = sets.map(s => {
    const total = s.questions.reduce((t, q) => t + marksOf(q, o), 0)
    let n = 0
    const secs = groupSections(s.questions, o.sections)
    return `<div style="page-break-after:always">
      <p style="text-align:center;margin:0"><b style="font-size:16pt">${esc(o.institute)}</b><br><span style="font-size:9pt">${esc(o.tagline)}</span></p>
      <p style="text-align:center"><b style="font-size:13pt">${esc(title)}</b>${sets.length > 1 ? ` &nbsp; <b>[SET ${s.code}]</b>` : ''}<br>${esc(subject)} · ${esc(chapterLabel)}${o.examLine ? `<br>${esc(o.examLine)}` : ''}</p>
      <p>${fields.map(([, l]) => `${l}: ______________`).join(' &nbsp; ')}</p>
      <p><b>Time:</b> ${esc(timeMinutes)} minutes &nbsp;&nbsp; <b>Maximum marks:</b> ${total}${Number(o.negative) > 0 ? ` &nbsp;&nbsp; <b>Negative marking:</b> −${esc(o.negative)} per wrong answer` : ''}</p>
      <p><i>${esc(instructions)}</i></p>
      ${secs.map((g, gi) => `${g.name ? `<h3>Section ${sectionLetter(gi)} — ${esc(g.name)}</h3>` : ''}${g.items.map(q => `<p><b>${++n}.</b> ${esc(q.question)} <span style="color:#666">[${marksOf(q, o)}]</span>${o.showMayek && q.question_mayek ? `<br>${esc(q.question_mayek)}` : ''}<br>${LETTERS.filter(l => q[`option_${l.toLowerCase()}`]).map(l => `(${l}) ${esc(q[`option_${l.toLowerCase()}`])}${o.answerKey === 'inline' && q.correct_option === l ? ' ✓' : ''}`).join(' &nbsp;&nbsp; ')}</p>`).join('')}`).join('')}
      ${o.endMarker ? '<p style="text-align:center">*** End of paper ***</p>' : ''}</div>`
  }).join('')
  const keys = o.answerKey === 'page' ? `<h2>Answer key</h2>${sets.map(s => `<p><b>${sets.length > 1 ? `Set ${s.code}: ` : ''}</b>${s.questions.map((q, i) => `${i + 1}-${esc(q.correct_option || '?')}`).join(', ')}</p>`).join('')}` : ''
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${body}${keys}</body></html>`
}

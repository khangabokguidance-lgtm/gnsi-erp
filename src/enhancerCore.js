// enhancerCore.js — logic behind Study Materials → Teaching Enhancer.
//
// Pure functions (no React, no Supabase) so they can be unit tested:
//   • chapter readiness scores (what each chapter has, what's missing)
//   • one-click class kit (best material per type + a quick quiz)
//   • lesson plans (default structure, timing, printable page)
//   • rating/bookmark aggregation and request status metadata

export const MATERIAL_KINDS = [
  { key: 'notes',    label: 'Notes',         icon: '📄', weight: 25 },
  { key: 'practice', label: 'Practice set',  icon: '✏️', weight: 20 },
  { key: 'formula',  label: 'Formula sheet', icon: '🔣', weight: 10 },
  { key: 'solved',   label: 'Solved paper',  icon: '✅', weight: 10 },
  { key: 'mindmap',  label: 'Mind map',      icon: '🗂️', weight: 10 },
  { key: 'video',    label: 'Video',         icon: '🎥', weight: 10 },
]
// Question Bank questions make up the rest of the score (15 points);
// ten or more questions for the chapter counts as full.
export const QUESTION_WEIGHT = 15
export const QUESTIONS_FOR_FULL = 10

export const levelOf = score => (score >= 70 ? 'ready' : score >= 35 ? 'partial' : 'thin')
export const LEVELS = {
  ready:   { label: 'Class-ready', tone: '#0f7a4c', bg: '#e8f5ee' },
  partial: { label: 'Partly ready', tone: '#9a5b00', bg: '#fff5e0' },
  thin:    { label: 'Needs material', tone: '#b42318', bg: '#fdecea' },
}

// rows for every chapter of a subject:
// { chapter, byType: {notes: n, …}, total, questions, score, missing: [kind keys], level }
export function chapterReadiness({ subject, chapters = [], materials = [], qCounts = {} }) {
  return chapters.map(chapter => {
    const mats = materials.filter(m => m.subject === subject && m.chapter === chapter)
    const byType = {}
    mats.forEach(m => { byType[m.material_type || 'notes'] = (byType[m.material_type || 'notes'] || 0) + 1 })
    const questions = qCounts[chapter] || 0
    let score = 0
    const missing = []
    MATERIAL_KINDS.forEach(k => { if (byType[k.key]) score += k.weight; else missing.push(k.key) })
    score += Math.round(QUESTION_WEIGHT * Math.min(1, questions / QUESTIONS_FOR_FULL))
    return { chapter, byType, total: mats.length, questions, score, missing, level: levelOf(score) }
  })
}

// Averages across a subject's chapters, plus the chapters to prepare next.
export function readinessSummary(rows) {
  if (!rows.length) return { avg: 0, ready: 0, partial: 0, thin: 0, next: [] }
  const count = lvl => rows.filter(r => r.level === lvl).length
  return {
    avg: Math.round(rows.reduce((t, r) => t + r.score, 0) / rows.length),
    ready: count('ready'), partial: count('partial'), thin: count('thin'),
    next: [...rows].sort((a, b) => a.score - b.score || a.chapter.localeCompare(b.chapter)).filter(r => r.score < 70).slice(0, 5),
  }
}

// ── Ratings & bookmarks ─────────────────────────────────────────────────────
// rows: study_material_feedback. Returns { [material_id]: { avg, count, mine, bookmarked } }
export function aggregateFeedback(rows = [], myEmail = '') {
  const me = String(myEmail || '').toLowerCase()
  const out = {}
  rows.forEach(r => {
    const id = String(r.material_id)
    const o = out[id] || (out[id] = { sum: 0, count: 0, mine: 0, bookmarked: false, saves: 0 })
    if (r.rating) { o.sum += r.rating; o.count++ }
    if (r.bookmarked) o.saves++
    if (me && String(r.author_email || '').toLowerCase() === me) { o.mine = r.rating || 0; o.bookmarked = !!r.bookmarked }
  })
  Object.values(out).forEach(o => { o.avg = o.count ? Math.round((o.sum / o.count) * 10) / 10 : 0; delete o.sum })
  return out
}

// Best-first: higher average rating, more ratings, then newest.
export function rankMaterials(mats, feedback = {}) {
  return [...mats].sort((a, b) => {
    const fa = feedback[String(a.id)] || {}, fb = feedback[String(b.id)] || {}
    return (fb.avg || 0) - (fa.avg || 0) || (fb.count || 0) - (fa.count || 0) || String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
}

// ── One-click class kit ─────────────────────────────────────────────────────
// Deterministic shuffle so "Shuffle quiz" gives a new but repeatable order.
export function seededRandom(seed) {
  let s = (Number(seed) || 1) >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const usable = q => !!(String(q.question || '').trim() && String(q.option_a || '').trim() && String(q.option_b || '').trim())

// Picks up to `count` questions, spreading across difficulty levels.
export function pickQuiz(questions = [], count = 10, seed = 1) {
  const rand = seededRandom(seed)
  const pool = questions.filter(usable)
  const buckets = { Easy: [], Medium: [], Hard: [], Other: [] }
  pool.forEach(q => (buckets[q.difficulty] || buckets.Other).push(q))
  Object.values(buckets).forEach(b => { for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } })
  const order = ['Easy', 'Medium', 'Hard', 'Other']
  const out = []
  while (out.length < count && order.some(k => buckets[k].length)) {
    for (const k of order) { if (buckets[k].length && out.length < count) out.push(buckets[k].shift()) }
  }
  return out
}

// { items: [{ kind, material|null }], quiz: [...], missing: [kind keys], extras: [materials] }
export function buildClassKit({ subject, chapter, materials = [], questions = [], feedback = {}, quizSize = 10, seed = 1 }) {
  const mats = materials.filter(m => m.subject === subject && m.chapter === chapter)
  const used = new Set()
  const items = MATERIAL_KINDS.map(k => {
    const best = rankMaterials(mats.filter(m => (m.material_type || 'notes') === k.key), feedback)[0] || null
    if (best) used.add(best.id)
    return { kind: k.key, material: best }
  })
  return {
    items,
    missing: items.filter(i => !i.material).map(i => i.kind),
    extras: mats.filter(m => !used.has(m.id)),
    quiz: pickQuiz(questions, quizSize, seed),
  }
}

// ── Lesson plans ────────────────────────────────────────────────────────────
export const BLOCK_KINDS = [
  { kind: 'warmup',   label: 'Warm-up / recall',  share: 0.12, hint: 'Quick questions on the previous class or a real-life hook.' },
  { kind: 'explain',  label: 'Teach the concept', share: 0.38, hint: 'Explain with the notes / board work; show a solved example.' },
  { kind: 'activity', label: 'Guided activity',   share: 0.2,  hint: 'Students try an example with you; pair work or board work.' },
  { kind: 'practice', label: 'Practice / quiz',   share: 0.22, hint: 'Practice set or the quick quiz from the Question Bank.' },
  { kind: 'wrapup',   label: 'Wrap-up',           share: 0.08, hint: 'Summarise, clear doubts, give homework.' },
]

// Splits a duration across the five blocks; whole minutes that add up exactly.
export function splitMinutes(duration = 40) {
  const d = Math.max(5, Math.round(Number(duration) || 40))
  const mins = BLOCK_KINDS.map(b => Math.max(1, Math.floor(d * b.share)))
  let diff = d - mins.reduce((t, m) => t + m, 0)
  for (let i = 1; diff !== 0; i = (i + 1) % mins.length) {
    if (diff > 0) { mins[i]++; diff-- } else if (mins[i] > 1) { mins[i]--; diff++ }
  }
  return mins
}

export function defaultPlan({ course, subject, chapter, duration = 40, author = '' }) {
  const mins = splitMinutes(duration)
  return {
    course, subject, chapter,
    title: `${chapter} — Lesson 1`,
    class_label: '',
    duration_min: Math.max(5, Math.round(Number(duration) || 40)),
    objectives: `By the end of the class students can explain and solve basic problems on ${chapter}.`,
    blocks: BLOCK_KINDS.map((b, i) => ({ kind: b.kind, title: b.label, minutes: mins[i], notes: '' })),
    material_ids: [],
    question_ids: [],
    homework: '',
    status: 'draft',
    author_name: author,
  }
}

export const planMinutes = plan => (plan.blocks || []).reduce((t, b) => t + (Number(b.minutes) || 0), 0)

export function validatePlan(plan) {
  const errors = []
  if (!String(plan.title || '').trim()) errors.push('Give the plan a title.')
  if (!plan.course || !plan.subject || !plan.chapter) errors.push('Choose the course, subject and chapter.')
  if (!(plan.blocks || []).length) errors.push('Add at least one step.')
  const total = planMinutes(plan)
  if (plan.duration_min && total !== Number(plan.duration_min)) errors.push(`Steps add up to ${total} min but the class is ${plan.duration_min} min.`)
  return errors
}

// Fields sent to Supabase (drops UI-only keys).
export function planRow(plan) {
  const keys = ['course', 'subject', 'chapter', 'title', 'class_label', 'duration_min', 'objectives', 'blocks', 'material_ids', 'question_ids', 'homework', 'status', 'taught_on', 'author_name']
  const row = {}
  keys.forEach(k => { if (plan[k] !== undefined) row[k] = plan[k] })
  row.taught_on = row.taught_on || null
  return row
}

export const PLAN_STATUS = {
  draft:  { label: 'Draft', tone: '#5d6b82', bg: '#f3f0e8' },
  ready:  { label: 'Ready', tone: '#1e3a6e', bg: '#e4ebf6' },
  taught: { label: 'Taught', tone: '#0f7a4c', bg: '#e8f5ee' },
}

// ── Requests ────────────────────────────────────────────────────────────────
export const REQUEST_STATUS = {
  open:        { label: 'Open', tone: '#9a5b00', bg: '#fff5e0' },
  in_progress: { label: 'In progress', tone: '#1e3a6e', bg: '#e4ebf6' },
  done:        { label: 'Done', tone: '#0f7a4c', bg: '#e8f5ee' },
  declined:    { label: 'Declined', tone: '#5d6b82', bg: '#f3f0e8' },
}

// A request is already covered when that chapter now has that material type.
export function requestFulfilled(req, materials = []) {
  return materials.some(m => m.course === req.course && m.subject === req.subject &&
    (!req.chapter || m.chapter === req.chapter) && (!req.material_type || (m.material_type || 'notes') === req.material_type))
}

// ── Supabase helpers ────────────────────────────────────────────────────────
// True when the table from 20260927_teaching_enhancer.sql isn't there yet.
export const isMissingTable = error => !!error && (['42P01', 'PGRST205', 'PGRST204'].includes(error.code) || /does not exist|schema cache|Could not find the table/i.test(error.message || ''))

// ── Printable pages ─────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const kindLabel = key => MATERIAL_KINDS.find(k => k.key === key)?.label || key

const PAGE_CSS = `
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0f1b2e;margin:32px;line-height:1.5}
  h1{font-family:Georgia,serif;color:#132a4f;margin:0 0 4px;font-size:24px}
  .sub{color:#5d6b82;font-size:13px;margin-bottom:18px}
  h2{font-size:15px;color:#132a4f;border-bottom:2px solid #b8923a;padding-bottom:4px;margin:22px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13px} td,th{border:1px solid #e8e3d8;padding:7px 9px;text-align:left;vertical-align:top}
  th{background:#faf8f3;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5d6b82}
  .q{margin:0 0 12px} .opts{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;margin:4px 0 0 18px;font-size:13px}
  .key{font-size:13px} a{color:#1e3a6e} .muted{color:#8a93a6}
  @media print{body{margin:14mm} .noprint{display:none}}`

function quizHtml(quiz, withKey = true) {
  if (!quiz.length) return '<p class="muted">No Question Bank questions for this chapter yet.</p>'
  const qs = quiz.map((q, i) => `<div class="q"><b>${i + 1}.</b> ${esc(q.question)}<div class="opts">${['a', 'b', 'c', 'd'].filter(l => q[`option_${l}`]).map(l => `<span>(${l.toUpperCase()}) ${esc(q[`option_${l}`])}</span>`).join('')}</div></div>`).join('')
  const key = withKey ? `<h2>Answer key</h2><p class="key">${quiz.map((q, i) => `${i + 1}-${esc(q.correct_option || '—')}`).join(', ')}</p>` : ''
  return qs + key
}

export function classKitHtml({ kit, courseLabel, subject, chapter, school = 'Guidance Navodaya & Sainik Institute' }) {
  const rows = kit.items.map(i => `<tr><td>${esc(kindLabel(i.kind))}</td><td>${i.material ? `${esc(i.material.title)}${i.material.file_url ? ` — <a href="${esc(i.material.file_url)}">${esc(i.material.file_url)}</a>` : ''}` : '<span class="muted">Not available yet</span>'}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(chapter)} — Class kit</title><style>${PAGE_CSS}</style></head><body>
  <h1>${esc(chapter)} — Class kit</h1><div class="sub">${esc(school)} · ${esc(courseLabel)} · ${esc(subject)}</div>
  <h2>Materials</h2><table><thead><tr><th style="width:26%">Type</th><th>Material</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Quick quiz (${kit.quiz.length} questions)</h2>${quizHtml(kit.quiz)}
  <p class="noprint muted" style="margin-top:24px">Use your browser's Print (Ctrl+P) to print or save as PDF.</p></body></html>`
}

export function lessonPlanHtml({ plan, courseLabel, materials = [], questions = [], school = 'Guidance Navodaya & Sainik Institute' }) {
  const matRows = materials.map(m => `<li>${esc(kindLabel(m.material_type || 'notes'))}: ${esc(m.title)}${m.file_url ? ` — <a href="${esc(m.file_url)}">${esc(m.file_url)}</a>` : ''}</li>`).join('')
  let clock = 0
  const steps = (plan.blocks || []).map((b, i) => {
    const from = clock; clock += Number(b.minutes) || 0
    return `<tr><td>${i + 1}</td><td><b>${esc(b.title)}</b>${b.notes ? `<div>${esc(b.notes).replace(/\n/g, '<br>')}</div>` : ''}</td><td style="white-space:nowrap">${from}–${clock} min</td></tr>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(plan.title)}</title><style>${PAGE_CSS}</style></head><body>
  <h1>${esc(plan.title)}</h1>
  <div class="sub">${esc(school)} · ${esc(courseLabel)} · ${esc(plan.subject)} · ${esc(plan.chapter)}${plan.class_label ? ` · ${esc(plan.class_label)}` : ''} · ${esc(plan.duration_min)} min${plan.author_name ? ` · ${esc(plan.author_name)}` : ''}</div>
  <h2>Learning objectives</h2><p>${esc(plan.objectives || '—').replace(/\n/g, '<br>')}</p>
  <h2>Lesson flow</h2><table><thead><tr><th style="width:5%">#</th><th>Step</th><th style="width:16%">Time</th></tr></thead><tbody>${steps}</tbody></table>
  ${matRows ? `<h2>Materials</h2><ul>${matRows}</ul>` : ''}
  ${questions.length ? `<h2>Quick quiz</h2>${quizHtml(questions)}` : ''}
  <h2>Homework</h2><p>${esc(plan.homework || '—').replace(/\n/g, '<br>')}</p>
  <p class="noprint muted" style="margin-top:24px">Use your browser's Print (Ctrl+P) to print or save as PDF.</p></body></html>`
}

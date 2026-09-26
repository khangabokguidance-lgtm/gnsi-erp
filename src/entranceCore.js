// entranceCore.js — GNSI Portal
// Exam-board mechanics for Entrance.jsx, kept free of React so they can be
// reasoned about (and tested) on their own:
//   paper patterns → question paper from the Question Bank (with shuffled
//   sets) → answer keys → OMR evaluation → ranking → qualification →
//   category-wise seat allocation with a waitlist.
//
// Everything that touches the database lives in Entrance.jsx; the one
// exception is safeWrite(), which tolerates columns that the 20260926
// migration adds but that may not exist yet on an older database.

import { supabase } from './supabase'

// ── Taxonomy links ────────────────────────────────────────────────────────────
// exam_type values are kept exactly as before (GNSIDashboard groups by them).
export const EXAM_TYPES = ['Sainik School', 'Navodaya (JNV)', 'RMS (Military School)', 'Foundation', 'Combined']
export const EXAM_TYPE_COURSE = {
  'Sainik School': 'sainik', 'Navodaya (JNV)': 'navodaya', 'RMS (Military School)': 'rms', 'Foundation': 'foundation', 'Combined': '',
}
export const COURSE_CODE = { sainik: 'SA', navodaya: 'NV', rms: 'RM', foundation: 'FD' }

export const EXAM_STATUS = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled']
export const CANDIDATE_STATUS = ['Registered', 'Hall Ticket Issued', 'Appeared', 'Absent', 'Disqualified']
export const RESULT_STATUS = ['Pending', 'Pass', 'Fail', 'Waitlist', 'Admitted', 'Rejected']
export const CLASSES = ['Class 5→6', 'Class 6→7', 'Class 8→9', 'Class 9→10', 'Class 11→12']
export const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS']
export const RESERVED = ['OBC', 'SC', 'ST', 'EWS']
export const GENDERS = ['Boy', 'Girl', 'Other']
export const FEE_STATUS = ['Unpaid', 'Paid', 'Waived']
export const SET_CODES = ['A', 'B', 'C', 'D']
export const GOVT_QUOTAS = { SC: 15, ST: 7.5, OBC: 27, EWS: 10 }

// ── Paper patterns ────────────────────────────────────────────────────────────
// A section = one block of the paper. `subject` is the Question Bank subject
// name the generator draws from (qbankTaxonomy). marks_each / negative are per
// question. Presets follow the published patterns; everything stays editable
// because notifications change year to year.
const sec = (name, subject, questions, marks_each) => ({ name, subject, questions, marks_each })
export const PATTERN_PRESETS = [
  { id: 'aissee6', label: 'AISSEE · Class 6 (Sainik)', exam_type: 'Sainik School', class_target: 'Class 5→6', duration_mins: 150,
    sections: [sec('Language', 'Language', 25, 2), sec('Mathematics', 'Mathematics', 50, 3), sec('Intelligence', 'Intelligence', 25, 2), sec('General Knowledge', 'General Knowledge', 25, 2)] },
  { id: 'jnvst6', label: 'JNVST · Class 6 (Navodaya)', exam_type: 'Navodaya (JNV)', class_target: 'Class 5→6', duration_mins: 120,
    sections: [sec('Mental Ability', 'Mental Ability', 40, 1.25), sec('Arithmetic', 'Arithmetic', 20, 1.25), sec('Language', 'English Language', 20, 1.25)] },
  { id: 'rms6', label: 'RMS CET · Class 6', exam_type: 'RMS (Military School)', class_target: 'Class 5→6', duration_mins: 150,
    sections: [sec('Intelligence', 'Intelligence', 50, 1), sec('Mathematics', 'Mathematics', 50, 1), sec('General Knowledge', 'General Knowledge', 50, 1), sec('English', 'English Language', 50, 1)] },
  { id: 'found', label: 'Foundation screening test', exam_type: 'Foundation', class_target: 'Class 6→7', duration_mins: 90,
    sections: [sec('Mathematics', 'Mathematics', 25, 1), sec('Science', 'Science', 25, 1), sec('English', 'English', 25, 1), sec('Social Science', 'Social Science', 25, 1)] },
]

export const patternTotals = (sections = []) => sections.reduce((t, s) => ({
  questions: t.questions + (Number(s.questions) || 0),
  marks: t.marks + (Number(s.questions) || 0) * (Number(s.marks_each) || 0),
}), { questions: 0, marks: 0 })

export const DEFAULT_RULES = { min_section_pct: 0, relax_reserved: true }

// Old exams have no pattern: fall back to one section per legacy subject.
const LEGACY_SUBJECTS = {
  'Sainik School': ['Mathematics', 'English', 'General Knowledge', 'Intelligence'],
  'Navodaya (JNV)': ['Mental Ability', 'Arithmetic', 'Language'],
  'Foundation': ['Mathematics', 'English', 'Science', 'Social Studies'],
  'Combined': ['Mathematics', 'English', 'General Knowledge', 'Intelligence', 'Reasoning'],
}
export function examSections(exam) {
  const p = parseJson(exam?.pattern)
  if (Array.isArray(p) && p.length) return p
  return (LEGACY_SUBJECTS[exam?.exam_type] || LEGACY_SUBJECTS.Foundation).map(s => sec(s, s, 0, 0))
}

// ── Small helpers ─────────────────────────────────────────────────────────────
export function parseJson(v, fallback = null) {
  if (v == null || v === '') return fallback
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return fallback }
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Same format tickets have always carried, so already-printed ones still match.
export const hallTicketNo = (examId, roll) => `GNSI/${examId?.toString().slice(-4).toUpperCase() || 'XXXX'}/${String(roll ?? 0).padStart(4, '0')}`

export function nextRoll(cands, examId) {
  return cands.filter(c => c.exam_id === examId).reduce((m, c) => Math.max(m, Number(c.roll_number) || 0), 0) + 1
}

// SA260001 — course code, 2-digit exam year, running number within the exam.
export function applicationNo(exam, seq) {
  const code = COURSE_CODE[exam?.course || EXAM_TYPE_COURSE[exam?.exam_type]] || 'GN'
  const yy = String(exam?.exam_date ? new Date(exam.exam_date).getFullYear() : new Date().getFullYear()).slice(-2)
  return `${code}${yy}${String(seq).padStart(4, '0')}`
}

export function nextApplicationSeq(cands, examId) {
  return cands.filter(c => c.exam_id === examId).reduce((m, c) => {
    const n = Number(String(c.application_no || '').slice(-4))
    return Math.max(m, Number.isFinite(n) ? n : 0)
  }, 0) + 1
}

// Latest result row per candidate (older databases can hold duplicates).
export function resultByCandidate(results) {
  const map = {}
  for (const r of results) {
    const cur = map[r.candidate_id]
    if (!cur || String(r.created_at || '') > String(cur.created_at || '')) map[r.candidate_id] = r
  }
  return map
}

export function ageOn(dob, on) {
  if (!dob) return null
  const d = new Date(dob), t = on ? new Date(on) : new Date()
  let a = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--
  return a
}

// ── Seeded shuffle (sets B/C/D must be reproducible from the exam id) ────────
function hash(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return h >>> 0
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hash(String(seed))
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffle(arr, rand = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ── Question paper generation ─────────────────────────────────────────────────
const normOpt = v => { const m = String(v || '').trim().toUpperCase().match(/^[ABCD]/); return m ? m[0] : '' }
// Answer-key value: A-D, or X for a dropped/bonus question (marks to everyone).
export const normKey = v => (String(v || '').trim().toUpperCase() === 'X' ? 'X' : normOpt(v))

// Pick `count` questions for a section: honour the difficulty mix, spread
// across chapters (round-robin) so one big chapter can't dominate, and skip
// questions used in earlier entrance papers when asked to.
export function pickQuestions(pool, count, { mix = { Easy: 30, Medium: 50, Hard: 20 }, exclude = new Set(), rand = Math.random } = {}) {
  const usable = pool.filter(q => normOpt(q.correct_option) && q.question && q.option_a && q.option_b)
  const fresh = usable.filter(q => !exclude.has(q.id))
  const source = fresh.length >= count ? fresh : usable   // fall back to reuse rather than a short paper
  const byDiff = { Easy: [], Medium: [], Hard: [] }
  for (const q of source) (byDiff[q.difficulty] || byDiff.Medium).push(q)
  const totalMix = (mix.Easy || 0) + (mix.Medium || 0) + (mix.Hard || 0) || 100
  const want = {}
  let assigned = 0
  for (const d of ['Easy', 'Hard']) { want[d] = Math.round(count * (mix[d] || 0) / totalMix); assigned += want[d] }
  want.Medium = Math.max(0, count - assigned)

  const spread = (list, n) => {
    const byCh = {}
    for (const q of shuffle(list, rand)) (byCh[q.chapter || '—'] ||= []).push(q)
    const chapters = shuffle(Object.keys(byCh), rand)
    const out = []
    while (out.length < n && chapters.some(c => byCh[c].length)) {
      for (const c of chapters) { if (out.length >= n) break; const q = byCh[c].shift(); if (q) out.push(q) }
    }
    return out
  }
  let picked = []
  for (const d of ['Easy', 'Medium', 'Hard']) picked = picked.concat(spread(byDiff[d], want[d]))
  if (picked.length < count) {                              // top up from whatever difficulty is left
    const taken = new Set(picked.map(q => q.id))
    picked = picked.concat(spread(source.filter(q => !taken.has(q.id)), count - picked.length))
  }
  return picked.slice(0, count)
}

// Snapshot the chosen questions into the paper so later Question Bank edits
// never change a paper that has already been printed or conducted.
export function buildPaper(exam, sectionPicks, { sets = 1, by = '' } = {}) {
  const sections = examSections(exam)
  const questions = []
  sections.forEach((s, si) => {
    for (const q of sectionPicks[si] || []) {
      questions.push({
        qid: q.id, sec: si, marks: Number(s.marks_each) || 1, correct: normOpt(q.correct_option),
        q: q.question || '', a: q.option_a || '', b: q.option_b || '', c: q.option_c || '', d: q.option_d || '',
        img: q.diagram_url || '', chapter: q.chapter || '', difficulty: q.difficulty || '',
      })
    }
  })
  const codes = SET_CODES.slice(0, Math.max(1, Math.min(4, sets)))
  const order = {}
  for (const code of codes) {
    if (code === 'A') { order.A = questions.map((_, i) => i); continue }
    const rand = rng(`${exam.id}:${code}`)
    const out = []
    sections.forEach((_, si) => {
      const idx = questions.map((q, i) => (q.sec === si ? i : -1)).filter(i => i >= 0)
      out.push(...shuffle(idx, rand))
    })
    order[code] = out
  }
  return { generated_at: new Date().toISOString(), generated_by: by, sets: codes, questions, order, locked: false }
}

// ── Answer keys ───────────────────────────────────────────────────────────────
// Returns an array (one entry per question position, 1-based numbering =
// index + 1) of { sec, marks, correct } for the given set.
export function keyForSet(exam, paper, manualKeys, set = 'A') {
  const sections = examSections(exam)
  if (paper?.questions?.length) {
    const order = paper.order?.[set] || paper.order?.A || paper.questions.map((_, i) => i)
    return order.map(i => { const q = paper.questions[i]; return { sec: q.sec, marks: q.marks, correct: q.correct } })
  }
  // Manual keys: ordered by section order, then the section's own Q numbers.
  const secIndex = name => { const i = sections.findIndex(s => s.name === name || s.subject === name); return i < 0 ? sections.length : i }
  return [...(manualKeys || [])]
    .sort((a, b) => secIndex(a.subject) - secIndex(b.subject) || Number(a.q_number) - Number(b.q_number))
    .map(k => ({ sec: Math.min(secIndex(k.subject), sections.length - 1), marks: Number(k.marks) || 1, correct: normKey(k.correct_option) }))
}

// Section boundaries (1-based question numbers) for display and OMR entry.
export function sectionRanges(exam, key) {
  const sections = examSections(exam)
  return sections.map((s, si) => {
    const idx = key.map((k, i) => (k.sec === si ? i : -1)).filter(i => i >= 0)
    const max = idx.reduce((t, i) => t + key[i].marks, 0)
    return { ...s, index: si, from: idx.length ? idx[0] + 1 : 0, to: idx.length ? idx[idx.length - 1] + 1 : 0, count: idx.length, max }
  })
}

// ── OMR evaluation ────────────────────────────────────────────────────────────
// responses: string, one char per question — A-D marked, '-' or ' ' blank,
// '*' multiple/invalid (treated as a wrong answer, as OMR scanners do).
// A key of 'X' is a dropped question: everyone gets its marks.
export function cleanResponses(str) {
  return String(str || '').toUpperCase().replace(/[\s,|/]/g, '').replace(/[^ABCD*\-.]/g, '-').replace(/\./g, '-')
}

export function evaluate(responses, key, sections, negative = 0) {
  const r = cleanResponses(responses)
  const secScores = sections.map(() => 0)
  let correct = 0, wrong = 0, blank = 0
  key.forEach((k, i) => {
    const a = r[i] || '-'
    if (k.correct === 'X') { correct++; secScores[k.sec] += k.marks; return }   // bonus question
    if (a === '-') { blank++; return }
    if (a === k.correct) { correct++; secScores[k.sec] += k.marks }
    else { wrong++; secScores[k.sec] -= Number(negative) || 0 }
  })
  const round = n => Math.round(n * 100) / 100
  const subject_scores = {}
  sections.forEach((s, i) => { subject_scores[s.name] = round(secScores[i]) })
  return { correct, wrong, blank, subject_scores, total: round(secScores.reduce((a, b) => a + b, 0)) }
}

// ── Merit, qualification, ranks ───────────────────────────────────────────────
export function qualifies(row, exam, sections) {
  const rules = { ...DEFAULT_RULES, ...parseJson(exam?.rules, {}) }
  const exempt = rules.relax_reserved && ['SC', 'ST'].includes(row.category)
  if (!exempt && Number(row.total) < Number(exam?.passing_marks || 0)) return false
  if (exempt && Number(row.total) <= 0) return false
  const minPct = Number(rules.min_section_pct) || 0
  if (!exempt && minPct > 0) {
    for (const s of sections) {
      const max = (Number(s.questions) || 0) * (Number(s.marks_each) || 0)
      if (max > 0 && (Number(row.scores?.[s.name]) || 0) < (max * minPct) / 100) return false
    }
  }
  return true
}

// Tie-break like AISSEE: total, then section marks in paper order, then the
// older candidate, then roll number.
export function rankRows(rows, sections) {
  const sorted = [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    for (const s of sections) {
      const d = (Number(b.scores?.[s.name]) || 0) - (Number(a.scores?.[s.name]) || 0)
      if (d) return d
    }
    if (a.dob && b.dob && a.dob !== b.dob) return a.dob < b.dob ? -1 : 1
    return (Number(a.roll_number) || 0) - (Number(b.roll_number) || 0)
  })
  const catCount = {}
  let prev = null, prevRank = 0
  return sorted.map((r, i) => {
    // Candidates who tie on every criterion share a rank.
    const same = prev && prev.total === r.total && sections.every(s => (Number(prev.scores?.[s.name]) || 0) === (Number(r.scores?.[s.name]) || 0)) && prev.dob === r.dob
    const rank = same ? prevRank : i + 1
    prev = r; prevRank = rank
    const cat = r.category || 'General'
    catCount[cat] = (catCount[cat] || 0) + 1
    return { ...r, rank, category_rank: catCount[cat] }
  })
}

// ── Seat allocation ───────────────────────────────────────────────────────────
// Standard method: open (unreserved) seats go first on pure merit to anyone;
// then each reserved category's quota is filled from its own remaining
// candidates; reserved seats left unfilled revert to open merit. Decisions
// already made are respected: Admitted rows keep their seat, Rejected
// (declined / cancelled) rows are out, so re-running fills vacancies from
// the waitlist.
export function allocateSeats(ranked, { seats = 0, quotas = {} } = {}) {
  const total = Math.max(0, Number(seats) || 0)
  const reserved = {}
  for (const c of RESERVED) reserved[c] = Math.floor((total * (Number(quotas[c]) || 0)) / 100)
  let open = total - Object.values(reserved).reduce((a, b) => a + b, 0)
  const out = {}

  const pool = ranked.filter(r => r.qualified && r.decision !== 'Rejected')
  for (const r of pool.filter(r => r.decision === 'Admitted')) {
    const q = r.quota && r.quota !== 'Open' && reserved[r.quota] != null ? r.quota : 'Open'
    if (q === 'Open') open--; else reserved[q]--
    out[r.id] = { status: 'Admitted', quota: q, kept: true }
  }
  const free = pool.filter(r => !out[r.id])
  for (const r of free) { if (open <= 0) break; out[r.id] = { status: 'Admitted', quota: 'Open' }; open-- }
  for (const c of RESERVED) {
    for (const r of free) {
      if (reserved[c] <= 0) break
      if (!out[r.id] && (r.category || 'General') === c) { out[r.id] = { status: 'Admitted', quota: c }; reserved[c]-- }
    }
  }
  let spare = Math.max(0, open) + RESERVED.reduce((t, c) => t + Math.max(0, reserved[c]), 0)
  for (const r of free) { if (spare <= 0) break; if (!out[r.id]) { out[r.id] = { status: 'Admitted', quota: 'Open' }; spare-- } }
  let wl = 0
  for (const r of free) if (!out[r.id]) out[r.id] = { status: 'Waitlist', quota: '', waitlist: ++wl }
  return out
}

// ── CSV ───────────────────────────────────────────────────────────────────────
export function parseCSV(text) {
  const rows = []
  let row = [], cell = '', q = false
  const s = String(text || '').replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim() !== '')) rows.push(row)
  if (!rows.length) return []
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export function toCSV(rows, cols) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => q(c.label)).join(','), ...rows.map(r => cols.map(c => q(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))].join('\n')
}

export function downloadText(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Schema-tolerant writes ────────────────────────────────────────────────────
// The exam-board columns come from supabase/migrations/20260926_entrance_exam_board.sql.
// Until it is applied, PostgREST rejects any write naming one of them. Rather
// than break the whole module, drop the unknown column, retry, and report it
// so the page can show a "run the migration" notice.
export const missingColumns = new Set()
const listeners = new Set()
export const onMissingColumns = fn => { listeners.add(fn); return () => listeners.delete(fn) }

export async function safeWrite(table, op, payload, match) {
  const strip = p => (Array.isArray(p) ? p.map(x => stripOne(x)) : stripOne(p))
  const stripOne = o => Object.fromEntries(Object.entries(o).filter(([k]) => !missingColumns.has(`${table}.${k}`)))
  let body = strip(payload)
  const dropped = []
  for (let attempt = 0; attempt < 15; attempt++) {
    let q = supabase.from(table)
    if (op === 'insert') q = q.insert(body).select()
    else if (op === 'update') { q = q.update(body); for (const [k, v] of Object.entries(match || {})) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v); q = q.select() }
    const { data, error } = await q
    const m = error && /Could not find the '([^']+)' column|column "?([a-z_]+)"? (?:of relation "?[a-z_]+"? )?does not exist/i.exec(error.message || '')
    const col = m && (m[1] || m[2])
    if (col && !missingColumns.has(`${table}.${col}`)) {
      missingColumns.add(`${table}.${col}`); dropped.push(col)
      listeners.forEach(fn => fn(missingColumns))
      body = strip(payload)
      continue
    }
    return { data, error, dropped }
  }
  return { data: null, error: { message: 'Too many unknown columns' }, dropped }
}

export async function audit(action, user, targetId, values) {
  try {
    await supabase.from('audit_log').insert({
      action: `entrance_${action}`, changed_by: user || 'staff', target_id: targetId ? String(targetId) : null,
      new_values: values ? JSON.stringify(values) : null, created_at: new Date().toISOString(),
    })
  } catch { /* audit is best effort */ }
}

// Columns added by 20260926_entrance_exam_board.sql, probed on load so the
// page can say up front that the migration is missing.
export const MIGRATION_COLUMNS = {
  entrance_exams: ['course', 'pattern', 'paper', 'rules', 'negative_marks', 'app_open', 'app_close', 'application_fee', 'total_seats', 'quotas', 'rooms', 'reporting_time', 'result_published'],
  entrance_candidates: ['application_no', 'gender', 'category', 'email', 'fee_status', 'fee_ref', 'fee_paid_on', 'verified', 'room', 'seat_no', 'paper_set'],
  entrance_results: ['responses', 'correct_count', 'wrong_count', 'blank_count', 'overall_rank', 'category_rank', 'allotted_quota', 'evaluated_at'],
}
export async function probeSchema() {
  await Promise.all(Object.entries(MIGRATION_COLUMNS).map(async ([table, cols]) => {
    const { error } = await supabase.from(table).select(cols.join(',')).limit(1)
    if (!error) return
    // Name each missing column individually (a partial migration is possible).
    await Promise.all(cols.map(async c => {
      const { error: e } = await supabase.from(table).select(c).limit(1)
      if (e && /column|schema cache/i.test(e.message || '')) missingColumns.add(`${table}.${c}`)
    }))
  }))
  listeners.forEach(fn => fn(missingColumns))
}

// Split an array into chunks (bulk updates run a few at a time).
export async function inChunks(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)))
  return out
}

// Candidate photos live in the private `gnsi` bucket (same as student
// documents); photo_url holds the storage path. Older rows may hold a URL.
export const PHOTO_BUCKET = 'gnsi'
export async function photoUrls(cands) {
  const out = {}, paths = []
  for (const c of cands) {
    if (!c.photo_url) continue
    if (/^(https?:|data:|blob:)/.test(c.photo_url)) out[c.id] = c.photo_url
    else paths.push([c.id, c.photo_url])
  }
  for (let i = 0; i < paths.length; i += 100) {
    const part = paths.slice(i, i + 100)
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(part.map(p => p[1]), 3600)
    ;(data || []).forEach((d, j) => { if (d?.signedUrl) out[part[j][0]] = d.signedUrl })
  }
  return out
}

// Hall-ticket eligibility: application verified, fee settled (or no fee),
// not disqualified.
export function eligibility(c, exam) {
  const reasons = []
  if (!c.verified) reasons.push('not verified')
  if (Number(exam?.application_fee) > 0 && !['Paid', 'Waived'].includes(c.fee_status)) reasons.push('fee unpaid')
  if (c.status === 'Disqualified') reasons.push('disqualified')
  return { ok: reasons.length === 0, reasons }
}

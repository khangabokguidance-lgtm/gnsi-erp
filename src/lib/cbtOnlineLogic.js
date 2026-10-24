// cbtOnlineLogic.js — the pure parts of the online CBT exam (no database): error wording, links, splitting the
// answer key off a paper, turning server rows into exam-screen attempts, the candidate's result view, status text.

export const SETUP_MSG = 'Online exams need a one-time database update (supabase/migrations/20261034_cbt_online_exam.sql). Ask the administrator to run it in Supabase → SQL editor.'

// "EXAM-CODE: The access code is not correct." → the sentence; a missing function → the setup message.
export function friendly(err) {
  const m = String(err?.message || err || '')
  if (err?.code === 'PGRST202' || err?.code === '42P01' || /could not find the function|does not exist|schema cache/i.test(m)) return SETUP_MSG
  const hit = m.match(/EXAM-[A-Z0-9-]+:\s*(.*)$/)
  if (hit) return hit[1]
  if (/failed to fetch|network|load failed/i.test(m)) return 'No internet connection.'
  return m || 'Something went wrong.'
}

export const examLink = (id, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}/exam?t=${encodeURIComponent(id)}`

// The paper handed to candidates carries no answers; the key travels separately.
export function splitKey(test) {
  const key = {}
  const sections = test.sections.map(s => ({
    ...s, questions: s.questions.map(q => { const c = { ...q }; if (c.answer) key[c.no] = c.answer; for (const f of ['answer', 'reviewed', 'figHash', 'figHashMm']) delete c[f]; return c }),
  }))
  return { sections, key }
}
export const joinKey = (sections, key = {}) => sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, answer: key[q.no] || null })) }))

// A server attempt row → the shape the exam screen and the results table use.
export function toAttempt(row, testName = '') {
  const packed = row.marked || {}
  const m = packed.m || (packed.v ? {} : packed)   // older rows stored the marked map directly
  return {
    id: row.id, testId: row.test_id, testName, candidate: { name: row.candidate_name, roll: row.roll }, phone: row.phone || '', gcc: row.gcc_no || '', parentPhone: row.parent_phone || '', erpMatch: !!row.erp_match,
    startedAt: Date.parse(row.started_at), submittedAt: row.submitted_at ? Date.parse(row.submitted_at) : null,
    state: row.state, answers: row.answers || {}, marked: m, visited: packed.v || {}, current: row.current_no, lang: row.lang || 'en',
    switches: row.switches || 0, proctor: packed.x || null, timing: packed.t || null, changes: packed.c || null, ip: row.ip_start || '', ipLast: row.ip_last || '', takeovers: row.takeovers || 0, autoSubmitted: !!row.auto_submitted, score: row.score || null, source: 'online',
  }
}
// x = the camera / shield log (counts per kind) — kept inside the marked jsonb, so no database change is needed.
// t = seconds spent per question, c = how many times each answer was changed (for the integrity report).
export const packMarks = (marked, visited, proctor, extra = null) => ({ m: marked || {}, v: visited || {}, ...(proctor ? { x: proctor } : {}), ...(extra?.timing ? { t: extra.timing } : {}), ...(extra?.changes ? { c: extra.changes } : {}) })

// ── the candidate's page ─────────────────────────────────────────────────────
// The landing page shows the exam's shape before any question is released: a test-like object with only the
// question numbers, which is all the instructions screen needs.
export const infoTest = info => ({
  id: info.id, name: info.name, durationMin: Number(info.durationMin), marking: info.marking, instructions: info.instructions,
  sections: (info.sections || []).map(s => ({ id: s.id, label: s.label, title: s.title, questions: Array.from({ length: s.count }, (_, i) => ({ no: s.first + i, options: [] })) })),
})

// A server attempt (state json) → the exam screen's attempt. `backup` is a newer copy kept on the device.
export function localAttempt(att, test, candidate, backup = null) {
  const first = test.sections[0]?.questions[0]?.no ?? 1
  const packed = att.marked || {}
  const use = backup && backup.ts > Date.parse(att.savedAt || att.startedAt) ? backup : null
  const answers = use ? use.answers : att.answers || {}
  const marked = use ? use.marked : packed.m || {}
  const current = (use ? use.current : att.current) || first
  const visited = { ...(use ? use.visited : packed.v) || {}, [current]: true }
  for (const n of Object.keys(answers)) visited[n] = true
  for (const n of Object.keys(marked)) visited[n] = true
  return {
    id: att.id, testId: test.id, testName: test.name, candidate, startedAt: Date.parse(att.startedAt), submittedAt: null, state: 'inprogress',
    answers, marked, visited, current, lang: (use ? use.lang : att.lang) || 'en', switches: Math.max(att.switches || 0, use?.switches || 0), proctor: (use && use.proctor) || packed.x || null,
    timing: (use && use.timing) || packed.t || null, changes: (use && use.changes) || packed.c || null,
  }
}

// What the candidate sees after submitting (or when they reopen the link): the paper with the key put back
// when the test allows a review, and the server's score.
export function resultView(res, test, candidate, finalAttempt = null) {
  const paper = res.test || test
  const att = res.attempt || {}
  return {
    test: { ...paper, showResult: res.showResult !== false, showAnswers: res.showAnswers !== false && !res.answersLater, answersLater: !!res.answersLater, sections: joinKey(paper.sections || [], res.key || {}) },
    attempt: {
      candidate, state: 'submitted', startedAt: Date.parse(att.startedAt || finalAttempt?.startedAt) || Date.now(), submittedAt: Date.parse(att.submittedAt) || Date.now(),
      answers: res.answers || finalAttempt?.answers || {}, switches: att.switches ?? finalAttempt?.switches ?? 0, autoSubmitted: !!att.autoSubmitted, score: res.score || null,
    },
  }
}

// ── how an online test is described to staff ─────────────────────────────────
export const stamp = v => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
export const statusOf = row => {
  if (!row) return { label: 'Not online', tone: ['#f1f5f9', '#64748b'] }
  const now = Date.now()
  if (row.status === 'closed' || (row.closes_at && now > Date.parse(row.closes_at))) return { label: 'Closed', tone: ['#fde8e6', '#b42318'] }
  if (row.status === 'draft') return { label: 'Draft', tone: ['#f1f5f9', '#64748b'] }
  if (row.opens_at && now < Date.parse(row.opens_at)) return { label: 'Opens later', tone: ['#fff4dc', '#9a5b00'] }
  return { label: 'Live', tone: ['#e7f6ec', '#146c3a'] }
}

export const inviteText = (name, row, minutes) => [
  `Online exam: ${name}`, `Link: ${examLink(row.id)}`, row.access_code ? `Access code: ${row.access_code}` : null, `Duration: ${minutes} minutes`,
  row.opens_at ? `Opens: ${stamp(row.opens_at)}` : null, row.closes_at ? `Closes: ${stamp(row.closes_at)}` : null,
  'Use a steady internet connection. Keep the page open until you submit.',
].filter(Boolean).join('\n')


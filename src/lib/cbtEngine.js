// cbtEngine.js — the rules of the CBT Exam: question status (as on the SSC / TCS exam screen), the palette
// counts, the answer key, the clock and the scoring. Pure — no browser, no database.

// Palette colours: Not Visited (grey), Not Answered (red), Answered (green), Marked for Review (purple),
// Answered & Marked for Review (purple with a green tick).
export const STATUS = { NV: 'notVisited', NA: 'notAnswered', A: 'answered', MR: 'marked', AMR: 'answeredMarked' }
export const STATUS_LABEL = {
  notVisited: 'Not Visited', notAnswered: 'Not Answered', answered: 'Answered', marked: 'Marked for Review',
  answeredMarked: 'Answered & Marked for Review',
}

export const flatQuestions = test => (test?.sections || []).flatMap((s, si) => s.questions.map(q => ({ ...q, sectionId: s.id, sectionIndex: si })))

export function newAttempt(test, candidate = {}, now = Date.now()) {
  const qs = flatQuestions(test)
  return {
    id: `${test.id}-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    testId: test.id, testName: test.name, candidate: { name: candidate.name || '', roll: candidate.roll || '' },
    startedAt: now, submittedAt: null, state: 'inprogress',
    answers: {}, visited: {}, marked: {}, current: qs[0]?.no ?? 1, lang: 'en', switches: 0, score: null,
  }
}

export function statusOf(a, no) {
  const answered = !!a.answers[no], marked = !!a.marked[no]
  if (answered && marked) return STATUS.AMR
  if (answered) return STATUS.A
  if (marked) return STATUS.MR
  return a.visited[no] ? STATUS.NA : STATUS.NV
}

const put = (obj, no, v) => { const o = { ...obj }; if (v === null || v === undefined || v === false) delete o[no]; else o[no] = v; return o }
export const visit = (a, no) => (a.visited[no] ? a : { ...a, visited: put(a.visited, no, true) })
export const go = (a, no) => ({ ...visit(a, no), current: no })
export const select = (a, no, key) => ({ ...a, answers: put(a.answers, no, key) })
export const clear = (a, no) => ({ ...a, answers: put(a.answers, no, null), marked: put(a.marked, no, null) })
export const mark = (a, no, on = true) => ({ ...a, marked: put(a.marked, no, on) })

// Counts for a set of questions (one section, or all).
export function counts(a, questions) {
  const c = { notVisited: 0, notAnswered: 0, answered: 0, marked: 0, answeredMarked: 0 }
  for (const q of questions) c[statusOf(a, q.no)]++
  return c
}

// The next question number after `no` in paper order (stays put on the last one).
export function neighbour(test, no, dir = 1) {
  const qs = flatQuestions(test)
  const i = qs.findIndex(q => q.no === no)
  return qs[Math.min(qs.length - 1, Math.max(0, i + dir))]?.no ?? no
}

// ── Clock ────────────────────────────────────────────────────────────────────
export const secondsLeft = (a, test, now = Date.now()) => Math.max(0, Math.round((a.startedAt + test.durationMin * 60000 - now) / 1000))
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Answer key ───────────────────────────────────────────────────────────────
// Accepts "1-A, 2-C", "1:A", "1 A" or "1. B" pairs (any separator / line breaks), or just the letters in
// question order ("ABCDDA…"). Returns { key: { [no]: 'A'..'D' }, errors: [] }.
export function parseKey(text, nos) {
  const key = {}, errors = []
  const src = String(text || '').toUpperCase()
  const pairs = [...src.matchAll(/(\d{1,3})\s*[-–—:.)=]*\s*\(?([A-D])\)?(?![A-Z])/g)]
  if (pairs.length) {
    for (const m of pairs) {
      const no = Number(m[1])
      if (!nos.includes(no)) errors.push(`Question ${no} is not in this test`)
      else { if (key[no] && key[no] !== m[2]) errors.push(`Question ${no} has two answers (${key[no]} and ${m[2]}) — the last one is used`); key[no] = m[2] }
    }
    return { key, errors }
  }
  const letters = src.replace(/[^A-D]/g, '')
  if (!letters) return { key, errors: src.trim() ? ['No answers found. Write "1-A, 2-C …" or the letters in order.'] : [] }
  if (letters.length !== nos.length) errors.push(`${letters.length} letters found for ${nos.length} questions`)
  nos.forEach((no, i) => { if (letters[i]) key[no] = letters[i] })
  return { key, errors }
}

// ── Scoring ──────────────────────────────────────────────────────────────────
export function grade(test, answers) {
  const { correct: plus = 1, wrong: minus = 0 } = test.marking || {}
  const sections = test.sections.map(s => {
    const r = { id: s.id, label: s.label, title: s.title, total: s.questions.length, attempted: 0, correct: 0, wrong: 0, unscored: 0, marks: 0, max: 0 }
    for (const q of s.questions) {
      const given = answers[q.no]
      if (given) r.attempted++
      if (!q.answer) { r.unscored++; continue }
      r.max += plus
      if (given === q.answer) { r.correct++; r.marks += plus } else if (given) { r.wrong++; r.marks -= minus }
    }
    r.marks = Math.round(r.marks * 100) / 100; r.max = Math.round(r.max * 100) / 100
    return r
  })
  const sum = f => sections.reduce((t, s) => t + s[f], 0)
  const marks = Math.round(sum('marks') * 100) / 100, max = Math.round(sum('max') * 100) / 100
  const attempted = sum('attempted')
  return {
    marks, max, total: sum('total'), attempted, correct: sum('correct'), wrong: sum('wrong'), unscored: sum('unscored'),
    skipped: sum('total') - attempted, accuracy: attempted ? Math.round((sum('correct') / attempted) * 1000) / 10 : 0,
    percent: max ? Math.round((marks / max) * 1000) / 10 : null, sections,
    complete: sum('unscored') === 0,
  }
}

// What the test needs before it can be scored.
export const keyStatus = test => {
  const qs = flatQuestions(test)
  const set = qs.filter(q => q.answer).length
  return { set, total: qs.length, complete: set === qs.length && qs.length > 0 }
}

export const DEFAULT_INSTRUCTIONS = `Please read the instructions carefully.

General Instructions:
1. The total duration of the examination is shown at the top. The clock counts down; when it reaches zero the test is submitted automatically. You do not have to submit when the time is over.
2. The question palette on the right shows the status of each question:
   Not Visited — you have not opened the question.
   Not Answered — you opened it but did not answer.
   Answered — you answered it.
   Marked for Review — you want to look at it again, no answer given.
   Answered & Marked for Review — answered, and will be counted unless you change it.
3. To answer: choose one option. Press "Save & Next" to save and go on, "Mark for Review & Next" to mark it and go on, or "Clear Response" to remove your answer.
4. To move to another question, click its number in the palette. Your selection on the current question is kept when you move.
5. Use the section names at the top to move between sections. You may return to any question until you submit.
6. Choose your language at the top right. The English text is always available.
7. Do not leave this screen, press the browser's back button or close the window. Switching away is recorded.`

// ── Results table ────────────────────────────────────────────────────────────
// One row per attempt, best score first, with a rank among the submitted attempts (ties share a rank).
export function resultRows(test, attempts) {
  const rows = attempts.map(a => {
    const g = grade(test, a.answers)
    return { attempt: a, g, submitted: a.state === 'submitted', took: a.submittedAt ? Math.round((a.submittedAt - a.startedAt) / 60000) : null }
  }).sort((x, y) => (y.submitted - x.submitted) || (y.g.marks - x.g.marks) || (x.took ?? 1e9) - (y.took ?? 1e9) || x.attempt.startedAt - y.attempt.startedAt)
  let rank = 0, prev = null, seen = 0
  for (const r of rows) {
    if (!r.submitted) { r.rank = null; continue }
    seen++
    if (prev === null || r.g.marks !== prev) { rank = seen; prev = r.g.marks }
    r.rank = rank
  }
  return rows
}

const csvCell = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
export function resultsCSV(test, attempts) {
  const head = ['Rank', 'Name', 'Roll no.', 'Status', 'Started', 'Submitted', 'Minutes', 'Marks', 'Out of', 'Correct', 'Wrong', 'Not answered', 'Accuracy %', ...test.sections.map(s => `${s.label || s.title} marks`), 'Left screen']
  const rows = resultRows(test, attempts).map(({ attempt: a, g, submitted, took, rank }) => [
    rank ?? '', a.candidate.name, a.candidate.roll, submitted ? 'Submitted' : 'In progress', new Date(a.startedAt).toLocaleString('en-IN'), a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-IN') : '',
    took ?? '', g.marks, g.max, g.correct, g.wrong, g.skipped, g.accuracy, ...g.sections.map(s => s.marks), a.switches || 0])
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

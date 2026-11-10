// cbtResultBoard.js — the data behind the admin "Result out" platform: every attempt of a test with the student's class
// detected from the ERP, overall and class ranks, summaries by class, toppers, filters / sorting, and the tables every
// export (CSV, Excel, PDF, print, WhatsApp text) is built from. Pure functions — no browser, no database.
import { classifyStudent, classDef, CLASS_ORDER } from './studentClass.js'
import { findStudent } from './cbtCertLogic.js'
import { flagText, flagTotal } from './cbtProctorLogic.js'

const round1 = n => Math.round(n * 10) / 10
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : round1((s[m - 1] + s[m]) / 2) }
const avg = xs => (xs.length ? round1(xs.reduce((t, x) => t + x, 0) / xs.length) : null)

/** Competition ranking (ties share a rank) by marks, best first — over the entries given, submitted ones only. */
function rankBy(entries, field) {
  const sub = entries.filter(e => e.submitted).sort((a, b) => b.marks - a.marks || (a.took ?? 1e9) - (b.took ?? 1e9))
  let rank = 0, prev = null, seen = 0
  for (const e of sub) { seen++; if (prev === null || e.marks !== prev) { rank = seen; prev = e.marks } e[field] = rank }
  for (const e of entries) if (!e.submitted) e[field] = null
}

/**
 * rows: resultRows(test, attempts); students: ERP students; secondaryMap: { studentId: [batch names] }
 * Returns one entry per attempt.
 */
export function buildBoard({ rows, students, secondaryMap = {} }) {
  const entries = rows.map(({ attempt: a, g, submitted, took }) => {
    const { student, how } = findStudent(students, a)
    const cls = classifyStudent(student, student ? secondaryMap[student.id] || [] : [])
    return {
      id: a.id, attempt: a, g, student, matchedBy: how,
      name: student?.name || a.candidate?.name || '', gcc: a.gcc || student?.gcc_no || '', roll: a.candidate?.roll || '',
      classKey: cls.key, classLabel: cls.label, course: cls.course, medium: cls.medium,
      submitted, status: submitted ? 'Submitted' : 'In progress',
      marks: g.marks, max: g.max, percent: g.percent, correct: g.correct, wrong: g.wrong, skipped: g.skipped, accuracy: g.accuracy,
      took, rank: null, classRank: null,
      sections: g.sections.map(s => ({ label: s.label, title: s.title, marks: s.marks, max: s.max })),
      flags: flagTotal(a.proctor), flagText: flagText(a.proctor), switches: a.switches || 0,
      parentPhone: a.parentPhone || a.phone || '', district: a.district || '', gender: a.gender || '', caste: a.caste || '',
      submittedAt: a.submittedAt || null, startedAt: a.startedAt || null,
    }
  })
  rankBy(entries, 'rank')                                   // the board ranks everyone itself (ties share a rank)
  const classes = [...new Set(entries.map(e => e.classKey))]
  for (const key of classes) rankBy(entries.filter(e => e.classKey === key), 'classRank')
  const submitted = entries.filter(e => e.submitted).length
  for (const e of entries) e.percentile = e.submitted && submitted > 1 ? Math.round(((submitted - e.rank) / (submitted - 1)) * 100) : (e.submitted ? 100 : null)
  return entries
}

/** Classes present in the board, in the school's order, with their attempt counts. */
export function classCounts(entries) {
  const m = new Map()
  for (const e of entries) m.set(e.classKey, (m.get(e.classKey) || 0) + 1)
  return CLASS_ORDER.filter(k => m.has(k)).map(k => ({ key: k, label: classDef(k).label, count: m.get(k) }))
}

/** f: { classKeys:Set|null, q:'', status:'all'|'submitted'|'inprogress', minPercent:number|'', flaggedOnly:boolean, passOnly:boolean, cutoff:number } */
export function filterEntries(entries, f = {}) {
  const q = String(f.q || '').trim().toLowerCase()
  return entries.filter(e => {
    if (f.classKeys && f.classKeys.size && !f.classKeys.has(e.classKey)) return false
    if (f.status === 'submitted' && !e.submitted) return false
    if (f.status === 'inprogress' && e.submitted) return false
    if (f.minPercent !== '' && f.minPercent != null && !(e.percent != null && e.percent >= Number(f.minPercent))) return false
    if (f.flaggedOnly && !e.flags) return false
    if (f.passOnly && !(e.submitted && e.percent != null && e.percent >= Number(f.cutoff ?? 0))) return false
    if (q && !`${e.name} ${e.gcc} ${e.roll} ${e.classLabel}`.toLowerCase().includes(q)) return false
    return true
  })
}

const SORTERS = {
  rank: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name),
  classRank: (a, b) => (a.classRank ?? 1e9) - (b.classRank ?? 1e9) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  gcc: (a, b) => String(a.gcc).localeCompare(String(b.gcc), undefined, { numeric: true }),
  class: (a, b) => CLASS_ORDER.indexOf(a.classKey) - CLASS_ORDER.indexOf(b.classKey) || (a.classRank ?? 1e9) - (b.classRank ?? 1e9),
  marks: (a, b) => b.marks - a.marks,
  percent: (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
  accuracy: (a, b) => b.accuracy - a.accuracy,
  time: (a, b) => (a.took ?? 1e9) - (b.took ?? 1e9),
  flags: (a, b) => b.flags - a.flags,
}
export const SORT_KEYS = Object.keys(SORTERS)
export function sortEntries(entries, key = 'rank', dir = 'asc') {
  const f = SORTERS[key] || SORTERS.rank
  const out = [...entries].sort(f)
  return dir === 'desc' ? out.reverse() : out
}

const stats = (list, cutoff) => {
  const sub = list.filter(e => e.submitted)
  const pct = sub.map(e => e.percent).filter(p => p != null)
  const pass = sub.filter(e => e.percent != null && e.percent >= cutoff)
  const top = [...sub].sort((a, b) => b.marks - a.marks)[0]
  return {
    count: list.length, submitted: sub.length, inProgress: list.length - sub.length,
    avgPercent: avg(pct), medianPercent: median(pct), highest: sub.length ? Math.max(...sub.map(e => e.marks)) : null, lowest: sub.length ? Math.min(...sub.map(e => e.marks)) : null,
    avgMarks: avg(sub.map(e => e.marks)), avgAccuracy: avg(sub.map(e => e.accuracy)), avgTime: avg(sub.map(e => e.took).filter(t => t != null)),
    pass: pass.length, passRate: sub.length ? round1((pass.length / sub.length) * 100) : null, topName: top ? top.name : '', topMarks: top ? top.marks : null,
  }
}

/** Overall and per-class numbers. cutoff = pass mark in percent. */
export function summarize(entries, cutoff = 40) {
  const overall = stats(entries, cutoff)
  const byClass = classCounts(entries).map(c => ({ key: c.key, label: c.label, ...stats(entries.filter(e => e.classKey === c.key), cutoff) }))
  const sectionBest = (entries[0]?.sections || []).map((s, i) => {
    const best = entries.filter(e => e.submitted).sort((a, b) => b.sections[i].marks - a.sections[i].marks)[0]
    return { label: s.label, title: s.title, name: best?.name || '', marks: best ? best.sections[i].marks : null, max: s.max }
  })
  return { overall, byClass, sectionBest, cutoff }
}

/** The top N submitted candidates of each class. */
export function toppers(entries, n = 3) {
  return classCounts(entries).map(c => ({
    key: c.key, label: c.label,
    list: entries.filter(e => e.classKey === c.key && e.submitted).sort((a, b) => (a.classRank ?? 1e9) - (b.classRank ?? 1e9) || a.name.localeCompare(b.name)).slice(0, n),
  })).filter(x => x.list.length)
}

// ── tables for the exports ─────────────────────────────────────────────────────
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
export function tableOf(entries, { sections = entries[0]?.sections || [], detailed = true } = {}) {
  const head = ['Rank', 'Class rank', 'Name', 'GCC no.', 'Class', 'Marks', 'Out of', 'Percent', 'Percentile']
  if (detailed) head.push('Correct', 'Wrong', 'Not answered', 'Accuracy %', 'Minutes', ...sections.map(s => `${s.label ? `${s.label} · ` : ''}${s.title || 'Section'}`), 'Status', 'Parent no.', 'Submitted', 'Flags')
  const rows = entries.map(e => {
    const base = [e.rank ?? '', e.classRank ?? '', e.name, e.gcc, e.classLabel, e.marks, e.max, e.percent ?? '', e.percentile ?? '']
    return detailed ? [...base, e.correct, e.wrong, e.skipped, e.accuracy, e.took ?? '', ...sections.map((s, i) => e.sections[i]?.marks ?? ''), e.status, e.parentPhone, e.submitted ? when(e.submittedAt) : '', e.flagText] : base
  })
  return { head, rows }
}

// a name typed into the public exam form must not turn into a spreadsheet formula
const csvCell = v => { let t = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
export const csvOf = ({ head, rows }) => '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')

const safeSheet = (name, used) => {
  let n = String(name).replace(/[\\/?*[\]:]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Sheet'
  let i = 2, out = n
  while (used.has(out.toLowerCase())) out = `${n.slice(0, 25)} ${i++}`
  used.add(out.toLowerCase()); return out
}
/** Sheets for an Excel workbook: Summary, All, then one sheet per class. [{ name, aoa }] */
export function workbookSheets({ test, entries, summary, cutoff }) {
  const used = new Set()
  const s = summary.overall
  const sum = [
    [test.name], [`Result generated ${when(Date.now())}`], [],
    ['Appeared', s.count, 'Submitted', s.submitted, 'In progress', s.inProgress],
    ['Average %', s.avgPercent ?? '', 'Median %', s.medianPercent ?? '', 'Highest marks', s.highest ?? '', 'Lowest marks', s.lowest ?? ''],
    [`Pass mark ${cutoff}%`, `Passed ${s.pass}`, `Pass rate ${s.passRate ?? ''}%`], [],
    ['Class', 'Appeared', 'Submitted', 'Average %', 'Median %', 'Highest', 'Lowest', 'Pass', 'Pass rate %', 'Average accuracy %', 'Average minutes', 'Topper', 'Topper marks'],
    ...summary.byClass.map(c => [c.label, c.count, c.submitted, c.avgPercent ?? '', c.medianPercent ?? '', c.highest ?? '', c.lowest ?? '', c.pass, c.passRate ?? '', c.avgAccuracy ?? '', c.avgTime ?? '', c.topName, c.topMarks ?? '']),
  ]
  const sheets = [{ name: safeSheet('Summary', used), aoa: sum }]
  const all = tableOf(sortEntries(entries, 'rank'))
  sheets.push({ name: safeSheet('All results', used), aoa: [all.head, ...all.rows] })
  for (const c of classCounts(entries)) {
    const t = tableOf(sortEntries(entries.filter(e => e.classKey === c.key), 'classRank'))
    sheets.push({ name: safeSheet(c.label, used), aoa: [t.head, ...t.rows] })
  }
  return sheets
}

/** A short message for the parents' / students' WhatsApp group. */
export function whatsappText({ test, summary, tops, topN = 3 }) {
  const s = summary.overall
  const medal = ['🥇', '🥈', '🥉']
  const out = [`*${test.name} — Result*`, `${s.submitted} appeared · average ${s.avgPercent ?? '—'}% · highest ${s.highest ?? '—'} marks`, '']
  for (const t of tops) {
    out.push(`*${t.label}*`)
    t.list.slice(0, topN).forEach((e, i) => out.push(`${medal[i] || `${i + 1}.`} ${e.name} — ${e.marks}/${e.max}${e.percent != null ? ` (${e.percent}%)` : ''}`))
    out.push('')
  }
  out.push('Guidance Navodaya & Sainik Institute, Khangabok')
  return out.join('\n')
}

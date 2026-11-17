// SyllabusOfficial.jsx — Teaching → Syllabus → "Official Syllabus".
// The latest official exam syllabus for every course and admission class:
// exam pattern, every chapter per subject, and how much has been taught
// (matched from Daily Logs). Chapters kept only for existing data are
// listed separately so nothing saved under them is lost.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { PX, PIcon } from './premiumUI'
import { COURSES, COURSE_LIST, TAXONOMY_BASE } from './qbankTaxonomy'
import {
  EXAM_PATTERNS, classesOf, officialSubjects, patternTotals, chapterCoverage,
  isInCurrentSyllabus, normName,
} from './officialSyllabus'

const COURSE_MATCH = { sainik: /sainik|aissee/, navodaya: /navodaya|jnv/, rms: /rms|military/, foundation: /foundation/ }
// A log with no course recorded still counts, so older logs aren't ignored.
const logInCourse = (log, key) => !log.course || COURSE_MATCH[key]?.test(String(log.course).toLowerCase())
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '')
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Which exam section a subject belongs to (Language sections cover the
// English/Hindi language lists).
function sectionFor(pattern, subject) {
  const secs = pattern?.sections || []
  return secs.find(s => s.subject === subject)
    || (/language/i.test(subject) ? secs.find(s => s.subject === 'Language') : null)
}

function printSyllabus({ courseLabel, exam, cls, pattern, subjects }) {
  const totals = pattern ? patternTotals(pattern) : null
  const sec = pattern ? `<table><thead><tr><th>Subject</th><th>Questions</th><th>Marks</th></tr></thead><tbody>${pattern.sections.map(s => `<tr><td>${esc(s.subject)}${s.paper ? ` <small>(${esc(s.paper)})</small>` : ''}${s.qualifyingOnly ? ' <small>(qualifying)</small>' : ''}</td><td>${s.questions}</td><td>${s.questions * s.marksEach}</td></tr>`).join('')}<tr><th>Total</th><th>${totals.questions}</th><th>${totals.marks}</th></tr></tbody></table><p class="muted">Duration ${pattern.durationMin} minutes · ${pattern.negative ? 'Negative marking' : 'No negative marking'} · ${esc(pattern.mode)} · Medium: ${esc(pattern.medium)}</p>` : ''
  const body = Object.entries(subjects).map(([s, chs]) => `<h2>${esc(s)}</h2><ol>${chs.map(c => `<li>${esc(c)}</li>`).join('')}</ol>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(exam)} ${esc(cls)} syllabus</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;color:#0f1b2e;margin:32px;line-height:1.5}h1{font-family:Georgia,serif;color:#132a4f;margin:0}
    .sub{color:#5d6b82;margin-bottom:16px}h2{font-size:15px;color:#132a4f;border-bottom:2px solid #b8923a;padding-bottom:3px;margin:20px 0 8px;break-after:avoid}
    ol{columns:2;column-gap:32px;margin:0;padding-left:22px;font-size:13px}li{break-inside:avoid}table{border-collapse:collapse;font-size:13px;margin:8px 0}
    td,th{border:1px solid #e8e3d8;padding:6px 12px;text-align:left}th{background:#faf8f3}.muted{color:#5d6b82;font-size:12px}@media print{body{margin:12mm}}
  </style></head><body><h1>${esc(courseLabel)} — ${esc(cls)} syllabus</h1><div class="sub">${esc(exam)} · Guidance Navodaya &amp; Sainik Institute</div>${sec}${body}</body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const w = window.open(url, '_blank')
  if (!w) { const a = document.createElement('a'); a.href = url; a.download = 'syllabus.html'; a.click() }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Subjects in exam-section order for one course + class (Foundation: the
// course lists). The syllabus is static, so each result is built once.
const SUBJECTS_CACHE = new Map()
function subjectsFor(course, cls) {
  const key = `${course}|${cls}`
  if (!SUBJECTS_CACHE.has(key)) {
    let value = COURSES[course].subjects
    if (cls) {
      const order = (EXAM_PATTERNS[course].classes[cls]?.sections || []).map(s => s.subject)
      const rank = s => { const i = order.indexOf(s); return i >= 0 ? i : /language/i.test(s) ? order.indexOf('Language') + 0.5 : 99 }
      value = Object.fromEntries(Object.entries(officialSubjects(course, cls)).sort((a, b) => rank(a[0]) - rank(b[0])))
    }
    SUBJECTS_CACHE.set(key, value)
  }
  return SUBJECTS_CACHE.get(key)
}

const chip = (tone, bg) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, color: tone, background: bg, whiteSpace: 'nowrap', letterSpacing: '.02em' })

function SubjectCard({ subject, chapters, coverage, section, baseSet, filter, query, open, onToggle, manualRows = [], canAdd, canDelete, onAdd, onDelete, onRename }) {
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState('')
  const manualBy = Object.fromEntries(manualRows.map(r => [normName(r.chapter_name), r]))
  const taughtCount = chapters.filter(c => coverage[c]?.taught > 0).length
  const pct = chapters.length ? Math.round((taughtCount / chapters.length) * 100) : 0
  const q = normName(query)
  const shown = chapters.filter(c => (!q || normName(c).includes(q)) &&
    (filter === 'all' || (filter === 'taught' ? coverage[c]?.taught > 0 : filter === 'pending' ? !(coverage[c]?.taught > 0) : !baseSet.has(normName(c)))))
  const LIMIT = 8
  const list = open || q || filter !== 'all' ? shown : shown.slice(0, LIMIT)
  if (!shown.length && (q || filter !== 'all')) return null
  return (
    <div className="px-card" id={'syl-' + normName(subject).replace(/\s+/g, '-')} style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 120 }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: PX.serif, fontSize: 17, fontWeight: 600, color: PX.ink, lineHeight: 1.25 }}>{subject}</div>
            <div style={{ fontSize: 12, color: PX.sub, marginTop: 3 }}>{chapters.length} chapters · {taughtCount} taught</div>
          </div>
          {section && (
            <span style={chip(PX.navy, '#e4ebf6')} title={section.note || ''}>
              {section.questions} Q · {Math.round(section.questions * section.marksEach * 100) / 100} marks{section.qualifyingOnly ? ' · qualifying' : ''}
            </span>
          )}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 7, borderRadius: 99, background: '#f1ede3', overflow: 'hidden' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${subject} coverage`}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: pct >= 70 ? PX.ok : pct >= 35 ? PX.gold : '#c2410c' }} />
          </div>
          <b style={{ fontSize: 12, color: PX.ink2, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{pct}%</b>
        </div>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: '6px 10px 10px', display: 'grid', gap: 2, flex: 1 }}>
        {list.map(c => {
          const cv = coverage[c] || {}
          const man = manualBy[normName(c)]
          const isNew = !baseSet.has(normName(c)) && !man
          return (
            <li key={c} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 10, background: cv.taught ? '#f3faf6' : 'transparent' }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: cv.taught ? PX.ok : PX.line2 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: PX.ink2 }}>
                {c}
                {isNew && <span style={{ ...chip('#8a6118', PX.goldBg), marginLeft: 6 }}>New</span>}
                {man && <span style={{ ...chip('#5b21b6', '#f1eaff'), marginLeft: 6 }} title="Added manually">Manual</span>}
              </span>
              <span style={{ fontSize: 11.5, color: cv.taught ? PX.ok : PX.faint, whiteSpace: 'nowrap', fontWeight: 600 }}>
                {cv.taught ? `Taught ${cv.taught}× · ${fmtDate(cv.last)}` : 'Not yet'}
              </span>
              {man && canAdd && <button type="button" aria-label={`Rename manual chapter ${c}`} title="Rename this manual chapter" onClick={() => onRename(man)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5b21b6', fontSize: 14, padding: '0 2px' }}>✎</button>}
              {man && canDelete && <button type="button" aria-label={`Remove manual chapter ${c}`} title="Remove this manual chapter" onClick={() => onDelete(man)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#b42318', fontSize: 15, padding: '0 2px' }}>✕</button>}
            </li>
          )
        })}
        {!list.length && <li style={{ fontSize: 12.5, color: PX.faint, padding: 8 }}>No chapters match.</li>}
      </ol>
      {canAdd && (
        <div style={{ padding: '0 14px 12px' }}>
          {adding ? (
            <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { onAdd(subject, [draft]); setDraft(''); setAdding(false) } }} style={{ display: 'flex', gap: 6 }}>
              <input className="px-input" autoFocus style={{ flex: 1 }} value={draft} onChange={e => setDraft(e.target.value)} placeholder="New chapter name" aria-label={`New chapter for ${subject}`} />
              <button type="submit" className="px-btn gold" style={{ padding: '7px 14px', fontSize: 13 }} disabled={!draft.trim()}>Add</button>
              <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => { setAdding(false); setDraft('') }}>×</button>
            </form>
          ) : <button type="button" onClick={() => setAdding(true)} className="px-btn ghost" style={{ width: '100%', padding: '7px 12px', fontSize: 12.5, borderStyle: 'dashed' }}>＋ Add chapter to {subject}</button>}
        </div>
      )}
      {!q && filter === 'all' && shown.length > LIMIT && (
        <button type="button" onClick={onToggle} className="px-btn ghost" style={{ margin: '0 16px 14px', padding: '7px 12px', fontSize: 12.5 }}>
          {open ? 'Show fewer' : `Show all ${shown.length} chapters`}
        </button>
      )}
    </div>
  )
}

// Narrow screens show just the exam name on the course buttons.
function useNarrow() {
  const q = '(max-width: 640px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = e => setNarrow(e.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

export default function SyllabusOfficial({ logs = [], canAdd = false, canDelete = false }) {
  const narrow = useNarrow()
  const [course, setCourse] = useState('sainik')
  const classes = classesOf(course)
  const [clsPick, setCls] = useState(6)
  const cls = classes.length ? (classes.includes(clsPick) ? clsPick : classes[0]) : null
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openSubjects, setOpenSubjects] = useState({})

  const meta = COURSES[course]
  const examInfo = EXAM_PATTERNS[course]
  const pattern = cls ? examInfo.classes[cls] : null
  const totals = pattern ? patternTotals(pattern) : null
  const clsLabel = cls ? `Class ${cls}` : 'Class 5–8'

  // Official subjects in exam-section order, plus chapters added by hand (stored in the shared chapter catalogue).
  const base = subjectsFor(course, cls)
  const [manualRows, setManualRows] = useState([]), [toast, setToast] = useState(''), [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false), [addForm, setAddForm] = useState({ subject: '', newSubject: '', text: '' })
  const loadManual = useCallback(async () => {
    const { data, error } = await supabase.from('syllabus_topics').select('id, course, subject_name, chapter_name, display_order, syllabus_id').order('display_order').order('chapter_name')
    if (error) return
    setManualRows((data || []).filter(r => !r.syllabus_id && String(r.course || '').trim().toLowerCase() === course && r.subject_name && r.chapter_name))
  }, [course])
  useEffect(() => { loadManual() }, [loadManual])
  const manualBySubject = useMemo(() => {
    const by = {}
    manualRows.forEach(r => {
      const official = (base[r.subject_name] || []).some(c => normName(c) === normName(r.chapter_name))
      if (!official) (by[r.subject_name] ||= []).push(r)
    })
    return by
  }, [manualRows, base])
  const subjects = useMemo(() => {
    const out = Object.fromEntries(Object.entries(base).map(([s, l]) => [s, [...l]]))
    Object.entries(manualBySubject).forEach(([s, rows]) => { const l = out[s] ||= []; const seen = new Set(l.map(normName)); rows.forEach(r => { if (!seen.has(normName(r.chapter_name))) { l.push(r.chapter_name); seen.add(normName(r.chapter_name)) } }) })
    return out
  }, [base, manualBySubject])
  const say = m => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const addChapters = async (subject, names) => {
    const subj = String(subject || '').trim()
    const have = new Set((subjects[subj] || []).map(normName)), seen = new Set()
    const fresh = names.map(n => String(n).trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(n => n && !have.has(normName(n)) && !seen.has(normName(n)) && seen.add(normName(n)))
    if (!subj) return say('Choose or type a subject first.')
    if (!fresh.length) return say('Nothing new to add — those chapters are already listed.')
    setSaving(true)
    const start = Math.max(0, ...manualRows.filter(r => r.subject_name === subj).map(r => Number(r.display_order) || 0)) + 1
    const { error } = await supabase.from('syllabus_topics').insert(fresh.map((n, i) => ({ course, subject_name: subj, chapter_name: n, display_order: start + i, subtopics: [] })))
    setSaving(false)
    if (error) return say('Could not save: ' + error.message)
    say(`✓ ${fresh.length} chapter${fresh.length === 1 ? '' : 's'} added to ${subj}`); setAddForm({ subject: '', newSubject: '', text: '' }); setAddOpen(false); loadManual()
  }
  const renameManual = async row => {
    const name = window.prompt('Rename this chapter:', row.chapter_name); if (name == null) return
    const n = name.trim(); if (!n || n === row.chapter_name) return
    if ((subjects[row.subject_name] || []).some(c => normName(c) === normName(n) && normName(c) !== normName(row.chapter_name))) return say('A chapter with that name is already listed.')
    const { error } = await supabase.from('syllabus_topics').update({ chapter_name: n }).eq('id', row.id)
    if (error) return say('Could not rename: ' + error.message)
    say('✓ Chapter renamed'); loadManual()
  }
  const removeManual = async row => {
    if (!window.confirm(`Remove the manual chapter “${row.chapter_name}” from ${row.subject_name}?`)) return
    const { error } = await supabase.from('syllabus_topics').delete().eq('id', row.id)
    if (error) return say('Could not remove: ' + error.message)
    say('Chapter removed'); loadManual()
  }

  const courseLogs = useMemo(() => logs.filter(l => logInCourse(l, course)), [logs, course])
  const coverage = useMemo(() => Object.fromEntries(Object.entries(subjects).map(([s, chs]) => [s, chapterCoverage(chs, s, courseLogs)])), [subjects, courseLogs])
  const baseSets = useMemo(() => Object.fromEntries(Object.keys(subjects).map(s => [s, new Set((TAXONOMY_BASE[course]?.subjects?.[s] || []).map(normName))])), [subjects, course])

  const allChapters = Object.values(subjects).reduce((t, l) => t + l.length, 0)
  const allTaught = Object.entries(subjects).reduce((t, [s, chs]) => t + chs.filter(c => coverage[s]?.[c]?.taught > 0).length, 0)
  const newCount = Object.entries(subjects).reduce((t, [s, chs]) => t + chs.filter(c => !baseSets[s]?.has(normName(c))).length, 0)
  const outdated = useMemo(() => Object.entries(COURSES[course].subjects).flatMap(([s, chs]) => chs.filter(c => !isInCurrentSyllabus(course, s, c)).map(c => ({ s, c }))), [course])

  return (
    <div>
      {/* Course + class pickers */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div role="tablist" aria-label="Course" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COURSE_LIST.map(k => {
            const on = k === course
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setCourse(k); setOpenSubjects({}) }}
                style={{ padding: '9px 14px', borderRadius: 12, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', color: on ? PX.ink : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {narrow ? EXAM_PATTERNS[k].exam : <>{COURSES[k].label} <span style={{ color: on ? '#8a6118' : PX.faint, fontWeight: 800, fontSize: 11 }}>· {EXAM_PATTERNS[k].exam}</span></>}
              </button>
            )
          })}
        </div>
        {classes.length > 0 && (
          <div role="tablist" aria-label="Admission class" style={{ display: 'inline-flex', padding: 4, background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 12, gap: 2 }}>
            {classes.map(c => (
              <button key={c} type="button" role="tab" aria-selected={c === cls} onClick={() => { setCls(c); setOpenSubjects({}) }}
                style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: c === cls ? `linear-gradient(180deg,${PX.navy2},${PX.navy})` : 'transparent', color: c === cls ? '#fff' : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Class {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exam pattern */}
      <section className="px-hero" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: PX.goldLt }}>Latest official syllabus</div>
            <div style={{ fontFamily: PX.serif, fontSize: 26, fontWeight: 600, marginTop: 2 }}>{examInfo.exam} · {clsLabel}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 3 }}>{meta.label} · {examInfo.body}</div>
          </div>
          <button type="button" className="px-hbtn gold" onClick={() => printSyllabus({ courseLabel: meta.label, exam: examInfo.exam, cls: clsLabel, pattern, subjects })}>
            <PIcon.print size={15} /> Print syllabus
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginTop: 16 }}>
          {(pattern ? [
            { l: 'Duration', v: `${pattern.durationMin} min` },
            { l: 'Questions', v: totals.questions },
            { l: 'Total marks', v: totals.marks, s: totals.meritMarks !== totals.marks ? `${totals.meritMarks} count in merit` : '' },
            { l: 'Negative marking', v: pattern.negative ? 'Yes' : 'None' },
            { l: 'Syllabus taught', v: `${allTaught}/${allChapters}`, s: newCount ? `${newCount} chapters new in this update` : '' },
          ] : [
            { l: 'Entrance exam', v: 'None' },
            { l: 'Subjects', v: Object.keys(subjects).length },
            { l: 'Syllabus taught', v: `${allTaught}/${allChapters}` },
          ]).map(x => (
            <div key={x.l} className="px-hstat">
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: 'rgba(255,255,255,.58)' }}>{x.l}</div>
              <div style={{ fontFamily: PX.serif, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{x.v}</div>
              {x.s && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>{x.s}</div>}
            </div>
          ))}
        </div>
        {pattern && (
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            {pattern.sections.map(s => {
              const marks = Math.round(s.questions * s.marksEach * 100) / 100
              return (
                <div key={s.subject} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1.4fr) 3fr auto', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{s.subject}{s.paper ? <span style={{ color: PX.goldLt, fontWeight: 600 }}> · {s.paper}</span> : null}</span>
                  <span style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(marks / totals.marks) * 100}%`, borderRadius: 99, background: s.qualifyingOnly ? 'rgba(255,255,255,.45)' : `linear-gradient(90deg,${PX.gold},${PX.goldLt})` }} />
                  </span>
                  <span style={{ color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{s.questions} Q × {s.marksEach} = <b style={{ color: '#fff' }}>{marks}</b>{s.qualifyingOnly ? ' · qualifying' : ''}</span>
                </div>
              )
            })}
            {(pattern.notes || []).map(n => <div key={n} style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>• {n}</div>)}
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>• {pattern.mode} · Medium: {pattern.medium}</div>
          </div>
        )}
        {!pattern && <div style={{ marginTop: 12, fontSize: 12.5, color: 'rgba(255,255,255,.7)' }}>Board-aligned Class 5–8 course following the NCERT textbooks — there is no entrance exam pattern.</div>}
      </section>

      {/* Toolbar (sticks while scrolling the subject cards) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--px-bg, #faf8f3)', padding: '8px 0', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
            <input className="px-input" style={{ width: '100%', paddingRight: 32 }} placeholder="🔍 Search chapters…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search chapters" />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: PX.sub, fontSize: 16 }}>×</button>}
          </div>
          <div className="px-tabs" role="tablist" aria-label="Chapter filter" style={{ marginBottom: 0 }}>
            {[['all', 'All'], ['pending', 'Not yet taught'], ['taught', 'Taught'], ...(newCount ? [['new', 'New']] : [])].map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={'px-tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)} style={{ padding: '7px 12px', fontSize: 12.5 }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setOpenSubjects(Object.fromEntries(Object.keys(subjects).map(s => [s, true])))}>Expand all</button>
            <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => setOpenSubjects({})}>Collapse all</button>
          </div>
        </div>
        {/* Jump straight to a subject */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.keys(subjects).map(s => (
            <button key={s} type="button" onClick={() => document.getElementById('syl-' + normName(s).replace(/\s+/g, '-'))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ padding: '4px 11px', borderRadius: 99, border: `1px solid ${PX.line}`, background: '#fff', color: PX.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {canAdd && (
        <div className="px-card" style={{ marginBottom: 14, borderStyle: addOpen ? 'solid' : 'dashed', borderColor: addOpen ? PX.gold : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px' }}>
            <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontFamily: PX.serif, fontSize: 16, fontWeight: 600 }}>Add syllabus manually</div><div style={{ fontSize: 12.5, color: PX.sub }}>Add chapters (or a whole new subject) that are not in the official list. Shared with all staff.</div></div>
            <button type="button" className={addOpen ? 'px-btn ghost' : 'px-btn gold'} onClick={() => setAddOpen(v => !v)}>{addOpen ? 'Cancel' : '＋ Add chapters'}</button>
          </div>
          {addOpen && (
            <form onSubmit={e => { e.preventDefault(); addChapters(addForm.subject === '__new' ? addForm.newSubject : addForm.subject, addForm.text.split(/\r?\n|;/)) }} style={{ padding: '0 16px 16px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Subject
                  <select className="px-input" style={{ marginTop: 4 }} value={addForm.subject} onChange={e => setAddForm(f => ({ ...f, subject: e.target.value }))} aria-label="Subject">
                    <option value="">Choose…</option>{Object.keys(subjects).map(sj => <option key={sj} value={sj}>{sj}</option>)}<option value="__new">＋ New subject…</option>
                  </select></label>
                {addForm.subject === '__new' && <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>New subject name<input className="px-input" style={{ marginTop: 4 }} value={addForm.newSubject} onChange={e => setAddForm(f => ({ ...f, newSubject: e.target.value }))} placeholder="e.g. Computer Science" aria-label="New subject name" /></label>}
              </div>
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Chapters — one per line (paste a whole list)
                <textarea className="px-input" rows={5} style={{ marginTop: 4, resize: 'vertical' }} value={addForm.text} onChange={e => setAddForm(f => ({ ...f, text: e.target.value }))} placeholder={'Fractions revision\nWord problems\nMental maths tricks'} aria-label="Chapters" /></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="px-btn gold" disabled={saving || !(addForm.subject === '__new' ? addForm.newSubject.trim() : addForm.subject) || !addForm.text.trim()}>{saving ? 'Saving…' : 'Add to syllabus'}</button>
                <span style={{ fontSize: 12, color: PX.sub }}>{addForm.text.split(/\r?\n|;/).filter(x => x.trim()).length} chapter(s) · {course === 'foundation' ? 'Foundation' : COURSES[course].label}</span>
              </div>
            </form>
          )}
        </div>
      )}
      {toast && <div role="status" style={{ position: 'sticky', top: 8, zIndex: 6, margin: '0 0 12px', padding: '10px 14px', borderRadius: 12, background: '#243049', color: '#fff', fontSize: 13.5 }}>{toast}</div>}

      {/* Subjects */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 14, alignItems: 'start' }}>
        {Object.entries(subjects).map(([s, chs]) => (
          <SubjectCard key={s} subject={s} chapters={chs} coverage={coverage[s] || {}} section={sectionFor(pattern, s)}
            baseSet={baseSets[s] || new Set()} filter={filter} query={query} manualRows={manualBySubject[s] || []} canAdd={canAdd} canDelete={canDelete} onAdd={addChapters} onDelete={removeManual} onRename={renameManual}
            open={!!openSubjects[s]} onToggle={() => setOpenSubjects(o => ({ ...o, [s]: !o[s] }))} />
        ))}
      </div>

      {outdated.length > 0 && (
        <div className="px-card" style={{ marginTop: 16 }}>
          <div className="px-card-h"><span className="bar" /><div style={{ flex: 1 }}>
            <div className="px-card-t">Not in the current syllabus</div>
            <div className="px-card-s">Kept so questions, materials and topics saved under these names still work.</div>
          </div></div>
          <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {outdated.map(o => <span key={o.s + o.c} style={chip(PX.sub, PX.tint)}>{o.s}: {o.c}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

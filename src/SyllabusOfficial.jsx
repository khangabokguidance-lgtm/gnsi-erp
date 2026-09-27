// SyllabusOfficial.jsx — Teaching → Syllabus → "Official Syllabus".
// The latest official exam syllabus for every course and admission class:
// exam pattern, every chapter per subject, and how much has been taught
// (matched from Daily Logs). Chapters kept only for existing data are
// listed separately so nothing saved under them is lost.
import { useEffect, useMemo, useState } from 'react'
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

function SubjectCard({ subject, chapters, coverage, section, baseSet, filter, query, open, onToggle }) {
  const taughtCount = chapters.filter(c => coverage[c]?.taught > 0).length
  const pct = chapters.length ? Math.round((taughtCount / chapters.length) * 100) : 0
  const q = normName(query)
  const shown = chapters.filter(c => (!q || normName(c).includes(q)) &&
    (filter === 'all' || (filter === 'taught' ? coverage[c]?.taught > 0 : filter === 'pending' ? !(coverage[c]?.taught > 0) : !baseSet.has(normName(c)))))
  const LIMIT = 8
  const list = open || q || filter !== 'all' ? shown : shown.slice(0, LIMIT)
  if (!shown.length && (q || filter !== 'all')) return null
  return (
    <div className="px-card" style={{ display: 'flex', flexDirection: 'column' }}>
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
          const isNew = !baseSet.has(normName(c))
          return (
            <li key={c} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 10, background: cv.taught ? '#f3faf6' : 'transparent' }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: cv.taught ? PX.ok : PX.line2 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: PX.ink2 }}>
                {c}
                {isNew && <span style={{ ...chip('#8a6118', PX.goldBg), marginLeft: 6 }}>New</span>}
              </span>
              <span style={{ fontSize: 11.5, color: cv.taught ? PX.ok : PX.faint, whiteSpace: 'nowrap', fontWeight: 600 }}>
                {cv.taught ? `Taught ${cv.taught}× · ${fmtDate(cv.last)}` : 'Not yet'}
              </span>
            </li>
          )
        })}
        {!list.length && <li style={{ fontSize: 12.5, color: PX.faint, padding: 8 }}>No chapters match.</li>}
      </ol>
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

export default function SyllabusOfficial({ logs = [] }) {
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

  // Subjects in exam-section order; Foundation falls back to its course lists.
  const subjects = subjectsFor(course, cls)

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

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input className="px-input" style={{ flex: '1 1 220px', maxWidth: 360 }} placeholder="Search chapters…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search chapters" />
        <div className="px-tabs" role="tablist" aria-label="Chapter filter" style={{ marginBottom: 0 }}>
          {[['all', 'All'], ['pending', 'Not yet taught'], ['taught', 'Taught'], ...(newCount ? [['new', 'New']] : [])].map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={'px-tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)} style={{ padding: '7px 12px', fontSize: 12.5 }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Subjects */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 14, alignItems: 'start' }}>
        {Object.entries(subjects).map(([s, chs]) => (
          <SubjectCard key={s} subject={s} chapters={chs} coverage={coverage[s] || {}} section={sectionFor(pattern, s)}
            baseSet={baseSets[s] || new Set()} filter={filter} query={query}
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

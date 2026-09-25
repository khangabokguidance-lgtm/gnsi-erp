// QuestionBankViewer.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// Read-only Question Bank browser, built as a "view module" on top of
// StudyMaterial.jsx's course → subject → chapter drill-down UI — same
// color tokens (C), same custom-subject/chapter merge pattern
// (study_course_structure, as in StudyMaterial's mergedCourses) — but
// instead of listing uploaded files, this queries qbank_questions directly
// and renders the actual questions for the selected subject+chapter.
//
// Deliberately NOT the same file as QuestionBank.jsx: that file is the
// full CRUD workspace (add/edit/delete/bulk-paste/create paper/online
// test) gated to admin + Computer Staffs. This is a lighter, read-only
// lens for browsing what's already in the bank — no selection checkboxes,
// no edit/delete, no test builder. Column names (course, subject, chapter,
// subsection, question, question_mayek, question_mayek_font,
// option_a..d, option_a_mayek..d_mayek, correct_option, difficulty,
// marks, diagram_url) are the ones QuestionBank.jsx writes.
//
// The course → subject → chapter list comes from qbankTaxonomy.js — the
// same module QuestionBank.jsx saves questions with — so the subject names
// queried here are the ones actually stored in qbank_questions.subject.
// (A hand-copied list here had drifted: e.g. Navodaya "Arithmetic" was
// being queried as "Mathematics", so questions saved under Navodaya's own
// subject names never showed up.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from './supabase'
import { normalizeToQBank, fetchAllPages } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { isAdminRole } from './roles'
import { COURSES } from './qbankTaxonomy'
// ── BMEI04 font support — ported from QuestionBank.jsx ──────────────────────
// Some question_mayek / option_x_mayek text is stored in the BMEI04
// transliteration encoding (plain Latin letters that only resolve to actual
// Meetei Mayek glyphs when rendered with this specific embedded font), not
// real Unicode Meetei Mayek. Rendering that text with the Noto Sans Meetei
// Mayek font (which only maps real Unicode Meetei Mayek codepoints) shows
// the raw Latin transliteration instead of the script. See QuestionBank.jsx's
// own BmeiFontFace/mayekFontFamily for the source of truth this is ported from.
import { BMEI04_BASE64 } from './bmei04_font_base64'

function BmeiFontFace() {
  return (
    <style>{`
      @font-face {
        font-family: 'BMEI04';
        src: url(data:font/ttf;base64,${BMEI04_BASE64}) format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `}</style>
  )
}

// Rows with no question_mayek_font value or 'unicode' keep using Noto Sans
// Meetei Mayek (real Unicode Meetei Mayek text). Rows tagged 'bmei04' (set
// by QuestionBank.jsx's parser when it detects a BMEI04 transliteration on
// Bulk Paste) use the BMEI04 font instead.
function mayekFontFamily(fontTag) {
  return fontTag === 'bmei04' ? "'BMEI04', sans-serif" : "'Noto Sans Meetei Mayek', sans-serif"
}

// ── Display-only metadata (colors, labels, icons). The subject/chapter
// lists themselves come from qbankTaxonomy.js. ──
const COURSE_DISPLAY = {
  sainik:     { label: 'Sainik School',             short: 'AISSEE',    color: '#16a34a', bg: '#dcfce7', text: '#15803d' },
  navodaya:   { label: 'Navodaya Vidyalaya',        short: 'JNVST',     color: '#2563eb', bg: '#dbeafe', text: '#1d4ed8' },
  foundation: { label: 'Foundation Course',         short: 'Class 5–8', color: '#d97706', bg: '#fef9c3', text: '#b45309' },
  rms:        { label: 'Rashtriya Military School', short: 'RMS CET',   color: '#be123c', bg: '#ffe4e6', text: '#9f1239' },
}
const SUBJECT_ICONS = {
  Mathematics: '📐', Intelligence: '🧠', Language: '📖', 'English Language': '📗',
  'General Knowledge': '🌍', 'Social Studies': '🗺️', 'Mental Ability': '🧩',
  'Environmental Studies (EVS)': '🌱', Arithmetic: '🔢', 'Hindi Language': '📕',
  Science: '🔬', English: '📘', 'Social Science': '🗺️', Hindi: '📙',
}

const PAGE_STEP = 50 // questions rendered per "Show more" step
const QUESTION_COLUMNS = 'id, course, subject, chapter, subsection, question, question_mayek, question_mayek_font, option_a, option_a_mayek, option_b, option_b_mayek, option_c, option_c_mayek, option_d, option_d_mayek, correct_option, difficulty, marks, diagram_url, created_at'

const C = {
  navy: '#1e3a5f', slate: '#64748b', border: '#e2e8f0',
  white: '#ffffff', bg: '#f8fafc', green: '#16a34a',
  rose: '#dc2626', amber: '#d97706', indigo: '#4f46e5',
}
const iS = { width: '100%', padding: '8px 11px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, background: C.white, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const cardS = { background: C.white, borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '18px 20px', marginBottom: 14 }
const btnSm = (bg, color = '#fff') => ({ padding: '4px 10px', borderRadius: 6, background: bg, color, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' })

// Subject names a question for (course, subject) may be stored under: the
// exact taxonomy name, plus the old flat bucket name (Mathematics /
// Intelligence / Language / General Knowledge) that questions saved before
// courses existed — and TabSourceCollector today — still use.
function subjectCandidates(subject) {
  return [...new Set([subject, normalizeToQBank(subject)])]
}

// Course taxonomy + custom subjects/chapters added in Study Material's
// course editor (study_course_structure), merged the same way as
// StudyMaterial.jsx's mergedCourses. A custom row whose subject is a Study
// Material name (e.g. Sainik "English Language") is attached to the Question
// Bank subject it maps to (Sainik "Language") when that one exists, so it
// extends the right chapter list instead of creating an empty duplicate.
function mergeTaxonomy(structure) {
  const result = {}
  for (const [courseKey, course] of Object.entries(COURSES)) {
    const subjects = {}
    for (const [s, chapters] of Object.entries(course.subjects)) subjects[s] = [...chapters]
    const target = (s) => (subjects[s] || !subjects[normalizeToQBank(s)]) ? s : normalizeToQBank(s)
    for (const r of structure.filter(r => r.course === courseKey && r.subject)) {
      const s = target(r.subject)
      if (!subjects[s]) subjects[s] = []
      if (r.chapter && !subjects[s].includes(r.chapter)) subjects[s].push(r.chapter)
    }
    result[courseKey] = subjects
  }
  return result
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

function Badge({ text, color, bg, border }) {
  return (
    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      color, background: bg, border: `1px solid ${border || bg}`, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// Print rules, rendered once (they used to be repeated inside every card).
// Printed copies show the correct answer highlighted regardless of the
// on-screen reveal toggle — unless "Print questions only" is used, which
// adds .qbv-hide-answers to the print root for a blank question sheet.
function PrintStyles() {
  return (
    <style>{`
      @media print {
        body * { visibility: hidden; }
        .qbv-print-root, .qbv-print-root * { visibility: visible; }
        .qbv-print-root { position: absolute; left: 0; top: 0; width: 100%; }
        .qbv-no-print { display: none !important; }
        .qbv-print-only { display: block !important; margin-bottom: 14px; }
        .qbv-correct-opt {
          background: #dcfce7 !important;
          border-color: #86efac !important;
          color: #15803d !important;
          font-weight: 700 !important;
        }
        .qbv-answer-mark { display: inline !important; }
        .qbv-hide-answers .qbv-opt {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #374151 !important;
          font-weight: 400 !important;
        }
        .qbv-hide-answers .qbv-answer-mark { display: none !important; }
      }
    `}</style>
  )
}

// Read-only question card — same visual language as QuestionBank.jsx's
// QCard (badges, options grid, reveal-answer toggle) but with no
// selection checkbox and no edit/delete actions.
function ViewOnlyQCard({ q, index, subjectColor }) {
  const [reveal, setReveal] = useState(false)
  return (
    <div style={{ ...cardS, marginBottom: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.slate, fontWeight: 700 }}>Q{index + 1}</span>
        {q.subsection && <Badge text={q.subsection} color="#0369a1" bg="#e0f2fe" />}
        <Badge text={q.difficulty || 'Medium'}
          color={q.difficulty === 'Easy' ? C.green : q.difficulty === 'Hard' ? C.rose : C.amber}
          bg={q.difficulty === 'Easy' ? '#dcfce7' : q.difficulty === 'Hard' ? '#fee2e2' : '#fef9c3'} />
        <Badge text={`${q.marks || 1}M`} color={C.indigo} bg="#eff6ff" />
        {q.diagram_url && <Badge text="🖼 Diagram" color="#065f46" bg="#d1fae5" />}
        {!q.course && (
          <span className="qbv-no-print" title="Saved before course tagging (or by a tool that doesn't set a course) — shown in every course that uses this subject">
            <Badge text="No course tag" color="#92400e" bg="#fef3c7" />
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 500, lineHeight: 1.6, marginBottom: q.question_mayek ? 4 : 8 }}>
        {q.question}
      </div>
      {q.question_mayek && (
        <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 8, fontFamily: mayekFontFamily(q.question_mayek_font) }}>
          {q.question_mayek}
        </div>
      )}
      {q.diagram_url && (
        <img src={q.diagram_url} alt="Question diagram"
          style={{ maxWidth: 280, maxHeight: 180, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, display: 'block' }} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        {['A', 'B', 'C', 'D'].map(l => (
          <div key={l} className={`qbv-opt${q.correct_option === l ? ' qbv-correct-opt' : ''}`}
            style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12,
            background: reveal && q.correct_option === l ? '#dcfce7' : '#f8fafc',
            border: `1px solid ${reveal && q.correct_option === l ? '#86efac' : C.border}`,
            color: reveal && q.correct_option === l ? '#15803d' : '#374151',
            fontWeight: reveal && q.correct_option === l ? 700 : 400 }}>
            <span style={{ fontWeight: 700, marginRight: 5, color: C.slate }}>{l}.</span>
            {q[`option_${l.toLowerCase()}`] || '—'}
            {q.correct_option === l && (
              <span className="qbv-answer-mark" style={{ display: reveal ? 'inline' : 'none' }}> ✓</span>
            )}
            {q[`option_${l.toLowerCase()}_mayek`] && (
              <div style={{ fontFamily: mayekFontFamily(q.question_mayek_font), fontWeight: 400, marginTop: 2 }}>
                {q[`option_${l.toLowerCase()}_mayek`]}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setReveal(r => !r)} className="qbv-no-print" style={btnSm(reveal ? C.slate : subjectColor)}>
        {reveal ? '🙈 Hide Answer' : '👁 Show Answer'}
      </button>
    </div>
  )
}

// Chapter picker row — mirrors StudyMaterial's SubjectPanel chapter list
// visually, but each row shows a live question count for that chapter
// (from the questions already fetched for the whole subject).
function ChapterList({ chapters, activeChapter, onSelect, countsByChapter }) {
  if (chapters.length === 0) {
    return <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>No chapters defined for this subject.</div>
  }
  return (
    <div style={{ ...cardS, padding: 10 }}>
      {chapters.map(ch => {
        const count = countsByChapter?.[ch] || 0
        const active = ch === activeChapter
        return (
          <div key={ch} onClick={() => onSelect(ch)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              background: active ? '#eff6ff' : 'transparent',
              border: `1px solid ${active ? '#bfdbfe' : 'transparent'}`,
              marginBottom: 3,
            }}>
            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.indigo : '#374151' }}>{ch}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              color: count > 0 ? '#4338ca' : '#94a3b8', background: count > 0 ? '#eef2ff' : '#f1f5f9',
            }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function QuestionBankViewer({ currentUser }) {
  // Printing/distributing question papers is an admin-level action here,
  // distinct from just viewing what's in the bank. Uses the shared
  // isAdminRole() (Admin / Administrator / Co-Admin) — an exact
  // role === 'admin' check hid Print from real "Administrator" accounts.
  const isAdmin = isAdminRole(currentUser?.role)

  const [activeCourse, setActiveCourse] = useState('sainik')
  const [activeSubject, setActiveSubject] = useState(null)
  const [activeChapter, setActiveChapter] = useState(null)
  // Questions for `loadedFor` — kept together so data from a previous
  // subject is never mistaken for the current one while a load is running.
  const [loaded, setLoaded] = useState({ subject: null, rows: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [structure, setStructure] = useState([])
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [includeUntagged, setIncludeUntagged] = useState(true)
  // { key, n }: how many cards of view `key` are shown (see viewKey below).
  const [visible, setVisible] = useState({ key: '', n: PAGE_STEP })
  const [printHideAnswers, setPrintHideAnswers] = useState(false)
  const isMobile = useIsMobile()
  const loadSeq = useRef(0)

  // Custom subjects/chapters from Study Material's course editor.
  useEffect(() => {
    let cancelled = false
    supabase.from('study_course_structure').select('course, subject, chapter').then(({ data, error }) => {
      if (cancelled) return
      if (error) console.error('QuestionBankViewer: course structure load failed —', error.message)
      else setStructure(data || [])
    })
    return () => { cancelled = true }
  }, [])

  const taxonomy = useMemo(() => mergeTaxonomy(structure), [structure])
  const courseData = COURSE_DISPLAY[activeCourse]
  const courseSubjects = useMemo(() => taxonomy[activeCourse] || {}, [taxonomy, activeCourse])
  const subjectList = Object.keys(courseSubjects)

  useEffect(() => {
    if (!subjectList.includes(activeSubject)) {
      setActiveSubject(subjectList[0] || null)
      setActiveChapter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse, subjectList.join('|')])

  // Fetches every question for the ACTIVE SUBJECT (not chapter), so chapter
  // switching is instant and chapter counts come from data already in hand.
  // - Paged: a single request is silently capped at 1000 rows.
  // - Sequenced: only the newest request may update state, so switching
  //   subjects quickly can't leave an older subject's questions on screen.
  const loadSubjectQuestions = useCallback(async subject => {
    const seq = ++loadSeq.current
    if (!subject) { setLoaded({ subject: null, rows: [] }); setLoading(false); setLoadError(''); return }
    setLoading(true)
    setLoadError('')
    const { data, error } = await fetchAllPages(() => supabase
      .from('qbank_questions')
      .select(QUESTION_COLUMNS)
      .in('subject', subjectCandidates(subject))
      .order('created_at', { ascending: false })
      .order('id', { ascending: true }))
    if (seq !== loadSeq.current) return
    if (error) {
      console.error('QuestionBankViewer: load failed —', error.message)
      setLoaded({ subject: null, rows: [] })
      setLoadError(error.message || 'Could not load questions')
    } else {
      setLoaded({ subject, rows: data || [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSubjectQuestions(activeSubject) }, [activeSubject, loadSubjectQuestions])

  // Refresh when questions are saved anywhere in the app (debounced — a
  // multi-chapter save emits one event per chapter).
  useEffect(() => {
    let t = null
    const unsub = EventBus.on(GNSI_EVENTS.QUESTION_SAVED, () => {
      clearTimeout(t)
      t = setTimeout(() => loadSubjectQuestions(activeSubject), 400)
    })
    return () => { clearTimeout(t); unsub?.() }
  }, [activeSubject, loadSubjectQuestions])

  // Course scoping: a question tagged with a DIFFERENT course never shows
  // here (previously Sainik "Mathematics" also listed Foundation/RMS
  // Mathematics). Questions with no course tag can't be attributed to a
  // course, so they're shown (with a "No course tag" badge) unless hidden
  // with the toggle — hiding them by default would make them unreachable.
  const loadedCurrent = loaded.subject === activeSubject
  const rawQuestions = useMemo(() => (loadedCurrent ? loaded.rows : []), [loadedCurrent, loaded])
  const untaggedCount = useMemo(() => rawQuestions.filter(q => !q.course).length, [rawQuestions])
  const subjectQuestions = useMemo(
    () => rawQuestions.filter(q => q.course === activeCourse || (!q.course && includeUntagged)),
    [rawQuestions, activeCourse, includeUntagged]
  )

  const knownChapters = useMemo(() => courseSubjects[activeSubject] || [], [courseSubjects, activeSubject])

  const countsByChapter = useMemo(() => {
    const map = {}
    subjectQuestions.forEach(q => {
      // Questions with no chapter tagged at all are real rows too — bucket
      // them under "Uncategorized" instead of dropping them, so the
      // chapter list's total always equals subjectQuestions.length.
      const key = q.chapter || 'Uncategorized'
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [subjectQuestions])

  // Full chapter list = this course's known chapters (in their defined
  // order, incl. custom ones) PLUS any chapter that exists in the data but
  // isn't in that list (e.g. untagged older questions filed under a
  // chapter name from another course), sorted by count, so the visible
  // total always equals subjectQuestions.length exactly.
  const chapters = useMemo(() => {
    const extra = Object.keys(countsByChapter)
      .filter(ch => !knownChapters.includes(ch))
      .sort((a, b) => (countsByChapter[b] || 0) - (countsByChapter[a] || 0))
    return [...knownChapters, ...extra]
  }, [knownChapters, countsByChapter])

  // Auto-select the first chapter that actually has questions when the
  // subject changes and nothing's picked yet. Waits until this subject's
  // questions have loaded: choosing earlier saw every chapter as empty,
  // picked the first one, and then stayed on it after the data arrived.
  useEffect(() => {
    if (!loadedCurrent) return
    if (activeChapter && chapters.includes(activeChapter)) return
    const firstWithQuestions = chapters.find(ch => countsByChapter[ch] > 0)
    setActiveChapter(firstWithQuestions || chapters[0] || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject, chapters, countsByChapter, loadedCurrent])

  const chapterQuestions = useMemo(() => {
    // "Uncategorized" is a synthetic bucket (see countsByChapter) for rows
    // where q.chapter is null/empty — match those, not the literal string.
    let list = activeChapter === 'Uncategorized'
      ? subjectQuestions.filter(q => !q.chapter)
      : subjectQuestions.filter(q => q.chapter === activeChapter)
    if (difficultyFilter !== 'All') list = list.filter(q => q.difficulty === difficultyFilter)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      // Searches the question in both scripts, its options, and subsection.
      const fields = ['question', 'question_mayek', 'subsection',
        'option_a', 'option_b', 'option_c', 'option_d',
        'option_a_mayek', 'option_b_mayek', 'option_c_mayek', 'option_d_mayek']
      list = list.filter(q => fields.some(f => (q[f] || '').toLowerCase().includes(s)))
    }
    return list
  }, [subjectQuestions, activeChapter, difficultyFilter, search])

  // Large chapters render in steps instead of hundreds of cards at once.
  // The step count belongs to one view (course/subject/chapter/filters);
  // any change to the view starts again from the first step.
  const viewKey = [activeCourse, activeSubject, activeChapter, difficultyFilter, search, includeUntagged].join('|')
  const visibleCount = visible.key === viewKey ? visible.n : PAGE_STEP
  const shownQuestions = chapterQuestions.slice(0, visibleCount)

  // Printing always covers the whole filtered chapter, not just the cards
  // revealed so far. flushSync commits the full list (and the answers
  // mode) to the DOM before the browser's print snapshot is taken.
  // Reset on 'afterprint' rather than right after window.print(): on some
  // mobile browsers print() doesn't block, and resetting immediately would
  // change the page before the print snapshot is taken.
  const printChapter = (hideAnswers) => {
    const shownBefore = visibleCount
    flushSync(() => { setPrintHideAnswers(hideAnswers); setVisible({ key: viewKey, n: Infinity }) })
    window.addEventListener('afterprint', () => {
      setPrintHideAnswers(false)
      setVisible({ key: viewKey, n: shownBefore })
    }, { once: true })
    window.print()
  }
  const canPrint = !!activeChapter && chapterQuestions.length > 0

  return (
    <div style={{ fontFamily: 'inherit' }}>
      <BmeiFontFace />
      <PrintStyles />
      {/* Course tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(COURSE_DISPLAY).map(([key, c]) => (
          <button key={key} onClick={() => setActiveCourse(key)}
            style={{
              padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${activeCourse === key ? c.color : C.border}`,
              background: activeCourse === key ? c.bg : C.white, color: activeCourse === key ? c.text : C.slate,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {c.label} <span style={{ opacity: .7, fontWeight: 500 }}>· {c.short}</span>
          </button>
        ))}
      </div>

      {/* Subject tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {subjectList.map(s => {
          const active = s === activeSubject
          return (
            <button key={s} onClick={() => { setActiveSubject(s); setActiveChapter(null) }}
              style={{
                padding: '7px 13px', borderRadius: 8, border: `1px solid ${active ? courseData.color : C.border}`,
                background: active ? courseData.bg : C.white, color: active ? courseData.text : '#374151',
                fontWeight: active ? 700 : 500, fontSize: 12.5, cursor: 'pointer',
              }}>
              {SUBJECT_ICONS[s] || '📁'} {s}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Chapters {loading ? '· loading…' : `· ${subjectQuestions.length} total`}
          </div>
          <ChapterList chapters={chapters} activeChapter={activeChapter} onSelect={setActiveChapter} countsByChapter={countsByChapter} />
        </div>

        <div>
          <div style={{ ...cardS, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }} className="qbv-no-print">
            <input style={{ ...iS, flex: 1, minWidth: 180 }} placeholder="Search questions, options, Mayek text…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...iS, width: 'auto' }} value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
              <option value="All">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            {isAdmin ? (
              <>
                {[
                  { hide: false, label: '🖨️ Print with Answers', title: "Print this chapter's questions with answers marked" },
                  { hide: true,  label: '🖨️ Print Questions Only', title: 'Print a blank question sheet (no answers marked)' },
                ].map(({ hide, label, title }) => (
                  <button key={label}
                    onClick={() => printChapter(hide)}
                    disabled={!canPrint}
                    title={!activeChapter ? 'Select a chapter first' : title}
                    style={{
                      padding: '8px 14px', borderRadius: 7, border: 'none', fontSize: 12.5, fontWeight: 700,
                      cursor: canPrint ? 'pointer' : 'default',
                      color: canPrint ? '#fff' : '#94a3b8',
                      background: canPrint ? courseData.color : '#f1f5f9',
                    }}>
                    {label}
                  </button>
                ))}
              </>
            ) : (
              <span
                title="Question Bank is preview-only for your account — printing is available to admin accounts"
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                👁 Preview only
              </span>
            )}
            {untaggedCount > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.slate, cursor: 'pointer', width: '100%' }}>
                <input type="checkbox" checked={includeUntagged} onChange={e => setIncludeUntagged(e.target.checked)} />
                Include {untaggedCount} question{untaggedCount !== 1 ? 's' : ''} with no course tag
              </label>
            )}
          </div>

          <div className={`qbv-print-root${printHideAnswers ? ' qbv-hide-answers' : ''}`}>

          {loadError ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: C.rose }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn't load questions for {activeSubject}.</div>
              <div style={{ fontSize: 12, color: C.slate, marginBottom: 12 }}>{loadError}</div>
              <button onClick={() => loadSubjectQuestions(activeSubject)} style={btnSm(C.navy)}>↻ Retry</button>
            </div>
          ) : !activeChapter ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>Select a chapter to view its questions.</div>
          ) : loading ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</div>
          ) : chapterQuestions.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 32, color: '#94a3b8' }}>
              {search.trim() || difficultyFilter !== 'All' ? 'No questions match this filter.' : 'No questions in the bank for this chapter yet.'}
            </div>
          ) : (
            <>
              {/* Print-only heading — the on-screen title line below is
                  hidden via qbv-no-print when printing. */}
              <div className="qbv-print-only" style={{ display: 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{courseData.label} — {activeSubject}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{activeChapter} · {chapterQuestions.length} question{chapterQuestions.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="qbv-no-print" style={{ fontSize: 12, color: C.slate, marginBottom: 8, fontWeight: 600 }}>
                {chapterQuestions.length} question{chapterQuestions.length !== 1 ? 's' : ''} — {activeSubject} › {activeChapter}
              </div>
              {shownQuestions.map((q, i) => (
                <ViewOnlyQCard key={q.id} q={q} index={i} subjectColor={courseData.color} />
              ))}
              {shownQuestions.length < chapterQuestions.length && (
                <div className="qbv-no-print" style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                  <button onClick={() => setVisible({ key: viewKey, n: visibleCount + PAGE_STEP })} style={{ ...btnSm(courseData.color), padding: '8px 16px', fontSize: 12.5 }}>
                    Show {Math.min(PAGE_STEP, chapterQuestions.length - shownQuestions.length)} more
                    <span style={{ opacity: .8, fontWeight: 500 }}> ({shownQuestions.length} of {chapterQuestions.length})</span>
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

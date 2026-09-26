// ChapterHub.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// Teaching → Chapter Hub. One place to see everything the portal knows about a
// chapter, and jump to where each piece is managed:
//
//   syllabus_topics   (Syllabus Manager catalogue: subtopics)
//   study_materials   (Study Materials: notes, practice sets, …)
//   qbank_questions   (Question Bank)
//   teaching_logs     (Teaching → Daily Logs: when/by whom it was taught)
//   study_lockers     (Study Lockers holding this chapter's materials)
//
// Names follow qbankTaxonomy.js (the shared course → subject → chapter list).
// Each module stores subjects a little differently, so lookups go through
// small mapping helpers below. Links use StudyMaterialBridge.openChapterIn,
// which opens the target module on the same chapter.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { COURSES, COURSE_LIST } from './qbankTaxonomy'
import { SUBJECT_TO_QBANK, normalizeToQBank, fetchAllPages, openChapterIn } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { PIcon, PX } from './premiumUI'

// ── Name mapping ─────────────────────────────────────────────────────────────

// Every stored subject name that means the same subject as `subject`
// (e.g. Language ⇄ English Language). Only used together with an exact
// course + chapter match, so the broad bucket can't pull in other chapters.
function subjectVariants(subject) {
  const bucket = normalizeToQBank(subject)
  const same = Object.keys(SUBJECT_TO_QBANK).filter(k => SUBJECT_TO_QBANK[k] === bucket)
  return [...new Set([subject, bucket, ...same])]
}

// teaching_logs.subject_name uses Teaching's own list (Teaching.jsx SUBJECTS).
const TEACHING_SUBJECT_BUCKET = {
  'Mathematics': 'Mathematics', 'Mathematics I': 'Mathematics', 'Mathematics II': 'Mathematics',
  'Reasoning': 'Intelligence', 'Mental Ability': 'Intelligence',
  'English Grammar': 'Language', 'Vocabulary': 'Language', 'Hindi': 'Language', 'Meitei Mayek': 'Language',
  'General Knowledge': 'General Knowledge', 'General Science': 'General Knowledge',
  'Environmental Studies I': 'General Knowledge', 'Environmental Studies II': 'General Knowledge',
}
const teachingBucket = s => TEACHING_SUBJECT_BUCKET[s] || normalizeToQBank(s)

// teaching_logs has no chapter column — match the chapter by the topic text.
const STOP = new Set(['and','the','of','for','with','in','on','to','a','an','its','their','types','type'])
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function topicMatchesChapter(topic, chapter) {
  const t = ` ${norm(topic)} `, c = norm(chapter)
  if (!c || !t.trim()) return false
  if (t.includes(` ${c} `)) return true
  const words = c.split(' ').filter(w => w.length >= 3 && !STOP.has(w))   // keeps LCM / HCF / GK
  if (!words.length) return false
  const hits = words.filter(w => t.includes(` ${w}`)).length   // prefix match: "fraction" ~ "fractions"
  return hits === words.length || (words.length >= 3 && hits >= words.length - 1)
}

const courseKey = c => String(c || '').trim().toLowerCase()
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'

const TYPE_ICON = { notes: '📄', formula: '🔣', practice: '✏️', solved: '✅', mindmap: '🗂️', video: '🎥', currentaffairs: '📰' }

// ── Small UI pieces ──────────────────────────────────────────────────────────

const card = { background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 12px 32px -22px rgba(19,42,79,.35)' }
const ghost = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: PX.ink2, border: `1px solid ${PX.line2}`, borderRadius: 9, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12, minHeight: 34, whiteSpace: 'nowrap', fontFamily: 'inherit' }
const select = { padding: '10px 13px', borderRadius: 11, border: `1px solid ${PX.line}`, fontSize: 13.5, background: '#fff', color: PX.ink, minHeight: 42, fontFamily: 'inherit', width: '100%' }

function Section({ icon, title, count, action, children, empty }) {
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: PX.goldBg, color: PX.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0, fontFamily: PX.serif, fontSize: 15.5, fontWeight: 600, color: PX.ink }}>
          {title}{count !== undefined && <span style={{ fontFamily: PX.sans, fontSize: 12, fontWeight: 700, color: PX.sub, marginLeft: 8 }}>{count}</span>}
        </div>
        {action}
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        {empty ? <div style={{ fontSize: 12.5, color: PX.faint, padding: '6px 0' }}>{empty}</div> : children}
      </div>
    </div>
  )
}

function Cell({ n, tone, title }) {
  const on = n > 0
  return (
    <span title={title} style={{ display: 'inline-flex', minWidth: 30, justifyContent: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
      fontVariantNumeric: 'tabular-nums', color: on ? tone : PX.faint, background: on ? `${tone}14` : PX.tint, border: `1px solid ${on ? `${tone}33` : PX.line}` }}>
      {on ? n : '—'}
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ChapterHub({ focus, onNavigate, canSeeQuestions, isMobile }) {
  const [course, setCourse] = useState('sainik')
  const [subject, setSubject] = useState(Object.keys(COURSES.sainik.subjects)[0])
  const [chapter, setChapter] = useState(null)
  const [seenFocus, setSeenFocus] = useState(null)

  // Apply a chapter focus handed over by Teaching (from another module's
  // "🎯 Hub" link). Render-time adjustment, so there's no extra effect pass.
  if (focus && focus !== seenFocus) {
    setSeenFocus(focus)
    if (COURSES[focus.course]) setCourse(focus.course)
    if (focus.subject) setSubject(focus.subject)
    setChapter(focus.chapter || null)
  }

  const [materials, setMaterials] = useState([])
  const [questions, setQuestions] = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [logs, setLogs] = useState([])
  const [lockers, setLockers] = useState([])
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Which request the data on screen belongs to; loading = it isn't the current one.
  const dataKey = `${course}|${subject}|${canSeeQuestions ? 1 : 0}|${reloadKey}`
  const [loadedKey, setLoadedKey] = useState(null)
  const loading = loadedKey !== dataKey

  // Subject list for the course; a focused custom subject is kept selectable.
  const subjectList = useMemo(() => {
    const base = Object.keys(COURSES[course]?.subjects || {})
    return subject && !base.includes(subject) ? [...base, subject] : base
  }, [course, subject])

  // Course- and subject-wide data (drives the coverage grid and the panel).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const since = new Date(); since.setFullYear(since.getFullYear() - 1)
      const variants = subjectVariants(subject)
      const [mat, qs, cat, lg, lk] = await Promise.all([
        supabase.from('study_materials').select('id,title,material_type,file_url,chapter,subject,course,locker_id,created_at')
          .eq('course', course).in('subject', variants).order('created_at', { ascending: false }),
        canSeeQuestions
          ? fetchAllPages(() => supabase.from('qbank_questions').select('id,course,chapter,difficulty,correct_option,diagram_url')
              .in('subject', [...new Set([subject, normalizeToQBank(subject)])]).order('id', { ascending: true }))
          : Promise.resolve({ data: [] }),
        supabase.from('syllabus_topics').select('id,course,subject_name,chapter_name,subtopics,display_order,syllabus_id'),
        fetchAllPages(() => supabase.from('teaching_logs').select('id,teaching_date,topic_taught,teacher_name,subject_name,course,class_name')
          .gte('teaching_date', since.toISOString().slice(0, 10)).order('id', { ascending: true })),
        supabase.from('study_lockers').select('id,teacher_name,subject,course,icon,color'),
      ])
      if (cancelled) return
      const firstError = [mat, qs, cat, lg, lk].find(r => r?.error)?.error
      setError(firstError ? (firstError.message || 'Some data could not be loaded') : '')
      setMaterials(mat.data || [])
      // Questions for this course, plus untagged ones (no course yet).
      setQuestions((qs.data || []).filter(q => !q.course || q.course === course))
      setCatalogue((cat.data || []).filter(r => !r.syllabus_id && courseKey(r.course) === course && subjectVariants(subject).includes(r.subject_name)))
      const bucket = normalizeToQBank(subject)
      setLogs((lg.data || []).filter(l => teachingBucket(l.subject_name) === bucket && (!l.course || courseKey(l.course) === course)))
      setLockers(lk.data || [])
      setLoadedKey(dataKey)
    })()
    return () => { cancelled = true }
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when materials or questions are saved elsewhere.
  useEffect(() => {
    const bump = () => setReloadKey(k => k + 1)
    const offs = [GNSI_EVENTS.MATERIAL_SAVED, GNSI_EVENTS.QUESTION_SAVED, GNSI_EVENTS.TEACHING_LOG_SAVED].map(e => EventBus.on(e, bump))
    return () => offs.forEach(off => off())
  }, [])

  // Chapter list = shared list + any chapter found in the data or focused.
  const chapters = useMemo(() => {
    const base = COURSES[course]?.subjects?.[subject] || []
    const extra = new Set()
    materials.forEach(m => m.chapter && extra.add(m.chapter))
    catalogue.forEach(r => r.chapter_name && extra.add(r.chapter_name))
    questions.forEach(q => q.chapter && extra.add(q.chapter))
    if (chapter) extra.add(chapter)
    const seen = new Set(base.map(c => c.toLowerCase()))
    return [...base, ...[...extra].filter(c => !seen.has(c.toLowerCase())).sort()]
  }, [course, subject, materials, catalogue, questions, chapter])

  // Per-chapter coverage for the grid.
  const coverage = useMemo(() => {
    const byChapter = {}
    const get = ch => (byChapter[ch] ||= { materials: 0, questions: 0, taught: 0, lastTaught: null, subtopics: null })
    chapters.forEach(get)
    materials.forEach(m => { if (m.chapter && byChapter[m.chapter]) byChapter[m.chapter].materials++ })
    questions.forEach(q => { if (q.chapter && byChapter[q.chapter]) byChapter[q.chapter].questions++ })
    catalogue.forEach(r => { const c = byChapter[r.chapter_name]; if (c) c.subtopics = (r.subtopics || []).length })
    logs.forEach(l => {
      chapters.forEach(ch => {
        if (!topicMatchesChapter(l.topic_taught, ch)) return
        const c = byChapter[ch]; c.taught++
        if (!c.lastTaught || l.teaching_date > c.lastTaught) c.lastTaught = l.teaching_date
      })
    })
    return byChapter
  }, [chapters, materials, questions, catalogue, logs])

  const totals = useMemo(() => {
    const rows = Object.values(coverage)
    return {
      chapters: rows.length,
      withMaterials: rows.filter(r => r.materials > 0).length,
      withQuestions: rows.filter(r => r.questions > 0).length,
      taught: rows.filter(r => r.taught > 0).length,
      inSyllabus: rows.filter(r => r.subtopics !== null).length,
    }
  }, [coverage])

  const go = useCallback(target => openChapterIn(target, { course, subject, chapter }, onNavigate), [course, subject, chapter, onNavigate])

  // Selected-chapter details
  const chMaterials = chapter ? materials.filter(m => m.chapter === chapter) : []
  const chQuestions = chapter ? questions.filter(q => q.chapter === chapter) : []
  const chCatalogue = chapter ? catalogue.find(r => r.chapter_name === chapter) : null
  const chLogs = chapter ? logs.filter(l => topicMatchesChapter(l.topic_taught, chapter)).sort((a, b) => (b.teaching_date || '').localeCompare(a.teaching_date || '')) : []
  const chLockerIds = new Set(chMaterials.map(m => m.locker_id).filter(Boolean))
  const chLockers = lockers.filter(l => chLockerIds.has(l.id))
  const diff = d => chQuestions.filter(q => (q.difficulty || 'Medium') === d).length

  return (
    <div>
      {/* ── Picker ── */}
      <div style={{ ...card, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1.4fr', gap: 10 }}>
        <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>
          Course
          <select style={{ ...select, marginTop: 6 }} value={course}
            onChange={e => { const c = e.target.value; setCourse(c); setSubject(Object.keys(COURSES[c].subjects)[0]); setChapter(null) }}>
            {COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>
          Subject
          <select style={{ ...select, marginTop: 6 }} value={subject} onChange={e => { setSubject(e.target.value); setChapter(null) }}>
            {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>
          Chapter
          <select style={{ ...select, marginTop: 6 }} value={chapter || ''} onChange={e => setChapter(e.target.value || null)}>
            <option value="">— Subject overview —</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 12, background: PX.badBg, color: PX.bad, fontSize: 13, fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>Some data couldn't be loaded: {error}</span>
          <button style={ghost} onClick={() => setReloadKey(k => k + 1)}>↻ Retry</button>
        </div>
      )}

      {/* ── Subject coverage summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : `repeat(${canSeeQuestions ? 4 : 3},1fr)`, gap: 10, marginBottom: 14 }}>
        {[
          { l: 'In syllabus', v: totals.inSyllabus, tone: PX.gold, hint: 'Chapters with a Syllabus Manager entry' },
          { l: 'With materials', v: totals.withMaterials, tone: '#0f7a4c' },
          ...(canSeeQuestions ? [{ l: 'With questions', v: totals.withQuestions, tone: PX.navy2 }] : []),
          { l: 'Taught (12 mo)', v: totals.taught, tone: '#9a5b00', hint: 'Chapters matched in Daily Logs topics over the last year' },
        ].map(s => (
          <div key={s.l} title={s.hint} style={{ ...card, padding: '12px 14px', borderTop: `3px solid ${s.tone}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub }}>{s.l}</div>
            <div style={{ fontFamily: PX.serif, fontSize: 24, fontWeight: 600, color: PX.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {loading ? '—' : <>{s.v}<span style={{ fontSize: 14, color: PX.faint }}> / {totals.chapters}</span></>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile || !chapter ? '1fr' : 'minmax(0,1.05fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        {/* ── Coverage grid ── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontFamily: PX.serif, fontSize: 15.5, fontWeight: 600, color: PX.ink }}>{subject} · chapters</div>
            <span style={{ fontSize: 11.5, color: PX.sub }}>Click a chapter for details</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: isMobile ? 'none' : 560, overflowY: 'auto' }}>
            <table className="px-table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th style={{ textAlign: 'center' }}>Syllabus</th>
                  <th style={{ textAlign: 'center' }}>Materials</th>
                  {canSeeQuestions && <th style={{ textAlign: 'center' }}>Questions</th>}
                  <th style={{ textAlign: 'center' }}>Taught</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map(ch => {
                  const c = coverage[ch] || {}
                  const active = ch === chapter
                  return (
                    <tr key={ch} onClick={() => setChapter(active ? null : ch)} style={{ cursor: 'pointer' }} aria-selected={active}>
                      <td style={{ fontWeight: active ? 700 : 500, color: active ? PX.navy : PX.ink2, background: active ? PX.goldBg : undefined, borderLeft: active ? `3px solid ${PX.gold}` : '3px solid transparent' }}>{ch}</td>
                      <td style={{ textAlign: 'center', background: active ? PX.goldBg : undefined }}><Cell n={c.subtopics ?? 0} tone={PX.gold} title={c.subtopics === null ? 'Not in Syllabus Manager' : `${c.subtopics} subtopics`} /></td>
                      <td style={{ textAlign: 'center', background: active ? PX.goldBg : undefined }}><Cell n={c.materials || 0} tone="#0f7a4c" /></td>
                      {canSeeQuestions && <td style={{ textAlign: 'center', background: active ? PX.goldBg : undefined }}><Cell n={c.questions || 0} tone={PX.navy2} /></td>}
                      <td style={{ textAlign: 'center', background: active ? PX.goldBg : undefined }}><Cell n={c.taught || 0} tone="#9a5b00" title={c.lastTaught ? `Last taught ${fmtDate(c.lastTaught)}` : 'No matching Daily Log'} /></td>
                    </tr>
                  )
                })}
                {!loading && chapters.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: PX.faint, padding: 24 }}>No chapters for this subject yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Chapter details ── */}
        {chapter && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: PX.gold }}>{COURSES[course]?.label} · {subject}</div>
              <div style={{ fontFamily: PX.serif, fontSize: 22, fontWeight: 600, color: PX.ink, marginTop: 4, lineHeight: 1.2 }}>{chapter}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button style={ghost} onClick={() => go('studymaterial')}><PIcon.folder size={14} /> Study Materials</button>
                {canSeeQuestions && <button style={ghost} onClick={() => go('questionbank')}><PIcon.list size={14} /> Question Bank</button>}
                <button style={ghost} onClick={() => go('studylockers')}><PIcon.shield size={14} /> Lockers</button>
                <button style={ghost} onClick={() => go('syllabusmgr')}><PIcon.layers size={14} /> Syllabus</button>
                <button style={{ ...ghost, background: `linear-gradient(180deg,${PX.navy2},${PX.navy})`, color: '#fff', border: 'none' }} onClick={() => go('logs')}><PIcon.plus size={14} /> Log a class</button>
              </div>
            </div>

            <Section icon={<PIcon.layers size={16} />} title="Syllabus" count={chCatalogue ? `${(chCatalogue.subtopics || []).length} subtopics` : undefined}
              action={<button style={ghost} onClick={() => go('syllabusmgr')}>{chCatalogue ? 'Edit' : 'Add to syllabus'}</button>}
              empty={!chCatalogue ? 'Not in the Syllabus Manager catalogue yet.' : !(chCatalogue.subtopics || []).length ? 'No subtopics listed yet.' : null}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(chCatalogue?.subtopics || []).map((s, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, background: PX.tint, border: `1px solid ${PX.line}`, color: PX.ink2 }}>{i + 1}. {s}</span>
                ))}
              </div>
            </Section>

            <Section icon={<PIcon.folder size={16} />} title="Study materials" count={chMaterials.length}
              action={<button style={ghost} onClick={() => go('studymaterial')}>{chMaterials.length ? 'Open' : 'Add material'}</button>}
              empty={chMaterials.length ? null : 'No materials for this chapter yet.'}>
              <div style={{ display: 'grid', gap: 6 }}>
                {chMaterials.slice(0, 8).map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span>{TYPE_ICON[m.material_type] || '📄'}</span>
                    <span style={{ flex: 1, minWidth: 0, color: PX.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                    {m.locker_id && <span title="Inside a study locker" style={{ fontSize: 11, color: PX.sub }}>🔒</span>}
                    {m.file_url && <a href={m.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: PX.navy2 }}>Open ↗</a>}
                  </div>
                ))}
                {chMaterials.length > 8 && <div style={{ fontSize: 12, color: PX.sub }}>+{chMaterials.length - 8} more in Study Materials</div>}
              </div>
            </Section>

            {canSeeQuestions && (
              <Section icon={<PIcon.list size={16} />} title="Questions" count={chQuestions.length}
                action={<button style={ghost} onClick={() => go('questionbank')}>{chQuestions.length ? 'Open' : 'Add questions'}</button>}
                empty={chQuestions.length ? null : 'No questions for this chapter yet.'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
                  {[['Easy', '#0f7a4c'], ['Medium', '#9a5b00'], ['Hard', PX.bad]].map(([d, c]) => (
                    <div key={d} style={{ padding: '8px 10px', borderRadius: 10, background: PX.tint, border: `1px solid ${PX.line}` }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '.08em' }}>{d}</div>
                      <div style={{ fontFamily: PX.serif, fontSize: 20, fontWeight: 600, color: PX.ink }}>{diff(d)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: PX.sub }}>
                  {chQuestions.filter(q => !q.correct_option).length > 0 && <>⚠ {chQuestions.filter(q => !q.correct_option).length} without an answer · </>}
                  {chQuestions.filter(q => q.diagram_url).length} with diagrams
                </div>
              </Section>
            )}

            <Section icon={<PIcon.calendar size={16} />} title="Teaching log" count={chLogs.length ? `${chLogs.length} in the last year` : undefined}
              action={<button style={ghost} onClick={() => go('logs')}>Log a class</button>}
              empty={chLogs.length ? null : 'No Daily Log topic matches this chapter in the last year.'}>
              <div style={{ display: 'grid', gap: 6 }}>
                {chLogs.slice(0, 6).map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, alignItems: 'baseline' }}>
                    <span style={{ minWidth: 52, fontWeight: 700, color: PX.navy, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(l.teaching_date)}</span>
                    <span style={{ flex: 1, minWidth: 0, color: PX.ink2 }}>{l.topic_taught}</span>
                    <span style={{ color: PX.sub, whiteSpace: 'nowrap' }}>{l.teacher_name}{l.class_name ? ` · ${l.class_name}` : ''}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={<PIcon.shield size={16} />} title="In study lockers" count={chLockers.length}
              action={<button style={ghost} onClick={() => go('studylockers')}>Open lockers</button>}
              empty={chLockers.length ? null : 'No locker holds materials for this chapter.'}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chLockers.map(l => (
                  <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
                    background: `${l.color || PX.navy}12`, border: `1px solid ${l.color || PX.navy}33`, color: PX.ink2 }}>
                    {l.icon || '🔒'} {l.teacher_name} <span style={{ color: PX.sub, fontWeight: 500 }}>· {l.subject}</span>
                  </span>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

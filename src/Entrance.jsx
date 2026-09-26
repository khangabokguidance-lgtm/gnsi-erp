// Entrance.jsx — GNSI Portal · Entrance Examination board
//
// Runs an entrance test the way an exam board does, one exam at a time:
//   1 Exam set-up (pattern, schedule, application window, seats & quotas)
//   2 Applications (registration, verification, fees, photo)
//   3 Question paper generated from the Question Bank, with shuffled sets
//   4 Seating, hall tickets (photo + QR), attendance & OMR sheets
//   5 Exam day attendance (QR / roll scan)
//   6 OMR evaluation against the answer key (sets, negative marks, bonus Qs)
//   7 Results: ranks, category ranks, qualification, scorecards, merit list
//   8 Admission: category-wise seat allocation, waitlist, offer letters
// The mechanics live in entranceCore.js, printable documents in
// entrancePrint.js; the per-stage tabs are split across EntranceConduct.jsx
// and EntranceResults.jsx.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { PX, PremiumStyles, PremiumHero, PremiumTabs, PremiumCard, PIcon } from './premiumUI'
import { COURSES } from './qbankTaxonomy'
import { fetchAllPages } from './StudyMaterialBridge'
import {
  EXAM_TYPES, EXAM_TYPE_COURSE, EXAM_STATUS, CLASSES, CATEGORIES, RESERVED, GENDERS, FEE_STATUS, GOVT_QUOTAS,
  PATTERN_PRESETS, DEFAULT_RULES, patternTotals, examSections, parseJson, fmtDate, hallTicketNo, nextRoll,
  applicationNo, nextApplicationSeq, resultByCandidate, ageOn, parseCSV, toCSV, downloadText, safeWrite,
  missingColumns, onMissingColumns, probeSchema, audit, eligibility, inChunks, PHOTO_BUCKET,
} from './entranceCore'
import {
  EntranceStyles, Chip, StatusChip, Field, Kpi, Empty, Modal, Confirm, Toast, Progress, NeedExam,
} from './entranceUI'
import { useIsMobile } from './entranceHooks'
import { PaperTab, HallTicketsTab, ExamDayTab } from './EntranceConduct'
import { EvaluationTab, ResultsTab, AdmissionTab } from './EntranceResults'

const TABS = [
  { id: 'overview', label: 'Overview', icon: PIcon.chart },
  { id: 'exams', label: 'Exams', icon: PIcon.calendar },
  { id: 'applications', label: 'Applications', icon: PIcon.users },
  { id: 'paper', label: 'Question Paper', icon: PIcon.file },
  { id: 'halltickets', label: 'Hall Tickets', icon: PIcon.shield },
  { id: 'examday', label: 'Exam Day', icon: PIcon.clock },
  { id: 'evaluation', label: 'Evaluation', icon: PIcon.pen },
  { id: 'results', label: 'Results', icon: PIcon.report },
  { id: 'admission', label: 'Admission', icon: PIcon.cap },
  { id: 'activity', label: 'Activity', icon: PIcon.list },
]

const EXAM_KEY = 'gnsi_entrance_exam'
const readSaved = () => { try { return localStorage.getItem(EXAM_KEY) || '' } catch { return '' } }
const today = () => new Date().toISOString().slice(0, 10)

// Candidates and results can pass PostgREST's 1000-row cap, so page them.
const fetchEntrance = () => Promise.all([
  supabase.from('entrance_exams').select('*').order('exam_date', { ascending: false }),
  fetchAllPages(() => supabase.from('entrance_candidates').select('*').order('id', { ascending: true })),
  fetchAllPages(() => supabase.from('entrance_results').select('*').order('id', { ascending: true })),
])

// Default exam: the nearest one not yet finished, else the latest.
function defaultExam(exams) {
  const t = today()
  const live = exams.filter(e => e.status === 'Ongoing')
  if (live.length) return live[0]
  const upcoming = exams.filter(e => e.status === 'Scheduled' && (e.exam_date || '') >= t).sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || ''))
  return upcoming[0] || exams[0] || null
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Entrance({ currentUser, perms }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('overview')
  const [exams, setExams] = useState([])
  const [cands, setCands] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [examId, setExamId] = useState(readSaved)
  const [missing, setMissing] = useState(() => [...missingColumns])
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [newExam, setNewExam] = useState(0)

  const can = useMemo(() => ({
    add: perms ? !!perms.add : true, edit: perms ? !!perms.edit : true, delete: perms ? !!perms.delete : true,
  }), [perms])
  const user = currentUser?.name || currentUser?.username || currentUser?.role || 'staff'

  const notify = useCallback((msg, tone = 'navy') => {
    setToast({ msg, tone, at: Date.now() })
    setTimeout(() => setToast(t => (t && Date.now() - t.at >= 3400 ? null : t)), 3500)
  }, [])

  const apply = useCallback(([ex, cd, rs]) => {
    const err = ex.error || cd.error || rs.error
    setLoadError(err ? err.message : '')
    if (!ex.error) setExams(ex.data || [])
    if (!cd.error) setCands(cd.data || [])
    if (!rs.error) setResults(rs.data || [])
    setLoading(false)
  }, [])
  const reload = useCallback(() => fetchEntrance().then(apply), [apply])

  useEffect(() => {
    let live = true
    fetchEntrance().then(r => { if (live) apply(r) })
    return () => { live = false }
  }, [apply])
  useEffect(() => {
    const off = onMissingColumns(set => setMissing([...set]))
    probeSchema()
    return off
  }, [])

  const exam = exams.find(e => e.id === examId) || defaultExam(exams)
  const selectExam = id => { setExamId(id); try { localStorage.setItem(EXAM_KEY, id) } catch { /* private mode */ } }

  const examCands = useMemo(() => (exam ? cands.filter(c => c.exam_id === exam.id).sort((a, b) => (Number(a.roll_number) || 0) - (Number(b.roll_number) || 0)) : []), [cands, exam])
  const resMap = useMemo(() => resultByCandidate(results), [results])
  const sections = useMemo(() => examSections(exam), [exam])

  const ctx = { exam, exams, cands: examCands, allCands: cands, results, resMap, sections, reload, notify, can, user, setConfirm, go: setTab, isMobile, selectExam }

  // Hero numbers for the selected exam.
  const stats = useMemo(() => {
    if (!exam) return []
    const n = examCands.length
    const verified = examCands.filter(c => c.verified).length
    const issued = examCands.filter(c => ['Hall Ticket Issued', 'Appeared', 'Absent'].includes(c.status)).length
    const appeared = examCands.filter(c => c.status === 'Appeared').length
    const evaluated = examCands.filter(c => resMap[c.id] && resMap[c.id].total_marks != null).length
    const admitted = examCands.filter(c => resMap[c.id]?.result_status === 'Admitted').length
    return [
      { label: 'Applications', value: n, sub: `${verified} verified`, onClick: () => setTab('applications'), active: tab === 'applications' },
      { label: 'Hall tickets', value: issued, sub: `of ${n}`, onClick: () => setTab('halltickets'), active: tab === 'halltickets' },
      { label: 'Appeared', value: appeared, sub: issued ? `${Math.round((appeared / issued) * 100)}% turnout` : '—', onClick: () => setTab('examday'), active: tab === 'examday' },
      { label: 'Evaluated', value: evaluated, sub: `of ${appeared}`, onClick: () => setTab('evaluation'), active: tab === 'evaluation' },
      { label: 'Admitted', value: admitted, sub: exam.total_seats ? `of ${exam.total_seats} seats` : 'seats not set', tone: PX.goldLt, onClick: () => setTab('admission'), active: tab === 'admission' },
    ]
  }, [exam, examCands, resMap, tab])

  const daysLeft = exam?.exam_date ? Math.ceil((new Date(exam.exam_date + 'T00:00') - new Date(today() + 'T00:00')) / 86400000) : null

  return (
    <div className="px-root">
      <PremiumStyles />
      <EntranceStyles />
      <div className="px-wrap">
        <PremiumHero
          isMobile={isMobile}
          eyebrow="Admissions · Examination board"
          title="Entrance Examination"
          subtitle={exam
            ? `${exam.exam_name} · ${fmtDate(exam.exam_date)}${daysLeft != null ? (daysLeft > 0 ? ` · ${daysLeft} days to go` : daysLeft === 0 ? ' · today' : '') : ''}`
            : 'Sainik, Navodaya, RMS & Foundation entrance tests — from application to admission'}
          icon={<PIcon.cap size={26} />}
          actions={<>
            {exams.length > 0 && (
              <select className="ex-hero-select" aria-label="Select exam" value={exam?.id || ''} onChange={e => selectExam(e.target.value)}>
                {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name} · {fmtDate(e.exam_date)}</option>)}
              </select>
            )}
            {can.add && <button className="px-hbtn gold" onClick={() => { setTab('exams'); setNewExam(n => n + 1) }}><PIcon.plus size={15} />New exam</button>}
            <button className="px-hbtn" onClick={() => { setLoading(true); reload() }} title="Refresh">↻</button>
          </>}
          stats={stats}
        />

        {missing.length > 0 && (
          <div style={{ background: PX.warnBg, border: `1px solid #f1d9a6`, color: PX.warn, borderRadius: 14, padding: '12px 16px', marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
            <b>Database upgrade needed.</b> Run <span className="ex-mono">supabase/migrations/20260926_entrance_exam_board.sql</span> in the Supabase SQL editor.
            Until then these fields can't be saved: <span className="ex-mono" style={{ fontSize: 11.5 }}>{missing.map(m => m.split('.')[1]).join(', ')}</span>.
          </div>
        )}
        {loadError && <div style={{ background: PX.badBg, color: PX.bad, borderRadius: 14, padding: '12px 16px', marginBottom: 14, fontSize: 13 }}>Could not load entrance data: {loadError}</div>}

        <PremiumTabs tabs={TABS} active={tab} onChange={setTab} />

        {loading ? (
          <div className="px-card"><Empty icon="⏳" title="Loading entrance data…" /></div>
        ) : (
          <>
            {tab === 'overview' && <Overview {...ctx} />}
            {tab === 'exams' && <ExamsTab {...ctx} newExam={newExam} />}
            {tab === 'applications' && <NeedExam exam={exam}><ApplicationsTab {...ctx} /></NeedExam>}
            {tab === 'paper' && <NeedExam exam={exam}><PaperTab {...ctx} /></NeedExam>}
            {tab === 'halltickets' && <NeedExam exam={exam}><HallTicketsTab {...ctx} /></NeedExam>}
            {tab === 'examday' && <NeedExam exam={exam}><ExamDayTab {...ctx} /></NeedExam>}
            {tab === 'evaluation' && <NeedExam exam={exam}><EvaluationTab {...ctx} /></NeedExam>}
            {tab === 'results' && <NeedExam exam={exam}><ResultsTab {...ctx} /></NeedExam>}
            {tab === 'admission' && <NeedExam exam={exam}><AdmissionTab {...ctx} /></NeedExam>}
            {tab === 'activity' && <ActivityTab />}
          </>
        )}
      </div>
      {confirm && <Confirm {...confirm} onCancel={() => setConfirm(null)} onConfirm={async () => { const c = confirm; setConfirm(null); await c.onConfirm() }} />}
      <Toast toast={toast} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Overview — the exam's pipeline, stage by stage
// ═══════════════════════════════════════════════════════════════════════════
function Overview({ exam, exams, allCands, cands, resMap, go, selectExam }) {
  if (!exams.length) {
    return (
      <PremiumCard title="Set up your first entrance exam" subtitle="Start from an official pattern — every number stays editable">
        <div className="ex-grid ex-g2">
          {PATTERN_PRESETS.map(p => {
            const t = patternTotals(p.sections)
            return (
              <button key={p.id} className="ex-step" onClick={() => go('exams')}>
                <div className="ex-dot" style={{ background: PX.goldBg, color: '#8a6118' }}>✦</div>
                <div><div style={{ fontWeight: 700, color: PX.ink }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: PX.sub, marginTop: 3 }}>{p.sections.map(s => s.name).join(' · ')}</div>
                  <div style={{ fontSize: 12, color: PX.faint, marginTop: 3 }}>{t.questions} questions · {t.marks} marks · {p.duration_mins} min</div></div>
              </button>
            )
          })}
        </div>
      </PremiumCard>
    )
  }
  if (!exam) return null

  const n = cands.length
  const fee = Number(exam.application_fee) > 0
  const verified = cands.filter(c => c.verified).length
  const feeOk = cands.filter(c => !fee || ['Paid', 'Waived'].includes(c.fee_status)).length
  const eligible = cands.filter(c => eligibility(c, exam).ok).length
  const seated = cands.filter(c => c.room).length
  const issued = cands.filter(c => ['Hall Ticket Issued', 'Appeared', 'Absent'].includes(c.status)).length
  const marked = cands.filter(c => ['Appeared', 'Absent'].includes(c.status)).length
  const appeared = cands.filter(c => c.status === 'Appeared').length
  const evaluated = cands.filter(c => resMap[c.id]?.total_marks != null).length
  const decided = cands.filter(c => ['Pass', 'Fail', 'Waitlist', 'Admitted', 'Rejected'].includes(resMap[c.id]?.result_status)).length
  const admitted = cands.filter(c => resMap[c.id]?.result_status === 'Admitted').length
  const paper = parseJson(exam.paper)
  const patternOk = parseJson(exam.pattern)?.length > 0
  const t = today()
  const appState = !exam.app_open && !exam.app_close ? 'window not set' : (exam.app_open && t < exam.app_open) ? `opens ${fmtDate(exam.app_open)}` : (exam.app_close && t > exam.app_close) ? `closed ${fmtDate(exam.app_close)}` : `open till ${fmtDate(exam.app_close)}`

  const steps = [
    { tab: 'exams', title: 'Exam set-up', detail: patternOk ? `${examSections(exam).length} sections · ${exam.total_marks} marks · ${exam.total_seats || '—'} seats` : 'Define the paper pattern', v: patternOk ? 1 : 0, m: 1 },
    { tab: 'applications', title: 'Applications', detail: `${n} received · ${appState}`, v: n, m: Math.max(n, 1), soft: true },
    { tab: 'applications', title: 'Verification & fees', detail: `${verified} verified · ${fee ? `${feeOk} fee settled` : 'no fee'}`, v: eligible, m: n },
    { tab: 'paper', title: 'Question paper', detail: paper?.questions?.length ? `${paper.questions.length} questions · sets ${paper.sets.join(', ')}${paper.locked ? ' · locked' : ''}` : 'Not generated yet', v: paper?.questions?.length ? 1 : 0, m: 1 },
    { tab: 'halltickets', title: 'Seating & hall tickets', detail: `${seated} seated · ${issued} issued of ${eligible} eligible`, v: issued, m: eligible },
    { tab: 'examday', title: 'Exam day attendance', detail: `${appeared} present · ${marked - appeared} absent`, v: marked, m: issued },
    { tab: 'evaluation', title: 'OMR evaluation', detail: `${evaluated} of ${appeared} evaluated`, v: evaluated, m: appeared },
    { tab: 'results', title: 'Results & merit', detail: `${decided} decided${exam.result_published ? ' · published' : ''}`, v: decided, m: evaluated },
    { tab: 'admission', title: 'Admission', detail: `${admitted} admitted${exam.total_seats ? ` of ${exam.total_seats} seats` : ''}`, v: admitted, m: Number(exam.total_seats) || admitted || 0 },
  ]
  const firstOpen = steps.findIndex(s => (s.soft ? s.v === 0 : s.m === 0 ? true : s.v < s.m))

  const byCat = CATEGORIES.map(c => ({ c, n: cands.filter(x => (x.category || 'General') === c).length }))
  const byGender = GENDERS.map(g => ({ g, n: cands.filter(x => x.gender === g).length }))
  const upcoming = exams.filter(e => e.status !== 'Cancelled' && (e.exam_date || '') >= t).sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || '')).slice(0, 5)

  return (
    <div className="ex-grid ex-side">
      <PremiumCard title="Exam pipeline" subtitle="Each stage opens its tab. The highlighted one is next.">
        <div style={{ display: 'grid', gap: 10 }}>
          {steps.map((s, i) => {
            const done = s.soft ? s.v > 0 && i < firstOpen : s.m > 0 && s.v >= s.m
            const next = i === firstOpen
            return (
              <button key={i} className="ex-step" onClick={() => go(s.tab)} style={next ? { borderColor: PX.gold, boxShadow: '0 0 0 3px rgba(184,146,58,.14)' } : undefined}>
                <div className="ex-dot" style={done ? { background: PX.okBg, color: PX.ok } : next ? { background: PX.navy, color: PX.goldLt } : { background: '#f3f0e8', color: PX.faint }}>{done ? '✓' : i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: PX.ink }}>{s.title}</span>
                    {next && <Chip tone="gold">Next</Chip>}
                  </div>
                  <div style={{ fontSize: 12, color: PX.sub, marginTop: 2 }}>{s.detail}</div>
                  {!s.soft && s.m > 1 && <Progress value={s.v} max={s.m} />}
                </div>
              </button>
            )
          })}
        </div>
      </PremiumCard>

      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <PremiumCard title="This exam">
          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            {[['Type', `${exam.exam_type} · ${exam.class_target || ''}`], ['Date & time', `${fmtDate(exam.exam_date)} · ${exam.exam_time || '—'}`], ['Reporting', exam.reporting_time || '—'], ['Centre', exam.venue || '—'], ['Duration', `${exam.duration_mins || '—'} min`], ['Marks', `${exam.total_marks || '—'} · qualifying ${exam.passing_marks ?? '—'}`], ['Status', <StatusChip key="s" s={exam.status} />]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: PX.sub }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>
            ))}
          </div>
        </PremiumCard>
        <PremiumCard title="Applicants">
          {n === 0 ? <div style={{ color: PX.sub, fontSize: 13 }}>No applications yet.</div> : (
            <div style={{ display: 'grid', gap: 7 }}>
              {byCat.filter(x => x.n).map(x => (
                <div key={x.c}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>{x.c}</span><b>{x.n}</b></div><Progress value={x.n} max={n} /></div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>{byGender.filter(x => x.n).map(x => <Chip key={x.g} tone="navy">{x.g}s {x.n}</Chip>)}</div>
            </div>
          )}
        </PremiumCard>
        <PremiumCard title="Upcoming exams">
          {upcoming.length === 0 ? <div style={{ color: PX.sub, fontSize: 13 }}>Nothing scheduled.</div> : upcoming.map(e => {
            const d = Math.ceil((new Date(e.exam_date + 'T00:00') - new Date(t + 'T00:00')) / 86400000)
            return (
              <button key={e.id} onClick={() => selectExam(e.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', padding: '9px 0', border: 'none', borderBottom: `1px solid ${PX.line}`, background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span><span style={{ fontWeight: 700, color: PX.ink, fontSize: 13 }}>{e.exam_name}</span><br /><span style={{ fontSize: 11.5, color: PX.sub }}>{fmtDate(e.exam_date)} · {allCands.filter(c => c.exam_id === e.id).length} applicants</span></span>
                <Chip tone={d <= 3 ? 'bad' : d <= 14 ? 'warn' : 'ok'}>{d === 0 ? 'Today' : `${d}d`}</Chip>
              </button>
            )
          })}
        </PremiumCard>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Exams — set-up: schedule, application window, pattern, qualifying rules,
// seats & reservation, rooms
// ═══════════════════════════════════════════════════════════════════════════
const blankExam = () => {
  const p = PATTERN_PRESETS[0]
  const t = patternTotals(p.sections)
  return {
    exam_name: '', exam_type: p.exam_type, class_target: p.class_target, exam_date: '', exam_time: '10:00', reporting_time: '09:00',
    duration_mins: p.duration_mins, venue: 'GNSI, Khangabok', status: 'Scheduled', instructions: '', app_open: '', app_close: '',
    application_fee: 0, total_seats: '', negative_marks: 0, passing_marks: Math.round(t.marks * 0.4),
    pattern: p.sections.map(s => ({ ...s })), rules: { ...DEFAULT_RULES }, quotas: {}, rooms: [{ name: 'Hall 1', capacity: 40 }],
  }
}

function ExamsTab({ exams, allCands, resMap, can, reload, notify, setConfirm, selectExam, user, newExam }) {
  const [form, setForm] = useState(null)       // null = closed; {id?} = editing
  const [saving, setSaving] = useState(false)
  const [seenNew, setSeenNew] = useState(newExam)
  if (newExam !== seenNew) { setSeenNew(newExam); if (can.add) setForm(blankExam()) }

  const edit = e => setForm({
    ...blankExam(), ...e,
    exam_date: e.exam_date || '', app_open: e.app_open || '', app_close: e.app_close || '', total_seats: e.total_seats ?? '',
    pattern: examSections(e).map(s => ({ ...s })), rules: { ...DEFAULT_RULES, ...parseJson(e.rules, {}) },
    quotas: parseJson(e.quotas, {}) || {}, rooms: parseJson(e.rooms, null) || [{ name: 'Hall 1', capacity: 40 }],
  })

  const setStatus = async (e, status) => {
    const { error } = await safeWrite('entrance_exams', 'update', { status }, { id: e.id })
    if (error) return notify(error.message, 'bad')
    audit('exam_status', user, e.id, { status }); reload()
  }

  const del = e => {
    const n = allCands.filter(c => c.exam_id === e.id).length
    setConfirm({
      message: <>Delete <b>{e.exam_name}</b>{n ? <> with its <b>{n}</b> applications, results and answer key</> : ''}? This can't be undone.</>,
      confirmLabel: 'Delete exam',
      onConfirm: async () => {
        const ids = allCands.filter(c => c.exam_id === e.id).map(c => c.id)
        for (let i = 0; i < ids.length; i += 200) await supabase.from('entrance_results').delete().in('candidate_id', ids.slice(i, i + 200))
        await supabase.from('entrance_results').delete().eq('exam_id', e.id)
        await supabase.from('entrance_answer_keys').delete().eq('exam_id', e.id)
        await supabase.from('entrance_candidates').delete().eq('exam_id', e.id)
        const { error } = await supabase.from('entrance_exams').delete().eq('id', e.id)
        if (error) return notify(error.message, 'bad')
        audit('exam_delete', user, e.id, { exam_name: e.exam_name })
        notify('Exam deleted', 'ok'); reload()
      },
    })
  }

  const save = async ev => {
    ev.preventDefault()
    const f = form
    const pattern = f.pattern.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), subject: s.subject || s.name.trim(), questions: Number(s.questions) || 0, marks_each: Number(s.marks_each) || 0 }))
    if (!pattern.length) return notify('Add at least one section to the paper pattern', 'bad')
    if (f.app_open && f.app_close && f.app_close < f.app_open) return notify('Application window closes before it opens', 'bad')
    if (f.app_close && f.exam_date && f.app_close > f.exam_date) return notify('Applications must close before the exam date', 'bad')
    const totals = patternTotals(pattern)
    const payload = {
      exam_name: f.exam_name.trim(), exam_type: f.exam_type, course: EXAM_TYPE_COURSE[f.exam_type] || null, class_target: f.class_target,
      exam_date: f.exam_date || null, exam_time: f.exam_time || null, reporting_time: f.reporting_time || null,
      duration_mins: Number(f.duration_mins) || null, venue: f.venue, status: f.status, instructions: f.instructions,
      app_open: f.app_open || null, app_close: f.app_close || null, application_fee: Number(f.application_fee) || 0,
      total_seats: f.total_seats === '' ? null : Number(f.total_seats), negative_marks: Number(f.negative_marks) || 0,
      total_marks: totals.marks || Number(f.total_marks) || 0, passing_marks: Number(f.passing_marks) || 0,
      pattern, rules: f.rules,
      quotas: Object.fromEntries(Object.entries(f.quotas || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
      rooms: (f.rooms || []).filter(r => r.name.trim()).map(r => ({ name: r.name.trim(), capacity: Number(r.capacity) || 0 })),
    }
    setSaving(true)
    const { data, error, dropped } = f.id
      ? await safeWrite('entrance_exams', 'update', payload, { id: f.id })
      : await safeWrite('entrance_exams', 'insert', payload)
    setSaving(false)
    if (error) return notify(error.message, 'bad')
    audit(f.id ? 'exam_update' : 'exam_create', user, f.id || data?.[0]?.id, { exam_name: payload.exam_name })
    notify(dropped.length ? `Saved — but ${dropped.join(', ')} need the database upgrade` : f.id ? 'Exam updated' : 'Exam created', dropped.length ? 'warn' : 'ok')
    if (!f.id && data?.[0]?.id) selectExam(data[0].id)
    setForm(null); reload()
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {form && <ExamForm form={form} setForm={setForm} onSubmit={save} saving={saving} onClose={() => setForm(null)} />}
      <PremiumCard title="Entrance exams" subtitle={`${exams.length} exam${exams.length === 1 ? '' : 's'}`}
        right={can.add && !form && <button className="px-btn gold ex-btn-sm" onClick={() => setForm(blankExam())}><PIcon.plus size={14} />New exam</button>}>
        {exams.length === 0 ? <Empty icon="🗓️" title="No exams yet">Create one to start taking applications.</Empty> : (
          <div className="ex-tablewrap">
            <table className="px-table">
              <thead><tr><th>Exam</th><th>Date</th><th>Pattern</th><th>Applications</th><th>Seats</th><th>Status</th><th /></tr></thead>
              <tbody>
                {exams.map(e => {
                  const list = allCands.filter(c => c.exam_id === e.id)
                  const admitted = list.filter(c => resMap[c.id]?.result_status === 'Admitted').length
                  const secs = parseJson(e.pattern)
                  return (
                    <tr key={e.id}>
                      <td><button onClick={() => selectExam(e.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        <div style={{ fontWeight: 700, color: PX.ink }}>{e.exam_name}</div><div style={{ fontSize: 11.5, color: PX.sub }}>{e.exam_type} · {e.class_target}</div></button></td>
                      <td>{fmtDate(e.exam_date)}<div style={{ fontSize: 11.5, color: PX.faint }}>{e.exam_time} · {e.duration_mins}m</div></td>
                      <td style={{ fontSize: 12 }}>{secs?.length ? `${secs.length} sections · ${e.total_marks} marks` : <span style={{ color: PX.faint }}>legacy</span>}</td>
                      <td><b>{list.length}</b></td>
                      <td>{e.total_seats ? `${admitted}/${e.total_seats}` : '—'}</td>
                      <td><StatusChip s={e.status} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {can.edit && e.status === 'Scheduled' && <button className="px-btn ghost ex-btn-sm" onClick={() => setStatus(e, 'Ongoing')}>▶ Start</button>}
                        {can.edit && e.status === 'Ongoing' && <button className="px-btn ghost ex-btn-sm" onClick={() => setStatus(e, 'Completed')}>■ End</button>}{' '}
                        {can.edit && <button className="px-btn ghost ex-btn-sm" onClick={() => edit(e)}>Edit</button>}{' '}
                        {can.delete && <button className="px-btn ghost ex-btn-sm" style={{ color: PX.bad }} onClick={() => del(e)}>Delete</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  )
}

function ExamForm({ form, setForm, onSubmit, saving, onClose }) {
  const set = patch => setForm(f => ({ ...f, ...patch }))
  const course = EXAM_TYPE_COURSE[form.exam_type]
  const subjects = course ? Object.keys(COURSES[course]?.subjects || {}) : [...new Set(Object.values(COURSES).flatMap(c => Object.keys(c.subjects)))]
  const totals = patternTotals(form.pattern)
  const paperExists = !!parseJson(form.paper)?.questions?.length
  const seats = Number(form.total_seats) || 0
  const reservedSeats = RESERVED.reduce((t, c) => t + Math.floor((seats * (Number(form.quotas?.[c]) || 0)) / 100), 0)
  const roomCap = (form.rooms || []).reduce((t, r) => t + (Number(r.capacity) || 0), 0)

  const applyPreset = p => set({
    exam_type: p.exam_type, class_target: p.class_target, duration_mins: p.duration_mins, pattern: p.sections.map(s => ({ ...s })),
    passing_marks: Math.round(patternTotals(p.sections).marks * 0.4),
    exam_name: form.exam_name || `${p.label.split(' · ')[0]} ${new Date().getFullYear() + 1}`,
  })
  const setSec = (i, patch) => set({ pattern: form.pattern.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setRoom = (i, patch) => set({ rooms: form.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  return (
    <PremiumCard title={form.id ? `Edit · ${form.exam_name}` : 'New entrance exam'} subtitle="Schedule, application window, paper pattern, qualifying rules, seats"
      right={<button className="px-btn ghost ex-btn-sm" onClick={onClose}>✕ Close</button>}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 20 }}>
        {!form.id && (
          <div>
            <div className="px-eyebrow" style={{ marginBottom: 8 }}>Start from a pattern</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PATTERN_PRESETS.map(p => <button type="button" key={p.id} className="px-btn ghost ex-btn-sm" onClick={() => applyPreset(p)}>{p.label}</button>)}
            </div>
          </div>
        )}

        <div className="ex-grid ex-g3">
          <Field label="Exam name *" span><input className="px-input" required value={form.exam_name} onChange={e => set({ exam_name: e.target.value })} placeholder="e.g. GNSI Sainik Entrance 2027 · Batch A" /></Field>
          <Field label="Exam type"><select className="px-input" value={form.exam_type} onChange={e => set({ exam_type: e.target.value })}>{EXAM_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Admission to"><select className="px-input" value={form.class_target} onChange={e => set({ class_target: e.target.value })}>{CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Status"><select className="px-input" value={form.status} onChange={e => set({ status: e.target.value })}>{EXAM_STATUS.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Exam date *"><input type="date" className="px-input" required value={form.exam_date} onChange={e => set({ exam_date: e.target.value })} /></Field>
          <Field label="Exam starts"><input type="time" className="px-input" value={form.exam_time || ''} onChange={e => set({ exam_time: e.target.value })} /></Field>
          <Field label="Reporting time"><input type="time" className="px-input" value={form.reporting_time || ''} onChange={e => set({ reporting_time: e.target.value })} /></Field>
          <Field label="Duration (min)"><input type="number" min="1" className="px-input" value={form.duration_mins} onChange={e => set({ duration_mins: e.target.value })} /></Field>
          <Field label="Centre / venue" span><input className="px-input" value={form.venue || ''} onChange={e => set({ venue: e.target.value })} /></Field>
        </div>

        <div>
          <div className="px-eyebrow" style={{ marginBottom: 8 }}>Application window</div>
          <div className="ex-grid ex-g3">
            <Field label="Opens"><input type="date" className="px-input" value={form.app_open} onChange={e => set({ app_open: e.target.value })} /></Field>
            <Field label="Closes"><input type="date" className="px-input" value={form.app_close} onChange={e => set({ app_close: e.target.value })} /></Field>
            <Field label="Application fee (₹)" hint="0 = no fee; hall tickets then need only verification"><input type="number" min="0" className="px-input" value={form.application_fee} onChange={e => set({ application_fee: e.target.value })} /></Field>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div className="px-eyebrow">Paper pattern</div>
            <div style={{ fontSize: 12.5, color: PX.sub }}><b style={{ color: PX.ink }}>{totals.questions}</b> questions · <b style={{ color: PX.ink }}>{totals.marks}</b> marks</div>
          </div>
          {paperExists && <div style={{ fontSize: 12.5, color: PX.warn, background: PX.warnBg, borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>A question paper has been generated from this pattern. Discard it in the Question Paper tab before changing sections.</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {form.pattern.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1.3fr) 90px 90px 36px', gap: 8, alignItems: 'center' }}>
                <input className="px-input" disabled={paperExists} placeholder="Section name" value={s.name} onChange={e => setSec(i, { name: e.target.value })} aria-label="Section name" />
                <select className="px-input" disabled={paperExists} value={s.subject} onChange={e => setSec(i, { subject: e.target.value })} aria-label="Question Bank subject">
                  {!subjects.includes(s.subject) && <option value={s.subject}>{s.subject || '— QBank subject —'}</option>}
                  {subjects.map(x => <option key={x}>{x}</option>)}
                </select>
                <input type="number" min="0" className="px-input" disabled={paperExists} value={s.questions} onChange={e => setSec(i, { questions: e.target.value })} aria-label="Questions" title="Questions" />
                <input type="number" min="0" step="0.25" className="px-input" disabled={paperExists} value={s.marks_each} onChange={e => setSec(i, { marks_each: e.target.value })} aria-label="Marks each" title="Marks per question" />
                <button type="button" className="px-btn ghost ex-btn-sm" disabled={paperExists || form.pattern.length <= 1} onClick={() => set({ pattern: form.pattern.filter((_, j) => j !== i) })} aria-label="Remove section">✕</button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: PX.faint }}>Section name · Question Bank subject the paper is drawn from · questions · marks per question</div>
            {!paperExists && <button type="button" className="px-btn ghost ex-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ pattern: [...form.pattern, { name: '', subject: subjects[0] || '', questions: 10, marks_each: 1 }] })}><PIcon.plus size={13} />Add section</button>}
          </div>
        </div>

        <div>
          <div className="px-eyebrow" style={{ marginBottom: 8 }}>Marking & qualifying</div>
          <div className="ex-grid ex-g4">
            <Field label="Negative marks / wrong"><input type="number" min="0" step="0.25" className="px-input" value={form.negative_marks} onChange={e => set({ negative_marks: e.target.value })} /></Field>
            <Field label="Qualifying total" hint={totals.marks ? `${Math.round((Number(form.passing_marks) / totals.marks) * 100) || 0}% of ${totals.marks}` : ''}><input type="number" min="0" className="px-input" value={form.passing_marks} onChange={e => set({ passing_marks: e.target.value })} /></Field>
            <Field label="Min % in each section" hint="AISSEE uses 25%"><input type="number" min="0" max="100" className="px-input" value={form.rules.min_section_pct} onChange={e => set({ rules: { ...form.rules, min_section_pct: e.target.value } })} /></Field>
            <Field label="SC / ST">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, paddingTop: 9 }}>
                <input type="checkbox" checked={!!form.rules.relax_reserved} onChange={e => set({ rules: { ...form.rules, relax_reserved: e.target.checked } })} />No minimum marks
              </label>
            </Field>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div className="px-eyebrow">Seats & reservation</div>
            <button type="button" className="px-btn ghost ex-btn-sm" onClick={() => set({ quotas: { ...GOVT_QUOTAS } })}>Use govt. pattern (SC 15 · ST 7.5 · OBC 27 · EWS 10)</button>
          </div>
          <div className="ex-grid ex-g4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
            <Field label="Total seats"><input type="number" min="0" className="px-input" value={form.total_seats} onChange={e => set({ total_seats: e.target.value })} /></Field>
            {RESERVED.map(c => (
              <Field key={c} label={`${c} %`} hint={seats ? `${Math.floor((seats * (Number(form.quotas?.[c]) || 0)) / 100)} seats` : ''}>
                <input type="number" min="0" max="100" step="0.5" className="px-input" value={form.quotas?.[c] ?? ''} onChange={e => set({ quotas: { ...form.quotas, [c]: e.target.value } })} />
              </Field>
            ))}
          </div>
          {seats > 0 && <div style={{ fontSize: 12, color: PX.sub, marginTop: 6 }}>{seats - reservedSeats} open (merit) seats · {reservedSeats} reserved. Unfilled reserved seats go back to open merit.</div>}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div className="px-eyebrow">Exam rooms</div>
            <div style={{ fontSize: 12.5, color: PX.sub }}>Capacity {roomCap}</div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(form.rooms || []).map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 36px', gap: 8 }}>
                <input className="px-input" value={r.name} placeholder="Room / hall" onChange={e => setRoom(i, { name: e.target.value })} aria-label="Room name" />
                <input type="number" min="0" className="px-input" value={r.capacity} onChange={e => setRoom(i, { capacity: e.target.value })} aria-label="Capacity" title="Seats" />
                <button type="button" className="px-btn ghost ex-btn-sm" onClick={() => set({ rooms: form.rooms.filter((_, j) => j !== i) })} aria-label="Remove room">✕</button>
              </div>
            ))}
            <button type="button" className="px-btn ghost ex-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ rooms: [...(form.rooms || []), { name: `Hall ${(form.rooms || []).length + 1}`, capacity: 40 }] })}><PIcon.plus size={13} />Add room</button>
          </div>
        </div>

        <Field label="Hall-ticket instructions" hint="One per line. Leave empty for the standard instructions.">
          <textarea rows={3} className="px-input" value={form.instructions || ''} onChange={e => set({ instructions: e.target.value })} />
        </Field>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="px-btn" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create exam'}</button>
          <button type="button" className="px-btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </PremiumCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Applications — registration, verification, fees, photos, CSV import
// ═══════════════════════════════════════════════════════════════════════════
const blankCand = () => ({ student_name: '', dob: '', gender: '', category: 'General', father_name: '', mother_name: '', phone: '', email: '', address: '', school: '', class_studying: '', fee_status: 'Unpaid', fee_ref: '', remarks: '' })
const normName = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

function ApplicationsTab({ exam, cands, allCands, can, reload, notify, setConfirm, user }) {
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fState, setFState] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [form, setForm] = useState(null)
  const [importing, setImporting] = useState(false)
  const fee = Number(exam.application_fee) > 0

  const list = cands.filter(c => {
    if (fCat && (c.category || 'General') !== fCat) return false
    if (fState === 'unverified' && c.verified) return false
    if (fState === 'verified' && !c.verified) return false
    if (fState === 'unpaid' && (!fee || ['Paid', 'Waived'].includes(c.fee_status))) return false
    if (fState === 'eligible' && !eligibility(c, exam).ok) return false
    const s = q.trim().toLowerCase()
    return !s || [c.student_name, c.father_name, c.phone, c.application_no, c.school, hallTicketNo(exam.id, c.roll_number)].join(' ').toLowerCase().includes(s)
  })
  const allSel = list.length > 0 && list.every(c => sel.has(c.id))
  const toggle = id => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const update = async (ids, patch, label) => {
    const res = await inChunks(ids, 25, id => safeWrite('entrance_candidates', 'update', patch, { id }))
    const err = res.find(r => r.error)
    if (err) notify(err.error.message, 'bad')
    else notify(res[0]?.dropped?.length ? `Needs the database upgrade: ${res[0].dropped.join(', ')}` : label, res[0]?.dropped?.length ? 'warn' : 'ok')
    audit('candidates_update', user, exam.id, { count: ids.length, ...patch })
    reload()
  }

  const remove = ids => setConfirm({
    message: <>Remove <b>{ids.length}</b> application{ids.length > 1 ? 's' : ''} and any marks entered for them?</>,
    confirmLabel: 'Remove',
    onConfirm: async () => {
      await supabase.from('entrance_results').delete().in('candidate_id', ids)
      const { error } = await supabase.from('entrance_candidates').delete().in('id', ids)
      if (error) return notify(error.message, 'bad')
      audit('candidates_delete', user, exam.id, { count: ids.length })
      setSel(new Set()); notify('Removed', 'ok'); reload()
    },
  })

  const exportCSV = () => downloadText(`${exam.exam_name}-applications.csv`, toCSV(list, [
    { label: 'Application no', key: 'application_no' }, { label: 'Roll no', get: c => hallTicketNo(exam.id, c.roll_number) },
    { label: 'Name', key: 'student_name' }, { label: 'DOB', key: 'dob' }, { label: 'Gender', key: 'gender' }, { label: 'Category', key: 'category' },
    { label: 'Father', key: 'father_name' }, { label: 'Mother', key: 'mother_name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' },
    { label: 'School', key: 'school' }, { label: 'Class', key: 'class_studying' }, { label: 'Address', key: 'address' },
    { label: 'Fee', key: 'fee_status' }, { label: 'Fee ref', key: 'fee_ref' }, { label: 'Verified', get: c => (c.verified ? 'Yes' : 'No') },
    { label: 'Status', key: 'status' }, { label: 'Room', key: 'room' }, { label: 'Seat', key: 'seat_no' },
  ]))

  const t = today()
  const windowNote = exam.app_close && t > exam.app_close ? { tone: 'bad', text: `Applications closed on ${fmtDate(exam.app_close)}` }
    : exam.app_open && t < exam.app_open ? { tone: 'warn', text: `Applications open on ${fmtDate(exam.app_open)}` }
      : exam.app_close ? { tone: 'ok', text: `Open until ${fmtDate(exam.app_close)}` } : null

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Applications" v={cands.length} sub={windowNote?.text} />
        <Kpi k="Verified" v={cands.filter(c => c.verified).length} tone={PX.ok} sub={`${cands.filter(c => !c.verified).length} pending`} />
        <Kpi k="Fee settled" v={fee ? cands.filter(c => ['Paid', 'Waived'].includes(c.fee_status)).length : '—'} sub={fee ? `₹${exam.application_fee} per application` : 'no application fee'} />
        <Kpi k="Eligible for hall ticket" v={cands.filter(c => eligibility(c, exam).ok).length} tone="#8a6118" />
      </div>

      <PremiumCard title="Applications" subtitle={`${list.length} shown`}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="px-btn ghost ex-btn-sm" onClick={exportCSV}><PIcon.download size={13} />CSV</button>
          {can.add && <button className="px-btn ghost ex-btn-sm" onClick={() => setImporting(true)}>Import CSV</button>}
          {can.add && <button className="px-btn gold ex-btn-sm" onClick={() => setForm(blankCand())}><PIcon.plus size={13} />New application</button>}
        </div>}>
        <div className="ex-bar">
          <input className="px-input" style={{ maxWidth: 260 }} placeholder="Search name, phone, application no…" value={q} onChange={e => setQ(e.target.value)} />
          <select className="px-input" style={{ maxWidth: 150 }} value={fCat} onChange={e => setFCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select className="px-input" style={{ maxWidth: 170 }} value={fState} onChange={e => setFState(e.target.value)} aria-label="State">
            <option value="">All applications</option><option value="unverified">Not verified</option><option value="verified">Verified</option>
            {fee && <option value="unpaid">Fee unpaid</option>}<option value="eligible">Eligible for hall ticket</option>
          </select>
          {sel.size > 0 && can.edit && <>
            <span style={{ fontSize: 12.5, color: PX.sub, marginLeft: 'auto' }}>{sel.size} selected</span>
            <button className="px-btn ghost ex-btn-sm" onClick={() => update([...sel], { verified: true }, 'Marked verified')}>✓ Verify</button>
            {fee && <button className="px-btn ghost ex-btn-sm" onClick={() => update([...sel], { fee_status: 'Paid', fee_paid_on: t }, 'Fee marked paid')}>₹ Mark paid</button>}
            {can.delete && <button className="px-btn ghost ex-btn-sm" style={{ color: PX.bad }} onClick={() => remove([...sel])}>Remove</button>}
          </>}
        </div>
        {cands.length === 0 ? <Empty icon="📝" title="No applications yet">Add them one by one or import a CSV.</Empty> : (
          <div className="ex-tablewrap" style={{ marginTop: 0 }}>
            <table className="px-table">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map(c => c.id)))} /></th>
                <th>Application</th><th>Candidate</th><th>Category</th><th>Contact</th>{fee && <th>Fee</th>}<th>Verified</th><th>Status</th><th />
              </tr></thead>
              <tbody>
                {list.map(c => {
                  const age = ageOn(c.dob, exam.exam_date)
                  return (
                    <tr key={c.id} className={sel.has(c.id) ? 'ex-row-sel' : undefined}>
                      <td><input type="checkbox" aria-label={`Select ${c.student_name}`} checked={sel.has(c.id)} onChange={() => toggle(c.id)} /></td>
                      <td><div className="ex-mono" style={{ fontWeight: 700, fontSize: 12 }}>{c.application_no || '—'}</div><div className="ex-mono" style={{ fontSize: 11, color: PX.faint }}>{hallTicketNo(exam.id, c.roll_number)}</div></td>
                      <td><div style={{ fontWeight: 700, color: PX.ink }}>{c.photo_url ? '📷 ' : ''}{c.student_name}</div><div style={{ fontSize: 11.5, color: PX.sub }}>{[c.father_name && `S/o·D/o ${c.father_name}`, age != null && `${age} yrs`].filter(Boolean).join(' · ')}</div></td>
                      <td>{c.category || 'General'}{c.gender && <div style={{ fontSize: 11.5, color: PX.faint }}>{c.gender}</div>}</td>
                      <td>{c.phone ? <a href={`tel:${c.phone}`} style={{ color: PX.navy2, textDecoration: 'none' }}>{c.phone}</a> : '—'}</td>
                      {fee && <td><StatusChip s={c.fee_status || 'Unpaid'} onClick={can.edit ? () => update([c.id], c.fee_status === 'Paid' ? { fee_status: 'Unpaid', fee_paid_on: null } : { fee_status: 'Paid', fee_paid_on: t }, 'Fee updated') : undefined} title="Toggle paid" /></td>}
                      <td>{c.verified ? <Chip tone="ok" onClick={can.edit ? () => update([c.id], { verified: false }, 'Verification removed') : undefined}>✓ Verified</Chip>
                        : <Chip tone="warn" onClick={can.edit ? () => update([c.id], { verified: true }, 'Verified') : undefined}>Verify</Chip>}</td>
                      <td><StatusChip s={c.status} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {can.edit && <button className="px-btn ghost ex-btn-sm" onClick={() => setForm({ ...blankCand(), ...c })}>Edit</button>}{' '}
                        {can.delete && <button className="px-btn ghost ex-btn-sm" style={{ color: PX.bad }} onClick={() => remove([c.id])} aria-label="Remove">✕</button>}
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: PX.faint, padding: 28 }}>No applications match these filters</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      {form && <CandidateForm exam={exam} cands={cands} allCands={allCands} initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} notify={notify} user={user} />}
      {importing && <ImportCSV exam={exam} cands={cands} onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload() }} notify={notify} user={user} />}
    </div>
  )
}

function CandidateForm({ exam, cands, initial, onClose, onSaved, notify, user }) {
  const [f, setF] = useState(initial)
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dupOk, setDupOk] = useState(false)
  const set = patch => { setF(x => ({ ...x, ...patch })); setDupOk(false) }
  const age = ageOn(f.dob, exam.exam_date)
  const dup = cands.find(c => c.id !== f.id && normName(c.student_name) === normName(f.student_name) && ((f.dob && c.dob === f.dob) || (f.phone && c.phone === f.phone)))
  const phoneBad = f.phone && !/^\+?\d[\d\s-]{8,13}$/.test(f.phone.trim())

  const save = async ev => {
    ev.preventDefault()
    if (dup && !dupOk) { setDupOk(true); return }
    setSaving(true)
    let photo_url = f.photo_url || null
    if (photo) {
      if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) { setSaving(false); return notify('Photo must be JPG, PNG or WebP', 'bad') }
      if (photo.size > 2 * 1024 * 1024) { setSaving(false); return notify('Photo must be under 2 MB', 'bad') }
      const path = `entrance/photos/${exam.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${photo.type.split('/')[1]}`
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type })
      if (error) { setSaving(false); return notify('Photo upload failed: ' + error.message, 'bad') }
      photo_url = path
    }
    const fields = ['student_name', 'dob', 'gender', 'category', 'father_name', 'mother_name', 'phone', 'email', 'address', 'school', 'class_studying', 'fee_status', 'fee_ref', 'remarks']
    const payload = Object.fromEntries(fields.map(k => [k, typeof f[k] === 'string' ? f[k].trim() || null : f[k] ?? null]))
    payload.student_name = f.student_name.trim()
    payload.category = f.category || 'General'
    payload.photo_url = photo_url
    if (f.fee_status === 'Paid' && initial.fee_status !== 'Paid') payload.fee_paid_on = today()
    let res
    if (f.id) res = await safeWrite('entrance_candidates', 'update', payload, { id: f.id })
    else {
      res = await safeWrite('entrance_candidates', 'insert', {
        ...payload, exam_id: exam.id, status: 'Registered', verified: false,
        roll_number: nextRoll(cands, exam.id), application_no: applicationNo(exam, nextApplicationSeq(cands, exam.id)),
      })
    }
    setSaving(false)
    if (res.error) return notify(res.error.message, 'bad')
    audit(f.id ? 'candidate_update' : 'candidate_create', user, f.id || res.data?.[0]?.id, { student_name: payload.student_name, exam: exam.exam_name })
    notify(f.id ? 'Application updated' : `Application ${res.data?.[0]?.application_no || ''} registered`, 'ok')
    onSaved()
  }

  return (
    <Modal title={f.id ? `Edit application · ${f.application_no || f.student_name}` : 'New application'} subtitle={exam.exam_name} onClose={onClose} width={820}
      footer={<>
        <button className="px-btn ghost" onClick={onClose}>Cancel</button>
        <button className="px-btn" form="ex-cand-form" type="submit" disabled={saving}>{saving ? 'Saving…' : dup && dupOk ? 'Save anyway' : f.id ? 'Save changes' : 'Register'}</button>
      </>}>
      <form id="ex-cand-form" onSubmit={save} style={{ display: 'grid', gap: 16 }}>
        {dup && <div style={{ background: PX.warnBg, color: PX.warn, borderRadius: 10, padding: '9px 12px', fontSize: 12.5 }}>Looks like a duplicate of <b>{dup.student_name}</b> ({dup.application_no || hallTicketNo(exam.id, dup.roll_number)}) — same name and {f.dob && dup.dob === f.dob ? 'date of birth' : 'phone'}.{dupOk ? ' Click "Save anyway" to keep both.' : ''}</div>}
        <div className="ex-grid ex-g3">
          <Field label="Candidate name *" span><input className="px-input" required value={f.student_name} onChange={e => set({ student_name: e.target.value })} /></Field>
          <Field label="Date of birth" hint={age != null ? `${age} years on the exam date` : ''}><input type="date" className="px-input" value={f.dob || ''} onChange={e => set({ dob: e.target.value })} /></Field>
          <Field label="Gender"><select className="px-input" value={f.gender || ''} onChange={e => set({ gender: e.target.value })}><option value="">—</option>{GENDERS.map(g => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Category"><select className="px-input" value={f.category || 'General'} onChange={e => set({ category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Father's name"><input className="px-input" value={f.father_name || ''} onChange={e => set({ father_name: e.target.value })} /></Field>
          <Field label="Mother's name"><input className="px-input" value={f.mother_name || ''} onChange={e => set({ mother_name: e.target.value })} /></Field>
          <Field label="Phone" hint={phoneBad ? 'Check the number' : ''}><input className="px-input" inputMode="tel" value={f.phone || ''} onChange={e => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className="px-input" value={f.email || ''} onChange={e => set({ email: e.target.value })} /></Field>
          <Field label="Current school"><input className="px-input" value={f.school || ''} onChange={e => set({ school: e.target.value })} /></Field>
          <Field label="Class studying"><input className="px-input" value={f.class_studying || ''} onChange={e => set({ class_studying: e.target.value })} placeholder="e.g. Class 5" /></Field>
          <Field label="Address" span><input className="px-input" value={f.address || ''} onChange={e => set({ address: e.target.value })} /></Field>
          <Field label="Application fee"><select className="px-input" value={f.fee_status || 'Unpaid'} onChange={e => set({ fee_status: e.target.value })}>{FEE_STATUS.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Receipt / txn ref"><input className="px-input" value={f.fee_ref || ''} onChange={e => set({ fee_ref: e.target.value })} /></Field>
          <Field label="Photo" hint={f.photo_url && !photo ? 'Photo on file — choose a file to replace' : 'JPG/PNG, under 2 MB'}><input type="file" accept="image/jpeg,image/png,image/webp" className="px-input" style={{ padding: 7 }} onChange={e => setPhoto(e.target.files?.[0] || null)} /></Field>
          <Field label="Remarks" span><input className="px-input" value={f.remarks || ''} onChange={e => set({ remarks: e.target.value })} /></Field>
        </div>
      </form>
    </Modal>
  )
}

function ImportCSV({ exam, cands, onClose, onDone, notify, user }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const get = (r, ...keys) => { for (const k of keys) if (r[k]) return r[k]; return '' }

  const read = async file => {
    const parsed = parseCSV(await file.text())
    const seen = new Set(cands.map(c => normName(c.student_name) + '|' + (c.dob || c.phone || '')))
    setRows(parsed.map(r => {
      const name = get(r, 'student_name', 'name', 'candidate_name')
      const dob = get(r, 'dob', 'date_of_birth')
      const phone = get(r, 'phone', 'mobile', 'contact')
      const key = normName(name) + '|' + (dob || phone)
      const dupe = seen.has(key); seen.add(key)
      const cat = CATEGORIES.find(c => c.toLowerCase() === get(r, 'category').toLowerCase()) || 'General'
      const gRaw = get(r, 'gender', 'sex').toLowerCase()
      const gender = /^(m|boy|male)/.test(gRaw) ? 'Boy' : /^(f|girl|female)/.test(gRaw) ? 'Girl' : gRaw ? 'Other' : null
      return { name, dob: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null, rawDob: dob, phone, gender, category: cat, father: get(r, 'father_name', 'father'), mother: get(r, 'mother_name', 'mother'), school: get(r, 'school', 'current_school'), cls: get(r, 'class', 'class_studying'), address: get(r, 'address'), email: get(r, 'email'), fee: /^(paid|yes)$/i.test(get(r, 'fee_status', 'fee')) ? 'Paid' : 'Unpaid', dupe, ok: !!name }
    }))
  }

  const go = async () => {
    const ok = rows.filter(r => r.ok && !r.dupe)
    if (!ok.length) return notify('Nothing new to import', 'warn')
    setBusy(true)
    let roll = nextRoll(cands, exam.id), seq = nextApplicationSeq(cands, exam.id)
    const payload = ok.map(r => ({
      exam_id: exam.id, student_name: r.name, dob: r.dob, phone: r.phone || null, gender: r.gender, category: r.category,
      father_name: r.father || null, mother_name: r.mother || null, school: r.school || null, class_studying: r.cls || null,
      address: r.address || null, email: r.email || null, fee_status: r.fee, status: 'Registered', verified: false,
      roll_number: roll++, application_no: applicationNo(exam, seq++),
    }))
    let done = 0, err = null
    for (let i = 0; i < payload.length && !err; i += 200) {
      const { error } = await safeWrite('entrance_candidates', 'insert', payload.slice(i, i + 200))
      if (error) err = error; else done += Math.min(200, payload.length - i)
    }
    setBusy(false)
    audit('candidates_import', user, exam.id, { count: done })
    if (err) notify(`Imported ${done}, then stopped: ${err.message}`, 'bad')
    else notify(`Imported ${done} application${done === 1 ? '' : 's'}`, 'ok')
    onDone()
  }

  const good = rows?.filter(r => r.ok && !r.dupe).length || 0
  return (
    <Modal title="Import applications from CSV" subtitle={exam.exam_name} onClose={onClose} width={860}
      footer={<><button className="px-btn ghost" onClick={onClose}>Cancel</button><button className="px-btn" disabled={!good || busy} onClick={go}>{busy ? 'Importing…' : `Import ${good}`}</button></>}>
      <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 10, lineHeight: 1.6 }}>
        Columns (header row, any order): <span className="ex-mono">student_name, dob (YYYY-MM-DD), gender, category, father_name, mother_name, phone, email, school, class, address, fee_status</span>.
        Roll numbers and application numbers are assigned automatically. Rows matching an existing candidate (same name and DOB/phone) are skipped.
      </div>
      <input type="file" accept=".csv,text/csv" className="px-input" style={{ padding: 7 }} onChange={e => e.target.files?.[0] && read(e.target.files[0])} />
      {rows && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <Chip tone="ok">{good} new</Chip><Chip tone="warn">{rows.filter(r => r.dupe).length} duplicates</Chip><Chip tone="bad">{rows.filter(r => !r.ok).length} without a name</Chip>
            {rows.some(r => r.rawDob && !r.dob) && <Chip tone="warn">some DOBs not YYYY-MM-DD — left blank</Chip>}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 300 }}>
            <table className="px-table"><thead><tr><th>Name</th><th>DOB</th><th>Category</th><th>Father</th><th>Phone</th><th /></tr></thead>
              <tbody>{rows.slice(0, 50).map((r, i) => (
                <tr key={i} style={{ opacity: r.ok && !r.dupe ? 1 : 0.5 }}><td>{r.name || '—'}</td><td>{r.dob || r.rawDob || '—'}</td><td>{r.category}</td><td>{r.father || '—'}</td><td>{r.phone || '—'}</td><td>{!r.ok ? <Chip tone="bad">no name</Chip> : r.dupe ? <Chip tone="warn">duplicate</Chip> : <Chip tone="ok">new</Chip>}</td></tr>
              ))}</tbody></table>
          </div>
          {rows.length > 50 && <div style={{ fontSize: 12, color: PX.faint, marginTop: 6 }}>Showing 50 of {rows.length}</div>}
        </div>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Activity — entrance actions from audit_log
// ═══════════════════════════════════════════════════════════════════════════
function ActivityTab() {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let live = true
    supabase.from('audit_log').select('*').like('action', 'entrance_%').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (live) setRows(data || []) })
    return () => { live = false }
  }, [])
  const label = a => String(a || '').replace(/^entrance_/, '').replace(/_/g, ' ')
  const tone = a => /delete/.test(a) ? PX.bad : /create|import/.test(a) ? PX.ok : /publish|allocat|admit/.test(a) ? '#8a6118' : PX.navy2
  return (
    <PremiumCard title="Activity" subtitle="Every change made in the Entrance module">
      {rows == null ? <Empty icon="⏳" title="Loading…" /> : rows.length === 0 ? <Empty icon="🕐" title="No activity yet">Changes made from now on are listed here.</Empty> : (
        <div style={{ display: 'grid' }}>
          {rows.map((r, i) => {
            const v = parseJson(r.new_values, {})
            return (
              <div key={r.id || i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: `1px solid ${PX.line}` }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: tone(r.action), marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: PX.ink, textTransform: 'capitalize' }}>{label(r.action)}</span>
                    <span style={{ fontSize: 11.5, color: PX.faint }}>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: PX.sub, marginTop: 2 }}>by <b>{r.changed_by || 'system'}</b>{v && typeof v === 'object' ? ' · ' + Object.entries(v).slice(0, 4).map(([k, x]) => `${k.replace(/_/g, ' ')}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join(' · ') : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PremiumCard>
  )
}


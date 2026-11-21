/* eslint-disable react-hooks/set-state-in-effect -- data loaders set state after fetching, as elsewhere in the portal */
// MissionFoundation.jsx — GNSI Portal · Management → Mission Foundation
// 8 weekly Monday tests for the Foundation batches (Udaan, Pragati), December 2026 – January 2027.
// A workspace for every Foundation teacher: the test schedule, the syllabus pattern of each paper,
// who sets and who checks it, its progress (Pending → Submitted → Checked → Approved), marks and ranked results.
// Tables: migration 20261216_mission_foundation.sql. Defaults and pure logic: missionFoundationData.js.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { getActiveStudents } from './studentQueries'
import { PremiumStyles, PremiumHero, IconTabs, PremiumCard, PIcon, PX } from './premiumUI'
import { PersonCell, Pill } from './MissionSainikUI'
import { fetchAll } from './lib/missionSainikQuestions'
import { downloadCsv, downloadFile, buildIcs } from './lib/missionSainikExport'
import { AnalyserTab, MaterialTab, ChatTab, StudentsTab, AuditTab } from './MissionFoundationExtras'
import { HomeDashboard, TeachingTab, ConductTab, PrizesTab } from './MissionFoundationWork'
import { QuestionMakerTab } from './MissionFoundationPaper'
import { testReportBody, reportCardsBody, MFR_CSS } from './lib/missionFoundationReport'
import { printPremium } from './lib/printPremium'
import { FlowTracker, FlowNav } from './MissionSainikFlow'
import TeacherPicker from './TeacherPicker'
import { staffOptions, staffNameFor } from './lib/teacherPick'
import { Faces, WithFace } from './MissionFoundationFaces'
import { FOUNDATION_FLOW } from './lib/missionFoundationFlow'
import { getInstitute } from './systemSettings'
import { buildTableDocx, downloadDocx } from './lib/missionSainikDocx'
import {
  MISSION_NAME, BATCHES, applyClasses, settersOf, isSetter, papersForClass, copyForClass, SUBJECTS, DEFAULT_PANEL, PAPER_FLOW, TEST_FLOW, DEFAULT_PLAN, DEFAULT_TEST_MINUTES,
  subjectByLabel, maxMarks, buildSchedule, foundationRoster, cleanTeacherName, shareTests, checkerFor, rankResults, markError, nameMatches, titled, safeUrl, focusTest, copyFormatPlan,
} from './missionFoundationData'

const T_TESTS = 'mission_foundation_tests'
const T_PAPERS = 'mission_foundation_papers'
const T_PANEL = 'mission_foundation_panel'
const T_AUDIT = 'mission_foundation_audit'
const T_MARKS = 'mission_foundation_marks'
const SQL_FILE = 'supabase/migrations/20261216_mission_foundation.sql'

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const todayISO = () => new Date().toLocaleDateString('en-CA')
const fmt = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
const monthOf = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const now = () => new Date().toISOString()
const PAPER_TONE = { Pending: 'warn', Submitted: 'info', Checked: 'gold', Approved: 'ok' }
const TEST_TONE = { Planned: 'mute', Ready: 'info', Conducted: 'gold', 'Results out': 'ok' }
const missingTable = e => /does not exist|relation .* not found|schema cache/i.test(e?.message || '')

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => {
    const f = () => setM(window.innerWidth < 700)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return m
}

// A text / number field that saves when it loses focus (and only if the value changed).
function BlurField({ value, onSave, type = 'text', placeholder, width, label, disabled }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input className="px-input" type={type} aria-label={label} placeholder={placeholder} value={v} disabled={disabled}
      style={{ width: width || '100%', minWidth: 0, padding: '7px 10px', fontSize: 13.5 }}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      onBlur={() => { if (String(v) !== String(value ?? '')) onSave(type === 'number' ? (v === '' ? null : Number(v)) : v.trim()) }} />
  )
}

function PersonSelect({ value, options, onChange, label, emptyLabel = '—' }) {
  const list = [...new Set([...(options || []), ...(value ? [value] : [])])]
  return (
    <select className="px-input" aria-label={label} value={value || ''} onChange={e => onChange(e.target.value)} style={{ padding: '7px 10px', fontSize: 13.5, minWidth: 110 }}>
      <option value="">{emptyLabel}</option>
      {list.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )
}

const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>

export default function MissionFoundation({ currentUser }) {
  const isMobile = useIsMobile()
  const isAdmin = isAdminRole(currentUser?.role)
  const [tab, setTab] = useState('home')
  const [tests, setTests] = useState([])
  const [papers, setPapers] = useState([])
  const [panelRows, setPanelRows] = useState([])
  const [staffDir, setStaffDir] = useState([])   // { name, designation, department } for the teacher picker
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [msg, setMsg] = useState(null)
  const [openTest, setOpenTest] = useState(null)
  const [workTest, setWorkTest] = useState('')
  const [teaching, setTeaching] = useState([])
  const [prizes, setPrizes] = useState([])
  const [allMarks, setAllMarks] = useState(null)
  const [students, setStudents] = useState(null)
  const [unplaced, setUnplaced] = useState([])
  const [rosterTick, setRosterTick] = useState(0)
  const [classNames, setClassNames] = useState(() => [...BATCHES])   // the classes that sit the tests (admin-defined; Udaan and Pragati until set up)
  const [classRows, setClassRows] = useState([])
  const staffOptsAll = useMemo(() => staffOptions(staffDir), [staffDir])
  // Who is logged in = their Staff record (linked by login id, then email / username, then exact name). The staff name is what
  // setter / checker / panel names are matched against, so "Sandhyarani" logs in as her staff entry "Sandhya …".
  const me = useMemo(() => {
    const low = x => String(x || '').trim().toLowerCase()
    const u = currentUser || {}
    const hit = (staffDir || []).find(s => u.id != null && s.user_id != null && String(s.user_id) === String(u.id))
      || (staffDir || []).find(s => [u.email, u.username].some(k => low(k) && low(k) === low(s.email)))
      || (staffDir || []).find(s => low(s.name) && low(s.name) === low(u.name))
    return hit?.name || u.name || ''
  }, [staffDir, currentUser])
  const photoOf = tok => staffNameFor(cleanTeacherName(tok), staffOptsAll)   // full staff name for a stored first name, to find the right photo
  const reloadStudents = () => setRosterTick(n => n + 1)
  const today = todayISO()

  const flash = useCallback((text, bad) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), bad ? 6000 : 3000) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [t, p, pn, st, tc, pz, cl] = await Promise.all([
      supabase.from(T_TESTS).select('*').order('test_date').order('test_no'),
      supabase.from(T_PAPERS).select('*'),
      supabase.from(T_PANEL).select('*').order('teacher'),
      supabase.from('staff_profiles').select('name, department, designation, user_id, email').order('name'),
      supabase.from('mission_foundation_teaching').select('*'),
      supabase.from('mission_foundation_prizes').select('*'),
      supabase.from('mission_foundation_classes').select('*').order('sort_no').order('name'),
    ])
    const err = t.error || p.error || pn.error || tc.error || pz.error
    setTeaching(tc.data || []); setPrizes(pz.data || [])
    // classes: the admin's list when it exists (table missing or empty → Udaan and Pragati); BATCHES is updated in place for every screen
    const cls = cl && !cl.error ? cl.data || [] : []
    setClassRows(cls); setClassNames(applyClasses(cls.map(c => c.name)))
    if (err) {
      if (missingTable(err)) setSetupNeeded(true)
      else flash('Could not load: ' + err.message, true)
    } else setSetupNeeded(false)
    setTests(t.data || []); setPapers(p.data || []); setPanelRows(pn.data || [])
    setStaffDir(st.data || [])
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

  const loadMarks = useCallback(async () => {
    const out = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(T_MARKS).select('test_id, student_id, student_name, gcc_no, batch, subject, marks, absent').range(from, from + 999)
      if (error) break
      out.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    setAllMarks(out)
  }, [])
  useEffect(() => { loadMarks() }, [loadMarks])
  useEffect(() => {
    let live = true
    getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,status').then(rows => {
      if (!live) return
      const r = foundationRoster(rows)
      setStudents(r.placed); setUnplaced(r.unplaced)
    })
    return () => { live = false }
  }, [rosterTick, classNames.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  // The test the Teaching / Test day pages open on: the one picked elsewhere, else today's or the next one.
  const activeTest = (tests.some(t => t.id === workTest) && workTest) || focusTest(tests, today)?.id || ''
  const openWork = id => { setWorkTest(id); setOpenTest(id) }
  const marksCount = useMemo(() => {
    const c = {}
    ;(allMarks || []).forEach(m => { c[m.test_id] = (c[m.test_id] || 0) + 1 })
    return c
  }, [allMarks])

  // Panel: saved rows, or the timetable defaults until someone saves one.
  const panelFromDb = panelRows.length > 0
  const panel = useMemo(() => {
    if (!panelFromDb) return DEFAULT_PANEL
    const m = Object.fromEntries(SUBJECTS.map(s => [s.label, []]))
    panelRows.forEach(r => { (m[r.subject] ||= []).push(r.teacher) })
    return m
  }, [panelRows, panelFromDb])
  const allTeachers = useMemo(() => [...new Set(Object.values(panel).flat())].sort(), [panel])
  const peopleFor = subject => [...new Set([...(panel[subject] || []), ...allTeachers])]

  // papersByTest = the shared paper of each test (what every class sits unless the admin made a paper for one class);
  // allPapersByTest = every paper row of the test, including the separate class papers.
  const papersByTest = useMemo(() => {
    const m = {}
    papers.filter(p => !p.class_name).forEach(p => { (m[p.test_id] ||= []).push(p) })
    Object.values(m).forEach(l => l.sort((a, b) => SUBJECTS.findIndex(s => s.label === a.subject) - SUBJECTS.findIndex(s => s.label === b.subject)))
    return m
  }, [papers])
  const allPapersByTest = useMemo(() => {
    const m = {}
    papers.forEach(p => { (m[p.test_id] ||= []).push(p) })
    return m
  }, [papers])
  const testById = useMemo(() => Object.fromEntries(tests.map(t => [t.id, t])), [tests])

  // ── audit log + locks ──
  const audit = (action, ref, detail) => { supabase.from(T_AUDIT).insert({ actor: me || '', action, ref: ref || null, detail: detail || null }).then(() => {}, () => {}) } // best-effort
  const isLocked = testId => !!testById[testId]?.locked
  const lockedMsg = 'This test is locked. Ask an admin to unlock it.'
  // ── writes ──
  const savePaper = async (id, patch) => {
    const pp = papers.find(p => p.id === id)
    if (pp && isLocked(pp.test_id) && !isAdmin) return flash(lockedMsg, true)
    const next = { ...patch, updated_by: me, updated_at: now() }
    setPapers(ps => ps.map(p => p.id === id ? { ...p, ...next } : p))
    const { error } = await supabase.from(T_PAPERS).update(next).eq('id', id)
    if (error) { flash('Not saved: ' + error.message, true); load() } else audit('paper_update', `${testById[pp?.test_id]?.title || 'Test'} · ${pp?.subject || id}`, patch)
  }
  const saveTest = async (id, patch) => {
    if (isLocked(id) && !isAdmin && !('locked' in patch)) return flash(lockedMsg, true)
    const next = { ...patch, updated_by: me, updated_at: now() }
    setTests(ts => ts.map(t => t.id === id ? { ...t, ...next } : t))
    const { error } = await supabase.from(T_TESTS).update(next).eq('id', id)
    if (error) { flash('Not saved: ' + error.message, true); load() } else audit('locked' in patch ? (patch.locked ? 'test_lock' : 'test_unlock') : 'test_update', testById[id]?.title || id, 'locked' in patch ? null : Object.keys(patch))
  }
  const lockTest = (id, on) => saveTest(id, { locked: on, locked_by: on ? me : null, locked_at: on ? now() : null })

  const stats = useMemo(() => {
    const done = papers.filter(p => p.status === 'Approved').length
    const late = papers.filter(p => p.status !== 'Approved' && testById[p.test_id]?.test_date <= today).length
    const next = tests.find(t => t.test_date >= today)
    const mine = papers.filter(p => (isSetter(me, p) && p.status === 'Pending') || (nameMatches(me, p.verifier) && p.status === 'Submitted')).length
    return { done, late, next, mine }
  }, [papers, tests, testById, today, me])

  // A teacher's flow, first to last: teach -> set & check papers -> enter marks -> see results. The admin's set-up steps stay with the admin.
  const flow = useMemo(() => (isAdmin ? FOUNDATION_FLOW : FOUNDATION_FLOW.filter(st => ['teach', 'papers', 'marks', 'results'].includes(st.id))), [isAdmin])
  const groups = [
    { label: 'Plan', color: '#185FA5', tabs: [
      { id: 'schedule', label: 'Schedule & syllabus', icon: PIcon.calendar, hint: '8 Monday tests, chapters and paper pattern' },
      { id: 'teachers', label: 'Teachers', icon: PIcon.users, hint: 'Who teaches and sets each subject' },
      { id: 'students', label: 'Students', icon: PIcon.cap, hint: 'Every Udaan and Pragati student, live from Students', badge: unplaced.length },
    ] },
    { label: 'Teach', color: '#0f7a4c', tabs: [
      { id: 'teaching', label: 'Teaching', icon: PIcon.cap, hint: 'Tick chapters as they are taught' },
      { id: 'material', label: 'Study material', icon: PIcon.folder, hint: 'Notes, worksheets and links' },
      { id: 'mine', label: 'My papers', icon: PIcon.pen, hint: 'Set and check question papers', badge: stats.mine },
      { id: 'maker', label: 'Question maker', icon: PIcon.file, hint: 'One combined paper for all 6 subjects' },
    ] },
    { label: 'Test day', color: '#a7771f', tabs: [
      { id: 'conduct', label: 'Test day', icon: PIcon.shield, hint: 'Checklist, attendance and marks sheets' },
      { id: 'marks', label: 'Marks entry', icon: PIcon.list, hint: 'All subjects, one batch at a time' },
    ] },
    { label: 'Results & prizes', color: '#7c3aed', tabs: [
      { id: 'results', label: 'Results', icon: PIcon.report, hint: 'Rank list, Excel, print' },
      { id: 'analyser', label: 'Analyser', icon: PIcon.chart, hint: 'Subjects, batches, weak areas, progress' },
      { id: 'prizes', label: 'Prizes', icon: PIcon.cap, hint: 'Winners, certificates, ceremony list' },
    ] },
    { label: 'Team', color: '#0e7490', tabs: [
      { id: 'chat', label: 'Group chat', icon: PIcon.whatsapp, hint: 'Messages and files for all teachers' },
      ...(isAdmin ? [{ id: 'audit', label: 'Audit log', icon: PIcon.shield, hint: 'Who changed what, and when (admin)' }] : []),
    ] },
  ]

  // Progress for the flow tracker (Home) and the Back / Next bar.
  const flowProgress = {
    schedule: { done: Math.min(tests.length, DEFAULT_PLAN.count), total: DEFAULT_PLAN.count },
    teachers: { done: SUBJECTS.filter(sb => (panel[sb.label] || []).length).length, total: SUBJECTS.length },
    students: { done: (students || []).length, total: (students || []).length + unplaced.length },
    papers: { done: stats.done, total: papers.length },
    marks: { done: tests.filter(t => (marksCount[t.id] || 0) > 0).length, total: tests.length },
  }
  return (
    <div className="px-root">
      <PremiumStyles />
      <div className="px-wrap" style={{ maxWidth: 1240 }}>
        <PremiumHero isMobile={isMobile} icon={<span style={{ fontSize: isMobile ? 22 : 26 }}>🚀</span>}
          eyebrow="GNSI · Foundation · Udaan & Pragati" title={MISSION_NAME}
          subtitle="8 Monday tests · 7 Dec 2026 – 25 Jan 2027 · teach, set papers, conduct, mark, analyse, award"
          actions={<button className="px-hbtn" onClick={load}>↻ Refresh</button>}
          stats={[
            { label: 'Tests', value: tests.length, sub: `${tests.filter(t => t.test_date < today).length} done` },
            { label: 'Next test', value: stats.next ? fmt(stats.next.test_date) : '—', sub: stats.next ? (papersByTest[stats.next.id] || []).map(p => subjectByLabel(p.subject)?.short || p.subject).join(', ') : 'none planned', tone: PX.goldLt },
            { label: 'Papers approved', value: `${stats.done}/${papers.length}`, sub: 'ready to print', tone: '#86efac' },
            { label: 'Need attention', value: stats.late, sub: 'test day reached, not approved', tone: stats.late ? '#fca5a5' : null },
          ]} />

        {msg && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 90, maxWidth: 'calc(100vw - 32px)', padding: '12px 18px', borderRadius: 14, fontWeight: 700, color: '#fff', background: msg.bad ? PX.bad : PX.ok, boxShadow: '0 12px 30px -10px rgba(0,0,0,.45)' }}>{msg.text}</div>}

        {setupNeeded ? (
          <PremiumCard title="One-time database setup needed" subtitle="The Mission Foundation tables are not in the database yet.">
            <p style={{ margin: 0, lineHeight: 1.6 }}>An admin needs to open the Supabase dashboard → <b>SQL Editor</b>, paste the contents of <code>{SQL_FILE}</code> from the ERP code, and press <b>Run</b>. Then press Refresh above.</p>
          </PremiumCard>
        ) : (
          <>
            <div style={{ margin: '14px 0' }}>
              {tab !== 'home' && <IconTabs groups={groups} active={tab} open onOpen={setTab} onHome={() => setTab('home')} homeLabel="Home" sticky ariaLabel="Mission Foundation sections" />}
            </div>
            {loading ? <PremiumCard><div style={{ color: PX.sub }}>Loading…</div></PremiumCard> : <>
              {tab === 'home' && <>
                <FlowTracker flow={flow} heading="MISSION FLOW · ONE STEP AT A TIME" progress={flowProgress} onGo={setTab} />
                <HomeDashboard {...{ photoOf, tests, ctx: { papersByTest, students, teaching, prizes, marksCount, allMarks }, today, me, isAdmin, papers, testById, setTab, setOpenTest: openWork }} />
                {isAdmin && <div style={{ marginTop: 16 }}><IconTabs groups={groups} active={tab} open={false} onOpen={setTab} ariaLabel="Mission Foundation sections" /></div>}
              </>}
              {tab === 'teaching' && <TeachingTab {...{ tests, testId: activeTest, setTestId: openWork, papersByTest, teaching, setTeaching, savePaper, me, flash, panel, isAdmin }} />}
              {tab === 'conduct' && <ConductTab {...{ tests, testId: activeTest, setTestId: openWork, papersByTest, students, marksCount, saveTest, lockTest, me, isAdmin, flash, setTab }} />}
              {tab === 'prizes' && <PrizesTab {...{ tests, papersByTest, allMarks, prizes, setPrizes, me, flash, today }} />}
              {tab === 'schedule' && <ScheduleTab {...{ photoOf, allPapersByTest, classNames, classRows, batchOptions: [...new Set([...(students || []), ...unplaced].map(x => x.batchName).filter(Boolean))], reloadStudents, tests, papersByTest, panel, today, isAdmin, me, openTest, setOpenTest, savePaper, saveTest, peopleFor, load, flash }} />}
              {tab === 'students' && <StudentsTab {...{ students, unplaced, allMarks, tests, isAdmin, flash, reloadStudents }} />}
              {tab === 'maker' && <QuestionMakerTab key={activeTest || 'none'} {...{ tests, testId: activeTest, setTestId: openWork, papersByTest, me, isAdmin, flash, savePaper, isMobile }} />}
              {tab === 'mine' && <MineTab {...{ photoOf, papers, testById, me, isAdmin, allTeachers, savePaper, today, goMaker: id => { openWork(id); setTab('maker') } }} />}
              {tab === 'teachers' && <TeachersTab {...{ panel, panelFromDb, staffDir, tests, papersByTest, savePaper, isAdmin, me, load, flash }} />}
              {tab === 'marks' && <MarksTab {...{ allPapersByTest, tests, papersByTest, me, flash, students, isAdmin, audit, initialTest: activeTest, onSaved: loadMarks }} />}
              {tab === 'results' && <ResultsTab {...{ allPapersByTest, tests, papersByTest, flash, today }} />}
              {tab === 'analyser' && <AnalyserTab {...{ tests, papersByTest, allMarks, today }} />}
              {tab === 'material' && <MaterialTab {...{ tests, me, isAdmin, flash }} />}
              {tab === 'chat' && <ChatTab {...{ me, isAdmin, flash }} />}
              {tab === 'audit' && isAdmin && <AuditTab {...{ flash }} />}
              <FlowNav flow={flow} home="home" tab={tab} progress={flowProgress} onGo={t => { setTab(t); window.scrollTo?.({ top: 0, behavior: 'smooth' }) }} />
            </>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Schedule & syllabus pattern ──────────────────────────────────────────────
function ScheduleTab({ photoOf, allPapersByTest, classNames, classRows, batchOptions, reloadStudents, tests, papersByTest, panel, today, isAdmin, me, openTest, setOpenTest, savePaper, saveTest, peopleFor, load, flash }) {
  const [gen, setGen] = useState({ start: DEFAULT_PLAN.start, count: DEFAULT_PLAN.count })
  const [busy, setBusy] = useState(false)
  const [showGen, setShowGen] = useState(false)
  const lastNo = tests.reduce((m, t) => Math.max(m, t.test_no), 0)
  const fresh = useMemo(() => buildSchedule({ start: gen.start, count: gen.count, panel, startNo: lastNo + 1, skipDates: tests.map(t => t.test_date) }), [gen.start, gen.count, panel, lastNo, tests])

  const create = async () => {
    if (!fresh.length) return flash('Every Monday in that range already has a test.', true)
    if (!window.confirm(`Create ${fresh.length} tests (${fresh.reduce((n, r) => n + r.papers.length, 0)} papers)? You can change any of them afterwards.`)) return
    setBusy(true)
    const { data, error } = await supabase.from(T_TESTS).insert(fresh.map(r => ({ ...r.test, updated_by: me }))).select('id, test_no')
    if (error) { setBusy(false); return flash('Not created: ' + error.message, true) }
    const idByNo = Object.fromEntries(data.map(d => [d.test_no, d.id]))
    const rows = fresh.flatMap(r => r.papers.map(p => ({ ...p, test_id: idByNo[r.test.test_no], updated_by: me })))
    const res = await supabase.from(T_PAPERS).insert(rows)
    setBusy(false)
    if (res.error) flash('Tests made, but papers failed: ' + res.error.message, true)
    else { flash(`Created ${fresh.length} tests.`); setShowGen(false) }
    load()
  }

  const addTest = async () => {
    const date = window.prompt('Date of the new test (YYYY-MM-DD)', today)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const no = lastNo + 1
    const { data, error } = await supabase.from(T_TESTS).insert({ test_no: no, test_date: date, title: `Test ${String(no).padStart(2, '0')}`, batches: BATCHES, updated_by: me }).select('id').single()
    if (error) return flash('Not added: ' + error.message, true)
    setOpenTest(data.id); load()
  }

  // Calendar file (Google / Apple / Outlook) and a printed schedule of every test.
  const exportIcs = () => downloadFile('Mission_Foundation_schedule.ics', buildIcs(tests.map(t => ({ uid: 'mf-' + t.test_no, date: t.test_date, title: `${t.title || 'Test ' + t.test_no} — ${MISSION_NAME}`, description: `All ${(papersByTest[t.id] || []).length || SUBJECTS.length} subjects · ${(t.batches || BATCHES).join(' & ')}${t.start_time ? ' · ' + t.start_time : ''}` })), MISSION_NAME), 'text/calendar;charset=utf-8')
  const printSchedule = () => printPremium(`<div class="title">${esc(MISSION_NAME)} · Test Schedule</div><div class="sub">${tests.length} tests · ${esc(fmt(tests[0]?.test_date))} to ${esc(fmt(tests[tests.length - 1]?.test_date))}</div>
    <table class="t"><thead><tr><th>Test</th><th>Date</th><th class="l">Chapters by subject</th></tr></thead><tbody>${tests.map(t => `<tr><td><b>${esc(t.title || 'Test ' + t.test_no)}</b></td><td>${esc(fmt(t.test_date))}</td><td class="l" style="font-size:8.5px">${(papersByTest[t.id] || []).map(p => `<b>${esc(subjectByLabel(p.subject)?.short || p.subject)}:</b> ${esc(p.syllabus || '—')}`).join('<br>')}</td></tr>`).join('')}</tbody></table>`,
    { title: `${MISSION_NAME} schedule`, institute: getInstitute(), docLabel: `${MISSION_NAME} schedule`, official: true })

  const byMonth = useMemo(() => {
    const m = []
    tests.forEach(t => { const k = monthOf(t.test_date); const g = m.find(x => x.k === k); if (g) g.list.push(t); else m.push({ k, list: [t] }) })
    return m
  }, [tests])

  return (
    <>
      {isAdmin && <ClassesCard {...{ classNames, classRows, batchOptions, me, load, flash }} />}
      {isAdmin && (
        <PremiumCard title="Create schedule" subtitle="One test every Monday, all 6 subjects"
          right={<Btn kind={showGen ? 'ghost' : 'gold'} onClick={() => setShowGen(v => !v)}>{showGen ? 'Close' : tests.length ? 'Add more days' : 'Create schedule'}</Btn>}>
          {showGen ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
                <label>First Monday<input className="px-input" type="date" value={gen.start} onChange={e => setGen({ ...gen, start: e.target.value })} /></label>
                <label>Number of tests (one a week)<input className="px-input" type="number" min="1" max="52" value={gen.count} onChange={e => setGen({ ...gen, count: e.target.value })} /></label>
              </div>
              <div style={{ color: PX.sub, fontSize: 13.5 }}>
                {fresh.length ? <>Mondays: {fresh.map(r => fmt(r.test.test_date)).join(', ')}. Each test has all 6 subjects; setters take turns within each subject. All 6 subjects are one paper written in one sitting ({DEFAULT_TEST_MINUTES} minutes); each subject starts at {SUBJECTS[0].questions} questions × {SUBJECTS[0].marks_each} marks until you change it.</> : 'Every Monday in that range already has a test.'}
              </div>
              <div><Btn kind="gold" disabled={busy || !fresh.length} onClick={create}>{busy ? 'Creating…' : `Create ${fresh.length} tests`}</Btn></div>
            </div>
          ) : <div style={{ color: PX.sub }}>{tests.length ? `${tests.length} tests from ${fmt(tests[0].test_date)} to ${fmt(tests[tests.length - 1].test_date)}.` : 'No tests yet. Default: 8 Monday tests, 7 Dec 2026 – 25 Jan 2027.'}</div>}
        </PremiumCard>
      )}

      {tests.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}>
          <Btn onClick={exportIcs}>📅 Add to calendar (.ics)</Btn>
          <Btn onClick={printSchedule}>🖨 Print schedule</Btn>
        </div>)}
      {byMonth.map(g => (
        <PremiumCard key={g.k} title={g.k} subtitle={`${g.list.length} tests · tap a test to edit its syllabus pattern and teachers`} bodyStyle={{ padding: 0 }}
          right={isAdmin && g === byMonth[byMonth.length - 1] ? <Btn onClick={addTest}>＋ Add a test</Btn> : null}>
          {g.list.map(t => {
            const ps = papersByTest[t.id] || []
            const open = openTest === t.id
            return (
              <div key={t.id} style={{ borderTop: `1px solid ${PX.line}` }}>
                <button type="button" onClick={() => setOpenTest(open ? null : t.id)} aria-expanded={open}
                  style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px', background: open ? PX.tint : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: PX.ink }}>
                  <span style={{ fontWeight: 800, minWidth: 140 }}>{t.title || `Test ${t.test_no}`}</span>
                  <span style={{ minWidth: 110, color: t.test_date === today ? PX.gold : PX.sub, fontWeight: t.test_date === today ? 800 : 500 }}>{fmt(t.test_date)}</span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>{ps.map(p => <Pill key={p.id} tone={PAPER_TONE[p.status]}>{subjectByLabel(p.subject)?.short || p.subject}</Pill>)}</span>
                  <Pill tone={TEST_TONE[t.status]}>{t.status}</Pill>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                {open && <TestEditor {...{ photoOf, test: t, papers: ps, allPapers: allPapersByTest[t.id] || ps, classNames, tests, papersByTest, isAdmin, me, savePaper, saveTest, peopleFor, panel, load, flash, setOpenTest }} />}
              </div>
            )
          })}
        </PremiumCard>
      ))}
    </>
  )
}

// Admin: which classes (batches) sit the Foundation tests. The name must match the batch name in Students so the live roster finds the students.
function ClassesCard({ classNames, classRows, batchOptions, me, load, flash }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const saved = classRows.length > 0
  const writeList = async names => {
    setBusy(true)
    const rows = names.map((name, i) => ({ name, sort_no: i + 1, created_by: me }))
    let { error } = rows.length ? await supabase.from('mission_foundation_classes').upsert(rows, { onConflict: 'name' }) : { error: null }
    if (!error) {
      const gone = classRows.map(c => c.name).filter(n => !names.includes(n))
      if (gone.length) ({ error } = await supabase.from('mission_foundation_classes').delete().in('name', gone))
    }
    setBusy(false)
    if (error) return flash('Not saved: ' + error.message + ' (run supabase/migrations/20261220_mission_foundation_classes.sql)', true)
    flash('Classes saved.'); load()
  }
  const add = name => { const n = String(name || '').trim(); if (!n) return; if (classNames.some(c => c.toLowerCase() === n.toLowerCase())) return flash(`${n} is already a class.`, true); setText(''); writeList([...classNames, n]) }
  const remove = name => { if (classNames.length <= 1) return flash('Keep at least one class.', true); if (window.confirm(`Remove ${name} from the Foundation classes? Tests keep their marks; the class just stops being offered.`)) writeList(classNames.filter(c => c !== name)) }
  const options = (batchOptions || []).filter(b => !classNames.includes(b)).sort()
  return (
    <PremiumCard title="Classes" subtitle={saved ? 'The classes that sit the Foundation tests. Each can sit the shared paper or its own.' : 'Udaan and Pragati are the built-in classes. Add or change them here; the name must match the batch name in Students.'}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {classNames.map(c => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 99, background: '#fff', border: `1.5px solid ${PX.line}`, fontWeight: 800, color: PX.navy }}>
            {c}<button type="button" aria-label={`Remove class ${c}`} disabled={busy} onClick={() => remove(c)} style={{ border: 0, width: 26, height: 26, borderRadius: '50%', background: '#f1f3f7', cursor: 'pointer', color: PX.sub }}>✕</button>
          </span>))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        {options.length > 0 && <select className="px-input" aria-label="Add a class from Students" value="" disabled={busy} onChange={e => e.target.value && add(e.target.value)} style={{ width: 'auto', minWidth: 190 }}>
          <option value="">＋ Add a batch from Students…</option>{options.map(b => <option key={b} value={b}>{b}</option>)}
        </select>}
        <input className="px-input" aria-label="New class name" placeholder="or type a class name" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add(text)} style={{ width: 200 }} />
        <Btn kind="gold" disabled={busy || !text.trim()} onClick={() => add(text)}>Add class</Btn>
      </div>
    </PremiumCard>
  )
}

function TestEditor({ photoOf = x => x, test, papers, allPapers = papers, classNames = BATCHES, tests, papersByTest, isAdmin, me, savePaper, saveTest, peopleFor, panel, load, flash, setOpenTest }) {
  const [copying, setCopying] = useState(false)
  const [cls, setCls] = useState('')      // '' = the shared paper every class sits; otherwise the class whose own paper is being edited
  const shown = cls ? allPapers.filter(p => p.class_name === cls).sort((a, b) => SUBJECTS.findIndex(x => x.label === a.subject) - SUBJECTS.findIndex(x => x.label === b.subject)) : papers
  const missing = SUBJECTS.filter(s => !shown.some(p => p.subject === s.label))
  const totalMax = shown.reduce((n, p) => n + maxMarks(p), 0)
  const classHas = c => allPapers.some(p => p.class_name === c)
  // A separate paper for one class: starts as a copy of the shared paper, then each subject can be edited on its own.
  const makeClassPaper = async () => {
    const rows = copyForClass(papers, cls, allPapers).map(r => ({ ...r, updated_by: me }))
    if (!rows.length) return flash(`${cls} already has every subject.`, true)
    const { error } = await supabase.from(T_PAPERS).insert(rows)
    if (error) flash('Not created: ' + error.message + ' (run supabase/migrations/20261220_mission_foundation_classes.sql)', true); else { flash(`${rows.length} paper${rows.length === 1 ? '' : 's'} created for ${cls}.`); load() }
  }
  const addPaper = async label => {
    const s = subjectByLabel(label); const setter = (panel[label] || [])[0] || ''
    const { error } = await supabase.from(T_PAPERS).insert({ test_id: test.id, subject: label, class_name: cls, questions: s.questions, marks_each: s.marks_each, setter, verifier: setter ? checkerFor(label, setter, panel) : '', updated_by: me })
    if (error) flash('Not added: ' + error.message, true); else load()
  }
  const delPaper = async p => {
    if (!window.confirm(`Remove the ${p.subject} paper from ${test.title}? Its marks are kept only if you add it back the same day.`)) return
    const { error } = await supabase.from(T_PAPERS).delete().eq('id', p.id)
    if (error) flash('Not removed: ' + error.message, true); else load()
  }
  const delTest = async () => {
    if (!window.confirm(`Delete ${test.title} with all its papers and marks? This cannot be undone.`)) return
    const { error } = await supabase.from(T_TESTS).delete().eq('id', test.id)
    if (error) flash('Not deleted: ' + error.message, true); else { setOpenTest(null); load() }
  }
  const toggleBatch = b => {
    const cur = test.batches || []
    saveTest(test.id, { batches: cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b] })
  }
  return (
    <div style={{ padding: '6px 18px 18px', background: PX.tint }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 12 }}>
        <label>Title<BlurField label="Title" value={test.title} onSave={v => saveTest(test.id, { title: v })} /></label>
        <label>Date<input className="px-input" type="date" value={test.test_date} onChange={e => e.target.value && saveTest(test.id, { test_date: e.target.value })} style={{ padding: '7px 10px' }} /></label>
        <label>Total time (minutes)<BlurField type="number" label="Total time in minutes" value={test.duration_min} onSave={v => saveTest(test.id, { duration_min: v })} /></label>
        <label>Status<select className="px-input" value={test.status} onChange={e => saveTest(test.id, { status: e.target.value })} style={{ padding: '7px 10px' }}>{TEST_FLOW.map(s => <option key={s}>{s}</option>)}</select></label>
        <div>Batches<div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>{BATCHES.map(b => <label key={b} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={(test.batches || []).includes(b)} onChange={() => toggleBatch(b)} />{b}</label>)}</div></div>
      </div>
      <div data-ti-skip role="tablist" aria-label="Paper for" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub, marginRight: 4 }}>Paper for</span>
        {[['', 'All classes (same paper)'], ...(test.batches || classNames).filter(b => classNames.includes(b)).map(b => [b, b + (classHas(b) ? ' · own paper' : '')])].map(([k, l]) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={cls === k} onClick={() => setCls(k)}
            style={{ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${cls === k ? PX.navy : PX.line}`, background: cls === k ? PX.navy : '#fff', color: cls === k ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>))}
      </div>
      {cls && (
        <div role="note" style={{ margin: '0 0 10px', padding: '9px 12px', borderRadius: 12, background: '#f3f8ff', border: '1px solid #c9dcf7', fontSize: 13, color: PX.ink, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 260px' }}>{classHas(cls) ? <>This is <b>{cls}</b>'s own paper: its own chapters, questions, marks, setters and checker. Subjects without their own paper use the shared one.</> : <><b>{cls}</b> sits the shared paper. Make a separate paper if this class needs different chapters, marks or setters.</>}</span>
          {isAdmin && <Btn kind="gold" onClick={makeClassPaper}>{classHas(cls) ? 'Copy missing subjects' : `Make a separate paper for ${cls}`}</Btn>}
        </div>)}
      <div style={{ overflowX: 'auto' }}>
        <table className="px-table" style={{ width: '100%', minWidth: 1180, background: '#fff' }}>
          <thead><tr><th>Subject</th><th style={{ minWidth: 220 }}>Syllabus (chapters)</th><th>Qs</th><th>Marks each</th><th>Max</th><th style={{ minWidth: 150 }}>Setters (1 or 2)</th><th>Checker</th><th>Status</th><th>Paper link</th><th /></tr></thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.subject}{p.class_name ? <div style={{ fontSize: 11, color: PX.sub, fontWeight: 600 }}>{p.class_name}</div> : null}</td>
                <td><BlurField label={`${p.subject} syllabus`} placeholder="e.g. Fractions; Decimals" value={p.syllabus} onSave={v => savePaper(p.id, { syllabus: v })} /></td>
                <td><BlurField type="number" width={64} label="Questions" value={p.questions} onSave={v => savePaper(p.id, { questions: v })} /></td>
                <td><BlurField type="number" width={64} label="Marks each" value={p.marks_each} onSave={v => savePaper(p.id, { marks_each: v })} /></td>
                <td style={{ fontWeight: 700 }}>{maxMarks(p) || '—'}</td>
                <td>
                  <div style={{ display: 'grid', gap: 6, minWidth: 190 }}>
                    <WithFace name={p.setter} photoOf={photoOf}><PersonSelect label="Setter" value={p.setter} options={peopleFor(p.subject)} onChange={v => savePaper(p.id, { setter: v, ...(p.setter2 === v ? { setter2: null } : {}), verifier: p.verifier && p.verifier !== v ? p.verifier : checkerFor(p.subject, v, panel) })} /></WithFace>
                    <WithFace name={p.setter2} photoOf={photoOf}><PersonSelect label="Second setter" value={p.setter2} emptyLabel="＋ 2nd setter" options={peopleFor(p.subject).filter(n => n !== p.setter)} onChange={v => savePaper(p.id, { setter2: v || null })} /></WithFace>
                  </div>
                </td>
                <td><WithFace name={p.verifier} photoOf={photoOf}><PersonSelect label="Checker" value={p.verifier} options={peopleFor(p.subject).filter(n => !settersOf(p).includes(n))} onChange={v => savePaper(p.id, { verifier: v })} /></WithFace></td>
                <td><select className="px-input" aria-label="Paper status" value={p.status} onChange={e => savePaper(p.id, { status: e.target.value })} style={{ padding: '7px 10px', minWidth: 116 }}>{PAPER_FLOW.map(s => <option key={s}>{s}</option>)}</select></td>
                <td><BlurField label="Paper link" width={170} placeholder="https://…" value={p.paper_link} onSave={v => { const u = v ? safeUrl(v) : ''; if (v && !u) return flash('Use a full https:// link.', true); savePaper(p.id, { paper_link: u }) }} /></td>
                <td>{isAdmin && <button type="button" aria-label={`Remove ${p.subject}`} className="px-btn ghost" onClick={() => delPaper(p)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <span style={{ color: PX.sub, fontSize: 13.5 }}>Full marks: <b>{totalMax}</b> · Time: <b>{test.duration_min || '—'} min</b> for all {shown.length} subjects in one sitting</span>
        {missing.length > 0 && <select className="px-input" aria-label="Add a subject" value="" onChange={e => e.target.value && addPaper(e.target.value)} style={{ width: 'auto', padding: '7px 10px' }}>
          <option value="">＋ Add a subject…</option>{missing.map(s => <option key={s.key} value={s.label}>{s.label}</option>)}
        </select>}
        <span style={{ flex: 1 }} />
        {papers.length > 0 && tests.length > 1 && <Btn kind={copying ? 'ghost' : 'gold'} onClick={() => setCopying(v => !v)}>{copying ? 'Close copy' : '⧉ Copy this format to other tests'}</Btn>}
        {isAdmin && <Btn onClick={delTest} style={{ color: PX.bad }}>Delete this test</Btn>}
      </div>
      {copying && <CopyFormat {...{ test, papers, tests, papersByTest, me, load, flash, onDone: () => setCopying(false) }} />}
      <div style={{ marginTop: 10 }}>
        <BlurField label="Notes" placeholder="Notes for teachers (room, timing, instructions)…" value={test.notes} onSave={v => saveTest(test.id, { notes: v })} />
      </div>
    </div>
  )
}

// Copy one test's paper format (questions, marks, minutes; optionally teachers and chapters) to other tests.
function CopyFormat({ test, papers, tests, papersByTest, me, load, flash, onDone }) {
  const others = tests.filter(t => t.id !== test.id)
  const [picked, setPicked] = useState(() => Object.fromEntries(others.map(t => [t.id, t.test_date >= test.test_date])))
  const [opts, setOpts] = useState({ pattern: true, teachers: false, syllabus: false })
  const [busy, setBusy] = useState(false)
  const chosen = others.filter(t => picked[t.id])
  const plan = copyFormatPlan(papers, chosen.map(t => ({ test_id: t.id, papers: papersByTest[t.id] || [] })), opts)
  const run = async () => {
    if (!chosen.length) return flash('Tick at least one test.', true)
    if (!opts.pattern && !opts.teachers && !opts.syllabus) return flash('Choose what to copy.', true)
    if (!window.confirm(`Copy ${test.title}'s format to ${chosen.length} test(s)? ${plan.updates.length} paper(s) will change${plan.inserts.length ? ` and ${plan.inserts.length} added` : ''}.`)) return
    setBusy(true)
    const stamp = { updated_by: me, updated_at: now() }
    const timeTargets = opts.pattern && test.duration_min ? chosen.filter(t => t.duration_min !== test.duration_min) : []
    const results = await Promise.all([
      ...timeTargets.map(t => supabase.from(T_TESTS).update({ duration_min: test.duration_min, ...stamp }).eq('id', t.id)),
      ...plan.updates.map(u => supabase.from(T_PAPERS).update({ ...u.patch, ...stamp }).eq('id', u.id)),
      ...(plan.inserts.length ? [supabase.from(T_PAPERS).insert(plan.inserts.map(r => ({ ...r, ...stamp })))] : []),
    ])
    setBusy(false)
    const bad = results.find(r => r.error)
    if (bad) flash('Some papers were not copied: ' + bad.error.message, true)
    else { flash(`Copied to ${chosen.length} test(s).${plan.skipped ? ` ${plan.skipped} approved paper(s) were left as they are.` : ''}`); onDone() }
    load()
  }
  const all = v => setPicked(Object.fromEntries(others.map(t => [t.id, v])))
  return (
    <div style={{ marginTop: 12, padding: 16, borderRadius: 16, background: '#fff', border: `1.5px solid ${PX.goldLine}` }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Copy {test.title}'s format</div>
      <div style={{ fontSize: 13.5, color: PX.sub, marginBottom: 10 }}>Every subject of the tests you tick gets the same setup as this test. Approved papers are not changed.</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['pattern', 'Questions, marks and total time'], ['teachers', 'Setters and checkers'], ['syllabus', 'Syllabus chapters']].map(([k, l]) => (
          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, minHeight: 40 }}><input type="checkbox" checked={opts[k]} onChange={e => setOpts({ ...opts, [k]: e.target.checked })} />{l}</label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 13.5 }}>To these tests:</b>
        <button type="button" className="px-btn ghost" onClick={() => all(true)}>All</button>
        <button type="button" className="px-btn ghost" onClick={() => all(false)}>None</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {others.map(t => (
          <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 12, border: `1px solid ${picked[t.id] ? PX.gold : PX.line}`, background: picked[t.id] ? PX.goldBg : PX.tint, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!picked[t.id]} onChange={e => setPicked({ ...picked, [t.id]: e.target.checked })} />
            <span><b>{t.title || 'Test ' + t.test_no}</b> <span style={{ color: PX.sub, fontSize: 12.5 }}>{fmt(t.test_date)}</span></span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <Btn kind="gold" disabled={busy || !chosen.length} onClick={run}>{busy ? 'Copying…' : `Copy to ${chosen.length} test${chosen.length === 1 ? '' : 's'}`}</Btn>
        <span style={{ fontSize: 13, color: PX.sub }}>{plan.updates.length} paper(s) will change{plan.inserts.length ? `, ${plan.inserts.length} added` : ''}{plan.skipped ? `, ${plan.skipped} approved left alone` : ''}.</span>
      </div>
    </div>
  )
}

// ─── My papers (teacher workspace) ────────────────────────────────────────────
function MineTab({ photoOf = x => x, papers, testById, me, isAdmin, allTeachers, savePaper, today, goMaker }) {
  const [who, setWho] = useState('')
  // The paper and its syllabus come from the questions the staff made in Question maker: count and topics per test + subject.
  const [made, setMade] = useState({})
  const testIds = [...new Set(papers.map(p => p.test_id))].join(',')
  useEffect(() => {
    if (!testIds) return
    let live = true
    fetchAll(() => supabase.from('mission_foundation_questions').select('test_id, subject, topic').in('test_id', testIds.split(',')).order('id'))
      .then(({ data }) => {
        if (!live || !data) return
        const m = {}
        data.forEach(q => { const k = q.test_id + '|' + q.subject; const e = m[k] || (m[k] = { n: 0, topics: [] }); e.n++; const t = String(q.topic || '').replace(/;/g, ',').trim(); if (t && !e.topics.some(x => x.toLowerCase() === t.toLowerCase())) e.topics.push(t) })
        setMade(m)
      }, () => {})
    return () => { live = false }
  }, [testIds])
  const person = who || me
  const mine = papers.filter(p => isSetter(person, p) || nameMatches(person, p.verifier) || (who && (settersOf(p).includes(who) || p.verifier === who)))
    .map(p => ({ ...p, test: testById[p.test_id] })).filter(p => p.test)
    .sort((a, b) => a.test.test_date.localeCompare(b.test.test_date))
  const open = mine.filter(p => p.status !== 'Approved')
  const done = mine.filter(p => p.status === 'Approved')
  const row = p => {
    const setter = isSetter(person, p) || settersOf(p).includes(who)
    const checker = nameMatches(person, p.verifier) || p.verifier === who
    const late = p.status !== 'Approved' && p.test.test_date <= today
    return (
      <div key={p.id} style={{ display: 'grid', gap: 8, padding: 14, borderTop: `1px solid ${PX.line}` }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <b>{p.subject}</b><span style={{ color: PX.sub }}>{p.test.title} · {fmt(p.test.test_date)}</span>
          <Pill tone={late ? 'bad' : PAPER_TONE[p.status]}>{late ? 'Due · ' + p.status : p.status}</Pill>
          <span style={{ color: PX.sub, fontSize: 13 }}>{setter ? 'You set this' : ''}{setter && checker ? ' · ' : ''}{checker ? `You check this (setter ${p.setter || '—'})` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}><Faces label={settersOf(p).length > 1 ? 'Setters' : 'Setter'} names={settersOf(p)} photoOf={photoOf} /><Faces label="Checker" names={[p.verifier]} photoOf={photoOf} /></div>
        <div style={{ fontSize: 13.5, color: PX.ink2 }}>Pattern: {p.questions || '?'} questions × {p.marks_each || '?'} marks = {maxMarks(p) || '?'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          <div>Syllabus
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {(made[p.test_id + '|' + p.subject]?.topics || []).map(t => <Pill key={t} tone="ok">{t}</Pill>)}
              {!(made[p.test_id + '|' + p.subject]?.topics || []).length && <span style={{ color: PX.sub, fontSize: 13 }}>{p.syllabus || 'Comes from the topics of the questions made in Question maker.'}</span>}
            </div>
          </div>
          <div>Question paper
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              <Pill tone={(made[p.test_id + '|' + p.subject]?.n || 0) >= (Number(p.questions) || 1) ? 'ok' : 'warn'}>{made[p.test_id + '|' + p.subject]?.n || 0} / {p.questions || '?'} questions made</Pill>
              <Btn onClick={() => goMaker(p.test_id)}>{setter ? 'Open Question maker' : 'View questions'}</Btn>
            </div>
          </div>
          <label>Remarks<BlurField label="Remarks" value={p.remarks} onSave={v => savePaper(p.id, { remarks: v })} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {p.paper_link && <a className="px-btn ghost" href={safeUrl(p.paper_link)} target="_blank" rel="noreferrer">Open paper</a>}
          {setter && p.status === 'Pending' && <Btn kind="gold" onClick={() => savePaper(p.id, { status: 'Submitted', ...((made[p.test_id + '|' + p.subject]?.topics || []).length ? { syllabus: made[p.test_id + '|' + p.subject].topics.join('; ') } : {}) })}>Submit for checking</Btn>}
          {checker && p.status === 'Submitted' && <><Btn kind="gold" onClick={() => savePaper(p.id, { status: 'Checked' })}>Mark checked</Btn><Btn onClick={() => savePaper(p.id, { status: 'Pending' })}>Send back to setter</Btn></>}
          {isAdmin && p.status === 'Checked' && <Btn kind="gold" onClick={() => savePaper(p.id, { status: 'Approved' })}>Approve</Btn>}
        </div>
      </div>
    )
  }
  return (
    <>
      {isAdmin && (
        <PremiumCard title="See a teacher's papers" right={<select className="px-input" aria-label="Teacher" value={who} onChange={e => setWho(e.target.value)} style={{ width: 'auto' }}><option value="">Me ({me || 'unknown'})</option>{allTeachers.map(n => <option key={n} value={n}>{titled(n)}</option>)}</select>} />
      )}
      <PremiumCard title={`To do · ${open.length}`} subtitle="Set the paper, add the link, submit; the checker marks it checked; an admin approves" bodyStyle={{ padding: 0 }}>
        {open.length ? open.map(row) : <div style={{ padding: 20, color: PX.sub }}>{mine.length ? 'All your papers are approved. 🎉' : 'No papers are assigned to this name. Ask an admin to add you in the Teachers tab.'}</div>}
      </PremiumCard>
      {done.length > 0 && <PremiumCard title={`Approved · ${done.length}`} bodyStyle={{ padding: 0 }}>{done.map(row)}</PremiumCard>}
    </>
  )
}

// ─── Teachers (subject panel) ─────────────────────────────────────────────────
function TeachersTab({ panel, panelFromDb, staffDir, tests, papersByTest, savePaper, isAdmin, me, load, flash }) {
  const [picking, setPicking] = useState(null)   // subject whose teacher picker is open
  const staffOpts = useMemo(() => staffOptions(staffDir), [staffDir])
  const [open, setOpen] = useState(null)      // subject whose test-by-test plan is open
  const [busy, setBusy] = useState('')
  const short = t => String(t?.test_no ?? '').padStart(2, '0')
  // Counted per subject, so a teacher in two subjects shows each subject's own share.
  const bySubject = useMemo(() => {
    const m = {}
    tests.forEach(t => (papersByTest[t.id] || []).forEach(p => {
      const row = (m[p.subject] ||= [])
      row.push({ ...p, test: t })
    }))
    return m
  }, [tests, papersByTest])
  const share = (subject, teacher) => {
    const rows = bySubject[subject] || []
    const isMe = n => cleanTeacherName(n).toLowerCase() === cleanTeacherName(teacher).toLowerCase()
    return { set: rows.filter(r => isMe(r.setter)), check: rows.filter(r => isMe(r.verifier)) }
  }
  const saveDefaults = async () => {
    const rows = Object.entries(DEFAULT_PANEL).flatMap(([subject, list]) => list.map(teacher => ({ subject, teacher, created_by: me })))
    const { error } = await supabase.from(T_PANEL).upsert(rows, { onConflict: 'subject,teacher' })
    if (error) flash('Not saved: ' + error.message, true); else { flash('Teacher list saved.'); load() }
  }
  // Pick-from-staff: add several teachers to one subject at once (skips anyone already there).
  const addTeachers = async (subject, tokens) => {
    const have = new Set((panel[subject] || []).map(t => cleanTeacherName(t).toLowerCase()))
    const fresh = [...new Set(tokens.map(cleanTeacherName).filter(Boolean))].filter(n => !have.has(n.toLowerCase()))
    if (!fresh.length) return flash('They are already in ' + subject + '.', true)
    const base = panelFromDb ? [] : Object.entries(DEFAULT_PANEL).flatMap(([sub, l]) => l.map(t => ({ subject: sub, teacher: t, created_by: me })))
    const { error } = await supabase.from(T_PANEL).upsert([...base, ...fresh.map(teacher => ({ subject, teacher, created_by: me }))], { onConflict: 'subject,teacher' })
    if (error) return flash('Not added: ' + error.message, true)
    setPicking(null); setOpen(subject)
    flash(`${fresh.map(titled).join(', ')} added to ${subject}. Give them tests below, or press "Share tests evenly".`)
    load()
  }
  const remove = async (subject, teacher) => {
    if (!panelFromDb) return flash('Press "Save this list" first.', true)
    const { set, check } = share(subject, teacher)
    if ((set.length || check.length) && !window.confirm(`${titled(teacher)} still sets ${set.length} and checks ${check.length} ${subject} paper(s). Remove from the list anyway? (Those papers keep the name until you change them.)`)) return
    const { error } = await supabase.from(T_PANEL).delete().eq('subject', subject).eq('teacher', teacher)
    if (error) flash('Not removed: ' + error.message, true); else load()
  }
  const shareEvenly = async subject => {
    const plan = shareTests(bySubject[subject] || [], (panel[subject] || []).map(cleanTeacherName), panel)
    if (!plan.length) return flash('No papers to share yet. Create the schedule first.', true)
    if (!window.confirm(`Share ${plan.length} ${subject} paper(s) in turn between ${(panel[subject] || []).map(titled).join(', ')}? Approved papers stay as they are.`)) return
    setBusy(subject)
    for (const p of plan) await savePaper(p.id, { setter: p.setter, verifier: p.verifier })
    setBusy('')
    flash(`${subject}: tests shared between ${(panel[subject] || []).length} teacher(s).`)
  }
  // Give a teacher a number of tests to set: the next N papers (in test order) not yet approved and not already theirs.
  const giveCount = async (subject, teacher, n) => {
    const rows = (bySubject[subject] || []).filter(r => r.status !== 'Approved')
    const isMe = x => cleanTeacherName(x).toLowerCase() === cleanTeacherName(teacher).toLowerCase()
    const have = rows.filter(r => isMe(r.setter))
    const want = Math.max(0, Math.min(rows.length, Number(n) || 0))
    if (want === have.length) return
    setBusy(subject)
    if (want > have.length) {
      // take tests from whoever sets the most, latest tests first, so earlier work already started is not moved
      const others = rows.filter(r => !isMe(r.setter))
      const load2 = {}; others.forEach(r => { load2[r.setter] = (load2[r.setter] || 0) + 1 })
      const pick = [...others].sort((a, b) => (load2[b.setter] || 0) - (load2[a.setter] || 0) || String(b.test.test_date).localeCompare(String(a.test.test_date))).slice(0, want - have.length)
      for (const r of pick) {
        const verifier = isMe(r.verifier) ? r.setter : r.verifier
        await savePaper(r.id, { setter: cleanTeacherName(teacher), verifier })
      }
    } else {
      const team = (panel[subject] || []).map(cleanTeacherName).filter(t => !isMe(t))
      if (!team.length) { setBusy(''); return flash('Add another teacher to this subject first.', true) }
      const give = [...have].sort((a, b) => String(b.test.test_date).localeCompare(String(a.test.test_date))).slice(0, have.length - want)
      for (const [i, r] of give.entries()) await savePaper(r.id, { setter: team[i % team.length] })
    }
    setBusy('')
    flash(`${titled(teacher)} now sets ${want} ${subject} test(s).`)
  }
  return (
    <>
      {!panelFromDb && (
        <PremiumCard title="Teachers from the timetable" subtitle="These are the Udaan and Pragati teachers on the current timetable. Save the list to start editing it."
          right={isAdmin ? <Btn kind="gold" onClick={saveDefaults}>Save this list</Btn> : null} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        {SUBJECTS.map(s => {
          const team = panel[s.label] || []
          const rows = bySubject[s.label] || []
          return (
            <PremiumCard key={s.key} title={s.label} subtitle={`${team.length} teacher(s) · ${rows.length} test(s) · default ${s.questions} Qs × ${s.marks_each} marks`} style={{ marginBottom: 0 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                {team.map(t => {
                  const sh = share(s.label, t)
                  return (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PersonCell name={cleanTeacherName(t)} photoName={staffNameFor(cleanTeacherName(t), staffOpts)} sub={`Sets ${sh.set.length}${sh.set.length ? ' (' + sh.set.map(r => short(r.test)).join(', ') + ')' : ''} · checks ${sh.check.length}`}>{titled(t)}</PersonCell>
                      <span style={{ flex: 1 }} />
                      {isAdmin && rows.length > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: PX.sub }}>Tests
                          <select className="px-input" aria-label={`Number of ${s.label} tests ${titled(t)} sets`} value={sh.set.length} disabled={busy === s.label}
                            onChange={e => giveCount(s.label, t, e.target.value)} style={{ width: 'auto', padding: '5px 8px' }}>
                            {Array.from({ length: rows.length + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </label>
                      )}
                      {isAdmin && <button type="button" className="px-btn ghost" aria-label={`Remove ${t} from ${s.label}`} onClick={() => remove(s.label, t)}>✕</button>}
                    </div>
                  )
                })}
                {isAdmin && (picking === s.label
                  ? <div style={{ display: 'grid', gap: 6 }}>
                      <TeacherPicker staff={staffDir} taken={(panel[s.label] || []).map(cleanTeacherName)} onAdd={t => addTeachers(s.label, t)} addLabel="Add to panel" autoFocus />
                      <Btn onClick={() => setPicking(null)}>Cancel</Btn>
                    </div>
                  : <Btn kind="gold" onClick={() => setPicking(s.label)}>＋ Pick teachers</Btn>)}
                {isAdmin && rows.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn onClick={() => setOpen(o => (o === s.label ? null : s.label))}>{open === s.label ? 'Hide tests' : '🗓 Test by test'}</Btn>
                    {team.length > 1 && <Btn onClick={() => shareEvenly(s.label)} disabled={busy === s.label}>⇄ Share tests evenly</Btn>}
                  </div>
                )}
                {open === s.label && (
                  <div style={{ border: `1px solid ${PX.line}`, borderRadius: 12, overflow: 'hidden' }}>
                    {rows.map(r => {
                      const people = [...new Set([...team.map(cleanTeacherName), cleanTeacherName(r.setter), cleanTeacherName(r.verifier)].filter(Boolean))]
                      const locked = r.status === 'Approved'
                      return (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr', gap: 6, alignItems: 'center', padding: '6px 8px', borderTop: `1px solid ${PX.line}`, fontSize: 13 }}>
                          <b title={fmt(r.test.test_date)}>T{short(r.test)}</b>
                          <select className="px-input" aria-label={`Setter of ${s.label} test ${short(r.test)}`} disabled={locked} value={cleanTeacherName(r.setter)} onChange={e => savePaper(r.id, { setter: e.target.value })} style={{ padding: '5px 6px' }}>
                            <option value="">Setter…</option>{people.map(n => <option key={n} value={n}>Sets: {titled(n)}</option>)}
                          </select>
                          <select className="px-input" aria-label={`Checker of ${s.label} test ${short(r.test)}`} disabled={locked} value={cleanTeacherName(r.verifier)} onChange={e => savePaper(r.id, { verifier: e.target.value })} style={{ padding: '5px 6px' }}>
                            <option value="">Checker…</option>{people.map(n => <option key={n} value={n}>Checks: {titled(n)}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </PremiumCard>
          )
        })}
      </div>
      <p style={{ color: PX.sub, fontSize: 13, marginTop: 12 }}>Type the first name as in the teacher's ERP login (for example "Roshan"), so their papers show up in <b>My papers</b>. Use <b>Tests</b> to choose how many tests a teacher sets, <b>Test by test</b> to pick exactly which, or <b>Share tests evenly</b> to split them in turn. Approved papers are never moved.</p>
    </>
  )
}

// ─── Marks entry ──────────────────────────────────────────────────────────────
const pickDefaultTest = (tests, today) => [...tests].reverse().find(t => t.test_date <= today) || tests[0]

const markKey = (sid, subj) => `${sid}|${subj}`

function MarksTab({ allPapersByTest, tests, papersByTest, me, flash, students, isAdmin, audit, initialTest, onSaved }) {
  const [testId, setTestId] = useState(initialTest || tests[0]?.id || '')
  const [batch, setBatch] = useState(BATCHES[0])     // a batch, or 'Both'
  const [subjectPick, setSubjectPick] = useState(null)  // null = not chosen yet (default below), 'all', or a subject label
  const [entries, setEntries] = useState({})   // `${student_id}|${subject}` → { marks, absent }
  const [changed, setChanged] = useState(() => new Set())   // keys typed since the last save
  const dirty = changed.size > 0
  const [busy, setBusy] = useState(false)
  // A class that has its own paper for a subject is marked out of that paper; every other class sits the shared paper.
  const testPapers = useMemo(() => (batch !== 'Both' && allPapersByTest ? papersForClass(allPapersByTest[testId] || [], batch) : papersByTest[testId] || []), [papersByTest, allPapersByTest, testId, batch])
  // A teacher who sets exactly one subject of this test opens on that subject; everyone else on the full sheet.
  const mine = testPapers.filter(p => isSetter(me, p))
  const subject = subjectPick ?? (mine.length === 1 ? mine[0].subject : 'all')
  const single = subject !== 'all' && testPapers.some(p => p.subject === subject)
  const papers = useMemo(() => (single ? testPapers.filter(p => p.subject === subject) : testPapers), [single, testPapers, subject])
  const list = (students || []).filter(s => (batch === 'Both' ? BATCHES.includes(s.batchName) : s.batchName === batch))
  const filled = single ? list.filter(s => { const e = entries[markKey(s.id, subject)]; return e && (e.absent || (e.marks !== '' && e.marks != null)) }).length : 0
  const nextBox = (i) => { const el = document.querySelector(`[data-mark-row="${i + 1}"]`); if (el) { el.focus(); el.select?.() } }

  useEffect(() => {
    if (!testId) { setEntries({}); return }
    let live = true
    supabase.from(T_MARKS).select('student_id, subject, marks, absent').eq('test_id', testId).then(({ data, error }) => {
      if (!live) return
      if (error) flash('Could not load marks: ' + error.message, true)
      setEntries(Object.fromEntries((data || []).map(r => [markKey(r.student_id, r.subject), { marks: r.marks ?? '', absent: r.absent }])))
      setChanged(new Set())
    })
    return () => { live = false }
  }, [testId, flash])

  // Saving covers every subject and both batches, so switching subject or batch never loses typed marks.
  const everyone = (students || []).filter(s => BATCHES.includes(s.batchName))
  const errors = everyone.flatMap(s => testPapers.map(p => markError(entries[markKey(s.id, p.subject)]?.marks, maxMarks(p)))).filter(Boolean).length
  const save = async () => {
    if (tests.find(t => t.id === testId)?.locked && !isAdmin) return flash('This test is locked. Ask an admin to unlock it.', true)
    if (errors) return flash(`Fix ${errors} mark(s) first: each must be from 0 to the paper's full marks.`, true)
    const rows = everyone.flatMap(s => testPapers.map(p => {
      if (!changed.has(markKey(s.id, p.subject))) return null
      const e = entries[markKey(s.id, p.subject)]
      if (!e || (!e.absent && (e.marks === '' || e.marks === null))) return null
      return { test_id: testId, student_id: String(s.id), gcc_no: s.gcc_no ? String(s.gcc_no) : null, student_name: s.name, batch: s.batchName, subject: p.subject,
        marks: e.absent ? null : Number(e.marks), absent: !!e.absent, entered_by: me, updated_at: now() }
    })).filter(Boolean)
    if (!rows.length) return flash('Nothing to save yet.', true)
    setBusy(true)
    const { error } = await supabase.from(T_MARKS).upsert(rows, { onConflict: 'test_id,student_id,subject' })
    setBusy(false)
    if (error) flash('Not saved: ' + error.message, true); else { setChanged(new Set()); audit?.('marks_save', tests.find(t => t.id === testId)?.title || testId, { rows: rows.length, batch, subject: single ? subject : 'all' }); flash(`Saved ${rows.length} marks${single ? ' in ' + subject : ''} for ${batch === 'Both' ? 'Udaan and Pragati' : batch}.`); onSaved?.() }
  }
  const set = (sid, subj, patch) => { setChanged(c => new Set(c).add(markKey(sid, subj))); setEntries(e => ({ ...e, [markKey(sid, subj)]: { marks: '', absent: false, ...e[markKey(sid, subj)], ...patch } })) }
  const absentAll = (sid, on) => papers.forEach(p => set(sid, p.subject, { absent: on }))

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  return (
    <PremiumCard title={single ? `Enter marks · ${subject}` : 'Enter marks'} subtitle={single ? 'One subject for every student. Type a mark and press Enter to go to the next student. Empty boxes are not saved.' : 'All subjects of the test for one batch. Empty boxes are not saved. Tick AB for a student absent from the whole test.'} bodyStyle={{ padding: 0 }}
      right={<Btn kind="gold" disabled={busy || !papers.length} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save marks •' : 'Save marks'}</Btn>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px' }}>
        <select className="px-input" aria-label="Test" value={testId} onChange={e => { if (!dirty || window.confirm('Leave without saving?')) setTestId(e.target.value) }} style={{ width: 'auto' }}>
          {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
        </select>
        <select className="px-input" aria-label="Batch" value={batch} onChange={e => setBatch(e.target.value)} style={{ width: 'auto' }}>{BATCHES.map(b => <option key={b}>{b}</option>)}<option value="Both">Both batches</option></select>
        <div role="group" aria-label="Subject" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All subjects' }, ...testPapers.map(p => ({ key: p.subject, label: subjectByLabel(p.subject)?.short || p.subject }))].map(o => (
            <button key={o.key} type="button" className={'px-btn ' + (subject === o.key || (o.key === 'all' && !single) ? 'gold' : 'ghost')} aria-pressed={subject === o.key}
              onClick={() => setSubjectPick(o.key)}>{o.label}</button>
          ))}
        </div>
        {single && list.length > 0 && <span style={{ alignSelf: 'center', fontSize: 13, color: filled === list.length ? PX.ok : PX.sub, fontWeight: 700 }}>{filled} / {list.length} entered</span>}
      </div>
      {!papers.length ? <div style={{ padding: 20, color: PX.sub }}>This test has no papers.</div>
        : students === null ? <div style={{ padding: 20, color: PX.sub }}>Loading students…</div>
        : !list.length ? <div style={{ padding: 20, color: PX.sub }}>No active students found in {batch}.</div> : single ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ width: '100%' }}>
              <thead><tr><th>#</th><th>Student</th>{batch === 'Both' && <th>Batch</th>}<th>{subject} /{maxMarks(papers[0]) || '?'}</th><th>Absent</th></tr></thead>
              <tbody>
                {list.map((s, i) => {
                  const p = papers[0]
                  const e = entries[markKey(s.id, p.subject)] || { marks: '', absent: false }
                  const err = markError(e.marks, maxMarks(p))
                  return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}<div style={{ fontSize: 11.5, color: PX.sub, fontWeight: 500 }}>{s.gcc_no ? 'GCC ' + s.gcc_no : ''}</div></td>
                      {batch === 'Both' && <td><Pill tone={s.batchName === 'Udaan' ? 'info' : 'gold'}>{s.batchName}</Pill></td>}
                      <td>
                        <input className="px-input" type="number" inputMode="decimal" min="0" max={maxMarks(p) || undefined} data-mark-row={i} aria-label={`${p.subject} marks for ${s.name}`} title={err || undefined}
                          disabled={e.absent} placeholder={e.absent ? 'AB' : ''} value={e.absent ? '' : e.marks}
                          onChange={ev => set(s.id, p.subject, { marks: ev.target.value })}
                          onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); nextBox(i) } }}
                          style={{ width: 90, padding: '7px 10px', fontSize: 15, borderColor: err ? PX.bad : undefined, background: err ? PX.badBg : undefined }} />
                        {err && <div style={{ fontSize: 11.5, color: PX.bad }}>{err}</div>}
                      </td>
                      <td><input type="checkbox" aria-label={`${s.name} absent`} checked={!!e.absent} onChange={ev => set(s.id, p.subject, { absent: ev.target.checked })} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ width: '100%', minWidth: 760 }}>
              <thead><tr><th>#</th><th>Student</th>{papers.map(p => <th key={p.id}>{subjectByLabel(p.subject)?.short || p.subject} /{maxMarks(p) || '?'}</th>)}<th>AB</th></tr></thead>
              <tbody>
                {list.map((s, i) => {
                  const allAbsent = papers.every(p => entries[markKey(s.id, p.subject)]?.absent)
                  return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}<div style={{ fontSize: 11.5, color: PX.sub, fontWeight: 500 }}>{s.gcc_no ? 'GCC ' + s.gcc_no : ''}</div></td>
                      {papers.map(p => {
                        const e = entries[markKey(s.id, p.subject)] || { marks: '', absent: false }
                        const err = markError(e.marks, maxMarks(p))
                        return (
                          <td key={p.id}>
                            <input className="px-input" type="number" inputMode="decimal" min="0" max={maxMarks(p) || undefined} aria-label={`${p.subject} marks for ${s.name}`} title={err || undefined}
                              disabled={e.absent} placeholder={e.absent ? 'AB' : ''} value={e.absent ? '' : e.marks}
                              onChange={ev => set(s.id, p.subject, { marks: ev.target.value })}
                              style={{ width: 70, padding: '6px 8px', borderColor: err ? PX.bad : undefined, background: err ? PX.badBg : undefined }} />
                          </td>
                        )
                      })}
                      <td><input type="checkbox" aria-label={`${s.name} absent`} checked={allAbsent} onChange={ev => absentAll(s.id, ev.target.checked)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </PremiumCard>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────
function ResultsTab({ allPapersByTest, tests, papersByTest, flash, today }) {
  const [testId, setTestId] = useState(() => pickDefaultTest(tests, today)?.id || '')
  const [batch, setBatch] = useState('All')
  const [rows, setRows] = useState(null)
  const test = tests.find(t => t.id === testId)
  // One class: out of that class's own paper where it has one. All classes together: the shared paper.
  const papers = useMemo(() => (batch !== 'All' && allPapersByTest ? papersForClass(allPapersByTest[testId] || [], batch) : papersByTest[testId] || []), [papersByTest, allPapersByTest, testId, batch])

  useEffect(() => {
    if (!testId) { setRows([]); return }
    let live = true
    setRows(null)
    supabase.from(T_MARKS).select('*').eq('test_id', testId).then(({ data, error }) => {
      if (!live) return
      if (error) flash('Could not load results: ' + error.message, true)
      setRows(data || [])
    })
    return () => { live = false }
  }, [testId, flash])

  const ranked = useMemo(() => rankResults((rows || []).filter(r => batch === 'All' || r.batch === batch), papers), [rows, batch, papers])
  const exportCsv = () => downloadCsv(`${(test?.title || 'test').replace(/\W+/g, '_')}_${batch}_results.csv`, [
    ['Rank', 'Student', 'GCC', 'Batch', ...papers.map(p => `${p.subject} /${maxMarks(p)}`), 'Total', 'Out of', '%'],
    ...ranked.map(r => [r.rank ?? 'AB', r.student_name, r.gcc_no || '', r.batch, ...papers.map(p => r.subjects[p.subject] ?? ''), r.total, r.max, r.pct ?? '']),
  ])

  const reportInput = () => ({ mission: MISSION_NAME, title: test?.title || 'Test ' + test?.test_no, date: fmt(test?.test_date), batch, papers, ranked,
    rows: (rows || []).filter(r => batch === 'All' || r.batch === batch), short: l => subjectByLabel(l)?.short || l })
  // Premium A4 preview with the official letterhead, paper-size picker and Print / Save as PDF.
  const printMarkSheet = () => printPremium(`${MFR_CSS}<div class="mfr">${testReportBody(reportInput(), true)}</div>`, { title: `Combined report · ${test?.title || ''}`, institute: getInstitute(), docLabel: `${MISSION_NAME} · ${test?.title || ''}`, official: true, landscape: true })
  const printCards = () => printPremium(`${MFR_CSS}<div class="mfr">${reportCardsBody(reportInput(), true)}</div>`, { title: `Report cards · ${test?.title || ''}`, institute: getInstitute(), docLabel: `${MISSION_NAME} · ${test?.title || ''}`, official: true })
  const wordSheet = async () => {
    try {
      const fullMax = papers.reduce((a, p) => a + maxMarks(p), 0)
      downloadDocx(`${(test?.title || 'test').replace(/\W+/g, '_')}_${batch}_results`, await buildTableDocx({
        title: `${test?.title || 'Test'} · Combined subject report`, sub: `${MISSION_NAME} · ${fmt(test?.test_date)} · ${batch === 'All' ? 'Udaan & Pragati' : batch} · full marks ${fullMax}`,
        institute: getInstitute(), label: `${MISSION_NAME} results`, landscape: true,
        columns: [{ h: 'Rank', w: 0.7 }, { h: 'Student', w: 2.6, left: true }, { h: 'Batch', w: 1 }, ...papers.map(p => ({ h: `${subjectByLabel(p.subject)?.short || p.subject} /${maxMarks(p)}`, w: 1 })), { h: 'Total', w: 1.1 }, { h: '%', w: 0.8 }],
        rows: ranked.map(r => [r.rank ?? 'AB', r.student_name, r.batch, ...papers.map(p => r.subjects[p.subject] ?? '—'), `${r.total}/${r.max}`, r.pct ?? 'Absent']),
      }))
    } catch (e) { flash('Could not make the Word file: ' + (e.message || e), true) }
  }

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  return (
    <PremiumCard title={`Results · ${test?.title || ''}`} subtitle={test ? `${fmt(test.test_date)} · ranked by percentage of the papers each student sat` : ''} bodyStyle={{ padding: 0 }}
      right={<div style={{ display: 'flex', gap: 6 }}><Btn onClick={exportCsv} disabled={!ranked.length}>Excel (CSV)</Btn><Btn kind="gold" onClick={printMarkSheet} disabled={!ranked.length}>🖨 Combined report</Btn><Btn onClick={printCards} disabled={!ranked.length}>Report cards</Btn><Btn onClick={wordSheet} disabled={!ranked.length}>📝 Word</Btn></div>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px' }}>
        <select className="px-input" aria-label="Test" value={testId} onChange={e => setTestId(e.target.value)} style={{ width: 'auto' }}>
          {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
        </select>
        <select className="px-input" aria-label="Batch" value={batch} onChange={e => setBatch(e.target.value)} style={{ width: 'auto' }}>{['All', ...BATCHES].map(b => <option key={b}>{b}</option>)}</select>
      </div>
      {rows === null ? <div style={{ padding: 20, color: PX.sub }}>Loading…</div> : !ranked.length ? <div style={{ padding: 20, color: PX.sub }}>No marks entered for this test yet.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table" style={{ width: '100%' }}>
            <thead><tr><th>Rank</th><th>Student</th><th>Batch</th>{papers.map(p => <th key={p.id}>{subjectByLabel(p.subject)?.short || p.subject} /{maxMarks(p)}</th>)}<th>Total</th><th>%</th></tr></thead>
            <tbody>
              {ranked.map(r => (
                <tr key={r.student_id}>
                  <td style={{ fontWeight: 800 }}>{r.rank ?? '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.student_name}</td><td>{r.batch}</td>
                  {papers.map(p => <td key={p.id}>{r.subjects[p.subject] ?? '—'}</td>)}
                  <td style={{ fontWeight: 700 }}>{r.total}/{r.max}</td>
                  <td><Pill tone={r.pct == null ? 'mute' : r.pct >= 75 ? 'ok' : r.pct >= 50 ? 'gold' : 'bad'}>{r.pct == null ? 'Absent' : r.pct + '%'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PremiumCard>
  )
}

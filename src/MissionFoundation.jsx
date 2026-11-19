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
import { canonicalBatch } from './courseMap'
import { PremiumStyles, PremiumHero, PremiumTabs, PremiumCard, PX } from './premiumUI'
import { PersonCell, Pill } from './MissionSainikUI'
import { downloadCsv } from './lib/missionSainikExport'
import { AnalyserTab, CertificatesTab, MaterialTab, ChatTab } from './MissionFoundationExtras'
import {
  MISSION_NAME, BATCHES, SUBJECTS, DEFAULT_PANEL, PAPER_FLOW, TEST_FLOW, DEFAULT_PLAN,
  subjectByLabel, maxMarks, buildSchedule, checkerFor, rankResults, markError, nameMatches, titled, safeUrl,
} from './missionFoundationData'

const T_TESTS = 'mission_foundation_tests'
const T_PAPERS = 'mission_foundation_papers'
const T_PANEL = 'mission_foundation_panel'
const T_MARKS = 'mission_foundation_marks'
const SQL_FILE = 'supabase/migrations/20261216_mission_foundation.sql'

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

function PersonSelect({ value, options, onChange, label }) {
  const list = [...new Set([...(options || []), ...(value ? [value] : [])])]
  return (
    <select className="px-input" aria-label={label} value={value || ''} onChange={e => onChange(e.target.value)} style={{ padding: '7px 10px', fontSize: 13.5, minWidth: 110 }}>
      <option value="">—</option>
      {list.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )
}

const Btn = ({ kind = 'ghost', children, ...p }) => <button type="button" className={'px-btn ' + kind} {...p}>{children}</button>

export default function MissionFoundation({ currentUser }) {
  const isMobile = useIsMobile()
  const isAdmin = isAdminRole(currentUser?.role)
  const me = currentUser?.name || ''
  const [tab, setTab] = useState('home')
  const [tests, setTests] = useState([])
  const [papers, setPapers] = useState([])
  const [panelRows, setPanelRows] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [msg, setMsg] = useState(null)
  const [openTest, setOpenTest] = useState(null)
  const today = todayISO()

  const flash = useCallback((text, bad) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), bad ? 6000 : 3000) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [t, p, pn, st] = await Promise.all([
      supabase.from(T_TESTS).select('*').order('test_date').order('test_no'),
      supabase.from(T_PAPERS).select('*'),
      supabase.from(T_PANEL).select('*').order('teacher'),
      supabase.from('staff_profiles').select('name, department, designation').order('name'),
    ])
    const err = t.error || p.error || pn.error
    if (err) {
      if (missingTable(err)) setSetupNeeded(true)
      else flash('Could not load: ' + err.message, true)
    } else setSetupNeeded(false)
    setTests(t.data || []); setPapers(p.data || []); setPanelRows(pn.data || [])
    setStaff([...new Set((st.data || []).map(s => String(s.name || '').trim()).filter(Boolean))])
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

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

  const papersByTest = useMemo(() => {
    const m = {}
    papers.forEach(p => { (m[p.test_id] ||= []).push(p) })
    Object.values(m).forEach(l => l.sort((a, b) => SUBJECTS.findIndex(s => s.label === a.subject) - SUBJECTS.findIndex(s => s.label === b.subject)))
    return m
  }, [papers])
  const testById = useMemo(() => Object.fromEntries(tests.map(t => [t.id, t])), [tests])

  // ── writes ──
  const savePaper = async (id, patch) => {
    const next = { ...patch, updated_by: me, updated_at: now() }
    setPapers(ps => ps.map(p => p.id === id ? { ...p, ...next } : p))
    const { error } = await supabase.from(T_PAPERS).update(next).eq('id', id)
    if (error) { flash('Not saved: ' + error.message, true); load() }
  }
  const saveTest = async (id, patch) => {
    const next = { ...patch, updated_by: me, updated_at: now() }
    setTests(ts => ts.map(t => t.id === id ? { ...t, ...next } : t))
    const { error } = await supabase.from(T_TESTS).update(next).eq('id', id)
    if (error) { flash('Not saved: ' + error.message, true); load() }
  }

  const stats = useMemo(() => {
    const done = papers.filter(p => p.status === 'Approved').length
    const late = papers.filter(p => p.status !== 'Approved' && testById[p.test_id]?.test_date <= today).length
    const next = tests.find(t => t.test_date >= today)
    const mine = papers.filter(p => (nameMatches(me, p.setter) && p.status === 'Pending') || (nameMatches(me, p.verifier) && p.status === 'Submitted')).length
    return { done, late, next, mine }
  }, [papers, tests, testById, today, me])

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'schedule', label: 'Schedule & syllabus' },
    { id: 'mine', label: 'My papers', badge: stats.mine },
    { id: 'teachers', label: 'Teachers' },
    { id: 'marks', label: 'Marks' },
    { id: 'results', label: 'Results' },
    { id: 'analyser', label: 'Analyser' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'material', label: 'Study material' },
    { id: 'chat', label: 'Group chat' },
  ]

  return (
    <div className="px-root">
      <PremiumStyles />
      <div className="px-wrap" style={{ maxWidth: 1240 }}>
        <PremiumHero isMobile={isMobile} icon={<span style={{ fontSize: isMobile ? 22 : 26 }}>🚀</span>}
          eyebrow="GNSI · Foundation · Udaan & Pragati" title={MISSION_NAME}
          subtitle="8 Monday tests, December – January · syllabus, papers, marks, analysis, certificates, material and group chat"
          actions={<button className="px-hbtn" onClick={load}>↻ Refresh</button>}
          stats={[
            { label: 'Tests', value: tests.length, sub: `${tests.filter(t => t.test_date < today).length} done` },
            { label: 'Next test', value: stats.next ? fmt(stats.next.test_date) : '—', sub: stats.next ? (papersByTest[stats.next.id] || []).map(p => subjectByLabel(p.subject)?.short || p.subject).join(', ') : 'none planned', tone: PX.goldLt },
            { label: 'Papers approved', value: `${stats.done}/${papers.length}`, sub: 'ready to print', tone: '#86efac' },
            { label: 'Need attention', value: stats.late, sub: 'test day reached, not approved', tone: stats.late ? '#fca5a5' : null },
          ]} />

        {msg && <div role="status" style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 12, fontWeight: 600, color: '#fff', background: msg.bad ? PX.bad : PX.ok }}>{msg.text}</div>}

        {setupNeeded ? (
          <PremiumCard title="One-time database setup needed" subtitle="The Mission Foundation tables are not in the database yet.">
            <p style={{ margin: 0, lineHeight: 1.6 }}>An admin needs to open the Supabase dashboard → <b>SQL Editor</b>, paste the contents of <code>{SQL_FILE}</code> from the ERP code, and press <b>Run</b>. Then press Refresh above.</p>
          </PremiumCard>
        ) : (
          <>
            <PremiumTabs tabs={tabs} active={tab} onChange={setTab} style={{ margin: '14px 0' }} />
            {loading ? <PremiumCard><div style={{ color: PX.sub }}>Loading…</div></PremiumCard> : <>
              {tab === 'home' && <HomeTab {...{ tests, papersByTest, today, stats, isAdmin, setTab, setOpenTest }} />}
              {tab === 'schedule' && <ScheduleTab {...{ tests, papersByTest, panel, today, isAdmin, me, openTest, setOpenTest, savePaper, saveTest, peopleFor, load, flash }} />}
              {tab === 'mine' && <MineTab {...{ papers, testById, me, isAdmin, allTeachers, savePaper, today }} />}
              {tab === 'teachers' && <TeachersTab {...{ panel, panelFromDb, staff, papers, isAdmin, me, load, flash }} />}
              {tab === 'marks' && <MarksTab {...{ tests, papersByTest, me, flash, today }} />}
              {tab === 'results' && <ResultsTab {...{ tests, papersByTest, flash, today }} />}
              {tab === 'analyser' && <AnalyserTab {...{ tests, papersByTest, flash, today }} />}
              {tab === 'certificates' && <CertificatesTab {...{ tests, papersByTest, flash, today }} />}
              {tab === 'material' && <MaterialTab {...{ tests, me, isAdmin, flash }} />}
              {tab === 'chat' && <ChatTab {...{ me, isAdmin, flash }} />}
            </>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function HomeTab({ tests, papersByTest, today, stats, isAdmin, setTab, setOpenTest }) {
  const upcoming = tests.filter(t => t.test_date >= today).slice(0, 7)
  if (!tests.length) return (
    <PremiumCard title="Start here" subtitle="No tests yet">
      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
        <li><b>Teachers:</b> check who teaches each subject (the timetable teachers are filled in already).</li>
        <li><b>Schedule & syllabus:</b> {isAdmin ? 'press "Create schedule" to make the December – January test days.' : 'an admin creates the December – January test days.'}</li>
        <li>Each teacher opens <b>My papers</b>, fills the syllabus, sets the paper and submits it; another teacher checks it.</li>
        <li>After each Monday test, enter <b>Marks</b> for all subjects; <b>Results</b> and <b>Analyser</b> rank and compare Udaan and Pragati.</li>
        <li><b>Certificates</b> prints merit certificates for the toppers; <b>Study material</b> and <b>Group chat</b> keep everyone together.</li>
      </ol>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="gold" onClick={() => setTab('schedule')}>Open Schedule</Btn>
        <Btn onClick={() => setTab('teachers')}>Open Teachers</Btn>
      </div>
    </PremiumCard>
  )
  return (
    <>
      {stats.mine > 0 && (
        <PremiumCard title={`You have ${stats.mine} paper${stats.mine === 1 ? '' : 's'} to work on`} subtitle="Papers to set, or papers waiting for your check" right={<Btn kind="gold" onClick={() => setTab('mine')}>Open My papers</Btn>} />
      )}
      <PremiumCard title="Coming up" subtitle="The next test days and how ready each paper is" bodyStyle={{ padding: 0 }}>
        {!upcoming.length ? <div style={{ padding: 20, color: PX.sub }}>No more tests scheduled.</div> : (
          <table className="px-table" style={{ width: '100%' }}>
            <thead><tr><th>Test</th><th>Date</th><th>Papers</th><th>Status</th></tr></thead>
            <tbody>
              {upcoming.map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => { setOpenTest(t.id); setTab('schedule') }}>
                  <td style={{ fontWeight: 700 }}>{t.title || `Test ${t.test_no}`}</td>
                  <td>{t.test_date === today ? <Pill tone="gold">Today</Pill> : fmt(t.test_date)}</td>
                  <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(papersByTest[t.id] || []).map(p => <Pill key={p.id} tone={PAPER_TONE[p.status]}>{subjectByLabel(p.subject)?.short || p.subject} · {p.status}</Pill>)}</div></td>
                  <td><Pill tone={TEST_TONE[t.status]}>{t.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PremiumCard>
    </>
  )
}

// ─── Schedule & syllabus pattern ──────────────────────────────────────────────
function ScheduleTab({ tests, papersByTest, panel, today, isAdmin, me, openTest, setOpenTest, savePaper, saveTest, peopleFor, load, flash }) {
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

  const byMonth = useMemo(() => {
    const m = []
    tests.forEach(t => { const k = monthOf(t.test_date); const g = m.find(x => x.k === k); if (g) g.list.push(t); else m.push({ k, list: [t] }) })
    return m
  }, [tests])

  return (
    <>
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
                {fresh.length ? <>Mondays: {fresh.map(r => fmt(r.test.test_date)).join(', ')}. Each test has all 6 subjects; setters take turns within each subject. The pattern is {SUBJECTS[0].questions} questions × {SUBJECTS[0].marks_each} marks per subject until you change it.</> : 'Every Monday in that range already has a test.'}
              </div>
              <div><Btn kind="gold" disabled={busy || !fresh.length} onClick={create}>{busy ? 'Creating…' : `Create ${fresh.length} tests`}</Btn></div>
            </div>
          ) : <div style={{ color: PX.sub }}>{tests.length ? `${tests.length} tests from ${fmt(tests[0].test_date)} to ${fmt(tests[tests.length - 1].test_date)}.` : 'No tests yet. Default: 8 Monday tests, 7 Dec 2026 – 25 Jan 2027.'}</div>}
        </PremiumCard>
      )}

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
                {open && <TestEditor {...{ test: t, papers: ps, isAdmin, me, savePaper, saveTest, peopleFor, panel, load, flash, setOpenTest }} />}
              </div>
            )
          })}
        </PremiumCard>
      ))}
    </>
  )
}

function TestEditor({ test, papers, isAdmin, me, savePaper, saveTest, peopleFor, panel, load, flash, setOpenTest }) {
  const missing = SUBJECTS.filter(s => !papers.some(p => p.subject === s.label))
  const totalMax = papers.reduce((n, p) => n + maxMarks(p), 0)
  const addPaper = async label => {
    const s = subjectByLabel(label); const setter = (panel[label] || [])[0] || ''
    const { error } = await supabase.from(T_PAPERS).insert({ test_id: test.id, subject: label, questions: s.questions, marks_each: s.marks_each, duration_min: s.duration_min, setter, verifier: setter ? checkerFor(label, setter, panel) : '', updated_by: me })
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
        <label>Status<select className="px-input" value={test.status} onChange={e => saveTest(test.id, { status: e.target.value })} style={{ padding: '7px 10px' }}>{TEST_FLOW.map(s => <option key={s}>{s}</option>)}</select></label>
        <div>Batches<div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>{BATCHES.map(b => <label key={b} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={(test.batches || []).includes(b)} onChange={() => toggleBatch(b)} />{b}</label>)}</div></div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="px-table" style={{ width: '100%', minWidth: 1180, background: '#fff' }}>
          <thead><tr><th>Subject</th><th style={{ minWidth: 220 }}>Syllabus (chapters)</th><th>Qs</th><th>Marks each</th><th>Max</th><th>Minutes</th><th>Setter</th><th>Checker</th><th>Status</th><th>Paper link</th><th /></tr></thead>
          <tbody>
            {papers.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.subject}</td>
                <td><BlurField label={`${p.subject} syllabus`} placeholder="e.g. Fractions; Decimals" value={p.syllabus} onSave={v => savePaper(p.id, { syllabus: v })} /></td>
                <td><BlurField type="number" width={64} label="Questions" value={p.questions} onSave={v => savePaper(p.id, { questions: v })} /></td>
                <td><BlurField type="number" width={64} label="Marks each" value={p.marks_each} onSave={v => savePaper(p.id, { marks_each: v })} /></td>
                <td style={{ fontWeight: 700 }}>{maxMarks(p) || '—'}</td>
                <td><BlurField type="number" width={64} label="Minutes" value={p.duration_min} onSave={v => savePaper(p.id, { duration_min: v })} /></td>
                <td><PersonSelect label="Setter" value={p.setter} options={peopleFor(p.subject)} onChange={v => savePaper(p.id, { setter: v, verifier: p.verifier && p.verifier !== v ? p.verifier : checkerFor(p.subject, v, panel) })} /></td>
                <td><PersonSelect label="Checker" value={p.verifier} options={peopleFor(p.subject).filter(n => n !== p.setter)} onChange={v => savePaper(p.id, { verifier: v })} /></td>
                <td><select className="px-input" aria-label="Paper status" value={p.status} onChange={e => savePaper(p.id, { status: e.target.value })} style={{ padding: '7px 10px', minWidth: 116 }}>{PAPER_FLOW.map(s => <option key={s}>{s}</option>)}</select></td>
                <td><BlurField label="Paper link" width={170} placeholder="https://…" value={p.paper_link} onSave={v => { const u = v ? safeUrl(v) : ''; if (v && !u) return flash('Use a full https:// link.', true); savePaper(p.id, { paper_link: u }) }} /></td>
                <td>{isAdmin && <button type="button" aria-label={`Remove ${p.subject}`} className="px-btn ghost" onClick={() => delPaper(p)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <span style={{ color: PX.sub, fontSize: 13.5 }}>Full marks: <b>{totalMax}</b></span>
        {missing.length > 0 && <select className="px-input" aria-label="Add a subject" value="" onChange={e => e.target.value && addPaper(e.target.value)} style={{ width: 'auto', padding: '7px 10px' }}>
          <option value="">＋ Add a subject…</option>{missing.map(s => <option key={s.key} value={s.label}>{s.label}</option>)}
        </select>}
        <span style={{ flex: 1 }} />
        {isAdmin && <Btn onClick={delTest} style={{ color: PX.bad }}>Delete this test</Btn>}
      </div>
      <div style={{ marginTop: 10 }}>
        <BlurField label="Notes" placeholder="Notes for teachers (room, timing, instructions)…" value={test.notes} onSave={v => saveTest(test.id, { notes: v })} />
      </div>
    </div>
  )
}

// ─── My papers (teacher workspace) ────────────────────────────────────────────
function MineTab({ papers, testById, me, isAdmin, allTeachers, savePaper, today }) {
  const [who, setWho] = useState('')
  const person = who || me
  const mine = papers.filter(p => nameMatches(person, p.setter) || nameMatches(person, p.verifier) || (who && (p.setter === who || p.verifier === who)))
    .map(p => ({ ...p, test: testById[p.test_id] })).filter(p => p.test)
    .sort((a, b) => a.test.test_date.localeCompare(b.test.test_date))
  const open = mine.filter(p => p.status !== 'Approved')
  const done = mine.filter(p => p.status === 'Approved')
  const row = p => {
    const setter = nameMatches(person, p.setter) || p.setter === who
    const checker = nameMatches(person, p.verifier) || p.verifier === who
    const late = p.status !== 'Approved' && p.test.test_date <= today
    return (
      <div key={p.id} style={{ display: 'grid', gap: 8, padding: 14, borderTop: `1px solid ${PX.line}` }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <b>{p.subject}</b><span style={{ color: PX.sub }}>{p.test.title} · {fmt(p.test.test_date)}</span>
          <Pill tone={late ? 'bad' : PAPER_TONE[p.status]}>{late ? 'Due · ' + p.status : p.status}</Pill>
          <span style={{ color: PX.sub, fontSize: 13 }}>{setter ? 'You set this' : ''}{setter && checker ? ' · ' : ''}{checker ? `You check this (setter ${p.setter || '—'})` : ''}</span>
        </div>
        <div style={{ fontSize: 13.5, color: PX.ink2 }}>Pattern: {p.questions || '?'} questions × {p.marks_each || '?'} marks = {maxMarks(p) || '?'} · {p.duration_min || '?'} min</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          <label>Syllabus<BlurField label="Syllabus" placeholder="Chapters for this paper" value={p.syllabus} onSave={v => savePaper(p.id, { syllabus: v })} /></label>
          <label>Paper link (Google Drive etc.)<BlurField label="Paper link" placeholder="https://…" value={p.paper_link} onSave={v => savePaper(p.id, { paper_link: v ? safeUrl(v) : '' })} /></label>
          <label>Remarks<BlurField label="Remarks" value={p.remarks} onSave={v => savePaper(p.id, { remarks: v })} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {p.paper_link && <a className="px-btn ghost" href={safeUrl(p.paper_link)} target="_blank" rel="noreferrer">Open paper</a>}
          {setter && p.status === 'Pending' && <Btn kind="gold" onClick={() => savePaper(p.id, { status: 'Submitted' })}>Submit for checking</Btn>}
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
function TeachersTab({ panel, panelFromDb, staff, papers, isAdmin, me, load, flash }) {
  const [add, setAdd] = useState({})
  const counts = useMemo(() => {
    const c = {}
    papers.forEach(p => { if (p.setter) (c[p.setter] ||= { set: 0, check: 0 }).set++; if (p.verifier) (c[p.verifier] ||= { set: 0, check: 0 }).check++ })
    return c
  }, [papers])
  const saveDefaults = async () => {
    const rows = Object.entries(DEFAULT_PANEL).flatMap(([subject, list]) => list.map(teacher => ({ subject, teacher, created_by: me })))
    const { error } = await supabase.from(T_PANEL).upsert(rows, { onConflict: 'subject,teacher' })
    if (error) flash('Not saved: ' + error.message, true); else { flash('Teacher list saved.'); load() }
  }
  const addTeacher = async subject => {
    const name = String(add[subject] || '').trim()
    if (!name) return
    const base = panelFromDb ? [] : Object.entries(DEFAULT_PANEL).flatMap(([s, l]) => l.map(t => ({ subject: s, teacher: t, created_by: me })))
    const { error } = await supabase.from(T_PANEL).upsert([...base, { subject, teacher: name, created_by: me }], { onConflict: 'subject,teacher' })
    if (error) flash('Not added: ' + error.message, true); else { setAdd({ ...add, [subject]: '' }); load() }
  }
  const remove = async (subject, teacher) => {
    if (!panelFromDb) return flash('Press "Save this list" first.', true)
    const { error } = await supabase.from(T_PANEL).delete().eq('subject', subject).eq('teacher', teacher)
    if (error) flash('Not removed: ' + error.message, true); else load()
  }
  return (
    <>
      {!panelFromDb && (
        <PremiumCard title="Teachers from the timetable" subtitle="These are the Udaan and Pragati teachers on the current timetable. Save the list to start editing it."
          right={isAdmin ? <Btn kind="gold" onClick={saveDefaults}>Save this list</Btn> : null} />
      )}
      <datalist id="mf-staff">{staff.map(n => <option key={n} value={n} />)}</datalist>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        {SUBJECTS.map(s => (
          <PremiumCard key={s.key} title={s.label} subtitle={`${(panel[s.label] || []).length} teacher(s) · default ${s.questions} Qs × ${s.marks_each} marks`} style={{ marginBottom: 0 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              {(panel[s.label] || []).map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PersonCell name={t} sub={`${counts[t]?.set || 0} to set · ${counts[t]?.check || 0} to check`}>{titled(t)}</PersonCell>
                  <span style={{ flex: 1 }} />
                  {isAdmin && <button type="button" className="px-btn ghost" aria-label={`Remove ${t} from ${s.label}`} onClick={() => remove(s.label, t)}>✕</button>}
                </div>
              ))}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="px-input" list="mf-staff" aria-label={`Add teacher to ${s.label}`} placeholder="Add a teacher (first name)" value={add[s.label] || ''} onChange={e => setAdd({ ...add, [s.label]: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTeacher(s.label)} style={{ padding: '7px 10px' }} />
                  <Btn kind="gold" onClick={() => addTeacher(s.label)}>Add</Btn>
                </div>
              )}
            </div>
          </PremiumCard>
        ))}
      </div>
      <p style={{ color: PX.sub, fontSize: 13, marginTop: 12 }}>Use the first name as it appears in the teacher's ERP login (for example "Roshan"), so their papers show up in <b>My papers</b>. Changing this list does not change papers already made; change those in Schedule & syllabus.</p>
    </>
  )
}

// ─── Marks entry ──────────────────────────────────────────────────────────────
function useFoundationStudents() {
  const [students, setStudents] = useState(null)
  useEffect(() => {
    let live = true
    getActiveStudents('id,name,gcc_no,batch,course').then(rows => {
      if (!live) return
      setStudents((rows || []).map(s => ({ ...s, batchName: canonicalBatch(s.batch) })).filter(s => BATCHES.includes(s.batchName)).sort((a, b) => String(a.name).localeCompare(String(b.name))))
    })
    return () => { live = false }
  }, [])
  return students
}

const pickDefaultTest = (tests, today) => [...tests].reverse().find(t => t.test_date <= today) || tests[0]

const markKey = (sid, subj) => `${sid}|${subj}`

function MarksTab({ tests, papersByTest, me, flash, today }) {
  const students = useFoundationStudents()
  const [testId, setTestId] = useState(() => pickDefaultTest(tests, today)?.id || '')
  const [batch, setBatch] = useState(BATCHES[0])
  const [entries, setEntries] = useState({})   // `${student_id}|${subject}` → { marks, absent }
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const papers = useMemo(() => papersByTest[testId] || [], [papersByTest, testId])
  const list = (students || []).filter(s => s.batchName === batch)

  useEffect(() => {
    if (!testId) { setEntries({}); return }
    let live = true
    supabase.from(T_MARKS).select('student_id, subject, marks, absent').eq('test_id', testId).then(({ data, error }) => {
      if (!live) return
      if (error) flash('Could not load marks: ' + error.message, true)
      setEntries(Object.fromEntries((data || []).map(r => [markKey(r.student_id, r.subject), { marks: r.marks ?? '', absent: r.absent }])))
      setDirty(false)
    })
    return () => { live = false }
  }, [testId, flash])

  const errors = list.flatMap(s => papers.map(p => markError(entries[markKey(s.id, p.subject)]?.marks, maxMarks(p)))).filter(Boolean).length
  const save = async () => {
    if (errors) return flash(`Fix ${errors} mark(s) first: each must be from 0 to the paper's full marks.`, true)
    const rows = list.flatMap(s => papers.map(p => {
      const e = entries[markKey(s.id, p.subject)]
      if (!e || (!e.absent && (e.marks === '' || e.marks === null))) return null
      return { test_id: testId, student_id: String(s.id), gcc_no: s.gcc_no ? String(s.gcc_no) : null, student_name: s.name, batch, subject: p.subject,
        marks: e.absent ? null : Number(e.marks), absent: !!e.absent, entered_by: me, updated_at: now() }
    })).filter(Boolean)
    if (!rows.length) return flash('Nothing to save yet.', true)
    setBusy(true)
    const { error } = await supabase.from(T_MARKS).upsert(rows, { onConflict: 'test_id,student_id,subject' })
    setBusy(false)
    if (error) flash('Not saved: ' + error.message, true); else { setDirty(false); flash(`Saved ${rows.length} marks for ${batch}.`) }
  }
  const set = (sid, subj, patch) => { setDirty(true); setEntries(e => ({ ...e, [markKey(sid, subj)]: { marks: '', absent: false, ...e[markKey(sid, subj)], ...patch } })) }
  const absentAll = (sid, on) => papers.forEach(p => set(sid, p.subject, { absent: on }))

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  return (
    <PremiumCard title="Enter marks" subtitle="All subjects of the test for one batch. Empty boxes are not saved. Tick AB for a student absent from the whole test." bodyStyle={{ padding: 0 }}
      right={<Btn kind="gold" disabled={busy || !papers.length} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save marks •' : 'Save marks'}</Btn>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px' }}>
        <select className="px-input" aria-label="Test" value={testId} onChange={e => { if (!dirty || window.confirm('Leave without saving?')) setTestId(e.target.value) }} style={{ width: 'auto' }}>
          {tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no} · {fmt(t.test_date)}</option>)}
        </select>
        <select className="px-input" aria-label="Batch" value={batch} onChange={e => setBatch(e.target.value)} style={{ width: 'auto' }}>{BATCHES.map(b => <option key={b}>{b}</option>)}</select>
      </div>
      {!papers.length ? <div style={{ padding: 20, color: PX.sub }}>This test has no papers.</div>
        : students === null ? <div style={{ padding: 20, color: PX.sub }}>Loading students…</div>
        : !list.length ? <div style={{ padding: 20, color: PX.sub }}>No active students found in {batch}.</div> : (
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
function ResultsTab({ tests, papersByTest, flash, today }) {
  const [testId, setTestId] = useState(() => pickDefaultTest(tests, today)?.id || '')
  const [batch, setBatch] = useState('All')
  const [rows, setRows] = useState(null)
  const test = tests.find(t => t.id === testId)
  const papers = useMemo(() => papersByTest[testId] || [], [papersByTest, testId])

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

  if (!tests.length) return <PremiumCard title="No tests yet" subtitle="Create the schedule first." />
  return (
    <PremiumCard title={`Results · ${test?.title || ''}`} subtitle={test ? `${fmt(test.test_date)} · ranked by percentage of the papers each student sat` : ''} bodyStyle={{ padding: 0 }}
      right={<div style={{ display: 'flex', gap: 6 }}><Btn onClick={exportCsv} disabled={!ranked.length}>Excel (CSV)</Btn><Btn onClick={() => window.print()} disabled={!ranked.length}>Print</Btn></div>}>
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

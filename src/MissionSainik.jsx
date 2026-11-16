// MissionSainik.jsx — GNSI Portal · Management → Mission Sainik
// Tracks the question setting for "Mission Sainik 2027 – Search for Extra Ordinary":
// 20 Pre Mock Tests (6 sections × 25 questions each) plus the practice question bank.
// Who sets what, who verifies, deadlines, and progress: Pending → Submitted → Verified → Approved.
// Plan and deadlines: missionSainikData.js (Office Order GNSI/MS-2027/PMT/2026/01).
// Progress is stored in the `mission_sainik_tasks` table (migration 20261201_mission_sainik_tasks.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { PremiumStyles, PremiumHero, PremiumTabs, PremiumCard, PX, PIcon } from './premiumUI'
import {
  ORDER_NO, ORDER_DATE, SUBMISSION_DEADLINE, SUBJECTS, PANEL, TESTS, JNVST,
  buildSeedRows, fullName, STATUS_FLOW, EXAM_DATE, MOCK_TESTS, MOCK_SECTIONS,
} from './missionSainikData'

const TABLE = 'mission_sainik_tasks'
const MAT_TABLE = 'mission_sainik_materials'
const MAT_BUCKET = 'teacher-materials'
const SYL_TABLE = 'mission_sainik_syllabus'
const MARKS_TABLE = 'mission_sainik_marks'
const MARK_COLS = [['maths', 'Maths', 60], ['reasoning', 'Reasoning', 20], ['grammar', 'Grammar', 20], ['gk', 'GK', 20]]
const ALL_PEOPLE = [...new Set(Object.values(PANEL).flat())].sort()
const STATUS_STYLE = {
  Pending:   { fg: PX.warn,  bg: PX.warnBg },
  Submitted: { fg: '#1d4ed8', bg: '#e8f0fe' },
  Verified:  { fg: PX.gold,  bg: PX.goldBg },
  Approved:  { fg: PX.ok,    bg: PX.okBg },
  Overdue:   { fg: PX.bad,   bg: PX.badBg },
}

const todayISO = () => new Date().toLocaleDateString('en-CA')
const parse = iso => new Date(iso + 'T00:00:00')
const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
const fmt = iso => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = iso => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const dayName = iso => parse(iso).toLocaleDateString('en-GB', { weekday: 'long' })
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => {
    const f = () => setM(window.innerWidth < 700)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return m
}

function dueFor(task) {
  if (task.kind === 'practice') return SUBMISSION_DEADLINE
  return TESTS[task.test_no - 1]?.drafts || SUBMISSION_DEADLINE
}
const isOverdue = (task, today) => task.status === 'Pending' && today > dueFor(task)

function Chip({ status, overdue, small }) {
  const st = STATUS_STYLE[overdue ? 'Overdue' : status] || STATUS_STYLE.Pending
  return (
    <span style={{ display: 'inline-block', padding: small ? '2px 8px' : '3px 10px', borderRadius: 99, fontSize: small ? 10.5 : 11.5, fontWeight: 700, color: st.fg, background: st.bg, whiteSpace: 'nowrap' }}>
      {overdue ? 'Overdue' : status}
    </span>
  )
}

function Bar({ value, total, color = PX.gold }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height: 8, borderRadius: 4, background: PX.line, overflow: 'hidden' }} role="img" aria-label={`${pct}% done`}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 4 }} />
    </div>
  )
}

// Update dialog — a top-level component so typing is never lost when the screen behind it re-renders.
function TaskDialog({ sel, today, isAdmin, allowed, busy, onSave, onClose, chapter }) {
    const [setter, setSetter] = useState(sel.setter || '')
    const [verifier, setVerifier] = useState(sel.verifier || '')
    const [remarks, setRemarks] = useState(sel.remarks || '')
    const [mix, setMix] = useState({ easy_count: sel.easy_count ?? '', medium_count: sel.medium_count ?? '', hard_count: sel.hard_count ?? '' })
    const mixTotal = ['easy_count', 'medium_count', 'hard_count'].reduce((a, k) => a + (Number(mix[k]) || 0), 0)
    const mixPatch = () => (mixTotal > 0 ? { easy_count: Number(mix.easy_count) || 0, medium_count: Number(mix.medium_count) || 0, hard_count: Number(mix.hard_count) || 0 } : {})
    const mixPct = k => (mixTotal ? Math.round(((Number(mix[k]) || 0) / mixTotal) * 100) : 0)
    const mixOff = mixTotal > 0 && (Math.abs(mixPct('easy_count') - 40) > 10 || Math.abs(mixPct('medium_count') - 40) > 10 || Math.abs(mixPct('hard_count') - 20) > 10)
    const [count, setCount] = useState(sel.question_count ?? '')
    const next = allowed
    const mayEdit = isAdmin || next.length > 0
    return (
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label="Update task" onClick={e => e.stopPropagation()}
          style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 30px 60px -20px rgba(0,0,0,.5)' }}>
          <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600, color: PX.navy }}>
            {sel.kind === 'test' ? `PMT-${String(sel.test_no).padStart(2, '0')} · ` : 'Practice · '}{sel.subject}
          </div>
          <div style={{ fontSize: 13, color: PX.sub, margin: '4px 0 12px' }}>
            Setter {fullName(sel.setter)}{sel.verifier ? ` · verifier ${fullName(sel.verifier)}` : ''} · due {fmt(dueFor(sel))}
            {sel.kind === 'test' && ` · test on ${fmtShort(TESTS[sel.test_no - 1].date)}`}
          </div>
          {chapter && <div style={{ fontSize: 13, fontWeight: 700, color: PX.navy, marginBottom: 10 }}>📘 Chapter: {chapter}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Chip status={sel.status} overdue={isOverdue(sel, today)} />
            {sel.submitted_on && <span style={{ fontSize: 12, color: PX.sub }}>submitted {fmtShort(sel.submitted_on)}</span>}
            {sel.verified_on && <span style={{ fontSize: 12, color: PX.sub }}>· verified {fmtShort(sel.verified_on)}</span>}
            {sel.approved_on && <span style={{ fontSize: 12, color: PX.sub }}>· approved {fmtShort(sel.approved_on)}</span>}
          </div>
          {mayEdit && (
            <>
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Questions
                <input className="px-input" type="number" min="0" value={count} onChange={e => setCount(e.target.value)} style={{ marginTop: 4 }} />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {[['easy_count', 'Easy'], ['medium_count', 'Medium'], ['hard_count', 'Hard']].map(([k, l]) => (
                  <label key={k} style={{ flex: 1, fontSize: 12, fontWeight: 700, color: PX.sub }}>{l}{mixTotal ? ` · ${mixPct(k)}%` : ''}
                    <input className="px-input" type="number" min="0" value={mix[k]} onChange={e => setMix({ ...mix, [k]: e.target.value })} style={{ marginTop: 4 }} />
                  </label>
                ))}
              </div>
              {mixOff && <div style={{ fontSize: 12, color: PX.warn, marginTop: 6 }}>⚠ The notice asks for about 40% easy, 40% medium, 20% hard.</div>}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  {[['Setter', setter, setSetter], ['Verifier', verifier, setVerifier]].map(([lbl, val, fn]) => (
                    <label key={lbl} style={{ flex: 1, fontSize: 12, fontWeight: 700, color: PX.sub }}>{lbl}
                      <select className="px-input" value={val} onChange={e => fn(e.target.value)} style={{ marginTop: 4 }}>
                        <option value="">—</option>
                        {[...new Set([...ALL_PEOPLE, val].filter(Boolean))].map(n => <option key={n} value={n}>{fullName(n)}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginTop: 10 }}>Remarks
                <textarea className="px-input" rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} style={{ marginTop: 4, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {next.map(s => (
                  <button key={s} className={'px-btn' + (STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(sel.status) ? ' gold' : ' ghost')} disabled={busy}
                    onClick={async () => { if (await onSave(sel, { ...mixPatch(), status: s, remarks, setter, verifier: verifier || null, question_count: count === '' ? null : +count })) onClose() }}>
                    {STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(sel.status) ? `Mark ${s.toLowerCase()}` : `Move back to ${s.toLowerCase()}`}
                  </button>
                ))}
                <button className="px-btn" disabled={busy}
                  onClick={async () => { if (await onSave(sel, { ...mixPatch(), remarks, setter, verifier: verifier || null, question_count: count === '' ? null : +count })) onClose() }}>Save notes</button>
              </div>
            </>
          )}
          {!mayEdit && (
            <div style={{ fontSize: 13, color: PX.sub }}>
              {sel.remarks ? `Remarks: ${sel.remarks}` : 'Only the setter, the verifier or the Principal can update this task.'}
            </div>
          )}
          <div style={{ marginTop: 14, textAlign: 'right' }}><button className="px-btn ghost" onClick={() => onClose()}>Close</button></div>
        </div>
      </div>
    )
}

export default function MissionSainik({ currentUser, perms }) {
  const isMobile = useIsMobile()
  // Everyone on staff manages everything here (reassign, approve, syllabus, marks). Updates are stamped with the user's name.
  const isAdmin = true
  // Open to every logged-in staff member: non-admins can only move tasks they set or verify (see allowedStatuses).
  const canEdit = true
  const [tab, setTab] = useState('overview')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState(false) // table missing → migration not run yet
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)       // task open in the update dialog
  const [person, setPerson] = useState('')   // admin filter on "My tasks"
  const [filterTest, setFilterTest] = useState(0)
  const today = todayISO()
  const [mats, setMats] = useState([])
  const [matSetup, setMatSetup] = useState(false)
  const [matDraft, setMatDraft] = useState({ title: '', subject: '', test_no: 0, link_url: '', note: '', file: null })
  const [fileKey, setFileKey] = useState(0)
  const [syl, setSyl] = useState({})            // 'testNo|subject' -> chapter
  const [marks, setMarks] = useState([])
  const [markDraft, setMarkDraft] = useState({ test_no: 1, batch: '', maths: '', reasoning: '', grammar: '', gk: '' })
  const [marksSetup, setMarksSetup] = useState(false)

  const me = (currentUser?.name || '').toLowerCase()
  const isMe = name => !!name && me.includes(String(name).toLowerCase())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(TABLE).select('*').order('kind').order('test_no').order('id')
    if (error) {
      const text = `${error.code || ''} ${error.message || ''}`
      if (/42P01|PGRST205|does not exist|schema cache/i.test(text)) setSetup(true)
      else setMsg('Could not load: ' + error.message)
      setRows([])
    } else { setSetup(false); setRows(data || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  const loadMats = useCallback(async () => {
    const { data, error } = await supabase.from(MAT_TABLE).select('*').order('created_at', { ascending: false })
    if (error) { setMatSetup(true); setMats([]) } else { setMatSetup(false); setMats(data || []) }
  }, [])
  useEffect(() => { loadMats() }, [loadMats])
  const loadExtra = useCallback(async () => {
    const [a, b] = await Promise.all([supabase.from(SYL_TABLE).select('*'), supabase.from(MARKS_TABLE).select('*').order('test_no').order('batch')])
    if (a.error || b.error) { setMarksSetup(true); return }
    setMarksSetup(false)
    const m = {}; (a.data || []).forEach(r => { m[r.test_no + '|' + r.subject] = r.chapter || '' }); setSyl(m)
    setMarks(b.data || [])
  }, [])
  useEffect(() => { loadExtra() }, [loadExtra])
  const saveChapter = async (test_no, subject, chapter) => {
    if ((syl[test_no + '|' + subject] || '') === chapter) return
    setSyl(m => ({ ...m, [test_no + '|' + subject]: chapter }))
    const { error } = await supabase.from(SYL_TABLE).upsert({ test_no, subject, chapter, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }, { onConflict: 'test_no,subject' })
    setMsg(error ? '❌ ' + error.message : '✅ Chapter saved')
  }
  const saveMarks = async () => {
    const d = markDraft
    const row = { test_no: Number(d.test_no), batch: d.batch.trim(), entered_by: currentUser?.name || '' }
    for (const [k, , max] of MARK_COLS) {
      if (d[k] === '') { row[k] = null; continue }
      const v = Number(d[k]); if (Number.isNaN(v) || v < 0 || v > max) return setMsg(`❌ ${k} must be 0–${max}`)
      row[k] = v
    }
    const { error } = await supabase.from(MARKS_TABLE).upsert(row, { onConflict: 'test_no,batch' })
    if (error) return setMsg('❌ ' + error.message)
    setMsg('✅ Marks saved'); setMarkDraft({ ...markDraft, maths: '', reasoning: '', grammar: '', gk: '' }); loadExtra()
  }
  const deleteMarks = async r => {
    if (!window.confirm('Delete this entry?')) return
    const { error } = await supabase.from(MARKS_TABLE).delete().eq('id', r.id)
    if (error) return setMsg('❌ ' + error.message)
    loadExtra()
  }
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 4500); return () => clearTimeout(t) }, [msg])

  const tests = useMemo(() => rows.filter(r => r.kind === 'test'), [rows])
  const practice = useMemo(() => rows.filter(r => r.kind === 'practice'), [rows])
  const byCell = useMemo(() => {
    const m = {}
    tests.forEach(r => { m[r.test_no + '|' + r.subject] = r })
    return m
  }, [tests])

  const total = rows.length
  const seedCount = buildSeedRows().length
  const submitted = rows.filter(r => r.status !== 'Pending').length
  const approved = rows.filter(r => r.status === 'Approved').length
  const overdue = rows.filter(r => isOverdue(r, today)).length
  const daysToDeadline = dayDiff(today, SUBMISSION_DEADLINE)
  const nextTest = TESTS.find(t => t.date >= today)

  // ── actions ────────────────────────────────────────────────────────────
  const allowedStatuses = task => {
    const s = task.status
    if (isAdmin) return STATUS_FLOW.filter(x => x !== s)
    if (!canEdit) return []
    const out = []
    if (isMe(task.setter)) { if (s === 'Pending') out.push('Submitted'); if (s === 'Submitted') out.push('Pending') }
    if (task.verifier && isMe(task.verifier)) { if (s === 'Submitted') out.push('Verified'); if (s === 'Verified') out.push('Submitted') }
    return out
  }

  const saveTask = async (task, patch) => {
    setBusy(true)
    const next = { ...patch, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
    if (patch.status) {
      const keep = STATUS_FLOW.indexOf(patch.status)
      next.submitted_on = keep >= 1 ? (task.submitted_on || today) : null
      next.verified_on = keep >= 2 ? (task.verified_on || today) : null
      next.approved_on = keep >= 3 ? (task.approved_on || today) : null
    }
    const { error } = await supabase.from(TABLE).update(next).eq('id', task.id)
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return false }
    setRows(rs => rs.map(r => (r.id === task.id ? { ...r, ...next } : r)))
    setSel(s => (s && s.id === task.id ? { ...s, ...next } : s))
    setMsg('✅ Saved')
    return true
  }

  const createAllotment = async () => {
    setBusy(true)
    const { error } = await supabase.from(TABLE).upsert(buildSeedRows(), { onConflict: 'kind,test_no,subject,setter', ignoreDuplicates: true })
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return }
    setMsg('✅ Allotment created')
    load()
  }

  const exportCsv = () => {
    const head = ['Kind', 'Test', 'Subject', 'Setter', 'Verifier', 'Questions', 'Due', 'Status', 'Submitted on', 'Verified on', 'Approved on', 'Remarks']
    const lines = [head.join(',')].concat(rows.map(r => [
      r.kind, r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice', r.subject, fullName(r.setter), r.verifier ? fullName(r.verifier) : '',
      r.question_count ?? '', dueFor(r), r.status, r.submitted_on || '', r.verified_on || '', r.approved_on || '', r.remarks || '',
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')))
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'Mission_Sainik_2027_tasks.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const printNotice = () => {
    const rowsHtml = TESTS.map(t => `<tr><td><b>${t.id}</b></td><td>${esc(fmt(t.date))}</td><td>${esc(dayName(t.date))}</td><td>${esc(fmtShort(t.drafts))}</td><td>${esc(fmtShort(t.verify))}</td><td>${esc(fmtShort(t.print))}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Notice – Mission Sainik 2027</title>
<style>@page{size:A4;margin:14mm}body{font-family:'Times New Roman',serif;color:#111827;font-size:12.5px;line-height:1.45}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:8px}.lh h1{margin:0;font-size:21px;color:#132a4f;letter-spacing:.5px}
.lh div{font-size:11.5px}.ref{display:flex;justify-content:space-between;font-weight:bold;margin:10px 0}
h2{text-align:center;text-decoration:underline;letter-spacing:3px;color:#132a4f;margin:8px 0 4px}
.sub{text-align:center;font-weight:bold;margin-bottom:10px}ol{padding-left:20px}li{margin-bottom:5px;text-align:justify}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}th{background:#132a4f;color:#fff;text-align:left}
th,td{border:1px solid #7a8194;padding:3px 6px}.sig{margin-top:26px;text-align:right}</style></head><body>
<div class="lh"><h1>GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE (GNSI)</h1><div>Khangabok, Thoubal, Manipur · Established 2016</div><div><b>OFFICE OF THE PRINCIPAL</b></div></div>
<div class="ref"><span>No. ${esc(ORDER_NO)}</span><span>Date: ${esc(fmt(ORDER_DATE))}</span></div>
<h2>NOTICE</h2><div class="sub">Schedule of 20 Pre Mock Tests under Mission Sainik 2027 and submission of study material by Question Setters.</div>
<ol><li>The Institute shall conduct twenty (20) Pre Mock Tests, PMT-01 to PMT-20, on alternate days from ${esc(fmt(TESTS[0].date))} to ${esc(fmt(TESTS[19].date))}, in the latest AISSEE pattern. Each test has 150 questions for 300 marks, in six sections of 25 questions at 2 marks each.</li>
<li><b>All study material</b> (the question sections of all twenty tests and the practice question bank) shall be submitted at the office of the Head of the Institute <b>on or before ${esc(fmt(SUBMISSION_DEADLINE))}</b>. The material for PMT-01 and PMT-02 is due on ${esc(fmtShort(TESTS[0].drafts))} and ${esc(fmtShort(TESTS[1].drafts))}.</li>
<li>Every teacher on the Question Setting Panel sets questions and verifies a colleague's questions, never their own.</li>
<li>No test or deadline falls on 13 December, 27 December 2026 or 1 January 2027.</li>
<li>Any deviation requires the prior written approval of the Principal.</li></ol>
<table><thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Drafts due</th><th>Verification</th><th>Final &amp; print</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<div class="sig"><b>(Moirangthem Himan Singh)</b><br>Founder &amp; Principal</div>
<script>window.onload=function(){window.print()}<\/script></body></html>`
    const w = window.open('', '_blank')
    if (!w) { setMsg('❌ Allow pop-ups to print the notice'); return }
    w.document.write(html); w.document.close()
  }

  // ── shared bits ────────────────────────────────────────────────────────
  const sectionStats = r => ({ done: r.filter(x => x.status !== 'Pending').length, ok: r.filter(x => x.status === 'Approved').length, n: r.length })
  const tabs = [
    { id: 'overview',   label: 'Overview',    icon: PIcon.chart },
    { id: 'schedule',   label: 'Schedule',    icon: PIcon.calendar },
    { id: 'insights',   label: 'Insights',    icon: PIcon.chart },
    { id: 'mock',       label: 'Mock series', icon: PIcon.calendar },
    { id: 'allotment',  label: 'Allotment',   icon: PIcon.list },
    { id: 'mine',       label: isAdmin ? 'All tasks' : 'My tasks', icon: PIcon.pen, badge: isAdmin ? 0 : rows.filter(r => (isMe(r.setter) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted')).length },
    { id: 'practice',   label: 'Practice bank', icon: PIcon.folder },
    { id: 'syllabus',   label: 'Syllabus',    icon: PIcon.list },
    { id: 'marks',      label: 'Marks tracker', icon: PIcon.chart },
    { id: 'material',   label: 'Study material', icon: PIcon.folder },
    { id: 'panel',      label: 'Panel',       icon: PIcon.users },
  ]

  // ── screens ────────────────────────────────────────────────────────────
  const Overview = () => {
    const subjectStats = SUBJECTS.map(s => ({ s, ...sectionStats(tests.filter(r => r.subject === s.label)) }))
    return (
      <>
        <PremiumCard title="Deadline" subtitle="All study material at the Head of the Institute's office">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: PX.navy, color: PX.goldLt, borderRadius: 14, padding: '10px 16px', textAlign: 'center', minWidth: 84 }}>
              <div style={{ fontFamily: PX.serif, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{parse(SUBMISSION_DEADLINE).getDate()}</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em' }}>NOV 2026</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: PX.serif, fontSize: 18, fontWeight: 600 }}>
                {daysToDeadline > 0 ? `${daysToDeadline} day${daysToDeadline > 1 ? 's' : ''} left` : daysToDeadline === 0 ? 'Due today' : `Passed ${-daysToDeadline} day${-daysToDeadline > 1 ? 's' : ''} ago`}
              </div>
              <div style={{ fontSize: 13, color: PX.sub, marginTop: 2 }}>PMT-01 is due {fmtShort(TESTS[0].drafts)} and PMT-02 {fmtShort(TESTS[1].drafts)}; everything else by {fmtShort(SUBMISSION_DEADLINE)}.</div>
              <div style={{ marginTop: 10 }}><Bar value={submitted} total={total} /></div>
              <div style={{ fontSize: 12, color: PX.sub, marginTop: 4 }}>{submitted} of {total} sections and sets submitted</div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard title="Progress by subject" subtitle="Submitted · approved, out of 20 test sections" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: '14px 28px' }}>
            {subjectStats.map(({ s, done, ok, n }) => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  <span>{s.label}</span><span style={{ color: PX.sub }}>{done}/{n || 20} · {ok} approved</span>
                </div>
                <Bar value={done} total={n || 20} />
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard title="All 20 tests" subtitle="Tap a test to see its sections" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 4 : 10},minmax(0,1fr))`, gap: 8 }}>
            {TESTS.map(t => {
              const r = tests.filter(x => x.test_no === t.no)
              const st = sectionStats(r)
              const late = r.some(x => isOverdue(x, today))
              const full = r.length > 0 && st.ok === r.length
              const bg = late ? PX.badBg : full ? PX.okBg : st.done ? PX.goldBg : '#fff'
              const fg = late ? PX.bad : full ? PX.ok : st.done ? PX.gold : PX.sub
              return (
                <button key={t.no} type="button" onClick={() => { setFilterTest(t.no); setTab('allotment') }}
                  style={{ border: `1px solid ${PX.line2}`, background: bg, color: fg, borderRadius: 12, padding: '8px 4px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontFamily: PX.serif, fontSize: 16, fontWeight: 700 }}>{String(t.no).padStart(2, '0')}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700 }}>{st.done}/{r.length || 6}</div>
                </button>
              )
            })}
          </div>
        </PremiumCard>

        {isAdmin && total < seedCount && (
          <PremiumCard title="Create allotment" subtitle={`${total} of ${seedCount} rows exist`} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: PX.sub, marginBottom: 10 }}>Creates the 20 tests × 6 sections and the 13 practice sets from the Office Order. Existing rows are left as they are.</div>
            <button className="px-btn gold" disabled={busy} onClick={createAllotment}>{busy ? 'Creating…' : 'Create allotment'}</button>
          </PremiumCard>
        )}
      </>
    )
  }

  const Schedule = () => (
    <PremiumCard title="Schedule of Pre Mock Tests" subtitle={`Office Order ${ORDER_NO} · tests on alternate days`} bodyStyle={{ padding: 0 }}
      right={<span style={{ fontSize: 11.5, color: PX.sub }}>No test or deadline on 13 Dec, 27 Dec, 1 Jan</span>}>
      <div style={{ overflowX: 'auto' }}>
        <table className="px-table">
          <thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Drafts due</th><th>Verification</th><th>Final &amp; print</th><th>Sections</th><th>Status</th></tr></thead>
          <tbody>
            {TESTS.map(t => {
              const r = tests.filter(x => x.test_no === t.no)
              const st = sectionStats(r)
              const late = r.some(x => isOverdue(x, today))
              const done = r.length > 0 && st.ok === r.length
              const upcoming = nextTest && nextTest.no === t.no
              return (
                <tr key={t.no} style={dayName(t.date) === 'Sunday' ? { background: PX.tint } : undefined}>
                  <td><b>{t.id}</b>{upcoming && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: PX.gold }}>NEXT</span>}</td>
                  <td>{fmt(t.date)}</td>
                  <td>{dayName(t.date)}{dayName(t.date) === 'Sunday' ? ' *' : ''}</td>
                  <td>{fmtShort(t.drafts)}</td><td>{fmtShort(t.verify)}</td><td>{fmtShort(t.print)}</td>
                  <td>{st.done}/{r.length || 6} in · {st.ok} approved</td>
                  <td>{r.length ? <Chip status={done ? 'Approved' : st.done ? 'Submitted' : 'Pending'} overdue={late && !done} small /> : <span style={{ color: PX.faint }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', fontSize: 12, color: PX.sub }}>* Sunday, a working day. The 1 Jan test moved to 2 Jan; the tests start right after the JNVST ({fmtShort(JNVST[0])}–{fmtShort(JNVST[3])}).</div>
    </PremiumCard>
  )

  const daysToExam = dayDiff(today, EXAM_DATE)
  const nextMock = MOCK_TESTS.find(t => t.date >= today)
  const MockSeries = () => (
    <>
      <PremiumCard title="Sainik Mock Test Series" subtitle="10 – 30 January 2027 · 20 tests, one every available day · AISSEE pattern: 125 questions, 300 marks, 150 minutes, no negative marking">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
          {MOCK_SECTIONS.map(x => (
            <div key={x.label} style={{ padding: 12, borderRadius: 12, background: PX.tint, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: PX.sub, fontWeight: 700 }}>{x.label}</div>
              <div style={{ fontFamily: PX.serif, fontSize: 22, color: PX.navy }}>{x.q} Q</div>
              <div style={{ fontSize: 12, color: PX.sub }}>{x.marks} marks</div>
            </div>
          ))}
        </div>
      </PremiumCard>
      <PremiumCard title="Mock test schedule" bodyStyle={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table">
            <thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Status</th></tr></thead>
            <tbody>{MOCK_TESTS.map(t => {
              const st = t.date < today ? 'Held' : t.date === today ? 'Today' : (nextMock && nextMock.no === t.no ? 'Next' : 'Upcoming')
              return (
                <tr key={t.no} style={st === 'Today' || st === 'Next' ? { background: PX.tint } : undefined}>
                  <td><b>{t.id}</b></td><td>{fmt(t.date)}</td><td>{dayName(t.date)}</td>
                  <td style={{ fontWeight: 700, color: st === 'Held' ? PX.sub : st === 'Today' ? PX.gold : PX.navy }}>{st}{st === 'Upcoming' || st === 'Next' ? ` · in ${dayDiff(today, t.date)}d` : ''}</td>
                </tr>)
            })}</tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 12, color: PX.sub }}>Duration, OMR format and the Daily Class Test papers are notified separately. Marks for the Daily Class Tests go in the Marks tracker tab.</div>
      </PremiumCard>
    </>
  )

  // ── Insights: analytics + early-warning on top of the data already entered ──
  const Insights = () => {
    const pct = (v, m) => (v == null ? null : (Number(v) / m) * 100)
    // per test: class average per subject (%), overall (%)
    const perTest = TESTS.map(t => {
      const es = marks.filter(r => r.test_no === t.no)
      if (!es.length) return null
      const sub = MARK_COLS.map(([k, l, m]) => { const v = es.filter(r => r[k] != null); return { k, l, avg: v.length ? v.reduce((a, r) => a + pct(r[k], m), 0) / v.length : null } })
      const tots = es.map(r => MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0))
      return { t, n: es.length, sub, overall: (tots.reduce((a, b) => a + b, 0) / tots.length / 120) * 100 }
    }).filter(Boolean)
    const weak = perTest.flatMap(p => p.sub.filter(x => x.avg != null && x.avg < 60).map(x => ({ t: p.t, ...x })))
    const subjLabel = { maths: 'Mathematics', reasoning: 'Reasoning', grammar: 'English Grammar', gk: 'General Knowledge' }
    // rank by batch / student: average total across their tests
    const byName = {}
    marks.forEach(r => { const n = r.batch || '(no name)'; (byName[n] = byName[n] || []).push(MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0)) })
    const ranks = Object.entries(byName).map(([n, v]) => ({ n, avg: v.reduce((a, b) => a + b, 0) / v.length, tests: v.length })).sort((a, b) => b.avg - a.avg)
    // delivery risk
    const open = rows.filter(r => r.status === 'Pending')
    const late = open.filter(r => isOverdue(r, today))
    const soon = open.filter(r => !isOverdue(r, today) && dayDiff(today, dueFor(r)) <= 3)
    const pace = daysToDeadline > 0 ? Math.ceil(open.length / daysToDeadline) : open.length
    const bySetter = {}; open.forEach(r => { (bySetter[r.setter] = bySetter[r.setter] || []).push(r) })
    const setters = Object.entries(bySetter).map(([n, l]) => ({ n, l, late: l.filter(r => isOverdue(r, today)).length })).sort((a, b) => b.late - a.late || b.l.length - a.l.length)
    const remind = s => {
      const txt = `Dear ${fullName(s.n)}, ${s.l.length} Mission Sainik task(s) pending${s.late ? ` (${s.late} overdue)` : ''}: ` +
        s.l.slice(0, 6).map(r => `${r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice'} ${r.subject} (due ${fmtShort(dueFor(r))})`).join('; ') +
        `. Please submit to the Head of the Institute's office by ${fmt(SUBMISSION_DEADLINE)}. — GNSI (${ORDER_NO})`
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener')
    }
    // difficulty quality
    const mixed = rows.filter(r => r.easy_count != null)
    const mixBad = mixed.filter(r => { const t = (r.easy_count || 0) + (r.medium_count || 0) + (r.hard_count || 0); return t && (Math.abs(r.easy_count / t * 100 - 40) > 10 || Math.abs(r.medium_count / t * 100 - 40) > 10 || Math.abs(r.hard_count / t * 100 - 20) > 10) })
    // trend line
    const W = 560, H = 150, pad = 28
    const pts = perTest.map((p, i) => [pad + (perTest.length > 1 ? (i / (perTest.length - 1)) * (W - 2 * pad) : (W - 2 * pad) / 2), H - pad - (p.overall / 100) * (H - 2 * pad), p])
    const card = (label, val, sub, bad) => (
      <div style={{ padding: 12, borderRadius: 12, background: bad ? PX.badBg : PX.tint }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: PX.sub }}>{label}</div>
        <div style={{ fontFamily: PX.serif, fontSize: 24, color: bad ? PX.bad : PX.navy }}>{val}</div>
        <div style={{ fontSize: 11.5, color: PX.sub }}>{sub}</div>
      </div>
    )
    return (
      <>
        <PremiumCard title="Delivery forecast" subtitle={`Submission deadline ${fmt(SUBMISSION_DEADLINE)} · ${daysToDeadline > 0 ? daysToDeadline + ' days left' : 'deadline passed'}`}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            {card('Still pending', open.length, `of ${rows.length} sections`)}
            {card('Overdue', late.length, 'past their own due date', late.length > 0)}
            {card('Due in 3 days', soon.length, 'needs a nudge')}
            {card('Pace needed', pace + '/day', 'sections to clear daily', pace > 15)}
          </div>
          {setters.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {setters.map(x => (
                <div key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${PX.line || '#eef1f6'}`, flexWrap: 'wrap' }}>
                  <b style={{ minWidth: 130 }}>{fullName(x.n)}</b>
                  <span style={{ flex: 1, fontSize: 12.5, color: x.late ? PX.bad : PX.sub }}>{x.l.length} pending{x.late ? ` · ${x.late} overdue` : ''}</span>
                  <button className="px-hbtn" onClick={() => remind(x)}>💬 Remind on WhatsApp</button>
                </div>
              ))}
            </div>
          )}
        </PremiumCard>
        <PremiumCard title="Question quality" subtitle="Difficulty mix of submitted sections vs the notice (≈40 / 40 / 20)">
          <div style={{ fontSize: 13, color: PX.sub }}>
            {mixed.length ? `${mixed.length} section(s) have a mix recorded · ` : 'No difficulty mix recorded yet — setters add it in the task dialog. '}
            {mixBad.length ? <b style={{ color: PX.warn }}>{mixBad.length} off the 40/40/20 target: {mixBad.slice(0, 6).map(r => (r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice') + ' ' + r.subject).join(', ')}</b> : mixed.length ? <b style={{ color: PX.ok }}>all within target</b> : null}
          </div>
        </PremiumCard>
        <PremiumCard title="Performance trend" subtitle="Average score across all batches per Daily Class Test">
          {!perTest.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Enter marks in the Marks tracker to see the trend.</div> : (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 620 }} role="img" aria-label="Average score trend">
              <line x1={pad} x2={W - pad} y1={H - pad - 0.6 * (H - 2 * pad)} y2={H - pad - 0.6 * (H - 2 * pad)} stroke={PX.bad} strokeDasharray="4 4" opacity=".5" />
              <text x={W - pad} y={H - pad - 0.6 * (H - 2 * pad) - 4} fontSize="9" textAnchor="end" fill={PX.bad}>60% target</text>
              <polyline fill="none" stroke={PX.navy} strokeWidth="2" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} />
              {pts.map(p => <g key={p[2].t.no}><circle cx={p[0]} cy={p[1]} r="3.5" fill={p[2].overall < 60 ? PX.bad : PX.navy} /><text x={p[0]} y={H - 8} fontSize="9" textAnchor="middle" fill={PX.sub}>T{p[2].t.no}</text><text x={p[0]} y={p[1] - 7} fontSize="9" textAnchor="middle" fill={PX.sub}>{Math.round(p[2].overall)}</text></g>)}
            </svg>
          )}
        </PremiumCard>
        <PremiumCard title="Weak chapters to revisit" subtitle="Subject averages below 60% on a test, matched to the Syllabus plan">
          {!weak.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>{perTest.length ? '🎉 No subject is below 60%.' : 'No marks entered yet.'}</div> : weak.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${PX.line || '#eef1f6'}` : 'none', fontSize: 13, flexWrap: 'wrap' }}>
              <b style={{ minWidth: 70 }}>{w.t.id.replace('PMT', 'T')} · {fmtShort(w.t.date)}</b>
              <span style={{ flex: 1 }}>{subjLabel[w.k]}{syl[w.t.no + '|' + subjLabel[w.k]] ? ` — ${syl[w.t.no + '|' + subjLabel[w.k]]}` : ''}</span>
              <b style={{ color: PX.bad }}>{Math.round(w.avg)}%</b>
            </div>
          ))}
        </PremiumCard>
        <PremiumCard title="Leaderboard" subtitle="Average total /120 across tests entered per batch or student">
          {!ranks.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>No marks entered yet.</div> : ranks.map((r, i) => (
            <div key={r.n} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${PX.line || '#eef1f6'}` : 'none', fontSize: 13 }}>
              <b style={{ width: 28 }}>{i + 1}</b><span style={{ flex: 1 }}>{r.n}</span><span style={{ color: PX.sub }}>{r.tests} test(s)</span><b>{r.avg.toFixed(1)}</b>
            </div>
          ))}
        </PremiumCard>
      </>
    )
  }

  const Allotment = () => {
    const list = filterTest ? TESTS.filter(t => t.no === filterTest) : TESTS
    return (
      <PremiumCard title="Allotment" subtitle="Who sets each section. Tap a cell to update it."
        right={filterTest ? <button className="px-btn ghost" onClick={() => setFilterTest(0)}>Show all tests</button> : null} bodyStyle={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table" style={{ minWidth: 720 }}>
            <thead><tr><th>Test</th>{SUBJECTS.map(s => <th key={s.key}>{s.short}</th>)}</tr></thead>
            <tbody>
              {list.map(t => (
                <tr key={t.no}>
                  <td><b>{t.id}</b><div style={{ fontSize: 11, color: PX.sub }}>{fmtShort(t.date)}</div></td>
                  {SUBJECTS.map(s => {
                    const r = byCell[t.no + '|' + s.label]
                    if (!r) return <td key={s.key} style={{ color: PX.faint }}>—</td>
                    return (
                      <td key={s.key} style={{ cursor: 'pointer' }} onClick={() => setSel(r)}>
                        <div style={{ fontWeight: 600, color: PX.ink }}>{r.setter}</div>
                        <Chip status={r.status} overdue={isOverdue(r, today)} small />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No allotment yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : 'Ask the Principal to create it.'}</div>}
      </PremiumCard>
    )
  }

  const TaskRow = ({ r }) => {
    const late = isOverdue(r, today)
    const next = allowedStatuses(r)
    const quick = next.find(x => STATUS_FLOW.indexOf(x) === STATUS_FLOW.indexOf(r.status) + 1)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kind === 'test' ? `PMT-${String(r.test_no).padStart(2, '0')} · ` : 'Practice · '}{r.subject}</div>
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 2 }}>
            Setter {fullName(r.setter)}{r.verifier ? ` · verifier ${fullName(r.verifier)}` : ''} · {r.question_count ?? '—'} questions · due {fmtShort(dueFor(r))}
          </div>
        </div>
        <Chip status={r.status} overdue={late} />
        {quick && <button className="px-btn gold" disabled={busy} onClick={() => saveTask(r, { status: quick })}>Mark {quick.toLowerCase()}</button>}
        <button className="px-btn ghost" onClick={() => setSel(r)}>Open</button>
      </div>
    )
  }

  const Mine = () => {
    const names = Array.from(new Set(rows.flatMap(r => [r.setter, r.verifier]).filter(Boolean))).sort()
    const mine = rows
      .filter(r => (isAdmin ? (!person || r.setter === person || r.verifier === person) : (isMe(r.setter) || isMe(r.verifier))))
      .sort((a, b) => dueFor(a).localeCompare(dueFor(b)) || a.test_no - b.test_no)
    return (
      <PremiumCard title={isAdmin ? 'All tasks' : 'My tasks'} subtitle={isAdmin ? 'Filter by teacher, update any task, export to CSV' : 'Sections you set or verify, earliest deadline first'}
        right={isAdmin ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="px-input" style={{ width: 170 }} value={person} onChange={e => setPerson(e.target.value)} aria-label="Filter by teacher">
              <option value="">All teachers</option>
              {names.map(n => <option key={n} value={n}>{fullName(n)}</option>)}
            </select>
            <button className="px-btn ghost" onClick={exportCsv}>Export CSV</button>
          </div>) : null}
        bodyStyle={{ padding: 0 }}>
        {mine.length === 0
          ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>{isAdmin ? 'Nothing to show.' : `No tasks matched “${currentUser?.name || 'your name'}”. Ask the Principal to link your name, or see the Allotment tab.`}</div>
          : mine.map(r => <TaskRow key={r.id} r={r} />)}
      </PremiumCard>
    )
  }

  const Practice = () => (
    <PremiumCard title="Practice question bank" subtitle="Latest pattern · verified by another teacher of the subject · issued to students by 15 Dec" bodyStyle={{ padding: 0 }}>
      {practice.length === 0 && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No practice sets yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : ''}</div>}
      {practice.map(r => <TaskRow key={r.id} r={r} />)}
      {practice.length > 0 && (
        <div style={{ padding: '12px 16px', fontSize: 13, color: PX.sub }}>
          {practice.reduce((n, r) => n + (r.question_count || 0), 0)} questions so far; Sir Sumanta's Mathematics count and the subject of Sir Deepak's set are to be notified.
        </div>
      )}
    </PremiumCard>
  )

  const Panel = () => (
    <>
      <div style={{ fontSize: 13, color: PX.sub, margin: '0 2px 12px' }}>Every teacher listed sets questions for both the tests and the practice bank. Nobody verifies their own questions.</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,minmax(0,1fr))', gap: 14 }}>
        {SUBJECTS.map(s => {
          const list = PANEL[s.key]
          return (
            <PremiumCard key={s.key} title={s.label} subtitle={s.key === 'gk' ? 'Checked by Sir Arunkumar or the Principal' : list.length === 2 ? 'Each verifies the other' : list.join(' → ') + ' → ' + list[0]}>
              {list.map(n => {
                const mineRows = tests.filter(r => r.subject === s.label && r.setter === n)
                return (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5, borderBottom: `1px solid ${PX.line}` }}>
                    <span style={{ fontWeight: 600 }}>{fullName(n)}</span>
                    <span style={{ color: PX.sub }}>{mineRows.length || '—'} tests · {mineRows.filter(r => r.status !== 'Pending').length} in</span>
                  </div>
                )
              })}
            </PremiumCard>
          )
        })}
      </div>
    </>
  )

  const saveMaterial = async () => {
    const d = matDraft
    if (!d.title.trim()) return setMsg('❌ Give the material a title.')
    if (!d.file && !d.link_url.trim()) return setMsg('❌ Choose a file or paste a link.')
    if (d.file && d.file.size > 50 * 1024 * 1024) return setMsg('❌ File is over 50 MB.')
    setBusy(true)
    try {
      let file_path = null, file_name = null
      if (d.file) {
        const safe = d.file.name.replace(/[^\w.-]+/g, '_')
        const who = (currentUser?.name || 'staff').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        file_path = `mission-sainik/${who}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage.from(MAT_BUCKET).upload(file_path, d.file, { upsert: false })
        if (upErr) throw upErr
        file_name = d.file.name
      }
      const { error } = await supabase.from(MAT_TABLE).insert({
        title: d.title.trim(), subject: d.subject || null, test_no: Number(d.test_no) || 0,
        link_url: d.link_url.trim() || null, file_path, file_name, note: d.note.trim() || null, uploaded_by: currentUser?.name || '',
      })
      if (error) throw error
      setMatDraft({ title: '', subject: '', test_no: 0, link_url: '', note: '', file: null }); setFileKey(k => k + 1)
      setMsg('✅ Material added.'); loadMats()
    } catch (e) { setMsg('❌ ' + (e.message || 'Upload failed')) }
    setBusy(false)
  }
  const openMaterial = async m => {
    if (m.link_url) return window.open(m.link_url, '_blank', 'noopener')
    const { data, error } = await supabase.storage.from(MAT_BUCKET).createSignedUrl(m.file_path, 3600)
    if (error) return setMsg('❌ ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const deleteMaterial = async m => {
    if (!window.confirm(`Delete “${m.title}”?`)) return
    if (m.file_path) await supabase.storage.from(MAT_BUCKET).remove([m.file_path])
    const { error } = await supabase.from(MAT_TABLE).delete().eq('id', m.id)
    if (error) return setMsg('❌ ' + error.message)
    loadMats()
  }
  const inp = { padding: '9px 10px', borderRadius: 10, border: `1px solid ${PX.line || '#d8dee9'}`, fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const setupNote = marksSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261203_mission_sainik_syllabus_marks.sql</b> in Supabase to enable this tab.</div>
  const syllabusTab = (
    <>{setupNote}
      <PremiumCard title="Syllabus plan" subtitle="Chapter for each section of each test — type and click away to save. Setters see it on their task." bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
          <thead><tr style={{ textAlign: 'left', color: PX.sub }}><th style={{ padding: 8 }}>Test</th>{SUBJECTS.map(x => <th key={x.key} style={{ padding: 8 }}>{x.short}</th>)}</tr></thead>
          <tbody>{TESTS.map(t => (
            <tr key={t.no} style={{ borderTop: `1px solid ${PX.line || '#eef1f6'}` }}>
              <td style={{ padding: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.id}<div style={{ fontWeight: 400, color: PX.sub, fontSize: 11 }}>{fmtShort(t.date)}</div></td>
              {SUBJECTS.map(x => (
                <td key={x.key} style={{ padding: 4 }}>
                  <input key={t.no + x.label + (syl[t.no + '|' + x.label] ?? '')} className="px-input" defaultValue={syl[t.no + '|' + x.label] || ''} placeholder="Chapter"
                    onBlur={e => saveChapter(t.no, x.label, e.target.value.trim())} style={{ fontSize: 12 }} />
                </td>
              ))}
            </tr>))}
          </tbody>
        </table>
      </PremiumCard>
    </>
  )
  const marksTab = (
    <>{setupNote}
      <PremiumCard title="Daily Class Test marks" subtitle="Maths /60 · Reasoning, Grammar, GK /20 each · 120 in all. Entering the same test and batch again overwrites it.">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: 10 }}>
          <select className="px-input" value={markDraft.test_no} onChange={e => setMarkDraft({ ...markDraft, test_no: e.target.value })}>{TESTS.map(t => <option key={t.no} value={t.no}>T{t.no} · {fmtShort(t.date)}</option>)}</select>
          <input className="px-input" placeholder="Batch / student" value={markDraft.batch} onChange={e => setMarkDraft({ ...markDraft, batch: e.target.value })} />
          {MARK_COLS.map(([k, lbl, max]) => <input key={k} className="px-input" type="number" min="0" max={max} placeholder={`${lbl} /${max}`} value={markDraft[k]} onChange={e => setMarkDraft({ ...markDraft, [k]: e.target.value })} />)}
        </div>
        <button className="px-btn gold" style={{ marginTop: 12 }} onClick={saveMarks}>Save marks</button>
      </PremiumCard>
      <PremiumCard title={`Entries (${marks.length})`} subtitle="Red = below 60% — revisit that chapter" bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        {!marks.length ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No marks entered yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead><tr style={{ textAlign: 'left', color: PX.sub }}><th style={{ padding: 8 }}>Test</th><th>Batch</th>{MARK_COLS.map(([k, l, m]) => <th key={k}>{l} /{m}</th>)}<th>Total /120</th><th /></tr></thead>
            <tbody>{marks.map(r => {
              const tot = MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0)
              return (
                <tr key={r.id} style={{ borderTop: `1px solid ${PX.line || '#eef1f6'}` }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>T{r.test_no}</td><td>{r.batch || '—'}</td>
                  {MARK_COLS.map(([k, , m]) => <td key={k} style={{ color: r[k] != null && r[k] / m < 0.6 ? PX.bad : undefined, fontWeight: r[k] != null && r[k] / m < 0.6 ? 700 : 400 }}>{r[k] ?? '—'}</td>)}
                  <td style={{ fontWeight: 700, color: tot / 120 < 0.6 ? PX.bad : PX.ok }}>{tot}</td>
                  <td><button className="px-hbtn" onClick={() => deleteMarks(r)} aria-label="Delete">🗑</button></td>
                </tr>)
            })}</tbody>
          </table>
        )}
      </PremiumCard>
    </>
  )
  const materialTab = (
    <>
      {matSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261202_mission_sainik_materials.sql</b> in Supabase to enable study material.</div>}
      <PremiumCard title="Upload study material" subtitle="Notes, PDFs, images or a link — visible to all staff">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10 }}>
          <input style={inp} placeholder="Title" value={matDraft.title} onChange={e => setMatDraft({ ...matDraft, title: e.target.value })} />
          <select style={inp} value={matDraft.subject} onChange={e => setMatDraft({ ...matDraft, subject: e.target.value })}>
            <option value="">All subjects</option>{SUBJECTS.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}
          </select>
          <select style={inp} value={matDraft.test_no} onChange={e => setMatDraft({ ...matDraft, test_no: e.target.value })}>
            <option value={0}>All tests</option>{TESTS.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}
          </select>
          <input key={fileKey} style={inp} type="file" onChange={e => setMatDraft({ ...matDraft, file: e.target.files?.[0] || null })} />
          <input style={inp} placeholder="…or paste a link (Drive, YouTube)" value={matDraft.link_url} onChange={e => setMatDraft({ ...matDraft, link_url: e.target.value })} />
          <input style={inp} placeholder="Note (optional)" value={matDraft.note} onChange={e => setMatDraft({ ...matDraft, note: e.target.value })} />
        </div>
        <button className="px-hbtn" style={{ marginTop: 12 }} disabled={busy} onClick={saveMaterial}>{busy ? 'Uploading…' : '⬆ Add material'}</button>
      </PremiumCard>
      <PremiumCard title={`Library (${mats.length})`}>
        {!mats.length && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>Nothing uploaded yet.</div>}
        {mats.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 4px', borderTop: `1px solid ${PX.line || '#eef1f6'}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>{m.link_url ? '🔗' : '📄'}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
              <div style={{ fontSize: 12, color: PX.sub }}>{[m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null, m.uploaded_by, fmtShort(String(m.created_at).slice(0, 10))].filter(Boolean).join(' · ')}{m.note ? ' — ' + m.note : ''}</div>
            </div>
            <button className="px-hbtn" onClick={() => openMaterial(m)}>Open</button>
            {(isAdmin || isMe(m.uploaded_by)) && <button className="px-hbtn" onClick={() => deleteMaterial(m)}>🗑</button>}
          </div>
        ))}
      </PremiumCard>
    </>
  )

  // ── render ─────────────────────────────────────────────────────────────
  if (setup) {
    return (
      <div className="px-root"><PremiumStyles />
        <div className="px-wrap">
          <PremiumCard title="One-time setup needed" subtitle="The Mission Sainik table is not in the database yet">
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Open Supabase → SQL editor and run <b>supabase/migrations/20261201_mission_sainik_tasks.sql</b>, then reload this page.
            </div>
          </PremiumCard>
        </div>
      </div>
    )
  }

  return (
    <div className="px-root">
      <PremiumStyles />
      <div className="px-wrap">
        <PremiumHero eyebrow="GNSI · Mission Sainik 2027" title="Pre Mock Tests" subtitle={`Search for Extra Ordinary · 20 tests · ${fmtShort(TESTS[0].date)} – ${fmt(TESTS[19].date)}`}
          icon={<span style={{ fontSize: 24 }}>🎖️</span>} isMobile={isMobile}
          actions={<>
            <button className="px-hbtn" onClick={printNotice}>🖨 Notice</button>
            <button className="px-hbtn" onClick={load} aria-label="Refresh">🔄</button>
          </>}
          stats={[
            { label: 'Next test', value: nextTest ? nextTest.id : 'Done', sub: nextTest ? `${fmtShort(nextTest.date)} · ${dayName(nextTest.date)}` : 'All 20 held' },
            { label: 'Submission', value: daysToDeadline > 0 ? daysToDeadline + 'd left' : daysToDeadline === 0 ? 'Today' : 'Closed', sub: 'by ' + fmtShort(SUBMISSION_DEADLINE) },
            { label: 'In', value: `${submitted}/${total || seedCount}`, sub: 'submitted or beyond' },
            { label: 'Approved', value: approved, sub: 'ready to print', tone: PX.goldLt },
            { label: 'AISSEE 2027', value: daysToExam > 0 ? daysToExam + 'd' : daysToExam === 0 ? 'Today' : 'Held', sub: fmtShort(EXAM_DATE) + (nextMock ? ' · next mock ' + fmtShort(nextMock.date) : ''), tone: PX.goldLt },
            { label: 'Overdue', value: overdue, sub: 'not submitted', tone: overdue ? '#fca5a5' : '#fff' },
          ]} />
        <PremiumTabs tabs={tabs} active={tab} onChange={setTab} style={{ marginBottom: 14 }} />
        {msg && <div role="status" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 12, background: msg.startsWith('❌') ? PX.badBg : PX.okBg, color: msg.startsWith('❌') ? PX.bad : PX.ok, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading…</div> : (
          <>
            {tab === 'overview' && <Overview />}
            {tab === 'schedule' && <Schedule />}
            {tab === 'insights' && <Insights />}
            {tab === 'mock' && <MockSeries />}
            {tab === 'allotment' && <Allotment />}
            {tab === 'mine' && <Mine />}
            {tab === 'practice' && <Practice />}
            {tab === 'syllabus' && syllabusTab}
            {tab === 'marks' && marksTab}
            {tab === 'material' && materialTab}
            {tab === 'panel' && <Panel />}
          </>
        )}
      </div>
      {sel && <TaskDialog key={sel.id} chapter={syl[sel.test_no + '|' + sel.subject]} sel={sel} today={today} isAdmin={isAdmin} allowed={allowedStatuses(sel)} busy={busy} onSave={saveTask} onClose={() => setSel(null)} />}
    </div>
  )
}

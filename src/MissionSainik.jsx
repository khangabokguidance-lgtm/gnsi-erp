/* eslint-disable react-hooks/set-state-in-effect -- data loaders set state after fetching, as elsewhere in the portal */
// MissionSainik.jsx — GNSI Portal · Management → Mission Sainik
// Tracks the question setting for "Mission Sainik 2027 – Search for Extra Ordinary":
// 20 Pre Mock Tests (6 sections × 25 questions each) plus the practice question bank.
// Who sets what, who verifies, deadlines, and progress: Pending → Submitted → Verified → Approved.
// Plan and deadlines: missionSainikData.js (Office Order GNSI/MS-2027/PMT/2026/01).
// Progress is stored in the `mission_sainik_tasks` table (migration 20261201_mission_sainik_tasks.sql).
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { supabase } from './supabase'
import MockTestAnalyzer from './MockTestAnalyzer'
import MissionSainikBuilder from './MissionSainikBuilder'
import MissionSainikBoundary from './MissionSainikBoundary'
import MissionSainikGuide from './MissionSainikGuide'
import { isAdminRole } from './roles'
import { fetchAll } from './lib/missionSainikQuestions'
import { buildNoticeHtml } from './lib/missionSainikNotice'
import { PremiumStyles, PremiumCard, PX } from './premiumUI'
import MissionSainikShell from './MissionSainikShell'
import { NAV_GROUPS } from './lib/missionSainikNav'
import MissionSainikHome from './MissionSainikHome'
import MissionSainikAdmin from './MissionSainikAdmin'
import { PersonCell, Pill, MiniBar, ScorePill } from './MissionSainikUI'
import { computeGame } from './lib/missionSainikGame'
import {
  ORDER_NO as DEFAULT_ORDER_NO, ORDER_DATE as DEFAULT_ORDER_DATE, SUBMISSION_DEADLINE as DEFAULT_DEADLINE, SUBJECTS, PANEL, TESTS, JNVST,
  buildSeedRows, PRACTICE_PANEL, fullName, STATUS_FLOW, nameMatches, safeUrl, EXAM_DATE as DEFAULT_EXAM_DATE, MOCK_TESTS, MOCK_SECTIONS,
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

function dueForBase(task, deadline) {
  if (task.kind === 'practice') return deadline
  return TESTS[task.test_no - 1]?.drafts || deadline
}

function Chip({ status, overdue, small }) {
  const st = STATUS_STYLE[overdue ? 'Overdue' : status] || STATUS_STYLE.Pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: small ? '2px 9px' : '4px 11px', borderRadius: 99, fontSize: small ? 10.5 : 11.5, fontWeight: 700, color: st.fg, background: st.bg, border: `1px solid ${st.fg}22`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.fg }} />{overdue ? 'Overdue' : status}
    </span>
  )
}

function Bar({ value, total, color = PX.gold }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height: 8, borderRadius: 4, background: PX.line, overflow: 'hidden' }} role="img" aria-label={`${pct}% done`}>
      <div style={{ width: pct + '%', height: '100%', background: color === PX.gold ? 'linear-gradient(90deg,#b8923a,#e6c35e)' : color, borderRadius: 4, transition: 'width .6s ease' }} />
    </div>
  )
}

// Update dialog — a top-level component so typing is never lost when the screen behind it re-renders.
function TaskDialog({ sel, today, isAdmin, allowed, busy, onSave, onClose, chapter, deadline, people, onDelete }) {
    const dueFor = t => dueForBase(t, deadline)
    const isOverdue = (t, td) => t.status === 'Pending' && td > dueFor(t)
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
      <div className="msx-overlay" onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="msx-dialog" role="dialog" aria-modal="true" aria-label="Update task" onClick={e => e.stopPropagation()}
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
                        {[...new Set([...(people || ALL_PEOPLE), val].filter(Boolean))].map(n => <option key={n} value={n}>{fullName(n)}</option>)}
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
                {onDelete && <button className="px-btn ghost" disabled={busy} style={{ color: PX.bad, marginLeft: 'auto' }} onClick={() => onDelete(sel)}>🗑 Delete task</button>}
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

function MissionSainikInner({ currentUser }) {
  const isMobile = useIsMobile()
  const isRealAdmin = isAdminRole(currentUser?.role)
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
  const [settings, setSettings] = useState({})
  const [setForm, setSetForm] = useState(null)
  const [boom, setBoom] = useState(false)
  const [panelRows, setPanelRows] = useState([])
  const [panelDraft, setPanelDraft] = useState(null)       // { id?, subject_key, name, role }
  const [addTask, setAddTask] = useState(null)             // null | form for the Add task dialog
  const [editMarksId, setEditMarksId] = useState(null)
  const [editMat, setEditMat] = useState(null)
  const [bStart, setBStart] = useState({ test: 1, section: '', n: 0 })   // where the Practice Bank builder should open
  const [taskView, setTaskView] = useState('needs')   // needs | mine | all
  const [statusF, setStatusF] = useState('')
  const [subjF, setSubjF] = useState('')
  const [taskQ, setTaskQ] = useState('')
  const [taskLimit, setTaskLimit] = useState(30)
  const [auditRows, setAuditRows] = useState([])
  const [health, setHealth] = useState(null)
  const [bulk, setBulk] = useState({ subject: SUBJECTS[0].label, setter: '', verifier: '' })
  const SUBMISSION_DEADLINE = settings.deadline || DEFAULT_DEADLINE
  const ORDER_NO = settings.order_no || DEFAULT_ORDER_NO
  const ORDER_DATE = settings.order_date || DEFAULT_ORDER_DATE
  const EXAM_DATE = settings.exam_date || DEFAULT_EXAM_DATE
  const embargo = settings.embargo === 'on'
  const dueFor = t => dueForBase(t, SUBMISSION_DEADLINE)
  const isOverdue = (t, td) => t.status === 'Pending' && td > dueFor(t)
  const celebrate = () => { setBoom(true); setTimeout(() => setBoom(false), 2000) }
  const audit = (action, ref, detail) => { supabase.from('mission_sainik_audit').insert({ actor: currentUser?.name || '', action, ref: ref || null, detail: detail || null }).then(() => {}, () => {}) } // best-effort
  const loadPanel = useCallback(async () => {
    const { data, error } = await supabase.from('mission_sainik_panel').select('*').order('id')
    setPanelRows(error ? [] : data || [])
  }, [])
  useEffect(() => { loadPanel() }, [loadPanel])
  // Panel from the database when it has rows, otherwise the panel written in the code.
  const panelSetters = key => (panelRows.length ? panelRows.filter(r => r.subject_key === key && r.role === 'setter').map(r => r.name) : PANEL[key] || [])
  const panelForBuilder = panelRows.length ? {
    setters: Object.fromEntries(SUBJECTS.map(x => [x.key, panelSetters(x.key)])),
    practice: Object.fromEntries(SUBJECTS.map(x => [x.key, panelRows.filter(r => r.subject_key === x.key && r.role !== 'setter').map(r => r.name)])),
  } : null
  const peopleAll = panelRows.length ? [...new Set(panelRows.map(r => r.name))].sort() : ALL_PEOPLE
  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('mission_sainik_settings').select('*')
    const m = {}; (data || []).forEach(r => { m[r.key] = r.value }); setSettings(m)
  }, [])
  useEffect(() => { loadSettings() }, [loadSettings])
  const putSetting = async (key, value) => {
    const { error } = await supabase.from('mission_sainik_settings').upsert({ key, value: String(value), updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) { setMsg('❌ ' + error.message + ' (admins only; migration 20261209 must be run)'); return false }
    audit('setting_' + key.split(':')[0], key, { value: key === 'announcement' ? '(text)' : value }); await loadSettings(); return true
  }
  const delSetting = async key => {
    const { error } = await supabase.from('mission_sainik_settings').delete().eq('key', key)
    if (error) { setMsg('❌ ' + error.message); return false }
    audit('setting_clear_' + key.split(':')[0], key, null); await loadSettings(); return true
  }
  const [mats, setMats] = useState([])
  const [matSetup, setMatSetup] = useState(false)
  const [matDraft, setMatDraft] = useState({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null })
  const [fileKey, setFileKey] = useState(0)
  const [viewMat, setViewMat] = useState(null)
  const [syl, setSyl] = useState({})            // 'testNo|subject' -> chapter
  const [marks, setMarks] = useState([])
  const [markDraft, setMarkDraft] = useState({ test_no: 1, batch: '', maths: '', reasoning: '', grammar: '', gk: '' })
  const [marksSetup, setMarksSetup] = useState(false)
  const [institute, setInstitute] = useState({ name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur', academicYear: '2026-2027' })
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'exam_institute_config').single()
      .then(({ data }) => { try { if (data?.value) setInstitute(i => ({ ...i, ...JSON.parse(data.value) })) } catch { /* keep defaults */ } }, () => {})
  }, [])

  const isMe = name => nameMatches(currentUser?.name, name)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchAll(() => supabase.from(TABLE).select('*').order('kind').order('test_no').order('id'))
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
    const { data, error } = await fetchAll(() => supabase.from(MAT_TABLE).select('*').order('created_at', { ascending: false }).order('id'))
    if (error) { setMatSetup(true); setMats([]) } else { setMatSetup(false); setMats(data || []) }
  }, [])
  useEffect(() => { loadMats() }, [loadMats])
  const loadExtra = useCallback(async () => {
    const [a, b] = await Promise.all([fetchAll(() => supabase.from(SYL_TABLE).select('*').order('id')), fetchAll(() => supabase.from(MARKS_TABLE).select('*').order('test_no').order('batch').order('id'))])
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
    audit('marks_save', `T${row.test_no} ${row.batch}`, null); setMsg('✅ Marks saved'); setMarkDraft({ ...markDraft, maths: '', reasoning: '', grammar: '', gk: '' }); setEditMarksId(null); loadExtra()
  }
  const editMarks = r => {
    setMarkDraft({ test_no: r.test_no, batch: r.batch || '', maths: r.maths ?? '', reasoning: r.reasoning ?? '', grammar: r.grammar ?? '', gk: r.gk ?? '' })
    setEditMarksId(r.id); window.scrollTo?.({ top: 0, behavior: 'smooth' })
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
    if (patch.status && STATUS_FLOW.indexOf(patch.status) > STATUS_FLOW.indexOf(task.status)) celebrate()
    audit(patch.status ? 'task_status' : patch.setter !== task.setter || (patch.verifier || null) !== (task.verifier || null) ? 'task_reassign' : 'task_note', `${task.kind}:${task.test_no}:${task.subject}`, { from: task.status, to: patch.status || task.status, setter: patch.setter, verifier: patch.verifier })
    return true
  }

  const deleteTask = async task => {
    if (!window.confirm(`Delete ${task.kind === 'test' ? 'PMT-' + String(task.test_no).padStart(2, '0') + ' · ' : 'Practice · '}${task.subject} (${fullName(task.setter)})? This cannot be undone.`)) return
    setBusy(true)
    const { error } = await supabase.from(TABLE).delete().eq('id', task.id)
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message)
    audit('task_delete', `${task.kind}:${task.test_no}:${task.subject}`, { setter: task.setter, status: task.status })
    setSel(null); setMsg('🗑 Task deleted'); load()
  }
  const newTaskForm = kind => ({ kind, test_no: 1, subject: SUBJECTS[0].label, setter: '', verifier: '', question_count: kind === 'test' ? 25 : '' })
  const createTask = async () => {
    const f = addTask
    if (!f.setter.trim()) return setMsg('❌ Choose or type the setter.')
    if (!f.subject.trim()) return setMsg('❌ Enter the subject.')
    const row = { kind: f.kind, test_no: f.kind === 'test' ? Number(f.test_no) : 0, subject: f.subject.trim(), setter: f.setter.trim(), verifier: f.verifier.trim() || null,
      question_count: f.question_count === '' ? null : Number(f.question_count), status: 'Pending', updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
    setBusy(true)
    const { error } = await supabase.from(TABLE).insert(row)
    setBusy(false)
    if (error) return setMsg('❌ ' + (/duplicate|unique/i.test(error.message) ? 'That setter already has this section.' : error.message))
    audit('task_add', `${row.kind}:${row.test_no}:${row.subject}`, { setter: row.setter }); setAddTask(null); setMsg('✅ Task added'); load()
  }
  const createAllotment = async () => {
    setBusy(true)
    const { error } = await supabase.from(TABLE).upsert(buildSeedRows(), { onConflict: 'kind,test_no,subject,setter', ignoreDuplicates: true })
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message); return }
    setMsg('✅ Allotment created'); audit('create_allotment', null, { rows: buildSeedRows().length })
    load()
  }

  const exportCsv = () => {
    const head = ['Kind', 'Test', 'Subject', 'Setter', 'Verifier', 'Questions', 'Due', 'Status', 'Submitted on', 'Verified on', 'Approved on', 'Remarks']
    const lines = [head.join(',')].concat(rows.map(r => [
      r.kind, r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice', r.subject, fullName(r.setter), r.verifier ? fullName(r.verifier) : '',
      r.question_count ?? '', dueFor(r), r.status, r.submitted_on || '', r.verified_on || '', r.approved_on || '', r.remarks || '',
    ].map(v => { const t = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"' }).join(',')))
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'Mission_Sainik_2027_tasks.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const printNotice = () => {
    const syllabus = {}
    Object.entries(syl).forEach(([k, v]) => { const [n, subj] = k.split('|'); syllabus[n + '|' + subj] = v })
    const html = buildNoticeHtml({ orderNo: ORDER_NO, orderDate: ORDER_DATE, deadline: SUBMISSION_DEADLINE, examDate: EXAM_DATE, syl: syllabus, institute, marks })
    const w = window.open('', '_blank')
    if (!w) { setMsg('❌ Allow pop-ups to print the notice'); return }
    w.document.write(html); w.document.close()
  }

  // ── Admin: launch settings, setup check, bulk reassign, audit log ───────
  const ALL_PEOPLE_OPTS = panelRows.length ? peopleAll : [...new Set([...Object.values(PANEL).flat(), ...Object.values(PRACTICE_PANEL).flatMap(p => [p.verifier, ...p.assistants])])].sort()
  const loadAudit = async () => {
    const { data, error } = await supabase.from('mission_sainik_audit').select('*').order('at', { ascending: false }).limit(150)
    setAuditRows(error ? [] : data || [])
  }
  const runHealth = async () => {
    const checks = [['mission_sainik_tasks', 'id', '20261201'], ['mission_sainik_materials', 'id', '20261202'], ['mission_sainik_materials', 'body', '20261205 (typed material)'],
      ['mission_sainik_syllabus', 'id', '20261203'], ['mission_sainik_marks', 'id', '20261203'], ['mission_sainik_tasks', 'easy_count', '20261204'],
      ['mission_sainik_questions', 'id', '20261206'], ['mission_sainik_questions', 'deleted_at', '20261209'], ['mission_sainik_settings', 'key', '20261209'],
      ['mission_sainik_audit', 'id', '20261209'], ['mission_sainik_signoffs', 'id', '20261209'], ['mission_sainik_panel', 'id', '20261210 (editable panel)']]
    const out = []
    for (const [t, c, mig] of checks) { const { error } = await supabase.from(t).select(c).limit(1); out.push({ t, c, mig, ok: !error }) }
    setHealth(out)
  }
  const saveSettings = async () => {
    const f = setForm || { deadline: SUBMISSION_DEADLINE, order_no: ORDER_NO, order_date: ORDER_DATE, exam_date: EXAM_DATE, embargo: embargo ? 'on' : 'off' }
    if (![f.deadline, f.order_date, f.exam_date].every(x => /^\d{4}-\d{2}-\d{2}$/.test(x))) return setMsg('❌ Enter valid dates.')
    if (!String(f.order_no).trim()) return setMsg('❌ Enter the order number.')
    const rows = Object.entries(f).map(([key, value]) => ({ key, value: String(value), updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('mission_sainik_settings').upsert(rows, { onConflict: 'key' })
    if (error) return setMsg('❌ ' + error.message + ' (run migration 20261209 and sign in as an admin)')
    audit('settings_update', null, f); setMsg('✅ Settings saved'); setSetForm(null); loadSettings()
  }
  const bulkReassign = async () => {
    if (!bulk.setter) return setMsg('❌ Choose the setter.')
    if (!window.confirm(`Make ${fullName(bulk.setter)} the setter${bulk.verifier ? ` and ${fullName(bulk.verifier)} the verifier` : ''} for ALL 20 ${bulk.subject} tests? Existing status is kept.`)) return
    setBusy(true)
    const patch = { setter: bulk.setter, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
    if (bulk.verifier) patch.verifier = bulk.verifier
    const { error } = await supabase.from(TABLE).update(patch).eq('kind', 'test').eq('subject', bulk.subject)
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message)
    audit('bulk_reassign', bulk.subject, bulk); setMsg('✅ Reassigned'); load()
  }
  const AdminPanel = () => {
    const f = setForm || { deadline: SUBMISSION_DEADLINE, order_no: ORDER_NO, order_date: ORDER_DATE, exam_date: EXAM_DATE, embargo: embargo ? 'on' : 'off' }
    const lab = { fontSize: 12, fontWeight: 700, color: PX.sub, display: 'block' }
    return (
      <>
        <PremiumCard title="Launch settings" subtitle="Admin only. These replace the dates written in the code; the printed notice and countdowns follow them.">
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            <label style={lab}>Submission deadline<input className="px-input" type="date" value={f.deadline} onChange={e => setSetForm({ ...f, deadline: e.target.value })} /></label>
            <label style={lab}>Office order no.<input className="px-input" value={f.order_no} onChange={e => setSetForm({ ...f, order_no: e.target.value })} /></label>
            <label style={lab}>Order date<input className="px-input" type="date" value={f.order_date} onChange={e => setSetForm({ ...f, order_date: e.target.value })} /></label>
            <label style={lab}>AISSEE exam date<input className="px-input" type="date" value={f.exam_date} onChange={e => setSetForm({ ...f, exam_date: e.target.value })} /></label>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={f.embargo === 'on'} onChange={e => setSetForm({ ...f, embargo: e.target.checked ? 'on' : 'off' })} />
            Embargo: hide questions, answers and printing from other staff until the test date (only the section setter and admins can see them)
          </label>
          <button className="px-btn gold" style={{ marginTop: 12 }} onClick={saveSettings}>Save settings</button>
        </PremiumCard>
        <PremiumCard title="Make one teacher the setter for a whole subject" subtitle="Use this to match the notice (one setter per subject). Status of each section is kept.">
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
            <label style={lab}>Subject<select className="px-input" value={bulk.subject} onChange={e => setBulk({ ...bulk, subject: e.target.value })}>{SUBJECTS.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}</select></label>
            <label style={lab}>Setter<select className="px-input" value={bulk.setter} onChange={e => setBulk({ ...bulk, setter: e.target.value })}><option value="">Choose…</option>{ALL_PEOPLE_OPTS.map(n => <option key={n} value={n}>{fullName(n)}</option>)}</select></label>
            <label style={lab}>Verifier (optional)<select className="px-input" value={bulk.verifier} onChange={e => setBulk({ ...bulk, verifier: e.target.value })}><option value="">Keep current</option>{ALL_PEOPLE_OPTS.map(n => <option key={n} value={n}>{fullName(n)}</option>)}</select></label>
          </div>
          <button className="px-btn" style={{ marginTop: 12 }} disabled={busy} onClick={bulkReassign}>Apply to all 20 tests</button>
        </PremiumCard>
        <PremiumCard title="Setup check" subtitle="Which database migrations are in place" right={<button className="px-hbtn" onClick={runHealth}>Run check</button>}>
          {!health ? <div style={{ color: PX.sub, fontSize: 13 }}>Press “Run check”.</div> : health.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13, borderTop: i ? `1px solid ${PX.line}` : 'none' }}>
              <span style={{ width: 20 }}>{h.ok ? '✅' : '❌'}</span><span style={{ flex: 1 }}>{h.t}.{h.c}</span><span style={{ color: h.ok ? PX.sub : PX.bad }}>{h.ok ? 'ok' : 'run migration ' + h.mig}</span>
            </div>))}
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 8 }}>Also run 20261208 (staff-only lockdown); it cannot be checked from here.</div>
        </PremiumCard>
        <MissionSainikAdmin rows={rows} settings={settings} putSetting={putSetting} delSetting={delSetting} reload={load} setMsg={setMsg} audit={audit} currentUser={currentUser} today={today} auditRows={auditRows} loadAudit={loadAudit} isMobile={isMobile} dueFor={dueFor} />
      </>
    )
  }

  // ── shared bits ────────────────────────────────────────────────────────
  const sectionStats = r => ({ done: r.filter(x => x.status !== 'Pending').length, ok: r.filter(x => x.status === 'Approved').length, n: r.length })

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
                  <td><Pill tone={dayName(t.date) === 'Sunday' ? 'gold' : 'mute'} dot={false}>{dayName(t.date)}{dayName(t.date) === 'Sunday' ? ' *' : ''}</Pill></td>
                  <td>{fmtShort(t.drafts)}</td><td>{fmtShort(t.verify)}</td><td>{fmtShort(t.print)}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><MiniBar pct={(st.done / (r.length || 6)) * 100} tone={done ? 'ok' : 'gold'} width={70} /><span style={{ fontWeight: 700 }}>{st.done}/{r.length || 6}</span><span style={{ color: PX.sub, fontSize: 12 }}>{st.ok} approved</span></span></td>
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
                  <td><Pill tone={st === 'Held' ? 'mute' : st === 'Today' ? 'gold' : st === 'Next' ? 'info' : 'mute'} dot={st !== 'Upcoming'}>{st}{st === 'Upcoming' || st === 'Next' ? ` · in ${dayDiff(today, t.date)}d` : ''}</Pill></td>
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
                  <PersonCell name={x.n} size={30}>{fullName(x.n)}</PersonCell>
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

  // ── Teacher activity: tasks + study-material uploads per teacher ──────
  const Activity = () => {
    const has = nameMatches
    const daysAgo = iso => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null)
    const stats = peopleAll.map(n => {
      const mine = rows.filter(r => r.setter === n)
      const ver = rows.filter(r => r.verifier === n)
      const ups = mats.filter(m => has(m.uploaded_by, n))
      const touches = [...rows.filter(r => has(r.updated_by, n)).map(r => r.updated_at), ...ups.map(m => m.created_at)].filter(Boolean).sort()
      const last = touches[touches.length - 1] || null
      return {
        n, set: mine.length, submitted: mine.filter(r => r.status !== 'Pending').length, overdue: mine.filter(r => isOverdue(r, today)).length,
        toVerify: ver.filter(r => r.status === 'Submitted').length, verified: ver.filter(r => r.status === 'Verified' || r.status === 'Approved').length,
        uploads: ups.length, last, idle: daysAgo(last),
      }
    }).sort((a, b) => (b.overdue - a.overdue) || ((b.idle ?? 999) - (a.idle ?? 999)))
    const feed = [
      ...rows.filter(r => r.updated_by && r.updated_at).map(r => ({ at: r.updated_at, who: r.updated_by, text: `${r.status === 'Pending' ? 'updated' : r.status.toLowerCase()} ${r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice'} · ${r.subject} (${fullName(r.setter)})`, icon: '✔' })),
      ...mats.map(m => ({ at: m.created_at, who: m.uploaded_by, text: `uploaded study material “${m.title}”${m.subject ? ' · ' + m.subject : ''}`, icon: m.body && !m.file_path ? '📝' : '📎' })),
    ].filter(x => x.who).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40)
    return (
      <>
        <PremiumCard title="Teacher activity" subtitle="Task progress and study-material uploads per teacher. “Idle” = days since their last update or upload." bodyStyle={{ padding: 0, overflowX: 'auto' }}>
          <table className="px-table" style={{ minWidth: 720 }}>
            <thead><tr><th>Teacher</th><th>Sections set</th><th>Submitted</th><th>Overdue</th><th>To verify</th><th>Verified</th><th>Material uploads</th><th>Last activity</th></tr></thead>
            <tbody>{stats.map(x => (
              <tr key={x.n}>
                <td><PersonCell name={x.n} sub={`${x.set} sections`}>{fullName(x.n)}</PersonCell></td><td>{x.set}</td>
                <td><span style={{ display: 'inline-flex', flexDirection: 'column', gap: 5 }}><b>{x.submitted}/{x.set}</b><MiniBar pct={x.set ? (x.submitted / x.set) * 100 : 0} tone={x.set && x.submitted === x.set ? 'ok' : 'gold'} /></span></td>
                <td>{x.overdue ? <Pill tone="bad">{x.overdue} overdue</Pill> : <span style={{ color: PX.faint }}>—</span>}</td>
                <td>{x.toVerify}</td><td>{x.verified}</td>
                <td>{x.uploads}</td>
                <td><Pill tone={x.idle == null || x.idle >= 3 ? 'bad' : x.idle === 0 ? 'ok' : 'warn'}>{x.idle == null ? 'No activity' : x.idle === 0 ? 'Today' : x.idle + 'd idle'}</Pill></td>
              </tr>))}
            </tbody>
          </table>
        </PremiumCard>
        <PremiumCard title="Recent activity" subtitle="Latest 40 task updates and uploads">
          {!feed.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Nothing yet.</div> : feed.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${PX.line || '#eef1f6'}` : 'none', fontSize: 13 }}>
              <span>{f.icon}</span><span style={{ flex: 1 }}><b>{f.who}</b> {f.text}</span>
              <span style={{ color: PX.sub, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtShort(String(f.at).slice(0, 10))}</span>
            </div>))}
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
                      <td key={s.key} className="msx-click" onClick={() => setSel(r)}>
                        <PersonCell name={r.setter} size={26}>{r.setter}</PersonCell>
                        <div style={{ marginTop: 5 }}><Chip status={r.status} overdue={isOverdue(r, today)} small /></div>
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

  // Practice tab → open the Practice Bank builder on the right subject and set so questions can be added straight away.
  const subjectOfPractice = r => (SUBJECTS.find(x => x.label === r.subject) || SUBJECTS.find(x => r.subject.includes(x.label)) || SUBJECTS[0])
  const goAddQuestions = (subjectLabel, setNo) => { setBStart(b => ({ test: setNo || 1, section: subjectLabel, n: b.n + 1 })); setTab('practicebuilder') }
  const setNoFor = r => {
    const sub = subjectOfPractice(r)
    const same = practice.filter(x => subjectOfPractice(x).key === sub.key).sort((a, b) => a.id - b.id)
    return Math.min(Math.max(same.findIndex(x => x.id === r.id) + 1, 1), PRACTICE_PANEL[sub.key]?.sets || 1)
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
        {r.kind === 'practice' && <button className="px-btn ghost" onClick={() => goAddQuestions(subjectOfPractice(r).label, setNoFor(r))}>＋ Questions</button>}
        {quick && <button className="px-btn gold" disabled={busy} onClick={() => saveTask(r, { status: quick })}>Mark {quick.toLowerCase()}</button>}
        <button className="px-btn ghost" onClick={() => setSel(r)}>Open</button>
      </div>
    )
  }

  const Mine = () => {
    const names = Array.from(new Set(rows.flatMap(r => [r.setter, r.verifier]).filter(Boolean))).sort()
    const needsMe = r => (isMe(r.setter) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted')
    const isMine = r => isMe(r.setter) || isMe(r.verifier)
    const base = taskView === 'needs' ? rows.filter(needsMe) : taskView === 'mine' ? rows.filter(isMine) : rows.filter(r => !person || r.setter === person || r.verifier === person)
    const qq = taskQ.trim().toLowerCase()
    const matches = r => (!subjF || r.subject === subjF) && (!qq || [r.subject, r.setter, r.verifier, r.kind === 'test' ? 'pmt-' + String(r.test_no).padStart(2, '0') : 'practice'].join(' ').toLowerCase().includes(qq))
    const scoped = base.filter(matches)
    const list = scoped.filter(r => !statusF || (statusF === 'Overdue' ? isOverdue(r, today) : r.status === statusF))
      .sort((a, b) => dueFor(a).localeCompare(dueFor(b)) || a.test_no - b.test_no)
    const count = st => scoped.filter(r => (st === 'Overdue' ? isOverdue(r, today) : st ? r.status === st : true)).length
    const chip = (on, label, onClick, n) => (
      <button key={label} className="msx-tap" onClick={onClick} aria-pressed={on} style={{ padding: '7px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flex: 'none', background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.ink, border: `1px solid ${on ? PX.navy : '#d9d2c2'}` }}>{label}{n != null ? <span style={{ opacity: .7, marginLeft: 6 }}>{n}</span> : null}</button>
    )
    return (
      <>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }} role="group" aria-label="Task view">
          {chip(taskView === 'needs', 'Needs me', () => { setTaskView('needs'); setTaskLimit(30) }, rows.filter(needsMe).length)}
          {chip(taskView === 'mine', 'All mine', () => { setTaskView('mine'); setTaskLimit(30) }, rows.filter(isMine).length)}
          {chip(taskView === 'all', 'Everyone', () => { setTaskView('all'); setTaskLimit(30) }, rows.length)}
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '4px 0 10px', flexWrap: 'wrap' }}>
          <input className="px-input" style={{ flex: '1 1 160px' }} type="search" value={taskQ} onChange={e => { setTaskQ(e.target.value); setTaskLimit(30) }} placeholder="Search…" aria-label="Search tasks" />
          <select className="px-input" style={{ flex: '0 1 170px' }} value={subjF} onChange={e => { setSubjF(e.target.value); setTaskLimit(30) }} aria-label="Filter by subject">
            <option value="">All subjects</option>{SUBJECTS.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}
          </select>
          {taskView === 'all' && (
            <select className="px-input" style={{ flex: '0 1 170px' }} value={person} onChange={e => setPerson(e.target.value)} aria-label="Filter by teacher">
              <option value="">All teachers</option>{names.map(n => <option key={n} value={n}>{fullName(n)}</option>)}
            </select>)}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }} role="group" aria-label="Status filter">
          {['', 'Pending', 'Submitted', 'Verified', 'Approved', 'Overdue'].map(st => chip(statusF === st, st || 'Any status', () => { setStatusF(st); setTaskLimit(30) }, count(st)))}
        </div>
        <PremiumCard title={taskView === 'needs' ? 'Needs your action' : taskView === 'mine' ? 'All my tasks' : 'All tasks'} subtitle={`${list.length} shown · earliest deadline first`}
          right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="px-btn gold" onClick={() => setAddTask(newTaskForm('test'))}>＋ Add task</button><button className="px-btn ghost" onClick={exportCsv}>Export CSV</button></span>} bodyStyle={{ padding: 0 }}>
          {list.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: PX.sub, fontSize: 14 }}>
              {taskView === 'needs' ? '🎉 Nothing needs you right now.' : taskView === 'mine' ? `No tasks matched “${currentUser?.name || 'your name'}”. Ask the Principal to link your name, or open Everyone.` : 'Nothing to show.'}
              {taskView !== 'all' && <div style={{ marginTop: 10 }}><button className="px-btn ghost" onClick={() => { setTaskView('all'); setStatusF('') }}>Show everyone's tasks</button></div>}
            </div>
            : list.slice(0, taskLimit).map(r => <Fragment key={r.id}>{TaskRow({ r })}</Fragment>)}
          {list.length > taskLimit && <div style={{ padding: 14, textAlign: 'center' }}><button className="px-btn ghost" onClick={() => setTaskLimit(l => l + 30)}>Show 30 more ({list.length - taskLimit} left)</button></div>}
        </PremiumCard>
      </>
    )
  }


  const Practice = () => (
    <PremiumCard title="Practice question bank" subtitle="Latest pattern · verified by another teacher of the subject · issued to students by 15 Dec" right={<button className="px-btn gold" onClick={() => setAddTask(newTaskForm('practice'))}>＋ Add practice set</button>} bodyStyle={{ padding: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${PX.line}` }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Add questions to the practice bank</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUBJECTS.flatMap(sub => Array.from({ length: PRACTICE_PANEL[sub.key]?.sets || 1 }, (_, i) => (
            <button key={sub.key + i} className="px-btn ghost" onClick={() => goAddQuestions(sub.label, i + 1)}>＋ {sub.short} · Set {i + 1}</button>)))}
        </div>
        <div style={{ fontSize: 12, color: PX.sub, marginTop: 8 }}>Opens the Practice Bank builder on that subject and set — paste or upload up to 25 questions per set.</div>
      </div>
      {practice.length === 0 && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No practice sets yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : ''}</div>}
      {practice.map(r => <Fragment key={r.id}>{TaskRow({ r })}</Fragment>)}
      {practice.length > 0 && (
        <div style={{ padding: '12px 16px', fontSize: 13, color: PX.sub }}>
          {practice.reduce((n, r) => n + (r.question_count || 0), 0)} questions so far; Sir Sumanta's Mathematics count and the subject of Sir Deepak's set are to be notified.
        </div>
      )}
    </PremiumCard>
  )

  const savePanelMember = async () => {
    const d = panelDraft
    if (!d.name.trim()) return setMsg('❌ Enter the teacher\'s name.')
    const row = { subject_key: d.subject_key, name: d.name.trim().replace(/^(sir|miss|mr|mrs)\s+/i, ''), role: d.role, created_by: currentUser?.name || '' }
    const q = d.id ? supabase.from('mission_sainik_panel').update(row).eq('id', d.id) : supabase.from('mission_sainik_panel').insert(row)
    const { error } = await q
    if (error) return setMsg('❌ ' + (/duplicate|unique/i.test(error.message) ? 'That person is already on the panel for this subject and role.' : error.message + ' (run migration 20261210)'))
    audit(d.id ? 'panel_edit' : 'panel_add', d.subject_key, row); setPanelDraft(null); setMsg('✅ Panel saved'); loadPanel()
  }
  const deletePanelMember = async m => {
    if (!window.confirm(`Remove ${fullName(m.name)} from the ${SUBJECTS.find(x => x.key === m.subject_key)?.label} panel? Their existing tasks stay.`)) return
    const { error } = await supabase.from('mission_sainik_panel').delete().eq('id', m.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('panel_delete', m.subject_key, { name: m.name, role: m.role }); loadPanel()
  }
  const loadPanelFromNotice = async () => {
    if (!window.confirm('Load the panel from the notice (Annexure-II)? This fills the editable panel with the notice\'s setters, verifiers and assistants.')) return
    const rows = SUBJECTS.flatMap(x => [...PANEL[x.key].map(name => ({ subject_key: x.key, name, role: 'setter' })), { subject_key: x.key, name: PRACTICE_PANEL[x.key].verifier, role: 'verifier' }, ...PRACTICE_PANEL[x.key].assistants.map(name => ({ subject_key: x.key, name, role: 'assistant' }))])
    const { error } = await supabase.from('mission_sainik_panel').upsert(rows.map(r => ({ ...r, created_by: currentUser?.name || '' })), { onConflict: 'subject_key,name,role' })
    if (error) return setMsg('❌ ' + error.message + ' (run migration 20261210)')
    audit('panel_load_notice', null, { rows: rows.length }); loadPanel()
  }
  const ROLE_TONE = { setter: 'info', verifier: 'ok', assistant: 'gold' }
  const Panel = () => (
    <>
      <PremiumCard title="Question Setting Panel" subtitle="Add, edit or remove panel members. Until you add members here, the panel from the notice is used."
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="px-btn gold" onClick={() => setPanelDraft({ subject_key: SUBJECTS[0].key, name: '', role: 'setter' })}>＋ Add member</button>
          {!panelRows.length && <button className="px-btn ghost" onClick={loadPanelFromNotice}>Load from notice</button>}
        </span>}>
        {panelDraft && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.4fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Subject<select className="px-input" value={panelDraft.subject_key} onChange={e => setPanelDraft({ ...panelDraft, subject_key: e.target.value })}>{SUBJECTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Name (e.g. Sumanta)<input className="px-input" value={panelDraft.name} onChange={e => setPanelDraft({ ...panelDraft, name: e.target.value })} /></label>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Role<select className="px-input" value={panelDraft.role} onChange={e => setPanelDraft({ ...panelDraft, role: e.target.value })}><option value="setter">Question setter</option><option value="verifier">Verifier</option><option value="assistant">Assistant</option></select></label>
            <span style={{ display: 'flex', gap: 8 }}><button className="px-btn gold" onClick={savePanelMember}>{panelDraft.id ? 'Update' : 'Add'}</button><button className="px-btn ghost" onClick={() => setPanelDraft(null)}>Cancel</button></span>
          </div>)}
        {!panelDraft && <div style={{ fontSize: 13, color: PX.sub }}>{panelRows.length ? `${panelRows.length} members on the editable panel.` : 'Showing the panel from the notice. Press “Load from notice” to start editing it.'}</div>}
      </PremiumCard>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,minmax(0,1fr))', gap: 14 }}>
        {SUBJECTS.map(sub => {
          const members = panelRows.length ? panelRows.filter(r => r.subject_key === sub.key) : PANEL[sub.key].map(name => ({ name, role: 'setter', subject_key: sub.key, builtin: true }))
          return (
            <PremiumCard key={sub.key} title={sub.label} subtitle={`${members.length} member${members.length === 1 ? '' : 's'}`}>
              {members.length === 0 && <div style={{ color: PX.sub, fontSize: 13 }}>No one yet.</div>}
              {members.map((m, i) => {
                const mine = tests.filter(r => r.subject === sub.label && r.setter === m.name)
                return (
                  <div key={m.id || m.name + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${PX.line}` : 'none' }}>
                    <PersonCell name={m.name} size={30} sub={m.role === 'setter' ? `${mine.length || 0} tests · ${mine.filter(r => r.status !== 'Pending').length} in` : null}>{fullName(m.name)}</PersonCell>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Pill tone={ROLE_TONE[m.role]} dot={false}>{m.role}</Pill>
                      {!m.builtin && <><button className="px-hbtn" onClick={() => setPanelDraft({ id: m.id, subject_key: m.subject_key, name: m.name, role: m.role })} aria-label={`Edit ${m.name}`}>✎</button>
                        <button className="px-hbtn" onClick={() => deletePanelMember(m)} aria-label={`Remove ${m.name}`}>🗑</button></>}
                    </span>
                  </div>)
              })}
            </PremiumCard>)
        })}
      </div>
    </>
  )


  const saveMaterial = async () => {
    const d = matDraft
    if (!d.title.trim()) return setMsg('❌ Give the material a title.')
    if (d.link_url.trim() && !safeUrl(d.link_url)) return setMsg('❌ The link must start with http:// or https://')
    if (!d.file && !d.link_url.trim() && !d.body.trim()) return setMsg('❌ Type the material, choose a file or paste a link.')
    if (d.file && d.file.size > 50 * 1024 * 1024) return setMsg('❌ File is over 50 MB.')
    setBusy(true)
    try {
      if (editMat) {                                    // edit an existing item (optionally replace its file)
        const patch = { title: d.title.trim(), subject: d.subject || null, test_no: Number(d.test_no) || 0, link_url: safeUrl(d.link_url) || null, body: d.body.trim() || null, note: d.note.trim() || null }
        if (d.file) {
          const safe = d.file.name.replace(/[^\w.-]+/g, '_')
          const who = (currentUser?.name || 'staff').toLowerCase().replace(/[^a-z0-9]+/g, '-')
          const path = `mission-sainik/${who}/${Date.now()}-${safe}`
          const { error: upErr } = await supabase.storage.from(MAT_BUCKET).upload(path, d.file, { upsert: false })
          if (upErr) throw upErr
          if (editMat.file_path) await supabase.storage.from(MAT_BUCKET).remove([editMat.file_path])
          patch.file_path = path; patch.file_name = d.file.name
        }
        const { error } = await supabase.from(MAT_TABLE).update(patch).eq('id', editMat.id)
        if (error) throw error
        audit('material_edit', patch.title, { id: editMat.id }); setEditMat(null)
        setMatDraft({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }); setFileKey(k => k + 1)
        setMsg('✅ Material updated'); loadMats(); setBusy(false); return
      }
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
        link_url: safeUrl(d.link_url) || null, body: d.body.trim() || null, file_path, file_name, note: d.note.trim() || null, uploaded_by: currentUser?.name || '',
      })
      if (error) throw error
      setMatDraft({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }); setFileKey(k => k + 1)
      setMsg('✅ Material added.'); audit('material_add', d.title.trim(), { file: !!d.file, link: !!d.link_url.trim(), text: !!d.body.trim() }); loadMats()
    } catch (e) { setMsg('❌ ' + (e.message || 'Upload failed')) }
    setBusy(false)
  }
  const printMaterial = m => {
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.title)}</title><style>@page{size:A4;margin:16mm}body{font-family:Georgia,'Times New Roman',serif;color:#111827;font-size:13.5px;line-height:1.6}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:8px;margin-bottom:12px}.lh h1{margin:0;font-size:20px;color:#132a4f}.lh div{font-size:11.5px;color:#555}
h2{margin:0 0 4px;font-size:18px}.meta{color:#555;font-size:12px;margin-bottom:12px}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style></head><body>
<div class="lh"><h1>${esc(institute.name)}</h1><div>Mission Sainik 2027 · Study Material</div></div>
<h2>${esc(m.title)}</h2><div class="meta">${esc([m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : '', m.uploaded_by].filter(Boolean).join(' · '))}</div>
<pre>${esc(m.body)}</pre><script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }
  const openMaterial = async m => {
    if (m.body && !m.link_url && !m.file_path) return setViewMat(m)
    if (m.link_url) { const u = safeUrl(m.link_url); return u ? window.open(u, '_blank', 'noopener') : setMsg('❌ Unsafe link blocked.') }
    const { data, error } = await supabase.storage.from(MAT_BUCKET).createSignedUrl(m.file_path, 3600)
    if (error) return setMsg('❌ ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const startEditMat = m => {
    setEditMat(m); setFileKey(k => k + 1)
    setMatDraft({ title: m.title || '', subject: m.subject || '', test_no: m.test_no || 0, link_url: m.link_url || '', note: m.note || '', body: m.body || '', file: null })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  const deleteMaterial = async m => {
    if (!window.confirm(`Delete “${m.title}”?`)) return
    if (m.file_path) await supabase.storage.from(MAT_BUCKET).remove([m.file_path])
    const { error } = await supabase.from(MAT_TABLE).delete().eq('id', m.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('material_delete', m.title, { by: currentUser?.name }); loadMats()
  }
  const inp = { padding: '9px 10px', borderRadius: 10, border: `1px solid ${PX.line || '#d8dee9'}`, fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const setupNote = marksSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261203_mission_sainik_syllabus_marks.sql</b> in Supabase to enable this tab.</div>
  const syllabusTab = (
    <>{setupNote}
      <PremiumCard title="Syllabus plan" subtitle="Chapter for each section of each test — type and click away to save. Setters see it on their task." bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        <table className="px-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Test</th>{SUBJECTS.map(x => <th key={x.key}>{x.short}</th>)}</tr></thead>
          <tbody>{TESTS.map(t => (
            <tr key={t.no}>
              <td>{t.id}<div style={{ fontWeight: 500, color: PX.sub, fontSize: 11 }}>{fmtShort(t.date)}</div></td>
              {SUBJECTS.map(x => (
                <td key={x.key} style={{ padding: '8px 10px' }}>
                  <input key={t.no + x.label + (syl[t.no + '|' + x.label] ?? '')} className="px-input" defaultValue={syl[t.no + '|' + x.label] || ''} aria-label="Chapter" placeholder="Chapter"
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
          <select className="px-input" aria-label="Test" value={markDraft.test_no} onChange={e => setMarkDraft({ ...markDraft, test_no: e.target.value })}>{TESTS.map(t => <option key={t.no} value={t.no}>T{t.no} · {fmtShort(t.date)}</option>)}</select>
          <input className="px-input" aria-label="Batch / student" placeholder="Batch / student" value={markDraft.batch} onChange={e => setMarkDraft({ ...markDraft, batch: e.target.value })} />
          {MARK_COLS.map(([k, lbl, max]) => <input key={k} className="px-input" type="number" min="0" max={max} aria-label={`${lbl} /${max}`} placeholder={`${lbl} /${max}`} value={markDraft[k]} onChange={e => setMarkDraft({ ...markDraft, [k]: e.target.value })} />)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="px-btn gold" onClick={saveMarks}>{editMarksId ? 'Update marks' : 'Save marks'}</button>
          {editMarksId && <><span style={{ fontSize: 13, color: PX.sub }}>Editing T{markDraft.test_no} · {markDraft.batch || 'no batch'}</span><button className="px-btn ghost" onClick={() => { setEditMarksId(null); setMarkDraft({ test_no: 1, batch: '', maths: '', reasoning: '', grammar: '', gk: '' }) }}>Cancel</button></>}
        </div>
      </PremiumCard>
      <PremiumCard title={`Entries (${marks.length})`} subtitle="Red = below 60% — revisit that chapter" bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        {!marks.length ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No marks entered yet.</div> : (
          <table className="px-table" style={{ minWidth: 560 }}>
            <thead><tr><th>Test</th><th>Batch</th>{MARK_COLS.map(([k, l, m]) => <th key={k}>{l} /{m}</th>)}<th>Total /120</th><th /></tr></thead>
            <tbody>{marks.map(r => {
              const tot = MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0)
              return (
                <tr key={r.id}>
                  <td>T{r.test_no}</td><td>{r.batch ? <PersonCell name={r.batch} size={28}>{r.batch}</PersonCell> : '—'}</td>
                  {MARK_COLS.map(([k, , m]) => <td key={k}><ScorePill v={r[k]} max={m} /></td>)}
                  <td><ScorePill v={tot} max={120} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}><button className="px-hbtn" onClick={() => editMarks(r)} aria-label="Edit">✎</button> <button className="px-hbtn" onClick={() => deleteMarks(r)} aria-label="Delete">🗑</button></td>
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
      <PremiumCard title={editMat ? 'Edit study material' : 'Upload study material'} subtitle="Notes, PDFs, images or a link — visible to all staff">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10 }}>
          <input style={inp} aria-label="Title" placeholder="Title" value={matDraft.title} onChange={e => setMatDraft({ ...matDraft, title: e.target.value })} />
          <select style={inp} aria-label="Subject" value={matDraft.subject} onChange={e => setMatDraft({ ...matDraft, subject: e.target.value })}>
            <option value="">All subjects</option>{SUBJECTS.map(x => <option key={x.key} value={x.label}>{x.label}</option>)}
          </select>
          <select style={inp} aria-label="Test" value={matDraft.test_no} onChange={e => setMatDraft({ ...matDraft, test_no: e.target.value })}>
            <option value={0}>All tests</option>{TESTS.map(t => <option key={t.id} value={t.no ?? t.id}>{t.id}</option>)}
          </select>
          <input key={fileKey} style={inp} type="file" aria-label="Choose a file" onChange={e => setMatDraft({ ...matDraft, file: e.target.files?.[0] || null })} />
          <input style={inp} aria-label="…or paste a link (Drive, YouTube)" placeholder="…or paste a link (Drive, YouTube)" value={matDraft.link_url} onChange={e => setMatDraft({ ...matDraft, link_url: e.target.value })} />
          <textarea style={{ ...inp, gridColumn: '1 / -1', minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} aria-label="Type or paste the study material here — it is saved in the portal and can be printed (or attach a file / link instead)" placeholder="Type or paste the study material here — it is saved in the portal and can be printed (or attach a file / link instead)" value={matDraft.body} onChange={e => setMatDraft({ ...matDraft, body: e.target.value })} />
          <input style={inp} aria-label="Note (optional)" placeholder="Note (optional)" value={matDraft.note} onChange={e => setMatDraft({ ...matDraft, note: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="px-btn gold" disabled={busy} onClick={saveMaterial}>{busy ? 'Saving…' : editMat ? '✔ Save changes' : '⬆ Add material'}</button>
          {editMat && <><span style={{ fontSize: 13, color: PX.sub }}>Editing “{editMat.title}”{editMat.file_name ? ' · choose a file only to replace ' + editMat.file_name : ''}</span>
            <button className="px-btn ghost" onClick={() => { setEditMat(null); setFileKey(k => k + 1); setMatDraft({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }) }}>Cancel</button></>}
        </div>
      </PremiumCard>
      <PremiumCard title={`Library (${mats.length})`}>
        {!mats.length && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>Nothing uploaded yet.</div>}
        {mats.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 4px', borderTop: `1px solid ${PX.line || '#eef1f6'}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>{m.link_url ? '🔗' : m.body && !m.file_path ? '📝' : '📄'}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
              <div style={{ fontSize: 12, color: PX.sub }}>{[m.subject || 'All subjects', m.test_no ? 'Test ' + m.test_no : null, m.uploaded_by, fmtShort(String(m.created_at).slice(0, 10))].filter(Boolean).join(' · ')}{m.note ? ' — ' + m.note : ''}</div>
            </div>
            <button className="px-hbtn" onClick={() => openMaterial(m)}>Open</button>
            {m.body && <button className="px-hbtn" onClick={() => printMaterial(m)}>🖨 Print</button>}
            {(isAdmin || isMe(m.uploaded_by)) && <button className="px-hbtn" onClick={() => startEditMat(m)} aria-label="Edit material">✎</button>}
            {(isAdmin || isMe(m.uploaded_by)) && <button className="px-hbtn" onClick={() => deleteMaterial(m)} aria-label="Delete material">🗑</button>}
          </div>
        ))}
      </PremiumCard>
    </>
  )

  const myOpen = rows.filter(r => (isMe(r.setter) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted'))
  const badges = { mine: myOpen.length || 0 }
  const tabLabel = id => NAV_GROUPS.flatMap(g => g.items).find(i => i[0] === id)?.[2] || 'Mission Sainik'
  const game = computeGame({ rows: rows.map(r => ({ ...r, due: dueFor(r) })), mats, userName: currentUser?.name || '', isMe, today })
  const nextTaskRow = [...myOpen].sort((x, y) => dueFor(x).localeCompare(dueFor(y)))[0]
  const nextTask = nextTaskRow ? {
    row: nextTaskRow, late: isOverdue(nextTaskRow, today),
    title: `${nextTaskRow.kind === 'test' ? 'PMT-' + String(nextTaskRow.test_no).padStart(2, '0') + ' · ' : 'Practice · '}${nextTaskRow.subject}`,
    sub: `${isMe(nextTaskRow.setter) ? 'Set and submit' : 'Verify'} · due ${fmtShort(dueFor(nextTaskRow))}${isOverdue(nextTaskRow, today) ? ' · overdue' : (() => { const n = dayDiff(today, dueFor(nextTaskRow)); return n === 0 ? ' · today' : n > 0 ? ` · ${n}d left` : '' })()}`,
  } : null
  const homeStats = {
    pct: total ? Math.round((approved / total) * 100) : 0,
    deadlineLabel: daysToDeadline > 0 ? daysToDeadline + ' days to submit' : daysToDeadline === 0 ? 'Submit today' : 'Submission closed',
    examLabel: daysToExam > 0 ? daysToExam + 'd' : daysToExam === 0 ? 'today' : 'held',
    nextTest: nextTest ? nextTest.id.replace('PMT-', '') : 'Done', inLabel: `${submitted}/${total || seedCount}`, approved, overdue,
  }
  const quick = [
    { id: 'prebuilder', icon: '🧱', label: 'Build', bg: '#e8f0fe' }, { id: 'mine', icon: '✅', label: 'Tasks', bg: '#e6f4ea', badge: myOpen.length },
    { id: 'material', icon: '📎', label: 'Material', bg: '#fff6dc' }, { id: 'insights', icon: '💡', label: 'Insights', bg: '#fdecea' },
  ]

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
    <div className="px-root" style={{ background: 'transparent', minHeight: 0 }}>
      <PremiumStyles />
      <MissionSainikShell active={tab} onChange={setTab} title={tab === 'overview' ? 'Mission Sainik' : tabLabel(tab)} subtitle={tab === 'overview' ? 'GNSI · 2027' : 'Mission Sainik'}
        onBack={tab !== 'overview' ? () => setTab('overview') : undefined} badges={badges} isAdmin={isRealAdmin} msg={msg} confetti={boom}
        actions={[{ label: 'Print notice', icon: '🖨', onClick: printNotice }, { label: 'Refresh', icon: '🔄', onClick: load }]}
        fab={tab === 'overview' || tab === 'mine' ? { icon: '⬆', label: 'Upload questions', onClick: () => setTab('prebuilder') } : null}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading…</div> : (
          <>
            {tab === 'guide' && <MissionSainikGuide onGo={setTab} isMobile={isMobile} isAdmin={isRealAdmin} institute={institute} />}
            {tab === 'overview' && <><MissionSainikHome announcement={settings.announcement} name={currentUser?.name} stats={homeStats} game={game} nextTask={nextTask} onGo={setTab} onOpenTask={setSel} quick={quick} isMobile={isMobile} />{Overview()}</>}
            {tab === 'schedule' && Schedule()}
            {['prebuilder', 'megabuilder', 'dailybuilder', 'practicebuilder'].includes(tab) && <MissionSainikBuilder key={tab + '-' + bStart.n} startTest={tab === 'practicebuilder' && bStart.section ? bStart.test : undefined} startSection={tab === 'practicebuilder' && bStart.section ? bStart.section : undefined} series={{ prebuilder: 'pre', megabuilder: 'mega', dailybuilder: 'daily', practicebuilder: 'practice' }[tab]} tasks={rows} saveTask={saveTask}
              currentUser={currentUser} setMsg={setMsg} isMobile={isMobile} institute={institute} embargo={embargo} audit={audit} today={today} panel={panelForBuilder} locks={settings} onLock={async (key, on) => { if (on) { if (await putSetting(key, 'on')) setMsg('🔒 Paper locked') } else if (await delSetting(key)) setMsg('🔓 Paper unlocked') }} />}
            {tab === 'activity' && Activity()}
            {tab === 'insights' && Insights()}
            {(tab === 'premock' || tab === 'megamock') && <MockTestAnalyzer key={tab} scope={tab === 'premock' ? 'pre' : 'mega'} institute={institute} currentUser={currentUser} canUpload canDelete />}
            {tab === 'mock' && MockSeries()}
            {tab === 'allotment' && Allotment()}
            {tab === 'mine' && Mine()}
            {tab === 'practice' && Practice()}
            {tab === 'syllabus' && syllabusTab}
            {tab === 'marks' && marksTab}
            {tab === 'material' && materialTab}
            {tab === 'panel' && Panel()}
            {tab === 'admin' && isRealAdmin && AdminPanel()}
          </>
        )}
      </MissionSainikShell>
      {viewMat && (
        <div className="msx-overlay" onClick={() => setViewMat(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="msx-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: 'min(720px,100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 22 }}>
            <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600, color: PX.navy }}>{viewMat.title}</div>
            <div style={{ fontSize: 12.5, color: PX.sub, margin: '4px 0 12px' }}>{[viewMat.subject || 'All subjects', viewMat.test_no ? 'Test ' + viewMat.test_no : null, viewMat.uploaded_by].filter(Boolean).join(' · ')}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{viewMat.body}</div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="px-btn gold" onClick={() => printMaterial(viewMat)}>🖨 Print</button>
              <button className="px-btn ghost" onClick={() => setViewMat(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {addTask && (
        <div className="msx-overlay" onClick={() => setAddTask(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="msx-dialog" role="dialog" aria-modal="true" aria-label="Add task" onClick={e => e.stopPropagation()} style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 22 }}>
            <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600, color: PX.navy, marginBottom: 12 }}>{addTask.kind === 'test' ? 'Add a test section' : 'Add a practice set'}</div>
            {(() => {
              const f = addTask, set = patch => setAddTask({ ...f, ...patch }), lab = { display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginTop: 10 }
              return (
                <>
                  <label style={lab}>Type<select className="px-input" value={f.kind} onChange={e => set({ kind: e.target.value, test_no: 1, question_count: e.target.value === 'test' ? 25 : '' })}><option value="test">Pre Mock test section</option><option value="practice">Practice set</option></select></label>
                  {f.kind === 'test' && <label style={lab}>Test<select className="px-input" value={f.test_no} onChange={e => set({ test_no: e.target.value })}>{TESTS.map(t => <option key={t.no} value={t.no}>{t.id} · {fmtShort(t.date)}</option>)}</select></label>}
                  <label style={lab}>Subject<input className="px-input" list="ms-subjects" value={f.subject} onChange={e => set({ subject: e.target.value })} /></label>
                  <datalist id="ms-subjects">{SUBJECTS.map(x => <option key={x.key} value={x.label} />)}</datalist>
                  <label style={lab}>Setter<input className="px-input" list="ms-people" value={f.setter} onChange={e => set({ setter: e.target.value })} placeholder="Choose or type a name" /></label>
                  <label style={lab}>Verifier (optional)<input className="px-input" list="ms-people" value={f.verifier} onChange={e => set({ verifier: e.target.value })} /></label>
                  <datalist id="ms-people">{peopleAll.map(n => <option key={n} value={n} />)}</datalist>
                  <label style={lab}>Questions<input className="px-input" type="number" min="0" value={f.question_count} onChange={e => set({ question_count: e.target.value })} /></label>
                </>
              )
            })()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="px-btn ghost" onClick={() => setAddTask(null)}>Cancel</button>
              <button className="px-btn gold" disabled={busy} onClick={createTask}>Add task</button>
            </div>
          </div>
        </div>
      )}
      {sel && <TaskDialog key={sel.id} people={peopleAll} onDelete={deleteTask} deadline={SUBMISSION_DEADLINE} chapter={syl[sel.test_no + '|' + sel.subject]} sel={sel} today={today} isAdmin={isAdmin} allowed={allowedStatuses(sel)} busy={busy} onSave={saveTask} onClose={() => setSel(null)} />}
    </div>
  )
}

export default function MissionSainik(props) {
  return <MissionSainikBoundary><MissionSainikInner {...props} /></MissionSainikBoundary>
}

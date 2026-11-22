/* eslint-disable react-hooks/set-state-in-effect -- data loaders set state after fetching, as elsewhere in the portal */
// MissionSainik.jsx — GNSI Portal · Management → Mission Sainik
// Tracks the question setting for "Mission Sainik 2027 – Search for Extra Ordinary":
// 20 Pre Mock Tests (6 sections × 25 questions each) plus the practice question bank.
// Who sets what, who verifies, deadlines, and progress: Pending → Submitted → Verified → Approved.
// Plan and deadlines: missionSainikData.js (Office Order GNSI/MS-2027/PMT/2026/01).
// Progress is stored in the `mission_sainik_tasks` table (migration 20261201_mission_sainik_tasks.sql).
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
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
import { hiddenFrom, applyMenu, visibleTabIds, visibleFlow, MENU_PRESETS, hiddenForPreset, hiddenToValue, ALWAYS_ON } from './lib/missionSainikMenu'
import { FLOW } from './lib/missionSainikFlow'
import MissionSainikHome from './MissionSainikHome'
import { FlowTracker, FlowNav } from './MissionSainikFlow'
import TeacherPicker from './TeacherPicker'
import { staffOptions, staffNameFor } from './lib/teacherPick'
import MissionSainikSetterPlan from './MissionSainikSetterPlan'
import MissionSainikPracticePlan from './MissionSainikPracticePlan'
import MissionSainikStudents from './MissionSainikStudents'
import MissionSainikAdmit from './MissionSainikAdmit'
import MissionSainikMockMarks from './MissionSainikMockMarks'
import MissionSainikCertificates from './MissionSainikCertificates'
import { retarget, nextVerifier, settersOfRow, settersLabel } from './lib/missionSainikAllot'
import { diffPlan } from './data/syllabusPlan2026'
import MissionSainikAdmin from './MissionSainikAdmin'
import { OfficialSyllabus, SyllabusManual } from './MissionSainikSyllabusRef'
import MissionSainikMaterial from './MissionSainikMaterial'
import SmartPaperMaker from './SmartPaperMaker'
import SetPrintDialog from './SetPrintDialog'
import { materialDocHtml, renderMaterial, MATERIAL_CSS } from './lib/materialMarkup'
import { MATH_CSS } from './lib/mathText'
import { officialSubjects, subjectFamily } from './officialSyllabus'
import { downloadCsv, downloadFile, buildIcs, parseSyllabusText, parseMarksText } from './lib/missionSainikExport'
import { PersonCell, Pill, MiniBar, ScorePill } from './MissionSainikUI'
import { computeGame } from './lib/missionSainikGame'
import { printPremium } from './lib/printPremium'
import { buildPlanBody } from './lib/missionSainikPlanPrint'
import { buildPlanDocx, buildTableDocx, downloadDocx } from './lib/missionSainikDocx'
import { meritList } from './lib/missionSainikMerit'
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

// Several chapters in one syllabus cell. Stored as a single "A; B; C" string (no schema change);
// shown as removable chips with an input that adds another chapter.
const splitChapters = v => String(v || '').split(';').map(s => s.trim()).filter(Boolean)
function ChapterMulti({ value, onSave, listId, label, placeholder, fontSize, minHeight, tint, readOnly = false }) {
  const items = splitChapters(value)
  const [draft, setDraft] = useState('')
  const commit = text => {
    const t = String(text ?? draft).replace(/;/g, ',').trim(); setDraft('')
    if (!t || items.some(c => c.toLowerCase() === t.toLowerCase())) return
    onSave([...items, t].join('; '))
  }
  const remove = i => onSave(items.filter((_, j) => j !== i).join('; '))
  if (readOnly) {   // only an admin changes the plan: everyone else just reads it
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }} aria-label={label}>
        {items.length ? items.map(c => <span key={c} style={{ padding: '2px 8px', borderRadius: 99, background: tint || '#f1ede3', fontSize: Math.max(11, (fontSize || 13) - 1), fontWeight: 600 }}>{c}</span>) : <span style={{ fontSize: fontSize || 13, color: PX.faint }}>Not planned yet</span>}
      </div>)
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {items.map((c, i) => (
        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', borderRadius: 99, background: tint || '#f1ede3', fontSize: Math.max(11, (fontSize || 13) - 1), fontWeight: 600, maxWidth: '100%' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</span>
          <button type="button" aria-label={`Remove ${c}`} onClick={e => { e.preventDefault(); remove(i) }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1, color: 'inherit' }}>×</button>
        </span>
      ))}
      <input value={draft} list={listId} aria-label={label} placeholder={items.length ? 'Add another…' : placeholder}
        onChange={e => { const ni = e.nativeEvent?.inputType; setDraft(e.target.value); if ((ni === undefined || ni === 'insertReplacementText') && e.target.value) commit(e.target.value) }}
        onBlur={() => draft.trim() && commit()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ';') { e.preventDefault(); commit() } }}
        enterKeyHint="done"
        style={{ flex: '1 1 110px', minWidth: 90, border: 'none', background: 'transparent', outline: 'none', fontSize: fontSize || 13, minHeight, padding: '2px 0', fontFamily: 'inherit', color: PX.ink }} />
    </div>
  )
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
            {settersOfRow(sel).length > 1 ? 'Setters' : 'Setter'} {settersLabel(sel, fullName)}{sel.verifier ? ` · verifier ${fullName(sel.verifier)}` : ''} · due {fmt(dueFor(sel))}
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

function MissionSainikInner({ currentUser: sessionUser }) {
  const isMobile = useIsMobile()
  const [staffDir, setStaffDir] = useState([])   // staff names + designations, to credit a material's creator and to find who is logged in
  useEffect(() => { supabase.from('staff_profiles').select('name, designation, department, user_id, email').then(({ data }) => { if (Array.isArray(data)) setStaffDir(data) }, () => {}) }, [])
  // The logged-in person's Staff record (login link, then email / username, then exact name). Its full name is what panel, setter and
  // checker names are matched against (`matchName`); `name` stays the login name so saved "uploaded by" stamps keep working.
  const currentUser = useMemo(() => {
    const low = x => String(x || '').trim().toLowerCase(), u = sessionUser || {}
    const hit = staffDir.find(x => u.id != null && x.user_id != null && String(x.user_id) === String(u.id))
      || staffDir.find(x => [u.email, u.username].some(k => low(k) && low(k) === low(x.email)))
      || staffDir.find(x => low(x.name) && low(x.name) === low(u.name))
    return { ...u, matchName: hit?.name || u.name || '' }
  }, [staffDir, sessionUser])
  const isRealAdmin = isAdminRole(currentUser?.role)
  // Everyone on staff manages everything here (reassign, approve, syllabus, marks). Updates are stamped with the user's name.
  const isAdmin = true
  // Open to every logged-in staff member: non-admins can only move tasks they set or verify (see allowedStatuses).
  const canEdit = true
  // Workspace: reopen on the tab you were last using.
  const [tab, setTab] = useState(() => {
    try { const t = localStorage.getItem('ms-last-tab'); if (t && NAV_GROUPS.some(g => g.items.some(i => i[0] === t && t !== 'admin'))) return t } catch { /* private mode */ }
    return 'overview'
  })
  useEffect(() => { try { localStorage.setItem('ms-last-tab', tab) } catch { /* private mode */ } }, [tab])
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
  const [panelView, setPanelView] = useState('pre')         // 'pre' = Question Setting Panel (Pre Mock) · 'practice' = Practice Setting Panel
  const [panelDraft, setPanelDraft] = useState(null)       // { id?, subject_key, name, role }
  const [addTask, setAddTask] = useState(null)             // null | form for the Add task dialog
  const [editMarksId, setEditMarksId] = useState(null)
  const [editMat, setEditMat] = useState(null)
  const [bStart, setBStart] = useState({ test: 1, section: '', n: 0 })   // where the Practice Bank builder should open
  const [schedFilter, setSchedFilter] = useState('all')            // all | upcoming | done
  const [allotTeacher, setAllotTeacher] = useState('')
  const [allotStatus, setAllotStatus] = useState('')
  const [taskSort, setTaskSort] = useState('due')
  const [pracCounts, setPracCounts] = useState({})
  const [pracWho, setPracWho] = useState({})   // 'uploader|test|subject' -> number of practice questions
  const [sylImport, setSylImport] = useState(null)                   // null | text
  const [sylPage, setSylPage] = useState('plan')                  // plan | official | manual
  const [sylView, setSylView] = useState('cards')                     // cards | grid
  const [sylOnlyEmpty, setSylOnlyEmpty] = useState(false)
  const [sylOpen, setSylOpen] = useState({})                         // test no -> expanded (mobile)
  const [sylQuery, setSylQuery] = useState('')
  const [marksImport, setMarksImport] = useState(null)               // null | text
  const [marksFilter, setMarksFilter] = useState(0)
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
    practiceSetters: Object.fromEntries(SUBJECTS.map(x => [x.key, panelRows.filter(r => r.subject_key === x.key && r.role === 'assistant').map(r => r.name)])),   // only these upload practice questions
  } : null
  const peopleAll = panelRows.length ? [...new Set(panelRows.map(r => r.name))].sort() : ALL_PEOPLE
  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('mission_sainik_settings').select('*')
    const m = {}; (data || []).forEach(r => { m[r.key] = r.value }); setSettings(m)
  }, [])
  useEffect(() => { loadSettings() }, [loadSettings])
  // The admin's settings reach every open screen: re-read them every minute and whenever the window is focused again.
  useEffect(() => {
    const t = setInterval(() => loadSettings(), 60000), f = () => loadSettings()
    window.addEventListener('focus', f)
    return () => { clearInterval(t); window.removeEventListener('focus', f) }
  }, [loadSettings])
  // Menu: the admin chooses which screens staff see (Admin → Menu); the same setting drives the menu, the flow and the redirect below.
  const menuHidden = useMemo(() => hiddenFrom(settings.menu_hidden), [settings.menu_hidden])
  const navGroups = useMemo(() => applyMenu(NAV_GROUPS, menuHidden, isRealAdmin), [menuHidden, isRealAdmin])
  const visibleTabs = useMemo(() => visibleTabIds(navGroups), [navGroups])
  const flowSteps = useMemo(() => visibleFlow(FLOW, visibleTabs), [visibleTabs])
  const [menuDraft, setMenuDraft] = useState(null)       // the admin's unsaved menu choice (a Set of hidden screens)
  useEffect(() => { if (!isRealAdmin && !visibleTabs.has(tab)) setTab('overview') }, [tab, visibleTabs, isRealAdmin]) // eslint-disable-line react-hooks/exhaustive-deps
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
  // Number of questions each practice teacher must set for EACH test, per subject (admin setting; default 25).
  const practiceQOf = key => Math.min(200, Math.max(5, Number(settings['practice_q:' + key]) || 25))
  const practiceQMap = useMemo(() => Object.fromEntries(SUBJECTS.map(x => [x.key, Math.min(200, Math.max(5, Number(settings['practice_q:' + x.key]) || 25))])), [settings])
  const setPracticeQ = async (sub, n) => {
    const q = Math.min(200, Math.max(5, Math.round(n)))
    if (q === practiceQOf(sub.key)) return
    if (!(await putSetting('practice_q:' + sub.key, q))) return
    // tasks that are still Pending follow the new number; submitted ones keep what was handed in
    await supabase.from(TABLE).update({ question_count: q, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }).eq('kind', 'practice').eq('subject', sub.label).eq('status', 'Pending')
    setMsg(`✅ ${sub.label}: ${q} questions per test (each practice teacher, every test)`); load()
  }
  const [mats, setMats] = useState([])
  const [matSetup, setMatSetup] = useState(false)
  const [matDraft, setMatDraft] = useState({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null })
  const [fileKey, setFileKey] = useState(0)
  const [viewMat, setViewMat] = useState(null)
  const [paperMaker, setPaperMaker] = useState(false)
  const [printSet, setPrintSet] = useState(null)   // { subject, setNo } — print a Practice bank set
  const staffOpts = useMemo(() => staffOptions(staffDir), [staffDir])
  const photoOf = tok => staffNameFor(tok, staffOpts)   // full staff name for a stored one-word name, to find the right photo
  const [syl, setSyl] = useState({})            // 'testNo|subject' -> chapter
  const [marks, setMarks] = useState([])
  const [markDraft, setMarkDraft] = useState({ test_no: 1, batch: '', maths: '', reasoning: '', grammar: '', gk: '' })
  const [marksSetup, setMarksSetup] = useState(false)
  const [institute, setInstitute] = useState({ name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur', academicYear: '2026-2027' })
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'exam_institute_config').single()
      .then(({ data }) => { try { if (data?.value) setInstitute(i => ({ ...i, ...JSON.parse(data.value) })) } catch { /* keep defaults */ } }, () => {})
  }, [])

  const isMe = name => nameMatches(currentUser?.matchName, name)
  // Where the logged-in teacher sits on the Panel: [{ subject, role }]. Home and Study material use it, so the panel setup carries through the other tabs.
  const myPanel = (panelRows.length ? panelRows.map(r => ({ key: r.subject_key, name: r.name, role: r.role }))
    : SUBJECTS.flatMap(x => [...PANEL[x.key].map(name => ({ key: x.key, name, role: 'setter' })), { key: x.key, name: PRACTICE_PANEL[x.key].verifier, role: 'verifier' }, ...PRACTICE_PANEL[x.key].assistants.map(name => ({ key: x.key, name, role: 'assistant' }))]))
    .filter(m => isMe(m.name)).map(m => ({ subject: SUBJECTS.find(x => x.key === m.key)?.label || m.key, role: m.role === 'assistant' ? 'practice setter' : m.role === 'verifier' ? 'practice verifier' : 'setter' }))
  const setsIt = r => settersOfRow(r).some(isMe)   // the main setter or a co-setter
  // Tasks tab: if nothing is waiting on me when the data first loads, open on my tasks (or everyone's) instead of an empty list.
  const taskViewAuto = useRef(false)
  useEffect(() => {
    if (taskViewAuto.current || !rows.length) return
    taskViewAuto.current = true
    const needs = rows.filter(r => (setsIt(r) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted')).length
    if (needs) return
    setTaskView(rows.some(r => setsIt(r) || isMe(r.verifier)) ? 'mine' : 'all')
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadedAt = useRef(Date.now())
  const load = useCallback(async quiet => {
    if (quiet !== true) setLoading(true)
    const { data, error } = await fetchAll(() => supabase.from(TABLE).select('*').order('kind').order('test_no').order('id'))
    if (error) {
      const text = `${error.code || ''} ${error.message || ''}`
      if (/42P01|PGRST205|does not exist|schema cache/i.test(text)) setSetup(true)
      else if (quiet !== true) setMsg('Could not load: ' + error.message)
      if (quiet !== true) setRows([])
    } else { setSetup(false); setRows(data || []) }
    loadedAt.current = Date.now()
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  // Keep a long-open workspace fresh: when you come back to the tab after a while, quietly pull the latest tasks.
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 90000) load(true) }
    document.addEventListener('visibilitychange', back); return () => document.removeEventListener('visibilitychange', back)
  }, [load])
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
    if (!isRealAdmin) return setMsg('Only an admin can change the syllabus plan.')   // every other rule follows this plan
    if ((syl[test_no + '|' + subject] || '') === chapter) return
    setSyl(m => ({ ...m, [test_no + '|' + subject]: chapter }))
    const { error } = await supabase.from(SYL_TABLE).upsert({ test_no, subject, chapter, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }, { onConflict: 'test_no,subject' })
    setMsg(error ? '❌ ' + error.message : `✅ Chapter saved for ${(TESTS.find(t => t.no === Number(test_no)) || {}).id || 'Test ' + test_no} · ${subject}`)
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
    if (!isRealAdmin) return setMsg('Only an admin can delete marks.')
    if (!window.confirm('Delete this entry?')) return
    const { error } = await supabase.from(MARKS_TABLE).delete().eq('id', r.id)
    if (error) return setMsg('❌ ' + error.message)
    loadExtra()
  }
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 4500); return () => clearTimeout(t) }, [msg])

  const tests = useMemo(() => rows.filter(r => r.kind === 'test'), [rows])
  // A practice teacher has ONE assignment per subject: every one of the 20 tests, on that test's planned chapter. Extra rows left over from the old
  // "Set 1/2/3" model (same teacher and subject) are ignored; the first row of each teacher and subject is the assignment.
  const practice = useMemo(() => { const seen = new Set(); return rows.filter(r => r.kind === 'practice').filter(r => { const k = r.subject + '|' + r.setter; if (seen.has(k)) return false; seen.add(k); return true }) }, [rows])
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
    if (setsIt(task)) { if (s === 'Pending') out.push('Submitted'); if (s === 'Submitted') out.push('Pending') }
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
    if (!isRealAdmin) return setMsg('Only an admin can delete a task.')
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
      r.kind, r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice', r.subject, settersLabel(r, fullName), r.verifier ? fullName(r.verifier) : '',
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
      ['mission_sainik_audit', 'id', '20261209'], ['mission_sainik_signoffs', 'id', '20261209'], ['mission_sainik_panel', 'id', '20261210 (editable panel)'], ['mission_sainik_questions', 'passage', '20261211 (passages & figures)'], ['mission_sainik_paper_cfg', 'series', '20261212 (shared paper settings)'], ['mission_sainik_reviews', 'id', '20261213 (review notes)']]
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
        {(() => {
          // ── Menu: which screens staff see, for everyone at once ──
          const allIds = NAV_GROUPS.flatMap(g => g.items.map(i => i[0]))
          const now = menuDraft || menuHidden
          const dirty = !!menuDraft && hiddenToValue(menuDraft) !== hiddenToValue(menuHidden)
          const flip = id => { const n = new Set(now); n.has(id) ? n.delete(id) : n.add(id); setMenuDraft(n) }
          const save = async () => {
            const v = hiddenToValue(now)
            const ok = v ? await putSetting('menu_hidden', v) : await delSetting('menu_hidden')
            if (ok) { setMenuDraft(null); setMsg('✅ Menu saved for everyone') }
          }
          const chipS = { padding: '8px 14px', minHeight: 40, borderRadius: 99, border: `1.5px solid ${PX.line}`, background: '#fff', color: PX.navy, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
          return (
            <PremiumCard title="Menu · which screens staff see" subtitle="Switch screens on or off for every teacher at once. You always see everything. Teachers get the change within a minute, or when they refresh."
              right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{dirty && <button className="px-btn ghost" onClick={() => setMenuDraft(null)}>Undo</button>}<button className="px-btn gold" disabled={!dirty} onClick={save}>Save for everyone</button></span>}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Quick set</span>
                {MENU_PRESETS.map(p => <button key={p.key} type="button" style={chipS} onClick={() => setMenuDraft(hiddenForPreset(p, allIds))}>{p.label}</button>)}
              </div>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(230px,1fr))' }}>
                {NAV_GROUPS.map(g => {
                  const items = g.items.filter(i => i[0] !== 'admin')
                  if (!items.length) return null
                  return (
                    <div key={g.title}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: PX.sub, marginBottom: 6 }}>{g.title}</div>
                      {items.map(([id, ic, label]) => {
                        const locked = ALWAYS_ON.includes(id), on = locked || !now.has(id)
                        return (
                          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', minHeight: 44, cursor: locked ? 'default' : 'pointer', opacity: locked ? .7 : 1 }}>
                            <input type="checkbox" checked={on} disabled={locked} onChange={() => flip(id)} style={{ width: 20, height: 20 }} />
                            <span aria-hidden="true">{ic}</span><span style={{ fontWeight: 700, color: PX.ink, fontSize: 14 }}>{label}</span>{locked && <small style={{ color: PX.sub }}>always on</small>}
                          </label>)
                      })}
                    </div>)
                })}
              </div>
            </PremiumCard>)
        })()}
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
            {TESTS.filter(t => schedFilter === 'all' || (schedFilter === 'upcoming' ? t.date >= today : t.date < today)).map(t => {
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
            <div style={{ fontSize: 13, color: PX.sub, marginBottom: 10 }}>Creates the 20 tests × 6 sections and the 13 practice teacher assignments (each covers all 20 tests) from the Office Order. Existing rows are left as they are.</div>
            <button className="px-btn gold" disabled={busy} onClick={createAllotment}>{busy ? 'Creating…' : 'Create allotment'}</button>
          </PremiumCard>
        )}
      </>
    )
  }

  const exportScheduleCsv = () => downloadCsv('Mission_Sainik_schedule.csv', [['Test', 'Date', 'Day', 'Drafts due', 'Verification', 'Final & print']].concat(TESTS.map(t => [t.id, t.date, dayName(t.date), t.drafts, t.verify, t.print])))
  const exportScheduleIcs = () => {
    const ev = TESTS.flatMap(t => [
      { uid: 'pmt-' + t.no, date: t.date, title: `${t.id} — Pre Mock Test`, description: `Mission Sainik 2027 · 150 questions · 300 marks` },
      { uid: 'pmt-draft-' + t.no, date: t.drafts, title: `${t.id}: drafts due`, description: 'Submit question drafts' },
      { uid: 'pmt-verify-' + t.no, date: t.verify, title: `${t.id}: verification`, description: 'Verify the questions' },
      { uid: 'pmt-print-' + t.no, date: t.print, title: `${t.id}: final & print`, description: 'Final paper and printing' },
    ])
    downloadFile('Mission_Sainik_schedule.ics', buildIcs(ev, 'Mission Sainik 2027 — Pre Mock'), 'text/calendar;charset=utf-8')
  }
  const exportMockCsv = () => downloadCsv('Mission_Sainik_mock_series.csv', [['Test', 'Date', 'Day']].concat(MOCK_TESTS.map(t => [t.id, t.date, dayName(t.date)])))
  const exportMockIcs = () => downloadFile('Mission_Sainik_mock_series.ics', buildIcs(MOCK_TESTS.map(t => ({ uid: 'mt-' + t.no, date: t.date, title: `${t.id} — Sainik Mock Test`, description: 'AISSEE pattern · 125 questions · 300 marks · 150 minutes' })), 'Mission Sainik 2027 — Mega Mock'), 'text/calendar;charset=utf-8')
  const Schedule = () => (
    <PremiumCard title="Schedule of Pre Mock Tests" subtitle={`Office Order ${ORDER_NO} · tests on alternate days`} bodyStyle={{ padding: 0 }}
      right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="px-hbtn" onClick={exportScheduleIcs}>📅 Add to calendar</button>
        <button className="px-hbtn" onClick={exportScheduleCsv}>⬇ CSV</button>
      </span>}>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Schedule filter">
        {[['all', 'All 20'], ['upcoming', 'Upcoming'], ['done', 'Held']].map(([id, l]) => (
          <button key={id} className="msx-tap" aria-pressed={schedFilter === id} onClick={() => setSchedFilter(id)} style={{ padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700, background: schedFilter === id ? PX.navy : '#fff', color: schedFilter === id ? '#fff' : PX.ink, border: `1px solid ${schedFilter === id ? PX.navy : '#d9d2c2'}` }}>{l}</button>))}
        <span style={{ fontSize: 11.5, color: PX.sub }}>No test or deadline on 13 Dec, 27 Dec, 1 Jan</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="px-table msx-compact msx-sched">
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
                  <td className="nw">{fmt(t.date)}</td>
                  <td><Pill tone={dayName(t.date) === 'Sunday' ? 'gold' : 'mute'} dot={false}>{dayName(t.date)}{dayName(t.date) === 'Sunday' ? ' *' : ''}</Pill></td>
                  <td>{fmtShort(t.drafts)}</td><td>{fmtShort(t.verify)}</td><td>{fmtShort(t.print)}</td>
                  <td><span className="sc-sec"><MiniBar pct={(st.done / (r.length || 6)) * 100} tone={done ? 'ok' : 'gold'} width={48} /><b>{st.done}/{r.length || 6}</b><small>{st.ok} approved</small></span></td>
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
      <PremiumCard title="Mock test schedule" bodyStyle={{ padding: 0 }} right={<span style={{ display: 'flex', gap: 8 }}><button className="px-hbtn" onClick={exportMockIcs}>📅 Add to calendar</button><button className="px-hbtn" onClick={exportMockCsv}>⬇ CSV</button></span>}>
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
        <PremiumCard title="Delivery forecast" subtitle={`Submission deadline ${fmt(SUBMISSION_DEADLINE)} · ${daysToDeadline > 0 ? daysToDeadline + ' days left' : 'deadline passed'}`}
          right={<button className="px-hbtn" onClick={() => downloadCsv('Mission_Sainik_pending_by_teacher.csv', [['Teacher', 'Pending sections', 'Overdue', 'Sections'], ...setters.map(x => [fullName(x.n), x.l.length, x.late, x.l.map(r => (r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice') + ' ' + r.subject).join('; ')])])}>⬇ CSV</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            {card('Still pending', open.length, `of ${rows.length} sections`)}
            {card('Overdue', late.length, 'past their own due date', late.length > 0)}
            {card('Due in 3 days', soon.length, 'needs a nudge')}
            {card('Pace needed', pace + '/day', 'sections to clear daily', pace > 15)}
          </div>
          {setters.length > 0 && (
            <div style={{ marginTop: 12, maxWidth: 680 }}>
              {setters.map(x => (
                <div key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${PX.line || '#eef1f6'}`, flexWrap: 'wrap' }}>
                  <PersonCell name={x.n} size={30}>{fullName(x.n)}</PersonCell>
                  <span style={{ flex: '1 1 auto', fontSize: 12.5, color: x.late ? PX.bad : PX.sub }}>{x.l.length} pending{x.late ? ` · ${x.late} overdue` : ''}</span>
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
      const mine = rows.filter(r => settersOfRow(r).includes(n))
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
        <PremiumCard title="Teacher activity" subtitle="Task progress and study-material uploads per teacher. “Idle” = days since their last update or upload." bodyStyle={{ padding: 0, overflowX: 'auto' }}
          right={<button className="px-hbtn" onClick={() => downloadCsv('Mission_Sainik_teacher_activity.csv', [['Teacher', 'Sections set', 'Submitted', 'Overdue', 'To verify', 'Verified', 'Uploads', 'Days idle'], ...stats.map(x => [fullName(x.n), x.set, x.submitted, x.overdue, x.toVerify, x.verified, x.uploads, x.idle ?? ''])])}>⬇ CSV</button>}>
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
    const workload = {}; tests.forEach(r => { const o = (workload[r.setter] = workload[r.setter] || { n: 0, done: 0 }); o.n++; if (r.status !== 'Pending') o.done++ })   // (not named `load`: that would hide the module's load() that the plan cards call to refresh)
    const people = Object.keys(workload).sort((a, b) => workload[b].n - workload[a].n)
    const dim = r => (allotTeacher && r.setter !== allotTeacher) || (allotStatus && (allotStatus === 'Overdue' ? !isOverdue(r, today) : r.status !== allotStatus))
    const exportAllot = () => downloadCsv('Mission_Sainik_allotment.csv', [['Test', 'Date', ...SUBJECTS.map(x => x.label + ' (setter)'), ...SUBJECTS.map(x => x.label + ' (status)')]].concat(TESTS.map(t => [t.id, t.date, ...SUBJECTS.map(x => byCell[t.no + '|' + x.label]?.setter || ''), ...SUBJECTS.map(x => byCell[t.no + '|' + x.label]?.status || '')])))
    return (
      <>
      <MissionSainikSetterPlan {...{ photoOf, tests, TESTS, SUBJECTS, panelSetters, peopleAll, staffDir, today, fmtShort, saveTask, reload: load, setMsg, audit, currentUser, isAdmin: isRealAdmin, isMobile }} />
      <MissionSainikPracticePlan {...{ coverOf, questionsPer: practiceQOf, photoOf, practiceSetters: key => (panelRows.length ? panelRows.filter(r => r.subject_key === key && r.role === 'assistant').map(r => r.name) : (PRACTICE_PANEL[key]?.assistants || [])), practice, SUBJECTS, PRACTICE_PANEL, practiceNames: key => (panelRows.length ? panelRows.filter(r => r.subject_key === key && r.role !== 'setter').map(r => r.name) : [PRACTICE_PANEL[key]?.verifier, ...(PRACTICE_PANEL[key]?.assistants || [])].filter(Boolean)), peopleAll, staffDir, reload: load, setMsg, audit, currentUser, isAdmin: isRealAdmin, isMobile }} />
      <PremiumCard title="Allotment" subtitle="Who sets each section. Tap a cell to update it."
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{filterTest ? <button className="px-btn ghost" onClick={() => setFilterTest(0)}>Show all tests</button> : null}<button className="px-hbtn" onClick={exportAllot}>⬇ CSV</button></span>} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="px-input" style={{ width: 'auto' }} value={allotTeacher} onChange={e => setAllotTeacher(e.target.value)} aria-label="Highlight a teacher"><option value="">All teachers</option>{people.map(n => <option key={n} value={n}>{fullName(n)} · {workload[n].done}/{workload[n].n}</option>)}</select>
          <select className="px-input" style={{ width: 'auto' }} value={allotStatus} onChange={e => setAllotStatus(e.target.value)} aria-label="Highlight a status"><option value="">Any status</option>{['Pending', 'Submitted', 'Verified', 'Approved', 'Overdue'].map(x => <option key={x}>{x}</option>)}</select>
          {(allotTeacher || allotStatus) && <button className="px-btn ghost" onClick={() => { setAllotTeacher(''); setAllotStatus('') }}>Clear</button>}
          <span style={{ fontSize: 12, color: PX.sub }}>Matching cells stay bright; the rest fade.</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="px-table msx-allot" style={{ minWidth: 600, width: '100%', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 84 }} />{SUBJECTS.map(s => <col key={s.key} />)}</colgroup>
            <thead><tr><th style={{ paddingInline: 8 }}>Test</th>{SUBJECTS.map(s => <th key={s.key} style={{ paddingInline: 6 }}>{s.short}</th>)}</tr></thead>
            <tbody>
              {list.map(t => (
                <tr key={t.no}>
                  <td style={{ paddingInline: 8 }}><b>{t.id}</b><div><span className="msx-adate">{fmtShort(t.date)}</span></div></td>
                  {SUBJECTS.map(s => {
                    const r = byCell[t.no + '|' + s.label]
                    if (!r) return <td key={s.key} style={{ color: PX.faint }}>—</td>
                    return (
                      <td key={s.key} className="msx-click" onClick={() => setSel(r)} style={{ paddingInline: 6, overflow: 'hidden', ...(dim(r) ? { opacity: 0.25 } : {}) }}>
                        <div className="msx-acell">
                          <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><PersonCell name={r.setter} size={22}>{r.setter}</PersonCell></span>
                          <div><Chip status={r.status} overdue={isOverdue(r, today)} small /></div>
                        </div>
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
      </>
    )
  }

  // Practice tab → open the Practice Bank builder on the right subject and set so questions can be added straight away.
  const subjectOfPractice = r => (SUBJECTS.find(x => x.label === r.subject) || SUBJECTS.find(x => r.subject.includes(x.label)) || SUBJECTS[0])
  const goAddQuestions = (subjectLabel, testNo) => { setBStart(b => ({ test: testNo, section: subjectLabel, n: b.n + 1 })); setTab('practicebuilder') }   // testNo = the Pre Mock test it prepares for (none: the builder opens on the present test)
  const TaskRow = ({ r }) => {
    const late = isOverdue(r, today)
    const next = allowedStatuses(r)
    const quick = next.find(x => STATUS_FLOW.indexOf(x) === STATUS_FLOW.indexOf(r.status) + 1)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kind === 'test' ? `PMT-${String(r.test_no).padStart(2, '0')} · ` : 'Practice · '}{r.subject}</div>
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 2 }}>
            {settersOfRow(r).length > 1 ? 'Setters' : 'Setter'} {settersLabel(r, fullName)}{r.verifier ? ` · verifier ${fullName(r.verifier)}` : ''} · {r.question_count ?? '—'} questions · due {fmtShort(dueFor(r))}
          </div>
        </div>
        <Chip status={r.status} overdue={late} />
        {r.kind === 'practice' && <button className="px-btn ghost" onClick={() => goAddQuestions(subjectOfPractice(r).label)}>＋ Questions</button>}
        {quick && <button className="px-btn gold" disabled={busy} onClick={() => saveTask(r, { status: quick })}>Mark {quick.toLowerCase()}</button>}
        <button className="px-btn ghost" onClick={() => setSel(r)}>Open</button>
      </div>
    )
  }

  const Mine = () => {
    const names = Array.from(new Set(rows.flatMap(r => [r.setter, r.verifier]).filter(Boolean))).sort()
    const needsMe = r => (setsIt(r) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted')
    const isMine = r => setsIt(r) || isMe(r.verifier)
    const base = taskView === 'needs' ? rows.filter(needsMe) : taskView === 'mine' ? rows.filter(isMine) : rows.filter(r => !person || settersOfRow(r).includes(person) || r.verifier === person)
    const qq = taskQ.trim().toLowerCase()
    const matches = r => (!subjF || r.subject === subjF) && (!qq || [r.subject, r.setter, r.verifier, r.kind === 'test' ? 'pmt-' + String(r.test_no).padStart(2, '0') : 'practice'].join(' ').toLowerCase().includes(qq))
    const scoped = base.filter(matches)
    const list = scoped.filter(r => !statusF || (statusF === 'Overdue' ? isOverdue(r, today) : r.status === statusF))
      .sort((a, b) => (taskSort === 'test' ? a.test_no - b.test_no || a.subject.localeCompare(b.subject) : taskSort === 'subject' ? a.subject.localeCompare(b.subject) || a.test_no - b.test_no : taskSort === 'status' ? STATUS_FLOW.indexOf(a.status) - STATUS_FLOW.indexOf(b.status) || dueFor(a).localeCompare(dueFor(b)) : taskSort === 'teacher' ? String(a.setter).localeCompare(String(b.setter)) || a.test_no - b.test_no : dueFor(a).localeCompare(dueFor(b)) || a.test_no - b.test_no))
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
          <select className="px-input" style={{ flex: '0 1 160px' }} value={taskSort} onChange={e => setTaskSort(e.target.value)} aria-label="Sort tasks">
            <option value="due">Sort: due date</option><option value="test">Sort: test no.</option><option value="subject">Sort: subject</option><option value="status">Sort: status</option><option value="teacher">Sort: teacher</option>
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
          right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="px-btn gold" onClick={() => setAddTask(newTaskForm('test'))}>＋ Add task</button><button className="px-btn ghost" onClick={() => { const t = list.map(r => `• ${r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice'} · ${r.subject} — ${r.status} · due ${fmtShort(dueFor(r))}`).join('\n'); navigator.clipboard?.writeText(t).then(() => setMsg('✅ List copied'), () => setMsg('❌ Copy failed')) }}>Copy list</button><button className="px-btn ghost" onClick={exportCsv}>Export CSV</button></span>} bodyStyle={{ padding: 0 }}>
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


  useEffect(() => {
    if (!['practice', 'panel', 'allotment'].includes(tab)) return
    ;(async () => {
      let { data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('test_no,section,uploaded_by').eq('series', 'practice').is('deleted_at', null).order('id'))
      if (error) ({ data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('test_no,section,uploaded_by').eq('series', 'practice').order('id')))
      const m = {}, w = {}; (error ? [] : data || []).forEach(q => { const k = q.test_no + '|' + q.section; m[k] = (m[k] || 0) + 1; const kw = (q.uploaded_by || '') + '|' + k; w[kw] = (w[kw] || 0) + 1 }); setPracCounts(m); setPracWho(w)
    })()
  }, [tab])
  // How far one practice teacher has got: tests where they have set their full quota / started, and their questions. Every test counts.
  const coverOf = (subLabel, name, q) => {
    let done = 0, started = 0, qs = 0
    TESTS.forEach(t => {
      let n = 0
      for (const [k, c] of Object.entries(pracWho)) { const i = k.indexOf('|'), by = k.slice(0, i), rest = k.slice(i + 1); if (rest === t.no + '|' + subLabel && nameMatches(by, name)) n += c }
      qs += n; if (n >= q) done++; else if (n > 0) started++
    })
    return { done, started, total: TESTS.length, qs }
  }
  const practiceSets = (() => {
    const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']
    const groups = SUBJECTS.map((sub, si) => ({ sub, tone: TONES[si % 6], sets: TESTS.map(t => ({ no: t.no, n: pracCounts[t.no + '|' + sub.label] || 0, q: practiceQOf(sub.key), chapter: syl[t.no + '|' + sub.label] || '' })) }))   // one practice set per Pre Mock test
    const all = groups.flatMap(g => g.sets), done = all.filter(x => x.n >= x.q).length, started = all.filter(x => x.n > 0 && x.n < x.q).length, qn = all.reduce((t, x) => t + x.n, 0), target = all.reduce((t, x) => t + x.q, 0)
    const pct = target ? Math.round((qn / target) * 100) : 0
    const Ring = ({ n, q, tone }) => { const r = 19, c = 2 * Math.PI * r, f = Math.min(1, n / q); return (<svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true" style={{ flex: 'none' }}><circle cx="25" cy="25" r={r} fill="none" stroke="#eef1f6" strokeWidth="5" /><circle cx="25" cy="25" r={r} fill="none" stroke={n >= q ? '#0f7a4c' : tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 25 25)" /><text x="25" y="29" textAnchor="middle" fontSize="12" fontWeight="800" fill="#132a4f">{n >= q ? '✓' : n}</text></svg>) }
    return (
      <div style={{ padding: isMobile ? 12 : '16px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)' }}>
        <div style={{ borderRadius: 22, padding: isMobile ? '14px 14px' : '18px 22px', marginBottom: 14, color: '#fff', background: 'linear-gradient(135deg,#132a4f 0%,#1e3a6e 58%,#2f5aa3 100%)', boxShadow: '0 16px 36px -22px rgba(19,42,79,.7)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#e9d9b0' }}>Practice bank</div>
            <div style={{ fontFamily: PX.serif, fontSize: isMobile ? 22 : 26, fontWeight: 600 }}>{qn} <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}>of {target} questions</span></div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.18)', margin: '8px 0 4px', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#b8923a,#f0e1b8)' }} /></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{pct}% complete · one practice set for every test · open any test to add, edit, preview or scan questions</div>
          </div>
          <button type="button" onClick={() => setPaperMaker(true)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(180deg,#e9d9b0,#d9bf79)', color: '#132a4f', fontWeight: 800, fontSize: 14, padding: '12px 18px', borderRadius: 16, boxShadow: '0 10px 22px -12px rgba(0,0,0,.5)' }}>🧠 Smart paper maker</button>
          <div style={{ display: 'flex', gap: 8 }}>{[[done, 'Tests done'], [started, 'In progress'], [all.length - done - started, 'Empty']].map(([n, l]) => <div key={l} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '8px 14px', textAlign: 'center', minWidth: 74 }}><div style={{ font: '700 20px Georgia,serif' }}>{n}</div><div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#e9d9b0', fontWeight: 700 }}>{l}</div></div>)}</div>
        </div>
        {groups.map(g => (
          <div key={g.sub.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: g.tone }} /><b style={{ fontSize: 13.5 }}>{g.sub.label}</b><span style={{ fontSize: 12, color: PX.sub }}>{g.sets.reduce((t, x) => t + x.n, 0)}/{g.sets.length * 25}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 10 }}>
              {g.sets.map(x => (
                <div key={x.no} style={{ position: 'relative' }}><button type="button" onClick={() => goAddQuestions(g.sub.label, x.no)} title={x.chapter ? `Chapter: ${x.chapter}` : 'No chapter planned yet'} aria-label={`${g.sub.label} practice for PMT-${String(x.no).padStart(2, '0')}, ${x.n} of ${x.q} questions`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '10px 12px', borderRadius: 16, border: `1.5px solid ${x.n >= x.q ? '#bfe3cc' : PX.line}`, background: x.n >= x.q ? '#f7fcf9' : '#fff', cursor: 'pointer', fontFamily: 'inherit', borderLeft: `4px solid ${g.tone}`, boxShadow: '0 1px 2px rgba(19,42,79,.05)', transition: 'transform .15s,box-shadow .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px -16px rgba(19,42,79,.5)' }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(19,42,79,.05)' }}>
                  <Ring n={x.n} q={x.q} tone={g.tone} />
                  <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: PX.ink }}>PMT-{String(x.no).padStart(2, '0')}</span><span style={{ display: 'block', fontSize: 11.5, whiteSpace: 'nowrap', color: x.n >= x.q ? '#14633f' : PX.sub, fontWeight: 600 }}>{x.n >= x.q ? 'Complete' : x.n ? `${x.n}/${x.q} · ✎ Edit` : 'Empty · ＋ Add'}</span></span>
                </button>
                {x.n > 0 && <button type="button" title="Print this set (2 columns, space saver, class copies)" aria-label={`Print ${g.sub.label} practice for PMT-${String(x.no).padStart(2, '0')}`} onClick={() => setPrintSet({ subject: g.sub.label, setNo: x.no })} style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 10, border: `1px solid ${PX.line}`, background: '#fff', cursor: 'pointer', fontSize: 14 }}>🖨</button>}</div>))}
            </div>
          </div>))}
      </div>
    )
  })()
  const Practice = () => (
    <PremiumCard title="Practice question bank" subtitle="Latest pattern · verified by another teacher of the subject · issued to students by 15 Dec" right={<button className="px-btn gold" onClick={() => setAddTask(newTaskForm('practice'))}>＋ Add practice set</button>} bodyStyle={{ padding: 0 }}>
      {practiceSets}
      {practice.length === 0 && <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No practice teachers yet. {isAdmin ? 'Use “Create allotment” on the Overview tab.' : ''}</div>}
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
    if (d.question_quota !== undefined) row.question_quota = d.question_quota === '' || d.question_quota == null ? null : Math.max(0, Math.floor(Number(d.question_quota)) || 0)
    const q = d.id ? supabase.from('mission_sainik_panel').update(row).eq('id', d.id) : supabase.from('mission_sainik_panel').insert(row)
    const { error } = await q
    if (error) return setMsg('❌ ' + (/duplicate|unique/i.test(error.message) ? 'That person is already on the panel for this subject and role.' : error.message + ' (run migrations 20261210 and 20261215)'))
    audit(d.id ? 'panel_edit' : 'panel_add', d.subject_key, row)
    let note = ''
    if (d.test_count !== undefined && d.test_count !== '' && String(d.test_count) !== String(d.test_count_was ?? '')) {
      const res = await applyTestCount({ ...d, role: d.role }, row.name, d.test_count, workFor(d))
      note = res.ok ? (res.changed ? ` · ${res.changed} ${d.role === 'assistant' ? 'practice set' : 'paper'}${res.changed === 1 ? '' : 's'} ${d.role === 'assistant' ? 'added' : 'reassigned'}` : '') : ` · number not applied: ${res.error}`
      if (res.ok && res.changed) load()
    }
    setPanelDraft(null); setMsg('✅ Panel saved' + note); loadPanel()
  }
  // "How many tests will they set": give one teacher exactly N Pre Mock tests (role setter) or N practice sets (role assistant) of a subject.
  // `work` is the caller's working copy of that subject's tasks, so several teachers can be added in a row. Returns { ok, changed, work, error }.
  const applyTestCount = async (d, name, count, work) => {
    const sub = SUBJECTS.find(x => x.key === d.subject_key)
    if (d.role === 'assistant') {   // a practice teacher: ONE assignment per subject, covering every test
      if (work.some(x => x.setter === name)) return { ok: true, changed: 0, work }
      const row = { kind: 'practice', test_no: 0, subject: sub.label, setter: name, verifier: PRACTICE_PANEL[d.subject_key]?.verifier || null, question_count: practiceQOf(d.subject_key), status: 'Pending', updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from(TABLE).insert(row).select()
      if (error) return { ok: false, error: error.message, work }
      audit('panel_practice_teacher', d.subject_key, { name }); return { ok: true, changed: 1, work: [...work, ...(data || [])] }
    }
    if (d.role === 'verifier' || count === '' || count == null) return { ok: true, changed: 0, work }
    const rule = [...new Set([...panelSetters(d.subject_key), name])]
    const r = retarget(work, name, count, rule)
    if (r.error) return { ok: false, error: r.error, work }
    for (const c of r.changes) {
      const row = work.find(x => x.id === c.id)
      const verifier = nextVerifier(row, sub.key, c.setter, rule)
      const { error } = await supabase.from(TABLE).update({ setter: c.setter, ...(verifier ? { verifier } : {}), updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }).eq('id', c.id)
      if (error) return { ok: false, error: error.message, work }
    }
    if (r.changes.length) audit('panel_tests', d.subject_key, { name, role: d.role, tests: Number(count), moved: r.changes.length })
    return { ok: true, changed: r.changes.length, work: work.map(x => { const c = r.changes.find(y => y.id === x.id); return c ? { ...x, setter: c.setter } : x }) }
  }
  const workFor = d => (d.role === 'assistant' ? practice.filter(x => subjectOfPractice(x).key === d.subject_key) : tests.filter(x => x.subject === SUBJECTS.find(y => y.key === d.subject_key)?.label))
  // Pick-from-staff: add several teachers to one subject / role in one go. Skips anyone already there; each gets the chosen number of tests.
  const addPanelMembers = async (tokens, perPerson = {}) => {
    const d = panelDraft; if (!d || !tokens.length) return
    const quota = d.question_quota === '' || d.question_quota == null ? null : Math.max(0, Math.floor(Number(d.question_quota)) || 0)
    let added = 0, skipped = 0, failed = '', moved = 0, countNote = ''
    let work = workFor(d)
    for (const name of tokens) {
      const row = { subject_key: d.subject_key, name, role: d.role, created_by: currentUser?.name || '', ...(quota !== null ? { question_quota: quota } : {}) }
      const { error } = await supabase.from('mission_sainik_panel').insert(row)
      if (!error) { added++; audit('panel_add', d.subject_key, row) }
      else if (/duplicate|unique/i.test(error.message)) skipped++
      else { failed = error.message + ' (run migrations 20261210 and 20261215)'; break }
      if (!error) {
        const own = perPerson[name]
        const res = await applyTestCount(d, name, own !== undefined && own !== '' ? own : d.test_count, work)
        work = res.work; moved += res.changed
        if (!res.ok) countNote = ` · number not applied for ${name}: ${res.error}`
      }
    }
    if (failed) setMsg('❌ ' + failed)
    else {
      setMsg(`✅ ${added} added${skipped ? ` · ${skipped} already on the panel` : ''}${moved ? ` · ${moved} ${d.role === 'assistant' ? 'practice set' : 'paper'}${moved === 1 ? '' : 's'} ${d.role === 'assistant' ? 'added' : 'assigned'}` : ''}${countNote}`)
      if (added) { setPanelDraft(null); loadPanel(); if (moved) load() }
    }
  }
  const deletePanelMember = async m => {
    if (!isRealAdmin) return setMsg('Only an admin can change the panel.')
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
  // Two separate panels: Pre Mock setters ('setter'), and the Practice panel (practice setters 'assistant' + practice verifiers 'verifier').
  const PRACTICE_ROLES = ['assistant', 'verifier']
  const inView = (r, view) => (view === 'pre' ? r.role === 'setter' : PRACTICE_ROLES.includes(r.role))
  const roleOpts = role => (role === 'setter' ? [['setter', 'Question setter (Pre Mock)']] : [['assistant', 'Practice setter'], ['verifier', 'Practice verifier']])
  const roleLabel = role => (role === 'assistant' ? 'practice setter' : role === 'verifier' ? 'practice verifier' : 'setter')
  const Panel = () => (
    <>
      <PremiumCard title={panelView === 'pre' ? 'Question Setting Panel · Pre Mock' : 'Practice Setting Panel'} subtitle={panelView === 'pre' ? 'Teachers who set the Pre Mock tests. Until you add members here, the panel from the notice is used.' : 'Teachers who set the Practice question bank, and who verify it. This panel is separate from the Pre Mock panel.'}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isRealAdmin && <button className="px-btn gold" onClick={() => setPanelDraft({ subject_key: SUBJECTS[0].key, name: '', role: panelView === 'pre' ? 'setter' : 'assistant' })}>{panelView === 'pre' ? '＋ Add setter' : '＋ Add practice member'}</button>}
          {!panelRows.length && <button className="px-btn ghost" onClick={loadPanelFromNotice}>Load from notice</button>}
        </span>}>
        <div data-ti-skip role="tablist" aria-label="Panel" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: panelDraft ? 12 : 8 }}>
          {[['pre', '🧱 Pre Mock panel'], ['practice', '🗂️ Practice panel']].map(([k, l]) => {
            const n = panelRows.length ? panelRows.filter(r => inView(r, k)).length : SUBJECTS.reduce((a, x) => a + (k === 'pre' ? PANEL[x.key].length : 1 + PRACTICE_PANEL[x.key].assistants.length), 0)
            return <button key={k} type="button" role="tab" aria-selected={panelView === k} onClick={() => { setPanelView(k); setPanelDraft(null) }}
              style={{ padding: '8px 16px', borderRadius: 99, border: `1.5px solid ${panelView === k ? PX.navy : PX.line}`, background: panelView === k ? PX.navy : '#fff', color: panelView === k ? '#fff' : PX.navy, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l} · {n}</button>
          })}
        </div>
        {panelDraft && !panelDraft.id && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.2fr 1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>1 · Subject<select className="px-input" value={panelDraft.subject_key} onChange={e => setPanelDraft({ ...panelDraft, subject_key: e.target.value })}>{SUBJECTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>2 · Role<select className="px-input" value={panelDraft.role} onChange={e => setPanelDraft({ ...panelDraft, role: e.target.value })}>{roleOpts(panelDraft.role).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {panelDraft.role === 'setter' ? <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>{'Pre Mock tests to set'}<input className="px-input" type="number" min="0" placeholder={panelDraft.role === 'assistant' ? 'e.g. 1' : 'e.g. 5'} value={panelDraft.test_count ?? ''} onChange={e => setPanelDraft({ ...panelDraft, test_count: e.target.value })} /></label> : <span />}
              <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Questions each (optional)<input className="px-input" type="number" min="0" placeholder="e.g. 100" value={panelDraft.question_quota ?? ''} onChange={e => setPanelDraft({ ...panelDraft, question_quota: e.target.value })} /></label>
              <button className="px-btn ghost" onClick={() => setPanelDraft(null)}>Cancel</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: PX.sub, marginBottom: 6 }}>3 · Pick the teachers</div>
            <TeacherPicker staff={staffDir} taken={panelRows.filter(r => r.subject_key === panelDraft.subject_key && r.role === panelDraft.role).map(r => r.name)} onAdd={addPanelMembers} addLabel="Add to panel" countLabel={panelDraft.role === 'setter' ? 'tests' : ''} defaultCount={panelDraft.test_count ?? ''} />
          </div>)}
        {panelDraft?.id && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.3fr 1.1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Subject<select className="px-input" value={panelDraft.subject_key} onChange={e => setPanelDraft({ ...panelDraft, subject_key: e.target.value })}>{SUBJECTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Name (e.g. Sumanta)<input className="px-input" value={panelDraft.name} onChange={e => setPanelDraft({ ...panelDraft, name: e.target.value })} /></label>
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Role<select className="px-input" value={panelDraft.role} onChange={e => setPanelDraft({ ...panelDraft, role: e.target.value })}>{roleOpts(panelDraft.role).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {panelDraft.role === 'setter' ? <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>{'Pre Mock tests to set'}<input className="px-input" type="number" min="0" value={panelDraft.test_count ?? ''} onChange={e => setPanelDraft({ ...panelDraft, test_count: e.target.value })} /></label> : <span />}
            <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Questions to upload<input className="px-input" type="number" min="0" placeholder="e.g. 100" value={panelDraft.question_quota ?? ''} onChange={e => setPanelDraft({ ...panelDraft, question_quota: e.target.value })} /></label>
            <span style={{ display: 'flex', gap: 8 }}><button className="px-btn gold" onClick={savePanelMember}>{panelDraft.id ? 'Update' : 'Add'}</button><button className="px-btn ghost" onClick={() => setPanelDraft(null)}>Cancel</button></span>
          </div>)}
        {!panelDraft && <div style={{ fontSize: 13, color: PX.sub }}>{panelRows.length ? `${panelRows.filter(r => inView(r, panelView)).length} members on the ${panelView === 'pre' ? 'Pre Mock' : 'Practice'} panel.` : 'Showing the panel from the notice. Press “Load from notice” to start editing it.'}</div>}
      </PremiumCard>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 14 }}>
        {SUBJECTS.map(sub => {
          const members = panelRows.length ? panelRows.filter(r => r.subject_key === sub.key && inView(r, panelView)) : (panelView === 'pre' ? PANEL[sub.key].map(name => ({ name, role: 'setter', subject_key: sub.key, builtin: true })) : [{ name: PRACTICE_PANEL[sub.key].verifier, role: 'verifier', subject_key: sub.key, builtin: true }, ...PRACTICE_PANEL[sub.key].assistants.map(name => ({ name, role: 'assistant', subject_key: sub.key, builtin: true }))])
          return (
            <PremiumCard key={sub.key} title={sub.label} subtitle={`${members.length} member${members.length === 1 ? '' : 's'}`}
              right={panelView === 'practice' ? (
                <span role="group" aria-label={`Questions per test, ${sub.label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Per test</span>
                  {isRealAdmin && <button type="button" className="px-hbtn" aria-label="Five fewer questions per test" onClick={() => setPracticeQ(sub, practiceQOf(sub.key) - 5)} style={{ width: 32, height: 32, padding: 0, fontSize: 17 }}>−</button>}
                  <b aria-live="polite" style={{ minWidth: 30, textAlign: 'center', fontSize: 16, color: PX.navy }}>{practiceQOf(sub.key)}</b>
                  {isRealAdmin && <button type="button" className="px-hbtn" aria-label="Five more questions per test" onClick={() => setPracticeQ(sub, practiceQOf(sub.key) + 5)} style={{ width: 32, height: 32, padding: 0, fontSize: 17 }}>＋</button>}
                </span>) : null}>
              {members.length === 0 && <div style={{ color: PX.sub, fontSize: 13 }}>No one yet.</div>}
              {members.map((m, i) => {
                const pre = tests.filter(r => r.subject === sub.label && settersOfRow(r).includes(m.name)).sort((a, b) => a.test_no - b.test_no)
                const prac = practice.filter(r => subjectOfPractice(r).key === sub.key && settersOfRow(r).includes(m.name))
                const cover = m.role === 'assistant' ? coverOf(sub.label, m.name, practiceQOf(sub.key)) : null
                const mine = [...pre, ...prac]
                const chipTone = r => r.status === 'Pending' ? { bg: '#f1ede3', fg: '#8a6118' } : { bg: '#dcfce7', fg: '#15803d' }
                const taskChips = (label, list, tabKey, name) => list.length > 0 && (
                  <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, paddingLeft: 68 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub, marginRight: 4 }}>{label} · {list.filter(r => r.status !== 'Pending').length}/{list.length} in</span>
                    {list.map(r => { const t = chipTone(r); return <button key={r.id} type="button" title={`${r.status} — open ${fullName(m.name)}'s tasks`} onClick={() => { setPerson(m.name); setTaskView('all'); setTab(tabKey) }} style={{ border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: t.bg, color: t.fg, fontFamily: 'inherit' }}>{tabKey === 'practice' ? 'All tests' : 'PMT-' + String(r.test_no).padStart(2, '0')}</button> })}
                  </div>)
                return (
                  <div key={m.id || m.name + i} style={{ display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap', padding: '8px 0', borderTop: i ? `1px solid ${PX.line}` : 'none' }}>
                    <span role={m.role === 'setter' ? 'button' : undefined} tabIndex={m.role === 'setter' ? 0 : undefined} title={m.role === 'setter' ? `See ${fullName(m.name)}'s tasks` : undefined}
                      onClick={m.role === 'setter' ? () => { setPerson(m.name); setTaskView('all'); setTab('mine') } : undefined}
                      onKeyDown={m.role === 'setter' ? e => { if (e.key === 'Enter') { setPerson(m.name); setTaskView('all'); setTab('mine') } } : undefined}
                      style={{ flex: '1 1 190px', minWidth: 0, cursor: m.role === 'setter' ? 'pointer' : 'default' }}>
                      <PersonCell name={m.name} photoName={photoOf(m.name)} size={56} sub={[m.role === 'setter' ? `${pre.length} tests · ${pre.filter(r => r.status !== 'Pending').length} in` : null, m.role === 'assistant' ? `practice for all ${cover.total} tests · ${practiceQOf(sub.key)} questions per test · ${cover.qs} set so far` : null, m.question_quota != null ? `${mine.filter(r => r.status !== 'Pending').reduce((n, r) => n + (r.question_count || 0), 0)} / ${m.question_quota} questions` : null].filter(Boolean).join(' · ') || null}>{fullName(m.name)}</PersonCell>
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {m.role === 'assistant' && cover && <span title={`${cover.qs} practice questions so far. Every practice teacher sets questions for every test.`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: cover.done === cover.total ? '#0f7a4c' : PX.navy }}><span style={{ width: 70, height: 7, borderRadius: 99, background: '#e3e8f0', overflow: 'hidden' }}><span style={{ display: 'block', width: Math.round((cover.done / cover.total) * 100) + '%', height: '100%', background: cover.done === cover.total ? '#16a34a' : '#1d4f91' }} /></span>{cover.done}/{cover.total} tests</span>}
                      <Pill tone={ROLE_TONE[m.role]} dot={false}>{roleLabel(m.role)}</Pill>
                      {!m.builtin && isRealAdmin && <><button className="px-hbtn" onClick={() => setPanelDraft({ id: m.id, subject_key: m.subject_key, name: m.name, role: m.role, question_quota: m.question_quota ?? '', ...(m.role === 'setter' ? { test_count: pre.length, test_count_was: pre.length } : {}) })} aria-label={`Edit ${m.name}`}>✎</button>
                        <button className="px-hbtn" onClick={() => deletePanelMember(m)} aria-label={`Remove ${m.name}`}>🗑</button></>}
                    </span>
                    {panelView === 'pre' && taskChips('Pre Mock', pre, 'mine', m.name)}
                    {panelView === 'practice' && taskChips('Practice', prac, 'practice', m.name)}
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
    if (!d.file && !d.link_url.trim() && !d.body.trim()) return setMsg('❌ Type the study material first.')
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
        setMsg('✅ Material updated'); loadMats(); setBusy(false); return true
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
      setBusy(false); return true
    } catch (e) { setMsg('❌ ' + (e.message || 'Upload failed')) }
    setBusy(false)
    return false
  }
  const printMaterial = m => {
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    w.document.write(materialDocHtml(m, { institute: institute.name, auto: true }, MATH_CSS + MATERIAL_CSS))
    w.document.close()
  }
  const materialFileUrl = async m => {
    const { data, error } = await supabase.storage.from(MAT_BUCKET).createSignedUrl(m.file_path, 3600)
    if (error) throw error
    return data.signedUrl
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
    if (!(isRealAdmin || isMe(m.uploaded_by))) return setMsg('You can delete only your own material.')
    if (!window.confirm(`Delete “${m.title}”?`)) return
    if (m.file_path) await supabase.storage.from(MAT_BUCKET).remove([m.file_path])
    const { error } = await supabase.from(MAT_TABLE).delete().eq('id', m.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('material_delete', m.title, { by: currentUser?.name }); loadMats()
  }
  const inp = { padding: '9px 10px', borderRadius: 10, border: `1px solid ${PX.line || '#d8dee9'}`, fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const setupNote = marksSetup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261203_mission_sainik_syllabus_marks.sql</b> in Supabase to enable this tab.</div>
  const exportSyllabus = () => downloadCsv('Mission_Sainik_syllabus.csv', [['Test', ...SUBJECTS.map(x => x.label)]].concat(TESTS.map(t => [t.id, ...SUBJECTS.map(x => syl[t.no + '|' + x.label] || '')])))
  // Print the whole syllabus plan on the premium A4 frame (letterhead, logo, footer). It opens as a preview with a Print / Save as PDF button.
  const printSyllabusPlan = () => printPremium(buildPlanBody({ tests: TESTS, subjects: SUBJECTS, syl, fmtDate: fmtShort }),
    { title: 'Mission Sainik syllabus plan', institute, docLabel: 'Mission Sainik syllabus plan', official: true })
  const planDocx = async () => {
    try { downloadDocx('Mission_Sainik_syllabus_plan', await buildPlanDocx({ tests: TESTS, subjects: SUBJECTS, syl, institute, fmtDate: fmtShort })); setMsg('✅ Word file downloaded') }
    catch (e) { setMsg('❌ Could not make the Word file: ' + (e.message || e)) }
  }
  const exportSyllabusLong = () => downloadCsv('Mission_Sainik_syllabus_import_template.csv', [['Test', 'Subject', 'Chapter']].concat(TESTS.flatMap(t => SUBJECTS.map(x => [t.no, x.short, syl[t.no + '|' + x.label] || '']))))
  const runSylImport = async () => {
    if (!isRealAdmin) return setMsg('Only an admin can change the syllabus plan.')
    const { rows: list, errors } = parseSyllabusText(sylImport, SUBJECTS)
    if (errors.length) return setMsg('❌ ' + errors.slice(0, 3).join(' · '))
    if (!list.length) return setMsg('❌ Nothing to import.')
    const { error } = await supabase.from(SYL_TABLE).upsert(list.map(r => ({ ...r, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })), { onConflict: 'test_no,subject' })
    if (error) return setMsg('❌ ' + error.message)
    audit('syllabus_import', null, { rows: list.length }); setSylImport(null); setMsg(`✅ ${list.length} chapter(s) imported`); loadExtra()
  }
  // Draft a full plan: every EMPTY test × subject cell gets the next official AISSEE chapter of that subject (Class 6 list first), cycling through the list.
  const suggestPlan = async () => {
    const fams = x => (subjectFamily(x.label) === 'gk' ? ['gk', 'social'] : [subjectFamily(x.label)])
    const chaptersFor = x => {
      const pick = cls => Object.entries(officialSubjects('sainik', cls)).filter(([n]) => fams(x).includes(subjectFamily(n))).flatMap(([, chs]) => chs)
      return [...new Set(pick(6))]   // Class VI syllabus only
    }
    const rowsNew = []
    SUBJECTS.forEach(x => {
      const base = chaptersFor(x); if (!base.length) return
      const list = x.key === 'vocab' ? [...base].reverse() : base   // Grammar and Vocabulary share the language list; reverse one so a test doesn't repeat the same chapter
      TESTS.forEach((t, i) => { if (!syl[t.no + '|' + x.label]) rowsNew.push({ test_no: t.no, subject: x.label, chapter: list[i % list.length] }) })
    })
    if (!rowsNew.length) return setMsg('Every cell already has a chapter.')
    if (!window.confirm(`Fill ${rowsNew.length} empty cell${rowsNew.length === 1 ? '' : 's'} with suggested chapters from the official syllabus? Chapters you already entered are kept, and you can edit any of them afterwards.`)) return
    const { error } = await supabase.from(SYL_TABLE).upsert(rowsNew.map(r => ({ ...r, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() })), { onConflict: 'test_no,subject' })
    if (error) return setMsg('❌ ' + error.message)
    audit('syllabus_suggest', null, { rows: rowsNew.length }); setMsg(`✅ ${rowsNew.length} chapter(s) suggested — edit any you want to change`); loadExtra()
  }
  // Load the syllabus plan 2026-27 (120 chapters, from the plan document) after showing exactly what will be filled and what will be replaced.
  const loadPlan2026 = async () => {
    const d = diffPlan(syl)
    if (!d.write.length) return setMsg('✅ The syllabus plan 2026-27 is already loaded — all 120 chapters match.')
    const eg = d.change.slice(0, 4).map(c => `  • PMT-${String(c.test_no).padStart(2, '0')} ${c.subject}: “${c.was}” → “${c.chapter}”`).join('\n')
    const ok = window.confirm(`Load the syllabus plan 2026-27?\n\n• ${d.add.length} empty cell${d.add.length === 1 ? '' : 's'} will be filled\n• ${d.change.length} cell${d.change.length === 1 ? '' : 's'} will be REPLACED with the plan's chapter${d.change.length ? '\n' + eg + (d.change.length > 4 ? `\n  …and ${d.change.length - 4} more` : '') : ''}\n• ${d.keep.length} already match\n\nContinue?`)
    if (!ok) return
    const at = new Date().toISOString()
    const { error } = await supabase.from(SYL_TABLE).upsert(d.write.map(r => ({ test_no: r.test_no, subject: r.subject, chapter: r.chapter, updated_by: currentUser?.name || '', updated_at: at })), { onConflict: 'test_no,subject' })
    if (error) return setMsg('❌ ' + error.message)
    audit('syllabus_plan_2026', null, { filled: d.add.length, replaced: d.change.length, kept: d.keep.length })
    setMsg(`✅ Syllabus plan 2026-27 loaded — ${d.add.length} filled, ${d.change.length} replaced, ${d.keep.length} already matched`); loadExtra()
  }
  const syllabusTab = (
    <>{setupNote}
      <PremiumCard title="Syllabus plan" subtitle="Chapter for each section of each test — type or pick a suggested chapter, then press Enter or click away to save. Setters see it on their task." bodyStyle={{ padding: 0, overflowX: 'auto' }}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{isRealAdmin && <button className="px-hbtn" onClick={loadPlan2026} title="Fill the 120 chapters from the Mission Sainik syllabus plan 2026-27 document">📘 Load plan 2026-27</button>}{isRealAdmin && <button className="px-hbtn" onClick={suggestPlan}>✨ Suggest plan</button>}{isRealAdmin && <button className="px-hbtn" onClick={() => setSylImport(sylImport === null ? '' : null)}>⬆ Import</button>}<button className="px-hbtn" onClick={exportSyllabus}>⬇ CSV</button><button className="px-hbtn" onClick={printSyllabusPlan}>🖨 Print</button><button className="px-hbtn" onClick={planDocx}>📝 Word</button></span>}>
        {sylImport !== null && (
          <div style={{ padding: 16, borderBottom: `1px solid ${PX.line}` }}>
            <div style={{ fontSize: 13, color: PX.sub, marginBottom: 6 }}>Paste lines as <b>test, subject, chapter</b> (comma or tab; subject can be Maths, Reasoning, Science, GK, Grammar or Vocab). A spreadsheet paste works. <button className="px-btn ghost" style={{ marginLeft: 6 }} onClick={exportSyllabusLong}>Download template</button></div>
            <textarea className="px-input" rows={6} value={sylImport} onChange={e => setSylImport(e.target.value)} aria-label="Syllabus import" placeholder={'1, Maths, Fractions\n1, Science, Light'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="px-btn gold" onClick={runSylImport}>Import chapters</button><button className="px-btn ghost" onClick={() => setSylImport(null)}>Cancel</button></div>
          </div>)}
        {(() => {
          const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']
          const tone = i => TONES[i % TONES.length]
          const val = (t, x) => syl[t.no + '|' + x.label] || ''
          const total = TESTS.length * SUBJECTS.length
          const filled = TESTS.reduce((n, t) => n + SUBJECTS.filter(x => val(t, x)).length, 0)
          const pctAll = total ? Math.round((filled / total) * 100) : 0
          const q = sylQuery.trim().toLowerCase()
          const visible = TESTS.filter(t => {
            const empty = SUBJECTS.some(x => !val(t, x))
            if (sylOnlyEmpty && !empty) return false
            if (q && !(t.id.toLowerCase().includes(q) || SUBJECTS.some(x => val(t, x).toLowerCase().includes(q)))) return false
            return true
          })
          // Suggestions: official AISSEE chapters (all classes) of the same subject family; unused ones first.
          const used = new Set(TESTS.flatMap(t => SUBJECTS.flatMap(x => splitChapters(val(t, x)).map(c => c.toLowerCase()))))
          const suggest = x => {
            const fam = subjectFamily(x.label)
            const fams = fam === 'gk' ? ['gk', 'social'] : [fam]
            // Mission Sainik prepares Class VI aspirants, so suggest only the Class VI syllabus (Appendix II).
            const list = [...new Set(Object.entries(officialSubjects('sainik', 6)).filter(([n]) => fams.includes(subjectFamily(n))).flatMap(([, chs]) => chs))]
            return [...list.filter(c => !used.has(c.toLowerCase())), ...list.filter(c => used.has(c.toLowerCase()))]
          }
          const copyPrev = t => {
            const prev = TESTS.find(p => p.no === t.no - 1)
            if (!prev) return
            SUBJECTS.forEach(x => { if (!val(t, x) && val(prev, x)) saveChapter(t.no, x.label, val(prev, x)) })
          }
          const chipBtn = on => ({ padding: isMobile ? '9px 14px' : '6px 12px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', color: PX.ink2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
          return (
            <>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PX.line}`, background: 'linear-gradient(180deg,#fff,#fcfbf7)', position: 'sticky', left: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                      <b style={{ color: PX.ink }}>{filled} of {total} chapters planned</b><b style={{ color: pctAll === 100 ? PX.ok : PX.sub }}>{pctAll}%{pctAll === 100 ? ' 🎉' : ''}</b>
                    </div>
                    <div style={{ height: 9, borderRadius: 99, background: '#f1ede3', overflow: 'hidden' }}><div style={{ width: pctAll + '%', height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${PX.gold},${PX.ok})`, transition: 'width .3s' }} /></div>
                  </div>
                  <input className="px-input" style={{ flex: '1 1 180px', maxWidth: isMobile ? 'none' : 260, fontSize: isMobile ? 16 : undefined }} placeholder="🔍 Find test or chapter…" aria-label="Find test or chapter" value={sylQuery} onChange={e => setSylQuery(e.target.value)} />
                  <button type="button" style={chipBtn(sylOnlyEmpty)} onClick={() => setSylOnlyEmpty(v => !v)} aria-pressed={sylOnlyEmpty}>✏️ Only tests with gaps</button>
                  <span className="px-tabs" data-ti-skip role="tablist" aria-label="Layout" style={{ marginBottom: 0 }}>
                    {(isMobile ? [['cards', '🗂️ Cards']] : [['cards', '🗂️ Cards'], ['grid', '▦ Grid']]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sylView === k} className={'px-tab' + (sylView === k ? ' on' : '')} onClick={() => setSylView(k)} style={{ padding: '6px 12px', fontSize: 12.5 }}>{l}</button>)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', marginTop: 10, paddingBottom: isMobile ? 2 : 0 }}>
                  {SUBJECTS.map((x, i) => {
                    const n = TESTS.filter(t => val(t, x)).length
                    return <span key={x.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: '#fff', border: `1px solid ${PX.line}`, fontSize: 11.5, fontWeight: 700, color: PX.ink2, whiteSpace: 'nowrap', flexShrink: 0 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: tone(i) }} />{x.short} {n}/{TESTS.length}</span>
                  })}
                </div>
              </div>
              {SUBJECTS.map(x => <datalist key={x.key} id={'syl-sug-' + x.key}>{suggest(x).map(c => <option key={c} value={c} />)}</datalist>)}
              {visible.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: PX.faint }}>{sylOnlyEmpty && !q ? 'Every test has all its chapters. 🎉' : 'Nothing matches.'}</div>}
              {sylView === 'cards' || isMobile ? (
                <div style={{ padding: isMobile ? 10 : 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: isMobile ? 10 : 12 }}>
                  {visible.map(t => {
                    const n = SUBJECTS.filter(x => val(t, x)).length
                    const done = n === SUBJECTS.length
                    const open = sylOpen[t.no] ?? !(isMobile && done)
                    const prevHas = t.no > 1 && SUBJECTS.some(x => !val(t, x) && syl[(t.no - 1) + '|' + x.label])
                    return (
                      <div key={t.no} style={{ border: `1px solid ${done ? '#bfe3cc' : PX.line}`, borderRadius: 16, background: done ? '#f7fcf9' : '#fff', overflow: 'hidden' }}>
                        <div onClick={isMobile ? () => setSylOpen(o => ({ ...o, [t.no]: !open })) : undefined} role={isMobile ? 'button' : undefined} aria-expanded={isMobile ? open : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '13px 14px' : '11px 14px', borderBottom: open ? `1px solid ${PX.line}` : 'none', cursor: isMobile ? 'pointer' : 'default' }}>
                          <div style={{ flex: 1 }}><div style={{ fontFamily: PX.serif, fontSize: 16, fontWeight: 600, color: PX.navy }}>{t.id}</div><div style={{ fontSize: 11.5, color: PX.sub }}>{fmtShort(t.date)}</div></div>
                          {isRealAdmin && prevHas && open && <button type="button" className="px-btn ghost" style={{ padding: isMobile ? '8px 12px' : '4px 9px', fontSize: isMobile ? 12.5 : 11.5 }} onClick={e => { e.stopPropagation(); copyPrev(t) }} title="Fill empty boxes from the previous test">↧ Copy prev</button>}
                          <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: done ? '#dcfce7' : n ? PX.goldBg : '#f1ede3', color: done ? '#15803d' : '#8a6118' }}>{done ? '✓ Done' : `${n}/${SUBJECTS.length}`}</span>
                          {isMobile && <span aria-hidden="true" style={{ color: PX.sub, fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>}
                        </div>
                        {open && <div style={{ padding: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                          {SUBJECTS.map((x, i) => (
                            <label key={x.key} style={{ display: 'block', borderLeft: `4px solid ${tone(i)}`, borderRadius: 8, background: val(t, x) ? tone(i) + '12' : '#fafafa', padding: isMobile ? '8px 12px 9px' : '5px 8px 6px' }}>
                              <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: tone(i) }}>{x.short}</span>
                              <ChapterMulti readOnly={!isRealAdmin} value={val(t, x)} onSave={v => saveChapter(t.no, x.label, v)} listId={'syl-sug-' + x.key} label={`${t.id} ${x.short} chapter`} placeholder="Add chapter…" fontSize={isMobile ? 16 : 13} minHeight={isMobile ? 40 : undefined} tint={tone(i) + '22'} />
                            </label>
                          ))}
                        </div>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <table className="px-table" style={{ minWidth: 900 }}>
                  <thead><tr><th>Test</th>{SUBJECTS.map(x => <th key={x.key}>{x.short}</th>)}</tr></thead>
                  <tbody>{visible.map(t => (
                    <tr key={t.no}>
                      <td>{t.id}<div style={{ fontWeight: 500, color: PX.sub, fontSize: 11 }}>{fmtShort(t.date)}</div></td>
                      {SUBJECTS.map(x => (
                        <td key={x.key} style={{ padding: '8px 10px' }}>
                          <ChapterMulti readOnly={!isRealAdmin} value={val(t, x)} onSave={v => saveChapter(t.no, x.label, v)} listId={'syl-sug-' + x.key} label={`${t.id} ${x.short} chapter`} placeholder="Chapter" fontSize={12} />
                        </td>
                      ))}
                    </tr>))}
                  </tbody>
                </table>
              )}
            </>
          )
        })()}
      </PremiumCard>
    </>
  )
  // Merit list: ranked by percentage for the test picked in the filter (or all tests together). Premium print preview and Word.
  const merit = () => meritList(marks, MARK_COLS, marksFilter)
  const meritTitle = () => marksFilter ? `Merit list · Daily Class Test ${marksFilter}` : 'Merit list · All Daily Class Tests'
  const printMerit = () => {
    const m = merit(); if (!m.rows.length) return setMsg('No marks to rank yet.')
    const head = `<tr><th>Rank</th><th class="l">Batch / student</th>${MARK_COLS.map(([, l, mx]) => `<th>${esc(l)}<br>/${mx}${marksFilter ? '' : '×n'}</th>`).join('')}<th>Total</th><th>%</th></tr>`
    const body = m.rows.map(r => `<tr${r.rank <= 3 ? ' style="background:#fdf6e3"' : ''}><td><b>${r.rank}</b></td><td class="l">${esc(r.name)}</td>${MARK_COLS.map(([k]) => `<td>${r.parts[k]}</td>`).join('')}<td><b>${r.total}</b>/${r.max}</td><td><b>${r.pct}%</b></td></tr>`).join('')
    printPremium(`<div class="title">${esc(meritTitle())}</div><div class="sub">Mission Sainik 2027 · ${m.rows.length} ranked · ${m.tests} test${m.tests === 1 ? '' : 's'} · ranked by percentage</div><table class="t"><thead>${head}</thead><tbody>${body}</tbody></table><div class="sig"><span>Class teacher</span><span>Exam in-charge</span><span>Principal</span></div>`,
      { title: meritTitle(), institute, docLabel: meritTitle(), official: true })
  }
  const meritDocx = async () => {
    const m = merit(); if (!m.rows.length) return setMsg('No marks to rank yet.')
    try {
      downloadDocx(meritTitle().replace(/[^\w]+/g, '_'), await buildTableDocx({ title: meritTitle(), sub: `Mission Sainik 2027 · ${m.rows.length} ranked · ranked by percentage`, institute, label: meritTitle(), landscape: false,
        columns: [{ h: 'Rank', w: 0.8 }, { h: 'Batch / student', w: 3, left: true }, ...MARK_COLS.map(([, l, mx]) => ({ h: `${l} /${mx}`, w: 1 })), { h: 'Total', w: 1.3 }, { h: '%', w: 0.9 }],
        rows: m.rows.map(r => [r.rank, r.name, ...MARK_COLS.map(([k]) => r.parts[k]), `${r.total}/${r.max}`, r.pct + '%']) }))
    } catch (e) { setMsg('❌ Could not make the Word file: ' + (e.message || e)) }
  }
  const exportMarks = () => downloadCsv('Mission_Sainik_marks.csv', [['Test', 'Batch', ...MARK_COLS.map(([, l, m]) => `${l} /${m}`), 'Total /120']].concat(marks.map(r => ['T' + r.test_no, r.batch || '', ...MARK_COLS.map(([k]) => r[k] ?? ''), MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0)])))
  const runMarksImport = async () => {
    const { rows: list, errors } = parseMarksText(marksImport, MARK_COLS)
    if (errors.length) return setMsg('❌ ' + errors.slice(0, 3).join(' · '))
    if (!list.length) return setMsg('❌ Nothing to import.')
    const { error } = await supabase.from(MARKS_TABLE).upsert(list.map(r => ({ ...r, entered_by: currentUser?.name || '' })), { onConflict: 'test_no,batch' })
    if (error) return setMsg('❌ ' + error.message)
    audit('marks_import', null, { rows: list.length }); setMarksImport(null); setMsg(`✅ ${list.length} row(s) imported`); loadExtra()
  }
  const marksShown = marks.filter(r => !marksFilter || r.test_no === marksFilter)
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
          {!editMarksId && <span style={{ fontSize: 13, color: PX.sub }}>Saving for <b>T{markDraft.test_no}</b> · {markDraft.batch.trim() || 'no batch yet'}</span>}
          {editMarksId && <><span style={{ fontSize: 13, color: PX.sub }}>Editing T{markDraft.test_no} · {markDraft.batch || 'no batch'}</span><button className="px-btn ghost" onClick={() => { setEditMarksId(null); setMarkDraft({ test_no: 1, batch: '', maths: '', reasoning: '', grammar: '', gk: '' }) }}>Cancel</button></>}
        </div>
      </PremiumCard>
      {marksImport !== null && (
        <PremiumCard title="Import marks" subtitle="Lines: test, batch, maths, reasoning, grammar, gk — leave a mark empty to skip it. Same test + batch overwrites.">
          <textarea className="px-input" rows={6} value={marksImport} onChange={e => setMarksImport(e.target.value)} aria-label="Marks import" placeholder={'1, Batch A, 45, 18, 15, 17\n2, Batch A, 38, 12, 14, 16'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="px-btn gold" onClick={runMarksImport}>Import marks</button><button className="px-btn ghost" onClick={() => setMarksImport(null)}>Cancel</button></div>
        </PremiumCard>)}
      <PremiumCard title={`Entries (${marksShown.length}${marksFilter ? ' of ' + marks.length : ''})`} subtitle="Red = below 60% — revisit that chapter" bodyStyle={{ padding: 0, overflowX: 'auto' }}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="px-input" style={{ width: 'auto' }} value={marksFilter} onChange={e => setMarksFilter(Number(e.target.value))} aria-label="Filter by test"><option value={0}>All tests</option>{TESTS.map(t => <option key={t.no} value={t.no}>T{t.no}</option>)}</select>
          <button className="px-hbtn" onClick={() => setMarksImport(marksImport === null ? '' : null)}>⬆ Import</button><button className="px-hbtn" onClick={exportMarks}>⬇ CSV</button><button className="px-hbtn" onClick={printMerit}>🏆 Merit list</button><button className="px-hbtn" onClick={meritDocx}>📝 Word</button>
        </span>}>
        {!marks.length ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>No marks entered yet.</div> : (
          <table className="px-table" style={{ minWidth: 560 }}>
            <thead><tr><th>Test</th><th>Batch</th>{MARK_COLS.map(([k, l, m]) => <th key={k}>{l} /{m}</th>)}<th>Total /120</th><th /></tr></thead>
            <tbody>{marksShown.map(r => {
              const tot = MARK_COLS.reduce((a, [k]) => a + (Number(r[k]) || 0), 0)
              return (
                <tr key={r.id}>
                  <td>T{r.test_no}</td><td>{r.batch ? <PersonCell name={r.batch} size={28} staff={false}>{r.batch}</PersonCell> : '—'}</td>
                  {MARK_COLS.map(([k, , m]) => <td key={k}><ScorePill v={r[k]} max={m} /></td>)}
                  <td><ScorePill v={tot} max={120} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}><button className="px-hbtn" onClick={() => editMarks(r)} aria-label="Edit">✎</button> {isRealAdmin && <button className="px-hbtn" onClick={() => deleteMarks(r)} aria-label="Delete">🗑</button>}</td>
                </tr>)
            })}</tbody>
          </table>
        )}
      </PremiumCard>
    </>
  )
  const materialTab = (
    <MissionSainikMaterial mySubjects={[...new Set(myPanel.map(m => m.subject))]} syllabus={syl} mats={mats} matSetup={matSetup} draft={matDraft} setDraft={setMatDraft} fileKey={fileKey} editMat={editMat} busy={busy}
      onSave={saveMaterial} onCancelEdit={() => { setEditMat(null); setFileKey(k => k + 1); setMatDraft({ title: '', subject: '', test_no: 0, link_url: '', note: '', body: '', file: null }) }}
      onEdit={startEditMat} onDelete={deleteMaterial} onOpen={openMaterial} canManage={m => isRealAdmin || isMe(m.uploaded_by)} getFileUrl={materialFileUrl}
      institute={institute} isMobile={isMobile} subjects={SUBJECTS} tests={TESTS} setMsg={setMsg} staff={staffDir} userName={currentUser?.name || ''} />
  )

  const myOpen = rows.filter(r => (setsIt(r) && r.status === 'Pending') || (isMe(r.verifier) && r.status === 'Submitted'))
  const badges = { mine: myOpen.length || 0 }
  const tabLabel = id => NAV_GROUPS.flatMap(g => g.items).find(i => i[0] === id)?.[2] || 'Mission Sainik'
  const game = computeGame({ rows: rows.map(r => ({ ...r, due: dueFor(r) })), mats, userName: currentUser?.name || '', isMe, today })
  const nextTaskRow = [...myOpen].sort((x, y) => dueFor(x).localeCompare(dueFor(y)))[0]
  const nextTask = nextTaskRow ? {
    row: nextTaskRow, late: isOverdue(nextTaskRow, today),
    title: `${nextTaskRow.kind === 'test' ? 'PMT-' + String(nextTaskRow.test_no).padStart(2, '0') + ' · ' : 'Practice · '}${nextTaskRow.subject}`,
    sub: `${setsIt(nextTaskRow) ? 'Set and submit' : 'Verify'} · due ${fmtShort(dueFor(nextTaskRow))}${isOverdue(nextTaskRow, today) ? ' · overdue' : (() => { const n = dayDiff(today, dueFor(nextTaskRow)); return n === 0 ? ' · today' : n > 0 ? ` · ${n}d left` : '' })()}`,
  } : null
  const homeStats = {
    pct: total ? Math.round((approved / total) * 100) : 0,
    deadlineLabel: daysToDeadline > 0 ? daysToDeadline + ' days to submit' : daysToDeadline === 0 ? 'Submit today' : 'Submission closed',
    examLabel: daysToExam > 0 ? daysToExam + 'd' : daysToExam === 0 ? 'today' : 'held',
    nextTest: nextTest ? nextTest.id.replace('PMT-', '') : 'Done', inLabel: `${submitted}/${total || seedCount}`, approved, overdue,
  }
  // Progress for the mission-flow tracker (Home) and the Back / Next bar.
  const flowProgress = {
    panel: { done: panelRows.length ? SUBJECTS.filter(x => panelSetters(x.key).length).length : 0, total: SUBJECTS.length },
    plan: { done: TESTS.reduce((n, t) => n + SUBJECTS.filter(x => syl[t.no + '|' + x.label]).length, 0), total: TESTS.length * SUBJECTS.length },
    assign: { done: rows.filter(r => r.setter).length, total: rows.length },
    set: { done: approved, total },
    marks: { done: new Set(marks.map(r => r.test_no)).size, total: TESTS.length },
  }
  const upcoming = TESTS.filter(t => t.date >= today).slice(0, 3).map(t => {
    const r = tests.filter(x => x.test_no === t.no); const done = r.filter(x => x.status !== 'Pending').length
    return { id: t.id, date: fmtShort(t.date), day: dayName(t.date), days: dayDiff(today, t.date), done, total: r.length || 6, drafts: fmtShort(t.drafts) }
  })
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
      <MissionSainikShell navGroups={navGroups} active={tab} onChange={setTab} title={tab === 'overview' ? 'Mission Sainik' : tabLabel(tab)} subtitle={tab === 'overview' ? 'GNSI · 2027' : 'Mission Sainik'}
        onBack={tab !== 'overview' ? () => setTab('overview') : undefined} badges={badges} isAdmin={isRealAdmin} msg={msg} confetti={boom}
        actions={[{ label: 'Print notice', icon: '🖨', onClick: printNotice }, { label: 'Refresh', icon: '🔄', onClick: load }]}
        fab={tab === 'overview' || tab === 'mine' ? { icon: '⬆', label: 'Upload questions', onClick: () => setTab('prebuilder') } : null}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading…</div> : (
          <>
            {tab === 'guide' && <MissionSainikGuide onGo={setTab} isMobile={isMobile} isAdmin={isRealAdmin} institute={institute} />}
            {tab === 'overview' && <><MissionSainikHome myPanel={myPanel} upcoming={upcoming} announcement={settings.announcement} name={currentUser?.name} stats={homeStats} game={game} nextTask={nextTask} onGo={setTab} onOpenTask={setSel} quick={quick} isMobile={isMobile} flow={<FlowTracker flow={flowSteps} progress={flowProgress} onGo={setTab} />} />{Overview()}</>}
            {tab === 'schedule' && Schedule()}
            {['prebuilder', 'megabuilder', 'dailybuilder', 'practicebuilder'].includes(tab) && <MissionSainikBuilder key={tab + '-' + bStart.n} startTest={tab === 'practicebuilder' && bStart.section ? bStart.test : undefined} startSection={tab === 'practicebuilder' && bStart.section ? bStart.section : undefined} series={{ prebuilder: 'pre', megabuilder: 'mega', dailybuilder: 'daily', practicebuilder: 'practice' }[tab]} tasks={rows} saveTask={saveTask}
              practiceQ={practiceQMap} syllabus={syl} onSetting={async (key, on) => { if (on) await putSetting(key, 'on'); else await delSetting(key) }} currentUser={currentUser} setMsg={setMsg} isMobile={isMobile} institute={institute} embargo={embargo} audit={audit} today={today} panel={panelForBuilder} locks={settings} onLock={async (key, on) => { if (on) { if (await putSetting(key, 'on')) setMsg('🔒 Paper locked') } else if (await delSetting(key)) setMsg('🔓 Paper unlocked') }} />}
            {tab === 'activity' && Activity()}
            {tab === 'insights' && Insights()}
            {(tab === 'premock' || tab === 'megamock') && <MockTestAnalyzer key={tab} scope={tab === 'premock' ? 'pre' : 'mega'} institute={institute} currentUser={currentUser} canUpload canDelete={isRealAdmin} />}
            {tab === 'mock' && MockSeries()}
            {tab === 'allotment' && Allotment()}
            {tab === 'mine' && Mine()}
            {tab === 'practice' && Practice()}
            {tab === 'syllabus' && (
              <>
                <div data-ti-skip role="tablist" aria-label="Syllabus pages" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {[['plan', '🗓 Plan'], ['official', '📘 Official syllabus 2027'], ['manual', '📖 Manual']].map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={sylPage === k} onClick={() => setSylPage(k)}
                      style={{ padding: '9px 16px', borderRadius: 99, border: `1.5px solid ${sylPage === k ? PX.gold : PX.line}`, background: sylPage === k ? PX.goldBg : '#fff', color: sylPage === k ? PX.navy : PX.sub, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>))}
                </div>
                {sylPage === 'plan' && syllabusTab}
                {sylPage === 'official' && <OfficialSyllabus isMobile={isMobile} institute={institute} />}
                {sylPage === 'manual' && <SyllabusManual />}
              </>)}
            {tab === 'marks' && marksTab}
            {tab === 'material' && materialTab}
            {tab === 'panel' && Panel()}
            {tab === 'students' && <MissionSainikStudents institute={institute} isMobile={isMobile} setMsg={setMsg} />}
            {tab === 'admit' && <MissionSainikAdmit institute={institute} isMobile={isMobile} setMsg={setMsg} today={today} />}
            {tab === 'mockmarks' && <MissionSainikMockMarks currentUser={currentUser} isMobile={isMobile} setMsg={setMsg} today={today} />}
            {tab === 'certs' && <MissionSainikCertificates institute={institute} isMobile={isMobile} setMsg={setMsg} />}
            {tab === 'admin' && isRealAdmin && AdminPanel()}
            <FlowNav flow={flowSteps} tab={tab} onGo={t => { setTab(t); window.scrollTo?.({ top: 0, behavior: 'smooth' }) }} progress={flowProgress} />
          </>
        )}
      </MissionSainikShell>
      {printSet && <SetPrintDialog subject={printSet.subject} setNo={printSet.setNo} instName={institute?.name} staff={staffDir} userName={currentUser?.name || ''} isMobile={isMobile} setMsg={setMsg} onClose={() => setPrintSet(null)} />}
      {paperMaker && <SmartPaperMaker subjects={SUBJECTS} institute={institute} staff={staffDir} userName={currentUser?.name || ''} isMobile={isMobile} isAdmin={isRealAdmin} setMsg={setMsg} onClose={() => setPaperMaker(false)}
        onUseAsNotes={({ title, subject, body }) => { setPaperMaker(false); setEditMat(null); setMatDraft({ title, subject: subject || '', test_no: 0, link_url: '', note: '', body, file: null }); setTab('material') }} />}
      {viewMat && (
        <div className="msx-overlay" onClick={() => setViewMat(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="msx-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: 'min(720px,100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 18, padding: 22 }}>
            <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600, color: PX.navy }}>{viewMat.title}</div>
            <div style={{ fontSize: 12.5, color: PX.sub, margin: '4px 0 12px' }}>{[viewMat.subject || 'All subjects', viewMat.test_no ? 'Test ' + viewMat.test_no : null, viewMat.uploaded_by].filter(Boolean).join(' · ')}</div>
            <style>{MATH_CSS + MATERIAL_CSS}</style><div className="md" dangerouslySetInnerHTML={{ __html: renderMaterial(viewMat.body) }} />
            <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="px-btn gold" onClick={() => printMaterial(viewMat)}>🖨 Print</button>
              <button className="px-btn ghost" onClick={() => setViewMat(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {addTask && (
        <div className="msx-overlay" onClick={() => setAddTask(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="msx-dialog" role="dialog" aria-modal="true" aria-label="Add task" onClick={e => e.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 20, padding: 0 }}>
            {(() => {
              const f = addTask, set = patch => setAddTask({ ...f, ...patch })
              const isTest = f.kind === 'test'
              const subj = SUBJECTS.find(x => x.label === f.subject)
              const setters = subj ? panelSetters(subj.key) : []
              const verifiers = (peopleAll || []).filter(n => n !== f.setter.trim())
              const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']
              const lab = { display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: PX.sub, margin: '16px 0 6px' }
              const chip = (on, tone) => ({ padding: isMobile ? '9px 14px' : '7px 13px', borderRadius: 99, border: `1.5px solid ${on ? tone || PX.gold : PX.line}`, background: on ? (tone ? tone + '18' : PX.goldBg) : '#fff', color: on ? PX.ink : PX.ink2, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
              const qn = f.question_count === '' ? 0 : Number(f.question_count)
              const missing = !f.setter.trim() ? 'Choose a setter to continue' : !f.subject.trim() ? 'Choose a subject' : ''
              return (
                <>
                  <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg,#1b3a6b,#0e2040)', color: '#fff', position: 'relative' }}>
                    <button type="button" aria-label="Close" onClick={() => setAddTask(null)} style={{ position: 'absolute', right: 14, top: 12, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: PX.goldLt }}>New assignment</div>
                    <div style={{ fontFamily: PX.serif, fontSize: 23, fontWeight: 600, marginTop: 2 }}>{isTest ? 'Add a test section' : 'Add a practice set'}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>{isTest ? 'Give a setter one subject section of a Pre Mock test.' : 'Give a setter a practice set of up to 25 questions.'}</div>
                  </div>
                  <div style={{ padding: '4px 24px 8px' }}>
                    <span style={lab}>Type</span>
                    <div data-ti-skip role="tablist" aria-label="Type" style={{ display: 'inline-flex', padding: 3, background: '#f4f1e8', borderRadius: 12, gap: 2 }}>
                      {[['practice', '📝 Practice set'], ['test', '📄 Pre Mock section']].map(([k, l]) => (
                        <button key={k} type="button" role="tab" aria-selected={f.kind === k} onClick={() => set({ kind: k, test_no: 1, question_count: k === 'test' ? 25 : '' })}
                          style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: f.kind === k ? '#fff' : 'transparent', boxShadow: f.kind === k ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: f.kind === k ? PX.ink : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                      ))}
                    </div>
                    {isTest && <><span style={lab}>Test</span><select className="px-input" value={f.test_no} onChange={e => set({ test_no: e.target.value })} style={isMobile ? { fontSize: 16 } : undefined}>{TESTS.map(t => <option key={t.no} value={t.no}>{t.id} · {fmtShort(t.date)}</option>)}</select></>}
                    <span style={lab}>Subject</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {SUBJECTS.map((x, i) => <button key={x.key} type="button" aria-pressed={f.subject === x.label} style={chip(f.subject === x.label, TONES[i % 6])} onClick={() => set({ subject: x.label, setter: '' })}>{x.short}</button>)}
                    </div>
                    <span style={lab}>Setter{subj ? ` · ${subj.short} panel` : ''}</span>
                    {setters.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{setters.map(n => <button key={n} type="button" aria-pressed={f.setter === n} style={chip(f.setter === n)} onClick={() => set({ setter: n, verifier: f.verifier === n ? '' : f.verifier })}>👤 {n}</button>)}</div>}
                    <input className="px-input" list="ms-people" value={f.setter} onChange={e => set({ setter: e.target.value })} placeholder="…or type another name" aria-label="Setter" style={isMobile ? { fontSize: 16 } : undefined} />
                    <span style={lab}>Verifier <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: PX.faint }}>(optional — a different teacher)</span></span>
                    {verifiers.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{verifiers.slice(0, 8).map(n => <button key={n} type="button" aria-pressed={f.verifier === n} style={chip(f.verifier === n)} onClick={() => set({ verifier: f.verifier === n ? '' : n })}>🔍 {n}</button>)}</div>}
                    <input className="px-input" list="ms-people" value={f.verifier} onChange={e => set({ verifier: e.target.value })} placeholder="…or type another name" aria-label="Verifier" style={isMobile ? { fontSize: 16 } : undefined} />
                    <datalist id="ms-people">{peopleAll.map(n => <option key={n} value={n} />)}</datalist>
                    <span style={lab}>Questions</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${PX.line}`, borderRadius: 12, overflow: 'hidden' }}>
                        <button type="button" aria-label="Fewer questions" onClick={() => set({ question_count: Math.max(0, qn - 5) })} style={{ width: 40, height: 40, border: 'none', background: '#faf8f3', fontSize: 18, cursor: 'pointer' }}>−</button>
                        <input type="number" min="0" aria-label="Questions" value={f.question_count} onChange={e => set({ question_count: e.target.value })} style={{ width: 56, height: 40, border: 'none', textAlign: 'center', fontSize: 16, fontWeight: 700, outline: 'none' }} />
                        <button type="button" aria-label="More questions" onClick={() => set({ question_count: qn + 5 })} style={{ width: 40, height: 40, border: 'none', background: '#faf8f3', fontSize: 18, cursor: 'pointer' }}>+</button>
                      </div>
                      {[10, 15, 20, 25].map(n => <button key={n} type="button" aria-pressed={qn === n} style={chip(qn === n)} onClick={() => set({ question_count: n })}>{n}</button>)}
                    </div>
                  </div>
                  <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: `1px solid ${PX.line}`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: missing ? '#b45309' : PX.sub }}>
                      {missing ? '⚠️ ' + missing : <>✓ <b style={{ color: PX.ink }}>{f.setter.trim()}</b> · {subj?.short || f.subject}{isTest ? ` · ${TESTS.find(t => String(t.no) === String(f.test_no))?.id || ''}` : ' practice set'}{qn ? ` · ${qn} Q` : ''}</>}
                    </div>
                    <button className="px-btn ghost" onClick={() => setAddTask(null)}>Cancel</button>
                    <button className="px-btn gold" disabled={busy || !!missing} onClick={createTask}>Add task</button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
      {sel && <TaskDialog key={sel.id} people={peopleAll} onDelete={isRealAdmin ? deleteTask : undefined} deadline={SUBMISSION_DEADLINE} chapter={syl[sel.test_no + '|' + sel.subject]} sel={sel} today={today} isAdmin={isAdmin} allowed={allowedStatuses(sel)} busy={busy} onSave={saveTask} onClose={() => setSel(null)} />}
    </div>
  )
}

export default function MissionSainik(props) {
  return <MissionSainikBoundary><MissionSainikInner {...props} /></MissionSainikBoundary>
}

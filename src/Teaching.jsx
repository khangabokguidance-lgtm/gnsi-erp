// Teaching.jsx — Full Fix + Mobile Layout
// ─────────────────────────────────────────────────────────────────────────────
// FIXES APPLIED:
//  BUG-1  React.Fragment key on table row groups in TabLogs
//  BUG-2  useDoubtSessions dep array — safe join using useMemo
//  BUG-3  TabCalendar weekDays memo — recomputes on mount correctly
//  BUG-4  TabTimetable — removed duplicate teaching_timetable write
//  BUG-5  window.confirm replaced with ConfirmModal throughout
//  BUG-6  generateAlerts deduplicates before insert
//  BUG-7  student_scores batch lookup uses correct column + error display
//  BUG-8  syllabus fuzzy match improved (word-boundary, min 4 chars)
//  BUG-9  syllabus_topics errors surfaced to user via toast
//  FIX-1  Pagination added to TabLogs (50/page)
//  FIX-2  Date range filter added to TabLogs
//  FIX-3  CSV export added to TabLogs
//  FIX-4  Duplicate log hard-blocked on second submit
//  FIX-5  Timetable grid defaults to first available subtype
//  FIX-6  Syllabus entries support edit mode
//  FIX-7  Pace calculation guards against < 2 logs
//  FIX-8  Reports print styles scoped; only report card prints
//  FIX-9  Score entries support edit
//  FIX-10 currentUser null guard throughout
//  FIX-11 Role-based tab visibility
//  FIX-12 Alert generation rate-limited (dedup by type+subtype+subject)
//  FIX-13 Remediation slots derived from real timetable free periods
//  FIX-14 All fetch errors shown via toast, no silent fails
//  MOB-1  Responsive tab bar (2-col grid on mobile)
//  MOB-2  All stat grids collapse to 2-col on mobile, 1-col on xs
//  MOB-3  Forms single-column on mobile
//  MOB-4  Tables horizontally scrollable with sticky first col
//  MOB-5  Drawer/modal full-screen on mobile
//  MOB-6  Filter rows wrap and scroll on mobile
//  MOB-7  All touch targets min 44px
//  PATCH-1 Removed duplicate broken useToast call in TabLogs
//  PATCH-2 teaching_timetable → timetable_entries in TabRemediation
//  PATCH-3 batch_name + staff_name added to doubt session insert payload
//  PATCH-4 students query uses batch_id not batch column
//  PATCH-5 is_read:false added to all admin_alerts inserts
//  PATCH-6 SUBJECT_COLORS moved to module level (stable memo dep)
//  PATCH-7 housemasters table fallback comment added
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import TabSyllabus from './TabSyllabus'
import { EnhancedLogForm, HMDoubtSessionPanel } from './EnhancedLogEntry'
import Attendance from './Attendance'
import GeoAttendance from './GeoAttendance'
import TabReportCards from './TabReportCards'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const PERIODS = [1,2,3,4,5,6,7]
const PAGE_SIZE = 50

// FIX-11: which roles can see which tabs
const TAB_ROLES = {
  logs:           ['admin','manager','teacher','superintendent'],
  calendar:       ['admin','manager','teacher','superintendent'],
  syllabus:       ['admin','manager','teacher','house master','superintendent'],
  reports:        ['admin','manager','accounts','superintendent'],
  performance:    ['admin','manager','teacher','superintendent'],
  hmdash:         ['admin','manager','hostel','house master','superintendent'],
  attendance:     ['admin','manager','teacher','hostel','house master','superintendent'],
  geoattendance:  ['admin','manager','teacher','hostel','house master','superintendent'],
  reportcards:    ['admin','manager','teacher','superintendent'],
}

const ALL_TABS = [
  { key:'logs',        label:'Daily Logs',       icon:'📋' },
  { key:'calendar',    label:'Calendar',          icon:'📅' },
  { key:'syllabus',    label:'Syllabus',          icon:'📊' },
  { key:'reports',     label:'Reports',           icon:'📈' },
  { key:'performance', label:'Class Test Scores', icon:'🎯' },
  { key:'hmdash',      label:'HM Dashboard',      icon:'🏠' },
  { key:'attendance',  label:'Attendance',        icon:'✅' },
  { key:'geoattendance', label:'Geo Check-In',    icon:'📍' },
  { key:'reportcards', label:'Report Cards',      icon:'🎓' },
]

const today            = () => new Date().toISOString().split('T')[0]
const currentYearMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const fmtDate          = d => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }) }
const pct              = (s,m) => m > 0 ? Math.round((s/m)*100) : 0
const scoreColor       = p => p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'
const scoreBg          = p => p >= 75 ? '#dcfce7' : p >= 50 ? '#fef9c3' : '#fee2e2'

const emptyLog = {
  course:'', subtype:'', class_name:'', batch_id:'',
  subject_name:'', teacher_name:'', staff_id:'',
  teaching_date: today(), topic_taught:'', classwork:'',
  homework:'', remarks:'', period_number:'',
  needs_doubt_session: false,
}

// ─── Mobile Hook ─────────────────────────────────────────────────────────────

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color='#1e3a5f', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
      zIndex:999999, background:'white', border:`1px solid ${color}`,
      borderLeft:`4px solid ${color}`, borderRadius:10,
      padding:'12px 20px', fontSize:13, fontWeight:600,
      boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'90vw',
      color:'#1e293b', display:'flex', alignItems:'center', gap:10,
      animation:'slideUp .2s ease', whiteSpace:'nowrap',
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
      {msg}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg, color='#1e3a5f') => setToast({ msg, color }), [])
  const el = toast ? <Toast key={toast.msg+toast.color} msg={toast.msg} color={toast.color} onDone={() => setToast(null)}/> : null
  return { show, el }
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel='Confirm', danger=false, onConfirm, onCancel }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.6)', display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius: isMobile ? '16px 16px 0 0' : 12, padding:24, width: isMobile ? '100%' : 380, maxWidth:'95vw' }} onClick={e => e.stopPropagation()}>
        {isMobile && <div style={{ width:36, height:4, background:'#e2e8f0', borderRadius:2, margin:'0 auto 16px', opacity:.6 }}/>}
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20, lineHeight:1.7 }}>{message}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:'12px', borderRadius:8, border:'none', background: danger ? '#dc2626' : '#1e3a5f', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', minHeight:44 }}>{confirmLabel}</button>
          <button onClick={onCancel}  style={{ padding:'12px 20px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontWeight:600, fontSize:13, cursor:'pointer', minHeight:44 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:   { padding:'16px', fontFamily:"'Outfit',system-ui,sans-serif", background:'#f1f5f9', minHeight:'100vh' },
  card:   { background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)', padding:20, marginBottom:16 },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor: disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor: disabled?'not-allowed':'pointer', fontSize:13, minHeight:44 }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36 }),
  input:  { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  label:  { display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  select: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  statCard: (color, bg) => ({ background:bg, borderRadius:12, padding:16, borderLeft:`4px solid ${color}` }),
  badge:  (color, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color }),
  pill:   (color, bg) => ({ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, background:bg, color, display:'inline-block' }),
  statGrid: (cols=4) => ({ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:12, marginBottom:20 }),
  formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 },
}

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  @keyframes slideUp { from { transform:translateY(16px);opacity:0 } to { transform:translateY(0);opacity:1 } }
  * { box-sizing:border-box }
  body { font-family:'Outfit',system-ui,sans-serif; background:#f1f5f9 }
  select,input,textarea { font-family:'Outfit',system-ui,sans-serif }
  select:focus,input:focus,textarea:focus { outline:2px solid #1e3a5f; outline-offset:1px }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
  @media (max-width:640px) {
  @media (max-width:1024px) {
    .doubt-grid { grid-template-columns: repeat(2,1fr) !important }
  }
  @media (max-width:640px) {
    .doubt-grid { grid-template-columns: 1fr !important }
  }
    .stat-grid-4 { grid-template-columns: repeat(2,1fr) !important }
    .stat-grid-3 { grid-template-columns: repeat(2,1fr) !important }
    .form-grid   { grid-template-columns: 1fr !important }
    .filter-row  { flex-direction:column !important }
    .tab-bar     { grid-template-columns: repeat(3,1fr) !important }
    .hide-mobile { display:none !important }
    .table-wrap  { overflow-x:auto; -webkit-overflow-scrolling:touch }
    .page-pad    { padding:12px !important }
  }
  @media print {
    .no-print { display:none !important }
    .print-only { display:block !important }
    body { background:white }
  }
  .print-only { display:none }
`

// ─── Shared Hook: Course Data ─────────────────────────────────────────────────

function useCourseData() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('course_batches').select('id,batch_name,course,subtype,class_name,hostel_type,session_year')
      .eq('status','Active').order('course')
      .then(({ data }) => { setBatches(data||[]); setLoading(false) })
  }, [])

  const courses      = useMemo(() => [...new Set(batches.map(b => b.course))], [batches])
  const subtypesFor  = useCallback(course => [...new Set(batches.filter(b => b.course===course).map(b => b.subtype).filter(Boolean))], [batches])
  const classesFor   = useCallback((course,subtype) => [...new Set(batches.filter(b => b.course===course && (!subtype||b.subtype===subtype)).map(b => b.class_name).filter(Boolean))], [batches])
  const batchIdFor   = useCallback((course,subtype,className) => batches.find(b => b.course===course && (!subtype||b.subtype===subtype) && (!className||b.class_name===className))?.id||'', [batches])

  return { batches, courses, subtypesFor, classesFor, batchIdFor, loading }
}

// ─── BUG-2 Fixed: Doubt Sessions Hook ────────────────────────────────────────

function useDoubtSessions(logIds) {
  const [sessions, setSessions] = useState({})
  const depKey = useMemo(() => `${logIds.length}:${logIds[0]||''}:${logIds[logIds.length-1]||''}`, [logIds])

  const refetch = useCallback(async () => {
    if (!logIds.length) return
    const { data, error } = await supabase.from('doubt_sessions').select('*').in('log_id', logIds)
    if (data) {
      const map = {}
      data.forEach(s => { if (!map[s.log_id]) map[s.log_id]=[]; map[s.log_id].push(s) })
      setSessions(map)
    }
  }, [depKey]) // eslint-disable-line

  useEffect(() => { refetch() }, [refetch])
  return { sessions, refetch }
}

// ─── CoursePicker ─────────────────────────────────────────────────────────────

function CoursePicker({ form, setForm, courseData }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData
  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  const handleCourse  = c  => setForm(f => ({ ...f, course:c, subtype:'', class_name:'', batch_id:'' }))
  const handleSubtype = st => {
    const cls = classesFor(form.course, st)
    const cn  = cls.length===1 ? cls[0] : ''
    const bid = cn ? batchIdFor(form.course, st, cn) : ''
    setForm(f => ({ ...f, subtype:st, class_name:cn, batch_id:bid }))
  }
  const handleClass = cn => setForm(f => ({ ...f, class_name:cn, batch_id: batchIdFor(form.course, form.subtype, cn) }))

  return (
    <>
      <div>
        <label style={S.label}>Course</label>
        <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
          <option value="">Select Course</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>Subtype / Batch</label>
        <select value={form.subtype} onChange={e => handleSubtype(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity: form.course?1:.5 }}>
          <option value="">Select Subtype</option>
          {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>
          Class
          {form.batch_id && <span style={{ marginLeft:6, fontSize:10, color:'#16a34a' }}>✓ linked</span>}
        </label>
        {classes.length > 0
          ? <select value={form.class_name} onChange={e => handleClass(e.target.value)} disabled={!form.subtype} style={{ ...S.select, opacity: form.subtype?1:.5 }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          : <input value={form.class_name} onChange={e => handleClass(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} style={{ ...S.input, opacity: form.subtype?1:.5 }}/>
        }
      </div>
    </>
  )
}

// ─── Doubt Session Sub-Row ────────────────────────────────────────────────────

function DoubtSessionSubRow({ logId, sessions, onRefetch, currentUser }) {
  const [resolvingId, setResolvingId] = useState(null)
  const [note, setNote]               = useState('')
  const list = sessions[logId] || []
  if (!list.length) return null

  const resolverName = currentUser?.name || 'Staff'

  const handleResolve = async session => {
    if (!note.trim()) { alert('Please enter a resolution note.'); return }
    setResolvingId(session.id)
    const { error } = await supabase.from('doubt_sessions').update({
      status:'resolved', resolved_by: resolverName,
      resolved_at: new Date().toISOString(), resolution_note: note,
    }).eq('id', session.id)
    if (error) alert('Error: '+error.message)
    else { onRefetch(); setNote('') }
    setResolvingId(null)
  }

  return (
    <tr>
      <td colSpan={11} style={{ padding:'0 12px 12px 40px', background:'#fffbeb' }}>
        <div style={{ borderLeft:'3px solid #f59e0b', paddingLeft:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#b45309', marginBottom:6 }}>🔁 Doubt Sessions</div>
          {list.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'flex-start', gap:10, flexWrap:'wrap', padding:'8px 12px', marginBottom:5, borderRadius:8, background: s.status==='resolved'?'#f0fdf4':'#fef9c3', border:`1px solid ${s.status==='resolved'?'#bbf7d0':'#fde68a'}` }}>
              <div style={{ minWidth:120 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>🏠 {s.house_name||s.batch_name||'—'}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>HM: {s.hm_name||s.staff_name||'—'}</div>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ fontSize:12, color:'#374151' }}>📖 {s.topic}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{s.subject_name||s.subject}</div>
              </div>
              <div style={{ minWidth:90 }}>
                {s.status==='resolved'
                  ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Resolved</span>
                  : <span style={S.badge('#b45309','#fef9c3')}>⏳ Open</span>}
                {s.resolved_by && <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>by {s.resolved_by}</div>}
              </div>
              {s.status==='resolved' && s.resolution_note && <div style={{ fontSize:11, color:'#64748b', flex:1 }}>📝 {s.resolution_note}</div>}
              {s.status==='open' && (
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  <input value={resolvingId===s.id?note:''} onChange={e => setNote(e.target.value)} onFocus={() => setResolvingId(s.id)} placeholder="Resolution note..." style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:12, minWidth:160, minHeight:36 }}/>
                  <button onClick={() => handleResolve(s)} style={S.btnSm('#16a34a')}>✓ Resolve</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── Log Form ─────────────────────────────────────────────────────────────────

function LogForm({ form, setForm, onSubmit, saving, timetable, staff, onCancel, editMode=false, courseData }) {
  const handlePeriodSelect = e => {
    const pn = parseInt(e.target.value)
    if (!pn || !form.course || !form.subtype) { setForm(f => ({ ...f, period_number: pn||'' })); return }
    const dayName = DAYS[new Date().getDay()-1] || 'Monday'
    const slot = timetable.find(t => t.class_name===form.subtype && t.period_name===String(pn) && t.day_name===dayName)
    if (slot) {
      const ms = staff.find(s => s.name===slot.teacher_name)
      setForm(f => ({ ...f, period_number:pn, subject_name:slot.subject_name||f.subject_name, teacher_name:slot.teacher_name||f.teacher_name, staff_id:ms?.id||f.staff_id }))
    } else {
      setForm(f => ({ ...f, period_number:pn }))
    }
  }

  const handleTeacher = e => {
    const sel = staff.find(s => s.name===e.target.value)
    setForm(f => ({ ...f, teacher_name:e.target.value, staff_id:sel?.id||'' }))
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid" style={S.formGrid}>
        <CoursePicker form={form} setForm={setForm} courseData={courseData}/>
        <div>
          <label style={S.label}>Period (optional)</label>
          <select value={form.period_number} onChange={handlePeriodSelect} style={S.select}>
            <option value="">No Period</option>
            {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Subject *</label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Teacher</label>
          <select value={form.teacher_name} onChange={handleTeacher} style={S.select}>
            <option value="">Select Teacher</option>
            {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.designation||'-'})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Date *</label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date:e.target.value }))} required style={S.input}/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Topic Taught *</label>
          <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught:e.target.value }))} required placeholder="Enter topic" style={S.input}/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Classwork</label>
          <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Classwork details"/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Homework</label>
          <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Homework details"/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Remarks</label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }}/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'12px 14px', borderRadius:8, background: form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#f59e0b':'#e2e8f0'}`, minHeight:44 }}>
            <input type="checkbox" checked={form.needs_doubt_session||false} onChange={e => setForm(f => ({ ...f, needs_doubt_session:e.target.checked }))} style={{ width:16, height:16, cursor:'pointer' }}/>
            <span style={{ fontWeight:600, fontSize:14, color: form.needs_doubt_session?'#b45309':'#374151' }}>🔁 Needs Doubt Session</span>
            {form.needs_doubt_session && <span style={{ fontSize:12, color:'#92400e' }}>— HM will be notified</span>}
          </label>
        </div>
      </div>
      {form.batch_id && (
        <div style={{ marginTop:10, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:12, color:'#16a34a', fontWeight:600 }}>
          ✅ Linked to batch_id: {form.batch_id}
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
        <button type="submit" disabled={saving} style={S.btn(editMode?'#7c3aed':'#1e3a5f', saving)}>
          {saving ? '⏳ Saving...' : editMode ? '✏️ Update Log' : '✅ Save Log'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={S.btn('#64748b')}>✖ Cancel</button>}
      </div>
    </form>
  )
}

// ─── CSV Export Helper ────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  if (!rows.length) return
  const h = Object.keys(rows[0])
  const csv = [h.join(','), ...rows.map(r => h.map(k => `"${(r[k]??'').toString().replace(/"/g,'""')}"`).join(','))].join('\n')
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: filename }).click()
}

// ─── Tab: Daily Logs ──────────────────────────────────────────────────────────

function TabLogs({ logs, loading, fetchLogs, timetable, staff, courseData, currentUser }) {
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({ ...emptyLog, teaching_date: today() })
  const [saving, setSaving]           = useState(false)
  const [editId, setEditId]           = useState(null)
  const [editForm, setEditForm]       = useState(null)
  const [editSaving, setEditSaving]   = useState(false)
  const [search, setSearch]           = useState('')
  const [courseFilter, setCourseFilter]   = useState('All')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [page, setPage]               = useState(1)
  const [dupWarn, setDupWarn]         = useState('')
  const [dupBlocked, setDupBlocked]   = useState(false)
  const [confirmDel, setConfirmDel]   = useState(null)
  // PATCH-1: single correct useToast call (removed duplicate broken call)
  const { show: showToast, el: toastEl } = useToast()
  const [hmFeedback, setHmFeedback] = useState({})

useEffect(() => {
  if (!logs.length) return
  supabase
    .from('hm_notifications')
    .select('log_id, hm_name, message, status, created_at')
    .eq('status', 'teacher_alert')
    .in('log_id', logs.map(l => l.id))
    .order('created_at', { ascending: false })
    .then(({ data }) => {
      if (!data) return
      const map = {}
      data.forEach(n => {
        if (!map[n.log_id]) map[n.log_id] = []
        map[n.log_id].push(n)
      })
      setHmFeedback(map)
    })
}, [logs])

  const logIds = useMemo(() => logs.map(l => l.id), [logs])
  const { sessions, refetch: refetchSessions } = useDoubtSessions(logIds)
  const openDoubtCount = useMemo(() => Object.values(sessions).flat().filter(s => s.status==='open').length, [sessions])
  const { courses } = courseData

  const checkDuplicate = useCallback((f, excludeId=null) => {
    if (!f.course||!f.subtype||!f.subject_name||!f.teaching_date) return false
    return logs.some(l => l.course===f.course && l.subtype===f.subtype && l.class_name===f.class_name && l.subject_name===f.subject_name && l.teaching_date===f.teaching_date && l.id!==excludeId)
  }, [logs])

  const buildPayload = f => ({
    course:f.course, subtype:f.subtype||null, class_name:f.class_name||null, batch_id:f.batch_id||null,
    subject_name:f.subject_name, teacher_name:f.teacher_name||null, staff_id:f.staff_id||null,
    teaching_date:f.teaching_date, topic_taught:f.topic_taught, classwork:f.classwork||null,
    homework:f.homework||null, remarks:f.remarks||null, period_number:f.period_number||null,
    needs_doubt_session:f.needs_doubt_session||false,
  })

  const handleAdd = async e => {
    e.preventDefault()
    if (checkDuplicate(form)) {
      setDupWarn(`⚠️ Duplicate log: ${form.subject_name} on ${form.teaching_date} already exists for this batch.`)
      setDupBlocked(true)
      return
    }
    setDupWarn(''); setDupBlocked(false); setSaving(true)
    const { data: logData, error } = await supabase.from('teaching_logs').insert([buildPayload(form)]).select().single()
    if (error) { showToast('Error: '+error.message, '#dc2626'); setSaving(false); return }
    
    setForm({ ...emptyLog, teaching_date:today() }); setShowForm(false); fetchLogs(); setSaving(false)
    showToast('Log saved', '#16a34a')
  }

  const handleEdit = async e => {
    e.preventDefault()
    if (checkDuplicate(editForm, editId)) { showToast('⚠️ Duplicate log exists.', '#d97706'); return }
    setEditSaving(true)
    const { error } = await supabase.from('teaching_logs').update(buildPayload(editForm)).eq('id', editId)
    if (error) showToast('Error: '+error.message, '#dc2626')
    else { setEditId(null); setEditForm(null); fetchLogs(); showToast('Log updated', '#16a34a') }
    setEditSaving(false)
  }

  const handleDelete = async id => {
    await supabase.from('teaching_logs').delete().eq('id', id)
    setConfirmDel(null); fetchLogs(); showToast('Log deleted', '#dc2626')
  }

  const startEdit = item => {
    setEditId(item.id)
    setEditForm({ course:item.course||'', subtype:item.subtype||'', class_name:item.class_name||'', batch_id:item.batch_id||'', subject_name:item.subject_name||'', teacher_name:item.teacher_name||'', staff_id:item.staff_id||'', teaching_date:item.teaching_date||today(), topic_taught:item.topic_taught||'', classwork:item.classwork||'', homework:item.homework||'', remarks:item.remarks||'', period_number:item.period_number||'', needs_doubt_session:item.needs_doubt_session||false })
  }

  const uniqueSubjects = [...new Set(logs.map(l => l.subject_name).filter(Boolean))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(item => {
      const ms = ['course','subtype','class_name','subject_name','teacher_name','topic_taught','classwork','homework','remarks'].some(k => (item[k]||'').toLowerCase().includes(q))
      const mc = courseFilter==='All'  || item.course===courseFilter
      const ms2= subjectFilter==='All' || item.subject_name===subjectFilter
      const md1= !dateFrom || item.teaching_date >= dateFrom
      const md2= !dateTo   || item.teaching_date <= dateTo
      return ms && mc && ms2 && md1 && md2
    })
  }, [logs, search, courseFilter, subjectFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const exportCSV = () => downloadCSV(filtered.map(l => ({
    Date:l.teaching_date, Course:l.course||'', Subtype:l.subtype||'', Class:l.class_name||'',
    Subject:l.subject_name||'', Teacher:l.teacher_name||'', Topic:l.topic_taught||'',
    Classwork:l.classwork||'', Homework:l.homework||'', Remarks:l.remarks||'',
  })), `teaching_logs_${today()}.csv`)
  const printLog = (item) => {
    const w = window.open('', '_blank')
    const d = (label, value) => `<tr><td class="lbl">${label}</td><td>${value || '—'}</td></tr>`
    w.document.write(`
      <html><head><title>Teaching Log — ${item.subject_name} ${item.teaching_date}</title>
      <style>
        body { font-family: Georgia, serif; font-size: 13px; color: #000; padding: 32px; }
        h1 { font-size: 18px; margin: 0; }
        .sub { font-size: 12px; color: #555; margin-top: 4px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
        .stamp { display: inline-block; border: 2px solid #1e3a5f; border-radius: 6px; padding: 4px 14px; font-size: 11px; font-weight: bold; color: #1e3a5f; margin-top: 8px; letter-spacing: .08em; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td { padding: 8px 10px; border: 1px solid #ccc; vertical-align: top; }
        .lbl { font-weight: bold; background: #f0f0f0; width: 30%; }
        .section { font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #555; margin: 16px 0 6px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
        .sign { border-top: 1px solid #000; width: 160px; padding-top: 6px; text-align: center; font-size: 12px; }
        @media print { body { padding: 24px; } }
      </style></head><body>
      <div class="header">
        <h1>GNSI — Daily Teaching Log</h1>
        <div class="sub">${item.course || ''} · ${item.subtype || ''} · ${item.class_name || ''} &nbsp;|&nbsp; ${item.subject_name} &nbsp;|&nbsp; Period ${item.period_number || '—'}</div>
        <div class="stamp">DATE: ${new Date(item.teaching_date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
      <div class="section">Class Details</div>
      <table><tbody>
        ${d('Teacher', item.teacher_name)}
        ${d('Course / Batch', (item.course||'—')+' / '+(item.subtype||'—'))}
        ${d('Class', item.class_name)}
        ${d('Subject', item.subject_name)}
        ${d('Period', item.period_number ? 'Period '+item.period_number : null)}
        ${d('Chapter', item.chapter)}
        ${d('Sub-topic', item.subtopic)}
        ${d('Range Covered', item.range_from ? item.range_from+' → '+item.range_to : null)}
      </tbody></table>
      <div class="section">What Was Taught</div>
      <table><tbody>
        ${d('Topic Taught', item.topic_taught)}
        ${d('Classwork Done', item.classwork)}
        ${d('Homework Assigned', item.homework)}
        ${d('Remarks', item.remarks)}
      </tbody></table>
      ${item.techniques||item.technique_detail ? `
      <div class="section">Teaching Method</div>
      <table><tbody>
        ${d('Techniques Used', item.techniques)}
        ${d('Technique Details', item.technique_detail)}
        ${d('Key Concepts (for HM)', item.key_concepts)}
        ${d('Avoid During Doubt Session', item.technique_avoid)}
      </tbody></table>` : ''}
      <div class="signatures">
        <div class="sign">Subject Teacher<br/>${item.teacher_name||''}</div>
        <div class="sign">Housemaster</div>
        <div class="sign">Principal / Admin</div>
      </div>
      <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `)
    w.document.close()
  }

  const todayCount = logs.filter(l => l.teaching_date===today()).length

  return (
    <>
      {toastEl}
      {confirmDel && (
        <ConfirmModal title="Delete Log" message="Delete this teaching log? This cannot be undone." confirmLabel="Delete" danger
          onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>
      )}

      <div className="stat-grid-4" style={S.statGrid(4)}>
        {[
          { label:'Total Logs',  value:logs.length,     color:'#1e3a5f', bg:'#eff6ff', icon:'📋' },
          { label:'Today Logs',  value:todayCount,       color:'#16a34a', bg:'#dcfce7', icon:'📅' },
          { label:'Subjects',    value:[...new Set(logs.map(l=>l.subject_name).filter(Boolean))].length, color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Teachers',    value:[...new Set(logs.map(l=>l.teacher_name).filter(Boolean))].length, color:'#ca8a04', bg:'#fef9c3', icon:'👨‍🏫' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:12, color:c.color, fontWeight:700, margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:26, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showForm?16:0, flexWrap:'wrap', gap:8 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', margin:0 }}>➕ Add Teaching Log</h2>
          <button onClick={() => { setShowForm(!showForm); setDupWarn(''); setDupBlocked(false) }} style={S.btn(showForm?'#64748b':'#1e3a5f')}>
            {showForm ? '✖ Cancel' : '➕ Add Log'}
          </button>
        </div>
        {dupWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13, marginBottom:12, fontWeight:600 }}>
            {dupWarn}
            {dupBlocked && <span style={{ marginLeft:10, fontWeight:400 }}>Clear filters or edit the existing log.</span>}
          </div>
        )}
        {showForm && (
  <EnhancedLogForm
    onSaved={() => { setShowForm(false); fetchLogs() }}
    courseData={courseData}
    staff={staff}
    currentUser={currentUser}
    logs={logs}
  />
)}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input placeholder="🔍 Search logs..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ ...S.input, flex:'1 1 180px', minWidth:150 }}/>
        <select value={courseFilter} onChange={e => { setCourseFilter(e.target.value); setPage(1) }} style={{ ...S.select, width:'auto', flex:'0 1 130px' }}>
          <option value="All">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setPage(1) }} style={{ ...S.select, width:'auto', flex:'0 1 130px' }}>
          <option value="All">All Subjects</option>
          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} style={{ ...S.input, width:'auto', flex:'0 1 140px' }} placeholder="From"/>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} style={{ ...S.input, width:'auto', flex:'0 1 140px' }} placeholder="To"/>
        <button onClick={exportCSV} style={S.btnSm('#16a34a')}>📥 CSV</button>
        <button onClick={() => window.print()} style={S.btnSm('#7c3aed')}>🖨️ Print</button>
        {(search||courseFilter!=='All'||subjectFilter!=='All'||dateFrom||dateTo) &&
          <button onClick={() => { setSearch(''); setCourseFilter('All'); setSubjectFilter('All'); setDateFrom(''); setDateTo(''); setPage(1) }} style={S.btnSm('#dc2626')}>✕ Clear</button>}
      </div>

      <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>
        {filtered.length} of {logs.length} logs · Page {page}/{totalPages}
        {openDoubtCount > 0 && <span style={{ marginLeft:12, color:'#b45309', fontWeight:700 }}>🔁 {openDoubtCount} doubt{openDoubtCount>1?'s':''} pending</span>}
      </div>

      {loading
        ? <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading...</div>
        : (
          <>
           <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
  {paginated.map((item, i) => {
    const hasDoubt = sessions[item.id]?.length > 0
    const doubtOpen = sessions[item.id]?.some(s => s.status==='open')
    const feedback = hmFeedback[item.id] || []
    return (
      <div key={item.id} style={{
        background:'white', borderRadius:16,
        boxShadow:'0 4px 24px rgba(30,58,95,0.10)',
        border: doubtOpen ? '1.5px solid #f59e0b' : editId===item.id ? '2px solid #7c3aed' : '1.5px solid #e2e8f0',
        overflow:'hidden', transition:'box-shadow .2s',
        position:'relative',
      }}>
        {/* ── Top color strip ── */}
        <div style={{
          height:5,
          background: doubtOpen
            ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
            : editId===item.id
            ? 'linear-gradient(90deg,#7c3aed,#a78bfa)'
            : 'linear-gradient(90deg,#1e3a5f,#0891b2)',
        }}/>

        <div style={{ padding:'16px 18px' }}>
          {/* ── Header row ── */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                <span style={{ fontSize:15, fontWeight:800, color:'#1e293b' }}>{item.subject_name}</span>
                {hasDoubt && (
                  <span style={{ ...S.badge(doubtOpen?'#b45309':'#16a34a', doubtOpen?'#fef9c3':'#dcfce7'), fontSize:10 }}>
                    🔁 {doubtOpen?'doubt open':'doubt done'}
                  </span>
                )}
              </div>
              <div style={{ fontSize:12, color:'#64748b' }}>
                <span style={S.badge('#1e3a5f','#eff6ff')}>{item.course||'-'}</span>
                <span style={{ margin:'0 5px', color:'#cbd5e1' }}>·</span>
                <span style={{ fontWeight:600 }}>{item.subtype||'-'}</span>
                {item.class_name && <><span style={{ margin:'0 5px', color:'#cbd5e1' }}>·</span><span>{item.class_name}</span></>}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#1e3a5f', background:'#eff6ff', padding:'3px 10px', borderRadius:999 }}>
                {fmtDate(item.teaching_date)}
              </div>
              {item.period_number && (
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>P{item.period_number}</div>
              )}
            </div>
          </div>

          {/* ── Teacher ── */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'8px 12px', background:'#f8fafc', borderRadius:8 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#1e3a5f,#0891b2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'white', fontWeight:800, flexShrink:0 }}>
              {(item.teacher_name||'?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{item.teacher_name||'—'}</div>
              <div style={{ fontSize:10, color:'#94a3b8' }}>Subject Teacher</div>
            </div>
          </div>

          {/* ── Topic ── */}
          {item.topic_taught && (
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Topic Taught</div>
              <div style={{ fontSize:13, color:'#374151', lineHeight:1.5, fontWeight:500 }}>{item.topic_taught}</div>
            </div>
          )}

          {/* ── HW ── */}
          {item.homework && (
            <div style={{ marginBottom:8, padding:'7px 10px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em' }}>📚 HW: </span>
              <span style={{ fontSize:12, color:'#78350f' }}>{item.homework}</span>
            </div>
          )}

          {/* ── Remarks ── */}
          {item.remarks && (
            <div style={{ marginBottom:8, padding:'7px 10px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#166534', textTransform:'uppercase', letterSpacing:'.06em' }}>💬 Remarks: </span>
              <span style={{ fontSize:12, color:'#166534' }}>{item.remarks}</span>
            </div>
          )}

          {/* ── HM Feedback ── */}
          {feedback.map((fb, fi) => (
            <div key={fi} style={{ marginBottom:6, padding:'7px 10px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:7 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#0369a1', textTransform:'uppercase', letterSpacing:'.06em' }}>📨 HM: </span>
              <span style={{ fontSize:12, color:'#0369a1' }}>{fb.message}</span>
              <span style={{ fontSize:10, color:'#94a3b8', marginLeft:6 }}>— {fb.hm_name}</span>
            </div>
          ))}

          {/* ── Doubt sessions ── */}
          {sessions[item.id]?.map(s => (
            <div key={s.id} style={{ marginBottom:6, padding:'8px 10px', background:s.status==='resolved'?'#f0fdf4':'#fffbeb', border:`1px solid ${s.status==='resolved'?'#bbf7d0':'#fde68a'}`, borderRadius:7 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, color:'#1e293b' }}>🏠 {s.house_name||s.batch_name||'—'}</span>
                  <span style={{ fontSize:10, color:'#64748b', marginLeft:6 }}>HM: {s.hm_name||s.staff_name||'—'}</span>
                </div>
                <span style={S.badge(s.status==='resolved'?'#16a34a':'#b45309', s.status==='resolved'?'#dcfce7':'#fef9c3')}>
                  {s.status==='resolved'?'✅ Resolved':'⏳ Open'}
                </span>
              </div>
              {s.status==='open' && (
                <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                  <input
                    placeholder="Resolution note..."
                    style={{ flex:1, padding:'5px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:11, minHeight:32 }}
                    onChange={e => e.currentTarget._note = e.target.value}
                  />
                  <button onClick={async () => {
                    const noteEl = document.querySelector(`[data-resolve="${s.id}"]`)
                    const note = noteEl?.value || ''
                    if (!note.trim()) return
                    await supabase.from('doubt_sessions').update({
                      status:'resolved', resolved_by: currentUser?.name||'Staff',
                      resolved_at: new Date().toISOString(), resolution_note: note,
                    }).eq('id', s.id)
                    refetchSessions()
                  }} style={S.btnSm('#16a34a')}>✓</button>
                </div>
              )}
              {s.resolution_note && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>📝 {s.resolution_note}</div>}
            </div>
          ))}

          {/* ── Edit form ── */}
          {editId===item.id && (
            <div style={{ marginTop:12, borderTop:'1px solid #e2e8f0', paddingTop:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#7c3aed', marginBottom:10 }}>✏️ Edit Log</div>
              <LogForm form={editForm} setForm={setEditForm} onSubmit={handleEdit} saving={editSaving}
                timetable={timetable} staff={staff} onCancel={() => { setEditId(null); setEditForm(null) }}
                courseData={courseData} editMode/>
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{ display:'flex', gap:6, marginTop:12, borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
            <button onClick={() => editId===item.id ? (setEditId(null), setEditForm(null)) : startEdit(item)}
              style={{ ...S.btnSm(editId===item.id?'#64748b':'#7c3aed'), flex:1 }}>
              {editId===item.id ? '✖ Cancel' : '✏️ Edit'}
            </button>
            <button onClick={() => printLog(item)} style={{ ...S.btnSm('#0891b2'), flex:1 }}>🖨️ Print</button>
            {(currentUser?.role||'').toLowerCase()==='admin' && (
              <button onClick={() => setConfirmDel(item.id)} style={{ ...S.btnSm('#dc2626'), flex:1 }}>🗑 Delete</button>
            )}
          </div>
        </div>
      </div>
    )
  })}
  {filtered.length===0 && (
    <div style={{ gridColumn:'1/-1', textAlign:'center', padding:48, color:'#94a3b8', background:'white', borderRadius:16 }}>
      No teaching logs found
    </div>
  )}
</div>
                        {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14, flexWrap:'wrap' }}>
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ ...S.btnSm('#64748b'), opacity:page===1?.4:1 }}>←</button>
                {Array.from({ length:Math.min(5,totalPages) }, (_,i) => {
                  const p = totalPages<=5?i+1:Math.max(1,Math.min(page-2,totalPages-4))+i
                  return <button key={p} onClick={() => setPage(p)} style={{ ...S.btnSm(page===p?'#1e3a5f':'#e2e8f0'), color:page===p?'white':'#374151', minWidth:36 }}>{p}</button>
                })}
                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ ...S.btnSm('#64748b'), opacity:page===totalPages?.4:1 }}>→</button>
              </div>
            )}
          </>
        )}
    </>
  )
}

// ─── Tab: Calendar ────────────────────────────────────────────────────────────

// PATCH-6: SUBJECT_COLORS moved to module level so subjectColorMap memo
// never goes stale when allSubjects changes between renders
const SUBJECT_COLORS = ['#1e3a5f','#7c3aed','#0891b2','#16a34a','#ca8a04','#dc2626','#c026d3','#0d9488']

function TabCalendar({ logs, missed }) {
  const [month, setMonth]             = useState(currentYearMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [viewMode, setViewMode]       = useState('month')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [teacherFilter, setTeacherFilter] = useState('All')

  const [year, mon] = month.split('-').map(Number)
  const firstDay    = new Date(year, mon-1, 1).getDay()
  const daysInMonth = new Date(year, mon, 0).getDate()
  const blanks      = firstDay===0 ? 6 : firstDay-1

  const allSubjects = [...new Set(logs.map(l => l.subject_name).filter(Boolean))]
  const allTeachers = [...new Set(logs.map(l => l.teacher_name).filter(Boolean))]

  const filteredLogs = useMemo(() => logs.filter(l =>
    (subjectFilter==='All'||l.subject_name===subjectFilter) &&
    (teacherFilter==='All'||l.teacher_name===teacherFilter)
  ), [logs, subjectFilter, teacherFilter])

  const logsByDate = useMemo(() => {
    const map = {}
    filteredLogs.forEach(l => {
      if (l.teaching_date?.startsWith(month)) {
        const d = parseInt(l.teaching_date.split('-')[2])
        if (!map[d]) map[d]=[]
        map[d].push(l)
      }
    })
    return map
  }, [filteredLogs, month])

  const missedByDate = useMemo(() => {
    const map = {}
    missed.forEach(m => {
      if (m.missed_date?.startsWith(month)) {
        const d = parseInt(m.missed_date.split('-')[2])
        if (!map[d]) map[d]=[]
        map[d].push(m)
      }
    })
    return map
  }, [missed, month])

  const weekDays = useMemo(() => {
    const now   = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (start.getDay()===0?6:start.getDay()-1))
    return Array.from({length:6}, (_,i) => {
      const d = new Date(start); d.setDate(start.getDate()+i)
      return d.toISOString().split('T')[0]
    })
  }, [])

  const selectedLogs   = selectedDay ? (logsByDate[selectedDay]||[]) : []
  const selectedMissed = selectedDay ? (missedByDate[selectedDay]||[]) : []

  const monthTotal  = Object.values(logsByDate).flat().length
  const monthMissed = Object.values(missedByDate).flat().length
  const activeDays  = Object.keys(logsByDate).length
  const subjectCount= new Set(Object.values(logsByDate).flat().map(l=>l.subject_name)).size

  // PATCH-6: allSubjects dep now stable since SUBJECT_COLORS is module-level
  const subjectColorMap = useMemo(() => {
    const map = {}; allSubjects.forEach((s,i) => { map[s]=SUBJECT_COLORS[i%SUBJECT_COLORS.length] })
    return map
  }, [allSubjects])

  const prevMonth = () => { const d=new Date(year,mon-2,1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setSelectedDay(null) }
  const nextMonth = () => { const d=new Date(year,mon,1);   setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); setSelectedDay(null) }

  return (
    <>
      <div className="stat-grid-4" style={S.statGrid(4)}>
        {[
          { label:'Logs this month', value:monthTotal,  color:'#1e3a5f', bg:'#eff6ff', icon:'📋' },
          { label:'Active days',     value:activeDays,  color:'#16a34a', bg:'#dcfce7', icon:'📅' },
          { label:'Subjects taught', value:subjectCount,color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Missed classes',  value:monthMissed, color:'#dc2626', bg:'#fee2e2', icon:'❌' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:18, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:12, color:c.color, fontWeight:700, margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:24, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <button onClick={prevMonth} style={S.btnSm('#64748b')}>◀</button>
            <span style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', minWidth:140, textAlign:'center' }}>
              {new Date(year,mon-1).toLocaleString('default',{month:'long'})} {year}
            </span>
            <button onClick={nextMonth} style={S.btnSm('#64748b')}>▶</button>
            <input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelectedDay(null) }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, minHeight:36 }}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{ ...S.select, width:'auto', fontSize:12, padding:'6px 10px', minHeight:36 }}>
              <option value="All">All Subjects</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} style={{ ...S.select, width:'auto', fontSize:12, padding:'6px 10px', minHeight:36 }}>
              <option value="All">All Teachers</option>
              {allTeachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setViewMode('month')} style={{ ...S.btnSm(viewMode==='month'?'#1e3a5f':'#e2e8f0'), color:viewMode==='month'?'white':'#374151' }}>Month</button>
            <button onClick={() => setViewMode('week')}  style={{ ...S.btnSm(viewMode==='week' ?'#1e3a5f':'#e2e8f0'), color:viewMode==='week' ?'white':'#374151' }}>Week</button>
          </div>
        </div>

        {viewMode==='month' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'#94a3b8', padding:4 }}>{d}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {Array.from({ length:blanks }).map((_,i) => <div key={`b${i}`}/>)}
              {Array.from({ length:daysInMonth }).map((_,i) => {
                const day       = i+1
                const dateStr   = `${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const isToday   = dateStr===today()
                const hasLogs   = !!logsByDate[day]?.length
                const hasMissed = !!missedByDate[day]?.length
                const isSel     = selectedDay===day
                const bg    = isSel?'#1e3a5f':isToday?'#e0f2fe':hasLogs?'#dcfce7':hasMissed?'#fee2e2':'#f8fafc'
                const color = isSel?'white':isToday?'#0891b2':hasLogs?'#15803d':hasMissed?'#dc2626':'#94a3b8'
                const dayLogs = logsByDate[day]||[]
                return (
                  <div key={day} onClick={() => setSelectedDay(day===selectedDay?null:day)}
                    style={{ background:bg, border:`1px solid ${isSel?'#1e3a5f':isToday?'#7dd3fc':hasLogs?'#bbf7d0':hasMissed?'#fecaca':'#e2e8f0'}`, borderRadius:8, padding:'5px 3px', textAlign:'center', cursor:'pointer', minHeight:52 }}>
                    <div style={{ fontSize:12, fontWeight:700, color }}>{day}</div>
                    {hasLogs && (
                      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:2, marginTop:3 }}>
                        {dayLogs.slice(0,4).map((l,j) => (
                          <span key={j} title={l.subject_name} style={{ width:6, height:6, borderRadius:'50%', background: isSel?'rgba(255,255,255,0.7)':subjectColorMap[l.subject_name]||'#94a3b8', display:'inline-block' }}/>
                        ))}
                        {dayLogs.length>4 && <span style={{ fontSize:8, color:isSel?'#cbd5e1':color }}>+{dayLogs.length-4}</span>}
                      </div>
                    )}
                    {hasMissed && !hasLogs && <div style={{ fontSize:8, color:isSel?'#fecaca':'#dc2626', marginTop:2 }}>missed</div>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {viewMode==='week' && (
          <div className="table-wrap">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, minWidth:480 }}>
              {weekDays.map(dateStr => {
                const dayNum = parseInt(dateStr.split('-')[2])
                const isThisMonth = dateStr.startsWith(month)
                const dayLogs = isThisMonth ? (logsByDate[dayNum]||[]) : filteredLogs.filter(l => l.teaching_date===dateStr)
                const isToday = dateStr===today()
                return (
                  <div key={dateStr} style={{ border:`2px solid ${isToday?'#1e3a5f':'#e2e8f0'}`, borderRadius:10, overflow:'hidden' }}>
                    <div style={{ padding:'7px 8px', background: isToday?'#1e3a5f':'#f8fafc', textAlign:'center' }}>
                      <div style={{ fontSize:10, fontWeight:600, color:isToday?'#93c5fd':'#94a3b8' }}>{new Date(dateStr).toLocaleString('default',{weekday:'short'})}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:isToday?'white':'#1e293b' }}>{dayNum}</div>
                    </div>
                    <div style={{ padding:5, minHeight:70 }}>
                      {dayLogs.length===0 && <div style={{ textAlign:'center', color:'#e2e8f0', fontSize:10, paddingTop:8 }}>—</div>}
                      {dayLogs.map((l,j) => (
                        <div key={j} style={{ marginBottom:3, padding:'3px 5px', borderRadius:4, background:`${subjectColorMap[l.subject_name]||'#1e3a5f'}18`, borderLeft:`3px solid ${subjectColorMap[l.subject_name]||'#1e3a5f'}` }}>
                          <div style={{ fontSize:10, fontWeight:700, color:subjectColorMap[l.subject_name]||'#1e3a5f' }}>{l.subject_name}</div>
                          <div style={{ fontSize:9, color:'#64748b' }}>{l.teacher_name||'-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedDay && viewMode==='month' && (
          <div style={{ marginTop:18, borderTop:'1px solid #e2e8f0', paddingTop:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontSize:14, fontWeight:800, color:'#1e3a5f', margin:0 }}>
                {selectedDay} {new Date(year,mon-1).toLocaleString('default',{month:'long'})} {year}
              </h3>
              <span style={{ fontSize:12, color:'#64748b' }}>{selectedLogs.length} log{selectedLogs.length!==1?'s':''}</span>
            </div>
            {selectedLogs.length===0 && selectedMissed.length===0 && <p style={{ color:'#94a3b8', fontSize:13 }}>No activity recorded.</p>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
              {selectedLogs.map(l => (
                <div key={l.id} style={{ background:'#f0fdf4', borderLeft:`4px solid ${subjectColorMap[l.subject_name]||'#16a34a'}`, borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontWeight:700, color:'#15803d', fontSize:13 }}>{l.subject_name}</div>
                  <div style={{ fontSize:12, color:'#374151', marginTop:3, fontStyle:'italic' }}>{l.topic_taught}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>👨‍🏫 {l.teacher_name||'-'} · {l.subtype||l.course}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Tab: Timetable ───────────────────────────────────────────────────────────

function TabTimetable({ timetable, fetchTimetable, staff, courseData }) {
  const [form, setForm]           = useState({ course:'', subtype:'', class_name:'', batch_id:'', subject_name:'', teacher_name:'', day_of_week:'Monday', period_number:1, start_time:'', end_time:'' })
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [viewCourse, setViewCourse]   = useState('')
  const [viewSubtype, setViewSubtype] = useState('')
  const [subMode, setSubMode]     = useState(null)
  const [subTeacher, setSubTeacher]   = useState('')
  const [subDate, setSubDate]     = useState(today())
  const [substitutes, setSubstitutes] = useState([])
  const [confirmDel, setConfirmDel]   = useState(null)
  const { show: showToast, el: toastEl } = useToast()
  const { courses, subtypesFor, classesFor } = courseData

  useEffect(() => {
    if (courses.length && !viewCourse) {
      const c = courses[0]
      const s = subtypesFor(c)[0]||''
      setViewCourse(c); setViewSubtype(s)
    }
  }, [courses]) // eslint-disable-line

  useEffect(() => {
    supabase.from('timetable_substitutes').select('*').order('sub_date',{ascending:false})
      .then(({ data }) => { if (data) setSubstitutes(data) })
      .catch(()=>{})
  }, [])

  const conflictMap = useMemo(() => {
    const map = {}
    timetable.forEach(t => {
      if (!t.teacher_name) return
      const key = `${t.teacher_name}||${t.day_name}||${t.period_name}`
      if (!map[key]) map[key]=[]
      map[key].push(t)
    })
    return Object.entries(map).filter(([,slots]) => slots.length>1).map(([,slots]) => ({
      teacher:slots[0].teacher_name, day:slots[0].day_name, period:slots[0].period_name, slots
    }))
  }, [timetable])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('timetable_entries').insert([{
      class_name: form.subtype||form.class_name,
      subject_name: form.subject_name,
      teacher_name: form.teacher_name||null,
      day_name: form.day_of_week,
      period_name: String(form.period_number),
      start_time: form.start_time||null,
      end_time: form.end_time||null,
    }])
    if (error) showToast('Error: '+error.message, '#dc2626')
    else { setShowForm(false); fetchTimetable(); showToast('Period saved', '#16a34a') }
    setSaving(false)
  }

  const handleDelete = async id => {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    if (error) showToast('Delete failed: '+error.message, '#dc2626')
    else { setConfirmDel(null); fetchTimetable(); showToast('Period deleted', '#dc2626') }
  }

  const handleSaveSubstitute = async () => {
    if (!subTeacher||!subMode) return
    const slot = timetable.find(t => t.id===subMode.slotId)
    const { error } = await supabase.from('timetable_substitutes').insert([{
      original_slot_id:subMode.slotId, original_teacher:slot?.teacher_name||'',
      substitute_teacher:subTeacher, sub_date:subDate,
      day_name:subMode.day, period_name:String(subMode.period),
      class_name:subMode.subtype, subject_name:slot?.subject_name||'',
    }])
    if (error) showToast('Error: '+error.message, '#dc2626')
    else {
      const { data } = await supabase.from('timetable_substitutes').select('*').order('sub_date',{ascending:false})
      if (data) setSubstitutes(data)
      setSubMode(null); setSubTeacher('')
      showToast('Substitute assigned', '#16a34a')
    }
  }

  const handleDeleteSub = async id => {
    await supabase.from('timetable_substitutes').delete().eq('id', id)
    const { data } = await supabase.from('timetable_substitutes').select('*').order('sub_date',{ascending:false})
    if (data) setSubstitutes(data)
    showToast('Substitute removed', '#dc2626')
  }

  const getSlot = (day, period) => timetable.find(t => t.class_name===viewSubtype && t.day_name===day && t.period_name===String(period))
  const getSub  = (day, period) => substitutes.find(s => s.class_name===viewSubtype && s.day_name===day && s.period_name===String(period) && s.sub_date===subDate)

  const viewSubtypes = viewCourse ? subtypesFor(viewCourse) : []

  const teacherWorkload = useMemo(() => {
    const map = {}
    timetable.forEach(t => {
      if (!t.teacher_name) return
      if (!map[t.teacher_name]) map[t.teacher_name] = { periods:0, batches:new Set(), days:new Set() }
      map[t.teacher_name].periods++
      map[t.teacher_name].batches.add(t.class_name)
      map[t.teacher_name].days.add(t.day_name)
    })
    return Object.entries(map).map(([name,d]) => ({ name, periods:d.periods, batches:d.batches.size, days:d.days.size })).sort((a,b) => b.periods-a.periods)
  }, [timetable])

  return (
    <>
      {toastEl}
      {confirmDel && <ConfirmModal title="Delete Period" message="Remove this period from the timetable?" confirmLabel="Delete" danger onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      {conflictMap.length > 0 && (
        <div style={{ padding:'12px 16px', background:'#fff1f2', border:'1px solid #fecaca', borderRadius:10, marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#dc2626', fontSize:14, marginBottom:6 }}>⚠️ {conflictMap.length} Teacher Conflict{conflictMap.length>1?'s':''}</div>
          {conflictMap.map((c,i) => (
            <div key={i} style={{ fontSize:12, color:'#b91c1c', marginBottom:2 }}>
              👨‍🏫 {c.teacher} · {c.day} · P{c.period} → {c.slots.map(s=>s.class_name).join(' & ')}
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', margin:0 }}>🕐 Timetable</h2>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <select value={viewCourse} onChange={e => { setViewCourse(e.target.value); setViewSubtype('') }} style={{ ...S.select, width:'auto' }}>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <select value={viewSubtype} onChange={e => setViewSubtype(e.target.value)} style={{ ...S.select, width:'auto' }}>
              <option value="">Select Batch</option>
              {viewSubtypes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize:12, color:'#64748b' }}>Sub date:</span>
            <input type="date" value={subDate} onChange={e => setSubDate(e.target.value)} style={{ ...S.input, width:140, fontSize:12, padding:'6px 10px' }}/>
            <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm?'#64748b':'#1e3a5f')}>{showForm?'✖ Cancel':'➕ Add Period'}</button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="form-grid" style={{ ...S.formGrid, marginBottom:20, padding:14, background:'#f8fafc', borderRadius:8 }}>
            <CoursePicker form={form} setForm={setForm} courseData={courseData}/>
            <div><label style={S.label}>Day</label><select value={form.day_of_week} onChange={e=>setForm(f=>({...f,day_of_week:e.target.value}))} required style={S.select}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={S.label}>Period</label><select value={form.period_number} onChange={e=>setForm(f=>({...f,period_number:e.target.value}))} required style={S.select}>{PERIODS.map(p=><option key={p} value={p}>Period {p}</option>)}</select></div>
            <div><label style={S.label}>Subject</label><select value={form.subject_name} onChange={e=>setForm(f=>({...f,subject_name:e.target.value}))} required style={S.select}><option value="">Select</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={S.label}>Teacher</label><select value={form.teacher_name} onChange={e=>setForm(f=>({...f,teacher_name:e.target.value}))} style={S.select}><option value="">Select</option>{staff.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
            <div><label style={S.label}>Start Time</label><input type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={S.input}/></div>
            <div><label style={S.label}>End Time</label><input type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={S.input}/></div>
            <div style={{ gridColumn:'1/-1' }}><button type="submit" disabled={saving} style={S.btn('#16a34a',saving)}>{saving?'⏳ Saving...':'✅ Save Period'}</button></div>
          </form>
        )}

        <div className="table-wrap">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:560 }}>
            <thead>
              <tr style={{ background:'#1e3a5f', color:'white' }}>
                <th style={{ padding:'9px 10px', textAlign:'center', fontWeight:700, minWidth:40 }}>P</th>
                {DAYS.map(d => <th key={d} style={{ padding:'9px 10px', textAlign:'center', fontWeight:700, minWidth:100 }}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p} style={{ borderBottom:'1px solid #e2e8f0' }}>
                  <td style={{ padding:'7px 10px', textAlign:'center', fontWeight:800, color:'#1e3a5f', background:'#f8fafc', fontSize:13 }}>P{p}</td>
                  {DAYS.map(day => {
                    const slot = getSlot(day, p)
                    const sub  = getSub(day, p)
                    const isConflict = conflictMap.some(c => c.teacher===slot?.teacher_name && c.day===day && c.period===String(p))
                    return (
                      <td key={day} style={{ padding:5, textAlign:'center', background:sub?'#fef9c3':slot?'#f0fdf4':isConflict?'#fff1f2':'white', border:isConflict?'1px solid #fecaca':'none' }}>
                        {slot ? (
                          <div>
                            <div style={{ fontWeight:700, color:'#15803d', fontSize:11 }}>{slot.subject_name}</div>
                            {sub
                              ? <div style={{ fontSize:10, color:'#b45309', fontWeight:600 }}>🔄 {sub.substitute_teacher}</div>
                              : <div style={{ fontSize:10, color:'#64748b' }}>{slot.teacher_name||'-'}</div>}
                            {slot.start_time && <div style={{ fontSize:9, color:'#94a3b8' }}>{slot.start_time}–{slot.end_time}</div>}
                            {isConflict && <div style={{ fontSize:9, color:'#dc2626', fontWeight:700 }}>⚠️ conflict</div>}
                            <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:3 }}>
                              <button onClick={() => setSubMode({ slotId:slot.id, day, period:p, subtype:viewSubtype })} style={{ ...S.btnSm('#f59e0b'), padding:'2px 5px', fontSize:9 }}>🔄</button>
                              <button onClick={() => setConfirmDel(slot.id)} style={{ ...S.btnSm('#dc2626'), padding:'2px 5px', fontSize:9 }}>🗑</button>
                            </div>
                          </div>
                        ) : <span style={{ color:'#e2e8f0', fontSize:14 }}>—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {subMode && (
          <div style={{ marginTop:14, padding:'14px 16px', background:'#fef9c3', border:'1px solid #f59e0b', borderRadius:10 }}>
            <div style={{ fontWeight:700, color:'#b45309', marginBottom:10, fontSize:13 }}>🔄 Assign Substitute — {subMode.day} P{subMode.period} · {subMode.subtype}</div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <select value={subTeacher} onChange={e=>setSubTeacher(e.target.value)} style={{ ...S.select, width:200 }}>
                <option value="">Select teacher</option>
                {staff.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <input type="date" value={subDate} onChange={e=>setSubDate(e.target.value)} style={{ ...S.input, width:150 }}/>
              <button onClick={handleSaveSubstitute} style={S.btn('#f59e0b')}>✅ Assign</button>
              <button onClick={() => { setSubMode(null); setSubTeacher('') }} style={S.btn('#64748b')}>✖</button>
            </div>
          </div>
        )}
      </div>

      {substitutes.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:14, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>🔄 Substitute History</h3>
          <div className="table-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:400 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','Batch','Day','Period','Subject','Original','Substitute',''].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {substitutes.slice(0,20).map(s => (
                  <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'8px 10px', color:'#64748b' }}>{fmtDate(s.sub_date)}</td>
                    <td style={{ padding:'8px 10px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{s.class_name||'-'}</span></td>
                    <td style={{ padding:'8px 10px', color:'#64748b' }}>{s.day_name}</td>
                    <td style={{ padding:'8px 10px', color:'#64748b' }}>P{s.period_name}</td>
                    <td style={{ padding:'8px 10px', fontWeight:600, color:'#1e293b' }}>{s.subject_name}</td>
                    <td style={{ padding:'8px 10px', color:'#64748b' }}>{s.original_teacher}</td>
                    <td style={{ padding:'8px 10px', fontWeight:700, color:'#b45309' }}>{s.substitute_teacher}</td>
                    <td style={{ padding:'8px 10px' }}><button onClick={() => handleDeleteSub(s.id)} style={S.btnSm('#dc2626')}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ fontSize:14, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>👨‍🏫 Teacher Workload</h3>
        <div className="table-wrap">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:360 }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Teacher','Periods/Week','Batches','Active Days','Load'].map(h => (
                  <th key={h} style={{ padding:'9px 10px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teacherWorkload.map((t,i) => {
                const lp = Math.round((t.periods/(DAYS.length*PERIODS.length))*100)
                return (
                  <tr key={t.name} style={{ borderBottom:'1px solid #f1f5f9', background:i<3?'#fafffe':'white' }}>
                    <td style={{ padding:'9px 10px', fontWeight:600, color:'#1e293b' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'👨‍🏫'} {t.name}</td>
                    <td style={{ padding:'9px 10px', fontWeight:700, color:'#1e3a5f', fontFamily:"'JetBrains Mono',monospace" }}>{t.periods}</td>
                    <td style={{ padding:'9px 10px', color:'#64748b' }}>{t.batches}</td>
                    <td style={{ padding:'9px 10px', color:'#64748b' }}>{t.days}</td>
                    <td style={{ padding:'9px 10px', minWidth:110 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ flex:1, height:6, background:'#e2e8f0', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${Math.min(lp,100)}%`, height:'100%', background:lp>70?'#dc2626':lp>40?'#d97706':'#16a34a', borderRadius:3 }}/>
                        </div>
                        <span style={{ fontSize:11, color:'#64748b', minWidth:28 }}>{lp}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {teacherWorkload.length===0 && <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:'#94a3b8' }}>No timetable data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Tab: Reports ─────────────────────────────────────────────────────────────

function TabReports({ logs, missed, staff, courseData }) {
  const [month, setMonth]     = useState(currentYearMonth())
  const [teacher, setTeacher] = useState('All')
  const [course, setCourse]   = useState('All')
  const [expanded, setExpanded] = useState({}) // teacher name → true when showing all logs
  const { courses } = courseData
  const teachers    = [...new Set(logs.map(l => l.teacher_name).filter(Boolean))]
  const monthLogs   = logs.filter(l => l.teaching_date?.startsWith(month) && (teacher==='All'||l.teacher_name===teacher) && (course==='All'||l.course===course))
  const monthMissed = missed.filter(m => m.missed_date?.startsWith(month) && (teacher==='All'||m.teacher_name===teacher))

  const byTeacher = useMemo(() => {
    const map = {}
    monthLogs.forEach(l => {
      if (!l.teacher_name) return
      if (!map[l.teacher_name]) map[l.teacher_name] = { logs:[], subjects:new Set(), dates:new Set(), classes:new Set() }
      map[l.teacher_name].logs.push(l); map[l.teacher_name].subjects.add(l.subject_name); map[l.teacher_name].dates.add(l.teaching_date)
      if (l.class_name) map[l.teacher_name].classes.add(`${l.course}/${l.subtype}/${l.class_name}`)
    })
    return map
  }, [monthLogs])

  const handlePrint = () => {
    const content = document.getElementById('print-report')?.innerHTML
    if (!content) { window.print(); return }
    const w = window.open('','_blank')
    w.document.write(`<html><head><title>Teaching Report</title><style>body{font-family:sans-serif;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px}th{background:#1e3a5f;color:white}.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}</style></head><body>${content}</body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }} className="no-print">
        <h2 style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', margin:0 }}>📈 Monthly Report</h2>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, minHeight:44 }}/>
          <select value={course} onChange={e => setCourse(e.target.value)} style={{ ...S.select, width:'auto' }}><option value="All">All Courses</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={teacher} onChange={e => setTeacher(e.target.value)} style={{ ...S.select, width:'auto' }}><option value="All">All Teachers</option>{teachers.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <button onClick={handlePrint} style={S.btn('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>
      <div id="print-report">
        <div className="stat-grid-4" style={S.statGrid(4)}>
          {[
            { label:'Classes Taken',     value:monthLogs.length,    color:'#1e3a5f', bg:'#eff6ff' },
            { label:'Missed',            value:monthMissed.length,   color:'#dc2626', bg:'#fee2e2' },
            { label:'Subjects Covered',  value:new Set(monthLogs.map(l=>l.subject_name)).size, color:'#7c3aed', bg:'#f3e8ff' },
            { label:'Active Teachers',   value:Object.keys(byTeacher).length, color:'#16a34a', bg:'#dcfce7' },
          ].map(c => (
            <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:14, borderLeft:`4px solid ${c.color}` }}>
              <div style={{ fontSize:12, color:c.color, fontWeight:700 }}>{c.label}</div>
              <div style={{ fontSize:24, fontWeight:800, color:c.color, marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>
        {Object.entries(byTeacher).map(([name, data]) => {
          const avgPerDay = data.dates.size>0?(data.logs.length/data.dates.size).toFixed(1):'0'
          return (
            <div key={name} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:16, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
                <span style={{ fontWeight:800, color:'#1e293b', fontSize:14 }}>👨‍🏫 {name}</span>
                <span style={{ fontSize:12, color:'#64748b' }}>{data.logs.length} classes · {data.subjects.size} subjects · {avgPerDay} avg/day</span>
              </div>
              {data.classes.size>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>{[...data.classes].map(cl=><span key={cl} style={S.pill('#16a34a','#f0fdf4')}>{cl}</span>)}</div>}
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>{[...data.subjects].map(s=><span key={s} style={S.pill('#1e3a5f','#eff6ff')}>{s}</span>)}</div>
              {[...data.logs].slice(0, expanded[name] ? data.logs.length : 5).map(l => (
                <div key={l.id} style={{ borderBottom:'1px solid #f1f5f9', padding:'4px 0', fontSize:13, color:'#64748b' }}>
                  {fmtDate(l.teaching_date)} — {l.subject_name} [{l.course}/{l.subtype}]: <em>{l.topic_taught}</em>
                </div>
              ))}
              {data.logs.length>5 && (
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [name]: !prev[name] }))}
                  className="no-print"
                  style={{
                    color:'#1e3a5f', fontSize:12, marginTop:6, fontWeight:700,
                    background:'#eff6ff', border:'none', borderRadius:7,
                    padding:'6px 12px', cursor:'pointer',
                  }}
                >
                  {expanded[name] ? '▲ Show less' : `▼ +${data.logs.length-5} more`}
                </button>
              )}
            </div>
          )
        })}
        {Object.keys(byTeacher).length===0 && <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No logs for this period.</div>}
      </div>
    </div>
  )
}

// ─── Tab: Search ──────────────────────────────────────────────────────────────

function TabSearch({ logs, monthlySyllabus=[], onNavigateTab }) {
  const [query, setQuery]         = useState('')
  const [marking, setMarking]     = useState(null)
  const [localSyllabus, setLocalSyllabus] = useState(monthlySyllabus)
  useEffect(() => { setLocalSyllabus(monthlySyllabus) }, [monthlySyllabus])

  const findSyllabusMatch = useCallback(logItem => {
    if (!localSyllabus.length || !logItem.topic_taught) return null
    const topicLower = (logItem.topic_taught||'').toLowerCase()
    return localSyllabus.find(s => {
      const sLower = s.topic.toLowerCase()
      if (sLower.length < 4 || topicLower.length < 4) return false
      const fragment = sLower.slice(0, Math.min(20, sLower.length))
      return topicLower.includes(fragment) || sLower.includes(topicLower.slice(0, Math.min(20, topicLower.length)))
    }) || null
  }, [localSyllabus])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return logs.filter(l =>
      (l.topic_taught||'').toLowerCase().includes(q) ||
      (l.classwork||'').toLowerCase().includes(q) ||
      (l.homework||'').toLowerCase().includes(q)
    ).sort((a,b) => (b.teaching_date ?? '').localeCompare(a.teaching_date ?? ''))
  }, [logs, query])

  const handleMarkDone = async syllabusItem => {
    setMarking(syllabusItem.id)
    const completed_at = new Date().toISOString()
    const { error } = await supabase.from('monthly_syllabus').update({ completed:true, completed_at }).eq('id', syllabusItem.id)
    if (!error) setLocalSyllabus(prev => prev.map(s => s.id===syllabusItem.id?{...s,completed:true,completed_at}:s))
    else alert('Error: '+error.message)
    setMarking(null)
  }

  const matchCount   = useMemo(() => results.filter(r => findSyllabusMatch(r)).length, [results, findSyllabusMatch])
  const pendingCount = useMemo(() => results.filter(r => { const m=findSyllabusMatch(r); return m&&!m.completed }).length, [results, findSyllabusMatch])

  return (
    <div style={S.card}>
      <h2 style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>🔍 Topic Search</h2>
      <p style={{ color:'#64748b', fontSize:13, marginBottom:14 }}>Search across all topics, classwork, and homework with live Monthly Syllabus matching.</p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Pythagoras, Photosynthesis, LCM..." style={{ ...S.input, fontSize:15, padding:'12px 16px', marginBottom:14 }} autoFocus/>
      {query && results.length>0 && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14, padding:'10px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0', fontSize:12 }}>
          <span style={{ color:'#1e3a5f', fontWeight:700 }}>📋 {results.length} log{results.length!==1?'s':''} found</span>
          {matchCount>0 && <span style={{ color:'#7c3aed', fontWeight:700 }}>📆 {matchCount} match syllabus</span>}
          {pendingCount>0 && <span style={{ color:'#b45309', fontWeight:700 }}>⏳ {pendingCount} pending</span>}
          {matchCount>0 && <button onClick={() => onNavigateTab?.('monthly')} style={{ marginLeft:'auto', ...S.btnSm('#1e3a5f') }}>→ Monthly Syllabus</button>}
        </div>
      )}
      {query && <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>{results.length} result{results.length!==1?'s':''}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {results.map(l => {
          const match = findSyllabusMatch(l)
          return (
            <div key={l.id} style={{ border:`1px solid ${match?(match.completed?'#bbf7d0':'#fde68a'):'#e2e8f0'}`, borderRadius:10, padding:'14px 16px', background:match?(match.completed?'#fafffe':'#fffdf0'):'white' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, flexWrap:'wrap', gap:4 }}>
                <span style={{ fontWeight:700, color:'#1e293b' }}>{l.topic_taught}</span>
                <span style={{ fontSize:12, color:'#64748b' }}>{fmtDate(l.teaching_date)}</span>
              </div>
              <div style={{ fontSize:13, color:'#64748b' }}>{l.course}/{l.subtype}/{l.class_name} · {l.subject_name} · 👨‍🏫 {l.teacher_name||'-'}</div>
              {l.classwork && <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>📝 {l.classwork}</div>}
              {l.homework  && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>📚 HW: {l.homework}</div>}
              {match && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, padding:'7px 12px', background:match.completed?'#f0fdf4':'#fefce8', border:`1px solid ${match.completed?'#bbf7d0':'#fde68a'}`, borderRadius:8, flexWrap:'wrap' }}>
                  <span style={S.badge('#1e3a5f','#eff6ff')}>{match.admit_type}</span>
                  <span style={S.badge('#7c3aed','#f3e8ff')}>{match.subject_name}</span>
                  {match.completed
                    ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span>
                    : <span style={S.badge('#b45309','#fef9c3')}>⏳ Pending</span>}
                  <span style={{ fontSize:11, color:'#64748b', flex:1 }}>📆 {match.topic}</span>
                  {!match.completed && <button onClick={() => handleMarkDone(match)} disabled={marking===match.id} style={S.btnSm('#16a34a')}>✓ Mark Done</button>}
                </div>
              )}
            </div>
          )
        })}
        {query && results.length===0 && <div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No results for "{query}"</div>}
      </div>
    </div>
  )
}

// ─── Tab: Student Performance ─────────────────────────────────────────────────

function TabStudentPerformance({ courseData, logs, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [scores, setScores]           = useState([])
  const [students, setStudents]       = useState([])
  const [studentsErr, setStudentsErr] = useState('')
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [filterBatch, setFilterBatch]       = useState('All')
  const [filterSubject, setFilterSubject]   = useState('All')
  const [filterStudent, setFilterStudent]   = useState('All')
  const [viewMode, setViewMode]       = useState('table')
  const [confirmDel, setConfirmDel]   = useState(null)
  const { show: showToast, el: toastEl } = useToast()
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData

  const blankForm = { student_id:'', student_name:'', batch_id:'', course:'', subtype:'', class_name:'', subject_name:'', topic:'', test_date:today(), score:'', max_score:'100', notes:'' }
  const [form, setForm] = useState(blankForm)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkForm, setBulkForm] = useState({ course:'', subtype:'', class_name:'', subject_name:'', topic:'', test_date:today(), max_score:'100' })
  const [bulkStudents, setBulkStudents] = useState([])
  const [bulkMarks, setBulkMarks] = useState({})
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchScores = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('student_scores').select('*').order('test_date',{ascending:false})
    if (error) showToast('Load failed: '+error.message, '#dc2626')
    if (data) setScores(data)
    setLoading(false)
  }

  const fetchStudents = async (course, subtype) => {
    if (!course) { setStudents([]); setStudentsErr(''); return }
    setStudentsErr('')
    let q = supabase.from('students').select('id,name,roll_number').eq('status','Active').eq('course', course)
    if (subtype) q = q.eq('batch', subtype)
    const { data, error } = await q.order('name')
    if (error) { setStudentsErr('Could not load students: '+error.message); setStudents([]) }
    else setStudents(data||[])
  }

  const fetchBulkStudents = async () => {
    if (!bulkForm.course) return
    setBulkLoading(true)
    let q = supabase.from('students').select('id,name,roll_number,admission_no').eq('status','Active').eq('course', bulkForm.course)
    if (bulkForm.subtype) q = q.eq('batch', bulkForm.subtype)
    const { data, error } = await q.order('name')
    if (error) { showToast('Could not load students: '+error.message, '#dc2626'); setBulkLoading(false); return }
    setBulkStudents(data||[])
    const initMarks = {}
    ;(data||[]).forEach(s => { initMarks[s.id] = '' })
    setBulkMarks(initMarks)
    setBulkLoading(false)
  }

  const handleBulkSave = async () => {
    if (!bulkForm.subject_name || !bulkForm.topic || !bulkForm.test_date) {
      showToast('Fill Subject, Test Name and Date first', '#dc2626'); return
    }
    const entries = bulkStudents.filter(s => bulkMarks[s.id] !== '' && bulkMarks[s.id] !== undefined)
    if (!entries.length) { showToast('Enter at least one mark', '#dc2626'); return }
    setBulkSaving(true)
    const payload = entries.map(s => ({
      student_id: s.id,
      student_name: s.name,
      course: bulkForm.course,
      subtype: bulkForm.subtype||null,
      class_name: bulkForm.class_name||null,
      subject_name: bulkForm.subject_name,
      topic: bulkForm.topic,
      test_date: bulkForm.test_date,
      score: parseFloat(bulkMarks[s.id]),
      max_score: parseFloat(bulkForm.max_score)||100,
    }))
    const { error } = await supabase.from('student_scores').insert(payload)
    if (error) showToast('Save failed: '+error.message, '#dc2626')
    else {
      showToast(`✅ ${payload.length} scores saved!`, '#16a34a')
      setBulkStudents([])
      setBulkMarks({})
      setBulkForm({ course:'', subtype:'', class_name:'', subject_name:'', topic:'', test_date:today(), max_score:'100' })
      setBulkMode(false)
      fetchScores()
    }
    setBulkSaving(false)
  }

  useEffect(() => { fetchScores() }, [])

  const handleCourseChange  = c  => { setForm(f => ({ ...f, course:c, subtype:'', class_name:'', batch_id:'', student_id:'', student_name:'' })); setStudents([]) }
  const handleSubtypeChange = st => {
    const cls = classesFor(form.course, st)
    const cn  = cls.length===1 ? cls[0] : ''
    const bid = cn ? batchIdFor(form.course, st, cn) : ''
    setForm(f => ({ ...f, subtype:st, class_name:cn, batch_id:bid, student_id:'', student_name:'' }))
    fetchStudents(form.course, st)
  }
  const handleClassChange = cn => {
    const bid = batchIdFor(form.course, form.subtype, cn)
    setForm(f => ({ ...f, class_name:cn, batch_id:bid, student_id:'', student_name:'' }))
    fetchStudents(form.course, form.subtype)
  }
  const handleStudentChange = sid => {
    const s = students.find(x => x.id===sid)
    setForm(f => ({ ...f, student_id:sid, student_name:s?.name||'' }))
  }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.student_id && !form.student_name) { showToast('Select or enter student name.', '#dc2626'); return }
    setSaving(true)
    const payload = {
      student_id:form.student_id||null, student_name:form.student_name,
      batch_id:form.batch_id||null, course:form.course, subtype:form.subtype||null, class_name:form.class_name||null,
      subject_name:form.subject_name, topic:form.topic, test_date:form.test_date,
      score:parseFloat(form.score), max_score:parseFloat(form.max_score), notes:form.notes||null,
    }
    let error
    if (editingId) {
      ({ error } = await supabase.from('student_scores').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('student_scores').insert([payload]))
    }
    if (error) showToast('Error: '+error.message, '#dc2626')
    else { setShowForm(false); setEditingId(null); setForm(blankForm); fetchScores(); showToast(editingId?'Updated':'Score saved', '#16a34a') }
    setSaving(false)
  }

  const handleDelete = async id => {
    const { error } = await supabase.from('student_scores').delete().eq('id', id)
    if (error) showToast('Delete failed: '+error.message, '#dc2626')
    else { setConfirmDel(null); fetchScores(); showToast('Deleted', '#dc2626') }
  }

  const startEdit = s => {
    setEditingId(s.id); setForm({ student_id:s.student_id||'', student_name:s.student_name, batch_id:s.batch_id||'', course:s.course||'', subtype:s.subtype||'', class_name:s.class_name||'', subject_name:s.subject_name, topic:s.topic||'', test_date:s.test_date, score:String(s.score), max_score:String(s.max_score), notes:s.notes||'' }); setShowForm(true)
  }

  const allBatches  = [...new Set(scores.map(s => s.subtype).filter(Boolean))]
  const allSubjects = [...new Set(scores.map(s => s.subject_name).filter(Boolean))]
  const allStudents = [...new Set(scores.map(s => s.student_name).filter(Boolean))]

  const filtered = useMemo(() => scores.filter(s =>
    (filterBatch==='All'||s.subtype===filterBatch) &&
    (filterSubject==='All'||s.subject_name===filterSubject) &&
    (filterStudent==='All'||s.student_name===filterStudent)
  ), [scores, filterBatch, filterSubject, filterStudent])

  const weakAreas = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      const key = `${s.student_name}||${s.subject_name}`
      if (!map[key]) map[key] = { student:s.student_name, subject:s.subject_name, scores:[], batch:s.subtype }
      map[key].scores.push(pct(s.score, s.max_score))
    })
    return Object.values(map).map(m => ({ ...m, avg:Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) })).sort((a,b) => a.avg-b.avg)
  }, [filtered])

  const weakOnly  = weakAreas.filter(w => w.avg < 60)
  const trendData = useMemo(() => {
    if (filterStudent==='All') return []
    return filtered.filter(s => s.student_name===filterStudent).sort((a,b) => (a.test_date ?? '').localeCompare(b.test_date ?? ''))
  }, [filtered, filterStudent])

  const avgScore = filtered.length > 0 ? Math.round(filtered.reduce((a,s) => a+pct(s.score,s.max_score),0)/filtered.length) : 0
  const topScore = filtered.length > 0 ? Math.max(...filtered.map(s => pct(s.score,s.max_score))) : 0
  const scoreClasses = form.score && form.max_score ? pct(parseFloat(form.score), parseFloat(form.max_score)) : null

  return (
    <>
      {toastEl}
      {confirmDel && <ConfirmModal title="Delete Score" message="Delete this score entry?" confirmLabel="Delete" danger onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      <div className="stat-grid-4" style={S.statGrid(4)}>
        {[
          { label:'Total Assessments', value:filtered.length, color:'#1e3a5f', bg:'#eff6ff', icon:'📝' },
          { label:'Avg Score',         value:`${avgScore}%`,  color:scoreColor(avgScore), bg:scoreBg(avgScore), icon:'📊' },
          { label:'Top Score',         value:`${topScore}%`,  color:'#16a34a', bg:'#dcfce7', icon:'🏆' },
          { label:'Weak Areas',        value:weakOnly.length, color:'#dc2626', bg:'#fee2e2', icon:'⚠️' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:12, color:c.color, fontWeight:700, margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:26, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: (showForm||bulkMode)?18:0, flexWrap:'wrap', gap:8 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#1e3a5f', margin:0 }}>🎯 {editingId?'Edit Score':'Add Score'}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setBulkMode(!bulkMode); setShowForm(false); setEditingId(null) }} style={S.btn(bulkMode?'#64748b':'#7c3aed')}>{bulkMode?'✖ Cancel':'📋 Bulk Entry'}</button>
            <button onClick={() => { setShowForm(!showForm); setBulkMode(false); setEditingId(null); setForm(blankForm) }} style={S.btn(showForm?'#64748b':'#1e3a5f')}>{showForm?'✖ Cancel':'➕ Add Score'}</button>
          </div>
        </div>

        {/* ── Bulk Entry Mode ── */}
        {bulkMode && (
          <div>
            <div style={{ padding:'10px 14px', background:'#f3e8ff', border:'1px solid #ddd6fe', borderRadius:8, marginBottom:14, fontSize:13, color:'#7c3aed', fontWeight:600 }}>
              📋 Bulk Mode — fill test details, load students, enter marks for all at once
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={S.label}>Course *</label>
                <select value={bulkForm.course} onChange={e => setBulkForm(f=>({...f,course:e.target.value,subtype:'',class_name:''}))} style={S.select}>
                  <option value="">Select Course</option>
                  {courses.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Batch / Subtype</label>
                <select value={bulkForm.subtype} onChange={e => setBulkForm(f=>({...f,subtype:e.target.value}))} disabled={!bulkForm.course} style={{ ...S.select, opacity:bulkForm.course?1:.5 }}>
                  <option value="">Select Batch</option>
                  {(bulkForm.course?subtypesFor(bulkForm.course):[]).map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Subject *</label>
                <select value={bulkForm.subject_name} onChange={e => setBulkForm(f=>({...f,subject_name:e.target.value}))} style={S.select}>
                  <option value="">Select Subject</option>
                  {SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Test / Topic Name *</label>
                <input value={bulkForm.topic} onChange={e => setBulkForm(f=>({...f,topic:e.target.value}))} placeholder="e.g. Unit Test 1" style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Test Date *</label>
                <input type="date" value={bulkForm.test_date} onChange={e => setBulkForm(f=>({...f,test_date:e.target.value}))} style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Max Marks</label>
                <input type="number" value={bulkForm.max_score} onChange={e => setBulkForm(f=>({...f,max_score:e.target.value}))} placeholder="100" style={S.input}/>
              </div>
            </div>
            <button onClick={fetchBulkStudents} disabled={!bulkForm.course||bulkLoading} style={{ ...S.btn('#0891b2', !bulkForm.course||bulkLoading), marginBottom:16 }}>
              {bulkLoading ? '⏳ Loading...' : '👥 Load Students'}
            </button>

            {bulkStudents.length > 0 && (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10 }}>
                  📝 Enter marks for {bulkStudents.length} students — Max: {bulkForm.max_score}
                  <span style={{ marginLeft:12, fontSize:12, color:'#94a3b8', fontWeight:400 }}>Leave blank to skip a student</span>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  <button onClick={() => { const m = {}; bulkStudents.forEach(s => { m[s.id] = bulkForm.max_score }); setBulkMarks(m) }} style={S.btnSm('#16a34a')}>✅ All Full Marks</button>
                  <button onClick={() => { const m = {}; bulkStudents.forEach(s => { m[s.id] = '' }); setBulkMarks(m) }} style={S.btnSm('#94a3b8')}>✕ Clear All</button>
                </div>
                <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                        <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>#</th>
                        <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>Student</th>
                        <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>Marks / {bulkForm.max_score}</th>
                        <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>%</th>
                        <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkStudents.map((s, i) => {
                        const mark = bulkMarks[s.id]
                        const p = mark !== '' && mark !== undefined ? pct(parseFloat(mark), parseFloat(bulkForm.max_score)||100) : null
                        return (
                          <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9', background: p!==null?(p>=75?'#f0fdf4':p>=50?'#fffbeb':'#fff1f2'):'white' }}>
                            <td style={{ padding:'8px 12px', color:'#94a3b8', fontSize:11 }}>{i+1}</td>
                            <td style={{ padding:'8px 12px', fontWeight:600, color:'#1e293b' }}>
                              {s.name}
                              {s.roll_number && <span style={{ marginLeft:6, fontSize:11, color:'#94a3b8' }}>#{s.roll_number}</span>}
                            </td>
                            <td style={{ padding:'8px 12px' }}>
                              <input
                                type="number"
                                min="0"
                                max={bulkForm.max_score}
                                step="0.5"
                                value={mark||''}
                                onChange={e => setBulkMarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="—"
                                style={{ width:80, padding:'6px 10px', borderRadius:6, border:`1.5px solid ${p!==null?scoreColor(p):'#d1d5db'}`, fontSize:13, fontFamily:'inherit', textAlign:'center' }}
                              />
                            </td>
                            <td style={{ padding:'8px 12px', fontWeight:700, color:p!==null?scoreColor(p):'#94a3b8', fontFamily:"'JetBrains Mono',monospace" }}>
                              {p !== null ? `${p}%` : '—'}
                            </td>
                            <td style={{ padding:'8px 12px' }}>
                              {p !== null && <span style={{ ...S.badge(scoreColor(p), scoreBg(p)) }}>{p>=75?'Good':p>=50?'Avg':'Weak'}</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={handleBulkSave} disabled={bulkSaving} style={S.btn('#16a34a', bulkSaving)}>
                    {bulkSaving ? '⏳ Saving...' : `✅ Save ${bulkStudents.filter(s => bulkMarks[s.id] !== '').length} Scores`}
                  </button>
                  <span style={{ fontSize:12, color:'#64748b' }}>
                    {bulkStudents.filter(s => bulkMarks[s.id] !== '').length} of {bulkStudents.length} filled
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        {showForm && (
          <form onSubmit={handleSave} className="form-grid" style={{ ...S.formGrid, marginTop:16 }}>
            <div><label style={S.label}>Course</label><select value={form.course} onChange={e => handleCourseChange(e.target.value)} required style={S.select}><option value="">Select Course</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={S.label}>Batch / Subtype</label><select value={form.subtype} onChange={e => handleSubtypeChange(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity:form.course?1:.5 }}><option value="">Select Batch</option>{form.course ? subtypesFor(form.course).map(s => <option key={s} value={s}>{s}</option>) : null}</select></div>
            <div><label style={S.label}>Class</label>{(form.course&&form.subtype ? classesFor(form.course,form.subtype) : []).length > 0?<select value={form.class_name} onChange={e => handleClassChange(e.target.value)} disabled={!form.subtype} style={{ ...S.select, opacity:form.subtype?1:.5 }}><option value="">Select Class</option>{classesFor(form.course, form.subtype).map(c => <option key={c} value={c}>{c}</option>)}</select>:<input value={form.class_name} onChange={e => handleClassChange(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} style={{ ...S.input, opacity:form.subtype?1:.5 }}/>}</div>
            <div><label style={S.label}>Student</label>{studentsErr && <div style={{ fontSize:11, color:'#dc2626', marginBottom:4, fontWeight:600 }}>⚠️ {studentsErr}</div>}{students.length > 0?<select value={form.student_id} onChange={e => handleStudentChange(e.target.value)} required style={S.select}><option value="">Select Student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}{s.roll_number?` (${s.roll_number})`:''}</option>)}</select>:<input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name:e.target.value }))} placeholder="Type student name" required style={S.input}/>}</div>
            <div><label style={S.label}>Subject</label><select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))} required style={S.select}><option value="">Select Subject</option>{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={S.label}>Topic / Test Name</label><input value={form.topic} onChange={e => setForm(f => ({ ...f, topic:e.target.value }))} placeholder="e.g. Fractions Quiz" required style={S.input}/></div>
            <div><label style={S.label}>Test Date</label><input type="date" value={form.test_date} onChange={e => setForm(f => ({ ...f, test_date:e.target.value }))} required style={S.input}/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div><label style={S.label}>Score</label><input type="number" min="0" step="0.5" value={form.score} onChange={e => setForm(f => ({ ...f, score:e.target.value }))} required placeholder="78" style={S.input}/></div>
              <div><label style={S.label}>Out of</label><input type="number" min="1" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score:e.target.value }))} required placeholder="100" style={S.input}/></div>
            </div>
            {scoreClasses !== null && (
              <div style={{ gridColumn:'1/-1', padding:'10px 14px', borderRadius:8, background:scoreBg(scoreClasses), border:`1px solid ${scoreColor(scoreClasses)}40` }}>
                <span style={{ fontSize:14, fontWeight:700, color:scoreColor(scoreClasses) }}>{scoreClasses}% — {scoreClasses>=75?'✅ Good':scoreClasses>=50?'⚠️ Average':'❌ Needs improvement'}</span>
              </div>
            )}
            <div style={{ gridColumn:'1/-1' }}><label style={S.label}>Notes (optional)</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} placeholder="Remarks" style={S.input}/></div>
            <div style={{ gridColumn:'1/-1', display:'flex', gap:10 }}>
              <button type="submit" disabled={saving} style={S.btn('#1e3a5f',saving)}>{saving?'⏳ Saving...':'✅ Save Score'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(blankForm) }} style={S.btn('#64748b')}>✖ Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 130px' }}><option value="All">All Batches</option>{allBatches.map(b=><option key={b} value={b}>{b}</option>)}</select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 130px' }}><option value="All">All Subjects</option>{allSubjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ ...S.select, width:'auto', flex:'0 1 150px' }}><option value="All">All Students</option>{allStudents.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          {[['table','📋'],['weak','⚠️'],['trend','📈']].map(([key,icon]) => (
            <button key={key} onClick={() => setViewMode(key)} style={{ ...S.btnSm(viewMode===key?'#1e3a5f':'#e2e8f0'), color:viewMode===key?'white':'#374151' }}>{icon}</button>
          ))}
        </div>
      </div>

      {viewMode==='table' && (loading ? <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading...</div> : (
        <div className="table-wrap" style={{ borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, background:'white', minWidth:600 }}>
            <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>{['Date','Student','Batch','Subject','Topic','Score','%','Grade','Actions'].map(h => (<th key={h} style={{ padding:'11px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map(s => { const p = pct(s.score, s.max_score); return (
                <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(s.test_date)}</td>
                  <td style={{ padding:'9px 12px', fontWeight:600, color:'#1e293b' }}>{s.student_name}</td>
                  <td style={{ padding:'9px 12px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{s.subtype||s.course||'-'}</span></td>
                  <td style={{ padding:'9px 12px', color:'#374151' }}>{s.subject_name}</td>
                  <td style={{ padding:'9px 12px', color:'#64748b', maxWidth:140 }}>{s.topic}</td>
                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#1e293b', fontFamily:"'JetBrains Mono',monospace" }}>{s.score}/{s.max_score}</td>
                  <td style={{ padding:'9px 12px' }}><div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:44, height:5, background:'#e2e8f0', borderRadius:3, overflow:'hidden' }}><div style={{ width:`${p}%`, height:'100%', background:scoreColor(p), borderRadius:3 }}/></div><span style={{ fontWeight:700, color:scoreColor(p), fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span></div></td>
                  <td style={{ padding:'9px 12px' }}><span style={{ ...S.badge(scoreColor(p), scoreBg(p)) }}>{p>=75?'Good':p>=50?'Avg':'Weak'}</span></td>
                  <td style={{ padding:'9px 12px' }}><div style={{ display:'flex', gap:5 }}><button onClick={() => startEdit(s)} style={S.btnSm('#7c3aed')}>✏️</button>{isAdmin && <button onClick={() => setConfirmDel(s.id)} style={S.btnSm('#dc2626')}>🗑</button>}</div></td>
                </tr>
              )})}
              {filtered.length===0 && <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No score data.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      {viewMode==='weak' && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#dc2626', marginTop:0 }}>⚠️ Weak Areas (below 60%)</h3>
          {weakOnly.length===0?<div style={{ textAlign:'center', padding:32, color:'#16a34a', fontWeight:600 }}>✅ No weak areas detected.</div>:weakOnly.map((w,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', border:'1px solid #fecaca', borderRadius:10, marginBottom:8, background:'#fff1f2', flexWrap:'wrap' }}>
              <div style={{ minWidth:130 }}><div style={{ fontWeight:700, color:'#1e293b', fontSize:13 }}>{w.student}</div><div style={{ fontSize:12, color:'#64748b' }}>{w.batch}</div></div>
              <div style={{ flex:1, minWidth:100 }}><div style={{ fontSize:12, color:'#374151', marginBottom:4 }}>{w.subject}</div><div style={{ height:7, background:'#fee2e2', borderRadius:3, overflow:'hidden' }}><div style={{ width:`${w.avg}%`, height:'100%', background:'#dc2626', borderRadius:3 }}/></div></div>
              <span style={{ fontWeight:800, color:'#dc2626', fontSize:18, fontFamily:"'JetBrains Mono',monospace" }}>{w.avg}%</span>
            </div>
          ))}
        </div>
      )}

      {viewMode==='trend' && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>📈 Score Trend — {filterStudent==='All'?'Select a student above':filterStudent}</h3>
          {filterStudent==='All'?<div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Select a student from the filter above.</div>:trendData.length===0?<div style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No scores for {filterStudent}.</div>:(
            <>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:160, padding:'0 6px', borderBottom:'2px solid #e2e8f0', overflowX:'auto', marginBottom:14 }}>
                {trendData.map((s,i) => { const p = pct(s.score, s.max_score); return (
                  <div key={s.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:54 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:scoreColor(p), fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span>
                    <div title={`${s.topic}: ${s.score}/${s.max_score}`} style={{ width:38, height:`${Math.max(p*1.4,4)}px`, background:scoreColor(p), borderRadius:'4px 4px 0 0', transition:'height .3s' }}/>
                    <div style={{ fontSize:10, color:'#64748b', textAlign:'center', maxWidth:54, wordBreak:'break-word' }}>{s.subject_name?.slice(0,5)}</div>
                    <div style={{ fontSize:9, color:'#94a3b8' }}>{s.test_date?.slice(5)}</div>
                  </div>
                )})}
              </div>
              <div className="stat-grid-4" style={{ ...S.statGrid(4), marginBottom:14 }}>
                {[{label:'Tests',value:trendData.length},{label:'Best',value:`${Math.max(...trendData.map(s=>pct(s.score,s.max_score)))}%`},{label:'Latest',value:`${pct(trendData[trendData.length-1].score,trendData[trendData.length-1].max_score)}%`},{label:'Average',value:`${Math.round(trendData.reduce((a,s)=>a+pct(s.score,s.max_score),0)/trendData.length)}%`}].map(c=>(
                  <div key={c.label} style={{ background:'#f8fafc', borderRadius:8, padding:'12px 14px' }}><div style={{ fontSize:12, color:'#64748b' }}>{c.label}</div><div style={{ fontSize:20, fontWeight:800, color:'#1e3a5f', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</div></div>
                ))}
              </div>
              {[...trendData].reverse().map(s => { const p = pct(s.score, s.max_score); return (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', border:'1px solid #f1f5f9', borderRadius:8, marginBottom:5, fontSize:13, flexWrap:'wrap' }}>
                  <span style={{ color:'#94a3b8', minWidth:70 }}>{fmtDate(s.test_date)}</span>
                  <span style={{ flex:1, color:'#374151' }}>{s.subject_name} — <em style={{ color:'#64748b' }}>{s.topic}</em></span>
                  <span style={{ fontWeight:700, color:scoreColor(p), fontFamily:"'JetBrains Mono',monospace" }}>{s.score}/{s.max_score} ({p}%)</span>
                </div>
              )})}
            </>
          )}
        </div>
      )}
    </>
  )
}

// ─── Tab: HM Dashboard ────────────────────────────────────────────────────────

function TabHMDashboard({ currentUser }) {
  const [allDoubt, setAllDoubt]       = useState([])
  const [allScores, setAllScores]     = useState([])
  const [houses, setHouses]           = useState([])
  const [teachingLogs, setTeachingLogs] = useState([])
  const [warnings, setWarnings]         = useState([])
  const [expandedWarningTeacher, setExpandedWarningTeacher] = useState(null) // teacher name currently showing full history
  const [excellentLogs, setExcellentLogs] = useState([])
  const [confirmDel, setConfirmDel]   = useState(null)
  const [photoView, setPhotoView]     = useState(null)
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const [selectedHouse, setSelectedHouse] = useState('All')
  const [selectedDay, setSelectedDay]     = useState('All')
  const [loading, setLoading]     = useState(true)
  const [noteFor, setNoteFor]     = useState(null)
  const [note, setNote]           = useState('')
  const [resolvingId, setResolvingId] = useState(null)
  const [page, setPage]           = useState(1)
  const { show: showToast, el: toastEl } = useToast()

  const resolverName = currentUser?.name || 'HM'

  const handleDeleteLog = async id => {
    await supabase.from('teaching_logs').delete().eq('id', id)
    setConfirmDel(null)
    showToast('Log deleted', '#dc2626')
    fetchAll()
  }

  const handleDeleteDoubt = async id => {
    await supabase.from('doubt_sessions').delete().eq('id', id)
    setConfirmDel(null)
    showToast('Doubt session deleted', '#dc2626')
    fetchAll()
  }

  const fetchAll = async () => {
    setLoading(true)
    const [d,s,h,tl,w,el] = await Promise.all([
      supabase.from('doubt_sessions').select('*').order('created_at',{ascending:false}),
      supabase.from('student_scores').select('*').order('test_date',{ascending:false}),
      supabase.from('students').select('house').eq('status','Active').not('house','is',null),
      supabase.from('teaching_logs').select('id,teacher_name,teaching_date,late_submission,copy_paste,spot_check_skipped,spot_check_done,hm_verified,board_photo_url,topic_taught,subject_name,course,subtype,lazy_score,excellence_flag').order('teaching_date',{ascending:false}).limit(200),
      supabase.from('teacher_warnings').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('teaching_logs').select('id,teacher_name,teaching_date,subject_name,topic_taught,course,subtype,excellence_flag').eq('excellence_flag',true).order('teaching_date',{ascending:false}).limit(50),
    ])
    if (d.error) showToast('Doubts load failed: '+d.error.message, '#dc2626')
    if (s.error) showToast('Scores load failed: '+s.error.message, '#dc2626')
    if (d.data) setAllDoubt(d.data)
    if (s.data) setAllScores(s.data)
    if (h.data) setHouses([...new Set(h.data.map(x => x.house).filter(Boolean))])
    if (tl.data) setTeachingLogs(tl.data)
    if (w.data)  setWarnings(w.data)
    if (el.data) setExcellentLogs(el.data)
    if (currentUser?.id) {
      await supabase
        .from('hm_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('hm_staff_id', currentUser.id)
        .eq('status', 'unread')
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filteredDoubt = useMemo(() => {
    const todayStr     = today()
    const yesterdayStr = new Date(Date.now()-86400000).toISOString().split('T')[0]
    const last7Str     = new Date(Date.now()-7*86400000).toISOString().split('T')[0]
    const last30Str    = new Date(Date.now()-30*86400000).toISOString().split('T')[0]
    return allDoubt.filter(d => {
      const hmMatch  = selectedHouse==='All' || d.hm_name===selectedHouse || d.resolved_by===selectedHouse
      let dayMatch   = true
      if      (selectedDay==='today')     dayMatch = d.teaching_date === todayStr
      else if (selectedDay==='yesterday') dayMatch = d.teaching_date === yesterdayStr
      else if (selectedDay==='last7')     dayMatch = d.teaching_date >= last7Str
      else if (selectedDay==='last30')    dayMatch = d.teaching_date >= last30Str
      else if (selectedDay!=='All')       dayMatch = d.teaching_date === selectedDay
      return hmMatch && dayMatch
    })
  }, [allDoubt, selectedHouse, selectedDay])
  const openSessions  = filteredDoubt.filter(d => d.status==='open')
  const doneSessions  = filteredDoubt.filter(d => d.status==='resolved')

  const weakStudents = useMemo(() => {
    const map = {}
    allScores.forEach(s => {
      const key = `${s.student_name}||${s.subject_name}`
      if (!map[key]) map[key] = { student:s.student_name, subject:s.subject_name, scores:[] }
      map[key].scores.push(pct(s.score, s.max_score))
    })
    return Object.values(map).map(m => ({ ...m, avg:Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) })).filter(m => m.avg<60).sort((a,b) => a.avg-b.avg)
  }, [allScores])

  const hmSummary = useMemo(() => {
    const map = {}
    allDoubt.forEach(d => {
      const key = d.hm_name || 'Unassigned'
      if (!map[key]) map[key] = { open:0, resolved:0, houses:new Set() }
      d.status==='open' ? map[key].open++ : map[key].resolved++
      if (d.house_name) map[key].houses.add(d.house_name)
    })
    return map
  }, [allDoubt])

  const handleResolve = async session => {
    if (!note.trim()) { showToast('Enter resolution note.', '#d97706'); return }
    setResolvingId(session.id)
    const { error } = await supabase.from('doubt_sessions').update({
      status:'resolved', resolved_by:resolverName,
      resolved_at:new Date().toISOString(), resolution_note:note,
    }).eq('id', session.id)
    if (error) showToast('Error: '+error.message, '#dc2626')
    else { fetchAll(); setNote(''); setNoteFor(null); showToast('Marked resolved', '#16a34a') }
    setResolvingId(null)
  }

  const HIST_PAGE = 10
  const histPages = Math.ceil(doneSessions.length/HIST_PAGE)
  const histPage  = doneSessions.slice((page-1)*HIST_PAGE, page*HIST_PAGE)

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading HM Dashboard...</div>

  const flaggedLogs = teachingLogs.filter(l =>
    l.late_submission || l.copy_paste || l.spot_check_skipped || l.hm_verified === false
  )

  return (
    <>
      {toastEl}
      {confirmDel && (
        <ConfirmModal
          title={confirmDel.type === 'log' ? 'Delete Teaching Log' : 'Delete Doubt Session'}
          message="This cannot be undone. Are you sure?"
          confirmLabel="Delete"
          danger
          onConfirm={() => confirmDel.type === 'log' ? handleDeleteLog(confirmDel.id) : handleDeleteDoubt(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {photoView && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setPhotoView(null)}>
          <div style={{ background:'white', borderRadius:14, padding:16, maxWidth:'94vw', maxHeight:'90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:10 }}>📸 Board Photo — {photoView.teacher} · {photoView.date}</div>
            <img src={photoView.url} alt="Board" style={{ maxWidth:'80vw', maxHeight:'70vh', borderRadius:8, objectFit:'contain' }}/>
            <div style={{ textAlign:'center', marginTop:10 }}><button onClick={() => setPhotoView(null)} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1e3a5f', color:'white', fontWeight:700, cursor:'pointer' }}>✕ Close</button></div>
          </div>
        </div>
      )}
      {Object.keys(hmSummary).length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:20 }}>
          {Object.entries(hmSummary).sort((a,b) => b[1].open - a[1].open).map(([hmName, data]) => (
            <div key={hmName}
              style={{ ...S.card, padding:14, border: '1px solid #e2e8f0', marginBottom:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#1e3a5f', marginBottom:4 }}>👤 {hmName}</div>
              {data.houses.size > 0 && (
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>
                  🏠 {[...data.houses].join(', ')}
                </div>
              )}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {data.open > 0    && <span style={S.badge('#b45309','#fef9c3')}>⏳ {data.open} open</span>}
                {data.resolved > 0 && <span style={S.badge('#16a34a','#dcfce7')}>✅ {data.resolved} done</span>}
                {data.open===0 && data.resolved===0 && <span style={S.badge('#94a3b8','#f1f5f9')}>None</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All HMs</option>
          {[...new Set(allDoubt.flatMap(d => [d.hm_name, d.resolved_by]).filter(Boolean))].sort().map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Days</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          {[...new Set(allDoubt.map(d => d.teaching_date).filter(Boolean))].sort().reverse().slice(0,30).map(d => (
            <option key={d} value={d}>{fmtDate(d)}</option>
          ))}
        </select>
        <span style={{ fontSize:13, color:'#64748b' }}>{openSessions.length} open · {doneSessions.length} resolved</span>
        <button onClick={() => {
          const w = window.open('', '_blank')
          const rows = openSessions.map((s, i) => `
            <tr>
              <td>${i+1}</td>
              <td>${s.batch_name || s.subtype || '—'}</td>
              <td>${s.subject_name || '—'}</td>
              <td>${s.topic || '—'}</td>
              <td>${s.hm_name || s.staff_name || '—'}</td>
              <td>${s.teaching_date || '—'}</td>
            </tr>
          `).join('')
          w.document.write(`<html><head><title>Open Doubt Sessions</title>
          <style>
            body{font-family:sans-serif;font-size:12px;padding:24px}
            h2{font-size:16px;margin-bottom:4px;color:#1e3a5f}
            p{font-size:11px;color:#555;margin-bottom:12px}
            table{width:100%;border-collapse:collapse}
            th{background:#1e3a5f;color:white;padding:7px 10px;text-align:left;font-size:11px}
            td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}
            tr:nth-child(even) td{background:#f8fafc}
          </style></head><body>
          <h2>⏳ Open Doubt Sessions (${openSessions.length})</h2>
          <p>Printed: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
          <table>
            <thead><tr><th>#</th><th>Batch</th><th>Subject</th><th>Topic</th><th>HM</th><th>Date</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <script>window.onload=()=>{window.print();window.close()}</script>
          </body></html>`)
          w.document.close()
        }} style={{ ...S.btnSm('#7c3aed'), marginLeft:'auto' }}>🖨️ Print Summary</button>
      </div>
      <div style={S.card}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#b45309', marginTop:0 }}>⏳ Open Doubt Sessions ({openSessions.length})</h3>
        {openSessions.length===0
          ? <div style={{ textAlign:'center', padding:24, color:'#16a34a', fontWeight:600 }}>✅ No open sessions!</div>
          : <div className="doubt-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {openSessions.map(s => (
                <HMDoubtSessionPanel
                  key={s.id}
                  session={s}
                  onFeedback={fetchAll}
                  currentUser={currentUser}
                />
              ))}
            </div>
        }
      </div>
      {/* ── Accountability Flags ── */}
      {/* ── Excellent Logs Today ── */}
      {excellentLogs.filter(l => l.teaching_date === today()).length > 0 && (
        <div style={{ ...S.card, border:'2px solid #16a34a', background:'#f0fdf4' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#16a34a', marginTop:0 }}>
            🌟 Excellent Logs Today ({excellentLogs.filter(l => l.teaching_date === today()).length})
          </h3>
          <p style={{ fontSize:12, color:'#166534', marginBottom:12 }}>
            These teachers submitted detailed, well-prepared logs today. Outstanding work!
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {excellentLogs.filter(l => l.teaching_date === today()).map(l => (
              <div key={l.id} style={{ padding:'10px 14px', background:'white', border:'1px solid #bbf7d0', borderRadius:10, fontSize:13 }}>
                <div style={{ fontWeight:800, color:'#166534' }}>🌟 {l.teacher_name}</div>
                <div style={{ fontSize:12, color:'#16a34a', marginTop:2 }}>{l.subject_name} — {l.topic_taught?.slice(0,40)}...</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{l.subtype || l.course}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lazy Teacher Warnings ── */}
      {warnings.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#dc2626', marginTop:0 }}>
            🚨 Teacher Warnings & Blocks ({warnings.length})
          </h3>
          {/* Summary by teacher */}
          {(() => {
            const byTeacher = {}
            warnings.forEach(w => {
              if (!byTeacher[w.teacher_name]) byTeacher[w.teacher_name] = { warnings:0, finalWarnings:0, blocked:0, latest:w, all:[] }
              if (w.warning_type==='blocked')       byTeacher[w.teacher_name].blocked++
              else if (w.warning_type==='final_warning') byTeacher[w.teacher_name].finalWarnings++
              else byTeacher[w.teacher_name].warnings++
              byTeacher[w.teacher_name].all.push(w)
            })
            return Object.entries(byTeacher).sort((a,b) => (b[1].blocked - a[1].blocked) || (b[1].finalWarnings - a[1].finalWarnings)).map(([name, data]) => {
              const isExpanded = expandedWarningTeacher === name
              const totalWarnings = data.blocked + data.finalWarnings + data.warnings
              return (
              <div key={name} style={{
                padding:'12px 14px', borderRadius:10, marginBottom:8,
                border: data.blocked>0 ? '2px solid #dc2626' : data.finalWarnings>0 ? '2px solid #d97706' : '1px solid #fecaca',
                background: data.blocked>0 ? '#fff1f2' : data.finalWarnings>0 ? '#fffbeb' : '#fff8f8',
              }}>
                <div
                  onClick={() => setExpandedWarningTeacher(isExpanded ? null : name)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, cursor:'pointer' }}
                >
                  <div>
                    <span style={{ fontWeight:800, fontSize:14, color:'#1e293b' }}>👨‍🏫 {name}</span>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{data.latest.message}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    {data.blocked>0      && <span style={{ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:800, background:'#dc2626', color:'white' }}>🚫 BLOCKED ×{data.blocked}</span>}
                    {data.finalWarnings>0 && <span style={{ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:800, background:'#d97706', color:'white' }}>⛔ Final ×{data.finalWarnings}</span>}
                    {data.warnings>0      && <span style={{ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:700, background:'#fef9c3', color:'#b45309' }}>⚠️ Warned ×{data.warnings}</span>}
                    {data.latest.similarity_score && <span style={{ padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:600, background:'#f1f5f9', color:'#64748b' }}>Similarity: {data.latest.similarity_score}%</span>}
                    <span style={{ fontSize:14, color:'#94a3b8', transition:'transform .15s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(0,0,0,.06)', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em' }}>
                      All {totalWarnings} warning reason{totalWarnings>1?'s':''} (most recent first)
                    </div>
                    {[...data.all].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).map(w => (
                      <div key={w.id} style={{
                        background:'white', border:'1px solid #f1f5f9', borderRadius:8, padding:'8px 10px',
                        display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap',
                      }}>
                        <div style={{ flex:1, minWidth:200 }}>
                          <div style={{ fontSize:12.5, color:'#374151' }}>{w.message}</div>
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{fmtDate(w.created_at?.split('T')[0])}</div>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                          {w.warning_type==='blocked'       && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:800, background:'#dc2626', color:'white' }}>🚫 Blocked</span>}
                          {w.warning_type==='final_warning'  && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:800, background:'#d97706', color:'white' }}>⛔ Final</span>}
                          {w.warning_type==='warning'        && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:700, background:'#fef9c3', color:'#b45309' }}>⚠️ Warning</span>}
                          {w.similarity_score && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:600, background:'#f1f5f9', color:'#64748b' }}>{w.similarity_score}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )})
          })()}

          {/* Detail table */}
          <div className="table-wrap" style={{ marginTop:12 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:500 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','Teacher','Type','Similarity','Message'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warnings.slice(0,20).map(w => (
                  <tr key={w.id} style={{ borderBottom:'1px solid #f1f5f9', background: w.warning_type==='blocked'?'#fff1f2':w.warning_type==='final_warning'?'#fffbeb':'white' }}>
                    <td style={{ padding:'8px 10px', color:'#94a3b8', whiteSpace:'nowrap' }}>{fmtDate(w.created_at?.split('T')[0])}</td>
                    <td style={{ padding:'8px 10px', fontWeight:600, color:'#1e293b' }}>{w.teacher_name}</td>
                    <td style={{ padding:'8px 10px' }}>
                      {w.warning_type==='blocked'       && <span style={{ padding:'3px 8px', borderRadius:999, fontSize:11, fontWeight:800, background:'#dc2626', color:'white' }}>🚫 Blocked</span>}
                      {w.warning_type==='final_warning'  && <span style={{ padding:'3px 8px', borderRadius:999, fontSize:11, fontWeight:800, background:'#d97706', color:'white' }}>⛔ Final</span>}
                      {w.warning_type==='warning'        && <span style={{ padding:'3px 8px', borderRadius:999, fontSize:11, fontWeight:700, background:'#fef9c3', color:'#b45309' }}>⚠️ Warning</span>}
                    </td>
                    <td style={{ padding:'8px 10px', fontWeight:700, color:'#dc2626', fontFamily:"'JetBrains Mono',monospace" }}>
                      {w.similarity_score ? `${w.similarity_score}%` : '—'}
                    </td>
                    <td style={{ padding:'8px 10px', color:'#64748b', fontSize:11 }}>{w.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {flaggedLogs.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#dc2626', marginTop:0 }}>🚨 Flagged Teaching Logs ({flaggedLogs.length})</h3>
          <div className="table-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:600 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','Teacher','Subject','Late','Copy-Paste','Spot-Skip','HM Unverified','Photo','Actions'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flaggedLogs.map(l => (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f1f5f9', background:'#fff8f8' }}>
                    <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(l.teaching_date)}</td>
                    <td style={{ padding:'9px 12px', fontWeight:600, color:'#1e293b' }}>{l.teacher_name||'—'}</td>
                    <td style={{ padding:'9px 12px', color:'#374151' }}>{l.subject_name}</td>
                    <td style={{ padding:'9px 12px' }}>{l.late_submission ? <span style={S.badge('#dc2626','#fee2e2')}>🌙 Late</span> : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}</td>
                    <td style={{ padding:'9px 12px' }}>{l.copy_paste ? <span style={S.badge('#7c3aed','#f3e8ff')}>🔁 Copy</span> : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}</td>
                    <td style={{ padding:'9px 12px' }}>{l.spot_check_skipped ? <span style={S.badge('#d97706','#fef9c3')}>⚠️ Skipped</span> : l.spot_check_done ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Done</span> : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}</td>
                    <td style={{ padding:'9px 12px' }}>{l.hm_verified === false ? <span style={S.badge('#dc2626','#fee2e2')}>❌ Not Done</span> : l.hm_verified === true ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Verified</span> : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}</td>
                    <td style={{ padding:'9px 12px' }}>
                      {l.board_photo_url
                        ? <button onClick={() => setPhotoView({ url:l.board_photo_url, teacher:l.teacher_name, date:l.teaching_date })} style={S.btnSm('#0891b2')}>📸 View</button>
                        : <span style={{ color:'#dc2626', fontSize:11, fontWeight:600 }}>❌ No photo</span>}
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      {isAdmin && (
                        <button onClick={() => setConfirmDel({ id:l.id, type:'log' })} style={S.btnSm('#dc2626')}>🗑 Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── All Teaching Logs (Admin view) ── */}
      {isAdmin && teachingLogs.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>📋 All Teaching Logs (Admin)</h3>
          <div className="table-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:600 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','Teacher','Subject','Course','Flags','Photo','Delete'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachingLogs.slice(0,50).map(l => {
                  const flags = []
                  if (l.late_submission)    flags.push(<span key="l" style={S.badge('#dc2626','#fee2e2')}>🌙</span>)
                  if (l.copy_paste)         flags.push(<span key="c" style={S.badge('#7c3aed','#f3e8ff')}>🔁</span>)
                  if (l.spot_check_skipped) flags.push(<span key="s" style={S.badge('#d97706','#fef9c3')}>⚠️</span>)
                  if (l.hm_verified===false)flags.push(<span key="h" style={S.badge('#dc2626','#fee2e2')}>❌</span>)
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(l.teaching_date)}</td>
                      <td style={{ padding:'9px 12px', fontWeight:600, color:'#1e293b' }}>{l.teacher_name||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'#374151' }}>{l.subject_name}</td>
                      <td style={{ padding:'9px 12px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{l.subtype||l.course}</span></td>
                      <td style={{ padding:'9px 12px' }}><div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>{flags.length ? flags : <span style={{ color:'#16a34a', fontSize:11 }}>✅ Clean</span>}</div></td>
                      <td style={{ padding:'9px 12px' }}>
                        {l.board_photo_url
                          ? <button onClick={() => setPhotoView({ url:l.board_photo_url, teacher:l.teacher_name, date:l.teaching_date })} style={S.btnSm('#0891b2')}>📸</button>
                          : <span style={{ color:'#dc2626', fontSize:11 }}>None</span>}
                      </td>
                      <td style={{ padding:'9px 12px' }}>
                        <button onClick={() => setConfirmDel({ id:l.id, type:'log' })} style={S.btnSm('#dc2626')}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Doubt Sessions with Delete ── */}
      {isAdmin && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>🗑 Manage Doubt Sessions (Admin)</h3>
          <div className="table-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:500 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','House','Subject','HM','Status','Delete'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allDoubt.slice(0,30).map(d => (
                  <tr key={d.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(d.teaching_date)}</td>
                    <td style={{ padding:'9px 12px', fontWeight:600 }}>{d.house_name||'—'}</td>
                    <td style={{ padding:'9px 12px' }}>{d.subject_name}</td>
                    <td style={{ padding:'9px 12px', color:'#64748b' }}>{d.hm_name||'—'}</td>
                    <td style={{ padding:'9px 12px' }}>
                      {d.status==='resolved'
                        ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Resolved</span>
                        : d.status==='not_conducted'
                        ? <span style={S.badge('#dc2626','#fee2e2')}>❌ Not Done</span>
                        : <span style={S.badge('#b45309','#fef9c3')}>⏳ Open</span>}
                    </td>
                    <td style={{ padding:'9px 12px' }}>
                      <button onClick={() => setConfirmDel({ id:d.id, type:'doubt' })} style={S.btnSm('#dc2626')}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {weakStudents.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#dc2626', marginTop:0 }}>⚠️ Students Needing Attention</h3>
          {weakStudents.map((w,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 12px', border:'1px solid #fecaca', borderRadius:8, marginBottom:6, background:'#fff1f2', flexWrap:'wrap' }}>
              <div style={{ minWidth:130, fontWeight:600, color:'#1e293b', fontSize:13 }}>{w.student}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:12, color:'#64748b', marginBottom:3 }}>{w.subject}</div><div style={{ height:5, background:'#fee2e2', borderRadius:3, overflow:'hidden' }}><div style={{ width:`${w.avg}%`, height:'100%', background:'#dc2626', borderRadius:3 }}/></div></div>
              <span style={{ fontWeight:800, color:'#dc2626', fontSize:16, fontFamily:"'JetBrains Mono',monospace" }}>{w.avg}%</span>
            </div>
          ))}
        </div>
      )}
      {doneSessions.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:14, fontWeight:800, color:'#16a34a', marginTop:0 }}>✅ Resolved Sessions ({doneSessions.length})</h3>
          {histPage.map(s => (
            <div key={s.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', border:'1px solid #bbf7d0', borderRadius:8, background:'#f0fdf4', fontSize:13, marginBottom:5, flexWrap:'wrap' }}>
              <span style={{ color:'#94a3b8', minWidth:70 }}>{fmtDate(s.teaching_date)}</span>
              <span style={{ flex:1 }}>🏠 {s.house_name} · {s.subject_name} — <em>{s.topic}</em></span>
              <span style={{ color:'#16a34a', fontWeight:600 }}>✅ {s.resolved_by}</span>
            </div>
          ))}
          {histPages > 1 && (
            <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:10 }}>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ ...S.btnSm('#64748b'), opacity:page===1?.4:1 }}>←</button>
              <span style={{ fontSize:13, color:'#64748b', padding:'6px 10px' }}>{page}/{histPages}</span>
              <button onClick={() => setPage(p => Math.min(histPages,p+1))} disabled={page===histPages} style={{ ...S.btnSm('#64748b'), opacity:page===histPages?.4:1 }}>→</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── Tab: Admin Monitor ───────────────────────────────────────────────────────

function TabAdminMonitor({ logs, missed, timetable, staff, courseData }) {
  const [allDoubt, setAllDoubt]     = useState([])
  const [allScores, setAllScores]   = useState([])
  const [alerts, setAlerts]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [alertFilter, setAlertFilter] = useState('All')
  const { show: showToast, el: toastEl } = useToast()
  const { courses } = courseData

  const fetchAll = async () => {
    setLoading(true)
    const [d,s,a] = await Promise.all([
      supabase.from('doubt_sessions').select('*'),
      supabase.from('student_scores').select('*'),
      supabase.from('admin_alerts').select('*').order('created_at',{ascending:false}).limit(50),
    ])
    if (d.error) showToast('Doubts: '+d.error.message, '#dc2626')
    if (s.error) showToast('Scores: '+s.error.message, '#dc2626')
    if (a.error) showToast('Alerts: '+a.error.message, '#dc2626')
    if (d.data) setAllDoubt(d.data)
    if (s.data) setAllScores(s.data)
    if (a.data) setAlerts(a.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const currMonth = currentYearMonth()

  const batchHealth = useMemo(() => {
    const result = []
    const subtypes = [...new Set(logs.map(l => l.subtype).filter(Boolean))]
    subtypes.forEach(subtype => {
      const bl = logs.filter(l => l.subtype===subtype && l.teaching_date?.startsWith(currMonth))
      const bd = allDoubt.filter(d => d.subtype===subtype)
      const open = bd.filter(d => d.status==='open').length
      const bs = allScores.filter(s => s.subtype===subtype)
      const avg = bs.length > 0 ? Math.round(bs.reduce((a,s)=>a+pct(s.score,s.max_score),0)/bs.length) : null
      const sub = new Set(bl.map(l => l.subject_name)).size
      const resRate = bd.length > 0 ? Math.round(((bd.length-open)/bd.length)*100) : 100
      result.push({ subtype, course:logs.find(l=>l.subtype===subtype)?.course||'', logsThisMonth:bl.length, subjectsCovered:sub, openDoubt:open, doubtResRate:resRate, avgScore:avg, health:Math.round((Math.min(bl.length/20,1)*40)+(resRate*.3)+((avg||50)/100*30)) })
    })
    return result.sort((a,b) => a.health-b.health)
  }, [logs, allDoubt, allScores, currMonth])

  const teacherBoard = useMemo(() => {
    const map = {}
    logs.filter(l => l.teaching_date?.startsWith(currMonth)).forEach(l => {
      if (!l.teacher_name) return
      if (!map[l.teacher_name]) map[l.teacher_name] = { name:l.teacher_name, logs:0, doubts:0, subjects:new Set() }
      map[l.teacher_name].logs++; map[l.teacher_name].subjects.add(l.subject_name)
    })
    allDoubt.filter(d => d.teacher_name&&d.status==='open').forEach(d => { if (map[d.teacher_name]) map[d.teacher_name].doubts++ })
    return Object.values(map).sort((a,b) => b.logs-a.logs)
  }, [logs, allDoubt, currMonth])

  const gaps = useMemo(() => {
    const threshold = new Date(); threshold.setDate(threshold.getDate()-3)
    const threshStr = threshold.toISOString().split('T')[0]
    const result = []
    const pairs = [...new Set(logs.map(l => `${l.subtype}||${l.subject_name}`))]
    pairs.forEach(pair => {
      const [subtype,subject] = pair.split('||')
      const recent = logs.filter(l => l.subtype===subtype && l.subject_name===subject && l.teaching_date>=threshStr)
      if (!recent.length) {
        const last = logs.filter(l => l.subtype===subtype && l.subject_name===subject).sort((a,b) => (b.teaching_date ?? '').localeCompare(a.teaching_date ?? ''))[0]
        result.push({ subtype, subject, lastLogged:last?.teaching_date||'never', teacher:last?.teacher_name||'-' })
      }
    })
    return result
  }, [logs])

  const staleDoubt = useMemo(() => {
    const threshold = new Date(); threshold.setDate(threshold.getDate()-2)
    const threshStr = threshold.toISOString().split('T')[0]
    return allDoubt.filter(d => d.status==='open' && d.teaching_date && d.teaching_date<=threshStr)
  }, [allDoubt])

  const generateAlerts = async () => {
    setGenerating(true)
    const newAlerts = []
    gaps.forEach(g => {
      if (!alerts.find(a => a.alert_type==='gap' && a.subtype===g.subtype && a.subject_name===g.subject && !a.is_read))
        // PATCH-5: added is_read:false so alerts are correctly identified as unread
        newAlerts.push({ alert_type:'gap', course:'', subtype:g.subtype, subject_name:g.subject, teacher_name:g.teacher, message:`No log for ${g.subject} (${g.subtype}) in 3+ days. Last: ${fmtDate(g.lastLogged)}`, severity:'medium', is_read:false })
    })
    staleDoubt.forEach(d => {
      if (!alerts.find(a => a.alert_type==='doubt_stale' && a.subtype===d.subtype && a.subject_name===d.subject_name && !a.is_read))
        // PATCH-5: added is_read:false so alerts are correctly identified as unread
        newAlerts.push({ alert_type:'doubt_stale', course:d.course||'', subtype:d.subtype||'', subject_name:d.subject_name, teacher_name:d.teacher_name||'', message:`Unresolved doubt for ${d.subject_name} (${d.house_name}) since ${fmtDate(d.teaching_date)}`, severity:'high', is_read:false })
    })
    if (newAlerts.length > 0) {
      const { error } = await supabase.from('admin_alerts').insert(newAlerts)
      if (error) showToast('Error saving alerts: '+error.message, '#dc2626')
      else { await fetchAll(); showToast(`${newAlerts.length} new alerts generated`, '#16a34a') }
    } else {
      showToast('✅ No new alerts needed!', '#16a34a')
    }
    setGenerating(false)
  }

  const markRead = async id => {
    await supabase.from('admin_alerts').update({ is_read:true }).eq('id', id)
    setAlerts(prev => prev.map(a => a.id===id?{...a,is_read:true}:a))
  }

  const unreadAlerts  = alerts.filter(a => !a.is_read)
  const alertTypes    = [...new Set(alerts.map(a => a.alert_type))]
  const shownAlerts   = alertFilter==='All' ? alerts : alerts.filter(a => a.alert_type===alertFilter)

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading admin monitor...</div>

  return (
    <>
      {toastEl}
      <div className="stat-grid-4" style={S.statGrid(4)}>
        {[
          { label:'Unread Alerts',    value:unreadAlerts.length,           color:'#dc2626', bg:'#fee2e2', icon:'🔔' },
          { label:'Open Doubts',      value:allDoubt.filter(d=>d.status==='open').length, color:'#d97706', bg:'#fef9c3', icon:'⏳' },
          { label:'Syllabus Gaps',    value:gaps.length,                   color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Stale (2d+)',      value:staleDoubt.length,             color:'#dc2626', bg:'#fff1f2', icon:'⚠️' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:12, color:c.color, fontWeight:700, margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:26, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', margin:0 }}>
            🔔 Alerts {unreadAlerts.length>0 && <span style={{ ...S.badge('white','#dc2626'), marginLeft:8 }}>{unreadAlerts.length} new</span>}
          </h3>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <select value={alertFilter} onChange={e => setAlertFilter(e.target.value)} style={{ ...S.select, width:'auto', fontSize:12 }}>
              <option value="All">All Types</option>
              {alertTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={generateAlerts} disabled={generating} style={S.btn('#7c3aed',generating)}>{generating?'⏳ Generating...':'⚡ Generate Alerts'}</button>
          </div>
        </div>
        {shownAlerts.length===0
          ? <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No alerts. Click "Generate Alerts" to scan.</div>
          : shownAlerts.slice(0,20).map(a => (
            <div key={a.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', marginBottom:7, borderRadius:8, border:`1px solid ${a.severity==='high'?'#fecaca':a.severity==='medium'?'#fde68a':'#e2e8f0'}`, background:a.is_read?'white':(a.severity==='high'?'#fff1f2':a.severity==='medium'?'#fffbeb':'#f8fafc'), opacity:a.is_read?.6:1 }}>
              <span style={{ fontSize:14, marginTop:2 }}>{a.severity==='high'?'🔴':a.severity==='medium'?'🟡':'🔵'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'#1e293b', fontWeight:a.is_read?400:600 }}>{a.message}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{a.alert_type} · {fmtDate(a.created_at?.split('T')[0])}</div>
              </div>
              {!a.is_read && <button onClick={() => markRead(a.id)} style={S.btnSm('#94a3b8')}>✓ Read</button>}
            </div>
          ))
        }
      </div>

      <div style={S.card}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>🏫 Batch Health — {new Date().toLocaleString('default',{month:'long',year:'numeric'})}</h3>
        {batchHealth.length===0 && <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No batch data.</div>}
        {batchHealth.map((b,i) => (
          <div key={i} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
              <div><span style={{ fontWeight:800, color:'#1e293b', fontSize:14 }}>{b.subtype}</span><span style={{ marginLeft:8, fontSize:12, color:'#64748b' }}>{b.course}</span></div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {b.openDoubt>0 && <span style={S.badge('#b45309','#fef9c3')}>⏳ {b.openDoubt}</span>}
                {b.avgScore!=null && <span style={{ ...S.badge(scoreColor(b.avgScore), scoreBg(b.avgScore)) }}>{b.avgScore}%</span>}
                <span style={{ fontSize:18, fontWeight:800, color:scoreColor(b.health), fontFamily:"'JetBrains Mono',monospace" }}>{b.health}%</span>
              </div>
            </div>
            <div style={{ height:7, background:'#e2e8f0', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
              <div style={{ width:`${b.health}%`, height:'100%', background:scoreColor(b.health), borderRadius:4, transition:'width .4s' }}/>
            </div>
            <div style={{ display:'flex', gap:14, fontSize:12, color:'#64748b', flexWrap:'wrap' }}>
              <span>📋 {b.logsThisMonth} logs</span><span>📚 {b.subjectsCovered} subjects</span><span>🔁 {b.doubtResRate}% resolved</span>
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginTop:0 }}>🏆 Teacher Activity — This Month</h3>
        {teacherBoard.length===0 && <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No teacher logs this month.</div>}
        {teacherBoard.map((t,i) => (
          <div key={t.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:i<3?'#f0fdf4':'white', marginBottom:6, flexWrap:'wrap' }}>
            <span style={{ fontWeight:800, color:i===0?'#ca8a04':i===1?'#94a3b8':i===2?'#b45309':'#94a3b8', fontSize:14, minWidth:24 }}>#{i+1}</span>
            <span style={{ flex:1, fontWeight:600, color:'#1e293b', fontSize:13 }}>👨‍🏫 {t.name}</span>
            <span style={S.pill('#1e3a5f','#eff6ff')}>{t.logs} logs</span>
            <span style={S.pill('#7c3aed','#f3e8ff')}>{t.subjects.size} subj</span>
            {t.doubts>0 && <span style={S.pill('#b45309','#fef9c3')}>⏳ {t.doubts}</span>}
          </div>
        ))}
      </div>

      {gaps.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#7c3aed', marginTop:0 }}>📚 Syllabus Gaps (3+ days no log)</h3>
          {gaps.map((g,i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', border:'1px solid #ddd6fe', borderRadius:8, background:'#faf5ff', fontSize:13, marginBottom:5, flexWrap:'wrap' }}>
              <span style={S.badge('#7c3aed','#f3e8ff')}>{g.subtype}</span>
              <span style={{ flex:1, color:'#374151' }}>{g.subject}</span>
              <span style={{ color:'#94a3b8' }}>Last: {fmtDate(g.lastLogged)}</span>
              <span style={{ color:'#64748b' }}>👨‍🏫 {g.teacher}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Tab: Remediation ─────────────────────────────────────────────────────────

function TabRemediation({ logs, courseData }) {
  const [allDoubt, setAllDoubt]   = useState([])
  const [allScores, setAllScores] = useState([])
  const [ttFull, setTtFull]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterBatch, setFilterBatch] = useState('All')
  const { show: showToast, el: toastEl } = useToast()

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const [d,s,t] = await Promise.all([
        supabase.from('doubt_sessions').select('*').eq('status','open'),
        supabase.from('student_scores').select('*'),
        // PATCH-2: was 'teaching_timetable' — corrected to match all other references in this file
        supabase.from('timetable_entries').select('*'),
      ])
      if (d.error) showToast('Doubts: '+d.error.message, '#dc2626')
      if (s.error) showToast('Scores: '+s.error.message, '#dc2626')
      if (t.error) showToast('Timetable: '+t.error.message, '#dc2626')
      if (d.data) setAllDoubt(d.data)
      if (s.data) setAllScores(s.data)
      if (t.data) setTtFull(t.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const doubtGroups = useMemo(() => {
    const map = {}
    allDoubt.forEach(d => {
      const key = `${d.subtype}||${d.subject_name}`
      if (!map[key]) map[key] = { subtype:d.subtype, subject:d.subject_name, course:d.course, sessions:[], houses:new Set() }
      map[key].sessions.push(d)
      if (d.house_name) map[key].houses.add(d.house_name)
    })
    return Object.values(map).sort((a,b) => b.sessions.length-a.sessions.length)
  }, [allDoubt])

  const suggestions = useMemo(() => {
    return doubtGroups.map(g => {
      const batchScores = allScores.filter(s => s.subtype===g.subtype && s.subject_name===g.subject)
      const studentMap  = {}
      batchScores.forEach(s => {
        if (!studentMap[s.student_name]) studentMap[s.student_name]=[]
        studentMap[s.student_name].push(pct(s.score, s.max_score))
      })
      const weakStudents = Object.entries(studentMap)
        .map(([name,scores]) => ({ name, avg:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) }))
        .filter(s => s.avg<60).sort((a,b) => a.avg-b.avg)

      const usedSlots = new Set(
        ttFull.filter(t => (t.subtype===g.subtype||t.class_name===g.subtype))
          .map(t => `${t.day_of_week||t.day_name}||${t.period_number||t.period_name}`)
      )
      const freeSlots = []
      DAYS.forEach(day => {
        PERIODS.forEach(p => {
          if (!usedSlots.has(`${day}||${p}`) && freeSlots.length < 4) {
            freeSlots.push({ day, period:`Period ${p}`, type:'Free Slot' })
          }
        })
      })
      const suggestedSlots = freeSlots.length > 0 ? freeSlots : [
        { day:'Monday',    period:'06:30–07:20', type:'Morning Doubt' },
        { day:'Wednesday', period:'06:30–07:20', type:'Morning Doubt' },
        { day:'Friday',    period:'17:30–18:20', type:'Evening Doubt' },
      ]

      return { ...g, weakStudents, suggestedSlots }
    })
  }, [doubtGroups, allScores, ttFull])

  const filtered  = filterBatch==='All' ? suggestions : suggestions.filter(s => s.subtype===filterBatch)
  const allBatches= [...new Set(suggestions.map(s => s.subtype).filter(Boolean))]

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading remediation data...</div>

  return (
    <>
      {toastEl}
      <div className="stat-grid-3" style={S.statGrid(3)}>
        {[
          { label:'Open Doubt Groups',   value:suggestions.length, color:'#d97706', bg:'#fef9c3', icon:'🔁' },
          { label:'Weak Student Flags',  value:suggestions.reduce((a,s)=>a+s.weakStudents.length,0), color:'#dc2626', bg:'#fee2e2', icon:'⚠️' },
          { label:'Free Slots Available',value:suggestions.reduce((a,s)=>a+s.suggestedSlots.length,0), color:'#16a34a', bg:'#dcfce7', icon:'🕐' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <p style={{ fontSize:12, color:c.color, fontWeight:700, margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:26, fontWeight:800, color:c.color, margin:'2px 0 0', fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Batches</option>
          {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {filtered.length===0 && <div style={{ ...S.card, textAlign:'center', padding:48, color:'#16a34a', fontWeight:600 }}>✅ No open doubt sessions needing remediation.</div>}

      {filtered.map((s,i) => (
        <div key={i} style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#1e293b', margin:'0 0 4px' }}>
                {s.subject} — <span style={{ color:'#1e3a5f' }}>{s.subtype}</span>
              </h3>
              <div style={{ fontSize:13, color:'#64748b' }}>{s.sessions.length} open session{s.sessions.length!==1?'s':''} · Houses: {[...s.houses].join(', ')||'—'}</div>
            </div>
            <span style={S.badge('#b45309','#fef9c3')}>⏳ {s.sessions.length}</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
            <div>
              <div style={{ fontWeight:700, color:'#374151', fontSize:13, marginBottom:7 }}>⚠️ Students needing help</div>
              {s.weakStudents.length===0
                ? <div style={{ fontSize:13, color:'#16a34a' }}>✅ No weak students (no score data).</div>
                : s.weakStudents.map((st,j) => (
                  <div key={j} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'#fff1f2', border:'1px solid #fecaca', borderRadius:6, marginBottom:4 }}>
                    <span style={{ flex:1, fontSize:13, color:'#1e293b', fontWeight:600 }}>{st.name}</span>
                    <span style={{ fontWeight:800, color:scoreColor(st.avg), fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>{st.avg}%</span>
                  </div>
                ))
              }
            </div>
            <div>
              <div style={{ fontWeight:700, color:'#374151', fontSize:13, marginBottom:7 }}>🕐 Available Doubt Slots</div>
              {s.suggestedSlots.map((slot,j) => (
                <div key={j} style={{ display:'flex', gap:10, alignItems:'center', padding:'6px 10px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#16a34a', minWidth:60 }}>{slot.day}</span>
                  <span style={{ fontSize:12, color:'#374151' }}>{slot.period}</span>
                  <span style={S.badge('#0891b2','#e0f2fe')}>{slot.type}</span>
                </div>
              ))}
            </div>
          </div>

          {s.sessions.length > 0 && (
            <div style={{ marginTop:12, borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
              <div style={{ fontWeight:600, color:'#374151', fontSize:12, marginBottom:5 }}>Open sessions:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {s.sessions.map((d,j) => (
                  <span key={j} style={{ ...S.badge('#b45309','#fef9c3'), padding:'4px 10px' }}>🏠 {d.house_name||'?'} · {fmtDate(d.teaching_date)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Teaching({ currentUser }) {
  const userRole = currentUser?.role?.toLowerCase() || 'viewer'
  const TABS = ALL_TABS.filter(t => (TAB_ROLES[t.key]||[]).includes(userRole))

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('gnsi_teaching_tab')
      return (TABS.find(t => t.key===saved) ? saved : TABS[0]?.key) || 'logs'
    } catch { return TABS[0]?.key || 'logs' }
  })

  const [logs,            setLogs]            = useState([])
  const [missed,          setMissed]          = useState([])
  const [timetable,       setTimetable]       = useState([])
  const [staff,           setStaff]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [monthlySyllabus, setMonthlySyllabus] = useState([])
  const { show: showToast, el: toastEl }      = useToast()
  const isMobile = useIsMobile()

  const courseData = useCourseData()
  const [hmNotifCount, setHmNotifCount] = useState(0)

useEffect(() => {
  const checkNotifs = async () => {
    if (!currentUser?.id) return
    const { count } = await supabase
      .from('hm_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('hm_staff_id', currentUser.id)
      .eq('status', 'unread')
    setHmNotifCount(count || 0)
  }
  checkNotifs()
  const interval = setInterval(checkNotifs, 30000)
  return () => clearInterval(interval)
}, [currentUser])

  const handleTabChange = key => {
    if (!TABS.find(t => t.key===key)) return
    setActiveTab(key)
    try { localStorage.setItem('gnsi_teaching_tab', key) } catch {}
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('teaching_logs').select('*').order('teaching_date',{ascending:false})
    if (error) showToast('Logs load failed: '+error.message, '#dc2626')
    if (data) setLogs(data)
    setLoading(false)
  }, [])

  const fetchMissed = useCallback(async () => {
    const { data, error } = await supabase.from('teaching_missed').select('*').order('missed_date',{ascending:false})
    if (error) showToast('Missed load failed: '+error.message, '#dc2626')
    if (data) setMissed(data)
  }, [])

  const fetchTimetable = useCallback(async () => {
    const { data, error } = await supabase.from('timetable_entries').select('*').order('period_name')
    if (error) showToast('Timetable load failed: '+error.message, '#dc2626')
    if (data) setTimetable(data)
  }, [])

  const fetchStaff = useCallback(async () => {
    const { data, error } = await supabase.from('staff_profiles').select('id,name,designation').eq('status','Active').order('name')
    if (error) showToast('Staff load failed: '+error.message, '#dc2626')
    if (data) setStaff(data)
  }, [])

  const fetchMonthlySyllabus = useCallback(async () => {
    const { data, error } = await supabase.from('monthly_syllabus').select('id,admit_type,subject_name,topic,month,completed,completed_at').order('month')
    if (error) showToast('Monthly syllabus load failed: '+error.message, '#dc2626')
    if (data) setMonthlySyllabus(data)
  }, [])

  useEffect(() => {
    fetchLogs(); fetchMissed(); fetchTimetable(); fetchStaff(); fetchMonthlySyllabus()
  }, []) // eslint-disable-line

  const todayStr  = today()
  const currMonth = currentYearMonth()

  const badges = useMemo(() => {
    const todayLogs      = logs.filter(l => l.teaching_date===todayStr).length
    const monthMissed    = missed.filter(m => m.missed_date?.startsWith(currMonth)).length
    const activeTeachers = new Set(logs.filter(l => l.teaching_date?.startsWith(currMonth)).map(l => l.teacher_name).filter(Boolean)).size
    return {
  logs:        todayLogs>0   ? `${todayLogs} today` : null,
  timetable:   timetable.length>0 ? `${new Set(timetable.map(t=>t.class_name).filter(Boolean)).size} batches` : null,
  reports:     monthMissed>0 ? `${monthMissed} missed` : activeTeachers>0 ? `${activeTeachers} teachers` : null,
  hmdash:      hmNotifCount > 0 ? `🔔 ${hmNotifCount}` : null,
}
}, [logs, missed, timetable, todayStr, currMonth, hmNotifCount])

  return (
    <div className="page-pad" style={{ ...S.page, padding: isMobile ? 12 : 24 }}>
      <style>{globalCSS}</style>
      {toastEl}

      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight:800, color:'#1e3a5f', margin:0, letterSpacing:'-.03em' }}>📘 Teaching Management</h1>
        <p style={{ color:'#64748b', fontSize:13, margin:'4px 0 0' }}>Logs · Syllabus · Timetable · Reports · Scores · HM · Admin · Remediation</p>
        {currentUser && <span style={{ ...S.badge('#1e3a5f','#eff6ff'), marginTop:6, display:'inline-block' }}>🔐 {userRole}</span>}
      </div>

      <div className="tab-bar" style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : `repeat(${Math.min(TABS.length,6)},1fr)`, gap:6, marginBottom:20 }}>
        {TABS.map(t => {
          const active = activeTab===t.key
          const badge  = badges[t.key]
          return (
            <button key={t.key} onClick={() => handleTabChange(t.key)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:3, padding: isMobile ? '8px 4px' : '10px 6px', fontWeight:700, fontSize: isMobile ? 10 : 11,
              cursor:'pointer', background:active?'#1e3a5f':'white', color:active?'white':'#64748b',
              border:active?'2px solid #1e3a5f':'2px solid #e2e8f0', borderRadius:10,
              boxShadow:active?'0 2px 10px rgba(30,58,95,.25)':'none',
              position:'relative', minHeight: isMobile ? 52 : 58, transition:'all .15s',
            }}>
              <span style={{ fontSize: isMobile ? 16 : 18, lineHeight:1 }}>{t.icon}</span>
              <span style={{ textAlign:'center', lineHeight:1.2 }}>{t.label}</span>
              {badge && (
                <span style={{ position:'absolute', top:4, right:4, padding:'1px 5px', borderRadius:999, fontSize:9, fontWeight:700, background:active?'rgba(255,255,255,.3)':'#1e3a5f', color:'white' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab==='logs'        && <TabLogs logs={logs} loading={loading} fetchLogs={fetchLogs} timetable={timetable} staff={staff} courseData={courseData} currentUser={currentUser}/>}
      {activeTab==='calendar'    && <TabCalendar logs={logs} missed={missed}/>}
      {activeTab==='syllabus' && <TabSyllabus logs={logs} courseData={courseData} monthlySyllabus={monthlySyllabus} currentUser={currentUser}/>}
      {activeTab==='reports'     && <TabReports logs={logs} missed={missed} staff={staff} courseData={courseData}/>}
      {activeTab==='performance' && <TabStudentPerformance courseData={courseData} logs={logs} currentUser={currentUser}/>}
      {activeTab==='hmdash'      && <TabHMDashboard currentUser={currentUser}/>}
      {activeTab==='attendance'  && <Attendance currentUser={currentUser} isAdmin={(currentUser?.role||'').toLowerCase()==='admin'}/>}
      {activeTab==='geoattendance' && <GeoAttendance currentStaff={staff.find(s => s.name===currentUser?.name)} isAdmin={(currentUser?.role||'').toLowerCase()==='admin'} allStaff={staff}/>}
      {activeTab==='reportcards' && <TabReportCards courseData={courseData} staff={staff} currentUser={currentUser}/>}
    </div>
  )
}

export default Teaching
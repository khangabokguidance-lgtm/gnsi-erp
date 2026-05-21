import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import TabMonthlySyllabus from './TabMonthlySyllabus'
import { staffDB, useStaffDB } from './staffDB'

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II', 'English Grammar', 'General Knowledge', 'General Science',
  'Reasoning', 'Mental Ability', 'Hindi',
  'Vocabulary', 'Meitei Mayek',
]

const DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7]

const TABS = [
  { key: 'logs',        label: 'Daily Logs',        icon: '📋' },
  { key: 'calendar',   label: 'Calendar',           icon: '📅' },
  { key: 'syllabus',   label: 'Syllabus',           icon: '📊' },
  { key: 'timetable',  label: 'Timetable',          icon: '🕐' },
  { key: 'reports',    label: 'Reports',            icon: '📈' },
  { key: 'search',     label: 'Topic Search',       icon: '🔍' },
  { key: 'monthly',    label: 'Monthly Syllabus',   icon: '📆' },
  { key: 'performance',label: 'Student Scores',     icon: '🎯' },
  { key: 'hmdash',     label: 'HM Dashboard',       icon: '🏠' },
  { key: 'admin',      label: 'Admin Monitor',      icon: '🛡️' },
  { key: 'remediation',label: 'Remediation',        icon: '🔄' },
]

const today            = () => new Date().toISOString().split('T')[0]
const currentYearMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const fmtDate          = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
const pct              = (s, m) => m > 0 ? Math.round((s / m) * 100) : 0
const scoreColor       = (p) => p >= 75 ? '#16a34a' : p >= 50 ? '#f59e0b' : '#dc2626'
const scoreBg          = (p) => p >= 75 ? '#dcfce7' : p >= 50 ? '#fef9c3' : '#fee2e2'

const emptyLog = {
  course: '', subtype: '', class_name: '', batch_id: '',
  subject_name: '', teacher_name: '', staff_id: '',
  teaching_date: today(), topic_taught: '', classwork: '',
  homework: '', remarks: '', period_number: '',
  needs_doubt_session: false,
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page:   { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card:   { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor: disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor:disabled?'not-allowed':'pointer', fontSize:'14px' }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:'6px', padding:'6px 12px', fontWeight:'600', cursor:'pointer', fontSize:'12px' }),
  input:  { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  label:  { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  select: { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  statCard: (color, bg) => ({ background: bg, borderRadius:'12px', padding:'18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', borderLeft:`4px solid ${color}` }),
  badge:  (color, bg) => ({ padding:'3px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', background: bg, color }),
  pill:   (color, bg) => ({ padding:'4px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:'600', background: bg, color, display:'inline-block' }),
  progressBar: (pct, color) => ({
    height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden',
    position:'relative',
  }),
}

// ─── Shared Hook: Course Data ─────────────────────────────────────────────────

function useCourseData() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('course_batches')
      .select('id, batch_name, course, subtype, class_name, hostel_type, session_year')
      .eq('status', 'Active')
      .order('course')
      .then(({ data }) => { setBatches(data || []); setLoading(false) })
  }, [])

  const courses = useMemo(() => [...new Set(batches.map(b => b.course))], [batches])
  const subtypesFor  = useCallback((course) => [...new Set(batches.filter(b => b.course === course).map(b => b.subtype).filter(Boolean))], [batches])
  const classesFor   = useCallback((course, subtype) => [...new Set(batches.filter(b => b.course === course && (!subtype || b.subtype === subtype)).map(b => b.class_name).filter(Boolean))], [batches])
  const batchIdFor   = useCallback((course, subtype, className) => batches.find(b => b.course === course && (!subtype || b.subtype === subtype) && (!className || b.class_name === className))?.id || '', [batches])

  return { batches, courses, subtypesFor, classesFor, batchIdFor, loading }
}

// ─── Shared Hook: Doubt Sessions ──────────────────────────────────────────────

function useDoubtSessions(logIds) {
  const [sessions, setSessions] = useState({})

  const refetch = useCallback(async () => {
    if (!logIds.length) return
    const { data } = await supabase.from('doubt_sessions').select('*').in('log_id', logIds)
    if (data) {
      const map = {}
      data.forEach(s => { if (!map[s.log_id]) map[s.log_id] = []; map[s.log_id].push(s) })
      setSessions(map)
    }
  }, [logIds.join(',')])  // eslint-disable-line

  useEffect(() => { refetch() }, [refetch])
  return { sessions, refetch }
}

// ─── 3-Level Course Selector ──────────────────────────────────────────────────

function CoursePicker({ form, setForm, courseData }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData
  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  const handleCourse  = (course)     => setForm(f => ({ ...f, course, subtype: '', class_name: '', batch_id: '' }))
  const handleSubtype = (subtype)    => {
    const cls = classesFor(form.course, subtype)
    const class_name = cls.length === 1 ? cls[0] : ''
    const batch_id   = class_name ? batchIdFor(form.course, subtype, class_name) : ''
    setForm(f => ({ ...f, subtype, class_name, batch_id }))
  }
  const handleClass   = (class_name) => setForm(f => ({ ...f, class_name, batch_id: batchIdFor(form.course, form.subtype, class_name) }))

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
        <select value={form.subtype} onChange={e => handleSubtype(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity: form.course ? 1 : 0.5 }}>
          <option value="">Select Subtype</option>
          {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>
          Class
          {form.batch_id && <span style={{ marginLeft:'8px', fontSize:'11px', fontWeight:'400', color:'#16a34a' }}>✓ linked</span>}
        </label>
        {classes.length > 0
          ? <select value={form.class_name} onChange={e => handleClass(e.target.value)} disabled={!form.subtype} style={{ ...S.select, opacity: form.subtype ? 1 : 0.5 }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          : <input value={form.class_name} onChange={e => handleClass(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} style={{ ...S.input, opacity: form.subtype ? 1 : 0.5 }} />
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

  const handleResolve = async (session) => {
    if (!note.trim()) { alert('Please enter a resolution note.'); return }
    setResolvingId(session.id)
    const { error } = await supabase.from('doubt_sessions').update({
      status: 'resolved', resolved_by: currentUser?.name || 'Staff',
      resolved_at: new Date().toISOString(), resolution_note: note,
    }).eq('id', session.id)
    if (error) alert('Error: ' + error.message)
    else { onRefetch(); setNote('') }
    setResolvingId(null)
  }

  return (
    <tr>
      <td colSpan={10} style={{ padding:'0 16px 12px 48px', background:'#fffbeb' }}>
        <div style={{ borderLeft:'3px solid #f59e0b', paddingLeft:'14px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#b45309', marginBottom:'8px' }}>🔁 Doubt Sessions</div>
          {list.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap', padding:'10px 14px', marginBottom:'6px', borderRadius:'8px', background: s.status==='resolved'?'#f0fdf4':'#fef9c3', border:`1px solid ${s.status==='resolved'?'#bbf7d0':'#fde68a'}` }}>
              <div style={{ minWidth:'160px' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#1e293b' }}>🏠 {s.house_name || s.batch_name || '—'}</div>
                <div style={{ fontSize:'11px', color:'#64748b' }}>HM: {s.hm_name || s.staff_name || '—'}</div>
              </div>
              <div style={{ flex:1, minWidth:'140px' }}>
                <div style={{ fontSize:'12px', color:'#374151' }}>📖 {s.topic}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8' }}>{s.subject_name || s.subject}</div>
              </div>
              <div style={{ minWidth:'100px' }}>
                {s.status === 'resolved'
                  ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Resolved</span>
                  : <span style={S.badge('#b45309','#fef9c3')}>⏳ Open</span>}
                {s.resolved_by && <div style={{ fontSize:'10px', color:'#64748b', marginTop:'3px' }}>by {s.resolved_by}</div>}
              </div>
              {s.status === 'resolved' && s.resolution_note && <div style={{ fontSize:'11px', color:'#64748b', flex:1 }}>📝 {s.resolution_note}</div>}
              {s.status === 'open' && (
                <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                  <input value={resolvingId===s.id?note:''} onChange={e=>setNote(e.target.value)} onFocus={()=>setResolvingId(s.id)} placeholder="Resolution note..." style={{ padding:'5px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', width:'180px' }} />
                  <button onClick={()=>handleResolve(s)} style={{ padding:'5px 12px', borderRadius:'6px', border:'none', background:'#16a34a', color:'white', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>✓ Resolve</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── Shared: Log Form ─────────────────────────────────────────────────────────

function LogForm({ form, setForm, onSubmit, saving, timetable, staff, onCancel, editMode=false, courseData }) {
  const handlePeriodSelect = (e) => {
    const pn = parseInt(e.target.value)
    if (!pn || !form.course || !form.subtype) { setForm(f => ({ ...f, period_number: pn || '' })); return }
    const dayName = DAYS[new Date().getDay() - 1] || 'Monday'
    const slot = timetable.find(t => t.class_name===form.subtype && t.period_name===String(pn) && t.day_name===dayName)
    if (slot) {
      const matchedStaff = staff.find(s => s.name === slot.teacher_name)
      setForm(f => ({ ...f, period_number: pn, subject_name: slot.subject_name||f.subject_name, teacher_name: slot.teacher_name||f.teacher_name, staff_id: matchedStaff?.id||f.staff_id }))
    } else {
      setForm(f => ({ ...f, period_number: pn }))
    }
  }

  const handleTeacherChange = (e) => {
    const selected = staff.find(s => s.name === e.target.value)
    setForm(f => ({ ...f, teacher_name: e.target.value, staff_id: selected?.id || '' }))
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        <CoursePicker form={form} setForm={setForm} courseData={courseData} />
        <div>
          <label style={S.label}>Period (optional)</label>
          <select value={form.period_number} onChange={handlePeriodSelect} style={S.select}>
            <option value="">No Period</option>
            {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Subject</label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Teacher</label>
          <select value={form.teacher_name} onChange={handleTeacherChange} style={S.select}>
            <option value="">Select Teacher</option>
            {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.designation||'-'})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date: e.target.value }))} required style={S.input} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Topic Taught</label>
          <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught: e.target.value }))} required placeholder="Enter topic" style={S.input} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Classwork</label>
          <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork: e.target.value }))} rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="Classwork details" />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Homework</label>
          <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework: e.target.value }))} rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="Homework details" />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={S.label}>Remarks</label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Any remarks" />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'12px 16px', borderRadius:'8px', background: form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#f59e0b':'#e2e8f0'}` }}>
            <input type="checkbox" checked={form.needs_doubt_session||false} onChange={e => setForm(f => ({ ...f, needs_doubt_session: e.target.checked }))} style={{ width:'16px', height:'16px', cursor:'pointer' }} />
            <span style={{ fontWeight:'600', fontSize:'14px', color: form.needs_doubt_session?'#b45309':'#374151' }}>🔁 Needs Doubt Session</span>
            {form.needs_doubt_session && <span style={{ fontSize:'12px', color:'#92400e' }}>— HM will be notified &amp; session tracked</span>}
          </label>
        </div>
      </div>
      {form.batch_id && (
        <div style={{ marginTop:'12px', padding:'8px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', fontSize:'12px', color:'#16a34a', fontWeight:'600' }}>
          ✅ Linked to batch_id: {form.batch_id}
        </div>
      )}
      <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
        <button type="submit" disabled={saving} style={S.btn(editMode?'#7c3aed':'#1e3a5f', saving)}>
          {saving ? '⏳ Saving...' : editMode ? '✏️ Update Log' : '✅ Save Log'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={S.btn('#64748b')}>✖ Cancel</button>}
      </div>
    </form>
  )
}

// ─── Tab: Daily Logs ──────────────────────────────────────────────────────────

function TabLogs({ logs, loading, fetchLogs, timetable, staff, courseData, currentUser }) {
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ ...emptyLog, teaching_date: today() })
  const [saving, setSaving]         = useState(false)
  const [editId, setEditId]         = useState(null)
  const [editForm, setEditForm]     = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [search, setSearch]         = useState('')
  const [courseFilter, setCourseFilter]   = useState('All')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [dupWarn, setDupWarn]       = useState('')

  const logIds = useMemo(() => logs.map(l => l.id), [logs])
  const { sessions, refetch: refetchSessions } = useDoubtSessions(logIds)
  const openDoubtCount = useMemo(() => Object.values(sessions).flat().filter(s => s.status==='open').length, [sessions])
  const { courses } = courseData

  const checkDuplicate = useCallback((f) => {
    if (!f.course || !f.subtype || !f.subject_name || !f.teaching_date) return false
    return logs.some(l => l.course===f.course && l.subtype===f.subtype && l.class_name===f.class_name && l.subject_name===f.subject_name && l.teaching_date===f.teaching_date && (editId ? l.id!==editId : true))
  }, [logs, editId])

  const buildPayload = (f) => ({
    course: f.course, subtype: f.subtype||null, class_name: f.class_name||null, batch_id: f.batch_id||null,
    subject_name: f.subject_name, teacher_name: f.teacher_name||null, staff_id: f.staff_id||null,
    teaching_date: f.teaching_date, topic_taught: f.topic_taught, classwork: f.classwork||null,
    homework: f.homework||null, remarks: f.remarks||null, period_number: f.period_number||null,
    needs_doubt_session: f.needs_doubt_session||false,
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    if (checkDuplicate(form)) { setDupWarn(`⚠️ Duplicate log exists for ${form.subject_name} on ${form.teaching_date}.`); return }
    setDupWarn(''); setSaving(true)
    const { data: logData, error } = await supabase.from('teaching_logs').insert([buildPayload(form)]).select().single()
    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    if (form.needs_doubt_session && logData) {
      const { data: students } = await supabase.from('students').select('house').eq('course', form.course).eq('batch', form.subtype).eq('status', 'Active').not('house', 'is', null)
      const houses = [...new Set((students||[]).map(s => s.house).filter(Boolean))]
      const { data: hms } = await supabase.from('housemasters').select('id, name, house').eq('status', 'Active').in('house', houses.length?houses:['__none__'])
      const hmMap = {}; (hms||[]).forEach(hm => { hmMap[hm.house] = hm })
      const doubtSessions = houses.map(house => ({
        log_id: logData.id, course: form.course, subtype: form.subtype||null, class_name: form.class_name||null,
        subject_name: form.subject_name, topic: form.topic_taught, teaching_date: form.teaching_date,
        teacher_name: form.teacher_name||null, teacher_staff_id: form.staff_id||null,
        house_name: house, hm_id: hmMap[house]?.id||null, hm_name: hmMap[house]?.name||null, status: 'open',
      }))
      if (doubtSessions.length) await supabase.from('doubt_sessions').insert(doubtSessions)
    }

    setForm({ ...emptyLog, teaching_date: today() }); setShowForm(false); fetchLogs(); setSaving(false)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (checkDuplicate(editForm)) { alert('⚠️ Duplicate log exists.'); return }
    setEditSaving(true)
    const { error } = await supabase.from('teaching_logs').update(buildPayload(editForm)).eq('id', editId)
    if (error) alert('Error: ' + error.message)
    else { setEditId(null); setEditForm(null); fetchLogs() }
    setEditSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this log?')) return
    await supabase.from('teaching_logs').delete().eq('id', id)
    fetchLogs()
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({ course: item.course||'', subtype: item.subtype||'', class_name: item.class_name||'', batch_id: item.batch_id||'', subject_name: item.subject_name||'', teacher_name: item.teacher_name||'', staff_id: item.staff_id||'', teaching_date: item.teaching_date||today(), topic_taught: item.topic_taught||'', classwork: item.classwork||'', homework: item.homework||'', remarks: item.remarks||'', period_number: item.period_number||'', needs_doubt_session: item.needs_doubt_session||false })
  }

  const uniqueSubjects = [...new Set(logs.map(l => l.subject_name).filter(Boolean))]
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(item => {
      const matchSearch = ['course','subtype','class_name','subject_name','teacher_name','topic_taught','classwork','homework','remarks'].some(k => (item[k]||'').toLowerCase().includes(q))
      return matchSearch && (courseFilter==='All'||item.course===courseFilter) && (subjectFilter==='All'||item.subject_name===subjectFilter)
    })
  }, [logs, search, courseFilter, subjectFilter])

  const todayCount = logs.filter(l => l.teaching_date===today()).length

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Total Logs', value:logs.length, color:'#1e3a5f', bg:'#eff6ff', icon:'📋' },
          { label:'Today Logs', value:todayCount, color:'#16a34a', bg:'#dcfce7', icon:'📅' },
          { label:'Subjects', value:[...new Set(logs.map(l=>l.subject_name).filter(Boolean))].length, color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Teachers', value:[...new Set(logs.map(l=>l.teacher_name).filter(Boolean))].length, color:'#ca8a04', bg:'#fef9c3', icon:'👨‍🏫' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{c.icon}</div>
            <p style={{ fontSize:'13px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:'28px', fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showForm?'20px':0 }}>
          <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>➕ Add Teaching Log</h2>
          <button onClick={() => { setShowForm(!showForm); setDupWarn('') }} style={S.btn(showForm?'#64748b':'#1e3a5f')}>
            {showForm ? '✖ Cancel' : '➕ Add Log'}
          </button>
        </div>
        {dupWarn && <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #f59e0b', borderRadius:'8px', color:'#92400e', fontSize:'13px', marginBottom:'12px' }}>{dupWarn}</div>}
        {showForm && <LogForm form={form} setForm={setForm} onSubmit={handleAdd} saving={saving} timetable={timetable} staff={staff} courseData={courseData} />}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px', marginBottom:'16px' }}>
        <input placeholder="🔍 Search logs..." value={search} onChange={e => setSearch(e.target.value)} style={S.input} />
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={S.select}>
          <option value="All">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={S.select}>
          <option value="All">All Subjects</option>
          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'10px' }}>Showing {filtered.length} of {logs.length} logs</div>

      {openDoubtCount > 0 && (
        <div style={{ padding:'10px 16px', background:'#fef9c3', border:'1px solid #f59e0b', borderRadius:'8px', marginBottom:'12px', fontSize:'13px', fontWeight:'700', color:'#92400e', display:'flex', alignItems:'center', gap:'8px' }}>
          🔁 {openDoubtCount} doubt session{openDoubtCount>1?'s':''} pending resolution
          <span style={{ fontSize:'11px', fontWeight:'400', color:'#b45309' }}>— expand rows below to resolve</span>
        </div>
      )}

      {loading
        ? <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['#','Date','Course','Subtype','Class','Subject','Teacher','Topic','Homework','Actions'].map(h => (
                    <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'13px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <>
                    <tr key={item.id} style={{ borderBottom: editId===item.id?'none':'1px solid #f1f5f9', background: editId===item.id?'#f8f4ff':'white' }}>
                      <td style={{ padding:'12px 14px', color:'#64748b' }}>{i+1}</td>
                      <td style={{ padding:'12px 14px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(item.teaching_date)}</td>
                      <td style={{ padding:'12px 14px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{item.course||'-'}</span></td>
                      <td style={{ padding:'12px 14px', color:'#64748b', fontSize:'13px' }}>{item.subtype||'-'}</td>
                      <td style={{ padding:'12px 14px', color:'#64748b', fontSize:'13px' }}>{item.class_name||'-'}</td>
                      <td style={{ padding:'12px 14px', fontWeight:'600', color:'#1e3a5f' }}>{item.subject_name}</td>
                      <td style={{ padding:'12px 14px', color:'#64748b' }}>{item.teacher_name||'-'}</td>
                      <td style={{ padding:'12px 14px', color:'#64748b', maxWidth:'200px' }}>{item.topic_taught}</td>
                      <td style={{ padding:'12px 14px', color:'#64748b', maxWidth:'160px' }}>{item.homework||'-'}</td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <button onClick={() => editId===item.id?(setEditId(null),setEditForm(null)):startEdit(item)} style={S.btnSm('#7c3aed')}>{editId===item.id?'✖':'✏️'}</button>
                          <button onClick={() => handleDelete(item.id)} style={S.btnSm('#dc2626')}>🗑</button>
                          {sessions[item.id]?.length > 0 && (
                            <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background: sessions[item.id].some(s=>s.status==='open')?'#fef9c3':'#dcfce7', color: sessions[item.id].some(s=>s.status==='open')?'#b45309':'#16a34a', border:`1px solid ${sessions[item.id].some(s=>s.status==='open')?'#fde68a':'#bbf7d0'}` }}>
                              🔁 {sessions[item.id].some(s=>s.status==='open')?'open':'done'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    <DoubtSessionSubRow key={`ds-${item.id}`} logId={item.id} sessions={sessions} onRefetch={refetchSessions} currentUser={currentUser} />
                    {editId===item.id && (
                      <tr key={`edit-${item.id}`} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td colSpan={10} style={{ padding:'16px 24px', background:'#f8f4ff' }}>
                          <div style={{ fontSize:'14px', fontWeight:'700', color:'#7c3aed', marginBottom:'12px' }}>✏️ Edit Log</div>
                          <LogForm form={editForm} setForm={setEditForm} onSubmit={handleEdit} saving={editSaving} timetable={timetable} staff={staff} onCancel={() => { setEditId(null); setEditForm(null) }} courseData={courseData} editMode />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length===0 && <tr><td colSpan={10} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>No teaching logs found</td></tr>}
              </tbody>
            </table>
          </div>
        )
      }
    </>
  )
}

// ─── Tab: Calendar ────────────────────────────────────────────────────────────

function TabCalendar({ logs, missed }) {
  const [month, setMonth]             = useState(currentYearMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [year, mon] = month.split('-').map(Number)
  const firstDay    = new Date(year, mon-1, 1).getDay()
  const daysInMonth = new Date(year, mon, 0).getDate()
  const blanks      = firstDay===0 ? 6 : firstDay-1

  const logsByDate = useMemo(() => {
    const map = {}
    logs.forEach(l => { if (l.teaching_date?.startsWith(month)) { const d=parseInt(l.teaching_date.split('-')[2]); if(!map[d])map[d]=[]; map[d].push(l) } })
    return map
  }, [logs, month])

  const missedByDate = useMemo(() => {
    const map = {}
    missed.forEach(m => { if (m.missed_date?.startsWith(month)) { const d=parseInt(m.missed_date.split('-')[2]); if(!map[d])map[d]=[]; map[d].push(m) } })
    return map
  }, [missed, month])

  const selectedLogs   = selectedDay ? (logsByDate[selectedDay]   || []) : []
  const selectedMissed = selectedDay ? (missedByDate[selectedDay] || []) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📅 Calendar View</h2>
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelectedDay(null) }} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
      </div>
      <div style={{ display:'flex', gap:'16px', marginBottom:'16px', fontSize:'12px' }}>
        {[['#dcfce7','#16a34a','Has logs'],['#fee2e2','#dc2626','Missed'],['#f1f5f9','#94a3b8','No activity']].map(([bg,cl,lb]) => (
          <span key={lb} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:bg, border:`1px solid ${cl}`, display:'inline-block' }} />
            <span style={{ color:'#64748b' }}>{lb}</span>
          </span>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'4px' }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} style={{ textAlign:'center', fontSize:'12px', fontWeight:'700', color:'#64748b', padding:'4px' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {Array.from({ length: blanks }).map((_,i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_,i) => {
          const day=i+1, hasLogs=!!logsByDate[day]?.length, hasMissed=!!missedByDate[day]?.length, isSelected=selectedDay===day
          const bg    = isSelected?'#1e3a5f':hasLogs?'#dcfce7':hasMissed?'#fee2e2':'#f8fafc'
          const color = isSelected?'white':hasLogs?'#16a34a':hasMissed?'#dc2626':'#94a3b8'
          return (
            <div key={day} onClick={() => setSelectedDay(day===selectedDay?null:day)} style={{ background:bg, border:`1px solid ${isSelected?'#1e3a5f':hasLogs?'#bbf7d0':hasMissed?'#fecaca':'#e2e8f0'}`, borderRadius:'8px', padding:'10px 4px', textAlign:'center', cursor:'pointer' }}>
              <div style={{ fontSize:'14px', fontWeight:'700', color }}>{day}</div>
              {hasLogs   && <div style={{ fontSize:'10px', color: isSelected?'#bbf7d0':'#16a34a' }}>{logsByDate[day].length} log{logsByDate[day].length>1?'s':''}</div>}
              {hasMissed && <div style={{ fontSize:'10px', color: isSelected?'#fecaca':'#dc2626' }}>missed</div>}
            </div>
          )
        })}
      </div>
      {selectedDay && (
        <div style={{ marginTop:'20px', borderTop:'1px solid #e2e8f0', paddingTop:'20px' }}>
          <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>{selectedDay} {new Date(year,mon-1).toLocaleString('default',{month:'long'})} {year}</h3>
          {selectedLogs.length===0 && selectedMissed.length===0 && <p style={{ color:'#94a3b8', fontSize:'14px' }}>No activity recorded.</p>}
          {selectedLogs.map(l => (
            <div key={l.id} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'12px 16px', marginBottom:'10px' }}>
              <div style={{ fontWeight:'700', color:'#15803d', fontSize:'14px' }}>{l.subject_name} — {l.course}/{l.subtype}/{l.class_name}</div>
              <div style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>👨‍🏫 {l.teacher_name||'-'} | 📖 {l.topic_taught}</div>
              {l.homework && <div style={{ fontSize:'13px', color:'#64748b', marginTop:'2px' }}>📝 HW: {l.homework}</div>}
            </div>
          ))}
          {selectedMissed.map(m => (
            <div key={m.id} style={{ background:'#fff1f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px 16px', marginBottom:'10px' }}>
              <div style={{ fontWeight:'700', color:'#dc2626', fontSize:'14px' }}>❌ Missed — {m.subject_name} ({m.course}/{m.subtype})</div>
              <div style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>Reason: {m.reason} {m.remarks?`| ${m.remarks}`:''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Syllabus ────────────────────────────────────────────────────────────

function TabSyllabus({ logs, courseData }) {
  const [syllabus, setSyllabus] = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ course:'', subtype:'', class_name:'', subject_name:'', total_topics:'' })
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const { subtypesFor, classesFor } = courseData

  const fetchSyllabus = async () => {
    setLoading(true)
    const { data } = await supabase.from('teaching_syllabus').select('*').order('course')
    if (data) setSyllabus(data)
    setLoading(false)
  }
  useEffect(() => { fetchSyllabus() }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('teaching_syllabus').upsert([{ course:form.course, subtype:form.subtype||null, class_name:form.class_name||null, subject_name:form.subject_name, total_topics:parseInt(form.total_topics) }], { onConflict:'course,subtype,class_name,subject_name' })
    if (error) alert('Error: ' + error.message)
    else { setForm({ course:'', subtype:'', class_name:'', subject_name:'', total_topics:'' }); setShowForm(false); fetchSyllabus() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete syllabus entry?')) return
    await supabase.from('teaching_syllabus').delete().eq('id', id); fetchSyllabus()
  }

  const getCompleted = (row) => logs.filter(l => l.course===row.course && l.subtype===row.subtype && (!row.class_name||l.class_name===row.class_name) && l.subject_name===row.subject_name).length
  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📊 Syllabus Tracker</h2>
        <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm?'#64748b':'#1e3a5f')}>{showForm?'✖ Cancel':'➕ Add Syllabus'}</button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr auto', gap:'12px', alignItems:'flex-end', marginBottom:'24px', padding:'16px', background:'#f8fafc', borderRadius:'8px' }}>
          <div><label style={S.label}>Course</label><select value={form.course} onChange={e => setForm(f => ({ ...f, course:e.target.value, subtype:'', class_name:'' }))} required style={S.select}><option value="">Select</option>{courseData.courses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={S.label}>Subtype</label><select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype:e.target.value, class_name:'' }))} style={S.select}><option value="">All</option>{subtypes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={S.label}>Class</label>{classes.length>0?<select value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name:e.target.value }))} style={S.select}><option value="">All Classes</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}</select>:<input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name:e.target.value }))} placeholder="Optional" style={S.input} />}</div>
          <div><label style={S.label}>Subject</label><select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))} required style={S.select}><option value="">Select</option>{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={S.label}>Total Topics</label><input type="number" min="1" value={form.total_topics} onChange={e => setForm(f => ({ ...f, total_topics:e.target.value }))} required style={S.input} placeholder="e.g. 40" /></div>
          <button type="submit" disabled={saving} style={{ ...S.btn('#16a34a', saving), whiteSpace:'nowrap' }}>{saving?'⏳':'✅ Save'}</button>
        </form>
      )}
      {loading ? <div style={{ textAlign:'center', padding:'32px', color:'#64748b' }}>⏳ Loading...</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {syllabus.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No syllabus defined yet.</div>}
          {syllabus.map(row => {
            const done=getCompleted(row), p=row.total_topics>0?Math.min(100,Math.round((done/row.total_topics)*100)):0, color=scoreColor(p)
            return (
              <div key={row.id} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <div>
                    <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>{row.subject_name}</span>
                    <span style={{ marginLeft:'10px', fontSize:'12px', color:'#64748b' }}>{row.course}/{row.subtype||'All'}/{row.class_name||'All Classes'}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'13px', fontWeight:'700', color }}>{done}/{row.total_topics} topics</span>
                    <span style={{ fontSize:'18px', fontWeight:'800', color }}>{p}%</span>
                    <button onClick={() => handleDelete(row.id)} style={S.btnSm('#dc2626')}>🗑</button>
                  </div>
                </div>
                <div style={{ height:'10px', background:'#e2e8f0', borderRadius:'5px', overflow:'hidden' }}>
                  <div style={{ width:`${p}%`, height:'100%', background:color, borderRadius:'5px', transition:'width 0.4s' }} />
                </div>
                {p>=100 && <div style={{ fontSize:'12px', color:'#16a34a', marginTop:'6px', fontWeight:'600' }}>✅ Syllabus complete!</div>}
                {p>0&&p<100 && <div style={{ fontSize:'12px', color:'#64748b', marginTop:'6px' }}>{row.total_topics-done} topics remaining</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Timetable ───────────────────────────────────────────────────────────

function TabTimetable({ timetable, fetchTimetable, staff, courseData }) {
  const [form, setForm]         = useState({ course:'', subtype:'', class_name:'', batch_id:'', subject_name:'', teacher_name:'', day_of_week:'Monday', period_number:1, start_time:'', end_time:'' })
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [viewCourse, setViewCourse]   = useState('')
  const [viewSubtype, setViewSubtype] = useState('')
  const [viewClass, setViewClass]     = useState('')
  const { courses, subtypesFor, classesFor } = courseData

  useEffect(() => {
    if (courses.length && !viewCourse) {
      const c=courses[0], s=subtypesFor(c)[0]||'', cl=s?classesFor(c,s)[0]||'':''
      setViewCourse(c); setViewSubtype(s); setViewClass(cl)
    }
  }, [courses])  // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    await supabase.from('timetable_entries').insert([{ class_name:form.subtype||form.class_name, subject_name:form.subject_name, teacher_name:form.teacher_name||null, day_name:form.day_of_week, period_name:String(form.period_number) }])
    await supabase.from('teaching_timetable').insert([{ course:form.course, subtype:form.subtype||null, class_name:form.class_name||null, batch_id:form.batch_id||null, subject_name:form.subject_name, teacher_name:form.teacher_name||null, day_of_week:form.day_of_week, period_number:parseInt(form.period_number), start_time:form.start_time||null, end_time:form.end_time||null }])
    setShowForm(false); fetchTimetable(); setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this period?')) return
    await supabase.from('teaching_timetable').delete().eq('id', id); fetchTimetable()
  }

  const getSlot = (day, period) => timetable.find(t => t.class_name===viewSubtype && t.day_name===day && t.period_name===String(period))
  const viewSubtypes = viewCourse ? subtypesFor(viewCourse) : []
  const viewClasses  = (viewCourse && viewSubtype) ? classesFor(viewCourse, viewSubtype) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>🕐 Timetable</h2>
        <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm?'#64748b':'#1e3a5f')}>{showForm?'✖ Cancel':'➕ Add Period'}</button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px', padding:'16px', background:'#f8fafc', borderRadius:'8px' }}>
          <CoursePicker form={form} setForm={setForm} courseData={courseData} />
          <div><label style={S.label}>Day</label><select value={form.day_of_week} onChange={e => setForm(f=>({...f,day_of_week:e.target.value}))} required style={S.select}>{DAYS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
          <div><label style={S.label}>Period</label><select value={form.period_number} onChange={e => setForm(f=>({...f,period_number:e.target.value}))} required style={S.select}>{PERIODS.map(p=><option key={p} value={p}>Period {p}</option>)}</select></div>
          <div><label style={S.label}>Subject</label><select value={form.subject_name} onChange={e => setForm(f=>({...f,subject_name:e.target.value}))} required style={S.select}><option value="">Select</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={S.label}>Teacher</label><select value={form.teacher_name} onChange={e => setForm(f=>({...f,teacher_name:e.target.value}))} style={S.select}><option value="">Select</option>{staff.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
          <div><label style={S.label}>Start Time</label><input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))} style={S.input} /></div>
          <div><label style={S.label}>End Time</label><input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))} style={S.input} /></div>
          <div style={{ gridColumn:'1/-1' }}><button type="submit" disabled={saving} style={S.btn('#16a34a',saving)}>{saving?'⏳ Saving...':'✅ Save Period'}</button></div>
        </form>
      )}
      <div style={{ display:'flex', gap:'12px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>View:</span>
        <select value={viewCourse} onChange={e => { setViewCourse(e.target.value); setViewSubtype(''); setViewClass('') }} style={{ ...S.select, width:'auto' }}>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={viewSubtype} onChange={e => { setViewSubtype(e.target.value); setViewClass('') }} style={{ ...S.select, width:'auto' }}><option value="">All Subtypes</option>{viewSubtypes.map(s=><option key={s} value={s}>{s}</option>)}</select>
        {viewClasses.length>0 && <select value={viewClass} onChange={e => setViewClass(e.target.value)} style={{ ...S.select, width:'auto' }}><option value="">All Classes</option>{viewClasses.map(c=><option key={c} value={c}>{c}</option>)}</select>}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ background:'#1e3a5f', color:'white' }}>
              <th style={{ padding:'10px 12px', textAlign:'center', fontWeight:'600' }}>Period</th>
              {DAYS.map(d => <th key={d} style={{ padding:'10px 12px', textAlign:'center', fontWeight:'600' }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(p => (
              <tr key={p} style={{ borderBottom:'1px solid #e2e8f0' }}>
                <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:'700', color:'#1e3a5f', background:'#f8fafc' }}>P{p}</td>
                {DAYS.map(day => {
                  const slot = getSlot(day, p)
                  return (
                    <td key={day} style={{ padding:'8px', textAlign:'center', background: slot?'#f0fdf4':'white' }}>
                      {slot ? (
                        <div>
                          <div style={{ fontWeight:'700', color:'#15803d', fontSize:'12px' }}>{slot.subject_name}</div>
                          <div style={{ fontSize:'11px', color:'#64748b' }}>{slot.teacher_name||'-'}</div>
                          {slot.start_time && <div style={{ fontSize:'10px', color:'#94a3b8' }}>{slot.start_time}–{slot.end_time}</div>}
                          <button onClick={() => handleDelete(slot.id)} style={{ ...S.btnSm('#dc2626'), padding:'2px 6px', fontSize:'10px', marginTop:'4px' }}>🗑</button>
                        </div>
                      ) : <span style={{ color:'#e2e8f0', fontSize:'18px' }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Reports ─────────────────────────────────────────────────────────────

function TabReports({ logs, missed, staff, courseData }) {
  const [month, setMonth]     = useState(currentYearMonth())
  const [teacher, setTeacher] = useState('All')
  const [course, setCourse]   = useState('All')
  const { courses } = courseData
  const teachers = [...new Set(logs.map(l => l.teacher_name).filter(Boolean))]
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

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📈 Monthly Report</h2>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
          <select value={course} onChange={e => setCourse(e.target.value)} style={{ ...S.select, width:'auto' }}><option value="All">All Courses</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={teacher} onChange={e => setTeacher(e.target.value)} style={{ ...S.select, width:'auto' }}><option value="All">All Teachers</option>{teachers.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <button onClick={() => window.print()} style={S.btn('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Classes Taken', value:monthLogs.length, color:'#1e3a5f', bg:'#eff6ff' },
          { label:'Missed Classes', value:monthMissed.length, color:'#dc2626', bg:'#fee2e2' },
          { label:'Subjects Covered', value:new Set(monthLogs.map(l=>l.subject_name)).size, color:'#7c3aed', bg:'#f3e8ff' },
          { label:'Active Teachers', value:Object.keys(byTeacher).length, color:'#16a34a', bg:'#dcfce7' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:'10px', padding:'16px', borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:'12px', color:c.color, fontWeight:'600' }}>{c.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:c.color, marginTop:'4px' }}>{c.value}</div>
          </div>
        ))}
      </div>
      {Object.entries(byTeacher).map(([name, data]) => {
        const avgPerDay = data.dates.size>0?(data.logs.length/data.dates.size).toFixed(1):'0'
        return (
          <div key={name} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px', marginBottom:'12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>👨‍🏫 {name}</span>
              <span style={{ fontSize:'12px', color:'#64748b' }}>{data.logs.length} classes | {data.subjects.size} subjects | {avgPerDay} avg/day</span>
            </div>
            {data.classes.size>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>{[...data.classes].map(cl=><span key={cl} style={S.pill('#16a34a','#f0fdf4')}>{cl}</span>)}</div>}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>{[...data.subjects].map(s=><span key={s} style={S.pill('#1e3a5f','#eff6ff')}>{s}</span>)}</div>
            <div style={{ marginTop:'8px', fontSize:'13px', color:'#64748b' }}>
              {[...data.logs].slice(0,5).map(l=><div key={l.id} style={{ borderBottom:'1px solid #f1f5f9', padding:'4px 0' }}>{fmtDate(l.teaching_date)} — {l.subject_name} [{l.course}/{l.subtype}/{l.class_name}]: <em>{l.topic_taught}</em></div>)}
              {data.logs.length>5 && <div style={{ color:'#94a3b8', fontSize:'12px', marginTop:'4px' }}>+{data.logs.length-5} more</div>}
            </div>
          </div>
        )
      })}
      {Object.keys(byTeacher).length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No logs for this period.</div>}
    </div>
  )
}

// ─── Tab: Search ──────────────────────────────────────────────────────────────

const MONTHS_LABEL_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function SyllabusMatchBadge({ syllabusItem, onMarkDone }) {
  const monthNum   = parseInt(String(syllabusItem.month).split('-')[1]||syllabusItem.month)-1
  const monthLabel = MONTHS_LABEL_SHORT[monthNum]??syllabusItem.month
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', padding:'7px 12px', background: syllabusItem.completed?'#f0fdf4':'#fefce8', border:`1px solid ${syllabusItem.completed?'#bbf7d0':'#fde68a'}`, borderRadius:'8px', flexWrap:'wrap' }}>
      <span style={{ fontSize:'13px' }}>📆</span>
      <span style={S.badge('#1e3a5f','#eff6ff')}>{syllabusItem.admit_type}</span>
      <span style={S.badge('#7c3aed','#f3e8ff')}>{syllabusItem.subject_name}</span>
      <span style={S.badge('#0891b2','#e0f2fe')}>🗓 {monthLabel}</span>
      {syllabusItem.completed
        ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Done{syllabusItem.completed_at&&<span style={{ fontWeight:400, marginLeft:4 }}>{new Date(syllabusItem.completed_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>}</span>
        : <span style={S.badge('#b45309','#fef9c3')}>⏳ Pending</span>}
      <span style={{ fontSize:'11px', color:'#64748b', flex:1, minWidth:'120px' }}>Syllabus: <em style={{ color:'#1e293b' }}>{syllabusItem.topic}</em></span>
      {!syllabusItem.completed && <button onClick={() => onMarkDone(syllabusItem)} style={{ padding:'3px 10px', borderRadius:'6px', border:'none', background:'#16a34a', color:'white', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>✓ Mark Done</button>}
    </div>
  )
}

function TabSearch({ logs, monthlySyllabus=[], onNavigateTab }) {
  const [query, setQuery] = useState('')
  const [marking, setMarking] = useState(null)
  const [localSyllabus, setLocalSyllabus] = useState(monthlySyllabus)
  useEffect(() => { setLocalSyllabus(monthlySyllabus) }, [monthlySyllabus])

  const findSyllabusMatch = useCallback((logItem) => {
    if (!localSyllabus.length || !logItem.topic_taught) return null
    const topicLower = (logItem.topic_taught||'').toLowerCase()
    return localSyllabus.find(s => topicLower.includes(s.topic.toLowerCase().slice(0,14)) || s.topic.toLowerCase().includes(topicLower.slice(0,14))) || null
  }, [localSyllabus])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return logs.filter(l => (l.topic_taught||'').toLowerCase().includes(q)||(l.classwork||'').toLowerCase().includes(q)||(l.homework||'').toLowerCase().includes(q)).sort((a,b) => b.teaching_date?.localeCompare(a.teaching_date))
  }, [logs, query])

  const matchCount = useMemo(() => results.filter(r => findSyllabusMatch(r)).length, [results, findSyllabusMatch])
  const pendingMatchCount = useMemo(() => results.filter(r => { const m=findSyllabusMatch(r); return m&&!m.completed }).length, [results, findSyllabusMatch])

  const handleMarkDone = async (syllabusItem) => {
    setMarking(syllabusItem.id)
    const completed_at = new Date().toISOString()
    const { error } = await supabase.from('monthly_syllabus').update({ completed:true, completed_at }).eq('id', syllabusItem.id)
    if (!error) setLocalSyllabus(prev => prev.map(s => s.id===syllabusItem.id?{...s,completed:true,completed_at}:s))
    else alert('Error: ' + error.message)
    setMarking(null)
  }

  return (
    <div style={S.card}>
      <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🔍 Topic Search</h2>
      <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'16px' }}>Search across all topics, classwork, and homework — with live 📆 Monthly Syllabus matching.</p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Pythagoras, Photosynthesis, LCM..." style={{ ...S.input, fontSize:'16px', padding:'14px 18px', marginBottom:'16px' }} autoFocus />
      {query&&results.length>0 && (
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px', padding:'10px 14px', background:'#f8fafc', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'12px' }}>
          <span style={{ color:'#1e3a5f', fontWeight:'700' }}>📋 {results.length} log{results.length!==1?'s':''} found</span>
          {matchCount>0 && <><span style={{ color:'#94a3b8' }}>·</span><span style={{ color:'#7c3aed', fontWeight:'700' }}>📆 {matchCount} match syllabus</span></>}
          {pendingMatchCount>0 && <><span style={{ color:'#94a3b8' }}>·</span><span style={{ color:'#b45309', fontWeight:'700' }}>⏳ {pendingMatchCount} pending</span></>}
          {matchCount>0 && <button onClick={() => onNavigateTab?.('monthly')} style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'6px', background:'#1e3a5f', color:'white', border:'none', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>Go to Monthly Syllabus →</button>}
        </div>
      )}
      {query && <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'12px' }}>{results.length} result{results.length!==1?'s':''} found</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {results.map(l => {
          const match = findSyllabusMatch(l)
          return (
            <div key={l.id} style={{ border:`1px solid ${match?(match.completed?'#bbf7d0':'#fde68a'):'#e2e8f0'}`, borderRadius:'10px', padding:'14px 18px', background: match?(match.completed?'#fafffe':'#fffdf0'):'white' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ fontWeight:'700', color:'#1e293b' }}>{l.topic_taught}</span>
                <span style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(l.teaching_date)}</span>
              </div>
              <div style={{ fontSize:'13px', color:'#64748b' }}>{l.course}/{l.subtype}/{l.class_name} | {l.subject_name} | 👨‍🏫 {l.teacher_name||'-'}</div>
              {l.classwork && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>📝 CW: {l.classwork}</div>}
              {l.homework  && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>📚 HW: {l.homework}</div>}
              {match && <SyllabusMatchBadge syllabusItem={marking===match.id?{...match,_loading:true}:match} onMarkDone={handleMarkDone} />}
            </div>
          )
        })}
        {query&&results.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No results for "{query}"</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW: Tab: Student Performance (Scores + Weak Areas + Trends) ─────────────
// ═══════════════════════════════════════════════════════════════════════════════

/*
 * Supabase table required:
 *   student_scores (
 *     id uuid primary key default gen_random_uuid(),
 *     student_id uuid references students(id),
 *     student_name text,
 *     batch_id uuid references course_batches(id),
 *     course text, subtype text, class_name text,
 *     subject_name text, topic text,
 *     test_date date, score numeric, max_score numeric,
 *     notes text, created_at timestamptz default now()
 *   )
 */

function TabStudentPerformance({ courseData, logs }) {
  const [scores, setScores]         = useState([])
  const [students, setStudents]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [filterBatch, setFilterBatch]     = useState('All')
  const [filterSubject, setFilterSubject] = useState('All')
  const [filterStudent, setFilterStudent] = useState('All')
  const [viewMode, setViewMode]     = useState('table') // 'table' | 'trend' | 'weak'
  const [form, setForm] = useState({
    student_id: '', student_name: '', batch_id: '', course: '', subtype: '', class_name: '',
    subject_name: '', topic: '', test_date: today(), score: '', max_score: '100', notes: '',
  })

  const { courses, subtypesFor, classesFor, batchIdFor, batches } = courseData

  const fetchScores = async () => {
    setLoading(true)
    const { data } = await supabase.from('student_scores').select('*').order('test_date', { ascending: false })
    if (data) setScores(data)
    setLoading(false)
  }

  const fetchStudents = async (batchId) => {
    if (!batchId) { setStudents([]); return }
    const { data } = await supabase.from('students').select('id, name, roll_number').eq('batch_id', batchId).eq('status', 'Active').order('name')
    if (data) setStudents(data)
  }

  useEffect(() => { fetchScores() }, [])

  const handleCourseChange = (course) => {
    setForm(f => ({ ...f, course, subtype:'', class_name:'', batch_id:'', student_id:'', student_name:'' }))
    setStudents([])
  }
  const handleSubtypeChange = (subtype) => {
    const cls = classesFor(form.course, subtype)
    const class_name = cls.length===1 ? cls[0] : ''
    const batch_id   = class_name ? batchIdFor(form.course, subtype, class_name) : ''
    setForm(f => ({ ...f, subtype, class_name, batch_id, student_id:'', student_name:'' }))
    if (batch_id) fetchStudents(batch_id)
  }
  const handleClassChange = (class_name) => {
    const batch_id = batchIdFor(form.course, form.subtype, class_name)
    setForm(f => ({ ...f, class_name, batch_id, student_id:'', student_name:'' }))
    if (batch_id) fetchStudents(batch_id)
  }
  const handleStudentChange = (studentId) => {
    const s = students.find(s => s.id === studentId)
    setForm(f => ({ ...f, student_id: studentId, student_name: s?.name || '' }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.student_id && !form.student_name) { alert('Select or enter student name.'); return }
    setSaving(true)
    const payload = {
      student_id:   form.student_id || null,
      student_name: form.student_name,
      batch_id:     form.batch_id || null,
      course:       form.course,
      subtype:      form.subtype || null,
      class_name:   form.class_name || null,
      subject_name: form.subject_name,
      topic:        form.topic,
      test_date:    form.test_date,
      score:        parseFloat(form.score),
      max_score:    parseFloat(form.max_score),
      notes:        form.notes || null,
    }
    const { error } = await supabase.from('student_scores').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setShowForm(false); fetchScores(); setForm({ student_id:'', student_name:'', batch_id:'', course:'', subtype:'', class_name:'', subject_name:'', topic:'', test_date:today(), score:'', max_score:'100', notes:'' }) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this score entry?')) return
    await supabase.from('student_scores').delete().eq('id', id)
    fetchScores()
  }

  // ── Derived data ──
  const allBatches  = [...new Set(scores.map(s => s.subtype).filter(Boolean))]
  const allSubjects = [...new Set(scores.map(s => s.subject_name).filter(Boolean))]
  const allStudents = [...new Set(scores.map(s => s.student_name).filter(Boolean))]

  const filtered = useMemo(() => scores.filter(s =>
    (filterBatch==='All'||s.subtype===filterBatch) &&
    (filterSubject==='All'||s.subject_name===filterSubject) &&
    (filterStudent==='All'||s.student_name===filterStudent)
  ), [scores, filterBatch, filterSubject, filterStudent])

  // Per-student average per subject (for weak area view)
  const weakAreas = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      const key = `${s.student_name}||${s.subject_name}`
      if (!map[key]) map[key] = { student: s.student_name, subject: s.subject_name, scores: [], batch: s.subtype }
      map[key].scores.push(pct(s.score, s.max_score))
    })
    return Object.values(map).map(m => ({ ...m, avg: Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) })).sort((a,b) => a.avg-b.avg)
  }, [filtered])

  const weakOnly = weakAreas.filter(w => w.avg < 60)

  // Per-student trend (chronological scores)
  const trendData = useMemo(() => {
    if (filterStudent==='All') return []
    return filtered.filter(s => s.student_name===filterStudent).sort((a,b) => a.test_date?.localeCompare(b.test_date))
  }, [filtered, filterStudent])

  // Stats
  const avgScore  = filtered.length > 0 ? Math.round(filtered.reduce((a,s) => a + pct(s.score, s.max_score), 0) / filtered.length) : 0
  const topScore  = filtered.length > 0 ? Math.max(...filtered.map(s => pct(s.score, s.max_score))) : 0
  const weakCount = weakOnly.length

  return (
    <>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Total Assessments', value:filtered.length, color:'#1e3a5f', bg:'#eff6ff', icon:'📝' },
          { label:'Avg Score',         value:`${avgScore}%`,  color: scoreColor(avgScore), bg: scoreBg(avgScore), icon:'📊' },
          { label:'Top Score',         value:`${topScore}%`,  color:'#16a34a', bg:'#dcfce7', icon:'🏆' },
          { label:'Weak Areas',        value:weakCount,        color:'#dc2626', bg:'#fee2e2', icon:'⚠️' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{c.icon}</div>
            <p style={{ fontSize:'13px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:'28px', fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* Add Score Form */}
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showForm?'20px':0 }}>
          <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>🎯 Student Performance Scores</h2>
          <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm?'#64748b':'#1e3a5f')}>{showForm?'✖ Cancel':'➕ Add Score'}</button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} style={{ marginTop:'20px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              {/* Course selectors */}
              <div>
                <label style={S.label}>Course</label>
                <select value={form.course} onChange={e => handleCourseChange(e.target.value)} required style={S.select}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Batch / Subtype</label>
                <select value={form.subtype} onChange={e => handleSubtypeChange(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity: form.course?1:0.5 }}>
                  <option value="">Select Batch</option>
                  {form.course ? subtypesFor(form.course).map(s => <option key={s} value={s}>{s}</option>) : null}
                </select>
              </div>
              <div>
                <label style={S.label}>Class</label>
                {(form.course && form.subtype ? classesFor(form.course, form.subtype) : []).length > 0
                  ? <select value={form.class_name} onChange={e => handleClassChange(e.target.value)} disabled={!form.subtype} style={{ ...S.select, opacity: form.subtype?1:0.5 }}>
                      <option value="">Select Class</option>
                      {classesFor(form.course, form.subtype).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  : <input value={form.class_name} onChange={e => handleClassChange(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} style={{ ...S.input, opacity: form.subtype?1:0.5 }} />
                }
              </div>
              <div>
                <label style={S.label}>Student</label>
                {students.length > 0
                  ? <select value={form.student_id} onChange={e => handleStudentChange(e.target.value)} required style={S.select}>
                      <option value="">Select Student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.roll_number?` (${s.roll_number})`:''}</option>)}
                    </select>
                  : <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} placeholder="Type student name" required style={S.input} />
                }
              </div>
              <div>
                <label style={S.label}>Subject</label>
                <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))} required style={S.select}>
                  <option value="">Select Subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Topic / Test Name</label>
                <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Fractions Quiz" required style={S.input} />
              </div>
              <div>
                <label style={S.label}>Test Date</label>
                <input type="date" value={form.test_date} onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))} required style={S.input} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <div>
                  <label style={S.label}>Score</label>
                  <input type="number" min="0" step="0.5" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} required placeholder="e.g. 78" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Out of</label>
                  <input type="number" min="1" step="1" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))} required placeholder="100" style={S.input} />
                </div>
              </div>
              {form.score && form.max_score && (
                <div style={{ gridColumn:'1/-1', padding:'10px 14px', borderRadius:'8px', background: scoreBg(pct(parseFloat(form.score), parseFloat(form.max_score))), border:`1px solid ${scoreColor(pct(parseFloat(form.score), parseFloat(form.max_score)))}40` }}>
                  <span style={{ fontSize:'14px', fontWeight:'700', color: scoreColor(pct(parseFloat(form.score), parseFloat(form.max_score))) }}>
                    {pct(parseFloat(form.score), parseFloat(form.max_score))}% — {pct(parseFloat(form.score), parseFloat(form.max_score)) >= 75 ? '✅ Good' : pct(parseFloat(form.score), parseFloat(form.max_score)) >= 50 ? '⚠️ Average' : '❌ Needs improvement'}
                  </span>
                </div>
              )}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={S.label}>Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks about this assessment" style={S.input} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
              <button type="submit" disabled={saving} style={S.btn('#1e3a5f', saving)}>{saving?'⏳ Saving...':'✅ Save Score'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={S.btn('#64748b')}>✖ Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Filters + View Toggle */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Batches</option>
          {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Subjects</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Students</option>
          {allStudents.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display:'flex', gap:'4px', marginLeft:'auto' }}>
          {[['table','📋 Table'],['weak','⚠️ Weak Areas'],['trend','📈 Trend']].map(([key, label]) => (
            <button key={key} onClick={() => setViewMode(key)} style={{ ...S.btn(viewMode===key?'#1e3a5f':'#e2e8f0'), color: viewMode===key?'white':'#374151', padding:'8px 14px', fontSize:'13px' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* View: Table */}
      {viewMode === 'table' && (
        loading ? <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading...</div> : (
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Date','Student','Batch','Subject','Topic','Score','%','Grade','Actions'].map(h => (
                    <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const p = pct(s.score, s.max_score)
                  return (
                    <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 14px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(s.test_date)}</td>
                      <td style={{ padding:'10px 14px', fontWeight:'600', color:'#1e293b' }}>{s.student_name}</td>
                      <td style={{ padding:'10px 14px' }}><span style={S.badge('#1e3a5f','#eff6ff')}>{s.subtype||s.course||'-'}</span></td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>{s.subject_name}</td>
                      <td style={{ padding:'10px 14px', color:'#64748b', maxWidth:'160px' }}>{s.topic}</td>
                      <td style={{ padding:'10px 14px', fontWeight:'700', color:'#1e293b' }}>{s.score}/{s.max_score}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'50px', height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                            <div style={{ width:`${p}%`, height:'100%', background: scoreColor(p), borderRadius:'3px' }} />
                          </div>
                          <span style={{ fontWeight:'700', color: scoreColor(p), fontSize:'12px' }}>{p}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', background: scoreBg(p), color: scoreColor(p) }}>
                          {p>=75?'Good':p>=50?'Avg':'Weak'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <button onClick={() => handleDelete(s.id)} style={S.btnSm('#dc2626')}>🗑</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length===0 && <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>No score data. Add assessments above.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* View: Weak Areas */}
      {viewMode === 'weak' && (
        <div style={S.card}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#dc2626', marginTop:0 }}>⚠️ Weak Areas (below 60%)</h3>
          {weakOnly.length===0
            ? <div style={{ textAlign:'center', padding:'32px', color:'#16a34a', fontWeight:'600' }}>✅ No weak areas detected! All averages above 60%.</div>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {weakOnly.map((w, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'14px 16px', border:'1px solid #fecaca', borderRadius:'10px', background:'#fff1f2' }}>
                    <div style={{ minWidth:'160px' }}>
                      <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'14px' }}>{w.student}</div>
                      <div style={{ fontSize:'12px', color:'#64748b' }}>{w.batch}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', color:'#374151', marginBottom:'6px' }}>{w.subject}</div>
                      <div style={{ height:'8px', background:'#fee2e2', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ width:`${w.avg}%`, height:'100%', background:'#dc2626', borderRadius:'4px' }} />
                      </div>
                    </div>
                    <div style={{ minWidth:'56px', textAlign:'right' }}>
                      <span style={{ fontSize:'20px', fontWeight:'800', color:'#dc2626' }}>{w.avg}%</span>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>{w.scores.length} test{w.scores.length!==1?'s':''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          {/* Also show all averages for context */}
          <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#374151', marginTop:'24px' }}>📊 All Subject Averages</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px' }}>
            {weakAreas.map((w, i) => (
              <div key={i} style={{ padding:'12px 14px', border:`1px solid ${scoreColor(w.avg)}40`, borderRadius:'8px', background: scoreBg(w.avg) }}>
                <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{w.student}</div>
                <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'6px' }}>{w.subject}</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ flex:1, height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{ width:`${w.avg}%`, height:'100%', background: scoreColor(w.avg), borderRadius:'3px' }} />
                  </div>
                  <span style={{ fontWeight:'800', color: scoreColor(w.avg), fontSize:'14px' }}>{w.avg}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View: Trend */}
      {viewMode === 'trend' && (
        <div style={S.card}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>📈 Score Trend — {filterStudent==='All'?'Select a student above':filterStudent}</h3>
          {filterStudent==='All'
            ? <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>Select a student from the filter above to view their score trend.</div>
            : trendData.length===0
              ? <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No scores found for {filterStudent}.</div>
              : (
                <>
                  {/* Simple bar chart (CSS-based) */}
                  <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', height:'180px', padding:'0 8px', borderBottom:'2px solid #e2e8f0', overflowX:'auto' }}>
                    {trendData.map((s, i) => {
                      const p = pct(s.score, s.max_score)
                      return (
                        <div key={s.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', minWidth:'60px' }}>
                          <span style={{ fontSize:'11px', fontWeight:'700', color: scoreColor(p) }}>{p}%</span>
                          <div style={{ width:'40px', height:`${Math.max(p*1.5, 4)}px`, background: scoreColor(p), borderRadius:'4px 4px 0 0', transition:'height 0.3s' }} title={`${s.topic}: ${s.score}/${s.max_score}`} />
                          <div style={{ fontSize:'10px', color:'#64748b', textAlign:'center', maxWidth:'60px', wordBreak:'break-word' }}>{s.subject_name?.slice(0,6)}</div>
                          <div style={{ fontSize:'9px', color:'#94a3b8', textAlign:'center' }}>{s.test_date?.slice(5)}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display:'flex', gap:'24px', marginTop:'16px', flexWrap:'wrap' }}>
                    {[
                      { label:'Tests taken', value: trendData.length },
                      { label:'Best score', value: `${Math.max(...trendData.map(s=>pct(s.score,s.max_score)))}%` },
                      { label:'Latest score', value: `${pct(trendData[trendData.length-1].score, trendData[trendData.length-1].max_score)}%` },
                      { label:'Avg score', value: `${Math.round(trendData.reduce((a,s)=>a+pct(s.score,s.max_score),0)/trendData.length)}%` },
                    ].map(c => (
                      <div key={c.label} style={{ background:'#f8fafc', borderRadius:'8px', padding:'12px 16px', minWidth:'100px' }}>
                        <div style={{ fontSize:'12px', color:'#64748b' }}>{c.label}</div>
                        <div style={{ fontSize:'20px', fontWeight:'800', color:'#1e3a5f' }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Detailed list */}
                  <div style={{ marginTop:'16px', display:'flex', flexDirection:'column', gap:'6px' }}>
                    {[...trendData].reverse().map(s => {
                      const p = pct(s.score, s.max_score)
                      return (
                        <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 12px', border:'1px solid #f1f5f9', borderRadius:'8px', fontSize:'13px' }}>
                          <span style={{ color:'#94a3b8', minWidth:'70px' }}>{fmtDate(s.test_date)}</span>
                          <span style={{ flex:1, color:'#374151' }}>{s.subject_name} — <em style={{ color:'#64748b' }}>{s.topic}</em></span>
                          <span style={{ fontWeight:'700', color: scoreColor(p) }}>{s.score}/{s.max_score} ({p}%)</span>
                          {s.notes && <span style={{ fontSize:'11px', color:'#94a3b8' }}>{s.notes}</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
          }
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW: Tab: HM Dashboard ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/*
 * Reads from:
 *   doubt_sessions — all open/resolved by house
 *   student_scores — weak areas per house's students
 *   students       — house assignments
 */

function TabHMDashboard({ currentUser }) {
  const [allDoubt, setAllDoubt]   = useState([])
  const [allScores, setAllScores] = useState([])
  const [houses, setHouses]       = useState([])
  const [selectedHouse, setSelectedHouse] = useState('All')
  const [loading, setLoading]     = useState(true)
  const [resolvingId, setResolvingId] = useState(null)
  const [note, setNote]           = useState('')
  const [noteFor, setNoteFor]     = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const [d, s, h] = await Promise.all([
      supabase.from('doubt_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('student_scores').select('*').order('test_date', { ascending: false }),
      supabase.from('students').select('house').eq('status', 'Active').not('house', 'is', null),
    ])
    if (d.data) setAllDoubt(d.data)
    if (s.data) setAllScores(s.data)
    if (h.data) setHouses([...new Set(h.data.map(x => x.house).filter(Boolean))])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filteredDoubt = selectedHouse==='All' ? allDoubt : allDoubt.filter(d => d.house_name===selectedHouse)
  const openSessions  = filteredDoubt.filter(d => d.status==='open')
  const doneSessions  = filteredDoubt.filter(d => d.status==='resolved')

  // Weak students in selected house
  const houseStudents = selectedHouse==='All' ? [...new Set(allScores.map(s => s.student_name))] : []
  const weakStudents  = useMemo(() => {
    const map = {}
    allScores.forEach(s => {
      const key = `${s.student_name}||${s.subject_name}`
      if (!map[key]) map[key] = { student: s.student_name, subject: s.subject_name, scores: [] }
      map[key].scores.push(pct(s.score, s.max_score))
    })
    return Object.values(map)
      .map(m => ({ ...m, avg: Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) }))
      .filter(m => m.avg < 60)
      .sort((a,b) => a.avg-b.avg)
  }, [allScores])

  const handleResolve = async (session) => {
    if (!note.trim()) { alert('Enter resolution note.'); return }
    setResolvingId(session.id)
    const { error } = await supabase.from('doubt_sessions').update({
      status: 'resolved', resolved_by: currentUser?.name || 'HM',
      resolved_at: new Date().toISOString(), resolution_note: note,
    }).eq('id', session.id)
    if (error) alert('Error: ' + error.message)
    else { fetchAll(); setNote(''); setNoteFor(null) }
    setResolvingId(null)
  }

  // Summary per house
  const houseSummary = useMemo(() => {
    const map = {}
    allDoubt.forEach(d => {
      if (!d.house_name) return
      if (!map[d.house_name]) map[d.house_name] = { open:0, resolved:0, hm: d.hm_name }
      if (d.status==='open') map[d.house_name].open++
      else map[d.house_name].resolved++
    })
    return map
  }, [allDoubt])

  if (loading) return <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading HM Dashboard...</div>

  return (
    <>
      {/* House summary cards */}
      {Object.keys(houseSummary).length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px', marginBottom:'24px' }}>
          {Object.entries(houseSummary).map(([house, data]) => (
            <div key={house} onClick={() => setSelectedHouse(selectedHouse===house?'All':house)} style={{ ...S.card, padding:'16px', cursor:'pointer', border: selectedHouse===house?'2px solid #1e3a5f':'1px solid #e2e8f0', marginBottom:0 }}>
              <div style={{ fontSize:'16px', fontWeight:'700', color:'#1e293b', marginBottom:'8px' }}>🏠 {house}</div>
              {data.hm && <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'8px' }}>HM: {data.hm}</div>}
              <div style={{ display:'flex', gap:'8px' }}>
                {data.open>0  && <span style={S.badge('#b45309','#fef9c3')}>⏳ {data.open} open</span>}
                {data.resolved>0 && <span style={S.badge('#16a34a','#dcfce7')}>✅ {data.resolved}</span>}
                {data.open===0&&data.resolved===0 && <span style={S.badge('#94a3b8','#f1f5f9')}>No sessions</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center' }}>
        <span style={{ fontWeight:'600', color:'#374151', fontSize:'13px' }}>Filter house:</span>
        <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Houses</option>
          {houses.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ fontSize:'13px', color:'#64748b' }}>{openSessions.length} open · {doneSessions.length} resolved</span>
      </div>

      {/* Open sessions */}
      <div style={S.card}>
        <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#b45309', marginTop:0 }}>⏳ Open Doubt Sessions ({openSessions.length})</h3>
        {openSessions.length===0
          ? <div style={{ textAlign:'center', padding:'24px', color:'#16a34a', fontWeight:'600' }}>✅ No open doubt sessions!</div>
          : openSessions.map(s => (
            <div key={s.id} style={{ border:'1px solid #fde68a', borderRadius:'10px', padding:'14px 16px', marginBottom:'10px', background:'#fffbeb' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'14px' }}>🏠 {s.house_name} · {s.subject_name}</div>
                  <div style={{ fontSize:'13px', color:'#374151', marginTop:'4px' }}>📖 {s.topic}</div>
                  <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px' }}>Teacher: {s.teacher_name||'-'} | {fmtDate(s.teaching_date)}</div>
                  {s.hm_name && <div style={{ fontSize:'12px', color:'#64748b' }}>HM: {s.hm_name}</div>}
                </div>
                <div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                    {noteFor===s.id
                      ? <>
                          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Resolution note..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px', width:'200px' }} autoFocus />
                          <button onClick={() => handleResolve(s)} style={S.btnSm('#16a34a')}>✓ Resolve</button>
                          <button onClick={() => { setNoteFor(null); setNote('') }} style={S.btnSm('#64748b')}>✖</button>
                        </>
                      : <button onClick={() => setNoteFor(s.id)} style={S.btnSm('#1e3a5f')}>✓ Mark Resolved</button>
                    }
                  </div>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Weak student areas */}
      {weakStudents.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#dc2626', marginTop:0 }}>⚠️ Students Needing Attention (avg below 60%)</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {weakStudents.map((w, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'10px 14px', border:'1px solid #fecaca', borderRadius:'8px', background:'#fff1f2' }}>
                <div style={{ minWidth:'140px', fontWeight:'600', color:'#1e293b', fontSize:'13px' }}>{w.student}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'4px' }}>{w.subject}</div>
                  <div style={{ height:'6px', background:'#fee2e2', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{ width:`${w.avg}%`, height:'100%', background:'#dc2626', borderRadius:'3px' }} />
                  </div>
                </div>
                <span style={{ fontWeight:'800', color:'#dc2626', fontSize:'16px', minWidth:'48px', textAlign:'right' }}>{w.avg}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved history */}
      {doneSessions.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#16a34a', marginTop:0 }}>✅ Resolved Sessions ({doneSessions.length})</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {doneSessions.slice(0,10).map(s => (
              <div key={s.id} style={{ display:'flex', gap:'12px', alignItems:'center', padding:'8px 12px', border:'1px solid #bbf7d0', borderRadius:'8px', background:'#f0fdf4', fontSize:'13px' }}>
                <span style={{ color:'#94a3b8', minWidth:'70px' }}>{fmtDate(s.teaching_date)}</span>
                <span style={{ flex:1 }}>🏠 {s.house_name} · {s.subject_name} — <em>{s.topic}</em></span>
                <span style={{ color:'#16a34a', fontWeight:'600' }}>✅ by {s.resolved_by}</span>
              </div>
            ))}
            {doneSessions.length>10 && <div style={{ fontSize:'12px', color:'#94a3b8', paddingLeft:'12px' }}>+{doneSessions.length-10} more</div>}
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW: Tab: Admin Monitoring Centre ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/*
 * Supabase table required:
 *   admin_alerts (
 *     id uuid primary key default gen_random_uuid(),
 *     alert_type text,   -- 'gap', 'doubt_stale', 'no_log', 'low_score'
 *     course text, subtype text, subject_name text, teacher_name text,
 *     message text, severity text, -- 'high' | 'medium' | 'low'
 *     is_read boolean default false,
 *     created_at timestamptz default now()
 *   )
 */

function TabAdminMonitor({ logs, missed, timetable, staff, courseData }) {
  const [allDoubt, setAllDoubt]     = useState([])
  const [allScores, setAllScores]   = useState([])
  const [alerts, setAlerts]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const { courses } = courseData

  const fetchAll = async () => {
    setLoading(true)
    const [d, s, a] = await Promise.all([
      supabase.from('doubt_sessions').select('*'),
      supabase.from('student_scores').select('*'),
      supabase.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    if (d.data) setAllDoubt(d.data)
    if (s.data) setAllScores(s.data)
    if (a.data) setAlerts(a.data)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // ── Computed health metrics ──
  const currMonth = currentYearMonth()

  const batchHealth = useMemo(() => {
    const result = []
    const subtypes = [...new Set(logs.map(l => l.subtype).filter(Boolean))]
    subtypes.forEach(subtype => {
      const batchLogs    = logs.filter(l => l.subtype===subtype && l.teaching_date?.startsWith(currMonth))
      const batchDoubt   = allDoubt.filter(d => d.subtype===subtype)
      const openDoubt    = batchDoubt.filter(d => d.status==='open').length
      const totalDoubt   = batchDoubt.length
      const batchScores  = allScores.filter(s => s.subtype===subtype)
      const avgScore     = batchScores.length > 0 ? Math.round(batchScores.reduce((a,s)=>a+pct(s.score,s.max_score),0)/batchScores.length) : null
      const subjectsCovered = new Set(batchLogs.map(l => l.subject_name)).size
      const doubtResRate = totalDoubt > 0 ? Math.round(((totalDoubt-openDoubt)/totalDoubt)*100) : 100

      result.push({
        subtype,
        course: logs.find(l=>l.subtype===subtype)?.course||'',
        logsThisMonth: batchLogs.length,
        subjectsCovered,
        openDoubt,
        doubtResRate,
        avgScore,
        health: Math.round((Math.min(batchLogs.length/20,1)*40) + (doubtResRate*0.3) + ((avgScore||50)/100*30)),
      })
    })
    return result.sort((a,b) => a.health-b.health)
  }, [logs, allDoubt, allScores, currMonth])

  // Teacher leaderboard (by logs this month)
  const teacherBoard = useMemo(() => {
    const map = {}
    logs.filter(l => l.teaching_date?.startsWith(currMonth)).forEach(l => {
      if (!l.teacher_name) return
      if (!map[l.teacher_name]) map[l.teacher_name] = { name: l.teacher_name, logs:0, doubts:0, subjects:new Set() }
      map[l.teacher_name].logs++
      map[l.teacher_name].subjects.add(l.subject_name)
    })
    allDoubt.filter(d => d.teacher_name && d.status==='open').forEach(d => {
      if (map[d.teacher_name]) map[d.teacher_name].doubts++
    })
    return Object.values(map).sort((a,b) => b.logs-a.logs)
  }, [logs, allDoubt, currMonth])

  // Syllabus gap: subject × batch with 0 logs in last 3 days
  const gaps = useMemo(() => {
    const threshold = new Date(); threshold.setDate(threshold.getDate()-3)
    const threshStr = threshold.toISOString().split('T')[0]
    const result = []
    const pairs = [...new Set(logs.map(l => `${l.subtype}||${l.subject_name}`))]
    pairs.forEach(pair => {
      const [subtype, subject] = pair.split('||')
      const recent = logs.filter(l => l.subtype===subtype && l.subject_name===subject && l.teaching_date>=threshStr)
      if (recent.length===0) {
        const last = logs.filter(l => l.subtype===subtype && l.subject_name===subject).sort((a,b)=>b.teaching_date?.localeCompare(a.teaching_date))[0]
        result.push({ subtype, subject, lastLogged: last?.teaching_date||'never', teacher: last?.teacher_name||'-' })
      }
    })
    return result
  }, [logs])

  // Stale open doubts (open > 2 days)
  const staleDoubt = useMemo(() => {
    const threshold = new Date(); threshold.setDate(threshold.getDate()-2)
    const threshStr = threshold.toISOString().split('T')[0]
    return allDoubt.filter(d => d.status==='open' && d.teaching_date && d.teaching_date<=threshStr)
  }, [allDoubt])

  const generateAlerts = async () => {
    setGenerating(true)
    const newAlerts = []

    // Gap alerts
    gaps.forEach(g => newAlerts.push({ alert_type:'gap', course:'', subtype:g.subtype, subject_name:g.subject, teacher_name:g.teacher, message:`No log for ${g.subject} (${g.subtype}) in 3+ days. Last: ${fmtDate(g.lastLogged)}`, severity:'medium' }))

    // Stale doubt alerts
    staleDoubt.forEach(d => newAlerts.push({ alert_type:'doubt_stale', course:d.course||'', subtype:d.subtype||'', subject_name:d.subject_name, teacher_name:d.teacher_name||'', message:`Unresolved doubt for ${d.subject_name} (${d.house_name}) since ${fmtDate(d.teaching_date)}`, severity:'high' }))

    if (newAlerts.length > 0) {
      const { error } = await supabase.from('admin_alerts').insert(newAlerts)
      if (error) alert('Error saving alerts: ' + error.message)
      else await fetchAll()
    } else {
      alert('✅ No new alerts needed!')
    }
    setGenerating(false)
  }

  const markRead = async (id) => {
    await supabase.from('admin_alerts').update({ is_read: true }).eq('id', id)
    setAlerts(prev => prev.map(a => a.id===id?{...a,is_read:true}:a))
  }

  const unreadAlerts = alerts.filter(a => !a.is_read)

  if (loading) return <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading admin monitor...</div>

  return (
    <>
      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Unread Alerts',    value:unreadAlerts.length,           color:'#dc2626', bg:'#fee2e2', icon:'🔔' },
          { label:'Open Doubts',      value:allDoubt.filter(d=>d.status==='open').length, color:'#f59e0b', bg:'#fef9c3', icon:'⏳' },
          { label:'Syllabus Gaps',    value:gaps.length,                   color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Stale (2d+ open)', value:staleDoubt.length,            color:'#dc2626', bg:'#fff1f2', icon:'⚠️' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{c.icon}</div>
            <p style={{ fontSize:'13px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:'28px', fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* Alert panel */}
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>🔔 Alerts {unreadAlerts.length>0 && <span style={{ ...S.badge('white','#dc2626'), marginLeft:'8px' }}>{unreadAlerts.length} new</span>}</h3>
          <button onClick={generateAlerts} disabled={generating} style={S.btn('#7c3aed', generating)}>{generating?'⏳ Generating...':'⚡ Generate Alerts'}</button>
        </div>
        {alerts.length===0
          ? <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8' }}>No alerts yet. Click "Generate Alerts" to scan for issues.</div>
          : alerts.slice(0,20).map(a => (
            <div key={a.id} style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'10px 14px', marginBottom:'8px', borderRadius:'8px', border:`1px solid ${a.severity==='high'?'#fecaca':a.severity==='medium'?'#fde68a':'#e2e8f0'}`, background: a.is_read?'white':(a.severity==='high'?'#fff1f2':a.severity==='medium'?'#fffbeb':'#f8fafc'), opacity: a.is_read?0.6:1 }}>
              <span style={{ fontSize:'16px', marginTop:'2px' }}>{a.severity==='high'?'🔴':a.severity==='medium'?'🟡':'🔵'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', color:'#1e293b', fontWeight: a.is_read?'400':'600' }}>{a.message}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{a.alert_type} · {fmtDate(a.created_at?.split('T')[0])}</div>
              </div>
              {!a.is_read && <button onClick={() => markRead(a.id)} style={S.btnSm('#94a3b8')}>✓ Read</button>}
            </div>
          ))
        }
      </div>

      {/* Batch health */}
      <div style={S.card}>
        <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🏫 Batch Health — {new Date().toLocaleString('default',{month:'long',year:'numeric'})}</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {batchHealth.length===0 && <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8' }}>No batch data yet.</div>}
          {batchHealth.map((b, i) => (
            <div key={i} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div>
                  <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>{b.subtype}</span>
                  <span style={{ marginLeft:'8px', fontSize:'12px', color:'#64748b' }}>{b.course}</span>
                </div>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  {b.openDoubt>0 && <span style={S.badge('#b45309','#fef9c3')}>⏳ {b.openDoubt} open doubts</span>}
                  {b.avgScore!=null && <span style={{ ...S.badge(scoreColor(b.avgScore), scoreBg(b.avgScore)) }}>Avg {b.avgScore}%</span>}
                  <span style={{ fontSize:'20px', fontWeight:'800', color: scoreColor(b.health) }}>{b.health}%</span>
                </div>
              </div>
              <div style={{ height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden', marginBottom:'8px' }}>
                <div style={{ width:`${b.health}%`, height:'100%', background: scoreColor(b.health), borderRadius:'4px', transition:'width 0.4s' }} />
              </div>
              <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:'#64748b' }}>
                <span>📋 {b.logsThisMonth} logs this month</span>
                <span>📚 {b.subjectsCovered} subjects</span>
                <span>🔁 {b.doubtResRate}% doubts resolved</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teacher leaderboard */}
      <div style={S.card}>
        <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🏆 Teacher Activity — This Month</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {teacherBoard.length===0 && <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8' }}>No teacher logs this month.</div>}
          {teacherBoard.map((t, i) => (
            <div key={t.name} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:'8px', background: i<3?'#f0fdf4':'white' }}>
              <span style={{ fontWeight:'800', color: i===0?'#ca8a04':i===1?'#94a3b8':i===2?'#b45309':'#94a3b8', fontSize:'16px', minWidth:'24px' }}>#{i+1}</span>
              <span style={{ flex:1, fontWeight:'600', color:'#1e293b', fontSize:'14px' }}>👨‍🏫 {t.name}</span>
              <span style={S.pill('#1e3a5f','#eff6ff')}>{t.logs} logs</span>
              <span style={S.pill('#7c3aed','#f3e8ff')}>{t.subjects.size} subj</span>
              {t.doubts>0 && <span style={S.pill('#b45309','#fef9c3')}>⏳ {t.doubts} open</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Syllabus gaps */}
      {gaps.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#7c3aed', marginTop:0 }}>📚 Syllabus Gaps (no log in 3+ days)</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {gaps.map((g, i) => (
              <div key={i} style={{ display:'flex', gap:'12px', alignItems:'center', padding:'8px 12px', border:'1px solid #ddd6fe', borderRadius:'8px', background:'#faf5ff', fontSize:'13px' }}>
                <span style={S.badge('#7c3aed','#f3e8ff')}>{g.subtype}</span>
                <span style={{ flex:1, color:'#374151' }}>{g.subject}</span>
                <span style={{ color:'#94a3b8' }}>Last: {fmtDate(g.lastLogged)}</span>
                <span style={{ color:'#64748b' }}>👨‍🏫 {g.teacher}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW: Tab: Remediation Slot Suggester ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function TabRemediation({ logs, courseData }) {
  const [allDoubt, setAllDoubt]   = useState([])
  const [allScores, setAllScores] = useState([])
  const [ttFull, setTtFull]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterBatch, setFilterBatch] = useState('All')

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const [d, s, t] = await Promise.all([
        supabase.from('doubt_sessions').select('*').eq('status', 'open'),
        supabase.from('student_scores').select('*'),
        supabase.from('teaching_timetable').select('*'),
      ])
      if (d.data) setAllDoubt(d.data)
      if (s.data) setAllScores(s.data)
      if (t.data) setTtFull(t.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  // Group open doubts by subtype × subject
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

  // For each group, find weak students and suggest a doubt slot from timetable
  const suggestions = useMemo(() => {
    return doubtGroups.map(g => {
      // Weak students for this subject in this batch
      const batchScores = allScores.filter(s => s.subtype===g.subtype && s.subject_name===g.subject)
      const studentMap  = {}
      batchScores.forEach(s => {
        if (!studentMap[s.student_name]) studentMap[s.student_name] = []
        studentMap[s.student_name].push(pct(s.score, s.max_score))
      })
      const weakStudents = Object.entries(studentMap)
        .map(([name, scores]) => ({ name, avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) }))
        .filter(s => s.avg<60).sort((a,b)=>a.avg-b.avg)

      // Find available doubt session slot in timetable (day + period with no conflict)
      // Doubt slots from GNSI timetable: typically early morning (6:30–8:10) or evening (5:30–8:00)
      // We look for existing timetable entries matching the batch or suggest standard slots
      const existingSlots = ttFull.filter(t =>
        (t.subtype===g.subtype || t.class_name===g.subtype) &&
        (t.start_time==='06:30' || t.start_time==='17:30' || t.start_time==='18:20' || t.start_time==='19:10')
      )

      const standardSlots = [
        { day:'Monday',    time:'06:30–07:20', type:'Morning Doubt' },
        { day:'Monday',    time:'17:30–18:20', type:'Evening Doubt' },
        { day:'Wednesday', time:'06:30–07:20', type:'Morning Doubt' },
        { day:'Friday',    time:'17:30–18:20', type:'Evening Doubt' },
      ]

      return { ...g, weakStudents, existingSlots, suggestedSlots: standardSlots }
    })
  }, [doubtGroups, allScores, ttFull])

  const filtered = filterBatch==='All' ? suggestions : suggestions.filter(s => s.subtype===filterBatch)
  const allBatches = [...new Set(suggestions.map(s => s.subtype).filter(Boolean))]

  if (loading) return <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading remediation data...</div>

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Open Doubt Groups', value:suggestions.length, color:'#f59e0b', bg:'#fef9c3', icon:'🔁' },
          { label:'Weak Student Flags', value:suggestions.reduce((a,s)=>a+s.weakStudents.length,0), color:'#dc2626', bg:'#fee2e2', icon:'⚠️' },
          { label:'Slots Available', value:suggestions.length*4, color:'#16a34a', bg:'#dcfce7', icon:'🕐' },
        ].map(c => (
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{c.icon}</div>
            <p style={{ fontSize:'13px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:'28px', fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center' }}>
        <span style={{ fontWeight:'600', color:'#374151', fontSize:'13px' }}>Filter batch:</span>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Batches</option>
          {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {filtered.length===0 && <div style={{ ...S.card, textAlign:'center', padding:'48px', color:'#16a34a', fontWeight:'600' }}>✅ No open doubt sessions needing remediation.</div>}

      {filtered.map((s, i) => (
        <div key={i} style={S.card}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#1e293b', margin:'0 0 4px' }}>
                {s.subject} — <span style={{ color:'#1e3a5f' }}>{s.subtype}</span>
              </h3>
              <div style={{ fontSize:'13px', color:'#64748b' }}>
                {s.sessions.length} open doubt session{s.sessions.length!==1?'s':''}
                {s.houses.size>0 && ` · Houses: ${[...s.houses].join(', ')}`}
              </div>
            </div>
            <span style={S.badge('#b45309','#fef9c3')}>⏳ {s.sessions.length} pending</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {/* Weak students */}
            <div>
              <div style={{ fontWeight:'600', color:'#374151', fontSize:'13px', marginBottom:'8px' }}>⚠️ Students needing help</div>
              {s.weakStudents.length===0
                ? <div style={{ fontSize:'13px', color:'#16a34a' }}>✅ No weak students detected (no score data).</div>
                : s.weakStudents.map((st, j) => (
                  <div key={j} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 10px', background:'#fff1f2', border:'1px solid #fecaca', borderRadius:'6px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'13px', color:'#1e293b', flex:1, fontWeight:'600' }}>{st.name}</span>
                    <span style={{ fontSize:'13px', fontWeight:'800', color: scoreColor(st.avg) }}>{st.avg}%</span>
                  </div>
                ))
              }
            </div>

            {/* Suggested slots */}
            <div>
              <div style={{ fontWeight:'600', color:'#374151', fontSize:'13px', marginBottom:'8px' }}>🕐 Suggested Doubt Slots</div>
              {s.suggestedSlots.map((slot, j) => (
                <div key={j} style={{ display:'flex', gap:'10px', alignItems:'center', padding:'6px 10px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'6px', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', color:'#16a34a', minWidth:'60px' }}>{slot.day}</span>
                  <span style={{ fontSize:'12px', color:'#374151' }}>{slot.time}</span>
                  <span style={S.badge('#0891b2','#e0f2fe')}>{slot.type}</span>
                </div>
              ))}
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'8px' }}>
                Based on GNSI timetable doubt session slots (6:30–8:10 AM · 5:30–8:00 PM)
              </div>
            </div>
          </div>

          {/* Open sessions list */}
          {s.sessions.length > 0 && (
            <div style={{ marginTop:'14px', borderTop:'1px solid #f1f5f9', paddingTop:'12px' }}>
              <div style={{ fontWeight:'600', color:'#374151', fontSize:'12px', marginBottom:'6px' }}>Open sessions:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {s.sessions.map((d, j) => (
                  <span key={j} style={{ ...S.badge('#b45309','#fef9c3'), padding:'4px 10px' }}>
                    🏠 {d.house_name||'?'} · {fmtDate(d.teaching_date)}
                  </span>
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
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('gnsi_teaching_tab') || 'logs' } catch { return 'logs' }
  })
  const [logs,            setLogs]            = useState([])
  const [missed,          setMissed]          = useState([])
  const [timetable,       setTimetable]       = useState([])
  const [staff,           setStaff]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [monthlySyllabus, setMonthlySyllabus] = useState([])

  const courseData = useCourseData()

  const handleTabChange = (key) => {
    setActiveTab(key)
    try { localStorage.setItem('gnsi_teaching_tab', key) } catch {}
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('teaching_logs').select('*').order('teaching_date', { ascending: false })
    if (data) setLogs(data)
    setLoading(false)
  }, [])

  const fetchMissed = useCallback(async () => {
    const { data } = await supabase.from('teaching_missed').select('*').order('missed_date', { ascending: false })
    if (data) setMissed(data)
  }, [])

  const fetchTimetable = useCallback(async () => {
    const { data } = await supabase.from('timetable_entries').select('*').order('period_name')
    if (data) setTimetable(data)
  }, [])

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from('staff_profiles').select('id,name,designation').eq('status', 'Active').order('name')
    if (data) setStaff(data)
  }, [])

  const fetchMonthlySyllabus = useCallback(async () => {
    const { data } = await supabase.from('monthly_syllabus').select('id,admit_type,subject_name,topic,month,completed,completed_at').order('month')
    if (data) setMonthlySyllabus(data)
  }, [])

  useEffect(() => {
    fetchLogs(); fetchMissed(); fetchTimetable(); fetchStaff(); fetchMonthlySyllabus()
  }, [])  // eslint-disable-line

  const todayStr  = today()
  const currMonth = currentYearMonth()

  const badges = useMemo(() => {
    const todayLogs      = logs.filter(l => l.teaching_date===todayStr).length
    const monthMissed    = missed.filter(m => m.missed_date?.startsWith(currMonth)).length
    const activeTeachers = new Set(logs.filter(l => l.teaching_date?.startsWith(currMonth)).map(l => l.teacher_name).filter(Boolean)).size
    return {
      logs:        todayLogs>0   ? `${todayLogs} today`    : null,
      calendar:    null,
      syllabus:    null,
      timetable:   timetable.length>0 ? `${new Set(timetable.map(t=>t.class_name).filter(Boolean)).size} batches` : null,
      reports:     monthMissed>0 ? `${monthMissed} missed` : activeTeachers>0 ? `${activeTeachers} teachers` : null,
      search:      null,
      monthly:     null,
      performance: null,
      hmdash:      null,
      admin:       null,
      remediation: null,
    }
  }, [logs, missed, timetable, todayStr, currMonth])

  return (
    <div style={S.page}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'26px', fontWeight:'bold', color:'#1e3a5f', margin:0 }}>📘 Teaching Management</h1>
        <p style={{ color:'#64748b', fontSize:'14px', margin:'4px 0 0' }}>Daily logs · Syllabus · Timetable · Reports · Student Scores · HM Dashboard · Admin Monitor · Remediation</p>
      </div>

      {/* Grid Tab Bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'6px', marginBottom:'24px' }}>
        {TABS.map(t => {
          const active = activeTab===t.key
          const badge  = badges[t.key]
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:'4px', padding:'10px 6px', fontWeight:'600', fontSize:'11px', cursor:'pointer',
                background: active?'#1e3a5f':'white',
                color: active?'white':'#64748b',
                border: active?'2px solid #1e3a5f':'2px solid #e2e8f0',
                borderRadius:'10px', transition:'all 0.15s ease',
                boxShadow: active?'0 2px 10px rgba(30,58,95,0.25)':'none',
                position:'relative', minHeight:'58px',
              }}
            >
              <span style={{ fontSize:'18px', lineHeight:1 }}>{t.icon}</span>
              <span style={{ textAlign:'center', lineHeight:1.2 }}>{t.label}</span>
              {badge && (
                <span style={{
                  position:'absolute', top:'4px', right:'4px',
                  padding:'1px 5px', borderRadius:'999px', fontSize:'9px', fontWeight:'700',
                  background: active?'rgba(255,255,255,0.3)':'#1e3a5f', color:'white',
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab==='logs'        && <TabLogs logs={logs} loading={loading} fetchLogs={fetchLogs} timetable={timetable} staff={staff} courseData={courseData} currentUser={currentUser} />}
      {activeTab==='calendar'    && <TabCalendar logs={logs} missed={missed} />}
      {activeTab==='syllabus'    && <TabSyllabus logs={logs} courseData={courseData} />}
      {activeTab==='timetable'   && <TabTimetable timetable={timetable} fetchTimetable={fetchTimetable} staff={staff} courseData={courseData} />}
      {activeTab==='reports'     && <TabReports logs={logs} missed={missed} staff={staff} courseData={courseData} />}
      {activeTab==='search'      && <TabSearch logs={logs} monthlySyllabus={monthlySyllabus} onNavigateTab={handleTabChange} />}
      {activeTab==='monthly'     && <TabMonthlySyllabus logs={logs} missed={missed} timetable={timetable} staff={staff} courseData={courseData} currentUser={currentUser} onNavigateTab={key=>handleTabChange(key)} />}
      {activeTab==='performance' && <TabStudentPerformance courseData={courseData} logs={logs} />}
      {activeTab==='hmdash'      && <TabHMDashboard currentUser={currentUser} />}
      {activeTab==='admin'       && <TabAdminMonitor logs={logs} missed={missed} timetable={timetable} staff={staff} courseData={courseData} />}
      {activeTab==='remediation' && <TabRemediation logs={logs} courseData={courseData} />}
    </div>
  )
}

export default Teaching
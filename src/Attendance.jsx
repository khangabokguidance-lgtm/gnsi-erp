// ============================================================
//  GNSI Portal — Attendance Module
//  Fixed: CoursePicker + useCourseData imported from Courses.jsx
//  Fixed: timetable auto-fill matches class_name === subtype
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { useCourseData } from './Courses'   // ← single source of truth

// ─── Constants ────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics', 'English', 'General Knowledge', 'General Science',
  'Social Science', 'Reasoning', 'Current Affairs', 'Hindi',
  'Computer Science', 'Physical Education',
]

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Leave']

const STATUS_STYLE = {
  Present: { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' },
  Absent:  { bg: '#fee2e2', color: '#dc2626', border: '#fecaca' },
  Late:    { bg: '#fef9c3', color: '#92400e', border: '#fde68a' },
  Leave:   { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
}

const STATUS_ICON = { Present: '✅', Absent: '❌', Late: '⏰', Leave: '📋' }

const today  = () => new Date().toISOString().split('T')[0]
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const TABS = [
  { key: 'mark',   label: '✏️ Mark Attendance' },
  { key: 'view',   label: '📋 View Sessions' },
  { key: 'report', label: '📊 Reports' },
]

// ─── Styles ───────────────────────────────────────────────────

const S = {
  page:   { padding:'24px', fontFamily:"'Segoe UI', sans-serif", background:'#f8fafc', minHeight:'100vh' },
  card:   { background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:'24px', marginBottom:'20px' },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor:disabled?'not-allowed':'pointer', fontSize:'14px' }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:'6px', padding:'6px 12px', fontWeight:'600', cursor:'pointer', fontSize:'12px' }),
  input:  { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  label:  { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  select: { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  tab:    (active) => ({ padding:'10px 18px', fontWeight:'600', fontSize:'13px', cursor:'pointer', background:'none', border:'none', borderBottom:active?'3px solid #1e3a5f':'3px solid transparent', color:active?'#1e3a5f':'#64748b' }),
}

// ─── Status Toggle Button ──────────────────────────────────────

function StatusBtn({ status, onChange }) {
  const st  = STATUS_STYLE[status] || STATUS_STYLE.Present
  const idx  = ATTENDANCE_STATUSES.indexOf(status)
  const next = ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length]
  return (
    <button onClick={() => onChange(next)}
      style={{ padding:'6px 14px', borderRadius:'999px', border:`1.5px solid ${st.border}`, background:st.bg, color:st.color, fontWeight:'700', fontSize:'12px', cursor:'pointer', minWidth:'80px', transition:'all 0.15s' }}>
      {STATUS_ICON[status]} {status}
    </button>
  )
}

// ─── Tab: Mark Attendance ─────────────────────────────────────

function TabMark({ courseData, staff }) {
  const [session, setSession] = useState({
    session_date: today(), course:'', subtype:'', class_name:'', batch_id:'',
    subject_name:'', teacher_name:'', staff_id:'', period_number:'',
    session_type:'Class', remarks:'',
  })
  const [students,  setStudents]  = useState([])
  const [records,   setRecords]   = useState({})
  const [saving,    setSaving]    = useState(false)
  const [timetable, setTimetable] = useState([])

  // ── Re-resolve batch_id once courseData.batches finishes loading ──
  // batchIdFor returns '' if batches array is still empty (async load),
  // so we watch batches and fill in batch_id if it's missing
  useEffect(() => {
    if (!courseData.batches.length) return          // still loading
    if (session.batch_id) return                    // already resolved
    if (!session.course || !session.subtype) return // nothing selected yet
    const classes = courseData.classesFor(session.course, session.subtype)
    if (classes.length > 0 && !session.class_name) return  // needs class selection
    const batch_id = courseData.batchIdFor(session.course, session.subtype, session.class_name)
    if (batch_id) setSession(prev => ({ ...prev, batch_id }))
  }, [courseData.batches, session.course, session.subtype, session.class_name, session.batch_id])

  // Subjects derived live from timetable entries for the selected batch
  const batchSubjects = useMemo(() =>
  timetable.length > 0
    ? [...new Set(timetable.map(t => t.subject_name).filter(Boolean))].sort()
    : SUBJECTS,
[timetable])

  // Teachers: only staff who appear in this batch's timetable
  // Falls back to all staff if batch has no timetable yet
  const batchStaff = useMemo(() => {
  if (!timetable.length) return staff  // already returns all staff as fallback
  const timetableNames = new Set(timetable.map(t => t.teacher_name).filter(Boolean))
  const matched = staff.filter(s => timetableNames.has(s.name))
  return matched.length > 0 ? matched : staff
}, [timetable, staff])

  // ── Load timetable entries when batch changes ─────────────────
  // timetable_entries.class_name stores the batch_name from course_batches
  useEffect(() => {
    if (!session.batch_id) { setTimetable([]); return }
    // Resolve batch_id → batch_name first, then query timetable_entries
    const fetchTimetable = async () => {
      const { data: batch } = await supabase
        .from('course_batches')
        .select('batch_name')
        .eq('id', session.batch_id)
        .single()
      if (!batch?.batch_name) return
      const { data } = await supabase
        .from('timetable_entries')
        .select('*')
        .eq('class_name', batch.batch_name)   // ← batch_name stored as class_name in timetable_entries
      setTimetable(data || [])
    }
    fetchTimetable()
  }, [session.batch_id])

  // ── Load enrolled students ────────────────────────────────────
  useEffect(() => {
    if (!session.course) { setStudents([]); setRecords({}); return }
    const fetchStudents = async () => {
      let q = supabase
        .from('course_enrollments')
        .select('id, student_name, gcc_no, student_id, hostel_type')
        .eq('status', 'Active')
        .eq('course', session.course)
      if (session.subtype)    q = q.eq('subtype',    session.subtype)
      if (session.class_name) q = q.eq('class_name', session.class_name)
      const { data } = await q.order('student_name')
      if (data && data.length > 0) {
        setStudents(data)
        const init = {}
        data.forEach(s => { init[s.student_name] = 'Present' })
        setRecords(init)
      } else {
        setStudents([])
        setRecords({})
      }
    }
    fetchStudents()
  }, [session.course, session.subtype, session.class_name])

  // ── Period selected → auto-fill subject + teacher ─────────────
  // timetable is already filtered to this batch; just match day + period
  const handlePeriodChange = (periodNumber) => {
    setSession(prev => ({ ...prev, period_number: periodNumber }))
    if (!periodNumber || !timetable.length) return

    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

    const slot = timetable.find(t =>
      t.period_name === String(periodNumber) &&
      t.day_name    === dayName
    )

    if (slot) {
      const matchedStaff = staff.find(s => s.name === slot.teacher_name)
      setSession(prev => ({
        ...prev,
        period_number: periodNumber,
        subject_name:  slot.subject_name || prev.subject_name,
        teacher_name:  slot.teacher_name || prev.teacher_name,
        staff_id:      matchedStaff?.id  || prev.staff_id,
      }))
    }
  }

  const handleTeacher = (e) => {
    const s = staff.find(x => x.name === e.target.value)
    setSession(prev => ({ ...prev, teacher_name: e.target.value, staff_id: s?.id || '' }))
  }

  const handleSave = async () => {
    if (!session.course || students.length === 0) {
      alert('Select a course and ensure students are loaded.')
      return
    }
    setSaving(true)
    const { data: sess, error: sessErr } = await supabase
      .from('attendance_sessions')
      .insert([{
        session_date:  session.session_date,
        course:        session.course,
        subtype:       session.subtype       || null,
        class_name:    session.class_name    || null,
        batch_id:      session.batch_id      || null,
        subject_name:  session.subject_name  || null,
        teacher_name:  session.teacher_name  || null,
        staff_id:      session.staff_id      || null,
        period_number: session.period_number || null,
        session_type:  session.session_type,
        remarks:       session.remarks       || null,
      }])
      .select()
      .single()

    if (sessErr) { alert('Error creating session: ' + sessErr.message); setSaving(false); return }

    const rows = students.map(s => ({
      session_id:   sess.id,
      student_id:   s.student_id || null,
      student_name: s.student_name,
      gcc_no:       s.gcc_no || null,
      status:       records[s.student_name] || 'Present',
    }))

    const { error: recErr } = await supabase.from('attendance_records').insert(rows)
    if (recErr) { alert('Error saving records: ' + recErr.message); setSaving(false); return }

    setSaving(false)
    alert(`✅ Attendance saved for ${students.length} students!`)
    setSession(prev => ({ ...prev, subject_name:'', teacher_name:'', staff_id:'', period_number:'', remarks:'' }))
  }

  const stats = useMemo(() => {
    const counts = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (counts[s] !== undefined) counts[s]++ })
    return counts
  }, [records])

  const markAll = (status) => {
    const next = {}
    students.forEach(s => { next[s.student_name] = status })
    setRecords(next)
  }

  return (
    <div>
      <div style={S.card}>
        <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', marginTop:0, marginBottom:'20px' }}>
          Step 1 — Session Details
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>

          {/* Inline course picker — auto-resolves batch_id even when class_name is null */}
          <div>
            <label style={S.label}>Course *</label>
            <select value={session.course} onChange={e => {
              setSession(prev => ({ ...prev, course: e.target.value, subtype:'', class_name:'', batch_id:'' }))
            }} style={S.select}>
              <option value="">Select Course</option>
              {courseData.courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={S.label}>Subtype / Batch</label>
            <select value={session.subtype} onChange={e => {
              const subtype = e.target.value
              const classes = courseData.classesFor(session.course, subtype)
              // If no classes exist (class_name is null in DB), resolve batch_id immediately
              const batch_id = classes.length === 0
                ? courseData.batchIdFor(session.course, subtype, '')
                : ''
              setSession(prev => ({ ...prev, subtype, class_name:'', batch_id }))
            }} disabled={!session.course || courseData.loading} style={{ ...S.select, opacity: session.course ? 1 : 0.5 }}>
              <option value="">{courseData.loading ? '⏳ Loading...' : 'Select Subtype'}</option>
              {(session.course ? courseData.subtypesFor(session.course) : []).map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>

          {/* Only show Class if this course+subtype actually has class_name values */}
          {session.subtype && courseData.classesFor(session.course, session.subtype).length > 0 ? (
            <div>
              <label style={S.label}>
                Class
                {session.batch_id && <span style={{ marginLeft:'6px', fontSize:'10px', color:'#16a34a', fontWeight:'600' }}>✓ linked</span>}
              </label>
              <select value={session.class_name} onChange={e => {
                const class_name = e.target.value
                const batch_id = courseData.batchIdFor(session.course, session.subtype, class_name)
                setSession(prev => ({ ...prev, class_name, batch_id }))
              }} style={S.select}>
                <option value="">Select Class</option>
                {courseData.classesFor(session.course, session.subtype).map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
          ) : (
            <div>
              <label style={S.label}>
                Class
                {session.batch_id
                  ? <span style={{ marginLeft:'6px', fontSize:'10px', color:'#16a34a', fontWeight:'600' }}>✓ batch resolved</span>
                  : session.subtype
                    ? <span style={{ marginLeft:'6px', fontSize:'10px', color:'#f59e0b', fontWeight:'600' }}>select subtype above</span>
                    : null
                }
              </label>
              <div style={{ ...S.input, background:'#f8fafc', color:'#94a3b8', display:'flex', alignItems:'center', height:'42px' }}>
                {session.batch_id ? '— not required for this batch —' : '— select course + subtype first —'}
              </div>
            </div>
          )}

          <div>
            <label style={S.label}>Date</label>
            <input type="date" value={session.session_date}
              onChange={e => setSession(prev => ({ ...prev, session_date: e.target.value }))}
              style={S.input} />
          </div>

          {/* Period — triggers auto-fill of subject + teacher */}
          <div>
            <label style={S.label}>Period (auto-fills subject + teacher)</label>
            <select value={session.period_number} onChange={e => handlePeriodChange(e.target.value)} style={S.select}>
              <option value="">— No Period —</option>
              {[1,2,3,4,5,6,7,8].map(p => (
                <option key={p} value={p}>Period {p}</option>
              ))}
            </select>
          </div>

          {/* Subject — populated from timetable_entries for this batch */}
          <div>
            <label style={S.label}>
              Subject
              {session.period_number && session.subject_name && (
                <span style={{ marginLeft:'8px', fontSize:'10px', color:'#16a34a', fontWeight:'600' }}>✓ from timetable</span>
              )}
            </label>
            <select value={session.subject_name}
              onChange={e => setSession(prev => ({ ...prev, subject_name: e.target.value }))}
              style={S.select}>
              <option value="">Select Subject</option>
              {batchSubjects.length > 0
                ? batchSubjects.map(s => <option key={s} value={s}>{s}</option>)
                : session.batch_id
                  ? <option disabled value="">No subjects in timetable yet</option>
                  : <option disabled value="">Select a batch first</option>
              }
            </select>
          </div>

          {/* Teacher — populated from staff_profiles, auto-fills from timetable */}
          <div>
            <label style={S.label}>
              Teacher
              {session.period_number && session.teacher_name && (
                <span style={{ marginLeft:'8px', fontSize:'10px', color:'#16a34a', fontWeight:'600' }}>✓ from timetable</span>
              )}
            </label>
            <select value={session.teacher_name} onChange={handleTeacher} style={S.select}>
              <option value="">Select Teacher</option>
              {batchStaff.map(s => <option key={s.id} value={s.name}>{s.name}{s.designation ? ' — ' + s.designation : ''}</option>)}
            </select>
          </div>

          <div>
            <label style={S.label}>Session Type</label>
            <select value={session.session_type}
              onChange={e => setSession(prev => ({ ...prev, session_type: e.target.value }))}
              style={S.select}>
              {['Class','Test','Activity','Event'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

        </div>

        {/* Status banner */}
        {session.course && (
          <div style={{ marginTop:'16px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:'600',
            background: students.length > 0 ? '#f0fdf4' : '#fef9c3',
            border: `1px solid ${students.length > 0 ? '#bbf7d0' : '#fde68a'}`,
            color: students.length > 0 ? '#16a34a' : '#92400e'
          }}>
            {students.length > 0
              ? `✅ ${students.length} enrolled students found for ${session.course}${session.subtype ? ' / ' + session.subtype : ''}${session.class_name ? ' / ' + session.class_name : ''}`
              : `⚠️ No enrolled students found. Check Course → Enrollments.`
            }
            {timetable.length > 0 && (
              <span style={{ marginLeft:'16px', fontSize:'11px', color:'#0891b2', fontWeight:'600' }}>
                📅 {timetable.length} timetable slots · {batchSubjects.length} subjects loaded
              </span>
            )}
          </div>
        )}
      </div>

      {students.length > 0 && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>
              Step 2 — Mark Attendance
              <span style={{ marginLeft:'10px', fontSize:'13px', color:'#64748b', fontWeight:'400' }}>
                {session.course}{session.subtype ? ' / ' + session.subtype : ''}{session.class_name ? ' / ' + session.class_name : ''} · {fmtDate(session.session_date)}
                {session.subject_name && ` · ${session.subject_name}`}
              </span>
            </h2>
            <div style={{ display:'flex', gap:'8px' }}>
              {ATTENDANCE_STATUSES.map(s => (
                <button key={s} onClick={() => markAll(s)}
                  style={{ ...S.btnSm(STATUS_STYLE[s].color), background:STATUS_STYLE[s].bg, border:`1px solid ${STATUS_STYLE[s].border}`, color:STATUS_STYLE[s].color }}>
                  Mark All {s}
                </button>
              ))}
            </div>
          </div>

          {/* Stats summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
            {ATTENDANCE_STATUSES.map(s => {
              const st = STATUS_STYLE[s]
              return (
                <div key={s} style={{ background:st.bg, border:`1px solid ${st.border}`, borderRadius:'10px', padding:'12px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:'22px', fontWeight:'800', color:st.color }}>{stats[s]}</div>
                  <div style={{ fontSize:'12px', color:st.color, fontWeight:'600' }}>{STATUS_ICON[s]} {s}</div>
                </div>
              )
            })}
          </div>

          {/* Student list */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {students.map((s, i) => {
              const status = records[s.student_name] || 'Present'
              const st = STATUS_STYLE[status]
              return (
                <div key={s.id || i} style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px',
                  borderRadius:'10px', transition:'all 0.2s',
                  background: status === 'Absent' ? '#fff5f5' : 'white',
                  border: `1px solid ${status === 'Absent' ? '#fecaca' : '#e2e8f0'}`,
                }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:st.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', color:st.color, flexShrink:0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'600', color:'#1e293b', fontSize:'14px' }}>{s.student_name}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>
                      {s.gcc_no && <span style={{ fontWeight:'700', color:'#1d4ed8', marginRight:'8px' }}>GCC-{s.gcc_no}</span>}
                      {s.hostel_type && <span>{s.hostel_type}</span>}
                    </div>
                  </div>
                  <StatusBtn status={status} onChange={next => setRecords(prev => ({ ...prev, [s.student_name]: next }))} />
                </div>
              )
            })}
          </div>

          {/* Remarks + Save */}
          <div style={{ marginTop:'20px', borderTop:'1px solid #e2e8f0', paddingTop:'20px', display:'flex', gap:'16px', alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <label style={S.label}>Session Remarks</label>
              <input value={session.remarks}
                onChange={e => setSession(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Any notes about this session..."
                style={S.input} />
            </div>
            <button onClick={handleSave} disabled={saving} style={S.btn('#16a34a', saving)}>
              {saving ? '⏳ Saving...' : `✅ Save Attendance (${students.length} students)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: View Sessions ───────────────────────────────────────

function TabView({ courseData }) {
  const [sessions,     setSessions]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [expanded,     setExpanded]     = useState(null)
  const [records,      setRecords]      = useState({})
  const [dateFilter,   setDateFilter]   = useState('')
  const [courseFilter, setCourseFilter] = useState('All')

  const { courses } = courseData

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }).limit(100)
    if (dateFilter)             q = q.eq('session_date', dateFilter)
    if (courseFilter !== 'All') q = q.eq('course', courseFilter)
    const { data } = await q
    setSessions(data || [])
    setLoading(false)
  }, [dateFilter, courseFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const loadRecords = async (sessionId) => {
    if (records[sessionId]) { setExpanded(expanded === sessionId ? null : sessionId); return }
    const { data } = await supabase.from('attendance_records').select('*').eq('session_id', sessionId).order('student_name')
    setRecords(prev => ({ ...prev, [sessionId]: data || [] }))
    setExpanded(sessionId)
  }

  const deleteSession = async (id) => {
    if (!window.confirm('Delete this session and all its records?')) return
    await supabase.from('attendance_sessions').delete().eq('id', id)
    fetchSessions()
    if (expanded === id) setExpanded(null)
  }

  const sessionStats = (recs) => {
    const counts = { Present:0, Absent:0, Late:0, Leave:0 }
    recs.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })
    return counts
  }

  return (
    <div>
      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ ...S.select, width:'auto' }}>
          <option value="All">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(dateFilter || courseFilter !== 'All') && (
          <button onClick={() => { setDateFilter(''); setCourseFilter('All') }} style={S.btnSm('#64748b')}>✕ Clear</button>
        )}
        <span style={{ fontSize:'13px', color:'#64748b', marginLeft:'auto' }}>{sessions.length} sessions</span>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {sessions.map(sess => {
            const isOpen = expanded === sess.id
            const recs   = records[sess.id] || []
            const stats  = isOpen ? sessionStats(recs) : null
            return (
              <div key={sess.id} style={{ border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden', background:'white' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px', cursor:'pointer' }}
                  onClick={() => loadRecords(sess.id)}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'14px' }}>{fmtDate(sess.session_date)}</span>
                      <span style={{ padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', background:'#eff6ff', color:'#1e3a5f' }}>{sess.course}</span>
                      {sess.subtype    && <span style={{ fontSize:'12px', color:'#64748b' }}>{sess.subtype}</span>}
                      {sess.class_name && <span style={{ fontSize:'12px', color:'#64748b' }}>{sess.class_name}</span>}
                      {sess.subject_name && <span style={{ fontSize:'12px', color:'#7c3aed', fontWeight:'600' }}>{sess.subject_name}</span>}
                      <span style={{ padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'600', background:'#f1f5f9', color:'#64748b' }}>{sess.session_type}</span>
                    </div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>
                      {sess.teacher_name && `👨‍🏫 ${sess.teacher_name}`}
                      {sess.period_number && ` · P${sess.period_number}`}
                      {sess.batch_id && ' · ✓ batch linked'}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    <button onClick={e => { e.stopPropagation(); deleteSession(sess.id) }} style={S.btnSm('#dc2626')}>🗑</button>
                    <span style={{ fontSize:'18px', color:'#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop:'1px solid #f1f5f9', padding:'16px 18px' }}>
                    <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                      {ATTENDANCE_STATUSES.map(s => {
                        const st = STATUS_STYLE[s]
                        return stats[s] > 0 ? (
                          <span key={s} style={{ padding:'4px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:'700', background:st.bg, color:st.color, border:`1px solid ${st.border}` }}>
                            {STATUS_ICON[s]} {stats[s]} {s}
                          </span>
                        ) : null
                      })}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'8px' }}>
                      {recs.map(r => {
                        const st = STATUS_STYLE[r.status] || STATUS_STYLE.Present
                        return (
                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', borderRadius:'8px', background:st.bg, border:`1px solid ${st.border}` }}>
                            <span style={{ fontSize:'14px' }}>{STATUS_ICON[r.status]}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'12px', fontWeight:'600', color:'#1e293b' }}>{r.student_name}</div>
                              {r.gcc_no && <div style={{ fontSize:'10px', color:'#64748b' }}>GCC-{r.gcc_no}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {sessions.length === 0 && <div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>No sessions found.</div>}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Reports ─────────────────────────────────────────────

function TabReport({ courseData }) {
  const [month,          setMonth]    = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [courseFilter,   setCourse]   = useState('All')
  const [subtypeFilter,  setSubtype]  = useState('All')
  const [data,           setData]     = useState([])
  const [loading,        setLoading]  = useState(false)

  const { courses, subtypesFor } = courseData
  const subtypes = courseFilter !== 'All' ? subtypesFor(courseFilter) : []

  const fetchReport = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions')
      .select('id,session_date,course,subtype,class_name,subject_name')
      .gte('session_date', `${month}-01`)
      .lte('session_date', `${month}-31`)
    if (courseFilter  !== 'All') q = q.eq('course',  courseFilter)
    if (subtypeFilter !== 'All') q = q.eq('subtype', subtypeFilter)
    const { data: sessions } = await q

    if (!sessions?.length) { setData([]); setLoading(false); return }

    const sessionIds = sessions.map(s => s.id)
    const { data: recs } = await supabase.from('attendance_records')
      .select('session_id, student_name, gcc_no, status')
      .in('session_id', sessionIds)

    const map = {}
    recs?.forEach(r => {
      if (!map[r.student_name]) map[r.student_name] = { student_name: r.student_name, gcc_no: r.gcc_no, Present:0, Absent:0, Late:0, Leave:0, total:0 }
      map[r.student_name][r.status] = (map[r.student_name][r.status] || 0) + 1
      map[r.student_name].total++
    })

    const rows = Object.values(map).map(s => ({
      ...s,
      pct: s.total > 0 ? Math.round((s.Present / s.total) * 100) : 0,
    })).sort((a,b) => a.pct - b.pct)

    setData(rows)
    setLoading(false)
  }, [month, courseFilter, subtypeFilter])

  useEffect(() => { fetchReport() }, [fetchReport])

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📊 Monthly Attendance Report</h2>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'center' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
          <select value={courseFilter} onChange={e => { setCourse(e.target.value); setSubtype('All') }} style={{ ...S.select, width:'auto' }}>
            <option value="All">All Courses</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {subtypes.length > 0 && (
            <select value={subtypeFilter} onChange={e => setSubtype(e.target.value)} style={{ ...S.select, width:'auto' }}>
              <option value="All">All Subtypes</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button onClick={() => window.print()} style={S.btn('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'32px', color:'#64748b' }}>⏳ Loading...</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>No attendance data for this period.</div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
            {[
              { label:'Students',        value:data.length,                             color:'#1e3a5f', bg:'#eff6ff' },
              { label:'≥75% Attendance', value:data.filter(r=>r.pct>=75).length,        color:'#16a34a', bg:'#dcfce7' },
              { label:'50–74%',          value:data.filter(r=>r.pct>=50&&r.pct<75).length, color:'#ca8a04', bg:'#fef9c3' },
              { label:'<50% (Risk)',     value:data.filter(r=>r.pct<50).length,         color:'#dc2626', bg:'#fee2e2' },
            ].map(c => (
              <div key={c.label} style={{ background:c.bg, borderRadius:'10px', padding:'14px 16px', borderLeft:`4px solid ${c.color}` }}>
                <div style={{ fontSize:'12px', color:c.color, fontWeight:'600' }}>{c.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'800', color:c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ border:'1px solid #e2e8f0', borderRadius:'10px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['#','Student','GCC','Present','Absent','Late','Leave','Total','%','Status'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const color = row.pct >= 75 ? '#16a34a' : row.pct >= 50 ? '#ca8a04' : '#dc2626'
                  const bg    = row.pct < 50 ? '#fff5f5' : 'white'
                  return (
                    <tr key={row.student_name} style={{ borderBottom:'1px solid #f1f5f9', background:bg }}>
                      <td style={{ padding:'10px 14px', color:'#94a3b8' }}>{i+1}</td>
                      <td style={{ padding:'10px 14px', fontWeight:'600', color:'#1e293b' }}>{row.student_name}</td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:'12px', color:'#1d4ed8', fontWeight:'700' }}>{row.gcc_no ? `GCC-${row.gcc_no}` : '—'}</td>
                      <td style={{ padding:'10px 14px', color:'#16a34a', fontWeight:'700' }}>{row.Present}</td>
                      <td style={{ padding:'10px 14px', color:'#dc2626', fontWeight:'700' }}>{row.Absent}</td>
                      <td style={{ padding:'10px 14px', color:'#92400e', fontWeight:'700' }}>{row.Late}</td>
                      <td style={{ padding:'10px 14px', color:'#7c3aed', fontWeight:'700' }}>{row.Leave}</td>
                      <td style={{ padding:'10px 14px', color:'#64748b' }}>{row.total}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ flex:1, height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden', minWidth:'60px' }}>
                            <div style={{ width:`${row.pct}%`, height:'100%', background:color, borderRadius:'3px' }} />
                          </div>
                          <span style={{ fontWeight:'700', color, minWidth:'36px' }}>{row.pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 8px', borderRadius:'999px',
                          background: row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2', color }}>
                          {row.pct >= 75 ? '✅ Good' : row.pct >= 50 ? '⚠️ Low' : '🚨 Risk'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────

function Attendance() {
  const [activeTab, setActiveTab] = useState('mark')
  const [staff,     setStaff]     = useState([])
  const courseData                = useCourseData()   // from Courses.jsx

  useEffect(() => {
    supabase
      .from('staff_profiles')
      .select('id, name, designation')
      .order('name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  return (
    <div style={S.page}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'26px', fontWeight:'bold', color:'#1e3a5f', margin:0 }}>📅 Attendance</h1>
        <p style={{ color:'#64748b', fontSize:'14px', margin:'4px 0 0' }}>Mark · View · Reports — tied to course batches</p>
      </div>

      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:'24px', gap:'4px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab===t.key)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'mark'   && <TabMark   courseData={courseData} staff={staff} />}
      {activeTab === 'view'   && <TabView   courseData={courseData} />}
      {activeTab === 'report' && <TabReport courseData={courseData} />}
    </div>
  )
}

export default Attendance
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics', 'English', 'General Knowledge', 'General Science',
  'Social Science', 'Reasoning', 'Current Affairs', 'Hindi',
  'Computer Science', 'Physical Education',
]

const DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

const TABS = [
  { key: 'logs',      label: '📋 Daily Logs' },
  { key: 'calendar',  label: '📅 Calendar' },
  { key: 'syllabus',  label: '📊 Syllabus' },
  { key: 'timetable', label: '🕐 Timetable' },
  { key: 'reports',   label: '📈 Reports' },
  { key: 'search',    label: '🔍 Topic Search' },
]

const today            = () => new Date().toISOString().split('T')[0]
const currentYearMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const fmtDate          = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }

const emptyLog = {
  course: '', subtype: '', class_name: '', batch_id: '',
  subject_name: '', teacher_name: '', staff_id: '',
  teaching_date: today(), topic_taught: '', classwork: '',
  homework: '', remarks: '', period_number: '',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page:   { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card:   { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn:    (color='#1e3a5f', disabled=false) => ({ backgroundColor: disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor:disabled?'not-allowed':'pointer', fontSize:'14px' }),
  btnSm:  (color='#1e3a5f') => ({ backgroundColor:color, color:'white', border:'none', borderRadius:'6px', padding:'6px 12px', fontWeight:'600', cursor:'pointer', fontSize:'12px' }),
  input:  { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  label:  { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  tab:    (active) => ({ padding:'10px 18px', fontWeight:'600', fontSize:'13px', cursor:'pointer', background:'none', border:'none', borderBottom: active?'3px solid #1e3a5f':'3px solid transparent', color: active?'#1e3a5f':'#64748b' }),
  select: { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
}

// ─── Shared Hook: Course Data from course_batches ─────────────────────────────

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

  const subtypesFor = useCallback((course) =>
    [...new Set(batches.filter(b => b.course === course).map(b => b.subtype).filter(Boolean))],
  [batches])

  const classesFor = useCallback((course, subtype) =>
    [...new Set(
      batches
        .filter(b => b.course === course && (!subtype || b.subtype === subtype))
        .map(b => b.class_name)
        .filter(Boolean)
    )],
  [batches])

  // find the batch_id for a given course+subtype+class combination
  const batchIdFor = useCallback((course, subtype, className) =>
    batches.find(b =>
      b.course === course &&
      (!subtype    || b.subtype    === subtype) &&
      (!className  || b.class_name === className)
    )?.id || '',
  [batches])

  return { batches, courses, subtypesFor, classesFor, batchIdFor, loading }
}

// ─── 3-Level Course Selector ─────────────────────────────────────────────────

function CoursePicker({ form, setForm, courseData }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData

  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  const handleCourse = (course) => {
    setForm(f => ({ ...f, course, subtype: '', class_name: '', batch_id: '' }))
  }

  const handleSubtype = (subtype) => {
    const cls = classesFor(form.course, subtype)
    const class_name = cls.length === 1 ? cls[0] : ''
    const batch_id   = class_name ? batchIdFor(form.course, subtype, class_name) : ''
    setForm(f => ({ ...f, subtype, class_name, batch_id }))
  }

  const handleClass = (class_name) => {
    const batch_id = batchIdFor(form.course, form.subtype, class_name)
    setForm(f => ({ ...f, class_name, batch_id }))
  }

  return (
    <>
      {/* Level 1: Course */}
      <div>
        <label style={S.label}>Course</label>
        <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
          <option value="">Select Course</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Level 2: Subtype (what was previously called "batch") */}
      <div>
        <label style={S.label}>Subtype / Batch</label>
        <select
          value={form.subtype}
          onChange={e => handleSubtype(e.target.value)}
          disabled={!form.course}
          required
          style={{ ...S.select, opacity: form.course ? 1 : 0.5 }}
        >
          <option value="">Select Subtype</option>
          {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Level 3: Class */}
      <div>
        <label style={S.label}>
          Class
          {form.batch_id && (
            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '400', color: '#16a34a' }}>
              ✓ linked to batch
            </span>
          )}
        </label>
        {classes.length > 0 ? (
          <select
            value={form.class_name}
            onChange={e => handleClass(e.target.value)}
            disabled={!form.subtype}
            style={{ ...S.select, opacity: form.subtype ? 1 : 0.5 }}
          >
            <option value="">Select Class</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input
            value={form.class_name}
            onChange={e => handleClass(e.target.value)}
            placeholder="e.g. Class 6"
            disabled={!form.subtype}
            style={{ ...S.input, opacity: form.subtype ? 1 : 0.5 }}
          />
        )}
      </div>
    </>
  )
}

// ─── Shared: Log Form ─────────────────────────────────────────────────────────

function LogForm({ form, setForm, onSubmit, saving, timetable, staff, onCancel, editMode=false, courseData }) {
  const handlePeriodSelect = (e) => {
  const pn = parseInt(e.target.value)
  if (!pn || !form.course || !form.subtype) {
    setForm(f => ({ ...f, period_number: pn || '' }))
    return
  }

  const dayName = DAYS[new Date().getDay() - 1] || 'Monday'

  // Now reads from timetable_entries
  // class_name in timetable_entries = batch/subtype name
  const slot = timetable.find(t =>
    t.class_name === form.subtype &&   // ← key fix: was t.batch
    t.period_name === String(pn) &&    // ← key fix: period_name is string
    t.day_name === dayName             // ← key fix: was t.day_of_week
  )

  if (slot) {
    const matchedStaff = staff.find(s => s.name === slot.teacher_name)
    setForm(f => ({
      ...f,
      period_number: pn,
      subject_name:  slot.subject_name  || f.subject_name,
      teacher_name:  slot.teacher_name  || f.teacher_name,
      staff_id:      matchedStaff?.id   || f.staff_id,
    }))
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* 3-level course picker */}
        <CoursePicker form={form} setForm={setForm} courseData={courseData} />

        {/* Period */}
        <div>
          <label style={S.label}>Period (optional — auto-fills subject)</label>
          <select value={form.period_number} onChange={handlePeriodSelect} style={S.select}>
            <option value="">No Period</option>
            {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label style={S.label}>Subject</label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Teacher */}
        <div>
          <label style={S.label}>Teacher</label>
          <select value={form.teacher_name} onChange={handleTeacherChange} style={S.select}>
            <option value="">Select Teacher</option>
            {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.designation || '-'})</option>)}
          </select>
        </div>

        {/* Date */}
        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date: e.target.value }))} required style={S.input} />
        </div>

        {/* Topic */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Topic Taught</label>
          <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught: e.target.value }))} required placeholder="Enter topic" style={S.input} />
        </div>

        {/* Classwork */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Classwork</label>
          <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork: e.target.value }))} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Classwork details" />
        </div>

        {/* Homework */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Homework</label>
          <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework: e.target.value }))} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Homework details" />
        </div>

        {/* Remarks */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Remarks</label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="Any remarks" />
        </div>
      </div>

      {/* batch_id linkage indicator */}
      {form.batch_id && (
        <div style={{ marginTop: '12px', padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
          ✅ Linked to batch_id: {form.batch_id}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button type="submit" disabled={saving} style={S.btn(editMode ? '#7c3aed' : '#1e3a5f', saving)}>
          {saving ? '⏳ Saving...' : editMode ? '✏️ Update Log' : '✅ Save Log'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={S.btn('#64748b')}>✖ Cancel</button>}
      </div>
    </form>
  )
}

// ─── Tab: Daily Logs ──────────────────────────────────────────────────────────

function TabLogs({ logs, loading, fetchLogs, timetable, staff, courseData }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ ...emptyLog, teaching_date: today() })
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [search, setSearch]     = useState('')
  const [courseFilter, setCourseFilter]   = useState('All')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [dupWarn, setDupWarn]   = useState('')

  const { courses } = courseData

  const checkDuplicate = useCallback((f) => {
    if (!f.course || !f.subtype || !f.subject_name || !f.teaching_date) return false
    return logs.some(l =>
      l.course === f.course && l.subtype === f.subtype &&
      l.class_name === f.class_name &&
      l.subject_name === f.subject_name && l.teaching_date === f.teaching_date &&
      (editId ? l.id !== editId : true)
    )
  }, [logs, editId])

  const buildPayload = (f) => ({
    course:        f.course,
    subtype:       f.subtype       || null,
    class_name:    f.class_name    || null,
    batch_id:      f.batch_id      || null,
    subject_name:  f.subject_name,
    teacher_name:  f.teacher_name  || null,
    staff_id:      f.staff_id      || null,
    teaching_date: f.teaching_date,
    topic_taught:  f.topic_taught,
    classwork:     f.classwork     || null,
    homework:      f.homework      || null,
    remarks:       f.remarks       || null,
    period_number: f.period_number || null,
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    if (checkDuplicate(form)) {
      setDupWarn(`⚠️ A log for ${form.course} / ${form.subtype} / ${form.class_name} / ${form.subject_name} on ${form.teaching_date} already exists.`)
      return
    }
    setDupWarn('')
    setSaving(true)
    const { error } = await supabase.from('teaching_logs').insert([buildPayload(form)])
    if (error) alert('Error: ' + error.message)
    else { setForm({ ...emptyLog, teaching_date: today() }); setShowForm(false); fetchLogs() }
    setSaving(false)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (checkDuplicate(editForm)) {
      alert(`⚠️ Duplicate log exists.`)
      return
    }
    setEditSaving(true)
    const { error } = await supabase.from('teaching_logs').update(buildPayload(editForm)).eq('id', editId)
    if (error) alert('Error: ' + error.message)
    else { setEditId(null); setEditForm(null); fetchLogs() }
    setEditSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this log?')) return
    const { error } = await supabase.from('teaching_logs').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchLogs()
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({
      course:        item.course        || '',
      subtype:       item.subtype       || '',
      class_name:    item.class_name    || '',
      batch_id:      item.batch_id      || '',
      subject_name:  item.subject_name  || '',
      teacher_name:  item.teacher_name  || '',
      staff_id:      item.staff_id      || '',
      teaching_date: item.teaching_date || today(),
      topic_taught:  item.topic_taught  || '',
      classwork:     item.classwork     || '',
      homework:      item.homework      || '',
      remarks:       item.remarks       || '',
      period_number: item.period_number || '',
    })
  }

  const uniqueSubjects = [...new Set(logs.map(l => l.subject_name).filter(Boolean))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(item => {
      const matchSearch = ['course','subtype','class_name','subject_name','teacher_name','topic_taught','classwork','homework','remarks']
        .some(k => (item[k] || '').toLowerCase().includes(q))
      const matchCourse  = courseFilter  === 'All' || item.course       === courseFilter
      const matchSubject = subjectFilter === 'All' || item.subject_name === subjectFilter
      return matchSearch && matchCourse && matchSubject
    })
  }, [logs, search, courseFilter, subjectFilter])

  const todayCount = logs.filter(l => l.teaching_date === today()).length

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label:'Total Logs',  value:logs.length,  color:'#1e3a5f', bg:'#eff6ff', icon:'📋' },
          { label:'Today Logs',  value:todayCount,   color:'#16a34a', bg:'#dcfce7', icon:'📅' },
          { label:'Subjects',    value:[...new Set(logs.map(l=>l.subject_name).filter(Boolean))].length, color:'#7c3aed', bg:'#f3e8ff', icon:'📚' },
          { label:'Teachers',   value:[...new Set(logs.map(l=>l.teacher_name).filter(Boolean))].length, color:'#ca8a04', bg:'#fef9c3', icon:'👨‍🏫' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:'12px', padding:'18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{c.icon}</div>
            <p style={{ fontSize:'13px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize:'28px', fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
          </div>
        ))}
      </div>

      {/* Add Form */}
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showForm ? '20px' : 0 }}>
          <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>➕ Add Teaching Log</h2>
          <button onClick={() => { setShowForm(!showForm); setDupWarn('') }} style={S.btn(showForm ? '#64748b' : '#1e3a5f')}>
            {showForm ? '✖ Cancel' : '➕ Add Log'}
          </button>
        </div>
        {dupWarn && <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #f59e0b', borderRadius:'8px', color:'#92400e', fontSize:'13px', marginBottom:'12px' }}>{dupWarn}</div>}
        {showForm && (
          <LogForm
            form={form} setForm={setForm}
            onSubmit={handleAdd} saving={saving}
            timetable={timetable} staff={staff}
            courseData={courseData}
          />
        )}
      </div>

      {/* Filters */}
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

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading...</div>
      ) : (
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
                  <tr key={item.id} style={{ borderBottom: editId===item.id ? 'none' : '1px solid #f1f5f9', background: editId===item.id ? '#f8f4ff' : 'white' }}>
                    <td style={{ padding:'12px 14px', color:'#64748b' }}>{i+1}</td>
                    <td style={{ padding:'12px 14px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(item.teaching_date)}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <span style={{ padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', background:'#eff6ff', color:'#1e3a5f' }}>{item.course || '-'}</span>
                    </td>
                    <td style={{ padding:'12px 14px', color:'#64748b', fontSize:'13px' }}>{item.subtype || '-'}</td>
                    <td style={{ padding:'12px 14px', color:'#64748b', fontSize:'13px' }}>{item.class_name || '-'}</td>
                    <td style={{ padding:'12px 14px', fontWeight:'600', color:'#1e3a5f' }}>{item.subject_name}</td>
                    <td style={{ padding:'12px 14px', color:'#64748b' }}>{item.teacher_name || '-'}</td>
                    <td style={{ padding:'12px 14px', color:'#64748b', maxWidth:'200px' }}>{item.topic_taught}</td>
                    <td style={{ padding:'12px 14px', color:'#64748b', maxWidth:'160px' }}>{item.homework || '-'}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => editId===item.id ? (setEditId(null),setEditForm(null)) : startEdit(item)} style={S.btnSm('#7c3aed')}>
                          {editId===item.id ? '✖' : '✏️'}
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={S.btnSm('#dc2626')}>🗑</button>
                      </div>
                    </td>
                  </tr>
                  {editId===item.id && (
                    <tr key={`edit-${item.id}`} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td colSpan={10} style={{ padding:'16px 24px', background:'#f8f4ff' }}>
                        <div style={{ fontSize:'14px', fontWeight:'700', color:'#7c3aed', marginBottom:'12px' }}>✏️ Edit Log</div>
                        <LogForm
                          form={editForm} setForm={setEditForm}
                          onSubmit={handleEdit} saving={editSaving}
                          timetable={timetable} staff={staff}
                          onCancel={() => { setEditId(null); setEditForm(null) }}
                          courseData={courseData}
                          editMode
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>No teaching logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── Tab: Calendar ────────────────────────────────────────────────────────────

function TabCalendar({ logs, missed }) {
  const [month, setMonth]         = useState(currentYearMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const [year, mon] = month.split('-').map(Number)
  const firstDay    = new Date(year, mon-1, 1).getDay()
  const daysInMonth = new Date(year, mon, 0).getDate()
  const blanks      = firstDay === 0 ? 6 : firstDay - 1

  const logsByDate = useMemo(() => {
    const map = {}
    logs.forEach(l => {
      if (l.teaching_date?.startsWith(month)) {
        const d = parseInt(l.teaching_date.split('-')[2])
        if (!map[d]) map[d] = []
        map[d].push(l)
      }
    })
    return map
  }, [logs, month])

  const missedByDate = useMemo(() => {
    const map = {}
    missed.forEach(m => {
      if (m.missed_date?.startsWith(month)) {
        const d = parseInt(m.missed_date.split('-')[2])
        if (!map[d]) map[d] = []
        map[d].push(m)
      }
    })
    return map
  }, [missed, month])

  const selectedLogs   = selectedDay ? (logsByDate[selectedDay]   || []) : []
  const selectedMissed = selectedDay ? (missedByDate[selectedDay] || []) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📅 Calendar View</h2>
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelectedDay(null) }}
          style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
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
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'12px', fontWeight:'700', color:'#64748b', padding:'4px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {Array.from({ length: blanks }).map((_,i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_,i) => {
          const day       = i + 1
          const hasLogs   = !!logsByDate[day]?.length
          const hasMissed = !!missedByDate[day]?.length
          const isSelected = selectedDay === day
          const bg    = isSelected ? '#1e3a5f' : hasLogs ? '#dcfce7' : hasMissed ? '#fee2e2' : '#f8fafc'
          const color = isSelected ? 'white'   : hasLogs ? '#16a34a' : hasMissed ? '#dc2626' : '#94a3b8'
          return (
            <div key={day} onClick={() => setSelectedDay(day===selectedDay ? null : day)}
              style={{ background:bg, border:`1px solid ${isSelected?'#1e3a5f':hasLogs?'#bbf7d0':hasMissed?'#fecaca':'#e2e8f0'}`,
                borderRadius:'8px', padding:'10px 4px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
              <div style={{ fontSize:'14px', fontWeight:'700', color }}>{day}</div>
              {hasLogs   && <div style={{ fontSize:'10px', color:isSelected?'#bbf7d0':'#16a34a' }}>{logsByDate[day].length} log{logsByDate[day].length>1?'s':''}</div>}
              {hasMissed && <div style={{ fontSize:'10px', color:isSelected?'#fecaca':'#dc2626' }}>missed</div>}
            </div>
          )
        })}
      </div>
      {selectedDay && (
        <div style={{ marginTop:'20px', borderTop:'1px solid #e2e8f0', paddingTop:'20px' }}>
          <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>
            {selectedDay} {new Date(year, mon-1).toLocaleString('default', { month:'long' })} {year}
          </h3>
          {selectedLogs.length===0 && selectedMissed.length===0 && <p style={{ color:'#94a3b8', fontSize:'14px' }}>No activity recorded.</p>}
          {selectedLogs.map(l => (
            <div key={l.id} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'12px 16px', marginBottom:'10px' }}>
              <div style={{ fontWeight:'700', color:'#15803d', fontSize:'14px' }}>{l.subject_name} — {l.course} / {l.subtype} / {l.class_name}</div>
              <div style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>👨‍🏫 {l.teacher_name || '-'} | 📖 {l.topic_taught}</div>
              {l.homework && <div style={{ fontSize:'13px', color:'#64748b', marginTop:'2px' }}>📝 HW: {l.homework}</div>}
            </div>
          ))}
          {selectedMissed.map(m => (
            <div key={m.id} style={{ background:'#fff1f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px 16px', marginBottom:'10px' }}>
              <div style={{ fontWeight:'700', color:'#dc2626', fontSize:'14px' }}>❌ Missed — {m.subject_name} ({m.course} / {m.subtype})</div>
              <div style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>Reason: {m.reason} {m.remarks ? `| ${m.remarks}` : ''}</div>
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
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('teaching_syllabus').upsert([{
      course:       form.course,
      subtype:      form.subtype       || null,
      class_name:   form.class_name    || null,
      subject_name: form.subject_name,
      total_topics: parseInt(form.total_topics),
    }], { onConflict: 'course,subtype,class_name,subject_name' })
    if (error) alert('Error: ' + error.message)
    else { setForm({ course:'', subtype:'', class_name:'', subject_name:'', total_topics:'' }); setShowForm(false); fetchSyllabus() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete syllabus entry?')) return
    await supabase.from('teaching_syllabus').delete().eq('id', id)
    fetchSyllabus()
  }

  const getCompleted = (row) =>
    logs.filter(l =>
      l.course === row.course &&
      l.subtype === row.subtype &&
      (!row.class_name || l.class_name === row.class_name) &&
      l.subject_name === row.subject_name
    ).length

  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📊 Syllabus Tracker</h2>
        <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm ? '#64748b' : '#1e3a5f')}>
          {showForm ? '✖ Cancel' : '➕ Add Syllabus'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr auto', gap:'12px', alignItems:'flex-end', marginBottom:'24px', padding:'16px', background:'#f8fafc', borderRadius:'8px' }}>
          <div>
            <label style={S.label}>Course</label>
            <select value={form.course} onChange={e => setForm(f => ({ ...f, course:e.target.value, subtype:'', class_name:'' }))} required style={S.select}>
              <option value="">Select</option>
              {courseData.courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Subtype</label>
            <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype:e.target.value, class_name:'' }))} style={S.select}>
              <option value="">All</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Class</label>
            {classes.length > 0
              ? <select value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name:e.target.value }))} style={S.select}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              : <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name:e.target.value }))} placeholder="Optional" style={S.input} />
            }
          </div>
          <div>
            <label style={S.label}>Subject</label>
            <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))} required style={S.select}>
              <option value="">Select</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Total Topics</label>
            <input type="number" min="1" value={form.total_topics} onChange={e => setForm(f => ({ ...f, total_topics:e.target.value }))} required style={S.input} placeholder="e.g. 40" />
          </div>
          <button type="submit" disabled={saving} style={{ ...S.btn('#16a34a', saving), whiteSpace:'nowrap' }}>
            {saving ? '⏳' : '✅ Save'}
          </button>
        </form>
      )}
      {loading ? <div style={{ textAlign:'center', padding:'32px', color:'#64748b' }}>⏳ Loading...</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {syllabus.length === 0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No syllabus defined yet.</div>}
          {syllabus.map(row => {
            const done  = getCompleted(row)
            const pct   = row.total_topics > 0 ? Math.min(100, Math.round((done/row.total_topics)*100)) : 0
            const color = pct >= 100 ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#dc2626'
            return (
              <div key={row.id} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <div>
                    <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>{row.subject_name}</span>
                    <span style={{ marginLeft:'10px', fontSize:'12px', color:'#64748b' }}>
                      {row.course} / {row.subtype || 'All'} / {row.class_name || 'All Classes'}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'13px', fontWeight:'700', color }}>{done} / {row.total_topics} topics</span>
                    <span style={{ fontSize:'18px', fontWeight:'800', color }}>{pct}%</span>
                    <button onClick={() => handleDelete(row.id)} style={S.btnSm('#dc2626')}>🗑</button>
                  </div>
                </div>
                <div style={{ height:'10px', background:'#e2e8f0', borderRadius:'5px', overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'5px', transition:'width 0.4s' }} />
                </div>
                {pct >= 100 && <div style={{ fontSize:'12px', color:'#16a34a', marginTop:'6px', fontWeight:'600' }}>✅ Syllabus complete!</div>}
                {pct > 0 && pct < 100 && <div style={{ fontSize:'12px', color:'#64748b', marginTop:'6px' }}>{row.total_topics - done} topics remaining</div>}
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
  const [form, setForm]     = useState({ course:'', subtype:'', class_name:'', batch_id:'', subject_name:'', teacher_name:'', day_of_week:'Monday', period_number:1, start_time:'', end_time:'' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [viewCourse, setViewCourse] = useState('')
  const [viewSubtype, setViewSubtype] = useState('')
  const [viewClass, setViewClass]     = useState('')

  const { courses, subtypesFor, classesFor } = courseData

  // init view selectors
  useEffect(() => {
    if (courses.length && !viewCourse) {
      const c = courses[0]
      const s = subtypesFor(c)[0] || ''
      const cl = s ? classesFor(c, s)[0] || '' : ''
      setViewCourse(c); setViewSubtype(s); setViewClass(cl)
    }
  }, [courses])

  const handleSave = async (e) => {
  e.preventDefault()
  setSaving(true)

  // Write to timetable_entries (master Timetable module)
  const { error: ttErr } = await supabase
    .from('timetable_entries')
    .insert([{
      class_name:   form.subtype || form.class_name, // use subtype as batch name
      subject_name: form.subject_name,
      teacher_name: form.teacher_name || null,
      day_name:     form.day_of_week,
      period_name:  String(form.period_number),
    }])

  // Also write to teaching_timetable (Teaching's own table)
  const { error: teachErr } = await supabase
    .from('teaching_timetable')
    .upsert([{
      course:        form.course,
      subtype:       form.subtype      || null,
      class_name:    form.class_name   || null,
      batch_id:      form.batch_id     || null,
      subject_name:  form.subject_name,
      teacher_name:  form.teacher_name || null,
      day_of_week:   form.day_of_week,
      period_number: parseInt(form.period_number),
      start_time:    form.start_time   || null,
      end_time:      form.end_time     || null,
    }], { onConflict: 'course,subtype,class_name,day_of_week,period_number' })

  if (ttErr || teachErr) {
    alert('Error: ' + (ttErr?.message || teachErr?.message))
  } else {
    setShowForm(false)
    fetchTimetable()
  }
  setSaving(false)
}

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this period?')) return
    await supabase.from('teaching_timetable').delete().eq('id', id)
    fetchTimetable()
  }

  const getSlot = (day, period) =>
    timetable.find(t =>
      t.course === viewCourse && t.subtype === viewSubtype &&
      (!viewClass || t.class_name === viewClass) &&
      t.day_of_week === day && t.period_number === period
    )

  const viewSubtypes = viewCourse ? subtypesFor(viewCourse) : []
  const viewClasses  = (viewCourse && viewSubtype) ? classesFor(viewCourse, viewSubtype) : []

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>🕐 Timetable</h2>
        <button onClick={() => setShowForm(!showForm)} style={S.btn(showForm ? '#64748b' : '#1e3a5f')}>
          {showForm ? '✖ Cancel' : '➕ Add Period'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px', padding:'16px', background:'#f8fafc', borderRadius:'8px' }}>
          <CoursePicker form={form} setForm={setForm} courseData={courseData} />
          <div>
            <label style={S.label}>Day</label>
            <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week:e.target.value }))} required style={S.select}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Period</label>
            <select value={form.period_number} onChange={e => setForm(f => ({ ...f, period_number:e.target.value }))} required style={S.select}>
              {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Subject</label>
            <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value }))} required style={S.select}>
              <option value="">Select</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Teacher</label>
            <select value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name:e.target.value }))} style={S.select}>
              <option value="">Select</option>
              {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Start Time</label>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time:e.target.value }))} style={S.input} />
          </div>
          <div>
            <label style={S.label}>End Time</label>
            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time:e.target.value }))} style={S.input} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <button type="submit" disabled={saving} style={S.btn('#16a34a', saving)}>{saving ? '⏳ Saving...' : '✅ Save Period'}</button>
          </div>
        </form>
      )}

      {/* View selector */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>View:</span>
        <select value={viewCourse} onChange={e => { setViewCourse(e.target.value); setViewSubtype(''); setViewClass('') }} style={{ ...S.select, width:'auto' }}>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={viewSubtype} onChange={e => { setViewSubtype(e.target.value); setViewClass('') }} style={{ ...S.select, width:'auto' }}>
          <option value="">All Subtypes</option>
          {viewSubtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {viewClasses.length > 0 && (
          <select value={viewClass} onChange={e => setViewClass(e.target.value)} style={{ ...S.select, width:'auto' }}>
            <option value="">All Classes</option>
            {viewClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
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
                    <td key={day} style={{ padding:'8px', textAlign:'center', background: slot ? '#f0fdf4' : 'white' }}>
                      {slot ? (
                        <div>
                          <div style={{ fontWeight:'700', color:'#15803d', fontSize:'12px' }}>{slot.subject_name}</div>
                          <div style={{ fontSize:'11px', color:'#64748b' }}>{slot.teacher_name || '-'}</div>
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
  const monthMissed = missed.filter(m => m.missed_date?.startsWith(month)  && (teacher==='All'||m.teacher_name===teacher))

  const byTeacher = useMemo(() => {
    const map = {}
    monthLogs.forEach(l => {
      if (!l.teacher_name) return
      if (!map[l.teacher_name]) map[l.teacher_name] = { logs:[], subjects:new Set(), dates:new Set(), classes:new Set() }
      map[l.teacher_name].logs.push(l)
      map[l.teacher_name].subjects.add(l.subject_name)
      map[l.teacher_name].dates.add(l.teaching_date)
      if (l.class_name) map[l.teacher_name].classes.add(`${l.course}/${l.subtype}/${l.class_name}`)
    })
    return map
  }, [monthLogs])

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📈 Monthly Report</h2>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
          <select value={course} onChange={e => setCourse(e.target.value)} style={{ ...S.select, width:'auto' }}>
            <option value="All">All Courses</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={teacher} onChange={e => setTeacher(e.target.value)} style={{ ...S.select, width:'auto' }}>
            <option value="All">All Teachers</option>
            {teachers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => window.print()} style={S.btn('#7c3aed')}>🖨️ Print</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Classes Taken',    value:monthLogs.length,   color:'#1e3a5f', bg:'#eff6ff' },
          { label:'Missed Classes',   value:monthMissed.length, color:'#dc2626', bg:'#fee2e2' },
          { label:'Subjects Covered', value:new Set(monthLogs.map(l=>l.subject_name)).size, color:'#7c3aed', bg:'#f3e8ff' },
          { label:'Active Teachers',  value:Object.keys(byTeacher).length, color:'#16a34a', bg:'#dcfce7' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:'10px', padding:'16px', borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:'12px', color:c.color, fontWeight:'600' }}>{c.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:c.color, marginTop:'4px' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {Object.entries(byTeacher).map(([name, data]) => {
        const avgPerDay = data.dates.size > 0 ? (data.logs.length / data.dates.size).toFixed(1) : '0'
        return (
          <div key={name} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px', marginBottom:'12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>👨‍🏫 {name}</span>
              <span style={{ fontSize:'12px', color:'#64748b' }}>{data.logs.length} classes | {data.subjects.size} subjects | {avgPerDay} avg/day</span>
            </div>
            {data.classes.size > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                {[...data.classes].map(cl => (
                  <span key={cl} style={{ padding:'3px 10px', borderRadius:'999px', background:'#f0fdf4', color:'#16a34a', fontSize:'11px', fontWeight:'600', border:'1px solid #bbf7d0' }}>{cl}</span>
                ))}
              </div>
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
              {[...data.subjects].map(s => (
                <span key={s} style={{ padding:'3px 10px', borderRadius:'999px', background:'#eff6ff', color:'#1e3a5f', fontSize:'12px', fontWeight:'600' }}>{s}</span>
              ))}
            </div>
            <div style={{ marginTop:'8px', fontSize:'13px', color:'#64748b' }}>
              {[...data.logs].slice(0,5).map(l => (
                <div key={l.id} style={{ borderBottom:'1px solid #f1f5f9', padding:'4px 0' }}>
                  {fmtDate(l.teaching_date)} — {l.subject_name} [{l.course}/{l.subtype}/{l.class_name}]: <em>{l.topic_taught}</em>
                </div>
              ))}
              {data.logs.length > 5 && <div style={{ color:'#94a3b8', fontSize:'12px', marginTop:'4px' }}>+{data.logs.length-5} more</div>}
            </div>
          </div>
        )
      })}
      {Object.keys(byTeacher).length === 0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No logs for this period.</div>}
    </div>
  )
}

// ─── Tab: Topic Search ────────────────────────────────────────────────────────

function TabSearch({ logs }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return logs.filter(l =>
      (l.topic_taught || '').toLowerCase().includes(q) ||
      (l.classwork    || '').toLowerCase().includes(q) ||
      (l.homework     || '').toLowerCase().includes(q)
    ).sort((a,b) => b.teaching_date?.localeCompare(a.teaching_date))
  }, [logs, query])

  return (
    <div style={S.card}>
      <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🔍 Topic Search</h2>
      <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'16px' }}>Search across all topics, classwork, and homework ever recorded.</p>
      <input
        value={query} onChange={e => setQuery(e.target.value)}
        placeholder="e.g. Pythagoras, Photosynthesis, World War..."
        style={{ ...S.input, fontSize:'16px', padding:'14px 18px', marginBottom:'20px' }}
        autoFocus
      />
      {query && <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'12px' }}>{results.length} result{results.length!==1?'s':''} found</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {results.map(l => (
          <div key={l.id} style={{ border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span style={{ fontWeight:'700', color:'#1e293b' }}>{l.topic_taught}</span>
              <span style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(l.teaching_date)}</span>
            </div>
            <div style={{ fontSize:'13px', color:'#64748b' }}>
              {l.course} / {l.subtype} / {l.class_name} | {l.subject_name} | 👨‍🏫 {l.teacher_name || '-'}
            </div>
            {l.classwork && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>📝 CW: {l.classwork}</div>}
            {l.homework  && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>📚 HW: {l.homework}</div>}
          </div>
        ))}
        {query && results.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No results for "{query}"</div>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Teaching() {
  const [activeTab, setActiveTab] = useState('logs')
  const [logs,      setLogs]      = useState([])
  const [missed,    setMissed]    = useState([])
  const [timetable, setTimetable] = useState([])
  const [staff,     setStaff]     = useState([])
  const [loading,   setLoading]   = useState(true)

  // ── Single source of truth for courses/subtypes/classes ──
  const courseData = useCourseData()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('teaching_logs').select('*').order('teaching_date', { ascending:false })
    if (data) setLogs(data)
    setLoading(false)
  }, [])

  const fetchMissed = useCallback(async () => {
    const { data } = await supabase.from('teaching_missed').select('*').order('missed_date', { ascending:false })
    if (data) setMissed(data)
  }, [])

  const fetchTimetable = useCallback(async () => {
  // Read from timetable_entries (the master Timetable module table)
  const { data } = await supabase
    .from('timetable_entries')
    .select('*')
    .order('period_name')
  if (data) setTimetable(data)
}, [])

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from('staff_profiles').select('id,name,designation').eq('status','Active').order('name')
    if (data) setStaff(data)
  }, [])

  useEffect(() => {
    fetchLogs(); fetchMissed(); fetchTimetable(); fetchStaff()
  }, [])

  return (
    <div style={S.page}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'26px', fontWeight:'bold', color:'#1e3a5f', margin:0 }}>📘 Teaching Management</h1>
        <p style={{ color:'#64748b', fontSize:'14px', margin:'4px 0 0' }}>Daily logs · Syllabus · Timetable · Reports · Topic search</p>
      </div>

      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:'24px', gap:'4px', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab===t.key)}>{t.label}</button>
        ))}
      </div>

      {activeTab==='logs'      && <TabLogs      logs={logs} loading={loading} fetchLogs={fetchLogs} timetable={timetable} staff={staff} courseData={courseData} />}
      {activeTab==='calendar'  && <TabCalendar  logs={logs} missed={missed} />}
      {activeTab==='syllabus'  && <TabSyllabus  logs={logs} courseData={courseData} />}
      {activeTab==='timetable' && <TabTimetable timetable={timetable} fetchTimetable={fetchTimetable} staff={staff} courseData={courseData} />}
      {activeTab==='reports'   && <TabReports   logs={logs} missed={missed} staff={staff} courseData={courseData} />}
      {activeTab==='search'    && <TabSearch    logs={logs} />}
    </div>
  )
}

export default Teaching
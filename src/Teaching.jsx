import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import TabMonthlySyllabus from './TabMonthlySyllabus'

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II', 'English Grammar', 'General Knowledge', 'General Science',
  'Reasoning', 'Mental Ability', 'Hindi',
  'Vocabulary', 'Meitei Mayek',
]

const DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7]

const TABS = [
  { key: 'logs',      label: 'Daily Logs',       icon: '📋' },
  { key: 'calendar',  label: 'Calendar',          icon: '📅' },
  { key: 'syllabus',  label: 'Syllabus',          icon: '📊' },
  { key: 'timetable', label: 'Timetable',         icon: '🕐' },
  { key: 'reports',   label: 'Reports',           icon: '📈' },
  { key: 'search',    label: 'Topic Search',      icon: '🔍' },
  { key: 'monthly',   label: 'Monthly Syllabus',  icon: '📆' },
]

const today            = () => new Date().toISOString().split('T')[0]
const currentYearMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const fmtDate          = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }

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

  const batchIdFor = useCallback((course, subtype, className) =>
    batches.find(b =>
      b.course === course &&
      (!subtype   || b.subtype    === subtype) &&
      (!className || b.class_name === className)
    )?.id || '',
  [batches])

  return { batches, courses, subtypesFor, classesFor, batchIdFor, loading }
}

// ─── Shared Hook: Doubt Sessions ──────────────────────────────────────────────

function useDoubtSessions(logIds) {
  const [sessions, setSessions] = useState({})

  const refetch = useCallback(async () => {
    if (!logIds.length) return
    const { data } = await supabase
      .from('doubt_sessions')
      .select('*')
      .in('log_id', logIds)
    if (data) {
      const map = {}
      data.forEach(s => {
        if (!map[s.log_id]) map[s.log_id] = []
        map[s.log_id].push(s)
      })
      setSessions(map)
    }
  }, [logIds.join(',')])  // eslint-disable-line

  useEffect(() => { refetch() }, [refetch])
  return { sessions, refetch }
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
    const cls        = classesFor(form.course, subtype)
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
      <div>
        <label style={S.label}>Course</label>
        <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
          <option value="">Select Course</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

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

// ─── Doubt Session Sub-Row ────────────────────────────────────────────────────

function DoubtSessionSubRow({ logId, sessions, onRefetch, currentUser }) {
  const [resolvingId, setResolvingId] = useState(null)
  const [note, setNote]               = useState('')

  const list = sessions[logId] || []
  if (!list.length) return null

  const handleResolve = async (session) => {
    if (!note.trim()) { alert('Please enter a resolution note.'); return }
    setResolvingId(session.id)
    const { error } = await supabase
      .from('doubt_sessions')
      .update({
        status:          'resolved',
        resolved_by:     currentUser?.name || 'Staff',
        resolved_at:     new Date().toISOString(),
        resolution_note: note,
      })
      .eq('id', session.id)
    if (error) alert('Error: ' + error.message)
    else { onRefetch(); setNote('') }
    setResolvingId(null)
  }

  return (
    <tr>
      <td colSpan={10} style={{ padding: '0 16px 12px 48px', background: '#fffbeb' }}>
        <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', marginBottom: '8px' }}>
            🔁 Doubt Sessions
          </div>
          {list.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              flexWrap: 'wrap', padding: '10px 14px', marginBottom: '6px',
              borderRadius: '8px',
              background: s.status === 'resolved' ? '#f0fdf4' : '#fef9c3',
              border: `1px solid ${s.status === 'resolved' ? '#bbf7d0' : '#fde68a'}`,
            }}>
              {/* House + HM */}
              <div style={{ minWidth: '160px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                  🏠 {s.house_name || s.batch_name || '—'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  HM: {s.hm_name || s.staff_name || '—'}
                </div>
              </div>

              {/* Topic */}
              <div style={{ flex: 1, minWidth: '140px' }}>
                <div style={{ fontSize: '12px', color: '#374151' }}>📖 {s.topic}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.subject_name || s.subject}</div>
              </div>

              {/* Status badge */}
              <div style={{ minWidth: '100px' }}>
                {s.status === 'resolved' ? (
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#16a34a' }}>
                    ✅ Resolved
                  </span>
                ) : (
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', background: '#fef9c3', color: '#b45309' }}>
                    ⏳ Open
                  </span>
                )}
                {s.resolved_by && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>by {s.resolved_by}</div>
                )}
              </div>

              {/* Resolution note (if resolved) */}
              {s.status === 'resolved' && s.resolution_note && (
                <div style={{ fontSize: '11px', color: '#64748b', flex: 1 }}>
                  📝 {s.resolution_note}
                </div>
              )}

              {/* Resolve controls (if open) */}
              {s.status === 'open' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={resolvingId === s.id ? note : ''}
                    onChange={e => setNote(e.target.value)}
                    onFocus={() => setResolvingId(s.id)}
                    placeholder="Resolution note..."
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', width: '180px' }}
                  />
                  <button
                    onClick={() => handleResolve(s)}
                    disabled={resolvingId === s.id && !note.trim()}
                    style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#16a34a', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    ✓ Resolve
                  </button>
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
    if (!pn || !form.course || !form.subtype) {
      setForm(f => ({ ...f, period_number: pn || '' }))
      return
    }
    const dayName = DAYS[new Date().getDay() - 1] || 'Monday'
    const slot = timetable.find(t =>
      t.class_name === form.subtype &&
      t.period_name === String(pn) &&
      t.day_name === dayName
    )
    if (slot) {
      const matchedStaff = staff.find(s => s.name === slot.teacher_name)
      setForm(f => ({
        ...f,
        period_number: pn,
        subject_name:  slot.subject_name || f.subject_name,
        teacher_name:  slot.teacher_name || f.teacher_name,
        staff_id:      matchedStaff?.id  || f.staff_id,
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

        <CoursePicker form={form} setForm={setForm} courseData={courseData} />

        <div>
          <label style={S.label}>Period (optional — auto-fills subject)</label>
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
            {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.designation || '-'})</option>)}
          </select>
        </div>

        <div>
          <label style={S.label}>Date</label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date: e.target.value }))} required style={S.input} />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Topic Taught</label>
          <input value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught: e.target.value }))} required placeholder="Enter topic" style={S.input} />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Classwork</label>
          <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork: e.target.value }))} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Classwork details" />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Homework</label>
          <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework: e.target.value }))} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Homework details" />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Remarks</label>
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="Any remarks" />
        </div>

        {/* Doubt Session Flag */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            padding: '12px 16px', borderRadius: '8px', transition: 'all 0.2s',
            background: form.needs_doubt_session ? '#fef9c3' : '#f8fafc',
            border: `1px solid ${form.needs_doubt_session ? '#f59e0b' : '#e2e8f0'}`,
          }}>
            <input
              type="checkbox"
              checked={form.needs_doubt_session || false}
              onChange={e => setForm(f => ({ ...f, needs_doubt_session: e.target.checked }))}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: '600', fontSize: '14px', color: form.needs_doubt_session ? '#b45309' : '#374151' }}>
              🔁 Needs Doubt Session
            </span>
            {form.needs_doubt_session && (
              <span style={{ fontSize: '12px', color: '#92400e' }}>
                — HM will be notified &amp; session tracked below this log
              </span>
            )}
          </label>
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

  // ── Doubt sessions ──
  const logIds = useMemo(() => logs.map(l => l.id), [logs])
  const { sessions, refetch: refetchSessions } = useDoubtSessions(logIds)
  const openDoubtCount = useMemo(() =>
    Object.values(sessions).flat().filter(s => s.status === 'open').length,
  [sessions])

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
    course:              f.course,
    subtype:             f.subtype             || null,
    class_name:          f.class_name          || null,
    batch_id:            f.batch_id            || null,
    subject_name:        f.subject_name,
    teacher_name:        f.teacher_name        || null,
    staff_id:            f.staff_id            || null,
    teaching_date:       f.teaching_date,
    topic_taught:        f.topic_taught,
    classwork:           f.classwork           || null,
    homework:            f.homework            || null,
    remarks:             f.remarks             || null,
    period_number:       f.period_number       || null,
    needs_doubt_session: f.needs_doubt_session || false,
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    if (checkDuplicate(form)) {
      setDupWarn(`⚠️ A log for ${form.course} / ${form.subtype} / ${form.class_name} / ${form.subject_name} on ${form.teaching_date} already exists.`)
      return
    }
    setDupWarn('')
    setSaving(true)

    const { data: logData, error } = await supabase
      .from('teaching_logs')
      .insert([buildPayload(form)])
      .select()
      .single()

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Auto-create doubt sessions per house if flagged
    if (form.needs_doubt_session && logData) {
      const { data: students } = await supabase
        .from('students')
        .select('house')
        .eq('course', form.course)
        .eq('batch', form.subtype)
        .eq('status', 'Active')
        .not('house', 'is', null)

      const houses = [...new Set((students || []).map(s => s.house).filter(Boolean))]

      const { data: hms } = await supabase
        .from('housemasters')
        .select('id, name, house')
        .eq('status', 'Active')
        .in('house', houses.length ? houses : ['__none__'])

      const hmMap = {}
      ;(hms || []).forEach(hm => { hmMap[hm.house] = hm })

      const doubtSessions = houses.map(house => ({
        log_id:           logData.id,
        course:           form.course,
        subtype:          form.subtype        || null,
        class_name:       form.class_name     || null,
        subject_name:     form.subject_name,
        topic:            form.topic_taught,
        teaching_date:    form.teaching_date,
        teacher_name:     form.teacher_name   || null,
        teacher_staff_id: form.staff_id       || null,
        house_name:       house,
        hm_id:            hmMap[house]?.id    || null,
        hm_name:          hmMap[house]?.name  || null,
        status:           'open',
      }))

      if (doubtSessions.length) {
        const { error: dsErr } = await supabase.from('doubt_sessions').insert(doubtSessions)
        if (dsErr) console.error('Doubt session insert error:', dsErr.message)
      }
    }

    setForm({ ...emptyLog, teaching_date: today() })
    setShowForm(false)
    fetchLogs()
    setSaving(false)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (checkDuplicate(editForm)) {
      alert('⚠️ Duplicate log exists.')
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
      needs_doubt_session: item.needs_doubt_session || false,
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
          { label:'Teachers',    value:[...new Set(logs.map(l=>l.teacher_name).filter(Boolean))].length, color:'#ca8a04', bg:'#fef9c3', icon:'👨‍🏫' },
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
        {dupWarn && (
          <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #f59e0b', borderRadius:'8px', color:'#92400e', fontSize:'13px', marginBottom:'12px' }}>
            {dupWarn}
          </div>
        )}
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

      <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'10px' }}>
        Showing {filtered.length} of {logs.length} logs
      </div>

      {/* Open doubt sessions banner */}
      {openDoubtCount > 0 && (
        <div style={{ padding: '10px 16px', background: '#fef9c3', border: '1px solid #f59e0b', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔁 {openDoubtCount} doubt session{openDoubtCount > 1 ? 's' : ''} pending resolution
          <span style={{ fontSize: '11px', fontWeight: '400', color: '#b45309' }}>— expand rows below to resolve</span>
        </div>
      )}

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
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <button
                          onClick={() => editId===item.id ? (setEditId(null), setEditForm(null)) : startEdit(item)}
                          style={S.btnSm('#7c3aed')}
                        >
                          {editId===item.id ? '✖' : '✏️'}
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={S.btnSm('#dc2626')}>🗑</button>
                        {sessions[item.id]?.length > 0 && (
                          <span style={{
                            padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700',
                            background: sessions[item.id].some(s => s.status === 'open') ? '#fef9c3' : '#dcfce7',
                            color:      sessions[item.id].some(s => s.status === 'open') ? '#b45309'  : '#16a34a',
                            border:     `1px solid ${sessions[item.id].some(s => s.status === 'open') ? '#fde68a' : '#bbf7d0'}`,
                          }}>
                            🔁 {sessions[item.id].some(s => s.status === 'open') ? 'open' : 'done'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Doubt session sub-row */}
                  <DoubtSessionSubRow
                    key={`ds-${item.id}`}
                    logId={item.id}
                    sessions={sessions}
                    onRefetch={refetchSessions}
                    currentUser={currentUser}
                  />

                  {/* Edit sub-row */}
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
  const [month, setMonth]             = useState(currentYearMonth())
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
          const day        = i + 1
          const hasLogs    = !!logsByDate[day]?.length
          const hasMissed  = !!missedByDate[day]?.length
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
      subtype:      form.subtype    || null,
      class_name:   form.class_name || null,
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
  const [form, setForm]         = useState({ course:'', subtype:'', class_name:'', batch_id:'', subject_name:'', teacher_name:'', day_of_week:'Monday', period_number:1, start_time:'', end_time:'' })
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [viewCourse, setViewCourse]   = useState('')
  const [viewSubtype, setViewSubtype] = useState('')
  const [viewClass, setViewClass]     = useState('')

  const { courses, subtypesFor, classesFor } = courseData

  useEffect(() => {
    if (courses.length && !viewCourse) {
      const c  = courses[0]
      const s  = subtypesFor(c)[0] || ''
      const cl = s ? classesFor(c, s)[0] || '' : ''
      setViewCourse(c); setViewSubtype(s); setViewClass(cl)
    }
  }, [courses])  // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)

    const { error: ttErr } = await supabase
      .from('timetable_entries')
      .insert([{
        class_name:   form.subtype || form.class_name,
        subject_name: form.subject_name,
        teacher_name: form.teacher_name || null,
        day_name:     form.day_of_week,
        period_name:  String(form.period_number),
      }])

    const { error: teachErr } = await supabase
      .from('teaching_timetable')
      .insert([{
        course:        form.course,
        subtype:       form.subtype       || null,
        class_name:    form.class_name    || null,
        batch_id:      form.batch_id      || null,
        subject_name:  form.subject_name,
        teacher_name:  form.teacher_name  || null,
        day_of_week:   form.day_of_week,
        period_number: parseInt(form.period_number),
        start_time:    form.start_time    || null,
        end_time:      form.end_time      || null,
      }])

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
      t.class_name === viewSubtype &&
      t.day_name   === day &&
      t.period_name === String(period)
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
  const monthMissed = missed.filter(m => m.missed_date?.startsWith(month) && (teacher==='All'||m.teacher_name===teacher))

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

// ─── Tab: Search ──────────────────────────────────────────────────────────────

const MONTHS_LABEL_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function SyllabusMatchBadge({ syllabusItem, onMarkDone }) {
  const monthNum   = parseInt(String(syllabusItem.month).split('-')[1] || syllabusItem.month) - 1
  const monthLabel = MONTHS_LABEL_SHORT[monthNum] ?? syllabusItem.month

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', padding:'7px 12px',
      background: syllabusItem.completed ? '#f0fdf4' : '#fefce8',
      border: `1px solid ${syllabusItem.completed ? '#bbf7d0' : '#fde68a'}`,
      borderRadius:'8px', flexWrap:'wrap' }}>
      <span style={{ fontSize:'13px' }}>📆</span>
      <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background:'#eff6ff', color:'#1e3a5f', border:'1px solid #bfdbfe' }}>
        {syllabusItem.admit_type}
      </span>
      <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background:'#f3e8ff', color:'#7c3aed', border:'1px solid #ddd6fe' }}>
        {syllabusItem.subject_name}
      </span>
      <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background:'#e0f2fe', color:'#0891b2', border:'1px solid #bae6fd' }}>
        🗓 {monthLabel}
      </span>
      {syllabusItem.completed ? (
        <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background:'#dcfce7', color:'#16a34a', border:'1px solid #bbf7d0' }}>
          ✅ Done
          {syllabusItem.completed_at && (
            <span style={{ fontWeight:400, marginLeft:4 }}>
              {new Date(syllabusItem.completed_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
            </span>
          )}
        </span>
      ) : (
        <span style={{ padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', background:'#fef9c3', color:'#b45309', border:'1px solid #fde68a' }}>
          ⏳ Pending
        </span>
      )}
      <span style={{ fontSize:'11px', color:'#64748b', flex:1, minWidth:'120px' }}>
        Syllabus: <em style={{ color:'#1e293b' }}>{syllabusItem.topic}</em>
      </span>
      {!syllabusItem.completed && (
        <button onClick={() => onMarkDone(syllabusItem)} style={{ padding:'3px 10px', borderRadius:'6px', border:'none', background:'#16a34a', color:'white', fontSize:'11px', fontWeight:'700', cursor:'pointer', flexShrink:0 }}>
          ✓ Mark Done
        </button>
      )}
    </div>
  )
}

function TabSearch({ logs, monthlySyllabus = [], onNavigateTab }) {
  const [query, setQuery]           = useState('')
  const [marking, setMarking]       = useState(null)
  const [localSyllabus, setLocalSyllabus] = useState(monthlySyllabus)

  useEffect(() => { setLocalSyllabus(monthlySyllabus) }, [monthlySyllabus])

  const findSyllabusMatch = useCallback((logItem) => {
    if (!localSyllabus.length || !logItem.topic_taught) return null
    const topicLower = (logItem.topic_taught || '').toLowerCase()
    return localSyllabus.find(s =>
      topicLower.includes(s.topic.toLowerCase().slice(0, 14)) ||
      s.topic.toLowerCase().includes(topicLower.slice(0, 14))
    ) || null
  }, [localSyllabus])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return logs.filter(l =>
      (l.topic_taught || '').toLowerCase().includes(q) ||
      (l.classwork    || '').toLowerCase().includes(q) ||
      (l.homework     || '').toLowerCase().includes(q)
    ).sort((a, b) => b.teaching_date?.localeCompare(a.teaching_date))
  }, [logs, query])

  const matchCount = useMemo(() =>
    results.filter(r => findSyllabusMatch(r)).length,
  [results, findSyllabusMatch])

  const pendingMatchCount = useMemo(() =>
    results.filter(r => { const m = findSyllabusMatch(r); return m && !m.completed }).length,
  [results, findSyllabusMatch])

  const handleMarkDone = async (syllabusItem) => {
    setMarking(syllabusItem.id)
    const completed_at = new Date().toISOString()
    const { error } = await supabase.from('monthly_syllabus').update({ completed: true, completed_at }).eq('id', syllabusItem.id)
    if (!error) {
      setLocalSyllabus(prev => prev.map(s => s.id === syllabusItem.id ? { ...s, completed: true, completed_at } : s))
    } else {
      alert('Error: ' + error.message)
    }
    setMarking(null)
  }

  return (
    <div style={S.card}>
      <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🔍 Topic Search</h2>
      <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'16px' }}>
        Search across all topics, classwork, and homework — with live 📆 Monthly Syllabus matching.
      </p>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="e.g. Pythagoras, Photosynthesis, LCM, Analogy..."
        style={{ ...S.input, fontSize:'16px', padding:'14px 18px', marginBottom:'16px' }}
        autoFocus
      />
      {query && results.length > 0 && (
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px', padding:'10px 14px', background:'#f8fafc', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'12px' }}>
          <span style={{ color:'#1e3a5f', fontWeight:'700' }}>📋 {results.length} log{results.length!==1?'s':''} found</span>
          {matchCount > 0 && <><span style={{ color:'#94a3b8' }}>·</span><span style={{ color:'#7c3aed', fontWeight:'700' }}>📆 {matchCount} match syllabus</span></>}
          {pendingMatchCount > 0 && <><span style={{ color:'#94a3b8' }}>·</span><span style={{ color:'#b45309', fontWeight:'700' }}>⏳ {pendingMatchCount} pending</span></>}
          {matchCount > 0 && (
            <button onClick={() => onNavigateTab?.('monthly')} style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'6px', background:'#1e3a5f', color:'white', border:'none', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
              Go to Monthly Syllabus →
            </button>
          )}
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
              <div style={{ fontSize:'13px', color:'#64748b' }}>
                {l.course} / {l.subtype} / {l.class_name} | {l.subject_name} | 👨‍🏫 {l.teacher_name || '-'}
              </div>
              {l.classwork && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>📝 CW: {l.classwork}</div>}
              {l.homework  && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>📚 HW: {l.homework}</div>}
              {match && (
                <SyllabusMatchBadge
                  syllabusItem={marking === match.id ? { ...match, _loading: true } : match}
                  onMarkDone={handleMarkDone}
                />
              )}
            </div>
          )
        })}
        {query && results.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No results for "{query}"</div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Teaching({ currentUser }) {
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('gnsi_teaching_tab') || 'logs' } catch { return 'logs' }
  })
  const [logs,             setLogs]             = useState([])
  const [missed,           setMissed]           = useState([])
  const [timetable,        setTimetable]        = useState([])
  const [staff,            setStaff]            = useState([])
  const [loading,          setLoading]          = useState(true)
  const [monthlySyllabus,  setMonthlySyllabus]  = useState([])

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
    const { data } = await supabase
      .from('monthly_syllabus')
      .select('id, admit_type, subject_name, topic, month, completed, completed_at')
      .order('month')
    if (data) setMonthlySyllabus(data)
  }, [])

  useEffect(() => {
    fetchLogs(); fetchMissed(); fetchTimetable(); fetchStaff(); fetchMonthlySyllabus()
  }, [])  // eslint-disable-line

  const todayStr  = today()
  const currMonth = currentYearMonth()

  const badges = useMemo(() => {
    const todayLogs      = logs.filter(l => l.teaching_date === todayStr).length
    const monthMissed    = missed.filter(m => m.missed_date?.startsWith(currMonth)).length
    const activeTeachers = new Set(logs.filter(l => l.teaching_date?.startsWith(currMonth)).map(l => l.teacher_name).filter(Boolean)).size
    return {
      logs:      todayLogs > 0   ? `${todayLogs} today`    : null,
      calendar:  null,
      syllabus:  null,
      timetable: timetable.length > 0
        ? `${new Set(timetable.map(t => t.class_name).filter(Boolean)).size} batches`
        : null,
      reports:   monthMissed > 0 ? `${monthMissed} missed` : activeTeachers > 0 ? `${activeTeachers} teachers` : null,
      search:    null,
      monthly:   null,
    }
  }, [logs, missed, timetable, todayStr, currMonth])

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>
          📘 Teaching Management
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
          Daily logs · Syllabus · Timetable · Reports · Topic search
        </p>
      </div>

      {/* Pill Tab Bar */}
      <div style={{ display:'flex', gap:'4px', padding:'6px', background:'#f1f5f9', borderRadius:'16px', marginBottom:'24px', overflowX:'auto', scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch' }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          const badge  = badges[t.key]
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 16px', fontWeight:'600', fontSize:'13px', cursor:'pointer', background: active?'#1e3a5f':'transparent', color: active?'white':'#64748b', border:'none', borderRadius:'12px', whiteSpace:'nowrap', transition:'all 0.18s ease', boxShadow: active?'0 2px 10px rgba(30,58,95,0.28)':'none', flexShrink:0 }}
            >
              <span style={{ fontSize:'15px', lineHeight:1 }}>{t.icon}</span>
              <span>{t.label}</span>
              {badge && (
                <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:'700', lineHeight:1.4, background: active?'rgba(255,255,255,0.22)':'#1e3a5f', color:'white', marginLeft:'2px' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'logs' && (
        <TabLogs
          logs={logs} loading={loading} fetchLogs={fetchLogs}
          timetable={timetable} staff={staff} courseData={courseData}
          currentUser={currentUser}
        />
      )}
      {activeTab === 'calendar'  && <TabCalendar  logs={logs} missed={missed} />}
      {activeTab === 'syllabus'  && <TabSyllabus  logs={logs} courseData={courseData} />}
      {activeTab === 'timetable' && <TabTimetable timetable={timetable} fetchTimetable={fetchTimetable} staff={staff} courseData={courseData} />}
      {activeTab === 'reports'   && <TabReports   logs={logs} missed={missed} staff={staff} courseData={courseData} />}
      {activeTab === 'search'    && <TabSearch    logs={logs} monthlySyllabus={monthlySyllabus} onNavigateTab={handleTabChange} />}
      {activeTab === 'monthly'   && (
        <TabMonthlySyllabus
          logs={logs}
          missed={missed}
          timetable={timetable}
          staff={staff}
          courseData={courseData}
          currentUser={currentUser}
          onNavigateTab={key => handleTabChange(key)}
        />
      )}
    </div>
  )
}

export default Teaching
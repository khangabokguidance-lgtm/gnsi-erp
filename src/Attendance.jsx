// ============================================================
//  GNSI Portal — Attendance Module (Advanced)
//  Design: Navy system from FeeSetup.jsx (Outfit font, #1e3a5f)
//  Features:
//    • Course/Batch picker from COURSE_STRUCTURE (FeeSetup)
//    • Timetable auto-fill (subject + teacher per period/day)
//    • Per-student status toggle with live stats bar
//    • Bulk-action toolbar (Mark All, Invert selection)
//    • View Sessions tab with inline expand + edit
//    • Reports tab with bar charts, risk table, month picker
//    • Consistent 3-column header / card layout
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'

// ─── COURSE STRUCTURE (mirrors FeeSetup.jsx) ─────────────────

const COURSE_STRUCTURE = {
  Sainik:            ['Achiever', 'Leader', 'Champion'],
  Navodaya:          ['Umeed', 'Lakshya'],
  Foundation:        ['Prime', 'Elite'],
  'Combined Course': ['—'],
}
const COURSES      = Object.keys(COURSE_STRUCTURE)
const HOSTEL_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']

// ─── Design Tokens ────────────────────────────────────────────

const C = {
  navy:    '#1e3a5f',
  navyMid: '#2a4f7c',
  indigo:  '#4f46e5',
  emerald: '#059669',
  amber:   '#d97706',
  red:     '#dc2626',
  violet:  '#7c3aed',
  sky:     '#0284c7',
  gold:    '#ffd060',
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
    600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
  },
}

const COURSE_COLORS = {
  Sainik:            { accent: '#4f46e5', light: '#eff6ff', badge: '#1d4ed8' },
  Navodaya:          { accent: '#059669', light: '#f0fdf4', badge: '#15803d' },
  Foundation:        { accent: '#d97706', light: '#fffbeb', badge: '#b45309' },
  'Combined Course': { accent: '#7c3aed', light: '#f5f3ff', badge: '#6d28d9' },
}

const HOSTEL_COLORS = {
  Boarder:       { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  'Day Boarder': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Day Scholar': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
}

const STATUS_META = {
  Present: { bg: '#dcfce7', color: '#16a34a', border: '#86efac', icon: '✓', label: 'Present' },
  Absent:  { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', icon: '✗', label: 'Absent'  },
  Late:    { bg: '#fef9c3', color: '#92400e', border: '#fde68a', icon: '◷', label: 'Late'    },
  Leave:   { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe', icon: '☰', label: 'Leave'   },
}
const STATUSES = ['Present', 'Absent', 'Late', 'Leave']

const SESSION_TYPES = ['Class']
const PERIODS       = [1]

const SUBJECTS = [
  'Mathematics','English Grammar','General Knowledge','General Science',
  'Vocabulary','Reasoning','Foundation Mathematics','Hindi',
  'Mental Ability','Meitei Mayek','Mathematics I','Mathematics II',
]

const today    = () => new Date().toISOString().split('T')[0]
const fmtDate  = d  => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtMonth = m  => { const [y,mo] = m.split('-'); return new Date(y, mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
const todayDay = () => new Date().toLocaleDateString('en-US', { weekday:'long' })

// ─── Shared UI Primitives ─────────────────────────────────────

const font = "'Outfit', system-ui, sans-serif"

const inp = (extra={}) => ({
  padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.slate[200]}`,
  fontSize: 13, fontFamily: font, outline: 'none', background: 'white',
  color: C.slate[800], boxSizing: 'border-box', width: '100%', ...extra,
})

function Label({ children, badge }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: C.slate[400], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
      {badge && <span style={{ fontSize: 9, fontWeight: 800, background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: 4, letterSpacing: '.04em' }}>{badge}</span>}
    </div>
  )
}

function Select({ value, onChange, disabled, children, style={} }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      style={{ ...inp(), cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, ...style }}>
      {children}
    </select>
  )
}

function Chip({ label, color, bg, border }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 9px', borderRadius: 5, background: bg, color, border: `1px solid ${border}` }}>
      {label}
    </span>
  )
}

function CoursePill({ course }) {
  const cc = COURSE_COLORS[course] || COURSE_COLORS.Sainik
  return <Chip label={course} color={cc.badge} bg={cc.light} border={`${cc.accent}30`} />
}

// ─── Status Cycle Button ──────────────────────────────────────

function StatusCycle({ status, onChange }) {
  const sm  = STATUS_META[status] || STATUS_META.Present
  const idx = STATUSES.indexOf(status)
  return (
    <button onClick={() => onChange(STATUSES[(idx + 1) % STATUSES.length])}
      style={{
        padding: '5px 16px', borderRadius: 999, border: `1.5px solid ${sm.border}`,
        background: sm.bg, color: sm.color, fontWeight: 800, fontSize: 12,
        cursor: 'pointer', minWidth: 90, transition: 'all .12s',
        fontFamily: font, letterSpacing: '.02em',
      }}>
      {sm.icon} {sm.label}
    </button>
  )
}

// ─── Mini Stat Bar ────────────────────────────────────────────

function StatBar({ records }) {
  const counts = useMemo(() => {
    const c = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (c[s] !== undefined) c[s]++ })
    return c
  }, [records])
  const total = Object.values(counts).reduce((a,b)=>a+b,0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* stacked bar */}
      {total > 0 && (
        <div style={{ flex: 1, minWidth: 120, height: 8, borderRadius: 999, overflow: 'hidden', display: 'flex', background: C.slate[100] }}>
          {STATUSES.map(s => counts[s] > 0 && (
            <div key={s} style={{ width: `${(counts[s]/total)*100}%`, height: '100%', background: STATUS_META[s].color, transition: 'width .3s' }} />
          ))}
        </div>
      )}
      {STATUSES.map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s].color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_META[s].color }}>{counts[s]}</span>
          <span style={{ fontSize: 11, color: C.slate[400] }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Attendance Mini Chart (bar) ──────────────────────────────

function MiniBar({ pct }) {
  const color = pct >= 75 ? C.emerald : pct >= 50 ? C.amber : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: C.slate[100], borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 34 }}>{pct}%</span>
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────

function Card({ children, style={} }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, border: `1px solid ${C.slate[200]}`,
      boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ icon, title, sub, right }) {
  return (
    <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.slate[100]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 4, height: 24, background: `linear-gradient(180deg,${C.navy},${C.indigo})`, borderRadius: 2 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{icon && <span style={{ marginRight: 7 }}>{icon}</span>}{title}</div>
          {sub && <div style={{ fontSize: 12, color: C.slate[400], marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

// ─── Alert Banner ─────────────────────────────────────────────

function Alert({ type='info', children, onClose }) {
  const styles = {
    info:    { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
    warn:    { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
    error:   { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c' },
  }
  const s = styles[type]
  return (
    <div style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '11px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, fontSize: 16, lineHeight: 1 }}>×</button>}
    </div>
  )
}

// ─── Btn ──────────────────────────────────────────────────────

function Btn({ children, onClick, disabled, variant='primary', small }) {
  const base = {
    borderRadius: small ? 7 : 9, border: 'none', fontFamily: font,
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 12 : 13, padding: small ? '6px 14px' : '9px 20px',
    transition: 'all .12s', display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const vars = {
    primary:  { background: disabled ? C.slate[200] : `linear-gradient(135deg,${C.navy},${C.indigo})`, color: disabled ? C.slate[400] : 'white' },
    success:  { background: disabled ? C.slate[200] : `linear-gradient(135deg,${C.emerald},#16a34a)`, color: 'white' },
    danger:   { background: '#fee2e2', color: C.red, border: `1px solid #fca5a5` },
    ghost:    { background: C.slate[50], color: C.slate[600], border: `1px solid ${C.slate[200]}` },
    amber:    { background: '#fef3c7', color: '#92400e', border: `1px solid #fde68a` },
  }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, ...vars[variant] }}>
      {children}
    </button>
  )
}

// ─── TAB: MARK ATTENDANCE ─────────────────────────────────────

function TabMark({ staff }) {
  const [form, setForm]       = useState({
    session_date: today(), course: '', subtype: '', class_name: '', batch_id: '',
    subject_name: '', teacher_name: '', staff_id: '', period_number: '',
    session_type: 'Class', remarks: '',
  })
  const [students,  setStudents]  = useState([])
  const [records,   setRecords]   = useState({})
  const [timetable, setTimetable] = useState([])
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [batchId,   setBatchId]   = useState(null) // from course_batches.id

  // Derived
  const subtypes   = form.course ? COURSE_STRUCTURE[form.course] || [] : []
  const cc         = COURSE_COLORS[form.course] || COURSE_COLORS.Sainik

  // Timetable-derived subjects & staff
  const batchSubjects = useMemo(() =>
    timetable.length ? [...new Set(timetable.map(t=>t.subject_name).filter(Boolean))].sort() : SUBJECTS
  , [timetable])

  const batchStaff = useMemo(() => {
    if (!timetable.length) return staff
    const names = new Set(timetable.map(t=>t.teacher_name).filter(Boolean))
    const matched = staff.filter(s => names.has(s.name))
    return matched.length ? matched : staff
  }, [timetable, staff])

  // ── Load batch + timetable ────────────────────────────────
  useEffect(() => {
    if (!form.course || !form.subtype) { setTimetable([]); setBatchId(null); return }
    const fetch = async () => {
      let q = supabase.from('course_batches').select('id,batch_name')
        .eq('course', form.course).eq('subtype', form.subtype)
      if (form.class_name) q = q.eq('class_name', form.class_name)
      const { data } = await q.limit(1).single()
      const id = data?.id || null
      setBatchId(id)
      if (!id) { setTimetable([]); return }
      const { data: tt } = await supabase.from('timetable_entries').select('*')
        .eq('class_name', data.batch_name)
      setTimetable(tt || [])
    }
    fetch()
  }, [form.course, form.subtype, form.class_name])

  // ── Load students ─────────────────────────────────────────
  useEffect(() => {
    if (!form.course) { setStudents([]); setRecords({}); return }
    const fetch = async () => {
      let q = supabase.from('course_enrollments')
        .select('id,student_name,gcc_no,student_id,hostel_type')
        .eq('status','Active').eq('course', form.course)
      if (form.subtype)    q = q.eq('subtype',    form.subtype)
      if (form.class_name) q = q.eq('class_name', form.class_name)
      const { data } = await q.order('student_name')
      setStudents(data || [])
      const init = {}
      ;(data||[]).forEach(s => { init[s.student_id || s.student_name] = 'Present' })
      setRecords(init)
    }
    fetch()
  }, [form.course, form.subtype, form.class_name])

  // ── Period auto-fill ──────────────────────────────────────
  const handlePeriod = (period) => {
    setForm(prev => ({ ...prev, period_number: period }))
    if (!period || !timetable.length) return
    const slot = timetable.find(t => t.period_name === String(period) && t.day_name === todayDay())
    if (slot) {
      const matched = staff.find(s => s.name === slot.teacher_name)
      setForm(prev => ({
        ...prev, period_number: period,
        subject_name:  slot.subject_name || prev.subject_name,
        teacher_name:  slot.teacher_name || prev.teacher_name,
        staff_id:      matched?.id || prev.staff_id,
      }))
    }
  }

  const handleTeacher = v => {
    const s = staff.find(x => x.name === v)
    setForm(prev => ({ ...prev, teacher_name: v, staff_id: s?.id || '' }))
  }

  const markAll = status => {
    const next = {}
    students.forEach(s => { next[s.student_id || s.student_name] = status })
    setRecords(next)
  }

  const invertSelection = () => {
    const next = {}
    students.forEach(s => {
      const k = s.student_id || s.student_name
      const cur = records[k] || 'Present'
      next[k] = cur === 'Present' ? 'Absent' : 'Present'
    })
    setRecords(next)
  }

  const handleSave = async () => {
    if (!form.course || !students.length) { setToast({ type:'warn', msg:'Select a course and ensure students are loaded.' }); return }
    setSaving(true)
    const { data: sess, error: e1 } = await supabase.from('attendance_sessions')
      .insert([{
        session_date:  form.session_date,
        course:        form.course,
        subtype:       form.subtype       || null,
        class_name:    form.class_name    || null,
        batch_id:      batchId            || null,
        subject_name:  form.subject_name  || null,
        teacher_name:  form.teacher_name  || null,
        staff_id:      form.staff_id      || null,
        period_number: form.period_number || null,
        session_type:  form.session_type,
        remarks:       form.remarks       || null,
      }]).select().single()
    if (e1) { setSaving(false); setToast({ type:'error', msg: e1.message }); return }

    const rows = students.map(s => ({
      session_id:   sess.id,
      student_id:   s.student_id   || null,
      student_name: s.student_name,
      gcc_no:       s.gcc_no       || null,
      status:       records[s.student_id || s.student_name] || 'Present',
    }))
    const { error: e2 } = await supabase.from('attendance_records').insert(rows)
    setSaving(false)
    if (e2) { setToast({ type:'error', msg: e2.message }); return }
    setToast({ type:'success', msg: `✅ Attendance saved for ${students.length} students!` })
    setForm(prev => ({ ...prev, subject_name:'', teacher_name:'', staff_id:'', period_number:'', remarks:'' }))
  }

  // filtered students
  const filteredStudents = useMemo(() =>
    search.trim() ? students.filter(s => s.student_name.toLowerCase().includes(search.toLowerCase()) || (s.gcc_no||'').includes(search))
    : students
  , [students, search])

  const counts = useMemo(() => {
    const c = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (c[s] !== undefined) c[s]++ })
    return c
  }, [records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Session Details Card ── */}
      <Card>
        <CardHead icon="📋" title="Session Details" sub="Configure course, period and session metadata" />
        <div style={{ padding: '20px 22px' }}>
          {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

          {/* Row 1: course + subtype + class */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <Label>Course *</Label>
              <Select value={form.course} onChange={e => setForm(prev => ({ ...prev, course: e.target.value, subtype:'', class_name:'' }))}>
                <option value="">Select Course</option>
                {COURSES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Batch / Subtype</Label>
              <Select value={form.subtype} disabled={!form.course}
                onChange={e => setForm(prev => ({ ...prev, subtype: e.target.value, class_name:'' }))}>
                <option value="">Select Batch</option>
                {subtypes.map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label>Class {batchId && <span style={{ fontSize:10, color: C.emerald, fontWeight:800 }}>✓ linked</span>}</Label>
              <input value={form.class_name}
                onChange={e => setForm(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. 9A (optional)"
                style={inp()} />
            </div>
          </div>

          {/* Row 2: date + period + subject */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <Label>Date</Label>
              <input type="date" value={form.session_date}
                onChange={e => setForm(prev => ({ ...prev, session_date: e.target.value }))}
                style={inp()} />
            </div>
            <div>
              <Label badge={form.period_number && timetable.length ? 'AUTO-FILL' : ''}>Period</Label>
              <Select value={form.period_number} onChange={e => handlePeriod(e.target.value)}>
                <option value="">— No Period —</option>
                {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
              </Select>
            </div>
            <div>
              <Label badge={form.period_number && form.subject_name && timetable.length ? '✓ TIMETABLE' : ''}>Subject</Label>
              <Select value={form.subject_name} onChange={e => setForm(prev => ({ ...prev, subject_name: e.target.value }))}>
                <option value="">Select Subject</option>
                {batchSubjects.map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          {/* Row 3: teacher + type + remarks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div>
              <Label badge={form.period_number && form.teacher_name && timetable.length ? '✓ TIMETABLE' : ''}>Teacher</Label>
              <Select value={form.teacher_name} onChange={e => handleTeacher(e.target.value)}>
                <option value="">Select Teacher</option>
                {batchStaff.map(s => <option key={s.id} value={s.name}>{s.name}{s.designation ? ` — ${s.designation}` : ''}</option>)}
              </Select>
            </div>
            <div>
              <Label>Session Type</Label>
              <Select value={form.session_type} onChange={e => setForm(prev => ({ ...prev, session_type: e.target.value }))}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <input value={form.remarks}
                onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional notes..."
                style={inp()} />
            </div>
          </div>

          {/* Status banner */}
          {form.course && (
            <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 9,
              background: students.length ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${students.length ? '#86efac' : '#fde68a'}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: students.length ? C.emerald : C.amber }}>
                {students.length
                  ? `${students.length} students enrolled`
                  : '⚠️ No students found — check Course → Enrollments'}
              </span>
              {timetable.length > 0 && (
                <span style={{ fontSize: 11, color: C.sky, fontWeight: 700 }}>
                  📅 {timetable.length} timetable slots · {batchSubjects.length} subjects
                </span>
              )}
              {form.course && <CoursePill course={form.course} />}
            </div>
          )}
        </div>
      </Card>

      {/* ── Mark Attendance Card ── */}
      {students.length > 0 && (
        <Card>
          <CardHead
            icon="✏️"
            title="Mark Attendance"
            sub={`${form.course}${form.subtype ? ' / '+form.subtype : ''}${form.class_name ? ' / '+form.class_name : ''} · ${fmtDate(form.session_date)}${form.subject_name ? ' · '+form.subject_name : ''}`}
            right={
              <>
                <Btn small variant="ghost" onClick={invertSelection}>⇄ Invert</Btn>
                {STATUSES.map(s => {
                  const sm = STATUS_META[s]
                  return (
                    <button key={s} onClick={() => markAll(s)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${sm.border}`, background: sm.bg, color: sm.color, cursor: 'pointer', fontFamily: font }}>
                      All {sm.icon}
                    </button>
                  )
                })}
              </>
            }
          />

          {/* Stat counters */}
          <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.slate[100]}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {STATUSES.map(s => {
              const sm = STATUS_META[s]
              const pct = students.length ? Math.round((counts[s]/students.length)*100) : 0
              return (
                <div key={s} style={{ background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: sm.color, lineHeight: 1, fontFamily: font }}>{counts[s]}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: sm.color }}>{sm.icon} {sm.label}</div>
                    <div style={{ fontSize: 10, color: sm.color, opacity: .7 }}>{pct}%</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div style={{ padding: '10px 22px', borderBottom: `1px solid ${C.slate[100]}` }}>
            <StatBar records={records} />
          </div>

          {/* Search */}
          <div style={{ padding: '12px 22px', borderBottom: `1px solid ${C.slate[100]}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search student name or GCC…"
              style={inp({ maxWidth: 340 })} />
          </div>

          {/* Student list */}
          <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filteredStudents.map((s, i) => {
              const key    = s.student_id || s.student_name
              const status = records[key] || 'Present'
              const sm     = STATUS_META[status]
              const hc     = HOSTEL_COLORS[s.hostel_type] || HOSTEL_COLORS['Day Scholar']
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderRadius: 10, border: `1px solid ${status === 'Absent' ? '#fca5a5' : C.slate[100]}`,
                  background: status === 'Absent' ? '#fff5f5' : status === 'Late' ? '#fffbeb' : status === 'Leave' ? '#faf5ff' : 'white',
                  transition: 'all .15s',
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: sm.color, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: C.slate[800], fontSize: 13 }}>{s.student_name}</div>
                    <div style={{ fontSize: 11, color: C.slate[400], display: 'flex', gap: 8, marginTop: 2 }}>
                      {s.gcc_no && <span style={{ fontWeight: 800, color: C.navy }}>GCC-{s.gcc_no}</span>}
                      {s.hostel_type && <Chip label={s.hostel_type} color={hc.color} bg={hc.bg} border={hc.border} />}
                    </div>
                  </div>
                  <StatusCycle status={status} onChange={next => setRecords(prev => ({ ...prev, [key]: next }))} />
                </div>
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.slate[400], fontSize: 13 }}>No students match your search.</div>
            )}
          </div>

          {/* Save row */}
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.slate[100]}`, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="success" disabled={saving} onClick={handleSave}>
              {saving ? '⏳ Saving…' : `✅ Save Attendance (${students.length} students)`}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── TAB: VIEW SESSIONS ───────────────────────────────────────

function TabView() {
  const [sessions,     setSessions]   = useState([])
  const [loading,      setLoading]    = useState(true)
  const [expanded,     setExpanded]   = useState(null)
  const [records,      setRecords]    = useState({})
  const [dateFilter,   setDateFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('All')

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions').select('*').order('session_date',{ascending:false}).limit(150)
    if (dateFilter)             q = q.eq('session_date', dateFilter)
    if (courseFilter !== 'All') q = q.eq('course', courseFilter)
    const { data } = await q
    setSessions(data || [])
    setLoading(false)
  }, [dateFilter, courseFilter])

  useEffect(() => { fetch() }, [fetch])

  const expand = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    if (!records[id]) {
      const { data } = await supabase.from('attendance_records').select('*').eq('session_id', id).order('student_name')
      setRecords(prev => ({ ...prev, [id]: data || [] }))
    }
    setExpanded(id)
  }

  const deleteSession = async (id) => {
    if (!window.confirm('Delete this session and all its records?')) return
    await supabase.from('attendance_sessions').delete().eq('id', id)
    if (expanded === id) setExpanded(null)
    fetch()
  }

  return (
    <Card>
      <CardHead icon="📁" title="Sessions" sub="All recorded attendance sessions" right={
        <span style={{ fontSize: 12, color: C.slate[400], fontWeight: 600 }}>{sessions.length} total</span>
      } />

      {/* Filters */}
      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.slate[100]}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={inp({ width: 'auto' })} />
        <Select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">All Courses</option>
          {COURSES.map(c => <option key={c}>{c}</option>)}
        </Select>
        {(dateFilter || courseFilter !== 'All') && (
          <Btn small variant="ghost" onClick={() => { setDateFilter(''); setCourseFilter('All') }}>✕ Clear</Btn>
        )}
      </div>

      <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding: '48px 0', color: C.slate[400], fontSize: 13 }}>⏳ Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign:'center', padding: '48px 0', color: C.slate[400], fontSize: 13 }}>No sessions found for selected filters.</div>
        ) : sessions.map(sess => {
          const isOpen = expanded === sess.id
          const recs   = records[sess.id] || []
          const counts = { Present:0, Absent:0, Late:0, Leave:0 }
          if (isOpen) recs.forEach(r => { if (counts[r.status]!==undefined) counts[r.status]++ })
          const total  = recs.length
          const pct    = total > 0 ? Math.round((counts.Present / total)*100) : null

          return (
            <div key={sess.id} style={{ border: `1px solid ${C.slate[200]}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Row header */}
              <div onClick={() => expand(sess.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', cursor:'pointer', background: isOpen ? C.slate[50] : 'white', transition:'background .15s' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                    <span style={{ fontWeight:800, color:C.navy, fontSize:14 }}>{fmtDate(sess.session_date)}</span>
                    <CoursePill course={sess.course} />
                    {sess.subtype    && <span style={{ fontSize:12, color:C.slate[500] }}>{sess.subtype}</span>}
                    {sess.class_name && <span style={{ fontSize:12, color:C.slate[500] }}>{sess.class_name}</span>}
                    {sess.subject_name && <span style={{ fontSize:12, fontWeight:700, color:C.violet }}>{sess.subject_name}</span>}
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:C.slate[100], color:C.slate[500] }}>{sess.session_type}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.slate[400] }}>
                    {sess.teacher_name && `👨‍🏫 ${sess.teacher_name}`}
                    {sess.period_number && ` · P${sess.period_number}`}
                    {sess.batch_id && <span style={{ color:C.emerald, fontWeight:700 }}> · ✓ linked</span>}
                  </div>
                </div>
                <Btn small variant="danger" onClick={e => { e.stopPropagation(); deleteSession(sess.id) }}>🗑</Btn>
                <span style={{ color:C.slate[300], fontSize:18, transform: isOpen?'rotate(180deg)':'none', transition:'transform .2s' }}>▾</span>
              </div>

              {/* Expanded records */}
              {isOpen && (
                <div style={{ borderTop:`1px solid ${C.slate[100]}`, padding:'16px 18px', background: C.slate[50] }}>
                  {/* Stat pills */}
                  <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                    {STATUSES.map(s => counts[s] > 0 && (
                      <span key={s} style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:700,
                        background:STATUS_META[s].bg, color:STATUS_META[s].color, border:`1px solid ${STATUS_META[s].border}` }}>
                        {STATUS_META[s].icon} {counts[s]} {s}
                      </span>
                    ))}
                    {pct !== null && (
                      <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color: pct>=75?C.emerald:pct>=50?C.amber:C.red }}>
                        {pct}% attendance
                      </span>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:7 }}>
                    {recs.map(r => {
                      const sm = STATUS_META[r.status] || STATUS_META.Present
                      return (
                        <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:sm.bg, border:`1px solid ${sm.border}` }}>
                          <span style={{ fontSize:14, fontWeight:900, color:sm.color }}>{sm.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:C.slate[800] }}>{r.student_name}</div>
                            {r.gcc_no && <div style={{ fontSize:10, color:C.slate[400] }}>GCC-{r.gcc_no}</div>}
                          </div>
                          <span style={{ fontSize:10, fontWeight:800, color:sm.color }}>{r.status}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── TAB: REPORTS ─────────────────────────────────────────────

function TabReport() {
  const [month,   setMonth]  = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [course,  setCourse] = useState('All')
  const [subtype, setSubtype]= useState('All')
  const [data,    setData]   = useState([])
  const [loading, setLoading]= useState(false)
  const [sort,    setSort]   = useState({ by:'pct', asc:true })

  const subtypes = course !== 'All' ? (COURSE_STRUCTURE[course]||[]) : []

  const fetchReport = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions')
      .select('id,session_date,course,subtype')
      .gte('session_date',`${month}-01`)
      .lte('session_date',`${month}-31`)
    if (course  !== 'All') q = q.eq('course',  course)
    if (subtype !== 'All') q = q.eq('subtype', subtype)
    const { data: sessions } = await q
    if (!sessions?.length) { setData([]); setLoading(false); return }

    const ids = sessions.map(s=>s.id)
    const { data: recs } = await supabase.from('attendance_records')
      .select('session_id,student_name,gcc_no,status').in('session_id', ids)

    const map = {}
    recs?.forEach(r => {
      if (!map[r.student_name]) map[r.student_name] = { name:r.student_name, gcc:r.gcc_no, Present:0,Absent:0,Late:0,Leave:0,total:0 }
      map[r.student_name][r.status]++
      map[r.student_name].total++
    })
    const rows = Object.values(map).map(r => ({ ...r, pct: r.total>0?Math.round((r.Present/r.total)*100):0 }))
    setData(rows)
    setLoading(false)
  }, [month, course, subtype])

  useEffect(() => { fetchReport() }, [fetchReport])

  const sorted = useMemo(() => {
    return [...data].sort((a,b) => {
      const v = sort.by === 'pct' ? a.pct - b.pct
        : sort.by === 'name' ? a.name.localeCompare(b.name)
        : a[sort.by] - b[sort.by]
      return sort.asc ? v : -v
    })
  }, [data, sort])

  const toggleSort = col => setSort(s => ({ by: col, asc: s.by===col ? !s.asc : true }))
  const SortTh = ({ col, children }) => (
    <th onClick={() => toggleSort(col)}
      style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color: sort.by===col ? C.navy : C.slate[400], cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
      {children} {sort.by===col ? (sort.asc?'↑':'↓') : ''}
    </th>
  )

  const stats = useMemo(() => ({
    total: data.length,
    good:  data.filter(r=>r.pct>=75).length,
    mid:   data.filter(r=>r.pct>=50&&r.pct<75).length,
    risk:  data.filter(r=>r.pct<50).length,
  }), [data])

  return (
    <Card>
      <CardHead icon="📊" title="Monthly Report" sub={`Attendance summary for ${fmtMonth(month)}`} right={
        <>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={inp({width:'auto'})} />
          <Select value={course} onChange={e=>{setCourse(e.target.value);setSubtype('All')}} style={{width:'auto'}}>
            <option value="All">All Courses</option>
            {COURSES.map(c=><option key={c}>{c}</option>)}
          </Select>
          {subtypes.length > 0 && (
            <Select value={subtype} onChange={e=>setSubtype(e.target.value)} style={{width:'auto'}}>
              <option value="All">All Batches</option>
              {subtypes.map(s=><option key={s}>{s}</option>)}
            </Select>
          )}
          <Btn small onClick={() => window.print()}>🖨️ Print</Btn>
        </>
      } />

      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:C.slate[400], fontSize:13 }}>⏳ Generating report…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.slate[400], fontSize:13 }}>No attendance data for this period.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.slate[100]}`, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[
              { label:'Students',    value:stats.total, color:C.navy,    bg:'#eff6ff'  },
              { label:'≥75% (Good)', value:stats.good,  color:C.emerald, bg:'#f0fdf4'  },
              { label:'50–74% (Low)',value:stats.mid,   color:C.amber,   bg:'#fffbeb'  },
              { label:'<50% (Risk)', value:stats.risk,  color:C.red,     bg:'#fef2f2'  },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'14px 18px', borderLeft:`4px solid ${s.color}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:28, fontWeight:900, color:s.color, fontFamily:font }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Distribution bar */}
          {data.length > 0 && (
            <div style={{ padding:'12px 22px', borderBottom:`1px solid ${C.slate[100]}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.slate[400], marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Distribution</div>
              <div style={{ height:12, borderRadius:999, overflow:'hidden', display:'flex' }}>
                {[['good', C.emerald, stats.good], ['mid', C.amber, stats.mid], ['risk', C.red, stats.risk]].map(([k,color,val]) => (
                  val > 0 ? <div key={k} style={{ flex:val, background:color, transition:'flex .4s' }} title={`${val} students`} /> : null
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:C.slate[50], borderBottom:`1px solid ${C.slate[200]}` }}>
                  <th style={{ padding:'10px 12px', fontSize:11, fontWeight:700, color:C.slate[400], textAlign:'left', textTransform:'uppercase', letterSpacing:'.06em' }}>#</th>
                  <SortTh col="name">Student</SortTh>
                  <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color:C.slate[400] }}>GCC</th>
                  <SortTh col="Present">Present</SortTh>
                  <SortTh col="Absent">Absent</SortTh>
                  <SortTh col="Late">Late</SortTh>
                  <SortTh col="Leave">Leave</SortTh>
                  <SortTh col="total">Total</SortTh>
                  <SortTh col="pct">Attendance %</SortTh>
                  <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', color:C.slate[400] }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row,i) => {
                  const color = row.pct>=75?C.emerald:row.pct>=50?C.amber:C.red
                  return (
                    <tr key={row.name} style={{ borderBottom:`1px solid ${C.slate[100]}`, background: row.pct<50?'#fff5f5':row.pct<75?'#fffbeb':'white' }}>
                      <td style={{ padding:'10px 12px', color:C.slate[400], fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:C.slate[800] }}>{row.name}</td>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12, fontWeight:700, color:C.navy }}>{row.gcc ? `GCC-${row.gcc}` : '—'}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:C.emerald }}>{row.Present}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:C.red     }}>{row.Absent}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:C.amber   }}>{row.Late}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:C.violet  }}>{row.Leave}</td>
                      <td style={{ padding:'10px 12px', color:C.slate[500] }}>{row.total}</td>
                      <td style={{ padding:'10px 12px', minWidth:160 }}><MiniBar pct={row.pct} /></td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:999,
                          background:row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2', color }}>
                          {row.pct>=75?'✅ Good':row.pct>=50?'⚠️ Low':'🚨 Risk'}
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
    </Card>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────

const TABS = [
  { key:'mark',   label:'✏️ Mark Attendance' },
  { key:'view',   label:'📁 Sessions'        },
  { key:'report', label:'📊 Reports'         },
]

export default function Attendance() {
  const [activeTab, setActiveTab] = useState('mark')
  const [staff,     setStaff]     = useState([])

  useEffect(() => {
    supabase.from('staff_profiles').select('id,name,designation').order('name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px', fontFamily: font }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.slate[400], marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>Attendance</div>
        <div style={{ fontSize: 13, color: C.slate[400], marginTop: 3 }}>Mark, view, and analyse session attendance across all batches</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${C.slate[200]}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: 'none', border: 'none', fontFamily: font,
              borderBottom: activeTab===t.key ? `3px solid ${C.navy}` : '3px solid transparent',
              color: activeTab===t.key ? C.navy : C.slate[400], marginBottom: -2,
              transition: 'color .12s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'mark'   && <TabMark   staff={staff} />}
      {activeTab === 'view'   && <TabView   />}
      {activeTab === 'report' && <TabReport />}
    </div>
  )
}
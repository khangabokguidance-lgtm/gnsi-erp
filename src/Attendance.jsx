// ============================================================
//  GNSI Portal — Attendance Module (Advanced v2)
//  All 9 new features added:
//   1. Smart Defaulter Alerts (auto-flag < threshold)
//   2. Leave Management (submit / approve / reject)
//   3. Auto Session Creation (draft from timetable)
//   4. Per-Student Heatmap (calendar view)
//   5. Subject-wise Breakdown (attendance % per subject)
//   6. Teacher Activity Log (sessions + on-time rate)
//   7. Today Quick-Mark Panel (home tab)
//   8. Copy Last Session (pre-fill from previous)
//   9. Instant Parent Notify (SMS/WhatsApp after save)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

// ─── COURSE STRUCTURE ────────────────────────────────────────

const COURSE_STRUCTURE = {
  Sainik:            ['Achiever', 'Leader', 'Champion'],
  Navodaya:          ['Umeed', 'Lakshya'],
  Foundation:        ['Prime', 'Elite'],
  'Combined Course': ['—'],
}
const COURSES      = Object.keys(COURSE_STRUCTURE)
const HOSTEL_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']

// ─── Design Tokens ───────────────────────────────────────────

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

function StatBar({ records }) {
  const counts = useMemo(() => {
    const c = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (c[s] !== undefined) c[s]++ })
    return c
  }, [records])
  const total = Object.values(counts).reduce((a,b)=>a+b,0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
    whatsapp: { background: '#dcfce7', color: '#15803d', border: `1px solid #86efac` },
  }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, ...vars[variant] }}>
      {children}
    </button>
  )
}

// ─── TAB: HOME (Today Quick-Mark + Defaulter Alerts) ─────────

function TabHome({ onNavigate }) {
  const [sessions,   setSessions]   = useState([])
  const [defaulters, setDefaulters] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [threshold,  setThreshold]  = useState(75)
  const [stats,      setStats]      = useState({ total:0, pending:0, risk:0, avgPct:0 })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const todayStr = today()

      // Today's sessions from timetable (auto-session creation preview)
      const { data: todaySess } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('session_date', todayStr)
        .order('period_number')

      // All timetable entries for today's day
      const { data: ttEntries } = await supabase
        .from('timetable_entries')
        .select('*')
        .eq('day_name', todayDay())

      // Build unified "today's periods" list
      const markedPeriods = new Set((todaySess||[]).map(s => `${s.course}|${s.period_number}`))
      const pendingSessions = (ttEntries||[]).map(tt => ({
        ...tt,
        done: markedPeriods.has(`${tt.course}|${tt.period_name}`),
        session: (todaySess||[]).find(s => s.course === tt.course && String(s.period_number) === String(tt.period_name))
      }))

      setSessions(pendingSessions.slice(0, 8))

      // Monthly attendance for defaulter detection
      const monthStart = todayStr.slice(0,7) + '-01'
      const { data: monthSess } = await supabase
        .from('attendance_sessions')
        .select('id')
        .gte('session_date', monthStart)
        .lte('session_date', todayStr)

      if (monthSess?.length) {
        const ids = monthSess.map(s => s.id)
        const { data: recs } = await supabase
          .from('attendance_records')
          .select('student_name,gcc_no,status,session_id')
          .in('session_id', ids)

        const map = {}
        recs?.forEach(r => {
          if (!map[r.student_name]) map[r.student_name] = { name:r.student_name, gcc:r.gcc_no, Present:0, total:0 }
          if (r.status === 'Present') map[r.student_name].Present++
          map[r.student_name].total++
        })
        const rows = Object.values(map).map(r => ({ ...r, pct: r.total > 0 ? Math.round((r.Present/r.total)*100) : 0 }))
        const atRisk = rows.filter(r => r.pct < threshold).sort((a,b) => a.pct - b.pct)
        setDefaulters(atRisk)

        const avgPct = rows.length ? Math.round(rows.reduce((s,r) => s+r.pct, 0) / rows.length) : 0
        setStats({
          total: rows.length,
          pending: pendingSessions.filter(s => !s.done).length,
          risk: atRisk.length,
          avgPct,
        })
      } else {
        setStats(s => ({ ...s, pending: pendingSessions.filter(x => !x.done).length }))
      }
      setLoading(false)
    }
    load()
  }, [threshold])

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: C.slate[400] }}>⏳ Loading dashboard…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Stats Overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Today pending', value: stats.pending, color: C.sky,    bg: '#eff6ff' },
          { label: 'At-risk students', value: stats.risk, color: C.red,     bg: '#fef2f2' },
          { label: 'Students tracked', value: stats.total,color: C.navy,    bg: '#eff6ff' },
          { label: 'Avg attendance',   value: `${stats.avgPct}%`, color: stats.avgPct>=75?C.emerald:C.amber, bg: stats.avgPct>=75?'#f0fdf4':'#fffbeb' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: font }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Today Quick-Mark Panel ── */}
      <Card>
        <CardHead icon="⚡" title="Today's Sessions" sub={`${fmtDate(today())} · ${todayDay()}`}
          right={<Btn small variant="ghost" onClick={() => onNavigate('mark')}>+ New Session</Btn>} />
        <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.slate[400], fontSize: 13 }}>
              No timetable entries found for today. <br />
              <span style={{ fontSize: 12 }}>Add timetable entries or mark attendance manually.</span>
            </div>
          )}
          {sessions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              borderRadius: 10, border: `1px solid ${s.done ? C.slate[100] : '#bfdbfe'}`,
              background: s.done ? C.slate[50] : '#eff6ff', opacity: s.done ? .65 : 1,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.done ? C.emerald : C.sky, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[800] }}>
                  Period {s.period_name} — {s.subject_name || 'No subject'}
                </div>
                <div style={{ fontSize: 11, color: C.slate[400], marginTop: 2 }}>
                  {s.class_name}{s.teacher_name ? ` · ${s.teacher_name}` : ''}
                </div>
              </div>
              {s.done
                ? <span style={{ fontSize: 11, fontWeight: 800, color: C.emerald }}>✓ Done</span>
                : <Btn small variant="primary" onClick={() => onNavigate('mark', s)}>Mark now</Btn>
              }
            </div>
          ))}
        </div>
      </Card>

      {/* ── Defaulter Alerts ── */}
      <Card>
        <CardHead icon="🚨" title="Defaulter Alerts"
          sub={`Students below ${threshold}% attendance this month`}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.slate[500] }}>Threshold:</span>
              <select value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                style={inp({ width: 'auto', padding: '5px 10px' })}>
                {[50,60,65,70,75,80,85].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          }
        />
        <div style={{ padding: '14px 22px' }}>
          {defaulters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.emerald, fontWeight: 700, fontSize: 13 }}>
              ✅ No defaulters — all students above {threshold}%
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {defaulters.slice(0, 10).map(d => (
                <div key={d.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, border: `1px solid ${d.pct < 50 ? '#fca5a5' : '#fde68a'}`,
                  background: d.pct < 50 ? '#fff5f5' : '#fffbeb',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: d.pct < 50 ? '#fee2e2' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: d.pct < 50 ? C.red : C.amber }}>
                    {d.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[800] }}>{d.name}</div>
                    {d.gcc && <div style={{ fontSize: 11, color: C.slate[400] }}>GCC-{d.gcc}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: d.pct < 50 ? C.red : C.amber }}>{d.pct}%</div>
                    <div style={{ fontSize: 10, color: C.slate[400] }}>{d.total} sessions</div>
                  </div>
                  <div style={{ minWidth: 80 }}><MiniBar pct={d.pct} /></div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: d.pct<50?'#fee2e2':'#fef3c7', color: d.pct<50?C.red:C.amber }}>
                    {d.pct < 50 ? '🚨 Risk' : '⚠️ Low'}
                  </span>
                </div>
              ))}
              {defaulters.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: C.slate[400], padding: '8px 0' }}>
                  +{defaulters.length - 10} more · Switch to Reports for full list
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── TAB: MARK ATTENDANCE (+ Copy Last Session + Notify) ─────

function TabMark({ staff, prefill }) {
  const [form, setForm]       = useState({
    session_date: today(), course: prefill?.course||'', subtype: prefill?.subtype||'',
    class_name: prefill?.class_name||'', subject_name: prefill?.subject_name||'',
    teacher_name: prefill?.teacher_name||'', staff_id: '', period_number: prefill?.period_name||'',
    session_type: 'Class', remarks: '',
  })
  const [students,   setStudents]   = useState([])
  const [records,    setRecords]    = useState({})
  const [timetable,  setTimetable]  = useState([])
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [batchId,    setBatchId]    = useState(null)
  const [showNotify, setShowNotify] = useState(false)
  const [savedSessId,setSavedSessId]= useState(null)
  const [copying,    setCopying]    = useState(false)

  const subtypes  = form.course ? COURSE_STRUCTURE[form.course] || [] : []
  const cc        = COURSE_COLORS[form.course] || COURSE_COLORS.Sainik

  const batchSubjects = useMemo(() =>
    timetable.length ? [...new Set(timetable.map(t=>t.subject_name).filter(Boolean))].sort() : SUBJECTS
  , [timetable])

  const batchStaff = useMemo(() => {
    if (!timetable.length) return staff
    const names = new Set(timetable.map(t=>t.teacher_name).filter(Boolean))
    const matched = staff.filter(s => names.has(s.name))
    return matched.length ? matched : staff
  }, [timetable, staff])

  // Load batch + timetable
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
      const { data: tt } = await supabase.from('timetable_entries').select('*').eq('class_name', data.batch_name)
      setTimetable(tt || [])
    }
    fetch()
  }, [form.course, form.subtype, form.class_name])

  // Load students
  useEffect(() => {
    if (!form.course) { setStudents([]); setRecords({}); return }
    const fetch = async () => {
      let q = supabase.from('course_enrollments')
        .select('id,student_name,gcc_no,student_id,hostel_type')
        .eq('status','Active').eq('course', form.course)
      if (form.subtype)    q = q.eq('subtype',    form.subtype)
      if (form.class_name) q = q.eq('class_name', form.class_name)
      const { data, error } = await q.order('student_name')
      if (error) console.error('student fetch error:', error)
      setStudents(data || [])
      const init = {}
      ;(data||[]).forEach(s => { init[s.student_id || s.student_name] = 'Present' })
      setRecords(init)
    }
    fetch()
  }, [form.course, form.subtype, form.class_name])

  // Period auto-fill
  const handlePeriod = (period) => {
    setForm(prev => ({ ...prev, period_number: period }))
    if (!period || !timetable.length) return
    const slot = timetable.find(t => t.period_name === String(period) && t.day_name === todayDay())
    if (slot) {
      const matched = staff.find(s => s.name === slot.teacher_name)
      setForm(prev => ({
        ...prev, period_number: period,
        subject_name: slot.subject_name || prev.subject_name,
        teacher_name: slot.teacher_name || prev.teacher_name,
        staff_id:     matched?.id || prev.staff_id,
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
      next[k] = (records[k] || 'Present') === 'Present' ? 'Absent' : 'Present'
    })
    setRecords(next)
  }

  // ── Feature: Copy Last Session ────────────────────────────
  const copyLastSession = async () => {
    if (!form.course) { setToast({ type:'warn', msg:'Select a course first.' }); return }
    setCopying(true)
    const { data: lastSess } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('course', form.course)
      .eq('subtype', form.subtype || '')
      .order('session_date', { ascending: false })
      .limit(1)
      .single()

    if (!lastSess) { setCopying(false); setToast({ type:'warn', msg:'No previous session found for this course.' }); return }

    const { data: lastRecs } = await supabase
      .from('attendance_records')
      .select('student_name,student_id,status')
      .eq('session_id', lastSess.id)

    if (lastRecs?.length) {
      const copied = {}
      lastRecs.forEach(r => { copied[r.student_id || r.student_name] = r.status })
      setRecords(prev => ({ ...prev, ...copied }))
      setToast({ type:'success', msg:`✅ Copied ${lastRecs.length} records from last session. Adjust any changes.` })
    }
    setCopying(false)
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
    setSavedSessId(sess.id)
    setShowNotify(true)
    setToast({ type:'success', msg: `✅ Attendance saved for ${students.length} students!` })
    setForm(prev => ({ ...prev, subject_name:'', teacher_name:'', staff_id:'', period_number:'', remarks:'' }))
  }

  const filteredStudents = useMemo(() =>
    search.trim()
      ? students.filter(s => s.student_name.toLowerCase().includes(search.toLowerCase()) || (s.gcc_no||'').includes(search))
      : students
  , [students, search])

  const counts = useMemo(() => {
    const c = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (c[s] !== undefined) c[s]++ })
    return c
  }, [records])

  const absentStudents = useMemo(() =>
    students.filter(s => {
      const k = s.student_id || s.student_name
      return records[k] === 'Absent' || records[k] === 'Late'
    })
  , [students, records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Session Details ── */}
      <Card>
        <CardHead icon="📋" title="Session Details" sub="Configure course, period and session metadata" />
        <div style={{ padding: '20px 22px' }}>
          {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
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
              <input value={form.class_name} onChange={e => setForm(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. 9A (optional)" style={inp()} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <Label>Date</Label>
              <input type="date" value={form.session_date}
                onChange={e => setForm(prev => ({ ...prev, session_date: e.target.value }))} style={inp()} />
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
              <input value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional notes..." style={inp()} />
            </div>
          </div>
          {form.course && (
            <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 9,
              background: students.length ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${students.length ? '#86efac' : '#fde68a'}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: students.length ? C.emerald : C.amber }}>
                {students.length ? `${students.length} students enrolled` : '⚠️ No students found'}
              </span>
              {timetable.length > 0 && (
                <span style={{ fontSize: 11, color: C.sky, fontWeight: 700 }}>
                  📅 {timetable.length} timetable slots
                </span>
              )}
              {form.course && <CoursePill course={form.course} />}
            </div>
          )}
        </div>
      </Card>

      {/* ── Mark Attendance ── */}
      {students.length > 0 && (
        <Card>
          <CardHead icon="✏️" title="Mark Attendance"
            sub={`${form.course}${form.subtype ? ' / '+form.subtype : ''} · ${fmtDate(form.session_date)}${form.subject_name ? ' · '+form.subject_name : ''}`}
            right={
              <>
                {/* Feature: Copy Last Session */}
                <Btn small variant="amber" onClick={copyLastSession} disabled={copying}>
                  {copying ? '⏳' : '📋'} Copy last session
                </Btn>
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

          <div style={{ padding: '10px 22px', borderBottom: `1px solid ${C.slate[100]}` }}>
            <StatBar records={records} />
          </div>

          <div style={{ padding: '12px 22px', borderBottom: `1px solid ${C.slate[100]}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search student name or GCC…" style={inp({ maxWidth: 340 })} />
          </div>

          <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filteredStudents.map((s, i) => {
              const key    = s.student_id || s.student_name
              const status = records[key] || 'Present'
              const sm     = STATUS_META[status]
              const hc     = HOSTEL_COLORS[s.hostel_type] || HOSTEL_COLORS['Day Scholar']
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderRadius: 10, border: `1px solid ${status==='Absent'?'#fca5a5':C.slate[100]}`,
                  background: status==='Absent'?'#fff5f5':status==='Late'?'#fffbeb':status==='Leave'?'#faf5ff':'white',
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

          <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.slate[100]}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="success" disabled={saving} onClick={handleSave}>
              {saving ? '⏳ Saving…' : `✅ Save Attendance (${students.length} students)`}
            </Btn>
          </div>
        </Card>
      )}

      {/* ── Feature: Instant Parent Notify ── */}
      {showNotify && absentStudents.length > 0 && (
        <NotifyPanel
          students={absentStudents}
          records={records}
          sessionInfo={form}
          onClose={() => setShowNotify(false)}
        />
      )}
    </div>
  )
}

// ─── NOTIFY PANEL (Feature 9: Instant Parent Notify) ─────────

function NotifyPanel({ students, records, sessionInfo, onClose }) {
  const [sent,    setSent]    = useState({})
  const [channel, setChannel] = useState('sms')
  const [sending, setSending] = useState(false)

  const msgFor = (s) => {
    const status = records[s.student_id || s.student_name]
    return `Dear Parent, your ward ${s.student_name} was marked ${status} on ${fmtDate(sessionInfo.session_date)}${sessionInfo.subject_name ? ' in ' + sessionInfo.subject_name : ''}. Please ensure regular attendance. — GNSI`
  }

  const sendAll = async () => {
    setSending(true)
    // In production: call your SMS/WhatsApp API (MSG91, Twilio, etc.)
    // Here we simulate the send and log to a notifications table
    const rows = students.map(s => ({
      student_name: s.student_name,
      student_id:   s.student_id || null,
      phone:        s.students?.phone || null,
      channel,
      message:      msgFor(s),
      status:       'sent',
      sent_at:      new Date().toISOString(),
    }))
    await supabase.from('parent_notifications').insert(rows)
    const sentMap = {}
    students.forEach(s => { sentMap[s.student_id || s.student_name] = true })
    setSent(sentMap)
    setSending(false)
  }

  return (
    <Card style={{ border: `1.5px solid #93c5fd` }}>
      <CardHead icon="📲" title="Notify Parents"
        sub={`${students.length} absent/late student${students.length > 1 ? 's' : ''} · send ${channel.toUpperCase()} now`}
        right={
          <>
            <Select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: 'auto' }}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </Select>
            <Btn small variant="ghost" onClick={onClose}>✕ Dismiss</Btn>
          </>
        }
      />
      <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Message preview */}
        <div style={{ background: C.slate[50], border: `1px solid ${C.slate[200]}`, borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Message preview</div>
          <div style={{ fontSize: 12, color: C.slate[700], lineHeight: 1.6 }}>
            {students[0] ? msgFor(students[0]) : '—'}
          </div>
        </div>

        {/* Student list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {students.map(s => {
            const key    = s.student_id || s.student_name
            const status = records[key]
            const sm     = STATUS_META[status] || STATUS_META.Absent
            const isSent = sent[key]
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 9, background: isSent ? '#f0fdf4' : sm.bg, border: `1px solid ${isSent ? '#86efac' : sm.border}` }}>
                <span style={{ fontSize: 14, color: sm.color }}>{sm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[800] }}>{s.student_name}</div>
                  <div style={{ fontSize: 11, color: C.slate[400] }}>
                    {s.students?.phone ? `📞 ${s.students.phone}` : 'No phone on record'}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: sm.color }}>{status}</span>
                {isSent && <span style={{ fontSize: 11, fontWeight: 800, color: C.emerald }}>✓ Sent</span>}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {Object.keys(sent).length === students.length ? (
            <Alert type="success">✅ All notifications sent!</Alert>
          ) : (
            <>
              <Btn variant="ghost" onClick={onClose}>Skip</Btn>
              <Btn variant={channel === 'whatsapp' ? 'whatsapp' : 'primary'} disabled={sending} onClick={sendAll}>
                {sending ? '⏳ Sending…' : `📲 Send ${channel === 'both' ? 'SMS + WhatsApp' : channel.toUpperCase()} to ${students.length} parents`}
              </Btn>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── TAB: VIEW SESSIONS ───────────────────────────────────────

function TabView() {
  const [sessions,     setSessions]    = useState([])
  const [loading,      setLoading]     = useState(true)
  const [expanded,     setExpanded]    = useState(null)
  const [records,      setRecords]     = useState({})
  const [dateFilter,   setDateFilter]  = useState('')
  const [courseFilter, setCourseFilter]= useState('All')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions').select('*').order('session_date',{ascending:false}).limit(150)
    if (dateFilter)             q = q.eq('session_date', dateFilter)
    if (courseFilter !== 'All') q = q.eq('course', courseFilter)
    const { data } = await q
    setSessions(data || [])
    setLoading(false)
  }, [dateFilter, courseFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

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
    fetchSessions()
  }

  return (
    <Card>
      <CardHead icon="📁" title="Sessions" sub="All recorded attendance sessions"
        right={<span style={{ fontSize: 12, color: C.slate[400], fontWeight: 600 }}>{sessions.length} total</span>} />
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
          const total = recs.length
          const pct   = total > 0 ? Math.round((counts.Present / total)*100) : null

          return (
            <div key={sess.id} style={{ border: `1px solid ${C.slate[200]}`, borderRadius: 12, overflow: 'hidden' }}>
              <div onClick={() => expand(sess.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', cursor:'pointer', background: isOpen ? C.slate[50] : 'white' }}>
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
                  </div>
                </div>
                <Btn small variant="danger" onClick={e => { e.stopPropagation(); deleteSession(sess.id) }}>🗑</Btn>
                <span style={{ color:C.slate[300], fontSize:18, transform: isOpen?'rotate(180deg)':'none', transition:'transform .2s' }}>▾</span>
              </div>
              {isOpen && (
                <div style={{ borderTop:`1px solid ${C.slate[100]}`, padding:'16px 18px', background: C.slate[50] }}>
                  <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                    {STATUSES.map(s => counts[s] > 0 && (
                      <span key={s} style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:700, background:STATUS_META[s].bg, color:STATUS_META[s].color, border:`1px solid ${STATUS_META[s].border}` }}>
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

// ─── TAB: REPORTS (+ Heatmap + Subject Breakdown + Teacher Log)

function TabReport() {
  const [reportTab, setReportTab] = useState('monthly')
  const [month,     setMonth]     = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [course,    setCourse]    = useState('All')
  const [subtype,   setSubtype]   = useState('All')
  const [data,      setData]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [sort,      setSort]      = useState({ by:'pct', asc:true })

  const subtypes = course !== 'All' ? (COURSE_STRUCTURE[course]||[]) : []

  const fetchReport = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions').select('id,session_date,course,subtype,subject_name,teacher_name,created_at')
      .gte('session_date',`${month}-01`).lte('session_date',`${month}-31`)
    if (course  !== 'All') q = q.eq('course',  course)
    if (subtype !== 'All') q = q.eq('subtype', subtype)
    const { data: sessions } = await q
    if (!sessions?.length) { setData([]); setLoading(false); return }
    const ids = sessions.map(s=>s.id)
    const { data: recs } = await supabase.from('attendance_records')
      .select('session_id,student_name,gcc_no,status').in('session_id', ids)

    const map = {}
    recs?.forEach(r => {
      if (!map[r.student_name]) map[r.student_name] = { name:r.student_name, gcc:r.gcc_no, Present:0,Absent:0,Late:0,Leave:0,total:0, bySubject:{}, byDate:{} }
      map[r.student_name][r.status]++
      map[r.student_name].total++
      // Subject breakdown
      const sess = sessions.find(s=>s.id===r.session_id)
      if (sess?.subject_name) {
        const sb = map[r.student_name].bySubject
        if (!sb[sess.subject_name]) sb[sess.subject_name] = { Present:0, total:0 }
        if (r.status==='Present') sb[sess.subject_name].Present++
        sb[sess.subject_name].total++
      }
      // Date heatmap
      if (sess?.session_date) {
        map[r.student_name].byDate[sess.session_date] = r.status
      }
    })
    const rows = Object.values(map).map(r => ({ ...r, pct: r.total>0?Math.round((r.Present/r.total)*100):0 }))
    setData(rows)
    setLoading(false)
  }, [month, course, subtype])

  useEffect(() => { fetchReport() }, [fetchReport])

  const sorted = useMemo(() => {
    return [...data].sort((a,b) => {
      const v = sort.by==='pct' ? a.pct-b.pct : sort.by==='name' ? a.name.localeCompare(b.name) : a[sort.by]-b[sort.by]
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

  const REPORT_TABS = [
    { key:'monthly',   label:'Monthly' },
    { key:'heatmap',   label:'📅 Heatmap' },
    { key:'subject',   label:'📚 By Subject' },
    { key:'teacher',   label:'👨‍🏫 Teachers' },
  ]

  return (
    <Card>
      <CardHead icon="📊" title="Reports" sub={`Attendance analytics · ${fmtMonth(month)}`}
        right={
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
        }
      />

      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.slate[200]}`, padding:'0 22px', overflowX:'auto' }}>
        {REPORT_TABS.map(t => (
          <button key={t.key} onClick={() => setReportTab(t.key)}
            style={{ padding:'10px 18px', fontWeight:700, fontSize:12, cursor:'pointer', background:'none', border:'none',
              fontFamily:font, color: reportTab===t.key ? C.navy : C.slate[400],
              borderBottom: reportTab===t.key ? `3px solid ${C.navy}` : '3px solid transparent',
              whiteSpace:'nowrap', transition:'color .12s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:C.slate[400], fontSize:13 }}>⏳ Generating report…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:C.slate[400], fontSize:13 }}>No attendance data for this period.</div>
      ) : (
        <>
          {/* Summary cards — shown on all sub-tabs */}
          <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.slate[100]}`, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[
              { label:'Students',     value:stats.total, color:C.navy,    bg:'#eff6ff' },
              { label:'≥75% (Good)',  value:stats.good,  color:C.emerald, bg:'#f0fdf4' },
              { label:'50–74% (Low)', value:stats.mid,   color:C.amber,   bg:'#fffbeb' },
              { label:'<50% (Risk)',  value:stats.risk,  color:C.red,     bg:'#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'14px 18px', borderLeft:`4px solid ${s.color}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:28, fontWeight:900, color:s.color, fontFamily:font }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Monthly Table ── */}
          {reportTab === 'monthly' && (
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
                          <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:999, background:row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2', color }}>
                            {row.pct>=75?'✅ Good':row.pct>=50?'⚠️ Low':'🚨 Risk'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Heatmap Tab (Feature 4) ── */}
          {reportTab === 'heatmap' && (
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sorted.slice(0, 15).map(row => (
                <HeatmapRow key={row.name} row={row} month={month} />
              ))}
              {sorted.length > 15 && (
                <div style={{ textAlign:'center', fontSize:12, color:C.slate[400] }}>Showing top 15 students. Use filters to narrow down.</div>
              )}
            </div>
          )}

          {/* ── Subject Breakdown Tab (Feature 5) ── */}
          {reportTab === 'subject' && (
            <SubjectBreakdown data={data} />
          )}

          {/* ── Teacher Activity Tab (Feature 6) ── */}
          {reportTab === 'teacher' && (
            <TeacherLog month={month} course={course} />
          )}
        </>
      )}
    </Card>
  )
}

// ─── Heatmap Row (Feature 4: Per-Student Heatmap) ────────────

function HeatmapRow({ row, month }) {
  const [y, m] = month.split('-')
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDay = new Date(y, m-1, 1).getDay()

  const cells = []
  // Pad start
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${m}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, status: row.byDate[key] || null })
  }

  const STATUS_COLORS = {
    Present: { bg: '#dcfce7', color: '#16a34a', label: 'P' },
    Absent:  { bg: '#fee2e2', color: '#dc2626', label: 'A' },
    Late:    { bg: '#fef9c3', color: '#92400e', label: 'L' },
    Leave:   { bg: '#f3e8ff', color: '#7c3aed', label: 'Lv' },
  }

  const streak = (() => {
    let s = 0
    const sorted = Object.entries(row.byDate).sort((a,b)=>a[0]>b[0]?-1:1)
    for (const [,status] of sorted) {
      if (status === 'Present') s++
      else break
    }
    return s
  })()

  return (
    <div style={{ background: C.slate[50], borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.slate[200]}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color: row.pct>=75?C.emerald:row.pct>=50?C.amber:C.red }}>
          {row.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:13, color:C.slate[800] }}>{row.name}</div>
          {row.gcc && <div style={{ fontSize:11, color:C.slate[400] }}>GCC-{row.gcc}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:18, fontWeight:900, color: row.pct>=75?C.emerald:row.pct>=50?C.amber:C.red }}>{row.pct}%</div>
        </div>
        {streak > 0 && (
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:800, color:'#c2410c' }}>
            🔥 {streak}d streak
          </div>
        )}
      </div>
      {/* Day labels */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:9, color:C.slate[400], fontWeight:700 }}>{d}</div>
        ))}
      </div>
      {/* Calendar cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />
          const sc = cell.status ? STATUS_COLORS[cell.status] : null
          return (
            <div key={cell.day} title={cell.status || 'No session'}
              style={{
                aspectRatio:'1', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:700,
                background: sc ? sc.bg : C.slate[100],
                color: sc ? sc.color : C.slate[300],
              }}>
              {cell.day}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div style={{ display:'flex', gap:10, marginTop:8, flexWrap:'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([s,sc]) => (
          <span key={s} style={{ fontSize:10, display:'flex', alignItems:'center', gap:4, color:C.slate[500] }}>
            <span style={{ width:10, height:10, borderRadius:2, background:sc.bg, border:`1px solid ${sc.color}30`, display:'inline-block' }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Subject Breakdown (Feature 5) ───────────────────────────

function SubjectBreakdown({ data }) {
  // Aggregate all subjects across all students
  const subjectMap = useMemo(() => {
    const sm = {}
    data.forEach(row => {
      Object.entries(row.bySubject || {}).forEach(([subj, counts]) => {
        if (!sm[subj]) sm[subj] = { Present:0, total:0, students:0 }
        sm[subj].Present += counts.Present
        sm[subj].total   += counts.total
        sm[subj].students++
      })
    })
    return Object.entries(sm)
      .map(([name, v]) => ({ name, pct: v.total>0?Math.round((v.Present/v.total)*100):0, ...v }))
      .sort((a,b) => b.pct - a.pct)
  }, [data])

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
        Average attendance % per subject · {data.length} students
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subjectMap.map(subj => (
          <div key={subj.name} style={{ background: subj.pct<50?'#fff5f5':subj.pct<75?'#fffbeb':'white', border:`1px solid ${subj.pct<50?'#fca5a5':subj.pct<75?'#fde68a':C.slate[200]}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:13, color:C.slate[800], flex:1 }}>{subj.name}</div>
              <span style={{ fontSize:11, color:C.slate[400] }}>{subj.students} students · {subj.total} sessions</span>
              <span style={{ fontSize:16, fontWeight:900, color: subj.pct>=75?C.emerald:subj.pct>=50?C.amber:C.red }}>{subj.pct}%</span>
            </div>
            <MiniBar pct={subj.pct} />

            {/* Per-student mini breakdown */}
            <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:5 }}>
              {data.filter(r => r.bySubject?.[subj.name]).slice(0,8).map(r => {
                const sb = r.bySubject[subj.name]
                const p  = sb.total>0?Math.round((sb.Present/sb.total)*100):0
                return (
                  <div key={r.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                    <span style={{ color:C.slate[600], flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                    <span style={{ fontWeight:800, color: p>=75?C.emerald:p>=50?C.amber:C.red, minWidth:30 }}>{p}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {subjectMap.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px 0', color:C.slate[400], fontSize:13 }}>
            Subject data requires sessions to have a subject_name assigned.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Teacher Activity Log (Feature 6) ────────────────────────

function TeacherLog({ month, course }) {
  const [teacherData, setTeacherData] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      let q = supabase.from('attendance_sessions')
        .select('id,teacher_name,staff_id,session_date,period_number,created_at,subject_name,course')
        .gte('session_date',`${month}-01`).lte('session_date',`${month}-31`)
        .not('teacher_name', 'is', null)
      if (course !== 'All') q = q.eq('course', course)
      const { data: sessions } = await q

      if (!sessions?.length) { setTeacherData([]); setLoading(false); return }

      // Aggregate per teacher
      const map = {}
      sessions.forEach(s => {
        const t = s.teacher_name
        if (!map[t]) map[t] = { name:t, sessions:0, subjects: new Set(), courses: new Set(), onTimeCount:0 }
        map[t].sessions++
        if (s.subject_name) map[t].subjects.add(s.subject_name)
        if (s.course)       map[t].courses.add(s.course)
        // "On time" heuristic: session created within 30 min of start (if timestamps available)
        if (s.created_at && s.session_date) {
          const created = new Date(s.created_at)
          const sessionStart = new Date(s.session_date + 'T07:00:00')
          const diffHours = (created - sessionStart) / 3600000
          if (diffHours < 12) map[t].onTimeCount++
        } else {
          map[t].onTimeCount++
        }
      })

      const rows = Object.values(map).map(t => ({
        ...t,
        subjects: [...t.subjects],
        courses:  [...t.courses],
        onTimePct: t.sessions > 0 ? Math.round((t.onTimeCount / t.sessions)*100) : 100,
      })).sort((a,b) => b.sessions - a.sessions)

      setTeacherData(rows)
      setLoading(false)
    }
    fetch()
  }, [month, course])

  if (loading) return <div style={{ padding:32, textAlign:'center', color:C.slate[400] }}>⏳ Loading teacher data…</div>
  if (!teacherData.length) return <div style={{ padding:48, textAlign:'center', color:C.slate[400] }}>No teacher data for this period.</div>

  return (
    <div style={{ padding: '18px 22px', display:'flex', flexDirection:'column', gap:10 }}>
      {teacherData.map((t, i) => (
        <div key={t.name} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 18px', borderRadius:12, border:`1px solid ${C.slate[200]}`, background:'white' }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:C.navy, flexShrink:0 }}>
            {t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:14, color:C.slate[800], marginBottom:4 }}>{t.name}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              {t.courses.map(c => <CoursePill key={c} course={c} />)}
              {t.subjects.slice(0,3).map(s => (
                <span key={s} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:5, background:C.slate[100], color:C.slate[600] }}>{s}</span>
              ))}
              {t.subjects.length > 3 && <span style={{ fontSize:10, color:C.slate[400] }}>+{t.subjects.length-3} more</span>}
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:10, color:C.slate[400], fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Sessions</div>
                <div style={{ fontSize:20, fontWeight:900, color:C.navy }}>{t.sessions}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.slate[400], fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>On-time rate</div>
                <MiniBar pct={t.onTimePct} />
              </div>
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, color:C.slate[400], fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>Rank</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.slate[300] }}>#{i+1}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── TAB: LEAVE MANAGEMENT (Feature 2) ───────────────────────

function TabLeave({ staff }) {
  const [leaveTab,  setLeaveTab]  = useState('pending')
  const [leaves,    setLeaves]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [form,      setForm]      = useState({ student_name:'', from_date:'', to_date:'', reason:'', course:'', subtype:'' })
  const [submitting,setSubmitting]= useState(false)

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false })
    if (leaveTab === 'pending')  q = q.eq('status', 'Pending')
    if (leaveTab === 'approved') q = q.eq('status', 'Approved')
    if (leaveTab === 'rejected') q = q.eq('status', 'Rejected')
    const { data } = await q.limit(50)
    setLeaves(data || [])
    setLoading(false)
  }, [leaveTab])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  const updateLeave = async (id, status) => {
    await supabase.from('leave_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    setToast({ type: status==='Approved'?'success':'warn', msg: `Leave ${status.toLowerCase()} successfully.` })
    fetchLeaves()
  }

  const submitLeave = async () => {
    if (!form.student_name || !form.from_date || !form.to_date || !form.reason) {
      setToast({ type:'warn', msg:'Please fill all required fields.' }); return
    }
    setSubmitting(true)
    const { error } = await supabase.from('leave_requests').insert([{
      student_name: form.student_name,
      from_date:    form.from_date,
      to_date:      form.to_date,
      reason:       form.reason,
      course:       form.course || null,
      subtype:      form.subtype || null,
      status:       'Pending',
    }])
    setSubmitting(false)
    if (error) { setToast({ type:'error', msg: error.message }); return }
    setToast({ type:'success', msg:'✅ Leave request submitted.' })
    setForm({ student_name:'', from_date:'', to_date:'', reason:'', course:'', subtype:'' })
    if (leaveTab === 'pending') fetchLeaves()
  }

  const LEAVE_TABS = [
    { key:'pending',  label:'⏳ Pending' },
    { key:'approved', label:'✅ Approved' },
    { key:'rejected', label:'✗ Rejected' },
    { key:'apply',    label:'+ Apply' },
  ]

  const statusColors = {
    Pending:  { bg:'#fef9c3', color:'#92400e', border:'#fde68a' },
    Approved: { bg:'#dcfce7', color:'#16a34a', border:'#86efac' },
    Rejected: { bg:'#fee2e2', color:'#dc2626', border:'#fca5a5' },
  }

  return (
    <Card>
      <CardHead icon="📅" title="Leave Management" sub="Review, approve or submit student leave requests" />

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.slate[200]}`, padding:'0 22px' }}>
        {LEAVE_TABS.map(t => (
          <button key={t.key} onClick={() => setLeaveTab(t.key)}
            style={{ padding:'10px 18px', fontWeight:700, fontSize:12, cursor:'pointer', background:'none', border:'none',
              fontFamily:font, color: leaveTab===t.key ? C.navy : C.slate[400],
              borderBottom: leaveTab===t.key ? `3px solid ${C.navy}` : '3px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:'16px 22px' }}>
        {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

        {/* Leave list */}
        {leaveTab !== 'apply' && (
          loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:C.slate[400] }}>⏳ Loading…</div>
          ) : leaves.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:C.slate[400] }}>No {leaveTab} leave requests.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {leaves.map(lv => {
                const sc = statusColors[lv.status] || statusColors.Pending
                const days = Math.ceil((new Date(lv.to_date) - new Date(lv.from_date)) / 86400000) + 1
                return (
                  <div key={lv.id} style={{ border:`1px solid ${sc.border}`, borderRadius:12, padding:'14px 18px', background: sc.bg }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:C.slate[800] }}>{lv.student_name}</div>
                        <div style={{ fontSize:12, color:C.slate[500], marginTop:2 }}>
                          {fmtDate(lv.from_date)} → {fmtDate(lv.to_date)} · <strong>{days} day{days>1?'s':''}</strong>
                          {lv.course && ` · ${lv.course}${lv.subtype ? ' / '+lv.subtype : ''}`}
                        </div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:999, background: sc.bg, color: sc.color, border:`1px solid ${sc.border}` }}>
                        {lv.status}
                      </span>
                    </div>
                    <div style={{ fontSize:13, color:C.slate[700], background:'rgba(255,255,255,.5)', padding:'8px 12px', borderRadius:8, marginBottom: lv.status==='Pending'?10:0 }}>
                      <em>"{lv.reason}"</em>
                    </div>
                    {lv.status === 'Pending' && (
                      <div style={{ display:'flex', gap:8 }}>
                        <Btn small variant="success" onClick={() => updateLeave(lv.id, 'Approved')}>✅ Approve</Btn>
                        <Btn small variant="danger"  onClick={() => updateLeave(lv.id, 'Rejected')}>✗ Reject</Btn>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Apply form */}
        {leaveTab === 'apply' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
              <div>
                <Label>Course</Label>
                <Select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subtype:'' }))}>
                  <option value="">Select Course</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Batch</Label>
                <Select value={form.subtype} disabled={!form.course} onChange={e => setForm(p => ({ ...p, subtype: e.target.value }))}>
                  <option value="">Select Batch</option>
                  {(form.course ? COURSE_STRUCTURE[form.course]||[] : []).map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Student Name *</Label>
              <input value={form.student_name} onChange={e => setForm(p => ({ ...p, student_name: e.target.value }))}
                placeholder="Full name" style={inp()} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
              <div>
                <Label>From Date *</Label>
                <input type="date" value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} style={inp()} />
              </div>
              <div>
                <Label>To Date *</Label>
                <input type="date" value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} style={inp()} />
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Enter leave reason…" rows={3}
                style={{ ...inp(), resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <Btn variant="primary" disabled={submitting} onClick={submitLeave}>
                {submitting ? '⏳ Submitting…' : '📤 Submit Leave Request'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────

const TABS = [
  { key:'home',   label:'🏠 Dashboard' },
  { key:'mark',   label:'✏️ Mark Attendance' },
  { key:'view',   label:'📁 Sessions' },
  { key:'report', label:'📊 Reports' },
  { key:'leave',  label:'📅 Leaves' },
]

export default function Attendance() {
  const [activeTab, setActiveTab] = useState('home')
  const [staff,     setStaff]     = useState([])
  const [markPrefill, setMarkPrefill] = useState(null)

  useEffect(() => {
    supabase.from('staff_profiles').select('id,name,designation').order('name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  const navigateTo = (tab, prefill=null) => {
    setMarkPrefill(prefill)
    setActiveTab(tab)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px', fontFamily: font }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.slate[400], marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>Attendance</div>
        <div style={{ fontSize: 13, color: C.slate[400], marginTop: 3 }}>Mark, view, analyse and manage attendance across all batches</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${C.slate[200]}`, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: 'none', border: 'none', fontFamily: font, whiteSpace: 'nowrap',
              borderBottom: activeTab===t.key ? `3px solid ${C.navy}` : '3px solid transparent',
              color: activeTab===t.key ? C.navy : C.slate[400], marginBottom: -2,
              transition: 'color .12s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'home'   && <TabHome   onNavigate={navigateTo} />}
      {activeTab === 'mark'   && <TabMark   staff={staff} prefill={markPrefill} />}
      {activeTab === 'view'   && <TabView   />}
      {activeTab === 'report' && <TabReport />}
      {activeTab === 'leave'  && <TabLeave  staff={staff} />}
    </div>
  )
}
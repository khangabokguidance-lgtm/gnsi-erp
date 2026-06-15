// ============================================================
//  GNSI Portal — Attendance Module (Premium v4 · Redesigned)
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

// ─── Design System ───────────────────────────────────────────

const T = {
  // Primary palette
  ink:     '#0f1923',   // near-black, text
  navy:    '#1a3a5c',   // primary brand
  navyMid: '#24527a',
  blue:    '#2563eb',   // interactive
  blueSoft:'#dbeafe',

  // Status
  green:   '#16a34a',
  greenSoft:'#dcfce7',
  amber:   '#b45309',
  amberSoft:'#fef3c7',
  red:     '#dc2626',
  redSoft: '#fee2e2',
  violet:  '#7c3aed',
  violetSoft:'#ede9fe',

  // Neutrals — refined scale
  white:   '#ffffff',
  gray50:  '#f8fafc',
  gray100: '#f1f5f9',
  gray150: '#e9eef5',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',

  // Shadows
  shadowSm: '0 1px 3px rgba(15,25,35,.08), 0 1px 2px rgba(15,25,35,.04)',
  shadowMd: '0 4px 12px rgba(15,25,35,.08), 0 2px 4px rgba(15,25,35,.04)',
  shadowLg: '0 8px 24px rgba(15,25,35,.10), 0 3px 8px rgba(15,25,35,.06)',

  // Border
  border: '#e2e8f0',
  borderMid: '#cbd5e1',
}

const font    = "'Inter', system-ui, -apple-system, sans-serif"
const fontMono= "'JetBrains Mono', 'Fira Code', monospace"

// Course accent palette — more refined
const COURSE_ACCENT = {
  Sainik:            { color: '#1d4ed8', bg: '#eff6ff', pill: '#dbeafe', text: '#1e40af' },
  Navodaya:          { color: '#15803d', bg: '#f0fdf4', pill: '#dcfce7', text: '#166534' },
  Foundation:        { color: '#b45309', bg: '#fffbeb', pill: '#fef3c7', text: '#92400e' },
  'Combined Course': { color: '#6d28d9', bg: '#f5f3ff', pill: '#ede9fe', text: '#5b21b6' },
}

const STATUS_META = {
  Present: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '✓', label: 'Present', dot: '#22c55e' },
  Absent:  { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3', icon: '✕', label: 'Absent',  dot: '#f43f5e' },
  Late:    { bg: '#fffbeb', color: '#b45309', border: '#fde68a', icon: '◷', label: 'Late',    dot: '#f59e0b' },
  Leave:   { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '↗', label: 'Leave',   dot: '#8b5cf6' },
}
const STATUSES = ['Present', 'Absent', 'Late', 'Leave']

const SESSION_TYPES = ['Class']
const PERIODS       = [1,2,3,4,5,6,7,8]

const SUBJECTS = [
  'Mathematics','English Grammar','General Knowledge','General Science',
  'Vocabulary','Reasoning','Foundation Mathematics','Hindi',
  'Mental Ability','Meitei Mayek','Mathematics I','Mathematics II',
]

const today    = () => new Date().toISOString().split('T')[0]
const fmtDate  = d  => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtMonth = m  => { const [y,mo] = m.split('-'); return new Date(y, mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
const todayDay = () => new Date().toLocaleDateString('en-US', { weekday:'long' })

// ─── Mobile Hook ─────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setMobile(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return mobile
}

// ─── Base UI ─────────────────────────────────────────────────

const inputStyle = (extra = {}) => ({
  padding: '9px 13px',
  borderRadius: 8,
  border: `1.5px solid ${T.gray200}`,
  fontSize: 13,
  fontFamily: font,
  outline: 'none',
  background: T.white,
  color: T.ink,
  boxSizing: 'border-box',
  width: '100%',
  transition: 'border-color .15s, box-shadow .15s',
  lineHeight: '1.4',
  ...extra,
})

function Label({ children, required, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{
        fontSize: 11.5, fontWeight: 600, color: T.gray700, letterSpacing: '.01em',
      }}>
        {children}
        {required && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
      </span>
      {hint && <span style={{ fontSize: 11, color: T.gray400, marginLeft: 6 }}>{hint}</span>}
    </div>
  )
}

function Select({ value, onChange, disabled, children, style = {} }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      style={{
        ...inputStyle(),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 32,
        ...style,
      }}>
      {children}
    </select>
  )
}

function StatusDot({ status, size = 8 }) {
  const sm = STATUS_META[status] || STATUS_META.Present
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: sm.dot, flexShrink: 0,
    }} />
  )
}

function CoursePill({ course }) {
  const ca = COURSE_ACCENT[course] || COURSE_ACCENT.Sainik
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
      padding: '2px 8px', borderRadius: 5,
      background: ca.pill, color: ca.text,
      display: 'inline-flex', alignItems: 'center',
    }}>
      {course}
    </span>
  )
}

// ─── Buttons ─────────────────────────────────────────────────

function Btn({ children, onClick, disabled, variant = 'primary', small, icon, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontFamily: font, fontWeight: 600,
    borderRadius: small ? 7 : 9, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 12 : 13,
    padding: small ? '6px 11px' : '9px 18px',
    transition: 'all .14s', flexShrink: 0,
    minHeight: small ? 30 : 38,
    WebkitTapHighlightColor: 'transparent',
    letterSpacing: '.01em',
    lineHeight: 1,
  }
  const vars = {
    primary:  {
      background: disabled ? T.gray200 : T.navy,
      color: disabled ? T.gray400 : T.white,
      boxShadow: disabled ? 'none' : T.shadowSm,
    },
    success: {
      background: disabled ? T.gray200 : '#15803d',
      color: disabled ? T.gray400 : T.white,
      boxShadow: disabled ? 'none' : T.shadowSm,
    },
    danger: {
      background: '#fff1f2',
      color: '#e11d48',
      border: `1.5px solid #fecdd3`,
    },
    ghost: {
      background: T.white,
      color: T.gray600,
      border: `1.5px solid ${T.gray200}`,
    },
    amber: {
      background: '#fffbeb',
      color: '#92400e',
      border: `1.5px solid #fde68a`,
    },
    whatsapp: {
      background: '#f0fdf4',
      color: '#15803d',
      border: `1.5px solid #bbf7d0`,
    },
    blue: {
      background: '#eff6ff',
      color: '#1d4ed8',
      border: `1.5px solid #bfdbfe`,
    },
  }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, ...vars[variant], ...style }}>
      {children}
    </button>
  )
}

// ─── Card System ─────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.white,
      borderRadius: 14,
      border: `1.5px solid ${T.gray150}`,
      boxShadow: T.shadowSm,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ icon, title, subtitle, right, accent }) {
  const isMobile = useIsMobile()
  return (
    <div style={{
      padding: isMobile ? '14px 16px' : '16px 22px',
      borderBottom: `1.5px solid ${T.gray100}`,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
      background: T.gray50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {accent && (
          <div style={{
            width: 3, height: 20, background: accent,
            borderRadius: 3, flexShrink: 0,
          }} />
        )}
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: T.gray100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 13.5 : 14.5,
            fontWeight: 600, color: T.ink, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 11.5, color: T.gray400, marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {right && (
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center',
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {right}
        </div>
      )}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '4px 0 12px',
    }}>
      <div style={{ flex: 1, height: 1, background: T.gray150 }} />
      <span style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: T.gray400,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: T.gray150 }} />
    </div>
  )
}

// ─── Alerts ──────────────────────────────────────────────────

function Alert({ type = 'info', children, onClose }) {
  const map = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'ℹ' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '✓' },
    warn:    { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '!' },
    error:   { bg: '#fff1f2', border: '#fecdd3', color: '#be123c', icon: '✕' },
  }
  const s = map[type]
  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: 9, padding: '10px 14px', marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{
        fontSize: 12, fontWeight: 800, color: s.color,
        width: 18, height: 18, borderRadius: '50%',
        border: `1.5px solid ${s.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        {s.icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: s.color, flex: 1, lineHeight: 1.5 }}>
        {children}
      </span>
      {onClose && (
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: s.color, fontSize: 16, lineHeight: 1,
          padding: 0, flexShrink: 0, opacity: .6,
        }}>×</button>
      )}
    </div>
  )
}

// ─── Inline Confirm ──────────────────────────────────────────

function InlineConfirm({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      background: '#fff1f2', border: `1.5px solid #fecdd3`,
      borderRadius: 9, padding: '12px 14px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, color: '#be123c', fontWeight: 500, flex: 1 }}>
        {message}
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Btn small variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn small variant="danger" onClick={onConfirm}>Delete</Btn>
      </div>
    </div>
  )
}

// ─── Progress & Stats ─────────────────────────────────────────

function AttendBar({ records }) {
  const counts = useMemo(() => {
    const c = { Present:0, Absent:0, Late:0, Leave:0 }
    Object.values(records).forEach(s => { if (c[s] !== undefined) c[s]++ })
    return c
  }, [records])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return (
    <div style={{
      height: 5, borderRadius: 999, overflow: 'hidden',
      display: 'flex', background: T.gray100,
    }}>
      {STATUSES.map(s => counts[s] > 0 && (
        <div key={s} style={{
          width: `${(counts[s] / total) * 100}%`, height: '100%',
          background: STATUS_META[s].dot, transition: 'width .35s',
        }} />
      ))}
    </div>
  )
}

function MiniBar({ pct }) {
  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#e11d48'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 4, background: T.gray100,
        borderRadius: 999, overflow: 'hidden', minWidth: 48,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: 999,
          transition: 'width .4s',
        }} />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 700, color,
        minWidth: 34, textAlign: 'right',
        fontFamily: fontMono,
      }}>
        {pct}%
      </span>
    </div>
  )
}

function StatGrid({ items, mobile }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: mobile ? 'repeat(2,1fr)' : `repeat(${items.length},1fr)`,
      gap: 10,
    }}>
      {items.map(s => (
        <div key={s.label} style={{
          background: T.white, borderRadius: 12,
          border: `1.5px solid ${T.gray150}`,
          boxShadow: T.shadowSm, overflow: 'hidden',
        }}>
          <div style={{ height: 2.5, background: s.stripe }} />
          <div style={{ padding: mobile ? '12px 14px' : '14px 18px' }}>
            <div style={{
              fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.07em', color: T.gray500, marginBottom: 8,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: mobile ? 26 : 30, fontWeight: 700,
              color: s.color, lineHeight: 1, fontFamily: fontMono,
              letterSpacing: '-.02em',
            }}>
              {s.value}
            </div>
            {s.barPct !== undefined && (
              <div style={{ marginTop: 10 }}>
                <MiniBar pct={s.barPct} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Instagram gradient rings per status ─────────────────────

const STATUS_GRADIENT = {
  Present: 'linear-gradient(135deg, #22c55e, #16a34a)',
  Absent:  'linear-gradient(135deg, #f43f5e, #e11d48)',
  Late:    'linear-gradient(135deg, #fbbf24, #f59e0b)',
  Leave:   'linear-gradient(135deg, #a78bfa, #7c3aed)',
}

const AVATAR_GRAD = [
  'linear-gradient(135deg,#f9a8d4,#c084fc)',
  'linear-gradient(135deg,#93c5fd,#6366f1)',
  'linear-gradient(135deg,#6ee7b7,#3b82f6)',
  'linear-gradient(135deg,#fde68a,#fb923c)',
  'linear-gradient(135deg,#a5f3fc,#818cf8)',
  'linear-gradient(135deg,#fbcfe8,#f9a8d4)',
  'linear-gradient(135deg,#bbf7d0,#34d399)',
  'linear-gradient(135deg,#fca5a5,#f97316)',
]

function getAvatarGrad(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_GRAD[h % AVATAR_GRAD.length]
}

// ─── Status Cycle Cell — Instagram Stories style ──────────────

function StatusCycleCell({ student, status, onChange, isMobile }) {
  const sm   = STATUS_META[status] || STATUS_META.Present
  const ring = STATUS_GRADIENT[status] || STATUS_GRADIENT.Present
  const initials = student.student_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const avatarGrad = getAvatarGrad(student.student_name)

  return (
    <button
      onClick={() => {
        const idx = STATUSES.indexOf(status)
        onChange(STATUSES[(idx + 1) % STATUSES.length])
      }}
      style={{
        background: 'white',
        border: 'none',
        borderRadius: 14,
        padding: isMobile ? '10px 6px 10px' : '12px 8px 12px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6,
        fontFamily: font,
        WebkitTapHighlightColor: 'transparent',
        width: '100%',
        transition: 'transform .12s, box-shadow .12s',
        boxShadow: '0 1px 4px rgba(0,0,0,.07)',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,.12)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.07)' }}
    >
      {/* Instagram-style ring + avatar */}
      <div style={{
        width: isMobile ? 44 : 50, height: isMobile ? 44 : 50,
        borderRadius: '50%',
        padding: 2.5,
        background: ring,
        flexShrink: 0,
        transition: 'background .15s',
      }}>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: '50%',
          border: '2px solid white',
          background: avatarGrad,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isMobile ? 12 : 13, fontWeight: 700, color: 'white',
          letterSpacing: '.01em',
        }}>
          {initials}
        </div>
      </div>

      {/* Status badge — bottom of avatar */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 38 : 44, left: '50%',
        transform: 'translateX(-50%)',
        width: isMobile ? 16 : 18, height: isMobile ? 16 : 18,
        borderRadius: '50%',
        background: ring,
        border: '2px solid white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isMobile ? 7 : 8, fontWeight: 800, color: 'white',
        zIndex: 1,
      }}>
        {sm.icon}
      </div>

      {/* Name */}
      <div style={{
        fontSize: isMobile ? 9.5 : 10.5, fontWeight: 600,
        color: T.gray700, lineHeight: 1.3,
        width: '100%', textAlign: 'center',
        wordBreak: 'break-word', overflowWrap: 'anywhere',
        marginTop: 4,
      }}>
        {student.student_name}
      </div>

      {/* Status label */}
      <div style={{
        fontSize: 8.5, fontWeight: 700,
        color: sm.color,
        background: sm.bg,
        border: `1px solid ${sm.border}`,
        borderRadius: 999,
        padding: '1px 6px',
        letterSpacing: '.03em',
      }}>
        {sm.label}
      </div>
    </button>
  )
}

// ─── Tab: HOME ────────────────────────────────────────────────

function TabHome({ onNavigate }) {
  const isMobile = useIsMobile()
  const [sessions,   setSessions]   = useState([])
  const [defaulters, setDefaulters] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [threshold,  setThreshold]  = useState(75)
  const [stats,      setStats]      = useState({ total:0, pending:0, risk:0, avgPct:0 })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const todayStr = today()
      const { data: todaySess } = await supabase
        .from('attendance_sessions').select('*').eq('session_date', todayStr).order('period_number')
      const { data: ttEntries } = await supabase
        .from('timetable_entries').select('*').eq('day_name', todayDay())
      const markedPeriods = new Set((todaySess||[]).map(s => `${s.course}|${s.period_number}`))
      const pendingSessions = (ttEntries||[]).map(tt => ({
        ...tt,
        done: markedPeriods.has(`${tt.course}|${tt.period_name}`),
        session: (todaySess||[]).find(s => s.course === tt.course && String(s.period_number) === String(tt.period_name))
      }))
      setSessions(pendingSessions.slice(0, 8))
      const monthStart = todayStr.slice(0,7) + '-01'
      const { data: monthSess } = await supabase
        .from('attendance_sessions').select('id').gte('session_date', monthStart).lte('session_date', todayStr)
      if (monthSess?.length) {
        const ids = monthSess.map(s => s.id)
        const { data: recs } = await supabase
          .from('attendance_records').select('student_name,gcc_no,status,session_id').in('session_id', ids)
        const map = {}
        recs?.forEach(r => {
          if (!map[r.student_name]) map[r.student_name] = { name:r.student_name, gcc:r.gcc_no, Present:0, total:0 }
          if (r.status === 'Present') map[r.student_name].Present++
          map[r.student_name].total++
        })
        const rows = Object.values(map).map(r => ({ ...r, pct: r.total>0?Math.round((r.Present/r.total)*100):0 }))
        const atRisk = rows.filter(r => r.pct < threshold).sort((a,b) => a.pct - b.pct)
        setDefaulters(atRisk)
        const avgPct = rows.length ? Math.round(rows.reduce((s,r) => s+r.pct,0) / rows.length) : 0
        setStats({ total:rows.length, pending:pendingSessions.filter(s=>!s.done).length, risk:atRisk.length, avgPct })
      } else {
        setStats(s => ({ ...s, pending:pendingSessions.filter(x=>!x.done).length }))
      }
      setLoading(false)
    }
    load()
  }, [threshold])

  if (loading) return (
    <div style={{ padding: 64, textAlign: 'center', color: T.gray400, fontSize: 13 }}>
      Loading dashboard…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI row */}
      <StatGrid mobile={isMobile} items={[
        { label: 'Tracked',      value: stats.total,   color: T.navy,  stripe: T.navy,  },
        { label: 'At risk',      value: stats.risk,    color: '#e11d48', stripe: '#f43f5e' },
        { label: 'Avg this month', value: `${stats.avgPct}%`, color: stats.avgPct>=75?'#16a34a':'#d97706', stripe: stats.avgPct>=75?'#22c55e':'#f59e0b', barPct: stats.avgPct },
        { label: 'Pending today', value: stats.pending, color: '#d97706', stripe: '#f59e0b' },
      ]} />

      {/* Today's sessions */}
      <Card>
        <CardHeader
          icon="⚡"
          title="Today's sessions"
          subtitle={`${fmtDate(today())} · ${todayDay()}`}
          accent={T.blue}
          right={<Btn small variant="blue" onClick={() => onNavigate('mark')}>+ Mark new</Btn>}
        />
        <div style={{ padding: isMobile ? '12px 16px' : '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: T.gray400, fontSize: 13 }}>
              No timetable entries for today.
            </div>
          )}
          {sessions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: isMobile ? '10px 12px' : '11px 14px',
              borderRadius: 10,
              border: `1.5px solid ${s.done ? T.gray150 : '#bfdbfe'}`,
              background: s.done ? T.gray50 : '#eff6ff',
              opacity: s.done ? .65 : 1,
            }}>
              <StatusDot status={s.done ? 'Present' : 'Absent'} size={7} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 13, color: T.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  P{s.period_name} — {s.subject_name || 'No subject'}
                </div>
                <div style={{ fontSize: 11.5, color: T.gray500, marginTop: 1 }}>
                  {s.class_name}{s.teacher_name ? ` · ${s.teacher_name}` : ''}
                </div>
              </div>
              {s.done
                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Marked</span>
                : <Btn small variant="primary" onClick={() => onNavigate('mark', s)}>Mark</Btn>
              }
            </div>
          ))}
        </div>
      </Card>

      {/* Defaulter alerts */}
      <Card>
        <CardHeader
          icon="🚨"
          title="Defaulter alerts"
          subtitle={`Students below ${threshold}% this month`}
          accent="#e11d48"
          right={
            <Select value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}>
              {[50,60,65,70,75,80,85].map(v => <option key={v} value={v}>{v}% threshold</option>)}
            </Select>
          }
        />
        <div style={{ padding: isMobile ? '12px 16px' : '16px 22px' }}>
          {defaulters.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: '#15803d', fontWeight: 600, fontSize: 13,
            }}>
              ✓ All students above {threshold}%
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)',
              gap: 10,
            }}>
              {defaulters.slice(0, 10).map(d => (
                <div key={d.name} style={{
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${d.pct < 50 ? '#fecdd3' : '#fde68a'}`,
                  background: d.pct < 50 ? '#fff1f2' : '#fffbeb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: d.pct < 50 ? '#fee2e2' : '#fef3c7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: d.pct < 50 ? '#e11d48' : '#b45309', flexShrink: 0,
                    }}>
                      {d.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: T.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.name}
                      </div>
                      {d.gcc && (
                        <div style={{ fontSize: 11, color: T.gray400, fontFamily: fontMono }}>
                          GCC-{d.gcc}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: fontMono,
                      color: d.pct < 50 ? '#e11d48' : '#b45309', flexShrink: 0,
                    }}>
                      {d.pct}%
                    </div>
                  </div>
                  <MiniBar pct={d.pct} />
                </div>
              ))}
            </div>
          )}
          {defaulters.length > 10 && (
            <div style={{
              textAlign: 'center', fontSize: 12, color: T.gray400,
              paddingTop: 12, borderTop: `1.5px solid ${T.gray100}`, marginTop: 12,
            }}>
              +{defaulters.length - 10} more students below threshold
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── Tab: MARK ATTENDANCE ─────────────────────────────────────

function TabMark({ staff, prefill }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    session_date: today(), course: prefill?.course||'', subtype: prefill?.subtype||'',
    class_name: prefill?.class_name||'', subject_name: prefill?.subject_name||'',
    teacher_name: prefill?.teacher_name||'', staff_id: '', period_number: prefill?.period_name||'',
    session_type: 'Class', remarks: '',
  })
  const [students,    setStudents]    = useState([])
  const [records,     setRecords]     = useState({})
  const [timetable,   setTimetable]   = useState([])
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [batchId,     setBatchId]     = useState(null)
  const [showNotify,  setShowNotify]  = useState(false)
  const [copying,     setCopying]     = useState(false)

  const subtypes = form.course ? COURSE_STRUCTURE[form.course] || [] : []

  const batchSubjects = useMemo(() =>
    timetable.length ? [...new Set(timetable.map(t=>t.subject_name).filter(Boolean))].sort() : SUBJECTS
  , [timetable])

  const batchStaff = useMemo(() => {
    if (!timetable.length) return staff
    const names = new Set(timetable.map(t=>t.teacher_name).filter(Boolean))
    const matched = staff.filter(s => names.has(s.name))
    return matched.length ? matched : staff
  }, [timetable, staff])

  useEffect(() => {
    if (!form.course || !form.subtype) { setTimetable([]); setBatchId(null); return }
    const fetch = async () => {
      let q = supabase.from('course_batches').select('id,batch_name').eq('course', form.course).eq('subtype', form.subtype)
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
        staff_id: matched?.id || prev.staff_id,
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

  const copyLastSession = async () => {
    if (!form.course) { setToast({ type:'warn', msg:'Select a course first.' }); return }
    setCopying(true)
    const { data: lastSess } = await supabase.from('attendance_sessions')
      .select('id').eq('course', form.course).eq('subtype', form.subtype || '')
      .order('session_date', { ascending: false }).limit(1).single()
    if (!lastSess) { setCopying(false); setToast({ type:'warn', msg:'No previous session found.' }); return }
    const { data: lastRecs } = await supabase.from('attendance_records')
      .select('student_name,student_id,status').eq('session_id', lastSess.id)
    if (lastRecs?.length) {
      const copied = {}
      lastRecs.forEach(r => { copied[r.student_id || r.student_name] = r.status })
      setRecords(prev => ({ ...prev, ...copied }))
      setToast({ type:'success', msg:`Copied ${lastRecs.length} records from last session.` })
    }
    setCopying(false)
  }

  const handleSave = async () => {
    if (!form.course || !students.length) {
      setToast({ type:'warn', msg:'Select a course with students.' }); return
    }
    setSaving(true)
    const { data: sess, error: e1 } = await supabase.from('attendance_sessions').insert([{
      session_date: form.session_date, course: form.course, subtype: form.subtype || null,
      class_name: form.class_name || null, batch_id: batchId || null,
      subject_name: form.subject_name || null, teacher_name: form.teacher_name || null,
      staff_id: form.staff_id || null, period_number: form.period_number || null,
      session_type: form.session_type, remarks: form.remarks || null,
    }]).select().single()
    if (e1) { setSaving(false); setToast({ type:'error', msg: e1.message }); return }
    const rows = students.map(s => ({
      session_id: sess.id, student_id: s.student_id || null,
      student_name: s.student_name, gcc_no: s.gcc_no || null,
      status: records[s.student_id || s.student_name] || 'Present',
    }))
    const { error: e2 } = await supabase.from('attendance_records').insert(rows)
    setSaving(false)
    if (e2) { setToast({ type:'error', msg: e2.message }); return }
    setShowNotify(true)
    setToast({ type:'success', msg: `Saved attendance for ${students.length} students.` })
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
    students.filter(s => { const k = s.student_id || s.student_name; return records[k] === 'Absent' || records[k] === 'Late' })
  , [students, records])

  const pad = isMobile ? '14px 16px' : '18px 22px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Session config */}
      <Card>
        <CardHeader icon="📋" title="Session details" subtitle="Configure course and period" accent={T.navy} />
        <div style={{ padding: pad }}>
          {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

          <SectionDivider label="Course" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <Label required>Course</Label>
              <Select value={form.course} onChange={e => setForm(prev => ({ ...prev, course: e.target.value, subtype:'', class_name:'' }))}>
                <option value="">Select course…</option>
                {COURSES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Batch</Label>
              <Select value={form.subtype} disabled={!form.course}
                onChange={e => setForm(prev => ({ ...prev, subtype: e.target.value, class_name:'' }))}>
                <option value="">Select batch…</option>
                {subtypes.map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label hint={batchId ? '✓ linked' : ''}>Class</Label>
              <input value={form.class_name} onChange={e => setForm(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. 9A (optional)" style={inputStyle()} />
            </div>
          </div>

          {form.course && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 9,
              background: students.length ? '#f0fdf4' : '#fffbeb',
              border: `1.5px solid ${students.length ? '#bbf7d0' : '#fde68a'}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: students.length ? '#15803d' : '#b45309',
              }}>
                {students.length ? `${students.length} students enrolled` : 'No students found'}
              </span>
              {timetable.length > 0 && (
                <span style={{ fontSize: 11.5, color: T.blue, fontWeight: 600 }}>
                  {timetable.length} timetable slots
                </span>
              )}
              {form.course && <CoursePill course={form.course} />}
            </div>
          )}

          <SectionDivider label="Session" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <div style={isMobile ? { gridColumn: '1 / -1' } : {}}>
              <Label>Date</Label>
              <input type="date" value={form.session_date}
                onChange={e => setForm(prev => ({ ...prev, session_date: e.target.value }))}
                style={inputStyle()} />
            </div>
            <div>
              <Label hint={form.period_number && timetable.length ? 'auto-fill' : ''}>Period</Label>
              <Select value={form.period_number} onChange={e => handlePeriod(e.target.value)}>
                <option value="">— None —</option>
                {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
              </Select>
            </div>
            <div>
              <Label hint={form.period_number && form.subject_name && timetable.length ? 'from timetable' : ''}>Subject</Label>
              <Select value={form.subject_name} onChange={e => setForm(prev => ({ ...prev, subject_name: e.target.value }))}>
                <option value="">Select subject…</option>
                {batchSubjects.map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
            <div>
              <Label hint={form.period_number && form.teacher_name && timetable.length ? 'from timetable' : ''}>Teacher</Label>
              <Select value={form.teacher_name} onChange={e => handleTeacher(e.target.value)}>
                <option value="">Select teacher…</option>
                {batchStaff.map(s => <option key={s.id} value={s.name}>
                  {s.name}{s.designation ? ` — ${s.designation}` : ''}
                </option>)}
              </Select>
            </div>
            <div>
              <Label>Session type</Label>
              <Select value={form.session_type} onChange={e => setForm(prev => ({ ...prev, session_type: e.target.value }))}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <input value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional notes…" style={inputStyle()} />
            </div>
          </div>
        </div>
      </Card>

      {/* Swift grid */}
      {students.length > 0 && (
        <Card style={{ overflow: 'visible' }}>
          {/* Instagram-style gradient banner header */}
          <div style={{
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
            padding: isMobile ? '16px 16px 14px' : '18px 22px 16px',
            borderRadius: '14px 14px 0 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>
                📸 Roll Call
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
                {form.course}{form.subtype ? ' · ' + form.subtype : ''} — tap to cycle status
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={copyLastSession} disabled={copying} style={{
                padding: '6px 13px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,.4)',
                background: 'rgba(255,255,255,.15)', color: 'white',
                fontWeight: 700, fontSize: 12, cursor: copying ? 'not-allowed' : 'pointer',
                fontFamily: font, backdropFilter: 'blur(4px)',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {copying ? '…' : '📋'} {isMobile ? 'Copy' : 'Copy last'}
              </button>
              {!isMobile && (
                <button onClick={invertSelection} style={{
                  padding: '6px 13px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,.4)',
                  background: 'rgba(255,255,255,.15)', color: 'white',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: font,
                  backdropFilter: 'blur(4px)', WebkitTapHighlightColor: 'transparent',
                }}>
                  ⇄ Invert
                </button>
              )}
            </div>
          </div>

          {/* Quick-mark pills — Instagram gradient style */}
          <div style={{
            padding: isMobile ? '12px 16px' : '14px 22px',
            borderBottom: `1.5px solid ${T.gray100}`,
            display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center',
            background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
          }}>
            {STATUSES.map(s => {
              const sm = STATUS_META[s]
              const grad = STATUS_GRADIENT[s]
              return (
                <button key={s} onClick={() => markAll(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 15px', borderRadius: 999,
                  border: 'none',
                  background: grad,
                  color: 'white',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: font, WebkitTapHighlightColor: 'transparent',
                  transition: 'all .15s',
                  boxShadow: `0 2px 8px ${sm.dot}55`,
                  letterSpacing: '.01em',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800 }}>{sm.icon}</span>
                  <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 800 }}>{counts[s]}</span>
                  <span>{sm.label}</span>
                </button>
              )
            })}
            {!isMobile && (
              <button onClick={invertSelection} style={{
                padding: '7px 14px', borderRadius: 999,
                border: `1.5px solid ${T.gray200}`,
                background: T.white, color: T.gray500,
                fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: font,
                marginLeft: 'auto',
              }}>
                ⇄ Invert
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ padding: '10px 22px 0' }}>
            <AttendBar records={records} />
          </div>

          {/* Search */}
          <div style={{ padding: isMobile ? '10px 16px' : '12px 22px' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or GCC number…"
              style={inputStyle({ background: T.gray50 })}
            />
          </div>

          {/* Grid — Stories shelf */}
          <div style={{
            padding: isMobile ? '8px 12px 18px' : '10px 18px 22px',
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(5,1fr)',
            gap: isMobile ? 8 : 10,
            background: 'linear-gradient(180deg, #fafafa 0%, #fff 60%)',
          }}>
            {filteredStudents.map(s => {
              const key = s.student_id || s.student_name
              return (
                <StatusCycleCell
                  key={key} student={s} status={records[key] || 'Present'}
                  isMobile={isMobile}
                  onChange={next => setRecords(prev => ({ ...prev, [key]: next }))}
                />
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px 0', color: T.gray400, fontSize: 13 }}>
                No students match your search.
              </div>
            )}
          </div>

          {/* Save */}
          <div style={{
            padding: isMobile ? '12px 16px' : '14px 22px',
            borderTop: `1.5px solid ${T.gray100}`,
            background: T.gray50,
          }}>
            <button
              disabled={saving} onClick={handleSave}
              style={{
                width: '100%', minHeight: 46, fontSize: 14,
                fontWeight: 700, fontFamily: font, cursor: saving ? 'not-allowed' : 'pointer',
                border: 'none', borderRadius: 11,
                background: saving
                  ? T.gray200
                  : 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
                color: saving ? T.gray400 : 'white',
                boxShadow: saving ? 'none' : '0 4px 14px rgba(131,58,180,.4)',
                transition: 'all .15s',
                letterSpacing: '.02em',
              }}
            >
              {saving ? 'Saving…' : `Save attendance · ${students.length} students`}
            </button>
          </div>
        </Card>
      )}

      {/* Notify */}
      {showNotify && absentStudents.length > 0 && (
        <NotifyPanel
          students={absentStudents} records={records} sessionInfo={form}
          onClose={() => setShowNotify(false)}
        />
      )}
    </div>
  )
}

// ─── NOTIFY PANEL ─────────────────────────────────────────────

function NotifyPanel({ students, records, sessionInfo, onClose }) {
  const isMobile = useIsMobile()
  const [sent,    setSent]    = useState({})
  const [channel, setChannel] = useState('sms')
  const [sending, setSending] = useState(false)

  const msgFor = (s) => {
    const status = records[s.student_id || s.student_name]
    return `Dear Parent, your ward ${s.student_name} was marked ${status} on ${fmtDate(sessionInfo.session_date)}${sessionInfo.subject_name ? ' in ' + sessionInfo.subject_name : ''}. Please ensure regular attendance. — GNSI`
  }

  const sendAll = async () => {
    setSending(true)
    const rows = students.map(s => ({
      student_name: s.student_name, student_id: s.student_id || null,
      phone: s.students?.phone || null, channel, message: msgFor(s),
      status: 'sent', sent_at: new Date().toISOString(),
    }))
    await supabase.from('parent_notifications').insert(rows)
    const sentMap = {}
    students.forEach(s => { sentMap[s.student_id || s.student_name] = true })
    setSent(sentMap)
    setSending(false)
  }

  return (
    <Card style={{ border: `1.5px solid #bfdbfe` }}>
      <CardHeader
        icon="📲"
        title="Notify parents"
        subtitle={`${students.length} absent / late students`}
        accent={T.blue}
        right={
          <>
            <Select value={channel} onChange={e => setChannel(e.target.value)}
              style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </Select>
            <Btn small variant="ghost" onClick={onClose}>✕</Btn>
          </>
        }
      />
      <div style={{ padding: isMobile ? '12px 16px' : '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: T.gray50, border: `1.5px solid ${T.gray150}`,
          borderRadius: 9, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
            Message preview
          </div>
          <div style={{ fontSize: 12.5, color: T.gray700, lineHeight: 1.7 }}>
            {students[0] ? msgFor(students[0]) : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {students.map(s => {
            const key = s.student_id || s.student_name
            const status = records[key]
            const sm = STATUS_META[status] || STATUS_META.Absent
            const isSent = sent[key]
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                background: isSent ? '#f0fdf4' : sm.bg,
                border: `1.5px solid ${isSent ? '#bbf7d0' : sm.border}`,
              }}>
                <StatusDot status={status} size={7} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 13, color: T.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.student_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.gray400 }}>
                    {s.students?.phone ? `📞 ${s.students.phone}` : 'No phone on record'}
                  </div>
                </div>
                {isSent && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a' }}>
                    Sent
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(sent).length === students.length ? (
            <Alert type="success">All notifications sent.</Alert>
          ) : (
            <>
              <Btn variant="ghost" onClick={onClose}>Skip</Btn>
              <Btn
                variant={channel === 'whatsapp' ? 'whatsapp' : 'primary'}
                disabled={sending} onClick={sendAll}
              >
                {sending ? 'Sending…' : `Send to ${students.length} parents`}
              </Btn>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Tab: VIEW SESSIONS ───────────────────────────────────────

function TabView() {
  const isMobile = useIsMobile()
  const [sessions,      setSessions]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [expanded,      setExpanded]     = useState(null)
  const [records,       setRecords]      = useState({})
  const [dateFilter,    setDateFilter]   = useState('')
  const [courseFilter,  setCourseFilter] = useState('All')
  const [confirmDelete, setConfirmDelete] = useState(null)

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

  const doDelete = async (id) => {
    await supabase.from('attendance_sessions').delete().eq('id', id)
    if (expanded === id) setExpanded(null)
    setConfirmDelete(null)
    fetchSessions()
  }

  return (
    <Card>
      <CardHeader
        icon="📁"
        title="Sessions"
        subtitle="All recorded attendance sessions"
        accent={T.navy}
        right={<span style={{ fontSize: 12, color: T.gray400, fontWeight: 600 }}>{sessions.length} records</span>}
      />

      {/* Filters */}
      <div style={{
        padding: isMobile ? '10px 16px' : '12px 22px',
        borderBottom: `1.5px solid ${T.gray100}`,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        background: T.gray50,
      }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={inputStyle({ width: 'auto', fontSize: 13, padding: '7px 10px' })} />
        <Select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">All courses</option>
          {COURSES.map(c => <option key={c}>{c}</option>)}
        </Select>
        {(dateFilter || courseFilter !== 'All') && (
          <Btn small variant="ghost" onClick={() => { setDateFilter(''); setCourseFilter('All') }}>
            ✕ Clear filters
          </Btn>
        )}
      </div>

      <div style={{ padding: isMobile ? '10px 16px' : '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.gray400, fontSize: 13 }}>Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.gray400, fontSize: 13 }}>No sessions found.</div>
        ) : sessions.map(sess => {
          const isOpen = expanded === sess.id
          const recs   = records[sess.id] || []
          const counts = { Present:0, Absent:0, Late:0, Leave:0 }
          if (isOpen) recs.forEach(r => { if (counts[r.status]!==undefined) counts[r.status]++ })
          const total = recs.length
          const pct   = total > 0 ? Math.round((counts.Present / total)*100) : null

          return (
            <div key={sess.id} style={{
              border: `1.5px solid ${isOpen ? T.gray200 : T.gray150}`,
              borderRadius: 12, overflow: 'hidden',
              transition: 'border-color .15s',
            }}>
              {/* Row header */}
              <div onClick={() => expand(sess.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: isMobile ? '11px 14px' : '12px 16px',
                cursor: 'pointer',
                background: isOpen ? T.gray50 : T.white,
                transition: 'background .15s',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: T.ink, fontSize: isMobile ? 13 : 13.5 }}>
                      {fmtDate(sess.session_date)}
                    </span>
                    <CoursePill course={sess.course} />
                    {sess.subject_name && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: T.violet }}>
                        {sess.subject_name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.gray500 }}>
                    {sess.teacher_name && `${sess.teacher_name}`}
                    {sess.subtype && ` · ${sess.subtype}`}
                    {sess.period_number && ` · P${sess.period_number}`}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(sess.id) }}
                  style={{
                    fontSize: 12, padding: '5px 9px', borderRadius: 7,
                    border: `1.5px solid #fecdd3`, background: '#fff1f2',
                    color: '#e11d48', cursor: 'pointer', fontFamily: font, flexShrink: 0,
                  }}
                >
                  Delete
                </button>
                <span style={{
                  color: T.gray300, fontSize: 14,
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s', flexShrink: 0,
                }}>▾</span>
              </div>

              {/* Confirm delete */}
              {confirmDelete === sess.id && (
                <div style={{ padding: '10px 14px', borderTop: `1.5px solid ${T.gray100}` }}>
                  <InlineConfirm
                    message="Delete this session and all its records permanently?"
                    onConfirm={() => doDelete(sess.id)}
                    onCancel={() => setConfirmDelete(null)}
                  />
                </div>
              )}

              {/* Expanded records */}
              {isOpen && (
                <div style={{
                  borderTop: `1.5px solid ${T.gray100}`,
                  padding: isMobile ? '12px 14px' : '14px 18px',
                  background: T.gray50,
                }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {STATUSES.map(s => counts[s] > 0 && (
                      <span key={s} style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                        background: STATUS_META[s].bg, color: STATUS_META[s].color,
                        border: `1.5px solid ${STATUS_META[s].border}`,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <StatusDot status={s} size={6} />
                        {counts[s]} {s}
                      </span>
                    ))}
                    {pct !== null && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, fontFamily: fontMono,
                        color: pct>=75?'#16a34a':pct>=50?'#d97706':'#e11d48',
                      }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(200px,1fr))',
                    gap: 6,
                  }}>
                    {recs.map(r => {
                      const sm = STATUS_META[r.status] || STATUS_META.Present
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 8,
                          background: sm.bg, border: `1.5px solid ${sm.border}`,
                        }}>
                          <StatusDot status={r.status} size={7} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12.5, fontWeight: 600, color: T.ink,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {r.student_name}
                            </div>
                            {r.gcc_no && (
                              <div style={{ fontSize: 10.5, color: T.gray400, fontFamily: fontMono }}>
                                {r.gcc_no}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, flexShrink: 0 }}>
                            {r.status}
                          </span>
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

// ─── Tab: REPORTS ─────────────────────────────────────────────

function TabReport() {
  const isMobile = useIsMobile()
  const [reportTab, setReportTab] = useState('monthly')
  const [month,     setMonth]     = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [course,    setCourse]    = useState('All')
  const [data,      setData]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [sort,      setSort]      = useState({ by:'pct', asc:true })

  const fetchReport = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('attendance_sessions')
      .select('id,session_date,course,subtype,subject_name,teacher_name,created_at')
      .gte('session_date',`${month}-01`).lte('session_date',`${month}-31`)
    if (course !== 'All') q = q.eq('course', course)
    const { data: sessions } = await q
    if (!sessions?.length) { setData([]); setLoading(false); return }
    const ids = sessions.map(s=>s.id)
    const { data: recs } = await supabase.from('attendance_records')
      .select('session_id,student_name,gcc_no,status').in('session_id', ids)
    const map = {}
    recs?.forEach(r => {
      if (!map[r.student_name]) map[r.student_name] = {
        name:r.student_name, gcc:r.gcc_no,
        Present:0, Absent:0, Late:0, Leave:0, total:0,
        bySubject:{}, byDate:{},
      }
      map[r.student_name][r.status]++
      map[r.student_name].total++
      const sess = sessions.find(s=>s.id===r.session_id)
      if (sess?.subject_name) {
        const sb = map[r.student_name].bySubject
        if (!sb[sess.subject_name]) sb[sess.subject_name] = { Present:0, total:0 }
        if (r.status==='Present') sb[sess.subject_name].Present++
        sb[sess.subject_name].total++
      }
      if (sess?.session_date) map[r.student_name].byDate[sess.session_date] = r.status
    })
    const rows = Object.values(map).map(r => ({ ...r, pct: r.total>0?Math.round((r.Present/r.total)*100):0 }))
    setData(rows)
    setLoading(false)
  }, [month, course])

  useEffect(() => { fetchReport() }, [fetchReport])

  const sorted = useMemo(() => {
    return [...data].sort((a,b) => {
      const v = sort.by==='name' ? a.name.localeCompare(b.name) :
                sort.by==='pct'  ? a.pct - b.pct : a[sort.by]-b[sort.by]
      return sort.asc ? v : -v
    })
  }, [data, sort])

  const toggleSort = col => setSort(s => ({ by: col, asc: s.by===col ? !s.asc : true }))

  const stats = useMemo(() => ({
    total: data.length,
    good:  data.filter(r=>r.pct>=75).length,
    mid:   data.filter(r=>r.pct>=50&&r.pct<75).length,
    risk:  data.filter(r=>r.pct<50).length,
  }), [data])

  const REPORT_TABS = [
    { key:'monthly', label:'Monthly' },
    { key:'heatmap', label:'Heatmap' },
    { key:'subject', label:'By subject' },
    { key:'teacher', label:'Staff log' },
  ]

  const SortTH = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: isMobile ? '9px 7px' : '10px 14px',
      textAlign: 'left', fontWeight: 700, fontSize: 10.5,
      textTransform: 'uppercase', letterSpacing: '.06em',
      color: sort.by===col ? T.navy : T.gray400,
      whiteSpace: 'nowrap', cursor: 'pointer',
      userSelect: 'none',
    }}>
      {label} {sort.by===col ? (sort.asc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <Card>
      <CardHeader
        icon="📊"
        title="Attendance reports"
        subtitle={fmtMonth(month)}
        accent={T.violet}
        right={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
              style={inputStyle({width:'auto', fontSize:12, padding:'6px 10px'})} />
            <Select value={course} onChange={e=>setCourse(e.target.value)}
              style={{width:'auto', fontSize:12, padding:'6px 10px'}}>
              <option value="All">All courses</option>
              {COURSES.map(c=><option key={c}>{c}</option>)}
            </Select>
            {!isMobile && <Btn small variant="ghost" onClick={() => window.print()}>🖨️ Print</Btn>}
          </div>
        }
      />

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', borderBottom: `1.5px solid ${T.gray150}`,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        background: T.gray50,
      }}>
        {REPORT_TABS.map(t => (
          <button key={t.key} onClick={() => setReportTab(t.key)} style={{
            padding: isMobile ? '10px 14px' : '11px 20px',
            fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
            background: 'none', border: 'none', fontFamily: font,
            color: reportTab===t.key ? T.navy : T.gray400,
            borderBottom: reportTab===t.key ? `2px solid ${T.navy}` : '2px solid transparent',
            whiteSpace: 'nowrap', transition: 'color .12s', flexShrink: 0,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'64px', color:T.gray400, fontSize:13 }}>
          Generating report…
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px', color:T.gray400, fontSize:13 }}>
          No attendance data for this period.
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ padding: isMobile ? '12px 16px' : '16px 22px', borderBottom:`1.5px solid ${T.gray100}` }}>
            <StatGrid mobile={false} items={[
              { label:'Total students', value:stats.total, color:T.navy,    stripe:T.navy    },
              { label:'Good ≥75%',      value:stats.good,  color:'#16a34a', stripe:'#22c55e' },
              { label:'Low 50–74%',     value:stats.mid,   color:'#d97706', stripe:'#f59e0b' },
              { label:'Risk <50%',      value:stats.risk,  color:'#e11d48', stripe:'#f43f5e' },
            ]} />
          </div>

          {reportTab === 'monthly' && (
            <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{
                width:'100%', borderCollapse:'collapse',
                fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 440 : 'auto',
              }}>
                <thead>
                  <tr style={{ background:T.gray50, borderBottom:`1.5px solid ${T.gray150}` }}>
                    <th style={{ padding: isMobile ? '9px 7px' : '10px 14px', textAlign:'left', fontWeight:700, fontSize:10.5, textTransform:'uppercase', letterSpacing:'.06em', color:T.gray400 }}>#</th>
                    <SortTH col="name"    label="Student" />
                    <th style={{ padding: isMobile ? '9px 7px' : '10px 14px', textAlign:'left', fontWeight:700, fontSize:10.5, textTransform:'uppercase', letterSpacing:'.06em', color:T.gray400 }}>GCC</th>
                    <SortTH col="Present" label="P" />
                    <SortTH col="Absent"  label="A" />
                    <SortTH col="Late"    label="L" />
                    <SortTH col="Leave"   label="Lv" />
                    <SortTH col="total"   label="Tot" />
                    <SortTH col="pct"     label="Att %" />
                    <th style={{ padding: isMobile ? '9px 7px' : '10px 14px' }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const color = row.pct>=75?'#16a34a':row.pct>=50?'#d97706':'#e11d48'
                    return (
                      <tr key={row.name} style={{
                        borderBottom:`1.5px solid ${T.gray100}`,
                        background: row.pct<50?'#fff8f8':row.pct<75?'#fffdf0':T.white,
                      }}>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', color:T.gray400, fontSize:11.5, fontFamily:fontMono }}>{i+1}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontWeight:600, color:T.ink, maxWidth: isMobile?80:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.name}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontFamily:fontMono, fontSize:11.5, fontWeight:600, color:T.navy }}>{row.gcc || '—'}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontWeight:700, color:'#16a34a', fontFamily:fontMono }}>{row.Present}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontWeight:700, color:'#e11d48', fontFamily:fontMono }}>{row.Absent}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontWeight:700, color:'#d97706', fontFamily:fontMono }}>{row.Late}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', fontWeight:700, color:T.violet, fontFamily:fontMono }}>{row.Leave}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', color:T.gray500, fontFamily:fontMono }}>{row.total}</td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px', minWidth: isMobile?70:110 }}><MiniBar pct={row.pct} /></td>
                        <td style={{ padding: isMobile ? '9px 7px' : '10px 14px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding:'2px 7px',
                            borderRadius: 999, whiteSpace: 'nowrap',
                            background: row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2',
                            color,
                          }}>
                            {row.pct>=75?'Good':row.pct>=50?'Low':'Risk'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {reportTab === 'heatmap' && (
            <div style={{ padding: isMobile ? '12px 16px' : '18px 22px', display:'flex', flexDirection:'column', gap:12 }}>
              {sorted.slice(0, 15).map(row => <HeatmapRow key={row.name} row={row} month={month} />)}
              {sorted.length > 15 && (
                <div style={{ textAlign:'center', fontSize:12, color:T.gray400 }}>
                  Showing top 15 — apply course filter to narrow results.
                </div>
              )}
            </div>
          )}

          {reportTab === 'subject' && <SubjectBreakdown data={data} />}
          {reportTab === 'teacher' && <TeacherLog month={month} course={course} />}
        </>
      )}
    </Card>
  )
}

// ─── Heatmap Row ──────────────────────────────────────────────

function HeatmapRow({ row, month }) {
  const isMobile = useIsMobile()
  const [y, m] = month.split('-')
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDay = new Date(y, m-1, 1).getDay()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${m}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, status: row.byDate[key] || null })
  }

  const statusBg = {
    Present: { bg: '#dcfce7', color: '#15803d' },
    Absent:  { bg: '#fee2e2', color: '#e11d48' },
    Late:    { bg: '#fef9c3', color: '#b45309' },
    Leave:   { bg: '#ede9fe', color: '#7c3aed' },
  }

  const streak = (() => {
    let s = 0
    const sorted = Object.entries(row.byDate).sort((a,b)=>a[0]>b[0]?-1:1)
    for (const [,status] of sorted) { if (status === 'Present') s++; else break }
    return s
  })()

  return (
    <div style={{
      background: T.white, borderRadius: 12,
      padding: isMobile ? '12px 14px' : '14px 18px',
      border: `1.5px solid ${T.gray150}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: row.pct>=75?'#dcfce7':row.pct>=50?'#fef9c3':'#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11.5, fontWeight: 700,
          color: row.pct>=75?'#16a34a':row.pct>=50?'#b45309':'#e11d48', flexShrink: 0,
        }}>
          {row.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:13.5, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {row.name}
          </div>
          {row.gcc && (
            <div style={{ fontSize:11, color:T.gray400, fontFamily:fontMono }}>
              GCC-{row.gcc}
            </div>
          )}
        </div>
        <div style={{ fontSize:17, fontWeight:700, fontFamily:fontMono, color:row.pct>=75?'#16a34a':row.pct>=50?'#d97706':'#e11d48', flexShrink:0 }}>
          {row.pct}%
        </div>
        {streak > 0 && !isMobile && (
          <div style={{
            background:'#fff7ed', border:'1.5px solid #fed7aa',
            borderRadius:7, padding:'3px 8px',
            fontSize:11, fontWeight:700, color:'#c2410c',
          }}>
            🔥 {streak}d
          </div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: isMobile?2:3, marginBottom:3 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:9, color:T.gray400, fontWeight:700 }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: isMobile?2:3 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />
          const sc = cell.status ? statusBg[cell.status] : null
          return (
            <div key={cell.day} title={cell.status || 'No session'} style={{
              aspectRatio: '1', borderRadius: isMobile?3:4,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: isMobile?8:9, fontWeight:700,
              background: sc ? sc.bg : T.gray100,
              color: sc ? sc.color : T.gray300,
              fontFamily: fontMono,
            }}>
              {cell.day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Subject Breakdown ────────────────────────────────────────

function SubjectBreakdown({ data }) {
  const isMobile = useIsMobile()
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
    return Object.entries(sm).map(([name, v]) => ({
      name, pct: v.total>0?Math.round((v.Present/v.total)*100):0, ...v,
    })).sort((a,b) => b.pct - a.pct)
  }, [data])

  return (
    <div style={{ padding: isMobile ? '12px 16px' : '18px 22px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.gray500, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
        Average attendance per subject · {data.length} students
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {subjectMap.map(subj => (
          <div key={subj.name} style={{
            background: T.white, border:`1.5px solid ${subj.pct<50?'#fecdd3':subj.pct<75?'#fde68a':T.gray150}`,
            borderRadius:10, padding: isMobile ? '10px 12px' : '12px 16px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ fontWeight:600, fontSize:13.5, color:T.ink, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {subj.name}
              </div>
              <span style={{ fontSize:11.5, color:T.gray400, flexShrink:0 }}>{subj.students} students</span>
              <span style={{ fontSize:16, fontWeight:700, fontFamily:fontMono, color:subj.pct>=75?'#16a34a':subj.pct>=50?'#d97706':'#e11d48', flexShrink:0 }}>
                {subj.pct}%
              </span>
            </div>
            <MiniBar pct={subj.pct} />
          </div>
        ))}
        {subjectMap.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px 0', color:T.gray400, fontSize:13 }}>
            Subject data requires sessions with a subject assigned.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Teacher Log ──────────────────────────────────────────────

function TeacherLog({ month, course }) {
  const isMobile = useIsMobile()
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
      const map = {}
      sessions.forEach(s => {
        const t = s.teacher_name
        if (!map[t]) map[t] = { name:t, sessions:0, subjects:new Set(), courses:new Set(), onTimeCount:0 }
        map[t].sessions++
        if (s.subject_name) map[t].subjects.add(s.subject_name)
        if (s.course) map[t].courses.add(s.course)
        map[t].onTimeCount++
      })
      const rows = Object.values(map).map(t => ({
        ...t, subjects:[...t.subjects], courses:[...t.courses],
        onTimePct: t.sessions>0?Math.round((t.onTimeCount/t.sessions)*100):100,
      })).sort((a,b) => b.sessions-a.sessions)
      setTeacherData(rows)
      setLoading(false)
    }
    fetch()
  }, [month, course])

  if (loading) return <div style={{ padding:32, textAlign:'center', color:T.gray400 }}>Loading…</div>
  if (!teacherData.length) return <div style={{ padding:48, textAlign:'center', color:T.gray400 }}>No teacher data for this period.</div>

  return (
    <div style={{ padding: isMobile ? '12px 16px' : '18px 22px', display:'flex', flexDirection:'column', gap:10 }}>
      {teacherData.map((t, i) => (
        <div key={t.name} style={{
          display:'flex', alignItems:'flex-start', gap:12,
          padding: isMobile ? '12px 14px' : '14px 18px',
          borderRadius:12, border:`1.5px solid ${T.gray150}`,
          background:T.white,
        }}>
          <div style={{
            width:40, height:40, borderRadius:'50%', background:T.gray100,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13.5, fontWeight:700, color:T.navy, flexShrink:0,
          }}>
            {t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize: isMobile?13:14, color:T.ink, marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {t.name}
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
              {t.courses.map(c => <CoursePill key={c} course={c} />)}
            </div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:10.5, color:T.gray400, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Sessions</div>
                <div style={{ fontSize:22, fontWeight:700, color:T.navy, fontFamily:fontMono, letterSpacing:'-.01em' }}>
                  {t.sessions}
                </div>
              </div>
              <div style={{ flex:1, minWidth:80 }}>
                <div style={{ fontSize:10.5, color:T.gray400, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>On-time</div>
                <MiniBar pct={t.onTimePct} />
              </div>
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, color:T.gray300, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>Rank</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:fontMono, color:T.gray200, letterSpacing:'-.02em' }}>
              #{i+1}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: LEAVE MANAGEMENT ────────────────────────────────────

function TabLeave({ staff, currentUser, isAdmin }) {
  const isMobile = useIsMobile()
  const [leaveTab,   setLeaveTab]   = useState('pending')
  const [leaves,     setLeaves]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [form,       setForm]       = useState({ student_name:'', from_date:'', to_date:'', reason:'', course:'', subtype:'' })
  const [submitting, setSubmitting] = useState(false)

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false })
    if (!isAdmin && currentUser?.id) q = q.eq('staff_id', currentUser.id)
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
    setToast({ type: status==='Approved'?'success':'warn', msg:`Leave ${status.toLowerCase()}.` })
    fetchLeaves()
  }

  const submitLeave = async () => {
    if (!form.student_name || !form.from_date || !form.to_date || !form.reason) {
      setToast({ type:'warn', msg:'Fill all required fields.' }); return
    }
    setSubmitting(true)
    const { error } = await supabase.from('leave_requests').insert([{
      student_name: form.student_name, from_date: form.from_date, to_date: form.to_date,
      reason: form.reason, course: form.course || null, subtype: form.subtype || null, status: 'Pending',
    }])
    setSubmitting(false)
    if (error) { setToast({ type:'error', msg: error.message }); return }
    setToast({ type:'success', msg:'Leave request submitted.' })
    setForm({ student_name:'', from_date:'', to_date:'', reason:'', course:'', subtype:'' })
    if (leaveTab === 'pending') fetchLeaves()
  }

  const LEAVE_TABS = [
    { key:'pending',  label:'Pending'  },
    { key:'approved', label:'Approved' },
    { key:'rejected', label:'Rejected' },
    { key:'apply',    label:'+ Apply'  },
  ]

  const statusStyle = {
    Pending:  { bg:'#fffbeb', border:'#fde68a', color:'#92400e' },
    Approved: { bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d' },
    Rejected: { bg:'#fff1f2', border:'#fecdd3', color:'#be123c' },
  }

  return (
    <Card>
      <CardHeader icon="📅" title="Leave management" subtitle="Review and submit leave requests" accent={T.violet} />

      <div style={{
        display: 'flex', borderBottom: `1.5px solid ${T.gray150}`,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        background: T.gray50,
      }}>
        {LEAVE_TABS.map(t => (
          <button key={t.key} onClick={() => setLeaveTab(t.key)} style={{
            padding: isMobile ? '10px 14px' : '11px 20px',
            fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
            background: 'none', border: 'none', fontFamily: font,
            color: leaveTab===t.key ? T.navy : T.gray400,
            borderBottom: leaveTab===t.key ? `2px solid ${T.navy}` : '2px solid transparent',
            whiteSpace: 'nowrap', flexShrink: 0, transition: 'color .12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: isMobile ? '14px 16px' : '18px 22px' }}>
        {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

        {leaveTab !== 'apply' && (
          loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:T.gray400 }}>Loading…</div>
          ) : leaves.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:T.gray400, fontSize:13 }}>
              No {leaveTab} requests.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {leaves.map(lv => {
                const sc = statusStyle[lv.status] || statusStyle.Pending
                const days = Math.ceil((new Date(lv.to_date) - new Date(lv.from_date)) / 86400000) + 1
                return (
                  <div key={lv.id} style={{
                    border:`1.5px solid ${sc.border}`,
                    borderRadius:12, padding: isMobile ? '12px 14px' : '14px 18px',
                    background: sc.bg,
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8, gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:14, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {lv.student_name}
                        </div>
                        <div style={{ fontSize:12, color:T.gray500, marginTop:3 }}>
                          {fmtDate(lv.from_date)} → {fmtDate(lv.to_date)}
                          &nbsp;·&nbsp;<strong>{days} day{days!==1?'s':''}</strong>
                          {lv.course && ` · ${lv.course}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:6,
                        background: sc.bg, color: sc.color, border:`1.5px solid ${sc.border}`,
                        flexShrink:0, textTransform:'uppercase', letterSpacing:'.05em',
                      }}>
                        {lv.status}
                      </span>
                    </div>
                    <div style={{
                      fontSize:12.5, color:T.gray700,
                      background:'rgba(255,255,255,.6)',
                      padding:'9px 12px', borderRadius:8,
                      marginBottom: lv.status==='Pending'?10:0,
                      lineHeight:1.6, fontStyle:'italic',
                    }}>
                      "{lv.reason}"
                    </div>
                    {lv.status === 'Pending' && isAdmin && (
                      <div style={{ display:'flex', gap:8 }}>
                        <Btn small variant="success" onClick={() => updateLeave(lv.id, 'Approved')}>
                          ✓ Approve
                        </Btn>
                        <Btn small variant="danger" onClick={() => updateLeave(lv.id, 'Rejected')}>
                          ✕ Reject
                        </Btn>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {leaveTab === 'apply' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'repeat(2,1fr)', gap:12 }}>
              <div>
                <Label>Course</Label>
                <Select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subtype:'' }))}>
                  <option value="">Select course…</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Batch</Label>
                <Select value={form.subtype} disabled={!form.course} onChange={e => setForm(p => ({ ...p, subtype: e.target.value }))}>
                  <option value="">Select batch…</option>
                  {(form.course ? COURSE_STRUCTURE[form.course]||[] : []).map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label required>Student name</Label>
              <input value={form.student_name} onChange={e => setForm(p => ({ ...p, student_name: e.target.value }))}
                placeholder="Full name" style={inputStyle()} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <Label required>From</Label>
                <input type="date" value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} style={inputStyle()} />
              </div>
              <div>
                <Label required>To</Label>
                <input type="date" value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} style={inputStyle()} />
              </div>
            </div>
            <div>
              <Label required>Reason</Label>
              <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Enter reason…" rows={3}
                style={{ ...inputStyle(), resize:'vertical', lineHeight:1.7 }} />
            </div>
            <Btn variant="primary" disabled={submitting} onClick={submitLeave}
              style={{ width:'100%', justifyContent:'center', minHeight:44, fontSize:14 }}>
              {submitting ? 'Submitting…' : 'Submit leave request'}
            </Btn>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────

const NAV_TABS = [
  { key:'home',   label:'Home'     },
  { key:'mark',   label:'Mark'     },
  { key:'view',   label:'Sessions' },
  { key:'report', label:'Reports'  },
  { key:'leave',  label:'Leaves'   },
]

export default function Attendance({ currentUser, isAdmin }) {
  const isMobile  = useIsMobile()
  const [activeTab,   setActiveTab]   = useState('home')
  const [staff,       setStaff]       = useState([])
  const [markPrefill, setMarkPrefill] = useState(null)

  useEffect(() => {
    supabase.from('staff_profiles').select('id,name,designation').order('name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  const navigateTo = (tab, prefill = null) => {
    setMarkPrefill(prefill)
    setActiveTab(tab)
  }

  return (
    <div style={{
      maxWidth: 1000, margin: '0 auto',
      padding: isMobile ? '16px 12px' : '28px 24px',
      fontFamily: font,
    }}>

      {/* Page header */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.12em', color: T.gray400, marginBottom: 4,
        }}>
          GNSI Portal
        </div>
        <div style={{
          fontSize: isMobile ? 22 : 28, fontWeight: 700,
          letterSpacing: '-.02em', lineHeight: 1.2,
          background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Attendance
        </div>
        {!isMobile && (
          <div style={{ fontSize: 13.5, color: T.gray500, marginTop: 4, fontWeight: 400 }}>
            Mark, view, analyse and manage attendance across all batches
          </div>
        )}
      </div>

      {/* Nav tabs — Instagram gradient active style */}
      <div style={{
        display: 'flex',
        marginBottom: 20,
        background: T.white,
        borderRadius: 14,
        padding: 4,
        gap: 3,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        boxShadow: T.shadowSm,
        border: `1.5px solid ${T.gray150}`,
      }}>
        {NAV_TABS.map(t => {
          const isActive = activeTab === t.key
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              flex: 1,
              padding: isMobile ? '8px 4px' : '9px 14px',
              fontWeight: 700, fontSize: isMobile ? 11 : 12.5,
              cursor: 'pointer',
              background: isActive
                ? 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)'
                : 'none',
              border: 'none', borderRadius: 10, fontFamily: font,
              color: isActive ? 'white' : T.gray400,
              transition: 'all .18s', flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
              minHeight: 38,
              boxShadow: isActive ? '0 2px 10px rgba(131,58,180,.35)' : 'none',
              letterSpacing: '.01em',
              whiteSpace: 'nowrap',
            }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'home'   && <TabHome   onNavigate={navigateTo} />}
      {activeTab === 'mark'   && <TabMark   staff={staff} prefill={markPrefill} />}
      {activeTab === 'view'   && <TabView   />}
      {activeTab === 'report' && <TabReport />}
      {activeTab === 'leave'  && <TabLeave  staff={staff} currentUser={currentUser} isAdmin={isAdmin} />}
    </div>
  )
}
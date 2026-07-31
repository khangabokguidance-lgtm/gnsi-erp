// ============================================================
//  GNSI Portal — Attendance Module (Premium v4 · Redesigned)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'

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

// ─── "Ledger Console" Design System (v5 — Modern SaaS shell) ──
// New token set used by the sidebar shell, Home v2, and Student 360.
// Existing tabs (Mark/Sessions/Reports/Leaves/Awards) still use the
// legacy `T` tokens above until they're restyled in stage 2.

const C = {
  bg:        '#FAFAF9',   // warm-white app background
  surface:   '#FFFFFF',   // card background
  border:    '#E7E5E4',
  borderStrong: '#D6D3D1',
  ink:       '#0F172A',   // primary text
  inkMuted:  '#64748B',
  inkFaint:  '#94A3B8',
  sidebar:   '#0F172A',   // sidebar background (dark, contrasts with light content)
  sidebarText: '#CBD5E1',
  sidebarTextActive: '#FFFFFF',
  sidebarHover: '#1E293B',
  indigo:    '#4F46E5',   // primary accent — active states, primary actions
  indigoSoft:'#EEF2FF',
  green:     '#10B981',   // present / good / paid
  greenSoft: '#ECFDF5',
  amber:     '#F59E0B',   // late / warning / due-soon
  amberSoft: '#FFFBEB',
  red:       '#EF4444',   // absent / risk / overdue
  redSoft:   '#FEF2F2',
  violet:    '#8B5CF6',   // leave / misc category
  violetSoft:'#F5F3FF',
  shadowSm:  '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowMd:  '0 2px 8px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)',
  radius:    12,
}

// Schema config — student/fees/hostel table & column names.
// fees/discipline updated to match the real tables confirmed in
// Fees.jsx/feeEngine.js and Hostel.jsx (the originals here were
// placeholder guesses — 'fee_records' and 'discipline_logs' never
// existed, so these signals always silently showed '—').
const SCHEMA = {
  students:   { table: 'students',        id: 'gcc_no', name: 'student_name', course: 'course', className: 'class_name' },
  fees:       { table: 'adm_course_fees',  studentKey: 'adm_app_id', dueDate: 'pay_date', status: 'reverted' },
  discipline: { table: 'discipline_records', studentKey: 'gcc_no', date: 'incident_date', category: 'category', status: 'status', remark: 'remark' },
  hostel:     { table: 'sickbay_records',  studentKey: 'gcc_no', admittedDate: 'admitted_on', status: 'status', note: 'note' },
}

function useIsMobileC() { return useIsMobile() } // alias for clarity in new components

// Small inline icon set (no emoji) — 20x20 stroke icons, currentColor
const Icon = {
  home:   (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>,
  users:  (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15 14.3c2.7.4 4.6 2.3 5 5.7"/></svg>,
  check:  (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M8 11.5l2.4 2.5L16 8.5"/></svg>,
  calendar:(p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8 3.5v3M16 3.5v3"/></svg>,
  chart:  (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2.5 20h19"/></svg>,
  leaf:   (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z"/><path d="M5 19c0-4 2-7 6-9"/></svg>,
  award:  (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8.5" r="5"/><path d="M8.5 12.8 7 21l5-2.4L17 21l-1.5-8.2"/></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3.5 5 6v6c0 4.5 3 7.8 7 8.5 4-.7 7-4 7-8.5V6l-7-2.5Z"/></svg>,
  wallet: (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6.5" width="18" height="12.5" rx="2.2"/><path d="M3 10.5h18M16 14.5h2.2"/></svg>,
  pulse:  (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h4l2 7 4-14 2 7h6"/></svg>,
  bell:   (p) => <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z"/><path d="M9.5 19a2.6 2.6 0 0 0 5 0"/></svg>,
  chevron:(p) => <svg viewBox="0 0 24 24" width={p.size||14} height={p.size||14} fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>,
  arrowLeft:(p) => <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
}

// ─── Advanced UI primitives — skeletons, motion, charts ───────

function ConsoleAnimStyles() {
  return (
    <style>{`
      @keyframes gnsi-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes gnsi-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .gnsi-fade-in { animation: gnsi-fade-in .25s ease-out; }
      .gnsi-hover-lift { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
      .gnsi-hover-lift:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(15,23,42,.08); border-color: ${C.borderStrong}; }
      .gnsi-row-hover { transition: background .12s ease; }
      .gnsi-row-hover:hover { background: ${C.bg}; }
      .gnsi-btn-press:active { transform: scale(.97); }
    `}</style>
  )
}

function Skeleton({ w = '100%', h = 14, radius = 6, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: `linear-gradient(90deg, ${C.border} 25%, #F1F0EF 37%, ${C.border} 63%)`,
      backgroundSize: '200% 100%', animation: 'gnsi-shimmer 1.4s ease-in-out infinite',
      ...style,
    }} />
  )
}

function SkeletonStatCard() {
  return (
    <ConsoleCard style={{ padding: '16px 18px' }} padded={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton w={90} h={11} />
        <Skeleton w={26} h={26} radius={7} />
      </div>
      <Skeleton w={60} h={26} />
    </ConsoleCard>
  )
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
      <Skeleton w={36} h={36} radius={10} />
      <div style={{ flex: 1 }}>
        <Skeleton w="40%" h={12} style={{ marginBottom: 6 }} />
        <Skeleton w="25%" h={10} />
      </div>
      <Skeleton w={70} h={20} radius={999} />
    </div>
  )
}

const CHART_TONE = { good: '#10B981', warn: '#F59E0B', bad: '#EF4444', indigo: '#4F46E5' }

function ConsoleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.ink, color: '#fff', borderRadius: 8, padding: '8px 12px',
      fontSize: 12, fontFamily: font, boxShadow: C.shadowMd,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: p.color || p.fill }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

// Trend line chart — attendance % over time
function TrendChart({ data, dataKey = 'pct', color = CHART_TONE.indigo, height = 180 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gnsi-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ConsoleTooltip />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.2} fill="url(#gnsi-trend-fill)" dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Compact sparkline — no axes, for inline stat cards
function Sparkline({ data, dataKey = 'v', color = CHART_TONE.indigo, height = 34, width = '100%' }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Status breakdown bar chart — grouped bars per category
function StatusBarChart({ data, height = 220 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ConsoleTooltip />} cursor={{ fill: C.bg }} />
        <Bar dataKey="Present" stackId="a" fill={CHART_TONE.good} radius={[0,0,0,0]} />
        <Bar dataKey="Late"    stackId="a" fill={CHART_TONE.warn} radius={[0,0,0,0]} />
        <Bar dataKey="Absent"  stackId="a" fill={CHART_TONE.bad}  radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Donut chart — single-moment distribution (e.g. today's status split)
function StatusDonut({ counts, size = 140 }) {
  const data = [
    { name: 'Present', value: counts.Present || 0, color: CHART_TONE.good },
    { name: 'Late',    value: counts.Late    || 0, color: CHART_TONE.warn },
    { name: 'Absent',  value: counts.Absent  || 0, color: CHART_TONE.bad },
    { name: 'Leave',   value: counts.Leave   || 0, color: '#8B5CF6' },
  ].filter(d => d.value > 0)
  const total = data.reduce((s,d) => s+d.value, 0)
  if (!total) return <div style={{ height: size, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data</div>
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={size*0.32} outerRadius={size*0.48} paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map((d,i) => <Cell key={i} fill={d.color} stroke="none" />)}
          </Pie>
          <Tooltip content={<ConsoleTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{total}</div>
        <div style={{ fontSize: 10, color: C.inkMuted, fontWeight: 600 }}>total</div>
      </div>
    </div>
  )
}

function ConsoleCard({ children, style = {}, padded = true, className = '' }) {
  return (
    <div className={className} style={{
      background: C.surface, borderRadius: C.radius,
      border: `1px solid ${C.border}`, boxShadow: C.shadowSm,
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

function ConsoleCardHeader({ title, subtitle, right, icon }) {
  return (
    <div style={{
      padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: C.indigoSoft,
            color: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{icon}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: C.ink, letterSpacing: '-.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function ConsoleBtn({ children, onClick, variant = 'default', small, disabled, style = {}, className = '' }) {
  const variants = {
    default: { background: C.surface, color: C.ink, border: `1px solid ${C.borderStrong}` },
    primary: { background: C.indigo, color: '#fff', border: 'none' },
    subtle:  { background: C.bg, color: C.inkMuted, border: `1px solid ${C.border}` },
    danger:  { background: C.redSoft, color: '#B91C1C', border: `1px solid #FECACA` },
  }
  return (
    <button className={className} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: font,
      fontWeight: 600, fontSize: small ? 12.5 : 13.5, borderRadius: 8,
      padding: small ? '6px 11px' : '8px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1, transition: 'all .12s', ...variants[variant], ...style,
    }}>
      {children}
    </button>
  )
}

// Compact 4-signal chip row — the module's signature repeated element.
// Shows Attendance / Discipline / Fees / Hostel at a glance for one student.
function SignalRow({ attendancePct, disciplineOpen, feeOverdueDays, hostelStatus, size = 'md' }) {
  const chips = [
    {
      key: 'attendance', label: 'Attendance', icon: Icon.check,
      value: attendancePct != null ? `${attendancePct}%` : '—',
      tone: attendancePct == null ? 'neutral' : attendancePct >= 75 ? 'good' : attendancePct >= 60 ? 'warn' : 'bad',
    },
    {
      key: 'discipline', label: 'Discipline', icon: Icon.shield,
      value: disciplineOpen != null ? (disciplineOpen === 0 ? 'Clear' : `${disciplineOpen} open`) : '—',
      tone: disciplineOpen == null ? 'neutral' : disciplineOpen === 0 ? 'good' : disciplineOpen <= 2 ? 'warn' : 'bad',
    },
    {
      key: 'fees', label: 'Fees', icon: Icon.wallet,
      value: feeOverdueDays != null ? (feeOverdueDays <= 0 ? 'Paid' : `${feeOverdueDays}d overdue`) : '—',
      tone: feeOverdueDays == null ? 'neutral' : feeOverdueDays <= 0 ? 'good' : feeOverdueDays <= 15 ? 'warn' : 'bad',
    },
    {
      key: 'hostel', label: 'Hostel', icon: Icon.pulse,
      value: hostelStatus || '—',
      tone: !hostelStatus || hostelStatus === 'Normal' ? 'good' : hostelStatus === 'Sickbay' ? 'warn' : 'neutral',
    },
  ]
  const toneColor = { good: C.green, warn: C.amber, bad: C.red, neutral: C.inkFaint }
  const toneBg    = { good: C.greenSoft, warn: C.amberSoft, bad: C.redSoft, neutral: C.bg }
  const compact = size === 'sm'
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chips.map(c => (
        <div key={c.key} title={c.label} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: compact ? '3px 8px' : '5px 10px', borderRadius: 999,
          background: toneBg[c.tone], color: toneColor[c.tone],
          fontSize: compact ? 10.5 : 11.5, fontWeight: 700, lineHeight: 1,
        }}>
          <c.icon size={compact ? 11 : 12.5} />
          {c.value}
        </div>
      ))}
    </div>
  )
}

function riskLevel({ attendancePct, disciplineOpen, feeOverdueDays, hostelStatus }) {
  let score = 0
  if (attendancePct != null && attendancePct < 60) score += 2
  else if (attendancePct != null && attendancePct < 75) score += 1
  if (disciplineOpen != null && disciplineOpen > 2) score += 2
  else if (disciplineOpen != null && disciplineOpen > 0) score += 1
  if (feeOverdueDays != null && feeOverdueDays > 15) score += 2
  else if (feeOverdueDays != null && feeOverdueDays > 0) score += 1
  if (hostelStatus === 'Sickbay') score += 1
  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

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
  'Environmental Studies',
]

const today    = () => new Date().toISOString().split('T')[0]
const fmtDate  = d  => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtMonth = m  => { const [y,mo] = m.split('-'); return new Date(y, mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
const todayDay = () => new Date().toLocaleDateString('en-US', { weekday:'long' })

// ─── WhatsApp direct-send + push notification helpers ─────────
// Browsers can't silently attach/send a WhatsApp message with zero
// clicks — wa.me always opens a chat window pre-filled with text that
// the user (staff member) sends themselves. This mirrors the same
// constraint already handled the same way in the Hostel module.
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length === 10 ? `91${digits}` : digits
}
function buildWhatsAppLink(phone, message) {
  const target = normalizePhone(phone)
  if (!target) return null
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`
}
function openWhatsApp(phone, message) {
  const url = buildWhatsAppLink(phone, message)
  if (!url) return false
  window.open(url, '_blank')
  return true
}

// Push notification — same /api/send-push backend already used by the
// Hostel module's notifications.js, reused here as a self-contained
// copy since this file has no import relationship to that module.
async function sendPushToStaffId(staffId, title, body, url = '/attendance') {
  if (!staffId) return
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, staffId }),
    })
  } catch (e) {
    console.error('sendPushToStaffId failed:', e)
  }
}

// ─── Cross-tab live-refresh bus ────────────────────────────────
// Mark tab dispatches this after a successful save so Overview,
// Student 360, and any other listening dashboard refetch immediately
// instead of waiting for a manual reload or tab switch.
const ATTENDANCE_UPDATED_EVENT = 'gnsi:attendance-updated'
function broadcastAttendanceUpdate(detail) {
  try { window.dispatchEvent(new CustomEvent(ATTENDANCE_UPDATED_EVENT, { detail })) } catch (e) {
    console.error('broadcastAttendanceUpdate failed:', e)
  }
}
function useAttendanceUpdatedListener(callback) {
  useEffect(() => {
    const handler = (e) => callback(e.detail)
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, handler)
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback])
}

// Separate event for the `students` table itself changing — archived,
// restored, or moved to a different course/batch — dispatched by
// Students.jsx. TabMark's roll call reads `students` live (see below), so
// this just tells it to refetch immediately instead of waiting for the
// person to change the course/batch dropdown and change it back.
const STUDENTS_UPDATED_EVENT = 'gnsi:students-updated'
function useStudentsUpdatedListener(callback) {
  useEffect(() => {
    const handler = (e) => callback(e.detail)
    window.addEventListener(STUDENTS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(STUDENTS_UPDATED_EVENT, handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback])
}

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
  const [refreshKey, setRefreshKey] = useState(0)
  useAttendanceUpdatedListener(useCallback(() => setRefreshKey(k => k + 1), []))

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
  }, [threshold, refreshKey])

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

function ConsoleSelect({ value, onChange, disabled, children, style = {} }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled} style={{
      padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.borderStrong}`,
      fontSize: 13.5, fontFamily: font, outline: 'none', background: C.surface, color: C.ink,
      width: '100%', boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1, appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 30,
      ...style,
    }}>
      {children}
    </select>
  )
}

function ConsoleInput(props) {
  return <input {...props} style={{
    padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.borderStrong}`,
    fontSize: 13.5, fontFamily: font, outline: 'none', background: C.surface, color: C.ink,
    width: '100%', boxSizing: 'border-box', ...(props.style||{}),
  }} />
}

function ConsoleLabel({ children, required, hint }) {
  return (
    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkMuted, letterSpacing: '.01em' }}>
        {children}{required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
      </span>
      {hint && <span style={{ fontSize: 10.5, color: C.indigo, fontWeight: 600 }}>{hint}</span>}
    </div>
  )
}

function ConsoleAlert({ type = 'info', children, onClose }) {
  const map = {
    info:    { bg: C.indigoSoft, color: '#3730A3' },
    success: { bg: C.greenSoft, color: '#047857' },
    warn:    { bg: C.amberSoft, color: '#92400E' },
    error:   { bg: C.redSoft, color: '#B91C1C' },
  }
  const m = map[type]
  return (
    <div style={{
      background: m.bg, color: m.color, borderRadius: 8, padding: '10px 14px',
      fontSize: 13, fontWeight: 500, marginBottom: 14, display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color: m.color, fontSize: 15, opacity: .6 }}>×</button>}
    </div>
  )
}

const STATUS_TONE = {
  Present: { color: C.green, bg: C.greenSoft },
  Absent:  { color: C.red,   bg: C.redSoft },
  Late:    { color: C.amber, bg: C.amberSoft },
  Leave:   { color: C.violet,bg: C.violetSoft },
}

const STATUS_ICON = { Present: '✓', Absent: '✕', Late: '◔', Leave: '⤴' }

function StudentRowMark({ student, status, onChange }) {
  const initials = student.student_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const tone = STATUS_TONE[status] || STATUS_TONE.Present
  const needsContact = (status === 'Absent' || status === 'Late') && student.phone
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px', border: `1px solid ${status === 'Absent' ? tone.color + '33' : C.border}`,
      borderRadius: 12, background: C.surface,
      boxShadow: status === 'Absent' ? `0 0 0 1px ${tone.bg}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.indigoSoft, color: C.indigo,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{student.student_name}</div>
          <div style={{ fontSize: 10.5, color: C.inkFaint, display: 'flex', gap: 6 }}>
            {student.gcc_no && <span>GCC {student.gcc_no}</span>}
            {!student.phone && <span style={{ color: C.amber }}>· no parent contact</span>}
          </div>
        </div>
        {needsContact && (
          <button
            onClick={(e) => { e.stopPropagation(); openWhatsApp(student.phone,
              `Dear Parent, your ward ${student.student_name} was marked ${status} today (${fmtDate(today())}). Please ensure regular attendance. — GNSI`) }}
            title="Message parent on WhatsApp"
            style={{
              width: 30, height: 30, borderRadius: 9, border: 'none', flexShrink: 0,
              background: '#25D366', color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >📲</button>
        )}
      </div>

      {/* Segmented status control — replaces tap-to-cycle so the current
          state and all options are visible at once, the way a mobile
          attendance app would present it. */}
      <div style={{ display: 'flex', gap: 4, background: C.bg, padding: 3, borderRadius: 9 }}>
        {STATUSES.map(s => {
          const active = status === s
          const t = STATUS_TONE[s]
          return (
            <button key={s} onClick={() => onChange(s)} style={{
              flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none',
              background: active ? t.color : 'transparent',
              color: active ? '#fff' : C.inkMuted,
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font,
              transition: 'all .12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            }}>
              <span>{STATUS_ICON[s]}</span>
              {s}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
  const [showReceipt, setShowReceipt] = useState(false)
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

  // Roster is read straight from the `students` table (the same table
  // Students.jsx edits) rather than the separate `course_enrollments` table.
  // course_enrollments was never kept in sync with student deletes/edits —
  // archiving a student or changing their course/batch in Students.jsx only
  // ever touched `students.deleted_at`/`students.course`/`students.class_name`,
  // so a stale course_enrollments row kept showing that student in roll call
  // (or hid a newly-added one) until someone manually reconciled both tables.
  // Reading `students` directly means Mark's roster always reflects the
  // current state of the one table that's actually authoritative.
  //
  // .eq('status','Active') is also what excludes dropout students: marking
  // someone as Dropout (in either Students.jsx or this module's Student DB
  // tab) sets status='Dropout' without touching deleted_at, so their row
  // and full history stay intact — they just fall out of this filter and
  // stop appearing in daily roll call. See handleMarkDropout in TabStudentDB.
  const fetchRoster = useCallback(async () => {
    if (!form.course) { setStudents([]); setRecords({}); return }
    // NOTE: `students.batch` is the Lakshya/Umeed/Achiever/etc. split
    // (Students.jsx writes it via `form.batch`) — it is a DIFFERENT column
    // from `class_name`, which is a separate free-text section field
    // (e.g. "9A"). Filtering only on `class_name` here meant every subtype
    // under a course (e.g. both Lakshya and Umeed under Navodaya) was
    // fetched together whenever the section field was left blank — that's
    // why the "students enrolled" count included both batches combined.
    let q = supabase.from('students')
      .select('id,name,gcc_no,course,batch,class_name,hostel_type,status,deleted_at,phone')
      .is('deleted_at', null).eq('status', 'Active').eq('course', form.course)
    if (form.subtype)   q = q.eq('batch', form.subtype)
    if (form.class_name) q = q.eq('class_name', form.class_name)
    const { data } = await q.order('name')
    // Map to the field names the rest of this component (and the save/
    // WhatsApp-report/notify code below) already expects, so nothing
    // downstream needs to change: student_id/student_name/gcc_no/hostel_type.
    // `phone` is the parent contact number (same column Students.jsx writes
    // to) — carried through as a flat field so NotifyPanel/StudentRowMark
    // can offer a "message parent" action without a second fetch. Previously
    // this was missing entirely, so the WhatsApp button in NotifyPanel
    // (which read a non-existent `s.students?.phone`) never rendered for
    // any student marked from this roster.
    const rows = (data || []).map(s => ({
      student_id: s.id, student_name: s.name, gcc_no: s.gcc_no,
      hostel_type: s.hostel_type, class_name: s.class_name, batch: s.batch,
      phone: s.phone || null,
    }))
    setStudents(rows)
    setRecords(prev => {
      const init = {}
      rows.forEach(s => {
        const k = s.student_id || s.student_name
        // Preserve marks already entered for students who are still on the
        // roster after a live refetch (e.g. a different student was deleted
        // mid-session) — only newly-appearing students default to Present.
        init[k] = prev[k] || 'Present'
      })
      return init
    })
  }, [form.course, form.subtype, form.class_name])

  useEffect(() => { fetchRoster() }, [fetchRoster])

  // Live refresh — if a student is archived, restored, or moved to a
  // different course/batch in Students.jsx while this course/batch is
  // already open here, the roster updates immediately instead of only
  // picking up the change the next time the course/batch dropdown changes.
  useStudentsUpdatedListener(fetchRoster)

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
    broadcastAttendanceUpdate({ course: form.course, subtype: form.subtype, class_name: form.class_name, date: form.session_date })
    setShowNotify(true)
    setShowReceipt(true)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: isMobile ? 8 : 0 }}>
      <AttendanceAnimStyles />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-.02em' }}>Mark attendance</div>
          <div style={{ fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>Configure the session, then mark each student</div>
        </div>
        {absentStudents.length > 0 && (
          <button onClick={() => setShowNotify(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999,
            border: 'none', background: C.redSoft, color: C.red, fontWeight: 700, fontSize: 12,
            cursor: 'pointer', fontFamily: font, flexShrink: 0,
          }}>
            📲 <span>{absentStudents.length}</span>
          </button>
        )}
      </div>

      <ConsoleCard>
        <ConsoleCardHeader icon={<Icon.check size={16} />} title="Session details" subtitle="Course, batch, and period" />
        <div style={{ padding: '18px 20px' }}>
          {toast && <ConsoleAlert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</ConsoleAlert>}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            <div>
              <ConsoleLabel required>Course</ConsoleLabel>
              <ConsoleSelect value={form.course} onChange={e => setForm(prev => ({ ...prev, course: e.target.value, subtype:'', class_name:'' }))}>
                <option value="">Select course…</option>
                {COURSES.map(c => <option key={c}>{c}</option>)}
              </ConsoleSelect>
            </div>
            <div>
              <ConsoleLabel>Batch</ConsoleLabel>
              <ConsoleSelect value={form.subtype} disabled={!form.course}
                onChange={e => setForm(prev => ({ ...prev, subtype: e.target.value, class_name:'' }))}>
                <option value="">Select batch…</option>
                {subtypes.map(s => <option key={s}>{s}</option>)}
              </ConsoleSelect>
            </div>
            <div>
              <ConsoleLabel hint={batchId ? 'linked' : ''}>Class</ConsoleLabel>
              <ConsoleInput value={form.class_name} onChange={e => setForm(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. 9A (optional)" />
            </div>
          </div>

          {form.course && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 8,
              background: students.length ? C.greenSoft : C.amberSoft,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: students.length ? '#047857' : '#92400E' }}>
                {students.length ? `${students.length} students enrolled` : 'No students found'}
              </span>
              {timetable.length > 0 && (
                <span style={{ fontSize: 11.5, color: C.indigo, fontWeight: 600 }}>{timetable.length} timetable slots</span>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            <div style={isMobile ? { gridColumn: '1 / -1' } : {}}>
              <ConsoleLabel>Date</ConsoleLabel>
              <ConsoleInput type="date" value={form.session_date}
                onChange={e => setForm(prev => ({ ...prev, session_date: e.target.value }))} />
            </div>
            <div>
              <ConsoleLabel hint={form.period_number && timetable.length ? 'auto-fill' : ''}>Period</ConsoleLabel>
              <ConsoleSelect value={form.period_number} onChange={e => handlePeriod(e.target.value)}>
                <option value="">— None —</option>
                {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
              </ConsoleSelect>
            </div>
            <div>
              <ConsoleLabel hint={form.period_number && form.subject_name && timetable.length ? 'from timetable' : ''}>Subject</ConsoleLabel>
              <ConsoleSelect value={form.subject_name} onChange={e => setForm(prev => ({ ...prev, subject_name: e.target.value }))}>
                <option value="">Select subject…</option>
                {batchSubjects.map(s => <option key={s}>{s}</option>)}
              </ConsoleSelect>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
            <div>
              <ConsoleLabel hint={form.period_number && form.teacher_name && timetable.length ? 'from timetable' : ''}>Teacher</ConsoleLabel>
              <ConsoleSelect value={form.teacher_name} onChange={e => handleTeacher(e.target.value)}>
                <option value="">Select teacher…</option>
                {batchStaff.map(s => <option key={s.id} value={s.name}>{s.name}{s.designation ? ` — ${s.designation}` : ''}</option>)}
              </ConsoleSelect>
            </div>
            <div>
              <ConsoleLabel>Session type</ConsoleLabel>
              <ConsoleSelect value={form.session_type} onChange={e => setForm(prev => ({ ...prev, session_type: e.target.value }))}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </ConsoleSelect>
            </div>
            <div>
              <ConsoleLabel>Remarks</ConsoleLabel>
              <ConsoleInput value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional notes…" />
            </div>
          </div>
        </div>
      </ConsoleCard>

      {students.length > 0 && (
        <ConsoleCard>
          <ConsoleCardHeader
            icon={<Icon.users size={16} />} title="Roll call"
            subtitle={`${form.course}${form.subtype ? ' · ' + form.subtype : ''} · tap a row to cycle status`}
            right={
              <>
                <ConsoleBtn small variant="subtle" disabled={copying} onClick={copyLastSession}>{copying ? '…' : 'Copy last'}</ConsoleBtn>
                {!isMobile && <ConsoleBtn small variant="subtle" onClick={invertSelection}>Invert</ConsoleBtn>}
              </>
            }
          />
          <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
            {STATUSES.map(s => {
              const tone = STATUS_TONE[s]
              return (
                <button key={s} onClick={() => markAll(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
                  border: 'none', background: tone.bg, color: tone.color, fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', fontFamily: font,
                }}>
                  <span style={{ fontFamily: fontMono }}>{counts[s]}</span> {s}
                </button>
              )
            })}
          </div>
          <div style={{ padding: '12px 20px 0' }}>
            <AttendBar records={records} />
          </div>
          <div style={{ padding: '12px 20px' }}>
            <ConsoleInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or GCC number…" />
          </div>
          <div style={{
            padding: '0 20px 16px', display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 8,
          }}>
            {filteredStudents.map(s => {
              const key = s.student_id || s.student_name
              return (
                <StudentRowMark key={key} student={s} status={records[key] || 'Present'}
                  onChange={next => setRecords(prev => ({ ...prev, [key]: next }))} />
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '28px 0', color: C.inkFaint, fontSize: 13 }}>
                No students match your search.
              </div>
            )}
          </div>
          <div style={{
            padding: '14px 20px', borderTop: `1px solid ${C.border}`, background: C.bg,
            ...(isMobile ? { position: 'sticky', bottom: 76, zIndex: 20, borderRadius: '0 0 12px 12px', boxShadow: '0 -4px 12px rgba(15,23,42,.06)' } : {}),
          }}>
            <ConsoleBtn variant="primary" disabled={saving} onClick={handleSave} style={{ width: '100%', justifyContent: 'center', minHeight: 46 }}>
              {saving ? 'Saving…' : `Save attendance · ${students.length} students`}
            </ConsoleBtn>
          </div>
        </ConsoleCard>
      )}

      {showReceipt && (
        <ReceiptSuccessModal count={students.length} absentCount={absentStudents.length} onClose={() => setShowReceipt(false)} />
      )}

      {showNotify && (
        <WhatsAppReportPanel students={students} absentStudents={absentStudents} records={records} sessionInfo={form} counts={counts} />
      )}

      {showNotify && absentStudents.length > 0 && (
        <NotifyPanel students={absentStudents} records={records} sessionInfo={form} onClose={() => setShowNotify(false)} />
      )}
    </div>
  )
}

// ─── WHATSAPP GROUP REPORT ─────────────────────────────────────

function buildAttendanceReportText({ students, absentStudents, records, sessionInfo, counts }) {
  const lines = []
  lines.push(`*GNSI — Attendance Report*`)
  lines.push(`📅 ${fmtDate(sessionInfo.session_date)}${sessionInfo.subject_name ? ' · ' + sessionInfo.subject_name : ''}`)
  const classLine = [sessionInfo.course, sessionInfo.subtype, sessionInfo.class_name].filter(Boolean).join(' · ')
  if (classLine) lines.push(`🏫 ${classLine}`)
  if (sessionInfo.teacher_name) lines.push(`👤 Teacher: ${sessionInfo.teacher_name}`)
  if (sessionInfo.period_number) lines.push(`⏰ Period: ${sessionInfo.period_number}`)
  lines.push('')
  lines.push(`Total: ${students.length}  ✅ Present: ${counts.Present || 0}  ❌ Absent: ${counts.Absent || 0}  ⏱ Late: ${counts.Late || 0}  📝 Leave: ${counts.Leave || 0}`)

  if (absentStudents.length) {
    lines.push('')
    lines.push(`*Absent / Late Details (${absentStudents.length}):*`)
    absentStudents.forEach((s, i) => {
      const status = records[s.student_id || s.student_name]
      const tag = status === 'Late' ? '⏱ Late' : status === 'Leave' ? '📝 Leave' : '❌ Absent'
      const gcc = s.gcc_no ? ` (GCC ${s.gcc_no})` : ''
      const hostel = s.hostel_type ? ` — ${s.hostel_type}` : ''
      lines.push(`${i + 1}. ${s.student_name}${gcc}${hostel} — ${tag}`)
    })
  } else {
    lines.push('')
    lines.push('🎉 Full attendance — no absentees.')
  }

  lines.push('')
  lines.push('— GNSI Portal')
  return lines.join('\n')
}

function buildAttendanceReportRows({ students, absentStudents, records, sessionInfo, counts }) {
  const classLine = [sessionInfo.course, sessionInfo.subtype, sessionInfo.class_name].filter(Boolean).join(' · ')
  const rows = absentStudents.map((s, i) => {
    const status = records[s.student_id || s.student_name]
    return {
      sl: i + 1, name: s.student_name, gcc: s.gcc_no || '—',
      hostel: s.hostel_type || '—', status: status || 'Absent',
    }
  })
  return { classLine, rows }
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function buildReportHTML({ students, absentStudents, records, sessionInfo, counts }) {
  const { classLine, rows } = buildAttendanceReportRows({ students, absentStudents, records, sessionInfo, counts })
  const statusColor = st => st === 'Late' ? '#b45309' : st === 'Leave' ? '#7c3aed' : '#dc2626'
  const rowsHtml = rows.length
    ? rows.map(r => `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${r.sl}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;">${r.name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${r.gcc}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${r.hostel}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:${statusColor(r.status)};font-weight:700;">${r.status}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;">🎉 Full attendance — no absentees.</td></tr>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Attendance Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:white;padding:16mm 18mm}
    .inst{font-size:19px;font-weight:900;color:#1a3a5c;font-family:Georgia,serif}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #1a3a5c;padding-bottom:10px;margin-bottom:12px}
    .rtype{font-size:11px;font-weight:900;color:white;background:#1a3a5c;padding:3px 12px;border-radius:5px;display:inline-block}
    .meta{display:flex;gap:22px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px}
    .mi{display:flex;flex-direction:column}
    .mk{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px}
    .mv{font-size:12.5px;font-weight:700;color:#1a3a5c}
    .counts{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px}
    .cbox{flex:1;min-width:90px;text-align:center;border-radius:8px;padding:10px;font-weight:800}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px}
    thead tr{background:#1a3a5c;color:white}
    th{padding:8px 10px;text-align:left;font-weight:700;font-size:11.5px}
    .foot{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
    @media print{body{padding:0}.np{display:none}}
    @media screen{body{background:#e2e8f0;padding:20px}
      .wrap{background:white;padding:16mm 18mm;box-shadow:0 4px 20px rgba(0,0,0,.12);max-width:210mm;margin:0 auto}
      .pbtn{position:fixed;top:16px;right:16px;background:#1a3a5c;color:white;border:none;padding:10px 20px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}
      .cbtn{position:fixed;top:16px;right:170px;background:#64748b;color:white;border:none;padding:10px 16px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}}
  </style></head><body>
  <button class="pbtn np" onclick="window.print()">Print / Save PDF</button>
  <button class="cbtn np" onclick="window.close()">Close</button>
  <div class="wrap">
    <div class="hdr">
      <div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div></div>
      <div><span class="rtype">ATTENDANCE REPORT</span></div>
    </div>
    <div class="meta">
      <div class="mi"><span class="mk">Date</span><span class="mv">${fmtDate(sessionInfo.session_date)}</span></div>
      ${classLine ? `<div class="mi"><span class="mk">Class</span><span class="mv">${classLine}</span></div>` : ''}
      ${sessionInfo.subject_name ? `<div class="mi"><span class="mk">Subject</span><span class="mv">${sessionInfo.subject_name}</span></div>` : ''}
      ${sessionInfo.teacher_name ? `<div class="mi"><span class="mk">Teacher</span><span class="mv">${sessionInfo.teacher_name}</span></div>` : ''}
      ${sessionInfo.period_number ? `<div class="mi"><span class="mk">Period</span><span class="mv">${sessionInfo.period_number}</span></div>` : ''}
    </div>
    <div class="counts">
      <div class="cbox" style="background:#dcfce7;color:#15803d;">✅ Present<br/>${counts.Present || 0}</div>
      <div class="cbox" style="background:#fee2e2;color:#dc2626;">❌ Absent<br/>${counts.Absent || 0}</div>
      <div class="cbox" style="background:#fef3c7;color:#b45309;">⏱ Late<br/>${counts.Late || 0}</div>
      <div class="cbox" style="background:#ede9fe;color:#7c3aed;">📝 Leave<br/>${counts.Leave || 0}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Student Name</th><th>GCC No.</th><th>Hostel Type</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="foot">GNSI Portal · Generated ${new Date().toLocaleString('en-IN')} · CONFIDENTIAL</div>
  </div>
  </body></html>`
}

function drawReportToCanvas({ students, absentStudents, records, sessionInfo, counts }) {
  const { classLine, rows } = buildAttendanceReportRows({ students, absentStudents, records, sessionInfo, counts })
  const W = 900
  const rowH = 30
  const topH = 190
  const H = topH + Math.max(rows.length, 1) * rowH + 60
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = '#1a3a5c'
  ctx.font = '700 24px Georgia, serif'
  ctx.fillText('Guidance Navodaya & Sainik Institute', 30, 40)
  ctx.font = '700 12px Segoe UI, Arial'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(W - 190, 20, 160, 26)
  ctx.fillStyle = '#1a3a5c'
  ctx.fillRect(W - 190, 20, 160, 26)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('ATTENDANCE REPORT', W - 178, 37)

  ctx.strokeStyle = '#1a3a5c'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(30, 55); ctx.lineTo(W - 30, 55); ctx.stroke()

  // Meta
  ctx.fillStyle = '#334155'
  ctx.font = '600 14px Segoe UI, Arial'
  const metaParts = [
    `Date: ${fmtDate(sessionInfo.session_date)}`,
    classLine ? `Class: ${classLine}` : null,
    sessionInfo.subject_name ? `Subject: ${sessionInfo.subject_name}` : null,
    sessionInfo.teacher_name ? `Teacher: ${sessionInfo.teacher_name}` : null,
  ].filter(Boolean)
  ctx.fillText(metaParts.join('   ·   '), 30, 82)

  // Counts
  const boxes = [
    { label: '✅ Present', val: counts.Present || 0, bg: '#dcfce7', fg: '#15803d' },
    { label: '❌ Absent', val: counts.Absent || 0, bg: '#fee2e2', fg: '#dc2626' },
    { label: '⏱ Late', val: counts.Late || 0, bg: '#fef3c7', fg: '#b45309' },
    { label: '📝 Leave', val: counts.Leave || 0, bg: '#ede9fe', fg: '#7c3aed' },
  ]
  const boxW = (W - 60 - 30) / 4
  boxes.forEach((b, i) => {
    const x = 30 + i * (boxW + 10)
    ctx.fillStyle = b.bg
    ctx.fillRect(x, 96, boxW, 46)
    ctx.fillStyle = b.fg
    ctx.font = '700 13px Segoe UI, Arial'
    ctx.fillText(b.label, x + 10, 116)
    ctx.font = '800 16px Segoe UI, Arial'
    ctx.fillText(String(b.val), x + 10, 136)
  })

  // Table header
  let y = 160
  ctx.fillStyle = '#1a3a5c'
  ctx.fillRect(30, y, W - 60, 28)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 12px Segoe UI, Arial'
  const cols = [{ x: 40, w: 30, label: '#' }, { x: 80, w: 320, label: 'Student Name' },
    { x: 400, w: 120, label: 'GCC No.' }, { x: 520, w: 200, label: 'Hostel' }, { x: 720, w: 140, label: 'Status' }]
  cols.forEach(c => ctx.fillText(c.label, c.x, y + 19))
  y += 28

  if (rows.length) {
    rows.forEach((r, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc'
      ctx.fillRect(30, y, W - 60, rowH)
      ctx.fillStyle = '#0f172a'
      ctx.font = '600 13px Segoe UI, Arial'
      ctx.fillText(String(r.sl), 40, y + 20)
      ctx.fillText(r.name, 80, y + 20)
      ctx.font = '400 13px Segoe UI, Arial'
      ctx.fillText(r.gcc, 400, y + 20)
      ctx.fillText(r.hostel, 520, y + 20)
      ctx.fillStyle = r.status === 'Late' ? '#b45309' : r.status === 'Leave' ? '#7c3aed' : '#dc2626'
      ctx.font = '700 13px Segoe UI, Arial'
      ctx.fillText(r.status, 720, y + 20)
      y += rowH
    })
  } else {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 14px Segoe UI, Arial'
    ctx.fillText('🎉 Full attendance — no absentees.', 30, y + 20)
    y += rowH
  }

  ctx.strokeStyle = '#e2e8f0'
  ctx.beginPath(); ctx.moveTo(30, y + 10); ctx.lineTo(W - 30, y + 10); ctx.stroke()
  ctx.fillStyle = '#94a3b8'
  ctx.font = '400 11px Segoe UI, Arial'
  ctx.fillText(`GNSI Portal · Generated ${new Date().toLocaleString('en-IN')}`, 30, y + 28)

  return canvas
}

// ─── ANIMATIONS ────────────────────────────────────────────────

function AttendanceAnimStyles() {
  return (
    <style>{`
      @keyframes gnsi-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
      @keyframes gnsi-modal-pop {
        0%   { transform: scale(.3) rotate(-8deg); opacity: 0 }
        55%  { transform: scale(1.08) rotate(2deg); opacity: 1 }
        75%  { transform: scale(.96) rotate(-1deg) }
        100% { transform: scale(1) rotate(0deg) }
      }
      @keyframes gnsi-stamp {
        0%   { transform: scale(2.4) rotate(-18deg); opacity: 0 }
        60%  { transform: scale(0.9) rotate(-10deg); opacity: 1 }
        80%  { transform: scale(1.08) rotate(-13deg) }
        100% { transform: scale(1) rotate(-12deg); opacity: 1 }
      }
      @keyframes gnsi-check-draw {
        from { stroke-dashoffset: 60 } to { stroke-dashoffset: 0 }
      }
      @keyframes gnsi-confetti-fall {
        0%   { transform: translateY(-40px) rotate(0deg); opacity: 1 }
        100% { transform: translateY(340px) rotate(540deg); opacity: 0 }
      }
      @keyframes gnsi-pulse-ring {
        0%   { transform: scale(.7); opacity: .55 }
        100% { transform: scale(1.9); opacity: 0 }
      }
      @keyframes gnsi-slide-up-fade {
        from { transform: translateY(22px); opacity: 0 }
        to   { transform: translateY(0);     opacity: 1 }
      }
      @keyframes gnsi-shimmer {
        0%   { background-position: -200% 0 }
        100% { background-position:  200% 0 }
      }
      .gnsi-receipt-enter { animation: gnsi-slide-up-fade .5s cubic-bezier(.2,.8,.3,1.15) both }
    `}</style>
  )
}

function ConfettiBurst() {
  const colors = ['#fd1d1d', '#fcb045', '#833ab4', '#16a34a', '#2563eb', '#f472b6']
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 1.1 + Math.random() * 0.9,
    size: 6 + Math.random() * 7,
    color: colors[i % colors.length],
    round: Math.random() > 0.5,
  })), [])
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: 0, left: `${p.left}%`,
          width: p.size, height: p.size, background: p.color,
          borderRadius: p.round ? '50%' : 2,
          animation: `gnsi-confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
        }} />
      ))}
    </div>
  )
}

function ReceiptSuccessModal({ count, absentCount, onClose }) {
  const isMobile = useIsMobile()
  const presentCount = count - absentCount
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,41,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'gnsi-backdrop-in .25s ease both',
      }}
    >

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: isMobile ? '100%' : 380,
          maxWidth: 400, background: '#fff', borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden',
          animation: 'gnsi-modal-pop .6s cubic-bezier(.34,1.56,.64,1) both',
        }}
      >
        <ConfettiBurst />

        <div style={{
          background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          padding: '30px 24px 22px', textAlign: 'center', position: 'relative',
        }}>
          <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 10px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.85)',
              animation: 'gnsi-pulse-ring 1.4s ease-out .3s infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(255,255,255,.18)', border: '3px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'gnsi-stamp .7s cubic-bezier(.34,1.56,.64,1) .15s both',
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40">
                <path d="M9 21 L17 29 L31 12" fill="none" stroke="#fff" strokeWidth="4.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="60" strokeDashoffset="60"
                  style={{ animation: 'gnsi-check-draw .5s ease-out .55s forwards' }} />
              </svg>
            </div>
          </div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: '.01em' }}>
            Attendance Saved!
          </div>
          <div style={{ color: 'rgba(255,255,255,.9)', fontSize: 12.5, marginTop: 3, fontWeight: 600 }}>
            {count} students recorded
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div style={{
              flex: 1, background: '#dcfce7', borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', animation: 'gnsi-slide-up-fade .4s ease .5s both',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d' }}>{presentCount}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.03em' }}>Present</div>
            </div>
            <div style={{
              flex: 1, background: absentCount ? '#fee2e2' : '#f1f5f9', borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', animation: 'gnsi-slide-up-fade .4s ease .6s both',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: absentCount ? '#dc2626' : '#94a3b8' }}>{absentCount}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: absentCount ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.03em' }}>Absent</div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%', minHeight: 46, borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #1a3a5c, #24527a)', color: '#fff',
              fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: '.02em',
              animation: 'gnsi-slide-up-fade .4s ease .7s both',
            }}
          >
            View Receipt &amp; Report ↓
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppReportPanel({ students, absentStudents, records, sessionInfo, counts }) {
  const isMobile = useIsMobile()
  const [copied, setCopied] = useState(false)

  const reportText = useMemo(
    () => buildAttendanceReportText({ students, absentStudents, records, sessionInfo, counts }),
    [students, absentStudents, records, sessionInfo, counts]
  )

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard API unavailable — fall back to manual select
    }
  }

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(reportText)}`, '_blank')
  }

  const downloadPDF = () => {
    const html = buildReportHTML({ students, absentStudents, records, sessionInfo, counts })
    const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes')
    if (!win) { alert('Allow pop-ups to generate the PDF report'); return }
    win.document.write(html)
    win.document.close()
  }

  const downloadJPEG = () => {
    const canvas = drawReportToCanvas({ students, absentStudents, records, sessionInfo, counts })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
    const fname = `Attendance_${sessionInfo.session_date || today()}_${(sessionInfo.class_name || sessionInfo.course || 'report').replace(/\s+/g, '_')}.jpg`
    downloadDataUrl(dataUrl, fname)
  }

  const scallops = 22
  const scallopSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='10' viewBox='0 0 100 10'><path d='M0,10 Q4,0 8,10 T16,10 T24,10 T32,10 T40,10 T48,10 T56,10 T64,10 T72,10 T80,10 T88,10 T96,10 T104,10 Z' fill='%23ffffff'/></svg>`

  return (
    <div className="gnsi-receipt-enter" style={{ animationDelay: '.05s', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div style={{
        background: '#fffdf8',
        borderRadius: '2px 2px 0 0',
        boxShadow: '0 10px 30px rgba(15,23,41,.14), 0 2px 8px rgba(15,23,41,.08)',
        position: 'relative', overflow: 'hidden',
        border: '1px solid #eee6d5', borderBottom: 'none',
      }}>
        {/* Receipt header strip */}
        <div style={{
          background: 'linear-gradient(135deg, #1a3a5c 0%, #24527a 100%)',
          padding: '18px 22px 16px', textAlign: 'center', color: '#fff', position: 'relative',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.15em', opacity: .8, marginBottom: 3 }}>GNSI · OFFICIAL</div>
          <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: '.01em' }}>Attendance Receipt</div>
          <div style={{ fontSize: 11.5, opacity: .85, marginTop: 4, fontWeight: 600 }}>
            {fmtDate(sessionInfo.session_date)}{sessionInfo.class_name ? ` · ${sessionInfo.class_name}` : ''}
          </div>
          <span style={{
            position: 'absolute', top: 10, right: 14, fontSize: 22,
            animation: 'gnsi-slide-up-fade .4s ease .3s both',
          }}>🧾</span>
        </div>

        {/* Ticker body */}
        <div style={{ padding: '18px 22px 8px' }}>
          <div style={{
            background: '#fffefb', border: '1px dashed #d8cfb8',
            borderRadius: 8, padding: '14px 16px',
            whiteSpace: 'pre-wrap', fontSize: 12.5, color: '#3d3527', lineHeight: 1.75,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            maxHeight: 360, overflowY: 'auto',
            animation: 'gnsi-slide-up-fade .45s ease .12s both',
          }}>
            {reportText}
          </div>
        </div>

        {/* Perforation */}
        <div style={{
          margin: '4px 0', height: 0, borderTop: '2.5px dashed #d8cfb8', position: 'relative',
        }}>
          <div style={{ position: 'absolute', left: -13, top: -11, width: 22, height: 22, borderRadius: '50%', background: T.gray50 }} />
          <div style={{ position: 'absolute', right: -13, top: -11, width: 22, height: 22, borderRadius: '50%', background: T.gray50 }} />
        </div>

        {/* Actions */}
        <div style={{
          padding: '14px 22px 20px', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
          animation: 'gnsi-slide-up-fade .45s ease .22s both',
        }}>
          <Btn variant="ghost" onClick={copyReport}>{copied ? '✓ Copied' : '📋 Copy report'}</Btn>
          <Btn variant="ghost" onClick={downloadJPEG}>🖼️ JPEG</Btn>
          <Btn variant="ghost" onClick={downloadPDF}>📄 PDF</Btn>
          <Btn variant="whatsapp" onClick={shareWhatsApp}>🟢 Share to WhatsApp</Btn>
        </div>
      </div>
      {/* Serrated bottom edge */}
      <div style={{
        height: 12, background: `repeating-linear-gradient(-45deg, #fffdf8 0, #fffdf8 7px, transparent 7px, transparent 14px)`,
        borderLeft: '1px solid #eee6d5', borderRight: '1px solid #eee6d5',
      }} />
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
      phone: s.phone || null, channel, message: msgFor(s),
      status: 'sent', sent_at: new Date().toISOString(),
    }))
    await supabase.from('parent_notifications').insert(rows)

    // Real WhatsApp send: wa.me requires a user gesture per tab it opens,
    // so browsers will block auto-opening one per student in a loop.
    // We open the first student's chat now (this click counts as the
    // gesture); each remaining student gets a manual "📲" button below.
    if (channel === 'whatsapp' || channel === 'both') {
      const first = students.find(s => s.phone)
      if (first) openWhatsApp(first.phone, msgFor(first))
    }

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
                    {s.phone ? `📞 ${s.phone}` : 'No phone on record'}
                  </div>
                </div>
                {s.phone && (channel === 'whatsapp' || channel === 'both') && (
                  <button
                    onClick={() => openWhatsApp(s.phone, msgFor(s))}
                    style={{
                      padding: '5px 10px', borderRadius: 7, border: 'none',
                      background: '#25D366', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    📲
                  </button>
                )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-.02em' }}>Sessions</div>
        <div style={{ fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>All recorded attendance sessions</div>
      </div>

      <ConsoleCard>
        <ConsoleCardHeader
          icon={<Icon.calendar size={16} />} title="Session log"
          subtitle={`${sessions.length} record${sessions.length===1?'':'s'}`}
        />

        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <ConsoleInput type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width: 'auto' }} />
          <ConsoleSelect value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="All">All courses</option>
            {COURSES.map(c => <option key={c}>{c}</option>)}
          </ConsoleSelect>
          {(dateFilter || courseFilter !== 'All') && (
            <ConsoleBtn small variant="subtle" onClick={() => { setDateFilter(''); setCourseFilter('All') }}>Clear filters</ConsoleBtn>
          )}
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.inkFaint, fontSize: 13 }}>Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.inkFaint, fontSize: 13 }}>No sessions found.</div>
          ) : sessions.map(sess => {
            const isOpen = expanded === sess.id
            const recs   = records[sess.id] || []
            const counts = { Present:0, Absent:0, Late:0, Leave:0 }
            if (isOpen) recs.forEach(r => { if (counts[r.status]!==undefined) counts[r.status]++ })
            const total = recs.length
            const pct   = total > 0 ? Math.round((counts.Present / total)*100) : null

            return (
              <div key={sess.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => expand(sess.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                  background: isOpen ? C.bg : C.surface,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontWeight: 650, color: C.ink, fontSize: 13.5 }}>{fmtDate(sess.session_date)}</span>
                      <CoursePill course={sess.course} />
                      {sess.subject_name && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.violet }}>{sess.subject_name}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.inkMuted }}>
                      {sess.teacher_name && `${sess.teacher_name}`}
                      {sess.subtype && ` · ${sess.subtype}`}
                      {sess.period_number && ` · P${sess.period_number}`}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(sess.id) }} style={{
                    fontSize: 12, padding: '5px 10px', borderRadius: 7, border: 'none',
                    background: C.redSoft, color: '#B91C1C', cursor: 'pointer', fontFamily: font, flexShrink: 0, fontWeight: 600,
                  }}>
                    Delete
                  </button>
                  <Icon.chevron size={13} />
                </div>

                {confirmDelete === sess.id && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{
                      background: C.redSoft, borderRadius: 8, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500 }}>Delete this session and all its records permanently?</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <ConsoleBtn small variant="default" onClick={() => setConfirmDelete(null)}>Cancel</ConsoleBtn>
                        <ConsoleBtn small variant="danger" onClick={() => doDelete(sess.id)}>Delete</ConsoleBtn>
                      </div>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 18px', background: C.bg }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      {STATUSES.map(s => counts[s] > 0 && (
                        <span key={s} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                          background: STATUS_TONE[s].bg, color: STATUS_TONE[s].color,
                        }}>
                          {counts[s]} {s}
                        </span>
                      ))}
                      {pct !== null && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, fontFamily: fontMono,
                          color: pct>=75?C.green:pct>=50?C.amber:C.red,
                        }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(200px,1fr))', gap: 6 }}>
                      {recs.map(r => {
                        const tone = STATUS_TONE[r.status] || STATUS_TONE.Present
                        return (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                            background: C.surface, border: `1px solid ${C.border}`,
                          }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.student_name}</div>
                              {r.gcc_no && <div style={{ fontSize: 10.5, color: C.inkFaint, fontFamily: fontMono }}>{r.gcc_no}</div>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: tone.color, flexShrink: 0 }}>{r.status}</span>
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
      </ConsoleCard>
    </div>
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
    const rows = data || []
    // Best-effort phone lookup by name — leave_requests only stores
    // student_name as plain text (no student_id link), so this matches
    // against the central students table's name field to find a parent
    // contact number for the WhatsApp button below.
    const names = [...new Set(rows.map(r => r.student_name).filter(Boolean))]
    if (names.length) {
      const { data: matches } = await supabase.from('students').select('name, phone').in('name', names)
      const phoneByName = Object.fromEntries((matches || []).map(m => [m.name, m.phone]))
      rows.forEach(r => { r.parent_phone = phoneByName[r.student_name] || null })
    }
    setLeaves(rows)
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
                      <div style={{ display:'flex', gap:8, flexWrap: 'wrap' }}>
                        <Btn small variant="success" onClick={() => updateLeave(lv.id, 'Approved')}>
                          ✓ Approve
                        </Btn>
                        <Btn small variant="danger" onClick={() => updateLeave(lv.id, 'Rejected')}>
                          ✕ Reject
                        </Btn>
                      </div>
                    )}
                    {lv.parent_phone && lv.status !== 'Pending' && (
                      <div style={{ display:'flex', gap:8, flexWrap: 'wrap', marginTop: lv.status !== 'Pending' ? 4 : 0 }}>
                        <Btn small variant="whatsapp" onClick={() => openWhatsApp(
                          lv.parent_phone,
                          `Dear Parent, the leave request for ${lv.student_name} (${fmtDate(lv.from_date)} → ${fmtDate(lv.to_date)}) has been ${lv.status.toLowerCase()}. — GNSI`
                        )}>
                          📲 Notify {lv.status}
                        </Btn>
                        {lv.status === 'Approved' && new Date(lv.to_date) < new Date() && (
                          <Btn small variant="whatsapp" onClick={() => openWhatsApp(
                            lv.parent_phone,
                            `Dear Parent, ${lv.student_name}'s leave ended on ${fmtDate(lv.to_date)}. Please ensure your ward attends class from today. — GNSI`
                          )}>
                            📲 Remind to Attend Class
                          </Btn>
                        )}
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

// ─── Tab: AWARDS (Best Student of the Month) ──────────────────
//
// Requires a one-time SQL migration (run once in Supabase):
//
//   create table if not exists monthly_awards (
//     id bigint generated always as identity primary key,
//     month text not null,                    -- 'YYYY-MM'
//     scope text not null,                     -- 'overall' or the course name
//     student_name text not null,
//     gcc_no text,
//     course text,
//     class_name text,
//     attendance_pct numeric not null,
//     finalized_by text,
//     created_at timestamptz default now(),
//     unique (month, scope)
//   );
//
// No other schema changes needed — winners are computed from the
// same attendance_sessions / attendance_records tables TabHome uses.

const CERT_BORDER = '#C9A24B' // brass gold, matches portal design language
const CERT_NAVY    = '#0B1E3D'

function monthOptions(count = 6) {
  const out = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${y}-${m}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

function drawAwardCertificateToCanvas({ studentName, gcc, course, className, monthLabel, pct, scopeLabel }) {
  const W = 1200, H = 850
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = CERT_BORDER
  ctx.lineWidth = 10
  ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.lineWidth = 2
  ctx.strokeRect(42, 42, W - 84, H - 84)

  const corners = [[42,42],[W-42,42],[42,H-42],[W-42,H-42]]
  corners.forEach(([x,y]) => {
    ctx.fillStyle = CERT_BORDER
    ctx.beginPath()
    ctx.moveTo(x, y-14); ctx.lineTo(x+14, y); ctx.lineTo(x, y+14); ctx.lineTo(x-14, y)
    ctx.closePath(); ctx.fill()
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = CERT_NAVY
  ctx.font = '700 20px Georgia, serif'
  ctx.fillText('GUIDANCE NAVODAYA & SAINIK INSTITUTE', W/2, 118)
  ctx.font = '400 13px Georgia, serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Khangabok · Thoubal · Manipur', W/2, 140)

  ctx.strokeStyle = CERT_BORDER
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(W/2 - 90, 158); ctx.lineTo(W/2 + 90, 158); ctx.stroke()

  ctx.font = '700 46px Georgia, serif'
  ctx.fillStyle = CERT_NAVY
  ctx.fillText('Certificate of Excellence', W/2, 230)

  ctx.font = '400 17px Georgia, serif'
  ctx.fillStyle = '#475569'
  ctx.fillText('Best Student of the Month — Attendance', W/2, 262)

  ctx.font = '400 16px Georgia, serif'
  ctx.fillStyle = '#334155'
  ctx.fillText('This is to certify that', W/2, 330)

  ctx.font = '700 44px Georgia, serif'
  ctx.fillStyle = CERT_NAVY
  ctx.fillText(studentName, W/2, 390)
  ctx.strokeStyle = CERT_BORDER
  ctx.lineWidth = 1.5
  const nameW = ctx.measureText(studentName).width
  ctx.beginPath(); ctx.moveTo(W/2 - nameW/2 - 10, 402); ctx.lineTo(W/2 + nameW/2 + 10, 402); ctx.stroke()

  ctx.font = '400 16px Georgia, serif'
  ctx.fillStyle = '#334155'
  const bodyLines = [
    `${gcc ? `GCC No. ${gcc} · ` : ''}${[course, className].filter(Boolean).join(' · ') || scopeLabel}`,
    `has achieved an outstanding attendance record of ${pct}% for ${monthLabel},`,
    `recognised as the ${scopeLabel} for the month.`,
  ]
  bodyLines.forEach((line, i) => ctx.fillText(line, W/2, 440 + i * 28))

  ctx.beginPath()
  ctx.fillStyle = '#f0fdf4'
  ctx.arc(W/2, 580, 56, 0, Math.PI*2)
  ctx.fill()
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#15803d'
  ctx.font = '700 30px Georgia, serif'
  ctx.fillText(`${pct}%`, W/2, 592)

  ctx.textAlign = 'left'
  ctx.font = '400 13px Georgia, serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText(`Issued: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}`, 90, H - 100)

  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W - 340, H - 110); ctx.lineTo(W - 90, H - 110); ctx.stroke()
  ctx.textAlign = 'center'
  ctx.font = '600 13px Georgia, serif'
  ctx.fillStyle = '#334155'
  ctx.fillText('Principal, GNSI', W - 215, H - 90)

  return canvas
}

function AwardCertificateModal({ award, onClose }) {
  const isMobile = useIsMobile()
  const canvasEl = useMemo(() => drawAwardCertificateToCanvas({
    studentName: award.student_name,
    gcc: award.gcc_no,
    course: award.course,
    className: award.class_name,
    monthLabel: fmtMonth(award.month),
    pct: award.attendance_pct,
    scopeLabel: award.scope === 'overall' ? 'Overall Best Student' : `Best Student · ${award.scope}`,
  }), [award])

  const download = () => {
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.95)
    downloadDataUrl(dataUrl, `Certificate_${award.student_name.replace(/\s+/g,'_')}_${award.month}.jpg`)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,41,.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, overflow: 'hidden',
        maxWidth: isMobile ? '100%' : 720, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,.35)',
      }}>
        <img src={canvasEl.toDataURL('image/jpeg', 0.92)} alt="Certificate" style={{ width: '100%', display: 'block' }} />
        <div style={{ padding: 16, display: 'flex', gap: 10, borderTop: `1.5px solid ${T.gray150}` }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</Btn>
          <Btn variant="primary" onClick={download} style={{ flex: 1, justifyContent: 'center' }}>⬇ Download</Btn>
        </div>
      </div>
    </div>
  )
}

function TabAwards({ isAdmin }) {
  const isMobile = useIsMobile()
  const [month, setMonth]           = useState(monthOptions()[0])
  const [computing, setComputing]   = useState(true)
  const [candidates, setCandidates] = useState({ overall: null, byBatch: [] })
  const [saved, setSaved]           = useState([])
  const [finalizing, setFinalizing] = useState(false)
  const [viewCert, setViewCert]     = useState(null)
  const [msg, setMsg]               = useState(null)

  const loadSaved = useCallback(async () => {
    const { data } = await supabase.from('monthly_awards').select('*').eq('month', month)
    setSaved(data || [])
  }, [month])

  useEffect(() => {
    const compute = async () => {
      setComputing(true)
      const monthStart = `${month}-01`
      const endDate = new Date(month.split('-')[0], Number(month.split('-')[1]), 0).toISOString().split('T')[0]

      const { data: sessions } = await supabase
        .from('attendance_sessions').select('id,course').gte('session_date', monthStart).lte('session_date', endDate)

      if (!sessions?.length) { setCandidates({ overall: null, byBatch: [] }); setComputing(false); return }

      const sessionCourse = {}
      sessions.forEach(s => { sessionCourse[s.id] = s.course })
      const ids = sessions.map(s => s.id)

      const { data: recs } = await supabase
        .from('attendance_records').select('student_name,gcc_no,class_name,status,session_id').in('session_id', ids)

      const map = {}
      recs?.forEach(r => {
        const key = r.student_name
        if (!map[key]) map[key] = {
          name: r.student_name, gcc: r.gcc_no, class_name: r.class_name,
          course: sessionCourse[r.session_id] || '—', Present: 0, total: 0,
        }
        if (r.status === 'Present') map[key].Present++
        map[key].total++
      })

      const rows = Object.values(map)
        .filter(r => r.total >= 3) // ignore students with too few marked sessions to be meaningful
        .map(r => ({ ...r, pct: Math.round((r.Present / r.total) * 100) }))

      const overall = rows.length ? rows.reduce((best, r) => r.pct > best.pct ? r : best, rows[0]) : null

      const byCourse = {}
      rows.forEach(r => {
        if (!byCourse[r.course]) byCourse[r.course] = r
        else if (r.pct > byCourse[r.course].pct) byCourse[r.course] = r
      })
      const byBatch = Object.entries(byCourse).map(([course, r]) => ({ course, ...r }))

      setCandidates({ overall, byBatch })
      setComputing(false)
    }
    compute()
    loadSaved()
  }, [month, loadSaved])

  const finalize = async (scope, candidate) => {
    if (!candidate) return
    setFinalizing(true)
    const { error } = await supabase.from('monthly_awards').upsert({
      month, scope,
      student_name: candidate.name, gcc_no: candidate.gcc,
      course: candidate.course, class_name: candidate.class_name,
      attendance_pct: candidate.pct,
    }, { onConflict: 'month,scope' })
    setFinalizing(false)
    if (error) { setMsg({ type: 'error', text: 'Could not save — ' + error.message }); return }
    setMsg({ type: 'success', text: `${scope === 'overall' ? 'Overall winner' : scope + ' winner'} finalized.` })
    loadSaved()
  }

  const savedFor = (scope) => saved.find(s => s.scope === scope)

  return (
    <Card>
      <CardHeader
        icon="🏆" title="Best Student of the Month" subtitle="Ranked by attendance percentage"
        accent={CERT_BORDER}
        right={
          <Select value={month} onChange={e => setMonth(e.target.value)} style={{ width: 160 }}>
            {monthOptions().map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </Select>
        }
      />
      <div style={{ padding: isMobile ? '14px 16px' : '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

        {computing ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.gray400, fontSize: 13 }}>Calculating rankings…</div>
        ) : (
          <>
            <div style={{
              borderRadius: 12, padding: 16, border: `1.5px solid ${CERT_BORDER}55`,
              background: 'linear-gradient(135deg, #fffdf5, #fef9ec)',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 28 }}>🥇</div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Overall winner
                </div>
                {candidates.overall ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{candidates.overall.name}</div>
                    <div style={{ fontSize: 12, color: T.gray500 }}>
                      {candidates.overall.course} · {candidates.overall.pct}% attendance
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: T.gray400, marginTop: 2 }}>No eligible students yet this month.</div>
                )}
              </div>
              {candidates.overall && isAdmin && !savedFor('overall') && (
                <Btn small variant="amber" disabled={finalizing} onClick={() => finalize('overall', candidates.overall)}>
                  Finalize award
                </Btn>
              )}
              {savedFor('overall') && (
                <Btn small variant="primary" onClick={() => setViewCert(savedFor('overall'))}>
                  🎓 View certificate
                </Btn>
              )}
            </div>

            <SectionDivider label="Batch winners" />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
              {candidates.byBatch.length === 0 && (
                <div style={{ fontSize: 13, color: T.gray400, gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>
                  No batch data for this month yet.
                </div>
              )}
              {candidates.byBatch.map(c => {
                const won = savedFor(c.course)
                return (
                  <div key={c.course} style={{
                    borderRadius: 10, border: `1.5px solid ${T.gray150}`, padding: 12,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <CoursePill course={c.course} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.gray500 }}>{c.pct}% attendance</div>
                    </div>
                    {isAdmin && !won && (
                      <Btn small variant="ghost" disabled={finalizing} onClick={() => finalize(c.course, c)}>Finalize</Btn>
                    )}
                    {won && (
                      <Btn small variant="primary" onClick={() => setViewCert(won)}>🎓</Btn>
                    )}
                  </div>
                )
              })}
            </div>

            {!isAdmin && (
              <div style={{ fontSize: 12, color: T.gray400, textAlign: 'center', marginTop: 4 }}>
                Only finalized certificates are shown to parents and students.
              </div>
            )}
          </>
        )}
      </div>
      {viewCert && <AwardCertificateModal award={viewCert} onClose={() => setViewCert(null)} />}
    </Card>
  )
}

// ─── Student 360 — cross-module monitoring page ───────────────
//
// Pulls attendance from tables already in use, and fee/discipline/
// hostel signals from placeholder tables in SCHEMA above. Every
// placeholder query is wrapped so a missing table just shows "—"
// instead of crashing the page — safe to ship before you've wired
// the real fee/discipline/hostel schema.

async function safeQuery(fn) {
  try {
    const { data, error } = await fn()
    if (error) return null
    return data
  } catch { return null }
}

// Paginated variant — adm_course_fees/discipline_records can exceed
// Supabase's 1000-row default cap once the institute has enough history;
// an unpaginated select() there would silently drop the newest rows,
// same bug class already fixed in Fees.jsx/Students.jsx.
async function safeQueryAll(table, select = '*') {
  const PAGE = 1000
  let from = 0, all = []
  try {
    while (true) {
      const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1)
      if (error) return all.length ? all : null
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return all
  } catch { return all.length ? all : null }
}

function useStudentSignals(monthStr) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [degraded, setDegraded] = useState({ fees: false, discipline: false, hostel: false })
  const [refreshKey, setRefreshKey] = useState(0)
  useAttendanceUpdatedListener(useCallback(() => setRefreshKey(k => k + 1), []))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const monthStart = `${monthStr}-01`
      const endDate = new Date(monthStr.split('-')[0], Number(monthStr.split('-')[1]), 0).toISOString().split('T')[0]

      const sessions = await safeQuery(() => supabase.from('attendance_sessions').select('id,course').gte('session_date', monthStart).lte('session_date', endDate)) || []
      const sessionCourse = {}
      sessions.forEach(s => { sessionCourse[s.id] = s.course })
      const ids = sessions.map(s => s.id)

      const recs = ids.length ? (await safeQuery(() => supabase.from('attendance_records').select('student_name,gcc_no,class_name,status,session_id').in('session_id', ids)) || []) : []

      const map = {}
      recs.forEach(r => {
        const key = r.gcc_no != null ? String(r.gcc_no) : r.student_name
        if (!map[key]) map[key] = {
          name: r.student_name, gcc: r.gcc_no, className: r.class_name,
          course: sessionCourse[r.session_id] || '—', present: 0, late: 0, total: 0,
        }
        if (r.status === 'Present') map[key].present++
        if (r.status === 'Late') map[key].late++
        map[key].total++
      })

      // Cross-module signals — fees/discipline can exceed 1000 rows, so use
      // the paginated fetch; hostel/sickbay stays small enough for safeQuery.
      const feeRows = await safeQueryAll(SCHEMA.fees.table)
      const discRows = await safeQueryAll(SCHEMA.discipline.table)
      const hostelRows = await safeQuery(() => supabase.from(SCHEMA.hostel.table).select('*'))

      if (cancelled) return
      setDegraded({ fees: feeRows === null, discipline: discRows === null, hostel: hostelRows === null })

      const feeByStudent = {}
      ;(feeRows || []).forEach(f => {
        if (f[SCHEMA.fees.status]) return // reverted=true — not a valid payment
        const k = String(f[SCHEMA.fees.studentKey])
        const payDate = f[SCHEMA.fees.dueDate]
        if (!payDate) return
        const daysSince = Math.max(0, Math.round((Date.now() - new Date(payDate)) / 86400000))
        // "Overdue days" here = days since last recorded course-fee payment.
        // adm_course_fees only stores payments made (no due-date column), so
        // this is a recency signal, not a true arrears calc — for a precise
        // arrears figure use Students.jsx's getEffectiveMonthlyDue logic.
        if (feeByStudent[k] === undefined || daysSince < feeByStudent[k]) feeByStudent[k] = daysSince
      })
      const discByStudent = {}
      ;(discRows || []).forEach(d => {
        const k = String(d[SCHEMA.discipline.studentKey])
        if (d[SCHEMA.discipline.status] !== 'resolved') discByStudent[k] = (discByStudent[k] || 0) + 1
      })
      const hostelByStudent = {}
      ;(hostelRows || []).forEach(h => {
        const k = String(h[SCHEMA.hostel.studentKey])
        if (h[SCHEMA.hostel.status] === 'active') hostelByStudent[k] = 'Sickbay'
      })

      const out = Object.entries(map).map(([key, r]) => {
        // Late counts as half-credit — matches Students.jsx's attendance
        // formula so the same student's % agrees across both modules.
        const pct = r.total > 0 ? Math.round(((r.present + r.late * 0.5) / r.total) * 100) : null
        const signals = {
          attendancePct: pct,
          disciplineOpen: discRows === null ? null : (discByStudent[key] || 0),
          feeOverdueDays: feeRows === null ? null : (feeByStudent[key] || 0),
          hostelStatus: hostelRows === null ? null : (hostelByStudent[key] || 'Normal'),
        }
        return { key, ...r, ...signals, risk: riskLevel(signals) }
      })

      out.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.risk] - order[b.risk]
      })

      if (!cancelled) { setRows(out); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [monthStr, refreshKey])

  return { rows, loading, degraded }
}

function RiskBadge({ level }) {
  const map = {
    high:   { bg: C.redSoft,   color: '#B91C1C', label: 'High risk' },
    medium: { bg: C.amberSoft, color: '#B45309', label: 'Watch' },
    low:    { bg: C.greenSoft, color: '#047857', label: 'On track' },
  }
  const m = map[level]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
      background: m.bg, color: m.color, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

function StudentRiskCard({ s }) {
  const isMobile = useIsMobile()
  const initials = s.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
      borderBottom: `1px solid ${C.border}`, flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: C.indigoSoft, color: C.indigo,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12.5, fontWeight: 700, flexShrink: 0,
      }}>{initials}</div>
      <div style={{ minWidth: 0, width: isMobile ? '100%' : 160, flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
        <div style={{ fontSize: 11.5, color: C.inkMuted }}>{s.course}{s.className ? ` · ${s.className}` : ''}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SignalRow attendancePct={s.attendancePct} disciplineOpen={s.disciplineOpen} feeOverdueDays={s.feeOverdueDays} hostelStatus={s.hostelStatus} size="sm" />
      </div>
      <RiskBadge level={s.risk} />
    </div>
  )
}

function Student360Page() {
  const isMobile = useIsMobile()
  const [month, setMonth] = useState(monthOptions()[0])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { rows, loading, degraded } = useStudentSignals(month)

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.risk !== filter) return false
    if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const counts = { high: rows.filter(r=>r.risk==='high').length, medium: rows.filter(r=>r.risk==='medium').length, low: rows.filter(r=>r.risk==='low').length }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '-.02em' }}>Student 360</div>
          <div style={{ fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>Attendance, discipline, fees, and hostel status in one view</div>
        </div>
        <Select value={month} onChange={e => setMonth(e.target.value)} style={{ width: 160 }}>
          {monthOptions().map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </Select>
      </div>

      {(degraded.fees || degraded.discipline || degraded.hostel) && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, background: C.amberSoft,
          border: `1px solid #FDE68A`, color: '#92400E', fontSize: 12.5,
        }}>
          {['fees','discipline','hostel'].filter(k => degraded[k]).join(', ')} data isn't connected yet — showing attendance only for those signals. Update the SCHEMA config once those tables are confirmed.
        </div>
      )}

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
        {[
          { key: 'high',   label: 'High risk',  count: counts.high,   color: C.red,   bg: C.redSoft },
          { key: 'medium', label: 'Watch',      count: counts.medium, color: C.amber, bg: C.amberSoft },
          { key: 'low',    label: 'On track',   count: counts.low,    color: C.green, bg: C.greenSoft },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)} style={{
            textAlign: 'left', border: `1px solid ${filter === s.key ? s.color : C.border}`,
            borderRadius: C.radius, padding: '14px 16px', background: filter === s.key ? s.bg : C.surface,
            cursor: 'pointer', fontFamily: font,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.inkMuted }}>{s.label}</div>
          </button>
        ))}
      </div>

      <ConsoleCard>
        <ConsoleCardHeader
          icon={<Icon.users size={16} />} title="Students" subtitle={`${filtered.length} shown${filter !== 'all' ? ` · filtered: ${filter}` : ''}`}
          right={<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name…" style={{ ...inputStyle(), width: 180 }} />}
        />
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.inkFaint, fontSize: 13 }}>Loading student signals…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.inkFaint, fontSize: 13 }}>No students match this view.</div>
        ) : (
          <div>{filtered.map(s => <StudentRiskCard key={s.key} s={s} />)}</div>
        )}
      </ConsoleCard>
    </div>
  )
}

// ─── Home v2 — SaaS dashboard shell wrapping existing TabHome data ─

function AlertFeed({ rows }) {
  const items = []
  const highRisk = rows.filter(r => r.risk === 'high')
  const feeOverdue = rows.filter(r => (r.feeOverdueDays||0) > 15)
  const discipline = rows.filter(r => (r.disciplineOpen||0) > 0)
  const sickbay = rows.filter(r => r.hostelStatus === 'Sickbay')
  const lowAttendance = rows.filter(r => r.attendancePct != null && r.attendancePct < 75)

  if (highRisk.length) items.push({ icon: Icon.bell, tone: 'bad', text: `${highRisk.length} student${highRisk.length>1?'s':''} flagged high risk this month` })
  if (lowAttendance.length) items.push({ icon: Icon.check, tone: 'warn', text: `${lowAttendance.length} student${lowAttendance.length>1?'s':''} below 75% attendance` })
  if (discipline.length) items.push({ icon: Icon.shield, tone: 'warn', text: `${discipline.length} student${discipline.length>1?'s':''} with open discipline entries` })
  if (feeOverdue.length) items.push({ icon: Icon.wallet, tone: 'bad', text: `${feeOverdue.length} student${feeOverdue.length>1?'s':''} fee-overdue more than 15 days` })
  if (sickbay.length) items.push({ icon: Icon.pulse, tone: 'warn', text: `${sickbay.length} student${sickbay.length>1?'s':''} currently in sickbay` })

  const toneColor = { bad: C.red, warn: C.amber, good: C.green }
  const toneBg    = { bad: C.redSoft, warn: C.amberSoft, good: C.greenSoft }

  return (
    <ConsoleCard>
      <ConsoleCardHeader icon={<Icon.bell size={16} />} title="Needs attention" subtitle="Cross-module alerts, updated live" />
      <div style={{ padding: items.length ? '4px 0' : '32px 20px' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: C.inkFaint, fontSize: 13 }}>Nothing needs attention right now.</div>
        )}
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: i < items.length-1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: toneBg[it.tone], color: toneColor[it.tone], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <it.icon size={13} />
            </div>
            <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{it.text}</div>
          </div>
        ))}
      </div>
    </ConsoleCard>
  )
}

function useAttendanceTrend(monthsBack = 6) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  useAttendanceUpdatedListener(useCallback(() => setRefreshKey(k => k + 1), []))
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const months = monthOptions(monthsBack).reverse()
      const out = []
      for (const m of months) {
        const monthStart = `${m}-01`
        const endDate = new Date(m.split('-')[0], Number(m.split('-')[1]), 0).toISOString().split('T')[0]
        const sessions = await safeQuery(() => supabase.from('attendance_sessions').select('id').gte('session_date', monthStart).lte('session_date', endDate)) || []
        const ids = sessions.map(s => s.id)
        let pct = null
        if (ids.length) {
          const recs = await safeQuery(() => supabase.from('attendance_records').select('status').in('session_id', ids)) || []
          if (recs.length) pct = Math.round((recs.filter(r=>r.status==='Present').length / recs.length) * 100)
        }
        out.push({ label: fmtMonth(m).split(' ')[0], pct: pct ?? 0 })
      }
      if (!cancelled) { setData(out); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [monthsBack, refreshKey])
  return { data, loading }
}

function useTodayStatusCounts() {
  const [counts, setCounts] = useState({ Present:0, Absent:0, Late:0, Leave:0 })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  useAttendanceUpdatedListener(useCallback(() => setRefreshKey(k => k + 1), []))
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const sessions = await safeQuery(() => supabase.from('attendance_sessions').select('id').eq('session_date', today())) || []
      const ids = sessions.map(s => s.id)
      const c = { Present:0, Absent:0, Late:0, Leave:0 }
      if (ids.length) {
        const recs = await safeQuery(() => supabase.from('attendance_records').select('status').in('session_id', ids)) || []
        recs.forEach(r => { if (c[r.status] !== undefined) c[r.status]++ })
      }
      if (!cancelled) { setCounts(c); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])
  return { counts, loading }
}

// ── Period 1 no-roll-call check ──────────────────────────────
// After 10:00 AM, any class/course whose timetable has a Period 1
// entry today but no matching attendance_sessions row yet is flagged.
// Notifies both admins (role='admin' in staff_profiles) and the
// specific teacher assigned to that Period 1 slot, de-duped per
// class+date via a local sessionStorage flag so it doesn't re-push
// on every render/refresh within the same day.
function usePeriod1Check() {
  const [missing, setMissing] = useState([])
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const CUTOFF_HOUR = 10
    const check = async () => {
      if (new Date().getHours() < CUTOFF_HOUR) { setChecked(true); return }
      const todayStr = today()
      const dedupeKey = `p1check_${todayStr}`
      const [{ data: ttEntries }, { data: todaySess }] = await Promise.all([
        supabase.from('timetable_entries').select('*').eq('day_name', todayDay()).eq('period_name', '1'),
        supabase.from('attendance_sessions').select('course, period_number').eq('session_date', todayStr),
      ])
      const markedCourses = new Set((todaySess || []).filter(s => String(s.period_number) === '1').map(s => s.course))
      const gaps = (ttEntries || []).filter(tt => !markedCourses.has(tt.course))
      setMissing(gaps)
      setChecked(true)

      if (gaps.length === 0) return
      let alreadyNotified = []
      try { alreadyNotified = JSON.parse(sessionStorage.getItem(dedupeKey) || '[]') } catch {}
      const newGaps = gaps.filter(g => !alreadyNotified.includes(`${g.course}|${g.class_name || ''}`))
      if (newGaps.length === 0) return

      try {
        const { data: admins } = await supabase.from('staff_profiles').select('id').ilike('role', 'admin')
        const teacherNames = [...new Set(newGaps.map(g => g.teacher_name).filter(Boolean))]
        const { data: teachers } = teacherNames.length
          ? await supabase.from('staff_profiles').select('id, name').in('name', teacherNames)
          : { data: [] }

        const summary = newGaps.map(g => `${g.course}${g.class_name ? ' ' + g.class_name : ''}`).join(', ')
        const title = `⏰ Period 1 not marked — ${newGaps.length} class${newGaps.length > 1 ? 'es' : ''}`
        const body = `No roll call logged for Period 1: ${summary}`

        await Promise.all([
          ...(admins || []).map(a => sendPushToStaffId(a.id, title, body, '/attendance')),
          ...newGaps.map(g => {
            const t = (teachers || []).find(t => t.name === g.teacher_name)
            return t ? sendPushToStaffId(t.id, title, `Your Period 1 class (${g.course}${g.class_name ? ' ' + g.class_name : ''}) hasn't been marked yet.`, '/attendance') : null
          }),
        ])

        sessionStorage.setItem(dedupeKey, JSON.stringify([
          ...alreadyNotified,
          ...newGaps.map(g => `${g.course}|${g.class_name || ''}`),
        ]))
      } catch (e) {
        console.error('usePeriod1Check notify failed:', e)
      }
    }
    check()
  }, [])

  return { missing, checked }
}

// Overview gets its own bold accent — a vivid indigo→violet identity that
// makes it visually distinct from Dashboard's teal/amber theme, even though
// both reuse the shared ConsoleCard chrome underneath.
const OV = {
  grad: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #A855F7 100%)',
  ink: '#312E81',
  soft: '#EEF2FF',
  ring: '#6366F1',
}

function HomeV2({ onNavigate }) {
  const isMobile = useIsMobile()
  const month = monthOptions()[0]
  const { rows, loading } = useStudentSignals(month)
  const { data: trendData, loading: trendLoading } = useAttendanceTrend(6)
  const { counts: todayCounts, loading: todayLoading } = useTodayStatusCounts()
  const { missing: period1Missing } = usePeriod1Check()

  const avgAttendance = rows.length ? Math.round(rows.reduce((s,r)=>s+(r.attendancePct||0),0)/rows.length) : 0
  const highRiskCount = rows.filter(r => r.risk === 'high').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="gnsi-fade-in">
      <ConsoleAnimStyles />

      {/* Bold hero banner — establishes Overview's own color identity up front */}
      <div style={{
        background: OV.grad, borderRadius: 16, padding: isMobile ? '18px 20px' : '22px 26px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        boxShadow: '0 8px 24px rgba(79,70,229,.25)',
      }}>
        <div>
          <div style={{ fontSize: isMobile ? 20 : 23, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>Overview</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{fmtDate(today())} · {todayDay()}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.16)',
          padding: '8px 14px', borderRadius: 999, backdropFilter: 'blur(4px)',
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: fontMono }}>{avgAttendance}%</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>avg. attendance</span>
        </div>
      </div>

      {period1Missing.length > 0 && (
        <div style={{
          background: C.redSoft, border: `1.5px solid #fecaca`, borderRadius: C.radius,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#991b1b' }}>
              {period1Missing.length} class{period1Missing.length > 1 ? 'es' : ''} missing Period 1 roll call
            </div>
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
              {period1Missing.map(g => `${g.course}${g.class_name ? ' ' + g.class_name : ''}`).join(', ')} — no attendance logged past 10:00 AM.
            </div>
          </div>
          <Btn small variant="danger" onClick={() => onNavigate('mark')}>Mark Now</Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        {loading ? [0,1,2,3].map(i => <SkeletonStatCard key={i} />) : [
          { label: 'Students tracked', value: rows.length, icon: Icon.users, color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Avg. attendance', value: `${avgAttendance}%`, icon: Icon.check, color: avgAttendance>=75?'#059669':'#D97706', bg: avgAttendance>=75?'#ECFDF5':'#FFFBEB' },
          { label: 'High risk', value: highRiskCount, icon: Icon.bell, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'On track', value: rows.filter(r=>r.risk==='low').length, icon: Icon.award, color: '#7C3AED', bg: '#F5F3FF' },
        ].map((k,i) => (
          <ConsoleCard key={i} style={{ padding: '16px 18px', borderTop: `3px solid ${k.color}` }} padded={false}>
            <div className="gnsi-hover-lift" style={{ borderRadius: C.radius }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.inkMuted }}>{k.label}</div>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <k.icon size={13} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, marginTop: 8 }}>{k.value}</div>
            </div>
          </ConsoleCard>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <ConsoleCard className="gnsi-hover-lift">
          <ConsoleCardHeader icon={<Icon.chart size={16} />} title="Attendance trend" subtitle="Average % by month, last 6 months" />
          <div style={{ padding: '14px 18px 6px' }}>
            {trendLoading ? <Skeleton w="100%" h={180} radius={10} /> : <TrendChart data={trendData} />}
          </div>
        </ConsoleCard>
        <ConsoleCard className="gnsi-hover-lift">
          <ConsoleCardHeader icon={<Icon.pulse size={16} />} title="Today's status" subtitle={fmtDate(today())} />
          <div style={{ padding: '18px', display: 'flex', justifyContent: 'center' }}>
            {todayLoading ? <Skeleton w={140} h={140} radius={999} /> : <StatusDonut counts={todayCounts} />}
          </div>
          <div style={{ padding: '0 18px 16px', display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {Object.entries(STATUS_TONE).map(([k,v]) => (
              <span key={k} style={{ fontSize: 10.5, fontWeight: 700, color: v.color, background: v.bg, padding: '3px 8px', borderRadius: 999 }}>
                {k}: {todayCounts[k] || 0}
              </span>
            ))}
          </div>
        </ConsoleCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        <AlertFeed rows={rows} />
        <ConsoleCard>
          <ConsoleCardHeader icon={<Icon.users size={16} />} title="Highest risk students" subtitle="Top 5 this month" />
          <div>
            {loading ? [0,1,2].map(i => <SkeletonRow key={i} />) : (
              <>
                {rows.filter(r=>r.risk!=='low').slice(0,5).map(s => (
                  <div key={s.key} className="gnsi-row-hover"><StudentRiskCard s={s} /></div>
                ))}
                {rows.filter(r=>r.risk!=='low').length === 0 && (
                  <div style={{ padding: 28, textAlign:'center', color: C.inkFaint, fontSize: 13 }}>No flagged students this month.</div>
                )}
              </>
            )}
          </div>
          <div style={{ padding: '12px 20px' }}>
            <ConsoleBtn variant="subtle" small onClick={() => onNavigate('student360')} style={{ width: '100%', justifyContent: 'center' }} className="gnsi-btn-press">
              View all students <Icon.chevron size={12} />
            </ConsoleBtn>
          </div>
        </ConsoleCard>
      </div>

      <ConsoleCard className="gnsi-hover-lift" style={{
        background: OV.grad, border: 'none', boxShadow: '0 6px 20px rgba(124,58,237,.22)',
      }}>
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.22)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><Icon.chart size={17} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Full attendance dashboard</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.82)', marginTop: 1 }}>Course breakdowns, weekday patterns, streaks and rankings</div>
            </div>
          </div>
          <button onClick={() => onNavigate('dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
            border: 'none', background: '#fff', color: '#4F46E5', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: font,
          }}>
            Open dashboard <Icon.chevron size={12} />
          </button>
        </div>
      </ConsoleCard>
    </div>
  )
}

// ─── Full Dashboard — heavy analytics page ─────────────────────
// Pulls a wider slice of attendance_sessions/attendance_records than
// HomeV2's summary cards: per-course trend lines, weekday pattern,
// a course radar comparison, and a top/bottom streak leaderboard.
// Refetches on the same gnsi:attendance-updated bus as everything else.

const WEEKDAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const COURSE_LINE_COLOR = {
  Sainik: '#1d4ed8', Navodaya: '#15803d', Foundation: '#b45309', 'Combined Course': '#6d28d9',
}

function useDashboardData(monthsBack = 6) {
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  useAttendanceUpdatedListener(useCallback(() => setRefreshKey(k => k + 1), []))

  const [courseTrend, setCourseTrend]   = useState([])   // [{ label, Sainik, Navodaya, ... }]
  const [weekdayData, setWeekdayData]   = useState([])   // [{ day, pct, sessions }]
  const [courseRadar, setCourseRadar]   = useState([])   // [{ course, pct }]
  const [statusSplit, setStatusSplit]   = useState({ Present:0, Absent:0, Late:0, Leave:0 })
  const [streaks,     setStreaks]       = useState({ top: [], bottom: [] })
  const [totals,      setTotals]        = useState({ sessions: 0, students: 0, avgPct: 0 })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const months = monthOptions(monthsBack).reverse()
      const rangeStart = `${months[0]}-01`
      const lastMonth = months[months.length - 1]
      const rangeEnd = new Date(lastMonth.split('-')[0], Number(lastMonth.split('-')[1]), 0).toISOString().split('T')[0]

      const sessions = await safeQuery(() => supabase
        .from('attendance_sessions').select('id,session_date,course').gte('session_date', rangeStart).lte('session_date', rangeEnd)) || []

      if (!sessions.length) {
        if (!cancelled) {
          setCourseTrend([]); setWeekdayData([]); setCourseRadar([])
          setStatusSplit({ Present:0, Absent:0, Late:0, Leave:0 })
          setStreaks({ top: [], bottom: [] }); setTotals({ sessions:0, students:0, avgPct:0 })
          setLoading(false)
        }
        return
      }

      const ids = sessions.map(s => s.id)
      const sessById = {}
      sessions.forEach(s => { sessById[s.id] = s })

      const recs = await safeQuery(() => supabase
        .from('attendance_records').select('student_name,gcc_no,status,session_id').in('session_id', ids)) || []

      // Monthly trend, split by course
      const byMonthCourse = {}
      // Weekday pattern (aggregate across whole range)
      const byWeekday = {}
      WEEKDAY_ORDER.forEach(d => { byWeekday[d] = { Present: 0, total: 0 } })
      // Course-wide totals
      const byCourse = {}
      // Overall status split
      const statusCounts = { Present:0, Absent:0, Late:0, Leave:0 }
      // Per-student, for streaks
      const byStudent = {}

      recs.forEach(r => {
        const sess = sessById[r.session_id]
        if (!sess) return
        const month = sess.session_date.slice(0,7)
        const course = sess.course || 'Other'
        const weekday = new Date(sess.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })

        if (!byMonthCourse[month]) byMonthCourse[month] = {}
        if (!byMonthCourse[month][course]) byMonthCourse[month][course] = { Present: 0, total: 0 }
        byMonthCourse[month][course].total++
        if (r.status === 'Present') byMonthCourse[month][course].Present++

        if (byWeekday[weekday]) {
          byWeekday[weekday].total++
          if (r.status === 'Present') byWeekday[weekday].Present++
        }

        if (!byCourse[course]) byCourse[course] = { Present: 0, total: 0 }
        byCourse[course].total++
        if (r.status === 'Present') byCourse[course].Present++

        if (statusCounts[r.status] !== undefined) statusCounts[r.status]++

        const key = r.gcc_no != null ? String(r.gcc_no) : r.student_name
        if (!byStudent[key]) byStudent[key] = { name: r.student_name, gcc: r.gcc_no, dates: [] }
        byStudent[key].dates.push({ date: sess.session_date, status: r.status })
      })

      // Course trend series
      const trend = months.map(m => {
        const row = { label: fmtMonth(m).split(' ')[0] }
        COURSES.forEach(c => {
          const cell = byMonthCourse[m]?.[c]
          row[c] = cell && cell.total > 0 ? Math.round((cell.Present / cell.total) * 100) : null
        })
        return row
      })

      // Weekday pattern
      const weekday = WEEKDAY_ORDER.map(d => ({
        day: d.slice(0,3),
        pct: byWeekday[d].total > 0 ? Math.round((byWeekday[d].Present / byWeekday[d].total) * 100) : 0,
        sessions: byWeekday[d].total,
      }))

      // Course radar
      const radar = COURSES.map(c => ({
        course: c,
        pct: byCourse[c] && byCourse[c].total > 0 ? Math.round((byCourse[c].Present / byCourse[c].total) * 100) : 0,
      }))

      // Streaks — current consecutive "Present" run per student, sorted desc/asc
      const withStreaks = Object.values(byStudent).map(s => {
        const sorted = [...s.dates].sort((a,b) => a.date > b.date ? -1 : 1)
        let streak = 0
        for (const d of sorted) { if (d.status === 'Present') streak++; else break }
        const totalMarked = s.dates.length
        const presentCount = s.dates.filter(d => d.status === 'Present').length
        const pct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0
        return { name: s.name, gcc: s.gcc, streak, pct, totalMarked }
      }).filter(s => s.totalMarked >= 3)

      const top = [...withStreaks].sort((a,b) => b.streak - a.streak || b.pct - a.pct).slice(0, 6)
      const bottom = [...withStreaks].sort((a,b) => a.pct - b.pct).slice(0, 6)

      const totalStudents = Object.keys(byStudent).length
      const overallPct = recs.length ? Math.round((statusCounts.Present / recs.length) * 100) : 0

      if (cancelled) return
      setCourseTrend(trend)
      setWeekdayData(weekday)
      setCourseRadar(radar)
      setStatusSplit(statusCounts)
      setStreaks({ top, bottom })
      setTotals({ sessions: sessions.length, students: totalStudents, avgPct: overallPct })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [monthsBack, refreshKey])

  return { loading, courseTrend, weekdayData, courseRadar, statusSplit, streaks, totals }
}

function MultiLineCourseTrend({ data, height = 260 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={false} tickLine={false} width={32} domain={[0,100]} />
        <Tooltip content={<ConsoleTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: font }} />
        {COURSES.map(c => (
          <Line key={c} type="monotone" dataKey={c} name={c} stroke={COURSE_LINE_COLOR[c]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function WeekdayBarChart({ data, height = 220 }) {
  if (!data?.some(d => d.sessions > 0)) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.inkFaint }} axisLine={false} tickLine={false} width={32} domain={[0,100]} />
        <Tooltip content={<ConsoleTooltip />} cursor={{ fill: C.bg }} />
        <Bar dataKey="pct" name="Attendance %" radius={[6,6,0,0]}>
          {data.map((d,i) => <Cell key={i} fill={d.pct>=75?CHART_TONE.good:d.pct>=50?CHART_TONE.warn:CHART_TONE.bad} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CourseRadarChart({ data, height = 260 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color: C.inkFaint, fontSize: 12.5 }}>No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={C.border} />
        <PolarAngleAxis dataKey="course" tick={{ fontSize: 11, fill: C.inkMuted }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9.5, fill: C.inkFaint }} />
        <Radar name="Attendance %" dataKey="pct" stroke={CHART_TONE.indigo} fill={CHART_TONE.indigo} fillOpacity={0.28} />
        <Tooltip content={<ConsoleTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function StatusSplitBars({ counts, height = 110 }) {
  const total = Object.values(counts).reduce((a,b)=>a+b,0)
  const rows = [
    { key: 'Present', color: CHART_TONE.good },
    { key: 'Absent',  color: CHART_TONE.bad },
    { key: 'Late',    color: CHART_TONE.warn },
    { key: 'Leave',   color: '#8B5CF6' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 0' }}>
      {rows.map(r => {
        const val = counts[r.key] || 0
        const pct = total > 0 ? Math.round((val/total)*100) : 0
        return (
          <div key={r.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: C.ink }}>{r.key}</span>
              <span style={{ fontFamily: fontMono, color: C.inkMuted }}>{val} · {pct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: r.color, borderRadius: 999, transition: 'width .4s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StreakLeaderboard({ title, rows, tone, icon }) {
  const toneColor = tone === 'good' ? CHART_TONE.good : CHART_TONE.bad
  const toneBg = tone === 'good' ? C.greenSoft : C.redSoft
  return (
    <ConsoleCard>
      <ConsoleCardHeader icon={icon} title={title} subtitle={tone === 'good' ? 'Longest active present streaks' : 'Lowest attendance this range'} />
      <div>
        {rows.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: C.inkFaint, fontSize: 12.5 }}>Not enough data yet.</div>
        )}
        {rows.map((s, i) => (
          <div key={s.gcc || s.name} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 7, background: toneBg, color: toneColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}>{i+1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
              {s.gcc && <div style={{ fontSize: 10.5, color: C.inkFaint, fontFamily: fontMono }}>GCC-{s.gcc}</div>}
            </div>
            {tone === 'good' ? (
              <span style={{ fontSize: 12.5, fontWeight: 800, color: toneColor, fontFamily: fontMono, flexShrink: 0 }}>🔥 {s.streak}d</span>
            ) : (
              <span style={{ fontSize: 12.5, fontWeight: 800, color: toneColor, fontFamily: fontMono, flexShrink: 0 }}>{s.pct}%</span>
            )}
          </div>
        ))}
      </div>
    </ConsoleCard>
  )
}

// Dashboard's own bold accent — teal→amber, deliberately distinct from
// Overview's indigo/violet so the two tabs read as different "zones" at
// a glance, not just the same page with a different title.
const DB = {
  grad: 'linear-gradient(135deg, #0D9488 0%, #0891B2 55%, #0369A1 100%)',
}

function DashboardPage() {
  const isMobile = useIsMobile()
  const [monthsBack, setMonthsBack] = useState(6)
  const { loading, courseTrend, weekdayData, courseRadar, statusSplit, streaks, totals } = useDashboardData(monthsBack)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="gnsi-fade-in">
      <ConsoleAnimStyles />

      {/* Bold hero banner — teal/amber identity distinct from Overview's indigo/violet */}
      <div style={{
        background: DB.grad, borderRadius: 16, padding: isMobile ? '18px 20px' : '22px 26px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        boxShadow: '0 8px 24px rgba(13,148,136,.25)',
      }}>
        <div>
          <div style={{ fontSize: isMobile ? 20 : 23, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>Dashboard</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>Deep analytics across courses, weekdays, and students</div>
        </div>
        <select value={monthsBack} onChange={e => setMonthsBack(Number(e.target.value))} style={{
          padding: '9px 14px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.18)',
          color: '#fff', fontWeight: 700, fontSize: 12.5, fontFamily: font, cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}>
          <option value={3} style={{ color: '#0f172a' }}>Last 3 months</option>
          <option value={6} style={{ color: '#0f172a' }}>Last 6 months</option>
          <option value={12} style={{ color: '#0f172a' }}>Last 12 months</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
        {loading ? [0,1,2].map(i => <SkeletonStatCard key={i} />) : [
          { label: 'Sessions logged', value: totals.sessions, icon: Icon.calendar, color: '#0D9488', bg: '#F0FDFA' },
          { label: 'Students tracked', value: totals.students, icon: Icon.users, color: '#0369A1', bg: '#F0F9FF' },
          { label: 'Overall attendance', value: `${totals.avgPct}%`, icon: Icon.check, color: totals.avgPct>=75?'#059669':'#D97706', bg: totals.avgPct>=75?'#ECFDF5':'#FFFBEB' },
        ].map((k,i) => (
          <ConsoleCard key={i} style={{ padding: '16px 18px', borderTop: `3px solid ${k.color}` }} padded={false}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.inkMuted }}>{k.label}</div>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={13} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, marginTop: 8 }}>{k.value}</div>
          </ConsoleCard>
        ))}
      </div>

      <ConsoleCard className="gnsi-hover-lift">
        <ConsoleCardHeader icon={<Icon.chart size={16} />} title="Attendance by course, over time" subtitle="Monthly % per course track" />
        <div style={{ padding: '14px 18px 8px' }}>
          {loading ? <Skeleton w="100%" h={260} radius={10} /> : <MultiLineCourseTrend data={courseTrend} />}
        </div>
      </ConsoleCard>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16, alignItems: 'start' }}>
        <ConsoleCard className="gnsi-hover-lift">
          <ConsoleCardHeader icon={<Icon.calendar size={16} />} title="Weekday pattern" subtitle="Which days attendance dips" />
          <div style={{ padding: '14px 18px 8px' }}>
            {loading ? <Skeleton w="100%" h={220} radius={10} /> : <WeekdayBarChart data={weekdayData} />}
          </div>
        </ConsoleCard>
        <ConsoleCard className="gnsi-hover-lift">
          <ConsoleCardHeader icon={<Icon.shield size={16} />} title="Course comparison" subtitle="Overall % per track, this range" />
          <div style={{ padding: '14px 18px 8px' }}>
            {loading ? <Skeleton w="100%" h={260} radius={10} /> : <CourseRadarChart data={courseRadar} />}
          </div>
        </ConsoleCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <ConsoleCard className="gnsi-hover-lift">
          <ConsoleCardHeader icon={<Icon.pulse size={16} />} title="Status split" subtitle="All records, this range" />
          <div style={{ padding: '16px 18px' }}>
            {loading ? <Skeleton w="100%" h={110} radius={10} /> : <StatusSplitBars counts={statusSplit} />}
          </div>
        </ConsoleCard>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
          <StreakLeaderboard title="Longest streaks" rows={streaks.top} tone="good" icon={<Icon.award size={16} />} />
          <StreakLeaderboard title="Needs attention" rows={streaks.bottom} tone="bad" icon={<Icon.bell size={16} />} />
        </div>
      </div>
    </div>
  )
}



// ─── STUDENT DATABASE TAB ──────────────────────────────────────
// Manages the central `students` table directly — the same table
// NotifyPanel already joins against for parent phone (s.students?.phone),
// TabLeave looks up by name for WhatsApp, and TabMark's roll call now reads
// live for its roster (course_enrollments was a separate, unsynced table
// that has been retired from that path — see fetchRoster in TabMark).
//
// FIXED: this tab's insert/update previously wrote a bare 6-field payload
// that didn't match Students.jsx's canonical 21-field shape — new students
// created here had status=null (invisible to every 'status=Active' filter
// elsewhere, e.g. Hostel.jsx), no batch/house/session/admission_date, and
// gcc_no as a raw string while Students.jsx writes it via parseInt() —
// producing a genuinely mixed-type gcc_no column across the two write
// paths. The payload below now sets the same safe defaults Students.jsx
// uses (status:'Active', hostel_type:'Day Scholar' fallback) and matches
// gcc_no's type. This tab still only collects a subset of fields — for
// full student records (house, batch, admission details) use the
// Students.jsx module; this stays a quick lookup/edit console.
const emptyStudentForm = { name: '', gcc_no: '', course: '', batch: '', class_name: '', phone: '', hostel_type: '' }

function TabStudentDB({ isAdmin }) {
  const isMobile = useIsMobile()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyStudentForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, mode: 'soft' | 'permanent' }
  const [confirmDropout, setConfirmDropout] = useState(null) // student id pending dropout confirmation
  const [viewMode, setViewMode] = useState('active') // 'active' | 'dropout' | 'trash' — trash is admin-only

  // REQUIRED SQL (run once): alter table students add column if not exists deleted_at timestamptz;
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('students').select('*').order('name')
    if (error) { setToast({ type: 'error', msg: error.message }); setLoading(false); return }
    setStudents(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Dropout is a status change, not a delete — a dropout student's row still
  // exists (deleted_at stays null) so their historical attendance/exam/fee
  // records remain intact and queryable; they're just excluded from the
  // Active view and, critically, from TabMark's roll-call roster (which
  // filters .eq('status','Active')), so they stop appearing in daily
  // attendance the moment they're marked here — no separate sync needed.
  const visibleStudents = students.filter(s => {
    if (s.deleted_at) return viewMode === 'trash'
    if (viewMode === 'trash') return false
    if (viewMode === 'dropout') return s.status === 'Dropout'
    return s.status !== 'Dropout'
  })

  const filtered = visibleStudents.filter(s => {
    if (courseFilter !== 'all' && s.course !== courseFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    // Phone is masked for non-admins (see render below), so it also
    // shouldn't be searchable by non-admins — otherwise search results
    // would leak numbers indirectly via matching.
    const searchable = isAdmin ? [s.name, s.gcc_no, s.batch, s.class_name, s.phone] : [s.name, s.gcc_no, s.batch, s.class_name]
    return searchable.some(v => (v || '').toString().toLowerCase().includes(q))
  })

  const openAdd = () => { setEditingId(null); setForm(emptyStudentForm); setShowForm(true) }
  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({ name: s.name || '', gcc_no: s.gcc_no != null ? String(s.gcc_no) : '', course: s.course || '', batch: s.batch || '', class_name: s.class_name || '', phone: s.phone || '', hostel_type: s.hostel_type || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setToast({ type: 'warn', msg: 'Student name is required.' }); return }
    // gcc_no must be parseInt'd here to match Students.jsx's canonical
    // insert — writing it as a string produced a genuinely mixed-type
    // gcc_no column when both write paths were live simultaneously.
    const gccParsed = form.gcc_no.trim() ? parseInt(form.gcc_no.trim(), 10) : null
    if (form.gcc_no.trim() && Number.isNaN(gccParsed)) { setToast({ type: 'warn', msg: 'GCC No. must be a number.' }); setSaving(false); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      gcc_no: gccParsed,
      course: form.course || null,
      // `batch` (Achiever/Leader/Umeed/etc.) is a DIFFERENT column from
      // `class_name` (free-text section, e.g. "9A") — see SCHEMA comment
      // above and TabMark's fetchRoster, which filters on `batch` for the
      // selected course. This form used to write the batch dropdown's
      // value into `class_name` instead of `batch`, so any student added
      // or edited here kept `batch` null/stale and silently vanished from
      // that batch's attendance roster in TabMark, even though they still
      // showed up fine in this Student DB list. Writing both columns here
      // keeps a student visible in Mark's roll call the moment they're
      // saved.
      batch: form.batch || null,
      class_name: form.class_name || null,
      phone: form.phone.trim() || null,
      hostel_type: form.hostel_type || 'Day Scholar',
      // Only set on create — Students.jsx defaults new students to
      // Active; without this, students added from this tab had
      // status=null and silently vanished from every view that
      // filters status='Active' (e.g. Hostel.jsx's roster).
      ...(editingId ? {} : { status: 'Active' }),
    }
    const { error } = editingId
      ? await supabase.from('students').update(payload).eq('id', editingId)
      : await supabase.from('students').insert([payload])
    setSaving(false)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: editingId ? 'Student updated.' : 'Student added.' })
    setShowForm(false)
    setForm(emptyStudentForm)
    setEditingId(null)
    load()
  }

  // Mark as Dropout — a status change (students.status = 'Dropout'), not a
  // delete. Row and history stay intact; the student simply stops appearing
  // in TabMark's roll call (which filters status='Active') and in the
  // Active view here. Broadcasting students-updated means any Mark tab
  // already open for this student's course drops them from the roster
  // immediately, without needing to reselect the course/batch.
  const handleMarkDropout = async (id) => {
    const { error } = await supabase.from('students').update({ status: 'Dropout' }).eq('id', id)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: 'Student marked as dropout — removed from active roll call.' })
    setConfirmDropout(null)
    broadcastStudentsUpdate({ type: 'dropout', student_id: id })
    load()
  }

  // Reactivate — undoes a dropout, restoring status to Active so the
  // student reappears in TabMark's roll call for their course/batch.
  const handleReactivate = async (id) => {
    const { error } = await supabase.from('students').update({ status: 'Active' }).eq('id', id)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: 'Student reactivated — back in active roll call.' })
    broadcastStudentsUpdate({ type: 'reactivate', student_id: id })
    load()
  }

  // Soft delete — available to all staff. Marks deleted_at instead of
  // removing the row, so an admin can review/restore before anything
  // is actually destroyed.
  const handleSoftDelete = async (id) => {
    const { error } = await supabase.from('students').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: 'Student moved to deleted (recoverable by admin).' })
    setConfirmDelete(null)
    broadcastStudentsUpdate({ type: 'delete', student_id: id })
    load()
  }

  // Restore — undoes a soft delete. Available to all staff, same as
  // soft delete itself, since it's the natural undo for that action.
  const handleRestore = async (id) => {
    const { error } = await supabase.from('students').update({ deleted_at: null }).eq('id', id)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: 'Student restored.' })
    broadcastStudentsUpdate({ type: 'restore', student_id: id })
    load()
  }

  // Permanent delete — admin only, actually removes the row. Guarded
  // again here (not just hidden in the UI) so it can't be triggered
  // by a non-admin even if they somehow reach this handler.
  const handlePermanentDelete = async (id) => {
    if (!isAdmin) { setToast({ type: 'error', msg: 'Only admins can permanently delete.' }); return }
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) { setToast({ type: 'error', msg: error.message }); return }
    setToast({ type: 'success', msg: 'Student permanently deleted.' })
    setConfirmDelete(null)
    broadcastStudentsUpdate({ type: 'permanent_delete', student_id: id })
    load()
  }

  return (
    <Card>
      <CardHeader
        icon="🎓"
        title="Student Database"
        subtitle={`${visibleStudents.length} ${viewMode} student${visibleStudents.length===1?'':'s'} · ${students.filter(s=>s.status==='Dropout'&&!s.deleted_at).length} dropout${isAdmin ? ` · ${students.filter(s=>s.deleted_at).length} in trash` : ''}`}
        accent={T.blue}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: T.gray100, borderRadius: 8, padding: 3 }}>
              {[
                { key: 'active', label: '👥 Active' },
                { key: 'dropout', label: `🚪 Dropout${students.filter(s=>s.status==='Dropout'&&!s.deleted_at).length ? ` (${students.filter(s=>s.status==='Dropout'&&!s.deleted_at).length})` : ''}` },
                ...(isAdmin ? [{ key: 'trash', label: '🗑 Trash' }] : []),
              ].map(v => (
                <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                  padding: '6px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: font, fontSize: 12, fontWeight: 700,
                  background: viewMode === v.key ? T.white : 'transparent',
                  color: viewMode === v.key ? (v.key === 'dropout' ? T.red : T.navy) : T.gray500,
                  boxShadow: viewMode === v.key ? T.shadowSm : 'none',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
            {viewMode === 'active' && <Btn small onClick={openAdd}>{showForm && !editingId ? '✕ Cancel' : '+ Add Student'}</Btn>}
          </div>
        }
      />
      <div style={{ padding: isMobile ? '12px 16px' : '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

        {viewMode === 'dropout' && (
          <div style={{ background: T.redSoft ?? '#fff1f2', border: `1px solid #fecdd3`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#be123c' }}>
            🚪 These students are excluded from Mark's roll call for their course/batch, but their attendance, exam, and fee history stays intact. Reactivate to bring them back into daily marking.
          </div>
        )}

        {!isAdmin && viewMode !== 'dropout' && (
          <div style={{ background: T.blueSoft, border: `1px solid #bfdbfe`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
            🔒 Parent contact numbers are hidden for non-admin accounts. Deleting a student here moves them to trash — only an admin can permanently remove a record.
          </div>
        )}

        {showForm && viewMode === 'active' && (
          <div style={{ background: T.gray50, border: `1.5px solid ${T.gray150}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
              {editingId ? '✏️ Edit Student' : '+ Add New Student'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
              <div>
                <Label required>Full Name</Label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student's full name" style={inputStyle()} />
              </div>
              <div>
                <Label>GCC No.</Label>
                <input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inputStyle()} />
              </div>
              <div>
                <Label>Course</Label>
                <Select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value, batch: '' }))}>
                  <option value="">Select course…</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Batch</Label>
                <Select value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} disabled={!form.course}>
                  <option value="">Select batch…</option>
                  {(form.course ? COURSE_STRUCTURE[form.course] || [] : []).map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>Class (optional)</Label>
                <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="e.g. 9A" style={inputStyle()} />
              </div>
              <div>
                <Label required>Parent Contact No.</Label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile number" style={inputStyle()} />
                {!isAdmin && <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>You can set this number, but it will display masked to you and other non-admin staff afterward.</div>}
              </div>
              <div>
                <Label>Hostel Type</Label>
                <Select value={form.hostel_type} onChange={e => setForm(f => ({ ...f, hostel_type: e.target.value }))}>
                  <option value="">Select…</option>
                  {HOSTEL_TYPES.map(h => <option key={h}>{h}</option>)}
                </Select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn variant="primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : editingId ? '✓ Save Changes' : '✓ Add Student'}</Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Btn>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAdmin ? "🔍 Search name, GCC no, class, phone…" : "🔍 Search name, GCC no, class…"}
            style={{ ...inputStyle(), flex: 2, minWidth: 200 }}
          />
          <Select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="all">All Courses</option>
            {COURSES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.gray400 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.gray400, fontSize: 13 }}>
            {viewMode === 'trash' ? 'Trash is empty.' : viewMode === 'dropout' ? 'No dropout students.' : 'No students found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 14px', borderRadius: 10,
                border: `1.5px solid ${s.deleted_at ? '#fecaca' : s.status === 'Dropout' ? '#fecdd3' : T.gray150}`,
                background: s.deleted_at ? '#fff8f8' : s.status === 'Dropout' ? '#fffbfb' : T.white,
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>
                    {s.name}
                    {s.deleted_at && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: T.red }}>DELETED {fmtDate(s.deleted_at.split('T')[0])}</span>}
                    {!s.deleted_at && s.status === 'Dropout' && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: T.red }}>🚪 DROPOUT</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.gray400, marginTop: 2 }}>
                    {s.gcc_no ? `GCC-${s.gcc_no}` : '—'} · {s.course || '—'}{s.batch ? ` · ${s.batch}` : ''}{s.class_name ? ` · ${s.class_name}` : ''}
                    {s.course && !s.batch && <span style={{ marginLeft: 6, fontWeight: 700, color: T.amber }}>⚠️ no batch — won't appear in Mark</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: s.phone ? T.gray500 : T.red, marginTop: 2 }}>
                    {isAdmin
                      ? (s.phone ? `📞 ${s.phone}` : '⚠️ No parent contact on record')
                      : (s.phone ? '📞 •••• •••••• (hidden)' : '⚠️ No parent contact on record')
                    }
                  </div>
                </div>

                {viewMode === 'trash' ? (
                  // Trash view: restore (any staff) or permanently delete (admin only)
                  confirmDelete?.id === s.id && confirmDelete.mode === 'permanent' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="danger" onClick={() => handlePermanentDelete(s.id)}>⚠️ Confirm Permanent Delete</Btn>
                      <Btn small variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="success" onClick={() => handleRestore(s.id)}>♻️ Restore</Btn>
                      {isAdmin && <Btn small variant="danger" onClick={() => setConfirmDelete({ id: s.id, mode: 'permanent' })}>🗑 Delete Forever</Btn>}
                    </div>
                  )
                ) : viewMode === 'dropout' ? (
                  // Dropout view: reactivate (back into roll call) or soft delete
                  confirmDelete?.id === s.id && confirmDelete.mode === 'soft' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="danger" onClick={() => handleSoftDelete(s.id)}>Confirm Delete</Btn>
                      <Btn small variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="success" onClick={() => handleReactivate(s.id)}>↩️ Reactivate</Btn>
                      <Btn small variant="ghost" onClick={() => openEdit(s)}>✏️ Edit</Btn>
                      <Btn small variant="danger" onClick={() => setConfirmDelete({ id: s.id, mode: 'soft' })}>🗑 Delete</Btn>
                    </div>
                  )
                ) : (
                  // Active view: edit, mark as dropout, or soft delete
                  confirmDelete?.id === s.id && confirmDelete.mode === 'soft' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="danger" onClick={() => handleSoftDelete(s.id)}>Confirm Delete</Btn>
                      <Btn small variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
                    </div>
                  ) : confirmDropout === s.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="danger" onClick={() => handleMarkDropout(s.id)}>⚠️ Confirm Dropout</Btn>
                      <Btn small variant="ghost" onClick={() => setConfirmDropout(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="ghost" onClick={() => openEdit(s)}>✏️ Edit</Btn>
                      <Btn small variant="amber" onClick={() => setConfirmDropout(s.id)}>🚪 Dropout</Btn>
                      <Btn small variant="danger" onClick={() => setConfirmDelete({ id: s.id, mode: 'soft' })}>🗑 Delete</Btn>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}


const NAV_ITEMS = [
  { key:'home',      label:'Overview',    icon: Icon.home },
  { key:'studentdb', label:'Student DB',  icon: Icon.users },
  { key:'student360',label:'Student 360', icon: Icon.users },
  { key:'mark',      label:'Mark',        icon: Icon.check },
  { key:'view',      label:'Sessions',    icon: Icon.calendar },
  { key:'dashboard', label:'Dashboard',   icon: Icon.chart },
  { key:'report',    label:'Reports',     icon: Icon.chart },
  { key:'leave',     label:'Leaves',      icon: Icon.leaf },
  { key:'awards',    label:'Awards',      icon: Icon.award },
]

const PAGE_META = {
  home:       { title: 'Overview' },
  studentdb:  { title: 'Student Database' },
  student360: { title: 'Student 360' },
  mark:       { title: 'Mark attendance' },
  view:       { title: 'Sessions' },
  dashboard:  { title: 'Dashboard' },
  report:     { title: 'Reports' },
  leave:      { title: 'Leaves' },
  awards:     { title: 'Awards' },
}

// Bottom tab bar for mobile — the 5 most-used destinations get a
// thumb-reachable icon+label button; everything else (Reports, Leaves,
// Awards) stays reachable via the "More" button in the top bar dropdown.
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 5)

function MobileBottomNav({ route, onNavigate, onMore, moreActive }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: C.sidebar, display: 'flex', justifyContent: 'space-around',
      alignItems: 'stretch', padding: '4px 2px calc(4px + env(safe-area-inset-bottom, 0px))',
      borderTop: `1px solid ${C.sidebarHover}`, boxShadow: '0 -6px 20px rgba(0,0,0,.22)',
    }}>
      {MOBILE_NAV_ITEMS.map(item => {
        const active = route === item.key
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 2, flex: 1,
              background: 'none', border: 'none', padding: '6px 2px', minHeight: 52,
              color: active ? '#fff' : C.sidebarText, fontFamily: font, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 30, height: 22, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? C.indigo : 'transparent', transition: 'background .12s',
            }}>
              <item.icon size={17} />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{item.label}</span>
          </button>
        )
      })}
      <button
        onClick={onMore}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2, flex: 1,
          background: 'none', border: 'none', padding: '6px 2px', minHeight: 52,
          color: moreActive ? '#fff' : C.sidebarText, fontFamily: font, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          width: 30, height: 22, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: moreActive ? C.indigo : 'transparent', transition: 'background .12s',
        }}>
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: moreActive ? 700 : 500, lineHeight: 1 }}>More</span>
      </button>
    </div>
  )
}

export default function Attendance({ currentUser, isAdmin }) {
  const isMobile  = useIsMobile()
  const [staff,       setStaff]       = useState([])
  const [markPrefill, setMarkPrefill] = useState(null)
  const [route, setRoute]             = useState('home')
  const [navOpen, setNavOpen]         = useState(false)
  const moreRoutes = useMemo(() => NAV_ITEMS.slice(5).map(i => i.key), [])
  const isMoreActive = isMobile && moreRoutes.includes(route)

  useEffect(() => {
    supabase.from('staff_profiles').select('id,name,designation').order('name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  useEffect(() => {
    if (!navOpen) return
    const close = () => setNavOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [navOpen])

  const navigateTo = (page, prefill = null) => {
    setMarkPrefill(prefill)
    setRoute(page)
    setNavOpen(false)
  }

  const renderPage = () => {
    switch (route) {
      case 'home':       return <HomeV2 onNavigate={navigateTo} />
      case 'studentdb':  return <TabStudentDB isAdmin={isAdmin} />
      case 'student360': return <Student360Page />
      case 'dashboard':  return <DashboardPage />
      case 'mark':       return <TabMark staff={staff} prefill={markPrefill} />
      case 'view':       return <TabView />
      case 'report':     return <TabReport />
      case 'leave':      return <TabLeave staff={staff} currentUser={currentUser} isAdmin={isAdmin} />
      case 'awards':     return <TabAwards isAdmin={isAdmin} />
      default:           return null
    }
  }

  const activeItem = NAV_ITEMS.find(i => i.key === route)

  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '12px 14px' : '12px 24px', background: C.sidebar,
        position: 'sticky', top: 0, zIndex: 50, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748B' }}>
              GNSI Portal
            </div>
            <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#fff', letterSpacing: '-.01em' }}>
              Attendance
            </div>
          </div>
        </div>

        {/* Nav dropdown trigger — on mobile this becomes the "More" menu
            for the tabs that don't fit in the bottom bar (Reports, Leaves,
            Awards); on desktop it remains the full primary nav. */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setNavOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 9, border: 'none',
            background: C.sidebarHover, color: '#fff', fontFamily: font,
            fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          }}>
            {activeItem && <activeItem.icon size={15} />}
            {activeItem?.label || 'Menu'}
            <Icon.chevron size={12} style={{ transform: navOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
          </button>

          {navOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
              boxShadow: C.shadowMd, minWidth: 200, padding: 6,
            }}>
              {(isMobile ? NAV_ITEMS.slice(5) : NAV_ITEMS).map(item => {
                const active = route === item.key
                return (
                  <button key={item.key} onClick={() => navigateTo(item.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 12px', borderRadius: 7, border: 'none',
                    background: active ? C.indigoSoft : 'transparent',
                    color: active ? C.indigo : C.ink,
                    fontFamily: font, fontWeight: 600, fontSize: 13.5,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.bg }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        padding: isMobile ? '16px 14px' : '28px 32px', maxWidth: 1200, margin: '0 auto',
        paddingBottom: isMobile ? 84 : 28,
      }}>
        {renderPage()}
      </div>

      {isMobile && (
        <MobileBottomNav
          route={route}
          onNavigate={navigateTo}
          onMore={() => setNavOpen(v => !v)}
          moreActive={isMoreActive}
        />
      )}
    </div>
  )
}
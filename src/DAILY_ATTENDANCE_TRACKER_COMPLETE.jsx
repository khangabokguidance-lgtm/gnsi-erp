/**
 * DAILY ATTENDANCE TRACKER v3 — All Loopholes Fixed
 *
 * FIX-D1  attendance_logs fetch now limited to last 3 months (was unbounded)
 * FIX-D2  BulkOperations.markAll now filters Active staff only
 * FIX-D3  ComplianceEngine wrapped in useMemo to prevent re-run on every render
 * FIX-D4  syncVerifiedCheckins loop guard — only sync verified rows, guard onAttendanceChange
 * FIX-D5  hr_records fetch failure handled gracefully (silent fallback, loading still resolves)
 * FIX-D6  ApplyLeaveModal staff dropdown now shows Active staff only
 */

import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react'
import { supabase } from './supabase'
import { PremiumStyles, PremiumHero, IconTabs, PIcon, PX } from './premiumUI'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { isAdminRole } from './roles'

// The Time Table, Leave and Notice modules live inside HR as sections, each behind its own
// permission key; each is loaded only when opened.
const Timetable = lazy(() => import('./Timetable'))
const Leave     = lazy(() => import('./Leave'))
const Notice    = lazy(() => import('./Notice'))
const MODULE_SECTIONS = [
  { key: 'timetable', perm: 'timetable' },
  { key: 'leavedesk', perm: 'leave' },
  { key: 'notice',    perm: 'notice' },
]
// HR's own sections ('dashboard' is HR home, the command centre)
const HR_TABS = ['dashboard', 'daily', 'absent', 'geo', 'bulk', 'leave', 'shift', 'risk', 'performance', 'compliance']
// leaves still waiting at some approval level
const PENDING_LEAVE = ['submitted', 'hod_approved', 'principal_approved']

const hrIcon = (paths) => function HRIcon({ size = 16 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
}
const HRI = {
  check:  hrIcon(<><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v3M16 2.5v3" /><path d="m8.5 15 2.3 2.3 4.7-4.8" /></>),
  away:   hrIcon(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6 1.6 0 3 .5 4.1 1.3" /><path d="m16 15 5 5m0-5-5 5" /></>),
  pin:    hrIcon(<><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>),
  stack:  hrIcon(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>),
  swap:   hrIcon(<><path d="M4 8h13l-3-3M20 16H7l3 3" /></>),
  grid:   hrIcon(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></>),
  target: hrIcon(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" /></>),
  trend:  hrIcon(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  bell:   hrIcon(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>),
}
// The launcher: every section as an icon tile on HR home, a chip bar inside a section
const TAB_GROUPS = [
  { label: 'Attendance', color: '#132a4f', tabs: [
    { id: 'daily',  label: 'Daily Attendance', icon: HRI.check, hint: 'Mark today, staff by staff' },
    { id: 'absent', label: 'Absentees',        icon: HRI.away,  hint: 'Most absences this month' },
    { id: 'geo',    label: 'Geo Check-in',     icon: HRI.pin,   hint: 'GPS-verified check-in' },
    { id: 'bulk',   label: 'Bulk Marking',     icon: HRI.stack, hint: 'Mark many at once' },
  ] },
  { label: 'Leave & duty', color: '#0f7a4c', tabs: [
    { id: 'leave',     label: 'Leave Approvals', icon: PIcon.leaf,  hint: 'Approve or reject leave' },
    { id: 'leavedesk', label: 'Leave Requests',  icon: PIcon.file,  hint: 'Balances, deductions, calendar' },
    { id: 'shift',     label: 'Shifts',          icon: HRI.swap,    hint: 'Duty slots and batches' },
    { id: 'timetable', label: 'Timetable',       icon: HRI.grid,    hint: 'Classes, cover, clashes' },
  ] },
  { label: 'Insights', color: '#a7771f', tabs: [
    { id: 'risk',        label: 'Absence Risk', icon: HRI.target,   hint: 'Serial and Friday patterns' },
    { id: 'performance', label: 'Performance',  icon: HRI.trend,    hint: 'Monthly scorecards' },
    { id: 'compliance',  label: 'Compliance',   icon: PIcon.scale,  hint: 'Leave rules and warnings' },
  ] },
  { label: 'Communication', color: '#b42318', tabs: [
    { id: 'notice', label: 'Notices', icon: HRI.bell, hint: 'Circulars and announcements' },
  ] },
]

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GEOFENCE = {
  schoolLocation: { lat: 24.62181, lng: 94.0193087 },
  allowedRadius: 50,
}

const SHIFT_SLOTS = [
  { id: 'morning_1',  label: 'Morning 1',  time: '7:20 AM – 8:10 AM' },
  { id: 'morning_2',  label: 'Morning 2',  time: '6:30 AM – 7:30 AM' },
  { id: 'morning_3',  label: 'Morning 3',  time: '7:30 AM – 8:20 AM' },
  { id: 'slot_1',     label: 'Slot 1',     time: '10:20 AM – 11:10 AM' },
  { id: 'slot_2',     label: 'Slot 2',     time: '11:10 AM – 12:00 PM' },
  { id: 'slot_3',     label: 'Slot 3',     time: '12:00 PM – 12:50 PM' },
  { id: 'slot_4',     label: 'Slot 4',     time: '1:20 PM – 2:10 PM' },
  { id: 'slot_5',     label: 'Slot 5',     time: '2:10 PM – 2:55 PM' },
  { id: 'slot_6',     label: 'Slot 6',     time: '2:55 PM – 3:40 PM' },
  { id: 'evening_1',  label: 'Evening 1',  time: '5:30 PM – 6:30 PM' },
  { id: 'evening_2',  label: 'Evening 2',  time: '6:35 PM – 7:35 PM' },
  { id: 'evening_3',  label: 'Evening 3',  time: '7:40 PM – 8:30 PM' },
  { id: 'self_study', label: 'Self Study', time: '9:30 PM – 10:15 PM' },
]

const BATCHES = [
  'Achiever A','Achiever B','Leader A','Leader B',
  'Champion A','Champion B','Lakshya A','Lakshya B',
  'Umeed A','Umeed B','Udaan','Pragati',
]

const SUBJECTS = [
  'Mathematics I','Mathematics II','Mathematics Drill',
  'Science','GK','Grammar','Vocabulary','Reasoning',
  'Mental Ability','Meitei Mayek','Hindi','Passage','Self Studies',
]

const LEAVE_MONTHLY_LIMIT = 1

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// local calendar date (toISOString gives yesterday's date before 5:30 AM in India)
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => localISO(new Date())

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const addDays = (date, days) => {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

const monthsSince = (dateStr) => {
  if (!dateStr) return 0
  const s = new Date(dateStr), n = new Date()
  return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth())
}

const isDay = (dateStr, d) => new Date(dateStr).getDay() === d

const getWorkingDaysInMonth = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number)
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    if (d.getDay() !== 0) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// FIX-D1: date cutoff helper — 3 months back
const threeMonthsAgo = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)
}

const calculateDistance = (loc1, loc2) => {
  const R = 6371000
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const verifyGeolocation = (lat, lng) => {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return { verified: false, distance: null, message: 'No GPS data' }
  }
  const distance = Math.round(calculateDistance(GEOFENCE.schoolLocation, { lat, lng }))
  return {
    verified: distance <= GEOFENCE.allowedRadius,
    distance,
    message: distance <= GEOFENCE.allowedRadius
      ? `In boundary (${distance}m)`
      : `Outside boundary (${distance}m away)`,
  }
}

const detectSerialAbsence = (logs, staffId, windowDays = 7, threshold = 3) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const recent = logs
    .filter(l => l.staff_id === staffId && new Date(l.date) >= cutoff)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  let consecutive = 0
  for (const log of recent) {
    if (log.status === 'Absent') consecutive++
    else break
  }
  return consecutive >= threshold ? consecutive : 0
}

const detectFridayPattern = (logs, staffId, months = 3) => {
  return logs.filter(
    l => l.staff_id === staffId && isDay(l.date, 5) && monthsSince(l.date) <= months && l.status === 'Absent'
  ).length
}

const countAbsencesInMonth = (logs, staffId, monthStr) => {
  const [year, month] = monthStr.split('-').map(Number)
  return logs.filter(l => {
    const d = new Date(l.date)
    return l.staff_id === staffId && d.getFullYear() === year && d.getMonth() === month - 1 && l.status === 'Absent'
  }).length
}

const isOnTime = (checkInTime) => {
  const t = new Date(checkInTime)
  return t.getHours() < 9 || (t.getHours() === 9 && t.getMinutes() === 0)
}

const calculateScorecard = (staffId, logs, warnings, month) => {
  const [year, mon] = month.split('-').map(Number)
  const monthLogs = logs.filter(l => {
    const d = new Date(l.date)
    return l.staff_id === staffId && d.getFullYear() === year && d.getMonth() === mon - 1
  })
  const workingDays = getWorkingDaysInMonth(month)
  const present = monthLogs.filter(l => l.status === 'Present').length
  const onTime = monthLogs.filter(l => l.check_in_time && isOnTime(l.check_in_time)).length
  const attendanceScore = workingDays ? Math.round((present / workingDays) * 100) : 0
  const punctualityScore = workingDays ? Math.round((onTime / workingDays) * 100) : 0
  const disciplineScore = Math.max(100 - (warnings?.length || 0) * 10, 0)
  const overallScore = Math.round(attendanceScore * 0.5 + punctualityScore * 0.3 + disciplineScore * 0.2)
  return {
    staffId, month, attendanceScore, punctualityScore, disciplineScore, overallScore,
    grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : 'D',
    recommendation: overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : 'Needs Improvement',
  }
}

const absenceRiskModel = {
  calculateRisk(staffId, logs) {
    const serial = Math.min(detectSerialAbsence(logs, staffId) / 5, 1)
    const friday = Math.min(detectFridayPattern(logs, staffId, 2) / 4, 1)
    const riskScore = serial * 0.55 + friday * 0.45
    return {
      staffId,
      riskScore: Math.min(riskScore, 1),
      riskLevel: riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW',
      factors: { serial, friday },
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────

// Premium look for every HR section: ivory cards, navy/gold controls, Fraunces titles.
// The section components keep their inline styles; these tokens and HR_CSS give them the portal finish.
const S = {
  card: { backgroundColor: '#fff', borderRadius: 18, padding: '18px 20px', border: `1px solid ${PX.line}`, boxShadow: '0 1px 2px rgba(19,42,79,.05),0 14px 32px -24px rgba(19,42,79,.4)', marginBottom: 16 },
  select: { padding: '10px 12px', borderRadius: 11, border: `1px solid ${PX.line2}`, fontSize: 13.5, backgroundColor: '#fff', color: PX.ink, width: '100%' },
  input: { padding: '10px 12px', borderRadius: 11, border: `1px solid ${PX.line2}`, fontSize: 13.5, color: PX.ink, width: '100%', boxSizing: 'border-box' },
  btn: (active = true, color = PX.navy) => ({
    padding: '10px 16px', borderRadius: 11, border: 'none',
    cursor: active ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13.5,
    background: !active ? PX.line2 : color === PX.navy ? `linear-gradient(180deg,${PX.navy2},${PX.navy})` : color,
    color: 'white', boxShadow: active ? '0 6px 14px -8px rgba(19,42,79,.6)' : 'none',
  }),
  pill: (active, bg = PX.navy) => ({
    padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
    border: `1px solid ${active ? 'transparent' : PX.line}`,
    background: active ? (bg === PX.navy ? `linear-gradient(180deg,${PX.navy2},${PX.navy})` : bg) : '#fff',
    color: active ? 'white' : PX.ink2, boxShadow: active ? '0 6px 14px -8px rgba(19,42,79,.6)' : 'none',
  }),
}

const HR_CSS = `
.hr-root{font-family:${PX.sans};color:${PX.ink}}
.hr-root h2,.hr-root h3{font-family:${PX.serif};font-weight:600;letter-spacing:-.005em}
.hr-root button{font-family:inherit;transition:transform .12s,box-shadow .15s,background .15s,filter .15s}
.hr-root button:not(:disabled):hover{filter:brightness(1.04)}
.hr-root button:not(:disabled):active{transform:translateY(1px)}
.hr-root input:focus,.hr-root select:focus,.hr-root textarea:focus{outline:none;border-color:${PX.gold}!important;box-shadow:0 0 0 4px rgba(184,146,58,.16)!important}
.hr-root table{border-collapse:separate;border-spacing:0}
.hr-root th{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:${PX.sub}}
.hr-num{font-family:${PX.serif};font-variant-numeric:tabular-nums}
.hr-grid{display:grid;gap:16px;grid-template-columns:repeat(12,minmax(0,1fr))}
.hr-c4{grid-column:span 4}.hr-c5{grid-column:span 5}.hr-c6{grid-column:span 6}.hr-c7{grid-column:span 7}.hr-c8{grid-column:span 8}.hr-c12{grid-column:span 12}
.hr-panel{background:#fff;border:1px solid ${PX.line};border-radius:18px;padding:18px 20px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 14px 32px -24px rgba(19,42,79,.4);min-width:0}
.hr-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold}}
.hr-title{font-family:${PX.serif};font-size:18px;font-weight:600;color:${PX.ink};margin:2px 0 0}
.hr-sub{font-size:12px;color:${PX.sub};margin-top:2px}
.hr-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px}
.hr-row:hover{background:${PX.tint}}
.hr-link{background:none;border:none;padding:0;cursor:pointer;color:${PX.gold};font:700 12.5px ${PX.sans}}
.hr-link:hover{text-decoration:underline}
.hr-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.hr-legend{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:none;background:none;border-radius:10px;cursor:pointer;text-align:left;color:${PX.ink2};font-size:13px}
.hr-legend:hover{background:${PX.tint}}
.hr-legend i{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.hr-legend b{margin-left:auto;font-family:${PX.serif};font-size:16px;color:${PX.ink};font-variant-numeric:tabular-nums}
.hr-bars{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:8px}
.hr-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;height:100%;justify-content:flex-end}
.hr-bar span{width:100%;max-width:30px;border-radius:8px 8px 4px 4px;background:linear-gradient(180deg,#2f4f86,${PX.navy});box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.hr-bar.low span{background:linear-gradient(180deg,#e0a33a,${PX.warn})}
.hr-bar.today span{background:linear-gradient(180deg,#e2c57e,${PX.gold})}
.hr-bar small{font-size:10px;color:${PX.faint};font-weight:700}
.hr-stack{display:flex;height:9px;border-radius:99px;overflow:hidden;background:${PX.cream}}
.hr-stack span{display:block;height:100%}
.hr-empty{padding:26px 12px;text-align:center;color:${PX.faint};font-size:13px}
@media (max-width:900px){.hr-c4,.hr-c5,.hr-c6,.hr-c7,.hr-c8{grid-column:span 12}}
@media (prefers-reduced-motion:reduce){.hr-root *{transition:none!important}}
`

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const dot = { error: '#f87171', success: '#4ade80', info: PX.goldLt }[type] || PX.goldLt
  return (
    <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10, background: `linear-gradient(180deg,${PX.navy2},${PX.navyDeep})`, color: '#fff',
      padding: '12px 18px', borderRadius: 14, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: PX.sans,
      border: '1px solid rgba(233,217,176,.35)', boxShadow: '0 18px 40px -16px rgba(14,32,63,.7)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 0 4px ${dot}33` }} />
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'error') => setToast({ message, type }), [])
  const hide = useCallback(() => setToast(null), [])
  const ToastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null
  return { show, ToastEl }
}

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${PX.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
          background: PX.goldBg, border: `1px solid ${PX.goldLine}` }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: PX.serif, fontSize: 19, fontWeight: 600, color: PX.ink, margin: 0, lineHeight: 1.2 }}>{title}</h2>
          {subtitle && <p style={{ color: PX.sub, fontSize: 12, margin: '3px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

const initialsOf = (name) => String(name || '?').replace(/^(sir|madam|mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

function StaffAvatar({ name, size = 36 }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(160deg,${PX.navy2},${PX.navyDeep})`, boxShadow: `0 0 0 2px #fff,0 0 0 3px ${PX.goldLt}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: PX.goldLt,
      fontWeight: 700, fontSize: size * 0.36, fontFamily: PX.serif, letterSpacing: '.02em' }}>
      {initialsOf(name)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMMAND CENTRE (HR home) — today's attendance, the last two weeks,
// who is away, departments, and what needs a decision. Built from the logs
// HR already loads, so it stays in step when attendance is marked.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TONES = [
  { key: 'Present',    label: 'Present',    color: PX.ok },
  { key: 'Late',       label: 'Late',       color: '#c98a12' },
  { key: 'Leave',      label: 'On leave',   color: '#2f4f86' },
  { key: 'Absent',     label: 'Absent',     color: PX.bad },
  { key: 'Not Marked', label: 'Not marked', color: '#d9d2c2' },
]

// Today's counts per status for the given staff
function dayCounts(staff, dayLogs) {
  const byStaff = new Map(dayLogs.map(l => [l.staff_id, l.status]))
  const c = { Present: 0, Late: 0, Leave: 0, Absent: 0, 'Not Marked': 0 }
  staff.forEach(s => {
    const st = byStaff.get(s.id)
    c[c[st] != null && st !== 'Not Marked' ? st : 'Not Marked']++
  })
  return c
}

function AttendanceRing({ counts, total, size = 148 }) {
  const r = 56, C = 2 * Math.PI * r
  let offset = 0
  const inPct = total ? Math.round(((counts.Present + counts.Late) / total) * 100) : 0
  return (
    <svg width={size} height={size} viewBox="0 0 148 148" role="img" aria-label={`${inPct}% of staff in today`}>
      <circle cx="74" cy="74" r={r} fill="none" stroke={PX.cream} strokeWidth="14" />
      {total > 0 && STATUS_TONES.map(t => {
        const len = (counts[t.key] / total) * C
        const el = len > 0 && (
          <circle key={t.key} cx="74" cy="74" r={r} fill="none" stroke={t.color} strokeWidth="14"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 74 74)" />
        )
        offset += len
        return el
      })}
      <text x="74" y="72" textAnchor="middle" style={{ font: `600 30px ${PX.serif}`, fill: PX.ink }}>{inPct}%</text>
      <text x="74" y="93" textAnchor="middle" style={{ font: `700 9.5px ${PX.sans}`, letterSpacing: '.12em', fill: PX.sub }}>IN TODAY</text>
    </svg>
  )
}

function HRCommandCentre({ staff, logs, records, pendingLeaves, onOpen }) {
  const today = todayStr()
  const byId = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff])
  const todayLogs = useMemo(() => logs.filter(l => l.date === today), [logs, today])
  const counts = useMemo(() => dayCounts(staff, todayLogs), [staff, todayLogs])

  // the last 14 working days (Sundays off), oldest first
  const trend = useMemo(() => {
    const out = []
    for (let d = new Date(); out.length < 14; d = addDays(d, -1)) {
      if (d.getDay() === 0) continue
      const iso = localISO(d)
      const dl = logs.filter(l => l.date === iso)
      const inCount = dl.filter(l => l.status === 'Present' || l.status === 'Late').length
      out.unshift({ iso, marked: dl.length, pct: staff.length ? Math.round((inCount / staff.length) * 100) : 0, day: d.toLocaleDateString('en-IN', { weekday: 'narrow' }) })
    }
    return out
  }, [logs, staff.length])
  const markedDays = trend.filter(t => t.marked)
  const avg = markedDays.length ? Math.round(markedDays.reduce((a, t) => a + t.pct, 0) / markedDays.length) : null

  const away = useMemo(() => todayLogs
    .filter(l => l.status === 'Absent' || l.status === 'Leave')
    .map(l => ({ ...l, person: byId.get(l.staff_id) }))
    .filter(l => l.person)
    .sort((a, b) => a.status.localeCompare(b.status) || a.person.name.localeCompare(b.person.name)), [todayLogs, byId])

  const depts = useMemo(() => {
    const m = new Map()
    const st = new Map(todayLogs.map(l => [l.staff_id, l.status]))
    staff.forEach(s => {
      const k = s.department || 'Other'
      if (!m.has(k)) m.set(k, { dept: k, total: 0, Present: 0, Late: 0, Leave: 0, Absent: 0 })
      const row = m.get(k); row.total++
      const x = st.get(s.id); if (row[x] != null && x !== 'total') row[x]++
    })
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [staff, todayLogs])

  const alerts = useMemo(() => {
    const list = []
    records.forEach(r => {
      const left = daysUntil(r.probation_end_date)
      if (r.employment_status === 'Probation' && left != null && left <= 14) {
        list.push({ tone: PX.warn, icon: '⏳', who: byId.get(r.staff_id)?.name || 'Staff member', what: left < 0 ? `Probation ended ${-left} days ago — confirm or extend` : `Probation ends in ${left} day${left === 1 ? '' : 's'}` })
      }
    })
    staff.forEach(s => {
      const run = detectSerialAbsence(logs, s.id)
      if (run) list.push({ tone: PX.bad, icon: '🚩', who: s.name, what: `Absent ${run} days in a row` })
      const fri = detectFridayPattern(logs, s.id, 3)
      if (fri >= 3) list.push({ tone: PX.warn, icon: '📆', who: s.name, what: `${fri} Friday absences in 3 months` })
    })
    return list
  }, [records, staff, logs, byId])

  const total = staff.length
  return (
    <div className="hr-grid">
      <section className="hr-panel hr-c5">
        <div className="hr-eyebrow">Today · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h3 className="hr-title">Staff attendance</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <AttendanceRing counts={counts} total={total} />
          <div style={{ flex: 1, minWidth: 170 }}>
            {STATUS_TONES.map(t => (
              <button key={t.key} type="button" className="hr-legend" onClick={() => onOpen('daily')}>
                <i style={{ background: t.color }} />{t.label}<b>{counts[t.key]}</b>
              </button>
            ))}
          </div>
        </div>
        {counts['Not Marked'] > 0 && (
          <button type="button" onClick={() => onOpen('daily')} style={{ ...S.btn(true), width: '100%', marginTop: 12 }}>
            Mark the {counts['Not Marked']} not marked yet →
          </button>
        )}
      </section>

      <section className="hr-panel hr-c7">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div className="hr-eyebrow">Last 14 working days</div>
            <h3 className="hr-title">Attendance trend</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="hr-num" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{avg == null ? '—' : `${avg}%`}</div>
            <div className="hr-sub">average in</div>
          </div>
        </div>
        <div className="hr-bars" role="img" aria-label="Share of staff in, per day">
          {trend.map(t => (
            <div key={t.iso} className={'hr-bar' + (t.iso === today ? ' today' : t.marked && t.pct < 75 ? ' low' : '')} title={`${fmtDate(t.iso)} · ${t.marked ? `${t.pct}% in` : 'not marked'}`}>
              <span style={{ height: t.marked ? `${Math.max(t.pct, 3)}%` : 3, opacity: t.marked ? 1 : .25 }} />
              <small>{t.day}</small>
            </div>
          ))}
        </div>
        <div className="hr-sub" style={{ marginTop: 8 }}>Gold is today · amber is below 75% · faint days were not marked</div>
      </section>

      <section className="hr-panel hr-c6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <div className="hr-eyebrow">Away today</div>
            <h3 className="hr-title">{away.length ? `${away.length} staff not in` : 'Everyone is in'}</h3>
          </div>
          <button type="button" className="hr-link" onClick={() => onOpen('timetable')}>Arrange cover →</button>
        </div>
        <div style={{ marginTop: 10, maxHeight: 280, overflowY: 'auto' }}>
          {away.map(a => (
            <div key={a.staff_id} className="hr-row">
              <StaffAvatar name={a.person.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.person.name}</div>
                <div className="hr-sub" style={{ marginTop: 0 }}>{a.person.designation || a.person.department || 'Staff'}</div>
              </div>
              <span className="hr-chip" style={a.status === 'Leave' ? { background: '#e4ebf6', color: '#1e3a6e' } : { background: PX.badBg, color: PX.bad }}>
                {a.status === 'Leave' ? 'On leave' : 'Absent'}
              </span>
            </div>
          ))}
          {!away.length && <div className="hr-empty">No absences or leave marked for today.</div>}
        </div>
      </section>

      <section className="hr-panel hr-c6">
        <div className="hr-eyebrow">By department</div>
        <h3 className="hr-title">Who is in</h3>
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {depts.map(d => (
            <div key={d.dept}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ fontWeight: 700 }}>{d.dept}</span>
                <span style={{ color: PX.sub }}><b className="hr-num" style={{ color: PX.ink, fontSize: 14 }}>{d.Present + d.Late}</b> / {d.total}</span>
              </div>
              <div className="hr-stack">
                {STATUS_TONES.slice(0, 4).map(t => d[t.key] > 0 && <span key={t.key} style={{ width: `${(d[t.key] / d.total) * 100}%`, background: t.color }} />)}
              </div>
            </div>
          ))}
          {!depts.length && <div className="hr-empty">No staff on record yet.</div>}
        </div>
      </section>

      <section className="hr-panel hr-c6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <div className="hr-eyebrow">Waiting for you</div>
            <h3 className="hr-title">{pendingLeaves.length ? `${pendingLeaves.length} leave request${pendingLeaves.length === 1 ? '' : 's'}` : 'No leave to approve'}</h3>
          </div>
          <button type="button" className="hr-link" onClick={() => onOpen('leave')}>Review all →</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {pendingLeaves.slice(0, 5).map(l => (
            <button key={l.id} type="button" className="hr-row" onClick={() => onOpen('leave')} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <StaffAvatar name={l.staff_profiles?.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{l.staff_profiles?.name || 'Staff member'}</div>
                <div className="hr-sub" style={{ marginTop: 0 }}>{l.leave_type || 'Leave'} · {fmtDate(l.start_date)} → {fmtDate(l.end_date)}</div>
              </div>
              <span className="hr-chip" style={{ background: PX.goldBg, color: '#7a5a14' }}>{l.days_applied ? `${l.days_applied}d` : 'New'}</span>
            </button>
          ))}
          {!pendingLeaves.length && <div className="hr-empty">Every request has been answered.</div>}
        </div>
      </section>

      <section className="hr-panel hr-c6">
        <div className="hr-eyebrow">Needs attention</div>
        <h3 className="hr-title">{alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'All clear'}</h3>
        <div style={{ marginTop: 10, maxHeight: 280, overflowY: 'auto' }}>
          {alerts.map((a, i) => (
            <div key={i} className="hr-row" style={{ borderLeft: `3px solid ${a.tone}`, borderRadius: '4px 12px 12px 4px', marginBottom: 6, background: PX.tint }}>
              <span style={{ fontSize: 17 }}>{a.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.who}</div>
                <div className="hr-sub" style={{ marginTop: 0, color: a.tone }}>{a.what}</div>
              </div>
            </div>
          ))}
          {!alerts.length && <div className="hr-empty">No serial absences, Friday patterns or probation deadlines.</div>}
        </div>
        {alerts.length > 0 && <button type="button" className="hr-link" style={{ marginTop: 8 }} onClick={() => onOpen('risk')}>Open risk analysis →</button>}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DAILY ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

function DailyAttendance({ staff, canOperate = true, onAttendanceChange }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { show: showToast, ToastEl } = useToast()

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('attendance_logs').select('*').eq('date', selectedDate)
    setAttendance(data || [])
    setLoading(false)
  }, [selectedDate])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

      const markAttendance = async (staffId, status) => {
    const { error } = await supabase.from('attendance_logs').upsert(
      [{ staff_id: staffId, date: selectedDate, status, marked_by: 'Admin',
        check_in_time: status === 'Present' ? new Date().toISOString() : null, updated_at: new Date() }],
      { onConflict: 'staff_id,date' }
    )
    if (error) showToast(error.message)
    else { fetchAttendance(); onAttendanceChange?.(); showToast(`Marked ${status}`, 'success'); EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { staffId, date: selectedDate, status }); }
  }

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase()
    return staff.filter(s => {
      if (q && !`${s.name} ${s.department || ''} ${s.designation || ''}`.toLowerCase().includes(q)) return false
      const rec = attendance.find(a => a.staff_id === s.id)
      if (filter === 'present') return rec?.status === 'Present'
      if (filter === 'absent')  return !rec || rec.status === 'Absent'
      if (filter === 'leave')   return rec?.status === 'Leave'
      return true
    })
  }, [staff, attendance, filter, query])

  const statusButtons = [
    { label: '✓ Present', status: 'Present', color: '#16a34a' },
    { label: '✗ Absent',  status: 'Absent',  color: '#dc2626' },
    { label: '⏰ Late',   status: 'Late',    color: '#ca8a04' },
    { label: '✈ Leave',  status: 'Leave',   color: '#1e3a6e' },
  ]

  return (
    <div style={S.card}>
      <SectionHeader
        icon="📅" title="Daily Attendance"
        subtitle={`${attendance.filter(a => a.status === 'Present').length} present today`}
        action={<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...S.input, width: 140, padding: '7px 10px', fontSize: 12 }} />}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'present', 'absent', 'leave'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={S.pill(filter === f)}>{f === 'absent' ? 'ABSENT / NOT MARKED' : f.toUpperCase()}</button>
        ))}
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search staff…" aria-label="Search staff"
          style={{ ...S.input, width: 'auto', flex: '1 1 180px', marginLeft: 'auto', padding: '8px 12px' }} />
      </div>
      {loading ? <p style={{ color: '#8a93a6', textAlign: 'center' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredStaff.map(s => {
            const rec = attendance.find(a => a.staff_id === s.id)
            const status = rec?.status || 'Not Marked'
            const statusColors = { Present: '#16a34a', Absent: '#dc2626', Late: '#ca8a04', Leave: '#1e3a6e', 'Not Marked': '#8a93a6' }
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 12px', borderRadius: 12, backgroundColor: '#faf8f3', border: '1px solid #e8e3d8' }}>
                <StaffAvatar name={s.name} size={32} />
                <div style={{ flex: 1, minWidth: 150 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#5d6b82' }}>
                    {s.department}
                    {rec?.geo_verified && <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 700 }}>📍 Geo ✓</span>}
                    {rec?.marked_by === 'Self' && <span style={{ marginLeft: 6, color: '#1e3a6e' }}>· Self check-in</span>}
                    {rec?.marked_by === 'Geo'  && <span style={{ marginLeft: 6, color: '#a7771f' }}>· Geo check-in</span>}
                  </p>
                </div>
                {canOperate ? (
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {statusButtons.map(btn => (
                      <button key={btn.status} onClick={() => markAttendance(s.id, btn.status)}
                        style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                          backgroundColor: status === btn.status ? btn.color : '#f3f0e8',
                          color: status === btn.status ? 'white' : btn.color,
                          border: `1px solid ${btn.color}44` }}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                    backgroundColor: `${statusColors[status]}15`, color: statusColors[status] }}>
                    {status}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ABSENT TRACKER
// ─────────────────────────────────────────────────────────────────────────────

function AbsentTracker({ staff, logs }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  const topAbsentees = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return staff.map(s => ({
      ...s,
      absenceCount: logs.filter(l => {
        const d = new Date(l.date)
        return l.staff_id === s.id && d.getFullYear() === year && d.getMonth() === month - 1 && l.status === 'Absent'
      }).length
    })).sort((a, b) => b.absenceCount - a.absenceCount).slice(0, 10)
  }, [selectedMonth, staff, logs])

  return (
    <div style={S.card}>
      <SectionHeader
        icon="📉" title="Absent Tracker"
        action={<input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ ...S.input, width: 130, padding: '7px 10px', fontSize: 12 }} />}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {topAbsentees.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8,
            backgroundColor: s.absenceCount > 5 ? '#fee2e2' : s.absenceCount > 3 ? '#fef9c3' : '#faf8f3' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{i + 1}. {s.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82' }}>{s.department}</p>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.absenceCount > 5 ? '#dc2626' : s.absenceCount > 3 ? '#ca8a04' : '#2e3b52' }}>
              {s.absenceCount} days
            </div>
          </div>
        ))}
        {topAbsentees.every(s => s.absenceCount === 0) && (
          <p style={{ textAlign: 'center', color: '#8a93a6', padding: 20 }}>No absences recorded this month 🎉</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LEAVE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function LeaveManagement({ staff, currentUser }) {
  const [leaves, setLeaves] = useState([])
  const [filter, setFilter] = useState('submitted')
  const [showForm, setShowForm] = useState(false)
  const { show: showToast, ToastEl } = useToast()

  const fetchLeaves = useCallback(async () => {
    let q = supabase.from('leaves').select('*, staff_profiles(name, department)')
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q.order('created_at', { ascending: false })
    setLeaves(data || [])
  }, [filter])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  const approve = async (id, role) => {
    const statusMap = { hod: 'hod_approved', principal: 'principal_approved', vp: 'approved', admin: 'approved' }
    const newStatus = statusMap[role?.toLowerCase()] || 'approved'
    const ts = new Date().toISOString()
    const updateFields = { status: newStatus, updated_at: ts }
    const roleKey = role?.toLowerCase()
    if (roleKey) { updateFields[`${roleKey}_approved_at`] = ts; updateFields[`${roleKey}_id`] = currentUser?.id }
    const { error } = await supabase.from('leaves').update(updateFields).eq('id', id)
    if (error) showToast(error.message)
    else { 
      fetchLeaves(); 
      showToast('Leave approved', 'success');
      EventBus.emit(GNSI_EVENTS.LEAVE_APPROVED, { 
        leaveId: id, 
        approvedBy: currentUser?.id,
        status: newStatus
      });
    }
  }

  const reject = async (id) => {
    const { error } = await supabase.from('leaves').update({ status: 'rejected', updated_at: new Date() }).eq('id', id)
    if (error) showToast(error.message)
    else { 
      fetchLeaves(); 
      showToast('Leave rejected', 'success');
      EventBus.emit(GNSI_EVENTS.LEAVE_APPROVED, { 
        leaveId: id, 
        status: 'rejected'
      });
    }
  }

  const statusBg = { submitted: '#fef9c3', hod_approved: '#e4ebf6', principal_approved: '#f6ecd2', approved: '#f0fdf4', rejected: '#fee2e2' }
  const role = currentUser?.role?.toLowerCase() || 'admin'

  // FIX-D6: only show Active staff in leave form
  const activeStaff = useMemo(() => staff.filter(s => s.status === 'Active'), [staff])

  return (
    <div style={S.card}>
      <SectionHeader
        icon="🏖️" title="Leave Management" subtitle="Multi-level approval"
        action={<button onClick={() => setShowForm(true)} style={{ ...S.btn(true), padding: '7px 12px', fontSize: 12 }}>＋ Apply Leave</button>}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'submitted', 'hod_approved', 'principal_approved', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={S.pill(filter === f)}>
            {f.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {leaves.map(leave => (
          <div key={leave.id} style={{ padding: 12, borderRadius: 8, backgroundColor: statusBg[leave.status] || '#faf8f3', border: `1px solid ${statusBg[leave.status] || '#e8e3d8'}88` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{leave.staff_profiles?.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82' }}>
                  {leave.leave_type} · {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)} ({leave.days_applied}d)
                </p>
                {leave.reason && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#4b5870' }}>Reason: {leave.reason}</p>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4 }}>
                {leave.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            {leave.status === 'submitted' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button onClick={() => approve(leave.id, role)} style={{ flex: 1, ...S.btn(true, '#16a34a'), fontSize: 12, padding: '6px 10px' }}>✓ Approve</button>
                <button onClick={() => reject(leave.id)}        style={{ flex: 1, ...S.btn(true, '#dc2626'), fontSize: 12, padding: '6px 10px' }}>✗ Reject</button>
              </div>
            )}
          </div>
        ))}
        {leaves.length === 0 && <p style={{ textAlign: 'center', color: '#8a93a6', padding: 20 }}>No leaves found</p>}
      </div>
      {showForm && <ApplyLeaveModal staff={activeStaff} currentUser={currentUser} onClose={() => setShowForm(false)} onSaved={fetchLeaves} showToast={showToast} />}
      {ToastEl}
    </div>
  )
}

function ApplyLeaveModal({ staff, currentUser, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({ staff_id: '', start_date: todayStr(), end_date: todayStr(), reason: '' })
  const [saving, setSaving] = useState(false)
  const days = form.start_date && form.end_date
    ? Math.max(Math.ceil((new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1, 1) : 0

  const handleSave = async () => {
    if (!form.staff_id || !form.start_date || !form.end_date) { showToast('Fill all fields'); return }
    setSaving(true)
    const { error } = await supabase.from('leaves').insert([{
      staff_id: Number(form.staff_id), leave_type: 'earned',
      start_date: form.start_date, end_date: form.end_date,
      days_applied: days, reason: form.reason, status: 'submitted',
    }])
    setSaving(false)
    if (error) showToast(error.message)
    else { 
      showToast('Leave applied!', 'success'); 
      onSaved(); 
      onClose();
      EventBus.emit(GNSI_EVENTS.LEAVE_APPLIED, { 
        staffId: Number(form.staff_id), 
        startDate: form.start_date, 
        endDate: form.end_date,
        days: days
      });
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ backgroundColor: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
        <h3 style={{ margin: '0 0 16px', color: '#132a4f' }}>Apply Leave</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} style={S.select}>
            <option value="">Select staff...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={S.input} />
            <input type="date" value={form.end_date}   onChange={e => setForm({ ...form, end_date: e.target.value })}   style={S.input} />
          </div>
          <input placeholder="Reason..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={S.input} />
          {days > 0 && <p style={{ margin: 0, fontSize: 12, color: '#132a4f', fontWeight: 600 }}>Days requested: {days} {days > LEAVE_MONTHLY_LIMIT ? '⚠️ Exceeds monthly limit' : ''}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e8e3d8', background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, ...S.btn(!saving), padding: 10, borderRadius: 8 }}>{saving ? 'Saving...' : 'Submit Leave'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PREDICTIVE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

function PredictiveAnalytics({ staff, logs }) {
  const risks = useMemo(() =>
    staff.map(s => absenceRiskModel.calculateRisk(s.id, logs)).sort((a, b) => b.riskScore - a.riskScore),
    [staff, logs]
  )

  return (
    <div style={S.card}>
      <SectionHeader icon="🎯" title="Absence Risk Predictions" subtitle="Based on patterns in logged data" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {['HIGH', 'MEDIUM', 'LOW'].map(level => {
          const colors = { HIGH: '#dc2626', MEDIUM: '#ca8a04', LOW: '#16a34a' }
          return (
            <div key={level} style={{ padding: 12, borderRadius: 8, backgroundColor: `${colors[level]}15`, border: `1px solid ${colors[level]}44`, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#5d6b82' }}>{level} Risk</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: colors[level] }}>
                {risks.filter(r => r.riskLevel === level).length}
              </p>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {risks.map(r => {
          const s = staff.find(x => x.id === r.staffId)
          const colors = { HIGH: { bg: '#fee2e2', text: '#991b1b' }, MEDIUM: { bg: '#fef9c3', text: '#92400e' }, LOW: { bg: '#f0fdf4', text: '#166534' } }
          const c = colors[r.riskLevel]
          return (
            <div key={r.staffId} style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: c.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: c.text }}>{s?.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82' }}>
                    Serial: {r.factors.serial > 0 ? '⚠️ Yes' : '✓ No'} · Friday pattern: {r.factors.friday > 0 ? '⚠️ Yes' : '✓ No'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{Math.round(r.riskScore * 100)}%</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.text }}>{r.riskLevel}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PERFORMANCE SCORECARDS
// ─────────────────────────────────────────────────────────────────────────────

function PerformanceScorecards({ staff, logs }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const scorecards = useMemo(() =>
    staff.map(s => calculateScorecard(s.id, logs, [], month)).sort((a, b) => b.overallScore - a.overallScore),
    [month, staff, logs]
  )
  return (
    <div style={S.card}>
      <SectionHeader
        icon="📈" title="Performance Scorecards"
        action={<input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...S.input, width: 130, padding: '7px 10px', fontSize: 12 }} />}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f0e8' }}>
              {['Staff','Attend %','Punctual %','Discipline','Overall','Grade'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Staff' ? 'left' : 'center', fontWeight: 600, color: '#2e3b52' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scorecards.map(sc => {
              const s = staff.find(x => x.id === sc.staffId)
              const gradeColor = sc.grade === 'A' ? '#16a34a' : sc.grade === 'B' ? '#1e3a6e' : '#ca8a04'
              return (
                <tr key={sc.staffId} style={{ borderBottom: '1px solid #e8e3d8', backgroundColor: sc.overallScore >= 85 ? '#f0fdf4' : '#fff' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11 }}>{s?.name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{sc.attendanceScore}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{sc.punctualityScore}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{sc.disciplineScore}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: sc.overallScore >= 85 ? '#16a34a' : '#ca8a04' }}>{sc.overallScore}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: gradeColor }}>{sc.grade}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. COMPLIANCE ENGINE
// FIX-D3: violations computed in useMemo not useEffect — prevents re-run on every render
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceEngine({ staff, logs }) {
  const [dismissed, setDismissed] = useState(new Set())
  const { show: showToast, ToastEl } = useToast()

  // FIX-D3: useMemo so this only re-runs when staff/logs actually change
  const allViolations = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const all = []
    for (const s of staff) {
      const staffLogs = logs.filter(l => l.staff_id === s.id)
      if (countAbsencesInMonth(staffLogs, s.id, currentMonth) > 8)
        all.push({ id: `${s.id}-absences`, staffId: s.id, staffName: s.name, severity: 'high',
          message: `${countAbsencesInMonth(staffLogs, s.id, currentMonth)} absences this month (limit: 8)`,
          suggestedAction: 'Issue warning letter' })
      if (detectSerialAbsence(staffLogs, s.id, 7, 3) > 0)
        all.push({ id: `${s.id}-serial`, staffId: s.id, staffName: s.name, severity: 'high',
          message: '3+ consecutive absences detected', suggestedAction: 'Notify HOD & schedule meeting' })
      if (detectFridayPattern(staffLogs, s.id, 2) >= 3)
        all.push({ id: `${s.id}-friday`, staffId: s.id, staffName: s.name, severity: 'medium',
          message: 'Friday absence pattern (3+ in 2 months)', suggestedAction: 'Send warning & counselling' })
    }
    return all
  }, [staff, logs])

  const violations = allViolations.filter(v => !dismissed.has(v.id))

  const C = {
    high:   { bg: '#fee2e2', border: '#fecaca', text: '#991b1b' },
    medium: { bg: '#fef9c3', border: '#fde68a', text: '#92400e' },
    low:    { bg: '#e4ebf6', border: '#bfdbfe', text: '#1e40af' },
  }

  return (
    <div style={S.card}>
      <SectionHeader icon="⚖️" title="Compliance Engine" subtitle={`${violations.length} violation${violations.length !== 1 ? 's' : ''} detected`} />
      {violations.length === 0 && <p style={{ textAlign: 'center', color: '#16a34a', padding: 20 }}>✓ No violations detected</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {violations.map((v) => {
          const c = C[v.severity]
          return (
            <div key={v.id} style={{ padding: 12, borderRadius: 8, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: c.text }}>{v.staffName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: c.text }}>{v.message}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.text, padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 4, alignSelf: 'flex-start' }}>
                  {v.severity.toUpperCase()}
                </span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: c.text }}>Action: <strong>{v.suggestedAction}</strong></p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => showToast(`Approved: ${v.suggestedAction}`, 'success')}
                  style={{ flex: 1, ...S.btn(true, '#16a34a'), fontSize: 11, padding: '5px 8px' }}>✓ Approve</button>
                <button onClick={() => setDismissed(prev => new Set(prev).add(v.id))}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Dismiss</button>
              </div>
            </div>
          )
        })}
      </div>
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SHIFT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function AssignShiftModal({ staff, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    staff_id: '', shift_slot: '', batch: '', subject: '',
    date_from: todayStr(), date_to: '', repeat: 'daily', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const selectedStaff = staff.find(s => String(s.id) === String(form.staff_id))
  const selectedSlot  = SHIFT_SLOTS.find(s => s.id === form.shift_slot)

  const handleSave = async () => {
    if (!form.staff_id || !form.shift_slot || !form.batch || !form.subject) { showToast('Fill all required fields'); return }
    setSaving(true)
    const { error } = await supabase.from('staff_shift_assignments').insert([{
      staff_id: Number(form.staff_id), shift_id: form.shift_slot, date: form.date_from,
      primary_class: form.batch, subject: form.subject, time_slot: selectedSlot?.time || '',
      repeat_type: form.repeat, date_to: form.date_to || null, notes: form.notes || null,
      created_at: new Date().toISOString(),
    }])
    setSaving(false)
    if (error) showToast('Save failed: ' + error.message)
    else { 
      showToast('Shift assigned!', 'success'); 
      onSaved(); 
      onClose();
      EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { 
        staffId: Number(form.staff_id), 
        change: 'shift_assigned',
        shiftId: form.shift_slot
      });
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#132a4f,#1e3a6e)', padding: '18px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white' }}>🔄 Assign Shift</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>Staff *</label>
            <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} style={S.select}>
              <option value="">Select staff...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || s.department}</option>)}
            </select>
            {selectedStaff && <div style={{ marginTop: 6, padding: '8px 12px', backgroundColor: '#eef2f9', borderRadius: 8, fontSize: 12, color: '#132a4f', fontWeight: 600 }}>👤 {selectedStaff.name} · {selectedStaff.department}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>Time Slot *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px,1fr))', gap: 6 }}>
              {SHIFT_SLOTS.map(slot => (
                <button key={slot.id} onClick={() => setForm({ ...form, shift_slot: slot.id })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `2px solid ${form.shift_slot === slot.id ? '#132a4f' : '#e8e3d8'}`,
                    backgroundColor: form.shift_slot === slot.id ? '#132a4f' : 'white',
                    color: form.shift_slot === slot.id ? 'white' : '#2e3b52', cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>
                  <div>{slot.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{slot.time}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>Batch *</label>
              <select value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} style={S.select}>
                <option value="">Select...</option>
                {BATCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>Subject *</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={S.select}>
                <option value="">Select...</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>From Date *</label><input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} style={S.input} /></div>
            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>To Date</label><input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} style={S.input} /></div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 5, textTransform: 'uppercase' }}>Repeat</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['daily', 'mon-sat', 'weekly', 'once'].map(r => (
                <button key={r} onClick={() => setForm({ ...form, repeat: r })}
                  style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${form.repeat === r ? '#132a4f' : '#e8e3d8'}`,
                    backgroundColor: form.repeat === r ? '#132a4f' : 'white',
                    color: form.repeat === r ? 'white' : '#2e3b52', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {r === 'mon-sat' ? 'Mon–Sat' : r[0].toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" style={S.input} />
          {form.staff_id && form.shift_slot && form.batch && form.subject && (
            <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803d' }}>✅ Preview</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#2e3b52' }}>
                <strong>{selectedStaff?.name}</strong> · {selectedSlot?.time} · {form.batch} · {form.subject}
              </p>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px 24px', borderTop: '1px solid #f3f0e8', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e8e3d8', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, ...S.btn(!saving), padding: 12, borderRadius: 10 }}>
            {saving ? '⏳ Saving...' : '💾 Assign Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShiftManagement({ staff, logs, canOperate = true }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [assignments, setAssignments]   = useState([])
  const [loading, setLoading]           = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [filterStaff, setFilterStaff]   = useState('')
  const [filterSlot, setFilterSlot]     = useState('')
  const [confirmDel, setConfirmDel]     = useState(null)
  const { show: showToast, ToastEl }    = useToast()

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff_shift_assignments')
      .select('*, staff_profiles(name, department, designation)')
      .order('created_at', { ascending: false })
    setAssignments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  const handleDelete = async (id) => {
    // Read the staff member before the row is gone (for the STAFF_UPDATED event).
    const staffId = assignments.find(a => a.id === id)?.staff_id
    const { error } = await supabase.from('staff_shift_assignments').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message)
    else { 
      showToast('Shift removed', 'success'); 
      fetchAssignments();
      EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { 
        staffId, 
        change: 'shift_removed'
      });
    }
    setConfirmDel(null)
  }

  const todayLogs = useMemo(() => logs.filter(l => l.date === selectedDate), [logs, selectedDate])

  const filtered = useMemo(() => assignments.filter(a =>
    (!filterStaff || String(a.staff_id) === filterStaff) &&
    (!filterSlot  || a.shift_id === filterSlot)
  ), [assignments, filterStaff, filterSlot])

  const coverage = useMemo(() => {
    const map = {}
    filtered.forEach(a => {
      const key = a.shift_id
      if (!map[key]) map[key] = { slot: SHIFT_SLOTS.find(s => s.id === key), total: 0, present: 0 }
      map[key].total++
      if (todayLogs.find(l => l.staff_id === a.staff_id && l.status === 'Present')) map[key].present++
    })
    return Object.values(map)
  }, [filtered, todayLogs])

  return (
    <div style={S.card}>
      {ToastEl}
      {showModal && <AssignShiftModal staff={staff} onClose={() => setShowModal(false)} onSaved={fetchAssignments} showToast={showToast} />}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 14, padding: 24, maxWidth: 320, width: '100%' }}>
            <p style={{ margin: '0 0 20px', fontSize: 15 }}>Remove this shift assignment?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e8e3d8', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDel)} style={{ flex: 1, ...S.btn(true, '#dc2626'), padding: 10, borderRadius: 8 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <SectionHeader
        icon="🔄" title="Shift Management" subtitle={`${assignments.length} assignments`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ ...S.input, width: 140, padding: '7px 10px', fontSize: 12 }} />
            {canOperate && (
              <button onClick={() => setShowModal(true)}
                style={{ ...S.btn(true), padding: '8px 14px', fontSize: 12, background: 'linear-gradient(135deg,#132a4f,#1e3a6e)' }}>
                ＋ Assign
              </button>
            )}
          </div>
        }
      />
      {coverage.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
          {coverage.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 8,
              backgroundColor: c.present >= c.total ? '#f0fdf4' : c.present === 0 ? '#fee2e2' : '#fff7ed',
              border: `1px solid ${c.present >= c.total ? '#bbf7d0' : c.present === 0 ? '#fecaca' : '#fed7aa'}` }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{c.slot?.label}</p>
              <p style={{ margin: '1px 0 0', fontSize: 10, color: '#5d6b82' }}>{c.slot?.time}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: c.present > 0 ? '#16a34a' : '#dc2626' }}>
                {c.present}/{c.total} present
              </p>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ ...S.select, fontSize: 12, padding: '8px 10px' }}>
          <option value="">All Staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)} style={{ ...S.select, fontSize: 12, padding: '8px 10px' }}>
          <option value="">All Slots</option>
          {SHIFT_SLOTS.map(s => <option key={s.id} value={s.id}>{s.label} · {s.time}</option>)}
        </select>
      </div>
      {loading ? (
        <p style={{ textAlign: 'center', color: '#8a93a6', padding: 24 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#8a93a6' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🗓</div>
          <p style={{ margin: 0, fontSize: 13 }}>No shift assignments.{canOperate && ' Click ＋ Assign to add.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const slot   = SHIFT_SLOTS.find(s => s.id === a.shift_id)
            const log    = todayLogs.find(l => l.staff_id === a.staff_id)
            const status = log?.status || 'Not Marked'
            const sc     = { Present: '#16a34a', Absent: '#dc2626', Late: '#ca8a04', 'Not Marked': '#8a93a6' }
            return (
              <div key={a.id} style={{ borderRadius: 10, border: '1px solid #e8e3d8', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#eef2f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍🏫</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{a.staff_profiles?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82' }}>{a.staff_profiles?.designation} · {a.staff_profiles?.department}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc[status] || '#8a93a6', backgroundColor: `${sc[status] || '#8a93a6'}15`, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>
                    {status}
                  </span>
                  {canOperate && (
                    <button onClick={() => setConfirmDel(a.id)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', flexShrink: 0 }}>🗑</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #f3f0e8', fontSize: 11 }}>
                  <div style={{ padding: '7px 12px', borderRight: '1px solid #f3f0e8' }}>
                    <p style={{ margin: 0, color: '#8a93a6' }}>Slot</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#14213d' }}>{slot?.label || a.shift_id}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 10, color: '#5d6b82' }}>{slot?.time || a.time_slot}</p>
                  </div>
                  <div style={{ padding: '7px 12px', borderRight: '1px solid #f3f0e8' }}>
                    <p style={{ margin: 0, color: '#8a93a6' }}>Batch</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#14213d' }}>{a.primary_class || '—'}</p>
                  </div>
                  <div style={{ padding: '7px 12px' }}>
                    <p style={{ margin: 0, color: '#8a93a6' }}>Subject</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#14213d' }}>{a.subject || '—'}</p>
                  </div>
                </div>
                {(a.repeat_type || a.notes) && (
                  <div style={{ padding: '6px 12px', backgroundColor: '#faf8f3', borderTop: '1px solid #f3f0e8', fontSize: 11, color: '#5d6b82', display: 'flex', gap: 12 }}>
                    {a.repeat_type && <span>🔁 {a.repeat_type === 'mon-sat' ? 'Mon–Sat' : a.repeat_type}</span>}
                    {a.notes && <span>📝 {a.notes}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GEOLOCATION TRACKER
// FIX-D4: syncVerifiedCheckins loop guard
// ─────────────────────────────────────────────────────────────────────────────

function GeolocationTracker({ staff, canOperate = true, onAttendanceChange }) {
  const [checkins, setCheckins] = useState([])
  const [date, setDate]         = useState(todayStr())
  const [loading, setLoading]   = useState(false)
  const { show: showToast, ToastEl } = useToast()

  const fetchCheckins = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('self_attendance')
      .select('*, staff_profiles(name, department)')
      .eq('date', date)
      .order('timestamp', { ascending: false })
    setCheckins(data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { fetchCheckins() }, [fetchCheckins])

  const handleOverride = async (checkin) => {
    const { error: e1 } = await supabase
      .from('self_attendance')
      .update({ geo_verified: true, admin_overridden: true, admin_override_at: new Date().toISOString() })
      .eq('id', checkin.id)
    if (e1) { showToast('Override failed: ' + e1.message); return }

    const { error: e2 } = await supabase.from('attendance_logs').upsert(
      [{ staff_id: checkin.staff_id, date: checkin.date, status: 'Present',
        marked_by: 'Geo', check_in_time: checkin.timestamp,
        geo_verified: true, geo_distance: null,
        notes: 'Admin override — geo check-in approved', updated_at: new Date() }],
      { onConflict: 'staff_id,date' }
    )
    if (e2) showToast('Attendance sync failed: ' + e2.message)
    else { 
      showToast('Override approved & attendance marked Present', 'success'); 
      fetchCheckins(); 
      onAttendanceChange?.();
      EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
        staffId: checkin.staff_id, 
        date: checkin.date, 
        status: 'Present',
        markedBy: 'Geo',
        geoVerified: true
      });
    }
  }

  // FIX-D4: Only sync verified rows; call onAttendanceChange only once after all upserts
  useEffect(() => {
    const verified = checkins.filter(c => c.geo_verified || c.admin_overridden)
    if (!verified.length) return

    const sync = async () => {
      let anyWritten = false
      for (const c of verified) {
        const { error } = await supabase.from('attendance_logs').upsert(
          [{ staff_id: c.staff_id, date: c.date, status: 'Present',
            marked_by: 'Geo', check_in_time: c.timestamp,
            geo_verified: true, geo_distance: c.geo_distance,
            updated_at: new Date() }],
          { onConflict: 'staff_id,date' }
        )
        if (!error) anyWritten = true
      }
      // Only call onAttendanceChange once, and only if writes succeeded
      if (anyWritten) {
        onAttendanceChange?.();
        // Emit for each verified checkin
        for (const c of verified) {
          EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
            staffId: c.staff_id, 
            date: c.date, 
            status: 'Present',
            markedBy: 'Geo',
            geoVerified: true
          });
        }
      }
    }
    sync()
  }, [checkins]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: onAttendanceChange intentionally excluded — it's a stable callback ref

  const stats = useMemo(() => ({
    total:    checkins.length,
    verified: checkins.filter(c => c.geo_verified || c.admin_overridden).length,
    rejected: checkins.filter(c => !c.geo_verified && !c.admin_overridden).length,
    noGps:    checkins.filter(c => c.location_lat == null).length,
  }), [checkins])

  return (
    <div style={S.card}>
      <SectionHeader
        icon="📍" title="Geolocation Verification"
        subtitle={`${stats.verified} verified · ${stats.rejected} rejected · ${stats.noGps} no GPS`}
        action={<input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...S.input, width: 140, padding: '7px 10px', fontSize: 12 }} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#5d6b82' }}>Verified</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{stats.verified}</p>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #fecaca', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#5d6b82' }}>Rejected</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{stats.rejected}</p>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#faf8f3', border: '1px solid #e8e3d8', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#5d6b82' }}>No GPS</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#8a93a6' }}>{stats.noGps}</p>
        </div>
      </div>

      {loading ? <p style={{ color: '#8a93a6', textAlign: 'center', padding: 20 }}>Loading...</p>
      : checkins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8a93a6' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
          <p style={{ margin: 0, fontSize: 13 }}>No self check-ins for this date</p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>Staff check-ins via QR/PIN appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checkins.map(c => {
            const v = verifyGeolocation(c.location_lat, c.location_lng)
            const isApproved = c.geo_verified || c.admin_overridden
            const bg        = isApproved || v.verified ? '#f0fdf4' : '#fee2e2'
            const border    = isApproved || v.verified ? '#bbf7d0' : '#fecaca'
            const textColor = isApproved || v.verified ? '#166534' : '#991b1b'
            return (
              <div key={c.id} style={{ padding: '12px', borderRadius: 10, backgroundColor: bg, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <StaffAvatar name={c.staff_profiles?.name} size={28} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{c.staff_profiles?.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#5d6b82' }}>{c.staff_profiles?.department}</p>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#5d6b82', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>🕐 {new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} via {c.method}</span>
                      {c.location_lat != null
                        ? <span>📍 {Number(c.location_lat).toFixed(5)}, {Number(c.location_lng).toFixed(5)} — {v.message}</span>
                        : <span>📍 No GPS coordinates recorded</span>
                      }
                      {c.admin_overridden && <span style={{ color: '#1e3a6e', fontWeight: 600 }}>✅ Admin override approved</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: textColor, padding: '3px 10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999 }}>
                      {isApproved ? '✓ Verified' : v.verified ? '✓ Verified' : '✗ Rejected'}
                    </span>
                    {canOperate && !isApproved && !v.verified && (
                      <button onClick={() => handleOverride(c)}
                        style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: 'none', backgroundColor: '#1e3a6e', color: 'white', cursor: 'pointer' }}>
                        Override ✓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: '#faf8f3', borderRadius: 8, border: '1px dashed #d9d2c2', fontSize: 11, color: '#5d6b82' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>ℹ️ How it works</p>
        <p style={{ margin: '4px 0 0' }}>
          Staff check in via QR/PIN on their device. GPS verified against school boundary ({GEOFENCE.allowedRadius}m radius).
          Verified check-ins automatically update <strong>Daily Attendance</strong> as Present.
          Rejected check-ins can be manually overridden by Admin/VP.
        </p>
      </div>
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. BULK OPERATIONS
// FIX-D2: markAll filters Active staff only
// ─────────────────────────────────────────────────────────────────────────────

function BulkOperations({ staff, canOperate = true, onAttendanceChange }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [importPreview, setImportPreview] = useState([])
  const { show: showToast, ToastEl } = useToast()

  // FIX-D2: only Active staff get bulk-marked
  const activeStaff = useMemo(() => staff.filter(s => s.status === 'Active'), [staff])

  const markAll = async (status) => {
    const records = activeStaff.map(s => ({ staff_id: s.id, date: selectedDate, status, marked_by: 'Bulk', updated_at: new Date() }))
    const { error } = await supabase.from('attendance_logs').upsert(records, { onConflict: 'staff_id,date' })
    if (error) showToast(error.message)
    else { 
      showToast(`${activeStaff.length} active staff marked ${status}`, 'success'); 
      onAttendanceChange?.();
      for (const s of activeStaff) {
        EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
          staffId: s.id, 
          date: selectedDate, 
          status 
        });
      }
    }
  }

  const handleImportCSV = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = text.split('\n').slice(1).filter(r => r.trim())
    const records = rows.map(row => {
      const [staffId, status] = row.split(',')
      return { staff_id: Number(staffId?.trim()), date: selectedDate, status: status?.trim(), marked_by: 'CSV', updated_at: new Date() }
    }).filter(r => r.staff_id && r.status)
    setImportPreview(records)
  }

  const confirmImport = async () => {
    const { error } = await supabase.from('attendance_logs').upsert(importPreview, { onConflict: 'staff_id,date' })
    if (error) showToast(error.message)
    else { 
      showToast(`${importPreview.length} records imported!`, 'success'); 
      setImportPreview([]); 
      onAttendanceChange?.();
      for (const r of importPreview) {
        EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
          staffId: r.staff_id, 
          date: selectedDate, 
          status: r.status 
        });
      }
    }
  }

  return (
    <div style={S.card}>
      <SectionHeader icon="⚙️" title="Bulk Operations" subtitle={`${activeStaff.length} active staff`} />
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#2e3b52', marginBottom: 6, textTransform: 'uppercase' }}>Target Date</label>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...S.input, maxWidth: 200 }} />
      </div>
      {canOperate ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button onClick={() => markAll('Present')} style={{ ...S.btn(true, '#16a34a'), fontSize: 12, padding: '10px 8px' }}>✓ Mark All Present</button>
          <button onClick={() => markAll('Absent')}  style={{ ...S.btn(true, '#dc2626'), fontSize: 12, padding: '10px 8px' }}>✗ Mark All Absent</button>
          <label style={{ ...S.btn(true, '#132a4f'), fontSize: 12, padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            📥 Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 10, backgroundColor: '#faf8f3', border: '1px solid #e8e3d8', textAlign: 'center', color: '#8a93a6', fontSize: 13, marginBottom: 16 }}>
          🔒 Bulk operations restricted to Admin & Vice Principal
        </div>
      )}
      {importPreview.length > 0 && (
        <div style={{ padding: 12, backgroundColor: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Preview: {importPreview.length} records</p>
          <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
            {importPreview.slice(0, 5).map((r, i) => {
              const s = staff.find(x => x.id === r.staff_id)
              return <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#2e3b52' }}>{s?.name || r.staff_id} → {r.status}</p>
            })}
            {importPreview.length > 5 && <p style={{ margin: '2px 0', fontSize: 11, color: '#5d6b82' }}>+{importPreview.length - 5} more...</p>}
          </div>
          <button onClick={confirmImport} style={{ ...S.btn(true, '#16a34a'), width: '100%', fontSize: 12, padding: 8 }}>✓ Confirm Import</button>
        </div>
      )}
      <div style={{ padding: 12, backgroundColor: '#faf8f3', borderRadius: 8, border: '1px dashed #d9d2c2' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#2e3b52', fontWeight: 600 }}>CSV Format:</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#5d6b82', fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace" }}>staff_id,status</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82', fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace" }}>101,Present</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#5d6b82', fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace" }}>102,Absent</p>
      </div>
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// FIX-D1: attendance_logs limited to last 3 months
// FIX-D5: hr_records fetch wrapped in try/catch
// ─────────────────────────────────────────────────────────────────────────────

// perms: this user's rights on the 'hr' module; canAccess(key) / modulePerms(key): App's access check
// and rights, used for the module sections (MODULE_SECTIONS). section / onSection let App open a
// section directly (old links to the Timetable, Leave and Notice modules land on them here).
function DailyAttendanceTracker({ currentUser: appUser, staffProp, perms, canAccess, modulePerms, section, onSection }) {
  const canHR = perms ? !!perms.read : true
  const moduleSections = MODULE_SECTIONS.filter(m => (canAccess ? canAccess(m.perm) : true))
  const canSee = key => (MODULE_SECTIONS.some(m => m.key === key) ? moduleSections.some(m => m.key === key) : canHR)
  const firstSection = canHR ? 'dashboard' : (moduleSections[0]?.key || 'dashboard')
  const [staff, setStaff]     = useState(staffProp || [])
  const [logs, setLogs]       = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(canHR)
  const [localSection, setLocalSection] = useState(firstSection)
  const wanted = section || localSection
  const activeSection = canSee(wanted) ? wanted : firstSection
  const setActiveSection = s => (onSection ? onSection(s) : setLocalSection(s))
  const currentUser = appUser || { id: 1, role: 'Admin' }
  const canOperate  = isAdminRole(currentUser?.role) || ['Vice Principal', 'Principal'].includes(currentUser?.role)

  const loadData = useCallback(async () => {
    // FIX-D1: limit logs to last 3 months — prevents unbounded growth
    const cutoff = threeMonthsAgo()

    const [staffRes, logsRes] = await Promise.all([
      supabase.from('staff_profiles').select('id, name, department, designation, status').order('name'),
      supabase.from('attendance_logs').select('*').gte('date', cutoff).order('date', { ascending: false }),
    ])
    if (staffRes.data) setStaff(staffRes.data)
    if (logsRes.data)  setLogs(logsRes.data)

    // FIX-D5: hr_records is optional — don't block loading if it fails
    try {
      const { data } = await supabase.from('hr_records').select('*').eq('is_archived', false).order('created_at', { ascending: false })
      if (data) setRecords(data)
    } catch { /* hr_records table may not exist */ }

    setLoading(false)
  }, [])

  useEffect(() => { if (canHR) loadData() }, [loadData, canHR])

  const refreshLogs = useCallback(async () => {
    const cutoff = threeMonthsAgo()
    const { data } = await supabase.from('attendance_logs').select('*').gte('date', cutoff).order('date', { ascending: false })
    if (data) setLogs(data)
  }, [])

  // leave requests still waiting for a decision (any approval level); re-read each time HR home opens
  const [pendingLeaves, setPendingLeaves] = useState([])
  const isMobile = useIsMobile()
  const onHome = activeSection === 'dashboard'
  useEffect(() => {
    if (!canHR) return
    let live = true
    supabase.from('leaves').select('*, staff_profiles(name, department)').in('status', PENDING_LEAVE).order('created_at', { ascending: false })
      .then(({ data }) => { if (live) setPendingLeaves(data || []) }, () => {})
    return () => { live = false }
  }, [canHR, onHome])

  const today = todayStr()
  const todayCounts = useMemo(() => dayCounts(staff, logs.filter(l => l.date === today)), [staff, logs, today])
  const inToday = todayCounts.Present + todayCounts.Late

  // Section launcher: HR's own sections, then the modules that live in HR (each behind its own permission)
  const visible = new Set([...(canHR ? HR_TABS : []), ...moduleSections.map(m => m.key)])
  const groups = TAB_GROUPS.map(g => ({
    ...g,
    tabs: g.tabs.filter(t => visible.has(t.id)).map(t => ({
      ...t,
      badge: t.id === 'leave' ? pendingLeaves.length : t.id === 'daily' ? todayCounts['Not Marked'] : 0,
    })),
  }))
  const onModule = MODULE_SECTIONS.some(m => m.key === activeSection)
  const modulePerm = key => (modulePerms ? modulePerms(key) : undefined)
  const sectionLabel = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === activeSection)?.label || ''

  if (loading && !onModule) return (
    <div className="px-root" style={{ padding: '64px 16px', textAlign: 'center', color: PX.sub, background: 'transparent', minHeight: 'auto' }}>
      <PremiumStyles />
      <div style={{ fontFamily: PX.serif, fontSize: 20, color: PX.ink }}>Opening HR…</div>
      <div style={{ fontSize: 12.5, marginTop: 6 }}>Loading staff and attendance</div>
    </div>
  )

  return (
    <div className="px-root hr-root" style={{ padding: 16, maxWidth: 1440, margin: '0 auto', minHeight: 'auto', background: 'transparent' }}>
      <PremiumStyles />
      <style>{HR_CSS}</style>
      {canHR && !onModule && (
        <PremiumHero isMobile={isMobile} eyebrow={isMobile ? 'GNSI · HR · Core' : 'GNSI · Human Resources · Core module'} title={onHome ? 'HR Command Centre' : sectionLabel}
          subtitle={`${staff.length} staff · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
          icon={<span style={{ color: PX.goldLt, display: 'flex' }}><PIcon.users size={26} /></span>}
          actions={<>
            {!onHome && <button type="button" className="px-hbtn" onClick={() => setActiveSection('dashboard')}>‹ HR home</button>}
            {canOperate && activeSection !== 'daily' && <button type="button" className="px-hbtn gold" onClick={() => setActiveSection('daily')}>✓ Mark attendance</button>}
          </>}
          stats={[
            { label: 'In today', value: `${inToday}/${staff.length}`, sub: staff.length ? `${Math.round((inToday / staff.length) * 100)}% present or late` : 'No staff yet', onClick: () => setActiveSection('daily') },
            { label: 'Absent', value: todayCounts.Absent, sub: 'Today', tone: todayCounts.Absent ? '#fca5a5' : undefined, onClick: () => setActiveSection('absent') },
            { label: 'On leave', value: todayCounts.Leave, sub: 'Today', onClick: () => setActiveSection('leave') },
            { label: 'Not marked', value: todayCounts['Not Marked'], sub: 'Still to mark', tone: todayCounts['Not Marked'] ? PX.goldLt : undefined, onClick: () => setActiveSection('daily') },
            { label: 'Leave requests', value: pendingLeaves.length, sub: 'Awaiting decision', onClick: () => setActiveSection('leave') },
          ]} />
      )}

      {!canOperate && canHR && !onModule && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderRadius: 14, marginBottom: 16, background: PX.goldBg, border: `1px solid ${PX.goldLine}` }}>
          <span style={{ fontSize: 18 }}>👁</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#7a5a14' }}>View only</p>
            <p style={{ margin: 0, fontSize: 12, color: PX.sub }}>Only Admin, Principal and Vice Principal can mark attendance.</p>
          </div>
        </div>
      )}

      <IconTabs groups={groups} active={activeSection} open={!onHome || !canHR}
        onOpen={setActiveSection} onHome={() => setActiveSection(firstSection)} homeLabel="HR home" ariaLabel="HR sections" />

      {onHome && canHR && <HRCommandCentre staff={staff} logs={logs} records={records} pendingLeaves={pendingLeaves} onOpen={k => setActiveSection(canSee(k) ? k : 'dashboard')} />}
      {activeSection === 'daily'       && <DailyAttendance staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
      {activeSection === 'absent'      && <AbsentTracker staff={staff} logs={logs} />}
      {activeSection === 'leave'       && <LeaveManagement staff={staff} currentUser={currentUser} />}
      {activeSection === 'risk'        && <PredictiveAnalytics staff={staff} logs={logs} />}
      {activeSection === 'performance' && <PerformanceScorecards staff={staff} logs={logs} />}
      {activeSection === 'compliance'  && <ComplianceEngine staff={staff} logs={logs} />}
      {activeSection === 'shift'       && <ShiftManagement staff={staff} logs={logs} canOperate={canOperate} />}
      {activeSection === 'geo'         && <GeolocationTracker staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
      {activeSection === 'bulk'        && <BulkOperations staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
      {onModule && (
        <Suspense fallback={<div className="hr-empty" style={{ padding: '48px 16px' }}>Loading {sectionLabel.toLowerCase()}…</div>}>
          {activeSection === 'timetable' && <Timetable currentUser={currentUser} embedded />}
          {activeSection === 'leavedesk' && <Leave currentUser={appUser} perms={modulePerm('leave')} />}
          {activeSection === 'notice'    && <Notice currentUser={appUser} perms={modulePerm('notice')} />}
        </Suspense>
      )}
    </div>
  )
}
export default DailyAttendanceTracker

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DAILY ATTENDANCE TRACKER SYSTEM v2 - FULLY INTERCONNECTED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * GNSI Portal — Guidance Navodaya & Sainik Institute
 * Khangabok, Thoubal, Manipur
 *
 * Changes from v1:
 * ─ Geo & Daily Attendance fully interconnected (self_attendance auto-syncs to attendance_logs)
 * ─ Shift coverage uses attendance_logs (not disconnected)
 * ─ Null GPS coords no longer crash GeolocationTracker
 * ─ Admin geo override (approve rejected check-ins)
 * ─ DB columns: subject, time_slot, repeat_type, date_to, notes added to staff_shift_assignments
 * ─ Date picker wired in ShiftManagement header
 * ─ BulkOperations uses upsert to avoid duplicate errors
 * ─ markAllPresent / markAllAbsent use upsert
 * ─ CSV import uses upsert
 * ─ Leave approval correctly maps role → status
 * ─ ComplianceEngine: countAbsencesInMonth fix (was passing full logs, not staffLogs)
 * ─ detectSerialAbsence fix: uses daysUntil correctly
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// SQL MIGRATIONS — run in Supabase SQL Editor before deploying
// ─────────────────────────────────────────────────────────────────────────────
/*
-- Core tables (unchanged from v1 — skip if already run)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('Present','Absent','Late','Leave','Half-day','Holiday')) DEFAULT 'Absent',
  marked_by TEXT CHECK (marked_by IN ('Admin','Self','System','Geo','Bulk')) DEFAULT 'Admin',
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  geo_verified BOOLEAN DEFAULT FALSE,
  geo_distance INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date_staff ON attendance_logs(date, staff_id);

-- Fix staff_shift_assignments: add missing columns
ALTER TABLE staff_shift_assignments
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS time_slot TEXT,
  ADD COLUMN IF NOT EXISTS repeat_type TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS date_to DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- self_attendance: geo check-ins from staff portal
CREATE TABLE IF NOT EXISTS self_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  method TEXT CHECK (method IN ('QR','PIN','Biometric')) DEFAULT 'QR',
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  device_id TEXT,
  geo_verified BOOLEAN DEFAULT FALSE,
  geo_distance INT,
  admin_overridden BOOLEAN DEFAULT FALSE,
  admin_override_by BIGINT,
  admin_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Other tables (unchanged from v1)
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  leave_type TEXT NOT NULL DEFAULT 'earned',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_applied INT NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('draft','submitted','hod_approved','principal_approved','approved','rejected','cancelled')) DEFAULT 'submitted',
  hod_id BIGINT, hod_approved_at TIMESTAMPTZ, hod_remarks TEXT,
  principal_id BIGINT, principal_approved_at TIMESTAMPTZ, principal_remarks TEXT,
  vp_id BIGINT, vp_approved_at TIMESTAMPTZ, vp_remarks TEXT,
  balance_before INT, balance_after INT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absence_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  month DATE NOT NULL,
  absent_days INT DEFAULT 0, late_days INT DEFAULT 0, leaves INT DEFAULT 0,
  pattern_flags TEXT[] DEFAULT '{}',
  risk_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, month)
);

CREATE TABLE IF NOT EXISTS compliance_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
  rule_id TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('high','medium','low')) DEFAULT 'medium',
  message TEXT, suggested_action TEXT,
  action_status TEXT CHECK (action_status IN ('pending','approved','dismissed','resolved')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipients TEXT[] NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('alert','warning','info','success')) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS leave_balance INT DEFAULT 20;
*/

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GEOFENCE = {
  schoolLocation: { lat: 24.8267, lng: 94.901 },
  allowedRadius: 200,
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
  'Umeed A','Umeed B','Elite','Prime',
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

const todayStr = () => new Date().toISOString().slice(0, 10)

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
    const dw = d.getDay()
    if (dw !== 0) count++ // exclude Sunday
    d.setDate(d.getDate() + 1)
  }
  return count
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

const S = {
  card: { backgroundColor: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: '16px' },
  select: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', width: '100%' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  btn: (active = true, color = '#1e3a5f') => ({
    padding: '10px 16px', borderRadius: '8px', border: 'none',
    cursor: active ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '14px',
    backgroundColor: active ? color : '#94a3b8', color: 'white',
  }),
  pill: (active, bg = '#1e3a5f') => ({
    padding: '6px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px',
    backgroundColor: active ? bg : '#f1f5f9', color: active ? 'white' : '#374151',
  }),
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const colors = { error: ['#fee2e2','#dc2626'], success: ['#dcfce7','#16a34a'], info: ['#dbeafe','#2563eb'] }
  const [bg, color] = colors[type] || colors.info
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      backgroundColor: bg, color, padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
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
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{icon} {title}</h2>
        {subtitle && <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

function StaffAvatar({ name, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#1e3a5f',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
      fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function MetricCard({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ padding: 12, borderRadius: 8, backgroundColor: `${color}15`, border: `1px solid ${color}44` }}>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{pct}% of {total}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. VP DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function VPDashboard({ staff, logs, records }) {
  const [kpis, setKpis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [byDept, setByDept] = useState([])

  useEffect(() => {
    const load = async () => {
      const today = todayStr()
      const { data: todayLogs } = await supabase.from('attendance_logs').select('staff_id,status').eq('date', today)
      const tl = todayLogs || []
      const total = staff.length
      const present = tl.filter(l => l.status === 'Present').length
      const absent = tl.filter(l => l.status === 'Absent').length
      const onLeave = tl.filter(l => l.status === 'Leave').length
      setKpis({ total, present, absent, onLeave, percentage: total ? Math.round((present / total) * 100) : 0 })

      const deptMap = {}
      staff.forEach(s => { if (!deptMap[s.department]) deptMap[s.department] = { dept: s.department, present: 0, absent: 0, leave: 0 } })
      tl.forEach(log => {
        const s = staff.find(x => x.id === log.staff_id)
        if (s && deptMap[s.department]) {
          if (log.status === 'Present') deptMap[s.department].present++
          else if (log.status === 'Absent') deptMap[s.department].absent++
          else if (log.status === 'Leave') deptMap[s.department].leave++
        }
      })
      setByDept(Object.values(deptMap))

      const { data: probs } = await supabase
        .from('hr_records').select('staff_id,probation_end_date,staff_profiles(name)').eq('employment_status', 'Probation')
        .lte('probation_end_date', addDays(new Date(), 7).toISOString().slice(0, 10))

      const { data: patterns } = await supabase
        .from('absence_patterns').select('staff_id,pattern_flags,staff_profiles(name)')
        .contains('pattern_flags', ['serial_absence'])

      setAlerts([
        ...((probs || []).map(p => ({ type: 'probation', staffName: p.staff_profiles?.name, message: `Probation ending in ${daysUntil(p.probation_end_date)} days` }))),
        ...((patterns || []).map(p => ({ type: 'pattern', staffName: p.staff_profiles?.name, message: `Pattern: ${p.pattern_flags?.join(', ')}` }))),
      ].slice(0, 5))
    }
    load()
  }, [staff])

  return (
    <div style={S.card}>
      <SectionHeader icon="📊" title="VP Dashboard" subtitle={fmtDate(new Date())} />
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <MetricCard label="Present" value={kpis.present} total={kpis.total} color="#16a34a" />
          <MetricCard label="Absent" value={kpis.absent} total={kpis.total} color="#dc2626" />
          <MetricCard label="On Leave" value={kpis.onLeave} total={kpis.total} color="#2563eb" />
          <MetricCard label="Overall %" value={kpis.percentage} total={100} color="#1e3a5f" />
        </div>
      )}
      {byDept.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>By Department</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {byDept.map(d => (
              <div key={d.dept} style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{d.dept}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>✓ {d.present} | ✗ {d.absent} | ✈ {d.leave}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {alerts.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626' }}>
          <h3 style={{ margin: '0 0 10px', color: '#991b1b', fontSize: 13 }}>🚨 Critical Alerts ({alerts.length})</h3>
          {alerts.map((a, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < alerts.length - 1 ? '1px solid #fecaca' : 'none' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#7f1d1d' }}>{a.type === 'probation' ? '⏳' : '⚠️'} {a.staffName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#991b1b' }}>{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DAILY ATTENDANCE (interconnected: shows geo_verified badge)
// ─────────────────────────────────────────────────────────────────────────────

function DailyAttendance({ staff, canOperate = true, onAttendanceChange }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
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
    else { fetchAttendance(); onAttendanceChange?.(); showToast(`Marked ${status}`, 'success') }
  }

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const rec = attendance.find(a => a.staff_id === s.id)
      if (filter === 'present') return rec?.status === 'Present'
      if (filter === 'absent') return !rec || rec.status === 'Absent'
      if (filter === 'leave') return rec?.status === 'Leave'
      return true
    })
  }, [staff, attendance, filter])

  const statusButtons = [
    { label: '✓ Present', status: 'Present', color: '#16a34a' },
    { label: '✗ Absent', status: 'Absent', color: '#dc2626' },
    { label: '⏰ Late', status: 'Late', color: '#ca8a04' },
    { label: '✈ Leave', status: 'Leave', color: '#2563eb' },
  ]

  return (
    <div style={S.card}>
      <SectionHeader
        icon="📅"
        title="Daily Attendance"
        subtitle={`${attendance.filter(a => a.status === 'Present').length} present today`}
        action={
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ ...S.input, width: 140, padding: '7px 10px', fontSize: 12 }} />
        }
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'present', 'absent', 'leave'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={S.pill(filter === f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredStaff.map(s => {
            const rec = attendance.find(a => a.staff_id === s.id)
            const status = rec?.status || 'Not Marked'
            const statusColors = { Present: '#16a34a', Absent: '#dc2626', Late: '#ca8a04', Leave: '#2563eb', 'Not Marked': '#94a3b8' }
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <StaffAvatar name={s.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                    {s.department}
                    {rec?.geo_verified && <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 700 }}>📍 Geo ✓</span>}
                    {rec?.marked_by === 'Self' && <span style={{ marginLeft: 6, color: '#2563eb' }}>· Self check-in</span>}
                  </p>
                </div>
                {canOperate ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {statusButtons.map(btn => (
                      <button key={btn.status} onClick={() => markAttendance(s.id, btn.status)}
                        style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                          backgroundColor: status === btn.status ? btn.color : '#f1f5f9',
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
            backgroundColor: s.absenceCount > 5 ? '#fee2e2' : s.absenceCount > 3 ? '#fef9c3' : '#f8fafc' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{i + 1}. {s.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{s.department}</p>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.absenceCount > 5 ? '#dc2626' : s.absenceCount > 3 ? '#ca8a04' : '#374151' }}>
              {s.absenceCount} days
            </div>
          </div>
        ))}
        {topAbsentees.every(s => s.absenceCount === 0) && (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No absences recorded this month 🎉</p>
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
    if (roleKey) {
      updateFields[`${roleKey}_approved_at`] = ts
      updateFields[`${roleKey}_id`] = currentUser?.id
    }
    const { error } = await supabase.from('leaves').update(updateFields).eq('id', id)
    if (error) showToast(error.message)
    else { fetchLeaves(); showToast('Leave approved', 'success') }
  }

  const reject = async (id) => {
    const { error } = await supabase.from('leaves').update({ status: 'rejected', updated_at: new Date() }).eq('id', id)
    if (error) showToast(error.message)
    else { fetchLeaves(); showToast('Leave rejected', 'success') }
  }

  const statusBg = { submitted: '#fef9c3', hod_approved: '#dbeafe', principal_approved: '#ede9fe', approved: '#f0fdf4', rejected: '#fee2e2' }
  const role = currentUser?.role?.toLowerCase() || 'admin'

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
          <div key={leave.id} style={{ padding: 12, borderRadius: 8, backgroundColor: statusBg[leave.status] || '#f8fafc', border: `1px solid ${statusBg[leave.status] || '#e2e8f0'}88` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{leave.staff_profiles?.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                  {leave.leave_type} · {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)} ({leave.days_applied}d)
                </p>
                {leave.reason && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>Reason: {leave.reason}</p>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4 }}>
                {leave.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            {leave.status === 'submitted' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button onClick={() => approve(leave.id, role)} style={{ flex: 1, ...S.btn(true, '#16a34a'), fontSize: 12, padding: '6px 10px' }}>✓ Approve</button>
                <button onClick={() => reject(leave.id)} style={{ flex: 1, ...S.btn(true, '#dc2626'), fontSize: 12, padding: '6px 10px' }}>✗ Reject</button>
              </div>
            )}
          </div>
        ))}
        {leaves.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No leaves found</p>}
      </div>
      {showForm && <ApplyLeaveModal staff={staff} currentUser={currentUser} onClose={() => setShowForm(false)} onSaved={fetchLeaves} showToast={showToast} />}
      {ToastEl}
    </div>
  )
}

function ApplyLeaveModal({ staff, currentUser, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({ staff_id: '', start_date: todayStr(), end_date: todayStr(), reason: '' })
  const [saving, setSaving] = useState(false)
  const days = form.start_date && form.end_date
    ? Math.max(Math.ceil((new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1, 1)
    : 0
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
    else { showToast('Leave applied!', 'success'); onSaved(); onClose() }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ backgroundColor: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e3a5f' }}>Apply Leave</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} style={S.select}>
            <option value="">Select staff...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={S.input} />
            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={S.input} />
          </div>
          <input placeholder="Reason..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={S.input} />
          {days > 0 && <p style={{ margin: 0, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>Days requested: {days} {days > LEAVE_MONTHLY_LIMIT ? '⚠️ Exceeds monthly limit' : ''}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Cancel</button>
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
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{level} Risk</p>
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
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                    Serial absence: {r.factors.serial > 0 ? '⚠️ Yes' : '✓ No'} · Friday pattern: {r.factors.friday > 0 ? '⚠️ Yes' : '✓ No'}
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
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              {['Staff', 'Attend %', 'Punctual %', 'Discipline', 'Overall', 'Grade'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Staff' ? 'left' : 'center', fontWeight: 600, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scorecards.map(sc => {
              const s = staff.find(x => x.id === sc.staffId)
              const gradeColor = sc.grade === 'A' ? '#16a34a' : sc.grade === 'B' ? '#2563eb' : '#ca8a04'
              return (
                <tr key={sc.staffId} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: sc.overallScore >= 85 ? '#f0fdf4' : '#fff' }}>
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
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceEngine({ staff, logs }) {
  const [violations, setViolations] = useState([])
  const { show: showToast, ToastEl } = useToast()

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const all = []
    for (const s of staff) {
      const staffLogs = logs.filter(l => l.staff_id === s.id)
      if (countAbsencesInMonth(staffLogs, s.id, currentMonth) > 8)
        all.push({ staffId: s.id, staffName: s.name, rule: 'max_absences', severity: 'high',
          message: `${countAbsencesInMonth(staffLogs, s.id, currentMonth)} absences this month (limit: 8)`,
          suggestedAction: 'Issue warning letter' })
      if (detectSerialAbsence(staffLogs, s.id, 7, 3) > 0)
        all.push({ staffId: s.id, staffName: s.name, rule: 'serial_absence', severity: 'high',
          message: '3+ consecutive absences detected', suggestedAction: 'Notify HOD & schedule meeting' })
      if (detectFridayPattern(staffLogs, s.id, 2) >= 3)
        all.push({ staffId: s.id, staffName: s.name, rule: 'friday_pattern', severity: 'medium',
          message: 'Friday absence pattern (3+ in 2 months)', suggestedAction: 'Send warning & counselling' })
    }
    setViolations(all)
  }, [staff, logs])

  const C = {
    high: { bg: '#fee2e2', border: '#fecaca', text: '#991b1b' },
    medium: { bg: '#fef9c3', border: '#fde68a', text: '#92400e' },
    low: { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af' },
  }

  return (
    <div style={S.card}>
      <SectionHeader icon="⚖️" title="Compliance Engine" subtitle={`${violations.length} violation${violations.length !== 1 ? 's' : ''} detected`} />
      {violations.length === 0 && <p style={{ textAlign: 'center', color: '#16a34a', padding: 20 }}>✓ No violations detected</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {violations.map((v, i) => {
          const c = C[v.severity]
          return (
            <div key={i} style={{ padding: 12, borderRadius: 8, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
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
                <button onClick={() => setViolations(prev => prev.filter((_, j) => j !== i))}
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
// 8. SHIFT MANAGEMENT (fully fixed)
// ─────────────────────────────────────────────────────────────────────────────

function AssignShiftModal({ staff, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    staff_id: '', shift_slot: '', batch: '', subject: '',
    date_from: todayStr(), date_to: '', repeat: 'daily', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const selectedStaff = staff.find(s => String(s.id) === String(form.staff_id))
  const selectedSlot = SHIFT_SLOTS.find(s => s.id === form.shift_slot)

  const handleSave = async () => {
    if (!form.staff_id || !form.shift_slot || !form.batch || !form.subject) { showToast('Fill all required fields'); return }
    setSaving(true)
    const { error } = await supabase.from('staff_shift_assignments').insert([{
      staff_id: Number(form.staff_id),
      shift_id: form.shift_slot,
      date: form.date_from,
      primary_class: form.batch,
      subject: form.subject,
      time_slot: selectedSlot?.time || '',
      repeat_type: form.repeat,
      date_to: form.date_to || null,
      notes: form.notes || null,
      created_at: new Date().toISOString(),
    }])
    setSaving(false)
    if (error) showToast('Save failed: ' + error.message)
    else { showToast('Shift assigned!', 'success'); onSaved(); onClose() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', padding: '18px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white' }}>🔄 Assign Shift</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Staff */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Staff *</label>
            <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} style={S.select}>
              <option value="">Select staff...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || s.department}</option>)}
            </select>
            {selectedStaff && <div style={{ marginTop: 6, padding: '8px 12px', backgroundColor: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>👤 {selectedStaff.name} · {selectedStaff.department}</div>}
          </div>
          {/* Time slot grid */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Time Slot *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px,1fr))', gap: 6 }}>
              {SHIFT_SLOTS.map(slot => (
                <button key={slot.id} onClick={() => setForm({ ...form, shift_slot: slot.id })}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `2px solid ${form.shift_slot === slot.id ? '#1e3a5f' : '#e2e8f0'}`,
                    backgroundColor: form.shift_slot === slot.id ? '#1e3a5f' : 'white',
                    color: form.shift_slot === slot.id ? 'white' : '#374151', cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>
                  <div>{slot.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{slot.time}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Batch & Subject */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Batch *</label>
              <select value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} style={S.select}>
                <option value="">Select...</option>
                {BATCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Subject *</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={S.select}>
                <option value="">Select...</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>From Date *</label>
              <input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} style={S.input} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>To Date</label>
              <input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} style={S.input} />
            </div>
          </div>
          {/* Repeat */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase' }}>Repeat</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['daily', 'mon-sat', 'weekly', 'once'].map(r => (
                <button key={r} onClick={() => setForm({ ...form, repeat: r })}
                  style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${form.repeat === r ? '#1e3a5f' : '#e2e8f0'}`,
                    backgroundColor: form.repeat === r ? '#1e3a5f' : 'white',
                    color: form.repeat === r ? 'white' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {r === 'mon-sat' ? 'Mon–Sat' : r[0].toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" style={S.input} />
          {form.staff_id && form.shift_slot && form.batch && form.subject && (
            <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803d' }}>✅ Preview</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#374151' }}>
                <strong>{selectedStaff?.name}</strong> · {selectedSlot?.time} · {form.batch} · {form.subject}
              </p>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
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
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filterStaff, setFilterStaff] = useState('')
  const [filterSlot, setFilterSlot] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const { show: showToast, ToastEl } = useToast()

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
    const { error } = await supabase.from('staff_shift_assignments').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message)
    else { showToast('Shift removed', 'success'); fetchAssignments() }
    setConfirmDel(null)
  }

  const todayLogs = useMemo(() => logs.filter(l => l.date === selectedDate), [logs, selectedDate])

  const filtered = useMemo(() => assignments.filter(a =>
    (!filterStaff || String(a.staff_id) === filterStaff) &&
    (!filterSlot || a.shift_id === filterSlot)
  ), [assignments, filterStaff, filterSlot])

  // Coverage: count assigned staff vs present for each slot
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
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
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
                style={{ ...S.btn(true), padding: '8px 14px', fontSize: 12, background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
                ＋ Assign
              </button>
            )}
          </div>
        }
      />
      {/* Coverage */}
      {coverage.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
          {coverage.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 8,
              backgroundColor: c.present >= c.total ? '#f0fdf4' : c.present === 0 ? '#fee2e2' : '#fff7ed',
              border: `1px solid ${c.present >= c.total ? '#bbf7d0' : c.present === 0 ? '#fecaca' : '#fed7aa'}` }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{c.slot?.label}</p>
              <p style={{ margin: '1px 0 0', fontSize: 10, color: '#64748b' }}>{c.slot?.time}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: c.present > 0 ? '#16a34a' : '#dc2626' }}>
                {c.present}/{c.total} present
              </p>
            </div>
          ))}
        </div>
      )}
      {/* Filters */}
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
      {/* List */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🗓</div>
          <p style={{ margin: 0, fontSize: 13 }}>No shift assignments.{canOperate && ' Click ＋ Assign to add.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const slot = SHIFT_SLOTS.find(s => s.id === a.shift_id)
            const log = todayLogs.find(l => l.staff_id === a.staff_id)
            const status = log?.status || 'Not Marked'
            const sc = { Present: '#16a34a', Absent: '#dc2626', Late: '#ca8a04', 'Not Marked': '#94a3b8' }
            return (
              <div key={a.id} style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍🏫</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{a.staff_profiles?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{a.staff_profiles?.designation} · {a.staff_profiles?.department}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc[status] || '#94a3b8', backgroundColor: `${sc[status] || '#94a3b8'}15`, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>
                    {status}
                  </span>
                  {canOperate && (
                    <button onClick={() => setConfirmDel(a.id)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', flexShrink: 0 }}>🗑</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #f1f5f9', fontSize: 11 }}>
                  <div style={{ padding: '7px 12px', borderRight: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, color: '#94a3b8' }}>Slot</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#1e293b' }}>{slot?.label || a.shift_id}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 10, color: '#64748b' }}>{slot?.time || a.time_slot}</p>
                  </div>
                  <div style={{ padding: '7px 12px', borderRight: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, color: '#94a3b8' }}>Batch</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#1e293b' }}>{a.primary_class || '—'}</p>
                  </div>
                  <div style={{ padding: '7px 12px' }}>
                    <p style={{ margin: 0, color: '#94a3b8' }}>Subject</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#1e293b' }}>{a.subject || '—'}</p>
                  </div>
                </div>
                {(a.repeat_type || a.notes) && (
                  <div style={{ padding: '6px 12px', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
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
// 9. GEOLOCATION TRACKER (fully fixed + interconnected + admin override)
// ─────────────────────────────────────────────────────────────────────────────

function GeolocationTracker({ staff, canOperate = true, onAttendanceChange }) {
  const [checkins, setCheckins] = useState([])
  const [date, setDate] = useState(todayStr())
  const [loading, setLoading] = useState(false)
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

  /**
   * Admin override: mark geo check-in as verified AND sync to attendance_logs
   * This bridges self_attendance ↔ attendance_logs (the key interconnection fix)
   */
  const handleOverride = async (checkin) => {
    const { error: e1 } = await supabase
      .from('self_attendance')
      .update({ geo_verified: true, admin_overridden: true, admin_override_at: new Date().toISOString() })
      .eq('id', checkin.id)

    if (e1) { showToast('Override failed: ' + e1.message); return }

    // Sync to attendance_logs
    const { error: e2 } = await supabase.from('attendance_logs').upsert(
      [{ staff_id: checkin.staff_id, date: checkin.date, status: 'Present',
        marked_by: 'Geo', check_in_time: checkin.timestamp,
        geo_verified: true, geo_distance: null,
        notes: 'Admin override — geo check-in approved', updated_at: new Date() }],
      { onConflict: 'staff_id,date' }
    )

    if (e2) showToast('Attendance sync failed: ' + e2.message)
    else { showToast('Override approved & attendance marked Present', 'success'); fetchCheckins(); onAttendanceChange?.() }
  }

  /**
   * Auto-sync verified geo check-ins to attendance_logs
   * Runs when date changes — ensures any verified self check-in becomes a Present record
   */
  const syncVerifiedCheckins = async (checkinsData) => {
    const verified = checkinsData.filter(c => c.geo_verified || c.admin_overridden)
    for (const c of verified) {
      await supabase.from('attendance_logs').upsert(
        [{ staff_id: c.staff_id, date: c.date, status: 'Present',
          marked_by: 'Geo', check_in_time: c.timestamp,
          geo_verified: true, geo_distance: c.geo_distance,
          updated_at: new Date() }],
        { onConflict: 'staff_id,date' }
      )
    }
    if (verified.length > 0) onAttendanceChange?.()
  }

  useEffect(() => {
    if (checkins.length > 0) syncVerifiedCheckins(checkins)
  }, [checkins])

  // Stats
  const stats = useMemo(() => ({
    total: checkins.length,
    verified: checkins.filter(c => c.geo_verified || c.admin_overridden).length,
    rejected: checkins.filter(c => !c.geo_verified && !c.admin_overridden).length,
    noGps: checkins.filter(c => c.location_lat == null).length,
  }), [checkins])

  return (
    <div style={S.card}>
      <SectionHeader
        icon="📍" title="Geolocation Verification"
        subtitle={`${stats.verified} verified · ${stats.rejected} rejected · ${stats.noGps} no GPS`}
        action={<input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...S.input, width: 140, padding: '7px 10px', fontSize: 12 }} />}
      />

      {/* Stat pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Verified</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{stats.verified}</p>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #fecaca', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Rejected</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{stats.rejected}</p>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>No GPS</p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#94a3b8' }}>{stats.noGps}</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading...</p>
      ) : checkins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
          <p style={{ margin: 0, fontSize: 13 }}>No self check-ins for this date</p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>Staff check-ins via QR/PIN appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checkins.map(c => {
            const v = verifyGeolocation(c.location_lat, c.location_lng)
            const isApproved = c.geo_verified || c.admin_overridden
            const bg = isApproved ? '#f0fdf4' : v.verified ? '#f0fdf4' : '#fee2e2'
            const border = isApproved ? '#bbf7d0' : v.verified ? '#bbf7d0' : '#fecaca'
            const textColor = isApproved || v.verified ? '#166534' : '#991b1b'

            return (
              <div key={c.id} style={{ padding: '12px', borderRadius: 10, backgroundColor: bg, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <StaffAvatar name={c.staff_profiles?.name} size={28} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{c.staff_profiles?.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{c.staff_profiles?.department}</p>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>🕐 {new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} via {c.method}</span>
                      {c.location_lat != null
                        ? <span>📍 {Number(c.location_lat).toFixed(5)}, {Number(c.location_lng).toFixed(5)} — {v.message}</span>
                        : <span>📍 No GPS coordinates recorded</span>
                      }
                      {c.admin_overridden && <span style={{ color: '#2563eb', fontWeight: 600 }}>✅ Admin override approved</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: textColor, padding: '3px 10px',
                      backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999 }}>
                      {isApproved ? '✓ Verified' : v.verified ? '✓ Verified' : '✗ Rejected'}
                    </span>
                    {/* Admin override button for rejected/no-GPS check-ins */}
                    {canOperate && !isApproved && !v.verified && (
                      <button onClick={() => handleOverride(c)}
                        style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                          border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer' }}>
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

      <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: 11, color: '#64748b' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>ℹ️ How it works</p>
        <p style={{ margin: '4px 0 0' }}>
          Staff check in via QR/PIN on their device. GPS coordinates are verified against school boundary ({GEOFENCE.allowedRadius}m radius).
          Verified check-ins automatically update <strong>Daily Attendance</strong> as Present.
          Rejected check-ins can be manually overridden by Admin/VP.
        </p>
      </div>
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. BULK OPERATIONS (fixed: upsert instead of insert)
// ─────────────────────────────────────────────────────────────────────────────

function BulkOperations({ staff, canOperate = true, onAttendanceChange }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [importPreview, setImportPreview] = useState([])
  const { show: showToast, ToastEl } = useToast()

  const markAll = async (status) => {
    const records = staff.map(s => ({ staff_id: s.id, date: selectedDate, status, marked_by: 'Bulk', updated_at: new Date() }))
    const { error } = await supabase.from('attendance_logs').upsert(records, { onConflict: 'staff_id,date' })
    if (error) showToast(error.message)
    else { showToast(`${staff.length} staff marked ${status}`, 'success'); onAttendanceChange?.() }
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
    else { showToast(`${importPreview.length} records imported!`, 'success'); setImportPreview([]); onAttendanceChange?.() }
  }

  return (
    <div style={S.card}>
      <SectionHeader icon="⚙️" title="Bulk Operations" subtitle="Mass attendance management" />
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>Target Date</label>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...S.input, maxWidth: 200 }} />
      </div>
      {canOperate ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button onClick={() => markAll('Present')} style={{ ...S.btn(true, '#16a34a'), fontSize: 12, padding: '10px 8px' }}>✓ Mark All Present</button>
          <button onClick={() => markAll('Absent')} style={{ ...S.btn(true, '#dc2626'), fontSize: 12, padding: '10px 8px' }}>✗ Mark All Absent</button>
          <label style={{ ...S.btn(true, '#1e3a5f'), fontSize: 12, padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            📥 Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          🔒 Bulk operations restricted to Admin & Vice Principal
        </div>
      )}
      {importPreview.length > 0 && (
        <div style={{ padding: 12, backgroundColor: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Preview: {importPreview.length} records</p>
          <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
            {importPreview.slice(0, 5).map((r, i) => {
              const s = staff.find(x => x.id === r.staff_id)
              return <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#374151' }}>{s?.name || r.staff_id} → {r.status}</p>
            })}
            {importPreview.length > 5 && <p style={{ margin: '2px 0', fontSize: 11, color: '#64748b' }}>+{importPreview.length - 5} more...</p>}
          </div>
          <button onClick={confirmImport} style={{ ...S.btn(true, '#16a34a'), width: '100%', fontSize: 12, padding: 8 }}>✓ Confirm Import</button>
        </div>
      )}
      <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#374151', fontWeight: 600 }}>CSV Format:</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>staff_id,status</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>101,Present</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>102,Absent</p>
      </div>
      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

function DailyAttendanceTracker({ currentUser: appUser, staffProp }) {
  const [staff, setStaff] = useState(staffProp || [])
  const [logs, setLogs] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard')
  const currentUser = appUser || { id: 1, role: 'Admin' }

  const canOperate = ['Admin', 'Vice Principal', 'Principal'].includes(currentUser?.role)

  const loadData = useCallback(async () => {
    const [{ data: staffData }, { data: logsData }, { data: recordsData }] = await Promise.all([
      supabase.from('staff_profiles').select('id, name, department, designation').order('name'),
      supabase.from('attendance_logs').select('*').order('date', { ascending: false }),
      supabase.from('hr_records').select('*').eq('is_archived', false).order('created_at', { ascending: false }),
    ])
    if (staffData) setStaff(staffData)
    if (logsData) setLogs(logsData)
    if (recordsData) setRecords(recordsData)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Called by components that modify attendance_logs so other components refresh
  const refreshLogs = useCallback(async () => {
    const { data } = await supabase.from('attendance_logs').select('*').order('date', { ascending: false })
    if (data) setLogs(data)
  }, [])

  const sections = [
    { key: 'dashboard',   label: '📊', full: 'Dashboard'   },
    { key: 'daily',       label: '📅', full: 'Daily'       },
    { key: 'absent',      label: '📉', full: 'Absentees'   },
    { key: 'leave',       label: '🏖️', full: 'Leaves'      },
    { key: 'risk',        label: '🎯', full: 'Risk'        },
    { key: 'performance', label: '📈', full: 'Performance' },
    { key: 'compliance',  label: '⚖️', full: 'Compliance'  },
    { key: 'shift',       label: '🔄', full: 'Shifts'      },
    { key: 'geo',         label: '📍', full: 'Geo'         },
    { key: 'bulk',        label: '⚙️', full: 'Bulk Ops'    },
  ]

  const colorMap = {
    dashboard:   '#1e3a5f', daily:       '#15803d', absent:      '#c2410c',
    leave:       '#7e22ce', risk:        '#b91c1c', performance: '#0f766e',
    compliance:  '#a16207', shift:       '#0369a1', geo:         '#6d28d9',
    bulk:        '#334155',
  }

  if (loading) return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
      ⏳ Loading Attendance System...
    </div>
  )

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📊 Attendance Tracker</h1>
          <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>{staff.length} staff · {logs.length} records · {fmtDate(new Date())}</p>
        </div>
        <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d' }}>● Live</span>
      </div>

      {!canOperate && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, marginBottom: 16, backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}>
          <span style={{ fontSize: 18 }}>👁</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>View Only Mode</p>
            <p style={{ margin: 0, fontSize: 11, color: '#a16207' }}>Only Admin & Vice Principal can mark attendance.</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px,1fr))', gap: 8, marginBottom: 20 }}>
        {sections.map(sec => {
          const isActive = activeSection === sec.key
          const color = colorMap[sec.key]
          return (
            <button key={sec.key} onClick={() => setActiveSection(sec.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 6px', borderRadius: 12, cursor: 'pointer', minHeight: 68,
                border: isActive ? `2px solid ${color}` : '2px solid transparent',
                backgroundColor: isActive ? color : 'white',
                boxShadow: isActive ? `0 4px 14px ${color}33` : '0 1px 4px rgba(0,0,0,0.07)',
                transition: 'all 0.18s' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{sec.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'white' : '#64748b', textAlign: 'center', lineHeight: 1.2 }}>
                {sec.full}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sections — pass refreshLogs as onAttendanceChange for cross-component sync */}
      {activeSection === 'dashboard'   && <VPDashboard staff={staff} logs={logs} records={records} />}
      {activeSection === 'daily'       && <DailyAttendance staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
      {activeSection === 'absent'      && <AbsentTracker staff={staff} logs={logs} />}
      {activeSection === 'leave'       && <LeaveManagement staff={staff} currentUser={currentUser} />}
      {activeSection === 'risk'        && <PredictiveAnalytics staff={staff} logs={logs} />}
      {activeSection === 'performance' && <PerformanceScorecards staff={staff} logs={logs} />}
      {activeSection === 'compliance'  && <ComplianceEngine staff={staff} logs={logs} />}
      {activeSection === 'shift'       && <ShiftManagement staff={staff} logs={logs} canOperate={canOperate} />}
      {activeSection === 'geo'         && <GeolocationTracker staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
      {activeSection === 'bulk'        && <BulkOperations staff={staff} canOperate={canOperate} onAttendanceChange={refreshLogs} />}
    </div>
  )
}

export default DailyAttendanceTracker
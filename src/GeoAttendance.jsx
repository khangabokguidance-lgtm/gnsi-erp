/**
 * GeoAttendance.jsx — Enhanced Geo-Attendance System
 *
 * NEW FEATURES:
 *  1. Continuous GPS tracking throughout entire shift (pings every 2 min)
 *  2. Early-out detection  — flags if staff leaves campus before shift ends
 *  3. Late-entry detection — 10-min window at shift start; "Late" status auto-set
 *  4. Location breadcrumb trail stored in `attendance_location_trail` table
 *  5. Advance tracker synced with Salary.jsx (reads staff_advances table)
 *  6. Salary deduction preview — shows pending advance deduction live
 *  7. Admin: shift timeline view per staff member
 *
 * SUPABASE TABLES NEEDED (new):
 *   attendance_location_trail (id, attendance_id, staff_id, lat, lng, accuracy, recorded_at, on_campus, event_type)
 *   — event_type: 'ping' | 'left_campus' | 'returned' | 'shift_end'
 *
 * EXISTING TABLES USED:
 *   attendance_zones, staff_shifts, staff_geo_attendance, attendance_fraud_log, staff_advances
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CAMPUS    = { lat: 24.6821, lng: 93.9876, radius: 100 }
const TRACK_INTERVAL_MS = 2 * 60 * 1000   // ping every 2 minutes
const EARLY_OUT_BUFFER  = 5               // minutes before shift end — grace for packing up

const FRAUD_TYPES = {
  outside_campus: { label: 'Outside Campus',     color: '#ef4444', icon: '📍' },
  fake_gps:       { label: 'Fake GPS Suspected',  color: '#f97316', icon: '🛰️' },
  wrong_time:     { label: 'Outside Time Window', color: '#f59e0b', icon: '⏰' },
  duplicate:      { label: 'Duplicate Attempt',   color: '#8b5cf6', icon: '🔁' },
  device_clash:   { label: 'Shared Device',       color: '#ec4899', icon: '📱' },
  velocity:       { label: 'Velocity Anomaly',    color: '#06b6d4', icon: '⚡' },
  early_out:      { label: 'Early Departure',     color: '#dc2626', icon: '🏃' },
  absent_period:  { label: 'Absent From Campus',  color: '#a855f7', icon: '👻' },
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function getDistance(lat1, lng1, lat2, lng2) {
  const R    = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getDeviceFingerprint() {
  try {
    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font      = '14px Arial'
    ctx.fillStyle = '#1e3a5f'
    ctx.fillText('GNSI-FP-2026', 2, 2)
    return btoa([
      canvas.toDataURL().slice(-50),
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      navigator.language,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|')).slice(0, 64)
  } catch { return 'unknown-' + Date.now() }
}

// shift times → minutes-since-midnight
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() }

function isWithinWindow(shiftStart, windowMin = 10) {
  const diff = nowMin() - toMin(shiftStart)
  return diff >= -windowMin && diff <= windowMin
}

function minutesUntilWindow(shiftStart, windowMin = 10) {
  return toMin(shiftStart) - windowMin - nowMin()
}

function isShiftActive(shift) {
  const nm = nowMin()
  return nm >= toMin(shift.shift_start) - (shift.check_in_window_min || 10) &&
    nm <= toMin(shift.shift_end) + EARLY_OUT_BUFFER
}

function minutesToShiftEnd(shift) {
  return toMin(shift.shift_end) - nowMin()
}

const today   = () => new Date().toISOString().split('T')[0]
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (d)   => d   ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmt12   = (t)   => {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const fmtRupee    = (n)   => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

// ─── Shared Styles ────────────────────────────────────────────────────────────

const S = {
  page:  { padding: '24px', fontFamily: "'Segoe UI',sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn:   (c = '#1e3a5f', dis = false) => ({ backgroundColor: dis ? '#94a3b8' : c, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: dis ? 0.7 : 1 }),
  btnSm: (c = '#1e3a5f') => ({ backgroundColor: c, color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }),
  input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  tab:   (a) => ({ padding: '10px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', background: 'none', border: 'none', borderBottom: `3px solid ${a ? '#1e3a5f' : 'transparent'}`, color: a ? '#1e3a5f' : '#64748b' }),
}
const th = { padding: '11px 14px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', background: '#f8fafc' }
const td = { padding: '11px 14px', verticalAlign: 'middle', color: '#334155', fontSize: '13px' }

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    Present: { bg: '#dcfce7', color: '#16a34a', icon: '✅' },
    Late:    { bg: '#fef3c7', color: '#b45309', icon: '🕐' },
    Outside: { bg: '#fee2e2', color: '#dc2626', icon: '📍' },
    Flagged: { bg: '#fce7f3', color: '#be185d', icon: '🚨' },
    Absent:  { bg: '#f1f5f9', color: '#64748b', icon: '⭕' },
    Pending: { bg: '#eff6ff', color: '#1d4ed8', icon: '⏳' },
    EarlyOut:{ bg: '#fee2e2', color: '#dc2626', icon: '🏃' },
  }
  const m = map[status] || map.Pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', background: m.bg, color: m.color }}>
      {m.icon} {status}
    </span>
  )
}

function FraudBadge({ type }) {
  const m = FRAUD_TYPES[type] || { label: type, color: '#64748b', icon: '⚠️' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: m.color + '18', color: m.color, border: `1px solid ${m.color}44` }}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── GPS Ring ─────────────────────────────────────────────────────────────────

function GPSRing({ status, distance, accuracy, campus, tracking, minsLeft }) {
  const colors = { idle: '#94a3b8', locating: '#f59e0b', oncampus: '#16a34a', outside: '#ef4444', error: '#ef4444', weak: '#f97316', tracking: '#0ea5e9' }
  const color    = colors[status] || colors.idle
  const isActive = status === 'oncampus' || status === 'tracking'
  const pct      = campus ? Math.max(0, Math.min(100, (1 - (distance || 0) / campus.radius) * 100)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 20px' }}>
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        {isActive && (
          <div style={{ position: 'absolute', inset: '-8px', borderRadius: '50%', border: `2px solid ${color}55`, animation: 'pulse 2s infinite' }} />
        )}
        {tracking && (
          <div style={{ position: 'absolute', inset: '-16px', borderRadius: '50%', border: `2px solid #0ea5e9`, opacity: 0.4, animation: 'pulse 1s infinite' }} />
        )}
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
          <circle cx="70" cy="70" r="58" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="70" cy="70" r="58" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 58}`}
            strokeDashoffset={`${2 * Math.PI * 58 * (1 - (status === 'locating' ? 0.7 : isActive ? pct / 100 : 0.2))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '32px', lineHeight: 1 }}>
            {status === 'idle'     ? '📍'
            : status === 'locating' ? '📡'
            : status === 'oncampus' ? '✅'
            : status === 'tracking' ? '🛰️'
            : status === 'outside'  ? '❌'
            : status === 'weak'     ? '⚠️'
            : '❌'}
          </div>
          {distance !== null && distance !== undefined && status !== 'locating' && status !== 'idle' && (
            <div style={{ fontSize: '13px', fontWeight: '800', color, marginTop: '4px' }}>{Math.round(distance)}m</div>
          )}
          {tracking && minsLeft !== null && (
            <div style={{ fontSize: '10px', color: '#0ea5e9', marginTop: '2px', fontWeight: '700' }}>{minsLeft}m left</div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', color }}>
          {status === 'idle'     ? 'Ready to Check In'
          : status === 'locating' ? 'Detecting Location...'
          : status === 'oncampus' ? 'You are ON CAMPUS'
          : status === 'tracking' ? '🛰️ Shift Tracking Active'
          : status === 'outside'  ? `Outside Campus — ${Math.round(distance || 0)}m away`
          : status === 'weak'     ? 'GPS Signal Weak'
          : 'Location Error'}
        </div>
        {tracking && (
          <div style={{ fontSize: '12px', color: '#0ea5e9', marginTop: '4px', fontWeight: '600' }}>
            📡 Location logged every 2 minutes
          </div>
        )}
        {accuracy && status !== 'idle' && status !== 'error' && (
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>GPS Accuracy: ±{Math.round(accuracy)}m</div>
        )}
      </div>
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:0.8}50%{transform:scale(1.08);opacity:0.4}100%{transform:scale(1);opacity:0.8}}`}</style>
    </div>
  )
}

// ─── Shift Timeline (Admin) ───────────────────────────────────────────────────

function ShiftTimeline({ trail, shift }) {
  if (!trail.length || !shift) return null

  const startMin = toMin(shift.shift_start)
  const endMin   = toMin(shift.shift_end)
  const spanMin  = endMin - startMin

  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginTop: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', marginBottom: '10px' }}>
        📍 Location Trail — Shift {shift.shift_label} ({fmt12(shift.shift_start)} → {fmt12(shift.shift_end)})
      </div>
      {/* Timeline bar */}
      <div style={{ position: 'relative', height: '24px', background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
        {trail.map((pt, i) => {
          const ptMin = new Date(pt.recorded_at).getHours() * 60 + new Date(pt.recorded_at).getMinutes()
          const pct   = Math.min(100, Math.max(0, ((ptMin - startMin) / spanMin) * 100))
          return (
            <div key={i} title={`${fmtTime(pt.recorded_at)} — ${pt.on_campus ? 'On campus' : `${Math.round(pt.distance_from_campus || 0)}m away`}`}
              style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '10px', height: '10px', borderRadius: '50%', background: pt.on_campus ? '#16a34a' : '#ef4444', border: '2px solid white', cursor: 'pointer' }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
        <span>{fmt12(shift.shift_start)}</span>
        <span style={{ display: 'flex', gap: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> On campus</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Off campus</span>
        </span>
        <span>{fmt12(shift.shift_end)}</span>
      </div>
      {/* Events list */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
        {trail.filter(pt => pt.event_type !== 'ping').map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', padding: '4px 8px', background: 'white', borderRadius: '6px' }}>
            <span>{pt.event_type === 'left_campus' ? '🏃' : pt.event_type === 'returned' ? '✅' : pt.event_type === 'shift_end' ? '🏁' : '📍'}</span>
            <span style={{ color: '#64748b' }}>{fmtTime(pt.recorded_at)}</span>
            <span style={{ fontWeight: '600', color: pt.on_campus ? '#16a34a' : '#dc2626' }}>
              {pt.event_type === 'left_campus' ? 'Left campus'
              : pt.event_type === 'returned'   ? 'Returned to campus'
              : pt.event_type === 'shift_end'  ? 'Shift ended'
              : pt.on_campus                   ? 'On campus'
              : `Off campus (${Math.round(pt.distance_from_campus || 0)}m)`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Advance Summary Widget ───────────────────────────────────────────────────

function AdvanceSummary({ staffId, advances }) {
  const myAdvances = advances.filter(a => String(a.staff_id) === String(staffId) && a.status === 'Active')
  if (!myAdvances.length) return null

  const totalPending = myAdvances.reduce((sum, a) => {
    const rem = Number(a.amount) - Number(a.repaid_amount)
    const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
    return sum + Math.min(pm, rem)
  }, 0)

  return (
    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#b45309' }}>💳 Active Advance Deductions</div>
          <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>
            {myAdvances.length} advance(s) · Will be deducted from next salary
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#b45309' }}>{fmtRupee(totalPending)}</div>
      </div>
      {myAdvances.map(a => {
        const rem = Number(a.amount) - Number(a.repaid_amount)
        const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
        const pct = Math.min(100, Math.round((Number(a.repaid_amount) / Number(a.amount)) * 100))
        return (
          <div key={a.id} style={{ marginTop: '10px', padding: '8px 12px', background: 'white', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#374151', fontWeight: '600' }}>{a.reason || 'Advance'} · {a.issued_month}</span>
              <span style={{ color: '#b45309', fontWeight: '700' }}>Next deduction: {fmtRupee(Math.min(pm, rem))}</span>
            </div>
            <div style={{ marginTop: '6px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
              Remaining: {fmtRupee(rem)} of {fmtRupee(a.amount)} · {pct}% repaid
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GeoAttendance({ currentStaff, isAdmin, allStaff = [] }) {
  const [activeTab,    setActiveTab]    = useState(isAdmin ? 'admin' : 'checkin')
  const [campus,       setCampus]       = useState(null)
  const [shifts,       setShifts]       = useState([])
  const [todayLogs,    setTodayLogs]    = useState([])
  const [fraudLogs,    setFraudLogs]    = useState([])
  const [monthLogs,    setMonthLogs]    = useState([])
  const [advances,     setAdvances]     = useState([])   // ← from staff_advances
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState('')
  const [toastType,    setToastType]    = useState('ok')

  // GPS state
  const [gpsStatus,    setGpsStatus]    = useState('idle')
  const [gpsCoords,    setGpsCoords]    = useState(null)
  const [gpsDistance,  setGpsDistance]  = useState(null)
  const [gpsAccuracy,  setGpsAccuracy]  = useState(null)
  const [checkingIn,   setCheckingIn]   = useState(false)
  const [myLogs,       setMyLogs]       = useState([])
  const [myShifts,     setMyShifts]     = useState([])

  // Continuous tracking state
  const [activeTracking, setActiveTracking] = useState([])
  // activeTracking: [{ logId, shiftId, shiftLabel, shift }]
  const [lastPingTime, setLastPingTime]     = useState(null)
  const [offCampusSince, setOffCampusSince] = useState(null) // ISO string
  const [trailMap,     setTrailMap]         = useState({})   // logId → trail[]

  // Admin state
  const [campusForm,   setCampusForm]   = useState({ name: 'Main Campus', lat: '', lng: '', radius: 100 })
  const [savingCampus, setSavingCampus] = useState(false)
  const [shiftForms,   setShiftForms]   = useState([])
  const [savingShifts, setSavingShifts] = useState(false)
  const [selectedStaff,setSelectedStaff]= useState('')
  const [monthFilter,  setMonthFilter]  = useState(new Date().toISOString().slice(0, 7))
  const [resolvingId,  setResolvingId]  = useState(null)
  const [resolveNote,  setResolveNote]  = useState('')
  const [expandedTrail,setExpandedTrail]= useState(null) // logId

  const watchRef    = useRef(null)
  const trackRef    = useRef(null)
  const coordsRef   = useRef(null)   // always-fresh coords for interval
  const trackingRef = useRef([])     // always-fresh tracking list

  // keep refs in sync
  useEffect(() => { coordsRef.current = gpsCoords }, [gpsCoords])
  useEffect(() => { trackingRef.current = activeTracking }, [activeTracking])

  const showToast = (msg, type = 'ok') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4500)
  }

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchCampus = useCallback(async () => {
    const { data } = await supabase.from('attendance_zones').select('*').eq('is_active', true).single()
    if (data) {
      setCampus({ lat: data.latitude, lng: data.longitude, radius: data.radius_meters, name: data.name, id: data.id })
      setCampusForm({ name: data.name, lat: data.latitude, lng: data.longitude, radius: data.radius_meters })
    } else {
      setCampus(DEFAULT_CAMPUS)
    }
  }, [])

  const fetchShiftsFor = useCallback(async (staffId) => {
    if (!staffId) return []
    const { data } = await supabase.from('staff_shifts').select('*').eq('staff_id', staffId).eq('is_active', true).order('shift_start')
    return data || []
  }, [])

  const fetchTodayLogs = useCallback(async () => {
    const { data } = await supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name,designation,department)')
      .eq('date', today())
      .order('check_in_time', { ascending: false })
    setTodayLogs(data || [])
  }, [])

  const fetchFraudLogs = useCallback(async () => {
    const { data } = await supabase.from('attendance_fraud_log')
      .select('*, staff_profiles(name,designation)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)
    setFraudLogs(data || [])
  }, [])

  const fetchMyLogs = useCallback(async () => {
    if (!currentStaff?.id) return
    const { data } = await supabase.from('staff_geo_attendance')
      .select('*')
      .eq('staff_id', currentStaff.id)
      .order('date', { ascending: false })
      .limit(30)
    setMyLogs(data || [])
  }, [currentStaff?.id])

  const fetchMonthLogs = useCallback(async () => {
    if (!monthFilter) return
    const from = monthFilter + '-01'
    const to   = monthFilter + '-31'
    let q = supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name,designation,department)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
    if (selectedStaff) q = q.eq('staff_id', selectedStaff)
    const { data } = await q
    setMonthLogs(data || [])
  }, [monthFilter, selectedStaff])

  const fetchAdvances = useCallback(async () => {
    const { data } = await supabase.from('staff_advances').select('*').order('created_at', { ascending: false })
    setAdvances(data || [])
  }, [])

  const fetchTrailForLog = useCallback(async (logId) => {
    const { data } = await supabase.from('attendance_location_trail')
      .select('*').eq('attendance_id', logId).order('recorded_at')
    setTrailMap(prev => ({ ...prev, [logId]: data || [] }))
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchCampus()
      await fetchAdvances()
      if (currentStaff?.id) {
        const sh = await fetchShiftsFor(currentStaff.id)
        setMyShifts(sh)
        await fetchMyLogs()
      }
      if (isAdmin) {
        await fetchTodayLogs()
        await fetchFraudLogs()
      }
      setLoading(false)
    }
    init()
  }, [currentStaff?.id, isAdmin])

  useEffect(() => { if (isAdmin && activeTab === 'monitor') fetchTodayLogs() }, [activeTab])
  useEffect(() => { if (isAdmin && activeTab === 'fraud')   fetchFraudLogs() }, [activeTab])
  useEffect(() => { if (isAdmin && activeTab === 'report')  fetchMonthLogs() }, [activeTab, monthFilter, selectedStaff])
  useEffect(() => {
    if (isAdmin && activeTab === 'shifts' && selectedStaff) {
      fetchShiftsFor(selectedStaff).then(sh => setShiftForms(sh.map(s => ({ ...s, _edit: false }))))
    }
  }, [activeTab, selectedStaff])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    if (trackRef.current) clearInterval(trackRef.current)
  }, [])

  // ── Restore active tracking on reload ─────────────────────────────────────
  // If staff refreshed mid-shift, re-attach tracking to existing check-in logs

  useEffect(() => {
    if (!myLogs.length || !myShifts.length || !campus) return
    const todayActive = myLogs.filter(l => l.date === today() && !l.check_out_time)
    if (!todayActive.length) return
    const trackList = todayActive.map(l => {
      const sh = myShifts.find(s => s.shift_label === l.shift_label)
      return sh ? { logId: l.id, shiftId: sh.id, shiftLabel: sh.shift_label, shift: sh } : null
    }).filter(Boolean)
    if (trackList.length && !activeTracking.length) {
      setActiveTracking(trackList)
      showToast('🛰️ Resumed location tracking for active shift(s)', 'ok')
    }
  }, [myLogs, myShifts, campus])

  // ── Continuous GPS watch ──────────────────────────────────────────────────

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { showToast('❌ GPS not supported', 'err'); return }
    setGpsStatus('locating')
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsCoords({ lat: latitude, lng: longitude })
        setGpsAccuracy(accuracy)
        if (!campus) return
        const dist = getDistance(latitude, longitude, campus.lat, campus.lng)
        setGpsDistance(dist)
        if (accuracy > 60)          setGpsStatus('weak')
        else if (dist <= campus.radius) setGpsStatus(trackingRef.current.length ? 'tracking' : 'oncampus')
        else                          setGpsStatus('outside')
      },
      (err) => {
        setGpsStatus('error')
        const msgs = { 1: 'Location permission denied.', 2: 'GPS unavailable.', 3: 'GPS timeout.' }
        showToast('❌ ' + (msgs[err.code] || 'Location error'), 'err')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [campus])

  // ── Interval: ping location every 2 min during active tracking ───────────

  useEffect(() => {
    if (trackRef.current) clearInterval(trackRef.current)
    if (!activeTracking.length) return

    trackRef.current = setInterval(async () => {
      const coords   = coordsRef.current
      const tracking = trackingRef.current
      if (!coords || !campus || !tracking.length) return

      const dist      = getDistance(coords.lat, coords.lng, campus.lat, campus.lng)
      const onCampus  = dist <= campus.radius
      const nowISO    = new Date().toISOString()

      setLastPingTime(nowISO)

      for (const t of tracking) {
        const minsLeft = minutesToShiftEnd(t.shift)

        // Detect early out: left campus with > 5 min of shift remaining
        if (!onCampus && minsLeft > EARLY_OUT_BUFFER) {
          setOffCampusSince(prev => prev || nowISO)
        } else if (onCampus) {
          const wasOff = offCampusSince
          setOffCampusSince(null)

          // Log "returned to campus" event
          if (wasOff) {
            await supabase.from('attendance_location_trail').insert({
              attendance_id: t.logId, staff_id: currentStaff?.id,
              lat: coords.lat, lng: coords.lng,
              accuracy: gpsAccuracy, recorded_at: nowISO,
              on_campus: true, event_type: 'returned',
              distance_from_campus: Math.round(dist),
            })
          }
        }

        // Determine event type
        let eventType = 'ping'
        if (!onCampus && minsLeft > EARLY_OUT_BUFFER) {
          const prevPings = await supabase.from('attendance_location_trail')
            .select('on_campus').eq('attendance_id', t.logId)
            .order('recorded_at', { ascending: false }).limit(1)
          const prevOnCampus = prevPings.data?.[0]?.on_campus ?? true
          if (prevOnCampus) eventType = 'left_campus'
        }
        if (minsLeft <= 0) eventType = 'shift_end'

        // Write ping
        await supabase.from('attendance_location_trail').insert({
          attendance_id: t.logId, staff_id: currentStaff?.id,
          lat: coords.lat, lng: coords.lng,
          accuracy: gpsAccuracy, recorded_at: nowISO,
          on_campus: onCampus, event_type: eventType,
          distance_from_campus: Math.round(dist),
        })

        // Early-out fraud flag (only flag once: when left_campus is detected)
        if (eventType === 'left_campus') {
          await supabase.from('attendance_fraud_log').insert({
            staff_id: currentStaff?.id, date: today(), shift_label: t.shiftLabel,
            fraud_type: 'early_out',
            detail: `Left campus ${Math.round(minsLeft)} min before shift end at ${fmtTime(nowISO)}`,
            lat: coords.lat, lng: coords.lng, accuracy: gpsAccuracy,
            created_at: nowISO,
          })
          // Update attendance status to EarlyOut
          await supabase.from('staff_geo_attendance')
            .update({ status: 'EarlyOut', is_fraud_suspected: true,
              fraud_flags: [{ type: 'early_out', detail: `Left campus ${Math.round(minsLeft)} min early` }]
            }).eq('id', t.logId)
          showToast('⚠️ You left campus early. This has been reported to admin.', 'warn')
        }

        // Auto-checkout when shift ends
        if (minsLeft <= 0) {
          await supabase.from('staff_geo_attendance').update({
            check_out_time: nowISO,
            check_out_lat: coords.lat, check_out_lng: coords.lng,
          }).eq('id', t.logId).is('check_out_time', null)

          setActiveTracking(prev => prev.filter(x => x.logId !== t.logId))
          showToast(`🏁 Shift ${t.shiftLabel} ended — auto checked-out`, 'ok')
        }
      }

      // If no more active shifts, stop tracker
      if (tracking.every(t => minutesToShiftEnd(t.shift) <= 0)) {
        clearInterval(trackRef.current)
        setActiveTracking([])
        setGpsStatus('oncampus')
      }

      await fetchMyLogs()
    }, TRACK_INTERVAL_MS)

    return () => clearInterval(trackRef.current)
  }, [activeTracking, campus, currentStaff?.id, offCampusSince])

  // ── Fraud logger ──────────────────────────────────────────────────────────

  const logFraud = async (staffId, date, shiftLabel, type, detail, extra = {}) => {
    await supabase.from('attendance_fraud_log').insert({
      staff_id: staffId, date, shift_label: shiftLabel,
      fraud_type: type, detail,
      lat: extra.lat, lng: extra.lng,
      accuracy: extra.accuracy, device_fingerprint: extra.fp,
      created_at: new Date().toISOString()
    })
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  const handleCheckIn = async (shift) => {
    if (!currentStaff?.id) { showToast('❌ Staff profile not found', 'err'); return }
    if (!campus)            { showToast('❌ Campus zone not configured', 'err'); return }
    if (!gpsCoords)         { showToast('❌ GPS not ready — click Detect Location first', 'err'); return }
    if (gpsAccuracy > 60)   { showToast('⚠️ GPS signal too weak. Move outdoors.', 'warn'); return }

    setCheckingIn(true)
    const fraudFlags = []
    const fp         = getDeviceFingerprint()
    const now        = new Date()
    const dateStr    = today()

    try {
      // ① Time window check
      if (!isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)) {
        const minsLeft = minutesUntilWindow(shift.shift_start, shift.check_in_window_min || 10)
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'wrong_time',
          `Check-in at ${now.toLocaleTimeString()} outside ±${shift.check_in_window_min || 10}min window`)
        showToast(minsLeft > 0
          ? `⏰ Window opens in ${minsLeft} min (${fmt12(shift.shift_start)} ±${shift.check_in_window_min || 10}min)`
          : `⏰ Check-in window closed for Shift ${shift.shift_label}`, 'warn')
        setCheckingIn(false); return
      }

      // ② Duplicate check
      const { data: existing } = await supabase.from('staff_geo_attendance')
        .select('id').eq('staff_id', currentStaff.id).eq('date', dateStr).eq('shift_label', shift.shift_label).single()
      if (existing) {
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'duplicate', 'Second check-in attempt')
        showToast('⚠️ Already checked in for this shift', 'warn')
        setCheckingIn(false); return
      }

      const dist = getDistance(gpsCoords.lat, gpsCoords.lng, campus.lat, campus.lng)

      // ③ Outside campus
      if (dist > campus.radius) {
        fraudFlags.push({ type: 'outside_campus', detail: `${Math.round(dist)}m from campus` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'outside_campus',
          `${Math.round(dist)}m from campus`, { lat: gpsCoords.lat, lng: gpsCoords.lng, accuracy: gpsAccuracy, fp })
      }

      // ④ Fake GPS
      if (gpsAccuracy < 2) {
        fraudFlags.push({ type: 'fake_gps', detail: `Accuracy ${gpsAccuracy}m (emulator suspected)` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'fake_gps',
          `Accuracy ${gpsAccuracy}m`, { lat: gpsCoords.lat, lng: gpsCoords.lng, accuracy: gpsAccuracy, fp })
      }

      // ⑤ Device clash
      const { data: clash } = await supabase.from('staff_geo_attendance')
        .select('staff_id, staff_profiles(name)').eq('date', dateStr).eq('device_fingerprint', fp)
        .neq('staff_id', currentStaff.id).limit(1)
      if (clash?.length > 0) {
        fraudFlags.push({ type: 'device_clash', detail: `Same device as ${clash[0].staff_profiles?.name}` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'device_clash',
          `Device used by staff ID ${clash[0].staff_id}`, { fp })
      }

      // ⑥ Velocity
      const { data: recent } = await supabase.from('staff_geo_attendance')
        .select('check_out_time').eq('staff_id', currentStaff.id).eq('date', dateStr)
        .not('check_out_time', 'is', null).order('check_out_time', { ascending: false }).limit(1)
      if (recent?.length > 0) {
        const minsSinceOut = (now - new Date(recent[0].check_out_time)) / 60000
        if (minsSinceOut < 30) {
          fraudFlags.push({ type: 'velocity', detail: `Only ${Math.round(minsSinceOut)} min since last check-out` })
          await logFraud(currentStaff.id, dateStr, shift.shift_label, 'velocity',
            `${Math.round(minsSinceOut)}min since last checkout`, { fp })
        }
      }

      // ⑦ Late entry detection
      const isFraud = fraudFlags.some(f => ['outside_campus', 'fake_gps', 'device_clash'].includes(f.type))
      const isLate  = !isFraud && (() => {
        const [h, m] = shift.shift_start.split(':').map(Number)
        const shiftMs = h * 60 + m
        return nowMin() > shiftMs + (shift.check_in_window_min || 10)
      })()

      const status = isFraud ? 'Flagged' : dist > campus.radius ? 'Outside' : isLate ? 'Late' : 'Present'
      const lateMinutes = isLate
        ? nowMin() - toMin(shift.shift_start)
        : 0

      const { data: inserted, error } = await supabase.from('staff_geo_attendance').insert({
        staff_id:             currentStaff.id,
        date:                 dateStr,
        shift_id:             shift.id,
        shift_label:          shift.shift_label,
        check_in_time:        now.toISOString(),
        check_in_lat:         gpsCoords.lat,
        check_in_lng:         gpsCoords.lng,
        accuracy_meters:      gpsAccuracy,
        distance_from_campus: Math.round(dist),
        is_within_zone:       dist <= campus.radius,
        device_fingerprint:   fp,
        device_info:          navigator.userAgent.slice(0, 200),
        status,
        late_minutes:         lateMinutes,
        fraud_flags:          fraudFlags,
        is_fraud_suspected:   isFraud || fraudFlags.length > 0,
        marked_by:            'self',
      }).select()

      if (error) { showToast('❌ Error: ' + error.message, 'err'); setCheckingIn(false); return }

      const logId = inserted?.[0]?.id

      // Log initial location ping
      if (logId) {
        await supabase.from('attendance_location_trail').insert({
          attendance_id: logId, staff_id: currentStaff.id,
          lat: gpsCoords.lat, lng: gpsCoords.lng,
          accuracy: gpsAccuracy, recorded_at: now.toISOString(),
          on_campus: dist <= campus.radius, event_type: 'check_in',
          distance_from_campus: Math.round(dist),
        })

        // Start continuous tracking
        const newTracking = { logId, shiftId: shift.id, shiftLabel: shift.shift_label, shift }
        setActiveTracking(prev => [...prev, newTracking])
        setGpsStatus('tracking')
      }

      await fetchMyLogs()

      if (isLate) {
        showToast(`🕐 Checked in LATE for Shift ${shift.shift_label} — ${lateMinutes} min late. Tracking started.`, 'warn')
      } else if (isFraud) {
        showToast('🚨 Check-in flagged for admin review. Tracking started.', 'warn')
      } else {
        showToast(`✅ Checked in — Shift ${shift.shift_label} — ${status}. Location tracking active.`, 'ok')
      }

    } catch (err) {
      showToast('❌ Check-in failed: ' + err.message, 'err')
    }
    setCheckingIn(false)
  }

  // ── Manual Check-out ──────────────────────────────────────────────────────

  const handleCheckOut = async (logId, shiftLabel) => {
    if (!gpsCoords) { showToast('❌ Detect location first', 'err'); return }

    const log     = myLogs.find(l => l.id === logId)
    const shift   = myShifts.find(s => s.shift_label === shiftLabel)
    const minsLeft = shift ? minutesToShiftEnd(shift) : 0

    // Flag early departure
    if (minsLeft > EARLY_OUT_BUFFER && shift) {
      await logFraud(currentStaff.id, today(), shiftLabel, 'early_out',
        `Manual check-out ${Math.round(minsLeft)} min before shift end`)
      await supabase.from('staff_geo_attendance')
        .update({ status: 'EarlyOut', is_fraud_suspected: true })
        .eq('id', logId)
    }

    const { error } = await supabase.from('staff_geo_attendance').update({
      check_out_time: new Date().toISOString(),
      check_out_lat: gpsCoords.lat, check_out_lng: gpsCoords.lng,
    }).eq('id', logId)

    if (error) { showToast('❌ ' + error.message, 'err'); return }

    // Log final location
    await supabase.from('attendance_location_trail').insert({
      attendance_id: logId, staff_id: currentStaff.id,
      lat: gpsCoords.lat, lng: gpsCoords.lng, accuracy: gpsAccuracy,
      recorded_at: new Date().toISOString(),
      on_campus: (gpsDistance || 0) <= campus.radius, event_type: 'check_out',
      distance_from_campus: Math.round(gpsDistance || 0),
    })

    // Stop tracking for this shift
    setActiveTracking(prev => prev.filter(t => t.logId !== logId))
    if (!activeTracking.filter(t => t.logId !== logId).length) {
      setGpsStatus('oncampus')
    }

    await fetchMyLogs()
    showToast(minsLeft > EARLY_OUT_BUFFER
      ? `⚠️ Checked out early (${Math.round(minsLeft)} min before shift end) — flagged`
      : `✅ Checked out — Shift ${shiftLabel}`, minsLeft > EARLY_OUT_BUFFER ? 'warn' : 'ok')
  }

  // ── Save campus ───────────────────────────────────────────────────────────

  const saveCampus = async () => {
    if (!campusForm.lat || !campusForm.lng) { showToast('❌ Enter lat/lng', 'err'); return }
    setSavingCampus(true)
    const payload = { name: campusForm.name, latitude: parseFloat(campusForm.lat), longitude: parseFloat(campusForm.lng), radius_meters: parseInt(campusForm.radius) || 100, is_active: true }
    let error
    if (campus?.id) {
      ({ error } = await supabase.from('attendance_zones').update(payload).eq('id', campus.id))
    } else {
      ({ error } = await supabase.from('attendance_zones').insert(payload))
    }
    if (error) showToast('❌ ' + error.message, 'err')
    else { showToast('✅ Campus zone saved', 'ok'); await fetchCampus() }
    setSavingCampus(false)
  }

  // ── Save shifts ───────────────────────────────────────────────────────────

  const saveShifts = async () => {
    if (!selectedStaff) { showToast('❌ Select a staff first', 'err'); return }
    setSavingShifts(true)
    for (const sf of shiftForms) {
      if (!sf.shift_label || !sf.shift_start || !sf.shift_end) continue
      const payload = { staff_id: selectedStaff, shift_label: sf.shift_label, shift_start: sf.shift_start, shift_end: sf.shift_end, check_in_window_min: parseInt(sf.check_in_window_min) || 10, is_active: true, effective_from: today(), created_by: 'Admin' }
      if (sf.id) await supabase.from('staff_shifts').update(payload).eq('id', sf.id)
      else       await supabase.from('staff_shifts').insert(payload)
    }
    showToast('✅ Shifts saved', 'ok')
    setSavingShifts(false)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit: false })))
  }

  const deleteShift = async (id) => {
    if (!window.confirm('Remove this shift?')) return
    if (id.toString().startsWith('new')) { setShiftForms(prev => prev.filter(s => s.id !== id)); return }
    await supabase.from('staff_shifts').update({ is_active: false }).eq('id', id)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit: false })))
    showToast('🗑️ Shift removed', 'ok')
  }

  // ── Resolve fraud ─────────────────────────────────────────────────────────

  const resolveFraud = async (logId, action) => {
    if (!resolveNote) { showToast('❌ Add a resolution note', 'err'); return }
    await supabase.from('attendance_fraud_log').update({ resolved: true, resolved_by: 'Admin', resolved_note: resolveNote }).eq('id', logId)
    if (action === 'absent') {
      const fraudEntry = fraudLogs.find(f => f.id === logId)
      if (fraudEntry) {
        await supabase.from('staff_geo_attendance')
          .update({ status: 'Absent', override_by: 'Admin', override_note: resolveNote })
          .eq('staff_id', fraudEntry.staff_id).eq('date', fraudEntry.date).eq('shift_label', fraudEntry.shift_label)
      }
    }
    setResolvingId(null); setResolveNote('')
    await fetchFraudLogs()
    showToast('✅ Fraud alert resolved', 'ok')
  }

  const adminOverride = async (logId, newStatus, note) => {
    await supabase.from('staff_geo_attendance').update({ status: newStatus, override_by: 'Admin', override_note: note }).eq('id', logId)
    await fetchTodayLogs()
    showToast(`✅ Status → ${newStatus}`, 'ok')
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const todayMyLogs = myLogs.filter(l => l.date === today())

  const myPendingAdvanceTotal = useMemo(() => {
    return advances
      .filter(a => String(a.staff_id) === String(currentStaff?.id) && a.status === 'Active')
      .reduce((sum, a) => {
        const rem = Number(a.amount) - Number(a.repaid_amount)
        const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
        return sum + Math.min(pm, rem)
      }, 0)
  }, [advances, currentStaff?.id])

  const tabs = [
    { key: 'checkin', label: '📍 My Check-In' },
    ...(isAdmin ? [
      { key: 'monitor', label: '👁️ Live Monitor' },
      { key: 'fraud',   label: `🚨 Alerts${fraudLogs.length > 0 ? ` (${fraudLogs.length})` : ''}` },
      { key: 'shifts',  label: '⏰ Shifts' },
      { key: 'campus',  label: '🗺️ Campus' },
      { key: 'report',  label: '📊 Report' },
    ] : [
      { key: 'history',  label: '📅 My History' },
      { key: 'advances', label: '💳 My Advances' },
    ])
  ]

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontFamily: "'Segoe UI',sans-serif" }}>
      ⏳ Loading Geo-Attendance...
    </div>
  )

  // ── Tracking status bar (shown when tracking active) ──────────────────────

  const TrackingBanner = () => {
    if (!activeTracking.length) return null
    const wasOffCampus = offCampusSince
    return (
      <div style={{ background: wasOffCampus ? '#fee2e2' : '#e0f2fe', border: `1px solid ${wasOffCampus ? '#fca5a5' : '#7dd3fc'}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ fontSize: '22px' }}>{wasOffCampus ? '⚠️' : '🛰️'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', color: wasOffCampus ? '#dc2626' : '#0369a1', fontSize: '13px' }}>
            {wasOffCampus ? 'OFF CAMPUS — Early departure detected!' : 'Location Tracking Active'}
          </div>
          <div style={{ fontSize: '12px', color: wasOffCampus ? '#7f1d1d' : '#0c4a6e', marginTop: '2px' }}>
            {activeTracking.map(t => `Shift ${t.shiftLabel} (ends ${fmt12(t.shift.shift_end)})`).join(' · ')}
            {lastPingTime && ` · Last ping: ${fmtTime(lastPingTime)}`}
          </div>
        </div>
        {wasOffCampus && (
          <div style={{ fontSize: '11px', background: '#dc2626', color: 'white', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
            Admin Notified
          </div>
        )}
      </div>
    )
  }

  // ── Late-entry info bar ───────────────────────────────────────────────────

  const LateEntryInfo = ({ log }) => {
    if (!log?.late_minutes || log.late_minutes <= 0) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '12px', color: '#b45309', fontWeight: '600', marginTop: '4px' }}>
        🕐 Late entry: {log.late_minutes} min after shift start
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 3000, padding: '13px 20px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: '600', color: 'white', background: toastType === 'err' ? '#dc2626' : toastType === 'warn' ? '#d97706' : '#16a34a', maxWidth: '380px' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📍 Geo-Attendance</h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          Campus-verified · Continuous tracking · Fraud-proof · Shift-aware
          {campus && <span style={{ marginLeft: '12px', color: '#16a34a', fontWeight: '600' }}>✅ {campus.name} ({campus.radius}m)</span>}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', gap: '4px', flexWrap: 'wrap' }}>
        {tabs.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>{t.label}</button>)}
      </div>

      {/* ══ MY CHECK-IN TAB ══ */}
      {activeTab === 'checkin' && (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>

          <TrackingBanner />

          {/* Advance deduction notice */}
          {myPendingAdvanceTotal > 0 && (
            <div style={{ background: '#fef9c3', border: '1px solid #f59e0b', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '600' }}>💳 Pending advance deduction this month</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#b45309' }}>{fmtRupee(myPendingAdvanceTotal)}</div>
            </div>
          )}

          {/* Today's check-in cards */}
          {todayMyLogs.length > 0 && (
            <div style={{ ...S.card, padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '12px' }}>Today's Attendance</div>
              {todayMyLogs.map(log => {
                const isBeingTracked = activeTracking.some(t => t.logId === log.id)
                return (
                  <div key={log.id} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${isBeingTracked ? '#7dd3fc' : '#e2e8f0'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Shift {log.shift_label}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>In: {fmtTime(log.check_in_time)} · Out: {fmtTime(log.check_out_time)}</div>
                        {log.distance_from_campus !== null && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.distance_from_campus}m from campus</div>
                        )}
                        <LateEntryInfo log={log} />
                        {isBeingTracked && (
                          <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600', marginTop: '4px' }}>
                            🛰️ Tracking active · pings every 2 min
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <StatusBadge status={log.status} />
                        {log.check_in_time && !log.check_out_time && (
                          <button onClick={() => handleCheckOut(log.id, log.shift_label)} style={S.btnSm('#0ea5e9')}>Check Out</button>
                        )}
                        {log.fraud_flags?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* GPS Ring */}
          <div style={S.card}>
            <GPSRing
              status={gpsStatus} distance={gpsDistance} accuracy={gpsAccuracy} campus={campus}
              tracking={activeTracking.length > 0}
              minsLeft={activeTracking.length > 0 ? Math.max(0, Math.round(minutesToShiftEnd(activeTracking[0].shift))) : null}
            />

            {gpsStatus === 'idle' && (
              <button onClick={startGPS} style={{ ...S.btn('#1e3a5f'), width: '100%', padding: '14px', fontSize: '15px', fontWeight: '800' }}>
                📡 Detect My Location
              </button>
            )}
            {gpsStatus === 'locating' && (
              <div style={{ textAlign: 'center', color: '#f59e0b', fontWeight: '600', padding: '8px' }}>📡 Acquiring GPS signal...</div>
            )}
            {(gpsStatus === 'weak' || gpsStatus === 'error') && (
              <button onClick={startGPS} style={{ ...S.btn('#f59e0b'), width: '100%', padding: '12px' }}>🔄 Retry Detection</button>
            )}

            {/* Shift buttons */}
            {(gpsStatus === 'oncampus' || gpsStatus === 'outside' || gpsStatus === 'tracking') && myShifts.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myShifts.map(shift => {
                  const alreadyDone   = todayMyLogs.some(l => l.shift_label === shift.shift_label)
                  const inWindow      = isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)
                  const minsLeft      = minutesUntilWindow(shift.shift_start, shift.check_in_window_min || 10)
                  const isTracked     = activeTracking.some(t => t.shiftLabel === shift.shift_label)
                  const shiftMinsLeft = minutesToShiftEnd(shift)

                  return (
                    <div key={shift.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: `1px solid ${alreadyDone ? '#bbf7d0' : isTracked ? '#7dd3fc' : inWindow ? '#1e3a5f44' : '#e2e8f0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>Shift {shift.shift_label}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{fmt12(shift.shift_start)} → {fmt12(shift.shift_end)}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Window: ±{shift.check_in_window_min || 10} min</div>
                          {isTracked && shiftMinsLeft > 0 && (
                            <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600', marginTop: '3px' }}>
                              🕐 {Math.round(shiftMinsLeft)} min until shift end
                            </div>
                          )}
                        </div>
                        {alreadyDone
                          ? <StatusBadge status={todayMyLogs.find(l => l.shift_label === shift.shift_label)?.status || 'Present'} />
                          : inWindow
                            ? <button onClick={() => handleCheckIn(shift)} disabled={checkingIn || gpsStatus === 'outside'}
                                style={{ ...S.btn(gpsStatus === 'outside' ? '#ef4444' : '#16a34a', checkingIn), padding: '10px 16px', fontSize: '13px' }}>
                                {checkingIn ? '⏳' : gpsStatus === 'outside' ? '❌ Outside' : '✅ Check In'}
                              </button>
                            : minsLeft > 0
                              ? <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700' }}>Opens in {minsLeft}m</span>
                              : <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Window closed</span>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {(gpsStatus === 'oncampus' || gpsStatus === 'outside' || gpsStatus === 'tracking') && myShifts.length === 0 && (
              <div style={{ marginTop: '12px', padding: '14px', background: '#fef3c7', borderRadius: '10px', textAlign: 'center', fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
                ⚠️ No shifts assigned. Contact admin.
              </div>
            )}
          </div>

          {/* Off-campus warning */}
          {gpsStatus === 'outside' && !activeTracking.length && (
            <div style={{ ...S.card, background: '#fee2e2', border: '1px solid #fecaca' }}>
              <div style={{ fontWeight: '700', color: '#dc2626', marginBottom: '4px' }}>🚨 Outside Campus Boundary</div>
              <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                You are {gpsDistance ? Math.round(gpsDistance) : '?'}m from campus. Check-in outside campus will be flagged.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ MY HISTORY (staff) ══ */}
      {activeTab === 'history' && !isAdmin && (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>{['Date', 'Shift', 'Check-In', 'Check-Out', 'Late (min)', 'Distance', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {myLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{fmtDate(log.date)}</td>
                  <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                  <td style={td}>{fmtTime(log.check_in_time)}</td>
                  <td style={td}>{fmtTime(log.check_out_time)}</td>
                  <td style={{ ...td, color: log.late_minutes > 0 ? '#b45309' : '#16a34a', fontWeight: '600' }}>
                    {log.late_minutes > 0 ? `+${log.late_minutes} min` : '—'}
                  </td>
                  <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                    {log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}
                  </td>
                  <td style={td}><StatusBadge status={log.status} /></td>
                </tr>
              ))}
              {myLogs.length === 0 && (
                <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No records yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MY ADVANCES (staff) ══ */}
      {activeTab === 'advances' && !isAdmin && (
        <div>
          <AdvanceSummary staffId={currentStaff?.id} advances={advances} />
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: '700', color: '#1e3a5f', borderBottom: '1px solid #f1f5f9', fontSize: '15px' }}>💳 My Advances</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Month', 'Amount', 'Repaid', 'Remaining', 'Per Month', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).map(a => {
                  const rem = Number(a.amount) - Number(a.repaid_amount)
                  const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={td}>{a.issued_month}</td>
                      <td style={{ ...td, fontWeight: '700' }}>{fmtRupee(a.amount)}</td>
                      <td style={{ ...td, color: '#16a34a', fontWeight: '600' }}>{fmtRupee(a.repaid_amount)}</td>
                      <td style={{ ...td, color: rem > 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>{fmtRupee(rem)}</td>
                      <td style={{ ...td, color: '#7c3aed', fontWeight: '600' }}>{rem > 0 ? fmtRupee(Math.min(pm, rem)) : '—'}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: a.status === 'Active' ? '#fef3c7' : '#dcfce7', color: a.status === 'Active' ? '#b45309' : '#16a34a' }}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).length === 0 && (
                  <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No advance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ LIVE MONITOR (admin) ══ */}
      {activeTab === 'monitor' && isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '14px', marginBottom: '20px' }}>
            {[
              { label: 'Total',     value: todayLogs.length,                                  color: '#1e3a5f', icon: '📋' },
              { label: 'Present',   value: todayLogs.filter(l => l.status === 'Present').length, color: '#16a34a', icon: '✅' },
              { label: 'Late',      value: todayLogs.filter(l => l.status === 'Late').length,    color: '#b45309', icon: '🕐' },
              { label: 'Early Out', value: todayLogs.filter(l => l.status === 'EarlyOut').length,color: '#dc2626', icon: '🏃' },
              { label: 'Outside',   value: todayLogs.filter(l => l.status === 'Outside').length, color: '#dc2626', icon: '📍' },
              { label: 'Flagged',   value: todayLogs.filter(l => l.is_fraud_suspected).length,   color: '#be185d', icon: '🚨' },
            ].map(c => (
              <div key={c.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '20px' }}>{c.icon}</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{c.value}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Today — {fmtDate(today())}</div>
            <button onClick={fetchTodayLogs} style={S.btnSm('#1e3a5f')}>🔄 Refresh</button>
          </div>

          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Staff', 'Shift', 'Check-In', 'Check-Out', 'Late', 'Distance', 'Status', 'Fraud', 'Trail', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {todayLogs.map(log => (
                  <>
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                      <td style={td}>
                        <div style={{ fontWeight: '600' }}>{log.staff_profiles?.name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.staff_profiles?.designation}</div>
                      </td>
                      <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                      <td style={td}>{fmtTime(log.check_in_time)}</td>
                      <td style={td}>{fmtTime(log.check_out_time)}</td>
                      <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: '600' }}>
                        {(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}
                      </td>
                      <td style={{ ...td, fontWeight: '600', color: log.is_within_zone ? '#16a34a' : '#dc2626' }}>
                        {log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}
                      </td>
                      <td style={td}><StatusBadge status={log.status} /></td>
                      <td style={td}>
                        {log.fraud_flags?.length > 0
                          ? <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)}
                            </div>
                          : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        }
                      </td>
                      <td style={td}>
                        <button onClick={async () => {
                          if (expandedTrail === log.id) { setExpandedTrail(null); return }
                          await fetchTrailForLog(log.id)
                          setExpandedTrail(log.id)
                        }} style={S.btnSm('#0ea5e9')}>
                          {expandedTrail === log.id ? '▲ Hide' : '🗺️ Trail'}
                        </button>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button onClick={() => adminOverride(log.id, 'Present', 'Admin verified')} style={S.btnSm('#16a34a')}>✅</button>
                          <button onClick={() => adminOverride(log.id, 'Absent', 'Admin override')} style={S.btnSm('#dc2626')}>⭕</button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded trail row */}
                    {expandedTrail === log.id && (
                      <tr key={log.id + '-trail'} style={{ background: '#f8fafc' }}>
                        <td colSpan="10" style={{ padding: '0 16px 16px' }}>
                          <ShiftTimeline
                            trail={trailMap[log.id] || []}
                            shift={myShifts.find(s => s.shift_label === log.shift_label) || { shift_start: '08:00', shift_end: '14:00', shift_label: log.shift_label }}
                          />
                          {(trailMap[log.id] || []).length === 0 && (
                            <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>No location trail recorded yet</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {todayLogs.length === 0 && (
                  <tr><td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No check-ins yet today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ FRAUD ALERTS (admin) ══ */}
      {activeTab === 'fraud' && isAdmin && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#dc2626', margin: 0 }}>🚨 Unresolved Fraud Alerts</h2>
            <button onClick={fetchFraudLogs} style={S.btnSm('#dc2626')}>🔄 Refresh</button>
          </div>

          {fraudLogs.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#16a34a', padding: '48px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: '700' }}>No unresolved fraud alerts</div>
            </div>
          )}

          {fraudLogs.map(fl => (
            <div key={fl.id} style={{ ...S.card, border: `1px solid ${FRAUD_TYPES[fl.fraud_type]?.color || '#ef4444'}44`, marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <FraudBadge type={fl.fraud_type} />
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{fmtDate(fl.date)} · Shift {fl.shift_label}</span>
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{fl.staff_profiles?.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{fl.staff_profiles?.designation}</div>
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#475569' }}>
                    {fl.detail}
                  </div>
                  {fl.lat && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      GPS: {fl.lat?.toFixed(6)}, {fl.lng?.toFixed(6)} · ±{fl.accuracy}m
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(fl.created_at).toLocaleTimeString('en-IN')}</div>
              </div>

              {resolvingId === fl.id ? (
                <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', borderRadius: '10px' }}>
                  <label style={S.label}>Resolution Note *</label>
                  <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={2}
                    placeholder="Explain resolution..." style={{ ...S.input, resize: 'vertical', marginBottom: '10px' }} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => resolveFraud(fl.id, 'approve')} style={S.btn('#16a34a')}>✅ Approve</button>
                    <button onClick={() => resolveFraud(fl.id, 'absent')}  style={S.btn('#dc2626')}>❌ Mark Absent</button>
                    <button onClick={() => { setResolvingId(null); setResolveNote('') }} style={S.btn('#64748b')}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setResolvingId(fl.id)} style={{ ...S.btnSm('#1e3a5f'), marginTop: '12px' }}>🔍 Review & Resolve</button>
              )}
            </div>
          ))}
        </>
      )}

      {/* ══ SHIFT SETUP (admin) ══ */}
      {activeTab === 'shifts' && isAdmin && (
        <div style={{ maxWidth: '640px' }}>
          <div style={S.card}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>⏰ Shift Configuration</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={S.label}>Select Staff Member</label>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="">— Select Staff —</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
              </select>
            </div>

            {selectedStaff && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {shiftForms.map((sf, i) => (
                    <div key={sf.id || i} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px', gap: '10px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={S.label}>Label</label>
                          <input value={sf.shift_label} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_label: e.target.value } : s))}
                            placeholder="A/B/C" style={S.input} maxLength={3} />
                        </div>
                        <div>
                          <label style={S.label}>Start</label>
                          <input type="time" value={sf.shift_start} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_start: e.target.value } : s))} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>End</label>
                          <input type="time" value={sf.shift_end} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_end: e.target.value } : s))} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Window (min)</label>
                          <input type="number" min="5" max="30" value={sf.check_in_window_min || 10}
                            onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, check_in_window_min: e.target.value } : s))} style={S.input} />
                        </div>
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          Window: {fmt12(sf.shift_start)} ±{sf.check_in_window_min || 10} min · Tracks until {fmt12(sf.shift_end)}
                        </span>
                        <button onClick={() => deleteShift(sf.id)} style={{ ...S.btnSm('#ef4444'), marginLeft: 'auto' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShiftForms(prev => [...prev, { id: 'new-' + Date.now(), shift_label: '', shift_start: '08:00', shift_end: '14:00', check_in_window_min: 10 }])}
                    style={S.btn('#0ea5e9')}>+ Add Shift</button>
                  <button onClick={saveShifts} disabled={savingShifts} style={S.btn('#16a34a', savingShifts)}>
                    {savingShifts ? '⏳ Saving...' : '💾 Save All'}
                  </button>
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '12px', color: '#0284c7' }}>
                  💡 GPS tracking runs continuously from check-in until shift end. Early departure is auto-flagged.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ CAMPUS ZONE (admin) ══ */}
      {activeTab === 'campus' && isAdmin && (
        <div style={{ maxWidth: '520px' }}>
          <div style={S.card}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>🗺️ Campus Geofence</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Zone Name</label>
                <input value={campusForm.name} onChange={e => setCampusForm({ ...campusForm, name: e.target.value })} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Latitude</label>
                <input type="number" step="0.0001" value={campusForm.lat} onChange={e => setCampusForm({ ...campusForm, lat: e.target.value })} placeholder="e.g. 24.6821" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Longitude</label>
                <input type="number" step="0.0001" value={campusForm.lng} onChange={e => setCampusForm({ ...campusForm, lng: e.target.value })} placeholder="e.g. 93.9876" style={S.input} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Allowed Radius (meters)</label>
                <input type="range" min="50" max="500" step="10" value={campusForm.radius}
                  onChange={e => setCampusForm({ ...campusForm, radius: e.target.value })} style={{ width: '100%', marginBottom: '6px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>50m (strict)</span>
                  <span style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>{campusForm.radius}m</span>
                  <span>500m (lenient)</span>
                </div>
              </div>
            </div>
            {campus && (
              <div style={{ padding: '12px 14px', background: '#dcfce7', borderRadius: '8px', margin: '16px 0', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                ✅ Current: {campus.name} · {campus.lat}, {campus.lng} · {campus.radius}m
              </div>
            )}
            <button onClick={saveCampus} disabled={savingCampus} style={{ ...S.btn('#1e3a5f', savingCampus), width: '100%', padding: '13px' }}>
              {savingCampus ? '⏳ Saving...' : '💾 Save Campus Zone'}
            </button>
          </div>

          <div style={S.card}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>🛡️ Active Fraud Guards</h3>
            {[
              { icon: '📍', label: 'Campus Boundary',        desc: `Within ${campus?.radius || 100}m of campus center` },
              { icon: '🛰️', label: 'Continuous Tracking',    desc: 'GPS logged every 2 min throughout shift' },
              { icon: '🏃', label: 'Early-Out Detection',    desc: 'Flag if staff leaves campus before shift end' },
              { icon: '🕐', label: 'Late-Entry Logging',     desc: '10-min window; minutes late recorded per check-in' },
              { icon: '🔁', label: 'Duplicate Guard',        desc: 'One check-in per shift per day enforced' },
              { icon: '📱', label: 'Device Fingerprint',     desc: 'Canvas fingerprint detects shared-device fraud' },
              { icon: '⚡', label: 'Velocity Check',         desc: 'Flag if check-in < 30 min after check-out' },
              { icon: '🛰️', label: 'Fake GPS Detection',     desc: 'Rejects accuracy < 2m (emulator) or > 60m (bad signal)' },
            ].map(g => (
              <div key={g.label} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{g.label}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{g.desc}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: '#16a34a', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>ACTIVE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ MONTHLY REPORT (admin) ══ */}
      {activeTab === 'report' && isAdmin && (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={S.label}>Month</label>
              <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
            </div>
            <div style={{ minWidth: '220px' }}>
              <label style={S.label}>Staff</label>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="">All Staff</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={fetchMonthLogs} style={S.btn('#1e3a5f')}>🔄 Load</button>
            </div>
          </div>

          {/* Staff summary with late minutes */}
          {!selectedStaff && (() => {
            const staffMap = {}
            monthLogs.forEach(l => {
              const name = l.staff_profiles?.name || l.staff_id
              if (!staffMap[name]) staffMap[name] = { name, designation: l.staff_profiles?.designation, total: 0, present: 0, late: 0, earlyOut: 0, absent: 0, flagged: 0, totalLateMin: 0 }
              staffMap[name].total++
              if (l.status === 'Present')  staffMap[name].present++
              if (l.status === 'Late')     { staffMap[name].late++; staffMap[name].totalLateMin += l.late_minutes || 0 }
              if (l.status === 'EarlyOut') staffMap[name].earlyOut++
              if (l.status === 'Absent')   staffMap[name].absent++
              if (l.status === 'Flagged')  staffMap[name].flagged++
            })
            const rows = Object.values(staffMap)
            return rows.length > 0 ? (
              <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '14px 16px', fontWeight: '700', color: '#1e3a5f', borderBottom: '1px solid #f1f5f9' }}>Staff Summary</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>{['Staff', 'Total', 'Present', 'Late', 'Late Min', 'Early Out', 'Absent', 'Flagged', 'Rate'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const rate = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
                      return (
                        <tr key={r.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={td}><div style={{ fontWeight: '600' }}>{r.name}</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.designation}</div></td>
                          <td style={td}>{r.total}</td>
                          <td style={{ ...td, color: '#16a34a', fontWeight: '700' }}>{r.present}</td>
                          <td style={{ ...td, color: '#b45309', fontWeight: '700' }}>{r.late}</td>
                          <td style={{ ...td, color: r.totalLateMin > 0 ? '#b45309' : '#94a3b8', fontWeight: '600' }}>{r.totalLateMin > 0 ? `${r.totalLateMin}m` : '—'}</td>
                          <td style={{ ...td, color: '#dc2626', fontWeight: '700' }}>{r.earlyOut}</td>
                          <td style={{ ...td, color: '#dc2626', fontWeight: '700' }}>{r.absent}</td>
                          <td style={{ ...td, color: '#be185d', fontWeight: '700' }}>{r.flagged}</td>
                          <td style={td}><span style={{ fontWeight: '800', color: rate >= 90 ? '#16a34a' : rate >= 70 ? '#b45309' : '#dc2626' }}>{rate}%</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null
          })()}

          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Date', 'Staff', 'Shift', 'Check-In', 'Check-Out', 'Late', 'Distance', 'Status', 'Fraud'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {monthLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                    <td style={td}>{fmtDate(log.date)}</td>
                    <td style={td}><div style={{ fontWeight: '600' }}>{log.staff_profiles?.name || '—'}</div></td>
                    <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                    <td style={td}>{fmtTime(log.check_in_time)}</td>
                    <td style={td}>{fmtTime(log.check_out_time)}</td>
                    <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: '600' }}>
                      {(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}
                    </td>
                    <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                      {log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}
                    </td>
                    <td style={td}><StatusBadge status={log.status} /></td>
                    <td style={td}>
                      {log.fraud_flags?.length > 0
                        ? log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)
                        : <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>}
                    </td>
                  </tr>
                ))}
                {monthLogs.length === 0 && <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
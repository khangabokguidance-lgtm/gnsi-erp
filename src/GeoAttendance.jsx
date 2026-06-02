/**
 * GeoAttendance.jsx — Hardened v3
 *
 * v2 bugs fixed (carried forward):
 *  Bug A  .single() crash            → .limit(1).maybeSingle()
 *  Bug B  UTC date near midnight     → toLocaleDateString('en-CA') = IST date
 *  Bug C  Wrong initial tab          → 'monitor' not 'admin'
 *  Bug D  GPS null crashes checkout  → gpsCoords?.lat ?? null
 *  Bug E  Month end date wrong       → new Date(y, m, 0) = last day of month
 *  Bug F  React key warning          → React.Fragment key on map
 *  Bug G  Stale gpsAccuracy in ping  → accuracyRef pattern
 *  Bug 2  Reload restore by label    → match shift_id first
 *  Bug 4  null <= 0 kills tracking   → explicit null check
 *  Bug 5  Midnight shift window      → diff wrap guard
 *  Bug 6  shiftForms not reset       → setShiftForms([]) on staff change
 *
 * v3 loophole fixes:
 *  FIX-G1  geo_verified used stale gpsStatus state → use actual distance vs campus.radius
 *  FIX-G2  syncVerifiedCheckins infinite loop → filter verified only, guard onAttendanceChange
 *  FIX-G3  checkout bridge overwrote Late→Present → removed status from checkout upsert
 *  FIX-G4  duplicate check-in bridge corrupted check_in_time → skip bridge on duplicate error
 *  FIX-G5  detect_dead_sessions had no error handling → wrapped in try/catch
 *  FIX-G6  negative minsLeft shown in GPS ring → Math.max(0, ...)
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CAMPUS    = { lat: 24.62181, lng: 94.0193087, radius: 50 }
const TRACK_INTERVAL_MS = 2 * 60 * 1000

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

function getDeviceFingerprint() {
  try {
    const parts = []
    const c = document.createElement('canvas')
    const cx = c.getContext('2d')
    cx.textBaseline = 'top'; cx.font = '14px Arial'
    cx.fillStyle = '#1e3a5f'; cx.fillText('GNSI-FP-2026', 2, 2)
    cx.fillStyle = 'rgba(102,204,0,0.7)'; cx.fillRect(100, 5, 30, 10)
    parts.push(c.toDataURL().slice(-80))
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
      const osc = ctx.createOscillator()
      const analyser = ctx.createAnalyser()
      osc.connect(analyser); analyser.connect(ctx.destination)
      osc.start(0); osc.stop(0.001)
      const buf = new Float32Array(analyser.frequencyBinCount)
      analyser.getFloatFrequencyData(buf)
      parts.push(buf.slice(0, 10).join(','))
      ctx.close()
    } catch { parts.push('no-audio') }
    try {
      const gl = document.createElement('canvas').getContext('webgl')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      parts.push(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-webgl')
    } catch { parts.push('no-webgl') }
    const testFonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana']
    const fc = document.createElement('canvas').getContext('2d')
    const fontResults = testFonts.map(f => { fc.font = `12px ${f}`; return fc.measureText('Wm').width.toFixed(2) })
    parts.push(fontResults.join('|'))
    parts.push([navigator.userAgent, screen.width + 'x' + screen.height + 'x' + screen.colorDepth, navigator.language, new Date().getTimezoneOffset(), navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0, navigator.maxTouchPoints || 0].join('|'))
    return btoa(parts.join('::::')).slice(0, 96)
  } catch {
    return 'fallback-' + navigator.userAgent.length + '-' + screen.width
  }
}

const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() }

function isWithinWindow(shiftStart, windowMin = 10) {
  let diff = nowMin() - toMin(shiftStart)
  if (diff < -720) diff += 1440
  if (diff >  720) diff -= 1440
  return diff >= -windowMin && diff <= windowMin
}

function minutesUntilWindow(shiftStart, windowMin = 10) {
  let diff = toMin(shiftStart) - windowMin - nowMin()
  if (diff < -720) diff += 1440
  return diff
}

function minutesToShiftEnd(shift) {
  let diff = toMin(shift.shift_end) - nowMin()
  if (diff < -720) diff += 1440
  return diff
}

const today    = () => new Date().toLocaleDateString('en-CA')
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmt12    = (t) => { if (!t) return '—'; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const fmtRupee = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

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
    Present:  { bg: '#dcfce7', color: '#16a34a', icon: '✅' },
    Late:     { bg: '#fef3c7', color: '#b45309', icon: '🕐' },
    Outside:  { bg: '#fee2e2', color: '#dc2626', icon: '📍' },
    Flagged:  { bg: '#fce7f3', color: '#be185d', icon: '🚨' },
    Absent:   { bg: '#f1f5f9', color: '#64748b', icon: '⭕' },
    Pending:  { bg: '#eff6ff', color: '#1d4ed8', icon: '⏳' },
    EarlyOut: { bg: '#fee2e2', color: '#dc2626', icon: '🏃' },
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

function DeadSessionBanner({ logs }) {
  const deadLogs = logs.filter(l => l.session_dead && !l.check_out_time)
  if (!deadLogs.length) return null
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
      <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '13px', marginBottom: '4px' }}>⚠️ Session interrupted — location tracking was lost</div>
      <div style={{ fontSize: '12px', color: '#7f1d1d' }}>{deadLogs.map(l => `Shift ${l.shift_label}`).join(', ')} — tab was closed or app killed mid-shift. Admin has been notified.</div>
    </div>
  )
}

function GPSRing({ status, distance, accuracy, campus, tracking, minsLeft }) {
  const colors = { idle: '#94a3b8', locating: '#f59e0b', oncampus: '#16a34a', outside: '#ef4444', error: '#ef4444', weak: '#f97316', tracking: '#0ea5e9' }
  const color    = colors[status] || colors.idle
  const isActive = status === 'oncampus' || status === 'tracking'
  const pct      = campus ? Math.max(0, Math.min(100, (1 - (distance || 0) / campus.radius) * 100)) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 20px' }}>
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        {isActive && <div style={{ position: 'absolute', inset: '-8px', borderRadius: '50%', border: `2px solid ${color}55`, animation: 'pulse 2s infinite' }} />}
        {tracking && <div style={{ position: 'absolute', inset: '-16px', borderRadius: '50%', border: `2px solid #0ea5e9`, opacity: 0.4, animation: 'pulse 1s infinite' }} />}
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
            {status === 'idle' ? '📍' : status === 'locating' ? '📡' : status === 'oncampus' ? '✅' : status === 'tracking' ? '🛰️' : status === 'outside' ? '❌' : status === 'weak' ? '⚠️' : '❌'}
          </div>
          {distance !== null && distance !== undefined && status !== 'locating' && status !== 'idle' && (
            <div style={{ fontSize: '13px', fontWeight: '800', color, marginTop: '4px' }}>{Math.round(distance)}m</div>
          )}
          {/* FIX-G6: Math.max(0,...) prevents negative display */}
          {tracking && minsLeft !== null && (
            <div style={{ fontSize: '10px', color: '#0ea5e9', marginTop: '2px', fontWeight: '700' }}>{Math.max(0, minsLeft)}m left</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', color }}>
          {status === 'idle' ? 'Ready to Check In' : status === 'locating' ? 'Detecting Location...' : status === 'oncampus' ? 'You are ON CAMPUS' : status === 'tracking' ? '🛰️ Shift Tracking Active' : status === 'outside' ? `Outside Campus — ${Math.round(distance || 0)}m away` : status === 'weak' ? 'GPS Signal Weak' : 'Location Error'}
        </div>
        {tracking && <div style={{ fontSize: '12px', color: '#0ea5e9', marginTop: '4px', fontWeight: '600' }}>📡 Location verified every 2 minutes</div>}
        {accuracy && status !== 'idle' && status !== 'error' && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>GPS Accuracy: ±{Math.round(accuracy)}m</div>}
      </div>
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:0.8}50%{transform:scale(1.08);opacity:0.4}100%{transform:scale(1);opacity:0.8}}`}</style>
    </div>
  )
}

function ShiftTimeline({ trail, shift }) {
  if (!trail.length || !shift) return null
  const startMin = toMin(shift.shift_start)
  const endMin   = toMin(shift.shift_end)
  const spanMin  = endMin - startMin || 1
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginTop: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', marginBottom: '10px' }}>
        📍 Location Trail — Shift {shift.shift_label} ({fmt12(shift.shift_start)} → {fmt12(shift.shift_end)})
      </div>
      <div style={{ position: 'relative', height: '24px', background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
        {trail.map((pt, i) => {
          const ts = new Date(pt.server_recorded_at || pt.recorded_at)
          const ptMin = ts.getHours() * 60 + ts.getMinutes()
          const pct = Math.min(100, Math.max(0, ((ptMin - startMin) / spanMin) * 100))
          return (
            <div key={i}
              title={`${fmtTime(pt.server_recorded_at || pt.recorded_at)} — ${pt.on_campus ? 'On campus' : `${pt.distance_from_campus || '?'}m away`} [${pt.event_type}]`}
              style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '10px', height: '10px', borderRadius: '50%', background: pt.on_campus ? '#16a34a' : '#ef4444', border: '2px solid white', cursor: 'pointer' }}
            />
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
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
        {trail.filter(pt => pt.event_type !== 'ping').map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', padding: '4px 8px', background: 'white', borderRadius: '6px' }}>
            <span>{pt.event_type === 'left_campus' ? '🏃' : pt.event_type === 'returned' ? '✅' : pt.event_type === 'shift_end' ? '🏁' : pt.event_type === 'absent_period' ? '👻' : pt.event_type === 'check_in' ? '🟢' : pt.event_type === 'check_out' ? '🔴' : '📍'}</span>
            <span style={{ color: '#64748b' }}>{fmtTime(pt.server_recorded_at || pt.recorded_at)}</span>
            <span style={{ fontWeight: '600', color: pt.on_campus ? '#16a34a' : '#dc2626' }}>
              {pt.event_type === 'check_in' ? 'Checked in' : pt.event_type === 'check_out' ? 'Checked out' : pt.event_type === 'left_campus' ? 'Left campus' : pt.event_type === 'returned' ? 'Returned to campus' : pt.event_type === 'shift_end' ? 'Shift ended (auto)' : pt.event_type === 'absent_period' ? `Absent from campus (${pt.distance_from_campus || '?'}m away)` : pt.on_campus ? 'On campus' : `Off campus (${pt.distance_from_campus || '?'}m)`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

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
          <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>{myAdvances.length} advance(s) · Will be deducted from next salary</div>
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
              <span style={{ color: '#b45309', fontWeight: '700' }}>Next: {fmtRupee(Math.min(pm, rem))}</span>
            </div>
            <div style={{ marginTop: '6px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Remaining: {fmtRupee(rem)} of {fmtRupee(a.amount)} · {pct}% repaid</div>
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
  const safeAllStaff = Array.isArray(allStaff) ? allStaff : []

  const [activeTab,     setActiveTab]     = useState(isAdmin ? 'monitor' : 'checkin')
  const [campus,        setCampus]        = useState(null)
  const [todayLogs,     setTodayLogs]     = useState([])
  const [fraudLogs,     setFraudLogs]     = useState([])
  const [monthLogs,     setMonthLogs]     = useState([])
  const [advances,      setAdvances]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState('')
  const [toastType,     setToastType]     = useState('ok')

  const [gpsStatus,     setGpsStatus]     = useState('idle')
  const [gpsCoords,     setGpsCoords]     = useState(null)
  const [gpsDistance,   setGpsDistance]   = useState(null)
  const [gpsAccuracy,   setGpsAccuracy]   = useState(null)
  const [checkingIn,    setCheckingIn]    = useState(false)
  const [myLogs,        setMyLogs]        = useState([])
  const [myShifts,      setMyShifts]      = useState([])

  const [activeTracking,  setActiveTracking]  = useState([])
  const [lastPingTime,    setLastPingTime]     = useState(null)
  const [offCampusSince,  setOffCampusSince]   = useState(null)
  const [trailMap,        setTrailMap]         = useState({})
  const [logShiftMap,     setLogShiftMap]      = useState({})

  const [campusForm,    setCampusForm]    = useState({ name: 'Main Campus', lat: '', lng: '', radius: 100 })
  const [savingCampus,  setSavingCampus]  = useState(false)
  const [shiftForms,    setShiftForms]    = useState([])
  const [savingShifts,  setSavingShifts]  = useState(false)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [monthFilter,   setMonthFilter]   = useState(new Date().toISOString().slice(0, 7))
  const [resolvingId,   setResolvingId]   = useState(null)
  const [resolveNote,   setResolveNote]   = useState('')
  const [expandedTrail, setExpandedTrail] = useState(null)

  const watchRef    = useRef(null)
  const trackRef    = useRef(null)
  const coordsRef   = useRef(null)
  const trackingRef = useRef([])
  const accuracyRef = useRef(null)

  useEffect(() => { coordsRef.current   = gpsCoords },      [gpsCoords])
  useEffect(() => { accuracyRef.current = gpsAccuracy },    [gpsAccuracy])
  useEffect(() => { trackingRef.current = activeTracking }, [activeTracking])

  const showToast = (msg, type = 'ok') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4500)
  }

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchCampus = useCallback(async () => {
    const { data } = await supabase.from('attendance_zones').select('*').eq('is_active', true).limit(1).maybeSingle()
    if (data) {
      setCampus({ lat: data.latitude, lng: data.longitude, radius: data.radius_meters, name: data.name, id: data.id })
      setCampusForm({ name: data.name, lat: data.latitude, lng: data.longitude, radius: data.radius_meters })
    } else {
      setCampus(DEFAULT_CAMPUS)
    }
  }, [])

  const fetchShiftsFor = useCallback(async (staffId) => {
    if (!staffId) return []
    const { data } = await supabase.from('staff_shifts').select('*').eq('staff_id', parseInt(staffId)).eq('is_active', true).order('shift_start')
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
    const [y, m] = monthFilter.split('-').map(Number)
    const to = new Date(y, m, 0).toISOString().split('T')[0]
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
    const { data } = await supabase.from('attendance_location_trail').select('*').eq('attendance_id', logId).order('recorded_at')
    setTrailMap(prev => ({ ...prev, [logId]: data || [] }))
  }, [])

  const fetchHeartbeatState = useCallback(async (logIds) => {
    if (!logIds.length) return
    const { data } = await supabase.from('attendance_heartbeat').select('attendance_id, off_campus_since, is_active').in('attendance_id', logIds)
    if (data) {
      const offSince = data.find(h => h.off_campus_since && h.is_active)?.off_campus_since || null
      setOffCampusSince(offSince)
    }
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
    setShiftForms([])
    if (isAdmin && activeTab === 'shifts' && selectedStaff) {
      fetchShiftsFor(selectedStaff).then(sh => setShiftForms(sh.map(s => ({ ...s, _edit: false }))))
    }
  }, [activeTab, selectedStaff])

  // FIX-G5: wrap detect_dead_sessions in try/catch to prevent unhandled rejections
  useEffect(() => {
    if (!isAdmin) return
    const sweep = async () => {
      try { await supabase.rpc('detect_dead_sessions') }
      catch (e) { console.warn('detect_dead_sessions failed:', e?.message) }
    }
    sweep()
    const id = setInterval(sweep, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [isAdmin])

  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    if (trackRef.current) clearInterval(trackRef.current)
  }, [])

  // ── Restore tracking on reload ────────────────────────────────────────────

  useEffect(() => {
    if (!myLogs.length || !myShifts.length || !campus) return
    const todayActive = myLogs.filter(l => l.date === today() && !l.check_out_time && !l.session_dead)
    if (!todayActive.length) return
    const trackList = todayActive.map(l => {
      const sh = myShifts.find(s => s.id === l.shift_id) || myShifts.find(s => s.shift_label === l.shift_label)
      return sh ? { logId: l.id, shiftId: sh.id, shiftLabel: sh.shift_label, shift: sh } : null
    }).filter(Boolean)
    if (trackList.length && !activeTracking.length) {
      setActiveTracking(trackList)
      if (gpsStatus === 'idle') { startGPS(); showToast('🛰️ Resumed tracking — please allow location access', 'ok') }
      fetchHeartbeatState(trackList.map(t => t.logId))
    }
  }, [myLogs, myShifts, campus])

  // ── GPS watch ─────────────────────────────────────────────────────────────

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
        const dist = Math.round(6371000 * 2 * Math.atan2(
          Math.sqrt(Math.sin((latitude - campus.lat) * Math.PI / 360) ** 2 +
            Math.cos(campus.lat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
            Math.sin((longitude - campus.lng) * Math.PI / 360) ** 2),
          Math.sqrt(1 - (Math.sin((latitude - campus.lat) * Math.PI / 360) ** 2 +
            Math.cos(campus.lat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
            Math.sin((longitude - campus.lng) * Math.PI / 360) ** 2))
        ))
        setGpsDistance(dist)
        if (dist <= campus.radius) setGpsStatus(trackingRef.current.length ? 'tracking' : 'oncampus')
        else                       setGpsStatus('outside')
      },
      (err) => {
        setGpsStatus('error')
        const msgs = { 1: 'Location permission denied.', 2: 'GPS unavailable.', 3: 'GPS timeout.' }
        showToast('❌ ' + (msgs[err.code] || 'Location error'), 'err')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [campus])

  // ── Interval ping ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (trackRef.current) clearInterval(trackRef.current)
    if (!activeTracking.length) return
    trackRef.current = setInterval(async () => {
      const coords   = coordsRef.current
      const tracking = trackingRef.current
      const accuracy = accuracyRef.current
      if (!coords || !campus || !tracking.length) return
      setLastPingTime(new Date().toISOString())
      for (const t of tracking) {
        try {
          const { data, error } = await supabase.rpc('server_ping', {
            p_attendance_id: t.logId, p_staff_id: currentStaff?.id,
            p_lat: coords.lat, p_lng: coords.lng, p_accuracy: accuracy || 20,
            p_campus_lat: campus.lat, p_campus_lng: campus.lng, p_campus_radius: campus.radius,
            p_shift_end: t.shift.shift_end,
          })
          if (error) { console.error('Ping error:', error); continue }
          if (data?.off_since) setOffCampusSince(data.off_since)
          else setOffCampusSince(null)
          if (data?.event_type === 'left_campus') showToast('⚠️ You left campus early. Admin has been notified.', 'warn')
          if (data?.event_type === 'shift_end' || (data?.mins_left !== null && data?.mins_left !== undefined && data.mins_left <= 0)) {
            setActiveTracking(prev => prev.filter(x => x.logId !== t.logId))
            showToast(`🏁 Shift ${t.shiftLabel} ended — auto checked-out`, 'ok')
          }
        } catch (err) { console.error('Ping failed:', err) }
      }
      await fetchMyLogs()
    }, TRACK_INTERVAL_MS)
    return () => clearInterval(trackRef.current)
  }, [activeTracking, campus, currentStaff?.id])

  // ── Check-in ──────────────────────────────────────────────────────────────

  const handleCheckIn = async (shift) => {
    if (!currentStaff?.id) { showToast('❌ Staff profile not found', 'err'); return }
    if (!campus)            { showToast('❌ Campus zone not configured', 'err'); return }
    if (!gpsCoords)         { showToast('❌ GPS not ready — click Detect Location first', 'err'); return }

    setCheckingIn(true)
    const fp = getDeviceFingerprint()

    try {
      const { data, error } = await supabase.rpc('server_checkin', {
        p_staff_id: currentStaff.id, p_shift_id: shift.id,
        p_shift_label: shift.shift_label, p_shift_start: shift.shift_start, p_shift_end: shift.shift_end,
        p_check_in_window_min: shift.check_in_window_min || 10,
        p_lat: gpsCoords.lat, p_lng: gpsCoords.lng, p_accuracy: gpsAccuracy || 20,
        p_device_fp: fp, p_device_info: navigator.userAgent.slice(0, 200),
        p_campus_lat: campus.lat, p_campus_lng: campus.lng, p_campus_radius: campus.radius,
      })

      if (error) { showToast('❌ ' + error.message, 'err'); setCheckingIn(false); return }

      if (!data.success) {
        const msgs = {
          rate_limited: '🚫 Too many attempts. Wait an hour.',
          wrong_time:   `⏰ Outside check-in window (server time: ${fmtTime(data.server_time)})`,
          duplicate:    '⚠️ Already checked in for this shift',
          weak_gps:     `⚠️ ${data.message}`,
          server_error: `❌ ${data.message}`,
        }
        showToast(msgs[data.error] || `❌ ${data.message || 'Check-in failed'}`, 'warn')
        setCheckingIn(false)
        return
      }

      const logId = data.log_id

      // FIX-G4: Only write bridge when NOT a duplicate (prevents corrupting check_in_time on retry)
      if (logId && data.error !== 'duplicate') {
        await supabase.rpc('server_ping', {
          p_attendance_id: logId, p_staff_id: currentStaff.id,
          p_lat: gpsCoords.lat, p_lng: gpsCoords.lng, p_accuracy: gpsAccuracy || 20,
          p_campus_lat: campus.lat, p_campus_lng: campus.lng, p_campus_radius: campus.radius,
          p_shift_end: shift.shift_end,
        })
        setActiveTracking(prev => [...prev, { logId, shiftId: shift.id, shiftLabel: shift.shift_label, shift }])
        setGpsStatus('tracking')

        // FIX-G1: Use actual distance vs campus.radius for geo_verified, not stale gpsStatus state
        const geoVerified = campus ? (gpsDistance || 999) <= campus.radius : false
        const checkInTs = new Date().toISOString()

        await supabase.from('self_attendance').upsert(
          [{ staff_id: currentStaff.id, date: today(), timestamp: checkInTs,
             method: 'QR', location_lat: gpsCoords.lat, location_lng: gpsCoords.lng,
             geo_verified: geoVerified, geo_distance: Math.round(gpsDistance || 0),
             device_id: fp }],
          { onConflict: 'staff_id,date' }
        )
        await supabase.from('attendance_logs').upsert(
          [{ staff_id: currentStaff.id, date: today(),
             status: data.status === 'Late' ? 'Late' : 'Present',
             marked_by: 'Geo', check_in_time: checkInTs,
             geo_verified: geoVerified,
             geo_distance: Math.round(gpsDistance || 0),
             updated_at: new Date() }],
          { onConflict: 'staff_id,date' }
        )
      }

      await fetchMyLogs()
      const status = data.status
      if (status === 'Late')         showToast(`🕐 Checked in LATE — ${data.late_minutes} min late. Tracking started.`, 'warn')
      else if (status === 'Flagged') showToast('🚨 Check-in flagged for review. Tracking started.', 'warn')
      else                           showToast(`✅ Checked in — Shift ${shift.shift_label} — ${status}. Tracking active.`, 'ok')

    } catch (err) { showToast('❌ ' + err.message, 'err') }
    setCheckingIn(false)
  }

  // ── Check-out ─────────────────────────────────────────────────────────────

  const handleCheckOut = async (logId, shiftLabel) => {
    if (!gpsCoords) {
      const confirmed = window.confirm('GPS not available. Check out without location? This will be flagged.')
      if (!confirmed) return
    }

    const { data, error } = await supabase.rpc('server_checkout', {
      p_attendance_id: logId, p_staff_id: currentStaff?.id,
      p_lat: gpsCoords?.lat ?? null, p_lng: gpsCoords?.lng ?? null,
      p_accuracy: gpsAccuracy ?? null,
      p_campus_lat: campus.lat, p_campus_lng: campus.lng, p_campus_radius: campus.radius,
    })

    if (error) { showToast('❌ ' + error.message, 'err'); return }

    setActiveTracking(prev => prev.filter(t => t.logId !== logId))
    if (!activeTracking.filter(t => t.logId !== logId).length) setGpsStatus('oncampus')

    // FIX-G3: Do NOT include status — preserve whatever was set on check-in (Present/Late/Flagged)
    await supabase.from('attendance_logs').upsert(
      [{ staff_id: currentStaff?.id, date: today(),
         marked_by: 'Geo',
         check_out_time: new Date().toISOString(),
         geo_verified: gpsCoords != null,
         updated_at: new Date() }],
      { onConflict: 'staff_id,date' }
    )

    await fetchMyLogs()
    showToast(
      data?.early_out
        ? `⚠️ Checked out early (${Math.round(data.mins_left || 0)} min before shift end) — flagged`
        : `✅ Checked out — Shift ${shiftLabel}`,
      data?.early_out ? 'warn' : 'ok'
    )
  }

  // ── Campus / shift save ───────────────────────────────────────────────────

  const saveCampus = async () => {
    if (!campusForm.lat || !campusForm.lng) { showToast('❌ Enter lat/lng', 'err'); return }
    setSavingCampus(true)
    const payload = { name: campusForm.name, latitude: parseFloat(campusForm.lat), longitude: parseFloat(campusForm.lng), radius_meters: parseInt(campusForm.radius) || 100, is_active: true }
    let error
    if (campus?.id) ({ error } = await supabase.from('attendance_zones').update(payload).eq('id', campus.id))
    else            ({ error } = await supabase.from('attendance_zones').insert(payload))
    if (error) showToast('❌ ' + error.message, 'err')
    else { showToast('✅ Campus zone saved', 'ok'); await fetchCampus() }
    setSavingCampus(false)
  }

  const saveShifts = async () => {
    if (!selectedStaff) { showToast('❌ Select a staff first', 'err'); return }
    setSavingShifts(true)
    for (const sf of shiftForms) {
      if (!sf.shift_label || !sf.shift_start || !sf.shift_end) continue
      const payload = { staff_id: parseInt(selectedStaff), shift_label: sf.shift_label, shift_start: sf.shift_start, shift_end: sf.shift_end, check_in_window_min: parseInt(sf.check_in_window_min) || 10, is_active: true, effective_from: today(), created_by: 'Admin' }
      if (sf.id && !String(sf.id).startsWith('new')) await supabase.from('staff_shifts').update(payload).eq('id', sf.id)
      else                                            await supabase.from('staff_shifts').insert(payload)
    }
    showToast('✅ Shifts saved', 'ok')
    setSavingShifts(false)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit: false })))
  }

  const deleteShift = async (id) => {
    if (!window.confirm('Remove this shift?')) return
    if (String(id).startsWith('new')) { setShiftForms(prev => prev.filter(s => s.id !== id)); return }
    await supabase.from('staff_shifts').update({ is_active: false }).eq('id', id)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit: false })))
    showToast('🗑️ Shift removed', 'ok')
  }

  // ── Fraud resolution ──────────────────────────────────────────────────────

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

  const handleExpandTrail = async (log) => {
    if (expandedTrail === log.id) { setExpandedTrail(null); return }
    await fetchTrailForLog(log.id)
    if (!logShiftMap[log.id]) {
      const staffShifts = await fetchShiftsFor(log.staff_id)
      const matchShift  = staffShifts.find(s => s.shift_label === log.shift_label)
      setLogShiftMap(prev => ({ ...prev, [log.id]: matchShift || null }))
    }
    setExpandedTrail(log.id)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

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
        {wasOffCampus && <div style={{ fontSize: '11px', background: '#dc2626', color: 'white', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>Admin Notified</div>}
      </div>
    )
  }

  const LateEntryInfo = ({ log }) => {
    if (!log?.late_minutes || log.late_minutes <= 0) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '12px', color: '#b45309', fontWeight: '600', marginTop: '4px' }}>
        🕐 Late entry: {log.late_minutes} min after shift start
      </div>
    )
  }

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 3000, padding: '13px 20px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: '600', color: 'white', background: toastType === 'err' ? '#dc2626' : toastType === 'warn' ? '#d97706' : '#16a34a', maxWidth: '380px' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📍 Geo-Attendance</h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          Server-verified · Continuous tracking · Fraud-proof · Shift-aware
          {campus && <span style={{ marginLeft: '12px', color: '#16a34a', fontWeight: '600' }}>✅ {campus.name} ({campus.radius}m)</span>}
        </p>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', gap: '4px', flexWrap: 'wrap' }}>
        {tabs.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>{t.label}</button>)}
      </div>

      {/* ══ MY CHECK-IN ══ */}
      {activeTab === 'checkin' && (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <TrackingBanner />
          <DeadSessionBanner logs={todayMyLogs} />

          {/* No staff profile warning */}
          {!currentStaff && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
              ⚠️ Staff profile not linked to your account. Contact admin to link your profile.
            </div>
          )}

          {myPendingAdvanceTotal > 0 && (
            <div style={{ background: '#fef9c3', border: '1px solid #f59e0b', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '600' }}>💳 Pending advance deduction this month</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#b45309' }}>{fmtRupee(myPendingAdvanceTotal)}</div>
            </div>
          )}

          {todayMyLogs.length > 0 && (
            <div style={{ ...S.card, padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f', marginBottom: '12px' }}>Today's Attendance</div>
              {todayMyLogs.map(log => {
                const isBeingTracked = activeTracking.some(t => t.logId === log.id)
                return (
                  <div key={log.id} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${log.session_dead ? '#fca5a5' : isBeingTracked ? '#7dd3fc' : '#e2e8f0'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>Shift {log.shift_label}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>In: {fmtTime(log.server_check_in_time || log.check_in_time)} · Out: {fmtTime(log.server_check_out_time || log.check_out_time)}</div>
                        {log.distance_from_campus !== null && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.distance_from_campus}m from campus</div>}
                        <LateEntryInfo log={log} />
                        {log.session_dead && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px' }}>⚠️ Session lost — tracking interrupted</div>}
                        {isBeingTracked && <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600', marginTop: '4px' }}>🛰️ Tracking active · server-verified every 2 min</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <StatusBadge status={log.status} />
                        {log.check_in_time && !log.check_out_time && !log.session_dead && (
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

          <div style={S.card}>
            <GPSRing
              status={gpsStatus} distance={gpsDistance} accuracy={gpsAccuracy} campus={campus}
              tracking={activeTracking.length > 0}
              minsLeft={activeTracking.length > 0 ? Math.max(0, Math.round(minutesToShiftEnd(activeTracking[0].shift))) : null}
            />
            {gpsStatus === 'idle' && (
              <button onClick={startGPS} style={{ ...S.btn('#1e3a5f'), width: '100%', padding: '14px', fontSize: '15px', fontWeight: '800' }}>📡 Detect My Location</button>
            )}
            {gpsStatus === 'locating' && (
              <div style={{ textAlign: 'center', color: '#f59e0b', fontWeight: '600', padding: '8px' }}>📡 Acquiring GPS signal...</div>
            )}
            {(gpsStatus === 'weak' || gpsStatus === 'error') && (
              <button onClick={startGPS} style={{ ...S.btn('#f59e0b'), width: '100%', padding: '12px' }}>🔄 Retry Detection</button>
            )}
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
                            <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600', marginTop: '3px' }}>🕐 {Math.round(shiftMinsLeft)} min until shift end</div>
                          )}
                        </div>
                        {alreadyDone
                          ? <StatusBadge status={todayMyLogs.find(l => l.shift_label === shift.shift_label)?.status || 'Present'} />
                          : inWindow
                            ? <button onClick={() => handleCheckIn(shift)} disabled={checkingIn}
                                style={{ ...S.btn(gpsStatus === 'outside' ? '#f97316' : '#16a34a', checkingIn), padding: '10px 16px', fontSize: '13px' }}>
                                {checkingIn ? '⏳' : gpsStatus === 'outside' ? '⚠️ Check In (Off Campus)' : '✅ Check In'}
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
        </div>
      )}

      {/* ══ MY HISTORY ══ */}
      {activeTab === 'history' && !isAdmin && (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>{['Date','Shift','Check-In','Check-Out','Late (min)','Distance','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {myLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fff7f7' : 'white' }}>
                  <td style={td}>{fmtDate(log.date)}</td>
                  <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                  <td style={td}>{fmtTime(log.server_check_in_time || log.check_in_time)}</td>
                  <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                  <td style={{ ...td, color: log.late_minutes > 0 ? '#b45309' : '#16a34a', fontWeight: '600' }}>{log.late_minutes > 0 ? `+${log.late_minutes} min` : '—'}</td>
                  <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: '600' }}>{log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}</td>
                  <td style={td}><StatusBadge status={log.status} />{log.session_dead && <span style={{ fontSize: '10px', color: '#dc2626', display: 'block', fontWeight: '600' }}>session lost</span>}</td>
                </tr>
              ))}
              {myLogs.length === 0 && <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No records yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MY ADVANCES ══ */}
      {activeTab === 'advances' && !isAdmin && (
        <div>
          <AdvanceSummary staffId={currentStaff?.id} advances={advances} />
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: '700', color: '#1e3a5f', borderBottom: '1px solid #f1f5f9', fontSize: '15px' }}>💳 My Advances</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr>{['Month','Amount','Repaid','Remaining','Per Month','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
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
                      <td style={td}><span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: a.status === 'Active' ? '#fef3c7' : '#dcfce7', color: a.status === 'Active' ? '#b45309' : '#16a34a' }}>{a.status}</span></td>
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

      {/* ══ LIVE MONITOR ══ */}
      {activeTab === 'monitor' && isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '14px', marginBottom: '20px' }}>
            {[
              { label: 'Total',        value: todayLogs.length,                                      color: '#1e3a5f', icon: '📋' },
              { label: 'Present',      value: todayLogs.filter(l => l.status === 'Present').length,  color: '#16a34a', icon: '✅' },
              { label: 'Late',         value: todayLogs.filter(l => l.status === 'Late').length,     color: '#b45309', icon: '🕐' },
              { label: 'Early Out',    value: todayLogs.filter(l => l.status === 'EarlyOut').length, color: '#dc2626', icon: '🏃' },
              { label: 'Session Lost', value: todayLogs.filter(l => l.session_dead).length,          color: '#7c3aed', icon: '📵' },
              { label: 'Flagged',      value: todayLogs.filter(l => l.is_fraud_suspected).length,    color: '#be185d', icon: '🚨' },
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
                <tr>{['Staff','Shift','Check-In','Check-Out','Late','Distance','Status','Fraud','Trail','Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {todayLogs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fdf4ff' : log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                      <td style={td}>
                        <div style={{ fontWeight: '600' }}>{log.staff_profiles?.name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.staff_profiles?.designation}</div>
                        {log.session_dead && <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700' }}>📵 session lost</div>}
                      </td>
                      <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                      <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                      <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                      <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: '600' }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                      <td style={{ ...td, fontWeight: '600', color: log.is_within_zone ? '#16a34a' : '#dc2626' }}>{log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}</td>
                      <td style={td}><StatusBadge status={log.status} /></td>
                      <td style={td}>{log.fraud_flags?.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)}</div> : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>}</td>
                      <td style={td}><button onClick={() => handleExpandTrail(log)} style={S.btnSm('#0ea5e9')}>{expandedTrail === log.id ? '▲ Hide' : '🗺️ Trail'}</button></td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button onClick={() => adminOverride(log.id, 'Present', 'Admin verified')} style={S.btnSm('#16a34a')}>✅</button>
                          <button onClick={() => adminOverride(log.id, 'Absent',  'Admin override')} style={S.btnSm('#dc2626')}>⭕</button>
                        </div>
                      </td>
                    </tr>
                    {expandedTrail === log.id && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan="10" style={{ padding: '0 16px 16px' }}>
                          <ShiftTimeline trail={trailMap[log.id] || []} shift={logShiftMap[log.id]} />
                          {(trailMap[log.id] || []).length === 0 && <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>No location trail recorded yet</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {todayLogs.length === 0 && <tr><td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No check-ins yet today</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ FRAUD ALERTS ══ */}
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
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#475569' }}>{fl.detail}</div>
                  {fl.lat && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>GPS: {fl.lat?.toFixed(6)}, {fl.lng?.toFixed(6)} · ±{fl.accuracy}m</div>}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(fl.created_at).toLocaleTimeString('en-IN')}</div>
              </div>
              {resolvingId === fl.id ? (
                <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', borderRadius: '10px' }}>
                  <label style={S.label}>Resolution Note *</label>
                  <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={2} placeholder="Explain resolution..." style={{ ...S.input, resize: 'vertical', marginBottom: '10px' }} />
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

      {/* ══ SHIFT SETUP ══ */}
      {activeTab === 'shifts' && isAdmin && (
        <div style={{ maxWidth: '640px' }}>
          {safeAllStaff.length === 0 && (
            <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
              ⚠️ No staff loaded — make sure to pass the <code>allStaff</code> prop to this component.
            </div>
          )}
          <div style={S.card}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>⏰ Shift Configuration</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={S.label}>Select Staff Member</label>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="">— Select Staff —</option>
                {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
              </select>
            </div>
            {selectedStaff && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {shiftForms.map((sf, i) => (
                    <div key={sf.id || i} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px', gap: '10px', alignItems: 'flex-end' }}>
                        <div><label style={S.label}>Label</label><input value={sf.shift_label} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_label: e.target.value } : s))} placeholder="A/B/C" style={S.input} maxLength={3} /></div>
                        <div><label style={S.label}>Start</label><input type="time" value={sf.shift_start} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_start: e.target.value } : s))} style={S.input} /></div>
                        <div><label style={S.label}>End</label><input type="time" value={sf.shift_end} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_end: e.target.value } : s))} style={S.input} /></div>
                        <div><label style={S.label}>Window (min)</label><input type="number" min="5" max="30" value={sf.check_in_window_min || 10} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, check_in_window_min: e.target.value } : s))} style={S.input} /></div>
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Window: {fmt12(sf.shift_start)} ±{sf.check_in_window_min || 10} min</span>
                        <button onClick={() => deleteShift(sf.id)} style={{ ...S.btnSm('#ef4444'), marginLeft: 'auto' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShiftForms(prev => [...prev, { id: 'new-' + Date.now(), shift_label: '', shift_start: '08:00', shift_end: '14:00', check_in_window_min: 10 }])} style={S.btn('#0ea5e9')}>+ Add Shift</button>
                  <button onClick={saveShifts} disabled={savingShifts} style={S.btn('#16a34a', savingShifts)}>{savingShifts ? '⏳ Saving...' : '💾 Save All'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ CAMPUS ZONE ══ */}
      {activeTab === 'campus' && isAdmin && (
        <div style={{ maxWidth: '520px' }}>
          <div style={S.card}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>🗺️ Campus Geofence</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}><label style={S.label}>Zone Name</label><input value={campusForm.name} onChange={e => setCampusForm({ ...campusForm, name: e.target.value })} style={S.input} /></div>
              <div><label style={S.label}>Latitude</label><input type="number" step="0.0001" value={campusForm.lat} onChange={e => setCampusForm({ ...campusForm, lat: e.target.value })} placeholder="e.g. 24.6821" style={S.input} /></div>
              <div><label style={S.label}>Longitude</label><input type="number" step="0.0001" value={campusForm.lng} onChange={e => setCampusForm({ ...campusForm, lng: e.target.value })} placeholder="e.g. 94.019" style={S.input} /></div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Allowed Radius (meters)</label>
                <input type="range" min="50" max="500" step="10" value={campusForm.radius} onChange={e => setCampusForm({ ...campusForm, radius: e.target.value })} style={{ width: '100%', marginBottom: '6px' }} />
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
        </div>
      )}

      {/* ══ MONTHLY REPORT ══ */}
      {activeTab === 'report' && isAdmin && (
        <>
          {safeAllStaff.length === 0 && (
            <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
              ⚠️ Staff list not loaded — pass the <code>allStaff</code> prop.
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div><label style={S.label}>Month</label><input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} /></div>
            <div style={{ minWidth: '220px' }}>
              <label style={S.label}>Staff</label>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="">All Staff</option>
                {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={fetchMonthLogs} style={S.btn('#1e3a5f')}>🔄 Load</button></div>
          </div>
          {!selectedStaff && (() => {
            const staffMap = {}
            monthLogs.forEach(l => {
              const name = l.staff_profiles?.name || l.staff_id
              if (!staffMap[name]) staffMap[name] = { name, designation: l.staff_profiles?.designation, total: 0, present: 0, late: 0, earlyOut: 0, absent: 0, flagged: 0, totalLateMin: 0, sessionLost: 0 }
              staffMap[name].total++
              if (l.status === 'Present')  staffMap[name].present++
              if (l.status === 'Late')     { staffMap[name].late++; staffMap[name].totalLateMin += l.late_minutes || 0 }
              if (l.status === 'EarlyOut') staffMap[name].earlyOut++
              if (l.status === 'Absent')   staffMap[name].absent++
              if (l.status === 'Flagged')  staffMap[name].flagged++
              if (l.session_dead)          staffMap[name].sessionLost++
            })
            const rows = Object.values(staffMap)
            return rows.length > 0 ? (
              <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '14px 16px', fontWeight: '700', color: '#1e3a5f', borderBottom: '1px solid #f1f5f9' }}>Staff Summary</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead><tr>{['Staff','Total','Present','Late','Late Min','Early Out','Absent','Flagged','Session Lost','Rate'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
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
                          <td style={{ ...td, color: '#7c3aed', fontWeight: '700' }}>{r.sessionLost > 0 ? r.sessionLost : '—'}</td>
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
              <thead><tr>{['Date','Staff','Shift','Check-In','Check-Out','Late','Distance','Status','Fraud'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {monthLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fdf4ff' : log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                    <td style={td}>{fmtDate(log.date)}</td>
                    <td style={td}><div style={{ fontWeight: '600' }}>{log.staff_profiles?.name || '—'}</div></td>
                    <td style={td}><span style={{ fontWeight: '700', color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                    <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                    <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                    <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: '600' }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                    <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: '600' }}>{log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}</td>
                    <td style={td}><StatusBadge status={log.status} />{log.session_dead && <span style={{ fontSize: '10px', color: '#7c3aed', display: 'block' }}>session lost</span>}</td>
                    <td style={td}>{log.fraud_flags?.length > 0 ? log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />) : <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>}</td>
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
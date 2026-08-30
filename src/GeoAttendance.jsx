/* GeoAttendance.jsx — Production v4 (schema-aligned)
 *
 * Fixes vs original:
 *  1. fetchTodayLogs / fetchMonthLogs: removed `department` from staff_profiles
 *     join select (column not confirmed; use safe subset name,designation)
 *  2. resolveFraud: null-guard on fl.attendance_id before calling
 *     admin_override_status (old fraud rows pre-schema may have null)
 *  3. self_attendance upsert: field names already match (geo_verified,
 *     geo_distance added by schema migration) — no change needed there
 *  4. All other column references verified correct against live schema
 */

import React, {
  useEffect, useState, useRef, useCallback, useMemo, Component,
} from 'react'
import { supabase } from './supabase'
import FaceCapture from './FaceCapture'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CAMPUS    = { lat: 24.62181, lng: 94.0193087, radius: 50, name: 'Main Campus' }
const TRACK_INTERVAL_MS = 2 * 60 * 1000
const DEAD_SESSION_MS   = 5 * 60 * 1000

const AUTO_CHECKOUT_THRESHOLD = 10
const RAILWAY_URL = ''

const FRAUD_TYPES = {
  outside_campus: { label: 'Outside Campus',     color: '#ef4444', icon: '📍' },
  fake_gps:       { label: 'Fake GPS Suspected',  color: '#f97316', icon: '🛰️' },
  wrong_time:     { label: 'Outside Time Window', color: '#f59e0b', icon: '⏰' },
  duplicate:      { label: 'Duplicate Attempt',   color: '#8b5cf6', icon: '🔁' },
  device_clash:   { label: 'Shared Device',       color: '#ec4899', icon: '📱' },
  velocity:       { label: 'Velocity Anomaly',    color: '#06b6d4', icon: '⚡' },
  early_out:      { label: 'Early Departure',     color: '#dc2626', icon: '🏃' },
  absent_period:  { label: 'Absent From Campus',  color: '#a855f7', icon: '👻' },
  weak_gps:       { label: 'Weak GPS Signal',     color: '#78716c', icon: '📡' },
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, info) { console.error('GeoAttendance error:', e, info) }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{this.state.error.message}</div>
        <button onClick={() => this.setState({ error: null })}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          Try Again
        </button>
      </div>
    )
    return this.props.children
  }
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
      const gl = document.createElement('canvas').getContext('webgl')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      parts.push(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-webgl')
    } catch { parts.push('no-webgl') }
    parts.push([
      navigator.userAgent, screen.width + 'x' + screen.height,
      navigator.language, new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|'))
    return btoa(parts.join('::::')).slice(0, 96)
  } catch { return 'fallback-' + navigator.userAgent.length + '-' + screen.width }
}

const toMin   = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const nowMin  = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() }

function isWithinWindow(shiftStart, windowMin = 10) {
  let diff = nowMin() - toMin(shiftStart)
  if (diff < -720) diff += 1440
  if (diff >  720) diff -= 1440
  return diff >= -windowMin && diff <= windowMin * 6
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

// Offline-resilient ping queue
const MAX_PING_RETRIES = 5 // give up on a stale ping after 5 attempts rather than retrying forever
const pingQueue = []
let pingFlushing = false
async function enqueuePing(payload) {
  pingQueue.push({ payload, retries: 0, at: Date.now() })
  if (!pingFlushing) flushPingQueue()
}
async function flushPingQueue() {
  pingFlushing = true
  while (pingQueue.length > 0) {
    const item = pingQueue[0]
    if (item.retries >= MAX_PING_RETRIES) { pingQueue.shift(); continue }
    try {
      const { error } = await supabase.rpc('server_ping', item.payload)
      if (error) throw error
      pingQueue.shift()
    } catch {
      item.retries++
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** item.retries, 30000)))
    }
  }
  pingFlushing = false
}

// IST-aware "today" date string
const today    = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'
const fmtDate  = (d)   => d   ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmt12    = (t)   => { if (!t) return '—'; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const fmtRupee = (n)   => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

function exportCSV(rows, filename) {
  const headers = ['Date','Staff','Shift','Check-In','Check-Out','Late (min)','Distance','Status','Fraud']
  const lines   = rows.map(l => [
    l.date,
    l.staff_profiles?.name || l.staff_id,
    'Shift ' + l.shift_label,
    fmtTime(l.server_check_in_time  || l.check_in_time),
    fmtTime(l.server_check_out_time || l.check_out_time),
    l.late_minutes || 0,
    l.distance_from_campus !== null ? Math.round(l.distance_from_campus) + 'm' : '',
    l.status,
    (l.fraud_flags || []).map(f => f.type).join(';'),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:  { padding: '20px', fontFamily: "'Segoe UI',sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '24px', marginBottom: '20px' },
  btn:   (c = '#1e3a5f', dis = false) => ({
    backgroundColor: dis ? '#94a3b8' : c, color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px', fontWeight: '600',
    cursor: dis ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: dis ? 0.7 : 1,
    transition: 'opacity 0.15s, transform 0.1s',
  }),
  btnSm: (c = '#1e3a5f') => ({
    backgroundColor: c, color: 'white', border: 'none', borderRadius: '6px',
    padding: '6px 12px', fontWeight: '600', cursor: 'pointer', fontSize: '12px',
  }),
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box',
  },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  tab:   (a) => ({
    padding: '10px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: `3px solid ${a ? '#1e3a5f' : 'transparent'}`,
    color: a ? '#1e3a5f' : '#64748b',
    transition: 'color 0.15s, border-color 0.15s',
  }),
}
const th = { padding: '11px 14px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px', background: '#f8fafc' }
const td = { padding: '11px 14px', verticalAlign: 'middle', color: '#334155', fontSize: '13px' }

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 18, radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Toast Queue ─────────────────────────────────────────────────────────────

function ToastQueue({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          color: 'white', maxWidth: 380,
          background: t.type === 'err' ? '#dc2626' : t.type === 'warn' ? '#d97706' : '#16a34a',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          animation: 'slideIn 0.25s ease',
        }} role="alert">
          {t.msg}
        </div>
      ))}
    </div>
  )
}

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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: m.bg, color: m.color }}>
      {m.icon} {status}
    </span>
  )
}

function FraudBadge({ type }) {
  const m = FRAUD_TYPES[type] || { label: type, color: '#64748b', icon: '⚠️' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: m.color + '18', color: m.color, border: `1px solid ${m.color}44` }}>
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
  const icon     = { idle: '📍', locating: '📡', oncampus: '✅', tracking: '🛰️', outside: '❌', weak: '⚠️', error: '❌' }[status] || '📍'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 16px' }} aria-label={`GPS status: ${status}`}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        {isActive && <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `2px solid ${color}55`, animation: 'pulse 2s infinite' }} />}
        {tracking  && <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '2px solid #0ea5e9', opacity: 0.4, animation: 'pulse 1s infinite' }} />}
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }} aria-hidden="true">
          <circle cx="70" cy="70" r="58" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="70" cy="70" r="58" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 58}`}
            strokeDashoffset={`${2 * Math.PI * 58 * (1 - (status === 'locating' ? 0.7 : isActive ? pct / 100 : 0.2))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
          {distance !== null && distance !== undefined && !['locating','idle'].includes(status) && (
            <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 4 }}>{Math.round(distance)}m</div>
          )}
          {tracking && minsLeft !== null && (
            <div style={{ fontSize: 10, color: '#0ea5e9', marginTop: 2, fontWeight: 700 }}>{Math.max(0, Math.round(minsLeft))}m left</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color }}>
          {status === 'idle'      ? 'Ready to Check In'
          : status === 'locating' ? 'Detecting Location...'
          : status === 'oncampus' ? 'You are ON CAMPUS'
          : status === 'tracking' ? '🛰️ Shift Tracking Active'
          : status === 'outside'  ? `Outside Campus — ${Math.round(distance || 0)}m away`
          : status === 'weak'     ? 'GPS Signal Weak'
          : 'Location Error'}
        </div>
        {tracking && <div style={{ fontSize: 12, color: '#0ea5e9', marginTop: 4, fontWeight: 600 }}>📡 Location verified every 2 minutes</div>}
        {accuracy && !['idle','error'].includes(status) && (
          <div style={{ fontSize: 12, color: accuracy > 50 ? '#f59e0b' : '#94a3b8', marginTop: 4 }}>
            GPS Accuracy: ±{Math.round(accuracy)}m{accuracy > 50 ? ' — weak signal' : ''}
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.08);opacity:0.4}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}
      `}</style>
    </div>
  )
}

// ─── Shift Timeline ───────────────────────────────────────────────────────────

function ShiftTimeline({ trail, shift }) {
  if (!trail.length || !shift) return (
    <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>No location trail recorded yet</div>
  )
  const startMin = toMin(shift.shift_start)
  const endMin   = toMin(shift.shift_end)
  const spanMin  = endMin - startMin || 1
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>
        📍 Location Trail — Shift {shift.shift_label} ({fmt12(shift.shift_start)} → {fmt12(shift.shift_end)})
      </div>
      <div style={{ position: 'relative', height: 24, background: '#e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        {trail.map((pt, i) => {
          const ts    = new Date(pt.server_recorded_at || pt.recorded_at)
          const ptMin = ts.getHours() * 60 + ts.getMinutes()
          const pct   = Math.min(100, Math.max(0, ((ptMin - startMin) / spanMin) * 100))
          return (
            <div key={i} title={`${fmtTime(pt.server_recorded_at || pt.recorded_at)} — ${pt.on_campus ? 'On campus' : `${pt.distance_from_campus || '?'}m away`} [${pt.event_type}]`}
              style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: pt.on_campus ? '#16a34a' : '#ef4444', border: '2px solid white', cursor: 'pointer' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
        <span>{fmt12(shift.shift_start)}</span>
        <span style={{ display: 'flex', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}/> On campus</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}/> Off campus</span>
        </span>
        <span>{fmt12(shift.shift_end)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
        {trail.filter(pt => pt.event_type !== 'ping').map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '4px 8px', background: 'white', borderRadius: 6 }}>
            <span>{{ left_campus: '🏃', returned: '✅', shift_end: '🏁', absent_period: '👻', check_in: '🟢', check_out: '🔴' }[pt.event_type] || '📍'}</span>
            <span style={{ color: '#64748b' }}>{fmtTime(pt.server_recorded_at || pt.recorded_at)}</span>
            <span style={{ fontWeight: 600, color: pt.on_campus ? '#16a34a' : '#dc2626' }}>
              {{ check_in: 'Checked in', check_out: 'Checked out', left_campus: 'Left campus', returned: 'Returned to campus', shift_end: 'Shift ended (auto)', absent_period: `Absent (${pt.distance_from_campus || '?'}m away)` }[pt.event_type] || (pt.on_campus ? 'On campus' : `Off campus (${pt.distance_from_campus || '?'}m)`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Connection Banner ────────────────────────────────────────────────────────

function OfflineBanner({ offline }) {
  if (!offline) return null
  return (
    <div role="alert" style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#b45309' }}>
      📵 No internet connection — pings will be retried automatically when you're back online
    </div>
  )
}
function usePushSubscription(currentStaff, isAdmin) {
  const subscriptionRef = useRef(null)
  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!currentStaff?.id && !isAdmin) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) { subscriptionRef.current = existing; return }
      const res = await fetch('/api/vapid-key')
      const { publicKey } = await res.json()
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      subscriptionRef.current = sub
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          staff_id: currentStaff?.id || null,
          role: isAdmin ? 'admin' : 'staff',
        }),
      })
    } catch (err) { 
  console.warn('Push subscription failed:', err.message)
  alert('Push error: ' + err.message) 
}
  }, [currentStaff?.id, isAdmin])
  const unsubscribe = useCallback(async () => {
    if (!subscriptionRef.current) return
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscriptionRef.current.endpoint }),
      })
      await subscriptionRef.current.unsubscribe()
      subscriptionRef.current = null
    } catch (err) { console.warn('Push unsubscribe failed:', err.message) }
  }, [])
  return { subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
function AttendanceChart({ rows, monthFilter }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!rows.length) return
    const load = () => {
      if (!window.Chart) return
      if (chartRef.current) chartRef.current.destroy()
      const labels   = rows.map(r => r.name.split(' ')[0])
      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Present',   data: rows.map(r => r.present),  backgroundColor: '#16a34a', borderRadius: 4 },
            { label: 'Late',      data: rows.map(r => r.late),      backgroundColor: '#b45309', borderRadius: 4 },
            { label: 'Early Out', data: rows.map(r => r.earlyOut),  backgroundColor: '#dc2626', borderRadius: 4 },
            { label: 'Absent',    data: rows.map(r => r.absent),    backgroundColor: '#94a3b8', borderRadius: 4 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
          },
        },
      })
    }
    if (window.Chart) { load() } else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      s.onload = load
      document.head.appendChild(s)
    }
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [rows])

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 14 }}>📊 Attendance Overview — {monthFilter}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
          {[['Present','#16a34a'],['Late','#b45309'],['Early Out','#dc2626'],['Absent','#94a3b8']].map(([l,c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', height: Math.max(200, rows.length * 40 + 60) + 'px' }}>
        <canvas ref={canvasRef} role="img" aria-label={`Attendance chart for ${monthFilter}`}>Attendance data for {monthFilter}</canvas>
      </div>
    </div>
  )
}
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GeoAttendance({ currentStaff, isAdmin: isAdminProp, allStaff = [], onCheckInSuccess = null }) {
  const safeAllStaff = Array.isArray(allStaff) ? allStaff : []

  // ── Server-verified admin role (do NOT trust props alone) ─────────────────
  const [serverIsAdmin,   setServerIsAdmin]   = useState(false)
  const [adminVerified,   setAdminVerified]   = useState(false)
  const isAdmin = serverIsAdmin || (isAdminProp && adminVerified)

  const [activeTab,     setActiveTab]     = useState('checkin')
  const [campus,        setCampus]        = useState(null)
  const [todayLogs,     setTodayLogs]     = useState([])
  const [fraudLogs,     setFraudLogs]     = useState([])
  const [monthLogs,     setMonthLogs]     = useState([])
  const [advances,      setAdvances]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [offline,       setOffline]       = useState(!navigator.onLine)

  // Toast queue
  const [toasts,        setToasts]        = useState([])
  const toastIdRef = useRef(0)

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
  const [bulkStaffIds, setBulkStaffIds]   = useState(new Set())   // multi-select for bulk shift assignment
  const [bulkShiftForm, setBulkShiftForm] = useState({ shift_label: '', shift_start: '08:00', shift_end: '14:00', check_in_window_min: 10 })
  const [savingBulkShift, setSavingBulkShift] = useState(false)
  const [monthFilter,   setMonthFilter]   = useState(new Date().toISOString().slice(0, 7))
  const [resolvingId,   setResolvingId]   = useState(null)
  const [resolveNote,   setResolveNote]   = useState('')
  const [expandedTrail, setExpandedTrail] = useState(null)
  const [loadingMonth,  setLoadingMonth]  = useState(false)

  const { subscribe, unsubscribe } = usePushSubscription(currentStaff, isAdmin)
  const watchRef       = useRef(null)
  const trackRef       = useRef(null)
  const coordsRef      = useRef(null)
  const trackingRef    = useRef([])
  const accuracyRef    = useRef(null)
  const realtimeRef    = useRef(null)
  const deadSessionRef = useRef(null)

  useEffect(() => { coordsRef.current   = gpsCoords },      [gpsCoords])
  useEffect(() => { accuracyRef.current = gpsAccuracy },    [gpsAccuracy])
  useEffect(() => { trackingRef.current = activeTracking }, [activeTracking])

  // ── Toast helper ─────────────────────────────────────────────────────────

  const showToast = useCallback((msg, type = 'ok') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  // ── Online / offline detection ──────────────────────────────────────────

  useEffect(() => {
    const on  = () => { setOffline(false); flushPingQueue() }
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e) => {
      if (e.data?.type === 'NAVIGATE_TAB' && e.data.tab) setActiveTab(e.data.tab)
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // ── Verify admin role from server ────────────────────────────────────────

  useEffect(() => {
  if (!currentStaff?.id && !isAdminProp) return
  const verify = async () => {
      const { data } = await supabase.rpc('auth_is_admin')
      setServerIsAdmin(!!data)
      setAdminVerified(true)
      if (!!data) setActiveTab('monitor')
      subscribe()
    }
    verify()
  }, [currentStaff?.id])

  // ── Fetchers ─────────────────────────────────────────────────────────────

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
    const { data } = await supabase.from('staff_shifts').select('*')
      .eq('staff_id', parseInt(staffId)).eq('is_active', true).order('shift_start')
    return data || []
  }, [])

  const fetchTodayLogs = useCallback(async () => {
    // FIX 1: removed 'department' from staff_profiles join — column not confirmed in schema
    const { data, error } = await supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name, designation)')
      .eq('date', today())
      .order('check_in_time', { ascending: false })
    if (!error) setTodayLogs(data || [])
  }, [])

  const fetchFraudLogs = useCallback(async () => {
    const { data, error } = await supabase.from('attendance_fraud_log')
      .select('*, staff_profiles(name, designation)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setFraudLogs(data || [])
  }, [])

  const fetchMyLogs = useCallback(async () => {
    if (!currentStaff?.id) return
    const { data, error } = await supabase.from('staff_geo_attendance')
      .select('*').eq('staff_id', currentStaff.id)
      .order('date', { ascending: false }).limit(30)
    if (!error) setMyLogs(data || [])
  }, [currentStaff?.id])

  const fetchMonthLogs = useCallback(async () => {
    if (!monthFilter) return
    setLoadingMonth(true)
    const from = monthFilter + '-01'
    const [y, m] = monthFilter.split('-').map(Number)
    const to = new Date(y, m, 0).toISOString().split('T')[0]
    // FIX 1 (same): removed 'department' from staff_profiles join
    let q = supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name, designation)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
      .limit(500)
    if (selectedStaff) q = q.eq('staff_id', selectedStaff)
    const { data, error } = await q
    if (!error) setMonthLogs(data || [])
    setLoadingMonth(false)
  }, [monthFilter, selectedStaff])

  const fetchAdvances = useCallback(async () => {
    const { data } = await supabase.from('staff_advances').select('*').order('created_at', { ascending: false })
    setAdvances(data || [])
  }, [])

  const fetchTrailForLog = useCallback(async (logId) => {
    const { data } = await supabase.from('attendance_location_trail').select('*')
      .eq('attendance_id', logId).order('recorded_at')
    setTrailMap(prev => ({ ...prev, [logId]: data || [] }))
  }, [])

  // ── Realtime subscription for live monitor ───────────────────────────────

  useEffect(() => {
    if (!isAdmin) return
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    realtimeRef.current = supabase
      .channel('geo-attendance-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_geo_attendance', filter: `date=eq.${today()}` },
        () => fetchTodayLogs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_fraud_log' },
        () => fetchFraudLogs())
      .subscribe()
    return () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current) }
  }, [isAdmin, fetchTodayLogs, fetchFraudLogs])

  // ── Dead session sweep ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAdmin) return
    const sweep = async () => {
      try { await supabase.rpc('detect_dead_sessions') } catch (e) { console.warn('Dead session sweep:', e?.message) }
    }
    sweep()
    deadSessionRef.current = setInterval(sweep, DEAD_SESSION_MS)
    return () => clearInterval(deadSessionRef.current)
  }, [isAdmin])

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchCampus()
      try { await fetchAdvances() } catch {}
      if (currentStaff?.id) {
        const sh = await fetchShiftsFor(currentStaff.id)
        setMyShifts(sh)
        await fetchMyLogs()
      }
      if (isAdminProp) {
        await Promise.all([fetchTodayLogs(), fetchFraudLogs()])
      }
      setLoading(false)
    }
    init()
  }, [currentStaff?.id, isAdminProp])

  useEffect(() => { if (isAdmin && activeTab === 'monitor') fetchTodayLogs() },  [activeTab, isAdmin])
  useEffect(() => { if (isAdmin && activeTab === 'fraud')   fetchFraudLogs() },  [activeTab, isAdmin])
  useEffect(() => {
  if (!isAdmin || activeTab !== 'report') return
  fetchMonthLogs().then(() => {
    if (!selectedStaff) {
      supabase.rpc('sync_attendance_salary_feed', { p_month: monthFilter })
        .then(({ data, error }) => {
          if (!error && data?.rows_synced > 0)
            console.log(`[salary feed] synced ${data.rows_synced} staff for ${monthFilter}`)
        })
        .catch(() => {})
    }
  })
}, [activeTab, isAdmin, monthFilter, selectedStaff])

  useEffect(() => {
    setShiftForms([])
    if (isAdmin && activeTab === 'shifts' && selectedStaff) {
      fetchShiftsFor(selectedStaff).then(sh => setShiftForms(sh.map(s => ({ ...s, _edit: false }))))
    }
  }, [activeTab, selectedStaff, isAdmin])

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    if (trackRef.current) clearInterval(trackRef.current)
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    clearInterval(deadSessionRef.current)
  }, [])

  // ── Page Visibility (pause GPS when tab hidden) ───────────────────────────

  useEffect(() => {
    const handle = () => {
      if (document.hidden) {
        if (watchRef.current) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null }
      } else if (activeTracking.length > 0 && !watchRef.current) {
        startGPS()
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [activeTracking])

  // ── Restore tracking on reload ────────────────────────────────────────────

  useEffect(() => {
    if (!myLogs.length || !myShifts.length || !campus || activeTracking.length) return
    const todayActive = myLogs.filter(l => l.date === today() && !l.check_out_time && !l.session_dead)
    if (!todayActive.length) return
    const trackList = todayActive.map(l => {
      const sh = myShifts.find(s => s.id === l.shift_id) || myShifts.find(s => s.shift_label === l.shift_label)
      return sh ? { logId: l.id, shiftId: sh.id, shiftLabel: sh.shift_label, shift: sh } : null
    }).filter(Boolean)
    if (trackList.length) {
      setActiveTracking(trackList)
      startGPS()
      showToast('🛰️ Resumed tracking — please allow location access', 'ok')
    }
  }, [myLogs, myShifts, campus])

  // ── GPS Watch ─────────────────────────────────────────────────────────────

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { showToast('❌ GPS not supported on this device', 'err'); return }
    setGpsStatus('locating')
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsCoords({ lat: latitude, lng: longitude })
        setGpsAccuracy(accuracy)
        if (!campus) return
        const dist = haversineClient(latitude, longitude, campus.lat, campus.lng)
        setGpsDistance(dist)
        setGpsStatus(
          accuracy > (campus.radius / 2) ? 'weak'
          : dist <= campus.radius
            ? (trackingRef.current.length ? 'tracking' : 'oncampus')
            : 'outside'
        )
      },
      (err) => {
        setGpsStatus('error')
        showToast('❌ ' + ({ 1: 'Location permission denied.', 2: 'GPS unavailable.', 3: 'GPS timeout.' }[err.code] || 'Location error'), 'err')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [campus, showToast])

  function haversineClient(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  // ── Interval ping (with offline queue) ───────────────────────────────────

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
        const payload = {
        p_attendance_id:        t.logId,
        p_staff_id:             currentStaff?.id,
        p_lat:                  coords.lat,
        p_lng:                  coords.lng,
        p_accuracy:             accuracy || 20,
        p_campus_lat:           campus.lat,
        p_campus_lng:           campus.lng,
        p_campus_radius:        campus.radius,
        p_shift_end:            t.shift.shift_end,
        p_absent_threshold_min: AUTO_CHECKOUT_THRESHOLD,
      }
        try {
          if (!navigator.onLine) { enqueuePing(payload); continue }
           const { data, error } = await supabase.rpc('server_ping', {
    ...payload,
    p_absent_threshold_min: AUTO_CHECKOUT_THRESHOLD,
  })
  if (error) { enqueuePing(payload); continue }
 
  if (data?.off_since) setOffCampusSince(data.off_since)
  else setOffCampusSince(null)
 
  // ── auto-checkout: staff left campus too long ──────────────────────────
  if (data?.event_type === 'auto_checkout') {
    setActiveTracking(prev => prev.filter(x => x.logId !== t.logId))
    if (!activeTracking.filter(x => x.logId !== t.logId).length) setGpsStatus('oncampus')
    showToast(
      `🏃 Auto checked-out — Shift ${t.shiftLabel}: off campus for ${data.off_minutes} min`,
      'warn'
    )
    await fetchMyLogs()
    continue
  }
 
  // ── shift ended (server time past shift_end) ───────────────────────────
  if (data?.event_type === 'shift_end' || (data?.mins_left !== null && data?.mins_left <= 0)) {
    setActiveTracking(prev => prev.filter(x => x.logId !== t.logId))
    showToast(`🏁 Shift ${t.shiftLabel} ended — auto checked-out`, 'ok')
    await fetchMyLogs()
    continue
  }
 
  // ── left campus warning ────────────────────────────────────────────────
  if (data?.event_type === 'left_campus') {
    showToast('⚠️ You left campus. Will auto check-out in 10 min if not returned.', 'warn')
  }
 
  // ── returned to campus ─────────────────────────────────────────────────
  if (data?.event_type === 'returned') {
    showToast('✅ Back on campus — tracking continues', 'ok')
    setOffCampusSince(null)
  }
        } catch { enqueuePing(payload) }
      }
      await fetchMyLogs()
    }, TRACK_INTERVAL_MS)
    return () => clearInterval(trackRef.current)
  }, [activeTracking, campus, currentStaff?.id, showToast, fetchMyLogs])

  // ── Check-in ──────────────────────────────────────────────────────────────
  // Face verification now gates check-in (see server_checkin's Step 0).
  // handleCheckIn validates GPS/campus same as before, then opens the
  // FaceCapture overlay; performCheckIn (below) runs after a face result
  // comes back, carrying p_face_verified / p_face_score into the RPC.

  const [faceCaptureShift, setFaceCaptureShift] = useState(null) // shift pending face scan, or null

  const handleCheckIn = (shift) => {
    if (!currentStaff?.id) { showToast('❌ Staff profile not linked — contact admin', 'err'); return }
    if (!campus)            { showToast('❌ Campus zone not configured', 'err'); return }
    if (!gpsCoords)         { showToast('❌ GPS not ready — click Detect Location first', 'err'); return }
    if (!navigator.onLine)  { showToast('❌ No internet connection — please try when online', 'err'); return }
    if (gpsAccuracy && gpsAccuracy > (campus.radius / 2)) { showToast(`❌ GPS too weak (±${Math.round(gpsAccuracy)}m) — move to open area`, 'err'); return }

    setFaceCaptureShift(shift) // opens <FaceCapture> overlay, see render section
  }

  const performCheckIn = async (shift, faceResult) => {
    setFaceCaptureShift(null)
    setCheckingIn(true)
    try {
      const { data, error } = await supabase.rpc('server_checkin', {
        p_staff_id:            currentStaff.id,
        p_shift_id:            shift.id,
        p_shift_label:         shift.shift_label,
        p_shift_start:         shift.shift_start,
        p_shift_end:           shift.shift_end,
        p_check_in_window_min: shift.check_in_window_min || 10,
        p_lat:                 gpsCoords.lat,
        p_lng:                 gpsCoords.lng,
        p_accuracy:            gpsAccuracy || 20,
        p_device_fp:           getDeviceFingerprint(),
        p_device_info:         navigator.userAgent.slice(0, 200),
        p_campus_lat:          campus.lat,
        p_campus_lng:          campus.lng,
        p_campus_radius:       campus.radius,
        p_face_verified:       faceResult.verified,
        p_face_score:          faceResult.score,
        p_liveness_challenge_id: faceResult.challengeId,
      })

      if (error) { showToast('❌ ' + error.message, 'err'); setCheckingIn(false); return }

      if (!data.success) {
        const msgs = {
          rate_limited:      '🚫 Too many attempts — wait an hour.',
          wrong_time:        `⏰ Outside check-in window (server time: ${fmtTime(data.server_time)})`,
          duplicate:         '⚠️ Already checked in for this shift',
          weak_gps:          `📡 ${data.message}`,
          unauthorized:      '❌ Authentication error — please refresh',
          face_not_enrolled: '🧑‍💼 Face not enrolled or not yet approved — contact admin',
          face_mismatch:     '❌ Face did not match your enrolled profile — try again',
          liveness_missing:  '❌ Liveness check missing — try again',
          liveness_failed:   '❌ Liveness check expired or invalid — try again',
        }
        showToast(msgs[data.error] || `❌ ${data.message || 'Check-in failed'}`, 'warn')
        setCheckingIn(false)
        return
      }

      const logId = data.log_id

      if (logId) {
        setActiveTracking(prev => [...prev, { logId, shiftId: shift.id, shiftLabel: shift.shift_label, shift }])
        setGpsStatus('tracking')

        // Sync bridge — self_attendance (geo_verified + geo_distance added by migration)
        await supabase.rpc('sync_self_attendance', {
  p_staff_id:    currentStaff.id,
  p_date:        today(),
  p_lat:         gpsCoords.lat,
  p_lng:         gpsCoords.lng,
  p_geo_verified: (gpsDistance || 999) <= campus.radius,
  p_geo_distance: Math.round(gpsDistance || 0),
  p_device_fp:   getDeviceFingerprint(),
})
      }

      await fetchMyLogs()
      const status = data.status
      if (status === 'Late')         showToast(`🕐 Checked in LATE — ${data.late_minutes} min. Tracking started.`, 'warn')
      else if (status === 'Flagged') showToast('🚨 Check-in flagged for review. Tracking started.', 'warn')
      else                           showToast(`✅ Checked in — Shift ${shift.shift_label}. Tracking active.`, 'ok')

      // Give the person a moment to see the success toast before jumping
      // back to the Face Attendance home grid.
      console.log('[GeoAttendance] check-in success — onCheckInSuccess is:', typeof onCheckInSuccess, onCheckInSuccess)
      if (onCheckInSuccess) {
        console.log('[GeoAttendance] scheduling redirect in 1200ms')
        setTimeout(() => {
          console.log('[GeoAttendance] firing onCheckInSuccess now')
          onCheckInSuccess()
        }, 1200)
      } else {
        console.log('[GeoAttendance] onCheckInSuccess is falsy, skipping redirect')
      }
    } catch (err) {
      showToast('❌ ' + err.message, 'err')
    }
    setCheckingIn(false)
  }

  // ── Check-out ─────────────────────────────────────────────────────────────

  const handleCheckOut = async (logId, shiftLabel) => {
    if (!navigator.onLine && !window.confirm('No internet connection. Queue checkout for when you\'re back online?')) return
    if (!gpsCoords && !window.confirm('GPS not available. Check out without location? This will be flagged.')) return

    const { data, error } = await supabase.rpc('server_checkout', {
      p_attendance_id: logId,
      p_staff_id:      currentStaff?.id ? parseInt(currentStaff.id) : null,
      p_lat:           gpsCoords?.lat ?? null,
      p_lng:           gpsCoords?.lng ?? null,
      p_accuracy:      gpsAccuracy   ?? null,
      p_campus_lat:    campus?.lat,
      p_campus_lng:    campus?.lng,
      p_campus_radius: campus?.radius,
    })

    if (error) { showToast('❌ ' + error.message, 'err'); return }

    setActiveTracking(prev => {
      const remaining = prev.filter(t => t.logId !== logId)
      if (!remaining.length) setGpsStatus('oncampus')
      return remaining
    })

    await fetchMyLogs()
    showToast(
      data?.early_out
        ? `⚠️ Checked out early (${Math.round(data.mins_left || 0)} min before shift end) — flagged`
        : `✅ Checked out — Shift ${shiftLabel}`,
      data?.early_out ? 'warn' : 'ok'
    )
  }

  // ── Campus save ───────────────────────────────────────────────────────────

  const saveCampus = async () => {
    if (!campusForm.lat || !campusForm.lng) { showToast('❌ Enter lat/lng', 'err'); return }
    setSavingCampus(true)
    const payload = {
      name: campusForm.name,
      latitude: parseFloat(campusForm.lat),
      longitude: parseFloat(campusForm.lng),
      radius_meters: parseInt(campusForm.radius) || 100,
      is_active: true,
    }
    await supabase.from('attendance_zones').update({ is_active: false }).eq('is_active', true)
    const { error } = await supabase.from('attendance_zones').insert(payload)
    if (error) showToast('❌ ' + error.message, 'err')
    else { showToast('✅ Campus zone saved', 'ok'); await fetchCampus() }
    setSavingCampus(false)
  }

  // ── Shifts save ───────────────────────────────────────────────────────────

  // ── Bulk shift assignment ──────────────────────────────────────────────
  // Applies ONE shift definition to every selected staff member in one go.
  // Kept fully separate from saveShifts/selectedStaff above so the existing
  // per-staff editor (with its own edit/history behavior) is untouched.
  const saveBulkShift = async () => {
    if (bulkStaffIds.size === 0) { showToast('❌ Select at least one staff member', 'err'); return }
    if (!bulkShiftForm.shift_label || !bulkShiftForm.shift_start || !bulkShiftForm.shift_end) {
      showToast('❌ Fill in shift label, start, and end time', 'err'); return
    }
    setSavingBulkShift(true)
    const payload = {
      shift_label: bulkShiftForm.shift_label,
      shift_start: bulkShiftForm.shift_start,
      shift_end: bulkShiftForm.shift_end,
      check_in_window_min: parseInt(bulkShiftForm.check_in_window_min) || 10,
      is_active: true, effective_from: today(), created_by: 'Admin',
    }
    let successCount = 0
    for (const staffId of bulkStaffIds) {
      const { error } = await supabase.from('staff_shifts').insert({ ...payload, staff_id: parseInt(staffId) })
      if (!error) successCount++
    }
    setSavingBulkShift(false)
    if (successCount === bulkStaffIds.size) {
      showToast(`✅ Shift assigned to ${successCount} staff`, 'ok')
      setBulkStaffIds(new Set())
    } else {
      showToast(`⚠️ ${successCount}/${bulkStaffIds.size} saved — check console for errors`, 'warn')
    }
    if (selectedStaff && bulkStaffIds.has(String(selectedStaff))) {
      const sh = await fetchShiftsFor(selectedStaff)
      setShiftForms(sh.map(s => ({ ...s, _edit: false })))
    }
  }

  const toggleBulkStaff = (id) => setBulkStaffIds(prev => {
    const next = new Set(prev)
    next.has(String(id)) ? next.delete(String(id)) : next.add(String(id))
    return next
  })
  const selectAllBulkStaff  = () => setBulkStaffIds(new Set(safeAllStaff.map(s => String(s.id))))
  const clearAllBulkStaff   = () => setBulkStaffIds(new Set())

  const saveShifts = async () => {
    if (!selectedStaff) { showToast('❌ Select a staff member first', 'err'); return }
    setSavingShifts(true)
    for (const sf of shiftForms) {
      if (!sf.shift_label || !sf.shift_start || !sf.shift_end) continue
      const payload = {
        staff_id: parseInt(selectedStaff), shift_label: sf.shift_label,
        shift_start: sf.shift_start, shift_end: sf.shift_end,
        check_in_window_min: parseInt(sf.check_in_window_min) || 10,
        is_active: true, effective_from: today(), created_by: 'Admin',
      }
      if (sf.id && !String(sf.id).startsWith('new')) {
        await supabase.from('staff_shifts').update(payload).eq('id', sf.id)
      } else {
        await supabase.from('staff_shifts').insert(payload)
      }
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
    await supabase.from('attendance_fraud_log').update({
      resolved: true, resolved_by: 'Admin', resolved_note: resolveNote, resolved_at: new Date().toISOString()
    }).eq('id', logId)

    // FIX 2: null-guard — old fraud rows may not have attendance_id populated
    if (action === 'absent') {
      const fl = fraudLogs.find(f => f.id === logId)
      if (fl?.attendance_id) {
        await supabase.rpc('admin_override_status', {
          p_log_id: fl.attendance_id, p_status: 'Absent', p_note: resolveNote
        })
      } else {
        showToast('⚠️ Status not updated — this alert has no linked attendance record', 'warn')
      }
    }

    setResolvingId(null); setResolveNote('')
    await fetchFraudLogs()
    showToast('✅ Fraud alert resolved', 'ok')
  }

  // Audited admin override
  const adminOverride = async (logId, newStatus, note) => {
    const { data, error } = await supabase.rpc('admin_override_status', { p_log_id: logId, p_status: newStatus, p_note: note })
    if (error) { showToast('❌ ' + error.message, 'err'); return }
    if (!data?.ok) { showToast('❌ Override failed — ' + (data?.error || 'unknown'), 'err'); return }
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

  const myPendingAdvanceTotal = useMemo(() =>
    advances
      .filter(a => String(a.staff_id) === String(currentStaff?.id) && a.status === 'Active')
      .reduce((sum, a) => {
        const rem = Number(a.amount) - Number(a.repaid_amount)
        const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
        return sum + Math.min(pm, rem)
      }, 0),
  [advances, currentStaff?.id])

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
    <div style={{ ...S.page, padding: 32 }}>
      <div style={{ fontFamily: "'Segoe UI',sans-serif" }}>
        <Skeleton w={220} h={28} radius={8} />
        <div style={{ marginTop: 8 }}><Skeleton w={340} h={14} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {[1,2,3].map(i => <Skeleton key={i} w={100} h={36} radius={8} />)}
        </div>
        <div style={{ marginTop: 24 }}><Skeleton h={200} radius={12} /></div>
      </div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )

  // ── Sub-components ────────────────────────────────────────────────────────

  const TrackingBanner = () => {
    if (!activeTracking.length) return null
    const wasOff = offCampusSince
    return (
      <div role="status" style={{ background: wasOff ? '#fee2e2' : '#e0f2fe', border: `1px solid ${wasOff ? '#fca5a5' : '#7dd3fc'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 22 }}>{wasOff ? '⚠️' : '🛰️'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: wasOff ? '#dc2626' : '#0369a1', fontSize: 13 }}>
            {wasOff ? `OFF CAMPUS — auto checkout in ${AUTO_CHECKOUT_THRESHOLD} min if not returned` : 'Location Tracking Active'}
          </div>
          <div style={{ fontSize: 12, color: wasOff ? '#7f1d1d' : '#0c4a6e', marginTop: 2 }}>
            {activeTracking.map(t => `Shift ${t.shiftLabel} (ends ${fmt12(t.shift.shift_end)})`).join(' · ')}
            {lastPingTime && ` · Last ping: ${fmtTime(lastPingTime)}`}
          </div>
        </div>
        {wasOff && <div style={{ fontSize: 11, background: '#dc2626', color: 'white', padding: '4px 10px', borderRadius: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>Admin Notified</div>}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div style={S.page}>
        <ToastQueue toasts={toasts} />

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📍 Geo-Attendance</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
            Server-verified · Continuous tracking · Fraud-proof · Shift-aware
            {campus && <span style={{ marginLeft: 12, color: '#16a34a', fontWeight: 600 }}>✅ {campus.name} ({campus.radius}m)</span>}
            {offline && <span style={{ marginLeft: 12, color: '#dc2626', fontWeight: 600 }}>📵 Offline</span>}
          </p>
        </div>

        <div role="tablist" style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24, gap: 4, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ MY CHECK-IN ══ */}
        {activeTab === 'checkin' && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <OfflineBanner offline={offline} />
            <TrackingBanner />

            {todayMyLogs.some(l => l.session_dead && !l.check_out_time) && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>⚠️ Session interrupted — location tracking was lost</div>
                <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>
                  {todayMyLogs.filter(l => l.session_dead && !l.check_out_time).map(l => `Shift ${l.shift_label}`).join(', ')} — tab was closed or app killed mid-shift. Admin has been notified.
                </div>
              </div>
            )}

            {!currentStaff && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#b45309', fontWeight: 600 }}>
                ⚠️ Staff profile not linked to your account. Contact admin to link your profile.
              </div>
            )}

            {myPendingAdvanceTotal > 0 && (
              <div style={{ background: '#fef9c3', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#b45309', fontWeight: 600 }}>💳 Pending advance deduction this month</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#b45309' }}>{fmtRupee(myPendingAdvanceTotal)}</div>
              </div>
            )}

            {todayMyLogs.length > 0 && (
              <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>Today's Attendance</div>
                {todayMyLogs.map(log => {
                  const isBeingTracked = activeTracking.some(t => t.logId === log.id)
                  return (
                    <div key={log.id} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, marginBottom: 8, border: `1px solid ${log.session_dead ? '#fca5a5' : isBeingTracked ? '#7dd3fc' : '#e2e8f0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Shift {log.shift_label}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>In: {fmtTime(log.server_check_in_time || log.check_in_time)} · Out: {fmtTime(log.server_check_out_time || log.check_out_time)}</div>
                          {log.distance_from_campus !== null && <div style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(log.distance_from_campus)}m from campus at check-in</div>}
                          {log.late_minutes > 0 && <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 3 }}>🕐 Late by {log.late_minutes} min</div>}
                          {log.session_dead && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>⚠️ Session lost — tracking interrupted</div>}
                          {isBeingTracked && <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginTop: 4 }}>🛰️ Tracking active</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <StatusBadge status={log.status} />
                          {log.check_in_time && !log.check_out_time && !log.session_dead && (
                            <button onClick={() => handleCheckOut(log.id, log.shift_label)} style={S.btnSm('#0ea5e9')}>Check Out</button>
                          )}
                          {(log.fraud_flags || []).map((f, i) => <FraudBadge key={i} type={f.type} />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {'Notification' in window && Notification.permission === 'default' && (
  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '10px 16px', marginBottom: 14, display: 'flex',
    justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
      🔔 Enable push notifications to get shift alerts
    </div>
    <button onClick={subscribe} style={S.btnSm('#1d4ed8')}>Enable</button>
  </div>
)}
<div style={S.card}>
              <GPSRing
                status={gpsStatus} distance={gpsDistance} accuracy={gpsAccuracy} campus={campus}
                tracking={activeTracking.length > 0}
                minsLeft={activeTracking.length > 0 ? minutesToShiftEnd(activeTracking[0].shift) : null}
              />

              {gpsStatus === 'idle' && (
                <button onClick={startGPS} style={{ ...S.btn('#1e3a5f'), width: '100%', padding: 14, fontSize: 15, fontWeight: 800 }}>
                  📡 Detect My Location
                </button>
              )}
              {gpsStatus === 'locating' && (
                <div style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600, padding: 8 }}>📡 Acquiring GPS signal...</div>
              )}
              {['weak', 'error'].includes(gpsStatus) && (
                <button onClick={startGPS} style={{ ...S.btn('#f59e0b'), width: '100%', padding: 12 }}>🔄 Retry Detection</button>
              )}

              {['oncampus', 'outside', 'tracking'].includes(gpsStatus) && myShifts.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myShifts.map(shift => {
                    const alreadyDone   = todayMyLogs.some(l => l.shift_label === shift.shift_label)
                    const inWindow      = isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)
                    const minsLeft      = minutesUntilWindow(shift.shift_start, shift.check_in_window_min || 10)
                    const isTracked     = activeTracking.some(t => t.shiftLabel === shift.shift_label)
                    const shiftMinsLeft = minutesToShiftEnd(shift)
                    return (
                      <div key={shift.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: `1px solid ${alreadyDone ? '#bbf7d0' : isTracked ? '#7dd3fc' : inWindow ? '#1e3a5f44' : '#e2e8f0'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Shift {shift.shift_label}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{fmt12(shift.shift_start)} → {fmt12(shift.shift_end)}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Window: ±{shift.check_in_window_min || 10} min</div>
                            {isTracked && shiftMinsLeft > 0 && (
                              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginTop: 3 }}>🕐 {Math.max(0, Math.round(shiftMinsLeft))} min until shift end</div>
                            )}
                          </div>
                          {alreadyDone
                            ? <StatusBadge status={todayMyLogs.find(l => l.shift_label === shift.shift_label)?.status || 'Present'} />
                            : inWindow
                              ? <button onClick={() => handleCheckIn(shift)} disabled={checkingIn}
                                  style={{ ...S.btn(gpsStatus === 'outside' ? '#f97316' : '#16a34a', checkingIn), padding: '10px 16px', fontSize: 13 }}>
                                  {checkingIn ? '⏳' : gpsStatus === 'outside' ? '⚠️ Check In (Off Campus)' : '✅ Check In'}
                                </button>
                              : minsLeft > 0
                                ? <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>Opens in {minsLeft}m</span>
                                : <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Window closed</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {['oncampus', 'outside', 'tracking'].includes(gpsStatus) && myShifts.length === 0 && (
                <div style={{ marginTop: 12, padding: 14, background: '#fef3c7', borderRadius: 10, textAlign: 'center', fontSize: 13, color: '#b45309', fontWeight: 600 }}>
                  ⚠️ No shifts assigned. Contact admin.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MY HISTORY ══ */}
        {activeTab === 'history' && !isAdmin && (
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 15 }}>📅 My Attendance History</div>
              <button onClick={() => exportCSV(myLogs.map(l => ({ ...l, staff_profiles: currentStaff })), `attendance-${today()}.csv`)} style={S.btnSm('#1e3a5f')}>⬇ Export CSV</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Date','Shift','Check-In','Check-Out','Late','Distance','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {myLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fff7f7' : 'white' }}>
                      <td style={td}>{fmtDate(log.date)}</td>
                      <td style={td}><span style={{ fontWeight: 700, color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                      <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                      <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                      <td style={{ ...td, color: log.late_minutes > 0 ? '#b45309' : '#16a34a', fontWeight: 600 }}>{log.late_minutes > 0 ? `+${log.late_minutes}m` : '—'}</td>
                      <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                      <td style={td}><StatusBadge status={log.status} /></td>
                    </tr>
                  ))}
                  {myLogs.length === 0 && <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No records yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ MY ADVANCES ══ */}
        {activeTab === 'advances' && !isAdmin && (
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #f1f5f9', fontSize: 15 }}>💳 My Advances</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Month','Amount','Repaid','Remaining','Per Month','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).map(a => {
                  const rem = Number(a.amount) - Number(a.repaid_amount)
                  const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={td}>{a.issued_month}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtRupee(a.amount)}</td>
                      <td style={{ ...td, color: '#16a34a', fontWeight: 600 }}>{fmtRupee(a.repaid_amount)}</td>
                      <td style={{ ...td, color: rem > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{fmtRupee(rem)}</td>
                      <td style={{ ...td, color: '#7c3aed', fontWeight: 600 }}>{rem > 0 ? fmtRupee(Math.min(pm, rem)) : '—'}</td>
                      <td style={td}><span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: a.status === 'Active' ? '#fef3c7' : '#dcfce7', color: a.status === 'Active' ? '#b45309' : '#16a34a' }}>{a.status}</span></td>
                    </tr>
                  )
                })}
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).length === 0 && (
                  <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No advance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ LIVE MONITOR ══ */}
        {activeTab === 'monitor' && isAdmin && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total',        value: todayLogs.length,                                      color: '#1e3a5f', icon: '📋' },
                { label: 'Present',      value: todayLogs.filter(l => l.status === 'Present').length,  color: '#16a34a', icon: '✅' },
                { label: 'Late',         value: todayLogs.filter(l => l.status === 'Late').length,     color: '#b45309', icon: '🕐' },
                { label: 'Early Out',    value: todayLogs.filter(l => l.status === 'EarlyOut').length, color: '#dc2626', icon: '🏃' },
                { label: 'Session Lost', value: todayLogs.filter(l => l.session_dead).length,          color: '#7c3aed', icon: '📵' },
                { label: 'Flagged',      value: todayLogs.filter(l => l.is_fraud_suspected).length,    color: '#be185d', icon: '🚨' },
              ].map(c => (
                <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: 20 }}>{c.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>Live — {fmtDate(today())} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(auto-updates)</span></div>
              <button onClick={fetchTodayLogs} style={S.btnSm('#1e3a5f')}>🔄 Refresh</button>
            </div>
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>{['Staff','Shift','Check-In','Check-Out','Late','Distance','Status','Fraud','Trail','Override'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {todayLogs.map(log => (
                      <React.Fragment key={log.id}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fdf4ff' : log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{log.staff_profiles?.name || '—'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.staff_profiles?.designation}</div>
                            {log.session_dead && <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>📵 session lost</div>}
                          </td>
                          <td style={td}><span style={{ fontWeight: 700, color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                          <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                          <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                          <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                          <td style={{ ...td, fontWeight: 600, color: log.is_within_zone ? '#16a34a' : '#dc2626' }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                          <td style={td}><StatusBadge status={log.status} /></td>
                          <td style={td}>
                            {(log.fraud_flags || []).length > 0
                              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)}</div>
                              : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={td}><button onClick={() => handleExpandTrail(log)} style={S.btnSm('#0ea5e9')}>{expandedTrail === log.id ? '▲ Hide' : '🗺️ Trail'}</button></td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => adminOverride(log.id, 'Present', 'Admin verified')} style={S.btnSm('#16a34a')} title="Mark Present">✅</button>
                              <button onClick={() => adminOverride(log.id, 'Absent',  'Admin override')} style={S.btnSm('#dc2626')} title="Mark Absent">⭕</button>
                            </div>
                          </td>
                        </tr>
                        {expandedTrail === log.id && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan="10" style={{ padding: '0 16px 16px' }}>
                              <ShiftTimeline trail={trailMap[log.id] || []} shift={logShiftMap[log.id]} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {todayLogs.length === 0 && <tr><td colSpan="10" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No check-ins yet today</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══ FRAUD ALERTS ══ */}
        {activeTab === 'fraud' && isAdmin && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', margin: 0 }}>🚨 Unresolved Fraud Alerts</h2>
              <button onClick={fetchFraudLogs} style={S.btnSm('#dc2626')}>🔄 Refresh</button>
            </div>
            {fraudLogs.length === 0 && (
              <div style={{ ...S.card, textAlign: 'center', color: '#16a34a', padding: 48 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700 }}>No unresolved fraud alerts</div>
              </div>
            )}
            {fraudLogs.map(fl => (
              <div key={fl.id} style={{ ...S.card, border: `1px solid ${FRAUD_TYPES[fl.fraud_type]?.color || '#ef4444'}44`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <FraudBadge type={fl.fraud_type} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(fl.date)} · Shift {fl.shift_label}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{fl.staff_profiles?.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{fl.staff_profiles?.designation}</div>
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569' }}>{fl.detail}</div>
                    {fl.lat && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>GPS: {fl.lat?.toFixed(6)}, {fl.lng?.toFixed(6)} · ±{fl.accuracy}m</div>}
                    {/* FIX 2: show warning when attendance_id is missing (pre-migration rows) */}
                    {!fl.attendance_id && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>⚠️ No linked attendance record — status override unavailable</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(fl.created_at).toLocaleTimeString('en-IN')}</div>
                </div>
                {resolvingId === fl.id ? (
                  <div style={{ marginTop: 14, padding: 14, background: '#f8fafc', borderRadius: 10 }}>
                    <label style={S.label}>Resolution Note *</label>
                    <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={2}
                      placeholder="Explain resolution..." style={{ ...S.input, resize: 'vertical', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => resolveFraud(fl.id, 'approve')} style={S.btn('#16a34a')}>✅ Approve (Keep Status)</button>
                      {/* FIX 2: disable "Mark Absent" when no linked attendance_id */}
                      <button onClick={() => resolveFraud(fl.id, 'absent')} disabled={!fl.attendance_id}
                        style={S.btn('#dc2626', !fl.attendance_id)} title={!fl.attendance_id ? 'No linked attendance record' : ''}>
                        ❌ Mark Absent
                      </button>
                      <button onClick={() => { setResolvingId(null); setResolveNote('') }} style={S.btn('#64748b')}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setResolvingId(fl.id)} style={{ ...S.btnSm('#1e3a5f'), marginTop: 12 }}>🔍 Review & Resolve</button>
                )}
              </div>
            ))}
          </>
        )}

        {/* ══ SHIFT SETUP ══ */}
        {activeTab === 'shifts' && isAdmin && (
          <div style={{ maxWidth: 640 }}>
            {safeAllStaff.length === 0 && (
              <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#b45309', fontWeight: 600 }}>
                ⚠️ No staff loaded — pass the <code>allStaff</code> prop.
              </div>
            )}

            {/* ── Bulk Assign Shift — one shift definition, many staff at once ── */}
            <div style={{ ...S.card, marginBottom: 20, border: '1.5px solid #0ea5e9', background: '#f0f9ff' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0369a1', marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚡ Bulk Assign Shift
              </h2>
              <p style={{ fontSize: 12.5, color: '#0c4a6e', marginTop: -4, marginBottom: 16 }}>
                Set one shift and apply it to multiple staff in a single save — useful for initial setup when most staff share the same timing.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>Shift Label</label>
                  <input type="text" placeholder="e.g. Morning" value={bulkShiftForm.shift_label}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_label: e.target.value }))}
                    style={{ ...S.input, backgroundColor: 'white' }} />
                </div>
                <div>
                  <label style={S.label}>Grace Window (min)</label>
                  <input type="number" min="5" max="60" value={bulkShiftForm.check_in_window_min}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, check_in_window_min: e.target.value }))}
                    style={{ ...S.input, backgroundColor: 'white' }} />
                </div>
                <div>
                  <label style={S.label}>Shift Start</label>
                  <input type="time" value={bulkShiftForm.shift_start}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_start: e.target.value }))}
                    style={{ ...S.input, backgroundColor: 'white' }} />
                </div>
                <div>
                  <label style={S.label}>Shift End</label>
                  <input type="time" value={bulkShiftForm.shift_end}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_end: e.target.value }))}
                    style={{ ...S.input, backgroundColor: 'white' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={S.label}>Apply To ({bulkStaffIds.size} selected)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAllBulkStaff} style={{ ...S.btn('#0ea5e9'), padding: '4px 10px', fontSize: 12 }}>Select All</button>
                  <button onClick={clearAllBulkStaff} style={{ ...S.btn('#64748b'), padding: '4px 10px', fontSize: 12 }}>Clear</button>
                </div>
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto', background: 'white', border: '1px solid #bae6fd', borderRadius: 8, padding: 8, marginBottom: 14 }}>
                {safeAllStaff.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', padding: 8 }}>No staff to show.</div>}
                {safeAllStaff.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="checkbox" checked={bulkStaffIds.has(String(s.id))} onChange={() => toggleBulkStaff(s.id)} />
                    <span>{s.name} — <span style={{ color: '#64748b' }}>{s.designation}</span></span>
                  </label>
                ))}
              </div>

              <button onClick={saveBulkShift} disabled={savingBulkShift} style={S.btn('#0369a1', savingBulkShift)}>
                {savingBulkShift ? '⏳ Assigning…' : `💾 Assign Shift to ${bulkStaffIds.size || 0} Staff`}
              </button>
              <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 10, marginBottom: 0 }}>
                This adds a new shift for each selected staff member — it does not remove or edit shifts they already have. Use the single-staff editor below for edits or to remove a duplicate.
              </p>
            </div>

            <div style={S.card}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', marginTop: 0 }}>⏰ Shift Configuration</h2>
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>Select Staff Member</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                  <option value="">— Select Staff —</option>
                  {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                </select>
              </div>
              {selectedStaff && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {shiftForms.map((sf, i) => (
                      <div key={sf.id || i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px', gap: 10, alignItems: 'flex-end' }}>
                          <div>
                            <label style={S.label}>Label</label>
                            <input value={sf.shift_label} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, shift_label: e.target.value } : s))} placeholder="A/B/C" style={S.input} maxLength={3} />
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
                            <input type="number" min="5" max="60" value={sf.check_in_window_min || 10} onChange={e => setShiftForms(prev => prev.map((s, j) => j === i ? { ...s, check_in_window_min: e.target.value } : s))} style={S.input} />
                          </div>
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt12(sf.shift_start)} → {fmt12(sf.shift_end)} · window ±{sf.check_in_window_min || 10}m</span>
                          <button onClick={() => deleteShift(sf.id)} style={{ ...S.btnSm('#ef4444'), marginLeft: 'auto' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
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
          <div style={{ maxWidth: 520 }}>
            <div style={S.card}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', marginTop: 0 }}>🗺️ Campus Geofence</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                  <input type="number" step="0.0001" value={campusForm.lng} onChange={e => setCampusForm({ ...campusForm, lng: e.target.value })} placeholder="e.g. 94.019" style={S.input} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={S.label}>Allowed Radius (meters) — {campusForm.radius}m</label>
                  <input type="range" min="30" max="500" step="10" value={campusForm.radius} onChange={e => setCampusForm({ ...campusForm, radius: e.target.value })} style={{ width: '100%', marginBottom: 6 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>30m (strict)</span><span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 15 }}>{campusForm.radius}m</span><span>500m (lenient)</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, margin: '16px 0', fontSize: 12, color: '#166534' }}>
                💡 Tip: Use Google Maps to find your exact lat/lng. Right-click → "What's here?"
              </div>
              {campus && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#166534', fontWeight: 600 }}>
                  ✅ Active: {campus.name} · {campus.lat}, {campus.lng} · {campus.radius}m radius
                </div>
              )}
              <button onClick={saveCampus} disabled={savingCampus} style={{ ...S.btn('#1e3a5f', savingCampus), width: '100%', padding: 13 }}>
                {savingCampus ? '⏳ Saving...' : '💾 Save Campus Zone'}
              </button>
            </div>
          </div>
        )}

        {/* ══ MONTHLY REPORT ══ */}
        {activeTab === 'report' && isAdmin && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={S.label}>Month</label>
                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={S.label}>Staff</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                  <option value="">All Staff</option>
                  {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={fetchMonthLogs} style={S.btn('#1e3a5f')} disabled={loadingMonth}>{loadingMonth ? '⏳' : '🔄 Load'}</button>
              <button onClick={() => exportCSV(monthLogs, `report-${monthFilter}.csv`)} style={S.btn('#0ea5e9')} disabled={!monthLogs.length}>⬇ Export CSV</button>
            </div>

            {!selectedStaff && (() => {
              const staffMap = {}
              monthLogs.forEach(l => {
                const key = l.staff_profiles?.name || String(l.staff_id)
                if (!staffMap[key]) staffMap[key] = { name: key, designation: l.staff_profiles?.designation, total: 0, present: 0, late: 0, earlyOut: 0, absent: 0, flagged: 0, totalLateMin: 0, sessionLost: 0 }
                staffMap[key].total++
                if (l.status === 'Present')  staffMap[key].present++
                if (l.status === 'Late')     { staffMap[key].late++; staffMap[key].totalLateMin += l.late_minutes || 0 }
                if (l.status === 'EarlyOut') staffMap[key].earlyOut++
                if (l.status === 'Absent')   staffMap[key].absent++
                if (l.status === 'Flagged')  staffMap[key].flagged++
                if (l.session_dead)          staffMap[key].sessionLost++
              })
              const rows = Object.values(staffMap)
              return rows.length > 0 ? (
  <>
    <AttendanceChart rows={rows} monthFilter={monthFilter} />
    <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 16px', fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #f1f5f9' }}>Staff Summary — {monthFilter}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr>{['Staff','Total','Present','Late','Late Min','Early Out','Absent','Flagged','Rate'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map(r => {
                          const rate = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
                          return (
                            <tr key={r.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={td}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{r.designation}</div></td>
                              <td style={td}>{r.total}</td>
                              <td style={{ ...td, color: '#16a34a', fontWeight: 700 }}>{r.present}</td>
                              <td style={{ ...td, color: '#b45309', fontWeight: 700 }}>{r.late}</td>
                              <td style={{ ...td, color: r.totalLateMin > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>{r.totalLateMin > 0 ? `${r.totalLateMin}m` : '—'}</td>
                              <td style={{ ...td, color: '#dc2626', fontWeight: 700 }}>{r.earlyOut}</td>
                              <td style={{ ...td, color: '#dc2626', fontWeight: 700 }}>{r.absent}</td>
                              <td style={{ ...td, color: '#be185d', fontWeight: 700 }}>{r.flagged}</td>
                              <td style={td}><span style={{ fontWeight: 800, color: rate >= 90 ? '#16a34a' : rate >= 70 ? '#b45309' : '#dc2626' }}>{rate}%</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
          </>
        ) : null
        })()}

            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{['Date','Staff','Shift','Check-In','Check-Out','Late','Distance','Status','Fraud'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {loadingMonth
                      ? [1,2,3].map(i => <tr key={i}><td colSpan="9" style={{ padding: 16 }}><Skeleton /></td></tr>)
                      : monthLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: log.session_dead ? '#fdf4ff' : log.is_fraud_suspected ? '#fff7f7' : 'white' }}>
                          <td style={td}>{fmtDate(log.date)}</td>
                          <td style={td}><div style={{ fontWeight: 600 }}>{log.staff_profiles?.name || '—'}</div></td>
                          <td style={td}><span style={{ fontWeight: 700, color: '#1e3a5f' }}>Shift {log.shift_label}</span></td>
                          <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                          <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                          <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                          <td style={{ ...td, color: log.is_within_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                          <td style={td}><StatusBadge status={log.status} /></td>
                          <td style={td}>{(log.fraud_flags || []).length > 0 ? (log.fraud_flags || []).map((f, i) => <FraudBadge key={i} type={f.type} />) : <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}</td>
                        </tr>
                      ))
                    }
                    {!loadingMonth && monthLogs.length === 0 && <tr><td colSpan="9" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No records — click Load</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {faceCaptureShift && (
        <FaceCapture
          staffId={currentStaff?.id}
          onVerified={(faceResult) => performCheckIn(faceCaptureShift, faceResult)}
          onCancel={() => setFaceCaptureShift(null)}
        />
      )}
    </ErrorBoundary>
  )
}
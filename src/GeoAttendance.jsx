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
import { COLOR, FONT, RADIUS, SHADOW, ledger, Seal, injectLedgerGlobalStyles } from './ledgerTheme.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CAMPUS    = { lat: 24.62181, lng: 94.0193087, radius: 50, name: 'Main Campus' }
const TRACK_INTERVAL_MS = 2 * 60 * 1000
const DEAD_SESSION_MS   = 5 * 60 * 1000

const AUTO_CHECKOUT_THRESHOLD = 10
const RAILWAY_URL = ''

const FRAUD_TYPES = {
  outside_campus: { label: 'Outside Campus',     color: COLOR.danger, icon: '📍' },
  fake_gps:       { label: 'Fake GPS Suspected',  color: COLOR.warn, icon: '🛰️' },
  wrong_time:     { label: 'Outside Time Window', color: COLOR.warn, icon: '⏰' },
  duplicate:      { label: 'Duplicate Attempt',   color: '#8b5cf6', icon: '🔁' },
  device_clash:   { label: 'Shared Device',       color: '#ec4899', icon: '📱' },
  velocity:       { label: 'Velocity Anomaly',    color: '#06b6d4', icon: '⚡' },
  early_out:      { label: 'Early Departure',     color: COLOR.danger, icon: '🏃' },
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
        <div style={{ fontWeight: 700, color: COLOR.danger, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: COLOR.slate, marginBottom: 16 }}>{this.state.error.message}</div>
        <button onClick={() => this.setState({ error: null })}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: COLOR.ink, color: COLOR.parchmentRaised, cursor: 'pointer', fontWeight: 600 }}>
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
    cx.fillStyle = COLOR.ink; cx.fillText('GNSI-FP-2026', 2, 2)
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

// Spoken confirmation/reminder using the browser's built-in Web Speech
// API — no new dependency, works offline once the voice list is loaded.
// Fails silently (voice is a nice-to-have on top of the toast/overlay
// that already show the same information) if the browser/webview doesn't
// support speechSynthesis at all, so this never blocks or breaks the
// actual check-in/check-out flow.
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel() // don't stack overlapping announcements
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch (e) {
    console.warn('Speech announcement failed:', e.message)
  }
}

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
  page:  { ...ledger.page, padding: 20 },
  card:  ledger.card,
  btn:   (c = COLOR.ink, dis = false) => ({
    backgroundColor: dis ? '#B8AF9A' : c, color: c === COLOR.brass ? COLOR.ink : COLOR.parchmentRaised, border: 'none',
    borderRadius: RADIUS.md, padding: '11px 20px', fontWeight: 700, fontFamily: FONT.body,
    cursor: dis ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: dis ? 0.75 : 1,
    transition: 'opacity 0.15s, transform 0.1s',
  }),
  btnSm: (c = COLOR.ink) => ({
    backgroundColor: c, color: c === COLOR.brass ? COLOR.ink : COLOR.parchmentRaised, border: 'none', borderRadius: RADIUS.sm,
    padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '12px', fontFamily: FONT.body,
  }),
  input: {
    width: '100%', padding: '10px 14px', borderRadius: RADIUS.md,
    border: `1px solid ${COLOR.rule}`, fontSize: '14px', boxSizing: 'border-box',
    fontFamily: FONT.body, background: COLOR.parchmentRaised, color: COLOR.ink2,
  },
  label: { display: 'block', fontSize: '11.5px', fontWeight: 700, color: COLOR.slate, marginBottom: '6px', letterSpacing: '0.02em' },
  tab:   (a) => ({
    padding: '10px 18px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
    background: 'none', border: 'none', fontFamily: FONT.body,
    borderBottom: `3px solid ${a ? COLOR.brass : 'transparent'}`,
    color: a ? COLOR.ink : COLOR.slate,
    transition: 'color 0.15s, border-color 0.15s',
  }),
}
const th = ledger.th
const td = ledger.td

// ─── "Vault" theme — deep navy + brushed gold ──────────────────────────────
// Used for the staff-facing Check-in screen only (activeTab === 'checkin'
// and its supporting components: GPSRing, SmartPunchButton, ShiftTimeline,
// OfflineBanner, StatusBadge, CheckInFailureExplainer). Admin/monitor tabs
// keep the existing parchment Ledger & Crest look untouched for now.
// ─── Google Pay theme — white surfaces, single blue accent, pill buttons ──
// Same token shape/keys as before so every consumer using `dark` /
// GPAY.* / gpayPress / gpayBtnStyle keeps working unchanged — only the
// actual colors and button geometry changed.
const GPAY = {
  bg:        '#F6F6F6',
  bgRaised:  '#ffffff',
  panel:     '#ffffff',
  panelHover:'#F1F3F4',
  panelBorder: '#E8EAED',
  goldBorder:  '#E8EAED',
  gold:      '#1A73E8',
  goldDeep:  '#1558B0',
  textPrimary: '#202124',
  textMuted:   '#5f6368',
  textFaint:   '#80868b',
  ok:        '#1E8E3E',
  warn:      '#EA8600',
  danger:    '#D93025',
}

// Shared press animation for every button on the check-in screen. GPay's
// signature interaction is a tap ripple rather than a scale — this fires
// an expanding, fading circle from the actual tap/click point, then a
// gentle scale-back so the button still feels responsive on hold.
function spawnRipple(e) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const isLight = getComputedStyle(btn).backgroundColor === 'rgba(0, 0, 0, 0)' || btn.dataset.rippleDark === 'true'
  const x = (e.clientX ?? (e.touches?.[0]?.clientX) ?? rect.left + rect.width / 2) - rect.left - size / 2
  const y = (e.clientY ?? (e.touches?.[0]?.clientY) ?? rect.top + rect.height / 2) - rect.top - size / 2
  const span = document.createElement('span')
  span.style.position = 'absolute'
  span.style.left = x + 'px'
  span.style.top = y + 'px'
  span.style.width = span.style.height = size + 'px'
  span.style.borderRadius = '50%'
  span.style.background = isLight ? 'rgba(60,64,67,0.15)' : 'rgba(255,255,255,0.45)'
  span.style.transform = 'scale(0)'
  span.style.pointerEvents = 'none'
  span.style.animation = 'gpay-ripple 0.55s ease-out'
  if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
  btn.style.overflow = 'hidden'
  btn.appendChild(span)
  setTimeout(() => span.remove(), 600)
}
// NOTE: gpayPress no longer defines onClick directly. When spread onto a
// <button onClick={handler} {...gpayPress}>, JSX prop order means whichever
// onClick appears LAST wins — so gpayPress used to silently swallow every
// real click handler it was combined with (ripple fired, handler never
// ran, which is why "Detect My Location" looked responsive but did nothing).
// gpayRipple() wraps your own handler instead of replacing it.
function gpayRipple(handler) {
  return (e) => { spawnRipple(e); if (handler) handler(e) }
}
const gpayPress = {
  onMouseDown: e => { e.currentTarget.style.transform = 'scale(0.98)' },
  onMouseUp:   e => { e.currentTarget.style.transform = 'scale(1)' },
  onMouseLeave:e => { e.currentTarget.style.transform = 'scale(1)' },
  onTouchStart:e => { e.currentTarget.style.transform = 'scale(0.98)' },
  onTouchEnd:  e => { e.currentTarget.style.transform = 'scale(1)' },
}
function gpayBtnStyle({ bg, color = '#ffffff', disabled = false, size = 'md', variant = 'primary' }) {
  const pad = size === 'lg' ? '16px 20px' : size === 'sm' ? '9px 16px' : '12px 20px'
  if (variant === 'secondary') {
    return {
      background: disabled ? '#F1F3F4' : '#ffffff',
      color: disabled ? '#9aa0a6' : (color === '#ffffff' ? GPAY.textPrimary : color),
      border: `1.5px solid ${disabled ? '#F1F3F4' : '#DADCE0'}`, borderRadius: 28, padding: pad,
      fontWeight: 600, fontFamily: FONT.body, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 0.12s ease, border-color 0.15s', position: 'relative', overflow: 'hidden',
    }
  }
  return {
    background: disabled ? '#F1F3F4' : bg,
    color: disabled ? '#9aa0a6' : color,
    border: 'none', borderRadius: 28, padding: pad,
    fontWeight: 600, fontFamily: FONT.body, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform 0.12s ease, box-shadow 0.15s, background 0.15s', position: 'relative', overflow: 'hidden',
    boxShadow: disabled ? 'none' : '0 1px 3px rgba(0,0,0,0.15), 0 2px 6px -2px rgba(26,115,232,0.35)',
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 18, radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: `linear-gradient(90deg, ${COLOR.rule} 25%, #f4f0e4 50%, ${COLOR.rule} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'ledger-shimmer 1.4s infinite',
    }} />
  )
}

// ─── Toast Queue ─────────────────────────────────────────────────────────────

function ToastQueue({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => {
        const tone = t.type === 'err' ? { bg: COLOR.danger } : t.type === 'warn' ? { bg: COLOR.warn } : { bg: COLOR.sageDeep }
        return (
          <div key={t.id} style={{
            padding: '12px 18px', borderRadius: RADIUS.md, fontSize: 14, fontWeight: 600, fontFamily: FONT.body,
            color: COLOR.cream, maxWidth: 380, background: tone.bg,
            boxShadow: SHADOW.onInk, animation: 'ledger-slide-in 0.22s ease',
          }} role="alert">
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status, dark = false }) {
  const map = {
    Present:  { bg: COLOR.okBg, color: COLOR.sageDeep, icon: '✅' },
    Late:     { bg: COLOR.warnBg, color: COLOR.warn, icon: '🕐' },
    Outside:  { bg: COLOR.dangerBg, color: COLOR.danger, icon: '📍' },
    Flagged:  { bg: COLOR.dangerBg, color: COLOR.danger, icon: '🚨' },
    Absent:   { bg: '#EEEAE0', color: COLOR.slate, icon: '⭕' },
    Pending:  { bg: '#E8ECF2', color: '#3D5A82', icon: '⏳' },
    EarlyOut: { bg: COLOR.dangerBg, color: COLOR.danger, icon: '🏃' },
  }
  const darkMap = {
    Present:  { bg: '#E6F4EA', color: '#1E8E3E', icon: '✅' },
    Late:     { bg: '#FEF7E0', color: '#EA8600', icon: '🕐' },
    Outside:  { bg: '#FCE8E6', color: '#D93025', icon: '📍' },
    Flagged:  { bg: '#FCE8E6', color: '#D93025', icon: '🚨' },
    Absent:   { bg: '#F1F3F4', color: '#5f6368', icon: '⭕' },
    Pending:  { bg: '#F1F3F4', color: '#5f6368', icon: '⏳' },
    EarlyOut: { bg: '#FCE8E6', color: '#D93025', icon: '🏃' },
  }
  const m = (dark ? darkMap : map)[status] || (dark ? darkMap.Pending : map.Pending)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: RADIUS.pill, fontSize: 11.5, fontWeight: 700, background: m.bg, color: m.color, fontFamily: FONT.body }}>
      {m.icon} {status}
    </span>
  )
}

function FraudBadge({ type }) {
  const m = FRAUD_TYPES[type] || { label: type, color: COLOR.slate, icon: '⚠️' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: m.color + '18', color: m.color, border: `1px solid ${m.color}44` }}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── Check-in failure explainer ─────────────────────────────────────────────
// Advanced feature: decodes the last failed check-in attempt's raw error
// code/signals into plain language for the staff member, instead of them
// having to interpret a toast and guess what to fix. Purely explanatory —
// reads state already on screen (gpsDistance, campus radius, last error),
// makes no new requests.

const FAILURE_EXPLAINERS = {
  face_mismatch: (f) => ({
    title: "Face didn't match",
    body: f.matchScore != null
      ? `Your live scan differed from your enrolled face by ${f.matchScore} (server threshold is 0.5 — lower is better). Try again in good, even light with your face centered.`
      : `Your live scan didn't match your enrolled face closely enough. Try again in good, even light with your face centered.`,
    tip: 'If this fails repeatedly even in good light, ask an admin to re-enroll your face — appearance can drift over time (haircut, glasses, lighting habits).',
  }),
  liveness_failed: () => ({
    title: 'Liveness check expired or invalid',
    body: 'The blink/turn challenge either timed out or was not completed on the device that started it.',
    tip: 'Keep the app open and your face in frame for the whole scan — don\'t switch apps mid-scan.',
  }),
  liveness_missing: () => ({
    title: 'Liveness check missing',
    body: 'The check-in request reached the server without a liveness challenge attached.',
    tip: 'This is usually a connection hiccup — try the scan again.',
  }),
  face_not_enrolled: () => ({
    title: 'Face not enrolled',
    body: 'There is no approved face enrollment on file for your account.',
    tip: 'Ask an admin to enroll your face, or self-enroll and wait for admin approval.',
  }),
  weak_gps: (f, gpsDistance, campusRadius) => ({
    title: 'GPS signal too weak',
    body: f.message || 'Your device\'s location accuracy was too low to confirm you\'re on campus.',
    tip: 'Step outside or near a window and tap Detect Location again before retrying.',
  }),
  wrong_time: (f) => ({
    title: 'Outside the check-in window',
    body: f.serverTime ? `The server clock reads ${fmtTime(f.serverTime)}, which is outside this shift's allowed window.` : 'The current time is outside this shift\'s allowed check-in window.',
    tip: 'Check-in windows are fixed by admin per shift — contact them if this looks wrong.',
  }),
  duplicate: () => ({
    title: 'Already checked in',
    body: 'A check-in for this shift already exists today.',
    tip: 'If you believe this is wrong, use Regularization to request a correction.',
  }),
  rate_limited: () => ({
    title: 'Too many attempts',
    body: 'Repeated check-in attempts in a short window triggered a cool-down.',
    tip: 'Wait about an hour before trying again.',
  }),
}

function CheckInFailureExplainer({ failure, gpsDistance, campusRadius, onDismiss, dark = false }) {
  const build = FAILURE_EXPLAINERS[failure.error]
  const content = build ? build(failure, gpsDistance, campusRadius) : {
    title: 'Check-in failed',
    body: failure.message || 'An unexpected error stopped check-in.',
    tip: 'Try again — if it keeps happening, contact admin.',
  }
  if (dark) {
    return (
      <div style={{ marginTop: 14, padding: 16, background: 'rgba(240,180,41,0.08)', border: `1px solid ${GPAY.warn}44`, borderRadius: 14, animation: 'vault-fade-in 0.25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: GPAY.warn, fontFamily: FONT.display }}>Why did check-in fail? — {content.title}</div>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: GPAY.warn, cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1, transition: 'transform 0.12s' }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >✕</button>
        </div>
        <div style={{ fontSize: 12, color: GPAY.textPrimary, marginTop: 7, lineHeight: 1.5, opacity: 0.9 }}>{content.body}</div>
        <div style={{ fontSize: 11.5, color: GPAY.warn, marginTop: 7, fontStyle: 'italic' }}>💡 {content.tip}</div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 14, padding: 16, background: COLOR.warnBg, border: `1px solid ${COLOR.warn}44`, borderRadius: RADIUS.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.warn, fontFamily: FONT.display }}>Why did check-in fail? — {content.title}</div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: COLOR.warn, cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 7, lineHeight: 1.5 }}>{content.body}</div>
      <div style={{ fontSize: 11.5, color: COLOR.warn, marginTop: 7, fontStyle: 'italic' }}>💡 {content.tip}</div>
    </div>
  )
}

// ─── Fraud scatter widget (advanced) ────────────────────────────────────────
// One-glance outlier view: plots today's check-ins by GPS distance from
// campus (x) vs face-match score (y, lower = better/tighter match). A
// cluster in the bottom-left is a normal day; anything drifting right
// (far from campus) or high (weak face match) is worth an admin's eye
// without paging through the row table. Reads face_match_score off
// staff_geo_attendance (added by migration_face_server_trust.sql) — falls
// back to a "no face-match data yet" note on rows from before the migration.
function FraudScatterWidget({ logs }) {
  const points = (logs || []).filter(l => l.face_match_score != null)
  if (points.length === 0) {
    return (
      <div style={{ ...S.card, marginBottom: 16, fontSize: 12, color: COLOR.slate, textAlign: 'center', padding: 20 }}>
        No face-match data yet for today's check-ins.
      </div>
    )
  }

  const W = 640, H = 220, PAD = 36
  const maxDist  = Math.max(50, ...points.map(p => p.distance_from_campus || 0))
  const maxScore = Math.max(0.6, ...points.map(p => p.face_match_score))
  const x = (d) => PAD + (d / maxDist) * (W - PAD * 2)
  const y = (s) => H - PAD - (s / maxScore) * (H - PAD * 2)

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: COLOR.ink2, fontSize: 14, marginBottom: 4 }}>Check-in outliers — distance vs face-match</div>
      <div style={{ fontSize: 11, color: COLOR.slate, marginBottom: 10 }}>Bottom-left cluster = normal. Points drifting right or high are worth a look.</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={COLOR.rule} strokeWidth="1" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={COLOR.rule} strokeWidth="1" />
        <text x={W - PAD} y={H - PAD + 16} fontSize="10" fill={COLOR.slate} textAnchor="end">distance from campus (m) →</text>
        <text x={PAD - 6} y={PAD - 8} fontSize="10" fill={COLOR.slate} textAnchor="start">↑ weaker match</text>
        {/* pass-threshold reference line at 0.5 */}
        <line x1={PAD} y1={y(0.5)} x2={W - PAD} y2={y(0.5)} stroke={COLOR.brass} strokeDasharray="4 4" strokeWidth="1" />
        <text x={W - PAD} y={y(0.5) - 4} fontSize="9" fill={COLOR.warn} textAnchor="end">match threshold</text>
        {points.map((p, i) => {
          const suspicious = p.is_fraud_suspected || p.weak_face_match
          return (
            <g key={p.id || i}>
              <circle cx={x(p.distance_from_campus || 0)} cy={y(p.face_match_score)} r={5}
                fill={suspicious ? COLOR.danger : COLOR.sageDeep} fillOpacity={0.8} stroke={COLOR.parchmentRaised} strokeWidth="1.5" />
              <title>{`${p.staff_profiles?.name || 'Staff'} — ${Math.round(p.distance_from_campus || 0)}m, match ${p.face_match_score}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Drift-flagged staff panel (advanced) ──────────────────────────────────
// Calls staff_with_drifting_face_match (migration_face_server_trust.sql):
// staff whose recent face-match scores are trending worse than their own
// baseline, while still passing — a proactive nudge to re-enroll before it
// turns into an outright failure day-of. Lazily fetched only when the
// Coverage/monitor context actually renders it, not on every poll.
export function DriftFlaggedStaffPanel({ showToast }) {
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.rpc('staff_with_drifting_face_match')
      if (cancelled) return
      if (error) {
        showToast?.('Could not load face-match drift data: ' + error.message, 'err')
        setRows([]); setLoading(false); return
      }
      const list = data || []
      setRows(list)
      if (list.length) {
        const { data: staffRows } = await supabase
          .from('staff_profiles')
          .select('id, name')
          .in('id', list.map(r => r.staff_id))
        const map = {}
        for (const s of staffRows || []) map[s.id] = s.name
        if (!cancelled) setNames(map)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [showToast])

  if (loading) return <p style={{ color: COLOR.slate, fontSize: 12, padding: 12 }}>Checking face-match trends…</p>
  if (!rows.length) return <p style={{ color: COLOR.slate, fontSize: 12, padding: 12 }}>No drifting face-match trends detected.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.staff_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${COLOR.warn}33`, background: COLOR.warnBg, borderRadius: RADIUS.md, padding: '10px 14px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.warn, fontFamily: FONT.body }}>{names[r.staff_id] || `Staff #${r.staff_id}`}</div>
            <div style={{ fontSize: 11, color: COLOR.warn, opacity: 0.85 }}>Recent avg match {Number(r.recent_avg).toFixed(3)} vs baseline {Number(r.baseline_avg).toFixed(3)} ({r.sample_count} samples)</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: COLOR.warn }}>Re-enroll suggested</span>
        </div>
      ))}
    </div>
  )
}

// ─── Smart Punch button ──────────────────────────────────────────────────
// A single primary action that decides FOR the person which action is
// currently valid — punch in or punch out — instead of making them scan a
// list of shift rows to find the right button. Modeled visually on the
// premium toggle switch (a sliding pill), but scaled into a big tappable
// punch control since this is the action a staff member does most often
// in the whole app.
//
// Detection logic, in priority order:
//   1. If exactly one shift is currently being tracked (checked in, not
//      out) -> the obvious action is PUNCH OUT for that shift.
//   2. Else if exactly one shift is inside its check-in window and not
//      yet done today -> the obvious action is PUNCH IN for that shift.
//   3. Else if more than one shift qualifies for either action -> show a
//      neutral "choose a shift below" state rather than guessing wrong.
//   4. Else -> nothing is actionable right now; show why (window not
//      open yet, already completed, no shifts assigned).
// Matches a shift row against today's attendance logs by shift_id first —
// the actual foreign key — falling back to shift_label only for older log
// rows that predate shift_id being recorded. Matching by label alone (the
// previous behavior throughout this file) silently conflates two different
// shifts that happen to share the same label, which double-shift staff can
// easily hit if an admin names two time blocks the same thing.
function isShiftLoggedToday(shift, logs) {
  return logs.some(l => (l.shift_id != null ? l.shift_id === shift.id : l.shift_label === shift.shift_label))
}

function detectPunchAction({ myShifts, todayMyLogs, activeTracking, gpsStatus }) {
  const openForCheckout = activeTracking // already being tracked
  if (openForCheckout.length === 1) {
    const t = openForCheckout[0]
    return { kind: 'out', shift: t.shift, logId: t.logId, shiftLabel: t.shiftLabel }
  }
  if (openForCheckout.length > 1) {
    return { kind: 'ambiguous-out' }
  }

  const eligibleForCheckin = (myShifts || []).filter(shift => {
    const alreadyDone = isShiftLoggedToday(shift, todayMyLogs)
    const inWindow = isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)
    return !alreadyDone && inWindow
  })
  if (eligibleForCheckin.length === 1) {
    return { kind: 'in', shift: eligibleForCheckin[0] }
  }
  if (eligibleForCheckin.length > 1) {
    return { kind: 'ambiguous-in' }
  }

  // Nothing actionable — figure out the most useful reason why, so the
  // button can explain itself instead of just going grey.
  if (!myShifts || myShifts.length === 0) return { kind: 'none', reason: 'no_shifts' }
  const allDoneToday = myShifts.every(s => isShiftLoggedToday(s, todayMyLogs))
  if (allDoneToday) return { kind: 'none', reason: 'all_done' }

  // Otherwise: something is assigned but its window isn't open. Surface
  // the soonest upcoming one.
  const upcoming = myShifts
    .filter(s => !isShiftLoggedToday(s, todayMyLogs))
    .map(s => ({ s, mins: minutesUntilWindow(s.shift_start, s.check_in_window_min || 10) }))
    .filter(x => x.mins > 0)
    .sort((a, b) => a.mins - b.mins)[0]
  if (upcoming) return { kind: 'none', reason: 'window_not_open', shift: upcoming.s, minsUntil: upcoming.mins }

  return { kind: 'none', reason: 'window_closed' }
}

// Two always-visible buttons (Punch In / Punch Out), each enabled only
// when its action is actually valid right now — replaces the old single
// auto-switching button. Ambiguous-shift and "nothing to do" states are
// shown as a helper line below the buttons rather than swallowing them,
// since there's no longer one slot to repurpose for that messaging.
function SmartPunchButton({ myShifts, todayMyLogs, activeTracking, gpsStatus, checkingIn, onPunchIn, onPunchOut, onChooseBelow, dark = false }) {
  const action = detectPunchAction({ myShifts, todayMyLogs, activeTracking, gpsStatus })
  const offCampus = gpsStatus === 'outside'

  const NONE_COPY = {
    no_shifts:       'No shifts assigned',
    all_done:        'All shifts complete for today',
    window_closed:   'No check-in window open right now',
    window_not_open: (a) => `Opens in ${a.minsUntil}m — Shift ${a.shift.shift_label}`,
  }

  const canPunchIn  = action.kind === 'in'
  const canPunchOut = action.kind === 'out'
  const isAmbiguous = action.kind === 'ambiguous-in' || action.kind === 'ambiguous-out'

  const inDisabled  = !canPunchIn || checkingIn
  const outDisabled = !canPunchOut || checkingIn

  const inSub = canPunchIn
    ? `Shift ${action.shift.shift_label} · ${fmt12(action.shift.shift_start)} – ${fmt12(action.shift.shift_end)}`
    : null
  const outSub = canPunchOut
    ? `Shift ${action.shiftLabel} · tap to end tracking`
    : null

  let helperText = null
  if (isAmbiguous) {
    helperText = action.kind === 'ambiguous-out' ? 'Multiple shifts active — choose which shift below' : 'Multiple shifts open — choose which shift below'
  } else if (action.kind === 'none') {
    helperText = typeof NONE_COPY[action.reason] === 'function' ? NONE_COPY[action.reason](action) : NONE_COPY[action.reason]
  }

  // Which side is the "live" action right now — that one gets the solid
  // blue/green filled pill (GPay's primary button); the other renders as
  // a white, grey-bordered pill (GPay's secondary/disabled button) rather
  // than a dimmed gradient of the same shape.
  const inIsPrimary  = canPunchIn && !checkingIn
  const outIsPrimary = canPunchOut && !checkingIn

  const pillBase = (isPrimary, disabled, accentColor) => dark ? {
    flex: 1, minWidth: 0, borderRadius: 28, padding: '16px 10px',
    border: isPrimary ? 'none' : '1.5px solid #E8EAED',
    background: isPrimary ? accentColor : (disabled ? '#F1F3F4' : '#ffffff'),
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center',
    minHeight: 90, boxSizing: 'border-box',
    boxShadow: isPrimary ? `0 1px 3px rgba(0,0,0,0.15), 0 3px 8px -2px ${accentColor}55` : 'none',
    fontFamily: FONT.body, transition: 'transform 0.12s ease, box-shadow 0.15s, border-color 0.15s',
    position: 'relative', overflow: 'hidden',
  } : {
    flex: 1, minWidth: 0, border: 'none', borderRadius: RADIUS.lg, padding: '16px 10px',
    background: disabled ? COLOR.rule : accentColor,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center',
    minHeight: 92,
    boxShadow: disabled ? 'none' : SHADOW.seal, fontFamily: FONT.body,
    transition: 'transform 0.12s ease',
    boxSizing: 'border-box',
  }

  const press = (disabled) => disabled ? {} : (dark ? { ...gpayPress } : {
    onMouseDown: e => { e.currentTarget.style.transform = 'scale(0.96)' },
    onMouseUp:   e => { e.currentTarget.style.transform = 'scale(1)' },
    onMouseLeave:e => { e.currentTarget.style.transform = 'scale(1)' },
    onTouchStart:e => { e.currentTarget.style.transform = 'scale(0.96)' },
    onTouchEnd:  e => { e.currentTarget.style.transform = 'scale(1)' },
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: helperText ? 8 : 16 }}>
        <button
          onClick={inDisabled ? undefined : () => onPunchIn(action.shift)}
          disabled={inDisabled}
          style={pillBase(
            dark ? inIsPrimary : true,
            inDisabled,
            dark
              ? (offCampus && canPunchIn ? GPAY.warn : GPAY.ok)
              : (offCampus && canPunchIn ? `linear-gradient(155deg, ${COLOR.warn}, #6b5117)` : `linear-gradient(155deg, ${COLOR.sage}, ${COLOR.sageDeep})`)
          )}
          {...press(inDisabled)}
        >
          <span style={{ fontSize: 18 }}>{checkingIn && canPunchIn ? '⋯' : '→'}</span>
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: dark ? FONT.body : FONT.display, color: dark ? (inIsPrimary ? '#ffffff' : (inDisabled ? '#9aa0a6' : GPAY.textPrimary)) : (inDisabled ? COLOR.ink2 : 'white'), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {checkingIn && canPunchIn ? 'Verifying…' : (offCampus && canPunchIn ? 'Punch in (off campus)' : 'Punch in')}
          </span>
          {inSub && (
            <span style={{ fontSize: 10, color: dark ? (inIsPrimary ? 'rgba(255,255,255,0.85)' : GPAY.textFaint) : (inDisabled ? COLOR.slate : 'rgba(255,255,255,0.82)'), maxWidth: '100%', overflowWrap: 'break-word', lineHeight: 1.3 }}>
              {inSub}
            </span>
          )}
        </button>

        <button
          onClick={outDisabled ? undefined : () => onPunchOut(action.logId, action.shiftLabel)}
          disabled={outDisabled}
          style={pillBase(
            dark ? outIsPrimary : true,
            outDisabled,
            dark ? GPAY.gold : `linear-gradient(155deg, ${COLOR.brass}, ${COLOR.brassDeep})`
          )}
          {...press(outDisabled)}
        >
          <span style={{ fontSize: 18 }}>{checkingIn && canPunchOut ? '⋯' : '■'}</span>
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: dark ? FONT.body : FONT.display, color: dark ? (outIsPrimary ? '#ffffff' : (outDisabled ? '#9aa0a6' : GPAY.textPrimary)) : (outDisabled ? COLOR.ink2 : 'white'), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Punch out

          </span>
          {outSub && (
            <span style={{ fontSize: 10, color: dark ? (outIsPrimary ? 'rgba(255,255,255,0.85)' : GPAY.textFaint) : (outDisabled ? COLOR.slate : 'rgba(255,255,255,0.82)'), maxWidth: '100%', overflowWrap: 'break-word', lineHeight: 1.3 }}>
              {outSub}
            </span>
          )}
        </button>
      </div>

      {helperText && (
        <button
          onClick={isAmbiguous ? onChooseBelow : undefined}
          disabled={!isAmbiguous}
          style={{
            width: '100%', border: 'none', background: 'none', padding: '0 0 16px',
            cursor: isAmbiguous ? 'pointer' : 'default', textAlign: 'center',
            fontSize: 12, color: dark ? GPAY.textMuted : COLOR.slate, fontFamily: FONT.body,
          }}
        >
          {helperText}
        </button>
      )}
    </div>
  )
}

// ─── GPS Ring ─────────────────────────────────────────────────────────────────

function GPSRing({ status, distance, accuracy, campus, tracking, minsLeft, dark = false }) {
  const colorsLight = { idle: COLOR.slate, locating: COLOR.warn, oncampus: COLOR.sageDeep, outside: COLOR.danger, error: COLOR.danger, weak: COLOR.warn, tracking: COLOR.sageDeep }
  const colorsDark  = { idle: GPAY.textMuted, locating: GPAY.warn, oncampus: GPAY.gold, outside: GPAY.danger, error: GPAY.danger, weak: GPAY.warn, tracking: GPAY.gold }
  const colors = dark ? colorsDark : colorsLight
  const color    = colors[status] || colors.idle
  const isActive = status === 'oncampus' || status === 'tracking'
  const isVerified = status === 'oncampus' || status === 'tracking'
  const pct      = campus ? Math.max(0, Math.min(100, (1 - (distance || 0) / campus.radius) * 100)) : 0
  const icon     = { idle: '📍', locating: '📡', outside: '❌', weak: '⚠️', error: '❌' }[status]
  const trackColor = dark ? '#E8EAED' : COLOR.rule
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: dark ? '8px 4px 4px' : '26px 16px' }} aria-label={`GPS status: ${status}`}>
      <div style={{ position: 'relative', width: 148, height: 148 }}>
        {isActive && <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `1.5px solid ${color}44`, animation: 'pulse 2.4s infinite' }} />}
        {tracking  && <div style={{ position: 'absolute', inset: -17, borderRadius: '50%', border: `1.5px solid ${dark ? GPAY.gold : COLOR.brass}55`, animation: 'pulse 1.6s infinite' }} />}
        <svg width="148" height="148" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }} aria-hidden="true">
          <circle cx="74" cy="74" r="61" fill="none" stroke={trackColor} strokeWidth="9" />
          <circle cx="74" cy="74" r="61" fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${2 * Math.PI * 61}`}
            strokeDashoffset={`${2 * Math.PI * 61 * (1 - (status === 'locating' ? 0.7 : isActive ? pct / 100 : 0.2))}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {isVerified ? (
            dark ? (
              <div style={{
                width: 46, height: 46, borderRadius: '50%', background: GPAY.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 22, fontWeight: 700,
                boxShadow: `0 2px 8px ${GPAY.gold}55`, animation: 'gpay-pop 0.35s ease',
              }}>✓</div>
            ) : (
              <div style={{ animation: 'ledger-seal-pop 0.4s ease' }}>
                <Seal size={44} tone={tracking ? 'brass' : 'sage'} />
              </div>
            )
          ) : (
            <div style={{ fontSize: 30, lineHeight: 1 }}>{icon}</div>
          )}
          {distance !== null && distance !== undefined && !['locating','idle'].includes(status) && (
            <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 6, fontFamily: dark ? FONT.body : FONT.display, fontVariantNumeric: 'tabular-nums' }}>{Math.round(distance)}m</div>
          )}
          {tracking && minsLeft !== null && (
            <div style={{ fontSize: 10, color: dark ? GPAY.gold : COLOR.brassDeep, marginTop: 2, fontWeight: 700 }}>{Math.max(0, Math.round(minsLeft))}m left</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15.5, fontWeight: dark ? 500 : 600, color: status === 'idle' ? (dark ? GPAY.textPrimary : COLOR.ink2) : color, fontFamily: dark ? FONT.body : FONT.display }}>
          {status === 'idle'      ? 'Ready to check in'
          : status === 'locating' ? 'Detecting location…'
          : status === 'oncampus' ? 'Verified — on campus'
          : status === 'tracking' ? 'Shift tracking active'
          : status === 'outside'  ? `Outside campus — ${Math.round(distance || 0)}m away`
          : status === 'weak'     ? 'GPS signal weak'
          : 'Location error'}
        </div>
        {tracking && <div style={{ fontSize: 12, color: dark ? GPAY.gold : COLOR.brassDeep, marginTop: 5, fontWeight: 600 }}>Location verified every 2 minutes</div>}
        {accuracy && !['idle','error'].includes(status) && (
          <div style={{ fontSize: 12, color: accuracy > 50 ? (dark ? GPAY.warn : COLOR.warn) : (dark ? GPAY.textMuted : COLOR.slate), marginTop: 5 }}>
            GPS accuracy ±{Math.round(accuracy)}m{accuracy > 50 ? ' — weak signal' : ''}
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.08);opacity:0.3}}
        @keyframes gpay-pop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
      `}</style>
    </div>
  )
}

// ─── Shift Timeline ───────────────────────────────────────────────────────────

function ShiftTimeline({ trail, shift }) {
  if (!trail.length || !shift) return (
    <div style={{ padding: 12, color: COLOR.slate, fontSize: 13 }}>No location trail recorded yet</div>
  )
  const startMin = toMin(shift.shift_start)
  const endMin   = toMin(shift.shift_end)
  const spanMin  = endMin - startMin || 1
  return (
    <div style={{ background: COLOR.parchment, borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLOR.ink, marginBottom: 10 }}>
        📍 Location Trail — Shift {shift.shift_label} ({fmt12(shift.shift_start)} → {fmt12(shift.shift_end)})
      </div>
      <div style={{ position: 'relative', height: 24, background: COLOR.rule, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        {trail.map((pt, i) => {
          const ts    = new Date(pt.server_recorded_at || pt.recorded_at)
          const ptMin = ts.getHours() * 60 + ts.getMinutes()
          const pct   = Math.min(100, Math.max(0, ((ptMin - startMin) / spanMin) * 100))
          return (
            <div key={i} title={`${fmtTime(pt.server_recorded_at || pt.recorded_at)} — ${pt.on_campus ? 'On campus' : `${pt.distance_from_campus || '?'}m away`} [${pt.event_type}]`}
              style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: pt.on_campus ? COLOR.sageDeep : COLOR.danger, border: '2px solid white', cursor: 'pointer' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLOR.slate, marginBottom: 8 }}>
        <span>{fmt12(shift.shift_start)}</span>
        <span style={{ display: 'flex', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR.sageDeep, display: 'inline-block' }}/> On campus</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR.danger, display: 'inline-block' }}/> Off campus</span>
        </span>
        <span>{fmt12(shift.shift_end)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
        {trail.filter(pt => pt.event_type !== 'ping').map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '4px 8px', background: COLOR.parchmentRaised, borderRadius: 6 }}>
            <span>{{ left_campus: '🏃', returned: '✅', shift_end: '🏁', absent_period: '👻', check_in: '🟢', check_out: '🔴' }[pt.event_type] || '📍'}</span>
            <span style={{ color: COLOR.slate }}>{fmtTime(pt.server_recorded_at || pt.recorded_at)}</span>
            <span style={{ fontWeight: 600, color: pt.on_campus ? COLOR.sageDeep : COLOR.danger }}>
              {{ check_in: 'Checked in', check_out: 'Checked out', left_campus: 'Left campus', returned: 'Returned to campus', shift_end: 'Shift ended (auto)', absent_period: `Absent (${pt.distance_from_campus || '?'}m away)` }[pt.event_type] || (pt.on_campus ? 'On campus' : `Off campus (${pt.distance_from_campus || '?'}m)`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Connection Banner ────────────────────────────────────────────────────────

function OfflineBanner({ offline, dark = false }) {
  if (!offline) return null
  return (
    <div role="alert" style={dark ? {
      background: 'rgba(240,180,41,0.1)', border: `1px solid ${GPAY.warn}44`, borderRadius: 12,
      padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center',
      fontSize: 13, fontWeight: 600, color: GPAY.warn, fontFamily: FONT.body,
      animation: 'vault-fade-in 0.25s ease',
    } : {
      background: COLOR.warnBg, border: `1px solid ${COLOR.warn}44`, borderRadius: RADIUS.md, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, color: COLOR.warn, fontFamily: FONT.body,
    }}>
      No internet connection — pings will be retried automatically when you're back online
    </div>
  )
}

// ─── Success overlay — GPay-style self-drawing checkmark ───────────────────
// A brief, full-screen confirmation shown right after a clean punch in/out,
// separate from the toast (which stays as the permanent record of what
// happened). The toast is enough information; this is purely the "yes, it
// worked" feeling — so it's skipped entirely for Late/Flagged/early-out
// outcomes, which already carry their own amber warning toast and would
// feel wrong paired with a celebratory green check.
function SuccessOverlay({ kind, label, onDone }) {
  // BUGFIX: onDone was passed as a fresh inline arrow function on every
  // parent render, and was in this effect's dependency array — so any
  // re-render during the 1.4s window (very likely here, given active GPS
  // tracking pings, realtime subscriptions, and the fetchMyLogs()/state
  // updates that follow a checkout) tore down and restarted the timer
  // from zero. If re-renders kept arriving faster than 1.4s apart, the
  // timer could never complete, leaving this overlay stuck on screen
  // indefinitely. Fix: stash the latest onDone in a ref and start the
  // timer only once, on mount — re-renders no longer reset it.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => onDoneRef.current()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(255,255,255,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        animation: 'gpay-success-fade-in 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 88, height: 88, borderRadius: '50%', background: '#1E8E3E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'gpay-success-pop 0.4s cubic-bezier(.34,1.56,.64,1)',
        boxShadow: '0 4px 20px rgba(30,142,62,0.35)',
      }}>
        <svg width="46" height="46" viewBox="0 0 52 52" fill="none">
          <path
            d="M14 27 L23 36 L40 17"
            stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            pathLength="1"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: 'gpay-success-draw 0.35s ease-out 0.25s forwards',
            }}
          />
        </svg>
      </div>
      <div style={{ marginTop: 18, fontSize: 17, fontWeight: 600, color: GPAY.textPrimary, fontFamily: FONT.body, animation: 'gpay-success-text-in 0.3s ease 0.35s both' }}>
        {kind === 'in' ? 'Punched in' : 'Punched out'}
      </div>
      {label && (
        <div style={{ marginTop: 4, fontSize: 13, color: GPAY.textMuted, fontFamily: FONT.body, animation: 'gpay-success-text-in 0.3s ease 0.4s both' }}>
          {label}
        </div>
      )}
      <style>{`
        @keyframes gpay-success-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gpay-success-pop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes gpay-success-draw { to { stroke-dashoffset: 0; } }
        @keyframes gpay-success-text-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
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
            { label: 'Present',   data: rows.map(r => r.present),  backgroundColor: COLOR.sageDeep, borderRadius: 4 },
            { label: 'Late',      data: rows.map(r => r.late),      backgroundColor: COLOR.warn, borderRadius: 4 },
            { label: 'Early Out', data: rows.map(r => r.earlyOut),  backgroundColor: COLOR.danger, borderRadius: 4 },
            { label: 'Absent',    data: rows.map(r => r.absent),    backgroundColor: COLOR.slate, borderRadius: 4 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: COLOR.rule } },
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
        <div style={{ fontWeight: 700, color: COLOR.ink, fontSize: 14 }}>📊 Attendance Overview — {monthFilter}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: COLOR.slate, flexWrap: 'wrap' }}>
          {[['Present',COLOR.sageDeep],['Late',COLOR.warn],['Early Out',COLOR.danger],['Absent',COLOR.slate]].map(([l,c]) => (
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

export default function GeoAttendance({ currentStaff, isAdmin: isAdminProp, allStaff = [], onCheckInSuccess = null, onCheckOutSuccess = null, initialTab = 'checkin' }) {
  const safeAllStaff = Array.isArray(allStaff) ? allStaff : []

  // ── Server-verified admin role (do NOT trust props alone) ─────────────────
  const [serverIsAdmin,   setServerIsAdmin]   = useState(false)
  const [adminVerified,   setAdminVerified]   = useState(false)
  const isAdmin = serverIsAdmin || (isAdminProp && adminVerified)

  const [activeTab,     setActiveTab]     = useState(initialTab)
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
  const [lastCheckInFailure, setLastCheckInFailure] = useState(null) // last failed attempt's signals, for the explainer panel
  const [successOverlay, setSuccessOverlay] = useState(null) // { kind: 'in' | 'out', label } or null — drives the full-screen success animation
  const [punchOutReminder, setPunchOutReminder] = useState(null) // { shiftLabel, shiftEnd } or null — in-app banner shown once shift end approaches
  const punchOutReminderTimersRef = useRef({}) // logId -> timeout id, so a reminder isn't double-scheduled and is cleared on checkout

  // Schedules the in-app punch-out reminder banner (and, if permission was
  // already granted earlier, a real browser notification) to fire a fixed
  // window before the shift's scheduled end. Only meaningful while this
  // component instance stays mounted/tab stays open — there is no server-
  // side push tied to this specific reminder, since scheduling an actual
  // push notification requires a backend job that isn't part of this file.
  // If the person closes the tab before shift end, the reminder simply
  // won't fire; the in-app banner is best-effort convenience, not the
  // system of record for attendance (server_checkin/server_checkout are).
  const REMINDER_LEAD_MINUTES = 10
  const schedulePunchOutReminder = useCallback((logId, shift) => {
    if (punchOutReminderTimersRef.current[logId]) return // already scheduled for this log
    const msUntilReminder = (minutesToShiftEnd(shift) - REMINDER_LEAD_MINUTES) * 60000
    if (msUntilReminder <= 0) return // shift already ending/ended — nothing useful to schedule
    const timerId = setTimeout(() => {
      setPunchOutReminder({ shiftLabel: shift.shift_label, shiftEnd: shift.shift_end })
      speak(`Reminder: your shift ${shift.shift_label} ends soon. Don't forget to punch out.`)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('GNSI — Punch out reminder', {
            body: `Shift ${shift.shift_label} ends soon (${fmt12(shift.shift_end)}). Don't forget to punch out.`,
            tag: `punch-out-reminder-${logId}`,
          })
        } catch (e) {
          console.warn('Local punch-out notification failed:', e.message)
        }
      }
      delete punchOutReminderTimersRef.current[logId]
    }, msUntilReminder)
    punchOutReminderTimersRef.current[logId] = timerId
  }, [])

  const clearPunchOutReminder = useCallback((logId) => {
    if (punchOutReminderTimersRef.current[logId]) {
      clearTimeout(punchOutReminderTimersRef.current[logId])
      delete punchOutReminderTimersRef.current[logId]
    }
    setPunchOutReminder(null)
  }, [])

  // Clear any pending reminder timers if the component unmounts mid-shift
  // (e.g. navigating away) so they don't fire against stale state.
  useEffect(() => {
    return () => {
      Object.values(punchOutReminderTimersRef.current).forEach(clearTimeout)
    }
  }, [])
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
  // All-staff shift overview — a single table of every active shift
  // across every staff member, so an admin can spot a bad entry (e.g. a
  // shift end time entered as 05:30 instead of 17:30) at a glance instead
  // of only being able to see one staff member's shifts at a time.
  const [allShiftsView, setAllShiftsView]   = useState('list') // 'list' | 'editor' — which shifts sub-view is showing
  const [allShiftsRows, setAllShiftsRows]   = useState([])
  const [loadingAllShifts, setLoadingAllShifts] = useState(false)
  const [shiftSearch, setShiftSearch]       = useState('')
  const [monthFilter,   setMonthFilter]   = useState(new Date().toISOString().slice(0, 7))
  const [resolvingId,   setResolvingId]   = useState(null)
  const [resolveNote,   setResolveNote]   = useState('')
  const [expandedTrail, setExpandedTrail] = useState(null)
  const [editingTimeId, setEditingTimeId] = useState(null)
  const [editTimeForm,  setEditTimeForm]  = useState({ check_in: '', check_out: '', status: '', note: '' })
  const [savingTimeEdit, setSavingTimeEdit] = useState(false)
  const [loadingMonth,  setLoadingMonth]  = useState(false)

  // ── No-phone staff helper feature ────────────────────────────────────────
  // If the logged-in staff has been assigned as a "helper" for one or more
  // no-phone colleagues, they get a picker to punch in/out FOR that person
  // instead of themselves. Deliberately kept as separate, parallel state
  // rather than repointing myShifts/myLogs/activeTracking (which the rest
  // of this component uses for the self-view history/exports/advances) —
  // this only affects the punch action itself.
  const [helperAssignments, setHelperAssignments] = useState([]) // [{id, assisted_staff_id, name}]
  const [punchTarget, setPunchTarget] = useState(null) // null = punching for self; else { id, name }
  const [targetShifts, setTargetShifts] = useState([])
  const [targetLogs, setTargetLogs] = useState([])
  const [targetActiveTracking, setTargetActiveTracking] = useState([])
  const [loadingTarget, setLoadingTarget] = useState(false)

  const fetchHelperAssignments = useCallback(async () => {
    if (!currentStaff?.id) return
    const { data, error } = await supabase
      .from('staff_attendance_helpers')
      .select('id, assisted_staff_id')
      .eq('helper_staff_id', currentStaff.id)
      .eq('active', true)
    if (error || !data || data.length === 0) { setHelperAssignments([]); return }
    const ids = data.map(r => r.assisted_staff_id)
    const { data: profiles } = await supabase.from('staff_profiles').select('id, name').in('id', ids)
    const nameById = Object.fromEntries((profiles || []).map(p => [p.id, p.name]))
    setHelperAssignments(data.map(r => ({
      id: r.id,
      assisted_staff_id: r.assisted_staff_id,
      name: nameById[r.assisted_staff_id] || `Staff #${r.assisted_staff_id}`,
    })))
  }, [currentStaff?.id])

  useEffect(() => { fetchHelperAssignments() }, [fetchHelperAssignments])

  const fetchTargetData = useCallback(async (targetId) => {
    if (!targetId) return
    setLoadingTarget(true)
    const [{ data: shifts }, { data: logs }] = await Promise.all([
      supabase.from('staff_shifts').select('*').eq('staff_id', targetId).eq('is_active', true).order('shift_start'),
      supabase.from('staff_geo_attendance').select('*').eq('staff_id', targetId).order('date', { ascending: false }).limit(30),
    ])
    setTargetShifts(shifts || [])
    setTargetLogs(logs || [])
    const todayIso = today()
    setTargetActiveTracking(
      (logs || [])
        .filter(l => l.date === todayIso && !l.check_out_time && !l.session_dead)
        .map(l => ({ logId: l.id, shiftId: l.shift_id, shiftLabel: l.shift_label, shift: (shifts || []).find(s => l.shift_id != null ? s.id === l.shift_id : s.shift_label === l.shift_label) }))
    )
    setLoadingTarget(false)
  }, [])

  useEffect(() => {
    if (punchTarget?.id) fetchTargetData(punchTarget.id)
  }, [punchTarget?.id, fetchTargetData])

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
      // BUGFIX: this used to force activeTab to 'monitor' for any verified
      // admin unconditionally, overriding whatever initialTab this instance
      // was mounted with. That was tolerable while an internal tab bar let
      // the admin click back to "My Check-In" — now that each
      // <GeoAttendance> instance is mounted once per outer Face Attendance
      // tab with a fixed section (initialTab), and Face Attendance itself
      // decides which section each tab shows, this component must not
      // override that choice. Removed — initialTab is now the single
      // source of truth for which section renders.
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

  // All-staff shift overview — every active shift, joined to the staff
  // name/designation, sorted by staff name then start time. Flags any
  // shift whose end time looks earlier than its start time as a same-day
  // shift (rather than one that legitimately wraps past midnight) —
  // exactly the class of data-entry mistake (05:30 typed instead of
  // 17:30) that a per-staff-only view made hard to spot.
  const fetchAllShifts = useCallback(async () => {
    setLoadingAllShifts(true)
    // Uses the already-loaded staff list (safeAllStaff) to attach name/
    // designation client-side, rather than guessing at a foreign-key
    // constraint name for an embedded join — avoids a fragile assumption
    // about a name this codebase hasn't confirmed for this table.
    const { data, error } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('is_active', true)
      .order('staff_id')
      .order('shift_start')
    if (!error) {
      const staffById = Object.fromEntries(safeAllStaff.map(s => [String(s.id), s]))
      setAllShiftsRows((data || []).map(row => ({
        ...row,
        _staffName: staffById[String(row.staff_id)]?.name || `#${row.staff_id}`,
        _staffDesignation: staffById[String(row.staff_id)]?.designation || '',
      })))
    } else {
      console.error('fetchAllShifts error:', error)
    }
    setLoadingAllShifts(false)
  }, [safeAllStaff])

  useEffect(() => {
    if (isAdmin && activeTab === 'shifts' && allShiftsView === 'list') fetchAllShifts()
  }, [isAdmin, activeTab, allShiftsView, fetchAllShifts])

  const fetchTodayLogs = useCallback(async () => {
    // FIX 1: removed 'department' from staff_profiles join — column not confirmed in schema
    const { data, error } = await supabase.from('staff_geo_attendance')
      .select('*, staff_profiles!staff_geo_attendance_staff_id_fkey(name, designation)')
      .eq('date', today())
      .order('check_in_time', { ascending: false })
    if (!error) setTodayLogs(data || [])
    else console.error('fetchTodayLogs error:', error)
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
      .select('*, staff_profiles!staff_geo_attendance_staff_id_fkey(name, designation)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
      .limit(500)
    if (selectedStaff) q = q.eq('staff_id', selectedStaff)
    const { data, error } = await q
    if (!error) setMonthLogs(data || [])
    else console.error('fetchMonthLogs error:', error)
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
  // BUGFIX: "My Attendance History" (non-admin) never refetched myLogs when
  // opened — it only relied on the initial mount fetch and post-checkin/
  // checkout refreshes. If the tab was opened in an already-loaded session
  // (e.g. before that day's check-in, or after switching tabs), it showed
  // stale data — a real Late/Present check-in could still render as the
  // earlier Absent state. Refetch whenever this tab becomes active.
  useEffect(() => { if (!isAdmin && activeTab === 'history') fetchMyLogs() }, [activeTab, isAdmin])
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
  const shiftListRef = useRef(null) // scroll target when SmartPunchButton can't resolve a single obvious action

  const handleCheckIn = async (shift) => {
    if (!currentStaff?.id) { showToast('❌ Staff profile not linked — contact admin', 'err'); return }
    if (!campus)            { showToast('❌ Campus zone not configured', 'err'); return }
    if (!gpsCoords)         { showToast('❌ GPS not ready — click Detect Location first', 'err'); return }
    if (!navigator.onLine)  { showToast('❌ No internet connection — please try when online', 'err'); return }
    if (gpsAccuracy && gpsAccuracy > (campus.radius / 2)) { showToast(`❌ GPS too weak (±${Math.round(gpsAccuracy)}m) — move to open area`, 'err'); return }

    // Friendly client-side pre-check for the Admin Control Center's
    // check-in pause — saves the person from going through the whole
    // camera/liveness flow only to be rejected at the last step. The
    // REAL enforcement is server-side inside server_checkin itself
    // (is_checkin_paused()), since a client check alone can be bypassed.
    // Wrapped in try/catch: if this RPC fails or times out, fall through
    // to the face-capture flow anyway rather than dying silently — the
    // server-side check inside server_checkin still enforces the pause
    // for real, so failing open here only affects this early friendly
    // warning, not actual security.
    try {
      const { data: paused, error: pauseErr } = await supabase.rpc('is_checkin_paused')
      if (pauseErr) throw pauseErr
      if (paused) { showToast('⏸ Check-ins are temporarily paused by admin — try again shortly', 'warn'); return }
    } catch (e) {
      console.warn('is_checkin_paused check failed, continuing to face capture:', e)
    }

    setFaceCaptureShift(shift) // opens <FaceCapture> overlay, see render section
  }

  const performCheckIn = async (shift, faceResult) => {
    setFaceCaptureShift(null)
    setCheckingIn(true)
    const targetStaffId = punchTarget?.id || currentStaff.id
    try {
      const { data, error } = await supabase.rpc('server_checkin', {
        p_staff_id:            targetStaffId,
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
        // The raw live descriptor is sent as-is; server_checkin independently
        // recomputes the match against the stored enrolled descriptor and
        // is the ONLY thing that decides pass/fail. faceResult.clientScore/
        // clientVerified (if present) are advisory client-side numbers used
        // only for local UI/logging — never sent, since a client-reported
        // verdict can't be trusted as a security decision.
        p_live_descriptor:       faceResult.liveDescriptor,
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
          checkins_paused:   '⏸ Check-ins are temporarily paused by admin — try again shortly',
        }
        showToast(msgs[data.error] || `❌ ${data.message || 'Check-in failed'}`, 'warn')
        // Keep the raw failure reason around for the "Why did check-in
        // fail?" explainer panel — plain-language decode of the last
        // attempt's signals, so staff aren't left guessing what to fix.
        setLastCheckInFailure({
          error: data.error,
          message: data.message,
          matchScore: data.match_score ?? null,
          serverTime: data.server_time,
          at: new Date().toISOString(),
        })
        setCheckingIn(false)
        return
      }

      setLastCheckInFailure(null)
      if (data.weak_face_match) {
        showToast('⚠️ Face match was weak — if this keeps happening, ask an admin to re-enroll your face.', 'warn')
      }

      const logId = data.log_id

      if (logId) {
        if (punchTarget?.id) {
          setTargetActiveTracking(prev => [...prev, { logId, shiftId: shift.id, shiftLabel: shift.shift_label, shift }])
        } else {
          setActiveTracking(prev => [...prev, { logId, shiftId: shift.id, shiftLabel: shift.shift_label, shift }])
          setGpsStatus('tracking')
          schedulePunchOutReminder(logId, shift)

          // Sync bridge — self_attendance (geo_verified + geo_distance added by migration)
          // Only for a normal self-punch; an on-behalf-of punch shouldn't
          // touch the ACTOR's own self_attendance sync row.
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
      }

      if (punchTarget?.id) {
        await fetchTargetData(punchTarget.id)
      } else {
        await fetchMyLogs()
      }
      const status = data.status
      if (status === 'Late') {
        showToast(`🕐 Checked in LATE — ${data.late_minutes} min. Tracking started.`, 'warn')
        speak(`Checked in, ${data.late_minutes} minutes late`)
      } else if (status === 'Flagged') {
        showToast('🚨 Check-in flagged for review. Tracking started.', 'warn')
        speak('Check in flagged for review')
      } else {
        showToast(`✅ Checked in — Shift ${shift.shift_label}${punchTarget ? ` for ${punchTarget.name}` : ''}. Tracking active.`, 'ok')
        setSuccessOverlay({ kind: 'in', label: `Shift ${shift.shift_label}${punchTarget ? ` for ${punchTarget.name}` : ''}` })
        if (!punchTarget) speak('Checked in successfully')
      }

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

  const [checkoutPending, setCheckoutPending] = useState(null) // { logId, shiftLabel } awaiting mandatory face scan, or null

  // Checkout now requires a face scan, same as check-in — no skip option.
  // This closes the gap where checkout was pure GPS with zero biometric
  // check, so anyone with the device/session could punch someone else out.
  const handleCheckOut = (logId, shiftLabel) => {
    setCheckoutPending({ logId, shiftLabel })
  }

  const performCheckOut = async (logId, shiftLabel, faceResult) => {
    setCheckoutPending(null)
    if (!navigator.onLine && !window.confirm('No internet connection. Queue checkout for when you\'re back online?')) return
    if (!gpsCoords && !window.confirm('GPS not available. Check out without location? This will be flagged.')) return

    const targetStaffId = punchTarget?.id || currentStaff?.id

    const { data, error } = await supabase.rpc('server_checkout', {
      p_attendance_id: logId,
      p_staff_id:      targetStaffId ? parseInt(targetStaffId) : null,
      p_lat:           gpsCoords?.lat ?? null,
      p_lng:           gpsCoords?.lng ?? null,
      p_accuracy:      gpsAccuracy   ?? null,
      p_campus_lat:    campus?.lat,
      p_campus_lng:    campus?.lng,
      p_campus_radius: campus?.radius,
      p_live_descriptor:       faceResult.liveDescriptor,
      p_liveness_challenge_id: faceResult.challengeId,
    })

    if (error) { showToast('❌ ' + error.message, 'err'); return }

    // BUGFIX: server_checkout's own early rejections (unauthorized,
    // not_found_or_already_out) return {ok:false,...}, while the later
    // face-verification rejections return {success:false,...} — an
    // inconsistency in the function itself. This code only ever checked
    // data.success, so an {ok:false} response's real error/message never
    // surfaced — showing a bare "Checkout failed" toast with no
    // indication of what actually happened. Check both shapes explicitly.
    const failed = data?.success === false || data?.ok === false
    if (failed) {
      const msgs = {
        face_not_enrolled:        '🧑‍💼 Face not enrolled or not yet approved — contact admin',
        face_mismatch:            '❌ Face did not match your enrolled profile — try again',
        liveness_missing:         '❌ Liveness check missing — try again',
        liveness_failed:          '❌ Liveness check expired or invalid — try again',
        unauthorized:             '❌ Not authorized for this checkout — please refresh and try again',
        not_found_or_already_out: 'ℹ️ Already checked out (or this session ended) — refreshing…',
      }
      showToast(msgs[data.error] || `❌ ${data.message || `Checkout failed (${data?.error || 'unknown reason'})`}`, 'warn')
      // A stale/already-closed record means our local "still tracking"
      // state is wrong — refresh from the server instead of leaving the
      // UI showing an active Check-out button for a shift that's already
      // closed.
      if (data?.error === 'not_found_or_already_out') {
        if (punchTarget?.id) await fetchTargetData(punchTarget.id)
        else await fetchMyLogs()
      }
      return
    }

    if (punchTarget?.id) {
      setTargetActiveTracking(prev => {
        const remaining = prev.filter(t => t.logId !== logId)
        return remaining
      })
      await fetchTargetData(punchTarget.id)
    } else {
      setActiveTracking(prev => {
        const remaining = prev.filter(t => t.logId !== logId)
        if (!remaining.length) setGpsStatus('oncampus')
        return remaining
      })
      clearPunchOutReminder(logId)
      await fetchMyLogs()
    }

    if (data?.half_day) {
      showToast(`⚠️ Checked out — marked Half Day (late arrival or early departure)`, 'warn')
      if (!punchTarget) speak('Checked out, marked half day')
    } else if (data?.early_out) {
      showToast(`⚠️ Checked out early (${Math.round(data.mins_left || 0)} min before shift end) — flagged`, 'warn')
      if (!punchTarget) speak('Checked out early')
    } else {
      showToast(`✅ Checked out — Shift ${shiftLabel}${punchTarget ? ` for ${punchTarget.name}` : ''}`, 'ok')
      if (!punchTarget) speak('Checked out successfully')
    }
    if (!data?.early_out && !data?.half_day) {
      setSuccessOverlay({ kind: 'out', label: `Shift ${shiftLabel}${punchTarget ? ` for ${punchTarget.name}` : ''}` })
    }
    if (!punchTarget && onCheckOutSuccess) onCheckOutSuccess()
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
    const failed = []
    const skippedDupes = []
    for (const staffId of bulkStaffIds) {
      // BUGFIX: this used to always insert, with no check for an existing
      // active shift of the same label for that staff member — running
      // this twice (or reassigning after a typo) silently created
      // duplicate rows, which the on-screen help text even acknowledged
      // as something admins had to notice and clean up manually via the
      // single-staff editor. Now it skips anyone who already has an
      // active shift with this exact label, rather than duplicating it.
      const { data: existing } = await supabase.from('staff_shifts')
        .select('id').eq('staff_id', parseInt(staffId)).eq('shift_label', payload.shift_label).eq('is_active', true).maybeSingle()
      if (existing) {
        skippedDupes.push(staffId)
        continue
      }
      const { error } = await supabase.from('staff_shifts').insert({ ...payload, staff_id: parseInt(staffId) })
      if (!error) successCount++
      else failed.push({ staffId, message: error.message })
    }
    setSavingBulkShift(false)

    // BUGFIX: partial failures used to only report a bare count
    // ("3/5 saved — check console for errors"), leaving a non-technical
    // admin with no way to know WHO failed or WHY without opening dev
    // tools. Now names and reasons are surfaced directly in the toast.
    const nameFor = (id) => safeAllStaff.find(s => String(s.id) === String(id))?.name || `#${id}`
    if (failed.length === 0 && skippedDupes.length === 0) {
      showToast(`✅ Shift assigned to ${successCount} staff`, 'ok')
      setBulkStaffIds(new Set())
    } else {
      const parts = [`✅ ${successCount} assigned`]
      if (skippedDupes.length) parts.push(`⏭️ ${skippedDupes.length} already had this shift (${skippedDupes.map(nameFor).join(', ')})`)
      if (failed.length) parts.push(`❌ ${failed.length} failed: ${failed.map(f => `${nameFor(f.staffId)} (${f.message})`).join('; ')}`)
      showToast(parts.join(' · '), failed.length ? 'err' : 'warn')
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
    // BUGFIX: this used to silently `continue` past any shift missing a
    // label/start/end, then still show "✅ Shifts saved" — so filling in
    // times but leaving Label blank (or accidentally clearing it while
    // editing) meant the row was dropped with zero feedback. It looked
    // exactly like "I configured a shift and it disappeared." Now every
    // incomplete row is collected and reported, and nothing is silently
    // discarded.
    const incomplete = []
    const dupes = []
    let savedCount = 0
    for (const sf of shiftForms) {
      if (!sf.shift_label || !sf.shift_start || !sf.shift_end) {
        incomplete.push(sf)
        continue
      }
      const isNewRow = !sf.id || String(sf.id).startsWith('new')
      if (isNewRow) {
        // BUGFIX: a new row always inserted with no check for an existing
        // active shift of the same label for this staff member — typing
        // a label that matches one already on file silently created a
        // duplicate. Skip and report instead of inserting a dupe.
        const dupeAmongOthers = shiftForms.some(other => other !== sf && other.shift_label === sf.shift_label && !String(other.id || '').startsWith('new'))
        if (dupeAmongOthers) {
          dupes.push(sf)
          continue
        }
      }
      const payload = {
        staff_id: parseInt(selectedStaff), shift_label: sf.shift_label,
        shift_start: sf.shift_start, shift_end: sf.shift_end,
        check_in_window_min: parseInt(sf.check_in_window_min) || 10,
        is_active: true, effective_from: today(), created_by: 'Admin',
      }
      if (!isNewRow) {
        await supabase.from('staff_shifts').update(payload).eq('id', sf.id)
      } else {
        await supabase.from('staff_shifts').insert(payload)
      }
      savedCount++
    }
    setSavingShifts(false)
    if (incomplete.length || dupes.length) {
      const parts = [`✅ ${savedCount} saved`]
      if (incomplete.length) {
        const missing = incomplete.map(sf => {
          const gaps = []
          if (!sf.shift_label) gaps.push('label')
          if (!sf.shift_start) gaps.push('start time')
          if (!sf.shift_end) gaps.push('end time')
          return gaps.join('/')
        }).join('; ')
        parts.push(`⚠️ ${incomplete.length} skipped (missing: ${missing})`)
      }
      if (dupes.length) {
        parts.push(`⏭️ ${dupes.length} skipped — this staff member already has a "${dupes.map(d => d.shift_label).join(', ')}" shift`)
      }
      showToast(parts.join(' · '), 'warn')
    } else {
      showToast('✅ Shifts saved', 'ok')
    }
    const sh = await fetchShiftsFor(selectedStaff)
    // Preserve any still-incomplete or duplicate rows in the form (don't
    // let a refetch silently wipe out what the user typed but hadn't
    // finished, or a duplicate they still need to rename/remove) —
    // successfully-saved rows come fresh from the server.
    setShiftForms([...sh.map(s => ({ ...s, _edit: false })), ...incomplete, ...dupes])
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

  // Opens the inline check-in/check-out time editor for a log row,
  // pre-filled with its current values (converted to a local datetime-
  // local input string) so admins can correct a missed/wrong device
  // check-in — e.g. GPS failure, phone issue — directly on the real
  // attendance record, rather than only being able to flip a status label
  // that's disconnected from actual check-in/out times.
  const startEditTime = (log) => {
    const toLocalInput = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setEditingTimeId(log.id)
    setEditTimeForm({
      check_in:  toLocalInput(log.check_in_time),
      check_out: toLocalInput(log.check_out_time),
      status:    log.status || 'Present',
      note:      '',
    })
  }

  const saveEditTime = async (log) => {
    if (!currentStaff?.id) {
      showToast('⚠️ Your account isn\'t linked to a staff profile — can\'t verify admin status.', 'warn')
      return
    }
    setSavingTimeEdit(true)
    const { data, error } = await supabase.rpc('admin_override_attendance', {
      p_admin_id:        currentStaff.id,
      p_staff_id:        log.staff_id,
      p_date:            log.date,
      p_shift_id:        log.shift_id || null,
      p_shift_label:     log.shift_label,
      p_status:          editTimeForm.status || null,
      p_check_in_time:   editTimeForm.check_in  ? new Date(editTimeForm.check_in).toISOString()  : null,
      p_check_out_time:  editTimeForm.check_out ? new Date(editTimeForm.check_out).toISOString() : null,
      p_clear_check_in:  !editTimeForm.check_in,
      p_clear_check_out: !editTimeForm.check_out,
      p_note:            editTimeForm.note || 'Manual time correction',
    })
    setSavingTimeEdit(false)
    if (error) { showToast('❌ ' + error.message, 'err'); return }
    if (!data?.success) { showToast('❌ ' + (data?.error || 'Could not save'), 'err'); return }
    setEditingTimeId(null)
    await fetchTodayLogs()
    showToast('✅ Attendance record updated', 'ok')
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

  // Internal `tabs` array removed along with the tab bar above — section
  // selection is now driven entirely by the `initialTab` prop from
  // FaceAttendance.jsx's outer tab shell (see render section below).

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
      <div role="status" style={{
        background: wasOff ? COLOR.dangerBg : `${COLOR.sage}14`,
        border: `1px solid ${wasOff ? COLOR.danger + '44' : COLOR.sage + '44'}`,
        borderRadius: RADIUS.lg, padding: '13px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <div style={{ flexShrink: 0 }}>{wasOff ? <span style={{ fontSize: 20 }}>⚠️</span> : <Seal size={30} tone="brass" />}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: wasOff ? COLOR.danger : COLOR.sageDeep, fontSize: 13, fontFamily: FONT.display }}>
            {wasOff ? `Off campus — auto checkout in ${AUTO_CHECKOUT_THRESHOLD} min if not returned` : 'Location tracking active'}
          </div>
          <div style={{ fontSize: 12, color: wasOff ? COLOR.danger : COLOR.slate, marginTop: 2, opacity: 0.85 }}>
            {activeTracking.map(t => `Shift ${t.shiftLabel} (ends ${fmt12(t.shift.shift_end)})`).join(' · ')}
            {lastPingTime && ` · Last ping: ${fmtTime(lastPingTime)}`}
          </div>
        </div>
        {wasOff && <div style={{ fontSize: 10.5, background: COLOR.danger, color: COLOR.cream, padding: '4px 10px', borderRadius: RADIUS.sm, fontWeight: 700, whiteSpace: 'nowrap' }}>Admin notified</div>}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <style>{`
        @keyframes vault-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vault-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={S.page}>
        <ToastQueue toasts={toasts} />

        <div style={{ marginBottom: 24 }}>
          <p style={{ color: COLOR.slate, fontSize: 12.5, margin: 0 }}>
            Server-verified · Continuous tracking · Shift-aware
            {campus && <span style={{ marginLeft: 12, color: COLOR.sageDeep, fontWeight: 600 }}>{campus.name} ({campus.radius}m)</span>}
            {offline && <span style={{ marginLeft: 12, color: COLOR.danger, fontWeight: 600 }}>Offline</span>}
          </p>
        </div>

        {/* Minimal staff-only section switcher — Check-in / History /
            Advances. Admin sections (Monitor, Fraud, Shifts, Campus,
            Report) no longer have any switcher here at all; each is its
            own outer tab in FaceAttendance.jsx now, so an admin instance
            of this component always renders exactly the one section it
            was mounted for. This switcher exists only so a single staff
            mount (with its GPS watch/tracking already running) can also
            reach History/Advances without a second/third full mount. */}
        {!isAdmin && (
          <div role="tablist" style={{ display: 'flex', borderBottom: `1px solid ${COLOR.rule}`, marginBottom: 20, gap: 4 }}>
            {[
              { key: 'checkin',  label: '📍 Check-In' },
              { key: 'history',  label: '📅 History' },
              { key: 'advances', label: '💳 Advances' },
            ].map(t => (
              <button key={t.key} role="tab" aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ══ MY CHECK-IN — Google Pay style: white cards, blue accent ══ */}
        {activeTab === 'checkin' && (
          <div style={{
            maxWidth: 500, margin: '-20px auto 0', background: GPAY.bg,
            padding: '20px 16px 32px', borderRadius: '0 0 20px 20px',
          }}>
            <OfflineBanner offline={offline} dark />

            {punchOutReminder && (
              <div role="status" style={{
                background: '#FEF7E0', border: `1px solid ${GPAY.warn}55`, borderRadius: 14,
                padding: '13px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                animation: 'vault-fade-in 0.3s ease',
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: GPAY.warn, fontSize: 13, fontFamily: FONT.body }}>⏰ Shift ending soon</div>
                  <div style={{ fontSize: 12, color: GPAY.textMuted, marginTop: 2 }}>
                    Shift {punchOutReminder.shiftLabel} ends at {fmt12(punchOutReminder.shiftEnd)} — don't forget to punch out.
                  </div>
                </div>
                <button onClick={() => setPunchOutReminder(null)} style={{ background: 'none', border: 'none', color: GPAY.warn, cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1, flexShrink: 0 }} aria-label="Dismiss reminder">✕</button>
              </div>
            )}

            {activeTracking.length > 0 && (() => {
              const wasOff = offCampusSince
              return (
                <div role="status" style={{
                  background: wasOff ? '#FCE8E6' : '#E6F4EA',
                  border: `1px solid ${wasOff ? GPAY.danger + '55' : GPAY.ok + '44'}`,
                  borderRadius: 14, padding: '13px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center',
                  animation: 'vault-fade-in 0.3s ease',
                }}>
                  <div style={{ flexShrink: 0 }}>
                    {wasOff
                      ? <span style={{ fontSize: 20 }}>⚠️</span>
                      : <div style={{ width: 30, height: 30, borderRadius: '50%', background: GPAY.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>✓</div>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: wasOff ? GPAY.danger : GPAY.ok, fontSize: 13, fontFamily: FONT.display }}>
                      {wasOff ? `Off campus — auto checkout in ${AUTO_CHECKOUT_THRESHOLD} min if not returned` : 'Location tracking active'}
                    </div>
                    <div style={{ fontSize: 12, color: wasOff ? GPAY.danger : GPAY.textMuted, marginTop: 2, opacity: 0.9 }}>
                      {activeTracking.map(t => `Shift ${t.shiftLabel} (ends ${fmt12(t.shift.shift_end)})`).join(' · ')}
                      {lastPingTime && ` · Last ping: ${fmtTime(lastPingTime)}`}
                    </div>
                  </div>
                  {wasOff && <div style={{ fontSize: 10.5, background: GPAY.danger, color: '#fff', padding: '4px 10px', borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>Admin notified</div>}
                </div>
              )
            })()}

            {todayMyLogs.some(l => l.session_dead && !l.check_out_time) && (
              <div role="alert" style={{ background: 'rgba(226,87,76,0.1)', border: `1px solid ${GPAY.danger}44`, borderRadius: 14, padding: '13px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: GPAY.danger, fontSize: 13, fontFamily: FONT.display }}>Session interrupted — location tracking was lost</div>
                <div style={{ fontSize: 12, color: GPAY.danger, marginTop: 4, opacity: 0.85 }}>
                  {todayMyLogs.filter(l => l.session_dead && !l.check_out_time).map(l => `Shift ${l.shift_label}`).join(', ')} — tab was closed or app killed mid-shift. Admin has been notified.
                </div>
              </div>
            )}

            {!currentStaff && (
              <div style={{ background: 'rgba(240,180,41,0.1)', border: `1px solid ${GPAY.warn}44`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: GPAY.warn, fontWeight: 600 }}>
                Staff profile not linked to your account. Contact admin to link your profile.
              </div>
            )}

            {myPendingAdvanceTotal > 0 && (
              <div style={{ background: 'rgba(240,180,41,0.1)', border: `1px solid ${GPAY.warn}44`, borderRadius: 12, padding: '11px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: GPAY.warn, fontWeight: 600 }}>Pending advance deduction this month</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: GPAY.warn, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(myPendingAdvanceTotal)}</div>
              </div>
            )}

            {todayMyLogs.length > 0 && (
              <div style={{ background: GPAY.panel, border: `1px solid ${GPAY.panelBorder}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GPAY.textPrimary, marginBottom: 12, fontFamily: FONT.display }}>Today's attendance</div>
                {todayMyLogs.map(log => {
                  const isBeingTracked = activeTracking.some(t => t.logId === log.id)
                  return (
                    <div key={log.id} style={{ padding: '13px 14px', background: GPAY.panelHover, borderRadius: 12, marginBottom: 8, border: `1px solid ${log.session_dead ? GPAY.danger + '44' : isBeingTracked ? GPAY.ok + '44' : GPAY.panelBorder}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: GPAY.textPrimary, fontFamily: FONT.body }}>Shift {log.shift_label}</div>
                          <div style={{ fontSize: 12, color: GPAY.textMuted, fontVariantNumeric: 'tabular-nums' }}>In: {fmtTime(log.server_check_in_time || log.check_in_time)} · Out: {fmtTime(log.server_check_out_time || log.check_out_time)}</div>
                          {log.distance_from_campus !== null && <div style={{ fontSize: 11, color: GPAY.textMuted }}>{Math.round(log.distance_from_campus)}m from campus at check-in</div>}
                          {log.late_minutes > 0 && <div style={{ fontSize: 11, color: GPAY.warn, fontWeight: 600, marginTop: 3 }}>Late by {log.late_minutes} min</div>}
                          {log.session_dead && <div style={{ fontSize: 11, color: GPAY.danger, fontWeight: 600, marginTop: 4 }}>Session lost — tracking interrupted</div>}
                          {isBeingTracked && <div style={{ fontSize: 11, color: GPAY.ok, fontWeight: 600, marginTop: 4 }}>Tracking active</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <StatusBadge status={log.status} dark />
                          {log.check_in_time && !log.check_out_time && !log.session_dead && (
                            <button onClick={gpayRipple(() => handleCheckOut(log.id, log.shift_label))} style={gpayBtnStyle({ bg: GPAY.ok, size: 'sm' })} {...gpayPress}>Check out</button>
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
              <div style={{ background: 'rgba(93,202,165,0.08)', border: `1px solid ${GPAY.ok}44`, borderRadius: 12,
                padding: '11px 16px', marginBottom: 14, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: GPAY.ok, fontWeight: 600 }}>
                  Enable push notifications to get shift alerts
                </div>
                <button onClick={gpayRipple(subscribe)} style={gpayBtnStyle({ bg: GPAY.ok, size: 'sm' })} {...gpayPress}>Enable</button>
              </div>
            )}

            <div style={{ background: GPAY.bgRaised, border: `1px solid ${GPAY.goldBorder}`, borderRadius: 18, padding: 18 }}>
              <GPSRing
                status={gpsStatus} distance={gpsDistance} accuracy={gpsAccuracy} campus={campus}
                tracking={activeTracking.length > 0}
                minsLeft={activeTracking.length > 0 ? minutesToShiftEnd(activeTracking[0].shift) : null}
                dark
              />

              {helperAssignments.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: GPAY.textMuted, display: 'block', marginBottom: 4 }}>
                    Who are you punching in for?
                  </label>
                  <select
                    value={punchTarget?.id || ''}
                    onChange={e => {
                      const id = e.target.value
                      if (!id) { setPunchTarget(null); return }
                      const a = helperAssignments.find(h => String(h.assisted_staff_id) === id)
                      if (a) setPunchTarget({ id: a.assisted_staff_id, name: a.name })
                    }}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                      border: `1px solid ${GPAY.panelBorder}`, fontSize: 14, fontFamily: FONT.body,
                      background: '#ffffff', color: GPAY.textPrimary,
                    }}
                  >
                    <option value="">Myself ({currentStaff?.name})</option>
                    {helperAssignments.map(a => (
                      <option key={a.id} value={a.assisted_staff_id}>{a.name} (no phone)</option>
                    ))}
                  </select>
                </div>
              )}

              {gpsStatus === 'idle' && (
                <button onClick={gpayRipple(startGPS)} style={{ ...gpayBtnStyle({ bg: GPAY.gold, size: 'lg' }), width: '100%', fontSize: 15 }} {...gpayPress}>
                  📡 Detect My Location
                </button>
              )}
              {gpsStatus === 'locating' && (
                <div style={{ textAlign: 'center', color: GPAY.warn, fontWeight: 600, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', animation: 'vault-spin 1s linear infinite' }}>📡</span> Acquiring GPS signal...
                </div>
              )}
              {['weak', 'error'].includes(gpsStatus) && (
                <button onClick={gpayRipple(startGPS)} style={{ ...gpayBtnStyle({ bg: GPAY.warn }), width: '100%' }} {...gpayPress}>🔄 Retry Detection</button>
              )}

              {['oncampus', 'outside', 'tracking'].includes(gpsStatus) && (
                loadingTarget ? (
                  <div style={{ textAlign: 'center', color: GPAY.textMuted, padding: 16, fontSize: 13 }}>Loading {punchTarget?.name}'s shifts…</div>
                ) : (
                  <SmartPunchButton
                    myShifts={punchTarget ? targetShifts : myShifts}
                    todayMyLogs={punchTarget ? targetLogs.filter(l => l.date === today()) : todayMyLogs}
                    activeTracking={punchTarget ? targetActiveTracking : activeTracking}
                    gpsStatus={gpsStatus}
                    checkingIn={checkingIn}
                    onPunchIn={handleCheckIn}
                    onPunchOut={handleCheckOut}
                    onChooseBelow={() => shiftListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    dark
                  />
                )
              )}

              {['oncampus', 'outside', 'tracking'].includes(gpsStatus) && myShifts.length > 0 && (
                <div ref={shiftListRef} style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myShifts.map(shift => {
                    const alreadyDone   = isShiftLoggedToday(shift, todayMyLogs)
                    const inWindow      = isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)
                    const minsLeft      = minutesUntilWindow(shift.shift_start, shift.check_in_window_min || 10)
                    const isTracked     = activeTracking.some(t => t.shiftId != null ? t.shiftId === shift.id : t.shiftLabel === shift.shift_label)
                    const shiftMinsLeft = minutesToShiftEnd(shift)
                    return (
                      <div key={shift.id} style={{ background: GPAY.panelHover, borderRadius: 12, padding: 14, border: `1px solid ${alreadyDone ? GPAY.ok + '55' : isTracked ? GPAY.ok + '55' : inWindow ? GPAY.goldBorder : GPAY.panelBorder}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: GPAY.textPrimary, fontSize: 14 }}>Shift {shift.shift_label}</div>
                            <div style={{ fontSize: 12, color: GPAY.textMuted }}>{fmt12(shift.shift_start)} → {fmt12(shift.shift_end)}</div>
                            <div style={{ fontSize: 11, color: GPAY.textFaint }}>Window: ±{shift.check_in_window_min || 10} min</div>
                            {isTracked && shiftMinsLeft > 0 && (
                              <div style={{ fontSize: 11, color: GPAY.ok, fontWeight: 600, marginTop: 3 }}>🕐 {Math.max(0, Math.round(shiftMinsLeft))} min until shift end</div>
                            )}
                          </div>
                          {alreadyDone
                            ? <StatusBadge status={(todayMyLogs.find(l => l.shift_id != null ? l.shift_id === shift.id : l.shift_label === shift.shift_label))?.status || 'Present'} dark />
                            : inWindow
                              ? <button onClick={gpayRipple(() => handleCheckIn(shift))} disabled={checkingIn}
                                  style={gpayBtnStyle({ bg: gpsStatus === 'outside' ? GPAY.warn : GPAY.ok, disabled: checkingIn, size: 'sm' })} {...gpayPress}>
                                  {checkingIn ? '⏳' : gpsStatus === 'outside' ? '⚠️ Check In (Off Campus)' : '✅ Check In'}
                                </button>
                              : minsLeft > 0
                                ? <span style={{ fontSize: 12, color: GPAY.warn, fontWeight: 700 }}>Opens in {minsLeft}m</span>
                                : <span style={{ fontSize: 12, color: GPAY.textFaint, fontWeight: 600 }}>Window closed</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {['oncampus', 'outside', 'tracking'].includes(gpsStatus) && myShifts.length === 0 && (
                <div style={{ marginTop: 12, padding: 14, background: 'rgba(240,180,41,0.1)', borderRadius: 12, textAlign: 'center', fontSize: 13, color: GPAY.warn, fontWeight: 600 }}>
                  ⚠️ No shifts assigned. Contact admin.
                </div>
              )}

              {lastCheckInFailure && (
                <CheckInFailureExplainer
                  failure={lastCheckInFailure}
                  gpsDistance={gpsDistance}
                  campusRadius={campus?.radius}
                  onDismiss={() => setLastCheckInFailure(null)}
                  dark
                />
              )}
            </div>
          </div>
        )}

        {/* ══ MY HISTORY ══ */}
        {activeTab === 'history' && !isAdmin && (
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${COLOR.rule}` }}>
              <div style={{ fontWeight: 700, color: COLOR.ink, fontSize: 15 }}>📅 My Attendance History</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchMyLogs} style={S.btnSm(COLOR.slate)}>🔄 Refresh</button>
                <button onClick={() => exportCSV(myLogs.map(l => ({ ...l, staff_profiles: currentStaff })), `attendance-${today()}.csv`)} style={S.btnSm(COLOR.ink)}>⬇ Export CSV</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Date','Shift','Check-In','Check-Out','Late','Distance','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {myLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${COLOR.rule}`, background: log.session_dead ? COLOR.dangerBg : COLOR.parchmentRaised }}>
                      <td style={td}>{fmtDate(log.date)}</td>
                      <td style={td}><span style={{ fontWeight: 700, color: COLOR.ink }}>Shift {log.shift_label}</span></td>
                      <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                      <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                      <td style={{ ...td, color: log.late_minutes > 0 ? COLOR.warn : COLOR.sageDeep, fontWeight: 600 }}>{log.late_minutes > 0 ? `+${log.late_minutes}m` : '—'}</td>
                      <td style={{ ...td, color: log.is_within_zone ? COLOR.sageDeep : COLOR.danger, fontWeight: 600 }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                      <td style={td}><StatusBadge status={log.status} /></td>
                    </tr>
                  ))}
                  {myLogs.length === 0 && <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: COLOR.slate }}>No records yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ MY ADVANCES ══ */}
        {activeTab === 'advances' && !isAdmin && (
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', fontWeight: 700, color: COLOR.ink, borderBottom: `1px solid ${COLOR.rule}`, fontSize: 15 }}>💳 My Advances</div>
            {/* BUGFIX: this table had no overflowX wrapper, unlike every
                other table in this file — on a phone screen its 6 columns
                overflow with no way to scroll it into view, cutting off
                content at the screen edge. */}
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
              <thead><tr>{['Month','Amount','Repaid','Remaining','Per Month','Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).map(a => {
                  const rem = Number(a.amount) - Number(a.repaid_amount)
                  const pm  = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                      <td style={td}>{a.issued_month}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtRupee(a.amount)}</td>
                      <td style={{ ...td, color: COLOR.sageDeep, fontWeight: 600 }}>{fmtRupee(a.repaid_amount)}</td>
                      <td style={{ ...td, color: rem > 0 ? COLOR.danger : COLOR.sageDeep, fontWeight: 700 }}>{fmtRupee(rem)}</td>
                      <td style={{ ...td, color: '#6D4FA8', fontWeight: 600 }}>{rem > 0 ? fmtRupee(Math.min(pm, rem)) : '—'}</td>
                      <td style={td}><span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: a.status === 'Active' ? COLOR.warnBg : COLOR.okBg, color: a.status === 'Active' ? COLOR.warn : COLOR.sageDeep }}>{a.status}</span></td>
                    </tr>
                  )
                })}
                {advances.filter(a => String(a.staff_id) === String(currentStaff?.id)).length === 0 && (
                  <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: COLOR.slate }}>No advance records</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ══ LIVE MONITOR ══ */}
        {activeTab === 'monitor' && isAdmin && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total',        value: todayLogs.length,                                      color: COLOR.ink, icon: '📋' },
                { label: 'Present',      value: todayLogs.filter(l => l.status === 'Present').length,  color: COLOR.sageDeep, icon: '✅' },
                { label: 'Late',         value: todayLogs.filter(l => l.status === 'Late').length,     color: COLOR.warn, icon: '🕐' },
                { label: 'Early Out',    value: todayLogs.filter(l => l.status === 'EarlyOut').length, color: COLOR.danger, icon: '🏃' },
                { label: 'Session Lost', value: todayLogs.filter(l => l.session_dead).length,          color: '#6D4FA8', icon: '📵' },
                { label: 'Flagged',      value: todayLogs.filter(l => l.is_fraud_suspected).length,    color: COLOR.danger, icon: '🚨' },
              ].map(c => (
                <div key={c.label} style={{ background: COLOR.parchmentRaised, borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: 20 }}>{c.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: COLOR.ink }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: COLOR.slate }}>{c.label}</div>
                </div>
              ))}
            </div>
            <FraudScatterWidget logs={todayLogs} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: COLOR.ink2, fontSize: 15 }}>Live — {fmtDate(today())} <span style={{ fontSize: 11, color: COLOR.slate, fontWeight: 400 }}>(auto-updates)</span></div>
              <button onClick={fetchTodayLogs} style={S.btnSm(COLOR.ink)}>🔄 Refresh</button>
            </div>
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              {/* BUGFIX: 10 columns (including name+designation, two
                  timestamps, fraud badges, and two action buttons) with no
                  minWidth meant the table tried to compress to fit the
                  phone's viewport instead of scrolling properly — content
                  overlapped/clipped rather than staying readable behind a
                  horizontal scrollbar, the same way every other wide table
                  in this file already handles it. */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
                  <thead>
                    <tr>{['Staff','Shift','Check-In','Check-Out','Late','Distance','Status','Fraud','Trail','Override'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {todayLogs.map(log => (
                      <React.Fragment key={log.id}>
                        <tr style={{ borderBottom: `1px solid ${COLOR.rule}`, background: log.session_dead ? '#F3EDF7' : log.is_fraud_suspected ? COLOR.dangerBg : COLOR.parchmentRaised }}>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{log.staff_profiles?.name || '—'}</div>
                            <div style={{ fontSize: 11, color: COLOR.slate }}>{log.staff_profiles?.designation}</div>
                            {log.session_dead && <div style={{ fontSize: 10, color: '#6D4FA8', fontWeight: 700 }}>📵 session lost</div>}
                          </td>
                          <td style={td}><span style={{ fontWeight: 700, color: COLOR.ink }}>Shift {log.shift_label}</span></td>
                          <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                          <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                          <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? COLOR.warn : COLOR.slate, fontWeight: 600 }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                          <td style={{ ...td, fontWeight: 600, color: log.is_within_zone ? COLOR.sageDeep : COLOR.danger }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                          <td style={td}><StatusBadge status={log.status} /></td>
                          <td style={td}>
                            {(log.fraud_flags || []).length > 0
                              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{log.fraud_flags.map((f, i) => <FraudBadge key={i} type={f.type} />)}</div>
                              : <span style={{ color: COLOR.slate, fontSize: 12 }}>—</span>}
                          </td>
                          <td style={td}><button onClick={() => handleExpandTrail(log)} style={S.btnSm(COLOR.sage)}>{expandedTrail === log.id ? '▲ Hide' : '🗺️ Trail'}</button></td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => adminOverride(log.id, 'Present', 'Admin verified')} style={S.btnSm(COLOR.sageDeep)} title="Mark Present">✅</button>
                              <button onClick={() => adminOverride(log.id, 'Absent',  'Admin override')} style={S.btnSm(COLOR.danger)} title="Mark Absent">⭕</button>
                              <button onClick={() => editingTimeId === log.id ? setEditingTimeId(null) : startEditTime(log)} style={S.btnSm(COLOR.ink)} title="Fix check-in/out time">✏️</button>
                            </div>
                          </td>
                        </tr>
                        {editingTimeId === log.id && (
                          <tr style={{ background: COLOR.parchment }}>
                            <td colSpan="10" style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <div style={{ fontSize: 11, color: COLOR.slate, marginBottom: 2 }}>Check-in</div>
                                  <input type="datetime-local" value={editTimeForm.check_in}
                                    onChange={e => setEditTimeForm(f => ({ ...f, check_in: e.target.value }))}
                                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${COLOR.rule}` }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: COLOR.slate, marginBottom: 2 }}>Check-out</div>
                                  <input type="datetime-local" value={editTimeForm.check_out}
                                    onChange={e => setEditTimeForm(f => ({ ...f, check_out: e.target.value }))}
                                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${COLOR.rule}` }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: COLOR.slate, marginBottom: 2 }}>Status</div>
                                  <select value={editTimeForm.status} onChange={e => setEditTimeForm(f => ({ ...f, status: e.target.value }))}
                                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${COLOR.rule}` }}>
                                    {['Present','Late','EarlyOut','Absent','Flagged'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 160 }}>
                                  <div style={{ fontSize: 11, color: COLOR.slate, marginBottom: 2 }}>Reason (audit note)</div>
                                  <input type="text" value={editTimeForm.note} placeholder="e.g. GPS failed, device issue"
                                    onChange={e => setEditTimeForm(f => ({ ...f, note: e.target.value }))}
                                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${COLOR.rule}`, width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <button onClick={() => saveEditTime(log)} disabled={savingTimeEdit} style={S.btnSm(COLOR.sageDeep)}>{savingTimeEdit ? '⏳' : '💾 Save'}</button>
                                <button onClick={() => setEditingTimeId(null)} style={S.btnSm(COLOR.slate)}>Cancel</button>
                              </div>
                              <div style={{ fontSize: 10.5, color: COLOR.slate, marginTop: 6 }}>Leaving a time field blank clears it. This edit is logged as an admin override on the attendance record itself.</div>
                            </td>
                          </tr>
                        )}
                        {expandedTrail === log.id && (
                          <tr style={{ background: COLOR.parchment }}>
                            <td colSpan="10" style={{ padding: '0 16px 16px' }}>
                              <ShiftTimeline trail={trailMap[log.id] || []} shift={logShiftMap[log.id]} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {todayLogs.length === 0 && <tr><td colSpan="10" style={{ padding: 40, textAlign: 'center', color: COLOR.slate }}>No check-ins yet today</td></tr>}
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
              <h2 style={{ fontSize: 17, fontWeight: 700, color: COLOR.danger, margin: 0 }}>🚨 Unresolved Fraud Alerts</h2>
              <button onClick={fetchFraudLogs} style={S.btnSm(COLOR.danger)}>🔄 Refresh</button>
            </div>
            {fraudLogs.length === 0 && (
              <div style={{ ...S.card, textAlign: 'center', color: COLOR.sageDeep, padding: 48 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700 }}>No unresolved fraud alerts</div>
              </div>
            )}
            {fraudLogs.map(fl => (
              <div key={fl.id} style={{ ...S.card, border: `1px solid ${FRAUD_TYPES[fl.fraud_type]?.color || COLOR.danger}44`, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <FraudBadge type={fl.fraud_type} />
                      <span style={{ fontSize: 12, color: COLOR.slate }}>{fmtDate(fl.date)} · Shift {fl.shift_label}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: COLOR.ink2 }}>{fl.staff_profiles?.name}</div>
                    <div style={{ fontSize: 12, color: COLOR.slate }}>{fl.staff_profiles?.designation}</div>
                    <div style={{ marginTop: 8, padding: '8px 12px', background: COLOR.parchment, borderRadius: 8, fontSize: 13, color: COLOR.ink2 }}>{fl.detail}</div>
                    {fl.lat && <div style={{ fontSize: 11, color: COLOR.slate, marginTop: 4 }}>GPS: {fl.lat?.toFixed(6)}, {fl.lng?.toFixed(6)} · ±{fl.accuracy}m</div>}
                    {/* FIX 2: show warning when attendance_id is missing (pre-migration rows) */}
                    {!fl.attendance_id && <div style={{ fontSize: 11, color: COLOR.warn, marginTop: 4, fontWeight: 600 }}>⚠️ No linked attendance record — status override unavailable</div>}
                  </div>
                  <div style={{ fontSize: 12, color: COLOR.slate }}>{new Date(fl.created_at).toLocaleTimeString('en-IN')}</div>
                </div>
                {resolvingId === fl.id ? (
                  <div style={{ marginTop: 14, padding: 14, background: COLOR.parchment, borderRadius: 10 }}>
                    <label style={S.label}>Resolution Note *</label>
                    <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={2}
                      placeholder="Explain resolution..." style={{ ...S.input, resize: 'vertical', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => resolveFraud(fl.id, 'approve')} style={S.btn(COLOR.sageDeep)}>✅ Approve (Keep Status)</button>
                      {/* FIX 2: disable "Mark Absent" when no linked attendance_id */}
                      <button onClick={() => resolveFraud(fl.id, 'absent')} disabled={!fl.attendance_id}
                        style={S.btn(COLOR.danger, !fl.attendance_id)} title={!fl.attendance_id ? 'No linked attendance record' : ''}>
                        ❌ Mark Absent
                      </button>
                      <button onClick={() => { setResolvingId(null); setResolveNote('') }} style={S.btn(COLOR.slate)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setResolvingId(fl.id)} style={{ ...S.btnSm(COLOR.ink), marginTop: 12 }}>🔍 Review & Resolve</button>
                )}
              </div>
            ))}
          </>
        )}

        {/* ══ SHIFT SETUP ══ */}
        {activeTab === 'shifts' && isAdmin && (
          <div style={{ maxWidth: allShiftsView === 'list' ? 900 : 640 }}>
            {safeAllStaff.length === 0 && (
              <div style={{ padding: '12px 16px', background: COLOR.warnBg, border: `1px solid ${COLOR.warn}44`, borderRadius: 10, marginBottom: 16, fontSize: 13, color: COLOR.warn, fontWeight: 600 }}>
                ⚠️ No staff loaded — pass the <code>allStaff</code> prop.
              </div>
            )}

            {/* ── View toggle: All Staff Shifts (overview table) vs Editor (bulk-assign + single-staff) ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button onClick={() => setAllShiftsView('list')} style={S.tab(allShiftsView === 'list')}>📋 All Staff Shifts</button>
              <button onClick={() => setAllShiftsView('editor')} style={S.tab(allShiftsView === 'editor')}>✏️ Assign / Edit</button>
            </div>

            {allShiftsView === 'list' ? (
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: COLOR.ink, margin: 0 }}>📋 All Staff Shifts</h2>
                    <p style={{ fontSize: 12, color: COLOR.slate, margin: '4px 0 0' }}>Every active shift across every staff member, in one place — useful for spotting a bad entry (e.g. an end time typed as AM instead of PM) that's easy to miss when viewing one staff member at a time.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={shiftSearch} onChange={e => setShiftSearch(e.target.value)} placeholder="Search name or shift label…" style={{ ...S.input, width: 220 }} />
                    <button onClick={fetchAllShifts} style={S.btnSm(COLOR.slate)}>🔄 Refresh</button>
                  </div>
                </div>

                {loadingAllShifts ? (
                  <p style={{ textAlign: 'center', color: COLOR.slate, padding: 24 }}>Loading…</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>{['Staff', 'Shift', 'Start', 'End', 'Duration', 'Window', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {allShiftsRows
                          .filter(r => {
                            if (!shiftSearch.trim()) return true
                            const q = shiftSearch.trim().toLowerCase()
                            return r._staffName.toLowerCase().includes(q) || (r.shift_label || '').toLowerCase().includes(q)
                          })
                          .map(r => {
                            // Flag anything under 2 hours or over 16 hours as
                            // worth a second look — real shifts here run
                            // roughly 5-8 hours; either extreme is far more
                            // likely to be an AM/PM slip than an intentional
                            // shift length.
                            const [sh, sm] = (r.shift_start || '0:0').split(':').map(Number)
                            const [eh, em] = (r.shift_end || '0:0').split(':').map(Number)
                            let durMin = (eh * 60 + em) - (sh * 60 + sm)
                            if (durMin < 0) durMin += 1440 // wraps past midnight
                            const suspicious = durMin < 120 || durMin > 960
                            return (
                              <tr key={r.id} style={{ borderBottom: `1px solid ${COLOR.rule}`, background: suspicious ? COLOR.dangerBg : 'transparent' }}>
                                <td style={td}>
                                  <div style={{ fontWeight: 600 }}>{r._staffName}</div>
                                  <div style={{ fontSize: 11, color: COLOR.slate }}>{r._staffDesignation}</div>
                                </td>
                                <td style={td}>{r.shift_label}</td>
                                <td style={td}>{fmt12(r.shift_start)}</td>
                                <td style={{ ...td, color: suspicious ? COLOR.danger : COLOR.ink, fontWeight: suspicious ? 700 : 400 }}>{fmt12(r.shift_end)}</td>
                                <td style={{ ...td, color: suspicious ? COLOR.danger : COLOR.slate }}>
                                  {suspicious && '⚠️ '}{Math.floor(durMin / 60)}h {durMin % 60}m
                                </td>
                                <td style={td}>±{r.check_in_window_min || 10}m</td>
                                <td style={td}>
                                  <button onClick={() => { setSelectedStaff(String(r.staff_id)); setAllShiftsView('editor') }} style={S.btnSm(COLOR.ink)}>Edit</button>
                                </td>
                              </tr>
                            )
                          })}
                        {allShiftsRows.length === 0 && (
                          <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: COLOR.slate }}>No active shifts found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
            <>

            {/* ── Bulk Assign Shift — one shift definition, many staff at once ── */}
            <div style={{ ...S.card, marginBottom: 20, border: `1.5px solid ${COLOR.sage}55`, background: `${COLOR.sage}0f` }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: COLOR.sageDeep, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚡ Bulk Assign Shift
              </h2>
              <p style={{ fontSize: 12.5, color: COLOR.sageDeep, marginTop: -4, marginBottom: 16 }}>
                Set one shift and apply it to multiple staff in a single save — useful for initial setup when most staff share the same timing.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>Shift Label</label>
                  <input type="text" placeholder="e.g. Morning" value={bulkShiftForm.shift_label}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_label: e.target.value }))}
                    style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }} />
                </div>
                <div>
                  <label style={S.label}>Grace Window (min)</label>
                  <input type="number" min="5" max="60" value={bulkShiftForm.check_in_window_min}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, check_in_window_min: e.target.value }))}
                    style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }} />
                </div>
                <div>
                  <label style={S.label}>Shift Start</label>
                  <input type="time" value={bulkShiftForm.shift_start}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_start: e.target.value }))}
                    style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }} />
                </div>
                <div>
                  <label style={S.label}>Shift End</label>
                  <input type="time" value={bulkShiftForm.shift_end}
                    onChange={e => setBulkShiftForm(prev => ({ ...prev, shift_end: e.target.value }))}
                    style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={S.label}>Apply To ({bulkStaffIds.size} selected)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAllBulkStaff} style={{ ...S.btn(COLOR.sage), padding: '4px 10px', fontSize: 12 }}>Select All</button>
                  <button onClick={clearAllBulkStaff} style={{ ...S.btn(COLOR.slate), padding: '4px 10px', fontSize: 12 }}>Clear</button>
                </div>
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto', background: COLOR.parchmentRaised, border: `1px solid ${COLOR.sage}55`, borderRadius: 8, padding: 8, marginBottom: 14 }}>
                {safeAllStaff.length === 0 && <div style={{ fontSize: 13, color: COLOR.slate, padding: 8 }}>No staff to show.</div>}
                {safeAllStaff.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="checkbox" checked={bulkStaffIds.has(String(s.id))} onChange={() => toggleBulkStaff(s.id)} />
                    <span>{s.name} — <span style={{ color: COLOR.slate }}>{s.designation}</span></span>
                  </label>
                ))}
              </div>

              <button onClick={saveBulkShift} disabled={savingBulkShift} style={S.btn(COLOR.sageDeep, savingBulkShift)}>
                {savingBulkShift ? '⏳ Assigning…' : `💾 Assign Shift to ${bulkStaffIds.size || 0} Staff`}
              </button>
              <p style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 10, marginBottom: 0 }}>
                This adds a new shift for each selected staff member who doesn't already have one with this exact label — it won't create duplicates, but it also won't edit an existing shift's times. Use the single-staff editor below to edit times or remove a shift.
              </p>
            </div>

            <div style={S.card}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: COLOR.ink, marginTop: 0 }}>⏰ Shift Configuration</h2>
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>Select Staff Member</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }}>
                  <option value="">— Select Staff —</option>
                  {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                </select>
              </div>
              {selectedStaff && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {shiftForms.map((sf, i) => (
                      <div key={sf.id || i} style={{ background: COLOR.parchment, borderRadius: 10, padding: 14, border: `1px solid ${!sf.shift_label ? COLOR.danger : COLOR.rule}` }}>
                        {!sf.shift_label && (
                          <div style={{ fontSize: 11, color: COLOR.danger, fontWeight: 700, marginBottom: 8 }}>⚠️ Missing label — this shift won't save until you fill it in</div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
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
                          <span style={{ fontSize: 12, color: COLOR.slate }}>{fmt12(sf.shift_start)} → {fmt12(sf.shift_end)} · window ±{sf.check_in_window_min || 10}m</span>
                          <button onClick={() => deleteShift(sf.id)} style={{ ...S.btnSm(COLOR.danger), marginLeft: 'auto' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShiftForms(prev => [...prev, { id: 'new-' + Date.now(), shift_label: '', shift_start: '08:00', shift_end: '14:00', check_in_window_min: 10 }])} style={S.btn(COLOR.sage)}>+ Add Shift</button>
                    <button onClick={saveShifts} disabled={savingShifts} style={S.btn(COLOR.sageDeep, savingShifts)}>{savingShifts ? '⏳ Saving...' : '💾 Save All'}</button>
                  </div>
                </>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ══ CAMPUS ZONE ══ */}
        {activeTab === 'campus' && isAdmin && (
          <div style={{ maxWidth: 520 }}>
            <div style={S.card}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: COLOR.ink, marginTop: 0 }}>🗺️ Campus Geofence</h2>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLOR.slate }}>
                    <span>30m (strict)</span><span style={{ fontWeight: 700, color: COLOR.ink, fontSize: 15 }}>{campusForm.radius}m</span><span>500m (lenient)</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: COLOR.okBg, borderRadius: 8, margin: '16px 0', fontSize: 12, color: COLOR.sageDeep }}>
                💡 Tip: Use Google Maps to find your exact lat/lng. Right-click → "What's here?"
              </div>
              {campus && (
                <div style={{ padding: '10px 14px', background: COLOR.okBg, borderRadius: 8, marginBottom: 16, fontSize: 13, color: COLOR.sageDeep, fontWeight: 600 }}>
                  ✅ Active: {campus.name} · {campus.lat}, {campus.lng} · {campus.radius}m radius
                </div>
              )}
              <button onClick={saveCampus} disabled={savingCampus} style={{ ...S.btn(COLOR.ink, savingCampus), width: '100%', padding: 13 }}>
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
                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${COLOR.rule}`, fontSize: 14 }} />
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={S.label}>Staff</label>
                <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor: COLOR.parchmentRaised }}>
                  <option value="">All Staff</option>
                  {safeAllStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={fetchMonthLogs} style={S.btn(COLOR.ink)} disabled={loadingMonth}>{loadingMonth ? '⏳' : '🔄 Load'}</button>
              <button onClick={() => exportCSV(monthLogs, `report-${monthFilter}.csv`)} style={S.btn(COLOR.sage)} disabled={!monthLogs.length}>⬇ Export CSV</button>
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
      <div style={{ padding: '14px 16px', fontWeight: 700, color: COLOR.ink, borderBottom: `1px solid ${COLOR.rule}` }}>Staff Summary — {monthFilter}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr>{['Staff','Total','Present','Late','Late Min','Early Out','Absent','Flagged','Rate'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map(r => {
                          const rate = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
                          return (
                            <tr key={r.name} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                              <td style={td}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: COLOR.slate }}>{r.designation}</div></td>
                              <td style={td}>{r.total}</td>
                              <td style={{ ...td, color: COLOR.sageDeep, fontWeight: 700 }}>{r.present}</td>
                              <td style={{ ...td, color: COLOR.warn, fontWeight: 700 }}>{r.late}</td>
                              <td style={{ ...td, color: r.totalLateMin > 0 ? COLOR.warn : COLOR.slate, fontWeight: 600 }}>{r.totalLateMin > 0 ? `${r.totalLateMin}m` : '—'}</td>
                              <td style={{ ...td, color: COLOR.danger, fontWeight: 700 }}>{r.earlyOut}</td>
                              <td style={{ ...td, color: COLOR.danger, fontWeight: 700 }}>{r.absent}</td>
                              <td style={{ ...td, color: COLOR.danger, fontWeight: 700 }}>{r.flagged}</td>
                              <td style={td}><span style={{ fontWeight: 800, color: rate >= 90 ? COLOR.sageDeep : rate >= 70 ? COLOR.warn : COLOR.danger }}>{rate}%</span></td>
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
                        <tr key={log.id} style={{ borderBottom: `1px solid ${COLOR.rule}`, background: log.session_dead ? '#F3EDF7' : log.is_fraud_suspected ? COLOR.dangerBg : COLOR.parchmentRaised }}>
                          <td style={td}>{fmtDate(log.date)}</td>
                          <td style={td}><div style={{ fontWeight: 600 }}>{log.staff_profiles?.name || '—'}</div></td>
                          <td style={td}><span style={{ fontWeight: 700, color: COLOR.ink }}>Shift {log.shift_label}</span></td>
                          <td style={td}>{fmtTime(log.server_check_in_time  || log.check_in_time)}</td>
                          <td style={td}>{fmtTime(log.server_check_out_time || log.check_out_time)}</td>
                          <td style={{ ...td, color: (log.late_minutes || 0) > 0 ? COLOR.warn : COLOR.slate, fontWeight: 600 }}>{(log.late_minutes || 0) > 0 ? `+${log.late_minutes}m` : '—'}</td>
                          <td style={{ ...td, color: log.is_within_zone ? COLOR.sageDeep : COLOR.danger, fontWeight: 600 }}>{log.distance_from_campus !== null ? `${Math.round(log.distance_from_campus)}m` : '—'}</td>
                          <td style={td}><StatusBadge status={log.status} /></td>
                          <td style={td}>{(log.fraud_flags || []).length > 0 ? (log.fraud_flags || []).map((f, i) => <FraudBadge key={i} type={f.type} />) : <span style={{ color: COLOR.slate, fontSize: 11 }}>—</span>}</td>
                        </tr>
                      ))
                    }
                    {!loadingMonth && monthLogs.length === 0 && <tr><td colSpan="9" style={{ padding: 40, textAlign: 'center', color: COLOR.slate }}>No records — click Load</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {faceCaptureShift && (
        <FaceCapture
          staffId={punchTarget?.id || currentStaff?.id}
          onVerified={(faceResult) => performCheckIn(faceCaptureShift, faceResult)}
          onCancel={() => setFaceCaptureShift(null)}
        />
      )}

      {checkoutPending && (
        <FaceCapture
          staffId={punchTarget?.id || currentStaff?.id}
          onVerified={(faceResult) => performCheckOut(checkoutPending.logId, checkoutPending.shiftLabel, faceResult)}
          // Face scan is mandatory for checkout, same as check-in — Cancel
          // here genuinely cancels the checkout attempt (stays punched in),
          // it does not skip the scan and check out anyway.
          onCancel={() => setCheckoutPending(null)}
        />
      )}

      {successOverlay && (
        <SuccessOverlay
          kind={successOverlay.kind}
          label={successOverlay.label}
          onDone={() => setSuccessOverlay(null)}
        />
      )}
    </ErrorBoundary>
  )
}
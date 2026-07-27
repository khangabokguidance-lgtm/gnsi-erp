// ══════════════════════════════════════════════════════════════
//  LEAVE TAB — v5
//  Cat 1: CRUD  Cat 2: Filtering  Cat 3: Approval Workflow
//  Cat 4: Leave Balance  Cat 5: Gate Pass
//  Cat 6: Return Tracking  Cat 7: Calendar
//  Cat 8: Analytics  Cat 9: Notifications
//  Cat 10: Student Self-Service (request + status check)
// ══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { sendPushToStaffId, notifyHousemasterByName, notifyHousemasterByHouse } from './notifications'

// ── Shared styles (copy from Hostel.jsx or import from a shared file)
const inp = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #d1d5db', fontSize: '16px',
  boxSizing: 'border-box', backgroundColor: 'white',
  minHeight: '44px',
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}
const btn = (bg = '#1e3a5f', c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: '10px',
  padding: '12px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  minHeight: '44px', minWidth: '44px',
})
const card = {
  background: 'white', borderRadius: '14px', padding: '16px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
}
const mobileCard = { ...card, padding: '12px', borderRadius: '12px' }
const grid2 = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '14px',
}
const mobileStatGrid = {
  display: 'grid', gridTemplateColumns: '1fr 1fr',
  gap: '8px', marginBottom: '16px',
}

const isMobile = () => window.innerWidth < 768

function useMobileView() {
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const h = () => setMobile(isMobile())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

function getStudentClass(s) {
  if (!s) return ''
  const batch = (s.batch || '').trim()
  const cls = (s.class_name || '').trim()
  if (batch && batch !== '???') return batch
  if (cls && cls !== '???') return cls
  return ''
}

const today = () => new Date().toISOString().split('T')[0]

// ── Status style pill
// ── Approval level → display label + style
//   level 0 + Pending  = ⏳ Pending HM
//   level 1 + Pending  = 🔵 Pending Superintendent
//   level 2 + Approved = ✅ Fully Approved
//   Rejected           = ❌ Rejected
//   Overdue            = ⚠️ Overdue
//   Returned           = 🏠 Returned
function getApprovalDisplay(record) {
  const level  = record.approval_level ?? 0
  const status = record.status || 'Pending'
  if (status === 'Rejected') return { label: '❌ Rejected',                bg: '#fee2e2', color: '#dc2626' }
  if (status === 'Overdue')  return { label: '⚠️ Overdue',                bg: '#fee2e2', color: '#dc2626' }
  if (status === 'Returned') return { label: '🏠 Returned',               bg: '#eff6ff', color: '#1e3a5f' }
  if (status === 'Approved' && level >= 2)
                             return { label: '✅ Fully Approved',          bg: '#dcfce7', color: '#16a34a' }
  if (level === 1)           return { label: '🔵 Pending Superintendent',  bg: '#dbeafe', color: '#1d4ed8' }
  return                            { label: '⏳ Pending HM',              bg: '#fef9c3', color: '#ca8a04' }
}

function ApprovalBadge({ record, style = {} }) {
  const d = getApprovalDisplay(record)
  return (
    <span style={{
      padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
      fontWeight: '700', backgroundColor: d.bg, color: d.color,
      whiteSpace: 'nowrap', display: 'inline-block', ...style,
    }}>
      {d.label}
    </span>
  )
}

function statusStyle(status) {
  const map = {
    Pending:   { bg: '#fef9c3', color: '#ca8a04' },
    Approved:  { bg: '#dcfce7', color: '#16a34a' },
    Rejected:  { bg: '#fee2e2', color: '#dc2626' },
    Overdue:   { bg: '#fee2e2', color: '#dc2626' },
    Returned:  { bg: '#eff6ff', color: '#1e3a5f' },
  }
  const s = map[status] || { bg: '#e0f2fe', color: '#0891b2' }
  return {
    padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
    fontWeight: '600', backgroundColor: s.bg, color: s.color,
    whiteSpace: 'nowrap', display: 'inline-block',
  }
}

// ── Compact stat card
function StatCard({ icon, label, value, color, bg, compact = false }) {
  return (
    <div style={{
      backgroundColor: bg, borderRadius: compact ? '10px' : '12px',
      padding: compact ? '10px 12px' : '18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderLeft: `${compact ? 3 : 4}px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: compact ? '18px' : '22px' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '11px', color, fontWeight: '600', margin: 0, lineHeight: 1.2 }}>{label}</p>
        <h2 style={{ fontSize: compact ? '20px' : '26px', fontWeight: 'bold', color, margin: '2px 0 0', lineHeight: 1.2 }}>{value}</h2>
      </div>
    </div>
  )
}

// ── Student search dropdown
function StudentSearchInput({ students, onSelect, placeholder = 'Type name or GCC No...' }) {
  const [query, setQuery] = useState('')
  const mobile = useMobileView()

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return students
      .filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        String(s.gcc_no || '').includes(q) ||
        (s.batch || '').toLowerCase().includes(q)
      )
      .slice(0, mobile ? 5 : 8)
  }, [query, students, mobile])

  const select = s => { onSelect(s); setQuery('') }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        style={inp}
        type="search"
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #d1d5db', borderRadius: '10px',
          zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: mobile ? 180 : 220, overflowY: 'auto', marginTop: '4px',
        }}>
          {matches.map(s => (
            <div
              key={s.id}
              onClick={() => select(s)}
              style={{
                padding: mobile ? '12px 14px' : '10px 14px',
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                fontSize: '14px', minHeight: '44px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: '#1e293b' }}>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {s.gcc_no ? `GCC-${s.gcc_no}` : '—'} · {getStudentClass(s) || '—'}
                  {s.house ? ` · 🏠 ${s.house}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Mobile card list wrappers
const MobileCardList = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
)
const MobileRecordCard = ({ children, accentColor = '#1e3a5f' }) => (
  <div style={{
    background: 'white', borderRadius: '12px', padding: '14px',
    borderLeft: `4px solid ${accentColor}`,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  }}>
    {children}
  </div>
)
const MobileActionButtons = ({ actions }) => (
  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
    {actions.map((action, i) => (
      <button
        key={i}
        onClick={action.onClick}
        style={{
          flex: action.fullWidth ? '1 1 100%' : '1 1 auto',
          padding: '8px 12px', borderRadius: '8px', border: 'none',
          background: action.bg || '#eff6ff',
          color: action.color || '#1e3a5f',
          fontSize: '12px', fontWeight: '700',
          cursor: 'pointer', minHeight: '36px',
        }}
      >
        {action.label}
      </button>
    ))}
  </div>
)

// ══════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════
const LEAVE_TYPES = ['Home Leave', 'Day Outing', 'Night Out', 'Weekend Leave', 'Emergency']
const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Overdue', 'Returned']
const APPROVAL_LEVELS = { HM: 0, SUPERINTENDENT: 1, APPROVED: 2 }

// ── Default quotas per leave type (-1 = unlimited)
const DEFAULT_QUOTAS = {
  'Home Leave':    4,
  'Day Outing':    6,
  'Night Out':     2,
  'Weekend Leave': 2,
  'Emergency':    -1,  // unlimited
}

// ── Current academic year helper  e.g. "2024-25"
const currentAcademicYear = () => {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() + 1
  // Academic year starts April
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`
}

// ══════════════════════════════════════════════════════════════
//  GATE PASS CONSTANTS
// ══════════════════════════════════════════════════════════════
const GNSI_NAME    = 'Guidance Navodaya & Sainik Institute'
const GNSI_ADDRESS = 'Khangabok, Thoubal, Manipur — 795134'
// Phone is no longer hardcoded — it's pulled from notification_config
// (same single-row settings table already used for MSG91 config) so it
// can be updated from the admin panel without a code change. Falls back
// to this placeholder only if the config row has no phone set yet.
const GNSI_PHONE_FALLBACK = '+91-XXXXXXXXXX'

async function getSchoolContact() {
  try {
    const { data } = await supabase.from('notification_config').select('school_phone').maybeSingle()
    return data?.school_phone?.trim() || GNSI_PHONE_FALLBACK
  } catch (e) {
    console.error('getSchoolContact failed:', e)
    return GNSI_PHONE_FALLBACK
  }
}
const VERIFY_BASE  = 'https://guidancekhangabok.in/verify'

// Gate pass number format: GP-YYYY-NNNN
const formatGPNo = (seq) => {
  const year = new Date().getFullYear()
  return `GP-${year}-${String(seq).padStart(4, '0')}`
}

// ══════════════════════════════════════════════════════════════
//  RETURN TRACKING HELPERS
// ══════════════════════════════════════════════════════════════
const OVERSTAY_THRESHOLD_MS = 2 * 60 * 60 * 1000  // 2 hours in ms

// Returns { hours, minutes, totalMs, isOverstay } or null
function calcOverstay(expectedReturn, actualReturn) {
  if (!expectedReturn || !actualReturn) return null
  const expected = new Date(expectedReturn).getTime()
  const actual   = new Date(actualReturn).getTime()
  const diffMs   = actual - expected
  if (diffMs <= 0) return { hours: 0, minutes: 0, totalMs: diffMs, isOverstay: false }
  const hours   = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return { hours, minutes, totalMs: diffMs, isOverstay: diffMs > OVERSTAY_THRESHOLD_MS }
}

// Human-readable overstay string e.g. "3h 20m"
function fmtOverstay({ hours, minutes }) {
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

// ══════════════════════════════════════════════════════════════
//  CALENDAR CONSTANTS
// ══════════════════════════════════════════════════════════════
const WEEKDAYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// Threshold: warn when >= this % of house students are out on same day
const THRESHOLD_PCT = 10

// Leave type → color map for calendar chips
const LEAVE_TYPE_COLORS = {
  'Home Leave':    { bg: '#dbeafe', color: '#1d4ed8', dot: '#1d4ed8' },
  'Day Outing':    { bg: '#dcfce7', color: '#16a34a', dot: '#16a34a' },
  'Night Out':     { bg: '#f5f3ff', color: '#7c3aed', dot: '#7c3aed' },
  'Weekend Leave': { bg: '#fef9c3', color: '#ca8a04', dot: '#ca8a04' },
  'Emergency':     { bg: '#fee2e2', color: '#dc2626', dot: '#dc2626' },
}
const leaveTypeColor = (type) =>
  LEAVE_TYPE_COLORS[type] || { bg: '#e0f2fe', color: '#0891b2', dot: '#0891b2' }

// ══════════════════════════════════════════════════════════════
//  ANALYTICS HELPERS
// ══════════════════════════════════════════════════════════════

// Academic months order (April-start)
const ACADEMIC_MONTHS = [
  'Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'
]

// Map month number (0-based) → academic month label
const monthLabel = (m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]

// Approval rate for a set of records
const approvalRate = (recs) => {
  const total    = recs.length
  const approved = recs.filter(r => r.status === 'Approved' || (r.approval_level ?? 0) >= 2).length
  return total > 0 ? Math.round(approved / total * 100) : 0
}

// Average leave duration in days
const avgDuration = (recs) => {
  const withDates = recs.filter(r => r.from_date && r.to_date)
  if (withDates.length === 0) return 0
  const total = withDates.reduce((sum, r) => {
    const days = Math.ceil((new Date(r.to_date) - new Date(r.from_date)) / (1000 * 60 * 60 * 24)) + 1
    return sum + days
  }, 0)
  return (total / withDates.length).toFixed(1)
}

// Overdue rate
const overdueRate = (recs) => {
  const returned = recs.filter(r => ['Returned', 'Overdue'].includes(r.status))
  const overdue  = recs.filter(r => r.status === 'Overdue' ||
    (r.status === 'Returned' && r.actual_return && r.expected_return && new Date(r.actual_return) > new Date(r.expected_return) + 2 * 60 * 60 * 1000))
  return returned.length > 0 ? Math.round(overdue.length / returned.length * 100) : 0
}

// Chart color palette
const CHART_COLORS = ['#1d4ed8','#16a34a','#7c3aed','#ca8a04','#dc2626','#0891b2','#be185d','#047857']

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION ENGINE CONSTANTS
// ══════════════════════════════════════════════════════════════

// Trigger events that fire notifications
export const NOTIF_TRIGGERS = {
  APPROVED:  'approved',   // Feature 54: SMS on approval
  REJECTED:  'rejected',   // Feature 55: SMS on rejection
  RETURNED:  'returned',   // Feature 56: SMS on return
  OVERDUE:   'overdue',    // Feature 57: overdue alert SMS
}

// Default message templates (Feature 59)
// Placeholders: {name} {leave_type} {from_date} {to_date} {expected_return} {hm_name} {hm_phone} {school}
const DEFAULT_TEMPLATES = {
  [NOTIF_TRIGGERS.APPROVED]: "Dear Parent, {name}'s {leave_type} from {from_date} to {to_date} has been APPROVED. Expected return: {expected_return}. — {school}",
  [NOTIF_TRIGGERS.REJECTED]: "Dear Parent, {name}'s {leave_type} request (from {from_date}) has been REJECTED. Please contact HM for details. — {school}",
  [NOTIF_TRIGGERS.RETURNED]: "Dear Parent, {name} has returned safely from {leave_type} on {actual_return}. — {school}",
  [NOTIF_TRIGGERS.OVERDUE]:  "URGENT: {name} was due to return from {leave_type} on {expected_return} but has NOT checked in. Contact HM: {hm_phone}. — {school}",
}

// Fill template placeholders from a leave record
function fillTemplate(template, record, hmName = '', hmPhone = '') {
  const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  return template
    .replace(/{name}/g,            record.student_name || '—')
    .replace(/{leave_type}/g,      record.leave_type   || '—')
    .replace(/{from_date}/g,       record.from_date    || '—')
    .replace(/{to_date}/g,         record.to_date      || '—')
    .replace(/{expected_return}/g, fmt(record.expected_return))
    .replace(/{actual_return}/g,   fmt(record.actual_return))
    .replace(/{hm_name}/g,         hmName              || 'HM')
    .replace(/{hm_phone}/g,        hmPhone             || 'N/A')
    .replace(/{school}/g,          GNSI_NAME)
}

// ── MSG91 SMS sender (India)
// Set your MSG91 auth key in Supabase secrets or env — we read it from DB config
async function sendSMS(phone, message) {
  // Fetch API key from notification_config table
  const { data: cfg } = await supabase
    .from('notification_config')
    .select('msg91_auth_key, sender_id')
    .single()

  if (!cfg?.msg91_auth_key) {
    console.warn('MSG91 auth key not configured — SMS not sent')
    return { success: false, reason: 'not_configured' }
  }

  // Sanitize phone — ensure 10-digit Indian number
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10)
  if (cleanPhone.length !== 10) {
    return { success: false, reason: 'invalid_phone' }
  }

  try {
    const res = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authkey': cfg.msg91_auth_key },
      body: JSON.stringify({
        sender: cfg.sender_id || 'GNSI',
        route:  '4',   // transactional route
        mobiles: `91${cleanPhone}`,
        message,
      }),
    })
    const json = await res.json()
    return { success: json.type === 'success', raw: json }
  } catch (err) {
    return { success: false, reason: 'network_error', err: err.message }
  }
}

// ── Log notification to DB (Feature 58)
async function logNotification(leaveId, studentName, phone, trigger, message, result) {
  await supabase.from('notification_logs').insert([{
    leave_id:     leaveId,
    student_name: studentName,
    phone,
    trigger,
    message,
    status:       result.success ? 'sent' : result.reason === 'not_configured' ? 'skipped' : 'failed',
    sent_at:      new Date().toISOString(),
    raw_response: result.raw ? JSON.stringify(result.raw) : null,
  }])
}

// ── Main notification dispatcher
// Called after every status change; looks up template, fills it, sends SMS, logs
export async function dispatchNotification(trigger, record, hmName = '', hmPhone = '') {
  const phone = record.parent_contact
  if (!phone) return  // no phone — skip silently

  // Load template from DB (admin may have edited it)
  const { data: tpl } = await supabase
    .from('notification_templates')
    .select('message_template, is_active')
    .eq('trigger_event', trigger)
    .maybeSingle()

  // Use DB template if active, else fall back to default
  const isActive = tpl?.is_active !== false
  if (!isActive) return  // template disabled

  const template = tpl?.message_template || DEFAULT_TEMPLATES[trigger] || ''
  if (!template) return

  const message = fillTemplate(template, record, hmName, hmPhone)
  const result  = await sendSMS(phone, message)
  await logNotification(record.id, record.student_name, phone, trigger, message, result)
  return result
}

// ══════════════════════════════════════════════════════════════
//  STAFF ALERTS — Overdue Return & Stuck Pending Approval
//  Notifies the Housemaster or Superintendent (not the parent) via
//  push (reusing Hostel.jsx's VAPID infrastructure) and WhatsApp
//  (wa.me text link — instant, no image needed for a short alert).
// ══════════════════════════════════════════════════════════════

// Superintendent is a single shared staff_profiles account with role
// = 'Superintendent'. Falls back gracefully (no throw) if none exists.
async function getSuperintendentStaff() {
  try {
    const { data } = await supabase
      .from('staff_profiles')
      .select('id, name, phone')
      .ilike('role', 'superintendent')
      .maybeSingle()
    return data || null
  } catch (e) {
    console.error('getSuperintendentStaff failed:', e)
    return null
  }
}

async function notifySuperintendent(title, body, url = '/hostel?tab=leave') {
  const supt = await getSuperintendentStaff()
  if (!supt?.id) {
    console.warn('notifySuperintendent: no staff_profiles row with role=Superintendent')
    return null
  }
  await sendPushToStaffId(supt.id, title, body, url)
  return supt
}

// Opens a WhatsApp chat pre-filled with the alert text. wa.me can't be
// triggered silently in the background (it's a user-facing navigation),
// so this returns the URL for the caller to open via window.open —
// callers should only do this in response to a direct user action, or
// accept that automatic background triggers will just log the message
// rather than force-open a WhatsApp tab without the user asking for it.
function buildWhatsAppLink(phone, message) {
  const cleanPhone = String(phone || '').replace(/\D/g, '')
  const target = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`
}

// ── Overdue Return alert → Housemaster of the student's house.
// Push fires automatically (background-safe). WhatsApp link is returned
// so the UI can offer a "📲 Notify via WhatsApp" button rather than
// force-opening a tab with no user gesture behind it.
async function alertHousemasterOverdue(record) {
  const house = record.house
  if (!house) return null
  const title = `🚨 Overdue Return — ${record.student_name}`
  const body = `${record.student_name} (${house}) was due back ${
    record.expected_return ? new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'earlier'
  } and has not checked in.`
  await notifyHousemasterByHouse(house, title, body, '/hostel?tab=leave')

  // Resolve the house's HM phone for the WhatsApp link
  try {
    const { data: hm } = await supabase
      .from('housemasters')
      .select('name, phone')
      .ilike('house', house)
      .eq('status', 'Active')
      .maybeSingle()
    if (hm?.phone) {
      return { hmName: hm.name, hmPhone: hm.phone, whatsappUrl: buildWhatsAppLink(hm.phone, `${title}\n\n${body}`) }
    }
  } catch (e) {
    console.error('alertHousemasterOverdue phone lookup failed:', e)
  }
  return null
}

// ── Stuck Pending Approval alert → whichever role is currently
// blocking it (HM if approval_level 0, Superintendent if level 1).
async function alertStuckApproval(record) {
  const level = record.approval_level ?? 0
  const hoursStuck = record.created_at
    ? Math.round((Date.now() - new Date(record.created_at).getTime()) / (1000 * 60 * 60))
    : null
  const title = `⏳ Leave Stuck Pending — ${record.student_name}`
  const body = `${record.student_name}'s ${record.leave_type} request has been waiting ${hoursStuck != null ? `${hoursStuck}h` : 'too long'} for ${level === 0 ? 'HM' : 'Superintendent'} approval.`

  if (level === 0) {
    const house = record.house
    if (!house) return null
    await notifyHousemasterByHouse(house, title, body, '/hostel?tab=leave')
    try {
      const { data: hm } = await supabase
        .from('housemasters')
        .select('name, phone')
        .ilike('house', house)
        .eq('status', 'Active')
        .maybeSingle()
      if (hm?.phone) {
        return { role: 'HM', name: hm.name, phone: hm.phone, whatsappUrl: buildWhatsAppLink(hm.phone, `${title}\n\n${body}`) }
      }
    } catch (e) {
      console.error('alertStuckApproval HM phone lookup failed:', e)
    }
    return null
  } else {
    const supt = await notifySuperintendent(title, body, '/hostel?tab=leave')
    if (supt?.phone) {
      return { role: 'Superintendent', name: supt.name, phone: supt.phone, whatsappUrl: buildWhatsAppLink(supt.phone, `${title}\n\n${body}`) }
    }
    return null
  }
}


const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '3px 8px 3px 10px', borderRadius: '99px',
  background: '#eff6ff', color: '#1e3a5f',
  fontSize: '12px', fontWeight: '600', border: '1px solid #bfdbfe',
}
const chipX = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#64748b', fontSize: '11px', padding: '0', lineHeight: 1,
  fontWeight: '700',
}

const EMPTY_FORM = {
  student_id: null, student_name: '', gcc_no: '', class_name: '', house: '',
  leave_type: 'Home Leave',
  from_date: today(), to_date: today(),
  expected_return: '', actual_return: '',
  purpose: '', parent_contact: '',
  parent_approved: false,
  status: 'Pending', remarks: '',
}

// ══════════════════════════════════════════════════════════════
//  LEAVE FORM — shared between Create and Edit
// ══════════════════════════════════════════════════════════════
function LeaveForm({ form, setForm, students, onSave, onCancel, saving, isEdit }) {
  const mobile = useMobileView()

  const handleStudentSelect = s => {
    setForm(f => ({
      ...f,
      student_id: s.id,
      student_name: s.name || '',
      gcc_no: s.gcc_no || '',
      class_name: getStudentClass(s),
      house: s.house || '',
    }))
  }

  return (
    <div style={{ ...card, marginBottom: mobile ? '12px' : '20px' }}>
      {/* ── Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: mobile ? '15px' : '16px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>
          {isEdit ? '✏️ Edit Leave Request' : '🚪 New Leave Request'}
        </h3>
        {isEdit && (
          <span style={{
            fontSize: '11px', padding: '3px 10px', borderRadius: '99px',
            background: '#fef9c3', color: '#ca8a04', fontWeight: '700',
          }}>
            Editing Record
          </span>
        )}
      </div>

      <form onSubmit={onSave}>
        <div style={grid2}>

          {/* ── Student search — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>
              🔍 Search & Select Student
              {isEdit && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>(re-search to change)</span>}
            </label>
            <StudentSearchInput students={students} onSelect={handleStudentSelect} />
            {form.student_name && (
              <div style={{
                marginTop: '8px', padding: '8px 12px',
                background: '#dcfce7', borderRadius: '8px',
                fontSize: '12px', color: '#16a34a', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>
                  ✅ {form.student_name}
                  {form.gcc_no ? ` · GCC-${form.gcc_no}` : ''}
                  {form.house ? ` · 🏠 ${form.house}` : ''}
                  {form.class_name ? ` · ${form.class_name}` : ''}
                </span>
                {/* Allow clearing student selection */}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, student_id: null, student_name: '', gcc_no: '', class_name: '', house: '' }))}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '700', marginLeft: '8px' }}
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>

          {/* ── Leave type */}
          <div>
            <label style={lbl}>Leave Type *</label>
            <select
              value={form.leave_type}
              onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
              style={inp}
              required
            >
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* ── Balance card — shown when student + leave type selected */}
          {form.student_id && form.leave_type && (
            <div style={{ gridColumn: '1 / -1' }}>
              <BalanceCard studentId={form.student_id} leaveType={form.leave_type} />
            </div>
          )}

          {/* ── Status — only show on edit */}
          {isEdit && (
            <div>
              <label style={lbl}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={inp}
              >
                {LEAVE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* ── From date */}
          <div>
            <label style={lbl}>From Date *</label>
            <input
              type="date"
              value={form.from_date}
              onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
              required
              style={inp}
            />
          </div>

          {/* ── To date */}
          <div>
            <label style={lbl}>To Date *</label>
            <input
              type="date"
              value={form.to_date}
              min={form.from_date}
              onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
              required
              style={inp}
            />
          </div>

          {/* ── Expected return */}
          <div>
            <label style={lbl}>Expected Return</label>
            <input
              type="datetime-local"
              value={form.expected_return || ''}
              onChange={e => setForm(f => ({ ...f, expected_return: e.target.value || '' }))}
              style={inp}
            />
          </div>

          {/* ── Actual return — only on edit */}
          {isEdit && (
            <div>
              <label style={lbl}>Actual Return</label>
              <input
                type="datetime-local"
                value={form.actual_return || ''}
                onChange={e => setForm(f => ({ ...f, actual_return: e.target.value || '' }))}
                style={inp}
              />
            </div>
          )}

          {/* ── Purpose — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Purpose / Reason *</label>
            <textarea
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={mobile ? 2 : 3}
              placeholder="Reason for leave..."
              required
              style={{ ...inp, resize: 'vertical' }}
            />
          </div>

          {/* ── Parent contact */}
          <div>
            <label style={lbl}>Parent Contact</label>
            <input
              value={form.parent_contact}
              onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))}
              placeholder="Phone number"
              type="tel"
              style={inp}
            />
          </div>

          {/* ── Remarks */}
          <div>
            <label style={lbl}>Remarks</label>
            <input
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="Any additional notes"
              style={inp}
            />
          </div>

          {/* ── Parent approved checkbox */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.parent_approved}
                onChange={e => setForm(f => ({ ...f, parent_approved: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              ✅ Parent has verbally approved this leave
            </label>
          </div>
        </div>

        {/* ── Action buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={saving || !form.student_name}
            style={{
              ...btn(saving || !form.student_name ? '#94a3b8' : '#1e3a5f'),
              flex: mobile ? 1 : 'unset',
            }}
          >
            {saving ? '⏳ Saving...' : isEdit ? '✅ Update Request' : '✅ Create Request'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...btn('#f1f5f9', '#374151'), flex: mobile ? 1 : 'unset' }}
          >
            Cancel
          </button>
        </div>

        {/* ── Validation hint */}
        {!form.student_name && (
          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', margin: '8px 0 0' }}>
            ⚠️ Please search and select a student first
          </p>
        )}
      </form>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  LEAVE BALANCE HOOK — fetch + manage balance for one student
// ══════════════════════════════════════════════════════════════
function useLeaveBalance(studentId, leaveType) {
  const [balance,  setBalance]  = useState(null)   // { total_quota, used, remaining, is_unlimited }
  const [loading,  setLoading]  = useState(false)

  const academicYear = currentAcademicYear()

  const fetch = async () => {
    if (!studentId || !leaveType) { setBalance(null); return }
    setLoading(true)

    // Try to get existing balance row
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year', academicYear)
      .eq('leave_type', leaveType)
      .maybeSingle()

    if (error) { console.error('Balance fetch error:', error); setLoading(false); return }

    if (data) {
      setBalance(data)
    } else {
      // No row yet — derive from quota config or default
      const { data: cfg } = await supabase
        .from('leave_quota_config')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('leave_type', leaveType)
        .maybeSingle()

      const quota       = cfg?.default_quota  ?? DEFAULT_QUOTAS[leaveType] ?? 4
      const unlimited   = cfg?.is_unlimited   ?? (DEFAULT_QUOTAS[leaveType] === -1)
      setBalance({
        student_id:    studentId,
        academic_year: academicYear,
        leave_type:    leaveType,
        total_quota:   unlimited ? 999 : quota,
        used:          0,
        remaining:     unlimited ? 999 : quota,
        is_unlimited:  unlimited,
        _virtual:      true,   // not yet in DB — will be created on first approval
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [studentId, leaveType])

  return { balance, loading, refetch: fetch }
}

// ══════════════════════════════════════════════════════════════
//  BALANCE CARD — shown inside LeaveForm before HM approves
// ══════════════════════════════════════════════════════════════
function BalanceCard({ studentId, leaveType }) {
  const { balance, loading } = useLeaveBalance(studentId, leaveType)

  if (!studentId || !leaveType) return null
  if (loading) return (
    <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', fontSize: '13px', color: '#94a3b8' }}>
      ⏳ Loading balance...
    </div>
  )
  if (!balance) return null

  const pct      = balance.is_unlimited ? 100 : Math.round((balance.used / balance.total_quota) * 100)
  const isZero   = !balance.is_unlimited && balance.remaining <= 0
  const isLow    = !balance.is_unlimited && balance.remaining === 1
  const barColor = isZero ? '#dc2626' : isLow ? '#ca8a04' : '#16a34a'
  const bg       = isZero ? '#fee2e2' : isLow ? '#fef9c3' : '#f0fdf4'
  const border   = isZero ? '#fca5a5' : isLow ? '#fde047' : '#bbf7d0'

  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: '12px', padding: '12px 14px', marginBottom: '4px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
          📊 {leaveType} Balance · {balance.academic_year}
        </div>
        {balance.is_unlimited
          ? <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '99px' }}>∞ Unlimited</span>
          : <span style={{ fontSize: '12px', fontWeight: '700', color: barColor }}>
              {balance.remaining} of {balance.total_quota} remaining
            </span>
        }
      </div>

      {!balance.is_unlimited && (
        <>
          {/* Progress bar */}
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              height: '100%', width: `${Math.min(pct, 100)}%`,
              background: barColor, borderRadius: '99px', transition: 'width 0.4s',
            }} />
          </div>
          {/* Mini stats */}
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
            <span>Used: <strong style={{ color: '#1e293b' }}>{balance.used}</strong></span>
            <span>Quota: <strong style={{ color: '#1e293b' }}>{balance.total_quota}</strong></span>
          </div>
        </>
      )}

      {/* Warnings */}
      {isZero && (
        <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>
          🚫 Quota exhausted — all {balance.total_quota} {leaveType}s used this year.
        </div>
      )}
      {isLow && (
        <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '700', color: '#ca8a04' }}>
          ⚠️ Only 1 {leaveType} remaining this year.
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  QUOTA EXCEEDED MODAL — shown when balance = 0, HM can override
// ══════════════════════════════════════════════════════════════
function QuotaExceededModal({ record, balance, onOverride, onCancel }) {
  const [overrideReason, setOverrideReason] = useState('')
  const [error, setError] = useState(false)
  if (!record || !balance) return null

  const handleOverride = () => {
    if (!overrideReason.trim()) { setError(true); return }
    onOverride(overrideReason.trim())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>🚫</div>
        <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#dc2626', textAlign: 'center', margin: '0 0 8px' }}>
          Quota Exceeded
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.6 }}>
          <strong>{record.student_name}</strong> has already used all <strong>{balance.total_quota} {record.leave_type}s</strong> for <strong>{balance.academic_year}</strong>.
          <br />You can still approve with an override reason.
        </p>
        <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
          Used: {balance.used} / {balance.total_quota} · Remaining: 0
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...lbl, color: error ? '#dc2626' : '#374151' }}>
            Override reason * {error && <span style={{ fontWeight: '400' }}>(required)</span>}
          </label>
          <textarea
            value={overrideReason}
            onChange={e => { setOverrideReason(e.target.value); setError(false) }}
            rows={3}
            placeholder="e.g. Family emergency — principal approval obtained"
            autoFocus
            style={{ ...inp, resize: 'vertical', border: error ? '1.5px solid #dc2626' : '1px solid #d1d5db' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleOverride} style={{ ...btn('#ca8a04'), flex: 1 }}>⚠️ Approve Anyway</button>
          <button onClick={onCancel}       style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  QUOTA ADMIN PANEL — configure quotas per academic year
// ══════════════════════════════════════════════════════════════
function QuotaAdminPanel({ onClose }) {
  const [configs,  setConfigs]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [year,     setYear]     = useState(currentAcademicYear())

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leave_quota_config')
      .select('*')
      .eq('academic_year', year)
    // Build full list — one row per leave type
    const rows = LEAVE_TYPES.map(t => {
      const existing = (data || []).find(c => c.leave_type === t)
      return existing || {
        academic_year: year,
        leave_type:    t,
        default_quota: DEFAULT_QUOTAS[t] === -1 ? 999 : (DEFAULT_QUOTAS[t] ?? 4),
        is_unlimited:  DEFAULT_QUOTAS[t] === -1,
      }
    })
    setConfigs(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  const handleSave = async () => {
    setSaving(true)
    // Upsert all rows
    for (const cfg of configs) {
      if (cfg.id) {
        await supabase.from('leave_quota_config').update({
          default_quota: cfg.is_unlimited ? 999 : Number(cfg.default_quota),
          is_unlimited:  cfg.is_unlimited,
        }).eq('id', cfg.id)
      } else {
        await supabase.from('leave_quota_config').insert([{
          academic_year: year,
          leave_type:    cfg.leave_type,
          default_quota: cfg.is_unlimited ? 999 : Number(cfg.default_quota),
          is_unlimited:  cfg.is_unlimited,
        }])
      }
    }
    setSaving(false)
    alert('✅ Quotas saved for ' + year)
    load()
  }

  const updateCfg = (leaveType, field, value) => {
    setConfigs(prev => prev.map(c => c.leave_type === leaveType ? { ...c, [field]: value } : c))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>⚙️ Leave Quota Configuration</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {/* Year selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Academic Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} style={inp}>
            {['2023-24', '2024-25', '2025-26', '2026-27'].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>⏳ Loading...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {configs.map(cfg => (
                <div key={cfg.leave_type} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>🚪 {cfg.leave_type}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cfg.is_unlimited}
                        onChange={e => updateCfg(cfg.leave_type, 'is_unlimited', e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      Unlimited
                    </label>
                  </div>
                  {!cfg.is_unlimited && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>Annual quota:</label>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={cfg.default_quota}
                        onChange={e => updateCfg(cfg.leave_type, 'default_quota', e.target.value)}
                        style={{ ...inp, width: '80px', padding: '8px 10px', fontSize: '14px' }}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>per student per year</span>
                    </div>
                  )}
                  {cfg.is_unlimited && (
                    <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>∞ No limit — students can apply anytime</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>
                {saving ? '⏳ Saving...' : '✅ Save Quotas'}
              </button>
              <button onClick={onClose} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  STUDENT BALANCE OVERVIEW — per-student override panel
// ══════════════════════════════════════════════════════════════
function StudentBalancePanel({ students, onClose }) {
  const [search,      setSearch]      = useState('')
  const [selectedId,  setSelectedId]  = useState(null)
  const [balances,    setBalances]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const year = currentAcademicYear()

  const loadBalances = async (sid) => {
    setLoading(true)
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('student_id', sid)
      .eq('academic_year', year)
    // Fill in missing leave types from defaults
    const rows = LEAVE_TYPES.map(t => {
      const existing = (data || []).find(b => b.leave_type === t)
      if (existing) return existing
      const quota     = DEFAULT_QUOTAS[t]
      const unlimited = quota === -1
      return {
        student_id:    sid,
        academic_year: year,
        leave_type:    t,
        total_quota:   unlimited ? 999 : quota,
        used:          0,
        remaining:     unlimited ? 999 : quota,
        is_unlimited:  unlimited,
        _virtual:      true,
      }
    })
    setBalances(rows)
    setLoading(false)
  }

  const handleSelect = (s) => {
    setSelectedId(s.id)
    loadBalances(s.id)
    setSearch('')
  }

  const handleOverrideQuota = async (leaveType, newQuota) => {
    setSaving(true)
    const existing = balances.find(b => b.leave_type === leaveType)
    if (existing && !existing._virtual) {
      await supabase.from('leave_balances').update({
        total_quota: Number(newQuota),
        remaining:   Math.max(0, Number(newQuota) - (existing.used || 0)),
        updated_at:  new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      // Create the row
      await supabase.from('leave_balances').insert([{
        student_id:    selectedId,
        academic_year: year,
        leave_type:    leaveType,
        total_quota:   Number(newQuota),
        used:          0,
        remaining:     Number(newQuota),
        is_unlimited:  false,
        updated_at:    new Date().toISOString(),
      }])
    }
    setSaving(false)
    loadBalances(selectedId)
  }

  const selectedStudent = students.find(s => s.id === selectedId)
  const hits = search.trim()
    ? students.filter(s =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(s.gcc_no || '').includes(search)
      ).slice(0, 8)
    : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '560px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>🎛 Per-Student Balance Override</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {/* Student search */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student by name or GCC no..."
            style={inp}
            type="search"
          />
          {hits.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '10px', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', marginTop: '4px' }}>
              {hits.map(s => (
                <div key={s.id} onClick={() => handleSelect(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <strong>{s.name}</strong>
                  <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '12px' }}>GCC-{s.gcc_no || '--'} · {s.house || '--'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#1e3a5f', fontWeight: '600' }}>
            👤 {selectedStudent.name} · GCC-{selectedStudent.gcc_no || '--'} · {selectedStudent.house || '--'} · {year}
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>⏳ Loading balances...</div>}

        {!loading && selectedId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {balances.map(b => (
              <div key={b.leave_type} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>🚪 {b.leave_type}</div>
                  <div style={{ fontSize: '12px', color: b.remaining <= 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                    {b.is_unlimited ? '∞ Unlimited' : `${b.remaining} remaining`}
                  </div>
                </div>
                {!b.is_unlimited && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ fontWeight: '800', color: '#16a34a', fontSize: '16px' }}>{b.remaining}</div>
                      <div style={{ color: '#64748b' }}>Remaining</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ fontWeight: '800', color: '#dc2626', fontSize: '16px' }}>{b.used}</div>
                      <div style={{ color: '#64748b' }}>Used</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#eff6ff', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ fontWeight: '800', color: '#1e3a5f', fontSize: '16px' }}>{b.total_quota}</div>
                      <div style={{ color: '#64748b' }}>Quota</div>
                    </div>
                  </div>
                )}
                {/* Override quota input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Override quota:</label>
                  <input
                    type="number" min={0} max={52}
                    defaultValue={b.is_unlimited ? '' : b.total_quota}
                    placeholder={b.is_unlimited ? '∞' : b.total_quota}
                    onBlur={e => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val !== b.total_quota) handleOverrideQuota(b.leave_type, val)
                    }}
                    style={{ ...inp, width: '70px', padding: '6px 10px', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>tab out to save</span>
                  {saving && <span style={{ fontSize: '12px', color: '#ca8a04' }}>⏳</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!selectedId && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
            Search for a student above to view and override their balances
          </div>
        )}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  GATE PASS ENGINE
//  Feature 24: auto-generate PDF on approval
//  Feature 25: unique GP-YYYY-NNNN number
//  Feature 26: QR code encoding leave ID + verify URL
//  Feature 27: GNSI letterhead, print-ready A5 layout
//  Feature 28: HM + Superintendent signature lines
//  Feature 29: RETURNED watermark when student is back
//  Feature 30: Guard verify page component
// ══════════════════════════════════════════════════════════════

// ── Get or create gate pass number for a leave record
async function getOrCreateGPNo(leaveId) {
  // Check if already issued
  const { data: existing } = await supabase
    .from('gate_passes')
    .select('gp_no, id, is_voided')
    .eq('leave_id', leaveId)
    .maybeSingle()
  if (existing) return existing

  // Get next sequence number
  const { data: seqRow } = await supabase
    .from('gate_pass_sequence')
    .select('seq')
    .eq('year', new Date().getFullYear())
    .maybeSingle()

  let seq = 1
  if (seqRow) {
    seq = (seqRow.seq || 0) + 1
    await supabase
      .from('gate_pass_sequence')
      .update({ seq })
      .eq('year', new Date().getFullYear())
  } else {
    await supabase
      .from('gate_pass_sequence')
      .insert([{ year: new Date().getFullYear(), seq: 1 }])
  }

  const gp_no = formatGPNo(seq)
  const { data: created } = await supabase
    .from('gate_passes')
    .insert([{
      leave_id:   leaveId,
      gp_no,
      issued_at:  new Date().toISOString(),
      is_voided:  false,
    }])
    .select()
    .single()

  return created || { gp_no, is_voided: false }
}

// ── Void gate pass when student marked returned
async function voidGatePass(leaveId) {
  await supabase
    .from('gate_passes')
    .update({ is_voided: true, voided_at: new Date().toISOString() })
    .eq('leave_id', leaveId)
}

// ── Core PDF generator
async function generateGatePassPDF(record, gpData) {
  const { gp_no, is_voided } = gpData
  const schoolPhone = await getSchoolContact()

  // ── Build QR code data URL
  const qrUrl   = `${VERIFY_BASE}?gp=${gp_no}&id=${record.id}`
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 120, margin: 1,
    color: { dark: '#1e3a5f', light: '#ffffff' },
  })

  // ── Create A5 PDF (148 x 210 mm)
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const W      = 148
  const navy   = [30, 58, 95]
  const gold   = [202, 138, 4]
  const red    = [220, 38, 38]
  const white  = [255, 255, 255]
  const light  = [240, 246, 255]
  const grey   = [100, 116, 139]
  const black  = [15, 23, 42]

  let y = 0

  // ══ HEADER BAND ══
  doc.setFillColor(...navy)
  doc.rect(0, 0, W, 28, 'F')

  // Institute name
  doc.setTextColor(...white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(GNSI_NAME, W / 2, 9, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(GNSI_ADDRESS, W / 2, 14.5, { align: 'center' })
  doc.text(schoolPhone,  W / 2, 19,   { align: 'center' })

  // GATE PASS title
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...gold)
  doc.text('GATE PASS', W / 2, 26, { align: 'center' })

  y = 32

  // ══ GP NUMBER + DATE ROW ══
  doc.setFillColor(...light)
  doc.rect(0, y, W, 8, 'F')
  doc.setTextColor(...navy)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(gp_no, 8, y + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...grey)
  const issuedStr = `Issued: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
  doc.text(issuedStr, W - 8, y + 5.5, { align: 'right' })

  y = 44

  // ══ STUDENT INFO BOX ══
  doc.setDrawColor(...navy)
  doc.setLineWidth(0.4)
  doc.roundedRect(6, y, W - 12, 36, 2, 2, 'S')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text('STUDENT DETAILS', 10, y + 5)

  const sFields = [
    ['Name',    record.student_name || '—'],
    ['GCC No',  record.gcc_no ? `GCC-${record.gcc_no}` : '—'],
    ['Class',   record.class_name   || '—'],
    ['House',   record.house        || '—'],
  ]
  doc.setFontSize(8.5)
  let sy = y + 10
  for (const [label, value] of sFields) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...grey)
    doc.text(`${label}:`, 10, sy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...black)
    doc.text(value, 40, sy)
    sy += 6
  }

  y = 84

  // ══ LEAVE DETAILS BOX ══
  doc.roundedRect(6, y, W - 12, 40, 2, 2, 'S')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text('LEAVE DETAILS', 10, y + 5)

  const lFields = [
    ['Leave Type',   record.leave_type  || '—'],
    ['From',         record.from_date   || '—'],
    ['To',           record.to_date     || '—'],
    ['Return By',    record.expected_return
                       ? new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                       : '—'],
    ['Purpose',      record.purpose     || '—'],
  ]
  doc.setFontSize(8.5)
  let ly = y + 10
  for (const [label, value] of lFields) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...grey)
    doc.text(`${label}:`, 10, ly)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...black)
    // Truncate long purpose
    const display = value.length > 55 ? value.slice(0, 52) + '…' : value
    doc.text(display, 40, ly)
    ly += 6.5
  }

  y = 128

  // ══ APPROVAL + QR ROW ══
  // Left: approval details
  doc.roundedRect(6, y, 86, 30, 2, 2, 'S')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text('APPROVAL', 10, y + 5)

  doc.setFontSize(8)
  const hmName   = record.hm_approved_by   || '—'
  const suptName = record.supt_approved_by || '—'
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grey)
  doc.text('HM Approved:', 10, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...black)
  doc.text(hmName, 40, y + 11)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grey)
  doc.text('Supt Approved:', 10, y + 17)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...black)
  doc.text(suptName, 40, y + 17)

  // Signature lines
  doc.setDrawColor(...grey)
  doc.setLineWidth(0.3)
  doc.line(10, y + 26, 50, y + 26)
  doc.line(52, y + 26, 90, y + 26)
  doc.setFontSize(6.5)
  doc.setTextColor(...grey)
  doc.text('HM Signature', 10, y + 29.5)
  doc.text('Supt Signature', 52, y + 29.5)

  // Right: QR code
  doc.roundedRect(96, y, 46, 30, 2, 2, 'S')
  doc.addImage(qrDataUrl, 'PNG', 99, y + 2, 26, 26)
  doc.setFontSize(6.5)
  doc.setTextColor(...grey)
  doc.text('Scan to verify', 127, y + 15, { align: 'center' })
  doc.setFontSize(6)
  doc.text(gp_no, 127, y + 19, { align: 'center' })

  y = 162

  // ══ FOOTER NOTICE ══
  doc.setFillColor(254, 242, 242)
  doc.roundedRect(6, y, W - 12, 12, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...red)
  doc.setFont('helvetica', 'bold')
  doc.text('⚠ This pass must be carried at all times and surrendered at the gate on return.', W / 2, y + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text(`Valid from ${record.from_date} to ${record.to_date}. Unauthorised use is a disciplinary offence.`, W / 2, y + 10, { align: 'center' })

  // ══ RETURNED WATERMARK (Feature 29) ══
  if (is_voided || record.status === 'Returned') {
    doc.setTextColor(220, 38, 38)
    doc.setFontSize(52)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.text('RETURNED', W / 2, 130, { align: 'center', angle: 45 })
    doc.setGState(doc.GState({ opacity: 1 }))
  }

  // ── Save
  doc.save(`${gp_no}_${(record.student_name || 'student').replace(/\s+/g, '_')}.pdf`)
}

// ══════════════════════════════════════════════════════════════
//  GATE PASS BUTTON — shown on fully approved records
// ══════════════════════════════════════════════════════════════
function GatePassButton({ record, compact = false }) {
  const [generating, setGenerating] = useState(false)
  const [gpData,     setGpData]     = useState(null)
  const [loaded,     setLoaded]     = useState(false)

  // Load existing gate pass data on mount
  useEffect(() => {
    if (!record?.id) return
    supabase
      .from('gate_passes')
      .select('gp_no, is_voided, issued_at')
      .eq('leave_id', record.id)
      .maybeSingle()
      .then(({ data }) => { setGpData(data); setLoaded(true) })
  }, [record?.id])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const gp = await getOrCreateGPNo(record.id)
      setGpData(gp)
      await generateGatePassPDF(record, gp)
    } catch (err) {
      console.error('Gate pass error:', err)
      alert('Error generating gate pass: ' + err.message)
    }
    setGenerating(false)
  }

  // Only show for fully approved or returned records
  const level    = record.approval_level ?? 0
  const eligible = (record.status === 'Approved' && level >= 2) || record.status === 'Returned' || record.status === 'Overdue'
  if (!eligible) return null

  const isVoided  = gpData?.is_voided || record.status === 'Returned'
  const hasPass   = !!gpData?.gp_no

  if (compact) {
    // Compact version for table rows
    return (
      <button
        onClick={handleGenerate}
        disabled={generating}
        title={hasPass ? `Reprint ${gpData.gp_no}` : 'Generate Gate Pass'}
        style={{
          background: isVoided ? '#fee2e2' : hasPass ? '#dcfce7' : '#eff6ff',
          color:      isVoided ? '#dc2626' : hasPass ? '#16a34a' : '#1e3a5f',
          border: 'none', borderRadius: '6px', padding: '5px 9px',
          fontSize: '11px', cursor: 'pointer', fontWeight: '700',
          whiteSpace: 'nowrap',
        }}
      >
        {generating ? '⏳' : isVoided ? '🖨 RETURNED' : hasPass ? `🖨 ${gpData.gp_no}` : '🖨 Gate Pass'}
      </button>
    )
  }

  // Full version for mobile cards
  return (
    <div style={{
      background: isVoided ? '#fee2e2' : hasPass ? '#f0fdf4' : '#eff6ff',
      border: `1.5px solid ${isVoided ? '#fca5a5' : hasPass ? '#bbf7d0' : '#bfdbfe'}`,
      borderRadius: '10px', padding: '10px 14px', marginTop: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: isVoided ? '#dc2626' : '#1e3a5f' }}>
            {isVoided ? '🔴 Gate Pass Voided' : hasPass ? `✅ Gate Pass Issued` : '🎫 Gate Pass'}
          </div>
          {hasPass && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {gpData.gp_no}
              {isVoided && ' · RETURNED'}
            </div>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: isVoided ? '#dc2626' : '#1e3a5f',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '8px 14px', fontSize: '12px', fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          {generating ? '⏳ Generating...' : isVoided ? '🖨 Print (Returned)' : hasPass ? '🖨 Reprint' : '🖨 Print Pass'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  GUARD VERIFY PAGE — Feature 30
//  Standalone component — mount at /verify route
//  Reads ?gp=GP-2024-0042&id=<uuid> from URL
// ══════════════════════════════════════════════════════════════
export function GatePassVerifyPage() {
  const [record,  setRecord]  = useState(null)
  const [gpData,  setGpData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const leaveId = params.get('id')
    const gpNo    = params.get('gp')

    if (!leaveId || !gpNo) {
      setError('Invalid QR code — missing parameters.')
      setLoading(false)
      return
    }

    Promise.all([
      supabase.from('leave_records').select('*').eq('id', leaveId).single(),
      supabase.from('gate_passes').select('*').eq('leave_id', leaveId).maybeSingle(),
    ]).then(([{ data: rec, error: e1 }, { data: gp }]) => {
      if (e1 || !rec) { setError('Leave record not found.'); setLoading(false); return }
      if (gp?.gp_no !== gpNo) { setError('Gate pass number mismatch — possible forgery.'); setLoading(false); return }
      setRecord(rec)
      setGpData(gp)
      setLoading(false)
    })
  }, [])

  const containerStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f1f5f9', padding: '20px', fontFamily: 'system-ui, sans-serif',
  }
  const boxStyle = {
    background: 'white', borderRadius: '16px', padding: '32px',
    maxWidth: '440px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  }

  if (loading) return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
        <div style={{ fontWeight: '600' }}>Verifying gate pass...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={containerStyle}>
      <div style={{ ...boxStyle, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Verification Failed</h2>
        <p style={{ color: '#64748b' }}>{error}</p>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px' }}>Contact the Hostel Office to verify manually.</p>
      </div>
    </div>
  )

  const isReturned = record.status === 'Returned' || gpData?.is_voided
  const isOverdue  = record.status === 'Overdue'
  const isValid    = record.status === 'Approved' && (record.approval_level ?? 0) >= 2

  const statusColor = isReturned ? '#16a34a' : isOverdue ? '#dc2626' : isValid ? '#1d4ed8' : '#ca8a04'
  const statusBg    = isReturned ? '#dcfce7'  : isOverdue ? '#fee2e2'  : isValid ? '#dbeafe'  : '#fef9c3'
  const statusLabel = isReturned ? '✅ Returned — Pass Voided'
                    : isOverdue  ? '⚠️ OVERDUE — Not Yet Returned'
                    : isValid    ? '✅ Valid Gate Pass'
                    :              '⏳ Not Fully Approved'

  return (
    <div style={containerStyle}>
      <div style={boxStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{GNSI_NAME}</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: '4px 0' }}>Gate Pass Verification</h2>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>{gpData?.gp_no}</div>
        </div>

        {/* Status badge */}
        <div style={{ background: statusBg, border: `1.5px solid ${statusColor}40`, borderRadius: '12px', padding: '12px 16px', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: statusColor }}>{statusLabel}</div>
          {isOverdue && (
            <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: '600' }}>
              Expected return: {record.expected_return ? new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </div>
          )}
        </div>

        {/* Student details */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Student</div>
          {[
            ['Name',       record.student_name],
            ['GCC No',     record.gcc_no ? `GCC-${record.gcc_no}` : '—'],
            ['Class',      record.class_name || '—'],
            ['House',      record.house      || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>{label}</span>
              <span style={{ color: '#1e293b', fontWeight: '700' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Leave details */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Leave</div>
          {[
            ['Type',       record.leave_type],
            ['From',       record.from_date],
            ['To',         record.to_date],
            ['Return By',  record.expected_return ? new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>{label}</span>
              <span style={{ color: '#1e293b', fontWeight: '700' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Approval chain */}
        <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Approved By</div>
          <div style={{ fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>HM: </span>{record.hm_approved_by || '—'}
          </div>
          <div style={{ fontSize: '13px', color: '#1e293b' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>Superintendent: </span>{record.supt_approved_by || '—'}
          </div>
        </div>

        {/* Returned info */}
        {isReturned && record.actual_return && (
          <div style={{ background: '#dcfce7', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>
              🏠 Returned on {new Date(record.actual_return).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
          Verified at {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {GNSI_NAME}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  OVERSTAY BADGE — shown inline on records
// ══════════════════════════════════════════════════════════════
function OverstayBadge({ record, style = {} }) {
  const overstay = calcOverstay(record.expected_return, record.actual_return)
  if (!overstay || overstay.totalMs <= 0) return null
  if (!overstay.isOverstay) {
    // Returned on time
    return (
      <span style={{
        padding: '3px 8px', borderRadius: '99px', fontSize: '11px',
        fontWeight: '700', background: '#dcfce7', color: '#16a34a',
        whiteSpace: 'nowrap', ...style,
      }}>
        ✅ On time
      </span>
    )
  }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '99px', fontSize: '12px',
      fontWeight: '700', background: '#fee2e2', color: '#dc2626',
      whiteSpace: 'nowrap', ...style,
    }}>
      🔴 {fmtOverstay(overstay)} late
    </span>
  )
}

// ══════════════════════════════════════════════════════════════
//  MARK RETURNED MODAL — Feature 31 + 32 + 37
//  Confirmation with precise time picker + overstay preview
//  + discipline record prompt if overstay > 2h
// ══════════════════════════════════════════════════════════════
function MarkReturnedModal({ record, onConfirm, onCancel }) {
  // Default to now, formatted for datetime-local input
  const nowLocal = () => {
    const d   = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [returnTime,       setReturnTime]       = useState(nowLocal())
  const [createDiscipline, setCreateDiscipline] = useState(true)
  const [disciplineRemarks, setDisciplineRemarks] = useState('')

  if (!record) return null

  const overstay    = calcOverstay(record.expected_return, returnTime ? returnTime + ':00' : null)
  const willPrompt  = overstay?.isOverstay   // overstay > 2h
  const onTime      = overstay && !overstay.isOverstay && overstay.totalMs > 0
  const early       = overstay && overstay.totalMs <= 0

  const incidentText = overstay?.isOverstay
    ? `Late return from ${record.leave_type} — overstay: ${fmtOverstay(overstay)}`
    : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '28px',
        maxWidth: '460px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏠</div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px' }}>
            Mark Student Returned
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            <strong>{record.student_name}</strong> · {record.leave_type}
          </p>
        </div>

        {/* Expected return info */}
        {record.expected_return && (
          <div style={{
            background: '#f8fafc', borderRadius: '10px', padding: '10px 14px',
            marginBottom: '16px', fontSize: '13px',
          }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>Expected return: </span>
            <span style={{ color: '#1e293b', fontWeight: '700' }}>
              {new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
        )}

        {/* Actual return time picker — Feature 32 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Actual Return Time *</label>
          <input
            type="datetime-local"
            value={returnTime}
            onChange={e => setReturnTime(e.target.value)}
            style={inp}
          />
        </div>

        {/* Overstay preview — Feature 33 + 34 */}
        {returnTime && overstay && (
          <div style={{
            borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
            background: early ? '#f0fdf4' : onTime ? '#f0fdf4' : '#fee2e2',
            border: `1.5px solid ${early ? '#bbf7d0' : onTime ? '#bbf7d0' : '#fca5a5'}`,
          }}>
            {early && (
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>
                ✅ Returned early
              </div>
            )}
            {onTime && (
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>
                ✅ Returned on time · {fmtOverstay(overstay)} late
              </div>
            )}
            {willPrompt && (
              <>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626', marginBottom: '4px' }}>
                  🔴 Overstay: {fmtOverstay(overstay)}
                </div>
                <div style={{ fontSize: '12px', color: '#dc2626' }}>
                  Expected: {new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  {' → '}
                  Actual: {new Date(returnTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Discipline record prompt — Feature 35 + 37 */}
        {willPrompt && (
          <div style={{
            background: '#fff7ed', border: '1.5px solid #fed7aa',
            borderRadius: '12px', padding: '14px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#9a3412', marginBottom: '10px' }}>
              ⚠️ Overstay exceeds 2 hours — create discipline record?
            </div>

            {/* Incident text preview */}
            <div style={{
              background: 'white', borderRadius: '8px', padding: '8px 12px',
              fontSize: '12px', color: '#374151', marginBottom: '10px',
              border: '1px solid #fed7aa', fontStyle: 'italic',
            }}>
              "{incidentText}"
            </div>

            {/* Additional remarks */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ ...lbl, fontSize: '12px' }}>
                Additional remarks <span style={{ fontWeight: '400', color: '#94a3b8' }}>(optional)</span>
              </label>
              <input
                value={disciplineRemarks}
                onChange={e => setDisciplineRemarks(e.target.value)}
                placeholder="e.g. Parent contacted, explanation given"
                style={{ ...inp, fontSize: '13px' }}
              />
            </div>

            {/* Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={createDiscipline}
                onChange={e => setCreateDiscipline(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Yes, create discipline record automatically
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onConfirm({
              actualReturn:    returnTime,
              createDiscipline: willPrompt && createDiscipline,
              incidentText,
              disciplineRemarks,
            })}
            style={{ ...btn('#16a34a'), flex: 1 }}
          >
            🏠 Confirm Return
          </button>
          <button onClick={onCancel} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  LEAVE CALENDAR VIEW
//  Feature 38: month grid showing who is out each day
//  Feature 39: color coded by leave type
//  Feature 40: click day → side panel with all students out
//  Feature 41: per-house vs all-houses toggle
//  Feature 42: threshold warning (too many students out)
//  Feature 43: upcoming leaves preview (next 7 days)
// ══════════════════════════════════════════════════════════════
function LeaveCalendarView({ records, students }) {
  const now          = new Date()
  const [viewMonth,  setViewMonth]  = useState(now.getMonth())
  const [viewYear,   setViewYear]   = useState(now.getFullYear())
  const [houseFilter, setHouseFilter] = useState('All')
  const [selectedDay, setSelectedDay] = useState(null)   // 'YYYY-MM-DD'
  const mobile = useMobileView()

  // ── All houses derived from students
  const houses = useMemo(() =>
    ['All', ...[...new Set(students.map(s => s.house).filter(Boolean))].sort()],
    [students]
  )

  // ── Total active students (for threshold calc)
  const totalStudents = useMemo(() => {
    if (houseFilter === 'All') return students.filter(s => s.status !== 'Inactive').length
    return students.filter(s => s.house === houseFilter && s.status !== 'Inactive').length
  }, [students, houseFilter])

  // ── Approved/overdue records that are currently active (not returned/rejected)
  const activeRecords = useMemo(() =>
    records.filter(r =>
      ['Approved', 'Overdue'].includes(r.status) &&
      (r.approval_level ?? 0) >= 2 &&
      (houseFilter === 'All' || r.house === houseFilter)
    ),
    [records, houseFilter]
  )

  // ── For a given date string 'YYYY-MM-DD', get all records whose leave spans that date
  const getRecordsForDay = useCallback((dateStr) => {
    return activeRecords.filter(r => {
      const from = r.from_date
      const to   = r.to_date
      return from && to && dateStr >= from && dateStr <= to
    })
  }, [activeRecords])

  // ── Build calendar grid for current month
  const { days, firstWeekday } = useMemo(() => {
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d      = i + 1
      const pad    = n => String(n).padStart(2, '0')
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`
      const recs   = getRecordsForDay(dateStr)
      const pct    = totalStudents > 0 ? Math.round(recs.length / totalStudents * 100) : 0
      const isHigh = pct >= THRESHOLD_PCT && recs.length > 0
      const isToday = dateStr === new Date().toISOString().split('T')[0]
      return { d, dateStr, recs, pct, isHigh, isToday }
    })
    return { days, firstWeekday }
  }, [viewMonth, viewYear, getRecordsForDay, totalStudents])

  // ── Upcoming leaves: next 7 days from today
  const upcoming = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d    = new Date(today)
      d.setDate(today.getDate() + i)
      const pad  = n => String(n).padStart(2, '0')
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
      const recs = getRecordsForDay(dateStr)
      return { dateStr, recs, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }
    }).filter(u => u.recs.length > 0)
  }, [getRecordsForDay])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedRecs = selectedDay ? getRecordsForDay(selectedDay) : []

  return (
    <div>
      {/* ── Header: navigation + house filter */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '16px', flexWrap: 'wrap',
      }}>
        <button onClick={prevMonth} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '16px' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: mobile ? '16px' : '20px', fontWeight: '800', color: '#1e3a5f' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            {activeRecords.length} student{activeRecords.length !== 1 ? 's' : ''} out
            {houseFilter !== 'All' ? ` · ${houseFilter} house` : ''}
          </div>
        </div>
        <button onClick={nextMonth} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '16px' }}>›</button>
        <select
          value={houseFilter}
          onChange={e => { setHouseFilter(e.target.value); setSelectedDay(null) }}
          style={{ ...inp, width: 'auto', minWidth: '130px' }}
        >
          {houses.map(h => <option key={h}>{h === 'All' ? 'All Houses' : h}</option>)}
        </select>
      </div>

      {/* ── Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {Object.entries(LEAVE_TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: '600', color: c.color,
            background: c.bg, padding: '3px 8px', borderRadius: '99px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
            {type}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: '99px' }}>
          ⚠️ ≥{THRESHOLD_PCT}% out (alert)
        </span>
      </div>

      {/* ── Main grid + side panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDay && !mobile ? '1fr 300px' : '1fr', gap: '16px' }}>

        {/* ── Calendar grid */}
        <div>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#94a3b8', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: mobile ? '48px' : '72px' }} />
            ))}

            {days.map(({ d, dateStr, recs, pct, isHigh, isToday }) => {
              const isSelected = selectedDay === dateStr
              const hasLeaves  = recs.length > 0

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{
                    minHeight: mobile ? '48px' : '72px',
                    borderRadius: '8px',
                    border: isSelected
                      ? '2px solid #1e3a5f'
                      : isHigh
                      ? '1.5px solid #fca5a5'
                      : '1px solid #e2e8f0',
                    background: isSelected
                      ? '#eff6ff'
                      : isHigh
                      ? '#fff1f2'
                      : isToday
                      ? '#fefce8'
                      : hasLeaves
                      ? '#f8fafc'
                      : 'white',
                    cursor: hasLeaves ? 'pointer' : 'default',
                    padding: '4px',
                    transition: 'all 0.15s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Day number */}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: isToday ? '800' : '600',
                    color: isToday ? '#1e3a5f' : isHigh ? '#dc2626' : '#374151',
                    marginBottom: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      ...(isToday ? {
                        background: '#1e3a5f', color: 'white',
                        borderRadius: '50%', width: '18px', height: '18px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px',
                      } : {})
                    }}>{d}</span>
                    {isHigh && <span style={{ fontSize: '9px' }}>⚠️</span>}
                  </div>

                  {/* Leave chips / dots */}
                  {hasLeaves && (
                    mobile ? (
                      // Mobile: count + dot
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '800',
                          color: isHigh ? '#dc2626' : '#1e3a5f',
                        }}>{recs.length}</span>
                        {recs.slice(0, 3).map((r, i) => {
                          const c = leaveTypeColor(r.leave_type)
                          return <span key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        })}
                      </div>
                    ) : (
                      // Desktop: show up to 3 name chips + overflow count
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {recs.slice(0, 3).map((r, i) => {
                          const c = leaveTypeColor(r.leave_type)
                          return (
                            <div key={i} style={{
                              fontSize: '9px', fontWeight: '600',
                              background: c.bg, color: c.color,
                              borderRadius: '4px', padding: '1px 4px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {r.student_name?.split(' ')[0] || '—'}
                            </div>
                          )
                        })}
                        {recs.length > 3 && (
                          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', padding: '1px 4px' }}>
                            +{recs.length - 3} more
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Threshold warning bar at bottom */}
                  {isHigh && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '3px', background: '#dc2626', borderRadius: '0 0 6px 6px',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Day detail side panel (Feature 40) */}
        {selectedDay && (
          <div style={{
            background: 'white', borderRadius: '14px', padding: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
            ...(mobile ? { marginTop: '12px' } : {}),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e3a5f' }}>
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {selectedRecs.length} student{selectedRecs.length !== 1 ? 's' : ''} out
                  {totalStudents > 0 && ` · ${Math.round(selectedRecs.length / totalStudents * 100)}% of ${houseFilter === 'All' ? 'all' : houseFilter}`}
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >✕</button>
            </div>

            {/* Threshold warning banner (Feature 42) */}
            {selectedRecs.length > 0 && totalStudents > 0 && Math.round(selectedRecs.length / totalStudents * 100) >= THRESHOLD_PCT && (
              <div style={{
                background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: '10px',
                padding: '10px 12px', marginBottom: '12px', fontSize: '12px',
                color: '#dc2626', fontWeight: '700',
              }}>
                ⚠️ {Math.round(selectedRecs.length / totalStudents * 100)}% of students out — unusually high
              </div>
            )}

            {/* Student list */}
            {selectedRecs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                No students on leave this day
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {selectedRecs.map(r => {
                  const c = leaveTypeColor(r.leave_type)
                  return (
                    <div key={r.id} style={{
                      borderRadius: '10px', padding: '10px 12px',
                      background: c.bg, borderLeft: `3px solid ${c.dot}`,
                    }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '3px' }}>
                        {r.student_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {r.gcc_no && <span>GCC-{r.gcc_no}</span>}
                        {r.house && <span>🏠 {r.house}</span>}
                        <span style={{ color: c.color, fontWeight: '700' }}>{r.leave_type}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                        {r.from_date} → {r.to_date}
                        {r.expected_return && ` · Return: ${new Date(r.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Upcoming leaves preview (Feature 43) */}
      {upcoming.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            📅 Next 7 Days — Students Out
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upcoming.map(({ dateStr, recs, label }) => {
              const isHigh = totalStudents > 0 && Math.round(recs.length / totalStudents * 100) >= THRESHOLD_PCT
              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    // Navigate to that month if needed
                    const d = new Date(dateStr + 'T00:00:00')
                    setViewMonth(d.getMonth())
                    setViewYear(d.getFullYear())
                    setSelectedDay(dateStr)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: isHigh ? '#fff1f2' : 'white',
                    borderRadius: '10px', padding: '10px 14px',
                    border: `1px solid ${isHigh ? '#fca5a5' : '#e2e8f0'}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isHigh ? '#fee2e2' : '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = isHigh ? '#fff1f2' : 'white'}
                >
                  {/* Date label */}
                  <div style={{ minWidth: '80px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: isHigh ? '#dc2626' : '#1e3a5f' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{dateStr}</div>
                  </div>

                  {/* Count */}
                  <div style={{ fontSize: '20px', fontWeight: '800', color: isHigh ? '#dc2626' : '#1e3a5f', minWidth: '28px' }}>
                    {recs.length}
                  </div>

                  {/* Type dots */}
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {recs.slice(0, mobile ? 3 : 6).map((r, i) => {
                      const c = leaveTypeColor(r.leave_type)
                      return (
                        <span key={i} style={{
                          fontSize: '10px', fontWeight: '600',
                          background: c.bg, color: c.color,
                          padding: '2px 6px', borderRadius: '99px',
                        }}>
                          {r.student_name?.split(' ')[0]}
                        </span>
                      )
                    })}
                    {recs.length > (mobile ? 3 : 6) && (
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>+{recs.length - (mobile ? 3 : 6)}</span>
                    )}
                  </div>

                  {isHigh && <span style={{ fontSize: '14px' }}>⚠️</span>}
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>→</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {upcoming.length === 0 && activeRecords.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', marginTop: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
          No approved leaves found{houseFilter !== 'All' ? ` for ${houseFilter} house` : ''}.
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  ANALYTICS DASHBOARD
//  Feature 44: total leaves this month
//  Feature 45: approval rate %
//  Feature 46: average leave duration
//  Feature 47: overdue rate %
//  Feature 48: leaves by type (bar chart)
//  Feature 49: leave frequency by month (line chart)
//  Feature 50: top 10 frequent leave-takers table
//  Feature 51: house comparison bar chart
//  Feature 52: repeat pattern flag (same dates 3 months running)
//  Feature 53: balance utilization per student
// ══════════════════════════════════════════════════════════════
function LeaveAnalyticsDashboard({ records, students }) {
  const mobile = useMobileView()
  const [yearFilter, setYearFilter] = useState(currentAcademicYear())
  const [houseFilter, setHouseFilter] = useState('All')

  const houses = useMemo(() =>
    ['All', ...[...new Set(students.map(s => s.house).filter(Boolean))].sort()],
    [students]
  )

  // Academic year range for filtering
  const yearRange = useMemo(() => {
    const [startY] = yearFilter.split('-')
    const start = new Date(`${startY}-04-01`)
    const end   = new Date(`${parseInt(startY)+1}-03-31`)
    return { start, end }
  }, [yearFilter])

  // Filtered records for selected year + house
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (!r.from_date) return false
      const d = new Date(r.from_date)
      if (d < yearRange.start || d > yearRange.end) return false
      if (houseFilter !== 'All' && r.house !== houseFilter) return false
      return true
    })
  }, [records, yearRange, houseFilter])

  // ── Feature 44: this month stats
  const thisMonth = useMemo(() => {
    const now = new Date()
    return filtered.filter(r => {
      const d = new Date(r.from_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }, [filtered])

  // ── Feature 48: leaves by type
  const byType = useMemo(() => {
    const counts = {}
    filtered.forEach(r => { counts[r.leave_type] = (counts[r.leave_type] || 0) + 1 })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Feature 49: monthly frequency (academic year order)
  const byMonth = useMemo(() => {
    const counts = {}
    filtered.forEach(r => {
      if (!r.from_date) return
      const d   = new Date(r.from_date)
      const key = monthLabel(d.getMonth())
      counts[key] = (counts[key] || 0) + 1
    })
    return ACADEMIC_MONTHS.map(m => ({ month: m, leaves: counts[m] || 0 }))
  }, [filtered])

  // ── Feature 50: top 10 frequent leave-takers
  const topTakers = useMemo(() => {
    const counts = {}
    filtered.forEach(r => {
      if (!r.student_id) return
      const key = r.student_id
      if (!counts[key]) counts[key] = { student_name: r.student_name, gcc_no: r.gcc_no, house: r.house, class_name: r.class_name, count: 0, types: {} }
      counts[key].count++
      counts[key].types[r.leave_type] = (counts[key].types[r.leave_type] || 0) + 1
    })
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filtered])

  // ── Feature 51: house comparison
  const byHouse = useMemo(() => {
    const counts = {}
    filtered.forEach(r => {
      const h = r.house || 'Unknown'
      counts[h] = (counts[h] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Feature 52: repeat pattern detection (same month-day pattern 3+ months)
  const repeatPatterns = useMemo(() => {
    const studentMonths = {}
    filtered.forEach(r => {
      if (!r.student_id || !r.from_date) return
      const d   = new Date(r.from_date)
      const key = r.student_id
      if (!studentMonths[key]) studentMonths[key] = { name: r.student_name, gcc_no: r.gcc_no, months: [] }
      studentMonths[key].months.push(d.getMonth())
    })
    // Flag students with leaves in 3+ different months
    return Object.values(studentMonths)
      .filter(s => new Set(s.months).size >= 3)
      .slice(0, 10)
  }, [filtered])

  // ── Feature 53: balance utilization (from leave_balances table)
  const [balanceData, setBalanceData] = useState([])
  const [balLoading,  setBalLoading]  = useState(false)
  useEffect(() => {
    setBalLoading(true)
    supabase
      .from('leave_balances')
      .select('student_id, leave_type, total_quota, used, remaining, is_unlimited')
      .eq('academic_year', yearFilter)
      .then(({ data }) => {
        setBalanceData(data || [])
        setBalLoading(false)
      })
  }, [yearFilter])

  // Students who have used >= 75% of any quota
  const highUtilization = useMemo(() => {
    return balanceData
      .filter(b => !b.is_unlimited && b.total_quota > 0 && (b.used / b.total_quota) >= 0.75)
      .map(b => {
        const s = students.find(s => s.id === b.student_id)
        return {
          ...b,
          student_name: s?.name || '—',
          house:        s?.house || '—',
          pct:          Math.round(b.used / b.total_quota * 100),
        }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10)
  }, [balanceData, students])

  // ── KPI card helper
  const KPI = ({ icon, label, value, sub, color = '#1e3a5f', bg = '#eff6ff' }) => (
    <div style={{
      background: bg, borderRadius: '12px', padding: '16px',
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '11px', color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: mobile ? '24px' : '28px', fontWeight: '800', color, margin: '4px 0' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#64748b' }}>{sub}</div>}
    </div>
  )

  // Year options
  const yearOptions = ['2023-24','2024-25','2025-26','2026-27']

  return (
    <div>
      {/* ── Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '120px' }}>
          {yearOptions.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '130px' }}>
          {houses.map(h => <option key={h}>{h === 'All' ? 'All Houses' : h}</option>)}
        </select>
        <div style={{ fontSize: '13px', color: '#64748b', alignSelf: 'center', fontWeight: '600' }}>
          {filtered.length} records · {yearFilter}{houseFilter !== 'All' ? ` · ${houseFilter}` : ''}
        </div>
      </div>

      {/* ── KPI row (Features 44-47) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        <KPI icon="📋" label="Total Leaves" value={filtered.length}
          sub={`${thisMonth.length} this month`} color="#1e3a5f" bg="#eff6ff" />
        <KPI icon="✅" label="Approval Rate" value={`${approvalRate(filtered)}%`}
          sub={`${filtered.filter(r => (r.approval_level??0) >= 2).length} approved`} color="#16a34a" bg="#dcfce7" />
        <KPI icon="📅" label="Avg Duration" value={`${avgDuration(filtered)}d`}
          sub="days per leave" color="#7c3aed" bg="#f5f3ff" />
        <KPI icon="⚠️" label="Overdue Rate" value={`${overdueRate(filtered)}%`}
          sub="of returned leaves" color="#dc2626" bg="#fee2e2" />
        <KPI icon="👥" label="Unique Students" value={new Set(filtered.map(r => r.student_id).filter(Boolean)).size}
          sub="took leave" color="#ca8a04" bg="#fef9c3" />
        <KPI icon="🔴" label="Repeat Patterns" value={repeatPatterns.length}
          sub="≥3 months" color="#be185d" bg="#fce7f3" />
      </div>

      {/* ── Charts row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
        gap: '16px', marginBottom: '24px',
      }}>

        {/* Feature 48: Leaves by type — bar chart */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>
            🚪 Leaves by Type
          </div>
          {byType.length === 0
            ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px', fontSize: '13px' }}>No data</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byType} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v) => [v, 'Leaves']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Feature 49: Monthly frequency — line chart */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>
            📈 Monthly Leave Frequency · {yearFilter}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={byMonth} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Leaves']} />
              <Line type="monotone" dataKey="leaves" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3, fill: '#1d4ed8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Feature 51: House comparison — bar chart */}
        {byHouse.length > 0 && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>
              🏠 House Comparison
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byHouse} margin={{ left: -10, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Leaves']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {byHouse.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Leave type pie — bonus visual */}
        {byType.length > 0 && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>
              🥧 Leave Type Distribution
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={byType} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Leaves']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Feature 50: Top 10 frequent leave-takers */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>
          🏆 Top 10 Most Frequent Leave-Takers
        </div>
        {topTakers.length === 0
          ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '13px' }}>No data for this period</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '500px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#', 'Student', 'GCC', 'House', 'Class', 'Total Leaves', 'Most Common Type'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topTakers.map((s, i) => {
                    const topType = Object.entries(s.types).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'
                    const c = leaveTypeColor(topType)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <td style={{ padding: '10px 12px', color: i < 3 ? '#ca8a04' : '#94a3b8', fontWeight: '800', fontSize: '14px' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>{s.student_name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f' }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.house || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.class_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: `${Math.min(s.count * 12, 80)}px`, height: '6px', background: '#1d4ed8', borderRadius: '99px' }} />
                            <span style={{ fontWeight: '800', color: '#1e3a5f' }}>{s.count}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: c.bg, color: c.color, padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700' }}>
                            {topType}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* ── Feature 52: Repeat pattern flags */}
      {repeatPatterns.length > 0 && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
            🔁 Repeat Pattern Flags
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            Students who took leave in 3+ different months this year — may indicate chronic pattern
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {repeatPatterns.map((s, i) => (
              <div key={i} style={{
                background: '#fff7ed', border: '1.5px solid #fed7aa',
                borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
              }}>
                <div style={{ fontWeight: '700', color: '#9a3412' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {s.gcc_no ? `GCC-${s.gcc_no}` : '—'} · {new Set(s.months).size} months
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Feature 53: Balance utilization */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
          📊 High Balance Utilization (≥75% quota used)
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
          Students approaching or at their annual leave quota
        </div>
        {balLoading
          ? <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>⏳ Loading balance data...</div>
          : highUtilization.length === 0
          ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '13px' }}>No students at high utilization for {yearFilter}</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {highUtilization.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', background: b.pct >= 100 ? '#fee2e2' : '#fff7ed',
                  borderRadius: '10px',
                  border: `1px solid ${b.pct >= 100 ? '#fca5a5' : '#fed7aa'}`,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{b.student_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{b.house || '—'} · {b.leave_type}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 2, minWidth: '160px' }}>
                    <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(b.pct, 100)}%`,
                        background: b.pct >= 100 ? '#dc2626' : '#ca8a04',
                        borderRadius: '99px', transition: 'width 0.4s',
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: b.pct >= 100 ? '#dc2626' : '#ca8a04', minWidth: '36px' }}>
                      {b.pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {b.used}/{b.total_quota} used
                  </div>
                  {b.pct >= 100 && (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '99px' }}>
                      🚫 Quota full
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  NOTIFICATION LOG PANEL (Feature 58)
// ══════════════════════════════════════════════════════════════
function NotificationLogPanel({ onClose }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const PAGE_SIZE = 20

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notification_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setLogs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [page])

  const statusColor = s => ({
    sent:    { bg: '#dcfce7', color: '#16a34a' },
    failed:  { bg: '#fee2e2', color: '#dc2626' },
    skipped: { bg: '#fef9c3', color: '#ca8a04' },
  }[s] || { bg: '#e0f2fe', color: '#0891b2' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '680px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📋 Notification Log</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        {loading
          ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Loading...</div>
          : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {logs.length === 0
                ? <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>No notifications sent yet</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {logs.map(l => {
                      const sc = statusColor(l.status)
                      return (
                        <div key={l.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div>
                              <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{l.student_name}</span>
                              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{l.phone}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: sc.bg, color: sc.color }}>{l.status}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{l.trigger}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151', background: 'white', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px', border: '1px solid #e2e8f0' }}>
                            {l.message}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                            <span>{l.sent_at ? new Date(l.sent_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                            {/* Feature 60: copy message button as WhatsApp fallback */}
                            <button
                              onClick={() => { navigator.clipboard.writeText(l.message); alert('Message copied!') }}
                              style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', color: '#16a34a', cursor: 'pointer' }}
                            >
                              📋 Copy for WhatsApp
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>
          )
        }
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px', opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Page {page + 1}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px', opacity: logs.length < PAGE_SIZE ? 0.4 : 1 }}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION TEMPLATE EDITOR (Feature 59)
// ══════════════════════════════════════════════════════════════
function NotificationTemplateEditor({ onClose }) {
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [preview,   setPreview]   = useState({})

  const TRIGGER_LABELS = {
    approved: '✅ On Approval',
    rejected: '❌ On Rejection',
    returned: '🏠 On Return',
    overdue:  '⚠️ Overdue Alert',
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('notification_templates').select('*')
    // Merge with defaults — ensure all 4 triggers have a row
    const merged = Object.keys(NOTIF_TRIGGERS).map(key => {
      const trigger  = NOTIF_TRIGGERS[key]
      const existing = (data || []).find(t => t.trigger_event === trigger)
      return existing || {
        trigger_event:    trigger,
        message_template: DEFAULT_TEMPLATES[trigger] || '',
        is_active:        true,
        _virtual:         true,
      }
    })
    setTemplates(merged)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const updateField = (trigger, field, value) => {
    setTemplates(prev => prev.map(t => t.trigger_event === trigger ? { ...t, [field]: value } : t))
  }

  const handleSave = async () => {
    setSaving(true)
    for (const tpl of templates) {
      if (tpl.id) {
        await supabase.from('notification_templates').update({
          message_template: tpl.message_template,
          is_active:        tpl.is_active,
        }).eq('id', tpl.id)
      } else {
        await supabase.from('notification_templates').insert([{
          trigger_event:    tpl.trigger_event,
          message_template: tpl.message_template,
          is_active:        tpl.is_active ?? true,
        }])
      }
    }
    setSaving(false)
    alert('✅ Templates saved')
    load()
  }

  const PLACEHOLDER_HELP = '{name} {leave_type} {from_date} {to_date} {expected_return} {actual_return} {hm_name} {hm_phone} {school}'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📝 SMS Templates</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
          <strong>Available placeholders:</strong> {PLACEHOLDER_HELP}
        </div>

        {loading
          ? <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>⏳ Loading...</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {templates.map(tpl => (
                <div key={tpl.trigger_event} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                      {TRIGGER_LABELS[tpl.trigger_event] || tpl.trigger_event}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={tpl.is_active !== false}
                        onChange={e => updateField(tpl.trigger_event, 'is_active', e.target.checked)}
                        style={{ width: '14px', height: '14px' }}
                      />
                      Active
                    </label>
                  </div>
                  <textarea
                    value={tpl.message_template}
                    onChange={e => {
                      updateField(tpl.trigger_event, 'message_template', e.target.value)
                      // Live char count for SMS (160 char limit)
                      setPreview(p => ({ ...p, [tpl.trigger_event]: e.target.value.length }))
                    }}
                    rows={3}
                    style={{ ...inp, resize: 'vertical', fontSize: '13px', opacity: tpl.is_active === false ? 0.5 : 1 }}
                    disabled={tpl.is_active === false}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                    <span style={{ color: '#64748b' }}>
                      ~{Math.ceil((preview[tpl.trigger_event] || tpl.message_template.length) / 160)} SMS part(s)
                    </span>
                    <span style={{ color: (preview[tpl.trigger_event] || tpl.message_template.length) > 160 ? '#ca8a04' : '#94a3b8' }}>
                      {preview[tpl.trigger_event] || tpl.message_template.length} chars
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        }

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>
            {saving ? '⏳ Saving...' : '✅ Save Templates'}
          </button>
          <button onClick={onClose} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MSG91 CONFIG PANEL — set auth key + sender ID
// ══════════════════════════════════════════════════════════════
function NotificationConfigPanel({ onClose }) {
  const [cfg,     setCfg]     = useState({ msg91_auth_key: '', sender_id: 'GNSI', school_phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    supabase.from('notification_config').select('*').single()
      .then(({ data }) => { if (data) setCfg(c => ({ ...c, ...data })); setLoading(false) })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: existing } = await supabase.from('notification_config').select('id').single()
    const payload = { msg91_auth_key: cfg.msg91_auth_key, sender_id: cfg.sender_id, school_phone: cfg.school_phone }
    if (existing?.id) {
      await supabase.from('notification_config').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('notification_config').insert([payload])
    }
    setSaving(false)
    alert('✅ Config saved')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📡 MSG91 SMS Config</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        {loading
          ? <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>⏳ Loading...</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#1e3a5f' }}>
                Get your auth key from <strong>msg91.com</strong> → API → Auth Key. Sender ID must be approved by MSG91 (6 chars, e.g. GNSI).
              </div>
              <div>
                <label style={lbl}>MSG91 Auth Key *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={cfg.msg91_auth_key}
                    onChange={e => setCfg(c => ({ ...c, msg91_auth_key: e.target.value }))}
                    placeholder="Enter MSG91 auth key"
                    style={{ ...inp, flex: 1 }}
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)} style={{ ...btn('#f1f5f9', '#374151'), padding: '10px 14px', fontSize: '13px' }}>
                    {showKey ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label style={lbl}>Sender ID</label>
                <input
                  value={cfg.sender_id}
                  onChange={e => setCfg(c => ({ ...c, sender_id: e.target.value.toUpperCase().slice(0, 6) }))}
                  placeholder="GNSI (max 6 chars)"
                  style={inp}
                  maxLength={6}
                />
              </div>
              <div>
                <label style={lbl}>School Contact Phone</label>
                <input
                  value={cfg.school_phone || ''}
                  onChange={e => setCfg(c => ({ ...c, school_phone: e.target.value }))}
                  placeholder="+91-9876543210"
                  style={inp}
                />
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Shown in the header of every printed Gate Pass.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>
                  {saving ? '⏳ Saving...' : '✅ Save Config'}
                </button>
                <button onClick={onClose} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
              </div>
            </div>
          )
        }
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  STUDENT SELF-SERVICE PORTAL
//  Feature 61: student submits own leave request (GCC no + DOB)
//  Feature 62: student checks request status
//  Feature 63: HM sees student-submitted vs HM-entered indicator
//  Feature 64: max 1 pending request per student at a time
// ══════════════════════════════════════════════════════════════

// ── Step 1 screen: GCC + DOB login
function StudentLoginScreen({ onLogin }) {
  const [gccNo,   setGccNo]   = useState('')
  const [dob,     setDob]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!gccNo.trim() || !dob) { setError('Please enter GCC No and Date of Birth'); return }
    setLoading(true); setError('')

    // Look up student by GCC no + DOB
    const { data, error: e } = await supabase
      .from('students')
      .select('id, name, gcc_no, class_name, batch, house, hostel_type, dob, status')
      .eq('gcc_no', gccNo.trim())
      .eq('dob', dob)
      .single()

    if (e || !data) {
      setError('No student found with this GCC No and Date of Birth. Please check and try again.')
      setLoading(false); return
    }
    if (data.status === 'Inactive') {
      setError('This student account is inactive. Contact the hostel office.')
      setLoading(false); return
    }
    setLoading(false)
    onLogin(data)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎓</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: '0 0 6px' }}>
          Student Leave Portal
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          {GNSI_NAME}
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>GCC Number *</label>
            <input
              value={gccNo}
              onChange={e => setGccNo(e.target.value)}
              placeholder="e.g. 729"
              style={inp}
              type="number"
              autoFocus
            />
          </div>
          <div>
            <label style={lbl}>Date of Birth *</label>
            <input
              value={dob}
              onChange={e => setDob(e.target.value)}
              type="date"
              style={inp}
            />
          </div>
          {error && (
            <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
              ⚠️ {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...btn(loading ? '#94a3b8' : '#1e3a5f'), width: '100%' }}
          >
            {loading ? '⏳ Verifying...' : '🔑 Login'}
          </button>
        </div>
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
          Use your GCC number and date of birth to login
        </div>
      </div>
    </div>
  )
}

// ── Status pill for student view (simpler wording)
function StudentStatusPill({ record }) {
  const d = getApprovalDisplay(record)
  return (
    <span style={{
      padding: '5px 12px', borderRadius: '99px', fontSize: '13px',
      fontWeight: '700', background: d.bg, color: d.color,
      display: 'inline-block',
    }}>
      {d.label}
    </span>
  )
}

// ── Step 2: Main student portal (request + status view)
function StudentSelfServicePortal({ student, onLogout }) {
  const [records,    setRecords]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [activeView, setActiveView] = useState('status') // 'status' | 'new'
  const mobile = useMobileView()

  const [form, setForm] = useState({
    leave_type:      'Home Leave',
    from_date:       today(),
    to_date:         today(),
    expected_return: '',
    purpose:         '',
    parent_contact:  '',
  })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leave_records')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [student.id])

  // Feature 64: check for existing pending request
  const hasPending = records.some(r => r.status === 'Pending' && (r.approval_level ?? 0) === 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Feature 64: block if already has pending
    if (hasPending) {
      alert('You already have a pending leave request. Please wait for it to be processed before submitting another.')
      return
    }
    if (!form.purpose.trim()) { alert('Please describe your reason for leave'); return }
    setSaving(true)

    const payload = {
      student_id:      student.id,
      student_name:    student.name,
      gcc_no:          student.gcc_no   || null,
      class_name:      student.batch    || student.class_name || '',
      house:           student.house    || '',
      leave_type:      form.leave_type,
      from_date:       form.from_date,
      to_date:         form.to_date,
      expected_return: form.expected_return || null,
      purpose:         form.purpose,
      parent_contact:  form.parent_contact || '',
      status:          'Pending',
      approval_level:  0,
      // Feature 63: mark as student-submitted
      requested_by:    'student',
      requested_at:    new Date().toISOString(),
    }

    const { error } = await supabase.from('leave_records').insert([payload])
    if (error) { alert('Error submitting: ' + error.message); setSaving(false); return }

    // Reset form
    setForm({ leave_type: 'Home Leave', from_date: today(), to_date: today(), expected_return: '', purpose: '', parent_contact: '' })
    setSaving(false)
    setActiveView('status')
    load()
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '16px 0' }}>
      {/* Header */}
      <div style={{ background: '#1e3a5f', borderRadius: '16px', padding: '20px', marginBottom: '20px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>
              👋 {student.name}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>
              GCC-{student.gcc_no || '--'} · {student.batch || student.class_name || '--'} · {student.house || '--'}
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '20px', background: 'white' }}>
        {[['status', '📋 My Requests'], ['new', '➕ New Request']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveView(id)} style={{
            flex: 1, padding: '12px', border: 'none',
            background: activeView === id ? '#1e3a5f' : 'white',
            color: activeView === id ? 'white' : '#64748b',
            fontWeight: activeView === id ? '700' : '500',
            fontSize: '14px', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── View: New Request (Feature 61) */}
      {activeView === 'new' && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 16px' }}>
            🚪 Leave Request Form
          </h3>

          {/* Feature 64: block if pending exists */}
          {hasPending && (
            <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#ca8a04', marginBottom: '4px' }}>
                ⏳ You already have a pending request
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                You can only have 1 pending request at a time. Please wait for your current request to be processed.
              </div>
              <button onClick={() => setActiveView('status')} style={{ ...btn('#fef9c3', '#ca8a04'), fontSize: '12px', padding: '6px 14px', marginTop: '8px', border: '1px solid #fde047' }}>
                View My Requests →
              </button>
            </div>
          )}

          {/* Show balance for selected type */}
          {student.id && form.leave_type && (
            <div style={{ marginBottom: '14px' }}>
              <BalanceCard studentId={student.id} leaveType={form.leave_type} />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Leave Type *</label>
                <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={inp}>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={lbl}>From Date *</label>
                  <input type="date" value={form.from_date} min={today()} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required style={inp} />
                </div>
                <div>
                  <label style={lbl}>To Date *</label>
                  <input type="date" value={form.to_date} min={form.from_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Expected Return</label>
                <input type="datetime-local" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Purpose / Reason *</label>
                <textarea
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  rows={3}
                  placeholder="Please describe your reason for leave..."
                  required
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={lbl}>Parent Contact Number</label>
                <input
                  value={form.parent_contact}
                  onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))}
                  placeholder="Parent phone number"
                  type="tel"
                  style={inp}
                />
              </div>
              <button
                type="submit"
                disabled={saving || hasPending}
                style={{ ...btn(saving || hasPending ? '#94a3b8' : '#16a34a'), width: '100%' }}
              >
                {saving ? '⏳ Submitting...' : '✅ Submit Leave Request'}
              </button>
              <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                Your request will be reviewed by the House Master. You will be notified via SMS.
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── View: Status Check (Feature 62) */}
      {activeView === 'status' && (
        <div>
          {loading
            ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Loading your requests...</div>
            : records.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>No Leave Requests Yet</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>You haven't submitted any leave requests this year.</div>
                <button onClick={() => setActiveView('new')} style={{ ...btn('#1e3a5f'), padding: '10px 24px' }}>
                  ➕ Submit First Request
                </button>
              </div>
            )
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {records.map(r => {
                  const d   = getApprovalDisplay(r)
                  const overstay = calcOverstay(r.expected_return, r.actual_return)
                  return (
                    <div key={r.id} style={{
                      background: 'white', borderRadius: '14px', padding: '18px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: `1.5px solid ${d.color}30`,
                      borderLeft: `4px solid ${d.color}`,
                    }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{r.leave_type}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {r.from_date} → {r.to_date}
                          </div>
                        </div>
                        <StudentStatusPill record={r} />
                      </div>

                      {/* Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                        {r.expected_return && (
                          <div>⏰ Return by: {new Date(r.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        )}
                        {r.actual_return && (
                          <div style={{ color: '#16a34a' }}>🏠 Returned: {new Date(r.actual_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        )}
                        {/* Feature 63: student-submitted badge */}
                        {r.requested_by === 'student' && (
                          <div style={{ color: '#7c3aed', fontWeight: '600' }}>🎓 Self-submitted</div>
                        )}
                      </div>

                      {/* Purpose */}
                      {r.purpose && (
                        <div style={{ fontSize: '13px', color: '#374151', marginBottom: '10px', lineHeight: 1.4 }}>
                          📝 {r.purpose}
                        </div>
                      )}

                      {/* Rejection reason */}
                      {r.status === 'Rejected' && r.rejection_reason && (
                        <div style={{ background: '#fee2e2', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600', marginBottom: '10px' }}>
                          ❌ Rejected: {r.rejection_reason}
                        </div>
                      )}

                      {/* Sent back notice */}
                      {r.status === 'Pending' && (r.approval_level ?? 0) === 0 && r.rejection_reason && (
                        <div style={{ background: '#fff7ed', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#9a3412', fontWeight: '600', marginBottom: '10px' }}>
                          ↩️ Sent back for review: {r.rejection_reason}
                        </div>
                      )}

                      {/* Approval trail */}
                      {((r.hm_approved_by || r.supt_approved_by)) && (
                        <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', fontSize: '12px' }}>
                          {r.hm_approved_by && <div style={{ color: '#16a34a', marginBottom: '2px' }}>✅ HM Approved: {r.hm_approved_by}</div>}
                          {r.supt_approved_by && <div style={{ color: '#16a34a' }}>✅ Supt Approved: {r.supt_approved_by}</div>}
                        </div>
                      )}

                      {/* Overstay badge */}
                      {overstay?.isOverstay && (
                        <div style={{ marginTop: '8px' }}>
                          <OverstayBadge record={r} />
                        </div>
                      )}

                      {/* Gate pass button (if fully approved) */}
                      <GatePassButton record={r} compact={false} />
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

// ── Main wrapper: login → portal
export function StudentSelfService() {
  const [student, setStudent] = useState(null)

  if (!student) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <StudentLoginScreen onLogin={setStudent} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <StudentSelfServicePortal student={student} onLogout={() => setStudent(null)} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  REJECTION MODAL — mandatory reason before rejecting
// ══════════════════════════════════════════════════════════════
function RejectionModal({ record, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [error,  setError]  = useState(false)
  if (!record) return null

  const level = record.approval_level ?? 0
  const byWhom = level === 0 ? 'HM' : 'Superintendent'
  const consequence = level === 1
    ? 'This will void the HM approval and send the request back to ⏳ Pending HM.'
    : 'This will mark the request as ❌ Rejected.'

  const handleConfirm = () => {
    if (!reason.trim()) { setError(true); return }
    onConfirm(reason.trim())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>❌</div>
        <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', textAlign: 'center', margin: '0 0 6px' }}>
          Reject Leave Request
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.5 }}>
          <strong>{record.student_name}</strong> · {record.leave_type} · {record.from_date} → {record.to_date}
        </p>
        <p style={{ fontSize: '12px', color: '#dc2626', textAlign: 'center', margin: '0 0 18px', fontWeight: '600' }}>
          {consequence}
        </p>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...lbl, color: error ? '#dc2626' : '#374151' }}>
            Reason for rejection * {error && <span style={{ fontWeight: '400' }}>(required)</span>}
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError(false) }}
            rows={3}
            placeholder="e.g. Exam period, insufficient notice, quota exceeded..."
            autoFocus
            style={{ ...inp, resize: 'vertical', border: error ? '1.5px solid #dc2626' : '1px solid #d1d5db' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleConfirm} style={{ ...btn('#dc2626'), flex: 1 }}>❌ Confirm Rejection</button>
          <button onClick={onCancel}      style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  APPROVAL CONFIRM MODAL — optional remarks before approving
// ══════════════════════════════════════════════════════════════
function ApprovalConfirmModal({ record, role, onConfirm, onCancel }) {
  const [remarks, setRemarks] = useState('')
  if (!record) return null

  const level = record.approval_level ?? 0
  const nextLabel = level === 0 ? '🔵 Pending Superintendent' : '✅ Fully Approved'
  const actionLabel = level === 0 ? 'HM Approval' : 'Superintendent Approval'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>✅</div>
        <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', textAlign: 'center', margin: '0 0 6px' }}>
          Confirm {actionLabel}
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 4px', lineHeight: 1.5 }}>
          <strong>{record.student_name}</strong> · {record.leave_type}
        </p>
        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 18px' }}>
          {record.from_date} → {record.to_date}
          {record.expected_return && ` · Return by ${new Date(record.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`}
        </p>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600', textAlign: 'center' }}>
          Status will move to: {nextLabel}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Approval remarks <span style={{ fontWeight: '400', color: '#94a3b8' }}>(optional)</span></label>
          <input
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Inform guard at main gate"
            style={inp}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onConfirm(remarks.trim())} style={{ ...btn('#16a34a'), flex: 1 }}>✅ Approve</button>
          <button onClick={onCancel} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  APPROVAL HISTORY PANEL — inline expandable trail per record
// ══════════════════════════════════════════════════════════════
function ApprovalHistoryPanel({ leaveId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leaveId) return
    supabase
      .from('leave_approvals')
      .select('*')
      .eq('leave_id', leaveId)
      .order('actioned_at', { ascending: true })
      .then(({ data }) => { setHistory(data || []); setLoading(false) })
  }, [leaveId])

  if (loading) return <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px' }}>⏳ Loading history...</div>
  if (history.length === 0) return <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px' }}>No approval actions yet.</div>

  const actionIcon  = a => a === 'Approved' ? '✅' : a === 'Rejected' ? '❌' : '↩️'
  const levelLabel  = l => l === 0 ? 'HM' : l === 1 ? 'Superintendent' : 'System'
  const actionColor = a => a === 'Approved' ? '#16a34a' : a === 'Rejected' ? '#dc2626' : '#ca8a04'

  return (
    <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', marginTop: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Approval Trail
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {history.map((h, i) => (
          <div key={h.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '16px', marginTop: '1px' }}>{actionIcon(h.action)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: actionColor(h.action) }}>
                {h.action} · <span style={{ fontWeight: '600', color: '#374151' }}>{levelLabel(h.level)} level</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                by {h.actioned_by} · {h.actioned_at ? new Date(h.actioned_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
              </div>
              {h.remarks && (
                <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px', fontStyle: 'italic' }}>
                  "{h.remarks}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION MODAL
// ══════════════════════════════════════════════════════════════
function DeleteModal({ record, onConfirm, onCancel }) {
  if (!record) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '28px',
        maxWidth: '420px', width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>🗑️</div>
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', textAlign: 'center', margin: '0 0 8px' }}>
          Delete Leave Record?
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
          You are about to delete the leave record for <strong>{record.student_name}</strong> ({record.leave_type}, {record.from_date}).
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onConfirm}
            style={{ ...btn('#dc2626'), flex: 1, fontSize: '14px' }}
          >
            🗑 Yes, Delete
          </button>
          <button
            onClick={onCancel}
            style={{ ...btn('#f1f5f9', '#374151'), flex: 1, fontSize: '14px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Staff Alert Banner — shows overdue/stuck alerts with a click-to-open
//    WhatsApp button per alert (can't auto-open wa.me without a user
//    gesture) and lets the user dismiss ones already handled.
function StaffAlertBanner({ links, onDismiss }) {
  if (!links || links.length === 0) return null
  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {links.map((link, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            padding: '12px 16px', borderRadius: '12px',
            background: link.kind === 'overdue' ? '#fff1f2' : '#fffbeb',
            border: `1.5px solid ${link.kind === 'overdue' ? '#fca5a5' : '#fcd34d'}`,
          }}
        >
          <span style={{ fontSize: '20px' }}>{link.kind === 'overdue' ? '🚨' : '⏳'}</span>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: link.kind === 'overdue' ? '#dc2626' : '#92400e' }}>
              {link.kind === 'overdue' ? 'Overdue Return' : 'Stuck Pending Approval'} — {link.studentName}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Push notification sent to {link.role || link.hmName || 'staff'}{link.name ? ` (${link.name})` : ''}
            </div>
          </div>
          {link.whatsappUrl && (
            <button
              onClick={() => window.open(link.whatsappUrl, '_blank')}
              style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#25D366', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              📲 Send WhatsApp
            </button>
          )}
          <button
            onClick={() => onDismiss(i)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#374151', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MAIN LEAVE TAB
// ══════════════════════════════════════════════════════════════
function LeaveTab({ students, currentHousemaster, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Form state
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)   // null = create mode, record = edit mode
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget,     setDeleteTarget]     = useState(null) // record to delete
  // ── Approval modal states
  const [approveTarget,    setApproveTarget]    = useState(null) // record pending approval confirm
  const [rejectTarget,     setRejectTarget]     = useState(null) // record pending rejection
  const [expandedHistory,   setExpandedHistory]   = useState(null) // leave_id whose trail is expanded
  // ── Balance / quota states
  const [quotaExceededRec,  setQuotaExceededRec]  = useState(null)  // record that triggered quota exceeded
  const [quotaExceededBal,  setQuotaExceededBal]  = useState(null)  // balance object at time of trigger
  const [pendingApproveRec, setPendingApproveRec] = useState(null)  // buffered record waiting quota check
  const [showQuotaAdmin,    setShowQuotaAdmin]    = useState(false) // quota config panel
  const [showBalancePanel,   setShowBalancePanel]   = useState(false) // per-student balance panel
  const [showCalendar,       setShowCalendar]       = useState(false) // calendar view toggle
  const [showAnalytics,      setShowAnalytics]      = useState(false) // analytics dashboard toggle
  // ── Notification state
  const [showNotifLog,     setShowNotifLog]     = useState(false) // notification log panel
  const [showNotifTpl,     setShowNotifTpl]     = useState(false) // template editor
  const [showNotifCfg,     setShowNotifCfg]     = useState(false) // MSG91 config
  // ── Return tracking state
  const [markReturnedTarget, setMarkReturnedTarget] = useState(null)  // record for MarkReturnedModal
  // ── Current user role (drives which actions are shown)
  // Pull from your portal_users / gnsi_staff_credentials auth system.
  // Default 'hm' for backwards compatibility. Set via props or context.
  const userRole = (currentUser?.role || currentHousemaster?.role || 'hm').toLowerCase()
  // userRole: 'hm' | 'superintendent' | 'admin'

  // ── Filter/search state
  const [filterStatus,  setFilterStatus]  = useState('All')
  const [filterType,    setFilterType]    = useState('All')
  const [filterHouse,   setFilterHouse]   = useState('All')
  const [filterBatch,   setFilterBatch]   = useState('All')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [search,        setSearch]        = useState('')
  const [showFilters,   setShowFilters]   = useState(false) // advanced filter panel toggle
  const [activeTab,     setActiveTab]     = useState('requests') // 'requests' | 'history'

  // ── Staff alerts (Overdue Return / Stuck Pending Approval) generated
  //    on this load — push sends automatically in the background, but
  //    WhatsApp needs a user click (browsers block auto-opening wa.me
  //    without a gesture), so these are surfaced as dismissible buttons.
  const [staffAlertLinks, setStaffAlertLinks] = useState([]) // [{ kind, studentName, role, whatsappUrl }]
  const dismissStaffAlert = (index) => setStaffAlertLinks(prev => prev.filter((_, i) => i !== index))

  const mobile = useMobileView()

  // ── Load records
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('leave_records')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Leave load error:', error)
    setRecords(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── BUG FIX #2 & #3: Overdue auto-update runs once on mount only,
  //    uses Promise.all so load() waits for all DB updates to finish
  useEffect(() => {
    const markOverdue = async () => {
      const now = new Date()
      const { data } = await supabase
        .from('leave_records')
        .select('*')  // need full record for SMS template
        .eq('status', 'Approved')
        .lt('expected_return', now.toISOString())
        .is('actual_return', null)
      if (!data || data.length === 0) return
      await Promise.all(
        data.map(r =>
          supabase.from('leave_records').update({ status: 'Overdue' }).eq('id', r.id)
        )
      )
      // ── Feature 57: send overdue alert SMS to parents
      // Only send for records newly marked overdue (not already notified)
      const toAlert = data.filter(r => r.parent_contact)
      if (toAlert.length > 0) {
        sendOverdueAlerts(toAlert.map(r => ({ ...r, status: 'Overdue' })))
      }
      // ── Also alert the housemaster of each student's house (push
      //    fires immediately; WhatsApp needs a click, so collect links)
      const hmAlertResults = await Promise.all(
        data.map(r => alertHousemasterOverdue(r).catch(e => { console.error('alertHousemasterOverdue failed:', e); return null }))
      )
      const newLinks = hmAlertResults
        .map((res, i) => res ? { kind: 'overdue', studentName: data[i].student_name, role: 'HM', ...res } : null)
        .filter(Boolean)
      if (newLinks.length > 0) setStaffAlertLinks(prev => [...prev, ...newLinks])
      load()
    }
    markOverdue()
  }, []) // ← empty deps: runs once on mount only

  // ── Stuck Pending Approval — records sitting in Pending HM or Pending
  //    Superintendent for 12+ hours get flagged to whichever role is
  //    currently blocking them. De-duped via notification_logs so the
  //    same record doesn't re-alert every time this tab is opened —
  //    only once per calendar day per record.
  useEffect(() => {
    const STUCK_THRESHOLD_HOURS = 12
    const checkStuckApprovals = async () => {
      const cutoff = new Date(Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000)
      const { data: stuck } = await supabase
        .from('leave_records')
        .select('*')
        .eq('status', 'Pending')
        .lt('created_at', cutoff.toISOString())
      if (!stuck || stuck.length === 0) return

      // Skip records already alerted today (avoid re-notifying on every load)
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { data: alreadyLogged } = await supabase
        .from('notification_logs')
        .select('leave_id')
        .eq('trigger', 'stuck_approval')
        .gte('sent_at', todayStart.toISOString())
      const alreadyLoggedIds = new Set((alreadyLogged || []).map(l => l.leave_id))
      const toAlert = stuck.filter(r => !alreadyLoggedIds.has(r.id))
      if (toAlert.length === 0) return

      const results = await Promise.all(
        toAlert.map(r => alertStuckApproval(r).catch(e => { console.error('alertStuckApproval failed:', e); return null }))
      )
      // Log each attempt (even if the WhatsApp link couldn't be built) so
      // the de-dupe check above skips it on the next load regardless
      await Promise.all(toAlert.map(r =>
        supabase.from('notification_logs').insert([{
          leave_id: r.id, student_name: r.student_name, phone: null,
          trigger: 'stuck_approval', message: `Stuck pending approval (${(r.approval_level ?? 0) === 0 ? 'HM' : 'Superintendent'})`,
          status: 'sent', sent_at: new Date().toISOString(),
        }])
      ))
      const newLinks = results
        .map((res, i) => res ? { kind: 'stuck', studentName: toAlert[i].student_name, ...res } : null)
        .filter(Boolean)
      if (newLinks.length > 0) setStaffAlertLinks(prev => [...prev, ...newLinks])
    }
    checkStuckApprovals()
  }, []) // ← empty deps: runs once on mount only, same pattern as markOverdue

  // ── Open create form
  const openCreate = () => {
    setEditRec(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    // Scroll to top of form on mobile
    if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Open edit form
  //    BUG FIX #4: properly seed form from record, including requested_at
  const openEdit = rec => {
    setEditRec(rec)
    setForm({
      student_id:      rec.student_id      || null,
      student_name:    rec.student_name    || '',
      gcc_no:          rec.gcc_no          || '',
      class_name:      rec.class_name      || '',
      house:           rec.house           || '',
      leave_type:      rec.leave_type      || 'Home Leave',
      from_date:       rec.from_date       || today(),
      to_date:         rec.to_date         || today(),
      expected_return: rec.expected_return || '',
      actual_return:   rec.actual_return   || '',
      purpose:         rec.purpose         || '',
      parent_contact:  rec.parent_contact  || '',
      parent_approved: rec.parent_approved || false,
      status:          rec.status          || 'Pending',
      remarks:         rec.remarks         || '',
      // Preserve original timestamps
      requested_at:    rec.requested_at    || rec.created_at || new Date().toISOString(),
      requested_by:    rec.requested_by    || currentHousemaster?.name || 'Admin',
    })
    setShowForm(true)
    if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Cancel form
  const cancelForm = () => {
    setShowForm(false)
    setEditRec(null)
    setForm(EMPTY_FORM)
  }

  // ── Save (create or update)
  const handleSave = async e => {
    e.preventDefault()
    if (!form.student_name) { alert('Please select a student first'); return }
    setSaving(true)

    const payload = {
      student_id:      form.student_id      || null,
      student_name:    form.student_name,
      gcc_no:          form.gcc_no          || null,
      class_name:      form.class_name      || '',
      house:           form.house           || '',
      leave_type:      form.leave_type,
      from_date:       form.from_date,
      to_date:         form.to_date,
      expected_return: form.expected_return || null,
      actual_return:   form.actual_return   || null,
      purpose:         form.purpose,
      parent_contact:  form.parent_contact  || '',
      parent_approved: form.parent_approved,
      status:          editRec ? form.status : 'Pending',
      remarks:         form.remarks         || '',
      // BUG FIX #4: on edit preserve original requested_at; on create use now
      requested_by:    editRec
                         ? (form.requested_by || currentHousemaster?.name || 'Admin')
                         : (currentHousemaster?.name || 'Admin'),
      requested_at:    editRec
                         ? (form.requested_at || form.created_at || new Date().toISOString())
                         : new Date().toISOString(),
    }

    const { error } = editRec
      ? await supabase.from('leave_records').update(payload).eq('id', editRec.id)
      : await supabase.from('leave_records').insert([payload])

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      cancelForm()
      load()
    }
    setSaving(false)
  }

  // ── Status change (approve / reject / returned)
  // ── HM Approve (level 0 → 1, status stays Pending)
  const handleHMApprove = async (remarks = '') => {
    if (!approveTarget) return
    setSaving(true)
    const actorName = currentHousemaster?.name || 'HM'
    const now = new Date().toISOString()

    // Update leave record: bump to level 1
    const { error: e1 } = await supabase
      .from('leave_records')
      .update({
        approval_level:  1,
        status:          'Pending',
        hm_approved_by:  actorName,
        hm_approved_at:  now,
        rejection_reason: null, // clear any old rejection
      })
      .eq('id', approveTarget.id)
    if (e1) { alert('Error: ' + e1.message); setSaving(false); return }

    // Insert audit row
    await supabase.from('leave_approvals').insert([{
      leave_id:    approveTarget.id,
      level:       0,
      action:      'Approved',
      actioned_by: actorName,
      actioned_at: now,
      remarks,
    }])

    setApproveTarget(null)
    setSaving(false)
    load()
  }

  // ── Superintendent Approve (level 1 → 2, status → Approved)
  const handleSuptApprove = async (remarks = '') => {
    if (!approveTarget) return
    setSaving(true)
    const actorName = currentHousemaster?.name || 'Superintendent'
    const now = new Date().toISOString()

    const { error: e1 } = await supabase
      .from('leave_records')
      .update({
        approval_level:   2,
        status:           'Approved',
        supt_approved_by: actorName,
        supt_approved_at: now,
        rejection_reason: null,
      })
      .eq('id', approveTarget.id)
    if (e1) { alert('Error: ' + e1.message); setSaving(false); return }

    await supabase.from('leave_approvals').insert([{
      leave_id:    approveTarget.id,
      level:       1,
      action:      'Approved',
      actioned_by: actorName,
      actioned_at: now,
      remarks,
    }])

    // ── Feature 18: decrement balance on final approval
    await decrementBalance(approveTarget.student_id, approveTarget.leave_type)

    // ── Feature 54: SMS to parent on full approval
    const approvedRecord = { ...approveTarget, status: 'Approved', supt_approved_by: actorName, approval_level: 2 }
    await dispatchNotification(NOTIF_TRIGGERS.APPROVED, approvedRecord, currentHousemaster?.name || 'Admin', currentHousemaster?.phone || '')

    setApproveTarget(null)
    setSaving(false)
    load()
  }

  // ── HM Reject (level 0 → straight Rejected)
  const handleHMReject = async (reason) => {
    if (!rejectTarget) return
    setSaving(true)
    const actorName = currentHousemaster?.name || 'HM'
    const now = new Date().toISOString()

    const { error: e1 } = await supabase
      .from('leave_records')
      .update({
        status:           'Rejected',
        approval_level:   0,
        rejection_reason: reason,
        rejected_by:      actorName,
        rejected_at:      now,
        hm_approved_by:   null,
        hm_approved_at:   null,
      })
      .eq('id', rejectTarget.id)
    if (e1) { alert('Error: ' + e1.message); setSaving(false); return }

    await supabase.from('leave_approvals').insert([{
      leave_id:    rejectTarget.id,
      level:       0,
      action:      'Rejected',
      actioned_by: actorName,
      actioned_at: now,
      remarks:     reason,
    }])

    // No balance to restore at level 0 — leave was never approved
    // ── Feature 55: SMS on rejection
    const rejectedRecord = { ...rejectTarget, status: 'Rejected', rejection_reason: reason }
    await dispatchNotification(NOTIF_TRIGGERS.REJECTED, rejectedRecord, currentHousemaster?.name || 'Admin', currentHousemaster?.phone || '')

    setRejectTarget(null)
    setSaving(false)
    load()
  }

  // ── Superintendent Reject (level 1 → back to level 0, Pending HM)
  const handleSuptReject = async (reason) => {
    if (!rejectTarget) return
    setSaving(true)
    const actorName = currentHousemaster?.name || 'Superintendent'
    const now = new Date().toISOString()

    const { error: e1 } = await supabase
      .from('leave_records')
      .update({
        status:           'Pending',
        approval_level:   0,           // reset back to HM level
        rejection_reason: reason,
        rejected_by:      actorName,
        rejected_at:      now,
        hm_approved_by:   null,        // void HM approval
        hm_approved_at:   null,
      })
      .eq('id', rejectTarget.id)
    if (e1) { alert('Error: ' + e1.message); setSaving(false); return }

    await supabase.from('leave_approvals').insert([{
      leave_id:    rejectTarget.id,
      level:       1,
      action:      'Rejected',
      actioned_by: actorName,
      actioned_at: now,
      remarks:     reason,
    }])

    // ── Feature 19: no balance was consumed yet (not fully approved), no increment needed
    if (rejectTarget.status === 'Approved' && (rejectTarget.approval_level ?? 0) >= 2) {
      await incrementBalance(rejectTarget.student_id, rejectTarget.leave_type)
    }
    // ── Feature 55: SMS on Superintendent rejection
    const suptRejectedRecord = { ...rejectTarget, status: 'Rejected', rejection_reason: reason }
    await dispatchNotification(NOTIF_TRIGGERS.REJECTED, suptRejectedRecord, currentHousemaster?.name || 'Admin', currentHousemaster?.phone || '')

    setRejectTarget(null)
    setSaving(false)
    load()
  }

  // ── Mark Returned — opens MarkReturnedModal (Feature 31)
  const handleMarkReturned = (record) => setMarkReturnedTarget(record)

  // ── Confirm return from modal (Features 32-37)
  const handleReturnConfirm = async ({ actualReturn, createDiscipline, incidentText, disciplineRemarks }) => {
    if (!markReturnedTarget) return
    const record    = markReturnedTarget
    const returnISO = actualReturn
      ? new Date(actualReturn).toISOString()
      : new Date().toISOString()

    // Feature 32: save actual return timestamp
    const { error } = await supabase
      .from('leave_records')
      .update({ status: 'Returned', actual_return: returnISO })
      .eq('id', record.id)
    if (error) { alert('Error: ' + error.message); return }

    // Feature 29: void gate pass
    await voidGatePass(record.id)

    // Feature 35 + 36: auto-create discipline record if overstay > 2h
    if (createDiscipline && incidentText) {
      await supabase.from('discipline_records').insert([{
        date:         new Date().toISOString().split('T')[0],
        student_id:   record.student_id   || null,
        gcc_no:       record.gcc_no       || null,
        student_name: record.student_name || '',
        class_name:   record.class_name   || '',
        incident:     incidentText,
        action_taken: '',
        reported_by:  currentHousemaster?.name || 'System',
        status:       'Open',
        remarks:      disciplineRemarks || '',
        // Feature 36: link back to leave record
        leave_id:     record.id,
      }])
    }

    // ── Feature 56: SMS to parent on return
    const returnedRecord = { ...record, status: 'Returned', actual_return: returnISO }
    await dispatchNotification(NOTIF_TRIGGERS.RETURNED, returnedRecord, currentHousemaster?.name || 'Admin', currentHousemaster?.phone || '')

    setMarkReturnedTarget(null)
    load()
  }

  // ── Feature 57: Overdue alert — called from overdue auto-update useEffect
  const sendOverdueAlerts = useCallback(async (overdueRecords) => {
    for (const record of overdueRecords) {
      await dispatchNotification(NOTIF_TRIGGERS.OVERDUE, record, currentHousemaster?.name || 'Admin', currentHousemaster?.phone || '')
    }
  }, [currentHousemaster])

  // ── Dispatch approve/reject based on current record level + userRole
  // ══════════════════════════════════════════════
  //  BALANCE ENGINE HELPERS
  // ══════════════════════════════════════════════

  // Ensure a balance row exists for student + year + leave_type
  // Returns the row (with id) — creates it if missing
  const ensureBalanceRow = async (studentId, leaveType) => {
    const year = currentAcademicYear()
    const { data: existing } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year', year)
      .eq('leave_type', leaveType)
      .maybeSingle()
    if (existing) return existing

    // Get quota config
    const { data: cfg } = await supabase
      .from('leave_quota_config')
      .select('*')
      .eq('academic_year', year)
      .eq('leave_type', leaveType)
      .maybeSingle()

    const quota     = cfg?.default_quota  ?? DEFAULT_QUOTAS[leaveType] ?? 4
    const unlimited = cfg?.is_unlimited   ?? (DEFAULT_QUOTAS[leaveType] === -1)

    const { data: created } = await supabase
      .from('leave_balances')
      .insert([{
        student_id:    studentId,
        academic_year: year,
        leave_type:    leaveType,
        total_quota:   unlimited ? 999 : quota,
        used:          0,
        remaining:     unlimited ? 999 : quota,
        is_unlimited:  unlimited,
        updated_at:    new Date().toISOString(),
      }])
      .select()
      .single()
    return created
  }

  // Decrement balance by 1 on approval
  const decrementBalance = async (studentId, leaveType) => {
    const row = await ensureBalanceRow(studentId, leaveType)
    if (!row || row.is_unlimited) return
    await supabase.from('leave_balances').update({
      used:       (row.used || 0) + 1,
      remaining:  Math.max(0, (row.remaining || 0) - 1),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
  }

  // Increment balance by 1 on rejection/deletion
  const incrementBalance = async (studentId, leaveType) => {
    if (!studentId || !leaveType) return
    const year = currentAcademicYear()
    const { data: row } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year', year)
      .eq('leave_type', leaveType)
      .maybeSingle()
    if (!row || row.is_unlimited) return
    await supabase.from('leave_balances').update({
      used:       Math.max(0, (row.used || 0) - 1),
      remaining:  Math.min(row.total_quota, (row.remaining || 0) + 1),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
  }

  // Check quota before showing approval confirm modal
  // If quota exceeded → show QuotaExceededModal instead
  const handleApproveClick = async (record) => {
    const level = record.approval_level ?? 0
    // Only check quota at final approval level (Superintendent = level 1)
    // HM approval (level 0) just moves to level 1, no leave is "granted" yet
    if (level < 1) {
      setApproveTarget(record)
      return
    }
    // Check balance before final approval
    const row = await ensureBalanceRow(record.student_id, record.leave_type)
    if (row && !row.is_unlimited && row.remaining <= 0) {
      // Quota exceeded — show override modal
      setQuotaExceededRec(record)
      setQuotaExceededBal(row)
      setPendingApproveRec(record)
    } else {
      setApproveTarget(record)
    }
  }

  // Override quota — approve anyway with reason logged
  const handleQuotaOverride = async (overrideReason) => {
    if (!pendingApproveRec) return
    // Log override in audit trail
    await supabase.from('leave_approvals').insert([{
      leave_id:    pendingApproveRec.id,
      level:       pendingApproveRec.approval_level ?? 1,
      action:      'QuotaOverride',
      actioned_by: currentHousemaster?.name || 'Admin',
      actioned_at: new Date().toISOString(),
      remarks:     `Quota exceeded override: ${overrideReason}`,
    }])
    setQuotaExceededRec(null)
    setQuotaExceededBal(null)
    setApproveTarget(pendingApproveRec)
    setPendingApproveRec(null)
  }

  const handleRejectClick = (record) => setRejectTarget(record)

  // ── Confirm approve (called from modal)
  const handleApproveConfirm = (remarks) => {
    if (!approveTarget) return
    const level = approveTarget.approval_level ?? 0
    if (level === 0) handleHMApprove(remarks)
    else             handleSuptApprove(remarks)
  }

  // ── Confirm reject (called from modal)
  const handleRejectConfirm = (reason) => {
    if (!rejectTarget) return
    const level = rejectTarget.approval_level ?? 0
    if (level === 0) handleHMReject(reason)
    else             handleSuptReject(reason)
  }

  // ── Can this user approve a record at its current level?
  const canApprove = (record) => {
    const level = record.approval_level ?? 0
    if (record.status === 'Rejected' || record.status === 'Returned' || record.status === 'Overdue') return false
    if (record.status === 'Approved' && level >= 2) return false
    if (level === 0) return userRole === 'hm' || userRole === 'house master' || userRole === 'admin'
    if (level === 1) return ['superintendent', 'admin'].includes(userRole)
    return false
  }

  // ── Can this user reject a record at its current level?
  const canReject = (record) => {
    if (record.status === 'Rejected' || record.status === 'Returned') return false
    if (record.status === 'Approved' && (record.approval_level ?? 0) >= 2) return false
    const level = record.approval_level ?? 0
    if (level === 0) return userRole === 'hm' || userRole === 'house master' || userRole === 'admin'
    if (level === 1) return userRole === 'superintendent' || userRole === 'admin'
    return false
  }

  // ── Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    // Feature 19: restore balance if record was fully approved
    if (deleteTarget.status === 'Approved' && (deleteTarget.approval_level ?? 0) >= 2) {
      await incrementBalance(deleteTarget.student_id, deleteTarget.leave_type)
    }
    const { error } = await supabase.from('leave_records').delete().eq('id', deleteTarget.id)
    if (error) { alert('Error deleting: ' + error.message); return }
    setDeleteTarget(null)
    load()
  }

  // ── Derived filter option lists (from live records)
  const houseOptions = useMemo(() => ['All', ...[...new Set(records.map(r => r.house).filter(Boolean))].sort()], [records])
  const batchOptions = useMemo(() => ['All', ...[...new Set(records.map(r => r.class_name).filter(Boolean))].sort()], [records])

  // ── Clear all filters
  const clearAllFilters = () => {
    setSearch('')
    setFilterStatus('All')
    setFilterType('All')
    setFilterHouse('All')
    setFilterBatch('All')
    setDateFrom('')
    setDateTo('')
  }

  // ── Is any filter active?
  const isFiltered = search || filterStatus !== 'All' || filterType !== 'All' ||
    filterHouse !== 'All' || filterBatch !== 'All' || dateFrom || dateTo

  // ── Active filter count (for badge)
  const activeFilterCount = [
    search, filterStatus !== 'All', filterType !== 'All',
    filterHouse !== 'All', filterBatch !== 'All', dateFrom, dateTo,
  ].filter(Boolean).length

  // ── Filtered records
  const filtered = useMemo(() => {
    let f = records

    // activeTab scoping
    if (activeTab === 'requests') {
      f = f.filter(r => ['Pending', 'Approved', 'Overdue'].includes(r.status))
    } else {
      f = f.filter(r => ['Rejected', 'Returned'].includes(r.status))
    }

    // status filter
    if (filterStatus !== 'All') {
      f = f.filter(r => r.status === filterStatus)
    }

    // leave type filter
    if (filterType !== 'All') {
      f = f.filter(r => r.leave_type === filterType)
    }

    // house filter
    if (filterHouse !== 'All') {
      f = f.filter(r => (r.house || '') === filterHouse)
    }

    // batch/class filter
    if (filterBatch !== 'All') {
      f = f.filter(r => (r.class_name || '') === filterBatch)
    }

    // date range filter — by from_date
    if (dateFrom) f = f.filter(r => r.from_date >= dateFrom)
    if (dateTo)   f = f.filter(r => r.from_date <= dateTo)

    // text search
    if (search.trim()) {
      const q = search.toLowerCase()
      f = f.filter(r =>
        (r.student_name || '').toLowerCase().includes(q) ||
        String(r.gcc_no  || '').includes(q)               ||
        (r.house         || '').toLowerCase().includes(q) ||
        (r.leave_type    || '').toLowerCase().includes(q) ||
        (r.purpose       || '').toLowerCase().includes(q) ||
        (r.class_name    || '').toLowerCase().includes(q)
      )
    }

    return f
  }, [records, filterStatus, filterType, filterHouse, filterBatch, dateFrom, dateTo, search, activeTab])

  // ── Summary stats (always from full records, not filtered)
  const stats = {
    pendingHM:    records.filter(r => r.status === 'Pending' && (r.approval_level ?? 0) === 0).length,
    pendingSuept: records.filter(r => r.status === 'Pending' && (r.approval_level ?? 0) === 1).length,
    approved:     records.filter(r => r.status === 'Approved' && (r.approval_level ?? 0) >= 2).length,
    overdue:      records.filter(r => r.status === 'Overdue').length,
    returned:     records.filter(r => r.status === 'Returned').length,
    rejected:     records.filter(r => r.status === 'Rejected').length,
  }

  // ── Accent color per record (uses approval level)
  const accentColor = record => {
    const d = getApprovalDisplay(record)
    return d.color
  }

  // ══════════════════════════════════════════════
  //  MOBILE LAYOUT
  // ══════════════════════════════════════════════
  if (mobile) {
    return (
      <div>
        {/* Modals */}
        <DeleteModal
          record={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
        <ApprovalConfirmModal
          record={approveTarget}
          role={userRole}
          onConfirm={handleApproveConfirm}
          onCancel={() => setApproveTarget(null)}
        />
        <RejectionModal
          record={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
        <QuotaExceededModal
          record={quotaExceededRec}
          balance={quotaExceededBal}
          onOverride={handleQuotaOverride}
          onCancel={() => { setQuotaExceededRec(null); setQuotaExceededBal(null); setPendingApproveRec(null) }}
        />
        {showQuotaAdmin      && <QuotaAdminPanel    onClose={() => setShowQuotaAdmin(false)} />}
        {showBalancePanel    && <StudentBalancePanel students={students} onClose={() => setShowBalancePanel(false)} />}
        {showNotifLog    && <NotificationLogPanel         onClose={() => setShowNotifLog(false)} />}
        {showNotifTpl    && <NotificationTemplateEditor    onClose={() => setShowNotifTpl(false)} />}
        {showNotifCfg    && <NotificationConfigPanel       onClose={() => setShowNotifCfg(false)} />}
        <MarkReturnedModal
          record={markReturnedTarget}
          onConfirm={handleReturnConfirm}
          onCancel={() => setMarkReturnedTarget(null)}
        />

        {/* Staff alerts — overdue return / stuck pending approval */}
        <StaffAlertBanner links={staffAlertLinks} onDismiss={dismissStaffAlert} />

        {/* Stat cards */}
        <div style={mobileStatGrid}>
          <StatCard icon="⏳" label="Pending HM"    value={stats.pendingHM}    color="#ca8a04" bg="#fef9c3" compact />
          <StatCard icon="🔵" label="Pending Supt"  value={stats.pendingSuept} color="#1d4ed8" bg="#dbeafe" compact />
          <StatCard icon="✅" label="Fully Approved" value={stats.approved}     color="#16a34a" bg="#dcfce7" compact />
          <StatCard icon="⚠️" label="Overdue"        value={stats.overdue}      color="#dc2626" bg="#fee2e2" compact />
        </div>

        {/* Create + admin buttons */}
        {!showForm && !showCalendar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <button onClick={openCreate} style={{ ...btn(), width: '100%' }}>
              ➕ New Leave Request
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => { setShowCalendar(true); setShowAnalytics(false) }}
                style={{ ...btn('#1e3a5f'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📅 Calendar
              </button>
              <button onClick={() => { setShowAnalytics(true); setShowCalendar(false) }}
                style={{ ...btn('#7c3aed'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📈 Analytics
              </button>
              <button onClick={() => setShowQuotaAdmin(true)} style={{ ...btn('#f1f5f9', '#1e3a5f'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                ⚙️ Quota
              </button>
              <button onClick={() => setShowBalancePanel(true)} style={{ ...btn('#f1f5f9', '#1e3a5f'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📊 Balance
              </button>
              <button onClick={() => setShowNotifLog(true)} style={{ ...btn('#f1f5f9', '#047857'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📋 SMS Log
              </button>
              <button onClick={() => setShowNotifTpl(true)} style={{ ...btn('#f1f5f9', '#047857'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📝 Templates
              </button>
              <button onClick={() => setShowNotifCfg(true)} style={{ ...btn('#f1f5f9', '#047857'), flex: '1 1 auto', fontSize: '12px', padding: '9px' }}>
                📡 SMS Config
              </button>
              <a href="/student-leave" target="_blank" rel="noopener noreferrer" style={{ ...btn('#fef9c3', '#ca8a04'), flex: '1 1 auto', fontSize: '12px', padding: '9px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🎓 Portal ↗</a>
            </div>
          </div>
        )}

        {/* Calendar view (Feature 38-43) */}
        {showCalendar && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <button onClick={() => setShowCalendar(false)}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px' }}>
                ← Back to List
              </button>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f' }}>📅 Leave Calendar</div>
            </div>
            <LeaveCalendarView records={records} students={students} />
          </div>
        )}

        {/* Analytics dashboard (Features 44-53) */}
        {showAnalytics && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <button onClick={() => setShowAnalytics(false)}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px' }}>
                ← Back to List
              </button>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#7c3aed' }}>📈 Leave Analytics</div>
            </div>
            <LeaveAnalyticsDashboard records={records} students={students} />
          </div>
        )}

        {/* Form */}
        {!showCalendar && showForm && (
          <LeaveForm
            form={form}
            setForm={setForm}
            students={students}
            onSave={handleSave}
            onCancel={cancelForm}
            saving={saving}
            isEdit={!!editRec}
          />
        )}

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {[['requests', '📋 Active'], ['history', '📜 History']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); clearAllFilters() }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: activeTab === id ? '#1e3a5f' : '#f1f5f9',
                color: activeTab === id ? 'white' : '#64748b',
                fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search bar + filter toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            placeholder="🔍 Search name, GCC, house, purpose..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, flex: 1 }}
            type="search"
          />
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              ...btn(showFilters ? '#1e3a5f' : '#f1f5f9', showFilters ? 'white' : '#374151'),
              padding: '10px 14px', fontSize: '13px', position: 'relative', flexShrink: 0,
            }}
          >
            🎛 Filters
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#dc2626', color: 'white',
                borderRadius: '99px', fontSize: '10px', fontWeight: '800',
                padding: '1px 5px', minWidth: '16px', textAlign: 'center',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filter panel — mobile */}
        {showFilters && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: '12px', padding: '12px',
            marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, flex: 1, fontSize: '13px' }}>
                <option value="All">All Status</option>
                {LEAVE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, flex: 1, fontSize: '13px' }}>
                <option value="All">All Types</option>
                {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={filterHouse} onChange={e => setFilterHouse(e.target.value)} style={{ ...inp, flex: 1, fontSize: '13px' }}>
                {houseOptions.map(h => <option key={h}>{h === 'All' ? 'All Houses' : h}</option>)}
              </select>
              <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...inp, flex: 1, fontSize: '13px' }}>
                {batchOptions.map(b => <option key={b}>{b === 'All' ? 'All Batches' : b}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>FROM DATE</div>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, fontSize: '13px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>TO DATE</div>
                <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ ...inp, fontSize: '13px' }} />
              </div>
            </div>
            {isFiltered && (
              <button onClick={clearAllFilters} style={{ ...btn('#fee2e2', '#dc2626'), width: '100%', fontSize: '13px', padding: '9px' }}>
                ✕ Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Filter summary chips */}
        {isFiltered && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {search && (
              <span style={chipStyle}>🔍 "{search}" <button onClick={() => setSearch('')} style={chipX}>✕</button></span>
            )}
            {filterStatus !== 'All' && (
              <span style={chipStyle}>Status: {filterStatus} <button onClick={() => setFilterStatus('All')} style={chipX}>✕</button></span>
            )}
            {filterType !== 'All' && (
              <span style={chipStyle}>Type: {filterType} <button onClick={() => setFilterType('All')} style={chipX}>✕</button></span>
            )}
            {filterHouse !== 'All' && (
              <span style={chipStyle}>🏠 {filterHouse} <button onClick={() => setFilterHouse('All')} style={chipX}>✕</button></span>
            )}
            {filterBatch !== 'All' && (
              <span style={chipStyle}>Batch: {filterBatch} <button onClick={() => setFilterBatch('All')} style={chipX}>✕</button></span>
            )}
            {dateFrom && (
              <span style={chipStyle}>From: {dateFrom} <button onClick={() => setDateFrom('')} style={chipX}>✕</button></span>
            )}
            {dateTo && (
              <span style={chipStyle}>To: {dateTo} <button onClick={() => setDateTo('')} style={chipX}>✕</button></span>
            )}
          </div>
        )}

        {/* Result count */}
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600' }}>
          {isFiltered
            ? `${filtered.length} of ${records.length} records match`
            : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`
          }
        </div>

        {/* Records — hidden when calendar or analytics is showing */}
        {!showCalendar && !showAnalytics && loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Loading...</div>
        ) : !showCalendar && !showAnalytics ? (
          <MobileCardList>
            {filtered.map(r => (
              <MobileRecordCard key={r.id} accentColor={getApprovalDisplay(r).color}>
                {/* Top row: name + approval badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{r.student_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {r.gcc_no ? `GCC-${r.gcc_no}` : '—'} · {r.house || '—'}
                    {r.requested_by === 'student' && <span style={{ marginLeft: '4px', fontSize: '10px', fontWeight: '700', padding: '1px 5px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '99px' }}>🎓 Self</span>}
                    </div>
                  </div>
                  <ApprovalBadge record={r} />
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  <div>📅 {r.from_date} → {r.to_date}</div>
                  <div>🚪 {r.leave_type}</div>
                  {r.expected_return && <div>⏰ Return by: {new Date(r.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>}
                  {r.actual_return && (
                    <div style={{ color: '#16a34a' }}>
                      🏠 Returned: {new Date(r.actual_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                  {/* Feature 34: overstay badge */}
                  {r.actual_return && r.expected_return && (
                    <div><OverstayBadge record={r} /></div>
                  )}
                  {r.hm_approved_by && <div style={{ color: '#1d4ed8' }}>✅ HM: {r.hm_approved_by}</div>}
                  {r.supt_approved_by && <div style={{ color: '#16a34a' }}>✅ Supt: {r.supt_approved_by}</div>}
                  {r.parent_contact && <div>📞 {r.parent_contact}</div>}
                </div>

                {/* Purpose */}
                {r.purpose && (
                  <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px', lineHeight: 1.4 }}>
                    📝 {r.purpose}
                  </div>
                )}

                {/* Rejection reason */}
                {r.status === 'Rejected' && r.rejection_reason && (
                  <div style={{ background: '#fee2e2', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600', marginBottom: '8px' }}>
                    ❌ Reason: {r.rejection_reason}
                    {r.rejected_by && <span style={{ fontWeight: '400' }}> · by {r.rejected_by}</span>}
                  </div>
                )}

                {/* Superintendent rejected back to HM notice */}
                {r.status === 'Pending' && (r.approval_level ?? 0) === 0 && r.rejection_reason && (
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: '#9a3412', fontWeight: '600', marginBottom: '8px' }}>
                    ↩️ Sent back by Superintendent: "{r.rejection_reason}"
                  </div>
                )}

                {/* Overdue alert */}
                {r.status === 'Overdue' && (
                  <div style={{ background: '#fee2e2', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600', marginBottom: '8px' }}>
                    ⚠️ Student is overdue! Contact parent: {r.parent_contact || 'N/A'}
                  </div>
                )}

                {/* Approval history toggle */}
                <button
                  onClick={() => setExpandedHistory(expandedHistory === r.id ? null : r.id)}
                  style={{ background: 'none', border: 'none', fontSize: '12px', color: '#64748b', cursor: 'pointer', fontWeight: '600', padding: '0', marginBottom: '8px' }}
                >
                  {expandedHistory === r.id ? '▲ Hide trail' : '▼ Approval trail'}
                </button>
                {expandedHistory === r.id && <ApprovalHistoryPanel leaveId={r.id} />}

                {/* Gate Pass — Feature 24-29 */}
                <GatePassButton record={r} compact={false} />

                {/* Action buttons */}
                <MobileActionButtons actions={[
                  { label: '✏️ Edit', onClick: () => openEdit(r), bg: '#eff6ff', color: '#1e3a5f' },
                  ...(canApprove(r) ? [{ label: '✓ Approve', onClick: () => handleApproveClick(r), bg: '#dcfce7', color: '#16a34a' }] : []),
                  ...(canReject(r)  ? [{ label: '✕ Reject',  onClick: () => handleRejectClick(r),  bg: '#fee2e2', color: '#dc2626' }] : []),
                  ...((r.status === 'Approved' && (r.approval_level ?? 0) >= 2) || r.status === 'Overdue'
                    ? [{ label: '🏠 Mark Returned', onClick: () => handleMarkReturned(r), bg: '#dbeafe', color: '#1d4ed8', fullWidth: true }]
                    : []),
                  ...(isAdmin ? [{ label: '🗑 Delete', onClick: () => setDeleteTarget(r), bg: '#fee2e2', color: '#dc2626' }] : []),
                ]} />
              </MobileRecordCard>
            ))}
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚪</div>
                No leave records found
              </div>
            )}
          </MobileCardList>
        ) : null}
      </div>
    )
  }

  // ══════════════════════════════════════════════
  //  DESKTOP LAYOUT
  // ══════════════════════════════════════════════
  return (
    <div>
      {/* Modals */}
      <DeleteModal
        record={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ApprovalConfirmModal
        record={approveTarget}
        role={userRole}
        onConfirm={handleApproveConfirm}
        onCancel={() => setApproveTarget(null)}
      />
      <RejectionModal
        record={rejectTarget}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
      />
      <QuotaExceededModal
        record={quotaExceededRec}
        balance={quotaExceededBal}
        onOverride={handleQuotaOverride}
        onCancel={() => { setQuotaExceededRec(null); setQuotaExceededBal(null); setPendingApproveRec(null) }}
      />
      {showQuotaAdmin   && <QuotaAdminPanel    onClose={() => setShowQuotaAdmin(false)} />}
      {showBalancePanel && <StudentBalancePanel students={students} onClose={() => setShowBalancePanel(false)} />}
      {showNotifLog    && <NotificationLogPanel         onClose={() => setShowNotifLog(false)} />}
      {showNotifTpl    && <NotificationTemplateEditor    onClose={() => setShowNotifTpl(false)} />}
      {showNotifCfg    && <NotificationConfigPanel       onClose={() => setShowNotifCfg(false)} />}
      <MarkReturnedModal
        record={markReturnedTarget}
        onConfirm={handleReturnConfirm}
        onCancel={() => setMarkReturnedTarget(null)}
      />

      {/* Staff alerts — overdue return / stuck pending approval */}
      <StaffAlertBanner links={staffAlertLinks} onDismiss={dismissStaffAlert} />

      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '12px', marginBottom: '20px',
      }}>
        <StatCard icon="⏳" label="Pending HM"        value={stats.pendingHM}    color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🔵" label="Pending Supt"      value={stats.pendingSuept} color="#1d4ed8" bg="#dbeafe" />
        <StatCard icon="✅" label="Fully Approved"    value={stats.approved}     color="#16a34a" bg="#dcfce7" />
        <StatCard icon="⚠️" label="Overdue"           value={stats.overdue}      color="#dc2626" bg="#fee2e2" />
        <StatCard icon="🏠" label="Returned"          value={stats.returned}     color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="❌" label="Rejected"          value={stats.rejected}     color="#dc2626" bg="#fee2e2" />
      </div>

      {/* Toolbar row 1: tab toggle + create button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {[['requests', '📋 Active'], ['history', '📜 History']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); clearAllFilters() }}
              style={{
                padding: '9px 20px', border: 'none',
                background: activeTab === id ? '#1e3a5f' : 'white',
                color: activeTab === id ? 'white' : '#64748b',
                fontWeight: activeTab === id ? '700' : '500',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => { setShowCalendar(v => !v); setShowAnalytics(false) }}
            style={{ ...btn(showCalendar ? '#1e3a5f' : '#eff6ff', showCalendar ? 'white' : '#1e3a5f'), fontSize: '12px', padding: '9px 14px' }}
          >
            📅 {showCalendar ? 'Hide Calendar' : 'Calendar'}
          </button>
          <button
            onClick={() => { setShowAnalytics(v => !v); setShowCalendar(false) }}
            style={{ ...btn(showAnalytics ? '#7c3aed' : '#f5f3ff', showAnalytics ? 'white' : '#7c3aed'), fontSize: '12px', padding: '9px 14px' }}
          >
            📈 {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </button>
          <button onClick={() => setShowBalancePanel(true)} style={{ ...btn('#eff6ff', '#1e3a5f'), fontSize: '12px', padding: '9px 14px' }}>📊 Balances</button>
          <button onClick={() => setShowQuotaAdmin(true)}   style={{ ...btn('#eff6ff', '#1e3a5f'), fontSize: '12px', padding: '9px 14px' }}>⚙️ Quota Config</button>
          <button onClick={() => setShowNotifLog(true)}     style={{ ...btn('#ecfdf5', '#047857'), fontSize: '12px', padding: '9px 14px' }}>📋 SMS Log</button>
          <button onClick={() => setShowNotifTpl(true)}     style={{ ...btn('#ecfdf5', '#047857'), fontSize: '12px', padding: '9px 14px' }}>📝 Templates</button>
          <button onClick={() => setShowNotifCfg(true)}     style={{ ...btn('#ecfdf5', '#047857'), fontSize: '12px', padding: '9px 14px' }}>📡 SMS Config</button>
          <a href="/student-leave" target="_blank" rel="noopener noreferrer" style={{ ...btn('#fef9c3', '#ca8a04'), fontSize: '12px', padding: '9px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>🎓 Student Portal ↗</a>
          <button
            onClick={showForm && !editRec ? cancelForm : openCreate}
            style={btn(showForm && !editRec ? '#f1f5f9' : '#1e3a5f', showForm && !editRec ? '#374151' : 'white')}
          >
            {showForm && !editRec ? '✖ Cancel' : '➕ New Leave Request'}
          </button>
        </div>
      </div>

      {/* Calendar view (Features 38-43) */}
      {showCalendar && (
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}>
          <LeaveCalendarView records={records} students={students} />
        </div>
      )}

      {/* Analytics dashboard (Features 44-53) */}
      {showAnalytics && (
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#7c3aed' }}>📈 Leave Analytics Dashboard</div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>— based on all records</span>
          </div>
          <LeaveAnalyticsDashboard records={records} students={students} />
        </div>
      )}

      {/* Toolbar row 2: search + filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <input
          placeholder="🔍 Search name, GCC, house, purpose..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 3, minWidth: '200px' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '130px' }}>
          <option value="All">All Status</option>
          {LEAVE_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '140px' }}>
          <option value="All">All Types</option>
          {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterHouse} onChange={e => setFilterHouse(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '130px' }}>
          {houseOptions.map(h => <option key={h}>{h === 'All' ? 'All Houses' : h}</option>)}
        </select>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} style={{ ...inp, width: 'auto', minWidth: '130px' }}>
          {batchOptions.map(b => <option key={b}>{b === 'All' ? 'All Batches' : b}</option>)}
        </select>
      </div>

      {/* Toolbar row 3: date range */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>Leave from:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>to:</span>
          <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ ...inp, width: 'auto' }} />
        </div>
        {isFiltered && (
          <button onClick={clearAllFilters} style={{ ...btn('#fee2e2', '#dc2626'), padding: '9px 14px', fontSize: '12px' }}>
            ✕ Clear All
          </button>
        )}
        {/* Result count */}
        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginLeft: 'auto' }}>
          {isFiltered
            ? `${filtered.length} of ${records.length} records match`
            : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`
          }
        </span>
      </div>

      {/* Active filter chips */}
      {isFiltered && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {search && <span style={chipStyle}>🔍 "{search}" <button onClick={() => setSearch('')} style={chipX}>✕</button></span>}
          {filterStatus !== 'All' && <span style={chipStyle}>Status: {filterStatus} <button onClick={() => setFilterStatus('All')} style={chipX}>✕</button></span>}
          {filterType !== 'All' && <span style={chipStyle}>Type: {filterType} <button onClick={() => setFilterType('All')} style={chipX}>✕</button></span>}
          {filterHouse !== 'All' && <span style={chipStyle}>🏠 {filterHouse} <button onClick={() => setFilterHouse('All')} style={chipX}>✕</button></span>}
          {filterBatch !== 'All' && <span style={chipStyle}>Batch: {filterBatch} <button onClick={() => setFilterBatch('All')} style={chipX}>✕</button></span>}
          {dateFrom && <span style={chipStyle}>From: {dateFrom} <button onClick={() => setDateFrom('')} style={chipX}>✕</button></span>}
          {dateTo && <span style={chipStyle}>To: {dateTo} <button onClick={() => setDateTo('')} style={chipX}>✕</button></span>}
        </div>
      )}

      {/* Form — shown above table */}
      {showForm && (
        <LeaveForm
          form={form}
          setForm={setForm}
          students={students}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          isEdit={!!editRec}
        />
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1100px' }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Student', 'GCC', 'House', 'Type', 'From', 'To', 'Return By', 'Actual Return', 'Status', 'Parent', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {r.student_name}
                      {/* Feature 63: student-submitted indicator */}
                      {r.requested_by === 'student' && (
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '99px', background: '#f5f3ff', color: '#7c3aed', whiteSpace: 'nowrap' }}>
                          🎓 Self
                        </span>
                      )}
                    </div>
                    {r.class_name && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.class_name}</div>}
                  </td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: '700' }}>
                    {r.gcc_no ? `GCC-${r.gcc_no}` : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#7c3aed', fontSize: '12px', fontWeight: '600' }}>
                    {r.house || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.leave_type}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.from_date}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.to_date}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>
                    {r.expected_return
                      ? new Date(r.expected_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '12px' }}>
                    {r.actual_return
                      ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#16a34a', fontWeight: '600' }}>
                            🏠 {new Date(r.actual_return).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          {/* Feature 34: overstay badge */}
                          <OverstayBadge record={r} />
                        </div>
                      )
                      : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  {/* Status — approval badge */}
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <ApprovalBadge record={r} />
                      {/* Superintendent sent back notice */}
                      {r.status === 'Pending' && (r.approval_level ?? 0) === 0 && r.rejection_reason && (
                        <span style={{ fontSize: '10px', color: '#9a3412', fontWeight: '600' }}>↩️ Sent back</span>
                      )}
                      {/* Rejection reason */}
                      {r.status === 'Rejected' && r.rejection_reason && (
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '500' }} title={r.rejection_reason}>
                          ❌ {r.rejection_reason.length > 30 ? r.rejection_reason.slice(0,30) + '…' : r.rejection_reason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>
                    <div>{r.parent_contact || '—'}</div>
                    {r.parent_approved && (r.approval_level ?? 0) >= 1 && <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>✅ Approved</div>}
                    {/* Approval trail toggle */}
                    <button
                      onClick={() => setExpandedHistory(expandedHistory === r.id ? null : r.id)}
                      style={{ background: 'none', border: 'none', fontSize: '10px', color: '#1d4ed8', cursor: 'pointer', fontWeight: '700', padding: '2px 0', marginTop: '2px' }}
                    >
                      {expandedHistory === r.id ? '▲ Hide trail' : '▼ Trail'}
                    </button>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {/* Edit */}
                      <button onClick={() => openEdit(r)} style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: '6px', padding: '5px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }} title="Edit">✏️</button>
                      {/* Approve — role-aware */}
                      {canApprove(r) && (
                        <button onClick={() => handleApproveClick(r)} style={{ ...btn('#16a34a'), fontSize: '11px', padding: '5px 10px' }} title="Approve">✓</button>
                      )}
                      {/* Reject — role-aware */}
                      {canReject(r) && (
                        <button onClick={() => handleRejectClick(r)} style={{ ...btn('#dc2626'), fontSize: '11px', padding: '5px 10px' }} title="Reject">✕</button>
                      )}
                      {/* Mark Returned */}
                      {((r.status === 'Approved' && (r.approval_level ?? 0) >= 2) || r.status === 'Overdue') && (
                        <button onClick={() => handleMarkReturned(r)} style={{ ...btn('#1d4ed8'), fontSize: '11px', padding: '5px 8px' }} title="Mark Returned">🏠</button>
                      )}
                      {/* Gate Pass — compact button */}
                      <GatePassButton record={r} compact={true} />
                      {/* Delete — admin only */}
                      {isAdmin && (
                        <button onClick={() => setDeleteTarget(r)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }} title="Delete">🗑</button>
                      )}
                    </div>
                    {/* Approval trail inline */}
                    {expandedHistory === r.id && (
                      <div style={{ marginTop: '8px', minWidth: '260px' }}>
                        <ApprovalHistoryPanel leaveId={r.id} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚪</div>
                    No leave records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Table footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {isFiltered
                ? <span style={{ color: '#1e3a5f', fontWeight: '600' }}>{filtered.length} of {records.length} records match filters</span>
                : <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''} total</span>
              }
            </span>
            {isFiltered && (
              <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>
                ✕ Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveTab
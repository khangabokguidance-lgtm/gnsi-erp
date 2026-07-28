import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import jsPDF from 'jspdf'
import { HousemasterActivitiesTab, AdminMonitorTab } from './HousemasterActivitiesEnhanced'
import { ClassTimetableTab } from './ClassTimetableTab'
import HMDoubtSessionsTab from './HMDoubtSessionsTab'
import LeaveTab, { StudentSelfService, GatePassVerifyPage } from './LeaveTab'
import HouseReportModal from './HouseReportModal'
import { sendPushToStaffId, notifyHousemasterByName, notifyHousemasterByHouse } from './notifications'
import { approveLeaveRecord, checkQuotaBeforeApproval } from './leaveApproval'

// ══════════════════════════════════════════════════════════════
//  DESIGN TOKENS — Material Design, grounded in the GNSI navy/gold
//  identity. Material's defining traits are layered elevation
//  (shadow depth, not one flat shadow everywhere), tonal color roles
//  (a color plus its container/on-color pair, not one flat hex), and
//  a size-to-radius relationship (small controls stay tight, surfaces
//  get generous rounding). This token block is the single source for
//  all of it — every shared primitive below derives from these.
// ══════════════════════════════════════════════════════════════
const MD = {
  color: {
    primary:          '#1e3a5f', // GNSI navy
    primaryContainer: '#e3ecf7', // tonal navy-10, used behind navy content
    onPrimaryContainer: '#0d2440',
    secondary:          '#ca8a04', // GNSI brass/gold
    secondaryContainer: '#fef3c7',
    onSecondaryContainer: '#7c5800',
    surface:          '#ffffff',
    surfaceDim:       '#f4f6f9',   // page background
    surfaceContainer: '#ffffff',  // card background
    surfaceVariant:   '#eef1f6',  // subtle recessed areas (input fill, chips)
    outline:          '#d7dee8',
    outlineVariant:   '#e8ecf2',
    onSurface:        '#1a2233',
    onSurfaceVariant: '#5b6779',
    error:            '#dc2626',
    errorContainer:   '#fee2e2',
    success:          '#16a34a',
    successContainer: '#dcfce7',
  },
  // Material elevation: layered shadows, each tier pairs a tight
  // "contact" shadow with a soft "ambient" shadow — this is what
  // makes Material shadows read as depth rather than a blur filter.
  elevation: {
    0: 'none',
    1: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)',
    2: '0 2px 4px rgba(16,24,40,0.06), 0 4px 8px rgba(16,24,40,0.10)',
    3: '0 4px 8px rgba(16,24,40,0.08), 0 8px 20px rgba(16,24,40,0.12)',
    4: '0 6px 14px rgba(16,24,40,0.10), 0 12px 28px rgba(16,24,40,0.14)',
  },
  radius: { control: '10px', field: '12px', card: '18px', sheet: '24px', pill: '999px' },
  type: {
    label:    { fontSize: '12px', fontWeight: '600', letterSpacing: '0.02em' },
    body:     { fontSize: '14px', fontWeight: '500' },
    title:    { fontSize: '16px', fontWeight: '700' },
    headline: { fontSize: '22px', fontWeight: '800', letterSpacing: '-0.01em' },
  },
}

// ══════════════════════════════════════════════════════════════
//  MOBILE-FIRST RESPONSIVE STYLES
// ══════════════════════════════════════════════════════════════
const isMobile = () => window.innerWidth < 768

// ── Persisted "already auto-shown" tracker for the House Report modal ──
// AttendanceTab remounts on ordinary tab navigation, which used to reset
// its in-memory autoFired state and made the 100%-complete report modal
// pop up again every time a housemaster reopened a fully-marked house's
// roll call. Persisting to localStorage (keyed by house+date+session, so
// it naturally rolls over to a fresh day) keeps "already shown" true
// across remounts and page reloads, not just for one component lifetime.
const AUTO_FIRED_KEY = 'gnsi_house_report_autofired'
function loadAutoFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUTO_FIRED_KEY) || '{}')
    // Prune entries older than yesterday so this doesn't grow unbounded
    // over months of daily use — each key embeds its own date, e.g.
    // "Shiroi_2026-07-28_morning".
    const todayStr = today()
    const y = new Date(); y.setDate(y.getDate() - 1)
    const yesterdayStr = y.toISOString().split('T')[0]
    const pruned = {}
    Object.keys(raw).forEach(key => {
      if (key.includes(todayStr) || key.includes(yesterdayStr)) pruned[key] = raw[key]
    })
    return pruned
  } catch { return {} }
}
function saveAutoFired(obj) {
  try { localStorage.setItem(AUTO_FIRED_KEY, JSON.stringify(obj)) } catch { }
}

// ─── Shared styles — Material-elevated surfaces on the GNSI palette ──
const inp = {
  width: '100%', padding: '13px 14px', borderRadius: MD.radius.control,
  border: `1.5px solid ${MD.color.outline}`, fontSize: '16px', // 16px prevents iOS zoom
  boxSizing: 'border-box', backgroundColor: MD.color.surfaceVariant,
  minHeight: '46px', color: MD.color.onSurface,
  transition: 'border-color 0.15s ease, background-color 0.15s ease',
}
const lbl = {
  display: 'block', fontSize: '12px', fontWeight: '700',
  color: MD.color.onSurfaceVariant, marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
// Material "filled" button: flat fill + elevation-1 that lifts to
// elevation-2 on hover — the press/lift is what reads as Material,
// not just a colored rectangle.
const btn = (bg = MD.color.primary, c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: MD.radius.control,
  padding: '12px 22px', fontWeight: '700', cursor: 'pointer', fontSize: '14px',
  minHeight: '46px', minWidth: '46px', boxShadow: MD.elevation[1],
  transition: 'box-shadow 0.15s ease, transform 0.1s ease',
})
// Elevated card — Material's generous corner radius + layered shadow,
// no hairline border needed since elevation itself defines the edge.
const card = {
  background: MD.color.surfaceContainer, borderRadius: MD.radius.card, padding: '18px',
  boxShadow: MD.elevation[1], border: `1px solid ${MD.color.outlineVariant}`,
}
const mobileCard = {
  ...card,
  padding: '14px',
  borderRadius: MD.radius.field,
}

// ─── Responsive grid helpers ──────────────────────────────────
const grid2 = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '16px',
}

const statGrid = (min = 140) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
  gap: '14px',
  marginBottom: '22px',
})
const mobileStatGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  marginBottom: '18px',
}

// ─── Mobile table replacement ─────────────────────────────────
const MobileCardList = ({ children, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', ...style }}>
    {children}
  </div>
)

const MobileRecordCard = ({ children, accentColor = MD.color.primary, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: MD.color.surfaceContainer, borderRadius: MD.radius.field, padding: '15px',
      borderLeft: `4px solid ${accentColor}`,
      boxShadow: MD.elevation[1],
      border: `1px solid ${MD.color.outlineVariant}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s ease',
    }}
    onMouseDown={onClick ? (e => e.currentTarget.style.boxShadow = MD.elevation[0]) : undefined}
    onMouseUp={onClick ? (e => e.currentTarget.style.boxShadow = MD.elevation[2]) : undefined}
  >
    {children}
  </div>
)

const TABS = [
  { id: 'schedule', label: '📅 Schedule' },
  { id: 'house', label: '🏠 Houses' },
  { id: 'housemaster', label: '👨‍🏫 HM' },
  { id: 'hmactivities', label: '📌 Activities' },
  { id: 'adminmonitor', label: '🖥 Monitor' },
  { id: 'discipline', label: '⚠️ Discipline' },
  { id: 'sickbay', label: '🏥 Sickbay' },
  { id: 'kitchen', label: '🍽️ Kitchen' },
  { id: 'nightduty', label: '🍽️ Mess Duty' },
  { id: 'allotments', label: '📋 Day Scholar' },
  // ─── NEW: House Master Daily Features ──────────────────
  { id: 'attendance', label: '✅ Roll Call' },
  { id: 'leave', label: '🚪 Leave' },
  { id: 'hmdashboard', label: '📊 HM Dash' },
  { id: 'maintenance', label: '🔧 Repairs' },
  { id: 'journal', label: '📝 Journal' },
  { id: 'doubtsession', label: '🙋 Doubt' },
  { id: 'classtimetable', label: '🗓️ Classes' },
  { id: 'neglectreport', label: '🚨 Neglect Report' },
  { id: 'hmrollreport', label: '📆 Roll Call Report' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const today = () => new Date().toISOString().split('T')[0]
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getStudentClass(s) {
  if (!s) return ''
  const batch = (s.batch || '').trim()
  const cls = (s.class_name || '').trim()
  if (batch && batch !== '???') return batch
  if (cls && cls !== '???') return cls
  return ''
}

// ══════════════════════════════════════════════════════════════
//  HOUSEMASTER PUSH ALERTS
//  sendPushToStaffId / notifyHousemasterByName / notifyHousemasterByHouse
//  now live in ./notifications.js (shared with LeaveTab.jsx) to avoid a
//  circular import — see that file for implementation details.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  SIX-TAB COMPLIANCE CHECK
//  Verifies a housemaster logged at least one record for their house,
//  in each of: Discipline, Sickbay, Maintenance, Journal, Mess Duty,
//  Activities — within the current roll-call session's time window
//  (Morning = 00:00–12:00, Night = 12:00–24:00, same calendar date).
//
//  Also powers a STANDALONE 3x-daily check (Morning/Afternoon/Night,
//  8hr split: 00–08, 08–16, 16–24) independent of roll call — see
//  DAILY_SLOTS / checkSixTabComplianceForSlot below.
//
//  REQUIRED SQL (run once in Supabase):
//    alter table maintenance_records add column if not exists house text;
//    alter table mess_duty add column if not exists house text;
//    create table if not exists hm_neglect_log (
//      id bigserial primary key,
//      house text not null,
//      date date not null,
//      session text not null,
//      housemaster_name text,
//      missing_tabs text[] not null,
//      skip_reasons jsonb default '{}',
//      check_type text default 'rollcall', -- 'rollcall' or 'standalone'
//      created_at timestamptz default now()
//    );
//    alter table hm_neglect_log disable row level security;
//    -- If hm_neglect_log already exists from a prior version, add columns:
//    alter table hm_neglect_log add column if not exists skip_reasons jsonb default '{}';
//    alter table hm_neglect_log add column if not exists check_type text default 'rollcall';
// ══════════════════════════════════════════════════════════════

const SIX_TABS = [
  { key: 'discipline', label: '⚠️ Discipline', rootTabId: 'discipline' },
  { key: 'sickbay', label: '🏥 Sickbay', rootTabId: 'sickbay' },
  { key: 'maintenance', label: '🔧 Repairs', rootTabId: 'maintenance' },
  { key: 'journal', label: '📝 Journal', rootTabId: 'journal' },
  { key: 'messduty', label: '🍽️ Mess Duty', rootTabId: 'nightduty' },
  { key: 'activities', label: '📌 Activities', rootTabId: 'hmactivities' },
]

function sessionWindow(dateStr, session) {
  // Morning: 00:00–12:00, Night: 12:00–24:00, both on the given calendar date
  // (used by the roll-call-linked compliance check only)
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T00:00:00`)
  if (session === 'morning') {
    end.setHours(12, 0, 0, 0)
  } else {
    start.setHours(12, 0, 0, 0)
    end.setDate(end.getDate() + 1)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

// ── Standalone 3x-daily compliance check ──
// Independent of roll call's morning/night sessions. Splits the day into
// three even 8-hour slots that the housemaster must clear separately.
const DAILY_SLOTS = [
  { key: 'morning', label: '🌅 Morning', startHour: 0, endHour: 8, rollCallGate: 'morning' },
  { key: 'afternoon', label: '☀️ Afternoon', startHour: 8, endHour: 16, rollCallGate: 'morning' },
  { key: 'night', label: '🌙 Night', startHour: 16, endHour: 24, rollCallGate: 'night' },
]

function dailySlotWindow(dateStr, slotKey) {
  const slot = DAILY_SLOTS.find(s => s.key === slotKey)
  const start = new Date(`${dateStr}T00:00:00`)
  start.setHours(slot.startHour, 0, 0, 0)
  const end = new Date(`${dateStr}T00:00:00`)
  if (slot.endHour === 24) {
    end.setDate(end.getDate() + 1)
  } else {
    end.setHours(slot.endHour, 0, 0, 0)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

function currentDailySlot() {
  const hour = new Date().getHours()
  return DAILY_SLOTS.find(s => hour >= s.startHour && hour < s.endHour)?.key || 'morning'
}

// Core checker — takes an explicit {start, end} ISO window so it can be
// reused by both the roll-call-linked check (12hr split) and the
// standalone 3x-daily check (8hr split). Returns array of missing tab keys.
async function hasAny(queryBuilder) {
  try {
    const { data, error } = await queryBuilder
    if (error) return false // treat query errors as "can't verify" not "missing", to avoid false neglect
    return (data || []).length > 0
  } catch {
    return false
  }
}

// One query-builder per tab, keyed the same as SIX_TABS — shared by the
// full six-tab sweep and the single-tab manual recheck ("✓ I've filled
// this in") so there's exactly one place each tab's logic lives.
const TAB_CHECKERS = {
  discipline: async (houseName, start, end, houseStudentIds) => {
    if (!houseStudentIds.length) return true
    return hasAny(
      supabase.from('discipline_records').select('id')
        .in('student_id', houseStudentIds)
        .gte('created_at', start).lt('created_at', end)
        .limit(1)
    )
  },
  sickbay: async (houseName, start, end, houseStudentIds) => {
    if (!houseStudentIds.length) return true
    return hasAny(
      supabase.from('sickbay_records').select('id')
        .in('student_id', houseStudentIds)
        .gte('created_at', start).lt('created_at', end)
        .limit(1)
    )
  },
  maintenance: async (houseName, start, end) => hasAny(
    supabase.from('maintenance_records').select('id')
      .ilike('house', houseName)
      .gte('created_at', start).lt('created_at', end)
      .limit(1)
  ),
  journal: async (houseName, start, end) => hasAny(
    supabase.from('housemaster_journal').select('id')
      .ilike('house', houseName)
      .gte('created_at', start).lt('created_at', end)
      .limit(1)
  ),
  messduty: async (houseName, start, end) => hasAny(
    supabase.from('mess_duty').select('id')
      .ilike('house', houseName)
      .gte('created_at', start).lt('created_at', end)
      .limit(1)
  ),
  activities: async (houseName, start, end) => {
    for (const tableName of ['housemaster_activities', 'hm_activities', 'activity_logs']) {
      try {
        const { data, error } = await supabase.from(tableName).select('id')
          .ilike('house', houseName)
          .gte('created_at', start).lt('created_at', end)
          .limit(1)
        if (!error) return (data || []).length > 0
      } catch { /* try next candidate */ }
    }
    return true // couldn't verify — don't penalize
  },
}

async function checkSixTabComplianceForWindow(houseName, start, end, houseStudentIds) {
  const missing = []
  const checks = await Promise.all(
    SIX_TABS.map(tab => TAB_CHECKERS[tab.key](houseName, start, end, houseStudentIds))
  )
  SIX_TABS.forEach((tab, i) => {
    if (!checks[i]) missing.push(tab.key)
  })
  return missing
}

// Roll-call-linked wrapper (Morning/Night, 12hr split) — kept for the
// existing roll-call completion warning banner.
async function checkSixTabCompliance(houseName, dateStr, session, houseStudentIds) {
  const { start, end } = sessionWindow(dateStr, session)
  return checkSixTabComplianceForWindow(houseName, start, end, houseStudentIds)
}

// Standalone 3x-daily wrapper (Morning/Afternoon/Night, 8hr split).
async function checkSixTabComplianceForSlot(houseName, dateStr, slotKey, houseStudentIds) {
  const { start, end } = dailySlotWindow(dateStr, slotKey)
  return checkSixTabComplianceForWindow(houseName, start, end, houseStudentIds)
}

// Re-verify a single tab against a given window — used by the manual
// "✓ I've filled this in" fallback button, so a housemaster can force a
// recheck without needing to leave and re-enter the roll-call tab (which
// is what naturally triggers the automatic recheck via component remount).
async function recheckSingleTab(tabKey, houseName, start, end, houseStudentIds) {
  const checker = TAB_CHECKERS[tabKey]
  if (!checker) return true
  return checker(houseName, start, end, houseStudentIds)
}

async function logNeglect(houseName, dateStr, session, housemasterName, missingKeys, checkType = 'rollcall') {
  if (missingKeys.length === 0) return null
  try {
    const { data, error } = await supabase.from('hm_neglect_log').insert([{
      house: houseName, date: dateStr, session,
      housemaster_name: housemasterName || 'Unknown',
      missing_tabs: missingKeys,
      skip_reasons: {},
      check_type: checkType,
    }]).select('id').single()
    if (error) throw error
    const labels = SIX_TABS.filter(t => missingKeys.includes(t.key)).map(t => t.label).join(', ')
    // Notify admins — reuse the staff push channel, targeting any staff
    // whose role is Admin (best-effort; failures here shouldn't block UI)
    const { data: admins } = await supabase.from('staff_profiles').select('id').ilike('role', 'admin')
    if (admins?.length) {
      await Promise.all(admins.map(a => sendPushToStaffId(
        a.id,
        `⚠️ Compliance gap — ${houseName}`,
        `${housemasterName || 'Housemaster'} skipped: ${labels} (${session}, ${dateStr})`,
        '/hostel?tab=neglectreport'
      )))
    }
    return data?.id || null
  } catch (e) {
    console.error('logNeglect failed:', e)
    return null
  }
}

// Skip reasons must be a genuine explanation, not a placeholder — at
// least 10 characters and more than one word, so "na" / "ok" / "done"
// don't slip through as a justification.
function isValidSkipReason(text) {
  const trimmed = (text || '').trim()
  if (trimmed.length < 10) return false
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  return wordCount > 1
}

// Attach a housemaster-supplied reason to a specific skipped tab on an
// existing neglect log row. The gap still counts as neglect (per design —
// reasons add admin context, they don't erase the record), merged into
// the row's skip_reasons JSON column keyed by tab.
async function attachSkipReason(logId, tabKey, reason, housemasterName) {
  if (!logId) return
  try {
    const { data: row } = await supabase.from('hm_neglect_log').select('skip_reasons').eq('id', logId).maybeSingle()
    const reasons = { ...(row?.skip_reasons || {}), [tabKey]: reason }
    await supabase.from('hm_neglect_log').update({ skip_reasons: reasons }).eq('id', logId)
  } catch (e) {
    console.error('attachSkipReason failed:', e)
  }
}

// ══════════════════════════════════════════════════════════════
//  MOBILE-OPTIMIZED STAT CARD
// ══════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, color, bg, compact = false }) {
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (mobile || compact) {
    return (
      <div style={{
        backgroundColor: MD.color.surfaceContainer, borderRadius: MD.radius.field, padding: '11px 13px',
        boxShadow: MD.elevation[1], border: `1px solid ${MD.color.outlineVariant}`,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          fontSize: '16px', width: '32px', height: '32px', borderRadius: '10px',
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '10px', color: MD.color.onSurfaceVariant, fontWeight: '700', margin: 0, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
          <h2 style={{ fontSize: '19px', fontWeight: '800', color, margin: '2px 0 0', lineHeight: 1.2 }}>{value}</h2>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: MD.color.surfaceContainer, borderRadius: MD.radius.card, padding: '18px',
      boxShadow: MD.elevation[1], border: `1px solid ${MD.color.outlineVariant}`,
    }}>
      <div style={{
        fontSize: '19px', width: '42px', height: '42px', borderRadius: '12px',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px',
      }}>{icon}</div>
      <p style={{ fontSize: '12px', color: MD.color.onSurfaceVariant, fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      <h2 style={{ fontSize: '27px', fontWeight: '800', color, margin: '4px 0 0' }}>{value}</h2>
    </div>
  )
}

function statusStyle(status) {
  const map = {
    Occupied: { bg: '#dcfce7', color: '#16a34a' },
    Vacant: { bg: '#fee2e2', color: '#dc2626' },
    Shifted: { bg: '#fef9c3', color: '#ca8a04' },
    Vacated: { bg: '#e5e7eb', color: '#374151' },
    Resolved: { bg: '#dcfce7', color: '#16a34a' },
    Open: { bg: '#fee2e2', color: '#dc2626' },
    'In Progress': { bg: '#fef9c3', color: '#ca8a04' },
    Closed: { bg: '#e5e7eb', color: '#374151' },
    Discharged: { bg: '#dcfce7', color: '#16a34a' },
    Admitted: { bg: '#dbeafe', color: '#1d4ed8' },
    Present: { bg: '#dcfce7', color: '#16a34a' },
    Absent: { bg: '#fee2e2', color: '#dc2626' },
    Late: { bg: '#fef9c3', color: '#ca8a04' },
    'On Leave': { bg: '#dbeafe', color: '#1d4ed8' },
    Sick: { bg: '#f5f3ff', color: '#7c3aed' },
    Pending: { bg: '#fef9c3', color: '#ca8a04' },
    Approved: { bg: '#dcfce7', color: '#16a34a' },
    Rejected: { bg: '#fee2e2', color: '#dc2626' },
    Overdue: { bg: '#fee2e2', color: '#dc2626' },
  }
  const s = map[status] || { bg: '#e0f2fe', color: '#0891b2' }
  return {
    padding: '5px 12px', borderRadius: MD.radius.pill, fontSize: '12px',
    fontWeight: '700', backgroundColor: s.bg, color: s.color,
    whiteSpace: 'nowrap', display: 'inline-block', letterSpacing: '0.01em',
  }
}

// ══════════════════════════════════════════════════════════════
//  MOBILE-OPTIMIZED SEARCH INPUTS
// ══════════════════════════════════════════════════════════════
function StudentSearchInput({ students, onSelect, placeholder = 'Type name or GCC No...' }) {
  const [query, setQuery] = useState('')
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return students
      .filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        String(s.gcc_no || '').includes(q) ||
        (s.batch || '').toLowerCase().includes(q) ||
        (s.course || '').toLowerCase().includes(q) ||
        String(s.admission_no || '').toLowerCase().includes(q)
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
          maxHeight: mobile ? 180 : 220, overflowY: 'auto',
          marginTop: '4px',
        }}>
          {matches.map(s => (
            <div key={s.id} onClick={() => select(s)}
              style={{
                padding: mobile ? '12px 14px' : '10px 14px',
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                fontSize: '14px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: '#1e293b', fontSize: '14px' }}>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {s.gcc_no ? `GCC-${s.gcc_no}` : '—'}{' · '}{getStudentClass(s) || '—'}
                  {s.house ? ` · 🏠 ${s.house}` : ''}{s.hostel_type ? ` · ${s.hostel_type}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffSearchInput({ staff, onSelect, placeholder = 'Search staff by name...' }) {
  const [query, setQuery] = useState('')
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return staff
      .filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.designation || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
      )
      .slice(0, mobile ? 5 : 8)
  }, [query, staff, mobile])

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
          maxHeight: mobile ? 180 : 200, overflowY: 'auto',
          marginTop: '4px',
        }}>
          {matches.map(s => (
            <div key={s.id} onClick={() => select(s)}
              style={{
                padding: mobile ? '12px 14px' : '10px 14px',
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                fontSize: '14px',
                minHeight: '44px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: '#1e293b' }}>{s.name}</strong>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {s.designation || s.department || '—'}
                  {s.status === 'Active' ? ' · ✅ Active' : ' · ⏸ Inactive'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MOBILE TABLE / CARD SWITCHER
// ══════════════════════════════════════════════════════════════
// ── Helpers ──
const normalizeHouse = (h) => (h || '').toString().trim().toLowerCase()
const isAssigned = (s) => {
  const h = s.house
  return h !== null && h !== undefined && String(h).trim() !== ''
}

// ══════════════════════════════════════════════════════════════
//  SHARED REPORT ENGINE — used by every tab's "Generate Report"
//  button. Takes a title, subtitle, column definitions, and row data;
//  produces a landscape A4 PDF (jsPDF, matching the Gate Pass/
//  Certificate styling elsewhere) or a print-ready HTML view.
//  Deliberately generic — each tab supplies its own columns/rows,
//  this file never needs to know about any tab's internal shape.
// ══════════════════════════════════════════════════════════════
const REPORT_NAVY = [30, 58, 95]
const REPORT_GOLD = [202, 138, 4]
const REPORT_GREY = [100, 116, 139]

function generateTableReportPDF({ title, subtitle, columns, rows, schoolName = 'Guidance Navodaya & Sainik Institute' }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, H = 210
  const marginX = 12
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...REPORT_NAVY)
  doc.text(schoolName, W / 2, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...REPORT_GREY)
  doc.text(title, W / 2, y, { align: 'center' })
  y += 5
  if (subtitle) {
    doc.setFontSize(8.5)
    doc.text(subtitle, W / 2, y, { align: 'center' })
    y += 5
  }
  doc.setDrawColor(...REPORT_GOLD)
  doc.setLineWidth(0.6)
  doc.line(marginX, y, W - marginX, y)
  y += 6

  // Column widths — distribute available width by each column's `width`
  // weight (defaults to 1), so callers can bias wider text columns.
  const usableWidth = W - marginX * 2
  const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0)
  const colWidths = columns.map(c => (usableWidth * (c.width || 1)) / totalWeight)

  const rowHeight = 7
  const headerHeight = 8

  const drawHeader = () => {
    doc.setFillColor(...REPORT_NAVY)
    doc.rect(marginX, y, usableWidth, headerHeight, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    let x = marginX
    columns.forEach((c, i) => {
      doc.text(String(c.label), x + 2, y + 5.5)
      x += colWidths[i]
    })
    y += headerHeight
  }

  drawHeader()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  rows.forEach((row, rIdx) => {
    if (y + rowHeight > H - 14) {
      doc.addPage()
      y = 16
      drawHeader()
    }
    if (rIdx % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(marginX, y, usableWidth, rowHeight, 'F')
    }
    doc.setTextColor(30, 41, 59)
    let x = marginX
    columns.forEach((c, i) => {
      const raw = typeof c.value === 'function' ? c.value(row) : row[c.key]
      const text = raw === null || raw === undefined || raw === '' ? '—' : String(raw)
      const maxChars = Math.floor(colWidths[i] / 1.6)
      const truncated = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
      doc.text(truncated, x + 2, y + 5)
      x += colWidths[i]
    })
    y += rowHeight
  })

  if (rows.length === 0) {
    doc.setTextColor(...REPORT_GREY)
    doc.text('No records for the selected range.', W / 2, y + 10, { align: 'center' })
  }

  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(...REPORT_GREY)
    doc.text(`Generated ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, marginX, H - 8)
    doc.text(`Page ${p} of ${pageCount}`, W - marginX, H - 8, { align: 'right' })
  }

  doc.save(`${title.replace(/[^\w]+/g, '_')}_${today()}.pdf`)
}

function printTableReport({ title, subtitle, columns, rows, schoolName = 'Guidance Navodaya & Sainik Institute' }) {
  const w = window.open('', '_blank')
  if (!w) return
  const headerCells = columns.map(c => `<th>${c.label}</th>`).join('')
  const bodyRows = rows.map((row, i) => {
    const cells = columns.map(c => {
      const raw = typeof c.value === 'function' ? c.value(row) : row[c.key]
      return `<td>${raw === null || raw === undefined || raw === '' ? '—' : raw}</td>`
    }).join('')
    return `<tr style="background:${i % 2 === 1 ? '#f4f6f9' : 'white'}">${cells}</tr>`
  }).join('')
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 2px; }
          h2 { font-size: 13px; color: #64748b; font-weight: 500; margin: 0 0 4px; }
          .sub { font-size: 11px; color: #94a3b8; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; }
          td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
          .empty { text-align: center; padding: 30px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <h1>${schoolName}</h1>
        <h2>${title}</h2>
        ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
        ${rows.length === 0
          ? `<div class="empty">No records for the selected range.</div>`
          : `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
        }
      </body>
    </html>
  `)
  w.document.close()
  w.print()
}

// Drop-in export buttons for any tab. `getRows` may return either an
// array (uses `rows` as-is) or an object { rows, allRows } so a tab
// can offer "export filtered view" vs "export everything" — the
// includeAll toggle only appears when allRows is provided and differs.
function ReportExportButtons({ title, subtitle, columns, rows, allRows }) {
  const [includeAll, setIncludeAll] = useState(false)
  const hasAllOption = Array.isArray(allRows) && allRows.length !== rows.length
  const activeRows = includeAll && hasAllOption ? allRows : rows

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {hasAllOption && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} style={{ width: '14px', height: '14px' }} />
          Include all ({allRows.length})
        </label>
      )}
      <button
        onClick={() => generateTableReportPDF({ title, subtitle, columns, rows: activeRows })}
        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#1e3a5f', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
      >
        ⬇️ PDF
      </button>
      <button
        onClick={() => printTableReport({ title, subtitle, columns, rows: activeRows })}
        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#374151', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
      >
        🖨️ Print
      </button>
    </div>
  )
}

function useMobileView() {
  const [mobile, setMobile] = useState(isMobile())
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return mobile
}

function MobileActionButtons({ actions }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          style={{
            flex: action.fullWidth ? '1 1 100%' : '1 1 auto',
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            background: action.bg || '#eff6ff',
            color: action.color || '#1e3a5f',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  ATTENDANCE TAB — House Dashboard + Quick Roll Call
//  Drop-in replacement for AttendanceTab in Hostel.jsx
// ══════════════════════════════════════════════════════════════

const ATTENDANCE_TYPES = ['Present', 'Absent', 'Late', 'On Leave', 'Sick']

const HOUSE_PALETTE = [
  { color: '#1d4ed8', bg: '#dbeafe', light: '#eff6ff', border: '#93c5fd', dark: '#1e40af' },
  { color: '#dc2626', bg: '#fee2e2', light: '#fff1f2', border: '#fca5a5', dark: '#b91c1c' },
  { color: '#16a34a', bg: '#dcfce7', light: '#f0fdf4', border: '#6ee7b7', dark: '#15803d' },
  { color: '#ca8a04', bg: '#fef9c3', light: '#fefce8', border: '#fde047', dark: '#a16207' },
  { color: '#7c3aed', bg: '#f5f3ff', light: '#faf5ff', border: '#c4b5fd', dark: '#6d28d9' },
  { color: '#0891b2', bg: '#e0f2fe', light: '#f0f9ff', border: '#7dd3fc', dark: '#0e7490' },
  { color: '#be185d', bg: '#fce7f3', light: '#fdf2f8', border: '#f9a8d4', dark: '#9d174d' },
  { color: '#047857', bg: '#d1fae5', light: '#ecfdf5', border: '#6ee7b7', dark: '#065f46' },
]

const statusConfig = {
  Present: { bg: '#dcfce7', color: '#16a34a', icon: '✓' },
  Absent: { bg: '#fee2e2', color: '#dc2626', icon: '✕' },
  Late: { bg: '#fef9c3', color: '#ca8a04', icon: '⏰' },
  'On Leave': { bg: '#dbeafe', color: '#1d4ed8', icon: '🚪' },
  Sick: { bg: '#f5f3ff', color: '#7c3aed', icon: '🏥' },
  Unmarked: { bg: '#f1f5f9', color: '#94a3b8', icon: '?' },
}

// ── Expandable student list shown under a clicked alert banner, with
//    quick per-student action buttons (mark status directly). ──
function AlertStudentPanel({ students, accentColor, actions, onMark, savingId }) {
  if (students.length === 0) {
    return (
      <div style={{ marginTop: '8px', padding: '14px', background: 'white', borderRadius: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        No students to show.
      </div>
    )
  }
  return (
    <div style={{
      marginTop: '8px', background: 'white', borderRadius: '10px', padding: '10px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '6px',
      maxHeight: '360px', overflowY: 'auto',
    }}>
      {students.map(s => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
          background: '#f8fafc', borderRadius: '8px', borderLeft: `3px solid ${accentColor}`,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{s.name}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              GCC-{s.gcc_no || '--'} · {getStudentClass(s) || '--'}{s.house ? ` · 🏠 ${s.house}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {actions.map(a => (
              <button
                key={a.status}
                onClick={() => onMark(s.id, a.status)}
                disabled={savingId === s.id}
                style={{
                  padding: '6px 10px', borderRadius: '7px', border: 'none',
                  background: a.bg, color: a.color, fontSize: '11px', fontWeight: '700',
                  cursor: savingId === s.id ? 'wait' : 'pointer',
                  opacity: savingId === s.id ? 0.5 : 1,
                }}
              >
                {savingId === s.id ? '⏳' : a.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AttendanceTab({ students, currentHousemaster, currentUser, onTabChange, onCompleteTab }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const userRole = (currentUser?.role || currentHousemaster?.role || 'hm').toLowerCase()
  // Mirrors LeaveTab.jsx's canApprove: level 0 needs HM/admin, level 1 needs Superintendent/admin
  const canApproveLeaveLevel = (approvalLevel) => {
    if ((approvalLevel ?? 0) === 0) return userRole === 'hm' || userRole === 'house master' || userRole === 'admin'
    return userRole === 'superintendent' || userRole === 'admin'
  }
  // ── View state: 'houses' | 'dashboard' | 'rollcall'
  const [view, setView] = useState('houses')
  const [selectedHouse, setSelectedHouse] = useState(null)
  const [records, setRecords] = useState([])
  const [allRecords, setAllRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [session, setSession] = useState('morning')
  // Roll call state
  const [rollCallIndex, setRollCallIndex] = useState(0)
  const [rollCallStudents, setRollCallStudents] = useState([])
  const [justMarked, setJustMarked] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const mobile = useMobileView()

  // ── Previous-day completeness check (blocks roll call if either
  //    session from the prior calendar day wasn't fully marked) ──
  const [prevDayRecords, setPrevDayRecords] = useState([])
  const [prevDayLoaded, setPrevDayLoaded] = useState(false)
  const [overrideHouses, setOverrideHouses] = useState({}) // key: `${house}_${date}` → admin bypassed block
  // When a housemaster runs a missed prior-day session, date/session are
  // temporarily swapped to that target; catchUpReturn remembers today's
  // real date+session so we can restore it once the catch-up is done.
  const [catchUpReturn, setCatchUpReturn] = useState(null) // { date, session } | null

  // The "home" date is today's real selected date — but while mid-catch-up,
  // `date` state has been temporarily swapped to the missed prior day, so
  // we anchor off catchUpReturn.date instead to avoid prevDate drifting
  // an extra day back on every catch-up.
  const homeDate = catchUpReturn ? catchUpReturn.date : date

  const prevDate = useMemo(() => {
    const d = new Date(homeDate)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [homeDate])

  // ── House Report modal state (auto-fires when a house hits 100%) ──
  const [reportHouse, setReportHouse] = useState(null)
  const [autoFired, setAutoFired] = useState(loadAutoFired) // key: `${house}_${date}_${session}` → already auto-opened; persisted so it survives remounts
  // Which house the Six-Tab Compliance card on the roll-call "Done" screen
  // is currently showing — defaults to the house whose roll call was just
  // completed, but the housemaster can switch to check another house's
  // compliance status without leaving this screen or restarting a roll call.
  const [complianceViewHouse, setComplianceViewHouse] = useState(null)

  const activeStudents = useMemo(() =>
    students.filter(s => s.status !== 'Inactive'),
    [students]
  )

  const houses = useMemo(() =>
    [...new Set(activeStudents.map(s => normalizeHouse(s.house)).filter(h => h))].sort(),
    [activeStudents]
  )

  // ── House palette (computed once, used in all views) ──
  const houseIdx = selectedHouse ? houses.indexOf(selectedHouse) : -1
  const pal = houseIdx >= 0 ? HOUSE_PALETTE[houseIdx % HOUSE_PALETTE.length] : HOUSE_PALETTE[0]

  // Load ALL attendance records for the day
  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date)
      .eq('session', session)
    setAllRecords(data || [])
    setLoading(false)
  }, [date, session])

  useEffect(() => { loadAll() }, [loadAll])

  // Load previous calendar day's records (both sessions) to check completeness
  useEffect(() => {
    let cancelled = false
    setPrevDayLoaded(false)
    supabase
      .from('attendance_records')
      .select('*')
      .eq('date', prevDate)
      .then(({ data }) => {
        if (!cancelled) {
          setPrevDayRecords(data || [])
          setPrevDayLoaded(true)
        }
      })
    return () => { cancelled = true }
  }, [prevDate])

  // Filter records for selected house
  useEffect(() => {
    if (selectedHouse) {
      setRecords(allRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(selectedHouse)))
    }
  }, [allRecords, selectedHouse])

  const statusMap = useMemo(() =>
    Object.fromEntries(allRecords.map(r => [r.student_id, r.status])),
    [allRecords]
  )
  const getStatus = (studentId) => statusMap[studentId] || 'Unmarked'

  // ── Today's records across BOTH roll-call sessions, independent of
  //    whichever session the top date/session selector is currently
  //    showing. Used to gate the standalone daily-check slots on actual
  //    roll-call completion for the matching session. ──
  const [todayBothSessionRecords, setTodayBothSessionRecords] = useState([])
  useEffect(() => {
    let cancelled = false
    supabase.from('attendance_records').select('student_id, house, session, status').eq('date', date)
      .then(({ data }) => { if (!cancelled) setTodayBothSessionRecords(data || []) })
    return () => { cancelled = true }
  }, [date, allRecords]) // re-check whenever allRecords changes too, so a just-completed roll call unlocks immediately

  const isRollCallSessionComplete = (houseName, rollCallSession) => {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
    if (hStudents.length === 0) return true
    const marked = todayBothSessionRecords.filter(r =>
      normalizeHouse(r.house) === normalizeHouse(houseName) && r.session === rollCallSession
    ).length
    return marked >= hStudents.length
  }

  // ── Per-house stats (defined before the auto-fire effect that uses it) ──
  const getHouseStats = (houseName) => {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
    const hRecords = allRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(houseName))
    const present = hRecords.filter(r => r.status === 'Present').length
    const absent = hRecords.filter(r => r.status === 'Absent').length
    const sick = hRecords.filter(r => r.status === 'Sick').length
    const onLeave = hRecords.filter(r => r.status === 'On Leave').length
    const late = hRecords.filter(r => r.status === 'Late').length
    const marked = hRecords.length
    const total = hStudents.length
    const unmarked = total - marked
    const pct = total ? Math.round(marked / total * 100) : 0
    return { total, present, absent, sick, onLeave, late, marked, unmarked, pct }
  }

  // ── Was the previous calendar day fully covered for this house?
  //    Both morning AND night sessions must have hit 100% marked. ──
  const getPrevDayStatus = (houseName) => {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
    const total = hStudents.length
    if (total === 0) return { complete: true, morningMarked: 0, nightMarked: 0, total: 0 }
    const morningMarked = prevDayRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(houseName) && r.session === 'morning').length
    const nightMarked = prevDayRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(houseName) && r.session === 'night').length
    return {
      complete: morningMarked >= total && nightMarked >= total,
      morningMarked, nightMarked, total,
    }
  }

  const isHouseBlocked = (houseName) => {
    if (!prevDayLoaded) return false // don't block on a flash-of-unloaded-state
    const overrideKey = `${houseName}_${homeDate}`
    if (overrideHouses[overrideKey]) return false
    return !getPrevDayStatus(houseName).complete
  }

  const handleOverride = (houseName) => {
    setOverrideHouses(prev => ({ ...prev, [`${houseName}_${homeDate}`]: true }))
  }

  // ── Let the housemaster actually complete the missed prior-day
  //    session, rather than just bypass the check. Whichever session
  //    (morning/night) is incomplete gets opened first; once BOTH hit
  //    100%, isHouseBlocked clears naturally and today's roll call
  //    unlocks on its own — no override needed. ──
  const [pendingCatchUpHouse, setPendingCatchUpHouse] = useState(null)

  const catchUpTargetRef = useRef(null)

  const handleCatchUpRollCall = (houseName) => {
    const p = getPrevDayStatus(houseName)
    const targetSession = p.morningMarked < p.total ? 'morning' : 'night'
    const targetDate = prevDate
    setCatchUpReturn({ date, session }) // remember where we came from
    catchUpTargetRef.current = { date: targetDate, session: targetSession }
    setSelectedHouse(houseName)
    setPendingCatchUpHouse(houseName)
    setDate(targetDate)
    setSession(targetSession)
    // startRollCall itself fires from an effect below, once allRecords
    // has actually reloaded for (targetDate, targetSession) — calling it
    // synchronously here would still be reading the old session's data.
  }

  // Once date/session switch to the catch-up target and records for
  // that target have loaded, actually open the roll-call view.
  useEffect(() => {
    if (!pendingCatchUpHouse || loading) return
    const target = catchUpTargetRef.current
    if (!target || date !== target.date || session !== target.session) return
    const started = startRollCall(pendingCatchUpHouse)
    if (started) {
      setView('rollcall')
    } else {
      // No students in this house for the catch-up target — bail out of
      // catch-up mode entirely instead of leaving the UI stuck on a
      // permanent "Loading roll call..." screen with nothing to show.
      returnFromCatchUp()
      setView('houses')
    }
    setPendingCatchUpHouse(null)
    catchUpTargetRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCatchUpHouse, loading, allRecords, date, session])

  const returnFromCatchUp = () => {
    if (!catchUpReturn) return
    setDate(catchUpReturn.date)
    setSession(catchUpReturn.session)
    setCatchUpReturn(null)
  }

  // ── Which alert-panel is expanded (shows student list + quick actions) ──
  const [activeAlertPanel, setActiveAlertPanel] = useState(null) // 'absent' | 'unmarked' | 'unassigned' | null

  // Load house list for the unassigned-student house picker
  const [allHouseNames, setAllHouseNames] = useState([])
  useEffect(() => {
    supabase.from('houses').select('name').order('name').then(({ data }) => {
      setAllHouseNames((data || []).map(h => h.name))
    })
  }, [])

  const handleAssignHouse = async (studentId, houseName) => {
    if (!isAdmin) { alert('Only admins can assign students to a house.'); return }
    await supabase.from('students').update({ house: houseName || null }).eq('id', studentId)
    // students prop is owned by the parent (Hostel root); it will refetch
    // on its own polling/refresh cycle, but reflect the change locally too
    // by forcing a reload of attendance records so counts stay accurate.
    await loadAll()
  }

  // ── Auto-fire the House Report the moment a house reaches 100% for this date+session ──
  useEffect(() => {
    if (loading) return
    houses.forEach(houseName => {
      const stats = getHouseStats(houseName)
      const key = `${houseName}_${date}_${session}`
      if (stats.total > 0 && stats.unmarked === 0 && !autoFired[key]) {
        setAutoFired(prev => {
          const next = { ...prev, [key]: true }
          saveAutoFired(next)
          return next
        })
        setReportHouse(houseName)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecords, houses, date, session, loading])

  const reportModal = reportHouse && (
    <HouseReportModal
      house={reportHouse}
      date={date}
      session={session}
      students={activeStudents}
      allRecords={allRecords}
      onClose={() => setReportHouse(null)}
    />
  )

  const handleMark = async (studentId, status) => {
    setSaving(true)
    setSavingId(studentId)
    const existing = allRecords.find(r => r.student_id === studentId)
    const student = activeStudents.find(s => s.id === studentId)
    const payload = {
      date, session,
      student_id: studentId,
      student_name: student?.name || '',
      gcc_no: student?.gcc_no || null,
      class_name: getStudentClass(student),
      house: student?.house || '',
      status,
      marked_by: currentHousemaster?.name || 'System',
      marked_at: new Date().toISOString(),
    }
    const { error } = existing
      ? await supabase.from('attendance_records').update({ status, marked_by: payload.marked_by, marked_at: payload.marked_at }).eq('id', existing.id)
      : await supabase.from('attendance_records').insert([payload])
    if (!error) {
      // Optimistic update
      setAllRecords(prev => {
        if (existing) return prev.map(r => r.student_id === studentId ? { ...r, status } : r)
        return [...prev, { ...payload, id: Date.now() }]
      })
      setJustMarked(studentId)
          setTimeout(() => setJustMarked(null), 600)
          if (!existing) await loadAll() // reconcile real DB id
        }
        setSaving(false)
        setSavingId(null)
      }

  const handleBulkMark = async (studentIds, status) => {
    setSaving(true)
    const payloads = studentIds.map(id => {
      const student = activeStudents.find(s => s.id === id)
      return {
        date, session,
        student_id: id,
        student_name: student?.name || '',
        gcc_no: student?.gcc_no || null,
        class_name: getStudentClass(student),
        house: student?.house || '',
        status,
        marked_by: currentHousemaster?.name || 'System',
        marked_at: new Date().toISOString(),
      }
    })
    const { error } = await supabase.from('attendance_records').upsert(payloads, {
      onConflict: 'date,session,student_id'
    })
    if (!error) await loadAll()
    setSaving(false)
  }

  // ── Start roll call for a house
  // ── Notify housemaster(s) of pending leave requests for their house
  //    the moment roll call opens, so they can check before marking
  //    attendance (e.g. don't mark someone Absent who's actually on
  //    approved-pending leave). De-duped per house+date+session so
  //    re-opening roll call in the same session doesn't spam pushes. ──
  const [pendingLeaveNotified, setPendingLeaveNotified] = useState({})
  const [rollCallPendingLeave, setRollCallPendingLeave] = useState([])

  // ── Six-tab compliance check (Discipline, Sickbay, Repairs, Journal,
  //    Mess Duty, Activities) — runs once when a roll-call session hits
  //    100%, logs any gaps, and drives the strict warning banner. ──
  const [complianceChecked, setComplianceChecked] = useState({}) // key: `${house}_${date}_${session}` → done
  const [complianceMissing, setComplianceMissing] = useState({}) // key → array of missing tab keys
  const [complianceLogId, setComplianceLogId] = useState({}) // key → hm_neglect_log row id (for attaching skip reasons)
  const [skipReasonPromptTab, setSkipReasonPromptTab] = useState(null) // tab key currently showing the reason input
  const [skipReasonDraft, setSkipReasonDraft] = useState('')
  const [skippedWithReason, setSkippedWithReason] = useState({}) // key → { [tabKey]: reason } — local UI reflection
  // Manual fallback for "✓ Complete" — the automatic recheck happens when
  // this component remounts (navigating away to fill the form and back
  // re-runs the six-tab check fresh), but this button lets the
  // housemaster force a recheck without leaving the current view at all.
  const [resolvedByRecheck, setResolvedByRecheck] = useState({}) // key → Set-like object of tab keys confirmed done
  const [recheckingTab, setRecheckingTab] = useState(null) // `${key}_${tabKey}` currently being verified

  // Clear stale pending-leave and skip-reason UI state when switching houses
  useEffect(() => {
    setRollCallPendingLeave([])
    setSkipReasonPromptTab(null)
    setSkipReasonDraft('')
    setSkipReasonError('')
    setComplianceViewHouse(null) // resets the compliance card back to this roll call's own house
  }, [selectedHouse])

  const runComplianceCheck = async (houseName) => {
    const key = `${houseName}_${date}_${session}`
    if (complianceChecked[key]) return
    setComplianceChecked(prev => ({ ...prev, [key]: true }))
    const houseStudentIds = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
      .map(s => s.id)
    const missing = await checkSixTabCompliance(houseName, date, session, houseStudentIds)
    setComplianceMissing(prev => ({ ...prev, [key]: missing }))
    if (missing.length > 0) {
      const logId = await logNeglect(houseName, date, session, currentHousemaster?.name, missing, 'rollcall')
      if (logId) setComplianceLogId(prev => ({ ...prev, [key]: logId }))
    }
  }

  // Manual fallback for "✓ Complete Now" — re-verifies just one tab
  // in-place, without needing to leave and return to this view. If the
  // record now exists, the tab is struck off the missing list.
  const handleRecheckTab = async (complianceKey, tabKey) => {
    const recheckKey = `${complianceKey}_${tabKey}`
    setRecheckingTab(recheckKey)
    const { start, end } = sessionWindow(date, session)
    const houseStudentIds = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(selectedHouse))
      .map(s => s.id)
    const nowCompliant = await recheckSingleTab(tabKey, selectedHouse, start, end, houseStudentIds)
    if (nowCompliant) {
      setResolvedByRecheck(prev => ({
        ...prev,
        [complianceKey]: { ...(prev[complianceKey] || {}), [tabKey]: true },
      }))
    }
    setRecheckingTab(null)
    return nowCompliant
  }

  const [skipReasonError, setSkipReasonError] = useState('')

  const handleSkipWithReason = async (complianceKey, tabKey) => {
    const reason = skipReasonDraft.trim()
    if (!isValidSkipReason(reason)) {
      setSkipReasonError('Please write a real reason (at least a short sentence) — single words like "ok" or "na" aren\'t accepted.')
      return
    }
    setSkipReasonError('')
    const logId = complianceLogId[complianceKey]
    await attachSkipReason(logId, tabKey, reason, currentHousemaster?.name)
    setSkippedWithReason(prev => ({
      ...prev,
      [complianceKey]: { ...(prev[complianceKey] || {}), [tabKey]: reason },
    }))
    setSkipReasonPromptTab(null)
    setSkipReasonDraft('')
  }

  // ── One-tap "Nothing to report" — the primary, no-typing path for a
  // quiet day. Reuses the same skip-reason plumbing (so the neglect log
  // and admin reports keep working unchanged) but with a standard fixed
  // reason instead of requiring the housemaster to type anything.
  const [confirmingNoneTab, setConfirmingNoneTab] = useState(null) // tab key currently saving
  const handleConfirmNothingToReport = async (complianceKey, tabKey) => {
    setConfirmingNoneTab(tabKey)
    const logId = complianceLogId[complianceKey]
    await attachSkipReason(logId, tabKey, 'Nothing to report', currentHousemaster?.name)
    setSkippedWithReason(prev => ({
      ...prev,
      [complianceKey]: { ...(prev[complianceKey] || {}), [tabKey]: 'Nothing to report' },
    }))
    setConfirmingNoneTab(null)
  }

  // ── Standalone 3x-daily compliance check (independent of roll call) ──
  // Tracks per house+date+slot: done / missing tabs / whether the "all
  // clear" confirmation animation has already played for this slot.
  const [dailyCheckHouse, setDailyCheckHouse] = useState(null) // house currently expanded for slot detail
  const [dailyCheckResults, setDailyCheckResults] = useState({}) // key: `${house}_${date}_${slot}` → { missing, checked }
  const [dailyCheckLogId, setDailyCheckLogId] = useState({})
  const [dailySkipPromptTab, setDailySkipPromptTab] = useState(null)
  const [dailySkipDraft, setDailySkipDraft] = useState('')
  const [dailySkippedWithReason, setDailySkippedWithReason] = useState({})
  const [celebratingSlot, setCelebratingSlot] = useState(null) // key that should show the checkmark pop animation
  // Six-Tab Compliance "all clear" celebration on the roll-call Done
  // screen — fires once per complianceKey the moment all 6 checks are
  // confirmed logged, so it plays on the transition into "all clear"
  // rather than replaying on every re-render of an already-clear house.
  const [complianceCelebrated, setComplianceCelebrated] = useState({}) // key: complianceKey → true once played
  const [complianceCelebrating, setComplianceCelebrating] = useState(null) // complianceKey currently animating
  // Manual fallback for daily-slot "✓ Complete", mirroring the roll-call
  // linked version — lets the housemaster force a recheck in place.
  const [dailyResolvedByRecheck, setDailyResolvedByRecheck] = useState({}) // key → { [tabKey]: true }
  const [dailyRecheckingTab, setDailyRecheckingTab] = useState(null) // `${key}_${tabKey}` currently being verified

  const runDailySlotCheck = async (houseName, slotKey) => {
    const key = `${houseName}_${date}_${slotKey}`
    if (dailyCheckResults[key]?.checked) return
    const gate = DAILY_SLOTS.find(s => s.key === slotKey)?.rollCallGate
    if (gate && !isRollCallSessionComplete(houseName, gate)) return // safety net; UI should already prevent this call
    const houseStudentIds = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
      .map(s => s.id)
    const missing = await checkSixTabComplianceForSlot(houseName, date, slotKey, houseStudentIds)
    setDailyCheckResults(prev => ({ ...prev, [key]: { checked: true, missing } }))
    if (missing.length > 0) {
      const logId = await logNeglect(houseName, date, slotKey, currentHousemaster?.name, missing, 'standalone')
      if (logId) setDailyCheckLogId(prev => ({ ...prev, [key]: logId }))
    } else {
      // Fully compliant — trigger the short animated confirmation
      setCelebratingSlot(key)
      setTimeout(() => setCelebratingSlot(prev => (prev === key ? null : prev)), 1800)
    }
  }

  const handleDailyRecheckTab = async (dailyKey, tabKey, houseName, slotKey) => {
    const recheckKey = `${dailyKey}_${tabKey}`
    setDailyRecheckingTab(recheckKey)
    const { start, end } = dailySlotWindow(date, slotKey)
    const houseStudentIds = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
      .map(s => s.id)
    const nowCompliant = await recheckSingleTab(tabKey, houseName, start, end, houseStudentIds)
    if (nowCompliant) {
      setDailyResolvedByRecheck(prev => ({
        ...prev,
        [dailyKey]: { ...(prev[dailyKey] || {}), [tabKey]: true },
      }))
    }
    setDailyRecheckingTab(null)
    return nowCompliant
  }

  const [dailySkipReasonError, setDailySkipReasonError] = useState('')

  const handleDailySkipWithReason = async (dailyKey, tabKey) => {
    const reason = dailySkipDraft.trim()
    if (!isValidSkipReason(reason)) {
      setDailySkipReasonError('Please write a real reason (at least a short sentence) — single words like "ok" or "na" aren\'t accepted.')
      return
    }
    setDailySkipReasonError('')
    const logId = dailyCheckLogId[dailyKey]
    await attachSkipReason(logId, tabKey, reason, currentHousemaster?.name)
    setDailySkippedWithReason(prev => ({
      ...prev,
      [dailyKey]: { ...(prev[dailyKey] || {}), [tabKey]: reason },
    }))
    setDailySkipPromptTab(null)
    setDailySkipDraft('')
  }

  const notifyPendingLeaveForHouse = async (houseName) => {
    const key = `${houseName}_${date}_${session}`
    if (pendingLeaveNotified[key]) return
    try {
      const hStudentIds = activeStudents
        .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
        .map(s => s.id)
      if (hStudentIds.length === 0) return
      const { data: pending } = await supabase
        .from('leave_records')
        .select('id, student_id, student_name, leave_type, from_date, to_date, approval_level, status')
        .in('student_id', hStudentIds)
        .eq('status', 'Pending')
      setRollCallPendingLeave(pending || [])
      if (pending && pending.length > 0) {
        setPendingLeaveNotified(prev => ({ ...prev, [key]: true }))
        const names = pending.slice(0, 5).map(p => p.student_name).filter(Boolean).join(', ')
        const more = pending.length > 5 ? ` +${pending.length - 5} more` : ''
        await notifyHousemasterByHouse(
          houseName,
          `🚪 ${pending.length} pending leave request${pending.length > 1 ? 's' : ''} — ${houseName}`,
          `Before marking roll call: ${names}${more} ${pending.length > 1 ? 'are' : 'is'} awaiting leave approval.`,
          '/hostel?tab=leave'
        )
      }
    } catch (e) {
      console.error('notifyPendingLeaveForHouse failed:', e)
    }
  }

  // ── Inline leave approval from roll call. Uses the exact same DB
  //    transition as LeaveTab.jsx (leaveApproval.js), so audit rows,
  //    quota deduction, and parent SMS all stay correct — this is a
  //    genuine one-click approve, not a shortcut that skips those steps.
  const [approvingLeaveId, setApprovingLeaveId] = useState(null)
  const [approvedLeaveIds, setApprovedLeaveIds] = useState({}) // local UI reflection so approved rows disappear immediately

  // When marking a student "On Leave" in roll call, check if they actually have an
  // unapproved (Pending) leave request — if so, surface it on the card
  // with an inline Approve option instead of silently advancing, since
  // marking someone "On Leave" in roll call shouldn't imply their leave
  // was ever approved.
  // Hoisted to top level (must run unconditionally every render — was
  // previously declared inside the `view === 'rollcall'` conditional block,
  // causing "rendered more hooks than during previous render" (#310)
  // whenever `view` changed away from 'rollcall').
  const [cardLeavePrompt, setCardLeavePrompt] = useState(null) // the pending leave_records row, or null
  useEffect(() => { setCardLeavePrompt(null) }, [rollCallIndex])

  const handleInlineApprove = async (record) => {
    setApprovingLeaveId(record.id)
    try {
      const { exceeded } = await checkQuotaBeforeApproval(record)
      if (exceeded) {
        const proceed = window.confirm(
          `${record.student_name} has no remaining ${record.leave_type} balance for this year. Approve anyway? (Balance will go negative / be overridden.)`
        )
        if (!proceed) { setApprovingLeaveId(null); return }
      }
      const actorName = currentHousemaster?.name || currentUser?.name || (userRole === 'superintendent' ? 'Superintendent' : 'HM')
      const actorPhone = currentHousemaster?.phone || ''
      await approveLeaveRecord(record, actorName, actorPhone)
      setApprovedLeaveIds(prev => ({ ...prev, [record.id]: true }))
      setRollCallPendingLeave(prev => prev.filter(r => r.id !== record.id))
    } catch (e) {
      console.error('handleInlineApprove failed:', e)
      alert('Approval failed: ' + (e.message || 'unknown error'))
    }
    setApprovingLeaveId(null)
  }

  const startRollCall = (houseName) => {
    if (isHouseBlocked(houseName)) return false // safety net; UI should already prevent this call
    notifyPendingLeaveForHouse(houseName) // fire-and-forget; doesn't block roll call opening
    const hStudents = activeStudents
      .filter(s => normalizeHouse(s.house) === normalizeHouse(houseName))
      .sort((a, b) => {
        // Unmarked first
        const aMarked = allRecords.some(r => r.student_id === a.id)
        const bMarked = allRecords.some(r => r.student_id === b.id)
        if (!aMarked && bMarked) return -1
        if (aMarked && !bMarked) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    if (hStudents.length === 0) {
      alert(`No active students found in ${houseName}. Check that student house names match.`)
      return false
    }
    setRollCallStudents(hStudents)
    setRollCallIndex(0)
    setView('rollcall')
    return true
  }

  // ══════════════════════════════════════════════════
  //  VIEW 1: ALL HOUSES OVERVIEW
  // ══════════════════════════════════════════════════
  if (view === 'houses') {
    const totalStudents = activeStudents.length
    const totalMarked = allRecords.length
    const totalPresent = allRecords.filter(r => r.status === 'Present').length
    const totalAbsent = allRecords.filter(r => r.status === 'Absent').length
    const totalUnmarked = totalStudents - totalMarked

    return (
      <div>
        {reportModal}
        <style>{`
          @keyframes hr-daily-pop {
            0% { transform: scale(0.4) rotate(-10deg); opacity: 0; }
            60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .hr-pop-in-anim { display: inline-block; animation: hr-daily-pop 0.5s ease-out; }
        `}</style>
        {/* Date & Session selector */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 140 }}
          />
          <select value={session} onChange={e => setSession(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="morning">🌅 Morning Roll Call</option>
            <option value="night">🌙 Night Roll Call</option>
          </select>
        </div>

        {/* Overall stats bar */}
        <div style={{
          background: '#1e3a5f', borderRadius: '14px', padding: '16px 20px',
          marginBottom: '20px', color: 'white',
        }}>
          <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '10px', fontWeight: '600' }}>
            TODAY'S SUMMARY · {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total', value: totalStudents, color: 'rgba(255,255,255,0.9)' },
              { label: 'Present', value: totalPresent, color: '#4ade80' },
              { label: 'Absent', value: totalAbsent, color: '#f87171' },
              { label: 'Unmarked', value: totalUnmarked, color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: mobile ? '22px' : '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: mobile ? '9px' : '11px', opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Overall progress bar */}
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.6, marginBottom: '5px' }}>
              <span>Roll Call Progress</span>
              <span>{totalMarked}/{totalStudents} marked</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalStudents ? Math.round(totalMarked / totalStudents * 100) : 0}%`,
                background: totalMarked === totalStudents ? '#4ade80' : '#60a5fa',
                borderRadius: '99px', transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        ) : (
          <>
            {/* ── Standalone 3x-Daily Compliance Check ── */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📋 Mandatory 3x-Daily Compliance Check
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {houses.map(houseName => {
                  const isExpanded = dailyCheckHouse === houseName
                  const nowSlot = currentDailySlot()
                  return (
                    <div key={houseName} style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setDailyCheckHouse(isExpanded ? null : houseName)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer' }}
                      >
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', flex: 1 }}>🏠 {houseName}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {DAILY_SLOTS.map(slot => {
                            const key = `${houseName}_${date}_${slot.key}`
                            const result = dailyCheckResults[key]
                            const done = result?.checked && result.missing.length === 0
                            const gaps = result?.checked && result.missing.length > 0
                            const isCurrent = slot.key === nowSlot
                            const locked = !result?.checked && !isRollCallSessionComplete(houseName, slot.rollCallGate)
                            return (
                              <span
                                key={slot.key}
                                style={{
                                  width: '10px', height: '10px', borderRadius: '50%',
                                  background: done ? '#16a34a' : gaps ? '#dc2626' : locked ? '#94a3b8' : isCurrent ? '#ca8a04' : '#e2e8f0',
                                  boxShadow: isCurrent && !result?.checked && !locked ? '0 0 0 3px rgba(202,138,4,0.2)' : 'none',
                                }}
                                title={`${slot.label}: ${done ? 'Complete' : gaps ? 'Gaps found' : locked ? 'Locked — matching roll call not done yet' : isCurrent ? 'Current slot — not checked yet' : 'Not checked'}`}
                              />
                            )
                          })}
                        </div>
                        <span style={{ fontSize: '14px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {DAILY_SLOTS.map(slot => {
                            const key = `${houseName}_${date}_${slot.key}`
                            const result = dailyCheckResults[key]
                            const isCurrent = slot.key === nowSlot
                            const isCelebrating = celebratingSlot === key
                            const gateComplete = isRollCallSessionComplete(houseName, slot.rollCallGate)
                            const gateLabel = slot.rollCallGate === 'morning' ? '🌅 Morning' : '🌙 Night'
                            return (
                              <div key={slot.key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: (result?.checked && result.missing.length > 0) || !gateComplete ? '8px' : 0 }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151', flex: 1 }}>
                                    {slot.label} {isCurrent && <span style={{ color: '#ca8a04' }}>(current)</span>}
                                  </span>
                                  {isCelebrating && (
                                    <span className="hr-pop-in-anim" style={{ fontSize: '16px' }}>✅🎉</span>
                                  )}
                                  {!result?.checked && gateComplete && (
                                    <button
                                      onClick={() => runDailySlotCheck(houseName, slot.key)}
                                      style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#1e3a5f', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      Run Check
                                    </button>
                                  )}
                                  {!result?.checked && !gateComplete && (
                                    <span style={{ padding: '5px 12px', borderRadius: '7px', background: '#e2e8f0', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
                                      🔒 Locked
                                    </span>
                                  )}
                                  {result?.checked && result.missing.length === 0 && !isCelebrating && (
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>✓ All clear</span>
                                  )}
                                </div>
                                {!result?.checked && !gateComplete && (
                                  <div style={{ fontSize: '11px', color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '6px 10px' }}>
                                    ⏳ Complete {gateLabel} roll call for {houseName} first — this slot unlocks automatically once that session is 100% marked.
                                  </div>
                                )}
                                {result?.checked && result.missing.length > 0 && (() => {
                                  const dailyResolvedSet = dailyResolvedByRecheck[key] || {}
                                  const remainingMissing = result.missing.filter(k => !dailyResolvedSet[k])
                                  if (remainingMissing.length === 0) {
                                    return (
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>
                                        ✅ All caught up for this slot!
                                      </div>
                                    )
                                  }
                                  return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700' }}>🚨 Missing for this slot:</div>
                                    {SIX_TABS.filter(t => remainingMissing.includes(t.key)).map(t => {
                                      const reasonGiven = dailySkippedWithReason[key]?.[t.key]
                                      const showingPrompt = dailySkipPromptTab === `${key}_${t.key}`
                                      const recheckKey = `${key}_${t.key}`
                                      return (
                                        <div key={t.key} style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 10px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ padding: '3px 8px', borderRadius: '99px', background: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: '700' }}>{t.label}</span>
                                            {reasonGiven ? (
                                              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '700', flex: 1 }}>✅ "{reasonGiven}"</span>
                                            ) : (
                                              <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                                                <button
                                                  onClick={() => { if (onCompleteTab) onCompleteTab(t.rootTabId, houseName); else onTabChange?.(t.rootTabId) }}
                                                  style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#1e3a5f', color: 'white', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                                                >
                                                  ✓ Complete
                                                </button>
                                                <button
                                                  onClick={() => handleDailyRecheckTab(key, t.key, houseName, slot.key)}
                                                  disabled={dailyRecheckingTab === recheckKey}
                                                  title="Use this if you already filled it in but it's still showing as missing"
                                                  style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: '700', cursor: dailyRecheckingTab === recheckKey ? 'wait' : 'pointer' }}
                                                >
                                                  {dailyRecheckingTab === recheckKey ? '⏳' : '✓ Filled in'}
                                                </button>
                                                <button
                                                  onClick={() => { setDailySkipPromptTab(showingPrompt ? null : `${key}_${t.key}`); setDailySkipDraft(''); setDailySkipReasonError('') }}
                                                  style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#374151', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                                                >
                                                  ⏭ Skip
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                          {showingPrompt && !reasonGiven && (
                                            <div style={{ marginTop: '6px' }}>
                                              <div style={{ display: 'flex', gap: '5px' }}>
                                                <input
                                                  autoFocus
                                                  value={dailySkipDraft}
                                                  onChange={e => { setDailySkipDraft(e.target.value); setDailySkipReasonError('') }}
                                                  placeholder="Explain why (min. a short sentence)..."
                                                  style={{ ...inp, fontSize: '11px', padding: '5px 8px' }}
                                                  onKeyDown={e => { if (e.key === 'Enter') handleDailySkipWithReason(key, t.key) }}
                                                />
                                                <button
                                                  onClick={() => handleDailySkipWithReason(key, t.key)}
                                                  disabled={!isValidSkipReason(dailySkipDraft)}
                                                  style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: isValidSkipReason(dailySkipDraft) ? '#dc2626' : '#e2e8f0', color: isValidSkipReason(dailySkipDraft) ? 'white' : '#94a3b8', fontSize: '10px', fontWeight: '700', cursor: isValidSkipReason(dailySkipDraft) ? 'pointer' : 'not-allowed' }}
                                                >
                                                  OK
                                                </button>
                                              </div>
                                              {dailySkipReasonError && (
                                                <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px' }}>{dailySkipReasonError}</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                  )
                                })()}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {houses.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>No houses to check.</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Select a House
              </div>
              <ReportExportButtons
                title="Roll Call Summary"
                subtitle={`${date} · ${session === 'morning' ? 'Morning' : 'Night'} session`}
                columns={[
                  { key: 'house', label: 'House', width: 1.2 },
                  { key: 'total', label: 'Total', width: 0.7 },
                  { key: 'marked', label: 'Marked', width: 0.7 },
                  { key: 'present', label: 'Present', width: 0.7 },
                  { key: 'absent', label: 'Absent', width: 0.7 },
                  { key: 'late', label: 'Late', width: 0.6 },
                  { key: 'onLeave', label: 'On Leave', width: 0.8 },
                  { key: 'sick', label: 'Sick', width: 0.6 },
                  { key: 'pct', label: '% Complete', width: 0.9 },
                ]}
                rows={houses.map(h => { const s = getHouseStats(h); return { house: h, ...s } })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {houses.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', gridColumn: '1/-1' }}>
                  No houses found. Assign students to houses first.
                </div>
              )}
              {houses.map((houseName, idx) => {
                const pal = HOUSE_PALETTE[idx % HOUSE_PALETTE.length]
                const stats = getHouseStats(houseName)
                const allDone = stats.unmarked === 0
                return (
                  <div
                    key={houseName}
                    onClick={() => { setSelectedHouse(houseName); setView('dashboard') }}
                    style={{
                      background: 'white', borderRadius: '14px', overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: `1.5px solid ${allDone ? '#bbf7d0' : pal.border}`,
                      cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    {/* Color bar */}
                    <div style={{ height: '5px', background: allDone ? '#16a34a' : pal.color }} />
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: pal.color }}>
                            🏠 {houseName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {stats.total} students
                          </div>
                        </div>
                        {allDone
                          ? <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', background: '#dcfce7', color: '#16a34a' }}>✓ Complete</span>
                          : <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', background: '#fef9c3', color: '#ca8a04' }}>{stats.unmarked} pending</span>
                        }
                      </div>

                      {/* Mini stats row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px' }}>
                        {[
                          { label: 'P', value: stats.present, color: '#16a34a', bg: '#dcfce7' },
                          { label: 'A', value: stats.absent, color: '#dc2626', bg: '#fee2e2' },
                          { label: 'L', value: stats.late, color: '#ca8a04', bg: '#fef9c3' },
                          { label: '🚪', value: stats.onLeave, color: '#1d4ed8', bg: '#dbeafe' },
                          { label: '🏥', value: stats.sick, color: '#7c3aed', bg: '#f5f3ff' },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', background: s.bg, borderRadius: '8px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '10px', color: s.color, fontWeight: '600' }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${stats.pct}%`,
                            background: allDone ? '#16a34a' : pal.color,
                            borderRadius: '99px', transition: 'width 0.4s',
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                          {stats.marked}/{stats.total} marked · {stats.pct}%
                        </div>
                      </div>

                      {/* Action buttons */}
                      {(() => {
                        const blocked = isHouseBlocked(houseName)
                        return (
                          <>
                            {blocked && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{ marginBottom: '10px', padding: '10px 12px', background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: '10px' }}
                              >
                                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#dc2626', marginBottom: '6px' }}>
                                  🚫 Yesterday's roll call incomplete — {(() => { const p = getPrevDayStatus(houseName); return `${p.morningMarked}/${p.total} morning · ${p.nightMarked}/${p.total} night` })()}
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); handleCatchUpRollCall(houseName) }}
                                  style={{ width: '100%', padding: '6px', borderRadius: '7px', border: 'none', background: '#1e3a5f', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', marginBottom: isAdmin ? '6px' : 0 }}
                                >
                                  📋 Complete Missed Roll Call
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleOverride(houseName) }}
                                    style={{ width: '100%', padding: '6px', borderRadius: '7px', border: 'none', background: '#dc2626', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                  >
                                    🔓 Override (Admin)
                                  </button>
                                )}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedHouse(houseName); setView('dashboard') }}
                                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: pal.bg, color: pal.color, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                📊 Dashboard
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); if (blocked) return; setSelectedHouse(houseName); startRollCall(houseName) }}
                                disabled={blocked}
                                style={{
                                  flex: 1, padding: '9px', borderRadius: '9px', border: 'none',
                                  background: blocked ? '#e2e8f0' : pal.color,
                                  color: blocked ? '#94a3b8' : 'white',
                                  fontSize: '12px', fontWeight: '700',
                                  cursor: blocked ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {blocked ? '🔒 Blocked' : '⚡ Roll Call'}
                              </button>
                            </div>
                          </>
                        )
                      })()}
                      {allDone && (
                        <button
                          onClick={e => { e.stopPropagation(); setReportHouse(houseName) }}
                          style={{ marginTop: '8px', width: '100%', padding: '9px', borderRadius: '9px', border: 'none', background: '#f5f3ff', color: '#7c3aed', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📄 View Report
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── ALERT BANNER: Absent + Unmarked reminders ── */}
            {(() => {
              const absentCount = allRecords.filter(r => r.status === 'Absent').length
              const unmarkedCount = totalStudents - totalMarked
              if (absentCount === 0 && unmarkedCount === 0) return null

              const absentStudents = activeStudents.filter(s => statusMap[s.id] === 'Absent')
              const unmarkedStudentsAll = activeStudents.filter(s => !statusMap[s.id])

              return (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {absentCount > 0 && (
                    <div>
                      <div
                        onClick={() => setActiveAlertPanel(activeAlertPanel === 'absent' ? null : 'absent')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '13px 16px', background: '#fff1f2',
                          border: '1.5px solid #fca5a5', borderRadius: '12px',
                          fontSize: '13px', color: '#dc2626', fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>🔴</span>
                        <div style={{ flex: 1 }}>
                          <div>{absentCount} student{absentCount > 1 ? 's' : ''} marked <strong>Absent</strong> today</div>
                          <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.85, marginTop: '2px' }}>
                            Verify with housemaster · Check if on approved leave
                          </div>
                        </div>
                        <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: activeAlertPanel === 'absent' ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                      {activeAlertPanel === 'absent' && (
                        <AlertStudentPanel
                          students={absentStudents}
                          accentColor="#dc2626"
                          actions={[
                            { label: '✓ Present', status: 'Present', bg: '#dcfce7', color: '#16a34a' },
                            { label: '🚪 On Leave', status: 'On Leave', bg: '#dbeafe', color: '#1d4ed8' },
                            { label: '🏥 Sick', status: 'Sick', bg: '#f5f3ff', color: '#7c3aed' },
                          ]}
                          onMark={handleMark}
                          savingId={savingId}
                        />
                      )}
                    </div>
                  )}
                  {unmarkedCount > 0 && (
                    <div>
                      <div
                        onClick={() => setActiveAlertPanel(activeAlertPanel === 'unmarked' ? null : 'unmarked')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '13px 16px', background: '#fffbeb',
                          border: '1.5px solid #fcd34d', borderRadius: '12px',
                          fontSize: '13px', color: '#92400e', fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>⏳</span>
                        <div style={{ flex: 1 }}>
                          <div>{unmarkedCount} student{unmarkedCount > 1 ? 's' : ''} still <strong>unmarked</strong></div>
                          <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.85, marginTop: '2px' }}>
                            Tap to mark directly, or open a house's roll call below
                          </div>
                        </div>
                        <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: activeAlertPanel === 'unmarked' ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                      {activeAlertPanel === 'unmarked' && (
                        <AlertStudentPanel
                          students={unmarkedStudentsAll}
                          accentColor="#ca8a04"
                          actions={[
                            { label: '✓ Present', status: 'Present', bg: '#dcfce7', color: '#16a34a' },
                            { label: '✕ Absent', status: 'Absent', bg: '#fee2e2', color: '#dc2626' },
                            { label: '⏰ Late', status: 'Late', bg: '#fef9c3', color: '#ca8a04' },
                            { label: '🚪 Leave', status: 'On Leave', bg: '#dbeafe', color: '#1d4ed8' },
                          ]}
                          onMark={handleMark}
                          savingId={savingId}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Unassigned students warning */}
            {(() => {
              const unassigned = activeStudents.filter(s => !isAssigned(s))
              if (unassigned.length === 0) return null
              return (
                <div style={{ marginTop: '8px' }}>
                  <div
                    onClick={() => setActiveAlertPanel(activeAlertPanel === 'unassigned' ? null : 'unassigned')}
                    style={{ padding: '12px 16px', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', fontSize: '13px', color: '#9a3412', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span style={{ flex: 1 }}>⚠️ {unassigned.length} students have no house assigned and won't appear in roll call.</span>
                    <span style={{ fontSize: '16px', transition: 'transform 0.2s', transform: activeAlertPanel === 'unassigned' ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>
                  {activeAlertPanel === 'unassigned' && (
                    <div style={{ marginTop: '8px', background: 'white', borderRadius: '10px', padding: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                      {unassigned.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#fff7ed', borderRadius: '8px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>GCC-{s.gcc_no || '--'} · {getStudentClass(s) || '--'}</div>
                          </div>
                          {isAdmin ? (
                            <select
                              defaultValue=""
                              onChange={e => { if (e.target.value) handleAssignHouse(s.id, e.target.value) }}
                              style={{ ...inp, width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                            >
                              <option value="" disabled>Assign to house...</option>
                              {allHouseNames.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#9a3412', fontStyle: 'italic' }}>Ask an admin to assign a house</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  //  VIEW 2: HOUSE DASHBOARD
  // ══════════════════════════════════════════════════
  if (view === 'dashboard' && selectedHouse) {
    const hStudents = activeStudents.filter(s => normalizeHouse(s.house) === normalizeHouse(selectedHouse))
      .sort((a, b) => {
        const aStatus = getStatus(a.id)
        const bStatus = getStatus(b.id)
        if (aStatus === 'Unmarked' && bStatus !== 'Unmarked') return -1
        if (aStatus !== 'Unmarked' && bStatus === 'Unmarked') return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    const stats = getHouseStats(selectedHouse)
    const unmarkedStudents = hStudents.filter(s => getStatus(s.id) === 'Unmarked')

    return (
      <div>
        {reportModal}
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setView('houses')} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: '13px' }}>
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: mobile ? '18px' : '22px', fontWeight: '800', color: pal.color }}>
              🏠 {selectedHouse} House
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {date} · {session === 'morning' ? '🌅 Morning' : '🌙 Night'} Roll Call
            </div>
          </div>
          {stats.unmarked === 0 && (
            <button
              onClick={() => setReportHouse(selectedHouse)}
              style={{ ...btn('#7c3aed'), padding: '10px 16px', fontSize: '13px' }}
            >
              📄 View Report
            </button>
          )}
          <button
            onClick={() => { if (!isHouseBlocked(selectedHouse)) startRollCall(selectedHouse) }}
            disabled={isHouseBlocked(selectedHouse)}
            style={{
              ...btn(isHouseBlocked(selectedHouse) ? '#e2e8f0' : pal.color, isHouseBlocked(selectedHouse) ? '#94a3b8' : 'white'),
              padding: '10px 20px', fontSize: '14px',
              cursor: isHouseBlocked(selectedHouse) ? 'not-allowed' : 'pointer',
            }}
          >
            {isHouseBlocked(selectedHouse) ? '🔒 Blocked' : `⚡ Quick Roll Call ${stats.unmarked > 0 ? `(${stats.unmarked} left)` : '✓'}`}
          </button>
        </div>

        {isHouseBlocked(selectedHouse) && (
          <div style={{ background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', marginBottom: '6px' }}>
              🚫 Roll call is blocked for {selectedHouse}
            </div>
            <div style={{ fontSize: '12px', color: '#9a3412', marginBottom: '10px' }}>
              {(() => {
                const p = getPrevDayStatus(selectedHouse)
                return `Yesterday (${prevDate}) wasn't fully marked — ${p.morningMarked}/${p.total} morning, ${p.nightMarked}/${p.total} night. Both sessions must reach 100% before today's roll call can start.`
              })()}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleCatchUpRollCall(selectedHouse)}
                style={{ ...btn('#1e3a5f'), fontSize: '12px', padding: '8px 16px' }}
              >
                📋 Complete Missed Roll Call
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleOverride(selectedHouse)}
                  style={{ ...btn('#dc2626'), fontSize: '12px', padding: '8px 16px' }}
                >
                  🔓 Override & Allow Roll Call (Admin)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { icon: '👥', label: 'Total', value: stats.total, color: pal.color, bg: pal.bg },
            { icon: '✅', label: 'Present', value: stats.present, color: '#16a34a', bg: '#dcfce7' },
            { icon: '❌', label: 'Absent', value: stats.absent, color: '#dc2626', bg: '#fee2e2' },
            { icon: '⏰', label: 'Late', value: stats.late, color: '#ca8a04', bg: '#fef9c3' },
            { icon: '🏥', label: 'Sick', value: stats.sick, color: '#7c3aed', bg: '#f5f3ff' },
            { icon: '🚪', label: 'On Leave', value: stats.onLeave, color: '#1d4ed8', bg: '#dbeafe' },
            { icon: '⚪', label: 'Unmarked', value: stats.unmarked, color: '#94a3b8', bg: '#f1f5f9' },
          ].map(s => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} bg={s.bg} compact />
          ))}
        </div>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
            <span style={{ color: '#1e293b' }}>Roll Call Progress</span>
            <span style={{ color: stats.pct === 100 ? '#16a34a' : pal.color }}>{stats.marked}/{stats.total} · {stats.pct}%</span>
          </div>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${stats.pct}%`,
              background: stats.pct === 100 ? '#16a34a' : pal.color,
              borderRadius: '99px', transition: 'width 0.4s',
            }} />
          </div>
          {stats.pct === 100 && (
            <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700', marginTop: '8px' }}>
              🎉 All {stats.total} students marked for {selectedHouse}!
            </div>
          )}
        </div>

        {/* Quick bulk actions */}
        {stats.unmarked > 0 && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '10px' }}>
              ⚡ {stats.unmarked} students still unmarked — bulk mark:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Present', 'Absent', 'On Leave'].map(status => (
                <button
                  key={status}
                  disabled={saving}
                  onClick={async () => {
                    if (window.confirm(`Mark all ${unmarkedStudents.length} unmarked students in ${selectedHouse} as ${status}?`)) {
                      await handleBulkMark(unmarkedStudents.map(s => s.id), status)
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: statusConfig[status]?.bg || '#f1f5f9',
                    color: statusConfig[status]?.color || '#374151',
                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  {statusConfig[status]?.icon} Mark Unmarked as {status}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Student list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hStudents.map((student, i) => {
            const status = getStatus(student.id)
            const sc = statusConfig[status] || statusConfig['Unmarked']
            const isJust = justMarked === student.id
            return (
              <div
                key={student.id}
                style={{
                  background: isJust ? '#f0fdf4' : 'white',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                  borderLeft: `4px solid ${sc.color}`,
                  transition: 'background 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: mobile ? 'wrap' : 'nowrap',
                }}
              >
                {/* Rank */}
                <div style={{ fontSize: '12px', color: '#94a3b8', minWidth: '20px', fontWeight: '600' }}>{i + 1}</div>

                {/* Student info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{student.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    GCC-{student.gcc_no || '--'} · {getStudentClass(student) || '--'}
                  </div>
                </div>

                {/* Status badge */}
                <span style={{
                  padding: '4px 10px', borderRadius: '99px', fontSize: '12px',
                  fontWeight: '700', background: sc.bg, color: sc.color,
                  whiteSpace: 'nowrap',
                }}>
                  {sc.icon} {status}
                </span>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: mobile ? '160px' : 'none' }}>
                  {ATTENDANCE_TYPES.map(s => {
                    const sConf = statusConfig[s]
                    const isActive = status === s
                    return (
                      <button
                        key={s}
                        onClick={() => handleMark(student.id, s)}
                        disabled={savingId === student.id}
                        title={s}
                        style={{
                          width: '34px', height: '34px',
                          borderRadius: '8px', border: 'none',
                          background: isActive ? sConf.color : '#f1f5f9',
                          color: isActive ? 'white' : '#94a3b8',
                          fontSize: '14px', fontWeight: '700',
                          cursor: savingId === student.id ? 'wait' : 'pointer',
                          transition: 'all 0.15s',
                          opacity: savingId === student.id ? 0.5 : 1,
                        }}
                      >
                        {savingId === student.id ? '⏳' : sConf.icon}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  //  VIEW 3: QUICK ROLL CALL (Card-by-card)
  // ══════════════════════════════════════════════════
  if (view === 'rollcall' && selectedHouse) {
    const total = rollCallStudents.length
    const marked = rollCallStudents.filter(s => getStatus(s.id) !== 'Unmarked').length
    const pct = total ? Math.round(marked / total * 100) : 0
    // "Done" means every student is actually marked — not just that the
    // card index reached the end of the list. Using index alone let the
    // completion screen show even with real students still unmarked if
    // the housemaster paged/skipped past cards without marking them.
    const isDone = total > 0 && marked >= total

    // If the index has run past the list (e.g. paged through without
    // marking everyone) but real students are still unmarked, fall back
    // to the first unmarked student instead of an out-of-bounds/undefined
    // card — this is what actually surfaces "still incomplete, please
    // finish" instead of a broken or blank card.
    const firstUnmarkedIdx = rollCallStudents.findIndex(s => getStatus(s.id) === 'Unmarked')
    const effectiveIndex = (!isDone && rollCallIndex >= total && firstUnmarkedIdx >= 0) ? firstUnmarkedIdx : rollCallIndex
    const currentStudent = rollCallStudents[effectiveIndex]
    const currentStatus = currentStudent ? getStatus(currentStudent.id) : null

    const markAndAdvance = async (studentId, status) => {
      if (status === 'On Leave') {
        const { data: pendingLeave } = await supabase
          .from('leave_records')
          .select('id, student_id, student_name, leave_type, from_date, to_date, approval_level, status')
          .eq('student_id', studentId)
          .eq('status', 'Pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (pendingLeave) {
          await handleMark(studentId, status)
          setCardLeavePrompt(pendingLeave) // hold on this card — don't auto-advance yet
          return
        }
      }
      setCardLeavePrompt(null)
      await handleMark(studentId, status)
      // Advance from effectiveIndex (not the raw state) so a corrected
      // fallback position doesn't leave rollCallIndex growing unbounded
      // past the list length on every subsequent mark.
      setTimeout(() => setRollCallIndex(() => effectiveIndex + 1), 300)
    }

    const dismissCardLeavePrompt = () => {
      setCardLeavePrompt(null)
      setTimeout(() => setRollCallIndex(() => effectiveIndex + 1), 200)
    }

    return (
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {reportModal}
        {rollCallPendingLeave.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8', marginBottom: '8px' }}>
              🚪 {rollCallPendingLeave.length} pending leave request{rollCallPendingLeave.length > 1 ? 's' : ''} for {selectedHouse}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rollCallPendingLeave.map(r => {
                const level = r.approval_level ?? 0
                const canApproveHere = canApproveLeaveLevel(level)
                const justApproved = approvedLeaveIds[r.id]
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'white', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{r.student_name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {r.leave_type} · {r.from_date} → {r.to_date} · needs {level === 0 ? 'HM' : 'Superintendent'} approval
                      </div>
                    </div>
                    {justApproved ? (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>✅ Approved</span>
                    ) : canApproveHere ? (
                      <button
                        onClick={() => handleInlineApprove(r)}
                        disabled={approvingLeaveId === r.id}
                        style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#16a34a', color: 'white', fontSize: '11px', fontWeight: '700', cursor: approvingLeaveId === r.id ? 'wait' : 'pointer' }}
                      >
                        {approvingLeaveId === r.id ? '⏳' : '✓ Approve'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>Needs {level === 0 ? 'HM' : 'Superintendent'}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '6px' }}>
              Check before marking anyone Absent — they may already be on approved leave.
            </div>
          </div>
        )}
        {catchUpReturn && (
          <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '12px', fontWeight: '700', color: '#92400e', textAlign: 'center' }}>
            📋 Catch-up mode — completing the missed {session} roll call for {date}
          </div>
        )}
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => { if (catchUpReturn) returnFromCatchUp(); setView('dashboard') }}
            style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 12px', fontSize: '13px' }}
          >
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', color: pal.color, fontSize: '16px' }}>⚡ {selectedHouse} Roll Call</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{session === 'morning' ? '🌅 Morning' : '🌙 Night'} · {date}</div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: pal.color }}>
            {Math.min(rollCallIndex + 1, total)}/{total}
          </div>
        </div>


        {/* Progress bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? '#16a34a' : pal.color,
              borderRadius: '99px', transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            <span>{marked} marked</span>
            <span>{total - marked} remaining</span>
          </div>
        </div>

        {isDone ? (
          /* ── Done screen ── */
          (() => {
            // House the compliance card is currently showing — defaults to
            // the house whose roll call was just completed, switchable below.
            const complianceHouse = complianceViewHouse || selectedHouse
            // Fire the six-tab compliance check the moment this screen renders complete
            const complianceKey = `${complianceHouse}_${date}_${session}`
            if (!complianceChecked[complianceKey]) runComplianceCheck(complianceHouse)
            const rawMissing = complianceMissing[complianceKey] || []
            const resolvedSet = resolvedByRecheck[complianceKey] || {}
            const missingTabs = rawMissing.filter(k => !resolvedSet[k])
            const checkDone = complianceKey in complianceMissing
            // Fire the "all clear" celebration exactly once per complianceKey —
            // on the transition into all-clear, not on every re-render.
            if (checkDone && missingTabs.length === 0 && !complianceCelebrated[complianceKey]) {
              setComplianceCelebrated(prev => ({ ...prev, [complianceKey]: true }))
              setComplianceCelebrating(complianceKey)
              setTimeout(() => setComplianceCelebrating(prev => (prev === complianceKey ? null : prev)), 2200)
            }
            const isCelebratingCompliance = complianceCelebrating === complianceKey
            return (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <style>{`
              @keyframes hr-compliance-pop {
                0% { transform: scale(0.5) rotate(-8deg); opacity: 0; }
                55% { transform: scale(1.15) rotate(4deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes hr-compliance-glow {
                0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.35); }
                50% { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
              }
              .hr-compliance-pop-anim { display: inline-block; animation: hr-compliance-pop 0.55s ease-out; }
              .hr-compliance-glow-anim { animation: hr-compliance-glow 1.4s ease-out 2; }
            `}</style>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
              {selectedHouse} Roll Call Complete!
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {marked} of {total} students marked
            </div>

            {/* Six-Tab Compliance house switcher — lets the housemaster check
                another house's compliance status without leaving this screen
                or starting a new roll call for that house. */}
            {houses.length > 1 && (
              <div style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ ...lbl, marginBottom: '4px' }}>Six-Tab Compliance for</label>
                <select
                  value={complianceHouse}
                  onChange={e => setComplianceViewHouse(e.target.value)}
                  style={{ ...inp, maxWidth: '260px' }}
                >
                  {houses.map(h => (
                    <option key={h} value={h}>{h}{h === selectedHouse ? ' (this roll call)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {checkDone && missingTabs.length > 0 && (
              <div style={{
                background: '#fef2f2', border: '2px solid #dc2626', borderRadius: '14px',
                padding: '16px 18px', marginBottom: '24px', textAlign: 'left',
              }}>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#dc2626', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🚨</span> STRICT WARNING — Mandatory Checks Skipped
                </div>
                <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '12px' }}>
                  You did not log any activity in the following section{missingTabs.length > 1 ? 's' : ''} for {complianceHouse} during this {session} session. This has been recorded and flagged to admin.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SIX_TABS.filter(t => missingTabs.includes(t.key)).map(t => {
                    const reasonGiven = skippedWithReason[complianceKey]?.[t.key]
                    const isConfirming = confirmingNoneTab === t.key
                    return (
                      <div key={t.key} style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '99px', background: '#fee2e2', color: '#dc2626', fontSize: '12px', fontWeight: '700' }}>
                            {t.label}
                          </span>
                          {reasonGiven ? (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', flex: 1 }}>
                              {reasonGiven === 'Nothing to report' ? '✅ Confirmed — nothing to report' : `✅ Skipped — reason: "${reasonGiven}"`}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                              {/* Primary path: one tap, no typing — covers the common case of a quiet day */}
                              <button
                                onClick={() => handleConfirmNothingToReport(complianceKey, t.key)}
                                disabled={isConfirming}
                                style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: '#16a34a', color: 'white', fontSize: '11px', fontWeight: '700', cursor: isConfirming ? 'wait' : 'pointer' }}
                              >
                                {isConfirming ? '⏳ Saving...' : '✅ Nothing to report'}
                              </button>
                              {/* Secondary path: something actually happened — jump to log it */}
                              <button
                                onClick={() => { if (onCompleteTab) onCompleteTab(t.rootTabId, complianceHouse); else onTabChange?.(t.rootTabId) }}
                                style={{ padding: '6px 10px', borderRadius: '7px', border: `1px solid #e2e8f0`, background: 'transparent', color: '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Log an entry →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {checkDone && missingTabs.length === 0 && (
              <div
                className={isCelebratingCompliance ? 'hr-compliance-glow-anim' : ''}
                style={{
                  background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px',
                  padding: '14px 16px', marginBottom: '24px', fontSize: '13px', fontWeight: '700', color: '#16a34a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap',
                }}
              >
                {isCelebratingCompliance && (
                  <span className="hr-compliance-pop-anim" style={{ fontSize: '20px' }}>🎉</span>
                )}
                <span>✅ Six-Tab Compliance complete for {complianceHouse} — great work! Continue to roll call below.</span>
              </div>
            )}

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {['Present', 'Absent', 'Sick', 'Late', 'On Leave', 'Unmarked'].map(s => {
                const count = s === 'Unmarked'
                  ? rollCallStudents.filter(st => getStatus(st.id) === 'Unmarked').length
                  : rollCallStudents.filter(st => getStatus(st.id) === s).length
                if (count === 0 && s !== 'Present' && s !== 'Absent') return null
                const sc = statusConfig[s]
                return (
                  <div key={s} style={{ background: sc.bg, borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: sc.color }}>{count}</div>
                    <div style={{ fontSize: '12px', color: sc.color, fontWeight: '600' }}>{s}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {rollCallStudents.some(s => getStatus(s.id) === 'Unmarked') && (
                <button
                  onClick={() => {
                    const firstUnmarked = rollCallStudents.findIndex(s => getStatus(s.id) === 'Unmarked')
                    if (firstUnmarked >= 0) { setRollCallIndex(firstUnmarked); setView('rollcall') }
                  }}
                  style={{ ...btn('#ca8a04'), padding: '12px 24px' }}
                >
                  ⏳ Mark Remaining
                </button>
              )}
              {catchUpReturn ? (
                (() => {
                  const p = getPrevDayStatus(selectedHouse)
                  const stillMissing = session === 'morning' ? p.nightMarked < p.total : p.morningMarked < p.total
                  return stillMissing ? (
                    <button
                      onClick={() => handleCatchUpRollCall(selectedHouse)}
                      style={{ ...btn('#dc2626'), padding: '12px 24px' }}
                    >
                      ⏳ Catch Up {session === 'morning' ? 'Night' : 'Morning'} Session Too
                    </button>
                  ) : (
                    <button
                      onClick={() => { returnFromCatchUp(); setView('houses') }}
                      style={{ ...btn('#16a34a'), padding: '12px 24px' }}
                    >
                      ✅ Missed Roll Call Caught Up — Return to Today
                    </button>
                  )
                })()
              ) : (
                <>
                  <button onClick={() => setReportHouse(selectedHouse)} style={{ ...btn('#7c3aed'), padding: '12px 24px' }}>
                    📄 View Report
                  </button>
                  <button onClick={() => setView('dashboard')} style={{ ...btn(pal.color), padding: '12px 24px' }}>
                    View {selectedHouse} Dashboard
                  </button>
                  <button onClick={() => setView('houses')} style={{ ...btn('#f1f5f9', '#374151'), padding: '12px 24px' }}>
                    All Houses
                  </button>
                </>
              )}
            </div>
          </div>
            )
          })()
        ) : !currentStudent ? (
          /* ── No student to show yet (list still loading, or nothing to mark) ── */
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            Loading roll call…
          </div>
        ) : (
          /* ── Student card */
          <div>
            {/* Navigation dots (mini) */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '2px', touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}>
              {rollCallStudents.map((s, i) => {
                const st = getStatus(s.id)
                const sc = statusConfig[st] || statusConfig['Unmarked']
                return (
                  <div
                    key={s.id}
                    onClick={() => setRollCallIndex(i)}
                    title={s.name}
                    style={{
                      width: i === rollCallIndex ? '20px' : '8px',
                      height: '8px',
                      borderRadius: '99px',
                      background: i === rollCallIndex ? pal.color : sc.color,
                      opacity: i === rollCallIndex ? 1 : 0.4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>

            {/* Main student card */}
            <div style={{
              background: 'white', borderRadius: '20px',
              padding: '28px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              border: `2px solid ${currentStatus && currentStatus !== 'Unmarked' ? statusConfig[currentStatus]?.color + '40' : '#e2e8f0'}`,
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              {/* Avatar */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: pal.bg, border: `3px solid ${pal.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', fontWeight: '800', color: pal.color,
                margin: '0 auto 16px',
              }}>
                {(currentStudent.name || '?')[0].toUpperCase()}
              </div>

              <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>
                {currentStudent.name}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                GCC-{currentStudent.gcc_no || '--'} · {getStudentClass(currentStudent) || '--'}
              </div>

              {/* Current status */}
              {currentStatus && currentStatus !== 'Unmarked' && (
                <div style={{
                  display: 'inline-block',
                  padding: '6px 16px', borderRadius: '99px',
                  background: statusConfig[currentStatus]?.bg,
                  color: statusConfig[currentStatus]?.color,
                  fontSize: '13px', fontWeight: '700', marginBottom: '16px',
                }}>
                  {statusConfig[currentStatus]?.icon} Marked as {currentStatus}
                </div>
              )}

              {/* Marked On Leave but the leave itself isn't approved yet */}
              {cardLeavePrompt && cardLeavePrompt.student_id === currentStudent.id && (
                <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#9a3412', marginBottom: '4px' }}>
                    ⚠️ This leave isn't approved yet
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c2d12', marginBottom: '10px' }}>
                    {cardLeavePrompt.leave_type} · {cardLeavePrompt.from_date} → {cardLeavePrompt.to_date} · awaiting {(cardLeavePrompt.approval_level ?? 0) === 0 ? 'HM' : 'Superintendent'} approval
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {canApproveLeaveLevel(cardLeavePrompt.approval_level) ? (
                      <button
                        onClick={async () => {
                          await handleInlineApprove(cardLeavePrompt)
                          dismissCardLeavePrompt()
                        }}
                        disabled={approvingLeaveId === cardLeavePrompt.id}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', fontSize: '12px', fontWeight: '700', cursor: approvingLeaveId === cardLeavePrompt.id ? 'wait' : 'pointer' }}
                      >
                        {approvingLeaveId === cardLeavePrompt.id ? '⏳ Approving...' : '✓ Approve Now'}
                      </button>
                    ) : (
                      <div style={{ flex: 1, fontSize: '11px', color: '#9a3412', alignSelf: 'center' }}>
                        Needs {(cardLeavePrompt.approval_level ?? 0) === 0 ? 'HM' : 'Superintendent'} to approve
                      </div>
                    )}
                    <button
                      onClick={dismissCardLeavePrompt}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#374151', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Big status buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {[
                { status: 'Present', bg: '#16a34a', label: '✓ Present' },
                { status: 'Absent', bg: '#dc2626', label: '✕ Absent' },
              ].map(({ status, bg, label }) => (
                <button
                  key={status}
                  onClick={() => markAndAdvance(currentStudent.id, status)}
                  disabled={savingId === currentStudent.id}
                  style={{
                    padding: '18px', borderRadius: '14px', border: 'none',
                    background: currentStatus === status ? bg : bg + '15',
                    color: currentStatus === status ? 'white' : bg,
                    fontSize: '16px', fontWeight: '800',
                    cursor: 'pointer', transition: 'all 0.15s',
                    minHeight: '60px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Secondary status buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[
                { status: 'Late', bg: '#ca8a04', label: '⏰ Late' },
                { status: 'Sick', bg: '#7c3aed', label: '🏥 Sick' },
                { status: 'On Leave', bg: '#1d4ed8', label: '🚪 Leave' },
              ].map(({ status, bg, label }) => (
                <button
                  key={status}
                  onClick={() => markAndAdvance(currentStudent.id, status)}
                  disabled={savingId === currentStudent.id}
                  style={{
                    padding: '12px 8px', borderRadius: '10px', border: 'none',
                    background: currentStatus === status ? bg : bg + '15',
                    color: currentStatus === status ? 'white' : bg,
                    fontSize: '13px', fontWeight: '700',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setRollCallIndex(i => Math.max(0, i - 1))}
                disabled={rollCallIndex === 0}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '10px 16px', opacity: rollCallIndex === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                tap status to mark & advance
              </span>
              <button
                onClick={() => setRollCallIndex(i => Math.min(total, i + 1))}
                style={{ ...btn('#f1f5f9', '#374151'), padding: '10px 16px' }}
              >
                Skip →
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  TAB: MAINTENANCE / REPAIRS
// ══════════════════════════════════════════════════════════════
const MAINTENANCE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const MAINTENANCE_STATUSES = ['Raised', 'Assigned', 'In Progress', 'Resolved', 'Closed']
const MAINTENANCE_CATEGORIES = ['Plumbing', 'Electrical', 'Furniture', 'Civil', 'Cleaning', 'IT', 'Other']

function MaintenanceTab({ currentHousemaster, currentUser, autoOpenForm }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const isHM = (currentUser?.role || '').toLowerCase() === 'house master'

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [search, setSearch] = useState('')
  const mobile = useMobileView()
  const emptyMaintenance = { category: 'Plumbing', house: '', location: '', room_number: '', description: '', priority: 'Medium', status: 'Raised', reported_by: '', assigned_to: '', resolved_at: '', cost: '', remarks: '' }
  const [form, setForm] = useState(emptyMaintenance)
  const [toast, setToast] = useState(null)
  const showToast = (msg, color = '#16a34a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    if (autoOpenForm) {
      setForm({ ...emptyMaintenance, house: autoOpenForm.house || '' })
      setShowForm(true)
    }
  }, [autoOpenForm?.nonce])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('maintenance_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      reported_by: currentHousemaster?.name || form.reported_by,
      raised_at: new Date().toISOString(),
      resolved_at: form.resolved_at || null, // '' is not a valid timestamptz — must be null
      cost: form.cost !== '' && form.cost !== null ? Number(form.cost) : null,
    }
    const { error } = await supabase.from('maintenance_records').insert([payload])
    if (error) showToast('Error: ' + error.message, '#dc2626')
    else { setForm(emptyMaintenance); setShowForm(false); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    const updates = { status }
    if (status === 'Resolved') updates.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_records').update(updates).eq('id', id)
    const rec = records.find(r => r.id === id)
    if (rec?.reported_by) {
      notifyHousemasterByName(
        rec.reported_by,
        `🔧 Maintenance ${status}`,
        `${rec.category} · ${rec.location}${rec.room_number ? ' · Room ' + rec.room_number : ''} — now ${status}`,
        '/hostel?tab=maintenance'
      )
    }
    load()
  }

  const handleDelete = async id => {
    if (!isAdmin) { showToast('Only admins can delete maintenance records', '#dc2626'); return }
    if (!window.confirm('Delete this maintenance record?')) return
    const { error } = await supabase.from('maintenance_records').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message, '#dc2626')
    else load()
  }

  const filtered = useMemo(() => {
    let f = records
    if (filterStatus !== 'All') f = f.filter(r => r.status === filterStatus)
    if (filterPriority !== 'All') f = f.filter(r => r.priority === filterPriority)
    if (search) { const q = search.toLowerCase(); f = f.filter(r => (r.description || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q)) }
    return f
  }, [records, filterStatus, filterPriority, search])

  const stats = {
    raised: records.filter(r => r.status === 'Raised').length,
    inProgress: records.filter(r => ['Assigned', 'In Progress'].includes(r.status)).length,
    urgent: records.filter(r => r.priority === 'Urgent' && r.status !== 'Closed').length,
    resolved: records.filter(r => r.status === 'Resolved').length,
  }

  if (mobile) {
    return (
      <div>
        {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
        <div style={mobileStatGrid}>
          <StatCard icon="📋" label="Raised" value={stats.raised} color="#1e3a5f" bg="#eff6ff" compact />
          <StatCard icon="🔧" label="In Progress" value={stats.inProgress} color="#ca8a04" bg="#fef9c3" compact />
          <StatCard icon="🚨" label="Urgent" value={stats.urgent} color="#dc2626" bg="#fee2e2" compact />
          <StatCard icon="✅" label="Resolved" value={stats.resolved} color="#16a34a" bg="#dcfce7" compact />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} type="search" />
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '➕'}</button>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <ReportExportButtons
            title="Maintenance / Repairs Records"
            subtitle={`${filtered.length} of ${records.length} records`}
            columns={[
              { key: 'category', label: 'Category', width: 1 },
              { key: 'priority', label: 'Priority', width: 0.8 },
              { key: 'house', label: 'House', width: 1 },
              { key: 'location', label: 'Location', width: 1.4 },
              { key: 'room_number', label: 'Room', width: 0.6 },
              { key: 'description', label: 'Description', width: 2.4 },
              { key: 'status', label: 'Status', width: 1 },
              { key: 'raised_at', label: 'Raised', width: 1, value: r => r.raised_at ? new Date(r.raised_at).toLocaleDateString() : '' },
            ]}
            rows={filtered}
            allRows={records}
          />
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>🔧 New Complaint</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: 1 }}>{MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...inp, flex: 1 }}>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Block/Area" style={{ ...inp, flex: 1 }} />
                  <input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="Room No" style={{ ...inp, flex: 1 }} />
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." required style={{ ...inp, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#dc2626'), flex: 1 }}>{saving ? '⏳' : '✓ Raise'}</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor={r.priority === 'Urgent' ? '#dc2626' : r.priority === 'High' ? '#ca8a04' : '#1e3a5f'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div><span style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', background: '#eff6ff', padding: '2px 8px', borderRadius: '99px' }}>{r.category}</span><span style={{ marginLeft: '6px', ...statusStyle(r.priority) }}>{r.priority}</span></div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>📍 {r.location}{r.room_number ? ` · Room ${r.room_number}` : ''}</div>
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{r.description}</div>
              {r.status !== 'Closed' && r.status !== 'Resolved' && (
                <MobileActionButtons actions={[
                  ...(r.status === 'Raised' ? [{ label: 'Assign', onClick: () => handleStatusChange(r.id, 'Assigned'), bg: '#dbeafe', color: '#1d4ed8' }] : []),
                  ...(r.status === 'Assigned' ? [{ label: 'Start Work', onClick: () => handleStatusChange(r.id, 'In Progress'), bg: '#fef9c3', color: '#ca8a04' }] : []),
                  ...(r.status === 'In Progress' ? [{ label: 'Resolve', onClick: () => handleStatusChange(r.id, 'Resolved'), bg: '#dcfce7', color: '#16a34a' }] : []),
                  { label: 'Close', onClick: () => handleStatusChange(r.id, 'Closed'), bg: '#e5e7eb', color: '#374151' },
                ]} />
              )}
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No maintenance records</div>}
      </div>
    )
  }

  return (
    <div>
      {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
      <div style={statGrid(130)}>
        <StatCard icon="📋" label="Raised" value={stats.raised} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🔧" label="In Progress" value={stats.inProgress} color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🚨" label="Urgent Open" value={stats.urgent} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="✅" label="Resolved" value={stats.resolved} color="#16a34a" bg="#dcfce7" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search location, issue..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto' }}><option value="All">All Status</option>{MAINTENANCE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inp, width: 'auto' }}><option value="All">All Priority</option>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        <ReportExportButtons
          title="Maintenance / Repairs Records"
          subtitle={`${filtered.length} of ${records.length} records${filterStatus !== 'All' ? ` · Status: ${filterStatus}` : ''}${filterPriority !== 'All' ? ` · Priority: ${filterPriority}` : ''}`}
          columns={[
            { key: 'category', label: 'Category', width: 1 },
            { key: 'priority', label: 'Priority', width: 0.8 },
            { key: 'house', label: 'House', width: 1 },
            { key: 'location', label: 'Location', width: 1.4 },
            { key: 'room_number', label: 'Room', width: 0.6 },
            { key: 'description', label: 'Description', width: 2.4 },
            { key: 'status', label: 'Status', width: 1 },
            { key: 'raised_at', label: 'Raised', width: 1, value: r => r.raised_at ? new Date(r.raised_at).toLocaleDateString() : '' },
          ]}
          rows={filtered}
          allRows={records}
        />
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '➕ Raise Complaint'}</button>
      </div>
      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>🔧 New Maintenance Request</h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div><label style={lbl}>Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{MAINTENANCE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Priority</label><select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>{MAINTENANCE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label style={lbl}>House</label><input value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} placeholder="e.g. Kombirei" style={inp} /></div>
              <div><label style={lbl}>Location/Block *</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="e.g. Block A" style={inp} /></div>
              <div><label style={lbl}>Room Number</label><input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="101" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description *</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={3} placeholder="Describe the issue in detail..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div>
                <label style={lbl}>Assigned To{!isAdmin ? ' (admin only)' : ''}</label>
                <input
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Staff name"
                  style={{ ...inp, ...(isAdmin ? {} : { backgroundColor: '#f1f5f9', cursor: 'not-allowed' }) }}
                  disabled={!isAdmin}
                  readOnly={!isAdmin}
                />
              </div>
              <div><label style={lbl}>Estimated Cost</label><input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#dc2626')}>{saving ? '⏳ Saving...' : '✅ Raise Ticket'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div> : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 900 }}>
            <thead><tr style={{ background: '#1e3a5f' }}>{['#', 'Category', 'Priority', 'Location', 'Room', 'Description', 'Status', 'Assigned', 'Raised', 'Actions'].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '600', color: '#1e3a5f' }}>{r.category}</td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.priority)}>{r.priority}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.location}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontFamily: 'monospace' }}>{r.room_number || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>{r.description}</div></td>
                  <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.assigned_to || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{r.raised_at ? new Date(r.raised_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.status === 'Raised' && isAdmin && <button onClick={() => handleStatusChange(r.id, 'Assigned')} style={{ ...btn('#1d4ed8'), fontSize: '11px', padding: '4px 8px' }}>Assign</button>}
                      {r.status === 'Assigned' && <button onClick={() => handleStatusChange(r.id, 'In Progress')} style={{ ...btn('#ca8a04'), fontSize: '11px', padding: '4px 8px' }}>Start</button>}
                      {r.status === 'In Progress' && <button onClick={() => handleStatusChange(r.id, 'Resolved')} style={{ ...btn('#16a34a'), fontSize: '11px', padding: '4px 8px' }}>Resolve</button>}
                      {r.status === 'Resolved' && <button onClick={() => handleStatusChange(r.id, 'Closed')} style={{ ...btn('#374151'), fontSize: '11px', padding: '4px 8px' }}>Close</button>}
                      {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ ...btn('#fee2e2', '#dc2626'), fontSize: '11px', padding: '4px 8px' }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: HOUSEMASTER DASHBOARD
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  HM PERFORMANCE RANKING — last 7 days, admin-only section inside
//  HMDashboard. Scores each housemaster (by house) on three equally
//  weighted factors:
//    1. On-time roll call % — sessions where the last student was
//       marked before that session's window closed (Morning by 12:00,
//       Night by 24:00), out of all sessions that reached 100%.
//    2. Six-tab compliance % — of compliance checks that ran (roll-call
//       linked + standalone 3x-daily), the % with zero missing tabs.
//    3. Neglect-free % — 100 minus (neglect log rows / total checks run).
//  Weak-performance reasons combine the data pattern (which tabs get
//  skipped most) with the actual skip_reasons text housemasters typed.
// ══════════════════════════════════════════════════════════════
// ── Shared performance scoring — computes the same 3-factor score for
//    any date range, so both the 7-day ranking panel and the monthly
//    certificate winner use identical, non-duplicated logic.
// Supabase caps a single .select() at 1000 rows by default. Queries that
// pull attendance/neglect/student data across a whole school for a week
// or a month can easily exceed that — and when they do, Supabase silently
// returns only the first 1000 rows in whatever order Postgres happens to
// produce (not ordered by house or date), so entire houses can vanish
// from aggregate reports with no error. This helper pages through with
// .range() until a page comes back short, guaranteeing every matching
// row is fetched regardless of table size.
async function fetchAllRows(buildQuery) {
  const pageSize = 1000
  let allRows = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) { console.error('fetchAllRows error:', error); break }
    allRows = allRows.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return allRows
}

async function computeHMPerformance(startDateStr, endDateStr) {
  const [attendance, neglect, { data: housemasters }, { data: studentsForCount }] = await Promise.all([
    fetchAllRows(() => supabase.from('attendance_records').select('house, session, date, status, marked_at').gte('date', startDateStr).lte('date', endDateStr)),
    fetchAllRows(() => supabase.from('hm_neglect_log').select('*').gte('date', startDateStr).lte('date', endDateStr)),
    supabase.from('housemasters').select('name, house, phone').eq('status', 'Active'),
    // Fetched so a "No data" house can be distinguished as either
    // "no students assigned here" or "students exist but nothing was
    // logged" — otherwise both look identical in the ranking card.
    supabase.from('students').select('house, status').neq('status', 'Inactive'),
  ])

  // Dedupe by NORMALIZED house name — using the raw string here let
  // casing inconsistencies in stored data (e.g. "Kombirei" vs "KOMBIREI")
  // produce two separate entries for what is actually the same house,
  // each pulling in the same underlying records and housemaster, so the
  // ranking list showed the same housemaster twice with identical stats.
  //
  // Also seed from every ACTIVE housemaster's assigned house, not just
  // houses that happen to appear in attendance/neglect records — a
  // housemaster with zero roll calls logged in the last 7 days was
  // previously missing from the ranking entirely instead of showing up
  // with "No data".
  const houseKeys = [...new Set([
    ...(attendance || []).map(a => normalizeHouse(a.house)),
    ...(neglect || []).map(n => normalizeHouse(n.house)),
    ...(housemasters || []).map(h => normalizeHouse(h.house)),
  ].filter(Boolean))]

  // For display, prefer the housemaster's own house label (usually the
  // best-formatted source) for each normalized key, falling back to
  // whatever casing first appears in attendance/neglect data.
  const displayLabelFor = (key) => {
    const hm = (housemasters || []).find(h => normalizeHouse(h.house) === key)
    if (hm?.house) return hm.house
    const fromAttendance = (attendance || []).find(a => normalizeHouse(a.house) === key)?.house
    if (fromAttendance) return fromAttendance
    return (neglect || []).find(n => normalizeHouse(n.house) === key)?.house || key
  }

  const results = houseKeys.map(houseKey => {
    const houseName = displayLabelFor(houseKey)
    const hm = (housemasters || []).find(h => normalizeHouse(h.house) === houseKey)
    const houseAttendance = (attendance || []).filter(a => normalizeHouse(a.house) === houseKey)
    const houseNeglect = (neglect || []).filter(n => normalizeHouse(n.house) === houseKey)
    const studentCount = (studentsForCount || []).filter(s => normalizeHouse(s.house) === houseKey).length

    // ── Factor 1: On-time roll call %
    const sessionGroups = {}
    houseAttendance.forEach(a => {
      const key = `${a.date}_${a.session}`
      if (!sessionGroups[key]) sessionGroups[key] = []
      sessionGroups[key].push(a)
    })
    const sessionKeys = Object.keys(sessionGroups)
    let onTimeSessions = 0
    sessionKeys.forEach(key => {
      const [dateStr, sess] = key.split('_')
      const { end } = sessionWindow(dateStr, sess)
      const lastMark = sessionGroups[key].reduce((latest, r) =>
        r.marked_at && (!latest || new Date(r.marked_at) > new Date(latest)) ? r.marked_at : latest, null)
      if (lastMark && new Date(lastMark) <= new Date(end)) onTimeSessions++
    })
    const onTimePct = sessionKeys.length > 0 ? Math.round((onTimeSessions / sessionKeys.length) * 100) : null

    // ── Factor 2 & 3: Compliance % and Neglect-free %
    // We only have neglect rows in the DB (clean passes aren't logged),
    // so total checks run is estimated as roll-call sessions plus any
    // standalone slot gaps found — a conservative approximation.
    const standaloneNeglect = houseNeglect.filter(n => n.check_type === 'standalone')
    const totalChecksRun = sessionKeys.length + standaloneNeglect.length
    const cleanChecks = Math.max(0, totalChecksRun - houseNeglect.length)
    const compliancePct = totalChecksRun > 0 ? Math.round((cleanChecks / totalChecksRun) * 100) : null
    const neglectFreePct = totalChecksRun > 0
      ? Math.max(0, 100 - Math.round((houseNeglect.length / totalChecksRun) * 100))
      : null

    const factors = [onTimePct, compliancePct, neglectFreePct].filter(v => v !== null)
    const score = factors.length > 0 ? Math.round(factors.reduce((a, b) => a + b, 0) / factors.length) : null

    // ── Weak-performance reasons
    const tabSkipCounts = {}
    const typedReasons = []
    houseNeglect.forEach(n => {
      (n.missing_tabs || []).forEach(tabKey => {
        tabSkipCounts[tabKey] = (tabSkipCounts[tabKey] || 0) + 1
      })
      if (n.skip_reasons) {
        Object.entries(n.skip_reasons).forEach(([tabKey, reason]) => {
          if (reason) typedReasons.push({ tabKey, reason, date: n.date })
        })
      }
    })
    const topSkippedTabs = Object.entries(tabSkipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => ({ tab: SIX_TABS.find(t => t.key === key)?.label || key, count }))

    return {
      house: houseName,
      hmName: hm?.name || 'Unassigned',
      hmPhone: hm?.phone || '',
      onTimePct, compliancePct, neglectFreePct, score,
      sessionsCount: sessionKeys.length,
      neglectCount: houseNeglect.length,
      studentCount,
      topSkippedTabs,
      typedReasons: typedReasons.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    }
  })

  results.sort((a, b) => {
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return b.score - a.score
  })

  return results
}

// ══════════════════════════════════════════════════════════════
//  CERTIFICATE OF APPRECIATION — monthly top-performing housemaster
//  Auto-computes the winner for the current calendar month (using the
//  same 3-factor score as the 7-day ranking) and generates a
//  professional A4-landscape PDF certificate via jsPDF, matching the
//  navy/gold styling used elsewhere (Gate Pass, reports).
// ══════════════════════════════════════════════════════════════

const CERT_SCHOOL_NAME = 'Guidance Navodaya & Sainik Institute'
const CERT_SCHOOL_ADDRESS = 'Khangabok, Thoubal, Manipur — 795134'

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of month
  const fmt = (d) => d.toISOString().split('T')[0]
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { startStr: fmt(start), endStr: fmt(end), monthLabel }
}

function generateCertificatePDF({ hmName, house, monthLabel, score }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, H = 210
  const navy = [30, 58, 95]
  const gold = [202, 138, 4]
  const grey = [100, 116, 139]

  // Decorative border
  doc.setDrawColor(...gold)
  doc.setLineWidth(1.2)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.4)
  doc.rect(11, 11, W - 22, H - 22)

  // Header
  doc.setTextColor(...navy)
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text(CERT_SCHOOL_NAME, W / 2, 28, { align: 'center' })
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  doc.text(CERT_SCHOOL_ADDRESS, W / 2, 34, { align: 'center' })

  // Gold rule
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.6)
  doc.line(W / 2 - 30, 40, W / 2 + 30, 40)

  // Title
  doc.setTextColor(...gold)
  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  doc.text('Certificate of Appreciation', W / 2, 62, { align: 'center' })

  doc.setTextColor(...grey)
  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.text('Presented for Outstanding Housemaster Performance', W / 2, 72, { align: 'center' })

  // "This is presented to"
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...navy)
  doc.text('This certificate is proudly presented to', W / 2, 92, { align: 'center' })

  // Name — large, centered
  doc.setFont('times', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...navy)
  doc.text(hmName, W / 2, 108, { align: 'center' })

  // Underline beneath name
  const nameWidth = doc.getTextWidth(hmName)
  doc.setDrawColor(...gold)
  doc.setLineWidth(0.4)
  doc.line(W / 2 - nameWidth / 2 - 6, 112, W / 2 + nameWidth / 2 + 6, 112)

  // Body text
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...grey)
  const bodyLines = [
    `Housemaster of ${house} House`,
    `in recognition of exemplary dedication, punctual roll-call completion,`,
    `and consistent compliance during ${monthLabel}.`,
  ]
  bodyLines.forEach((line, i) => {
    doc.text(line, W / 2, 122 + i * 6, { align: 'center' })
  })

  // Score badge
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...navy)
  doc.text(`Performance Score: ${score}%`, W / 2, 148, { align: 'center' })

  // Signature lines
  const sigY = 178
  doc.setDrawColor(...grey)
  doc.setLineWidth(0.3)
  doc.line(50, sigY, 110, sigY)
  doc.line(W - 110, sigY, W - 50, sigY)
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...grey)
  doc.text('Principal', 80, sigY + 6, { align: 'center' })
  doc.text('Superintendent', W - 80, sigY + 6, { align: 'center' })

  // Footer date
  doc.setFontSize(8)
  doc.text(
    `Issued: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
    W / 2, H - 16, { align: 'center' }
  )

  doc.save(`Certificate_${hmName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`)
}

// ── Monthly winner card — auto-computes the top performer for the
//    current calendar month (no admin selection needed) and offers
//    one-click Download PDF + Send via WhatsApp.
function MonthlyCertificateCard() {
  const [loading, setLoading] = useState(true)
  const [winner, setWinner] = useState(null)
  const [monthLabel, setMonthLabel] = useState('')
  const [whatsappStatus, setWhatsappStatus] = useState('idle') // idle | generating | ready

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { startStr, endStr, monthLabel: label } = currentMonthRange()
      setMonthLabel(label)
      const results = await computeHMPerformance(startStr, endStr)
      const top = results.find(r => r.score !== null)
      setWinner(top || null)
      setLoading(false)
    }
    load()
  }, [])

  const handleDownload = () => {
    if (!winner) return
    generateCertificatePDF({ hmName: winner.hmName, house: winner.house, monthLabel, score: winner.score })
  }

  const handleSendWhatsApp = () => {
    if (!winner) return
    setWhatsappStatus('generating')
    generateCertificatePDF({ hmName: winner.hmName, house: winner.house, monthLabel, score: winner.score })
    // The PDF downloads locally; WhatsApp can't auto-attach a file via a
    // link (browser security), so we open a chat with the announcement
    // pre-filled and the admin attaches the just-downloaded PDF manually.
    const message = `🏆 Congratulations ${winner.hmName}!\n\nYou've been recognized as the Top Performing Housemaster for ${monthLabel} at ${CERT_SCHOOL_NAME} — ${winner.house} House, Score: ${winner.score}%.\n\nYour Certificate of Appreciation is attached. Well done!`
    const target = winner.hmPhone ? winner.hmPhone.replace(/\D/g, '') : ''
    const waUrl = `https://wa.me/${target.length === 10 ? '91' + target : target}?text=${encodeURIComponent(message)}`
    setTimeout(() => {
      window.open(waUrl, '_blank')
      setWhatsappStatus('ready')
      setTimeout(() => setWhatsappStatus('idle'), 2000)
    }, 400) // small delay so the PDF save dialog isn't fighting the new tab
  }

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#64748b', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        ⏳ Computing this month's top performer...
      </div>
    )
  }

  if (!winner) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        No performance data yet for {monthLabel}.
      </div>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
      borderRadius: '16px', padding: '22px', color: 'white',
      boxShadow: '0 4px 16px rgba(30,58,95,0.25)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
        🏆 Certificate of Appreciation — {monthLabel}
      </div>
      <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>{winner.hmName}</div>
      <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '16px' }}>🏠 {winner.house} House · Score: {winner.score}%</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleDownload}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#eab308', color: '#1e293b', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
        >
          ⬇️ Download Certificate
        </button>
        <button
          onClick={handleSendWhatsApp}
          disabled={whatsappStatus === 'generating'}
          style={{
            padding: '10px 18px', borderRadius: '10px', border: 'none',
            background: whatsappStatus === 'ready' ? '#16a34a' : '#25D366',
            color: 'white', fontSize: '13px', fontWeight: '800',
            cursor: whatsappStatus === 'generating' ? 'wait' : 'pointer',
            opacity: whatsappStatus === 'generating' ? 0.8 : 1,
          }}
        >
          {whatsappStatus === 'generating' && '⏳ Preparing...'}
          {whatsappStatus === 'ready' && '✅ Sent!'}
          {whatsappStatus === 'idle' && '📲 Send via WhatsApp'}
        </button>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  MONTHLY ROLL CALL REPORT — HM-facing tab (visible to all staff,
//  same as the rest of Hostel). Toggle between "Last 10 Days" and
//  "This Month". Shows per-house summary cards (sessions expected,
//  avg completion %, on-time rate, days blocked) plus a daily
//  breakdown table (one row per day per house: morning/night %
//  marked, on-time status, absent count).
// ══════════════════════════════════════════════════════════════
function HMRollCallReportTab() {
  const [rangeMode, setRangeMode] = useState('last10') // 'last10' | 'month'
  const [loading, setLoading] = useState(true)
  const [houses, setHouses] = useState([])
  const [studentsByHouse, setStudentsByHouse] = useState({}) // house → count of active students
  const [records, setRecords] = useState([]) // attendance_records in range
  const [expandedHouse, setExpandedHouse] = useState(null)
  const mobile = useMobileView()

  const { startStr, endStr, dayList } = useMemo(() => {
    const end = new Date()
    let start
    if (rangeMode === 'last10') {
      start = new Date()
      start.setDate(start.getDate() - 9) // 10 days inclusive of today
    } else {
      start = new Date(end.getFullYear(), end.getMonth(), 1)
    }
    const fmt = d => d.toISOString().split('T')[0]
    const days = []
    const cursor = new Date(start)
    while (cursor <= end) {
      days.push(fmt(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return { startStr: fmt(start), endStr: fmt(end), dayList: days.reverse() } // most recent first
  }, [rangeMode])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: houseRows }, { data: studentRows }, attRows] = await Promise.all([
        supabase.from('houses').select('name'),
        supabase.from('students').select('house').neq('status', 'Inactive'),
        fetchAllRows(() => supabase.from('attendance_records').select('house, session, date, status, marked_at').gte('date', startStr).lte('date', endStr)),
      ])
      setHouses((houseRows || []).map(h => h.name).filter(Boolean).sort())
      const counts = {}
      ;(studentRows || []).forEach(s => {
        const h = normalizeHouse(s.house)
        if (h) counts[h] = (counts[h] || 0) + 1
      })
      setStudentsByHouse(counts)
      setRecords(attRows || [])
      setLoading(false)
    }
    load()
  }, [startStr, endStr])

  // ── Per-house, per-day stats for both sessions ──
  const getDayStats = (houseName, dateStr, session) => {
    const total = studentsByHouse[normalizeHouse(houseName)] || 0
    const dayRecords = records.filter(r =>
      normalizeHouse(r.house) === normalizeHouse(houseName) && r.date === dateStr && r.session === session
    )
    const marked = dayRecords.length
    const absent = dayRecords.filter(r => r.status === 'Absent').length
    const pct = total > 0 ? Math.round((marked / total) * 100) : null
    let onTime = null
    if (marked > 0 && total > 0 && marked >= total) {
      const { end } = sessionWindow(dateStr, session)
      const lastMark = dayRecords.reduce((latest, r) =>
        r.marked_at && (!latest || new Date(r.marked_at) > new Date(latest)) ? r.marked_at : latest, null)
      onTime = lastMark ? new Date(lastMark) <= new Date(end) : null
    }
    return { total, marked, absent, pct, onTime, complete: total > 0 && marked >= total }
  }

  // ── Per-house summary across the whole range ──
  const getHouseSummary = (houseName) => {
    let sessionsExpected = 0, sessionsComplete = 0, onTimeCount = 0, completeWithTimeData = 0, daysBlocked = 0
    dayList.forEach(d => {
      ;['morning', 'night'].forEach(session => {
        const s = getDayStats(houseName, d, session)
        if (s.total === 0) return // no students in this house — don't count as expected
        sessionsExpected++
        if (s.complete) {
          sessionsComplete++
          if (s.onTime !== null) {
            completeWithTimeData++
            if (s.onTime) onTimeCount++
          }
        }
      })
      // A day counts as "blocked/skipped" if BOTH sessions had zero marked
      // despite students existing in the house — i.e. roll call never ran.
      const m = getDayStats(houseName, d, 'morning')
      const n = getDayStats(houseName, d, 'night')
      if (m.total > 0 && m.marked === 0 && n.marked === 0) daysBlocked++
    })
    const completionPct = sessionsExpected > 0 ? Math.round((sessionsComplete / sessionsExpected) * 100) : null
    const onTimePct = completeWithTimeData > 0 ? Math.round((onTimeCount / completeWithTimeData) * 100) : null
    return { sessionsExpected, sessionsComplete, completionPct, onTimePct, daysBlocked }
  }

  const scoreColor = (pct) => pct === null ? '#94a3b8' : pct >= 90 ? '#16a34a' : pct >= 70 ? '#ca8a04' : '#dc2626'
  const scoreBg = (pct) => pct === null ? '#f1f5f9' : pct >= 90 ? '#dcfce7' : pct >= 70 ? '#fef9c3' : '#fee2e2'

  // Flattened one-row-per-house-per-day-per-session view, for export only.
  const exportRows = useMemo(() => {
    const rows = []
    houses.forEach(houseName => {
      dayList.forEach(d => {
        ;['morning', 'night'].forEach(session => {
          const s = getDayStats(houseName, d, session)
          if (s.total === 0) return
          rows.push({
            house: houseName, date: d, session,
            marked: s.marked, total: s.total,
            pct: s.pct === null ? '' : `${s.pct}%`,
            onTime: s.onTime === null ? '' : (s.onTime ? 'Yes' : 'Late'),
            absent: s.absent,
          })
        })
      })
    })
    return rows
  }, [houses, dayList, records, studentsByHouse])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Loading roll call report...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: mobile ? '17px' : '20px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>📆 Roll Call Report</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>{startStr} → {endStr}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '5px', borderRadius: '10px' }}>
          {[{ key: 'last10', label: 'Last 10 Days' }, { key: 'month', label: 'This Month' }].map(m => (
            <button
              key={m.key}
              onClick={() => setRangeMode(m.key)}
              style={{
                padding: '8px 14px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                background: rangeMode === m.key ? '#1e3a5f' : 'transparent',
                color: rangeMode === m.key ? 'white' : '#64748b',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ReportExportButtons
          title="Monthly Roll Call Report"
          subtitle={`${startStr} → ${endStr} · ${exportRows.length} house-session rows`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'house', label: 'House', width: 1 },
            { key: 'session', label: 'Session', width: 1 },
            { key: 'marked', label: 'Marked', width: 0.8, value: r => `${r.marked}/${r.total}` },
            { key: 'pct', label: '% Complete', width: 0.9 },
            { key: 'onTime', label: 'On Time', width: 0.8 },
            { key: 'absent', label: 'Absent', width: 0.7 },
          ]}
          rows={exportRows}
        />
      </div>

      {houses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>No houses found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {houses.map(houseName => {
            const summary = getHouseSummary(houseName)
            const isExpanded = expandedHouse === houseName
            return (
              <div key={houseName} style={{ background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedHouse(isExpanded ? null : houseName)}
                  style={{ padding: '16px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>🏠 {houseName}</span>
                    <span style={{ fontSize: '14px', color: '#94a3b8', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
                    {[
                      { label: 'Sessions', value: `${summary.sessionsComplete}/${summary.sessionsExpected}`, color: '#1e3a5f', bg: '#eff6ff' },
                      { label: 'Completion', value: summary.completionPct === null ? '—' : `${summary.completionPct}%`, color: scoreColor(summary.completionPct), bg: scoreBg(summary.completionPct) },
                      { label: 'On-Time Rate', value: summary.onTimePct === null ? '—' : `${summary.onTimePct}%`, color: scoreColor(summary.onTimePct), bg: scoreBg(summary.onTimePct) },
                      { label: 'Days Blocked', value: summary.daysBlocked, color: summary.daysBlocked > 0 ? '#dc2626' : '#16a34a', bg: summary.daysBlocked > 0 ? '#fee2e2' : '#dcfce7' },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '10px', color: s.color, fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {['Date', '🌅 Morning', '🌙 Night', 'Absent (M/N)'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', fontSize: '11px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dayList.map(d => {
                            const m = getDayStats(houseName, d, 'morning')
                            const n = getDayStats(houseName, d, 'night')
                            const cellStyle = (s) => ({
                              padding: '8px 10px',
                              color: s.pct === null ? '#94a3b8' : s.complete ? (s.onTime === false ? '#ca8a04' : '#16a34a') : '#dc2626',
                              fontWeight: '700',
                            })
                            return (
                              <tr key={d} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', color: '#64748b' }}>{d}</td>
                                <td style={cellStyle(m)}>
                                  {m.pct === null ? '—' : `${m.pct}%`}
                                  {m.complete && m.onTime === false && ' ⏰'}
                                  {m.complete && m.onTime === true && ' ✓'}
                                </td>
                                <td style={cellStyle(n)}>
                                  {n.pct === null ? '—' : `${n.pct}%`}
                                  {n.complete && n.onTime === false && ' ⏰'}
                                  {n.complete && n.onTime === true && ' ✓'}
                                </td>
                                <td style={{ padding: '8px 10px', color: (m.absent + n.absent) > 0 ? '#dc2626' : '#94a3b8' }}>
                                  {m.absent} / {n.absent}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
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


function HMPerformanceRanking() {
  const [loading, setLoading] = useState(true)
  const [rankings, setRankings] = useState([])
  const [expandedHouse, setExpandedHouse] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
      const todayStr = today()
      const results = await computeHMPerformance(sevenDaysAgoStr, todayStr)
      setRankings(results)
      setLoading(false)
    }
    load()
  }, [])

  const scoreColor = (score) => {
    if (score === null) return '#94a3b8'
    if (score >= 80) return '#16a34a'
    if (score >= 60) return '#ca8a04'
    return '#dc2626'
  }
  const scoreBg = (score) => {
    if (score === null) return '#f1f5f9'
    if (score >= 80) return '#dcfce7'
    if (score >= 60) return '#fef9c3'
    return '#fee2e2'
  }

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', padding: '30px', textAlign: 'center', color: '#64748b', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        ⏳ Calculating housemaster performance...
      </div>
    )
  }

  const topPerformer = rankings.find(r => r.score !== null)
  const weakestPerformer = [...rankings].reverse().find(r => r.score !== null)

  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
          🏆 Housemaster Performance — Last 7 Days
        </h3>
      </div>
      <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
        Score = equal weight of on-time roll call, six-tab compliance, and neglect-free rate.
      </p>

      {rankings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No roll-call or compliance data in the last 7 days.</div>
      ) : (
        <>
          {/* Top / Weak performer highlight */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {topPerformer && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  🥇 Top Performer
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>{topPerformer.hmName}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>🏠 {topPerformer.house} · Score: {topPerformer.score}%</div>
              </div>
            )}
            {weakestPerformer && weakestPerformer.house !== topPerformer?.house && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  ⚠️ Needs Attention
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>{weakestPerformer.hmName}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>🏠 {weakestPerformer.house} · Score: {weakestPerformer.score}%</div>
              </div>
            )}
          </div>

          {/* Full ranking list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rankings.map((r, i) => {
              const isExpanded = expandedHouse === r.house
              return (
                <div key={r.house} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', transition: 'box-shadow 0.15s ease' }}>
                  <div
                    onClick={() => setExpandedHouse(isExpanded ? null : r.house)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? '#f8fafc' : 'white' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedHouse(isExpanded ? null : r.house) } }}
                    title={isExpanded ? 'Click to collapse' : 'Click to see details'}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer', background: isExpanded ? '#f8fafc' : 'white' }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#94a3b8', width: '22px' }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{r.hmName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>🏠 {r.house} · {r.sessionsCount} roll calls · {r.neglectCount} gaps logged</div>
                    </div>
                    <div style={{
                      padding: '6px 14px', borderRadius: '99px', fontWeight: '800', fontSize: '14px',
                      background: scoreBg(r.score), color: scoreColor(r.score),
                    }}>
                      {r.score === null ? '—' : `${r.score}%`}
                    </div>
                    <span style={{
                      fontSize: '14px', color: isExpanded ? '#1e3a5f' : '#94a3b8', transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-flex',
                      width: '24px', height: '24px', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', background: isExpanded ? '#e3ecf7' : 'transparent',
                    }}>▾</span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '14px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
                      {/* Diagnostic: why this house has "No data" — distinguishes
                          "no students assigned" from "students exist but nothing
                          was logged in 7 days", since both looked identical before. */}
                      {r.score === null && (
                        <div style={{
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          padding: '10px 12px', borderRadius: '8px', marginBottom: '12px',
                          background: r.studentCount === 0 ? '#f1f5f9' : '#fef2f2',
                          border: `1px solid ${r.studentCount === 0 ? '#e2e8f0' : '#fca5a5'}`,
                        }}>
                          <span style={{ fontSize: '14px' }}>{r.studentCount === 0 ? 'ℹ️' : '⚠️'}</span>
                          <div style={{ fontSize: '12px', color: '#374151' }}>
                            {r.studentCount === 0
                              ? <>No active students are currently assigned to this house.</>
                              : <><strong>{r.studentCount} student{r.studentCount !== 1 ? 's' : ''}</strong> in this house, but no roll call or check has been logged in the last 7 days — {r.hmName} may not be using the app for daily checks.</>
                            }
                          </div>
                        </div>
                      )}
                      {/* Factor breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { label: '✅ On-Time Roll Call', value: r.onTimePct },
                          { label: '📋 Six-Tab Compliance', value: r.compliancePct },
                          { label: '🚫 Neglect-Free', value: r.neglectFreePct },
                        ].map(f => (
                          <div key={f.label} style={{ background: 'white', borderRadius: '8px', padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>{f.label}</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: scoreColor(f.value) }}>
                              {f.value === null ? 'No data' : `${f.value}%`}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Weak-performance reasons */}
                      {r.topSkippedTabs.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>Most skipped checks:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {r.topSkippedTabs.map(t => (
                              <span key={t.tab} style={{ padding: '3px 10px', borderRadius: '99px', background: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: '700' }}>
                                {t.tab} ({t.count}×)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.typedReasons.length > 0 ? (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>Reasons given (most recent):</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {r.typedReasons.map((tr, idx) => {
                              const tabLabel = SIX_TABS.find(t => t.key === tr.tabKey)?.label || tr.tabKey
                              return (
                                <div key={idx} style={{ fontSize: '11px', color: '#64748b', background: 'white', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '6px 10px' }}>
                                  <span style={{ fontWeight: '700', color: '#374151' }}>{tabLabel}</span> ({tr.date}): "{tr.reason}"
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : r.neglectCount > 0 ? (
                        <div style={{ fontSize: '11px', color: '#9a3412', fontStyle: 'italic' }}>
                          No reasons were given for the skipped checks above — logged as unexplained gaps.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Ledger-style helpers for HMDashboard's redesigned header/attention list ──
const greetingWord = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}
// A small filled dot in the given color — reads as a wax-seal / register
// priority mark instead of a colored left-border strip.
const SealDot = ({ color, size = 9 }) => (
  <span style={{
    display: 'inline-block', width: size, height: size, borderRadius: '50%',
    background: color, boxShadow: `0 0 0 3px ${color}22`, flexShrink: 0,
  }} />
)

function HMDashboard({ students, staffProfiles, currentHousemaster, onTabChange, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [attendanceToday, setAttendanceToday] = useState([])
  const [leaveToday, setLeaveToday] = useState([])
  const [sickbayToday, setSickbayToday] = useState([])
  const [maintenanceOpen, setMaintenanceOpen] = useState([])
  const [disciplineOpen, setDisciplineOpen] = useState([])
  const [nightDutyTonight, setNightDutyTonight] = useState(null)
  // Pending doubt-session tasks assigned to THIS housemaster (from
  // EnhancedLogEntry.jsx's doubt_sessions table) — matched by hm_name,
  // the same plain-text matching convention used elsewhere (e.g.
  // notifyHousemasterByName). Surfaced here so a housemaster sees their
  // pending teaching-support task the moment they land on the dashboard.
  const [myDoubtTasks, setMyDoubtTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const mobile = useMobileView()

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      const todayStr = today()
      const hmName = (currentHousemaster?.name || '').trim()
      const [a, l, s, m, d, n, ds] = await Promise.all([
        supabase.from('attendance_records').select('*').eq('date', todayStr).eq('session', 'morning'),
        supabase.from('leave_records').select('*').eq('from_date', todayStr).in('status', ['Approved', 'Pending']),
        supabase.from('sickbay_records').select('*').eq('status', 'Admitted'),
        supabase.from('maintenance_records').select('*').in('status', ['Raised', 'Assigned', 'In Progress']).eq('priority', 'Urgent'),
        supabase.from('discipline_records').select('*').in('status', ['Open', 'In Progress']),
        supabase.from('night_duty').select('*').eq('date', todayStr).limit(1).maybeSingle(),
        hmName
          ? supabase.from('doubt_sessions').select('*').ilike('hm_name', hmName).eq('status', 'open').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setAttendanceToday(a.data || [])
      setLeaveToday(l.data || [])
      setSickbayToday(s.data || [])
      setMaintenanceOpen(m.data || [])
      setDisciplineOpen(d.data || [])
      setNightDutyTonight(n.data)
      setMyDoubtTasks(ds.data || [])
      setLoading(false)
    }
    loadDashboard()
  }, [currentHousemaster?.name])

  const presentCount = attendanceToday.filter(r => r.status === 'Present').length
  const absentCount = attendanceToday.filter(r => r.status === 'Absent').length
  const unmarkedCount = students.filter(s => s.status !== 'Inactive').length - attendanceToday.length

  // One-row-per-metric summary, for the dashboard's Generate Report button.
  const snapshotRows = [
    { metric: 'Present (Morning)', value: presentCount },
    { metric: 'Absent (Morning)', value: absentCount },
    { metric: 'Unmarked', value: unmarkedCount },
    { metric: 'Pending Leave Requests', value: leaveToday.length },
    { metric: 'Currently in Sickbay', value: sickbayToday.length },
    { metric: 'Open Discipline Cases', value: disciplineOpen.length },
    { metric: 'Urgent Maintenance', value: maintenanceOpen.length },
    { metric: 'Pending Doubt Sessions', value: myDoubtTasks.length },
  ]

  const quickActions = [
    { id: 'attendance', label: '✓ Roll Call', icon: '✓', color: '#16a34a', bg: '#dcfce7', desc: `${presentCount}/${students.length} marked` },
    { id: 'leave', label: '🚪 Leave', icon: '🚪', color: '#1d4ed8', bg: '#dbeafe', desc: `${leaveToday.length} requests` },
    { id: 'sickbay', label: '🏥 Sickbay', icon: '🏥', color: '#7c3aed', bg: '#f5f3ff', desc: `${sickbayToday.length} admitted` },
    { id: 'discipline', label: '⚠️ Discipline', icon: '⚠️', color: '#dc2626', bg: '#fee2e2', desc: `${disciplineOpen.length} open` },
    { id: 'maintenance', label: '🔧 Repairs', icon: '🔧', color: '#ca8a04', bg: '#fef9c3', desc: `${maintenanceOpen.length} urgent` },
    { id: 'journal', label: '📝 Journal', icon: '📝', color: '#1e3a5f', bg: '#eff6ff', desc: 'Daily notes' },
    { id: 'doubtsession', label: '🙋 Doubt', icon: '🙋', color: '#b45309', bg: '#fef9c3', desc: `${myDoubtTasks.length} pending` },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Loading dashboard...</div>

  if (mobile) {
    return (
      <div>
        {/* ── Ledger header band: navy surface, gold foil rule, register-line greeting ── */}
        <div style={{
          background: MD.color.primary, borderRadius: MD.radius.card,
          padding: '18px 18px 16px', marginBottom: '16px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '3px', background: `linear-gradient(90deg, ${MD.color.secondary}, ${MD.color.secondary}00 85%)` }} />
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: MD.color.secondary, marginBottom: '4px' }}>
            Today's Entry
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: '800', color: 'white', margin: 0, fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Good {greetingWord()}, {currentHousemaster?.name || currentUser?.name || 'House Master'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <div style={{ marginTop: '12px' }}>
            <ReportExportButtons
              title="HM Dashboard — Daily Snapshot"
              subtitle={`${currentHousemaster?.name || currentUser?.name || 'House Master'} · ${today()}`}
              columns={[
                { key: 'metric', label: 'Metric', width: 2 },
                { key: 'value', label: 'Value', width: 1 },
              ]}
              rows={snapshotRows}
            />
          </div>
        </div>
        {myDoubtTasks.length > 0 && (
          <div
            onClick={() => onTabChange?.('doubtsession')}
            style={{
              ...mobileCard, marginBottom: '14px', cursor: 'pointer',
              background: MD.color.secondaryContainer, border: `1.5px solid ${MD.color.secondary}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>🙋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: MD.color.onSecondaryContainer }}>
                  {myDoubtTasks.length} doubt session{myDoubtTasks.length > 1 ? 's' : ''} need{myDoubtTasks.length === 1 ? 's' : ''} your attention
                </div>
                <div style={{ fontSize: '11px', color: MD.color.onSecondaryContainer, opacity: 0.85, marginTop: '2px' }}>
                  {myDoubtTasks.slice(0, 2).map(t => `${t.subject_name || 'Subject'}${t.class_name ? ' · ' + t.class_name : ''}`).join(' · ').slice(0, 90)}
                  {myDoubtTasks.length > 2 ? '…' : ''}
                </div>
              </div>
              <span style={{ fontSize: '18px', color: MD.color.onSecondaryContainer }}>→</span>
            </div>
          </div>
        )}
        {nightDutyTonight && (
          <div style={{ ...mobileCard, marginBottom: '14px', background: MD.color.primary, color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🌙</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>Tonight's Duty</div>
              <div style={{ fontSize: '15px', fontWeight: '700' }}>{nightDutyTonight.staff1}{nightDutyTonight.staff2 ? ` & ${nightDutyTonight.staff2}` : ''}</div>
              <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.75 }}>{nightDutyTonight.shift} · {nightDutyTonight.post}</div>
            </div>
          </div>
        )}
        {/* ── Index-tab quick actions: flat cream cards with a colored top tab, not a filled tonal block ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {quickActions.map(action => (
            <button key={action.id} onClick={() => onTabChange?.(action.id)} style={{
              background: MD.color.surfaceContainer, border: `1px solid ${MD.color.outlineVariant}`,
              borderTop: `3px solid ${action.color}`, borderRadius: MD.radius.field,
              padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: '5px', minHeight: '86px',
              boxShadow: MD.elevation[1],
            }}>
              <span style={{ fontSize: '22px' }}>{action.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: MD.color.onSurface }}>{action.label}</span>
              <span style={{ fontSize: '11px', color: MD.color.onSurfaceVariant }}>{action.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ ...mobileCard, marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: MD.color.onSurface, margin: '0 0 2px', fontFamily: 'Georgia, serif' }}>Today's Snapshot</h3>
          <p style={{ fontSize: '10px', color: MD.color.onSurfaceVariant, margin: '0 0 14px' }}>Morning roll call</p>
          {(() => {
            const totalMarked = presentCount + absentCount
            const attendedPct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null
            const tallyItems = [
              { label: 'Present', value: presentCount, color: MD.color.success },
              { label: 'Absent', value: absentCount, color: MD.color.error },
              { label: 'On Leave', value: leaveToday.length, color: MD.color.primary },
              { label: 'In Sickbay', value: sickbayToday.length, color: '#7c3aed' },
              { label: 'Unmarked', value: unmarkedCount, color: MD.color.secondary },
            ]
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '800', color: attendedPct === null ? MD.color.onSurfaceVariant : attendedPct >= 90 ? MD.color.success : attendedPct >= 70 ? MD.color.secondary : MD.color.error, lineHeight: 1, fontFamily: 'Georgia, serif' }}>
                    {attendedPct === null ? '—' : `${attendedPct}%`}
                  </span>
                  <span style={{ fontSize: '12px', color: MD.color.onSurfaceVariant, fontWeight: '600' }}>present of {totalMarked || students.length} marked</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: `1px solid ${MD.color.outlineVariant}`, borderRadius: MD.radius.control, overflow: 'hidden' }}>
                  {tallyItems.map((s, idx) => (
                    <div key={s.label} style={{
                      textAlign: 'center', padding: '10px 4px',
                      borderLeft: idx % 3 > 0 ? `1px dashed ${MD.color.outlineVariant}` : 'none',
                      borderTop: idx >= 3 ? `1px dashed ${MD.color.outlineVariant}` : 'none',
                    }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: MD.color.onSurfaceVariant, fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>

        {isAdmin && (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <MonthlyCertificateCard />
            <HMPerformanceRanking />
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* ── Ledger header band: navy surface, gold foil rule, register-line greeting ── */}
      <div style={{
        background: MD.color.primary, borderRadius: MD.radius.card,
        padding: '26px 28px 22px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '4px', background: `linear-gradient(90deg, ${MD.color.secondary}, ${MD.color.secondary}00 70%)` }} />
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', border: `1px solid rgba(255,255,255,0.06)` }} />
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.14em', textTransform: 'uppercase', color: MD.color.secondary, marginBottom: '6px' }}>
            Today's Entry · {today()}
          </div>
          <h2 style={{ fontSize: '27px', fontWeight: '800', color: 'white', margin: 0, fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Good {greetingWord()}, {currentHousemaster?.name || currentUser?.name || 'House Master'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', margin: '5px 0 0' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div style={{ marginTop: '14px' }}>
            <ReportExportButtons
              title="HM Dashboard — Daily Snapshot"
              subtitle={`${currentHousemaster?.name || currentUser?.name || 'House Master'} · ${today()}`}
              columns={[
                { key: 'metric', label: 'Metric', width: 2 },
                { key: 'value', label: 'Value', width: 1 },
              ]}
              rows={snapshotRows}
            />
          </div>
        </div>
        {nightDutyTonight && (
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'white', padding: '14px 22px', borderRadius: MD.radius.field, backdropFilter: 'blur(2px)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: MD.color.secondary }}>🌙 Tonight's Duty</div>
            <div style={{ fontSize: '17px', fontWeight: '700', marginTop: '2px' }}>{nightDutyTonight.staff1}{nightDutyTonight.staff2 ? ` & ${nightDutyTonight.staff2}` : ''}</div>
            <div style={{ fontSize: '12px', opacity: 0.75 }}>{nightDutyTonight.shift} · {nightDutyTonight.post}</div>
          </div>
        )}
      </div>
      {myDoubtTasks.length > 0 && (
        <div
          onClick={() => onTabChange?.('doubtsession')}
          style={{
            ...card, marginBottom: '20px', cursor: 'pointer',
            background: MD.color.secondaryContainer, border: `1.5px solid ${MD.color.secondary}`,
            display: 'flex', alignItems: 'center', gap: '14px',
          }}
        >
          <span style={{ fontSize: '28px' }}>🙋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: MD.color.onSecondaryContainer }}>
              {myDoubtTasks.length} doubt session{myDoubtTasks.length > 1 ? 's' : ''} need{myDoubtTasks.length === 1 ? 's' : ''} your attention
            </div>
            <div style={{ fontSize: '12px', color: MD.color.onSecondaryContainer, opacity: 0.85, marginTop: '3px' }}>
              {myDoubtTasks.slice(0, 3).map(t => `${t.subject_name || 'Subject'}${t.class_name ? ' · ' + t.class_name : ''}${t.teacher_name ? ' (from ' + t.teacher_name + ')' : ''}`).join('  ·  ')}
              {myDoubtTasks.length > 3 ? ` +${myDoubtTasks.length - 3} more` : ''}
            </div>
          </div>
          <span style={{ fontSize: '20px', color: MD.color.onSecondaryContainer, fontWeight: '700' }}>→</span>
        </div>
      )}
      {/* ── Index-tab quick actions: flat surface cards with a colored top tab, not a filled tonal block ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {quickActions.map(action => (
          <div key={action.id} onClick={() => onTabChange?.(action.id)} style={{
            background: MD.color.surfaceContainer, borderRadius: MD.radius.card,
            padding: '20px', border: `1px solid ${MD.color.outlineVariant}`,
            borderTop: `3px solid ${action.color}`, cursor: 'pointer',
            boxShadow: MD.elevation[1], transition: 'box-shadow 0.15s ease, transform 0.1s ease',
          }}>
            <div style={{ fontSize: '26px', marginBottom: '10px' }}>{action.icon}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: action.color, marginBottom: '4px' }}>{action.label}</div>
            <div style={{ fontSize: '13px', color: MD.color.onSurfaceVariant }}>{action.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: MD.color.onSurface, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>Today's Snapshot</h3>
          <p style={{ fontSize: '11px', color: MD.color.onSurfaceVariant, margin: '0 0 18px' }}>Morning roll call · {today()}</p>
          {(() => {
            const totalMarked = presentCount + absentCount
            const attendedPct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null
            const tallyItems = [
              { label: 'Present', value: presentCount, color: MD.color.success },
              { label: 'Absent', value: absentCount, color: MD.color.error },
              { label: 'On Leave', value: leaveToday.length, color: MD.color.primary },
              { label: 'In Sickbay', value: sickbayToday.length, color: '#7c3aed' },
              { label: 'Unmarked', value: unmarkedCount, color: MD.color.secondary },
            ]
            return (
              <>
                {/* Anchor stat — the number an HM actually scans for first */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '40px', fontWeight: '800', color: attendedPct === null ? MD.color.onSurfaceVariant : attendedPct >= 90 ? MD.color.success : attendedPct >= 70 ? MD.color.secondary : MD.color.error, lineHeight: 1, fontFamily: 'Georgia, serif' }}>
                    {attendedPct === null ? '—' : `${attendedPct}%`}
                  </span>
                  <span style={{ fontSize: '13px', color: MD.color.onSurfaceVariant, fontWeight: '600' }}>present of {totalMarked || students.length} marked</span>
                </div>
                {/* Ledger tally row — a single ruled strip, entries separated by hairline dividers like a register page, instead of four competing colored blocks */}
                <div style={{ display: 'flex', borderTop: `1px solid ${MD.color.outlineVariant}`, borderBottom: `1px solid ${MD.color.outlineVariant}` }}>
                  {tallyItems.map((s, idx) => (
                    <div key={s.label} style={{
                      flex: 1, textAlign: 'center', padding: '14px 8px',
                      borderLeft: idx > 0 ? `1px dashed ${MD.color.outlineVariant}` : 'none',
                    }}>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '11px', color: MD.color.onSurfaceVariant, fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: MD.color.onSurface, margin: '0 0 16px', fontFamily: 'Georgia, serif' }}>Attention Required</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unmarkedCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: MD.color.secondaryContainer, borderRadius: MD.radius.control }}>
                <SealDot color={MD.color.secondary} />
                <div>
                  <div style={{ fontWeight: '700', color: MD.color.onSecondaryContainer, fontSize: '14px' }}>{unmarkedCount} students unmarked</div>
                  <div style={{ fontSize: '13px', color: MD.color.onSurfaceVariant }}>Morning roll call pending</div>
                </div>
              </div>
            )}
            {maintenanceOpen.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: MD.color.errorContainer, borderRadius: MD.radius.control }}>
                <SealDot color={MD.color.error} />
                <div>
                  <div style={{ fontWeight: '700', color: MD.color.error, fontSize: '14px' }}>🔧 Urgent: {m.category}</div>
                  <div style={{ fontSize: '13px', color: MD.color.onSurfaceVariant }}>{m.location} · {m.description}</div>
                </div>
              </div>
            ))}
            {disciplineOpen.slice(0, 3).map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: MD.color.errorContainer, borderRadius: MD.radius.control }}>
                <SealDot color={MD.color.error} />
                <div>
                  <div style={{ fontWeight: '700', color: MD.color.error, fontSize: '14px' }}>⚠️ {d.student_name}</div>
                  <div style={{ fontSize: '13px', color: MD.color.onSurfaceVariant }}>{d.incident}</div>
                </div>
              </div>
            ))}
            {unmarkedCount === 0 && maintenanceOpen.length === 0 && disciplineOpen.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 20px', color: MD.color.success, fontWeight: '700' }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>✅</div>
                All clear! No urgent items.
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <MonthlyCertificateCard />
          <HMPerformanceRanking />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: HOUSEMASTER JOURNAL
// ══════════════════════════════════════════════════════════════
function JournalTab({ currentHousemaster, autoOpenForm, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(today())
  const [search, setSearch] = useState('')
  const mobile = useMobileView()
  const [toast, setToast] = useState(null)
  const showToast = (msg, color = '#16a34a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }
  const JOURNAL_CATEGORIES = ['General', 'Assembly', 'Discipline', 'Medical', 'Maintenance', 'Parent Call', 'Staff Handover', 'Inspection', 'Event']
  const emptyJournalForm = { entry_date: today(), entry_time: nowTime(), category: 'General', title: '', content: '', house: '', flagged: false }
  const [form, setForm] = useState(emptyJournalForm)

  useEffect(() => {
    if (autoOpenForm) {
      setForm({ ...emptyJournalForm, entry_date: today(), entry_time: nowTime(), house: autoOpenForm.house || '' })
      setShowForm(true)
    }
  }, [autoOpenForm?.nonce])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('housemaster_journal').select('*').order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('housemaster_journal').insert([{ ...form, housemaster_name: currentHousemaster?.name || 'Unknown' }])
    if (error) showToast('Error: ' + error.message, '#dc2626')
    else { setForm({ ...emptyJournalForm, entry_date: today(), entry_time: nowTime() }); setShowForm(false); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!isAdmin) { showToast('Only admins can delete journal entries.', '#dc2626'); return }
    if (!window.confirm('Delete this journal entry?')) return
    await supabase.from('housemaster_journal').delete().eq('id', id)
    load()
  }

  const filtered = useMemo(() => {
    let f = entries
    if (date) f = f.filter(e => e.entry_date === date)
    if (search) { const q = search.toLowerCase(); f = f.filter(e => (e.title || '').toLowerCase().includes(q) || (e.content || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q)) }
    return f
  }, [entries, date, search])

  const categoryColors = { General: '#1e3a5f', Assembly: '#16a34a', Discipline: '#dc2626', Medical: '#7c3aed', Maintenance: '#ca8a04', 'Parent Call': '#1d4ed8', 'Staff Handover': '#0891b2', Inspection: '#374151', Event: '#059669' }

  if (mobile) {
    return (
      <div>
        {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, flex: 1 }} />
          <button onClick={() => setShowForm(!showForm)} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '📝'}</button>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <ReportExportButtons
            title="Housemaster Journal"
            subtitle={`${date} · ${filtered.length} of ${entries.length} entries`}
            columns={[
              { key: 'entry_date', label: 'Date', width: 1 },
              { key: 'entry_time', label: 'Time', width: 0.7 },
              { key: 'category', label: 'Category', width: 1 },
              { key: 'house', label: 'House', width: 1 },
              { key: 'title', label: 'Title', width: 1.6 },
              { key: 'content', label: 'Content', width: 2.4 },
              { key: 'housemaster_name', label: 'Logged By', width: 1.2 },
            ]}
            rows={filtered}
            allRows={entries}
          />
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required style={{ ...inp, flex: 1 }} />
                  <input type="time" value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} style={{ ...inp, flex: 1 }} />
                </div>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{JOURNAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title..." required style={inp} />
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} placeholder="Write your notes here..." required style={{ ...inp, resize: 'vertical' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151' }}><input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} style={{ width: '20px', height: '20px' }} />🚩 Flag as important</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>{saving ? '⏳' : '✓ Save'}</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(e => (
            <MobileRecordCard key={e.id} accentColor={categoryColors[e.category] || '#1e3a5f'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>{e.category}</span>
                  {e.flagged && <span style={{ fontSize: '16px' }}>🚩</span>}
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{e.entry_time}</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>{e.title}</div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.content}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📝 {e.housemaster_name}</span>
                {isAdmin && <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>🗑 Delete</button>}
              </div>
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>No journal entries for {date}</div>}
      </div>
    )
  }

  return (
    <div>
      {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <input placeholder="🔍 Search entries..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
        </div>
        <ReportExportButtons
          title="Housemaster Journal"
          subtitle={`${date} · ${filtered.length} of ${entries.length} entries`}
          columns={[
            { key: 'entry_date', label: 'Date', width: 1 },
            { key: 'entry_time', label: 'Time', width: 0.7 },
            { key: 'category', label: 'Category', width: 1 },
            { key: 'house', label: 'House', width: 1 },
            { key: 'title', label: 'Title', width: 1.6 },
            { key: 'content', label: 'Content', width: 2.4 },
            { key: 'housemaster_name', label: 'Logged By', width: 1.2 },
          ]}
          rows={filtered}
          allRows={entries}
        />
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '📝 New Entry'}</button>
      </div>
      {showForm && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>📝 New Journal Entry</h3>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div><label style={lbl}>Date *</label><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Time</label><input type="time" value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>{JOURNAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>House (if specific)</label><input value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} placeholder="Leave blank for general" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Short summary..." style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Content *</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={5} placeholder="Detailed notes..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}><input type="checkbox" checked={form.flagged} onChange={e => setForm(f => ({ ...f, flagged: e.target.checked }))} />🚩 Flag as important</label></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Entry'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filtered.map(e => (
          <div key={e.id} style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${categoryColors[e.category] || '#1e3a5f'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '99px', background: (categoryColors[e.category] || '#1e3a5f') + '15', color: categoryColors[e.category] || '#1e3a5f' }}>{e.category}</span>
                {e.flagged && <span style={{ fontSize: '16px' }}>🚩</span>}
                <span style={{ fontSize: '13px', color: '#64748b' }}>{e.entry_date} · {e.entry_time}</span>
              </div>
              {isAdmin && <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>🗑 Delete</button>}
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px' }}>{e.title}</h4>
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{e.content}</p>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>📝 {e.housemaster_name} {e.house && `· 🏠 ${e.house}`}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}><div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div><div style={{ fontSize: '16px', fontWeight: '600' }}>No journal entries found</div></div>}
      </div>
    </div>
  )
}
//  TAB 1 — Day Scholar Student Records
// ══════════════════════════════════════════════════════════════
const emptyDayScholar = {
  student_id: null, gcc_no: '', student_name: '', class_name: '',
  parent_name: '', parent_phone: '', address: '',
  transport_route: '', vehicle_number: '',
  pickup_point: '', drop_point: '',
  admission_date: today(), status: 'Active',
  remarks: '',
}

function DayScholarTab({ students, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [routeFilter, setRouteFilter] = useState('All')
  const [form, setForm] = useState(emptyDayScholar)
  const mobile = useMobileView()
  const [toast, setToast] = useState(null)
  const showToast = (msg, color = '#16a34a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('day_scholar_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({
      ...f,
      student_id: s.id,
      gcc_no: s.gcc_no || '',
      student_name: s.name || '',
      class_name: getStudentClass(s),
    }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      student_id: form.student_id || null,
      gcc_no: form.gcc_no || null,
      student_name: form.student_name,
      class_name: form.class_name,
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      address: form.address,
      transport_route: form.transport_route,
      vehicle_number: form.vehicle_number,
      pickup_point: form.pickup_point,
      drop_point: form.drop_point,
      admission_date: form.admission_date,
      status: form.status,
      remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('day_scholar_records').update(payload).eq('id', editRec.id)
      : await supabase.from('day_scholar_records').insert([payload])
    if (error) showToast('Error: ' + error.message, '#dc2626')
    else { setForm(emptyDayScholar); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!isAdmin) { showToast('Only admins can delete day scholar records', '#dc2626'); return }
    if (!window.confirm('Delete this day scholar record?')) return
    await supabase.from('day_scholar_records').delete().eq('id', id)
    load()
  }

  const openEdit = rec => {
    setEditRec(rec)
    setForm({ ...emptyDayScholar, ...rec })
    setShowForm(true)
  }

  const uniqueRoutes = [...new Set(records.map(r => r.transport_route).filter(Boolean))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r =>
      (statusFilter === 'All' || r.status === statusFilter) &&
      (routeFilter === 'All' || r.transport_route === routeFilter) &&
      [r.student_name, r.class_name, r.gcc_no, r.parent_name, r.parent_phone, r.transport_route, r.pickup_point, r.address]
        .some(v => (v || '').toLowerCase().includes(q))
    )
  }, [records, search, statusFilter, routeFilter])

  const active = records.filter(r => r.status === 'Active').length
  const inactive = records.filter(r => r.status === 'Inactive').length
  const withTransport = records.filter(r => r.transport_route).length

  // ── Supabase migration helper (run once)
  const createTableSQL = `
create table if not exists day_scholar_records (
  id uuid primary key default gen_random_uuid(),
  student_id bigint references students(id),
  gcc_no text,
  student_name text not null,
  class_name text,
  parent_name text,
  parent_phone text,
  address text,
  transport_route text,
  vehicle_number text,
  pickup_point text,
  drop_point text,
  admission_date date,
  status text default 'Active',
  remarks text,
  created_at timestamptz default now()
);`

  if (mobile) {
    return (
      <div>
        {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
        <div style={mobileStatGrid}>
          <StatCard icon="📋" label="Total" value={records.length} color="#1e3a5f" bg="#eff6ff" compact />
          <StatCard icon="✅" label="Active" value={active} color="#16a34a" bg="#dcfce7" compact />
          <StatCard icon="🚌" label="With Transport" value={withTransport} color="#7c3aed" bg="#f5f3ff" compact />
          <StatCard icon="⏸" label="Inactive" value={inactive} color="#dc2626" bg="#fee2e2" compact />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input placeholder="🔍 Search name, route..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} type="search" />
          <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDayScholar) }} style={{ ...btn(), padding: '10px 14px' }}>{showForm ? '✕' : '➕'}</button>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <ReportExportButtons
            title="Day Scholar Records"
            subtitle={`${filtered.length} of ${records.length} records`}
            columns={[
              { key: 'gcc_no', label: 'GCC', width: 0.8 },
              { key: 'student_name', label: 'Student', width: 1.4 },
              { key: 'class_name', label: 'Class', width: 1 },
              { key: 'parent_name', label: 'Parent', width: 1.2 },
              { key: 'parent_phone', label: 'Phone', width: 1 },
              { key: 'transport_route', label: 'Route', width: 1 },
              { key: 'pickup_point', label: 'Pickup', width: 1 },
              { key: 'status', label: 'Status', width: 0.8 },
            ]}
            rows={filtered}
            allRows={records}
          />
        </div>
        {showForm && (
          <div style={{ ...mobileCard, marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 12px' }}>{editRec ? '✏️ Edit Record' : '➕ New Day Scholar'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={lbl}>Search Student</label>
                  <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                  {form.student_id && <div style={{ marginTop: 6, padding: '6px 10px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ {form.student_name}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} placeholder="Student Name *" required style={{ ...inp, flex: 1 }} />
                  <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="Class/Batch" style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Parent Name" style={{ ...inp, flex: 1 }} />
                  <input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="Phone" style={{ ...inp, flex: 1 }} />
                </div>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Home Address" style={inp} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.transport_route} onChange={e => setForm(f => ({ ...f, transport_route: e.target.value }))} placeholder="Route" style={{ ...inp, flex: 1 }} />
                  <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="Vehicle No." style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.pickup_point} onChange={e => setForm(f => ({ ...f, pickup_point: e.target.value }))} placeholder="Pickup Point" style={{ ...inp, flex: 1 }} />
                  <input value={form.drop_point} onChange={e => setForm(f => ({ ...f, drop_point: e.target.value }))} placeholder="Drop Point" style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={form.admission_date} onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))} style={{ ...inp, flex: 1 }} />
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Remarks..." rows={2} style={{ ...inp, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={saving} style={{ ...btn(saving ? '#94a3b8' : '#1e3a5f'), flex: 1 }}>{saving ? '⏳' : '✓ Save'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}
        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor={r.status === 'Active' ? '#16a34a' : '#94a3b8'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{r.student_name}</div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                {r.gcc_no ? `GCC-${r.gcc_no}` : '—'} · {r.class_name || '—'}
              </div>
              {r.parent_name && <div style={{ fontSize: '12px', color: '#374151' }}>👨‍👩‍👦 {r.parent_name} {r.parent_phone ? `· 📞 ${r.parent_phone}` : ''}</div>}
              {r.transport_route && <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px' }}>🚌 {r.transport_route} {r.pickup_point ? `· 📍 ${r.pickup_point}` : ''}</div>}
              <MobileActionButtons actions={[
                { label: '✏️ Edit', onClick: () => openEdit(r), bg: '#eff6ff', color: '#1e3a5f' },
                ...(isAdmin ? [{ label: '🗑 Delete', onClick: () => handleDelete(r.id), bg: '#fee2e2', color: '#dc2626' }] : []),
              ]} />
            </MobileRecordCard>
          ))}
        </MobileCardList>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No day scholar records found</div>}
      </div>
    )
  }

  return (
    <div>
      {toast && <div style={{ position:'sticky', top:0, zIndex:99, background:'#fff', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:12, color:'#1e293b' }}>{toast.msg}</div>}
      <div style={statGrid()}>
        <StatCard icon="📋" label="Total Day Scholars" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="✅" label="Active" value={active} color="#16a34a" bg="#dcfce7" />
        <StatCard icon="🚌" label="With Transport" value={withTransport} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon="⏸" label="Inactive" value={inactive} color="#dc2626" bg="#fee2e2" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, route, parent..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 180 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            <option>Active</option><option>Inactive</option>
          </select>
          <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Routes</option>
            {uniqueRoutes.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <ReportExportButtons
          title="Day Scholar Records"
          subtitle={`${filtered.length} of ${records.length} records${statusFilter !== 'All' ? ` · Status: ${statusFilter}` : ''}${routeFilter !== 'All' ? ` · Route: ${routeFilter}` : ''}`}
          columns={[
            { key: 'gcc_no', label: 'GCC', width: 0.8 },
            { key: 'student_name', label: 'Student', width: 1.4 },
            { key: 'class_name', label: 'Class', width: 1 },
            { key: 'parent_name', label: 'Parent', width: 1.2 },
            { key: 'parent_phone', label: 'Phone', width: 1 },
            { key: 'transport_route', label: 'Route', width: 1 },
            { key: 'pickup_point', label: 'Pickup', width: 1 },
            { key: 'status', label: 'Status', width: 0.8 },
          ]}
          rows={filtered}
          allRows={records}
        />
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDayScholar) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Day Scholar'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '4px' }}>
            {editRec ? '✏️ Edit Day Scholar Record' : '➕ New Day Scholar Record'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>🔗 Link to a student from the Students module or enter manually</p>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Link Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class</label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Admission Date</label><input type="date" value={form.admission_date} onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))} style={inp} /></div>

              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>👨‍👩‍👦 Parent / Guardian Details</div>
              </div>
              <div><label style={lbl}>Parent Name</label><input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Father/Mother/Guardian" style={inp} /></div>
              <div><label style={lbl}>Parent Phone</label><input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="10-digit mobile" style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Home Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>

              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>🚌 Transport Details</div>
              </div>
              <div><label style={lbl}>Route</label><input value={form.transport_route} onChange={e => setForm(f => ({ ...f, transport_route: e.target.value }))} placeholder="Route 1 / Khangabok" style={inp} /></div>
              <div><label style={lbl}>Vehicle Number</label><input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="MN01 AB 1234" style={inp} /></div>
              <div><label style={lbl}>Pickup Point</label><input value={form.pickup_point} onChange={e => setForm(f => ({ ...f, pickup_point: e.target.value }))} placeholder="e.g. Market Junction" style={inp} /></div>
              <div><label style={lbl}>Drop Point</label><input value={form.drop_point} onChange={e => setForm(f => ({ ...f, drop_point: e.target.value }))} placeholder="e.g. Gate No. 2" style={inp} /></div>

              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}><option>Active</option><option>Inactive</option></select></div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save Record'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'GCC', 'Student', 'Class', 'Parent', 'Phone', 'Route', 'Pickup', 'Vehicle', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#374151' }}>{r.parent_name || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r.parent_phone || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.transport_route
                        ? <span style={{ padding: '2px 8px', borderRadius: 99, background: '#f5f3ff', color: '#7c3aed', fontSize: 11, fontWeight: 700 }}>🚌 {r.transport_route}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{r.pickup_point || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{r.vehicle_number || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No day scholar records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }

      {/* SQL hint for first setup */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>🛠 First time? Show Supabase table SQL</summary>
        <pre style={{ marginTop: 8, background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: 10, fontSize: 11, overflow: 'auto' }}>{createTableSQL}</pre>
      </details>
    </div>
  )
}

const ACTIVITY_CATEGORIES = ['Routine', 'Physical', 'Assembly', 'Meals', 'Academic', 'Special', 'Other']

const CATEGORY_STYLE = {
  Routine: { color: '#0891b2', bg: '#e0f2fe' },
  Physical: { color: '#16a34a', bg: '#dcfce7' },
  Assembly: { color: '#7c3aed', bg: '#f5f3ff' },
  Meals: { color: '#ca8a04', bg: '#fef9c3' },
  Academic: { color: '#1d4ed8', bg: '#dbeafe' },
  Special: { color: '#be185d', bg: '#fce7f3' },
  Other: { color: '#374151', bg: '#f1f5f9' },
}

const CHECK_KEY = () => 'gnsi_sched_check_' + today()
function loadChecks() {
  try { return JSON.parse(localStorage.getItem(CHECK_KEY()) || '{}') } catch { return {} }
}
function saveChecks(obj) {
  try { localStorage.setItem(CHECK_KEY(), JSON.stringify(obj)) } catch { }
}

function ScheduleTab({ currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const TYPE_TABS = [
    { id: 'weekday', label: '📅 Mon–Sat' },
    { id: 'sunday',  label: '🌿 Sunday' },
    { id: 'holiday', label: '🎉 Holiday' },
  ]

  const [type,      setType]      = useState('weekday')
  const [schedule,  setSchedule]  = useState({ weekday: [], sunday: [], holiday: [] })
  const [checked,   setChecked]   = useState(loadChecks)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [addForm,   setAddForm]   = useState(false)
  const [editRow,   setEditRow]   = useState(null)
  const [catFilter, setCatFilter] = useState('All')
  const [newRow,    setNewRow]    = useState({ from_time: '', to_time: '', activity: '', category: 'Routine' })
  const mobile = useMobileView()

  useEffect(() => { if (!isAdmin && adminMode) setAdminMode(false) }, [isAdmin, adminMode])

  const todayDayType = (() => {
    const day = new Date().getDay()
    if (day === 0) return 'sunday'
    return 'weekday'
  })()

  // ── Load from Supabase
  const loadSchedule = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hostel_schedules')
      .select('*')
      .order('schedule_type')
      .order('no')
    if (error) { console.error(error); setLoading(false); return }
    const grouped = { weekday: [], sunday: [], holiday: [] }
    ;(data || []).forEach(r => {
      if (grouped[r.schedule_type]) grouped[r.schedule_type].push(r)
    })
    setSchedule(grouped)
    setLoading(false)
  }

  useEffect(() => { loadSchedule() }, [])

  const rows    = schedule[type] || []
  const visible = catFilter === 'All' ? rows : rows.filter(r => r.category === catFilter)
  const done    = rows.filter(r => checked[`${type}_${r.no}`]).length
  const pct     = rows.length ? Math.round(done / rows.length * 100) : 0

  const toggle = no => {
    const k    = `${type}_${no}`
    const next = { ...checked, [k]: !checked[k] }
    setChecked(next); saveChecks(next)
  }

  const handleAdd = async () => {
    if (!isAdmin) { alert('Only admins can add schedule activities.'); return }
    if (!newRow.from_time || !newRow.activity) { alert('From time and activity name are required'); return }
    setSaving(true)
    const maxNo = rows.length ? Math.max(...rows.map(r => r.no)) : 0
    const { error } = await supabase.from('hostel_schedules').insert([{
      schedule_type: type,
      no: maxNo + 1,
      from_time: newRow.from_time,
      to_time: newRow.to_time || null,
      activity: newRow.activity,
      category: newRow.category,
    }])
    if (error) alert('Error: ' + error.message)
    else { setNewRow({ from_time: '', to_time: '', activity: '', category: 'Routine' }); setAddForm(false); loadSchedule() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { alert('Only admins can remove schedule activities.'); return }
    if (!window.confirm('Remove this activity?')) return
    setSaving(true)
    await supabase.from('hostel_schedules').delete().eq('id', id)
    loadSchedule()
    setSaving(false)
  }

  const handleSaveEdit = async (id) => {
    if (!isAdmin) { alert('Only admins can edit schedule activities.'); return }
    const fromEl = document.getElementById(`se-from-${id}`)
    const toEl   = document.getElementById(`se-to-${id}`)
    const actEl  = document.getElementById(`se-act-${id}`)
    const catEl  = document.getElementById(`se-cat-${id}`)
    setSaving(true)
    await supabase.from('hostel_schedules').update({
      from_time: fromEl?.value,
      to_time:   toEl?.value || null,
      activity:  actEl?.value,
      category:  catEl?.value,
    }).eq('id', id)
    setEditRow(null)
    loadSchedule()
    setSaving(false)
  }

  const catStyle = cat => CATEGORY_STYLE[cat] || CATEGORY_STYLE['Other']

  const actIcon = a => {
    if (a.includes('PT') || a.includes('Exercise') || a.includes('Sports') || a.includes('Recreation')) return '⚽'
    if (a.includes('Doubt') || a.includes('Assignment') || a.includes('Study') || a.includes('Studies')) return '📖'
    if (a.includes('Lunch') || a.includes('Dinner') || a.includes('Breakfast')) return '🍽️'
    if (a.includes('Class') || a.includes('Academic')) return '🏫'
    if (a.includes('Tea')) return '☕'
    if (a.includes('Wake') || a.includes('Bell')) return '🔔'
    if (a.includes('Assembly') || a.includes('Roll')) return '🎌'
    if (a.includes('Lights') || a.includes('Off')) return '💡'
    if (a.includes('Bath') || a.includes('Fresh') || a.includes('Dress') || a.includes('Routine')) return '🚿'
    if (a.includes('Rest')) return '😴'
    if (a.includes('Holiday') || a.includes('Excursion')) return '🎉'
    return '•'
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Loading schedule...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>🏠 Hostel Daily Activities</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
            Today is a <strong style={{ color: todayDayType === 'sunday' ? '#16a34a' : '#1d4ed8' }}>
              {todayDayType === 'sunday' ? 'Sunday / Rest Day' : 'Weekday'}
            </strong> · {rows.length} activities
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ReportExportButtons
            title="Hostel Daily Schedule"
            subtitle={`${type === 'weekday' ? 'Mon–Sat' : type === 'sunday' ? 'Sunday' : 'Holiday'} schedule · ${done}/${rows.length} completed today${catFilter !== 'All' ? ` · Category: ${catFilter}` : ''}`}
            columns={[
              { key: 'no', label: '#', width: 0.4 },
              { key: 'from_time', label: 'From', width: 0.8 },
              { key: 'to_time', label: 'To', width: 0.8 },
              { key: 'activity', label: 'Activity', width: 2 },
              { key: 'category', label: 'Category', width: 1 },
              { key: 'done', label: 'Done Today', width: 0.8, value: r => (checked[`${type}_${r.no}`] ? 'Yes' : 'No') },
            ]}
            rows={visible}
            allRows={rows}
          />
          {isAdmin && (
            <button onClick={() => setAdminMode(m => !m)} style={{ ...btn(adminMode ? '#dc2626' : '#f1f5f9', adminMode ? 'white' : '#374151'), fontSize: '12px', padding: '8px 14px' }}>
              {adminMode ? '🔓 Admin Mode ON' : '🔒 Admin Mode'}
            </button>
          )}
        </div>
      </div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '6px', borderRadius: '12px' }}>
        {TYPE_TABS.map(t => (
          <button key={t.id} onClick={() => { setType(t.id); setCatFilter('All') }} style={{
            flex: 1, padding: '9px 10px', border: 'none', borderRadius: '8px',
            background: type === t.id ? '#1e3a5f' : 'transparent',
            color: type === t.id ? 'white' : '#64748b',
            cursor: 'pointer', fontSize: '13px', fontWeight: type === t.id ? 700 : 500,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: '#1e3a5f', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', opacity: 0.8 }}>TODAY'S ACTIVITY PROGRESS</div>
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: pct === 100 ? '#4ade80' : '#60a5fa' }}>{pct}%</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>{done} / {rows.length} done</div>
          </div>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ade80' : pct > 60 ? '#60a5fa' : '#fbbf24', borderRadius: '99px', transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
          {ACTIVITY_CATEGORIES.map(cat => {
            const catRows = rows.filter(r => r.category === cat)
            if (catRows.length === 0) return null
            const catDone = catRows.filter(r => checked[`${type}_${r.no}`]).length
            const cs = catStyle(cat)
            return (
              <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'All' : cat)} style={{
                padding: '3px 10px', borderRadius: '99px', border: 'none',
                background: catFilter === cat ? 'white' : 'rgba(255,255,255,0.15)',
                color: catFilter === cat ? cs.color : 'rgba(255,255,255,0.8)',
                fontSize: '11px', fontWeight: '700', cursor: 'pointer',
              }}>
                {cat} {catDone}/{catRows.length}
              </button>
            )
          })}
        </div>
      </div>

      {/* Admin controls */}
      {adminMode && (
        <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '14px', marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', flex: 1 }}>
            🔧 Admin Mode — Edit, add, or delete activities for {type} schedule
          </div>
          <button onClick={() => setAddForm(f => !f)} style={{ ...btn(), fontSize: '12px', padding: '7px 14px' }}>
            {addForm ? '✕ Cancel' : '➕ Add Activity'}
          </button>
        </div>
      )}

      {/* Add form */}
      {adminMode && addForm && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <div><label style={lbl}>From *</label><input value={newRow.from_time} onChange={e => setNewRow(n => ({ ...n, from_time: e.target.value }))} placeholder="6:00 AM" style={inp} /></div>
          <div><label style={lbl}>To</label><input value={newRow.to_time} onChange={e => setNewRow(n => ({ ...n, to_time: e.target.value }))} placeholder="7:00 AM" style={inp} /></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Activity Name *</label><input value={newRow.activity} onChange={e => setNewRow(n => ({ ...n, activity: e.target.value }))} placeholder="e.g. Assembly" style={inp} /></div>
          <div><label style={lbl}>Category</label>
            <select value={newRow.category} onChange={e => setNewRow(n => ({ ...n, category: e.target.value }))} style={inp}>
              {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <button onClick={handleAdd} disabled={saving} style={btn('#16a34a')}>✓ Add</button>
            <button onClick={() => setAddForm(false)} style={btn('#f1f5f9', '#374151')}>✕</button>
          </div>
        </div>
      )}

      {/* Table */}
      {mobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(r => {
            const isDone = !!checked[`${type}_${r.no}`]
            const cs = catStyle(r.category || 'Other')
            const isEdit = adminMode && editRow === r.id
            if (isEdit) return (
              <div key={r.id} style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px', border: '2px solid #60a5fa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input id={`se-from-${r.id}`} defaultValue={r.from_time} placeholder="From" style={{ ...inp, fontSize: '13px' }} />
                  <input id={`se-to-${r.id}`} defaultValue={r.to_time} placeholder="To" style={{ ...inp, fontSize: '13px' }} />
                  <input id={`se-act-${r.id}`} defaultValue={r.activity} placeholder="Activity" style={{ ...inp, fontSize: '13px', gridColumn: '1/-1' }} />
                  <select id={`se-cat-${r.id}`} defaultValue={r.category || 'Routine'} style={{ ...inp, fontSize: '13px', gridColumn: '1/-1' }}>
                    {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleSaveEdit(r.id)} style={{ ...btn('#16a34a'), flex: 1, fontSize: '12px' }}>✓ Save</button>
                  <button onClick={() => setEditRow(null)} style={{ ...btn('#f1f5f9', '#374151'), flex: 1, fontSize: '12px' }}>Cancel</button>
                </div>
              </div>
            )
            return (
              <div key={r.id} style={{ background: isDone ? '#f0fdf4' : 'white', borderRadius: '12px', padding: '13px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', borderLeft: `4px solid ${isDone ? '#16a34a' : cs.color}`, display: 'flex', alignItems: 'center', gap: '12px', opacity: isDone ? 0.75 : 1 }}>
                <div style={{ fontSize: '20px' }}>{actIcon(r.activity)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>{r.activity}</span>
                    <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '99px', background: cs.bg, color: cs.color, fontWeight: '700' }}>{r.category}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{r.from_time}{r.to_time ? ` → ${r.to_time}` : ''}</div>
                </div>
                {adminMode && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setEditRow(r.id)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#1e3a5f', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => handleDelete(r.id)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                )}
                <button onClick={() => toggle(r.no)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: isDone ? '2px solid #16a34a' : '2px dashed #d1d5db', background: isDone ? '#16a34a' : 'transparent', color: isDone ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{isDone ? '✓' : ''}</button>
              </div>
            )
          })}
          {visible.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No activities. Click Admin Mode → ➕ Add Activity.</div>}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'From', 'To', 'Activity', 'Category', adminMode ? 'Actions' : '', '✓ Done'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const isDone = !!checked[`${type}_${r.no}`]
                const cs = catStyle(r.category || 'Other')
                const isEdit = adminMode && editRow === r.id
                if (isEdit) return (
                  <tr key={r.id} style={{ background: '#eff6ff' }}>
                    <td style={{ padding: '8px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-from-${r.id}`} defaultValue={r.from_time} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-to-${r.id}`} defaultValue={r.to_time} style={{ ...inp, width: 90, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}><input id={`se-act-${r.id}`} defaultValue={r.activity} style={{ ...inp, padding: '5px 8px', fontSize: 12 }} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      <select id={`se-cat-${r.id}`} defaultValue={r.category || 'Routine'} style={{ ...inp, padding: '5px 8px', fontSize: 12 }}>
                        {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleSaveEdit(r.id)} style={{ ...btn('#16a34a'), fontSize: 11, padding: '4px 10px' }}>✓ Save</button>
                        <button onClick={() => setEditRow(null)} style={{ ...btn('#f1f5f9', '#374151'), fontSize: 11, padding: '4px 10px' }}>Cancel</button>
                      </div>
                    </td>
                    <td />
                  </tr>
                )
                return (
                  <tr key={r.id} style={{ background: isDone ? '#f0fdf4' : 'white', borderBottom: '1px solid #f1f5f9', opacity: isDone ? 0.75 : 1 }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{r.no}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{r.from_time}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{r.to_time || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 15, marginRight: 8 }}>{actIcon(r.activity)}</span>
                      <span style={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#1e293b' }}>{r.activity}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.color }}>{r.category || 'Other'}</span>
                    </td>
                    {adminMode ? (
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditRow(r.id)} style={{ background: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✏ Edit</button>
                          <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✕ Del</button>
                        </div>
                      </td>
                    ) : <td />}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button onClick={() => toggle(r.no)} style={{ width: 32, height: 32, borderRadius: '50%', border: isDone ? '2px solid #16a34a' : '2px dashed #d1d5db', background: isDone ? '#16a34a' : 'transparent', color: isDone ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>{isDone ? '✓' : ''}</button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No activities. Click Admin Mode → ➕ Add Activity.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  TAB 3 — Mess Duty Tracker
// ══════════════════════════════════════════════════════════════
const MESS_SHIFTS = ['Breakfast', 'Lunch', 'Tea', 'Dinner', 'Full Day']
const MESS_ROLES = ['Mess In-Charge', 'Server', 'Cleaner', 'Cook Assistant', 'Supervisor']
const MESS_STATUSES = ['Assigned', 'On Duty', 'Completed', 'Absent']

const emptyMD = {
  date: today(), shift: 'Full Day', house: '',
  staff1_id: null, staff1: '', staff1_role: 'Mess In-Charge',
  staff2_id: null, staff2: '', staff2_role: 'Server',
  staff3_id: null, staff3: '', staff3_role: 'Cleaner',
  status: 'Assigned', notes: '',
}

const SHIFT_STYLE = {
  'Breakfast': { color: '#ca8a04', bg: '#fef9c3', icon: '🌅' },
  'Lunch': { color: '#16a34a', bg: '#dcfce7', icon: '☀️' },
  'Tea': { color: '#0891b2', bg: '#e0f2fe', icon: '☕' },
  'Dinner': { color: '#7c3aed', bg: '#f5f3ff', icon: '🌙' },
  'Full Day': { color: '#1e3a5f', bg: '#eff6ff', icon: '📋' },
}

function NightDutyTab({ staffProfiles, autoOpenForm, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [form, setForm] = useState(emptyMD)

  useEffect(() => {
    if (autoOpenForm) {
      setEditRec(null)
      setForm({ ...emptyMD, date: today(), house: autoOpenForm.house || '' })
      setShowForm(true)
    }
  }, [autoOpenForm?.nonce])
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [shiftFilter, setShiftFilter] = useState('All')
  const mobile = useMobileView()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('mess_duty').select('*').order('date', { ascending: false }).order('shift')
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault()
    if (!isAdmin) { alert('Only admins can assign mess/night duty.'); return }
    setSaving(true)
    const payload = {
      date: form.date, shift: form.shift, status: form.status, notes: form.notes, house: form.house || null,
      staff1_id: form.staff1_id || null, staff1: form.staff1, staff1_role: form.staff1_role,
      staff2_id: form.staff2_id || null, staff2: form.staff2 || null, staff2_role: form.staff2 ? form.staff2_role : null,
      staff3_id: form.staff3_id || null, staff3: form.staff3 || null, staff3_role: form.staff3 ? form.staff3_role : null,
    }
    const { error } = editRec
      ? await supabase.from('mess_duty').update(payload).eq('id', editRec.id)
      : await supabase.from('mess_duty').insert([payload])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyMD); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('mess_duty').update({ status }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can delete mess duty records.'); return }
    if (!window.confirm('Delete this mess duty record?')) return
    await supabase.from('mess_duty').delete().eq('id', id); load()
  }

  const openEdit = r => {
    setEditRec(r)
    setForm({ ...emptyMD, ...r, staff2: r.staff2 || '', staff3: r.staff3 || '' })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Enrich staff names from profiles
  const enriched = useMemo(() => records.map(r => {
    const s1 = r.staff1_id ? staffProfiles.find(s => s.id === r.staff1_id) : null
    const s2 = r.staff2_id ? staffProfiles.find(s => s.id === r.staff2_id) : null
    const s3 = r.staff3_id ? staffProfiles.find(s => s.id === r.staff3_id) : null
    return {
      ...r,
      staff1: s1?.name || r.staff1,
      staff2: s2?.name || r.staff2,
      staff3: s3?.name || r.staff3,
      staff1_desig: s1?.designation || s1?.department || '',
      staff2_desig: s2?.designation || s2?.department || '',
      staff3_desig: s3?.designation || s3?.department || '',
    }
  }), [records, staffProfiles])

  const monthRoster = useMemo(() => enriched.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d.getMonth() === month && d.getFullYear() === year &&
      (shiftFilter === 'All' || r.shift === shiftFilter)
  }), [enriched, month, year, shiftFilter])

  // Today's duties
  const todayDuties = enriched.filter(r => r.date === today())

  // Uncovered days (only for Full Day shift check)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const coveredDates = new Set(enriched.filter(r => r.date && new Date(r.date).getMonth() === month && new Date(r.date).getFullYear() === year).map(r => r.date))
  const uncovered = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1)
    const key = d.toISOString().split('T')[0]
    return coveredDates.has(key) ? null : key
  }).filter(Boolean)

  // Stats
  const stats = {
    total: monthRoster.length,
    assigned: monthRoster.filter(r => r.status === 'Assigned').length,
    onDuty: monthRoster.filter(r => r.status === 'On Duty').length,
    completed: monthRoster.filter(r => r.status === 'Completed').length,
    absent: monthRoster.filter(r => r.status === 'Absent').length,
  }

  // ── Staff search clear helper
  const clearStaff = (slot) => setForm(f => ({ ...f, [`staff${slot}_id`]: null, [`staff${slot}`]: '', [`staff${slot}_role`]: slot === 1 ? 'Mess In-Charge' : slot === 2 ? 'Server' : 'Cleaner' }))

  const StaffSlot = ({ slot, label, required = false }) => (
    <div>
      <label style={lbl}>{label}{required ? ' *' : ' '}<span style={{ color: '#94a3b8', fontWeight: 400 }}>(search staff)</span></label>
      <StaffSearchInput
        staff={staffProfiles}
        onSelect={s => setForm(f => ({ ...f, [`staff${slot}_id`]: s.id, [`staff${slot}`]: s.name }))}
        placeholder={`Search ${label.toLowerCase()}...`}
      />
      {form[`staff${slot}`] && (
        <div style={{ marginTop: 6, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: '#1e3a5f', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✅ {form[`staff${slot}`]}</span>
          <button type="button" onClick={() => clearStaff(slot)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕ Clear</button>
        </div>
      )}
      {form[`staff${slot}`] && (
        <select value={form[`staff${slot}_role`]} onChange={e => setForm(f => ({ ...f, [`staff${slot}_role`]: e.target.value }))} style={{ ...inp, marginTop: 6, fontSize: 12, padding: '6px 10px' }}>
          {MESS_ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      )}
    </div>
  )

  return (
    <div>
      {/* ── Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, background: 'white', padding: '14px 20px',
        borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>{MONTHS[month]} {year}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {monthRoster.length} duties assigned ·{' '}
            {uncovered.length > 0
              ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{uncovered.length} days uncovered</span>
              : <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ all days covered</span>
            }
          </div>
        </div>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ ...btn('#f1f5f9', '#374151'), padding: '6px 14px', fontSize: 16 }}>›</button>
      </div>

      {/* ── Today's duties banner */}
      {todayDuties.length > 0 && (
        <div style={{
          background: '#1e3a5f', borderRadius: 12, padding: '14px 18px',
          marginBottom: 16, color: 'white',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            🍽️ Today's Mess Duties — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {todayDuties.map(d => {
              const ss = SHIFT_STYLE[d.shift] || SHIFT_STYLE['Full Day']
              return (
                <div key={d.id} style={{
                  background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                  padding: '10px 14px', minWidth: 160, flex: '1 1 160px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    {ss.icon} {d.shift}
                    <span style={{
                      marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: d.status === 'Completed' ? '#dcfce7' : d.status === 'Absent' ? '#fee2e2' : 'rgba(255,255,255,0.2)',
                      color: d.status === 'Completed' ? '#16a34a' : d.status === 'Absent' ? '#dc2626' : 'white',
                      fontWeight: 700,
                    }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[
                      d.staff1 && `${d.staff1} (${d.staff1_role})`,
                      d.staff2 && `${d.staff2} (${d.staff2_role})`,
                      d.staff3 && `${d.staff3} (${d.staff3_role})`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Stats */}
      <div style={mobile ? mobileStatGrid : statGrid(130)}>
        <StatCard icon="📋" label="Total" value={stats.total} color="#1e3a5f" bg="#eff6ff" compact={mobile} />
        <StatCard icon="✅" label="Completed" value={stats.completed} color="#16a34a" bg="#dcfce7" compact={mobile} />
        <StatCard icon="🟡" label="On Duty" value={stats.onDuty} color="#ca8a04" bg="#fef9c3" compact={mobile} />
        <StatCard icon="❌" label="Absent" value={stats.absent} color="#dc2626" bg="#fee2e2" compact={mobile} />
      </div>

      {/* ── Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', ...MESS_SHIFTS].map(s => (
            <button key={s} onClick={() => setShiftFilter(s)} style={{
              padding: '6px 12px', borderRadius: 99, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: shiftFilter === s ? '#1e3a5f' : '#f1f5f9',
              color: shiftFilter === s ? 'white' : '#64748b',
            }}>{s === 'All' ? '📋 All' : `${SHIFT_STYLE[s]?.icon || ''} ${s}`}</button>
          ))}
        </div>
        <ReportExportButtons
          title="Mess Duty Roster"
          subtitle={`${MONTHS[month]} ${year} · ${monthRoster.length} of ${enriched.length} duties${shiftFilter !== 'All' ? ` · Shift: ${shiftFilter}` : ''}`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'shift', label: 'Shift', width: 1 },
            { key: 'staff1', label: 'Staff 1', width: 1.4 },
            { key: 'staff2', label: 'Staff 2', width: 1.4 },
            { key: 'staff3', label: 'Staff 3', width: 1.4 },
            { key: 'status', label: 'Status', width: 1 },
            { key: 'notes', label: 'Notes', width: 1.6 },
          ]}
          rows={monthRoster}
          allRows={enriched}
        />
        {isAdmin && (
          <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyMD) }} style={btn()}>
            {showForm ? '✖ Cancel' : '➕ Assign Duty'}
          </button>
        )}
      </div>

      {/* ── Form */}
      {showForm && isAdmin && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>
            {editRec ? '✏️ Edit Mess Duty' : '➕ Assign Mess Duty'}
          </h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Staff pulled live from Staff Profiles · Up to 3 staff per duty slot</p>
          <form onSubmit={handleSave}>
            <div style={grid2}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Shift *</label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inp}>
                  {MESS_SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>House</label>
                <input value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} placeholder="e.g. Kombirei" style={inp} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." style={inp} />
              </div>

              {/* Divider */}
              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  👥 Staff Assignments
                </div>
              </div>

              <StaffSlot slot={1} label="Staff 1" required />
              <StaffSlot slot={2} label="Staff 2" />
              <StaffSlot slot={3} label="Staff 3" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>
                {saving ? '⏳ Saving...' : '✅ Save Duty'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Records */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : mobile ? (
        /* Mobile cards */
        <MobileCardList>
          {monthRoster.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No mess duties for {MONTHS[month]} {year}
            </div>
          )}
          {monthRoster.map(r => {
            const ss = SHIFT_STYLE[r.shift] || SHIFT_STYLE['Full Day']
            return (
              <MobileRecordCard key={r.id} accentColor={ss.color}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ss.color }}>{ss.icon} {r.shift}</span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.date}</div>
                  </div>
                  <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                    style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui', fontSize: 11 }}>
                    {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {/* Staff list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {[
                    { name: r.staff1, role: r.staff1_role, desig: r.staff1_desig },
                    { name: r.staff2, role: r.staff2_role, desig: r.staff2_desig },
                    { name: r.staff3, role: r.staff3_role, desig: r.staff3_desig },
                  ].filter(s => s.name).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ padding: '1px 8px', borderRadius: 99, background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.role}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
                      {s.desig && <span style={{ color: '#94a3b8', fontSize: 11 }}>· {s.desig}</span>}
                    </div>
                  ))}
                </div>
                {r.notes && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 8 }}>📝 {r.notes}</div>}
                {isAdmin && (
                  <MobileActionButtons actions={[
                    { label: '✏️ Edit', onClick: () => openEdit(r), bg: '#eff6ff', color: '#1e3a5f' },
                    { label: '🗑 Delete', onClick: () => handleDelete(r.id), bg: '#fee2e2', color: '#dc2626' },
                  ]} />
                )}
              </MobileRecordCard>
            )
          })}
        </MobileCardList>
      ) : (
        /* Desktop table */
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Date', 'Shift', 'Staff 1', 'Staff 2', 'Staff 3', 'Status', 'Notes', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthRoster.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No mess duties for {MONTHS[month]} {year}
                </td></tr>
              )}
              {monthRoster.map((r, i) => {
                const ss = SHIFT_STYLE[r.shift] || SHIFT_STYLE['Full Day']
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>
                        {ss.icon} {r.shift}
                      </span>
                    </td>
                    {/* Staff cells */}
                    {[
                      { name: r.staff1, role: r.staff1_role, desig: r.staff1_desig, linked: !!r.staff1_id },
                      { name: r.staff2, role: r.staff2_role, desig: r.staff2_desig, linked: !!r.staff2_id },
                      { name: r.staff3, role: r.staff3_role, desig: r.staff3_desig, linked: !!r.staff3_id },
                    ].map((s, si) => (
                      <td key={si} style={{ padding: '11px 14px' }}>
                        {s.name ? (
                          <>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: ss.color, fontWeight: 700 }}>{s.role}</div>
                            {s.desig && <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.desig}</div>}
                            {s.linked && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                          </>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: '11px 14px' }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                        {MESS_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>{r.notes || '—'}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(r)} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                          <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Uncovered days warning */}
      {uncovered.length > 0 && (
        <div style={{ marginTop: 16, background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 8 }}>
            ⚠ {uncovered.length} days with no mess duty assigned in {MONTHS[month]}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {uncovered.map(d => (
              <button key={d} onClick={() => { setForm(f => ({ ...f, date: d })); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{ padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                title="Click to assign duty for this date"
              >{d}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Click any date to quickly assign a duty</div>
        </div>
      )}

      {/* ── Supabase SQL */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>🛠 First time? Show Supabase table SQL</summary>
        <pre style={{ marginTop: 8, background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: 10, fontSize: 11, overflow: 'auto' }}>{`create table if not exists mess_duty (
  id          bigserial primary key,
  date        date not null,
  shift       text not null,
  status      text default 'Assigned',
  notes       text,
  staff1_id   bigint references staff_profiles(id) on delete set null,
  staff1      text,
  staff1_role text,
  staff2_id   bigint references staff_profiles(id) on delete set null,
  staff2      text,
  staff2_role text,
  staff3_id   bigint references staff_profiles(id) on delete set null,
  staff3      text,
  staff3_role text,
  created_at  timestamptz default now()
);
alter table mess_duty disable row level security;`}</pre>
      </details>
    </div>
  )
}
// ══════════════════════════════════════════════════════════════
//  TAB 4 — Discipline
// ══════════════════════════════════════════════════════════════
const emptyDisc = {
  date: today(), student_id: null, gcc_no: '', student_name: '', class_name: '',
  incident: '', action_taken: '', reported_by: '', status: 'Open', remarks: '',
}
const DISC_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

function DisciplineTab({ students, autoOpenForm, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [form, setForm] = useState(emptyDisc)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  // Auto-open the Add form when arriving here via the compliance-check
  // "✓ Complete" button, so the housemaster lands ready to log, not on
  // an empty list. Keyed on `nonce` so a repeat click re-triggers it.
  useEffect(() => {
    if (autoOpenForm) { setEditRec(null); setForm(emptyDisc); setShowForm(true) }
  }, [autoOpenForm?.nonce])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('discipline_records').select('*').order('date', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({ ...f, student_id: s.id, gcc_no: s.gcc_no || '', student_name: s.name || '', class_name: getStudentClass(s) }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, student_id: form.student_id || null, gcc_no: form.gcc_no || null,
      student_name: form.student_name, class_name: form.class_name,
      incident: form.incident, action_taken: form.action_taken,
      reported_by: form.reported_by, status: form.status, remarks: form.remarks,
    }
    const { error } = editRec
      ? await supabase.from('discipline_records').update(payload).eq('id', editRec.id)
      : await supabase.from('discipline_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else {
      if (!editRec) {
        const student = students.find(s => s.id === form.student_id)
        notifyHousemasterByHouse(
          student?.house,
          `⚠️ Discipline: ${form.student_name}`,
          (form.incident || 'New discipline record logged').slice(0, 140),
          '/hostel?tab=discipline'
        )
      }
      setForm(emptyDisc); setShowForm(false); setEditRec(null); load()
    }
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('discipline_records').update({ status }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can delete discipline records.'); return }
    if (!window.confirm('Delete this record?')) return
    await supabase.from('discipline_records').delete().eq('id', id); load()
  }

  const enriched = useMemo(() => records.map(r => {
    if (r.student_id) {
      const s = students.find(s => s.id === r.student_id)
      if (s) return { ...r, student_name: s.name, gcc_no: s.gcc_no, class_name: getStudentClass(s) || r.class_name, _house: s.house, _course: s.course }
    }
    return r
  }), [records, students])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(r =>
      (filter === 'All' || r.status === filter) &&
      [r.student_name, r.class_name, r.incident, r.reported_by, r.gcc_no].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [enriched, search, filter])

  const open = records.filter(r => r.status === 'Open').length
  const inProgress = records.filter(r => r.status === 'In Progress').length
  const resolved = records.filter(r => r.status === 'Resolved').length

  return (
    <div>
      {/* FIXED: was repeat(4,1fr) */}
      <div style={statGrid()}>
        <StatCard icon="📋" label="Total" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🔴" label="Open" value={open} color="#dc2626" bg="#fee2e2" />
        <StatCard icon="🟡" label="In Progress" value={inProgress} color="#ca8a04" bg="#fef9c3" />
        <StatCard icon="🟢" label="Resolved" value={resolved} color="#16a34a" bg="#dcfce7" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, incident..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            {DISC_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <ReportExportButtons
          title="Discipline Records"
          subtitle={`${filtered.length} of ${records.length} records${filter !== 'All' ? ` · Status: ${filter}` : ''}`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'gcc_no', label: 'GCC', width: 0.8 },
            { key: 'student_name', label: 'Student', width: 1.4 },
            { key: 'class_name', label: 'Class', width: 1 },
            { key: '_house', label: 'House', width: 1 },
            { key: 'incident', label: 'Incident', width: 2.2 },
            { key: 'action_taken', label: 'Action Taken', width: 2 },
            { key: 'reported_by', label: 'Reported By', width: 1.2 },
            { key: 'status', label: 'Status', width: 1 },
          ]}
          rows={filtered}
          allRows={enriched}
        />
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyDisc) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Record'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>{editRec ? '✏️ Edit Record' : '➕ New Discipline Record'}</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Student data pulled live from Students module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Select Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '6px 12px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Incident Description *</label><textarea value={form.incident} onChange={e => setForm(f => ({ ...f, incident: e.target.value }))} required rows={3} placeholder="Describe the incident..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Action Taken</label><textarea value={form.action_taken} onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))} rows={2} placeholder="Action taken..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Reported By</label><input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} placeholder="Staff name" style={inp} /></div>
              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>{DISC_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'GCC', 'Student', 'Batch', 'House', 'Incident', 'Action', 'Reported By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>{r._house || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.incident}>{r.incident}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.action_taken}>{r.action_taken || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.reported_by || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        style={{ ...statusStyle(r.status), border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                        {DISC_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                        {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No discipline records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 5 — Sickbay
// ══════════════════════════════════════════════════════════════
const emptySick = {
  date: today(), student_id: null, gcc_no: '', student_name: '', class_name: '',
  complaint: '', treatment: '', referred_to: '', admitted_date: today(),
  discharge_date: '', status: 'Admitted', attended_by: '',
}

function SickbayTab({ students, autoOpenForm, currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [form, setForm] = useState(emptySick)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (autoOpenForm) { setEditRec(null); setForm(emptySick); setShowForm(true) }
  }, [autoOpenForm?.nonce])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sickbay_records').select('*').order('date', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleStudentSelect = s => {
    setForm(f => ({ ...f, student_id: s.id, gcc_no: s.gcc_no || '', student_name: s.name || '', class_name: getStudentClass(s) }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      date: form.date, student_id: form.student_id || null, gcc_no: form.gcc_no || null,
      student_name: form.student_name, class_name: form.class_name,
      complaint: form.complaint, treatment: form.treatment,
      referred_to: form.referred_to, admitted_date: form.admitted_date,
      discharge_date: form.discharge_date || null, status: form.status, attended_by: form.attended_by,
    }
    const { error } = editRec
      ? await supabase.from('sickbay_records').update(payload).eq('id', editRec.id)
      : await supabase.from('sickbay_records').insert([payload])
    if (error) alert('Error: ' + error.message)
    else {
      if (!editRec) {
        const student = students.find(s => s.id === form.student_id)
        notifyHousemasterByHouse(
          student?.house,
          `🏥 Sickbay: ${form.student_name}`,
          (form.complaint || 'Student admitted to sickbay').slice(0, 140),
          '/hostel?tab=sickbay'
        )
      }
      setForm(emptySick); setShowForm(false); setEditRec(null); load()
    }
    setSaving(false)
  }

  const handleDischarge = async id => {
    await supabase.from('sickbay_records').update({ status: 'Discharged', discharge_date: today() }).eq('id', id)
    load()
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can delete sickbay records.'); return }
    if (!window.confirm('Delete this record?')) return
    await supabase.from('sickbay_records').delete().eq('id', id); load()
  }

  const enriched = useMemo(() => records.map(r => {
    if (r.student_id) {
      const s = students.find(s => s.id === r.student_id)
      if (s) return { ...r, student_name: s.name, gcc_no: s.gcc_no, class_name: getStudentClass(s) || r.class_name, _house: s.house, _hostel_type: s.hostel_type }
    }
    return r
  }), [records, students])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(r =>
      (filter === 'All' || r.status === filter) &&
      [r.student_name, r.class_name, r.complaint, r.gcc_no].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [enriched, search, filter])

  const admitted = records.filter(r => r.status === 'Admitted').length
  const discharged = records.filter(r => r.status === 'Discharged').length

  return (
    <div>
      {/* FIXED: was repeat(3,1fr) */}
      <div style={statGrid(160)}>
        <StatCard icon="🏥" label="Total Records" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        <StatCard icon="🛏️" label="Currently Admitted" value={admitted} color="#1d4ed8" bg="#dbeafe" />
        <StatCard icon="✅" label="Discharged" value={discharged} color="#16a34a" bg="#dcfce7" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input placeholder="🔍 Search student, complaint..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Status</option>
            <option>Admitted</option>
            <option>Discharged</option>
          </select>
        </div>
        <ReportExportButtons
          title="Sickbay Records"
          subtitle={`${filtered.length} of ${records.length} records${filter !== 'All' ? ` · Status: ${filter}` : ''}`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'gcc_no', label: 'GCC', width: 0.8 },
            { key: 'student_name', label: 'Student', width: 1.4 },
            { key: 'class_name', label: 'Class', width: 1 },
            { key: '_house', label: 'House', width: 1 },
            { key: 'complaint', label: 'Complaint', width: 2 },
            { key: 'treatment', label: 'Treatment', width: 2 },
            { key: 'attended_by', label: 'Attended By', width: 1.2 },
            { key: 'status', label: 'Status', width: 1 },
          ]}
          rows={filtered}
          allRows={enriched}
        />
        <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptySick) }} style={btn()}>
          {showForm ? '✖ Cancel' : '➕ Add Record'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>{editRec ? '✏️ Edit Record' : '➕ New Sickbay Record'}</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>🔗 Student data pulled live from Students module</p>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>🔍 Search & Select Student</label>
                <StudentSearchInput students={students} onSelect={handleStudentSelect} />
                {form.student_id && (
                  <div style={{ marginTop: 8, padding: '6px 12px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    ✅ Linked: {form.student_name} {form.gcc_no ? `(GCC-${form.gcc_no})` : ''}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>GCC No. <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="e.g. 729" style={inp} /></div>
              <div><label style={lbl}>Student Name *</label><input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} required style={inp} /></div>
              <div><label style={lbl}>Batch / Class <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled)</span></label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Complaint *</label><textarea value={form.complaint} onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} required rows={2} placeholder="Describe the complaint..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Treatment Given</label><textarea value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))} rows={2} placeholder="Treatment / medication given..." style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>Referred To</label><input value={form.referred_to} onChange={e => setForm(f => ({ ...f, referred_to: e.target.value }))} placeholder="Hospital / doctor name" style={inp} /></div>
              <div><label style={lbl}>Attended By</label><input value={form.attended_by} onChange={e => setForm(f => ({ ...f, attended_by: e.target.value }))} placeholder="Staff / nurse name" style={inp} /></div>
              <div><label style={lbl}>Admitted Date</label><input type="date" value={form.admitted_date} onChange={e => setForm(f => ({ ...f, admitted_date: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Discharge Date</label><input type="date" value={form.discharge_date} onChange={e => setForm(f => ({ ...f, discharge_date: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}><option>Admitted</option><option>Discharged</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'GCC', 'Student', 'Batch', 'House', 'Hostel Type', 'Complaint', 'Treatment', 'Referred', 'Attended By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: r.status === 'Admitted' ? '#eff6ff' : 'white' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = r.status === 'Admitted' ? '#eff6ff' : 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{r.gcc_no ? `GCC-${r.gcc_no}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.student_name}</div>
                      {r.student_id && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 linked</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>{r._house || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r._hostel_type || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.complaint}>{r.complaint}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.treatment}>{r.treatment || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.referred_to || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.attended_by || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={statusStyle(r.status)}>{r.status}</span></td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', minWidth: 110 }}>
                      <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditRec(r); setForm({ ...r, discharge_date: r.discharge_date || '' }); setShowForm(true) }} style={{ background: '#e8edfb', color: '#1433a8', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                          {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                        </div>
                        {r.status === 'Admitted' && (
                          <button onClick={() => handleDischarge(r.id)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>✅ Discharge</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No sickbay records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 6 — House Management
// ══════════════════════════════════════════════════════════════
const HOUSE_COLORS = [
  { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  { color: '#16a34a', bg: '#dcfce7', border: '#6ee7b7' },
  { color: '#ca8a04', bg: '#fef9c3', border: '#fde047' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  { color: '#0891b2', bg: '#e0f2fe', border: '#7dd3fc' },
]
const emptyHouse = {
  name: '', motto: '', color_index: 0, captain: '', vice_captain: '',
  established_year: new Date().getFullYear(), remarks: '', capacity: 40,
}

function HouseTab({ students: propStudents, currentUser, houseColorMap }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [houses, setHouses] = useState([])
  const [students, setStudents] = useState(propStudents || [])
  // keep setStudents only for local optimistic house assignment updates
  const [masters, setMasters] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [form, setForm] = useState(emptyHouse)
  const [activeHouse, setActiveHouse] = useState(null)
  const [search, setSearch] = useState('')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignFilter, setAssignFilter] = useState('All')
  const [toast, setToast] = useState(null)

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    const [{ data: h }, { data: m }] = await Promise.all([
      supabase.from('houses').select('*').order('name'),
      supabase.from('housemasters').select('*').order('house'),
    ])
    setHouses(h || []); setMasters(m || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSaveHouse = async e => {
    e.preventDefault()
    if (!isAdmin) { alert('Only admins can create or edit houses.'); return }
    setSaving(true)
    const HOUSE_COLOR_HEX = ['#1d4ed8', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#0891b2']
    const payload = {
      name: form.name.trim(), motto: form.motto, color_index: Number(form.color_index),
      color: HOUSE_COLOR_HEX[Number(form.color_index) % HOUSE_COLOR_HEX.length],
      captain: form.captain, vice_captain: form.vice_captain,
      established_year: Number(form.established_year) || new Date().getFullYear(), remarks: form.remarks,
      capacity: Math.max(1, Number(form.capacity) || 40),
    }
    const { error } = editRec
      ? await supabase.from('houses').update(payload).eq('id', editRec.id)
      : await supabase.from('houses').insert([payload])
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setForm(emptyHouse); setShowForm(false); setEditRec(null)
    showToast(editRec ? '✅ House updated' : '✅ House created')
    load(); setSaving(false)
  }

  const handleDeleteHouse = async id => {
    if (!isAdmin) { alert('Only admins can delete houses.'); return }
    const count = students.filter(s => normalizeHouse(s.house) === normalizeHouse(houses.find(h => h.id === id)?.name)).length
    if (!window.confirm(`Delete this house?${count > 0 ? ` ${count} students will be unassigned.` : ''}`)) return
    await supabase.from('houses').delete().eq('id', id)
    showToast('🗑 House deleted', '#dc2626'); load()
  }

  // 🔗 Shared capacity logic — same `houses.capacity` column Admissions.jsx
  // now reads via feeEngine.js's getHouseOccupancy(). Computed locally here
  // since HouseTab already has both `houses` (with capacity) and `students`
  // loaded in memory — no need to re-fetch.
  const getHouseRemaining = (houseName, excludeStudentId = null) => {
    const h = houses.find(h => normalizeHouse(h.name) === normalizeHouse(houseName))
    if (!h) return null
    const capacity = h.capacity ?? 40
    const occupied = students.filter(s =>
      normalizeHouse(s.house) === normalizeHouse(houseName) && s.id !== excludeStudentId
    ).length
    return { capacity, occupied, available: capacity - occupied, isFull: occupied >= capacity }
  }

  const handleAssign = async (studentId, houseName) => {
    if (!isAdmin) { alert('Only admins can change house assignments.'); return }
    if (houseName) {
      const remaining = getHouseRemaining(houseName, studentId)
      if (remaining?.isFull) {
        if (!window.confirm(`⚠ ${houseName} is full (${remaining.occupied}/${remaining.capacity}). Assign anyway?`)) return
      }
    }
    await supabase.from('students').update({ house: houseName || null }).eq('id', studentId)
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, house: houseName || null } : s))
    showToast(houseName ? `✅ Assigned to ${houseName}` : '✅ Removed from house')
  }

  const handleBulkAssign = async houseName => {
    if (!isAdmin) { showToast('Only admins can bulk assign', '#dc2626'); return }
    const unassigned = students.filter(s => !isAssigned(s))
    if (!unassigned.length) { showToast('No unassigned students', '#ca8a04'); return }
    const remaining = getHouseRemaining(houseName)
    if (remaining && unassigned.length > remaining.available) {
      if (!window.confirm(`⚠ ${houseName} only has ${remaining.available} seat(s) left (${remaining.occupied}/${remaining.capacity}), but ${unassigned.length} students are unassigned. Assign anyway? (will exceed capacity)`)) return
    } else {
      if (!window.confirm(`Assign ${unassigned.length} unassigned students to ${houseName}?`)) return
    }
    await supabase.from('students').update({ house: houseName }).in('id', unassigned.map(s => s.id))
    setStudents(prev => prev.map(s => !isAssigned(s) ? { ...s, house: houseName } : s))
    showToast(`✅ ${unassigned.length} students assigned to ${houseName}`)
  }


  const getHouseStyle = h => {
    const c = houseColorMap[h.name] || HOUSE_PALETTE[(Number(h.color_index) || 0) % HOUSE_PALETTE.length]
    return typeof c === 'string' ? { color: c, bg: `${c}10`, border: `${c}40` } : c
  }

  const activeHouseObj = houses.find(h => h.id === activeHouse)
  const houseStudents = activeHouseObj ? students.filter(s => normalizeHouse(s.house) === normalizeHouse(activeHouseObj.name)) : []
  const houseMasters = activeHouseObj ? masters.filter(m => normalizeHouse(m.house) === normalizeHouse(activeHouseObj.name)) : []
  const unassignedCount = students.filter(s => !isAssigned(s)).length

  const assignHits = assignSearch.length > 0
    ? students.filter(s =>
      !isAssigned(s) && (
        (s.name || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
        String(s.gcc_no || '').includes(assignSearch) ||
        (s.batch || '').toLowerCase().includes(assignSearch.toLowerCase())
      )
    ).slice(0, 10)
    : []

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      const matchesSearch = [s.name, s.gcc_no, s.batch, s.course].some(v => (v || '').toString().toLowerCase().includes(q))
      const matchesFilter = assignFilter === 'All' ? true : assignFilter === 'Unassigned' ? !isAssigned(s) : normalizeHouse(s.house) === normalizeHouse(assignFilter).toLowerCase()
      return matchesSearch && matchesFilter
    })
  }, [students, search, assignFilter])

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>

  return (
    <div>
      {toast && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 99,
          background: '#fff', border: `1px solid #e2e8f0`,
          borderLeft: `3px solid ${toast.color}`, borderRadius: 10,
          padding: '11px 16px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,.10)', color: '#1e293b',
          marginBottom: 12,
        }}>{toast.msg}</div>
      )}

      {activeHouse && activeHouseObj && (() => {
        const hs = getHouseStyle(activeHouseObj)
        return (
          <div>
            {/* FIXED: added flexWrap:'wrap' */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveHouse(null)} style={{ ...btn('#f1f5f9', '#374151'), padding: '8px 14px', fontSize: 13 }}>← Back</button>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: hs.color }}>🏠 {activeHouseObj.name} House</div>
                {activeHouseObj.motto && <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{activeHouseObj.motto}"</div>}
              </div>
              {/* FIXED: added flexWrap:'wrap' */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {isAdmin && <button onClick={() => { setEditRec(activeHouseObj); setForm({ ...activeHouseObj }); setShowForm(true); setActiveHouse(null) }} style={{ ...btn('#eff6ff', '#1e3a5f'), fontSize: 12, padding: '7px 14px' }}>✏️ Edit House</button>}
                {isAdmin && <button onClick={() => handleBulkAssign(activeHouseObj.name)} style={{ ...btn('#ecfdf5', '#059669'), fontSize: 12, padding: '7px 14px' }}>+ Assign Unassigned ({unassignedCount})</button>}
              </div>
            </div>

            {/* FIXED: was repeat(4,1fr) */}
            <div style={statGrid(130)}>
              <StatCard icon="👥" label="Students" value={houseStudents.length} color={hs.color} bg={hs.bg} />
              <StatCard icon="👨‍🏫" label="Housemasters" value={houseMasters.length} color={hs.color} bg={hs.bg} />
              <StatCard icon="🎖" label="Captain" value={activeHouseObj.captain || '—'} color={hs.color} bg={hs.bg} />
              <StatCard icon="🎗" label="Vice Captain" value={activeHouseObj.vice_captain || '—'} color={hs.color} bg={hs.bg} />
            </div>

            {houseMasters.length > 0 && (
              <div style={{ background: 'white', border: `1.5px solid ${hs.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: hs.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>👨‍🏫 Housemasters</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {houseMasters.map(m => (
                    <div key={m.id} style={{ background: hs.bg, border: `1px solid ${hs.border}`, borderRadius: 8, padding: '8px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: hs.color }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{m.designation || 'Housemaster'}{m.phone ? ' · ' + m.phone : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: `1px solid ${hs.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: hs.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>➕ Assign Student to {activeHouseObj.name}</div>
              <div style={{ position: 'relative' }}>
                <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Search unassigned student by name, GCC No or batch..." style={inp} />
                {assignHits.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 200, overflowY: 'auto' }}>
                    {assignHits.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, flexWrap: 'wrap', gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <div>
                          <strong>{s.name}</strong>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>GCC-{s.gcc_no || '--'} · {getStudentClass(s) || '--'}</span>
                        </div>
                        {isAdmin && <button onClick={() => { handleAssign(s.id, activeHouseObj.name); setAssignSearch('') }} style={{ ...btn(hs.color), fontSize: 11, padding: '4px 12px' }}>Assign</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <div style={{ background: hs.color, padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>👥 {activeHouseObj.name} Roster — {houseStudents.length} students</span>
              </div>
              {houseStudents.length === 0
                ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No students assigned to this house yet</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['#', 'GCC', 'Student', 'Batch', 'Course', 'Hostel Type', 'Remove'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {houseStudents.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.batch || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.hostel_type || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {isAdmin && <button onClick={() => handleAssign(s.id, '')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✕ Remove</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )
      })()}

      {!activeHouse && showForm && isAdmin && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>{editRec ? '✏️ Edit House' : '🏠 Create New House'}</h3>
          <form onSubmit={handleSaveHouse}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div>
                <label style={lbl}>House Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Kombirei" style={inp} />
              </div>
              <div>
                <label style={lbl}>House Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {HOUSE_COLORS.map((c, i) => (
                    <button key={i} type="button" onClick={() => setForm(f => ({ ...f, color_index: i }))} style={{
                      width: 32, height: 32, borderRadius: '50%', background: c.color,
                      border: Number(form.color_index) === i ? `3px solid #0f172a` : `2px solid ${c.border}`,
                      cursor: 'pointer', transition: 'transform .1s',
                      transform: Number(form.color_index) === i ? 'scale(1.2)' : 'scale(1)',
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Motto</label>
                <input value={form.motto} onChange={e => setForm(f => ({ ...f, motto: e.target.value }))} placeholder="e.g. Unity in Strength" style={inp} />
              </div>
              <div><label style={lbl}>House Captain</label><input value={form.captain} onChange={e => setForm(f => ({ ...f, captain: e.target.value }))} placeholder="Student name" style={inp} /></div>
              <div><label style={lbl}>Vice Captain</label><input value={form.vice_captain} onChange={e => setForm(f => ({ ...f, vice_captain: e.target.value }))} placeholder="Student name" style={inp} /></div>
              <div><label style={lbl}>Established Year</label><input type="number" value={form.established_year} onChange={e => setForm(f => ({ ...f, established_year: e.target.value }))} style={inp} /></div>
              <div>
                <label style={lbl}>Capacity (beds)</label>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 40" style={inp} />
              </div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save House'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!activeHouse && (
        <>
          {/* FIXED: was repeat(4,1fr) */}
          <div style={statGrid(130)}>
            <StatCard icon="🏠" label="Total Houses" value={houses.length} color="#1e3a5f" bg="#eff6ff" />
            <StatCard icon="👥" label="Assigned" value={students.filter(s => s.house).length} color="#16a34a" bg="#dcfce7" />
            <StatCard icon="⚠️" label="Unassigned" value={unassignedCount} color="#dc2626" bg="#fee2e2" />
            <StatCard icon="👨‍🏫" label="Housemasters" value={masters.length} color="#7c3aed" bg="#f5f3ff" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <input placeholder="🔍 Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, maxWidth: 260 }} />
              <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="All">All Students</option>
                <option value="Unassigned">Unassigned Only</option>
                {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
              </select>
            </div>
            <ReportExportButtons
              title="House Assignment Report"
              subtitle={`${filteredStudents.length} of ${students.length} students${assignFilter !== 'All' ? ` · Filter: ${assignFilter}` : ''}`}
              columns={[
                { key: 'gcc_no', label: 'GCC', width: 0.8 },
                { key: 'name', label: 'Student', width: 1.4 },
                { key: 'batch', label: 'Batch', width: 1 },
                { key: 'course', label: 'Course', width: 1 },
                { key: 'house', label: 'House', width: 1 },
                { key: 'hostel_type', label: 'Hostel Type', width: 1 },
              ]}
              rows={filteredStudents}
              allRows={students}
            />
            {isAdmin && (
              <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyHouse) }} style={btn()}>
                {showForm ? '✖ Cancel' : '🏠 Create House'}
              </button>
            )}
          </div>

          {houses.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>No Houses Created Yet</div>
                <button onClick={() => setShowForm(true)} style={btn()}>🏠 Create First House</button>
              </div>
            )
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 24 }}>
                {houses.map(h => {
                  const hs = getHouseStyle(h)
                  const cnt = students.filter(s => normalizeHouse(s.house) === normalizeHouse(h.name)).length
                  const hms = masters.filter(m => normalizeHouse(m.house) === normalizeHouse(h.name))
                  return (
                    <div key={h.id}
                      style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: `1px solid ${hs.border}`, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)' }}
                      onClick={() => setActiveHouse(h.id)}
                    >
                      <div style={{ height: 6, background: hs.color }} />
                      <div style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: hs.color }}>🏠 {h.name}</div>
                            {h.motto && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{h.motto}"</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); setEditRec(h); setForm({ ...h }); setShowForm(true) }} style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                            {isAdmin && <button onClick={e => { e.stopPropagation(); handleDeleteHouse(h.id) }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          {[
                            // 🔗 capacity now comes from houses.capacity (real DB column,
                            // shared with Admissions.jsx via feeEngine.js's
                            // getHouseOccupancy) instead of being absent entirely.
                            { label: 'Students', value: `${cnt}/${h.capacity ?? 40}`, icon: '👥', full: cnt >= (h.capacity ?? 40) },
                            { label: 'Masters', value: hms.length, icon: '👨‍🏫' },
                            { label: 'Est.', value: h.established_year || '—', icon: '📅' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.full ? '#fee2e2' : hs.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 14 }}>{s.icon}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: s.full ? '#dc2626' : hs.color }}>{s.value}</div>
                              <div style={{ fontSize: 10, color: s.full ? '#dc2626' : hs.color, opacity: .7 }}>{s.full ? 'FULL' : s.label}</div>
                            </div>
                          ))}
                        </div>
                        {(h.captain || h.vice_captain) && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            {h.captain && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: hs.bg, color: hs.color, fontWeight: 700 }}>🎖 {h.captain}</span>}
                            {h.vice_captain && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: hs.bg, color: hs.color, fontWeight: 600 }}>🎗 {h.vice_captain}</span>}
                          </div>
                        )}
                        {hms.length > 0 && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>👨‍🏫 {hms.map(m => m.name).join(', ')}</div>}
                        <div style={{ fontSize: 12, color: hs.color, fontWeight: 700, textAlign: 'center', padding: '7px', background: hs.bg, borderRadius: 8 }}>View Roster & Manage →</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          {houses.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <div style={{ background: '#1e3a5f', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>📋 All Students — House Assignment</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{unassignedCount} unassigned</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'GCC', 'Student', 'Batch', 'Course', 'Current House', 'Assign to House'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, i) => {
                    const h = houses.find(h => normalizeHouse(h.name) === normalizeHouse(s.house))
                    const hs = h ? getHouseStyle(h) : null
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{s.batch || '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {s.house && hs
                            ? <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: hs.bg, color: hs.color }}>● {s.house}</span>
                            : <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠ Not assigned</span>
                          }
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {isAdmin ? (
                            <select value={s.house || ''} onChange={e => handleAssign(s.id, e.target.value)} style={{ ...inp, minWidth: 120, width: 'auto', maxWidth: 200, padding: '6px 10px', fontSize: 12 }}>
                              <option value="">— Remove / None —</option>
                              {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.house || '—'}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No students found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 7 — Housemasters
// ══════════════════════════════════════════════════════════════
const emptyHM = {
  name: '', house: '', phone: '', email: '', designation: '',
  assigned_date: today(), status: 'Active', remarks: '',
}

function HousemasterTab({ currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [houses, setHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [form, setForm] = useState(emptyHM)
  const [filter, setFilter] = useState('All')

  const load = async () => {
    setLoading(true)
    const [{ data: m }, { data: h }] = await Promise.all([
      supabase.from('housemasters').select('*').order('house'),
      supabase.from('houses').select('*').order('name'),
    ])
    setRecords(m || []); setHouses(h || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault()
    if (!isAdmin) { alert('Only admins can add or edit housemasters.'); return }
    setSaving(true)
    const { error } = editRec
      ? await supabase.from('housemasters').update(form).eq('id', editRec.id)
      : await supabase.from('housemasters').insert([form])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyHM); setShowForm(false); setEditRec(null); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can remove housemasters.'); return }
    if (!window.confirm('Remove this housemaster?')) return
    await supabase.from('housemasters').delete().eq('id', id); load()
  }

  const getHouseStyle = houseName => {
    const h = houses.find(h => normalizeHouse(h.name) === normalizeHouse(houseName))
    if (!h) return HOUSE_COLORS[0]
    return HOUSE_COLORS[(Number(h.color_index) || 0) % HOUSE_COLORS.length]
  }

  const houseNames = houses.map(h => h.name)
  const filtered = filter === 'All' ? records : records.filter(r => r.house === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, color: '#64748b' }}>
            {records.length} housemasters across {[...new Set(records.map(r => r.house))].length} houses
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
            <option value="All">All Houses</option>
            {houseNames.map(h => <option key={h}>{h}</option>)}
          </select>
        </div>
        <ReportExportButtons
          title="Housemasters"
          subtitle={`${filtered.length} of ${records.length} housemasters${filter !== 'All' ? ` · House: ${filter}` : ''}`}
          columns={[
            { key: 'name', label: 'Name', width: 1.4 },
            { key: 'house', label: 'House', width: 1 },
            { key: 'designation', label: 'Designation', width: 1.2 },
            { key: 'phone', label: 'Phone', width: 1 },
            { key: 'email', label: 'Email', width: 1.4 },
            { key: 'assigned_date', label: 'Assigned', width: 1 },
            { key: 'status', label: 'Status', width: 0.8 },
          ]}
          rows={filtered}
          allRows={records}
        />
        {isAdmin && (
          <button onClick={() => { setShowForm(!showForm); setEditRec(null); setForm(emptyHM) }} style={btn()}>
            {showForm ? '✖ Cancel' : '➕ Add Housemaster'}
          </button>
        )}
      </div>

      {houses.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ No houses created yet. Go to the 🏠 Houses tab first.
        </div>
      )}

      {showForm && isAdmin && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 900 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>{editRec ? '✏️ Edit Housemaster' : '➕ Add Housemaster'}</h3>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div><label style={lbl}>Full Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={inp} /></div>
              <div>
                <label style={lbl}>Assigned House *</label>
                <select value={form.house} onChange={e => setForm(f => ({ ...f, house: e.target.value }))} required style={inp}>
                  <option value="">— Select House —</option>
                  {houseNames.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Designation</label><input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Housemaster" style={inp} /></div>
              <div><label style={lbl}>Assigned Date</label><input type="date" value={form.assigned_date} onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))} style={inp} /></div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
              <div><label style={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Save'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditRec(null) }} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
            {filtered.map(r => {
              const hs = getHouseStyle(r.house)
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)', border: `1px solid ${hs.border}` }}>
                  <div style={{ height: 4, background: hs.color }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.designation || 'Housemaster'}</div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: hs.bg, color: hs.color }}>🏠 {r.house || '—'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 3 }}>
                      {r.phone && <div>📞 {r.phone}</div>}
                      {r.email && <div>✉️ {r.email}</div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Since {r.assigned_date || '—'}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: r.status === 'Active' ? '#dcfce7' : '#fee2e2', color: r.status === 'Active' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{r.status}</span>
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => { setEditRec(r); setForm({ ...r }); setShowForm(true) }} style={{ flex: 1, ...btn('#eff6ff', '#1e3a5f'), fontSize: 12, padding: '7px' }}>✏️ Edit</button>
                        <button onClick={() => handleDelete(r.id)} style={{ flex: 1, ...btn('#fee2e2', '#dc2626'), fontSize: 12, padding: '7px' }}>🗑 Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                {records.length === 0 ? 'No housemasters assigned yet' : `No housemasters in ${filter}`}
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB 8 — Kitchen
// ══════════════════════════════════════════════════════════════
const emptyMeal = { date: today(), meal_type: 'Breakfast', menu: '', prepared_by: '', served_count: 0, remarks: '' }
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Tea', 'Dinner']

function KitchenTab({ currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyMeal)
  const [search, setSearch] = useState('')
  const [mealFilter, setMealFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState(today())

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_records').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('kitchen_records').insert([{ ...form, served_count: Number(form.served_count) || 0 }])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyMeal); setShowForm(false); load() }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!isAdmin) { alert('Only admins can delete kitchen records.'); return }
    if (!window.confirm('Delete this kitchen record?')) return
    await supabase.from('kitchen_records').delete().eq('id', id); load()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r =>
      (mealFilter === 'All' || r.meal_type === mealFilter) &&
      (!dateFilter || r.date === dateFilter) &&
      [r.menu, r.prepared_by, r.remarks].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [records, search, mealFilter, dateFilter])

  const todayRecords = records.filter(r => r.date === today())

  return (
    <div>
      {/* FIXED: was repeat(5,1fr) — worst mobile offender */}
      <div style={statGrid(130)}>
        <StatCard icon="📋" label="Total Records" value={records.length} color="#1e3a5f" bg="#eff6ff" />
        {MEAL_TYPES.map((m, i) => {
          const colors = ['#ca8a04', '#16a34a', '#0891b2', '#7c3aed']
          const bgs = ['#fef9c3', '#dcfce7', '#e0f2fe', '#f5f3ff']
          return (
            <StatCard key={m}
              icon={['🌅', '☀️', '☕', '🌙'][i]}
              label={`Today's ${m}`}
              value={todayRecords.filter(r => r.meal_type === m).length || '—'}
              color={colors[i]} bg={bgs[i]}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <select value={mealFilter} onChange={e => setMealFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="All">All Meals</option>
            {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
          </select>
          <input placeholder="🔍 Search menu, staff..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 120 }} />
        </div>
        <ReportExportButtons
          title="Kitchen Records"
          subtitle={`${filtered.length} of ${records.length} records${mealFilter !== 'All' ? ` · Meal: ${mealFilter}` : ''}${dateFilter ? ` · Date: ${dateFilter}` : ''}`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'meal_type', label: 'Meal', width: 1 },
            { key: 'menu', label: 'Menu', width: 2.4 },
            { key: 'prepared_by', label: 'Prepared By', width: 1.2 },
            { key: 'served_count', label: 'Served', width: 0.8 },
            { key: 'remarks', label: 'Remarks', width: 1.4 },
          ]}
          rows={filtered}
          allRows={records}
        />
        <button onClick={() => setShowForm(!showForm)} style={btn()}>{showForm ? '✖ Cancel' : '➕ Log Meal'}</button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>➕ Log Kitchen Record</h3>
          <form onSubmit={handleSave}>
            {/* FIXED: was 1fr 1fr */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Meal Type *</label>
                <select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))} required style={inp}>
                  {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Menu / Items *</label>
                <textarea value={form.menu} onChange={e => setForm(f => ({ ...f, menu: e.target.value }))} required rows={2} placeholder="e.g. Rice, Dal, Sabzi, Roti..." style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>Prepared By</label>
                <input value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} placeholder="Cook / staff name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Students Served</label>
                <input type="number" min={0} value={form.served_count} onChange={e => setForm(f => ({ ...f, served_count: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Remarks</label>
                <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any remarks..." style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={btn(saving ? '#94a3b8' : '#1e3a5f')}>{saving ? '⏳ Saving...' : '✅ Log Meal'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btn('#f1f5f9', '#374151')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
        : (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['#', 'Date', 'Meal', 'Menu', 'Prepared By', 'Served', 'Remarks', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: '#1e3a5f' }}>{r.meal_type}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.menu}>{r.menu}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.prepared_by || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>{r.served_count || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.remarks || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🗑</button>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No kitchen records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  ROOT — Hostel module (Updated with new House Master features)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  TAB — Neglect Report (admin-only)
//  Shows every logged compliance gap: which housemaster skipped
//  which of the 6 mandatory tabs, for which house/date/session.
// ══════════════════════════════════════════════════════════════
function NeglectReportTab({ currentUser }) {
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [houseFilter, setHouseFilter] = useState('All')
  const [hmFilter, setHmFilter] = useState('All')
  const mobile = useMobileView()

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('hm_neglect_log').select('*').order('created_at', { ascending: false })
    if (error) console.error('hm_neglect_log fetch error (has the table been created?):', error)
    setRecords(data || [])
    setLoading(false)
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const houseNames = [...new Set(records.map(r => r.house))].sort()
  const hmNames = [...new Set(records.map(r => r.housemaster_name).filter(Boolean))].sort()

  const filtered = records.filter(r =>
    (houseFilter === 'All' || r.house === houseFilter) &&
    (hmFilter === 'All' || r.housemaster_name === hmFilter)
  )

  // Per-housemaster tally for a quick "who neglects most" summary
  // Hoisted above the `!isAdmin` early return below (must run unconditionally
  // every render — was previously declared after the early return, causing
  // a rules-of-hooks violation / "rendered more hooks than previous render"
  // for any non-admin user).
  const tally = useMemo(() => {
    const t = {}
    filtered.forEach(r => {
      const name = r.housemaster_name || 'Unknown'
      t[name] = (t[name] || 0) + (r.missing_tabs?.length || 0)
    })
    return Object.entries(t).sort((a, b) => b[1] - a[1])
  }, [filtered])

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <div style={{ fontSize: '15px', fontWeight: '700' }}>Admin access only</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: '#1e3a5f', borderRadius: '14px', padding: '18px 20px', marginBottom: '20px', color: 'white' }}>
        <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '4px' }}>🚨 Six-Tab Compliance Neglect Report</div>
        <div style={{ fontSize: '12px', opacity: 0.75 }}>
          Tracks housemasters who complete roll call without logging Discipline, Sickbay, Repairs, Journal, Mess Duty, or Activities for their house that session.
        </div>
      </div>

      {tally.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '10px' }}>Most Skipped Checks by Housemaster</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tally.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{name}</span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626' }}>{count} skipped check{count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All Houses</option>
          {houseNames.map(h => <option key={h}>{h}</option>)}
        </select>
        <select value={hmFilter} onChange={e => setHmFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All Housemasters</option>
          {hmNames.map(h => <option key={h}>{h}</option>)}
        </select>
        <ReportExportButtons
          title="Six-Tab Compliance Neglect Report"
          subtitle={`${filtered.length} of ${records.length} logged gaps${houseFilter !== 'All' ? ` · House: ${houseFilter}` : ''}${hmFilter !== 'All' ? ` · HM: ${hmFilter}` : ''}`}
          columns={[
            { key: 'date', label: 'Date', width: 1 },
            { key: 'session', label: 'Session', width: 1 },
            { key: 'check_type', label: 'Type', width: 1 },
            { key: 'house', label: 'House', width: 1 },
            { key: 'housemaster_name', label: 'Housemaster', width: 1.4 },
            { key: 'missing_tabs', label: 'Missing Checks', width: 2, value: r => (r.missing_tabs || []).join(', ') },
          ]}
          rows={filtered}
          allRows={records}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
      ) : mobile ? (
        <MobileCardList>
          {filtered.map(r => (
            <MobileRecordCard key={r.id} accentColor="#dc2626">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>🏠 {r.house}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{r.date} · {r.session}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px' }}>👤 {r.housemaster_name || 'Unknown'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {(r.missing_tabs || []).map(key => {
                  const tab = SIX_TABS.find(t => t.key === key)
                  return <span key={key} style={{ padding: '2px 8px', borderRadius: '99px', background: '#fee2e2', color: '#dc2626', fontSize: '10px', fontWeight: '700' }}>{tab?.label || key}</span>
                })}
              </div>
              {r.skip_reasons && Object.keys(r.skip_reasons).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {Object.entries(r.skip_reasons).map(([key, reason]) => {
                    const tab = SIX_TABS.find(t => t.key === key)
                    return (
                      <div key={key} style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        {tab?.label || key}: "{reason}"
                      </div>
                    )
                  })}
                </div>
              )}
            </MobileRecordCard>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No neglect logged — everyone's compliant! 🎉</div>}
        </MobileCardList>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['#', 'Date', 'Type', 'Session', 'House', 'Housemaster', 'Missing Checks'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.date}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: r.check_type === 'standalone' ? '#f5f3ff' : '#eff6ff', color: r.check_type === 'standalone' ? '#7c3aed' : '#1e3a5f' }}>
                      {r.check_type === 'standalone' ? '📋 3x-Daily' : '✅ Roll Call'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: r.session === 'morning' ? '#fef9c3' : r.session === 'afternoon' ? '#fef3c7' : '#e0f2fe',
                      color: r.session === 'morning' ? '#ca8a04' : r.session === 'afternoon' ? '#d97706' : '#0891b2',
                    }}>
                      {r.session === 'morning' ? '🌅' : r.session === 'afternoon' ? '☀️' : '🌙'} {r.session}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e3a5f' }}>🏠 {r.house}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.housemaster_name || 'Unknown'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(r.missing_tabs || []).map(key => {
                        const tab = SIX_TABS.find(t => t.key === key)
                        const reason = r.skip_reasons?.[key]
                        return (
                          <span
                            key={key}
                            title={reason ? `Reason: ${reason}` : 'No reason given'}
                            style={{
                              padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                              background: reason ? '#dcfce7' : '#fee2e2',
                              color: reason ? '#16a34a' : '#dc2626',
                              cursor: reason ? 'help' : 'default',
                            }}
                          >
                            {tab?.label || key}{reason ? ' ✓' : ''}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No neglect logged — everyone's compliant! 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Hostel() {
  const [activeTab, setActiveTab] = useState('hmdashboard')
  const [students, setStudents] = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [mobile, setMobile] = useState(isMobile())
  const [currentHousemaster, setCurrentHousemaster] = useState(null)
  const [houseColorMap, setHouseColorMap] = useState({})  // ← ADD THIS
  // Set when the compliance-check "✓ Complete" button is clicked, so the
  // target tab knows to auto-open its Add form on arrival instead of
  // landing on an empty list. Consumed once, then cleared.
  const [autoOpenForm, setAutoOpenForm] = useState(null) // { tabId, house, nonce } | null
  const navigateAndOpenForm = (tabId, house) => {
    setAutoOpenForm({ tabId, house, nonce: Date.now() })
    setActiveTab(tabId)
  }
  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      return s ? JSON.parse(s).user : {}
    } catch {
      return {}
    }
  }, [])
  const userRole = (currentUser?.role || '').toLowerCase()
  const isAdmin = userRole === 'admin'
  const isHM = userRole === 'house master'

  // Track mobile state
  useEffect(() => {
    const handleResize = () => setMobile(isMobile())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchShared = async () => {
      setDataLoading(true)
      const [{ data: s, error: e1 }, { data: st, error: e2 }, { data: hm, error: e3 }, { data: houses, error: e4 }] = await Promise.all([
        supabase.from('students').select('id,name,gcc_no,class_name,batch,course,house,hostel_type,status,admission_no,dob').order('name'),
        supabase.from('staff_profiles').select('id,name,designation,department,status').order('name'),
        supabase.from('housemasters').select('*')
          .eq('status', 'Active')
          .eq('name', (currentUser?.name || '').trim())
          .maybeSingle(),
        supabase.from('houses').select('name, color_index'),
      ])
      if (e1) console.error('Students fetch error:', e1)
      if (e2) console.error('Staff fetch error:', e2)
      if (e3) console.error('Housemaster fetch error:', e3)
      if (e4) console.error('Houses fetch error:', e4)
      console.log('Loaded:', s?.length, 'students,', st?.length, 'staff | sample:', s?.[0])
      setStudents(s || [])
      setStaffProfiles(st || [])
      setCurrentHousemaster(hm || null)

      // Load house colors
      if (houses?.length) {
        const colorMap = {}
        const palette = ['#1d4ed8', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#0891b2', '#be185d', '#047857']
        houses.forEach(h => {
          colorMap[h.name] = palette[Number(h.color_index) % palette.length]
        })
        setHouseColorMap(colorMap)
      }

      setDataLoading(false)
    }
    fetchShared()
  }, [currentUser?.name])

  const standaloneTab = activeTab === 'schedule' || activeTab === 'kitchen' || activeTab === 'housemaster' || activeTab === 'adminmonitor' || activeTab === 'neglectreport' || activeTab === 'hmrollreport'

  const tabContent = {
    allotments: <DayScholarTab students={students} currentUser={currentUser} />,
    schedule: <ScheduleTab currentUser={currentUser} />,
    nightduty: <NightDutyTab staffProfiles={staffProfiles} autoOpenForm={autoOpenForm?.tabId === 'nightduty' ? autoOpenForm : null} currentUser={currentUser} />,
    discipline: <DisciplineTab students={students} autoOpenForm={autoOpenForm?.tabId === 'discipline' ? autoOpenForm : null} currentUser={currentUser} />,
    sickbay: <SickbayTab students={students} autoOpenForm={autoOpenForm?.tabId === 'sickbay' ? autoOpenForm : null} currentUser={currentUser} />,
    house: <HouseTab students={students} currentUser={currentUser} houseColorMap={houseColorMap} />,
    housemaster: <HousemasterTab currentUser={currentUser} />,
    kitchen: <KitchenTab currentUser={currentUser} />,
    hmactivities: <HousemasterActivitiesTab staffProfiles={staffProfiles} currentUser={currentUser} />,
    adminmonitor: <AdminMonitorTab staffProfiles={staffProfiles} />,
    // ─── NEW TABS ──────────────────────────────────────
    attendance: <AttendanceTab students={students} currentHousemaster={currentHousemaster} currentUser={currentUser} onTabChange={setActiveTab} onCompleteTab={navigateAndOpenForm} />,
    leave: <LeaveTab students={students} currentHousemaster={currentHousemaster} currentUser={currentUser} />,
    hmdashboard: <HMDashboard students={students} staffProfiles={staffProfiles} currentHousemaster={currentHousemaster} onTabChange={setActiveTab} currentUser={currentUser} />,
    maintenance: <MaintenanceTab currentHousemaster={currentHousemaster} currentUser={currentUser} autoOpenForm={autoOpenForm?.tabId === 'maintenance' ? autoOpenForm : null} />,
    journal: <JournalTab currentHousemaster={currentHousemaster} autoOpenForm={autoOpenForm?.tabId === 'journal' ? autoOpenForm : null} currentUser={currentUser} />,
    classtimetable: <ClassTimetableTab />,
    doubtsession: <HMDoubtSessionsTab currentHousemaster={currentHousemaster} currentUser={currentUser} />,
    neglectreport: <NeglectReportTab currentUser={currentUser} />,
    hmrollreport: <HMRollCallReportTab />,
  }

  return (
    <div style={{
      padding: mobile ? '12px' : '24px', fontFamily: 'system-ui,sans-serif',
      paddingBottom: mobile ? '80px' : '24px', background: MD.color.surfaceDim, minHeight: '100vh',
    }}>
      <div style={{ marginBottom: mobile ? '18px' : '26px' }}>
        <h1 style={{ ...MD.type.headline, fontSize: mobile ? '21px' : '27px', color: MD.color.primary, margin: 0 }}>
          🏠 Hostel Management
        </h1>
        <p style={{ color: MD.color.onSurfaceVariant, fontSize: mobile ? '13px' : '14px', margin: '6px 0 0', fontWeight: '500' }}>
          {mobile ? 'Allotments · Schedule · Duty · Discipline · Sickbay · House · Kitchen · Roll Call · Leave · Dashboard · Repairs · Journal' : 'Allotments · Schedule · Night Duty · Discipline · Sickbay · House · Kitchen'}
          {dataLoading
            ? <span style={{ marginLeft: 12, color: '#b45309', fontWeight: 700 }}>⏳ Loading...</span>
            : <span style={{ marginLeft: 12, color: MD.color.success, fontWeight: 700 }}>✅ {students.length} students · {staffProfiles.length} staff</span>
          }
        </p>
      </div>
      {/* Desktop/Tablet Tab Bar — Material tonal chips, elevated when active */}
      {!mobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
          gap: '8px',
          marginBottom: '26px',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '10px 10px',
              border: activeTab === t.id ? 'none' : `1px solid ${MD.color.outlineVariant}`,
              borderRadius: MD.radius.control,
              background: activeTab === t.id ? MD.color.primary : MD.color.surfaceContainer,
              color: activeTab === t.id ? 'white' : MD.color.onSurfaceVariant,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === t.id ? 700 : 600,
              whiteSpace: 'nowrap',
              textAlign: 'center',
              boxShadow: activeTab === t.id ? MD.elevation[2] : 'none',
              transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Mobile Tab Grid — Material tonal cards with elevation lift on active */}
      {mobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '9px',
          marginBottom: '18px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: MD.color.surfaceDim,
          paddingTop: '8px',
          paddingBottom: '10px',
          marginTop: '-8px',
        }}>
          {TABS.map(t => {
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 6px',
                  borderRadius: MD.radius.field,
                  border: isActive ? 'none' : `1px solid ${MD.color.outlineVariant}`,
                  background: isActive ? MD.color.primary : MD.color.surfaceContainer,
                  color: isActive ? 'white' : MD.color.onSurfaceVariant,
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '600',
                  cursor: 'pointer',
                  boxShadow: isActive ? MD.elevation[3] : MD.elevation[1],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  minHeight: '58px',
                  justifyContent: 'center',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: '18px' }}>{t.label.split(' ')[0]}</span>
                <span>{t.label.split(' ').slice(1).join(' ')}</span>
              </button>
            )
          })}
        </div>
      )}

      {dataLoading && !standaloneTab
        ? (
          <div style={{ textAlign: 'center', padding: mobile ? '40px' : '60px', color: '#64748b' }}>
            <div style={{ fontSize: mobile ? '24px' : '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: mobile ? '14px' : '15px', fontWeight: 600 }}>Loading student & staff data...</div>
            <div style={{ fontSize: '13px', marginTop: '6px', color: '#94a3b8' }}>This only happens once on first load</div>
          </div>
        )
        : tabContent[activeTab]
      }
    </div>
  )
}
export default Hostel;
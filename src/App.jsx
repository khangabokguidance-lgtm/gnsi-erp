import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from './supabase'

import Login              from './Login'
import Students           from './Students'
import Admissions         from './Admissions'
import Sessions           from './Sessions'
import AdmissionSessions  from './AdmissionSessions'
import BulkAdmission      from './BulkAdmission'
import Fees               from './Fees'
import Accounts           from './Accounts'
import Salary             from './Salary'
import Staff              from './Staff'
import HR                 from './DAILY_ATTENDANCE_TRACKER_COMPLETE'
import Leave              from './Leave'
import Hostel             from './Hostel'
import Reception          from './Reception'
import Notice             from './Notice'
import Social             from './Social'
import Connect            from './Connect'
import Reports            from './Reports'
import Checklist          from './Checklist'
import QuestionBank       from './QuestionBank'
import QuestionBankViewer from './QuestionBankViewer'
import SystemSettings     from './SystemSettings'
import AdminPage          from './AdminPage'
import StudentFeeLedger   from './StudentFeeLedger'
import GNSIDashboard      from './GNSIDashboard'
import Courses            from './Courses'
import Teaching           from './Teaching'
import Attendance         from './Attendance'
import Exams              from './Exams'
import Timetable          from './Timetable'
import FeeSetup           from './FeeSetup'
import Kitchen            from './Kitchen.jsx'
import Entrance           from './Entrance'
import { LOGO_BASE64 }    from './logo'
import { crossModuleSync } from './CrossModuleSync'
import LandingPage        from './LandingPage'
import WebsiteTab         from './WebsiteTab'
import { StudentSelfService, GatePassVerifyPage } from './LeaveTab'
import AdminLinkStaff     from './AdminLinkStaff'
import StudyMaterial      from './StudyMaterial'
import StudyLockers       from './StudyLockers'
import InvitationGenerator from './InvitationGenerator'
import CertificateGenerator from './CertificateGenerator'
import TeachingAids       from './TeachingAids'
import CastReceiver       from './CastReceiver'
import Awards             from './Awards'
import FaceAttendance     from './FaceAttendance'
import Student360         from './Student360'
import { useMismatchAutoScan } from './mismatchScanner'

// ─────────────────────────────────────────────────────────────
//  FIX 1: Unified admin role check — consistent everywhere
// ─────────────────────────────────────────────────────────────
const ADMIN_ROLES = ['Admin', 'Administrator']
const isAdminRole = (role) => ADMIN_ROLES.includes(role)

// Roles that manage Face Attendance for other staff (coverage, approvals,
// enrollment) without necessarily having their own linked staff_profile_id —
// unlike an ordinary staff member, who only sees this module to check
// themselves in and therefore does need that link.
const FACE_ATTENDANCE_MANAGER_ROLES = ['Staff Manager']
const canSeeFaceAttendance = (currentUser, isAdmin) =>
  isAdmin ||
  !!currentUser?.staff_profile_id ||
  FACE_ATTENDANCE_MANAGER_ROLES.includes(currentUser?.role)

// ─────────────────────────────────────────────────────────────
//  NAV GROUPS
// ─────────────────────────────────────────────────────────────
const ALL_GROUPS = [
  {
    group: 'CORE',
    items: [
      { id: 'dashboard',      label: 'Dashboard',      icon: '⊞' },
      { id: 'students',       label: 'Students',       icon: '🎓' },
      { id: 'admissions',     label: 'Admissions',     icon: '📋' },
      { id: 'bulkadmission',  label: 'Bulk Admission', icon: '📥' },
    ],
  },
  {
    group: 'FINANCE',
    items: [
      { id: 'fees',             label: 'Fees',               icon: '💰' },
      { id: 'accounts',         label: 'Accounts',           icon: '🧾' },
      { id: 'salary',           label: 'Salary',             icon: '💵' },
      { id: 'studentfeeledger', label: 'Student Fee Ledger', icon: '📒' },
      // FIX: feesetup now visible in nav (was hidden but reachable)
      { id: 'feesetup',         label: 'Fee Setup',          icon: '⚙️' },
    ],
  },
  {
    group: 'ACADEMIC',
    items: [
      { id: 'attendance',    label: 'Attendance',      icon: '📅' },
      { id: 'exams',         label: 'Exams',           icon: '📝' },
      { id: 'timetable',     label: 'Timetable',       icon: '🕐' },
      { id: 'teaching',      label: 'Teaching',        icon: '📚' },
      { id: 'courses',       label: 'Courses',         icon: '🎓' },
      { id: 'questionbank',  label: 'Question Bank',   icon: '❓' },
      { id: 'questionbankviewer', label: 'Question Bank Viewer', icon: '📖' },
      { id: 'entrance',      label: 'Entrance Exam',   icon: '🏆' },
      { id: 'studymaterial', label: 'Study Materials', icon: '📖' },
      { id: 'teachingaids',  label: 'Teaching Aids',   icon: '🔒' },
      { id: 'studylockers',  label: 'Study Lockers',   icon: '🗃️' },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { id: 'kitchen', label: 'Kitchen', icon: '🍽️' },
      { id: 'staff',   label: 'Staff',   icon: '👨‍🏫' },
      { id: 'hr',      label: 'HR',      icon: '🗂️' },
      { id: 'leave',   label: 'Leave',   icon: '🏖️' },
      { id: 'hostel',  label: 'Hostel',  icon: '🏨' },
      { id: 'awards',  label: 'Awards',  icon: '🏅' },
      { id: 'faceattendance', label: 'Face Attendance', icon: '🧑‍💼' },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { id: 'reception', label: 'Reception', icon: '🛎️' },
      { id: 'notice',    label: 'Notice',    icon: '🔔' },
      { id: 'social',    label: 'Social',    icon: '📣' },
      { id: 'connect',   label: 'Connect',   icon: '🔗' },
      { id: 'website',   label: 'Website Manager', icon: '🌐' },
    ],
  },
  {
    group: 'MANAGEMENT',
    items: [
      { id: 'reports',     label: 'Reports',      icon: '📊' },
      { id: 'checklist',   label: 'Checklist',    icon: '✅' },
      { id: 'invitation',  label: 'Invitation',   icon: '✉️' },
      { id: 'certificate', label: 'Certificates', icon: '📜' },
      { id: 'admin',       label: 'Admin',        icon: '🔐' },
      { id: 'student360',  label: 'Student 360°', icon: '🔍' },
      { id: 'system',      label: 'System',       icon: '⚙️' },
      { id: 'adminlink',   label: 'Link Staff',   icon: '🔗' },
    ],
  },
]

const ALL_ITEMS = ALL_GROUPS.flatMap(g => g.items)

const BADGES = {
  fees:   { count: 3, color: '#fcd34d', bg: '#78350f' },
  leave:  { count: 2, color: '#fcd34d', bg: '#78350f' },
  notice: { count: 5, color: '#fcd34d', bg: '#78350f' },
}

const FULL_CRUD = { read: true,  add: true,  edit: true,  delete: true  }
const NO_CRUD   = { read: false, add: false, edit: false, delete: false }

function buildPermMap(rows) {
  const map = {}
  ;(rows || []).forEach(r => {
    map[r.module_key] = {
      read:   r.can_read   ?? r.allowed ?? false,
      add:    r.can_add    ?? false,
      edit:   r.can_edit   ?? false,
      delete: r.can_delete ?? false,
    }
  })
  return map
}

function getModulePerms(permMap, moduleKey, isAdmin) {
  if (isAdmin) return FULL_CRUD
  return permMap[moduleKey] ?? NO_CRUD
}

// ─────────────────────────────────────────────────────────────
//  FIX 2: Login attempt rate limiting
// ─────────────────────────────────────────────────────────────
const LOGIN_ATTEMPTS_KEY = 'gnsi_login_attempts'
const LOGIN_LOCKOUT_KEY  = 'gnsi_login_lockout'
const MAX_ATTEMPTS       = 5
const LOCKOUT_MS         = 5 * 60 * 1000 // 5 minutes

function checkLoginLock() {
  try {
    const lockUntil = parseInt(localStorage.getItem(LOGIN_LOCKOUT_KEY) || '0')
    if (Date.now() < lockUntil) return { locked: true, until: lockUntil }
    return { locked: false }
  } catch { return { locked: false } }
}

function recordLoginAttempt() {
  try {
    const attempts = parseInt(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '0') + 1
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, String(attempts))
    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS
      localStorage.setItem(LOGIN_LOCKOUT_KEY, String(until))
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, '0')
      return { locked: true, until }
    }
    return { locked: false, attempts }
  } catch { return { locked: false } }
}

function clearLoginAttempts() {
  try {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY)
    localStorage.removeItem(LOGIN_LOCKOUT_KEY)
  } catch {}
}

const D = {
  bg:           '#03263a',
  bgDeep:       '#021e2e',
  bgSurface:    '#0a1f2e',
  bgHover:      '#0d2840',
  bgActive:     '#0f1e10',
  border:       '#1a3347',
  borderStrong: '#254560',
  accent:       '#f59e0b',
  accentLight:  '#fbbf24',
  accentGlow:   'rgba(245,158,11,0.12)',
  accentBorder: 'rgba(245,158,11,0.3)',
  textPrimary:  '#f0f4f8',
  textSecondary:'#94afc4',
  textMuted:    '#6b8fa8',
  textFaint:    '#4a6b82',
  green:        '#22c55e',
}

const LS = {
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } },
  set: (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

const SIDEBAR_FULL = 262
const SIDEBAR_MINI = 62

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const h = e => setMobile(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return mobile
}

function CollapsedNav({ activePage, onNavigate, allowedModules }) {
  return (
    <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, scrollbarWidth: 'none' }}>
      {ALL_ITEMS.filter(i => allowedModules.has(i.id)).map(item => {
        const isActive = activePage === item.id
        const badge = BADGES[item.id]
        return (
          <button key={item.id} onClick={() => onNavigate(item.id)} title={item.label}
            style={{ width: 44, height: 40, borderRadius: 9, flexShrink: 0,
              border: isActive ? `1px solid ${D.accentBorder}` : '1px solid transparent',
              background: isActive ? D.bgActive : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, position: 'relative', transition: 'all .12s' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = D.bgHover }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
            {item.icon}
            {isActive && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: '0 3px 3px 0', background: D.accent }} />}
            {badge && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: D.accent, border: `1.5px solid ${D.bg}` }} />}
          </button>
        )
      })}
    </nav>
  )
}

function NavItem({ item, isActive, onClick, onPin, isPinned, compact = false }) {
  const badge = BADGES[item.id]
  const [hov, setHov] = useState(false)
  const [pinHov, setPinHov] = useState(false)
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPinHov(false) }}>
      <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '5px 10px 5px 12px' : '7px 10px 7px 14px', borderRadius: 8, marginBottom: 1, border: isActive ? `1px solid ${D.accentBorder}` : `1px solid ${hov ? D.border : 'transparent'}`, cursor: 'pointer', textAlign: 'left', fontSize: compact ? 12.5 : 13.5, fontWeight: isActive ? 600 : 400, background: isActive ? `linear-gradient(90deg, ${D.bgActive} 0%, rgba(15,30,16,0.6) 100%)` : hov ? D.bgHover : 'transparent', color: isActive ? D.accentLight : hov ? D.textPrimary : D.textSecondary, position: 'relative', transition: 'background .12s, border-color .12s, color .12s', fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>
        {isActive && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: '0 3px 3px 0', background: D.accent, boxShadow: `0 0 8px ${D.accent}` }} />}
        <span style={{ fontSize: compact ? 13 : 15, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
        <span style={{ flex: 1, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.count}</span>}
        {isPinned && !hov && <span style={{ fontSize: 9, color: D.accent, flexShrink: 0, opacity: 0.6 }}>📌</span>}
      </button>
      {hov && onPin && (
        <button onClick={e => { e.stopPropagation(); onPin(item.id) }} onMouseEnter={() => setPinHov(true)} onMouseLeave={() => setPinHov(false)} title={isPinned ? 'Unpin' : 'Pin to top'} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: pinHov ? D.accentGlow : 'transparent', border: `1px solid ${pinHov ? D.accentBorder : 'transparent'}`, borderRadius: 5, padding: '2px 5px', cursor: 'pointer', fontSize: 11, color: isPinned ? D.accent : D.textFaint, transition: 'all .12s' }}>{isPinned ? '📌' : '📍'}</button>
      )}
    </div>
  )
}

function GroupHeader({ label, collapsed, onToggle, count }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px 4px 12px', background: hov ? 'rgba(255,255,255,0.03)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, transition: 'background .1s', marginBottom: 2 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em', color: hov ? D.textMuted : D.textFaint, textTransform: 'uppercase', fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif", flex: 1, textAlign: 'left', transition: 'color .1s' }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 9, color: D.textFaint, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 99 }}>{count}</span>}
      <span style={{ fontSize: 9, color: D.textFaint, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block' }}>▾</span>
    </button>
  )
}

function PinnedItems({ pins, activePage, onNavigate, onPin }) {
  if (!pins.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em', color: D.accentBorder, padding: '4px 12px 5px', textTransform: 'uppercase', fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>📌 PINNED</div>
      {pins.map(id => { const item = ALL_ITEMS.find(i => i.id === id); if (!item) return null; return <NavItem key={id} item={item} isActive={activePage === id} onClick={() => onNavigate(id)} onPin={onPin} isPinned compact /> })}
    </div>
  )
}

function RecentItems({ recents, activePage, onNavigate }) {
  if (!recents.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em', color: D.textFaint, padding: '4px 12px 5px', textTransform: 'uppercase', fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>RECENT</div>
      {recents.map(id => { const item = ALL_ITEMS.find(i => i.id === id); if (!item) return null; return <NavItem key={id} item={item} isActive={activePage === id} onClick={() => onNavigate(id)} compact /> })}
    </div>
  )
}

function LogoutButton({ onLogout }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onLogout} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, border: `1px solid ${hov ? D.accentBorder : D.border}`, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, background: hov ? D.accentGlow : D.bgSurface, color: hov ? D.accentLight : D.textMuted, transition: 'all .15s', fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>
      <span style={{ fontSize: 14 }}>🚪</span><span>Sign Out</span>
    </button>
  )
}

function LogoHeader({ isMobile, onClose, collapsed, onToggleCollapse }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ padding: '0 10px 0 14px', height: 60, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11, borderBottom: `1px solid ${D.border}`, flexShrink: 0, background: `linear-gradient(90deg, ${D.bgDeep} 0%, ${D.bg} 100%)`, position: 'relative', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 14, right: 14, height: 1, background: `linear-gradient(90deg, ${D.accent}44, transparent)` }} />
      <img src={`data:image/png;base64,${LOGO_BASE64}`} alt="GNSI" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
      {!collapsed && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: D.textPrimary, letterSpacing: '-.01em', lineHeight: 1.1, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>GNSI <span style={{ color: D.accent }}>ERP</span></div>
          <div style={{ fontSize: 9.5, color: D.textFaint, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2, fontFamily: "'Trebuchet MS', monospace" }}>School Management</div>
        </div>
      )}
      {isMobile
        ? <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.border}`, borderRadius: 6, cursor: 'pointer', color: D.textMuted, fontSize: 14, lineHeight: 1, padding: '5px 8px', flexShrink: 0 }}>✕</button>
        : <button onClick={onToggleCollapse} title={collapsed ? 'Expand' : 'Collapse'} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ flexShrink: 0, marginLeft: collapsed ? 0 : 'auto', background: hov ? D.accentGlow : 'rgba(255,255,255,0.05)', border: `1px solid ${hov ? D.accentBorder : D.border}`, borderRadius: 6, cursor: 'pointer', color: hov ? D.accentLight : D.textMuted, fontSize: 13, lineHeight: 1, padding: '5px 7px', transition: 'all .15s', zIndex: 1 }}>{collapsed ? '»' : '«'}</button>
      }
    </div>
  )
}

function SidebarContent({ activePage, setActivePage, onLogout, currentUser, onNavClick, permMap }) {
  const [search,    setSearch]    = useState('')
  const [collapsed, setCollapsed] = useState(() => LS.get('gnsi_nav_collapsed', {}))
  const [pins,      setPins]      = useState(() => LS.get('gnsi_nav_pins', []))
  const [recents,   setRecents]   = useState(() => LS.get('gnsi_nav_recents', []))
  const searchRef = useRef(null)
  const role    = currentUser?.role || 'Teacher'
  // FIX 1: use unified isAdminRole
  const isAdmin = isAdminRole(role)

  const allowedModules = useMemo(() => {
    if (isAdmin) return new Set(ALL_ITEMS.map(i => i.id))
    const set = new Set(['dashboard'])
    if (canSeeFaceAttendance(currentUser, isAdmin)) set.add('faceattendance')
    Object.entries(permMap).forEach(([key, crud]) => { if (crud.read) set.add(key) })
    return set
  }, [permMap, isAdmin, currentUser])

  useEffect(() => {
    const handler = e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleNavigate = useCallback((id) => {
    setActivePage(id); onNavClick?.()
    setRecents(prev => { const next = [id, ...prev.filter(r => r !== id)].slice(0, 5); LS.set('gnsi_nav_recents', next); return next })
  }, [setActivePage, onNavClick])

  const handlePin = useCallback((id) => {
    setPins(prev => { const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]; LS.set('gnsi_nav_pins', next); return next })
  }, [])

  const toggleGroup = (group) => {
    setCollapsed(prev => { const next = { ...prev, [group]: !prev[group] }; LS.set('gnsi_nav_collapsed', next); return next })
  }

  const initials = currentUser?.name ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'US'

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ALL_GROUPS.map(g => ({
      ...g,
      items: g.items.filter(i => allowedModules.has(i.id) && !pins.includes(i.id) && (!q || i.label.toLowerCase().includes(q)))
    })).filter(g => g.items.length > 0)
  }, [allowedModules, search, pins])

  const visibleRecents = useMemo(() => recents.filter(id => allowedModules?.has(id) && !pins.includes(id)).slice(0, 4), [recents, allowedModules, pins])
  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)

  return (
    <>
      <div style={{ margin: '10px 10px 0', background: `linear-gradient(135deg, ${D.bgSurface} 0%, rgba(15,40,60,0.8) 100%)`, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: `radial-gradient(ellipse at left center, ${D.accentGlow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: D.accentGlow, border: `1.5px solid ${D.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: D.accentLight, fontFamily: "'Trebuchet MS', monospace", zIndex: 1 }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1, zIndex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: D.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>{currentUser?.name || 'User'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: D.accentGlow, border: `1px solid ${D.accentBorder}`, borderRadius: 4, padding: '2px 7px' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: D.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: D.accent }}>{role}</span>
            </span>
            {totalBadges > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fcd34d', background: '#78350f', padding: '2px 6px', borderRadius: 99 }}>{totalBadges} pending</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green, boxShadow: `0 0 6px ${D.green}` }} />
          <span style={{ fontSize: 8, color: D.textFaint }}>online</span>
        </div>
      </div>

      <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: D.bgDeep, border: `1px solid ${D.borderStrong}`, borderRadius: 8, padding: '7px 11px' }}>
          <span style={{ fontSize: 12, color: D.textMuted, flexShrink: 0 }}>🔍</span>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search modules…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: D.textPrimary, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }} />
          {search ? <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button> : <span style={{ fontSize: 10, color: D.textFaint, background: 'rgba(255,255,255,0.07)', border: `1px solid ${D.border}`, borderRadius: 4, padding: '2px 5px', fontFamily: 'monospace', flexShrink: 0 }}>/</span>}
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 8px', scrollbarWidth: 'thin', scrollbarColor: `${D.border} transparent` }}>
        {!search && <PinnedItems pins={pins} activePage={activePage} onNavigate={handleNavigate} onPin={handlePin} />}
        {!search && visibleRecents.length > 0 && (<><RecentItems recents={visibleRecents} activePage={activePage} onNavigate={handleNavigate} /><div style={{ height: 1, background: D.border, margin: '6px 4px 10px' }} /></>)}
        {filteredGroups.length === 0 && <div style={{ padding: '24px 12px', textAlign: 'center', color: D.textFaint, fontSize: 12 }}>No modules found</div>}
        {filteredGroups.map((grp, gi) => {
          const isCollapsed = !!collapsed[grp.group] && !search
          return (
            <div key={grp.group} style={{ marginBottom: 2 }}>
              {gi > 0 && <div style={{ height: 1, background: D.border, margin: '4px 4px 8px' }} />}
              <GroupHeader label={grp.group} collapsed={isCollapsed} count={grp.items.length} onToggle={() => toggleGroup(grp.group)} />
              {!isCollapsed && grp.items.map(item => <NavItem key={item.id} item={item} isActive={activePage === item.id} onClick={() => handleNavigate(item.id)} onPin={handlePin} isPinned={pins.includes(item.id)} />)}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '8px 8px 12px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 7px' }}>
          <span style={{ fontSize: 10, color: D.textFaint }}><span style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${D.border}`, borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 9 }}>/</span>{' '}to search</span>
          <span style={{ fontSize: 10, color: D.textFaint }}>v2.2 · © {new Date().getFullYear()} GNSI</span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>
    </>
  )
}

function MiniLogout({ onLogout }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ padding: '8px 0 12px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'center' }}>
      <button onClick={onLogout} title="Sign Out" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${hov ? D.accentBorder : D.border}`, cursor: 'pointer', background: hov ? D.accentGlow : D.bgSurface, color: hov ? D.accentLight : D.textMuted, fontSize: 16, transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚪</button>
    </div>
  )
}

function Sidebar({ activePage, setActivePage, onLogout, currentUser, permMap, collapsed, onToggleCollapse }) {
  const isMobile    = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)
  // FIX 1: unified admin check
  const isAdmin = isAdminRole(currentUser?.role)

  const allowedModules = useMemo(() => {
    if (isAdmin) return new Set(ALL_ITEMS.map(i => i.id))
    const set = new Set(['dashboard'])
    if (canSeeFaceAttendance(currentUser, isAdmin)) set.add('faceattendance')
    Object.entries(permMap).forEach(([key, crud]) => { if (crud.read) set.add(key) })
    return set
  }, [permMap, isAdmin, currentUser])

  useEffect(() => { setDrawerOpen(false) }, [activePage])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const sidebarStyles = {
    background: D.bg, display: 'flex', flexDirection: 'column',
    fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    borderRight: `1px solid ${D.border}`,
  }

  if (!isMobile) {
    const w = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL
    return (
      <div style={{ ...sidebarStyles, width: w, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100, overflow: 'hidden', transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        <LogoHeader isMobile={false} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
        {collapsed
          ? <><CollapsedNav activePage={activePage} onNavigate={setActivePage} allowedModules={allowedModules} /><MiniLogout onLogout={onLogout} /></>
          : <SidebarContent activePage={activePage} setActivePage={setActivePage} onLogout={onLogout} currentUser={currentUser} permMap={permMap} />
        }
      </div>
    )
  }

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: D.bg, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', zIndex: 200 }}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, padding: 4, position: 'relative', flexShrink: 0 }}>
          {[0,1,2].map(i => <span key={i} style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: D.textMuted }} />)}
          {totalBadges > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: D.accent, border: `1.5px solid ${D.bg}` }} />}
        </button>
        <img src={`data:image/png;base64,${LOGO_BASE64}`} alt="GNSI" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, lineHeight: 1.1 }}>GNSI <span style={{ color: D.accent }}>ERP</span></div>
          <div style={{ fontSize: 9, color: D.textFaint, textTransform: 'uppercase', letterSpacing: '.07em' }}>School Management</div>
        </div>
        <div style={{ fontSize: 11, color: D.accentLight, fontWeight: 600, background: D.accentGlow, border: `1px solid ${D.accentBorder}`, borderRadius: 6, padding: '3px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {ALL_ITEMS.find(i => i.id === activePage)?.icon}{' '}{ALL_ITEMS.find(i => i.id === activePage)?.label || activePage}
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fca5a5', fontSize: 16, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚪</button>
      </div>
      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 298, backdropFilter: 'blur(3px)' }} />}
      <div style={{ ...sidebarStyles, position: 'fixed', top: 0, left: 0, width: 280, height: '100vh', zIndex: 299, overflowY: 'hidden', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)', willChange: 'transform' }}>
        <LogoHeader isMobile onClose={() => setDrawerOpen(false)} collapsed={false} onToggleCollapse={() => {}} />
        <SidebarContent activePage={activePage} setActivePage={setActivePage} onLogout={onLogout} currentUser={currentUser} onNavClick={() => setDrawerOpen(false)} permMap={permMap} />
      </div>
    </>
  )
}

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

function StatCard({ icon, label, value, sub, trend, accent }) {
  const accents = {
    blue:   { bg: '#eff6ff', border: '#1e3a5f', text: '#1e3a5f' },
    green:  { bg: '#dcfce7', border: '#16a34a', text: '#16a34a' },
    amber:  { bg: '#fef9c3', border: '#b45309', text: '#b45309' },
    purple: { bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed' },
    pink:   { bg: '#fce7f3', border: '#db2777', text: '#db2777' },
    cyan:   { bg: '#e0f2fe', border: '#0891b2', text: '#0891b2' },
    teal:   { bg: '#ccfbf1', border: '#0d9488', text: '#0d9488' },
    orange: { bg: '#ffedd5', border: '#ea580c', text: '#ea580c' },
    indigo: { bg: '#e0e7ff', border: '#4f46e5', text: '#4f46e5' },
  }
  const c = accents[accent] || accents.blue
  return (
    <div style={{ background: c.bg, borderRadius: 10, padding: '11px 14px', borderLeft: `3px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 2, transition: 'transform .15s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <p style={{ fontSize: 10, color: c.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.1 }}>{value}</h2>
      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{sub}</p>
      {trend !== undefined && (
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 3, background: '#fff', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${trend}%`, height: '100%', background: c.border, borderRadius: 99 }} /></div>
          <p style={{ fontSize: 9, color: c.text, marginTop: 2 }}>{trend}% of target</p>
        </div>
      )}
    </div>
  )
}

function AccessDenied() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
      <h2 style={{ color: '#dc2626' }}>Access Denied</h2>
      <p>You don't have permission to view this module.</p>
    </div>
  )
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      if (!s) return null
      const p = JSON.parse(s)
      if (p.expiry < Date.now()) { localStorage.removeItem('gnsi_session'); return null }
      return p.user
    } catch { return null }
  })
  const [active,           setActive]           = useState(() => {
    // Public, unauthenticated pages must resolve correctly on a cold page
    // load (no prior in-app navigation) — e.g. a QR code, a shared link, or
    // a Chromecast/Android TV opening this URL directly via the
    // Presentation API for cast-receiver. Everything else still defaults
    // to 'dashboard' and is reached via in-app setActive(...) calls only.
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '')
    const publicPages = ['student-leave', 'verify', 'cast-receiver']
    return publicPages.includes(path) ? path : 'dashboard'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => LS.get('gnsi_sidebar_collapsed', false))
  const [showLogin,        setShowLogin]        = useState(false)
  const [permMap,          setPermMap]          = useState({})
  const [permLoading,      setPermLoading]      = useState(false)
  const isMobile = useIsMobile()
  const [sharedStaff, setSharedStaff] = useState([])
  // FIX 1: unified admin check
  const isAdmin = isAdminRole(currentUser?.role)

  // Background cross-module mismatch scan — runs hourly while any admin
  // has the portal open, independent of which tab they're viewing. Only
  // pushes a notification for NEWLY detected issues (mismatchLog.js
  // dedupes against student_mismatch_log), so this can't spam admins by
  // re-flagging something already open from a previous scan. See
  // mismatchScanner.js / mismatchDetector.js / mismatchLog.js.
  useMismatchAutoScan({ enabled: !!currentUser && isAdmin, intervalMinutes: 60 })

  useEffect(() => { LS.set('gnsi_sidebar_collapsed', sidebarCollapsed) }, [sidebarCollapsed])

  const sidebarW = isMobile ? 0 : (sidebarCollapsed ? SIDEBAR_MINI : SIDEBAR_FULL)

  const fetchSharedStaff = useCallback(async () => {
    const columns = isAdmin ? '*' : 'id, name, designation, department, role, phone, joining_date, status'
    const { data } = await supabase.from('staff_profiles').select(columns).order('name')
    if (data) setSharedStaff(data)
  }, [currentUser?.role])

  useEffect(() => { if (currentUser) fetchSharedStaff() }, [currentUser])

  const loadPermissions = async (role) => {
    if (isAdminRole(role)) { setPermMap({}); return }
    setPermLoading(true)
    const { data } = await supabase.from('role_permissions').select('module_key, allowed, can_read, can_add, can_edit, can_delete').eq('role', role)
    setPermMap(buildPermMap(data))
    setPermLoading(false)
  }

  const handleLogin = async (user) => {
    // FIX 2: clear lockout on successful login
    clearLoginAttempts()
    // The hardcoded VITE_ADMIN_USERNAME login (see Login.jsx) has id:
    // 'admin' — a literal string, not a real portal_users row id — and
    // already resolves its own staff_profile_id before calling onLogin.
    // Re-querying portal_users by that fake id here would always return
    // no row and silently overwrite a real staff_profile_id back to null,
    // which is exactly what was happening: this line clobbered the fix
    // in Login.jsx on every single login. Only do the portal_users
    // lookup for real numeric-id logins that didn't already resolve one.
    let staffProfileId = user.staff_profile_id ?? null
    if (staffProfileId == null && typeof user.id === 'number') {
      const { data } = await supabase.from('portal_users').select('staff_profile_id').eq('id', user.id).maybeSingle()
      staffProfileId = data?.staff_profile_id ?? null
    }
    const enriched = { ...user, staff_profile_id: staffProfileId }
    localStorage.setItem('gnsi_session', JSON.stringify({ user: enriched, expiry: Date.now() + 8*60*60*1000 }))
    setCurrentUser(enriched); setActive('dashboard'); loadPermissions(user.role)
  }

  const handleLogout = () => {
    localStorage.removeItem('gnsi_session')
    setCurrentUser(null); setActive('dashboard'); setPermMap({})
  }

  useEffect(() => { if (currentUser) loadPermissions(currentUser.role) }, [currentUser])

  useEffect(() => {
    if (currentUser) {
      crossModuleSync.init()
      return () => crossModuleSync.destroy()
    }
  }, [currentUser])

  useEffect(() => { window.history.pushState({ page: active }, '', window.location.href) }, [active])

  useEffect(() => {
    const handleBack = (e) => {
      if (e.state?.page && e.state.page !== active) {
        setActive(e.state.page)
        window.history.pushState({ page: e.state.page }, '', window.location.href)
      } else {
        window.history.pushState(null, '', window.location.href)
      }
    }
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [active])

  // These pages are intentionally public and must render even with no
  // logged-in session — e.g. a QR code (verify), a student self-service
  // link (student-leave), or a Chromecast/Android TV opening this URL cold
  // via the Presentation API (cast-receiver). They must be checked before
  // the login gate below, or a logged-out visitor/device just gets bounced
  // to the landing page instead.
  if (active === 'student-leave') return <StudentSelfService />
  if (active === 'verify')        return <GatePassVerifyPage />
  if (active === 'cast-receiver') return <CastReceiver />

  if (!currentUser) {
    if (showLogin) return <Login onLogin={(user) => { setShowLogin(false); handleLogin(user) }} onLoginFailed={recordLoginAttempt} loginLock={checkLoginLock()} />
    return <LandingPage onLogin={() => setShowLogin(true)} />
  }
  if (permLoading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading permissions…</div>

  // FIX 1: use unified isAdminRole in canAccess
  const canAccess = (key) => {
    if (key === 'dashboard') return true
    // Face Attendance check-in must be reachable by any staff member with a
    // linked profile, not gated by the permission matrix like admin tools —
    // the component itself only exposes enrollment management to admins.
    if (key === 'faceattendance') return canSeeFaceAttendance(currentUser, isAdmin)
    if (isAdmin) return true
    return permMap[key]?.read === true
  }
  const perms = (key) => getModulePerms(permMap, key, isAdmin)

  const moduleMap = {
    students:          <Students          currentUser={currentUser} perms={perms('students')}          />,
    admissions:        <Admissions        currentUser={currentUser} perms={perms('admissions')}        />,
    // FIX: sessions/admissionsessions — admin only explicitly
    sessions:          isAdmin ? <Sessions          currentUser={currentUser} perms={perms('sessions')}          /> : <AccessDenied />,
    admissionsessions: isAdmin ? <AdmissionSessions currentUser={currentUser} perms={perms('admissionsessions')} /> : <AccessDenied />,
    bulkadmission:     <BulkAdmission     currentUser={currentUser} perms={perms('bulkadmission')}     />,
    fees:              <Fees              currentUser={currentUser} perms={perms('fees')}              />,
    accounts:          <Accounts          role={currentUser.role?.toLowerCase()} perms={perms('accounts')} />,
    salary:            <Salary            currentUser={currentUser} perms={perms('salary')} staff={sharedStaff} onStaffChange={fetchSharedStaff} />,
    staff:             <Staff             currentUser={currentUser} perms={perms('staff')}  staff={sharedStaff} onStaffChange={fetchSharedStaff} />,
    hr:                <HR                currentUser={currentUser} perms={perms('hr')} staff={sharedStaff} />,
    leave:             <Leave             currentUser={currentUser} perms={perms('leave')}             />,
    hostel:            <Hostel            currentUser={currentUser} perms={perms('hostel')}            />,
    awards:            <Awards            currentUser={currentUser} perms={perms('awards')}            />,
    faceattendance:    <FaceAttendance currentUser={currentUser} isAdmin={isAdmin} staff={sharedStaff}
                          loggedInStaff={currentUser?.staff_profile_id ? sharedStaff.find(s => s.id === currentUser.staff_profile_id) || null : null}
                          onNavigate={setActive} onLogout={handleLogout} />,
    reception:         <Reception         currentUser={currentUser} perms={perms('reception')}         />,
    notice:            <Notice            currentUser={currentUser} perms={perms('notice')}            />,
    social:            <Social            currentUser={currentUser} perms={perms('social')}            />,
    questionbank:      <QuestionBank      currentUser={currentUser} perms={perms('questionbank')} onNavigate={setActive} />,
    questionbankviewer:<QuestionBankViewer currentUser={currentUser} onNavigate={setActive} />,
    studymaterial:     <StudyMaterial     currentUser={currentUser} perms={perms('studymaterial')} onNavigate={setActive} />,
    teachingaids:      <TeachingAids      currentUser={currentUser} perms={perms('teachingaids')}  />,
    studylockers:      <StudyLockers      currentUser={currentUser} perms={perms('studylockers')}  onNavigate={setActive} />,
    connect:           <Connect           currentUser={currentUser} perms={perms('connect')}           />,
    website:           <WebsiteTab        />,
    reports:           <Reports           currentUser={currentUser} perms={perms('reports')}           />,
    checklist:         <Checklist         currentUser={currentUser} perms={perms('checklist')}         />,
    system:            <SystemSettings    currentUser={currentUser} perms={perms('system')}            />,
    studentfeeledger:  <StudentFeeLedger  currentUser={currentUser} perms={perms('studentfeeledger')}  />,
    // FIX: removed feeledger duplicate alias
    courses:           <Courses           currentUser={currentUser} perms={perms('courses')}           />,
    teaching:          <Teaching          currentUser={currentUser} perms={perms('teaching')}          />,
    attendance:        <Attendance        currentUser={currentUser} isAdmin={isAdmin} perms={perms('attendance')} />,
    exams:             <Exams             currentUser={currentUser} perms={perms('exams')}             />,
    timetable:         <Timetable         currentUser={currentUser} perms={perms('timetable')}         />,
    // FIX: feesetup now admin-only explicitly (was hidden but reachable)
    feesetup:          isAdmin ? <FeeSetup userRole={currentUser.role} perms={perms('feesetup')} /> : <AccessDenied />,
    kitchen:           <Kitchen           currentUser={currentUser} perms={perms('kitchen')}           />,
    entrance:          <Entrance          currentUser={currentUser} perms={perms('entrance')}          />,
    // FIX: invitation now uses permission system, not hardcoded Manager bypass
    invitation:        canAccess('invitation') ? <InvitationGenerator currentUser={currentUser} /> : <AccessDenied />,
    admin:             isAdmin ? <AdminPage currentUser={currentUser} onLogout={handleLogout} allStaff={sharedStaff} /> : <AccessDenied />,
    student360:        isAdmin ? <Student360        currentUser={currentUser} isAdmin={isAdmin} onNavigate={setActive} /> : <AccessDenied />,
    adminlink:         isAdmin ? <AdminLinkStaff /> : <AccessDenied />,
    certificate:       <CertificateGenerator currentUser={currentUser} perms={perms('certificate')} />,
  }

  const renderContent = () => {
    // FIX 3: student-leave is public by design (student self-service portal)
    // verify is public by design (gate pass QR verification)
    // Both are intentionally unauthenticated — documented here
    if (active === 'student-leave') return <StudentSelfService />
    if (active === 'verify')        return <GatePassVerifyPage />
    if (active === 'cast-receiver') return <CastReceiver />
    if (active === 'dashboard') return isAdmin
      ? <GNSIDashboard onNavigate={setActive} currentUser={currentUser} />
      : <UserDashboard onNavigate={setActive} currentUser={currentUser} />
    if (!canAccess(active)) return <AccessDenied />
    return moduleMap[active] || (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <h2 style={{ color: '#1e3a5f' }}>Module coming soon</h2>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar
        activePage={active}
        setActivePage={setActive}
        onLogout={handleLogout}
        currentUser={currentUser}
        permMap={permMap}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(p => !p)}
      />
      {!isMobile && (
        <div style={{ position: 'fixed', top: 0, right: 0, left: sidebarW, height: 48, background: '#021e2e', borderBottom: '1px solid #1a3347', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 99, transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
          <span style={{ fontSize: 12, color: '#4a6b82', fontFamily: 'monospace' }}>
            {ALL_ITEMS.find(i => i.id === active)?.icon}{' '}{ALL_ITEMS.find(i => i.id === active)?.label || 'Dashboard'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#94afc4' }}>{currentUser?.name}</span>
            <button onClick={handleLogout} style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#fca5a5', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,.22)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,.12)'}>🚪 Sign Out</button>
          </div>
        </div>
      )}
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh', paddingLeft: isMobile ? 0 : sidebarW, paddingTop: isMobile ? 56 : 48, transition: 'padding-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        {renderContent()}
      </main>
    </div>
  )
}

// Minimal UserDashboard (unchanged from original)
function UserDashboard({ onNavigate, currentUser }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: '0 0 16px' }}>👤 Welcome, {currentUser?.name}</h1>
    </div>
  )
}
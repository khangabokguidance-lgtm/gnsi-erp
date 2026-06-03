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
import Entrance from './Entrance'
import { LOGO_BASE64 } from './logo'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { crossModuleSync } from './CrossModuleSync'
import LandingPage from './LandingPage'
import { StudentSelfService, GatePassVerifyPage } from './LeaveTab'
import AdminLinkStaff from './AdminLinkStaff'


const ALL_GROUPS = [
  {
    group: 'CORE',
    items: [
      { id: 'dashboard',      label: 'Dashboard',      icon: '⊞' },
      { id: 'students',       label: 'Students',        icon: '🎓' },
      { id: 'admissions',     label: 'Admissions',      icon: '📋' },
      { id: 'bulkadmission',  label: 'Bulk Admission',  icon: '📥' },
    ],
  },
  {
    group: 'FINANCE',
    items: [
      { id: 'fees',             label: 'Fees',               icon: '💰' },
      { id: 'accounts',         label: 'Accounts',           icon: '🧾' },
      { id: 'salary',           label: 'Salary',             icon: '💵' },
      { id: 'studentfeeledger', label: 'Student Fee Ledger', icon: '📒' },
    ],
  },
  {
    group: 'ACADEMIC',
    items: [
      { id: 'attendance',   label: 'Attendance',    icon: '📅' },
      { id: 'exams',        label: 'Exams',         icon: '📝' },
      { id: 'timetable',    label: 'Timetable',     icon: '🕐' },
      { id: 'teaching',     label: 'Teaching',      icon: '📚' },
      { id: 'courses',      label: 'Courses',       icon: '🎓' },
      { id: 'questionbank', label: 'Question Bank', icon: '❓' },
      { id: 'entrance',     label: 'Entrance Exam', icon: '🏆' },
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
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { id: 'reception', label: 'Reception', icon: '🛎️' },
      { id: 'notice',    label: 'Notice',    icon: '🔔' },
      { id: 'social',    label: 'Social',    icon: '📣' },
      { id: 'connect',   label: 'Connect',   icon: '🔗' },
    ],
  },
  {
    group: 'MANAGEMENT',
    items: [
      { id: 'reports',   label: 'Reports',   icon: '📊' },
      { id: 'checklist', label: 'Checklist', icon: '✅' },
      { id: 'admin',     label: 'Admin',     icon: '🔐' },
      { id: 'system',    label: 'System',    icon: '⚙️' },
      { id: 'adminlink', label: 'Link Staff', icon: '🔗' },
    ],
  },
]

const ALL_ITEMS = ALL_GROUPS.flatMap(g => g.items)

const BADGES = {
  fees:   { count: 3, color: '#fcd34d', bg: '#78350f' },
  leave:  { count: 2, color: '#fcd34d', bg: '#78350f' },
  notice: { count: 5, color: '#fcd34d', bg: '#78350f' },
}

const FULL_CRUD = { read: true, add: true, edit: true, delete: true }
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
  logoBg:       '#fdd656',
}

const LS = {
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } },
  set: (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

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

function LogoHeader({ isMobile, onClose }) {
  return (
    <div style={{ padding: '0 14px', height: 60, display: 'flex', alignItems: 'center', gap: 11, borderBottom: `1px solid ${D.border}`, flexShrink: 0, background: `linear-gradient(90deg, ${D.bgDeep} 0%, ${D.bg} 100%)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 14, right: 14, height: 1, background: `linear-gradient(90deg, ${D.accent}44, transparent)` }} />
      <img src={`data:image/png;base64,${LOGO_BASE64}`} alt="GNSI" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: D.textPrimary, letterSpacing: '-.01em', lineHeight: 1.1, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>GNSI <span style={{ color: D.accent }}>ERP</span></div>
        <div style={{ fontSize: 9.5, color: D.textFaint, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2, fontFamily: "'Trebuchet MS', monospace" }}>School Management</div>
      </div>
      {isMobile && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.border}`, borderRadius: 6, cursor: 'pointer', color: D.textMuted, fontSize: 14, lineHeight: 1, padding: '5px 8px' }} aria-label="Close menu">✕</button>}
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
  const isAdmin = role === 'Admin'

  const allowedModules = useMemo(() => {
    if (isAdmin) return new Set(ALL_ITEMS.map(i => i.id))
    const set = new Set(['dashboard'])
    Object.entries(permMap).forEach(([key, crud]) => { if (crud.read) set.add(key) })
    return set
  }, [permMap, isAdmin])

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
    return ALL_GROUPS.map(g => ({ ...g, items: g.items.filter(i => allowedModules.has(i.id) && !pins.includes(i.id) && (!q || i.label.toLowerCase().includes(q))) })).filter(g => g.items.length > 0)
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
          {search ? <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button> : <span style={{ fontSize: 10, color: D.textFaint, background: 'rgba(255,255,255,0.07)', border: `1px solid ${D.border}`, borderRadius: 4, padding: '2px 5px', fontFamily: 'monospace', letterSpacing: '0.05em', flexShrink: 0 }}>/</span>}
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
          <span style={{ fontSize: 10, color: D.textFaint }}>v2.1 · © {new Date().getFullYear()} GNSI</span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>
    </>
  )
}

function Sidebar({ activePage, setActivePage, onLogout, currentUser, permMap }) {
  const isMobile    = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)

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
    return (
      <div style={{ ...sidebarStyles, width: 262, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100 }}>
        <LogoHeader isMobile={false} />
        <SidebarContent activePage={activePage} setActivePage={setActivePage} onLogout={onLogout} currentUser={currentUser} permMap={permMap} />
      </div>
    )
  }

  return (
    <>
      {/* ── Mobile top bar with logout button ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: D.bg, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', zIndex: 200, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, padding: 4, position: 'relative', flexShrink: 0 }}>
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
        {/* ── Logout button in mobile header ── */}
        <button
          onClick={onLogout}
          title="Sign Out"
          style={{
            background: 'rgba(220,38,38,.12)',
            border: '1px solid rgba(220,38,38,.25)',
            borderRadius: 8,
            padding: '7px 10px',
            cursor: 'pointer',
            color: '#fca5a5',
            fontSize: 16,
            flexShrink: 0,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >🚪</button>
      </div>

      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 298, backdropFilter: 'blur(3px)' }} />}
      <div style={{ ...sidebarStyles, position: 'fixed', top: 0, left: 0, width: 280, height: '100vh', zIndex: 299, overflowY: 'hidden', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)', willChange: 'transform' }}>
        <LogoHeader isMobile onClose={() => setDrawerOpen(false)} />
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

function TableCard({ title, sub, cols, rows, emptyMsg }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ background: '#f8fafc' }}>{cols.map(c => <th key={c} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 10, whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={cols.length} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{emptyMsg || 'No data'}</td></tr> : rows}</tbody>
        </table>
      </div>
    </div>
  )
}

function BadgeStatus({ status }) {
  const map = { Approved: { bg: '#dcfce7', color: '#16a34a' }, Rejected: { bg: '#fee2e2', color: '#dc2626' }, Pending: { bg: '#fef9c3', color: '#b45309' } }
  const s = map[status] || { bg: '#f1f5f9', color: '#64748b' }
  return <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>
}

function Ring({ value, max, color, label, size = 64 }) {
  const r = 30, circ = 2 * Math.PI * r, p = max ? Math.min(value / max, 1) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${p * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 40 40)" />
        <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{Math.round(p * 100)}%</text>
      </svg>
      <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function AdminDashboard({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const [students, fees, attendance, admissions, exams, staff, recentStudents, recentAdmissions, salary, leave] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('fees').select('amount,paid'),
        supabase.from('attendance').select('status'),
        supabase.from('admissions').select('*'),
        supabase.from('exams').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('id,name,class_name,course,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('admissions').select('id,name,class_name,status,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('salary').select('amount,status'),
        supabase.from('leave').select('status'),
      ])
      let feeCollected = 0, feePending = 0
      ;(fees.data || []).forEach(f => { feeCollected += Number(f.paid || 0); feePending += Number(f.amount || 0) - Number(f.paid || 0) })
      let salaryPaid = 0, salaryPending = 0
      ;(salary.data || []).forEach(s => { if (s.status === 'Paid') salaryPaid += Number(s.amount || 0); else salaryPending += Number(s.amount || 0) })
      setData({ totalStudents: students.count ?? 0, totalStaff: staff.count ?? 0, totalExams: exams.count ?? 0, feeCollected, feePending, presentCount: (attendance.data || []).filter(a => a.status === 'Present').length, totalAtt: (attendance.data || []).length, pendingAdm: (admissions.data || []).filter(a => a.status === 'Pending').length, approvedAdm: (admissions.data || []).filter(a => a.status === 'Approved').length, totalAdm: (admissions.data || []).length, salaryPaid, salaryPending, pendingLeave: (leave.data || []).filter(l => l.status === 'Pending').length, recentStudents: recentStudents.data || [], recentAdmissions: recentAdmissions.data || [] })
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading live data…</div>
  if (!data) return null
  const feeTotal = data.feeCollected + data.feePending
  const feeProgress = feeTotal ? Math.round((data.feeCollected / feeTotal) * 100) : 0
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>🏠 Admin Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={load} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>🔄 Refresh</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { icon: '👨‍🎓', label: 'Total Students', value: data.totalStudents,    sub: 'Enrolled',            accent: 'blue'   },
          { icon: '💰',   label: 'Fee Collected',  value: fmt(data.feeCollected), sub: 'Total paid',          accent: 'green',  trend: feeProgress },
          { icon: '⏳',   label: 'Fee Pending',    value: fmt(data.feePending),   sub: 'Outstanding',         accent: 'amber'  },
          { icon: '🏫',   label: 'Present Today',  value: data.presentCount,      sub: `of ${data.totalAtt}`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
          { icon: '📋',   label: 'New Admissions', value: data.pendingAdm,        sub: 'Awaiting',            accent: 'pink'   },
          { icon: '📝',   label: 'Total Exams',    value: data.totalExams,        sub: 'Scheduled',           accent: 'cyan'   },
          { icon: '👨‍🏫', label: 'Total Staff',    value: data.totalStaff,        sub: 'Active',              accent: 'teal'   },
          { icon: '💵',   label: 'Salary Paid',    value: fmt(data.salaryPaid),   sub: 'This month',          accent: 'indigo' },
          { icon: '🏖️',  label: 'Leave Requests', value: data.pendingLeave,      sub: 'Pending',             accent: 'orange' },
        ].map(c => <StatCard key={c.label} {...c} />)}
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', padding: '12px 16px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '0 0 12px' }}>📊 Live Progress</h3>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 }}>
          <Ring value={data.feeCollected} max={feeTotal || 1}                                    color="#16a34a" label="Fee Collected" />
          <Ring value={data.presentCount} max={Math.max(data.totalAtt, 1)}                       color="#7c3aed" label="Attendance"    />
          <Ring value={data.approvedAdm}  max={Math.max(data.totalAdm, 1)}                       color="#0891b2" label="Admissions"    />
          <Ring value={data.salaryPaid}   max={Math.max(data.salaryPaid + data.salaryPending, 1)} color="#4f46e5" label="Salary"       />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
        <TableCard title="👨‍🎓 Recent Students"   sub="Last 6" cols={['Name','Class','Course']} emptyMsg="No students"   rows={data.recentStudents.map(s   => <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{s.name}</td><td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{s.class_name}</td><td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{s.course || '—'}</td></tr>)} />
        <TableCard title="📋 Recent Admissions" sub="Last 6" cols={['Name','Class','Status']} emptyMsg="No admissions" rows={data.recentAdmissions.map(a => <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{a.name}</td><td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{a.class_name}</td><td style={{ padding: '6px 12px' }}><BadgeStatus status={a.status} /></td></tr>)} />
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', padding: '12px 16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '0 0 10px' }}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: '➕ Add Student',    color: '#1e3a5f', module: 'students'     },
            { label: '📋 New Admission',  color: '#7c3aed', module: 'admissions'   },
            { label: '💵 Record Fee',     color: '#16a34a', module: 'fees'         },
            { label: '📚 Teaching Log',   color: '#0891b2', module: 'teaching'     },
            { label: '📅 Attendance',     color: '#db2777', module: 'attendance'   },
            { label: '📝 Exams',          color: '#16a34a', module: 'exams'        },
            { label: '🏖️ Approve Leave', color: '#b45309', module: 'leave'        },
            { label: '🔔 Send Notice',    color: '#ea580c', module: 'notice'       },
            { label: '❓ Question Bank',  color: '#7c3aed', module: 'questionbank' },
            { label: '📈 Reports',        color: '#4f46e5', module: 'reports'      },
          ].map(a => (
            <button key={a.label} onClick={() => onNavigate(a.module)} style={{ background: a.color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function UserDashboard({ onNavigate, currentUser }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const [attendance, exams, fees, leave, notices] = await Promise.all([
        supabase.from('attendance').select('status,date').order('date', { ascending: false }).limit(30),
        supabase.from('exams').select('*').order('date', { ascending: true }).limit(5),
        supabase.from('fees').select('amount,paid,due_date').order('due_date', { ascending: true }).limit(5),
        supabase.from('leave').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(4),
      ])
      const att = attendance.data || []
      let feePaid = 0, feeDue = 0
      ;(fees.data || []).forEach(f => { feePaid += Number(f.paid || 0); feeDue += Number(f.amount || 0) - Number(f.paid || 0) })
      setData({ presentCount: att.filter(a => a.status === 'Present').length, totalAtt: att.length, upcomingExams: exams.data || [], feePaid, feeDue, leaveRequests: leave.data || [], pendingLeave: (leave.data || []).filter(l => l.status === 'Pending').length, notices: notices.data || [] })
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading…</div>
  if (!data) return null
  return (
    <div style={{ padding: '16px 20px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: '0 0 16px' }}>👤 Welcome, {currentUser.name}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { icon: '📅', label: 'Days Present',  value: data.presentCount,         sub: `of ${data.totalAtt}`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
          { icon: '💰', label: 'Fee Due',        value: fmt(data.feeDue),          sub: 'Outstanding',         accent: 'amber'  },
          { icon: '✅', label: 'Fee Paid',       value: fmt(data.feePaid),         sub: 'Paid so far',         accent: 'green'  },
          { icon: '📝', label: 'Upcoming Exams', value: data.upcomingExams.length, sub: 'Scheduled',           accent: 'cyan'   },
          { icon: '🏖️',label: 'Leave Pending',  value: data.pendingLeave,         sub: 'Awaiting',            accent: 'orange' },
          { icon: '🔔', label: 'Notices',        value: data.notices.length,       sub: 'Recent',              accent: 'pink'   },
        ].map(c => <StatCard key={c.label} {...c} />)}
      </div>
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
  const [active,      setActive]      = useState('dashboard')
  const [showLogin, setShowLogin] = useState(false)
  const [permMap,     setPermMap]     = useState({})
  const [permLoading, setPermLoading] = useState(false)
  const isMobile = useIsMobile()
  const [sharedStaff, setSharedStaff] = useState([])
const fetchSharedStaff = useCallback(async () => {
  const { data } = await supabase.from('staff_profiles').select('*').order('name')
  if (data) setSharedStaff(data)
}, [])
useEffect(() => { if (currentUser) fetchSharedStaff() }, [currentUser])

  const loadPermissions = async (role) => {
    if (role === 'Admin') { setPermMap({}); return }
    setPermLoading(true)
    const { data } = await supabase.from('role_permissions').select('module_key, allowed, can_read, can_add, can_edit, can_delete').eq('role', role)
    setPermMap(buildPermMap(data))
    setPermLoading(false)
  }

  const handleLogin = async (user) => {
  // fetch fresh staff_profile_id from DB
  const { data } = await supabase
    .from('portal_users')
    .select('staff_profile_id')
    .eq('id', user.id)
    .maybeSingle()
  const enriched = { ...user, staff_profile_id: data?.staff_profile_id ?? null }
  localStorage.setItem('gnsi_session', JSON.stringify({ user: enriched, expiry: Date.now() + 8*60*60*1000 }))
  setCurrentUser(enriched); setActive('dashboard'); loadPermissions(user.role)
}
  const handleLogout = () => {
  localStorage.removeItem('gnsi_session')
  setCurrentUser(null); setActive('dashboard'); setPermMap({})
}
useEffect(() => {
  if (currentUser) loadPermissions(currentUser.role)
}, [currentUser])

useEffect(() => {
  if (currentUser) {
    crossModuleSync.init()
    return () => crossModuleSync.destroy()
  }
}, [currentUser])
useEffect(() => {
  window.history.pushState({ page: active }, '', window.location.href)
}, [active])

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

if (!currentUser) {
  if (showLogin) return <Login onLogin={(user) => { setShowLogin(false); handleLogin(user) }} />
  return <LandingPage onLogin={() => setShowLogin(true)} />
}
  if (permLoading)  return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading permissions…</div>

  const isAdmin = currentUser.role === 'Admin'
  const canAccess = (key) => { if (key === 'dashboard') return true; if (isAdmin) return true; return permMap[key]?.read === true }
  const perms = (key) => getModulePerms(permMap, key, isAdmin)

  const moduleMap = {
  students:          <Students          currentUser={currentUser} perms={perms('students')}         />,
  admissions:        <Admissions        currentUser={currentUser} perms={perms('admissions')}       />,
  sessions:          <Sessions          currentUser={currentUser} perms={perms('sessions')}         />,
  admissionsessions: <AdmissionSessions currentUser={currentUser} perms={perms('admissionsessions')}/>,
  bulkadmission:     <BulkAdmission     currentUser={currentUser} perms={perms('bulkadmission')}    />,
  fees:              <Fees              currentUser={currentUser} perms={perms('fees')}             />,
  accounts:          <Accounts          role={currentUser.role?.toLowerCase()} perms={perms('accounts')} />,
  salary:            <Salary            currentUser={currentUser} perms={perms('salary')} staff={sharedStaff} onStaffChange={fetchSharedStaff} />,
  staff:             <Staff             currentUser={currentUser} perms={perms('staff')}  staff={sharedStaff} onStaffChange={fetchSharedStaff} />,
  hr:                <HR                currentUser={currentUser} perms={perms('hr')} staff={sharedStaff} />,
  leave:             <Leave             currentUser={currentUser} perms={perms('leave')}            />,
  hostel:            <Hostel            currentUser={currentUser} perms={perms('hostel')}           />,
  reception:         <Reception         currentUser={currentUser} perms={perms('reception')}        />,
  notice:            <Notice            currentUser={currentUser} perms={perms('notice')}           />,
  social:            <Social            currentUser={currentUser} perms={perms('social')}           />,
  questionbank:      <QuestionBank      currentUser={currentUser} perms={perms('questionbank')}     />,
  connect:           <Connect           currentUser={currentUser} perms={perms('connect')}          />,
  reports:           <Reports           currentUser={currentUser} perms={perms('reports')}          />,
  checklist:         <Checklist         currentUser={currentUser} perms={perms('checklist')}        />,
  system:            <SystemSettings    currentUser={currentUser} perms={perms('system')}           />,
  studentfeeledger:  <StudentFeeLedger  currentUser={currentUser} perms={perms('studentfeeledger')} />,
  feeledger:         <StudentFeeLedger  currentUser={currentUser} perms={perms('feeledger')}        />,
  courses:           <Courses           currentUser={currentUser} perms={perms('courses')}          />,
  teaching:          <Teaching          currentUser={currentUser} perms={perms('teaching')}         />,
  attendance:        <Attendance        currentUser={currentUser} isAdmin={isAdmin} perms={perms('attendance')} />,
  exams:             <Exams             currentUser={currentUser} perms={perms('exams')}            />,
  timetable:         <Timetable         currentUser={currentUser} perms={perms('timetable')}        />,
  feesetup:          <FeeSetup          userRole={currentUser.role} perms={perms('feesetup')}       />,
  kitchen:           <Kitchen           currentUser={currentUser} perms={perms('kitchen')}          />,
  admin: isAdmin ? <AdminPage currentUser={currentUser} onLogout={handleLogout} allStaff={sharedStaff} /> : <AccessDenied />,
  adminlink:         isAdmin ? <AdminLinkStaff /> : <AccessDenied />,
  entrance:          <Entrance          currentUser={currentUser} perms={perms('entrance')}         />,
}

  const renderContent = () => {
  if (active === 'student-leave') return <StudentSelfService />
  if (active === 'verify')        return <GatePassVerifyPage />
  
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
      <Sidebar activePage={active} setActivePage={setActive} onLogout={handleLogout} currentUser={currentUser} permMap={permMap} />

      {/* Desktop top bar */}
      {!isMobile && (
        <div style={{ position: 'fixed', top: 0, left: 262, right: 0, height: 48, background: '#021e2e', borderBottom: '1px solid #1a3347', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 99 }}>
          <span style={{ fontSize: 12, color: '#4a6b82', fontFamily: 'monospace' }}>
            {ALL_ITEMS.find(i => i.id === active)?.icon}{' '}{ALL_ITEMS.find(i => i.id === active)?.label || 'Dashboard'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#94afc4' }}>{currentUser?.name}</span>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#fca5a5', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,.12)'}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh', paddingLeft: isMobile ? 0 : 262, paddingTop: isMobile ? 56 : 48 }}>
        {renderContent()}
      </main>
    </div>
  )
}

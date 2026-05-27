import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from './lib/Supabase'

// ─── Data ────────────────────────────────────────────────────────────────────

const ALL_GROUPS = [
  {
    group: 'CORE',
    icon: '◈',
    items: [
      { id: 'dashboard',          label: 'Dashboard',       icon: '⊞' },
      { id: 'students',           label: 'Students',        icon: '🎓' },
      { id: 'admissions',         label: 'Admissions',      icon: '📋' },
      { id: 'bulk-admission-fee', label: 'Bulk Admission',  icon: '📥' },
    ],
  },
  {
    group: 'FINANCE',
    icon: '◈',
    items: [
      { id: 'fees',             label: 'Fees',               icon: '💰' },
      { id: 'accounts',         label: 'Accounts',           icon: '🧾' },
      { id: 'salary',           label: 'Salary',             icon: '💵' },
      { id: 'studentfeeledger', label: 'Student Fee Ledger', icon: '📒' },
    ],
  },
  {
    group: 'ACADEMIC',
    icon: '◈',
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
    icon: '◈',
    items: [
      { id: 'staff',  label: 'Staff',  icon: '👨‍🏫' },
      { id: 'hr',     label: 'HR',     icon: '🗂️' },
      { id: 'leave',  label: 'Leave',  icon: '🏖️' },
      { id: 'hostel', label: 'Hostel', icon: '🏨' },
    ],
  },
  {
    group: 'OPERATIONS',
    icon: '◈',
    items: [
      { id: 'kitchen',   label: 'Kitchen',   icon: '🍽️' },
      { id: 'reception', label: 'Reception', icon: '🛎️' },
      { id: 'notice',    label: 'Notice',    icon: '🔔' },
      { id: 'social',    label: 'Social',    icon: '📣' },
      { id: 'connect',   label: 'Connect',   icon: '🔗' },
    ],
  },
  {
    group: 'MANAGEMENT',
    icon: '◈',
    items: [
      { id: 'reports',              label: 'Reports',   icon: '📊' },
      { id: 'management-checklist', label: 'Checklist', icon: '✅' },
      { id: 'admin',                label: 'Admin',     icon: '🔐' },
      { id: 'system',               label: 'System',    icon: '⚙️' },
    ],
  },
]

const ALL_ITEMS = ALL_GROUPS.flatMap(g => g.items)

const BADGES = {
  fees:   { count: 3,  color: '#fcd34d', bg: '#78350f' },
  leave:  { count: 2,  color: '#fcd34d', bg: '#78350f' },
  notice: { count: 5,  color: '#fcd34d', bg: '#78350f' },
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const D = {
  bg:            '#03263a',
  bgDeep:        '#021e2e',
  bgSurface:     '#0a1f2e',
  bgHover:       '#0d2840',
  bgActive:      '#0f1e10',
  border:        '#1a3347',
  borderStrong:  '#254560',
  accent:        '#f59e0b',
  accentLight:   '#fbbf24',
  accentGlow:    'rgba(245,158,11,0.12)',
  accentBorder:  'rgba(245,158,11,0.3)',
  textPrimary:   '#f0f4f8',
  textSecondary: '#94afc4',
  textMuted:     '#6b8fa8',
  textFaint:     '#4a6b82',
  green:         '#22c55e',
  logoBg:        '#fdd656',
  pillActive:    '#f59e0b',
  // Mini sidebar width
  miniW:         64,
  fullW:         262,
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const LS = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback } },
  set: (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// ─── Global styles ───────────────────────────────────────────────────────────

const GLOBAL_STYLE = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: translateX(0) } }

  .gnsi-drawer {
    transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .gnsi-tooltip {
    position: fixed;
    left: 72px;
    background: #0a1f2e;
    border: 1px solid rgba(245,158,11,0.35);
    border-radius: 7px;
    padding: 6px 11px;
    font-size: 12.5px;
    font-weight: 600;
    color: #f0f4f8;
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 4px 18px rgba(0,0,0,0.5);
    animation: fadeIn 0.12s ease;
    font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
    letter-spacing: 0.01em;
  }
  .gnsi-tooltip::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 50%;
    transform: translateY(-50%);
    width: 0; height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-right: 5px solid rgba(245,158,11,0.35);
  }

  .gnsi-nav::-webkit-scrollbar { width: 3px; }
  .gnsi-nav::-webkit-scrollbar-track { background: transparent; }
  .gnsi-nav::-webkit-scrollbar-thumb { background: #1a3347; border-radius: 99px; }

  .gnsi-toggle-btn {
    transition: background 0.15s, border-color 0.15s, transform 0.18s !important;
  }
  .gnsi-toggle-btn:hover {
    background: rgba(245,158,11,0.15) !important;
    border-color: rgba(245,158,11,0.4) !important;
  }
  .gnsi-nav-item-btn {
    transition: background 0.1s, border-color 0.1s, color 0.1s !important;
  }
`

// ─── Hooks ───────────────────────────────────────────────────────────────────

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

// ─── Tooltip (for mini mode) ─────────────────────────────────────────────────

function Tooltip({ label, badge, isMobile = false }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (isMobile) return // no hover tooltips on touch
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos(rect.top + rect.height / 2)
  }, [isMobile])

  if (isMobile) return null

  return (
    <span ref={ref} style={{ display: 'contents' }}>
      {pos != null && (
        <span
          className="gnsi-tooltip"
          style={{ top: pos - 14 }}
        >
          {label}
          {badge && (
            <span style={{
              marginLeft: 7,
              fontSize: 10.5, fontWeight: 700,
              padding: '1px 6px', borderRadius: 99,
              background: badge.bg, color: badge.color,
            }}>{badge.count}</span>
          )}
        </span>
      )}
    </span>
  )
}

// ─── MiniNavItem ─────────────────────────────────────────────────────────────

function MiniNavItem({ item, isActive, onClick, isMobile = false }) {
  const [hov, setHov] = useState(false)
  const badge = BADGES[item.id]

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <button
        onClick={onClick}
        className="gnsi-nav-item-btn"
        title=""
        style={{
          width: isMobile ? 52 : 44,
          height: isMobile ? 48 : 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: isMobile ? 3 : 0,
          borderRadius: isMobile ? 12 : 10,
          border: isActive
            ? `1px solid ${D.accentBorder}`
            : `1px solid ${hov ? D.border : 'transparent'}`,
          cursor: 'pointer',
          background: isActive
            ? `linear-gradient(135deg, ${D.bgActive}, rgba(15,30,16,0.8))`
            : hov ? D.bgHover : 'transparent',
          position: 'relative',
          marginBottom: isMobile ? 2 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {isActive && (
          <span style={{
            position: 'absolute', left: 0, top: '50%',
            transform: 'translateY(-50%)',
            width: 3, height: isMobile ? 24 : 20, borderRadius: '0 3px 3px 0',
            background: D.pillActive,
            boxShadow: `0 0 8px ${D.accent}`,
          }} />
        )}
        <span style={{ fontSize: isMobile ? 20 : 16, lineHeight: 1 }}>{item.icon}</span>
        {isMobile && (
          <span style={{
            fontSize: 9, color: isActive ? D.accentLight : D.textFaint,
            fontWeight: isActive ? 700 : 400,
            letterSpacing: '0.02em',
            fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
            maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>{item.label}</span>
        )}
        {badge && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 7, height: 7, borderRadius: '50%',
            background: D.accent,
            border: `1.5px solid ${D.bg}`,
          }} />
        )}
      </button>
      {hov && !isMobile && <Tooltip label={item.label} badge={badge} isMobile={false} />}
    </div>
  )
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ item, isActive, onClick, onPin, isPinned, compact = false, isMobile = false }) {
  const badge   = BADGES[item.id]
  const [hov, setHov] = useState(false)
  const [pinHov, setPinHov] = useState(false)

  const fontSize     = isMobile ? 15.5 : compact ? 12.5 : 13.5
  const iconSize     = isMobile ? 18   : compact ? 13   : 15
  const paddingV     = isMobile ? 11   : compact ? 5    : 7
  const paddingH     = isMobile ? 14   : compact ? 10   : 10
  const paddingLeft  = isMobile ? 16   : compact ? 12   : 14
  const borderRadius = isMobile ? 10   : 8

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPinHov(false) }}
    >
      <button
        onClick={onClick}
        className="gnsi-nav-item-btn"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 8,
          padding: `${paddingV}px ${paddingH}px ${paddingV}px ${paddingLeft}px`,
          borderRadius,
          marginBottom: isMobile ? 2 : 1,
          border: isActive
            ? `1px solid ${D.accentBorder}`
            : `1px solid ${hov ? D.border : 'transparent'}`,
          cursor: 'pointer', textAlign: 'left',
          fontSize, fontWeight: isActive ? 600 : 400,
          background: isActive
            ? `linear-gradient(90deg, ${D.bgActive} 0%, rgba(15,30,16,0.6) 100%)`
            : hov ? D.bgHover : 'transparent',
          color: isActive ? D.accentLight : hov ? D.textPrimary : D.textSecondary,
          position: 'relative',
          fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
          letterSpacing: isActive ? '0.01em' : 0,
          minHeight: isMobile ? 48 : 'auto',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {isActive && (
          <span style={{
            position: 'absolute', left: 0, top: '50%',
            transform: 'translateY(-50%)',
            width: isMobile ? 4 : 3, height: isMobile ? 24 : 20,
            borderRadius: '0 3px 3px 0',
            background: D.pillActive,
            boxShadow: `0 0 8px ${D.accent}`,
          }} />
        )}
        <span style={{
          fontSize: iconSize, lineHeight: 1, flexShrink: 0,
          filter: isActive ? 'none' : hov ? 'none' : 'grayscale(0.3)',
          width: isMobile ? 22 : 'auto', textAlign: 'center',
        }}>
          {item.icon}
        </span>
        <span style={{
          flex: 1, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.label}
        </span>
        {badge && (
          <span style={{
            fontSize: isMobile ? 11.5 : 10, fontWeight: 700,
            padding: isMobile ? '3px 8px' : '2px 6px', borderRadius: 99,
            background: badge.bg, color: badge.color,
            flexShrink: 0, letterSpacing: '0.02em',
          }}>{badge.count}</span>
        )}
        {isPinned && !hov && (
          <span style={{ fontSize: isMobile ? 11 : 9, color: D.accent, flexShrink: 0, opacity: 0.6 }}>📌</span>
        )}
      </button>

      {hov && onPin && !isMobile && (
        <button
          onClick={e => { e.stopPropagation(); onPin(item.id) }}
          onMouseEnter={() => setPinHov(true)}
          onMouseLeave={() => setPinHov(false)}
          title={isPinned ? 'Unpin' : 'Pin to top'}
          style={{
            position: 'absolute', right: 4, top: '50%',
            transform: 'translateY(-50%)',
            background: pinHov ? D.accentGlow : 'transparent',
            border: `1px solid ${pinHov ? D.accentBorder : 'transparent'}`,
            borderRadius: 5, padding: '2px 5px',
            cursor: 'pointer', fontSize: 11,
            color: isPinned ? D.accent : D.textFaint,
            transition: 'all .12s',
          }}
        >
          {isPinned ? '📌' : '📍'}
        </button>
      )}
    </div>
  )
}

// ─── GroupHeader ─────────────────────────────────────────────────────────────

function GroupHeader({ label, collapsed, onToggle, count, isMobile = false }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%',
        padding: isMobile ? '8px 12px 7px 14px' : '5px 10px 4px 12px',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: 'none', cursor: 'pointer', borderRadius: 6,
        transition: 'background .1s',
        marginBottom: isMobile ? 3 : 2,
        minHeight: isMobile ? 36 : 'auto',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        fontSize: isMobile ? 11 : 9.5, fontWeight: 700, letterSpacing: '.11em',
        color: hov ? D.textMuted : D.textFaint, textTransform: 'uppercase',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
        flex: 1, textAlign: 'left', transition: 'color .1s',
      }}>{label}</span>
      {count > 0 && (
        <span style={{
          fontSize: isMobile ? 10.5 : 9, color: D.textFaint,
          background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 99,
        }}>{count}</span>
      )}
      <span style={{
        fontSize: isMobile ? 11 : 9, color: D.textFaint,
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        transition: 'transform .2s', display: 'inline-block',
      }}>▾</span>
    </button>
  )
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

function SectionLabel({ label, isMobile = false }) {
  return (
    <div style={{
      fontSize: isMobile ? 11 : 9.5, fontWeight: 700, letterSpacing: '.11em',
      color: D.textFaint, padding: isMobile ? '6px 14px 6px' : '4px 12px 5px',
      textTransform: 'uppercase',
      fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    }}>{label}</div>
  )
}

// ─── RecentItems ─────────────────────────────────────────────────────────────

function RecentItems({ recents, activePage, onNavigate, isMobile }) {
  if (!recents.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <SectionLabel label="RECENT" isMobile={isMobile} />
      {recents.map(id => {
        const item = ALL_ITEMS.find(i => i.id === id)
        if (!item) return null
        return (
          <NavItem
            key={id} item={item}
            isActive={activePage === id}
            onClick={() => onNavigate(id)}
            compact={!isMobile} isMobile={isMobile}
          />
        )
      })}
    </div>
  )
}

// ─── PinnedItems ─────────────────────────────────────────────────────────────

function PinnedItems({ pins, activePage, onNavigate, onPin, isMobile }) {
  if (!pins.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: isMobile ? 11 : 9.5, fontWeight: 700, letterSpacing: '.11em',
        color: D.accentBorder, padding: isMobile ? '6px 14px 6px' : '4px 12px 5px',
        textTransform: 'uppercase',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}>📌 PINNED</div>
      {pins.map(id => {
        const item = ALL_ITEMS.find(i => i.id === id)
        if (!item) return null
        return (
          <NavItem
            key={id} item={item}
            isActive={activePage === id}
            onClick={() => onNavigate(id)}
            onPin={onPin} isPinned
            compact={!isMobile} isMobile={isMobile}
          />
        )
      })}
    </div>
  )
}

// ─── MiniGroupDivider ─────────────────────────────────────────────────────────

function MiniGroupDivider({ label, isMobile = false }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', margin: '6px 0 4px', width: '100%' }}
    >
      <div style={{
        height: 1, background: D.border,
        margin: '0 10px',
      }} />
      {hov && !isMobile && <Tooltip label={label} isMobile={false} />}
    </div>
  )
}

// ─── MiniSidebarContent ───────────────────────────────────────────────────────

function MiniSidebarContent({ activePage, onNavigate, onLogout, allowedModules, currentUser, isMobile = false }) {
  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'US'

  const [hov, setHov] = useState(false)
  const [avatarHov, setAvatarHov] = useState(false)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      height: '100%', paddingBottom: 12,
    }}>
      {/* Avatar */}
      <div
        onMouseEnter={() => setAvatarHov(true)}
        onMouseLeave={() => setAvatarHov(false)}
        style={{ position: 'relative', margin: isMobile ? '8px 0 4px' : '10px 0 6px' }}
      >
        <div style={{
          width: isMobile ? 44 : 38,
          height: isMobile ? 44 : 38,
          borderRadius: isMobile ? 12 : 10, flexShrink: 0,
          background: avatarHov ? 'rgba(245,158,11,0.2)' : D.accentGlow,
          border: `1.5px solid ${avatarHov ? D.accent : D.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isMobile ? 14 : 12, fontWeight: 700, color: D.accentLight,
          fontFamily: "'Trebuchet MS', monospace",
          cursor: 'default',
          transition: 'border-color 0.15s, background 0.15s',
        }}>{initials}</div>
        {/* Online dot */}
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: isMobile ? 9 : 8, height: isMobile ? 9 : 8, borderRadius: '50%',
          background: D.green,
          border: `1.5px solid ${D.bg}`,
          boxShadow: `0 0 5px ${D.green}`,
        }} />
        {avatarHov && !isMobile && <Tooltip label={currentUser?.name || 'User'} isMobile={false} />}
      </div>

      {/* Nav items */}
      <nav
        className="gnsi-nav"
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          width: '100%',
          padding: isMobile ? '4px 6px 4px' : '4px 10px 4px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          scrollbarWidth: 'thin',
          scrollbarColor: `${D.border} transparent`,
        }}
      >
        {ALL_GROUPS.map((grp, gi) => (
          <div key={grp.group} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {gi > 0 && <MiniGroupDivider label={grp.group} isMobile={isMobile} />}
            {grp.items
              .filter(i => allowedModules?.has(i.id))
              .map(item => (
                <MiniNavItem
                  key={item.id}
                  item={item}
                  isActive={activePage === item.id}
                  onClick={() => onNavigate(item.id)}
                  isMobile={isMobile}
                />
              ))
            }
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ position: 'relative', marginTop: 4 }}
      >
        <button
          onClick={onLogout}
          style={{
            width: isMobile ? 52 : 44,
            height: isMobile ? 48 : 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 3 : 0,
            borderRadius: isMobile ? 12 : 10,
            border: `1px solid ${hov ? D.accentBorder : D.border}`,
            cursor: 'pointer',
            background: hov ? D.accentGlow : D.bgSurface,
            fontSize: isMobile ? 20 : 16,
            transition: 'all .15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>🚪</span>
          {isMobile && (
            <span style={{
              fontSize: 9, color: D.textFaint,
              fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: '0.02em',
            }}>Out</span>
          )}
        </button>
        {hov && !isMobile && <Tooltip label="Sign Out" isMobile={false} />}
      </div>
    </div>
  )
}

// ─── SidebarContent (full) ────────────────────────────────────────────────────

function SidebarContent({ activePage, setActivePage, onLogout, currentUser, onNavClick, isMobile }) {
  const [search,         setSearch]         = useState('')
  const [allowedModules, setAllowedModules] = useState(null)
  const [collapsed,      setCollapsed]      = useState(() => LS.get('gnsi_nav_collapsed', {}))
  const [pins,           setPins]           = useState(() => LS.get('gnsi_nav_pins', []))
  const [recents,        setRecents]        = useState(() => LS.get('gnsi_nav_recents', []))
  const searchRef = useRef(null)

  const role = currentUser?.role || 'Teacher'

  useEffect(() => {
    const handler = e => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    async function fetchPermissions() {
      if (role === 'Admin') {
        setAllowedModules(new Set(ALL_ITEMS.map(i => i.id)))
        return
      }
      const { data, error } = await supabase
        .from('role_permissions')
        .select('module_key')
        .eq('role', role)
        .eq('allowed', true)
      if (!error && data) setAllowedModules(new Set(data.map(r => r.module_key)))
      else setAllowedModules(new Set(['dashboard']))
    }
    fetchPermissions()
  }, [role])

  const handleNavigate = useCallback((id) => {
    if (!allowedModules?.has(id)) return
    setActivePage(id)
    onNavClick?.()
    setRecents(prev => {
      const next = [id, ...prev.filter(r => r !== id)].slice(0, 5)
      LS.set('gnsi_nav_recents', next)
      return next
    })
  }, [setActivePage, onNavClick, allowedModules])

  const handlePin = useCallback((id) => {
    setPins(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      LS.set('gnsi_nav_pins', next)
      return next
    })
  }, [])

  const toggleGroup = (group) => {
    setCollapsed(prev => {
      const next = { ...prev, [group]: !prev[group] }
      LS.set('gnsi_nav_collapsed', next)
      return next
    })
  }

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'US'

  const filteredGroups = useMemo(() => {
    if (!allowedModules) return []
    const q = search.trim().toLowerCase()
    return ALL_GROUPS
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          allowedModules.has(i.id) && !pins.includes(i.id) &&
          (!q || i.label.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.items.length > 0)
  }, [allowedModules, search, pins])

  const visibleRecents = useMemo(() =>
    recents.filter(id => allowedModules?.has(id) && !pins.includes(id)).slice(0, 4),
  [recents, allowedModules, pins])

  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)

  if (!allowedModules) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
        <div style={{ width: 22, height: 22, border: `2px solid ${D.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: isMobile ? 14 : 12, color: D.textFaint }}>Loading modules…</span>
      </div>
    )
  }

  return (
    <>
      {/* User card */}
      <div style={{
        margin: isMobile ? '12px 12px 0' : '10px 10px 0',
        background: `linear-gradient(135deg, ${D.bgSurface} 0%, rgba(15,40,60,0.8) 100%)`,
        border: `1px solid ${D.border}`,
        borderRadius: isMobile ? 12 : 10,
        padding: isMobile ? '13px 14px' : '10px 12px',
        display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 10,
        flexShrink: 0, position: 'relative', overflow: 'hidden',
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 60,
          background: `radial-gradient(ellipse at left center, ${D.accentGlow} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          width: isMobile ? 42 : 36, height: isMobile ? 42 : 36,
          borderRadius: isMobile ? 11 : 9, flexShrink: 0,
          background: D.accentGlow, border: `1.5px solid ${D.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isMobile ? 15 : 13, fontWeight: 700, color: D.accentLight,
          fontFamily: "'Trebuchet MS', monospace", zIndex: 1,
        }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1, zIndex: 1 }}>
          <div style={{
            fontSize: isMobile ? 15.5 : 13.5, fontWeight: 600, color: D.textPrimary,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.3, fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
          }}>
            {currentUser?.name || 'User'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: D.accentGlow, border: `1px solid ${D.accentBorder}`,
              borderRadius: 4, padding: isMobile ? '3px 8px' : '2px 7px',
            }}>
              <span style={{ width: isMobile ? 5 : 4, height: isMobile ? 5 : 4, borderRadius: '50%', background: D.accent, flexShrink: 0 }} />
              <span style={{ fontSize: isMobile ? 11 : 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: D.accent }}>
                {role}
              </span>
            </span>
            {totalBadges > 0 && (
              <span style={{
                fontSize: isMobile ? 11 : 9.5, fontWeight: 700, color: '#fcd34d',
                background: '#78350f', padding: isMobile ? '3px 7px' : '2px 6px', borderRadius: 99,
              }}>
                {totalBadges} pending
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1 }}>
          <div style={{
            width: isMobile ? 9 : 7, height: isMobile ? 9 : 7, borderRadius: '50%',
            background: D.green, flexShrink: 0, boxShadow: `0 0 6px ${D.green}`,
          }} />
          <span style={{ fontSize: isMobile ? 9.5 : 8, color: D.textFaint }}>online</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: isMobile ? '10px 12px 4px' : '8px 10px 4px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: D.bgDeep, border: `1px solid ${D.borderStrong}`,
          borderRadius: isMobile ? 10 : 8,
          padding: isMobile ? '10px 13px' : '7px 11px',
        }}>
          <span style={{ fontSize: isMobile ? 14 : 12, color: D.textMuted, flexShrink: 0 }}>🔍</span>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: isMobile ? 15 : 13, color: D.textPrimary,
              fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
            }}
          />
          {search ? (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.textMuted, fontSize: isMobile ? 14 : 12, padding: 0, lineHeight: 1,
              WebkitTapHighlightColor: 'transparent',
            }}>✕</button>
          ) : (
            !isMobile && (
              <span style={{
                fontSize: 10, color: D.textFaint,
                background: 'rgba(255,255,255,0.07)', border: `1px solid ${D.border}`,
                borderRadius: 4, padding: '2px 5px',
                fontFamily: 'monospace', letterSpacing: '0.05em', flexShrink: 0,
              }}>/</span>
            )
          )}
        </div>
      </div>

      {/* Nav */}
      <nav
        className="gnsi-nav"
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: isMobile ? '4px 10px 12px' : '4px 8px 8px',
          scrollbarWidth: 'thin',
          scrollbarColor: `${D.border} transparent`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {!search && (
          <PinnedItems
            pins={pins} activePage={activePage}
            onNavigate={handleNavigate} onPin={handlePin} isMobile={isMobile}
          />
        )}
        {!search && visibleRecents.length > 0 && (
          <>
            <RecentItems
              recents={visibleRecents} activePage={activePage}
              onNavigate={handleNavigate} isMobile={isMobile}
            />
            <div style={{ height: 1, background: D.border, margin: isMobile ? '8px 2px 12px' : '6px 4px 10px' }} />
          </>
        )}
        {filteredGroups.length === 0 && (
          <div style={{ padding: '28px 12px', textAlign: 'center', color: D.textFaint, fontSize: isMobile ? 14 : 12 }}>
            No modules found
          </div>
        )}
        {filteredGroups.map((grp, gi) => {
          const isCollapsed = !!collapsed[grp.group] && !search
          return (
            <div key={grp.group} style={{ marginBottom: 2 }}>
              {gi > 0 && <div style={{ height: 1, background: D.border, margin: isMobile ? '6px 2px 10px' : '4px 4px 8px' }} />}
              <GroupHeader
                label={grp.group} collapsed={isCollapsed}
                count={grp.items.length} onToggle={() => toggleGroup(grp.group)} isMobile={isMobile}
              />
              {!isCollapsed && grp.items.map(item => (
                <NavItem
                  key={item.id} item={item}
                  isActive={activePage === item.id}
                  onClick={() => handleNavigate(item.id)}
                  onPin={handlePin} isPinned={pins.includes(item.id)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: isMobile ? '10px 12px 16px' : '8px 8px 12px',
        borderTop: `1px solid ${D.border}`,
        flexShrink: 0,
        background: `linear-gradient(0deg, ${D.bgDeep} 0%, transparent 100%)`,
      }}>
        {!isMobile && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 10px 7px',
          }}>
            <span style={{ fontSize: 10, color: D.textFaint }}>
              <span style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${D.border}`, borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 9 }}>/</span>
              {' '}to search
            </span>
            <span style={{ fontSize: 10, color: D.textFaint }}>v2.1 · © {new Date().getFullYear()} GNSI</span>
          </div>
        )}
        {isMobile && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: D.textFaint }}>v2.1 · © {new Date().getFullYear()} GNSI</span>
          </div>
        )}
        <LogoutButton onLogout={onLogout} isMobile={isMobile} />
      </div>
    </>
  )
}

// ─── LogoutButton ─────────────────────────────────────────────────────────────

function LogoutButton({ onLogout, isMobile = false }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 9,
        padding: isMobile ? '11px 14px' : '8px 12px',
        borderRadius: isMobile ? 10 : 8,
        border: `1px solid ${hov ? D.accentBorder : D.border}`,
        cursor: 'pointer', textAlign: 'left',
        fontSize: isMobile ? 15 : 13, fontWeight: 500,
        background: hov ? D.accentGlow : D.bgSurface,
        color: hov ? D.accentLight : D.textMuted,
        transition: 'all .15s',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
        minHeight: isMobile ? 48 : 'auto',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: isMobile ? 17 : 14 }}>🚪</span>
      <span>Sign Out</span>
    </button>
  )
}

// ─── LogoHeader ───────────────────────────────────────────────────────────────

function LogoHeader({ isMobile, onClose, minimized, onToggleMinimize }) {
  return (
    <div style={{
      padding: minimized ? '0 10px' : isMobile ? '0 16px' : '0 14px',
      height: isMobile ? 64 : 60,
      display: 'flex', alignItems: 'center',
      gap: minimized ? 0 : isMobile ? 13 : 11,
      justifyContent: minimized ? 'center' : 'flex-start',
      borderBottom: `1px solid ${D.border}`,
      flexShrink: 0,
      background: `linear-gradient(90deg, ${D.bgDeep} 0%, ${D.bg} 100%)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {!minimized && (
        <div style={{
          position: 'absolute', bottom: 0, left: 14, right: 14, height: 1,
          background: `linear-gradient(90deg, ${D.accent}44, transparent)`,
        }} />
      )}

      <div style={{
        width: minimized ? 36 : isMobile ? 40 : 36,
        height: minimized ? 36 : isMobile ? 40 : 36,
        borderRadius: minimized ? 10 : isMobile ? 10 : 9,
        background: D.logoBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: minimized ? 17 : isMobile ? 20 : 18,
        flexShrink: 0,
        boxShadow: `0 2px 8px rgba(253,214,86,0.3)`,
        transition: 'width 0.2s, height 0.2s',
      }}>🏫</div>

      {!minimized && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 17.5 : 15.5, fontWeight: 700, color: D.textPrimary,
            letterSpacing: '-.01em', lineHeight: 1.1,
            fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
          }}>
            GNSI <span style={{ color: D.accent }}>ERP</span>
          </div>
          <div style={{
            fontSize: isMobile ? 10.5 : 9.5, color: D.textFaint,
            letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2,
            fontFamily: "'Trebuchet MS', monospace",
          }}>
            School Management
          </div>
        </div>
      )}

      {/* Minimize toggle — shown on both mobile drawer and desktop */}
      {onToggleMinimize && (
        <button
          onClick={onToggleMinimize}
          className="gnsi-toggle-btn"
          title={minimized ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            flexShrink: 0,
            width: isMobile ? 36 : 26,
            height: isMobile ? 36 : 26,
            borderRadius: isMobile ? 9 : 7,
            border: `1px solid ${D.border}`,
            background: 'rgba(255,255,255,0.04)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: D.textMuted,
            fontSize: isMobile ? 16 : 11,
            WebkitTapHighlightColor: 'transparent',
            marginLeft: minimized ? 0 : isMobile ? 2 : 0,
          }}
          aria-label={minimized ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span style={{
            display: 'inline-block',
            transform: minimized ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.22s',
            lineHeight: 1,
          }}>›</span>
        </button>
      )}

      {/* Close button — mobile only, shown when NOT minimized */}
      {isMobile && !minimized && onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.border}`,
            borderRadius: 8, cursor: 'pointer',
            color: D.textMuted, fontSize: 16, lineHeight: 1,
            padding: '8px 10px',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
          }}
          aria-label="Close menu"
        >✕</button>
      )}

      {/* Minimized mobile: just a close X */}
      {isMobile && minimized && onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.border}`,
            borderRadius: 7, cursor: 'pointer',
            color: D.textFaint, fontSize: 10, lineHeight: 1,
            padding: '4px 7px',
            WebkitTapHighlightColor: 'transparent',
            letterSpacing: '.05em',
            fontFamily: "'Trebuchet MS', monospace",
          }}
          aria-label="Close menu"
        >✕</button>
      )}
    </div>
  )
}

// ─── CollapseHandle ────────────────────────────────────────────────────────────
// Floating button on the edge of the desktop sidebar

function CollapseHandle({ minimized, onToggle }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute',
        top: '50%',
        right: -13,
        transform: 'translateY(-50%)',
        zIndex: 101,
      }}
    >
      <button
        onClick={onToggle}
        className="gnsi-toggle-btn"
        title={minimized ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          width: 26, height: 26,
          borderRadius: '50%',
          border: `1.5px solid ${hov ? D.accent : D.borderStrong}`,
          background: hov ? D.bgHover : D.bgDeep,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: hov ? D.accentLight : D.textMuted,
          fontSize: 13,
          boxShadow: hov ? `0 0 10px ${D.accentGlow}` : '0 2px 8px rgba(0,0,0,0.4)',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label={minimized ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span style={{
          display: 'inline-block',
          transform: minimized ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.22s',
          lineHeight: 1,
          marginTop: 1,
        }}>›</span>
      </button>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

function Sidebar({ activePage, setActivePage, onLogout, currentUser }) {
  const isMobile   = useIsMobile()
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [minimized,   setMinimized]   = useState(() => LS.get('gnsi_sidebar_minimized', false))

  // Permissions needed by mini sidebar too
  const [allowedModules, setAllowedModules] = useState(null)

  const role = currentUser?.role || 'Teacher'

  useEffect(() => {
    async function fetchPermissions() {
      if (role === 'Admin') {
        setAllowedModules(new Set(ALL_ITEMS.map(i => i.id)))
        return
      }
      const { data, error } = await supabase
        .from('role_permissions')
        .select('module_key')
        .eq('role', role)
        .eq('allowed', true)
      if (!error && data) setAllowedModules(new Set(data.map(r => r.module_key)))
      else setAllowedModules(new Set(['dashboard']))
    }
    fetchPermissions()
  }, [role])

  const handleNavigate = useCallback((id) => {
    if (!allowedModules?.has(id)) return
    setActivePage(id)
  }, [setActivePage, allowedModules])

  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)

  const toggleMinimized = () => {
    setMinimized(prev => {
      LS.set('gnsi_sidebar_minimized', !prev)
      return !prev
    })
  }

  useEffect(() => { setDrawerOpen(false) }, [activePage])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const sidebarBase = {
    background: D.bg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    borderRight: `1px solid ${D.border}`,
  }

  /* ── DESKTOP ── */
  if (!isMobile) {
    const w = minimized ? D.miniW : D.fullW
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <div style={{
          ...sidebarBase,
          width: w,
          height: '100vh',
          position: 'fixed',
          left: 0, top: 0,
          zIndex: 100,
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: minimized ? 'visible' : 'hidden',
        }}>
          <LogoHeader
            isMobile={false}
            minimized={minimized}
            onToggleMinimize={toggleMinimized}
          />

          {minimized ? (
            <MiniSidebarContent
              activePage={activePage}
              onNavigate={handleNavigate}
              onLogout={onLogout}
              allowedModules={allowedModules}
              currentUser={currentUser}
              isMobile={false}
            />
          ) : (
            <SidebarContent
              activePage={activePage}
              setActivePage={setActivePage}
              onLogout={onLogout}
              currentUser={currentUser}
              isMobile={false}
            />
          )}

          {/* Floating collapse handle on edge */}
          <CollapseHandle minimized={minimized} onToggle={toggleMinimized} />
        </div>
      </>
    )
  }

  /* ── MOBILE ── */
  // On mobile, the drawer itself can be minimized to a mini icon rail
  const mobileDrawerWidth = minimized ? D.miniW : '82vw'
  const mobileDrawerMaxWidth = minimized ? D.miniW : 320

  return (
    <>
      <style>{GLOBAL_STYLE}</style>

      {/* Mobile top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 60,
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 16px',
        zIndex: 200,
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${D.border}`,
            borderRadius: 9, cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, padding: '10px 11px',
            position: 'relative', flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
            minWidth: 44, minHeight: 44,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 20, height: 2,
              borderRadius: 2, background: D.textMuted,
            }} />
          ))}
          {totalBadges > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 8, height: 8, borderRadius: '50%',
              background: D.accent, border: `1.5px solid ${D.bg}`,
            }} />
          )}
        </button>

        {/* Logo */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: D.logoBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
        }}>🏫</div>

        {/* Brand */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, lineHeight: 1.1 }}>
            GNSI <span style={{ color: D.accent }}>ERP</span>
          </div>
          <div style={{ fontSize: 10, color: D.textFaint, textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 1 }}>
            School Management
          </div>
        </div>

        {/* Current page pill */}
        <div style={{
          fontSize: 13, color: D.accentLight, fontWeight: 600,
          background: D.accentGlow, border: `1px solid ${D.accentBorder}`,
          borderRadius: 8, padding: '5px 11px',
          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {ALL_ITEMS.find(i => i.id === activePage)?.icon}{' '}
          {ALL_ITEMS.find(i => i.id === activePage)?.label || activePage}
        </div>
      </div>

      {/* Backdrop — only shown when drawer open and NOT minimized (mini rail is narrow, no backdrop needed) */}
      {drawerOpen && !minimized && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 298, backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Backdrop for mini mode — lighter, tap to close */}
      {drawerOpen && minimized && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 298,
          }}
        />
      )}

      {/* Drawer */}
      <div
        className="gnsi-drawer"
        style={{
          ...sidebarBase,
          position: 'fixed', top: 0, left: 0,
          width: mobileDrawerWidth,
          maxWidth: mobileDrawerMaxWidth,
          height: '100vh',
          zIndex: 299,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          willChange: 'transform',
          overflowY: 'hidden',
          overflowX: 'hidden',
        }}
      >
        <LogoHeader
          isMobile
          minimized={minimized}
          onClose={() => setDrawerOpen(false)}
          onToggleMinimize={toggleMinimized}
        />

        {minimized ? (
          <MiniSidebarContent
            activePage={activePage}
            onNavigate={(id) => { handleNavigate(id); setDrawerOpen(false) }}
            onLogout={onLogout}
            allowedModules={allowedModules}
            currentUser={currentUser}
            isMobile={true}
          />
        ) : (
          <SidebarContent
            activePage={activePage}
            setActivePage={setActivePage}
            onLogout={onLogout}
            currentUser={currentUser}
            onNavClick={() => setDrawerOpen(false)}
            isMobile={true}
          />
        )}
      </div>
    </>
  )
}

export default Sidebar
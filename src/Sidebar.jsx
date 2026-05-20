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
      { id: 'attendance', label: 'Attendance', icon: '📅' },
      { id: 'exams',      label: 'Exams',      icon: '📝' },
      { id: 'timetable',  label: 'Timetable',  icon: '🕐' },
      { id: 'teaching',   label: 'Teaching',   icon: '📚' },
      { id: 'courses',    label: 'Courses',    icon: '🎓' },
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
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const LS = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback } },
  set: (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

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

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ item, isActive, onClick, onPin, isPinned, compact = false }) {
  const badge   = BADGES[item.id]
  const [hov, setHov] = useState(false)
  const [pinHov, setPinHov] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPinHov(false) }}
    >
      <button
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '5px 10px 5px 12px' : '7px 10px 7px 14px',
          borderRadius: 8,
          marginBottom: 1,
          border: isActive
            ? `1px solid ${D.accentBorder}`
            : `1px solid ${hov ? D.border : 'transparent'}`,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: compact ? 12.5 : 13.5,
          fontWeight: isActive ? 600 : 400,
          background: isActive
            ? `linear-gradient(90deg, ${D.bgActive} 0%, rgba(15,30,16,0.6) 100%)`
            : hov ? D.bgHover : 'transparent',
          color: isActive ? D.accentLight : hov ? D.textPrimary : D.textSecondary,
          position: 'relative',
          transition: 'background .12s, border-color .12s, color .12s',
          fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
          letterSpacing: isActive ? '0.01em' : 0,
        }}
      >
        {/* Active left bar */}
        {isActive && (
          <span style={{
            position: 'absolute', left: 0, top: '50%',
            transform: 'translateY(-50%)',
            width: 3, height: 20,
            borderRadius: '0 3px 3px 0',
            background: D.pillActive,
            boxShadow: `0 0 8px ${D.accent}`,
          }} />
        )}

        <span style={{ fontSize: compact ? 13 : 15, lineHeight: 1, flexShrink: 0, filter: isActive ? 'none' : hov ? 'none' : 'grayscale(0.3)' }}>
          {item.icon}
        </span>
        <span style={{ flex: 1, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>

        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '2px 6px', borderRadius: 99,
            background: badge.bg, color: badge.color,
            flexShrink: 0, letterSpacing: '0.02em',
          }}>{badge.count}</span>
        )}

        {isPinned && !hov && (
          <span style={{ fontSize: 9, color: D.accent, flexShrink: 0, opacity: 0.6 }}>📌</span>
        )}
      </button>

      {/* Pin button — appears on hover */}
      {hov && onPin && (
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

function GroupHeader({ label, collapsed, onToggle, count }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%',
        padding: '5px 10px 4px 12px',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: 'none', cursor: 'pointer',
        borderRadius: 6,
        transition: 'background .1s',
        marginBottom: 2,
      }}
    >
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em',
        color: hov ? D.textMuted : D.textFaint,
        textTransform: 'uppercase',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
        flex: 1, textAlign: 'left',
        transition: 'color .1s',
      }}>{label}</span>
      {count > 0 && (
        <span style={{
          fontSize: 9, color: D.textFaint,
          background: 'rgba(255,255,255,0.06)',
          padding: '1px 5px', borderRadius: 99,
        }}>{count}</span>
      )}
      <span style={{
        fontSize: 9, color: D.textFaint,
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        transition: 'transform .2s',
        display: 'inline-block',
      }}>▾</span>
    </button>
  )
}

// ─── RecentItems ─────────────────────────────────────────────────────────────

function RecentItems({ recents, activePage, onNavigate }) {
  if (!recents.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em',
        color: D.textFaint, padding: '4px 12px 5px',
        textTransform: 'uppercase',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}>RECENT</div>
      {recents.map(id => {
        const item = ALL_ITEMS.find(i => i.id === id)
        if (!item) return null
        return (
          <NavItem
            key={id}
            item={item}
            isActive={activePage === id}
            onClick={() => onNavigate(id)}
            compact
          />
        )
      })}
    </div>
  )
}

// ─── PinnedItems ─────────────────────────────────────────────────────────────

function PinnedItems({ pins, activePage, onNavigate, onPin }) {
  if (!pins.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.11em',
        color: D.accentBorder, padding: '4px 12px 5px',
        textTransform: 'uppercase',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}>📌 PINNED</div>
      {pins.map(id => {
        const item = ALL_ITEMS.find(i => i.id === id)
        if (!item) return null
        return (
          <NavItem
            key={id}
            item={item}
            isActive={activePage === id}
            onClick={() => onNavigate(id)}
            onPin={onPin}
            isPinned
            compact
          />
        )
      })}
    </div>
  )
}

// ─── SidebarContent ──────────────────────────────────────────────────────────

function SidebarContent({ activePage, setActivePage, onLogout, currentUser, onNavClick }) {
  const [search,         setSearch]         = useState('')
  const [allowedModules, setAllowedModules] = useState(null)
  const [collapsed,      setCollapsed]      = useState(() => LS.get('gnsi_nav_collapsed', {}))
  const [pins,           setPins]           = useState(() => LS.get('gnsi_nav_pins', []))
  const [recents,        setRecents]        = useState(() => LS.get('gnsi_nav_recents', []))
  const searchRef = useRef(null)

  const role = currentUser?.role || 'Teacher'

  // Keyboard shortcut: / to focus search
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

  // Permissions
  useEffect(() => {
    async function fetchPermissions() {
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

  // Navigate + track recents
  const handleNavigate = useCallback((id) => {
    setActivePage(id)
    onNavClick?.()
    setRecents(prev => {
      const next = [id, ...prev.filter(r => r !== id)].slice(0, 5)
      LS.set('gnsi_nav_recents', next)
      return next
    })
  }, [setActivePage, onNavClick])

  // Pin toggle
  const handlePin = useCallback((id) => {
    setPins(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      LS.set('gnsi_nav_pins', next)
      return next
    })
  }, [])

  // Group collapse toggle
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: 20, height: 20, border: `2px solid ${D.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 12, color: D.textFaint }}>Loading modules…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <>
      {/* User card */}
      <div style={{
        margin: '10px 10px 0',
        background: `linear-gradient(135deg, ${D.bgSurface} 0%, rgba(15,40,60,0.8) 100%)`,
        border: `1px solid ${D.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle glow behind avatar */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 60,
          background: `radial-gradient(ellipse at left center, ${D.accentGlow} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: D.accentGlow,
          border: `1.5px solid ${D.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: D.accentLight,
          fontFamily: "'Trebuchet MS', monospace",
          zIndex: 1,
        }}>{initials}</div>

        <div style={{ minWidth: 0, flex: 1, zIndex: 1 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 600, color: D.textPrimary,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.3,
            fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
          }}>
            {currentUser?.name || 'User'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: D.accentGlow, border: `1px solid ${D.accentBorder}`,
              borderRadius: 4, padding: '2px 7px',
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: D.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: D.accent }}>
                {role}
              </span>
            </span>
            {totalBadges > 0 && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: '#fcd34d',
                background: '#78350f', padding: '2px 6px', borderRadius: 99,
              }}>
                {totalBadges} pending
              </span>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: D.green, flexShrink: 0,
            boxShadow: `0 0 6px ${D.green}`,
          }} />
          <span style={{ fontSize: 8, color: D.textFaint }}>online</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: D.bgDeep,
          border: `1px solid ${D.borderStrong}`,
          borderRadius: 8, padding: '7px 11px',
          transition: 'border-color .15s',
        }}>
          <span style={{ fontSize: 12, color: D.textMuted, flexShrink: 0 }}>🔍</span>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: D.textPrimary,
              fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
            }}
          />
          {search ? (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.textMuted, fontSize: 12, padding: 0, lineHeight: 1,
            }}>✕</button>
          ) : (
            <span style={{
              fontSize: 10, color: D.textFaint,
              background: 'rgba(255,255,255,0.07)',
              border: `1px solid ${D.border}`,
              borderRadius: 4, padding: '2px 5px',
              fontFamily: 'monospace', letterSpacing: '0.05em',
              flexShrink: 0,
            }}>/</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '4px 8px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: `${D.border} transparent`,
      }}>

        {/* Pinned */}
        {!search && (
          <PinnedItems
            pins={pins}
            activePage={activePage}
            onNavigate={handleNavigate}
            onPin={handlePin}
          />
        )}

        {/* Recents */}
        {!search && visibleRecents.length > 0 && (
          <>
            <RecentItems recents={visibleRecents} activePage={activePage} onNavigate={handleNavigate} />
            <div style={{ height: 1, background: D.border, margin: '6px 4px 10px' }} />
          </>
        )}

        {/* Groups */}
        {filteredGroups.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: D.textFaint, fontSize: 12 }}>
            No modules found
          </div>
        )}

        {filteredGroups.map((grp, gi) => {
          const isCollapsed = !!collapsed[grp.group] && !search
          return (
            <div key={grp.group} style={{ marginBottom: 2 }}>
              {gi > 0 && <div style={{ height: 1, background: D.border, margin: '4px 4px 8px' }} />}

              <GroupHeader
                label={grp.group}
                collapsed={isCollapsed}
                count={grp.items.length}
                onToggle={() => toggleGroup(grp.group)}
              />

              {!isCollapsed && grp.items.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activePage === item.id}
                  onClick={() => handleNavigate(item.id)}
                  onPin={handlePin}
                  isPinned={pins.includes(item.id)}
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '8px 8px 12px',
        borderTop: `1px solid ${D.border}`,
        flexShrink: 0,
        background: `linear-gradient(0deg, ${D.bgDeep} 0%, transparent 100%)`,
      }}>
        {/* Help row */}
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

        {/* Sign out */}
        <LogoutButton onLogout={onLogout} />
      </div>
    </>
  )
}

// ─── LogoutButton ─────────────────────────────────────────────────────────────

function LogoutButton({ onLogout }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${hov ? D.accentBorder : D.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13, fontWeight: 500,
        background: hov ? D.accentGlow : D.bgSurface,
        color: hov ? D.accentLight : D.textMuted,
        transition: 'all .15s',
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <span style={{ fontSize: 14 }}>🚪</span>
      <span>Sign Out</span>
    </button>
  )
}

// ─── Logo header (shared) ─────────────────────────────────────────────────────

function LogoHeader({ isMobile, onClose }) {
  return (
    <div style={{
      padding: '0 14px',
      height: 60,
      display: 'flex', alignItems: 'center', gap: 11,
      borderBottom: `1px solid ${D.border}`,
      flexShrink: 0,
      background: `linear-gradient(90deg, ${D.bgDeep} 0%, ${D.bg} 100%)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 14, right: 14,
        height: 1,
        background: `linear-gradient(90deg, ${D.accent}44, transparent)`,
      }} />

      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: D.logoBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
        boxShadow: `0 2px 8px rgba(253,214,86,0.3)`,
      }}>🏫</div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 15.5, fontWeight: 700, color: D.textPrimary,
          letterSpacing: '-.01em', lineHeight: 1.1,
          fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
        }}>
          GNSI <span style={{ color: D.accent }}>ERP</span>
        </div>
        <div style={{
          fontSize: 9.5, color: D.textFaint,
          letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2,
          fontFamily: "'Trebuchet MS', monospace",
        }}>
          School Management
        </div>
      </div>

      {isMobile && (
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.border}`,
            borderRadius: 6, cursor: 'pointer',
            color: D.textMuted, fontSize: 14, lineHeight: 1,
            padding: '5px 8px',
          }}
          aria-label="Close menu"
        >✕</button>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

function Sidebar({ activePage, setActivePage, onLogout, currentUser }) {
  const isMobile    = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const totalBadges = Object.values(BADGES).reduce((s, b) => s + b.count, 0)

  useEffect(() => { setDrawerOpen(false) }, [activePage])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const sidebarStyles = {
    background: D.bg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    borderRight: `1px solid ${D.border}`,
  }

  /* ── DESKTOP ── */
  if (!isMobile) {
    return (
      <div style={{
        ...sidebarStyles,
        width: 262,
        height: '100vh',
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 100,
      }}>
        <LogoHeader isMobile={false} />
        <SidebarContent
          activePage={activePage}
          setActivePage={setActivePage}
          onLogout={onLogout}
          currentUser={currentUser}
        />
      </div>
    )
  }

  /* ── MOBILE ── */
  return (
    <>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 56,
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        zIndex: 200,
        fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      }}>
        {/* Hamburger with badge dot */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 5,
            padding: 4, position: 'relative',
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 22, height: 2,
              borderRadius: 2, background: D.textMuted,
            }} />
          ))}
          {totalBadges > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              width: 8, height: 8, borderRadius: '50%',
              background: D.accent,
              border: `1.5px solid ${D.bg}`,
            }} />
          )}
        </button>

        {/* Logo */}
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: D.logoBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
        }}>🏫</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, lineHeight: 1.1 }}>
            GNSI <span style={{ color: D.accent }}>ERP</span>
          </div>
          <div style={{ fontSize: 9, color: D.textFaint, textTransform: 'uppercase', letterSpacing: '.07em' }}>
            School Management
          </div>
        </div>

        {/* Active label */}
        <div style={{
          fontSize: 12, color: D.accentLight, fontWeight: 600,
          background: D.accentGlow, border: `1px solid ${D.accentBorder}`,
          borderRadius: 6, padding: '3px 9px',
          maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ALL_ITEMS.find(i => i.id === activePage)?.icon}{' '}
          {ALL_ITEMS.find(i => i.id === activePage)?.label || activePage}
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 298,
            backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        ...sidebarStyles,
        position: 'fixed', top: 0, left: 0,
        width: 280, height: '100vh',
        zIndex: 299,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
        overflowY: 'hidden',
      }}>
        <LogoHeader isMobile onClose={() => setDrawerOpen(false)} />
        <SidebarContent
          activePage={activePage}
          setActivePage={setActivePage}
          onLogout={onLogout}
          currentUser={currentUser}
          onNavClick={() => setDrawerOpen(false)}
        />
      </div>
    </>
  )
}

export default Sidebar
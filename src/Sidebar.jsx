import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/Supabase'

const ALL_GROUPS = [
  {
    group: 'CORE',
    items: [
      { id: 'dashboard',          label: 'Dashboard',      icon: '🏠' },
      { id: 'students',           label: 'Students',       icon: '🎓' },
      { id: 'admissions',         label: 'Admissions',     icon: '📋' },
      { id: 'bulk-admission-fee', label: 'Bulk Admission', icon: '📥' },
    ],
  },
  {
    group: 'FINANCE',
    items: [
      { id: 'fees',     label: 'Fees',     icon: '💰' },
      { id: 'accounts', label: 'Accounts', icon: '🧾' },
      { id: 'salary',   label: 'Salary',   icon: '💵' },
      { id: 'studentledger', label: 'Student Ledger', icon: '📒' },
    ],
  },
  {
    group: 'ACADEMIC',
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
    items: [
      { id: 'staff',  label: 'Staff',  icon: '👨‍🏫' },
      { id: 'hr',     label: 'HR',     icon: '🗂️' },
      { id: 'leave',  label: 'Leave',  icon: '🏖️' },
      { id: 'hostel', label: 'Hostel', icon: '🏨' },
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
      { id: 'reports',              label: 'Reports',   icon: '📊' },
      { id: 'management-checklist', label: 'Checklist', icon: '✅' },
      { id: 'admin',                label: 'Admin',     icon: '🔐' },
      { id: 'system',               label: 'System',    icon: '⚙️' },
    ],
  },
]

const BADGES = {
  fees:   { count: 3, bg: '#422006', color: '#fcd34d' },
  leave:  { count: 2, bg: '#422006', color: '#fcd34d' },
  notice: { count: 5, bg: '#422006', color: '#fcd34d' },
}

const D = {
  bg:           '#03263a',
  bgSurface:    '#181b23',
  bgHover:      '#1e2130',
  bgActive:     '#221f10',
  border:       '#2a2d3a',
  borderStrong: '#363a4f',
  accent:       '#f59e0b',
  accentLight:  '#fbbf24',
  accentBg:     'hsla(38, 87%, 44%, 0.10)',
  accentBorder: 'rgba(245,158,11,0.28)',
  textPrimary:  '#ffffff',
  textSecondary:'#ffffff',
  textMuted:    '#fbfbfb',
  textFaint:    '#ffffff',
  pill:         '#f59e0b',
  logoBg:       '#fdd656',
  scrollbar:    '#2a2d3a',
}

function NavItem({ item, isActive, onClick }) {
  const badge = BADGES[item.id]
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 10px 7px 14px',
        borderRadius: 7,
        marginBottom: 1,
        border: isActive
          ? `1px solid ${D.accentBorder}`
          : `1px solid ${hovered ? D.border : 'transparent'}`,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13.5,
        fontWeight: isActive ? 600 : 400,
        background: isActive ? D.bgActive : hovered ? D.bgHover : 'transparent',
        color: isActive ? D.accentLight : hovered ? D.textSecondary : D.textMuted,
        position: 'relative',
        transition: 'background .1s, border-color .1s, color .1s',
        fontFamily: 'inherit',
      }}
    >
      {isActive && (
        <span style={{
          position: 'absolute', left: 0, top: '50%',
          transform: 'translateY(-50%)',
          width: 3, height: 18,
          borderRadius: '0 3px 3px 0',
          background: D.pill,
        }} />
      )}
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.2 }}>{item.label}</span>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 99,
          background: badge.bg, color: badge.color,
          flexShrink: 0,
        }}>{badge.count}</span>
      )}
    </button>
  )
}

function LogoutButton({ onLogout }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px',
        borderRadius: 7,
        border: `1px solid ${hovered ? D.accentBorder : D.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13.5, fontWeight: 500,
        background: hovered ? D.accentBg : D.bgSurface,
        color: hovered ? D.accentLight : D.textMuted,
        transition: 'all .15s',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 15 }}>🚪</span>
      <span>Sign Out</span>
    </button>
  )
}

function Sidebar({ activePage, setActivePage, onLogout, currentUser }) {
  const [search, setSearch] = useState('')
  const [allowedModules, setAllowedModules] = useState(null)

 const role = currentUser?.role || 'Teacher'

  useEffect(() => {
    async function fetchPermissions() {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('module_key')
        .eq('role', role)
        .eq('allowed', true)

      if (!error && data) {
        setAllowedModules(new Set(data.map(r => r.module_key)))
      } else {
        // fallback: show only dashboard
        setAllowedModules(new Set(['dashboard']))
      }
    }
    fetchPermissions()
  }, [role])

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
          allowedModules.has(i.id) &&
          (!q || i.label.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.items.length > 0)
  }, [allowedModules, search])

  if (!allowedModules) {
    return (
      <div style={{
        width: 260, height: '100vh', background: D.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: D.textMuted, fontSize: 13,
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      width: 260,
      height: '100vh',
      background: D.bg,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0, top: 0,
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      borderRight: `1px solid ${D.border}`,
      zIndex: 100,
    }}>

      {/* Logo */}
      <div style={{
        padding: '0 16px', height: 58,
        display: 'flex', alignItems: 'center', gap: 11,
        borderBottom: `1px solid ${D.border}`, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: D.logoBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
        }}>🏫</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.textPrimary, letterSpacing: '-.02em', lineHeight: 1.1 }}>
            GNSI ERP
          </div>
          <div style={{ fontSize: 10, color: D.textFaint, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 2 }}>
            School Management
          </div>
        </div>
      </div>

      {/* User card */}
      <div style={{
        margin: '10px 10px 0',
        background: D.bgSurface,
        border: `1px solid ${D.border}`,
        borderRadius: 9,
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: D.accentBg,
          border: `1.5px solid ${D.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: D.accentLight,
        }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: D.textPrimary,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3,
          }}>
            {currentUser?.name || 'User'}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
            background: D.accentBg, border: `1px solid ${D.accentBorder}`,
            borderRadius: 4, padding: '2px 7px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: D.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: D.accent }}>
              {role}
            </span>
          </div>
        </div>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#22c55e', flexShrink: 0,
          outline: '2px solid rgba(34,197,94,0.2)',
        }} />
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: D.bgSurface, border: `1px solid ${D.borderStrong}`,
          borderRadius: 7, padding: '7px 11px',
        }}>
          <span style={{ fontSize: 13, color: D.textMuted, flexShrink: 0 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: D.textPrimary, fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.textMuted, fontSize: 13, padding: 0, lineHeight: 1,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '4px 8px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: `${D.scrollbar} transparent`,
      }}>
        {filteredGroups.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: D.textFaint, fontSize: 12 }}>
            No modules found
          </div>
        )}
        {filteredGroups.map((grp, gi) => (
          <div key={grp.group} style={{ marginBottom: 4 }}>
            {gi > 0 && <div style={{ height: 1, background: D.border, margin: '6px 4px 10px' }} />}
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '.09em',
              color: D.textFaint, padding: '4px 12px 5px', textTransform: 'uppercase',
            }}>{grp.group}</div>
            {grp.items.map(item => (
              <NavItem
                key={item.id}
                item={item}
                isActive={activePage === item.id}
                onClick={() => setActivePage(item.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '8px 8px 12px',
        borderTop: `1px solid ${D.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 10px 7px',
        }}>
          <span style={{ fontSize: 11, color: D.textFaint }}>v2.0.0</span>
          <span style={{ fontSize: 11, color: D.textFaint }}>© {new Date().getFullYear()} GNSI</span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>
    </div>
  )
}

export default Sidebar
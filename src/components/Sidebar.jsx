import { useState } from 'react'
import { useAuth } from '../core/auth'

// ── Navigation sections ───────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
      { id: 'admin',      icon: '🛡️', label: 'Admin Centre' },
      { id: 'analytics',  icon: '📈', label: 'Analytics' },
    ],
  },
  {
    label: 'Academic',
    items: [
      { id: 'students',   icon: '👨‍🎓', label: 'Students' },
      { id: 'admissions', icon: '📝', label: 'Admissions' },
      { id: 'attendance', icon: '✅', label: 'Attendance' },
      { id: 'exam',       icon: '🎓', label: 'Exams' },
      { id: 'courses',    icon: '📖', label: 'Courses' },
      { id: 'timetable',  icon: '🗓️', label: 'Timetable' },
      { id: 'teaching',   icon: '📚', label: 'Teaching' },
      { id: 'diary',      icon: '📓', label: 'Diary' },
      { id: 'lessonbridge', icon: '🌉', label: 'Lesson Bridge' },
      { id: 'doubttt',    icon: '❓', label: 'Doubt Sessions' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'fees',         icon: '💳', label: 'Fee Management' },
      { id: 'accounts',     icon: '📒', label: 'Accounts' },
      { id: 'staffsalary',  icon: '💰', label: 'Staff Salary' },
      { id: 'periodsalary', icon: '📆', label: 'Period Salary' },
      { id: 'dutyhours',    icon: '⏱️', label: 'Duty Hours' },
    ],
  },
  {
    label: 'Staff & HR',
    items: [
      { id: 'staff',      icon: '👥', label: 'Staff' },
      { id: 'leave',      icon: '🏖️', label: 'Leave' },
      { id: 'substitute', icon: '🔄', label: 'Substitute' },
      { id: 'appraisal',  icon: '⭐', label: 'Appraisal' },
      { id: 'grievance',  icon: '📢', label: 'Grievance' },
    ],
  },
  {
    label: 'Hostel',
    items: [
      { id: 'hostel',      icon: '🏠', label: 'Hostel' },
      { id: 'boarder',     icon: '🛏️', label: 'Boarder Schedule' },
      { id: 'kitchen',     icon: '🍽️', label: 'Kitchen' },
      { id: 'house',       icon: '🏆', label: 'House' },
      { id: 'housemaster', icon: '👤', label: 'Housemaster' },
      { id: 'discipline',  icon: '⚠️', label: 'Discipline' },
      { id: 'sickbay',     icon: '🏥', label: 'Sick Bay' },
      { id: 'nightduty',   icon: '🌙', label: 'Night Duty' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'notices',        icon: '📣', label: 'Notices' },
      { id: 'social',         icon: '🌐', label: 'Social' },
      { id: 'ptm',            icon: '🤝', label: 'PTM' },
      { id: 'parentfeedback', icon: '💬', label: 'Parent Feedback' },
      { id: 'parent',         icon: '👨‍👩‍👧', label: 'Parent Portal' },
    ],
  },
  {
    label: 'Front Desk',
    items: [
      { id: 'reception', icon: '🏨', label: 'Reception' },
      { id: 'calendar',  icon: '📅', label: 'Calendar' },
      { id: 'library',   icon: '📚', label: 'Library' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { id: 'reports',     icon: '📊', label: 'Reports' },
      { id: 'reportcard',  icon: '📋', label: 'Report Cards' },
      { id: 'certificate', icon: '🏅', label: 'Certificates' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'sync',        icon: '☁️', label: 'Sync & Backup' },
      { id: 'assets',      icon: '🗄️', label: 'Assets' },
      { id: 'aiassistant', icon: '🤖', label: 'AI Assistant' },
      { id: 'settings',    icon: '⚙️', label: 'Settings' },
    ],
  },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { user, logout } = useAuth()
  // Track which sections are collapsed (none by default)
  const [collapsed, setCollapsed] = useState({})

  function toggleSection(label) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="sidebar">

      {/* Logo */}
      <div className="nav-logo">
        <span style={{ color: '#ffd060' }}>GNSI</span>
        <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.6, letterSpacing: '1px', marginTop: '2px' }}>
          PORTAL v2.0
        </div>
      </div>

      {/* Nav items — scrollable */}
      <nav style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {/* Section header — click to collapse */}
            <div
              onClick={() => toggleSection(section.label)}
              style={{
                padding: '8px 20px 4px',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none',
              }}
            >
              {section.label}
              <span style={{ fontSize: '10px', opacity: 0.5 }}>
                {collapsed[section.label] ? '▶' : '▼'}
              </span>
            </div>

            {/* Section items */}
            {!collapsed[section.label] && section.items.map(item => (
              <div
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>Signed in as</div>
        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', wordBreak: 'break-all' }}>
          {user?.email}
        </div>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '8px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
            fontSize: '12px', fontWeight: 700,
          }}
        >
          🚪 Sign Out
        </button>
      </div>

    </div>
  )
}

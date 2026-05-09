import { useAuth } from '../core/auth'

const NAV_ITEMS = [
  { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { id: 'students',     icon: '👨‍🎓', label: 'Students' },
  { id: 'fees',         icon: '💳', label: 'Fee Management' },
  { id: 'admissions',   icon: '📝', label: 'Admissions' },
  { id: 'attendance',   icon: '✅', label: 'Attendance' },
  { id: 'accounts',     icon: '📒', label: 'Accounts' },
  { id: 'courses',      icon: '📖', label: 'Courses' },
  { id: 'reports',      icon: '📈', label: 'Reports' },
  { id: 'settings',     icon: '⚙️', label: 'Settings' },
  { id: 'boarder',      icon: '🛏️', label: 'Boarder Schedule' },
  { id: 'kitchen',      icon: '🍽️', label: 'Kitchen' },
  { id: 'hostel',       icon: '🏠', label: 'Hostel' },
  { id: 'house',        icon: '🏆', label: 'House' },
  { id: 'housemaster',  icon: '👤', label: 'Housemaster' },
  { id: 'discipline',   icon: '⚠️', label: 'Discipline' },
  { id: 'sickbay',      icon: '🏥', label: 'Sick Bay' },
  { id: 'nightduty',    icon: '🌙', label: 'Night Duty' },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="nav-logo">
        <span style={{ color: '#ffd060' }}>GNSI</span>
        <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.6, letterSpacing: '1px', marginTop: '2px' }}>
          PORTAL v2.0
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
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
            fontSize: '12px', fontWeight: 700
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  )
}

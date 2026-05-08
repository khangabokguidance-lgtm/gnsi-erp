import { useState } from 'react'
import { AuthProvider, useAuth } from './core/auth'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import Dashboard from './modules/Dashboard'
import Students from './modules/Students'
import UserManagement from './modules/UserManagement'
import ComingSoon from './modules/ComingSoon'
import './styles/main.css'

const PAGES = {
  dashboard:  Dashboard,
  students:   Students,
  fees:       () => <ComingSoon page="💳 Fee Management" />,
  admissions: () => <ComingSoon page="📝 Admissions" />,
  attendance: () => <ComingSoon page="✅ Attendance" />,
  accounts:   () => <ComingSoon page="📒 Accounts" />,
  courses:    () => <ComingSoon page="📖 Courses" />,
  reports:    () => <ComingSoon page="📈 Reports" />,
  settings:   UserManagement,
}

function AppShell() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (loading) return <div className="loading-spinner"><span>⏳</span> Loading GNSI Portal…</div>
  if (!user) return <Login />

  const PageComponent = PAGES[activePage] || (() => <ComingSoon page={activePage} />)

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        <PageComponent />
      </main>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppShell /></AuthProvider>
}
// ── PATCH for src/App.jsx ────────────────────────────────────────────────────
// 1. Add this import at the top (replace the ComingSoon import for admissions):
import Admissions from './modules/Admissions'

// 2. Update the PAGES object — replace the admissions entry:
const PAGES = {
  dashboard: Dashboard,
  students: Students,
  fees: () => <ComingSoon title="Fee Management" />,
  admissions: Admissions,           // ← CHANGE THIS LINE (was: () => <ComingSoon ...>)
  exams: () => <ComingSoon title="Examinations" />,
  reports: () => <ComingSoon title="Reports" />,
  users: UserManagement,
}
// That's it! The Admissions module will now load when the user clicks Admissions in the sidebar.

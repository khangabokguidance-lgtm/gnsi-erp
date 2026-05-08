import { useState } from 'react'
import { AuthProvider, useAuth } from './core/auth'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import Dashboard from './modules/Dashboard'
import ComingSoon from './modules/ComingSoon'
import './styles/main.css'

const PAGES = {
  dashboard:  { component: Dashboard },
  students:   { component: () => <ComingSoon page="👨‍🎓 Students" /> },
  fees:       { component: () => <ComingSoon page="💳 Fee Management" /> },
  admissions: { component: () => <ComingSoon page="📝 Admissions" /> },
  attendance: { component: () => <ComingSoon page="✅ Attendance" /> },
  accounts:   { component: () => <ComingSoon page="📒 Accounts" /> },
  courses:    { component: () => <ComingSoon page="📖 Courses" /> },
  reports:    { component: () => <ComingSoon page="📈 Reports" /> },
  settings:   { component: () => <ComingSoon page="⚙️ Settings" /> },
}

function AppShell() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (loading) {
    return (
      <div className="loading-spinner">
        <span>⏳</span> Loading GNSI Portal…
      </div>
    )
  }

  if (!user) return <Login />

  const PageComponent = PAGES[activePage]?.component || (() => <ComingSoon page={activePage} />)

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
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

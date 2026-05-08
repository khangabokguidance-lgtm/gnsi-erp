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
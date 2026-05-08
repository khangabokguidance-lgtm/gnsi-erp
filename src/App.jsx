import { useState } from 'react'
import { AuthProvider, useAuth } from './core/auth'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import Dashboard from './modules/Dashboard'
import Students from './modules/Students'
import UserManagement from './modules/UserManagement'
import ComingSoon from './modules/ComingSoon'
import Admissions from './modules/admissions'
import Fees from './modules/fees'
import Attendance from './modules/attendance'
import './styles/main.css'

const PAGES = {
  dashboard:  Dashboard,
  students:   Students,
  fees:       Fees,
  admissions: Admissions,
  attendance: Attendance,
  accounts:   () => <ComingSoon page="🟡 Accounts" />,
  courses:    () => <ComingSoon page="🗂️ Courses" />,
  reports:    () => <ComingSoon page="📊 Reports" />,
  settings:   UserManagement,
}

function AppShell() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (loading) return <div className="loading-spinner"><span>⏳</span> Loading GNSI Portal…</div>
  if (!user) return <Login />

  const PageComponent = PAGES[activePage] || ComingSoon

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
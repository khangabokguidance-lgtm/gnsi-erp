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
import Accounts from './modules/accounts'
import BoarderPage     from './modules/hostel/pages/BoarderPage'
import KitchenPage     from './modules/hostel/pages/KitchenPage'
import HostelPage      from './modules/hostel/pages/HostelPage'
import HousePage       from './modules/hostel/pages/HousePage'
import HousemasterPage from './modules/hostel/pages/HousemasterPage'
import DisciplinePage  from './modules/hostel/pages/DisciplinePage'
import SickbayPage     from './modules/hostel/pages/SickbayPage'
import NightDutyPage   from './modules/hostel/pages/NightDutyPage'

// ── Exam Module ──────────────────────────────────────────────
import ExamHub from './modules/exam/ExamHub'
import MarkEntry from './modules/exam/tabs/MarkEntry'
import MarksGrid from './modules/exam/tabs/MarksGrid'

import './styles/main.css'

// ── Exam wrapper — injects sub-components + data into ExamHub ─
function ExamPage() {
  const { user } = useAuth()

  // TODO: replace these with your real Supabase data hooks
  // e.g. const { students } = useStudents()
  //      const { examMarksData, saveM ark } = useExamMarks()
  const students      = []
  const examMarksData = {}
  const EXAM_TYPES    = []
  const EXAM_SUBJECTS = []
  const [classMode, setClassMode] = useState('new')

  return (
    <ExamHub
      students={students}
      examMarksData={examMarksData}
      EXAM_TYPES={EXAM_TYPES}
      EXAM_SUBJECTS={EXAM_SUBJECTS}
      currentUser={user}
      gnsiExamClassMode={classMode}
      onSetMode={setClassMode}

      // ── Wired sub-components ──────────────────────────────
      ExamEntry={MarkEntry}
      ExamMarksGrid={MarksGrid}
      // Add more as you migrate them:
      // ExamAnalytics={Analytics}
      // ExamSchedule={Schedule}
      // AdmitCards={AdmitCards}
      // ReportCards={ReportCards}
      // ERResultsModule={ExamResultsHub}
      // ExamManager={ExamManager}
    />
  )
}

const PAGES = {
  dashboard:  Dashboard,
  students:   Students,
  fees:       Fees,
  admissions: Admissions,
  attendance: Attendance,
  accounts:   Accounts,

  // ── Exam Module ──────────────────────────────────────────
  exam:       ExamPage,

  // ── Hostel Module ────────────────────────────────────────
  boarder:      BoarderPage,
  kitchen:      KitchenPage,
  hostel:       HostelPage,
  house:        HousePage,
  housemaster:  HousemasterPage,
  discipline:   DisciplinePage,
  sickbay:      SickbayPage,
  nightduty:    NightDutyPage,

  courses:  () => <ComingSoon page="🗂️ Courses" />,
  reports:  () => <ComingSoon page="📊 Reports" />,
  settings: UserManagement,
}

function AppShell() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, fontSize:15, color:'#6b7280' }}>
      ⏳ Loading GNSI Portal…
    </div>
  )
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

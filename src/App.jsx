import { useState, useEffect, useRef } from 'react'
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
import AdminCentre from './modules/AdminCentre'

import BoarderPage     from './modules/hostel/pages/BoarderPage'
import KitchenPage     from './modules/hostel/pages/KitchenPage'
import HostelPage      from './modules/hostel/pages/HostelPage'
import HousePage       from './modules/hostel/pages/HousePage'
import HousemasterPage from './modules/hostel/pages/HousemasterPage'
import DisciplinePage  from './modules/hostel/pages/DisciplinePage'
import SickbayPage     from './modules/hostel/pages/SickbayPage'
import NightDutyPage   from './modules/hostel/pages/NightDutyPage'

// ── Exam Module ──────────────────────────────────────────────
import ExamHub   from './modules/exam/ExamHub'
import MarkEntry from './modules/exam/tabs/MarkEntry'
import MarksGrid from './modules/exam/tabs/MarksGrid'

import './styles/main.css'

// ── Shared navigate ref ───────────────────────────────────────
// Lets any page (including legacy ones) call:
//   navigateRef.current('attendance')
const navigateRef = { current: () => {} }

// ─────────────────────────────────────────────────────────────
//  LEGACY JS WRAPPER
//
//  Your older modules (leave, notices, staff, timetable, etc.)
//  are plain JS files that produce HTML strings from a global
//  render function (e.g. window.renderLeave()).
//
//  This wrapper:
//    1. Mounts a plain <div> in the React tree
//    2. Calls the legacy renderFn() and writes its HTML into it
//    3. Exposes window.render = doRender so that legacy
//       onclick="render()" calls re-render the page correctly
//    4. Cleans up when the page is unmounted
//
//  HOW TO LOAD THE LEGACY JS FILES:
//    Option A (simplest): add <script> tags in index.html
//      <script src="/src/modules/leave.js"></script>
//      <script src="/src/modules/notices.js"></script>
//      ... etc.
//
//    Option B (Vite): add side-effect imports at the top of
//    this file (works if the files don't use ES module syntax):
//      import './modules/leave.js'
//      import './modules/notices.js'
// ─────────────────────────────────────────────────────────────
function LegacyPage({ renderFn, initFn }) {
  const ref = useRef(null)

  useEffect(() => {
    if (typeof initFn === 'function') initFn()

    function doRender() {
      if (!ref.current) return
      const html = typeof renderFn === 'function' ? renderFn() : ''
      if (typeof html === 'string') ref.current.innerHTML = html
    }

    const prevRender = window.render
    window.render = doRender
    doRender()

    return () => { window.render = prevRender }
  }, [renderFn, initFn])

  return <div ref={ref} className="legacy-page-mount" />
}

// Factory: turns a legacy render function into a React component
function makeLegacy(renderFn, initFn) {
  return function LegacyWrapper() {
    return <LegacyPage renderFn={renderFn} initFn={initFn} />
  }
}

// ── Exam wrapper ─────────────────────────────────────────────
function ExamPage() {
  const { user } = useAuth()
  const [classMode, setClassMode] = useState('new')
  // TODO: replace [] / {} with real Supabase hooks
  return (
    <ExamHub
      students={[]}
      examMarksData={{}}
      EXAM_TYPES={[]}
      EXAM_SUBJECTS={[]}
      currentUser={user}
      gnsiExamClassMode={classMode}
      onSetMode={setClassMode}
      ExamEntry={MarkEntry}
      ExamMarksGrid={MarksGrid}
    />
  )
}

// ── Admin Centre wrapper ─────────────────────────────────────
function AdminPage() {
  const { user } = useAuth()
  const DEPT_COLORS = {
    Science: '#1433a8', Maths: '#059669', English: '#d97706',
    Commerce: '#7c3aed', Hostel: '#0891b2', Admin: '#e63946',
  }
  // TODO: replace [] / {} with real Supabase hooks
  return (
    <AdminCentre
      currentUser={user}
      students={[]}
      staff={[]}
      notices={[]}
      attendance={{}}
      navigate={(page) => navigateRef.current(page)}
      gnsiGetHouseMap={() => ({})}
      getFacultyStaff={() => []}
      loadLessonPlans={() => ({})}
      gnsiGetReports={() => []}
      gnsiMonitorAlertCount={() => 0}
      renderFeeMonitorPanel={null}
      DEPT_COLORS={DEPT_COLORS}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  PAGE REGISTRY
// ─────────────────────────────────────────────────────────────
const PAGES = {
  // ── Core React modules ────────────────────────────────────
  dashboard:  Dashboard,
  students:   Students,
  fees:       Fees,
  admissions: Admissions,
  attendance: Attendance,
  accounts:   Accounts,
  admin:      AdminPage,
  exam:       ExamPage,
  settings:   UserManagement,

  // ── Hostel (React) ────────────────────────────────────────
  boarder:      BoarderPage,
  kitchen:      KitchenPage,
  hostel:       HostelPage,
  house:        HousePage,
  housemaster:  HousemasterPage,
  discipline:   DisciplinePage,
  sickbay:      SickbayPage,
  nightduty:    NightDutyPage,

  // ── Legacy JS modules (wrapped) ───────────────────────────

  // connect.js  →  parentfeedback, ptm, calendar, library, parent
  parentfeedback: makeLegacy(() => window.renderParentFeedbackAdmin?.()),
  ptm:            makeLegacy(() => window.renderPTM?.()),
  calendar:       makeLegacy(() => window.renderCalendar?.()),
  library:        makeLegacy(() => window.renderLibrary?.()),
  parent:         makeLegacy(() => window.renderParent?.()),

  // hr.js  →  appraisal, grievance
  appraisal: makeLegacy(() => window.renderAppraisal?.()),
  grievance: makeLegacy(() => window.renderGrievance?.()),

  // reception.js  →  reception
  reception: makeLegacy(() => window.renderReception?.()),

  // reports.js  →  reports, reportcard, certificate
  reports:     makeLegacy(() => window.renderReports?.()),
  reportcard:  makeLegacy(() => window.renderReportCard?.()),
  certificate: makeLegacy(() => window.renderCertificate?.()),

  // salary.js  →  dutyhours, periodsalary, staffsalary
  dutyhours:    makeLegacy(() => window.renderDutyHours?.()),
  periodsalary: makeLegacy(() => window.renderPeriodSalary?.()),
  staffsalary:  makeLegacy(() => window.renderStaffSalary?.()),

  // social.js  →  social
  social: makeLegacy(() => window.renderGnsiSocial?.()),

  // staff.js  →  staff
  staff: makeLegacy(() => window.renderStaff?.()),

  // system.js  →  sync, aiassistant, analytics, assets, backup
  sync:         makeLegacy(() => window.renderSync?.()),
  aiassistant:  makeLegacy(() => window.renderAiAssistant?.()),
  analytics:    makeLegacy(() => window.renderAnalytics?.()),
  assets:       makeLegacy(() => window.renderAssets?.()),
  backup:       makeLegacy(() => window.renderBackup?.()),

  // teaching.js  →  teaching, diary, lessonbridge
  teaching:     makeLegacy(() => window.renderTeachingPage?.()),
  diary:        makeLegacy(() => window.renderDiary?.()),
  lessonbridge: makeLegacy(() => window.renderLessonBridge?.()),

  // timetable.js  →  timetable, doubttt
  timetable: makeLegacy(() => window.renderTimetable?.()),
  doubttt:   makeLegacy(() => window.renderDoubtTT?.()),

  // leave.js  →  leave, substitute
  leave:      makeLegacy(() => window.renderLeave?.()),
  substitute: makeLegacy(() => window.renderSubstitute?.()),

  // notices.js  →  notices
  notices: makeLegacy(() => window.renderNotices?.()),

  // Placeholder
  courses: () => <ComingSoon page="🗂️ Courses" />,
}

// ── App shell ─────────────────────────────────────────────────
function AppShell() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  navigateRef.current = setActivePage

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, fontSize:15, color:'#6b7280' }}>
      ⏳ Loading GNSI Portal…
    </div>
  )
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

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
import AdminCentre from './modules/AdminCentre'

import BoarderPage     from './modules/hostel/pages/BoarderPage'
import KitchenPage     from './modules/hostel/pages/KitchenPage'
import HostelPage      from './modules/hostel/pages/HostelPage'
import HousePage       from './modules/hostel/pages/HousePage'
import HousemasterPage from './modules/hostel/pages/HousemasterPage'
import DisciplinePage  from './modules/hostel/pages/DisciplinePage'
import SickbayPage     from './modules/hostel/pages/SickbayPage'
import NightDutyPage   from './modules/hostel/pages/NightDutyPage'

import ExamHub   from './modules/exam/ExamHub'
import MarkEntry from './modules/exam/tabs/MarkEntry'
import MarksGrid from './modules/exam/tabs/MarksGrid'

import ConnectModule   from './modules/ConnectModule'
import HRModule        from './modules/HRModule'
import LeaveModule     from './modules/LeaveModule'
import NoticesModule   from './modules/NoticesModule'
import ReceptionModule from './modules/ReceptionModule'
import ReportsModule   from './modules/ReportsModule'
import SalaryModule    from './modules/SalaryModule'
import SocialModule    from './modules/SocialModule'
import StaffModule     from './modules/StaffModule'
import SystemModule    from './modules/SystemModule'
import TeachingModule  from './modules/TeachingModule'
import TimetableModule from './modules/TimetableModule'

import { useStaff }    from './hooks/useStaff'
import { useStudents } from './hooks/useStudents'
import { useLeave }    from './hooks/useLeave'
import { useNotices }  from './hooks/useNotices'
import { useReception }from './hooks/useReception'
import { useHR }       from './hooks/useHR'
import { useTimetable }from './hooks/useTimetable'
import { useTeaching } from './hooks/useTeaching'
import { useSalary }   from './hooks/useSalary'
import { useReports }  from './hooks/useReports'
import { useConnect }  from './hooks/useConnect'

import './styles/main.css'

const navigateRef = { current: () => {} }
const toastRef    = { current: () => {} }
function showToast(msg, color = '#1433a8') { toastRef.current(msg, color) }

function Toast() {
  const [toast, setToast] = useState(null)
  toastRef.current = (msg, color) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }
  if (!toast) return null
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background: toast.color || '#1433a8', color:'#fff',
      padding:'10px 20px', borderRadius:10, fontSize:13,
      fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
    }}>
      {toast.msg}
    </div>
  )
}

function ExamPage() {
  const { user } = useAuth()
  const [classMode, setClassMode] = useState('new')
  return (
    <ExamHub
      students={[]} examMarksData={{}} EXAM_TYPES={[]} EXAM_SUBJECTS={[]}
      currentUser={user} gnsiExamClassMode={classMode} onSetMode={setClassMode}
      ExamEntry={MarkEntry} ExamMarksGrid={MarksGrid}
    />
  )
}

function AdminPage() {
  const { user } = useAuth()
  const DEPT_COLORS = {
    Science:'#1433a8', Maths:'#059669', English:'#d97706',
    Commerce:'#7c3aed', Hostel:'#0891b2', Admin:'#e63946',
  }
  return (
    <AdminCentre
      currentUser={user} students={[]} staff={[]} notices={[]} attendance={{}}
      navigate={(page) => navigateRef.current(page)}
      gnsiGetHouseMap={() => ({})} getFacultyStaff={() => []}
      loadLessonPlans={() => ({})} gnsiGetReports={() => []}
      gnsiMonitorAlertCount={() => 0} renderFeeMonitorPanel={null}
      DEPT_COLORS={DEPT_COLORS}
    />
  )
}

// DataShell — all Supabase hooks live here, passed down to modules
function DataShell({ activePage, user }) {
  const { staff }                                                            = useStaff()
  const { students }                                                         = useStudents()
  const { leaves, subs, onLeavesChange, onSubsChange }                      = useLeave()
  const { notices, syncNotices }                                             = useNotices()
  const { receptionData, onDataChange: onReceptionChange }                  = useReception()
  const { appraisals, grievances, onAppraisalsChange, onGrievancesChange }  = useHR()
  const { timetableData, onTimetableChange }                                 = useTimetable()
  const { teachingData, onDataChange: onTeachingChange }                    = useTeaching()
  const { salaryData, advances, dutyData,
          onSalaryChange, onAdvancesChange, onDutyChange }                   = useSalary()
  const { reportData }                                                       = useReports()
  const { connectData, onDataChange: onConnectChange }                      = useConnect()

  const isOnline = navigator.onLine

  const p = {
    staff:        <StaffModule     currentUser={user} staff={staff} onStaffChange={() => {}} showToast={showToast} />,
    leave:        <LeaveModule     currentUser={user} staff={staff} leaves={leaves} subs={subs} onLeavesChange={onLeavesChange} onSubsChange={onSubsChange} showToast={showToast} />,
    substitute:   <LeaveModule     currentUser={user} staff={staff} leaves={leaves} subs={subs} onLeavesChange={onLeavesChange} onSubsChange={onSubsChange} showToast={showToast} />,
    notices:      <NoticesModule   currentUser={user} notices={notices} onNoticesChange={syncNotices} isOnline={isOnline} showToast={showToast} />,
    reception:    <ReceptionModule currentUser={user} receptionData={receptionData} onDataChange={onReceptionChange} showToast={showToast} />,
    appraisal:    <HRModule        currentUser={user} staff={staff} appraisals={appraisals} grievances={grievances} onAppraisalsChange={onAppraisalsChange} onGrievancesChange={onGrievancesChange} showToast={showToast} />,
    grievance:    <HRModule        currentUser={user} staff={staff} appraisals={appraisals} grievances={grievances} onAppraisalsChange={onAppraisalsChange} onGrievancesChange={onGrievancesChange} showToast={showToast} />,
    timetable:    <TimetableModule currentUser={user} timetableData={timetableData} students={students} onTimetableChange={onTimetableChange} showToast={showToast} />,
    doubttt:      <TimetableModule currentUser={user} timetableData={timetableData} students={students} onTimetableChange={onTimetableChange} showToast={showToast} />,
    teaching:     <TeachingModule  currentUser={user} teachingData={teachingData} onDataChange={onTeachingChange} showToast={showToast} />,
    diary:        <TeachingModule  currentUser={user} teachingData={teachingData} onDataChange={onTeachingChange} showToast={showToast} />,
    lessonbridge: <TeachingModule  currentUser={user} teachingData={teachingData} onDataChange={onTeachingChange} showToast={showToast} />,
    reports:      <ReportsModule   currentUser={user} staff={staff} students={students} appraisals={reportData.appraisals} attendance={reportData.attendance} showToast={showToast} />,
    reportcard:   <ReportsModule   currentUser={user} staff={staff} students={students} appraisals={reportData.appraisals} attendance={reportData.attendance} showToast={showToast} />,
    certificate:  <ReportsModule   currentUser={user} staff={staff} students={students} appraisals={reportData.appraisals} attendance={reportData.attendance} showToast={showToast} />,
    salary:       <SalaryModule    currentUser={user} staff={staff} salaryData={salaryData} advances={advances} dutyData={dutyData} onSalaryChange={onSalaryChange} onAdvancesChange={onAdvancesChange} onDutyChange={onDutyChange} showToast={showToast} />,
    staffsalary:  <SalaryModule    currentUser={user} staff={staff} salaryData={salaryData} advances={advances} dutyData={dutyData} onSalaryChange={onSalaryChange} onAdvancesChange={onAdvancesChange} onDutyChange={onDutyChange} showToast={showToast} />,
    dutyhours:    <SalaryModule    currentUser={user} staff={staff} salaryData={salaryData} advances={advances} dutyData={dutyData} onSalaryChange={onSalaryChange} onAdvancesChange={onAdvancesChange} onDutyChange={onDutyChange} showToast={showToast} />,
    periodsalary: <SalaryModule    currentUser={user} staff={staff} salaryData={salaryData} advances={advances} dutyData={dutyData} onSalaryChange={onSalaryChange} onAdvancesChange={onAdvancesChange} onDutyChange={onDutyChange} showToast={showToast} />,
    social:       <SocialModule    currentUser={user} staff={staff} showToast={showToast} />,
    sync:         <SystemModule    currentUser={user} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} />,
    aiassistant:  <SystemModule    currentUser={user} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} />,
    analytics:    <SystemModule    currentUser={user} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} />,
    assets:       <SystemModule    currentUser={user} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} />,
    backup:       <SystemModule    currentUser={user} staff={staff} students={students} notices={notices} showToast={showToast} isOnline={isOnline} />,
    connect:         <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
    parentfeedback:  <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
    ptm:             <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
    calendar:        <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
    library:         <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
    parent:          <ConnectModule currentUser={user} students={students} staff={staff} connectData={connectData} onDataChange={onConnectChange} showToast={showToast} />,
  }

  return p[activePage] || null
}

const STATIC_PAGES = {
  dashboard: Dashboard, students: Students, fees: Fees,
  admissions: Admissions, attendance: Attendance, accounts: Accounts,
  admin: AdminPage, exam: ExamPage, settings: UserManagement,
  boarder: BoarderPage, kitchen: KitchenPage, hostel: HostelPage,
  house: HousePage, housemaster: HousemasterPage, discipline: DisciplinePage,
  sickbay: SickbayPage, nightduty: NightDutyPage,
  courses: () => <ComingSoon page="🗂️ Courses" />,
}

const DATA_PAGES = new Set([
  'staff','leave','substitute','notices','reception',
  'appraisal','grievance','timetable','doubttt',
  'teaching','diary','lessonbridge',
  'reports','reportcard','certificate',
  'salary','staffsalary','dutyhours','periodsalary',
  'social','sync','aiassistant','analytics','assets','backup',
  'connect','parentfeedback','ptm','calendar','library','parent',
])

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

  const StaticPage = STATIC_PAGES[activePage]

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        {DATA_PAGES.has(activePage)
          ? <DataShell activePage={activePage} user={user} />
          : StaticPage
            ? <StaticPage />
            : <ComingSoon page={activePage} />
        }
      </main>
      <Toast />
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppShell /></AuthProvider>
}

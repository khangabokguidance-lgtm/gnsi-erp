import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ─── Module imports ────────────────────────────────────────────
import Login              from './Login'
import Students           from './Students'
import Admissions         from './Admissions'
import Sessions           from './Sessions'
import AdmissionSessions  from './AdmissionSessions'
import BulkAdmission      from './BulkAdmission'
import Fees               from './Fees'
import Accounts           from './Accounts'
import Salary             from './Salary'
import Staff              from './Staff'
import HR                 from './HR'
import Leave              from './Leave'
import Hostel             from './Hostel'
import Reception          from './Reception'
import Notice             from './Notice'
import Social             from './Social'
import Connect            from './Connect'
import Reports            from './Reports'
import Checklist          from './Checklist'
import SystemSettings     from './SystemSettings'
import AdminPage          from './AdminPage'
import StudentFeeLedger   from './StudentFeeLedger'
import GNSIDashboard      from './GNSIDashboard'
import Courses            from './Courses'
import Teaching           from './Teaching'
import Attendance         from './Attendance'
import Exams              from './Exams'
import Timetable          from './Timetable'
import FeeSetup           from './FeeSetup'
import QuestionBank       from './QuestionBank'

// ─── NEW Sidebar (replaces the old inline one) ─────────────────
import Sidebar from './TabSourceCollector'   // rename file to Sidebar.jsx when ready

// ─── Helpers ───────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

// ─── Shared UI ─────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend, accent }) {
  const accents = {
    blue:   { bg: '#eff6ff', border: '#1e3a5f', text: '#1e3a5f' },
    green:  { bg: '#dcfce7', border: '#16a34a', text: '#16a34a' },
    amber:  { bg: '#fef9c3', border: '#b45309', text: '#b45309' },
    purple: { bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed' },
    pink:   { bg: '#fce7f3', border: '#db2777', text: '#db2777' },
    cyan:   { bg: '#e0f2fe', border: '#0891b2', text: '#0891b2' },
    teal:   { bg: '#ccfbf1', border: '#0d9488', text: '#0d9488' },
    orange: { bg: '#ffedd5', border: '#ea580c', text: '#ea580c' },
    indigo: { bg: '#e0e7ff', border: '#4f46e5', text: '#4f46e5' },
  }
  const c = accents[accent] || accents.blue
  return (
    <div
      style={{ background: c.bg, borderRadius: 10, padding: '11px 14px', borderLeft: `3px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 2, transition: 'transform .15s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <p style={{ fontSize: 10, color: c.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.1 }}>{value}</h2>
      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{sub}</p>
      {trend !== undefined && (
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 3, background: '#fff', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${trend}%`, height: '100%', background: c.border, borderRadius: 99 }} />
          </div>
          <p style={{ fontSize: 9, color: c.text, marginTop: 2 }}>{trend}% of target</p>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 10, color: '#94a3b8', margin: '1px 0 0' }}>{sub}</p>}
    </div>
  )
}

function TableCard({ title, sub, cols, rows, emptyMsg }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</span>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {cols.map(c => (
                <th key={c} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 10, whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{emptyMsg || 'No data'}</td></tr>
              : rows}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Badge({ status }) {
  const map = {
    Approved: { bg: '#dcfce7', color: '#16a34a' },
    Rejected: { bg: '#fee2e2', color: '#dc2626' },
    Pending:  { bg: '#fef9c3', color: '#b45309' },
    Present:  { bg: '#dcfce7', color: '#16a34a' },
    Absent:   { bg: '#fee2e2', color: '#dc2626' },
    Paid:     { bg: '#dcfce7', color: '#16a34a' },
    Unpaid:   { bg: '#fee2e2', color: '#dc2626' },
    Partial:  { bg: '#fef9c3', color: '#b45309' },
  }
  const s = map[status] || { bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function Ring({ value, max, color, label, size = 64 }) {
  const r = 30, circ = 2 * Math.PI * r
  const p = max ? Math.min(value / max, 1) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${p * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" />
        <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
          {Math.round(p * 100)}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// ─── Admin Dashboard ───────────────────────────────────────────
function AdminDashboard({ onNavigate }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [
        students, fees, attendance, admissions, exams, staff,
        recentStudents, recentAdmissions, recentFees, salary, leave,
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('fees').select('amount,paid'),
        supabase.from('attendance').select('status'),
        supabase.from('admissions').select('*'),
        supabase.from('exams').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('id,name,class_name,course,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('admissions').select('id,name,class_name,status,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('fees').select('id,student_id,amount,paid,due_date').order('due_date', { ascending: true }).limit(6),
        supabase.from('salary').select('amount,status'),
        supabase.from('leave').select('status'),
      ])

      let feeCollected = 0, feePending = 0
      ;(fees.data || []).forEach(f => {
        feeCollected += Number(f.paid   || 0)
        feePending   += Number(f.amount || 0) - Number(f.paid || 0)
      })
      let salaryPaid = 0, salaryPending = 0
      ;(salary.data || []).forEach(s => {
        if (s.status === 'Paid') salaryPaid    += Number(s.amount || 0)
        else                     salaryPending += Number(s.amount || 0)
      })

      setData({
        totalStudents: students.count ?? 0,
        totalStaff:    staff.count    ?? 0,
        totalExams:    exams.count    ?? 0,
        feeCollected, feePending,
        presentCount:  (attendance.data || []).filter(a => a.status === 'Present').length,
        totalAtt:      (attendance.data || []).length,
        pendingAdm:    (admissions.data || []).filter(a => a.status === 'Pending').length,
        approvedAdm:   (admissions.data || []).filter(a => a.status === 'Approved').length,
        totalAdm:      (admissions.data || []).length,
        salaryPaid, salaryPending,
        pendingLeave:  (leave.data || []).filter(l => l.status === 'Pending').length,
        recentStudents:   recentStudents.data   || [],
        recentAdmissions: recentAdmissions.data || [],
        recentFees:       recentFees.data       || [],
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading live data…</div>
  if (!data)   return null

  const feeTotal    = data.feeCollected + data.feePending
  const feeProgress = feeTotal ? Math.round((data.feeCollected / feeTotal) * 100) : 0

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>🏠 Admin Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { icon: '👨‍🎓', label: 'Total Students',  value: data.totalStudents,     sub: 'Enrolled',            accent: 'blue'   },
          { icon: '💰',  label: 'Fee Collected',    value: fmt(data.feeCollected), sub: 'Total paid so far',   accent: 'green',  trend: feeProgress },
          { icon: '⏳',  label: 'Fee Pending',      value: fmt(data.feePending),   sub: 'Outstanding balance', accent: 'amber'  },
          { icon: '🏫',  label: 'Present Today',    value: data.presentCount,      sub: `of ${data.totalAtt}`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
          { icon: '📋',  label: 'New Admissions',   value: data.pendingAdm,        sub: 'Awaiting approval',   accent: 'pink'   },
          { icon: '📝',  label: 'Total Exams',      value: data.totalExams,        sub: 'Scheduled',           accent: 'cyan'   },
          { icon: '👨‍🏫', label: 'Total Staff',      value: data.totalStaff,        sub: 'Active staff',        accent: 'teal'   },
          { icon: '💵',  label: 'Salary Paid',      value: fmt(data.salaryPaid),   sub: 'This month',          accent: 'indigo' },
          { icon: '🏖️', label: 'Leave Requests',   value: data.pendingLeave,      sub: 'Pending approval',    accent: 'orange' },
        ].map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', padding: '12px 16px', marginBottom: 16 }}>
        <SectionHeader title="📊 Live Progress Overview" sub="Real-time computed metrics" />
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 }}>
          <Ring value={data.feeCollected} max={feeTotal || 1}                                     color="#16a34a" label="Fee Collected" />
          <Ring value={data.presentCount} max={Math.max(data.totalAtt, 1)}                        color="#7c3aed" label="Attendance"    />
          <Ring value={data.approvedAdm}  max={Math.max(data.totalAdm, 1)}                        color="#0891b2" label="Admissions"    />
          <Ring value={data.salaryPaid}   max={Math.max(data.salaryPaid + data.salaryPending, 1)} color="#4f46e5" label="Salary"        />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
        <TableCard
          title="👨‍🎓 Recent Students" sub="Last 6 enrolled"
          cols={['Name', 'Class', 'Course']} emptyMsg="No students"
          rows={data.recentStudents.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{s.name}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{s.class_name}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{s.course || '—'}</td>
            </tr>
          ))}
        />
        <TableCard
          title="📋 Recent Admissions" sub="Last 6"
          cols={['Name', 'Class', 'Status']} emptyMsg="No admissions"
          rows={data.recentAdmissions.map(a => (
            <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{a.name}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{a.class_name}</td>
              <td style={{ padding: '6px 12px' }}><Badge status={a.status} /></td>
            </tr>
          ))}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.06)', padding: '12px 16px' }}>
        <SectionHeader title="⚡ Quick Actions" sub="One-click shortcuts" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: '➕ Add Student',    color: '#1e3a5f', module: 'students'      },
            { label: '📋 New Admission',  color: '#7c3aed', module: 'admissions'    },
            { label: '💵 Record Fee',     color: '#16a34a', module: 'fees'          },
            { label: '📊 Courses',        color: '#0d9488', module: 'courses'       },
            { label: '📚 Teaching Log',   color: '#0891b2', module: 'teaching'      },
            { label: '📅 Attendance',     color: '#db2777', module: 'attendance'    },
            { label: '📝 Exams',          color: '#16a34a', module: 'exams'         },
            { label: '🕐 Timetable',      color: '#b45309', module: 'timetable'     },
            { label: '❓ Question Bank',  color: '#7c3aed', module: 'questionbank'  },
            { label: '🏖️ Approve Leave', color: '#b45309', module: 'leave'         },
            { label: '🔔 Send Notice',    color: '#ea580c', module: 'notice'        },
            { label: '📈 Reports',        color: '#4f46e5', module: 'reports'       },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => onNavigate(a.module)}
              style={{ background: a.color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── User Dashboard ────────────────────────────────────────────
function UserDashboard({ onNavigate, currentUser }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [attendance, exams, fees, leave, notices] = await Promise.all([
        supabase.from('attendance').select('status,date').order('date', { ascending: false }).limit(30),
        supabase.from('exams').select('*').order('date', { ascending: true }).limit(5),
        supabase.from('fees').select('amount,paid,due_date').order('due_date', { ascending: true }).limit(5),
        supabase.from('leave').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(4),
      ])
      const att = attendance.data || []
      let feePaid = 0, feeDue = 0
      ;(fees.data || []).forEach(f => {
        feePaid += Number(f.paid   || 0)
        feeDue  += Number(f.amount || 0) - Number(f.paid || 0)
      })
      setData({
        presentCount:  att.filter(a => a.status === 'Present').length,
        totalAtt:      att.length,
        upcomingExams: exams.data   || [],
        fees:          fees.data    || [],
        feePaid, feeDue,
        leaveRequests: leave.data   || [],
        pendingLeave:  (leave.data || []).filter(l => l.status === 'Pending').length,
        notices:       notices.data || [],
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading…</div>
  if (!data)   return null

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>
          👤 Welcome, {currentUser.name}
        </h1>
        <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
          {currentUser.role} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { icon: '📅', label: 'Days Present',   value: data.presentCount,        sub: `of ${data.totalAtt}`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
          { icon: '💰', label: 'Fee Due',         value: fmt(data.feeDue),          sub: 'Outstanding',         accent: 'amber'  },
          { icon: '✅', label: 'Fee Paid',        value: fmt(data.feePaid),         sub: 'Paid so far',         accent: 'green'  },
          { icon: '📝', label: 'Upcoming Exams',  value: data.upcomingExams.length, sub: 'Scheduled',           accent: 'cyan'   },
          { icon: '🏖️', label: 'Leave Pending',  value: data.pendingLeave,         sub: 'Awaiting approval',   accent: 'orange' },
          { icon: '🔔', label: 'Notices',         value: data.notices.length,       sub: 'Recent',              accent: 'pink'   },
        ].map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        <TableCard
          title="📝 Upcoming Exams"
          cols={['Subject', 'Date', 'Time']} emptyMsg="No exams"
          rows={data.upcomingExams.map(e => (
            <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{e.subject || e.name}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{e.date || '—'}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{e.time || '—'}</td>
            </tr>
          ))}
        />
        <TableCard
          title="🏖️ Leave Requests"
          cols={['Type', 'From', 'To', 'Status']} emptyMsg="No requests"
          rows={data.leaveRequests.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 11 }}>{l.type || '—'}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{l.from_date || '—'}</td>
              <td style={{ padding: '6px 12px', color: '#64748b', fontSize: 11 }}>{l.to_date || '—'}</td>
              <td style={{ padding: '6px 12px' }}><Badge status={l.status} /></td>
            </tr>
          ))}
        />
      </div>
    </div>
  )
}

// ─── Access Denied ─────────────────────────────────────────────
function AccessDenied() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
      <h2 style={{ color: '#dc2626' }}>Access Denied</h2>
      <p>You don't have permission to view this module.</p>
    </div>
  )
}

// ─── App Root ──────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [active,      setActive]      = useState('dashboard')
  const [permissions, setPermissions] = useState({})
  const [permLoading, setPermLoading] = useState(false)

  const loadPermissions = async (role) => {
    if (role === 'Admin') return
    setPermLoading(true)
    const { data } = await supabase
      .from('role_permissions')
      .select('module_key, allowed')
      .eq('role', role)
    const map = {}
    ;(data || []).forEach(r => { map[r.module_key] = r.allowed })
    setPermissions(map)
    setPermLoading(false)
  }

  const handleLogin  = (user) => { setCurrentUser(user); setActive('dashboard'); loadPermissions(user.role) }
  const handleLogout = ()     => { setCurrentUser(null); setActive('dashboard'); setPermissions({}) }

  if (!currentUser) return <Login onLogin={handleLogin} />
  if (permLoading)  return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading permissions…</div>

  const isAdmin = currentUser.role === 'Admin'

  const canAccess = (key) => {
    if (key === 'dashboard') return true
    if (isAdmin) return true
    return permissions[key] === true
  }

  const renderContent = () => {
    if (active === 'dashboard') {
      return isAdmin
        ? <GNSIDashboard />
        : <UserDashboard onNavigate={setActive} currentUser={currentUser} />
    }

    if (active === 'admin') {
      return isAdmin ? <AdminPage currentUser={currentUser} /> : <AccessDenied />
    }

    if (!canAccess(active)) return <AccessDenied />

    const moduleMap = {
      students:             <Students          currentUser={currentUser} />,
      admissions:           <Admissions        currentUser={currentUser} />,
      sessions:             <Sessions          currentUser={currentUser} />,
      admissionsessions:    <AdmissionSessions currentUser={currentUser} />,
      'bulk-admission-fee': <BulkAdmission     currentUser={currentUser} />,
      bulkadmission:        <BulkAdmission     currentUser={currentUser} />,
      fees:                 <Fees              currentUser={currentUser} />,
      accounts:             <Accounts          role={currentUser.role?.toLowerCase()} />,
      salary:               <Salary            currentUser={currentUser} />,
      staff:                <Staff             currentUser={currentUser} />,
      hr:                   <HR                currentUser={currentUser} />,
      leave:                <Leave             currentUser={currentUser} />,
      hostel:               <Hostel            currentUser={currentUser} />,
      reception:            <Reception         currentUser={currentUser} />,
      notice:               <Notice            currentUser={currentUser} />,
      social:               <Social            currentUser={currentUser} />,
      connect:              <Connect           currentUser={currentUser} />,
      reports:              <Reports           currentUser={currentUser} />,
      checklist:            <Checklist         currentUser={currentUser} />,
      'management-checklist': <Checklist       currentUser={currentUser} />,
      system:               <SystemSettings    currentUser={currentUser} />,
      studentfeeledger:     <StudentFeeLedger  currentUser={currentUser} />,
      courses:              <Courses           currentUser={currentUser} />,
      teaching:             <Teaching          currentUser={currentUser} />,
      attendance:           <Attendance        currentUser={currentUser} />,
      exams:                <Exams             currentUser={currentUser} />,
      timetable:            <Timetable         currentUser={currentUser} />,
      feesetup:             <FeeSetup          userRole={currentUser.role} />,
      questionbank:         <QuestionBank      currentUser={currentUser} />,
    }

    return moduleMap[active] || (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <h2 style={{ color: '#1e3a5f' }}>Module coming soon</h2>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      minHeight: '100vh',
      background: '#f8fafc',
    }}>
      {/* ── New grouped Sidebar ── */}
      <Sidebar
        activePage={active}
        setActivePage={setActive}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* ── Main content ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: '100vh',
        marginLeft: 262,       // matches new sidebar width (262px fixed)
        paddingTop: 0,
      }}>
        {renderContent()}
      </main>
    </div>
  )
}
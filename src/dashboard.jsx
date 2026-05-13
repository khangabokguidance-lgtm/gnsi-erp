import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ─── Role config ───────────────────────────────────────────────
const ADMIN_MODULES = [
  { key: 'dashboard', icon: '⊞', label: 'Dashboard' },
  { key: 'students', icon: '🎓', label: 'Students' },
  { key: 'admissions', icon: '📋', label: 'Admissions' },
  { key: 'bulkadmission', icon: '📥', label: 'Bulk Admission' },
  { key: 'fees', icon: '💰', label: 'Fees' },
  { key: 'accounts', icon: '🧾', label: 'Accounts' },
  { key: 'salary', icon: '💵', label: 'Salary' },
  { key: 'attendance', icon: '📅', label: 'Attendance' },
  { key: 'exams', icon: '📝', label: 'Exams' },
  { key: 'timetable', icon: '🕐', label: 'Timetable' },
  { key: 'teaching', icon: '📚', label: 'Teaching' },
  { key: 'staff', icon: '👨‍🏫', label: 'Staff' },
  { key: 'hr', icon: '🗂️', label: 'HR' },
  { key: 'leave', icon: '🏖️', label: 'Leave' },
  { key: 'hostel', icon: '🏨', label: 'Hostel' },
  { key: 'reception', icon: '🛎️', label: 'Reception' },
  { key: 'notice', icon: '🔔', label: 'Notice' },
  { key: 'social', icon: '📣', label: 'Social' },
  { key: 'connect', icon: '🔗', label: 'Connect' },
  { key: 'courses', icon: '📊', label: 'Courses' },
  { key: 'reports', icon: '📈', label: 'Reports' },
  { key: 'checklist', icon: '✅', label: 'Checklist' },
  { key: 'system', icon: '⚙️', label: 'System' },
  { key: 'admin', icon: '🔐', label: 'Admin' },
]

const USER_MODULES = [
  { key: 'dashboard', icon: '⊞', label: 'Dashboard' },
  { key: 'attendance', icon: '📅', label: 'Attendance' },
  { key: 'exams', icon: '📝', label: 'Exams' },
  { key: 'bulkadmission', icon: '📥', label: 'Bulk Admission' },
  { key: 'fees', icon: '💰', label: 'Fees' },
  { key: 'staff', icon: '👨‍🏫', label: 'Staff' },
  { key: 'hr', icon: '🗂️', label: 'HR' },
  { key: 'leave', icon: '🏖️', label: 'Leave' },
  { key: 'timetable', icon: '🕐', label: 'Timetable' },
  { key: 'teaching', icon: '📚', label: 'Teaching' },
  { key: 'hostel', icon: '🏨', label: 'Hostel' },
  { key: 'reception', icon: '🛎️', label: 'Reception' },
  { key: 'notice', icon: '🔔', label: 'Notice' },
  { key: 'social', icon: '📣', label: 'Social' },
  { key: 'connect', icon: '🔗', label: 'Connect' },
  { key: 'courses', icon: '📊', label: 'Courses' },
]

// ─── Helpers ───────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

// ─── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend, accent }) {
  const accents = {
    blue:   { bg: '#eff6ff', border: '#1e3a5f', text: '#1e3a5f' },
    green:  { bg: '#dcfce7', border: '#16a34a', text: '#16a34a' },
    amber:  { bg: '#fef9c3', border: '#b45309', text: '#b45309' },
    purple: { bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed' },
    pink:   { bg: '#fce7f3', border: '#db2777', text: '#db2777' },
    cyan:   { bg: '#e0f2fe', border: '#0891b2', text: '#0891b2' },
    red:    { bg: '#fee2e2', border: '#dc2626', text: '#dc2626' },
    teal:   { bg: '#ccfbf1', border: '#0d9488', text: '#0d9488' },
    orange: { bg: '#ffedd5', border: '#ea580c', text: '#ea580c' },
    indigo: { bg: '#e0e7ff', border: '#4f46e5', text: '#4f46e5' },
  }
  const c = accents[accent] || accents.blue
  return (
    <div style={{
      background: c.bg,
      borderRadius: 14,
      padding: '18px 20px',
      borderLeft: `4px solid ${c.border}`,
      display: 'flex', flexDirection: 'column', gap: 4,
      transition: 'transform .15s',
      cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ fontSize: 26 }}>{icon}</div>
      <p style={{ fontSize: 11, color: c.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: c.text, margin: 0, lineHeight: 1.1 }}>{value}</h2>
      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{sub}</p>
      {trend !== undefined && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 4, background: '#fff', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${trend}%`, height: '100%', background: c.border, borderRadius: 99, transition: 'width 1s ease' }} />
          </div>
          <p style={{ fontSize: 10, color: c.text, marginTop: 3 }}>{trend}% of target</p>
        </div>
      )}
    </div>
  )
}

// ─── Section Header ────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

// ─── Table Card ────────────────────────────────────────────────
function TableCard({ title, sub, cols, rows, emptyMsg }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding: '22px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{emptyMsg || 'No data'}</td></tr>
          ) : rows}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ status }) {
  const map = {
    Approved:  { bg: '#dcfce7', color: '#16a34a' },
    Rejected:  { bg: '#fee2e2', color: '#dc2626' },
    Pending:   { bg: '#fef9c3', color: '#b45309' },
    Present:   { bg: '#dcfce7', color: '#16a34a' },
    Absent:    { bg: '#fee2e2', color: '#dc2626' },
    Active:    { bg: '#dcfce7', color: '#16a34a' },
    Inactive:  { bg: '#fee2e2', color: '#dc2626' },
    Paid:      { bg: '#dcfce7', color: '#16a34a' },
    Unpaid:    { bg: '#fee2e2', color: '#dc2626' },
    Partial:   { bg: '#fef9c3', color: '#b45309' },
  }
  const s = map[status] || { bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

// ─── Progress Ring ─────────────────────────────────────────────
function Ring({ value, max, color, label, size = 80 }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const pct = max ? Math.min(value / max, 1) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{Math.round(pct * 100)}%</text>
      </svg>
      <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// ─── Placeholder page ──────────────────────────────────────────
function PlaceholderPage({ module }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{module.icon}</div>
      <h2 style={{ color: '#1e3a5f', marginBottom: 6 }}>{module.label}</h2>
      <p style={{ fontSize: 14 }}>This module is under construction.</p>
    </div>
  )
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────
function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const today = new Date().toLocaleDateString('en-CA')

      const [students, fees, attendance, admissions, exams, staff, recentStudents,
        recentAdmissions, recentFees, salary, leave] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('fees').select('amount,paid'),
        supabase.from('attendance').select('status'),
        supabase.from('admissions').select('*'),
        supabase.from('exams').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('students').select('id,name,class_name,course,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('admissions').select('id,name,class_name,status,created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('fees').select('id,student_id,amount,paid,due_date').order('due_date', { ascending: true }).limit(6),
        supabase.from('salary').select('amount,status'),
        supabase.from('leave').select('status'),
      ])

      let feeCollected = 0, feePending = 0
      ;(fees.data || []).forEach(f => {
        feeCollected += Number(f.paid || 0)
        feePending   += Number(f.amount || 0) - Number(f.paid || 0)
      })

      let salaryPaid = 0, salaryPending = 0
      ;(salary.data || []).forEach(s => {
        if (s.status === 'Paid') salaryPaid += Number(s.amount || 0)
        else salaryPending += Number(s.amount || 0)
      })

      const presentCount = (attendance.data || []).filter(a => a.status === 'Present').length
      const totalAtt = (attendance.data || []).length
      const pendingAdm = (admissions.data || []).filter(a => a.status === 'Pending').length
      const approvedAdm = (admissions.data || []).filter(a => a.status === 'Approved').length
      const pendingLeave = (leave.data || []).filter(l => l.status === 'Pending').length

      setData({
        totalStudents: students.count ?? 0,
        totalStaff: staff.count ?? 0,
        totalExams: exams.count ?? 0,
        feeCollected, feePending,
        presentCount, totalAtt,
        pendingAdm, approvedAdm,
        totalAdm: (admissions.data || []).length,
        salaryPaid, salaryPending,
        pendingLeave,
        recentStudents: recentStudents.data || [],
        recentAdmissions: recentAdmissions.data || [],
        recentFees: recentFees.data || [],
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading live data…</div>
  if (!data) return null

  const feeTotal = data.feeCollected + data.feePending
  const feeProgress = feeTotal ? Math.round((data.feeCollected / feeTotal) * 100) : 0

  const statCards = [
    { icon: '👨‍🎓', label: 'Total Students',    value: data.totalStudents,          sub: 'Enrolled',            accent: 'blue'   },
    { icon: '💰', label: 'Fee Collected',     value: fmt(data.feeCollected),      sub: 'Total paid so far',   accent: 'green',  trend: feeProgress },
    { icon: '⏳', label: 'Fee Pending',       value: fmt(data.feePending),        sub: 'Outstanding balance', accent: 'amber'  },
    { icon: '🏫', label: 'Present Today',     value: data.presentCount,           sub: `of ${data.totalAtt} tracked`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
    { icon: '📋', label: 'New Admissions',    value: data.pendingAdm,             sub: 'Awaiting approval',   accent: 'pink'   },
    { icon: '📝', label: 'Total Exams',       value: data.totalExams,             sub: 'Scheduled',           accent: 'cyan'   },
    { icon: '👨‍🏫', label: 'Total Staff',       value: data.totalStaff,             sub: 'Total staff', accent: 'teal' },
    { icon: '💵', label: 'Salary Paid',       value: fmt(data.salaryPaid),        sub: 'Disbursed this month', accent: 'indigo' },
    { icon: '🏖️', label: 'Leave Requests',    value: data.pendingLeave,           sub: 'Pending approval',    accent: 'orange' },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>🏠 Admin Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Progress Overview */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: '18px 24px', marginBottom: 28 }}>
        <SectionHeader title="📊 Live Progress Overview" sub="Real-time computed metrics" />
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
          <Ring value={data.feeCollected} max={data.feeCollected + data.feePending} color="#16a34a" label="Fee Collected" />
          <Ring value={data.presentCount} max={Math.max(data.totalAtt, 1)} color="#7c3aed" label="Attendance" />
          <Ring value={data.approvedAdm} max={Math.max(data.totalAdm, 1)} color="#0891b2" label="Admissions Approved" />
          <Ring value={data.salaryPaid} max={Math.max(data.salaryPaid + data.salaryPending, 1)} color="#4f46e5" label="Salary Disbursed" />
          <Ring value={(data.pendingLeave === 0 ? 1 : 0)} max={1} color="#ea580c" label="Leave Cleared" />
        </div>
      </div>

      {/* Tables Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <TableCard
          title="👨‍🎓 Recent Students" sub="Last 6 enrolled"
          cols={['Name', 'Class', 'Course']}
          emptyMsg="No students yet"
          rows={data.recentStudents.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '9px 16px', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{s.name}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{s.class_name}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{s.course || '—'}</td>
            </tr>
          ))}
        />
        <TableCard
          title="📋 Recent Admissions" sub="Last 6 applications"
          cols={['Name', 'Class', 'Status']}
          emptyMsg="No admissions yet"
          rows={data.recentAdmissions.map(a => (
            <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '9px 16px', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{a.name}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{a.class_name}</td>
              <td style={{ padding: '9px 16px' }}><Badge status={a.status} /></td>
            </tr>
          ))}
        />
      </div>

      <TableCard
        title="💰 Fee Overview" sub="Upcoming dues"
        cols={['Student ID', 'Total Amount', 'Paid', 'Balance', 'Due Date']}
        emptyMsg="No fee records"
        rows={data.recentFees.map(f => {
          const bal = Number(f.amount || 0) - Number(f.paid || 0)
          return (
            <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '9px 16px', color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{f.student_id || '—'}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{fmt(f.amount)}</td>
              <td style={{ padding: '9px 16px', color: '#16a34a', fontSize: 12, fontWeight: 600 }}>{fmt(f.paid)}</td>
              <td style={{ padding: '9px 16px', fontSize: 12 }}><Badge status={bal <= 0 ? 'Paid' : Number(f.paid) > 0 ? 'Partial' : 'Unpaid'} /></td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{f.due_date || '—'}</td>
            </tr>
          )
        })}
      />

      {/* Quick Actions */}
      <div style={{ marginTop: 24, background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: '18px 24px' }}>
        <SectionHeader title="⚡ Quick Actions" sub="One-click admin shortcuts" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: '➕ Add Student', color: '#1e3a5f' },
            { label: '📋 New Admission', color: '#7c3aed' },
            { label: '💵 Record Fee', color: '#16a34a' },
            { label: '📝 Schedule Exam', color: '#0891b2' },
            { label: '📅 Mark Attendance', color: '#db2777' },
            { label: '🏖️ Approve Leave', color: '#b45309' },
            { label: '🔔 Send Notice', color: '#ea580c' },
            { label: '📊 View Reports', color: '#4f46e5' },
          ].map(a => (
            <button key={a.label} style={{
              background: a.color, color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'opacity .15s'
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── USER DASHBOARD ───────────────────────────────────────────
function UserDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const today = new Date().toLocaleDateString('en-CA')
      const [attendance, exams, fees, leave, notices, timetable] = await Promise.all([
        supabase.from('attendance').select('status,date').order('date', { ascending: false }).limit(30),
        supabase.from('exams').select('*').order('date', { ascending: true }).limit(5),
        supabase.from('fees').select('amount,paid,due_date').order('due_date', { ascending: true }).limit(5),
        supabase.from('leave').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(4),
        supabase.from('timetable').select('*').order('day', { ascending: true }).limit(8),
      ])

      const att = attendance.data || []
      const present = att.filter(a => a.status === 'Present').length

      let myFeeCollected = 0, myFeePending = 0
      ;(fees.data || []).forEach(f => {
        myFeeCollected += Number(f.paid || 0)
        myFeePending   += Number(f.amount || 0) - Number(f.paid || 0)
      })

      setData({
        presentCount: present, totalAtt: att.length,
        upcomingExams: exams.data || [],
        feeDue: myFeePending, feePaid: myFeeCollected,
        fees: fees.data || [],
        leaveRequests: leave.data || [],
        pendingLeave: (leave.data || []).filter(l => l.status === 'Pending').length,
        notices: notices.data || [],
        timetable: timetable.data || [],
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>⏳ Loading your data…</div>
  if (!data) return null

  const statCards = [
    { icon: '📅', label: 'Days Present',     value: data.presentCount,         sub: `out of ${data.totalAtt} days`, accent: 'purple', trend: pct(data.presentCount, data.totalAtt) },
    { icon: '💰', label: 'Fee Due',          value: fmt(data.feeDue),           sub: 'Outstanding balance',   accent: 'amber'  },
    { icon: '✅', label: 'Fee Paid',         value: fmt(data.feePaid),          sub: 'Paid so far',           accent: 'green'  },
    { icon: '📝', label: 'Upcoming Exams',   value: data.upcomingExams.length,  sub: 'Scheduled exams',       accent: 'cyan'   },
    { icon: '🏖️', label: 'Leave Pending',   value: data.pendingLeave,          sub: 'Awaiting approval',     accent: 'orange' },
    { icon: '🔔', label: 'Notices',         value: data.notices.length,         sub: 'Recent announcements',  accent: 'pink'   },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>👤 My Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Upcoming Exams */}
        <TableCard
          title="📝 Upcoming Exams" sub="Next scheduled exams"
          cols={['Subject', 'Date', 'Time']}
          emptyMsg="No exams scheduled"
          rows={data.upcomingExams.map(e => (
            <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '9px 16px', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{e.subject || e.name}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{e.date || '—'}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{e.time || '—'}</td>
            </tr>
          ))}
        />
        {/* Leave Requests */}
        <TableCard
          title="🏖️ My Leave Requests" sub="Recent applications"
          cols={['Type', 'From', 'To', 'Status']}
          emptyMsg="No leave requests"
          rows={data.leaveRequests.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '9px 16px', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{l.type || l.reason || '—'}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{l.from_date || l.start_date || '—'}</td>
              <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{l.to_date || l.end_date || '—'}</td>
              <td style={{ padding: '9px 16px' }}><Badge status={l.status} /></td>
            </tr>
          ))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Fee Status */}
        <TableCard
          title="💰 My Fee Status" sub="Upcoming dues"
          cols={['Amount', 'Paid', 'Due Date', 'Status']}
          emptyMsg="No fee records"
          rows={data.fees.map((f, i) => {
            const bal = Number(f.amount || 0) - Number(f.paid || 0)
            return (
              <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 16px', color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{fmt(f.amount)}</td>
                <td style={{ padding: '9px 16px', color: '#16a34a', fontSize: 12 }}>{fmt(f.paid)}</td>
                <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{f.due_date || '—'}</td>
                <td style={{ padding: '9px 16px' }}><Badge status={bal <= 0 ? 'Paid' : Number(f.paid) > 0 ? 'Partial' : 'Unpaid'} /></td>
              </tr>
            )
          })}
        />
        {/* Notices */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>🔔 Recent Notices</h3>
          </div>
          <div style={{ padding: '8px 16px' }}>
            {data.notices.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No notices</p>
            ) : data.notices.map((n, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < data.notices.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{n.title || n.heading || 'Notice'}</p>
                <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 11 }}>{n.content || n.message || n.body || '—'}</p>
                <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: 10 }}>{n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN') : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timetable */}
      {data.timetable.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <TableCard
            title="🕐 My Timetable" sub="Current schedule"
            cols={['Day', 'Subject', 'Teacher', 'Time', 'Room']}
            emptyMsg="No timetable"
            rows={data.timetable.map((t, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 16px', fontWeight: 700, color: '#1e3a5f', fontSize: 12 }}>{t.day}</td>
                <td style={{ padding: '9px 16px', color: '#1e293b', fontSize: 12 }}>{t.subject}</td>
                <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{t.teacher || '—'}</td>
                <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{t.time || '—'}</td>
                <td style={{ padding: '9px 16px', color: '#64748b', fontSize: 12 }}>{t.room || '—'}</td>
              </tr>
            ))}
          />
        </div>
      )}
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ modules, active, onSelect, role, onRoleSwitch }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, background: '#0f172a',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0, overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>🏫 EduERP</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>School Management System</div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Admin', 'User'].map(r => (
            <button key={r} onClick={() => onRoleSwitch(r)} style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: role === r ? '#3b82f6' : '#1e293b',
              color: role === r ? '#fff' : '#64748b',
              transition: 'all .15s'
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {modules.map(m => (
          <button key={m.key} onClick={() => onSelect(m.key)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
            background: active === m.key ? '#1e3a5f' : 'transparent',
            color: active === m.key ? '#fff' : '#94a3b8',
            fontSize: 13, fontWeight: active === m.key ? 700 : 400,
            borderLeft: active === m.key ? '3px solid #3b82f6' : '3px solid transparent',
            transition: 'all .12s',
          }}
            onMouseEnter={e => { if (active !== m.key) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#e2e8f0' } }}
            onMouseLeave={e => { if (active !== m.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' } }}
          >
            <span style={{ fontSize: 15 }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', fontSize: 11, color: '#475569' }}>
        © {new Date().getFullYear()} EduERP
      </div>
    </div>
  )
}

// ─── APP ROOT ─────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState('Admin')
  const [active, setActive] = useState('dashboard')

  const modules = role === 'Admin' ? ADMIN_MODULES : USER_MODULES

  const handleRoleSwitch = (r) => {
    setRole(r)
    setActive('dashboard')
  }

  const renderContent = () => {
    if (active === 'dashboard') {
      return role === 'Admin' ? <AdminDashboard /> : <UserDashboard />
    }
    const mod = modules.find(m => m.key === active)
    return mod ? <PlaceholderPage module={mod} /> : null
  }

  return (
    <div style={{ display: 'flex', fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar
        modules={modules}
        active={active}
        onSelect={setActive}
        role={role}
        onRoleSwitch={handleRoleSwitch}
      />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {renderContent()}
      </main>
    </div>
  )
}
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'
import { useCurrentUser } from './useCurrentUser'

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

// ─── Accrual calculator ───────────────────────────────────────────────────────
// Academic year: January 1 → December 31
// 1 day per completed month, resets every January 1
// January itself counts (staff start with 1 day on January 1)
function calcAccruedDays() {
  const today = new Date()
  const m = today.getMonth()   // 0-indexed
  const y = today.getFullYear()
  const academicStart = m >= 0 ? new Date(y, 0, 1) : new Date(y - 1, 0, 1)
  const monthsElapsed =
    (today.getFullYear() - academicStart.getFullYear()) * 12 +
    (today.getMonth() - academicStart.getMonth())
  return Math.min(monthsElapsed + 1, 12)  // +1 so April counts immediately
}

function getAcademicYearStart() {
  const today = new Date()
  const m = today.getMonth()
  const y = today.getFullYear()
  return m >= 3 ? `${y}-04-01` : `${y - 1}-04-01`
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAVE_TYPES = ['Casual Leave', 'Sick Leave']

const emptyForm = {
  staff_id: '',
  leave_type: 'Casual Leave',
  from_date: '',
  to_date: '',
  reason: '',
  is_paid: true,
  half_day_type: 'Full Day'
}

const iStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white',
  boxSizing: 'border-box', fontFamily: 'inherit'
}
const lStyle = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px'
}

const statusStyle = (status) => {
  const map = {
    Pending:  { bg: '#fef9c3', color: '#ca8a04' },
    Approved: { bg: '#dcfce7', color: '#16a34a' },
    Rejected: { bg: '#fee2e2', color: '#dc2626' }
  }
  const s = map[status] || { bg: '#e5e7eb', color: '#374151' }
  return {
    padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
    fontWeight: '600', backgroundColor: s.bg, color: s.color, display: 'inline-block'
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateDays = (from, to, halfDayType) => {
  if (!from || !to) return 0
  const start = new Date(from)
  const end = new Date(to)
  const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1
  return halfDayType === 'Full Day' ? diffDays : diffDays * 0.5
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

const exportToCSV = (data, filename) => {
  const headers = Object.keys(data[0] || {}).join(',')
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
}

// ─── Component ────────────────────────────────────────────────────────────────
function Leave({ currentUser: currentUserProp }) {
  const mobile = useMobile()
  const { currentUser, userLoading } = useCurrentUser(currentUserProp)

  const canManage     = useMemo(() => currentUser?.role === 'Admin' || currentUser?.role === 'Teaching + Admin', [currentUser])
  const isLimitedUser = useMemo(() => currentUser?.role === 'Teaching' || currentUser?.role === 'Non-Teaching', [currentUser])

  const [staff,          setStaff]          = useState([])
  const [leaves,         setLeaves]         = useState([])
  const [history,        setHistory]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [showForm,       setShowForm]       = useState(false)
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('All')
  const [form,           setForm]           = useState(emptyForm)
  const [selectedItems,  setSelectedItems]  = useState(new Set())
  const [viewMode,       setViewMode]       = useState('list')
  const [detailModal,    setDetailModal]    = useState(null)
  const [dateError,      setDateError]      = useState('')
  const [overlapWarning, setOverlapWarning] = useState('')

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (userLoading || !currentUser) return
    setLoading(true)
    const allStaff = await staffDB.getAll()
    let query = supabase
      .from('leave_requests')
      .select('*, staff_profiles(name, department, designation, daily_salary, leave_balance)')
      .order('created_at', { ascending: false })
    if (isLimitedUser) query = query.eq('staff_id', currentUser.id)
    const { data: leaveData } = await query
    setStaff(isLimitedUser ? allStaff.filter(s => s.id === currentUser.id) : allStaff)
    setLeaves(leaveData || [])
    setLoading(false)
  }, [currentUser, userLoading, isLimitedUser])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Date & overlap validation ─────────────────────────────────────────────
  useEffect(() => {
    setDateError(''); setOverlapWarning('')
    if (form.from_date && form.to_date) {
      if (new Date(form.to_date) < new Date(form.from_date)) {
        setDateError('\u26A0\uFE0F To Date must be after From Date')
        return
      }
      if (form.staff_id) {
        const hasOverlap = leaves
          .filter(l => l.staff_id === Number(form.staff_id) && l.id !== detailModal?.id && l.status !== 'Rejected')
          .some(l => new Date(form.from_date) <= new Date(l.to_date) && new Date(form.to_date) >= new Date(l.from_date))
        if (hasOverlap) setOverlapWarning('\u26A0\uFE0F This staff already has leave in this date range')
      }
    }
  }, [form.from_date, form.to_date, form.staff_id, leaves, detailModal])

  // ─── Derived values ────────────────────────────────────────────────────────
  const selectedStaff = useMemo(() =>
    staff.find(s => s.id === Number(form.staff_id)), [staff, form.staff_id])

  const duration = useMemo(() =>
    calculateDays(form.from_date, form.to_date, form.half_day_type),
  [form.from_date, form.to_date, form.half_day_type])

  const estimatedDeduction = useMemo(() => {
    if (!selectedStaff?.daily_salary || form.is_paid) return 0
    return duration * selectedStaff.daily_salary
  }, [selectedStaff, duration, form.is_paid])

  const leaveBalanceInfo = useMemo(() => {
    if (!selectedStaff || !form.leave_type) return null
    const accrued = calcAccruedDays()
    const academicStart = getAcademicYearStart()
    const used = leaves
      .filter(l =>
        l.staff_id === selectedStaff.id &&
        l.leave_type === form.leave_type &&
        l.status === 'Approved' &&
        l.from_date >= academicStart
      )
      .reduce((sum, l) => sum + (l.duration_days || 0), 0)
    return {
      accrued,
      used,
      remaining: Math.max(0, accrued - used),
      maxForYear: 12
    }
  }, [selectedStaff, form.leave_type, leaves])

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault()
    if (!canManage || dateError || overlapWarning) return
    setSaving(true)
    const durationDays = calculateDays(form.from_date, form.to_date, form.half_day_type)
    const dailySalary  = selectedStaff?.daily_salary || 0
    const deduction    = form.is_paid ? 0 : durationDays * dailySalary

    const { error } = await supabase.from('leave_requests').insert([{
      staff_id:         Number(form.staff_id),
      leave_type:       form.leave_type,
      from_date:        form.from_date,
      to_date:          form.to_date,
      reason:           form.reason,
      status:           'Pending',
      is_paid:          form.is_paid,
      half_day_type:    form.half_day_type,
      duration_days:    durationDays,
      daily_salary:     dailySalary,
      deduction_amount: deduction,
      applied_by:       currentUser?.name || 'Admin'
    }])

    if (error) alert('Error: ' + error.message)
    else { setForm(emptyForm); setShowForm(false); fetchAll() }
    setSaving(false)
  }

  const handleStatus = async (id, status) => {
    if (!canManage) return
    const { error } = await supabase.from('leave_requests')
      .update({
        status,
        approved_by: status === 'Approved' ? currentUser?.name : null,
        approved_at: status === 'Approved' ? new Date().toISOString() : null
      })
      .eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await supabase.from('leave_history').insert([{
      leave_id: id, action: status,
      performed_by: currentUser?.name, new_status: status
    }])
    fetchAll()
  }

  const handleBulkStatus = async (status) => {
    if (!canManage || !window.confirm(`${status} ${selectedItems.size} selected items?`)) return
    const ids = Array.from(selectedItems)
    const { error } = await supabase.from('leave_requests')
      .update({
        status,
        approved_by: status === 'Approved' ? currentUser?.name : null,
        approved_at: status === 'Approved' ? new Date().toISOString() : null
      })
      .in('id', ids)
    if (error) { alert('Error: ' + error.message); return }
    await supabase.from('leave_history').insert(
      ids.map(id => ({ leave_id: id, action: `Bulk ${status}`, performed_by: currentUser?.name, new_status: status }))
    )
    setSelectedItems(new Set()); fetchAll()
  }

  const handleDelete = async (id) => {
    if (!canManage || !window.confirm('Delete this leave request?')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchAll()
  }

  const handleBulkDelete = async () => {
    if (!canManage || !window.confirm(`Delete ${selectedItems.size} selected items?`)) return
    const { error } = await supabase.from('leave_requests').delete().in('id', Array.from(selectedItems))
    if (error) alert('Error: ' + error.message)
    else { setSelectedItems(new Set()); fetchAll() }
  }

  const fetchHistory = async (leaveId) => {
    const { data } = await supabase.from('leave_history')
      .select('*').eq('leave_id', leaveId).order('performed_at', { ascending: false })
    setHistory(data || [])
  }

  const handleExport = () => {
    exportToCSV(filteredLeaves.map(l => ({
      'Staff Name':      l.staff_profiles?.name,
      'Department':      l.staff_profiles?.department,
      'Leave Type':      l.leave_type,
      'From Date':       l.from_date,
      'To Date':         l.to_date,
      'Duration (Days)': l.duration_days,
      'Half Day':        l.half_day_type,
      'Status':          l.status,
      'Paid':            l.is_paid ? 'Yes' : 'No',
      'Deduction (\u20B9)': l.deduction_amount,
      'Applied By':      l.applied_by,
      'Approved By':     l.approved_by,
      'Created At':      l.created_at
    })), `leave_report_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // ─── Filtered & stats ──────────────────────────────────────────────────────
  const filteredLeaves = useMemo(() => {
    const q = search.toLowerCase()
    return leaves.filter(item =>
      (item.staff_profiles?.name + item.staff_profiles?.department + item.leave_type + item.reason)
        .toLowerCase().includes(q) &&
      (statusFilter === 'All' || item.status === statusFilter)
    )
  }, [leaves, search, statusFilter])

  const stats = useMemo(() => {
    const ayStart = getAcademicYearStart()
    const ayLeaves = leaves.filter(l => l.from_date >= ayStart)
    const totalDeduction   = leaves.filter(l => !l.is_paid && l.status === 'Approved').reduce((s, l) => s + (l.deduction_amount || 0), 0)
    const monthlyDeduction = leaves.filter(l => !l.is_paid && l.status === 'Approved' && l.from_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, l) => s + (l.deduction_amount || 0), 0)
    return {
      total:    leaves.length,
      pending:  leaves.filter(l => l.status === 'Pending').length,
      approved: leaves.filter(l => l.status === 'Approved').length,
      rejected: leaves.filter(l => l.status === 'Rejected').length,
      ayTotal:  ayLeaves.length,
      totalDeduction,
      monthlyDeduction
    }
  }, [leaves])

  // ─── Calendar data ─────────────────────────────────────────────────────────
  const calendarData = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear(), month = today.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay    = new Date(year, month, 1).getDay()
    const calendarDays = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
    const monthLeaves = leaves.filter(l => {
      const from = new Date(l.from_date), to = new Date(l.to_date)
      return (from.getMonth() === month && from.getFullYear() === year) ||
             (to.getMonth()   === month && to.getFullYear()   === year) ||
             (from < new Date(year, month, 1) && to > new Date(year, month + 1, 0))
    })
    return { calendarDays, monthLeaves, year, month }
  }, [leaves])

  const toggleSelection = (id) => {
    const s = new Set(selectedItems)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedItems(s)
  }

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (userLoading) return (
    <div style={{ textAlign: 'center', padding: '64px', color: '#64748b' }}>⏳ Loading user...</div>
  )
  if (!currentUser) return (
    <div style={{ textAlign: 'center', padding: '64px', color: '#dc2626' }}>⚠️ Could not identify current user. Please log in again.</div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: mobile ? '14px 12px' : '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: mobile ? '20px' : '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>🏖️ Leave Management</h1>
          {!mobile && (
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
              {canManage
                ? 'Manage staff leave applications · 1 Casual + 1 Sick day accrued per month'
                : `Your leave records — ${currentUser.name}`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setViewMode(v => v === 'list' ? 'calendar' : 'list')}
            style={{ backgroundColor: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
            {viewMode === 'list' ? '📅 Calendar' : '📋 List'}
          </button>
          {canManage && (
            <button onClick={handleExport}
              style={{ backgroundColor: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
              📥 Export CSV
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowForm(v => !v)}
              style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: mobile ? '9px 14px' : '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: mobile ? '13px' : '14px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {showForm ? '✖ Cancel' : '➕ Apply Leave'}
            </button>
          )}
        </div>
      </div>

      {/* Limited user banner */}
      {isLimitedUser && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#eff6ff', borderRadius: '8px', fontSize: '13px', color: '#1e40af', fontWeight: '600', border: '1px solid #bfdbfe' }}>
          👤 You are viewing your own leave records only. Contact admin to apply or modify leave.
        </div>
      )}

      {/* Accrual info banner */}
      <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#f0fdf4', borderRadius: '8px', fontSize: '13px', color: '#166534', border: '1px solid #bbf7d0', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span>📅 Academic Year: Apr 1 → Mar 31</span>
        <span>📈 Accrual: 1 Casual + 1 Sick day per month</span>
        <span>🔄 Resets every April 1</span>
        <span style={{ fontWeight: '700' }}>✅ {calcAccruedDays()} days accrued so far this year</span>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : canManage ? 'repeat(6, 1fr)' : 'repeat(4, 1fr)', gap: mobile ? '10px' : '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total',          value: stats.total,    color: '#1e3a5f', bg: '#eff6ff', icon: '📋' },
          { label: 'This Acad. Year',value: stats.ayTotal,  color: '#0369a1', bg: '#e0f2fe', icon: '📆' },
          { label: 'Pending',        value: stats.pending,  color: '#ca8a04', bg: '#fef9c3', icon: '⏳' },
          { label: 'Approved',       value: stats.approved, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
          ...(canManage ? [
            { label: 'Monthly Deduction', value: `\u20B9${stats.monthlyDeduction.toLocaleString()}`, color: '#dc2626', bg: '#fee2e2', icon: '💸' },
            { label: 'Total Deduction',   value: `\u20B9${stats.totalDeduction.toLocaleString()}`,   color: '#7c3aed', bg: '#ede9fe', icon: '💰' },
          ] : [
            { label: 'Rejected', value: stats.rejected, color: '#dc2626', bg: '#fee2e2', icon: '❌' },
          ])
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: '12px', padding: mobile ? '12px' : '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: mobile ? '16px' : '20px', marginBottom: '4px' }}>{card.icon}</div>
            <p style={{ fontSize: '11px', color: card.color, fontWeight: '600', margin: 0 }}>{card.label}</p>
            <h2 style={{ fontSize: mobile ? '18px' : '22px', fontWeight: 'bold', color: card.color, margin: '2px 0 0' }}>{card.value}</h2>
          </div>
        ))}
      </div>

      {/* Apply Leave Form */}
      {showForm && canManage && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: mobile ? '16px' : '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>📝 Apply Leave</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={lStyle}>Select Staff *</label>
                <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} required style={iStyle}>
                  <option value="">Choose Staff</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.designation || 'Staff'} (₹{s.daily_salary}/day)</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={lStyle}>Leave Type *</label>
                <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} required style={iStyle}>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={lStyle}>Half Day Type</label>
                <select value={form.half_day_type} onChange={e => setForm({ ...form, half_day_type: e.target.value })} style={iStyle}>
                  <option value="Full Day">Full Day</option>
                  <option value="First Half">First Half (0.5 day)</option>
                  <option value="Second Half">Second Half (0.5 day)</option>
                </select>
              </div>

              <div>
                <label style={lStyle}>From Date *</label>
                <input type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} required style={iStyle} />
              </div>

              <div>
                <label style={lStyle}>To Date *</label>
                <input type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} required style={iStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lStyle}>Reason *</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                  rows="3" required placeholder="Enter detailed reason for leave..."
                  style={{ ...iStyle, resize: 'vertical' }} />
              </div>
            </div>

            {/* Balance & Deduction Preview */}
            {selectedStaff && (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>

                {/* Leave Balance */}
                <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '10px' }}>
                    📊 {form.leave_type} Balance
                  </div>
                  {leaveBalanceInfo ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                        <span>Accrued: <strong>{leaveBalanceInfo.accrued}</strong></span>
                        <span>Used: <strong style={{ color: '#dc2626' }}>{leaveBalanceInfo.used}</strong></span>
                        <span>Remaining: <strong style={{ color: leaveBalanceInfo.remaining > 0 ? '#16a34a' : '#dc2626' }}>{leaveBalanceInfo.remaining}</strong></span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ background: '#dbeafe', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px',
                          width: `${Math.min((leaveBalanceInfo.used / leaveBalanceInfo.accrued) * 100, 100)}%`,
                          background: leaveBalanceInfo.remaining === 0 ? '#dc2626' : '#3b82f6'
                        }} />
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        {leaveBalanceInfo.accrued} of {leaveBalanceInfo.maxForYear} days accrued this academic year
                      </div>
                      {duration > leaveBalanceInfo.remaining && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
                          ⚠️ Exceeds balance — will be treated as LWP
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Select staff to see balance</span>
                  )}
                </div>

                {/* Deduction Preview */}
                <div style={{ background: form.is_paid ? '#dcfce7' : '#fef3c7', padding: '14px', borderRadius: '10px', border: `1px solid ${form.is_paid ? '#86efac' : '#fde68a'}` }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: form.is_paid ? '#166534' : '#92400e', marginBottom: '8px' }}>
                    💰 Deduction Preview
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                    <div>Duration: <strong>{duration} day{duration !== 1 ? 's' : ''}</strong></div>
                    <div>Daily Rate: <strong>₹{selectedStaff.daily_salary || '—'}</strong></div>
                    <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: '700', color: form.is_paid ? '#16a34a' : '#dc2626' }}>
                      {form.is_paid ? '✅ Fully Paid Leave' : `💸 Deduction: ₹${estimatedDeduction.toFixed(2)}`}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!form.is_paid} onChange={e => setForm({ ...form, is_paid: !e.target.checked })} />
                    Mark as Unpaid Leave (LWP)
                  </label>
                </div>
              </div>
            )}

            {dateError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>{dateError}</div>
            )}
            {overlapWarning && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>{overlapWarning}</div>
            )}

            <button type="submit" disabled={saving || !!dateError}
              style={{ marginTop: '16px', backgroundColor: saving || dateError ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 28px', fontWeight: '600', cursor: saving || dateError ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
              {saving ? '⏳ Saving...' : '✅ Submit Leave Request'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexDirection: mobile ? 'column' : 'row', alignItems: 'center' }}>
        <input placeholder="🔍 Search staff, department, leave type..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...iStyle, flex: 1 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...iStyle, width: mobile ? '100%' : 160 }}>
          <option value="All">All Status</option>
          <option value="Pending">⏳ Pending</option>
          <option value="Approved">✅ Approved</option>
          <option value="Rejected">❌ Rejected</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {canManage && selectedItems.size > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{selectedItems.size} selected</span>
          <button onClick={() => handleBulkStatus('Approved')} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>✅ Approve All</button>
          <button onClick={() => handleBulkStatus('Rejected')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>❌ Reject All</button>
          <button onClick={handleBulkDelete} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>🗑 Delete All</button>
          <button onClick={() => setSelectedItems(new Set())} style={{ background: 'transparent', color: '#64748b', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1e3a5f', fontSize: '16px' }}>
            📅 {new Date(calendarData.year, calendarData.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', padding: '8px' }}>{d}</div>
            ))}
            {calendarData.calendarDays.map((day, i) => {
              if (!day) return <div key={i} style={{ padding: '8px' }} />
              const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayLeaves = calendarData.monthLeaves.filter(l =>
                new Date(dateStr) >= new Date(l.from_date) && new Date(dateStr) <= new Date(l.to_date)
              )
              return (
                <div key={i} style={{ padding: '6px', minHeight: '60px', border: '1px solid #e2e8f0', borderRadius: '6px', background: dayLeaves.length > 0 ? '#fef9c3' : 'white', fontSize: '12px' }}>
                  <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{day}</div>
                  {dayLeaves.slice(0, 2).map((l, idx) => (
                    <div key={idx} style={{ fontSize: '10px', color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.staff_profiles?.name?.split(' ')[0]} ({l.half_day_type === 'Full Day' ? 'F' : 'H'})
                    </div>
                  ))}
                  {dayLeaves.length > 2 && <div style={{ fontSize: '10px', color: '#92400e' }}>+{dayLeaves.length - 2} more</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading…</div>
        ) : mobile ? (
          <div>
            {filteredLeaves.map(item => (
              <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${item.status === 'Approved' ? '#16a34a' : item.status === 'Rejected' ? '#dc2626' : '#ca8a04'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8, gap: '8px' }}>
                  {canManage && <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} style={{ marginTop: '4px' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{item.staff_profiles?.name || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{item.staff_profiles?.department || '—'} · {item.leave_type}</div>
                      </div>
                      <span style={statusStyle(item.status)}>{item.status}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 8, paddingLeft: canManage ? '24px' : 0 }}>
                  <div>📅 {formatDate(item.from_date)} → {formatDate(item.to_date)} · {item.duration_days} day{item.duration_days !== 1 ? 's' : ''} · {item.half_day_type}</div>
                  {item.reason && <div style={{ marginTop: 4, color: '#475569' }}>📝 {item.reason}</div>}
                  <div style={{ marginTop: 4, fontSize: '11px' }}>
                    Applied {formatRelativeTime(item.created_at)} by {item.applied_by || '—'}
                    {item.approved_by && ` · Approved by ${item.approved_by}`}
                  </div>
                </div>
                {canManage && (
                  <div style={{ paddingLeft: '24px', marginBottom: '10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: item.is_paid ? '#dcfce7' : '#fee2e2', color: item.is_paid ? '#16a34a' : '#dc2626' }}>
                      {item.is_paid ? '✅ Paid' : `💸 \u20B9${item.deduction_amount?.toLocaleString()} deducted`}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, paddingLeft: canManage ? '24px' : 0 }}>
                  {canManage && item.status === 'Pending' && (
                    <>
                      <button onClick={() => handleStatus(item.id, 'Approved')} style={{ flex: 1, backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '7px', padding: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>✅ Approve</button>
                      <button onClick={() => handleStatus(item.id, 'Rejected')} style={{ flex: 1, backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '7px', padding: '7px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>❌ Reject</button>
                    </>
                  )}
                  <button onClick={() => { setDetailModal(item); fetchHistory(item.id) }} style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>👁</button>
                  {canManage && <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>🗑</button>}
                </div>
              </div>
            ))}
            {filteredLeaves.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>No leave requests found</div>}
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {canManage && (
                    <th style={{ padding: '12px 8px', width: '40px' }}>
                      <input type="checkbox"
                        checked={filteredLeaves.length > 0 && filteredLeaves.every(l => selectedItems.has(l.id))}
                        onChange={() => filteredLeaves.every(l => selectedItems.has(l.id))
                          ? setSelectedItems(new Set())
                          : setSelectedItems(new Set(filteredLeaves.map(l => l.id)))}
                      />
                    </th>
                  )}
                  {['#', 'Staff', 'Department', 'Type', 'Duration', 'From', 'To', 'Status',
                    ...(canManage ? ['Payment'] : []),
                    'Applied', 'Action'
                  ].map(h => (
                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {canManage && (
                      <td style={{ padding: '10px 8px' }}>
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} />
                      </td>
                    )}
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>{i + 1}</td>
                    <td style={{ padding: '10px', fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{item.staff_profiles?.name || '-'}</td>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>{item.staff_profiles?.department || '-'}</td>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>{item.leave_type}</td>
                    <td style={{ padding: '10px', color: '#374151', fontSize: '13px', fontWeight: '600' }}>
                      {item.duration_days}d {item.half_day_type !== 'Full Day' && '(H)'}
                    </td>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>{formatDate(item.from_date)}</td>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>{formatDate(item.to_date)}</td>
                    <td style={{ padding: '10px' }}><span style={statusStyle(item.status)}>{item.status}</span></td>
                    {canManage && (
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: item.is_paid ? '#dcfce7' : '#fee2e2', color: item.is_paid ? '#16a34a' : '#dc2626' }}>
                          {item.is_paid ? 'Paid' : `\u20B9${item.deduction_amount?.toLocaleString()}`}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                      {formatRelativeTime(item.created_at)}
                      {canManage && <div style={{ fontSize: '11px', color: '#94a3b8' }}>by {item.applied_by || '—'}</div>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canManage && item.status === 'Pending' && (
                          <>
                            <button onClick={() => handleStatus(item.id, 'Approved')} title="Approve" style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>✅</button>
                            <button onClick={() => handleStatus(item.id, 'Rejected')} title="Reject" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>❌</button>
                          </>
                        )}
                        <button onClick={() => { setDetailModal(item); fetchHistory(item.id) }} title="View" style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>👁</button>
                        {canManage && <button onClick={() => handleDelete(item.id)} title="Delete" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLeaves.length === 0 && (
                  <tr><td colSpan={canManage ? 12 : 10} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No leave requests found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setDetailModal(null)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#1e3a5f' }}>📝 Leave Details</h3>
              <button onClick={() => setDetailModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {[
                ['Staff',       detailModal.staff_profiles?.name],
                ['Department',  detailModal.staff_profiles?.department],
                ['Leave Type',  detailModal.leave_type],
                ['Duration',    `${detailModal.duration_days} days (${detailModal.half_day_type})`],
                ['Date Range',  `${formatDate(detailModal.from_date)} → ${formatDate(detailModal.to_date)}`],
                ['Status',      '__status__'],
                ...(canManage ? [['Payment', '__payment__']] : []),
                ['Applied By',  `${detailModal.applied_by || '—'} on ${formatDate(detailModal.created_at)}`],
                ...(detailModal.approved_by ? [['Approved By', `${detailModal.approved_by} on ${formatDate(detailModal.approved_at)}`]] : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>{label}</span>
                  {value === '__status__' ? (
                    <span style={statusStyle(detailModal.status)}>{detailModal.status}</span>
                  ) : value === '__payment__' ? (
                    <span style={{ fontWeight: '600', color: detailModal.is_paid ? '#16a34a' : '#dc2626' }}>
                      {detailModal.is_paid ? '✅ Fully Paid' : `💸 \u20B9${detailModal.deduction_amount?.toLocaleString()} Deduction`}
                    </span>
                  ) : (
                    <span style={{ fontWeight: '600' }}>{value}</span>
                  )}
                </div>
              ))}
              {detailModal.reason && (
                <div style={{ padding: '8px 0' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Reason</span>
                  <span style={{ fontWeight: '500', color: '#374151' }}>{detailModal.reason}</span>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', color: '#1e3a5f', marginBottom: '10px' }}>📋 Activity History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.action === 'Approved' ? '#16a34a' : h.action === 'Rejected' ? '#dc2626' : '#ca8a04', marginTop: '4px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: '600', color: '#374151' }}>{h.action} by {h.performed_by}</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px' }}>{formatDate(h.performed_at)} · {formatRelativeTime(h.performed_at)}</div>
                        {h.notes && <div style={{ color: '#64748b', marginTop: '2px' }}>{h.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Leave
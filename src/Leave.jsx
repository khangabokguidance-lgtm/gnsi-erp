import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'
import { useCurrentUser } from './useCurrentUser'
import { isAdminRole } from './roles'
import { PremiumStyles, PremiumHero, PremiumCard, PIcon, PX } from './premiumUI'

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
const LEAVE_PER_SESSION = 12

function getSessionStart() {
  const today = new Date()
  const y = today.getFullYear()
  const sessionStart = new Date(y, 0, 10) // Jan 10 this year
  return today >= sessionStart ? sessionStart : new Date(y - 1, 0, 10)
}

function getAcademicYearStart() {
  const s = getSessionStart()
  return `${s.getFullYear()}-01-10`
}

function calcAccruedDays() {
  return LEAVE_PER_SESSION  // all 12 days available from Jan 10
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
  width: '100%', padding: '10px 13px', borderRadius: '11px',
  border: '1px solid #e8e3d8', fontSize: '13.5px', backgroundColor: 'white', color: '#0f1b2e',
  boxSizing: 'border-box', fontFamily: 'inherit'
}
const lStyle = {
  display: 'block', fontSize: '10.5px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase',
  color: '#5d6b82', marginBottom: '6px'
}

const statusStyle = (status) => {
  const map = {
    Pending:  { bg: '#fef9c3', color: '#ca8a04' },
    Approved: { bg: '#dcfce7', color: '#16a34a' },
    Rejected: { bg: '#fee2e2', color: '#dc2626' }
  }
  const s = map[status] || { bg: '#e8e3d8', color: '#2e3b52' }
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

  // Was an exact 'Admin' match — 'Administrator' / 'Co-Admin' (the real admin
  // roles) could neither apply nor approve leave. Same fix as other modules.
  const canManage     = useMemo(() => isAdminRole(currentUser?.role) || ['admin', 'administrator', 'co-admin'].includes(String(currentUser?.role || '').toLowerCase()) || currentUser?.role === 'Teaching + Admin', [currentUser])
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
    const allStaff = (await staffDB.getAll()).filter(s => 
  s.id && !isNaN(Number(s.id))
)
    let query = supabase
      .from('leave_requests')
      .select(`
  *,
  staff_profiles (
    name,
    department,
    designation,
    daily_salary,
    leave_balance
  )
`)
      .order('created_at', { ascending: false })
    if (isLimitedUser) query = query.eq('staff_id', currentUser.staff_profile_id)
    const { data: leaveData } = await query
    setStaff(isLimitedUser ? allStaff.filter(s => s.id === currentUser.staff_profile_id) : allStaff)
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
          .filter(l => l.staff_id === parseInt(form.staff_id, 10) && l.id !== detailModal?.id && l.status !== 'Rejected')
          .some(l => new Date(form.from_date) <= new Date(l.to_date) && new Date(form.to_date) >= new Date(l.from_date))
        if (hasOverlap) setOverlapWarning('\u26A0\uFE0F This staff already has leave in this date range')
      }
    }
  }, [form.from_date, form.to_date, form.staff_id, leaves, detailModal])

  // ─── Derived values ────────────────────────────────────────────────────────
  const selectedStaff = useMemo(() =>
    staff.find(s => s.id === form.staff_id), [staff, form.staff_id])

  const duration = useMemo(() =>
    calculateDays(form.from_date, form.to_date, form.half_day_type),
  [form.from_date, form.to_date, form.half_day_type])

  const estimatedDeduction = useMemo(() => {
    if (!selectedStaff?.daily_salary || form.is_paid) return 0
    return duration * selectedStaff.daily_salary
  }, [selectedStaff, duration, form.is_paid])

  const leaveBalanceInfo = useMemo(() => {
  if (!selectedStaff) return null
  const sessionStart = getAcademicYearStart()
  const used = leaves
    .filter(l =>
      l.staff_id === selectedStaff.id &&
      l.status === 'Approved' &&
      l.from_date >= sessionStart
    )
    .reduce((sum, l) => sum + (l.duration_days || 0), 0)
  return {
    total: LEAVE_PER_SESSION,
    used,
    remaining: Math.max(0, LEAVE_PER_SESSION - used),
  }
}, [selectedStaff, leaves])

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
  e.preventDefault()
  if (!canManage || dateError || overlapWarning) return

  const staffId = parseInt(form.staff_id, 10)
  console.log('DEBUG staff_id:', form.staff_id, '| parsed:', staffId, '| staff list:', staff) // ← ADD THIS

  if (!form.staff_id || isNaN(staffId)) {
    alert('Please select a valid staff member')
    return
  }

  setSaving(true)

  setSaving(true)
    const durationDays = calculateDays(form.from_date, form.to_date, form.half_day_type)
    const dailySalary  = selectedStaff?.daily_salary || 400
    const deduction    = form.is_paid ? 400 : durationDays * dailySalary

    const { error } = await supabase.from('leave_requests').insert([{
      staff_id: staffId, 
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
    <div className="px-root"><PremiumStyles /><div style={{ textAlign: 'center', padding: '64px', color: PX.sub }}>Loading…</div></div>
  )
  if (!currentUser) return (
    <div style={{ textAlign: 'center', padding: '64px', color: '#dc2626' }}>⚠️ Could not identify current user. Please log in again.</div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-root">
    <PremiumStyles />
    <div className="px-wrap" style={{ maxWidth: 1240 }}>

      <PremiumHero
        isMobile={mobile}
        icon={<PIcon.leaf size={mobile ? 21 : 24} />}
        eyebrow="GNSI · Staff leave"
        title="Leave Management"
        subtitle={canManage ? '12 days per session · Jan 10 – Jan 9 · resets every January 10' : `Your leave records — ${currentUser.name}`}
        actions={<>
          <button className="px-hbtn" onClick={() => setViewMode(v => v === 'list' ? 'calendar' : 'list')}>
            {viewMode === 'list' ? <><PIcon.calendar size={15} /> Calendar</> : <><PIcon.list size={15} /> List</>}
          </button>
          {canManage && <button className="px-hbtn" onClick={handleExport}><PIcon.download size={15} /> Export</button>}
          {canManage && (
            <button className="px-hbtn gold" onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Close form' : <><PIcon.plus size={15} /> Apply leave</>}
            </button>
          )}
        </>}
        stats={[
          { label: 'Pending', value: stats.pending, sub: 'awaiting approval', tone: stats.pending ? '#fcd34d' : null, active: statusFilter === 'Pending', onClick: () => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending') },
          { label: 'Approved', value: stats.approved, sub: `${stats.ayTotal} this session`, tone: '#86efac', active: statusFilter === 'Approved', onClick: () => setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved') },
          ...(canManage ? [
            { label: 'Deduction · month', value: `\u20B9${stats.monthlyDeduction.toLocaleString('en-IN')}`, sub: 'unpaid leave (LWP)', tone: stats.monthlyDeduction ? '#fca5a5' : null },
            { label: 'Deduction · total', value: `\u20B9${stats.totalDeduction.toLocaleString('en-IN')}`, sub: 'all approved LWP' },
          ] : [
            { label: 'Rejected', value: stats.rejected, sub: 'requests', active: statusFilter === 'Rejected', onClick: () => setStatusFilter(statusFilter === 'Rejected' ? 'All' : 'Rejected') },
            { label: 'Balance', value: leaveBalanceInfo ? leaveBalanceInfo.remaining : 12, sub: 'days left this session', tone: PX.goldLt },
          ]),
          ...(mobile ? [] : [{ label: 'All requests', value: stats.total, sub: 'on record' }]),
        ]}
      />

      {/* Limited user banner */}
      {isLimitedUser && (
        <div style={{ marginBottom: '16px', padding: '11px 16px', background: '#eef2f9', borderRadius: '12px', fontSize: '13px', color: PX.navy2, fontWeight: '600', border: '1px solid #c9d5ea' }}>
          You are viewing your own leave records. Contact the admin to apply for or change leave.
        </div>
      )}

      {/* Apply Leave Form */}
      {showForm && canManage && (
        <div className="px-card" style={{ padding: mobile ? '16px' : '22px 24px', marginBottom: '18px' }}>
          <div className="px-section" style={{ marginTop: 0 }}><span className="px-eyebrow">New request</span><span className="px-h2" style={{ fontSize: 19 }}>Apply leave</span></div>
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
                <div style={{ background: '#eef2f9', padding: '14px', borderRadius: '10px', border: '1px solid #c9d5ea' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#132a4f', marginBottom: '10px' }}>
                    📊 {form.leave_type} Balance
                  </div>
                  {leaveBalanceInfo ? (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
      <span>Total: <strong>{leaveBalanceInfo.total}</strong></span>
      <span>Used: <strong style={{ color: '#dc2626' }}>{leaveBalanceInfo.used}</strong></span>
      <span>Remaining: <strong style={{ color: leaveBalanceInfo.remaining > 0 ? '#16a34a' : '#dc2626' }}>{leaveBalanceInfo.remaining}</strong></span>
    </div>
    <div style={{ background: '#e4ebf6', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: '4px',
        width: `${Math.min((leaveBalanceInfo.used / leaveBalanceInfo.total) * 100, 100)}%`,
        background: leaveBalanceInfo.remaining === 0 ? '#dc2626' : '#2f4f86'
      }} />
    </div>
    <div style={{ marginTop: '6px', fontSize: '11px', color: '#5d6b82' }}>
      {leaveBalanceInfo.used} of {leaveBalanceInfo.total} days used this session
    </div>
    {duration > leaveBalanceInfo.remaining && (
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
        ⚠️ Exceeds balance — will be treated as LWP
      </div>
    )}
  </>
) : (
  <span style={{ fontSize: '13px', color: '#5d6b82' }}>Select staff to see balance</span>
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
              className="px-btn" style={{ marginTop: '18px', padding: '12px 26px' }}>
              {saving ? 'Saving…' : 'Submit leave request'}
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', background: '#faf8f3', borderRadius: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#2e3b52' }}>{selectedItems.size} selected</span>
          <button onClick={() => handleBulkStatus('Approved')} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>✅ Approve All</button>
          <button onClick={() => handleBulkStatus('Rejected')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>❌ Reject All</button>
          <button onClick={handleBulkDelete} style={{ background: '#f3f0e8', color: '#5d6b82', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>🗑 Delete All</button>
          <button onClick={() => setSelectedItems(new Set())} style={{ background: 'transparent', color: '#5d6b82', border: '1px solid #d9d2c2', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="px-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: PX.ink, fontSize: '19px', fontFamily: PX.serif, fontWeight: 600 }}>
            {new Date(calendarData.year, calendarData.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#5d6b82', padding: '8px' }}>{d}</div>
            ))}
            {calendarData.calendarDays.map((day, i) => {
              if (!day) return <div key={i} style={{ padding: '8px' }} />
              const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayLeaves = calendarData.monthLeaves.filter(l =>
                new Date(dateStr) >= new Date(l.from_date) && new Date(dateStr) <= new Date(l.to_date)
              )
              return (
                <div key={i} style={{ padding: '6px', minHeight: '60px', border: '1px solid #e8e3d8', borderRadius: '6px', background: dayLeaves.length > 0 ? '#fef9c3' : 'white', fontSize: '12px' }}>
                  <div style={{ fontWeight: '600', color: '#2e3b52', marginBottom: '4px' }}>{day}</div>
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
          <div style={{ textAlign: 'center', padding: '48px', color: '#5d6b82' }}>⏳ Loading…</div>
        ) : mobile ? (
          <div>
            {filteredLeaves.map(item => (
              <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${item.status === 'Approved' ? '#16a34a' : item.status === 'Rejected' ? '#dc2626' : '#ca8a04'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8, gap: '8px' }}>
                  {canManage && <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} style={{ marginTop: '4px' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#14213d', fontSize: '14px' }}>{item.staff_profiles?.name || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#5d6b82', marginTop: 2 }}>{item.staff_profiles?.department || '—'} · {item.leave_type}</div>
                      </div>
                      <span style={statusStyle(item.status)}>{item.status}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#5d6b82', marginBottom: 8, paddingLeft: canManage ? '24px' : 0 }}>
                  <div>📅 {formatDate(item.from_date)} → {formatDate(item.to_date)} · {item.duration_days} day{item.duration_days !== 1 ? 's' : ''} · {item.half_day_type}</div>
                  {item.reason && <div style={{ marginTop: 4, color: '#4b5870' }}>📝 {item.reason}</div>}
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
                  <button onClick={() => { setDetailModal(item); fetchHistory(item.id) }} style={{ backgroundColor: '#eef2f9', color: '#132a4f', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>👁</button>
                  {canManage && <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#f3f0e8', color: '#5d6b82', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>🗑</button>}
                </div>
              </div>
            ))}
            {filteredLeaves.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: '#8a93a6' }}>No leave requests found</div>}
          </div>
        ) : (
          <div className="px-card" style={{ overflowX: 'auto' }}>
            <table className="px-table">
              <thead>
                <tr>
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
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f0e8' }}>
                    {canManage && (
                      <td style={{ padding: '10px 8px' }}>
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} />
                      </td>
                    )}
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '13px' }}>{i + 1}</td>
                    <td style={{ padding: '10px', fontWeight: '600', color: '#14213d', fontSize: '13px' }}>{item.staff_profiles?.name || '-'}</td>
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '13px' }}>{item.staff_profiles?.department || '-'}</td>
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '13px' }}>{item.leave_type}</td>
                    <td style={{ padding: '10px', color: '#2e3b52', fontSize: '13px', fontWeight: '600' }}>
                      {item.duration_days}d {item.half_day_type !== 'Full Day' && '(H)'}
                    </td>
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '13px' }}>{formatDate(item.from_date)}</td>
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '13px' }}>{formatDate(item.to_date)}</td>
                    <td style={{ padding: '10px' }}><span style={statusStyle(item.status)}>{item.status}</span></td>
                    {canManage && (
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: item.is_paid ? '#dcfce7' : '#fee2e2', color: item.is_paid ? '#16a34a' : '#dc2626' }}>
                          {item.is_paid ? 'Paid' : `\u20B9${item.deduction_amount?.toLocaleString()}`}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '10px', color: '#5d6b82', fontSize: '12px' }}>
                      {formatRelativeTime(item.created_at)}
                      {canManage && <div style={{ fontSize: '11px', color: '#8a93a6' }}>by {item.applied_by || '—'}</div>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canManage && item.status === 'Pending' && (
                          <>
                            <button onClick={() => handleStatus(item.id, 'Approved')} title="Approve" style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>✅</button>
                            <button onClick={() => handleStatus(item.id, 'Rejected')} title="Reject" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>❌</button>
                          </>
                        )}
                        <button onClick={() => { setDetailModal(item); fetchHistory(item.id) }} title="View" style={{ backgroundColor: '#eef2f9', color: '#132a4f', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>👁</button>
                        {canManage && <button onClick={() => handleDelete(item.id)} title="Delete" style={{ backgroundColor: '#f3f0e8', color: '#5d6b82', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer' }}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLeaves.length === 0 && (
                  <tr><td colSpan={canManage ? 12 : 10} style={{ padding: '32px', textAlign: 'center', color: '#8a93a6' }}>No leave requests found</td></tr>
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
              <h3 style={{ margin: 0, color: PX.ink, fontFamily: PX.serif, fontWeight: 600, fontSize: 19 }}>Leave details</h3>
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
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f0e8' }}>
                  <span style={{ color: '#5d6b82' }}>{label}</span>
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
                  <span style={{ color: '#5d6b82', display: 'block', marginBottom: '4px' }}>Reason</span>
                  <span style={{ fontWeight: '500', color: '#2e3b52' }}>{detailModal.reason}</span>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', color: '#132a4f', marginBottom: '10px' }}>📋 Activity History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.action === 'Approved' ? '#16a34a' : h.action === 'Rejected' ? '#dc2626' : '#ca8a04', marginTop: '4px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: '600', color: '#2e3b52' }}>{h.action} by {h.performed_by}</div>
                        <div style={{ color: '#8a93a6', fontSize: '11px' }}>{formatDate(h.performed_at)} · {formatRelativeTime(h.performed_at)}</div>
                        {h.notes && <div style={{ color: '#5d6b82', marginTop: '2px' }}>{h.notes}</div>}
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
    </div>
  )
}

export default Leave
// FaceAttendance.jsx — the sole attendance + pay-record module.
// Consolidates: face enrollment management, GPS+face check-in, time card,
// advances, late fines, and (admin) cash book — all in one sidebar tab.
//
// Time card / Advances / Late fines / Cash book are READ-ONLY VIEWS into
// data owned by GeoAttendance/staff_geo_attendance, Salary.jsx's
// staff_advances + salary_deduction_rules, and Accounts.jsx's accounts
// table. No new tables, no writes from here — editing still happens in
// Salary.jsx / Accounts.jsx so there is exactly one source of truth for
// each figure.

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import FaceEnroll, { FaceApprovalQueue } from './FaceEnroll'
import GeoAttendance from './GeoAttendance'
import { AttendanceSummaryView, ReportsView, BroadcastView, NotificationsView } from './FaceAttendanceExtras'
import SettingsView from './SettingsView'

const S = {
  page:  { padding: '20px 20px 96px', fontFamily: "'Outfit',system-ui,sans-serif", background: '#EEF2FB', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 20, marginBottom: 16 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' },
  inputFull: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 },
  tab:   (active) => ({
    padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    background: 'none', border: 'none', whiteSpace: 'nowrap',
    borderBottom: `3px solid ${active ? '#0B1E3D' : 'transparent'}`,
    color: active ? '#0B1E3D' : '#64748b',
  }),
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', background: '#f8fafc' },
  td: { padding: '10px 12px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },
}

const fmtRupee = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const hoursBetween = (inIso, outIso) => {
  if (!inIso || !outIso) return null
  const ms = new Date(outIso) - new Date(inIso)
  return ms > 0 ? ms / 3600000 : null
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'ok') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500) }, [])
  const el = toast ? (
    <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'err' ? '#fee2e2' : toast.type === 'warn' ? '#fef9c3' : '#dcfce7', color: toast.type === 'err' ? '#dc2626' : toast.type === 'warn' ? '#ca8a04' : '#16a34a', padding: '12px 20px', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.15)', fontSize: 13, fontWeight: 600 }}>
      {toast.message}
    </div>
  ) : null
  return { show, el }
}

// ─── Time card — daily punch summary + working hours ───────────────────────

function TimeCard({ staffId, isAdmin, staffList }) {
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [staffFilter, setStaffFilter] = useState(isAdmin ? 'all' : String(staffId))

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('staff_geo_attendance')
      .select('id, staff_id, date, shift_label, check_in_time, check_out_time, server_check_in_time, server_check_out_time, late_minutes, status, staff_profiles(name)')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .order('date', { ascending: false })
    if (!isAdmin) q = q.eq('staff_id', staffId)
    else if (staffFilter !== 'all') q = q.eq('staff_id', staffFilter)
    const { data, error } = await q
    if (!error) setRows(data || [])
    setLoading(false)
  }, [month, isAdmin, staffId, staffFilter])

  useEffect(() => { fetchRows() }, [fetchRows])

  const totalHours = useMemo(() => {
    return rows.reduce((sum, r) => {
      const h = hoursBetween(r.server_check_in_time || r.check_in_time, r.server_check_out_time || r.check_out_time)
      return sum + (h || 0)
    }, 0)
  }, [rows])

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={S.input} />
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={S.input}>
            <option value="all">All staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#0B1E3D' }}>
          Total: {totalHours.toFixed(1)} hrs across {rows.length} shift{rows.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Staff', 'Shift', 'In', 'Out', 'Hours', 'Late', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const inT = r.server_check_in_time || r.check_in_time
                const outT = r.server_check_out_time || r.check_out_time
                const hrs = hoursBetween(inT, outT)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={S.td}>{fmtDate(r.date)}</td>
                    <td style={S.td}>{r.staff_profiles?.name || '—'}</td>
                    <td style={S.td}>Shift {r.shift_label}</td>
                    <td style={S.td}>{fmtTime(inT)}</td>
                    <td style={S.td}>{outT ? fmtTime(outT) : <span style={{ color: '#ca8a04', fontWeight: 600 }}>Active</span>}</td>
                    <td style={S.td}>{hrs !== null ? `${hrs.toFixed(1)}h` : '—'}</td>
                    <td style={{ ...S.td, color: (r.late_minutes || 0) > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>
                      {(r.late_minutes || 0) > 0 ? `+${r.late_minutes}m` : '—'}
                    </td>
                    <td style={S.td}>{r.status}</td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No check-in records for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Advances — view into Salary.jsx's staff_advances table ────────────────

function AdvancesView({ staffId, isAdmin, staffList }) {
  const [advances, setAdvances] = useState([])
  const [loading, setLoading]   = useState(true)
  const [staffFilter, setStaffFilter] = useState(isAdmin ? 'all' : String(staffId))

  const fetchAdvances = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('staff_advances').select('*, staff_profiles(name)').order('created_at', { ascending: false })
    if (!isAdmin) q = q.eq('staff_id', staffId)
    else if (staffFilter !== 'all') q = q.eq('staff_id', staffFilter)
    const { data, error } = await q
    if (!error) setAdvances(data || [])
    setLoading(false)
  }, [isAdmin, staffId, staffFilter])

  useEffect(() => { fetchAdvances() }, [fetchAdvances])

  const totals = useMemo(() => ({
    issued:   advances.reduce((s, a) => s + Number(a.amount || 0), 0),
    repaid:   advances.reduce((s, a) => s + Number(a.repaid_amount || 0), 0),
    outstanding: advances.reduce((s, a) => s + (Number(a.amount || 0) - Number(a.repaid_amount || 0)), 0),
  }), [advances])

  return (
    <div style={S.card}>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
        View only — advances are recorded and repayments applied from the Salary module during payroll processing.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={S.input}>
            <option value="all">All staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0B1E3D' }}>{fmtRupee(totals.issued)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total issued</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{fmtRupee(totals.repaid)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Repaid so far</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{fmtRupee(totals.outstanding)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Outstanding</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Staff', 'Issued', 'Amount', 'Repaid', 'Outstanding', 'Repay months', 'Reason', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={S.td}>{a.staff_profiles?.name || '—'}</td>
                  <td style={S.td}>{a.issued_month}</td>
                  <td style={S.td}>{fmtRupee(a.amount)}</td>
                  <td style={S.td}>{fmtRupee(a.repaid_amount)}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: (a.amount - a.repaid_amount) > 0 ? '#dc2626' : '#16a34a' }}>
                    {fmtRupee(a.amount - a.repaid_amount)}
                  </td>
                  <td style={S.td}>{a.repay_months}</td>
                  <td style={S.td}>{a.reason || '—'}</td>
                  <td style={S.td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: a.status === 'Active' ? '#fef9c3' : '#dcfce7', color: a.status === 'Active' ? '#ca8a04' : '#16a34a' }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!advances.length && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No advances recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Late fines — view into salary_deduction_rules + geo attendance ────────

function LateFinesView({ staffId, isAdmin, staffList }) {
  const [rules, setRules] = useState(null)
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [staffFilter, setStaffFilter] = useState(isAdmin ? 'all' : String(staffId))

  const fetchRules = useCallback(async () => {
    const { data } = await supabase.from('salary_deduction_rules').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setRules(data || null)
  }, [])

  const fetchLateRows = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('staff_geo_attendance')
      .select('id, staff_id, date, shift_label, late_minutes, status, staff_profiles(name)')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .gt('late_minutes', 0)
      .order('date', { ascending: false })
    if (!isAdmin) q = q.eq('staff_id', staffId)
    else if (staffFilter !== 'all') q = q.eq('staff_id', staffFilter)
    const { data, error } = await q
    if (!error) setRows(data || [])
    setLoading(false)
  }, [month, isAdmin, staffId, staffFilter])

  useEffect(() => { fetchRules() }, [fetchRules])
  useEffect(() => { fetchLateRows() }, [fetchLateRows])

  const totalLateInstances = rows.length
  const totalLateMinutes = rows.reduce((s, r) => s + (r.late_minutes || 0), 0)

  return (
    <div style={S.card}>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
        View only — the actual fine amount is applied in Salary.jsx's monthly payroll run using the active deduction rule below.
      </p>

      {rules && (
        <div style={{ background: '#fffbeb', border: '1px dashed #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
          Active rule: late deduction rate <strong>{rules.late_rate}</strong> · absent rate <strong>{rules.absent_rate}</strong> · early-out rate <strong>{rules.early_out_rate}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={S.input} />
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={S.input}>
            <option value="all">All staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#b45309' }}>
          {totalLateInstances} late check-in{totalLateInstances !== 1 ? 's' : ''} · {totalLateMinutes} min total
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Staff', 'Shift', 'Late by', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={S.td}>{fmtDate(r.date)}</td>
                  <td style={S.td}>{r.staff_profiles?.name || '—'}</td>
                  <td style={S.td}>Shift {r.shift_label}</td>
                  <td style={{ ...S.td, color: '#b45309', fontWeight: 700 }}>+{r.late_minutes} min</td>
                  <td style={S.td}>{r.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No late check-ins for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Cash book — view into Accounts.jsx's accounts table ───────────────────

function CashBookView() {
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .gte('entry_date', `${month}-01`)
      .lte('entry_date', `${month}-31`)
      .order('entry_date', { ascending: false })
    if (!error) setRows(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchRows() }, [fetchRows])

  const totals = useMemo(() => ({
    income:  rows.filter(r => r.type === 'Income').reduce((s, r) => s + Number(r.amount || 0), 0),
    expense: rows.filter(r => r.type === 'Expense').reduce((s, r) => s + Number(r.amount || 0), 0),
  }), [rows])

  return (
    <div style={S.card}>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
        View only — entries are added and edited from the Accounts module.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={S.input} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{fmtRupee(totals.income)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Income</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{fmtRupee(totals.expense)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Expense</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0B1E3D' }}>{fmtRupee(totals.income - totals.expense)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Net</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Type', 'Category', 'Amount', 'Mode', 'Note', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={S.td}>{fmtDate(r.entry_date)}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: r.type === 'Income' ? '#16a34a' : '#dc2626' }}>{r.type}</td>
                  <td style={S.td}>{r.category}</td>
                  <td style={S.td}>{fmtRupee(r.amount)}</td>
                  <td style={S.td}>{r.payment_mode}</td>
                  <td style={S.td}>{r.note || '—'}</td>
                  <td style={S.td}>{r.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No entries for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Home tile grid — PagarBook-style icon tiles ───────────────────────────

function HomeTile({ icon, label, badge, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: '#E9EEFB', border: 'none', borderRadius: 16, padding: '18px 10px 14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      cursor: 'pointer', position: 'relative', fontFamily: 'inherit',
    }}>
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 8, right: 10, background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 800, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {badge}
        </span>
      )}
      <span style={{ fontSize: 26 }}>{icon}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', textAlign: 'center', lineHeight: 1.25 }}>{label}</span>
    </button>
  )
}

// ─── Bottom nav bar — PagarBook-style fixed 4-item bar ─────────────────────

function BottomNav({ active, onNavigate, pendingCount }) {
  const items = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'checkin',  icon: '✅', label: 'Attendance', badge: pendingCount },
    { key: 'advances', icon: '💵', label: 'Advances' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500,
      background: 'white', borderTop: '1px solid #e2e8f0',
      display: 'flex', justifyContent: 'space-around', padding: '8px 0 10px',
      boxShadow: '0 -2px 10px rgba(0,0,0,.05)',
    }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onNavigate(it.key)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: active === it.key ? '#0B1E3D' : '#94a3b8', position: 'relative', padding: '2px 10px',
        }}>
          {it.badge > 0 && (
            <span style={{ position: 'absolute', top: -2, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
          )}
          <span style={{ fontSize: 20 }}>{it.icon}</span>
          <span style={{ fontSize: 11, fontWeight: active === it.key ? 800 : 600 }}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main export ────────────────────────────────────────────────────────────

export default function FaceAttendance({ currentUser, isAdmin, staff = [], loggedInStaff = null, onNavigate = null, onLogout = null }) {
  const { show: showToast, el: toastEl } = useToast()
  const [tab, setTab] = useState('home')
  const [faceRows, setFaceRows] = useState([]) // staff_face_descriptors, latest per staff
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enrollTarget, setEnrollTarget] = useState(null)

  const staffId = loggedInStaff?.id || null

  const fetchFaceRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('staff_id, status, enrolled_at')
      .order('enrolled_at', { ascending: false })
    if (!error) {
      const latestByStaff = {}
      for (const r of data || []) if (!latestByStaff[r.staff_id]) latestByStaff[r.staff_id] = r
      setFaceRows(Object.values(latestByStaff))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchFaceRows() }, [fetchFaceRows])

  const statusFor = (sid) => faceRows.find(r => r.staff_id === sid)?.status || 'none'

  const filteredStaff = staff
    .filter(s => s.status !== 'Inactive')
    .filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))

  const counts = {
    approved: filteredStaff.filter(s => statusFor(s.id) === 'approved').length,
    pending:  filteredStaff.filter(s => statusFor(s.id) === 'pending').length,
    none:     filteredStaff.filter(s => statusFor(s.id) === 'none').length,
  }

  if (!isAdmin && !loggedInStaff) {
    return <div style={S.page}><div style={S.card}>Your account isn't linked to a staff profile — contact admin to check in.</div></div>
  }

  const initials = (currentUser?.name || currentUser?.role || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const primaryTiles = [
    ...(loggedInStaff ? [{ key: 'checkin', icon: '✅', label: 'Take attendance' }] : []),
    { key: 'attendancesummary', icon: '📅', label: 'Attendance' },
    { key: 'timecard', icon: '🕐', label: 'Time card' },
    { key: 'advances', icon: '💵', label: 'Advances' },
    { key: 'fines',    icon: '⏰', label: 'Late fines' },
    { key: 'reports',  icon: '📊', label: 'Reports' },
    { key: 'broadcast', icon: '📣', label: 'Broadcast messages' },
    { key: 'notifications', icon: '🔔', label: 'Notifications' },
    ...(isAdmin ? [
      { key: 'coverage',  icon: '👥', label: 'Staff coverage' },
      { key: 'approvals', icon: '📋', label: 'Approvals', badge: counts.pending },
      { key: 'cashbook',  icon: '📒', label: 'Cash book' },
    ] : []),
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  const pageTitles = {
    checkin: 'Take attendance', attendancesummary: 'Attendance', timecard: 'Time card', advances: 'Advances',
    fines: 'Late fines', reports: 'Reports', broadcast: 'Broadcast messages', notifications: 'Notifications',
    coverage: 'Staff coverage', approvals: 'Pending approvals', cashbook: 'Cash book', settings: 'Settings',
  }

  return (
    <div style={S.page}>
      {toastEl}

      {/* ── Header, PagarBook-style: org name + greeting + avatar ── */}
      <div style={{
        margin: '-20px -20px 16px', padding: '16px 20px 22px',
        background: 'linear-gradient(180deg, #0B1E3D 0%, #16305C 100%)',
        borderRadius: '0 0 20px 20px', color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              GNSI Face Attendance <span style={{ fontSize: 12, opacity: 0.6 }}>⌄</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#C9A24B', marginTop: 2 }}>
              Hello, {loggedInStaff?.name || currentUser?.name || 'Administrator'}
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#C9A24B', color: '#0B1E3D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {initials}
          </div>
        </div>
      </div>

      {tab === 'home' ? (
        <>
          {isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: 14 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{counts.approved}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Enrolled</div>
              </div>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: 14 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ca8a04' }}>{counts.pending}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Pending</div>
              </div>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: 14 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{counts.none}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Not enrolled</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {primaryTiles.map(t => (
              <HomeTile key={t.key} icon={t.icon} label={t.label} badge={t.badge} onClick={() => setTab(t.key)} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setTab('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#0B1E3D', padding: 4 }}>←</button>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0B1E3D' }}>{pageTitles[tab]}</h2>
          </div>

          {tab === 'checkin' && loggedInStaff && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={false} allStaff={[loggedInStaff]} />
          )}

          {tab === 'attendancesummary' && <AttendanceSummaryView isAdmin={isAdmin} staffList={filteredStaff} showToast={showToast} onNavigate={onNavigate} />}
          {tab === 'timecard' && <TimeCard staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'advances' && <AdvancesView staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'fines'    && <LateFinesView staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'reports'  && <ReportsView isAdmin={isAdmin} staffList={staff} />}
          {tab === 'broadcast' && <BroadcastView isAdmin={isAdmin} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />}
          {tab === 'notifications' && <NotificationsView staffId={staffId} isAdmin={isAdmin} />}
          {tab === 'cashbook' && isAdmin && <CashBookView />}
          {tab === 'settings' && (
            <>
              <SettingsView isAdmin={isAdmin} currentUser={currentUser} onNavigate={onNavigate} showToast={showToast} />
              {onLogout && (
                <div style={{ ...S.card, marginTop: 12 }}>
                  <button onClick={onLogout} style={{ width: '100%', background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, fontSize: 14, cursor: 'pointer', padding: '6px 0', textAlign: 'left' }}>
                    Logout
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'coverage' && isAdmin && (
            <div style={S.card}>
              <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search staff by name…" value={search} onChange={e => setSearch(e.target.value)} />
              {loading ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredStaff.map(s => {
                    const status = statusFor(s.id)
                    const meta = {
                      approved: { label: 'Enrolled', color: '#16a34a', bg: '#dcfce7' },
                      pending:  { label: 'Pending approval', color: '#ca8a04', bg: '#fef9c3' },
                      none:     { label: 'Not enrolled', color: '#dc2626', bg: '#fee2e2' },
                    }[status]
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.designation || ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: meta.color, background: meta.bg }}>{meta.label}</span>
                          <button onClick={() => setEnrollTarget(s)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#0B1E3D', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {status === 'approved' ? 'Re-enroll' : 'Enroll'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {!filteredStaff.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No staff found.</p>}
                </div>
              )}
            </div>
          )}

          {tab === 'approvals' && isAdmin && (
            <div style={S.card}>
              <FaceApprovalQueue currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />
            </div>
          )}
        </>
      )}

      {enrollTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setEnrollTarget(null)} style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.2)', zIndex: 1 }}>✕</button>
            <FaceEnroll
              staffMember={enrollTarget}
              mode="admin"
              currentAdminId={currentUser?.staff_profile_id || null}
              onDone={() => { setEnrollTarget(null); fetchFaceRows() }}
              showToast={showToast}
            />
          </div>
        </div>
      )}

      <BottomNav
        active={tab === 'home' ? 'home' : (tab === 'checkin' ? 'checkin' : (tab === 'advances' ? 'advances' : (tab === 'settings' ? 'settings' : 'home')))}
        onNavigate={(key) => {
          if (key === 'home') setTab('home')
          else if (key === 'checkin' && loggedInStaff) setTab('checkin')
          else if (key === 'advances') setTab('advances')
          else if (key === 'settings') setTab('settings')
          else setTab('home')
        }}
        pendingCount={isAdmin ? counts.pending : 0}
      />
    </div>
  )
}
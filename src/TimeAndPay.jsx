// TimeAndPay.jsx — "Time & Pay" sidebar tab, styled after PagarBook's
// attendance/payroll app: Time card, Advances, Late fines, Cash book.
//
// IMPORTANT: all 4 sub-tabs are READ-ONLY VIEWS into data that already lives
// in GeoAttendance/staff_geo_attendance, Salary.jsx's staff_advances table,
// salary_deduction_rules, and Accounts.jsx's accounts table. This module
// creates no new tables and writes nothing — it exists purely so staff/admins
// get a PagarBook-style browsing experience without a second, drifting copy
// of the same money data. Edits still happen in Salary.jsx / Accounts.jsx.

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

const S = {
  page:  { padding: 20, fontFamily: "'Outfit',system-ui,sans-serif", background: '#f1f5f9', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 20, marginBottom: 16 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' },
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

// ─── 1. Time card — daily punch summary + working hours ────────────────────

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

// ─── 2. Advances — view into Salary.jsx's staff_advances table ─────────────

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

// ─── 3. Late fines — view into salary_deduction_rules + geo attendance ─────

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

  // late_rate in salary_deduction_rules is a per-instance amount applied during
  // payroll — shown here for context, not recalculated; the real deduction
  // number lives in Salary.jsx's late_deduction field for the month.
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

// ─── 4. Cash book — view into Accounts.jsx's accounts table ────────────────

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

// ─── Main export ─────────────────────────────────────────────────────────

export default function TimeAndPay({ currentUser, isAdmin, staff = [], loggedInStaff = null }) {
  const [tab, setTab] = useState('timecard')
  const staffId = loggedInStaff?.id || currentUser?.staff_profile_id || null

  if (!isAdmin && !staffId) {
    return <div style={S.page}><div style={S.card}>Your account isn't linked to a staff profile.</div></div>
  }

  const tabs = [
    { key: 'timecard',  label: 'Time card' },
    { key: 'advances',  label: 'Advances' },
    { key: 'fines',     label: 'Late fines' },
    ...(isAdmin ? [{ key: 'cashbook', label: 'Cash book' }] : []),
  ]

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0B1E3D' }}>💰 Time & Pay</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Attendance hours, advances, late fines, and cash flow at a glance — all pulled live from Salary and Accounts.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {tabs.map(t => <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {tab === 'timecard' && <TimeCard staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
      {tab === 'advances' && <AdvancesView staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
      {tab === 'fines'    && <LateFinesView staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
      {tab === 'cashbook' && isAdmin && <CashBookView />}
    </div>
  )
}
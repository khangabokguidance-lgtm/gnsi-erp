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
import GeoAttendance, { DriftFlaggedStaffPanel } from './GeoAttendance'
import { AttendanceSummaryView, ReportsView, BroadcastView, NotificationsView, RegularizationView } from './FaceAttendanceExtras'
import SettingsView from './SettingsView'
import AdvancedSettingsPanel from './AdvancedSettingsPanel'
import PremiumToggleCard from './PremiumToggleCard'
import AdminControlCenter from './AdminControlCenter'
import { tabHasSettings } from './premiumSettings'
import { COLOR, FONT, RADIUS, SHADOW, ledger, Seal, injectLedgerGlobalStyles } from './ledgerTheme.jsx'

const S = {
  page:  ledger.page,
  card:  ledger.card,
  ledgerList: ledger.ledgerList,
  ledgerRow:  ledger.ledgerRow,
  input: { ...ledger.input, padding: '9px 12px', fontSize: 13 },
  inputFull: { ...ledger.input, minHeight: 44 },
  tab:   (active) => ({
    padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    background: 'none', border: 'none', whiteSpace: 'nowrap', fontFamily: FONT.body,
    borderBottom: `3px solid ${active ? COLOR.brass : 'transparent'}`,
    color: active ? COLOR.ink : COLOR.slate,
    transition: 'color 0.15s, border-color 0.15s',
  }),
  th: ledger.th,
  td: ledger.td,
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
  const tone = toast?.type === 'err' ? { bg: COLOR.dangerBg, fg: COLOR.danger } : toast?.type === 'warn' ? { bg: COLOR.warnBg, fg: COLOR.warn } : { bg: COLOR.okBg, fg: COLOR.sageDeep }
  const el = toast ? (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      background: tone.bg, color: tone.fg, padding: '13px 22px', borderRadius: RADIUS.md,
      boxShadow: SHADOW.onParchment, fontSize: 13, fontWeight: 600, fontFamily: FONT.body,
      border: `1px solid ${tone.fg}22`, animation: 'ledger-slide-in 0.2s ease',
    }}>
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
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: COLOR.ink }}>
          Total: {totalHours.toFixed(1)} hrs across {rows.length} shift{rows.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 24 }}>Loading…</p>
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
                    <td style={S.td}>{outT ? fmtTime(outT) : <span style={{ color: COLOR.warn, fontWeight: 600 }}>Active</span>}</td>
                    <td style={S.td}>{hrs !== null ? `${hrs.toFixed(1)}h` : '—'}</td>
                    <td style={{ ...S.td, color: (r.late_minutes || 0) > 0 ? COLOR.warn : COLOR.slate, fontWeight: 600 }}>
                      {(r.late_minutes || 0) > 0 ? `+${r.late_minutes}m` : '—'}
                    </td>
                    <td style={S.td}>{r.status}</td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: COLOR.slate }}>No check-in records for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Advances — view into Salary.jsx's staff_advances table ────────────────

function AdvancesView({ staffId, isAdmin, staffList, currentAdminId, showToast }) {
  const [advances, setAdvances] = useState([])
  const [loading, setLoading]   = useState(true)
  const [staffFilter, setStaffFilter] = useState(isAdmin ? 'all' : String(staffId))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staff_id: '', amount: '', reason: '', issued_month: currentMonth(), repay_months: 1 })
  const [submitting, setSubmitting] = useState(false)

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

  const submitAdvance = async () => {
    if (!form.staff_id) { showToast?.('Select a staff member', 'err'); return }
    if (!form.amount || Number(form.amount) <= 0) { showToast?.('Enter a valid amount', 'err'); return }
    setSubmitting(true)
    // Same insert shape as Salary.jsx's handleAddAdvance — single source of
    // truth stays staff_advances, this just gives admins a second entry point.
    const { error } = await supabase.from('staff_advances').insert([{
      staff_id: Number(form.staff_id),
      amount: Number(form.amount),
      reason: form.reason || null,
      issued_month: form.issued_month,
      repay_months: Number(form.repay_months) || 1,
      repaid_amount: 0,
      status: 'Active',
    }])
    if (error) showToast?.('Could not issue advance: ' + error.message, 'err')
    else {
      showToast?.('Advance issued', 'ok')
      setForm({ staff_id: '', amount: '', reason: '', issued_month: currentMonth(), repay_months: 1 })
      setShowForm(false)
      fetchAdvances()
    }
    setSubmitting(false)
  }

  return (
    <div>
      {isAdmin && (
        showForm ? (
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 13, color: COLOR.ink, marginBottom: 12 }}>Issue new advance</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Staff member</label>
            <select style={{ ...S.inputFull, marginBottom: 10 }} value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
              <option value="">Select staff…</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Amount (₹)</label>
            <input type="number" style={{ ...S.inputFull, marginBottom: 10 }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" />
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Issued month</label>
                <input type="month" style={S.inputFull} value={form.issued_month} onChange={e => setForm(f => ({ ...f, issued_month: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Repay over (months)</label>
                <input type="number" min="1" style={S.inputFull} value={form.repay_months} onChange={e => setForm(f => ({ ...f, repay_months: e.target.value }))} />
              </div>
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Reason (optional)</label>
            <input style={{ ...S.inputFull, marginBottom: 14 }} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Medical emergency" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ ...ledger.btnGhost(), flex: 1 }}>Cancel</button>
              <button onClick={submitAdvance} disabled={submitting} style={{ ...ledger.btnPrimary(submitting), flex: 2 }}>
                {submitting ? 'Issuing…' : 'Issue advance'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ ...ledger.btnPrimary(), width: '100%', marginBottom: 16 }}>
            + Issue new advance
          </button>
        )
      )}

      <div style={S.card}>
      <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
        Repayments are applied automatically from the Salary module during payroll processing.
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
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.ink, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.issued)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Total issued</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.sageDeep, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.repaid)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Repaid so far</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.danger, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.outstanding)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Outstanding</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 24 }}>Loading…</p>
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
                  <td style={{ ...S.td, fontWeight: 700, color: (a.amount - a.repaid_amount) > 0 ? COLOR.danger : COLOR.sageDeep }}>
                    {fmtRupee(a.amount - a.repaid_amount)}
                  </td>
                  <td style={S.td}>{a.repay_months}</td>
                  <td style={S.td}>{a.reason || '—'}</td>
                  <td style={S.td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: a.status === 'Active' ? COLOR.warnBg : COLOR.okBg, color: a.status === 'Active' ? COLOR.warn : COLOR.sageDeep }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!advances.length && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: COLOR.slate }}>No advances recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      </div>
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
      <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
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
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: COLOR.warn }}>
          {totalLateInstances} late check-in{totalLateInstances !== 1 ? 's' : ''} · {totalLateMinutes} min total
        </div>
      </div>

      {loading ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 24 }}>Loading…</p>
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
                  <td style={{ ...S.td, color: COLOR.warn, fontWeight: 700 }}>+{r.late_minutes} min</td>
                  <td style={S.td}>{r.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: COLOR.slate }}>No late check-ins for this month.</td></tr>}
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
      <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
        View only — entries are added and edited from the Accounts module.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={S.input} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.sageDeep, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.income)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Income</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.danger, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.expense)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Expense</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.ink, fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(totals.income - totals.expense)}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 600 }}>Net</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Type', 'Category', 'Amount', 'Mode', 'Note', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={S.td}>{fmtDate(r.entry_date)}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: r.type === 'Income' ? COLOR.sageDeep : COLOR.danger }}>{r.type}</td>
                  <td style={S.td}>{r.category}</td>
                  <td style={S.td}>{fmtRupee(r.amount)}</td>
                  <td style={S.td}>{r.payment_mode}</td>
                  <td style={S.td}>{r.note || '—'}</td>
                  <td style={S.td}>{r.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: COLOR.slate }}>No entries for this month.</td></tr>}
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
      background: COLOR.parchmentRaised, border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.lg,
      padding: '20px 10px 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
      cursor: 'pointer', position: 'relative', fontFamily: FONT.body, boxShadow: SHADOW.onParchment,
      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 8, right: 10, background: COLOR.danger, color: COLOR.cream, fontSize: 10, fontWeight: 800, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: FONT.body }}>
          {badge}
        </span>
      )}
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: COLOR.ink2, textAlign: 'center', lineHeight: 1.25, fontFamily: FONT.body }}>{label}</span>
    </button>
  )
}

// Smaller, lighter secondary shortcut tile.
function QuickActionTile({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '4px 2px',
    }}>
      <span style={{
        width: 46, height: 46, borderRadius: '50%',
        background: `linear-gradient(155deg, ${COLOR.sage}18, ${COLOR.sage}0a)`,
        border: `1px solid ${COLOR.sage}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
      }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: COLOR.ink2, textAlign: 'center', lineHeight: 1.2, fontFamily: FONT.body }}>{label}</span>
    </button>
  )
}

// ─── Bottom nav bar — PagarBook-style fixed 4-item bar ─────────────────────

function useIsDesktopWidth() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isDesktop
}

function BottomNav({ active, onNavigate, pendingCount }) {
  const isDesktop = useIsDesktopWidth()
  const items = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'checkin',  icon: '✅', label: 'Attendance', badge: pendingCount },
    { key: 'advances', icon: '💵', label: 'Advances' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0,
      left: isDesktop ? 'var(--gnsi-sidebar-width, 260px)' : 0,
      right: 0, zIndex: 500,
      background: COLOR.parchmentRaised, borderTop: `1px solid ${COLOR.rule}`,
      display: 'flex', justifyContent: 'space-around', padding: '9px 0 11px',
      boxShadow: '0 -4px 20px -8px rgba(11,23,48,.15)',
      boxSizing: 'border-box',
    }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onNavigate(it.key)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: active === it.key ? COLOR.ink : COLOR.slate, position: 'relative', padding: '2px 10px',
        }}>
          {it.badge > 0 && (
            <span style={{ position: 'absolute', top: -2, right: 4, width: 8, height: 8, borderRadius: '50%', background: COLOR.danger, border: `1.5px solid ${COLOR.parchmentRaised}` }} />
          )}
          <span style={{ fontSize: 19, opacity: active === it.key ? 1 : 0.75 }}>{it.icon}</span>
          <span style={{ fontSize: 10.5, fontWeight: active === it.key ? 700 : 500 }}>{it.label}</span>
          {active === it.key && <span style={{ position: 'absolute', bottom: -11, width: 16, height: 2, borderRadius: 2, background: COLOR.brass }} />}
        </button>
      ))}
    </div>
  )
}

// ─── Main export ────────────────────────────────────────────────────────────

export default function FaceAttendance({ currentUser, isAdmin, staff = [], loggedInStaff = null, onNavigate = null, onLogout = null }) {
  useEffect(() => { injectLedgerGlobalStyles() }, [])
  const { show: showToast, el: toastEl } = useToast()
  const [tab, setTab] = useState('home')
  const [faceRows, setFaceRows] = useState([]) // staff_face_descriptors, latest per staff
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enrollTarget, setEnrollTarget] = useState(null)
  const [settingsTab, setSettingsTab] = useState(null) // tab key whose Advanced Settings sheet is open, or null

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
    { key: 'regularization', icon: '🛠️', label: 'Correct attendance' },
    { key: 'reports',  icon: '📊', label: 'Reports' },
    { key: 'broadcast', icon: '📣', label: 'Broadcast messages' },
    { key: 'notifications', icon: '🔔', label: 'Notifications' },
    ...(isAdmin ? [
      { key: 'coverage',  icon: '👥', label: 'Staff coverage' },
      { key: 'approvals', icon: '📋', label: 'Approvals', badge: counts.pending },
      { key: 'cashbook',  icon: '📒', label: 'Cash book' },
      { key: 'controlcenter', icon: '🎛️', label: 'Control Center' },
    ] : []),
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  const pageTitles = {
    checkin: 'Take attendance', attendancesummary: 'Attendance', timecard: 'Time card', advances: 'Advances',
    fines: 'Late fines', regularization: 'Correct attendance', reports: 'Reports', broadcast: 'Broadcast messages', notifications: 'Notifications',
    coverage: 'Staff coverage', approvals: 'Pending approvals', cashbook: 'Cash book', controlcenter: 'Admin Control Center', settings: 'Settings',
  }

  // Quick actions row, below the main tile grid — role-aware, matching
  // PagarBook's smaller secondary shortcut row.
  const quickActions = isAdmin
    ? [{ key: 'enroll', icon: '🧑‍💼', label: 'Enroll face', onClick: () => setTab('coverage') }]
    : [
        { key: 'qa-checkin',  icon: '✅', label: 'Take attendance', onClick: () => loggedInStaff && setTab('checkin') },
        { key: 'qa-timecard', icon: '🕐', label: 'Time card', onClick: () => setTab('timecard') },
      ]

  return (
    <div style={S.page}>
      {toastEl}

      {/* ── Header — the ledger's title plate: ink gradient, brass hairline, serif identity ── */}
      <div style={ledger.header}>
        <div style={ledger.headerRule} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={ledger.eyebrow}>GNSI · STAFF LEDGER</div>
            <div style={ledger.headline}>Face Attendance</div>
            <div style={{ fontSize: 12.5, color: COLOR.cream, opacity: 0.72, marginTop: 3, fontFamily: FONT.body }}>
              {loggedInStaff?.name || currentUser?.name || 'Administrator'}
            </div>
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(155deg, ${COLOR.brass}, ${COLOR.brassDeep})`,
            color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, fontFamily: FONT.body,
            boxShadow: SHADOW.seal, border: `1px solid ${COLOR.brass}`,
          }}>
            {initials}
          </div>
        </div>
      </div>

      {tab === 'home' ? (
        <>
          {isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: '16px 10px', borderTop: `2px solid ${COLOR.sage}` }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: COLOR.sageDeep, fontFamily: FONT.display }}>{counts.approved}</div>
                <div style={{ fontSize: 10.5, color: COLOR.slate, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Enrolled</div>
              </div>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: '16px 10px', borderTop: `2px solid ${COLOR.warn}` }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: COLOR.warn, fontFamily: FONT.display }}>{counts.pending}</div>
                <div style={{ fontSize: 10.5, color: COLOR.slate, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Pending</div>
              </div>
              <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: '16px 10px', borderTop: `2px solid ${COLOR.danger}` }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: COLOR.danger, fontFamily: FONT.display }}>{counts.none}</div>
                <div style={{ fontSize: 10.5, color: COLOR.slate, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Not enrolled</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {primaryTiles.map(t => (
              <HomeTile key={t.key} icon={t.icon} label={t.label} badge={t.badge} onClick={() => setTab(t.key)} />
            ))}
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.slate, letterSpacing: '0.03em', margin: '22px 0 12px 2px', fontFamily: FONT.body }}>QUICK ACTIONS</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quickActions.length},1fr)`, gap: 10 }}>
            {quickActions.map(q => (
              <QuickActionTile key={q.key} icon={q.icon} label={q.label} onClick={q.onClick} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => setTab('home')} style={{ background: 'none', border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 15, color: COLOR.ink2, padding: '6px 10px', lineHeight: 1 }}>←</button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLOR.ink, flex: 1, fontFamily: FONT.display, letterSpacing: '-0.01em' }}>{pageTitles[tab]}</h2>
            {tabHasSettings(tab) && (
              <button
                onClick={() => setSettingsTab(tab)}
                title={`${pageTitles[tab]} — advanced settings`}
                style={{ background: 'none', border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 16, color: COLOR.slate, padding: '7px 9px', lineHeight: 1 }}
              >
                ⚙️
              </button>
            )}
          </div>

          {tab === 'checkin' && loggedInStaff && (
            statusFor(loggedInStaff.id) === 'approved' ? (
              <GeoAttendance currentStaff={loggedInStaff} isAdmin={false} allStaff={[loggedInStaff]} />
            ) : (
              <div style={S.card}>
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🧑‍💼</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: COLOR.ink, marginBottom: 6, fontFamily: FONT.display }}>
                    {statusFor(loggedInStaff.id) === 'pending' ? 'Face enrollment pending approval' : 'Face not enrolled yet'}
                  </div>
                  <p style={{ fontSize: 13, color: COLOR.slate, margin: '0 0 16px' }}>
                    {statusFor(loggedInStaff.id) === 'pending'
                      ? 'An admin needs to approve your face enrollment before you can check in.'
                      : 'Check-in requires an approved face enrollment. Ask an admin to enroll your face, or enroll yourself for admin approval.'}
                  </p>
                  {statusFor(loggedInStaff.id) !== 'pending' && (
                    <button onClick={() => setEnrollTarget(loggedInStaff)} style={ledger.btnPrimary()}>
                      Enroll my face
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {tab === 'attendancesummary' && <AttendanceSummaryView isAdmin={isAdmin} staffList={filteredStaff} showToast={showToast} onNavigate={onNavigate} currentUsername={currentUser?.username} />}
          {tab === 'timecard' && <TimeCard staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'advances' && <AdvancesView staffId={staffId} isAdmin={isAdmin} staffList={staff} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />}
          {tab === 'fines'    && <LateFinesView staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'regularization' && <RegularizationView staffId={staffId} isAdmin={isAdmin} showToast={showToast} currentUsername={currentUser?.username} />}
          {tab === 'reports'  && <ReportsView isAdmin={isAdmin} staffList={staff} />}
          {tab === 'broadcast' && <BroadcastView isAdmin={isAdmin} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />}
          {tab === 'notifications' && <NotificationsView staffId={staffId} isAdmin={isAdmin} />}
          {tab === 'cashbook' && isAdmin && <CashBookView />}
          {tab === 'controlcenter' && isAdmin && (
            <AdminControlCenter isAdmin={isAdmin} adminId={currentUser?.staff_profile_id || null} showToast={showToast} />
          )}
          {tab === 'settings' && (
            <>
              {isAdmin && (
                <PremiumToggleCard
                  isAdmin={isAdmin}
                  adminId={currentUser?.staff_profile_id || null}
                  showToast={showToast}
                />
              )}
              <SettingsView isAdmin={isAdmin} currentUser={currentUser} onNavigate={onNavigate} showToast={showToast} />
              {onLogout && (
                <div style={{ ...S.card, marginTop: 12 }}>
                  <button onClick={onLogout} style={{ width: '100%', background: 'none', border: 'none', color: COLOR.danger, fontWeight: 800, fontSize: 14, cursor: 'pointer', padding: '6px 0', textAlign: 'left' }}>
                    Logout
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'coverage' && isAdmin && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.ink, marginBottom: 8, fontFamily: FONT.display }}>Face-match drift watch</div>
              <div style={{ marginBottom: 18 }}>
                <DriftFlaggedStaffPanel showToast={showToast} />
              </div>
              <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search staff by name…" value={search} onChange={e => setSearch(e.target.value)} />
              {loading ? (
                <p style={{ color: COLOR.slate, textAlign: 'center', padding: 20 }}>Loading…</p>
              ) : (
                <div style={S.ledgerList}>
                  {filteredStaff.map((s, i) => {
                    const status = statusFor(s.id)
                    const meta = {
                      approved: { label: 'Enrolled', color: COLOR.sageDeep, bg: COLOR.okBg },
                      pending:  { label: 'Pending approval', color: COLOR.warn, bg: COLOR.warnBg },
                      none:     { label: 'Not enrolled', color: COLOR.danger, bg: COLOR.dangerBg },
                    }[status]
                    return (
                      <div key={s.id} style={{ ...S.ledgerRow, borderBottom: i === filteredStaff.length - 1 ? 'none' : S.ledgerRow.borderBottom }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.ink2, fontFamily: FONT.body }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: COLOR.slate }}>{s.designation || ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: RADIUS.pill, color: meta.color, background: meta.bg }}>{meta.label}</span>
                          <button onClick={() => setEnrollTarget(s)} style={{ padding: '7px 13px', borderRadius: RADIUS.sm, border: 'none', background: COLOR.ink, color: COLOR.cream, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>
                            {status === 'approved' ? 'Re-enroll' : 'Enroll'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {!filteredStaff.length && <p style={{ textAlign: 'center', color: COLOR.slate, padding: 24 }}>No staff found.</p>}
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

      {settingsTab && (
        <AdvancedSettingsPanel
          tabKey={settingsTab}
          tabLabel={pageTitles[settingsTab]}
          staffId={staffId}
          isAdmin={isAdmin}
          adminId={currentUser?.staff_profile_id || null}
          showToast={showToast}
          onClose={() => setSettingsTab(null)}
        />
      )}

      {enrollTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setEnrollTarget(null)} style={{ position: 'absolute', top: -14, right: -14, width: 34, height: 34, borderRadius: '50%', border: `2px solid ${COLOR.parchment}`, background: COLOR.ink, color: COLOR.brass, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW.onInk, zIndex: 1, fontFamily: FONT.body }}>✕</button>
            <FaceEnroll
              staffMember={enrollTarget}
              mode={isAdmin ? 'admin' : 'self'}
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
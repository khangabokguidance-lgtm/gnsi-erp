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
import Salary from './Salary'
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

// ─── "Vault" home-screen palette ────────────────────────────────────────────
// Home tab only: deep navy canvas + brushed-gold accents, layered on top of
// the existing Ledger & Crest tokens (COLOR.ink/brass/cream) rather than
// replacing them, so every other tab/view in this file is untouched.
const VAULT = {
  bg: '#081527',
  bgRaised: 'linear-gradient(135deg, #0f2544 0%, #0a1a30 100%)',
  panel: 'rgba(255,255,255,0.03)',
  panelBorder: 'rgba(201,162,75,0.15)',
  goldBorder: 'rgba(201,162,75,0.3)',
  textPrimary: '#F3EEE0',
  textMuted: '#7d8ba3',
  tileLabel: '#cfd6e2',
  ok: '#5DCAA5',
}

// PAY — the "premium payment app" theme (Stripe/Razorpay-style): clean
// white cards, blue/green accents, soft shadows. Used for the redesigned
// Home and Payroll screens; VAULT above stays untouched for everything
// not yet migrated, so both can coexist without one breaking the other.
const PAY = {
  bg: '#F7F9FC',
  card: '#FFFFFF',
  cardBorder: '#EAEEF3',
  shadow: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
  shadowRaised: '0 4px 16px rgba(16,24,40,0.08), 0 1px 3px rgba(16,24,40,0.06)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  red: '#DC2626',
  redBg: '#FEF2F2',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  divider: '#F1F5F9',
  radius: 16,
  radiusSm: 10,
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
  const [fetchError, setFetchError] = useState(null)

  const fetchRules = useCallback(async () => {
    const { data } = await supabase.from('salary_deduction_rules').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setRules(data || null)
  }, [])

  const fetchLateRows = useCallback(async () => {
    setLoading(true)
    // BUGFIX: this hardcoded `${month}-31` as the end of the range —
    // invalid for any 28/29/30-day month (identical bug to the one fixed
    // in PayrollView). For September this silently broke the query and
    // the screen showed "0 late days" even with real Late/Half Day rows
    // on file. Compute the real last day of the month instead.
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`

    let q = supabase
      .from('staff_geo_attendance')
      .select('id, staff_id, date, shift_label, late_minutes, status, staff_profiles(name)')
      .gte('date', `${month}-01`)
      .lte('date', monthEnd)
      // Filter to status = 'Late' specifically, not just late_minutes > 0
      // — under the three-band lateness rule, a Half Day row also carries
      // a positive late_minutes, and Half Day already has its own
      // separate deduction (half_day_rate) elsewhere. Including it here
      // too would double-charge the same day under both rules.
      .eq('status', 'Late')
      .order('date', { ascending: false })
    if (!isAdmin) q = q.eq('staff_id', staffId)
    else if (staffFilter !== 'all') q = q.eq('staff_id', staffFilter)
    const { data, error } = await q
    if (error) {
      console.error('LateFinesView fetchLateRows error:', error)
      setFetchError(error.message)
      setRows([])
    } else {
      setFetchError(null)
      setRows(data || [])
    }
    setLoading(false)
  }, [month, isAdmin, staffId, staffFilter])

  useEffect(() => { fetchRules() }, [fetchRules])
  useEffect(() => { fetchLateRows() }, [fetchLateRows])

  const totalLateInstances = rows.length
  const totalLateMinutes = rows.reduce((s, r) => s + (r.late_minutes || 0), 0)
  const estimatedFine = rules ? totalLateInstances * Number(rules.late_rate || 0) : null // flat per late DAY, not per minute

  return (
    <div style={S.card}>
      <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
        View only — the actual fine amount is applied in Salary.jsx's monthly payroll run using the active deduction rule below. Late deduction is a flat rate per late day, regardless of how many minutes late.
      </p>

      {fetchError && (
        <div style={{ background: COLOR.dangerBg, border: `1px dashed ${COLOR.danger}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: COLOR.danger }}>
          ⚠️ Could not load late check-ins: {fetchError}
        </div>
      )}

      {rules && (
        <div style={{ background: '#fffbeb', border: '1px dashed #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
          Active rule: <strong>₹{rules.late_rate}</strong>/late day · <strong>₹{rules.absent_rate}</strong>/absent day · <strong>₹{rules.early_out_rate}</strong>/early-out day
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
          {totalLateInstances} late day{totalLateInstances !== 1 ? 's' : ''} ({totalLateMinutes} min total){estimatedFine !== null && ` · est. fine ${fmtRupee(estimatedFine)}`}
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

// ─── Dashboard — 6 org-wide charts, hand-rolled SVG (no chart library
// dependency, matching the existing FraudScatterWidget pattern in
// GeoAttendance.jsx). Admin-only, read-only, aggregates straight from
// staff_geo_attendance/salary_deduction_rules — doesn't write anything.

const STATUS_COLORS = {
  Present:  PAY.green,
  Late:     PAY.amber,
  'Half Day': '#0369A1',
  Absent:   PAY.red,
  EarlyOut: '#7C3AED',
  Flagged:  '#7C3AED',
}

// Check-in/check-out flow diagram — purely illustrative, shows the 4-step
// process (Open app → Face scan → GPS verify → Tracking starts) plus the
// mirrored checkout steps. No live data, no interactivity.
function CheckInFlowDiagram() {
  const steps = [
    { icon: '📱', label: 'Open Check-In' },
    { icon: '🤳', label: 'Face scan' },
    { icon: '📍', label: 'GPS verified' },
    { icon: '✅', label: 'Tracking starts' },
  ]
  const outSteps = [
    { icon: '⏹️', label: 'Tap Check Out' },
    { icon: '🤳', label: 'Face scan' },
    { icon: '📝', label: 'Day recorded' },
  ]
  const Row = ({ items, tint }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
      {items.map((s, i) => (
        <React.Fragment key={s.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 68, flexShrink: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
            }}>{s.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: PAY.textSecondary, textAlign: 'center', lineHeight: 1.2 }}>{s.label}</div>
          </div>
          {i < items.length - 1 && <div style={{ color: PAY.textMuted, fontSize: 16, flexShrink: 0, marginBottom: 20 }}>→</div>}
        </React.Fragment>
      ))}
    </div>
  )
  return (
    <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius, padding: 18, boxShadow: PAY.shadow, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: PAY.textPrimary, fontFamily: FONT.body, marginBottom: 2 }}>How attendance works</div>
      <div style={{ fontSize: 11, color: PAY.textMuted, marginBottom: 14 }}>Every check-in and check-out is verified by face scan and location</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: PAY.blue, marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Check-in</div>
      <Row items={steps} tint={PAY.blueBg} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: PAY.red, margin: '16px 0 6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Check-out</div>
      <Row items={outSteps} tint={PAY.redBg} />
    </div>
  )
}

// Face-scan viewfinder frame — decorative only (per instruction: not a
// working camera), styled like a scanning UI with corner brackets around
// a face outline, to reinforce that biometric verification is required.
// Distinct "day complete" state — not a dimmed version of the active
// scan frame, but its own premium achievement-style card: dark gradient,
// glowing seal, subtle sparkle accents.
function DayCompleteCard() {
  return (
    <div style={{
      background: 'linear-gradient(155deg, #0B1E3D 0%, #142A52 55%, #0B1E3D 100%)',
      borderRadius: PAY.radius, padding: '32px 20px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 12px 32px rgba(11,30,61,0.35)',
    }}>
      <style>{`
        @keyframes dcSealGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(93,202,165,0.45), 0 8px 24px rgba(93,202,165,0.3); } 50% { box-shadow: 0 0 0 14px rgba(93,202,165,0), 0 8px 24px rgba(93,202,165,0.4); } }
        @keyframes dcSparkle { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes dcShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* faint sparkle accents scattered around */}
      {[
        { top: '14%', left: '12%', size: 5, delay: '0s' },
        { top: '22%', left: '82%', size: 4, delay: '0.6s' },
        { top: '72%', left: '18%', size: 4, delay: '1.1s' },
        { top: '78%', left: '78%', size: 6, delay: '0.3s' },
        { top: '48%', left: '6%', size: 3, delay: '0.9s' },
      ].map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size,
          background: '#C9A24B', borderRadius: '50%', animation: `dcSparkle 2.2s ease-in-out ${s.delay} infinite`,
        }} />
      ))}

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(93,202,165,0.14)',
        color: '#5DCAA5', fontSize: 10.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
        marginBottom: 20, letterSpacing: '0.04em', border: '1px solid rgba(93,202,165,0.3)',
      }}>
        ATTENDANCE COMPLETE
      </div>

      {/* glowing seal */}
      <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 20px' }}>
        <div style={{
          width: 92, height: 92, borderRadius: '50%',
          background: 'linear-gradient(155deg, #5DCAA5, #2F8F6E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'dcSealGlow 2.4s ease-in-out infinite',
          border: '3px solid rgba(255,255,255,0.15)',
        }}>
          <svg width="46" height="46" viewBox="0 0 52 52" fill="none">
            <path d="M14 27 L23 36 L40 17" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 19, color: '#F3EEE0', fontFamily: FONT.display, marginBottom: 6 }}>
        You're all set for today
      </div>
      <div style={{ fontSize: 12.5, color: 'rgba(243,238,224,0.65)', maxWidth: 260, margin: '0 auto', lineHeight: 1.5 }}>
        Both check-in and check-out are verified and recorded. See you tomorrow.
      </div>

      <div style={{
        marginTop: 22, height: 1, width: '100%', maxWidth: 200, marginLeft: 'auto', marginRight: 'auto',
        background: 'linear-gradient(90deg, transparent, rgba(201,162,75,0.4), transparent)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'rgba(243,238,224,0.55)' }}>
          <span style={{ fontSize: 12 }}>🔒</span> Verified
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'rgba(243,238,224,0.55)' }}>
          <span style={{ fontSize: 12 }}>📋</span> Recorded
        </div>
      </div>
    </div>
  )
}

function FaceScanFrame({ punchState, onTap }) {
  if (punchState === 'done') return <DayCompleteCard />

  const label = punchState === 'open' ? 'Check Out' : 'Check In'
  return (
    <div
      onClick={onTap}
      role="button"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #1C2333 0%, #0A0D14 70%)',
        borderRadius: 24, padding: '30px 20px', textAlign: 'center',
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        transition: 'transform 0.15s ease', boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.99)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <style>{`
        @keyframes fsRingSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fsBreathe { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.04); } }
        @keyframes fsDotPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      {/* ambient glow */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%', width: 220, height: 220,
        transform: 'translateX(-50%)', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,145,255,0.22) 0%, transparent 70%)',
        animation: 'fsBreathe 3.5s ease-in-out infinite', pointerEvents: 'none',
      }} />

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', marginBottom: 22, position: 'relative' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6391FF', animation: 'fsDotPulse 1.8s ease-in-out infinite' }} />
        FACE ID
      </div>

      {/* scanner ring */}
      <div style={{ position: 'relative', width: 156, height: 156, margin: '0 auto' }}>
        {/* rotating gradient ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent 0%, #6391FF 15%, transparent 30%, transparent 100%)',
          animation: 'fsRingSpin 3s linear infinite',
          maskImage: 'radial-gradient(circle, transparent 62%, black 63%, black 68%, transparent 69%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 62%, black 63%, black 68%, transparent 69%)',
        }} />
        {/* static faint ring track */}
        <div style={{
          position: 'absolute', inset: 8, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.08)',
        }} />

        <svg width="156" height="156" viewBox="0 0 156 156" style={{ display: 'block', position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id="fsFaceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
            </linearGradient>
          </defs>
          {/* glass panel behind the face */}
          <circle cx="78" cy="78" r="52" fill="rgba(255,255,255,0.04)" />
          {/* refined face silhouette */}
          <circle cx="78" cy="68" r="26" fill="none" stroke="url(#fsFaceGrad)" strokeWidth="2" />
          <path d="M48,112 Q78,92 108,112" fill="none" stroke="url(#fsFaceGrad)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div style={{ fontWeight: 700, fontSize: 17, color: '#FFFFFF', marginTop: 22, letterSpacing: '-0.01em' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 5, fontWeight: 400 }}>
        Tap to scan and verify your identity
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
          <span style={{ fontSize: 11 }}>🔒</span> Encrypted
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
          <span style={{ fontSize: 11 }}>📍</span> GPS-verified
        </div>
      </div>
    </div>
  )
}

function DashCard({ title, subtitle, children }) {
  return (
    <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius, padding: 18, boxShadow: PAY.shadow }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: PAY.textPrimary, fontFamily: FONT.body }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: PAY.textMuted, marginTop: 2, marginBottom: 12 }}>{subtitle}</div>}
      <div style={{ marginTop: subtitle ? 0 : 12 }}>{children}</div>
    </div>
  )
}

function EmptyChart({ text }) {
  return <div style={{ padding: '32px 0', textAlign: 'center', color: PAY.textMuted, fontSize: 12.5 }}>{text}</div>
}

// Chart 1 — stacked bar, daily Present/Late/Half Day/Absent counts this month.
function StackedTrendChart({ days }) {
  if (!days.length) return <EmptyChart text="No attendance data yet this month." />
  const W = 640, H = 200, PAD_L = 32, PAD_B = 24, PAD_T = 8
  const maxTotal = Math.max(1, ...days.map(d => d.Present + d.Late + d['Half Day'] + d.Absent))
  const barW = (W - PAD_L - 8) / days.length
  const yScale = (v) => (v / maxTotal) * (H - PAD_T - PAD_B)
  const statuses = ['Present', 'Late', 'Half Day', 'Absent']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PAD_L} y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke={PAY.divider} strokeWidth="1" />
      {days.map((d, i) => {
        let yOffset = H - PAD_B
        const x = PAD_L + i * barW + 2
        return (
          <g key={d.date}>
            {statuses.map(s => {
              const h = yScale(d[s] || 0)
              yOffset -= h
              if (h <= 0) return null
              return <rect key={s} x={x} y={yOffset} width={Math.max(1, barW - 3)} height={h} fill={STATUS_COLORS[s]} rx="1">
                <title>{`${d.date}: ${s} ${d[s]}`}</title>
              </rect>
            })}
            {(i % Math.ceil(days.length / 10 || 1) === 0) && (
              <text x={x + barW / 2} y={H - PAD_B + 14} fontSize="8.5" fill={PAY.textMuted} textAnchor="middle">{d.date.slice(-2)}</text>
            )}
          </g>
        )
      })}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={PAY.divider} strokeWidth="1" />
    </svg>
  )
}

// Chart 2 — donut, today's status breakdown.
function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <EmptyChart text="No check-ins yet today." />
  const R = 60, CX = 74, CY = 74, STROKE = 26
  const circumference = 2 * Math.PI * R
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={PAY.divider} strokeWidth={STROKE} />
        {segments.filter(s => s.value > 0).map((s, i) => {
          const frac = s.value / total
          const dash = frac * circumference
          const el = (
            <circle key={s.label} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${CX} ${CY})`}>
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          offset += dash
          return el
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill={PAY.textPrimary} fontFamily={FONT.display}>{total}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize="9" fill={PAY.textMuted}>staff</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} />
            <span style={{ color: PAY.textSecondary }}>{s.label}</span>
            <span style={{ color: PAY.textPrimary, fontWeight: 700, marginLeft: 2 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Chart 3 — simple bar, daily late-day count this month.
function DailyLateBarChart({ days }) {
  const withLate = days.filter(d => d.Late > 0 || d['Half Day'] > 0)
  if (!withLate.length) return <EmptyChart text="No late or half-day check-ins this month." />
  const W = 640, H = 160, PAD_L = 24, PAD_B = 22, PAD_T = 8
  const maxV = Math.max(1, ...days.map(d => d.Late + d['Half Day']))
  const barW = (W - PAD_L) / days.length
  const yScale = (v) => (v / maxV) * (H - PAD_T - PAD_B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PAD_L} y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke={PAY.divider} strokeWidth="1" />
      {days.map((d, i) => {
        const lateH = yScale(d.Late || 0)
        const halfH = yScale(d['Half Day'] || 0)
        const x = PAD_L + i * barW + 1
        return (
          <g key={d.date}>
            {lateH > 0 && <rect x={x} y={H - PAD_B - lateH} width={Math.max(1, barW - 2)} height={lateH} fill={PAY.amber} rx="1"><title>{`${d.date}: ${d.Late} late`}</title></rect>}
            {halfH > 0 && <rect x={x} y={H - PAD_B - lateH - halfH} width={Math.max(1, barW - 2)} height={halfH} fill="#0369A1" rx="1"><title>{`${d.date}: ${d['Half Day']} half day`}</title></rect>}
          </g>
        )
      })}
    </svg>
  )
}

// Chart 4 — horizontal bar, top late staff this month (ranked).
function TopLateStaffChart({ rows }) {
  if (!rows.length) return <EmptyChart text="No late or half-day staff this month." />
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => (
        <div key={r.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: PAY.textSecondary, fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: PAY.textPrimary, fontWeight: 700 }}>{r.count}</span>
          </div>
          <div style={{ background: PAY.divider, borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: PAY.amber, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Chart 5 — horizontal bar, payroll deduction breakdown this month.
function DeductionBreakdownChart({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total === 0) return <EmptyChart text="No deductions recorded this month." />
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: PAY.textPrimary, fontFamily: FONT.display, marginBottom: 14 }}>{fmtRupee(total)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.filter(i => i.value > 0).map(i => (
          <div key={i.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: PAY.textSecondary, fontWeight: 600 }}>{i.label}</span>
              <span style={{ color: i.color, fontWeight: 700 }}>{fmtRupee(i.value)}</span>
            </div>
            <div style={{ background: PAY.divider, borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(i.value / max) * 100}%`, height: '100%', background: i.color, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Chart 6 — horizontal bar, attendance rate (% present) by staff this month.
function AttendanceRateChart({ rows }) {
  if (!rows.length) return <EmptyChart text="No attendance data yet this month." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
      {rows.map(r => (
        <div key={r.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: PAY.textSecondary, fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: r.rate >= 90 ? PAY.green : r.rate >= 75 ? PAY.amber : PAY.red, fontWeight: 700 }}>{r.rate}%</span>
          </div>
          <div style={{ background: PAY.divider, borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${r.rate}%`, height: '100%', background: r.rate >= 90 ? PAY.green : r.rate >= 75 ? PAY.amber : PAY.red, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardView({ staffList }) {
  const [month] = useState(currentMonth())
  const [monthRows, setMonthRows] = useState([])
  const [todayRows, setTodayRows] = useState([])
  const [rules, setRules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    const [monthRes, todayRes, rulesRes] = await Promise.all([
      supabase.from('staff_geo_attendance').select('staff_id, date, status, late_minutes').gte('date', `${month}-01`).lte('date', monthEnd),
      supabase.from('staff_geo_attendance').select('staff_id, status').eq('date', todayIso),
      supabase.from('salary_deduction_rules').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const firstError = monthRes.error || todayRes.error
    if (firstError) {
      console.error('DashboardView fetchAll error:', firstError)
      setFetchError(firstError.message)
    } else {
      setFetchError(null)
    }
    setMonthRows(monthRes.data || [])
    setTodayRows(todayRes.data || [])
    setRules(rulesRes.data || null)
    setLoading(false)
  }, [month])

  useEffect(() => { fetchAll() }, [fetchAll])

  const staffNameById = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.name])), [staffList])

  // Chart 1 + 3 data: per-day status counts across the month.
  const dayBuckets = useMemo(() => {
    const map = {}
    for (const r of monthRows) {
      if (!map[r.date]) map[r.date] = { date: r.date, Present: 0, Late: 0, 'Half Day': 0, Absent: 0 }
      const bucket = map[r.date]
      if (r.status === 'Present') bucket.Present++
      else if (r.status === 'Late') bucket.Late++
      else if (r.status === 'Half Day') bucket['Half Day']++
      else if (r.status === 'Absent') bucket.Absent++
      // Flagged/EarlyOut intentionally excluded from these buckets — same
      // convention as attendance_summary_for_range/sync_attendance_salary_feed.
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [monthRows])

  // Chart 2 data: today's breakdown.
  const todaySegments = useMemo(() => {
    const counts = { Present: 0, Late: 0, 'Half Day': 0, Absent: 0, Flagged: 0 }
    for (const r of todayRows) if (counts[r.status] !== undefined) counts[r.status]++
    return [
      { label: 'Present', value: counts.Present, color: STATUS_COLORS.Present },
      { label: 'Late', value: counts.Late, color: STATUS_COLORS.Late },
      { label: 'Half Day', value: counts['Half Day'], color: STATUS_COLORS['Half Day'] },
      { label: 'Absent', value: counts.Absent, color: STATUS_COLORS.Absent },
      { label: 'Flagged', value: counts.Flagged, color: STATUS_COLORS.Flagged },
    ]
  }, [todayRows])

  // Chart 4 data: top late/half-day staff this month, ranked.
  const topLateStaff = useMemo(() => {
    const counts = {}
    for (const r of monthRows) {
      if (r.status === 'Late' || r.status === 'Half Day') {
        counts[r.staff_id] = (counts[r.staff_id] || 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([id, count]) => ({ name: staffNameById[id] || `#${id}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [monthRows, staffNameById])

  // Chart 5 data: payroll deduction breakdown this month, using the active rule.
  const deductionBreakdown = useMemo(() => {
    if (!rules) return []
    const counts = { Late: 0, 'Half Day': 0, Absent: 0 }
    for (const r of monthRows) if (counts[r.status] !== undefined) counts[r.status]++
    return [
      { label: 'Late', value: counts.Late * Number(rules.late_rate || 0), color: STATUS_COLORS.Late },
      { label: 'Half Day', value: counts['Half Day'] * Number(rules.half_day_rate || 0), color: STATUS_COLORS['Half Day'] },
      { label: 'Absent', value: counts.Absent * Number(rules.absent_rate || 0), color: STATUS_COLORS.Absent },
    ]
  }, [monthRows, rules])

  // Chart 6 data: attendance rate (% Present or Late, i.e. showed up) by staff.
  const attendanceRate = useMemo(() => {
    const byStaff = {}
    for (const r of monthRows) {
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = { total: 0, present: 0 }
      byStaff[r.staff_id].total++
      if (r.status === 'Present' || r.status === 'Late' || r.status === 'Half Day') byStaff[r.staff_id].present++
    }
    return Object.entries(byStaff)
      .map(([id, v]) => ({ name: staffNameById[id] || `#${id}`, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate)
  }, [monthRows, staffNameById])

  if (loading) {
    return <div style={{ background: PAY.bg, margin: '-18px -16px 0', padding: '18px 16px 28px', minHeight: 'calc(100vh - 140px)' }}>
      <p style={{ color: PAY.textMuted, textAlign: 'center', padding: 40, fontFamily: FONT.body }}>Loading dashboard…</p>
    </div>
  }

  return (
    <div style={{ background: PAY.bg, margin: '-18px -16px 0', padding: '18px 16px 28px', minHeight: 'calc(100vh - 140px)', boxSizing: 'border-box' }}>
      {fetchError && (
        <div style={{ background: PAY.redBg, border: `1px solid ${PAY.red}33`, borderRadius: PAY.radiusSm, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: PAY.red }}>
          ⚠️ Could not load dashboard data: {fetchError}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <DashCard title="Attendance trend this month" subtitle="Present · Late · Half Day · Absent, by day">
          <StackedTrendChart days={dayBuckets} />
        </DashCard>
        <DashCard title="Today's status breakdown" subtitle="All staff, right now">
          <DonutChart segments={todaySegments} />
        </DashCard>
        <DashCard title="Late arrivals trend" subtitle="Late + Half Day check-ins by day this month">
          <DailyLateBarChart days={dayBuckets} />
        </DashCard>
        <DashCard title="Top late staff this month" subtitle="Ranked by Late + Half Day days">
          <TopLateStaffChart rows={topLateStaff} />
        </DashCard>
        <DashCard title="Payroll deductions this month" subtitle="Estimated from the active deduction rule">
          <DeductionBreakdownChart items={deductionBreakdown} />
        </DashCard>
        <DashCard title="Attendance rate by staff" subtitle="% of days present or late (not absent), this month">
          <AttendanceRateChart rows={attendanceRate} />
        </DashCard>
      </div>
    </div>
  )
}

// ─── Payroll (auto-counted from daily attendance) — READ-ONLY PREVIEW ──────
// Computes a live estimate of this month's net salary per staff, straight
// from staff_geo_attendance (day-by-day) using the active daily deduction
// rule below. This is a preview only — the actual payable salary row is
// still generated and saved in Salary.jsx (Auto-Generate Payroll), so there
// remains exactly one source of truth for what staff actually get paid.

const gross = (s) => (Number(s.basic_salary)||0) + (Number(s.seniority_allowance)||0) + (Number(s.loyalty_bonus)||0) + (Number(s.role_bonus)||0)

// PayrollView's own report export — a CSV of exactly what's on screen for
// the selected month/staff filter, including any admin adjustment already
// saved. Separate from Salary.jsx's exportReportCSV, which exports saved
// register rows across a date range rather than this live single-month
// preview.
function exportPayrollPreviewCSV(rows, month) {
  const headers = ['Staff','Designation','Present','Late Days','Half Day','Absent','Early Out','Late Ded.','Half Day Ded.','Absent Ded.','Early Ded.','Admin Adj.','Advance','Gross','Est. Net']
  const body = rows.map(r => [
    r.staff.name, r.staff.designation || r.staff.department || '',
    r.d.present, r.d.lateDays, r.d.halfDay, r.d.absent, r.d.earlyOut,
    r.lateDed, r.halfDayDed, r.absentDed, r.earlyDed, r.adminDed, r.advDed,
    r.gross, r.net,
  ])
  const csv = [headers, ...body].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `GNSI_Payroll_Preview_${month}.csv`; a.click()
  URL.revokeObjectURL(url)
}


function PayrollView({ staffId, isAdmin, staffList }) {
  const [month, setMonth] = useState(currentMonth())
  const [staffFilter, setStaffFilter] = useState(isAdmin ? 'all' : String(staffId))
  const [rules, setRules] = useState(null)
  const [attRows, setAttRows] = useState([])
  const [staffFull, setStaffFull] = useState([])
  const [advMap, setAdvMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  // Inline admin-deduction adjustment — writes directly into the salary
  // table (creating the row for this staff/month if it doesn't exist yet)
  // rather than waiting for Salary.jsx to generate the register first.
  // Uses the exact same row shape Salary.jsx's own save does, built from
  // this view's already-computed late/absent/early/half-day deductions,
  // so the created row is internally consistent rather than a partial one
  // that Salary.jsx would later have to reconcile.
  const [adjustingId, setAdjustingId] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ amount: '', note: '' })
  const [savingAdjust, setSavingAdjust] = useState(false)
  const [expandedId, setExpandedId] = useState(null) // which staff card is expanded to show its breakdown
  const [existingSalaryRows, setExistingSalaryRows] = useState({}) // staff_id -> existing salary row for `month`, if any

  const fetchExistingSalary = useCallback(async () => {
    const { data } = await supabase.from('salary').select('*').eq('month', month)
    setExistingSalaryRows(Object.fromEntries((data || []).map(r => [r.staff_id, r])))
  }, [month])
  useEffect(() => { if (isAdmin) fetchExistingSalary() }, [isAdmin, fetchExistingSalary])

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from('salary_deduction_rules')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRules(data || null)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const staffIds = isAdmin ? null : [staffId]

    // BUGFIX: this used to hardcode `${month}-31` as the end of the
    // range — an invalid date for any 28/29/30-day month (April, June,
    // September, November, February). Whether Postgres rejected that
    // literal outright or coerced it unpredictably, the net effect was a
    // query that could silently return nothing for exactly the months
    // this bug affects — which is why "Present" showed 0 for staff who
    // really did check in during September. Compute the real last day of
    // the month instead.
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last day of this month
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`

    let attQ = supabase
      .from('staff_geo_attendance')
      .select('staff_id, date, late_minutes, status')
      .gte('date', `${month}-01`)
      .lte('date', monthEnd)
    if (!isAdmin) attQ = attQ.eq('staff_id', staffId)
    else if (staffFilter !== 'all') attQ = attQ.eq('staff_id', staffFilter)

    let staffQ = supabase.from('staff_profiles').select('id, name, designation, department, basic_salary, seniority_allowance, loyalty_bonus, role_bonus')
    if (!isAdmin) staffQ = staffQ.eq('id', staffId)
    else if (staffFilter !== 'all') staffQ = staffQ.eq('id', staffFilter)

    let advQ = supabase.from('staff_advances').select('staff_id, amount, repaid_amount, repay_months, status').eq('status', 'Active')
    if (!isAdmin) advQ = advQ.eq('staff_id', staffId)
    else if (staffFilter !== 'all') advQ = advQ.eq('staff_id', staffFilter)

    // BUGFIX: errors from all three queries used to be destructured away
    // and never checked — a failed attendance query silently rendered as
    // "no attendance this month" (Present: 0 everywhere) with no
    // indication anything had gone wrong. Now surfaced as a visible error
    // state instead of a quietly-wrong table.
    const [attRes, staffRes, advRes] = await Promise.all([attQ, staffQ, advQ])
    const firstError = attRes.error || staffRes.error || advRes.error
    if (firstError) {
      console.error('PayrollView fetchAll error:', firstError)
      setFetchError(firstError.message)
    } else {
      setFetchError(null)
    }
    setAttRows(attRes.data || [])
    setStaffFull(staffRes.data || [])
    const am = {}
    ;(advRes.data || []).forEach(a => {
      const rem = Number(a.amount) - Number(a.repaid_amount || 0)
      const emi = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
      am[a.staff_id] = (am[a.staff_id] || 0) + Math.min(emi, rem)
    })
    setAdvMap(am)
    setLoading(false)
  }, [month, isAdmin, staffId, staffFilter])

  useEffect(() => { fetchRules() }, [fetchRules])
  useEffect(() => { fetchAll() }, [fetchAll])

  const perDay = useMemo(() => {
    const map = {}
    attRows.forEach(r => {
      if (!map[r.staff_id]) map[r.staff_id] = { lateMin: 0, lateDays: 0, absent: 0, earlyOut: 0, halfDay: 0, present: 0 }
      const m = map[r.staff_id]
      m.lateMin += r.late_minutes || 0
      if ((r.late_minutes || 0) > 0) m.lateDays++ // flat per-day count — any minutes late counts as one late day
      // BUGFIX: this used to be if/else-if/else, so any status other than
      // exactly 'Absent' or 'Early Out'/'EarlyOut' fell into the final
      // else and got counted as "present" — silently absorbing Late,
      // Half Day, and Flagged days into the present count with zero
      // deduction for them. Each status is now checked independently so
      // Half Day gets its own count/deduction, and none of the others get
      // miscounted as present just because they didn't match the first
      // two branches.
      if (r.status === 'Absent') m.absent++
      else if (r.status === 'Early Out' || r.status === 'EarlyOut') m.earlyOut++
      else if (r.status === 'Half Day') m.halfDay++
      else if (r.status === 'Present' || r.status === 'Late') m.present++
      // Flagged or any other status: not counted in any bucket here —
      // matches attendance_summary_for_range/sync_attendance_salary_feed,
      // which also leave Flagged out of present/absent/late/half-day/early
      // counts until an admin resolves it.
    })
    return map
  }, [attRows])

  const rows = useMemo(() => {
    const LATE = Number(rules?.late_rate || 0)
    const ABSENT = Number(rules?.absent_rate || 0)
    const EARLY = Number(rules?.early_out_rate || 0)
    const HALFDAY = Number(rules?.half_day_rate || 0)
    return staffFull.map(s => {
      const d = perDay[s.id] || { lateMin: 0, lateDays: 0, absent: 0, earlyOut: 0, halfDay: 0, present: 0 }
      const lateDed = d.lateDays * LATE
      const absentDed = d.absent * ABSENT
      const earlyDed = d.earlyOut * EARLY
      const halfDayDed = d.halfDay * HALFDAY
      const advDed = advMap[s.id] || 0
      // Fold in any admin_deduction already saved for this staff/month —
      // otherwise saving an adjustment and reloading would show a net
      // figure that silently ignores what was just stored.
      const adminDed = Number(existingSalaryRows[s.id]?.admin_deduction || 0)
      const g = gross(s)
      const totalDed = lateDed + absentDed + earlyDed + halfDayDed + advDed + adminDed
      const net = g - totalDed
      return { staff: s, d, lateDed, absentDed, earlyDed, halfDayDed, advDed, adminDed, gross: g, totalDed, net }
    }).sort((a, b) => (a.staff.name || '').localeCompare(b.staff.name || ''))
  }, [staffFull, perDay, advMap, rules, existingSalaryRows])

  const monthTotals = useMemo(() => rows.reduce((acc, r) => ({
    gross: acc.gross + r.gross, ded: acc.ded + r.totalDed, net: acc.net + r.net,
  }), { gross: 0, ded: 0, net: 0 }), [rows])

  const startAdjust = (row) => {
    setAdjustingId(row.staff.id)
    setAdjustForm({ amount: String(existingSalaryRows[row.staff.id]?.admin_deduction || ''), note: '' })
  }

  const saveAdjust = async (row) => {
    setSavingAdjust(true)
    const amount = Number(adjustForm.amount) || 0
    const existing = existingSalaryRows[row.staff.id]
    // Recompute using this row's OWN already-correct late/absent/early/
    // half-day deductions plus the new admin_deduction, rather than
    // trusting any stale value from `existing` — this view's live
    // attendance numbers are the source of truth for those fields even
    // when a salary row already exists (e.g. it was created by an
    // earlier partial save here, before more of the month's attendance
    // had come in).
    const baseDed = row.lateDed + row.absentDed + row.earlyDed + row.halfDayDed + row.advDed
    const perfAdj = Number(existing?.performance_adjustment || 0)
    const totDed = baseDed + amount + (perfAdj < 0 ? -perfAdj : 0)
    const payload = {
      staff_id: row.staff.id, month,
      basic_salary: row.staff.basic_salary || 0,
      seniority_allowance: row.staff.seniority_allowance || 0,
      loyalty_bonus: row.staff.loyalty_bonus || 0,
      role_bonus: row.staff.role_bonus || 0,
      allowance: (row.staff.seniority_allowance || 0) + (row.staff.loyalty_bonus || 0) + (row.staff.role_bonus || 0),
      advance_deduction: row.advDed,
      late_deduction: row.lateDed + row.halfDayDed, // Salary.jsx has no separate half-day column — folded into late_deduction so nothing is silently dropped
      admin_deduction: amount,
      pf_deduction: existing?.pf_deduction || 0,
      performance_adjustment: perfAdj,
      deduction: totDed,
      net_salary: row.gross + (perfAdj > 0 ? perfAdj : 0) - totDed,
      status: existing?.status || 'Unpaid',
      payment_mode: existing?.payment_mode || 'Cash',
    }
    const { error } = await supabase.from('salary').upsert([payload], { onConflict: 'staff_id,month' })
    setSavingAdjust(false)
    if (error) { alert('Could not save adjustment: ' + error.message); return }
    setAdjustingId(null)
    await fetchExistingSalary()
  }

  return (
    <div style={{ background: PAY.bg, margin: '-18px -16px 0', padding: '16px 16px 28px', minHeight: 'calc(100vh - 140px)', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 11.5, color: PAY.textMuted, marginBottom: 12, lineHeight: 1.4, fontFamily: FONT.body }}>
        Live estimate from daily attendance — a preview. Staff are actually paid via the register Salary.jsx saves (its Auto-Generate Payroll uses these same daily rates).
      </div>

      {fetchError && (
        <div style={{ background: PAY.redBg, border: `1px solid ${PAY.red}33`, borderRadius: PAY.radiusSm, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: PAY.red }}>
          ⚠️ Could not load attendance data: {fetchError}
        </div>
      )}

      {rules ? (
        <div style={{ background: PAY.amberBg, border: `1px solid ${PAY.amber}33`, borderRadius: PAY.radiusSm, padding: '10px 14px', marginBottom: 12, fontSize: 11.5, color: '#92400e' }}>
          <strong>₹{rules.late_rate}</strong>/late · <strong>₹{rules.absent_rate}</strong>/absent · <strong>₹{rules.early_out_rate}</strong>/early-out · <strong>₹{rules.half_day_rate || 0}</strong>/half day
        </div>
      ) : (
        <div style={{ background: PAY.redBg, border: `1px solid ${PAY.red}33`, borderRadius: PAY.radiusSm, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: PAY.red }}>
          No active deduction rule set. {isAdmin ? 'Set one up in Deduction Rules.' : 'Ask an admin to set one up.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: PAY.radiusSm, border: `1px solid ${PAY.cardBorder}`, background: PAY.card, fontFamily: FONT.body, fontSize: 13, color: PAY.textPrimary }} />
        {isAdmin && (
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: PAY.radiusSm, border: `1px solid ${PAY.cardBorder}`, background: PAY.card, fontFamily: FONT.body, fontSize: 13, color: PAY.textPrimary }}>
            <option value="all">All staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {isAdmin && (
          <button onClick={() => exportPayrollPreviewCSV(rows, month)}
            style={{ padding: '9px 14px', borderRadius: PAY.radiusSm, border: `1px solid ${PAY.cardBorder}`, background: PAY.card, fontFamily: FONT.body, fontSize: 12, fontWeight: 600, color: PAY.textSecondary, cursor: 'pointer' }}>
            ⬇ Export
          </button>
        )}
      </div>

      {/* Summary card — the payment-app style hero number */}
      <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius, padding: '20px 22px', marginBottom: 16, boxShadow: PAY.shadowRaised }}>
        <div style={{ fontSize: 11.5, color: PAY.textMuted, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Estimated net payable</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: PAY.textPrimary, fontFamily: FONT.display, marginTop: 4 }}>{fmtRupee(monthTotals.net)}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PAY.divider}` }}>
          <div>
            <div style={{ fontSize: 10.5, color: PAY.textMuted, fontWeight: 600 }}>Gross</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAY.textPrimary }}>{fmtRupee(monthTotals.gross)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: PAY.textMuted, fontWeight: 600 }}>Deductions</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAY.red }}>{fmtRupee(monthTotals.ded)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: PAY.textMuted, fontWeight: 600 }}>Staff</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: PAY.textPrimary }}>{rows.length}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: PAY.textMuted, textAlign: 'center', padding: 24, fontFamily: FONT.body }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius, padding: 32, textAlign: 'center', color: PAY.textMuted, fontFamily: FONT.body }}>
          No staff/attendance data for this month.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const isExpanded = expandedId === r.staff.id
            const isAdjusting = adjustingId === r.staff.id
            const flags = []
            if (r.d.lateDays > 0) flags.push({ label: `${r.d.lateDays} late`, color: PAY.amber, bg: PAY.amberBg })
            if (r.d.halfDay > 0) flags.push({ label: `${r.d.halfDay} half day`, color: '#0369A1', bg: '#EFF8FF' })
            if (r.d.absent > 0) flags.push({ label: `${r.d.absent} absent`, color: PAY.red, bg: PAY.redBg })
            if (r.d.earlyOut > 0) flags.push({ label: `${r.d.earlyOut} early out`, color: PAY.amber, bg: PAY.amberBg })
            return (
              <div key={r.staff.id} style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius, boxShadow: PAY.shadow, overflow: 'hidden' }}>
                {/* Card header — tap to expand, payment-app row: name left, net amount right */}
                <div onClick={() => setExpandedId(isExpanded ? null : r.staff.id)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: PAY.blueBg, color: PAY.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14, fontFamily: FONT.body,
                    }}>
                      {(r.staff.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: PAY.textPrimary, fontFamily: FONT.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.staff.name}</div>
                      <div style={{ fontSize: 11, color: PAY.textMuted, marginTop: 1 }}>{r.staff.designation || r.staff.department || ''}</div>
                      {flags.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                          {flags.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: f.color, background: f.bg, padding: '2px 7px', borderRadius: 999 }}>{f.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: PAY.textPrimary, fontFamily: FONT.display }}>{fmtRupee(r.net)}</div>
                      {r.totalDed > 0 && <div style={{ fontSize: 10.5, color: PAY.red, fontWeight: 600 }}>−{fmtRupee(r.totalDed)}</div>}
                    </div>
                    <span style={{ fontSize: 12, color: PAY.textMuted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <div style={{ padding: '4px 16px 16px', borderTop: `1px solid ${PAY.divider}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 12 }}>
                      {[
                        ['Present', r.d.present, PAY.green],
                        ['Late days', r.d.lateDays > 0 ? `${r.d.lateDays} (${r.d.lateMin}m)` : '—', PAY.amber],
                        ['Half day', r.d.halfDay || '—', '#0369A1'],
                        ['Absent', r.d.absent || '—', PAY.red],
                        ['Early out', r.d.earlyOut || '—', PAY.amber],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ background: PAY.bg, borderRadius: PAY.radiusSm, padding: '8px 12px' }}>
                          <div style={{ fontSize: 10, color: PAY.textMuted, fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 1 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      {[
                        ['Late deduction', r.lateDed],
                        ['Half day deduction', r.halfDayDed],
                        ['Absent deduction', r.absentDed],
                        ['Early-out deduction', r.earlyDed],
                        ['Admin adjustment', r.adminDed],
                        ['Advance repayment', r.advDed],
                      ].filter(([, v]) => v).map(([label, v]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}>
                          <span style={{ color: PAY.textSecondary }}>{label}</span>
                          <span style={{ color: PAY.red, fontWeight: 600 }}>−{fmtRupee(v)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12.5, borderTop: `1px solid ${PAY.divider}`, marginTop: 4 }}>
                        <span style={{ color: PAY.textSecondary, fontWeight: 600 }}>Gross</span>
                        <span style={{ color: PAY.textPrimary, fontWeight: 700 }}>{fmtRupee(r.gross)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                        <span style={{ color: PAY.textPrimary, fontWeight: 700 }}>Net payable</span>
                        <span style={{ color: PAY.green, fontWeight: 800 }}>{fmtRupee(r.net)}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div style={{ marginTop: 12 }}>
                        {!isAdjusting ? (
                          <button onClick={() => startAdjust(r)}
                            style={{ width: '100%', padding: '10px', borderRadius: PAY.radiusSm, border: `1px solid ${PAY.blue}33`, background: PAY.blueBg, color: PAY.blue, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT.body }}>
                            {r.adminDed ? '✏️ Edit adjustment' : '+ Add adjustment'}
                          </button>
                        ) : (
                          <div style={{ background: PAY.bg, borderRadius: PAY.radiusSm, padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <input type="number" value={adjustForm.amount}
                                onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder="Amount (₹)"
                                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${PAY.cardBorder}`, fontSize: 13, fontFamily: FONT.body }} />
                            </div>
                            <input type="text" value={adjustForm.note}
                              onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
                              placeholder="Reason (e.g. bonus, correction, fine)"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${PAY.cardBorder}`, fontSize: 13, fontFamily: FONT.body, boxSizing: 'border-box', marginBottom: 8 }} />
                            <div style={{ fontSize: 10.5, color: PAY.textMuted, marginBottom: 10 }}>
                              Writes directly to the payroll register for {month}. Positive deducts; negative adds a bonus.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => saveAdjust(r)} disabled={savingAdjust}
                                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: PAY.blue, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT.body }}>
                                {savingAdjust ? '⏳' : 'Save'}
                              </button>
                              <button onClick={() => setAdjustingId(null)}
                                style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${PAY.cardBorder}`, background: PAY.card, color: PAY.textSecondary, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT.body }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Deduction Rules (Daily) — ADMIN SETUP, writes salary_deduction_rules ──
// The only write path in this file: admins configure the per-day rates that
// both this Payroll preview and Salary.jsx's auto-payroll read from
// (salary_deduction_rules, is_active flag). Saving deactivates the previous
// rule and inserts a new one, preserving full history.

function DeductionRulesSetup({ currentAdminId, showToast }) {
  const [active, setActive] = useState(null)
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({
    late_rate: 10, absent_rate: 300, early_out_rate: 150, half_day_rate: 150,
    perf_elite_bonus: 0, perf_outstanding_bonus: 0, perf_good_bonus: 0, perf_probation_penalty: 0,
    effective_from: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const { data: act } = await supabase.from('salary_deduction_rules').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const { data: hist } = await supabase.from('salary_deduction_rules').select('*').order('created_at', { ascending: false }).limit(10)
    setActive(act || null)
    setHistory(hist || [])
    if (act) {
      setForm({
        late_rate: act.late_rate ?? 10, absent_rate: act.absent_rate ?? 300, early_out_rate: act.early_out_rate ?? 150, half_day_rate: act.half_day_rate ?? 150,
        perf_elite_bonus: act.perf_elite_bonus || 0, perf_outstanding_bonus: act.perf_outstanding_bonus || 0,
        perf_good_bonus: act.perf_good_bonus || 0, perf_probation_penalty: act.perf_probation_penalty || 0,
        effective_from: new Date().toISOString().slice(0, 10),
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (active?.id) {
        await supabase.from('salary_deduction_rules').update({ is_active: false }).eq('id', active.id)
      }
      const { error } = await supabase.from('salary_deduction_rules').insert([{
        late_rate: Number(form.late_rate) || 0,
        absent_rate: Number(form.absent_rate) || 0,
        early_out_rate: Number(form.early_out_rate) || 0,
        half_day_rate: Number(form.half_day_rate) || 0,
        perf_elite_bonus: Number(form.perf_elite_bonus) || 0,
        perf_outstanding_bonus: Number(form.perf_outstanding_bonus) || 0,
        perf_good_bonus: Number(form.perf_good_bonus) || 0,
        perf_probation_penalty: Number(form.perf_probation_penalty) || 0,
        effective_from: form.effective_from,
        is_active: true,
        created_by: currentAdminId || null,
      }])
      if (error) throw error
      showToast?.('✅ Daily deduction rules saved and activated', 'ok')
      fetchRules()
    } catch (err) {
      showToast?.('Failed to save: ' + err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, desc, color, unit) => (
    <div style={{ background: `${color}10`, borderRadius: 10, padding: 14, border: `1.5px solid ${color}33` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: COLOR.slate, marginBottom: 8 }}>{desc}</div>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color }}>₹</span>
        <input
          type="number" min="0" step="1"
          value={form[key]}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          style={{ ...S.input, paddingLeft: 26, fontWeight: 700, fontSize: 15, color, border: `1.5px solid ${color}44`, width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ fontSize: 10.5, color, marginTop: 5, fontWeight: 600 }}>{unit}</div>
    </div>
  )

  if (loading) return <div style={S.card}><p style={{ color: COLOR.slate, textAlign: 'center', padding: 24 }}>Loading…</p></div>

  return (
    <div>
      <div style={S.card}>
        <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
          Set the ₹ amount deducted <strong>per day</strong> from daily attendance — late, absent, early-out, and half-day are each a flat per-day rate, regardless of how many minutes late. These rates feed the Payroll preview here and Salary.jsx's Auto-Generate Payroll — one rule, used everywhere.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {field('late_rate', '⏰ Late Deduction', 'Flat amount per day staff checks in late (any minutes late = one late day)', COLOR.warn, '₹ / day')}
          {field('absent_rate', '🚫 Absent Deduction', 'Per full day marked Absent', COLOR.danger, '₹ / day')}
          {field('early_out_rate', '🚪 Early-Out Deduction', 'Per day of early check-out', '#7c3aed', '₹ / day')}
          {field('half_day_rate', '🌓 Half Day Deduction', 'Per day auto-marked Half Day (very late check-in or very early checkout)', '#0369a1', '₹ / day')}
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.ink, margin: '18px 0 10px' }}>Performance adjustments (monthly, applied alongside daily deductions)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {field('perf_elite_bonus', '💎 Elite Bonus', 'Monthly score level = Elite', '#7c3aed', '₹ / month')}
          {field('perf_outstanding_bonus', '🥇 Outstanding Bonus', 'Monthly score level = Outstanding', '#b45309', '₹ / month')}
          {field('perf_good_bonus', '🥉 Good Bonus', 'Monthly score level = Good', '#0891b2', '₹ / month')}
          {field('perf_probation_penalty', '🔰 Probation Penalty', 'Monthly score level = Probation', COLOR.danger, '₹ / month')}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: COLOR.ink, marginBottom: 6 }}>Effective From</label>
          <input type="date" value={form.effective_from} onChange={e => setForm(prev => ({ ...prev, effective_from: e.target.value }))} style={{ ...S.input, maxWidth: 220 }} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: RADIUS.md, border: 'none', background: saving ? COLOR.slate : COLOR.ink, color: COLOR.cream, fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT.body }}
        >
          {saving ? '⏳ Saving...' : '💾 Save & Activate New Rates'}
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, color: COLOR.ink, borderBottom: `1px solid ${COLOR.rule}`, fontSize: 13, fontFamily: FONT.display }}>
            📅 Rate History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Effective From', 'Late/day', 'Absent/day', 'Early Out/day', 'Half Day/day', 'Elite', 'Outstanding', 'Good', 'Probation', 'Status'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: r.is_active ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{r.effective_from || fmtDate(r.created_at)}</td>
                    <td style={{ ...S.td, color: COLOR.warn, fontWeight: 700 }}>₹{r.late_rate}</td>
                    <td style={{ ...S.td, color: COLOR.danger, fontWeight: 700 }}>₹{r.absent_rate}</td>
                    <td style={{ ...S.td, color: '#7c3aed', fontWeight: 700 }}>₹{r.early_out_rate}</td>
                    <td style={{ ...S.td, color: '#0369a1', fontWeight: 700 }}>₹{r.half_day_rate || 0}</td>
                    <td style={S.td}>+₹{r.perf_elite_bonus || 0}</td>
                    <td style={S.td}>+₹{r.perf_outstanding_bonus || 0}</td>
                    <td style={S.td}>+₹{r.perf_good_bonus || 0}</td>
                    <td style={S.td}>−₹{r.perf_probation_penalty || 0}</td>
                    <td style={S.td}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: r.is_active ? COLOR.okBg : '#f1f5f9', color: r.is_active ? COLOR.sageDeep : COLOR.slate }}>
                        {r.is_active ? '✅ Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Role Permissions — ADMIN SETUP, writes staff_module_permissions ──────
// Lets an admin grant individual staff access to specific tabs in this
// module beyond their default (self-service) access, without making them a
// full admin. Stored in a new, dedicated table so it never touches
// portal_users/staff_profiles roles — purely additive, per-module grants.
//
// Granted permission keys are checked via hasPerm() below; a plain isAdmin
// staff member already has every permission implicitly.

// 'full_admin' is a single grant that makes hasPerm() return true for every
// key below, without an admin having to tick each box individually — see
// hasPerm() in useModulePermissions(). It's listed first and rendered with
// its own emphasis in RolePermissionsSetup below.
const ASSIGNABLE_PERMISSIONS = [
  { key: 'full_admin',        label: 'Full Admin (this module)',    desc: 'Grants every permission below at once — same access as an app-wide admin, but scoped to Face Attendance only.' },
  { key: 'view_payroll',      label: 'View Payroll (all staff)',   desc: 'See the daily-attendance payroll estimate for every staff member, not just their own.' },
  { key: 'view_fines',        label: 'View Late Fines (all staff)', desc: 'See late/absent fine calculations across all staff.' },
  { key: 'view_cashbook',     label: 'View Cash Book',              desc: 'Read-only access to the accounts cash book.' },
  { key: 'view_reports',      label: 'View Attendance Reports',     desc: 'Access the admin attendance reports view.' },
  { key: 'approve_regularization', label: 'Approve Attendance Corrections', desc: 'Approve/reject staff regularization requests.' },
  { key: 'manage_deduction_rules',  label: 'Manage Deduction Rules', desc: 'Set the daily late/absent/early-out deduction rates.' },
  { key: 'manage_advances',   label: 'Manage Advances (all staff)', desc: 'Issue/edit salary advances for any staff member.' },
]

function useModulePermissions(staffId, isAdmin) {
  const [perms, setPerms] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    if (isAdmin || !staffId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff_module_permissions')
      .select('permission_key')
      .eq('staff_id', staffId)
      .eq('module', 'face_attendance')
    setPerms(new Set((data || []).map(r => r.permission_key)))
    setLoading(false)
  }, [staffId, isAdmin])

  useEffect(() => { fetch_() }, [fetch_])

  const hasPerm = useCallback((key) => isAdmin || perms.has('full_admin') || perms.has(key), [isAdmin, perms])
  return { hasPerm, loading, refetch: fetch_ }
}

// ─── Attendance Helpers — no-phone staff assistance ────────────────────────
// Lets an admin assign a "helper" staff member who can take attendance on
// behalf of a specific colleague who doesn't have a phone. The helper uses
// their own device; the assisted person's face is what actually gets
// verified (server_checkin enforces this — see p_actor_staff_id).
function AttendanceHelpersSetup({ staffList, currentAdminId, showToast }) {
  const [helperId, setHelperId] = useState('')
  const [assistedId, setAssistedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_attendance_helpers')
      .select('id, helper_staff_id, assisted_staff_id, active, assigned_at')
      .eq('active', true)
      .order('assigned_at', { ascending: false })
    if (!error) setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  const nameById = useMemo(() => {
    const m = {}
    staffList.forEach(s => { m[s.id] = s.name })
    return m
  }, [staffList])

  const handleAssign = async () => {
    if (!helperId || !assistedId) return
    if (helperId === assistedId) { showToast?.('Helper and assisted staff must be different people', 'err'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('staff_attendance_helpers').insert({
        helper_staff_id: helperId,
        assisted_staff_id: assistedId,
        active: true,
        assigned_by: currentAdminId || null,
      })
      if (error) throw error
      showToast?.('✅ Helper assigned', 'ok')
      setHelperId(''); setAssistedId('')
      fetchRows()
    } catch (err) {
      showToast?.(
        err.message?.includes('duplicate') || err.code === '23505'
          ? 'This helper is already assigned to this person'
          : 'Failed to assign: ' + err.message,
        'err'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id) => {
    const { error } = await supabase.from('staff_attendance_helpers').update({ active: false }).eq('id', id)
    if (error) { showToast?.('Failed to remove: ' + error.message, 'err'); return }
    showToast?.('Helper assignment removed', 'ok')
    fetchRows()
  }

  return (
    <div>
      <div style={S.card}>
        <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
          For staff without a phone: assign a colleague as their "helper." The helper can then take attendance for them from the helper's own device — the assisted person's face is still verified, and GPS uses the helper's phone location.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Helper (has a phone)</label>
            <select value={helperId} onChange={e => setHelperId(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}>
              <option value="">Select helper…</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: COLOR.slate, display: 'block', marginBottom: 4 }}>Assisted staff (no phone)</label>
            <select value={assistedId} onChange={e => setAssistedId(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}>
              <option value="">Select assisted staff…</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleAssign} disabled={saving || !helperId || !assistedId} style={ledger.btnPrimary(saving)}>
          {saving ? 'Assigning…' : 'Assign helper'}
        </button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.slate, letterSpacing: '0.03em', margin: '20px 0 10px 2px' }}>CURRENT ASSIGNMENTS</div>
      {loading ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 20 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: COLOR.slate, textAlign: 'center', padding: 20, fontSize: 13 }}>No helper assignments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ ...S.card, marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
              <div style={{ fontSize: 13 }}>
                <strong>{nameById[r.helper_staff_id] || '—'}</strong>
                <span style={{ color: COLOR.slate }}> helps </span>
                <strong>{nameById[r.assisted_staff_id] || '—'}</strong>
              </div>
              <button onClick={() => handleRemove(r.id)} style={{ background: 'none', border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.sm, padding: '5px 10px', fontSize: 11.5, color: COLOR.danger, cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RolePermissionsSetup({ staffList, currentAdminId, showToast }) {
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [grants, setGrants] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [allGrants, setAllGrants] = useState([]) // for the summary list below

  const fetchAllGrants = useCallback(async () => {
    const { data } = await supabase
      .from('staff_module_permissions')
      .select('staff_id, permission_key, granted_at')
      .eq('module', 'face_attendance')
    setAllGrants(data || [])
  }, [])

  useEffect(() => { fetchAllGrants() }, [fetchAllGrants])

  const fetchGrantsFor = useCallback(async (sid) => {
    if (!sid) { setGrants(new Set()); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff_module_permissions')
      .select('permission_key')
      .eq('staff_id', sid)
      .eq('module', 'face_attendance')
    setGrants(new Set((data || []).map(r => r.permission_key)))
    setLoading(false)
  }, [])

  useEffect(() => { fetchGrantsFor(selectedStaffId) }, [selectedStaffId, fetchGrantsFor])

  const toggle = (key) => {
    setGrants(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedStaffId) return
    setSaving(true)
    try {
      // Replace this staff member's grants wholesale: delete then re-insert
      // the checked set, so unticking a box actually revokes it.
      const { error: delErr } = await supabase
        .from('staff_module_permissions')
        .delete()
        .eq('staff_id', selectedStaffId)
        .eq('module', 'face_attendance')
      if (delErr) throw delErr

      if (grants.size > 0) {
        const rows = [...grants].map(key => ({
          staff_id: selectedStaffId,
          module: 'face_attendance',
          permission_key: key,
          granted_by: currentAdminId || null,
          granted_at: new Date().toISOString(),
        }))
        const { error: insErr } = await supabase.from('staff_module_permissions').insert(rows)
        if (insErr) throw insErr
      }
      showToast?.('✅ Permissions updated', 'ok')
      fetchAllGrants()
    } catch (err) {
      showToast?.('Failed to save permissions: ' + err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  const filteredStaff = staffList.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))

  const grantCountByStaff = useMemo(() => {
    const m = {}
    allGrants.forEach(g => { m[g.staff_id] = (m[g.staff_id] || 0) + 1 })
    return m
  }, [allGrants])

  return (
    <div>
      <div style={S.card}>
        <p style={{ fontSize: 12, color: COLOR.slate, margin: '0 0 14px' }}>
          Grant a staff member access to specific admin-level views in this module without making them a full admin. Unchecked boxes revoke access.
        </p>

        <input
          style={{ ...S.inputFull, marginBottom: 12 }}
          placeholder="Search staff by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          value={selectedStaffId}
          onChange={e => setSelectedStaffId(e.target.value)}
          style={{ ...S.input, width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
        >
          <option value="">Select a staff member…</option>
          {filteredStaff.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{grantCountByStaff[s.id] ? ` (${grantCountByStaff[s.id]} permission${grantCountByStaff[s.id] !== 1 ? 's' : ''})` : ''}
            </option>
          ))}
        </select>

        {selectedStaffId && (
          loading ? (
            <p style={{ color: COLOR.slate, textAlign: 'center', padding: 20 }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {ASSIGNABLE_PERMISSIONS.map(p => {
                  const checked = grants.has(p.key)
                  return (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        borderRadius: RADIUS.md, border: `1.5px solid ${checked ? COLOR.brass : COLOR.rule}`,
                        background: checked ? `${COLOR.brass}12` : 'transparent', cursor: 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(p.key)} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.ink, fontFamily: FONT.body }}>{p.label}</div>
                        <div style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 1 }}>{p.desc}</div>
                      </div>
                    </label>
                  )
                })}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', padding: 13, borderRadius: RADIUS.md, border: 'none', background: saving ? COLOR.slate : COLOR.ink, color: COLOR.cream, fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT.body }}
              >
                {saving ? '⏳ Saving...' : '💾 Save Permissions'}
              </button>
            </>
          )
        )}
      </div>

      {allGrants.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, color: COLOR.ink, borderBottom: `1px solid ${COLOR.rule}`, fontSize: 13, fontFamily: FONT.display }}>
            🔑 Current Grants
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Staff', 'Permission', 'Granted'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {allGrants.map((g, i) => {
                  const st = staffList.find(s => String(s.id) === String(g.staff_id))
                  const perm = ASSIGNABLE_PERMISSIONS.find(p => p.key === g.permission_key)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{st?.name || `#${g.staff_id}`}</td>
                      <td style={S.td}>{perm?.label || g.permission_key}</td>
                      <td style={{ ...S.td, color: COLOR.slate }}>{fmtDate(g.granted_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function NoAccessCard() {
  return (
    <div style={S.card}>
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: COLOR.ink, marginBottom: 4, fontFamily: FONT.display }}>Access restricted</div>
        <p style={{ fontSize: 12.5, color: COLOR.slate, margin: 0 }}>You don't have permission to view this. Ask an admin to grant it under Role Permissions.</p>
      </div>
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

// ─── Vault-style home tile — deep navy panel, gold-tinted icon well ────────
// Used only on the Home tab's primary tile grid; every other screen keeps
// the existing parchment HomeTile/QuickActionTile untouched.
function VaultTile({ icon, label, badge, accent = false, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: VAULT.panel, border: `1px solid ${VAULT.panelBorder}`, borderRadius: RADIUS.lg,
      padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      cursor: 'pointer', position: 'relative', fontFamily: FONT.body,
      transition: 'transform 0.12s ease, border-color 0.12s ease',
    }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 8, right: 10, background: COLOR.danger, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: FONT.body }}>
          {badge}
        </span>
      )}
      <span style={{
        width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, background: accent ? COLOR.brass : 'rgba(201,162,75,0.12)',
      }}>{icon}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: VAULT.tileLabel, textAlign: 'center', lineHeight: 1.25, fontFamily: FONT.body, letterSpacing: '0.01em' }}>{label}</span>
    </button>
  )
}

// PayTile — same shape as VaultTile, restyled for the white payment-app
// Home screen. VaultTile itself is left untouched since other screens
// not yet migrated still use it.
function PayTile({ icon, label, badge, accent = false, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius,
      padding: '18px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
      cursor: 'pointer', position: 'relative', fontFamily: FONT.body,
      boxShadow: accent ? PAY.shadowRaised : PAY.shadow,
      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 8, right: 10, background: PAY.red, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: FONT.body }}>
          {badge}
        </span>
      )}
      <span style={{
        width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, background: accent ? PAY.blue : PAY.blueBg,
      }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: PAY.textSecondary, textAlign: 'center', lineHeight: 1.25, fontFamily: FONT.body, letterSpacing: '0.01em' }}>{label}</span>
    </button>
  )
}

// Smaller, lighter secondary shortcut tile.
function QuickActionTile({ icon, label, onClick, disabled = false }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT.body,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '4px 2px',
      opacity: disabled ? 0.45 : 1,
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
      background: '#0a1a30', borderTop: '1px solid rgba(201,162,75,0.2)',
      display: 'flex', justifyContent: 'space-around', padding: '9px 0 11px',
      boxShadow: '0 -4px 20px -8px rgba(0,0,0,.4)',
      boxSizing: 'border-box',
    }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onNavigate(it.key)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.body,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: active === it.key ? COLOR.brass : '#5d6b82', position: 'relative', padding: '2px 10px',
        }}>
          {it.badge > 0 && (
            <span style={{ position: 'absolute', top: -2, right: 4, width: 8, height: 8, borderRadius: '50%', background: COLOR.danger, border: '1.5px solid #0a1a30' }} />
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

export default function FaceAttendance({ currentUser, isAdmin, staff = [], loggedInStaff = null, onNavigate = null, onLogout = null, onStaffChange = null }) {
  useEffect(() => { injectLedgerGlobalStyles() }, [])
  const { show: showToast, el: toastEl } = useToast()
  const [tab, setTab] = useState(isAdmin ? 'dashboard' : 'home')
  const [menuOpen, setMenuOpen] = useState(false) // hamburger dropdown, top-right of the shared header
  const [faceRows, setFaceRows] = useState([]) // staff_face_descriptors, latest per staff
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enrollTarget, setEnrollTarget] = useState(null)
  const [settingsTab, setSettingsTab] = useState(null) // tab key whose Advanced Settings sheet is open, or null

  // Lightweight punch-state signal for the Home-screen "Punch In/Punch Out"
  // quick action tile. Deliberately NOT the full SmartPunchButton logic
  // (that needs live GPS + active-tracking state, meaningful only once the
  // check-in screen is mounted) — this only answers "does the logged-in
  // staff member currently have an open (punched-in, not punched-out)
  // shift today", which is enough to label the tile correctly without
  // running background GPS on the Home screen.
  // Three real states, not two: 'none' (never checked in today),
  // 'open' (checked in, not yet out), 'done' (checked in AND out already).
  // The old boolean hasOpenPunch could only tell "open" from "everything
  // else," so a completed day (checked in, worked the shift, checked
  // out) looked identical to "never checked in" — showing the same
  // "Not checked in yet" / "Check in" prompt for someone who'd already
  // finished for the day.
  const [punchState, setPunchState] = useState('none')
  const hasOpenPunch = punchState === 'open' // kept for existing call sites (quick-action disabled states, etc.)
  const fetchPunchState = useCallback(async () => {
    if (!loggedInStaff?.id) { setPunchState('none'); return }
    // IST date, matching server_checkin's own date computation — using
    // toISOString() here (UTC) could pick the wrong calendar day near
    // the midnight boundary, since IST is UTC+5:30.
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const { data, error } = await supabase
      .from('staff_geo_attendance')
      .select('id, check_out_time')
      .eq('staff_id', loggedInStaff.id)
      .eq('date', todayIso)
      .eq('session_dead', false)
    if (error) return
    const rows = data || []
    if (rows.length === 0) setPunchState('none')
    else if (rows.some(r => !r.check_out_time)) setPunchState('open')
    else setPunchState('done')
  }, [loggedInStaff?.id])

  useEffect(() => { fetchPunchState() }, [fetchPunchState])
  // Refresh whenever we return to Home — covers the case where the staff
  // member just punched in/out on the check-in screen and tapped back.
  useEffect(() => { if (tab === 'home') fetchPunchState() }, [tab, fetchPunchState])

  const staffId = loggedInStaff?.id || null
  const { hasPerm } = useModulePermissions(staffId, isAdmin)

  const fetchFaceRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('staff_id, status, enrolled_at, reviewed_by, reviewed_at')
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
  const faceRowFor = (sid) => faceRows.find(r => r.staff_id === sid) || null
  const staffNameById = (sid) => staff.find(s => s.id === sid)?.name || null

  // Soft-delete/reactivate — sets staff_profiles.status only. Never
  // deletes the row or any related attendance/payroll history, per
  // instruction: a deactivate/archive, not a permanent delete.
  const deactivateStaff = async (s) => {
    if (!window.confirm(`Deactivate ${s.name}? They'll be hidden from active staff lists (attendance, payroll, etc.) but all their existing records are kept, and this can be undone from "Deactivated staff" below.`)) return
    const { error } = await supabase.from('staff_profiles').update({ status: 'Inactive' }).eq('id', s.id)
    if (error) { showToast?.('Could not deactivate: ' + error.message, 'err'); return }
    showToast?.(`${s.name} deactivated`, 'ok')
    if (onStaffChange) await onStaffChange()
  }
  const reactivateStaff = async (s) => {
    const { error } = await supabase.from('staff_profiles').update({ status: 'Active' }).eq('id', s.id)
    if (error) { showToast?.('Could not reactivate: ' + error.message, 'err'); return }
    showToast?.(`${s.name} reactivated`, 'ok')
    if (onStaffChange) await onStaffChange()
  }

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
    ...(isAdmin ? [{ key: 'dashboard', icon: '📊', label: 'Dashboard' }] : []),
    ...(isAdmin ? [{ key: 'home', icon: '🏠', label: 'Home' }] : []),
    ...(loggedInStaff ? [{ key: 'checkin', icon: '✅', label: 'Take attendance' }] : []),
    { key: 'attendancesummary', icon: '📅', label: 'Attendance' },
    { key: 'timecard', icon: '🕐', label: 'Time card' },
    { key: 'advances', icon: '💵', label: 'Advances' },
    { key: 'fines',    icon: '⏰', label: 'Late fines' },
    { key: 'payroll',  icon: '💰', label: 'Payroll' }, // admins get the full Salary.jsx suite here (register, advances, history, reports, rules); non-admin staff see their own live preview only
    { key: 'regularization', icon: '🛠️', label: 'Correct attendance' },
    { key: 'reports',  icon: '📊', label: 'Reports' },
    { key: 'broadcast', icon: '📣', label: 'Broadcast messages' },
    { key: 'notifications', icon: '🔔', label: 'Notifications' },
    ...(!isAdmin && hasPerm('view_cashbook') ? [{ key: 'cashbook', icon: '📒', label: 'Cash book' }] : []),
    ...(isAdmin ? [
      { key: 'coverage',  icon: '👥', label: 'Staff coverage' },
      { key: 'livemonitor', icon: '📍', label: 'Live geo monitor' },
      { key: 'geofraud',  icon: '🚨', label: 'Geo fraud alerts' },
      { key: 'geoshifts', icon: '⏰', label: 'Shift configuration' },
      { key: 'geocampus', icon: '🗺️', label: 'Campus zones' },
      { key: 'georeport', icon: '📊', label: 'Geo attendance report' },
      { key: 'approvals', icon: '📋', label: 'Approvals', badge: counts.pending },
      { key: 'cashbook',  icon: '📒', label: 'Cash book' },
      { key: 'rolepermissions', icon: '🔑', label: 'Role Permissions' },
      { key: 'attendancehelpers', icon: '🤝', label: 'Attendance Helpers' },
      { key: 'controlcenter', icon: '🎛️', label: 'Control Center' },
    ] : []),
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  const pageTitles = {
    dashboard: 'Dashboard', checkin: 'Take attendance', attendancesummary: 'Attendance', timecard: 'Time card', advances: 'Advances',
    fines: 'Late fines', payroll: 'Payroll', regularization: 'Correct attendance', reports: 'Reports', broadcast: 'Broadcast messages', notifications: 'Notifications',
    coverage: 'Staff coverage', livemonitor: 'Live geo monitor', geofraud: 'Geo fraud alerts', geoshifts: 'Shift configuration', geocampus: 'Campus zones', georeport: 'Geo attendance report', approvals: 'Pending approvals', cashbook: 'Cash book', deductionrules: 'Deduction Rules (Daily)', rolepermissions: 'Role Permissions', attendancehelpers: 'Attendance Helpers', controlcenter: 'Admin Control Center', settings: 'Settings',
  }

  // Quick actions row, below the main tile grid — role-aware, matching
  // PagarBook's smaller secondary shortcut row.
  // Admins normally only see "Enroll face" here — but an admin/co-admin
  // who is ALSO linked to a staff profile (loggedInStaff set) is staff
  // too and needs to punch in/out like anyone else, so they get the same
  // dynamic Punch In/Punch Out tile alongside their admin quick action.
  const quickActions = isAdmin
    ? [
        { key: 'enroll', icon: '🧑‍💼', label: 'Enroll face', onClick: () => setTab('coverage') },
        ...(loggedInStaff ? [
          { key: 'qa-punchin',  icon: '✅', label: 'Punch In',  disabled: punchState !== 'none', onClick: () => setTab('checkin') },
          { key: 'qa-punchout', icon: '⏹️', label: 'Punch Out', disabled: punchState !== 'open', onClick: () => setTab('checkin') },
        ] : []),
      ]
    : [
        { key: 'qa-punchin',  icon: '✅', label: 'Punch In',  disabled: punchState !== 'none', onClick: () => loggedInStaff && setTab('checkin') },
        { key: 'qa-punchout', icon: '⏹️', label: 'Punch Out', disabled: punchState !== 'open', onClick: () => loggedInStaff && setTab('checkin') },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            {/* Hamburger — opens a dropdown listing every tab that used to
                live in the Home tile grid, per instruction to collapse
                that grid into a top-right menu instead. */}
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: `1px solid ${COLOR.brass}55`,
              background: 'rgba(255,255,255,0.06)', color: COLOR.cream, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18, cursor: 'pointer',
            }}>
              ☰
            </button>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(155deg, ${COLOR.brass}, ${COLOR.brassDeep})`,
              color: COLOR.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, fontFamily: FONT.body,
              boxShadow: SHADOW.seal, border: `1px solid ${COLOR.brass}`,
            }}>
              {initials}
            </div>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                {/* BUGFIX: this used to be position:absolute inside the
                    header, which clips overflow to render its rounded
                    card shape — so the dropdown was cut off/overlapping
                    content beneath it instead of floating cleanly above
                    the page. position:fixed with an explicit viewport
                    offset escapes that clipping entirely. */}
                <div style={{
                  position: 'fixed', top: 64, right: 16, zIndex: 999, width: 250,
                  background: PAY.card, borderRadius: PAY.radius, boxShadow: PAY.shadowRaised,
                  border: `1px solid ${PAY.cardBorder}`, padding: 8, maxHeight: '70vh', overflowY: 'auto',
                }}>
                  {primaryTiles.map(t => (
                    <button key={t.key} onClick={() => { setTab(t.key); setMenuOpen(false) }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: tab === t.key ? PAY.blueBg : 'none', border: 'none', borderRadius: PAY.radiusSm,
                      cursor: 'pointer', textAlign: 'left', fontFamily: FONT.body,
                    }}>
                      <span style={{ fontSize: 17 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tab === t.key ? PAY.blue : PAY.textPrimary, flex: 1 }}>{t.label}</span>
                      {t.badge > 0 && (
                        <span style={{ background: PAY.red, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{t.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {tab === 'home' ? (
        <div style={{
          background: PAY.bg, margin: '-18px -16px 0', padding: '18px 16px 28px',
          minHeight: 'calc(100vh - 140px)', boxSizing: 'border-box',
        }}>
          {/* Check-in status card — white, blue/green accent, soft shadow */}
          {loggedInStaff && (
            <div style={{
              background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radius,
              padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 18, boxShadow: PAY.shadowRaised,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: punchState === 'open' ? PAY.green : punchState === 'done' ? PAY.amber : PAY.textMuted,
                  boxShadow: punchState === 'open' ? `0 0 8px ${PAY.green}66` : 'none',
                }} />
                <div>
                  <div style={{ color: PAY.textPrimary, fontSize: 14, fontWeight: 700, fontFamily: FONT.body }}>
                    {punchState === 'open' ? 'Checked in' : punchState === 'done' ? 'Done for today' : 'Not checked in yet'}
                  </div>
                  <div style={{ color: PAY.textMuted, fontSize: 11.5, marginTop: 2, fontFamily: FONT.body }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => loggedInStaff && setTab('checkin')}
                disabled={punchState === 'done'}
                style={{
                  background: punchState === 'done' ? PAY.divider : punchState === 'open' ? PAY.red : PAY.blue,
                  color: punchState === 'done' ? PAY.textMuted : '#fff',
                  fontSize: 12, fontWeight: 700,
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  cursor: punchState === 'done' ? 'default' : 'pointer', fontFamily: FONT.body,
                  boxShadow: punchState === 'done' ? 'none' : '0 2px 8px rgba(37,99,235,0.25)',
                }}
              >
                {punchState === 'open' ? 'Check out' : punchState === 'done' ? 'Completed' : 'Check in'}
              </button>
            </div>
          )}

          {isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radiusSm, textAlign: 'center', padding: '14px 8px', boxShadow: PAY.shadow }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: PAY.green, fontFamily: FONT.display }}>{counts.approved}</div>
                <div style={{ fontSize: 10, color: PAY.textMuted, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Enrolled</div>
              </div>
              <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radiusSm, textAlign: 'center', padding: '14px 8px', boxShadow: PAY.shadow }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: PAY.amber, fontFamily: FONT.display }}>{counts.pending}</div>
                <div style={{ fontSize: 10, color: PAY.textMuted, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Pending</div>
              </div>
              <div style={{ background: PAY.card, border: `1px solid ${PAY.cardBorder}`, borderRadius: PAY.radiusSm, textAlign: 'center', padding: '14px 8px', boxShadow: PAY.shadow }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: PAY.red, fontFamily: FONT.display }}>{counts.none}</div>
                <div style={{ fontSize: 10, color: PAY.textMuted, fontWeight: 700, marginTop: 2, letterSpacing: '0.02em' }}>Not enrolled</div>
              </div>
            </div>
          )}

          {/* Tile grid moved into the hamburger menu (top-right) — Home now
              stays to the status card, quick actions, and the diagram/scan
              frame below. */}
          <div style={{ fontSize: 11, fontWeight: 700, color: PAY.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '4px 0 12px 2px', fontFamily: FONT.body }}>Quick actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quickActions.length},1fr)`, gap: 10, marginBottom: 26 }}>
            {quickActions.map(q => (
              <button key={q.key} onClick={q.disabled ? undefined : q.onClick} disabled={q.disabled} style={{
                background: 'none', border: 'none', cursor: q.disabled ? 'not-allowed' : 'pointer', fontFamily: FONT.body,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '4px 2px',
                opacity: q.disabled ? 0.4 : 1,
              }}>
                <span style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: PAY.card, border: `1px solid ${PAY.cardBorder}`, boxShadow: PAY.shadow,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{q.icon}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: PAY.textSecondary, textAlign: 'center', lineHeight: 1.2, fontFamily: FONT.body }}>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Check-in / check-out flow diagram — purely illustrative. */}
          <CheckInFlowDiagram />

          {/* Face-scan viewfinder — now a real shortcut: tapping it opens
              the same Check-In/Check-Out tab (GeoAttendance) that Quick
              Actions uses, so it triggers a real face scan + GPS punch,
              not just a decorative graphic. */}
          <FaceScanFrame punchState={punchState} onTap={() => loggedInStaff && setTab('checkin')} />
        </div>
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
              <>
                <GeoAttendance currentStaff={loggedInStaff} isAdmin={false} allStaff={[loggedInStaff]} initialTab="checkin" onCheckInSuccess={fetchPunchState} onCheckOutSuccess={fetchPunchState} />
                {(() => {
                  const row = faceRowFor(loggedInStaff.id)
                  if (!row) return null
                  const reviewerName = row.reviewed_by ? staffNameById(row.reviewed_by) : null
                  return (
                    <div style={{ ...S.card, marginTop: 12, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLOR.slate, letterSpacing: '0.03em', marginBottom: 4 }}>YOUR FACE ENROLLMENT</div>
                      <div style={{ fontSize: 12.5, color: COLOR.ink2 }}>
                        Enrolled {fmtDate(row.enrolled_at)}
                        {row.reviewed_at && ` · Approved ${fmtDate(row.reviewed_at)}${reviewerName ? ` by ${reviewerName}` : ''}`}
                      </div>
                    </div>
                  )
                })()}
              </>
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
                  {statusFor(loggedInStaff.id) === 'pending' && faceRowFor(loggedInStaff.id) && (
                    <p style={{ fontSize: 11.5, color: COLOR.slate, margin: '-8px 0 16px' }}>
                      Submitted {fmtDate(faceRowFor(loggedInStaff.id).enrolled_at)}
                    </p>
                  )}
                  {statusFor(loggedInStaff.id) !== 'pending' && (
                    <button onClick={() => setEnrollTarget(loggedInStaff)} style={ledger.btnPrimary()}>
                      Enroll my face
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {tab === 'dashboard' && isAdmin && <DashboardView staffList={staff} />}
          {tab === 'attendancesummary' && <AttendanceSummaryView isAdmin={isAdmin} staffId={staffId} staffList={filteredStaff} showToast={showToast} onNavigate={onNavigate} currentUsername={currentUser?.username} />}
          {tab === 'timecard' && <TimeCard staffId={staffId} isAdmin={isAdmin} staffList={staff} />}
          {tab === 'advances' && <AdvancesView staffId={staffId} isAdmin={isAdmin || hasPerm('manage_advances')} staffList={staff} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />}
          {tab === 'fines'    && <LateFinesView staffId={staffId} isAdmin={isAdmin || hasPerm('view_fines')} staffList={staff} />}
          {tab === 'payroll' && isAdmin && <Salary />}
          {tab === 'payroll' && !isAdmin && <PayrollView staffId={staffId} isAdmin={isAdmin || hasPerm('view_payroll')} staffList={staff} />}
          {tab === 'regularization' && <RegularizationView staffId={staffId} isAdmin={isAdmin} showToast={showToast} currentUsername={currentUser?.username} />}
          {tab === 'reports'  && (hasPerm('view_reports') ? <ReportsView isAdmin={isAdmin} staffList={staff} /> : <NoAccessCard />)}
          {tab === 'broadcast' && <BroadcastView isAdmin={isAdmin} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />}
          {tab === 'notifications' && <NotificationsView staffId={staffId} isAdmin={isAdmin} />}
          {tab === 'cashbook' && (isAdmin || hasPerm('view_cashbook')) && <CashBookView />}
          {tab === 'rolepermissions' && isAdmin && (
            <RolePermissionsSetup staffList={staff} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />
          )}
          {tab === 'attendancehelpers' && isAdmin && (
            <AttendanceHelpersSetup staffList={staff} currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />
          )}
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
                          {/* Soft-delete: sets staff_profiles.status to
                              'Inactive' rather than deleting the row —
                              filteredStaff already excludes Inactive staff
                              everywhere, so this immediately hides them
                              from active lists while keeping all their
                              historical attendance/payroll data intact and
                              reversible. */}
                          <button onClick={() => deactivateStaff(s)} style={{ padding: '7px 13px', borderRadius: RADIUS.sm, border: `1px solid ${COLOR.danger}55`, background: 'none', color: COLOR.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>
                            Deactivate
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {!filteredStaff.length && <p style={{ textAlign: 'center', color: COLOR.slate, padding: 24 }}>No staff found.</p>}
                </div>
              )}

              {/* Deactivated staff — reactivate here, since they're hidden
                  from filteredStaff above by design. */}
              {staff.some(s => s.status === 'Inactive') && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${COLOR.rule}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: COLOR.slate, marginBottom: 10 }}>Deactivated staff</div>
                  {staff.filter(s => s.status === 'Inactive').map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <div style={{ fontSize: 13, color: COLOR.slate }}>{s.name}</div>
                      <button onClick={() => reactivateStaff(s)} style={{ padding: '6px 12px', borderRadius: RADIUS.sm, border: `1px solid ${COLOR.sageDeep}55`, background: 'none', color: COLOR.sageDeep, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT.body }}>
                        Reactivate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'livemonitor' && isAdmin && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={true} allStaff={staff} initialTab="monitor" />
          )}

          {tab === 'geofraud' && isAdmin && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={true} allStaff={staff} initialTab="fraud" />
          )}

          {tab === 'geoshifts' && isAdmin && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={true} allStaff={staff} initialTab="shifts" />
          )}

          {tab === 'geocampus' && isAdmin && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={true} allStaff={staff} initialTab="campus" />
          )}

          {tab === 'georeport' && isAdmin && (
            <GeoAttendance currentStaff={loggedInStaff} isAdmin={true} allStaff={staff} initialTab="report" />
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
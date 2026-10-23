import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import {
  CONTROL_DEFAULTS, NATURES, NATURE_HELP, natureOf, isExpense, isLive, isManual,
  runExceptionChecks, vendorLedger, accountingView, advanceNameFromNote, nameMatch, reconcileAdvances,
  EXPENSE_HEADS, entryCategoryChoices, suggestHead, reasonProblems, isGenericText,
} from './lib/expenditureRules'

// Accounts → Audit → Accounting Controls
//   Health check   – exception report over the expense ledger (works without any database change)
//   Accounting view – Revenue / Capital / Drawings / Advance split, and classify entries
//   Staff advances – checks the cash ledger against the existing Salary → Advances register
//   Vendor bills   – supplier / contractor bills, linked payments, balance owed
//   Clean-up       – move old “Other” / vague entries to a real head with a real reason
//   Rules          – the switches behind the entry form and the database checks
// Screens that need migration 20261031_expenditure_accounting_controls.sql say so instead of failing.

const NAVY = '#1e3a6e', LINE = '#e4e0d4', MUT = '#5d6b82'
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const today = () => new Date().toLocaleDateString('en-CA')
const card = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 14 }
const inp = { padding: '8px 10px', border: '1px solid #cfd6e4', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' }
const btn = (bg = NAVY, fg = '#fff') => ({ background: bg, color: fg, border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 })
const th = { textAlign: 'left', padding: '6px 8px', fontSize: 12, color: MUT, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }
const td = { padding: '6px 8px', fontSize: 13, borderBottom: '1px solid #f1eee4', verticalAlign: 'top' }
const SEV = { High: ['#fde7e4', '#b42318'], Medium: ['#fef0d7', '#b54708'], Low: ['#e3f4ea', '#067647'] }
const Badge = ({ s }) => <span style={{ background: SEV[s][0], color: SEV[s][1], borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{s}</span>

const MIGRATION = '20261031_expenditure_accounting_controls.sql'
const NeedsMigration = () => (
  <div style={{ ...card, borderColor: '#f2c97d', background: '#fffaf0' }}>
    <b>One-time database update needed.</b>
    <div style={{ fontSize: 13, color: MUT, marginTop: 4 }}>
      Run <code>supabase/migrations/{MIGRATION}</code> in the Supabase SQL editor (after <code>20260925_qbank_rls.sql</code> and
      <code> 20261018_vendors_payers_write_policies.sql</code>). Until then this part is switched off; the Health check still works.
    </div>
  </div>
)

function periodRange(p, from, to) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth()
  const ymd = x => x.toLocaleDateString('en-CA')
  if (p === 'this') return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))]
  if (p === 'last') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))]
  if (p === '90') return [ymd(new Date(y, m, d.getDate() - 90)), ymd(d)]
  if (p === 'fy') { const sy = m >= 3 ? y : y - 1; return [`${sy}-04-01`, `${sy + 1}-03-31`] }
  if (p === 'custom') return [from || '0000-01-01', to || '9999-12-31']
  return ['0000-01-01', '9999-12-31']
}

function downloadCsv(name, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function EntryTable({ rows, limit = 50 }) {
  const [all, setAll] = useState(false)
  const list = all ? rows : rows.slice(0, limit)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{['Date', 'Voucher', 'Category', 'Description', 'Voucher head', 'Mode', 'Receipt', 'Amount'].map(h => <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{list.map(e => (
          <tr key={e.id}>
            <td style={td}>{String(e.entry_date).slice(0, 10)}</td>
            <td style={{ ...td, color: MUT }}>{e.voucher_no || '—'}</td>
            <td style={td}>{e.category}</td><td style={td}>{e.note || e.description}</td>
            <td style={td}>{e.voucher_head}</td><td style={td}>{e.payment_mode}</td>
            <td style={{ ...td, textAlign: 'center' }}>{e.receipt_url ? '✅' : '—'}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(e.amount)}</td>
          </tr>))}
        </tbody>
      </table>
      {rows.length > limit && !all && <button style={{ ...btn('#eef2f9', NAVY), marginTop: 8 }} onClick={() => setAll(true)}>Show all {rows.length}</button>}
    </div>
  )
}

// ── Health check ────────────────────────────────────────────────────────────
function Health({ entries, controls, controlsReady, advanceIds, vendorNames }) {
  const [open, setOpen] = useState(null)
  const checks = useMemo(() => runExceptionChecks(entries, { limit: controls.receipt_required_above ?? null, advanceRegisterIds: advanceIds, hasVoucherNo: controlsReady, vendorNames }), [entries, controls, advanceIds, controlsReady, vendorNames])
  const live = useMemo(() => entries.filter(e => isExpense(e) && isLive(e)), [entries])
  // aggregate findings (batch dates, spelling, concentration) describe the whole ledger, so they are not counted as flagged entries
  const flagged = useMemo(() => new Set(checks.filter(c => !c.aggregate).flatMap(c => c.rows.map(r => r.id))), [checks])
  const flaggedValue = useMemo(() => live.filter(e => flagged.has(e.id)).reduce((s, e) => s + Number(e.amount), 0), [live, flagged])
  const cnt = s => checks.filter(c => c.severity === s).length
  const exportAll = () => downloadCsv(`accounting-exceptions-${today()}.csv`, [['Check', 'Severity', 'Date', 'Voucher no', 'Category', 'Description', 'Voucher head', 'Mode', 'Receipt', 'Amount'],
    ...checks.flatMap(c => c.rows.map(e => [`${c.code} ${c.title}`, c.severity, String(e.entry_date).slice(0, 10), e.voucher_no || '', e.category, e.note || '', e.voucher_head || '', e.payment_mode, e.receipt_url ? 'Yes' : 'No', e.amount]))])
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Expense entries checked</div><b style={{ fontSize: 22 }}>{live.length}</b><div style={{ fontSize: 12, color: MUT }}>{fmt(live.reduce((s, e) => s + Number(e.amount), 0))}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Entries with a finding</div><b style={{ fontSize: 22 }}>{flagged.size}</b><div style={{ fontSize: 12, color: MUT }}>{fmt(flaggedValue)} ({live.length ? Math.round(flagged.size * 100 / live.length) : 0}% of entries)</div></div>
        {['High', 'Medium', 'Low'].map(s => <div key={s} style={card}><div style={{ fontSize: 12, color: MUT }}>{s} findings</div><b style={{ fontSize: 22, color: SEV[s][1] }}>{cnt(s)}</b></div>)}
      </div>
      {!checks.length && <div style={{ ...card, color: '#067647', fontWeight: 700 }}>✅ No findings for this period.</div>}
      {checks.length > 0 && <div><button style={btn('#16a34a')} onClick={exportAll}>⬇ Export all findings (CSV)</button></div>}
      {checks.map(c => (
        <div key={c.code} style={card}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(open === c.code ? null : c.code)}>
            <Badge s={c.severity} /><b style={{ flex: 1, minWidth: 200 }}>{c.code} · {c.title}</b>
            <span style={{ color: MUT, fontSize: 13 }}>{c.rows.length} entr{c.rows.length === 1 ? 'y' : 'ies'}{c.total ? ` · ${fmt(c.total)}` : ''}</span><span>{open === c.code ? '▾' : '▸'}</span>
          </div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 6 }}>{c.why}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}><b>Do:</b> {c.action}</div>
          {c.notes && <ul style={{ fontSize: 13, color: MUT, margin: '6px 0 0 18px' }}>{c.notes.map(n => <li key={n}>{n}</li>)}</ul>}
          {open === c.code && <div style={{ marginTop: 10 }}><EntryTable rows={[...c.rows].sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))} /></div>}
        </div>))}
    </div>
  )
}

// ── Accounting view ─────────────────────────────────────────────────────────
function View({ entries, controlsReady, canWrite, reload }) {
  const v = useMemo(() => accountingView(entries), [entries])
  const live = useMemo(() => entries.filter(e => isExpense(e) && isLive(e)), [entries])
  const [filter, setFilter] = useState('review')
  const [busy, setBusy] = useState(null)
  const list = useMemo(() => live.filter(e => (filter === 'all' ? true : filter === 'review' ? (natureOf(e) !== 'Revenue' || !e.expense_nature && /construction|building|furniture|equipment/i.test(e.category || '')) : natureOf(e) === filter))
    .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date))), [live, filter])
  const months = useMemo(() => {
    const m = {}
    live.forEach(e => { const k = String(e.entry_date).slice(0, 7); (m[k] ||= { Revenue: 0, Capital: 0, Drawings: 0, Advance: 0 })[natureOf(e)] += Number(e.amount) })
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]))
  }, [live])
  const set = async (e, nature) => {
    setBusy(e.id)
    const { error } = await supabase.from('accounts').update({ expense_nature: nature || null }).eq('id', e.id)
    setBusy(null); if (error) alert('Could not save: ' + error.message); else reload()
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...card, fontSize: 13, color: MUT }}>
        Proper accounts separate <b>running costs</b> from money that buys an asset, owner withdrawals and staff advances. Only <b>Revenue</b> items reduce this period’s surplus.
        This view does not change any existing report — it shows where each rupee belongs.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        {NATURES.map(n => <div key={n} style={card}><div style={{ fontSize: 12, color: MUT }}>{n}</div><b style={{ fontSize: 20 }}>{fmt(v.totals[n])}</b><div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{NATURE_HELP[n]}</div></div>)}
        <div style={{ ...card, background: '#f4f7fc' }}><div style={{ fontSize: 12, color: MUT }}>Operating expense (Revenue only)</div><b style={{ fontSize: 20, color: NAVY }}>{fmt(v.operating)}</b><div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>Total cash out {fmt(v.outflow)}</div></div>
      </div>
      <div style={card}>
        <b>By month</b>
        <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
          <thead><tr><th style={th}>Month</th>{NATURES.map(n => <th key={n} style={{ ...th, textAlign: 'right' }}>{n}</th>)}</tr></thead>
          <tbody>{months.map(([k, t]) => <tr key={k}><td style={td}>{k}</td>{NATURES.map(n => <td key={n} style={{ ...td, textAlign: 'right' }}>{fmt(t[n])}</td>)}</tr>)}</tbody>
        </table></div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <b style={{ flex: 1 }}>Classify entries</b>
          {[['review', 'Needs review'], ...NATURES.map(n => [n, n]), ['all', 'All']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ ...btn(filter === k ? NAVY : '#eef2f9', filter === k ? '#fff' : NAVY), padding: '5px 10px' }}>{l}</button>)}
        </div>
        {!controlsReady && <NeedsMigration />}
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Category</th><th style={th}>Description</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Nature</th></tr></thead>
          <tbody>{list.slice(0, 300).map(e => (
            <tr key={e.id}><td style={td}>{String(e.entry_date).slice(0, 10)}</td><td style={td}>{e.category}</td><td style={td}>{e.note}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(e.amount)}</td>
              <td style={td}>{controlsReady && canWrite && isManual(e)
                ? <select disabled={busy === e.id} value={e.expense_nature || ''} onChange={ev => set(e, ev.target.value)} style={{ ...inp, padding: '4px 6px', width: 130 }}>
                    <option value="">Auto ({natureOf({ ...e, expense_nature: '' })})</option>{NATURES.map(n => <option key={n}>{n}</option>)}</select>
                : natureOf(e)}</td></tr>))}
          </tbody></table></div>
        {list.length > 300 && <div style={{ fontSize: 12, color: MUT, marginTop: 6 }}>Showing the latest 300 of {list.length}. Narrow the period above.</div>}
      </div>
    </div>
  )
}

// ── Staff advances ──────────────────────────────────────────────────────────
// The register itself is Salary → Advances (public.staff_advances: payroll deducts it in instalments).
// This screen does not duplicate it: it shows the register and checks the CASH LEDGER against it, so an
// advance paid out of the till that was never put into Salary (and so will never be recovered) is caught.
function Advances({ entries, canWrite, onLoaded }) {
  const [reg, setReg] = useState([]), [staff, setStaff] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [tick, setTick] = useState(0)
  const [pick, setPick] = useState({}), [months, setMonths] = useState({}), [done, setDone] = useState({})
  const load = () => setTick(t => t + 1)
  useEffect(() => {
    let dead = false
    ;(async () => {
      const [a, s] = await Promise.all([
        supabase.from('staff_advances').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_profiles').select('id,name').order('name'),
      ])
      if (dead) return
      if (a.error) { setErr(`Could not read Salary advances: ${a.error.message}`); return }
      setErr(''); setReg(a.data || []); setStaff(s.data || [])
    })()
    return () => { dead = true }
  }, [tick])
  const nameOf = useMemo(() => new Map(staff.map(x => [String(x.id), x.name])), [staff])
  const rows = useMemo(() => reg.map(r => ({ ...r, name: nameOf.get(String(r.staff_id)) || `Staff #${r.staff_id}`, balance: Number(r.amount) - Number(r.repaid_amount || 0) })), [reg, nameOf])
  const candidates = useMemo(() => entries.filter(e => isExpense(e) && isLive(e) && natureOf(e) === 'Advance').sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date))), [entries])
  const { matched, missing } = useMemo(() => reconcileAdvances(candidates, rows), [candidates, rows])
  const key = [...matched].sort().join(',')
  useEffect(() => { onLoaded?.(matched) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const byStaff = useMemo(() => { const m = {}; rows.forEach(r => { (m[r.name] ||= []).push(r) }); return Object.entries(m).map(([n, a]) => [n, a, a.reduce((t, x) => t + (x.status === 'Fully Repaid' ? 0 : x.balance), 0)]).sort((a, b) => b[2] - a[2]) }, [rows])
  const open = byStaff.reduce((t, x) => t + x[2], 0)
  const suggest = e => staff.find(x => nameMatch(advanceNameFromNote(e.note), x.name))?.id ?? ''
  const record = async e => {
    const staff_id = pick[e.id] ?? suggest(e)
    if (!staff_id) { alert('Choose which staff member this advance was given to.'); return }
    const amount = Number(e.amount), recovered = Math.min(Number(done[e.id]) || 0, amount)
    if (!window.confirm(`Record ${fmt(amount)} for ${nameOf.get(String(staff_id))} in Salary → Advances?\n\nPayroll will deduct the remaining ${fmt(amount - recovered)} from future salary${recovered ? '' : ' (nothing marked as already recovered)'}.`)) return
    setBusy(true)
    const { error } = await supabase.from('staff_advances').insert([{ staff_id: Number(staff_id), amount, reason: e.note || null, issued_month: String(e.entry_date).slice(0, 7), repay_months: Number(months[e.id]) || 1, repaid_amount: recovered, status: recovered >= amount ? 'Fully Repaid' : 'Active' }])
    setBusy(false)
    if (error) alert('Could not record it: ' + error.message); else load()
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {err && <div style={{ ...card, color: '#b42318' }}>{err}</div>}
      <div style={{ ...card, fontSize: 13, color: MUT }}>
        The advance register lives in <b>Salary → Advances</b> and payroll recovers it in instalments. This screen checks that every advance paid out in the
        cash ledger is also in that register — otherwise nobody recovers it.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Still to recover (register)</div><b style={{ fontSize: 22, color: open ? '#b54708' : '#067647' }}>{fmt(open)}</b></div>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Ledger advances matched</div><b style={{ fontSize: 22, color: '#067647' }}>{matched.size}</b></div>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>In ledger, missing from register</div><b style={{ fontSize: 22, color: missing.length ? '#b42318' : '#067647' }}>{missing.length}</b><div style={{ fontSize: 12, color: MUT }}>{fmt(missing.reduce((t, e) => t + Number(e.amount), 0))}</div></div>
      </div>
      {missing.length > 0 && (
        <div style={card}>
          <b>Advances paid in the ledger but not in Salary → Advances</b>
          <div style={{ fontSize: 12, color: MUT, margin: '4px 0 8px' }}>Pick the staff member and record each one. If part was already recovered, enter that amount so payroll does not deduct it twice.</div>
          <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Description</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Staff</th><th style={th}>Already recovered ₹</th><th style={th}>Months</th><th style={th} /></tr></thead>
            <tbody>{missing.map(e => (
              <tr key={e.id}><td style={td}>{String(e.entry_date).slice(0, 10)}</td><td style={td}>{e.note}</td><td style={{ ...td, textAlign: 'right' }}>{fmt(e.amount)}</td>
                <td style={td}><select style={{ ...inp, padding: '4px 6px', minWidth: 150 }} value={pick[e.id] ?? suggest(e)} onChange={ev => setPick(p => ({ ...p, [e.id]: ev.target.value }))} disabled={!canWrite}><option value="">Choose…</option>{staff.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
                <td style={td}><input type="number" min="0" max={e.amount} style={{ ...inp, width: 90, padding: '4px 6px' }} value={done[e.id] ?? ''} onChange={ev => setDone(d => ({ ...d, [e.id]: ev.target.value }))} disabled={!canWrite} /></td>
                <td style={td}><input type="number" min="1" max="12" style={{ ...inp, width: 60, padding: '4px 6px' }} value={months[e.id] ?? 1} onChange={ev => setMonths(m => ({ ...m, [e.id]: ev.target.value }))} disabled={!canWrite} /></td>
                <td style={td}>{canWrite && <button style={{ ...btn(), padding: '4px 10px' }} disabled={busy} onClick={() => record(e)}>Record</button>}</td></tr>))}
            </tbody></table></div>
        </div>)}
      {byStaff.map(([name, adv, bal]) => (
        <div key={name} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}><b>{name}</b><b style={{ color: bal ? '#b54708' : '#067647' }}>To recover {fmt(bal)}</b></div>
          <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
            <thead><tr><th style={th}>Month</th><th style={th}>Reason</th><th style={{ ...th, textAlign: 'right' }}>Advance</th><th style={{ ...th, textAlign: 'right' }}>Recovered</th><th style={{ ...th, textAlign: 'right' }}>Balance</th><th style={th}>Status</th></tr></thead>
            <tbody>{adv.map(a => <tr key={a.id}><td style={td}>{String(a.issued_month).slice(0, 7)}</td><td style={td}>{a.reason}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(a.amount)}</td><td style={{ ...td, textAlign: 'right' }}>{fmt(a.repaid_amount)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(a.balance)}</td><td style={td}>{a.status}</td></tr>)}</tbody></table></div>
        </div>))}
      {!byStaff.length && !err && <div style={{ ...card, color: MUT }}>No advances in Salary → Advances yet.</div>}
    </div>
  )
}

// ── Vendor bills ────────────────────────────────────────────────────────────
function Bills({ entries, vendors, controlsReady, canWrite, who, reload }) {
  const [bills, setBills] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [f, setF] = useState({ vendor_id: '', bill_no: '', bill_date: today(), due_date: '', amount: '', description: '', nature: 'Revenue' })
  const [link, setLink] = useState({})
  const vname = useMemo(() => new Map((vendors || []).map(v => [String(v.id), v.name])), [vendors])
  const [tick, setTick] = useState(0)
  const load = () => setTick(t => t + 1)
  useEffect(() => {
    if (!controlsReady) return
    let dead = false
    ;(async () => {
      const { data, error } = await supabase.from('accounts_vendor_bill_balances').select('*').order('bill_date', { ascending: false })
      if (dead) return
      if (error) setErr(error.message); else { setErr(''); setBills(data || []) }
    })()
    return () => { dead = true }
  }, [controlsReady, tick])
  const exp = useMemo(() => entries.filter(e => isExpense(e) && isLive(e)), [entries])
  const ledger = useMemo(() => vendorLedger(bills, exp), [bills, exp])
  if (!controlsReady) return <NeedsMigration />
  const add = async ev => {
    ev.preventDefault(); if (!f.vendor_id || !(Number(f.amount) > 0)) { alert('Choose the vendor and enter the bill amount.'); return }
    setBusy(true); const { error } = await supabase.from('accounts_vendor_bills').insert({ ...f, vendor_id: Number(f.vendor_id), amount: Number(f.amount), due_date: f.due_date || null, created_by: who }); setBusy(false)
    if (error) alert('Could not save: ' + error.message); else { setF({ ...f, bill_no: '', amount: '', description: '' }); load() }
  }
  const attach = async (b) => {
    const id = link[b.id]; if (!id) return
    setBusy(true); const { error } = await supabase.from('accounts').update({ bill_id: b.id }).eq('id', id); setBusy(false)
    if (error) alert('Could not link: ' + error.message); else { setLink(l => ({ ...l, [b.id]: '' })); load(); reload() }
  }
  const cancel = async b => { if (!window.confirm('Cancel this bill?')) return; const { error } = await supabase.from('accounts_vendor_bills').update({ status: 'Cancelled' }).eq('id', b.id); if (error) alert(error.message); else load() }
  const rows = [...ledger.entries()].map(([id, v]) => ({ id, name: vname.get(id) || `Vendor ${id}`, ...v })).filter(v => v.bills || v.paid).sort((a, b) => b.outstanding - a.outstanding || b.paid - a.paid)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {err && <div style={{ ...card, color: '#b42318' }}>{err}</div>}
      {canWrite && <form onSubmit={add} style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, alignItems: 'end' }}>
        <label>Vendor<select style={inp} value={f.vendor_id} onChange={e => setF({ ...f, vendor_id: e.target.value })}><option value="">Select…</option>{(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Bill no.<input style={inp} value={f.bill_no} onChange={e => setF({ ...f, bill_no: e.target.value })} /></label>
        <label>Bill date<input type="date" style={inp} max={today()} value={f.bill_date} onChange={e => setF({ ...f, bill_date: e.target.value })} /></label>
        <label>Due date<input type="date" style={inp} value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></label>
        <label>Amount<input type="number" min="1" style={inp} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
        <label>Nature<select style={inp} value={f.nature} onChange={e => setF({ ...f, nature: e.target.value })}><option>Revenue</option><option>Capital</option></select></label>
        <label style={{ gridColumn: 'span 2' }}>What for<input style={inp} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
        <button style={btn('#16a34a')} disabled={busy}>＋ Record bill</button>
      </form>}
      <div style={card}>
        <b>Supplier / contractor balances</b>
        <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
          <thead><tr><th style={th}>Vendor</th><th style={{ ...th, textAlign: 'right' }}>Billed</th><th style={{ ...th, textAlign: 'right' }}>Paid (all)</th><th style={{ ...th, textAlign: 'right' }}>Paid, no bill</th><th style={{ ...th, textAlign: 'right' }}>Owed on bills</th></tr></thead>
          <tbody>{rows.map(v => <tr key={v.id}><td style={td}>{v.name}</td><td style={{ ...td, textAlign: 'right' }}>{fmt(v.billed)}</td><td style={{ ...td, textAlign: 'right' }}>{fmt(v.paid)}</td>
            <td style={{ ...td, textAlign: 'right', color: v.unbilledPaid ? '#b54708' : undefined }}>{fmt(v.unbilledPaid)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(v.outstanding)}</td></tr>)}</tbody></table></div>
        <div style={{ fontSize: 12, color: MUT, marginTop: 6 }}>“Paid, no bill” is money paid to the vendor that is not tied to any bill — the amount to get invoices for.</div>
      </div>
      {bills.filter(b => b.status !== 'Cancelled').map(b => {
        const cand = exp.filter(e => String(e.vendor_id) === String(b.vendor_id) && !e.bill_id)
        return (
          <div key={b.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b>{vname.get(String(b.vendor_id)) || `Vendor ${b.vendor_id}`} · {b.bill_no || 'no bill no.'} · {String(b.bill_date).slice(0, 10)}</b>
              <span>Bill {fmt(b.amount)} · Paid {fmt(b.paid)} · <b style={{ color: Number(b.balance) > 0 ? '#b54708' : '#067647' }}>Balance {fmt(b.balance)}</b></span></div>
            <div style={{ fontSize: 13, color: MUT }}>{b.description}{b.due_date ? ` · due ${String(b.due_date).slice(0, 10)}` : ''}{b.nature === 'Capital' ? ' · Capital' : ''}</div>
            {canWrite && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <select style={{ ...inp, width: 'auto', maxWidth: 360 }} value={link[b.id] || ''} onChange={e => setLink(l => ({ ...l, [b.id]: e.target.value }))}>
                <option value="">Link an existing payment to this vendor…</option>{cand.map(e => <option key={e.id} value={e.id}>{String(e.entry_date).slice(0, 10)} · {fmt(e.amount)} · {(e.note || '').slice(0, 40)}</option>)}</select>
              <button style={btn()} disabled={busy || !link[b.id]} onClick={() => attach(b)}>Link</button>
              <button style={btn('#fde7e4', '#b42318')} onClick={() => cancel(b)}>Cancel bill</button></div>}
          </div>)
      })}
      <div style={{ fontSize: 12, color: MUT }}>Tip: when you record a payment in Transactions, pick the vendor; then link it to the right bill here so the balance owed stays correct.</div>
    </div>
  )
}

function Toggle({ d, setD, disabled, k, label, help }) {
  return <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" disabled={disabled} checked={!!d[k]} onChange={e => setD({ ...d, [k]: e.target.checked })} style={{ marginTop: 3 }} /><span><b>{label}</b><div style={{ fontSize: 12, color: MUT }}>{help}</div></span></label>
}

// ── Clean-up ────────────────────────────────────────────────────────────────
// Old entries typed before the real-head rule: a filler head ("Other", "Paytm Payment") or a reason that says nothing.
// Each row gets a real head (suggested where the old head is recognisable), an optional sub-head and a real reason.
function CleanUp({ entries, vendors, canWrite, who, reload, isLocked, onAudit }) {
  const [filter, setFilter] = useState('all'), [q, setQ] = useState('')
  const [ed, setEd] = useState({}), [busy, setBusy] = useState(null), [done, setDone] = useState(0)
  const vname = useMemo(() => new Map((vendors || []).map(v => [String(v.id), v.name])), [vendors])
  const live = useMemo(() => entries.filter(e => isExpense(e) && isLive(e) && isManual(e)), [entries])
  const used = useMemo(() => live.map(e => e.category).filter(Boolean), [live])
  const heads = useMemo(() => entryCategoryChoices(used, []), [used])
  const probsOf = (e, cat, sub, note) => reasonProblems({ note, category: cat, subCategory: sub, vendorName: vname.get(String(e.vendor_id)) })
  const todo = useMemo(() => live.filter(e => {
    const generic = isGenericText(e.category), weak = probsOf(e, e.category, e.sub_category, e.note).length > 0
    return filter === 'head' ? generic : filter === 'reason' ? weak && !generic : (generic || weak)
  }).filter(e => !q.trim() || `${e.category} ${e.note} ${e.voucher_head}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date))), [live, filter, q, vname]) // eslint-disable-line react-hooks/exhaustive-deps
  const get = e => ed[e.id] || { cat: isGenericText(e.category) ? (suggestHead(e.category) || '') : e.category, sub: e.sub_category || '', note: e.note || '' }
  const set = (e, k, v) => setEd(p => ({ ...p, [e.id]: { ...get(e), [k]: v } }))
  const save = async e => {
    const v = get(e)
    if (!v.cat || isGenericText(v.cat)) { alert('Choose a real category for this entry.'); return }
    const probs = probsOf(e, v.cat, v.sub, v.note)
    if (probs.length) { alert(`The reason needs ${probs.join('; ')}.`); return }
    if (isLocked?.(e)) { alert(`${String(e.entry_date).slice(0, 7)} is closed for this account. Reopen the month first.`); return }
    if (v.cat === e.category && (v.sub || '') === (e.sub_category || '') && v.note === (e.note || '')) { alert('Nothing was changed.'); return }
    const payload = { category: v.cat, sub_category: v.sub || null, note: v.note.trim(), edited_by: who, edited_at: new Date().toISOString() }
    setBusy(e.id)
    const { error } = await supabase.from('accounts').update(payload).eq('id', e.id)
    setBusy(null)
    if (error) { alert('Could not save: ' + error.message); return }
    try { await onAudit?.(e, payload) } catch { /* audit log is best-effort here */ }
    setDone(n => n + 1); setEd(p => { const n = { ...p }; delete n[e.id]; return n }); reload()
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...card, fontSize: 13, color: MUT }}>
        Old entries under <b>“Other”</b> or a payment-app name, or with a reason that does not say what was bought, can be fixed here. Pick the real head, check the reason,
        and save — each fix is recorded in the audit log. {done > 0 && <b style={{ color: '#067647' }}>{done} fixed this session.</b>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'All needing fix'], ['head', 'Generic head'], ['reason', 'Weak reason only']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ ...btn(filter === k ? NAVY : '#eef2f9', filter === k ? '#fff' : NAVY), padding: '6px 12px' }}>{l}</button>)}
        <input style={{ ...inp, maxWidth: 260 }} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        <span style={{ fontSize: 12, color: MUT }}>{todo.length} entr{todo.length === 1 ? 'y' : 'ies'}</span>
      </div>
      {!todo.length && <div style={{ ...card, color: '#067647', fontWeight: 700 }}>✅ Nothing to clean up.</div>}
      {todo.slice(0, 100).map(e => {
        const v = get(e), probs = probsOf(e, v.cat, v.sub, v.note), subs = EXPENSE_HEADS[v.cat] || []
        return (
          <div key={e.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span><b>{String(e.entry_date).slice(0, 10)}</b> · {fmt(e.amount)} · {e.voucher_head || '—'}{vname.get(String(e.vendor_id)) ? ` · paid to ${vname.get(String(e.vendor_id))}` : ''}</span>
              <span style={{ color: MUT }}>was: <b>{e.category}</b>{e.sub_category ? ` / ${e.sub_category}` : ''} — “{e.note}”</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 12, color: MUT }}>Real category
                <select style={inp} value={v.cat} onChange={ev => { set(e, 'cat', ev.target.value) }} disabled={!canWrite}>
                  <option value="">Choose…</option>{heads.map(h => <option key={h}>{h}</option>)}</select></label>
              <label style={{ fontSize: 12, color: MUT }}>Sub-category
                <select style={inp} value={v.sub} onChange={ev => set(e, 'sub', ev.target.value)} disabled={!canWrite || !v.cat}>
                  <option value="">{subs.length ? 'Choose…' : '—'}</option>{subs.map(x => <option key={x}>{x}</option>)}{v.sub && !subs.includes(v.sub) && <option>{v.sub}</option>}</select></label>
              <label style={{ fontSize: 12, color: MUT, gridColumn: 'span 2' }}>Real reason — what was bought / paid for, and for whom
                <input style={inp} value={v.note} onChange={ev => set(e, 'note', ev.target.value)} disabled={!canWrite} /></label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {canWrite && <button style={btn()} disabled={busy === e.id} onClick={() => save(e)}>Save fix</button>}
              <span style={{ fontSize: 12, color: probs.length || !v.cat ? '#b54708' : '#067647' }}>{!v.cat ? 'Choose a category.' : probs.length ? `Reason needs: ${probs.join('; ')}.` : '✓ Ready to save'}</span>
            </div>
          </div>)
      })}
      {todo.length > 100 && <div style={{ fontSize: 12, color: MUT }}>Showing the latest 100 of {todo.length}. Fix some and the next ones appear.</div>}
    </div>
  )
}

// ── Rules ───────────────────────────────────────────────────────────────────
function Rules({ controls, controlsCols, controlsReady, isAdmin, who, onSaved }) {
  const [d, setD] = useState(controls), [busy, setBusy] = useState(false)
  if (!controlsReady) return <NeedsMigration />
  const hasReal = (controlsCols || []).includes('block_generic_category')   // migration 20261033 run?
  const save = async () => {
    setBusy(true)
    const cols = controlsCols?.length ? controlsCols : Object.keys(d)
    const { error } = await supabase.from('accounting_controls').update({ ...Object.fromEntries(Object.entries(d).filter(([k]) => cols.includes(k))), receipt_required_above: d.receipt_required_above === '' || d.receipt_required_above == null ? null : Number(d.receipt_required_above), ...(cols.includes('min_reason_length') ? { min_reason_length: Math.max(5, Number(d.min_reason_length) || 15), min_reason_words: Math.max(1, Number(d.min_reason_words) || 3) } : {}), updated_by: who, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false); if (error) alert('Could not save: ' + error.message); else onSaved()
  }
  return (
    <div style={{ ...card, display: 'grid', gap: 14, maxWidth: 720 }}>
      <label><b>Receipt required above (₹)</b><input type="number" min="0" placeholder="blank = off" style={{ ...inp, maxWidth: 180, display: 'block', marginTop: 4 }} disabled={!isAdmin} value={d.receipt_required_above ?? ''} onChange={e => setD({ ...d, receipt_required_above: e.target.value })} />
        <div style={{ fontSize: 12, color: MUT }}>Checked on the entry form and in the Health check. Leave blank to switch this rule off.</div></label>
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_txn_ref_for_digital" label="Digital payments need a payment reference" help="UPI / bank / card entries must carry a UTR or transaction id (ACC-002)." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="block_digital_in_cash_acct" label="Digital payments cannot go in the Cash A/c" help="Keeps the cash balance real (ACC-001)." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_delete_reason" label="Deleting an entry needs a reason" help="Every void is explained in the record (ACC-003)." />
      {hasReal ? <>
        <Toggle d={d} setD={setD} disabled={!isAdmin} k="block_generic_category" label="No “Other” — a real category is required (ACC-004)" help="Refuses a new expense under “Other”, “Misc”, “Paytm Payment”, “Gpay Business” and similar. Pick the head the money was spent on." />
        <Toggle d={d} setD={setD} disabled={!isAdmin} k="generic_description_check" label="A real reason is required (ACC-005)" help="The reason must say what was bought or paid for: not a filler, not just the category, long enough." />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label><b>Minimum characters</b><input type="number" min="5" max="100" style={{ ...inp, width: 100, display: 'block', marginTop: 4 }} disabled={!isAdmin} value={d.min_reason_length ?? 15} onChange={e => setD({ ...d, min_reason_length: e.target.value })} /></label>
          <label><b>Minimum words</b><input type="number" min="1" max="20" style={{ ...inp, width: 100, display: 'block', marginTop: 4 }} disabled={!isAdmin} value={d.min_reason_words ?? 3} onChange={e => setD({ ...d, min_reason_words: e.target.value })} /></label>
        </div></>
      : <div style={{ ...card, borderColor: '#f2c97d', background: '#fffaf0', fontSize: 13 }}>The “no Other / real reason” rules are active on the entry form. To enforce them in the database too and change the limits here, run <code>supabase/migrations/20261033_expenditure_genuine_entry_rules.sql</code>.</div>}
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="enforce_in_database" label="Enforce ACC-001 / 002 / 003 in the database" help="Master switch. When on, the rules also apply to anything that bypasses this screen. Fees, store and Razorpay postings are never affected." />
      {isAdmin ? <div><button style={btn()} disabled={busy} onClick={save}>Save rules</button></div> : <div style={{ fontSize: 12, color: MUT }}>Only an admin can change these rules.</div>}
    </div>
  )
}

// ── Container ───────────────────────────────────────────────────────────────
export default function ExpenditureControls({ entries, vendors, controls, controlsCols, controlsReady, reloadControls, reload, isAdmin, canWrite, who, isLocked, onAudit }) {
  const [sub, setSub] = useState('health')
  const [period, setPeriod] = useState('90'), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [advanceIds, setAdvanceIds] = useState(new Set())
  const [lo, hi] = periodRange(period, from, to)
  const inRange = useMemo(() => (entries || []).filter(e => { const d = String(e.entry_date).slice(0, 10); return d >= lo && d <= hi }), [entries, lo, hi])
  const ctl = { ...CONTROL_DEFAULTS, ...(controls || {}) }
  const vendorNames = useMemo(() => new Map((vendors || []).map(v => [String(v.id), v.name])), [vendors])
  const TABS = [['health', '🩺 Health check'], ['view', '📊 Accounting view'], ['advances', '👤 Staff advances'], ['bills', '🧾 Vendor bills'], ['cleanup', '🧹 Clean-up'], ['rules', '⚙️ Rules']]
  return (
    <div style={{ padding: '4px 0 24px' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ ...btn(sub === k ? NAVY : '#eef2f9', sub === k ? '#fff' : NAVY), padding: '7px 12px' }}>{l}</button>)}
      </div>
      {(sub === 'health' || sub === 'view') && (
        <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <b style={{ fontSize: 13 }}>Period</b>
          <select style={{ ...inp, width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="this">This month</option><option value="last">Last month</option><option value="90">Last 90 days</option><option value="fy">This financial year</option><option value="all">All time</option><option value="custom">Custom…</option></select>
          {period === 'custom' && <><input type="date" style={{ ...inp, width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} /><span>to</span><input type="date" style={{ ...inp, width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} /></>}
          <span style={{ fontSize: 12, color: MUT }}>Only confirmed, not-deleted expense entries are checked.</span>
        </div>)}
      {sub === 'health' && <Health entries={inRange} controls={ctl} controlsReady={controlsReady} advanceIds={advanceIds} vendorNames={vendorNames} />}
      {sub === 'view' && <View entries={inRange} controlsReady={controlsReady} canWrite={canWrite} reload={reload} />}
      {sub === 'advances' && <Advances entries={entries || []} canWrite={canWrite} onLoaded={setAdvanceIds} />}
      {sub === 'bills' && <Bills entries={entries || []} vendors={vendors} controlsReady={controlsReady} canWrite={canWrite} who={who} reload={reload} />}
      {sub === 'cleanup' && <CleanUp entries={entries || []} vendors={vendors} canWrite={canWrite} who={who} reload={reload} isLocked={isLocked} onAudit={onAudit} />}
      {sub === 'rules' && <Rules key={JSON.stringify(ctl)} controls={ctl} controlsCols={controlsCols} controlsReady={controlsReady} isAdmin={isAdmin} who={who} onSaved={reloadControls} />}
    </div>
  )
}

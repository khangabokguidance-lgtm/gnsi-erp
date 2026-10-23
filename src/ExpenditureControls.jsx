import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import {
  CONTROL_DEFAULTS, NATURES, NATURE_HELP, natureOf, isExpense, isLive, isManual,
  runExceptionChecks, vendorLedger, accountingView, advanceNameFromNote,
} from './lib/expenditureRules'

// Accounts → Audit → Accounting Controls
//   Health check   – exception report over the expense ledger (works without any database change)
//   Accounting view – Revenue / Capital / Drawings / Advance split, and classify entries
//   Staff advances – register + recoveries, import from the ledger
//   Vendor bills   – supplier / contractor bills, linked payments, balance owed
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
function Health({ entries, controls, controlsReady, advanceIds }) {
  const [open, setOpen] = useState(null)
  const checks = useMemo(() => runExceptionChecks(entries, { limit: controls.receipt_required_above ?? null, advanceRegisterIds: advanceIds, hasVoucherNo: controlsReady }), [entries, controls, advanceIds, controlsReady])
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
function Advances({ entries, staffList, controlsReady, canWrite, isAdmin, who, onLoaded }) {
  const [rows, setRows] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ staff_name: '', advance_date: today(), amount: '', purpose: '' })
  const [rec, setRec] = useState({}), [picked, setPicked] = useState({}), [names, setNames] = useState({})
  const [tick, setTick] = useState(0)
  const load = () => setTick(t => t + 1)
  useEffect(() => {
    if (!controlsReady) return
    let dead = false
    ;(async () => {
      const { data, error } = await supabase.from('staff_advance_balances').select('*').order('advance_date', { ascending: false })
      if (dead) return
      if (error) { setErr(error.message); return }
      setErr(''); setRows(data || [])
      onLoaded?.(new Set((data || []).map(r => r.account_id).filter(Boolean).map(String)))
    })()
    return () => { dead = true }
  }, [controlsReady, onLoaded, tick])
  const linked = useMemo(() => new Set(rows.map(r => r.account_id).filter(Boolean).map(String)), [rows])
  const candidates = useMemo(() => entries.filter(e => isExpense(e) && isLive(e) && natureOf(e) === 'Advance').sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date))), [entries])
  const todo = candidates.filter(e => !linked.has(String(e.id)))
  const byStaff = useMemo(() => { const m = {}; rows.forEach(r => { (m[r.staff_name] ||= []).push(r) }); return Object.entries(m).map(([n, a]) => [n, a, a.reduce((s, x) => s + Number(x.balance), 0)]).sort((a, b) => b[2] - a[2]) }, [rows])
  const totalOpen = byStaff.reduce((s, x) => s + x[2], 0)
  if (!controlsReady) return <NeedsMigration />
  const add = async ev => {
    ev.preventDefault(); if (!form.staff_name.trim() || !(Number(form.amount) > 0)) { alert('Enter the staff name and an amount.'); return }
    setBusy(true); const { error } = await supabase.from('staff_advances').insert({ ...form, staff_name: form.staff_name.trim(), amount: Number(form.amount), created_by: who }); setBusy(false)
    if (error) alert('Could not save: ' + error.message); else { setForm({ staff_name: '', advance_date: today(), amount: '', purpose: '' }); load() }
  }
  const recover = async (a, method) => {
    const amt = Number(rec[a.id]); if (!(amt > 0) || amt > Number(a.balance)) { alert(`Enter an amount up to ${fmt(a.balance)}.`); return }
    setBusy(true)
    const { error } = await supabase.from('staff_advance_recoveries').insert({ advance_id: a.id, amount: amt, method, created_by: who })
    if (!error && amt === Number(a.balance)) await supabase.from('staff_advances').update({ status: 'Settled' }).eq('id', a.id)
    setBusy(false); if (error) alert('Could not save: ' + error.message); else { setRec(r => ({ ...r, [a.id]: '' })); load() }
  }
  const doImport = async () => {
    const sel = todo.filter(e => picked[e.id]); if (!sel.length) return
    setBusy(true)
    const { error } = await supabase.from('staff_advances').insert(sel.map(e => ({ staff_name: (names[e.id] ?? advanceNameFromNote(e.note)) || 'Unknown', advance_date: String(e.entry_date).slice(0, 10), amount: Number(e.amount), purpose: e.note, account_id: String(e.id), created_by: who })))
    setBusy(false); if (error) alert('Could not import: ' + error.message); else { setPicked({}); load() }
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {err && <div style={{ ...card, color: '#b42318' }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Advances still to recover</div><b style={{ fontSize: 22, color: totalOpen ? '#b54708' : '#067647' }}>{fmt(totalOpen)}</b></div>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Staff with a balance</div><b style={{ fontSize: 22 }}>{byStaff.filter(x => x[2] > 0).length}</b></div>
        <div style={card}><div style={{ fontSize: 12, color: MUT }}>Ledger advances not in register</div><b style={{ fontSize: 22, color: todo.length ? '#b42318' : '#067647' }}>{todo.length}</b></div>
      </div>
      {canWrite && todo.length > 0 && (
        <div style={card}>
          <b>Import advances already in the ledger</b>
          <div style={{ fontSize: 12, color: MUT, margin: '4px 0 8px' }}>These entries look like salary advances. Check the staff name, tick and import.</div>
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th} /><th style={th}>Date</th><th style={th}>Description</th><th style={th}>Staff name</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{todo.map(e => <tr key={e.id}><td style={td}><input type="checkbox" checked={!!picked[e.id]} onChange={() => setPicked(p => ({ ...p, [e.id]: !p[e.id] }))} /></td>
              <td style={td}>{String(e.entry_date).slice(0, 10)}</td><td style={td}>{e.note}</td>
              <td style={td}><input style={{ ...inp, padding: '4px 6px' }} value={names[e.id] ?? advanceNameFromNote(e.note)} onChange={ev => setNames(n => ({ ...n, [e.id]: ev.target.value }))} /></td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(e.amount)}</td></tr>)}</tbody></table></div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button style={btn('#eef2f9', NAVY)} onClick={() => setPicked(Object.fromEntries(todo.map(e => [e.id, true])))}>Tick all</button>
            <button style={btn()} disabled={busy} onClick={doImport}>Import ticked ({todo.filter(e => picked[e.id]).length})</button>
          </div>
        </div>)}
      {canWrite && (
        <form onSubmit={add} style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, alignItems: 'end' }}>
          <label>Staff<input list="adv-staff" style={inp} value={form.staff_name} onChange={e => setForm({ ...form, staff_name: e.target.value })} /><datalist id="adv-staff">{(staffList || []).map(s => <option key={s.id ?? s.name} value={s.name} />)}</datalist></label>
          <label>Date<input type="date" style={inp} value={form.advance_date} max={today()} onChange={e => setForm({ ...form, advance_date: e.target.value })} /></label>
          <label>Amount<input type="number" min="1" style={inp} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
          <label>Purpose<input style={inp} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></label>
          <button style={btn('#16a34a')} disabled={busy}>＋ Record advance</button>
        </form>)}
      {byStaff.map(([name, adv, bal]) => (
        <div key={name} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}><b>{name}</b><b style={{ color: bal ? '#b54708' : '#067647' }}>Balance {fmt(bal)}</b></div>
          <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Purpose</th><th style={{ ...th, textAlign: 'right' }}>Advance</th><th style={{ ...th, textAlign: 'right' }}>Recovered</th><th style={{ ...th, textAlign: 'right' }}>Balance</th><th style={th}>Recover</th></tr></thead>
            <tbody>{adv.map(a => <tr key={a.id}><td style={td}>{String(a.advance_date).slice(0, 10)}</td><td style={td}>{a.purpose}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(a.amount)}</td><td style={{ ...td, textAlign: 'right' }}>{fmt(a.recovered)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(a.balance)}</td>
              <td style={td}>{canWrite && Number(a.balance) > 0 && <span style={{ display: 'inline-flex', gap: 4 }}>
                <input type="number" min="1" placeholder="₹" style={{ ...inp, width: 80, padding: '4px 6px' }} value={rec[a.id] || ''} onChange={e => setRec(r => ({ ...r, [a.id]: e.target.value }))} />
                <button style={{ ...btn(), padding: '4px 8px' }} disabled={busy} onClick={() => recover(a, 'Salary deduction')} title="Deducted from salary">Salary</button>
                <button style={{ ...btn('#8a6118'), padding: '4px 8px' }} disabled={busy} onClick={() => recover(a, 'Cash returned')} title="Returned in cash">Cash</button></span>}
                {Number(a.balance) <= 0 && <span style={{ color: '#067647' }}>Settled</span>}</td></tr>)}</tbody></table></div>
        </div>))}
      {!byStaff.length && <div style={{ ...card, color: MUT }}>No advances recorded yet.</div>}
      {!isAdmin && <div style={{ fontSize: 12, color: MUT }}>Only an admin can delete register entries.</div>}
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
      const { data, error } = await supabase.from('vendor_bill_balances').select('*').order('bill_date', { ascending: false })
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
    setBusy(true); const { error } = await supabase.from('vendor_bills').insert({ ...f, vendor_id: Number(f.vendor_id), amount: Number(f.amount), due_date: f.due_date || null, created_by: who }); setBusy(false)
    if (error) alert('Could not save: ' + error.message); else { setF({ ...f, bill_no: '', amount: '', description: '' }); load() }
  }
  const attach = async (b) => {
    const id = link[b.id]; if (!id) return
    setBusy(true); const { error } = await supabase.from('accounts').update({ bill_id: b.id }).eq('id', id); setBusy(false)
    if (error) alert('Could not link: ' + error.message); else { setLink(l => ({ ...l, [b.id]: '' })); load(); reload() }
  }
  const cancel = async b => { if (!window.confirm('Cancel this bill?')) return; const { error } = await supabase.from('vendor_bills').update({ status: 'Cancelled' }).eq('id', b.id); if (error) alert(error.message); else load() }
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

// ── Rules ───────────────────────────────────────────────────────────────────
function Rules({ controls, controlsReady, isAdmin, who, onSaved }) {
  const [d, setD] = useState(controls), [busy, setBusy] = useState(false)
  if (!controlsReady) return <NeedsMigration />
  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('accounting_controls').update({ ...d, receipt_required_above: d.receipt_required_above === '' || d.receipt_required_above == null ? null : Number(d.receipt_required_above), updated_by: who, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false); if (error) alert('Could not save: ' + error.message); else onSaved()
  }
  return (
    <div style={{ ...card, display: 'grid', gap: 14, maxWidth: 720 }}>
      <label><b>Receipt required above (₹)</b><input type="number" min="0" placeholder="blank = off" style={{ ...inp, maxWidth: 180, display: 'block', marginTop: 4 }} disabled={!isAdmin} value={d.receipt_required_above ?? ''} onChange={e => setD({ ...d, receipt_required_above: e.target.value })} />
        <div style={{ fontSize: 12, color: MUT }}>Checked on the entry form and in the Health check. Leave blank to switch this rule off.</div></label>
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_txn_ref_for_digital" label="Digital payments need a payment reference" help="UPI / bank / card entries must carry a UTR or transaction id (ACC-002)." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="block_digital_in_cash_acct" label="Digital payments cannot go in the Cash A/c" help="Keeps the cash balance real (ACC-001)." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_delete_reason" label="Deleting an entry needs a reason" help="Every void is explained in the record (ACC-003)." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="generic_description_check" label="Refuse generic descriptions" help="Blocks entries such as “Paytm Payment” with no payee or purpose, on the entry form." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="enforce_in_database" label="Enforce ACC-001 / 002 / 003 in the database" help="Master switch. When on, the rules also apply to anything that bypasses this screen. Fees, store and Razorpay postings are never affected." />
      {isAdmin ? <div><button style={btn()} disabled={busy} onClick={save}>Save rules</button></div> : <div style={{ fontSize: 12, color: MUT }}>Only an admin can change these rules.</div>}
    </div>
  )
}

// ── Container ───────────────────────────────────────────────────────────────
export default function ExpenditureControls({ entries, vendors, staffList, controls, controlsReady, reloadControls, reload, isAdmin, canWrite, who }) {
  const [sub, setSub] = useState('health')
  const [period, setPeriod] = useState('90'), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [advanceIds, setAdvanceIds] = useState(new Set())
  const [lo, hi] = periodRange(period, from, to)
  const inRange = useMemo(() => (entries || []).filter(e => { const d = String(e.entry_date).slice(0, 10); return d >= lo && d <= hi }), [entries, lo, hi])
  const ctl = { ...CONTROL_DEFAULTS, ...(controls || {}) }
  const TABS = [['health', '🩺 Health check'], ['view', '📊 Accounting view'], ['advances', '👤 Staff advances'], ['bills', '🧾 Vendor bills'], ['rules', '⚙️ Rules']]
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
      {sub === 'health' && <Health entries={inRange} controls={ctl} controlsReady={controlsReady} advanceIds={advanceIds} />}
      {sub === 'view' && <View entries={inRange} controlsReady={controlsReady} canWrite={canWrite} reload={reload} />}
      {sub === 'advances' && <Advances entries={entries || []} staffList={staffList} controlsReady={controlsReady} canWrite={canWrite} isAdmin={isAdmin} who={who} onLoaded={setAdvanceIds} />}
      {sub === 'bills' && <Bills entries={entries || []} vendors={vendors} controlsReady={controlsReady} canWrite={canWrite} who={who} reload={reload} />}
      {sub === 'rules' && <Rules key={JSON.stringify(ctl)} controls={ctl} controlsReady={controlsReady} isAdmin={isAdmin} who={who} onSaved={reloadControls} />}
    </div>
  )
}

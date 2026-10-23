// FeeControls.jsx — Fees → Fee Controls (admin).
//   Health check   – accounting exceptions the other fee checks do not cover (see lib/feeControls.js)
//   Receipt series – the numbered receipt register: serial, receipt no., student, amount; search
//   Rules          – the switches behind FEE-001 / 002 / 003 (closed day, payment reference, revert reason)
// Parts that need migration 20261032_fee_accounting_controls.sql say so instead of failing.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { fetchAll } from './duesSnapshot'
import FeeTabShell from './FeeTabShell'
import { card, btn, btnPrimary, input, th, td, pill } from './feeTheme'
import { COLOR } from './ledgerTheme'
import { FEE_CONTROL_DEFAULTS, normaliseFeeRows, runFeeChecks, receiptSeries } from './lib/feeControls'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const iso = d => d.toLocaleDateString('en-CA')
const SEV = { High: [COLOR.dangerSoft || '#fde7e4', COLOR.danger || '#b42318'], Medium: ['#fef0d7', '#b54708'], Low: ['#e3f4ea', '#067647'] }
const MIGRATION = '20261032_fee_accounting_controls.sql'

function range(p) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth()
  if (p === 'month') return [iso(new Date(y, m, 1)), iso(d)]
  if (p === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
  if (p === '90') return [iso(new Date(y, m, d.getDate() - 90)), iso(d)]
  if (p === 'session') { const sy = m >= 3 ? y : y - 1; return [`${sy}-04-01`, `${sy + 1}-03-31`] }
  return ['2000-01-01', iso(d)]
}

function csv(name, rows) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function Rows({ rows, nameOf, limit = 40 }) {
  const [all, setAll] = useState(false)
  const list = (all ? rows : rows.slice(0, limit))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{['Date', 'Serial', 'Receipt', 'Student', 'Type', 'Mode', 'Reference', 'By', 'Amount'].map(h => <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{list.map(r => (
          <tr key={r.id}>
            <td style={td}>{r.date}</td><td style={td}>{r.serial || '—'}</td><td style={td}>{r.receipt || '—'}</td>
            <td style={td}>{nameOf(r.gcc)}<div style={{ fontSize: 11, color: COLOR.slate }}>GCC-{r.gcc}</div></td>
            <td style={td}>{r.kind}</td><td style={td}>{r.mode || '—'}</td><td style={td}>{r.ref || '—'}</td><td style={td}>{r.revertedBy || r.by || '—'}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(r.amount)}</td>
          </tr>))}
        </tbody>
      </table>
      {rows.length > limit && !all && <button style={{ ...btn, marginTop: 8 }} onClick={() => setAll(true)}>Show all {rows.length}</button>}
    </div>
  )
}

function Toggle({ d, setD, k, label, help, disabled }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <input type="checkbox" disabled={disabled} checked={!!d[k]} onChange={e => setD({ ...d, [k]: e.target.checked })} style={{ marginTop: 3 }} />
      <span><b>{label}</b><div style={{ fontSize: 12, color: COLOR.slate }}>{help}</div></span>
    </label>
  )
}

function Rules({ controls, isAdmin, who, onSaved }) {
  const [d, setD] = useState(controls), [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('fee_controls').update({ ...d, min_ref_length: Math.max(1, Number(d.min_ref_length) || 4), updated_by: who, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (error) alert('Could not save: ' + error.message); else onSaved()
  }
  return (
    <div style={{ ...card, display: 'grid', gap: 14, maxWidth: 720 }}>
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_digital_ref" label="UPI / cheque / bank transfer payments need a reference (FEE-002)" help="The cashier must enter the UPI / cheque / transaction number before saving." />
      <label><b>Minimum reference length</b>
        <input type="number" min="1" max="20" style={{ ...input, width: 90, display: 'block', marginTop: 4 }} disabled={!isAdmin} value={d.min_ref_length} onChange={e => setD({ ...d, min_ref_length: e.target.value })} /></label>
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="lock_closed_days" label="A closed day cannot be changed (FEE-001)" help="After Day Close is signed off, only an admin can record or change a payment dated that day — reopen the day first." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="require_revert_reason" label="Reverting a payment needs a reason (FEE-003)" help="At least 4 characters, recorded with the reversal." />
      <Toggle d={d} setD={setD} disabled={!isAdmin} k="enforce_in_database" label="Enforce in the database" help="Master switch. When on, the rules apply even to anything that bypasses this screen. Online (Razorpay) payments and the SQL editor are never blocked." />
      {isAdmin ? <div><button style={btnPrimary} disabled={busy} onClick={save}>Save rules</button></div> : <div style={{ fontSize: 12, color: COLOR.slate }}>Only an admin can change these rules.</div>}
    </div>
  )
}

export default function FeeControls({ students = [], isAdmin, currentUser }) {
  const [sub, setSub] = useState('health'), [period, setPeriod] = useState('90')
  const [data, setData] = useState(null), [err, setErr] = useState(''), [tick, setTick] = useState(0), [q, setQ] = useState('')
  const who = currentUser?.userName || currentUser?.name || 'Admin'
  const [from, to] = range(period)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const f = [['pay_date', 'gte', from], ['pay_date', 'lte', to]]
        const [adm, flat, crs, closes, refunds, ctl] = await Promise.all([
          fetchAll('adm_fee_collections', '*', f), fetchAll('adm_flat_fees', '*', f), fetchAll('adm_course_fees', '*', f),
          supabase.from('fee_day_close').select('*').gte('close_date', from).lte('close_date', to),
          supabase.from('fee_refunds').select('*').gte('created_at', from).limit(1000),
          supabase.from('fee_controls').select('*').eq('id', 1).maybeSingle(),
        ])
        if (!live) return
        setData({ rows: normaliseFeeRows(adm, flat, crs), closes: closes.data || [], refunds: refunds.data || [], controls: ctl.error || !ctl.data ? null : { ...FEE_CONTROL_DEFAULTS, ...ctl.data } })
        setErr('')
      } catch (e) { if (live) setErr(e.message || 'Could not load') }
    })()
    return () => { live = false }
  }, [from, to, tick])

  const nameOf = useMemo(() => { const m = new Map(students.map(s => [String(s.gcc_no), s.name])); return g => m.get(String(g)) || '—' }, [students])
  const checks = useMemo(() => data ? runFeeChecks(data, { serialReady: !!data.controls }) : [], [data])
  const series = useMemo(() => data ? receiptSeries(data.rows) : [], [data])
  const [open, setOpen] = useState(null)
  const flagged = useMemo(() => new Set(checks.filter(c => !c.aggregate).flatMap(c => c.rows.map(r => r.id))), [checks])
  const liveCount = data ? data.rows.filter(r => r.live).length : 0
  const numbered = series.filter(s => s.serial).length
  const found = q.trim() ? series.filter(s => `${s.serial} ${s.receipt} ${nameOf(s.gcc)} ${s.gcc}`.toLowerCase().includes(q.trim().toLowerCase())) : series

  const stats = data ? [
    { label: 'Receipts rows checked', value: liveCount },
    { label: 'With a finding', value: flagged.size, tone: flagged.size ? 'warn' : 'ok' },
    { label: 'High findings', value: checks.filter(c => c.severity === 'High').length, tone: checks.some(c => c.severity === 'High') ? 'bad' : 'ok' },
    { label: 'Receipts numbered', value: data.controls ? `${numbered}/${series.length}` : 'n/a' },
  ] : []
  const exportAll = () => csv(`fee-exceptions-${iso(new Date())}.csv`, [['Check', 'Severity', 'Date', 'Serial', 'Receipt', 'GCC', 'Student', 'Mode', 'Reference', 'By', 'Amount'],
    ...checks.filter(c => !c.aggregate).flatMap(c => c.rows.map(r => [`${c.code} ${c.title}`, c.severity, r.date, r.serial, r.receipt, r.gcc, nameOf(r.gcc), r.mode, r.ref, r.revertedBy || r.by, r.amount]))])

  if (!isAdmin) return <FeeTabShell title="Fee Controls"><div style={card}>Admins only.</div></FeeTabShell>
  return (
    <FeeTabShell title="Fee Controls" subtitle="Accounting checks for fee collection: payment references, closed days, reversals, refunds and the numbered receipt series." stats={stats}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['health', '🩺 Health check'], ['series', '🔢 Receipt series'], ['rules', '⚙️ Rules']].map(([k, l]) => <button key={k} style={pill(sub === k)} onClick={() => setSub(k)}>{l}</button>)}
        {sub !== 'rules' && <select style={{ ...input, marginLeft: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="month">This month</option><option value="last">Last month</option><option value="90">Last 90 days</option><option value="session">This session (Apr–Mar)</option><option value="all">All time</option></select>}
      </div>
      {err && <div style={{ ...card, color: COLOR.danger, marginBottom: 12 }}>{err}</div>}
      {!data && !err && <div style={card}>Loading…</div>}
      {data && !data.controls && (
        <div style={{ ...card, borderColor: '#f2c97d', background: '#fffaf0', marginBottom: 12 }}>
          <b>One-time database update needed for the numbered receipts and the rules.</b>
          <div style={{ fontSize: 13, color: COLOR.slate, marginTop: 4 }}>Run <code>supabase/migrations/{MIGRATION}</code> in the Supabase SQL editor. Until then collection works as before and the Health check below still runs.</div>
        </div>)}

      {data && sub === 'health' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!checks.length && <div style={{ ...card, color: '#067647', fontWeight: 700 }}>✅ No findings for this period.</div>}
          {checks.some(c => !c.aggregate) && <div><button style={btn} onClick={exportAll}>⬇ Export findings (CSV)</button></div>}
          {checks.map(c => (
            <div key={c.code} style={card}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(open === c.code ? null : c.code)}>
                <span style={{ background: SEV[c.severity][0], color: SEV[c.severity][1], borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{c.severity}</span>
                <b style={{ flex: 1, minWidth: 200 }}>{c.code} · {c.title}</b>
                <span style={{ color: COLOR.slate, fontSize: 13 }}>{c.rows.length} row{c.rows.length === 1 ? '' : 's'}{c.total ? ` · ${inr(c.total)}` : ''}</span><span>{open === c.code ? '▾' : '▸'}</span>
              </div>
              <div style={{ fontSize: 13, color: COLOR.slate, marginTop: 6 }}>{c.why}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}><b>Do:</b> {c.action}</div>
              {open === c.code && <div style={{ marginTop: 10 }}><Rows rows={[...c.rows].sort((a, b) => b.date.localeCompare(a.date))} nameOf={nameOf} /></div>}
            </div>))}
        </div>)}

      {data && sub === 'series' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!data.controls ? null : (
            <div style={{ ...card, fontSize: 13, color: COLOR.slate }}>
              Every receipt gets the next serial automatically, in one numbered series per financial year, with no gaps. Receipts issued before this was switched on can be numbered
              once with <code>select fee_backfill_receipt_serials();</code> in Supabase — run it before new receipts are issued so the old ones come first.
            </div>)}
          <input style={{ ...input, maxWidth: 420 }} placeholder="Search serial, receipt no., student or GCC…" value={q} onChange={e => setQ(e.target.value)} />
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['Serial', 'Receipt no.', 'Date', 'Student', 'Mode', 'Collected by', 'Amount'].map(h => <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{found.slice(0, 200).map(s => (
                <tr key={s.receipt}><td style={td}><b>{s.serial || '—'}</b></td><td style={td}>{s.receipt}</td><td style={td}>{s.date}</td>
                  <td style={td}>{nameOf(s.gcc)}<div style={{ fontSize: 11, color: COLOR.slate }}>GCC-{s.gcc}</div></td><td style={td}>{s.mode || '—'}</td><td style={td}>{s.by || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(s.amount)}</td></tr>))}
              </tbody>
            </table>
            {found.length > 200 && <div style={{ padding: 10, fontSize: 12, color: COLOR.slate }}>Showing 200 of {found.length}. Search or narrow the period.</div>}
            {!found.length && <div style={{ padding: 14, color: COLOR.slate }}>No receipts.</div>}
          </div>
        </div>)}

      {data && sub === 'rules' && (data.controls
        ? <Rules key={JSON.stringify(data.controls)} controls={data.controls} isAdmin={isAdmin} who={who} onSaved={() => setTick(t => t + 1)} />
        : <div style={card}>The rules appear here once the database update has been run.</div>)}
    </FeeTabShell>
  )
}

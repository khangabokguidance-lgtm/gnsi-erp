// FeeIncomeCollection.jsx — "Income vs Collection": why Accounts' Total Income and the fee tables' actual collection
// don't match for a period. Lists every receipt that is missing, deleted, pending, dated elsewhere or a different
// amount in Accounts — and every Accounts fee entry with no fee payment behind it. Read-only.
import { useEffect, useMemo, useState } from 'react'
import { fetchAll } from './duesSnapshot'
import { getSessionYear } from './feeEngine'
import { reconcileIncomeCollection } from './lib/incomeCollection'
import FeeTabShell from './FeeTabShell'
import { card, btn, btnPrimary, input, label as lbl, pill, th, td } from './feeTheme'
import { COLOR } from './ledgerTheme'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const iso = d => d.toLocaleDateString('en-CA')
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)) }
// Session year "2026-27" → 1 Apr 2026 … 31 Mar 2027.
const sessionRange = () => { const y = parseInt(String(getSessionYear()).slice(0, 4), 10) || new Date().getFullYear(); return [`${y}-04-01`, `${y + 1}-03-31`] }

const ISSUES = [
  { key: 'missing', title: 'Collected in Fees, never reached Accounts', tone: 'bad', help: 'The fee payment is saved but no income entry was written. Re-save the receipt or add the income entry by hand.', total: 'missing' },
  { key: 'deleted', title: 'Accounts entry was deleted', tone: 'bad', help: 'Someone deleted the income row in Accounts while the fee payment still stands.', total: 'deleted' },
  { key: 'pending', title: 'Waiting for approval in Accounts', tone: 'warn', help: 'The income row exists but is not Confirmed, so Total Income leaves it out.', total: 'pending' },
  { key: 'moved', title: 'Dated outside this period in Accounts', tone: 'warn', help: 'Counted, but in a different month/period than the fee payment date.', total: 'moved' },
  { key: 'mismatch', title: 'Different amount in Accounts', tone: 'bad', help: 'Same receipt, but Accounts holds a different amount than the fee table (difference shown).', total: 'mismatch' },
  { key: 'orphan', title: 'In Accounts as fee income, no fee payment behind it', tone: 'warn', help: 'Counted in Total Income but nothing in the fee tables matches — reverted payment, or a hand-keyed fee entry.', total: 'orphan' },
]

export default function FeeIncomeCollection() {
  const [[sFrom, sTo]] = useState(sessionRange)
  const [from, setFrom] = useState(sFrom)
  const [to, setTo] = useState(sTo)
  const [raw, setRaw] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)
  const [open, setOpen] = useState({})

  const [tick, setTick] = useState(0)   // bump to reload
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [acc, adm, flat, crs] = await Promise.all([
          fetchAll('accounts', 'id,type,category,amount,entry_date,payment_date,note,source_type,source_ref,status,is_soft_deleted', [['type', 'eq', 'Income']]),
          fetchAll('adm_fee_collections', 'amount_paid,receipt_no,student_name,adm_app_id,pay_date', [['reverted', 'eq', false]]),
          fetchAll('adm_flat_fees', 'amount,receipt_no,student_name,adm_app_id,pay_date', [['reverted', 'eq', false], ['paid', 'eq', true]]),
          fetchAll('adm_course_fees', 'amount_paid,receipt_no,student_name,adm_app_id,pay_date', [['reverted', 'eq', false]]),
        ])
        const feePayments = [...adm.map(r => ({ ...r, amount: r.amount_paid })), ...flat, ...crs.map(r => ({ ...r, amount: r.amount_paid }))]
        if (live) { setRaw({ accounts: acc, feePayments }); setErr('') }
      } catch (e) { if (live) setErr(e.message || 'Could not load') }
      if (live) setBusy(false)
    })()
    return () => { live = false }
  }, [tick])
  const load = () => { setBusy(true); setTick(t => t + 1) }

  const r = useMemo(() => raw ? reconcileIncomeCollection({ ...raw, from, to }) : null, [raw, from, to])
  const setPreset = p => { if (p === 'session') { setFrom(sFrom); setTo(sTo) } else if (p === 'month') { setFrom(monthStart()); setTo(iso(new Date())) } }

  const stats = r ? [
    { label: 'Accounts · Total Income', value: inr(r.accountsTotal) },
    { label: 'Fee tables · Collected', value: inr(r.feeTotal) },
    { label: 'Gap (Fees − Accounts fee income)', value: inr(r.gap), tone: Math.abs(r.gap) < 1 ? 'ok' : 'bad' },
  ] : []

  const exportCsv = () => {
    const rows = []
    for (const g of ISSUES) for (const x of r[g.key]) rows.push([g.title, x.receipt || '', x.name || '', x.gcc || '', x.date || '', x.fee ?? x.amount ?? '', x.accounts ?? '', x.diff ?? '', x.reason || ''])
    const q = v => `"${String(v).replace(/"/g, '""')}"`
    const text = '﻿' + [['Issue', 'Receipt', 'Student', 'GCC', 'Date', 'Fee amount', 'Accounts amount', 'Difference', 'Reason'], ...rows].map(a => a.map(q).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = `income-vs-collection_${from}_${to}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <FeeTabShell title="Income vs Collection" subtitle="Why Accounts' Total Income and the fees actually collected don't match — receipt by receipt." stats={stats}>
      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div><div style={lbl}>From</div><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={input} /></div>
        <div><div style={lbl}>To</div><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={input} /></div>
        <button type="button" style={pill(false)} onClick={() => setPreset('session')}>This session</button>
        <button type="button" style={pill(false)} onClick={() => setPreset('month')}>This month</button>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={load} disabled={busy}>{busy ? 'Loading…' : '↻ Refresh'}</button>
        {r && <button type="button" style={btnPrimary} onClick={exportCsv}>⬇ Export issues</button>}
      </div>
      {err && <div style={{ ...card, color: COLOR.danger, marginBottom: 14 }}>Could not load: {err}</div>}
      {!r && !err && <div style={{ ...card, color: COLOR.slate }}>Loading income and fee records…</div>}
      {r && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 8 }}>How the two totals line up</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <Row k="Fee tables · actual collection (admission + flat + course)" v={r.feeTotal} sub={`${r.feeCount} payments`} bold />
              <Row k="− Fee income inside Accounts (confirmed)" v={-r.accountsFee} />
              <Row k="= Gap to explain" v={r.gap} bold line />
              <Row k="  Never reached Accounts" v={r.totals.missing} />
              <Row k="  Accounts entry deleted" v={r.totals.deleted} />
              <Row k="  Waiting for approval" v={r.totals.pending} />
              <Row k="  Dated outside the period" v={r.totals.moved} />
              <Row k="  Payments with no receipt number" v={r.noReceipt.total} />
              <Row k="  Accounts holds a different amount (Accounts − Fees)" v={-r.totals.mismatch} />
              <Row k="  Accounts fee entries with no fee payment" v={-r.totals.orphan} />
              <Row k="Plus income that is not fees (store / manual / other)" v={r.accountsOther} sub={`store ${inr(r.split.store)} · manual ${inr(r.split.manual)} · other ${inr(r.split.other)}`} line />
              <Row k="= Accounts · Total Income" v={r.accountsTotal} bold />
            </tbody>
          </table>
          {r.pendingAllCount > 0 && <div style={{ fontSize: 12, color: COLOR.warn, marginTop: 8 }}>{r.pendingAllCount} income row(s) worth {inr(r.pendingAllTotal)} are not Confirmed and are left out of Accounts' Total Income.</div>}
        </div>
        {ISSUES.map(g => {
          const rows = r[g.key], on = !!open[g.key], color = rows.length === 0 ? COLOR.ok : g.tone === 'bad' ? COLOR.danger : COLOR.warn
          return (
            <div key={g.key} style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 10 }}>
              <button type="button" disabled={!rows.length} onClick={() => setOpen(o => ({ ...o, [g.key]: !on }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 0, background: 'transparent', cursor: rows.length ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>{g.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: COLOR.slate, marginTop: 1 }}>{rows.length ? g.help : 'Nothing found ✓'}</span>
                </span>
                <span style={{ fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{rows.length ? `${rows.length} · ${inr(Math.abs(r.totals[g.total]))}` : '0'}</span>
                {rows.length > 0 && <span style={{ color: COLOR.slate }}>{on ? '▾' : '▸'}</span>}
              </button>
              {on && rows.length > 0 && (
                <div style={{ overflowX: 'auto', borderTop: `1px solid ${COLOR.rule}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead><tr>{['Receipt', 'Student', 'Date', 'Amount', 'Why'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{rows.slice(0, 200).map((x, i) => (
                      <tr key={i}>
                        <td style={td}>{x.receipt || '—'}</td>
                        <td style={td}>{x.name || x.note || '—'}{x.gcc ? <span style={{ color: COLOR.slate }}> · {x.gcc}</span> : null}</td>
                        <td style={td}>{x.date || '—'}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{g.key === 'mismatch' ? `${inr(x.fee)} → ${inr(x.accounts)}` : inr(x.fee ?? x.amount)}</td>
                        <td style={{ ...td, color: COLOR.slate }}>{x.reason || (x.diff < 0 ? 'Accounts holds less' : 'Accounts holds more')}</td>
                      </tr>))}
                    </tbody>
                  </table>
                  {rows.length > 200 && <div style={{ padding: 10, fontSize: 12, color: COLOR.slate }}>Showing the first 200 of {rows.length} — use Export issues for all.</div>}
                </div>
              )}
            </div>
          )
        })}
      </>)}
    </FeeTabShell>
  )
}

function Row({ k, v, sub, bold, line }) {
  return (
    <tr style={{ borderTop: line ? `1px solid ${COLOR.rule}` : 'none' }}>
      <td style={{ padding: '5px 0', fontWeight: bold ? 800 : 500, color: COLOR.ink2 }}>{k}{sub && <div style={{ fontSize: 11, color: COLOR.slate, fontWeight: 400 }}>{sub}</div>}</td>
      <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: bold ? 800 : 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v < 0 ? '−' : ''}{inr(Math.abs(v))}</td>
    </tr>
  )
}

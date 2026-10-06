// FeeDayClose.jsx — daily collection closing / cash reconciliation.
// Reads the day's receipts from the three fee tables (read-only) and stores one
// closing per date in fee_day_close (migration 20261009_fee_dayclose_refunds_register.sql).
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_day_close/.test(err.message || ''))
const SETUP_MSG = 'Run supabase/migrations/20261009_fee_dayclose_refunds_register.sql in the Supabase SQL editor to switch on day closing.'
const n = v => Number(v || 0).toLocaleString('en-IN')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const modeOf = r => String(r.pay_mode || '').trim() || 'Unspecified'
const isCash = m => m.toLowerCase() === 'cash'
const dayOf = v => String(v || '').slice(0, 10)

// Normalise the three fee tables into one list of receipts.
function allReceipts(adm, flat, crs) {
  const out = []
  ;(adm || []).forEach(r => { if (!r.reverted) out.push({ date: dayOf(r.pay_date), amount: Number(r.amount_paid) || 0, mode: modeOf(r), by: String(r.collected_by || '').trim() || 'Unknown' }) })
  ;(flat || []).forEach(r => { if (r.paid && !r.reverted) out.push({ date: dayOf(r.pay_date), amount: Number(r.amount) || 0, mode: modeOf(r), by: String(r.collected_by || '').trim() || 'Unknown' }) })
  ;(crs || []).forEach(r => { if (!r.reverted) out.push({ date: dayOf(r.pay_date), amount: Number(r.amount_paid) || 0, mode: modeOf(r), by: String(r.collected_by || '').trim() || 'Unknown' }) })
  return out.filter(r => r.date && r.amount > 0)
}

function downloadCsv(rows, filename) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(a.href)
}

const card = { background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }
const inp = { padding: '8px 10px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
const btn = { padding: '8px 14px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
const btnPrimary = { ...btn, background: '#1e3a6e', color: 'white', border: '1px solid #1e3a6e' }
const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }

function Chip({ diff }) {
  const d = Number(diff || 0)
  const ok = d === 0
  return <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>{ok ? 'Tallied' : `${d > 0 ? '+' : '−'}₹${n(Math.abs(d))}`}</span>
}

export default function FeeDayClose({ adm_fee_collections, adm_flat_fees, adm_course_fees, isAdmin, currentUser }) {
  const today = todayISO()
  const me = currentUser?.userName || currentUser?.name || 'Staff'
  const [date, setDate] = useState(today)
  const [history, setHistory] = useState([])
  const [setup, setSetup] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [tick, setTick] = useState(0)
  const [cashCounted, setCashCounted] = useState('')
  const [otherCounted, setOtherCounted] = useState({})
  const [note, setNote] = useState('')
  const [userCash, setUserCash] = useState({})      // collector -> cash handed in (₹)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let on = true
    supabase.from('fee_day_close').select('*').order('close_date', { ascending: false }).limit(90).then(({ data, error }) => {
      if (!on) return
      if (error) { setSetup(missingTable(error)); setLoadErr(missingTable(error) ? '' : error.message); setHistory([]); return }
      setSetup(false); setLoadErr(''); setHistory(data || [])
    })
    return () => { on = false }
  }, [tick])

  const receipts = useMemo(() => allReceipts(adm_fee_collections, adm_flat_fees, adm_course_fees), [adm_fee_collections, adm_flat_fees, adm_course_fees])
  const day = useMemo(() => {
    const byMode = {}, byUser = {}
    let total = 0, count = 0
    receipts.filter(r => r.date === date).forEach(r => {
      total += r.amount; count++
      byMode[r.mode] = byMode[r.mode] || { amount: 0, count: 0 }; byMode[r.mode].amount += r.amount; byMode[r.mode].count++
      byUser[r.by] = byUser[r.by] || { amount: 0, count: 0, cash: 0 }; byUser[r.by].amount += r.amount; byUser[r.by].count++
      if (isCash(r.mode)) byUser[r.by].cash += r.amount
    })
    return { byMode, byUser, total, count }
  }, [receipts, date])

  // When any collector's handed-in cash is entered, the counted total is their sum.
  const anyUser = Object.values(userCash).some(v => String(v ?? '').trim() !== '')
  const userSum = Object.values(userCash).reduce((t, v) => t + (Number(v) || 0), 0)
  const cashVal = anyUser ? String(Math.round(userSum * 100) / 100) : cashCounted
  const recordedCash = Object.entries(day.byMode).reduce((t, [m, v]) => t + (isCash(m) ? v.amount : 0), 0)
  const existing = history.find(h => dayOf(h.close_date) === date)
  const isClosed = existing && existing.status === 'closed'
  const hasCount = String(cashVal).trim() !== ''
  const diff = hasCount ? Math.round((Number(cashVal) - recordedCash) * 100) / 100 : 0
  const nonCashModes = Object.keys(day.byMode).filter(m => !isCash(m))

  // Earlier days (last 30) that have collections but no closing.
  const unclosed = useMemo(() => {
    if (setup) return 0
    const closed = new Set(history.filter(h => h.status === 'closed').map(h => dayOf(h.close_date)))
    const from = new Date(); from.setDate(from.getDate() - 30)
    const fromISO = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
    const days = new Set(receipts.filter(r => r.date >= fromISO && r.date < today).map(r => r.date))
    return [...days].filter(d => !closed.has(d)).length
  }, [receipts, history, today, setup])

  const canSave = !isClosed && hasCount && Number(cashVal) >= 0 && (diff === 0 || note.trim().length >= 5) && !busy

  const save = async () => {
    setBusy(true); setMsg(null)
    const recorded = Object.fromEntries(Object.entries(day.byMode).map(([m, v]) => [m, v.amount]))
    const counted = { Cash: Number(cashVal) }
    if (anyUser) counted.by_user = Object.fromEntries(Object.entries(userCash).filter(([, v]) => String(v ?? '').trim() !== '').map(([u, v]) => [u, Number(v)]))
    nonCashModes.forEach(m => { if (String(otherCounted[m] ?? '').trim() !== '') counted[m] = Number(otherCounted[m]) })
    const row = { recorded, counted, difference: diff, note: note.trim() || null, closed_by: me, status: 'closed' }
    const { error } = existing
      ? await supabase.from('fee_day_close').update(row).eq('id', existing.id)
      : await supabase.from('fee_day_close').insert({ close_date: date, ...row })
    setBusy(false)
    if (error) { setMsg({ bad: true, t: missingTable(error) ? SETUP_MSG : error.code === '23505' ? 'This date was already closed by someone else — refresh.' : error.message }); return }
    setMsg({ t: `Day ${date} closed.` }); setCashCounted(''); setUserCash({}); setOtherCounted({}); setNote(''); setTick(t => t + 1)
  }

  const reopen = async h => {
    const reason = window.prompt(`Reopen ${dayOf(h.close_date)}? Enter a reason (min 5 characters):`)
    if (reason === null) return
    if (reason.trim().length < 5) { setMsg({ bad: true, t: 'Reopen reason must be at least 5 characters.' }); return }
    const { error } = await supabase.from('fee_day_close').update({ status: 'reopened', reopened_by: me, reopen_reason: reason.trim() }).eq('id', h.id)
    if (error) { setMsg({ bad: true, t: error.message }); return }
    setMsg({ t: `Day ${dayOf(h.close_date)} reopened.` }); setTick(t => t + 1)
  }

  const printSheet = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) { setMsg({ bad: true, t: 'Allow popups to print the sheet.' }); return }
    const modeRows = Object.entries(day.byMode).map(([m, v]) => `<tr><td>${esc(m)}</td><td class="r">${v.count}</td><td class="r">₹${n(v.amount)}</td></tr>`).join('')
    const userRows = Object.entries(day.byUser).map(([u, v]) => `<tr><td>${esc(u)}</td><td class="r">${v.count}</td><td class="r">₹${n(v.cash)}</td><td class="r">₹${n(v.amount)}</td></tr>`).join('')
    const c = existing && existing.status === 'closed' ? existing : null
    const cashC = c ? Number(c.counted?.Cash ?? 0) : hasCount ? Number(cashVal) : null
    const d = c ? Number(c.difference || 0) : hasCount ? diff : null
    w.document.write(`<!doctype html><html><head><title>Day closing ${esc(date)}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#14213d;font-size:13px}h1{font-size:18px;color:#1e3a6e;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin:10px 0 18px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f0e8;font-size:11px;text-transform:uppercase}.r{text-align:right}
      .sig{display:flex;justify-content:space-between;margin-top:60px}.sig div{border-top:1px solid #333;padding-top:4px;width:40%;text-align:center;font-size:11px}</style></head><body>
      <h1>Day closing sheet</h1><div>Date: <b>${esc(date)}</b> &nbsp; Printed: ${esc(new Date().toLocaleString('en-IN'))}</div>
      <h3>By payment mode</h3><table><tr><th>Mode</th><th class="r">Receipts</th><th class="r">Amount</th></tr>${modeRows || '<tr><td colspan="3">No receipts</td></tr>'}
      <tr><th>Total</th><th class="r">${day.count}</th><th class="r">₹${n(day.total)}</th></tr></table>
      <h3>By collector</h3><table><tr><th>Collector</th><th class="r">Receipts</th><th class="r">Cash</th><th class="r">Total</th></tr>${userRows || '<tr><td colspan="4">No receipts</td></tr>'}</table>
      <table><tr><th>Recorded cash</th><th>Counted cash</th><th>Difference</th></tr><tr><td>₹${n(recordedCash)}</td><td>${cashC === null ? '—' : '₹' + n(cashC)}</td><td>${d === null ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + '₹' + n(Math.abs(d))}</td></tr></table>
      <div>Note: ${esc(c ? c.note : note) || '—'}</div>
      <div class="sig"><div>Cashier${c ? ' (' + esc(c.closed_by) + ')' : ''}</div><div>Verified by</div></div>
      <script>window.onload=function(){window.print()}</script></body></html>`)
    w.document.close()
  }

  const exportHistory = () => downloadCsv(history.slice(0, 30).map(h => ({
    date: dayOf(h.close_date), status: h.status, recorded_total: Object.values(h.recorded || {}).reduce((t, v) => t + Number(v || 0), 0),
    recorded_cash: Number(h.recorded?.Cash || 0), counted_cash: Number(h.counted?.Cash ?? 0), difference: Number(h.difference || 0),
    note: h.note || '', closed_by: h.closed_by || '', reopened_by: h.reopened_by || '', reopen_reason: h.reopen_reason || '',
  })), 'fee_day_closings')

  return (
    <div>
      {setup && <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠ {SETUP_MSG}</div>}
      {loadErr && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load closings: {loadErr}</div>}
      {unclosed > 0 && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⚠ {unclosed} earlier day{unclosed > 1 ? 's' : ''} (last 30) {unclosed > 1 ? 'have' : 'has'} collections but no closing.</div>}
      {msg && <div style={{ background: msg.bad ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.bad ? '#fecaca' : '#bbf7d0'}`, color: msg.bad ? '#991b1b' : '#166534', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{msg.t}</div>}

      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a6e' }}>🧾 Day closing</div>
            <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>Match the cash in hand with what the system recorded for the day</div>
          </div>
          <input type="date" value={date} max={today} onChange={e => { if (e.target.value && e.target.value <= today) { setDate(e.target.value); setMsg(null); setUserCash({}) } }} style={inp} />
          <button onClick={printSheet} style={btn}>🖨 Day closing sheet</button>
        </div>

        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {[{ l: 'Recorded total', v: `₹${n(day.total)}`, c: '#1e3a6e' }, { l: 'Receipts', v: day.count, c: '#1e3a6e' }, { l: 'Recorded cash', v: `₹${n(recordedCash)}`, c: '#166534' }, { l: 'Non-cash', v: `₹${n(day.total - recordedCash)}`, c: '#4b5870' }].map(k => (
            <div key={k.l} style={{ background: '#faf8f3', border: '1px solid #e8e3d8', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: k.c, marginTop: 2 }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, padding: '0 16px 16px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={head}>Mode</th><th style={{ ...head, textAlign: 'right' }}>Receipts</th><th style={{ ...head, textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {Object.entries(day.byMode).map(([m, v]) => <tr key={m}><td style={cell}>{m}</td><td style={{ ...cell, textAlign: 'right' }}>{v.count}</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>₹{n(v.amount)}</td></tr>)}
                {day.count === 0 && <tr><td colSpan={3} style={{ ...cell, color: '#8a93a6', textAlign: 'center' }}>No receipts on this date</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={head}>Collector</th><th style={{ ...head, textAlign: 'right' }}>Receipts</th><th style={{ ...head, textAlign: 'right' }}>Cash</th><th style={{ ...head, textAlign: 'right' }}>Total</th><th style={{ ...head, textAlign: 'right' }}>Cash handed in</th></tr></thead>
              <tbody>
                {Object.entries(day.byUser).map(([u, v]) => <tr key={u}><td style={cell}>{u}</td><td style={{ ...cell, textAlign: 'right' }}>{v.count}</td><td style={{ ...cell, textAlign: 'right' }}>₹{n(v.cash)}</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>₹{n(v.amount)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {isClosed
                      ? (existing.counted?.by_user && existing.counted.by_user[u] != null ? <>₹{n(existing.counted.by_user[u])} <Chip diff={existing.counted.by_user[u] - v.cash} /></> : '—')
                      : <><input type="number" min="0" placeholder="₹" value={userCash[u] ?? ''} onChange={e => setUserCash(c => ({ ...c, [u]: e.target.value }))} style={{ ...inp, width: 96, padding: '4px 8px', textAlign: 'right' }} />
                          {String(userCash[u] ?? '').trim() !== '' && <span style={{ marginLeft: 6 }}><Chip diff={Math.round((Number(userCash[u]) - v.cash) * 100) / 100} /></span>}</>}
                  </td></tr>)}
                {day.count === 0 && <tr><td colSpan={5} style={{ ...cell, color: '#8a93a6', textAlign: 'center' }}>—</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e8e3d8', background: '#fcfbf7' }}>
          {isClosed ? (
            <div style={{ fontSize: 13, color: '#166534', fontWeight: 700 }}>
              ✓ Closed by {existing.closed_by || '—'} · counted cash ₹{n(existing.counted?.Cash)} · <Chip diff={existing.difference} />
              {existing.note && <span style={{ color: '#4b5870', fontWeight: 500 }}> · “{existing.note}”</span>}
            </div>
          ) : (
            <>
              {existing && <div style={{ fontSize: 12, color: '#b45309', marginBottom: 8 }}>This day was reopened by {existing.reopened_by} ({existing.reopen_reason}) — close it again below.</div>}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#5d6b82' }}>Cash counted in hand (₹)
                  <input type="number" min="0" value={cashVal} readOnly={anyUser} title={anyUser ? 'Sum of the per-collector amounts above' : ''} onChange={e => setCashCounted(e.target.value)} style={{ ...inp, display: 'block', width: 170, marginTop: 4, background: anyUser ? '#f3f0e8' : undefined }} />
                </label>
                {nonCashModes.map(m => (
                  <label key={m} style={{ fontSize: 11, fontWeight: 700, color: '#5d6b82' }}>{m} statement (optional)
                    <input type="number" min="0" value={otherCounted[m] ?? ''} onChange={e => setOtherCounted(o => ({ ...o, [m]: e.target.value }))} style={{ ...inp, display: 'block', width: 150, marginTop: 4 }} />
                  </label>
                ))}
                {hasCount && <div style={{ fontSize: 14, fontWeight: 900, color: diff === 0 ? '#166534' : '#dc2626', paddingBottom: 8 }}>Difference: {diff === 0 ? '₹0 ✓' : `${diff > 0 ? '+' : '−'}₹${n(Math.abs(diff))}`}</div>}
              </div>
              {hasCount && diff !== 0 && (
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Why does the cash not match? (required, min 5 characters)" style={{ ...inp, width: '100%', marginTop: 10, borderColor: note.trim().length >= 5 ? '#d9d2c2' : '#fca5a5' }} />
              )}
              {hasCount && diff === 0 && <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" style={{ ...inp, width: '100%', marginTop: 10 }} />}
              <button onClick={save} disabled={!canSave || setup} style={{ ...btnPrimary, marginTop: 12, opacity: canSave && !setup ? 1 : .5, cursor: canSave && !setup ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : `Close day ${date}`}</button>
            </>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Recent closings (last 30)</div>
          <button onClick={exportHistory} disabled={!history.length} style={btn}>⬇ CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Status', 'Recorded', 'Counted cash', 'Difference', 'Closed by', 'Note', ''].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
            <tbody>
              {history.slice(0, 30).map(h => (
                <tr key={h.id}>
                  <td style={{ ...cell, fontWeight: 700 }}><a href="#day" onClick={e => { e.preventDefault(); setDate(dayOf(h.close_date)); setMsg(null) }} style={{ color: '#1e3a6e' }}>{dayOf(h.close_date)}</a></td>
                  <td style={cell}>{h.status === 'closed' ? 'Closed' : <span style={{ color: '#b45309', fontWeight: 700 }} title={h.reopen_reason || ''}>Reopened</span>}</td>
                  <td style={cell}>₹{n(Object.values(h.recorded || {}).reduce((t, v) => t + Number(v || 0), 0))}</td>
                  <td style={cell}>₹{n(h.counted?.Cash)}</td>
                  <td style={cell}><Chip diff={h.difference} /></td>
                  <td style={cell}>{h.closed_by || '—'}</td>
                  <td style={{ ...cell, whiteSpace: 'normal', maxWidth: 260, color: '#4b5870' }}>{h.note || '—'}</td>
                  <td style={cell}>{isAdmin && h.status === 'closed' && <button onClick={() => reopen(h)} style={{ ...btn, padding: '4px 10px', fontSize: 11.5 }}>Reopen</button>}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', color: '#8a93a6', padding: 24 }}>No closings yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// LowFeeApprovals.jsx — admin screen for fees collected below the standard
// rate: approve (waive the shortfall) or reject (it stays due), see who gives
// low fees and why, and scan the ledgers for short payments with no reason
// on file.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadConcessions, decideConcession, recordConcession, summarise, unexplainedShortPayments, CONCESSION_REASONS, CONCESSIONS_SETUP_MSG } from './feeConcessions'
import { buildAllLedgers } from './feeLedgerBulk'
import { getSessionYear, gccStr } from './feeEngine'
import { LedgerLink } from './LedgerLinks'
import { HOSTEL_MISMATCH_REASON } from './hostelFeeCheck'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const TONE = { pending: ['#9a5b00', '#fff4dc'], approved: ['#146c3a', '#e7f6ec'], rejected: ['#b42318', '#fde8e6'] }
const card = { background: '#fff', border: '1px solid #e8e3d8', borderRadius: 14, padding: 16, marginBottom: 14 }
const chip = on => ({ padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? '#1e3a6e' : '#d8dfec'}`, background: on ? '#1e3a6e' : '#fff', color: on ? '#fff' : '#1e3a6e', fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const inp = { border: '1px solid #d8dfec', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', minWidth: 0 }
const btn = (bg, color = '#fff') => ({ padding: '6px 12px', borderRadius: 8, border: 'none', background: bg, color, fontWeight: 800, fontSize: 12, cursor: 'pointer' })

function Breakdown({ title, rows, label }) {
  return (
    <div style={{ ...card, margin: 0, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5d6b82', background: '#f8fafc' }}>{title}</div>
      {rows.length === 0 ? <div style={{ padding: 14, color: '#98a2b3', fontSize: 12.5 }}>Nothing yet.</div> : rows.slice(0, 8).map(r => (
        <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: 12.5 }}>
          <span>{label ? label(r) : r.key} <span style={{ color: '#98a2b3' }}>· {r.count}{r.pending ? ` · ${r.pending} pending` : ''}</span></span>
          <b style={{ color: '#b42318', whiteSpace: 'nowrap' }}>{inr(r.total)}</b>
        </div>
      ))}
    </div>
  )
}

export default function LowFeeApprovals({ students = [], adm_fee_collections = [], adm_flat_fees = [], adm_course_fees = [], isAdmin, currentUser, onChanged }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('pending')
  const [reason, setReason] = useState('All')
  const [staff, setStaff] = useState('All')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(null)
  const [scan, setScan] = useState(null)       // null | 'running' | { items, error }
  const [draft, setDraft] = useState({})       // unexplained row key -> reason
  const me = currentUser?.name || currentUser?.userName || 'Admin'

  const reload = useCallback(() => { loadConcessions().then(setData); onChanged?.() }, [onChanged])
  useEffect(() => { let live = true; loadConcessions().then(d => { if (live) setData(d) }); return () => { live = false } }, [])

  const rows = useMemo(() => data?.rows || [], [data])
  const sum = useMemo(() => summarise(rows), [rows])
  const staffList = useMemo(() => [...new Set(rows.map(r => r.collected_by).filter(Boolean))].sort(), [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter(r => (status === 'All' || r.status === status) && (reason === 'All' || r.reason === reason) && (staff === 'All' || r.collected_by === staff)
      && (!from || String(r.pay_date || r.created_at).slice(0, 10) >= from) && (!to || String(r.pay_date || r.created_at).slice(0, 10) <= to)
      && (!t || [r.student_name, r.gcc, r.receipt_no, r.reason_note, r.collected_by].some(v => String(v || '').toLowerCase().includes(t))))
  }, [rows, status, reason, staff, q, from, to])

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: '#8a93a6' }}>🔒 Admin only</div>

  const mismatchCount = rows.filter(r => r.reason === HOSTEL_MISMATCH_REASON && r.status === 'pending').length

  const decide = async (c, approve) => {
    const note = window.prompt(approve
      ? `Approve ${inr(c.shortfall)} concession for ${c.student_name || 'GCC-' + c.gcc} (${c.month || ''} ${c.year || ''})?\n\nThe shortfall will be waived. Note (optional):`
      : `Reject the ${inr(c.shortfall)} low fee for ${c.student_name || 'GCC-' + c.gcc}?\n\nThe shortfall stays due and should be collected. Reason (optional):`, '')
    if (note === null) return
    setBusy(c.id)
    try { await decideConcession(c, approve, { by: me, note }); reload() } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const runScan = async () => {
    setScan('running')
    try {
      const group = (list, keep) => { const m = new Map(); for (const r of list) { if (!keep(r)) continue; const g = gccStr(r.adm_app_id); if (!m.has(g)) m.set(g, []); m.get(g).push(r) } return m }
      const feeRows = { adm: group(adm_fee_collections, r => !r.reverted), flat: group(adm_flat_fees, r => r.paid && !r.reverted), crs: group(adm_course_fees, r => !r.reverted) }
      const active = students.filter(s => !s.deleted_at && (!s.status || s.status === 'Active'))
      const items = await buildAllLedgers(active, getSessionYear(), { rows: feeRows })
      setScan({ items: unexplainedShortPayments(items, rows) })
    } catch (e) { setScan({ items: [], error: e.message }) }
  }

  const settleUnexplained = async (u, approve) => {
    const key = `${u.student.gcc_no}|${u.month}|${u.year}`
    const why = draft[key]
    if (!why) { alert('Choose a reason first.'); return }
    const p = u.payment
    setBusy(key)
    const c = await recordConcession({
      table: p.kind === 'flat' ? 'adm_flat_fees' : 'adm_course_fees', rowId: p.rowId, kind: p.kind, gcc: u.student.gcc_no, studentName: u.student.name,
      month: u.month, year: u.year, course: u.student.course, standard: u.expected, collected: u.paid, reason: why, note: 'Recorded on review',
      receiptNo: p.receipt, payDate: p.date, collectedBy: p.by, approvedBy: approve ? me : null,
    })
    if (c && !approve) { try { await decideConcession(c, false, { by: me, note: 'Kept due on review' }) } catch (e) { alert(e.message) } }
    if (!c) alert(CONCESSIONS_SETUP_MSG)
    setScan(sc => sc && sc.items ? { ...sc, items: sc.items.filter(x => x !== u) } : sc)
    setBusy(null); reload()
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#1f2a44' }}>
      <div style={{ ...card, background: 'linear-gradient(135deg,#0B1E3D,#1d3a78)', color: '#fff', border: 'none' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>🔎 Low-fee approvals &amp; investigation</div>
        <div style={{ fontSize: 12.5, opacity: .8, marginTop: 4 }}>Every flat/course fee collected below its standard (Fee Setup) rate. Approve to waive the shortfall, reject to keep it due.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
          {[['Pending', sum.pending, '#FCD34D'], ['Approved (waived)', sum.approved, '#86EFAC'], ['Rejected (still due)', sum.rejected, '#FCA5A5']].map(([l, v, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .7 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 3 }}>{inr(v.total)}</div>
              <div style={{ fontSize: 11, opacity: .7 }}>{v.count} entr{v.count === 1 ? 'y' : 'ies'}</div>
            </div>
          ))}
        </div>
      </div>

      {data?.setupNeeded && <div style={{ ...card, background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412', fontSize: 13 }}>⚙️ {CONCESSIONS_SETUP_MSG}</div>}
      {data?.error && <div style={{ ...card, color: '#b42318' }}>Could not load: {data.error}</div>}

      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {[['pending', `Pending (${sum.pending.count})`], ['approved', 'Approved'], ['rejected', 'Rejected'], ['All', 'All']].map(([k, l]) => <button key={k} style={chip(status === k)} onClick={() => setStatus(k)}>{l}</button>)}
          <button style={{ ...chip(reason === HOSTEL_MISMATCH_REASON), marginLeft: 'auto' }} onClick={() => setReason(r => r === HOSTEL_MISMATCH_REASON ? 'All' : HOSTEL_MISMATCH_REASON)}>🏠 Wrong hostel type{mismatchCount ? ` (${mismatchCount} pending)` : ''}</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select style={inp} value={reason} onChange={e => setReason(e.target.value)} aria-label="Filter by reason"><option>All</option>{CONCESSION_REASONS.map(r => <option key={r}>{r}</option>)}</select>
          <select style={inp} value={staff} onChange={e => setStaff(e.target.value)} aria-label="Filter by staff"><option value="All">All staff</option>{staffList.map(s => <option key={s}>{s}</option>)}</select>
          <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} aria-label="From" />
          <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} aria-label="To" />
          <input style={{ ...inp, flex: '1 1 180px' }} placeholder="Student, GCC, receipt, staff, note…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search low fees" />
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {!data && <div style={{ padding: 20, color: '#64748b' }}>Loading…</div>}
        {data && shown.length === 0 && <div style={{ padding: 20, color: '#64748b', textAlign: 'center' }}>{status === 'pending' ? '🎉 Nothing waiting for approval.' : 'No entries match.'}</div>}
        {shown.map(c => (
          <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ minWidth: 220, flex: '2 1 260px' }}>
              <div style={{ fontWeight: 800 }}><LedgerLink gcc={c.gcc}>{c.student_name || `GCC-${c.gcc}`}</LedgerLink> <span style={{ color: '#98a2b3', fontWeight: 600, fontSize: 12 }}>GCC-{c.gcc} · {c.fee_kind === 'flat' ? 'Flat fee' : `Course fee${c.course ? ' — ' + c.course : ''}`} · {c.month} {c.year}</span></div>
              <div style={{ fontSize: 12.5, marginTop: 3 }}>{c.reason === HOSTEL_MISMATCH_REASON && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 999, padding: '1px 8px', marginRight: 6 }}>🏠 WRONG HOSTEL TYPE</span>}<b>{c.reason}</b>{c.reason_note ? ` — ${c.reason_note}` : ''}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Collected by {c.collected_by || '—'} · {fmtD(c.pay_date || c.created_at)}{c.receipt_no ? ` · ${c.receipt_no}` : ''}{c.decided_by ? ` · ${c.status} by ${c.decided_by}${c.decision_note ? ` (“${c.decision_note}”)` : ''}` : ''}</div>
            </div>
            <div style={{ fontSize: 12.5, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div>Standard {inr(c.standard_amount)} · Collected {inr(c.collected_amount)}</div>
              <div style={{ fontWeight: 800, color: '#b42318' }}>Short {inr(c.shortfall)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: TONE[c.status][0], background: TONE[c.status][1] }}>{c.status.toUpperCase()}</span>
              {c.status !== 'approved' && <button disabled={busy === c.id} style={btn('#146c3a')} onClick={() => decide(c, true)}>Approve</button>}
              {c.status !== 'rejected' && <button disabled={busy === c.id} style={btn('#fff', '#b42318')} onClick={() => decide(c, false)}>Reject</button>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 12, marginBottom: 14 }}>
        <Breakdown title="By staff who collected" rows={sum.byStaff} />
        <Breakdown title="By reason" rows={sum.byReason} />
        <Breakdown title="Students given low fees more than once" rows={sum.repeat} label={r => { const [gcc, name] = r.key.split('|'); return <LedgerLink gcc={gcc}>{name || `GCC-${gcc}`}</LedgerLink> }} />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Short payments with no reason on file</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Checks this session's ledgers for months paid below the standard rate that were never explained (e.g. collected before approvals existed).</div>
          </div>
          <button style={btn('#1e3a6e')} onClick={runScan} disabled={scan === 'running'}>{scan === 'running' ? 'Scanning…' : '🔍 Scan ledgers'}</button>
        </div>
        {scan && scan !== 'running' && (
          <div style={{ marginTop: 12 }}>
            {scan.error && <div style={{ color: '#b42318' }}>{scan.error}</div>}
            {!scan.error && scan.items.length === 0 && <div style={{ color: '#146c3a', fontWeight: 700 }}>✓ Every short payment this session has a reason on file.</div>}
            {scan.items.map(u => {
              const key = `${u.student.gcc_no}|${u.month}|${u.year}`
              return (
                <div key={key} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ flex: '2 1 240px' }}>
                    <b><LedgerLink gcc={u.student.gcc_no}>{u.student.name}</LedgerLink></b> <span style={{ color: '#98a2b3', fontSize: 12 }}>GCC-{u.student.gcc_no} · {u.head} · {u.month} {u.year}</span>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Paid {inr(u.paid)} of {inr(u.expected)} · by {u.payment.by || '—'} · {fmtD(u.payment.date)}{u.payment.receipt ? ` · ${u.payment.receipt}` : ''}</div>
                  </div>
                  <b style={{ color: '#b42318' }}>Short {inr(u.shortBy)}</b>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select style={inp} value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} aria-label={`Reason for ${u.student.name} ${u.month}`}><option value="">— Reason —</option>{CONCESSION_REASONS.map(r => <option key={r}>{r}</option>)}</select>
                    <button disabled={busy === key} style={btn('#146c3a')} onClick={() => settleUnexplained(u, true)}>Approve</button>
                    <button disabled={busy === key} style={btn('#fff', '#b42318')} onClick={() => settleUnexplained(u, false)}>Keep due</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

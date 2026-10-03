// FeeRefunds.jsx — refund / transfer / write-off requests for students who leave or overpay.
// RECORD ONLY: this never edits fee rows. Table fee_refunds
// (migration 20261009_fee_dayclose_refunds_register.sql).
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { CONCESSION_SELF_APPROVE_LIMIT, isSoleAdmin } from './feeConcessions'

const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_refunds/.test(err.message || ''))
const SETUP_MSG = 'Run supabase/migrations/20261009_fee_dayclose_refunds_register.sql in the Supabase SQL editor to switch on refunds.'
const n = v => Number(v || 0).toLocaleString('en-IN')
const KINDS = ['Refund to parent', 'Adjust to sibling GCC', 'Carry credit to next session', 'Write-off dues']
const MODES = ['Cash', 'UPI', 'Bank']
const STATUS_STYLE = { pending: ['#fef9c3', '#854d0e'], approved: ['#dbeafe', '#1e40af'], paid: ['#dcfce7', '#166534'], rejected: ['#fee2e2', '#991b1b'] }
const same = (a, b) => !!String(a || '').trim() && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

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
const inp = { padding: '8px 10px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', width: '100%' }
const lbl = { fontSize: 11, fontWeight: 700, color: '#5d6b82', display: 'block' }
const btn = { padding: '7px 12px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
const btnPrimary = { ...btn, background: '#1e3a6e', color: 'white', border: '1px solid #1e3a6e' }
const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }

export default function FeeRefunds({ students, liveRows, isAdmin, currentUser }) {
  const me = currentUser?.userName || currentUser?.name || 'Admin'
  const [rows, setRows] = useState([])
  const [setup, setSetup] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sq, setSq] = useState('')
  const [pick, setPick] = useState(null)
  const [kind, setKind] = useState(KINDS[0])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState('Cash')
  const [reference, setReference] = useState('')
  const [target, setTarget] = useState('')
  const [statusF, setStatusF] = useState('All')
  const [lq, setLq] = useState('')

  useEffect(() => {
    let on = true
    supabase.from('fee_refunds').select('*').order('created_at', { ascending: false }).limit(500).then(({ data, error }) => {
      if (!on) return
      if (error) { setSetup(missingTable(error)); setLoadErr(missingTable(error) ? '' : error.message); setRows([]); return }
      setSetup(false); setLoadErr(''); setRows(data || [])
    })
    return () => { on = false }
  }, [tick])

  const matches = useMemo(() => {
    const t = sq.trim().toLowerCase()
    if (t.length < 2) return []
    return (students || []).filter(s => [s.name, s.gcc_no].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 8)
  }, [students, sq])

  const live = useMemo(() => pick ? (liveRows || []).find(r => String(r.gcc_no) === String(pick.gcc_no)) : null, [pick, liveRows])
  const paid = live ? Number(live.grandTotal || 0) : null
  const due = live && live.totalDue != null ? Number(live.totalDue) : null
  const isWriteOff = kind === 'Write-off dues'
  const cap = isWriteOff ? due : paid
  const amt = Number(amount)
  const amtOk = amt > 0 && (cap == null || amt <= cap)
  const needsMode = kind === 'Refund to parent'
  const needsTarget = kind === 'Adjust to sibling GCC'
  const canSubmit = isAdmin && pick && amtOk && reason.trim().length >= 5 && (!needsTarget || target.trim()) && !busy && !setup

  const submit = async () => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('fee_refunds').insert({
      gcc: String(pick.gcc_no), student_name: pick.name || null, kind, amount: amt, reason: reason.trim(),
      mode: needsMode ? mode : null, reference: reference.trim() || null, target_gcc: needsTarget ? target.trim() : null,
      status: 'pending', requested_by: me,
    })
    setBusy(false)
    if (error) { setMsg({ bad: true, t: missingTable(error) ? SETUP_MSG : error.message }); return }
    setMsg({ t: 'Request recorded as pending.' }); setAmount(''); setReason(''); setReference(''); setTarget(''); setTick(t => t + 1)
  }

  const decide = async (r, status) => {
    if (status === 'approved' && Number(r.amount) > CONCESSION_SELF_APPROVE_LIMIT && same(r.requested_by, me) && !(await isSoleAdmin())) {
      setMsg({ bad: true, t: `You raised this request — another admin must approve amounts above ₹${n(CONCESSION_SELF_APPROVE_LIMIT)}.` }); return
    }
    const note = window.prompt(status === 'rejected' ? 'Reason for rejecting (min 5 characters):' : 'Approval note (optional):', '')
    if (note === null) return
    if (status === 'rejected' && note.trim().length < 5) { setMsg({ bad: true, t: 'Rejection reason must be at least 5 characters.' }); return }
    const { error } = await supabase.from('fee_refunds').update({ status, decided_by: me, decided_at: new Date().toISOString(), decision_note: note.trim() || null }).eq('id', r.id)
    if (error) { setMsg({ bad: true, t: error.message }); return }
    setMsg({ t: `Request ${status}.` }); setTick(t => t + 1)
  }

  const markPaid = async r => {
    const ref = window.prompt('Payment reference / cheque / UTR (required):', r.reference || '')
    if (ref === null) return
    if (!ref.trim()) { setMsg({ bad: true, t: 'A reference is required to mark as paid.' }); return }
    const { error } = await supabase.from('fee_refunds').update({ status: 'paid', reference: ref.trim() }).eq('id', r.id)
    if (error) { setMsg({ bad: true, t: error.message }); return }
    setMsg({ t: 'Marked as paid.' }); setTick(t => t + 1)
  }

  const shown = rows.filter(r => {
    if (statusF !== 'All' && r.status !== statusF) return false
    const t = lq.trim().toLowerCase()
    return !t || [r.gcc, r.student_name, r.kind, r.reference].some(v => String(v || '').toLowerCase().includes(t))
  })
  const exportRows = () => downloadCsv(shown.map(r => ({
    date: String(r.created_at || '').slice(0, 10), gcc: r.gcc, student: r.student_name || '', kind: r.kind, amount: r.amount, mode: r.mode || '',
    reference: r.reference || '', target_gcc: r.target_gcc || '', status: r.status, reason: r.reason, requested_by: r.requested_by || '',
    decided_by: r.decided_by || '', decision_note: r.decision_note || '',
  })), 'fee_refunds')

  return (
    <div>
      {setup && <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠ {SETUP_MSG}</div>}
      {loadErr && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load refunds: {loadErr}</div>}
      {msg && <div style={{ background: msg.bad ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.bad ? '#fecaca' : '#bbf7d0'}`, color: msg.bad ? '#991b1b' : '#166534', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{msg.t}</div>}

      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e3d8' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a6e' }}>↩ Refunds & transfers</div>
          <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>This only records the request. The books entry must still be made in Accounts as an expense / adjustment — no fee rows are changed here.</div>
        </div>
        {!isAdmin ? (
          <div style={{ padding: 16, fontSize: 13, color: '#5d6b82' }}>🔒 Only admins can raise refund requests. You can view the list below.</div>
        ) : (
          <div style={{ padding: 16 }}>
            <label style={lbl}>Student (name or GCC)
              <input value={sq} onChange={e => setSq(e.target.value)} placeholder="Search…" style={{ ...inp, marginTop: 4, maxWidth: 360 }} />
            </label>
            {matches.length > 0 && (
              <div style={{ border: '1px solid #e8e3d8', borderRadius: 8, marginTop: 6, maxWidth: 360, overflow: 'hidden' }}>
                {matches.map(s => (
                  <div key={s.id ?? s.gcc_no} onClick={() => { setPick(s); setSq(''); setAmount('') }} style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid #f3f0e8' }}>
                    <b>{s.gcc_no}</b> · {s.name} <span style={{ color: '#8a93a6' }}>{s.status && s.status !== 'Active' ? `· ${s.status}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {pick && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
                  {[
                    { l: 'Student', v: `${pick.name} (${pick.gcc_no})` },
                    { l: 'Total paid', v: paid == null ? 'n/a' : `₹${n(paid)}` },
                    { l: 'Still owes', v: due == null ? 'n/a' : `₹${n(due)}`, red: due > 0 },
                    { l: 'Status', v: live?.liveStatus ? `${live.liveStatus}${pick.status && pick.status !== 'Active' ? ' · ' + pick.status : ''}` : pick.status || '—' },
                    ...(pick.left_date ? [{ l: 'Left on', v: pick.left_date }] : []),
                  ].map(k => (
                    <div key={k.l} style={{ background: '#faf8f3', border: '1px solid #e8e3d8', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase' }}>{k.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: k.red ? '#dc2626' : '#14213d' }}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {!live && <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>This student is not in the active list, so paid/due figures are unavailable and the amount cap is not enforced — check the ledger first.</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                  <label style={lbl}>Type
                    <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...inp, marginTop: 4 }}>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
                  </label>
                  <label style={lbl}>Amount (₹){cap != null && <span style={{ fontWeight: 500 }}> · max ₹{n(cap)}</span>}
                    <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, marginTop: 4, borderColor: amount && !amtOk ? '#fca5a5' : '#d9d2c2' }} />
                  </label>
                  {needsTarget && <label style={lbl}>Sibling GCC
                    <input value={target} onChange={e => setTarget(e.target.value)} style={{ ...inp, marginTop: 4 }} />
                  </label>}
                  {needsMode && <label style={lbl}>Refund mode
                    <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inp, marginTop: 4 }}>{MODES.map(m => <option key={m}>{m}</option>)}</select>
                  </label>}
                  {needsMode && <label style={lbl}>Reference (optional now)
                    <input value={reference} onChange={e => setReference(e.target.value)} style={{ ...inp, marginTop: 4 }} />
                  </label>}
                </div>
                <label style={{ ...lbl, marginTop: 12 }}>Reason (min 5 characters)
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...inp, marginTop: 4, resize: 'vertical' }} />
                </label>
                <button onClick={submit} disabled={!canSubmit} style={{ ...btnPrimary, marginTop: 12, opacity: canSubmit ? 1 : .5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : 'Record request'}</button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Requests</div>
          <input value={lq} onChange={e => setLq(e.target.value)} placeholder="Search…" style={{ ...inp, width: 160 }} />
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ ...inp, width: 'auto' }}>{['All', 'pending', 'approved', 'paid', 'rejected'].map(s => <option key={s}>{s}</option>)}</select>
          <button onClick={exportRows} disabled={!shown.length} style={btn}>⬇ CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'GCC', 'Student', 'Type', 'Amount', 'Status', 'Requested by', 'Reason', ''].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(r => {
                const [bg, fg] = STATUS_STYLE[r.status] || ['#f3f0e8', '#4b5870']
                return (
                  <tr key={r.id}>
                    <td style={cell}>{String(r.created_at || '').slice(0, 10)}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.gcc}</td>
                    <td style={cell}>{r.student_name || '—'}</td>
                    <td style={cell}>{r.kind}{r.target_gcc ? ` → ${r.target_gcc}` : ''}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>₹{n(r.amount)}</td>
                    <td style={cell}><span title={r.decision_note || ''} style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: bg, color: fg }}>{r.status}</span></td>
                    <td style={cell}>{r.requested_by || '—'}</td>
                    <td style={{ ...cell, whiteSpace: 'normal', minWidth: 160, color: '#4b5870' }}>{r.reason}{r.reference ? ` · ref ${r.reference}` : ''}</td>
                    <td style={cell}>
                      {isAdmin && r.status === 'pending' && <>
                        <button onClick={() => decide(r, 'approved')} style={{ ...btn, padding: '4px 10px', color: '#166534' }}>Approve</button>{' '}
                        <button onClick={() => decide(r, 'rejected')} style={{ ...btn, padding: '4px 10px', color: '#991b1b' }}>Reject</button>
                      </>}
                      {isAdmin && r.status === 'approved' && <button onClick={() => markPaid(r)} style={{ ...btn, padding: '4px 10px' }}>Mark paid</button>}
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: '#8a93a6', padding: 24 }}>No requests</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// FeeInstallments.jsx — installment plans for students who cannot clear dues at once.
// Table: fee_installment_plans (supabase/migrations/20261008_fee_reminders_installments.sql).
// Plans are a record/agreement only; money is still collected in Fee Payment.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'

const n = v => Number(v || 0).toLocaleString('en-IN')
const NAVY = '#1e3a6e'
const BORDER = '#e8e3d8'
const SETUP_MSG = 'Run supabase/migrations/20261008_fee_reminders_installments.sql in the Supabase SQL editor to switch on installment plans.'
const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_installment_plans/.test(err.message || ''))

const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }
const label = { fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' }
const input = { padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12.5, background: '#fff', minWidth: 0 }
const btn = (bg = NAVY, fg = '#fff') => ({ padding: '7px 13px', borderRadius: 8, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const th = { padding: '7px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: '#fff', background: NAVY, whiteSpace: 'nowrap' }
const td = { padding: '6px 10px', fontSize: 12, borderBottom: `1px solid ${BORDER}`, verticalAlign: 'middle' }

const todayIso = () => new Date().toISOString().slice(0, 10)
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const round2 = v => Math.round(v * 100) / 100

function addToDate(iso, i, interval) {
  const [y, m, d] = iso.split('-').map(Number)
  if (interval === '15') {
    const dt = new Date(Date.UTC(y, m - 1, d + 15 * i))
    return dt.toISOString().slice(0, 10)
  }
  const target = m - 1 + i
  const last = new Date(Date.UTC(y, target + 1, 0)).getUTCDate() // clamp 31st etc.
  return new Date(Date.UTC(y, target, Math.min(d, last))).toISOString().slice(0, 10)
}

function split(total, count, first, interval) {
  const base = Math.floor((total / count) * 100) / 100
  return Array.from({ length: count }, (_, i) => ({
    no: i + 1, due_date: addToDate(first, i, interval),
    amount: i === count - 1 ? round2(total - base * (count - 1)) : base,
    paid_amount: 0, paid_date: null, receipt_no: null,
  }))
}

const isPaid = i => Number(i.paid_amount) >= Number(i.amount) - 0.005
const planState = (p, today) => {
  if (p.status === 'cancelled') return 'Cancelled'
  if (p.status === 'completed') return 'Completed'
  return (p.installments || []).some(i => !isPaid(i) && i.due_date < today) ? 'Overdue' : 'Active'
}
const CHIP = {
  Active: ['#dbeafe', '#1d4ed8'], Overdue: ['#fee2e2', '#b91c1c'], Completed: ['#dcfce7', '#166534'], Cancelled: ['#f3f4f6', '#6b7280'],
}

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchPlans() {
  const { data, error } = await supabase.from('fee_installment_plans').select('*').order('created_at', { ascending: false }).limit(2000)
  return { data: data || [], error }
}

export default function FeeInstallments({ students = [], liveRows = [], isAdmin, currentUser }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [flash, setFlash] = useState('')
  const [statusF, setStatusF] = useState('All')

  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(null)
  const [total, setTotal] = useState('')
  const [count, setCount] = useState('3')
  const [first, setFirst] = useState(todayIso())
  const [interval, setIntervalV] = useState('month')
  const [reason, setReason] = useState('')
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)

  const [payEdit, setPayEdit] = useState({}) // `${planId}:${no}` -> {amount,date,receipt}
  const [cancelFor, setCancelFor] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const who = currentUser?.name || currentUser?.username || currentUser?.email || ''
  const today = todayIso()
  const note = msg => { setFlash(msg); setTimeout(() => setFlash(''), 4000) }

  const applyResult = useCallback(({ data, error }) => {
    if (error) { if (missingTable(error)) setMissing(true); else setLoadErr(error.message || 'Could not load plans') }
    else { setPlans(data); setMissing(false); setLoadErr('') }
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    fetchPlans().then(r => { if (alive) applyResult(r) }).catch(e => { if (alive) { setLoadErr(e.message || 'Could not load plans'); setLoading(false) } })
    return () => { alive = false }
  }, [applyResult])

  const dueByGcc = useMemo(() => {
    const m = new Map()
    liveRows.forEach(r => m.set(String(r.gcc_no), Number(r.totalDue) || 0))
    return m
  }, [liveRows])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2 || picked) return []
    return students.filter(x => `${x.name || ''} ${x.gcc_no || ''}`.toLowerCase().includes(s)).slice(0, 8)
  }, [q, students, picked])

  const pick = s => {
    setPicked(s); setQ(`${s.name} (GCC-${s.gcc_no})`); setDraft([])
    const due = dueByGcc.get(String(s.gcc_no)) || 0
    setTotal(due > 0 ? String(due) : '')
  }
  const clearPick = () => { setPicked(null); setQ(''); setTotal(''); setDraft([]) }

  const autoSplit = () => {
    const t = Number(total), c = Math.floor(Number(count))
    if (!(t > 0)) { note('Enter a total amount above 0'); return }
    if (!(c >= 1 && c <= 24)) { note('Installments must be between 1 and 24'); return }
    if (!first) { note('Pick the first due date'); return }
    setDraft(split(t, c, first, interval))
  }
  const editDraft = (idx, key, val) => setDraft(d => d.map((r, i) => (i === idx ? { ...r, [key]: key === 'amount' ? val : val } : r)))
  const draftSum = round2(draft.reduce((t, r) => t + (Number(r.amount) || 0), 0))
  const diff = round2(Number(total || 0) - draftSum)

  const savePlan = async () => {
    if (!isAdmin) return
    if (!picked) { note('Pick a student'); return }
    if (reason.trim().length < 5) { note('Reason is required (at least 5 characters)'); return }
    if (!draft.length) { note('Generate the installment split first'); return }
    if (diff !== 0) { note(`Installments must add up to ₹${n(total)} (off by ₹${n(Math.abs(diff))})`); return }
    if (draft.some(r => !r.due_date || !(Number(r.amount) > 0))) { note('Every installment needs a date and an amount above 0'); return }
    setSaving(true)
    const installments = draft.map((r, i) => ({ ...r, no: i + 1, amount: round2(Number(r.amount)) }))
    const { data, error } = await supabase.from('fee_installment_plans').insert({
      gcc: String(picked.gcc_no), student_name: picked.name || null, total_amount: Number(total), reason: reason.trim(),
      status: 'active', created_by: who || null, approved_by: who || null, installments,
    }).select().single()
    setSaving(false)
    if (error) { if (missingTable(error)) setMissing(true); else note(`Could not save: ${error.message}`); return }
    setPlans(p => [data, ...p])
    clearPick(); setReason(''); note('Plan saved')
  }

  const updatePlan = async (plan, patch) => {
    const { data, error } = await supabase.from('fee_installment_plans').update(patch).eq('id', plan.id).select().single()
    if (error) { note(`Could not update: ${error.message}`); return false }
    setPlans(p => p.map(x => (x.id === plan.id ? data : x)))
    return true
  }

  const markPaid = async (plan, inst) => {
    const key = `${plan.id}:${inst.no}`
    const e = payEdit[key] || {}
    const amt = Number(e.amount ?? inst.amount)
    if (!(amt > 0)) { note('Enter the amount paid'); return }
    const installments = plan.installments.map(i => (i.no === inst.no
      ? { ...i, paid_amount: round2(Number(i.paid_amount || 0) + amt), paid_date: e.date || today, receipt_no: (e.receipt || '').trim() || i.receipt_no || null }
      : i))
    const status = installments.every(isPaid) ? 'completed' : 'active'
    if (await updatePlan(plan, { installments, status })) {
      setPayEdit(p => { const c = { ...p }; delete c[key]; return c })
      note(status === 'completed' ? 'Installment recorded — plan completed' : 'Installment recorded')
    }
  }

  const cancelPlan = async plan => {
    if (cancelReason.trim().length < 5) { note('Cancel reason is required (at least 5 characters)'); return }
    const merged = `${plan.reason || ''}${plan.reason ? ' | ' : ''}Cancelled: ${cancelReason.trim()}`
    if (await updatePlan(plan, { status: 'cancelled', reason: merged })) { setCancelFor(null); setCancelReason(''); note('Plan cancelled') }
  }

  const withState = plans.map(p => ({ ...p, _state: planState(p, today) }))
  const overdueCount = withState.filter(p => p._state === 'Overdue').length
  const shown = withState.filter(p => statusF === 'All' || p._state === statusF)

  const exportPlans = () => downloadCsv('installment_plans.csv', shown.map(p => {
    const paid = (p.installments || []).reduce((t, i) => t + (Number(i.paid_amount) || 0), 0)
    const nextUnpaid = (p.installments || []).find(i => !isPaid(i))
    return {
      'GCC No': p.gcc, Name: p.student_name || '', Status: p._state, 'Total (₹)': Number(p.total_amount), 'Recorded Paid (₹)': paid,
      'Balance (₹)': Math.max(0, Number(p.total_amount) - paid), Installments: (p.installments || []).length,
      'Next Due Date': nextUnpaid?.due_date || '', Reason: p.reason || '', 'Created By': p.created_by || '',
      Created: p.created_at ? String(p.created_at).slice(0, 10) : '',
    }
  }))

  if (missing) {
    return <div role="alert" style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d', fontSize: 12.5, fontWeight: 600, color: '#92400e' }}>
      Installment plans are not set up yet. {SETUP_MSG}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {loadErr && <div role="alert" style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', fontSize: 12.5, color: '#991b1b' }}>{loadErr}</div>}
      <div style={{ ...card, background: '#eef2f9', fontSize: 12, color: NAVY, fontWeight: 600 }}>
        Plans only record the agreed schedule. The actual money is still collected in Fee Payment — marking an installment paid here does not create a receipt.
      </div>
      {flash && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{flash}</div>}

      {isAdmin ? (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 900, color: NAVY, marginBottom: 10 }}>New installment plan</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ position: 'relative' }}>
              <span style={label}>Student (name or GCC)</span>
              <input style={{ ...input, width: 220 }} value={q} onChange={e => { setQ(e.target.value); setPicked(null); setDraft([]) }} placeholder="Search…" />
              {matches.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, minWidth: 260, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
                  {matches.map(s => (
                    <button type="button" key={s.id || s.gcc_no} onClick={() => pick(s)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{s.name}</span><span style={{ color: '#6b7280' }}>GCC-{s.gcc_no} · due ₹{n(dueByGcc.get(String(s.gcc_no)) || 0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {picked && <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', paddingBottom: 8 }}>Current due ₹{n(dueByGcc.get(String(picked.gcc_no)) || 0)}</div>}
            <div><span style={label}>Total (₹)</span><input style={{ ...input, width: 100 }} type="number" min="1" value={total} onChange={e => { setTotal(e.target.value); setDraft([]) }} /></div>
            <div><span style={label}>Installments</span><input style={{ ...input, width: 70 }} type="number" min="1" max="24" value={count} onChange={e => setCount(e.target.value)} /></div>
            <div><span style={label}>First due date</span><input style={input} type="date" value={first} onChange={e => setFirst(e.target.value)} /></div>
            <div><span style={label}>Interval</span>
              <select style={input} value={interval} onChange={e => setIntervalV(e.target.value)}><option value="month">Monthly</option><option value="15">Every 15 days</option></select></div>
            <button type="button" style={btn('#eef2f9', NAVY)} onClick={autoSplit}>Auto-split</button>
          </div>

          {draft.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 320 }}>
                <thead><tr><th style={th}>#</th><th style={th}>Due date</th><th style={th}>Amount (₹)</th></tr></thead>
                <tbody>{draft.map((r, i) => (
                  <tr key={r.no}>
                    <td style={td}>{r.no}</td>
                    <td style={td}><input type="date" style={input} value={r.due_date} onChange={e => editDraft(i, 'due_date', e.target.value)} /></td>
                    <td style={td}><input type="number" min="0" step="0.01" style={{ ...input, width: 110 }} value={r.amount} onChange={e => editDraft(i, 'amount', e.target.value)} /></td>
                  </tr>
                ))}</tbody>
              </table>
              <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color: diff === 0 ? '#166534' : '#b91c1c' }}>
                {diff === 0 ? `Adds up to ₹${n(draftSum)}` : `Sum ₹${n(draftSum)} — ${diff > 0 ? 'short' : 'over'} by ₹${n(Math.abs(diff))}`}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <span style={label}>Reason (required, min 5 characters)</span>
            <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Parent requested monthly payment, approved by principal" />
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" style={{ ...btn(), opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={savePlan}>{saving ? 'Saving…' : 'Save plan'}</button>
          </div>
        </div>
      ) : (
        <div style={{ ...card, fontSize: 12, color: '#6b7280' }}>Only an admin can create or cancel installment plans. You can view them below.</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {['All', 'Active', 'Overdue', 'Completed', 'Cancelled'].map(s => (
            <button type="button" key={s} onClick={() => setStatusF(s)} style={{ ...btn(statusF === s ? NAVY : '#eef2f9', statusF === s ? '#fff' : NAVY), padding: '5px 12px', borderRadius: 99 }}>{s}</button>
          ))}
          {overdueCount > 0 && <span style={{ fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: '#dc2626', color: '#fff' }}>{overdueCount} overdue</span>}
        </div>
        <button type="button" style={btn('#eef2f9', NAVY)} onClick={exportPlans} disabled={!shown.length}>Export CSV</button>
      </div>

      {loading && <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Loading…</div>}
      {!loading && shown.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>No installment plans yet.</div>}

      {shown.map(p => {
        const [cbg, cfg] = CHIP[p._state]
        const insts = p.installments || []
        const paid = insts.reduce((t, i) => t + (Number(i.paid_amount) || 0), 0)
        return (
          <div key={p.id} style={card}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{p.student_name} <span style={{ fontWeight: 600, fontSize: 11.5, color: '#6b7280' }}>GCC-{p.gcc}</span></div>
                <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>₹{n(p.total_amount)} · recorded paid ₹{n(paid)} · created {fmtDate(p.created_at)}{p.created_by ? ` by ${p.created_by}` : ''}</div>
                {p.reason && <div style={{ fontSize: 11.5, marginTop: 3 }}>{p.reason}</div>}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: cbg, color: cfg }}>{p._state}</span>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
                <thead><tr><th style={th}>#</th><th style={th}>Due</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Paid</th><th style={th}>Receipt</th><th style={th} /></tr></thead>
                <tbody>{insts.map(i => {
                  const key = `${p.id}:${i.no}`
                  const e = payEdit[key]
                  const paidNow = isPaid(i)
                  const late = !paidNow && i.due_date < today && p.status === 'active'
                  return (
                    <tr key={i.no}>
                      <td style={td}>{i.no}</td>
                      <td style={{ ...td, color: late ? '#b91c1c' : undefined, fontWeight: late ? 800 : 400 }}>{fmtDate(i.due_date)}{late ? ' · overdue' : ''}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>₹{n(i.amount)}</td>
                      <td style={td}>{Number(i.paid_amount) > 0 ? `₹${n(i.paid_amount)} on ${fmtDate(i.paid_date)}` : '—'}</td>
                      <td style={td}>{i.receipt_no || '—'}</td>
                      <td style={td}>
                        {isAdmin && p.status === 'active' && !paidNow && !e && (
                          <button type="button" style={{ ...btn('#eef2f9', NAVY), padding: '4px 10px' }} onClick={() => setPayEdit(s => ({ ...s, [key]: { amount: String(round2(Number(i.amount) - Number(i.paid_amount || 0))), date: today, receipt: '' } }))}>Mark paid</button>
                        )}
                        {e && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <input type="number" style={{ ...input, width: 80, padding: '4px 6px' }} value={e.amount} onChange={ev => setPayEdit(s => ({ ...s, [key]: { ...e, amount: ev.target.value } }))} />
                            <input type="date" style={{ ...input, padding: '4px 6px' }} value={e.date} onChange={ev => setPayEdit(s => ({ ...s, [key]: { ...e, date: ev.target.value } }))} />
                            <input style={{ ...input, width: 90, padding: '4px 6px' }} placeholder="Receipt (opt.)" value={e.receipt} onChange={ev => setPayEdit(s => ({ ...s, [key]: { ...e, receipt: ev.target.value } }))} />
                            <button type="button" style={{ ...btn('#16a34a'), padding: '4px 10px' }} onClick={() => markPaid(p, i)}>Save</button>
                            <button type="button" style={{ ...btn('#f3f4f6', '#374151'), padding: '4px 10px' }} onClick={() => setPayEdit(s => { const c = { ...s }; delete c[key]; return c })}>Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            {isAdmin && p.status === 'active' && (
              <div style={{ marginTop: 8 }}>
                {cancelFor === p.id ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Reason for cancelling (min 5 characters)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                    <button type="button" style={btn('#dc2626')} onClick={() => cancelPlan(p)}>Confirm cancel</button>
                    <button type="button" style={btn('#f3f4f6', '#374151')} onClick={() => { setCancelFor(null); setCancelReason('') }}>Back</button>
                  </div>
                ) : (
                  <button type="button" style={btn('#fee2e2', '#b91c1c')} onClick={() => { setCancelFor(p.id); setCancelReason('') }}>Cancel plan</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

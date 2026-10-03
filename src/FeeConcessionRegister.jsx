// FeeConcessionRegister.jsx — register of standing scholarships / concessions per student.
// Table fee_concession_register (migration 20261009_fee_dayclose_refunds_register.sql).
// Records only; nothing here changes fee rows.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_concession_register/.test(err.message || ''))
const SETUP_MSG = 'Run supabase/migrations/20261009_fee_dayclose_refunds_register.sql in the Supabase SQL editor to switch on the concession register.'
const n = v => Number(v || 0).toLocaleString('en-IN')
const KINDS = ['Sibling', 'Staff ward', 'Scholarship-merit', 'Financial hardship', 'Management', 'Other']
const BASES = [['fixed_per_month', 'Fixed ₹ per month'], ['percent', 'Percent %'], ['one_time', 'One-time ₹']]
const APPLIES = [['course', 'Course fee'], ['flat', 'Flat fee'], ['both', 'Course + flat'], ['all', 'All fees']]
const dayOf = v => String(v || '').slice(0, 10)
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Effective state of an entry on a date: revoked | expired | expiring | active
function stateOf(r, onDate = iso(new Date())) {
  if (r.status === 'revoked') return 'revoked'
  if (r.status === 'expired') return 'expired'
  const to = dayOf(r.valid_to)
  if (to && to < onDate) return 'expired'
  if (to) {
    const lim = new Date(onDate + 'T00:00:00'); lim.setDate(lim.getDate() + 30)
    if (to <= iso(lim)) return 'expiring'
  }
  return 'active'
}

// Active fixed monthly concession (₹) for a student on a date — for future auto-apply.
// Counts only active, non-revoked fixed_per_month entries whose window covers onDate.
// eslint-disable-next-line react-refresh/only-export-components -- helper requested alongside the component
export function monthlyConcessionFor(register, gcc, onDate) {
  const d = dayOf(onDate) || iso(new Date())
  return (register || []).reduce((t, r) => {
    if (String(r.gcc) !== String(gcc) || r.basis !== 'fixed_per_month' || r.status !== 'active') return t
    if (dayOf(r.valid_from) > d || (r.valid_to && dayOf(r.valid_to) < d)) return t
    return t + (Number(r.value) || 0)
  }, 0)
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

const STATE_STYLE = { active: ['#dcfce7', '#166534', 'Active'], expiring: ['#fef3c7', '#92400e', 'Expiring ≤30d'], expired: ['#e5e7eb', '#4b5563', 'Expired'], revoked: ['#fee2e2', '#991b1b', 'Revoked'] }
const card = { background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }
const inp = { padding: '8px 10px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', width: '100%' }
const lbl = { fontSize: 11, fontWeight: 700, color: '#5d6b82', display: 'block' }
const btn = { padding: '7px 12px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
const btnPrimary = { ...btn, background: '#1e3a6e', color: 'white', border: '1px solid #1e3a6e' }
const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }

export default function FeeConcessionRegister({ students, isAdmin, currentUser }) {
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
  const [basis, setBasis] = useState('fixed_per_month')
  const [value, setValue] = useState('')
  const [appliesTo, setAppliesTo] = useState('course')
  const [validFrom, setValidFrom] = useState(iso(new Date()))
  const [validTo, setValidTo] = useState('')
  const [reason, setReason] = useState('')
  const [kindF, setKindF] = useState('All')
  const [stateF, setStateF] = useState('All')
  const [lq, setLq] = useState('')

  useEffect(() => {
    let on = true
    supabase.from('fee_concession_register').select('*').order('created_at', { ascending: false }).limit(1000).then(({ data, error }) => {
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

  const withState = useMemo(() => rows.map(r => ({ ...r, _s: stateOf(r) })), [rows])
  const summary = useMemo(() => {
    const live = withState.filter(r => r._s === 'active' || r._s === 'expiring')
    return {
      active: live.length,
      monthly: live.filter(r => r.basis === 'fixed_per_month' && dayOf(r.valid_from) <= iso(new Date())).reduce((t, r) => t + (Number(r.value) || 0), 0),
      expiring: withState.filter(r => r._s === 'expiring').length,
    }
  }, [withState])

  const pctBad = basis === 'percent' && Number(value) > 100
  const explainBad = kind === 'Other' && reason.trim().length < 3
  const canAdd = isAdmin && pick && Number(value) > 0 && !pctBad && validFrom && (!validTo || validTo >= validFrom) && reason.trim().length >= 3 && !explainBad && !busy && !setup

  const add = async () => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('fee_concession_register').insert({
      gcc: String(pick.gcc_no), student_name: pick.name || null, kind, basis, value: Number(value), applies_to: appliesTo,
      valid_from: validFrom, valid_to: validTo || null, reason: reason.trim(), approved_by: me, status: 'active',
    })
    setBusy(false)
    if (error) { setMsg({ bad: true, t: missingTable(error) ? SETUP_MSG : error.message }); return }
    setMsg({ t: 'Concession added to the register.' }); setValue(''); setReason(''); setValidTo(''); setPick(null); setTick(t => t + 1)
  }

  const revoke = async r => {
    const why = window.prompt(`Revoke ${r.kind} concession for ${r.student_name || r.gcc}? Reason (min 5 characters):`)
    if (why === null) return
    if (why.trim().length < 5) { setMsg({ bad: true, t: 'Revoke reason must be at least 5 characters.' }); return }
    const { error } = await supabase.from('fee_concession_register').update({ status: 'revoked', revoked_reason: why.trim() }).eq('id', r.id)
    if (error) { setMsg({ bad: true, t: error.message }); return }
    setMsg({ t: 'Concession revoked.' }); setTick(t => t + 1)
  }

  const valueText = r => r.basis === 'percent' ? `${n(r.value)}%` : r.basis === 'one_time' ? `₹${n(r.value)} once` : `₹${n(r.value)}/mo`
  const shown = withState.filter(r => {
    if (kindF !== 'All' && r.kind !== kindF) return false
    if (stateF !== 'All' && r._s !== stateF) return false
    const t = lq.trim().toLowerCase()
    return !t || [r.gcc, r.student_name, r.reason].some(v => String(v || '').toLowerCase().includes(t))
  })
  const exportRows = () => downloadCsv(shown.map(r => ({
    gcc: r.gcc, student: r.student_name || '', kind: r.kind, basis: r.basis, value: r.value, applies_to: r.applies_to,
    valid_from: dayOf(r.valid_from), valid_to: dayOf(r.valid_to), state: r._s, reason: r.reason, approved_by: r.approved_by || '', revoked_reason: r.revoked_reason || '',
  })), 'fee_concession_register')

  return (
    <div>
      {setup && <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠ {SETUP_MSG}</div>}
      {loadErr && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load the register: {loadErr}</div>}
      {msg && <div style={{ background: msg.bad ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.bad ? '#fecaca' : '#bbf7d0'}`, color: msg.bad ? '#991b1b' : '#166534', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{msg.t}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
        {[{ l: 'Active concessions', v: summary.active, c: '#166534' }, { l: 'Monthly value committed', v: `₹${n(summary.monthly)}`, c: '#1e3a6e' }, { l: 'Expiring in 30 days', v: summary.expiring, c: summary.expiring ? '#b45309' : '#4b5870' }].map(k => (
          <div key={k.l} style={{ background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase' }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.c, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e3d8' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a6e' }}>🎓 Concession register</div>
          <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>Standing scholarships and concessions. Recorded for reference — fee rows are not changed automatically.</div>
        </div>
        {!isAdmin ? (
          <div style={{ padding: 16, fontSize: 13, color: '#5d6b82' }}>🔒 Only admins can add or revoke entries. You can view the register below.</div>
        ) : (
          <div style={{ padding: 16 }}>
            <label style={lbl}>Student (name or GCC)
              <input value={pick ? `${pick.gcc_no} · ${pick.name}` : sq} onChange={e => { setPick(null); setSq(e.target.value) }} placeholder="Search…" style={{ ...inp, marginTop: 4, maxWidth: 360 }} />
            </label>
            {!pick && matches.length > 0 && (
              <div style={{ border: '1px solid #e8e3d8', borderRadius: 8, marginTop: 6, maxWidth: 360, overflow: 'hidden' }}>
                {matches.map(s => <div key={s.id ?? s.gcc_no} onClick={() => { setPick(s); setSq('') }} style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid #f3f0e8' }}><b>{s.gcc_no}</b> · {s.name}</div>)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginTop: 12 }}>
              <label style={lbl}>Kind<select value={kind} onChange={e => setKind(e.target.value)} style={{ ...inp, marginTop: 4 }}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
              <label style={lbl}>Basis<select value={basis} onChange={e => setBasis(e.target.value)} style={{ ...inp, marginTop: 4 }}>{BASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label style={lbl}>Value {basis === 'percent' ? '(%)' : '(₹)'}<input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} style={{ ...inp, marginTop: 4, borderColor: pctBad ? '#fca5a5' : '#d9d2c2' }} /></label>
              <label style={lbl}>Applies to<select value={appliesTo} onChange={e => setAppliesTo(e.target.value)} style={{ ...inp, marginTop: 4 }}>{APPLIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label style={lbl}>Valid from<input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
              <label style={lbl}>Valid to (blank = open)<input type="date" value={validTo} min={validFrom} onChange={e => setValidTo(e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
            </div>
            <label style={{ ...lbl, marginTop: 12 }}>{kind === 'Other' ? 'Explanation (required for Other, min 3 characters)' : 'Reason (min 3 characters)'}
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...inp, marginTop: 4, resize: 'vertical', borderColor: explainBad ? '#fca5a5' : '#d9d2c2' }} />
            </label>
            <button onClick={add} disabled={!canAdd} style={{ ...btnPrimary, marginTop: 12, opacity: canAdd ? 1 : .5, cursor: canAdd ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : 'Add to register'}</button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Register</div>
          <input value={lq} onChange={e => setLq(e.target.value)} placeholder="Search name / GCC…" style={{ ...inp, width: 170 }} />
          <select value={kindF} onChange={e => setKindF(e.target.value)} style={{ ...inp, width: 'auto' }}>{['All', ...KINDS].map(k => <option key={k}>{k}</option>)}</select>
          <select value={stateF} onChange={e => setStateF(e.target.value)} style={{ ...inp, width: 'auto' }}>{[['All', 'All states'], ['active', 'Active'], ['expiring', 'Expiring ≤30d'], ['expired', 'Expired'], ['revoked', 'Revoked']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <button onClick={exportRows} disabled={!shown.length} style={btn}>⬇ CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['GCC', 'Student', 'Kind', 'Value', 'Applies to', 'Valid', 'State', 'Reason', 'Approved by', ''].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(r => {
                const [bg, fg, label] = STATE_STYLE[r._s]
                return (
                  <tr key={r.id}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.gcc}</td>
                    <td style={cell}>{r.student_name || '—'}</td>
                    <td style={cell}>{r.kind}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{valueText(r)}</td>
                    <td style={cell}>{(APPLIES.find(a => a[0] === r.applies_to) || [0, r.applies_to])[1]}</td>
                    <td style={cell}>{dayOf(r.valid_from)} → {dayOf(r.valid_to) || 'open'}</td>
                    <td style={cell}><span title={r.revoked_reason || ''} style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: bg, color: fg }}>{label}</span></td>
                    <td style={{ ...cell, whiteSpace: 'normal', minWidth: 160, color: '#4b5870' }}>{r.reason}</td>
                    <td style={cell}>{r.approved_by || '—'}</td>
                    <td style={cell}>{isAdmin && (r._s === 'active' || r._s === 'expiring') && <button onClick={() => revoke(r)} style={{ ...btn, padding: '4px 10px', color: '#991b1b' }}>Revoke</button>}</td>
                  </tr>
                )
              })}
              {shown.length === 0 && <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', color: '#8a93a6', padding: 24 }}>No entries</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

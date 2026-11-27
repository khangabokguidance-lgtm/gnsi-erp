// FeeConcessionRegister.jsx — Concession / Special Fee: a lower fee for a student
// in the SAME course (sibling, staff ward, scholarship, merit, hardship …).
// Any staff member can request one; an admin approves or rejects it. Each entry
// has a form number (FCR-YYYY-NNNN) and prints as an approval form with
// signature boxes. Approved entries lower each month's fee in every ledger
// (shown there as a separate "Standing concession" line, so billed stays the
// full fee). Table fee_concession_register; rules and audit are enforced by
// migration 20261130_fee_concession_approval.sql.
import { Fragment, useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import StudentJump from './StudentJump'
import { cardFlush as card, inputFull as inp, label as lbl, btn, btnPrimary, cell, head } from './feeTheme'
import { getFeeRates, getSessionYear } from './feeEngine'
import { loadStanding } from './feeStanding'
import { courseOf as canonCourse } from './courseMap'
import { KINDS, BASES, APPLIES, STATUS, dayOf, monthLabel, monthEndOf, feeImpact, isFullWaiver, validateRequest, requestRow, stateOf, isLive, describe, monthlyValue, courseReport } from './lib/concessionPlan'
import { printConcessionForm, printConcessionReport } from './concessionPrint'

const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_concession_register/.test(err.message || ''))
const needsMigration = err => err && (err.code === 'PGRST204' || err.code === '42703' || /form_no|fee_impact|requested_by|fcr_/.test(err.message || ''))
const SETUP_MSG = 'Run supabase/migrations/20261009_fee_dayclose_refunds_register.sql in the Supabase SQL editor to switch on the concession register.'
const MIGRATE_MSG = 'Run supabase/migrations/20261130_fee_concession_approval.sql in the Supabase SQL editor to switch on requests, approval and the printed form.'
const n = v => Number(v || 0).toLocaleString('en-IN')
const inr = v => '₹' + n(Math.round(Number(v) || 0))
const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7)
const when = t => t ? new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// eslint-disable-next-line react-refresh/only-export-components -- helper kept for older callers
export function monthlyConcessionFor(register, gcc, onDate) {
  const d = dayOf(onDate) || new Date().toLocaleDateString('en-CA')
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

const Pill = ({ s }) => { const m = STATUS[s] || STATUS.pending; return <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span> }
const tabBtn = on => ({ padding: '7px 14px', borderRadius: 99, border: `1px solid ${on ? '#1e3a6e' : '#e8e3d8'}`, background: on ? '#1e3a6e' : '#fff', color: on ? '#fff' : '#1e3a6e', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
const note = bad => ({ background: bad ? '#fef2f2' : '#f0fdf4', border: `1px solid ${bad ? '#fecaca' : '#bbf7d0'}`, color: bad ? '#991b1b' : '#166534', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 })

export default function FeeConcessionRegister({ students, isAdmin, currentUser, onCollect, onLedger }) {
  const me = currentUser?.userName || currentUser?.name || (isAdmin ? 'Admin' : 'Staff')
  const [view, setView] = useState('request')
  const [rows, setRows] = useState([])
  const [setup, setSetup] = useState(false)
  const [migrate, setMigrate] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  // request form
  const [sq, setSq] = useState('')
  const [pick, setPick] = useState(null)
  const [rates, setRates] = useState(null)
  const [f, setF] = useState({ kind: KINDS[0], basis: 'fixed_per_month', value: '', applies_to: 'course', from: thisMonth(), to: '', reason: '' })
  const [approveNow, setApproveNow] = useState(false)
  const [approveNote, setApproveNote] = useState('')
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  // lists
  const [kindF, setKindF] = useState('All')
  const [stateF, setStateF] = useState('live')
  const [courseF, setCourseF] = useState('All')
  const [lq, setLq] = useState('')
  const [act, setAct] = useState(null)   // { id, mode: 'approve'|'reject'|'end'|'cancel', text, month }

  useEffect(() => {
    let on = true
    supabase.from('fee_concession_register').select('*').order('created_at', { ascending: false }).limit(2000).then(({ data, error }) => {
      if (!on) return
      if (error) { setSetup(missingTable(error)); setLoadErr(missingTable(error) ? '' : error.message); setRows([]); return }
      setSetup(false); setLoadErr(''); setRows(data || [])
      setMigrate(!!(data || []).length && !('form_no' in data[0]))
    })
    return () => { on = false }
  }, [tick])

  // Standard monthly fees of the picked student (their own Fee Setup rate, if any).
  useEffect(() => {
    if (!pick) { setRates(null); return }
    let on = true
    getFeeRates(getSessionYear(), pick.course || '', pick.batch || '', pick.hostel_type || 'Day Scholar', pick.gcc_no)
      .then(r => { if (on) setRates({ course: Number(r.courseFee) || 0, flat: Number(r.flatFee) || 0 }) })
      .catch(() => { if (on) setRates(null) })
    return () => { on = false }
  }, [pick])

  const matches = useMemo(() => {
    const t = sq.trim().toLowerCase()
    if (t.length < 2) return []
    return (students || []).filter(s => !s.deleted_at && [s.name, s.gcc_no].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 8)
  }, [students, sq])
  const byGcc = useMemo(() => new Map((students || []).map(s => [String(parseInt(s.gcc_no) || 0), s])), [students])
  const courseOfRow = r => {
    const c = canonCourse({ course: r.course, batch: r.batch })
    if (r.course && c !== 'Unassigned') return c
    const s = byGcc.get(String(parseInt(r.gcc) || 0))
    return s ? (canonCourse(s) === 'Unassigned' ? (s.course || 'Unassigned') : canonCourse(s)) : (r.course || 'Unassigned')
  }

  const form = { ...f, student: pick }
  const err = validateRequest(form, rates)
  const impact = pick && rates ? feeImpact(form, rates) : null
  const full = pick && !err && isFullWaiver(form, rates)
  const fullNoteBad = approveNow && full && approveNote.trim().length < 5
  const dup = pick ? rows.filter(r => String(r.gcc) === String(pick.gcc_no) && (isLive(stateOf(r)) || r.status === 'pending')) : []
  const canSave = !setup && !migrate && !err && !busy && !fullNoteBad

  const afterWrite = async t => {
    setMsg({ t }); setAct(null); setTick(x => x + 1)
    try { await loadStanding({ force: true }) } catch { /* cache refresh only */ }
  }
  const fail = e => setMsg({ bad: true, t: missingTable(e) ? SETUP_MSG : needsMigration(e) ? MIGRATE_MSG : e.message })

  const save = async () => {
    setBusy(true); setMsg(null)
    const row = requestRow(form, { by: me, impact, approveNow: isAdmin && approveNow, note: approveNote })
    const { data, error } = await supabase.from('fee_concession_register').insert(row).select().single()
    setBusy(false)
    if (error) { fail(error); return }
    setPick(null); setF(o => ({ ...o, value: '', reason: '', to: '' })); setApproveNow(false); setApproveNote('')
    await afterWrite(row.status === 'active' ? `Approved and saved as ${data?.form_no || 'a new entry'}. It applies from ${monthLabel(row.valid_from)}.` : `Request ${data?.form_no || ''} sent for admin approval. Nothing changes in the fee until it is approved.`)
    if (data) printConcessionForm(data)
  }

  const decide = async (r, approve) => {
    const text = (act?.text || '').trim()
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('fee_concession_register')
      .update({ status: approve ? 'active' : 'rejected', decided_by: me, decision_note: text || null }).eq('id', r.id)
    setBusy(false)
    if (error) { fail(error); return }
    await afterWrite(approve ? `${r.form_no || 'Concession'} approved — the lower fee now shows in the ledgers.` : `${r.form_no || 'Request'} rejected.`)
  }
  const endFrom = async r => {
    const last = monthEndOf(act?.month)
    if (!last) { setMsg({ bad: true, t: 'Pick the last month of the concession.' }); return }
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('fee_concession_register').update({ valid_to: last, ended_by: me }).eq('id', r.id)
    setBusy(false)
    if (error) { fail(error); return }
    await afterWrite(`${r.form_no || 'Concession'} ends after ${monthLabel(last)}. Months up to then keep the lower fee.`)
  }
  const cancel = async r => {
    const why = (act?.text || '').trim()
    if (why.length < 5) { setMsg({ bad: true, t: 'Give a reason (at least 5 characters).' }); return }
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('fee_concession_register').update({ status: 'revoked', revoked_reason: why, revoked_by: me }).eq('id', r.id)
    setBusy(false)
    if (error) { fail(error); return }
    await afterWrite(`${r.form_no || 'Concession'} cancelled.`)
  }

  const withState = useMemo(() => rows.map(r => ({ ...r, _s: stateOf(r) })), [rows])
  const pending = withState.filter(r => r._s === 'pending')
  const summary = useMemo(() => {
    const live = withState.filter(r => isLive(r._s))
    return {
      active: live.length,
      students: new Set(live.map(r => String(r.gcc))).size,
      monthly: live.filter(r => dayOf(r.valid_from) <= new Date().toLocaleDateString('en-CA')).reduce((t, r) => t + monthlyValue(r), 0),
      expiring: withState.filter(r => r._s === 'expiring').length,
    }
  }, [withState])
  const courses = useMemo(() => [...new Set(rows.map(courseOfRow))].sort(), [rows, byGcc]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = withState.filter(r => {
    if (kindF !== 'All' && r.kind !== kindF) return false
    if (stateF === 'live' ? !isLive(r._s) : stateF !== 'All' && r._s !== stateF) return false
    if (courseF !== 'All' && courseOfRow(r) !== courseF) return false
    const t = lq.trim().toLowerCase()
    return !t || [r.gcc, r.student_name, r.reason, r.form_no].some(v => String(v || '').toLowerCase().includes(t))
  })
  const exportRows = list => downloadCsv(list.map(r => ({
    form_no: r.form_no || '', gcc: r.gcc, student: r.student_name || '', course: courseOfRow(r), batch: r.batch || '', category: r.kind,
    concession: describe(r), basis: r.basis, value: r.value, applies_to: r.applies_to, from: dayOf(r.valid_from), until: dayOf(r.valid_to),
    less_per_month: monthlyValue(r), state: (STATUS[r._s] || {}).label || r._s, reason: r.reason,
    requested_by: r.requested_by || '', approved_by: r.decided_by || r.approved_by || '', decided_on: dayOf(r.decided_at), cancel_reason: r.revoked_reason || '',
  })), 'concessions')

  const reportRows = withState.filter(r => isLive(r._s) || r._s === 'pending')
  const groups = courseReport(rows, courseOfRow)

  const actPanel = r => act?.id === r.id && (
    <tr><td colSpan={9} style={{ ...cell, whiteSpace: 'normal', background: '#f8fafc' }}>
      {act.mode === 'end' ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...lbl, margin: 0 }}>Last month with the lower fee<input type="month" value={act.month || ''} min={dayOf(r.valid_from).slice(0, 7)} max={r.valid_to ? dayOf(r.valid_to).slice(0, 7) : undefined} onChange={e => setAct(a => ({ ...a, month: e.target.value }))} style={{ ...inp, width: 180, marginTop: 4 }} /></label>
          <button disabled={busy} onClick={() => endFrom(r)} style={btnPrimary}>End concession</button>
          <button onClick={() => setAct(null)} style={btn}>Close</button>
          <div style={{ fontSize: 11.5, color: '#5d6b82', flexBasis: '100%' }}>Months up to the one you pick keep the lower fee; from the next month the standard fee applies. It can't be extended later — request a new one instead.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...lbl, margin: 0, flex: 1, minWidth: 220 }}>{act.mode === 'approve' ? (isFullWaiver(r, r.fee_impact ? { course: r.fee_impact.course?.std, flat: r.fee_impact.flat?.std } : null) ? 'Approval note (required — this makes the fee ₹0)' : 'Approval note (optional)') : act.mode === 'reject' ? 'Why is it rejected?' : 'Why cancel it?'}
            <input value={act.text || ''} onChange={e => setAct(a => ({ ...a, text: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
          </label>
          {act.mode === 'approve' && <button disabled={busy} onClick={() => decide(r, true)} style={{ ...btnPrimary, background: '#166534', borderColor: '#166534' }}>Approve</button>}
          {act.mode === 'reject' && <button disabled={busy} onClick={() => decide(r, false)} style={{ ...btnPrimary, background: '#991b1b', borderColor: '#991b1b' }}>Reject</button>}
          {act.mode === 'cancel' && <button disabled={busy} onClick={() => cancel(r)} style={{ ...btnPrimary, background: '#991b1b', borderColor: '#991b1b' }}>Cancel concession</button>}
          <button onClick={() => setAct(null)} style={btn}>Close</button>
          {act.mode === 'cancel' && <div style={{ fontSize: 11.5, color: '#991b1b', flexBasis: '100%' }}>Cancelling removes the concession from ALL its months, including months already settled — those months will show as due again. To stop it from a month on, use “End” instead.</div>}
        </div>
      )}
    </td></tr>
  )

  const table = (list, empty) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Form', 'Student', 'Course', 'Category', 'Concession', 'Months', 'Status', 'Requested / approved', ''].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
        <tbody>
          {list.map(r => (
            <Fragment key={r.id}><tr>
              <td style={{ ...cell, fontWeight: 700 }}>{r.form_no || '—'}</td>
              <td style={cell}><b>{r.student_name || '—'}</b> <span style={{ color: '#8a93a6' }}>({r.gcc})</span><StudentJump gcc={r.gcc} students={students} onCollect={onCollect} onLedger={onLedger} /></td>
              <td style={cell}>{courseOfRow(r)}{r.batch ? <span style={{ color: '#8a93a6' }}> · {r.batch}</span> : ''}</td>
              <td style={cell}>{r.kind}</td>
              <td style={{ ...cell, whiteSpace: 'normal', minWidth: 170 }}><b>{describe(r)}</b>{monthlyValue(r) > 0 && <div style={{ fontSize: 11, color: '#5d6b82' }}>{inr(monthlyValue(r))} less a month</div>}<div style={{ fontSize: 11, color: '#8a93a6' }} title={r.reason}>{String(r.reason || '').slice(0, 60)}{String(r.reason || '').length > 60 ? '…' : ''}</div></td>
              <td style={cell}>{monthLabel(r.valid_from)} →<br />{r.valid_to ? monthLabel(r.valid_to) : 'open'}</td>
              <td style={cell}><Pill s={r._s} />{r.revoked_reason && <div style={{ fontSize: 11, color: '#991b1b', maxWidth: 160, whiteSpace: 'normal' }}>{r.revoked_reason}</div>}</td>
              <td style={{ ...cell, fontSize: 11.5 }}>{r.requested_by || '—'} · {when(r.created_at)}{r.decided_at && <div>{r._s === 'rejected' ? '✗' : '✓'} {r.decided_by || r.approved_by} · {when(r.decided_at)}</div>}{!r.decided_at && r.approved_by && <div>✓ {r.approved_by}</div>}</td>
              <td style={{ ...cell, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => printConcessionForm(r)} style={{ ...btn, padding: '4px 10px' }} title="Print the approval form">🖨 Form</button>
                {isAdmin && r._s === 'pending' && <>
                  <button onClick={() => setAct({ id: r.id, mode: 'approve' })} style={{ ...btn, padding: '4px 10px', color: '#166534' }}>Approve</button>
                  <button onClick={() => setAct({ id: r.id, mode: 'reject' })} style={{ ...btn, padding: '4px 10px', color: '#991b1b' }}>Reject</button>
                </>}
                {isAdmin && isLive(r._s) && <>
                  <button onClick={() => setAct({ id: r.id, mode: 'end', month: thisMonth() })} style={{ ...btn, padding: '4px 10px' }}>End</button>
                  <button onClick={() => setAct({ id: r.id, mode: 'cancel' })} style={{ ...btn, padding: '4px 10px', color: '#991b1b' }}>Cancel</button>
                </>}
              </td>
            </tr>
            {actPanel(r)}</Fragment>
          ))}
          {list.length === 0 && <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: '#8a93a6', padding: 24 }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      {setup && <div style={{ ...note(true), background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>⚠ {SETUP_MSG}</div>}
      {migrate && !setup && <div style={{ ...note(true), background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>⚠ {MIGRATE_MSG}</div>}
      {loadErr && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load concessions: {loadErr}</div>}
      {msg && <div style={note(msg.bad)}>{msg.t}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        {[{ l: 'Active concessions', v: summary.active, c: '#166534' }, { l: 'Students', v: summary.students, c: '#1e3a6e' }, { l: 'Course fee given up / month', v: inr(summary.monthly), c: '#1e3a6e' }, { l: 'Waiting for approval', v: pending.length, c: pending.length ? '#9a5b00' : '#4b5870' }, { l: 'Ending in 30 days', v: summary.expiring, c: summary.expiring ? '#b45309' : '#4b5870' }].map(k => (
          <div key={k.l} style={{ background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase' }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.c, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['request', '➕ New concession'], ['pending', `⏳ Waiting for approval${pending.length ? ` (${pending.length})` : ''}`], ['register', '📋 Register'], ['report', '📊 By course']].map(([id, t]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} style={tabBtn(view === id)}>{t}</button>
        ))}
      </div>

      {view === 'request' && (
        <div style={card}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e3d8' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a6e' }}>🎓 Lower fee in the same course</div>
            <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>For a sibling, staff ward, scholarship, merit or hardship. The student stays in their course; {isAdmin ? 'you can approve it straight away or leave it for another admin.' : 'an admin approves it before the fee changes.'} To change the course or hostel type, use Course / Mode Change.</div>
          </div>
          <div style={{ padding: 16 }}>
            <label style={lbl}>Student (name or GCC)
              <input value={pick ? `${pick.gcc_no} · ${pick.name}` : sq} onChange={e => { setPick(null); setSq(e.target.value) }} placeholder="Search…" style={{ ...inp, marginTop: 4, maxWidth: 380 }} />
            </label>
            {!pick && matches.length > 0 && (
              <div style={{ border: '1px solid #e8e3d8', borderRadius: 8, marginTop: 6, maxWidth: 380, overflow: 'hidden', background: '#fff' }}>
                {matches.map(s => <div key={s.id ?? s.gcc_no} onClick={() => { setPick(s); setSq('') }} style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid #f3f0e8' }}><b>{s.gcc_no}</b> · {s.name} <span style={{ color: '#8a93a6' }}>· {s.course || '—'} {s.batch || ''} · {s.hostel_type || ''}</span></div>)}
              </div>
            )}
            {pick && <div style={{ fontSize: 12, color: '#4b5870', marginTop: 6 }}>{pick.course || '—'} · {pick.batch || '—'} · {pick.hostel_type || '—'}{rates ? <> · standard course fee <b>{inr(rates.course)}</b>/month, flat fee <b>{inr(rates.flat)}</b></> : ' · loading fees…'}</div>}
            {dup.length > 0 && <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '6px 10px', marginTop: 8 }}>This student already has {dup.length} concession{dup.length > 1 ? 's' : ''} ({dup.map(r => `${r.form_no || ''} ${describe(r)}`).join('; ')}). A new one adds on top.</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12 }}>
              <label style={lbl}>Category<select value={f.kind} onChange={e => set('kind', e.target.value)} style={{ ...inp, marginTop: 4 }}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
              <label style={lbl}>How<select value={f.basis} onChange={e => { set('basis', e.target.value); if (e.target.value === 'fixed_fee' && f.applies_to === 'both') set('applies_to', 'course') }} style={{ ...inp, marginTop: 4 }}>{BASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label style={lbl}>{f.basis === 'percent' ? 'Percent off (%)' : f.basis === 'fixed_fee' ? 'Special fee a month (₹)' : 'Amount (₹)'}<input type="number" min="0" value={f.value} onChange={e => set('value', e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
              <label style={lbl}>On<select value={f.applies_to} onChange={e => set('applies_to', e.target.value)} style={{ ...inp, marginTop: 4 }}>{APPLIES.filter(a => f.basis !== 'fixed_fee' || a[0] !== 'both').map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label style={lbl}>From month<input type="month" value={f.from} onChange={e => set('from', e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
              <label style={lbl}>Until month (blank = no end)<input type="month" value={f.to} min={f.from} onChange={e => set('to', e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
            </div>
            <label style={{ ...lbl, marginTop: 12 }}>Reason (who, why — goes on the printed form)
              <textarea value={f.reason} onChange={e => set('reason', e.target.value)} rows={2} style={{ ...inp, marginTop: 4, resize: 'vertical' }} />
            </label>

            {impact && (
              <div style={{ marginTop: 12, border: '1px solid #e8e3d8', borderRadius: 10, overflow: 'hidden', maxWidth: 560 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Fee', 'Standard', 'After', 'Less by'].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
                  <tbody>
                    <tr><td style={cell}>Course fee (a month)</td><td style={cell}>{inr(impact.course.std)}</td><td style={{ ...cell, fontWeight: 800 }}>{inr(impact.course.after)}</td><td style={cell}>{inr(impact.perMonth)}</td></tr>
                    <tr><td style={cell}>Flat (hostel / day) fee</td><td style={cell}>{inr(impact.flat.std)}</td><td style={{ ...cell, fontWeight: 800 }}>{inr(impact.flat.after)}</td><td style={cell}>{inr(impact.flatLess)}</td></tr>
                  </tbody>
                </table>
                {impact.oneTime > 0 && <div style={{ padding: '6px 12px', fontSize: 12 }}>One-time {inr(impact.oneTime)} off in {monthLabel(form.from + '-01')}.</div>}
              </div>
            )}
            {full && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>This makes the fee ₹0 (full waiver). It needs an admin's approval with a note.</div>}

            {isAdmin && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#1e3a6e' }}>
                  <input type="checkbox" checked={approveNow} onChange={e => setApproveNow(e.target.checked)} /> Approve it now (you are an admin)
                </label>
                {approveNow && <input value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder={full ? 'Approval note (required for a ₹0 fee)' : 'Approval note (optional)'} style={{ ...inp, marginTop: 6, maxWidth: 480, borderColor: fullNoteBad ? '#fca5a5' : undefined }} />}
              </div>
            )}
            {err && (pick || f.value || f.reason) && <div style={{ fontSize: 12, color: '#991b1b', marginTop: 10 }}>{err}</div>}
            <button onClick={save} disabled={!canSave} style={{ ...btnPrimary, marginTop: 12, opacity: canSave ? 1 : .5, cursor: canSave ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : isAdmin && approveNow ? 'Approve & print form' : 'Send for approval & print form'}</button>
          </div>
        </div>
      )}

      {view === 'pending' && (
        <div style={card}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Waiting for approval {!isAdmin && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#5d6b82' }}>· an admin decides these</span>}</div>
          {table(pending, 'No requests waiting.')}
        </div>
      )}

      {view === 'register' && (
        <div style={card}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Register</div>
            <input value={lq} onChange={e => setLq(e.target.value)} placeholder="Search name / GCC / form…" style={{ ...inp, width: 190 }} />
            <select value={courseF} onChange={e => setCourseF(e.target.value)} style={{ ...inp, width: 'auto' }}>{['All', ...courses].map(k => <option key={k} value={k}>{k === 'All' ? 'All courses' : k}</option>)}</select>
            <select value={kindF} onChange={e => setKindF(e.target.value)} style={{ ...inp, width: 'auto' }}>{['All', ...KINDS].map(k => <option key={k} value={k}>{k === 'All' ? 'All categories' : k}</option>)}</select>
            <select value={stateF} onChange={e => setStateF(e.target.value)} style={{ ...inp, width: 'auto' }}>{[['live', 'Active now'], ['All', 'Everything'], ['pending', 'Waiting'], ['expiring', 'Ending ≤30d'], ['expired', 'Ended'], ['rejected', 'Rejected'], ['revoked', 'Cancelled']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <button onClick={() => exportRows(shown)} disabled={!shown.length} style={btn}>⬇ CSV</button>
          </div>
          {table(shown, 'No entries')}
        </div>
      )}

      {view === 'report' && (
        <div style={card}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 800, color: '#1e3a6e' }}>Concessions by course <span style={{ fontSize: 11.5, fontWeight: 600, color: '#5d6b82' }}>· active now, plus waiting</span></div>
            <button onClick={() => printConcessionReport({ groups, rows: reportRows, courseOf: courseOfRow })} disabled={!groups.length} style={btn}>🖨 Print</button>
            <button onClick={() => exportRows(reportRows)} disabled={!reportRows.length} style={btn}>⬇ CSV</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Course', 'Students', 'Active', 'Course fee given up / month', 'By category', 'Waiting', ''].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.course}>
                    <td style={{ ...cell, fontWeight: 800 }}>{g.course}</td>
                    <td style={cell}>{g.students}</td>
                    <td style={cell}>{g.entries}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{inr(g.monthly)}</td>
                    <td style={{ ...cell, whiteSpace: 'normal' }}>{Object.entries(g.kinds).map(([k, c]) => `${k} ${c}`).join(' · ') || '—'}</td>
                    <td style={cell}>{g.pending || ''}</td>
                    <td style={cell}><button onClick={() => { setCourseF(g.course); setStateF('live'); setView('register') }} style={{ ...btn, padding: '4px 10px' }}>List</button></td>
                  </tr>
                ))}
                {groups.length > 0 && <tr><td style={{ ...cell, fontWeight: 800 }}>Total</td><td style={{ ...cell, fontWeight: 800 }}>{groups.reduce((t, g) => t + g.students, 0)}</td><td style={{ ...cell, fontWeight: 800 }}>{groups.reduce((t, g) => t + g.entries, 0)}</td><td style={{ ...cell, fontWeight: 800 }}>{inr(groups.reduce((t, g) => t + g.monthly, 0))}</td><td style={cell} /><td style={{ ...cell, fontWeight: 800 }}>{groups.reduce((t, g) => t + g.pending, 0) || ''}</td><td style={cell} /></tr>}
                {groups.length === 0 && <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', color: '#8a93a6', padding: 24 }}>No active concessions.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11.5, color: '#5d6b82' }}>Fee given up is how much less course fee the student pays each month, worked out when the concession was requested. Older entries made before this form count only a fixed ₹-a-month amount.</div>
        </div>
      )}
    </div>
  )
}

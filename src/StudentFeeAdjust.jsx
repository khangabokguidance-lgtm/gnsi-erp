// StudentFeeAdjust.jsx — "Fee adjustments" for ONE student (admin). One place to fix a
// student's fees month by month:
//   🏠 Hostel type  — Boarder / Day Boarder / Day Scholar for chosen months (or onward)
//   📚 Course       — move to another course / batch from a month
//   🏷 Discount     — a % or ₹ off chosen months
//   🤝 Waive        — waive the due of chosen months (financial condition etc.)
// Nothing here rewrites a payment: earlier months keep what was charged and paid, and every
// change is dated, explained, audited and can be undone / removed. The month table shows the
// student's real ledger and refreshes after each change.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getFeeRates, getSessionYear } from './feeEngine'
import { buildAllLedgers } from './feeLedgerBulk'
import { loadStudentHistory, HOSTEL_TYPE_LIST, changeHostelTypeRange, undoLastChange, timeline as hostelTimeline } from './hostelHistory'
import { loadStudentCourseHistory, changeCourse, undoLastCourseChange } from './courseHistory'
import { courseTimeline } from './lib/courseHistory'
import { addDiscount, addWaiver, loadStudentRegister, revokeEntry } from './feeAdjust'
import { CONCESSION_REASONS } from './feeConcessions'
import { monthKey, keyLabel, discountOf } from './lib/adjustPlan'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const C = { ink: '#0B1E3D', gold: '#C9A24B', line: '#e5e0d3', mut: '#64748b', bad: '#b42318', ok: '#146c3a', tint: '#f8f5ec' }
const field = { padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, background: '#fff', fontFamily: 'inherit', minWidth: 0, width: '100%', boxSizing: 'border-box' }
const lbl = { display: 'block', fontSize: 10.5, fontWeight: 800, color: C.mut, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }
const tab = on => ({ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
const go = busy => ({ padding: '10px 18px', borderRadius: 10, border: 'none', background: busy ? '#d9cfae' : `linear-gradient(180deg,#E9C979,${C.gold})`, color: C.ink, fontWeight: 800, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
const ghost = { padding: '8px 13px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
const STATUS = { paid: ['PAID', '#146c3a', '#e7f6ec'], advance: ['ADVANCE', '#1e3a6e', '#eef2f9'], short: ['SHORT', '#9a5b00', '#fff4dc'], due: ['DUE', '#b42318', '#fde8e6'], upcoming: ['Upcoming', '#64748b', '#f1f5f9'], before: ['—', '#94a3b8', '#fff'] }

export default function StudentFeeAdjust({ student: studentProp, isAdmin, me = 'Admin', onChanged, onClose }) {
  const session = getSessionYear()
  const [stu, setStu] = useState(studentProp)
  const [tabId, setTabId] = useState('hostel')
  const [reload, setReload] = useState(0)
  const [ledger, setLedger] = useState(null)            // { rows, error }
  const [hostelChanges, setHostelChanges] = useState([])
  const [courseChanges, setCourseChanges] = useState([])
  const [register, setRegister] = useState({ rows: [], setupNeeded: false, error: null })
  const [structures, setStructures] = useState([])
  const [sel, setSel] = useState(() => new Set())       // selected month keys ('2026-10')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)                  // { ok, t }
  const [reason, setReason] = useState('')
  const [staffName, setStaffName] = useState('')
  const [note, setNote] = useState('')
  // hostel
  const [hTo, setHTo] = useState(''), [hFrom, setHFrom] = useState(''), [hUntil, setHUntil] = useState('')
  // course
  const [cCourse, setCCourse] = useState(''), [cBatch, setCBatch] = useState(''), [cFrom, setCFrom] = useState(''), [cPreview, setCPreview] = useState(null)
  // discount
  const [dBasis, setDBasis] = useState('percent'), [dValue, setDValue] = useState(''), [dApplies, setDApplies] = useState('both')
  // waive
  const [wAmt, setWAmt] = useState({})

  const curType = stu.hostel_type || 'Day Scholar'

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [items, hist, ch, reg, st] = await Promise.all([
          buildAllLedgers([stu], session),
          loadStudentHistory(stu.gcc_no),
          loadStudentCourseHistory(stu.gcc_no),
          loadStudentRegister(stu.gcc_no),
          supabase.from('fee_structures').select('course, batch').eq('session_year', session),
        ])
        if (!live) return
        setLedger({ rows: items[0]?.reg?.rows || [], error: null })
        setHostelChanges(hist); setCourseChanges(ch); setRegister(reg); setStructures(st.data || [])
      } catch (e) { if (live) setLedger({ rows: [], error: e.message }) }
    })()
    return () => { live = false }
  }, [stu, session, reload])

  const rows = useMemo(() => (ledger?.rows || []).map(r => ({ ...r, key: monthKey(r.month, r.year) })), [ledger])
  const months = useMemo(() => rows.filter(r => r.status !== 'before'), [rows])
  const courses = useMemo(() => [...new Set(structures.map(s => s.course).filter(Boolean))].sort(), [structures])
  const batches = useMemo(() => [...new Set(structures.filter(s => s.course === cCourse).map(s => s.batch).filter(Boolean))].sort(), [structures, cCourse])

  // Live preview of the new course's rates at the student's own hostel type.
  useEffect(() => {
    let live = true
    ;(async () => {
      if (!cCourse) { setCPreview(null); return }
      try {
        const [now, next] = await Promise.all([getFeeRates(session, stu.course || '', stu.batch || '', curType), getFeeRates(session, cCourse, cBatch, curType)])
        if (live) setCPreview({ now, next })
      } catch { if (live) setCPreview(null) }
    })()
    return () => { live = false }
  }, [cCourse, cBatch, stu.course, stu.batch, curType, session])

  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const selectedRows = months.filter(r => sel.has(r.key))
  const run = async (fn, okMsg, patch) => {
    if (!isAdmin) { setMsg({ ok: false, t: 'Only an admin can adjust fees.' }); return }
    setBusy(true); setMsg(null)
    try {
      await fn()
      setMsg({ ok: true, t: okMsg })
      const next = patch ? { ...stu, ...patch } : stu
      setStu(next); setReload(n => n + 1); setSel(new Set()); setWAmt({})
      onChanged?.(next)
    } catch (e) { setMsg({ ok: false, t: e.message || 'Could not save.' }) }
    setBusy(false)
  }
  const reasonArgs = { kind: reason, staffName, note }

  // ── actions ──────────────────────────────────────────────────────────────────
  const applyHostel = () => run(async () => {
    await changeHostelTypeRange({ student: stu, toType: hTo, from: hFrom, until: hUntil, reason: note.trim() || 'Fee adjustment', by: me, changes: hostelChanges })
  }, hUntil ? `${stu.name} is a ${hTo} from ${keyLabel(hFrom.slice(0, 7))} to ${keyLabel(hUntil.slice(0, 7))}, then back to ${curType}.` : `${stu.name} is now a ${hTo} from ${keyLabel(hFrom.slice(0, 7))} — earlier months unchanged.`,
  hUntil ? null : { hostel_type: hTo })
  const applyCourse = () => run(async () => {
    await changeCourse({ student: stu, toCourse: cCourse, toBatch: cBatch || stu.batch || '', effectiveFrom: cFrom, reason: note.trim() || 'Fee adjustment', by: me, changes: courseChanges })
  }, `${stu.name} moves to ${cCourse}${cBatch ? ' · ' + cBatch : ''} from ${keyLabel(cFrom.slice(0, 7))} — earlier months stay at the old course's rates.`, { course: cCourse, batch: cBatch || stu.batch || '' })
  const applyDiscount = () => run(async () => {
    await addDiscount({ student: stu, monthKeys: [...sel], basis: dBasis, value: dValue, appliesTo: dApplies, ...reasonArgs, by: me })
  }, `Discount added for ${sel.size} month${sel.size === 1 ? '' : 's'}.`)
  const applyWaiver = () => run(async () => {
    await addWaiver({ student: stu, items: selectedRows.map(r => ({ key: r.key, amount: wAmt[r.key] ?? r.due })), ...reasonArgs, kind: reason || 'Financial hardship', by: me })
  }, `Due waived for ${selectedRows.length} month${selectedRows.length === 1 ? '' : 's'}.`)
  const undoHostel = () => run(async () => { await undoLastChange({ student: stu, changes: hostelChanges, by: me }) }, 'Last hostel type change undone.', { hostel_type: hostelChanges[hostelChanges.length - 1]?.from_type })
  const undoCourse = () => run(async () => { const back = await undoLastCourseChange({ student: stu, changes: courseChanges, by: me }); if (back) setStu(s => ({ ...s, ...back })) }, 'Last course change undone.')
  const removeEntry = e => {
    const why = window.prompt(`Remove this ${e.basis === 'one_time' ? 'waiver' : 'discount'} (${e.reason})?\n\nThe month's fee goes back to what it was. Why?`, '')
    if (why === null) return
    run(() => revokeEntry(e, why, me), 'Removed — the fee is back to normal for those months.')
  }

  const monthOptions = months.map(r => <option key={r.key} value={`${r.key}-01`}>{keyLabel(r.key)}</option>)
  const reasonSelect = (list = CONCESSION_REASONS) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
      <div><label style={lbl}>Reason</label><select style={field} value={reason} onChange={e => setReason(e.target.value)} aria-label="Reason"><option value="">— Choose —</option>{list.map(r => <option key={r}>{r}</option>)}</select></div>
      {reason === 'Staff ward' && <div><label style={lbl}>Name of the staff (required)</label><input style={{ ...field, borderColor: staffName.trim() ? C.line : C.bad }} value={staffName} onChange={e => setStaffName(e.target.value)} aria-label="Name of the staff" /></div>}
      <div><label style={lbl}>Note (optional)</label><input style={field} value={note} onChange={e => setNote(e.target.value)} aria-label="Note" /></div>
    </div>
  )

  const activeRegister = register.rows.filter(r => r.status === 'active')

  return (
    <div role="region" aria-label="Fee adjustments" style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 14px rgba(11,30,61,.07)' }}>
      <div style={{ background: `linear-gradient(135deg,${C.ink},#1d3a78)`, color: '#fff', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }}>🛠</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Fee adjustments — {stu.name}</div>
          <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>GCC-{stu.gcc_no} · {stu.course || 'No course'}{stu.batch ? ` · ${stu.batch}` : ''} · {curType} · Session {session}</div>
        </div>
        <button type="button" onClick={onClose} style={{ ...ghost, background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>✕ Close</button>
      </div>

      <div style={{ padding: 16 }}>
        {!isAdmin && <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, fontSize: 12.5, color: '#9a3412' }}>🔒 Only an admin can adjust fees.</div>}

        {/* ── month table ── */}
        <div style={{ fontSize: 12, color: C.mut, marginBottom: 6 }}>
          {tabId === 'discount' || tabId === 'waive' ? <b style={{ color: C.ink }}>Tick the months to {tabId === 'discount' ? 'discount' : 'waive'}.</b> : 'This is the ledger the changes below affect.'} Charged = this month's fee after any change.
        </div>
        <div style={{ overflowX: 'auto', border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead><tr style={{ background: C.tint, color: C.mut, textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {(tabId === 'discount' || tabId === 'waive') && <th style={{ padding: '8px 10px' }} />}
              {['Month', 'Fee', 'Type', 'Charged', 'Paid', 'Waived', 'Due', 'Status'].map(h => <th key={h} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!ledger && <tr><td colSpan={9} style={{ padding: 16, color: C.mut }}>Loading the ledger…</td></tr>}
              {ledger?.error && <tr><td colSpan={9} style={{ padding: 16, color: C.bad }}>{ledger.error}</td></tr>}
              {months.map(r => {
                const pickable = tabId === 'discount' ? true : tabId === 'waive' ? r.due > 0 : false
                const [stl, fg, bg] = STATUS[r.status] || STATUS.upcoming
                return (
                  <tr key={r.key} style={{ borderTop: `1px solid ${C.tint}`, background: sel.has(r.key) ? '#fdf6e3' : 'transparent' }}>
                    {(tabId === 'discount' || tabId === 'waive') && <td style={{ padding: '7px 10px' }}><input type="checkbox" aria-label={`Select ${keyLabel(r.key)}`} checked={sel.has(r.key)} disabled={!pickable || busy} title={pickable ? '' : 'Nothing due to waive'} onChange={() => toggle(r.key)} /></td>}
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{keyLabel(r.key)}</td>
                    <td style={{ padding: '7px 10px' }}>{r.head}</td>
                    <td style={{ padding: '7px 10px', color: C.mut }}>{r.hostelType || curType}</td>
                    <td style={{ padding: '7px 10px' }}>{inr(r.expected)}</td>
                    <td style={{ padding: '7px 10px' }}>{inr(r.paidAmt)}</td>
                    <td style={{ padding: '7px 10px', color: (r.waived || 0) > 0 ? C.ok : C.mut }}>{(r.waived || 0) > 0 ? inr(r.waived) : '—'}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 800, color: r.due > 0 ? C.bad : C.mut }}>{r.due > 0 ? inr(r.due) : '—'}</td>
                    <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, borderRadius: 999, padding: '2px 9px' }}>{stl}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── tabs ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 12px' }} role="tablist">
          {[['hostel', '🏠 Hostel type'], ['course', '📚 Course change'], ['discount', '🏷 Discount'], ['waive', '🤝 Waive (financial condition)']].map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tabId === id} style={tab(tabId === id)} onClick={() => { setTabId(id); setMsg(null); setSel(new Set()) }}>{l}</button>)}
        </div>

        <div style={{ background: C.tint, borderRadius: 12, padding: 14, border: `1px solid ${C.line}` }}>
          {tabId === 'hostel' && (<>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>Currently <b>{curType}</b>. Choose the new type and the months it applies to. Leave “until” empty to change <b>from that month onward</b>; set it for a <b>temporary</b> change (the student goes back to {curType} afterwards).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
              <div><label style={lbl}>New hostel type</label><select style={field} value={hTo} onChange={e => setHTo(e.target.value)} aria-label="New hostel type"><option value="">— Choose —</option>{HOSTEL_TYPE_LIST.filter(t => t !== curType).map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label style={lbl}>From month</label><select style={field} value={hFrom} onChange={e => setHFrom(e.target.value)} aria-label="From month"><option value="">— Choose —</option>{monthOptions}</select></div>
              <div><label style={lbl}>Until month (optional)</label><select style={field} value={hUntil} onChange={e => setHUntil(e.target.value)} aria-label="Until month"><option value="">Onward (no end)</option>{monthOptions}</select></div>
              <div><label style={lbl}>Reason / note</label><input style={field} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Left the hostel" aria-label="Reason" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" style={go(busy || !hTo || !hFrom || !isAdmin)} disabled={busy || !hTo || !hFrom || !isAdmin} onClick={applyHostel}>{busy ? 'Saving…' : 'Save hostel type change'}</button>
              {hostelChanges.length > 0 && <button type="button" style={{ ...ghost, color: C.bad, marginLeft: 'auto' }} disabled={busy || !isAdmin} onClick={undoHostel}>↶ Undo last ({hostelChanges[hostelChanges.length - 1].to_type} from {String(hostelChanges[hostelChanges.length - 1].effective_from).slice(0, 7)})</button>}
            </div>
          </>)}

          {tabId === 'course' && (<>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>Currently <b>{stu.course || '—'}{stu.batch ? ` · ${stu.batch}` : ''}</b>. Months before the change stay at the old course's rates; from the month you pick, the new course's fees apply. Payments already made are not touched.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
              <div><label style={lbl}>New course</label><select style={field} value={cCourse} onChange={e => { setCCourse(e.target.value); setCBatch('') }} aria-label="New course"><option value="">— Choose —</option>{courses.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>New batch</label><select style={field} value={cBatch} onChange={e => setCBatch(e.target.value)} aria-label="New batch" disabled={!cCourse}><option value="">{batches.length ? '— Choose —' : 'Keep current batch'}</option>{batches.map(b => <option key={b}>{b}</option>)}</select></div>
              <div><label style={lbl}>Starts from month</label><select style={field} value={cFrom} onChange={e => setCFrom(e.target.value)} aria-label="Course change from month"><option value="">— Choose —</option>{monthOptions}</select></div>
              <div><label style={lbl}>Reason / note</label><input style={field} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Shifted to Class 7" aria-label="Reason" /></div>
            </div>
            {cPreview && <div style={{ marginTop: 10, fontSize: 12.5, background: '#fff', border: `1px dashed ${C.gold}`, borderRadius: 10, padding: '9px 12px' }}>
              At {curType}: course fee {inr(cPreview.now.courseFee)} → <b>{inr(cPreview.next.courseFee)}</b>/month · flat fee {inr(cPreview.now.flatFee)} → <b>{inr(cPreview.next.flatFee)}</b>/month{cPreview.next.usingFallbackRates ? <span style={{ color: C.bad }}> · ⚠ this course/batch isn't set up in Fee Setup yet</span> : ''}
            </div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" style={go(busy || !cCourse || !cFrom || !isAdmin)} disabled={busy || !cCourse || !cFrom || !isAdmin} onClick={applyCourse}>{busy ? 'Saving…' : 'Save course change'}</button>
              {courseChanges.length > 0 && <button type="button" style={{ ...ghost, color: C.bad, marginLeft: 'auto' }} disabled={busy || !isAdmin} onClick={undoCourse}>↶ Undo last ({courseChanges[courseChanges.length - 1].to_course} from {String(courseChanges[courseChanges.length - 1].effective_from).slice(0, 7)})</button>}
            </div>
          </>)}

          {tabId === 'discount' && (<>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>Tick the months above, then choose the discount. It reduces each month's fee; the student pays the rest.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Type</label><select style={field} value={dBasis} onChange={e => setDBasis(e.target.value)} aria-label="Discount type"><option value="percent">Percent %</option><option value="fixed_per_month">Fixed ₹ per month</option></select></div>
              <div><label style={lbl}>{dBasis === 'percent' ? 'Percent (1–100)' : 'Amount ₹'}</label><input type="number" min="0" style={field} value={dValue} onChange={e => setDValue(e.target.value)} aria-label="Discount value" /></div>
              <div><label style={lbl}>Applies to</label><select style={field} value={dApplies} onChange={e => setDApplies(e.target.value)} aria-label="Applies to"><option value="both">Course + flat fee</option><option value="course">Course fee only</option><option value="flat">Flat fee only</option></select></div>
            </div>
            {reasonSelect()}
            {selectedRows.length > 0 && Number(dValue) > 0 && <div style={{ marginTop: 10, fontSize: 12.5, background: '#fff', border: `1px dashed ${C.gold}`, borderRadius: 10, padding: '9px 12px' }}>
              {selectedRows.map(r => { const isFlat = r.head === 'Flat Fee'; const applies = dApplies === 'both' || (dApplies === 'flat' ? isFlat : !isFlat); const d = applies ? discountOf(r.expected, dBasis, dValue) : 0; return <div key={r.key}>{keyLabel(r.key)}: {inr(r.expected)} − {inr(d)} = <b>{inr(r.expected - d)}</b></div> })}
            </div>}
            <div style={{ marginTop: 12 }}><button type="button" style={go(busy || !sel.size || !(Number(dValue) > 0) || !isAdmin)} disabled={busy || !sel.size || !(Number(dValue) > 0) || !isAdmin} onClick={applyDiscount}>{busy ? 'Saving…' : `Give discount for ${sel.size || 0} month${sel.size === 1 ? '' : 's'}`}</button></div>
          </>)}

          {tabId === 'waive' && (<>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>For a family in financial difficulty. Tick the months with a due; the amount defaults to the full due and can be lowered to waive only part. The waived amount is recorded against the month — no payment is invented.</div>
            {selectedRows.length > 0 && <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              {selectedRows.map(r => <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
                <b style={{ minWidth: 70 }}>{keyLabel(r.key)}</b> due {inr(r.due)} · waive ₹
                <input type="number" min="0" max={r.due} style={{ ...field, width: 110 }} value={wAmt[r.key] ?? r.due} onChange={e => setWAmt(w => ({ ...w, [r.key]: Math.min(Number(e.target.value) || 0, r.due) }))} aria-label={`Amount to waive for ${keyLabel(r.key)}`} />
              </div>)}
            </div>}
            {reasonSelect()}
            {(() => { const total = selectedRows.reduce((t, r) => t + Math.min(Number(wAmt[r.key] ?? r.due) || 0, r.due), 0); return (<div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={go(busy || !selectedRows.length || !(total > 0) || !isAdmin)} disabled={busy || !selectedRows.length || !(total > 0) || !isAdmin} onClick={applyWaiver}>{busy ? 'Saving…' : `Waive ${inr(total)}`}</button>
              <span style={{ fontSize: 12, color: C.mut }}>{reason ? '' : 'Reason defaults to Financial hardship.'}</span></div>) })()}
          </>)}

          {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: msg.ok ? '#e7f6ec' : '#fde8e6', color: msg.ok ? C.ok : C.bad, border: `1px solid ${msg.ok ? '#bfe3cb' : '#f5c2bd'}` }}>{msg.ok ? '✓ ' : ''}{msg.t}</div>}
        </div>

        {/* ── what's on file ── */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Adjustments on file</div>
          {register.setupNeeded && <div style={{ fontSize: 12.5, color: '#9a3412', marginBottom: 6 }}>⚙ Discounts and waivers need supabase/migrations/20261009_fee_dayclose_refunds_register.sql run in Supabase.</div>}
          {!hostelChanges.length && !courseChanges.length && !activeRegister.length && <div style={{ fontSize: 12.5, color: C.mut }}>None — this student is on the standard fees.</div>}
          <div style={{ display: 'grid', gap: 6 }}>
            {hostelChanges.length > 0 && <div style={{ fontSize: 12.5 }}>🏠 <b>Hostel type:</b> {hostelTimeline(stu, hostelChanges).map(s => `${s.type}${s.from ? ' from ' + String(s.from).slice(0, 7) : ''}`).join(' → ')}</div>}
            {courseChanges.length > 0 && <div style={{ fontSize: 12.5 }}>📚 <b>Course:</b> {courseTimeline(stu, courseChanges).map(s => `${s.course}${s.batch ? ' · ' + s.batch : ''}${s.from ? ' from ' + String(s.from).slice(0, 7) : ''}`).join(' → ')}</div>}
            {activeRegister.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, padding: '6px 10px', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10 }}>
                <span>{e.basis === 'one_time' ? '🤝' : '🏷'}</span>
                <span style={{ flex: 1, minWidth: 200 }}><b>{e.basis === 'percent' ? `${Number(e.value)}%` : inr(e.value)}{e.basis === 'fixed_per_month' ? '/month' : ''}</b> · {String(e.valid_from).slice(0, 7)}{e.valid_to && String(e.valid_to).slice(0, 7) !== String(e.valid_from).slice(0, 7) ? ` → ${String(e.valid_to).slice(0, 7)}` : ''} · {e.reason}</span>
                {isAdmin && <button type="button" style={{ ...ghost, color: C.bad, padding: '4px 10px' }} disabled={busy} onClick={() => removeEntry(e)}>Remove</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// CourseModeChange.jsx — Fees → "Course / Mode Change".
//
// Move a student to another course / batch and/or hostel type (Boarder / Day Boarder /
// Day Scholar) MIDWAY through the session, from a chosen month:
//   • any staff member fills in a request (student, new course / mode, start month,
//     reason) and sees the fee impact before sending it;
//   • nothing is re-priced until an admin approves it here — the database applies the
//     change, the history and the audit entry in one step;
//   • every request prints as an A4 approval form with signature boxes;
//   • months before the start month keep the old course / type and fees, and receipts
//     already issued are never touched — the Student Fee Ledger and the Course-wise
//     Ledger show the new rate only from the start month;
//   • admins can undo the latest change (with a reason).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getFeeRates, getSessionYear } from './feeEngine'
import { loadStudentHistory, undoLastChange, HOSTEL_TYPE_LIST, timeline as hostelTimeline } from './hostelHistory'
import { loadStudentCourseHistory, undoLastCourseChange, clearCourseHistoryCache } from './courseHistory'
import { courseTimeline } from './lib/courseHistory'
import { requestChange, decideRequest, cancelRequest, loadRequests } from './courseModeRpc'
import { sessionMonths, feeImpact, changeLines, validateRequest, monthLabel, courseText, STATUS } from './lib/courseModeChange'
import { printApprovalForm } from './courseModePrint'

const C = { ink: '#0B1E3D', gold: '#C9A24B', line: '#e5e0d3', mut: '#64748b', bad: '#b42318', ok: '#146c3a', tint: '#f8f5ec' }
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const field = { padding: '9px 10px', border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5, background: '#fff', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minWidth: 0 }
const lbl = { display: 'block', fontSize: 10.5, fontWeight: 800, color: C.mut, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }
const card = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }
const pill = on => ({ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })
const go = off => ({ padding: '10px 18px', borderRadius: 10, border: 'none', background: off ? '#d9cfae' : `linear-gradient(180deg,#E9C979,${C.gold})`, color: C.ink, fontWeight: 800, fontSize: 13, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
const ghost = { padding: '8px 13px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
const when = t => t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

export default function CourseModeChange({ students = [], isAdmin, currentUser, onChanged }) {
  const me = currentUser?.userName || currentUser?.name || (isAdmin ? 'Admin' : 'Staff')
  const session = getSessionYear()
  const months = useMemo(() => sessionMonths(session), [session])
  const [view, setView] = useState('new')              // 'new' | 'requests'
  const [msg, setMsg] = useState(null)                  // { ok, t }
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  // ── requests list ────────────────────────────────────────────────────────────
  const [reqs, setReqs] = useState({ rows: [], setupNeeded: false, error: null, loading: true })
  const [filter, setFilter] = useState('pending')
  useEffect(() => {
    let live = true
    loadRequests().then(r => { if (live) setReqs({ ...r, loading: false }) })
    return () => { live = false }
  }, [reload])
  const pending = reqs.rows.filter(r => r.status === 'pending')
  const shown = reqs.rows.filter(r => filter === 'all' || r.status === filter)

  // ── new change form ──────────────────────────────────────────────────────────
  const [q, setQ] = useState('')
  const [stu, setStu] = useState(null)
  const [toType, setToType] = useState('')
  const [toCourse, setToCourse] = useState(''), [toBatch, setToBatch] = useState('')
  const [from, setFrom] = useState('')
  const [reason, setReason] = useState('')
  const [structures, setStructures] = useState([])
  const [ratesState, setRates] = useState(null)         // { now, next }
  const [hist, setHist] = useState({ hostel: [], course: [] })

  useEffect(() => {
    supabase.from('fee_structures').select('course, batch').eq('session_year', session)
      .then(({ data }) => setStructures(data || []), () => setStructures([]))
  }, [session])
  const courses = useMemo(() => [...new Set(structures.map(s => s.course).filter(Boolean))].sort(), [structures])
  const batches = useMemo(() => [...new Set(structures.filter(s => s.course === toCourse).map(s => s.batch).filter(Boolean))].sort(), [structures, toCourse])

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t || stu) return []
    return students.filter(s => [s.name, s.gcc_no, `gcc-${s.gcc_no}`, s.father_name].some(v => String(v ?? '').toLowerCase().includes(t))).slice(0, 12)
  }, [q, students, stu])

  const curType = stu?.hostel_type || 'Day Scholar'
  const pick = s => { setStu(s); setQ(`${s.name} · GCC ${s.gcc_no}`); setToType(''); setToCourse(''); setToBatch(''); setFrom(''); setReason(''); setMsg(null) }
  const clearPick = () => { setStu(null); setQ(''); setRates(null); setHist({ hostel: [], course: [] }) }

  useEffect(() => {
    if (!stu) return
    let live = true
    Promise.all([loadStudentHistory(stu.gcc_no), loadStudentCourseHistory(stu.gcc_no)])
      .then(([hostel, course]) => { if (live) setHist({ hostel, course }) })
    return () => { live = false }
  }, [stu, reload])

  const effType = toType && toType !== curType ? toType : null
  const effCourse = toCourse || null
  const effBatch = toCourse ? (toBatch || stu?.batch || '') : null
  useEffect(() => {
    if (!stu || (!effType && !effCourse)) return
    let live = true
    const sameCourse = !effCourse || (effCourse === (stu.course || '') && effBatch === (stu.batch || ''))
    Promise.all([
      getFeeRates(session, stu.course || '', stu.batch || '', curType, stu.gcc_no),
      getFeeRates(session, effCourse || stu.course || '', effCourse ? effBatch : (stu.batch || ''), effType || curType, sameCourse ? stu.gcc_no : null),
    ]).then(([now, next]) => { if (live) setRates({ now, next }) }, () => { if (live) setRates(null) })
    return () => { live = false }
  }, [stu, effType, effCourse, effBatch, curType, session])

  const rates = stu && (effType || effCourse) ? ratesState : null
  const impact = rates && from ? feeImpact({ now: rates.now, next: rates.next, effectiveFrom: from, session }) : null
  const err = stu ? validateRequest({ student: stu, toType: effType, toCourse: effCourse, toBatch: effBatch, effectiveFrom: from, reason }) : 'Choose a student.'
  const studentPending = stu && pending.find(r => String(r.gcc_no) === String(parseInt(stu.gcc_no) || 0))

  const done = (t, next) => {
    setMsg({ ok: true, t }); setReload(n => n + 1); clearCourseHistoryCache(); onChanged?.()
    if (next) setStu(s => s ? { ...s, ...next } : s)
    setToType(''); setToCourse(''); setToBatch(''); setFrom(''); setReason('')
  }
  const fail = e => setMsg({ ok: false, t: e?.message || 'Could not save.' })

  const sendRequest = async () => {
    if (err) { setMsg({ ok: false, t: err }); return }
    setBusy(true); setMsg(null)
    try {
      const r = await requestChange({ student: stu, effectiveFrom: from, reason, toType: effType, toCourse: effCourse, toBatch: effBatch, by: me, feeImpact: impact })
      done(`Request ${r.form_no} sent. It applies once an admin approves it — print the form for signatures.`)
      printApprovalForm(r)
    } catch (e) { fail(e) }
    setBusy(false)
  }
  const applyNow = async () => {
    if (err) { setMsg({ ok: false, t: err }); return }
    if (!window.confirm(`Approve and apply now?\n\n${stu.name}: ${[effType && `${curType} → ${effType}`, effCourse && `${courseText(stu.course, stu.batch)} → ${courseText(effCourse, effBatch)}`].filter(Boolean).join(', ')} from ${monthLabel(from)}.\n\nMonths before ${monthLabel(from)} keep their old fees. Receipts are not changed.`)) return
    setBusy(true); setMsg(null)
    try {
      // Saved as a request first (keeps the fee impact on the form), then approved by this admin.
      const r = await requestChange({ student: stu, effectiveFrom: from, reason, toType: effType, toCourse: effCourse, toBatch: effBatch, by: me, feeImpact: impact })
      const res = await decideRequest({ id: r.id, approve: true, note: 'Approved when requested', by: me })
      done(`Done — form ${r.form_no} approved. ${stu.name} changes from ${monthLabel(from)}; earlier months unchanged.`, { hostel_type: res.hostel_type ?? stu.hostel_type, course: res.course ?? stu.course, batch: res.batch ?? stu.batch })
      const fresh = (await loadRequests({ gcc: stu.gcc_no, limit: 5 })).rows.find(x => x.id === r.id)
      if (fresh) printApprovalForm(fresh)
    } catch (e) { fail(e) }
    setBusy(false)
  }

  const approve = async r => {
    if (!window.confirm(`Approve ${r.form_no} for ${r.student_name}?\n\n${changeLines(r).map(l => `${l.what}: ${l.from} → ${l.to}`).join('\n')}\nFrom ${monthLabel(r.effective_from)}.\n\nThe fees from that month are re-priced; earlier months and receipts stay as they are.`)) return
    setBusy(true); setMsg(null)
    try { await decideRequest({ id: r.id, approve: true, note: '', by: me }); done(`${r.form_no} approved and applied.`) } catch (e) { fail(e) }
    setBusy(false)
  }
  const reject = async r => {
    const why = window.prompt(`Reject ${r.form_no} for ${r.student_name}? Why? (required)`, '')
    if (!why || why.trim().length < 3) return
    setBusy(true); setMsg(null)
    try { await decideRequest({ id: r.id, approve: false, note: why.trim(), by: me }); done(`${r.form_no} rejected.`) } catch (e) { fail(e) }
    setBusy(false)
  }
  const cancel = async r => {
    const why = window.prompt(`Cancel ${r.form_no}? Why?`, '')
    if (why === null) return
    setBusy(true); setMsg(null)
    try { await cancelRequest({ id: r.id, note: why.trim() }); done(`${r.form_no} cancelled.`) } catch (e) { fail(e) }
    setBusy(false)
  }
  const undo = async kind => {
    const list = kind === 'hostel' ? hist.hostel : hist.course
    const last = list[list.length - 1]
    if (!last) return
    const what = kind === 'hostel' ? `${last.from_type} → ${last.to_type}` : `${courseText(last.from_course, last.from_batch)} → ${courseText(last.to_course, last.to_batch)}`
    const why = window.prompt(`Undo the last ${kind === 'hostel' ? 'hostel type' : 'course'} change (${what} from ${monthLabel(last.effective_from)})?\n\nThose months go back to the earlier rate. Why? (required)`, '')
    if (!why || why.trim().length < 3) return
    setBusy(true); setMsg(null)
    try {
      if (kind === 'hostel') { await undoLastChange({ student: stu, changes: list, by: me, reason: why.trim() }); done('Last hostel type change undone.', { hostel_type: last.from_type }) }
      else { const back = await undoLastCourseChange({ student: stu, changes: list, by: me, reason: why.trim() }); done('Last course change undone.', back) }
    } catch (e) { fail(e) }
    setBusy(false)
  }

  const RequestCard = ({ r }) => {
    const st = STATUS[r.status] || STATUS.pending
    const mine = r.status === 'pending' && (isAdmin || String(r.requested_by || '') === String(me))
    return (
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, marginBottom: 10, background: r.status === 'pending' ? '#fffdf6' : '#fff' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.form_no}</b>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
          <span style={{ fontWeight: 800 }}>{r.student_name}</span><span style={{ color: C.mut, fontSize: 12 }}>GCC {r.gcc_no}</span>
        </div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          {changeLines(r).map(l => <div key={l.what}>{l.what}: {l.from} → <b>{l.to}</b></div>)}
          <div>From <b>{monthLabel(r.effective_from)}</b>{r.fee_impact?.perMonth ? <> · {r.fee_impact.perMonth > 0 ? '+' : '−'}{inr(Math.abs(r.fee_impact.perMonth))}/month</> : null}</div>
          <div style={{ color: C.mut, fontSize: 12, marginTop: 2 }}>Reason: {r.reason} · asked by {r.requested_by || '—'} {when(r.created_at)}</div>
          {r.status !== 'pending' && <div style={{ color: C.mut, fontSize: 12 }}>{st.label} by {r.decided_by || '—'} {when(r.decided_at)}{r.decision_note ? ` — ${r.decision_note}` : ''}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" style={ghost} onClick={() => printApprovalForm(r)}>🖨 Print form</button>
          {r.status === 'pending' && isAdmin && <button type="button" style={go(busy)} disabled={busy} onClick={() => approve(r)}>✓ Approve</button>}
          {r.status === 'pending' && isAdmin && <button type="button" style={{ ...ghost, color: C.bad }} disabled={busy} onClick={() => reject(r)}>✕ Reject</button>}
          {mine && <button type="button" style={ghost} disabled={busy} onClick={() => cancel(r)}>Cancel request</button>}
        </div>
      </div>
    )
  }

  const hSegs = stu ? hostelTimeline(stu, hist.hostel) : []
  const cSegs = stu ? courseTimeline(stu, hist.course) : []

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '4px 2px 40px', color: C.ink }}>
      <div style={{ ...card, background: C.tint }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Course / Mode Change</div>
        <div style={{ fontSize: 13, color: C.mut, marginTop: 4, lineHeight: 1.5 }}>
          Move a student to another course or batch, or between Boarder, Day Boarder and Day Scholar, from a month in the middle of the session.
          Months before that keep their old fees and receipts; the new rate applies from the month you pick. {isAdmin ? 'You can approve requests here.' : 'An admin must approve the change before it applies.'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" style={pill(view === 'new')} onClick={() => setView('new')}>➕ New change</button>
          <button type="button" style={pill(view === 'requests')} onClick={() => setView('requests')}>📋 Requests{pending.length ? ` (${pending.length} waiting)` : ''}</button>
        </div>
      </div>

      {reqs.setupNeeded && <div style={{ ...card, borderColor: C.bad, color: C.bad, fontSize: 13 }}>⚠ This tab needs the database update <b>20261129_student_course_mode_change.sql</b>. Ask the admin to run it in Supabase (SQL editor).</div>}
      {msg && <div role="status" style={{ ...card, padding: '10px 14px', borderColor: msg.ok ? '#b7e0c4' : '#f3c2bd', background: msg.ok ? '#eef8f1' : '#fdf0ee', color: msg.ok ? C.ok : C.bad, fontWeight: 700, fontSize: 13 }}>{msg.t}</div>}

      {view === 'new' && (<>
        <div style={card}>
          <label style={lbl}>Student</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={field} value={q} onChange={e => { setQ(e.target.value); if (stu) setStu(null) }} placeholder="Search name or GCC no." aria-label="Search student" />
            {stu && <button type="button" style={ghost} onClick={clearPick}>Change</button>}
          </div>
          {matches.length > 0 && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, marginTop: 6, maxHeight: 280, overflowY: 'auto' }}>
              {matches.map(s => (
                <button type="button" key={s.id} onClick={() => pick(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  <b>{s.name}</b> <span style={{ color: C.mut }}>· GCC {s.gcc_no} · {courseText(s.course, s.batch)} · {s.hostel_type || 'Day Scholar'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {stu && (<>
          <div style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <div><div style={lbl}>Now</div><div style={{ fontWeight: 800 }}>{courseText(stu.course, stu.batch)}</div><div>{curType}</div></div>
              <div><div style={lbl}>Hostel type history</div>{hSegs.map((s, i) => <div key={i} style={{ fontSize: 12.5 }}>{s.type} <span style={{ color: C.mut }}>{s.from ? `from ${monthLabel(s.from)}` : 'from admission'}{s.to ? ` to ${monthLabel(s.to)}` : ''}</span></div>)}</div>
              <div><div style={lbl}>Course history</div>{cSegs.map((s, i) => <div key={i} style={{ fontSize: 12.5 }}>{courseText(s.course, s.batch)} <span style={{ color: C.mut }}>{s.from ? `from ${monthLabel(s.from)}` : 'from admission'}</span></div>)}</div>
            </div>
            {isAdmin && (hist.hostel.length > 0 || hist.course.length > 0) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {hist.hostel.length > 0 && <button type="button" style={{ ...ghost, color: C.bad }} disabled={busy} onClick={() => undo('hostel')}>↶ Undo last hostel type change</button>}
                {hist.course.length > 0 && <button type="button" style={{ ...ghost, color: C.bad }} disabled={busy} onClick={() => undo('course')}>↶ Undo last course change</button>}
              </div>
            )}
          </div>

          <div style={card}>
            {studentPending && <div style={{ background: '#fff4dc', color: '#9a5b00', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{studentPending.form_no} is already waiting for approval for this student. Approve, reject or cancel it in Requests first.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div><label style={lbl}>New hostel type</label>
                <select style={field} value={toType} onChange={e => setToType(e.target.value)} aria-label="New hostel type">
                  <option value="">No change ({curType})</option>{HOSTEL_TYPE_LIST.filter(t => t !== curType).map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div><label style={lbl}>New course</label>
                <select style={field} value={toCourse} onChange={e => { setToCourse(e.target.value); setToBatch('') }} aria-label="New course">
                  <option value="">No change</option>{courses.map(c => <option key={c}>{c}</option>)}
                </select></div>
              <div><label style={lbl}>New batch</label>
                <select style={field} value={toBatch} onChange={e => setToBatch(e.target.value)} disabled={!toCourse} aria-label="New batch">
                  <option value="">{toCourse ? `Keep ${stu.batch || '—'}` : '—'}</option>{batches.map(b => <option key={b}>{b}</option>)}
                </select></div>
              <div><label style={lbl}>Starts from month</label>
                <select style={field} value={from} onChange={e => setFrom(e.target.value)} aria-label="Starts from month">
                  <option value="">— Choose —</option>{months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select></div>
            </div>
            <div style={{ marginTop: 12 }}><label style={lbl}>Reason (required)</label>
              <input style={{ ...field, borderColor: reason.trim().length >= 3 ? C.line : C.bad }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Left the hostel, now comes from home" aria-label="Reason" /></div>

            {impact && (
              <div style={{ marginTop: 12, background: C.tint, border: `1px dashed ${C.gold}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }}>
                <b>Fee impact.</b> Monthly fee {inr(impact.before.total)} → <b>{inr(impact.after.total)}</b> (course {inr(impact.before.course)} → {inr(impact.after.course)}, flat {inr(impact.before.flat)} → {inr(impact.after.flat)}).<br />
                {impact.monthsAffected} month{impact.monthsAffected === 1 ? '' : 's'} affected ({impact.firstMonth} – {impact.lastMonth}): {impact.perMonth === 0 ? 'no change.' : <>{impact.perMonth > 0 ? 'more' : 'less'} by <b>{inr(Math.abs(impact.perMonth))}</b> a month, <b>{inr(Math.abs(impact.total))}</b> for the rest of the session.</>}<br />
                <span style={{ color: C.mut }}>Months already paid from {impact.firstMonth} show any extra paid as advance or any shortfall as due on the ledger. No receipt is changed.</span>
                {rates?.next?.usingFallbackRates && <div style={{ color: C.bad }}>⚠ This course / batch isn't set up in Fee Setup for {session} yet.</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={go(busy || !!err || !!studentPending)} disabled={busy || !!err || !!studentPending} onClick={sendRequest}>{busy ? 'Saving…' : '📨 Send for admin approval'}</button>
              {isAdmin && <button type="button" style={{ ...ghost, fontWeight: 800 }} disabled={busy || !!err || !!studentPending} onClick={applyNow}>✓ Approve &amp; apply now</button>}
              {err && <span style={{ fontSize: 12, color: C.mut }}>{err}</span>}
            </div>
          </div>
        </>)}
      </>)}

      {view === 'requests' && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, l]) => (
              <button type="button" key={k} style={pill(filter === k)} onClick={() => setFilter(k)}>{l}{k === 'pending' && pending.length ? ` (${pending.length})` : ''}</button>
            ))}
            <button type="button" style={{ ...ghost, marginLeft: 'auto' }} onClick={() => setReload(n => n + 1)}>↻ Refresh</button>
          </div>
          {reqs.loading ? <div style={{ color: C.mut }}>Loading…</div>
            : reqs.error ? <div style={{ color: C.bad }}>{reqs.error}</div>
            : shown.length === 0 ? <div style={{ color: C.mut, fontSize: 13 }}>No {filter === 'all' ? '' : (STATUS[filter]?.label || '').toLowerCase()} requests.</div>
            : shown.map(r => <RequestCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}

// HostelIssues.jsx — admin tab: hostel type issues (wrong fee risk).
// Boarder / Day Boarder / Day Scholar decides the flat and course fee rate, so
// a wrong type means a wrong fee. This tab gathers every such case:
//   1. students whose recorded type disagrees with the hostel beds
//   2. fees charged at another type's rate, waiting for approval
//   3. this session's past payments made at another type's rate
//   4. admin overrides and record corrections (audit trail)
import { useEffect, useMemo, useState } from 'react'
import { HOSTEL_TYPES, HOSTEL_MISMATCH_REASON, scanBedConflicts, fixHostelType, loadWrongRateScan, loadHostelAudit } from './hostelFeeCheck'
import { loadConcessions, decideConcession, recordConcession, CONCESSIONS_SETUP_MSG } from './feeConcessions'
import { sessionOfDate } from './feeLedgerModel'
import { LedgerLink } from './LedgerLink'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const TONE = { pending: ['#9a5b00', '#fff4dc'], approved: ['#146c3a', '#e7f6ec'], rejected: ['#b42318', '#fde8e6'] }
const card = { background: '#fff', border: '1px solid #ece6d6', borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: '0 14px 34px -26px rgba(19,42,79,.35)' }
const inp = { border: '1px solid #d8dfec', borderRadius: 9, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', minWidth: 0, background: '#fff' }
const btn = (bg, color = '#fff', border = 'none') => ({ padding: '7px 13px', borderRadius: 9, border, background: bg, color, fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' })
const row = { display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f1ede3' }
const TYPE_TONE = { Boarder: ['#1e3a6e', '#eef2f9'], 'Day Boarder': ['#7c3aed', '#f3efff'], 'Day Scholar': ['#0f766e', '#e8f7f4'] }
const TypePill = ({ t }) => { const [c, bg] = TYPE_TONE[t] || ['#475569', '#f1f5f9']; return <span style={{ fontSize: 10.5, fontWeight: 800, color: c, background: bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>{t}</span> }

function Section({ icon, title, sub, count, action, children, label }) {
  return (
    <div style={card} aria-label={label}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: '#fff7ed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Fraunces',Georgia,serif", color: '#0f1f3d' }}>{title}{count > 0 && <span style={{ marginLeft: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 999, padding: '1px 9px' }}>{count}</span>}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        {action}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  )
}

export default function HostelIssues({ students = [], adm_flat_fees = [], adm_course_fees = [], isAdmin, currentUser, onChanged }) {
  const me = currentUser?.name || currentUser?.userName || 'Admin'
  const session = sessionOfDate(new Date())
  const [bed, setBed] = useState(null)          // { rows, error }
  const [conc, setConc] = useState(null)        // loadConcessions() result
  const [wrong, setWrong] = useState(null)      // { issues, reviewed } | { error }
  const [audit, setAudit] = useState(null)
  const [busy, setBusy] = useState(null)
  const [typeDraft, setTypeDraft] = useState({})
  const [status, setStatus] = useState('pending')
  const [nonce, setNonce] = useState(0)
  const reload = () => { setNonce(n => n + 1); onChanged?.() }

  useEffect(() => {
    if (!isAdmin) return
    let live = true
    const set = f => v => { if (live) f(v) }
    scanBedConflicts(students).then(set(setBed)).catch(e => set(setBed)({ rows: [], error: e.message }))
    loadConcessions().then(set(setConc))
    loadWrongRateScan({ students, courseRows: adm_course_fees, flatRows: adm_flat_fees, session }).then(set(setWrong)).catch(e => set(setWrong)({ issues: [], reviewed: 0, error: e.message }))
    loadHostelAudit().then(set(setAudit))
    return () => { live = false }
  }, [isAdmin, students, adm_course_fees, adm_flat_fees, session, nonce])

  const mismatches = useMemo(() => (conc?.rows || []).filter(c => c.reason === HOSTEL_MISMATCH_REASON), [conc])
  const shownMismatch = mismatches.filter(c => status === 'All' || c.status === status)
  const pending = mismatches.filter(c => c.status === 'pending')

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: '#8a93a6' }}>🔒 Admin only</div>

  const setType = async (st, type) => {
    if (!type) { alert('Choose the correct hostel type first.'); return }
    if (!window.confirm(`Change ${st.name}'s hostel type from ${st.hostel_type || 'Day Scholar'} to ${type}? Future fees are charged at the ${type} rate.`)) return
    setBusy('ht' + st.id)
    try { await fixHostelType(st, type, me); reload() } catch (e) { alert(e.message) }
    setBusy(null)
  }
  const decide = async (c, approve) => {
    const note = window.prompt(approve
      ? `Approve charging ${c.student_name || 'GCC-' + c.gcc} at the lower hostel rate for ${c.month} ${c.year}?\n\nThe ${inr(c.shortfall)} difference will be waived. Note (optional):`
      : `Reject? The ${inr(c.shortfall)} difference stays due and should be collected. Reason (optional):`, '')
    if (note === null) return
    setBusy(c.id)
    try { await decideConcession(c, approve, { by: me, note }); reload() } catch (e) { alert(e.message) }
    setBusy(null)
  }
  const settleWrong = async (u, approve) => {
    const key = `${u.table}|${u.rowId}`
    setBusy(key)
    const c = await recordConcession({
      table: u.table, rowId: u.rowId, kind: u.kind, gcc: u.student.gcc_no, studentName: u.student.name, month: u.month, year: u.year, course: u.student.course,
      standard: u.own, collected: u.paid, reason: HOSTEL_MISMATCH_REASON, note: `Paid at the ${u.matchType} rate — student is ${u.ownType} (found on review)`,
      receiptNo: u.receipt, payDate: u.date, collectedBy: u.by, approvedBy: approve ? me : null,
    })
    if (c && !approve) { try { await decideConcession(c, false, { by: me, note: 'Kept due on review' }) } catch (e) { alert(e.message) } }
    if (!c) alert(CONCESSIONS_SETUP_MSG)
    setBusy(null); reload()
  }

  const kpis = [
    ['Record ≠ hostel bed', bed?.rows?.length, 'students', '#FDBA74'],
    ['Awaiting approval', pending.length, inr(pending.reduce((s, c) => s + Number(c.shortfall || 0), 0)), '#FCD34D'],
    ['Paid at wrong rate', wrong?.issues?.length, inr((wrong?.issues || []).reduce((s, u) => s + u.shortBy, 0)) + ' short', '#FCA5A5'],
    ['Admin overrides', (audit || []).filter(a => a.action === 'fee_hostel_issue_approved').length, 'in audit log', '#93C5FD'],
  ]

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#1f2a44' }}>
      <div style={{ ...card, color: '#fff', border: 'none', background: 'radial-gradient(120% 140% at 100% 0%,#1F4E8C 0%,#132B52 45%,#0B1E3D 85%)', boxShadow: '0 22px 44px -22px rgba(11,30,61,.55),inset 0 0 0 1px rgba(226,197,126,.22)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', color: '#E2C57E' }}>FEES · {session}</div>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 24, fontWeight: 700, marginTop: 4 }}>🏠 Hostel type issue — wrong fee risk</div>
        <div style={{ fontSize: 12.5, opacity: .8, marginTop: 4, maxWidth: 760 }}>Boarder, Day Boarder and Day Scholar pay different flat and course fees. A student on the wrong type, or a fee charged at another type's rate, means a wrong fee — every case needs an admin decision.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
          {kpis.map(([l, v, sub, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .65 }}>{l}</div>
              <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 700, color: c, marginTop: 3 }}>{v == null ? '…' : v}</div>
              <div style={{ fontSize: 11, opacity: .6 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {conc?.setupNeeded && <div style={{ ...card, background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412', fontSize: 13 }}>⚙️ {CONCESSIONS_SETUP_MSG}</div>}

      <Section icon="🛏️" label="Record vs hostel bed" title="Record doesn't match the hostel" count={bed?.rows?.length || 0}
        sub="Active students recorded as Day Scholar / Day Boarder who hold a hostel bed, or recorded as Boarder without one. Their fees are charged at the wrong rate until the record is corrected."
        action={<button style={btn('#fff', '#1e3a6e', '1px solid #d8dfec')} onClick={reload}>↻ Re-check</button>}>
        {!bed && <div style={{ color: '#64748b', padding: '8px 0' }}>Checking…</div>}
        {bed?.error && <div style={{ color: '#b42318' }}>{bed.error}</div>}
        {bed && !bed.error && bed.rows.length === 0 && <div style={{ color: '#146c3a', fontWeight: 700, padding: '8px 0' }}>✓ Every active student's hostel type matches the hostel beds.</div>}
        {bed?.rows?.map(({ student: st, conflict }) => {
          const pick = typeDraft[st.id] ?? conflict.should ?? ''
          return (
            <div key={st.id} style={row}>
              <div style={{ flex: '2 1 260px' }}>
                <b><LedgerLink gcc={st.gcc_no}>{st.name}</LedgerLink></b> <span style={{ color: '#98a2b3', fontSize: 12 }}>GCC-{st.gcc_no} · {st.course || '—'}{st.batch ? ' · ' + st.batch : ''}</span> <TypePill t={st.hostel_type || 'Day Scholar'} />
                <div style={{ fontSize: 12, color: '#9a3412', marginTop: 3 }}>{conflict.message.charAt(0).toUpperCase() + conflict.message.slice(1)}.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select style={inp} value={pick} onChange={e => setTypeDraft(d => ({ ...d, [st.id]: e.target.value }))} aria-label={`Correct hostel type for ${st.name}`}>
                  <option value="">— Correct type —</option>
                  {HOSTEL_TYPES.filter(t => t !== (st.hostel_type || 'Day Scholar')).map(t => <option key={t}>{t}</option>)}
                </select>
                <button disabled={busy === 'ht' + st.id} style={btn('#9a3412')} onClick={() => setType(st, pick)}>Correct record</button>
              </div>
            </div>
          )
        })}
      </Section>

      <Section icon="⚖️" label="Charged at another hostel type" title="Charged at another hostel type's rate" count={pending.length}
        sub="Fees collected at a cheaper hostel type than the student's record. Approve to waive the difference, reject to keep it due."
        action={<div style={{ display: 'flex', gap: 6 }}>{[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['All', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} style={btn(status === k ? '#1e3a6e' : '#fff', status === k ? '#fff' : '#1e3a6e', '1px solid #d8dfec')}>{l}</button>))}</div>}>
        {!conc && <div style={{ color: '#64748b', padding: '8px 0' }}>Loading…</div>}
        {conc && shownMismatch.length === 0 && <div style={{ color: '#64748b', padding: '8px 0' }}>{status === 'pending' ? '🎉 Nothing waiting for approval.' : 'No entries.'}</div>}
        {shownMismatch.map(c => (
          <div key={c.id} style={row}>
            <div style={{ flex: '2 1 260px' }}>
              <b><LedgerLink gcc={c.gcc}>{c.student_name || `GCC-${c.gcc}`}</LedgerLink></b> <span style={{ color: '#98a2b3', fontSize: 12 }}>GCC-{c.gcc} · {c.fee_kind === 'flat' ? 'Flat fee' : 'Course fee'} · {c.month} {c.year}</span>
              <div style={{ fontSize: 12.5, marginTop: 3 }}>{c.reason_note || '—'}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Collected by {c.collected_by || '—'} · {fmtD(c.pay_date || c.created_at)}{c.receipt_no ? ` · ${c.receipt_no}` : ''}{c.decided_by ? ` · ${c.status} by ${c.decided_by}` : ''}</div>
            </div>
            <div style={{ fontSize: 12.5, textAlign: 'right' }}>
              <div>Own rate {inr(c.standard_amount)} · Charged {inr(c.collected_amount)}</div>
              <div style={{ fontWeight: 800, color: '#b42318' }}>Difference {inr(c.shortfall)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: TONE[c.status]?.[0], background: TONE[c.status]?.[1] }}>{String(c.status).toUpperCase()}</span>
              {c.status !== 'approved' && <button disabled={busy === c.id} style={btn('#146c3a')} onClick={() => decide(c, true)}>Approve</button>}
              {c.status !== 'rejected' && <button disabled={busy === c.id} style={btn('#fff', '#b42318', '1px solid #f3d0d0')} onClick={() => decide(c, false)}>Reject</button>}
            </div>
          </div>
        ))}
      </Section>

      <Section icon="🔍" label="Paid at the wrong rate" title="Paid at another hostel type's rate" count={wrong?.issues?.length || 0}
        sub={`This session's flat and course payments that match a cheaper hostel type's rate instead of the student's own${wrong?.reviewed ? ` · ${wrong.reviewed} already reviewed` : ''}.`}>
        {!wrong && <div style={{ color: '#64748b', padding: '8px 0' }}>Scanning payments…</div>}
        {wrong?.error && <div style={{ color: '#b42318' }}>{wrong.error}</div>}
        {wrong && !wrong.error && wrong.issues.length === 0 && <div style={{ color: '#146c3a', fontWeight: 700, padding: '8px 0' }}>✓ No payments at another hostel type's rate this session.</div>}
        {wrong?.issues?.map(u => {
          const key = `${u.table}|${u.rowId}`
          return (
            <div key={key} style={row}>
              <div style={{ flex: '2 1 260px' }}>
                <b><LedgerLink gcc={u.student.gcc_no}>{u.student.name}</LedgerLink></b> <span style={{ color: '#98a2b3', fontSize: 12 }}>GCC-{u.student.gcc_no} · {u.kind === 'flat' ? 'Flat fee' : 'Course fee'} · {u.month} {u.year}</span>
                <div style={{ fontSize: 12, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  Paid {inr(u.paid)} = <TypePill t={u.matchType} /> rate · student is <TypePill t={u.ownType} /> ({inr(u.own)})
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>by {u.by || '—'} · {fmtD(u.date)}{u.receipt ? ` · ${u.receipt}` : ''}</div>
              </div>
              <b style={{ color: '#b42318' }}>Short {inr(u.shortBy)}</b>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={busy === key} style={btn('#146c3a')} onClick={() => settleWrong(u, true)}>Approve (waive)</button>
                <button disabled={busy === key} style={btn('#fff', '#b42318', '1px solid #f3d0d0')} onClick={() => settleWrong(u, false)}>Keep due</button>
              </div>
            </div>
          )
        })}
      </Section>

      <Section icon="🧾" label="Hostel audit trail" title="Audit trail" sub="Hostel type changes (with the month they start), corrections, and admins collecting despite a hostel issue.">
        {!audit && <div style={{ color: '#64748b', padding: '8px 0' }}>Loading…</div>}
        {audit && audit.length === 0 && <div style={{ color: '#64748b', padding: '8px 0' }}>Nothing recorded yet.</div>}
        {(audit || []).slice(0, 30).map(a => (
          <div key={a.id || a.created_at + a.action} style={{ ...row, padding: '9px 0' }}>
            <div style={{ flex: '2 1 260px', fontSize: 12.5 }}>
              <b>{a.v.student_name || `GCC-${a.v.gcc || '—'}`}</b>{' '}
              {a.action === 'hostel_type_changed'
                ? <>hostel type changed <TypePill t={a.v.from || 'Day Scholar'} /> → <TypePill t={a.v.to} /> from {String(a.v.effective_from || '').slice(0, 7)}{a.v.reason ? <span style={{ color: '#64748b' }}> — {a.v.reason}</span> : ''}</>
                : a.action === 'hostel_type_change_undone'
                ? <>hostel type change undone <TypePill t={a.v.from || 'Day Scholar'} /> → <TypePill t={a.v.to} /></>
                : a.action === 'hostel_type_corrected'
                ? <>hostel type corrected <TypePill t={a.v.from || 'Day Scholar'} /> → <TypePill t={a.v.to} /> (all months)</>
                : <span style={{ color: '#9a3412' }}>collected despite: {a.v.detail || 'hostel issue'}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>{a.changed_by || '—'} · {fmtD(a.created_at)}</div>
          </div>
        ))}
      </Section>
    </div>
  )
}

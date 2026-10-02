// ShortFeeFixer.jsx — the admin "Fix" panel for a student who is short of fees.
// Explains WHY the month is short (the rate expected and where it comes from,
// every payment, what the paid amount matches — another hostel type, batch,
// course or last session's rate — any low-fee request and note) and offers the
// fix for each cause: correct the hostel type, approve/refuse the shortfall,
// correct a wrongly entered amount, move a payment to the right month, fix the
// date / revert, or collect the balance. Every change is audited.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { buildAllLedgers } from './feeLedgerBulk'
import { gccStr, correctFeeCollectionAmount, moveFeeCollectionMonth } from './feeEngine'
import { recordConcession, decideConcession, CONCESSION_REASONS, CONCESSIONS_SETUP_MSG } from './feeConcessions'
import { fixHostelType, loadActiveBeds, HOSTEL_TYPES } from './hostelFeeCheck'
import { changeHostelType, loadStudentHistory, monthStart } from './hostelHistory'
import { confirmFeeMonthOpen } from './monthLock'
import { LedgerLink } from './LedgerLinks'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const short = s => `${String(s).slice(2, 4)}-${String(s).slice(7, 9)}`
const CSS = `
.sff-bg{position:fixed;inset:0;background:rgba(11,30,61,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto}
.sff{width:100%;max-width:820px;background:#faf8f3;border-radius:22px;box-shadow:0 30px 70px -20px rgba(0,0,0,.5);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1f2a44;overflow:hidden}
.sff-hd{padding:18px 20px;color:#fff;background:radial-gradient(120% 140% at 100% 0%,#1F4E8C 0%,#132B52 45%,#0B1E3D 85%);display:flex;gap:12px;align-items:flex-start}
.sff-hd h2{margin:0;font:700 21px 'Fraunces',Georgia,serif}
.sff-x{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:999px;width:34px;height:34px;cursor:pointer;font-size:16px}
.sff-body{padding:16px;display:grid;gap:12px}
.sff-card{background:#fff;border:1px solid #ece6d6;border-radius:16px;padding:14px 16px}
.sff-card h3{margin:0 0 8px;font:800 13px 'Plus Jakarta Sans',system-ui;letter-spacing:.08em;text-transform:uppercase;color:#6b7690}
.sff-why{background:linear-gradient(180deg,#fff7ed,#fff1e6);border-color:#fdba74}
.sff-why b.big{display:block;font:700 17px 'Fraunces',Georgia,serif;color:#7c2d12;margin-bottom:4px}
.sff-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px dotted #e6dfcd;font-size:13px;flex-wrap:wrap}
.sff-row:first-of-type{border-top:none}
.sff-months{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.sff-m{padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-weight:700;font-size:12px;cursor:pointer}
.sff-m.on{background:#F3DFA8;color:#0B1E3D;border-color:#F3DFA8}
.sff-act{display:grid;gap:8px}
.sff-line{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sff input,.sff select{border:1px solid #d8dfec;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;background:#fff;min-width:0}
.sff-b{padding:8px 14px;border-radius:10px;border:none;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap}
.sff-b:disabled{opacity:.5;cursor:not-allowed}
.sff-note{font-size:12px;color:#64748b}
.sff-ok{background:#e7f6ec;color:#146c3a;border-radius:12px;padding:9px 12px;font-weight:700;font-size:13px}
.sff-err{background:#fde8e6;color:#b42318;border-radius:12px;padding:9px 12px;font-weight:700;font-size:13px}
.sff-pill{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 9px;background:#eef2f9;color:#1e3a6e;white-space:nowrap}
`
const btn = (bg, color = '#fff', border = 'none') => ({ background: bg, color, border })

export default function ShortFeeFixer({ student, session, month: initialMonth, year: initialYear, adm_fee_collections = [], adm_flat_fees = [], adm_course_fees = [], currentUser, onClose, onChanged, onCollect, onOpenRevert }) {
  const me = currentUser?.name || currentUser?.userName || 'Admin'
  const gcc = gccStr(student.gcc_no)
  const [led, setLed] = useState(null)          // { reg, rates }
  const [structures, setStructures] = useState([])
  const [concs, setConcs] = useState([])
  const [bed, setBed] = useState(null)
  const [changes, setChanges] = useState([])
  const [pick, setPick] = useState(initialMonth ? `${initialMonth}|${initialYear}` : null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)          // { ok|err, text }
  const [nonce, setNonce] = useState(0)
  const [f, setF] = useState({ reason: CONCESSION_REASONS[0], note: '', amt: {}, amtWhy: '', moveTo: '', moveWhy: '', htType: '', htFrom: '', htMode: 'all' })

  // This student's rows only (props hold everyone's).
  const mine = useMemo(() => ({
    adm: new Map([[gcc, adm_fee_collections.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted)]]),
    flat: new Map([[gcc, adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid && !r.reverted)]]),
    crs: new Map([[gcc, adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted)]]),
  }), [gcc, adm_fee_collections, adm_flat_fees, adm_course_fees])

  useEffect(() => {
    let live = true
    buildAllLedgers([student], session, { rows: mine }).then(([x]) => { if (live) setLed(x) }).catch(e => { if (live) setMsg({ err: true, text: e.message }) })
    supabase.from('fee_structures').select('session_year, course, batch, hostel_type, flat_fee, course_fee').then(({ data }) => { if (live) setStructures(data || []) })
    supabase.from('fee_concessions').select('*').eq('gcc', gcc).then(({ data }) => { if (live) setConcs(data || []) })
    loadActiveBeds(student.id != null ? [student.id] : null).then(b => { if (live) setBed(b ? b.has(String(student.id)) : null) })
    loadStudentHistory(student.gcc_no).then(c => { if (live) setChanges(c) })
    return () => { live = false }
  }, [student, session, mine, gcc, nonce])

  const owing = (led?.reg.rows || []).filter(r => r.due > 0)
  const sel = led ? (led.reg.rows.find(r => `${r.month}|${r.year}` === pick) || owing[0] || null) : null
  const isFlat = sel?.head === 'Flat Fee'
  const table = isFlat ? 'adm_flat_fees' : 'adm_course_fees'
  const rows = sel ? (mine[isFlat ? 'flat' : 'crs'].get(gcc) || []).filter(r => (isFlat ? r.month : r.for_month) === sel.month && Number(r.year) === Number(sel.year)) : []
  const paid = sel?.paidAmt || 0
  const type = sel?.hostelType || student.hostel_type || 'Day Scholar'
  const conc = rows.map(r => concs.find(c => c.fee_table === table && String(c.fee_row_id) === String(r.id))).find(Boolean)

  // What the paid amount matches, if not this student's own rate.
  const field = isFlat ? 'flat_fee' : 'course_fee'
  const rateOf = (sess, course, batch, t) => {
    const same = r => r.session_year === sess && r.course === course && r.hostel_type === t
    const hit = structures.find(r => same(r) && (r.batch || '') === (batch || '')) || structures.find(same)
    return hit ? Number(hit[field]) || 0 : 0
  }
  const matches = []
  if (sel && paid > 0 && paid !== sel.expected) {
    const c = student.course, b = student.batch || ''
    HOSTEL_TYPES.filter(t => t !== type).forEach(t => { if (rateOf(session, c, b, t) === paid) matches.push({ kind: 'type', label: `the ${t} rate`, type: t }) })
    const prevS = `${Number(session.slice(0, 4)) - 1}-${Number(session.slice(0, 4))}`
    if (rateOf(prevS, c, b, type) === paid) matches.push({ kind: 'session', label: `last session's (${short(prevS)}) ${type} rate` })
    ;[...new Set(structures.filter(r => r.session_year === session && r.course === c && r.hostel_type === type && (r.batch || '') !== b).map(r => r.batch))]
      .forEach(bt => { if (rateOf(session, c, bt, type) === paid) matches.push({ kind: 'batch', label: `the ${bt} batch rate` }) })
    ;[...new Set(structures.filter(r => r.session_year === session && r.course !== c).map(r => r.course))]
      .forEach(cs => { if (rateOf(session, cs, '', type) === paid) matches.push({ kind: 'course', label: `the ${cs} course rate` }) })
  }
  const typeMatch = matches.find(m => m.kind === 'type')
  const note = rows.map(r => r.override_note).filter(Boolean).join(' · ')

  let headline
  if (!sel) headline = 'Nothing is due for this student this session.'
  else if (sel.status === 'due') headline = `Nothing paid yet for ${sel.month} ${sel.year} — ${inr(sel.due)} to collect.`
  else if (typeMatch) headline = `${inr(paid)} is ${typeMatch.label} — the student may be recorded with the wrong hostel type (${type}).`
  else if (matches.length) headline = `${inr(paid)} matches ${matches[0].label}, not this student's ${inr(sel.expected)}.`
  else if (conc?.status === 'pending') headline = `A low fee was sent for approval (${conc.reason}) — waiting for an admin.`
  else if (conc?.status === 'rejected') headline = `The low fee was refused — the ${inr(sel.due)} balance stays due.`
  else if (note) headline = `Collected below the fee with a note: “${note}” — never approved, so the balance stays due.`
  else headline = `Part payment — ${inr(sel.due)} still to collect.`

  const run = async (key, fn, ok) => {
    setBusy(key); setMsg(null)
    try { await fn(); setMsg({ text: ok }); onChanged?.(); setNonce(n => n + 1) } catch (e) { setMsg({ err: true, text: e.message || String(e) }) }
    setBusy('')
  }
  const last = rows[rows.length - 1]
  const approve = () => run('conc', async () => {
    if (conc && conc.status !== 'approved') { await decideConcession(conc, true, { by: me, note: f.note }); return }
    if (!last) throw new Error('No payment to attach the concession to — collect first.')
    const c = await recordConcession({
      replace: true, table, rowId: last.id, kind: isFlat ? 'flat' : 'course', gcc, studentName: student.name, month: sel.month, year: sel.year, course: student.course,
      standard: sel.expected, collected: paid, reason: f.reason, note: f.note || 'Approved from the Fix panel', receiptNo: last.receipt_no, payDate: last.pay_date, collectedBy: last.collected_by, approvedBy: me,
    })
    if (!c) throw new Error(CONCESSIONS_SETUP_MSG)
  }, `${inr(sel?.due)} waived as a concession — ${sel?.month} is now settled.`)
  const refuse = () => run('conc', () => decideConcession(conc, false, { by: me, note: f.note }), 'Low fee refused — the balance stays due.')
  const fixAmount = r => run('amt' + r.id, async () => {
    if (!(await confirmFeeMonthOpen(r.pay_date, { isAdmin: true }))) throw new Error('Cancelled.')
    await correctFeeCollectionAmount({ table, id: r.id, newAmount: f.amt[r.id], reason: f.amtWhy, correctedBy: me })
  }, 'Amount corrected (fee record and Accounts).')
  const moveMonth = r => run('mv' + r.id, async () => {
    const [m, y] = String(f.moveTo).split('|')
    await moveFeeCollectionMonth({ table, id: r.id, month: m, year: Number(y), reason: f.moveWhy, correctedBy: me })
  }, 'Payment moved to the right month.')
  const htTo = f.htType || typeMatch?.type || ''
  const fixType = () => run('ht', async () => {
    if (!htTo) throw new Error('Choose the correct hostel type.')
    if (f.htMode === 'all') await fixHostelType(student, htTo, me)
    else await changeHostelType({ student, toType: htTo, effectiveFrom: f.htFrom || monthStart(sel.month, sel.year), reason: 'Corrected from the Fix panel', by: me, changes })
  }, `Hostel type set to ${htTo} — dues recalculated at the ${htTo} rate.`)

  const sessStart = Number(String(session).slice(0, 4))
  const sessionMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']
    .map(m => ({ m, y: ['January', 'February', 'March'].includes(m) ? sessStart + 1 : sessStart }))
    .filter(({ m }) => isFlat ? ['February', 'March'].includes(m) : !['February', 'March'].includes(m))

  return (
    <div className="sff-bg" role="dialog" aria-label="Why is this student short" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <style>{CSS}</style>
      <div className="sff">
        <div className="sff-hd">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', color: '#E2C57E' }}>WHY SHORT? · SESSION {short(session)}</div>
            <h2><LedgerLink gcc={student.gcc_no} style={{ color: '#fff' }}>{student.name}</LedgerLink></h2>
            <div style={{ fontSize: 12.5, opacity: .8, marginTop: 2 }}>GCC-{student.gcc_no} · {student.course || '—'}{student.batch ? ' · ' + student.batch : ''} · {student.hostel_type || '—'}{bed === true ? ' · has a hostel bed' : bed === false ? ' · no hostel bed' : ''}</div>
            {owing.length > 0 && (
              <div className="sff-months" role="tablist" aria-label="Months with a balance">
                {owing.map(r => (
                  <button key={r.month + r.year} role="tab" aria-selected={sel === r} className={`sff-m${sel === r ? ' on' : ''}`} onClick={() => { setPick(`${r.month}|${r.year}`); setMsg(null) }}>
                    {r.month.slice(0, 3)} {String(r.year).slice(2)} · {inr(r.due)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="sff-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="sff-body">
          {!led && <div className="sff-card">Working out this student's fees…</div>}
          {msg && <div className={msg.err ? 'sff-err' : 'sff-ok'} role="status">{msg.text}</div>}

          {led && sel && (
            <>
              <div className="sff-card sff-why" aria-label="Reason">
                <h3>Most likely reason</h3>
                <b className="big">{headline}</b>
                <div className="sff-row"><span>{sel.head} expected for {sel.month} {sel.year}</span><b>{inr(sel.expected)}</b></div>
                <div className="sff-note" style={{ marginTop: -2 }}>
                  {type} rate for {student.course || '—'}{student.batch ? ` · ${student.batch}` : ''}, session {short(session)} (Fee Setup){changes.length ? ' — hostel type changed during the session, this month is charged as ' + type : ''}
                  {isFlat && led.rates?.flatFeeOverride ? ` · custom flat fee set for this student` : ''}.
                </div>
                <div className="sff-row"><span>Paid</span><b>{inr(paid)}</b></div>
                {sel.waived > 0 && <div className="sff-row"><span>Concession approved</span><b>{inr(sel.waived)}</b></div>}
                <div className="sff-row"><span>Balance due</span><b style={{ color: '#b42318' }}>{inr(sel.due)}</b></div>
                {matches.length > 1 && <div className="sff-note">Paid amount also matches {matches.slice(1).map(m => m.label).join(', ')}.</div>}
                {conc && <div className="sff-note">Low-fee request: <b>{conc.status}</b> — {conc.reason}{conc.reason_note ? ` (${conc.reason_note})` : ''}{conc.decided_by ? ` · by ${conc.decided_by}` : ''}</div>}
                {note && <div className="sff-note">Note on the payment: “{note}”</div>}
              </div>

              <div className="sff-card" aria-label="Payments for this month">
                <h3>Payments for {sel.month} {sel.year}</h3>
                {rows.length === 0 && <div className="sff-note">No payment recorded for this month.</div>}
                {rows.map(r => (
                  <div key={r.id} style={{ borderTop: '1px dotted #e6dfcd', padding: '8px 0' }}>
                    <div className="sff-row" style={{ borderTop: 'none' }}>
                      <span>{fmtD(r.pay_date)} · Rcpt {r.receipt_no || '—'} · {r.pay_mode || '—'} · by {r.collected_by || '—'}</span>
                      <b>{inr(isFlat ? r.amount : r.amount_paid)}</b>
                    </div>
                    <div className="sff-line">
                      <input type="number" placeholder="Correct amount" aria-label={`Correct amount for receipt ${r.receipt_no || r.id}`} value={f.amt[r.id] ?? ''} onChange={e => setF(v => ({ ...v, amt: { ...v.amt, [r.id]: e.target.value } }))} style={{ width: 140 }} />
                      <input placeholder="Why (e.g. typed ₹2,000 for ₹5,500)" aria-label="Reason for amount correction" value={f.amtWhy} onChange={e => setF(v => ({ ...v, amtWhy: e.target.value }))} style={{ flex: '1 1 200px' }} />
                      <button className="sff-b" style={btn('#1e3a6e')} disabled={!!busy} onClick={() => fixAmount(r)}>Correct amount</button>
                    </div>
                    <div className="sff-line" style={{ marginTop: 6 }}>
                      <select aria-label="Move payment to month" value={f.moveTo} onChange={e => setF(v => ({ ...v, moveTo: e.target.value }))}>
                        <option value="">— Paid for another month? —</option>
                        {sessionMonths.filter(x => !(x.m === sel.month && x.y === Number(sel.year))).map(x => <option key={x.m} value={`${x.m}|${x.y}`}>{x.m} {x.y}</option>)}
                      </select>
                      <input placeholder="Why" aria-label="Reason for moving payment" value={f.moveWhy} onChange={e => setF(v => ({ ...v, moveWhy: e.target.value }))} style={{ flex: '1 1 160px' }} />
                      <button className="sff-b" style={btn('#fff', '#1e3a6e', '1px solid #1e3a6e')} disabled={!!busy || !f.moveTo} onClick={() => moveMonth(r)}>Move payment</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sff-card sff-act" aria-label="Fix hostel type">
                <h3>Wrong hostel type?</h3>
                <div className="sff-note">Recorded as <b>{student.hostel_type || 'Day Scholar'}</b>{typeMatch ? <> — the payment matches the <b>{typeMatch.type}</b> rate.</> : '.'}{bed === true && htTo && htTo !== 'Boarder' ? <b style={{ color: '#b42318' }}> This student holds a hostel bed — check before changing.</b> : ''}</div>
                <div className="sff-line">
                  <select aria-label="Correct hostel type" value={htTo} onChange={e => setF(v => ({ ...v, htType: e.target.value }))}>
                    <option value="">— Correct type —</option>
                    {HOSTEL_TYPES.filter(t => t !== (student.hostel_type || 'Day Scholar')).map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select aria-label="Applies from" value={f.htMode} onChange={e => setF(v => ({ ...v, htMode: e.target.value }))}>
                    <option value="all">Record was wrong — all months</option>
                    <option value="from">Moved during the session — from a month</option>
                  </select>
                  {f.htMode === 'from' && (
                    <select aria-label="Effective from" value={f.htFrom || monthStart(sel.month, sel.year)} onChange={e => setF(v => ({ ...v, htFrom: e.target.value }))}>
                      {sessionMonths.map(x => <option key={x.m} value={monthStart(x.m, x.y)}>{x.m} {x.y}</option>)}
                    </select>
                  )}
                  <button className="sff-b" style={btn('#9a3412')} disabled={!!busy || !htTo} onClick={fixType}>Correct hostel type</button>
                </div>
              </div>

              {sel.status === 'short' && (
                <div className="sff-card sff-act" aria-label="Approve or refuse the shortfall">
                  <h3>Genuine discount?</h3>
                  <div className="sff-note">Approve the {inr(sel.due)} shortfall as a concession (the month becomes settled) or refuse it (the balance stays due).</div>
                  <div className="sff-line">
                    {!(conc && conc.status !== 'approved') && (
                      <select aria-label="Concession reason" value={f.reason} onChange={e => setF(v => ({ ...v, reason: e.target.value }))}>
                        {CONCESSION_REASONS.map(x => <option key={x}>{x}</option>)}
                      </select>
                    )}
                    <input placeholder="Note (optional)" aria-label="Concession note" value={f.note} onChange={e => setF(v => ({ ...v, note: e.target.value }))} style={{ flex: '1 1 180px' }} />
                    <button className="sff-b" style={btn('#146c3a')} disabled={!!busy} onClick={approve}>Approve {inr(sel.due)}</button>
                    {conc?.status === 'pending' && <button className="sff-b" style={btn('#fff', '#b42318', '1px solid #f3d0d0')} disabled={!!busy} onClick={refuse}>Refuse</button>}
                  </div>
                </div>
              )}

              <div className="sff-card sff-line" aria-label="Other actions" style={{ justifyContent: 'space-between' }}>
                <span className="sff-note">Still owed? Collect the balance. Wrong date or a payment to undo?</span>
                <span className="sff-line">
                  <button className="sff-b" style={btn('#dc2626')} onClick={() => { onCollect?.(student); onClose() }}>Collect {inr(sel.due)}</button>
                  <button className="sff-b" style={btn('#fff', '#1e3a6e', '1px solid #d8dfec')} onClick={() => { onOpenRevert?.(student); onClose() }}>Fix date / Revert</button>
                </span>
              </div>
            </>
          )}
          {led && !sel && <div className="sff-ok">✓ Nothing is due for {student.name} this session.</div>}
        </div>
      </div>
    </div>
  )
}


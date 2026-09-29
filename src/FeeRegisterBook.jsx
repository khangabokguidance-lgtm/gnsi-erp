// FeeRegisterBook.jsx — a student's fees laid out like the office's paper
// fee register: one ruled page per session with a month-wise register
// (April → March: what was due, what was paid, when, on which receipt) and a
// day book of every payment in order with a running total.
//
// Uses the same rules as the dues engine (feeDues.js): fee months follow the
// April–March session, Feb/Mar are flat-fee months, a month isn't due until it
// starts, and months before admission aren't charged.
import { loadStudentHistory, sessionRates, timeline } from './hostelHistory'
import { computeArrears } from './feeLedgerBulk'

const fmtMonth = d => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
// Month before a change's effective month (the last month at the old type).
const fmtMonthBefore = d => { const x = new Date(String(d).slice(0, 10) + 'T00:00'); x.setMonth(x.getMonth() - 1); return x.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) }
import { useEffect, useMemo, useState } from 'react'
import { getFeeRates, normalizeSessionYear, getSessionYear, gccStr } from './feeEngine'
import { printFeeReceipt } from './premiumReceipt'
import { ledgerUrl } from './ledgerLink'
import { fmt, fmtDate, escH, shortSession, toEntries, buildRegister, buildStatement, parentPhone, reminderText } from './feeLedgerModel'
import { StatementView, InsightsView } from './FeeLedgerTools'
import { openWhatsAppReminder, printDuesNotice, exportLedgerExcel } from './feeLedgerActions'

// Reprint one receipt with every line that was paid on it.
function reprintReceipt(student, entries, receiptNo) {
  const lines = entries.filter(x => x.receipt === receiptNo)
  if (!lines.length) return
  const first = lines[0]
  printFeeReceipt({
    receipt_no: receiptNo, pay_date: first.date, pay_mode: first.mode, txn_ref: first.ref, collected_by: first.by,
    student_name: student.name, adm_no: student.admission_no, gcc_no: student.gcc_no,
    class_name: [student.class_name, student.batch].filter(Boolean).join(' · '), course: student.course,
    hostel_type: student.hostel_type,
    items: lines.map(x => ({ particulars: x.particulars, period: x.period, category: x.category, amount: x.amount })),
  })
}

const STATUS = {
  paid:     { label: 'PAID',     ink: '#146c3a' },
  advance:  { label: 'ADVANCE',  ink: '#0b5c8a' },
  short:    { label: 'SHORT',    ink: '#b45309' },
  due:      { label: 'DUE',      ink: '#b42318' },
  upcoming: { label: 'Upcoming', ink: '#8a8f9c' },
  before:   { label: 'Before admission', ink: '#8a8f9c' },
}

const REG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=JetBrains+Mono:wght@600;700&family=Playfair+Display:wght@700&display=swap');
.frb{--ink:#1d3a78;--rule:#c9d6ee;--red:#c0392b;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1f2a44}
.frb-page{position:relative;background:#fffdf6;border:1px solid #e6dcc3;border-radius:6px 14px 14px 6px;box-shadow:0 1px 0 #efe6cf,0 3px 0 #f6f0e0,0 4px 0 #e6dcc3,0 22px 44px -26px rgba(60,40,10,.45);overflow:hidden}
.frb-page::before{content:'';position:absolute;top:0;bottom:0;left:46px;width:4px;border-left:1.5px solid rgba(192,57,43,.55);border-right:1.5px solid rgba(192,57,43,.55);pointer-events:none;z-index:1}
.frb-head{padding:18px 20px 14px 66px;border-bottom:2px solid var(--ink);background:linear-gradient(180deg,#fffaf0,#fffdf6)}
.frb-title{font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;color:var(--ink);letter-spacing:.01em}
.frb-inst{font-size:10.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}
.frb-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px 22px;margin-top:12px}
.frb-f{display:flex;gap:6px;align-items:baseline;font-size:12.5px;border-bottom:1px dotted #b9c4dc;padding:3px 0;min-width:0}
.frb-f b{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b7690;white-space:nowrap}
.frb-f span{font-family:'Caveat','Segoe Print','Bradley Hand',cursive;font-size:17px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.frb-sec{padding:14px 16px 16px 66px}
.frb-sech{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.frb-sech h3{font-family:'Playfair Display',Georgia,serif;font-size:16px;color:var(--ink);margin:0}
.frb-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.frb table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px;background-image:repeating-linear-gradient(180deg,transparent 0,transparent 33px,var(--rule) 33px,var(--rule) 34px)}
.frb th{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);text-align:left;padding:8px 9px;border-top:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink);background:#f3f6fd}
.frb td{padding:0 9px;height:34px;border-bottom:1px solid var(--rule);vertical-align:middle;white-space:nowrap}
.frb td+td,.frb th+th{border-left:1px solid var(--rule)}
.frb .num{text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700}
.frb .hand{font-family:'Caveat','Segoe Print','Bradley Hand',cursive;font-size:17px;color:var(--ink)}
.frb .muted{color:#9aa3b5}
.frb-stamp{display:inline-block;padding:1px 7px;border:1.5px solid currentColor;border-radius:4px;font-size:10px;font-weight:900;letter-spacing:.14em;transform:rotate(-4deg)}
.frb-rcpt{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;font-weight:700;color:#1d3a78;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
.frb-rcpt:hover{color:#b8923a}
.frb tfoot td{border-top:1.5px solid var(--ink);border-bottom:3px double var(--ink);font-weight:800;background:#f7f4ea}
.frb-tabs{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.frb-chip{padding:6px 13px;border-radius:999px;border:1px solid #d9d2c2;background:#fff;font-size:12.5px;font-weight:700;color:#2e3b52;cursor:pointer;font-family:inherit}
.frb-chip.on{background:linear-gradient(180deg,#1e3a6e,#132a4f);color:#fff;border-color:#132a4f}
.frb-date{padding:5px 8px;border:1px solid #d9d2c2;border-radius:8px;font:600 12px inherit;font-family:inherit;color:#1f2a44;background:#fff}
.frb-search{padding:7px 12px;border:1px solid #d9d2c2;border-radius:999px;font:600 12.5px inherit;font-family:inherit;min-width:0;width:220px;max-width:100%;background:#fff}
.frb-pane{display:flex;gap:4px;margin:14px 16px 0 66px;padding:4px;background:#f3efe3;border:1px solid #e6dcc3;border-radius:12px;width:fit-content;max-width:calc(100% - 82px);overflow-x:auto}
.frb-pane button{padding:7px 14px;border-radius:9px;border:none;background:none;font:700 12.5px inherit;font-family:inherit;color:#5d6b82;cursor:pointer;white-space:nowrap}
.frb-pane button.on{background:#fff;color:#1d3a78;box-shadow:0 1px 3px rgba(60,40,10,.18)}
@media (max-width:640px){.frb-pane{margin-left:30px;max-width:calc(100% - 40px)}}
.frb-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 16px 0 66px}
.frb-sumc{border:1px solid #e6dcc3;border-radius:10px;padding:9px 12px;background:#fff}
.frb-sumc b{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b7690}
.frb-sumc span{font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700}
@media (max-width:640px){.frb-page::before{left:18px}.frb-head,.frb-sec{padding-left:30px}.frb-sum{margin-left:30px;margin-right:10px}.frb-title{font-size:19px}}
`

export default function FeeRegisterBook({ student, admRows, flatRows, crsRows, mobile }) {
  const entries = useMemo(() => toEntries(student, admRows, flatRows, crsRows), [student, admRows, flatRows, crsRows])
  const sessions = useMemo(() => {
    const set = new Set([getSessionYear()])
    const own = normalizeSessionYear(student.session)
    if (own && /^\d{4}-\d{4}$/.test(own)) set.add(own)
    entries.forEach(x => x.session && set.add(x.session))
    return [...set].sort().reverse()
  }, [entries, student.session])
  const [session, setSession] = useState(() => sessions.includes(getSessionYear()) ? getSessionYear() : sessions[0])
  // Hostel type changes (effective month) — earlier months keep the old type's rate.
  const [hist, setHist] = useState({ gcc: null, changes: [] })
  useEffect(() => {
    let live = true
    loadStudentHistory(student.gcc_no).then(changes => { if (live) setHist({ gcc: student.gcc_no, changes }) })
    return () => { live = false }
  }, [student.gcc_no, student.hostel_type])
  const changes = useMemo(() => (hist.gcc === student.gcc_no ? hist.changes : []), [hist, student.gcc_no])
  const histSig = changes.map(c => `${c.effective_from}:${c.to_type}`).join(',')
  // Rates for the session on screen; results for a previous session are ignored.
  const rateKey = [session, student.course, student.batch, student.hostel_type, student.gcc_no, histSig].join('|')
  const [rateState, setRateState] = useState({ key: null, rates: null, error: '' })
  const rates = rateState.key === rateKey ? rateState.rates : null
  const ratesError = rateState.key === rateKey ? rateState.error : ''
  const [bookScope, setBookScope] = useState('session') // 'session' | 'all'
  const [copied, setCopied] = useState(false)
  const [pane, setPane] = useState('register') // 'register' | 'statement' | 'insights'
  const [bookQuery, setBookQuery] = useState('')
  const [notice, setNotice] = useState('')
  // Every earlier session's unpaid dues (each at its own rates) → brought
  // forward: the statement's opening balance and part of the balance due.
  const prevKey = [session, student.course, student.batch, student.hostel_type, student.gcc_no, histSig, entries.length, entries.reduce((t, x) => t + (Number(x.amount) || 0), 0)].join('|')
  const [prevState, setPrevState] = useState({ key: null, arrears: 0, bySession: [] })
  const openingBalance = prevState.key === prevKey ? prevState.arrears : 0
  const arrearsBySession = prevState.key === prevKey ? prevState.bySession : []

  useEffect(() => {
    let live = true
    sessionRates(student, session, changes, type => getFeeRates(session, student.course || '', student.batch || '', type, gccStr(student.gcc_no)))
      .then(r => { if (live) setRateState({ key: rateKey, rates: r, error: '' }) })
      .catch(e => { if (live) setRateState({ key: rateKey, rates: null, error: e.message || 'Could not load fee rates' }) })
    return () => { live = false }
  }, [rateKey, session, student, changes])

  useEffect(() => {
    let live = true
    computeArrears(student, session, entries, changes, sess => type => getFeeRates(sess, student.course || '', student.batch || '', type, gccStr(student.gcc_no)))
      .then(r => { if (live) setPrevState({ key: prevKey, ...r }) })
      .catch(() => { if (live) setPrevState({ key: prevKey, arrears: 0, bySession: [] }) })
    return () => { live = false }
  }, [prevKey, session, student, entries, changes])

  const curRates = typeof rates === 'function' ? rates.current : rates
  const reg = useMemo(() => buildRegister(student, entries, session, rates), [student, entries, session, rates])
  const statement = useMemo(() => buildStatement(student, entries, session, reg, { openingBalance }), [student, entries, session, reg, openingBalance])
  const q = bookQuery.trim().toLowerCase()
  const book = (bookScope === 'all' ? entries : entries.filter(x => x.session === session))
    .filter(x => !q || [x.receipt, x.particulars, x.period, x.mode, x.by, x.ref, String(x.amount), fmtDate(x.date)].some(v => String(v || '').toLowerCase().includes(q)))
  const bookRows = book.reduce((acc, x) => [...acc, { ...x, running: (acc.length ? acc[acc.length - 1].running : 0) + x.amount }], [])
  const bookTotal = bookRows.length ? bookRows[bookRows.length - 1].running : 0

  const receiptBtn = no => no
    ? <button type="button" className="frb-rcpt" title="Reprint this receipt" onClick={() => reprintReceipt(student, entries, no)}>{no}</button>
    : <span className="muted">—</span>

  const sendReminder = () => {
    const { phone } = openWhatsAppReminder(student, reg, session, arrearsBySession)
    setNotice(phone ? `WhatsApp opened for +${phone}.` : 'No parent phone on file — WhatsApp opened so you can pick the contact.')
    setTimeout(() => setNotice(''), 4000)
  }
  const copyReminder = async () => {
    try { await navigator.clipboard.writeText(reminderText(student, reg, session, arrearsBySession)); setNotice('Reminder message copied.') }
    catch { setNotice('Could not copy — use the WhatsApp button instead.') }
    setTimeout(() => setNotice(''), 3000)
  }
  const doExport = async () => {
    try { await exportLedgerExcel(student, reg, bookRows, statement, session); setNotice('Excel file downloaded.') }
    catch (e) { setNotice('Export failed: ' + (e.message || e)) }
    setTimeout(() => setNotice(''), 3000)
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(ledgerUrl(student.gcc_no)); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { window.prompt('Copy this ledger link:', ledgerUrl(student.gcc_no)) }
  }

  return (
    <div className="frb">
      <style>{REG_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="frb-tabs" role="tablist" aria-label="Session">
          {sessions.map(s => (
            <button key={s} role="tab" aria-selected={s === session} className={'frb-chip' + (s === session ? ' on' : '')} onClick={() => setSession(s)}>
              Session {shortSession(s)}
            </button>
          ))}
        </div>
        <div className="frb-tabs">
          <button className="frb-chip" onClick={copyLink} title={ledgerUrl(student.gcc_no)}>{copied ? '✓ Link copied' : '🔗 Copy ledger link'}</button>
          <button className="frb-chip" onClick={() => printRegister(student, reg, bookRows, session, bookScope)}>🖨️ Print register</button>
          <button className="frb-chip" onClick={sendReminder} title={parentPhone(student) ? `Send to +${parentPhone(student)}` : 'No parent phone on file'}>📲 WhatsApp reminder</button>
          <button className="frb-chip" onClick={copyReminder}>📋 Copy reminder</button>
          <button className="frb-chip" onClick={() => printDuesNotice(student, reg, session, arrearsBySession)}>📄 Dues notice</button>
          <button className="frb-chip" onClick={doExport}>⬇️ Excel</button>
        </div>
      </div>
      {notice && <div role="status" style={{ margin: '-4px 0 10px', fontSize: 12.5, fontWeight: 700, color: '#146c3a' }}>{notice}</div>}

      <div className="frb-page">
        <div className="frb-head">
          <div className="frb-inst">Guidance Navodaya &amp; Sainik Institute · Khangabok</div>
          <div className="frb-title">Fee Collection Register — Session {shortSession(session)}</div>
          <div className="frb-fields">
            <div className="frb-f"><b>Name</b><span>{student.name}</span></div>
            <div className="frb-f"><b>GCC No.</b><span>GCC-{student.gcc_no}</span></div>
            <div className="frb-f"><b>Adm. No.</b><span>{student.admission_no || '—'}</span></div>
            <div className="frb-f"><b>Course</b><span>{[student.course, student.batch].filter(Boolean).join(' · ') || '—'}</span></div>
            <div className="frb-f"><b>Hostel</b><span>{student.hostel_type || '—'}</span></div>
            <div className="frb-f"><b>Admitted</b><span>{fmtDate(student.admission_date)}</span></div>
          </div>
        </div>

        <div className="frb-sum">
          <div className="frb-sumc"><b>Paid this session</b><span style={{ color: '#146c3a' }}>₹{fmt(reg.totalPaid)}</span></div>
          <div className="frb-sumc"><b>Balance due now</b><span style={{ color: reg.totalDue + openingBalance ? '#b42318' : '#146c3a' }}>{rates ? `₹${fmt(reg.totalDue + openingBalance)}` : '…'}</span>{openingBalance > 0 && <small title={arrearsBySession.map(a => `${shortSession(a.session)}: ₹${fmt(a.due)} (${a.months.join(', ')})`).join('\n')} style={{ display: 'block', fontSize: 11, color: '#9a3412', marginTop: 2 }}>incl. ₹{fmt(openingBalance)} from {arrearsBySession.map(a => shortSession(a.session)).join(', ')}</small>}</div>
          <div className="frb-sumc"><b>Months due</b><span style={{ color: reg.dueMonths ? '#b42318' : '#146c3a' }}>{rates ? reg.dueMonths : '…'}</span></div>
          <div className="frb-sumc"><b>Monthly rate{changes.length ? ` (${student.hostel_type || 'Day Scholar'})` : ''}</b><span style={{ color: '#1d3a78', fontSize: 15 }}>{curRates ? `₹${fmt(curRates.courseFee)} course · ₹${fmt(curRates.flatFee)} flat` : '…'}</span></div>
        </div>
        {changes.length > 0 && (
          <div role="note" aria-label="Hostel type history" style={{ margin: '10px 16px 0 66px', fontSize: 12.5, color: '#1d3a78', background: '#eef2f9', border: '1px solid #d6dfef', borderRadius: 10, padding: '8px 12px' }}>
            🏠 <b>Hostel type changed:</b> {timeline(student, changes).map((seg, i) => <span key={i}>{i ? ' → ' : ''}<b>{seg.type}</b>{seg.to ? ` until ${fmtMonthBefore(seg.to)}` : seg.from ? ` from ${fmtMonth(seg.from)}` : ''}</span>)}. Each month is charged at the type in effect that month; earlier payments are unchanged.
          </div>
        )}
        {ratesError && <div style={{ margin: '10px 16px 0 66px', color: '#b42318', fontSize: 12.5, fontWeight: 600 }}>⚠️ {ratesError} — amounts due can't be shown.</div>}
        {curRates?.usingFallbackRates && <div style={{ margin: '10px 16px 0 66px', color: '#9a5b00', fontSize: 12 }}>Fee Setup has no rate for this course/batch/hostel in {shortSession(session)} — showing the default rates.</div>}

        <div className="frb-pane" role="tablist" aria-label="Ledger section">
          {[['register', '📅 Month-wise'], ['statement', '🧾 Statement'], ['insights', '📊 Insights']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={pane === id} className={pane === id ? 'on' : ''} onClick={() => setPane(id)}>{label}</button>
          ))}
        </div>

        {pane === 'statement' && <StatementView student={student} entries={entries} reg={reg} session={session} openingBalance={openingBalance} rates={rates} />}
        {pane === 'insights' && <InsightsView student={student} entries={entries} reg={reg} session={session} rates={rates} onJump={() => setPane('register')} />}

        {pane === 'register' && <>
        {/* ── Month-wise register ── */}
        <div className="frb-sec">
          <div className="frb-sech">
            <h3>Month-wise register</h3>
            <span style={{ fontSize: 11.5, color: '#6b7690' }}>April → March · Feb &amp; Mar are flat-fee months · click a receipt no. to reprint</span>
          </div>
          <div className="frb-scroll">
            <table>
              <thead>
                <tr><th>Month</th><th>Fee head</th><th style={{ textAlign: 'right' }}>Due (₹)</th><th style={{ textAlign: 'right' }}>Paid (₹)</th><th>Date</th><th>Receipt No.</th><th>Mode</th><th>Status</th></tr>
              </thead>
              <tbody>
                {reg.admission && (
                  <tr>
                    <td className="hand">Admission</td><td>Admission Fee</td>
                    <td className="num">{fmt(reg.admission.expected)}</td>
                    <td className="num">{reg.admission.paidAmt ? fmt(reg.admission.paidAmt) : <span className="muted">—</span>}</td>
                    <td>{reg.admission.paid[0] ? fmtDate(reg.admission.paid[0].date) : <span className="muted">—</span>}</td>
                    <td>{reg.admission.paid.length ? reg.admission.paid.map((x, i) => <span key={i}>{i ? ', ' : ''}{receiptBtn(x.receipt)}</span>) : <span className="muted">—</span>}</td>
                    <td>{reg.admission.paid[0]?.mode || <span className="muted">—</span>}</td>
                    <td><Stamp s={reg.admission.due ? (reg.admission.paidAmt ? 'short' : 'due') : 'paid'} extra={reg.admission.due ? `₹${fmt(reg.admission.due)}` : ''} /></td>
                  </tr>
                )}
                {reg.rows.map(r => (
                  <tr key={r.month}>
                    <td className="hand">{r.month.slice(0, 3)} {r.year}</td>
                    <td>{r.head}{changes.length > 0 && r.hostelType && <span className="muted" style={{ fontSize: 11 }}> · {r.hostelType}</span>}</td>
                    <td className="num">{rates ? fmt(r.expected) : '…'}</td>
                    <td className="num">{r.paidAmt ? fmt(r.paidAmt) : <span className="muted">—</span>}</td>
                    <td>{r.paid[0] ? fmtDate(r.paid[0].date) : <span className="muted">—</span>}</td>
                    <td>{r.paid.length ? r.paid.map((x, i) => <span key={i}>{i ? ', ' : ''}{receiptBtn(x.receipt)}</span>) : <span className="muted">—</span>}</td>
                    <td>{r.paid[0]?.mode || <span className="muted">—</span>}</td>
                    <td><Stamp s={r.status} extra={r.status === 'due' && rates ? `₹${fmt(r.due)}` : r.status === 'short' ? `₹${fmt(r.expected - r.paidAmt)} short` : ''} /></td>
                  </tr>
                ))}
                {reg.other.map((x, i) => (
                  <tr key={'o' + i}>
                    <td className="hand">{x.kind === 'advance' ? 'Advance' : 'Kit'}</td><td>{x.particulars}</td>
                    <td className="num muted">—</td><td className="num">{fmt(x.amount)}</td><td>{fmtDate(x.date)}</td>
                    <td>{receiptBtn(x.receipt)}</td><td>{x.mode || '—'}</td><td><Stamp s="paid" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total for session {shortSession(session)}</td>
                  <td className="num">{fmt(reg.totalPaid)}</td>
                  <td colSpan={3} style={{ textAlign: 'right' }}>Balance due</td>
                  <td className="num" style={{ color: reg.totalDue ? '#b42318' : '#146c3a' }}>{rates ? `₹${fmt(reg.totalDue)}` : '…'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Day book ── */}
        <div className="frb-sec" style={{ paddingTop: 4 }}>
          <div className="frb-sech">
            <h3>Day book — every payment in order</h3>
            <div className="frb-tabs">
              <input className="frb-search" type="search" value={bookQuery} onChange={e => setBookQuery(e.target.value)} placeholder="Search receipt, month, mode, amount…" aria-label="Search day book" />
              <button className={'frb-chip' + (bookScope === 'session' ? ' on' : '')} onClick={() => setBookScope('session')}>This session</button>
              <button className={'frb-chip' + (bookScope === 'all' ? ' on' : '')} onClick={() => setBookScope('all')}>All time</button>
            </div>
          </div>
          <div className="frb-scroll">
            <table>
              <thead>
                <tr><th>S.No</th><th>Date</th><th>Receipt No.</th><th>Particulars</th><th>For</th><th>Mode / Ref</th><th>Collected by</th><th style={{ textAlign: 'right' }}>Amount (₹)</th><th style={{ textAlign: 'right' }}>Progressive (₹)</th></tr>
              </thead>
              <tbody>
                {bookRows.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center' }}>{q ? `No payment matches “${bookQuery}”.` : `No payments recorded${bookScope === 'session' ? ` in ${shortSession(session)}` : ''}.`}</td></tr>}
                {bookRows.map((x, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    <td>{fmtDate(x.date)}</td>
                    <td>{receiptBtn(x.receipt)}</td>
                    <td style={{ fontWeight: 600 }}>{x.particulars}{x.advance && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#0b5c8a' }}>ADVANCE</span>}</td>
                    <td className="hand">{x.period}</td>
                    <td>{x.mode || '—'}{x.ref ? <span className="muted"> · {x.ref}</span> : null}</td>
                    <td>{x.by || <span className="muted">—</span>}</td>
                    <td className="num">{fmt(x.amount)}</td>
                    <td className="num" style={{ color: '#1d3a78' }}>{fmt(x.running)}</td>
                  </tr>
                ))}
              </tbody>
              {bookRows.length > 0 && (
                <tfoot><tr><td colSpan={7}>Total — {bookRows.length} payment{bookRows.length === 1 ? '' : 's'}</td><td className="num">{fmt(bookTotal)}</td><td /></tr></tfoot>
              )}
            </table>
          </div>
          {mobile && <div style={{ fontSize: 11, color: '#8a93a6', marginTop: 6 }}>Swipe the register sideways to see every column.</div>}
        </div>
        </>}
      </div>
    </div>
  )
}

function Stamp({ s, extra }) {
  const st = STATUS[s] || STATUS.upcoming
  const stamped = ['paid', 'advance', 'short', 'due'].includes(s)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: st.ink }}>
      {stamped ? <span className="frb-stamp">{st.label}</span> : <span style={{ fontSize: 11.5, fontStyle: 'italic' }}>{st.label}</span>}
      {extra && <span style={{ fontSize: 11.5, fontWeight: 700 }}>{extra}</span>}
    </span>
  )
}

// Printable register page (A4 landscape), same layout as on screen.
function printRegister(student, reg, bookRows, session, bookScope) {
  const row = cells => `<tr>${cells.map(c => `<td${c.r ? ' class="num"' : ''}>${c.v}</td>`).join('')}</tr>`
  const mRows = [
    ...(reg.admission ? [row([{ v: 'Admission' }, { v: 'Admission Fee' }, { v: fmt(reg.admission.expected), r: 1 }, { v: reg.admission.paidAmt ? fmt(reg.admission.paidAmt) : '—', r: 1 }, { v: escH(reg.admission.paid[0] ? fmtDate(reg.admission.paid[0].date) : '—') }, { v: escH(reg.admission.paid.map(x => x.receipt).filter(Boolean).join(', ') || '—') }, { v: reg.admission.due ? `DUE ₹${fmt(reg.admission.due)}` : 'PAID' }])] : []),
    ...reg.rows.map(r => row([{ v: `${r.month.slice(0, 3)} ${r.year}` }, { v: r.head }, { v: fmt(r.expected), r: 1 }, { v: r.paidAmt ? fmt(r.paidAmt) : '—', r: 1 }, { v: escH(r.paid[0] ? fmtDate(r.paid[0].date) : '—') }, { v: escH(r.paid.map(x => x.receipt).filter(Boolean).join(', ') || '—') }, { v: STATUS[r.status].label + (r.status === 'due' ? ` ₹${fmt(r.due)}` : '') }])),
    ...reg.other.map(x => row([{ v: x.kind === 'advance' ? 'Advance' : 'Kit' }, { v: escH(x.particulars) }, { v: '—', r: 1 }, { v: fmt(x.amount), r: 1 }, { v: escH(fmtDate(x.date)) }, { v: escH(x.receipt || '—') }, { v: 'PAID' }])),
  ].join('')
  const bRows = bookRows.map((x, i) => row([{ v: i + 1 }, { v: escH(fmtDate(x.date)) }, { v: escH(x.receipt || '—') }, { v: escH(x.particulars) }, { v: escH(x.period) }, { v: escH(x.mode || '—') }, { v: escH(x.by || '—') }, { v: fmt(x.amount), r: 1 }, { v: fmt(x.running), r: 1 }])).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee Register — ${escH(student.name)}</title><style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@600&family=Caveat:wght@600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f2a44;background:#fffdf6;padding:18px 18px 18px 54px;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body:before{content:'';position:fixed;top:0;bottom:0;left:36px;width:4px;border-left:1.5px solid rgba(192,57,43,.6);border-right:1.5px solid rgba(192,57,43,.6)}
  h1{font-family:'Playfair Display',serif;color:#1d3a78;font-size:22px}.inst{font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9a7b2f}
  .f{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 22px;margin:10px 0 14px;border-bottom:2px solid #1d3a78;padding-bottom:10px}.f div{font-size:12px;border-bottom:1px dotted #b9c4dc;padding:2px 0}.f b{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#6b7690;margin-right:6px}.f span{font-family:'Caveat',cursive;font-size:17px;color:#1d3a78}
  h2{font-family:'Playfair Display',serif;color:#1d3a78;font-size:15px;margin:14px 0 6px}
  table{width:100%;border-collapse:collapse;font-size:11.5px}th{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#1d3a78;text-align:left;padding:6px 7px;border-top:1.5px solid #1d3a78;border-bottom:1.5px solid #1d3a78;background:#f3f6fd}
  td{padding:6px 7px;border-bottom:1px solid #c9d6ee}td+td,th+th{border-left:1px solid #c9d6ee}.num{text-align:right;font-family:'JetBrains Mono',monospace}
  .tot{margin-top:6px;text-align:right;font-weight:800;border-top:3px double #1d3a78;padding-top:6px}
  .sig{display:flex;justify-content:space-between;margin-top:36px;font-size:10px;color:#6b7690}.sig div{border-top:1px solid #1f2a44;padding-top:4px;width:180px;text-align:center}
  @page{size:A4 landscape;margin:10mm}.np{margin-top:14px}@media print{.np{display:none}}
  </style></head><body>
  <div class="inst">Guidance Navodaya &amp; Sainik Institute · Khangabok, Thoubal, Manipur</div>
  <h1>Fee Collection Register — Session ${escH(shortSession(session))}</h1>
  <div class="f"><div><b>Name</b><span>${escH(student.name)}</span></div><div><b>GCC No.</b><span>GCC-${escH(student.gcc_no)}</span></div><div><b>Adm. No.</b><span>${escH(student.admission_no || '—')}</span></div><div><b>Course</b><span>${escH([student.course, student.batch].filter(Boolean).join(' · ') || '—')}</span></div><div><b>Hostel</b><span>${escH(student.hostel_type || '—')}</span></div><div><b>Admitted</b><span>${escH(fmtDate(student.admission_date))}</span></div></div>
  <h2>Month-wise register</h2>
  <table><thead><tr><th>Month</th><th>Fee head</th><th>Due (₹)</th><th>Paid (₹)</th><th>Date</th><th>Receipt No.</th><th>Status</th></tr></thead><tbody>${mRows}</tbody></table>
  <div class="tot">Paid this session ₹${fmt(reg.totalPaid)} &nbsp;·&nbsp; Balance due ₹${fmt(reg.totalDue)}</div>
  <h2>Day book${bookScope === 'all' ? ' (all time)' : ''}</h2>
  <table><thead><tr><th>S.No</th><th>Date</th><th>Receipt No.</th><th>Particulars</th><th>For</th><th>Mode</th><th>Collected by</th><th>Amount (₹)</th><th>Progressive (₹)</th></tr></thead><tbody>${bRows || '<tr><td colspan="9">No payments.</td></tr>'}</tbody></table>
  <div class="sig"><span>Printed ${escH(new Date().toLocaleString('en-IN'))}</span><div>Accounts Office</div><div>Principal</div></div>
  <div class="np"><button onclick="window.print()">🖨 Print</button></div>
  </body></html>`
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  w.document.write(html); w.document.close()
  setTimeout(() => { try { w.focus(); w.print() } catch { /* user can press Print */ } }, 700)
}

// FeeRegisterBook.jsx — a student's fees laid out like the office's paper
// fee register: one ruled page per session with a month-wise register
// (April → March: what was due, what was paid, when, on which receipt) and a
// day book of every payment in order with a running total.
//
// Uses the same rules as the dues engine (feeDues.js): fee months follow the
// April–March session, Feb/Mar are flat-fee months, a month isn't due until it
// starts, and months before admission aren't charged.
import { useEffect, useMemo, useState } from 'react'
import {
  getFeeRates, MONTHS_LIST, isFlatFeeMonth, feeMonthYearForSession, sessionStartYear,
  isPreAdmissionMonth, normalizeSessionYear, getSessionYear, ADM_FEE_BASE, gccStr,
} from './feeEngine'
import { printFeeReceipt } from './premiumReceipt'
import { ledgerUrl } from './ledgerLink'

const fmt = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Session a fee month belongs to: Apr–Dec of Y → Y-(Y+1); Jan–Mar of Y → (Y-1)-Y.
const sessionOfMonth = (month, year) => {
  const y = Number(year)
  if (!month || !y) return null
  const start = isJanToMar(month) ? y - 1 : y
  return `${start}-${start + 1}`
}
const isJanToMar = m => ['January', 'February', 'March'].includes(m)
const sessionOfDate = d => {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  const start = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1
  return `${start}-${start + 1}`
}
const shortSession = s => { const m = String(s || '').match(/^(\d{4})-(\d{4})$/); return m ? `${m[1]}-${m[2].slice(2)}` : s }
const monthStarted = (month, year) => new Date(Number(year), new Date(`${month} 1, 2000`).getMonth(), 1) <= new Date()

// One normalised entry per payment row, whichever table it came from.
function toEntries(student, admRows, flatRows, crsRows) {
  const e = []
  for (const r of admRows) e.push({
    kind: r.fee_type === 'advance' ? 'advance' : r.fee_type === 'item' ? 'item' : 'admission',
    date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount_paid) || 0, mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by,
    particulars: r.description || (r.fee_type === 'admission' ? 'Admission Fee' : 'Admission / Kit'),
    period: 'One-time', category: 'Admission & Kit', session: sessionOfDate(r.pay_date),
  })
  for (const r of flatRows) e.push({
    kind: 'flat', month: r.month, year: Number(r.year), date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount) || 0,
    mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by, advance: !!r.is_advance,
    particulars: 'Monthly Flat Fee', period: `${r.month} ${r.year}`, category: r.hostel_type || student.hostel_type || 'Hostel',
    session: sessionOfMonth(r.month, r.year),
  })
  for (const r of crsRows) e.push({
    kind: 'course', month: r.for_month, year: Number(r.year), date: r.pay_date, receipt: r.receipt_no, amount: Number(r.amount_paid) || 0,
    mode: r.pay_mode, ref: r.txn_ref, by: r.collected_by, advance: !!r.is_advance,
    particulars: `Course Fee${r.course ? ' — ' + r.course : ''}${r.subtype ? ' ' + r.subtype : ''}`, period: `${r.for_month} ${r.year}`,
    category: r.course || student.course || 'Course', session: sessionOfMonth(r.for_month, r.year),
  })
  return e.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.receipt || '').localeCompare(String(b.receipt || '')))
}

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

// Month-wise register for one session.
function buildRegister(student, entries, session, rates) {
  const start = sessionStartYear(session)
  const admissionDate = student.admission_date || null
  const rows = MONTHS_LIST.map(month => {
    const year = feeMonthYearForSession(month, session)
    const flat = isFlatFeeMonth(month)
    const head = flat ? 'Flat Fee' : 'Course Fee'
    const expected = flat ? Number(rates?.flatFee || 0) : Number(rates?.courseFee || 0)
    const paid = entries.filter(x => x.kind === (flat ? 'flat' : 'course') && x.month === month && Number(x.year) === year)
    const paidAmt = paid.reduce((s, x) => s + x.amount, 0)
    let status
    if (paid.length) status = paid.some(x => x.advance) ? 'advance' : paidAmt + 0.5 < expected ? 'short' : 'paid'
    else if (isPreAdmissionMonth(month, year, admissionDate)) status = 'before'
    else if (!monthStarted(month, year)) status = 'upcoming'
    else status = 'due'
    const due = status === 'due' ? expected : 0
    return { month, year, head, expected, paid, paidAmt, status, due }
  })
  // Admission fee: shown in the session it was paid in, or — if unpaid — in
  // the student's own session.
  const admEntries = entries.filter(x => x.kind === 'admission')
  const admSession = admEntries[0]?.session || normalizeSessionYear(student.session) || sessionOfDate(admissionDate)
  const admExpected = Number(rates?.admissionFee ?? ADM_FEE_BASE)
  const admPaid = admEntries.reduce((s, x) => s + x.amount, 0)
  const admission = admSession === session
    ? { expected: admExpected, paid: admEntries, paidAmt: admPaid, due: Math.max(0, admExpected - admPaid) }
    : null
  const other = entries.filter(x => (x.kind === 'item' || x.kind === 'advance') && x.session === session)
  const totalPaid = rows.reduce((s, r) => s + r.paidAmt, 0) + (admission?.paidAmt || 0) + other.reduce((s, x) => s + x.amount, 0)
  const totalDue = rows.reduce((s, r) => s + r.due, 0) + (admission?.due || 0)
  return { start, rows, admission, other, totalPaid, totalDue, dueMonths: rows.filter(r => r.status === 'due').length }
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
  // Rates for the session on screen; results for a previous session are ignored.
  const rateKey = [session, student.course, student.batch, student.hostel_type, student.gcc_no].join('|')
  const [rateState, setRateState] = useState({ key: null, rates: null, error: '' })
  const rates = rateState.key === rateKey ? rateState.rates : null
  const ratesError = rateState.key === rateKey ? rateState.error : ''
  const [bookScope, setBookScope] = useState('session') // 'session' | 'all'
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    getFeeRates(session, student.course || '', student.batch || '', student.hostel_type || 'Day Scholar', gccStr(student.gcc_no))
      .then(r => { if (live) setRateState({ key: rateKey, rates: r, error: '' }) })
      .catch(e => { if (live) setRateState({ key: rateKey, rates: null, error: e.message || 'Could not load fee rates' }) })
    return () => { live = false }
  }, [rateKey, session, student.course, student.batch, student.hostel_type, student.gcc_no])

  const reg = useMemo(() => buildRegister(student, entries, session, rates), [student, entries, session, rates])
  const book = bookScope === 'all' ? entries : entries.filter(x => x.session === session)
  const bookRows = book.reduce((acc, x) => [...acc, { ...x, running: (acc.length ? acc[acc.length - 1].running : 0) + x.amount }], [])
  const bookTotal = bookRows.length ? bookRows[bookRows.length - 1].running : 0

  const receiptBtn = no => no
    ? <button type="button" className="frb-rcpt" title="Reprint this receipt" onClick={() => reprintReceipt(student, entries, no)}>{no}</button>
    : <span className="muted">—</span>

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
        </div>
      </div>

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
          <div className="frb-sumc"><b>Balance due now</b><span style={{ color: reg.totalDue ? '#b42318' : '#146c3a' }}>{rates ? `₹${fmt(reg.totalDue)}` : '…'}</span></div>
          <div className="frb-sumc"><b>Months due</b><span style={{ color: reg.dueMonths ? '#b42318' : '#146c3a' }}>{rates ? reg.dueMonths : '…'}</span></div>
          <div className="frb-sumc"><b>Monthly rate</b><span style={{ color: '#1d3a78', fontSize: 15 }}>{rates ? `₹${fmt(rates.courseFee)} course · ₹${fmt(rates.flatFee)} flat` : '…'}</span></div>
        </div>
        {ratesError && <div style={{ margin: '10px 16px 0 66px', color: '#b42318', fontSize: 12.5, fontWeight: 600 }}>⚠️ {ratesError} — amounts due can't be shown.</div>}
        {rates?.usingFallbackRates && <div style={{ margin: '10px 16px 0 66px', color: '#9a5b00', fontSize: 12 }}>Fee Setup has no rate for this course/batch/hostel in {shortSession(session)} — showing the default rates.</div>}

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
                    <td>{r.head}</td>
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
                {bookRows.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center' }}>No payments recorded{bookScope === 'session' ? ` in ${shortSession(session)}` : ''}.</td></tr>}
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

// FeeMonthlyCheck.jsx — admin tab: did each student pay what their course and hostel type require,
// month by month? Read-only; the checking itself is lib/monthlyFeeCheck.js.
import { useEffect, useMemo, useState } from 'react'
import { loadMonthlyFeeScan } from './hostelFeeCheck'
import StudentJump from './StudentJump'
import { sessionOfMonthYear } from './lib/feeTypeDetect'
import { roundingCandidates } from './lib/monthlyFeeCheck'
import { correctFeeCollectionAmount } from './feeEngine'
import { loggedInName } from './lib/collector'
import { sessionOfDate } from './feeLedgerModel'
import { card, cell, head, btn, input, pill, titleStyle, subtitleStyle } from './feeTheme'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const VERDICT = {
  ok:           ['OK',               '#146c3a', '#e7f6ec'],
  short:        ['Short',            '#b42318', '#fde8e6'],
  excess:       ['Excess',           '#9a5b00', '#fff4dc'],
  'wrong-type': ['Wrong hostel type', '#7c3aed', '#f3efff'],
  concession:   ['Concession',       '#0f766e', '#e8f7f4'],
  'no-rate':    ['No rate set',      '#475569', '#f1f5f9'],
}
const FLAG = { 'tag-differs': 'charged under a different hostel type', 'course-differs': 'paid under a different course' }
const Pill = ({ v }) => { const [t, c, bg] = VERDICT[v] || [v, '#475569', '#f1f5f9']; return <span style={{ fontSize: 11, fontWeight: 800, color: c, background: bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>{t}</span> }

function downloadCsv(rows, filename) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export default function FeeMonthlyCheck({ students = [], adm_course_fees = [], adm_flat_fees = [], onCollect, onLedger, isAdmin = false, currentUser = null, onChanged }) {
  const [scan, setScan] = useState(null)       // { results, summary } | { error }
  const [session, setSession] = useState(sessionOfDate(new Date()))
  const [only, setOnly] = useState('problems')  // 'problems' | 'all'
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let live = true
    loadMonthlyFeeScan({ students, courseRows: adm_course_fees, flatRows: adm_flat_fees })
      .then(r => { if (live) setScan(r) })
      .catch(e => { if (live) setScan({ error: e.message || String(e) }) })
    return () => { live = false }
  }, [students, adm_course_fees, adm_flat_fees])

  const sessions = useMemo(() => {
    const set = new Set([sessionOfDate(new Date())])
    for (const r of adm_course_fees) { const s = sessionOfMonthYear(r.for_month, r.year); if (s) set.add(s) }
    for (const r of adm_flat_fees) { const s = sessionOfMonthYear(r.month, r.year); if (s) set.add(s) }
    return [...set].sort().reverse()
  }, [adm_course_fees, adm_flat_fees])

  // Narrow the scan to the chosen session, then to the search box and the problems-only switch.
  const rows = useMemo(() => {
    if (!scan || scan.error) return []
    const needle = q.trim().toLowerCase()
    return scan.results.map(r => {
      const months = r.months.filter(m => m.session === session)
      const problems = months.filter(m => ['short', 'excess', 'wrong-type'].includes(m.verdict) || m.flags.length)
      return { ...r, months, problems }
    }).filter(r => r.months.length
      && (only === 'all' || r.problems.length)
      && (!needle || `${r.student.name} ${r.student.gcc_no} ${r.student.course}`.toLowerCase().includes(needle)))
      .sort((a, b) => b.problems.length - a.problems.length)
  }, [scan, session, only, q])

  const counts = useMemo(() => {
    const c = { months: 0, ok: 0, short: 0, excess: 0, 'wrong-type': 0, concession: 0, 'no-rate': 0 }
    for (const r of scan?.results || []) for (const m of r.months) if (m.session === session) { c.months++; c[m.verdict]++ }
    return c
  }, [scan, session])

  // ── Round small differences (admin) ──────────────────────────────────────
  const candidates = useMemo(() => (scan && !scan.error ? roundingCandidates(scan.results).filter((c) => c.session === session) : []), [scan, session]);
  const [skip, setSkip] = useState(() => new Set());           // ids the admin un-ticked
  const [roundBusy, setRoundBusy] = useState(false);
  const [roundMsg, setRoundMsg] = useState('');
  const ticked = candidates.filter((c) => !skip.has(`${c.table}:${c.id}`));
  const toggle = (c) => setSkip((cur) => { const n = new Set(cur); const k = `${c.table}:${c.id}`; if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const beforeCsv = () => downloadCsv(ticked.map((c) => ({ GCC: c.student.gcc_no, Student: c.student.name, Fee: c.kind === 'flat' ? 'Flat' : 'Course', Month: c.month, Year: c.year, Receipt: c.receipt, Mode: c.mode, Table: c.table, 'Row id': c.id, 'Recorded amount': c.from, 'Rounded to': c.to, Difference: c.diff })), `rounding-before-${session}.csv`);
  const applyRounding = async () => {
    if (!ticked.length) return;
    const net = ticked.reduce((t, c) => t + (c.to - c.from), 0);
    if (!window.confirm(`Round ${ticked.length} payment${ticked.length > 1 ? 's' : ''} to the standard rate (net ${net >= 0 ? '+' : '−'}₹${Math.abs(Math.round(net * 100) / 100)})?\n\nEach payment and its Accounts entry are changed and the old amount is saved in the audit log. Receipts already printed keep the old amount. For UPI / bank payments, check the money actually received first.`)) return;
    setRoundBusy(true); setRoundMsg('');
    const by = loggedInName(currentUser) || 'Admin';
    let ok = 0; const failed = [];
    for (const c of ticked) {
      try { await correctFeeCollectionAmount({ table: c.table, id: c.id, newAmount: c.to, reason: `Rounded to the standard rate (₹${c.from} → ₹${c.to})`, correctedBy: by }); ok++; }
      catch (e) { failed.push(`${c.student.name} ${c.month} ${c.year}: ${e.message || e}`); }
    }
    setRoundBusy(false);
    setRoundMsg(`${ok} payment${ok === 1 ? '' : 's'} rounded.${failed.length ? ` ${failed.length} failed — ${failed.slice(0, 3).join('; ')}` : ''}`);
    onChanged?.();
  };

  const exportCsv = () => downloadCsv(rows.flatMap(r => r.months.map(m => ({
    GCC: r.student.gcc_no, Student: r.student.name, Course: m.course, 'Hostel type': m.hostelType, Fee: m.kind === 'flat' ? 'Flat' : 'Course',
    Month: m.month, Year: m.year, Expected: m.expected, Paid: m.paid, Difference: m.diff, Result: VERDICT[m.verdict]?.[0] || m.verdict,
    'Looks like': m.detectedType || '', Notes: m.flags.map(f => FLAG[f]).join('; '),
  }))), `monthly-fee-check-${session}.csv`)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={titleStyle}>Monthly Fee Check</h2>
          <p style={subtitleStyle}>Each month a student paid, compared with the rate for their course and the hostel type they had that month.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Session" value={session} onChange={e => setSession(e.target.value)} style={input}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <input aria-label="Search student" placeholder="Search name / GCC / course" value={q} onChange={e => setQ(e.target.value)} style={{ ...input, width: 190 }} />
          <button type="button" style={pill(only === 'problems')} onClick={() => setOnly('problems')}>Problems</button>
          <button type="button" style={pill(only === 'all')} onClick={() => setOnly('all')}>All students</button>
          <button type="button" style={btn} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
        </div>
      </div>

      {!scan && <div style={{ ...card, color: '#64748b' }}>Checking payments…</div>}
      {scan?.error && <div style={{ ...card, color: '#b42318' }} role="alert">Could not run the check: {scan.error}</div>}

      {scan && !scan.error && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {['ok', 'short', 'excess', 'wrong-type', 'concession', 'no-rate'].map(v => (
              <span key={v} style={{ ...card, padding: '8px 12px', display: 'inline-flex', gap: 8, alignItems: 'center' }}><Pill v={v} /><b>{counts[v]}</b></span>
            ))}
            <span style={{ ...card, padding: '8px 12px', color: '#64748b' }}>{counts.months} month payments checked</span>
          </div>

          {isAdmin && (candidates.length > 0 || roundMsg) ? (
            <div style={{ ...card, marginBottom: 12, border: '1.5px solid #b8923a' }}>
              {candidates.length > 0 ? (
                <>
                  <b>{candidates.length} payment{candidates.length > 1 ? 's are' : ' is'} only a few rupees off the standard rate</b>
                  <div style={{ fontSize: 12.5, color: '#64748b', margin: '2px 0 8px' }}>One payment in the month, ₹10 or less short or over, no concession, not an online payment. Rounding sets the payment to the standard rate, updates its Accounts entry and saves the old amount in the audit log. Untick any you want to leave.</div>
                  <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['', 'Student', 'Month', 'Fee', 'Receipt', 'Mode', 'Recorded', 'Rounded to'].map((h) => <th key={h} style={{ ...head, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>{candidates.map((c) => (
                        <tr key={`${c.table}:${c.id}`}>
                          <td style={cell}><input type="checkbox" aria-label={`Round ${c.student.name} ${c.month}`} checked={!skip.has(`${c.table}:${c.id}`)} onChange={() => toggle(c)} /></td>
                          <td style={cell}>{c.student.name} <span style={{ color: '#94a3b8' }}>GCC {c.student.gcc_no}</span></td>
                          <td style={cell}>{c.month} {c.year}</td><td style={cell}>{c.kind === 'flat' ? 'Flat' : 'Course'}</td>
                          <td style={cell}>{c.receipt || '—'}</td><td style={cell}>{c.mode || '—'}</td>
                          <td style={cell}>{inr(c.from)}</td><td style={{ ...cell, fontWeight: 700 }}>{inr(c.to)} <span style={{ color: c.diff < 0 ? '#b42318' : '#9a5b00', fontWeight: 600 }}>({c.diff > 0 ? '+' : ''}{c.diff})</span></td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={btn} onClick={beforeCsv} disabled={!ticked.length}>Download before-values (CSV)</button>
                    <button type="button" style={{ ...btn, background: '#132a4f', color: '#fff' }} onClick={applyRounding} disabled={!ticked.length || roundBusy}>{roundBusy ? 'Rounding…' : `Round ${ticked.length} payment${ticked.length === 1 ? '' : 's'}`}</button>
                  </div>
                </>
              ) : null}
              {roundMsg ? <div style={{ marginTop: 8, fontSize: 12.5, color: '#146c3a' }} role="status">{roundMsg}</div> : null}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div style={{ ...card, color: '#146c3a' }}>{only === 'problems' ? 'No mismatched months found for this session.' : 'No payments found for this session.'}</div>
          ) : rows.map(r => {
            const k = r.student.gcc_no, isOpen = open === k
            return (
              <div key={k} style={{ ...card, marginBottom: 10, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap' }}
                  role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : k) } }}>
                  <div>
                    <b>{r.student.name}</b> <span style={{ color: '#64748b', fontSize: 12 }}>GCC {r.student.gcc_no} · {r.student.course || 'No course'} · {r.student.hostel_type || 'Day Scholar'}</span>
                    <span onClick={e => e.stopPropagation()}><StudentJump student={r.student} onCollect={onCollect} onLedger={onLedger} /></span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: r.problems.length ? '#b42318' : '#146c3a' }}>
                    {r.problems.length ? `${r.problems.length} of ${r.months.length} months to check` : `${r.months.length} months OK`} {isOpen ? '▾' : '▸'}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Month', 'Fee', 'Hostel type', 'Expected', 'Paid', 'Difference', 'Result', 'Notes'].map(h => <th key={h} style={{ ...head, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {r.months.map((m, i) => (
                          <tr key={i}>
                            <td style={cell}>{m.month} {m.year}</td>
                            <td style={cell}>{m.kind === 'flat' ? 'Flat' : 'Course'}</td>
                            <td style={cell}>{m.hostelType}</td>
                            <td style={cell}>{m.expected ? inr(m.expected) : '—'}</td>
                            <td style={cell}>{inr(m.paid)}</td>
                            <td style={{ ...cell, color: m.diff < 0 ? '#b42318' : m.diff > 0 ? '#9a5b00' : undefined }}>{m.expected ? (m.diff > 0 ? '+' : '') + inr(m.diff) : '—'}</td>
                            <td style={cell}><Pill v={m.verdict} />{m.detectedType && <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>looks like {m.detectedType}</span>}</td>
                            <td style={{ ...cell, whiteSpace: 'normal', color: '#64748b' }}>{m.flags.map(f => FLAG[f]).join('; ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

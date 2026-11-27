// FeeCourseLedger.jsx — the Course-wise Fee Ledger: one card per course
// (students, billed, collected, due) and the student-wise ledger for the
// chosen course — or every course, grouped — with an advanced filter:
// session, course, batch, hostel, month, payment status, active/inactive and a
// search that also finds a receipt number. Same model as the Monthly Fee
// Ledger (feeLedgerBulk.js), so the numbers agree with every student's register.
import { useEffect, useMemo, useState } from 'react'
import { getSessionYear, MONTHS_LIST, feeMonthYearForSession } from './feeEngine'
import { loadAllFeeRows, buildAllLedgers } from './feeLedgerBulk'
import { fmt, shortSession } from './feeLedgerModel'
import { printCourseLedger, exportCourseLedgerExcel } from './feeBooks'
import { BOOKS_CSS } from './feeBooksCss'
import { LedgerLink } from './LedgerLinks'
import { ledgerCourse, ledgerBatch, ledgerFigures, statusMatches, matchesSearch, courseTotals, sumFigures, STATUS_LABEL } from './lib/courseLedger'

const uniq = xs => [...new Set(xs.filter(Boolean))].sort()
const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
const STATUS_CELL = { paid: 'paid', partial: 'short', due: 'due', na: 'upcoming' }
const rate = t => t.billed ? Math.round((t.paid / t.billed) * 100) : 100

const CSS = `
.fcl-courses{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px}
.fcl-course{text-align:left;font:inherit;cursor:pointer;background:linear-gradient(160deg,#fff,#f7f9fd);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:#1f2a44;transition:box-shadow .15s,border-color .15s}
.fcl-course:hover{box-shadow:0 10px 24px -18px rgba(20,40,90,.5)}
.fcl-course.on{background:linear-gradient(160deg,#132B52,#0B1E3D);border-color:#0B1E3D;color:#fff}
.fcl-course h5{margin:0;font-family:'Playfair Display',Georgia,serif;font-size:16px;display:flex;justify-content:space-between;gap:8px}
.fcl-course h5 small{font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:11px;font-weight:800;opacity:.7}
.fcl-course dl{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin:8px 0 6px}
.fcl-course dt{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.65}
.fcl-course dd{margin:0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;font-weight:700}
.fcl-course.on dd.ok{color:#9be3b4}.fcl-course.on dd.bad{color:#ffb4ab}
.fcl-course i{display:block;height:5px;border-radius:9px;background:#eef1f6;overflow:hidden}
.fcl-course.on i{background:rgba(255,255,255,.18)}
.fcl-course i>em{display:block;height:100%;background:linear-gradient(90deg,#146c3a,#3fae6a)}
.fcl-course.on i>em{background:linear-gradient(90deg,#C9A24B,#E2C57E)}
.fcl-course p{margin:5px 0 0;font-size:11px;opacity:.75}
.fcl-grp td{background:#f7f4ea;font-weight:800;color:#0B1E3D;border-top:1.5px solid #e6dcc3}
.fcl-adv{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px}
.fcl-adv h4{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.fcl-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:#fbf3e0;color:#7a5a14;font-size:10.5px;letter-spacing:0}
`

export default function FeeCourseLedger({ students }) {
  const current = getSessionYear()
  const sessions = useMemo(() => { const y = Number(current.slice(0, 4)); return [0, 1, 2].map(k => `${y - k}-${y - k + 1}`) }, [current])
  const [session, setSession] = useState(current)
  const [rows, setRows] = useState(null)
  const [built, setBuilt] = useState({ key: null, items: [] })
  const [progress, setProgress] = useState('Loading fee records…')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const DEFAULTS = { course: 'All', batch: 'All', hostel: 'All', month: '', status: 'all', who: 'active', q: '', sort: 'name' }
  const [f, setF] = useState(DEFAULTS)
  const set = (k, v) => setF(p => ({ ...p, [k]: v, ...(k === 'course' ? { batch: 'All' } : {}) }))
  const activeFilters = Object.keys(DEFAULTS).filter(k => k !== 'sort' && f[k] !== DEFAULTS[k]).length

  const pool = useMemo(() => (students || []).filter(s => !s.deleted_at && s.gcc_no), [students])

  useEffect(() => {
    let live = true
    loadAllFeeRows().then(r => { if (live) { setRows(r); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [reload])

  const key = rows ? `${session}|${reload}|${pool.length}` : null
  useEffect(() => {
    if (!rows) return
    let live = true
    buildAllLedgers(pool, session, { rows, onProgress: m => live && setProgress(m) })
      .then(items => { if (live) setBuilt({ key: `${session}|${reload}|${pool.length}`, items }) })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [rows, pool, session, reload])
  const ready = built.key === key

  const months = useMemo(() => MONTHS_LIST.map((m, i) => [String(i), `${m} ${feeMonthYearForSession(m, session)}`]), [session])
  const monthIdx = f.month === '' ? null : Number(f.month)
  const period = monthIdx === null ? 'Whole session' : months[monthIdx][1]

  const courses = useMemo(() => uniq(pool.map(ledgerCourse)), [pool])
  const batches = useMemo(() => uniq(pool.filter(s => f.course === 'All' || ledgerCourse(s) === f.course).map(ledgerBatch)), [pool, f.course])
  const hostels = useMemo(() => uniq(pool.map(s => s.hostel_type)), [pool])

  // Every filter except course: feeds the course cards, so each card shows its own course under the same filter.
  const scoped = useMemo(() => (ready ? built.items : [])
    .filter(x => { const s = x.student; return (f.who === 'all' || isActive(s)) && (f.batch === 'All' || ledgerBatch(s) === f.batch) && (f.hostel === 'All' || s.hostel_type === f.hostel) && matchesSearch(x, f.q) })
    .map(x => ({ x, f: ledgerFigures(x, monthIdx) }))
    .filter(r => statusMatches(r.f.status, f.status)), [built, ready, f.who, f.batch, f.hostel, f.q, f.status, monthIdx])

  const cards = useMemo(() => courseTotals(scoped), [scoped])
  const groups = useMemo(() => {
    const by = { name: (a, b) => String(a.x.student.name || '').localeCompare(String(b.x.student.name || '')), gcc: (a, b) => (Number(a.x.student.gcc_no) || 0) - (Number(b.x.student.gcc_no) || 0), due: (a, b) => b.f.due - a.f.due, paid: (a, b) => b.f.paid - a.f.paid }
    return cards.filter(c => f.course === 'All' || c.course === f.course).map(c => {
      const list = scoped.filter(r => ledgerCourse(r.x.student) === c.course).sort(by[f.sort])
      return { course: c.course, rows: list, total: sumFigures(list) }
    })
  }, [cards, scoped, f.course, f.sort])
  const shown = useMemo(() => groups.flatMap(g => g.rows), [groups])
  const tot = sumFigures(shown)
  const all = sumFigures(scoped)

  const scope = [f.course !== 'All' && f.course, f.batch !== 'All' && f.batch, f.hostel !== 'All' && f.hostel, f.status !== 'all' && (f.status === 'owing' ? 'With dues' : STATUS_LABEL[f.status]), f.who === 'all' && 'incl. inactive', f.q.trim() && `“${f.q.trim()}”`].filter(Boolean).join(' · ')
  const sel = (label, k, opts) => (
    <label className="fbk-lbl">{label}<select className="fbk-in" value={f[k]} onChange={e => set(k, e.target.value)}>{opts.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select></label>
  )

  return (
    <div className="fbk">
      <style>{BOOKS_CSS + CSS}</style>
      <div className="fbk-card">
        <div className="fcl-adv">
          <h4>🔎 Advanced filter{activeFilters > 0 && <span className="fcl-badge">{activeFilters} on</span>}</h4>
          <div className="fbk-bar">
            {activeFilters > 0 && <button className="fbk-chip" onClick={() => setF(p => ({ ...DEFAULTS, sort: p.sort }))}>✕ Clear filters</button>}
            <button className="fbk-chip gold" disabled={!ready || !shown.length} onClick={() => printCourseLedger(groups, session, { period, scope })}>🖨️ Print</button>
            <button className="fbk-chip gold" disabled={!ready || !shown.length} onClick={() => exportCourseLedgerExcel(groups, session, period)}>📊 Excel</button>
            <button className="fbk-chip" onClick={() => { setRows(null); setReload(n => n + 1) }}>↻ Refresh</button>
          </div>
        </div>
        <div className="fbk-bar" style={{ alignItems: 'flex-end' }}>
          <label className="fbk-lbl">Session<select className="fbk-in" value={session} onChange={e => setSession(e.target.value)}>{sessions.map(s => <option key={s} value={s}>{shortSession(s)}</option>)}</select></label>
          {sel('Course', 'course', [['All', 'All courses'], ...courses])}
          {sel('Batch', 'batch', [['All', 'All batches'], ...batches])}
          {sel('Hostel', 'hostel', [['All', 'All'], ...hostels])}
          {sel('Month', 'month', [['', 'Whole session'], ...months])}
          {sel('Payment status', 'status', [['all', 'Everyone'], ['paid', 'Fully paid'], ['partial', 'Partly paid'], ['due', 'Unpaid (nothing paid)'], ['owing', 'With dues (partly + unpaid)']])}
          {sel('Students', 'who', [['active', 'Active only'], ['all', 'All (incl. inactive)']])}
          {sel('Sort', 'sort', [['name', 'Name'], ['gcc', 'GCC no.'], ['due', 'Highest due'], ['paid', 'Highest paid']])}
          <label className="fbk-lbl" style={{ flex: '1 1 200px' }}>Search<input className="fbk-in" placeholder="Name, GCC, adm. no, receipt no…" value={f.q} onChange={e => set('q', e.target.value)} aria-label="Search course-wise ledger" /></label>
        </div>
      </div>

      {error && <div className="fbk-card" style={{ color: '#b42318' }}>{error}</div>}
      {!ready && !error && <div className="fbk-card fbk-empty">{progress}</div>}
      {ready && (
        <>
          <div className="fcl-courses" role="tablist" aria-label="Courses">
            {[{ course: 'All', students: scoped.length, ...all }, ...cards].map(c => (
              <button key={c.course} role="tab" aria-selected={f.course === c.course} className={`fcl-course${f.course === c.course ? ' on' : ''}`} onClick={() => set('course', c.course)}>
                <h5>{c.course === 'All' ? 'All courses' : c.course}<small>{c.students} 🎓</small></h5>
                <dl>
                  <div><dt>Billed</dt><dd>₹{fmt(c.billed)}</dd></div>
                  <div><dt>Paid</dt><dd className="ok" style={{ color: f.course === c.course ? undefined : '#146c3a' }}>₹{fmt(c.paid)}</dd></div>
                  <div><dt>Due</dt><dd className="bad" style={{ color: f.course === c.course ? undefined : (c.due ? '#b42318' : '#146c3a') }}>₹{fmt(c.due)}</dd></div>
                </dl>
                <i><em style={{ width: `${rate(c)}%` }} /></i>
                <p>{rate(c)}% collected · {c.withDues} with dues</p>
              </button>
            ))}
          </div>

          <div className="fbk-kpis">
            <div className="fbk-kpi"><b>Students</b><span>{shown.length}</span><small>{scope || 'all courses'} · {shortSession(session)}</small></div>
            <div className="fbk-kpi"><b>Billed</b><span>₹{fmt(tot.billed)}</span><small>{period}{monthIdx === null ? ' · to date' : ''}</small></div>
            <div className="fbk-kpi"><b>Collected</b><span style={{ color: '#146c3a' }}>₹{fmt(tot.paid)}</span><small>{rate(tot)}% of billed</small></div>
            {tot.concession > 0 && <div className="fbk-kpi"><b>Concession</b><span style={{ color: '#7c3aed' }}>₹{fmt(tot.concession)}</span><small>{tot.withConcession} student{tot.withConcession === 1 ? '' : 's'} · not in billed</small></div>}
            <div className="fbk-kpi"><b>Outstanding</b><span style={{ color: tot.due ? '#b42318' : '#146c3a' }}>₹{fmt(tot.due)}</span><small>{tot.withDues} student{tot.withDues === 1 ? '' : 's'} with dues</small></div>
          </div>

          <div className="fbk-card" style={{ padding: 0 }}>
            <div className="fbk-scroll" style={{ border: 'none', maxHeight: '68vh' }}>
              <table aria-label="Course-wise fee ledger">
                <thead><tr>
                  <th>#</th><th>Student</th><th>Batch</th><th>Hostel</th>
                  <th className="num">Billed</th><th className="num" title="Approved concession / special fee — not included in Billed">Concession</th><th className="num">Paid</th><th className="num">Due</th><th>Status</th><th>Due for</th>
                </tr></thead>
                <tbody>
                  {shown.length === 0 && <tr><td className="fbk-empty" colSpan={10}>No students match these filters.</td></tr>}
                  {groups.map(g => [
                    (f.course === 'All' || groups.length > 1) && (
                      <tr key={`g-${g.course}`} className="fcl-grp">
                        <td colSpan={4}>{g.course} · {g.rows.length} student{g.rows.length === 1 ? '' : 's'}</td>
                        <td className="num">{fmt(g.total.billed)}</td><td className="num" style={{ color: '#7c3aed' }}>{g.total.concession ? fmt(g.total.concession) : '—'}</td><td className="num" style={{ color: '#146c3a' }}>{fmt(g.total.paid)}</td>
                        <td className="num" style={{ color: g.total.due ? '#b42318' : '#146c3a' }}>{fmt(g.total.due)}</td><td colSpan={2}>{rate(g.total)}% collected</td>
                      </tr>
                    ),
                    ...g.rows.map(({ x, f: v }, i) => (
                      <tr key={x.student.gcc_no}>
                        <td className="muted">{i + 1}</td>
                        <td><LedgerLink gcc={x.student.gcc_no} style={{ fontWeight: 700 }}>{x.student.name}</LedgerLink><div className="muted" style={{ fontSize: 11 }}>GCC-{x.student.gcc_no}{x.student.admission_no ? ` · Adm ${x.student.admission_no}` : ''}</div></td>
                        <td>{x.student.batch || '—'}</td>
                        <td>{x.student.hostel_type || '—'}</td>
                        <td className="num">{fmt(v.billed)}</td>
                        <td className="num" style={{ color: '#7c3aed' }}>{v.concession ? fmt(v.concession) : <span className="muted">—</span>}</td>
                        <td className="num" style={{ color: '#146c3a', fontWeight: 700 }}>{fmt(v.paid)}</td>
                        <td className="num" style={{ color: v.due ? '#b42318' : '#146c3a', fontWeight: 800 }}>{fmt(v.due)}</td>
                        <td><span className={`fbk-cell ${STATUS_CELL[v.status]}`}>{STATUS_LABEL[v.status]}</span></td>
                        <td className="muted" style={{ fontSize: 11.5 }}>{v.dueMonths.join(', ') || '—'}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
                {shown.length > 0 && (
                  <tfoot><tr>
                    <td colSpan={4}>Total — {shown.length} student{shown.length === 1 ? '' : 's'}</td>
                    <td className="num">{fmt(tot.billed)}</td><td className="num" style={{ color: '#7c3aed' }}>{tot.concession ? fmt(tot.concession) : '—'}</td><td className="num" style={{ color: '#146c3a' }}>{fmt(tot.paid)}</td>
                    <td className="num" style={{ color: '#b42318' }}>{fmt(tot.due)}</td><td colSpan={2} />
                  </tr></tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="fbk-legend">
            <span>Billed = fee charged to date (whole session incl. dues brought forward from earlier sessions), or the chosen month’s fee, after any approved concession; the concession itself is shown in its own column. Click a name to open the student’s ledger.</span>
          </div>
        </>
      )}
    </div>
  )
}

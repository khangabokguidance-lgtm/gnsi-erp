// PrintAllLedgers.jsx — dialog for "Print all ledgers": pick the session and
// which students, then print every register as one document (summary page +
// one page per student). The work is done in feeLedgerBulk.js.
import { useMemo, useState } from 'react'
import { getSessionYear, sessionStartYear } from './feeEngine'
import { buildAllLedgers, printLedgerBook } from './feeLedgerBulk'

const isActive = s => !s.deleted_at && (!s.status || s.status === 'Active')
const lbl = { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b7690', display: 'block', marginBottom: 5 }
const sel = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #d9d2c2', fontSize: 13.5, fontFamily: 'inherit', background: '#fff' }
const chk = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: '#2e3b52', cursor: 'pointer' }

export default function PrintAllLedgers({ students, onClose }) {
  const cur = getSessionYear(), st = sessionStartYear(cur)
  const sessions = [cur, `${st - 1}-${st}`, `${st - 2}-${st - 1}`]
  const [session, setSession] = useState(cur)
  const [course, setCourse] = useState('All')
  const [batch, setBatch] = useState('All')
  const [hostel, setHostel] = useState('All')
  const [activeOnly, setActiveOnly] = useState(true)
  const [onlyDues, setOnlyDues] = useState(false)
  const [dayBook, setDayBook] = useState(true)
  const [sortBy, setSortBy] = useState('name')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const uniq = arr => [...new Set(arr.filter(Boolean))].sort()
  const pool = useMemo(() => students.filter(s => s.gcc_no && (!activeOnly || isActive(s))), [students, activeOnly])
  const courses = useMemo(() => uniq(pool.map(s => s.course)), [pool])
  const batches = useMemo(() => uniq(pool.filter(s => course === 'All' || s.course === course).map(s => s.batch)), [pool, course])
  const hostels = useMemo(() => uniq(pool.map(s => s.hostel_type)), [pool])
  const chosen = useMemo(() => pool.filter(s => (course === 'All' || s.course === course) && (batch === 'All' || s.batch === batch) && (hostel === 'All' || s.hostel_type === hostel)), [pool, course, batch, hostel])

  const run = async () => {
    if (!chosen.length) return
    setError('')
    // Opened now, while this is still a click, so pop-up blockers allow it.
    const win = window.open('', '_blank', 'width=1200,height=900')
    if (win) win.document.write('<p style="font:16px system-ui;padding:40px;color:#1d3a78">Preparing fee ledgers…</p>')
    try {
      let items = await buildAllLedgers(chosen, session, { onProgress: setBusy })
      if (onlyDues) items = items.filter(x => x.reg.totalDue > 0)
      const cmp = { name: (a, b) => String(a.student.name).localeCompare(String(b.student.name)), gcc: (a, b) => Number(a.student.gcc_no) - Number(b.student.gcc_no), due: (a, b) => b.reg.totalDue - a.reg.totalDue }[sortBy]
      items.sort(cmp)
      if (!items.length) { win?.close(); setError('No student in this selection has fees due.'); setBusy(''); return }
      const scope = [course !== 'All' && course, batch !== 'All' && batch, hostel !== 'All' && hostel].filter(Boolean).join(' · ')
      printLedgerBook(items, session, { includeDayBook: dayBook, title: `Fee Ledgers${scope ? ' — ' + scope : ''}${onlyDues ? ' (with dues)' : ''}`, win })
      setBusy('')
      onClose()
    } catch (e) {
      win?.close()
      setError(e.message || 'Could not build the ledgers.')
      setBusy('')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Print all ledgers" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,30,61,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,100%)', maxHeight: '92vh', overflowY: 'auto', background: '#fffdf6', borderRadius: 18, border: '1px solid #e6dcc3', boxShadow: '0 30px 60px -20px rgba(11,30,61,.5)', padding: '20px 22px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a7b2f' }}>Bulk print</div>
            <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 21, fontWeight: 700, color: '#1d3a78' }}>Print all fee ledgers</div>
            <div style={{ fontSize: 12.5, color: '#6b7690', marginTop: 3 }}>A summary page, then one register page per student.</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #e6dcc3', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#5d6b82' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <label><span style={lbl}>Session</span><select style={sel} value={session} onChange={e => setSession(e.target.value)}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label><span style={lbl}>Course</span><select style={sel} value={course} onChange={e => { setCourse(e.target.value); setBatch('All') }}><option>All</option>{courses.map(c => <option key={c}>{c}</option>)}</select></label>
          <label><span style={lbl}>Batch</span><select style={sel} value={batch} onChange={e => setBatch(e.target.value)}><option>All</option>{batches.map(b => <option key={b}>{b}</option>)}</select></label>
          <label><span style={lbl}>Hostel</span><select style={sel} value={hostel} onChange={e => setHostel(e.target.value)}><option>All</option>{hostels.map(h => <option key={h}>{h}</option>)}</select></label>
          <label><span style={lbl}>Order</span><select style={sel} value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="name">By name</option><option value="gcc">By GCC no.</option><option value="due">Highest due first</option></select></label>
        </div>
        <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
          <label style={chk}><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active students only</label>
          <label style={chk}><input type="checkbox" checked={onlyDues} onChange={e => setOnlyDues(e.target.checked)} /> Only students with fees due</label>
          <label style={chk}><input type="checkbox" checked={dayBook} onChange={e => setDayBook(e.target.checked)} /> Include each student's day book</label>
        </div>

        {error && <div role="alert" style={{ marginTop: 12, padding: '9px 12px', borderRadius: 10, background: '#fdecea', color: '#b42318', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#2e3b52' }}><b style={{ fontSize: 18, color: '#1d3a78' }}>{chosen.length}</b> student{chosen.length === 1 ? '' : 's'} selected{onlyDues ? ' (those with dues will print)' : ''}</div>
          <button onClick={run} disabled={!chosen.length || !!busy}
            style={{ padding: '11px 22px', borderRadius: 999, border: 'none', cursor: chosen.length && !busy ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', background: chosen.length && !busy ? 'linear-gradient(180deg,#1e3a6e,#132a4f)' : '#d9d2c2', color: '#fff' }}>
            {busy || `🖨️ Print ${chosen.length} ledger${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

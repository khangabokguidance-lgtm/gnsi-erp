// CbtPracticeLog.jsx — staff: who practised the mock / past-exam tests (by GCC no.), and how many of the tries each used.
import { useEffect, useMemo, useState } from 'react'
import { listMockPractice, resetMockPractice, nameMap } from './cbtRemote'
import { summarisePractice, PRACTICE_TRIES } from './lib/cbtMockStats'

const stamp = v => { try { return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function CbtPracticeLog({ canEdit, flash }) {
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const load = async () => {
    try { setRows(await listMockPractice()); setErr(''); nameMap().then(setNames).catch(() => {}) }
    catch (e) { setErr(e.message || 'Could not load.'); setRows([]) }
  }
  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => summarisePractice(rows), [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? list.filter(r => r.gcc.includes(t) || r.slug.includes(t) || (names[r.gcc]?.name || '').toLowerCase().includes(t)) : list
  }, [list, q, names])
  const students = new Set(list.map(r => r.gcc)).size
  const csv = () => {
    const out = [['GCC no', 'Name', 'Class', 'Test', 'Tries', 'Last try'], ...shown.map(r => [r.gcc, names[r.gcc]?.name || '', names[r.gcc]?.batch || '', r.slug, r.tries, r.last])].map(r => r.map(csvCell).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = 'practice-by-gcc.csv'; a.click()
  }
  const reset = async r => {
    if (!window.confirm(`Give GCC ${r.gcc} a fresh ${PRACTICE_TRIES} tries for “${r.slug}”? This clears their ${r.tries} recorded tr${r.tries === 1 ? 'y' : 'ies'} for this test.`)) return
    try { await resetMockPractice(r.gcc, r.slug); await load(); flash && flash('Tries cleared.') } catch (e) { flash && flash(e.message) }
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ margin: '0 0 4px' }}>👤 Who practised (by GCC no.)</h3>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Mock tests and past-exam practice. Each GCC may start a test {PRACTICE_TRIES} times. {rows ? `${students} student${students === 1 ? '' : 's'} · ${rows.length} start${rows.length === 1 ? '' : 's'}.` : ''}</div>
      {err && <div role="alert" style={{ color: '#9a3412', marginBottom: 8 }}>{err} {/relation|does not exist|schema cache|missing/i.test(err) ? '(Run supabase/RUN_cbt_mock_practice_gcc.sql once.)' : ''}</div>}
      {!rows ? <div className="muted">Loading…</div> : !list.length ? <div className="muted">No practice recorded yet.</div> : <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input className="in" style={{ maxWidth: 260 }} placeholder="Search GCC, name or test" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
          <button className="btn" onClick={csv}>⬇ CSV</button>
          <button className="btn" onClick={load}>↻ Refresh</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 13.5 }}>
            <thead><tr><th>GCC</th><th>Name</th><th>Test</th><th>Tries</th><th>Last</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {shown.slice(0, 300).map(r => (
                <tr key={r.gcc + r.slug}>
                  <td>{r.gcc}</td>
                  <td>{names[r.gcc] ? <>{names[r.gcc].name}<span className="muted"> {names[r.gcc].batch}</span></> : <span className="muted">—</span>}</td>
                  <td>{r.slug}</td>
                  <td><b style={{ color: r.tries >= PRACTICE_TRIES ? '#b42318' : undefined }}>{r.tries}/{PRACTICE_TRIES}</b></td>
                  <td>{stamp(r.last)}</td>
                  {canEdit && <td><button className="btn" onClick={() => reset(r)}>Reset</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 300 && <div className="muted" style={{ marginTop: 6 }}>Showing the latest 300 of {shown.length}. Use search or the CSV for the rest.</div>}
      </>}
    </div>
  )
}

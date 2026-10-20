// FeeLateEntries.jsx — students who joined after the session began, and whether
// their fee payments have started. Uses the rows Fees.jsx already loaded.
import { useMemo, useState } from 'react'
import { getSessionYear } from './feeEngine'
import { detectLateEntryStudents } from './lib/lateEntry'

const inr = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtD = d => d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function FeeLateEntries({ students = [], adm_flat_fees = [], adm_course_fees = [], onCollect, onLedger }) {
  const session = getSessionYear()
  const [filter, setFilter] = useState('notStarted')   // notStarted | skipped | all
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const active = students.filter(s => !s.status || s.status === 'Active')
    const byGcc = new Map(active.map(s => [String(parseInt(s.gcc_no) || 0), s]))
    return detectLateEntryStudents(active, adm_course_fees, adm_flat_fees, session).map(r => ({ ...r, student: byGcc.get(String(parseInt(r.gcc_no) || 0)) }))
  }, [students, adm_flat_fees, adm_course_fees, session])

  const shown = rows.filter(r => (filter === 'all' || (filter === 'notStarted' ? !r.started : r.skippedJoiningMonth))
    && (!q.trim() || `${r.name} ${r.gcc_no}`.toLowerCase().includes(q.trim().toLowerCase())))
  const count = { notStarted: rows.filter(r => !r.started).length, skipped: rows.filter(r => r.skippedJoiningMonth).length, all: rows.length }
  const pill = (id, label) => (
    <button key={id} type="button" onClick={() => setFilter(id)}
      style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid #d9d4c5', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === id ? '#1e3a6e' : 'white', color: filter === id ? 'white' : '#334155' }}>
      {label} ({count[id]})
    </button>
  )

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Late entries — session {session}</div>
      <div style={{ fontSize: 12, opacity: .75, margin: '4px 0 12px' }}>Students admitted after April. Months before they joined are not charged; fees start from the joining month.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {pill('notStarted', 'Not started paying')}{pill('skipped', 'Joining month unpaid')}{pill('all', 'All late entries')}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC" style={{ marginLeft: 'auto', padding: '6px 10px', minWidth: 160 }} />
      </div>
      {!shown.length ? <div style={{ padding: 20, fontSize: 13 }}>No students in this view.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e0d2' }}>
              <th style={{ padding: 8 }}>Student</th><th>Admitted</th><th>Fees start</th><th>Status</th><th style={{ textAlign: 'right' }}>Paid</th><th /></tr></thead>
            <tbody>{shown.map(r => (
              <tr key={r.gcc_no} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}><b>{r.name}</b><div style={{ fontSize: 11, opacity: .7 }}>GCC-{r.gcc_no}{r.student?.course ? ` · ${r.student.course}` : ''}{r.student?.batch ? ` · ${r.student.batch}` : ''}</div></td>
                <td>{fmtD(r.admission_date)}</td>
                <td>{r.firstFeeMonth}<div style={{ fontSize: 11, opacity: .7 }}>{r.monthsNotCharged.length} month{r.monthsNotCharged.length === 1 ? '' : 's'} not charged</div></td>
                <td>{!r.started ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>Not started</span>
                  : r.skippedJoiningMonth ? <span style={{ color: '#b45309', fontWeight: 700 }}>Started {r.firstPaidMonth} — joining month unpaid</span>
                  : <span style={{ color: '#146c3a', fontWeight: 700 }}>Started {r.firstPaidMonth}</span>}</td>
                <td style={{ textAlign: 'right' }}>{inr(r.totalPaid)}</td>
                <td style={{ textAlign: 'right' }}>{r.student && onLedger && <button type="button" onClick={() => onLedger(r.student)} style={{ padding: '6px 12px', fontWeight: 700, cursor: 'pointer', marginRight: 6 }}>Ledger</button>}{r.student && onCollect && <button type="button" onClick={() => onCollect(r.student)} style={{ padding: '6px 12px', fontWeight: 700, cursor: 'pointer' }}>Collect</button>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

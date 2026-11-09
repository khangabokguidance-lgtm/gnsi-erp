// FeeLateEntries.jsx — students who joined after the session began, and whether
// their fee payments have started. Uses the rows Fees.jsx already loaded.
import { useMemo, useState } from 'react'
import { getSessionYear } from './feeEngine'
import { detectLateEntryStudents } from './lib/lateEntry'
import FeeTabShell from './FeeTabShell'
import { input, btn, btnPrimary, cardFlush, head, td, pill } from './feeTheme'

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
  const pillBtn = (id, label) => <button key={id} type="button" onClick={() => setFilter(id)} style={pill(filter === id)}>{label} ({count[id]})</button>

  return (
    <FeeTabShell title="Late entries" subtitle={`Session ${session} — students admitted after April. Months before they joined are not charged; fees start from the joining month.`}
      stats={[{ label: 'Late entries', value: count.all }, { label: 'Not started paying', value: count.notStarted, tone: count.notStarted ? 'bad' : 'ok' }, { label: 'Joining month unpaid', value: count.skipped, tone: count.skipped ? 'warn' : 'ok' }]}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {pillBtn('notStarted', 'Not started paying')}{pillBtn('skipped', 'Joining month unpaid')}{pillBtn('all', 'All late entries')}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC" style={{ ...input, marginLeft: 'auto', minWidth: 170 }} />
      </div>
      <div style={cardFlush}>
        {!shown.length ? <div style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>No students in this view.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Student', 'Admitted', 'Fees start', 'Status', 'Paid', ''].map((h, i) => <th key={i} style={{ ...head, textAlign: h === 'Paid' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{shown.map(r => (
                <tr key={r.gcc_no}>
                  <td style={td}><b>{r.name}</b><div style={{ fontSize: 11, opacity: .7 }}>GCC-{r.gcc_no}{r.student?.course ? ` · ${r.student.course}` : ''}{r.student?.batch ? ` · ${r.student.batch}` : ''}</div></td>
                  <td style={td}>{fmtD(r.admission_date)}</td>
                  <td style={td}>{r.firstFeeMonth}<div style={{ fontSize: 11, opacity: .7 }}>{r.monthsNotCharged.length} month{r.monthsNotCharged.length === 1 ? '' : 's'} not charged</div></td>
                  <td style={td}>{!r.started ? <span style={{ color: '#9C3B3B', fontWeight: 700 }}>Not started</span>
                    : r.skippedJoiningMonth ? <span style={{ color: '#8A6A1F', fontWeight: 700 }}>Started {r.firstPaidMonth} — joining month unpaid</span>
                    : <span style={{ color: '#3D5A5B', fontWeight: 700 }}>Started {r.firstPaidMonth}</span>}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{inr(r.totalPaid)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.student && onCollect && <button type="button" onClick={() => onCollect(r.student)} style={btnPrimary}>Collect</button>}
                    {r.student && onLedger && <button type="button" onClick={() => onLedger(r.student)} style={{ ...btn, marginLeft: 6 }}>Ledger</button>}
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </FeeTabShell>
  )
}

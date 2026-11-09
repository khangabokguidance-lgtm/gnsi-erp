// StudentJump.jsx — small "Ledger" / "Collect" buttons for any row that names a student,
// so every Fees tab leads to the next action. Renders nothing without handlers or a match.
const btn = { padding: '2px 8px', borderRadius: 6, border: '1px solid #d9d4c5', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#1e3a6e' }

export default function StudentJump({ gcc, student, students = [], onCollect, onLedger }) {
  const s = student || students.find(x => String(parseInt(x.gcc_no) || 0) === String(parseInt(gcc) || 0))
  if (!s || (!onCollect && !onLedger)) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
      {onLedger && <button type="button" style={btn} title="Open this student's fee ledger" onClick={() => onLedger(s)}>Ledger</button>}
      {onCollect && <button type="button" style={btn} title="Collect fee for this student" onClick={() => onCollect(s)}>Collect</button>}
    </span>
  )
}

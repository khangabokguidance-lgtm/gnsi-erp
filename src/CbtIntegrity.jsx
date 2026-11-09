// CbtIntegrity.jsx — "Integrity report" card in Results: candidates and pairs that look suspicious.
// These are indicators to review, never proof (a shared school network or a lucky run can trigger them).
import { useState } from 'react'

const TONE = { high: ['#fde8e6', '#b42318', 'High'], medium: ['#fff4dc', '#9a5b00', 'Medium'], low: ['#e7f6ec', '#146c3a', 'Low'] }
export const RiskTag = ({ level }) => <span className="tag" style={{ background: TONE[level][0], color: TONE[level][1] }}>{TONE[level][2]}</span>

export default function CbtIntegrity({ report }) {
  const [open, setOpen] = useState(false)
  const flagged = report.entries.filter(e => e.level !== 'low').sort((a, b) => b.points - a.points)
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>🕵 Integrity report</h3>
        <span className="muted">{flagged.length ? `${flagged.length} candidate${flagged.length === 1 ? '' : 's'} to review · ${report.pairs.length} similar pair${report.pairs.length === 1 ? '' : 's'}` : 'Nothing unusual found'}
          {' '}<button className="btn" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'}</button></span>
      </div>
      {open && <>
        <p className="muted" style={{ margin: '8px 0' }}>Indicators only — review each case before acting. Signals: leaving the screen, camera / shield flags, another device taking over, network changes or sharing, a GCC no. that does not match the name, very fast high scores, and candidates with the same <b>wrong</b> answers.</p>
        {flagged.length === 0 ? <p>No candidate reached the review level.</p> : (
          <div className="tbl"><table>
            <thead><tr><th>Risk</th><th>Candidate</th><th>Marks</th><th>Why</th></tr></thead>
            <tbody>{flagged.map(e => <tr key={e.row.attempt.id}>
              <td><RiskTag level={e.level} /> <span className="muted">{e.points}</span></td>
              <td><b>{e.row.attempt.candidate.name}</b><br /><span className="muted">{e.row.attempt.candidate.roll}</span></td>
              <td>{e.row.g.marks} / {e.row.g.max}</td>
              <td><ul style={{ margin: 0, paddingLeft: 16 }}>{e.reasons.map(r => <li key={r}>{r}</li>)}</ul></td>
            </tr>)}</tbody>
          </table></div>
        )}
        {report.pairs.length > 0 && <>
          <h4 style={{ margin: '14px 0 6px' }}>Similar wrong answers</h4>
          <div className="tbl"><table>
            <thead><tr><th>Candidate A</th><th>Candidate B</th><th className="num">Same wrong answers</th></tr></thead>
            <tbody>{report.pairs.slice(0, 30).map(p => <tr key={p.a.attempt.id + p.b.attempt.id}><td>{p.a.attempt.candidate.name}</td><td>{p.b.attempt.candidate.name}</td><td className="num"><b>{p.same}</b> of {p.of}</td></tr>)}</tbody>
          </table></div>
        </>}
      </>}
    </div>
  )
}

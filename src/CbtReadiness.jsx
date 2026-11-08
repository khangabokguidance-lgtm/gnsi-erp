// CbtReadiness.jsx — Online tab → "Readiness": a pre-exam checklist for one online exam.
import { useEffect, useState } from 'react'
import { fetchOnlineTest, probeSchema, loadStudentsForReadiness } from './cbtRemote'
import { readiness, summary, MANUAL_CHECKS } from './lib/cbtReadiness'

const TONE = { ok: ['✓', '#e7f6ec', '#146c3a'], warn: ['!', '#fff4dc', '#9a5b00'], bad: ['✕', '#fde8e6', '#b42318'] }

export default function CbtReadiness({ row, onClose }) {
  const [checks, setChecks] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let on = true
    Promise.all([fetchOnlineTest(row.id).catch(() => null), probeSchema(row.id), loadStudentsForReadiness()])
      .then(([test, probes, students]) => { if (on) setChecks(readiness({ row, test, probes, students })) })
      .catch(e => { if (on) setErr(e.message) })
    return () => { on = false }
  }, [row])
  const s = checks ? summary(checks) : null
  return (
    <div className="cbt-modal" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <h3>Readiness — {row.name}</h3>
        {err && <p role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</p>}
        {!checks && !err && <p className="muted">Checking…</p>}
        {checks && <>
          <p style={{ fontWeight: 800, color: s.bad ? '#b42318' : s.warn ? '#9a5b00' : '#146c3a', margin: '4px 0 10px' }}>
            {s.bad ? `${s.bad} problem${s.bad === 1 ? '' : 's'} to fix before the exam` : s.warn ? 'Ready, with a few things to look at' : 'Ready'}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {checks.map(c => { const [icon, bg, fg] = TONE[c.status]; return (
              <div key={c.id} style={{ display: 'flex', gap: 10, background: bg, borderRadius: 10, padding: '8px 12px' }}>
                <b style={{ color: fg, width: 18 }}>{icon}</b>
                <div><b style={{ color: fg }}>{c.label}</b>{c.detail && <div style={{ fontSize: 12.5, color: '#334155', marginTop: 2 }}>{c.detail}</div>}</div>
              </div>) })}
          </div>
          <h4 style={{ margin: '14px 0 6px' }}>Confirm yourself</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{MANUAL_CHECKS.map(m => <li key={m}>{m}</li>)}</ul>
        </>}
        <div style={{ textAlign: 'right', marginTop: 14 }}><button className="btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

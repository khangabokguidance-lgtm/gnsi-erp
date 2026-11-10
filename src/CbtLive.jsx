// CbtLive.jsx — staff Live view of an online exam: who is inside, who dropped off, who finished, with a one-click
// +5 / +10 minutes or reset for one candidate. Refreshes every 15 s. Extra time needs 20261062_cbt_time_extension.sql.
import { useCallback, useEffect, useState } from 'react'
import { onlineAttempts, extendOnlineAttempt, deleteOnlineAttempt, fetchOnlineTest } from './cbtRemote'
import { liveState, liveCounts } from './lib/cbtLive'
import { flagTotal, flagText } from './lib/cbtProctorLogic'
import { clock } from './lib/cbtEngine'

const KIND = { live: ['In exam', '#e7f6ec', '#146c3a'], dropped: ['Dropped off', '#fde8e6', '#b42318'], done: ['Submitted', '#eef2f9', '#1e3a6e'], timeup: ['Time up', '#f1f5f9', '#64748b'] }
const ago = s => (s == null ? '—' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`)

export default function CbtLive({ online, canEdit, flash, initialId = '' }) {
  const [id, setId] = useState(initialId || online?.find(o => o.status === 'live')?.id || online?.[0]?.id || '')
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')
  const [full, setFull] = useState(null)               // the test's sections (for the question total)
  const test = online?.find(o => o.id === id)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new exam clears the previous exam's question total before loading its own
  useEffect(() => { let on = true; setFull(null); if (id) fetchOnlineTest(id).then(t => { if (on) setFull(t) }).catch(() => {}); return () => { on = false } }, [id])
  const shape = { durationMin: Number(test?.duration_min) || 0, sections: full?.sections || [] }

  const testName = test?.name || ''
  const load = useCallback(async () => {
    if (!id) return
    try { setRows(await onlineAttempts(id, testName)); setErr(''); setNow(Date.now()) } catch (e) { setErr(e.message) }
  }, [id, testName])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- switching exam clears the old list, then loads the new one
  useEffect(() => { setRows(null); load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  if (!online?.length) return <div className="card"><h3>Nothing online yet</h3><p className="muted">Publish a test from the Tests tab first.</p></div>
  const states = (rows || []).map(a => ({ a, s: liveState(a, shape, now) }))
  const c = liveCounts(rows || [], shape, now)
  const t = q.trim().toLowerCase()
  const order = { dropped: 0, live: 1, timeup: 2, done: 3 }
  const list = states.filter(({ a }) => !t || [a.candidate.name, a.gcc, a.candidate.roll].some(v => String(v || '').toLowerCase().includes(t))).sort((x, y) => order[x.s.kind] - order[y.s.kind] || x.s.left - y.s.left)

  const act = async (key, fn, ok) => { setBusy(key); try { await fn(); await load(); flash(ok) } catch (e) { flash(e.message) } setBusy('') }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label><span className="lbl">Exam</span>
            <select className="in" style={{ maxWidth: 380 }} value={id} onChange={e => setId(e.target.value)}>{online.map(o => <option key={o.id} value={o.id}>{o.name}{o.status === 'live' ? ' (live)' : ''}</option>)}</select></label>
          <label style={{ flex: '1 1 160px' }}><span className="lbl">Find a candidate</span><input className="in" value={q} onChange={e => setQ(e.target.value)} placeholder="Name or GCC no." /></label>
          <button className="btn" onClick={load}>↻ Refresh now</button>
          <span className="muted" style={{ fontSize: 12 }}>Auto-refreshes every 30 s</span>
        </div>
        {err && <p role="alert" style={{ color: '#b42318', fontWeight: 700, margin: '8px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {[['live', c.live], ['dropped', c.dropped], ['timeup', c.timeup], ['done', c.done]].map(([k, n]) => <span key={k} className="tag" style={{ background: KIND[k][1], color: KIND[k][2], fontSize: 13, padding: '4px 12px' }}>{KIND[k][0]}: <b>{n}</b></span>)}
          <span className="tag" style={{ background: '#f1f5f9', color: '#334155', fontSize: 13, padding: '4px 12px' }}>Started: <b>{rows?.length ?? 0}</b></span>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div className="tbl"><table>
          <thead><tr><th>Candidate</th><th>GCC</th><th>Status</th><th>Last seen</th><th className="num">Time left</th><th className="num">Answered</th><th>Flags</th><th>Network</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={9} className="muted">Loading…</td></tr>}
            {rows && list.length === 0 && <tr><td colSpan={9} className="muted">No one has started yet.</td></tr>}
            {list.map(({ a, s }) => {
              const [label, bg, fg] = KIND[s.kind]
              const flags = [a.takeovers ? `${a.takeovers} device switch${a.takeovers === 1 ? '' : 'es'}` : '', a.switches ? `left screen ×${a.switches}` : '', flagText(a.proctor)].filter(Boolean).join(' · ')
              return (
                <tr key={a.id}>
                  <td><b>{a.candidate.name}</b></td><td>{a.gcc || a.candidate.roll || '—'}</td>
                  <td><span className="tag" style={{ background: bg, color: fg }}>{label}</span>{a.extraSeconds ? <span className="tag" style={{ background: '#fff4dc', color: '#9a5b00', marginLeft: 4 }}>+{Math.round(a.extraSeconds / 60)} min</span> : null}</td>
                  <td>{s.kind === 'done' ? '—' : ago(s.quietSec)}</td>
                  <td className="num">{s.kind === 'done' ? '—' : clock(s.left)}</td>
                  <td className="num">{s.answered}{s.total ? ` / ${s.total}` : ''}</td>
                  <td style={{ color: flagTotal(a.proctor) || a.takeovers || a.switches ? '#b42318' : undefined, fontSize: 12 }}>{flags || '—'}</td>
                  <td style={{ fontSize: 12 }}>{a.ip || '—'}</td>
                  {canEdit && <td style={{ whiteSpace: 'nowrap' }}>
                    {s.kind !== 'done' && <>
                      <button className="btn" disabled={busy === a.id} onClick={() => act(a.id, () => extendOnlineAttempt(a.id, 300), `+5 minutes for ${a.candidate.name}.`)}>+5 min</button>{' '}
                      <button className="btn" disabled={busy === a.id} onClick={() => act(a.id, () => extendOnlineAttempt(a.id, 600), `+10 minutes for ${a.candidate.name}.`)}>+10 min</button>{' '}
                    </>}
                    <button className="btn red" disabled={busy === a.id} onClick={() => { if (window.confirm(`Reset ${a.candidate.name}? Their attempt${s.kind === 'done' ? ' and score are' : ' (answers so far) is'} deleted and they can start again from the beginning.`)) act(a.id, () => deleteOnlineAttempt(a.id), `${a.candidate.name} can start again.`) }}>Reset</button>
                  </td>}
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>“Dropped off” = no save for over 100 seconds (the exam screen saves every 30 s). They may just have lost signal — their answers are kept and they continue when it returns. “+5 / +10 min” gives that one candidate extra time (needs migration 20261062). The “Answered” column counts answers saved so far, out of the total questions.</p>
    </>
  )
}

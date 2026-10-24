// CbtOnline.jsx — the staff side of online exams: publish a test as a link, see the online tests, close or
// remove them. (Candidates use CbtPublic.jsx.)
import { useState } from 'react'
import { examLink, publishOnline, setOnline, deleteOnline, statusOf, inviteText, stamp } from './cbtRemote'
import { flatQuestions } from './lib/cbtEngine'

const local = v => { if (!v) return ''; const d = new Date(v); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const newCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000))

export function PublishModal({ test, row, by, onClose, onChanged, flash }) {
  const [code, setCode] = useState(row ? row.access_code || '' : newCode())
  const [opens, setOpens] = useState(local(row?.opens_at))
  const [closes, setCloses] = useState(local(row?.closes_at))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(row || null)
  const qs = flatQuestions(test)
  const keyed = qs.filter(q => q.answer).length

  const publish = async () => {
    setErr('')
    if (code.trim().length < 4) { setErr('Set an access code of at least 4 characters — candidates need it to look themselves up by GCC no.'); return }
    if (opens && closes && new Date(closes) <= new Date(opens)) { setErr('The closing time must be after the opening time.'); return }
    setBusy(true)
    try {
      await publishOnline(test, { code, opensAt: opens, closesAt: closes, status: 'live', by })
      const next = { id: test.id, access_code: code.trim() || null, opens_at: opens ? new Date(opens).toISOString() : null, closes_at: closes ? new Date(closes).toISOString() : null, status: 'live' }
      setDone(next); onChanged(); flash(row ? 'Online exam updated.' : 'Published. Share the link with candidates.')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const copy = async text => { try { await navigator.clipboard.writeText(text); flash('Copied.') } catch { flash('Could not copy — select the text and copy it.') } }
  const text = done ? inviteText(test.name, done, test.durationMin) : ''

  return (
    <div className="cbt-modal" style={{ zIndex: 50 }} onClick={onClose}>
      <div className="box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <h3>🌐 Online exam — {test.name}</h3>
        <p className="muted">Candidates open a link on their own phone or computer, enter their details (or find themselves by name or GCC no. from the ERP student list), and take this test. The paper and the clock come from the server; the answer key never leaves it; the server marks the attempt.</p>
        {keyed < qs.length && <p style={{ background: '#fff4dc', border: '1px solid #f3d38a', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>⚠️ The answer key is {keyed ? `set for ${keyed} of ${qs.length} questions` : 'not set'}. Scores will be partial until you add it (Edit / key) and publish again.</p>}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
          <label><span className="lbl">Access code (required)</span>
            <span style={{ display: 'flex', gap: 6 }}><input className="in" value={code} onChange={e => setCode(e.target.value)} /><button className="btn" onClick={() => setCode(newCode())} title="New code">🎲</button></span></label>
          <span />
          <label><span className="lbl">Opens (optional)</span><input className="in" type="datetime-local" value={opens} onChange={e => setOpens(e.target.value)} /></label>
          <label><span className="lbl">Closes (optional)</span><input className="in" type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} /></label>
        </div>
        <p className="muted">A candidate who starts before the closing time keeps their full duration. Each GCC no. gets one attempt. Candidates type only the access code and their GCC no.; the name comes from the ERP and they confirm a parent contact number that matches the record.</p>
        {err && <p role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</p>}
        <div className="cbt-actions" style={{ marginTop: 8 }}>
          <button className="btn gold" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : row || done ? '💾 Update and keep live' : '🌐 Publish online'}</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        {done && (
          <div style={{ marginTop: 14, border: '1px solid #bfe3c7', background: '#f1faf3', borderRadius: 12, padding: 12 }}>
            <b style={{ fontSize: 13 }}>Share with candidates</b>
            <div style={{ fontSize: 13, margin: '6px 0', wordBreak: 'break-all' }}><b>Link:</b> {examLink(test.id)}</div>
            {done.access_code && <div style={{ fontSize: 13 }}><b>Access code:</b> <code style={{ fontSize: 15 }}>{done.access_code}</code></div>}
            <div className="cbt-actions" style={{ marginTop: 8 }}>
              <button className="btn navy" onClick={() => copy(text)}>📋 Copy invitation</button>
              <a className="btn" style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>📲 WhatsApp</a>
              <button className="btn" onClick={() => copy(examLink(test.id))}>🔗 Copy link</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function OnlineTab({ rows, err, canEdit, localIds, onReload, onResults, onDownload, flash }) {
  const [busy, setBusy] = useState('')
  const act = async (id, fn, okMsg) => { setBusy(id); try { await fn(); await onReload(); okMsg && flash(okMsg) } catch (e) { flash(e.message) } setBusy('') }
  const copy = async text => { try { await navigator.clipboard.writeText(text); flash('Copied.') } catch { flash('Could not copy.') } }
  if (err) return <div className="card" role="alert" style={{ color: '#9a3412' }}>{err}</div>
  if (!rows) return <div className="card muted">Loading…</div>
  if (!rows.length) return <div className="card"><h3>No online exams yet</h3><p className="muted">On the Tests tab press “🌐 Online” on a test to publish it as a link candidates can open from anywhere.</p></div>
  return (
    <div className="grid cbt-tests">
      {rows.map(r => {
        const st = statusOf(r)
        return (
          <div key={r.id} className="card" style={{ margin: 0 }}>
            <h3>{r.name}</h3>
            <div className="muted">{r.duration_min} min · {r.attempts.total} attempt{r.attempts.total === 1 ? '' : 's'} ({r.attempts.submitted} submitted)</div>
            <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag" style={{ background: st.tone[0], color: st.tone[1] }}>{st.label}</span>
              {r.access_code ? <span className="tag" style={{ background: '#eef2f9', color: '#1e3a6e' }}>Code {r.access_code}</span> : <span className="tag" style={{ background: '#f1f5f9', color: '#64748b' }}>No code</span>}
              {!localIds.has(r.id) && <span className="tag" style={{ background: '#fff4dc', color: '#9a5b00' }}>Not on this computer</span>}
            </div>
            {(r.opens_at || r.closes_at) && <div className="muted">{r.opens_at ? `Opens ${stamp(r.opens_at)}` : ''}{r.opens_at && r.closes_at ? ' · ' : ''}{r.closes_at ? `Closes ${stamp(r.closes_at)}` : ''}</div>}
            <div style={{ fontSize: 12.5, margin: '8px 0', wordBreak: 'break-all' }}>{examLink(r.id)}</div>
            <div className="cbt-actions">
              <button className="btn navy" onClick={() => copy(inviteText(r.name, r, r.duration_min))}>📋 Copy invitation</button>
              <button className="btn" onClick={() => onResults(r.id)}>📊 Results</button>
              {canEdit && (r.status === 'live'
                ? <button className="btn" disabled={busy === r.id} onClick={() => act(r.id, () => setOnline(r.id, { status: 'closed' }), 'Exam closed.')}>⏹ Close</button>
                : <button className="btn" disabled={busy === r.id} onClick={() => act(r.id, () => setOnline(r.id, { status: 'live' }), 'Exam is live again.')}>▶ Reopen</button>)}
              {!localIds.has(r.id) && <button className="btn" onClick={() => onDownload(r.id)}>⬇ To this computer</button>}
              {canEdit && <button className="btn red" disabled={busy === r.id} onClick={() => { if (window.confirm(`Remove “${r.name}” from online and delete all ${r.attempts.total} online attempt(s)? The link stops working. A copy on an office computer is not affected.`)) act(r.id, () => deleteOnline(r.id), 'Removed from online.') }}>🗑</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

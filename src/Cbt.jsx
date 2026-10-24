// Cbt.jsx — CBT Exam module: build a computer based test (SSC / TCS style) from Word question papers, run it
// for a candidate on this computer, and see the results. Tests and results are kept in this browser.
import { useCallback, useEffect, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import { cbtStore, newTestId } from './cbtStore'
import CbtBuilder from './CbtBuilder'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { flatQuestions, keyStatus, resultRows, resultsCSV } from './lib/cbtEngine'
import { listOnline, onlineAttempts, fetchOnlineTest, deleteOnlineAttempt, statusOf } from './cbtRemote'
import { flagTotal, flagText } from './lib/cbtProctorLogic'
import { PublishModal, OnlineTab } from './CbtOnline'
import { CbtCertificateTool } from './CbtCertificate'

const download = (name, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const fileSafe = s => String(s || 'test').replace(/[^\w.-]+/g, '-')
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export default function Cbt({ perms, currentUser }) {
  const canEdit = perms ? !!(perms.add && perms.edit) : true
  const [tab, setTab] = useState('tests')
  const [tests, setTests] = useState(null)
  const [builder, setBuilder] = useState(null)     // null | 'new' | test
  const [start, setStart] = useState(null)         // test being started (candidate form)
  const [cand, setCand] = useState({ name: '', roll: '' })
  const [live, setLive] = useState([])             // unfinished attempts of that test
  const [play, setPlay] = useState(null)           // { test, candidate, resume }
  const [done, setDone] = useState(null)           // { test, attempt, admin }
  const [resTest, setResTest] = useState('')
  const [attempts, setAttempts] = useState([])
  const [msg, setMsg] = useState('')
  const [online, setOnline] = useState(null)       // published tests (server), or null while loading
  const [onlineErr, setOnlineErr] = useState('')
  const [pub, setPub] = useState(null)             // test being published
  const [resFull, setResFull] = useState(null)     // the test (with key) the Results tab is showing
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const load = useCallback(async () => setTests(await cbtStore.listTests()), [])
  const loadOnline = useCallback(async () => {
    try { setOnline(await listOnline()); setOnlineErr('') } catch (e) { setOnline([]); setOnlineErr(e.message) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the saved tests from this browser once
  useEffect(() => { load(); loadOnline() }, [load, loadOnline])
  useEffect(() => {
    let live = true
    if (tab === 'results' && resTest) {
      const row = online?.find(o => o.id === resTest)
      Promise.all([
        cbtStore.listAttempts(resTest).then(a => a.map(x => ({ ...x, source: 'local' }))),
        row ? onlineAttempts(resTest, row.name).catch(() => []) : [],
        cbtStore.getTest(resTest).then(t => t || (row ? fetchOnlineTest(resTest).catch(() => null) : null)),
      ]).then(([l, o, t]) => { if (live) { setAttempts([...o, ...l]); setResFull(t) } })
    }
    return () => { live = false }
  }, [tab, resTest, done, online])

  const openStart = async t => { setStart(t); setCand({ name: '', roll: '' }); setLive((await cbtStore.listAttempts(t.id)).filter(a => a.state === 'inprogress')) }
  const launch = () => {
    if (!cand.name.trim()) { flash('Enter the candidate\'s name.'); return }
    setPlay({ test: start, candidate: { name: cand.name.trim(), roll: cand.roll.trim() }, resume: null }); setStart(null)
  }
  const resume = a => { setPlay({ test: start, candidate: a.candidate, resume: a }); setStart(null) }

  const saveTest = async t => { await cbtStore.saveTest(t); setBuilder(null); await load(); flash('Test saved.') }
  const remove = async t => {
    if (!window.confirm(`Delete “${t.name}” and all its results? This cannot be undone.`)) return
    await cbtStore.deleteTest(t.id); await load()
  }
  const exportTest = t => download(`${fileSafe(t.name)}.cbt.json`, new Blob([JSON.stringify({ gnsiCbt: 1, test: t })], { type: 'application/json' }))
  const importTest = async e => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    try {
      const j = JSON.parse(await f.text())
      if (!j.gnsiCbt || !Array.isArray(j.test?.sections)) throw new Error('bad file')
      await cbtStore.saveTest({ ...j.test, id: newTestId(), name: `${j.test.name} (imported)`, createdAt: Date.now() })
      await load(); flash('Test imported.')
    } catch { flash('That file is not a CBT test file.') }
  }

  if (play) {
    return <CbtPlayer test={play.test} candidate={play.candidate} resume={play.resume}
      onSubmit={attempt => { setDone({ test: play.test, attempt, admin: false }); setPlay(null) }}
      onClose={() => setPlay(null)} />
  }
  if (done) return <CbtResult test={done.test} attempt={done.attempt} admin={done.admin} closeLabel={done.admin ? 'Back' : 'Finish'} onClose={() => setDone(null)} />

  const test = resFull && resFull.id === resTest ? resFull : tests?.find(t => t.id === resTest)
  const rows = test ? resultRows(test, attempts) : []

  return (
    <div className="cbt cbt-page">
      <style>{CBT_CSS}</style>
      <div className="cbt-hero">
        <div className="row">
          <div>
            <div className="eyebrow">GNSI · EXAMS</div>
            <h2>💻 CBT Exam</h2>
            <p>Computer based tests in the SSC / TCS style: colour-coded palette, review marking, countdown timer, English and Meitei Mayek. Works on desktop, tablet and phone.</p>
          </div>
          <div className="cbt-tabs" role="tablist">
            {[['tests', '📝 Tests'], ['online', '🌐 Online'], ['results', '📊 Results']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setBuilder(null) }}>{l}</button>)}
          </div>
        </div>
      </div>
      {msg && <div role="status" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      {tab === 'tests' && !builder && <>
        <div className="cbt-actions" style={{ marginBottom: 14 }}>
          {canEdit && <button className="btn gold" onClick={() => setBuilder('new')}>➕ New test from Word papers</button>}
          {canEdit && <label className="btn" style={{ display: 'inline-block' }}>⬆️ Import test file<input type="file" accept=".json,application/json" onChange={importTest} style={{ display: 'none' }} /></label>}
        </div>
        {tests === null && <div className="card muted">Loading…</div>}
        {tests?.length === 0 && <div className="card"><h3>No tests yet</h3><p className="muted">Press “New test from Word papers”, choose the English paper (and the Meitei Mayek paper if you have one), add the answer key and save. Then start it for a candidate.</p></div>}
        <div className="grid cbt-tests">
          {tests?.map(t => {
            const ks = keyStatus(t), n = flatQuestions(t).length
            return (
              <div key={t.id} className="card" style={{ margin: 0 }}>
                <h3>{t.name}</h3>
                <div className="muted">{n} questions · {t.sections.length} sections · {t.durationMin} min · +{t.marking.correct}{t.marking.wrong ? ` / −${t.marking.wrong}` : ' (no negative)'}</div>
                <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="tag" style={{ background: ks.complete ? '#e7f6ec' : '#fff4dc', color: ks.complete ? '#146c3a' : '#9a5b00' }}>{ks.complete ? 'Answer key complete' : `Key ${ks.set}/${ks.total}`}</span>
                  {flatQuestions(t).some(q => q.textMm) && <span className="tag" style={{ background: '#eef2f9', color: '#1e3a6e' }}>English + Meitei Mayek</span>}
                  {online?.find(o => o.id === t.id) && (() => { const st = statusOf(online.find(o => o.id === t.id)); return <span className="tag" style={{ background: st.tone[0], color: st.tone[1] }}>🌐 {st.label}</span> })()}
                </div>
                <div className="cbt-actions">
                  <button className="btn gold" onClick={() => openStart(t)}>▶ Start exam</button>
                  {canEdit && <button className="btn" onClick={() => setBuilder(t)}>✏️ Edit / key</button>}
                  <button className="btn" onClick={() => { setResTest(t.id); setTab('results') }}>📊 Results</button>
                  {canEdit && <button className="btn navy" onClick={() => setPub(t)}>🌐 Online</button>}
                  <button className="btn" onClick={() => exportTest(t)}>📤 Export</button>
                  {canEdit && <button className="btn red" onClick={() => remove(t)}>🗑</button>}
                </div>
              </div>
            )
          })}
        </div>
      </>}

      {tab === 'tests' && builder && <CbtBuilder initial={builder === 'new' ? null : builder} onSave={saveTest} onCancel={() => setBuilder(null)} />}

      {tab === 'online' && <OnlineTab rows={online} err={onlineErr} canEdit={canEdit} localIds={new Set((tests || []).map(t => t.id))} onReload={loadOnline} flash={flash}
        onResults={id => { setResTest(id); setTab('results') }}
        onDownload={async id => { const t = await fetchOnlineTest(id).catch(() => null); if (t) { await cbtStore.saveTest({ ...t, online: undefined }); await load(); flash('Copied to this computer.') } else flash('Could not download it.') }} />}

      {pub && <PublishModal test={pub} row={online?.find(o => o.id === pub.id) || null} by={currentUser?.name || currentUser?.username || ''} onClose={() => setPub(null)} onChanged={loadOnline} flash={flash} />}

      {tab === 'results' && <>
        <div className="card">
          <label><span className="lbl">Test</span>
            <select className="in" style={{ maxWidth: 420 }} value={resTest} onChange={e => setResTest(e.target.value)}>
              <option value="">— choose a test —</option>
              {tests?.map(t => <option key={t.id} value={t.id}>{t.name}{online?.some(o => o.id === t.id) ? ' (online)' : ''}</option>)}
              {online?.filter(o => !tests?.some(t => t.id === o.id)).map(o => <option key={o.id} value={o.id}>{o.name} (online only)</option>)}
            </select></label>
        </div>
        {test && <CbtCertificateTool key={test.id} test={test} rows={rows} flash={flash} />}
        {test && (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, gap: 8, flexWrap: 'wrap' }}>
              <b>{rows.length} attempt{rows.length === 1 ? '' : 's'} · {rows.filter(r => r.submitted).length} submitted</b>
              <button className="btn gold" disabled={!rows.length} onClick={() => download(`${fileSafe(test.name)}-results.csv`, new Blob([resultsCSV(test, attempts)], { type: 'text/csv;charset=utf-8' }))}>📊 Export CSV</button>
            </div>
            <div className="tbl"><table>
              <thead><tr><th>Rank</th><th>Candidate</th><th>Roll</th><th>GCC</th><th>Parent no.</th><th>Where</th><th>Status</th><th>Started</th><th className="num">Min</th><th className="num">Marks</th><th className="num">Correct</th><th className="num">Wrong</th><th className="num">Left screen</th><th>Camera / shield</th><th /></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={15} className="muted">No attempts yet.</td></tr>}
                {rows.map(({ attempt: a, g, submitted, took, rank }) => (
                  <tr key={a.id}>
                    <td>{rank ?? '—'}</td><td><b>{a.candidate.name}</b></td><td>{a.candidate.roll || '—'}</td><td>{a.gcc || '—'}{a.gcc && !a.erpMatch ? ' ⚠' : ''}</td><td>{a.parentPhone || a.phone || '—'}</td>
                    <td><span className="tag" style={{ background: a.source === 'online' ? '#eef2f9' : '#f1f5f9', color: a.source === 'online' ? '#1e3a6e' : '#64748b' }}>{a.source === 'online' ? '🌐 Online' : 'This computer'}</span></td>
                    <td><span className="tag" style={{ background: submitted ? '#e7f6ec' : '#fff4dc', color: submitted ? '#146c3a' : '#9a5b00' }}>{submitted ? 'Submitted' : 'In progress'}</span></td>
                    <td>{when(a.startedAt)}</td><td className="num">{took ?? '—'}</td>
                    <td className="num"><b>{g.marks}</b> / {g.max}</td><td className="num">{g.correct}</td><td className="num">{g.wrong}</td><td className="num">{a.switches || 0}</td><td title={flagText(a.proctor)} style={{ color: flagTotal(a.proctor) ? '#b42318' : undefined, fontWeight: flagTotal(a.proctor) ? 700 : 400 }}>{flagTotal(a.proctor) || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {submitted && <button className="btn" onClick={() => setDone({ test, attempt: a, admin: true })}>View</button>}{' '}
                      {canEdit && <button className="btn red" onClick={async () => { if (window.confirm(`Delete ${a.candidate.name}'s attempt?${a.source === 'online' ? ' The roll number can then start the online exam again.' : ''}`)) { try { if (a.source === 'online') await deleteOnlineAttempt(a.id); else await cbtStore.deleteAttempt(a.id) } catch (e) { flash(e.message); return } setDone(null); setResTest(''); setTimeout(() => setResTest(test.id), 0) } }}>🗑</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </>}

      {start && (
        <div className="cbt-modal" style={{ zIndex: 50 }} onClick={() => setStart(null)}>
          <div className="box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>Start “{start.name}”</h3>
            {live.length > 0 && <div style={{ background: '#fff4dc', border: '1px solid #f3d38a', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
              <b>Unfinished attempts on this computer</b> — the clock keeps running while a candidate is away.
              {live.map(a => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}><span>{a.candidate.name}{a.candidate.roll ? ` · ${a.candidate.roll}` : ''} <span className="muted">(started {when(a.startedAt)})</span></span><button className="btn navy" onClick={() => resume(a)}>Resume</button></div>)}
            </div>}
            <label><span className="lbl">Candidate name *</span><input className="in" autoFocus value={cand.name} onChange={e => setCand(c => ({ ...c, name: e.target.value }))} /></label>
            <label style={{ display: 'block', marginTop: 8 }}><span className="lbl">Roll / registration no.</span><input className="in" value={cand.roll} onChange={e => setCand(c => ({ ...c, roll: e.target.value }))} /></label>
            <p className="muted">The test opens full screen. Give the computer to the candidate before you press Start.</p>
            <div className="cbt-row"><button className="btn" onClick={() => setStart(null)}>Cancel</button><button className="btn gold" onClick={launch}>Start ›</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

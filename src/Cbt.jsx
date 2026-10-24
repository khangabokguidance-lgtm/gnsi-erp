// Cbt.jsx — CBT Exam module: build a computer based test (SSC / TCS style) from Word question papers, run it
// for a candidate on this computer, and see the results. Tests and results are kept in this browser.
import { useCallback, useEffect, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import { cbtStore, newTestId } from './cbtStore'
import CbtBuilder from './CbtBuilder'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { flatQuestions, keyStatus, resultRows, resultsCSV } from './lib/cbtEngine'

const download = (name, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const fileSafe = s => String(s || 'test').replace(/[^\w.-]+/g, '-')
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export default function Cbt({ perms }) {
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
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const load = useCallback(async () => setTests(await cbtStore.listTests()), [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the saved tests from this browser once
  useEffect(() => { load() }, [load])
  useEffect(() => {
    let live = true
    if (tab === 'results' && resTest) cbtStore.listAttempts(resTest).then(a => { if (live) setAttempts(a) })
    return () => { live = false }
  }, [tab, resTest, done])

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

  const test = tests?.find(t => t.id === resTest)
  const rows = test ? resultRows(test, attempts) : []

  return (
    <div className="cbt" style={{ padding: '18px 20px 40px' }}>
      <style>{CBT_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', color: '#9a7b2f' }}>GNSI · EXAMS</div>
          <h2 style={{ margin: '2px 0', fontFamily: "'Fraunces',Georgia,serif", color: '#0f1f3d' }}>💻 CBT Exam</h2>
          <div className="muted">Computer based tests in the SSC / TCS style — palette, review marking, timer, English and Meitei Mayek.</div>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: 6, background: '#fff', border: '1px solid #e6dcc3', borderRadius: 999, padding: 5 }}>
          {[['tests', '📝 Tests'], ['results', '📊 Results']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={`btn${tab === id ? ' navy' : ''}`} style={{ borderRadius: 999 }} onClick={() => { setTab(id); setBuilder(null) }}>{l}</button>)}
        </div>
      </div>
      {msg && <div role="status" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      {tab === 'tests' && !builder && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {canEdit && <button className="btn gold" onClick={() => setBuilder('new')}>➕ New test from Word papers</button>}
          {canEdit && <label className="btn" style={{ display: 'inline-block' }}>⬆️ Import test file<input type="file" accept=".json,application/json" onChange={importTest} style={{ display: 'none' }} /></label>}
        </div>
        {tests === null && <div className="card muted">Loading…</div>}
        {tests?.length === 0 && <div className="card"><h3>No tests yet</h3><p className="muted">Press “New test from Word papers”, choose the English paper (and the Meitei Mayek paper if you have one), add the answer key and save. Then start it for a candidate.</p></div>}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {tests?.map(t => {
            const ks = keyStatus(t), n = flatQuestions(t).length
            return (
              <div key={t.id} className="card" style={{ margin: 0 }}>
                <h3>{t.name}</h3>
                <div className="muted">{n} questions · {t.sections.length} sections · {t.durationMin} min · +{t.marking.correct}{t.marking.wrong ? ` / −${t.marking.wrong}` : ' (no negative)'}</div>
                <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="tag" style={{ background: ks.complete ? '#e7f6ec' : '#fff4dc', color: ks.complete ? '#146c3a' : '#9a5b00' }}>{ks.complete ? 'Answer key complete' : `Key ${ks.set}/${ks.total}`}</span>
                  {flatQuestions(t).some(q => q.textMm) && <span className="tag" style={{ background: '#eef2f9', color: '#1e3a6e' }}>English + Meitei Mayek</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn gold" onClick={() => openStart(t)}>▶ Start exam</button>
                  {canEdit && <button className="btn" onClick={() => setBuilder(t)}>✏️ Edit / key</button>}
                  <button className="btn" onClick={() => { setResTest(t.id); setTab('results') }}>📊 Results</button>
                  <button className="btn" onClick={() => exportTest(t)}>📤 Export</button>
                  {canEdit && <button className="btn red" onClick={() => remove(t)}>🗑</button>}
                </div>
              </div>
            )
          })}
        </div>
      </>}

      {tab === 'tests' && builder && <CbtBuilder initial={builder === 'new' ? null : builder} onSave={saveTest} onCancel={() => setBuilder(null)} />}

      {tab === 'results' && <>
        <div className="card">
          <label><span className="lbl">Test</span>
            <select className="in" style={{ maxWidth: 420 }} value={resTest} onChange={e => setResTest(e.target.value)}>
              <option value="">— choose a test —</option>{tests?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
        </div>
        {test && (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, gap: 8, flexWrap: 'wrap' }}>
              <b>{rows.length} attempt{rows.length === 1 ? '' : 's'} · {rows.filter(r => r.submitted).length} submitted</b>
              <button className="btn gold" disabled={!rows.length} onClick={() => download(`${fileSafe(test.name)}-results.csv`, new Blob([resultsCSV(test, attempts)], { type: 'text/csv;charset=utf-8' }))}>📊 Export CSV</button>
            </div>
            <table>
              <thead><tr><th>Rank</th><th>Candidate</th><th>Roll</th><th>Status</th><th>Started</th><th className="num">Min</th><th className="num">Marks</th><th className="num">Correct</th><th className="num">Wrong</th><th className="num">Left screen</th><th /></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={11} className="muted">No attempts yet.</td></tr>}
                {rows.map(({ attempt: a, g, submitted, took, rank }) => (
                  <tr key={a.id}>
                    <td>{rank ?? '—'}</td><td><b>{a.candidate.name}</b></td><td>{a.candidate.roll || '—'}</td>
                    <td><span className="tag" style={{ background: submitted ? '#e7f6ec' : '#fff4dc', color: submitted ? '#146c3a' : '#9a5b00' }}>{submitted ? 'Submitted' : 'In progress'}</span></td>
                    <td>{when(a.startedAt)}</td><td className="num">{took ?? '—'}</td>
                    <td className="num"><b>{g.marks}</b> / {g.max}</td><td className="num">{g.correct}</td><td className="num">{g.wrong}</td><td className="num">{a.switches || 0}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {submitted && <button className="btn" onClick={() => setDone({ test, attempt: a, admin: true })}>View</button>}{' '}
                      {canEdit && <button className="btn red" onClick={async () => { if (window.confirm(`Delete ${a.candidate.name}'s attempt?`)) { await cbtStore.deleteAttempt(a.id); setAttempts(await cbtStore.listAttempts(test.id)) } }}>🗑</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><button className="btn" onClick={() => setStart(null)}>Cancel</button><button className="btn gold" onClick={launch}>Start ›</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// CbtPublic.jsx — the page a candidate opens from the online exam link (…/exam?t=<id>): no login. They enter
// their name and roll number (and the access code if there is one), read the instructions, and take the exam
// exactly as in the office — but the paper comes from the server, the clock is the server's, answers are saved
// to the server as they go and the server marks it. Reopening the link on the same device resumes the attempt.
import { useEffect, useMemo, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { examInfo, startExam, resumeExam, saveExam, submitExam, friendly, infoTest, localAttempt, resultView } from './cbtRemote'
import { getInstitute } from './systemSettings'

const savedKey = id => `gnsi-cbt-remote:${id}`
const backupKey = id => `gnsi-cbt-bk:${id}`
const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// The adapter CbtPlayer talks to. `offset` = server time minus this device's time, so the countdown follows the server.
function makeRemote({ testId, code, candidate, phone, attemptId = null, token = null }) {
  const r = { offset: 0, attemptId, token }
  const sync = o => { if (o?.serverNow) r.offset = Date.parse(o.serverNow) - Date.now() }
  const backup = a => write(backupKey(r.attemptId), { ts: Date.now(), answers: a.answers, marked: a.marked, visited: a.visited, current: a.current, lang: a.lang, switches: a.switches })
  r.begin = async () => {
    const res = await startExam(testId, code, candidate.name, candidate.roll, phone)
    r.attemptId = res.attempt.id; r.token = res.token; sync(res.attempt)
    write(savedKey(testId), { attemptId: r.attemptId, token: r.token, name: candidate.name, roll: candidate.roll })
    return { test: res.test, attempt: localAttempt(res.attempt, res.test, candidate) }
  }
  r.save = async a => { backup(a); const res = await saveExam(r.attemptId, r.token, a); sync(res); return res }
  r.submit = async a => { backup(a); const res = await submitExam(r.attemptId, r.token, a); sync(res.attempt); return res }
  return r
}

export default function CbtPublic() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const testId = params.get('t') || ''
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ name: '', roll: '', phone: '', code: params.get('c') || '' })
  const [saved] = useState(() => read(savedKey(testId)))
  const [phase, setPhase] = useState('landing')     // landing | gate | exam | result | done
  const [run, setRun] = useState(null)              // { test, remote, candidate, resume }
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  const inst = getInstitute()

  useEffect(() => {
    let live = true
    if (!testId) { Promise.resolve().then(() => live && setErr('This exam link is not valid.')); return }
    examInfo(testId).then(i => { if (live) setInfo(i) }).catch(e => { if (live) setErr(friendly(e)) })
    return () => { live = false }
  }, [testId])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const total = info ? info.sections.reduce((s, x) => s + x.count, 0) : 0

  const proceed = () => {
    setErr('')
    if (form.name.trim().length < 2) return setErr('Enter your full name.')
    if (!form.roll.trim()) return setErr('Enter your roll or registration number.')
    if (info.needsCode && !form.code.trim()) return setErr('Enter the access code you were given.')
    const candidate = { name: form.name.trim(), roll: form.roll.trim() }
    setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, phone: form.phone }), resume: null })
    setPhase('gate')
  }

  const resume = async () => {
    setBusy(true); setErr('')
    try {
      const res = await resumeExam(saved.attemptId, saved.token)
      const candidate = { name: saved.name, roll: saved.roll }
      if (res.result) { setView(resultView(res.result, infoTest(info), candidate)); setPhase('result') } else {
        const remote = makeRemote({ testId, candidate, attemptId: saved.attemptId, token: saved.token })
        remote.offset = Date.parse(res.attempt.serverNow) - Date.now()
        setRun({ test: res.test, candidate, remote, resume: localAttempt(res.attempt, res.test, candidate, read(backupKey(saved.attemptId))) })
        setPhase('exam')
      }
    } catch (e) { setErr(friendly(e)) }
    setBusy(false)
  }

  const submitted = (res, test, cur) => { setView(resultView(res, test, run.candidate, cur)); setPhase('result') }

  if (phase === 'gate' || phase === 'exam') {
    return <CbtPlayer test={run.test} candidate={run.candidate} resume={run.resume} remote={run.remote} onSubmit={submitted} onClose={() => { setPhase('landing'); setRun(null) }} />
  }
  if (phase === 'result' && view) {
    return <CbtResult test={view.test} attempt={view.attempt} closeLabel="Finish" onClose={() => setPhase('done')} />
  }
  if (phase === 'done') {
    return (
      <div className="cbt cbt-page" style={{ maxWidth: 560 }}><style>{CBT_CSS}</style>
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}><h3>Thank you</h3><p className="muted">Your exam is complete. You can close this window.</p></div>
      </div>
    )
  }

  const open = info?.state === 'open'
  return (
    <div className="cbt cbt-page" style={{ maxWidth: 720 }}>
      <style>{CBT_CSS}</style>
      <div className="cbt-hero">
        <div className="eyebrow">{(inst.name || 'GNSI').toUpperCase()} · ONLINE EXAM</div>
        <h2>{info ? info.name : 'Online exam'}</h2>
        {info && <p>{total} questions · {info.durationMin} minutes · {info.marking.correct} mark{info.marking.correct === 1 ? '' : 's'} each{info.marking.wrong ? `, −${info.marking.wrong} for a wrong answer` : ', no negative marking'}</p>}
      </div>
      {!info && !err && <div className="card muted">Loading…</div>}
      {err && <div className="card" role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</div>}
      {info && info.state === 'closed' && <div className="card" style={{ color: '#b42318', fontWeight: 700 }}>This exam is closed.</div>}
      {info && info.state === 'not_open' && <div className="card" style={{ color: '#9a5b00', fontWeight: 700 }}>This exam opens on {when(info.opensAt)}.</div>}
      {info && saved && (
        <div className="card" style={{ borderColor: '#bfe3c7', background: '#f1faf3' }}>
          <h3>Continue your exam</h3>
          <p className="muted">You started this exam on this device as <b>{saved.name}</b> ({saved.roll}). Your answers were saved as you went.</p>
          <button className="btn gold" onClick={resume} disabled={busy}>{busy ? 'Opening…' : 'Continue / see my result'}</button>
        </div>
      )}
      {info && open && !saved && (
        <div className="card">
          <h3>Your details</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
            <label><span className="lbl">Full name *</span><input className="in" autoComplete="name" value={form.name} onChange={set('name')} /></label>
            <label><span className="lbl">Roll / registration no. *</span><input className="in" value={form.roll} onChange={set('roll')} /></label>
            <label><span className="lbl">Phone (optional)</span><input className="in" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></label>
            {info.needsCode && <label><span className="lbl">Access code *</span><input className="in" autoComplete="off" value={form.code} onChange={set('code')} /></label>}
          </div>
          <ul className="muted" style={{ margin: '12px 0', paddingLeft: 18 }}>
            <li>Use a steady internet connection and keep this page open until you submit.</li>
            <li>The clock starts when you press “I am ready to begin”, and runs even if you close the page.</li>
            <li>You get one attempt. If the page closes, open this link again on the same device to continue.</li>
            <li>Leaving the exam screen is recorded.</li>
          </ul>
          <button className="btn gold" onClick={proceed}>Continue ›</button>
        </div>
      )}
    </div>
  )
}

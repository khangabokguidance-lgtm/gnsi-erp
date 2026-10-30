// CbtPublic.jsx — the page a candidate opens from the online exam link (…/exam?t=<id>): no login. They enter
// their name and roll number (and the access code if there is one), read the instructions, and take the exam
// exactly as in the office — but the paper comes from the server, the clock is the server's, answers are saved
// to the server as they go and the server marks it. Reopening the link on the same device resumes the attempt.
import { useEffect, useMemo, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { examInfo, startExam, resumeExam, saveExam, submitExam, lookupStudent, friendly, infoTest, localAttempt, resultView } from './cbtRemote'
import { getInstitute } from './systemSettings'
import ResponsiveTables from './ResponsiveTables'

const savedKey = id => `gnsi-cbt-remote:${id}`
const backupKey = id => `gnsi-cbt-bk:${id}`
const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// The adapter CbtPlayer talks to. `offset` = server time minus this device's time, so the countdown follows the server.
function makeRemote({ testId, code, candidate, gcc, parent, attemptId = null, token = null, session = null }) {
  const r = { offset: 0, attemptId, token, session }
  const sync = o => { if (o?.serverNow) r.offset = Date.parse(o.serverNow) - Date.now() }
  const backup = a => write(backupKey(r.attemptId), { ts: Date.now(), answers: a.answers, marked: a.marked, visited: a.visited, current: a.current, lang: a.lang, switches: a.switches, proctor: a.proctor || null, timing: a.timing || null, changes: a.changes || null })
  r.begin = async () => {
    const res = await startExam(testId, code, gcc, parent)
    r.attemptId = res.attempt.id; r.token = res.token; r.session = res.session; sync(res.attempt)
    write(savedKey(testId), { attemptId: r.attemptId, token: r.token, session: r.session, name: candidate.name, roll: candidate.roll })
    return { test: res.test, attempt: localAttempt(res.attempt, res.test, candidate) }
  }
  r.save = async a => { backup(a); const res = await saveExam(r.attemptId, r.token, a, r.session); sync(res); return res }
  r.submit = async a => { backup(a); const res = await submitExam(r.attemptId, r.token, a, r.session); sync(res.attempt); return res }
  return r
}

function CbtPublicInner() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const testId = params.get('t') || ''
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ gcc: '', parent: '', code: params.get('c') || '' })
  const [saved] = useState(() => read(savedKey(testId)))
  const [phase, setPhase] = useState('landing')     // landing | gate | exam | result | done
  const [run, setRun] = useState(null)              // { test, remote, candidate, resume }
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('find')     // find (access code + GCC no.) | verify (contact number)
  const [stu, setStu] = useState(null)             // the ERP student found for the GCC no.: { name, className, phoneHint, hasPhone } | { none: true } | null
  const inst = getInstitute()

  useEffect(() => {
    let live = true
    if (!testId) { Promise.resolve().then(() => live && setErr('This exam link is not valid.')); return }
    examInfo(testId).then(i => { if (live) setInfo(i) }).catch(e => { if (live) setErr(friendly(e)) })
    return () => { live = false }
  }, [testId])

  // GCC detector: type the access code and the GCC no.; the student is found in the ERP (exact GCC match) and the
  // full name appears. The parent number is then checked against the ERP record before the exam can begin.
  useEffect(() => {
    if (!form.gcc.trim() || !form.code.trim() || !testId) return
    let live = true
    const t = setTimeout(async () => {
      try { const r = await lookupStudent(testId, form.code, form.gcc); if (live) { setStu(r.length ? r[0] : { none: true }); setErr('') } } catch (e) { if (live) { setStu(null); setErr(friendly(e)) } }
    }, 700)
    return () => { live = false; clearTimeout(t) }
  }, [form.gcc, form.code, testId])
  const type = k => e => {
    const v = k === 'gcc' ? e.target.value.replace(/\D/g, '') : k === 'parent' ? e.target.value.replace(/[^\d+\s-]/g, '') : e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'gcc' || k === 'code') setStu(null)
  }
  const total = info ? info.sections.reduce((s, x) => s + x.count, 0) : 0

  const toVerify = () => {
    setErr('')
    if (!form.code.trim()) return setErr('Enter the access code you were given.')
    if (!stu || stu.none) return setErr('Enter your GCC no. — your name must appear below it.')
    setStep('verify')
  }

  const proceed = async () => {
    setErr('')
    const par = form.parent.replace(/\D/g, '')
    if (stu.hasPhone && par.length < 10) return setErr('Enter the 10-digit parent / guardian contact number.')
    setBusy(true)
    try {
      if (stu.hasPhone) {
        const r = await lookupStudent(testId, form.code, form.gcc, par)
        if (!r.length || r[0].verified !== true) { setBusy(false); return setErr('This number does not match the parent / guardian number in the institute records. Check the last four digits shown.') }
      }
      const candidate = { name: stu.name, roll: String(Number(stu.gcc) || stu.gcc) }
      setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, gcc: stu.gcc, parent: par }), resume: null })
      setPhase('gate')
    } catch (e) { setErr(friendly(e)) }
    setBusy(false)
  }

  const resume = async () => {
    setBusy(true); setErr('')
    try {
      const res = await resumeExam(saved.attemptId, saved.token, saved.session)
      const candidate = { name: saved.name, roll: saved.roll }
      if (res.result) { setView(resultView(res.result, infoTest(info), candidate)); setPhase('result') } else {
        const remote = makeRemote({ testId, candidate, attemptId: saved.attemptId, token: saved.token, session: res.session })
        write(savedKey(testId), { ...saved, session: res.session })
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
      {err && !(info && open && !saved) && <div className="card" role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</div>}
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
          {step === 'find' ? <>
            <h3 style={{ marginBottom: 2 }}>Your details</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 1 of 2 — find yourself</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
              <label><span className="lbl">Access code *</span><input className="in" autoComplete="off" value={form.code} onChange={type('code')} /></label>
              <label><span className="lbl">GCC no. *</span><input className="in" inputMode="numeric" autoComplete="off" placeholder="your GCC number" value={form.gcc} onChange={type('gcc')} /></label>
              {stu && !stu.none && <label><span className="lbl">Full name</span><input className="in" readOnly value={stu.name} style={{ fontWeight: 700, background: '#f1faf3' }} /></label>}
              {stu && !stu.none && <label><span className="lbl">Class / batch</span><input className="in" readOnly value={stu.className || '—'} style={{ background: '#f1faf3' }} /></label>}
              {stu && !stu.none && <label><span className="lbl">Father's name</span><input className="in" readOnly value={stu.fatherName || '—'} style={{ background: '#f1faf3' }} /></label>}
            </div>
            {stu?.none && <p role="alert" style={{ margin: '8px 0', color: '#b42318', fontWeight: 700 }}>No student with this GCC no. was found. Check the number, or ask the office.</p>}
            {stu && !stu.none && <p style={{ margin: '8px 0', color: '#1a7f37', fontWeight: 700 }}>✓ Found in the institute records. Is this you? If not, check the GCC no.</p>}
            <ul className="muted" style={{ margin: '12px 0', paddingLeft: 18 }}>
              <li>Use a steady internet connection and keep this page open until you submit.</li>
              <li>The clock starts when you press “I am ready to begin”, and runs even if you close the page.</li>
              <li>You get one attempt. If the page closes, open this link again on the same device to continue.</li>
              <li>Leaving the exam screen is recorded.</li>
            </ul>
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <button className="btn gold" onClick={toVerify} disabled={!stu || !!stu.none}>Next: verify contact number ›</button>
          </> : <>
            <h3 style={{ marginBottom: 2 }}>Verify your contact number</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 2 of 2 — confirm it is really you</p>
            <div style={{ border: '1px solid #cfe6d5', background: '#f1faf3', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <b>{stu.name}</b><br /><span className="muted">GCC {stu.gcc}{stu.className ? ` · ${stu.className}` : ''}{stu.fatherName ? ` · Father: ${stu.fatherName}` : ''}</span>
            </div>
            {stu.hasPhone ? <>
              <label><span className="lbl">Parent / guardian contact no. *</span><input className="in" inputMode="tel" autoComplete="off" autoFocus placeholder="10-digit mobile" value={form.parent} onChange={type('parent')} /></label>
              <p className="muted" style={{ margin: '6px 0 12px' }}>Type the parent / guardian number given at admission. Hint: it ends in <b>{stu.phoneHint.replace(/•/g, '')}</b>.</p>
            </> : <p className="muted" style={{ margin: '4px 0 12px' }}>No parent number is on file for you, so it cannot be checked now. You can continue — please ask the office to add it.</p>}
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { setErr(''); setStep('find') }} disabled={busy}>‹ Back</button>
              <button className="btn gold" onClick={proceed} disabled={busy}>{busy ? 'Checking…' : stu.hasPhone ? 'Verify and continue ›' : 'Continue ›'}</button>
            </div>
          </>}
        </div>
      )}
    </div>
  )
}

export default function CbtPublic() {
  return <ResponsiveTables><CbtPublicInner /></ResponsiveTables>
}

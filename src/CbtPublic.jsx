// CbtPublic.jsx — the page a candidate opens from the online exam link (…/exam?t=<id>): no login. They enter
// their name and roll number (and the access code if there is one), read the instructions, and take the exam
// exactly as in the office — but the paper comes from the server, the clock is the server's, answers are saved
// to the server as they go and the server marks it. Reopening the link on the same device resumes the attempt.
import { useEffect, useMemo, useState } from 'react'
import CbtCountdown from './CbtCountdown'
import { DEMO_TEST } from './lib/cbtDemo'
import { DISTRICT_OPTIONS, GENDERS, CASTES } from './lib/studentFields'
import { CBT_CSS } from './cbtCss'
import CbtPlayer, { CbtResult } from './CbtPlayer'
import { examInfo, startExam, startGuest, resumeExam, saveExam, submitExam, lookupStudent, friendly, infoTest, localAttempt, resultView } from './cbtRemote'
import { getInstitute } from './systemSettings'
import ResponsiveTables from './ResponsiveTables'
import { parseExamRef, examHref } from './lib/cbtRef'

const savedKey = id => `gnsi-cbt-remote:${id}`
const backupKey = id => `gnsi-cbt-bk:${id}`
const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const when = t => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// The adapter CbtPlayer talks to. `offset` = server time minus this device's time, so the countdown follows the server.
function makeRemote({ testId, code, candidate, gcc, parent, guest = null, attemptId = null, token = null, session = null }) {
  const r = { offset: 0, attemptId, token, session }
  const sync = o => { if (o?.serverNow) r.offset = Date.parse(o.serverNow) - Date.now() }
  const backup = a => write(backupKey(r.attemptId), { ts: Date.now(), answers: a.answers, marked: a.marked, visited: a.visited, current: a.current, lang: a.lang, switches: a.switches, proctor: a.proctor || null, timing: a.timing || null, sec: a.sec || null, changes: a.changes || null })
  r.begin = async () => {
    const res = guest ? await startGuest(testId, code, guest.name, guest.phone, guest.district, guest.gender, guest.caste) : await startExam(testId, code, gcc, parent, null)
    r.attemptId = res.attempt.id; r.token = res.token; r.session = res.session; sync(res.attempt)
    write(savedKey(testId), { attemptId: r.attemptId, token: r.token, session: r.session, name: candidate.name, roll: candidate.roll })
    return { test: res.test, attempt: localAttempt(res.attempt, res.test, candidate) }
  }
  r.save = async a => { backup(a); const res = await saveExam(r.attemptId, r.token, a, r.session); sync(res); return res }
  r.submit = async a => { backup(a); const res = await submitExam(r.attemptId, r.token, a, r.session); sync(res.attempt); return res }
  return r
}

// Opened as /exam with no test in the link (e.g. from the website menu): ask for the Test ID or the full link, and
// offer to continue an exam that was started on this device.
function CbtFinder() {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const started = useMemo(() => {
    const out = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('gnsi-cbt-remote:')) { const v = read(k); if (v && v.attemptId) out.push({ id: k.slice('gnsi-cbt-remote:'.length), name: v.name || '' }) }
      }
    } catch { /* storage blocked */ }
    return out
  }, [])
  const go = e => {
    e.preventDefault()
    const ref = parseExamRef(raw)
    if (!ref) { setMsg('Paste the exam link or type the Test ID your teacher gave you.'); return }
    window.location.href = examHref(ref)
  }
  return (
    <>
      {started.length > 0 && <div className="card" style={{ borderLeft: '4px solid #1f4e8c' }}>
        <b>Continue your exam</b>
        <div className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>An exam was started on this device. Open it to carry on — your answers are saved.</div>
        {started.map(x => <a key={x.id} className="btn navy" style={{ display: 'inline-block', marginRight: 8 }} href={examHref({ id: x.id })}>Continue{x.name ? ` as ${x.name}` : ''} →</a>)}
      </div>}
      <form className="card" onSubmit={go}>
        <h3 style={{ margin: '0 0 6px' }}>Open your exam</h3>
        <p className="muted" style={{ margin: '0 0 10px' }}>Your teacher gives you an exam link or a Test ID. Paste either one here.</p>
        <label><span className="lbl">Exam link or Test ID</span><input className="in" value={raw} onChange={e => { setRaw(e.target.value); setMsg('') }} placeholder="Paste the exam link or Test ID" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
        {msg && <p role="alert" style={{ color: '#b42318', fontWeight: 700, margin: '8px 0 0' }}>{msg}</p>}
        <div style={{ marginTop: 12 }}><button className="btn navy" type="submit">Open exam →</button></div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Do not have a link yet? Ask your teacher, or call the institute — tests are opened for each batch.</p>
      </form>
    </>
  )
}

function CbtPublicInner() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const testId = params.get('t') || ''
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ gcc: '', parent: '', code: params.get('c') || '', gname: '', gphone: '', gdistrict: '', ggender: '', gcaste: '' })
  const [saved] = useState(() => read(savedKey(testId)))
  const [phase, setPhase] = useState('landing')     // landing | gate | exam | result | done
  const [run, setRun] = useState(null)              // { test, remote, candidate, resume }
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('find')     // find (access code + GCC no.) | verify (contact number)
  const [guestMode, setGuestMode] = useState(false)   // a candidate who is not in the institute records (only when the test allows guests)
  const [stu, setStu] = useState(null)             // the ERP student found for the GCC no.: { gcc, hasPhone } | { none: true } | null
  const inst = getInstitute()

  useEffect(() => {
    let live = true
    if (!testId) return undefined                    // no test in the link: the finder below asks for it
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
    const v = k === 'gcc' ? e.target.value.replace(/\D/g, '') : k === 'parent' || k === 'gphone' ? e.target.value.replace(/[^\d+\s-]/g, '') : e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'gcc' || k === 'code') setStu(null)
  }
  const total = info ? info.sections.reduce((s, x) => s + x.count, 0) : 0

  const toVerify = () => {
    setErr('')
    if (!form.code.trim()) return setErr('Enter the access code you were given.')
    if (!stu || stu.none) return setErr('Enter a valid GCC no.')
    if (!stu.hasPhone) return setErr('No parent / guardian number is on file for this GCC no. Ask the office to add it.')
    setStep('verify')
  }

  const proceed = async () => {
    setErr('')
    const par = form.parent.replace(/\D/g, '')
    if (par.length < 10) return setErr('Enter the 10-digit parent / guardian contact number.')
    setBusy(true)
    try {
      const r = await lookupStudent(testId, form.code, form.gcc, par)
      if (!r.length || r[0].verified !== true) { setBusy(false); return setErr('The number does not match the institute records.') }
      const v = r[0]
      const candidate = { name: v.name, roll: String(Number(v.gcc) || v.gcc) }
      setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, gcc: v.gcc, parent: par }), resume: null })
      setPhase('gate')
    } catch (e) { setErr(friendly(e)) }
    setBusy(false)
  }

  const startAsGuest = () => {
    setErr('')
    if (!form.code.trim()) return setErr('Enter the access code you were given.')
    if (form.gname.trim().length < 2) return setErr('Enter your full name.')
    const ph = form.gphone.replace(/\D/g, '')
    if (ph.length < 10) return setErr('Enter your 10-digit mobile number.')
    if (!form.gdistrict || !form.ggender || !form.gcaste) return setErr('Choose your district, gender and category.')
    const candidate = { name: form.gname.trim(), roll: 'G' + ph.slice(-10) }
    setRun({ test: infoTest(info), candidate, remote: makeRemote({ testId, code: form.code, candidate, guest: { name: form.gname.trim(), phone: ph, district: form.gdistrict, gender: form.ggender, caste: form.gcaste } }), resume: null })
    setPhase('gate')
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
  // practice test: runs in this browser only; its result is the local attempt itself
  const startDemo = () => { setErr(''); setRun({ test: DEMO_TEST, candidate: { name: 'Practice', roll: 'DEMO' }, remote: null, resume: null, demo: true }); setPhase('gate') }
  const demoDone = done => { setView({ test: DEMO_TEST, attempt: done }); setPhase('result') }

  if (phase === 'gate' || phase === 'exam') {
    return <CbtPlayer test={run.test} candidate={run.candidate} resume={run.resume} remote={run.remote} demo={!!run.demo} onSubmit={run.demo ? demoDone : submitted} onClose={() => { setPhase('landing'); setRun(null) }} />
  }
  if (phase === 'result' && view) {
    return <CbtResult test={view.test} attempt={view.attempt} closeLabel={run?.demo ? 'Back to the exam page' : 'Finish'} onClose={() => { if (run?.demo) { setRun(null); setView(null); setPhase('landing') } else setPhase('done') }} />
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
      {!testId && <CbtFinder />}
      {testId && !info && !err && <div className="card muted">Loading…</div>}
      {info && open && !saved && <div className="card" style={{ background: '#f8fafc' }}><b>New to computer-based tests?</b> <span className="muted">Try a 4-minute practice test first — it is not counted and nothing is saved.</span> <button className="btn" style={{ marginLeft: 6 }} onClick={startDemo}>Try the practice test</button></div>}
      {err && !(info && open && !saved) && <div className="card" role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</div>}
      {info && info.state === 'closed' && <div className="card" style={{ color: '#b42318', fontWeight: 700 }}>This exam is closed.</div>}
      {info && info.state === 'not_open' && <div className="card" style={{ color: '#9a5b00', fontWeight: 700, textAlign: 'center' }}>This exam opens on {when(info.opensAt)}.{info.opensAt && <div style={{ marginTop: 10 }}><CbtCountdown to={info.opensAt} onDone={() => window.location.reload()} /></div>}</div>}
      {info && saved && (
        <div className="card" style={{ borderColor: '#bfe3c7', background: '#f1faf3' }}>
          <h3>Continue your exam</h3>
          <p className="muted">You started this exam on this device as <b>{saved.name}</b> ({saved.roll}). Your answers were saved as you went.</p>
          <button className="btn gold" onClick={resume} disabled={busy}>{busy ? 'Opening…' : 'Continue / see my result'}</button>
        </div>
      )}
      {info && open && !saved && info.guests && guestMode && (
        <div className="card">
          <h3 style={{ marginBottom: 2 }}>Guest candidate</h3>
          <p className="muted" style={{ margin: '0 0 10px' }}>For candidates who are not students of the institute. You get one attempt per mobile number.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
            <label><span className="lbl">Access code *</span><input className="in" autoComplete="off" value={form.code} onChange={type('code')} /></label>
            <label><span className="lbl">Full name *</span><input className="in" autoComplete="off" value={form.gname} onChange={type('gname')} /></label>
            <label><span className="lbl">Mobile number *</span><input className="in" inputMode="tel" autoComplete="off" placeholder="10-digit mobile" value={form.gphone} onChange={type('gphone')} /></label>
            <label><span className="lbl">District *</span><select className="in" value={form.gdistrict} onChange={type('gdistrict')}><option value="">Choose district…</option>{DISTRICT_OPTIONS.map(d => <option key={d}>{d}</option>)}</select></label>
            <label><span className="lbl">Gender *</span><select className="in" value={form.ggender} onChange={type('ggender')}><option value="">Choose…</option>{GENDERS.map(g => <option key={g}>{g}</option>)}</select></label>
            <label><span className="lbl">Category (caste) *</span><select className="in" value={form.gcaste} onChange={type('gcaste')}><option value="">Choose…</option>{CASTES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          {err && <p role="alert" style={{ margin: '10px 0 0', color: '#b42318', fontWeight: 700 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button className="btn" onClick={() => { setErr(''); setGuestMode(false) }}>‹ I am a student</button><button className="btn gold" onClick={startAsGuest}>Continue ›</button></div>
        </div>
      )}
      {info && open && !saved && !guestMode && (
        <div className="card">
          {step === 'find' ? <>
            <h3 style={{ marginBottom: 2 }}>Your details</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 1 of 2 — find yourself</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
              <label><span className="lbl">Access code *</span><input className="in" autoComplete="off" value={form.code} onChange={type('code')} /></label>
              <label><span className="lbl">GCC no. *</span><input className="in" inputMode="numeric" autoComplete="off" placeholder="your GCC number" value={form.gcc} onChange={type('gcc')} /></label>
            </div>
            {stu?.none && <p role="alert" style={{ margin: '8px 0', color: '#b42318', fontWeight: 700 }}>No student with this GCC no. was found. Check the number, or ask the office.</p>}
            {stu && !stu.none && stu.hasPhone && <p style={{ margin: '8px 0', color: '#1a7f37', fontWeight: 700 }}>✓ GCC no. found. Your name is shown after you verify the contact number.</p>}
            {stu && !stu.none && !stu.hasPhone && <p role="alert" style={{ margin: '8px 0', color: '#b42318', fontWeight: 700 }}>No parent / guardian number is on file for this GCC no., so you cannot start online. Please ask the office to add it.</p>}
            <ul className="muted" style={{ margin: '12px 0', paddingLeft: 18 }}>
              <li>Use a steady internet connection and keep this page open until you submit.</li>
              <li>The clock starts when you press “I am ready to begin”, and runs even if you close the page.</li>
              <li>You get one attempt. If the page closes, open this link again on the same device to continue.</li>
              <li>Leaving the exam screen is recorded.</li>
            </ul>
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <button className="btn gold" onClick={toVerify} disabled={!stu || !!stu.none || !stu.hasPhone}>Next: verify contact number ›</button>
            {info.guests && <p className="muted" style={{ margin: '12px 0 0' }}>Not a student of this institute? <button className="btn" onClick={() => { setErr(''); setGuestMode(true) }}>Take the exam as a guest</button></p>}
          </> : <>
            <h3 style={{ marginBottom: 2 }}>Verify your contact number</h3>
            <p className="muted" style={{ margin: '0 0 10px' }}>Step 2 of 2 — confirm it is really you</p>
            <label><span className="lbl">Parent / guardian contact no. *</span><input className="in" inputMode="tel" autoComplete="off" autoFocus placeholder="10-digit mobile" value={form.parent} onChange={type('parent')} /></label>
            <p className="muted" style={{ margin: '6px 0 12px' }}>Type the parent / guardian number given at admission (GCC {stu.gcc}).{stu.phoneHint ? <> Hint: it ends in <b>{stu.phoneHint.replace(/•/g, '')}</b>.</> : null}</p>
            {err && <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontWeight: 700 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { setErr(''); setStep('find') }} disabled={busy}>‹ Back</button>
              <button className="btn gold" onClick={proceed} disabled={busy}>{busy ? 'Checking…' : 'Verify and continue ›'}</button>
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

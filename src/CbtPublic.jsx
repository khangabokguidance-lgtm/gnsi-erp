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
import { listPublicTests, listPracticeTests, practiceTest, examInfo, startExam, startGuest, resumeExam, saveExam, submitExam, lookupStudent, friendly, infoTest, localAttempt, resultView } from './cbtRemote'
import { getInstitute } from './systemSettings'
import ResponsiveTables from './ResponsiveTables'
import { parseExamRef, examHref } from './lib/cbtRef'
import { FINDER_FILTERS, splitPublicTests, showBlocks } from './lib/cbtFinder'

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

// The welcome page of the exam site (/exam with no test in the link): shown first, once per browser session.
function CbtWelcome({ inst, onStart, onPractice }) {
  const [counts, setCounts] = useState(null)
  useEffect(() => { let live = true; listPublicTests().then(r => { if (live) { const sp = splitPublicTests(r); setCounts({ open: sp.open.length, upcoming: sp.upcoming.length }) } }); return () => { live = false } }, [])
  const feats = [['📱', 'Any phone or computer', 'Take your test wherever you are.'], ['💾', 'Answers save automatically', 'If the connection drops, carry on where you left.'], ['🎯', 'Practice first', 'Try a short practice test — nothing is counted.'], ['📚', 'Practise past exams', 'Retake closed exams any time, with the answers.']]
  const steps = ['Pick your test, or paste the link your teacher sent.', 'Enter the access code, your GCC no. and the parent / guardian number.', 'Take the exam. Your result appears when the institute releases it.']
  return (
    <div className="cbt-welcome">
      <i className="cbt-welcome-ring r1" aria-hidden="true" /><i className="cbt-welcome-ring r2" aria-hidden="true" />
      <a className="cbt-home" href="/" aria-label="Back to the GNSI website home">‹ Back to home</a>
      <div className="cbt-welcome-crest"><img src="/gnsi-mark.webp" alt="GNSI" width="86" height="88" onError={e => { e.currentTarget.style.display = 'none' }} /></div>
      <div className="cbt-welcome-inst">{(inst.name || 'Guidance Navodaya & Sainik Institute').toUpperCase()}</div>
      <h1>Welcome to <span>Online Exams</span></h1>
      <div className="cbt-welcome-rule" aria-hidden="true"><span /><b /><span /></div>
      <p className="cbt-welcome-lead">Computer-based tests for Navodaya, Sainik School and RMS aspirants — in the same format as the real exam.</p>
      {counts && (counts.open > 0 || counts.upcoming > 0) && <div className="cbt-welcome-live">
        {counts.open > 0 && <span><i aria-hidden="true" />{counts.open} test{counts.open === 1 ? '' : 's'} open now</span>}
        {counts.upcoming > 0 && <span className="up">{counts.upcoming} upcoming</span>}
      </div>}
      <div className="cbt-welcome-cta">
        <button type="button" className="cbt-welcome-go" onClick={onStart}><span>Find my exam</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
        <button type="button" className="cbt-welcome-alt" onClick={onPractice}>Try the practice test</button>
      </div>
      <div className="cbt-welcome-feats">{feats.map(([ic, t, d]) => <div key={t}><span aria-hidden="true">{ic}</span><b>{t}</b><small>{d}</small></div>)}</div>
      <div className="cbt-welcome-steps"><h2>How it works</h2><ol>{steps.map((t, i) => <li key={i}><i>{i + 1}</i><span>{t}</span></li>)}</ol></div>
      <p className="cbt-welcome-foot">Need help? Ask your teacher or call the institute.</p>
    </div>
  )
}

// Opened as /exam with no test in the link (e.g. from the website menu): ask for the Test ID or the full link, and
// offer to continue an exam that was started on this device.
function CbtFinder({ onPractice, onPracticePast, busyId }) {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const [tests, setTests] = useState(null)   // tests open now (or starting soon) that the institute has listed; null while loading
  useEffect(() => { let live = true; listPublicTests().then(r => { if (live) setTests(r) }); return () => { live = false } }, [])
  const [past, setPast] = useState([])       // closed exams that may be practised
  const [filter, setFilter] = useState('all')   // all | open | upcoming | practice
  useEffect(() => { let live = true; listPracticeTests().then(r => { if (live) setPast(r) }); return () => { live = false } }, [])
  const scan = () => {
    const out = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('gnsi-cbt-remote:')) { const v = read(k); if (v && v.attemptId) out.push({ id: k.slice('gnsi-cbt-remote:'.length), name: v.name || '' }) }
      }
    } catch { /* storage blocked */ }
    return out
  }
  const [started, setStarted] = useState(scan)
  // "Not me / start fresh": forget the exam saved on this device (and its offline backup) so a new candidate can begin.
  // The attempt itself stays on the server; the candidate can still look themselves up with the access code + GCC no.
  const forget = x => {
    if (!window.confirm(`Remove ${x.name || 'this exam'} from this device?\n\nUse this when a different candidate will take the exam on this phone. Answers already saved on the server are kept.`)) return
    try { localStorage.removeItem(savedKey(x.id)); localStorage.removeItem(backupKey(x.id)) } catch { /* storage blocked */ }
    setStarted(scan())
  }
  const go = e => {
    e.preventDefault()
    const ref = parseExamRef(raw)
    if (!ref) { setMsg('Paste the exam link or type the Test ID your teacher gave you.'); return }
    window.location.href = examHref(ref)
  }
  const split = splitPublicTests(tests)
  const show = showBlocks(filter)
  return (
    <>
      {started.length > 0 && <div className="card" style={{ borderLeft: '4px solid #1f4e8c' }}>
        <b>Continue your exam</b>
        <div className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>An exam was started on this device. Open it to carry on — your answers are saved.</div>
        {started.map(x => (
          <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <a className="btn navy" style={{ display: 'inline-block', textDecoration: 'none' }} href={examHref({ id: x.id })}>Continue{x.name ? ` as ${x.name}` : ''} →</a>
            <button type="button" className="btn" onClick={() => forget(x)} aria-label={`Not ${x.name || 'me'} — start fresh`}>Not me · start fresh</button>
          </div>
        ))}
      </div>}
      <div className="cbt-filters" role="group" aria-label="Show">
        {FINDER_FILTERS.map(([id, label]) => {
          const n = id === 'open' ? split.open.length : id === 'upcoming' ? split.upcoming.length : id === 'practice' ? past.length + (onPractice ? 1 : 0) : split.open.length + split.upcoming.length + past.length
          return <button key={id} type="button" className={`cbt-fchip${filter === id ? ' on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}<i>{n}</i></button>
        })}
      </div>
      {show.open && split.open.length > 0 && <div className="card" style={{ borderLeft: '4px solid #b42318' }}>
        <h3 style={{ margin: '0 0 4px' }}>Tests open now</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Choose your test. You will need the access code your teacher gave you and your GCC no.</div>
        {split.open.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <b>{t.name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min{t.closesAt ? ` · closes ${when(t.closesAt)}` : ''}</div>
            </div>
            <a className="btn gold" style={{ textDecoration: 'none' }} href={examHref({ id: t.id })}>Start →</a>
          </div>
        ))}
      </div>}
      {show.upcoming && split.upcoming.length > 0 && <div className="card" style={{ borderLeft: '4px solid #9a5b00' }}>
        <h3 style={{ margin: '0 0 4px' }}>Upcoming tests</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>The test series that is coming up. Each one opens at the time shown.</div>
        {split.upcoming.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <b>{t.name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min</div>
              {t.opensAt && <div style={{ marginTop: 4 }}><span style={{ fontSize: 12.5, color: '#9a5b00', fontWeight: 700 }}>Opens {when(t.opensAt)} · </span><CbtCountdown to={t.opensAt} className="cbt-cd cbt-cd-sm" onDone={() => listPublicTests().then(setTests)} /></div>}
            </div>
            <a className="btn navy" style={{ textDecoration: 'none' }} href={examHref({ id: t.id })}>View →</a>
          </div>
        ))}
      </div>}
      {(filter === 'open' && !split.open.length) && <div className="card muted">No test is open right now. Check <button type="button" className="cbt-link" onClick={() => setFilter('upcoming')}>Upcoming</button> or try <button type="button" className="cbt-link" onClick={() => setFilter('practice')}>Practice</button>.</div>}
      {(filter === 'upcoming' && !split.upcoming.length) && <div className="card muted">No upcoming test has been announced yet. Check back soon, or try <button type="button" className="cbt-link" onClick={() => setFilter('practice')}>Practice</button>.</div>}
      {show.practice && past.length > 0 && onPracticePast && <div className="card" style={{ borderLeft: '4px solid #1f4e8c' }}>
        <h3 style={{ margin: '0 0 4px' }}>Practise past exams</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>These exams have closed. Take them again in practice mode — nothing is recorded or counted, and your score and the answers appear at the end.</div>
        {past.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eef1f6' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}><b>{t.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{t.questions ? `${t.questions} questions · ` : ''}{t.durationMin} min{t.closedAt ? ` · closed ${when(t.closedAt)}` : ''}</div></div>
            <button type="button" className="btn navy" disabled={!!busyId} onClick={() => onPracticePast(t.id)}>{busyId === t.id ? 'Opening…' : 'Practise →'}</button>
          </div>
        ))}
      </div>}
      {show.practice && onPractice && <div className="card" style={{ background: '#f8fafc' }}><b>New to computer-based tests?</b> <span className="muted">Try the 4-minute practice test — it is not counted and nothing is saved. Works any time, even after an exam has closed.</span><div style={{ marginTop: 8 }}><button className="btn" type="button" onClick={onPractice}>Try the practice test</button></div></div>}
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
  const [welcomed, setWelcomed] = useState(() => { try { return sessionStorage.getItem('gnsi_cbt_welcome') === '1' } catch { return false } })
  const enter = () => { try { sessionStorage.setItem('gnsi_cbt_welcome', '1') } catch { /* storage blocked */ } setWelcomed(true); window.scrollTo?.(0, 0) }

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
  const demoDone = done => { setView({ test: run?.test || DEMO_TEST, attempt: done }); setPhase('result') }
  // practise a PAST exam: its real paper and key are fetched (only allowed once it is closed and its answers are out); marking happens here, nothing is saved
  const [practiceBusy, setPracticeBusy] = useState('')
  const startPractice = async id => {
    setErr(''); setPracticeBusy(id)
    try {
      const test = await practiceTest(id)
      setRun({ test, candidate: { name: 'Practice', roll: 'PRACTICE' }, remote: null, resume: null, demo: true }); setPhase('gate')
    } catch (e) { setErr(friendly(e)) }
    setPracticeBusy('')
  }

  if (phase === 'gate' || phase === 'exam') {
    return <CbtPlayer test={run.test} candidate={run.candidate} resume={run.resume} remote={run.remote} demo={!!run.demo} onSubmit={run.demo ? demoDone : submitted} onClose={() => { setPhase('landing'); setRun(null) }} />
  }
  if (phase === 'result' && view) {
    return <CbtResult test={view.test} attempt={view.attempt} closeLabel={run?.demo ? 'Back to the exam page' : 'Finish'} onClose={() => { if (run?.demo) { setRun(null); setView(null); setPhase('landing') } else setPhase('done') }} />
  }
  if (phase === 'done') {
    return (
      <div className="cbt cbt-page" style={{ maxWidth: 560 }}><style>{CBT_CSS}</style>
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}><h3>Thank you</h3><p className="muted">Your exam is complete. You can close this window.</p><a className="btn navy" style={{ textDecoration: 'none', display: 'inline-block' }} href="/">‹ Back to home</a></div>
      </div>
    )
  }

  const open = info?.state === 'open'
  if (!testId && !welcomed) {
    return (
      <div className="cbt cbt-page" style={{ maxWidth: 720 }}>
        <style>{CBT_CSS}</style>
        <CbtWelcome inst={inst} onStart={enter} onPractice={() => { enter(); startDemo() }} />
      </div>
    )
  }
  return (
    <div className="cbt cbt-page" style={{ maxWidth: 720 }}>
      <style>{CBT_CSS}</style>
      <div className="cbt-hero">
        <a className="cbt-home" href="/" aria-label="Back to the GNSI website home">‹ Back to home</a>
        <div className="eyebrow">{(inst.name || 'GNSI').toUpperCase()} · ONLINE EXAM</div>
        <h2>{info ? info.name : 'Online exam'}</h2>
        {info && <p>{total} questions · {info.durationMin} minutes · {info.marking.correct} mark{info.marking.correct === 1 ? '' : 's'} each{info.marking.wrong ? `, −${info.marking.wrong} for a wrong answer` : ', no negative marking'}</p>}
      </div>
      {!testId && <CbtFinder onPractice={startDemo} onPracticePast={startPractice} busyId={practiceBusy} />}
      {testId && !info && !err && <div className="card muted">Loading…</div>}
      {info && (!saved || !open) && <div className="card" style={{ background: '#f8fafc' }}><b>New to computer-based tests?</b> <span className="muted">{open ? 'Try a 4-minute practice test first — it is not counted and nothing is saved.' : 'You can still try the 4-minute practice test any time — it is not counted and nothing is saved.'}</span> <button className="btn" style={{ marginLeft: 6 }} onClick={startDemo}>Try the practice test</button></div>}
      {err && !(info && open && !saved) && <div className="card" role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{err}</div>}
      {info && info.state === 'closed' && <div className="card"><div style={{ color: '#b42318', fontWeight: 700 }}>This exam is closed.</div><div className="muted" style={{ margin: '6px 0 8px' }}>You can still practise it: take the same paper again in practice mode — nothing is recorded or counted.</div><button type="button" className="btn navy" disabled={!!practiceBusy} onClick={() => startPractice(testId)}>{practiceBusy ? 'Opening…' : 'Practise this exam →'}</button></div>}
      {info && info.state === 'not_open' && <div className="card" style={{ color: '#9a5b00', fontWeight: 700, textAlign: 'center' }}>This exam opens on {when(info.opensAt)}.{info.opensAt && <div style={{ marginTop: 10 }}><CbtCountdown to={info.opensAt} onDone={() => window.location.reload()} /></div>}</div>}
      {info && saved && (
        <div className="card" style={{ borderColor: '#bfe3c7', background: '#f1faf3' }}>
          <h3>Continue your exam</h3>
          <p className="muted">You started this exam on this device as <b>{saved.name}</b> ({saved.roll}). Your answers were saved as you went.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn gold" onClick={resume} disabled={busy}>{busy ? 'Opening…' : 'Continue / see my result'}</button>
            <button className="btn" type="button" disabled={busy} onClick={() => {
              if (!window.confirm(`Start fresh on this device?\n\nThis removes ${saved.name || 'the saved exam'} from this phone so someone else can begin. Answers already saved on the server are kept.`)) return
              try { localStorage.removeItem(savedKey(testId)); localStorage.removeItem(backupKey(testId)) } catch { /* storage blocked */ }
              window.location.reload()
            }}>Not me · start fresh</button>
          </div>
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

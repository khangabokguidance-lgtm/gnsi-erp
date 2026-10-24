// CbtPlayer.jsx — the candidate's exam screen, laid out like the SSC / TCS computer based test:
// instructions → declaration → exam (question + options on the left, colour-coded question palette on the
// right, section tabs, countdown clock, language switch) → summary → submit. CbtResult shows the score card.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import { cbtStore } from './cbtStore'
import {
  STATUS_LABEL, answersLocked, flatQuestions, newAttempt, statusOf, go, select, clear, mark, counts, neighbour, secondsLeft, clock, grade, keyStatus,
} from './lib/cbtEngine'
import { proctorOf, addEvent, faceStrikes, flagText, isShotKey, isBlockedKey, EVENT_LABEL } from './lib/cbtProctorLogic'
import { useCbtProctor } from './useCbtProctor'

const hasMm = test => flatQuestions(test).some(q => q.textMm || q.options.some(o => o.textMm))
const pick = (en, mm, lang) => (lang === 'mm' && mm ? mm : en)
const picsOf = q => (q.images?.length ? q.images : q.image ? [q.image] : [])
const LEGEND = ['answered', 'notAnswered', 'notVisited', 'marked', 'answeredMarked']
const Swatch = ({ s, n }) => <span className={`cbt-s ${s}`}>{n}</span>

// remote (online exam): { offset, begin(), save(a), submit(a) } — see CbtPublic.jsx. The paper then arrives from the
// server when the candidate starts, the clock follows the server, answers are saved to the server as they go, and
// the server marks the attempt. Without it everything stays on this computer.
export default function CbtPlayer({ test: testProp, candidate, resume, onSubmit, onClose, remote = null }) {
  const [liveTest, setLiveTest] = useState(null)
  const test = liveTest || testProp
  const mm = useMemo(() => hasMm(test), [test])
  const qs = useMemo(() => flatQuestions(test), [test])
  const cfg = proctorOf(test)
  const lock = answersLocked(test)
  const camOn = cfg.camera !== 'off'
  // a candidate who reopens an exam in progress goes through the camera check again before the paper is shown
  const [stage, setStage] = useState(resume ? (camOn ? 'camera' : 'exam') : 'instructions')
  const [a, setA] = useState(resume || null)
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState(null)       // 'summary' | 'confirm' | 'instructions'
  const [fs, setFs] = useState(15)
  const [agree, setAgree] = useState(false)
  const [toast, setToast] = useState('')
  const [drawer, setDrawer] = useState(false)      // phone: the question palette as a bottom sheet
  const [passOpen, setPassOpen] = useState(true)   // phone: the reading passage can be folded away
  const [busy, setBusy] = useState('')              // online: 'Starting…' / 'Submitting…'
  const [netErr, setNetErr] = useState('')          // online: a save that did not get through (retried)
  const [submitErr, setSubmitErr] = useState('')
  const [beginErr, setBeginErr] = useState('')
  const submitted = useRef(false)
  const started = useRef(false)
  const lastSwitch = useRef(0)
  const fullscreenWas = useRef(false)
  const aRef = useRef(a)
  useEffect(() => { aRef.current = a }, [a])

  const flash = t => { setToast(t); setTimeout(() => setToast(''), 3500) }
  const [cover, setCover] = useState('')           // shield: the exam is hidden (window left, screenshot key pressed)
  const proctorEvent = useCallback(kind => {
    setA(x => (x ? { ...x, proctor: addEvent(x.proctor, kind) } : x))
    const msg = { none: 'Your face is not visible. Sit in front of the camera.', multi: 'More than one person is in front of the camera. Only the candidate may be there.', away: 'Look at the screen. Looking away is recorded.', nocam: 'The camera stopped. Turn it back on.' }[kind]
    if (msg) { setToast(msg); setTimeout(() => setToast(''), 4500) }
  }, [])
  const cam = useCbtProctor({ enabled: camOn, running: stage === 'exam', onEvent: proctorEvent })
  const begin = async () => {
    if (started.current) return   // a double click must not start two attempts
    started.current = true
    if (remote) {
      setBusy('Starting the exam…'); setBeginErr('')
      try {
        const r = await remote.begin()
        setLiveTest(r.test); setA(r.attempt); setStage('exam')
        try { document.documentElement.requestFullscreen?.() } catch { /* not allowed — fine */ }
      } catch (e) { started.current = false; setBeginErr(e.message) }
      setBusy('')
      return
    }
    const att = newAttempt(test, candidate)
    att.lang = 'en'
    const first = go(att, att.current)
    setA(first); cbtStore.saveAttempt(first); setStage('exam')
    try { document.documentElement.requestFullscreen?.() } catch { /* not allowed — fine */ }
  }

  // clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const left = a ? secondsLeft(a, test, now + (remote?.offset || 0)) : test.durationMin * 60

  const finish = useCallback(async (auto = false) => {
    const cur = aRef.current
    if (!cur || submitted.current) return
    submitted.current = true
    if (remote) {
      // The server marks it. If the connection is down the exam stays open and tries again — nothing is lost.
      setBusy('Submitting your answers…'); setSubmitErr('')
      try {
        const res = await remote.submit({ ...cur })
        try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
        setBusy(''); onSubmit(res, test, cur)
      } catch (e) { submitted.current = false; setBusy(''); setSubmitErr(e.message) }
      return
    }
    const done = { ...cur, state: 'submitted', submittedAt: Date.now(), autoSubmitted: auto }
    done.score = grade(test, done.answers)
    await cbtStore.saveAttempt(done)
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
    onSubmit(done)
  }, [test, onSubmit, remote])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- submits when the clock reaches zero
  useEffect(() => { if (stage === 'exam' && a && left <= 0) finish(true) }, [stage, a, left, finish])
  // a failed online submit is retried every few seconds
  useEffect(() => {
    if (!submitErr) return
    const t = setTimeout(() => finish(left <= 0), 5000)
    return () => clearTimeout(t)
  }, [submitErr, left, finish])

  // autosave (so a refresh or a power cut loses nothing)
  useEffect(() => {
    if (stage !== 'exam' || !a || a.state !== 'inprogress') return
    // never overwrite the submitted copy with a late autosave
    const t = setTimeout(async () => {
      if (submitted.current) return
      if (!remote) { cbtStore.saveAttempt(a); return }
      try {
        const r = await remote.save(a)
        setNetErr('')
        if (r?.submitted) finish(true)          // the server's clock ran out first
      } catch (e) { setNetErr(e.message) }
    }, remote ? 1200 : 500)
    return () => clearTimeout(t)
  }, [a, stage, remote, finish])
  // while an online save keeps failing, try again every few seconds (answers are also kept on this device)
  useEffect(() => {
    if (!remote || !netErr || stage !== 'exam') return
    const t = setInterval(async () => {
      if (submitted.current || !aRef.current) return
      try { const r = await remote.save(aRef.current); setNetErr(''); if (r?.submitted) finish(true) } catch { /* still offline */ }
    }, 6000)
    return () => clearInterval(t)
  }, [remote, netErr, stage, finish])

  // leaving the screen is recorded
  useEffect(() => {
    if (stage !== 'exam') return
    const away = () => {
      if (submitted.current || Date.now() - lastSwitch.current < 1500) return
      lastSwitch.current = Date.now()
      setA(x => (x ? { ...x, switches: (x.switches || 0) + 1 } : x))
      flash('You left the exam screen. This has been recorded.')
    }
    const vis = () => { if (document.hidden) away() }
    const stop = e => { e.preventDefault(); e.returnValue = '' }
    // pressing Esc to leave full screen is recorded too
    const fsx = () => { if (!document.fullscreenElement && !submitted.current && fullscreenWas.current) away(); fullscreenWas.current = !!document.fullscreenElement }
    document.addEventListener('visibilitychange', vis); window.addEventListener('blur', away); window.addEventListener('beforeunload', stop); document.addEventListener('fullscreenchange', fsx)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', away); window.removeEventListener('beforeunload', stop); document.removeEventListener('fullscreenchange', fsx) }
  }, [stage])

  // reopening an exam in progress: start the camera straight away
  const startCam = cam.start, camPhase = cam.phase
  useEffect(() => { if (stage === 'camera' && resume && camPhase === 'idle') startCam() }, [stage, resume, camPhase, startCam])

  // strict camera check: too many warnings end the exam (what is answered so far is submitted)
  const strikes = faceStrikes(a?.proctor)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- submits when the warnings run out
    if (stage === 'exam' && cfg.camera === 'strict' && strikes >= cfg.maxStrikes) finish(true)
  }, [stage, cfg.camera, cfg.maxStrikes, strikes, finish])

  // shield: no copying, no printing, no developer tools; a screenshot shortcut or leaving the window hides the paper
  useEffect(() => {
    if (stage !== 'exam' || !cfg.shield) return
    let last = 0, hideTimer = null
    const log = kind => { if (Date.now() - last < 1000) return; last = Date.now(); setA(x => (x ? { ...x, proctor: addEvent(x.proctor, kind) } : x)) }
    const hide = msg => { setCover(msg); clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (document.hasFocus()) setCover('') }, 6000) }
    const down = e => {
      if (isShotKey(e)) {
        log('shot'); hide('Screenshots are not allowed. This has been recorded.')
        navigator.clipboard?.writeText('Screenshots are not allowed during the exam.')?.catch(() => {})
      } else if (isBlockedKey(e)) { e.preventDefault(); log('blocked') }
    }
    const up = e => { if (e.key === 'PrintScreen') down(e) }   // Windows only reports this one on key-up
    const stopIt = e => { e.preventDefault() }
    const out = () => setCover('The exam is hidden while this window is not in front. Click here to return.')
    const back = () => { if (document.hasFocus() && !document.hidden) setCover('') }
    const print = () => log('blocked')
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true)
    for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'selectstart']) document.addEventListener(ev, stopIt)
    window.addEventListener('blur', out); window.addEventListener('focus', back); document.addEventListener('visibilitychange', () => (document.hidden ? out() : back()))
    window.addEventListener('beforeprint', print)
    return () => {
      clearTimeout(hideTimer)
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true)
      for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'selectstart']) document.removeEventListener(ev, stopIt)
      window.removeEventListener('blur', out); window.removeEventListener('focus', back); window.removeEventListener('beforeprint', print)
    }
  }, [stage, cfg.shield])

  const q = a ? qs.find(x => x.no === a.current) : null
  const sec = q ? test.sections[q.sectionIndex] : null
  const lang = a?.lang || 'en'
  const open = no => { setA(x => go(x, no)); setDrawer(false) }
  const next = () => setA(x => go(x, neighbour(test, x.current, 1)))
  const prev = () => setA(x => go(x, neighbour(test, x.current, -1)))
  const choose = key => {
    if (lock && aRef.current?.answers[aRef.current.current]) { flash('Your answer for this question is locked. It cannot be changed.'); return }
    setA(x => select(go(x, x.current), x.current, key, lock))
  }
  const saveNext = () => { setA(x => go(mark(x, x.current, false), neighbour(test, x.current, 1))) }
  const markNext = () => { setA(x => go(mark(x, x.current, true), neighbour(test, x.current, 1))) }
  const clearIt = () => { if (lock && aRef.current?.answers[aRef.current.current]) { flash('A locked answer cannot be cleared.'); return } setA(x => clear(x, x.current, lock)) }

  useEffect(() => {
    if (stage !== 'exam' || modal) return
    const key = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'radio') return
      if (e.ctrlKey || e.metaKey || e.altKey) return   // Ctrl+C must not pick option C
      const k = e.key.toLowerCase()
      if (/^[a-d1-4]$/.test(k)) choose('ABCD'['abcd'.includes(k) ? 'abcd'.indexOf(k) : Number(k) - 1])
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }) // re-bound each render so it always sees the current question

  const shell = body => (
    <div className={`cbt cbt-exam${cfg.shield ? ' cbt-shield' : ''}`} onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()} style={{ '--fs': `${fs}px` }}>
      <style>{CBT_CSS}</style>{body}
      {camOn && (stage === 'camera' || stage === 'exam') && (
        <div className={`cbt-cam${stage === 'camera' ? ' big' : ''} s-${cam.status}`} aria-label="Camera check">
          <video ref={cam.videoRef} muted playsInline autoPlay />
          <span>{{ ok: '● Camera OK', none: '⚠ Face not visible', multi: '⚠ More than one person', away: '⚠ Look at the screen', nocam: '⚠ Camera stopped' }[cam.status]}{stage === 'exam' && cfg.camera === 'strict' ? ` · warnings ${strikes}/${cfg.maxStrikes}` : ''}</span>
        </div>
      )}
      {stage === 'exam' && camOn && cam.status !== 'ok' && cam.held >= 2000 && cam.phase === 'ready' && cfg.camera === 'strict' && <div className="cbt-cover" style={{ background: 'rgba(11,30,61,.94)' }}><div><b>{EVENT_LABEL[cam.status] || 'Camera check'}</b><br />Sit in front of the camera, alone, facing the screen. The exam continues when you are visible.</div></div>}
      {cover && <div className="cbt-cover" onClick={() => document.hasFocus() && setCover('')}><div>🔒 {cover}</div></div>}
    </div>
  )

  // ── camera check ──
  if (stage === 'camera') {
    const good = cam.phase === 'ready' && cam.okStreak >= 3
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel" style={{ textAlign: 'center' }}>
        <h3>Camera check</h3>
        <p style={{ fontSize: 14, lineHeight: 1.65, margin: '0 0 10px' }}>This exam uses your camera to make sure <b>only you</b> are in front of the screen. The video is <b>not recorded or sent anywhere</b> — the exam only counts the warnings (face not visible, another person, looking away).{cfg.camera === 'strict' ? ` After ${cfg.maxStrikes} warnings the exam is submitted automatically.` : ''}</p>
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: good ? '#146c3a' : '#9a5b00' }}>
          {cam.phase === 'starting' ? 'Starting the camera…' : cam.phase === 'error' ? cam.error : good ? '✓ Your face is visible. You are ready.' : cam.status === 'multi' ? 'More than one person is visible. Only the candidate may sit here.' : cam.status === 'away' ? 'Look straight at the screen.' : 'Sit in front of the camera so your face is fully visible, in good light.'}
        </p>
        <div className="cbt-row">
          {!resume && <button className="cbt-b" onClick={() => { cam.stop(); setStage('declaration') }}>‹ Previous</button>}
          {cam.phase === 'error' && <button className="cbt-b" onClick={cam.start}>Try the camera again</button>}
          <button className="cbt-b sub" style={{ width: 'auto', margin: 0, opacity: good ? 1 : .5 }} disabled={!good || !!busy} onClick={resume ? () => setStage('exam') : begin}>{busy || (resume ? 'Continue the exam' : 'I am ready to begin')}</button>
        </div>
        {beginErr && <p role="alert" style={{ color: '#b42318', fontWeight: 700, marginTop: 12 }}>{beginErr}</p>}
      </div></div>
    </>)
  }

  // ── instructions ──
  if (stage === 'instructions' || stage === 'declaration') {
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel">
        {stage === 'instructions' ? <>
          <h3 style={{ textAlign: 'center' }}>Instructions</h3>
          <p style={{ textAlign: 'center', margin: '0 0 12px' }}><b>Duration: {test.durationMin} minutes</b> · Maximum marks: {Math.round(flatQuestions(test).length * test.marking.correct * 100) / 100} · {flatQuestions(test).length} questions</p>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65 }}>{test.instructions}</div>
          <p style={{ margin: '14px 0 6px', fontWeight: 700 }}>Marking scheme</p>
          <p style={{ margin: 0, fontSize: 14 }}>Correct answer: <b style={{ color: '#146c3a' }}>+{test.marking.correct}</b> · Wrong answer: <b style={{ color: '#b42318' }}>{test.marking.wrong ? `−${test.marking.wrong}` : 'no negative marking'}</b> · Not answered: 0</p>
          {lock && <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700, color: '#b42318' }}>🔒 Answers are final: once you choose an option for a question it is locked and cannot be changed or cleared. Think before you click.</p>}
          <p style={{ margin: '14px 0 6px', fontWeight: 700 }}>Sections</p>
          <div className="tbl"><table><thead><tr><th>Section</th><th>Questions</th></tr></thead><tbody>{test.sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length} (Q{s.questions[0].no}–{s.questions.at(-1).no})</td></tr>)}</tbody></table></div>
          <div className="cbt-row">
            <button className="cbt-b" onClick={onClose}>Cancel</button>
            <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => setStage('declaration')}>Next ›</button>
          </div>
        </> : <>
          <h3 style={{ textAlign: 'center' }}>Declaration</h3>
          <label style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 5, width: 18, height: 18 }} />
            <span>I have read and understood the instructions. I will not use any unfair means, and I understand that leaving this screen during the test is recorded.{camOn ? ' I agree to my camera being used during the test to check that only I am in front of the screen.' : ''}{cfg.shield ? ' I will not copy, print or take screenshots of the paper.' : ''}</span>
          </label>
          <div className="cbt-row">
            <button className="cbt-b" onClick={() => setStage('instructions')}>‹ Previous</button>
            <button className="cbt-b sub" style={{ width: 'auto', margin: 0, opacity: agree ? 1 : .5 }} disabled={!agree || !!busy} onClick={camOn ? () => { setStage('camera'); cam.start() } : begin}>{busy || (camOn ? 'Next: camera check ›' : 'I am ready to begin')}</button>
          </div>
          {beginErr && <p role="alert" style={{ color: '#b42318', fontWeight: 700, marginTop: 12 }}>{beginErr}</p>}
        </>}
      </div></div>
    </>)
  }

  if (!a || !q) return null
  const low = left <= 300
  const inSec = qs.filter(x => x.sectionIndex === q.sectionIndex)
  const sel = a.answers[q.no]
  const marksOf = test.marking
  const secCounts = s => counts(a, qs.filter(x => x.sectionId === s.id))
  const all = counts(a, qs)

  const summaryTable = (
    <div className="tbl"><table>
      <thead><tr><th>Section</th><th>Questions</th><th>Answered</th><th>Not Answered</th><th>Marked for Review</th><th>Answered &amp; Marked</th><th>Not Visited</th></tr></thead>
      <tbody>{test.sections.map(s => { const c = secCounts(s); return <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length}</td><td>{c.answered}</td><td>{c.notAnswered}</td><td>{c.marked}</td><td>{c.answeredMarked}</td><td>{c.notVisited}</td></tr> })}</tbody>
    </table></div>
  )

  return shell(<>
    {toast && <div className="cbt-toast" role="alert">{toast}</div>}
    {remote && netErr && !submitErr && <div className="cbt-net" role="status">⚠ No connection — your answers are kept on this device and will be sent when it returns. Keep this page open.</div>}
    {busy && <div className="cbt-modal" style={{ zIndex: 3300 }}><div className="box" style={{ maxWidth: 360, textAlign: 'center' }}><h3>{busy}</h3><p className="muted">Please wait. Do not close this page.</p></div></div>}
    {submitErr && <div className="cbt-modal" style={{ zIndex: 3300 }}><div className="box" style={{ maxWidth: 420 }}><h3>Could not submit yet</h3><p style={{ fontSize: 14, lineHeight: 1.6 }}>{submitErr}</p><p className="muted">Your answers are safe. Trying again automatically — keep this page open.</p><div className="cbt-row"><button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => finish(left <= 0)}>Try now</button></div></div></div>}
    <div className="cbt-top">
      <div className="title">{test.name}</div>
      <span className={`cbt-timer${low ? ' low' : ''}`} aria-label="Time left">⏱ {clock(left)}</span>
      <div className="cbt-tools">
        <div className="cand"><span className="avatar">{(a.candidate.name || '?')[0].toUpperCase()}</span><span>{a.candidate.name}{a.candidate.roll ? <><br /><small>Roll: {a.candidate.roll}</small></> : null}</span></div>
        {mm && <select value={lang} onChange={e => setA(x => ({ ...x, lang: e.target.value }))} aria-label="Language"><option value="en">English</option><option value="mm">ꯃꯤꯇꯩꯂꯣꯟ (Meitei Mayek)</option></select>}
        <button className="sm" onClick={() => setFs(f => Math.max(12, f - 1))} aria-label="Smaller text">A−</button>
        <button className="sm" onClick={() => setFs(f => Math.min(24, f + 1))} aria-label="Larger text">A+</button>
        <button className="sm" onClick={() => setModal('instructions')} aria-label="Instructions"><span className="not-sm">Instructions</span><span className="only-sm">ⓘ Info</span></button>
      </div>
    </div>
    <div className="cbt-secbar" role="tablist" aria-label="Sections">
      {test.sections.map((s, i) => {
        const c = secCounts(s)
        return <button key={s.id} role="tab" aria-selected={q.sectionIndex === i} className={`cbt-sec${q.sectionIndex === i ? ' on' : ''}`} onClick={() => open(s.questions[0].no)}>{s.label ? `${s.label}: ` : ''}{pick(s.title, s.titleMm, lang) || `Section ${i + 1}`}<small>{c.answered + c.answeredMarked}/{s.questions.length}</small></button>
      })}
    </div>
    <div className="cbt-body">
      <div className="cbt-main">
        <div className="cbt-qhead">
          <span className="cbt-qno">Question No. <i>{q.no}</i><small>of {qs.length}</small></span>
          <span className="cbt-marks">Marks: <span className="p">+{marksOf.correct}</span> · <span className="n">{marksOf.wrong ? `−${marksOf.wrong}` : '0'}</span></span>
          <button className="cbt-palbtn" onClick={() => setDrawer(true)} aria-label="Open question palette">☰ Palette · {all.answered + all.answeredMarked}/{qs.length}</button>
        </div>
        <div className="cbt-qarea">
          {q.passage && <div className={`cbt-pass${passOpen ? ' open' : ''}`}>
            <button className="cbt-passbar" onClick={() => setPassOpen(o => !o)} aria-expanded={passOpen}><span>📖 PASSAGE</span><span>{passOpen ? 'Hide ▴' : 'Read ▾'}</span></button>
            <h5>PASSAGE</h5><div className={lang === 'mm' && q.passageMm ? 'mm' : ''}>{pick(q.passage, q.passageMm, lang)}</div>
          </div>}
          <div className="cbt-q">
            {q.no === sec.questions[0].no && (sec.directions || sec.directionsMm) && <div className={`cbt-dir${lang === 'mm' && sec.directionsMm ? ' mm' : ''}`}><b>Directions: </b>{pick(sec.directions, sec.directionsMm, lang)}</div>}
            {picsOf(q).map((src, i) => <img key={i} className="cbt-fig" src={src} alt={`Question ${q.no} figure ${i + 1}`} draggable={false} />)}
            {q.text && <div className={`cbt-qtext${lang === 'mm' && q.textMm ? ' mm' : ''}`}>{pick(q.text, q.textMm, lang)}</div>}
            {q.options.map(o => (
              <label key={o.key} className={`cbt-opt${sel === o.key ? ' on' : ''}`}>
                <input type="radio" name={`q${q.no}`} checked={sel === o.key} disabled={lock && !!sel && sel !== o.key} onChange={() => choose(o.key)} />
                <b>{o.key}.</b>
                <span className={lang === 'mm' && o.textMm ? 'mm' : ''}>{q.figure ? `Option ${o.key}` : pick(o.text, o.textMm, lang)}</span>
              </label>
            ))}
            {lock && <p className="cbt-lockmsg">{sel ? '🔒 Answer locked — it cannot be changed.' : '🔒 Answers are final: the first option you choose is locked.'}</p>}
          </div>
        </div>
        <div className="cbt-act">
          <button className="cbt-b mark b-mark" onClick={markNext}>Mark for Review &amp; Next</button>
          <button className="cbt-b b-clear" onClick={clearIt} disabled={lock && !!sel}>Clear Response</button>
          <span className="sp" />
          <button className="cbt-b b-prev" onClick={prev} disabled={q.no === qs[0].no}>‹ Previous</button>
          <button className="cbt-b save b-save" onClick={saveNext}>Save &amp; Next</button>
        </div>
      </div>
      {drawer && <div className="cbt-backdrop open" onClick={() => setDrawer(false)} />}
      <aside className={`cbt-side${drawer ? ' open' : ''}`} aria-label="Question palette">
        <div className="cbt-sheet-h"><span>Question palette</span><button onClick={() => setDrawer(false)} aria-label="Close palette">✕</button></div>
        <div className="cbt-legend">
          {LEGEND.map(s => <div key={s}><Swatch s={s} n={all[s]} />{STATUS_LABEL[s]}</div>)}
        </div>
        <div className="cbt-pal">
          <h5>{sec.label ? `Section ${sec.label}: ` : ''}{pick(sec.title, sec.titleMm, lang)}</h5>
          <div className="cbt-grid">
            {inSec.map(x => <button key={x.no} className={`cbt-n ${statusOf(a, x.no)}${x.no === q.no ? ' cur' : ''}`} onClick={() => open(x.no)} aria-label={`Question ${x.no}, ${STATUS_LABEL[statusOf(a, x.no)]}`}>{x.no}</button>)}
          </div>
        </div>
        <div className="foot"><button className="cbt-b sub" style={{ marginTop: 0 }} onClick={() => setModal('summary')}>Submit Test</button></div>
      </aside>
    </div>

    {modal === 'instructions' && <div className="cbt-modal" onClick={() => setModal(null)}><div className="box" onClick={e => e.stopPropagation()}><h3>Instructions</h3><div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{test.instructions}</div><div style={{ textAlign: 'right', marginTop: 14 }}><button className="cbt-b" onClick={() => setModal(null)}>Close</button></div></div></div>}
    {modal === 'summary' && <div className="cbt-modal"><div className="box">
      <h3 style={{ textAlign: 'center' }}>Exam Summary</h3>
      <p className="muted" style={{ textAlign: 'center' }}>Time left: <b>{clock(left)}</b></p>
      {summaryTable}
      <p style={{ fontSize: 13, marginTop: 12 }}>Answered and marked questions are counted for marking. Questions not answered carry no marks.</p>
      <div className="cbt-row">
        <button className="cbt-b" onClick={() => setModal(null)}>Go back to the exam</button>
        <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => setModal('confirm')}>Submit Test</button>
      </div>
    </div></div>}
    {modal === 'confirm' && <div className="cbt-modal"><div className="box" style={{ maxWidth: 460 }}>
      <h3>Submit the test?</h3>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>You have answered <b>{all.answered + all.answeredMarked}</b> of <b>{qs.length}</b> questions. Once you submit you cannot go back or change any answer.</p>
      <div className="cbt-row">
        <button className="cbt-b" onClick={() => setModal('summary')}>No</button>
        <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => finish(false)}>Yes, submit</button>
      </div>
    </div></div>}
  </>)
}

// ── Score card + answer review ───────────────────────────────────────────────
export function CbtResult({ test, attempt, onClose, admin = false, closeLabel = 'Close' }) {
  const ks = keyStatus(test)
  // With a key here the score is worked out fresh (so a key added later is used); otherwise the server's score is shown.
  const g = useMemo(() => (ks.set === 0 && attempt.score ? attempt.score : grade(test, attempt.answers)), [test, attempt, ks.set])
  const known = ks.set > 0 || !!attempt.score
  const complete = ks.complete || (ks.set === 0 && !!attempt.score?.complete)
  const [filter, setFilter] = useState('all')
  const [lang, setLang] = useState('en')
  const qs = useMemo(() => flatQuestions(test), [test])
  const visible = admin || test.showResult !== false
  const took = attempt.submittedAt ? Math.round((attempt.submittedAt - attempt.startedAt) / 60000) : null
  const rows = qs.filter(q => {
    const given = attempt.answers[q.no]
    return filter === 'all' || (filter === 'wrong' && given && q.answer && given !== q.answer) || (filter === 'skipped' && !given) || (filter === 'correct' && given && given === q.answer)
  })
  const stat = (l, v, c) => <div className="cbt-stat"><div className="muted">{l}</div><b style={{ color: c || '#14264a' }}>{v}</b></div>
  return (
    <div className="cbt cbt-exam" style={{ overflow: 'auto' }}>
      <style>{CBT_CSS}</style>
      <div className="cbt-top"><div className="title">{test.name} — {admin ? 'Result' : 'Test submitted'}</div><div className="cbt-tools"><button className="sm" onClick={onClose}>{closeLabel}</button></div></div>
      <div className="cbt-center" style={{ maxWidth: 940, userSelect: 'text' }}>
        <div className="panel">
          <h3>{attempt.candidate.name}{attempt.candidate.roll ? ` · ${attempt.candidate.roll}` : ''}</h3>
          <p className="muted">Started {new Date(attempt.startedAt).toLocaleString('en-IN')}{took !== null ? ` · took ${took} min` : ''}{attempt.autoSubmitted ? ' · submitted automatically when time ended' : ''}{attempt.switches ? ` · left the screen ${attempt.switches} time${attempt.switches === 1 ? '' : 's'}` : ''}{flagText(attempt.proctor) ? ` · camera / shield: ${flagText(attempt.proctor)}` : ''}</p>
          {!visible ? (
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>Your answers have been recorded. The result will be declared by the institute.</p>
          ) : <>
            {!admin && test.answersLater && <p style={{ background: '#eef2f9', border: '1px solid #c9d6ec', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>🔒 The correct answers and the question review will be shown after the exam closes. Open this link again later to see them.</p>}
            {!complete && <p style={{ background: '#fff4dc', border: '1px solid #f3d38a', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>⚠️ The answer key is {ks.set ? `set for ${ks.set} of ${ks.total} questions` : 'not set yet'}, so this score is {ks.set ? 'partial' : 'not available'}. Add the key under CBT Exam → Edit, then open the result again.</p>}
            <div className="cbt-stats">
              {stat('Score', known ? `${g.marks} / ${g.max}` : '—', '#146c3a')}
              {stat('Correct', g.correct, '#146c3a')}{stat('Wrong', g.wrong, '#b42318')}{stat('Not answered', g.skipped)}
              {stat('Accuracy', known ? `${g.accuracy}%` : '—')}
            </div>
            <div className="tbl"><table><thead><tr><th>Section</th><th className="num">Qs</th><th className="num">Tried</th><th className="num">Right</th><th className="num">Wrong</th><th className="num">Marks</th></tr></thead>
              <tbody>{g.sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td className="num">{s.total}</td><td className="num">{s.attempted}</td><td className="num">{s.correct}</td><td className="num">{s.wrong}</td><td className="num"><b>{s.marks}</b> / {s.max}</td></tr>)}</tbody></table></div>
            {(admin || test.showAnswers !== false) && <>
              <div style={{ display: 'flex', gap: 8, margin: '18px 0 10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <h3 style={{ margin: 0, flex: 1 }}>Answer review</h3>
                {['all', 'correct', 'wrong', 'skipped'].map(f => <button key={f} className={`btn${filter === f ? ' navy' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
                {hasMm(test) && <select className="in" style={{ width: 'auto' }} value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="mm">Meitei Mayek</option></select>}
              </div>
              {rows.map(q => {
                const given = attempt.answers[q.no], ok = given && given === q.answer
                return (
                  <div key={q.no} className="cbt-review" style={{ borderLeftColor: !given ? '#94a3b8' : !q.answer ? '#d9b566' : ok ? '#3a9d3a' : '#d9532c' }}>
                    <b>Q{q.no}.</b> <span className={`tag`} style={{ background: !given ? '#f1f5f9' : ok ? '#e7f6ec' : '#fde8e6', color: !given ? '#475569' : ok ? '#146c3a' : '#b42318' }}>{!given ? 'Not answered' : !q.answer ? 'No key' : ok ? 'Correct' : 'Wrong'}</span>
                    {q.passage && <div className="muted" style={{ margin: '6px 0' }}>Passage: {pick(q.passage, q.passageMm, lang).slice(0, 160)}…</div>}
                    {picsOf(q).map((src, i) => <img key={i} className="cbt-fig" style={{ maxHeight: 220, margin: '8px 0' }} src={src} alt={`Question ${q.no} figure ${i + 1}`} />)}
                    {q.text && <div className={lang === 'mm' && q.textMm ? 'mm' : ''} style={{ whiteSpace: 'pre-wrap', margin: '6px 0', fontWeight: 600 }}>{pick(q.text, q.textMm, lang)}</div>}
                    <div style={{ display: 'grid', gap: 4 }}>
                      {q.options.map(o => <div key={o.key} className={lang === 'mm' && o.textMm ? 'mm' : ''} style={{ padding: '4px 8px', borderRadius: 4, background: o.key === q.answer ? '#e7f6ec' : o.key === given ? '#fde8e6' : 'transparent', fontWeight: o.key === q.answer || o.key === given ? 700 : 400 }}>{o.key}. {q.figure ? `Option ${o.key}` : pick(o.text, o.textMm, lang)}{o.key === q.answer ? '  ✓ correct' : ''}{o.key === given && o.key !== q.answer ? '  ✗ your answer' : ''}{o.key === given && o.key === q.answer ? '  (your answer)' : ''}</div>)}
                    </div>
                  </div>
                )
              })}
              {rows.length === 0 && <p className="muted">No questions to show.</p>}
            </>}
          </>}
        </div>
      </div>
    </div>
  )
}

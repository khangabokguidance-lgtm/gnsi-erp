// CbtPlayer.jsx — the candidate's exam screen, laid out like the SSC / TCS computer based test:
// instructions → declaration → exam (question + options on the left, colour-coded question palette on the
// right, section tabs, countdown clock, language switch) → summary → submit. CbtResult shows the score card.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CBT_CSS } from './cbtCss'
import { cbtStore } from './cbtStore'
import {
  STATUS_LABEL, answersLocked, settle, flatQuestions, newAttempt, statusOf, go, select, clear, mark, counts, neighbour, secondsLeft, clock, grade, keyStatus,
} from './lib/cbtEngine'
import { proctorOf, addEvent, faceStrikes, flagText, isShotKey, isBlockedKey, EVENT_LABEL } from './lib/cbtProctorLogic'
import { useCbtProctor } from './useCbtProctor'
import { presentTest, isShuffled } from './lib/cbtShuffle'
import { fsExits } from './lib/cbtProctorLogic'
import { sectionTimed, settleSection, nextSection } from './lib/cbtSections'
import { Calculator, RoughPad } from './CbtTools'
import { BmeiText } from './MayekBmei'
import { useStaffPhotos, findWebsitePhoto } from './staffPhotos'

// The founder's welcome (same person, photo and message as the website's founder section).
const FOUNDER = {
  name: 'Moirangthem Himan Singh', role: 'Founder & Head of the Institute · GNSI',
  photo: 'https://i.postimg.cc/Vsd7VXZ7/DSC05195.jpg',
  quote: 'Every child who walks into GNSI carries the potential to serve the nation. Our responsibility is to ensure that potential is never wasted for lack of opportunity or preparation.',
}
const hasMm = test => flatQuestions(test).some(q => q.textMm || q.options.some(o => o.textMm))
const pickRaw = (en, mm, lang) => (lang === 'mm' && mm ? mm : en)
// Meitei Mayek is drawn in the BMEI04 (Bmei) font; English stays as plain text.
const pick = (en, mm, lang) => (lang === 'mm' && mm ? <BmeiText text={mm} /> : en)
const picsOf = q => (q.images?.length ? q.images : q.image ? [q.image] : [])
const LEGEND = ['answered', 'notAnswered', 'notVisited', 'marked', 'answeredMarked']
const Swatch = ({ s, n }) => <span className={`cbt-s ${s}`}>{n}</span>

// remote (online exam): { offset, begin(), save(a), submit(a) } — see CbtPublic.jsx. The paper then arrives from the
// server when the candidate starts, the clock follows the server, answers are saved to the server as they go, and
// the server marks the attempt. Without it everything stays on this computer.
export default function CbtPlayer({ test: testProp, candidate, resume, onSubmit, onClose, remote = null, demo = false }) {
  const [liveTest, setLiveTest] = useState(null)
  const baseTest = liveTest || testProp
  const cfg = proctorOf(baseTest)
  const lock = answersLocked(baseTest)
  const camOn = cfg.camera !== 'off'
  // a candidate who reopens an exam in progress goes through the camera check again before the paper is shown
  const [stage, setStage] = useState(resume ? (camOn ? 'camera' : 'exam') : 'intro')
  const [islide, setIslide] = useState(0)            // instructions: which slide is showing
  const [idir, setIdir] = useState('fwd')            // …and which way it slid in
  // Phones: the page must follow the REAL visible area. When the keyboard or the browser bar opens, or the visible area
  // pans, a fixed full-screen page can end up shifted up with an empty gap below ("the screen goes up"). The exam is
  // sized and placed from the visual viewport, the page behind it cannot scroll, and the keyboard is closed on each step.
  useEffect(() => {
    const de = document.documentElement, body = document.body, vv = window.visualViewport
    const prev = [de.style.overflow, body.style.overflow, de.style.overscrollBehavior, body.style.overscrollBehavior]
    de.style.overflow = 'hidden'; body.style.overflow = 'hidden'; de.style.overscrollBehavior = 'none'; body.style.overscrollBehavior = 'none'
    const fit = () => {
      const h = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0
      de.style.setProperty('--cbt-h', `${Math.round(h)}px`); de.style.setProperty('--cbt-top', `${Math.round(top)}px`)
    }
    fit()
    vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); window.addEventListener('orientationchange', fit)
    return () => {
      vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); window.removeEventListener('orientationchange', fit)
      de.style.overflow = prev[0]; body.style.overflow = prev[1]; de.style.overscrollBehavior = prev[2]; body.style.overscrollBehavior = prev[3]
      de.style.removeProperty('--cbt-h'); de.style.removeProperty('--cbt-top')
    }
  }, [])
  useEffect(() => { if (stage !== 'exam' && stage !== 'intro') return; try { const el = document.activeElement; if (el && /^(TEXTAREA|INPUT)$/.test(el.tagName)) el.blur() } catch { /* ignore */ } }, [stage])
  useStaffPhotos()                                    // loads the photos (and re-renders when they arrive)
  const [a, setA] = useState(resume || null)
  // each candidate sees their own order when the test asks for it (seeded by the attempt id, so a reload looks the same)
  const test = useMemo(() => presentTest(baseTest, a?.id), [baseTest, a?.id])
  const mm = useMemo(() => hasMm(test), [test])
  const qs = useMemo(() => flatQuestions(test), [test])
  const dn = x => x.pos ?? x.no                      // the number shown on screen
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState(null)       // 'summary' | 'confirm' | 'instructions'
  const [fs, setFs] = useState(15)
  const [agree, setAgree] = useState(false)
  const [toast, setToast] = useState('')
  const [drawer, setDrawer] = useState(false)      // phone: the question palette as a bottom sheet
  const [readerNo, setReaderNo] = useState(null)   // question the full-screen passage reader was opened on
  const [rfs, setRfs] = useState(17)                // passage text size (px)
  const curNo = a?.current
  const reader = readerNo !== null && readerNo === curNo   // moving to another question closes it
  const setReader = open => setReaderNo(open ? curNo : null)
  const readerRef = useRef(null)
  useEffect(() => {                                    // reader: Escape closes it; focus moves in, and back to the passage button after
    if (!reader) return undefined
    const prev = document.activeElement
    try { readerRef.current?.querySelector('button')?.focus({ preventScroll: true }) } catch { /* ignore */ }
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setReaderNo(null) } }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); try { if (prev && prev.isConnected) prev.focus({ preventScroll: true }) } catch { /* ignore */ } }
  }, [reader])
  const secbarRef = useRef(null)
  useEffect(() => {                                    // keep the open section's tab in view on a phone
    try { const el = secbarRef.current?.querySelector('.cbt-sec.on'); el?.scrollIntoView({ block: 'nearest', inline: 'center' }) } catch { /* old browser */ }
  }, [curNo])
  const [busy, setBusy] = useState('')              // online: 'Starting…' / 'Submitting…'
  const [netErr, setNetErr] = useState('')          // online: a save that did not get through (retried)
  const [submitErr, setSubmitErr] = useState('')
  const [beginErr, setBeginErr] = useState('')
  const [kicked, setKicked] = useState('')            // online: the attempt was taken over by another device
  const [fsOut, setFsOut] = useState(false)          // full screen was left — the paper is covered until they return
  const [saveInfo, setSaveInfo] = useState({ state: 'idle', at: 0 })   // 'saving' | 'saved' | 'offline'
  const [hc, setHc] = useState(false)                // high-contrast display
  const [tool, setTool] = useState(null)             // 'calc' | 'rough'
  const [rough, setRough] = useState('')
  const tools = baseTest.marking?.tools || {}
  const fsOn = cfg.fullscreen !== 'off' && typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  const minMin = Number(baseTest.marking?.minMinutes) || 0   // earliest submit (minutes after the start); 0 = none
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
    const msg = { fsexit: 'You left full screen. This has been recorded — return to full screen to continue.', none: 'Your face is not visible. Sit in front of the camera.', far: 'You are too far from the camera. Sit closer so your face fills the picture.', vcam: 'A virtual camera was detected. This has been recorded.', multi: 'More than one person is in front of the camera. Only the candidate may be there.', away: 'Look at the screen. Looking away is recorded.', nocam: 'The camera stopped. Turn it back on.' }[kind]
    if (msg) { setToast(msg); setTimeout(() => setToast(''), 4500) }
  }, [])
  const cam = useCbtProctor({ enabled: camOn, running: stage === 'exam', onEvent: proctorEvent, strict: cfg.camera === 'strict' })
  // a brand new attempt starts on the first question the candidate will SEE (their own order may differ)
  const startAt = (t, att) => {
    if (!isShuffled(t) || Object.keys(att.answers || {}).length || Object.keys(att.marked || {}).length) return att
    const no = flatQuestions(presentTest(t, att.id))[0]?.no
    return no == null ? att : { ...att, current: no, visited: { [no]: true } }
  }
  // Close the on-screen keyboard (a field from an earlier step can keep it open on a phone, which squeezes the exam).
  const dropKeyboard = () => { try { const el = document.activeElement; if (el && el !== document.body) el.blur() } catch { /* ignore */ } }
  const begin = async () => {
    if (started.current) return   // a double click must not start two attempts
    started.current = true
    dropKeyboard()
    if (remote) {
      setBusy('Starting the exam…'); setBeginErr('')
      try {
        const r = await remote.begin()
        setLiveTest(r.test); setA({ ...startAt(r.test, r.attempt), lastAt: Date.now() }); setStage('exam')
        try { document.documentElement.requestFullscreen?.() } catch { /* not allowed — fine */ }
      } catch (e) { started.current = false; setBeginErr(e.message) }
      setBusy('')
      return
    }
    const att = newAttempt(test, candidate)
    att.lang = 'en'
    const first = go(startAt(test, att), startAt(test, att).current)
    setA(first); !demo && cbtStore.saveAttempt(first); setStage('exam')
    try { document.documentElement.requestFullscreen?.() } catch { /* not allowed — fine */ }
  }

  // clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const left = a ? secondsLeft(a, test, now + (remote?.offset || 0)) : test.durationMin * 60

  const finish = useCallback(async (auto = false) => {
    const cur = aRef.current && settle(aRef.current)
    if (!cur || submitted.current) return
    if (!auto && minMin > 0 && (Date.now() + (remote?.offset || 0) - cur.startedAt) < minMin * 60000) { flash(`You can submit only after ${minMin} minutes. Keep going until then.`); return }
    submitted.current = true
    if (remote) {
      // The server marks it. If the connection is down the exam stays open and tries again — nothing is lost.
      setBusy('Submitting your answers…'); setSubmitErr('')
      try {
        const res = await remote.submit({ ...cur })
        try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
        setBusy(''); onSubmit(res, test, cur)
      } catch (e) {
        submitted.current = false; setBusy('')
        if (e.code === 'SESSION') setKicked(e.message)
        else if (e.code === 'EARLY') flash(e.message)        // too early to submit: not retried
        else setSubmitErr(e.message)
      }
      return
    }
    const done = { ...cur, state: 'submitted', submittedAt: Date.now(), autoSubmitted: auto }
    done.score = grade(test, done.answers)
    if (!demo) await cbtStore.saveAttempt(done)
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
    onSubmit(done)
  }, [test, onSubmit, remote, minMin, demo])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- submits when the clock reaches zero
  useEffect(() => { if (stage === 'exam' && a && left <= 0) finish(true) }, [stage, a, left, finish])
  // a failed online submit is retried every few seconds
  useEffect(() => {
    if (!submitErr || kicked) return
    const t = setTimeout(() => finish(left <= 0), 5000)
    return () => clearTimeout(t)
  }, [submitErr, left, finish, kicked])

  // autosave (so a refresh or a power cut loses nothing)
  useEffect(() => {
    if (stage !== 'exam' || !a || a.state !== 'inprogress') return
    // never overwrite the submitted copy with a late autosave
    const t = setTimeout(async () => {
      if (submitted.current || kicked) return
      if (!remote) { if (!demo) cbtStore.saveAttempt(a); setSaveInfo({ state: 'saved', at: Date.now() }); return }
      setSaveInfo(x => ({ ...x, state: 'saving' }))
      try {
        const r = await remote.save(a)
        setNetErr(''); setSaveInfo({ state: 'saved', at: Date.now() })
        if (r?.extraSeconds != null) setA(x => (x && (x.extraSeconds || 0) !== r.extraSeconds ? { ...x, extraSeconds: r.extraSeconds, ...(x.sec ? { sec: { ...x.sec, at: x.sec.at + (r.extraSeconds - (x.extraSeconds || 0)) * 1000 } } : {}) } : x))   // staff gave extra time
        if (r?.submitted) finish(true)          // the server's clock ran out first
      } catch (e) { if (e.code === 'SESSION') setKicked(e.message); else { setNetErr(e.message); setSaveInfo(x => ({ ...x, state: 'offline' })) } }
    }, remote ? 1200 : 500)
    return () => clearTimeout(t)
  }, [a, stage, remote, finish, kicked, demo])
  // heartbeat: save every 30 s even when nothing changed, so staff can tell "thinking" from "dropped off" (Live tab)
  useEffect(() => {
    if (!remote || stage !== 'exam') return
    const t = setInterval(async () => {
      if (submitted.current || !aRef.current || kicked) return
      try {
        const r = await remote.save(aRef.current); setNetErr(''); setSaveInfo({ state: 'saved', at: Date.now() })
        if (r?.extraSeconds != null) setA(x => (x && (x.extraSeconds || 0) !== r.extraSeconds ? { ...x, extraSeconds: r.extraSeconds, ...(x.sec ? { sec: { ...x.sec, at: x.sec.at + (r.extraSeconds - (x.extraSeconds || 0)) * 1000 } } : {}) } : x))
        if (r?.submitted) finish(true)
      } catch (e) { if (e.code === 'SESSION') setKicked(e.message); else { setNetErr(e.message); setSaveInfo(x => ({ ...x, state: 'offline' })) } }
    }, 30000 + Math.floor(Math.random() * 5000))   // a little jitter so a whole batch does not save in the same second
    return () => clearInterval(t)
  }, [remote, stage, kicked, finish])
  // while an online save keeps failing, try again every few seconds (answers are also kept on this device)
  useEffect(() => {
    if (!remote || !netErr || stage !== 'exam') return
    const t = setInterval(async () => {
      if (submitted.current || !aRef.current || kicked) return
      try { const r = await remote.save(aRef.current); setNetErr(''); setSaveInfo({ state: 'saved', at: Date.now() }); if (r?.submitted) finish(true) } catch (e) { if (e.code === 'SESSION') setKicked(e.message) /* else still offline */ }
    }, 6000)
    return () => clearInterval(t)
  }, [remote, netErr, stage, finish, kicked])

  // leaving the screen is recorded
  useEffect(() => {
    if (stage !== 'exam') return
    const away = () => {
      if (submitted.current || Date.now() - lastSwitch.current < 1500) return
      lastSwitch.current = Date.now()
      setA(x => (x ? { ...x, switches: (x.switches || 0) + 1 } : x))
      flash('You left the exam screen. This has been recorded.')
      // browsers with no full-screen support (iPhone / iPad) cannot be held in full screen, so leaving the page counts as the exit
      if (cfg.fullscreen !== 'off' && !document.documentElement.requestFullscreen) proctorEvent('fsexit')
    }
    const vis = () => { if (document.hidden) away() }
    const stop = e => { e.preventDefault(); e.returnValue = '' }
    // pressing Esc to leave full screen is recorded too
    const fsx = () => {
      const inFs = !!document.fullscreenElement
      if (!inFs && !submitted.current && fullscreenWas.current) { away(); if (fsOn) { proctorEvent('fsexit'); setFsOut(true) } }
      if (inFs) setFsOut(false)
      fullscreenWas.current = inFs
    }
    document.addEventListener('visibilitychange', vis); window.addEventListener('blur', away); window.addEventListener('beforeunload', stop); document.addEventListener('fullscreenchange', fsx)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', away); window.removeEventListener('beforeunload', stop); document.removeEventListener('fullscreenchange', fsx) }
  }, [stage, fsOn, proctorEvent, cfg.fullscreen])

  // full screen asked for: if the exam opened without it (a reload, or the browser said no), cover the paper until they enter
  useEffect(() => {
    if (stage !== 'exam' || !fsOn) return
    const t = setTimeout(() => { if (!document.fullscreenElement && !submitted.current) setFsOut(true); else fullscreenWas.current = !!document.fullscreenElement }, 600)
    return () => clearTimeout(t)
  }, [stage, fsOn])
  const backToFs = () => { try { document.documentElement.requestFullscreen?.().then(() => setFsOut(false)).catch(() => flash('Your browser did not allow full screen. Try again.')) } catch { flash('Your browser did not allow full screen.') } }
  // strict mode: too many exits end the exam (what is answered so far is submitted)
  const fsCount = fsExits(a?.proctor)
  useEffect(() => { if (stage === 'exam' && cfg.fullscreen === 'strict' && fsCount >= cfg.maxFsExits && !submitted.current) { flash('Too many full-screen exits — your exam is being submitted.'); finish(true) } }, [stage, cfg.fullscreen, cfg.maxFsExits, fsCount, finish])

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

  // ── per-section time limits: sections open in order; an earlier one cannot be reopened ──
  const secOn = sectionTimed(baseTest)
  const nowS = now + (remote?.offset || 0)
  const secNow = secOn && a ? settleSection(a.sec || { i: 0, at: a.startedAt }, test, nowS) : null
  const firstOf = i => qs.find(x => x.sectionIndex === i)?.no
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs every tick on purpose: opens the next section / ends the exam when a section's time is up
  useEffect(() => {
    if (stage !== 'exam' || !secOn || !a) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick of a timed exam: record when section 1 opened
    if (!a.sec) { setA(x => (x && !x.sec ? { ...x, sec: { i: 0, at: x.startedAt } } : x)); return }
    const st = settleSection(a.sec, test, nowS)
    if (st.over && !submitted.current) { flash('Time for the last section is over — submitting.'); finish(true); return }
    if (st.i !== a.sec.i) {
      flash('Time for that section is over. The next section is now open.')
      setA(x => go({ ...x, sec: { i: st.i, at: st.at } }, firstOf(st.i) ?? x.current))
    }
  }) // checked every second (the clock re-renders)
  const curSec = secOn ? (secNow?.i ?? 0) : null
  const moveOn = () => { setModal(null); setA(x => go({ ...x, sec: nextSection(x.sec || { i: 0, at: x.startedAt }, test, nowS + 0) }, firstOf(Math.min((x.sec?.i ?? 0) + 1, test.sections.length - 1)) ?? x.current)) }
  const q = a ? qs.find(x => x.no === a.current) : null
  const sec = q ? test.sections[q.sectionIndex] : null
  const lang = a?.lang || 'en'
  const noSec = no => qs.find(x => x.no === no)?.sectionIndex
  const open = no => { if (curSec !== null && noSec(no) !== curSec) return; setA(x => go(x, no)); setDrawer(false) }
  // a step that would cross into another section: forward asks first (and cannot be undone), backward is refused
  const step = (dir, after = x => x) => {
    const cur = aRef.current; if (!cur) return
    const to = neighbour(test, cur.current, dir)
    if (curSec !== null && noSec(to) !== curSec) {
      if (dir > 0 && to !== cur.current) { setA(after); setModal('nextsec') } else if (dir < 0) flash('You cannot go back to an earlier section.')
      return
    }
    setA(x => go(after(x), to))
  }
  const next = () => step(1)
  const prev = () => step(-1)
  const choose = key => {
    if (lock && aRef.current?.answers[aRef.current.current]) { flash('Your answer for this question is locked. It cannot be changed.'); return }
    setA(x => select(go(x, x.current), x.current, key, lock))
  }
  const saveNext = () => step(1, x => mark(x, x.current, false))
  const markNext = () => step(1, x => mark(x, x.current, true))
  const clearIt = () => { if (lock && aRef.current?.answers[aRef.current.current]) { flash('A locked answer cannot be cleared.'); return } setA(x => clear(x, x.current, lock)) }

  useEffect(() => {
    if (stage !== 'exam' || modal) return
    const key = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'radio') return
      if (e.ctrlKey || e.metaKey || e.altKey) return   // Ctrl+C must not pick option C
      const k = e.key.toLowerCase()
      if (/^[a-d1-4]$/.test(k)) { const lab = 'ABCD'['abcd'.includes(k) ? 'abcd'.indexOf(k) : Number(k) - 1]; const o = q?.options.find(x => (x.label || x.key) === lab); if (o) choose(o.key) }
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }) // re-bound each render so it always sees the current question

  const shell = body => (
    <div className={`cbt cbt-exam${cfg.shield ? ' cbt-shield' : ''}${hc ? ' cbt-hc' : ''}`} onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()} style={{ '--fs': `${fs}px` }}>
      <style>{CBT_CSS}</style>
      {/* keyed by the step, so each step (instructions → declaration → camera → paper) slides in afresh */}
      <Fragment key={stage}>{body}</Fragment>
      {camOn && (stage === 'camera' || stage === 'exam') && (
        <div className={`cbt-cam${stage === 'camera' ? ' big' : ''} s-${cam.status}`} aria-label="Camera check">
          <video ref={cam.videoRef} muted playsInline autoPlay />
          <span>{{ ok: '● Camera OK', none: '⚠ Face not visible', far: '⚠ Move closer', multi: '⚠ More than one person', away: '⚠ Look at the screen', nocam: '⚠ Camera stopped' }[cam.status]}{stage === 'exam' && cfg.camera === 'strict' ? ` · warnings ${strikes}/${cfg.maxStrikes}` : ''}</span>
        </div>
      )}
      {stage === 'exam' && camOn && cam.status !== 'ok' && cam.held >= 2000 && cam.phase === 'ready' && cfg.camera === 'strict' && <div className="cbt-cover" style={{ background: 'rgba(11,30,61,.94)' }}><div><b>{EVENT_LABEL[cam.status] || 'Camera check'}</b><br />Sit in front of the camera, alone, facing the screen. The exam continues when you are visible.</div></div>}
      {cover && <div className="cbt-cover" onClick={() => document.hasFocus() && setCover('')}><div>🔒 {cover}</div></div>}
    </div>
  )

  // ── camera check ──
  if (stage === 'camera') {
    const good = cam.phase === 'ready' && cam.okStreak >= 5          // ~4 s of steady, good frames
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel" style={{ textAlign: 'center' }}>
        <h3>Camera check</h3>
        <p style={{ fontSize: 14, lineHeight: 1.65, margin: '0 0 10px' }}>This exam uses your camera to make sure <b>only you</b> are in front of the screen. The video is <b>not recorded or sent anywhere</b> — the exam only counts the warnings (face not visible, another person, looking away).{cfg.camera === 'strict' ? ` After ${cfg.maxStrikes} warnings the exam is submitted automatically.` : ''}</p>
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: good ? '#146c3a' : '#9a5b00' }}>
          {cam.phase === 'starting' ? 'Starting the camera…' : cam.phase === 'error' ? cam.error : good ? '✓ Your face is visible. You are ready.' : cam.status === 'multi' ? 'More than one person is visible. Only the candidate may sit here.' : cam.status === 'away' ? 'Look straight at the screen.' : cam.status === 'far' ? 'Move closer to the camera so your face fills the picture.' : cam.status === 'nocam' ? 'The camera picture has stopped. Check the camera is on and not covered.' : 'Sit in front of the camera so your face is fully visible, in good light.'}
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

  // ── premium introduction ──
  if (stage === 'intro') {
    const nQ = flatQuestions(test).length
    const maxM = Math.round(nQ * test.marking.correct * 100) / 100
    return shell(
      <div className="cbt-intro">
        <div className="cbt-intro-card">
          <img className="cbt-intro-mark" src="/gnsi-mark.webp" alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
          <div className="cbt-intro-kicker">Guidance Navodaya &amp; Sainik Institute</div>
          <h1>{test.name}</h1>
          <div className="cbt-intro-rule" />
          <p className="cbt-intro-hi">Welcome, <b>{candidate.name}</b>{candidate.roll ? ` · Roll ${candidate.roll}` : ''}</p>
          <div className="cbt-intro-stats">
            <div><b>{nQ}</b><span>Questions</span></div>
            <div><b>{test.durationMin}</b><span>Minutes</span></div>
            <div><b>{maxM}</b><span>Maximum marks</span></div>
            <div><b>{test.sections.length}</b><span>{test.sections.length === 1 ? 'Section' : 'Sections'}</span></div>
          </div>
          <p className="cbt-intro-note">The instructions come next, one at a time. Read each one carefully — the test begins only after you accept the declaration.</p>
          <div className="cbt-intro-actions">
            <button className="cbt-b" onClick={onClose}>Cancel</button>
            <button className="cbt-b gold" onClick={() => { setIdir('fwd'); setIslide(0); setStage('instructions') }}>Read the instructions ›</button>
          </div>
        </div>
      </div>)
  }

  // ── instructions, slide by slide ──
  if (stage === 'instructions') {
    const nQ = flatQuestions(test).length
    const maxM = Math.round(nQ * test.marking.correct * 100) / 100
    // The founder's photo comes from the website's staff (Faculty) photos, matched by name; the website's founder photo is the fallback.
    const founderPhoto = [FOUNDER.name, 'Himan Singh', 'Himan'].map(n => findWebsitePhoto(n)).find(Boolean) || FOUNDER.photo
    const slides = [
      { key: 'founder', icon: '🎓', kicker: 'From our Founder', title: 'A message to every candidate', body: <div className="cbt-founder">
        <div className="cbt-founder-pic" key={founderPhoto}>
          <img src={founderPhoto} alt={FOUNDER.name} onError={e => { e.currentTarget.parentNode.classList.add('nophoto') }} />
          <span aria-hidden="true">{FOUNDER.name[0]}</span>
        </div>
        <div className="cbt-founder-txt">
          <blockquote>&ldquo;{FOUNDER.quote}&rdquo;</blockquote>
          <div className="cbt-founder-by"><b>{FOUNDER.name}</b><span>{FOUNDER.role}</span></div>
          <div className="cbt-founder-built"><span aria-hidden="true">💻</span><span>This exam portal was <b>designed and built by {FOUNDER.name} himself</b> — the result of much effort, made for the students of GNSI.</span></div>
          <p>Established 2016 · Khangabok, Manipur. We wish you the very best for this test.</p>
        </div>
      </div> },
      { key: 'about', icon: '📋', title: 'About this test', body: <>
        <div className="cbt-facts"><div><b>{test.durationMin} min</b><span>Duration</span></div><div><b>{nQ}</b><span>Questions</span></div><div><b>{maxM}</b><span>Maximum marks</span></div></div>
        <div className="tbl"><table><thead><tr><th>Section</th><th>Questions</th></tr></thead><tbody>{test.sections.map(s => <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length} (Q{s.questions[0].no}–{s.questions.at(-1).no})</td></tr>)}</tbody></table></div>
      </> },
      { key: 'rules', icon: '📝', title: 'General instructions', show: !!String(test.instructions || '').trim(), body: <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>{test.instructions}</div> },
      { key: 'marking', icon: '🎯', title: 'Marking scheme', body: <>
        <div className="cbt-mcards">
          <div><b style={{ color: '#146c3a' }}>+{test.marking.correct}</b>Correct answer</div>
          <div><b style={{ color: '#b42318' }}>{test.marking.wrong ? `−${test.marking.wrong}` : '0'}</b>{test.marking.wrong ? 'Wrong answer' : 'Wrong answer — no negative marking'}</div>
          <div><b>0</b>Not answered</div>
        </div>
        {minMin > 0 && <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700, color: '#9a5b00' }}>⏳ You can submit the test only after {minMin} minutes.</p>}
        {lock && <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700, color: '#b42318' }}>🔒 Answers are final: once you choose an option for a question it is locked and cannot be changed or cleared. Think before you click.</p>}
      </> },
      { key: 'palette', icon: '🎨', title: 'The question palette', body: <>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6 }}>The palette on the right of the paper shows every question. Click a number to jump to it. The colour shows where you stand:</p>
        <div className="cbt-leg">{LEGEND.map(s => <div key={s}><Swatch s={s} n={s === 'answeredMarked' ? '✓' : ''} />{STATUS_LABEL[s]}</div>)}</div>
      </> },
      { key: 'buttons', icon: '🖱️', title: 'Answering & moving around', body: <ul className="cbt-bul">
        <li><span>✅</span><span><b>Save &amp; Next</b> — saves your answer and opens the next question.</span></li>
        <li><span>🔖</span><span><b>Mark for Review &amp; Next</b> — keeps the question flagged so you can come back to it.</span></li>
        <li><span>↩️</span><span><b>Clear Response</b> — removes the option you picked{lock ? ' (not allowed in this test: answers are final)' : ''}.</span></li>
        <li><span>⏱️</span><span>The clock at the top shows the time left. The test is submitted automatically when it reaches zero.</span></li>
        {mm && <li><span>🌐</span><span>Use the language button at the top to switch between English and Meitei Mayek.</span></li>}
        {(tools.calc || tools.rough) && <li><span>🧮</span><span>{[tools.calc && 'a calculator', tools.rough && 'a rough-work pad'].filter(Boolean).join(' and ')} {tools.calc && tools.rough ? 'are' : 'is'} available from the top bar.</span></li>}
      </ul> },
      { key: 'rulesx', icon: '🛡️', title: 'Exam rules', show: camOn || fsOn || !!cfg.shield, body: <ul className="cbt-bul">
        {fsOn && <li><span>🖥️</span><span>The test runs in <b>full screen</b>. Leaving full screen is recorded{cfg.fullscreen === 'strict' ? ` and after ${cfg.maxFsExits} exits the test is submitted` : ''}.</span></li>}
        {camOn && <li><span>📷</span><span>Your <b>camera</b> stays on to check that only you are in front of the screen{cfg.camera === 'strict' ? `. After ${cfg.maxStrikes} warnings the test is submitted` : ''}.</span></li>}
        {cfg.shield && <li><span>🔒</span><span>Copying, printing and screenshots are blocked.</span></li>}
        <li><span>👀</span><span>Do not switch tabs or windows. Every time you leave this screen it is recorded.</span></li>
      </ul> },
    ].filter(s => s.show !== false)
    const last = slides.length - 1
    const i = Math.min(islide, last)
    const goTo = n => { setIdir(n > i ? 'fwd' : 'back'); setIslide(n) }
    const sl = slides[i]
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel">
        <div className="cbt-prog" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1}><i style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
        <div className="cbt-islide" key={sl.key} data-dir={idir}>
          <div className="cbt-ihead"><span className="ic" aria-hidden="true">{sl.icon}</span><div><small>Step {i + 1} of {slides.length} · {sl.kicker || 'Instructions'}</small><h3>{sl.title}</h3></div></div>
          {sl.body}
        </div>
        <div className="cbt-dots" role="tablist" aria-label="Instruction slides">{slides.map((s, n) => <button key={s.key} type="button" role="tab" aria-selected={n === i} aria-label={`Step ${n + 1}: ${s.title}`} className={n === i ? 'on' : ''} onClick={() => goTo(n)} />)}</div>
        <div className="cbt-row">
          <button className="cbt-b" onClick={() => (i === 0 ? setStage('intro') : goTo(i - 1))}>‹ Previous</button>
          <button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => (i === last ? setStage('declaration') : goTo(i + 1))}>{i === last ? 'Continue to declaration ›' : 'Next ›'}</button>
        </div>
      </div></div>
    </>)
  }

  // ── declaration ──
  if (stage === 'declaration') {
    return shell(<>
      <div className="cbt-top"><div className="title">{test.name}</div><div className="cbt-tools"><div className="cand"><span className="avatar">{(candidate.name || '?')[0].toUpperCase()}</span><span>{candidate.name}{candidate.roll ? ` · ${candidate.roll}` : ''}</span></div></div></div>
      <div className="cbt-center"><div className="panel">
          <h3 style={{ textAlign: 'center' }}>Declaration</h3>
          <label style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 5, width: 18, height: 18 }} />
            <span>I have read and understood the instructions. I will not use any unfair means, and I understand that leaving this screen during the test is recorded.{camOn ? ' I agree to my camera being used during the test to check that only I am in front of the screen.' : ''}{cfg.shield ? ' I will not copy, print or take screenshots of the paper.' : ''}</span>
          </label>
          <div className="cbt-row">
            <button className="cbt-b" onClick={() => { setIdir('back'); setStage('instructions') }}>‹ Previous</button>
            <button className="cbt-b sub" style={{ width: 'auto', margin: 0, opacity: agree ? 1 : .5 }} disabled={!agree || !!busy} onClick={camOn ? () => { setStage('camera'); cam.start() } : begin}>{busy || (camOn ? 'Next: camera check ›' : 'I am ready to begin')}</button>
          </div>
          {beginErr && <p role="alert" style={{ color: '#b42318', fontWeight: 700, marginTop: 12 }}>{beginErr}</p>}
      </div></div>
    </>)
  }

  if (!a || !q) return null
  const low = left <= 300
  const warn = !low && left <= 600                                   // amber in the last 10 minutes, red in the last 5
  const pctLeft = Math.max(0, Math.min(100, (left / Math.max(1, test.durationMin * 60)) * 100))
  const inSec = qs.filter(x => x.sectionIndex === q.sectionIndex)
  const sel = a.answers[q.no]
  const marksOf = test.marking
  const secCounts = s => counts(a, qs.filter(x => x.sectionId === s.id))
  const all = counts(a, qs)

  const summaryTable = (
    <div className="tbl"><table>
      <thead><tr><th>Section</th><th><span className="not-sm">Questions</span><span className="only-sm">Total</span></th><th><span className="not-sm">Answered</span><span className="only-sm">Done</span></th><th><span className="not-sm">Not Answered</span><span className="only-sm">Not done</span></th><th><span className="not-sm">Marked for Review</span><span className="only-sm">Review</span></th><th><span className="not-sm">Answered &amp; Marked</span><span className="only-sm">Done + Review</span></th><th><span className="not-sm">Not Visited</span><span className="only-sm">Unseen</span></th></tr></thead>
      <tbody>{test.sections.map(s => { const c = secCounts(s); return <tr key={s.id}><td>{s.label ? `${s.label} — ` : ''}{s.title}</td><td>{s.questions.length}</td><td>{c.answered}</td><td>{c.notAnswered}</td><td>{c.marked}</td><td>{c.answeredMarked}</td><td>{c.notVisited}</td></tr> })}</tbody>
    </table></div>
  )

  return shell(<>
    {toast && <div className="cbt-toast" role="alert">{toast}</div>}
    {remote && netErr && !submitErr && <div className="cbt-net" role="status">⚠ No connection — your answers are kept on this device and will be sent when it returns. Keep this page open.</div>}
    {fsOut && fsOn && <div className="cbt-modal" style={{ zIndex: 3700, background: '#0b1b3a' }}><div className="box" style={{ maxWidth: 440, textAlign: 'center' }}><h3>Return to full screen</h3><p style={{ fontSize: 14, lineHeight: 1.6 }}>This exam must be taken in full screen. {fsCount > 0 ? `You have left it ${fsCount} time${fsCount === 1 ? '' : 's'}.` : ''}{cfg.fullscreen === 'strict' ? ` After ${cfg.maxFsExits} exits the exam is submitted automatically.` : ''} The clock keeps running.</p><button className="cbt-b sub" style={{ width: 'auto' }} onClick={backToFs}>Return to full screen</button></div></div>}
    {modal === 'nextsec' && <div className="cbt-modal"><div className="box" style={{ maxWidth: 440 }}><h3>Go to the next section?</h3><p style={{ fontSize: 14, lineHeight: 1.6 }}>You will not be able to come back to this section. Anything you have answered here is saved.</p><div className="cbt-row"><button className="cbt-b" onClick={() => setModal(null)}>Stay here</button><button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={moveOn}>Go to next section ›</button></div></div></div>}
    {tool === 'calc' && <Calculator onClose={() => setTool(null)} />}
    {tool === 'rough' && <RoughPad value={rough} onChange={setRough} onClose={() => setTool(null)} />}
    {kicked && <div className="cbt-modal" style={{ zIndex: 3600 }}><div className="box" style={{ maxWidth: 420 }}><h3>This exam is open somewhere else</h3><p style={{ fontSize: 14, lineHeight: 1.6 }}>{kicked}</p><p className="muted">If this was you, continue on the other screen. Your answers are safe on the server.</p></div></div>}
    {busy && <div className="cbt-modal" style={{ zIndex: 3300 }}><div className="box" style={{ maxWidth: 360, textAlign: 'center' }}><h3>{busy}</h3><p className="muted">Please wait. Do not close this page.</p></div></div>}
    {submitErr && <div className="cbt-modal" style={{ zIndex: 3300 }}><div className="box" style={{ maxWidth: 420 }}><h3>Could not submit yet</h3><p style={{ fontSize: 14, lineHeight: 1.6 }}>{submitErr}</p><p className="muted">Your answers are safe. Trying again automatically — keep this page open.</p><div className="cbt-row"><button className="cbt-b sub" style={{ width: 'auto', margin: 0 }} onClick={() => finish(left <= 0)}>Try now</button></div></div></div>}
    <div className="cbt-top">
      <div className="title"><img className="brand" src="/gnsi-mark.webp" alt="" onError={e => { e.currentTarget.style.display = 'none' }} /><span className="tt"><small>Guidance Navodaya &amp; Sainik Institute</small>{test.name}</span></div>
      <span className={`cbt-timer${low ? ' low' : warn ? ' warn' : ''}`} role="timer" aria-label={`Time left ${clock(left)}`}><small>Time left</small><b>{clock(left)}</b><i style={{ width: `${pctLeft}%` }} /></span>
      {secNow?.left != null && <span className={`cbt-timer cbt-sectimer${secNow.left <= 60 ? ' low' : ''}`} aria-label="Time left in this section" title="Time left in this section">Section ⏱ {clock(secNow.left)}</span>}
      <span className={`cbt-saved s-${saveInfo.state}`} role="status" aria-live="polite">{saveInfo.state === 'saving' ? '⟳ Saving…' : saveInfo.state === 'offline' ? '⚠ Not saved — retrying' : saveInfo.state === 'saved' ? `✓ Saved ${new Date(saveInfo.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span>
      <div className="cbt-tools">
        <div className="cand"><span className="avatar">{(a.candidate.name || '?')[0].toUpperCase()}</span><span>{a.candidate.name}{a.candidate.roll ? <><br /><small>Roll: {a.candidate.roll}</small></> : null}</span></div>
        {mm && <select value={lang} onChange={e => setA(x => ({ ...x, lang: e.target.value }))} aria-label="Language"><option value="en">English</option><option value="mm">ꯃꯤꯇꯩꯂꯣꯟ (Meitei Mayek)</option></select>}
        {tools.calc && <button className="sm" onClick={() => setTool(t => (t === 'calc' ? null : 'calc'))} aria-label="Calculator" aria-pressed={tool === 'calc'}>🖩</button>}
        {tools.rough && <button className="sm" onClick={() => setTool(t => (t === 'rough' ? null : 'rough'))} aria-label="Rough work" aria-pressed={tool === 'rough'}>✎</button>}
        <button className="sm" onClick={() => setHc(v => !v)} aria-label="High contrast" aria-pressed={hc} title="High contrast"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" /></svg></button>
        <button className="sm" onClick={() => setFs(f => Math.max(12, f - 1))} aria-label="Smaller text">A−</button>
        <button className="sm" onClick={() => setFs(f => Math.min(24, f + 1))} aria-label="Larger text">A+</button>
        <button className="sm" onClick={() => setModal('instructions')} aria-label="Instructions"><span className="not-sm">Instructions</span><span className="only-sm">ⓘ Info</span></button>
      </div>
    </div>
    <div className="cbt-secbar" role="tablist" aria-label="Sections" ref={secbarRef}>
      {test.sections.map((s, i) => {
        const c = secCounts(s)
        return <button key={s.id} role="tab" aria-selected={q.sectionIndex === i} className={`cbt-sec${q.sectionIndex === i ? ' on' : ''}`} disabled={curSec !== null && i !== curSec} title={curSec !== null && i !== curSec ? (i < curSec ? 'This section is closed' : 'Opens after the current section') : undefined} onClick={() => open(s.questions[0].no)}><span className="sl">{s.label || i + 1}</span><span className="st">{pick(s.title, s.titleMm, lang) || `Section ${i + 1}`}</span><small>{c.answered + c.answeredMarked}/{s.questions.length}</small></button>
      })}
    </div>
    <div className="cbt-body">
      <div className="cbt-main">
        <div className="cbt-qhead">
          <span className="cbt-qno"><span className="not-sm">Question No. </span><span className="only-sm">Q. </span><i>{dn(q)}</i><small>of {qs.length}</small>{sec.label ? <span className="cbt-qsec">Section {sec.label}</span> : null}</span>
          <span className="cbt-marks">Marks: <span className="p">+{marksOf.correct}</span> · <span className="n">{marksOf.wrong ? `−${marksOf.wrong}` : '0'}</span></span>
          <button className="cbt-palbtn" onClick={() => setDrawer(true)} aria-label="Open question palette">☰ <span className="not-sm">Palette · </span>{all.answered + all.answeredMarked}/{qs.length}</button>
        </div>
        <div className="cbt-qarea">
          {q.passage && (() => {
            const isDir = /^Part\b/i.test(q.passage), mmP = lang === 'mm' && q.passageMm
            const body = pick(q.passage, q.passageMm, lang)
            return <div className="cbt-pass">
              <div className="cbt-pass-h"><span className="cbt-pass-tag">{isDir ? 'DIRECTIONS' : 'READING PASSAGE'}</span><span className="cbt-pass-tools"><button onClick={() => setRfs(f => Math.max(14, f - 1))} aria-label="Smaller passage text">A−</button><button onClick={() => setRfs(f => Math.min(30, f + 1))} aria-label="Larger passage text">A+</button></span></div>
              <div className={`cbt-prose${mmP ? ' mm' : ''}`} style={{ '--rfs': `${rfs}px` }}>{body}</div>
              <button className="cbt-passbar" onClick={() => setReader(true)}><span>📖 {isDir ? 'Directions' : 'Passage'} · tap to read full screen</span><span>Open ▸</span></button>
            </div>
          })()}
          <div className="cbt-q">
            {q.no === sec.questions[0].no && (sec.directions || sec.directionsMm) && <div className={`cbt-dir${lang === 'mm' && sec.directionsMm ? ' mm' : ''}`}><b>Directions: </b>{pick(sec.directions, sec.directionsMm, lang)}</div>}
            {picsOf(q).map((src, i) => <img key={i} className="cbt-fig" src={src} alt={`Question ${dn(q)} figure ${i + 1}`} draggable={false} />)}
            {q.text && <div className={`cbt-qtext${lang === 'mm' && q.textMm ? ' mm' : ''}`}>{pick(q.text, q.textMm, lang)}</div>}
            {q.options.map(o => (
              <label key={o.key} className={`cbt-opt${sel === o.key ? ' on' : ''}`}>
                <input type="radio" name={`q${q.no}`} checked={sel === o.key} disabled={lock && !!sel && sel !== o.key} onChange={() => choose(o.key)} />
                <b>{o.label || o.key}.</b>
                <span className={lang === 'mm' && o.textMm ? 'mm' : ''}>{q.figure ? `Option ${o.label || o.key}` : pick(o.text, o.textMm, lang)}</span>
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
        <div className="cbt-pprog"><div><b>{all.answered + all.answeredMarked}</b> of {qs.length} answered</div><span className="bar"><i style={{ width: `${Math.round(((all.answered + all.answeredMarked) / Math.max(1, qs.length)) * 100)}%` }} /></span></div>
        <div className="cbt-legend">
          {LEGEND.map(s => <div key={s}><Swatch s={s} n={all[s]} />{STATUS_LABEL[s]}</div>)}
        </div>
        <div className="cbt-pal">
          <h5>{sec.label ? `Section ${sec.label}: ` : ''}{pick(sec.title, sec.titleMm, lang)}</h5>
          <div className="cbt-grid">
            {inSec.map(x => <button key={x.no} className={`cbt-n ${statusOf(a, x.no)}${x.no === q.no ? ' cur' : ''}`} onClick={() => open(x.no)} aria-label={`Question ${dn(x)}, ${STATUS_LABEL[statusOf(a, x.no)]}`}>{dn(x)}</button>)}
          </div>
        </div>
        <div className="foot"><button className="cbt-b sub" style={{ marginTop: 0 }} onClick={() => setModal('summary')}>Submit Test</button></div>
      </aside>
    </div>

    {reader && q.passage && <div className="cbt-reader" role="dialog" aria-modal="true" aria-label="Reading passage" ref={readerRef}>
      <div className="cbt-reader-h"><button onClick={() => setReader(false)} aria-label="Back to the question">‹ Back</button><span>{/^Part\b/i.test(q.passage) ? 'Directions' : 'Reading passage'}<small>Question {dn(q)} of {qs.length}</small></span><span className="cbt-pass-tools"><button onClick={() => setRfs(f => Math.max(14, f - 1))} aria-label="Smaller text">A−</button><button onClick={() => setRfs(f => Math.min(30, f + 1))} aria-label="Larger text">A+</button></span></div>
      <div className="cbt-reader-body"><article className={`cbt-prose${lang === 'mm' && q.passageMm ? ' mm' : ''}`} style={{ '--rfs': `${rfs + 2}px` }}>{pick(q.passage, q.passageMm, lang)}</article></div>
      <div className="cbt-reader-f"><button className="cbt-b save" onClick={() => setReader(false)}>Answer Question {dn(q)} ›</button></div>
    </div>}
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
                    {q.passage && <div className="muted" style={{ margin: '6px 0' }}>Passage: {pickRaw(q.passage, q.passageMm, lang).slice(0, 160)}…</div>}
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

// useCbtProctor — runs the camera check for the exam player. `start()` opens the camera and loads the detector;
// after that every ~0.8 s the frame is checked. `status` is what is seen right now ('ok' | 'none' | 'far' | 'multi' |
// 'away' | 'nocam'); `okStreak` counts good frames in a row (the pre-exam check waits for a few); `onEvent(kind)` fires
// when a violation has lasted long enough to count — only while `running` is true.
//
// Beyond the faces it also watches the camera itself: a feed that stops advancing (paused, frozen, shutter closed,
// device gone) or a detector that keeps failing is a 'nocam' violation — it is never silently skipped. A virtual camera
// (OBS, ManyCam …) is refused in strict mode and recorded otherwise.
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDetector, openCamera, detectFaces, scanMoreFaces } from './cbtProctor'
import { classify, createTracker, streamHealth, isVirtualCamera, mergeFaces, createExtraMemory } from './lib/cbtProctorLogic'

const MAX_DETECT_FAILS = 6          // ~5 s of frames the detector could not read → treated as a stopped camera
const DEEP_EVERY = 2                // the second AI model takes a look every 2nd frame; its result is remembered for 3 frames so the verdict does not flicker between looks

export function useCbtProctor({ enabled, running, onEvent, strict = false }) {
  const videoRef = useRef(null), streamRef = useRef(null), faceapi = useRef(null), tracker = useRef(createTracker())
  const cb = useRef(onEvent), runRef = useRef(running)
  const [phase, setPhase] = useState('idle')        // idle | starting | ready | error
  const [status, setStatus] = useState('none')
  const [okStreak, setOkStreak] = useState(0)
  const [held, setHeld] = useState(0)             // ms the current problem has lasted (0 when all is well)
  const badSince = useRef(0)
  const extra = useRef(createExtraMemory(3)), tickN = useRef(0)
  const [faceCount, setFaceCount] = useState(0)
  const [deep, setDeep] = useState(false)          // is the second AI model loaded?
  const mutedRef = useRef(false), lastAdvance = useRef(0), lastTime = useRef(-1), fails = useRef(0), vcamLogged = useRef(false), virtual = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => { cb.current = onEvent; runRef.current = running })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async () => {
    if (!enabled) return
    setPhase('starting'); setError('')
    mutedRef.current = false; lastAdvance.current = 0; lastTime.current = -1; fails.current = 0; tickN.current = 0; extra.current.clear()
    try {
      const stream = await openCamera()
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      virtual.current = isVirtualCamera(track?.label)
      if (virtual.current && strict) { stop(); throw new Error('A virtual or software camera was detected. This exam needs your device\'s own camera — close OBS / ManyCam / similar apps and try again.') }
      track?.addEventListener('ended', () => { setStatus('nocam'); setPhase('error'); setError('The camera stopped.'); if (runRef.current) cb.current?.('nocam') })
      track?.addEventListener('mute', () => { mutedRef.current = true })
      track?.addEventListener('unmute', () => { mutedRef.current = false; lastAdvance.current = Date.now() })
      const v = videoRef.current
      if (v) { v.srcObject = stream; await v.play().catch(() => {}) }
      faceapi.current = await loadDetector()
      tracker.current.reset(); vcamLogged.current = false; setDeep(!!faceapi.current.ssd); setPhase('ready')
    } catch (e) { stop(); setError(e.message || 'The camera check could not start.'); setPhase('error') }
  }, [enabled, stop, strict])

  useEffect(() => {
    if (phase !== 'ready') return
    let busy = false, live = true
    const tick = async () => {
      const v = videoRef.current
      if (busy || !live || !v) return
      busy = true
      try {
        const now = Date.now()
        if (virtual.current && !vcamLogged.current && runRef.current) { vcamLogged.current = true; cb.current?.('vcam') }
        // 1. is the picture still moving?
        if (v.currentTime !== lastTime.current) { lastTime.current = v.currentTime; lastAdvance.current = now }
        else if (!lastAdvance.current) lastAdvance.current = now
        if (v.paused && v.readyState >= 2) v.play().catch(() => {})          // some browsers pause a video the page lost focus on
        const track = streamRef.current?.getVideoTracks()[0]
        let next = streamHealth({ readyState: v.readyState, paused: v.paused, muted: mutedRef.current, trackLive: !track || track.readyState === 'live', lastAdvance: lastAdvance.current, now })
        // 2. if it is, look at the faces
        if (next === 'ok') {
          try {
            const primary = await detectFaces(faceapi.current, v)
            if (tickN.current++ % DEEP_EVERY === 0) {                       // the second look; a failure here never hides the first
              try { extra.current.set(await scanMoreFaces(faceapi.current, v)) } catch { /* keep the fast model's verdict */ }
            } else extra.current.next()
            const faces = mergeFaces(primary, extra.current.get())
            setFaceCount(faces.length)
            next = classify(faces, v.videoWidth || 0); fails.current = 0
          }
          catch { fails.current += 1; next = fails.current >= MAX_DETECT_FAILS ? 'nocam' : null }   // a few unreadable frames are skipped; a run of them is a problem
        }
        if (!live || next === null) { busy = false; return }
        setStatus(next); setOkStreak(n => (next === 'ok' ? n + 1 : 0))
        if (next === 'ok') badSince.current = 0; else if (!badSince.current) badSince.current = now
        setHeld(badSince.current ? now - badSince.current : 0)
        const r = tracker.current.push(next, now)
        if (r.event && runRef.current) cb.current?.(r.event)
      } catch { /* never let the watchdog itself throw */ }
      busy = false
    }
    const t = setInterval(tick, 800)
    return () => { live = false; clearInterval(t) }
  }, [phase])

  useEffect(() => stop, [stop])
  return { videoRef, phase, status, okStreak, held, error, start, stop, faceCount, deep }
}

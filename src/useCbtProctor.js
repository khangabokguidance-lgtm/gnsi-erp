// useCbtProctor — runs the camera check for the exam player. `start()` opens the camera and loads the detector;
// after that every ~0.8 s the frame is checked. `status` is what is seen right now ('ok' | 'none' | 'multi' | 'away'
// | 'nocam'); `okStreak` counts good frames in a row (the pre-exam check waits for a few); `onEvent(kind)` fires when
// a violation has lasted long enough to count — only while `running` is true.
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDetector, openCamera, detectFaces } from './cbtProctor'
import { classify, createTracker } from './lib/cbtProctorLogic'

export function useCbtProctor({ enabled, running, onEvent }) {
  const videoRef = useRef(null), streamRef = useRef(null), faceapi = useRef(null), tracker = useRef(createTracker())
  const cb = useRef(onEvent), runRef = useRef(running)
  const [phase, setPhase] = useState('idle')        // idle | starting | ready | error
  const [status, setStatus] = useState('none')
  const [okStreak, setOkStreak] = useState(0)
  const [held, setHeld] = useState(0)             // ms the current problem has lasted (0 when all is well)
  const badSince = useRef(0)
  const [error, setError] = useState('')
  useEffect(() => { cb.current = onEvent; runRef.current = running })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async () => {
    if (!enabled) return
    setPhase('starting'); setError('')
    try {
      const stream = await openCamera()
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { setStatus('nocam'); setPhase('error'); setError('The camera stopped.'); if (runRef.current) cb.current?.('nocam') })
      const v = videoRef.current
      if (v) { v.srcObject = stream; await v.play().catch(() => {}) }
      faceapi.current = await loadDetector()
      tracker.current.reset(); setPhase('ready')
    } catch (e) { stop(); setError(e.message || 'The camera check could not start.'); setPhase('error') }
  }, [enabled, stop])

  useEffect(() => {
    if (phase !== 'ready') return
    let busy = false, live = true
    const tick = async () => {
      const v = videoRef.current
      if (busy || !live || !v || v.readyState < 2) return
      busy = true
      try {
        const next = classify(await detectFaces(faceapi.current, v))
        if (!live) return
        setStatus(next); setOkStreak(n => (next === 'ok' ? n + 1 : 0))
        if (next === 'ok') badSince.current = 0; else if (!badSince.current) badSince.current = Date.now()
        setHeld(badSince.current ? Date.now() - badSince.current : 0)
        const r = tracker.current.push(next, Date.now())
        if (r.event && runRef.current) cb.current?.(r.event)
      } catch { /* a frame that cannot be read is skipped */ }
      busy = false
    }
    const t = setInterval(tick, 800)
    return () => { live = false; clearInterval(t) }
  }, [phase])

  useEffect(() => stop, [stop])
  return { videoRef, phase, status, okStreak, held, error, start, stop }
}

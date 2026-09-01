// FaceCapture.jsx — Live face verification + liveness challenge, used inside
// GeoAttendance.jsx's check-in flow.
//
// Adds live frame-quality monitoring (lighting/backlight detection) BEFORE
// the scan starts, plus a positioning guide oval — so bad lighting or poor
// framing is caught immediately with a specific message, instead of only
// surfacing as a generic "liveness check failed" deep inside the blink loop.
//
// Sequence: fetch enrolled descriptor -> continuously assess frame quality
// -> (once quality is good) issue server challenge -> blink -> head-turn
// (direction chosen by the server, unknown to the client until the
// challenge is issued) -> resolve with { liveDescriptor, clientScore,
// challengeId } for the caller to pass into server_checkin.
//
// SECURITY: the client's own matchDescriptor() result (clientScore/
// clientVerified below) is advisory only, shown for instant UI feedback.
// It is NOT what gates check-in — the RAW live descriptor is sent to
// server_checkin, which independently recomputes the match server-side
// against the stored enrolled descriptor. A forged client boolean can no
// longer bypass verification; there is no boolean to forge anymore.

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { loadFaceModels, extractDescriptor, matchDescriptor, assessFrameQuality } from './faceEngine'
import { issueChallenge, runLivenessSequence, TURN_RATIO_THRESHOLD } from './faceLiveness'

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(11,30,61,0.85)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: '#0B1E3D', borderRadius: 20, padding: 20, maxWidth: 340, width: '100%', border: '1px solid rgba(201,162,75,0.3)' },
  video: { width: '100%', borderRadius: 14, background: '#081527', transform: 'scaleX(-1)', display: 'block' },
  btn: (color = '#C9A24B', disabled = false) => ({
    width: '100%', marginTop: 14, background: disabled ? '#5b6473' : color, color: '#0B1E3D',
    border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Arial,sans-serif',
  }),
}

const PHASE_COPY = {
  idle:    'Position your face inside the frame',
  blink:   'Blink slowly',
  turn:    'Now turn your head as shown',
  matching:'Verifying identity…',
  timeout: 'Timed out — try again',
}

const QUALITY_MESSAGES = {
  too_dark: 'Too dark — move to a brighter, evenly lit spot',
  too_bright: 'Too bright — move away from direct light',
  backlit: 'Light is behind you — face a light source instead of your back to it',
  no_frame: 'Waiting for camera…',
}

const QUALITY_CHECK_INTERVAL_MS = 400

export default function FaceCapture({ staffId, onVerified, onCancel }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const qualityTimerRef = useRef(null)
  // Ref-based lock — 'running' state alone isn't enough to block a second
  // startScan() invocation fired before React re-renders the disabled
  // button (double-tap / rapid click), which would otherwise issue two
  // single-use liveness challenges and race two scans on one camera stream.
  const scanLockRef = useRef(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [descriptorRow, setDescriptorRow] = useState(null)
  const [phase, setPhase]     = useState('idle')
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState('')
  const [quality, setQuality] = useState({ ok: false, reason: 'no_frame' })
  const [liveEar, setLiveEar] = useState(null)
  const [turnRatio, setTurnRatio] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [{ data, error: fetchErr }] = await Promise.all([
          supabase.from('staff_face_descriptors').select('descriptor').eq('staff_id', staffId).eq('status', 'approved').limit(1).single(),
          loadFaceModels(),
        ])
        if (cancelled) return
        if (fetchErr || !data) {
          setError('No approved face enrollment found. Contact admin to enroll your face.')
          return
        }
        setDescriptorRow(data)
        setModelsReady(true)
      } catch (e) {
        if (!cancelled) setError('Setup failed: ' + e.message)
      }
    }
    init()
    return () => { cancelled = true }
  }, [staffId])

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 400, height: 400 } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraReady(true)
        }
      } catch {
        setError('Camera access denied — enable camera permission to check in.')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current)
    }
  }, [])

  // Continuously monitor lighting/frame quality once the camera is live,
  // so the person gets specific feedback ("too dark", "light behind you")
  // before ever attempting the scan — not just a generic failure after.
  useEffect(() => {
    if (!cameraReady || running) return
    qualityTimerRef.current = setInterval(() => {
      if (videoRef.current) setQuality(assessFrameQuality(videoRef.current))
    }, QUALITY_CHECK_INTERVAL_MS)
    return () => clearInterval(qualityTimerRef.current)
  }, [cameraReady, running])

  const startScan = async () => {
    if (scanLockRef.current) return
    if (!cameraReady || !modelsReady || !descriptorRow || running || !quality.ok) return
    scanLockRef.current = true
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current)
    setRunning(true)
    setError('')
    try {
      // Server issues a fresh, single-use challenge with a randomly chosen
      // turn direction the client doesn't know in advance — the client
      // cannot fake completing it, and it expires quickly to prevent replay.
      const { challenge_id, turn_direction } = await issueChallenge(staffId)

      // Blink, then turn toward the server-chosen direction
      const livenessPassed = await runLivenessSequence(videoRef.current, turn_direction, (p) => setPhase(p), setLiveEar, setTurnRatio)
      if (!livenessPassed) {
        setError(phase === 'turn'
          ? 'Head turn not detected — turn a little further, then try again.'
          : 'No blink detected — make sure your face is well lit and centered, then try again.')
        setRunning(false)
        scanLockRef.current = false
        return
      }

      // Extract the live descriptor right after liveness passes. This is
      // sent to the server as-is — the client's own matchDescriptor() call
      // below is ONLY for immediate on-screen feedback and is never trusted
      // as the verification result itself.
      setPhase('matching')
      const liveDescriptor = await extractDescriptor(videoRef.current)
      if (!liveDescriptor) {
        setError('Lost face tracking — try again.')
        setRunning(false)
        scanLockRef.current = false
        return
      }
      const clientPreview = matchDescriptor(liveDescriptor, descriptorRow.descriptor)

      streamRef.current?.getTracks().forEach(t => t.stop())
      onVerified({
        liveDescriptor,
        clientScore: clientPreview.score,       // advisory only — for UI/logging, not trust
        clientVerified: clientPreview.verified,  // advisory only — for UI/logging, not trust
        challengeId: challenge_id,
      })
    } catch (e) {
      setError('Verification failed: ' + e.message)
      setRunning(false)
      scanLockRef.current = false
    }
  }

  const cancel = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current)
    scanLockRef.current = false
    onCancel()
  }

  const retry = () => {
    setError('')
    setPhase('idle')
    setRunning(false)
    setTurnRatio(0)
    scanLockRef.current = false
  }

  const qualityWarning = !error && !running && cameraReady && !quality.ok ? QUALITY_MESSAGES[quality.reason] : null

  const statusText = error
    ? error
    : qualityWarning
      ? qualityWarning
      : PHASE_COPY[phase] || PHASE_COPY.idle

  const canScan = cameraReady && modelsReady && !running && quality.ok

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ color: '#C9A24B', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial,sans-serif', marginBottom: 4 }}>
          Face check-in
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <video ref={videoRef} muted playsInline style={S.video} />

          {/* Positioning guide oval — solid green once framing+lighting are good */}
          {cameraReady && !error && (
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <ellipse
                cx="100" cy="100" rx="62" ry="82"
                fill="none"
                stroke={quality.ok ? '#4ade80' : '#fbbf24'}
                strokeWidth="3"
                strokeDasharray={quality.ok ? 'none' : '8 6'}
                opacity="0.9"
              />
            </svg>
          )}

          {(!cameraReady || !modelsReady) && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F1E6', fontSize: 12, fontFamily: 'Arial,sans-serif' }}>
              Preparing camera…
            </div>
          )}

          {running && phase === 'blink' && liveEar !== null && (
            <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.75)', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>👁 Blink now…</span>
              <span style={{ color: liveEar < 0.28 ? '#4ade80' : '#e2e8f0', fontSize: 11, fontFamily: 'monospace' }}>
                EAR {liveEar.toFixed(2)}
              </span>
            </div>
          )}

          {running && phase === 'turn' && (
            <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(15,23,42,0.75)', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>↔ Turn your head slowly…</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: '#4ade80', transition: 'width 0.1s linear',
                  width: `${Math.min(100, Math.round((Math.abs(turnRatio) / TURN_RATIO_THRESHOLD) * 100))}%`,
                }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ color: error ? '#f87171' : qualityWarning ? '#fbbf24' : '#F5F1E6', fontFamily: 'Arial,sans-serif', fontSize: 13, textAlign: 'center', marginTop: 12, minHeight: 18, fontWeight: running ? 700 : 400 }}>
          {statusText}
        </div>
        {!error ? (
          <button style={S.btn('#C9A24B', !canScan)} disabled={!canScan} onClick={startScan}>
            {running ? 'Scanning…' : !quality.ok && cameraReady ? 'Waiting for good lighting…' : 'Start face scan'}
          </button>
        ) : (
          <button style={S.btn('#5b6473', false)} onClick={retry}>Try again</button>
        )}
        {!running && (
          <button onClick={cancel} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#8FA0BF', fontSize: 12, fontFamily: 'Arial,sans-serif', cursor: 'pointer', padding: 6 }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
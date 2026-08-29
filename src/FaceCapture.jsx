// FaceCapture.jsx — Live face verification + liveness challenge, used inside
// GeoAttendance.jsx's check-in flow.
//
// Sequence: fetch enrolled descriptor -> issue server challenge -> blink ->
// turn head in server-specified direction -> final face match -> resolve
// with { verified, score, challengeId } for the caller to pass into
// server_checkin (which independently consumes/validates the challenge).

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { loadFaceModels, extractDescriptor, matchDescriptor } from './faceEngine'
import { issueChallenge, runLivenessSequence } from './faceLiveness'

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(11,30,61,0.85)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: '#0B1E3D', borderRadius: 20, padding: 20, maxWidth: 340, width: '100%', border: '1px solid rgba(201,162,75,0.3)' },
  video: { width: '100%', borderRadius: 14, background: '#081527', transform: 'scaleX(-1)' },
  btn: (color = '#C9A24B', disabled = false) => ({
    width: '100%', marginTop: 14, background: disabled ? '#5b6473' : color, color: '#0B1E3D',
    border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Arial,sans-serif',
  }),
}

const PHASE_COPY = {
  idle:    'Position your face inside the frame',
  blink:   'Blink slowly',
  matching:'Verifying identity…',
  timeout: 'Timed out — try again',
}

export default function FaceCapture({ staffId, onVerified, onCancel }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [descriptorRow, setDescriptorRow] = useState(null)
  const [phase, setPhase]     = useState('idle')
  const [turnDir, setTurnDir] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState('')

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
    }
  }, [])

  const startScan = async () => {
    if (!cameraReady || !modelsReady || !descriptorRow || running) return
    setRunning(true)
    setError('')
    try {
      // 1. Server issues a fresh, single-use challenge with a random direction —
      //    the client cannot know it in advance, so a pre-recorded video can't satisfy it.
      const { challenge_id, turn_direction } = await issueChallenge(staffId)
      setTurnDir(turn_direction)

      // 2. Run blink -> turn detection against the live video feed
      const livenessPassed = await runLivenessSequence(videoRef.current, turn_direction, (p) => setPhase(p))
      if (!livenessPassed) {
        setError('Liveness check failed — make sure your face is well lit and try again.')
        setRunning(false)
        return
      }

      // 3. Final face match, taken right after liveness passes
      setPhase('matching')
      const liveDescriptor = await extractDescriptor(videoRef.current)
      if (!liveDescriptor) {
        setError('Lost face tracking — try again.')
        setRunning(false)
        return
      }
      const matchResult = matchDescriptor(liveDescriptor, descriptorRow.descriptor)

      streamRef.current?.getTracks().forEach(t => t.stop())
      onVerified({ ...matchResult, challengeId: challenge_id })
    } catch (e) {
      setError('Verification failed: ' + e.message)
      setRunning(false)
    }
  }

  const cancel = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }

  const statusText = error
    ? error
    : PHASE_COPY[phase] || PHASE_COPY.idle

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ color: '#C9A24B', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial,sans-serif', marginBottom: 4 }}>
          Face check-in
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <video ref={videoRef} muted playsInline style={S.video} />
          {(!cameraReady || !modelsReady) && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F1E6', fontSize: 12, fontFamily: 'Arial,sans-serif' }}>
              Preparing camera…
            </div>
          )}
        </div>
        <div style={{ color: error ? '#f87171' : '#F5F1E6', fontFamily: 'Arial,sans-serif', fontSize: 13, textAlign: 'center', marginTop: 12, minHeight: 18, fontWeight: running ? 700 : 400 }}>
          {statusText}
        </div>
        {!error ? (
          <button style={S.btn('#C9A24B', !cameraReady || !modelsReady || running)} disabled={!cameraReady || !modelsReady || running} onClick={startScan}>
            {running ? 'Scanning…' : 'Start face scan'}
          </button>
        ) : (
          <button style={S.btn('#5b6473', false)} onClick={() => { setError(''); setPhase('idle') }}>Try again</button>
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

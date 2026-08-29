// FaceCapture.jsx — Live face verification step, used inside GeoAttendance.jsx's
// check-in flow. Renders a camera modal, matches against the staff member's
// approved descriptor, and resolves with { verified, score } for the caller
// to pass into server_checkin.

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { loadFaceModels, extractDescriptor, matchDescriptor } from './faceEngine'

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

// staffId: the logged-in staff's id, used to fetch their approved descriptor
export default function FaceCapture({ staffId, onVerified, onCancel }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [descriptorRow, setDescriptorRow] = useState(null)
  const [status, setStatus]   = useState('Loading…')
  const [scanning, setScanning] = useState(false)
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
          setStatus('Not enrolled')
          return
        }
        setDescriptorRow(data)
        setModelsReady(true)
        setStatus('Position your face inside the frame')
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

  const scan = async () => {
    if (!cameraReady || !modelsReady || !descriptorRow || scanning) return
    setScanning(true)
    setStatus('Hold still, verifying…')
    try {
      const liveDescriptor = await extractDescriptor(videoRef.current)
      if (!liveDescriptor) {
        setStatus('No face detected — try again')
        setScanning(false)
        return
      }
      const result = matchDescriptor(liveDescriptor, descriptorRow.descriptor)
      streamRef.current?.getTracks().forEach(t => t.stop())
      onVerified(result)
    } catch (e) {
      setError('Verification failed: ' + e.message)
      setScanning(false)
    }
  }

  const cancel = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }

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
        <div style={{ color: error ? '#f87171' : '#F5F1E6', fontFamily: 'Arial,sans-serif', fontSize: 13, textAlign: 'center', marginTop: 12, minHeight: 18 }}>
          {error || status}
        </div>
        {!error ? (
          <button style={S.btn('#C9A24B', !cameraReady || !modelsReady || scanning)} disabled={!cameraReady || !modelsReady || scanning} onClick={scan}>
            {scanning ? 'Scanning…' : 'Scan face'}
          </button>
        ) : (
          <button style={S.btn('#5b6473', false)} onClick={cancel}>Close</button>
        )}
        {!error && (
          <button onClick={cancel} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#8FA0BF', fontSize: 12, fontFamily: 'Arial,sans-serif', cursor: 'pointer', padding: 6 }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// FaceEnroll.jsx — Face enrollment: admin-driven and staff self-enroll
//
// Two entry points exported:
//   <FaceEnroll staffMember={row} mode="admin" onDone={...} />   — used from Staff.jsx admin panel
//   <FaceEnroll staffMember={loggedInStaff} mode="self" onDone={...} />  — used from GeoAttendance.jsx
//     when a staff member has no approved descriptor yet
//
// Admin enrollments are auto-approved. Self-enrollments go in as 'pending'
// and must be approved via <FaceApprovalQueue /> before they unlock check-in.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { loadFaceModels, extractDescriptor, averageDescriptors } from './faceEngine'

const CAPTURES_NEEDED = 3

const S = {
  card:  { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 20, maxWidth: 420, margin: '0 auto' },
  btn:   (color = '#1e3a5f', disabled = false) => ({
    backgroundColor: disabled ? '#94a3b8' : color, color: 'white', border: 'none',
    borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13, fontFamily: 'inherit', minHeight: 44, width: '100%',
  }),
  video: { width: '100%', borderRadius: 10, background: '#0f172a', transform: 'scaleX(-1)' },
}

export default function FaceEnroll({ staffMember, mode = 'self', currentAdminId = null, onDone, showToast }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const [ready, setReady]         = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [captures, setCaptures]   = useState([])   // array of descriptor arrays
  const [capturing, setCapturing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const notify = useCallback((msg, type) => {
    if (showToast) showToast(msg, type)
    else if (type === 'err') setError(msg)
  }, [showToast])

  useEffect(() => {
    let cancelled = false
    loadFaceModels()
      .then(() => { if (!cancelled) setModelsReady(true) })
      .catch(() => notify('Could not load face recognition models — check your connection.', 'err'))
    return () => { cancelled = true }
  }, [notify])

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch {
        notify('Camera access denied — enable camera permission to enroll.', 'err')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [notify])

  const captureOne = async () => {
    if (!ready || !modelsReady || capturing) return
    setCapturing(true)
    setError('')
    try {
      const descriptor = await extractDescriptor(videoRef.current)
      if (!descriptor) {
        notify('No face detected — center your face in the frame and try again.', 'err')
        setCapturing(false)
        return
      }
      setCaptures(prev => [...prev, descriptor])
    } catch (e) {
      notify('Capture failed: ' + e.message, 'err')
    }
    setCapturing(false)
  }

  const reset = () => setCaptures([])

  const save = async () => {
    if (captures.length < CAPTURES_NEEDED) return
    setSaving(true)
    try {
      const avgDescriptor = averageDescriptors(captures)
      const isAdminEnroll = mode === 'admin'

      const { error: dbError } = await supabase.from('staff_face_descriptors').insert([{
        staff_id:    staffMember.id,
        descriptor:  avgDescriptor,
        status:      isAdminEnroll ? 'approved' : 'pending',
        enrolled_by: isAdminEnroll ? currentAdminId : null,
        reviewed_by: isAdminEnroll ? currentAdminId : null,
        reviewed_at: isAdminEnroll ? new Date().toISOString() : null,
      }])

      if (dbError) throw dbError

      streamRef.current?.getTracks().forEach(t => t.stop())
      notify(
        isAdminEnroll ? '✅ Face enrolled and approved.' : '✅ Face captured — pending admin approval.',
        'ok'
      )
      onDone?.()
    } catch (e) {
      notify('Could not save enrollment: ' + e.message, 'err')
    }
    setSaving(false)
  }

  const progressPct = Math.min(100, Math.round((captures.length / CAPTURES_NEEDED) * 100))

  return (
    <div style={S.card}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#1e3a5f' }}>
        {mode === 'admin' ? `Enroll face — ${staffMember?.name || ''}` : 'Enroll your face'}
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
        {mode === 'admin'
          ? 'Capture 3 clear shots. This enrollment is approved immediately.'
          : 'Capture 3 clear shots. An admin must approve this before it unlocks check-in.'}
      </p>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <video ref={videoRef} muted playsInline style={S.video} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!modelsReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, background: 'rgba(15,23,42,0.6)', borderRadius: 10 }}>
            Loading face models…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {Array.from({ length: CAPTURES_NEEDED }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < captures.length ? '#16a34a' : '#e2e8f0' }} />
        ))}
      </div>

      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</div>}

      {captures.length < CAPTURES_NEEDED ? (
        <button style={S.btn('#1e3a5f', !ready || !modelsReady || capturing)} disabled={!ready || !modelsReady || capturing} onClick={captureOne}>
          {capturing ? 'Capturing…' : `Capture shot ${captures.length + 1} of ${CAPTURES_NEEDED}`}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn('#94a3b8'), width: 'auto', flex: 1 }} onClick={reset} disabled={saving}>Retake</button>
          <button style={{ ...S.btn('#16a34a'), width: 'auto', flex: 2 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save enrollment'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Admin approval queue for self-enrolled (pending) faces ────────────────

export function FaceApprovalQueue({ currentAdminId, showToast }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('id, staff_id, enrolled_at, staff_profiles(name, designation)')
      .eq('status', 'pending')
      .order('enrolled_at', { ascending: true })
    if (!error) setPending(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const decide = async (id, status) => {
    const { error } = await supabase.from('staff_face_descriptors').update({
      status, reviewed_by: currentAdminId, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) showToast?.('Update failed: ' + error.message, 'err')
    else { showToast?.(status === 'approved' ? '✅ Approved' : 'Rejected', status === 'approved' ? 'ok' : 'warn'); fetchPending() }
  }

  if (loading) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
  if (!pending.length) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No pending face enrollments.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pending.map(p => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.staff_profiles?.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{p.staff_profiles?.designation || ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => decide(p.id, 'approved')} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
            <button onClick={() => decide(p.id, 'rejected')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}

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
import { loadFaceModels, extractDescriptor, averageDescriptors, matchDescriptor, avgEyeAspectRatio, detectFaceWithLandmarks } from './faceEngine'

const CAPTURES_NEEDED = 3
const BLINK_EAR_THRESHOLD = 0.22
const BLINK_TIMEOUT_MS = 6000
const SAMPLE_INTERVAL_MS = 120

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Requires an eyes-closed-then-reopened cycle before allowing a capture —
// a printed photo or static image can never blink, so this blocks
// photo-based fake enrollment. Required before each of the 3 shots.
async function waitForBlink(videoEl) {
  const start = Date.now()
  let sawClosed = false
  while (Date.now() - start < BLINK_TIMEOUT_MS) {
    const detection = await detectFaceWithLandmarks(videoEl)
    if (detection) {
      const ear = avgEyeAspectRatio(detection.landmarks)
      if (ear < BLINK_EAR_THRESHOLD) sawClosed = true
      else if (sawClosed) return true
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
  return false
}

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
  const [captures, setCaptures]   = useState([])   // array of { descriptor, blob }
  const [capturing, setCapturing] = useState(false)
  const [blinkPrompt, setBlinkPrompt] = useState(false)
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
      setBlinkPrompt(true)
      const blinked = await waitForBlink(videoRef.current)
      setBlinkPrompt(false)
      if (!blinked) {
        notify('No blink detected — blink naturally and try again.', 'err')
        setCapturing(false)
        return
      }

      const descriptor = await extractDescriptor(videoRef.current)
      if (!descriptor) {
        notify('No face detected — center your face in the frame and try again.', 'err')
        setCapturing(false)
        return
      }
      // Snapshot the frame as a JPEG blob for enrollment photo storage.
      // Mirrored to match the on-screen preview (video has scaleX(-1)).
      const canvas = canvasRef.current
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))

      setCaptures(prev => [...prev, { descriptor, blob }])
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
      const avgDescriptor = averageDescriptors(captures.map(c => c.descriptor))
      const isAdminEnroll = mode === 'admin'
      const enrollTs = Date.now()

      // Block enrollment if this face matches another staff member's
      // already-approved descriptor — prevents buddy enrollment or
      // accidentally enrolling under the wrong account. Compares against
      // approved AND pending descriptors so two pending enrollments can't
      // both go through for the same face either.
      const { data: existingRows, error: fetchErr } = await supabase
        .from('staff_face_descriptors')
        .select('staff_id, descriptor, status')
        .in('status', ['approved', 'pending'])
        .neq('staff_id', staffMember.id)

      if (fetchErr) throw new Error('Could not verify uniqueness: ' + fetchErr.message)

      for (const row of existingRows || []) {
        const result = matchDescriptor(avgDescriptor, row.descriptor)
        if (result.verified) {
          let conflictName = 'another staff member'
          const { data: conflictStaff } = await supabase
            .from('staff_profiles')
            .select('name')
            .eq('id', row.staff_id)
            .maybeSingle()
          if (conflictStaff?.name) conflictName = conflictStaff.name

          notify(
            `This face closely matches an existing enrollment for ${conflictName}. Contact admin if this is a mistake.`,
            'err'
          )
          setSaving(false)
          return
        }
      }

      // Upload the 3 enrollment shots to a PRIVATE storage bucket.
      // Path convention: {staff_id}/{timestamp}_{n}.jpg — never publicly listable.
      const photoPaths = []
      for (let i = 0; i < captures.length; i++) {
        const path = `${staffMember.id}/${enrollTs}_${i + 1}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('face-enrollments')
          .upload(path, captures[i].blob, { contentType: 'image/jpeg', upsert: false })
        if (uploadErr) throw new Error('Photo upload failed: ' + uploadErr.message)
        photoPaths.push(path)
      }

      const { error: dbError } = await supabase.from('staff_face_descriptors').insert([{
        staff_id:    staffMember.id,
        descriptor:  avgDescriptor,
        status:      isAdminEnroll ? 'approved' : 'pending',
        enrolled_by: isAdminEnroll ? currentAdminId : null,
        reviewed_by: isAdminEnroll ? currentAdminId : null,
        reviewed_at: isAdminEnroll ? new Date().toISOString() : null,
        photo_path_1: photoPaths[0] || null,
        photo_path_2: photoPaths[1] || null,
        photo_path_3: photoPaths[2] || null,
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
          ? 'Capture 3 clear shots — blink when prompted for each. This enrollment is approved immediately.'
          : 'Capture 3 clear shots — blink when prompted for each. An admin must approve this before it unlocks check-in.'}
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

      {captures.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {captures.map((c, i) => (
            <img key={i} src={URL.createObjectURL(c.blob)} alt={`Capture ${i + 1}`}
              style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</div>}

      {captures.length < CAPTURES_NEEDED ? (
        <button style={S.btn('#1e3a5f', !ready || !modelsReady || capturing)} disabled={!ready || !modelsReady || capturing} onClick={captureOne}>
          {blinkPrompt ? 'Blink now…' : capturing ? 'Capturing…' : `Capture shot ${captures.length + 1} of ${CAPTURES_NEEDED}`}
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
  const [thumbUrls, setThumbUrls] = useState({}) // descriptor id -> signed url

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('id, staff_id, enrolled_at, photo_path_1, staff_profiles(name, designation)')
      .eq('status', 'pending')
      .order('enrolled_at', { ascending: true })
    if (!error) {
      setPending(data || [])
      // Signed URLs expire in 1 hour — generated fresh each load, never stored/public
      const urls = {}
      for (const p of data || []) {
        if (p.photo_path_1) {
          const { data: signed } = await supabase.storage.from('face-enrollments').createSignedUrl(p.photo_path_1, 3600)
          if (signed?.signedUrl) urls[p.id] = signed.signedUrl
        }
      }
      setThumbUrls(urls)
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {thumbUrls[p.id] && (
              <img src={thumbUrls[p.id]} alt="Enrollment shot" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.staff_profiles?.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{p.staff_profiles?.designation || ''}</div>
            </div>
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

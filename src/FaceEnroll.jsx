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
import { loadFaceModels, extractDescriptor, averageDescriptors, matchDescriptor, avgEyeAspectRatio, detectFaceWithLandmarks, countFacesInFrame, assessCaptureConsistency } from './faceEngine'

const CAPTURES_NEEDED = 3
const BLINK_EAR_THRESHOLD = 0.28   // loosened from 0.22 — real faces/cameras often sit higher than the textbook default
const BLINK_TIMEOUT_MS = 8000      // more time for first-time users to react to the prompt
const SAMPLE_INTERVAL_MS = 80      // faster sampling so quick blinks (~100-150ms) aren't missed between checks

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Requires an eyes-closed-then-reopened cycle before allowing a capture —
// a printed photo or static image can never blink, so this blocks
// photo-based fake enrollment. Required before each of the 3 shots.
// onEar(value) is called with each live EAR reading so the UI can show a
// real-time readout — useful for calibrating BLINK_EAR_THRESHOLD per device.
async function waitForBlink(videoEl, onEar) {
  const start = Date.now()
  let sawClosed = false
  let minEarSeen = 1
  let sampleCount = 0
  let noFaceCount = 0
  while (Date.now() - start < BLINK_TIMEOUT_MS) {
    const detection = await detectFaceWithLandmarks(videoEl)
    sampleCount++
    if (detection && detection.landmarks) {
      const ear = avgEyeAspectRatio(detection.landmarks)
      minEarSeen = Math.min(minEarSeen, ear)
      onEar?.(ear)
      if (ear < BLINK_EAR_THRESHOLD) sawClosed = true
      else if (sawClosed) return true
    } else {
      noFaceCount++
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
  console.warn(
    '[FaceEnroll] blink not detected —',
    `samples: ${sampleCount}, no-face frames: ${noFaceCount}, lowest EAR: ${minEarSeen.toFixed(3)}`,
    `(threshold: ${BLINK_EAR_THRESHOLD}, video size: ${videoEl?.videoWidth}x${videoEl?.videoHeight})`
  )
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
  const capturingRef = useRef(false) // ref-lock mirrors `capturing` state to survive rapid double-clicks
  const savingRef  = useRef(false)   // ref-lock mirrors `saving` state, see save()
  const [ready, setReady]         = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [captures, setCaptures]   = useState([])   // array of { descriptor, blob }
  const [capturing, setCapturing] = useState(false)
  const [blinkPrompt, setBlinkPrompt] = useState(false)
  const [liveEar, setLiveEar] = useState(null)
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
    if (capturingRef.current) return
    if (!ready || !modelsReady || capturing) return
    if (!navigator.onLine) {
      notify('No internet connection — check your connection and try again.', 'err')
      return
    }
    capturingRef.current = true
    setCapturing(true)
    setError('')
    try {
      // Reject a capture attempt outright if more than one face is visible
      // right now — otherwise face-api.js's detectSingleFace would silently
      // pick one of the faces and the enrollment could end up keyed to the
      // wrong person, or to whichever face happened to be more prominent.
      const faceCount = await countFacesInFrame(videoRef.current)
      if (faceCount > 1) {
        notify('More than one face detected — make sure you\'re alone in frame and try again.', 'err')
        capturingRef.current = false
        setCapturing(false)
        return
      }
      if (faceCount === 0) {
        notify('No face detected — center your face in the frame and try again.', 'err')
        capturingRef.current = false
        setCapturing(false)
        return
      }

      setBlinkPrompt(true)
      const blinked = await waitForBlink(videoRef.current, setLiveEar)
      setBlinkPrompt(false)
      if (!blinked) {
        notify('No blink detected — blink naturally and try again.', 'err')
        capturingRef.current = false
        setCapturing(false)
        return
      }

      const descriptor = await extractDescriptor(videoRef.current)
      if (!descriptor) {
        notify('No face detected — center your face in the frame and try again.', 'err')
        capturingRef.current = false
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
    capturingRef.current = false
    setCapturing(false)
  }

  const reset = () => setCaptures([])

  const save = async () => {
    // Ref-based lock — savingRef, not just the `saving` state, blocks a
    // second save() invocation fired before React re-renders the disabled
    // button (rapid double-click), which would otherwise upload duplicate
    // photos and risk two descriptor rows for the same enrollment.
    if (savingRef.current) return
    if (captures.length < CAPTURES_NEEDED) return
    if (!navigator.onLine) {
      notify('No internet connection — check your connection and try again.', 'err')
      return
    }

    // Check the 3 captures agree closely enough with each other before
    // averaging them into the permanent reference vector. A blurry or
    // poorly-lit shot among the 3 can silently drag the average away from
    // the person's real appearance, which then only surfaces weeks later
    // as unexplained check-in failures. Catching it here costs a retake;
    // catching it later costs a support conversation and a re-enrollment.
    const consistency = assessCaptureConsistency(captures.map(c => c.descriptor))
    if (!consistency.ok) {
      notify('These 3 shots don\'t match each other closely enough — try retaking with steadier framing and consistent lighting.', 'err')
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      const avgDescriptor = averageDescriptors(captures.map(c => c.descriptor))
      const isAdminEnroll = mode === 'admin'
      const enrollTs = Date.now()

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

      // Duplicate-face uniqueness check AND the actual status/enrolled_by/
      // reviewed_by decision now happen server-side in enroll_face() (see
      // migration_face_server_trust.sql) — not here. Previously this
      // function ran the uniqueness check client-side and then inserted
      // directly into staff_face_descriptors with status chosen by the
      // client, which meant a crafted request could set status:'approved'
      // directly and skip the uniqueness check entirely. The RPC is now
      // the only sanctioned way to create a descriptor row.
      const { data, error: rpcErr } = await supabase.rpc('enroll_face', {
        p_staff_id:     staffMember.id,
        p_descriptor:   avgDescriptor,
        p_is_admin:     isAdminEnroll,
        p_admin_id:     isAdminEnroll ? currentAdminId : null,
        p_photo_path_1: photoPaths[0] || null,
        p_photo_path_2: photoPaths[1] || null,
        p_photo_path_3: photoPaths[2] || null,
      })

      if (rpcErr) throw rpcErr
      if (!data?.success) {
        if (data?.error === 'duplicate_face') {
          notify(data.message || 'This face matches an existing enrollment. Contact admin if this is a mistake.', 'err')
        } else if (data?.error === 'enrollment_locked') {
          notify('Enrollment is temporarily locked by admin — try again shortly.', 'err')
        } else {
          notify(data?.message || 'Enrollment could not be saved.', 'err')
        }
        savingRef.current = false
        setSaving(false)
        return
      }

      streamRef.current?.getTracks().forEach(t => t.stop())
      notify(
        isAdminEnroll ? '✅ Face enrolled and approved.' : '✅ Face captured — pending admin approval.',
        'ok'
      )
      onDone?.()
    } catch (e) {
      notify('Could not save enrollment: ' + e.message, 'err')
    }
    savingRef.current = false
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
        {blinkPrompt && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.75)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>👁 Blink now…</span>
            {liveEar !== null && (
              <span style={{ color: liveEar < 0.28 ? '#4ade80' : '#e2e8f0', fontSize: 11, fontFamily: 'monospace' }}>
                EAR {liveEar.toFixed(2)}
              </span>
            )}
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
  const [selected, setSelected] = useState(new Set()) // ids checked for bulk action
  const [bulkWorking, setBulkWorking] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('id, staff_id, enrolled_at, photo_path_1')
      .eq('status', 'pending')
      .order('enrolled_at', { ascending: true })

    if (error) {
      showToast?.('Could not load pending approvals: ' + error.message, 'err')
      setPending([])
      setLoading(false)
      return
    }

    const rows = data || []

    // staff_face_descriptors has 3 FKs to staff_profiles (staff_id,
    // enrolled_by, reviewed_by), so an embedded staff_profiles(...) select
    // is ambiguous and Supabase refuses it — fetch names separately instead.
    let namesById = {}
    const staffIds = [...new Set(rows.map(r => r.staff_id))]
    if (staffIds.length) {
      const { data: staffRows } = await supabase
        .from('staff_profiles')
        .select('id, name, designation')
        .in('id', staffIds)
      for (const s of staffRows || []) namesById[s.id] = s
    }

    setPending(rows.map(r => ({ ...r, staff_profiles: namesById[r.staff_id] || null })))
    setSelected(prev => new Set([...prev].filter(id => rows.some(r => r.id === id)))) // drop selections for rows no longer pending

    // Signed URLs expire in 1 hour — generated fresh each load, never stored/public
    const urls = {}
    for (const p of rows) {
      if (p.photo_path_1) {
        const { data: signed } = await supabase.storage.from('face-enrollments').createSignedUrl(p.photo_path_1, 3600)
        if (signed?.signedUrl) urls[p.id] = signed.signedUrl
      }
    }
    setThumbUrls(urls)
    setLoading(false)
  }, [showToast])

  useEffect(() => { fetchPending() }, [fetchPending])

  const decide = async (id, status) => {
    const { error } = await supabase.from('staff_face_descriptors').update({
      status, reviewed_by: currentAdminId, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) showToast?.('Update failed: ' + error.message, 'err')
    else { showToast?.(status === 'approved' ? '✅ Approved' : 'Rejected', status === 'approved' ? 'ok' : 'warn'); fetchPending() }
  }

  const toggleSelected = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === pending.length ? new Set() : new Set(pending.map(p => p.id)))
  }

  // Applies one decision to every selected row. Runs the same update the
  // single-row Approve/Reject buttons use, one row at a time — there's no
  // separate bulk RPC, so this is a plain sequential loop rather than a
  // single request, but it saves an admin from clicking through every row
  // individually during a start-of-year enrollment rush.
  const decideBulk = async (status) => {
    if (!selected.size || bulkWorking) return
    setBulkWorking(true)
    const ids = [...selected]
    let failCount = 0
    for (const id of ids) {
      const { error } = await supabase.from('staff_face_descriptors').update({
        status, reviewed_by: currentAdminId, reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) failCount++
    }
    setBulkWorking(false)
    setSelected(new Set())
    if (failCount > 0) {
      showToast?.(`${ids.length - failCount} of ${ids.length} updated — ${failCount} failed, please retry those individually`, 'warn')
    } else {
      showToast?.(status === 'approved' ? `✅ ${ids.length} approved` : `${ids.length} rejected`, status === 'approved' ? 'ok' : 'warn')
    }
    fetchPending()
  }

  if (loading) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
  if (!pending.length) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No pending face enrollments.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pending.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.size === pending.length} onChange={toggleSelectAll} />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => decideBulk('approved')} disabled={bulkWorking}
                style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.6 : 1 }}>
                {bulkWorking ? 'Working…' : `Approve ${selected.size}`}
              </button>
              <button onClick={() => decideBulk('rejected')} disabled={bulkWorking}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.6 : 1 }}>
                {bulkWorking ? 'Working…' : `Reject ${selected.size}`}
              </button>
            </div>
          )}
        </div>
      )}
      {pending.map(p => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
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
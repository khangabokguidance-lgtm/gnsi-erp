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
import { loadFaceModels, extractDescriptor, averageDescriptors, matchDescriptor, avgEyeAspectRatio, detectFaceWithLandmarks, countFacesInFrame, assessCaptureConsistency, assessFrameQuality } from './faceEngine'

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
      // BUGFIX: assessFrameQuality() already existed in faceEngine.js
      // specifically to catch overexposed/backlit frames (a bright light
      // source or window behind/near the camera) — exactly the scenario
      // where a photo of a wall/ceiling/signage under harsh lighting got
      // detected as "a face" (DETECTOR_OPTIONS' scoreThreshold is
      // deliberately loosened to 0.35 for mediocre-lighting tolerance,
      // which trades off against false positives on bright non-face
      // regions) and produced a garbage descriptor that then matched an
      // unrelated staff member's real enrollment. This check was defined
      // but never actually called from the capture flow — wiring it in
      // here rejects a bad-lighting frame before detection is even
      // attempted, rather than letting a false-positive detection through
      // to the duplicate-face check.
      const quality = assessFrameQuality(videoRef.current)
      if (!quality.ok) {
        const messages = {
          too_dark: 'Too dark — move to better lighting and try again.',
          too_bright: 'Too bright — point the camera away from direct light and try again.',
          backlit: 'Strong light behind you — face a light source instead of having it behind you, then try again.',
          no_frame: 'Camera not ready — try again in a moment.',
        }
        notify(messages[quality.reason] || 'Lighting conditions are not suitable — try again.', 'err')
        capturingRef.current = false
        setCapturing(false)
        return
      }

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
          // Surface the actual match distance so an admin can tell a
          // confident real duplicate (distance near 0) from a borderline
          // false positive (distance just under the 0.5 threshold) —
          // previously this said only a name, with no way to judge how
          // close the match really was.
          const distNote = typeof data.distance === 'number'
            ? ` (match distance ${data.distance.toFixed(3)} of ${data.threshold ?? 0.5} threshold — closer to 0 means a stronger/more confident match)`
            : ''
          notify((data.message || 'This face matches an existing enrollment.') + distNote + ' If lighting was poor, retake in better light before assuming this is a real duplicate.', 'err')
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

// ─── Face Enrollment Report — org-wide status/history view ─────────────────
// Every staff member's enrollment status, when they enrolled, who
// reviewed it, and how long approval took. Read-only, admin-facing.
// Distinct from FaceApprovalQueue (which only shows pending items and
// exists to act on them) — this is the reporting/audit layer over the
// same staff_face_descriptors table.

const REPORT_STATUS_META = {
  approved: { label: 'Approved', color: '#16A34A', bg: '#F0FDF4' },
  pending:  { label: 'Pending',  color: '#D97706', bg: '#FFFBEB' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
  none:     { label: 'Not enrolled', color: '#94A3B8', bg: '#F1F5F9' },
}

function exportEnrollReportCSV(rows) {
  const headers = ['Staff', 'Designation', 'Status', 'Enrolled At', 'Reviewed At', 'Reviewed By', 'Turnaround (hrs)']
  const body = rows.map(r => [
    r.staffName, r.designation || '', REPORT_STATUS_META[r.status]?.label || r.status,
    r.enrolled_at ? new Date(r.enrolled_at).toLocaleString('en-IN') : '',
    r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-IN') : '',
    r.reviewerName || '', r.turnaroundHrs ?? '',
  ])
  const csv = [headers, ...body].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `GNSI_Face_Enrollment_Report_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function FaceEnrollReport({ staffList = [] }) {
  const [descriptors, setDescriptors] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [thumbUrls, setThumbUrls] = useState({}) // staff_id -> signed url for their latest photo
  const [viewingStaffId, setViewingStaffId] = useState(null) // full-size photo modal

  const fetchAll = useCallback(async () => {
    setLoading(true)
    // One row per staff_id kept — the most recent by enrolled_at — since a
    // staff member can have multiple historical descriptor rows (e.g. a
    // rejected attempt followed by a later approved one); the report
    // should reflect their CURRENT standing, not every historical row.
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('id, staff_id, status, enrolled_at, enrolled_by, reviewed_at, reviewed_by, photo_path_1')
      .order('enrolled_at', { ascending: false })
    if (error) {
      setFetchError(error.message)
      setDescriptors([])
      setLoading(false)
      return
    }
    setFetchError(null)
    setDescriptors(data || [])

    // Signed URLs expire in 1 hour — generated fresh each load, never
    // stored/public, same pattern as FaceApprovalQueue. Only the most
    // recent row per staff_id needs a thumbnail — this is what lets an
    // admin actually SEE a staff member's stored enrollment photo (e.g.
    // to judge whether it's the cause of a false duplicate-match, rather
    // than guessing from a different, unrelated screenshot).
    const latestByStaff = {}
    for (const d of data || []) if (!latestByStaff[d.staff_id]) latestByStaff[d.staff_id] = d
    const urls = {}
    for (const d of Object.values(latestByStaff)) {
      if (d.photo_path_1) {
        const { data: signed } = await supabase.storage.from('face-enrollments').createSignedUrl(d.photo_path_1, 3600)
        if (signed?.signedUrl) urls[d.staff_id] = signed.signedUrl
      }
    }
    setThumbUrls(urls)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const staffNameById = React.useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.name])), [staffList])

  const rows = React.useMemo(() => {
    // Most-recent descriptor per staff_id (data is already ordered
    // enrolled_at desc, so the first match per staff_id wins).
    const latestByStaff = {}
    for (const d of descriptors) {
      if (!latestByStaff[d.staff_id]) latestByStaff[d.staff_id] = d
    }
    return staffList.map(s => {
      const d = latestByStaff[s.id]
      const turnaroundHrs = d?.enrolled_at && d?.reviewed_at
        ? Math.round((new Date(d.reviewed_at) - new Date(d.enrolled_at)) / 36e5 * 10) / 10
        : null
      return {
        staffId: s.id,
        staffName: s.name,
        designation: s.designation || s.department || '',
        status: d?.status || 'none',
        enrolled_at: d?.enrolled_at || null,
        reviewed_at: d?.reviewed_at || null,
        reviewerName: d?.reviewed_by ? (staffNameById[d.reviewed_by] || `#${d.reviewed_by}`) : null,
        turnaroundHrs,
      }
    }).sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''))
  }, [descriptors, staffList, staffNameById])

  const counts = React.useMemo(() => {
    const c = { approved: 0, pending: 0, rejected: 0, none: 0 }
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [rows])

  const avgTurnaroundHrs = React.useMemo(() => {
    const withTurnaround = rows.filter(r => r.turnaroundHrs != null)
    if (!withTurnaround.length) return null
    return Math.round(withTurnaround.reduce((s, r) => s + r.turnaroundHrs, 0) / withTurnaround.length * 10) / 10
  }, [rows])

  const visibleRows = React.useMemo(() => {
    let list = rows
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => (r.staffName || '').toLowerCase().includes(q))
    }
    return list
  }, [rows, statusFilter, search])

  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.4 }}>
        Every staff member's current face enrollment status — approved, pending, rejected, or never enrolled — with review history. Read-only; use the Approvals queue to act on pending requests.
      </div>

      {fetchError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#DC2626' }}>
          ⚠️ Could not load enrollment data: {fetchError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
        {['approved', 'pending', 'rejected', 'none'].map(k => (
          <button key={k} onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
            style={{
              background: REPORT_STATUS_META[k].bg, border: `1px solid ${REPORT_STATUS_META[k].color}33`, borderRadius: 10,
              padding: '12px 10px', textAlign: 'center', cursor: 'pointer',
              outline: statusFilter === k ? `2px solid ${REPORT_STATUS_META[k].color}` : 'none',
            }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: REPORT_STATUS_META[k].color }}>{counts[k] || 0}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: REPORT_STATUS_META[k].color, marginTop: 2 }}>{REPORT_STATUS_META[k].label}</div>
          </button>
        ))}
      </div>

      {avgTurnaroundHrs != null && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
          Average approval turnaround: <strong style={{ color: '#1e293b' }}>{avgTurnaroundHrs}h</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search staff by name…"
          style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
        <button onClick={() => exportEnrollReportCSV(visibleRows)}
          style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
          ⬇ Export CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 700 }}>
            <thead>
              <tr>
                {['Photo', 'Staff', 'Status', 'Enrolled', 'Reviewed', 'Reviewed By', 'Turnaround'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
                const meta = REPORT_STATUS_META[r.status]
                return (
                  <tr key={r.staffId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px' }}>
                      {thumbUrls[r.staffId] ? (
                        <img src={thumbUrls[r.staffId]} alt={`${r.staffName} enrollment`}
                          onClick={() => setViewingStaffId(r.staffId)}
                          style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>—</div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.staffName}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{r.designation}</div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: meta.color, background: meta.bg }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{r.enrolled_at ? new Date(r.enrolled_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{r.reviewerName || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{r.turnaroundHrs != null ? `${r.turnaroundHrs}h` : '—'}</td>
                  </tr>
                )
              })}
              {!visibleRows.length && (
                <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No staff match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Full-size photo view — lets an admin actually judge a stored
          enrollment photo's quality/lighting directly, e.g. to check
          whether a staff member flagged in a duplicate-match error has a
          poor-quality reference photo themselves. */}
      {viewingStaffId && thumbUrls[viewingStaffId] && (
        <div onClick={() => setViewingStaffId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>
          <div style={{ maxWidth: 420, width: '100%' }}>
            <img src={thumbUrls[viewingStaffId]} alt="Enrollment photo" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            <div style={{ color: 'white', textAlign: 'center', marginTop: 10, fontSize: 13, fontWeight: 600 }}>
              {staffNameById[viewingStaffId] || `#${viewingStaffId}`} — tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
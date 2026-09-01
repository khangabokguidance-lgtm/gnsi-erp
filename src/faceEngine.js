// faceEngine.js — shared face-api.js loader, descriptor extraction, matching
// Used by FaceEnroll.jsx (enrollment) and FaceCapture.jsx (check-in verification)

import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'          // served from public/models — see README
export const MATCH_THRESHOLD = 0.5   // euclidean distance; lower = stricter. Tune after pilot testing.
export const WEAK_MATCH_THRESHOLD = 0.5 // mirrors server_checkin's weak_face_match flag cutoff

// Shared TinyFaceDetector config — used by every detectSingleFace() call in
// this module so "make detection faster/looser" is one change, not three.
// inputSize: smaller = faster inference, at some cost to accuracy on small/
// distant faces. 160 is TinyFaceDetector's next standard step down from the
// default 224 — a real speed win on low-end phones without normally losing
// track of a face that fills a typical selfie-camera frame.
// scoreThreshold: minimum detector confidence before it reports a face at
// all. Lowered from 0.5 so a face is still recognized under mediocre
// lighting or a slightly off angle — this only affects "is there a face
// here," not who it's matched against (see MATCH_THRESHOLD security note
// on matchDescriptor below, which this does NOT loosen).
export const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 })

let modelsLoaded = false
let loadingPromise = null

export function loadFaceModels() {
  if (modelsLoaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  loadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => { modelsLoaded = true })
  return loadingPromise
}

export function areModelsLoaded() {
  return modelsLoaded
}

// Extracts a 128-length descriptor from a single video frame or image element.
// Returns null if no face was confidently detected.
export async function extractDescriptor(mediaEl) {
  const detection = await faceapi
    .detectSingleFace(mediaEl, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!detection) return null
  return Array.from(detection.descriptor)
}

// Checks how many faces are visible in the frame right now. Used before
// enrollment captures and before a check-in liveness sequence starts, so a
// second person standing in frame (assisting, photobombing, or coaching
// someone through the scan) is caught explicitly with its own message
// instead of face-api.js silently picking one of the faces via
// detectSingleFace and proceeding as if only one person was present.
// Returns the raw detection count; callers decide what to do with >1.
export async function countFacesInFrame(mediaEl) {
  const detections = await faceapi.detectAllFaces(mediaEl, DETECTOR_OPTIONS)
  return detections.length
}

// Averages multiple descriptors captured during enrollment into one reference vector.
export function averageDescriptors(descriptors) {
  const len = descriptors[0].length
  const avg = new Array(len).fill(0)
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) avg[i] += d[i]
  }
  return avg.map(v => v / descriptors.length)
}

export function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

// Quality-checks a set of enrollment descriptors against each other before
// they're averaged and saved as the permanent reference vector. If one shot
// was blurry, poorly lit, or caught mid-blink, its descriptor can sit far
// from the other two — averaging it in quietly degrades the stored
// reference without anyone noticing until check-in starts failing weeks
// later. This flags that at enrollment time instead, when a retake is
// still cheap. Returns the pairwise distances and whether any exceeded a
// consistency threshold.
export const CAPTURE_CONSISTENCY_THRESHOLD = 0.42 // looser than MATCH_THRESHOLD — these are 3 shots of the same live person seconds apart, so they should agree more closely than a separate check-in attempt would
export function assessCaptureConsistency(descriptors) {
  const pairs = []
  for (let i = 0; i < descriptors.length; i++) {
    for (let j = i + 1; j < descriptors.length; j++) {
      pairs.push({ i, j, distance: euclideanDistance(descriptors[i], descriptors[j]) })
    }
  }
  const maxDistance = pairs.length ? Math.max(...pairs.map(p => p.distance)) : 0
  return {
    ok: maxDistance <= CAPTURE_CONSISTENCY_THRESHOLD,
    maxDistance: parseFloat(maxDistance.toFixed(4)),
    pairs,
  }
}

// Returns { verified, score } — score is the raw distance (lower = better match)
//
// NOTE ON "LOOSENING" THIS: MATCH_THRESHOLD is not like the detector
// settings above — it's the distance cutoff for "is this the enrolled
// person," which is exactly what stops one staff member checking in as
// another. Raising it (e.g. 0.5 -> 0.6) makes matching more forgiving of
// lighting/angle differences, but also more likely to accept a different,
// similar-looking face. If check-in is failing specifically at the
// "verifying identity" step (not detection, not liveness) for a real
// enrolled user, the safer fix is usually re-enrolling them with 3 clearer
// shots rather than loosening this number — but if you do want to raise
// it, 0.55 is a reasonable small step, do it here and in
// migration_face_server_trust.sql's server-side copy together, since the
// server recomputes this independently and both must agree.
//
// SECURITY NOTE: this client-side result itself is a CLIENT-SIDE
// convenience check only. It is used
// for instant UI feedback (enrollment duplicate-face pre-check, etc.) but
// the result of this function must NEVER be sent to server_checkin as the
// basis for a security decision — it runs in the user's browser and can be
// trivially forged (devtools console, patched bundle, intercepted request).
// server_checkin independently recomputes this same distance server-side
// against the stored descriptor (see face_descriptor_distance() in
// migration_face_server_trust.sql) using the raw live descriptor the client
// sends via p_live_descriptor. That server-side computation is the only
// one that gates check-in.
export function matchDescriptor(liveDescriptor, storedDescriptor) {
  const score = euclideanDistance(liveDescriptor, storedDescriptor)
  return { verified: score <= MATCH_THRESHOLD, score: parseFloat(score.toFixed(4)) }
}

// ─── Liveness detection (blink + head-turn) ────────────────────────────────
// Uses face-api.js's 68-point landmarks — no extra library needed.
// Must be paired with the server-issued liveness challenge (see faceLiveness.js
// and issue_liveness_challenge / consume_liveness_challenge RPCs) — this module
// only does the client-side signal detection; the server decides trust.

const LEFT_EYE_IDX  = [36, 37, 38, 39, 40, 41]
const RIGHT_EYE_IDX = [42, 43, 44, 45, 46, 47]
const NOSE_TIP_IDX  = 30
const LEFT_JAW_IDX  = 0
const RIGHT_JAW_IDX = 16

// Eye Aspect Ratio — drops sharply during a blink, recovers after
export function eyeAspectRatio(landmarks, eyeIdx) {
  const pts = eyeIdx.map(i => landmarks.positions[i])
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const vertical1 = dist(pts[1], pts[5])
  const vertical2 = dist(pts[2], pts[4])
  const horizontal = dist(pts[0], pts[3])
  return (vertical1 + vertical2) / (2 * horizontal)
}

export function avgEyeAspectRatio(landmarks) {
  return (eyeAspectRatio(landmarks, LEFT_EYE_IDX) + eyeAspectRatio(landmarks, RIGHT_EYE_IDX)) / 2
}

// Horizontal head-turn signal: nose tip position relative to the jaw-width midpoint.
// Returns a signed ratio: negative = turned left, positive = turned right, ~0 = facing forward.
export function headTurnRatio(landmarks) {
  const nose = landmarks.positions[NOSE_TIP_IDX]
  const leftJaw = landmarks.positions[LEFT_JAW_IDX]
  const rightJaw = landmarks.positions[RIGHT_JAW_IDX]
  const jawWidth = rightJaw.x - leftJaw.x
  const jawMid = (leftJaw.x + rightJaw.x) / 2
  if (jawWidth === 0) return 0
  return (nose.x - jawMid) / jawWidth
}

export async function detectFaceWithLandmarks(mediaEl) {
  // Uses the module's static `faceapi` import (already loaded with nets by
  // loadFaceModels()) instead of a fresh dynamic import(). A dynamic import
  // here — called dozens of times per second inside the liveness polling
  // loop — could resolve to a separate, unloaded module instance whose
  // neural nets were never initialized, causing every detection to silently
  // fail or throw inside the loop.
  const result = await faceapi
    .detectSingleFace(mediaEl, DETECTOR_OPTIONS)
    .withFaceLandmarks()
  return result || null
}

// ─── Frame quality check — lighting/positioning, before liveness runs ──────
// Samples pixel brightness from the live video frame so the UI can warn
// about bad lighting/backlighting BEFORE attempting face/blink detection,
// instead of only discovering the problem after several failed detection
// attempts deep inside the liveness loop.

let qualityCanvas = null

export function assessFrameQuality(videoEl) {
  if (!videoEl || !videoEl.videoWidth) return { ok: false, reason: 'no_frame' }

  if (!qualityCanvas) qualityCanvas = document.createElement('canvas')
  const w = 64, h = 64 // downsample — only need a rough brightness estimate
  qualityCanvas.width = w
  qualityCanvas.height = h
  const ctx = qualityCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoEl, 0, 0, w, h)

  let data
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return { ok: true, reason: 'unreadable' } // don't block on a read failure (e.g. CORS on some devices)
  }

  let total = 0
  let overexposedCount = 0
  let underexposedCount = 0
  const pixelCount = w * h
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
    total += brightness
    if (brightness > 240) overexposedCount++
    if (brightness < 25) underexposedCount++
  }
  const avgBrightness = total / pixelCount
  const overexposedRatio = overexposedCount / pixelCount
  const underexposedRatio = underexposedCount / pixelCount

  // Too dark overall
  if (avgBrightness < 40) return { ok: false, reason: 'too_dark' }
  // Strong backlight — bright ceiling/window behind a dark face, exactly
  // the pattern in a photo taken under an overhead light with no fill light
  // on the face itself.
  if (overexposedRatio > 0.25 && underexposedRatio > 0.15) return { ok: false, reason: 'backlit' }
  // Blown-out overall (camera pointed near a light source)
  if (avgBrightness > 235) return { ok: false, reason: 'too_bright' }

  return { ok: true, reason: 'good', avgBrightness }
}
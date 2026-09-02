// faceEngine.js — shared face-api.js loader, descriptor extraction, matching
// Used by FaceEnroll.jsx (enrollment) and FaceCapture.jsx (check-in verification)

import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'          // served from public/models — see README
export const MATCH_THRESHOLD = 0.4   // euclidean distance; lower = stricter.
// TIGHTENED from 0.5 to 0.4 after real-world enrollment attempts showed
// 0.5 was too loose: multiple genuinely different staff, captured with
// good framing/lighting (ruling out the detection-quality issues fixed
// separately — see DETECTOR_OPTIONS/landmarksLookLikeAFace/
// faceBoxIsComplete above), still scored in the 0.44-0.49 range against
// each other — close enough to false-match under the old 0.5 cutoff.
// Tightening trades the other way: some genuine matches may now score
// closer to this new, stricter line, so a real user might occasionally
// need a retake/re-enrollment with a clearer photo where they wouldn't
// have before. That tradeoff was made deliberately, not accidentally —
// if check-in verification starts failing for real enrolled users more
// than expected, re-enrolling them with 3 clear, well-lit, fully-in-frame
// shots is the first thing to try before considering loosening this
// again. THE SERVER-SIDE COPY OF THIS EXACT VALUE (in server_checkin's
// MATCH_THRESHOLD constant and its own face_descriptor_distance
// comparison) MUST be updated to match — see
// fix_tighten_match_threshold.sql. If the two disagree, the client's
// preview and the server's actual decision will contradict each other.
export const WEAK_MATCH_THRESHOLD = 0.4 // mirrors server_checkin's weak_face_match flag cutoff — kept equal to MATCH_THRESHOLD, same as before

// Shared TinyFaceDetector config — used by every detectSingleFace() call in
// this module so "make detection faster/looser" is one change, not three.
// inputSize: smaller = faster inference, at some cost to accuracy on small/
// distant faces. 160 is TinyFaceDetector's next standard step down from the
// default 224 — a real speed win on low-end phones without normally losing
// track of a face that fills a typical selfie-camera frame.
// scoreThreshold: minimum detector confidence before it reports a face at
// all. This was previously lowered to 0.35 (from face-api.js's default
// 0.5) to tolerate mediocre lighting — but real-world enrollment attempts
// showed this was too permissive: a flat green surface with no face
// whatsoever, and a bright ceiling-light glare with only a hairline
// visible, both passed as "a face detected" at this threshold, producing
// meaningless descriptors that then coincidentally landed within
// MATCH_THRESHOLD of a real staff member's enrollment — surfacing as
// false "this face matches an existing enrollment for X" errors that had
// nothing to do with any real resemblance between two people. Restored
// to face-api.js's default 0.5: this only affects "is there a face here,"
// not who it's matched against (see MATCH_THRESHOLD security note on
// matchDescriptor below, which this does NOT loosen or tighten). A
// genuinely dim-but-real face may need a retake in better light more
// often now — that's the correct tradeoff versus accepting non-face
// frames into the recognition pipeline at all.
export const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })

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
// Validates that face-api.js's 68-point landmarks actually form a
// plausible face geometry — eyes above the nose, nose above the mouth,
// eye spacing a sane fraction of face width — rather than trusting the
// detector's raw confidence score alone. Even at scoreThreshold 0.5,
// TinyFaceDetector (a small, fast model chosen for phone performance, not
// precision) has repeatedly reported textured non-face regions — shirt
// collars, printed patterns, a hairline with no eyes in frame — as "a
// face" with enough landmark-fitting confidence to pass. This catches
// what the confidence score alone doesn't: the landmarks it produced
// don't correspond to an actual face layout.
function landmarksLookLikeAFace(landmarks) {
  if (!landmarks) return false
  const pts = landmarks.positions
  if (!pts || pts.length < 68) return false

  // 68-point layout: 36-41 left eye, 42-47 right eye, 27-35 nose, 48-67 mouth
  const avg = (idxs) => {
    const xs = idxs.map(i => pts[i].x), ys = idxs.map(i => pts[i].y)
    return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length }
  }
  const leftEye  = avg([36, 37, 38, 39, 40, 41])
  const rightEye = avg([42, 43, 44, 45, 46, 47])
  const nose     = avg([30])
  const mouth    = avg([48, 51, 54, 57])

  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  if (eyeDist < 4) return false // eyes essentially on top of each other — not a real face layout

  const eyeMidY = (leftEye.y + rightEye.y) / 2
  // Vertical ordering: eyes clearly above nose, nose clearly above mouth,
  // by at least a fraction of the eye-distance scale (so this check scales
  // with face size in the frame rather than using fixed pixel gaps).
  const minGap = eyeDist * 0.15
  if (!(nose.y > eyeMidY + minGap)) return false
  if (!(mouth.y > nose.y + minGap)) return false

  // Eyes should be roughly level with each other, not wildly tilted —
  // a real face photographed normally has eyes within a modest vertical
  // offset relative to how far apart they are.
  const eyeTilt = Math.abs(leftEye.y - rightEye.y) / eyeDist
  if (eyeTilt > 0.6) return false

  return true
}

// BUGFIX (round 2): landmarksLookLikeAFace checks ORDERING/SPACING of
// landmarks, but a genuinely partial face — a real eye and nose fragment
// clipped in one corner of the frame, rest of the frame being background
// — can still produce landmarks in plausible relative order if
// face-api.js extrapolates positions for parts it can't clearly see. That
// let through a photo showing roughly a third of a face crammed into one
// corner, which then produced a weak/non-distinctive descriptor that
// landed close to an unrelated real enrollment. This checks the face
// bounding box itself: is it big enough relative to the frame, and is it
// not clipped against an edge — i.e. is a genuinely COMPLETE face
// present, not a corner fragment.
function faceBoxIsComplete(box, mediaEl) {
  if (!box || !mediaEl) return false
  const frameW = mediaEl.videoWidth || mediaEl.naturalWidth || mediaEl.width
  const frameH = mediaEl.videoHeight || mediaEl.naturalHeight || mediaEl.height
  if (!frameW || !frameH) return false

  // Face should occupy a reasonable portion of the frame — too small and
  // either it's far away (low detail, unreliable descriptor) or it's a
  // small fragment being mistaken for a face at low relative size.
  const faceAreaRatio = (box.width * box.height) / (frameW * frameH)
  if (faceAreaRatio < 0.04) return false // face too small relative to the frame

  // Face box should not be clipped against any frame edge — a real,
  // complete, centered face has margin on all sides; a fragment crammed
  // into a corner touches or nearly touches an edge.
  const margin = Math.min(box.width, box.height) * 0.15
  if (box.x < margin) return false
  if (box.y < margin) return false
  if (box.x + box.width > frameW - margin) return false
  if (box.y + box.height > frameH - margin) return false

  return true
}

export async function extractDescriptor(mediaEl) {
  const detection = await faceapi
    .detectSingleFace(mediaEl, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!detection) return null
  if (!landmarksLookLikeAFace(detection.landmarks)) return null
  if (!faceBoxIsComplete(detection.detection.box, mediaEl)) return null
  return Array.from(detection.descriptor)
}

// Checks how many faces are visible in the frame right now. Used before
// enrollment captures and before a check-in liveness sequence starts, so a
// second person standing in frame (assisting, photobombing, or coaching
// someone through the scan) is caught explicitly with its own message
// instead of face-api.js silently picking one of the faces via
// detectSingleFace and proceeding as if only one person was present.
// Returns the count of detections that also pass landmarksLookLikeAFace —
// same geometric sanity check extractDescriptor uses — so a textured
// non-face region (shirt collar, patterned fabric) that the raw detector
// flags doesn't inflate the count or get treated as "the one face" when
// only real faces are actually present.
export async function countFacesInFrame(mediaEl) {
  const detections = await faceapi.detectAllFaces(mediaEl, DETECTOR_OPTIONS).withFaceLandmarks()
  return detections.filter(d => landmarksLookLikeAFace(d.landmarks) && faceBoxIsComplete(d.detection.box, mediaEl)).length
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

// ─── Multi-frame descriptor capture — reduces reliance on a single frame ───
// Check-in previously extracted a descriptor from exactly one video frame.
// A single unlucky frame (motion blur mid-blink, a brief bad angle, a
// momentary lighting flicker) could produce a noisier-than-usual
// descriptor — not garbage enough to fail detection outright, but poor
// enough to push a real match's distance closer to MATCH_THRESHOLD than
// it should be, or conversely make a borderline false-positive slightly
// more likely. This captures several frames during the same window the
// liveness check is already running (no extra time cost to the user) and
// picks the median-quality descriptor rather than trusting whichever
// single frame happened to be sampled.
//
// "Median-quality" here means: compute the pairwise distance of each
// candidate descriptor to every other candidate, and pick the one with
// the smallest average distance to the rest — i.e. the most representative/
// central descriptor of the set, discarding whichever frame was the outlier.
// This is a purely client-side selection step; server_checkin still
// independently recomputes the final distance against the stored
// descriptor for the ONE descriptor ultimately sent — nothing here weakens
// that server-side check, it only improves which single descriptor is sent.
export async function extractDescriptorMultiFrame(mediaEl, frameCount = 3, intervalMs = 120) {
  const candidates = []
  for (let i = 0; i < frameCount; i++) {
    const d = await extractDescriptor(mediaEl)
    if (d) candidates.push(d)
    if (i < frameCount - 1) await new Promise(r => setTimeout(r, intervalMs))
  }
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  let bestIdx = 0
  let bestAvgDist = Infinity
  for (let i = 0; i < candidates.length; i++) {
    let total = 0
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue
      total += euclideanDistance(candidates[i], candidates[j])
    }
    const avg = total / (candidates.length - 1)
    if (avg < bestAvgDist) { bestAvgDist = avg; bestIdx = i }
  }
  return candidates[bestIdx]
}

// ─── Screen/photo-replay heuristic — SOFT FLAG ONLY, not a hard block ──────
// Real depth- or texture-based liveness (the kind that reliably tells a
// live face from a printed photo or a phone/screen held up to the camera)
// needs either specialized hardware (structured light, ToF depth camera)
// or a dedicated anti-spoofing ML model — neither is available through
// face-api.js. This is NOT that. It's a cheap heuristic that flags frames
// with the visual signature commonly produced by photographing a screen or
// a flat printed photo — unnaturally uniform brightness across the face
// region (a real face lit by ambient/room light has natural falloff and
// shading from its own contours; a photograph of a photograph tends to be
// flatter) and near-zero frame-to-frame pixel change (a live person can't
// hold perfectly still to the sub-pixel level; a static photo held in
// front of a camera can). This WILL have false positives (someone braced
// very still, or genuinely flat studio-style lighting) and WILL miss real
// spoofing attempts (a video replay showing natural movement, or a
// well-lit high-quality print). Treat its output only as an extra signal
// for admin review (see is_fraud_suspected/fraud_flags), never as a
// rejection reason on its own.
let replayCanvas = null
let previousFrameData = null

export function assessReplaySignals(videoEl) {
  if (!videoEl || !videoEl.videoWidth) return { suspicious: false, reason: 'no_frame' }

  if (!replayCanvas) replayCanvas = document.createElement('canvas')
  const w = 48, h = 48
  replayCanvas.width = w
  replayCanvas.height = h
  const ctx = replayCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoEl, 0, 0, w, h)

  let data
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return { suspicious: false, reason: 'unreadable' }
  }

  // Signal 1: brightness uniformity. Compute standard deviation of
  // grayscale brightness across the sampled region — a real face has
  // natural shading (nose bridge highlight, under-eye/jaw shadow); a flat
  // photo or screen tends toward more uniform brightness.
  const brightness = []
  for (let i = 0; i < data.length; i += 4) {
    brightness.push((data[i] + data[i + 1] + data[i + 2]) / 3)
  }
  const mean = brightness.reduce((a, b) => a + b, 0) / brightness.length
  const variance = brightness.reduce((a, b) => a + (b - mean) ** 2, 0) / brightness.length
  const stdDev = Math.sqrt(variance)

  // Signal 2: frame-to-frame stillness. A held-up static photo/screen
  // moves only as much as the holder's hand trembles — typically less
  // frame-to-frame pixel change than a live face's natural micro-
  // movement (breathing, tiny head adjustments, blinking).
  let frameDelta = null
  if (previousFrameData) {
    let diffSum = 0
    for (let i = 0; i < data.length; i += 4) {
      diffSum += Math.abs(data[i] - previousFrameData[i])
    }
    frameDelta = diffSum / (data.length / 4)
  }
  previousFrameData = new Uint8ClampedArray(data)

  const flags = []
  if (stdDev < 18) flags.push('flat_lighting') // real faces rarely this uniform
  if (frameDelta !== null && frameDelta < 1.2) flags.push('low_motion') // suspiciously still between frames

  return {
    suspicious: flags.length >= 2, // require BOTH signals — either alone is too common in ordinary conditions to be meaningful on its own
    flags,
    stdDev: parseFloat(stdDev.toFixed(2)),
    frameDelta: frameDelta !== null ? parseFloat(frameDelta.toFixed(2)) : null,
  }
}

// Resets the frame-to-frame comparison baseline — call this when starting
// a fresh check-in/enrollment attempt so a previous person's last frame
// never gets compared against a new person's first frame.
export function resetReplayBaseline() {
  previousFrameData = null
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
  if (!result) return null
  // Same geometric sanity check as extractDescriptor/countFacesInFrame —
  // a textured non-face region passing the raw detector shouldn't be able
  // to drive blink/head-turn tracking either.
  if (!landmarksLookLikeAFace(result.landmarks)) return null
  return result
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
  let dimCount = 0 // face-region-plausible darkness that isn't full blackout, but is still too dark to trust
  const pixelCount = w * h
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
    total += brightness
    if (brightness > 240) overexposedCount++
    if (brightness < 25) underexposedCount++
    // BUGFIX: the original backlit check only counted pixels under 25
    // (near-total black) as "underexposed" — a face that's merely dim/
    // shadowed from strong backlighting (roughly 25-90 brightness, clearly
    // visible as a face but too degraded for a reliable descriptor) never
    // crossed that bar, so overexposedRatio>0.25 && underexposedRatio>0.15
    // stayed false even for a badly backlit shot with a bright window
    // filling a third of the frame and a shadowed face. That let through
    // exactly the kind of photo whose degraded descriptor then produced
    // false "matches an existing staff member" results at enrollment.
    if (brightness >= 25 && brightness < 90) dimCount++
  }
  const avgBrightness = total / pixelCount
  const overexposedRatio = overexposedCount / pixelCount
  const underexposedRatio = underexposedCount / pixelCount
  const dimRatio = dimCount / pixelCount

  // Too dark overall
  if (avgBrightness < 40) return { ok: false, reason: 'too_dark' }
  // Strong backlight — bright ceiling/window behind a dark face. Widened
  // to also catch a merely-dim (not pitch-black) shadowed face alongside
  // a bright light source, not just a true silhouette.
  if (overexposedRatio > 0.2 && (underexposedRatio > 0.15 || dimRatio > 0.3)) return { ok: false, reason: 'backlit' }
  // Blown-out overall (camera pointed near a light source)
  if (avgBrightness > 235) return { ok: false, reason: 'too_bright' }

  return { ok: true, reason: 'good', avgBrightness }
}
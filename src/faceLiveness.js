// faceLiveness.js — runs the blink liveness check against a live <video>
// element, and talks to the server-issued challenge RPCs.
//
// Flow:
//   1. issueChallenge(staffId) -> { challenge_id }  (server issues a single-use token)
//   2. runLivenessSequence(videoEl, onPhase) -> boolean (client-side blink detection)
//   3. server_checkin call includes p_liveness_challenge_id; consume_liveness_challenge
//      on the server is the actual trust boundary — client result alone is never trusted.
//
// Head-turn detection (waitForTurn/headTurnRatio) is kept below but unused —
// blink-only was chosen for a faster check-in. Re-enable by calling waitForTurn
// after waitForBlink in runLivenessSequence if a stronger check is wanted later.

import { supabase } from './supabase'
import { avgEyeAspectRatio, headTurnRatio, detectFaceWithLandmarks } from './faceEngine'

const BLINK_EAR_THRESHOLD   = 0.28   // loosened from 0.22 — real faces/cameras often sit higher than the textbook default (matches FaceEnroll.jsx's calibration)
const BLINK_TIMEOUT_MS      = 8000   // more time for first-time users to react to the prompt
const TURN_RATIO_THRESHOLD  = 0.18   // how far off-center counts as "turned" — unused while blink-only
const TURN_TIMEOUT_MS       = 6000
const SAMPLE_INTERVAL_MS    = 80     // faster sampling so quick blinks (~100-150ms) aren't missed between checks

export async function issueChallenge(staffId) {
  const { data, error } = await supabase.rpc('issue_liveness_challenge', { p_staff_id: staffId })
  if (error) throw error
  return data // { challenge_id, turn_direction } — turn_direction is now unused client-side
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// onPhase(phase) called with 'blink' | 'done' | 'timeout' as the sequence progresses,
// so the UI can show a "Blink now" prompt. onEar(value) is called with each
// live EAR reading so the UI can show a real-time readout for calibration.
export async function runLivenessSequence(videoEl, turnDirection, onPhase, onEar) {
  // ── Blink detection only ──
  onPhase('blink')
  const blinkOk = await waitForBlink(videoEl, onEar)
  if (!blinkOk) { onPhase('timeout'); return false }

  onPhase('done')
  return true
}

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
      if (ear < BLINK_EAR_THRESHOLD) {
        sawClosed = true
      } else if (sawClosed) {
        return true // eyes closed, then reopened — a real blink
      }
    } else {
      noFaceCount++
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
  console.warn(
    '[FaceCapture] blink not detected —',
    `samples: ${sampleCount}, no-face frames: ${noFaceCount}, lowest EAR: ${minEarSeen.toFixed(3)}`,
    `(threshold: ${BLINK_EAR_THRESHOLD}, video size: ${videoEl?.videoWidth}x${videoEl?.videoHeight})`
  )
  return false
}

async function waitForTurn(videoEl, direction) {
  const start = Date.now()
  while (Date.now() - start < TURN_TIMEOUT_MS) {
    const detection = await detectFaceWithLandmarks(videoEl)
    if (detection) {
      const ratio = headTurnRatio(detection.landmarks)
      // video is mirrored (scaleX(-1)) for a natural selfie view, so the
      // on-screen "left"/"right" the user sees matches the raw ratio sign
      // as-is — verified against the mirrored CSS transform used in FaceCapture.
      if (direction === 'left'  && ratio < -TURN_RATIO_THRESHOLD) return true
      if (direction === 'right' && ratio >  TURN_RATIO_THRESHOLD) return true
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
  return false
}
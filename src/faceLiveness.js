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

const BLINK_EAR_THRESHOLD   = 0.22   // below this = eyes considered closed; tune per camera/lighting
const BLINK_TIMEOUT_MS      = 6000
const TURN_RATIO_THRESHOLD  = 0.18   // how far off-center counts as "turned" — unused while blink-only
const TURN_TIMEOUT_MS       = 6000
const SAMPLE_INTERVAL_MS    = 120

export async function issueChallenge(staffId) {
  const { data, error } = await supabase.rpc('issue_liveness_challenge', { p_staff_id: staffId })
  if (error) throw error
  return data // { challenge_id, turn_direction } — turn_direction is now unused client-side
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// onPhase(phase) called with 'blink' | 'done' | 'timeout' as the sequence progresses,
// so the UI can show a "Blink now" prompt.
export async function runLivenessSequence(videoEl, turnDirection, onPhase) {
  // ── Blink detection only ──
  onPhase('blink')
  const blinkOk = await waitForBlink(videoEl)
  if (!blinkOk) { onPhase('timeout'); return false }

  onPhase('done')
  return true
}

async function waitForBlink(videoEl) {
  const start = Date.now()
  let sawClosed = false
  while (Date.now() - start < BLINK_TIMEOUT_MS) {
    const detection = await detectFaceWithLandmarks(videoEl)
    if (detection) {
      const ear = avgEyeAspectRatio(detection.landmarks)
      if (ear < BLINK_EAR_THRESHOLD) {
        sawClosed = true
      } else if (sawClosed) {
        return true // eyes closed, then reopened — a real blink
      }
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
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

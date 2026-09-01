// faceLiveness.js — runs the blink + head-turn liveness challenge against a
// live <video> element, and talks to the server-issued challenge RPCs.
//
// Flow:
//   1. issueChallenge(staffId) -> { challenge_id, turn_direction }
//      (server issues a single-use token AND picks a random turn direction —
//      the client cannot predict which way to turn in advance, which is
//      what makes this a real second factor rather than a scripted replay)
//   2. runLivenessSequence(videoEl, turnDirection, onPhase, onEar) -> boolean
//      (client-side blink detection, THEN head-turn-toward-the-server's-
//      chosen-direction detection)
//   3. server_checkin call includes p_liveness_challenge_id;
//      consume_liveness_challenge on the server is the actual trust
//      boundary for "was a challenge completed" — but the MATCH result
//      itself is verified server-side too (see faceEngine.js note on
//      matchDescriptor and migration_face_server_trust.sql). Client-side
//      results here are a UX gate, not a security boundary.
//
// A blink alone only proves "something with eyelids was in front of the
// camera" — a video of the enrolled person blinking, played back on a
// second screen, passes a blink-only check. Requiring a turn toward a
// direction chosen by the server AFTER the challenge is issued means a
// pre-recorded video can't know which way to turn, closing that gap.

import { supabase } from './supabase'
import { avgEyeAspectRatio, headTurnRatio, detectFaceWithLandmarks } from './faceEngine'

const BLINK_EAR_THRESHOLD   = 0.28   // matches FaceEnroll.jsx's proven-workable value — was tightened to 0.24 here, which made check-in noticeably harder to pass than enrollment for the same face/camera
const BLINK_TIMEOUT_MS      = 10000  // more time to react to the prompt, especially on a second challenge right after enrollment already succeeded
export const TURN_RATIO_THRESHOLD  = 0.13   // was 0.18 — that required a fairly extreme turn on a phone-distance camera; lowered to a turn most people do naturally when asked
const TURN_TIMEOUT_MS       = 9000
const SAMPLE_INTERVAL_MS    = 80     // faster sampling so quick blinks (~100-150ms) aren't missed between checks

export async function issueChallenge(staffId) {
  const { data, error } = await supabase.rpc('issue_liveness_challenge', { p_staff_id: staffId })
  if (error) throw error
  return data // { challenge_id, turn_direction } — turn_direction now drives the second liveness factor below
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// onPhase(phase) called with 'blink' | 'turn' | 'done' | 'timeout' as the
// sequence progresses, so the UI can show the right prompt at each stage.
// onEar(value) is called with each live EAR reading during the blink phase
// so the UI can show a real-time readout. onTurnRatio(value) is likewise
// called with each live head-turn ratio during the turn phase.
//
// turnDirection ('left' | 'right') comes from the server's issueChallenge
// response and is unknown to the client until the challenge is issued, so
// it cannot be baked into a pre-recorded video ahead of time.
export async function runLivenessSequence(videoEl, turnDirection, onPhase, onEar, onTurnRatio) {
  onPhase('blink')
  const blinkOk = await waitForBlink(videoEl, onEar)
  if (!blinkOk) { onPhase('timeout'); return false }

  if (turnDirection === 'left' || turnDirection === 'right') {
    onPhase('turn')
    const turnOk = await waitForTurn(videoEl, turnDirection, onTurnRatio)
    if (!turnOk) { onPhase('timeout'); return false }
  }

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

async function waitForTurn(videoEl, direction, onRatio) {
  const start = Date.now()
  let maxRatioSeen = 0 // magnitude, for diagnostics
  let sampleCount = 0
  let noFaceCount = 0
  while (Date.now() - start < TURN_TIMEOUT_MS) {
    const detection = await detectFaceWithLandmarks(videoEl)
    sampleCount++
    if (detection) {
      const ratio = headTurnRatio(detection.landmarks)
      maxRatioSeen = Math.max(maxRatioSeen, Math.abs(ratio))
      onRatio?.(ratio)
      // video is mirrored (scaleX(-1)) for a natural selfie view, so the
      // on-screen "left"/"right" the user sees matches the raw ratio sign
      // as-is — verified against the mirrored CSS transform used in FaceCapture.
      if (direction === 'left'  && ratio < -TURN_RATIO_THRESHOLD) return true
      if (direction === 'right' && ratio >  TURN_RATIO_THRESHOLD) return true
    } else {
      noFaceCount++
    }
    await sleep(SAMPLE_INTERVAL_MS)
  }
  console.warn(
    `[FaceCapture] head turn (${direction}) not detected within ${TURN_TIMEOUT_MS}ms —`,
    `samples: ${sampleCount}, no-face frames: ${noFaceCount}, best ratio reached: ${maxRatioSeen.toFixed(3)}`,
    `(threshold: ${TURN_RATIO_THRESHOLD})`
  )
  return false
}
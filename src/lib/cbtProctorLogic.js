// cbtProctorLogic.js — the rules behind the exam's camera check and screen shield. Pure functions (no camera, no DOM)
// so they can be unit-tested; cbtProctor.js / useCbtProctor.js do the camera work and feed these.
//
// A test's setting lives in test.marking.proctor = { camera: 'off' | 'warn' | 'strict', shield: boolean }. It sits
// inside `marking` because that object already travels with the paper (local and online) without a database change.

export const PROCTOR_OFF = { camera: 'off', shield: false, maxStrikes: 5 }

export function proctorOf(test) {
  const p = test?.marking?.proctor || {}
  const camera = p.camera === 'warn' || p.camera === 'strict' ? p.camera : 'off'
  return { camera, shield: !!p.shield, maxStrikes: Math.max(1, Number(p.maxStrikes) || 5) }
}

// ── what the camera sees ─────────────────────────────────────────────────────
// faces: [{ w, ratio }] — w = face width in the frame, ratio = where the nose sits between the two sides of the jaw
// (0.5 = looking straight at the screen; near 0 or 1 = head turned right round).
export const AWAY_LOW = 0.3, AWAY_HIGH = 0.7, NEAR_FRACTION = 0.3

export function classify(faces) {
  const list = (faces || []).filter(f => f && f.w > 0).sort((a, b) => b.w - a.w)
  if (!list.length) return 'none'
  // a second face counts when it is a real size next to the candidate's — a poster far away is smaller than that
  if (list.slice(1).some(f => f.w >= list[0].w * NEAR_FRACTION)) return 'multi'
  const r = list[0].ratio
  if (typeof r === 'number' && (r < AWAY_LOW || r > AWAY_HIGH)) return 'away'
  return 'ok'
}

// Nose position between the jaw's two ends, from the 68 face landmarks (indices 0 and 16 = jaw ends, 30 = nose tip).
export function yawRatio(points) {
  if (!points || points.length < 31) return null
  const l = points[0].x, r = points[16].x, n = points[30].x
  const span = r - l
  return span > 1 ? (n - l) / span : null
}

// A condition has to last before it counts, so a blink or a glance at the keyboard is not a violation.
export const HOLD_SECONDS = { none: 3, multi: 2, away: 5 }
const REPEAT_SECONDS = 10    // still violating this long after a strike → another strike

export function createTracker(hold = HOLD_SECONDS) {
  let state = 'ok', since = 0, lastStrike = 0
  return {
    // returns { state, event } — event is 'none' | 'multi' | 'away' when a violation is raised now, else null
    push(next, t) {
      if (next !== state) { state = next; since = t; lastStrike = 0; return { state, event: null } }
      if (state === 'ok') return { state, event: null }
      const held = (t - since) / 1000
      if (held >= hold[state] && (!lastStrike || (t - lastStrike) / 1000 >= REPEAT_SECONDS)) { lastStrike = t; return { state, event: state } }
      return { state, event: null }
    },
    reset() { state = 'ok'; since = 0; lastStrike = 0 },
  }
}

// ── keys ─────────────────────────────────────────────────────────────────────
// A browser cannot stop the operating system taking a screenshot. What it can do is notice the usual shortcuts and
// hide the exam when one is pressed, and log it.
export function isShotKey(e) {
  const k = String(e.key || '')
  if (k === 'PrintScreen' || e.code === 'PrintScreen') return true
  if (e.metaKey && e.shiftKey && /^(s|3|4|5)$/i.test(k)) return true          // Win+Shift+S, Mac Cmd+Shift+3/4/5
  return false
}
// Copy / paste / print / view-source / developer tools.
export function isBlockedKey(e) {
  const k = String(e.key || '').toLowerCase()
  if (k === 'f12') return true
  if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'p', 's', 'u'].includes(k)) return true
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) return true
  return false
}

// ── the log kept on the attempt ──────────────────────────────────────────────
export const EVENT_LABEL = {
  none: 'Face not visible', multi: 'More than one person', away: 'Looking away', nocam: 'Camera stopped',
  shot: 'Screenshot attempt', blocked: 'Copy / print / inspect attempt', hidden: 'Exam window hidden',
}
const FACE_EVENTS = ['none', 'multi', 'away', 'nocam']

export function addEvent(p, kind, t = Date.now()) {
  const cur = p && typeof p === 'object' ? p : {}
  return { ...cur, [kind]: (cur[kind] || 0) + 1, log: [...(cur.log || []), { t, k: kind }].slice(-40) }
}
export const faceStrikes = p => FACE_EVENTS.reduce((s, k) => s + ((p && p[k]) || 0), 0)
export const flagTotal = p => (p ? Object.keys(EVENT_LABEL).reduce((s, k) => s + (p[k] || 0), 0) : 0)
export const flagText = p => (p ? Object.keys(EVENT_LABEL).filter(k => p[k]).map(k => `${EVENT_LABEL[k]} ×${p[k]}`).join(', ') : '')

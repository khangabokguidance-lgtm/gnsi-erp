// cbtProctorLogic.js — the rules behind the exam's camera check and screen shield. Pure functions (no camera, no DOM)
// so they can be unit-tested; cbtProctor.js / useCbtProctor.js do the camera work and feed these.
//
// A test's setting lives in test.marking.proctor = { camera: 'off' | 'warn' | 'strict', shield: boolean }. It sits
// inside `marking` because that object already travels with the paper (local and online) without a database change.

export const PROCTOR_OFF = { camera: 'off', shield: false, maxStrikes: 5, fullscreen: 'off', maxFsExits: 3 }

export function proctorOf(test) {
  const p = test?.marking?.proctor || {}
  const camera = p.camera === 'warn' || p.camera === 'strict' ? p.camera : 'off'
  // fullscreen: 'off' | 'warn' (log + ask to return) | 'strict' (the paper is hidden until they return; too many exits submit)
  const fullscreen = p.fullscreen === 'warn' || p.fullscreen === 'strict' ? p.fullscreen : 'off'
  return { camera, shield: !!p.shield, maxStrikes: Math.max(1, Number(p.maxStrikes) || 5), fullscreen, maxFsExits: Math.max(1, Number(p.maxFsExits) || 3) }
}

// ── what the camera sees ─────────────────────────────────────────────────────
// faces: [{ w, ratio }] — w = face width in the frame, ratio = where the nose sits between the two sides of the jaw
// (0.5 = looking straight at the screen; near 0 or 1 = head turned right round).
// Tightened: a head turned a third of the way round already counts (was 0.3–0.7). A face narrower than 12% of the frame
// means the candidate has moved away from the camera — it is not the person sitting at the screen.
export const AWAY_LOW = 0.33, AWAY_HIGH = 0.67, NEAR_FRACTION = 0.3, MIN_FACE_FRACTION = 0.12
// A second face confirmed by the second, more accurate model (SSD MobileNet) counts at a smaller size than one only the fast model saw.
export const NEAR_FRACTION_DEEP = 0.18

export function classify(faces, frameW = 0) {
  const list = (faces || []).filter(f => f && f.w > 0).sort((a, b) => b.w - a.w)
  if (!list.length) return 'none'
  // a second face counts when it is a real size next to the candidate's — a poster far away is smaller than that
  if (list.slice(1).some(f => f.w >= list[0].w * (f.deep ? NEAR_FRACTION_DEEP : NEAR_FRACTION))) return 'multi'
  // only one person: are they too far from the camera?
  if (frameW > 0 && list[0].w < frameW * MIN_FACE_FRACTION) return 'far'
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
export const HOLD_SECONDS = { none: 3, far: 3, multi: 2, away: 4, nocam: 4 }
const REPEAT_SECONDS = 10    // still violating this long after a strike → another strike

export function createTracker(hold = HOLD_SECONDS) {
  let state = 'ok', since = 0, lastStrike = 0
  return {
    // returns { state, event } — event is 'none' | 'multi' | 'away' when a violation is raised now, else null
    push(next, t) {
      if (next !== state) { state = next; since = t; lastStrike = 0; return { state, event: null } }
      if (state === 'ok') return { state, event: null }
      const held = (t - since) / 1000
      if (held >= (hold[state] ?? 3) && (!lastStrike || (t - lastStrike) / 1000 >= REPEAT_SECONDS)) { lastStrike = t; return { state, event: state } }
      return { state, event: null }
    },
    reset() { state = 'ok'; since = 0; lastStrike = 0 },
  }
}

// ── two AI models, one verdict ─────────────────────────────────────────────────────────────────────────────────────
// The fast detector (Tiny Face Detector + landmarks) runs on every frame. Every few frames the second, more accurate model
// (SSD MobileNet v1) takes a second look and finds smaller, partly hidden or side-on faces the fast one misses. Boxes are
// { x, y, w, h } in the video's own pixels.
export function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const uni = a.w * a.h + b.w * b.h - inter
  return uni > 0 ? inter / uni : 0
}
const centreIn = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h }
const sameFace = (a, b) => iou(a, b) > 0.3 || centreIn(a, b) || centreIn(b, a)

/** primary: [{ w, ratio, box }] from the fast model; extra: [{ w, box }] from the second look. Faces both saw are counted once. */
export function mergeFaces(primary, extra) {
  const out = (primary || []).filter(f => f && f.w > 0)
  for (const e of extra || []) {
    if (!e || !(e.w > 0) || !e.box) continue
    if (out.some(p => p.box && sameFace(p.box, e.box))) continue
    out.push({ w: e.w, ratio: null, box: e.box, deep: true })
  }
  return out
}

/** Remembers the last second-look result for a few FRAMES (not seconds), so a slow phone and a fast laptop behave the same and the
 *  verdict does not flicker between looks. Call next() once per frame, set() when a second look finishes. */
export function createExtraMemory(keepFrames = 3) {
  let faces = [], age = Infinity
  return {
    set(f) { faces = Array.isArray(f) ? f : []; age = 0 },
    next() { if (age !== Infinity) age += 1 },
    get() { return age <= keepFrames ? faces : [] },
    clear() { faces = []; age = Infinity },
  }
}

// ── is the camera still delivering live pictures? ──────────────────────────────────────────────────────────────────
// A frozen feed (paused video, a stalled virtual camera, a lens shutter the browser reports as "muted") used to be skipped
// silently, so nothing was ever raised. Now it counts like a camera that stopped.
export const STALL_MS = 4000
export function streamHealth({ readyState = 0, paused = false, muted = false, trackLive = true, lastAdvance = 0, now = 0, stallMs = STALL_MS } = {}) {
  if (!trackLive || muted) return 'nocam'
  if (readyState < 2 || paused) return lastAdvance && now - lastAdvance < stallMs ? 'ok' : 'nocam'
  if (lastAdvance && now - lastAdvance >= stallMs) return 'nocam'       // frames have stopped advancing
  return 'ok'
}

// Software cameras that can feed a pre-recorded or someone else's picture. Matched on the device name the browser reports.
const VIRTUAL_CAM = /\b(obs|manycam|snap camera|xsplit|camtwist|ndi\b|streamlabs|vcam|virtual|splitcam|webcamoid|e2esoft|mmhmm|chromacam|youcam)\b/i
export const isVirtualCamera = label => VIRTUAL_CAM.test(String(label || ''))

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
  none: 'Face not visible', far: 'Too far from the camera', multi: 'More than one person', away: 'Looking away', nocam: 'Camera stopped', vcam: 'Virtual camera',
  shot: 'Screenshot attempt', blocked: 'Copy / print / inspect attempt', hidden: 'Exam window hidden', fsexit: 'Left full screen',
}
const FACE_EVENTS = ['none', 'far', 'multi', 'away', 'nocam']      // each one is a strike (vcam is only recorded)

export function addEvent(p, kind, t = Date.now()) {
  const cur = p && typeof p === 'object' ? p : {}
  return { ...cur, [kind]: (cur[kind] || 0) + 1, log: [...(cur.log || []), { t, k: kind }].slice(-40) }
}
export const fsExits = p => (p && p.fsexit) || 0
export const faceStrikes = p => FACE_EVENTS.reduce((s, k) => s + ((p && p[k]) || 0), 0)
export const flagTotal = p => (p ? Object.keys(EVENT_LABEL).reduce((s, k) => s + (p[k] || 0), 0) : 0)
export const flagText = p => (p ? Object.keys(EVENT_LABEL).filter(k => p[k]).map(k => `${EVENT_LABEL[k]} ×${p[k]}`).join(', ') : '')

// cbtLive.js — the staff Live view: who is where. Pure.
// The exam screen saves every 30 s (a heartbeat) even when nothing changes, so a candidate who has not saved for a while
// has lost their connection, closed the page or left.
export const DROP_AFTER_SEC = 100

// attempt as built by toAttempt(); test needs durationMin and sections. `now` in ms (staff clock).
export function liveState(a, test, now = Date.now()) {
  const total = (test.sections || []).reduce((n, s) => n + s.questions.length, 0)
  const answered = Object.values(a.answers || {}).filter(Boolean).length
  const deadline = a.startedAt + test.durationMin * 60000 + (a.extraSeconds || 0) * 1000
  const left = Math.max(0, Math.round((deadline - now) / 1000))
  if (a.state === 'submitted') return { kind: 'done', answered, total, left: 0, quietSec: null }
  const seen = a.savedAt || a.startedAt
  const quietSec = Math.max(0, Math.round((now - seen) / 1000))
  if (left <= 0) return { kind: 'timeup', answered, total, left, quietSec }
  return { kind: quietSec > DROP_AFTER_SEC ? 'dropped' : 'live', answered, total, left, quietSec }
}

export function liveCounts(attempts, test, now = Date.now()) {
  const c = { live: 0, dropped: 0, done: 0, timeup: 0 }
  for (const a of attempts) c[liveState(a, test, now).kind]++
  return c
}

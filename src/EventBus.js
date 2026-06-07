/**
 * Cross-Module Event Bus — Lightweight Pub/Sub for GNSI
 * Enables loose coupling between Attendance, Staff, Salary, Geo,
 * StudyMaterial, QuestionBank, and StudyLockers modules
 */

const listeners = new Map()

export const EventBus = {
  emit(event, payload) {
    const handlers = listeners.get(event)
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(payload) } catch (e) { console.error(`EventBus error on ${event}:`, e) }
      })
    }
    // Also dispatch as CustomEvent for non-React listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`gnsi:${event}`, { detail: payload }))
    }
  },

  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(handler)
    return () => listeners.get(event).delete(handler) // unsubscribe
  },

  once(event, handler) {
    const wrap = (payload) => {
      handler(payload)
      off()
    }
    const off = this.on(event, wrap)
    return off
  }
}

// Predefined events for type safety
export const GNSI_EVENTS = {
  // ── Existing events ──────────────────────────────────────────────────────────
  ATTENDANCE_MARKED:   'attendance:marked',      // { staffId, date, status, markedBy }
  GEO_CHECKIN:         'geo:checkin',            // { staffId, shiftId, timestamp, location }
  GEO_CHECKOUT:        'geo:checkout',           // { staffId, shiftId, timestamp }
  FRAUD_DETECTED:      'geo:fraud',              // { staffId, type, details }
  TASK_ASSIGNED:       'task:assigned',          // { taskId, staffId, title }
  TASK_COMPLETED:      'task:completed',         // { taskId, staffId, status }
  SCORE_UPDATED:       'score:updated',          // { staffId, month, totalScore }
  SCORE_CONFIRMED:     'score:confirmed',        // { month, confirmedBy }
  SALARY_SAVED:        'salary:saved',           // { month, staffCount }
  SALARY_PAID:         'salary:paid',            // { staffId, month, amount, mode }
  ADVANCE_ISSUED:      'advance:issued',         // { staffId, amount, issuedMonth }
  ADVANCE_REPAID:      'advance:repaid',         // { staffId, amount, remaining }
  STAFF_CREATED:       'staff:created',          // { staffId, name, department }
  STAFF_UPDATED:       'staff:updated',          // { staffId, changes }
  STAFF_DELETED:       'staff:deleted',          // { staffId }
  LEAVE_APPLIED:       'leave:applied',          // { staffId, days, status }
  LEAVE_APPROVED:      'leave:approved',         // { staffId, approvedBy }
  SESSION_DEAD:        'geo:session_dead',       // { staffId, shiftId, reason }

  // ── Study module events ───────────────────────────────────────────────────────
  MATERIAL_SAVED:      'gnsi:material_saved',    // { course, subject, chapter, count }
  QUESTION_SAVED:      'gnsi:question_saved',    // { subject, chapter, count }
  LOCKER_UNLOCKED:     'gnsi:locker_unlocked',   // { lockerId }
  NAVIGATE_TO:         'gnsi:navigate_to',       // { module, params: { subject?, chapter? } }
}
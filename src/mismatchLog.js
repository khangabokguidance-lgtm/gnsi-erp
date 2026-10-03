// mismatchLog.js — persistence + admin notification for detected mismatches.
// ─────────────────────────────────────────────────────────────────────────────
// student_mismatch_log has a unique index on (student_id, flag_key) WHERE
// status = 'open' (see student_mismatch_log.sql). That means:
//   - First time a flag is detected → insert, notify admins.
//   - Same flag detected again on a later scan while still open → the
//     upsert just updates detected_at/message, NO new notification.
//   - Flag no longer detected (fixed) → the caller marks it resolved.
// This is what stops the auto-scan from re-notifying admins every run for
// something already flagged and not yet fixed.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { sendPushToStaffId } from './notifications'

const LEVEL_ICON = { red: '🔴', amber: '🟡' }

// ── Circuit breaker ──────────────────────────────────────────────────────────
// If the database refuses writes to student_mismatch_log (row-level security —
// e.g. the policy migration has not been run, or this browser has no secure
// Supabase session), every student × every flag would fail the same way: the
// background scan used to log hundreds of identical errors and keep loading
// every student's profile for nothing. After the FIRST refusal we warn once and
// pause logging for this page session; reload the page to try again.
let blockedReason = null
const isDenied = (e) => !!e && (e.code === '42501' || /row-level security|permission denied/i.test(e.message || ''))
function noteDenied(action, e) {
  if (blockedReason) return
  blockedReason = e.message
  console.warn(
    `mismatchLog: the database refused to ${action} student_mismatch_log (${e.message}). ` +
    'Mismatch logging is paused until the page is reloaded. To fix: run ' +
    'supabase/migrations/20261004_student_mismatch_log_access.sql in the Supabase SQL editor, ' +
    'and make sure you are signed in (no "Secure database connection is off" banner).'
  )
}
export const isMismatchLoggingBlocked = () => blockedReason !== null

// Push every currently-active admin — same staff_profiles lookup pattern
// already used in Hostel.jsx (logLateRollCallPenalty, maintenance alerts,
// etc.), so this reuses a proven path rather than inventing a new one.
async function notifyAllAdmins(title, body, deepLink) {
  const { data: admins, error } = await supabase.from('staff_profiles').select('id').ilike('role', 'admin')
  if (error) { console.error('mismatchLog: admin lookup failed:', error.message); return }
  if (!admins?.length) return
  await Promise.all(admins.map(a => sendPushToStaffId(a.id, title, body, deepLink)))
}

// Record (or refresh) one detected flag for a student. Returns whether a
// NEW open row was created (i.e. whether this is genuinely new, not a
// re-detection of something already open) — callers use this to decide
// whether to push a notification.
async function upsertFlag(student, flag) {
  if (blockedReason) return { isNew: false, blocked: true }
  // Is there already an OPEN row for this student+flag?
  const { data: existing, error: selErr } = await supabase
    .from('student_mismatch_log')
    .select('id')
    .eq('student_id', student.id)
    .eq('flag_key', flag.key)
    .eq('status', 'open')
    .maybeSingle()
  if (selErr) {
    if (isDenied(selErr)) { noteDenied('read', selErr); return { isNew: false, blocked: true } }
    console.error('mismatchLog: lookup failed:', selErr.message); return { isNew: false }
  }

  if (existing) {
    // Already open — just refresh the detail/timestamp, no notification.
    await supabase.from('student_mismatch_log')
      .update({ message: flag.text, detected_at: new Date().toISOString() })
      .eq('id', existing.id)
    return { isNew: false, id: existing.id }
  }

  const { data: inserted, error: insErr } = await supabase.from('student_mismatch_log').insert([{
    student_id: student.id,
    student_name: student.name,
    gcc_no: student.gcc_no ? String(student.gcc_no) : null,
    flag_key: flag.key,
    level: flag.level,
    message: flag.text,
    status: 'open',
  }]).select('id').single()
  if (insErr) {
    if (isDenied(insErr)) { noteDenied('write to', insErr); return { isNew: false, blocked: true } }
    console.error('mismatchLog: insert failed:', insErr.message); return { isNew: false }
  }

  return { isNew: true, id: inserted.id }
}

// Record a batch of flags for one student and notify admins for whichever
// ones are genuinely new. Used by Student360.jsx's manual "Notify Admin"
// button (one student, flags already computed on screen) and by
// mismatchScanner.js (many students, one call per student per flag set).
export async function logAndNotify(student, flags) {
  if (!flags?.length) return { newCount: 0 }

  const results = await Promise.all(flags.map(f => upsertFlag(student, f)))
  if (results.some(r => r.blocked)) return { newCount: 0, blocked: true }
  const newFlags = flags.filter((_, i) => results[i].isNew)

  if (newFlags.length > 0) {
    const title = `⚠ ${newFlags.length} data mismatch${newFlags.length > 1 ? 'es' : ''} — ${student.name}`
    const body = newFlags.map(f => `${LEVEL_ICON[f.level] || '•'} ${f.text}`).join('\n')
    await supabase.from('student_mismatch_log')
      .update({ notified_at: new Date().toISOString() })
      .eq('student_id', student.id)
      .in('flag_key', newFlags.map(f => f.key))
      .eq('status', 'open')
    await notifyAllAdmins(title, body, `/student360?gcc=${student.gcc_no || ''}`)
  }

  return { newCount: newFlags.length }
}

// Mark flags resolved that were open but are no longer detected — called
// after a re-scan finds a student's current flag set no longer includes
// something previously logged (e.g. the missing hostel allocation was
// fixed). Doesn't notify; this is bookkeeping only.
export async function resolveStaleFlags(studentId, currentFlagKeys, resolvedBy = 'auto-scan') {
  if (blockedReason) return
  const { data: openRows, error: openErr } = await supabase
    .from('student_mismatch_log')
    .select('id, flag_key')
    .eq('student_id', studentId)
    .eq('status', 'open')
  if (openErr) { if (isDenied(openErr)) noteDenied('read', openErr); return }
  if (!openRows?.length) return

  const stale = openRows.filter(r => !currentFlagKeys.includes(r.flag_key))
  if (!stale.length) return

  await supabase.from('student_mismatch_log')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .in('id', stale.map(r => r.id))
}

// Fetch unresolved log rows (open + acknowledged) — for the admin
// dashboard. "Acknowledged" means an admin has seen it, not that it's
// fixed, so it still belongs on the dashboard until resolved (either
// manually here, or automatically by the next auto-scan finding the
// underlying issue is gone — see resolveStaleFlags). Newest first.
export async function getOpenMismatches(limit = 200) {
  const { data, error } = await supabase
    .from('student_mismatch_log')
    .select('*')
    .in('status', ['open', 'acknowledged'])
    .order('detected_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getOpenMismatches error:', error.message); return [] }
  return data || []
}

export async function acknowledgeMismatch(id, byName) {
  await supabase.from('student_mismatch_log')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: byName || null })
    .eq('id', id)
}

// Manual resolve — for when an admin fixes the underlying issue and wants
// it off the dashboard immediately rather than waiting for the next
// hourly auto-scan to notice and clear it automatically.
export async function resolveMismatch(id, byName) {
  await supabase.from('student_mismatch_log')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: byName || null })
    .eq('id', id)
}
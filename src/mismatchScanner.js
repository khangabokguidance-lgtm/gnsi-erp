// mismatchScanner.js — background auto-scan across all active students.
// ─────────────────────────────────────────────────────────────────────────────
// Runs the SAME detection (mismatchDetector.js) that Student360.jsx uses for
// a single student — looped across the whole active roster, in small batches.
// It loads only the few facts the detection reads (scanProfile.js, ~4 tiny
// requests per student) instead of Student 360's full profile.
//
// New mismatches → logged + admins notified (mismatchLog.js dedupes so a
// mismatch that's still open from a previous scan does NOT re-notify).
// Mismatches that were open but are no longer detected → marked resolved,
// silently.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { getActiveStudents } from './studentQueries'
import { loadScanProfile } from './scanProfile'
import { detectMismatches } from './mismatchDetector'
import { logAndNotify, resolveStaleFlags, isMismatchLoggingBlocked } from './mismatchLog'
import { useState, useEffect } from 'react'

const BATCH_SIZE = 3   // students processed concurrently per wave (~15 queries each)
const BATCH_DELAY_MS = 1500  // pause between waves — keeps this a background
                             // courtesy scan, not a burst that competes with
                             // whatever else is hitting Supabase right now
const START_DELAY_MS = 2 * 60 * 1000   // let the app load first
const LAST_SCAN_KEY = 'gnsi_mismatch_scan_at' // shared by every tab / reload

const SHARED_SCAN_KEY = 'mismatch_last_scan' // system_settings key: one clock for every admin computer

// The scan loads a whole profile (~25 requests) for every student, so it
// must run once for the whole school, not once per admin computer. The last
// scan time is kept in system_settings; a computer only scans when that
// time is older than the interval, and claims the slot before starting.
async function claimSharedScan(intervalMs) {
  try {
    const { data } = await supabase.from('system_settings').select('value').eq('key', SHARED_SCAN_KEY).maybeSingle()
    const raw = typeof data?.value === 'string' ? JSON.parse(data.value) : data?.value
    const last = Number(new Date(raw?.at || 0)) || 0
    if (Date.now() - last < intervalMs) return { run: false, last }
  } catch { /* no shared clock available — fall back to this computer's own */ }
  try {
    await supabase.from('system_settings').upsert(
      { key: SHARED_SCAN_KEY, value: JSON.stringify({ at: new Date().toISOString() }), updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  } catch { /* the local clock still limits this computer */ }
  return { run: true }
}

const lastScanAt = () => { try { return Number(localStorage.getItem(LAST_SCAN_KEY)) || 0 } catch { return 0 } }
const markScanned = () => { try { localStorage.setItem(LAST_SCAN_KEY, String(Date.now())) } catch { /* storage blocked */ } }
// Wait while the tab is hidden or the computer is offline.
async function waitUntilUsable() {
  while ((typeof document !== 'undefined' && document.hidden) || (typeof navigator !== 'undefined' && navigator.onLine === false)) await sleep(5000)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Scans the full active roster once. Returns a summary for logging/UI.
// Safe to call repeatedly — the underlying log table dedupes, so calling
// this too often just re-confirms the same open flags without spamming
// notifications.
export async function runMismatchScan({ onProgress } = {}) {
  // The database refused the log earlier this session (see mismatchLog.js):
  // don't load every student's profile just to fail again.
  if (isMismatchLoggingBlocked()) return { scanned: 0, studentsWithIssues: 0, newMismatches: 0, stopped: 'logging blocked' }
  const students = await getActiveStudents('id,name,gcc_no,course,batch,class_name,status,phone,house,admission_no')
  let scanned = 0, newMismatches = 0, studentsWithIssues = 0

  let stopped = null
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    if (isMismatchLoggingBlocked()) { stopped = 'logging blocked'; break }
    await waitUntilUsable()
    const batch = students.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(async student => {
      try {
        const profile = await loadScanProfile(student, supabase)
        // Some queries failed (e.g. the connection dropped): the profile
        // would read as missing records and raise false mismatches. Skip.
        if (profile.failedQueries > 0) return { hasIssues: false, newCount: 0, failed: true }
        const flags = detectMismatches(student, profile)
        if (flags.length > 0) {
          const { newCount } = await logAndNotify(student, flags)
          await resolveStaleFlags(student.id, flags.map(f => f.key))
          return { hasIssues: true, newCount }
        } else {
          // Nothing wrong now — resolve anything previously logged open.
          await resolveStaleFlags(student.id, [])
          return { hasIssues: false, newCount: 0 }
        }
      } catch (e) {
        console.error(`mismatchScanner: failed for student ${student.id}:`, e.message)
        return { hasIssues: false, newCount: 0 }
      }
    }))

    results.forEach(r => { if (r.hasIssues) studentsWithIssues++; newMismatches += r.newCount })
    scanned += batch.length
    onProgress?.({ scanned, total: students.length })
    // Most of this wave failed: the network or database is struggling.
    // Stop rather than pile hundreds more failing requests on top.
    if (results.filter(r => r.failed).length * 2 > results.length) { stopped = 'requests failing'; break }

    if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY_MS)
  }

  return { scanned, studentsWithIssues, newMismatches, ...(stopped ? { stopped } : {}) }
}

// React hook — runs a scan on mount, then on an interval. Intended to be
// mounted ONCE, admin-gated, somewhere that's always alive while an admin
// is using the portal (e.g. App.jsx itself, or a dashboard widget) — NOT
// inside Student360.jsx itself, since that component only mounts while an
// admin is actively viewing that specific tab.
export function useMismatchAutoScan({ enabled, intervalMinutes = 60 } = {}) {
  const [lastResult, setLastResult] = useState(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      // At most once per interval, however many tabs are open or reloaded.
      const intervalMs = intervalMinutes * 60 * 1000
      if (Date.now() - lastScanAt() < intervalMs) return
      const claim = await claimSharedScan(intervalMs)
      if (cancelled) return
      if (!claim.run) { try { localStorage.setItem(LAST_SCAN_KEY, String(claim.last)) } catch { /* storage blocked */ } return }
      markScanned()
      setScanning(true)
      try {
        const result = await runMismatchScan()
        if (!cancelled) setLastResult({ ...result, at: new Date().toISOString() })
      } catch (e) {
        console.error('useMismatchAutoScan: scan failed:', e.message)
      } finally {
        if (!cancelled) setScanning(false)
      }
    }

    const first = setTimeout(run, START_DELAY_MS)
    const id = setInterval(run, Math.min(intervalMinutes, 10) * 60 * 1000) // checks often, runs per the shared clock
    return () => { cancelled = true; clearTimeout(first); clearInterval(id) }
  }, [enabled, intervalMinutes])

  return { lastResult, scanning }
}
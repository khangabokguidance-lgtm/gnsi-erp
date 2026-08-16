// mismatchScanner.js — background auto-scan across all active students.
// ─────────────────────────────────────────────────────────────────────────────
// Runs the SAME detection (mismatchDetector.js) and SAME profile query
// (studentProfileLoader.js) that Student360.jsx uses for a single student
// — just looped across the whole active roster, in small batches so this
// doesn't fire (active-student-count × ~15) queries all at once.
//
// New mismatches → logged + admins notified (mismatchLog.js dedupes so a
// mismatch that's still open from a previous scan does NOT re-notify).
// Mismatches that were open but are no longer detected → marked resolved,
// silently.
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveStudents } from './studentQueries'
import { loadFullProfile } from './studentProfileLoader'
import { detectMismatches } from './mismatchDetector'
import { logAndNotify, resolveStaleFlags } from './mismatchLog'
import { useState, useEffect } from 'react'

const BATCH_SIZE = 8   // students processed concurrently per wave
const BATCH_DELAY_MS = 400  // pause between waves — keeps this a background
                             // courtesy scan, not a burst that competes with
                             // whatever else is hitting Supabase right now

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Scans the full active roster once. Returns a summary for logging/UI.
// Safe to call repeatedly — the underlying log table dedupes, so calling
// this too often just re-confirms the same open flags without spamming
// notifications.
export async function runMismatchScan({ onProgress } = {}) {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,class_name,status,phone,house,admission_no')
  let scanned = 0, newMismatches = 0, studentsWithIssues = 0

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(async student => {
      try {
        const profile = await loadFullProfile(student)
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

    if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY_MS)
  }

  return { scanned, studentsWithIssues, newMismatches }
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

    run()
    const id = setInterval(run, intervalMinutes * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [enabled, intervalMinutes])

  return { lastResult, scanning }
}
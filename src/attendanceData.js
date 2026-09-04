// attendanceData.js — single shared source of staff_geo_attendance data for
// every tab in FaceAttendance.jsx (Dashboard, Time card, Payroll, Reports,
// Attendance Summary, etc).
//
// WHY THIS EXISTS
// Before this file, DashboardView, TimeCard, and PayrollView each ran their
// own `supabase.from('staff_geo_attendance')` query with their own
// hand-rolled month-end date math and their own status-bucketing logic.
// That duplication is exactly how three related bugs shipped independently
// in this codebase:
//   1. `${month}-31` hardcoded as a range end (invalid for 28/29/30-day
//      months) — fixed piecemeal in TimeCard, then PayrollView, then
//      CashBookView/ReportsView, one tab at a time.
//   2. Charts silently dropping the 'Early Out' status from bucket counts.
//   3. An if/else-if/else day-classifier that miscounted Late/Half Day/
//      Flagged days as "Present" with zero deduction.
// Centralizing the fetch + classification here means a fix here fixes every
// consumer at once, and a new tab gets correct behaviour for free instead of
// re-deriving it.
//
// USAGE
//   const { rows, loading, error, refetch } = useAttendanceRange({
//     month, isAdmin, staffId, staffFilter,
//   })
//   const buckets = classifyRows(rows) // { byDate, byStaff, totals }
//
// `rows` is the raw staff_geo_attendance rows for the range (same shape as
// before: staff_id, date, status, late_minutes, plus whatever `select`
// below includes). `classifyRows` does the status bucketing every tab
// needs, using one normalized status list so nothing gets silently dropped.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

// ─── shared constants ───────────────────────────────────────────────────────

// Canonical status keys, in the one place they should be enumerated.
// 'Early Out' vs 'EarlyOut' is a known inconsistency in the data (see
// GNSI portal notes — GeoAttendance.jsx writes the no-space 'EarlyOut'
// string) — normalizeStatus() below collapses both to 'Early Out' so every
// consumer only ever has to check one spelling.
export const STATUS_KEYS = ['Present', 'Late', 'Half Day', 'Absent', 'Early Out', 'Flagged']

export function normalizeStatus(status) {
  if (status === 'EarlyOut') return 'Early Out'
  return status
}

// "Showed up" = Present, Late, Half Day, or Early Out (left early, but was
// there). Absent and Flagged are not attendance. Used for attendance-rate
// and time-card "days present" calculations so every tab agrees on what
// counts as attendance.
export function isPresentLike(status) {
  const s = normalizeStatus(status)
  return s === 'Present' || s === 'Late' || s === 'Half Day' || s === 'Early Out'
}

// Real calendar last day of `month` ('YYYY-MM'). Replaces every hand-rolled
// `${month}-31` that was wrong for Feb/Apr/Jun/Sep/Nov.
export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}

export function monthStart(month) {
  return `${month}-01`
}

export function todayIsoIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// Current calendar month as 'YYYY-MM', used as the default range for any
// tab that doesn't let the user pick a month explicitly.
export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── the shared hook ────────────────────────────────────────────────────────

const DEFAULT_SELECT = 'id, staff_id, date, shift_label, status, late_minutes, check_in_time, check_out_time, server_check_in_time, server_check_out_time'

/**
 * Fetches staff_geo_attendance rows for one calendar month, with the same
 * admin/staffFilter scoping every tab in FaceAttendance.jsx needs.
 *
 * @param {string} month        'YYYY-MM'
 * @param {boolean} isAdmin
 * @param {number|string} staffId       the logged-in staff's own id (used when !isAdmin)
 * @param {string} [staffFilter]        'all' or a specific staff id string (admin only)
 * @param {string} [select]             override the selected columns
 */
export function useAttendanceRange({ month, isAdmin, staffId, staffFilter = 'all', select = DEFAULT_SELECT }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('staff_geo_attendance')
      .select(select)
      .gte('date', monthStart(month))
      .lte('date', monthEnd(month))
    if (!isAdmin) q = q.eq('staff_id', staffId)
    else if (staffFilter !== 'all') q = q.eq('staff_id', staffFilter)

    const { data, error: err } = await q
    if (err) {
      console.error('useAttendanceRange fetch error:', err)
      setError(err.message)
    } else {
      setError(null)
    }
    setRows(data || [])
    setLoading(false)
  }, [month, isAdmin, staffId, staffFilter, select])

  useEffect(() => { fetchRows() }, [fetchRows])

  return { rows, loading, error, refetch: fetchRows }
}

/**
 * Fetches just today's rows across all staff — used by Dashboard's "today's
 * breakdown" donut and any other tab that needs a live today-only view,
 * without pulling the whole month.
 */
export function useAttendanceToday() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('staff_geo_attendance')
      .select('staff_id, status')
      .eq('date', todayIsoIST())
    if (err) { console.error('useAttendanceToday fetch error:', err); setError(err.message) }
    else setError(null)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  return { rows, loading, error, refetch: fetchRows }
}

// ─── the shared classifier ──────────────────────────────────────────────────

/**
 * Buckets raw attendance rows the one way every tab needs them:
 *  - byDate: per-day status counts (for trend charts)
 *  - byStaff: per-staff status counts + late-minute totals (for payroll,
 *    time card, top-late rankings, attendance rate)
 *  - totals: whole-range status counts (for the today/overall donut)
 *
 * Every status is checked independently (no if/else-if/else chain), so a
 * Half Day or Flagged row can never be silently absorbed into "Present" —
 * that was the root cause of the payroll under-deduction bug this file's
 * header describes.
 */
export function classifyRows(rows) {
  const byDate = {}
  const byStaff = {}
  const totals = Object.fromEntries(STATUS_KEYS.map(k => [k, 0]))

  for (const r of rows) {
    const status = normalizeStatus(r.status)

    if (!byDate[r.date]) byDate[r.date] = Object.fromEntries(STATUS_KEYS.map(k => [k, 0]))
    if (STATUS_KEYS.includes(status)) byDate[r.date][status]++

    if (!byStaff[r.staff_id]) {
      byStaff[r.staff_id] = {
        ...Object.fromEntries(STATUS_KEYS.map(k => [k, 0])),
        lateMinutes: 0,
        lateDays: 0,   // any day with late_minutes > 0, flat count — matches PayrollView's existing rule
        totalDays: 0,  // rows with any status at all, for attendance-rate denominators
        presentLikeDays: 0, // Present/Late/Half Day/Early Out — "showed up" days
      }
    }
    const staffBucket = byStaff[r.staff_id]
    if (STATUS_KEYS.includes(status)) staffBucket[status]++
    staffBucket.lateMinutes += r.late_minutes || 0
    if ((r.late_minutes || 0) > 0) staffBucket.lateDays++
    staffBucket.totalDays++
    if (isPresentLike(status)) staffBucket.presentLikeDays++

    if (STATUS_KEYS.includes(status)) totals[status]++
  }

  return { byDate, byStaff, totals }
}

/**
 * Applies an active salary_deduction_rules row to a classifyRows() byStaff
 * bucket for one staff member, returning the deduction breakdown Payroll/
 * Dashboard both need. Centralized so the rate names and formula only exist
 * once.
 */
export function computeDeductions(staffBucket, rules) {
  const LATE = Number(rules?.late_rate || 0)
  const ABSENT = Number(rules?.absent_rate || 0)
  const EARLY = Number(rules?.early_out_rate || 0)
  const HALFDAY = Number(rules?.half_day_rate || 0)
  const b = staffBucket || { lateDays: 0, Absent: 0, 'Early Out': 0, 'Half Day': 0 }
  const lateDed = b.lateDays * LATE
  const absentDed = b.Absent * ABSENT
  const earlyDed = b['Early Out'] * EARLY
  const halfDayDed = b['Half Day'] * HALFDAY
  return {
    lateDed, absentDed, earlyDed, halfDayDed,
    total: lateDed + absentDed + earlyDed + halfDayDed,
  }
}
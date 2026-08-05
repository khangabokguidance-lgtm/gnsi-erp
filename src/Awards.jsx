import React, { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import { supabase } from './supabase'
import { calcScores } from './Staff'
import { generateAwardCertificate } from './AwardCertificate'

// ══════════════════════════════════════════════════════════════
//  AWARDS MODULE — daily tick system (simple version)
//
//  ONE screen, opened daily by the Principal/supervisor. For every
//  nominee, tick each qualitative bullet yes/no for today. That's
//  the entire data-entry surface — no forms, no weights, no sliders,
//  no second evaluator.
//
//  Month-end score per bullet = (days ticked yes) / (days present) × 100
//  Category score = average of ALL bullet %s — tapped bullets and
//  auto bullets (attendance, roll call, tasks — pulled from existing
//  tables) sit on the same 0-100 scale and are averaged together
//  with equal weight. No blending formula to explain.
//
//  Auto bullets reuse:
//    - Staff.jsx  → calcScores() for Faculty/Non-Teaching attendance
//
//  Categorization (matches actual staff data — House Masters are staff
//  rows filed under role='Non-Teaching' or 'Teaching', identified by
//  designation, not a separate housemasters table):
//    - House Master  → designation contains House Master/Mistress/
//                       Hostel Supervisor, any role
//    - Doubt Session  → nominees drawn from the SAME House Master pool
//    - Faculty        → role='Teaching', excluding House Master designations
//    - Non-Teaching   → role='Non-Teaching', excluding House Master designations
// ══════════════════════════════════════════════════════════════

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStrOf = (dateStr) => dateStr.slice(0, 7) // 'YYYY-MM'

/** 'YYYY-MM' -> 'August 2026', for certificate/report labels. */
function monthLabelOf(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function getPublishDate(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1, 10)
  if (d.getDay() === 0) d.setDate(11)
  return d
}

// ══════════════════════════════════════════════════════════════
//  CATEGORY DEFINITIONS — every bullet tagged 'tick' or 'auto'.
//  'tick' bullets appear on the daily checklist screen.
//  'auto' bullets are computed from existing tables, no ticking needed.
// ══════════════════════════════════════════════════════════════

const CATEGORIES = {
  house_master: {
    label: 'Best House Master of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'housemasters',
    // House Master has no separate manual attendance toggle — the
    // roll_call bullet below IS the attendance signal for this category
    // (see attendanceKey below and computeCategoryRanking).
    attendanceKey: 'roll_call',
    bullets: [
      { key: 'roll_call', text: 'Timely roll call completed today', type: 'tick', mandatory: true },
      { key: 'routine_tasks', text: 'House routine tasks completed today', type: 'tick', mandatory: true },
      { key: 'present_duty', text: 'Personally present and available in the house during duty hours, not just delegating', type: 'tick' },
      { key: 'handled_issues', text: 'Handles student issues, complaints, and emergencies promptly and calmly', type: 'tick' },
      { key: 'discipline_fair', text: 'Maintains discipline and order in the house without excessive punishment', type: 'tick' },
      { key: 'house_clean', text: 'Keeps the house clean, organized, and well-maintained', type: 'tick' },
      { key: 'rapport', text: 'Builds good rapport and trust with students — approachable, fair', type: 'tick' },
      { key: 'coordinated', text: 'Coordinates well with kitchen, sickbay, and other staff for student welfare', type: 'tick' },
      { key: 'personal_example', text: 'Sets a personal example — punctual, well turned out, professional conduct', type: 'tick' },
    ],
  },
  doubt_session: {
    label: 'Best Doubt Session Staff of the Month',
    icon: '🏅',
    reward: 'Cash Reward + Certificate of Appreciation by Head of the Institution',
    // Nominees pulled from the House Master pool — doubt sessions in the
    // hostel are run by house-side staff, not classroom faculty.
    nomineeSource: 'doubt_session_pool',
    role: null,
    bullets: [
      { key: 'attended', text: 'Regular and punctual attendance at every assigned doubt session', type: 'tick' },
      { key: 'patient', text: 'Patient and approachable — students feel comfortable asking questions', type: 'tick' },
      { key: 'clear', text: "Explains concepts clearly, adapting to different students' understanding levels", type: 'tick' },
      { key: 'beyond', text: 'Goes beyond scheduled time when students genuinely need help', type: 'tick' },
      { key: 'prepared', text: 'Prepares in advance rather than answering on the fly', type: 'tick' },
      { key: 'positive_feedback', text: 'Positive feedback from students about being helpful and encouraging', type: 'tick' },
    ],
  },
  non_teaching: {
    label: 'Best Non-Teaching Staff of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'staff',
    role: 'Non-Teaching',
    bullets: [
      { key: 'prompt', text: 'Prompt and willing response to tasks and requests, without needing repeated follow-up', type: 'tick' },
      { key: 'area_clean', text: 'Maintains cleanliness/upkeep of assigned area (kitchen, grounds, maintenance, counter etc.)', type: 'tick' },
      { key: 'cooperative', text: 'Cooperative and respectful with staff and students', type: 'tick' },
      { key: 'initiative', text: 'Shows initiative — fixes or flags problems without being asked', type: 'tick' },
      { key: 'report', text: 'Day to day report submission to office', type: 'tick' },
    ],
  },
  faculty: {
    label: 'Best Faculty of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'staff',
    role: 'Teaching',
    bullets: [
      { key: 'prepared', text: 'Well-prepared for every class, clear teaching, good classroom control', type: 'tick' },
      { key: 'punctual_class', text: 'Punctual to class, uses full class time effectively', type: 'tick' },
      { key: 'approachable', text: 'Approachable to students for extra help outside class', type: 'tick' },
      { key: 'fair_eval', text: 'Fair and consistent in evaluating/correcting student work', type: 'tick' },
      { key: 'motivating', text: 'Positive, motivating presence — encourages students rather than discourages', type: 'tick' },
      { key: 'professional', text: 'Professional conduct and appearance', type: 'tick' },
    ],
  },
  house: {
    label: 'Best House of the Month',
    icon: '🏆',
    reward: 'Trophy + Certificate & All Students get Garden Visit',
    nomineeSource: 'houses',
    // Mandatory manual total mark, entered once per house per day,
    // divided by that house's active student count — the
    // "Overall Total Mark Average" from the award sheet.
    hasTotalMark: true,
    bullets: [
      { key: 'rooms_clean', text: 'Cleanliness and orderliness of rooms, corridors, and common areas (spot inspection)', type: 'tick' },
      { key: 'discipline', text: 'Discipline and behavior of students observed during checks', type: 'tick' },
      { key: 'neatness', text: 'Neatness of beds, personal belongings, uniforms', type: 'tick' },
      { key: 'hygiene', text: 'General hygiene — house and its surroundings', type: 'tick' },
      { key: 'turnout', text: 'Punctuality and turnout at assembly/roll call, observed directly', type: 'tick' },
      { key: 'atmosphere', text: 'Overall atmosphere — sense of order and care in the house', type: 'tick' },
    ],
  },
}

// Every category also has a compulsory attendance gate, separate from the
// Defaults — overridden at runtime by award_settings (see fetchSettings
// below) whenever a Settings screen value has been saved. These constants
// remain the fallback if the settings table has no row yet.
const DEFAULT_ATTENDANCE_GATE_PERCENT = 90
const DEFAULT_TOTAL_MARK_MAX = 6

// Simple in-memory cache so every component reads the same live settings
// without a separate fetch per component mount. Refreshed by
// SettingsScreen after a save (see refreshSettingsCache).
let _settingsCache = { attendanceGatePercent: DEFAULT_ATTENDANCE_GATE_PERCENT, totalMarkMax: DEFAULT_TOTAL_MARK_MAX }

async function fetchSettings() {
  const { data } = await supabase.from('award_settings').select('key, value')
  const map = {}
  ;(data || []).forEach(row => { map[row.key] = row.value })
  _settingsCache = {
    attendanceGatePercent: map.attendance_gate_percent ?? DEFAULT_ATTENDANCE_GATE_PERCENT,
    totalMarkMax: map.total_mark_max ?? DEFAULT_TOTAL_MARK_MAX,
  }
  return _settingsCache
}

async function saveSetting(key, value, updatedBy) {
  const { error } = await supabase.from('award_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy || null }, { onConflict: 'key' })
  if (error) throw error
}

// ══════════════════════════════════════════════════════════════
//  DATA LAYER
// ══════════════════════════════════════════════════════════════

// House Master identity now comes directly from the `housemasters` table
// (confirmed real schema: staff.designation does not exist). See
// fetchNominees() below — it queries `housemasters` and uses staff_profile_id
// to exclude those people from Faculty/Non-Teaching, instead of filtering
// on a designation string.

async function fetchNominees(category) {
  if (category.nomineeSource === 'houses') {
    const { data } = await supabase.from('houses').select('id, name').order('name')
    return (data || []).map(h => ({ id: h.id, name: h.name }))
  }

  // Real schema confirmed: the HR roster with role/designation/department
  // is `staff_profiles`, NOT `staff` (staff is a separate login/auth table
  // with only 13 rows and role mostly null — querying it returned nothing).
  // housemasters.staff_profile_id joins to staff_profiles.id.
  const { data: hmRows } = await supabase
    .from('housemasters')
    .select('id, name, house, designation, status, staff_profile_id')
    .eq('status', 'Active')
  const houseMasterPool = (hmRows || []).map(h => ({
    id: h.staff_profile_id, // staff_profiles.id — keeps this consistent with Faculty/Non-Teaching nomineeIds for tick storage
    name: h.name,
    house: h.house,
    designation: h.designation,
  }))
  // staff_profiles.id values of everyone already counted as a House Master,
  // so Faculty/Non-Teaching queries below can exclude them and avoid
  // double-counting the same person into two categories.
  const houseMasterStaffIds = new Set(houseMasterPool.map(h => h.id))

  if (category.nomineeSource === 'housemasters') {
    return houseMasterPool.map(h => ({ id: h.id, name: `${h.name} — ${h.designation}` }))
  }

  // Doubt Session Staff: selected FROM the House Master pool, per instruction —
  // hostel-side staff run doubt sessions, not classroom faculty.
  if (category.nomineeSource === 'doubt_session_pool') {
    return houseMasterPool.map(h => ({ id: h.id, name: h.name }))
  }

  const { data: staffRows } = await supabase.from('staff_profiles').select('id, name, role, status').eq('status', 'Active')
  const staff = staffRows || []

  // Faculty: role Teaching, excluding anyone already counted as House Master
  // (e.g. Laishram Bidyachandra is role=Teaching in `staff_profiles` but also
  // has a housemasters row — they belong to House Master, not a second
  // Faculty entry). role='Teaching + Admin' (Himan's own record) is
  // deliberately excluded by the exact match below — confirmed intentional.
  if (category.role === 'Teaching') {
    return staff
      .filter(s => s.role === 'Teaching' && !houseMasterStaffIds.has(s.id))
      .map(s => ({ id: s.id, name: s.name }))
  }

  // Non-Teaching: role Non-Teaching, excluding anyone already counted as
  // House Master — those are judged in the House Master category instead.
  if (category.role === 'Non-Teaching') {
    return staff
      .filter(s => s.role === 'Non-Teaching' && !houseMasterStaffIds.has(s.id))
      .map(s => ({ id: s.id, name: s.name }))
  }

  return staff.map(s => ({ id: s.id, name: s.name }))
}

/** Today's ticks for a category, keyed by nominee id. Returns { bulletKey: bool, present: bool|null, totalMark: number|null } per nominee. */
async function fetchTodayTicks(categoryKey, dateStr) {
  const { data } = await supabase.from('award_daily_ticks').select('*').eq('category_key', categoryKey).eq('tick_date', dateStr)
  const map = {}
  ;(data || []).forEach(row => { map[row.nominee_id] = { ...row.bullet_ticks, present: row.present, totalMark: row.total_mark } })
  return map
}

/** Saves one nominee's ticks for today. bulletTicks: { bulletKey: true|false }. present: true|false — compulsory, separate from bullets. totalMark: manual mark for Best House, divided by student count at scoring time. */
async function saveTicks(categoryKey, nomineeId, nomineeName, dateStr, bulletTicks, present, totalMark = null) {
  const payload = {
    category_key: categoryKey,
    nominee_id: String(nomineeId),
    nominee_name: nomineeName,
    tick_date: dateStr,
    bullet_ticks: bulletTicks,
    present,
    total_mark: totalMark,
  }
  const { error } = await supabase.from('award_daily_ticks').upsert(payload, { onConflict: 'category_key,nominee_id,tick_date' })
  if (error) throw error
}

/** All ticks for a nominee across the month, for computing the % score. */
async function fetchMonthTicks(categoryKey, nomineeId, monthStr) {
  const { data } = await supabase
    .from('award_daily_ticks')
    .select('bullet_ticks, tick_date, present, total_mark')
    .eq('category_key', categoryKey)
    .eq('nominee_id', String(nomineeId))
    .gte('tick_date', `${monthStr}-01`)
    .lte('tick_date', `${monthStr}-31`)
  return data || []
}

/** Leave records covering a specific date, keyed by nominee id — so a nominee on leave shows a clear "On leave" state instead of silently failing the attendance gate. */
async function fetchLeaveForDate(categoryKey, dateStr) {
  const { data } = await supabase
    .from('award_nominee_leave')
    .select('*')
    .eq('category_key', categoryKey)
    .lte('start_date', dateStr)
    .gte('end_date', dateStr)
  const map = {}
  ;(data || []).forEach(row => { map[row.nominee_id] = row })
  return map
}

/** All leave records for a category (any date), used by computeCategoryRanking to exclude leave days from the attendance denominator for the whole month. */
async function fetchLeaveForMonth(categoryKey, monthStr) {
  const { data } = await supabase
    .from('award_nominee_leave')
    .select('*')
    .eq('category_key', categoryKey)
    .lte('start_date', `${monthStr}-31`)
    .gte('end_date', `${monthStr}-01`)
  return data || []
}

async function saveLeave(categoryKey, nomineeId, nomineeName, startDate, endDate, reason, createdBy) {
  const { error } = await supabase.from('award_nominee_leave').insert({
    category_key: categoryKey,
    nominee_id: String(nomineeId),
    nominee_name: nomineeName,
    start_date: startDate,
    end_date: endDate,
    reason: reason || null,
    created_by: createdBy || null,
  })
  if (error) throw error
}

async function deleteLeave(leaveId) {
  const { error } = await supabase.from('award_nominee_leave').delete().eq('id', leaveId)
  if (error) throw error
}

// ══════════════════════════════════════════════════════════════
//  SCORING — % of days ticked yes, per bullet, averaged with auto bullets
// ══════════════════════════════════════════════════════════════

/** % score for one tick-type bullet: days ticked yes / days recorded (not days in month — only counts days someone actually ticked). */
function bulletTickPercent(monthTickRows, bulletKey) {
  const recorded = monthTickRows.filter(r => r.bullet_ticks && bulletKey in r.bullet_ticks)
  if (recorded.length === 0) return null
  const yesCount = recorded.filter(r => r.bullet_ticks[bulletKey] === true).length
  return Math.round((yesCount / recorded.length) * 100)
}

/** Attendance % this month: days marked present / days attendance was recorded at all. */
function attendancePercent(monthTickRows) {
  const recorded = monthTickRows.filter(r => r.present !== null && r.present !== undefined)
  if (recorded.length === 0) return null
  const presentCount = recorded.filter(r => r.present === true).length
  return Math.round((presentCount / recorded.length) * 100)
}

/** Previous calendar month, as 'YYYY-MM', given a 'YYYY-MM' string. */
function previousMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 2, 1) // m-1 is this month (0-indexed), -1 more for previous
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Longest run of consecutive days (by tick_date) where every tick-bullet was YES and attendance passed. Used for streak tracking. */
function longestGoodStreak(monthRows, tickBulletKeys, attendanceKey) {
  const sorted = [...monthRows].sort((a, b) => a.tick_date.localeCompare(b.tick_date))
  let longest = 0
  let current = 0
  let prevDate = null
  for (const row of sorted) {
    const allBulletsYes = tickBulletKeys.every(k => row.bullet_ticks?.[k] === true)
    const attendanceOk = attendanceKey ? row.bullet_ticks?.[attendanceKey] === true : row.present !== false
    const isGoodDay = allBulletsYes && attendanceOk
    const isConsecutive = prevDate && daysBetween(prevDate, row.tick_date) === 1
    if (isGoodDay) {
      current = isConsecutive ? current + 1 : 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
    prevDate = row.tick_date
  }
  return longest
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  return Math.round((d2 - d1) / 86400000)
}

async function computeCategoryRanking(categoryKey, monthStr, { includeTrendAndStreak = false } = {}) {
  const category = CATEGORIES[categoryKey]
  const nominees = await fetchNominees(category)

  // Faculty/Non-Teaching also have real attendance data in
  // staff_monthly_scores (from the Staff module) — prefer that over the
  // daily attendance tick when it exists, since it's the more authoritative
  // source; fall back to the tick for categories with no such table
  // (House Master, Doubt Session Staff, Best House).
  let staffScores = null
  if (categoryKey === 'non_teaching' || categoryKey === 'faculty') {
    const { data } = await supabase.from('staff_monthly_scores').select('*').eq('month', monthStr)
    staffScores = {}
    ;(data || []).forEach(r => { staffScores[r.staff_id] = r })
  }

  // Leave records for the month — a nominee whose leave covers EVERY
  // ticked/recorded day gets a clear "On leave" reason instead of
  // silently failing the attendance gate, which looks identical to poor
  // attendance from someone nobody ever excused.
  const leaveRows = await fetchLeaveForMonth(categoryKey, monthStr)
  const leaveByNominee = {}
  leaveRows.forEach(row => {
    if (!leaveByNominee[row.nominee_id]) leaveByNominee[row.nominee_id] = []
    leaveByNominee[row.nominee_id].push(row)
  })
  const isDateCoveredByLeave = (nomineeId, dateStr) => {
    const records = leaveByNominee[String(nomineeId)] || []
    return records.some(r => dateStr >= r.start_date && dateStr <= r.end_date)
  }

  const results = await Promise.all(nominees.map(async (n) => {
    const monthRows = await fetchMonthTicks(categoryKey, n.id, monthStr)
    const tickBullets = category.bullets.filter(b => b.type === 'tick' && b.key !== category.attendanceKey)
    const tickPercents = tickBullets.map(b => bulletTickPercent(monthRows, b.key)).filter(v => v !== null)

    // Leave check — if this nominee has a leave record covering EVERY day
    // in this month that would otherwise be judged (i.e. no ticks exist
    // outside their leave range), they're shown as "On leave" instead of
    // failing the attendance gate. This is a labeled exclusion, not a
    // silent one — distinguishes "excused" from "poor attendance nobody
    // ever accounted for."
    const leaveRecordsThisNominee = leaveByNominee[String(n.id)] || []
    if (leaveRecordsThisNominee.length > 0) {
      const unexcusedTickDays = monthRows.filter(r => !isDateCoveredByLeave(n.id, r.tick_date))
      if (unexcusedTickDays.length === 0 && monthRows.length > 0) {
        const leaveReason = leaveRecordsThisNominee[0].reason
        return { nomineeId: n.id, name: n.name, score: null, attPct: null, daysTicked: monthRows.length, eligible: false, onLeave: true, reason: leaveReason ? `On leave — ${leaveReason}` : 'On leave this period' }
      }
    }

    // Compulsory attendance gate — checked for every category, no exceptions.
    // House Master has no separate manual toggle: the roll_call bullet IS
    // the attendance signal (a day the roll call wasn't ticked = absent).
    let attPct
    if (category.attendanceKey) {
      attPct = bulletTickPercent(monthRows, category.attendanceKey)
    } else if ((categoryKey === 'non_teaching' || categoryKey === 'faculty') && staffScores?.[n.id]) {
      const row = staffScores[n.id]
      const wd = row.working_days || 26
      attPct = Math.round(((row.days_present || 0) / wd) * 100)
    } else {
      attPct = attendancePercent(monthRows)
    }

    if (attPct === null) {
      return { nomineeId: n.id, name: n.name, score: null, attPct: null, daysTicked: monthRows.length, eligible: false, reason: 'No attendance recorded this month' }
    }
    if (attPct < _settingsCache.attendanceGatePercent) {
      return { nomineeId: n.id, name: n.name, score: null, attPct, daysTicked: monthRows.length, eligible: false, reason: `Below ${_settingsCache.attendanceGatePercent}% attendance gate` }
    }

    const bulletScore = tickPercents.length > 0
      ? Math.round(tickPercents.reduce((a, b) => a + b, 0) / tickPercents.length)
      : null

    // Best House: fixed-scale mark, same maximum for every house
    // (settings-configurable, default 6 — one point per checklist bullet).
    // Each day's mark is scaled to a 0-100 percentage —
    // mark_earned_% = (mark / max) x 100 — the same scale as the
    // checklist, so the two can be fairly averaged.
    let markPercent = null
    if (category.hasTotalMark) {
      const daysWithMark = monthRows.filter(r => r.total_mark !== null && r.total_mark !== undefined)
      if (daysWithMark.length > 0) {
        const dailyPercents = daysWithMark.map(r => (r.total_mark / _settingsCache.totalMarkMax) * 100)
        markPercent = parseFloat((dailyPercents.reduce((a, b) => a + b, 0) / dailyPercents.length).toFixed(2))
      }
    }

    // Final score: for Best House, the checklist % and the mark % are
    // both 0-100 scale, so they're averaged together into one ranking
    // score. Other categories are unaffected — score stays bulletScore.
    let score = bulletScore
    if (category.hasTotalMark) {
      const parts = [bulletScore, markPercent].filter(v => v !== null)
      score = parts.length > 0 ? parseFloat((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2)) : null
    }

    const base = { nomineeId: n.id, name: n.name, score, attPct, bulletScore, markPercent, daysTicked: monthRows.length, eligible: score !== null }

    if (!includeTrendAndStreak) return base

    // Streak: longest run of consecutive days this month where every
    // bullet was ticked yes AND attendance passed that day.
    const streak = longestGoodStreak(monthRows, tickBullets.map(b => b.key), category.attendanceKey)

    return { ...base, streak }
  }))

  const eligible = results.filter(r => r.eligible)
  const ineligible = results.filter(r => !r.eligible)
  eligible.sort((a, b) => b.score - a.score)
  const ranked = [...eligible, ...ineligible]

  if (!includeTrendAndStreak) return ranked

  // Month-over-month trend: re-score everyone against last month (no
  // trend/streak needed for that inner call — avoids infinite recursion
  // and extra work) and diff the scores.
  const prevMonthStr = previousMonthStr(monthStr)
  const prevRanking = await computeCategoryRanking(categoryKey, prevMonthStr, { includeTrendAndStreak: false })
  const prevScoreByNominee = {}
  prevRanking.forEach(r => { prevScoreByNominee[r.nomineeId] = r.score })

  return ranked.map(r => {
    const prevScore = prevScoreByNominee[r.nomineeId]
    const trend = (r.score !== null && prevScore !== null && prevScore !== undefined)
      ? parseFloat((r.score - prevScore).toFixed(2))
      : null
    return { ...r, prevScore: prevScore ?? null, trend }
  })
}

async function fetchPublishedWinner(categoryKey, monthStr) {
  const { data } = await supabase.from('award_winners').select('*').eq('category_key', categoryKey).eq('month', monthStr).maybeSingle()
  return data
}

async function publishWinner(categoryKey, monthStr, winner) {
  const publishDate = getPublishDate(monthStr)
  const payload = {
    category_key: categoryKey,
    month: monthStr,
    nominee_id: String(winner.nomineeId),
    nominee_name: winner.name,
    score: winner.score,
    publish_date: publishDate.toISOString().slice(0, 10),
    status: 'published',
    published_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('award_winners').upsert(payload, { onConflict: 'category_key,month' })
  if (error) throw error
}

// ══════════════════════════════════════════════════════════════
//  STYLES — Ledger & Crest
// ══════════════════════════════════════════════════════════════

const S = {
  page: { fontFamily: "'Georgia', serif", background: '#F8F6F0', minHeight: '100vh', padding: 20 },
  header: { color: '#0B1E3D', borderBottom: '3px solid #C9A24B', paddingBottom: 12, marginBottom: 16 },
  modeToggle: { display: 'flex', gap: 8, marginBottom: 16 },
  modeBtn: (active) => ({ padding: '8px 16px', borderRadius: 6, border: active ? '2px solid #C9A24B' : '1px solid #ccc', background: active ? '#0B1E3D' : '#fff', color: active ? '#fff' : '#0B1E3D', cursor: 'pointer', fontWeight: 600, fontSize: 13 }),
  card: { background: '#fff', border: '1px solid #e0ddd3', borderRadius: 8, padding: 16, marginBottom: 12 },
  catTabRow: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  catTab: (active) => ({ padding: '8px 14px', borderRadius: 6, border: active ? '2px solid #C9A24B' : '1px solid #ccc', background: active ? '#0B1E3D' : '#fff', color: active ? '#fff' : '#0B1E3D', cursor: 'pointer', fontWeight: 600, fontSize: 12 }),
  nomineeRow: { padding: '12px 0', borderBottom: '1px solid #f0eee6' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 },
  rankRow: (isWinner) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 6, marginBottom: 6, background: isWinner ? '#FFF8E7' : '#fafafa', border: isWinner ? '2px solid #C9A24B' : '1px solid #eee' }),
  btn: { background: '#0B1E3D', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  badge: (kind) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: kind === 'ok' ? '#e6f4ea' : kind === 'warn' ? '#fdecea' : '#eef0f5', color: kind === 'ok' ? '#1e7e34' : kind === 'warn' ? '#b3261e' : '#333' }),
}

// ══════════════════════════════════════════════════════════════
//  DAILY TICK SCREEN — the screen opened every day
// ══════════════════════════════════════════════════════════════

function DailyTickScreen() {
  const [activeKey, setActiveKey] = useState('faculty')
  const [nominees, setNominees] = useState([])
  const [ticks, setTicks] = useState({}) // { nomineeId: { bulletKey: bool, present: bool|null } }
  const [savedIds, setSavedIds] = useState(new Set()) // nominee ids confirmed saved to the DB for the selected date
  const [expandedIds, setExpandedIds] = useState(new Set()) // nominee ids manually expanded despite being saved
  const [hasAutoAttendance, setHasAutoAttendance] = useState({}) // { nomineeId: bool } — true only if staff_monthly_scores actually has a row for them this month
  const [onLeave, setOnLeave] = useState({}) // { nomineeId: leaveRecord } — nominees excused for the selected date
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [settings, setSettings] = useState({ attendanceGatePercent: DEFAULT_ATTENDANCE_GATE_PERCENT, totalMarkMax: DEFAULT_TOTAL_MARK_MAX })
  // Editable past days: defaults to today, but can be changed via the date
  // picker in the header — lets the supervisor go back and fix a mistake
  // from an earlier day instead of only ever being able to edit "today."
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const category = CATEGORIES[activeKey]
  const date = selectedDate
  const isToday = selectedDate === todayStr()
  // House Master has no separate manual toggle at all: the roll_call
  // bullet IS the attendance signal. Faculty/Non-Teaching's toggle
  // visibility is per-nominee (see hasAutoAttendance) — staff_monthly_scores
  // is currently empty, so nobody has real auto data yet and the manual
  // toggle correctly shows for everyone until that table gets populated.
  const categoryHasAutoAttendance = !!category.attendanceKey

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [list, todayMap, settingsResult, leaveMap] = await Promise.all([
        fetchNominees(category),
        fetchTodayTicks(activeKey, date),
        fetchSettings(),
        fetchLeaveForDate(activeKey, date),
      ])

      let autoMap = {}
      if (activeKey === 'non_teaching' || activeKey === 'faculty') {
        const monthStr = date.slice(0, 7)
        const { data } = await supabase.from('staff_monthly_scores').select('staff_id').eq('month', monthStr)
        const idsWithScores = new Set((data || []).map(r => r.staff_id))
        list.forEach(n => { autoMap[n.id] = idsWithScores.has(n.id) })
      }

      // Anyone already present in todayMap has a real saved row for the
      // selected date — start them collapsed and marked done, so the list
      // only demands attention for people who genuinely haven't been ticked.
      const alreadySaved = new Set(Object.keys(todayMap).map(String))

      if (!cancelled) {
        setNominees(list)
        setTicks(todayMap)
        setHasAutoAttendance(autoMap)
        setSavedIds(alreadySaved)
        setExpandedIds(new Set())
        setSettings(settingsResult)
        setOnLeave(leaveMap)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeKey, selectedDate])

  const handleToggle = (nomineeId, bulletKey) => {
    setTicks(prev => ({
      ...prev,
      [nomineeId]: { ...(prev[nomineeId] || {}), [bulletKey]: !(prev[nomineeId]?.[bulletKey]) },
    }))
  }

  const handlePresentToggle = (nomineeId, value) => {
    setTicks(prev => ({
      ...prev,
      [nomineeId]: { ...(prev[nomineeId] || {}), present: value },
    }))
  }

  const toggleExpanded = (nomineeId) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(nomineeId)) next.delete(nomineeId)
      else next.add(nomineeId)
      return next
    })
  }

  const handleMarkChange = (nomineeId, value) => {
    setTicks(prev => ({
      ...prev,
      [nomineeId]: { ...(prev[nomineeId] || {}), totalMark: value === '' ? undefined : Number(value) },
    }))
  }

  /** Builds the default "normal day" tick set for one nominee: all bullets yes, present, and — for Best House — full marks. Used by both single-save defaults and Mark All. */
  const defaultGoodTicks = (nomineeId) => {
    const base = {}
    category.bullets.filter(b => b.type === 'tick').forEach(b => { base[b.key] = true })
    base.present = true
    if (category.hasTotalMark) base.totalMark = _settingsCache.totalMarkMax
    return base
  }

  const saveOneNominee = async (nominee, nomineeTicksOverride) => {
    const nomineeTicks = nomineeTicksOverride || ticks[nominee.id] || {}
    const { present, totalMark, ...bulletTicks } = nomineeTicks
    const nomineeUsesAutoAttendance = categoryHasAutoAttendance || hasAutoAttendance[nominee.id]
    if (!nomineeUsesAutoAttendance && present === undefined) {
      throw new Error('Attendance is compulsory — mark present or absent before saving.')
    }
    if (category.hasTotalMark && (totalMark === undefined || totalMark === null || isNaN(totalMark))) {
      throw new Error('Total mark is compulsory — enter today\u2019s inspection mark before saving.')
    }
    const missingMandatory = category.bullets.filter(b => b.mandatory && bulletTicks[b.key] === undefined)
    if (missingMandatory.length > 0) {
      throw new Error(`Mandatory: "${missingMandatory[0].text}" must be ticked yes or no before saving.`)
    }
    await saveTicks(activeKey, nominee.id, nominee.name, date, bulletTicks, nomineeUsesAutoAttendance ? null : !!present, category.hasTotalMark ? totalMark : null)
  }

  const handleSave = async (nominee) => {
    setSavingId(nominee.id)
    try {
      await saveOneNominee(nominee)
      setSavedIds(prev => new Set(prev).add(String(nominee.id)))
      setExpandedIds(prev => { const next = new Set(prev); next.delete(nominee.id); return next })
    } catch (err) {
      alert(err.message.startsWith('Attendance') || err.message.startsWith('Total mark') || err.message.startsWith('Mandatory') ? err.message : 'Could not save: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  /** Advanced: mark everyone not yet saved today as a normal day (present, all bullets yes) in one action. Anyone already saved, or manually expanded to edit, is left untouched — this only fills the gap, it never overwrites an exception someone already recorded. */
  const handleMarkAllGood = async () => {
    const remaining = nominees.filter(n => !savedIds.has(String(n.id)))
    if (remaining.length === 0) return
    if (!window.confirm(`Mark all ${remaining.length} remaining nominee(s) as present with every bullet ticked yes for today? You can still open and adjust any individual entry afterward.`)) return
    setBulkSaving(true)
    const newlySaved = new Set(savedIds)
    const failures = []
    for (const n of remaining) {
      const goodTicks = defaultGoodTicks(n.id)
      try {
        await saveOneNominee(n, goodTicks)
        setTicks(prev => ({ ...prev, [n.id]: goodTicks }))
        newlySaved.add(String(n.id))
      } catch (err) {
        failures.push(n.name)
      }
    }
    setSavedIds(newlySaved)
    setBulkSaving(false)
    if (failures.length > 0) {
      alert(`Saved ${remaining.length - failures.length} of ${remaining.length}. Could not save: ${failures.join(', ')}`)
    }
  }

  const tickBullets = category.bullets.filter(b => b.type === 'tick')
  const savedCount = nominees.filter(n => savedIds.has(String(n.id))).length
  const remainingCount = nominees.length - savedCount

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Editing:</label>
        <input type="date" value={selectedDate} max={todayStr()} onChange={e => setSelectedDate(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
        {!isToday && <span style={{ ...S.badge('warn') }}>Editing a past day</span>}
        {!isToday && <button style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedDate(todayStr())}>Back to today</button>}
      </div>

      <div style={{ ...S.card, background: '#FFF8E7', border: '1px solid #C9A24B' }}>
        <strong>{category.icon} {category.label}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
          {isToday ? 'Today' : 'Date'}: {date}. Tick what you observed. Attendance is compulsory
          {category.attendanceKey
            ? ' — derived automatically from the roll-call tick below, no separate mark needed.'
            : activeKey === 'non_teaching' || activeKey === 'faculty'
              ? ' — pulled automatically from the Staff module when available, otherwise mark present/absent below.'
              : ' — mark present/absent for every nominee.'}
        </p>
        {!loading && nominees.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(201,162,75,0.3)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0B1E3D' }}>
              {savedCount} of {nominees.length} done {isToday ? 'today' : 'for this date'}
              {remainingCount > 0 && <span style={{ color: '#b3261e' }}> · {remainingCount} remaining</span>}
            </span>
            {remainingCount > 0 && (
              <button style={{ ...S.btn, padding: '6px 14px', fontSize: 12 }} onClick={handleMarkAllGood} disabled={bulkSaving}>
                {bulkSaving ? 'Marking…' : `Mark all ${remainingCount} remaining as normal day`}
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? <p>Loading…</p> : nominees.map(n => {
        const leaveRecord = onLeave[String(n.id)]
        if (leaveRecord) {
          return (
            <div key={n.id} style={{ ...S.card, background: '#f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
              <span><span style={{ ...S.badge('neutral'), marginRight: 8 }}>ON LEAVE</span><strong>{n.name}</strong>{leaveRecord.reason && <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{leaveRecord.reason}</span>}</span>
            </div>
          )
        }

        const nomineeUsesAutoAttendance = categoryHasAutoAttendance || hasAutoAttendance[n.id]
        const isSaved = savedIds.has(String(n.id))
        const isExpanded = expandedIds.has(n.id) || !isSaved

        if (isSaved && !isExpanded) {
          return (
            <div key={n.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
              <span><span style={{ color: '#1e7e34', marginRight: 8 }}>✓</span><strong>{n.name}</strong></span>
              <button style={{ ...S.btnGhost, padding: '4px 12px', fontSize: 12 }} onClick={() => toggleExpanded(n.id)}>Edit</button>
            </div>
          )
        }

        return (
        <div key={n.id} style={S.card}>
          <div style={{ ...S.nomineeRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{n.name}</strong>
            {isSaved && <button style={{ ...S.btnGhost, padding: '2px 10px', fontSize: 11 }} onClick={() => toggleExpanded(n.id)}>Collapse</button>}
          </div>

          {!nomineeUsesAutoAttendance && (
            <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0eee6', marginBottom: 6 }}>
              <label style={{ ...S.checkRow, fontWeight: 600 }}>
                <input type="radio" name={`present-${n.id}`} checked={ticks[n.id]?.present === true} onChange={() => handlePresentToggle(n.id, true)} />
                Present today
              </label>
              <label style={{ ...S.checkRow, fontWeight: 600 }}>
                <input type="radio" name={`present-${n.id}`} checked={ticks[n.id]?.present === false} onChange={() => handlePresentToggle(n.id, false)} />
                Absent today
              </label>
            </div>
          )}

          {category.hasTotalMark && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0eee6', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>{`Today's mark (out of ${settings.totalMarkMax})`}</label>
              <input
                type="number"
                min={0}
                max={settings.totalMarkMax}
                value={ticks[n.id]?.totalMark ?? ''}
                onChange={(e) => handleMarkChange(n.id, e.target.value)}
                style={{ width: 80, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
              <span style={{ ...S.badge('warn') }}>Mandatory</span>
              <span style={{ fontSize: 11, color: '#888' }}>Same {settings.totalMarkMax}-point scale for every house — averaged with the checklist into the final score</span>
            </div>
          )}

          {tickBullets.map(b => (
            <label key={b.key} style={{ ...S.checkRow, fontWeight: b.mandatory ? 600 : 400 }}>
              <input type="checkbox" checked={!!ticks[n.id]?.[b.key]} onChange={() => handleToggle(n.id, b.key)} />
              {b.text}{b.mandatory && <span style={{ ...S.badge('warn'), marginLeft: 6 }}>Mandatory</span>}
            </label>
          ))}
          <button style={{ ...S.btn, marginTop: 10 }} onClick={() => handleSave(n)} disabled={savingId === n.id}>
            {savingId === n.id ? 'Saving…' : 'Save today\u2019s ticks'}
          </button>
        </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MONTHLY LEADERBOARD — read-only, updates as ticks come in
// ══════════════════════════════════════════════════════════════

function LeaderboardScreen() {
  const [activeKey, setActiveKey] = useState('faculty')
  const [monthStr, setMonthStr] = useState(monthStrOf(todayStr()))
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [published, setPublished] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [missedToday, setMissedToday] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [settings, setSettings] = useState({ attendanceGatePercent: DEFAULT_ATTENDANCE_GATE_PERCENT, totalMarkMax: DEFAULT_TOTAL_MARK_MAX })
  const category = CATEGORIES[activeKey]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const settingsResult = await fetchSettings()
      const results = await computeCategoryRanking(activeKey, monthStr, { includeTrendAndStreak: true })
      const win = await fetchPublishedWinner(activeKey, monthStr)

      // "Missed today" check — only meaningful when viewing the current
      // month, since checking today's ticks against a past month makes
      // no sense.
      let missed = []
      if (monthStr === monthStrOf(todayStr())) {
        const [nomineeList, todayTicks] = await Promise.all([
          fetchNominees(category),
          fetchTodayTicks(activeKey, todayStr()),
        ])
        const tickedIds = new Set(Object.keys(todayTicks))
        missed = nomineeList.filter(n => !tickedIds.has(String(n.id))).map(n => n.name)
      }

      if (!cancelled) { setRanking(results); setPublished(win); setMissedToday(missed); setSettings(settingsResult); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeKey, monthStr])


  const ranked = useMemo(() => {
    const eligible = ranking.filter(r => r.eligible)
    const rest = ranking.filter(r => !r.eligible)
    return [...eligible.map((r, i) => ({ ...r, rank: i + 1, isWinner: i === 0 })), ...rest.map(r => ({ ...r, rank: null, isWinner: false }))]
  }, [ranking])

  const filteredRanked = useMemo(() => {
    if (!searchQuery.trim()) return ranked
    const q = searchQuery.trim().toLowerCase()
    return ranked.filter(r => r.name.toLowerCase().includes(q))
  }, [ranked, searchQuery])

  const topPick = ranked.find(r => r.isWinner)
  const publishDate = getPublishDate(monthStr)

  const handlePublish = async () => {
    if (!topPick) return
    setPublishing(true)
    try {
      await publishWinner(activeKey, monthStr, topPick)
      setPublished(await fetchPublishedWinner(activeKey, monthStr))
    } catch (err) {
      alert('Publish failed: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  const handleDownloadCertificate = () => {
    if (!published) return
    generateAwardCertificate({
      categoryKey: activeKey,
      name: published.nominee_name,
      monthLabel: monthLabelOf(monthStr),
      score: published.score,
      nomineeMeta: topPick?.house ? { house: topPick.house } : undefined,
    })
  }

  /** Export the current leaderboard (whatever's in `ranked`, ignoring search filter) as a CSV file — opens directly in Excel. */
  const handleExportCSV = () => {
    const headers = ['Rank', 'Name', 'Score %', 'Attendance %', 'Streak (days)', 'Trend vs last month', 'Days ticked']
    const rows = ranked.map(r => [
      r.rank ?? '',
      r.name,
      r.score ?? '',
      r.attPct ?? '',
      r.streak ?? '',
      r.trend !== null && r.trend !== undefined ? (r.trend > 0 ? `+${r.trend}` : r.trend) : '',
      r.daysTicked,
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${category.label.replace(/\s+/g, '_')}_${monthStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Export the current leaderboard as a simple printable PDF table — jsPDF is already a dependency (used by the certificate generator). */
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const navy = [11, 30, 61]
    const gold = [201, 162, 75]

    doc.setFont('times', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...navy)
    doc.text(category.label, 14, 18)
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`${monthLabelOf(monthStr)} — generated ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}`, 14, 25)

    doc.setDrawColor(...gold)
    doc.line(14, 29, 196, 29)

    let y = 38
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...navy)
    doc.text('Rank', 14, y)
    doc.text('Name', 30, y)
    doc.text('Score', 110, y)
    doc.text('Attendance', 130, y)
    doc.text('Streak', 160, y)
    doc.text('Trend', 178, y)
    y += 6
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y - 4, 196, y - 4)

    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    ranked.forEach(r => {
      if (y > 280) { doc.addPage(); y = 20 }
      doc.text(r.rank ? String(r.rank) : '—', 14, y)
      doc.text(r.name, 30, y)
      doc.text(r.score !== null ? `${r.score}%` : '—', 110, y)
      doc.text(r.attPct !== null && r.attPct !== undefined ? `${r.attPct}%` : '—', 130, y)
      doc.text(r.streak !== undefined ? `${r.streak}d` : '—', 160, y)
      const trendText = r.trend !== null && r.trend !== undefined ? (r.trend > 0 ? `+${r.trend}` : `${r.trend}`) : '—'
      doc.text(trendText, 178, y)
      y += 6
    })

    doc.save(`${category.label.replace(/\s+/g, '_')}_${monthStr}.pdf`)
  }

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
        <span style={{ fontSize: 13, color: '#666' }}>Publishes {publishDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <input
          type="text"
          placeholder="Search name…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, marginLeft: 'auto', minWidth: 160 }}
        />
        <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} onClick={handleExportCSV} disabled={ranked.length === 0}>⬇ Excel (CSV)</button>
        <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} onClick={handleExportPDF} disabled={ranked.length === 0}>⬇ PDF</button>
      </div>

      {!loading && missedToday.length > 0 && (
        <div style={{ ...S.card, background: '#fdecea', border: '1px solid #f3b4ae' }}>
          <strong style={{ color: '#b3261e' }}>⚠ {missedToday.length} not ticked today</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7a2320' }}>{missedToday.join(', ')}</p>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Rankings — average of ticked days</h3>
        <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '4px 0 12px' }}>Attendance below {settings.attendanceGatePercent}% excludes a nominee from ranking, regardless of bullet scores.</p>
        {loading ? <p>Loading…</p> : filteredRanked.length === 0 ? (
          <p style={{ color: '#999' }}>{searchQuery ? 'No match for that name.' : 'No ticks recorded yet this month.'}</p>
        ) : filteredRanked.map(r => (
          <div key={r.nomineeId} style={S.rankRow(r.isWinner)}>
            <div>
              <strong>{r.rank ? `#${r.rank} ` : ''}{r.name}</strong>
              {r.isWinner && <span style={{ marginLeft: 8, ...S.badge('ok') }}>LEADING</span>}
              {r.reason && <span style={{ marginLeft: 8, ...S.badge('warn') }}>{r.reason}</span>}
              {r.streak > 0 && <span style={{ marginLeft: 8, ...S.badge('ok') }}>🔥 {r.streak}-day streak</span>}
              {r.trend !== null && r.trend !== undefined && r.trend !== 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: r.trend > 0 ? '#1e7e34' : '#b3261e' }}>
                  {r.trend > 0 ? '▲' : '▼'} {Math.abs(r.trend)} vs last month
                </span>
              )}
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {r.daysTicked} day{r.daysTicked === 1 ? '' : 's'} recorded
                {r.attPct !== null && r.attPct !== undefined && ` · ${r.attPct}% attendance`}
                {r.bulletScore !== null && r.bulletScore !== undefined && r.markPercent !== null && r.markPercent !== undefined && ` · checklist ${r.bulletScore}% + mark ${r.markPercent}% (averaged into final score)`}
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.score !== null ? `${r.score}%` : '—'}</div>
          </div>
        ))}
      </div>

      {topPick && (
        <div style={{ ...S.card, borderColor: '#C9A24B', borderWidth: 2 }}>
          {published ? (
            <>
              <p style={{ margin: '0 0 10px' }}><strong>{published.nominee_name}</strong> published — {published.score}%</p>
              <button style={S.btn} onClick={handleDownloadCertificate}>Download certificate</button>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 10px' }}><strong>{topPick.name}</strong> is leading at {topPick.score}%</p>
              <button style={S.btn} onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Confirm & publish winner'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ROOT — two modes: tick today, or view the leaderboard
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  SETTINGS SCREEN — configurable gate/scale, leave management,
//  and co-housemaster assignment. Everything here was previously
//  a hardcoded constant or entirely absent.
// ══════════════════════════════════════════════════════════════

function SettingsScreen() {
  const [settings, setSettings] = useState({ attendanceGatePercent: DEFAULT_ATTENDANCE_GATE_PERCENT, totalMarkMax: DEFAULT_TOTAL_MARK_MAX })
  const [gateInput, setGateInput] = useState('')
  const [markInput, setMarkInput] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [loading, setLoading] = useState(true)

  // Leave management
  const [leaveCategoryKey, setLeaveCategoryKey] = useState('faculty')
  const [leaveNominees, setLeaveNominees] = useState([])
  const [leaveList, setLeaveList] = useState([])
  const [leaveForm, setLeaveForm] = useState({ nomineeId: '', startDate: todayStr(), endDate: todayStr(), reason: '' })
  const [savingLeave, setSavingLeave] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const s = await fetchSettings()
      if (!cancelled) {
        setSettings(s)
        setGateInput(String(s.attendanceGatePercent))
        setMarkInput(String(s.totalMarkMax))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const category = CATEGORIES[leaveCategoryKey]
      const [nomineeList, { data: leaveRows }] = await Promise.all([
        fetchNominees(category),
        supabase.from('award_nominee_leave').select('*').eq('category_key', leaveCategoryKey).order('start_date', { ascending: false }),
      ])
      if (!cancelled) {
        setLeaveNominees(nomineeList)
        setLeaveList(leaveRows || [])
        setLeaveForm(f => ({ ...f, nomineeId: nomineeList[0]?.id || '' }))
      }
    })()
    return () => { cancelled = true }
  }, [leaveCategoryKey])

  const handleSaveSettings = async () => {
    const gate = Number(gateInput)
    const mark = Number(markInput)
    if (isNaN(gate) || gate < 0 || gate > 100) { alert('Attendance gate must be a number between 0 and 100.'); return }
    if (isNaN(mark) || mark <= 0) { alert('Mark scale must be a positive number.'); return }
    setSavingSettings(true)
    try {
      await saveSetting('attendance_gate_percent', gate)
      await saveSetting('total_mark_max', mark)
      const refreshed = await fetchSettings()
      setSettings(refreshed)
      alert('Settings saved. New values apply the next time a screen loads.')
    } catch (err) {
      alert('Could not save settings: ' + err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleAddLeave = async () => {
    const nominee = leaveNominees.find(n => String(n.id) === String(leaveForm.nomineeId))
    if (!nominee) { alert('Select a nominee.'); return }
    if (leaveForm.endDate < leaveForm.startDate) { alert('End date must be on or after the start date.'); return }
    setSavingLeave(true)
    try {
      await saveLeave(leaveCategoryKey, nominee.id, nominee.name, leaveForm.startDate, leaveForm.endDate, leaveForm.reason)
      const { data } = await supabase.from('award_nominee_leave').select('*').eq('category_key', leaveCategoryKey).order('start_date', { ascending: false })
      setLeaveList(data || [])
      setLeaveForm(f => ({ ...f, reason: '' }))
    } catch (err) {
      alert('Could not save leave: ' + err.message)
    } finally {
      setSavingLeave(false)
    }
  }

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Remove this leave record?')) return
    try {
      await deleteLeave(leaveId)
      setLeaveList(prev => prev.filter(l => l.id !== leaveId))
    } catch (err) {
      alert('Could not remove: ' + err.message)
    }
  }

  if (loading) return <div style={S.card}>Loading settings…</div>

  return (
    <div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Scoring thresholds</h3>
        <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '4px 0 12px' }}>
          Changes apply the next time a screen loads — no code deploy needed.
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Attendance gate (%)</label>
            <input type="number" min={0} max={100} value={gateInput} onChange={e => setGateInput(e.target.value)} style={{ width: 90, padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
            <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0', maxWidth: 220 }}>Below this, a nominee is excluded from ranking regardless of bullet scores. Currently {settings.attendanceGatePercent}%.</p>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Best House mark scale (out of)</label>
            <input type="number" min={1} value={markInput} onChange={e => setMarkInput(e.target.value)} style={{ width: 90, padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
            <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0', maxWidth: 220 }}>Same fixed scale for every house. Currently /{settings.totalMarkMax}.</p>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop: 14 }} onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</button>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Leave management</h3>
        <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '4px 0 12px' }}>
          A nominee on leave for a date range is excluded from ranking with a clear "On leave" label, instead of silently failing the attendance gate.
        </p>

        <div style={S.catTabRow}>
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <button key={key} style={S.catTab(leaveCategoryKey === key)} onClick={() => setLeaveCategoryKey(key)}>
              {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nominee</label>
            <select value={leaveForm.nomineeId} onChange={e => setLeaveForm(f => ({ ...f, nomineeId: e.target.value }))} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, minWidth: 180 }}>
              {leaveNominees.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Start</label>
            <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>End</label>
            <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Reason (optional)</label>
            <input type="text" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Medical leave" style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4, width: '100%' }} />
          </div>
          <button style={S.btn} onClick={handleAddLeave} disabled={savingLeave || leaveNominees.length === 0}>{savingLeave ? 'Saving…' : 'Add leave'}</button>
        </div>

        {leaveList.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13 }}>No leave records for this category.</p>
        ) : leaveList.map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
            <span><strong>{l.nominee_name}</strong> — {l.start_date} to {l.end_date}{l.reason && ` (${l.reason})`}</span>
            <button style={{ ...S.btnGhost, padding: '2px 10px', fontSize: 11 }} onClick={() => handleDeleteLeave(l.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Multi-housemaster houses</h3>
        <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '4px 0 12px' }}>
          For a house jointly run by more than one housemaster (e.g. a House Master and an Asst. House Mistress), link them here via the
          {' '}<code>award_house_co_masters</code> table — run the migration, then assign co-masters directly in Supabase Table Editor
          (house_id, housemaster_id, role_label). This is a linking table only; it doesn't change how House Master nominees are scored
          individually — it's for Best House reporting context when a house has joint leadership.
        </p>
      </div>
    </div>
  )
}

export default function Awards() {
  const [mode, setMode] = useState('tick') // 'tick' | 'leaderboard' | 'settings'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🏅 Staff & house awards</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Tick daily. Winners calculate automatically from the month's ticks.</p>
      </div>

      <div style={S.modeToggle}>
        <button style={S.modeBtn(mode === 'tick')} onClick={() => setMode('tick')}>Today's ticks</button>
        <button style={S.modeBtn(mode === 'leaderboard')} onClick={() => setMode('leaderboard')}>Leaderboard</button>
        <button style={S.modeBtn(mode === 'settings')} onClick={() => setMode('settings')}>⚙ Settings</button>
      </div>

      {mode === 'tick' ? <DailyTickScreen /> : mode === 'leaderboard' ? <LeaderboardScreen /> : <SettingsScreen />}
    </div>
  )
}
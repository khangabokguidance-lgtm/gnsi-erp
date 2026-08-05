import React, { useState, useEffect, useMemo } from 'react'
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
// qualitative bullets above. This is asked and ticked every day alongside
// the bullets, but it is NOT averaged in like the others — it's a pass/fail
// requirement. A nominee with excellent bullet scores who fails the
// attendance gate is still excluded from ranking. See computeCategoryRanking.
const ATTENDANCE_GATE_PERCENT = 90 // % of recorded days present, minimum to be eligible

// ══════════════════════════════════════════════════════════════
//  DATA LAYER
// ══════════════════════════════════════════════════════════════

// House Master identity now comes directly from the `housemasters` table
// (confirmed real schema: staff.designation does not exist). See
// fetchNominees() below — it queries `housemasters` and uses staff_profile_id
// to exclude those people from Faculty/Non-Teaching, instead of filtering
// on a designation string.

/** Active student count per house name, computed live from `students` — matches the counting logic Hostel.jsx already uses, not a stale stored number on `houses`. */
async function fetchStudentCountsByHouse() {
  const { data } = await supabase.from('students').select('house').neq('status', 'Inactive').neq('status', 'Dropout')
  const counts = {}
  ;(data || []).forEach(s => {
    const key = (s.house || '').trim().toLowerCase()
    if (!key) return
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
}

async function fetchNominees(category) {
  if (category.nomineeSource === 'houses') {
    const { data } = await supabase.from('houses').select('id, name').order('name')
    return (data || []).map(h => ({ id: h.id, name: h.name }))
  }

  // Real schema confirmed: `staff` has NO designation column — it only has
  // id, name, role, username, password, dept, phone, email, status,
  // user_id, is_system. House Master identity lives in the SEPARATE
  // `housemasters` table, joined back to staff via staff_profile_id.
  // designation spelling is inconsistent in real data ("House Master" vs
  // "Housemaster") so match with .includes(), not exact equality.
  const { data: hmRows } = await supabase
    .from('housemasters')
    .select('id, name, house, designation, status, staff_profile_id')
    .eq('status', 'Active')
  const houseMasterPool = (hmRows || []).map(h => ({
    id: h.staff_profile_id, // staff.id — keeps this consistent with Faculty/Non-Teaching nomineeIds for tick storage
    name: h.name,
    house: h.house,
    designation: h.designation,
  }))
  // staff.id values of everyone already counted as a House Master, so
  // Faculty/Non-Teaching queries below can exclude them and avoid
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

  const { data: staffRows } = await supabase.from('staff').select('id, name, role, status').eq('status', 'Active')
  const staff = staffRows || []

  // Faculty: role Teaching, excluding anyone already counted as House Master
  // (e.g. Laishram Bidyachandra is role=Teaching in `staff` but also has a
  // housemasters row — they belong to House Master, not a second Faculty entry).
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

async function computeCategoryRanking(categoryKey, monthStr) {
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

  // Best House only: active student count per house, for dividing the
  // manual total mark — computed live from `students`, same counting
  // logic Hostel.jsx already uses.
  let studentCounts = null
  if (category.hasTotalMark) {
    studentCounts = await fetchStudentCountsByHouse()
  }

  const results = await Promise.all(nominees.map(async (n) => {
    const monthRows = await fetchMonthTicks(categoryKey, n.id, monthStr)
    const tickBullets = category.bullets.filter(b => b.type === 'tick' && b.key !== category.attendanceKey)
    const tickPercents = tickBullets.map(b => bulletTickPercent(monthRows, b.key)).filter(v => v !== null)

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
    if (attPct < ATTENDANCE_GATE_PERCENT) {
      return { nomineeId: n.id, name: n.name, score: null, attPct, daysTicked: monthRows.length, eligible: false, reason: `Below ${ATTENDANCE_GATE_PERCENT}% attendance gate` }
    }

    const bulletScore = tickPercents.length > 0
      ? Math.round(tickPercents.reduce((a, b) => a + b, 0) / tickPercents.length)
      : null

    // Best House: "Overall Total Mark Average" — mandatory manual total
    // mark entered per day, divided by the house's active student count,
    // averaged across every day a mark was recorded this month.
    let markAverage = null
    if (category.hasTotalMark) {
      const houseKey = (n.name || '').trim().toLowerCase()
      const studentCount = studentCounts?.[houseKey] || 0
      const daysWithMark = monthRows.filter(r => r.total_mark !== null && r.total_mark !== undefined)
      if (daysWithMark.length > 0 && studentCount > 0) {
        const dailyAverages = daysWithMark.map(r => r.total_mark / studentCount)
        markAverage = parseFloat((dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length).toFixed(2))
      }
    }

    // Ranking score stays the checklist average — the 0-100 scale that's
    // fairly comparable across houses. The total-mark average is NOT
    // blended in: it has no fixed maximum (students can be marked out of
    // different scales), so "marks / students" produces a raw number with
    // no natural ceiling that can't be forced onto the same 0-100 scale
    // without distorting it. It's shown as its own figure instead — see
    // markAverage on the leaderboard row.
    const score = bulletScore

    return { nomineeId: n.id, name: n.name, score, attPct, bulletScore, markAverage, daysTicked: monthRows.length, eligible: score !== null }
  }))

  const eligible = results.filter(r => r.eligible)
  const ineligible = results.filter(r => !r.eligible)
  eligible.sort((a, b) => b.score - a.score)
  return [...eligible, ...ineligible]
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
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const category = CATEGORIES[activeKey]
  const date = todayStr()
  // No manual attendance toggle needed when the category has its own
  // attendance source: Faculty/Non-Teaching pull from staff_monthly_scores,
  // House Master derives it silently from the roll-call bullet below.
  const usesAutoAttendance = activeKey === 'non_teaching' || activeKey === 'faculty' || !!category.attendanceKey

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const list = await fetchNominees(category)
      const todayMap = await fetchTodayTicks(activeKey, date)
      if (!cancelled) { setNominees(list); setTicks(todayMap); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeKey])

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

  const handleMarkChange = (nomineeId, value) => {
    setTicks(prev => ({
      ...prev,
      [nomineeId]: { ...(prev[nomineeId] || {}), totalMark: value === '' ? undefined : Number(value) },
    }))
  }

  const handleSave = async (nominee) => {
    const nomineeTicks = ticks[nominee.id] || {}
    const { present, totalMark, ...bulletTicks } = nomineeTicks
    if (!usesAutoAttendance && present === undefined) {
      alert('Attendance is compulsory — mark present or absent before saving.')
      return
    }
    if (category.hasTotalMark && (totalMark === undefined || totalMark === null || isNaN(totalMark))) {
      alert('Total mark is compulsory — enter today\u2019s inspection mark before saving.')
      return
    }
    const missingMandatory = category.bullets.filter(b => b.mandatory && bulletTicks[b.key] === undefined)
    if (missingMandatory.length > 0) {
      alert(`Mandatory: "${missingMandatory[0].text}" must be ticked yes or no before saving.`)
      return
    }
    setSavingId(nominee.id)
    try {
      await saveTicks(activeKey, nominee.id, nominee.name, date, bulletTicks, usesAutoAttendance ? null : !!present, category.hasTotalMark ? totalMark : null)
    } catch (err) {
      alert('Could not save: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  const tickBullets = category.bullets.filter(b => b.type === 'tick')

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, background: '#FFF8E7', border: '1px solid #C9A24B' }}>
        <strong>{category.icon} {category.label}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
          Today: {date}. Tick what you observed. Attendance is compulsory
          {activeKey === 'non_teaching' || activeKey === 'faculty'
            ? ' and pulled automatically from the Staff module — no need to mark it here.'
            : category.attendanceKey
              ? ' — derived automatically from the roll-call tick below, no separate mark needed.'
              : ' — mark present/absent for every nominee.'}
        </p>
      </div>

      {loading ? <p>Loading…</p> : nominees.map(n => (
        <div key={n.id} style={S.card}>
          <div style={S.nomineeRow}>
            <strong>{n.name}</strong>
          </div>

          {!usesAutoAttendance && (
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
              <label style={{ fontSize: 13, fontWeight: 600 }}>Today's total mark</label>
              <input
                type="number"
                min={0}
                value={ticks[n.id]?.totalMark ?? ''}
                onChange={(e) => handleMarkChange(n.id, e.target.value)}
                style={{ width: 80, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
              <span style={{ ...S.badge('warn') }}>Mandatory</span>
              <span style={{ fontSize: 11, color: '#888' }}>Divided by student count at scoring time</span>
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
      ))}
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
  const category = CATEGORIES[activeKey]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const results = await computeCategoryRanking(activeKey, monthStr)
      const win = await fetchPublishedWinner(activeKey, monthStr)
      if (!cancelled) { setRanking(results); setPublished(win); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeKey, monthStr])

  const ranked = useMemo(() => {
    const eligible = ranking.filter(r => r.eligible)
    const rest = ranking.filter(r => !r.eligible)
    return [...eligible.map((r, i) => ({ ...r, rank: i + 1, isWinner: i === 0 })), ...rest.map(r => ({ ...r, rank: null, isWinner: false }))]
  }, [ranking])

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

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
        <span style={{ fontSize: 13, color: '#666' }}>Publishes {publishDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Rankings — average of ticked days</h3>
        <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '4px 0 12px' }}>Attendance below {ATTENDANCE_GATE_PERCENT}% excludes a nominee from ranking, regardless of bullet scores.</p>
        {loading ? <p>Loading…</p> : ranked.length === 0 ? (
          <p style={{ color: '#999' }}>No ticks recorded yet this month.</p>
        ) : ranked.map(r => (
          <div key={r.nomineeId} style={S.rankRow(r.isWinner)}>
            <div>
              <strong>{r.rank ? `#${r.rank} ` : ''}{r.name}</strong>
              {r.isWinner && <span style={{ marginLeft: 8, ...S.badge('ok') }}>LEADING</span>}
              {r.reason && <span style={{ marginLeft: 8, ...S.badge('warn') }}>{r.reason}</span>}
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {r.daysTicked} day{r.daysTicked === 1 ? '' : 's'} recorded
                {r.attPct !== null && r.attPct !== undefined && ` · ${r.attPct}% attendance`}
                {r.markAverage !== null && r.markAverage !== undefined && ` · total mark avg ${r.markAverage}/student (reference only, not part of ranking score)`}
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

export default function Awards() {
  const [mode, setMode] = useState('tick') // 'tick' | 'leaderboard'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🏅 Staff & house awards</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Tick daily. Winners calculate automatically from the month's ticks.</p>
      </div>

      <div style={S.modeToggle}>
        <button style={S.modeBtn(mode === 'tick')} onClick={() => setMode('tick')}>Today's ticks</button>
        <button style={S.modeBtn(mode === 'leaderboard')} onClick={() => setMode('leaderboard')}>Leaderboard</button>
      </div>

      {mode === 'tick' ? <DailyTickScreen /> : <LeaderboardScreen />}
    </div>
  )
}
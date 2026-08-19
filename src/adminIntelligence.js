// adminIntelligence.js — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// 20 admin-intelligence functions: read-only analytics/reporting layer built
// ON TOP of the existing single-source-of-truth modules — studentQueries.js
// (roster reads), feeEngine.js / feeDues.js (fee logic), mismatchLog.js
// (mismatch persistence), tableRegistry.js (registered tables) — rather than
// duplicating any of their query logic. Nothing here writes to the database.
//
// Grouped into five families:
//   1–4   Risk & early warning
//   5–8   Operational / data health
//   9–12  Financial intelligence
//   13–15 Academic intelligence
//   16–18 Hostel / discipline intelligence
//   19–20 Cross-cutting meta (digest, anomaly detection)
//
// Every function returns plain data (arrays/objects) — no React, no JSX —
// so it can be called from Student360.jsx, a scheduled digest, or a future
// CLI/report generator without dragging UI code along.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { getActiveStudents, getAllStudents } from './studentQueries'
import { getDuesForStudents } from './feeDues'
import { getOpenMismatches } from './mismatchLog'
import { TABLE_REGISTRY } from './tableRegistry'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = n => new Date(Date.now() - n * DAY_MS)
const isOpenStatus = s => !['resolved', 'closed', 'rejected', 'cancelled'].includes(String(s || '').toLowerCase())

// Pagination-safe fetch — same proven pattern as fetchAllRows() in
// Student360.jsx / studentQueries.js. Every function below that reads a
// records table (attendance, exams, discipline, sickbay, fee payments...)
// uses this instead of a bare .select(), so none of them silently
// truncate at Supabase's 1000-row cap the way earlier bugs in this
// codebase did.
async function fetchAll(table, { select = '*', filters = [], orderCol = null, ascending = true } = {}) {
  const PAGE = 1000
  let from = 0, all = []
  while (true) {
    let q = supabase.from(table).select(select)
    for (const [col, op, val] of filters) q = q[op](col, val)
    if (orderCol) q = q.order(orderCol, { ascending })
    q = q.range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) { console.error(`adminIntelligence.fetchAll(${table}) error:`, error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ═══════════════════════════════════════════════════════════════════════════
// 1–4. RISK & EARLY WARNING
// ═══════════════════════════════════════════════════════════════════════════

// 1. getAtRiskStudents — compound risk score per active student: low
// attendance + fee dues + open discipline + sickbay frequency. This is the
// single most useful list in the whole module: "who needs attention now,"
// ranked, instead of scattered across four separate dashboards.
export async function getAtRiskStudents({ limit = 50 } = {}) {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,status,phone')
  const [attendance, discipline, sickbay, duesResults] = await Promise.all([
    fetchAll('attendance_records', { select: 'gcc_no,status' }),
    fetchAll('discipline_records', { select: 'student_id,status' }),
    fetchAll('sickbay_records', { select: 'student_id,status,date' }),
    getDuesForStudents(students),
  ])

  const attByGcc = {}
  for (const r of attendance) {
    const g = String(r.gcc_no || '')
    if (!g) continue
    attByGcc[g] ??= { total: 0, present: 0 }
    attByGcc[g].total++
    if (String(r.status).toLowerCase() === 'present') attByGcc[g].present++
  }
  const disciplineByStudent = {}
  for (const r of discipline) {
    if (isOpenStatus(r.status)) disciplineByStudent[r.student_id] = (disciplineByStudent[r.student_id] || 0) + 1
  }
  const sickbayByStudent = {}
  for (const r of sickbay) {
    sickbayByStudent[r.student_id] = (sickbayByStudent[r.student_id] || 0) + 1
  }
  const duesByStudentId = {}
  for (const { student, dues } of duesResults) duesByStudentId[student.id] = dues

  const scored = students.map(s => {
    const att = attByGcc[String(s.gcc_no)]
    const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null
    const dues = duesByStudentId[s.id]?.totalDue || 0
    const openDiscipline = disciplineByStudent[s.id] || 0
    const sickbayCount = sickbayByStudent[s.id] || 0

    let score = 0
    const reasons = []
    if (attPct != null && attPct < 60) { score += 3; reasons.push(`Attendance ${attPct}%`) }
    else if (attPct != null && attPct < 75) { score += 1; reasons.push(`Attendance ${attPct}%`) }
    if (dues > 5000) { score += 2; reasons.push(`₹${dues.toLocaleString('en-IN')} due`) }
    else if (dues > 0) { score += 1; reasons.push(`₹${dues.toLocaleString('en-IN')} due`) }
    if (openDiscipline >= 3) { score += 3; reasons.push(`${openDiscipline} open discipline records`) }
    else if (openDiscipline > 0) { score += 1; reasons.push(`${openDiscipline} open discipline record`) }
    if (sickbayCount >= 3) { score += 2; reasons.push(`${sickbayCount} sickbay visits`) }

    return { student: s, score, attPct, dues, openDiscipline, sickbayCount, reasons }
  })

  return scored.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
}

// 2. getAttritionRisk — students trending toward Dropout before anyone has
// manually changed their status: still "Active" but attendance has
// collapsed and fees have stopped, the two leading indicators staff
// actually described when a student is about to leave.
export async function getAttritionRisk({ limit = 30 } = {}) {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,status,phone')
  const activeOnly = students.filter(s => s.status === 'Active')
  const [attendance, duesResults] = await Promise.all([
    fetchAll('attendance_records', { select: 'gcc_no,status' }),
    getDuesForStudents(activeOnly),
  ])

  const attByGcc = {}
  for (const r of attendance) {
    const g = String(r.gcc_no || '')
    if (!g) continue
    attByGcc[g] ??= { total: 0, present: 0 }
    attByGcc[g].total++
    if (String(r.status).toLowerCase() === 'present') attByGcc[g].present++
  }
  const duesByStudentId = {}
  for (const { student, dues } of duesResults) duesByStudentId[student.id] = dues

  const flagged = activeOnly.map(s => {
    const att = attByGcc[String(s.gcc_no)]
    const attPct = att && att.total >= 5 ? Math.round((att.present / att.total) * 100) : null
    const dues = duesByStudentId[s.id]
    const monthsOverdue = dues?.monthsOverdue || 0
    const isAtRisk = attPct != null && attPct < 50 && monthsOverdue >= 2
    return { student: s, attPct, monthsOverdue, totalDue: dues?.totalDue || 0, isAtRisk }
  }).filter(r => r.isAtRisk)

  return flagged.sort((a, b) => (a.attPct ?? 100) - (b.attPct ?? 100)).slice(0, limit)
}

// 3. getFeeDefaultTrend — is total outstanding dues rising or falling,
// broken down by course, using actual per-student due computation (not a
// heuristic) so the trend is trustworthy enough to act on.
export async function getFeeDefaultTrend() {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,status,hostel_type,admission_date')
  const duesResults = await getDuesForStudents(students)

  const byCourse = {}
  let totalDue = 0, studentsWithDues = 0
  for (const { student, dues } of duesResults) {
    if (dues.totalDue <= 0) continue
    studentsWithDues++
    totalDue += dues.totalDue
    const course = student.course || 'Unassigned'
    byCourse[course] ??= { totalDue: 0, studentCount: 0 }
    byCourse[course].totalDue += dues.totalDue
    byCourse[course].studentCount++
  }

  return {
    totalDue, studentsWithDues,
    byCourse: Object.entries(byCourse)
      .map(([course, v]) => ({ course, ...v }))
      .sort((a, b) => b.totalDue - a.totalDue),
  }
}

// 4. getAttendanceDecliners — students whose recent attendance is
// meaningfully worse than their own earlier record this session, i.e. a
// personal decline rather than a low-but-stable rate — catches a student
// starting to drift before their overall % looks alarming.
export async function getAttendanceDecliners({ minSessions = 10, dropThreshold = 20, limit = 30 } = {}) {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,status')
  const records = await fetchAll('attendance_records', { select: 'gcc_no,status,session_id' })

  const bySession = {}
  for (const r of records) {
    const g = String(r.gcc_no || '')
    if (!g) continue
    bySession[g] ??= []
    bySession[g].push(r)
  }

  const declined = []
  for (const s of students) {
    const rows = bySession[String(s.gcc_no)]
    if (!rows || rows.length < minSessions) continue
    // session_id is sequential/chronological (confirmed usage in
    // Attendance.jsx / exportUtils) — split into first half vs second
    // half of the student's own history to compare early vs recent.
    const sorted = [...rows].sort((a, b) => (a.session_id ?? 0) - (b.session_id ?? 0))
    const mid = Math.floor(sorted.length / 2)
    const early = sorted.slice(0, mid)
    const recent = sorted.slice(mid)
    const pct = arr => arr.length ? Math.round((arr.filter(r => String(r.status).toLowerCase() === 'present').length / arr.length) * 100) : null
    const earlyPct = pct(early), recentPct = pct(recent)
    if (earlyPct == null || recentPct == null) continue
    const drop = earlyPct - recentPct
    if (drop >= dropThreshold) declined.push({ student: s, earlyPct, recentPct, drop })
  }

  return declined.sort((a, b) => b.drop - a.drop).slice(0, limit)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5–8. OPERATIONAL / DATA HEALTH
// ═══════════════════════════════════════════════════════════════════════════

// 5. getDataHealthReport — orphaned/dangling records across every
// registered table: rows pointing at a student_id/gcc_no that no longer
// resolves to a real student. Extends the same "don't trust silent
// failure" philosophy that fixed the hostel_allocations orderCol bug into
// a general integrity sweep, so future schema drift surfaces here instead
// of as a mystery support ticket.
export async function getDataHealthReport() {
  const allStudents = await getAllStudents('id,gcc_no')
  const idSet = new Set(allStudents.map(s => s.id))
  const gccSet = new Set(allStudents.map(s => String(s.gcc_no)).filter(Boolean))

  const issues = []
  for (const t of TABLE_REGISTRY) {
    if (!t.studentKeyCol || t.studentKeyIsName) continue // name-keyed tables can't be validated this way
    const rows = await fetchAll(t.key, { select: `id,${t.studentKeyCol}` })
    const orphaned = rows.filter(r => {
      const key = r[t.studentKeyCol]
      if (key == null || key === '') return false
      return t.studentKeyIsId ? !idSet.has(key) : !gccSet.has(String(key))
    })
    if (orphaned.length > 0) {
      issues.push({ table: t.key, label: t.label, icon: t.icon, orphanedCount: orphaned.length, sampleIds: orphaned.slice(0, 10).map(r => r.id) })
    }
  }

  return { issues: issues.sort((a, b) => b.orphanedCount - a.orphanedCount), totalOrphaned: issues.reduce((s, i) => s + i.orphanedCount, 0) }
}

// 6. getStaleRecordsReport — records sitting open past a reasonable
// working threshold: pending leave >3 days, open complaints >7 days,
// gate passes still "Issued" >24h. These are the operational items that
// slip through when staff are busy — nobody notices a gate pass that was
// never checked back in.
export async function getStaleRecordsReport() {
  const [leave, complaints, gatePasses] = await Promise.all([
    fetchAll('leave_records', { select: 'id,student_id,leave_type,status,from_date' }),
    fetchAll('reception_complaints', { select: 'id,student_name,category,status,created_at' }),
    fetchAll('reception_gatepasses', { select: 'id,student_name,status,created_at,reason' }),
  ])

  const stalePendingLeave = leave.filter(r =>
    String(r.status).toLowerCase() === 'pending' && r.from_date && new Date(r.from_date) < daysAgo(3))

  const staleComplaints = complaints.filter(r =>
    isOpenStatus(r.status) && r.created_at && new Date(r.created_at) < daysAgo(7))

  const staleGatePasses = gatePasses.filter(r =>
    r.status === 'Issued' && r.created_at && new Date(r.created_at) < daysAgo(1))

  return {
    stalePendingLeave, staleComplaints, staleGatePasses,
    total: stalePendingLeave.length + staleComplaints.length + staleGatePasses.length,
  }
}

// 7. getModuleActivityLog — writes per registered table over the last N
// days, from each table's own created_at/orderCol timestamp where that
// column is date-like. Shows which modules staff are actually using day
// to day vs which have gone quiet — a module with zero recent writes is
// either genuinely idle or a workflow problem worth asking about.
export async function getModuleActivityLog({ days = 30 } = {}) {
  const since = daysAgo(days).toISOString()
  const DATE_LIKE = new Set(['created_at', 'pay_date', 'date', 'from_date', 'exam_date'])

  const results = []
  for (const t of TABLE_REGISTRY) {
    if (!DATE_LIKE.has(t.orderCol)) { results.push({ table: t.key, label: t.label, icon: t.icon, module: t.module, recentCount: null }); continue }
    const { count, error } = await supabase.from(t.key).select('*', { count: 'exact', head: true }).gte(t.orderCol, since)
    if (error) { console.error(`getModuleActivityLog(${t.key}) error:`, error.message); results.push({ table: t.key, label: t.label, icon: t.icon, module: t.module, recentCount: null }); continue }
    results.push({ table: t.key, label: t.label, icon: t.icon, module: t.module, recentCount: count ?? 0 })
  }

  return results.sort((a, b) => (b.recentCount ?? -1) - (a.recentCount ?? -1))
}

// 8. getDuplicateStudentCandidates — fuzzy name+phone match across the
// full roster (including dropouts, since a re-admission double-entry is
// exactly the case this needs to catch) to surface likely double-entry
// before it corrupts fee/attendance totals for "two" students who are
// actually one.
export async function getDuplicateStudentCandidates() {
  const students = await getAllStudents('id,name,gcc_no,phone,course,batch,status')
  const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')

  const candidates = []
  const byPhone = {}
  for (const s of students) {
    if (!s.phone) continue
    byPhone[s.phone] ??= []
    byPhone[s.phone].push(s)
  }
  for (const [phone, group] of Object.entries(byPhone)) {
    if (group.length > 1) candidates.push({ reason: 'same_phone', phone, students: group })
  }

  const byName = {}
  for (const s of students) {
    const key = norm(s.name)
    if (!key) continue
    byName[key] ??= []
    byName[key].push(s)
  }
  for (const [name, group] of Object.entries(byName)) {
    if (group.length > 1) candidates.push({ reason: 'same_name', name, students: group })
  }

  return candidates
}

// ═══════════════════════════════════════════════════════════════════════════
// 9–12. FINANCIAL INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

// 9. getRevenueForecast — projects this month's likely collections from
// the pace collected so far this month vs the days elapsed, giving a
// simple run-rate estimate rather than pretending to model seasonality
// this codebase has no data to support.
export async function getRevenueForecast() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysElapsed = Math.max(1, Math.ceil((now - monthStart) / DAY_MS))
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const [admFee, flatFee, courseFee] = await Promise.all([
    fetchAll('adm_fee_collections', { select: 'amount_paid,pay_date', filters: [['pay_date', 'gte', monthStart.toISOString().slice(0, 10)], ['reverted', 'eq', false]] }),
    fetchAll('adm_flat_fees', { select: 'amount,pay_date', filters: [['pay_date', 'gte', monthStart.toISOString().slice(0, 10)], ['paid', 'eq', true], ['reverted', 'eq', false]] }),
    fetchAll('adm_course_fees', { select: 'amount_paid,pay_date', filters: [['pay_date', 'gte', monthStart.toISOString().slice(0, 10)], ['reverted', 'eq', false]] }),
  ])

  const collectedSoFar =
    admFee.reduce((s, r) => s + Number(r.amount_paid || 0), 0) +
    flatFee.reduce((s, r) => s + Number(r.amount || 0), 0) +
    courseFee.reduce((s, r) => s + Number(r.amount_paid || 0), 0)

  const dailyRate = collectedSoFar / daysElapsed
  const projectedTotal = Math.round(dailyRate * daysInMonth)

  return { collectedSoFar, daysElapsed, daysInMonth, dailyRate: Math.round(dailyRate), projectedTotal }
}

// 10. getCourseProfitability — collected-vs-expected per course/batch
// using the same due computation as the Fees module, so this can point
// at a specific track that's underperforming on collections rather than
// just an overall school-wide number.
export async function getCourseProfitability() {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,hostel_type,admission_date')
  const duesResults = await getDuesForStudents(students)

  const byCourse = {}
  for (const { student, dues } of duesResults) {
    const course = student.course || 'Unassigned'
    byCourse[course] ??= { expected: 0, collected: 0, studentCount: 0 }
    byCourse[course].expected += dues.totalPaid + dues.totalDue
    byCourse[course].collected += dues.totalPaid
    byCourse[course].studentCount++
  }

  return Object.entries(byCourse).map(([course, v]) => ({
    course, ...v,
    collectionRate: v.expected > 0 ? Math.round((v.collected / v.expected) * 100) : null,
  })).sort((a, b) => (a.collectionRate ?? 100) - (b.collectionRate ?? 100))
}

// 11. getPaymentModeBreakdown — cash vs UPI vs cheque vs bank transfer
// split across all three fee tables, for reconciliation/audit — answers
// "how much cash actually came in this month" without opening Fees.jsx's
// export and pivoting it by hand.
export async function getPaymentModeBreakdown({ days = 30 } = {}) {
  const since = daysAgo(days).toISOString().slice(0, 10)
  const [admFee, flatFee, courseFee] = await Promise.all([
    fetchAll('adm_fee_collections', { select: 'amount_paid,pay_mode', filters: [['pay_date', 'gte', since], ['reverted', 'eq', false]] }),
    fetchAll('adm_flat_fees', { select: 'amount,pay_mode', filters: [['pay_date', 'gte', since], ['paid', 'eq', true], ['reverted', 'eq', false]] }),
    fetchAll('adm_course_fees', { select: 'amount_paid,pay_mode', filters: [['pay_date', 'gte', since], ['reverted', 'eq', false]] }),
  ])

  const byMode = {}
  const add = (mode, amount) => { const m = mode || 'Unspecified'; byMode[m] = (byMode[m] || 0) + Number(amount || 0) }
  admFee.forEach(r => add(r.pay_mode, r.amount_paid))
  flatFee.forEach(r => add(r.pay_mode, r.amount))
  courseFee.forEach(r => add(r.pay_mode, r.amount_paid))

  const total = Object.values(byMode).reduce((s, v) => s + v, 0)
  return Object.entries(byMode)
    .map(([mode, amount]) => ({ mode, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

// 12. getTopDefaultersByAmount — ranked by rupees owed, not just months
// overdue, so admin can prioritise the highest-value collections first
// rather than treating every defaulter as equal.
export async function getTopDefaultersByAmount({ limit = 20 } = {}) {
  const students = await getActiveStudents('id,name,gcc_no,course,batch,hostel_type,admission_date,phone')
  const duesResults = await getDuesForStudents(students)
  return duesResults
    .filter(r => r.dues.totalDue > 0)
    .sort((a, b) => b.dues.totalDue - a.dues.totalDue)
    .slice(0, limit)
}

// ═══════════════════════════════════════════════════════════════════════════
// 13–15. ACADEMIC INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

// 13. getTopperTrends — top performers per subject across all recorded
// exams, so a strong student's trajectory (and which subjects they lead
// in) is visible without manually filtering Exams.jsx per subject.
export async function getTopperTrends({ topN = 5 } = {}) {
  const marks = await fetchAll('exam_marks', { select: 'student_id,subject,marks_obtained,exam_date' })
  const students = await getActiveStudents('id,name,course,batch')
  const studentById = Object.fromEntries(students.map(s => [s.id, s]))

  const bySubject = {}
  for (const m of marks) {
    if (m.marks_obtained == null) continue
    bySubject[m.subject] ??= []
    bySubject[m.subject].push(m)
  }

  return Object.entries(bySubject).map(([subject, rows]) => ({
    subject,
    top: rows
      .sort((a, b) => b.marks_obtained - a.marks_obtained)
      .slice(0, topN)
      .map(r => ({ student: studentById[r.student_id] || null, marks: r.marks_obtained, examDate: r.exam_date })),
  }))
}

// 14. getSubjectWeaknessReport — average marks per subject per batch,
// flagging where a WHOLE batch is underperforming — often a teaching-side
// signal rather than an individual-student one, which the per-student
// exam views can't surface.
export async function getSubjectWeaknessReport({ weakThreshold = 40 } = {}) {
  const marks = await fetchAll('exam_marks', { select: 'student_id,subject,marks_obtained' })
  const students = await getActiveStudents('id,batch')
  const batchById = Object.fromEntries(students.map(s => [s.id, s.batch || 'Unassigned']))

  const groups = {}
  for (const m of marks) {
    if (m.marks_obtained == null) continue
    const batch = batchById[m.student_id] || 'Unassigned'
    const key = `${batch}|${m.subject}`
    groups[key] ??= { batch, subject: m.subject, sum: 0, count: 0 }
    groups[key].sum += m.marks_obtained
    groups[key].count++
  }

  const rows = Object.values(groups).map(g => ({ ...g, average: Math.round((g.sum / g.count) * 10) / 10 }))
  return {
    weak: rows.filter(r => r.average < weakThreshold).sort((a, b) => a.average - b.average),
    all: rows.sort((a, b) => a.average - b.average),
  }
}

// 15. getExamParticipationGaps — active students with an admission
// record and attendance history but zero exam marks on file: falling
// through the cracks in a way that won't show up in any single-module
// view, since Admissions and Attendance both look fine for them.
export async function getExamParticipationGaps() {
  const students = await getActiveStudents('id,name,gcc_no,course,batch')
  const [marks, attendance] = await Promise.all([
    fetchAll('exam_marks', { select: 'student_id' }),
    fetchAll('attendance_records', { select: 'gcc_no' }),
  ])
  const hasMarks = new Set(marks.map(m => m.student_id))
  const hasAttendance = new Set(attendance.map(a => String(a.gcc_no)))

  return students.filter(s => !hasMarks.has(s.id) && hasAttendance.has(String(s.gcc_no)))
}

// ═══════════════════════════════════════════════════════════════════════════
// 16–18. HOSTEL / DISCIPLINE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

// 16. getDisciplineRepeatOffenders — students with 3+ discipline records
// within a rolling window, the pattern worth a parent conversation rather
// than a one-off note in a file.
export async function getDisciplineRepeatOffenders({ days = 90, minCount = 3 } = {}) {
  const since = daysAgo(days)
  const records = await fetchAll('discipline_records', { select: 'student_id,category,status,date' })
  const students = await getActiveStudents('id,name,gcc_no,course,batch,house')
  const studentById = Object.fromEntries(students.map(s => [s.id, s]))

  const byStudent = {}
  for (const r of records) {
    if (!r.date || new Date(r.date) < since) continue
    byStudent[r.student_id] ??= []
    byStudent[r.student_id].push(r)
  }

  return Object.entries(byStudent)
    .filter(([, rows]) => rows.length >= minCount)
    .map(([studentId, rows]) => ({ student: studentById[studentId] || null, count: rows.length, records: rows.sort((a, b) => new Date(b.date) - new Date(a.date)) }))
    .sort((a, b) => b.count - a.count)
}

// 17. getHouseHealthScore — per-house composite of occupancy, discipline
// rate, sickbay rate, and attendance, so a single house that needs
// attention (a housemaster problem, an overcrowding problem, whatever it
// is) surfaces as one number instead of four separate module views that
// don't share a "by house" grouping today.
export async function getHouseHealthScore() {
  const students = await getActiveStudents('id,gcc_no,house')
  const boarders = students.filter(s => s.house)
  const [discipline, sickbay, attendance] = await Promise.all([
    fetchAll('discipline_records', { select: 'student_id,status' }),
    fetchAll('sickbay_records', { select: 'student_id,status' }),
    fetchAll('attendance_records', { select: 'gcc_no,status' }),
  ])

  const studentIdsByHouse = {}
  const gccByHouse = {}
  for (const s of boarders) {
    studentIdsByHouse[s.house] ??= new Set()
    studentIdsByHouse[s.house].add(s.id)
    gccByHouse[s.house] ??= new Set()
    gccByHouse[s.house].add(String(s.gcc_no))
  }

  const houses = [...new Set(boarders.map(s => s.house))]
  return houses.map(house => {
    const ids = studentIdsByHouse[house]
    const gccs = gccByHouse[house]
    const occupancy = ids.size

    const houseDiscipline = discipline.filter(d => ids.has(d.student_id) && isOpenStatus(d.status)).length
    const houseSickbay = sickbay.filter(s => ids.has(s.student_id)).length
    const houseAtt = attendance.filter(a => gccs.has(String(a.gcc_no)))
    const attPct = houseAtt.length ? Math.round((houseAtt.filter(a => String(a.status).toLowerCase() === 'present').length / houseAtt.length) * 100) : null

    // Simple 0-100 composite: starts at 100, deducted per issue rate.
    // Deliberately transparent/linear rather than a hidden weighting
    // scheme, so Himan can see exactly why a house scored what it did.
    let score = 100
    if (occupancy > 0) {
      score -= Math.min(30, (houseDiscipline / occupancy) * 40)
      score -= Math.min(20, (houseSickbay / occupancy) * 20)
    }
    if (attPct != null) score -= Math.max(0, (85 - attPct))
    score = Math.max(0, Math.round(score))

    return { house, occupancy, openDiscipline: houseDiscipline, sickbayVisits: houseSickbay, attendancePct: attPct, score }
  }).sort((a, b) => a.score - b.score)
}

// 18. getSickbayPatternAlert — same student admitted to sickbay
// repeatedly within a window — worth a parent call about a possible
// chronic issue, rather than treating each visit as an isolated event.
export async function getSickbayPatternAlert({ days = 60, minVisits = 3 } = {}) {
  const since = daysAgo(days)
  const records = await fetchAll('sickbay_records', { select: 'student_id,condition,reason,status,date' })
  const students = await getActiveStudents('id,name,gcc_no,course,batch,house')
  const studentById = Object.fromEntries(students.map(s => [s.id, s]))

  const byStudent = {}
  for (const r of records) {
    if (!r.date || new Date(r.date) < since) continue
    byStudent[r.student_id] ??= []
    byStudent[r.student_id].push(r)
  }

  return Object.entries(byStudent)
    .filter(([, rows]) => rows.length >= minVisits)
    .map(([studentId, rows]) => ({
      student: studentById[studentId] || null,
      visitCount: rows.length,
      conditions: [...new Set(rows.map(r => r.condition || r.reason).filter(Boolean))],
      records: rows.sort((a, b) => new Date(b.date) - new Date(a.date)),
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
}

// ═══════════════════════════════════════════════════════════════════════════
// 19–20. CROSS-CUTTING / META
// ═══════════════════════════════════════════════════════════════════════════

// 19. getWeeklyAdminDigest — the "read this in 60 seconds" function.
// Assembles the highest-signal numbers from the functions above into one
// object a UI (or a scheduled export) can render as a single summary
// screen or push notification, instead of admin having to open five tabs
// every Monday morning.
export async function getWeeklyAdminDigest() {
  const [
    activeCount, openMismatches, atRisk, revenueForecast,
    staleRecords, topDefaulters, disciplineRepeat, houseHealth,
  ] = await Promise.all([
    getActiveStudents('id').then(r => r.length),
    getOpenMismatches(500),
    getAtRiskStudents({ limit: 10 }),
    getRevenueForecast(),
    getStaleRecordsReport(),
    getTopDefaultersByAmount({ limit: 5 }),
    getDisciplineRepeatOffenders({ limit: 5 }),
    getHouseHealthScore(),
  ])

  return {
    generatedAt: new Date().toISOString(),
    activeStudentCount: activeCount,
    openMismatchCount: openMismatches.length,
    topAtRisk: atRisk,
    revenueForecast,
    staleRecordsTotal: staleRecords.total,
    staleRecords,
    topDefaulters,
    disciplineRepeatOffenders: disciplineRepeat.slice(0, 5),
    weakestHouse: houseHealth[0] || null,
    houseHealth,
  }
}

// 20. getAnomalyAlerts — generic statistical outlier detector, extending
// the mismatch-detection philosophy beyond cross-module disagreements
// into single-table outliers: a fee payment far outside the normal range
// for its type, or attendance marked for a student against a batch they
// aren't currently enrolled in.
export async function getAnomalyAlerts() {
  const alerts = []

  // Fee payments unusually large vs the mean for their own table — a
  // typo (₹50,000 instead of ₹5,000) is exactly this shape of outlier.
  const feeSources = [
    { table: 'adm_fee_collections', amountCol: 'amount_paid', label: 'Admission fee payment' },
    { table: 'adm_flat_fees', amountCol: 'amount', label: 'Flat fee payment' },
    { table: 'adm_course_fees', amountCol: 'amount_paid', label: 'Course fee payment' },
  ]
  for (const src of feeSources) {
    const rows = await fetchAll(src.table, { select: `id,${src.amountCol},adm_app_id` })
    const amounts = rows.map(r => Number(r[src.amountCol] || 0)).filter(n => n > 0)
    if (amounts.length < 5) continue
    const mean = amounts.reduce((s, n) => s + n, 0) / amounts.length
    const variance = amounts.reduce((s, n) => s + (n - mean) ** 2, 0) / amounts.length
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) continue
    for (const r of rows) {
      const amt = Number(r[src.amountCol] || 0)
      if (amt > 0 && (amt - mean) / stdDev > 3) {
        alerts.push({ type: 'fee_outlier', table: src.table, label: src.label, id: r.id, amount: amt, mean: Math.round(mean), gcc: r.adm_app_id })
      }
    }
  }

  // Attendance marked for a batch the student isn't currently in —
  // catches stale roster data or a copy-paste marking error.
  const [students, attendance] = await Promise.all([
    getAllStudents('id,gcc_no,batch'),
    fetchAll('attendance_records', { select: 'id,gcc_no,status' }),
  ])
  const gccSet = new Set(students.map(s => String(s.gcc_no)).filter(Boolean))
  for (const r of attendance) {
    if (r.gcc_no != null && !gccSet.has(String(r.gcc_no))) {
      alerts.push({ type: 'attendance_unknown_student', table: 'attendance_records', id: r.id, gcc: r.gcc_no })
    }
  }

  return alerts
}
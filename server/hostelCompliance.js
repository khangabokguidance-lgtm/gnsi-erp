// server/hostelCompliance.js (served via /api/window-notifier?job=compliance — kept out of api/ to stay under the Hobby 12-function limit)
// Server-side daily enforcement for every active housemaster/mistress.
//
// The in-app compliance checks (Hostel.jsx) only run in the housemaster's own
// browser once a roll call reaches 100%, so a housemaster who never opens the
// app — or never starts roll call — leaves no trace. This job closes that gap:
// once a day it checks, for every house with an active housemaster:
//   1. Morning + Night roll call fully marked        → 'missed_rollcall'
//   2. The six mandatory tabs logged during the day  → 'missed_sixtab'
// and writes each gap to hm_neglect_log (the same table the Neglect Report and
// HM performance ranking read), then pushes to the housemaster and all admins.
//
// A missed roll call carries the same "Penalty/fine applicable" notice as a
// late one, and is counted with late roll calls in the HM performance ranking.
// Housemasters on approved leave (leaves / staff_leave_requests) are skipped.
//
// Idempotent: re-running for the same date never creates duplicate rows or
// duplicate notifications. Safe to run more than once a day.
//
// Phases (via /api/window-notifier?job=compliance&phase=...):
//   (none)        enforce ?date= (default today IST) — back-fill / manual run
//   warn-morning  push "morning roll call due 7:00 AM" to HMs still unmarked
//   warn-evening  push "night roll call due 8:00 PM" + unlogged six tabs
//   job=daily     enforce YESTERDAY + warn-morning today (cron 00:00 UTC = 05:30 IST)
// Hobby plan = 2 daily crons, so: 05:30 IST daily job, 18:30 IST warn-evening.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@guidancekhangabok.in',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SESSIONS = ['morning', 'night']
const SIX_TABS = [
  { key: 'discipline', label: 'Discipline' },
  { key: 'sickbay', label: 'Sickbay' },
  { key: 'maintenance', label: 'Repairs' },
  { key: 'journal', label: 'Journal' },
  { key: 'messduty', label: 'Mess Duty' },
  { key: 'activities', label: 'Activities' },
]

const norm = (s) => (s || '').trim().toLowerCase()
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

// Full IST calendar day as UTC instants.
function dayWindow(dateStr) {
  const start = new Date(`${dateStr}T00:00:00+05:30`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Errors are treated as "can't verify" (compliant) so an outage never produces
// false neglect records — same rule as the in-app checker.
async function hasAny(query) {
  try {
    const { data, error } = await query
    if (error) return true
    return (data || []).length > 0
  } catch {
    return true
  }
}

const TAB_CHECKERS = {
  discipline: (house, s, e, ids) => !ids.length ? true :
    hasAny(supabase.from('discipline_records').select('id').in('student_id', ids).gte('created_at', s).lt('created_at', e).limit(1)),
  sickbay: (house, s, e, ids) => !ids.length ? true :
    hasAny(supabase.from('sickbay_records').select('id').in('student_id', ids).gte('created_at', s).lt('created_at', e).limit(1)),
  maintenance: (house, s, e) =>
    hasAny(supabase.from('maintenance_records').select('id').ilike('house', house).gte('created_at', s).lt('created_at', e).limit(1)),
  journal: (house, s, e) =>
    hasAny(supabase.from('housemaster_journal').select('id').ilike('house', house).gte('created_at', s).lt('created_at', e).limit(1)),
  messduty: (house, s, e) =>
    hasAny(supabase.from('mess_duty').select('id').ilike('house', house).gte('created_at', s).lt('created_at', e).limit(1)),
  activities: async (house, s, e) => {
    for (const table of ['housemaster_activities', 'hm_activities', 'activity_logs']) {
      try {
        const { data, error } = await supabase.from(table).select('id').ilike('house', house).gte('created_at', s).lt('created_at', e).limit(1)
        if (!error) return (data || []).length > 0
      } catch { /* try next candidate table */ }
    }
    return true
  },
}


async function pushToStaff(staffIds, title, body, url, tag) {
  const ids = [...new Set(staffIds.filter(Boolean))]
  if (!ids.length) return
  const { data: subs } = await supabase.from('push_subscriptions').select('*').in('staff_id', ids)
  const payload = JSON.stringify({ title, body, url, tag: tag || `${url}-${title}` })
  await Promise.allSettled((subs || []).map((sub) =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      .catch(async (err) => {
        if (err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      })
  ))
}

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Query errors yield [] — a failed leave lookup must not block enforcement.
async function safeRows(query) {
  try {
    const { data, error } = await query
    return error ? [] : (data || [])
  } catch {
    return []
  }
}

// Builds everything both phases need: houses (with housemasters not on
// approved leave), roll call counts, and who to notify.
async function loadContext(date) {
  const [{ data: housemasters }, { data: students }, { data: records }, { data: staff }, { data: admins }, leaves, staffLeaves] =
    await Promise.all([
      supabase.from('housemasters').select('name,house').eq('status', 'Active'),
      supabase.from('students').select('id,house').neq('status', 'Inactive'),
      supabase.from('attendance_records').select('house,session,student_id').eq('date', date).in('session', SESSIONS),
      supabase.from('staff_profiles').select('id,name'),
      supabase.from('staff_profiles').select('id').ilike('role', 'admin'),
      safeRows(supabase.from('leaves').select('staff_id,start_date,end_date').eq('status', 'approved').lte('start_date', date).gte('end_date', date)),
      safeRows(supabase.from('staff_leave_requests').select('staff_name,from_date,to_date').eq('status', 'Approved').is('deleted_at', null).lte('from_date', date)),
    ])

  const staffByName = (name) => (staff || []).find((x) => norm(x.name) === norm(name))
  const leaveStaffIds = new Set(leaves.map((l) => l.staff_id))
  const leaveNames = new Set(staffLeaves.filter((l) => (l.to_date || l.from_date) >= date).map((l) => norm(l.staff_name)))
  const onLeave = (name) => leaveNames.has(norm(name)) || leaveStaffIds.has(staffByName(name)?.id)

  // One entry per house; a house may have several housemasters.
  const houses = {}
  const skippedOnLeave = new Set()
  for (const hm of housemasters || []) {
    if (!hm.house) continue
    if (onLeave(hm.name)) { skippedOnLeave.add(hm.house); continue }
    const k = norm(hm.house)
    houses[k] ??= { house: hm.house, names: [], staffIds: [] }
    houses[k].names.push(hm.name)
    const sid = staffByName(hm.name)?.id
    if (sid) houses[k].staffIds.push(sid)
  }
  // A house with at least one housemaster present is not "skipped".
  const skipped = [...skippedOnLeave].filter((h) => !houses[norm(h)])

  const markedCount = (house, session) => new Set((records || [])
    .filter((r) => norm(r.house) === norm(house) && r.session === session)
    .map((r) => r.student_id)).size
  const studentsOf = (house) => (students || []).filter((s) => norm(s.house) === norm(house))

  return { houses: Object.values(houses), skipped, adminIds: (admins || []).map((a) => a.id), markedCount, studentsOf }
}

async function missingTabs(house, ids, start, end) {
  const results = await Promise.all(SIX_TABS.map((t) => TAB_CHECKERS[t.key](house, start, end, ids)))
  return SIX_TABS.filter((_, i) => !results[i])
}

export async function runEnforcement(date) {
  const { start, end } = dayWindow(date)
  const ctx = await loadContext(date)
  const { data: existing } = await supabase.from('hm_neglect_log').select('house,session,check_type')
    .eq('date', date).in('check_type', ['missed_rollcall', 'missed_sixtab'])
  const logged = new Set((existing || []).map((r) => `${norm(r.house)}|${r.session}|${r.check_type}`))
  const summary = []

  for (const { house, names, staffIds } of ctx.houses) {
    const hmName = names.join(' / ')
    const houseStudents = ctx.studentsOf(house)
    if (!houseStudents.length) continue
    const gaps = []

    for (const session of SESSIONS) {
      const unmarked = houseStudents.length - ctx.markedCount(house, session)
      if (unmarked > 0 && !logged.has(`${norm(house)}|${session}|missed_rollcall`)) {
        const label = session === 'morning' ? 'Morning' : 'Night'
        gaps.push({
          session, check_type: 'missed_rollcall',
          missing_tabs: [`${label} roll call not completed — ${unmarked} of ${houseStudents.length} students unmarked. Penalty/fine applicable.`],
          text: `${session} roll call not completed (${unmarked}/${houseStudents.length} unmarked). Penalty/fine applicable.`,
        })
      }
    }

    if (!logged.has(`${norm(house)}|daily|missed_sixtab`)) {
      const missing = await missingTabs(house, houseStudents.map((s) => s.id), start, end)
      if (missing.length) {
        gaps.push({
          session: 'daily', check_type: 'missed_sixtab',
          missing_tabs: missing.map((t) => t.key),
          text: `nothing logged today in: ${missing.map((t) => t.label).join(', ')}`,
        })
      }
    }

    for (const gap of gaps) {
      const { error } = await supabase.from('hm_neglect_log').insert([{
        house, date, session: gap.session, housemaster_name: hmName,
        missing_tabs: gap.missing_tabs, skip_reasons: {}, check_type: gap.check_type,
      }])
      if (error) { summary.push({ house, error: error.message }); continue }
      await pushToStaff(staffIds, `⚠️ Compliance missed — ${house}`, `${date}: ${gap.text} This has been reported to the admin.`, '/hostel?tab=attendance')
      await pushToStaff(ctx.adminIds, `🚨 ${hmName} (${house}) neglect`, `${date}: ${gap.text}`, '/hostel?tab=neglectreport')
      summary.push({ house, hm: hmName, type: gap.check_type, session: gap.session })
    }
  }
  return { date, houses: ctx.houses.length, skippedOnLeave: ctx.skipped, logged: summary.length, summary }
}

// Pre-deadline reminders. Not logged — they exist to prevent the miss.
export async function runWarnings(date, phase) {
  const { start, end } = dayWindow(date)
  const ctx = await loadContext(date)
  const sent = []

  for (const { house, names, staffIds } of ctx.houses) {
    const houseStudents = ctx.studentsOf(house)
    if (!houseStudents.length || !staffIds.length) continue
    const lines = []
    const session = phase === 'morning' ? 'morning' : 'night'
    const deadline = phase === 'morning' ? '7:00 AM' : '8:00 PM'
    const unmarked = houseStudents.length - ctx.markedCount(house, session)
    if (unmarked > 0) lines.push(`${session} roll call due by ${deadline} (+15 min grace): ${unmarked} of ${houseStudents.length} unmarked`)
    if (phase === 'evening') {
      const missing = await missingTabs(house, houseStudents.map((s) => s.id), start, end)
      if (missing.length) lines.push(`not yet logged today: ${missing.map((t) => t.label).join(', ')}`)
    }
    if (!lines.length) continue
    await pushToStaff(
      staffIds,
      `⏰ Reminder — ${house}`,
      `${lines.join('; ')}. Missing these is reported to the admin with a penalty/fine.`,
      '/hostel?tab=attendance',
      `compliance-warn-${phase}-${house}-${date}`
    )
    sent.push({ house, hm: names.join(' / '), lines })
  }
  return { date, phase, skippedOnLeave: ctx.skipped, warned: sent.length, sent }
}

// Cron entry used by window-notifier?job=daily (00:00 UTC = 05:30 IST).
export async function runDaily() {
  const today = todayIST()
  return {
    enforcedYesterday: await runEnforcement(addDays(today, -1)),
    morningWarning: await runWarnings(today, 'morning'),
  }
}

export async function enforceCompliance(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  // Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.date || '') ? req.query.date : todayIST()
  const phase = req.query?.phase
  if (phase === 'warn-morning') return res.json({ ok: true, ...(await runWarnings(date, 'morning')) })
  if (phase === 'warn-evening') return res.json({ ok: true, ...(await runWarnings(date, 'evening')) })
  res.json({ ok: true, ...(await runEnforcement(date)) })
}

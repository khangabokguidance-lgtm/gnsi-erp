// api/hostel-compliance-enforce.js
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
// Idempotent: re-running for the same date never creates duplicate rows or
// duplicate notifications. Safe to run more than once a day.
//
// Schedule: vercel.json cron (UTC). 18:00 UTC = 23:30 IST, after both the
// 7:00 AM / 8:00 PM roll call deadlines and the full day's logging window.
// Optional: ?date=YYYY-MM-DD to back-fill a missed day.
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

async function pushToStaff(staffIds, title, body, url) {
  const ids = [...new Set(staffIds.filter(Boolean))]
  if (!ids.length) return
  const { data: subs } = await supabase.from('push_subscriptions').select('*').in('staff_id', ids)
  const payload = JSON.stringify({ title, body, url, tag: `${url}-${title}` })
  await Promise.allSettled((subs || []).map((sub) =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      .catch(async (err) => {
        if (err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      })
  ))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  // Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.date || '') ? req.query.date : todayIST()
  const { start, end } = dayWindow(date)

  const [{ data: housemasters }, { data: students }, { data: records }, { data: existing }, { data: staff }, { data: admins }] =
    await Promise.all([
      supabase.from('housemasters').select('name,house').eq('status', 'Active'),
      supabase.from('students').select('id,house').neq('status', 'Inactive'),
      supabase.from('attendance_records').select('house,session,student_id').eq('date', date).in('session', SESSIONS),
      supabase.from('hm_neglect_log').select('house,session,check_type').eq('date', date).in('check_type', ['missed_rollcall', 'missed_sixtab']),
      supabase.from('staff_profiles').select('id,name'),
      supabase.from('staff_profiles').select('id').ilike('role', 'admin'),
    ])

  // One entry per house; a house may have several housemasters.
  const houses = {}
  for (const hm of housemasters || []) {
    if (!hm.house) continue
    const k = norm(hm.house)
    houses[k] ??= { house: hm.house, names: [] }
    houses[k].names.push(hm.name)
  }

  const logged = new Set((existing || []).map((r) => `${norm(r.house)}|${r.session}|${r.check_type}`))
  const adminIds = (admins || []).map((a) => a.id)
  const summary = []

  for (const { house, names } of Object.values(houses)) {
    const hmName = names.join(' / ')
    const houseStudents = (students || []).filter((s) => norm(s.house) === norm(house))
    if (!houseStudents.length) continue
    const staffIds = (staff || []).filter((s) => names.some((n) => norm(n) === norm(s.name))).map((s) => s.id)

    const gaps = [] // { session, check_type, missing_tabs[], text }

    for (const session of SESSIONS) {
      const marked = new Set((records || [])
        .filter((r) => norm(r.house) === norm(house) && r.session === session)
        .map((r) => r.student_id)).size
      if (marked < houseStudents.length && !logged.has(`${norm(house)}|${session}|missed_rollcall`)) {
        gaps.push({
          session, check_type: 'missed_rollcall',
          missing_tabs: [`${session === 'morning' ? 'Morning' : 'Night'} roll call not completed — ${houseStudents.length - marked} of ${houseStudents.length} students unmarked`],
          text: `${session} roll call incomplete (${houseStudents.length - marked}/${houseStudents.length} unmarked)`,
        })
      }
    }

    if (!logged.has(`${norm(house)}|daily|missed_sixtab`)) {
      const ids = houseStudents.map((s) => s.id)
      const results = await Promise.all(SIX_TABS.map((t) => TAB_CHECKERS[t.key](house, start, end, ids)))
      const missing = SIX_TABS.filter((_, i) => !results[i])
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
      await pushToStaff(staffIds, `⚠️ Compliance missed — ${house}`, `${date}: ${gap.text}. This has been reported to the admin.`, '/hostel?tab=attendance')
      await pushToStaff(adminIds, `🚨 ${hmName} (${house}) neglect`, `${date}: ${gap.text}`, '/hostel?tab=neglectreport')
      summary.push({ house, hm: hmName, type: gap.check_type, session: gap.session })
    }
  }

  res.json({ ok: true, date, houses: Object.keys(houses).length, logged: summary.length, summary })
}

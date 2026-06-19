import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@guidancekhangabok.in",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Roll call cutoff times (24h, IST) — edit these to match your schedule ──
const CUTOFFS = { morning: "09:00", night: "21:00" }

function nowIST() {
  // Vercel cron runs in UTC. IST = UTC + 5:30.
  const utc = new Date()
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000)
}

const norm = (s) => (s || "").trim().toLowerCase()

export default async function handler(req, res) {
  const ist = nowIST()
  const nowHM = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`
  const todayStr = ist.toISOString().split("T")[0]

  const session = Object.entries(CUTOFFS).find(([, t]) => t === nowHM)?.[0]
  if (!session) return res.json({ ok: true, skipped: "not a cutoff minute", nowHM })

  const [{ data: housemasters }, { data: students }, { data: records }, { data: staff }] =
    await Promise.all([
      supabase.from("housemasters").select("name,house").eq("status", "Active"),
      supabase.from("students").select("id,house").neq("status", "Inactive"),
      supabase.from("attendance_records").select("student_id,house").eq("date", todayStr).eq("session", session),
      supabase.from("staff_profiles").select("id,name"),
    ])

  let notified = 0
  const details = []

  for (const hm of housemasters || []) {
    const house = hm.house
    if (!house) continue

    const total = (students || []).filter((s) => norm(s.house) === norm(house)).length
    if (!total) continue

    const marked = (records || []).filter((r) => norm(r.house) === norm(house)).length
    if (marked >= total) continue // roll call already complete — no reminder needed

    const staffMatch = (staff || []).find((s) => norm(s.name) === norm(hm.name))
    if (!staffMatch) {
      details.push({ house, skipped: `no staff_profiles match for "${hm.name}"` })
      continue
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("staff_id", staffMatch.id)

    if (!subs?.length) {
      details.push({ house, skipped: "no push subscription for housemaster" })
      continue
    }

    const payload = JSON.stringify({
      title: `📋 ${session === "morning" ? "Morning" : "Night"} Roll Call Pending`,
      body: `${house}: ${total - marked} of ${total} students not yet marked`,
      url: "/hostel?tab=attendance",
      tag: `rollcall-${house}-${session}-${todayStr}`,
    })

    await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          .catch(async (err) => {
            if (err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
            }
          })
      )
    )
    notified++
    details.push({ house, notified: true, unmarked: total - marked })
  }

  res.json({ ok: true, session, notified, details })
}
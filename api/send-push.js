import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@guidancekhangabok.in",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const { title, body, icon = "/logo.png", url = "/", staffId = null, tag = null } = req.body || {}

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // ── Targeted send: only to this staff_id's devices ──
  // ── Broadcast send (no staffId given): every subscribed device ──
  let query = supabase.from("push_subscriptions").select("*")
  if (staffId) query = query.eq("staff_id", staffId)

  const { data: subs, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!subs?.length) return res.json({ ok: true, sent: 0, failed: 0 })

  const payload = JSON.stringify({ title, body, icon, url, tag })

  let sent = 0
  let failed = 0

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err) {
        failed++
        // 410 Gone = the browser unsubscribed; clean up the dead row
        if (err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
        }
      }
    })
  )

  res.json({ ok: true, sent, failed })
}
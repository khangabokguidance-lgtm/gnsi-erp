// api/send-push.js
// Sends push notifications to staff or admins
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { staff_id, role, payload } = req.body
  if (!payload) return res.status(400).json({ error: 'Missing payload' })

  // Fetch matching subscriptions
  let query = supabase.from('push_subscriptions').select('*')
  if (staff_id) query = query.eq('staff_id', staff_id)
  else if (role) query = query.eq('role', role)

  const { data: subs, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!subs?.length) return res.json({ ok: true, sent: 0 })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async err => {
        // Subscription expired — remove it
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  res.json({ ok: true, sent, failed })
}
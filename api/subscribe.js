// api/subscribe.js
// Saves a push subscription to Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role — can write without RLS
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { subscription, staff_id, role } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Missing subscription' })

  const { error } = await supabase.from('push_subscriptions').upsert({
    staff_id:   staff_id || null,
    role:       role     || 'staff',
    endpoint:   subscription.endpoint,
    p256dh:     subscription.keys.p256dh,
    auth:       subscription.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}
// api/window-notifier.js
// Called by a Vercel Cron Job every minute to alert staff when check-in window opens
// Add to vercel.json (see instructions below)
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

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number); return h * 60 + m
}
function nowIST() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return ist.getHours() * 60 + ist.getMinutes()
}
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function handler(req, res) {
  // Vercel cron sends GET — allow it; block everything else
  if (req.method !== 'GET') return res.status(405).end()

  const now      = nowIST()
  const todayStr = todayIST()

  const { data: shifts } = await supabase
    .from('staff_shifts')
    .select('id, staff_id, shift_label, shift_start, check_in_window_min')
    .eq('is_active', true)

  if (!shifts?.length) return res.json({ ok: true, notified: 0 })

  let notified = 0

  for (const shift of shifts) {
    const windowMin   = shift.check_in_window_min || 10
    const alertAtMin  = toMinutes(shift.shift_start) - windowMin

    // Only fire in the exact 1-minute slot
    if (now < alertAtMin || now >= alertAtMin + 1) continue

    // Skip if already checked in today
    const { data: existing } = await supabase
      .from('staff_geo_attendance')
      .select('id')
      .eq('staff_id', shift.staff_id)
      .eq('date', todayStr)
      .eq('shift_label', shift.shift_label)
      .maybeSingle()

    if (existing) continue

    // Get subscriptions for this staff member
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('staff_id', shift.staff_id)

    if (!subs?.length) continue

    const payload = JSON.stringify({
      title: `📍 Check-in window open — Shift ${shift.shift_label}`,
      body:  `Your check-in window for ${shift.shift_start} is now open`,
      type:  'shift_open',
      tag:   `window-${shift.shift_label}-${todayStr}`,
      data:  { tab: 'checkin' },
    })

    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        })
      )
    )
    notified++
  }

  res.json({ ok: true, notified })
}
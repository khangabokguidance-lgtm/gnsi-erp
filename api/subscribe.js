// api/subscribe.js
// Saves a push subscription to Supabase.
// Identity comes from the caller's verified session, never from the request body:
//   • staff  → staff_id must be the staff_profile linked to THEIR login; "admin" role only for real admins
//   • parent → student_id must be a student their own login is allowed to read (RLS decides)
import { createClient } from '@supabase/supabase-js'
import { requireUser, isStaff, isAdmin, asUser, rateLimit } from './_guard/guard.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role — can write without RLS
)

// Same sanitising as the staff login e-mail (Login.jsx / qbank_actor_role): "<username>.staff@…"
const usernameOf = (email) => String(email || '').toLowerCase().replace(/\.staff@guidancekhangabok\.in$/, '')
const clean = (u) => String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')

async function staffOwns(user, staffId) {
  const { data } = await supabase.from('portal_users').select('username').eq('staff_profile_id', staffId)
  return (data || []).some(r => clean(r.username) === usernameOf(user.email))
}

export default async function handler(req, res) {
  // GET /api/subscribe — the VAPID public key (was api/vapid-key.js; merged to
  // stay within the Hobby plan's 12-function limit). Public by design.
  if (req.method === 'GET') return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: 'subscribe', max: 20, id: user.id })) return

  const { subscription, staff_id, student_id, role, endpoint } = req.body || {}

  // Unsubscribe: the browser sends only the endpoint.
  if (!subscription && endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', String(endpoint))
    return res.json({ ok: true })
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Missing subscription' })
  }

  const staff = await isStaff(user)
  let row
  if (staff) {
    if (staff_id && !(await staffOwns(user, staff_id))) return res.status(403).json({ error: 'staff_id does not belong to you' })
    const asAdmin = role === 'admin' && (await isAdmin(user))
    row = { staff_id: staff_id || null, student_id: null, role: asAdmin ? 'admin' : 'staff' }
  } else {
    // Parent device: prove the account may see this student (RLS on `students` is the source of truth).
    if (!student_id) return res.status(400).json({ error: 'student_id is required' })
    const { data: mine } = await asUser(user.token).from('students').select('id').eq('id', student_id).maybeSingle()
    if (!mine) return res.status(403).json({ error: 'Not allowed for this student' })
    row = { staff_id: null, student_id, role: 'parent' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    ...row,
    endpoint:   subscription.endpoint,
    p256dh:     subscription.keys.p256dh,
    auth:       subscription.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) return res.status(500).json({ error: 'Could not save the subscription' })
  res.json({ ok: true })
}

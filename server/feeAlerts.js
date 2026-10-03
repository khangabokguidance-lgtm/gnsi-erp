// server/feeAlerts.js — daily fees alert for admins (runs inside the existing
// /api/window-notifier?job=daily cron, so it adds no new serverless function).
// Pushes ONE notification to every admin when something needs attention:
//   • instalment plans with an overdue instalment
//   • promises-to-pay whose date has passed
//   • earlier days with collections but no daily closing
//   • revert/delete requests and low-fee concessions waiting for approval
//   • standing concessions expiring within 7 days
// Every query is optional: a missing table just contributes nothing.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@guidancekhangabok.in',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const rows = async q => { try { const { data, error } = await q; return error ? null : (data || []) } catch { return null } }
const count = async q => { try { const { count: c, error } = await q; return error ? 0 : (c || 0) } catch { return 0 } }

export async function runFeeAlerts() {
  const today = todayIST()
  const lines = []

  const plans = await rows(supabase.from('fee_installment_plans').select('installments').eq('status', 'active'))
  const overduePlans = (plans || []).filter(p => (p.installments || []).some(i => !(Number(i.paid_amount) >= Number(i.amount)) && i.due_date && i.due_date < today)).length
  if (overduePlans) lines.push(`${overduePlans} instalment plan${overduePlans > 1 ? 's' : ''} overdue`)

  const promises = await rows(supabase.from('fee_reminders').select('gcc, promise_date').eq('channel', 'promise').lt('promise_date', today).gte('promise_date', addDays(today, -14)))
  const promiseGccs = new Set((promises || []).map(p => p.gcc))
  if (promiseGccs.size) lines.push(`${promiseGccs.size} promise-to-pay date${promiseGccs.size > 1 ? 's' : ''} passed (last 14 days)`)

  // Days in the last 7 with fee collections but no closing record.
  const from = addDays(today, -7), to = addDays(today, -1)
  const [flat, crs, adm, closed] = await Promise.all([
    rows(supabase.from('adm_flat_fees').select('pay_date').eq('paid', true).eq('reverted', false).gte('pay_date', from).lte('pay_date', to)),
    rows(supabase.from('adm_course_fees').select('pay_date').eq('reverted', false).gte('pay_date', from).lte('pay_date', to)),
    rows(supabase.from('adm_fee_collections').select('pay_date').eq('reverted', false).gte('pay_date', from).lte('pay_date', to)),
    rows(supabase.from('fee_day_close').select('close_date').eq('status', 'closed').gte('close_date', from).lte('close_date', to)),
  ])
  if (closed !== null) {
    const days = new Set([...(flat || []), ...(crs || []), ...(adm || [])].map(r => r.pay_date))
    const done = new Set(closed.map(r => r.close_date))
    const open = [...days].filter(d => !done.has(d)).length
    if (open) lines.push(`${open} day${open > 1 ? 's' : ''} with collections not closed`)
  }

  const pendingReq = await count(supabase.from('fee_action_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
  const pendingConc = await count(supabase.from('fee_concessions').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
  if (pendingReq) lines.push(`${pendingReq} revert/delete approval${pendingReq > 1 ? 's' : ''} waiting`)
  if (pendingConc) lines.push(`${pendingConc} low-fee approval${pendingConc > 1 ? 's' : ''} waiting`)

  const expiring = await count(supabase.from('fee_concession_register').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('valid_to', today).lte('valid_to', addDays(today, 7)))
  if (expiring) lines.push(`${expiring} concession${expiring > 1 ? 's' : ''} expiring within 7 days`)

  if (!lines.length) return { sent: 0, lines }

  const admins = await rows(supabase.from('staff_profiles').select('id').ilike('role', 'admin'))
  const ids = (admins || []).map(a => a.id)
  if (!ids.length) return { sent: 0, lines, note: 'no admins found' }
  const subs = await rows(supabase.from('push_subscriptions').select('*').in('staff_id', ids))
  const payload = JSON.stringify({ title: '💰 Fees need attention', body: lines.join(' · '), url: '/', tag: `fee-alerts-${today}` })
  await Promise.allSettled((subs || []).map(sub =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      .catch(async err => { if (err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint) })
  ))
  return { sent: (subs || []).length, lines }
}

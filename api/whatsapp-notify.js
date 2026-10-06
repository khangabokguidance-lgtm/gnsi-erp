// api/whatsapp-notify.js — automatic WhatsApp notice to the fee approver (no tap needed).
//
// Sends through the WhatsApp Business *Cloud API*. The browser only passes a request id;
// the message text and the recipient are built HERE from the stored fee request, so this
// endpoint cannot be used to message arbitrary numbers or send arbitrary text.
//
// Vercel environment variables:
//   WHATSAPP_TOKEN          permanent access token (Meta Business)
//   WHATSAPP_PHONE_ID       WhatsApp Business phone-number id
//   WHATSAPP_ADMIN_TO       approver's number, digits with country code (default 918974298074)
//   WHATSAPP_TEMPLATE_NAME  (recommended) an approved template — WhatsApp only lets a business
//                           message someone first with a template; plain text works only within
//                           24h of that person last messaging the business number.
//   WHATSAPP_TEMPLATE_LANG  template language code (default en)
// Template body variables, in order: {{1}} student  {{2}} GCC  {{3}} months  {{4}} standard
//   {{5}} offered  {{6}} short  {{7}} reason  {{8}} requested by
import { createClient } from '@supabase/supabase-js'

const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

function build(kind, r) {
  const p = r.payload || {}, s = r.summary || {}
  const vars = [
    p.studentName || r.student_name || '—', String(p.gcc || r.gcc || '—'), (s.months || []).join(', ') || '—',
    inr(s.standard), inr(s.collected), inr(r.shortfall), (s.reasons || []).join(', ') || '—', r.requested_by || p.collectedBy || '—',
  ]
  const text = kind === 'pending'
    ? ['🔔 *Low-fee approval needed*', `Student: *${vars[0]}* (GCC-${vars[1]})`, `Class/Batch: ${p.className || '—'} · Course: ${p.course || '—'} · ${p.hostelType || '—'}`,
       `Month(s): ${vars[2]}`, `Standard ${vars[3]} · Offered ${vars[4]} · *Short ${vars[5]}*`, `Reason: ${vars[6]}`, `Requested by: ${vars[7]}`, '',
       'Approve or reject in Fees → Low Fees. Nothing is recorded until you approve.'].join('\n')
    : ['✅ *Low-fee payment collected*', `Student: *${vars[0]}* (GCC-${vars[1]})`, `Month(s): ${vars[2]}`,
       `Collected ${inr(s.total || s.collected)} (short ${vars[5]})`, `Receipt: ${r.collected_receipt_no || '—'}`, `Approved by: ${r.decided_by || '—'} · Collected by: ${vars[7]}`].join('\n')
  return { text, vars }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { requestId, kind } = req.body || {}
  if (!requestId || !['pending', 'collected'].includes(kind)) return res.status(400).json({ error: 'requestId and kind (pending|collected) are required' })

  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return res.status(503).json({ ok: false, configured: false, error: 'WhatsApp Cloud API is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID).' })

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: r, error } = await supabase.from('fee_payment_requests').select('*').eq('id', requestId).maybeSingle()
  if (error || !r) return res.status(404).json({ ok: false, error: error?.message || 'Request not found' })
  if (kind === 'pending' && r.status !== 'pending') return res.json({ ok: true, skipped: 'not pending' })
  if (kind === 'collected' && r.status !== 'collected') return res.json({ ok: true, skipped: 'not collected' })
  const stampCol = kind === 'pending' ? 'wa_pending_sent_at' : 'wa_collected_sent_at'
  if (r[stampCol]) return res.json({ ok: true, skipped: 'already sent' })

  const { text, vars } = build(kind, r)
  const to = String(process.env.WHATSAPP_ADMIN_TO || '918974298074').replace(/\D/g, '')
  const tpl = process.env.WHATSAPP_TEMPLATE_NAME
  const body = tpl && kind === 'pending'
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }, components: [{ type: 'body', parameters: vars.map(v => ({ type: 'text', text: String(v).slice(0, 200) })) }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }

  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await resp.json().catch(() => ({}))
    if (!resp.ok) return res.status(502).json({ ok: false, error: out?.error?.message || `WhatsApp API ${resp.status}` })
    await supabase.from('fee_payment_requests').update({ [stampCol]: new Date().toISOString() }).eq('id', requestId)
    return res.json({ ok: true, sent: true })
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message })
  }
}

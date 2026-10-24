// /api/razorpay/webhook.js
// Vercel serverless function (Node runtime). Handles Razorpay webhook events
// for payments that happen WITHOUT the Fees.jsx UI open — i.e. a parent pays
// a Razorpay Payment Link you sent them over WhatsApp/SMS, days after a
// staff member generated it. This is the server-side write path that
// finalizeCollection() covers for the in-app flow.
//
// Setup:
//   1. Razorpay Dashboard → Settings → Webhooks → Add new webhook
//      URL: https://guidancekhangabok.in/api/razorpay/webhook
//      Active events: payment_link.paid  (and/or payment.captured if you
//      create Orders directly instead of Payment Links)
//   2. Copy the "Webhook Secret" shown there into RAZORPAY_WEBHOOK_SECRET.
//
// Env vars required:
//   RAZORPAY_WEBHOOK_SECRET   — SECRET, from the Razorpay webhook config screen
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — SECRET, server-only (bypasses RLS; this file
//                               must never run in the browser)
//
// IMPORTANT: this endpoint must read the RAW request body to verify the
// signature — do not let a global JSON body-parser touch it first. The
// config below disables Vercel's automatic body parsing for this route.

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { buildOnlineRecords } from '../_razorpay/record.js'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const rawBody = await readRawBody(req)
  const signature = req.headers['x-razorpay-signature']

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (signature !== expected) {
    console.warn('razorpay webhook: signature mismatch')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event

  try {
    // ── payment_link.paid — the parent-facing remote flow ──────────────────
    // Expects the Payment Link to have been created with `notes: { gcc,
    // student_id, kind, for_month, year, course, subtype }` matching the
    // shape collectFee() expects — set these when you generate the link
    // (see create-payment-link.js below), not here.
    if (event === 'payment_link.paid') {
      const entity = payload.payload?.payment_link?.entity
      const paymentEntity = payload.payload?.payment?.entity
      const notes = entity?.notes || {}

      if (!notes.gcc) {
        console.error('razorpay webhook: payment_link.paid with no gcc in notes', entity?.id)
        try {
          await supabase.from('webhook_failures').insert([{
            provider: 'razorpay',
            event,
            error_message: 'payment_link.paid received with no gcc in notes — payment was made but cannot be matched to a student',
            payload,
            created_at: new Date().toISOString(),
            resolved: false,
          }])
        } catch (logErr) {
          console.error('razorpay webhook: could not record no-gcc failure row either:', logErr)
        }
        return res.status(200).json({ received: true, skipped: 'no gcc in notes' })
      }

      // Idempotency guard — Razorpay can retry webhook delivery. The payment id is written to txn_ref on
      // whichever fee table the payment lands in, so all three are checked (checking only
      // adm_fee_collections let a retried course/flat payment be recorded twice).
      const paymentId = paymentEntity?.id || entity?.id
      const seen = await Promise.all(['adm_fee_collections', 'adm_course_fees', 'adm_flat_fees'].map(t =>
        supabase.from(t).select('id').eq('txn_ref', paymentId).limit(1)))
      const lookupErr = seen.find(r => r.error)
      if (lookupErr) throw new Error(`could not check for an earlier record of ${paymentId}: ${lookupErr.error.message}`)
      if (seen.some(r => (r.data || []).length)) {
        return res.status(200).json({ received: true, skipped: 'already recorded' })
      }

      const amount = (entity?.amount_paid ?? paymentEntity?.amount ?? 0) / 100
      if (!(amount > 0)) throw new Error(`payment ${paymentId} has no amount to record`)
      const payDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

      // Fee row + Accounts row, shaped the way the fee screens and the Income vs Collection check expect
      // (see _razorpay/record.js). A failed insert is thrown, so it lands in webhook_failures below
      // instead of being lost while Razorpay is told "received".
      const { table, row, account } = buildOnlineRecords({ notes, paymentId, amount, payDate })
      const fee = await supabase.from(table).insert([row])
      if (fee.error) throw new Error(`could not save the ${table} row for ${paymentId}: ${fee.error.message}`)
      const acc = await supabase.from('accounts').upsert([account], { onConflict: 'source_ref,source_type', ignoreDuplicates: false })
      if (acc.error) throw new Error(`fee row saved but the Accounts entry for ${paymentId} failed: ${acc.error.message}`)

      console.log(`razorpay webhook: recorded ₹${amount} for GCC-${notes.gcc}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('razorpay webhook processing error:', err)
    // Best-effort: also write the failure to a table you can actually see
    // in your own app, instead of only a Vercel log line someone has to
    // remember to go check. If this insert itself fails (Supabase down,
    // wrong schema, etc.), swallow that too — this is a diagnostic aid,
    // never something that should crash or change the response we give
    // Razorpay below.
    try {
      await supabase.from('webhook_failures').insert([{
        provider: 'razorpay',
        event: event || null,
        error_message: err?.message || String(err),
        payload: payload || null,
        created_at: new Date().toISOString(),
        resolved: false,
      }])
    } catch (logErr) {
      console.error('razorpay webhook: could not record failure row either:', logErr)
    }
    // Return 200 anyway once you've logged it, or Razorpay will keep
    // retrying a payload that fails for a non-transient reason (e.g. a
    // schema mismatch) indefinitely. The webhook_failures row above is
    // what makes that safe — check Fees.jsx (or wherever this table is
    // surfaced) periodically, or against Razorpay's own Payments list, so
    // a failed write is caught even though Razorpay itself won't retry.
    return res.status(200).json({ received: true, error: 'processing failed, logged' })
  }
}
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
        return res.status(200).json({ received: true, skipped: 'no gcc in notes' })
      }

      // Idempotency guard — Razorpay can retry webhook delivery; a unique
      // constraint on txn_ref (payment id) in your fee tables is the
      // strongest guard, but this check avoids an obviously-duplicate insert
      // even without one.
      const paymentId = paymentEntity?.id || entity?.id
      const { data: existing } = await supabase
        .from('adm_fee_collections')
        .select('id')
        .eq('txn_ref', paymentId)
        .maybeSingle()
      if (existing) {
        return res.status(200).json({ received: true, skipped: 'already recorded' })
      }

      const amount = (entity?.amount_paid ?? paymentEntity?.amount ?? 0) / 100
      const payDate = new Date().toLocaleDateString('en-CA')

      // Route by fee kind — mirrors the `items` kinds used in Fees.jsx
      // (admission / flat / course / advance). Adjust table/columns to match
      // your actual schema if it differs from what collectFee() writes.
      if (notes.kind === 'course') {
        await supabase.from('adm_course_fees').insert([{
          adm_app_id: notes.gcc,
          course: notes.course || null,
          for_month: notes.for_month || null,
          year: notes.year || null,
          amount_paid: amount,
          pay_date: payDate,
          pay_mode: 'Razorpay',
          txn_ref: paymentId,
          collected_by: 'Online (Razorpay)',
          reverted: false,
        }])
      } else if (notes.kind === 'flat') {
        await supabase.from('adm_flat_fees').insert([{
          adm_app_id: notes.gcc,
          month: notes.for_month || null,
          year: notes.year || null,
          amount,
          paid: true,
          pay_date: payDate,
          pay_mode: 'Razorpay',
          txn_ref: paymentId,
          collected_by: 'Online (Razorpay)',
          reverted: false,
        }])
      } else {
        await supabase.from('adm_fee_collections').insert([{
          adm_app_id: notes.gcc,
          fee_type: notes.kind || 'other',
          amount_paid: amount,
          pay_date: payDate,
          pay_mode: 'Razorpay',
          txn_ref: paymentId,
          collected_by: 'Online (Razorpay)',
          reverted: false,
        }])
      }

      // Same ledger write collectFee() does for in-app collections, so
      // Accounts.jsx totals stay consistent regardless of collection path.
      await supabase.from('accounts').insert([{
        type: 'Income',
        amount,
        entry_date: payDate,
        description: `Fee payment (Razorpay) — GCC-${notes.gcc}`,
        source_ref: paymentId,
        source_type: notes.kind || 'fee',
        is_soft_deleted: false,
      }])

      console.log(`razorpay webhook: recorded ₹${amount} for GCC-${notes.gcc}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('razorpay webhook processing error:', err)
    // Return 200 anyway once you've logged it, or Razorpay will keep
    // retrying a payload that fails for a non-transient reason (e.g. a
    // schema mismatch) indefinitely. Prefer alerting yourself out-of-band
    // (Sentry, a Slack webhook, etc.) over relying on webhook retries.
    return res.status(200).json({ received: true, error: 'processing failed, logged' })
  }
}
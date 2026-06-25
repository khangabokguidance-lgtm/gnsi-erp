// supabase/functions/razorpay-webhook/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE SOURCE OF TRUTH for "did this payment actually happen?"
//
// Razorpay calls this URL server-to-server whenever a payment event occurs.
// This function:
//   1. Verifies the request really came from Razorpay (HMAC-SHA256 over the
//      raw request body, using the webhook secret — never the API key).
//   2. On a verified `payment.captured` event, marks the matching
//      adm_fee_collections row as 'paid' and stores the payment_id.
//   3. Is idempotent — a unique constraint on razorpay_payment_id means a
//      retried webhook (Razorpay retries on any non-2xx response) can never
//      double-record the same payment.
//
// CRITICAL: The browser's "payment success" callback in FeeCollectionModal
// must NEVER mark anything as paid by itself. It should show a "Confirming
// with bank…" state and poll/re-fetch — this function is the only writer
// of status = 'paid'.
//
// Deploy:
//   supabase functions deploy razorpay-webhook --no-verify-jwt
//   (✱ --no-verify-jwt is required: Razorpay does not send a Supabase JWT,
//      it sends its own HMAC signature instead — see auth: 'none' pattern)
//
// Register this function's URL in:
//   Razorpay Dashboard → Settings → Webhooks → Add New Webhook
//   Events to subscribe to: payment.captured, payment.failed
//
// Secrets needed (one-time):
//   supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx
//   (this is DIFFERENT from RAZORPAY_KEY_SECRET — generate it in the
//    Razorpay Dashboard webhook settings screen, not the API Keys screen)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Verifies a Razorpay webhook signature using HMAC-SHA256, in constant time.
 * Razorpay's scheme: signature = HMAC_SHA256(raw_body, webhook_secret), hex-encoded.
 */
async function verifyRazorpaySignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expectedHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison to avoid timing attacks
  if (expectedHex.length !== signatureHeader.length) return false
  let mismatch = 0
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return mismatch === 0
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // 1. Read the RAW body — signature verification must happen over the
  //    exact bytes Razorpay sent, before any JSON.parse() touches it.
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!signature) {
    console.warn('razorpay-webhook: missing signature header — rejecting')
    return new Response('Missing signature', { status: 400 })
  }

  const isValid = await verifyRazorpaySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)
  if (!isValid) {
    console.warn('razorpay-webhook: signature verification FAILED — rejecting. This request did not come from Razorpay.')
    return new Response('Invalid signature', { status: 400 })
  }

  // 2. Only after verification do we parse and act on the payload.
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ─── Phase 2 addition: route pending-application payments separately ───
  // create-pending-application-order tags its Razorpay order with
  // notes.kind = 'pending_application_fee'. We check that FIRST and, if
  // matched, handle it entirely here without touching any of the existing
  // adm_fee_collections logic below — the two flows are kept fully
  // independent so nothing about the original Phase B behavior changes.
  if (event.event === 'payment.captured') {
    const paymentEntity = event.payload?.payment?.entity
    if (paymentEntity?.notes?.kind === 'pending_application_fee') {
      try {
        const pendingAppId = paymentEntity.notes.pending_app_id
        const paymentId = paymentEntity.id as string
        const orderId = paymentEntity.order_id as string

        if (!pendingAppId) {
          console.error('razorpay-webhook: pending_application_fee payment missing pending_app_id note', paymentEntity)
          return new Response('OK (missing pending_app_id, flagged)', { status: 200 })
        }

        // Idempotency — same principle as the main flow below.
        const { data: existing } = await supabase
          .from('pending_applications')
          .select('id, status')
          .eq('id', pendingAppId)
          .eq('razorpay_payment_id', paymentId)
          .maybeSingle()
        if (existing) {
          return new Response('OK (already recorded)', { status: 200 })
        }

        await supabase.from('pending_applications').update({
          status: 'payment_confirmed',
          razorpay_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        }).eq('id', pendingAppId).eq('razorpay_order_id', orderId)

        await supabase.from('audit_logs').insert([{
          user_id: null,
          user_name: 'razorpay-webhook',
          action: 'admissions.PENDING_APPLICATION_PAYMENT_CONFIRMED',
          module: 'admissions',
          level: 'info',
          metadata: { pending_app_id: pendingAppId, razorpay_payment_id: paymentId },
        }])

        return new Response('OK', { status: 200 })
      } catch (err) {
        console.error('razorpay-webhook: pending-application branch error', err)
        return new Response('Internal error', { status: 500 })
      }
    }
  }
  // ─── End Phase 2 addition — everything below is the original, unmodified
  //     Phase B logic for real admissions.adm_fee_collections payments ───

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      if (!payment) {
        return new Response('Missing payment entity', { status: 400 })
      }

      const orderId = payment.order_id as string | null
      const paymentId = payment.id as string
      const amountPaise = payment.amount as number

      // Match against either an Order-based payment or a Payment-Link-based
      // payment — both flows insert a 'pending' row keyed differently.
      const matchColumn = orderId ? 'razorpay_order_id' : 'razorpay_payment_link_id'
      const matchValue = orderId || payment.invoice_id || payment.notes?.reference_id

      if (!matchValue) {
        console.error('razorpay-webhook: payment.captured with no matchable order/link id', payment)
        return new Response('OK', { status: 200 }) // ack so Razorpay stops retrying; log for manual review
      }

      // 3. Idempotency check — if this payment_id was already recorded,
      //    this is a webhook retry. Acknowledge without double-writing.
      const { data: alreadyRecorded } = await supabase
        .from('adm_fee_collections')
        .select('id, status')
        .eq('razorpay_payment_id', paymentId)
        .maybeSingle()

      if (alreadyRecorded) {
        return new Response('OK (already recorded)', { status: 200 })
      }

      // 4. Find the pending row this payment corresponds to.
      const { data: pendingRow, error: findErr } = await supabase
        .from('adm_fee_collections')
        .select('id, adm_app_id, amount')
        .eq(matchColumn, matchValue)
        .eq('status', 'pending')
        .maybeSingle()

      if (findErr || !pendingRow) {
        console.error('razorpay-webhook: no matching pending row found for', matchColumn, matchValue)
        // Still 200 — this could be a payment for something created outside
        // our flow; don't make Razorpay retry forever. Flag for manual review.
        return new Response('OK (no match — flagged for review)', { status: 200 })
      }

      // 5. Sanity check: paid amount should match what we expected. A
      //    mismatch doesn't necessarily mean fraud (could be a partial
      //    capture) but it must never be silently accepted.
      const expectedPaise = Math.round(pendingRow.amount * 100)
      if (amountPaise !== expectedPaise) {
        console.error(`razorpay-webhook: AMOUNT MISMATCH — expected ${expectedPaise}, got ${amountPaise} for row ${pendingRow.id}`)
        await supabase.from('adm_fee_collections').update({
          status: 'amount_mismatch',
          razorpay_payment_id: paymentId,
          payment_date: new Date().toISOString().slice(0, 10),
        }).eq('id', pendingRow.id)
        // Flagged, not silently marked paid — a human needs to look at this.
        return new Response('OK (amount mismatch flagged)', { status: 200 })
      }

      // 6. The actual, single point where a fee becomes "paid" in this
      //    entire system.
      await supabase.from('adm_fee_collections').update({
        status: 'paid',
        razorpay_payment_id: paymentId,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: payment.method || null,
      }).eq('id', pendingRow.id)

      await supabase.from('audit_logs').insert([{
        user_id: null,
        user_name: 'razorpay-webhook',
        action: 'admissions.PAYMENT_CONFIRMED',
        module: 'admissions',
        level: 'info',
        metadata: { adm_app_id: pendingRow.adm_app_id, amount: pendingRow.amount, razorpay_payment_id: paymentId },
      }])

      return new Response('OK', { status: 200 })
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      const orderId = payment?.order_id
      if (orderId) {
        await supabase.from('adm_fee_collections')
          .update({ status: 'failed' })
          .eq('razorpay_order_id', orderId)
          .eq('status', 'pending')
      }
      return new Response('OK', { status: 200 })
    }

    // Any other event type: acknowledge but take no action.
    return new Response('OK (unhandled event type)', { status: 200 })

  } catch (err) {
    console.error('razorpay-webhook: unexpected error', err)
    // Return 500 so Razorpay retries — this is a transient failure, not a
    // rejected/invalid request.
    return new Response('Internal error', { status: 500 })
  }
})

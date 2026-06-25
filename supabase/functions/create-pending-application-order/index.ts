// supabase/functions/create-pending-application-order/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Step 5 of the wizard. Same trust model as create-razorpay-order (Phase B):
// amount is computed server-side from data already in the pending_applications
// row, never from anything the browser sends. The webhook
// (razorpay-webhook, already built in Phase B) is extended slightly here —
// see the note at the bottom — to also recognize pending-application orders
// and flip pending_applications.status to 'payment_confirmed' instead of
// touching adm_fee_collections, since no real admission exists yet.
//
// Deploy:
//   supabase functions deploy create-pending-application-order
// Secrets: same RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET as Phase B.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { BASE_FEES } from '../_shared/feeCalc.ts'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { pending_app_id } = await req.json()
    if (!pending_app_id) {
      return new Response(JSON.stringify({ error: 'pending_app_id is required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: app, error: fetchErr } = await supabase
      .from('pending_applications')
      .select('id, name, phone, phone_verified, status, course, hostel_type')
      .eq('id', pending_app_id)
      .single()

    if (fetchErr || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (!app.phone_verified) {
      return new Response(JSON.stringify({ error: 'Phone number not verified — restart the application' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (app.status === 'payment_confirmed' || app.status === 'approved') {
      return new Response(JSON.stringify({ error: 'This application has already been paid for' }), {
        status: 409, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // pending_applications doesn't collect a hostel_type field in Step 2
    // (that's normally an admin decision made AFTER review, per the
    // existing AdmForm flow) — so the wizard's payment step charges the
    // standard Day Scholar admission fee as the application fee, with the
    // real hostel-type-based fee reconciled later by staff during review
    // (the same way AdmForm already shows "Base Fee" as informational
    // before final assignment). This avoids the wizard needing to expose
    // house/hostel assignment to the public, which is correctly an
    // internal decision per the existing admin flow.
    const amountPaise = (BASE_FEES['Day Scholar'] || 2000) * 100

    const authHeader = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const receipt = `gnsi-pend-${pending_app_id}`.slice(0, 40)

    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { pending_app_id, applicant_name: app.name, kind: 'pending_application_fee' },
      }),
    })
    const rpData = await rpRes.json()

    if (!rpRes.ok) {
      console.error('create-pending-application-order: Razorpay order failed', rpData)
      return new Response(JSON.stringify({ error: 'Failed to create payment order' }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('pending_applications').update({
      status: 'payment_pending',
      razorpay_order_id: rpData.id,
      fee_amount_paise: amountPaise,
      updated_at: new Date().toISOString(),
    }).eq('id', pending_app_id)

    return new Response(JSON.stringify({
      order_id: rpData.id,
      amount: amountPaise,
      currency: 'INR',
      key_id: RAZORPAY_KEY_ID,
      applicant_name: app.name,
    }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('create-pending-application-order error:', err)
    return new Response(JSON.stringify({ error: 'Internal error creating order' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

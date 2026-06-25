// supabase/functions/create-razorpay-order/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Called from the browser (FeeCollectionModal) when staff clicks "Collect Fee
// via Razorpay". Looks up the REAL fee amount server-side (never trusts the
// browser's number), creates a Razorpay Order, and returns the order_id +
// Razorpay key_id so the client can open Checkout.
//
// This function does NOT mark anything as paid. Only razorpay-webhook does
// that, after verifying Razorpay's signature on a confirmed payment event.
//
// Deploy:
//   supabase functions deploy create-razorpay-order
// Secrets needed (one-time):
//   supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxx
//   supabase secrets set RAZORPAY_KEY_SECRET=xxxxx
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { computeFeeAmountPaise, ADMISSION_FEE_TYPE } from '../_shared/feeCalc.ts'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { admission_gcc, fee_type } = await req.json()

    if (!admission_gcc) {
      return new Response(JSON.stringify({ error: 'admission_gcc is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Look up the admission row fresh from Postgres — this is the only
    //    place the amount is allowed to come from.
    const { data: admission, error: fetchErr } = await supabase
      .from('admissions')
      .select('gcc_no, applicant_name, hostel_type, scholarship_pct, concession_amt, status')
      .eq('gcc_no', parseInt(admission_gcc))
      .single()

    if (fetchErr || !admission) {
      return new Response(JSON.stringify({ error: 'Admission record not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 2. Guard: don't let staff create a fresh order for something already paid.
    //    (The webhook is still the only thing that ever marks it paid — this
    //    is just a UX guard to avoid duplicate orders, not a security boundary.)
    const { data: existingPayment } = await supabase
      .from('adm_fee_collections')
      .select('id')
      .eq('adm_app_id', admission.gcc_no)
      .eq('fee_type', fee_type || ADMISSION_FEE_TYPE)
      .eq('status', 'paid')
      .maybeSingle()

    if (existingPayment) {
      return new Response(JSON.stringify({ error: 'This fee has already been paid' }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 3. Compute the real amount server-side.
    const amountPaise = computeFeeAmountPaise(admission, fee_type || ADMISSION_FEE_TYPE)

    if (amountPaise <= 0) {
      return new Response(JSON.stringify({ error: 'Computed fee amount is zero or invalid' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 4. Create the Razorpay order via Basic Auth (key_id:key_secret).
    const authHeader = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // receipt must be <= 40 chars per Razorpay's API constraint
    const receipt = `gnsi-${admission.gcc_no}-${Date.now()}`.slice(0, 40)

    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          admission_gcc: String(admission.gcc_no),
          applicant_name: admission.applicant_name,
          fee_type: fee_type || ADMISSION_FEE_TYPE,
        },
      }),
    })

    const rpData = await rpRes.json()

    if (!rpRes.ok) {
      console.error('Razorpay order creation failed:', rpData)
      return new Response(JSON.stringify({ error: 'Failed to create payment order', detail: rpData?.error?.description }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 5. Record a PENDING row so the webhook has something to match against
    //    and so staff can see "payment initiated" state in the UI before
    //    confirmation arrives. This row is NOT marked paid — only the
    //    webhook flips status to 'paid'.
    await supabase.from('adm_fee_collections').insert([{
      adm_app_id: admission.gcc_no,
      fee_type: fee_type || ADMISSION_FEE_TYPE,
      amount: amountPaise / 100,
      razorpay_order_id: rpData.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    }])

    return new Response(JSON.stringify({
      order_id: rpData.id,
      amount: amountPaise,
      currency: 'INR',
      key_id: RAZORPAY_KEY_ID,            // public key — safe to expose to client
      applicant_name: admission.applicant_name,
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('create-razorpay-order error:', err)
    return new Response(JSON.stringify({ error: 'Internal error creating order' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

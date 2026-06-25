// supabase/functions/create-payment-link/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generates a Razorpay Payment Link (which Razorpay auto-renders as a
// scannable UPI QR code on its hosted payment page) for a given admission's
// fee. Use this for:
//   - WhatsApp sharing (plugs into the existing buildWAMsg / WABlastModal flow)
//   - Displaying a QR code at the front desk for walk-in / in-person payment
//
// Same trust model as create-razorpay-order: amount is computed server-side,
// nothing here marks a payment as complete — razorpay-webhook does that.
//
// Deploy:
//   supabase functions deploy create-payment-link
// Secrets: same RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET as create-razorpay-order.
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
    const { admission_gcc, fee_type, expire_in_minutes } = await req.json()

    if (!admission_gcc) {
      return new Response(JSON.stringify({ error: 'admission_gcc is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: admission, error: fetchErr } = await supabase
      .from('admissions')
      .select('gcc_no, applicant_name, phone, hostel_type, scholarship_pct, concession_amt')
      .eq('gcc_no', parseInt(admission_gcc))
      .single()

    if (fetchErr || !admission) {
      return new Response(JSON.stringify({ error: 'Admission record not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const amountPaise = computeFeeAmountPaise(admission, fee_type || ADMISSION_FEE_TYPE)
    if (amountPaise <= 0) {
      return new Response(JSON.stringify({ error: 'Computed fee amount is zero or invalid' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const referenceId = `gnsi-${admission.gcc_no}-${Date.now()}`.slice(0, 40)

    // expire_by is a unix timestamp; default to 24 hours from now.
    const expireMinutes = typeof expire_in_minutes === 'number' ? expire_in_minutes : 24 * 60
    const expireBy = Math.floor(Date.now() / 1000) + expireMinutes * 60

    const rpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        accept_partial: false,
        description: `GNSI ${fee_type || ADMISSION_FEE_TYPE} fee — ${admission.applicant_name} (GCC ${admission.gcc_no})`,
        customer: {
          name: admission.applicant_name,
          contact: admission.phone || undefined,
        },
        notify: { sms: !!admission.phone, email: false },
        reminder_enable: true,
        reference_id: referenceId,
        expire_by: expireBy,
        notes: {
          admission_gcc: String(admission.gcc_no),
          fee_type: fee_type || ADMISSION_FEE_TYPE,
        },
      }),
    })

    const rpData = await rpRes.json()

    if (!rpRes.ok) {
      console.error('Razorpay payment link creation failed:', rpData)
      return new Response(JSON.stringify({ error: 'Failed to create payment link', detail: rpData?.error?.description }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Record a pending row keyed by the payment link's reference, same as
    // the order flow — the webhook fills in the rest once paid.
    await supabase.from('adm_fee_collections').insert([{
      adm_app_id: admission.gcc_no,
      fee_type: fee_type || ADMISSION_FEE_TYPE,
      amount: amountPaise / 100,
      razorpay_payment_link_id: rpData.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    }])

    return new Response(JSON.stringify({
      payment_link_id: rpData.id,
      short_url: rpData.short_url,      // shareable link — drop straight into buildWAMsg()
      // Razorpay's hosted payment page (short_url) already renders a UPI QR
      // automatically for any UPI-capable device — no separate QR image API
      // call is required. If an inline <img> QR is wanted (e.g. for a
      // printed front-desk poster), generate it client-side from short_url
      // using any standard QR library (e.g. `qrcode` npm package) rather
      // than a second Razorpay call.
      amount: amountPaise,
      expires_at: new Date(expireBy * 1000).toISOString(),
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('create-payment-link error:', err)
    return new Response(JSON.stringify({ error: 'Internal error creating payment link' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

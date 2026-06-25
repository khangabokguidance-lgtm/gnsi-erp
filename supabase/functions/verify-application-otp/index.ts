// supabase/functions/verify-application-otp/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Verifies the OTP against what WE stored in pending_otps (set by
// send-application-otp), NOT via Supabase Auth's verifyOtp(). MSG91 was only
// asked to deliver the SMS text — the actual verification logic, expiry
// check, and attempt-limiting all happen here, in our own database.
//
// On success, creates the pending_applications row with a reference number —
// same outcome as before, just a different verification mechanism underneath.
//
// Deploy:
//   supabase functions deploy verify-application-otp --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_VERIFY_ATTEMPTS = 5

function generateReferenceNo(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(10000 + Math.random() * 90000)
  return `GNSI-${year}-${rand}`
}

function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { phone, otp, name } = await req.json()
    const normalizedPhone = normalizeIndianPhone(phone || '')

    if (!normalizedPhone || !otp) {
      return new Response(JSON.stringify({ error: 'Phone and OTP are required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: record, error: fetchErr } = await supabase
      .from('pending_otps')
      .select('otp, expires_at, attempts')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (fetchErr || !record) {
      return new Response(JSON.stringify({ error: 'No OTP request found for this number — please request a new code' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(record.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Code expired — please request a new one' }), {
        status: 410, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      return new Response(JSON.stringify({ error: 'Too many incorrect attempts — please request a new code' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (String(otp) !== String(record.otp)) {
      await supabase.from('pending_otps').update({ attempts: record.attempts + 1 }).eq('phone', normalizedPhone)
      return new Response(JSON.stringify({ error: 'Invalid code — please try again' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Correct OTP — consume it so it can't be reused, then create the
    // pending_applications row.
    await supabase.from('pending_otps').delete().eq('phone', normalizedPhone)

    let referenceNo = generateReferenceNo()
    let pendingApp = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('pending_applications')
        .insert([{
          reference_no: referenceNo,
          name: name.trim(),
          phone: normalizedPhone,
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          status: 'draft',
        }])
        .select()
        .single()

      if (!error) { pendingApp = data; break }
      if (error.code === '23505') { referenceNo = generateReferenceNo(); continue }
      throw error
    }

    if (!pendingApp) {
      return new Response(JSON.stringify({ error: 'Could not create application record — please try again' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      pending_app_id: pendingApp.id,
      reference_no: pendingApp.reference_no,
    }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('verify-application-otp error:', err)
    return new Response(JSON.stringify({ error: 'Internal error verifying OTP' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

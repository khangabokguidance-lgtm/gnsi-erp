// supabase/functions/send-application-otp/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sends an OTP via MSG91 directly — NOT via Supabase's built-in phone auth.
// We switched away from Supabase Auth's signInWithOtp() because Supabase's
// phone-provider dropdown only supports Twilio/MessageBird/Vonage/TextLocal
// natively, and Twilio requires India DLT registration (a multi-day
// regulatory process) before it can SMS real Indian numbers reliably.
// MSG91 is pre-registered with Indian carriers and skips that wait.
//
// We generate and store the OTP ourselves (in pending_otps), then ask MSG91
// to deliver it. verify-application-otp checks the typed code against what
// we stored — MSG91 is purely a delivery mechanism here, not a verifier.
//
// PREREQUISITE — this will NOT work until you have:
//   1. An MSG91 account (msg91.com) with DLT-registered Sender ID
//   2. An APPROVED OTP template in MSG91's dashboard (Auth > Templates).
//      The template's wording must match exactly what MSG91 has on file —
//      a mismatched message will report API success but never actually
//      deliver the SMS. This is the single most common MSG91 integration
//      failure, so don't skip checking the approved template's exact text.
//   3. Your MSG91 Auth Key and Template ID, set as secrets:
//        supabase secrets set MSG91_AUTH_KEY=xxxxx
//        supabase secrets set MSG91_TEMPLATE_ID=xxxxx
//
// Deploy:
//   supabase functions deploy send-application-otp --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY')!
const MSG91_TEMPLATE_ID = Deno.env.get('MSG91_TEMPLATE_ID')!

const OTP_EXPIRY_MINUTES = 10

// Basic rate limiting: max 3 OTP requests per phone number per 10 minutes.
// In-memory only (resets on cold start) — a second layer specifically
// against someone scripting requests across many numbers to run up SMS costs.
const _recentRequests = new Map<string, number[]>()
function tooManyRequests(phone: string): boolean {
  const now = Date.now()
  const windowMs = 10 * 60 * 1000
  const hits = (_recentRequests.get(phone) || []).filter(t => now - t < windowMs)
  if (hits.length >= 3) return true
  hits.push(now)
  _recentRequests.set(phone, hits)
  return false
}

function normalizeIndianPhone(raw: string): string | null {
  // MSG91 expects numbers WITHOUT a + prefix, e.g. 919999999999
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 digits, no leading zero issues
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
    const { phone } = await req.json()
    const normalizedPhone = normalizeIndianPhone(phone || '')

    if (!normalizedPhone) {
      return new Response(JSON.stringify({ error: 'Enter a valid 10-digit Indian mobile number' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (tooManyRequests(normalizedPhone)) {
      return new Response(JSON.stringify({ error: 'Too many OTP requests for this number — try again in 10 minutes' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    // Store the OTP ourselves — MSG91 is only asked to deliver the SMS text,
    // it never verifies anything for us in this flow.
    const { error: storeErr } = await supabase.from('pending_otps').upsert([{
      phone: normalizedPhone,
      otp,
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date().toISOString(),
    }], { onConflict: 'phone' })

    if (storeErr) {
      console.error('send-application-otp: could not store OTP', storeErr)
      return new Response(JSON.stringify({ error: 'Could not send OTP — please try again' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Call MSG91's OTP send endpoint.
    const msg91Url = `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${normalizedPhone}&otp=${otp}&otp_expiry=${OTP_EXPIRY_MINUTES}`
    const msg91Res = await fetch(msg91Url, {
      method: 'POST',
      headers: { 'authkey': MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    })
    const msg91Data = await msg91Res.json()

    if (!msg91Res.ok || msg91Data?.type === 'error') {
      console.error('send-application-otp: MSG91 send failed', msg91Data)
      return new Response(JSON.stringify({ error: 'Could not send OTP — please try again' }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, phone: normalizedPhone }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-application-otp error:', err)
    return new Response(JSON.stringify({ error: 'Internal error sending OTP' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

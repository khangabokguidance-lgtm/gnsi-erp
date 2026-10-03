// /api/razorpay/verify.js
// Vercel serverless function (Node runtime). Verifies the HMAC signature
// Razorpay Checkout hands back after a successful payment.
//
// SECURITY: Fees.jsx will NOT record a fee collection unless this endpoint
// returns { verified: true }. Do not skip this step and trust the client's
// `handler` callback alone — a browser can be tampered with and made to call
// finalizeCollection() without ever actually paying. This signature check is
// the only thing standing between "the browser says it paid" and "Razorpay
// actually confirms it was paid."
//
// Env vars required:
//   RAZORPAY_KEY_SECRET   — SECRET, server-only

import crypto from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing verification fields', verified: false })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const verified = expectedSignature === razorpay_signature
    if (!verified) {
      console.warn('razorpay verify: signature mismatch', { razorpay_order_id, razorpay_payment_id })
      return res.status(400).json({ error: 'Signature mismatch', verified: false })
    }

    // The signature only proves the order/payment pair is genuine. Ask Razorpay
    // what was ACTUALLY paid so the browser cannot record more than the money
    // taken (Fees.jsx compares this amount with the fee items before saving).
    let paidAmount = null
    try {
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
      const pr = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, { headers: { Authorization: `Basic ${auth}` } })
      if (pr.ok) {
        const pay = await pr.json()
        if (pay.order_id !== razorpay_order_id) return res.status(400).json({ error: 'Payment does not belong to this order', verified: false })
        if (!['captured', 'authorized'].includes(pay.status)) return res.status(400).json({ error: `Payment is ${pay.status}, not paid`, verified: false })
        paidAmount = Number(pay.amount) / 100
      }
    } catch (e) {
      console.warn('razorpay verify: could not fetch payment', e?.message)
    }

    return res.status(200).json({ verified: true, payment_id: razorpay_payment_id, paid_amount: paidAmount })
  } catch (err) {
    console.error('razorpay verify error:', err)
    return res.status(500).json({ error: 'Verification failed', verified: false })
  }
}
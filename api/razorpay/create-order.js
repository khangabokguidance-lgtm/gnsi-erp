// /api/razorpay/create-order.js
// Vercel serverless function (Node runtime). Creates a Razorpay Order.
//
// SECURITY: this is the ONLY place the amount is decided server-side. Even
// though Fees.jsx sends `amount` and `items`, treat them as untrusted input —
// recompute or at minimum sanity-check against your own rate tables before
// trusting the number, so a tampered request from a compromised browser
// can't create an order for less than what's actually owed.
//
// Env vars required (Vercel Project Settings → Environment Variables):
//   RAZORPAY_KEY_ID       — same value as the client's VITE_RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET   — SECRET, server-only, never send to the browser
//
// npm install razorpay  (in your API project)

import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { gcc, studentId, studentName, amount, items } = req.body || {}

    if (!gcc || !studentId) {
      return res.status(400).json({ error: 'gcc and studentId are required' })
    }
    const amountPaise = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    // ── Recommended hardening (uncomment once you have server-side access
    // to the same fee-rate tables the client uses, e.g. via Supabase
    // service-role key) ────────────────────────────────────────────────────
    // const expected = await recomputeExpectedAmount({ gcc, items })
    // if (Math.abs(expected - Number(amount)) > 1) {
    //   return res.status(400).json({ error: 'Amount mismatch — refusing to create order' })
    // }

    // Razorpay requires a receipt id under 40 chars.
    const receipt = `gnsi_${gcc}_${Date.now()}`.slice(0, 40)

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        gcc: String(gcc),
        student_id: String(studentId),
        student_name: studentName || '',
        items_count: String((items || []).length),
      },
    })

    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (err) {
    console.error('razorpay create-order error:', err)
    return res.status(500).json({ error: 'Order creation failed' })
  }
}
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
import { requireStaff, rateLimit, service } from '../_guard/guard.js'
import { checkOrderRequest } from '../_razorpay/orderCheck.js'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Only the fee counter (signed-in staff) creates orders; the browser never gets to do it anonymously.
  const user = await requireStaff(req, res)
  if (!user) return
  if (!rateLimit(req, res, { key: 'rzp-order', max: 30, id: user.id })) return

  try {
    const { gcc, studentId, studentName, amount, items } = req.body || {}

    if (!gcc || !studentId) {
      return res.status(400).json({ error: 'gcc and studentId are required' })
    }
    // The amount must equal the total of the itemised lines that get recorded, and every line must be
    // well formed (see api/_razorpay/orderCheck.js).
    const check = checkOrderRequest({ amount, items })
    if (!check.ok) return res.status(400).json({ error: check.error })
    const amountPaise = check.amountPaise

    // The student must exist, be active, and the id must belong to that GCC — so a request can't mix
    // one student's id with another's GCC, or create an order for someone who isn't enrolled.
    const { data: stu, error: stuErr } = await service()
      .from('students').select('id, gcc_no, name, status').eq('id', studentId).eq('gcc_no', gcc).maybeSingle()
    if (stuErr) {
      console.error('razorpay create-order student lookup failed:', stuErr)
      return res.status(503).json({ error: 'Could not verify the student. Try again.' })
    }
    if (!stu) return res.status(400).json({ error: 'Student not found for this GCC' })
    if (stu.status && stu.status !== 'Active') return res.status(400).json({ error: 'Student is not active' })

    // Razorpay requires a receipt id under 40 chars.
    const receipt = `gnsi_${gcc}_${Date.now()}`.slice(0, 40)

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        gcc: String(gcc),
        student_id: String(studentId),
        student_name: String(stu.name || '').slice(0, 80),
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
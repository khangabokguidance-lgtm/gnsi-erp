// /api/razorpay/create-payment-link.js
// Vercel serverless function (Node runtime). Creates a Razorpay Payment
// Link — a shareable URL a parent can open from anywhere (no login, no app)
// to pay a specific due. This is the remote/parent-initiated half of the
// integration; the webhook.js function records the payment once it's paid.
//
// Typical use from the dashboard's Month-wise Dues drill-down: instead of
// (or alongside) "Collect" opening the in-person Fee Payment tab, a "Send
// Payment Link" action calls this endpoint, then sends the returned
// `short_url` to the parent via the existing wa.me button.
//
// Env vars required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (server-only)

import Razorpay from 'razorpay'
import { getUser, isStaff, rateLimit } from '../_guard/guard.js'

const MAX_LINK_PAISE = 100_000 * 100 // ₹1,00,000 per link

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // This endpoint is public on purpose (the public fee-lookup page lets a parent pay without logging
  // in), so it is rate limited per caller and capped. Razorpay's own SMS to a phone number is only sent
  // for signed-in staff, otherwise anyone could use it to text arbitrary numbers.
  const user = await getUser(req)
  const staff = user ? await isStaff(user) : false
  if (!rateLimit(req, res, { key: 'rzp-link', max: staff ? 60 : 8, id: user?.id })) return

  try {
    const { gcc, studentName, amount, kind, for_month, year, course, subtype } = req.body || {}
    const parentPhone = staff ? req.body?.parentPhone : ''

    if (!gcc || !amount) {
      return res.status(400).json({ error: 'gcc and amount are required' })
    }
    if (!/^[A-Za-z0-9\-_/ ]{1,30}$/.test(String(gcc))) {
      return res.status(400).json({ error: 'Invalid gcc' })
    }
    const amountPaise = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0 || amountPaise > MAX_LINK_PAISE) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const link = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      description: `GNSI fee — ${studentName || 'Student'} (GCC-${gcc})${for_month ? ` — ${for_month} ${year || ''}` : ''}`,
      // Optional: prefills the payment page and lets Razorpay send its own
      // SMS/WhatsApp notification too (in addition to the one you send from
      // the app). Leave phone blank to skip Razorpay's own notification.
      customer: parentPhone ? { name: studentName || '', contact: parentPhone } : undefined,
      notify: { sms: !!parentPhone, email: false },
      reminder_enable: true,
      // These notes are what webhook.js reads to know which fee table/row
      // this payment belongs to once it's paid — keep them in sync with
      // the `items` kind shape used in Fees.jsx.
      notes: {
        gcc: String(gcc),
        kind: kind || 'course',
        for_month: for_month || '',
        year: year ? String(year) : '',
        course: course || '',
        subtype: subtype || '',
      },
      callback_url: `https://guidancekhangabok.in/payment-thank-you?gcc=${gcc}`,
      callback_method: 'get',
    })

    return res.status(200).json({
      id: link.id,
      short_url: link.short_url,
      amount: link.amount,
    })
  } catch (err) {
    console.error('razorpay create-payment-link error:', err)
    return res.status(500).json({ error: 'Payment link creation failed' })
  }
}
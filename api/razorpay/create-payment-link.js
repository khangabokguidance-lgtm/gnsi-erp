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
    const { gcc, studentName, amount, kind, for_month, year, course, subtype, parentPhone } = req.body || {}

    if (!gcc || !amount) {
      return res.status(400).json({ error: 'gcc and amount are required' })
    }
    const amountPaise = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
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
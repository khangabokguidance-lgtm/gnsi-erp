// POST /api/entrance/verify  { applicationNo, dob, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Marks the application fee Paid ONLY after the Razorpay signature checks out AND Razorpay itself reports the payment
// as captured for this order and for at least the exam fee.
import crypto from 'crypto'
import { send, only, body, findCandidate, updateTolerant } from './_lib.js'
import { feeFor } from '../../src/lib/entranceReg.js'

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { applicationNo, dob, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = body(req)
    if (!orderId || !paymentId || !sig) return send(res, 400, { error: 'Missing payment details', verified: false })
    const found = await findCandidate(applicationNo, dob)
    if (!found) return send(res, 404, { error: 'No application matches that number and date of birth.', verified: false })
    const { candidate: c, exam } = found
    if (c.fee_status === 'Paid') return send(res, 200, { verified: true, already: true })
    if (c.payment_order_id && c.payment_order_id !== orderId) return send(res, 400, { error: 'This payment is for a different order', verified: false })

    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
    if (expected !== sig) return send(res, 400, { error: 'Payment signature did not match', verified: false })

    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
    const pr = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Basic ${auth}` } })
    if (!pr.ok) return send(res, 502, { error: 'Could not confirm the payment with Razorpay yet — if money was deducted, contact the office with your application number.', verified: false })
    const pay = await pr.json()
    if (pay.order_id !== orderId) return send(res, 400, { error: 'Payment does not belong to this order', verified: false })
    if (!['captured', 'authorized'].includes(pay.status)) return send(res, 400, { error: `Payment is ${pay.status}, not paid`, verified: false })
    if (Number(pay.amount) / 100 + 0.001 < feeFor(exam)) return send(res, 400, { error: 'Amount paid is less than the application fee', verified: false })

    const { error } = await updateTolerant('entrance_candidates', {
      fee_status: 'Paid', fee_ref: paymentId, fee_paid_on: new Date().toLocaleDateString('en-CA'), payment_id: paymentId, payment_order_id: orderId,
    }, { id: c.id })
    if (error) return send(res, 500, { error: 'Payment received but could not be recorded — contact the office with your application number and payment id ' + paymentId, verified: true })
    return send(res, 200, { verified: true, paymentId })
  } catch (e) {
    console.error('entrance/verify', e)
    return send(res, 500, { error: 'Verification failed — if money was deducted, contact the office.', verified: false })
  }
}

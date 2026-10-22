// POST /api/entrance?action=adm-verify { reference, dob, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Marks the fee Paid only after the signature checks out AND Razorpay reports the payment captured for this order and amount.
import crypto from 'crypto'
import { db, send, only, body } from './_deps.js'
import { findApplication, logEvent } from './_common.js'

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { reference, dob, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = body(req)
    if (!orderId || !paymentId || !sig) return send(res, 400, { error: 'Missing payment details', verified: false })
    const a = await findApplication(reference, dob)
    if (!a) return send(res, 404, { error: 'No application matches that reference and date of birth.', verified: false })
    if (a.fee_status === 'Paid') return send(res, 200, { verified: true, already: true })
    if (a.payment_order_id && a.payment_order_id !== orderId) return send(res, 400, { error: 'This payment is for a different order', verified: false })

    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
    if (expected !== sig) return send(res, 400, { error: 'Payment signature did not match', verified: false })
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
    const pr = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Basic ${auth}` } })
    if (!pr.ok) return send(res, 502, { error: 'Could not confirm the payment with Razorpay yet — if money was deducted, contact the office with your reference number.', verified: false })
    const pay = await pr.json()
    if (pay.order_id !== orderId) return send(res, 400, { error: 'Payment does not belong to this order', verified: false })
    if (!['captured', 'authorized'].includes(pay.status)) return send(res, 400, { error: `Payment is ${pay.status}, not paid`, verified: false })
    if (Number(pay.amount) / 100 + 0.001 < Number(a.fee_amount)) return send(res, 400, { error: 'Amount paid is less than the admission fee', verified: false })

    const { error } = await db().from('portal_applications').update({
      fee_status: 'Paid', payment_id: paymentId, payment_order_id: orderId, payment_mode: 'Online', fee_paid_on: new Date().toLocaleDateString('en-CA'), updated_at: new Date().toISOString(),
    }).eq('id', a.id)
    if (error) return send(res, 500, { error: 'Payment received but could not be recorded — contact the office with your reference number and payment id ' + paymentId, verified: true })
    await logEvent(a.id, 'system', 'payment_received', `₹${Number(a.fee_amount).toLocaleString('en-IN')} · Razorpay ${paymentId}`)
    return send(res, 200, { verified: true, paymentId })
  } catch (e) {
    console.error('adm-verify', e)
    return send(res, 500, { error: 'Verification failed — if money was deducted, contact the office.', verified: false })
  }
}

// POST /api/entrance/create-order  { applicationNo, dob }  → Razorpay order for the application fee.
// The amount is read from the exam here; nothing the browser sends can change it.
import Razorpay from 'razorpay'
import { send, only, body, findCandidate, updateTolerant } from './_lib.js'
import { feeFor } from './entranceReg.js'

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { applicationNo, dob } = body(req)
    const found = await findCandidate(applicationNo, dob)
    if (!found) return send(res, 404, { error: 'No application matches that number and date of birth.' })
    const { candidate: c, exam } = found
    const fee = feeFor(exam)
    if (c.fee_status === 'Paid' || c.fee_status === 'Waived' || fee === 0) return send(res, 409, { error: 'No payment is due for this application.' })
    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    const order = await rzp.orders.create({
      amount: Math.round(fee * 100), currency: 'INR', receipt: String(c.application_no).slice(0, 40),
      notes: { application_no: c.application_no, exam_id: String(exam.id), candidate: String(c.student_name || '').slice(0, 60) },
    })
    await updateTolerant('entrance_candidates', { payment_order_id: order.id }, { id: c.id })
    return send(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, name: c.student_name, phone: c.phone, email: c.email, examName: exam.exam_name })
  } catch (e) {
    console.error('entrance/create-order', e)
    return send(res, 500, { error: 'Could not start the payment — please try again.' })
  }
}

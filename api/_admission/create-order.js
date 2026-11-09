// POST /api/entrance?action=adm-order { reference, dob } → Razorpay order for the admission fee (amount from the stored fee_amount).
import Razorpay from 'razorpay'
import { db, send, only, body } from './_deps.js'
import { findApplication, isOpen, logEvent } from './_common.js'

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  try {
    const { reference, dob } = body(req)
    const a = await findApplication(reference, dob)
    if (!a) return send(res, 404, { error: 'No application matches that reference and date of birth.' })
    if (!isOpen(a)) return send(res, 409, { error: 'This application is closed.' })
    if (a.fee_status !== 'Unpaid' || !(Number(a.fee_amount) > 0)) return send(res, 409, { error: 'No payment is due for this application.' })
    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    const order = await rzp.orders.create({
      amount: Math.round(Number(a.fee_amount) * 100), currency: 'INR', receipt: a.reference_no,
      notes: { reference_no: a.reference_no, kind: 'admission_portal', applicant: String(a.student_name || '').slice(0, 60) },
    })
    await db().from('portal_applications').update({ payment_order_id: order.id }).eq('id', a.id)
    await logEvent(a.id, 'applicant', 'payment_started', `Order ${order.id}`)
    return send(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, name: a.student_name, phone: a.phone, email: a.email, description: `Admission fee · ${a.reference_no}` })
  } catch (e) {
    console.error('adm-order', e)
    return send(res, 500, { error: 'Could not start the payment — please try again.' })
  }
}

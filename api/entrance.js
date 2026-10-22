// api/entrance.js — ONE serverless function for the whole entrance-exam registration API, routed by ?action=
//   GET  ?action=exam&id=<exam id> | &open=1     public exam details / exams taking applications
//   POST ?action=register                        submit an application
//   POST ?action=create-order                    Razorpay order for the application fee
//   POST ?action=verify                          confirm the payment, mark the fee paid
//   POST ?action=lookup                          status / admit-card data (application no. + date of birth)
// The handlers live in api/_entrance/ (a leading underscore keeps them from becoming functions of their own, so the
// deployment holds one function here instead of five).
import exam from './_entrance/exam.js'
import register from './_entrance/register.js'
import createOrder from './_entrance/create-order.js'
import verify from './_entrance/verify.js'
import lookup from './_entrance/lookup.js'

// register carries two images as base64, so the body limit is raised for the whole function.
export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

const routes = { exam, register, 'create-order': createOrder, verify, lookup }

export default async function handler(req, res) {
  const fn = routes[String(req.query?.action || '')]
  if (!fn) return res.status(404).json({ error: 'Unknown action' })
  return fn(req, res)
}

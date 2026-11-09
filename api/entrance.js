// api/entrance.js — ONE serverless function for the whole entrance-exam registration API, routed by ?action=
//   GET  ?action=exam&id=<exam id> | &open=1     public exam details / exams taking applications
//   POST ?action=register                        submit an application
//   POST ?action=create-order                    Razorpay order for the application fee
//   POST ?action=verify                          confirm the payment, mark the fee paid
//   POST ?action=lookup                          status / admit-card data (application no. + date of birth)
//   adm-options (GET) · adm-submit · adm-upload · adm-order · adm-verify · adm-lookup   the online admission portal (api/_admission/)
// The handlers live in api/_entrance/ (a leading underscore keeps them from becoming functions of their own, so the
// deployment holds one function here instead of five). Nothing in api/ imports from src/: the two shared rule files are
// copied into api/_entrance/ (tests/fees.test.js fails if the copies drift from src/lib/).
import exam from './_entrance/exam.js'
import register from './_entrance/register.js'
import createOrder from './_entrance/create-order.js'
import verify from './_entrance/verify.js'
import lookup from './_entrance/lookup.js'
import admOptions from './_admission/options.js'
import admSubmit from './_admission/submit.js'
import admUpload from './_admission/upload.js'
import admOrder from './_admission/create-order.js'
import admVerify from './_admission/verify.js'
import admLookup from './_admission/lookup.js'

const routes = {
  exam, register, 'create-order': createOrder, verify, lookup,
  'adm-options': admOptions, 'adm-submit': admSubmit, 'adm-upload': admUpload, 'adm-order': admOrder, 'adm-verify': admVerify, 'adm-lookup': admLookup,
}

export default async function handler(req, res) {
  const fn = routes[String(req.query?.action || '')]
  if (!fn) return res.status(404).json({ error: 'Unknown action' })
  return fn(req, res)
}

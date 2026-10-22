// entrancePay.js — browser side of the entrance application-fee payment (Razorpay Checkout).
// The amount and the order are created by /api/entrance/create-order; the fee is marked paid by /api/entrance/verify,
// never by this file. A candidate is identified by application number + date of birth.
let _script
function loadCheckout() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (_script) return _script
  _script = new Promise(resolve => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true
    s.onload = () => resolve(true); s.onerror = () => { _script = null; resolve(false) }
    document.body.appendChild(s)
  })
  return _script
}

export async function api(path, body, method = 'POST') {
  const res = await fetch(`/api/entrance/${path}`, method === 'GET' ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.data = data; throw e }
  return data
}

// → { paid: true, paymentId } | { paid: false, cancelled: true } ; throws with a readable message on a real failure.
export async function payApplicationFee({ applicationNo, dob }) {
  if (!(await loadCheckout())) throw new Error('Could not load the payment window. Check your internet connection and try again.')
  const order = await api('create-order', { applicationNo, dob })
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
      name: 'GNSI Entrance Examination', description: `${order.examName || 'Application fee'} · ${applicationNo}`,
      prefill: { name: order.name || '', contact: order.phone || '', email: order.email || '' },
      theme: { color: '#17375E' },
      modal: { ondismiss: () => resolve({ paid: false, cancelled: true }) },
      handler: async resp => {
        try {
          const v = await api('verify', { applicationNo, dob, ...resp })
          resolve({ paid: !!v.verified, paymentId: resp.razorpay_payment_id })
        } catch (e) { reject(e) }
      },
    })
    rzp.on?.('payment.failed', r => reject(new Error(r?.error?.description || 'The payment failed. You have not been charged — please try again.')))
    rzp.open()
  })
}

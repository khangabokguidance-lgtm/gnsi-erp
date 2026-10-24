// portalPay.js — which due the Parents Portal's "Pay now" button should pay.
// Pure, so it can be tested. `dues` is the result of getStudentDues (feeDues.js).
//
// The payment link is for ONE concrete due, and the webhook records it against that month, so the amount
// must be what is still OWED (item.due — after part payments, concessions and scholarships), not the full
// month fee. Order: admission first, then the oldest unpaid month, whether it is a flat or a course month.

const monthStart = i => new Date(`${i.month} 1, ${i.year}`).getTime() || 0

export function pickNextDue(dues) {
  if (!dues) return null
  if (dues.admission && !dues.admission.paid && dues.admission.due > 0) return { kind: 'admission', amount: dues.admission.due }
  const open = [
    ...(dues.flatFee?.items || []).map(i => ({ ...i, kind: 'flat' })),
    ...(dues.courseFee?.items || []).map(i => ({ ...i, kind: 'course' })),
  ].filter(i => !i.paid && i.due > 0).sort((a, b) => monthStart(a) - monthStart(b))
  const i = open[0]
  return i ? { kind: i.kind, amount: i.due, for_month: i.month, year: i.year } : null
}

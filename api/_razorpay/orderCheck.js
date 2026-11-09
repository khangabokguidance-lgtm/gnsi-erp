// api/_razorpay/orderCheck.js — server-side checks on a fee order request. Pure (no database, no
// network) so it can be unit tested; the endpoints add the student lookup around it.
//
// What this does NOT do: re-derive each item's rate from the fee tables. That engine (src/feeEngine.js)
// runs in the browser against the browser's Supabase client. What it does guarantee is that the amount
// the order is created for is exactly the total of the itemised lines that will be recorded, that every
// line is well formed, and that nothing absurd gets through.

export const MAX_ORDER_PAISE = 100_000 * 100 // Rs 1,00,000 per order
const KINDS = new Set(['admission', 'item', 'flat', 'course', 'advance'])
const MAX_ITEMS = 40

const toPaise = v => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

// Returns { ok: true, amountPaise } or { ok: false, error }.
export function checkOrderRequest({ amount, items }) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'items are required' }
  if (items.length > MAX_ITEMS) return { ok: false, error: 'too many items' }

  let totalPaise = 0
  for (const it of items) {
    if (!it || !KINDS.has(it.kind)) return { ok: false, error: 'unknown item kind' }
    const p = toPaise(it.amount)
    if (!Number.isFinite(p) || p <= 0 || p > MAX_ORDER_PAISE) return { ok: false, error: 'invalid item amount' }
    totalPaise += p
  }

  const amountPaise = toPaise(amount)
  if (!Number.isFinite(amountPaise) || amountPaise <= 0 || amountPaise > MAX_ORDER_PAISE) {
    return { ok: false, error: 'Invalid amount' }
  }
  if (amountPaise !== totalPaise) return { ok: false, error: 'Amount does not match the fee items' }
  return { ok: true, amountPaise }
}

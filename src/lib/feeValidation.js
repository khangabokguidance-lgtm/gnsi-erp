// feeValidation.js — pure money / date sanity checks shared by the fee engine.
// Nothing the browser form lets through (negative, zero, NaN, absurd, future-
// dated) should reach the books.
const localToday = () => new Date().toLocaleDateString('en-CA')

export const MAX_FEE_AMOUNT = 500000

export const assertSaneAmount = (v, label = 'Amount') => {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be a number greater than 0.`)
  if (n > MAX_FEE_AMOUNT) throw new Error(`${label} ₹${n.toLocaleString('en-IN')} is above the ₹${MAX_FEE_AMOUNT.toLocaleString('en-IN')} limit — check for a typing mistake.`)
  return n
}

// A real YYYY-MM-DD date that is not in the future and not absurdly old.
export const assertSanePayDate = (d, label = 'Payment date', today = localToday()) => {
  const t = String(d || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(new Date(t + 'T00:00:00').getTime())) throw new Error(`${label} is not a valid date.`)
  if (t > today) throw new Error(`${label} ${t} is in the future.`)
  if (t < '2015-01-01') throw new Error(`${label} ${t} is too far in the past.`)
  return t
}

// _shared/feeCalc.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE single source of truth for "how much does this admission owe?"
// Mirrors the rates already hard-coded in Admissions.jsx's header banner
// (Boarder ₹5,500/mo · Day Boarder ₹4,000/mo · Day Scholar ₹2,000/mo) and the
// client-side getFlatFeeAmtSync() helper — but this copy runs on the server,
// which is the only copy that is allowed to decide a real charge amount.
//
// The browser may SUGGEST an amount (e.g. to render "Pay ₹5,500" before the
// order even exists), but every Edge Function in this folder re-derives the
// real amount from the database row, never from anything the client sends.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_FEES: Record<string, number> = {
  'Boarder':     5500,
  'Day Boarder': 4000,
  'Day Scholar': 2000,
}

export const ADMISSION_FEE_TYPE = 'admission'

/**
 * Computes the amount owed (in paise, since Razorpay's API is paise-denominated)
 * for a given admission row pulled fresh from Postgres.
 *
 * @param admission - a row from the `admissions` table (service-role read)
 * @param feeType - 'admission' | 'monthly' | etc. — for now we only model
 *                  the one-time admission fee; monthly tuition can extend
 *                  this function later without touching the webhook logic.
 */
export function computeFeeAmountPaise(admission: {
  hostel_type: string
  scholarship_pct?: number | null
  concession_amt?: number | null
}, feeType: string = ADMISSION_FEE_TYPE): number {
  const base = BASE_FEES[admission.hostel_type] ?? BASE_FEES['Day Scholar']

  let amountRupees = base

  if (admission.scholarship_pct && admission.scholarship_pct > 0) {
    amountRupees = Math.round(base * (1 - admission.scholarship_pct / 100))
  }
  if (admission.concession_amt && admission.concession_amt > 0) {
    amountRupees = Math.max(0, amountRupees - admission.concession_amt)
  }

  // Razorpay amounts are always integers in the smallest currency unit (paise for INR)
  return Math.round(amountRupees * 100)
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100)
}

// PublicFeeLookup.jsx
//
// Public-facing "Pay Fee" flow for the landing page. This is intentionally
// READ-ONLY against the students/fee tables — it never calls collectFee(),
// upsertAccount(), or any other write function from feeEngine.js. A public
// visitor has no auth and no currentUser, so letting the browser write a
// "fee paid" record directly would let anyone mark any student as paid.
//
// IMPORTANT — table choice: GNSI's real fee ledger lives in three tables —
// adm_fee_collections (admission/dress/prospectus), adm_flat_fees (monthly
// flat fee), adm_course_fees (monthly course fee) — keyed by adm_app_id
// (the GCC number, stored as text). This mirrors exactly what
// StudentFeeCard in Fees.jsx does (myAdm/myFlat/myCrsf), NOT the generic
// fee_invoices/fee_payments tables — those appear unused by this school's
// actual data, which is why an earlier version of this file (built against
// getStudentFeeSummary) always showed ₹0.
//
// This file shows "Total Paid" reliably (a straight sum of real payment
// rows). It intentionally does NOT show a computed "Amount Due" — the true
// due amount depends on getStudentDues()'s full month-by-month rate engine
// (rates, overrides, admission-date exclusions) in feeDues.js, which this
// component doesn't have access to. Rather than guess and risk showing a
// wrong due amount, the parent enters the amount they intend to pay.
//
// Flow:
//   1. Parent enters GCC number (+ optional phone as a light check).
//   2. We look up the student and sum their real payment rows across the
//      three tables above — read-only, same shape Fees.jsx already uses.
//   3. If Razorpay is configured (VITE_RAZORPAY_KEY_ID +
//      /api/razorpay/create-order + /api/razorpay/verify all respond),
//      the parent pays by card/UPI/netbanking through Razorpay Checkout.
//      The actual adm_fee_collections row is written by YOUR BACKEND
//      webhook after verifying the signature server-side — never by this
//      component.
//   4. If Razorpay isn't configured yet, this falls back to the existing
//      UPI ID / QR / bank-transfer block (same as before), so the button
//      is never broken while the backend is being finished.
//
// Props:
//   isOpen, onClose  — modal visibility, same pattern as ParentsPortal
//   upi, bank        — optional { upi_id, upi_qr_url } / bank details object,
//                       passed through from the same getStats() data the
//                       landing page already fetches for the fee section

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import { gccStr, fmt, CURRENT_YEAR } from './feeEngine'

const RAZORPAY_KEY_ID = import.meta.env?.VITE_RAZORPAY_KEY_ID || ''
const RAZORPAY_CREATE_ORDER_URL = import.meta.env?.VITE_RAZORPAY_CREATE_ORDER_URL || '/api/razorpay/create-order'
const RAZORPAY_VERIFY_URL = import.meta.env?.VITE_RAZORPAY_VERIFY_URL || '/api/razorpay/verify'

let _razorpayScriptPromise = null
function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (_razorpayScriptPromise) return _razorpayScriptPromise
  _razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay-checkout]')
    if (existing) { existing.addEventListener('load', () => resolve(true)); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
  return _razorpayScriptPromise
}

const SESSION_YEAR = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

const C = {
  navy: '#0A2647', navy2: '#0F3059', gold: '#B8912E', goldL: '#D9B65C',
  green: '#0F7B4D', red: '#A32B22', slate: '#2A303C', mist: '#5B6472',
  cream: '#FAF8F4', white: '#FFFFFF', border: '#D7E1EC',
}

export default function PublicFeeLookup({ isOpen, onClose, upi, bank }) {
  const [step, setStep] = useState('lookup') // lookup | summary | error
  const [gcc, setGcc] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [student, setStudent] = useState(null)
  const [summary, setSummary] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [razorpayReady, setRazorpayReady] = useState(null) // null = try Razorpay if configured; false = known broken, use UPI/bank

  const reset = useCallback(() => {
    setStep('lookup'); setGcc(''); setPhone(''); setLoading(false); setErrorMsg('')
    setStudent(null); setSummary(null); setPayAmount(''); setPaying(false); setPayError('')
  }, [])

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => { if (!isOpen) reset() }, [isOpen, reset])

  if (!isOpen) return null

  const lookupStudent = async (e) => {
    e?.preventDefault()
    const cleanGcc = gccStr(gcc.trim())
    if (!cleanGcc) { setErrorMsg('Please enter your GCC / Student ID number.'); return }
    setLoading(true); setErrorMsg('')
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('gcc_no', cleanGcc)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Public fee lookup — students query failed:', error)
        throw error
      }
      if (!data) { setErrorMsg('No student found with that GCC / Student ID. Please check the number or contact the institute.'); setLoading(false); return }

      // Light verification: if a phone was entered, it must match one of the
      // stored guardian/parent phone fields (last 10 digits, so +91 prefixes
      // don't cause a false mismatch). This is a courtesy check, not a
      // security boundary — no fee is written from this page either way.
      if (phone.trim()) {
        const enteredDigits = phone.replace(/\D/g, '').slice(-10)
        const candidates = [data.guardian_phone, data.father_phone, data.mother_phone, data.parent_phone, data.guardian_mobile, data.mobile, data.phone]
          .filter(Boolean).map((p) => String(p).replace(/\D/g, '').slice(-10))
        if (enteredDigits && candidates.length && !candidates.includes(enteredDigits)) {
          setErrorMsg('That phone number does not match our records for this student. You can still continue if you are sure the GCC number is correct.')
        }
      }

      let feeSummary
      try {
        const gcc = gccStr(data.gcc_no)
        const [admRes, flatRes, crsfRes] = await Promise.all([
          supabase.from('adm_fee_collections').select('amount_paid, reverted').eq('adm_app_id', gcc),
          supabase.from('adm_flat_fees').select('amount, paid').eq('adm_app_id', gcc),
          supabase.from('adm_course_fees').select('amount_paid, reverted').eq('adm_app_id', gcc),
        ])
        if (admRes.error) throw admRes.error
        if (flatRes.error) throw flatRes.error
        if (crsfRes.error) throw crsfRes.error

        const admTotal = (admRes.data || []).filter((r) => !r.reverted).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
        const flatTotal = (flatRes.data || []).filter((r) => r.paid).reduce((s, r) => s + (Number(r.amount) || 0), 0)
        const crsfTotal = (crsfRes.data || []).filter((r) => !r.reverted).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
        const totalPaid = admTotal + flatTotal + crsfTotal

        feeSummary = { total_paid: totalPaid, admTotal, flatTotal, crsfTotal }
      } catch (feeErr) {
        console.error('Public fee lookup — fee totals query failed:', feeErr)
        // Student was found fine — only the payment-totals read failed
        // (often an RLS policy blocking anonymous reads on these tables).
        // Show the student anyway rather than a dead end, and surface the
        // real reason so it's fixable on the backend.
        feeSummary = { total_paid: null }
        setErrorMsg(`We found your record, but couldn't load payment history right now${feeErr?.message ? ` (${feeErr.message})` : ''}. You can still make a payment below — please mention the amount to the institute for confirmation.`)
      }
      setStudent(data)
      setSummary(feeSummary)
      setPayAmount('')
      setStep('summary')
    } catch (err) {
      console.error('Public fee lookup failed:', err)
      const hint = err?.message ? ` (${err.message})` : ''
      setErrorMsg(`Something went wrong looking up your record${hint}. Please try again or contact the institute.`)
    } finally {
      setLoading(false)
    }
  }

  const payWithRazorpay = async () => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) { setPayError('Enter a valid amount to pay.'); return }
    setPaying(true); setPayError('')
    try {
      const scriptOk = await loadRazorpayScript()
      if (!scriptOk) throw new Error('Could not load payment gateway. Please try again.')

      const orderRes = await fetch(RAZORPAY_CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount, // rupees — backend converts to paise
          student_id: student.id,
          gcc_no: student.gcc_no,
          session_year: SESSION_YEAR,
        }),
      })
      if (!orderRes.ok) {
        // Backend isn't there yet (or errored) — fall back to UPI/bank for
        // the rest of this session instead of dead-ending on a retry loop.
        console.error('Razorpay create-order failed:', orderRes.status)
        setRazorpayReady(false)
        setPaying(false)
        setPayError('Online card/UPI checkout isn\'t available right now — use the UPI/bank details below instead.')
        return
      }
      const order = await orderRes.json()

      const rzp = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'GNSI — Guidance Navodaya & Sainik Institute',
        description: `Fee payment — GCC-${student.gcc_no}`,
        prefill: { name: student.name },
        theme: { color: C.navy },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(RAZORPAY_VERIFY_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                student_id: student.id,
                gcc_no: student.gcc_no,
                amount,
                session_year: SESSION_YEAR,
              }),
            })
            if (!verifyRes.ok) throw new Error('verify-failed')
            setStep('done')
          } catch (err) {
            console.error('Payment verification failed:', err)
            setPayError('Payment was made but confirmation failed to reach us. Please WhatsApp your payment screenshot to +91 89742 98074 so we can confirm it manually.')
          } finally {
            setPaying(false)
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      })
      rzp.on('payment.failed', (resp) => {
        setPaying(false)
        setPayError(resp?.error?.description || 'Payment failed. Please try again.')
      })
      rzp.open()
    } catch (err) {
      console.error('Razorpay flow failed:', err)
      setPaying(false)
      // Network-level failure (endpoint missing, CORS, DNS, etc.) — same
      // graceful fallback as an explicit non-OK response above.
      setRazorpayReady(false)
      setPayError('Online card/UPI checkout isn\'t available right now — use the UPI/bank details below instead.')
    }
  }

  const modal = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(10,38,71,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: C.white, borderRadius: 8, width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: C.navy, color: '#fff', padding: '1.3rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif, serif)', fontSize: '1.15rem', fontWeight: 600 }}>Pay Fee Online</div>
            <div style={{ fontSize: '.78rem', color: C.goldL, marginTop: 2 }}>GNSI Khangabok · {SESSION_YEAR}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: '1px solid rgba(184,145,46,.35)', color: C.goldL, width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1.6rem' }}>
          {step === 'lookup' && (
            <form onSubmit={lookupStudent}>
              <p style={{ color: C.mist, fontSize: '.92rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
                Enter your child's GCC / Student ID number to view fee dues and pay online.
              </p>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.02em', color: C.slate, marginBottom: '.4rem' }}>
                GCC / Student ID *
              </label>
              <input
                autoFocus
                value={gcc}
                onChange={(e) => setGcc(e.target.value)}
                placeholder="e.g. 214"
                style={{ width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: '1rem', marginBottom: '1rem', outline: 'none' }}
              />
              <label style={{ display: 'block', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.02em', color: C.slate, marginBottom: '.4rem' }}>
                Guardian Phone (optional, for verification)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                style={{ width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: '1rem', marginBottom: '1.2rem', outline: 'none' }}
              />
              {errorMsg && (
                <div style={{ background: '#F6E4E1', color: C.red, padding: '.65rem 1rem', borderRadius: 4, fontSize: '.9rem', marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '.9rem', background: C.navy, color: C.goldL, border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1 }}
              >
                {loading ? 'Looking up…' : 'Find My Fee Details →'}
              </button>
              <p style={{ color: C.mist, fontSize: '.78rem', textAlign: 'center', marginTop: '.9rem' }}>
                Don't know your GCC number? Call{' '}
                <a href="tel:+918974298074" style={{ color: C.navy, fontWeight: 600 }}>+91 89742 98074</a>
              </p>
            </form>
          )}

          {step === 'summary' && student && summary && (
            <div>
              <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1rem 1.1rem', marginBottom: '1.2rem' }}>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: '1.05rem' }}>{student.name}</div>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.35rem', fontSize: '.82rem', color: C.mist }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy }}>GCC-{student.gcc_no}</span>
                  {(student.class_name || student.batch) && <span>{student.class_name || student.batch}</span>}
                  {student.course && <span>{student.course}</span>}
                  {student.hostel_type && <span>{student.hostel_type}</span>}
                </div>
              </div>

              {errorMsg && (
                <div style={{ background: '#FFF8E6', color: '#8C6A1E', padding: '.6rem .9rem', borderRadius: 4, fontSize: '.85rem', marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ background: summary.total_paid == null ? C.cream : '#E4F5EC', borderRadius: 4, padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                {summary.total_paid == null ? (
                  <div style={{ color: C.mist, fontSize: '.9rem' }}>Payment history unavailable right now</div>
                ) : (
                  <>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: C.green }}>{fmt(summary.total_paid)}</div>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: C.green, textTransform: 'uppercase' }}>Total Paid To Date</div>
                  </>
                )}
              </div>

              <>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.02em', color: C.slate, marginBottom: '.4rem' }}>
                    Amount to Pay (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount"
                    style={{ width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: '1rem', marginBottom: '1rem', outline: 'none' }}
                  />

                  {payError && (
                    <div style={{ background: '#F6E4E1', color: C.red, padding: '.65rem 1rem', borderRadius: 4, fontSize: '.9rem', marginBottom: '1rem' }}>
                      {payError}
                    </div>
                  )}

                  {razorpayReady !== false && RAZORPAY_KEY_ID ? (
                    <button
                      onClick={payWithRazorpay}
                      disabled={paying}
                      style={{ width: '100%', padding: '.9rem', background: C.gold, color: C.navy, border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '1rem', cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? .6 : 1, marginBottom: '.7rem' }}
                    >
                      {paying ? 'Opening secure checkout…' : `Pay ${fmt(Number(payAmount) || 0)} via Razorpay →`}
                    </button>
                  ) : (
                    <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1rem', marginBottom: '.9rem' }}>
                      <div style={{ fontWeight: 700, color: C.navy, fontSize: '.92rem', marginBottom: '.6rem' }}>Pay via UPI or Bank Transfer</div>
                      {upi?.upi_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
                          {upi.upi_qr_url && <img src={upi.upi_qr_url} alt="UPI QR" style={{ width: 72, height: 72, background: '#fff', borderRadius: 4, padding: 4, flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none' }} />}
                          <div>
                            <div style={{ fontSize: '.68rem', textTransform: 'uppercase', color: C.mist, fontWeight: 700 }}>UPI ID</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy }}>{upi.upi_id}</div>
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: C.mist, fontSize: '.85rem', marginBottom: '.5rem' }}>Contact the institute for UPI / bank details.</p>
                      )}
                      <p style={{ color: C.mist, fontSize: '.78rem', lineHeight: 1.6 }}>
                        Mention <strong>GCC-{student.gcc_no}</strong> as the payment reference, then WhatsApp your screenshot to{' '}
                        <a href={`https://wa.me/918974298074?text=${encodeURIComponent(`Hello GNSI, I have paid the fee for GCC-${student.gcc_no} (${student.name}). Sending screenshot.`)}`} target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>
                          +91 89742 98074
                        </a>{' '}for confirmation.
                      </p>
                    </div>
                  )}
                </>

              <button
                onClick={() => setStep('lookup')}
                style={{ width: '100%', padding: '.6rem', background: 'transparent', border: 'none', color: C.mist, fontSize: '.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Look up a different student
              </button>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '.8rem' }}>✅</div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: '1.1rem', marginBottom: '.4rem' }}>Payment Received</div>
              <p style={{ color: C.mist, fontSize: '.92rem', lineHeight: 1.6, marginBottom: '1.3rem' }}>
                Thank you. Your payment has been recorded against GCC-{student?.gcc_no}. A receipt will be available in the Parents Portal shortly.
              </p>
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '.8rem', background: C.navy, color: C.goldL, border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
// PublicFeeLookup.jsx
//
// Public-facing "Pay Fee" flow for the landing page. This is intentionally
// READ-ONLY against the students/fee tables — it never calls collectFee(),
// upsertAccount(), or any other write function from feeEngine.js. A public
// visitor has no auth and no currentUser, so letting the browser write a
// "fee paid" record directly would let anyone mark any student as paid.
//
// SECURITY NOTES (public, unauthenticated surface):
//   - GCC lookup is client-side rate-limited (see LOOKUP_COOLDOWN_MS /
//     MAX_LOOKUP_ATTEMPTS below) to slow down scripted enumeration of every
//     GCC number to harvest names/classes/hostel type. This is a speed
//     bump, not a real barrier — a determined attacker can bypass anything
//     enforced only in the browser. The actual barrier has to be server
//     side: either (a) Supabase rate limiting / a WAF rule on this project,
//     or (b) moving this lookup behind a Postgres RPC that itself enforces
//     a per-IP or per-GCC attempt cap. Ask your host (Supabase support) or
//     add a Vercel Edge Middleware rate limiter in front of anything that
//     queries `students` if this matters for your risk tolerance.
//   - The payment-link creation call is similarly client-throttled for the
//     same reason (stop casual spam-generation of Razorpay links against a
//     real student's GCC). Real protection is server-side rate limiting on
//     create-payment-link.js itself (e.g. Vercel's built-in rate limiting,
//     or a simple per-IP counter using Vercel KV/Upstash).
//   - Error messages shown to the visitor never include raw Supabase/Postgres
//     error text (column names, constraint names, etc.) — those are logged
//     to the console for you to debug, but never surfaced in the UI, since
//     a public page leaking schema details is free reconnaissance for an
//     attacker.
//   - Phone-number entry is a courtesy check only (warns on mismatch, never
//     blocks) — it is NOT an authentication factor. Do not rely on it to
//     gate anything sensitive; treat GCC number alone as effectively public
//     (anyone who knows or guesses it can view that student's fee status).
//
// IMPORTANT — table choice: GNSI's real fee ledger lives in three tables —
// adm_fee_collections (admission/dress/prospectus), adm_flat_fees (monthly
// flat fee), adm_course_fees (monthly course fee) — keyed by adm_app_id
// (the GCC number, stored as text). getStudentDues() (feeDues.js) computes
// both totalPaid AND a real totalDue against these tables using the same
// rate/override/admission-date logic Fees.jsx and FeeSetup.jsx use — so the
// numbers shown here are never a guess.
//
// PAYMENT FLOW — Payment Links, not Checkout+Orders:
// The backend (create-order.js / verify.js / webhook.js /
// create-payment-link.js) only records a fee payment in ONE place:
// webhook.js's `payment_link.paid` handler. verify.js only checks an HMAC
// signature and writes nothing. create-order.js creates a Razorpay Order
// but nothing consumes it — there's no webhook wired to Orders, so a
// Checkout-modal-on-Order flow would let a parent pay and never have it
// recorded. This component therefore uses create-payment-link.js: it
// creates a Razorpay Payment Link and sends the parent to it (new tab).
// Razorpay calls webhook.js server-side once it's actually paid — no
// reliance on the browser calling back, no possibility of a tampered
// client skipping the write.
//
// If the backend isn't reachable, this falls back to the existing UPI ID /
// QR / bank-transfer + WhatsApp-confirmation block, so the button is never
// broken while the backend is being finished or if it goes down.
//
// Props:
//   isOpen, onClose  — modal visibility, same pattern as ParentsPortal
//   upi, bank        — optional { upi_id, upi_qr_url } / bank details object,
//                       passed through from the same getStats() data the
//                       landing page already fetches for the fee section

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import { gccStr, fmt } from './feeEngine'
import { getStudentDues } from './feeDues'

const RAZORPAY_CREATE_PAYMENT_LINK_URL = import.meta.env?.VITE_RAZORPAY_CREATE_PAYMENT_LINK_URL || '/api/razorpay/create-payment-link'

// Client-side throttling — a speed bump against casual scripted abuse, not
// a real security boundary (see SECURITY NOTES above). Tune freely.
const MAX_LOOKUP_ATTEMPTS = 5        // per browser session (resets on page reload)
const LOOKUP_COOLDOWN_MS = 15_000    // forced pause after hitting the cap
const MAX_PAY_ATTEMPTS = 3           // per looked-up student, per session
const GENERIC_LOOKUP_ERROR = 'Something went wrong looking up your record. Please try again in a moment or contact the institute.'
const GENERIC_PAY_ERROR = 'Online payment isn\'t available right now — use the UPI/bank details below instead.'

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
  const [linkFailed, setLinkFailed] = useState(false) // true once create-payment-link is known unreachable this session
  const [cooldownUntil, setCooldownUntil] = useState(0) // Date.now() timestamp; lookup blocked until then

  // Attempt counters live in refs, not state — they must persist across
  // renders without themselves triggering one, and don't need to be
  // reset by the reset() callback below (a fresh lookup attempt after
  // closing/reopening the modal should still count against the same
  // per-session budget, since the whole point is slowing down a script
  // that opens/closes this modal in a loop).
  const lookupAttemptsRef = useRef(0)
  const payAttemptsRef = useRef(0)

  const reset = useCallback(() => {
    setStep('lookup'); setGcc(''); setPhone(''); setLoading(false); setErrorMsg('')
    setStudent(null); setSummary(null); setPayAmount(''); setPaying(false); setPayError(''); setLinkFailed(false)
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

    const now = Date.now()
    if (now < cooldownUntil) {
      const secsLeft = Math.ceil((cooldownUntil - now) / 1000)
      setErrorMsg(`Too many lookups — please wait ${secsLeft}s and try again.`)
      return
    }
    if (lookupAttemptsRef.current >= MAX_LOOKUP_ATTEMPTS) {
      setCooldownUntil(now + LOOKUP_COOLDOWN_MS)
      lookupAttemptsRef.current = 0
      setErrorMsg(`Too many lookups — please wait ${Math.ceil(LOOKUP_COOLDOWN_MS / 1000)}s and try again.`)
      return
    }

    const cleanGcc = gccStr(gcc.trim())
    if (!cleanGcc) { setErrorMsg('Please enter your GCC / Student ID number.'); return }
    lookupAttemptsRef.current += 1
    setLoading(true); setErrorMsg('')
    try {
      const { data, error } = await supabase
        // Reads from a narrow view (students_public_fee_view), not the
        // base students table — see tighten-students-public-view.sql. The
        // view exposes only the columns this component actually uses, so
        // an anonymous visitor can never read anything beyond what's
        // already shown in this modal, regardless of what else the real
        // students table holds.
        .from('students_public_fee_view')
        .select('*')
        .eq('gcc_no', cleanGcc)
        .limit(1)
        .maybeSingle()

      if (error) {
        // Log the real error for us to debug — never show raw Postgres/
        // Supabase error text (column names, RLS policy names, etc.) to an
        // anonymous visitor; that's free schema reconnaissance for anyone
        // probing this public endpoint.
        console.error('Public fee lookup — students query failed:', error)
        throw error
      }
      if (!data) { setErrorMsg('No student found with that GCC / Student ID. Please check the number or contact the institute.'); setLoading(false); return }

      // Light verification: if a phone was entered, it must match one of the
      // stored guardian/parent phone fields (last 10 digits, so +91 prefixes
      // don't cause a false mismatch). This is a courtesy check, not a
      // security boundary — no fee is written from this page either way,
      // and a mismatch never blocks continuing (see SECURITY NOTES above).
      if (phone.trim()) {
        const enteredDigits = phone.replace(/\D/g, '').slice(-10)
        // Confirmed against the real students table schema: phone,
        // parent_phone, parent_whatsapp are the only contact-number
        // columns that exist. Earlier guessed names (guardian_phone,
        // father_phone, mother_phone, guardian_mobile, mobile) do not
        // exist on this table and must not be referenced here.
        const candidates = [data.phone, data.parent_phone, data.parent_whatsapp]
          .filter(Boolean).map((p) => String(p).replace(/\D/g, '').slice(-10))
        if (enteredDigits && candidates.length && !candidates.includes(enteredDigits)) {
          setErrorMsg('That phone number does not match our records for this student. You can still continue if you are sure the GCC number is correct.')
        }
      }

      let feeSummary
      try {
        const dues = await getStudentDues(data)
        if (!dues) throw new Error('empty dues result')
        feeSummary = dues
      } catch (feeErr) {
        // Same rule as above: log the specifics, show the visitor a plain
        // sentence with no internal detail.
        console.error('Public fee lookup — getStudentDues failed:', feeErr)
        feeSummary = null
        setErrorMsg('We found your record, but couldn\'t load payment details right now. You can still make a payment below — please mention the amount to the institute for confirmation.')
      }
      setStudent(data)
      setSummary(feeSummary)
      setPayAmount(feeSummary?.totalDue > 0 ? String(feeSummary.totalDue) : '')
      payAttemptsRef.current = 0
      setStep('summary')
    } catch (err) {
      console.error('Public fee lookup failed:', err)
      setErrorMsg(GENERIC_LOOKUP_ERROR)
    } finally {
      setLoading(false)
    }
  }

  const payViaRazorpayLink = async () => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) { setPayError('Enter a valid amount to pay.'); return }
    if (!Number.isFinite(amount) || amount > 500000) {
      // Sanity ceiling — no real GNSI fee should ever be this large in one
      // payment. Catches obvious fat-finger entry and any attempt to abuse
      // this box for something other than a fee payment. The authoritative
      // check still belongs server-side in create-payment-link.js (its own
      // comments already flag amount as untrusted input) — this is just a
      // first line of defense so the browser doesn't even try.
      setPayError('That amount looks too large for a single payment. Please contact the institute if this is correct.')
      return
    }
    if (payAttemptsRef.current >= MAX_PAY_ATTEMPTS) {
      setPayError('Too many payment attempts for this lookup. Please use the UPI/bank details below, or look up the student again.')
      setLinkFailed(true)
      return
    }
    payAttemptsRef.current += 1
    setPaying(true); setPayError('')
    try {
      // Matches create-payment-link.js's expected body exactly: { gcc,
      // studentName, amount, kind, for_month, year, course, subtype,
      // parentPhone }. We don't try to split this payment across specific
      // fee-table rows (admission/flat/course) the way the staff dashboard
      // can — a parent paying online is settling "what I owe", not picking
      // a line item — so kind is left as the generic 'other' bucket
      // webhook.js falls back to (adm_fee_collections with fee_type:
      // 'other'). If GNSI wants online payments split by kind later, this
      // is the one place that would need a kind/for_month/course selector.
      const res = await fetch(RAZORPAY_CREATE_PAYMENT_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcc: student.gcc_no,
          studentName: student.name,
          amount,
          kind: 'other',
          parentPhone: phone.trim() || undefined,
        }),
      })
      if (!res.ok) {
        console.error('create-payment-link failed:', res.status)
        setLinkFailed(true)
        setPaying(false)
        setPayError('Online payment isn\'t available right now — use the UPI/bank details below instead.')
        return
      }
      const link = await res.json()
      if (!link.short_url) throw new Error('No payment link returned')

      // Open in a new tab rather than redirecting this one, so the modal
      // (and the parent's place in it) survives if they just want to check
      // the link and come back. Razorpay's webhook records the payment
      // server-side once it's actually paid — this component doesn't need
      // to poll or confirm anything itself.
      window.open(link.short_url, '_blank', 'noopener,noreferrer')
      setStep('link-sent')
    } catch (err) {
      console.error('Razorpay payment link flow failed:', err)
      setPaying(false)
      setLinkFailed(true)
      setPayError('Online payment isn\'t available right now — use the UPI/bank details below instead.')
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
            <div style={{ fontSize: '.78rem', color: C.goldL, marginTop: 2 }}>GNSI Khangabok{summary?.sessionYear ? ` · ${summary.sessionYear}` : ''}</div>
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
                disabled={loading || Date.now() < cooldownUntil}
                style={{ width: '100%', padding: '.9rem', background: C.navy, color: C.goldL, border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '1rem', cursor: (loading || Date.now() < cooldownUntil) ? 'not-allowed' : 'pointer', opacity: (loading || Date.now() < cooldownUntil) ? .6 : 1 }}
              >
                {loading ? 'Looking up…' : Date.now() < cooldownUntil ? 'Please wait…' : 'Find My Fee Details →'}
              </button>
              <p style={{ color: C.mist, fontSize: '.78rem', textAlign: 'center', marginTop: '.9rem' }}>
                Don't know your GCC number? Call{' '}
                <a href="tel:+918974298074" style={{ color: C.navy, fontWeight: 600 }}>+91 89742 98074</a>
              </p>
            </form>
          )}

          {step === 'summary' && student && (
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

              {summary ? (
                <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1.2rem' }}>
                  <div style={{ flex: 1, background: '#E4F5EC', borderRadius: 4, padding: '.7rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: C.green }}>{fmt(summary.totalPaid)}</div>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: C.green, textTransform: 'uppercase' }}>Paid So Far</div>
                  </div>
                  <div style={{ flex: 1, background: summary.totalDue > 0 ? '#FDF3E7' : '#E4F5EC', borderRadius: 4, padding: '.7rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: summary.totalDue > 0 ? C.gold : C.green }}>{fmt(summary.totalDue)}</div>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: summary.totalDue > 0 ? '#8C6A1E' : C.green, textTransform: 'uppercase' }}>
                      {summary.totalDue > 0 ? 'Currently Due' : 'Fully Paid'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: C.cream, borderRadius: 4, padding: '1rem', textAlign: 'center', marginBottom: '1.2rem', color: C.mist, fontSize: '.9rem' }}>
                  Payment details unavailable right now
                </div>
              )}
              {summary?.failedSources?.length > 0 && (
                <p style={{ color: C.mist, fontSize: '.75rem', marginTop: '-.9rem', marginBottom: '1rem' }}>
                  Some figures may be incomplete ({summary.failedSources.join(', ')}) — treat as a lower bound.
                </p>
              )}

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

              {/* UPI/bank shown as the primary, always-available option — it's
                  a direct bank transfer with no payment-gateway fee at all
                  (UPI P2M has been zero-MDR by NPCI mandate since 2020),
                  unlike the Razorpay Payment Link path below, which currently
                  carries a convenience fee + GST on top for the payer. */}
              <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1rem', marginBottom: '.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.6rem' }}>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: '.92rem' }}>Pay via UPI (no extra charges)</div>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', color: C.green, background: '#E4F5EC', padding: '.15rem .5rem', borderRadius: 999 }}>Recommended</span>
                </div>
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

              {/* Card/netbanking via Razorpay Payment Link — secondary, and
                  labeled clearly so a payer understands the small fee only
                  applies to this option, not the UPI one above. */}
              {!linkFailed && (
                <button
                  onClick={payViaRazorpayLink}
                  disabled={paying}
                  style={{ width: '100%', padding: '.8rem', background: 'transparent', border: `1px solid ${C.border}`, color: C.navy, borderRadius: 4, fontWeight: 600, fontSize: '.92rem', cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? .6 : 1, marginBottom: '.4rem' }}
                >
                  {paying ? 'Creating payment link…' : `Or pay ${fmt(Number(payAmount) || 0)} by Card / Netbanking →`}
                </button>
              )}
              {!linkFailed && (
                <p style={{ color: C.mist, fontSize: '.7rem', textAlign: 'center', marginBottom: '.9rem' }}>
                  A small convenience fee + GST applies to card/netbanking payments.
                </p>
              )}

              <button
                onClick={() => setStep('lookup')}
                style={{ width: '100%', padding: '.6rem', background: 'transparent', border: 'none', color: C.mist, fontSize: '.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Look up a different student
              </button>
            </div>
          )}

          {step === 'link-sent' && student && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '.8rem' }}>🔗</div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: '1.1rem', marginBottom: '.4rem' }}>Payment Page Opened</div>
              <p style={{ color: C.mist, fontSize: '.92rem', lineHeight: 1.6, marginBottom: '1.3rem' }}>
                A secure Razorpay payment page opened in a new tab for GCC-{student.gcc_no}. Complete the payment there — it will be recorded automatically once done. If the tab didn't open, check your browser's pop-up blocker.
              </p>
              <button
                onClick={() => setStep('summary')}
                style={{ width: '100%', padding: '.8rem', background: 'transparent', border: `1px solid ${C.border}`, color: C.navy, borderRadius: 4, fontWeight: 600, cursor: 'pointer', marginBottom: '.6rem' }}
              >
                ← Back
              </button>
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
// FeeCollectionModal.jsx

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  collectFee,
  upsertAccount, printReceipt, sourceRef,
  getFeeRates, getFlatFees, clearFeeRateCache,
  CURRENT_YEAR, PAY_MODES, MONTHS_LIST,
  checkCourseFeeExists, checkFlatFeeExists,
  saveStudentFlatFeeOverride, getStudentFlatFeeOverride,
} from './feeEngine'

const FEE_ITEMS = [
  { id: 'admission',  label: 'Admission Fee',  amount: 6000, type: 'admission', icon: '🎓', color: '#4f46e5' },
  { id: 'dress',      label: 'Dress Fee',       amount: 3000, type: 'item',      icon: '👕', color: '#0891b2' },
  { id: 'prospectus', label: 'Prospectus Fee',  amount: 200,  type: 'item',      icon: '📖', color: '#7c3aed' },
]

const HOSTEL_TYPES = ['Day Scholar', 'Boarder', 'Day Boarder']

const C = {
  navy:    '#1e3a5f',
  indigo:  '#4f46e5',
  emerald: '#059669',
  violet:  '#7c3aed',
  amber:   '#d97706',
  red:     '#dc2626',
  slate: { 50:'#f8fafc', 100:'#f1f5f9', 200:'#e2e8f0', 400:'#94a3b8', 500:'#64748b', 700:'#334155', 900:'#0f172a' },
}

const inp = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit', background: 'white',
}

const PaidBadge = () => (
  <span style={{ fontSize:10, fontWeight:800, color:C.emerald, background:'#dcfce7', padding:'3px 8px', borderRadius:6, flexShrink:0, letterSpacing:'.04em' }}>
    ✓ PAID
  </span>
)

function PaidSummaryBar({ paid, unpaid, loading }) {
  if (loading) return <div style={{ fontSize:12, color:C.slate[400], marginBottom:12, padding:'8px 12px', background:C.slate[50], borderRadius:8 }}>⏳ Checking payment history…</div>
  return (
    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
      <div style={{ flex:1, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:800, color:C.emerald }}>{paid}</div>
        <div style={{ fontSize:10, fontWeight:700, color:C.emerald, textTransform:'uppercase', letterSpacing:'.06em' }}>Paid</div>
      </div>
      <div style={{ flex:1, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:800, color:C.amber }}>{unpaid}</div>
        <div style={{ fontSize:10, fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'.06em' }}>Unpaid</div>
      </div>
    </div>
  )
}

function HostelBadge({ type }) {
  const styles = {
    Boarder:       { bg:'#dcfce7', color:'#166534', border:'#86efac' },
    'Day Boarder': { bg:'#fef3c7', color:'#92400e', border:'#fde68a' },
    'Day Scholar': { bg:'#f1f5f9', color:'#475569', border:'#e2e8f0' },
  }
  const s = styles[type] || styles['Day Scholar']
  return (
    <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', padding:'2px 8px', borderRadius:4, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {type}
    </span>
  )
}

export default function FeeCollectionModal({ app, student, onClose, onSaved, isAdmin = false, currentUser = null }) {

  // Guards against upstream bugs that stringify a missing value, e.g. `${obj.gcc_no}`
  // when gcc_no is JS `undefined` — this produces the literal text "undefined", which
  // is a truthy, non-null string. It passes straight through `??` and `if (!gcc)`
  // checks, silently writing "undefined" into adm_app_id. This treats those cases
  // as genuinely missing so the fallback chain (and the guards below) actually catch them.
  const validGcc = v => {
    const s = v === undefined || v === null ? '' : String(v).trim()
    return (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') ? undefined : s
  }

  const gcc    = gccStr(validGcc(app?.gcc) ?? validGcc(app?.gcc_no) ?? validGcc(student?.gcc_no) ?? '')
  const name   = app?.name       ?? app?.applicant_name ?? student?.name       ?? ''
  const course = app?.course     ?? student?.course     ?? ''
  const batch  = app?.cls        ?? app?.batch          ?? student?.batch      ?? ''
  const admNo  = app?.admNo      ?? app?.adm_no         ?? student?.admission_no ?? ''

  // ── SESSION-WISE FEE LOOKUP ────────────────────────────────────────────────
  // Fee rates must come from the SESSION THE STUDENT WAS ADMITTED IN, not
  // whatever session happens to be "current" today — a student admitted in
  // 2025-2026 keeps being billed at 2025-2026 rates even while a later
  // 2026-2027 session is active, so past-session fee_structures rows stay
  // meaningful and nobody's dues silently jump to this year's rate.
  //
  // Preference order: app.session (set at application time) → student.session
  // (set at enrollment via promoteToStudent) → today's computed session as a
  // last-resort fallback for any record that predates session tracking.
  //
  // NOTE: this depends on admission_sessions / admissions / students all
  // using the same "YYYY-YYYY" string format as fee_structures.session_year
  // (e.g. "2026-2027") — confirmed and standardized across all three tables.
  const sessionYear = app?.session || student?.session || `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

  const resolveInitialHostel = () => {
    if (app?.hostel === 'Yes' || app?.hostel_type === 'Boarder') return 'Boarder'
    if (student?.hostel_type) return student.hostel_type
    return 'Day Scholar'
  }

  const [hostelType,      setHostelType]      = useState(resolveInitialHostel)
  const [hostelWarning,   setHostelWarning]   = useState(null)
  const [hostelAutoFixed, setHostelAutoFixed] = useState(false)

  // ── Repeater flag ─────────────────────────────────────────────────────────
  const [isRepeater,     setIsRepeater]     = useState(false)
  const [repeaterSaving, setRepeaterSaving] = useState(false)

  // ── Admission date (compulsory — Fresher and Repeater both) ────────────────
  const [admissionDate,     setAdmissionDate]     = useState('')
  const [admDateSaving,     setAdmDateSaving]     = useState(false)

  // ── Rates from DB ─────────────────────────────────────────────────────────
  const [feeRates,     setFeeRates]     = useState({ flatFee: 0, courseFee: 0, admissionFee: 6000 })
  const [flatFees,     setFlatFees]     = useState([])
  const [ratesLoading, setRatesLoading] = useState(true)

  // ── Per-student flat fee override state ───────────────────────────────────
  const [hasOverride,     setHasOverride]     = useState(false)   // true if DB override exists
  const [overrideMode,    setOverrideMode]    = useState(false)   // show inline editor
  const [overrideAmt,     setOverrideAmt]     = useState('')      // editor value
  const [overrideReason,  setOverrideReason]  = useState('')
  const [overrideSaving,  setOverrideSaving]  = useState(false)
  const [overrideFeedback,setOverrideFeedback]= useState(null)    // { type, msg }

  // Load rates + check override whenever hostelType / course / batch changes
  useEffect(() => {
    setRatesLoading(true)
    getFeeRates(sessionYear, course, batch, hostelType, gcc || null)
      .then(rates => {
        setFeeRates(rates)
        setCourseAmt(rates.courseFee)
        setHasOverride(!!rates.flatFeeOverride)
        if (rates.flatFeeOverride) {
          setOverrideAmt(String(rates.flatFeeOverride.flat_fee_override))
          setOverrideReason(rates.flatFeeOverride.reason || '')
        }
      })
      .finally(() => setRatesLoading(false))
  }, [hostelType, course, batch])

  // Load flat fee list (pass gcc so override is respected in amounts, and
  // admissionDate so months before the student actually joined are excluded)
  useEffect(() => {
    getFlatFees(hostelType, course, batch, sessionYear, gcc || null, admissionDate || null)
      .then(setFlatFees)
  }, [hostelType, course, batch, hasOverride, admissionDate])  // re-run when override or admission date changes

  const [tab,         setTab]         = useState('admission')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(null)
  const [payMode,     setPayMode]     = useState('Cash')
  const [txnRef,      setTxnRef]      = useState('')
  const [payDate,     setPayDate]     = useState(today())
  // ✦ Fix: currentUser was passed in as a prop but never actually used —
  // "Collected By" was a blank free-text field every time, letting staff
  // type any name (including someone else's), with no real audit trail.
  // Now auto-fills from the authenticated session's username. Still
  // editable (not locked) in case session data is ever missing or a
  // different staff member genuinely collected the payment in person.
  const [collectedBy, setCollectedBy] = useState(currentUser?.userName || currentUser?.name || '')

  // Admission tab
  const [selected,     setSelected]     = useState({})
  const [customAmts,   setCustomAmts]   = useState({})
  const [paidAdmItems, setPaidAdmItems] = useState([])
  const [loadingAdm,   setLoadingAdm]   = useState(false)

  // Flat fee tab
  const [flatSel,     setFlatSel]     = useState({})
  const [paidMonths,  setPaidMonths]  = useState([])
  const [loadingPaid, setLoadingPaid] = useState(false)

  // Course fee tab
  const [courseMonth,      setCourseMonth]      = useState(MONTHS_LIST[new Date().getMonth()])
  const [courseYear,       setCourseYear]        = useState(CURRENT_YEAR)
  const [courseAmt,        setCourseAmt]         = useState(0)
  const [paidCourseMonths, setPaidCourseMonths] = useState([])
  const [loadingCourse,    setLoadingCourse]    = useState(false)

  // ── Cross-check hostel_allocations ────────────────────────────────────────
  useEffect(() => {
    if (!student?.id) return
    supabase
      .from('hostel_allocations')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('status', 'Active')
      .limit(1)
      .then(({ data }) => {
        if (!data) return
        if (data.length > 0 && hostelType !== 'Boarder') {
          setHostelType('Boarder')
          setHostelAutoFixed(true)
          setHostelWarning(`Auto-corrected: ${name} has an active hostel allocation but was set as "${hostelType}". Changed to Boarder — verify below.`)
        } else if (data.length === 0 && hostelType === 'Boarder') {
          setHostelWarning(`Warning: ${name} is set as Boarder but has no active hostel allocation on record.`)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])

  useEffect(() => { setSaved(null); setError(null) }, [hostelType])

  // ── Load repeater flag + admission date ─────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    supabase
      .from('students')
      .select('is_repeater, admission_date')
      .eq('gcc_no', parseInt(gcc))
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsRepeater(!!data.is_repeater)
          setAdmissionDate(data.admission_date || '')
        }
      })
  }, [gcc])

  const toggleRepeater = async () => {
    const newVal = !isRepeater
    setRepeaterSaving(true)
    await supabase
      .from('students')
      .update({ is_repeater: newVal })
      .eq('gcc_no', parseInt(gcc))
    setIsRepeater(newVal)
    setRepeaterSaving(false)
  }

  // Admission date is compulsory for both Fresher and Repeater — this modal
  // and the Admissions/Students form both write to the same column, so
  // whichever is filled first "wins" and the other just confirms it.
  const saveAdmissionDate = async (val) => {
    setAdmissionDate(val)
    if (!gcc || !val) return
    setAdmDateSaving(true)
    await supabase
      .from('students')
      .update({ admission_date: val })
      .eq('gcc_no', parseInt(gcc))
    setAdmDateSaving(false)
  }

  // ── Load paid admission items ─────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingAdm(true)
    supabase.from('adm_fee_collections').select('description').eq('adm_app_id', gcc).eq('reverted', false)
      .then(({ data }) => { if (data) setPaidAdmItems(data.map(r => r.description)); setLoadingAdm(false) })
  }, [gcc])

  // ── Load paid flat months ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingPaid(true)
    supabase.from('adm_flat_fees').select('month, year').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false)
      .then(({ data }) => {
        if (data) setPaidMonths(data.map(r => `${r.month}_${r.year}`))
        setLoadingPaid(false)
      })
  }, [gcc])

  // ── Load paid course months ───────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingCourse(true)
    supabase.from('adm_course_fees').select('for_month, year').eq('adm_app_id', gcc).eq('reverted', false)
      .then(({ data }) => {
        if (data) setPaidCourseMonths(data.map(r => `${r.for_month}_${r.year}`))
        setLoadingCourse(false)
      })
  }, [gcc])

  const isAdmItemPaid     = label => paidAdmItems.includes(label)
  const isMonthPaid       = fee   => paidMonths.includes(`${fee.month}_${fee.year}`)
  const isCourseMonthPaid = ()    => paidCourseMonths.includes(`${courseMonth}_${courseYear}`)

  const admTotal  = FEE_ITEMS.filter(f => selected[f.id] && !isAdmItemPaid(f.label)).reduce((s, f) => s + (Number(customAmts[f.id]) || f.amount), 0)
  const flatTotal = flatFees.filter(f => flatSel[f.id] && !isMonthPaid(f)).reduce((s, f) => s + f.amount, 0)

  // ── Save flat fee override inline ─────────────────────────────────────────
  const saveOverrideInline = async () => {
    const amt = parseFloat(overrideAmt)
    if (isNaN(amt) || amt < 0) { setOverrideFeedback({ type: 'err', msg: 'Enter a valid amount.' }); return }
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(parseInt(gcc), sessionYear, amt, overrideReason, 'admin')
      clearFeeRateCache()
      // Reload rates with override applied
      const rates = await getFeeRates(sessionYear, course, batch, hostelType, parseInt(gcc))
      setFeeRates(rates)
      setHasOverride(true)
      // Reload flat fee list with new amount
      const updated = await getFlatFees(hostelType, course, batch, sessionYear, parseInt(gcc), admissionDate || null)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: `Flat fee set to ₹${amt.toLocaleString('en-IN')}/month for ${sessionYear}.` })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Save failed.' })
    } finally { setOverrideSaving(false) }
  }

  // ── Remove override inline ────────────────────────────────────────────────
  const removeOverrideInline = async () => {
    if (!isAdmin) { alert('Only admin can remove fee overrides.'); return }
    if (!window.confirm('Remove override? This student will revert to the standard flat fee rate.')) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(parseInt(gcc), sessionYear, null)
      clearFeeRateCache()
      const rates = await getFeeRates(sessionYear, course, batch, hostelType, null)
      setFeeRates(rates)
      setHasOverride(false)
      setOverrideAmt('')
      setOverrideReason('')
      const updated = await getFlatFees(hostelType, course, batch, sessionYear, null, admissionDate || null)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: 'Override removed. Standard rate restored.' })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Remove failed.' })
    } finally { setOverrideSaving(false) }
  }

  const commonReceiptFields = rcpt => ({
    receipt_no: rcpt, pay_date: payDate, pay_mode: payMode,
    txn_ref: txnRef || null, collected_by: collectedBy || null,
    student_name: name, adm_no: admNo || null,
    gcc_no: gcc, class_name: batch || null,
    course, hostel_type: hostelType,
  })

  // Non-Active students (Inactive / Passed Out / Withdrawn / Dropout) should
  // never have new fee collections recorded against them — the Fee Dashboard
  // already excludes them from every total, so a payment collected here
  // would silently disappear from all reporting while still charging real
  // money. Blank/missing status is treated as active, matching the
  // `status:'Active'` default used when students are created.
  const studentStatus = student?.status || 'Active'
  const isStudentActive = studentStatus === 'Active'
  const inactiveStatusMsg = `This student's status is "${studentStatus}", not Active. Fee collection is disabled — reactivate the student in Students first if this is a mistake.`

  // ── Advance payment authorization ───────────────────────────────────────
  // Collecting for a month that hasn't started yet is normally the "staff
  // picked the wrong month" bug the future_month_tag anomaly check in
  // Fees.jsx exists to catch. A genuine advance payment is the same action
  // taken deliberately — so it must be distinguishable at write-time, not
  // discovered later as an anomaly. Non-admins can never do this at all;
  // admins can, but only after entering a PIN at the moment of collection,
  // and the resulting row is permanently tagged (is_advance / 
  // advance_authorized_by) so it never gets confused with the mistake this
  // was built to catch, in the ledger, receipts, or anywhere else it shows.
  const ADVANCE_PIN = '2468' // TODO: move to an env var / admin-settings table once one exists
  const [advancePinOpen,  setAdvancePinOpen]  = useState(false)
  const [advancePinValue, setAdvancePinValue] = useState('')
  const [advancePinError, setAdvancePinError] = useState('')
  const [advancePinFor,   setAdvancePinFor]   = useState(null) // 'flat' | 'course' — which save to resume after auth
  const [flatAdvanceAuthorized,   setFlatAdvanceAuthorized]   = useState(false)
  const [courseAdvanceAuthorized, setCourseAdvanceAuthorized] = useState(false)

  // A fee-period month/year counts as "future" if its 1st falls after today —
  // matches the future_month_tag anomaly check in Fees.jsx exactly, so a
  // payment either passes both checks or fails both, never one but not the
  // other.
  const isFutureFeeMonth = (monthName, yr) => {
    const idx = MONTHS_LIST.findIndex(m => m === monthName)
    if (idx === -1) return false
    const monthDate = new Date(`${monthName} 1, ${yr}`)
    const todayFirst = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    return monthDate > todayFirst
  }

  const openAdvancePin = (forWhich) => {
    setAdvancePinFor(forWhich)
    setAdvancePinValue('')
    setAdvancePinError('')
    setAdvancePinOpen(true)
  }
  const confirmAdvancePin = () => {
    if (advancePinValue !== ADVANCE_PIN) { setAdvancePinError('Incorrect PIN.'); return }
    if (advancePinFor === 'flat') setFlatAdvanceAuthorized(true)
    if (advancePinFor === 'course') setCourseAdvanceAuthorized(true)
    setAdvancePinOpen(false)
  }

  // ── UNIFIED save — all fee types go through collectFee (feeEngine) ────────────────
  const saveAdmission = async () => {
    if (saving) return
    if (!isStudentActive) return alert(inactiveStatusMsg)
    if (!gcc || gcc.toLowerCase() === 'undefined' || gcc.toLowerCase() === 'null') return alert('Student GCC number is missing or invalid. Please close this modal and reopen it from the student list.')
    if (!admissionDate) return alert('Admission Date is required before collecting fees. Please set it above.')
    if (isRepeater) return alert('This student is marked as a Repeater — Admission Fee, Dress Fee, and Prospectus Fee are waived. Use the Flat or Course tab instead.')
    if (payMode === 'UPI' && !txnRef.trim()) return alert('UPI Txn / UTR No. is required for UPI payments.')
    const admFeeItems = FEE_ITEMS.filter(f => selected[f.id] && !paidAdmItems.includes(f.label))
    if (!admFeeItems.length) return alert('Select at least one unpaid fee item.')
    setSaving(true); setError(null)
    try {
      const rNo = rcptNo()
      const items = admFeeItems.map(f => ({
        kind: f.id === 'admission' ? 'admission' : 'item',
        label: f.label,
        amount: Number(customAmts[f.id]) || f.amount,
      }))
      const { sections, total, skipped } = await collectFee({
        gcc, studentName: name, admNo: admNo || '--',
        className: batch || '', course: course || '',
        hostelType, payDate, payMode, txnRef: txnRef || null,
        collectedBy: collectedBy || null, receiptNo: rNo, items,
      })
      if (skipped?.length) setError(`Already collected, skipped: ${skipped.join(', ')}`)
      if (sections.length) printReceipt({ ...commonReceiptFields(rNo), sections, total })
      setSaved({ rcpt: rNo, items: admFeeItems.map(i => i.label).join(', '), total })
      setPaidAdmItems(p => [...new Set([...p, ...admFeeItems.map(i => i.label)])])
      setSelected({})
      onSaved?.()
    } catch (err) { setError(err.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  const saveFlat = async () => {
    if (saving) return
    if (!isStudentActive) return alert(inactiveStatusMsg)
    if (!gcc || gcc.toLowerCase() === 'undefined' || gcc.toLowerCase() === 'null') return alert('Student GCC number is missing or invalid. Please close this modal and reopen it from the student list.')
    if (!admissionDate) return alert('Admission Date is required before collecting fees. Please set it above.')
    if (payMode === 'UPI' && !txnRef.trim()) return alert('UPI Txn / UTR No. is required for UPI payments.')
    const unpaid = flatFees.filter(f => flatSel[f.id] && !isMonthPaid(f))
    if (!unpaid.length) return alert('Select at least one unpaid month.')
    const hasFutureMonth = unpaid.some(f => isFutureFeeMonth(f.month, f.year))
    if (hasFutureMonth && !isAdmin) return alert('One or more selected months haven\'t started yet. Only an admin can authorize collecting an advance payment.')
    if (hasFutureMonth && !flatAdvanceAuthorized) return alert('One or more selected months haven\'t started yet. Click "Authorize advance payment (PIN)" above first.')
    setSaving(true); setError(null)
    try {
      const rNo = rcptNo()
      const items = unpaid.map(f => {
        const isAdvance = isFutureFeeMonth(f.month, f.year)
        return { kind: 'flat', month: f.month, year: f.year, amount: f.amount, isAdvance, advanceAuthorizedBy: isAdvance ? (currentUser?.userName || currentUser?.name || 'Admin') : null }
      })
      const { sections, total, skipped } = await collectFee({
        gcc, studentName: name, admNo: admNo || '--',
        className: batch || '', course: course || '',
        hostelType, payDate, payMode, txnRef: txnRef || null,
        collectedBy: collectedBy || null, receiptNo: rNo, items,
      })
      if (skipped?.length) setError(`Already collected, skipped: ${skipped.join(', ')}`)
      if (sections.length) printReceipt({ ...commonReceiptFields(rNo), sections, total })
      setSaved({ rcpt: rNo, items: unpaid.map(i => `${i.month} ${i.year}`).join(', '), total })
      setPaidMonths(p => [...new Set([...p, ...unpaid.map(i => `${i.month}_${i.year}`)])])
      setFlatSel({})
      setFlatAdvanceAuthorized(false)
      onSaved?.()
    } catch (err) { setError(err.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  const saveCourse = async () => {
    if (saving) return
    if (!isStudentActive) return alert(inactiveStatusMsg)
    if (!gcc || gcc.toLowerCase() === 'undefined' || gcc.toLowerCase() === 'null') return alert('Student GCC number is missing or invalid. Please close this modal and reopen it from the student list.')
    if (!admissionDate) return alert('Admission Date is required before collecting fees. Please set it above.')
    if (payMode === 'UPI' && !txnRef.trim()) return alert('UPI Txn / UTR No. is required for UPI payments.')
    const amt = Number(courseAmt)
    if (!amt || amt <= 0) return alert('Enter a valid amount.')
    if (isCourseMonthPaid()) { setError(`Course fee for ${courseMonth} ${courseYear} is already recorded.`); return }
    const isAdvance = isFutureFeeMonth(courseMonth, courseYear)
    if (isAdvance && !isAdmin) return alert(`${courseMonth} ${courseYear} hasn't started yet. Only an admin can authorize collecting an advance payment.`)
    if (isAdvance && !courseAdvanceAuthorized) return alert(`${courseMonth} ${courseYear} hasn't started yet. Click "Authorize advance payment (PIN)" above first.`)
    setSaving(true); setError(null)
    try {
      const rNo = rcptNo()
      const { sections, total } = await collectFee({
        gcc, studentName: name, admNo: admNo || '--',
        className: batch || '', course: course || '',
        hostelType, payDate, payMode, txnRef: txnRef || null,
        collectedBy: collectedBy || null, receiptNo: rNo,
        items: [{ kind: 'course', course: course || '', subtype: batch || '', month: courseMonth, year: courseYear, amount: amt, isAdvance, advanceAuthorizedBy: isAdvance ? (currentUser?.userName || currentUser?.name || 'Admin') : null }],
      })
      printReceipt({ ...commonReceiptFields(rNo), sections, total })
      setPaidCourseMonths(p => [...new Set([...p, `${courseMonth}_${courseYear}`])])
      setSaved({ rcpt: rNo, items: `${course} · ${batch} · ${courseMonth} ${courseYear}`, total: amt })
      setCourseAdvanceAuthorized(false)
      onSaved?.()
    } catch (err) { setError(err.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  const handleClose = () => typeof onClose === 'function' && onClose()

  const tabBtn = (id, label, icon) => (
    <button type="button" onClick={() => { setTab(id); setSaved(null); setError(null) }}
      style={{ flex:1, padding:'10px 6px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:tab===id?C.navy:C.slate[100], color:tab===id?'white':C.slate[500], transition:'all .15s' }}>
      {icon} {label}
    </button>
  )

  const allAdmPaid      = FEE_ITEMS.every(f => isAdmItemPaid(f.label))
  const allFlatPaid     = flatFees.length > 0 && flatFees.every(f => isMonthPaid(f))
  const courseMonthPaid = isCourseMonthPaid()
  const admPaidCount    = FEE_ITEMS.filter(f => isAdmItemPaid(f.label)).length
  const flatPaidCount   = flatFees.filter(f => isMonthPaid(f)).length

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(15,17,26,.75)', zIndex:999999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)' }} onClick={handleClose}>
      <div style={{ width:'min(560px,96vw)', background:'white', borderRadius:18, boxShadow:'0 32px 80px rgba(0,0,0,.25)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'92vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ height:4, background:`linear-gradient(90deg,${C.navy},${C.indigo},${C.violet})` }} />

        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${C.slate[100]}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:C.slate[400], marginBottom:4 }}>Fee Collection</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.slate[900] }}>{name || '—'}</div>
              <div style={{ fontSize:12, color:C.slate[400], marginTop:3, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {gcc    && <span style={{ fontWeight:700, color:C.navy }}>GCC-{gcc}</span>}
                {course && <span>{course}</span>}
                {batch  && <span>· {batch}</span>}
                {admNo  && <span style={{ color:C.indigo, fontWeight:600 }}>{admNo}</span>}
                <HostelBadge type={hostelType} />
                <span style={{ fontSize:10, fontWeight:700, color:C.slate[500], background:C.slate[100], padding:'2px 8px', borderRadius:4 }} title="Fee rates are locked to the session this student was admitted in">
                  📅 {sessionYear}
                </span>
                {hostelAutoFixed && <span style={{ fontSize:10, fontWeight:700, color:C.red, background:'#fef2f2', padding:'2px 7px', borderRadius:4, border:'1px solid #fca5a5' }}>⚠ AUTO-CORRECTED</span>}
                {!isStudentActive && (
                  <span style={{ fontSize:10, fontWeight:800, color:C.red, background:'#fef2f2', padding:'2px 9px', borderRadius:4, border:'1px solid #fca5a5', letterSpacing:'.04em' }}>
                    ⛔ {studentStatus.toUpperCase()}
                  </span>
                )}
                {isRepeater && (
                  <span style={{ fontSize:10, fontWeight:800, color:"#92400e", background:"#fef3c7", padding:"2px 9px", borderRadius:4, border:"1px solid #fcd34d", letterSpacing:".04em" }}>
                    🔁 REPEATER
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleRepeater}
                  disabled={repeaterSaving}
                  title={isRepeater ? "Remove Repeater tag" : "Mark as Repeater (2+ years at GNSI)"}
                  style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:4, border:`1px solid ${isRepeater ? "#fcd34d" : C.slate[200]}`, background: isRepeater ? "#fef3c7" : C.slate[50], color: isRepeater ? "#92400e" : C.slate[400], cursor: repeaterSaving ? "not-allowed" : "pointer", letterSpacing:".03em" }}>
                  {repeaterSaving ? "…" : isRepeater ? "✕ Remove" : "🔁 Mark Repeater"}
                </button>
              </div>
              {/* Admission date — compulsory for both Fresher and Repeater. Fee
                  collection is blocked (see saving guards below) until this is set. */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color: admissionDate ? C.slate[400] : C.red }}>
                  Admission Date{!admissionDate && ' *required'}
                </span>
                <input
                  type="date"
                  value={admissionDate || ''}
                  onChange={e => saveAdmissionDate(e.target.value)}
                  disabled={admDateSaving}
                  style={{ fontSize:12, padding:'3px 8px', borderRadius:5, border:`1.5px solid ${admissionDate ? C.slate[200] : '#fca5a5'}`, background: admissionDate ? 'white' : '#fef2f2', color: C.slate[900] }}
                />
                {admDateSaving && <span style={{ fontSize:11, color:C.slate[400] }}>saving…</span>}
              </div>
            </div>
            <button type="button" onClick={handleClose} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${C.slate[200]}`, background:C.slate[50], cursor:'pointer', fontSize:18, color:C.slate[500], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
          </div>

          {!isStudentActive && (
            <div style={{ marginTop:12, background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ fontSize:12, color:'#991B1B', fontWeight:700 }}>⛔ {inactiveStatusMsg}</div>
            </div>
          )}

          {hostelWarning && (
            <div style={{ marginTop:12, background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:10, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
              <div style={{ fontSize:12, color:'#92400e', fontWeight:600, flex:1 }}>⚠️ {hostelWarning}</div>
              <button type="button" onClick={() => setHostelWarning(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#92400e', fontSize:16, flexShrink:0 }}>×</button>
            </div>
          )}

          {/* Hostel type selector */}
          <div style={{ marginTop:12, background:C.slate[50], borderRadius:9, padding:'8px 12px', border:`1px solid ${C.slate[200]}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.slate[500], whiteSpace:'nowrap' }}>Hostel Type:</span>
              <div style={{ display:'flex', gap:6 }}>
                {HOSTEL_TYPES.map(type => (
                  <button key={type} type="button"
                    onClick={() => { setHostelType(type); setHostelWarning(null); setHostelAutoFixed(false) }}
                    style={{ padding:'4px 12px', borderRadius:6, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', background:hostelType===type?C.navy:C.slate[200], color:hostelType===type?'white':C.slate[500], transition:'all .12s' }}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:8, display:'flex', gap:16, fontSize:11, color:C.slate[500], alignItems:'center', flexWrap:'wrap' }}>
              {ratesLoading
                ? <span style={{ color:C.slate[400] }}>⏳ Loading rates…</span>
                : <>
                    {/* Flat fee display with override badge + edit button */}
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      📅 Flat fee:{' '}
                      <strong style={{ color: hasOverride ? C.violet : C.emerald }}>
                        ₹{fmt(feeRates.flatFee).replace('₹','')}/month
                      </strong>
                      {hasOverride && (
                        <span style={{ fontSize:9, fontWeight:800, background:'#ede9fe', color:C.violet, padding:'1px 6px', borderRadius:4, border:'1px solid #c4b5fd', letterSpacing:'.04em' }}>
                          OVERRIDE
                        </span>
                      )}
                      <button type="button" onClick={() => { setOverrideMode(m => !m); setOverrideFeedback(null) }}
                        title="Change flat fee for this student"
                        style={{ padding:'2px 8px', borderRadius:5, border:`1px solid ${C.slate[200]}`, background:'white', cursor:'pointer', fontSize:11, fontWeight:700, color:C.slate[500], lineHeight:1 }}>
                        ✏️ {overrideMode ? 'Cancel' : 'Change'}
                      </button>
                    </span>
                    <span>📚 Course fee: <strong style={{ color:C.violet }}>₹{fmt(feeRates.courseFee).replace('₹','')}/month</strong></span>
                  </>
              }
            </div>

            {/* ── Inline override editor ── */}
            {overrideMode && (
              <div style={{ marginTop:10, background:'#faf5ff', border:'1.5px solid #c4b5fd', borderRadius:9, padding:'12px 14px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.violet, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>
                  ✏️ Set custom flat fee for {name} — {sessionYear}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:C.slate[500], display:'block', marginBottom:4 }}>New Amount (₹/month)</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:C.slate[400] }}>₹</span>
                      <input
                        type="number" min="0" value={overrideAmt}
                        onChange={e => setOverrideAmt(e.target.value)}
                        placeholder={String(feeRates.flatFee)}
                        style={{ ...inp, paddingLeft:22, fontWeight:700, color:C.violet, borderColor:'#c4b5fd', fontSize:13 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:C.slate[500], display:'block', marginBottom:4 }}>Reason (optional)</label>
                    <input
                      type="text" value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      placeholder="e.g. Scholarship, concession…"
                      style={{ ...inp, borderColor:'#c4b5fd', fontSize:12 }}
                    />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="button" onClick={saveOverrideInline} disabled={overrideSaving || overrideAmt === ''}
                    style={{ flex:1, padding:'7px 0', borderRadius:7, border:'none', fontSize:12, fontWeight:700, cursor:overrideSaving||overrideAmt===''?'not-allowed':'pointer', background:overrideSaving||overrideAmt===''?C.slate[200]:`linear-gradient(135deg,${C.violet},${C.indigo})`, color:overrideSaving||overrideAmt===''?C.slate[400]:'white' }}>
                    {overrideSaving ? '⏳ Saving…' : '✅ Save Override'}
                  </button>
                  {hasOverride && (
                    <button type="button" onClick={removeOverrideInline} disabled={overrideSaving}
                      style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #fca5a5', background:'#fef2f2', fontSize:12, fontWeight:700, cursor:'pointer', color:C.red }}>
                      🗑 Remove
                    </button>
                  )}
                </div>
                {overrideFeedback && (
                  <div style={{ marginTop:8, padding:'8px 12px', borderRadius:7, fontSize:12, fontWeight:600, background:overrideFeedback.type==='ok'?'#ecfdf5':'#fef2f2', border:`1px solid ${overrideFeedback.type==='ok'?'#6ee7b7':'#fca5a5'}`, color:overrideFeedback.type==='ok'?'#065f46':'#b91c1c' }}>
                    {overrideFeedback.type==='ok'?'✅':'❌'} {overrideFeedback.msg}
                  </div>
                )}
              </div>
            )}

            {/* Feedback shown outside editor too */}
            {!overrideMode && overrideFeedback && (
              <div style={{ marginTop:8, padding:'7px 12px', borderRadius:7, fontSize:11, fontWeight:600, background:overrideFeedback.type==='ok'?'#ecfdf5':'#fef2f2', color:overrideFeedback.type==='ok'?'#065f46':'#b91c1c' }}>
                {overrideFeedback.type==='ok'?'✅':'❌'} {overrideFeedback.msg}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:6, marginTop:12 }}>
            {tabBtn('admission', 'Admission', '🎓')}
            {tabBtn('flat',      'Monthly Flat Fee', '📅')}
            {tabBtn('course',    'Course Fee', '📚')}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

          {error && (
            <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'#b91c1c', fontWeight:600 }}>❌ {error}</span>
              <button type="button" onClick={() => setError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#b91c1c', fontSize:16 }}>×</button>
            </div>
          )}

          {saved && (
            <div style={{ background:'#ecfdf5', border:'1.5px solid #6ee7b7', borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ fontWeight:800, color:'#065f46', fontSize:15, marginBottom:6 }}>✅ Payment recorded & receipt printed!</div>
              <div style={{ fontSize:12, color:'#047857', lineHeight:1.8 }}>
                <div><strong>Receipt:</strong> {saved.rcpt}</div>
                <div><strong>Items:</strong> {saved.items}</div>
                <div><strong>Amount:</strong> ₹{fmt(saved.total)}</div>
              </div>
              <button type="button" onClick={() => { setSaved(null); setSelected({}); setFlatSel({}) }}
                style={{ marginTop:10, padding:'6px 14px', borderRadius:7, border:'none', background:'#059669', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                + Collect More
              </button>
            </div>
          )}

          {/* ── Admission tab ── */}
          {tab === 'admission' && (
            <div>
              {isRepeater ? (
                <div style={{ background:'#fef3c7', border:'1.5px solid #fcd34d', borderRadius:12, padding:'18px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>🔁</div>
                  <div style={{ fontWeight:800, color:'#92400e', fontSize:14, marginBottom:4 }}>Admission Fee Waived — Repeater</div>
                  <div style={{ fontSize:12, color:'#92400e', opacity:.85 }}>
                    This student is marked as a repeater, so Admission Fee, Dress Fee, and Prospectus Fee
                    are not charged. Collect their dues from the <strong>Flat</strong> or <strong>Course</strong> tab instead.
                  </div>
                </div>
              ) : (
                <>
                  <PaidSummaryBar paid={admPaidCount} unpaid={FEE_ITEMS.length - admPaidCount} loading={loadingAdm} />
                  <div style={{ fontSize:11, fontWeight:700, color:C.slate[400], textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Select fee items</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
                    {FEE_ITEMS.map(fee => {
                      const paid = isAdmItemPaid(fee.label)
                      return (
                        <div key={fee.id} onClick={() => !paid && setSelected(p => ({ ...p, [fee.id]: !p[fee.id] }))}
                          style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:paid?'default':'pointer', border:`1.5px solid ${paid?'#6ee7b7':selected[fee.id]?fee.color:C.slate[200]}`, background:paid?'#f0fdf4':selected[fee.id]?fee.color+'12':'white', opacity:paid?.8:1, transition:'all .15s' }}>
                          <div style={{ fontSize:20 }}>{fee.icon}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:13, color:C.slate[900] }}>{fee.label}</div>
                            <div style={{ fontSize:11, color:paid?C.emerald:C.slate[400] }}>{paid?'Already collected':`Standard: ₹${fmt(fee.amount).replace('₹','')}`}</div>
                          </div>
                          {!paid && (
                            <input type="number" value={customAmts[fee.id] ?? fee.amount}
                              onChange={e => { e.stopPropagation(); setCustomAmts(p => ({ ...p, [fee.id]: e.target.value })) }}
                              onClick={e => e.stopPropagation()}
                              style={{ ...inp, width:100, textAlign:'right', fontWeight:700, color:fee.color, borderColor:selected[fee.id]?fee.color:C.slate[200] }} />
                          )}
                          {paid ? <PaidBadge /> : (
                            <div style={{ width:20, height:20, borderRadius:5, flexShrink:0, border:`2px solid ${selected[fee.id]?fee.color:C.slate[300]}`, background:selected[fee.id]?fee.color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {selected[fee.id] && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {admTotal > 0 && (
                <div style={{ background:C.slate[50], borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.slate[500] }}>Total</span>
                  <span style={{ fontSize:18, fontWeight:800, color:C.navy }}>{fmt(admTotal)}</span>
                </div>
              )}
              {!loadingAdm && allAdmPaid && (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #6ee7b7', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.emerald }}>✅ All admission fees collected</div>
                </div>
              )}
            </div>
          )}

          {/* ── Flat fee tab ── */}
          {tab === 'flat' && (
            <div>
              <div style={{ background: hasOverride ? '#faf5ff' : '#f0fdf4', border:`1px solid ${hasOverride ? '#c4b5fd' : '#bbf7d0'}`, borderRadius:9, padding:'10px 14px', marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color: hasOverride ? C.violet : C.emerald, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                  Monthly Flat Fee — {hostelType} · {course} {batch}
                  {hasOverride && <span style={{ fontSize:9, fontWeight:800, background:'#ede9fe', color:C.violet, padding:'1px 6px', borderRadius:4, border:'1px solid #c4b5fd' }}>CUSTOM RATE</span>}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color: hasOverride ? C.violet : C.emerald }}>
                  {ratesLoading ? '⏳' : `₹${fmt(feeRates.flatFee).replace('₹','')}`}
                  <span style={{ fontSize:13, fontWeight:500, color: hasOverride ? '#6d28d9' : '#047857' }}> per month</span>
                </div>
                {hasOverride && (
                  <div style={{ fontSize:11, color:'#6d28d9', marginTop:4 }}>
                    Standard rate overridden for this student.{' '}
                    <button type="button" onClick={() => { setOverrideMode(true); setTab('flat') }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:C.violet, fontWeight:700, fontSize:11, padding:0, textDecoration:'underline' }}>
                      Edit override ↑
                    </button>
                  </div>
                )}
              </div>
              <PaidSummaryBar paid={flatPaidCount} unpaid={flatFees.length - flatPaidCount} loading={loadingPaid} />
              <div style={{ fontSize:11, fontWeight:700, color:C.slate[400], textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Select months</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
                {flatFees.map(fee => {
                  const paid = isMonthPaid(fee)
                  const future = !paid && isFutureFeeMonth(fee.month, fee.year)
                  return (
                    <div key={fee.id} onClick={() => !paid && setFlatSel(p => ({ ...p, [fee.id]: !p[fee.id] }))}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:paid?'default':'pointer', border:`1.5px solid ${paid?'#6ee7b7':flatSel[fee.id]?C.emerald:C.slate[200]}`, background:paid?'#f0fdf4':flatSel[fee.id]?'#ecfdf5':'white', opacity:paid?.75:1, transition:'all .15s' }}>
                      <div style={{ fontSize:20 }}>📅</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:C.slate[900], display:'flex', alignItems:'center', gap:6 }}>
                          {fee.month} {fee.year}
                          {future && <span style={{ fontSize:9, fontWeight:800, color:'#991B1B', background:'#fef2f2', padding:'1px 6px', borderRadius:4, border:'1px solid #fca5a5' }}>ADVANCE</span>}
                        </div>
                        <div style={{ fontSize:11, color:paid?C.emerald:C.slate[400] }}>{paid ? 'Already paid' : `${hostelType} rate`}</div>
                      </div>
                      <span style={{ fontSize:15, fontWeight:800, color: hasOverride ? C.violet : C.emerald }}>{fmt(fee.amount)}</span>
                      {paid ? <PaidBadge /> : (
                        <div style={{ width:20, height:20, borderRadius:5, flexShrink:0, border:`2px solid ${flatSel[fee.id]?C.emerald:C.slate[300]}`, background:flatSel[fee.id]?C.emerald:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {flatSel[fee.id] && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {flatFees.some(f => flatSel[f.id] && !isMonthPaid(f) && isFutureFeeMonth(f.month, f.year)) && (
                flatAdvanceAuthorized ? (
                  <div style={{ background:'#f0f9ff', border:'1.5px solid #7dd3fc', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0369a1' }}>✅ Advance authorized — an admin has approved collecting the selected future month(s) now.</div>
                  </div>
                ) : (
                  <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#991B1B', marginBottom:8 }}>
                      ⛔ One or more selected months haven't started yet. This is an advance payment.
                    </div>
                    {isAdmin ? (
                      <button type="button" onClick={() => openAdvancePin('flat')}
                        style={{ fontSize:12, fontWeight:700, padding:'6px 14px', borderRadius:7, border:'none', background:'#991B1B', color:'white', cursor:'pointer' }}>
                        🔒 Authorize advance payment (PIN)
                      </button>
                    ) : (
                      <div style={{ fontSize:12, color:'#991B1B' }}>Only an admin can authorize an advance payment.</div>
                    )}
                  </div>
                )
              )}
              {flatTotal > 0 && (
                <div style={{ background:C.slate[50], borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.slate[500] }}>Total</span>
                  <span style={{ fontSize:18, fontWeight:800, color: hasOverride ? C.violet : C.emerald }}>{fmt(flatTotal)}</span>
                </div>
              )}
              {!loadingPaid && allFlatPaid && (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #6ee7b7', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.emerald }}>✅ All flat fees paid for this student</div>
                </div>
              )}
            </div>
          )}

          {/* ── Course fee tab ── */}
          {tab === 'course' && (
            <div>
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#1d4ed8' }}>
                <span style={{ fontWeight:700 }}>Rate basis:</span> {course} · {batch} · {hostelType} →{' '}
                {ratesLoading ? '⏳' : `₹${fmt(feeRates.courseFee).replace('₹','')}/month`}
                <span style={{ color:C.slate[400], marginLeft:8 }}>(change hostel type above to recalculate)</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>Course</label>
                  <input value={course||''} readOnly style={{ ...inp, background:C.slate[50], color:C.slate[500] }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>Batch</label>
                  <input value={batch||''} readOnly style={{ ...inp, background:C.slate[50], color:C.slate[500] }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>For month</label>
                  <select value={courseMonth} onChange={e => { setCourseMonth(e.target.value); setCourseAdvanceAuthorized(false) }} style={inp}>
                    {MONTHS_LIST.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>Year</label>
                  <select value={courseYear} onChange={e => { setCourseYear(Number(e.target.value)); setCourseAdvanceAuthorized(false) }} style={inp}>
                    {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>Amount (₹) — auto-filled, editable</label>
                  <input type="number" value={courseAmt} onChange={e => setCourseAmt(e.target.value)} style={{ ...inp, fontWeight:700, color:C.violet }} />
                </div>
              </div>
              {loadingCourse ? (
                <div style={{ fontSize:12, color:C.slate[400], marginBottom:12, padding:'8px 12px', background:C.slate[50], borderRadius:8 }}>⏳ Checking payment history…</div>
              ) : courseMonthPaid ? (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #6ee7b7', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.emerald }}>✅ Already paid — {courseMonth} {courseYear}</div>
                </div>
              ) : (
                <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.amber }}>⚠️ Not yet paid — {courseMonth} {courseYear}</div>
                </div>
              )}
              {!courseMonthPaid && isFutureFeeMonth(courseMonth, courseYear) && (
                courseAdvanceAuthorized ? (
                  <div style={{ background:'#f0f9ff', border:'1.5px solid #7dd3fc', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0369a1' }}>✅ Advance authorized — {courseMonth} {courseYear} hasn't started yet, but an admin has approved collecting it now.</div>
                  </div>
                ) : (
                  <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#991B1B', marginBottom:8 }}>
                      ⛔ {courseMonth} {courseYear} hasn't started yet. This is an advance payment.
                    </div>
                    {isAdmin ? (
                      <button type="button" onClick={() => openAdvancePin('course')}
                        style={{ fontSize:12, fontWeight:700, padding:'6px 14px', borderRadius:7, border:'none', background:'#991B1B', color:'white', cursor:'pointer' }}>
                        🔒 Authorize advance payment (PIN)
                      </button>
                    ) : (
                      <div style={{ fontSize:12, color:'#991B1B' }}>Only an admin can authorize an advance payment.</div>
                    )}
                  </div>
                )
              )}
              {paidCourseMonths.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.slate[400], textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Previously paid</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {paidCourseMonths.map(key => {
                      const [m, y] = key.split('_')
                      return <span key={key} style={{ fontSize:11, fontWeight:700, color:C.emerald, background:'#dcfce7', padding:'3px 10px', borderRadius:6 }}>✓ {m} {y}</span>
                    })}
                  </div>
                </div>
              )}
              <div style={{ background:C.slate[50], borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.slate[500] }}>Total</span>
                <span style={{ fontSize:18, fontWeight:800, color:C.violet }}>{fmt(courseAmt)}</span>
              </div>
            </div>
          )}

          {/* ── Payment details ── */}
          <div style={{ borderTop:`1px solid ${C.slate[100]}`, paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.slate[400], textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Payment details</div>

            {/* Cash / UPI quick toggle — the two modes staff actually use for
                in-person collection get a dedicated, clearly distinct look.
                Cheque / Bank Transfer / DD / Other remain available via the
                dropdown below for the less common cases. */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {['Cash','UPI'].map(m => (
                <button key={m} type="button" onClick={() => setPayMode(m)}
                  style={{
                    flex:1, padding:'10px 14px', borderRadius:10, cursor:'pointer',
                    border: payMode===m ? `2px solid ${m==='Cash'?C.emerald:C.violet}` : `1.5px solid ${C.slate[200]}`,
                    background: payMode===m ? (m==='Cash'?'#ecfdf5':'#f5f3ff') : 'white',
                    color: payMode===m ? (m==='Cash'?C.emerald:C.violet) : C.slate[500],
                    fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}>
                  {m==='Cash' ? '💵' : '📲'} {m}
                </button>
              ))}
              <select value={PAY_MODES.includes(payMode) && !['Cash','UPI'].includes(payMode) ? payMode : ''} onChange={e => e.target.value && setPayMode(e.target.value)}
                style={{ ...inp, width:120, color: !['Cash','UPI'].includes(payMode) ? C.slate[900] : C.slate[400] }}>
                <option value="">Other mode…</option>
                {PAY_MODES.filter(m => !['Cash','UPI'].includes(m)).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>Payment date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color: payMode==='UPI' && !txnRef ? C.red : C.slate[500], display:'block', marginBottom:5 }}>
                  {payMode==='UPI' ? 'UPI Txn / UTR No.' : payMode==='Cash' ? 'Reference (optional)' : 'Txn ref'}
                  {payMode==='UPI' && ' *required'}
                </label>
                <input value={txnRef} onChange={e => setTxnRef(e.target.value)}
                  placeholder={payMode==='UPI' ? 'e.g. 402812345678' : 'Optional'}
                  style={{ ...inp, border: payMode==='UPI' && !txnRef ? `1.5px solid ${C.red}` : inp.border }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.slate[500], display:'block', marginBottom:5 }}>
                  Collected by
                  {(currentUser?.userName || currentUser?.name) && collectedBy === (currentUser?.userName || currentUser?.name) && (
                    <span style={{ color:C.emerald, fontWeight:700 }}> ✓ verified</span>
                  )}
                </label>
                <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Staff name" style={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {(() => {
          const upiMissingRef = payMode === 'UPI' && !txnRef.trim()
          const courseFuture = !courseMonthPaid && isFutureFeeMonth(courseMonth, courseYear)
          const courseFutureBlocked = courseFuture && (!isAdmin || !courseAdvanceAuthorized)
          const flatFutureBlocked = flatFees.some(f => flatSel[f.id] && !isMonthPaid(f) && isFutureFeeMonth(f.month, f.year)) && (!isAdmin || !flatAdvanceAuthorized)
          const blocked = saving || !admissionDate || upiMissingRef
            || (tab==='flat' && (allFlatPaid || flatFutureBlocked)) || (tab==='admission' && (allAdmPaid||isRepeater))
            || (tab==='course' && (courseMonthPaid || courseFutureBlocked)) || ratesLoading
          const label = saving ? '⏳ Saving…'
            : !admissionDate ? '⚠️ Set Admission Date First'
            : upiMissingRef ? '⚠️ Enter UPI Txn / UTR No.'
            : (tab==='course' && courseFutureBlocked) ? '⛔ Authorize Advance First'
            : (tab==='flat' && flatFutureBlocked) ? '⛔ Authorize Advance First'
            : ratesLoading ? '⏳ Loading…'
            : '🖨️ Record & Print Receipt'
          return (
        <div style={{ padding:'14px 22px', borderTop:`1px solid ${C.slate[100]}`, background:C.slate[50], display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={handleClose} style={{ padding:'9px 20px', borderRadius:9, border:`1px solid ${C.slate[200]}`, background:'white', fontSize:13, fontWeight:600, cursor:'pointer', color:C.slate[500] }}>Close</button>
          <button type="button"
            onClick={tab==='admission'?saveAdmission:tab==='flat'?saveFlat:saveCourse}
            disabled={blocked}
            style={{ padding:'9px 24px', borderRadius:9, border:'none', fontSize:13, fontWeight:700,
              cursor: blocked ? 'not-allowed' : 'pointer',
              background: blocked ? C.slate[400] : `linear-gradient(135deg,${C.navy},${C.indigo})`,
              color:'white', opacity: blocked ? .7 : 1 }}>
            {label}
          </button>
        </div>
          )
        })()}
      </div>

      {/* Advance-payment PIN dialog — separate confirm step required at the
          moment of collection, only reachable by admins (the button that
          opens this is itself gated on isAdmin above). */}
      {advancePinOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,17,26,.55)', zIndex:1000000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setAdvancePinOpen(false)}>
          <div style={{ width:'min(340px,90vw)', background:'white', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,.3)', padding:'22px 24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:800, color:C.slate[900], marginBottom:4 }}>🔒 Authorize Advance Payment</div>
            <div style={{ fontSize:12, color:C.slate[500], marginBottom:16 }}>Enter the admin PIN to confirm this payment is intentionally for a future month.</div>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={advancePinValue}
              onChange={e => { setAdvancePinValue(e.target.value); setAdvancePinError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmAdvancePin()}
              placeholder="Admin PIN"
              style={{ ...inp, textAlign:'center', letterSpacing:'.3em', fontWeight:700, marginBottom:8 }}
            />
            {advancePinError && <div style={{ fontSize:12, color:C.red, fontWeight:600, marginBottom:8 }}>{advancePinError}</div>}
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button type="button" onClick={() => setAdvancePinOpen(false)}
                style={{ flex:1, padding:'9px 0', borderRadius:9, border:`1px solid ${C.slate[200]}`, background:'white', fontSize:13, fontWeight:600, cursor:'pointer', color:C.slate[500] }}>
                Cancel
              </button>
              <button type="button" onClick={confirmAdvancePin}
                style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', background:'#991B1B', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
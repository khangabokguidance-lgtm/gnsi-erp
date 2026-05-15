// FeeCollectionModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Fee collection modal — opened from Admissions.jsx and Students.jsx.
//  Writes to: adm_fee_collections, adm_flat_fees, adm_course_fees, accounts.
//
//  ✅ Added: paid/unpaid indicators on ALL three tabs (admission, flat, course)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  upsertAccount, printReceipt,
  FLAT_FEES, CURRENT_YEAR, PAY_MODES, MONTHS_LIST,
  getCourseFeeAmt, checkCourseFeeExists,
} from './shared/feeHelpers'

// ─── Fee Structure ────────────────────────────────────────────────────────────

const FEE_ITEMS = [
  { id: 'admission',  label: 'Admission Fee',  amount: 6000, type: 'admission', icon: '🎓', color: '#4f46e5' },
  { id: 'dress',      label: 'Dress Fee',       amount: 3000, type: 'item',      icon: '👕', color: '#0891b2' },
  { id: 'prospectus', label: 'Prospectus Fee',  amount: 200,  type: 'item',      icon: '📖', color: '#7c3aed' },
]

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  navy:    '#1e3a5f',
  indigo:  '#4f46e5',
  emerald: '#059669',
  violet:  '#7c3aed',
  amber:   '#d97706',
  slate: {
    50:  '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    400: '#94a3b8', 500: '#64748b', 700: '#334155', 900: '#0f172a',
  },
}

const inp = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit', background: 'white',
}

// ─── Paid Badge ───────────────────────────────────────────────────────────────

const PaidBadge = () => (
  <span style={{
    fontSize: 10, fontWeight: 800, color: C.emerald,
    background: '#dcfce7', padding: '3px 8px',
    borderRadius: 6, flexShrink: 0, letterSpacing: '.04em',
  }}>
    ✓ PAID
  </span>
)

const UnpaidBadge = () => (
  <span style={{
    fontSize: 10, fontWeight: 800, color: '#b45309',
    background: '#fef3c7', padding: '3px 8px',
    borderRadius: 6, flexShrink: 0, letterSpacing: '.04em',
  }}>
    UNPAID
  </span>
)

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function PaidSummaryBar({ paid, unpaid, loading }) {
  if (loading) return (
    <div style={{ fontSize: 12, color: C.slate[400], marginBottom: 12, padding: '8px 12px', background: C.slate[50], borderRadius: 8 }}>
      ⏳ Checking payment history…
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.emerald }}>{paid}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: '.06em' }}>Paid</div>
      </div>
      <div style={{ flex: 1, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{unpaid}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '.06em' }}>Unpaid</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeeCollectionModal({ app, student, onClose, onSaved }) {

  // Resolve student identity
  const gcc        = gccStr(app?.gcc ?? app?.gcc_no ?? student?.gcc_no ?? '')
  const name       = app?.name       ?? app?.applicant_name ?? student?.name       ?? ''
  const course     = app?.course     ?? student?.course     ?? ''
  const batch      = app?.cls        ?? app?.batch          ?? student?.batch      ?? ''
  const admNo      = app?.admNo      ?? app?.adm_no         ?? student?.admission_no ?? ''
  const hostelType = app?.hostel === 'Yes' || app?.hostel_type === 'Boarder'
    ? 'Boarder'
    : student?.hostel_type || 'Day Scholar'

  const [tab,         setTab]         = useState('admission')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(null)
  const [payMode,     setPayMode]     = useState('Cash')
  const [txnRef,      setTxnRef]      = useState('')
  const [payDate,     setPayDate]     = useState(today())
  const [collectedBy, setCollectedBy] = useState('')

  // Admission tab
  const [selected,      setSelected]      = useState({})
  const [customAmts,    setCustomAmts]    = useState({})
  const [paidAdmItems,  setPaidAdmItems]  = useState([])   // ✅ NEW: tracks paid admission items
  const [loadingAdm,    setLoadingAdm]    = useState(false)

  // Flat fee tab
  const [flatSel,     setFlatSel]     = useState({})
  const [paidMonths,  setPaidMonths]  = useState([])
  const [loadingPaid, setLoadingPaid] = useState(false)

  // Course fee tab
  const [courseMonth,      setCourseMonth]      = useState(MONTHS_LIST[new Date().getMonth()])
  const [courseYear,       setCourseYear]        = useState(CURRENT_YEAR)
  const [courseAmt,        setCourseAmt]         = useState(getCourseFeeAmt(course, hostelType))
  const [paidCourseMonths, setPaidCourseMonths] = useState([])  // ✅ NEW: tracks paid course months
  const [loadingCourse,    setLoadingCourse]    = useState(false)

  // ── Load paid admission items ────────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingAdm(true)
    supabase
      .from('adm_fee_collections')
      .select('description')
      .eq('adm_app_id', gcc)
      .then(({ data, error }) => {
        if (!error && data) {
          setPaidAdmItems(data.map(r => r.description))
        }
        setLoadingAdm(false)
      })
  }, [gcc])

  // ── Load already-paid flat months ────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingPaid(true)
    supabase
      .from('adm_flat_fees')
      .select('month, year')
      .eq('adm_app_id', gcc)
      .then(({ data, error }) => {
        if (!error && data) {
          // Deduplicate — only count each month once
          const unique = [...new Set(data.map(r => `${r.month}_${r.year}`))]
          setPaidMonths(unique)
        }
        setLoadingPaid(false)
      })
  }, [gcc])

  // ── Load paid course months ──────────────────────────────────────────────────
  useEffect(() => {
    if (!gcc) return
    setLoadingCourse(true)
    supabase
      .from('adm_course_fees')
      .select('for_month, year')
      .eq('adm_app_id', gcc)
      .then(({ data, error }) => {
        if (!error && data) {
          setPaidCourseMonths(data.map(r => `${r.for_month}_${r.year}`))
        }
        setLoadingCourse(false)
      })
  }, [gcc])

  const isAdmItemPaid  = label  => paidAdmItems.includes(label)
  const isMonthPaid    = fee    => paidMonths.includes(`${fee.month}_${fee.year}`)
  const isCourseMonthPaid = ()  => paidCourseMonths.includes(`${courseMonth}_${courseYear}`)

  // ── Totals ──────────────────────────────────────────────────────────────────
  const admTotal = FEE_ITEMS
    .filter(f => selected[f.id] && !isAdmItemPaid(f.label))
    .reduce((s, f) => s + (Number(customAmts[f.id]) || f.amount), 0)

  const flatTotal = FLAT_FEES
    .filter(f => flatSel[f.id] && !isMonthPaid(f))
    .reduce((s, f) => s + f.amount, 0)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleClose = () => typeof onClose === 'function' && onClose()
  const toggleFee   = id => setSelected(p => ({ ...p, [id]: !p[id] }))
  const toggleFlat  = id => setFlatSel(p => ({ ...p, [id]: !p[id] }))

  const commonReceiptFields = rcpt => ({
    receipt_no:   rcpt,
    pay_date:     payDate,
    pay_mode:     payMode,
    txn_ref:      txnRef   || null,
    collected_by: collectedBy || null,
    student_name: name,
    adm_no:       admNo   || null,
    gcc_no:       gcc,
    class_name:   batch   || null,
  })

  // ── Save: Admission fees ─────────────────────────────────────────────────────
  const saveAdmission = async () => {
    if (saving) return
    if (!gcc) return alert('Student GCC number is missing.')
    const items = FEE_ITEMS.filter(f => selected[f.id] && !isAdmItemPaid(f.label))
    if (!items.length) return alert('Select at least one unpaid fee item.')
    setSaving(true); setError(null)
    try {
      const rcpt  = rcptNo()
      const total = items.reduce((s, f) => s + (Number(customAmts[f.id]) || f.amount), 0)

      for (const item of items) {
        const amt = Number(customAmts[item.id]) || item.amount
        const { error: e } = await supabase.from('adm_fee_collections').insert({
          id:           `${rcpt}-${item.id}`,
          adm_app_id:   gcc,
          fee_type:     item.type,
          amount_paid:  amt,
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          description:  item.label,
          receipt_no:   rcpt,
          student_name: name,
          adm_no:       admNo  || null,
          class_name:   batch  || null,
          collected_by: collectedBy || null,
        })
        if (e) throw e
        setPaidAdmItems(p => [...new Set([...p, item.label])])
      }

      await upsertAccount({
        entry_date:   payDate,
        type:         'Income',
        category:     'Admission',
        amount:       total,
        payment_mode: payMode,
        note:         `Admission fees — ${name} (GCC-${gcc})`,
        source_ref:   `${gcc}_admission`,
        source_type:  'admission',
      })

      printReceipt({
        ...commonReceiptFields(rcpt),
        course,
        items: items.map(i => ({ label: i.label, amount: Number(customAmts[i.id]) || i.amount })),
        total,
      })

      setSaved({ rcpt, items: items.map(i => i.label).join(', '), total })
      setSelected({})
      onSaved?.()
    } catch (err) {
      console.error('saveAdmission:', err)
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save: Flat fees ──────────────────────────────────────────────────────────
  const saveFlat = async () => {
    if (saving) return
    if (!gcc) return alert('Student GCC number is missing.')
    const items = FLAT_FEES.filter(f => flatSel[f.id] && !isMonthPaid(f))
    if (!items.length) return alert('Select at least one unpaid month.')
    setSaving(true); setError(null)
    try {
      const rcpt = rcptNo()

      for (const item of items) {
        const { data: exists } = await supabase
          .from('adm_flat_fees')
          .select('id')
          .eq('adm_app_id', gcc)
          .eq('month', item.month)
          .eq('year', item.year)
          .maybeSingle()

        if (exists) {
          setPaidMonths(p => [...new Set([...p, `${item.month}_${item.year}`])])
          continue
        }

        const { error: e } = await supabase.from('adm_flat_fees').insert({
          id:           `${rcpt}-${item.id}`,
          adm_app_id:   gcc,
          month:        item.month,
          year:         item.year,
          amount:       item.amount,
          paid:         true,
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          receipt_no:   rcpt,
          student_name: name,
          adm_no:       admNo || null,
        })
        if (e) throw e

        const recId = `${gcc}_flat_${item.month.toLowerCase()}_${item.year}`
        await upsertAccount({
          entry_date:   payDate,
          type:         'Income',
          category:     'Hostel',
          amount:       item.amount,
          payment_mode: payMode,
          note:         `Flat fees — ${name} (GCC-${gcc}) · ${item.month} ${item.year}`,
          source_ref:   recId,
          source_type:  'flat_fee',
        })

        setPaidMonths(p => [...new Set([...p, `${item.month}_${item.year}`])])
      }

      printReceipt({
        ...commonReceiptFields(rcpt),
        course,
        items: items.map(i => ({ label: `${i.month} ${i.year} — Flat fee`, amount: i.amount })),
        total: items.reduce((s, i) => s + i.amount, 0),
      })

      setSaved({ rcpt, items: items.map(i => `${i.month} ${i.year}`).join(', '), total: flatTotal })
      setFlatSel({})
      onSaved?.()
    } catch (err) {
      console.error('saveFlat:', err)
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save: Course fee ─────────────────────────────────────────────────────────
  const saveCourse = async () => {
    if (saving) return
    if (!gcc) return alert('Student GCC number is missing.')
    const amt = Number(courseAmt)
    if (!amt || amt <= 0) return alert('Enter a valid amount.')
    if (isCourseMonthPaid()) {
      setError(`Course fee for ${courseMonth} ${courseYear} is already recorded.`)
      return
    }
    setSaving(true); setError(null)
    try {
      const alreadyPaid = await checkCourseFeeExists(gcc, courseMonth, courseYear)
      if (alreadyPaid) {
        setError(`Course fee for ${courseMonth} ${courseYear} already recorded.`)
        setPaidCourseMonths(p => [...new Set([...p, `${courseMonth}_${courseYear}`])])
        setSaving(false)
        return
      }

      const rcpt  = rcptNo()
      const recId = `${gcc}_course_${courseMonth.slice(0, 3).toLowerCase()}_${courseYear}`

      const { error: e } = await supabase.from('adm_course_fees').insert({
        id:           recId,
        adm_app_id:   gcc,
        course:       course  || '',
        batch:        batch   || '',
        for_month:    courseMonth,
        year:         courseYear,
        amount_paid:  amt,
        pay_date:     payDate,
        pay_mode:     payMode,
        txn_ref:      txnRef || null,
        receipt_no:   rcpt,
        student_name: name,
        adm_no:       admNo || null,
      })
      if (e) throw e

      await upsertAccount({
        entry_date:   payDate,
        type:         'Income',
        category:     'Fees',
        amount:       amt,
        payment_mode: payMode,
        note:         `Course fee (${courseMonth} ${courseYear}) — ${name} (GCC-${gcc})`,
        source_ref:   recId,
        source_type:  'course_fee',
      })

      printReceipt({
        ...commonReceiptFields(rcpt),
        course,
        items: [{ label: `Course fee — ${course} · ${courseMonth} ${courseYear}`, amount: amt }],
        total: amt,
      })

      setPaidCourseMonths(p => [...new Set([...p, `${courseMonth}_${courseYear}`])])
      setSaved({ rcpt, items: `${course} · ${courseMonth} ${courseYear}`, total: amt })
      onSaved?.()
    } catch (err) {
      console.error('saveCourse:', err)
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const tabBtn = (id, label, icon) => (
    <button
      type="button"
      onClick={() => { setTab(id); setSaved(null); setError(null) }}
      style={{
        flex: 1, padding: '10px 6px', borderRadius: 8, border: 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background: tab === id ? C.navy : C.slate[100],
        color:      tab === id ? 'white' : C.slate[500],
        transition: 'all .15s',
      }}
    >
      {icon} {label}
    </button>
  )

  const allAdmPaid = FEE_ITEMS.every(f => isAdmItemPaid(f.label))
  const allFlatPaid = FLAT_FEES.every(f => isMonthPaid(f))
  const courseMonthPaid = isCourseMonthPaid()

  // Counts for summary bars
  const admPaidCount   = FEE_ITEMS.filter(f => isAdmItemPaid(f.label)).length
  const admUnpaidCount = FEE_ITEMS.length - admPaidCount
  const flatPaidCount   = FLAT_FEES.filter(f => isMonthPaid(f)).length
  const flatUnpaidCount = FLAT_FEES.length - flatPaidCount

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,17,26,.75)',
        zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: 'min(560px,96vw)', background: 'white',
          borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,.25)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ height: 4, background: `linear-gradient(90deg,${C.navy},${C.indigo},${C.violet})` }} />

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${C.slate[100]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.slate[400], marginBottom: 4 }}>
                Fee Collection
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.slate[900] }}>{name || '—'}</div>
              <div style={{ fontSize: 12, color: C.slate[400], marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {gcc    && <span style={{ fontWeight: 700, color: C.navy }}>GCC-{gcc}</span>}
                {course && <span>{course}</span>}
                {batch  && <span>· {batch}</span>}
                {admNo  && <span style={{ color: C.indigo, fontWeight: 600 }}>{admNo}</span>}
              </div>
            </div>
            <button type="button" onClick={handleClose}
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: C.slate[50], cursor: 'pointer', fontSize: 18, color: C.slate[500], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ×
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {tabBtn('admission', 'Admission Fees', '🎓')}
            {tabBtn('flat',      'Flat Fees',      '📅')}
            {tabBtn('course',    'Course Fee',     '📚')}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {error && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>❌ {error}</span>
              <button type="button" onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}>×</button>
            </div>
          )}

          {saved && (
            <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: 15, marginBottom: 6 }}>✅ Payment recorded & receipt printed!</div>
              <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.8 }}>
                <div><strong>Receipt:</strong> {saved.rcpt}</div>
                <div><strong>Items:</strong> {saved.items}</div>
                <div><strong>Amount:</strong> ₹{fmt(saved.total)}</div>
              </div>
              <button type="button"
                onClick={() => { setSaved(null); setSelected({}); setFlatSel({}) }}
                style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#059669', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Collect More
              </button>
            </div>
          )}

          {/* ── Admission tab ──────────────────────────────────────────────── */}
          {tab === 'admission' && (
            <div>
              {/* Summary bar */}
              <PaidSummaryBar paid={admPaidCount} unpaid={admUnpaidCount} loading={loadingAdm} />

              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Select fee items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {FEE_ITEMS.map(fee => {
                  const paid = isAdmItemPaid(fee.label)
                  return (
                    <div key={fee.id}
                      onClick={() => !paid && toggleFee(fee.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        cursor: paid ? 'default' : 'pointer',
                        border: `1.5px solid ${paid ? '#6ee7b7' : selected[fee.id] ? fee.color : C.slate[200]}`,
                        background: paid ? '#f0fdf4' : selected[fee.id] ? fee.color + '12' : 'white',
                        opacity: paid ? 0.8 : 1,
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{fee.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900] }}>{fee.label}</div>
                        <div style={{ fontSize: 11, color: paid ? C.emerald : C.slate[400] }}>
                          {paid ? 'Already collected' : `Standard: ₹${fmt(fee.amount)}`}
                        </div>
                      </div>
                      {!paid && (
                        <input
                          type="number"
                          value={customAmts[fee.id] ?? fee.amount}
                          onChange={e => { e.stopPropagation(); setCustomAmts(p => ({ ...p, [fee.id]: e.target.value })) }}
                          onClick={e => e.stopPropagation()}
                          style={{ ...inp, width: 100, textAlign: 'right', fontWeight: 700, color: fee.color, borderColor: selected[fee.id] ? fee.color : C.slate[200] }}
                        />
                      )}
                      {paid ? (
                        <PaidBadge />
                      ) : (
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          border: `2px solid ${selected[fee.id] ? fee.color : C.slate[300]}`,
                          background: selected[fee.id] ? fee.color : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selected[fee.id] && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {admTotal > 0 && (
                <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>₹{fmt(admTotal)}</span>
                </div>
              )}

              {!loadingAdm && allAdmPaid && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>✅ All admission fees collected for this student</div>
                </div>
              )}
            </div>
          )}

          {/* ── Flat fee tab ───────────────────────────────────────────────── */}
          {tab === 'flat' && (
            <div>
              {/* Summary bar */}
              <PaidSummaryBar paid={flatPaidCount} unpaid={flatUnpaidCount} loading={loadingPaid} />

              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Select months
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {FLAT_FEES.map(fee => {
                  const paid = isMonthPaid(fee)
                  return (
                    <div key={fee.id}
                      onClick={() => !paid && toggleFlat(fee.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        cursor: paid ? 'default' : 'pointer',
                        border: `1.5px solid ${paid ? '#6ee7b7' : flatSel[fee.id] ? C.emerald : C.slate[200]}`,
                        background: paid ? '#f0fdf4' : flatSel[fee.id] ? '#ecfdf5' : 'white',
                        opacity: paid ? 0.75 : 1,
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>📅</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900] }}>{fee.month} {fee.year}</div>
                        <div style={{ fontSize: 11, color: paid ? C.emerald : C.slate[400] }}>
                          {paid ? 'Already paid' : 'Flat hostel fee'}
                        </div>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.emerald }}>₹{fmt(fee.amount)}</span>
                      {paid ? (
                        <PaidBadge />
                      ) : (
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          border: `2px solid ${flatSel[fee.id] ? C.emerald : C.slate[300]}`,
                          background: flatSel[fee.id] ? C.emerald : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {flatSel[fee.id] && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {flatTotal > 0 && (
                <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.emerald }}>₹{fmt(flatTotal)}</span>
                </div>
              )}
              {!loadingPaid && allFlatPaid && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>✅ All flat fees paid for this student</div>
                </div>
              )}
            </div>
          )}

          {/* ── Course fee tab ─────────────────────────────────────────────── */}
          {tab === 'course' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Course fee details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Course</label>
                  <input value={course || ''} readOnly style={{ ...inp, background: C.slate[50], color: C.slate[500] }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Batch</label>
                  <input value={batch || ''} readOnly style={{ ...inp, background: C.slate[50], color: C.slate[500] }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>For month</label>
                  <select value={courseMonth} onChange={e => setCourseMonth(e.target.value)} style={inp}>
                    {MONTHS_LIST.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Year</label>
                  <select value={courseYear} onChange={e => setCourseYear(Number(e.target.value))} style={inp}>
                    {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Amount (₹)</label>
                  <input type="number" value={courseAmt} onChange={e => setCourseAmt(e.target.value)}
                    style={{ ...inp, fontWeight: 700, color: C.violet }} />
                </div>
              </div>

              {/* ✅ Course month paid/unpaid indicator */}
              {loadingCourse ? (
                <div style={{ fontSize: 12, color: C.slate[400], marginBottom: 12, padding: '8px 12px', background: C.slate[50], borderRadius: 8 }}>
                  ⏳ Checking payment history…
                </div>
              ) : courseMonthPaid ? (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>Course fee already paid</div>
                    <div style={{ fontSize: 11, color: C.emerald, marginTop: 2 }}>{courseMonth} {courseYear} has been recorded. Select a different month.</div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>Not yet paid</div>
                    <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>{courseMonth} {courseYear} course fee has not been collected.</div>
                  </div>
                </div>
              )}

              {/* Paid course months list */}
              {paidCourseMonths.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                    Previously paid months
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {paidCourseMonths.map(key => {
                      const [m, y] = key.split('_')
                      return (
                        <span key={key} style={{ fontSize: 11, fontWeight: 700, color: C.emerald, background: '#dcfce7', padding: '3px 10px', borderRadius: 6 }}>
                          ✓ {m} {y}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.violet }}>₹{fmt(courseAmt)}</span>
              </div>
            </div>
          )}

          {/* ── Payment details ────────────────────────────────────────────── */}
          <div style={{ borderTop: `1px solid ${C.slate[100]}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Payment details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Payment mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Txn ref / Cheque no.</label>
                <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="Optional" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Collected by</label>
                <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Staff name" style={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.slate[100]}`, background: C.slate[50], display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClose}
            style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.slate[500] }}>
            Close
          </button>
          <button
            type="button"
            onClick={tab === 'admission' ? saveAdmission : tab === 'flat' ? saveFlat : saveCourse}
            disabled={
              saving ||
              (tab === 'flat' && allFlatPaid) ||
              (tab === 'admission' && allAdmPaid) ||
              (tab === 'course' && courseMonthPaid)
            }
            style={{
              padding: '9px 24px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: 700,
              cursor: (saving || (tab === 'flat' && allFlatPaid) || (tab === 'admission' && allAdmPaid) || (tab === 'course' && courseMonthPaid))
                ? 'not-allowed' : 'pointer',
              background: (saving || (tab === 'flat' && allFlatPaid) || (tab === 'admission' && allAdmPaid) || (tab === 'course' && courseMonthPaid))
                ? C.slate[400]
                : `linear-gradient(135deg,${C.navy},${C.indigo})`,
              color: 'white',
              boxShadow: saving ? 'none' : '0 4px 12px rgba(79,70,229,.3)',
              opacity: (saving || (tab === 'flat' && allFlatPaid) || (tab === 'admission' && allAdmPaid) || (tab === 'course' && courseMonthPaid)) ? 0.7 : 1,
            }}
          >
            {saving ? '⏳ Saving…' : '🖨️ Record & Print Receipt'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
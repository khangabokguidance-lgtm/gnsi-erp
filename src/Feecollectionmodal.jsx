import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'

// ─── Fee Structure ─────────────────────────────────────────────
const FEE_ITEMS = [
  { id: 'admission',  label: 'Admission Fee',  amount: 6000, type: 'admission', icon: '🎓', color: '#4f46e5' },
  { id: 'dress',      label: 'Dress Fee',       amount: 3000, type: 'item',      icon: '👕', color: '#0891b2' },
  { id: 'prospectus', label: 'Prospectus Fee',  amount: 200,  type: 'item',      icon: '📖', color: '#7c3aed' },
]

const FLAT_FEES = [
  { id: 'feb', month: 'February', amount: 5500, year: new Date().getFullYear() },
  { id: 'mar', month: 'March',    amount: 5500, year: new Date().getFullYear() },
]

const COURSE_FEES = {
  Sainik:            { Boarder: 6000, 'Day Scholar': 2500, 'Day Boarder': 4500 },
  Navodaya:          { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  Foundation:        { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  'Combined Course': { Boarder: 6500, 'Day Scholar': 3000, 'Day Boarder': 4500 },
}

const getCourseFeeAmt = (course, hostelType) => {
  const c = Object.keys(COURSE_FEES).find(k =>
    course?.toLowerCase().includes(k.toLowerCase())
  ) || course
  const h = hostelType === 'Hostel'
    ? 'Boarder'
    : hostelType === 'Day Scholar'
    ? 'Day Scholar'
    : hostelType || 'Day Scholar'
  return COURSE_FEES[c]?.[h] || COURSE_FEES[c]?.['Day Scholar'] || 2000
}

const MONTHS_LIST = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const PAY_MODES = ['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'DD']

const fmt    = n  => Number(n || 0).toLocaleString('en-IN')
const rcptNo = () => 'GNSI-' + Date.now().toString(36).toUpperCase()
const today  = () => new Date().toISOString().split('T')[0]

// ─── Colors & Styles ───────────────────────────────────────────
const C = {
  navy:    '#1e3a5f',
  indigo:  '#4f46e5',
  emerald: '#059669',
  violet:  '#7c3aed',
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

// ─── Main Modal ────────────────────────────────────────────────
export default function FeeCollectionModal({ app, student, onClose, onSaved }) {

  // ── Derive student info from either app or student prop ──────
  const gcc        = app?.gcc        || student?.gcc_no
  const name       = app?.name       || student?.name
  const course     = app?.course     || student?.course
  const batch      = app?.cls        || student?.batch
  const admNo      = app?.admNo      || student?.admission_no
  const appId      = app
    ? String(app.gcc ?? app.id ?? '')
    : String(student?.gcc_no ?? '')
  const hostelType = app?.hostel === 'Yes'
    ? 'Boarder'
    : app?.hostel === 'No'
    ? 'Day Scholar'
    : (student?.hostel_type || 'Day Scholar')

  // ── State ────────────────────────────────────────────────────
  const [tab,         setTab]         = useState('admission')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(null)
  const [payMode,     setPayMode]     = useState('Cash')
  const [txnRef,      setTxnRef]      = useState('')
  const [payDate,     setPayDate]     = useState(today())
  const [collectedBy, setCollectedBy] = useState('')
  const [selected,    setSelected]    = useState({})
  const [customAmts,  setCustomAmts]  = useState({})
  const [flatSel,     setFlatSel]     = useState({})
  const [courseMonth, setCourseMonth] = useState(MONTHS_LIST[new Date().getMonth()])
  const [courseAmt,   setCourseAmt]   = useState(getCourseFeeAmt(course, hostelType))

  const toggleFee  = id => setSelected(p => ({ ...p, [id]: !p[id] }))
  const toggleFlat = id => setFlatSel(p => ({ ...p, [id]: !p[id] }))

  const admTotal  = FEE_ITEMS
    .filter(f => selected[f.id])
    .reduce((s, f) => s + (Number(customAmts[f.id]) || f.amount), 0)

  const flatTotal = FLAT_FEES
    .filter(f => flatSel[f.id])
    .reduce((s, f) => s + f.amount, 0)

  // ── Safe close ───────────────────────────────────────────────
  const handleClose = () => {
    if (typeof onClose === 'function') onClose()
  }

  // ── Save Admission Fees ──────────────────────────────────────
  const saveAdmission = async () => {
    if (!appId || appId === 'undefined' || appId === '')
      return alert('Student GCC number is missing. Cannot save.')
    const items = FEE_ITEMS.filter(f => selected[f.id])
    if (!items.length) return alert('Please select at least one fee item.')
    setSaving(true)
    setError(null)
    try {
      const rcpt = rcptNo()
      for (const item of items) {
        const amt = Number(customAmts[item.id]) || item.amount
        const { error: e } = await supabase.from('adm_fee_collections').insert({
          id:           `${rcpt}-${item.id}`,
          adm_app_id:   appId,
          fee_type:     item.type,
          amount_paid:  amt,
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          description:  item.label,
          receipt_no:   rcpt,
          student_name: name,
          adm_no:       admNo || null,
          class_name:   batch || null,
          collected_by: collectedBy || null,
        })
        if (e) throw e
      }
      const { error: accErr } = await supabase.from('accounts').insert({
        entry_date:   payDate,
        type:         'Income',
        category:     'Admission',
        amount:       admTotal,
        payment_mode: payMode,
        note:         `Admission fees — ${name} (GCC-${gcc})`,
        source_ref:   appId,
        source_type:  'admission',
      })
      if (accErr) throw accErr
      setSaved({ rcpt, items: items.map(i => i.label).join(', '), total: admTotal })
      onSaved?.()
    } catch (err) {
      console.error('saveAdmission:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save Flat Fees ───────────────────────────────────────────
  const saveFlat = async () => {
    const items = FLAT_FEES.filter(f => flatSel[f.id])
    if (!items.length) return alert('Please select at least one month.')
    setSaving(true)
    setError(null)
    try {
      const rcpt = rcptNo()
      for (const item of items) {
        const { error: e } = await supabase.from('adm_flat_fees').insert({
          id:           `${rcpt}-${item.id}`,
          adm_app_id:   appId,
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
      }
      const { error: accErr } = await supabase.from('accounts').insert({
        entry_date:   payDate,
        type:         'Income',
        category:     'Hostel',
        amount:       flatTotal,
        payment_mode: payMode,
        note:         `Flat fees — ${name} (GCC-${gcc})`,
        source_ref:   appId,
        source_type:  'flat',
      })
      if (accErr) throw accErr
      setSaved({ rcpt, items: items.map(i => `${i.month} ${i.year}`).join(', '), total: flatTotal })
      onSaved?.()
    } catch (err) {
      console.error('saveFlat:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save Course Fee ──────────────────────────────────────────
  const saveCourse = async () => {
    const amt = Number(courseAmt)
    if (!amt || amt <= 0) return alert('Please enter a valid amount.')
    setSaving(true)
    setError(null)
    try {
      const rcpt = rcptNo()
      const { error: e } = await supabase.from('adm_course_fees').insert({
        id:           rcpt,
        adm_app_id:   appId,
        course:       course  || '',
        batch:        batch   || '',
        for_month:    courseMonth,
        amount_paid:  amt,
        pay_date:     payDate,
        pay_mode:     payMode,
        txn_ref:      txnRef || null,
        receipt_no:   rcpt,
        student_name: name,
        adm_no:       admNo || null,
      })
      if (e) throw e
      const { error: accErr } = await supabase.from('accounts').insert({
        entry_date:   payDate,
        type:         'Income',
        category:     'Fees',
        amount:       amt,
        payment_mode: payMode,
        note:         `Course fee (${courseMonth}) — ${name} (GCC-${gcc})`,
        source_ref:   appId,
        source_type:  'course',
      })
      if (accErr) throw accErr
      setSaved({ rcpt, items: `${course} · ${courseMonth}`, total: amt })
      onSaved?.()
    } catch (err) {
      console.error('saveCourse:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Tab button ───────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────
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
        {/* Accent bar */}
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
            {/* ✅ X button — type="button" prevents form submit */}
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: `1px solid ${C.slate[200]}`,
                background: C.slate[50], cursor: 'pointer',
                fontSize: 18, color: C.slate[500],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {tabBtn('admission', 'Admission Fees', '🎓')}
            {tabBtn('flat',      'Flat Fees',      '📅')}
            {tabBtn('course',    'Course Fee',     '📚')}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* Error banner */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>❌ {error}</span>
              <button type="button" onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}>×</button>
            </div>
          )}

          {/* Success banner */}
          {saved && (
            <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: 15, marginBottom: 6 }}>✅ Payment Recorded!</div>
              <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.8 }}>
                <div><strong>Receipt:</strong> {saved.rcpt}</div>
                <div><strong>Items:</strong> {saved.items}</div>
                <div><strong>Amount:</strong> ₹{fmt(saved.total)}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSaved(null); setSelected({}); setFlatSel({}) }}
                style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#059669', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                + Collect More
              </button>
            </div>
          )}

          {/* ── Admission tab ── */}
          {tab === 'admission' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Select Fee Items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {FEE_ITEMS.map(fee => (
                  <div
                    key={fee.id}
                    onClick={() => toggleFee(fee.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${selected[fee.id] ? fee.color : C.slate[200]}`,
                      background: selected[fee.id] ? fee.color + '12' : 'white',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 20 }}>{fee.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900] }}>{fee.label}</div>
                      <div style={{ fontSize: 11, color: C.slate[400] }}>Standard: ₹{fmt(fee.amount)}</div>
                    </div>
                    <input
                      type="number"
                      value={customAmts[fee.id] ?? fee.amount}
                      onChange={e => { e.stopPropagation(); setCustomAmts(p => ({ ...p, [fee.id]: e.target.value })) }}
                      onClick={e => e.stopPropagation()}
                      style={{ ...inp, width: 100, textAlign: 'right', fontWeight: 700, color: fee.color, borderColor: selected[fee.id] ? fee.color : C.slate[200] }}
                    />
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `2px solid ${selected[fee.id] ? fee.color : C.slate[300]}`,
                      background: selected[fee.id] ? fee.color : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {selected[fee.id] && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>
              {admTotal > 0 && (
                <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>₹{fmt(admTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Flat fee tab ── */}
          {tab === 'flat' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Select Months
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {FLAT_FEES.map(fee => (
                  <div
                    key={fee.id}
                    onClick={() => toggleFlat(fee.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${flatSel[fee.id] ? C.emerald : C.slate[200]}`,
                      background: flatSel[fee.id] ? '#ecfdf5' : 'white',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900] }}>{fee.month} {fee.year}</div>
                      <div style={{ fontSize: 11, color: C.slate[400] }}>Flat hostel fee</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.emerald }}>₹{fmt(fee.amount)}</span>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `2px solid ${flatSel[fee.id] ? C.emerald : C.slate[300]}`,
                      background: flatSel[fee.id] ? C.emerald : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {flatSel[fee.id] && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>
              {flatTotal > 0 && (
                <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.emerald }}>₹{fmt(flatTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Course fee tab ── */}
          {tab === 'course' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Course Fee Details
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
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>For Month</label>
                  <select value={courseMonth} onChange={e => setCourseMonth(e.target.value)} style={inp}>
                    {MONTHS_LIST.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Amount (₹)</label>
                  <input
                    type="number"
                    value={courseAmt}
                    onChange={e => setCourseAmt(e.target.value)}
                    style={{ ...inp, fontWeight: 700, color: C.violet }}
                  />
                </div>
              </div>
              <div style={{ background: C.slate[50], borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.slate[500] }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.violet }}>₹{fmt(courseAmt)}</span>
              </div>
            </div>
          )}

          {/* ── Payment Details (shared) ── */}
          <div style={{ borderTop: `1px solid ${C.slate[100]}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Payment Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Txn Ref / Cheque No.</label>
                <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="Optional" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.slate[500], display: 'block', marginBottom: 5 }}>Collected By</label>
                <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Staff name" style={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.slate[100]}`, background: C.slate[50], display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {/* ✅ Close button */}
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '9px 20px', borderRadius: 9,
              border: `1px solid ${C.slate[200]}`, background: 'white',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.slate[500],
            }}
          >
            Close
          </button>
          {/* ✅ Save button */}
          <button
            type="button"
            onClick={tab === 'admission' ? saveAdmission : tab === 'flat' ? saveFlat : saveCourse}
            disabled={saving}
            style={{
              padding: '9px 24px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? C.slate[400] : `linear-gradient(135deg,${C.navy},${C.indigo})`,
              color: 'white',
              boxShadow: saving ? 'none' : '0 4px 12px rgba(79,70,229,.3)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '⏳ Saving...' : '💾 Record Payment'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
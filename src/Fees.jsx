// Fees.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  ✅ Fixed: flat fees now vary by student hostel type via getFlatFees()
//  ✅ Fixed: flat fee list re-derives when student is selected
//  ✅ Fixed: stable source_refs via sourceRef helpers
//  ✅ Fixed: checkFlatFeeExists guard on flat fee saves
//  ✅ Fixed: uses unified printReceipt from feeHelpers
//  ✅ Fixed: upsertAccount dedup works correctly on retry
//  ✅ Fixed: course fee amount now auto-fills from getCourseFeeAmt(course, hostelType)
//  ✅ Fixed: COURSE_STRUCTURE subtypes still shown; amount re-calculates on subtype change
//  ✅ Fixed: payments now mirrored into fee_invoices so Fee Statement shows data
//  ✅ Fixed: session_year derived correctly (Apr–Mar academic year)
//  ✅ Fixed: fmt now includes ₹ symbol — no more double ₹ in UI
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  upsertAccount, checkCourseFeeExists, checkFlatFeeExists,
  printReceipt, sourceRef,
  getFlatFees, getFlatFeeAmt,
  getCourseFeeAmt,
  PAY_MODES, MONTHS_LIST, CURRENT_YEAR,
} from './shared/feeHelpers'

// ─── Session year helper ───────────────────────────────────────────────────
// April–March academic year: if current month >= April → "YYYY-YYYY+1"

const getSessionYear = () => {
  const yr = new Date().getFullYear()
  return new Date().getMonth() + 1 >= 4
    ? `${yr}-${yr + 1}`
    : `${yr - 1}-${yr}`
}

// ─── Fee constants ─────────────────────────────────────────────────────────

const DRESS_ITEMS = [
  { id: 'dk1', name: 'Aqua T-Shirt',     price: 450 },
  { id: 'dk2', name: 'Blue T-Shirt',     price: 450 },
  { id: 'dk3', name: 'Track Suit',       price: 900 },
  { id: 'dk4', name: 'Track Pant',       price: 600 },
  { id: 'dk5', name: 'Track Suit Set 2', price: 600 },
]

const COURSE_STRUCTURE = {
  Navodaya:          { subtypes: ['Lakshya', 'Umeed'] },
  Sainik:            { subtypes: ['Achiever', 'Leader', 'Champion'] },
  Foundation:        { subtypes: ['Elite', 'Prime'] },
  'Combined Course': { subtypes: [] },
}

const ADM_FEE_BASE   = 6000
const PROSPECTUS_FEE = 200

const inp = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box', backgroundColor: 'white',
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}

const sStyle = status => ({
  padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
  backgroundColor: status === 'Paid' ? '#dcfce7' : status === 'Partial' ? '#fef9c3' : '#fee2e2',
  color:           status === 'Paid' ? '#16a34a' : status === 'Partial' ? '#ca8a04' : '#dc2626',
})

// ─── Hostel type badge ───────────────────────────────────────────────────────

function HostelBadge({ type }) {
  if (!type) return null
  const s = {
    'Boarder':     { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Day Boarder': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Day Scholar': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  }[type] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  )
}

// ─── Student search ─────────────────────────────────────────────────────────

function StudentSearch({ students, onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const hits = q.length > 0
    ? students.filter(s =>
        (s.name || '').toLowerCase().includes(q.toLowerCase()) ||
        String(s.gcc_no || '').includes(q)
      ).slice(0, 8)
    : []
  return (
    <div style={{ position: 'relative' }}>
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder={placeholder || 'Type name or GCC No…'} style={inp} />
      {hits.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
          {hits.map(s => (
            <div key={s.id} onClick={() => { onSelect(s); setQ('') }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{s.name}</strong>
                <span style={{ color: '#64748b' }}>GCC-{s.gcc_no || '--'}</span>
                <span style={{ color: '#64748b' }}>{s.class_name || s.batch || '--'}</span>
                <span style={{ color: '#64748b' }}>{s.course || '--'}</span>
                {s.hostel_type && <HostelBadge type={s.hostel_type} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Fee Payment ───────────────────────────────────────────────────────

function FeePaymentTab({ students, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees, onRefresh }) {
  const [step,      setStep]      = useState('select')
  const [student,   setStudent]   = useState(null)
  const [admRec,    setAdmRec]    = useState(null)

  const [payMode,     setPayMode]     = useState('Cash')
  const [payDate,     setPayDate]     = useState(today())
  const [txnRef,      setTxnRef]      = useState('')
  const [collectedBy, setCollectedBy] = useState('Admin')
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)

  const [admFeeAmt,    setAdmFeeAmt]    = useState(ADM_FEE_BASE)
  const [dressChecked, setDressChecked] = useState(DRESS_ITEMS.map(() => true))
  const [prospChecked, setProspChecked] = useState(true)
  const [crsfRows,     setCrsfRows]     = useState([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
  const [advAmt,       setAdvAmt]       = useState('')
  const [advFor,       setAdvFor]       = useState('')

  const hostelType = student?.hostel_type || 'Day Scholar'
  const flatFees   = useMemo(() => getFlatFees(hostelType), [hostelType])
  const [flatChecked, setFlatChecked] = useState([])

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  const gcc = student ? gccStr(student.gcc_no) : null

  const myAdmCols  = gcc ? adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc) : []
  const myFlatRecs = gcc ? adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid) : []
  const myCrsfRecs = gcc ? adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc) : []

  const admPaid      = myAdmCols.some(c => c.fee_type === 'admission')
  const paidMonths   = myFlatRecs.map(r => r.month)
  const admEverPaid  = myAdmCols.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatEverPaid = myFlatRecs.reduce((s, r) => s + (r.amount || 0), 0)
  const crsfEverPaid = myCrsfRecs.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const totalEverPaid = admEverPaid + flatEverPaid + crsfEverPaid

  const dressTotal = DRESS_ITEMS.reduce((s, i, idx) => s + (dressChecked[idx] ? i.price : 0), 0)
  const admPkgThis = admPaid ? 0 : (admFeeAmt + dressTotal + (prospChecked ? PROSPECTUS_FEE : 0))

  const selFlat  = flatFees.filter((_, i) => flatChecked[i] && !paidMonths.includes(flatFees[i].month))
  const flatThis = selFlat.reduce((s, f) => s + f.amount, 0)
  const crsfThis = crsfRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const advThis  = Number(advAmt) || 0
  const grandThis = admPkgThis + flatThis + crsfThis + advThis

  const handleSelect = s => {
    setStudent(s)
    const rec = admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null
    setAdmRec(rec)

    const studentFlatFees = getFlatFees(s.hostel_type || 'Day Scholar')
    const paid = adm_flat_fees
      .filter(r => gccStr(r.adm_app_id) === gccStr(s.gcc_no) && r.paid)
      .map(r => r.month)
    setFlatChecked(studentFlatFees.map(ff => !paid.includes(ff.month)))

    const defaultCourse     = s.course && COURSE_STRUCTURE[s.course] ? s.course : ''
    const defaultHostelType = s.hostel_type || 'Day Scholar'
    setCrsfRows([{
      course:     defaultCourse,
      subtype:    '',
      hostelType: defaultHostelType,
      for_month:  '',
      amount:     defaultCourse ? getCourseFeeAmt(defaultCourse, defaultHostelType) : '',
    }])

    setStep('pay')
  }

  const handleBack = () => {
    setStep('select'); setStudent(null); setAdmRec(null)
    setAdmFeeAmt(ADM_FEE_BASE)
    setDressChecked(DRESS_ITEMS.map(() => true))
    setProspChecked(true)
    setFlatChecked([])
    setCrsfRows([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
    setAdvAmt(''); setAdvFor(''); setTxnRef('')
  }

  const updateCrsfRow = (i, field, value) => {
    setCrsfRows(rows => {
      const updated = [...rows]
      const row = { ...updated[i], [field]: value }

      if (field === 'course') {
        row.subtype = ''
        row.amount = value ? getCourseFeeAmt(value, row.hostelType || hostelType) : ''
      }
      if (field === 'hostelType') {
        if (row.course) row.amount = getCourseFeeAmt(row.course, value)
      }
      if (field === 'subtype') {
        if (row.course) row.amount = getCourseFeeAmt(row.course, row.hostelType || hostelType)
      }

      updated[i] = row
      return updated
    })
  }

  const handleSave = async () => {
    if (grandThis === 0)  { showToast('Select at least one fee item', '#dc2626'); return }
    if (!admRec)          { showToast('No admission record linked to this student', '#dc2626'); return }
    setSaving(true)

    const rNo           = rcptNo('INV')
    const insertedDress = []
    const insertedFlat  = []
    const insertedCrsf  = []

    try {
      // ── 1. Admission package ──────────────────────────────────────────────
      if (!admPaid && admFeeAmt > 0) {
        const { error: admErr } = await supabase.from('adm_fee_collections').insert({
          id:           `${rNo}-adm`,
          adm_app_id:   gcc,
          fee_type:     'admission',
          amount_paid:  admFeeAmt,
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          description:  'Admission Fee',
          receipt_no:   rNo,
          student_name: student.name,
          adm_no:       admRec.adm_no || '--',
          collected_by: collectedBy,
        })
        if (admErr) throw admErr

        await upsertAccount({
          entry_date: payDate, type: 'Income', category: 'Admission',
          amount: admFeeAmt, payment_mode: payMode,
          note: `${student.name} · Admission Fee · ${rNo}`,
          source_ref:  sourceRef.admission(gcc),
          source_type: 'adm_fee',
        })

        for (let i = 0; i < DRESS_ITEMS.length; i++) {
          if (!dressChecked[i]) continue
          const item = DRESS_ITEMS[i]
          insertedDress.push(item)
          const { error: dkErr } = await supabase.from('adm_fee_collections').insert({
            id:           `${rNo}-dk${i}`,
            adm_app_id:   gcc,
            fee_type:     'item',
            amount_paid:  item.price,
            pay_date:     payDate,
            pay_mode:     payMode,
            txn_ref:      txnRef || null,
            description:  'Dress Kit — ' + item.name,
            receipt_no:   rNo,
            student_name: student.name,
          })
          if (dkErr) throw dkErr

          await upsertAccount({
            entry_date: payDate, type: 'Income', category: 'Admission',
            amount: item.price, payment_mode: payMode,
            note: `${student.name} · ${item.name} · ${rNo}`,
            source_ref:  sourceRef.admItem(gcc, item.name),
            source_type: 'adm_fee',
          })
        }

        if (prospChecked) {
          insertedDress.push({ name: 'Prospectus', price: PROSPECTUS_FEE })
          const { error: pErr } = await supabase.from('adm_fee_collections').insert({
            id:           `${rNo}-prosp`,
            adm_app_id:   gcc,
            fee_type:     'item',
            amount_paid:  PROSPECTUS_FEE,
            pay_date:     payDate,
            pay_mode:     payMode,
            description:  'Prospectus',
            receipt_no:   rNo,
            student_name: student.name,
          })
          if (pErr) throw pErr

          await upsertAccount({
            entry_date: payDate, type: 'Income', category: 'Admission',
            amount: PROSPECTUS_FEE, payment_mode: payMode,
            note: `${student.name} · Prospectus · ${rNo}`,
            source_ref:  sourceRef.admItem(gcc, 'prospectus'),
            source_type: 'adm_fee',
          })
        }
      }

      // ── 2. Flat fees ──────────────────────────────────────────────────────
      for (const ff of selFlat) {
        const alreadyPaid = await checkFlatFeeExists(gcc, ff.month, ff.year)
        if (alreadyPaid) {
          showToast(`${ff.month} flat fee already recorded — skipped`, '#ca8a04')
          continue
        }

        const flatId = `${gcc}_flat_${ff.month.slice(0, 3).toLowerCase()}_${ff.year}`

        const { error: ffErr } = await supabase.from('adm_flat_fees').insert({
          id:           flatId,
          adm_app_id:   gcc,
          month:        ff.month,
          year:         ff.year,
          amount:       ff.amount,
          hostel_type:  hostelType,
          paid:         true,
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          receipt_no:   rNo,
          student_name: student.name,
          adm_no:       admRec.adm_no || '--',
        })
        if (ffErr) throw ffErr

        await upsertAccount({
          entry_date: payDate, type: 'Income', category: 'Hostel',
          amount: ff.amount, payment_mode: payMode,
          note: `${student.name} · ${ff.month} ${ff.year} Flat Fee [${hostelType}] · ${rNo}`,
          source_ref:  sourceRef.flatFee(gcc, ff.month, ff.year),
          source_type: 'flat_fee',
        })

        insertedFlat.push(ff)
      }

      // ── 3. Course fees ────────────────────────────────────────────────────
      for (let ci = 0; ci < crsfRows.length; ci++) {
        const cf = crsfRows[ci]
        if (!cf.course || !cf.for_month || !Number(cf.amount)) continue

        const alreadyPaid = await checkCourseFeeExists(gcc, cf.for_month, CURRENT_YEAR)
        if (alreadyPaid) {
          showToast(`Course fee for ${cf.for_month} already recorded — skipped`, '#ca8a04')
          continue
        }

        const recId = `${gcc}_course_${cf.for_month.slice(0, 3).toLowerCase()}_${CURRENT_YEAR}`

        const { error: cfErr } = await supabase.from('adm_course_fees').insert({
          id:           recId,
          adm_app_id:   gcc,
          course:       cf.course,
          subtype:      cf.subtype || '',
          hostel_type:  cf.hostelType || hostelType,
          for_month:    cf.for_month,
          year:         CURRENT_YEAR,
          amount_paid:  Number(cf.amount),
          pay_date:     payDate,
          pay_mode:     payMode,
          txn_ref:      txnRef || null,
          receipt_no:   rNo,
          student_name: student.name,
          adm_no:       admRec.adm_no || '--',
        })
        if (cfErr) throw cfErr

        await upsertAccount({
          entry_date: payDate, type: 'Income', category: 'Fees',
          amount: Number(cf.amount), payment_mode: payMode,
          note: `${student.name} · ${cf.course} ${cf.for_month} · ${rNo}`,
          source_ref:  sourceRef.courseFee(gcc, cf.for_month, CURRENT_YEAR),
          source_type: 'course_fee',
        })

        insertedCrsf.push({ ...cf, amount: Number(cf.amount) })
      }

      // ── 4. Advance ────────────────────────────────────────────────────────
      if (advThis > 0) {
        const advId = sourceRef.advance(gcc, Date.now())
        const { error: advErr } = await supabase.from('adm_fee_collections').insert({
          id:           advId,
          adm_app_id:   gcc,
          fee_type:     'advance',
          amount_paid:  advThis,
          advance_for:  advFor,
          pay_date:     payDate,
          pay_mode:     payMode,
          description:  'Advance — ' + advFor,
          receipt_no:   rNo,
          student_name: student.name,
        })
        if (advErr) throw advErr
      }

      // ── 5. Mirror into fee_invoices (fixes Fee Statement showing ₹0) ─────
      //
      //  The Fee Statement reads from fee_invoices exclusively.
      //  This block writes one invoice row per fee type per save,
      //  and updates existing rows on retry (idempotent via source_ref).
      //
      //  SQL to run once in Supabase:
      //    ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS source_ref text;
      //    CREATE UNIQUE INDEX IF NOT EXISTS fee_invoices_source_ref_idx
      //      ON fee_invoices(source_ref);
      try {
        const invoiceMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        const sessionYear  = getSessionYear()

        const feeTypes = [
          admPkgThis > 0 && { type: 'Admission',        amount: admPkgThis },
          flatThis    > 0 && { type: 'Monthly Flat Fee', amount: flatThis   },
          crsfThis    > 0 && { type: 'Course Fee',       amount: crsfThis   },
          advThis     > 0 && { type: 'Advance',          amount: advThis    },
        ].filter(Boolean)

        for (const ft of feeTypes) {
          const invRef = `${gcc}_${ft.type.toLowerCase().replace(/\s+/g, '_')}_${invoiceMonth}`

          const { data: existingInv } = await supabase
            .from('fee_invoices')
            .select('id, amount_paid, total_amount')
            .eq('source_ref', invRef)
            .maybeSingle()

          if (existingInv) {
            // Partial/retry — add to existing invoice
            const newPaid = parseFloat(existingInv.amount_paid || 0) + ft.amount
            await supabase.from('fee_invoices').update({
              amount_paid:     newPaid,
              amount_due:      0,
              status:          'Paid',
              last_payment_at: new Date().toISOString(),
            }).eq('id', existingInv.id)
          } else {
            // First time — create invoice row
            await supabase.from('fee_invoices').insert({
              source_ref:      invRef,
              student_id:      student.id,
              student_name:    student.name,
              gcc_no:          student.gcc_no,
              course:          student.course     || '',
              hostel_type:     hostelType,
              class_name:      student.class_name || student.batch || '',
              session_year:    sessionYear,
              invoice_month:   invoiceMonth,
              fee_type:        ft.type,
              base_amount:     ft.amount,
              discount_amount: 0,
              penalty_amount:  0,
              total_amount:    ft.amount,
              amount_paid:     ft.amount,
              amount_due:      0,
              due_date:        payDate,
              status:          'Paid',
              generated_at:    new Date().toISOString(),
              generated_by:    'collection',
              last_payment_at: new Date().toISOString(),
            })
          }
        }
      } catch (invErr) {
        // Don't block receipt — log only
        console.error('fee_invoices mirror failed:', invErr.message)
      }

      // ── 6. Print receipt ──────────────────────────────────────────────────
      const sections = []
      if (admPkgThis > 0) {
        const admItems = [{ label: 'Admission Fee', amount: admFeeAmt }]
        insertedDress.forEach(d => admItems.push({ label: d.name, amount: d.price }))
        sections.push({ title: 'Admission Package', color: '#4f46e5', items: admItems, subtotal: admPkgThis })
      }
      if (insertedFlat.length > 0) {
        sections.push({
          title: `Monthly Flat Fees — ${hostelType}`, color: '#059669',
          items: insertedFlat.map(f => ({ label: `${f.month} ${f.year} (${getFlatFeeAmt(hostelType).toLocaleString('en-IN')}/mo)`, amount: f.amount })),
          subtotal: insertedFlat.reduce((s, f) => s + f.amount, 0),
        })
      }
      if (insertedCrsf.length > 0) {
        sections.push({
          title: 'Course Fees', color: '#7c3aed',
          items: insertedCrsf.map(c => ({ label: `${c.course}${c.subtype ? ' · ' + c.subtype : ''} — ${c.for_month}`, amount: c.amount })),
          subtotal: insertedCrsf.reduce((s, c) => s + c.amount, 0),
        })
      }
      if (advThis > 0) {
        sections.push({ title: 'Advance', color: '#b45309', items: [{ label: advFor || 'Advance', amount: advThis }], subtotal: advThis })
      }

      printReceipt({
        receipt_no:   rNo,
        pay_date:     payDate,
        pay_mode:     payMode,
        txn_ref:      txnRef || null,
        collected_by: collectedBy,
        student_name: student.name,
        adm_no:       admRec.adm_no || '--',
        gcc_no:       student.gcc_no || '',
        class_name:   student.class_name || student.batch || '',
        course:       student.course || '',
        hostel_type:  hostelType,
        sections,
        items: [],
        total: grandThis,
      })

      showToast(`✅ Saved & invoice printed · ${rNo}`)
      onRefresh()
      setCrsfRows([{ course: '', subtype: '', hostelType: hostelType, for_month: '', amount: '' }])
      setAdvAmt(''); setAdvFor(''); setTxnRef('')
      const nowPaid = [...paidMonths, ...insertedFlat.map(f => f.month)]
      setFlatChecked(flatFees.map(ff => !nowPaid.includes(ff.month)))

    } catch (err) {
      showToast('Error: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  // ── Select screen ──────────────────────────────────────────────────────────
  if (step === 'select') return (
    <div style={{ maxWidth: 540, margin: '48px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>💳</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', marginBottom: 8 }}>Collect fee payment</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Search a student to record fees and generate a combined invoice</p>
      <StudentSearch students={students} onSelect={handleSelect} placeholder="Search student by name or GCC No…" />
    </div>
  )

  // ── Payment screen ─────────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${toast.color}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 320, color: '#1e293b' }}>
          {toast.msg}
        </div>
      )}

      {/* Student bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
          {(student.name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{student.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.gcc_no && <span style={{ fontWeight: 700, color: '#1e3a5f' }}>GCC-{student.gcc_no}</span>}
            {(student.class_name || student.batch) && <span>{student.class_name || student.batch}</span>}
            {student.course && <span>{student.course}</span>}
            {admRec?.adm_no && <span style={{ color: '#4f46e5', fontWeight: 600 }}>{admRec.adm_no}</span>}
            {hostelType && <HostelBadge type={hostelType} />}
            <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
              Flat fee: {getFlatFeeAmt(hostelType).toLocaleString('en-IN')}/mo
            </span>
            {totalEverPaid > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>{totalEverPaid.toLocaleString('en-IN')} prev. paid</span>}
          </div>
        </div>
        <button onClick={handleBack} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b' }}>← Change</button>
      </div>

      {!admRec && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ No admission record found for GCC-{student.gcc_no || '??'}. Create one in the Admissions module first.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Left: fee items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Admission package */}
          <div style={{ background: 'white', border: '1px solid #c7d2fe', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#eef2ff,#f5f3ff)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>🎓</span>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: '#3730a3' }}>Admission package</div>
              {admPaid && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>✓ Already paid</span>}
            </div>
            {admPaid ? (
              <div style={{ padding: '12px 16px' }}>
                {myAdmCols.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: '#475569' }}>
                    <span>{c.description || 'Fee'}</span>
                    <span style={{ fontWeight: 700 }}>{Number(c.amount_paid || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#3730a3', borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                  <span>Total paid</span><span>{admEverPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Admission fee (₹)</label>
                  <input type="number" value={admFeeAmt} onChange={e => setAdmFeeAmt(parseInt(e.target.value) || 0)} style={inp} />
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {DRESS_ITEMS.map((item, i) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: dressChecked[i] ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                      <input type="checkbox" checked={dressChecked[i]}
                        onChange={() => setDressChecked(d => { const n = [...d]; n[i] = !n[i]; return n })}
                        style={{ accentColor: '#4f46e5', width: 14, height: 14 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>₹{item.price.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: prospChecked ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                    <input type="checkbox" checked={prospChecked} onChange={e => setProspChecked(e.target.checked)} style={{ accentColor: '#4f46e5', width: 14, height: 14 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Prospectus</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>₹{PROSPECTUS_FEE.toLocaleString('en-IN')}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#3730a3', background: '#eef2ff', padding: '9px 12px', borderRadius: 8 }}>
                  <span>Package total</span><span>₹{admPkgThis.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Flat fees */}
          <div style={{ background: 'white', border: '1px solid #6ee7b7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#ecfdf5,#d1fae5)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#047857' }}>Monthly flat fees</div>
                <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                  {hostelType} rate · ₹{getFlatFeeAmt(hostelType).toLocaleString('en-IN')}/month
                </div>
              </div>
              {flatEverPaid > 0 && <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>₹{flatEverPaid.toLocaleString('en-IN')} paid</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {flatFees.map((ff, i) => {
                const paid = paidMonths.includes(ff.month)
                return (
                  <label key={ff.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < flatFees.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: paid ? 'default' : 'pointer' }}>
                    <input type="checkbox"
                      checked={paid || !!flatChecked[i]}
                      disabled={paid}
                      onChange={() => setFlatChecked(c => { const n = [...c]; n[i] = !n[i]; return n })}
                      style={{ accentColor: '#059669', width: 14, height: 14 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{ff.month} {ff.year}</div>
                      <div style={{ fontSize: 11, color: paid ? '#16a34a' : '#94a3b8', marginTop: 1 }}>
                        {paid ? '✅ Already collected' : `${hostelType} rate`}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: paid ? '#16a34a' : '#059669' }}>
                      ₹{ff.amount.toLocaleString('en-IN')}
                    </span>
                  </label>
                )
              })}
              {flatThis > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '9px 12px', borderRadius: 8, marginTop: 10 }}>
                  <span>Flat total</span>
                  <span>₹{flatThis.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Course fees */}
          <div style={{ background: 'white', border: '1px solid #c4b5fd', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#f5f3ff,#ede9fe)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>📚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#6d28d9' }}>Course fees</div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>
                  Select course + hostel type → amount auto-fills · editable
                </div>
              </div>
              {crsfEverPaid > 0 && <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>₹{crsfEverPaid.toLocaleString('en-IN')} prev.</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {myCrsfRecs.length > 0 && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f5f3ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Previous</div>
                  {myCrsfRecs.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}>
                      <span>{r.course}{r.subtype ? ' · ' + r.subtype : ''} · {r.for_month}</span>
                      <span style={{ fontWeight: 700, color: '#6d28d9' }}>₹{Number(r.amount_paid || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
              {crsfRows.map((row, i) => (
                <div key={i} style={{ border: '1px solid #ede9fe', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Course</label>
                      <select value={row.course}
                        onChange={e => updateCrsfRow(i, 'course', e.target.value)}
                        style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Select —</option>
                        {Object.keys(COURSE_STRUCTURE).map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Hostel Type</label>
                      <select value={row.hostelType}
                        onChange={e => updateCrsfRow(i, 'hostelType', e.target.value)}
                        style={{ ...inp, fontSize: 12, padding: '7px 10px', borderColor: row.hostelType ? '#a78bfa' : '#d1d5db', background: row.hostelType ? '#faf5ff' : 'white' }}>
                        <option value="">— Select —</option>
                        <option value="Boarder">Boarder</option>
                        <option value="Day Boarder">Day Boarder</option>
                        <option value="Day Scholar">Day Scholar</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Subtype</label>
                      {(COURSE_STRUCTURE[row.course]?.subtypes || []).length > 0
                        ? <select value={row.subtype}
                            onChange={e => updateCrsfRow(i, 'subtype', e.target.value)}
                            style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                            <option value="">—</option>
                            {COURSE_STRUCTURE[row.course].subtypes.map(s => <option key={s}>{s}</option>)}
                          </select>
                        : <input value={row.subtype}
                            onChange={e => updateCrsfRow(i, 'subtype', e.target.value)}
                            style={{ ...inp, fontSize: 12, padding: '7px 10px' }} placeholder="Optional" />
                      }
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Month</label>
                      <select value={row.for_month}
                        onChange={e => updateCrsfRow(i, 'for_month', e.target.value)}
                        style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Month —</option>
                        {MONTHS_LIST.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...lbl, fontSize: 11 }}>
                      Amount (₹)
                      {row.course && row.hostelType && (
                        <span style={{ fontWeight: 400, color: '#7c3aed', marginLeft: 6 }}>
                          · {row.hostelType} rate: ₹{getCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={row.amount || ''}
                      onChange={e => updateCrsfRow(i, 'amount', e.target.value)}
                      style={{
                        ...inp, fontSize: 12, padding: '7px 10px',
                        borderColor: row.course && row.hostelType && row.amount !== '' &&
                          Number(row.amount) !== getCourseFeeAmt(row.course, row.hostelType)
                          ? '#f59e0b' : '#d1d5db',
                      }}
                      placeholder={row.course && row.hostelType
                        ? `Auto: ₹${getCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}`
                        : 'Select course & hostel type first'}
                    />
                    {row.course && row.hostelType && row.amount !== '' &&
                      Number(row.amount) !== getCourseFeeAmt(row.course, row.hostelType) && (
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 3 }}>
                        ⚠ Overriding standard rate of ₹{getCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  {crsfRows.length > 1 && (
                    <button onClick={() => setCrsfRows(r => r.filter((_, j) => j !== i))}
                      style={{ fontSize: 11, color: '#dc2626', background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
                      ✕ Remove
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setCrsfRows(r => [...r, { course: '', subtype: '', hostelType: hostelType, for_month: '', amount: '' }])}
                style={{ fontSize: 12, color: '#6d28d9', background: '#f5f3ff', border: '1px dashed #c4b5fd', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, width: '100%' }}>
                + Add month
              </button>
            </div>
          </div>

          {/* Advance */}
          <div style={{ background: 'white', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#b45309', marginBottom: 10 }}>⮕ Advance fee (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ ...lbl, fontSize: 11 }}>Amount ₹</label>
                <input type="number" min={0} value={advAmt} onChange={e => setAdvAmt(e.target.value)} placeholder="0" style={{ ...inp, fontSize: 12, padding: '7px 10px' }} />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: 11 }}>For</label>
                <input value={advFor} onChange={e => setAdvFor(e.target.value)} placeholder="e.g. Phase I Month 1" style={{ ...inp, fontSize: 12, padding: '7px 10px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: payment + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1e3a5f', marginBottom: 14 }}>💳 Payment details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><label style={lbl}>Payment mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Date</label><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Transaction ref</label><input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="UPI / Cheque ref (optional)" style={inp} /></div>
              <div><label style={lbl}>Collected by</label><input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} style={inp} /></div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#1e3a5f', padding: '12px 16px', color: 'white', fontWeight: 800, fontSize: 14 }}>📋 This invoice</div>
            <div style={{ padding: '14px 16px' }}>
              {admPkgThis > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#3730a3' }}><span>🎓 Admission package</span><span style={{ fontWeight: 700 }}>₹{admPkgThis.toLocaleString('en-IN')}</span></div>}
              {flatThis   > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#047857' }}><span>📅 Flat fees ({hostelType})</span><span style={{ fontWeight: 700 }}>₹{flatThis.toLocaleString('en-IN')}</span></div>}
              {crsfThis   > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#6d28d9' }}><span>📚 Course fees</span><span style={{ fontWeight: 700 }}>₹{crsfThis.toLocaleString('en-IN')}</span></div>}
              {advThis    > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#b45309' }}><span>⮕ Advance</span><span style={{ fontWeight: 700 }}>₹{advThis.toLocaleString('en-IN')}</span></div>}
              {grandThis === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Select fee items on the left</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: 'white', background: 'linear-gradient(90deg,#1e3a5f,#3730a3)', padding: '12px 14px', borderRadius: 10, marginTop: 12 }}>
                <span>Grand total</span><span>₹{grandThis.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {totalEverPaid > 0 && (
            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#047857', marginBottom: 8 }}>✅ Previously collected</div>
              {admEverPaid  > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Admission + Kit</span><span>₹{admEverPaid.toLocaleString('en-IN')}</span></div>}
              {flatEverPaid > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Flat fees</span><span>₹{flatEverPaid.toLocaleString('en-IN')}</span></div>}
              {crsfEverPaid > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Course fees</span><span>₹{crsfEverPaid.toLocaleString('en-IN')}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#047857', borderTop: '1px solid #a7f3d0', marginTop: 8, paddingTop: 8 }}>
                <span>Total ever</span><span>₹{totalEverPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || grandThis === 0 || !admRec}
            style={{ width: '100%', padding: 14, borderRadius: 12, background: saving || grandThis === 0 || !admRec ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#3730a3)', color: 'white', border: 'none', fontSize: 15, fontWeight: 800, cursor: saving || grandThis === 0 || !admRec ? 'not-allowed' : 'pointer', boxShadow: grandThis > 0 && admRec ? '0 4px 16px rgba(55,48,163,.3)' : 'none' }}>
            {saving ? '⏳ Processing…' : `🖨️ Save & print invoice · ₹${grandThis.toLocaleString('en-IN')}`}
          </button>
          {!admRec && <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'center', marginTop: -6 }}>⚠ No admission record — create one in Admissions first</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Root: Fees page ─────────────────────────────────────────────────────────

export default function Fees() {
  const [fees,                setFees]         = useState([])
  const [students,            setStudents]      = useState([])
  const [admissions,          setAdmissions]    = useState([])
  const [adm_fee_collections, setAdmFeeCols]    = useState([])
  const [adm_flat_fees,       setAdmFlatFees]   = useState([])
  const [adm_course_fees,     setAdmCourseFees] = useState([])
  const [loading,             setLoading]       = useState(true)
  const [saving,              setSaving]        = useState(false)
  const [showForm,            setShowForm]      = useState(false)
  const [search,              setSearch]        = useState('')
  const [sf,                  setSf]            = useState('All')
  const [tab,                 setTab]           = useState('payment')
  const [form,                setForm]          = useState({ gcc_no: '', name: '', class_name: '', course: '', amount: '', paid: '0' })

  const loadAll = async () => {
    setLoading(true)
    const [fR, sR, aR, cR, flR, crR] = await Promise.all([
      supabase.from('fees').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('*').order('name'),
      supabase.from('admissions').select('*'),
      supabase.from('adm_fee_collections').select('*'),
      supabase.from('adm_flat_fees').select('*'),
      supabase.from('adm_course_fees').select('*'),
    ])
    setFees(fR.data || [])
    setStudents(sR.data || [])
    setAdmissions(aR.data || [])
    setAdmFeeCols(cR.data || [])
    setAdmFlatFees(flR.data || [])
    setAdmCourseFees(crR.data || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const getLiveFees = s => {
    const gcc = gccStr(s.gcc_no)
    const admTotal   = adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc).reduce((a, c) => a + (Number(c.amount_paid) || 0), 0)
    const flatTotal  = adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid).reduce((a, r) => a + (r.amount || 0), 0)
    const crsfTotal  = adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc).reduce((a, r) => a + (Number(r.amount_paid) || 0), 0)
    const grandTotal = admTotal + flatTotal + crsfTotal
    return { admTotal, flatTotal, crsfTotal, grandTotal, hasFees: grandTotal > 0 }
  }

  const getAdmRec = s => admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null

  const liveRows = useMemo(() => students.map(s => {
    const live   = getLiveFees(s)
    const admRec = getAdmRec(s)
    const status = live.grandTotal > 0 ? (admRec?.status === 'Enrolled' ? 'Paid' : 'Partial') : 'Pending'
    return { ...s, ...live, admRec, liveStatus: status }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [students, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees])

  const filteredLive = useMemo(() => {
    const q = search.toLowerCase()
    return liveRows.filter(s =>
      (sf === 'All' || s.liveStatus === sf) &&
      [s.name, s.gcc_no, s.class_name, s.batch, s.course].some(v => (v || '').toString().toLowerCase().includes(q))
    )
  }, [liveRows, search, sf])

  const liveTtl = liveRows.reduce((a, s) => a + s.grandTotal, 0)
  const liveP   = liveRows.filter(s => s.liveStatus === 'Pending').length
  const liveP2  = liveRows.filter(s => s.liveStatus === 'Paid').length

  const filteredLeg = useMemo(() => {
    const q = search.toLowerCase()
    return fees.filter(f =>
      (sf === 'All' || f.status === sf) &&
      [(f.name || ''), (f.status || '')].some(v => v.toLowerCase().includes(q))
    )
  }, [fees, search, sf])

  const legTtl = fees.reduce((s, f) => s + (Number(f.amount) || 0), 0)
  const legPd  = fees.reduce((s, f) => s + (Number(f.paid)   || 0), 0)

  const handleAdd = async e => {
    e.preventDefault(); setSaving(true)
    const amount = Number(form.amount) || 0, paid = Number(form.paid) || 0
    const status = paid >= amount ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
    const { error } = await supabase.from('fees').insert([{ gcc_no: form.gcc_no || null, name: form.name, class_name: form.class_name, course: form.course, amount, paid, status }])
    if (error) alert('Error: ' + error.message)
    else { setForm({ gcc_no: '', name: '', class_name: '', course: '', amount: '', paid: '0' }); setShowForm(false); loadAll() }
    setSaving(false)
  }

  const handleCollect = async (id, amount) => { await supabase.from('fees').update({ paid: amount, status: 'Paid' }).eq('id', id); loadAll() }
  const handleDelete  = async id => { if (!window.confirm('Delete?')) return; await supabase.from('fees').delete().eq('id', id); loadAll() }

  const handleSync = async s => {
    const live = getLiveFees(s); if (!live.hasFees) return
    const ex = fees.find(f => gccStr(f.gcc_no) === gccStr(s.gcc_no))
    const p = { gcc_no: gccStr(s.gcc_no), name: s.name, class_name: s.class_name || s.batch || '', course: s.course || '', amount: live.grandTotal, paid: live.grandTotal, status: 'Paid' }
    if (ex) await supabase.from('fees').update(p).eq('id', ex.id)
    else    await supabase.from('fees').insert([p])
    loadAll()
  }

  const n = v => Number(v || 0).toLocaleString('en-IN')

  const TABS = [
    { id: 'payment', label: '💳 Fee Payment' },
    { id: 'live',    label: '📊 Live Summary' },
    { id: 'legacy',  label: '🗂️ Legacy Records' },
  ]

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>💰 Fee Management</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Collect · Invoice · Live summary · Legacy records</p>
        </div>
        {tab === 'legacy' && (
          <button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            {showForm ? '✖ Cancel' : '➕ Add Record'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setSf('All') }}
            style={{ padding: '9px 20px', border: 'none', borderBottom: tab === t.id ? '3px solid #1e3a5f' : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#1e3a5f' : '#64748b', marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payment' && (
        <FeePaymentTab
          students={students} admissions={admissions}
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          onRefresh={loadAll}
        />
      )}

      {tab === 'live' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total students',  value: students.length,        color: '#1e3a5f', bg: '#eff6ff', icon: '👨‍🎓' },
              { label: 'Total collected', value: `₹${n(liveTtl)}`,       color: '#16a34a', bg: '#dcfce7', icon: '✅' },
              { label: 'Fees pending',    value: liveP,                  color: '#dc2626', bg: '#fee2e2', icon: '⚠️' },
              { label: 'Fully paid',      value: liveP2,                 color: '#7c3aed', bg: '#f5f3ff', icon: '🎉' },
            ].map(c => (
              <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,.06)', borderLeft: `4px solid ${c.color}` }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                <p style={{ fontSize: 13, color: c.color, fontWeight: 600, margin: 0 }}>{c.label}</p>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', color: c.color, margin: '4px 0 0' }}>{c.value}</h2>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 200 }} />
            <select value={sf} onChange={e => setSf(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="All">All</option><option>Paid</option><option>Partial</option><option>Pending</option>
            </select>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading…</div> : (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#1e3a5f' }}>
                    {['#','GCC','Student','Class','Course','Hostel','Adm fee','Flat','Course','Total','Status','Sync'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLive.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.class_name || s.batch || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><HostelBadge type={s.hostel_type} /></td>
                      <td style={{ padding: '10px 14px', color: '#4f46e5', fontWeight: 600 }}>{s.admTotal  > 0 ? `₹${n(s.admTotal)}`  : '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>{s.flatTotal > 0 ? `₹${n(s.flatTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#7c3aed', fontWeight: 600 }}>{s.crsfTotal > 0 ? `₹${n(s.crsfTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: s.grandTotal > 0 ? '#16a34a' : '#94a3b8' }}>{s.grandTotal > 0 ? `₹${n(s.grandTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span style={sStyle(s.liveStatus)}>{s.liveStatus}</span></td>
                      <td style={{ padding: '10px 14px' }}>
                        {s.hasFees && <button onClick={() => handleSync(s)} style={{ background: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>⇄</button>}
                      </td>
                    </tr>
                  ))}
                  {filteredLive.length === 0 && <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No students found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'legacy' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total fees', amount: legTtl,         color: '#1e3a5f', bg: '#eff6ff' },
              { label: 'Collected',  amount: legPd,          color: '#16a34a', bg: '#dcfce7' },
              { label: 'Pending',    amount: legTtl - legPd, color: '#dc2626', bg: '#fee2e2' },
            ].map(c => (
              <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)', borderLeft: `4px solid ${c.color}` }}>
                <p style={{ fontSize: 13, color: c.color, fontWeight: 500, opacity: .8, margin: 0 }}>{c.label}</p>
                <h2 style={{ fontSize: 28, fontWeight: 'bold', color: c.color, marginTop: 4, marginBottom: 0 }}>₹{n(c.amount)}</h2>
              </div>
            ))}
          </div>
          {showForm && (
            <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>Add fee record</h2>
              <form onSubmit={handleAdd}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Search student</label>
                    <StudentSearch students={students} onSelect={s => setForm(f => ({ ...f, gcc_no: gccStr(s.gcc_no), name: s.name || '', class_name: s.class_name || s.batch || '', course: s.course || '' }))} />
                  </div>
                  <div><label style={lbl}>GCC No.</label><input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Class</label><input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Course</label><input value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Total ₹ *</label><input required type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Paid ₹</label><input type="number" value={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.value }))} style={inp} /></div>
                </div>
                <button type="submit" disabled={saving} style={{ marginTop: 16, backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                  {saving ? '⏳ Saving…' : '✅ Save'}
                </button>
              </form>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2 }} />
            <select value={sf} onChange={e => setSf(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="All">All</option><option>Paid</option><option>Partial</option><option>Pending</option>
            </select>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading…</div> : (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#','GCC','Name','Class','Course','Total','Paid','Pending','Status','Linked','Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeg.map((f, i) => {
                    const amt = Number(f.amount) || 0, pd = Number(f.paid) || 0
                    const linked = f.gcc_no ? students.find(s => gccStr(s.gcc_no) === gccStr(f.gcc_no)) : null
                    const live   = linked ? getLiveFees(linked) : null
                    return (
                      <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{f.gcc_no ? `GCC-${f.gcc_no}` : '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{f.name || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{f.class_name || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{f.course || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600 }}>₹{n(amt)}</td>
                        <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>₹{n(pd)}</td>
                        <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 600 }}>₹{n(amt - pd)}</td>
                        <td style={{ padding: '12px 16px' }}><span style={sStyle(f.status)}>{f.status || 'Pending'}</span></td>
                        <td style={{ padding: '12px 16px' }}>
                          {linked
                            ? <div><div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>✓ {linked.name}</div>{live?.hasFees && <div style={{ fontSize: 11, color: '#64748b' }}>Live ₹{n(live.grandTotal)}</div>}</div>
                            : f.gcc_no ? <span style={{ fontSize: 11, color: '#dc2626' }}>⚠ No match</span> : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {f.status !== 'Paid' && <button onClick={() => handleCollect(f.id, amt)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>💰</button>}
                            <button onClick={() => handleDelete(f.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredLeg.length === 0 && <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// BulkAdmissionFee.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Bulk admission fee collection for migrated / enrolled students.
//  Writes to: adm_fee_collections, accounts (via upsertAccount).
//  All columns: snake_case. accounts: always upserted, never plain insert.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  upsertAccount, buildReceiptHTML,
  PAY_MODES, CURRENT_YEAR,
} from './shared/feeHelpers'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ADM_FEE = 6000
const DEFAULT_DRESS   = 3000
const DEFAULT_PROSP   = 200

const COURSE_FEES = {
  Sainik:            { Boarder: 6000, 'Day Scholar': 2500, 'Day Boarder': 4500 },
  Navodaya:          { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  Foundation:        { Boarder: 5500, 'Day Scholar': 2000, 'Day Boarder': 4000 },
  'Combined Course': { Boarder: 6500, 'Day Scholar': 3000, 'Day Boarder': 4500 },
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  navy:    '#0f2744',
  gold:    '#c9a84c',
  emerald: '#059669',
  rose:    '#e11d48',
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    400: '#94a3b8', 500: '#64748b', 700: '#334155', 900: '#0f172a',
  },
}

// ─── Amount in words ──────────────────────────────────────────────────────────

function amountInWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  if (!n || isNaN(n)) return 'Zero Rupees Only'
  n = parseInt(n)
  if (n === 0) return 'Zero Rupees Only'
  const w = num => {
    if (num < 20) return ones[num]
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + w(num % 100) : '')
  }
  let result = ''
  if (n >= 100000) { result += w(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000)   { result += w(Math.floor(n / 1000))   + ' Thousand '; n %= 1000 }
  result += w(n)
  return result.trim() + ' Rupees Only'
}

// ─── Receipt Printer ──────────────────────────────────────────────────────────

function ReceiptPrinter({ receipts, onClose }) {
  const print = () => {
    const pages = receipts.map(r => buildReceiptHTML({
      receipt_no:   r.receipt_no,
      pay_date:     r.pay_date,
      pay_mode:     r.pay_mode,
      txn_ref:      r.txn_ref,
      collected_by: r.collected_by,
      student_name: r.student_name,
      adm_no:       r.adm_no,
      gcc_no:       r.gcc,
      class_name:   r.batch,
      course:       r.course,
      items:        r.items,
      total:        r.total,
    }))

    // Open all receipts in one print window separated by page breaks
    const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f5f5f0;padding:20px}@page{margin:10mm}@media print{body{padding:0}.break{page-break-after:always}}</style>
    </head><body>
    ${receipts.map((r, i) => `
      <div class="${i < receipts.length - 1 ? 'break' : ''}">
        ${buildReceiptHTML({
          receipt_no:   r.receipt_no,
          pay_date:     r.pay_date,
          pay_mode:     r.pay_mode,
          txn_ref:      r.txn_ref,
          collected_by: r.collected_by,
          student_name: r.student_name,
          adm_no:       r.adm_no,
          gcc_no:       r.gcc,
          class_name:   r.batch,
          course:       r.course,
          items:        r.items,
          total:        r.total,
        }).replace(/<!DOCTYPE html>[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '')}
      </div>`).join('')}
    </body></html>`

    const pw = window.open('', '_blank', 'width=720,height=840,scrollbars=yes')
    if (!pw) {
      window.open(URL.createObjectURL(new Blob([combined], { type: 'text/html' })), '_blank')
      return
    }
    pw.document.write(combined)
    pw.document.close()
    setTimeout(() => { pw.print() }, 400)
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 'min(480px,95vw)', boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 6 }}>🖨️ Receipts ready</div>
        <div style={{ fontSize: 13, color: C.slate[500], marginBottom: 20 }}>
          {receipts.length} receipts generated. Click Print to open print dialog.
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receipts.map(r => (
            <div key={r.receipt_no} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.slate[50], borderRadius: 10, border: `1px solid ${C.slate[200]}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {(r.student_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900] }}>{r.student_name}</div>
                <div style={{ fontSize: 11, color: C.slate[400] }}>GCC-{r.gcc} · {r.receipt_no}</div>
              </div>
              <div style={{ fontWeight: 800, color: C.emerald, fontSize: 14 }}>₹{fmt(r.total)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.slate[500] }}>
            Close
          </button>
          <button onClick={print} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: C.navy, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🖨️ Print all receipts
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkAdmissionFee() {
  const [students,  setStudents]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const [selected,  setSelected]  = useState({})
  const [feeEdits,  setFeeEdits]  = useState({})
  const [feeItems,  setFeeItems]  = useState({})

  const [payMode,     setPayMode]     = useState('Cash')
  const [payDate,     setPayDate]     = useState(today())
  const [collectedBy, setCollectedBy] = useState('')
  const [txnRef,      setTxnRef]      = useState('')

  const [saving,     setSaving]     = useState(false)
  const [progress,   setProgress]   = useState({ done: 0, total: 0 })
  const [savedCount, setSavedCount] = useState(0)
  const [receipts,   setReceipts]   = useState([])
  const [showPrint,  setShowPrint]  = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  const [search,       setSearch]       = useState('')
  const [filterCourse, setFilterCourse] = useState('All')

  // ── Load enrolled students without admission fee ───────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data: apps, error: e1 } = await supabase
        .from('admissions')
        .select('gcc_no, applicant_name, course, subtype, batch, hostel_type, adm_no, phone, session')
        .eq('status', 'Enrolled')
        .order('gcc_no', { ascending: true })
      if (e1) throw e1

      const { data: paid, error: e2 } = await supabase
        .from('adm_fee_collections')
        .select('adm_app_id, fee_type')
        .eq('fee_type', 'admission')
      if (e2) throw e2

      const paidSet = new Set((paid || []).map(p => gccStr(p.adm_app_id)))
      const unpaid  = (apps || []).filter(a => !paidSet.has(gccStr(a.gcc_no)))

      setStudents(unpaid)

      const edits = {}, items = {}
      unpaid.forEach(s => {
        const gc = gccStr(s.gcc_no)
        edits[gc] = { admission: DEFAULT_ADM_FEE, dress: DEFAULT_DRESS, prospectus: DEFAULT_PROSP }
        items[gc] = { admission: true, dress: false, prospectus: false }
      })
      setFeeEdits(edits)
      setFeeItems(items)
    } catch (err) {
      setError(err.message || 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectAll  = () => { const s = {}; filtered.forEach(x => { s[gccStr(x.gcc_no)] = true }); setSelected(s) }
  const selectNone = () => setSelected({})
  const toggleSel  = gc => setSelected(p => ({ ...p, [gc]: !p[gc] }))
  const toggleItem = (gc, item) => setFeeItems(p => ({ ...p, [gc]: { ...p[gc], [item]: !p[gc]?.[item] } }))
  const setAmt     = (gc, item, val) => setFeeEdits(p => ({ ...p, [gc]: { ...p[gc], [item]: Number(val) || 0 } }))

  const applyGlobalFee = (item, val) => {
    const keys = Object.keys(selected).filter(k => selected[k])
    setFeeEdits(p => {
      const next = { ...p }
      keys.forEach(gc => { next[gc] = { ...next[gc], [item]: Number(val) || 0 } })
      return next
    })
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const ms = !q || [s.applicant_name, s.gcc_no, s.batch, s.course].some(v => String(v || '').toLowerCase().includes(q))
    const mc = filterCourse === 'All' || s.course === filterCourse
    return ms && mc
  })

  const selectedList = filtered.filter(s => selected[gccStr(s.gcc_no)])
  const totalAmount  = selectedList.reduce((sum, s) => {
    const gc = gccStr(s.gcc_no)
    const its = feeItems[gc] || {}
    const amts = feeEdits[gc] || {}
    return sum
      + (its.admission  ? (amts.admission  || DEFAULT_ADM_FEE) : 0)
      + (its.dress      ? (amts.dress      || DEFAULT_DRESS)   : 0)
      + (its.prospectus ? (amts.prospectus || DEFAULT_PROSP)   : 0)
  }, 0)

  // ── Save all selected ─────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!selectedList.length) return alert('Select at least one student.')
    if (!window.confirm(`Record admission fees for ${selectedList.length} students?\nTotal: ₹${fmt(totalAmount)}`)) return

    setSaving(true); setSaveError(null)
    setProgress({ done: 0, total: selectedList.length })
    const newReceipts = []
    const failed = []

    for (let i = 0; i < selectedList.length; i++) {
      const s     = selectedList[i]
      const gc    = gccStr(s.gcc_no)
      const its   = feeItems[gc] || {}
      const amts  = feeEdits[gc] || {}
      const name  = s.applicant_name
      const admNo = s.adm_no || null
      const batch = s.batch  || null

      const lineItems = [
        its.admission  && { id: 'admission',  label: 'Admission Fee',  type: 'admission', amount: amts.admission  || DEFAULT_ADM_FEE },
        its.dress      && { id: 'dress',      label: 'Dress Fee',       type: 'item',      amount: amts.dress      || DEFAULT_DRESS   },
        its.prospectus && { id: 'prospectus', label: 'Prospectus Fee',  type: 'item',      amount: amts.prospectus || DEFAULT_PROSP   },
      ].filter(Boolean)

      if (!lineItems.length) { setProgress(p => ({ ...p, done: p.done + 1 })); continue }

      const rcpt  = rcptNo()
      const total = lineItems.reduce((s, it) => s + it.amount, 0)

      try {
        for (const item of lineItems) {
          const { error: e } = await supabase.from('adm_fee_collections').insert({
            id:           `${rcpt}-${item.id}`,
            adm_app_id:   gc,
            fee_type:     item.type,
            amount_paid:  item.amount,    // ← snake_case
            pay_date:     payDate,         // ← snake_case
            pay_mode:     payMode,         // ← snake_case
            txn_ref:      txnRef || null,
            description:  item.label,
            receipt_no:   rcpt,            // ← snake_case
            student_name: name,
            adm_no:       admNo,
            class_name:   batch,
            collected_by: collectedBy || null,
          })
          if (e) throw e
        }

        // accounts: upsert (not plain insert) to prevent duplicates on re-run
        await upsertAccount({
          entry_date:   payDate,
          type:         'Income',
          category:     'Admission',
          amount:       total,
          payment_mode: payMode,
          note:         `Admission fees — ${name} (GCC-${gc})`,
          source_ref:   `${gc}_admission`,   // ← deterministic key per student
          source_type:  'admission',
        })

        newReceipts.push({
          receipt_no:   rcpt,
          student_name: name,
          gcc:          gc,
          course:       s.course,
          batch,
          pay_mode:     payMode,
          pay_date:     payDate,
          txn_ref:      txnRef || null,
          collected_by: collectedBy || null,
          adm_no:       admNo,
          items:        lineItems.map(it => ({ label: it.label, amount: it.amount })),
          total,
        })

      } catch (err) {
        console.error(`Failed for GCC-${gc}:`, err)
        failed.push({ name, gc, error: err.message })
      }

      setProgress({ done: i + 1, total: selectedList.length })
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 200)) // rate-limit pause
    }

    setSaving(false)
    setSavedCount(prev => prev + newReceipts.length)
    setReceipts(newReceipts)

    if (failed.length) {
      setSaveError(`${failed.length} failed: ${failed.map(f => `GCC-${f.gc}`).join(', ')}`)
    }

    if (newReceipts.length) {
      setShowPrint(true)
      const savedGccs = new Set(newReceipts.map(r => r.gcc))
      setStudents(p => p.filter(s => !savedGccs.has(gccStr(s.gcc_no))))
      setSelected({})
    }
  }

  const courses = ['All', ...new Set(students.map(s => s.course).filter(Boolean))]

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "system-ui,sans-serif", padding: '0 0 80px' }}>

      {/* Header */}
      <div style={{ background: C.navy, color: 'white', padding: '24px 32px', borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: C.gold, marginBottom: 6 }}>
            GNSI Portal · Accounts
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>
            Bulk Admission Fee Collection
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>📋 {students.length} students pending admission fee</span>
            <span>·</span>
            <span>✅ {savedCount} processed this session</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
            ❌ {error}
            <button onClick={load} style={{ marginLeft: 12, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontSize: 12, cursor: 'pointer' }}>Retry</button>
          </div>
        )}
        {saveError && (
          <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#c2410c', fontWeight: 600 }}>
            ⚠️ {saveError}
          </div>
        )}

        {/* Global payment settings */}
        <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${C.slate[200]}`, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
            Global payment settings — applies to all selected students
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
            {[
              { label: 'Payment Mode', el: (
                <select value={payMode} onChange={e => setPayMode(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              )},
              { label: 'Payment Date', el: (
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              )},
              { label: 'Collected By', el: (
                <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Staff name"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              )},
              { label: 'Txn Ref / Cheque No.', el: (
                <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="Optional"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              )},
            ].map(({ label, el }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.slate[500], marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                {el}
              </div>
            ))}
          </div>

          {/* Global fee setter */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.slate[100]}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Apply fee amount to all selected students
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'admission',  label: 'Admission Fee', color: '#4f46e5', default: DEFAULT_ADM_FEE },
                { key: 'dress',      label: 'Dress Fee',      color: '#0891b2', default: DEFAULT_DRESS   },
                { key: 'prospectus', label: 'Prospectus',     color: '#7c3aed', default: DEFAULT_PROSP   },
              ].map(it => (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, background: C.slate[50], border: `1px solid ${C.slate[200]}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: it.color }}>{it.label}</span>
                  <input type="number" defaultValue={it.default}
                    onBlur={e => applyGlobalFee(it.key, e.target.value)}
                    style={{ width: 80, padding: '4px 6px', borderRadius: 6, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', textAlign: 'right', fontWeight: 700, color: it.color }} />
                  <span style={{ fontSize: 11, color: C.slate[400] }}>→ all selected</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.slate[400], fontSize: 14 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, GCC, class…"
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
            {courses.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={selectAll} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.slate[600] }}>
            ☑ Select all ({filtered.length})
          </button>
          <button onClick={selectNone} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.slate[200]}`, background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.slate[600] }}>
            ☐ None
          </button>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: C.slate[500], fontWeight: 600 }}>
            {selectedList.length} selected · <span style={{ color: C.emerald, fontWeight: 800 }}>₹{fmt(totalAmount)}</span>
          </div>
        </div>

        {/* Student list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.slate[400], fontSize: 14 }}>⏳ Loading enrolled students…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.slate[700], marginBottom: 6 }}>All admission fees collected!</div>
            <div style={{ fontSize: 13, color: C.slate[400] }}>No enrolled students with pending admission fees.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => {
              const gc   = gccStr(s.gcc_no)
              const sel  = !!selected[gc]
              const its  = feeItems[gc] || { admission: true }
              const amts = feeEdits[gc] || {}
              const rowTotal = (its.admission  ? (amts.admission  || DEFAULT_ADM_FEE) : 0)
                             + (its.dress      ? (amts.dress      || DEFAULT_DRESS)   : 0)
                             + (its.prospectus ? (amts.prospectus || DEFAULT_PROSP)   : 0)

              return (
                <div key={gc} style={{
                  background: 'white', borderRadius: 12,
                  border: `1.5px solid ${sel ? C.navy : C.slate[200]}`,
                  boxShadow: sel ? `0 0 0 1px ${C.navy}` : '0 1px 3px rgba(0,0,0,.04)',
                  overflow: 'hidden', transition: 'all .15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', cursor: 'pointer' }}
                    onClick={() => toggleSel(gc)}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${sel ? C.navy : C.slate[300]}`,
                      background: sel ? C.navy : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                      {(s.applicant_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.slate[900] }}>{s.applicant_name}</div>
                      <div style={{ fontSize: 11, color: C.slate[400], display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, color: C.navy, fontFamily: 'monospace' }}>GCC-{gc}</span>
                        {s.course && <span style={{ background: `${C.navy}12`, color: C.navy, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{s.course}</span>}
                        {s.subtype && <span>{s.subtype}</span>}
                        {s.batch   && <span>· {s.batch}</span>}
                        {s.hostel_type && <span style={{ fontWeight: 600, color: s.hostel_type === 'Boarder' ? '#1d4ed8' : '#059669' }}>{s.hostel_type}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: sel ? C.emerald : C.slate[400] }}>₹{fmt(rowTotal)}</div>
                      <div style={{ fontSize: 10, color: C.slate[400] }}>selected items</div>
                    </div>
                  </div>

                  {/* Fee item checkboxes */}
                  <div style={{ padding: '10px 18px 14px', borderTop: `1px solid ${C.slate[100]}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      { key: 'admission',  label: 'Admission Fee', color: '#4f46e5', default: DEFAULT_ADM_FEE },
                      { key: 'dress',      label: 'Dress Fee',      color: '#0891b2', default: DEFAULT_DRESS   },
                      { key: 'prospectus', label: 'Prospectus Fee', color: '#7c3aed', default: DEFAULT_PROSP   },
                    ].map(item => (
                      <div key={item.key} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${its[item.key] ? item.color : C.slate[200]}`,
                        background: its[item.key] ? item.color + '10' : C.slate[50],
                        transition: 'all .12s',
                      }}
                        onClick={e => { e.stopPropagation(); toggleItem(gc, item.key) }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          border: `2px solid ${its[item.key] ? item.color : C.slate[300]}`,
                          background: its[item.key] ? item.color : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {its[item.key] && <span style={{ color: 'white', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: its[item.key] ? item.color : C.slate[500] }}>{item.label}</span>
                        <input
                          type="number"
                          value={amts[item.key] ?? item.default}
                          onChange={e => { e.stopPropagation(); setAmt(gc, item.key, e.target.value) }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 72, padding: '3px 6px', borderRadius: 6, border: `1px solid ${C.slate[200]}`, fontSize: 12, fontFamily: 'inherit', outline: 'none', textAlign: 'right', fontWeight: 700, color: item.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sticky save bar */}
        {selectedList.length > 0 && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: C.navy, borderTop: `3px solid ${C.gold}`,
            padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', zIndex: 100,
            boxShadow: '0 -8px 32px rgba(0,0,0,.2)',
          }}>
            <div style={{ color: 'white' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Ready to save</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                <span style={{ color: C.gold }}>{selectedList.length}</span>
                <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 14 }}> students · </span>
                <span style={{ color: C.gold }}>₹{fmt(totalAmount)}</span>
                <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 14 }}> total</span>
              </div>
            </div>
            {saving ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 200, height: 8, background: 'rgba(255,255,255,.15)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: C.gold, borderRadius: 99, transition: 'width .3s' }} />
                </div>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{progress.done} / {progress.total}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={selectNone} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveAll} style={{ padding: '10px 28px', borderRadius: 9, border: 'none', background: C.gold, color: C.navy, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  💾 Record & Generate Receipts
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showPrint && receipts.length > 0 && (
        <ReceiptPrinter receipts={receipts} onClose={() => setShowPrint(false)} />
      )}
    </div>
  )
}
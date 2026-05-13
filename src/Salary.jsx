import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const cm = () => new Date().toISOString().slice(0, 7)
const fmtMonth = (m) => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const gross = (s) =>
  (Number(s.basic_salary) || 0) +
  (Number(s.seniority_allowance) || 0) +
  (Number(s.loyalty_bonus) || 0) +
  (Number(s.role_bonus) || 0)

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card: { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn: (c = '#1e3a5f', dis = false) => ({
    backgroundColor: dis ? '#94a3b8' : c,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontWeight: '600',
    cursor: dis ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    opacity: dis ? 0.7 : 1,
  }),
  btnSm: (c = '#1e3a5f') => ({
    backgroundColor: c,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: '1',
  }),
  inp: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  lbl: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  // FIXED: No shorthand borderBottom — only longhand properties
  tab: (a) => ({
    padding: '10px 20px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottomWidth: a ? '3px' : '0px',
    borderBottomStyle: 'solid',
    borderBottomColor: a ? '#1e3a5f' : 'transparent',
    color: a ? '#1e3a5f' : '#64748b',
    transition: 'all 0.2s',
  }),
}

// ─── Print Styles ────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 5mm 7mm }
  body > *:not(#gnsi-print-root) { display: none !important }
  #gnsi-print-root { display: block !important }
}
`

function injectPrintCSS() {
  if (typeof document === 'undefined' || document.getElementById('gnsi-print-style')) return
  const s = document.createElement('style')
  s.id = 'gnsi-print-style'
  s.textContent = PRINT_CSS
  document.head.appendChild(s)
}

// ─── Salary Slip HTML Builder ────────────────────────────────────────────────

function buildSlipHTML(s, ded, month, copy) {
  const g = gross(s)
  const adv = Number(ded?.advance_deduction || 0)
  const lat = Number(ded?.late_deduction || 0)
  const adm = Number(ded?.admin_deduction || 0)
  const totDed = adv + lat + adm
  const net = g - totDed
  const ini = (s.name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const isOff = copy === 'office'
  const ctag = isOff ? 'OFFICE COPY' : 'STAFF COPY'
  const cbg = isOff ? '#FCEBEB' : '#E6F1FB'
  const cclr = isOff ? '#6B1A1A' : '#0C447C'
  const mo = fmtMonth(month)

  const erow = (el, ev, dl, dv, dspecial) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:.5px solid #EEF2FA;font-size:12px;color:#334;text-align:left">${el}</td>
      <td style="padding:8px 12px;border-bottom:.5px solid #EEF2FA;font-size:12px;font-weight:600;color:#185FA5;text-align:right;border-right:2px solid #C5D8F5">${ev ? fmt(ev) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:.5px solid #FCEAEA;font-size:12px;color:#555;text-align:left;background:${dspecial ? '#FFFBEB' : '#fff'}">${dl || ''}</td>
      <td style="padding:8px 12px;border-bottom:.5px solid #FCEAEA;font-size:12px;font-weight:600;color:${dspecial ? '#B8860B' : '#A32D2D'};text-align:right;background:${dspecial ? '#FFFBEB' : '#fff'}">${dv != null ? (dv ? fmt(dv) : '—') : ''}</td>
    </tr>`

  return `
  <div style="width:100%;background:#fff;border:2px solid #1B3A6B;border-radius:6px;overflow:hidden;font-family:Arial,sans-serif;color:#222;display:flex;flex-direction:column">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="background:#1B3A6B;padding:10px 14px;width:50px">
          <div style="width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center">
            <span style="font-size:9px;font-weight:700;color:#1B3A6B">GNSI</span>
          </div>
        </td>
        <td style="background:#1B3A6B;padding:10px 12px">
          <div style="font-size:15px;font-weight:700;color:#fff">Guidance Navodaya &amp; Sainik Institute</div>
          <div style="font-size:10px;color:#B5D4F4;margin-top:2px">Khangabok Sorok Wangma, Thoubal, Manipur</div>
        </td>
        <td style="background:#1B3A6B;padding:10px 14px;text-align:right;white-space:nowrap">
          <div style="background:${cbg};color:${cclr};font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;display:inline-block">${ctag}</div>
          <div style="font-size:10px;color:#B5D4F4;margin-top:4px">SALARY SLIP · ${mo}</div>
        </td>
      </tr>
    </table>

    <div style="background:#EEF4FF;border-bottom:1px solid #C5D8F5;padding:8px 14px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:#1B3A6B;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:13px;font-weight:700;color:#fff">${ini}</span>
      </div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;color:#1B3A6B">${s.name || '—'}</div>
        <div style="font-size:11px;color:#3A5A9B;margin-top:2px">${s.designation || s.department || '—'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#5A7AB5">Employee No.</div>
        <div style="font-size:14px;font-weight:700;color:#1B3A6B">GNSI-${String(s.id).padStart(3, '0')}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th colspan="2" style="background:#1B3A6B;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;text-align:center;border-right:2px solid #C5D8F5">EARNINGS</th>
          <th colspan="2" style="background:#7B1F1F;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;text-align:center">DEDUCTIONS</th>
        </tr>
      </thead>
      <tbody>
        ${erow('Basic Pay', s.basic_salary, 'Advance', adv, false)}
        ${erow('Seniority Allow.', s.seniority_allowance, 'Late / Absent', lat, false)}
        ${erow('Loyalty Bonus', s.loyalty_bonus, 'Admin Deduction', adm, true)}
        ${erow('Role Bonus', s.role_bonus, '', null, false)}
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;border-top:1px solid #C5D8F5">
      <tr>
        <td style="background:#E6F1FB;padding:10px 12px;text-align:center;width:33%">
          <div style="font-size:10px;color:#185FA5;font-weight:700">GROSS EARNINGS</div>
          <div style="font-size:20px;font-weight:700;color:#0C447C">${fmt(g)}</div>
        </td>
        <td style="background:#FCEBEB;padding:10px 12px;text-align:center;width:33%;border:1px solid #FCEAEA">
          <div style="font-size:10px;color:#A32D2D;font-weight:700">TOTAL DEDUCTIONS</div>
          <div style="font-size:20px;font-weight:700;color:#A32D2D">${fmt(totDed)}</div>
        </td>
        <td style="background:#EAF3DE;padding:10px 12px;text-align:center;width:34%;border:1.5px solid #1B3A6B">
          <div style="font-size:10px;color:#1B3A6B;font-weight:700">NET SALARY PAYABLE</div>
          <div style="font-size:20px;font-weight:700;color:#27500A">${fmt(net)}</div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;border-top:1px solid #C5D8F5">
      <tr>
        <td style="padding:8px 12px;background:#fff">
          <div style="font-size:9px;font-weight:700;color:#B8860B;margin-bottom:4px">APPRAISAL / REMARKS BY FOUNDER</div>
          <div style="border-bottom:1.5px solid #333;min-height:24px;width:100%"></div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-right:.5px solid #EEF2FA;border-top:1.5px solid #bbb;width:33%">Staff Signature</td>
        <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-right:.5px solid #EEF2FA;border-top:1.5px solid #bbb;width:33%">Accountant</td>
        <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-top:1.5px solid #bbb;width:34%">Principal / Administrator</td>
      </tr>
    </table>
  </div>`
}

// ─── Print Functions ─────────────────────────────────────────────────────────

function printSlip(s, ded, month) {
  injectPrintCSS()
  let root = document.getElementById('gnsi-print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'gnsi-print-root'
    document.body.appendChild(root)
  }
  root.style.display = 'none'
  root.innerHTML = `
    <div style="width:196mm;font-family:Arial,sans-serif">
      ${buildSlipHTML(s, ded, month, 'office')}
      <div style="border-top:1.5px dashed #aaa;padding:3px 0;text-align:center;font-size:7px;color:#bbb;letter-spacing:2px;margin:4mm 0">✂ CUT HERE</div>
      ${buildSlipHTML(s, ded, month, 'staff')}
    </div>`
  root.style.display = 'block'
  setTimeout(() => {
    window.print()
    setTimeout(() => { root.style.display = 'none' }, 1200)
  }, 80)
}

function printAllSlips(staffList, dedMap, month) {
  injectPrintCSS()
  let root = document.getElementById('gnsi-print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'gnsi-print-root'
    document.body.appendChild(root)
  }
  root.style.display = 'none'
  root.innerHTML = staffList.map(s => `
    <div style="page-break-after:always;width:196mm;font-family:Arial,sans-serif">
      ${buildSlipHTML(s, dedMap[s.id], month, 'office')}
      <div style="border-top:1.5px dashed #aaa;padding:3px 0;text-align:center;font-size:7px;color:#bbb;letter-spacing:2px;margin:4mm 0">✂ CUT HERE</div>
      ${buildSlipHTML(s, dedMap[s.id], month, 'staff')}
    </div>`).join('')
  root.style.display = 'block'
  setTimeout(() => {
    window.print()
    setTimeout(() => { root.style.display = 'none' }, 2000)
  }, 80)
}

function printRegister(tableRef) {
  injectPrintCSS()
  let root = document.getElementById('gnsi-print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'gnsi-print-root'
    document.body.appendChild(root)
  }
  root.style.display = 'none'
  root.innerHTML = tableRef.current?.outerHTML || ''
  root.style.display = 'block'
  setTimeout(() => {
    window.print()
    setTimeout(() => { root.style.display = 'none' }, 1200)
  }, 80)
}

// ─── Slip Modal Component ────────────────────────────────────────────────────

function SlipModal({ s, ded, month, onClose }) {
  if (!s) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          background: '#1e3a5f',
          color: 'white',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Salary Slip Preview — {s.name}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => printSlip(s, ded, month)}
              style={{ ...S.btnSm('#B8860B'), fontSize: '11px' }}
              aria-label="Print salary slip"
            >
              🖨 Print A4
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{
          overflowY: 'auto',
          padding: '14px',
          background: '#f2f4f8',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div dangerouslySetInnerHTML={{ __html: buildSlipHTML(s, ded, month, 'office') }} />
          <div style={{
            borderTop: '1.5px dashed #999',
            padding: '4px 0',
            textAlign: 'center',
            fontSize: '8px',
            color: '#aaa',
            letterSpacing: '2px',
          }}>
            CUT HERE
          </div>
          <div dangerouslySetInnerHTML={{ __html: buildSlipHTML(s, ded, month, 'staff') }} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Salary Component ───────────────────────────────────────────────────

export default function Salary() {
  const [activeTab, setActiveTab] = useState('register')
  const [staff, setStaff] = useState([])
  const [salaryRows, setSalaryRows] = useState([])
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)

  // Register state
  const [regMonth, setRegMonth] = useState(cm())
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dedMap, setDedMap] = useState({})
  const [saving, setSaving] = useState(false)
  const [slipStaff, setSlipStaff] = useState(null)
  const tableRef = useRef(null)

  // Advances tab
  const [advForm, setAdvForm] = useState({
    staff_id: '',
    amount: '',
    reason: '',
    issued_month: cm(),
    repay_months: 1,
  })
  const [advSaving, setAdvSaving] = useState(false)
  const [showAdvForm, setShowAdvForm] = useState(false)

  // History tab
  const [histStaffId, setHistStaffId] = useState('')

  // ── Fetch Data ──

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: sd }, { data: sald }, { data: advd }] = await Promise.all([
        supabase.from('staff_profiles').select('*').order('name'),
        supabase.from('salary').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_advances').select('*').order('created_at', { ascending: false }),
      ])
      setStaff(sd || [])
      setSalaryRows(sald || [])
      setAdvances(advd || [])
    } catch (err) {
      console.error('Fetch error:', err)
      alert('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL FIX: All useMemo derived state MUST come BEFORE any useCallback
  // that references them. This prevents the "Cannot access before initialization"
  // ReferenceError.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Derived Data (useMemo hooks) ──

  const roles = useMemo(() =>
    [...new Set(staff.map(s => s.designation || s.department).filter(Boolean))].sort(),
    [staff]
  )

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase()
    return staff.filter(s => {
      const matchRole = !roleFilter || (s.designation || s.department) === roleFilter
      const matchSearch = !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.designation || '').toLowerCase().includes(q)
      return matchRole && matchSearch
    })
  }, [staff, roleFilter, search])

  const regTotals = useMemo(() => {
    let tG = 0, tA = 0, tL = 0, tAd = 0, tN = 0
    filteredStaff.forEach(s => {
      const g = gross(s)
      const d = dedMap[s.id] || {}
      const td = (d.advance_deduction || 0) + (d.late_deduction || 0) + (d.admin_deduction || 0)
      tG += g
      tA += (d.advance_deduction || 0)
      tL += (d.late_deduction || 0)
      tAd += (d.admin_deduction || 0)
      tN += g - td
    })
    return { tG, tA, tL, tAd, tD: tA + tL + tAd, tN }
  }, [filteredStaff, dedMap])

  const historyData = useMemo(() => {
    if (!histStaffId) return []
    return salaryRows
      .filter(r => String(r.staff_id) === String(histStaffId))
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [salaryRows, histStaffId])

  const totalPaid = useMemo(() =>
    salaryRows.filter(r => r.status === 'Paid').reduce((s, r) => s + (r.net_salary || 0), 0),
    [salaryRows]
  )

  const totalUnpaid = useMemo(() =>
    salaryRows.filter(r => r.status !== 'Paid').reduce((s, r) => s + (r.net_salary || 0), 0),
    [salaryRows]
  )

  const totalAdvOutstand = useMemo(() =>
    advances.filter(a => a.status === 'Active').reduce((s, a) => s + (a.amount - a.repaid_amount), 0),
    [advances]
  )

  // ── Pending Advance Calculation ──

  const pendingAdvance = useCallback((staffId) => {
    let total = 0
    advances
      .filter(a => String(a.staff_id) === String(staffId) && a.status === 'Active')
      .forEach(a => {
        const rem = Number(a.amount) - Number(a.repaid_amount)
        const pm = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
        total += Math.min(pm, rem)
      })
    return total
  }, [advances])

  // Load deductions for selected month
  useEffect(() => {
    if (!staff.length) return
    const map = {}
    salaryRows.filter(r => r.month === regMonth).forEach(r => {
      map[r.staff_id] = {
        advance_deduction: r.advance_deduction || 0,
        late_deduction: r.late_deduction || 0,
        admin_deduction: r.admin_deduction || 0,
      }
    })
    staff.forEach(s => {
      if (!map[s.id]) {
        map[s.id] = {
          advance_deduction: pendingAdvance(s.id),
          late_deduction: 0,
          admin_deduction: 0,
        }
      }
    })
    setDedMap(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regMonth, salaryRows, staff, pendingAdvance])

  // ── Deduction Handlers ──

  const setDed = useCallback((staffId, field, value) => {
    setDedMap(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || { advance_deduction: 0, late_deduction: 0, admin_deduction: 0 }),
        [field]: Math.max(0, parseInt(value) || 0),
      },
    }))
  }, [])

  // FIXED: Now defined AFTER filteredStaff exists
  const resetDeductions = useCallback(() => {
    setDedMap(prev => {
      const m = { ...prev }
      filteredStaff.forEach(s => {
        m[s.id] = { advance_deduction: 0, late_deduction: 0, admin_deduction: 0 }
      })
      return m
    })
  }, [filteredStaff])

  // ── Save Register ──

  const handleSaveRegister = useCallback(async () => {
    setSaving(true)
    try {
      const rows = filteredStaff.map(s => {
        const d = dedMap[s.id] || { advance_deduction: 0, late_deduction: 0, admin_deduction: 0 }
        const g = gross(s)
        const totDed = (d.advance_deduction || 0) + (d.late_deduction || 0) + (d.admin_deduction || 0)
        return {
          staff_id: s.id,
          month: regMonth,
          basic_salary: s.basic_salary || 0,
          seniority_allowance: s.seniority_allowance || 0,
          loyalty_bonus: s.loyalty_bonus || 0,
          role_bonus: s.role_bonus || 0,
          allowance: (s.seniority_allowance || 0) + (s.loyalty_bonus || 0) + (s.role_bonus || 0),
          advance_deduction: d.advance_deduction || 0,
          late_deduction: d.late_deduction || 0,
          admin_deduction: d.admin_deduction || 0,
          deduction: totDed,
          net_salary: g - totDed,
          status: 'Unpaid',
        }
      })

      const { error } = await supabase.from('salary').upsert(rows, { onConflict: 'staff_id,month' })
      if (error) throw error

      // Apply advance repayments
      for (const s of filteredStaff) {
        const advDed = dedMap[s.id]?.advance_deduction || 0
        if (advDed > 0) {
          const activeAdvs = advances.filter(
            a => String(a.staff_id) === String(s.id) && a.status === 'Active'
          )
          let rem = advDed
          for (const adv of activeAdvs) {
            if (rem <= 0) break
            const advRem = Number(adv.amount) - Number(adv.repaid_amount)
            const thisRep = Math.min(rem, advRem)
            const newRepaid = Number(adv.repaid_amount) + thisRep
            await supabase
              .from('staff_advances')
              .update({
                repaid_amount: newRepaid,
                status: newRepaid >= Number(adv.amount) ? 'Fully Repaid' : 'Active',
              })
              .eq('id', adv.id)
            rem -= thisRep
          }
        }
      }

      alert(`✅ Register saved for ${fmtMonth(regMonth)}`)
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [filteredStaff, dedMap, regMonth, advances, fetchAll])

  // ── Salary Record Handlers ──

  const handleMarkPaid = useCallback(async (id) => {
    try {
      const { error } = await supabase.from('salary').update({ status: 'Paid' }).eq('id', id)
      if (error) throw error
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }, [fetchAll])

  const handleDeleteSalary = useCallback(async (id) => {
    if (!window.confirm('Delete this salary record?')) return
    try {
      const { error } = await supabase.from('salary').delete().eq('id', id)
      if (error) throw error
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }, [fetchAll])

  // ── Advance CRUD ──

  const handleAddAdvance = useCallback(async (e) => {
    e.preventDefault()
    setAdvSaving(true)
    try {
      const { error } = await supabase.from('staff_advances').insert([{
        staff_id: Number(advForm.staff_id),
        amount: Number(advForm.amount),
        reason: advForm.reason,
        issued_month: advForm.issued_month,
        repay_months: Number(advForm.repay_months) || 1,
        repaid_amount: 0,
        status: 'Active',
      }])
      if (error) throw error

      setAdvForm({ staff_id: '', amount: '', reason: '', issued_month: cm(), repay_months: 1 })
      setShowAdvForm(false)
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAdvSaving(false)
    }
  }, [advForm, fetchAll])

  const handleDeleteAdvance = useCallback(async (id) => {
    if (!window.confirm('Delete this advance?')) return
    try {
      const { error } = await supabase.from('staff_advances').delete().eq('id', id)
      if (error) throw error
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }, [fetchAll])

  // ── Render Helpers ──

  const TH = ({ children, style = {} }) => (
    <th style={{
      padding: '7px 6px',
      textAlign: 'center',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      fontSize: '12px',
      borderRight: '.5px solid rgba(255,255,255,.12)',
      ...style,
    }}>
      {children}
    </th>
  )

  // ── JSX ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>
          💵 Salary Management
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
          Salary register, advances & payroll history
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Staff', value: staff.length, color: '#1e3a5f', bg: '#eff6ff', icon: '👨‍🏫', money: false },
          { label: 'Total Paid', value: totalPaid, color: '#16a34a', bg: '#dcfce7', icon: '✅', money: true },
          { label: 'Total Unpaid', value: totalUnpaid, color: '#dc2626', bg: '#fee2e2', icon: '⏳', money: true },
          { label: 'Advance Outstanding', value: totalAdvOutstand, color: '#f59e0b', bg: '#fef3c7', icon: '💳', money: true },
        ].map(c => (
          <div key={c.label} style={{
            backgroundColor: c.bg,
            borderRadius: '12px',
            padding: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderLeft: `4px solid ${c.color}`,
          }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{c.icon}</div>
            <p style={{ fontSize: '13px', color: c.color, fontWeight: '600', margin: 0 }}>{c.label}</p>
            <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: c.color, margin: '4px 0 0' }}>
              {c.money ? fmt(c.value) : c.value}
            </h2>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', gap: '4px' }}>
        {[
          { key: 'register', label: '📋 Salary Register' },
          { key: 'advances', label: '💳 Advances' },
          { key: 'history', label: '📅 History' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={S.tab(activeTab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: REGISTER ══ */}
      {activeTab === 'register' && (
        <>
          {/* Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            background: 'white',
            padding: '12px 16px',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            marginBottom: '14px',
          }}>
            <div style={{
              background: '#1e3a5f',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '700',
            }}>
              GNSI
            </div>
            <span style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>Salary Register</span>
            <span style={{ color: '#94a3b8' }}>—</span>
            <input
              type="month"
              value={regMonth}
              onChange={e => setRegMonth(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', background: 'white' }}
            >
              <option value="">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="search"
              placeholder="Search name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', width: '150px' }}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={resetDeductions} style={S.btnSm('#64748b')}>
                Reset Deductions
              </button>
              <button onClick={() => printAllSlips(filteredStaff, dedMap, regMonth)} style={S.btnSm('#B8860B')}>
                🖨 All Slips
              </button>
              <button onClick={() => printRegister(tableRef)} style={S.btnSm('#1e3a5f')}>
                🖨 Register
              </button>
              <button onClick={handleSaveRegister} disabled={saving} style={S.btn('#16a34a', saving)}>
                {saving ? '⏳ Saving...' : '💾 Save Register'}
              </button>
            </div>
          </div>

          {/* Summary Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
            {[
              { label: 'Total Staff', value: filteredStaff.length, money: false, color: '#1e3a5f' },
              { label: 'Total Gross', value: regTotals.tG, money: true, color: '#0C447C' },
              { label: 'Total Deductions', value: regTotals.tD, money: true, color: '#791F1F' },
              { label: 'Net Payable', value: regTotals.tN, money: true, color: '#27500A' },
            ].map(c => (
              <div key={c.label} style={{
                background: 'white',
                borderRadius: '8px',
                padding: '10px 14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                border: '.5px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: c.color }}>
                  {c.money ? fmt(c.value) : c.value}
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading...</div>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a5f', color: 'white' }}>
                      <TH style={{ textAlign: 'left', paddingLeft: '12px' }}>S.N.</TH>
                      <TH style={{ textAlign: 'left', minWidth: '160px' }}>Staff Name</TH>
                      <TH style={{ textAlign: 'left', minWidth: '120px' }}>Designation</TH>
                      <TH>Basic</TH>
                      <TH>Seniority</TH>
                      <TH>Loyalty</TH>
                      <TH>Role Bonus</TH>
                      <TH style={{ background: '#254e91', minWidth: '80px' }}>Gross</TH>
                      <TH>Advance</TH>
                      <TH>Late/Absent</TH>
                      <TH style={{ background: '#7B3A00', minWidth: '80px' }}>Admin Ded.</TH>
                      <TH style={{ background: '#6B1111', minWidth: '80px' }}>Total Ded.</TH>
                      <TH style={{ background: '#1A5C1A', minWidth: '80px' }}>Net Salary</TH>
                      <TH style={{ width: '52px' }}>Slip</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s, i) => {
                      const d = dedMap[s.id] || { advance_deduction: 0, late_deduction: 0, admin_deduction: 0 }
                      const g = gross(s)
                      const td = (d.advance_deduction || 0) + (d.late_deduction || 0) + (d.admin_deduction || 0)
                      const net = g - td
                      return (
                        <tr key={s.id} style={{ borderBottom: '.5px solid #f1f5f9', background: i % 2 === 1 ? '#fafbfc' : 'white' }}>
                          <td style={{ padding: '6px 12px', color: '#64748b', textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b' }}>{s.name}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{
                              display: 'inline-block',
                              fontSize: '10px',
                              padding: '1px 7px',
                              borderRadius: '8px',
                              background: '#E6F1FB',
                              color: '#0C447C',
                              whiteSpace: 'nowrap',
                            }}>
                              {s.designation || s.department || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(s.basic_salary)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>
                            {s.seniority_allowance ? fmt(s.seniority_allowance) : '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>
                            {s.loyalty_bonus ? fmt(s.loyalty_bonus) : '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>
                            {s.role_bonus ? fmt(s.role_bonus) : '—'}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontWeight: '600',
                            background: '#E6F1FB',
                            color: '#0C447C',
                          }}>
                            {fmt(g)}
                          </td>

                          {/* Inline editable deductions */}
                          {[
                            { field: 'advance_deduction', style: {} },
                            { field: 'late_deduction', style: {} },
                            { field: 'admin_deduction', style: { background: '#FFFBEB', borderColor: '#C8960C' } },
                          ].map(({ field, style: iStyle }) => (
                            <td key={`${s.id}-${field}`} style={{ padding: '4px 6px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                value={d[field] || 0}
                                onChange={e => setDed(s.id, field, e.target.value)}
                                style={{
                                  width: '72px',
                                  padding: '3px 5px',
                                  borderRadius: '4px',
                                  border: '.5px solid #d1d5db',
                                  fontSize: '11px',
                                  textAlign: 'right',
                                  ...iStyle,
                                }}
                              />
                            </td>
                          ))}

                          <td style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontWeight: '600',
                            background: '#FCEBEB',
                            color: '#791F1F',
                          }}>
                            {td ? fmt(td) : '—'}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontWeight: '700',
                            background: '#EAF3DE',
                            color: '#27500A',
                            fontSize: '13px',
                          }}>
                            {fmt(net)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <button
                              onClick={() => setSlipStaff(s)}
                              style={{ ...S.btnSm('#1e3a5f'), padding: '3px 8px', fontSize: '11px' }}
                              aria-label={`View slip for ${s.name}`}
                            >
                              Slip
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#1e3a5f', color: 'white' }}>
                      <td colSpan={3} style={{ padding: '8px 12px', fontWeight: '600', fontSize: '12px', textAlign: 'left' }}>
                        Total — {filteredStaff.length} staff
                      </td>
                      <td colSpan={4}></td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '600' }}>{fmt(regTotals.tG)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmt(regTotals.tA)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmt(regTotals.tL)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmt(regTotals.tAd)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700' }}>{fmt(regTotals.tD)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700' }}>{fmt(regTotals.tN)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex',
                gap: '14px',
                flexWrap: 'wrap',
                fontSize: '11px',
                color: '#64748b',
                padding: '8px 14px',
                borderTop: '.5px solid #e2e8f0',
              }}>
                {[
                  { bg: '#E6F1FB', border: '#185FA5', label: 'Gross' },
                  { bg: '#FFFBEB', border: '#C8960C', label: 'Admin deduction' },
                  { bg: '#FCEBEB', border: '#A32D2D', label: 'Total deductions' },
                  { bg: '#EAF3DE', border: '#3B6D11', label: 'Net salary' },
                ].map(l => (
                  <span key={l.label}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      display: 'inline-block',
                      marginRight: '4px',
                      verticalAlign: 'middle',
                      background: l.bg,
                      border: `.5px solid ${l.border}`,
                    }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: ADVANCES ══ */}
      {activeTab === 'advances' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>💳 Advance Salary</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                Auto-deducted when saving salary register
              </p>
            </div>
            <button onClick={() => setShowAdvForm(!showAdvForm)} style={S.btn()}>
              {showAdvForm ? '✖ Cancel' : '➕ Issue Advance'}
            </button>
          </div>

          {showAdvForm && (
            <div style={S.card}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>Issue New Advance</h3>
              <form onSubmit={handleAddAdvance}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={S.lbl}>Staff Member</label>
                    <select
                      value={advForm.staff_id}
                      onChange={e => setAdvForm({ ...advForm, staff_id: e.target.value })}
                      required
                      style={{ ...S.inp, backgroundColor: 'white' }}
                    >
                      <option value="">— Select —</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>Amount (₹)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={advForm.amount}
                      onChange={e => setAdvForm({ ...advForm, amount: e.target.value })}
                      style={S.inp}
                    />
                  </div>
                  <div>
                    <label style={S.lbl}>Issued Month</label>
                    <input
                      type="month"
                      value={advForm.issued_month}
                      onChange={e => setAdvForm({ ...advForm, issued_month: e.target.value })}
                      style={S.inp}
                    />
                  </div>
                  <div>
                    <label style={S.lbl}>Repay Over (months)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={advForm.repay_months}
                      onChange={e => setAdvForm({ ...advForm, repay_months: e.target.value })}
                      style={S.inp}
                    />
                    {advForm.amount && Number(advForm.repay_months) > 1 && (
                      <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px', fontWeight: '600' }}>
                        ≈ {fmt(Math.ceil(Number(advForm.amount) / Number(advForm.repay_months)))} / month
                      </div>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={S.lbl}>Reason</label>
                    <input
                      value={advForm.reason}
                      onChange={e => setAdvForm({ ...advForm, reason: e.target.value })}
                      placeholder="Medical / Festival / Personal..."
                      style={S.inp}
                    />
                  </div>
                </div>
                <button type="submit" disabled={advSaving} style={S.btn('#7c3aed', advSaving)}>
                  {advSaving ? '⏳ Saving...' : '💳 Issue Advance'}
                </button>
              </form>
            </div>
          )}

          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['#', 'Staff', 'Amount', 'Repaid', 'Remaining', 'Per Month', 'Issued', 'Over', 'Reason', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {advances.map((a, i) => {
                  const s = staff.find(x => String(x.id) === String(a.staff_id))
                  const rem = Number(a.amount) - Number(a.repaid_amount)
                  const pm = Number(a.repay_months) > 0 ? Math.ceil(rem / Number(a.repay_months)) : rem
                  const pct = Math.min(100, Math.round((Number(a.repaid_amount) / Number(a.amount)) * 100))
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>{s?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700' }}>{fmt(a.amount)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: '#16a34a', fontWeight: '600' }}>{fmt(a.repaid_amount)}</div>
                        <div style={{
                          marginTop: '4px',
                          height: '4px',
                          background: '#e2e8f0',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          width: '60px',
                        }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a' }} />
                        </div>
                      </td>
                      <td style={{
                        padding: '10px 12px',
                        fontWeight: '700',
                        color: rem > 0 ? '#dc2626' : '#16a34a',
                      }}>
                        {fmt(rem)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#7c3aed', fontWeight: '600' }}>
                        {rem > 0 ? fmt(Math.min(pm, rem)) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{a.issued_month}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{a.repay_months} mo</td>
                      <td style={{
                        padding: '10px 12px',
                        color: '#64748b',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {a.reason || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: a.status === 'Active' ? '#fef3c7' : '#dcfce7',
                          color: a.status === 'Active' ? '#b45309' : '#16a34a',
                        }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => handleDeleteAdvance(a.id)}
                          style={S.btnSm('#dc2626')}
                          aria-label="Delete advance"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {advances.length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No advance records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ TAB: HISTORY ══ */}
      {activeTab === 'history' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>📅 Salary History</h2>
            <div>
              <label style={{ ...S.lbl, display: 'inline', marginRight: '8px' }}>Select Staff:</label>
              <select
                value={histStaffId}
                onChange={e => setHistStaffId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  minWidth: '220px',
                }}
              >
                <option value="">— Select Staff —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.designation || s.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {histStaffId && historyData.length > 0 && (
            <>
              {/* Trend Chart */}
              <div style={S.card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginTop: 0 }}>Net Salary Trend</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '100px' }}>
                  {[...historyData].reverse().map(r => {
                    const maxNet = Math.max(...historyData.map(x => x.net_salary))
                    const h = Math.max(16, (r.net_salary / maxNet) * 90)
                    return (
                      <div key={r.month} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a5f' }}>
                          {fmt(r.net_salary)}
                        </div>
                        <div style={{
                          width: '100%',
                          height: `${h}px`,
                          background: r.status === 'Paid' ? '#1e3a5f' : '#94a3b8',
                          borderRadius: '4px 4px 0 0',
                        }} />
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {r.month.slice(5)}/{r.month.slice(2, 4)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* History Table */}
              <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Month', 'Basic', 'Seniority', 'Loyalty', 'Role Bonus', 'Gross', 'Adv. Ded.', 'Late Ded.', 'Admin Ded.', 'Net Salary', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '11px 10px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(r => {
                      const s = staff.find(x => String(x.id) === String(r.staff_id))
                      const g = (r.basic_salary || 0) + (r.seniority_allowance || 0) + (r.loyalty_bonus || 0) + (r.role_bonus || 0)
                      const dedR = {
                        advance_deduction: r.advance_deduction,
                        late_deduction: r.late_deduction,
                        admin_deduction: r.admin_deduction,
                      }
                      const sForSlip = s ? {
                        ...s,
                        basic_salary: r.basic_salary,
                        seniority_allowance: r.seniority_allowance,
                        loyalty_bonus: r.loyalty_bonus,
                        role_bonus: r.role_bonus,
                        _dedOverride: dedR,
                        _monthOverride: r.month,
                      } : null
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 10px', fontWeight: '600', color: '#1e293b' }}>{r.month}</td>
                          <td style={{ padding: '10px 10px' }}>{fmt(r.basic_salary)}</td>
                          <td style={{ padding: '10px 10px', color: '#64748b' }}>{fmt(r.seniority_allowance)}</td>
                          <td style={{ padding: '10px 10px', color: '#64748b' }}>{fmt(r.loyalty_bonus)}</td>
                          <td style={{ padding: '10px 10px', color: '#64748b' }}>{fmt(r.role_bonus)}</td>
                          <td style={{
                            padding: '10px 10px',
                            color: '#0C447C',
                            fontWeight: '700',
                            background: '#E6F1FB',
                          }}>
                            {fmt(g)}
                          </td>
                          <td style={{ padding: '10px 10px', color: '#f59e0b', fontWeight: '600' }}>
                            {fmt(r.advance_deduction)}
                          </td>
                          <td style={{ padding: '10px 10px', color: '#dc2626', fontWeight: '600' }}>
                            {fmt(r.late_deduction)}
                          </td>
                          <td style={{ padding: '10px 10px', color: '#B8860B', fontWeight: '600' }}>
                            {fmt(r.admin_deduction)}
                          </td>
                          <td style={{
                            padding: '10px 10px',
                            fontWeight: '800',
                            color: '#27500A',
                            fontSize: '14px',
                            background: '#EAF3DE',
                          }}>
                            {fmt(r.net_salary)}
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: r.status === 'Paid' ? '#dcfce7' : '#fee2e2',
                              color: r.status === 'Paid' ? '#16a34a' : '#dc2626',
                            }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {sForSlip && (
                                <button
                                  onClick={() => setSlipStaff(sForSlip)}
                                  style={S.btnSm('#1e3a5f')}
                                  aria-label="View slip"
                                >
                                  🧾
                                </button>
                              )}
                              {r.status !== 'Paid' && (
                                <button
                                  onClick={() => handleMarkPaid(r.id)}
                                  style={S.btnSm('#16a34a')}
                                  aria-label="Mark as paid"
                                >
                                  ✅
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSalary(r.id)}
                                style={S.btnSm('#dc2626')}
                                aria-label="Delete record"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {histStaffId && historyData.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
              No salary records for this staff member.
            </div>
          )}
          {!histStaffId && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
              Select a staff member to view their salary history.
            </div>
          )}
        </>
      )}

      {/* Slip Modal */}
      {slipStaff && (
        <SlipModal
          s={slipStaff}
          ded={slipStaff._dedOverride || dedMap[slipStaff.id]}
          month={slipStaff._monthOverride || regMonth}
          onClose={() => setSlipStaff(null)}
        />
      )}
    </div>
  )
}

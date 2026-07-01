// Fees.jsx

import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  collectFee, deleteLegacyFeeRecord,
  upsertAccount, checkCourseFeeExists, checkFlatFeeExists,
  printReceipt, sourceRef,
  getFlatFees, getFeeRates,
  saveStudentFlatFeeOverride, clearFeeRateCache,
  revertFeeCollection, correctFeeCollectionDate,
  COURSE_RATES, FLAT_RATES,
  PAY_MODES, MONTHS_LIST, CURRENT_YEAR,
} from './feeEngine'

// ── Responsive hook ───────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Sync helpers for display/hints only (not used for saving) ─────────────────
const syncCourseFeeAmt = (course, hostelType) => COURSE_RATES[course]?.[hostelType] ?? 0
const syncFlatFeeAmt   = (hostelType) => FLAT_RATES[hostelType] ?? 0

const getSessionYear = () => {
  const yr = new Date().getFullYear()
  return new Date().getMonth() + 1 >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`
}

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

// ─── Tab: Fee Dashboard ───────────────────────────────────────────────────────

function FeeDashboardTab({ students, adm_fee_collections, adm_flat_fees, adm_course_fees, liveRows, onCollect }) {
  const w       = useWindowWidth()
  const isMobile= w < 640
  const is2Col  = w >= 640 && w < 900
  const n = v => Number(v || 0).toLocaleString('en-IN')
  const now      = new Date()
  const thisMonth= now.toLocaleString('default', { month: 'long' })
  const thisYear = now.getFullYear()
  const prevMonth= new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' })

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalCollected  = liveRows.reduce((s, r) => s + r.grandTotal, 0)
  const admTotal        = adm_fee_collections.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatTotal       = adm_flat_fees.filter(r => r.paid).reduce((s, r) => s + (r.amount || 0), 0)
  const crsfTotal       = adm_course_fees.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)

  // This month collections
  const thisMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === thisMonth && r.year === thisYear).reduce((s, r) => s + (r.amount || 0), 0)
  const thisMonthCrsf   = adm_course_fees.filter(r => r.for_month === thisMonth && r.year === thisYear).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const thisMonthTotal  = thisMonthFlat + thisMonthCrsf

  const prevMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === prevMonth).reduce((s, r) => s + (r.amount || 0), 0)
  const prevMonthCrsf   = adm_course_fees.filter(r => r.for_month === prevMonth).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const prevMonthTotal  = prevMonthFlat + prevMonthCrsf
  const monthChange     = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null

  // Today's collections
  const todayStr        = new Date().toISOString().slice(0, 10)
  const todayFlat       = adm_flat_fees.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (r.amount || 0), 0)
  const todayCrsf       = adm_course_fees.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayAdm        = adm_fee_collections.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayTotal      = todayFlat + todayCrsf + todayAdm

  // ── Student alerts ──────────────────────────────────────────────────────────
  const paidFlatGccs    = new Set(adm_flat_fees.filter(r => r.paid).map(r => gccStr(r.adm_app_id)))
  const paidCrsfGccs    = new Set(adm_course_fees.map(r => gccStr(r.adm_app_id)))
  const paidAdmGccs     = new Set(adm_fee_collections.filter(r => r.fee_type === 'admission').map(r => gccStr(r.adm_app_id)))

  const zeroPayment     = liveRows.filter(s => s.grandTotal === 0)
  const admOnlyPaid     = liveRows.filter(s => paidAdmGccs.has(gccStr(s.gcc_no)) && !paidFlatGccs.has(gccStr(s.gcc_no)) && !paidCrsfGccs.has(gccStr(s.gcc_no)))
  const repeaters       = liveRows.filter(s => s.is_repeater && s.grandTotal === 0)
  const fullyPaid       = liveRows.filter(s => paidFlatGccs.has(gccStr(s.gcc_no)) && paidCrsfGccs.has(gccStr(s.gcc_no)))

  // This month defaulters — paid no course fee this month
  const paidThisMonthCrsf = new Set(adm_course_fees.filter(r => r.for_month === thisMonth && r.year === thisYear).map(r => gccStr(r.adm_app_id)))
  const defaultersThisMonth = liveRows.filter(s => !paidThisMonthCrsf.has(gccStr(s.gcc_no)))

  // ── Monthly trend (last 6 months) ───────────────────────────────────────────
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const mon = d.toLocaleString('default', { month: 'short' })
    const yr  = d.getFullYear()
    const fullMon = d.toLocaleString('default', { month: 'long' })
    const flat = adm_flat_fees.filter(r => r.paid && r.month === fullMon && r.year === yr).reduce((s, r) => s + (r.amount || 0), 0)
    const crsf = adm_course_fees.filter(r => r.for_month === fullMon && r.year === yr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
    return { label: mon, flat, crsf, total: flat + crsf }
  })
  const maxBar = Math.max(...last6.map(m => m.total), 1)

  // ── Course-wise breakdown ───────────────────────────────────────────────────
  const courses = ['Sainik', 'Navodaya', 'Foundation', 'Combined Course']
  const courseBreakdown = courses.map(c => {
    const sts   = liveRows.filter(s => s.course === c)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { course: c, count: sts.length, total }
  }).filter(c => c.count > 0)
  const maxCourse = Math.max(...courseBreakdown.map(c => c.total), 1)

  // ── Hostel breakdown ────────────────────────────────────────────────────────
  const hostelBreakdown = ['Boarder', 'Day Boarder', 'Day Scholar'].map(h => {
    const sts   = liveRows.filter(s => s.hostel_type === h)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { type: h, count: sts.length, total }
  }).filter(h => h.count > 0)

  const COURSE_COLORS = { Sainik: '#4f46e5', Navodaya: '#059669', Foundation: '#d97706', 'Combined Course': '#7c3aed' }
  const HOSTEL_COLORS = { Boarder: '#059669', 'Day Boarder': '#d97706', 'Day Scholar': '#64748b' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
        {[{ icon: '💰', label: 'Total Collected', value: `₹${n(totalCollected)}`, color: '#1e3a5f', bg: '#eff6ff', sub: `${students.length} students` },
          { icon: '📅', label: 'This Month', value: `₹${n(thisMonthTotal)}`, color: '#059669', bg: '#f0fdf4',
            sub: monthChange !== null ? `${monthChange >= 0 ? '▲' : '▼'} ${Math.abs(monthChange)}% vs last month` : 'First month data' },
          { icon: '🌅', label: "Today's Collection", value: `₹${n(todayTotal)}`, color: '#7c3aed', bg: '#f5f3ff', sub: todayStr },
          { icon: '⚠️', label: 'No Payment Yet', value: zeroPayment.length, color: '#dc2626', bg: '#fef2f2', sub: 'students with ₹0 paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: c.color, opacity: .7, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Second row cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
        {[{ icon: '🎓', label: 'Admission Fees', value: `₹${n(admTotal)}`, color: '#4f46e5', bg: '#eef2ff' },
          { icon: '📅', label: 'Flat Fees', value: `₹${n(flatTotal)}`, color: '#059669', bg: '#f0fdf4' },
          { icon: '📚', label: 'Course Fees', value: `₹${n(crsfTotal)}`, color: '#7c3aed', bg: '#f5f3ff' },
          { icon: '✅', label: 'Fully Paid', value: fullyPaid.length, color: '#059669', bg: '#dcfce7', sub: 'flat + course both paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: c.color, fontWeight: 600, marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: c.color, opacity: .7, marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20 }}>

        {/* ── Monthly trend bar chart ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📈 Monthly Collection Trend</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Last 6 months — flat + course fees</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {last6.map(m => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>
                  {m.total > 0 ? `₹${Math.round(m.total / 1000)}k` : '—'}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ width: '100%', height: Math.max(4, Math.round((m.crsf / maxBar) * 100)), background: '#7c3aed', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ width: '100%', height: Math.max(4, Math.round((m.flat / maxBar) * 100)), background: '#059669', borderRadius: '0 0 3px 3px' }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />Course</span>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#059669', borderRadius: 2, display: 'inline-block' }} />Flat</span>
          </div>
        </div>

        {/* ── Hostel breakdown ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>🏠 Hostel Breakdown</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Collection by hostel type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hostelBreakdown.map(h => (
              <div key={h.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: HOSTEL_COLORS[h.type] || '#64748b', marginBottom: 4 }}>
                  <span>{h.type} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({h.count})</span></span>
                  <span>₹{n(h.total)}</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((h.total / (liveRows.reduce((s, r) => s + r.grandTotal, 1))) * 100)}%`, background: HOSTEL_COLORS[h.type] || '#64748b', borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Course-wise breakdown ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📚 Course-wise Collection</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Total collected per course</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courseBreakdown.map(c => (
            <div key={c.course} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '140px 1fr 80px', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COURSE_COLORS[c.course] || '#64748b' }}>{c.course} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({c.count})</span></div>
              <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((c.total / maxCourse) * 100)}%`, background: COURSE_COLORS[c.course] || '#64748b', borderRadius: 5, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: COURSE_COLORS[c.course] || '#64748b', textAlign: 'right' }}>₹{n(c.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Smart Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* No payment */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fca5a5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef2f2', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>🔴 Zero Payment Students</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{zeroPayment.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {zeroPayment.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>🎉 All students have made at least one payment</div>
              : zeroPayment.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef2f2' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* This month defaulters */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fde68a', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fffbeb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fde68a' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>🟡 {thisMonth} Course Fee Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#d97706', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{defaultersThisMonth.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {defaultersThisMonth.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>✅ All students paid course fee for {thisMonth}</div>
              : defaultersThisMonth.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fffbeb' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'} · {s.hostel_type || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#d97706', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Adm paid, no monthly yet */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #c4b5fd', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#f5f3ff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #c4b5fd' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>🟠 Adm Paid · No Monthly Yet</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{admOnlyPaid.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {admOnlyPaid.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>All students paying monthly fees</div>
              : admOnlyPaid.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f5f3ff' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Repeaters with dues */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fcd34d', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef3c7', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fcd34d' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>🔁 Repeaters — Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#92400e', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{repeaters.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {repeaters.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No repeater students with pending dues</div>
              : repeaters.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef3c7' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#92400e', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Session progress bars ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 16 }}>📊 Session Progress</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : is2Col ? '1fr 1fr' : '1fr 1fr 1fr', gap: 20 }}>
          {[
            { label: 'Paid Admission', count: paidAdmGccs.size,  color: '#4f46e5', bg: '#eef2ff' },
            { label: 'Paid Flat Fee',  count: paidFlatGccs.size, color: '#059669', bg: '#f0fdf4' },
            { label: 'Paid Course Fee',count: paidCrsfGccs.size, color: '#7c3aed', bg: '#f5f3ff' },
          ].map(p => {
            const pct = students.length > 0 ? Math.round((p.count / students.length) * 100) : 0
            return (
              <div key={p.label} style={{ background: p.bg, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>
                  <span>{p.label}</span>
                  <span>{p.count} / {students.length}</span>
                </div>
                <div style={{ height: 10, background: 'white', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 5, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Tab: Fee Payment ─────────────────────────────────────────────────────────

function FeePaymentTab({ students, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees, onRefresh, isAdmin, currentUser }) {
  const w        = useWindowWidth()
  const isMobile = w < 768
  const [step,    setStep]    = useState('select')
  const [student, setStudent] = useState(null)
  const [admRec,  setAdmRec]  = useState(null)

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

  // ── Async flat fees + rates ───────────────────────────────────────────────
  const [flatFees,  setFlatFees]  = useState([])
  const [feeRates,  setFeeRates]  = useState({ flatFee: 0, courseFee: 0, admissionFee: ADM_FEE_BASE })

  useEffect(() => {
    if (!student) return
    const gccInt = parseInt(gccStr(student.gcc_no)) || null
    getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccInt)
      .then(setFlatFees)
    getFeeRates(
      `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
      student.course || '', student.batch || '', hostelType, gccInt
    ).then(rates => {
      setFeeRates(rates)
      setHasOverride(!!rates.flatFeeOverride)
      if (rates.flatFeeOverride) {
        setOverrideAmt(String(rates.flatFeeOverride.flat_fee_override))
        setOverrideReason(rates.flatFeeOverride.reason || '')
      } else {
        setOverrideAmt('')
        setOverrideReason('')
      }
    })
  }, [student, hostelType])

  const [flatChecked, setFlatChecked] = useState([])

  // ── Repeater state ────────────────────────────────────────────────────────
  const [isRepeater,     setIsRepeater]     = useState(false)
  const [repeaterSaving, setRepeaterSaving] = useState(false)

  // ── Flat fee override state ───────────────────────────────────────────────
  const [hasOverride,      setHasOverride]      = useState(false)
  const [overrideMode,     setOverrideMode]     = useState(false)
  const [overrideAmt,      setOverrideAmt]      = useState('')
  const [overrideReason,   setOverrideReason]   = useState('')
  const [overrideSaving,   setOverrideSaving]   = useState(false)
  const [overrideFeedback, setOverrideFeedback] = useState(null)

  useEffect(() => {
    if (!student?.gcc_no) return
    supabase
      .from('students')
      .select('is_repeater')
      .eq('gcc_no', parseInt(student.gcc_no))
      .maybeSingle()
      .then(({ data }) => { if (data) setIsRepeater(!!data.is_repeater) })
  }, [student?.gcc_no])

  const toggleRepeater = async () => {
    if (!student?.gcc_no) return
    const newVal = !isRepeater
    setRepeaterSaving(true)
    await supabase
      .from('students')
      .update({ is_repeater: newVal })
      .eq('gcc_no', parseInt(student.gcc_no))
    setIsRepeater(newVal)
    setRepeaterSaving(false)
  }

  const saveOverrideInline = async () => {
    const amt = parseFloat(overrideAmt)
    if (isNaN(amt) || amt < 0) { setOverrideFeedback({ type: 'err', msg: 'Enter a valid amount.' }); return }
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, amt, overrideReason, 'admin')
      clearFeeRateCache()
      const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, student.course || '', student.batch || '', hostelType, gccInt)
      setFeeRates(rates)
      setHasOverride(true)
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccInt)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: `Flat fee set to ₹${amt.toLocaleString('en-IN')}/month.` })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Save failed.' })
    } finally { setOverrideSaving(false) }
  }

  const removeOverrideInline = async () => {
    if (!window.confirm('Remove override? This student will revert to the standard flat fee rate.')) return
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, null)
      clearFeeRateCache()
      const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, student.course || '', student.batch || '', hostelType, null)
      setFeeRates(rates)
      setHasOverride(false)
      setOverrideAmt('')
      setOverrideReason('')
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, null)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: 'Override removed. Standard rate restored.' })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Remove failed.' })
    } finally { setOverrideSaving(false) }
  }

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Admin-only revert ───────────────────────────────────────────────────
  const doRevert = async ({ table, id, label, accountSourceRef = null, accountSourceType = null }) => {
    if (!isAdmin) return
    const reason = window.prompt(`Revert "${label}"?\n\nThis removes it from the books and lets it be re-collected. Reason (optional):`)
    if (reason === null) return // cancelled
    setSaving(true)
    try {
      await revertFeeCollection({
        table, id, accountSourceRef, accountSourceType,
        revertedBy: currentUser?.name || 'Admin', reason,
      })
      showToast(`↩️ Reverted: ${label}`, '#dc2626')
      onRefresh()
    } catch (err) {
      showToast('Revert failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleRevertAdmCollection = (c) => {
    const { ref, type } = admCollectionAcct(c)
    doRevert({ table: 'adm_fee_collections', id: c.id, label: `${c.description || 'Fee'} — ₹${Number(c.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: ref, accountSourceType: type })
  }

  const handleRevertFlat = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    doRevert({ table: 'adm_flat_fees', id: r.id, label: `${r.month} ${r.year} flat fee — ₹${Number(r.amount || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee' })
  }

  const handleRevertCourseFee = (r) => {
    doRevert({ table: 'adm_course_fees', id: r.id, label: `${r.course} ${r.for_month} course fee — ₹${Number(r.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee' })
  }

  // ── Admin-only: fix a mistakenly-entered payment date (without reverting) ──
  function admCollectionAcct(c) {
    return {
      ref: c.fee_type === 'admission' ? sourceRef.admission(gcc)
        : c.fee_type === 'item' ? sourceRef.admItem(gcc, c.description === 'Prospectus' ? 'prospectus' : (c.description || '').replace(/^Dress Kit — /, ''))
        : c.fee_type === 'advance' ? c.id
        : null,
      type: c.fee_type === 'advance' ? 'advance_fee' : 'adm_fee',
    }
  }

  const handleFixDate = async ({ table, id, accountSourceRef, accountSourceType, currentDate, label }) => {
    if (!isAdmin) return
    const newDate = window.prompt(`Correct date for "${label}"\nCurrent: ${currentDate || '—'}\n\nEnter correct date (YYYY-MM-DD):`, currentDate || today())
    if (!newDate) return // cancelled
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { showToast('Invalid date — use YYYY-MM-DD', '#dc2626'); return }
    setSaving(true)
    try {
      await correctFeeCollectionDate({ table, id, newDate, accountSourceRef, accountSourceType })
      showToast(`📅 Date corrected to ${newDate}`, '#1e3a5f')
      onRefresh()
    } catch (err) {
      showToast('Date fix failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleFixAdmDate = (c) => {
    const { ref, type } = admCollectionAcct(c)
    handleFixDate({ table: 'adm_fee_collections', id: c.id, accountSourceRef: ref, accountSourceType: type, currentDate: c.pay_date, label: c.description || 'Fee' })
  }

  const handleFixFlatDate = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    handleFixDate({ table: 'adm_flat_fees', id: r.id, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee', currentDate: r.pay_date, label: `${r.month} ${r.year} flat fee` })
  }

  const handleFixCourseDate = (r) => {
    handleFixDate({ table: 'adm_course_fees', id: r.id, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee', currentDate: r.pay_date, label: `${r.course} ${r.for_month} course fee` })
  }

  const gcc = student ? gccStr(student.gcc_no) : null

  const myAdmCols  = gcc ? adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc && !c.reverted) : []
  const myFlatRecs = gcc ? adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid) : []
  const myCrsfRecs = gcc ? adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted) : []

  const admPaid      = myAdmCols.some(c => c.fee_type === 'admission')
  const paidMonths   = myFlatRecs.map(r => r.month)
  const admEverPaid  = myAdmCols.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatEverPaid = myFlatRecs.reduce((s, r) => s + (r.amount || 0), 0)
  const crsfEverPaid = myCrsfRecs.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const totalEverPaid = admEverPaid + flatEverPaid + crsfEverPaid

  const dressTotal = DRESS_ITEMS.reduce((s, i, idx) => s + (dressChecked[idx] ? i.price : 0), 0)
  const admPkgThis = admPaid ? 0 : (admFeeAmt + dressTotal + (prospChecked ? PROSPECTUS_FEE : 0))

  const selFlat  = flatFees.filter((_, i) => flatChecked[i] && !paidMonths.includes(flatFees[i]?.month))
  const flatThis = selFlat.reduce((s, f) => s + f.amount, 0)
  const crsfThis = crsfRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const advThis  = Number(advAmt) || 0
  const grandThis = admPkgThis + flatThis + crsfThis + advThis

  const handleSelect = async s => {
    setStudent(s)
    setIsRepeater(!!s.is_repeater)   // use value already loaded in students list
    const rec = admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null
    setAdmRec(rec)

    const studentFlatFees = await getFlatFees(s.hostel_type || 'Day Scholar', s.course || '', s.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, parseInt(gccStr(s.gcc_no)) || null)
    const paid = adm_flat_fees
      .filter(r => gccStr(r.adm_app_id) === gccStr(s.gcc_no) && r.paid)
      .map(r => r.month)
    setFlatChecked(studentFlatFees.map(ff => !paid.includes(ff.month)))

    const defaultCourse     = s.course && COURSE_STRUCTURE[s.course] ? s.course : ''
    const defaultHostelType = s.hostel_type || 'Day Scholar'
    const defaultBatch      = s.batch || ''

    let defaultAmt = ''
    if (defaultCourse && defaultHostelType) {
      try {
        const rates = await getFeeRates(
          `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
          defaultCourse, defaultBatch, defaultHostelType, parseInt(gccStr(s.gcc_no)) || null
        )
        defaultAmt = rates.courseFee || syncCourseFeeAmt(defaultCourse, defaultHostelType)
      } catch (_) {
        defaultAmt = syncCourseFeeAmt(defaultCourse, defaultHostelType)
      }
    }

    setCrsfRows([{
      course:     defaultCourse,
      subtype:    defaultBatch,
      hostelType: defaultHostelType,
      for_month:  '',
      amount:     defaultAmt,
    }])

    setStep('pay')
  }

  const handleBack = () => {
    setStep('select'); setStudent(null); setAdmRec(null)
    setIsRepeater(false)
    setHasOverride(false)
    setOverrideMode(false)
    setOverrideAmt('')
    setOverrideReason('')
    setOverrideFeedback(null)
    setAdmFeeAmt(ADM_FEE_BASE)
    setDressChecked(DRESS_ITEMS.map(() => true))
    setProspChecked(true)
    setFlatChecked([])
    setFlatFees([])
    setCrsfRows([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
    setAdvAmt(''); setAdvFor(''); setTxnRef('')
  }

  const updateCrsfRow = async (i, field, value) => {
    setCrsfRows(rows => {
      const updated = [...rows]
      const row = { ...updated[i], [field]: value }
      if (field === 'course') row.subtype = ''
      updated[i] = row
      return updated
    })

    if (field === 'course' || field === 'hostelType' || field === 'subtype') {
      const currentRow = crsfRows[i]
      const course     = field === 'course'     ? value : currentRow.course
      const ht         = field === 'hostelType' ? value : currentRow.hostelType || hostelType
      const batch      = field === 'subtype'    ? value : (field === 'course' ? '' : currentRow.subtype || '')
      if (course && ht) {
        try {
          const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, course, batch, ht)
          const amt = rates.courseFee || syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        } catch (_) {
          const amt = syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        }
      }
    }
  }

  const handleSave = async () => {
    if (grandThis === 0)  { showToast('Select at least one fee item', '#dc2626'); return }
    if (!admRec)          { showToast('No admission record linked to this student', '#dc2626'); return }
    setSaving(true)

    try {
      const rNo = rcptNo('INV')

      // Build the unified items array for collectFee
      const items = []

      // Admission package
      if (!admPaid && admFeeAmt > 0) {
        items.push({ kind: 'admission', amount: admFeeAmt })
        DRESS_ITEMS.forEach((ditem, i) => {
          if (dressChecked[i]) items.push({ kind: 'item', label: 'Dress Kit — ' + ditem.name, amount: ditem.price })
        })
        if (prospChecked) items.push({ kind: 'item', label: 'Prospectus', amount: PROSPECTUS_FEE })
      }

      // Flat fees
      selFlat.forEach(ff => items.push({ kind: 'flat', month: ff.month, year: ff.year, amount: ff.amount }))

      // Course fees
      crsfRows.forEach(cf => {
        if (cf.course && cf.for_month && Number(cf.amount)) {
          items.push({ kind: 'course', course: cf.course, subtype: cf.subtype || '', month: cf.for_month, year: CURRENT_YEAR, amount: Number(cf.amount) })
        }
      })

      // Advance
      if (advThis > 0) items.push({ kind: 'advance', label: advFor || 'Advance', amount: advThis })

      if (!items.length) { showToast('Nothing to collect', '#dc2626'); setSaving(false); return }

      const { sections, total } = await collectFee({
        gcc, studentName: student.name,
        admNo: admRec.adm_no || '--',
        className: student.class_name || student.batch || '',
        course: student.course || '',
        hostelType,
        payDate, payMode, txnRef: txnRef || null, collectedBy,
        studentId: student.id || null,
        receiptNo: rNo,
        items,
      })

      printReceipt({
        receipt_no: rNo, pay_date: payDate, pay_mode: payMode,
        txn_ref: txnRef || null, collected_by: collectedBy,
        student_name: student.name, adm_no: admRec.adm_no || '--',
        gcc_no: student.gcc_no || '', class_name: student.class_name || student.batch || '',
        course: student.course || '', hostel_type: hostelType,
        sections, total,
      })

      showToast(`✅ Saved & invoice printed · ${rNo}`)
      onRefresh()
      setCrsfRows([{ course: '', subtype: '', hostelType, for_month: '', amount: '' }])
      setAdvAmt(''); setAdvFor(''); setTxnRef('')
      const nowPaid = [...paidMonths, ...selFlat.map(f => f.month)]
      setFlatChecked(flatFees.map(ff => !nowPaid.includes(ff.month)))

    } catch (err) {
      showToast('Error: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  // \u2500\u2500 Select screen 'react'
import { supabase } from './supabase'
import {
  fmt, today, gccStr, rcptNo,
  collectFee, deleteLegacyFeeRecord,
  upsertAccount, checkCourseFeeExists, checkFlatFeeExists,
  printReceipt, sourceRef,
  getFlatFees, getFeeRates,
  saveStudentFlatFeeOverride, clearFeeRateCache,
  revertFeeCollection, correctFeeCollectionDate,
  COURSE_RATES, FLAT_RATES,
  PAY_MODES, MONTHS_LIST, CURRENT_YEAR,
} from './feeEngine'

// ── Responsive hook ───────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Sync helpers for display/hints only (not used for saving) ─────────────────
const syncCourseFeeAmt = (course, hostelType) => COURSE_RATES[course]?.[hostelType] ?? 0
const syncFlatFeeAmt   = (hostelType) => FLAT_RATES[hostelType] ?? 0

const getSessionYear = () => {
  const yr = new Date().getFullYear()
  return new Date().getMonth() + 1 >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`
}

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

// ─── Tab: Fee Dashboard ───────────────────────────────────────────────────────

function FeeDashboardTab({ students, adm_fee_collections, adm_flat_fees, adm_course_fees, liveRows, onCollect }) {
  const w       = useWindowWidth()
  const isMobile= w < 640
  const is2Col  = w >= 640 && w < 900
  const n = v => Number(v || 0).toLocaleString('en-IN')
  const now      = new Date()
  const thisMonth= now.toLocaleString('default', { month: 'long' })
  const thisYear = now.getFullYear()
  const prevMonth= new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' })

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalCollected  = liveRows.reduce((s, r) => s + r.grandTotal, 0)
  const admTotal        = adm_fee_collections.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatTotal       = adm_flat_fees.filter(r => r.paid).reduce((s, r) => s + (r.amount || 0), 0)
  const crsfTotal       = adm_course_fees.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)

  // This month collections
  const thisMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === thisMonth && r.year === thisYear).reduce((s, r) => s + (r.amount || 0), 0)
  const thisMonthCrsf   = adm_course_fees.filter(r => r.for_month === thisMonth && r.year === thisYear).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const thisMonthTotal  = thisMonthFlat + thisMonthCrsf

  const prevMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === prevMonth).reduce((s, r) => s + (r.amount || 0), 0)
  const prevMonthCrsf   = adm_course_fees.filter(r => r.for_month === prevMonth).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const prevMonthTotal  = prevMonthFlat + prevMonthCrsf
  const monthChange     = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null

  // Today's collections
  const todayStr        = new Date().toISOString().slice(0, 10)
  const todayFlat       = adm_flat_fees.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (r.amount || 0), 0)
  const todayCrsf       = adm_course_fees.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayAdm        = adm_fee_collections.filter(r => r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayTotal      = todayFlat + todayCrsf + todayAdm

  // ── Student alerts ──────────────────────────────────────────────────────────
  const paidFlatGccs    = new Set(adm_flat_fees.filter(r => r.paid).map(r => gccStr(r.adm_app_id)))
  const paidCrsfGccs    = new Set(adm_course_fees.map(r => gccStr(r.adm_app_id)))
  const paidAdmGccs     = new Set(adm_fee_collections.filter(r => r.fee_type === 'admission').map(r => gccStr(r.adm_app_id)))

  const zeroPayment     = liveRows.filter(s => s.grandTotal === 0)
  const admOnlyPaid     = liveRows.filter(s => paidAdmGccs.has(gccStr(s.gcc_no)) && !paidFlatGccs.has(gccStr(s.gcc_no)) && !paidCrsfGccs.has(gccStr(s.gcc_no)))
  const repeaters       = liveRows.filter(s => s.is_repeater && s.grandTotal === 0)
  const fullyPaid       = liveRows.filter(s => paidFlatGccs.has(gccStr(s.gcc_no)) && paidCrsfGccs.has(gccStr(s.gcc_no)))

  // This month defaulters — paid no course fee this month
  const paidThisMonthCrsf = new Set(adm_course_fees.filter(r => r.for_month === thisMonth && r.year === thisYear).map(r => gccStr(r.adm_app_id)))
  const defaultersThisMonth = liveRows.filter(s => !paidThisMonthCrsf.has(gccStr(s.gcc_no)))

  // ── Monthly trend (last 6 months) ───────────────────────────────────────────
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const mon = d.toLocaleString('default', { month: 'short' })
    const yr  = d.getFullYear()
    const fullMon = d.toLocaleString('default', { month: 'long' })
    const flat = adm_flat_fees.filter(r => r.paid && r.month === fullMon && r.year === yr).reduce((s, r) => s + (r.amount || 0), 0)
    const crsf = adm_course_fees.filter(r => r.for_month === fullMon && r.year === yr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
    return { label: mon, flat, crsf, total: flat + crsf }
  })
  const maxBar = Math.max(...last6.map(m => m.total), 1)

  // ── Course-wise breakdown ───────────────────────────────────────────────────
  const courses = ['Sainik', 'Navodaya', 'Foundation', 'Combined Course']
  const courseBreakdown = courses.map(c => {
    const sts   = liveRows.filter(s => s.course === c)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { course: c, count: sts.length, total }
  }).filter(c => c.count > 0)
  const maxCourse = Math.max(...courseBreakdown.map(c => c.total), 1)

  // ── Hostel breakdown ────────────────────────────────────────────────────────
  const hostelBreakdown = ['Boarder', 'Day Boarder', 'Day Scholar'].map(h => {
    const sts   = liveRows.filter(s => s.hostel_type === h)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { type: h, count: sts.length, total }
  }).filter(h => h.count > 0)

  const COURSE_COLORS = { Sainik: '#4f46e5', Navodaya: '#059669', Foundation: '#d97706', 'Combined Course': '#7c3aed' }
  const HOSTEL_COLORS = { Boarder: '#059669', 'Day Boarder': '#d97706', 'Day Scholar': '#64748b' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
        {[{ icon: '💰', label: 'Total Collected', value: `₹${n(totalCollected)}`, color: '#1e3a5f', bg: '#eff6ff', sub: `${students.length} students` },
          { icon: '📅', label: 'This Month', value: `₹${n(thisMonthTotal)}`, color: '#059669', bg: '#f0fdf4',
            sub: monthChange !== null ? `${monthChange >= 0 ? '▲' : '▼'} ${Math.abs(monthChange)}% vs last month` : 'First month data' },
          { icon: '🌅', label: "Today's Collection", value: `₹${n(todayTotal)}`, color: '#7c3aed', bg: '#f5f3ff', sub: todayStr },
          { icon: '⚠️', label: 'No Payment Yet', value: zeroPayment.length, color: '#dc2626', bg: '#fef2f2', sub: 'students with ₹0 paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: c.color, opacity: .7, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Second row cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
        {[{ icon: '🎓', label: 'Admission Fees', value: `₹${n(admTotal)}`, color: '#4f46e5', bg: '#eef2ff' },
          { icon: '📅', label: 'Flat Fees', value: `₹${n(flatTotal)}`, color: '#059669', bg: '#f0fdf4' },
          { icon: '📚', label: 'Course Fees', value: `₹${n(crsfTotal)}`, color: '#7c3aed', bg: '#f5f3ff' },
          { icon: '✅', label: 'Fully Paid', value: fullyPaid.length, color: '#059669', bg: '#dcfce7', sub: 'flat + course both paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: c.color, fontWeight: 600, marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: c.color, opacity: .7, marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20 }}>

        {/* ── Monthly trend bar chart ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📈 Monthly Collection Trend</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Last 6 months — flat + course fees</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {last6.map(m => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>
                  {m.total > 0 ? `₹${Math.round(m.total / 1000)}k` : '—'}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ width: '100%', height: Math.max(4, Math.round((m.crsf / maxBar) * 100)), background: '#7c3aed', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ width: '100%', height: Math.max(4, Math.round((m.flat / maxBar) * 100)), background: '#059669', borderRadius: '0 0 3px 3px' }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />Course</span>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#059669', borderRadius: 2, display: 'inline-block' }} />Flat</span>
          </div>
        </div>

        {/* ── Hostel breakdown ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>🏠 Hostel Breakdown</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Collection by hostel type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hostelBreakdown.map(h => (
              <div key={h.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: HOSTEL_COLORS[h.type] || '#64748b', marginBottom: 4 }}>
                  <span>{h.type} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({h.count})</span></span>
                  <span>₹{n(h.total)}</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((h.total / (liveRows.reduce((s, r) => s + r.grandTotal, 1))) * 100)}%`, background: HOSTEL_COLORS[h.type] || '#64748b', borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Course-wise breakdown ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📚 Course-wise Collection</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Total collected per course</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courseBreakdown.map(c => (
            <div key={c.course} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '140px 1fr 80px', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COURSE_COLORS[c.course] || '#64748b' }}>{c.course} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({c.count})</span></div>
              <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((c.total / maxCourse) * 100)}%`, background: COURSE_COLORS[c.course] || '#64748b', borderRadius: 5, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: COURSE_COLORS[c.course] || '#64748b', textAlign: 'right' }}>₹{n(c.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Smart Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* No payment */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fca5a5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef2f2', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>🔴 Zero Payment Students</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{zeroPayment.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {zeroPayment.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>🎉 All students have made at least one payment</div>
              : zeroPayment.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef2f2' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* This month defaulters */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fde68a', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fffbeb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fde68a' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>🟡 {thisMonth} Course Fee Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#d97706', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{defaultersThisMonth.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {defaultersThisMonth.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>✅ All students paid course fee for {thisMonth}</div>
              : defaultersThisMonth.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fffbeb' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'} · {s.hostel_type || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#d97706', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Adm paid, no monthly yet */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #c4b5fd', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#f5f3ff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #c4b5fd' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>🟠 Adm Paid · No Monthly Yet</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{admOnlyPaid.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {admOnlyPaid.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>All students paying monthly fees</div>
              : admOnlyPaid.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f5f3ff' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Repeaters with dues */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fcd34d', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef3c7', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fcd34d' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>🔁 Repeaters — Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#92400e', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{repeaters.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {repeaters.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No repeater students with pending dues</div>
              : repeaters.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef3c7' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#92400e', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Session progress bars ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 16 }}>📊 Session Progress</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : is2Col ? '1fr 1fr' : '1fr 1fr 1fr', gap: 20 }}>
          {[
            { label: 'Paid Admission', count: paidAdmGccs.size,  color: '#4f46e5', bg: '#eef2ff' },
            { label: 'Paid Flat Fee',  count: paidFlatGccs.size, color: '#059669', bg: '#f0fdf4' },
            { label: 'Paid Course Fee',count: paidCrsfGccs.size, color: '#7c3aed', bg: '#f5f3ff' },
          ].map(p => {
            const pct = students.length > 0 ? Math.round((p.count / students.length) * 100) : 0
            return (
              <div key={p.label} style={{ background: p.bg, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>
                  <span>{p.label}</span>
                  <span>{p.count} / {students.length}</span>
                </div>
                <div style={{ height: 10, background: 'white', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 5, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Tab: Fee Payment ─────────────────────────────────────────────────────────

function FeePaymentTab({ students, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees, onRefresh, isAdmin, currentUser }) {
  const w        = useWindowWidth()
  const isMobile = w < 768
  const [step,    setStep]    = useState('select')
  const [student, setStudent] = useState(null)
  const [admRec,  setAdmRec]  = useState(null)

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

  // ── Async flat fees + rates ───────────────────────────────────────────────
  const [flatFees,  setFlatFees]  = useState([])
  const [feeRates,  setFeeRates]  = useState({ flatFee: 0, courseFee: 0, admissionFee: ADM_FEE_BASE })

  useEffect(() => {
    if (!student) return
    const gccInt = parseInt(gccStr(student.gcc_no)) || null
    getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccInt)
      .then(setFlatFees)
    getFeeRates(
      `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
      student.course || '', student.batch || '', hostelType, gccInt
    ).then(rates => {
      setFeeRates(rates)
      setHasOverride(!!rates.flatFeeOverride)
      if (rates.flatFeeOverride) {
        setOverrideAmt(String(rates.flatFeeOverride.flat_fee_override))
        setOverrideReason(rates.flatFeeOverride.reason || '')
      } else {
        setOverrideAmt('')
        setOverrideReason('')
      }
    })
  }, [student, hostelType])

  const [flatChecked, setFlatChecked] = useState([])

  // ── Repeater state ────────────────────────────────────────────────────────
  const [isRepeater,     setIsRepeater]     = useState(false)
  const [repeaterSaving, setRepeaterSaving] = useState(false)

  // ── Flat fee override state ───────────────────────────────────────────────
  const [hasOverride,      setHasOverride]      = useState(false)
  const [overrideMode,     setOverrideMode]     = useState(false)
  const [overrideAmt,      setOverrideAmt]      = useState('')
  const [overrideReason,   setOverrideReason]   = useState('')
  const [overrideSaving,   setOverrideSaving]   = useState(false)
  const [overrideFeedback, setOverrideFeedback] = useState(null)

  useEffect(() => {
    if (!student?.gcc_no) return
    supabase
      .from('students')
      .select('is_repeater')
      .eq('gcc_no', parseInt(student.gcc_no))
      .maybeSingle()
      .then(({ data }) => { if (data) setIsRepeater(!!data.is_repeater) })
  }, [student?.gcc_no])

  const toggleRepeater = async () => {
    if (!student?.gcc_no) return
    const newVal = !isRepeater
    setRepeaterSaving(true)
    await supabase
      .from('students')
      .update({ is_repeater: newVal })
      .eq('gcc_no', parseInt(student.gcc_no))
    setIsRepeater(newVal)
    setRepeaterSaving(false)
  }

  const saveOverrideInline = async () => {
    const amt = parseFloat(overrideAmt)
    if (isNaN(amt) || amt < 0) { setOverrideFeedback({ type: 'err', msg: 'Enter a valid amount.' }); return }
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, amt, overrideReason, 'admin')
      clearFeeRateCache()
      const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, student.course || '', student.batch || '', hostelType, gccInt)
      setFeeRates(rates)
      setHasOverride(true)
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, gccInt)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: `Flat fee set to ₹${amt.toLocaleString('en-IN')}/month.` })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Save failed.' })
    } finally { setOverrideSaving(false) }
  }

  const removeOverrideInline = async () => {
    if (!window.confirm('Remove override? This student will revert to the standard flat fee rate.')) return
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, null)
      clearFeeRateCache()
      const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, student.course || '', student.batch || '', hostelType, null)
      setFeeRates(rates)
      setHasOverride(false)
      setOverrideAmt('')
      setOverrideReason('')
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, null)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: 'Override removed. Standard rate restored.' })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Remove failed.' })
    } finally { setOverrideSaving(false) }
  }

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Admin-only revert ───────────────────────────────────────────────────
  const doRevert = async ({ table, id, label, accountSourceRef = null, accountSourceType = null }) => {
    if (!isAdmin) return
    const reason = window.prompt(`Revert "${label}"?\n\nThis removes it from the books and lets it be re-collected. Reason (optional):`)
    if (reason === null) return // cancelled
    setSaving(true)
    try {
      await revertFeeCollection({
        table, id, accountSourceRef, accountSourceType,
        revertedBy: currentUser?.name || 'Admin', reason,
      })
      showToast(`↩️ Reverted: ${label}`, '#dc2626')
      onRefresh()
    } catch (err) {
      showToast('Revert failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleRevertAdmCollection = (c) => {
    const { ref, type } = admCollectionAcct(c)
    doRevert({ table: 'adm_fee_collections', id: c.id, label: `${c.description || 'Fee'} — ₹${Number(c.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: ref, accountSourceType: type })
  }

  const handleRevertFlat = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    doRevert({ table: 'adm_flat_fees', id: r.id, label: `${r.month} ${r.year} flat fee — ₹${Number(r.amount || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee' })
  }

  const handleRevertCourseFee = (r) => {
    doRevert({ table: 'adm_course_fees', id: r.id, label: `${r.course} ${r.for_month} course fee — ₹${Number(r.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee' })
  }

  // ── Admin-only: fix a mistakenly-entered payment date (without reverting) ──
  function admCollectionAcct(c) {
    return {
      ref: c.fee_type === 'admission' ? sourceRef.admission(gcc)
        : c.fee_type === 'item' ? sourceRef.admItem(gcc, c.description === 'Prospectus' ? 'prospectus' : (c.description || '').replace(/^Dress Kit — /, ''))
        : c.fee_type === 'advance' ? c.id
        : null,
      type: c.fee_type === 'advance' ? 'advance_fee' : 'adm_fee',
    }
  }

  const handleFixDate = async ({ table, id, accountSourceRef, accountSourceType, currentDate, label }) => {
    if (!isAdmin) return
    const newDate = window.prompt(`Correct date for "${label}"\nCurrent: ${currentDate || '—'}\n\nEnter correct date (YYYY-MM-DD):`, currentDate || today())
    if (!newDate) return // cancelled
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { showToast('Invalid date — use YYYY-MM-DD', '#dc2626'); return }
    setSaving(true)
    try {
      await correctFeeCollectionDate({ table, id, newDate, accountSourceRef, accountSourceType })
      showToast(`📅 Date corrected to ${newDate}`, '#1e3a5f')
      onRefresh()
    } catch (err) {
      showToast('Date fix failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleFixAdmDate = (c) => {
    const { ref, type } = admCollectionAcct(c)
    handleFixDate({ table: 'adm_fee_collections', id: c.id, accountSourceRef: ref, accountSourceType: type, currentDate: c.pay_date, label: c.description || 'Fee' })
  }

  const handleFixFlatDate = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    handleFixDate({ table: 'adm_flat_fees', id: r.id, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee', currentDate: r.pay_date, label: `${r.month} ${r.year} flat fee` })
  }

  const handleFixCourseDate = (r) => {
    handleFixDate({ table: 'adm_course_fees', id: r.id, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee', currentDate: r.pay_date, label: `${r.course} ${r.for_month} course fee` })
  }

  const gcc = student ? gccStr(student.gcc_no) : null

  const myAdmCols  = gcc ? adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc && !c.reverted) : []
  const myFlatRecs = gcc ? adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid) : []
  const myCrsfRecs = gcc ? adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted) : []

  const admPaid      = myAdmCols.some(c => c.fee_type === 'admission')
  const paidMonths   = myFlatRecs.map(r => r.month)
  const admEverPaid  = myAdmCols.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatEverPaid = myFlatRecs.reduce((s, r) => s + (r.amount || 0), 0)
  const crsfEverPaid = myCrsfRecs.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const totalEverPaid = admEverPaid + flatEverPaid + crsfEverPaid

  const dressTotal = DRESS_ITEMS.reduce((s, i, idx) => s + (dressChecked[idx] ? i.price : 0), 0)
  const admPkgThis = admPaid ? 0 : (admFeeAmt + dressTotal + (prospChecked ? PROSPECTUS_FEE : 0))

  const selFlat  = flatFees.filter((_, i) => flatChecked[i] && !paidMonths.includes(flatFees[i]?.month))
  const flatThis = selFlat.reduce((s, f) => s + f.amount, 0)
  const crsfThis = crsfRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const advThis  = Number(advAmt) || 0
  const grandThis = admPkgThis + flatThis + crsfThis + advThis

  const handleSelect = async s => {
    setStudent(s)
    setIsRepeater(!!s.is_repeater)   // use value already loaded in students list
    const rec = admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null
    setAdmRec(rec)

    const studentFlatFees = await getFlatFees(s.hostel_type || 'Day Scholar', s.course || '', s.batch || '', `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, parseInt(gccStr(s.gcc_no)) || null)
    const paid = adm_flat_fees
      .filter(r => gccStr(r.adm_app_id) === gccStr(s.gcc_no) && r.paid)
      .map(r => r.month)
    setFlatChecked(studentFlatFees.map(ff => !paid.includes(ff.month)))

    const defaultCourse     = s.course && COURSE_STRUCTURE[s.course] ? s.course : ''
    const defaultHostelType = s.hostel_type || 'Day Scholar'
    const defaultBatch      = s.batch || ''

    let defaultAmt = ''
    if (defaultCourse && defaultHostelType) {
      try {
        const rates = await getFeeRates(
          `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
          defaultCourse, defaultBatch, defaultHostelType, parseInt(gccStr(s.gcc_no)) || null
        )
        defaultAmt = rates.courseFee || syncCourseFeeAmt(defaultCourse, defaultHostelType)
      } catch (_) {
        defaultAmt = syncCourseFeeAmt(defaultCourse, defaultHostelType)
      }
    }

    setCrsfRows([{
      course:     defaultCourse,
      subtype:    defaultBatch,
      hostelType: defaultHostelType,
      for_month:  '',
      amount:     defaultAmt,
    }])

    setStep('pay')
  }

  const handleBack = () => {
    setStep('select'); setStudent(null); setAdmRec(null)
    setIsRepeater(false)
    setHasOverride(false)
    setOverrideMode(false)
    setOverrideAmt('')
    setOverrideReason('')
    setOverrideFeedback(null)
    setAdmFeeAmt(ADM_FEE_BASE)
    setDressChecked(DRESS_ITEMS.map(() => true))
    setProspChecked(true)
    setFlatChecked([])
    setFlatFees([])
    setCrsfRows([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
    setAdvAmt(''); setAdvFor(''); setTxnRef('')
  }

  const updateCrsfRow = async (i, field, value) => {
    setCrsfRows(rows => {
      const updated = [...rows]
      const row = { ...updated[i], [field]: value }
      if (field === 'course') row.subtype = ''
      updated[i] = row
      return updated
    })

    if (field === 'course' || field === 'hostelType' || field === 'subtype') {
      const currentRow = crsfRows[i]
      const course     = field === 'course'     ? value : currentRow.course
      const ht         = field === 'hostelType' ? value : currentRow.hostelType || hostelType
      const batch      = field === 'subtype'    ? value : (field === 'course' ? '' : currentRow.subtype || '')
      if (course && ht) {
        try {
          const rates = await getFeeRates(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, course, batch, ht)
          const amt = rates.courseFee || syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        } catch (_) {
          const amt = syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        }
      }
    }
  }

  // ── Select screen ─────────────────────────────────────────────────────────
  if (step === 'select') return (
    <div style={{ maxWidth: 540, margin: '48px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>💳</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', marginBottom: 8 }}>Collect fee payment</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Search a student to record fees and generate a combined invoice</p>
      <StudentSearch students={students} onSelect={handleSelect} placeholder="Search student by name or GCC No…" />
    </div>
  )

  // ── Payment screen ────────────────────────────────────────────────────────
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
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {student.name}
            {/* ── REPEATER badge ── */}
            {isRepeater && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '2px 9px', borderRadius: 4, border: '1px solid #fcd34d', letterSpacing: '.04em' }}>
                🔁 REPEATER
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.gcc_no && <span style={{ fontWeight: 700, color: '#1e3a5f' }}>GCC-{student.gcc_no}</span>}
            {(student.class_name || student.batch) && <span>{student.class_name || student.batch}</span>}
            {student.course && <span>{student.course}</span>}
            {admRec?.adm_no && <span style={{ color: '#4f46e5', fontWeight: 600 }}>{admRec.adm_no}</span>}
            {hostelType && <HostelBadge type={hostelType} />}
            {/* ── Flat fee display with override badge + Change button ── */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: hasOverride ? '#7c3aed' : '#059669', fontWeight: 700 }}>
                Flat fee: ₹{feeRates.flatFee.toLocaleString('en-IN')}/mo
              </span>
              {hasOverride && (
                <span style={{ fontSize: 9, fontWeight: 800, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 3, border: '1px solid #c4b5fd' }}>OVERRIDE</span>
              )}
              <button type="button" onClick={() => { setOverrideMode(m => !m); setOverrideFeedback(null) }}
                style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b' }}>
                ✏️ {overrideMode ? 'Cancel' : 'Change'}
              </button>
            </span>
            {totalEverPaid > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>₹{totalEverPaid.toLocaleString('en-IN')} prev. paid</span>}
            {/* ── REPEATER toggle ── */}
            <button
              type="button"
              onClick={toggleRepeater}
              disabled={repeaterSaving}
              title={isRepeater ? 'Remove Repeater tag' : 'Mark as Repeater (2+ years at GNSI)'}
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 4, border: `1px solid ${isRepeater ? '#fcd34d' : '#e2e8f0'}`, background: isRepeater ? '#fef3c7' : '#f8fafc', color: isRepeater ? '#92400e' : '#94a3b8', cursor: repeaterSaving ? 'not-allowed' : 'pointer' }}>
              {repeaterSaving ? '…' : isRepeater ? '✕ Remove Repeater' : '🔁 Mark Repeater'}
            </button>
          </div>
        </div>
        <button onClick={handleBack} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b' }}>← Change</button>
      </div>

      {/* ── Inline flat fee override editor ── */}
      {overrideMode && (
        <div style={{ background: '#faf5ff', border: '1.5px solid #c4b5fd', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            ✏️ Custom flat fee for {student.name} — {`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ ...lbl, fontSize: 11, color: '#7c3aed' }}>New Amount (₹/month)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8' }}>₹</span>
                <input type="number" min="0" value={overrideAmt}
                  onChange={e => setOverrideAmt(e.target.value)}
                  placeholder={String(feeRates.flatFee)}
                  style={{ ...inp, paddingLeft: 26, fontWeight: 700, color: '#7c3aed', borderColor: '#c4b5fd', fontSize: 14 }} />
              </div>
            </div>
            <div>
              <label style={{ ...lbl, fontSize: 11, color: '#7c3aed' }}>Reason (optional)</label>
              <input type="text" value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Scholarship, concession…"
                style={{ ...inp, borderColor: '#c4b5fd', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={saveOverrideInline} disabled={overrideSaving || overrideAmt === ''}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: overrideSaving || overrideAmt === '' ? 'not-allowed' : 'pointer', background: overrideSaving || overrideAmt === '' ? '#e2e8f0' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: overrideSaving || overrideAmt === '' ? '#94a3b8' : 'white' }}>
              {overrideSaving ? '⏳ Saving…' : '✅ Save Override'}
            </button>
            {hasOverride && (
              <button type="button" onClick={removeOverrideInline} disabled={overrideSaving}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>
                🗑 Remove
              </button>
            )}
          </div>
          {overrideFeedback && (
            <div style={{ marginTop: 10, padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: overrideFeedback.type === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overrideFeedback.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, color: overrideFeedback.type === 'ok' ? '#065f46' : '#b91c1c' }}>
              {overrideFeedback.type === 'ok' ? '✅' : '❌'} {overrideFeedback.msg}
            </div>
          )}
        </div>
      )}

      {!overrideMode && overrideFeedback && (
        <div style={{ background: overrideFeedback.type === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overrideFeedback.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600, color: overrideFeedback.type === 'ok' ? '#065f46' : '#b91c1c' }}>
          {overrideFeedback.type === 'ok' ? '✅' : '❌'} {overrideFeedback.msg}
        </div>
      )}

      {!admRec && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ No admission record found for GCC-{student.gcc_no || '??'}. Create one in the Admissions module first.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 20, alignItems: 'start' }}>

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
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', color: '#475569' }}>
                    <span>{c.description || 'Fee'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>₹{Number(c.amount_paid || 0).toLocaleString('en-IN')}</span>
                      {isAdmin && (
                        <>
                          <button type="button" onClick={() => handleFixAdmDate(c)} title={`Fix date (currently ${c.pay_date || '—'})`}
                            style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                            📅
                          </button>
                          <button type="button" onClick={() => handleRevertAdmCollection(c)} title="Revert this item (admin)"
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                            ↩ Revert
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#3730a3', borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                  <span>Total paid</span><span>₹{admEverPaid.toLocaleString('en-IN')}</span>
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
                  {hostelType} rate · ₹{feeRates.flatFee.toLocaleString('en-IN')}/month
                </div>
              </div>
              {flatEverPaid > 0 && <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>₹{flatEverPaid.toLocaleString('en-IN')} paid</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {flatFees.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 }}>⏳ Loading months…</div>
                : flatFees.map((ff, i) => {
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
                        {paid && isAdmin && (
                          <span style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                            <button type="button" onClick={(e) => { e.preventDefault(); handleFixFlatDate(ff.month) }} title={`Fix date (currently ${myFlatRecs.find(r => r.month === ff.month)?.pay_date || '—'})`}
                              style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              📅
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); handleRevertFlat(ff.month) }} title="Revert this month (admin)"
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              ↩ Revert
                            </button>
                          </span>
                        )}
                      </label>
                    )
                  })
              }
              {flatThis > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '9px 12px', borderRadius: 8, marginTop: 10 }}>
                  <span>Flat total</span><span>₹{flatThis.toLocaleString('en-IN')}</span>
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
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>Select course + hostel type → amount auto-fills · editable</div>
              </div>
              {crsfEverPaid > 0 && <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>₹{crsfEverPaid.toLocaleString('en-IN')} prev.</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {myCrsfRecs.length > 0 && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f5f3ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Previous</div>
                  {myCrsfRecs.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#475569', padding: '3px 0' }}>
                      <span>{r.course}{r.subtype ? ' · ' + r.subtype : ''} · {r.for_month}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#6d28d9' }}>₹{Number(r.amount_paid || 0).toLocaleString('en-IN')}</span>
                        {isAdmin && (
                          <>
                            <button type="button" onClick={() => handleFixCourseDate(r)} title={`Fix date (currently ${r.pay_date || '—'})`}
                              style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              📅
                            </button>
                            <button type="button" onClick={() => handleRevertCourseFee(r)} title="Revert this month (admin)"
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              ↩ Revert
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {crsfRows.map((row, i) => (
                <div key={i} style={{ border: '1px solid #ede9fe', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Course</label>
                      <select value={row.course} onChange={e => updateCrsfRow(i, 'course', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Select —</option>
                        {Object.keys(COURSE_STRUCTURE).map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Hostel Type</label>
                      <select value={row.hostelType} onChange={e => updateCrsfRow(i, 'hostelType', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Select —</option>
                        <option>Boarder</option><option>Day Boarder</option><option>Day Scholar</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Subtype</label>
                      {(COURSE_STRUCTURE[row.course]?.subtypes || []).length > 0
                        ? <select value={row.subtype} onChange={e => updateCrsfRow(i, 'subtype', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                            <option value="">—</option>
                            {COURSE_STRUCTURE[row.course].subtypes.map(s => <option key={s}>{s}</option>)}
                          </select>
                        : <input value={row.subtype} onChange={e => updateCrsfRow(i, 'subtype', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }} placeholder="Optional" />
                      }
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Month</label>
                      <select value={row.for_month} onChange={e => updateCrsfRow(i, 'for_month', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
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
                          · {row.hostelType} rate: ₹{syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
                        </span>
                      )}
                    </label>
                    <input type="number" value={row.amount || ''}
                      onChange={e => updateCrsfRow(i, 'amount', e.target.value)}
                      style={{ ...inp, fontSize: 12, padding: '7px 10px',
                        borderColor: row.course && row.hostelType && row.amount !== '' &&
                          Number(row.amount) !== syncCourseFeeAmt(row.course, row.hostelType)
                          ? '#f59e0b' : '#d1d5db' }}
                      placeholder={row.course && row.hostelType
                        ? `Auto: ₹${syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}`
                        : 'Select course & hostel type first'}
                    />
                    {row.course && row.hostelType && row.amount !== '' &&
                      Number(row.amount) !== syncCourseFeeAmt(row.course, row.hostelType) && (
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 3 }}>
                        ⚠ Overriding standard rate of ₹{syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky', top: 20 }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1e3a5f', marginBottom: 14 }}>💳 Payment details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><label style={lbl}>Payment mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Payment date</label><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} /></div>
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

// ─── Root: Fees page ──────────────────────────────────────────────────────────

export default function Fees() {
  const w        = useWindowWidth()
  const isMobile = w < 768
  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      return s ? JSON.parse(s).user : {}
    } catch {
      return {}
    }
  }, [])
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
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
  const [tab, setTab] = useState('dashboard')
  const [form,                setForm]          = useState({ gcc_no: '', name: '', class_name: '', course: '', amount: '', paid: '0' })

  const loadAll = async () => {
    setLoading(true)
    const [fR, sR, aR, cR, flR, crR] = await Promise.all([
      supabase.from('fees').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('*').order('name'),
      supabase.from('admissions').select('*'),
      supabase.from('adm_fee_collections').select('*').eq('reverted', false),
      supabase.from('adm_flat_fees').select('*').eq('paid', true).eq('reverted', false),
      supabase.from('adm_course_fees').select('*').eq('reverted', false),
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
    const admTotal   = adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc && !c.reverted).reduce((a, c) => a + (Number(c.amount_paid) || 0), 0)
    const flatTotal  = adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid).reduce((a, r) => a + (r.amount || 0), 0)
    const crsfTotal  = adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted).reduce((a, r) => a + (Number(r.amount_paid) || 0), 0)
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
  const handleDelete  = async id => {
    if (!isAdmin) { alert('Only admin can delete records.'); return }
    if (!window.confirm('Permanently delete this legacy fee record? This cannot be undone.')) return
    try { await deleteLegacyFeeRecord(id, currentUser?.role || 'admin'); loadAll() }
    catch (err) { alert('Delete failed: ' + err.message) }
  }

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
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'payment',   label: '💳 Fee Payment' },
    { id: 'live',      label: '📊 Live Summary' },
    { id: 'legacy',    label: '🗂️ Legacy Records' },
  ]

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>💰 Fee Management</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Dashboard · Collect · Invoice · Live summary · Legacy records</p>
        </div>
        {tab === 'legacy' && (
          <button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            {showForm ? '✖ Cancel' : '➕ Add Record'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setSf('All') }}
            style={{ padding: '9px 20px', border: 'none', borderBottom: tab === t.id ? '3px solid #1e3a5f' : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#1e3a5f' : '#64748b', marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <FeeDashboardTab
          students={students}
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          liveRows={liveRows}
          onCollect={s => setTab('payment')}
        />
      )}

      {tab === 'payment' && (
        <FeePaymentTab
          students={students} admissions={admissions}
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          onRefresh={loadAll}
          isAdmin={isAdmin} currentUser={currentUser}
        />
      )}

      {tab === 'live' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total students',  value: students.length,  color: '#1e3a5f', bg: '#eff6ff', icon: '👨‍🎓' },
              { label: 'Total collected', value: `₹${n(liveTtl)}`, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
              { label: 'Fees pending',    value: liveP,            color: '#dc2626', bg: '#fee2e2', icon: '⚠️' },
              { label: 'Fully paid',      value: liveP2,           color: '#7c3aed', bg: '#f5f3ff', icon: '🎉' },
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
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.name}
                          {s.is_repeater && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 3, border: '1px solid #fcd34d', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>🔁 RPT</span>
                          )}
                        </div>
                      </td>
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
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
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
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
                            {isAdmin && <button onClick={() => handleDelete(f.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🗑</button>}
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
}}
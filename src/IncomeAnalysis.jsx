// IncomeAnalysis.jsx
// Drop-in tab component for Accounts.jsx
// Usage: import IncomeAnalysis from './IncomeAnalysis'
// Then add ['income','📊 Income Analysis'] to your tabs array
// And render: {activeTab==='income' && <IncomeAnalysis entries={entries} today={today} isMobile={isMobile} />}

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap
} from 'recharts'

// ── constants ──────────────────────────────────────────────────────────────
const CHART_COLORS = ['#1e3a5f','#16a34a','#dc2626','#f59e0b','#7c3aed','#0891b2','#be185d','#047857','#ea580c','#0284c7']
const MONTHS_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── helpers ────────────────────────────────────────────────────────────────
const fmt      = n => '₹' + Math.round(Number(n)||0).toLocaleString('en-IN')
const monthKey = d => d ? d.slice(0,7) : ''
const pct      = (v,t) => t > 0 ? ((v/t)*100).toFixed(1)+'%' : '0%'

// Parse note field: "Course fee (April 2026) — Student Name"
//                   "Flat fee (February 2026) — Student Name"  
//                   "Admission fee — Student Name"
function parseNote(note='') {
  const result = { feeType: null, feeMonth: null, feeYear: null, studentName: null }
  if (!note) return result

  // Student name — after "— "
  const dashIdx = note.indexOf(' — ')
  if (dashIdx !== -1) result.studentName = note.slice(dashIdx + 3).trim()

  // Fee type
  const lower = note.toLowerCase()
  if (lower.includes('course fee'))     result.feeType = 'Course Fee'
  else if (lower.includes('flat fee'))  result.feeType = 'Flat Fee'
  else if (lower.includes('admission')) result.feeType = 'Admission Fee'
  else if (lower.includes('hostel'))    result.feeType = 'Hostel Fee'
  else if (lower.includes('registration')) result.feeType = 'Registration Fee'
  else if (lower.includes('donation'))  result.feeType = 'Donation'

  // Month + year from "(April 2026)"
  const match = note.match(/\((\w+)\s+(\d{4})\)/)
  if (match) {
    result.feeMonth = match[1]
    result.feeYear  = match[2]
  }

  return result
}

// ── sub-components ─────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{ backgroundColor: bg, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <p style={{ fontSize: 12, color, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color, opacity: 0.7, margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children, color='#1e3a5f' }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20, borderLeft: `4px solid ${color}` }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color, margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  )
}

function BreakdownTable({ rows, cols, emptyMsg = 'No data' }) {
  if (!rows.length) return <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>{emptyMsg}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '9px 12px', textAlign: c.right ? 'right' : 'left', fontWeight: 600, color: '#374151', fontSize: 12, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '9px 12px', textAlign: c.right ? 'right' : 'left', color: c.color?.(row[c.key]) || '#374151', fontWeight: c.bold ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MiniBar({ value, max, color = '#1e3a5f' }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ backgroundColor: '#f1f5f9', borderRadius: 999, height: 6, width: 80, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
      <div style={{ width: `${w}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function IncomeAnalysis({ entries = [], today = '', isMobile = false }) {

  // ── filters ───────────────────────────────────────────────────────────
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [catFilter,   setCatFilter]   = useState('All')
  const [modeFilter,  setModeFilter]  = useState('All')
  const [acctFilter,  setAcctFilter]  = useState('All')
  const [statusFilter,setStatusFilter]= useState('All')
  const [vhFilter,    setVhFilter]    = useState('')
  const [feeTypeFilter,setFeeTypeFilter] = useState('All')
  const [feeMonthFilter,setFeeMonthFilter] = useState('All')
  const [activeSection, setActiveSection] = useState('overview')

  // ── base: income only ─────────────────────────────────────────────────
  const incomeEntries = useMemo(() =>
    entries.filter(e => e.type === 'Income'),
  [entries])

  // ── apply filters ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return incomeEntries.filter(e => {
      const parsed = parseNote(e.note)
      if (catFilter !== 'All' && e.category !== catFilter) return false
      if (modeFilter !== 'All' && e.payment_mode !== modeFilter) return false
      if (acctFilter !== 'All' && (e.account_type || 'Cash A/c') !== acctFilter) return false
      if (statusFilter !== 'All' && (e.status || 'Confirmed') !== statusFilter) return false
      if (vhFilter && !(e.voucher_head || '').toLowerCase().includes(vhFilter.toLowerCase())) return false
      if (feeTypeFilter !== 'All' && parsed.feeType !== feeTypeFilter) return false
      if (feeMonthFilter !== 'All' && parsed.feeMonth !== feeMonthFilter) return false
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo && e.entry_date > dateTo) return false
      return true
    })
  }, [incomeEntries, catFilter, modeFilter, acctFilter, statusFilter, vhFilter, feeTypeFilter, feeMonthFilter, dateFrom, dateTo])

  const totalFiltered  = filtered.reduce((s,e) => s + Number(e.amount), 0)
  const totalConfirmed = filtered.filter(e => (e.status||'Confirmed') === 'Confirmed').reduce((s,e) => s + Number(e.amount), 0)
  const totalPending   = filtered.filter(e => e.status === 'Pending').reduce((s,e) => s + Number(e.amount), 0)
  const totalAllIncome = incomeEntries.reduce((s,e) => s + Number(e.amount), 0)
  const isFiltered     = catFilter!=='All'||modeFilter!=='All'||acctFilter!=='All'||statusFilter!=='All'||vhFilter||feeTypeFilter!=='All'||feeMonthFilter!=='All'||dateFrom||dateTo

  // ── today ─────────────────────────────────────────────────────────────
  const todayIncome = incomeEntries.filter(e => e.entry_date === today).reduce((s,e) => s + Number(e.amount), 0)
  const thisMonth   = today.slice(0,7)
  const monthIncome = incomeEntries.filter(e => monthKey(e.entry_date) === thisMonth).reduce((s,e) => s + Number(e.amount), 0)

  // ── Last 7 Days — always-visible default view, independent of the
  // dateFrom/dateTo filters above (which default to empty/all-time). Same
  // rolling-7-day-inclusive window used in Accounts.jsx and
  // AccountsDashboardBanking.jsx, so all three agree on what "last 7 days"
  // means. Anchored on `today` (the prop already passed into this
  // component) rather than `new Date()`, so it matches whatever date this
  // component's caller considers "now."
  const last7Range = useMemo(() => {
    if (!today) return { from: '', to: '' }
    const pad = n => String(n).padStart(2, '0')
    const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const toD = new Date(today)
    const fromD = new Date(toD)
    fromD.setDate(toD.getDate() - 6)
    return { from: fmtDate(fromD), to: today }
  }, [today])

  const last7Entries = useMemo(
    () => incomeEntries
      .filter(e => e.entry_date >= last7Range.from && e.entry_date <= last7Range.to)
      .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0)),
    [incomeEntries, last7Range]
  )
  const last7Total = last7Entries.reduce((s, e) => s + Number(e.amount || 0), 0)

  // Print — same window.open/write/print pattern used throughout the rest
  // of this codebase's print views, so no extra library is needed.
  const printLast7DaysIncome = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const rows = last7Entries.map((e, i) =>
      `<tr><td>${i + 1}</td><td style="font-size:11px;color:#888">${e.entry_date}</td><td>${e.category || '—'}</td><td>${(e.note || '').replace(/</g, '&lt;')}</td><td>${e.payment_mode || ''}</td><td style="text-align:right;font-weight:600">${fmt(e.amount)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>Last 7 Days Income — GNSI Portal</title><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1a2535}
      h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#16a34a;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #eee}
      .grand{background:#16a34a;color:#fff;font-weight:bold}
      @page{margin:15mm}
    </style></head><body>
    <h1>Last 7 Days — Income Report — GNSI Portal</h1>
    <p>${last7Range.from} to ${last7Range.to} · ${last7Entries.length} entries · Generated: ${new Date().toLocaleString('en-IN')}</p>
    <table><tr><th>#</th><th>Date</th><th>Category</th><th>Description</th><th>Pay Mode</th><th style="text-align:right">Amount</th></tr>
    ${rows}
    <tr class="grand"><td colspan="5">TOTAL (7 days)</td><td style="text-align:right">${fmt(last7Total)}</td></tr>
    </table></body></html>`)
    w.document.close()
    w.print()
  }

  // ── by category ───────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      if (!map[e.category]) map[e.category] = { name: e.category, amount: 0, count: 0 }
      map[e.category].amount += Number(e.amount)
      map[e.category].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── by payment mode ───────────────────────────────────────────────────
  const byMode = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      if (!map[e.payment_mode]) map[e.payment_mode] = { name: e.payment_mode, amount: 0, count: 0 }
      map[e.payment_mode].amount += Number(e.amount)
      map[e.payment_mode].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── by account type ───────────────────────────────────────────────────
  const byAccount = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const a = e.account_type || 'Cash A/c'
      if (!map[a]) map[a] = { name: a, amount: 0, count: 0 }
      map[a].amount += Number(e.amount)
      map[a].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── by voucher head ───────────────────────────────────────────────────
  const byVoucherHead = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const vh = e.voucher_head || '(Not specified)'
      if (!map[vh]) map[vh] = { name: vh, amount: 0, count: 0 }
      map[vh].amount += Number(e.amount)
      map[vh].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── by added_by (who entered it) ──────────────────────────────────────
  const byAddedBy = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const by = e.added_by || e.edited_by || 'admin'
      if (!map[by]) map[by] = { name: by, amount: 0, count: 0 }
      map[by].amount += Number(e.amount)
      map[by].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── by status ─────────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const s = e.status || 'Confirmed'
      if (!map[s]) map[s] = { name: s, amount: 0, count: 0 }
      map[s].amount += Number(e.amount)
      map[s].count++
    })
    return Object.values(map)
  }, [filtered])

  // ── by month ──────────────────────────────────────────────────────────
  const byMonth = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const m = monthKey(e.entry_date)
      if (!m) return
      if (!map[m]) map[m] = { month: m, amount: 0, count: 0 }
      map[m].amount += Number(e.amount)
      map[m].count++
    })
    return Object.values(map).sort((a,b) => a.month.localeCompare(b.month))
  }, [filtered])

  // ── by day of week ────────────────────────────────────────────────────
  const byDayOfWeek = useMemo(() => {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const map = {}
    days.forEach(d => { map[d] = { name: d, amount: 0, count: 0 } })
    filtered.forEach(e => {
      if (!e.entry_date) return
      const d = days[new Date(e.entry_date).getDay()]
      map[d].amount += Number(e.amount)
      map[d].count++
    })
    return days.map(d => map[d])
  }, [filtered])

  // ── from note: by fee type ────────────────────────────────────────────
  const byFeeType = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const { feeType } = parseNote(e.note)
      const key = feeType || 'Untagged'
      if (!map[key]) map[key] = { name: key, amount: 0, count: 0 }
      map[key].amount += Number(e.amount)
      map[key].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount)
  }, [filtered])

  // ── from note: by fee month ───────────────────────────────────────────
  const byFeeMonth = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const { feeMonth, feeYear } = parseNote(e.note)
      if (!feeMonth) return
      const key = feeYear ? `${feeMonth} ${feeYear}` : feeMonth
      if (!map[key]) map[key] = { name: key, month: feeMonth, year: feeYear||'', amount: 0, count: 0 }
      map[key].amount += Number(e.amount)
      map[key].count++
    })
    // Sort by month order
    return Object.values(map).sort((a,b) => {
      if (a.year !== b.year) return (a.year||'').localeCompare(b.year||'')
      return MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month)
    })
  }, [filtered])

  // ── from note: by student name ────────────────────────────────────────
  const byStudent = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const { studentName } = parseNote(e.note)
      if (!studentName) return
      if (!map[studentName]) map[studentName] = { name: studentName, amount: 0, count: 0 }
      map[studentName].amount += Number(e.amount)
      map[studentName].count++
    })
    return Object.values(map).sort((a,b) => b.amount - a.amount).slice(0, 50)
  }, [filtered])

  // ── cross: category × mode ────────────────────────────────────────────
  const crossCatMode = useMemo(() => {
    const modes = [...new Set(filtered.map(e => e.payment_mode))]
    const cats  = [...new Set(filtered.map(e => e.category))]
    return cats.map(cat => {
      const row = { category: cat }
      modes.forEach(mode => {
        row[mode] = filtered
          .filter(e => e.category === cat && e.payment_mode === mode)
          .reduce((s,e) => s + Number(e.amount), 0)
      })
      row._total = filtered.filter(e => e.category === cat).reduce((s,e) => s + Number(e.amount), 0)
      return row
    }).sort((a,b) => b._total - a._total)
  }, [filtered])

  // ── cross: category × account ─────────────────────────────────────────
  const crossCatAcct = useMemo(() => {
    const accts = [...new Set(filtered.map(e => e.account_type || 'Cash A/c'))]
    const cats  = [...new Set(filtered.map(e => e.category))]
    return cats.map(cat => {
      const row = { category: cat }
      accts.forEach(a => {
        row[a] = filtered
          .filter(e => e.category === cat && (e.account_type||'Cash A/c') === a)
          .reduce((s,e) => s + Number(e.amount), 0)
      })
      row._total = filtered.filter(e => e.category === cat).reduce((s,e) => s + Number(e.amount), 0)
      return row
    }).sort((a,b) => b._total - a._total)
  }, [filtered])

  // ── cross: fee type × mode ────────────────────────────────────────────
  const crossFeeMode = useMemo(() => {
    const modes    = [...new Set(filtered.map(e => e.payment_mode))]
    const feeTypes = [...new Set(filtered.map(e => parseNote(e.note).feeType || 'Untagged'))]
    return feeTypes.map(ft => {
      const row = { feeType: ft }
      modes.forEach(mode => {
        row[mode] = filtered
          .filter(e => (parseNote(e.note).feeType||'Untagged') === ft && e.payment_mode === mode)
          .reduce((s,e) => s + Number(e.amount), 0)
      })
      row._total = filtered
        .filter(e => (parseNote(e.note).feeType||'Untagged') === ft)
        .reduce((s,e) => s + Number(e.amount), 0)
      return row
    }).sort((a,b) => b._total - a._total)
  }, [filtered])

  // ── cross: voucher head × month ───────────────────────────────────────
  const crossVhMonth = useMemo(() => {
    const months = [...new Set(filtered.map(e => monthKey(e.entry_date)).filter(Boolean))].sort()
    const vhs    = [...new Set(filtered.map(e => e.voucher_head || '(Not specified)'))].slice(0, 8)
    return vhs.map(vh => {
      const row = { vh }
      months.forEach(m => {
        row[m] = filtered
          .filter(e => (e.voucher_head||'(Not specified)') === vh && monthKey(e.entry_date) === m)
          .reduce((s,e) => s + Number(e.amount), 0)
      })
      row._total = filtered.filter(e => (e.voucher_head||'(Not specified)') === vh).reduce((s,e) => s + Number(e.amount), 0)
      return row
    }).sort((a,b) => b._total - a._total)
  }, [filtered])

  // ── unique filter values ───────────────────────────────────────────────
  const allCategories  = [...new Set(incomeEntries.map(e => e.category).filter(Boolean))]
  const allModes       = [...new Set(incomeEntries.map(e => e.payment_mode).filter(Boolean))]
  const allAccounts    = [...new Set(incomeEntries.map(e => e.account_type||'Cash A/c').filter(Boolean))]
  const allFeeTypes    = [...new Set(incomeEntries.map(e => parseNote(e.note).feeType).filter(Boolean))]
  const allFeeMonths   = [...new Set(incomeEntries.map(e => parseNote(e.note).feeMonth).filter(Boolean))]
    .sort((a,b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b))

  const maxByMonth = Math.max(...byMonth.map(m => m.amount), 0)

  // ── styles ────────────────────────────────────────────────────────────
  const iStyle = { padding: '8px 11px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, backgroundColor: 'white', boxSizing: 'border-box' }
  const navBtn = (id) => ({
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 12, transition: 'all .15s',
    backgroundColor: activeSection === id ? '#1e3a5f' : '#f1f5f9',
    color: activeSection === id ? 'white' : '#64748b',
  })

  const modes = [...new Set(filtered.map(e => e.payment_mode))]
  const accts = [...new Set(filtered.map(e => e.account_type||'Cash A/c'))]
  const months = [...new Set(filtered.map(e => monthKey(e.entry_date)).filter(Boolean))].sort()

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* ── header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📊 Income Analysis</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Every possible breakdown of income entries</p>
      </div>

      {/* ── filters ── */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: isMobile ? 14 : 18, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #0891b2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0891b2' }}>🔽 Filters</span>
          {isFiltered && (
            <button onClick={() => { setCatFilter('All'); setModeFilter('All'); setAcctFilter('All'); setStatusFilter('All'); setVhFilter(''); setFeeTypeFilter('All'); setFeeMonthFilter('All'); setDateFrom(''); setDateTo('') }}
              style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✖ Clear all
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr) repeat(3,1fr)', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Payment Mode</label>
            <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              {allModes.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Account</label>
            <select value={acctFilter} onChange={e => setAcctFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              {allAccounts.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              <option>Confirmed</option>
              <option>Pending</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Fee Type (note)</label>
            <select value={feeTypeFilter} onChange={e => setFeeTypeFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              {allFeeTypes.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Fee Month (note)</label>
            <select value={feeMonthFilter} onChange={e => setFeeMonthFilter(e.target.value)} style={{ ...iStyle, width: '100%' }}>
              <option value="All">All</option>
              {allFeeMonths.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Voucher Head</label>
            <input placeholder="Search…" value={vhFilter} onChange={e => setVhFilter(e.target.value)} style={{ ...iStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...iStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...iStyle, width: '100%' }} />
          </div>
        </div>
        {isFiltered && (
          <div style={{ marginTop: 10, padding: '7px 12px', backgroundColor: '#eff6ff', borderRadius: 7, fontSize: 12, color: '#1e3a5f', fontWeight: 600 }}>
            Showing {filtered.length} entries · {fmt(totalFiltered)} of {fmt(totalAllIncome)} total income
          </div>
        )}
      </div>

      {/* ── overview summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        <SummaryCard label="Total Income" value={fmt(totalFiltered)} sub={`${filtered.length} entries`} color="#16a34a" bg="#dcfce7" icon="📈" />
        <SummaryCard label="Confirmed" value={fmt(totalConfirmed)} sub={pct(totalConfirmed, totalFiltered)} color="#1e3a5f" bg="#eff6ff" icon="✅" />
        <SummaryCard label="Pending" value={fmt(totalPending)} sub={pct(totalPending, totalFiltered)} color="#f59e0b" bg="#fffbeb" icon="⏳" />
        <SummaryCard label="Today" value={fmt(todayIncome)} sub={`This month: ${fmt(monthIncome)}`} color="#7c3aed" bg="#f3e8ff" icon="📅" />
      </div>

      {/* ── Last 7 Days — default view, shown regardless of section tab or
          the filters above ── */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: isMobile ? 14 : 18, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #16a34a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, margin: 0, color: '#0f172a' }}>🗓️ Last 7 Days — Income</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>{last7Range.from} to {last7Range.to} · {last7Entries.length} entries</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', margin: 0 }}>{fmt(last7Total)}</p>
            <button onClick={printLast7DaysIncome} style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🖨 Print</button>
          </div>
        </div>
      </div>

      {/* ── section nav ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['overview',  '📋 Overview'],
          ['byfield',   '🏷 By Field'],
          ['bynote',    '📝 By Note'],
          ['cross',     '🔀 Cross Analysis'],
          ['trend',     '📈 Trends'],
          ['entries',   '🧾 Entries'],
        ].map(([id, label]) => (
          <button key={id} style={navBtn(id)} onClick={() => setActiveSection(id)}>{label}</button>
        ))}
      </div>

      {/* ══ OVERVIEW ══ */}
      {activeSection === 'overview' && (
        <>
          {/* Category pie + Mode pie */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Section title="By Category" color="#16a34a">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
            <Section title="By Payment Mode" color="#0891b2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byMode} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {byMode.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Monthly bar */}
          <Section title="Monthly Income" color="#1e3a5f">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="amount" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Income" />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Fee type pie */}
          {byFeeType.length > 0 && (
            <Section title="By Fee Type (from Note)" color="#7c3aed">
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byFeeType} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {byFeeType.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <BreakdownTable
                  rows={byFeeType.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
                  cols={[
                    { key: 'name', label: 'Fee Type' },
                    { key: 'count', label: 'Count', right: true },
                    { key: 'amount', label: 'Amount', right: true, bold: true, render: v => fmt(v), color: () => '#16a34a' },
                    { key: 'share', label: 'Share', right: true },
                  ]}
                />
              </div>
            </Section>
          )}
        </>
      )}

      {/* ══ BY FIELD ══ */}
      {activeSection === 'byfield' && (
        <>
          {/* Category */}
          <Section title="By Category" color="#16a34a">
            <BreakdownTable
              rows={byCategory.map(r => ({ ...r, share: pct(r.amount, totalFiltered), avg: fmt(r.count ? r.amount / r.count : 0) }))}
              cols={[
                { key: 'name', label: 'Category' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#16a34a' },
                { key: 'avg', label: 'Avg / Entry', right: true },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Payment Mode */}
          <Section title="By Payment Mode" color="#0891b2">
            <BreakdownTable
              rows={byMode.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
              cols={[
                { key: 'name', label: 'Mode' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#0891b2' },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Account Type */}
          <Section title="By Account Type" color="#f59e0b">
            <BreakdownTable
              rows={byAccount.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
              cols={[
                { key: 'name', label: 'Account' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#f59e0b' },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Voucher Head */}
          <Section title="By Voucher Head (Collector)" color="#7c3aed">
            <BreakdownTable
              rows={byVoucherHead.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
              cols={[
                { key: 'name', label: 'Voucher Head' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#7c3aed' },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Added By */}
          <Section title="By Entered By (Staff)" color="#be185d">
            <BreakdownTable
              rows={byAddedBy.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
              cols={[
                { key: 'name', label: 'Entered By' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#be185d' },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Status */}
          <Section title="By Status" color="#dc2626">
            <BreakdownTable
              rows={byStatus.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
              cols={[
                { key: 'name', label: 'Status' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v) },
                { key: 'share', label: 'Share', right: true },
              ]}
            />
          </Section>

          {/* Day of week */}
          <Section title="By Day of Week" color="#047857">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="amount" fill="#047857" radius={[4, 4, 0, 0]} name="Income" />
              </BarChart>
            </ResponsiveContainer>
            <BreakdownTable
              rows={byDayOfWeek.filter(r => r.count > 0)}
              cols={[
                { key: 'name', label: 'Day' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#047857' },
              ]}
            />
          </Section>
        </>
      )}

      {/* ══ BY NOTE ══ */}
      {activeSection === 'bynote' && (
        <>
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
            💡 These breakdowns parse the <strong>Note</strong> field for patterns like <code>"Course fee (April 2026) — Student Name"</code>. Only entries with matching notes are counted.
          </div>

          {/* By Fee Type */}
          <Section title="By Fee Type (parsed from Note)" color="#7c3aed">
            {byFeeType.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No notes matching fee patterns found.</p>
              : <BreakdownTable
                  rows={byFeeType.map(r => ({ ...r, share: pct(r.amount, totalFiltered), avg: fmt(r.count ? r.amount / r.count : 0) }))}
                  cols={[
                    { key: 'name', label: 'Fee Type' },
                    { key: 'count', label: 'Entries', right: true },
                    { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#7c3aed' },
                    { key: 'avg', label: 'Avg', right: true },
                    { key: 'share', label: 'Share', right: true },
                  ]}
                />
            }
          </Section>

          {/* By Fee Month */}
          <Section title="By Fee Month (parsed from Note)" color="#0891b2">
            {byFeeMonth.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No notes with month patterns like "(April 2026)" found.</p>
              : <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byFeeMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="amount" fill="#0891b2" radius={[4, 4, 0, 0]} name="Income" />
                    </BarChart>
                  </ResponsiveContainer>
                  <BreakdownTable
                    rows={byFeeMonth.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
                    cols={[
                      { key: 'name', label: 'Fee Month' },
                      { key: 'count', label: 'Entries', right: true },
                      { key: 'amount', label: 'Total', right: true, bold: true, render: v => fmt(v), color: () => '#0891b2' },
                      { key: 'share', label: 'Share', right: true },
                    ]}
                  />
                </>
            }
          </Section>

          {/* By Student Name */}
          <Section title="By Student Name (parsed from Note)" color="#be185d">
            {byStudent.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No notes with student names after " — " found.</p>
              : <BreakdownTable
                  rows={byStudent.map(r => ({ ...r, share: pct(r.amount, totalFiltered) }))}
                  cols={[
                    { key: 'name', label: 'Student Name' },
                    { key: 'count', label: 'Entries', right: true },
                    { key: 'amount', label: 'Total Paid', right: true, bold: true, render: v => fmt(v), color: () => '#be185d' },
                    { key: 'share', label: 'Share', right: true },
                  ]}
                />
            }
          </Section>
        </>
      )}

      {/* ══ CROSS ANALYSIS ══ */}
      {activeSection === 'cross' && (
        <>
          {/* Category × Mode */}
          <Section title="Category × Payment Mode" color="#1e3a5f">
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>How each income category was paid</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                    {modes.map(m => <th key={m} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{m}</th>)}
                    <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {crossCatMode.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{row.category}</td>
                      {modes.map(m => <td key={m} style={{ padding: '9px 12px', textAlign: 'right', color: row[m] > 0 ? '#16a34a' : '#cbd5e1', fontWeight: row[m] > 0 ? 600 : 400 }}>{row[m] > 0 ? fmt(row[m]) : '—'}</td>)}
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#1e3a5f' }}>{fmt(row._total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Category × Account */}
          <Section title="Category × Account Type" color="#f59e0b">
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Which account received each income type</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                    {accts.map(a => <th key={a} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{a}</th>)}
                    <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#f59e0b', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {crossCatAcct.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{row.category}</td>
                      {accts.map(a => <td key={a} style={{ padding: '9px 12px', textAlign: 'right', color: row[a] > 0 ? '#16a34a' : '#cbd5e1', fontWeight: row[a] > 0 ? 600 : 400 }}>{row[a] > 0 ? fmt(row[a]) : '—'}</td>)}
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt(row._total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Fee Type × Mode */}
          {crossFeeMode.length > 0 && (
            <Section title="Fee Type × Payment Mode (from Note)" color="#7c3aed">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Fee Type</th>
                      {modes.map(m => <th key={m} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{m}</th>)}
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossFeeMode.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{row.feeType}</td>
                        {modes.map(m => <td key={m} style={{ padding: '9px 12px', textAlign: 'right', color: row[m] > 0 ? '#16a34a' : '#cbd5e1', fontWeight: row[m] > 0 ? 600 : 400 }}>{row[m] > 0 ? fmt(row[m]) : '—'}</td>)}
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{fmt(row._total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Voucher Head × Month */}
          {crossVhMonth.length > 0 && (
            <Section title="Voucher Head × Month" color="#be185d">
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>What each collector brought in per month</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Voucher Head</th>
                      {months.map(m => <th key={m} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{m}</th>)}
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#be185d', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossVhMonth.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{row.vh}</td>
                        {months.map(m => <td key={m} style={{ padding: '9px 12px', textAlign: 'right', color: row[m] > 0 ? '#16a34a' : '#cbd5e1', fontWeight: row[m] > 0 ? 600 : 400 }}>{row[m] > 0 ? fmt(row[m]) : '—'}</td>)}
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#be185d' }}>{fmt(row._total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ══ TRENDS ══ */}
      {activeSection === 'trend' && (
        <>
          {/* Monthly line */}
          <Section title="Monthly Income Trend" color="#1e3a5f">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Line dataKey="amount" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 4 }} name="Income" />
              </LineChart>
            </ResponsiveContainer>
            {/* Month-on-month table */}
            <BreakdownTable
              rows={byMonth.map((r, i) => {
                const prev = byMonth[i - 1]
                const diff = prev ? r.amount - prev.amount : null
                return {
                  ...r,
                  prev: prev ? fmt(prev.amount) : '—',
                  change: diff !== null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—',
                  pctChange: diff !== null && prev?.amount > 0 ? (diff >= 0 ? '+' : '') + ((diff / prev.amount) * 100).toFixed(1) + '%' : '—',
                  _diff: diff,
                }
              })}
              cols={[
                { key: 'month', label: 'Month' },
                { key: 'count', label: 'Entries', right: true },
                { key: 'amount', label: 'Income', right: true, bold: true, render: v => fmt(v), color: () => '#16a34a' },
                { key: 'prev', label: 'Prev Month', right: true },
                { key: 'change', label: 'Change', right: true, color: (v, row) => !row || row._diff === null ? '#94a3b8' : row._diff >= 0 ? '#16a34a' : '#dc2626' },
{ key: 'pctChange', label: '% Change', right: true, color: (v, row) => !row || row._diff === null ? '#94a3b8' : row._diff >= 0 ? '#16a34a' : '#dc2626' },
              ]}
            />
          </Section>

          {/* Category stacked by month */}
          {byMonth.length > 0 && (
            <Section title="Category Breakdown by Month" color="#16a34a">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(() => {
                  const cats = [...new Set(filtered.map(e => e.category))]
                  return byMonth.map(m => {
                    const row = { month: m.month }
                    cats.forEach(cat => {
                      row[cat] = filtered.filter(e => monthKey(e.entry_date) === m.month && e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
                    })
                    return row
                  })
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  {[...new Set(filtered.map(e => e.category))].map((cat, i) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Fee month trend */}
          {byFeeMonth.length > 0 && (
            <Section title="Fee Month Collection Trend (from Note)" color="#0891b2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byFeeMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="amount" fill="#0891b2" radius={[4, 4, 0, 0]} name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </>
      )}

      {/* ══ ENTRIES ══ */}
      {activeSection === 'entries' && (
        <Section title={`All Matching Entries (${filtered.length})`} color="#1e3a5f">
          {filtered.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No entries match current filters.</p>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['#', 'Date', 'Category', 'Amount', 'Mode', 'Account', 'Voucher Head', 'Status', 'Fee Type', 'Fee Month', 'Student', 'Note'].map(h => (
                        <th key={h} style={{ padding: '9px 10px', textAlign: h === 'Amount' ? 'right' : 'left', fontWeight: 600, color: '#374151', fontSize: 11, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((e, i) => {
                      const parsed = parseNote(e.note)
                      return (
                        <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#374151' }}>{e.entry_date}</td>
                          <td style={{ padding: '8px 10px', color: '#1e293b', fontWeight: 500 }}>{e.category}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>{fmt(e.amount)}</td>
                          <td style={{ padding: '8px 10px', color: '#374151' }}>{e.payment_mode}</td>
                          <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{e.account_type || 'Cash A/c'}</td>
                          <td style={{ padding: '8px 10px', color: '#7c3aed', fontWeight: 500, whiteSpace: 'nowrap' }}>{e.voucher_head || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, backgroundColor: e.status === 'Pending' ? '#fef3c7' : '#dcfce7', color: e.status === 'Pending' ? '#92400e' : '#166534' }}>
                              {e.status || 'Confirmed'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#7c3aed', whiteSpace: 'nowrap' }}>{parsed.feeType || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#0891b2', whiteSpace: 'nowrap' }}>{parsed.feeMonth ? `${parsed.feeMonth} ${parsed.feeYear || ''}` : '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#be185d', whiteSpace: 'nowrap' }}>{parsed.studentName || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note || '—'}</td>
                        </tr>
                      )
                    })}
                    {filtered.length > 200 && (
                      <tr><td colSpan={12} style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Showing first 200 of {filtered.length} entries. Use filters to narrow down.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
          }
        </Section>
      )}

    </div>
  )
}
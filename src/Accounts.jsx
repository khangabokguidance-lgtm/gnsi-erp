import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ── constants ──────────────────────────────────────────────────────────────
const INCOME_CATEGORIES  = ['Admission', 'Fees', 'Hostel', 'Donation', 'Registration', 'Other']
const EXPENSE_CATEGORIES = ['Salary', 'Electricity', 'Stationery', 'Maintenance', 'Transport', 'Event', 'Other']
const PAYMENT_MODES      = ['Cash', 'Bank', 'UPI', 'Card']
const CHART_COLORS       = ['#1e3a5f','#16a34a','#dc2626','#f59e0b','#7c3aed','#0891b2','#be185d','#047857']
const STATUS_OPTIONS     = ['Confirmed', 'Pending']
const PAGE_SIZES         = [25, 50, 100]
const RECEIPT_BUCKET     = 'account-receipts'

const emptyRow = {
  entry_date   : new Date().toLocaleDateString('en-CA'),
  type         : 'Income',
  category     : '',
  amount       : '',
  payment_mode : 'Cash',
  note         : '',
  is_recurring : false,
  receipt_url  : '',
  status       : 'Confirmed',
}

const DEFAULT_BUDGETS = {
  Salary: 0, Electricity: 0, Stationery: 0,
  Maintenance: 0, Transport: 0, Event: 0, Other: 0,
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt   = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const monthKey = (d) => d ? d.slice(0, 7) : ''
const today = new Date().toLocaleDateString('en-CA')

function getQuickRange(key) {
  const now   = new Date()
  const yyyy  = now.getFullYear()
  const mm    = String(now.getMonth() + 1).padStart(2, '0')
  const dd    = String(now.getDate()).padStart(2, '0')
  const pad   = (n) => String(n).padStart(2, '0')
  if (key === 'today')      return { from: today, to: today }
  if (key === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay())
    const from = d.toLocaleDateString('en-CA')
    return { from, to: today }
  }
  if (key === 'month')      return { from: `${yyyy}-${mm}-01`, to: today }
  if (key === 'lastmonth') {
    const d = new Date(yyyy, now.getMonth() - 1, 1)
    const last = new Date(yyyy, now.getMonth(), 0)
    return {
      from: `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`,
      to  : `${last.getFullYear()}-${pad(last.getMonth()+1)}-${pad(last.getDate())}`,
    }
  }
  if (key === 'year')       return { from: `${yyyy}-01-01`, to: today }
  return { from: '', to: '' }
}

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon, isCurrency = true, sub }) {
  return (
    <div style={{
      backgroundColor: bg, borderRadius: 12, padding: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <p style={{ fontSize: 13, color, fontWeight: 600, margin: 0 }}>{label}</p>
      <h2 style={{ fontSize: 22, fontWeight: 'bold', color, marginTop: 4, marginBottom: 0 }}>
        {isCurrency ? fmt(value) : value}
      </h2>
      {sub && <p style={{ fontSize: 11, color, opacity: 0.7, marginTop: 2, marginBottom: 0 }}>{sub}</p>}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────
function Accounts({ role }) {
  const isAdmin = role === 'admin'

  // data
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  // receipt
  const [receiptFile,       setReceiptFile]       = useState(null)
  const [uploadingReceipt,  setUploadingReceipt]  = useState(false)
  const [viewReceipt,       setViewReceipt]       = useState(null)
  const fileInputRef = useRef(null)

  // tabs
  const [activeTab, setActiveTab] = useState('transactions')

  // form — supports multiple rows (batch add)
  const [showForm,   setShowForm]   = useState(false)
  const [editEntry,  setEditEntry]  = useState(null)
  const [rows,       setRows]       = useState([{ ...emptyRow }])  // batch rows

  // filters
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [modeFilter,   setModeFilter]   = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [activeQuick,  setActiveQuick]  = useState('')
  const [sortField,    setSortField]    = useState('entry_date')
  const [sortDir,      setSortDir]      = useState('desc')

  // pagination
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // bulk select
  const [selected, setSelected] = useState(new Set())

  // budgets — Supabase-backed with localStorage fallback
  const [budgets,     setBudgets]     = useState(DEFAULT_BUDGETS)
  const [editBudgets, setEditBudgets] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(DEFAULT_BUDGETS)

  // AI insights
  const [insights,  setInsights]  = useState('')
  const [loadingAI, setLoadingAI] = useState(false)

  // P&L modal
  const [showPL, setShowPL] = useState(false)
  const [plMonth, setPlMonth] = useState(today.slice(0,7))

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at',  { ascending: false })
    if (error) console.error('Error fetching accounts:', error)
    else setEntries(data || [])
    setLoading(false)
  }, [])

  const fetchBudgets = useCallback(async () => {
    // try Supabase budgets table first
    const { data, error } = await supabase.from('account_budgets').select('*').single()
    if (!error && data?.budgets) {
      setBudgets(data.budgets)
      setBudgetDraft(data.budgets)
    } else {
      // fallback localStorage
      try {
        const b = JSON.parse(localStorage.getItem('acc_budgets') || 'null')
        if (b) { setBudgets(b); setBudgetDraft(b) }
      } catch {}
    }
  }, [])

  useEffect(() => { fetchEntries(); fetchBudgets() }, [fetchEntries, fetchBudgets])

  // ── recurring ────────────────────────────────────────────────────────────
  useEffect(() => {
    const lastRun = localStorage.getItem('acc_recurring_run')
    if (lastRun === today) return
    const recurring  = entries.filter(e => e.is_recurring)
    if (!recurring.length) return
    const thisMonth  = today.slice(0, 7)
    const existing   = entries.map(e => `${e.category}-${monthKey(e.entry_date)}-${e.amount}`)
    const toInsert   = recurring
      .filter(e => monthKey(e.entry_date) !== thisMonth)
      .filter(e => !existing.includes(`${e.category}-${thisMonth}-${e.amount}`))
      .map(({ id, created_at, entry_date, ...rest }) => ({
        ...rest,
        entry_date: `${thisMonth}-${entry_date.slice(8)}`,
      }))
    if (toInsert.length) {
      supabase.from('accounts').insert(toInsert).then(() => {
        fetchEntries()
        localStorage.setItem('acc_recurring_run', today)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  // ── quick date filter ────────────────────────────────────────────────────
  const applyQuick = (key) => {
    const { from, to } = getQuickRange(key)
    setDateFrom(from); setDateTo(to)
    setActiveQuick(key); setPage(1)
  }
  const clearQuick = () => {
    setDateFrom(''); setDateTo('')
    setActiveQuick(''); setPage(1)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditEntry(null)
    setRows([{ ...emptyRow }])
    setReceiptFile(null)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditEntry(item)
    setRows([{
      entry_date  : item.entry_date,
      type        : item.type,
      category    : item.category,
      amount      : String(item.amount),
      payment_mode: item.payment_mode,
      note        : item.note || '',
      is_recurring: !!item.is_recurring,
      receipt_url : item.receipt_url || '',
      status      : item.status || 'Confirmed',
    }])
    setReceiptFile(null)
    setShowForm(true)
    setActiveTab('transactions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openDuplicate = (item) => {
    setEditEntry(null)
    setRows([{
      entry_date  : today,
      type        : item.type,
      category    : item.category,
      amount      : String(item.amount),
      payment_mode: item.payment_mode,
      note        : item.note || '',
      is_recurring: false,
      receipt_url : '',
      status      : 'Confirmed',
    }])
    setReceiptFile(null)
    setShowForm(true)
    setActiveTab('transactions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const uploadReceipt = async (entryId) => {
    if (!receiptFile) return rows[0]?.receipt_url || null
    setUploadingReceipt(true)
    const ext  = receiptFile.name.split('.').pop()
    const path = `${entryId || Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(RECEIPT_BUCKET).upload(path, receiptFile, { upsert: true })
    if (upErr) { alert('Receipt upload failed: ' + upErr.message); setUploadingReceipt(false); return null }
    const { data } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
    setUploadingReceipt(false)
    return data.publicUrl
  }

  const deleteReceipt = async (item) => {
    if (!item.receipt_url) return
    const path = item.receipt_url.split('/').pop()
    await supabase.storage.from(RECEIPT_BUCKET).remove([path])
    await supabase.from('accounts').update({ receipt_url: null }).eq('id', item.id)
    fetchEntries()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    if (editEntry) {
      // single row update
      const r   = rows[0]
      const receiptUrl = await uploadReceipt(editEntry.id)
      const payload = {
        entry_date  : r.entry_date,
        type        : r.type,
        category    : r.category,
        amount      : Number(r.amount) || 0,
        payment_mode: r.payment_mode,
        note        : r.note,
        is_recurring: r.is_recurring,
        status      : r.status,
        receipt_url : receiptUrl,
      }
      const { error } = await supabase.from('accounts').update(payload).eq('id', editEntry.id)
      if (error) alert('Error: ' + error.message)
      else { setShowForm(false); setEditEntry(null); setReceiptFile(null); fetchEntries() }
    } else {
      // batch insert
      const payloads = rows.map(r => ({
        entry_date  : r.entry_date,
        type        : r.type,
        category    : r.category,
        amount      : Number(r.amount) || 0,
        payment_mode: r.payment_mode,
        note        : r.note,
        is_recurring: r.is_recurring,
        status      : r.status,
      }))
      const { data: inserted, error } = await supabase.from('accounts').insert(payloads).select()
      if (error) alert('Error: ' + error.message)
      else {
        // upload receipt only for first row
        if (receiptFile && inserted?.[0]) {
          const receiptUrl = await uploadReceipt(inserted[0].id)
          if (receiptUrl)
            await supabase.from('accounts').update({ receipt_url: receiptUrl }).eq('id', inserted[0].id)
        }
        setShowForm(false); setReceiptFile(null); setRows([{ ...emptyRow }]); fetchEntries()
      }
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this transaction?')) {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) alert('Error: ' + error.message)
      else fetchEntries()
    }
  }

  // ── bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selected.size) return
    if (!window.confirm(`Delete ${selected.size} selected transaction(s)?`)) return
    const ids = [...selected]
    const { error } = await supabase.from('accounts').delete().in('id', ids)
    if (error) alert('Error: ' + error.message)
    else { setSelected(new Set()); fetchEntries() }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === pagedEntries.length)
      setSelected(new Set())
    else
      setSelected(new Set(pagedEntries.map(e => e.id)))
  }

  // ── batch row helpers ────────────────────────────────────────────────────
  const updateRow = (i, key, val) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  const addRow = () => setRows(prev => [...prev, { ...emptyRow }])
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  // ── filtering + sorting ──────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = entries.filter(item => {
      if (typeFilter   !== 'All' && item.type         !== typeFilter)   return false
      if (modeFilter   !== 'All' && item.payment_mode !== modeFilter)   return false
      if (statusFilter !== 'All' && (item.status || 'Confirmed') !== statusFilter) return false
      if (dateFrom && item.entry_date < dateFrom) return false
      if (dateTo   && item.entry_date > dateTo)   return false
      const q = search.toLowerCase()
      return (
        (item.category     || '').toLowerCase().includes(q) ||
        (item.payment_mode || '').toLowerCase().includes(q) ||
        (item.note         || '').toLowerCase().includes(q) ||
        (item.type         || '').toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      let av = a[sortField], bv = b[sortField]
      if (sortField === 'amount') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
    return list
  }, [entries, search, typeFilter, modeFilter, statusFilter, dateFrom, dateTo, sortField, sortDir])

  // running balance (date-sorted asc for calc)
  const runningBalanceMap = useMemo(() => {
    const sorted = [...filteredEntries].sort((a, b) => {
      if (a.entry_date < b.entry_date) return -1
      if (a.entry_date > b.entry_date) return 1
      return 0
    })
    let balance = 0
    const map = {}
    sorted.forEach(e => {
      balance += e.type === 'Income' ? Number(e.amount) : -Number(e.amount)
      map[e.id] = balance
    })
    return map
  }, [filteredEntries])

  // pagination
  const totalPages   = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
  const pagedEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize)

  // ── totals (respect date filter) ─────────────────────────────────────────
  const filteredIncome  = filteredEntries.filter(e => e.type === 'Income' && (e.status || 'Confirmed') === 'Confirmed').reduce((s, e) => s + Number(e.amount), 0)
  const filteredExpense = filteredEntries.filter(e => e.type === 'Expense' && (e.status || 'Confirmed') === 'Confirmed').reduce((s, e) => s + Number(e.amount), 0)
  const filteredNet     = filteredIncome - filteredExpense
  const pendingCount    = entries.filter(e => e.status === 'Pending').length

  const totalIncome  = entries.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense = entries.filter(e => e.type === 'Expense').reduce((s, e) => s + Number(e.amount), 0)

  const todayIncome  = entries.filter(e => e.type === 'Income'  && e.entry_date === today).reduce((s, e) => s + Number(e.amount), 0)
  const todayExpense = entries.filter(e => e.type === 'Expense' && e.entry_date === today).reduce((s, e) => s + Number(e.amount), 0)
  const todayNet     = todayIncome - todayExpense
  const todayCount   = entries.filter(e => e.entry_date === today).length

  const isFiltered   = dateFrom || dateTo || typeFilter !== 'All' || modeFilter !== 'All' || statusFilter !== 'All' || search

  // ── chart data ────────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const m = monthKey(e.entry_date)
      if (!m) return
      if (!map[m]) map[m] = { month: m, Income: 0, Expense: 0 }
      map[m][e.type] += Number(e.amount)
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [entries])

  const categoryData = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!map[e.category]) map[e.category] = { name: e.category, value: 0, type: e.type }
      map[e.category].value += Number(e.amount)
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [entries])

  const modeData = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!map[e.payment_mode]) map[e.payment_mode] = { name: e.payment_mode, value: 0 }
      map[e.payment_mode].value += Number(e.amount)
    })
    return Object.values(map)
  }, [entries])

  // ── P&L data ─────────────────────────────────────────────────────────────
  const plData = useMemo(() => {
    const thisM  = entries.filter(e => e.entry_date.startsWith(plMonth))
    const prevM  = (() => {
      const [y, m] = plMonth.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      return entries.filter(e => e.entry_date.startsWith(key))
    })()
    const sumBy = (arr, type) => {
      const map = {}
      arr.filter(e => e.type === type).forEach(e => {
        map[e.category] = (map[e.category] || 0) + Number(e.amount)
      })
      return map
    }
    const thisInc  = sumBy(thisM,  'Income')
    const thisExp  = sumBy(thisM,  'Expense')
    const prevInc  = sumBy(prevM,  'Income')
    const prevExp  = sumBy(prevM,  'Expense')
    const totalThisInc  = Object.values(thisInc).reduce((s, v) => s + v, 0)
    const totalThisExp  = Object.values(thisExp).reduce((s, v) => s + v, 0)
    const totalPrevInc  = Object.values(prevInc).reduce((s, v) => s + v, 0)
    const totalPrevExp  = Object.values(prevExp).reduce((s, v) => s + v, 0)
    return { thisInc, thisExp, prevInc, prevExp, totalThisInc, totalThisExp, totalPrevInc, totalPrevExp }
  }, [entries, plMonth])

  // ── budget this month ─────────────────────────────────────────────────────
  const thisMonth = today.slice(0, 7)
  const monthlyExpenses = useMemo(() => {
    const map = {}
    entries.filter(e => e.type === 'Expense' && monthKey(e.entry_date) === thisMonth)
      .forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount) })
    return map
  }, [entries, thisMonth])

  // multi-month budget chart
  const budgetChartData = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
    }
    return months.map(m => {
      const row = { month: m }
      EXPENSE_CATEGORIES.forEach(cat => {
        row[cat] = entries
          .filter(e => e.type === 'Expense' && e.category === cat && monthKey(e.entry_date) === m)
          .reduce((s, e) => s + Number(e.amount), 0)
        row[`${cat}_budget`] = Number(budgets[cat]) || 0
      })
      return row
    })
  }, [entries, budgets])

  const saveBudgets = async () => {
    setBudgets(budgetDraft)
    localStorage.setItem('acc_budgets', JSON.stringify(budgetDraft))
    // try Supabase upsert
    await supabase.from('account_budgets').upsert({ id: 1, budgets: budgetDraft })
    setEditBudgets(false)
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ['Date', 'Type', 'Category', 'Amount', 'Mode', 'Status', 'Note']
    const rows_  = filteredEntries.map(e =>
      [e.entry_date, e.type, e.category, e.amount, e.payment_mode, e.status || 'Confirmed', e.note || '']
    )
    const csv  = [header, ...rows_].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'accounts.csv' })
    a.click(); URL.revokeObjectURL(url)
  }

  // ── print P&L ─────────────────────────────────────────────────────────────
  const printPL = () => {
    const w = window.open('', '_blank')
    const { thisInc, thisExp, totalThisInc, totalThisExp } = plData
    const net = totalThisInc - totalThisExp
    w.document.write(`
      <html><head><title>P&L Statement - ${plMonth}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
        h1{font-size:22px;margin-bottom:4px}
        h2{font-size:15px;font-weight:600;margin:20px 0 8px;color:#1e3a5f}
        p{font-size:13px;color:#64748b;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
        th{background:#f8fafc;padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151}
        td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
        .total{font-weight:bold;background:#f8fafc}
        .green{color:#16a34a}.red{color:#dc2626}.blue{color:#1e3a5f}
      </style></head><body>
      <h1>Income & Expenditure Statement</h1>
      <p>Period: ${plMonth} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>
      <h2>Income</h2>
      <table><tr><th>Category</th><th>Amount</th></tr>
        ${Object.entries(thisInc).map(([k,v]) => `<tr><td>${k}</td><td class="green">${fmt(v)}</td></tr>`).join('')}
        <tr class="total"><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr>
      </table>
      <h2>Expenditure</h2>
      <table><tr><th>Category</th><th>Amount</th></tr>
        ${Object.entries(thisExp).map(([k,v]) => `<tr><td>${k}</td><td class="red">${fmt(v)}</td></tr>`).join('')}
        <tr class="total"><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr>
      </table>
      <h2>Summary</h2>
      <table><tr><th>Item</th><th>Amount</th></tr>
        <tr><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr>
        <tr><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr>
        <tr class="total"><td>Net Surplus / Deficit</td><td class="${net>=0?'green':'red'}">${fmt(net)}</td></tr>
      </table>
      </body></html>`)
    w.document.close()
    w.print()
  }

  // ── AI insights ───────────────────────────────────────────────────────────
  const getInsights = async () => {
    setLoadingAI(true); setInsights('')
    const summary = {
      totalIncome, totalExpense, netBalance: totalIncome - totalExpense,
      pendingCount,
      topExpenseCategories: categoryData.filter(c => c.type === 'Expense').slice(0, 3),
      monthlyTrend: monthlyData.slice(-3),
      budgetAlerts: Object.entries(budgets)
        .filter(([cat, limit]) => limit > 0 && (monthlyExpenses[cat] || 0) > limit)
        .map(([cat]) => cat),
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: 'You are a concise financial advisor. Give 4-5 bullet-point insights based on the data. Use ₹ for amounts. Be specific and actionable. No preamble.',
          messages: [{ role: 'user', content: `Analyze this school accounts data: ${JSON.stringify(summary)}` }],
        }),
      })
      const data = await res.json()
      setInsights(data.content?.[0]?.text || 'No insights available.')
    } catch { setInsights('Failed to load AI insights. Please try again.') }
    setLoadingAI(false)
  }

  // ── sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }
  const sortArrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // ── styles ────────────────────────────────────────────────────────────────
  const tabStyle = (t) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 13,
    backgroundColor: activeTab === t ? '#1e3a5f' : '#f1f5f9',
    color          : activeTab === t ? 'white'   : '#64748b',
    transition     : 'all .15s',
  })

  const qBtn = (key, label) => ({
    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, transition: 'all .15s',
    backgroundColor: activeQuick === key ? '#1e3a5f' : '#f1f5f9',
    color          : activeQuick === key ? 'white'   : '#64748b',
  })

  const recurringEntries = entries.filter(e => e.is_recurring)

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: 24, fontFamily: 'inherit' }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>💼 Accounts</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Manage income & expense transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowPL(true)}
            style={{ backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            📋 P&L Report
          </button>
          <button onClick={exportCSV}
            style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ⬇ Export CSV
          </button>
          {isAdmin && (
            <button onClick={() => (showForm && !editEntry) ? setShowForm(false) : openAdd()}
              style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              {showForm && !editEntry ? '✖ Cancel' : '➕ Add Entry'}
            </button>
          )}
        </div>
      </div>

      {/* ── stat cards (filter-aware) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 16 }}>
        <StatCard
          label={isFiltered ? 'Income (filtered)' : 'Total Income'}
          value={isFiltered ? filteredIncome : totalIncome}
          color="#16a34a" bg="#dcfce7" icon="📈"
          sub={isFiltered ? `All-time: ${fmt(totalIncome)}` : null}
        />
        <StatCard
          label={isFiltered ? 'Expense (filtered)' : 'Total Expense'}
          value={isFiltered ? filteredExpense : totalExpense}
          color="#dc2626" bg="#fee2e2" icon="📉"
          sub={isFiltered ? `All-time: ${fmt(totalExpense)}` : null}
        />
        <StatCard
          label={isFiltered ? 'Net (filtered)' : 'Net Balance'}
          value={isFiltered ? filteredNet : totalIncome - totalExpense}
          color="#1e3a5f" bg="#eff6ff" icon="💼"
        />
        <StatCard label="Transactions" value={entries.length} color="#7c3aed" bg="#f3e8ff" icon="🧾" isCurrency={false} />
        <StatCard label="Pending" value={pendingCount} color="#f59e0b" bg="#fffbeb" icon="⏳" isCurrency={false}
          sub={pendingCount > 0 ? 'Uncleared entries' : 'All confirmed'} />
      </div>

      {/* ── today's summary ── */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '14px 20px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #1e3a5f' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>Today's Summary</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {todayCount === 0 && <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No transactions today</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: "Today's Income",  value: todayIncome,  color: '#16a34a', bg: '#f0fdf4', icon: '⬆️' },
            { label: "Today's Expense", value: todayExpense, color: '#dc2626', bg: '#fff5f5', icon: '⬇️' },
            { label: "Today's Net",     value: todayNet,     color: todayNet >= 0 ? '#1e3a5f' : '#dc2626', bg: '#eff6ff', icon: todayNet >= 0 ? '✅' : '⚠️' },
            { label: "Today's Entries", value: todayCount,   color: '#7c3aed', bg: '#faf5ff', icon: '🔢', isCurrency: false },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${card.color}` }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{card.icon}</div>
              <p style={{ fontSize: 12, color: card.color, fontWeight: 600, margin: '0 0 4px' }}>{card.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: card.color, margin: 0 }}>
                {card.isCurrency === false ? card.value : fmt(card.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── add / edit form ── */}
      {showForm && isAdmin && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a5f', margin: 0 }}>
              {editEntry ? '✏️ Edit Entry' : `➕ Add ${rows.length > 1 ? `${rows.length} Entries` : 'Entry'}`}
            </h2>
            {!editEntry && (
              <button onClick={addRow}
                style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                + Add Another Row
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            {rows.map((row, i) => (
              <div key={i} style={{
                border: rows.length > 1 ? '1px solid #e2e8f0' : 'none',
                borderRadius: 10, padding: rows.length > 1 ? 16 : 0, marginBottom: rows.length > 1 ? 14 : 0,
                position: 'relative'
              }}>
                {rows.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>Row {i + 1}</span>
                    {i > 0 && (
                      <button type="button" onClick={() => removeRow(i)}
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                        ✖ Remove
                      </button>
                    )}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  <div>
                    <label style={lStyle}>Date</label>
                    <input type="date" value={row.entry_date}
                      onChange={e => updateRow(i, 'entry_date', e.target.value)} required style={iStyle} />
                  </div>
                  <div>
                    <label style={lStyle}>Type</label>
                    <select value={row.type}
                      onChange={e => updateRow(i, 'type', e.target.value) & updateRow(i, 'category', '')} required style={iStyle}>
                      <option>Income</option><option>Expense</option>
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Category</label>
                    <select value={row.category}
                      onChange={e => updateRow(i, 'category', e.target.value)} required style={iStyle}>
                      <option value="">Select</option>
                      {(row.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c =>
                        <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Amount</label>
                    <input type="number" min="0" placeholder="0" value={row.amount}
                      onChange={e => updateRow(i, 'amount', e.target.value)} required style={iStyle} />
                  </div>
                  <div>
                    <label style={lStyle}>Payment Mode</label>
                    <select value={row.payment_mode}
                      onChange={e => updateRow(i, 'payment_mode', e.target.value)} style={iStyle}>
                      {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lStyle}>Status</label>
                    <select value={row.status}
                      onChange={e => updateRow(i, 'status', e.target.value)} style={iStyle}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={lStyle}>Note</label>
                    <input type="text" placeholder="Optional note" value={row.note}
                      onChange={e => updateRow(i, 'note', e.target.value)} style={iStyle} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                  <input type="checkbox" checked={row.is_recurring}
                    onChange={e => updateRow(i, 'is_recurring', e.target.checked)} />
                  🔁 Mark as recurring (auto-add each month)
                </label>
              </div>
            ))}

            {/* Receipt — only for single/first row */}
            <div style={{ marginTop: 16 }}>
              <label style={lStyle}>🧾 Receipt / Attachment <span style={{ fontWeight: 400, color: '#94a3b8' }}>(image or PDF, applied to first row)</span></label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files[0] || null)}
                  style={{ fontSize: 13 }} />
                {(rows[0]?.receipt_url || receiptFile) && (
                  <button type="button"
                    onClick={() => setViewReceipt(receiptFile ? URL.createObjectURL(receiptFile) : rows[0].receipt_url)}
                    style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                    👁 Preview
                  </button>
                )}
                {rows[0]?.receipt_url && !receiptFile && (
                  <span style={{ fontSize: 12, color: '#16a34a' }}>✅ Receipt on file</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="submit" disabled={saving || uploadingReceipt}
                style={{ backgroundColor: (saving || uploadingReceipt) ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: (saving || uploadingReceipt) ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                {uploadingReceipt ? '⏳ Uploading…' : saving ? '⏳ Saving…' : editEntry ? '✅ Update Entry' : `✅ Save ${rows.length > 1 ? `${rows.length} Entries` : 'Entry'}`}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditEntry(null); setRows([{ ...emptyRow }]) }}
                style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          ['transactions', '🧾 Transactions'],
          ['analytics',    '📊 Analytics'],
          ['budgets',      '💰 Budgets'],
          ['recurring',    '🔁 Recurring'],
        ].map(([id, label]) => (
          <button key={id} style={tabStyle(id)} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* TAB: TRANSACTIONS                            */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'transactions' && (
        <>
          {/* quick date buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Quick:</span>
            {[['today','Today'],['week','This Week'],['month','This Month'],['lastmonth','Last Month'],['year','This Year']].map(([k,l]) => (
              <button key={k} style={qBtn(k,l)} onClick={() => activeQuick === k ? clearQuick() : applyQuick(k)}>{l}</button>
            ))}
            {activeQuick && (
              <button onClick={clearQuick}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
                ✖ Clear
              </button>
            )}
          </div>

          {/* filters row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <input placeholder="🔍 Search category, mode, note…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} style={iStyle} />
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} style={iStyle}>
              <option value="All">All Types</option>
              <option>Income</option><option>Expense</option>
            </select>
            <select value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(1) }} style={iStyle}>
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={iStyle}>
              <option value="All">All Status</option>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActiveQuick(''); setPage(1) }} title="From date" style={iStyle} />
            <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setActiveQuick(''); setPage(1) }} title="To date"   style={iStyle} />
          </div>

          {/* bulk action bar */}
          {selected.size > 0 && isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#fef3c7', borderRadius: 8, padding: '10px 16px', marginBottom: 12, border: '1px solid #fde68a' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{selected.size} selected</span>
              <button onClick={handleBulkDelete}
                style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🗑 Delete Selected
              </button>
              <button onClick={() => setSelected(new Set())}
                style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ✖ Deselect All
              </button>
            </div>
          )}

          {/* result count + page size */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}
              {isFiltered ? ' (filtered)' : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Show:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
                  style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    backgroundColor: pageSize === s ? '#1e3a5f' : '#f1f5f9',
                    color: pageSize === s ? 'white' : '#64748b' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading accounts…</div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {isAdmin && (
                      <th style={{ padding: '12px 12px', width: 40 }}>
                        <input type="checkbox"
                          checked={pagedEntries.length > 0 && selected.size === pagedEntries.length}
                          onChange={toggleSelectAll} />
                      </th>
                    )}
                    {[
                      ['#', null], ['Date', 'entry_date'], ['Type', null],
                      ['Category', 'category'], ['Amount', 'amount'],
                      ['Mode', 'payment_mode'], ['Status', null], ['Note', null],
                      ['Recurring', null], ['Running Bal.', null], ['Receipt', null], ['Actions', null],
                    ].map(([h, field]) => (
                      <th key={h}
                        onClick={() => field && toggleSort(field)}
                        style={{ padding: '12px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, cursor: field ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        {h}{field ? sortArrow(field) : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedEntries.map((item, i) => {
                    const isPending = (item.status || 'Confirmed') === 'Pending'
                    const runBal    = runningBalanceMap[item.id] ?? 0
                    return (
                      <tr key={item.id} style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: selected.has(item.id) ? '#eff6ff' : isPending ? '#fffbeb' : 'white',
                      }}>
                        {isAdmin && (
                          <td style={{ padding: '10px 12px' }}>
                            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                          </td>
                        )}
                        <td style={tdS}>{(page - 1) * pageSize + i + 1}</td>
                        <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{item.entry_date}</td>
                        <td style={tdS}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fee2e2',
                            color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>
                            {item.type}
                          </span>
                        </td>
                        <td style={{ ...tdS, fontWeight: 500, color: '#1e293b' }}>{item.category}</td>
                        <td style={{ ...tdS, fontWeight: 600, color: item.type === 'Income' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                          {fmt(item.amount)}
                        </td>
                        <td style={tdS}>{item.payment_mode}</td>
                        <td style={tdS}>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            backgroundColor: isPending ? '#fef3c7' : '#dcfce7',
                            color: isPending ? '#92400e' : '#166534' }}>
                            {isPending ? '⏳ Pending' : '✅ Confirmed'}
                          </span>
                        </td>
                        <td style={{ ...tdS, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note || '—'}</td>
                        <td style={{ ...tdS, textAlign: 'center' }}>{item.is_recurring ? '🔁' : '—'}</td>
                        <td style={{ ...tdS, fontWeight: 600, whiteSpace: 'nowrap', color: runBal >= 0 ? '#1e3a5f' : '#dc2626' }}>
                          {fmt(runBal)}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {item.receipt_url
                            ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button onClick={() => setViewReceipt(item.receipt_url)}
                                  style={smallBtn('#eff6ff', '#1e3a5f')}>👁</button>
                                {isAdmin && (
                                  <button onClick={() => deleteReceipt(item)}
                                    style={smallBtn('#fee2e2', '#dc2626')}>🗑</button>
                                )}
                              </div>
                            )
                            : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                          }
                        </td>
                        <td style={tdS}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {isAdmin && <>
                              <button onClick={() => openEdit(item)} style={smallBtn('#eff6ff', '#1e3a5f')}>✏️</button>
                              <button onClick={() => openDuplicate(item)} style={smallBtn('#f0fdf4', '#16a34a')} title="Duplicate">⧉</button>
                              <button onClick={() => handleDelete(item.id)} style={smallBtn('#fee2e2', '#dc2626')}>🗑</button>
                            </>}
                            {!isAdmin && <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {pagedEntries.length === 0 && (
                    <tr><td colSpan={isAdmin ? 13 : 12} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No entries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtn(page === 1)}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={pgBtn(page === 1)}>‹</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p
                if (totalPages <= 7) p = i + 1
                else if (page <= 4) p = i + 1
                else if (page >= totalPages - 3) p = totalPages - 6 + i
                else p = page - 3 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ ...pgBtn(false), backgroundColor: page === p ? '#1e3a5f' : '#f1f5f9', color: page === p ? 'white' : '#64748b' }}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={pgBtn(page === totalPages)}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={pgBtn(page === totalPages)}>»</button>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Page {page} of {totalPages}</span>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: ANALYTICS                               */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div>
          {/* AI Insights */}
          <div style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 20, marginBottom: 24, borderLeft: '4px solid #1e3a5f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: insights ? 12 : 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f', margin: 0 }}>🤖 AI Financial Insights</h3>
              <button onClick={getInsights} disabled={loadingAI}
                style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: loadingAI ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                {loadingAI ? '⏳ Analysing…' : '✨ Get Insights'}
              </button>
            </div>
            {insights && <div style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{insights}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={chartCard}>
              <h3 style={chartTitle}>Monthly Income vs Expense</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="Income"  fill="#16a34a" radius={[4,4,0,0]} />
                  <Bar dataKey="Expense" fill="#dc2626" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={chartCard}>
              <h3 style={chartTitle}>Net Balance Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData.map(m => ({ ...m, Net: m.Income - m.Expense }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Line dataKey="Net" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={chartCard}>
              <h3 style={chartTitle}>Top Categories</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {categoryData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={chartCard}>
              <h3 style={chartTitle}>Payment Mode Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {modeData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[(idx + 4) % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category P&L Summary Table */}
          <div style={{ ...chartCard, marginBottom: 20 }}>
            <h3 style={chartTitle}>Category P&L — This Month vs Last Month</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Category', 'Type', 'This Month', 'Last Month', 'Change', 'Variance'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...INCOME_CATEGORIES.map(cat => ({
                      cat, type: 'Income',
                      thisVal: plData.thisInc[cat] || 0,
                      prevVal: plData.prevInc[cat] || 0,
                    })),
                    ...EXPENSE_CATEGORIES.map(cat => ({
                      cat, type: 'Expense',
                      thisVal: plData.thisExp[cat] || 0,
                      prevVal: plData.prevExp[cat] || 0,
                    })),
                  ].filter(r => r.thisVal > 0 || r.prevVal > 0).map(({ cat, type, thisVal, prevVal }) => {
                    const diff = thisVal - prevVal
                    const pct  = prevVal > 0 ? ((diff / prevVal) * 100).toFixed(1) : '—'
                    return (
                      <tr key={`${type}-${cat}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...tdS, fontWeight: 500, color: '#1e293b' }}>{cat}</td>
                        <td style={tdS}>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            backgroundColor: type === 'Income' ? '#dcfce7' : '#fee2e2',
                            color: type === 'Income' ? '#16a34a' : '#dc2626' }}>{type}</span>
                        </td>
                        <td style={{ ...tdS, fontWeight: 600, color: type === 'Income' ? '#16a34a' : '#dc2626' }}>{fmt(thisVal)}</td>
                        <td style={tdS}>{fmt(prevVal)}</td>
                        <td style={{ ...tdS, fontWeight: 600, color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
                          {diff >= 0 ? '+' : ''}{fmt(diff)}
                        </td>
                        <td style={{ ...tdS, color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
                          {pct !== '—' ? `${diff >= 0 ? '+' : ''}${pct}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                    <td style={{ ...tdS, color: '#1e293b', fontWeight: 700 }} colSpan={2}>Net Surplus / Deficit</td>
                    <td style={{ ...tdS, color: plData.totalThisInc - plData.totalThisExp >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      {fmt(plData.totalThisInc - plData.totalThisExp)}
                    </td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{fmt(plData.totalPrevInc - plData.totalPrevExp)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: BUDGETS                                 */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'budgets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Monthly budget limits per expense category — saved to cloud</p>
            {!editBudgets
              ? isAdmin && (
                  <button onClick={() => { setEditBudgets(true); setBudgetDraft(budgets) }}
                    style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    ✏️ Edit Budgets
                  </button>
                )
              : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveBudgets}
                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    ✅ Save to Cloud
                  </button>
                  <button onClick={() => setEditBudgets(false)}
                    style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    Cancel
                  </button>
                </div>
              )
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 28 }}>
            {EXPENSE_CATEGORIES.map(cat => {
              const limit    = Number(budgets[cat]) || 0
              const spent    = monthlyExpenses[cat] || 0
              const pct      = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
              const over     = limit > 0 && spent > limit
              const barColor = over ? '#dc2626' : pct > 75 ? '#f59e0b' : '#16a34a'
              return (
                <div key={cat} style={{ backgroundColor: 'white', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${over ? '#dc2626' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{cat}</span>
                    {over && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠️ Over budget!</span>}
                  </div>
                  {editBudgets && isAdmin && (
                    <input type="number" min="0" value={budgetDraft[cat] || ''}
                      placeholder="Set budget limit"
                      onChange={e => setBudgetDraft({ ...budgetDraft, [cat]: e.target.value })}
                      style={{ ...iStyle, marginBottom: 10 }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    <span>Spent: <strong style={{ color: over ? '#dc2626' : '#1e293b' }}>{fmt(spent)}</strong></span>
                    <span>Limit: <strong>{limit > 0 ? fmt(limit) : 'Not set'}</strong></span>
                  </div>
                  {limit > 0 && (
                    <>
                      <div style={{ backgroundColor: '#f1f5f9', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 999, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{pct.toFixed(0)}% used</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Multi-month budget vs actual chart */}
          <div style={chartCard}>
            <h3 style={chartTitle}>Budget vs Actual — Last 6 Months</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {EXPENSE_CATEGORIES.filter(cat => Number(budgets[cat]) > 0).map((cat, idx) => (
                <span key={cat} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '22', color: CHART_COLORS[idx % CHART_COLORS.length], fontWeight: 600 }}>
                  {cat}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={budgetChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                {EXPENSE_CATEGORIES.filter(cat => Number(budgets[cat]) > 0).map((cat, idx) => (
                  <Bar key={cat} dataKey={cat} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[3,3,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            {EXPENSE_CATEGORIES.filter(cat => Number(budgets[cat]) > 0).length === 0 && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: 32 }}>Set budget limits above to see this chart</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: RECURRING                               */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'recurring' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            Auto-added every month. Edit to remove the recurring flag.
          </p>
          {recurringEntries.length === 0
            ? <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', backgroundColor: 'white', borderRadius: 12 }}>
                No recurring entries yet. Check "Mark as recurring" when adding an entry.
              </div>
            : (
              <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Type','Category','Amount','Mode','Note','Actions'].map(h =>
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 13 }}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recurringEntries.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={tdS}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                            backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fee2e2',
                            color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>
                            {item.type}
                          </span>
                        </td>
                        <td style={{ ...tdS, fontWeight: 500, color: '#1e293b' }}>{item.category}</td>
                        <td style={{ ...tdS, fontWeight: 600, color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>{fmt(item.amount)}</td>
                        <td style={tdS}>{item.payment_mode}</td>
                        <td style={tdS}>{item.note || '—'}</td>
                        <td style={tdS}>
                          {isAdmin && (
                            <button onClick={() => openEdit(item)}
                              style={smallBtn('#eff6ff', '#1e3a5f')}>✏️ Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* P&L REPORT MODAL                             */}
      {/* ════════════════════════════════════════════ */}
      {showPL && (
        <div
          onClick={() => setShowPL(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: 14, padding: 28, width: 680, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>📋 P&L Statement</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Income & Expenditure Report</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="month" value={plMonth} onChange={e => setPlMonth(e.target.value)} style={{ ...iStyle, width: 160 }} />
                <button onClick={printPL}
                  style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  🖨 Print
                </button>
                <button onClick={() => setShowPL(false)}
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  ✖
                </button>
              </div>
            </div>

            {/* summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Income', value: plData.totalThisInc, color: '#16a34a', bg: '#dcfce7' },
                { label: 'Total Expense', value: plData.totalThisExp, color: '#dc2626', bg: '#fee2e2' },
                { label: 'Net Surplus/Deficit', value: plData.totalThisInc - plData.totalThisExp, color: '#1e3a5f', bg: '#eff6ff' },
              ].map(c => (
                <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${c.color}` }}>
                  <p style={{ fontSize: 12, color: c.color, fontWeight: 600, margin: '0 0 4px' }}>{c.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0 }}>{fmt(c.value)}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Income */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginBottom: 10, borderBottom: '2px solid #dcfce7', paddingBottom: 6 }}>Income</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {Object.entries(plData.thisInc).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 0', color: '#374151' }}>{k}</td>
                        <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{fmt(v)}</td>
                      </tr>
                    ))}
                    {Object.keys(plData.thisInc).length === 0 && (
                      <tr><td colSpan={2} style={{ padding: '12px 0', color: '#94a3b8', textAlign: 'center' }}>No income this month</td></tr>
                    )}
                    <tr style={{ borderTop: '2px solid #16a34a' }}>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#1e293b' }}>Total</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(plData.totalThisInc)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Expense */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 10, borderBottom: '2px solid #fee2e2', paddingBottom: 6 }}>Expenditure</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {Object.entries(plData.thisExp).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 0', color: '#374151' }}>{k}</td>
                        <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{fmt(v)}</td>
                      </tr>
                    ))}
                    {Object.keys(plData.thisExp).length === 0 && (
                      <tr><td colSpan={2} style={{ padding: '12px 0', color: '#94a3b8', textAlign: 'center' }}>No expenses this month</td></tr>
                    )}
                    <tr style={{ borderTop: '2px solid #dc2626' }}>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#1e293b' }}>Total</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(plData.totalThisExp)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* RECEIPT PREVIEW MODAL                        */}
      {/* ════════════════════════════════════════════ */}
      {viewReceipt && (
        <div
          onClick={() => setViewReceipt(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, maxWidth: 720, width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f', margin: 0 }}>🧾 Receipt Preview</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={viewReceipt} target="_blank" rel="noopener noreferrer"
                  style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  ↗ Open
                </a>
                <button onClick={() => setViewReceipt(null)}
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✖
                </button>
              </div>
            </div>
            {(viewReceipt.toLowerCase().endsWith('.pdf') || viewReceipt.includes('application/pdf'))
              ? <iframe src={viewReceipt} title="Receipt PDF" style={{ width: '100%', height: 520, border: 'none', borderRadius: 8 }} />
              : <img src={viewReceipt} alt="Receipt" style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 600 }} />
            }
          </div>
        </div>
      )}

    </div>
  )
}

// ── shared styles ──────────────────────────────────────────────────────────
const iStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13,
  backgroundColor: 'white', boxSizing: 'border-box',
}
const lStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const tdS    = { padding: '10px 12px', color: '#64748b' }
const chartCard  = { backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
const chartTitle = { fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 16, marginTop: 0 }
const smallBtn   = (bg, color) => ({
  backgroundColor: bg, color, border: 'none', borderRadius: 6,
  padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
})
const pgBtn = (disabled) => ({
  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 12, fontWeight: 600, backgroundColor: '#f1f5f9', color: disabled ? '#cbd5e1' : '#64748b',
})

export default Accounts
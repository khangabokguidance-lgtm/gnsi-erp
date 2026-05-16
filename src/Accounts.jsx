import { useEffect, useMemo, useState, useRef } from 'react'
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

const emptyForm = {
  entry_date   : new Date().toLocaleDateString('en-CA'),
  type         : 'Income',
  category     : '',
  amount       : '',
  payment_mode : 'Cash',
  note         : '',
  is_recurring : false,
  receipt_url  : '',
}

const RECEIPT_BUCKET = 'account-receipts'   // ← change to your bucket name

const DEFAULT_BUDGETS = {
  Salary: 0, Electricity: 0, Stationery: 0,
  Maintenance: 0, Transport: 0, Event: 0, Other: 0,
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''
}

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon, isCurrency = true }) {
  return (
    <div style={{
      backgroundColor: bg, borderRadius: 12, padding: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <p style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</p>
      <h2 style={{ fontSize: 24, fontWeight: 'bold', color, marginTop: 4 }}>
        {isCurrency ? fmt(value) : value}
      </h2>
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
  const [receiptFile,    setReceiptFile]    = useState(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [viewReceipt,    setViewReceipt]    = useState(null)   // URL string to preview
  const fileInputRef = useRef(null)

  // ui tabs
  const [activeTab,  setActiveTab]  = useState('transactions') // transactions | analytics | budgets | recurring

  // form
  const [showForm,   setShowForm]   = useState(false)
  const [editEntry,  setEditEntry]  = useState(null)   // null = add mode
  const [form,       setForm]       = useState(emptyForm)

  // filters
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [modeFilter, setModeFilter] = useState('All')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [sortField,  setSortField]  = useState('entry_date')
  const [sortDir,    setSortDir]    = useState('desc')

  // budgets  (stored in localStorage for simplicity)
  const [budgets,    setBudgets]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('acc_budgets') || 'null') || DEFAULT_BUDGETS }
    catch { return DEFAULT_BUDGETS }
  })
  const [editBudgets, setEditBudgets] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(budgets)

  // AI insights
  const [insights,   setInsights]   = useState('')
  const [loadingAI,  setLoadingAI]  = useState(false)

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchEntries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at',  { ascending: false })
    if (error) console.error('Error fetching accounts:', error)
    else setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [])

  // ── recurring: auto-add on mount ─────────────────────────────────────────
  useEffect(() => {
    const lastRun = localStorage.getItem('acc_recurring_run')
    const today   = new Date().toLocaleDateString('en-CA')
    if (lastRun === today) return
    const recurring = entries.filter(e => e.is_recurring)
    if (!recurring.length) return
    const thisMonth = today.slice(0, 7)
    const existing  = entries.map(e => `${e.category}-${monthKey(e.entry_date)}-${e.amount}`)
    const toInsert  = recurring
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

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditEntry(null)
    setForm(emptyForm)
    setReceiptFile(null)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditEntry(item)
    setForm({
      entry_date   : item.entry_date,
      type         : item.type,
      category     : item.category,
      amount       : String(item.amount),
      payment_mode : item.payment_mode,
      note         : item.note || '',
      is_recurring : !!item.is_recurring,
      receipt_url  : item.receipt_url || '',
    })
    setReceiptFile(null)
    setShowForm(true)
    setActiveTab('transactions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // upload receipt to Supabase Storage, returns public URL or null
  const uploadReceipt = async (entryId) => {
    if (!receiptFile) return form.receipt_url || null
    setUploadingReceipt(true)
    const ext  = receiptFile.name.split('.').pop()
    const path = `${entryId || Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, receiptFile, { upsert: true })
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

    // For insert we need the id first — insert then update receipt_url
    const payload = {
      entry_date  : form.entry_date,
      type        : form.type,
      category    : form.category,
      amount      : Number(form.amount) || 0,
      payment_mode: form.payment_mode,
      note        : form.note,
      is_recurring: form.is_recurring,
    }

    if (editEntry) {
      const receiptUrl = await uploadReceipt(editEntry.id)
      const { error } = await supabase.from('accounts')
        .update({ ...payload, receipt_url: receiptUrl })
        .eq('id', editEntry.id)
      if (error) alert('Error: ' + error.message)
      else { setForm(emptyForm); setShowForm(false); setEditEntry(null); setReceiptFile(null); fetchEntries() }
    } else {
      const { data: inserted, error } = await supabase.from('accounts').insert([payload]).select().single()
      if (error) { alert('Error: ' + error.message) }
      else {
        const receiptUrl = await uploadReceipt(inserted.id)
        if (receiptUrl) {
          await supabase.from('accounts').update({ receipt_url: receiptUrl }).eq('id', inserted.id)
        }
        setForm(emptyForm); setShowForm(false); setReceiptFile(null); fetchEntries()
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

  // ── filtering + sorting ──────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = entries.filter(item => {
      if (typeFilter !== 'All' && item.type !== typeFilter) return false
      if (modeFilter !== 'All' && item.payment_mode !== modeFilter) return false
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
  }, [entries, search, typeFilter, modeFilter, dateFrom, dateTo, sortField, sortDir])

  // ── totals ───────────────────────────────────────────────────────────────
  const today        = new Date().toLocaleDateString('en-CA')
  const totalIncome  = entries.filter(e => e.type === 'Income') .reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense = entries.filter(e => e.type === 'Expense').reduce((s, e) => s + Number(e.amount), 0)
  const netBalance   = totalIncome - totalExpense

  const todayIncome  = entries.filter(e => e.type === 'Income'  && e.entry_date === today).reduce((s, e) => s + Number(e.amount), 0)
  const todayExpense = entries.filter(e => e.type === 'Expense' && e.entry_date === today).reduce((s, e) => s + Number(e.amount), 0)
  const todayNet     = todayIncome - todayExpense
  const todayCount   = entries.filter(e => e.entry_date === today).length

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

  // ── budget spend this month ───────────────────────────────────────────────
  const thisMonth = today.slice(0, 7)
  const monthlyExpenses = useMemo(() => {
    const map = {}
    entries.filter(e => e.type === 'Expense' && monthKey(e.entry_date) === thisMonth)
      .forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount) })
    return map
  }, [entries, thisMonth])

  const saveBudgets = () => {
    setBudgets(budgetDraft)
    localStorage.setItem('acc_budgets', JSON.stringify(budgetDraft))
    setEditBudgets(false)
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ['Date', 'Type', 'Category', 'Amount', 'Mode', 'Note']
    const rows   = filteredEntries.map(e =>
      [e.entry_date, e.type, e.category, e.amount, e.payment_mode, e.note || '']
    )
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'accounts.csv' })
    a.click(); URL.revokeObjectURL(url)
  }

  // ── AI insights ───────────────────────────────────────────────────────────
  const getInsights = async () => {
    setLoadingAI(true)
    setInsights('')
    const summary = {
      totalIncome, totalExpense, netBalance,
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
          model     : 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system    : 'You are a concise financial advisor. Give 4-5 bullet-point insights based on the data. Use ₹ for amounts. Be specific and actionable. No preamble.',
          messages  : [{ role: 'user', content: `Analyze this school accounts data: ${JSON.stringify(summary)}` }],
        }),
      })
      const data = await res.json()
      setInsights(data.content?.[0]?.text || 'No insights available.')
    } catch {
      setInsights('Failed to load AI insights. Please try again.')
    }
    setLoadingAI(false)
  }

  // ── sort toggle ───────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  const sortArrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // ── tab style ─────────────────────────────────────────────────────────────
  const tabStyle = (t) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 13,
    backgroundColor: activeTab === t ? '#1e3a5f' : '#f1f5f9',
    color          : activeTab === t ? 'white'   : '#64748b',
    transition     : 'all .15s',
  })

  // ── recurring entries ─────────────────────────────────────────────────────
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
        <div style={{ display: 'flex', gap: 10 }}>
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

      {/* ── stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total Income"   value={totalIncome}    color="#16a34a" bg="#dcfce7" icon="📈" />
        <StatCard label="Total Expense"  value={totalExpense}   color="#dc2626" bg="#fee2e2" icon="📉" />
        <StatCard label="Net Balance"    value={netBalance}     color="#1e3a5f" bg="#eff6ff" icon="💼" />
        <StatCard label="Transactions"   value={entries.length} color="#7c3aed" bg="#f3e8ff" icon="🧾" isCurrency={false} />
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
          {todayCount === 0 && (
            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No transactions today</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: "Today's Income",   value: todayIncome,  color: '#16a34a', bg: '#f0fdf4', icon: '⬆️' },
            { label: "Today's Expense",  value: todayExpense, color: '#dc2626', bg: '#fff5f5', icon: '⬇️' },
            { label: "Today's Net",      value: todayNet,     color: todayNet >= 0 ? '#1e3a5f' : '#dc2626', bg: '#eff6ff', icon: todayNet >= 0 ? '✅' : '⚠️' },
            { label: "Today's Entries",  value: todayCount,   color: '#7c3aed', bg: '#faf5ff', icon: '🔢', isCurrency: false },
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
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>
            {editEntry ? '✏️ Edit Entry' : '➕ Add Account Entry'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Date', children:
                  <input type="date" value={form.entry_date}
                    onChange={e => setForm({ ...form, entry_date: e.target.value })} required
                    style={iStyle} /> },
                { label: 'Type', children:
                  <select value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value, category: '' })} required style={iStyle}>
                    <option>Income</option><option>Expense</option>
                  </select> },
                { label: 'Category', children:
                  <select value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })} required style={iStyle}>
                    <option value="">Select Category</option>
                    {(form.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c =>
                      <option key={c}>{c}</option>)}
                  </select> },
                { label: 'Amount', children:
                  <input type="number" min="0" placeholder="Enter amount" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} required style={iStyle} /> },
                { label: 'Payment Mode', children:
                  <select value={form.payment_mode}
                    onChange={e => setForm({ ...form, payment_mode: e.target.value })} style={iStyle}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select> },
                { label: 'Note', children:
                  <input type="text" placeholder="Optional note" value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })} style={iStyle} /> },
              ].map(({ label, children }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
                  {children}
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
              <input type="checkbox" checked={form.is_recurring}
                onChange={e => setForm({ ...form, is_recurring: e.target.checked })} />
              🔁 Mark as recurring (auto-add each month)
            </label>

            {/* Receipt upload */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                🧾 Receipt / Attachment <span style={{ fontWeight: 400, color: '#94a3b8' }}>(image or PDF)</span>
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files[0] || null)}
                  style={{ fontSize: 13, color: '#374151' }} />
                {(form.receipt_url || receiptFile) && (
                  <button type="button"
                    onClick={() => setViewReceipt(receiptFile ? URL.createObjectURL(receiptFile) : form.receipt_url)}
                    style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    👁 Preview
                  </button>
                )}
                {form.receipt_url && !receiptFile && (
                  <span style={{ fontSize: 12, color: '#16a34a' }}>✅ Receipt on file</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" disabled={saving || uploadingReceipt}
                style={{ backgroundColor: (saving || uploadingReceipt) ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: (saving || uploadingReceipt) ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                {uploadingReceipt ? '⏳ Uploading receipt…' : saving ? '⏳ Saving…' : editEntry ? '✅ Update Entry' : '✅ Save Entry'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditEntry(null) }}
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
          {/* filters row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <input placeholder="🔍 Search category, mode, note…" value={search}
              onChange={e => setSearch(e.target.value)} style={iStyle} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={iStyle}>
              <option value="All">All Types</option>
              <option>Income</option><option>Expense</option>
            </select>
            <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} style={iStyle}>
              <option value="All">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              title="From date" style={iStyle} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              title="To date" style={iStyle} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading accounts…</div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {[
                      ['#', null], ['Date', 'entry_date'], ['Type', null],
                      ['Category', 'category'], ['Amount', 'amount'],
                      ['Mode', 'payment_mode'], ['Note', null],
                      ['Recurring', null], ['Receipt', null], ['Actions', null],
                    ].map(([h, field]) => (
                      <th key={h}
                        onClick={() => field && toggleSort(field)}
                        style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 13, cursor: field ? 'pointer' : 'default', userSelect: 'none' }}>
                        {h}{field ? sortArrow(field) : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdS}>{i + 1}</td>
                      <td style={tdS}>{item.entry_date}</td>
                      <td style={tdS}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fee2e2',
                          color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ ...tdS, fontWeight: 500, color: '#1e293b' }}>{item.category}</td>
                      <td style={{ ...tdS, fontWeight: 600, color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>
                        {fmt(item.amount)}
                      </td>
                      <td style={tdS}>{item.payment_mode}</td>
                      <td style={tdS}>{item.note || '—'}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>{item.is_recurring ? '🔁' : '—'}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        {item.receipt_url
                          ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button onClick={() => setViewReceipt(item.receipt_url)}
                                style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                                👁 View
                              </button>
                              {isAdmin && (
                                <button onClick={() => deleteReceipt(item)}
                                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                                  🗑
                                </button>
                              )}
                            </div>
                          )
                          : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={tdS}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isAdmin && (
                            <button onClick={() => openEdit(item)}
                              style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                              ✏️ Edit
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(item.id)}
                              style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                              🗑 Del
                            </button>
                          )}
                          {!isAdmin && <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEntries.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No entries found</td></tr>
                  )}
                </tbody>
              </table>
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
            {insights && (
              <div style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{insights}</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Monthly Income vs Expense */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>Monthly Income vs Expense</h3>
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

            {/* Net Balance trend */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>Net Balance Trend</h3>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Category breakdown */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>Top Categories</h3>
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

            {/* Payment mode breakdown */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 16 }}>Payment Mode Breakdown</h3>
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
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: BUDGETS                                 */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'budgets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14 }}>Monthly budget limits per expense category</p>
            {!editBudgets
              ? isAdmin && (
                  <button onClick={() => { setEditBudgets(true); setBudgetDraft(budgets) }}
                    style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    ✏️ Edit Budgets
                  </button>
                )
              : <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveBudgets}
                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    ✅ Save
                  </button>
                  <button onClick={() => setEditBudgets(false)}
                    style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    Cancel
                  </button>
                </div>
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {EXPENSE_CATEGORIES.map(cat => {
              const limit   = Number(budgets[cat]) || 0
              const spent   = monthlyExpenses[cat] || 0
              const pct     = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
              const over    = limit > 0 && spent > limit
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
                    <div style={{ backgroundColor: '#f1f5f9', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 999, transition: 'width .4s' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: RECURRING                               */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'recurring' && (
        <div>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            These entries are automatically re-added every month. Manage them here or uncheck "recurring" when editing.
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
                      {['Type', 'Category', 'Amount', 'Mode', 'Note', 'Actions'].map(h =>
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
                              style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                              ✏️ Edit
                            </button>
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
      {/* RECEIPT PREVIEW MODAL                        */}
      {/* ════════════════════════════════════════════ */}
      {viewReceipt && (
        <div
          onClick={() => setViewReceipt(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, maxWidth: 720, width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f', margin: 0 }}>🧾 Receipt Preview</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={viewReceipt} target="_blank" rel="noopener noreferrer"
                  style={{ backgroundColor: '#eff6ff', color: '#1e3a5f', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  ↗ Open in new tab
                </a>
                <button onClick={() => setViewReceipt(null)}
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✖ Close
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

// ── shared styles ─────────────────────────────────────────────────────────
const iStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14,
  backgroundColor: 'white', boxSizing: 'border-box',
}
const tdS = { padding: '12px 16px', color: '#64748b' }

export default Accounts
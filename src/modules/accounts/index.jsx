import { useState, useEffect, useCallback } from 'react'
import './accounts.css'

// ── Constants ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://pwrldrngqxbvwfztxxrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cmxkcm5ncXhidndmenR4eHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTc5NTUsImV4cCI6MjA5MDA5Mzk1NX0.vQi6N4s5Y_iwU1eIi4g8q_T8bW4j8mBH7BFDamAhB0Y'

const INCOME_CATEGORIES  = ['Fee Collection','Hostel Fees','Exam Fees','Transport Fees','Donation','Government Grant','Miscellaneous']
const EXPENSE_CATEGORIES = ['Salary','Utilities','Maintenance','Stationery','Food & Hostel','Transport','Equipment','Miscellaneous']

// ── Helpers ────────────────────────────────────────────────────────────────────
const todayStr  = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)
const fmtDate   = d => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const fmtINR    = n => '₹ ' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const monthOf   = d => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? '' : dt.toISOString().slice(0, 7) }
const uid       = () => 'local_' + Date.now()

const ls    = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem('gnsijwtuser')) } catch { return null } }

function exportCSV(type, rows) {
  const heads = type === 'expense'
    ? ['Date', 'Category', 'Amount', 'Description', 'Paid To', 'Created By']
    : ['Date', 'Category', 'Amount', 'Description', 'Paid By', 'Created By']
  const lines = [heads.join(','), ...rows.map(r => {
    const cols = type === 'expense'
      ? [r.date, r.category, r.amount, r.description, r.paid_to, r.created_by]
      : [r.date, r.category, r.amount, r.description, r.paid_by, r.created_by]
    return cols.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')
  })]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `gnsi_${type}_ledger_${todayStr()}.csv`
  a.click()
}

// ── Supabase fetch ─────────────────────────────────────────────────────────────
async function sbFetch(table, month) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=date.desc&limit=500`
  if (month) {
    const last = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().slice(0, 10)
    url += `&date=gte.${month}-01&date=lte.${last}`
  }
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function sbInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) { const t = await res.text(); throw new Error(t) }
}

async function sbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, color, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: color || '#15803d', color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 24px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>×</button>
    </div>
  )
}

// ── Confirm Delete Modal ───────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        <div style={{ background: '#fff1f1', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#dc2626' }}>🗑 Delete Entry</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
        <div style={{ padding: '24px 20px' }}>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: '#333' }}>
            Are you sure you want to delete this entry?<br />
            <strong style={{ color: '#dc2626' }}>This cannot be undone.</strong>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Yes, Delete</button>
            <button onClick={onCancel}  style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Entry Modal ────────────────────────────────────────────────────────────
function EntryModal({ type, onSave, onClose }) {
  const [form, setForm] = useState({ date: todayStr(), category: '', amount: '', paidBy: '', paidTo: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isIncome = type === 'income'
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        <div style={{ background: isIncome ? '#f0fdf4' : '#fff1f1', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: isIncome ? '#16a34a' : '#dc2626' }}>{isIncome ? '➕ Add Income Entry' : '➖ Add Expense Entry'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={lbl}>Date *
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Category *
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inp}>
              <option value="">— Select —</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={lbl}>Amount (₹) *
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" min="0" step="0.01" style={inp} />
          </label>
          {isIncome
            ? <label style={lbl}>Paid By<input value={form.paidBy} onChange={e => set('paidBy', e.target.value)} placeholder="Student name / source" style={inp} /></label>
            : <label style={lbl}>Paid To<input value={form.paidTo} onChange={e => set('paidTo', e.target.value)} placeholder="Vendor / staff name" style={inp} /></label>
          }
          <label style={lbl}>Description
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" rows={2} style={{ ...inp, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => onSave(form)} style={{ flex: 1, padding: '11px', background: isIncome ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
              Save Entry
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' }
const inp = { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, color, icon }) {
  return (
    <div style={{ background: 'var(--color-surface,#fff)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,.07)', borderLeft: `4px solid ${color}`, minWidth: 140 }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

// ── Ledger Table ───────────────────────────────────────────────────────────────
function LedgerTable({ type, rows, onDelete, filterMonth, onFilterChange, onExport }) {
  const isIncome = type === 'income'
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="month" value={filterMonth} onChange={e => onFilterChange(e.target.value)}
          style={{ padding: '7px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
        <button onClick={onExport} style={ghostBtn}>⬇ Export CSV</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontFamily: "'JetBrains Mono',monospace" }}>{rows.length} entries</span>
      </div>
      {rows.length === 0
        ? <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{isIncome ? '💰' : '💸'}</div>
            <div style={{ fontWeight: 700 }}>No {type} entries yet</div>
          </div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2,#f9f8f5)', textAlign: 'left' }}>
                  <th style={th}>Date</th>
                  <th style={th}>Category</th>
                  <th style={th}>Amount</th>
                  <th style={th}>{isIncome ? 'Paid By' : 'Paid To'}</th>
                  <th style={th}>Description</th>
                  <th style={th}>By</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{fmtDate(r.date)}</td>
                    <td style={td}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isIncome ? '#dcfce7' : '#fee2e2', color: isIncome ? '#16a34a' : '#dc2626' }}>
                        {r.category || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 800, color: isIncome ? '#16a34a' : '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{fmtINR(r.amount)}</td>
                    <td style={td}>{(isIncome ? r.paid_by : r.paid_to) || '—'}</td>
                    <td style={{ ...td, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                    <td style={{ ...td, color: '#9ca3af', fontSize: 11 }}>{r.created_by || '—'}</td>
                    <td style={td}>
                      <button onClick={() => onDelete(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626', padding: '2px 6px', borderRadius: 6 }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}
const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb' }
const td = { padding: '10px 12px', verticalAlign: 'middle' }
const ghostBtn = { padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'var(--color-surface,#fff)', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }

// ── Summary Report ─────────────────────────────────────────────────────────────
function SummaryReport({ income, expense }) {
  const incCat = {}, expCat = {}
  income.forEach(r => { incCat[r.category] = (incCat[r.category] || 0) + (parseFloat(r.amount) || 0) })
  expense.forEach(r => { expCat[r.category] = (expCat[r.category] || 0) + (parseFloat(r.amount) || 0) })
  const totInc = income.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totExp = expense.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const bal = totInc - totExp

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Income by category */}
        <div>
          <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 10 }}>💰 Income by Category</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f0fdf4' }}><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {Object.keys(incCat).length === 0
                ? <tr><td colSpan={2} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>No data</td></tr>
                : Object.entries(incCat).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{k}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#16a34a', fontFamily: "'JetBrains Mono',monospace" }}>{fmtINR(v)}</td>
                  </tr>
                ))
              }
              <tr style={{ background: '#f0fdf4', fontWeight: 800 }}>
                <td style={td}>Total</td>
                <td style={{ ...td, textAlign: 'right', color: '#16a34a', fontFamily: "'JetBrains Mono',monospace" }}>{fmtINR(totInc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Expense by category */}
        <div>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>💸 Expense by Category</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#fff1f1' }}><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {Object.keys(expCat).length === 0
                ? <tr><td colSpan={2} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>No data</td></tr>
                : Object.entries(expCat).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{k}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{fmtINR(v)}</td>
                  </tr>
                ))
              }
              <tr style={{ background: '#fff1f1', fontWeight: 800 }}>
                <td style={td}>Total</td>
                <td style={{ ...td, textAlign: 'right', color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{fmtINR(totExp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Net balance */}
      <div style={{ padding: '16px 20px', borderRadius: 12, background: bal >= 0 ? '#f0fdf4' : '#fff1f1', border: `1.5px solid ${bal >= 0 ? '#16a34a' : '#dc2626'}` }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: bal >= 0 ? '#16a34a' : '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>
          Net Balance: {fmtINR(bal)}
        </span>
        <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>(Income − Expense)</span>
      </div>
    </div>
  )
}

// ── Main Accounts Page ─────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [tab,          setTab]          = useState('income')
  const [income,       setIncome]       = useState([])
  const [expense,      setExpense]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [offline,      setOffline]      = useState(false)
  const [toast,        setToast]        = useState(null)
  const [modal,        setModal]        = useState(null)   // 'income' | 'expense' | null
  const [deleteTarget, setDeleteTarget] = useState(null)   // { table, row }
  const [incMonth,     setIncMonth]     = useState('')
  const [expMonth,     setExpMonth]     = useState('')

  const showToast = (msg, color = '#15803d') => setToast({ msg, color })

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [inc, exp] = await Promise.all([
        sbFetch('accounts_income'),
        sbFetch('accounts_expense'),
      ])
      setIncome(inc);  lsSet('gnsi_accounts_income',  inc)
      setExpense(exp); lsSet('gnsi_accounts_expense', exp)
      setOffline(false)
    } catch {
      setOffline(true)
      setIncome(ls('gnsi_accounts_income',  []))
      setExpense(ls('gnsi_accounts_expense', []))
      showToast('⚠️ Offline — showing cached data', '#f59e0b')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredIncome  = incMonth ? income.filter(r  => monthOf(r.date)  === incMonth)  : income
  const filteredExpense = expMonth ? expense.filter(r => monthOf(r.date) === expMonth) : expense

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totInc = income.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totExp = expense.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const bal    = totInc - totExp
  const tm     = thisMonth()
  const mInc   = income.filter(r  => monthOf(r.date)  === tm).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const mExp   = expense.filter(r => monthOf(r.date) === tm).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // ── Save entry ─────────────────────────────────────────────────────────────
  async function handleSave(type, form) {
    const { date, category, amount, paidBy, paidTo, description } = form
    if (!date || !category || !amount || isNaN(parseFloat(amount))) {
      showToast('Please fill Date, Category and Amount.', '#dc2626'); return
    }
    const user  = getCurrentUser()
    const entry = {
      date, category,
      amount: parseFloat(amount),
      description,
      ...(type === 'income' ? { paid_by: paidBy } : { paid_to: paidTo }),
      created_at: new Date().toISOString(),
      created_by: user?.name || 'staff',
    }
    const table = type === 'income' ? 'accounts_income' : 'accounts_expense'
    try {
      await sbInsert(table, entry)
      showToast(`${type === 'income' ? 'Income' : 'Expense'} entry added ✅`)
    } catch {
      // save locally if Supabase fails
      entry.id = uid()
      if (type === 'income') {
        const updated = [entry, ...income]; setIncome(updated); lsSet('gnsi_accounts_income', updated)
      } else {
        const updated = [entry, ...expense]; setExpense(updated); lsSet('gnsi_accounts_expense', updated)
      }
      showToast('Saved locally (offline)', '#f59e0b')
      setModal(null); return
    }
    setModal(null)
    loadData()
  }

  // ── Delete entry ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    const { table, row } = deleteTarget
    setDeleteTarget(null)
    try {
      if (!String(row.id).startsWith('local_')) await sbDelete(table, row.id)
      // also remove locally
      if (table === 'accounts_income') {
        const updated = income.filter(r => r.id !== row.id); setIncome(updated); lsSet('gnsi_accounts_income', updated)
      } else {
        const updated = expense.filter(r => r.id !== row.id); setExpense(updated); lsSet('gnsi_accounts_expense', updated)
      }
      showToast('Entry deleted.', '#f59e0b')
      loadData()
    } catch {
      showToast('Error deleting entry.', '#dc2626')
    }
  }

  const btnTab = t => ({
    padding: '9px 22px', borderRadius: 8, border: tab === t ? 'none' : '1.5px solid #e5e7eb',
    cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: tab === t ? '#1433a8' : 'var(--color-surface,#fff)',
    color: tab === t ? '#fff' : '#6b7280', transition: 'all .15s',
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {toast        && <Toast msg={toast.msg} color={toast.color} onClose={() => setToast(null)} />}
      {modal        && <EntryModal type={modal} onSave={f => handleSave(modal, f)} onClose={() => setModal(null)} />}
      {deleteTarget && <DeleteModal onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>GNSI PORTAL</div>
        <div style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 800, color: 'var(--color-text,#1a2040)' }}>🏦 Accounts</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Income · Expenses · Summary</div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ Offline — showing cached data
        </div>
      )}

      {/* KPI Cards */}
      {loading
        ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>⏳ Loading accounts…</div>
        : <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <KPICard label="Total Income"       value={fmtINR(totInc)} color="#16a34a" icon="💰" />
              <KPICard label="Total Expense"      value={fmtINR(totExp)} color="#dc2626" icon="💸" />
              <KPICard label="Net Balance"        value={fmtINR(bal)}    color={bal >= 0 ? '#16a34a' : '#dc2626'} icon="⚖️" />
              <KPICard label="This Month Income"  value={fmtINR(mInc)}   color="#1433a8" icon="📅" />
              <KPICard label="This Month Expense" value={fmtINR(mExp)}   color="#f59e0b" icon="📅" />
            </div>

            {/* Tab bar + action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={btnTab('income')}  onClick={() => setTab('income')}>💰 Income ({income.length})</button>
              <button style={btnTab('expense')} onClick={() => setTab('expense')}>💸 Expense ({expense.length})</button>
              <button style={btnTab('summary')} onClick={() => setTab('summary')}>📊 Summary</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setModal('income')}  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Income</button>
                <button onClick={() => setModal('expense')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>− Expense</button>
              </div>
            </div>

            {/* Tab content */}
            <div style={{ background: 'var(--color-surface,#fff)', borderRadius: 14, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
              {tab === 'income' && (
                <LedgerTable
                  type="income" rows={filteredIncome}
                  onDelete={row => setDeleteTarget({ table: 'accounts_income', row })}
                  filterMonth={incMonth} onFilterChange={setIncMonth}
                  onExport={() => { exportCSV('income', filteredIncome); showToast('CSV exported ✅') }}
                />
              )}
              {tab === 'expense' && (
                <LedgerTable
                  type="expense" rows={filteredExpense}
                  onDelete={row => setDeleteTarget({ table: 'accounts_expense', row })}
                  filterMonth={expMonth} onFilterChange={setExpMonth}
                  onExport={() => { exportCSV('expense', filteredExpense); showToast('CSV exported ✅') }}
                />
              )}
              {tab === 'summary' && <SummaryReport income={income} expense={expense} />}
            </div>
          </>
      }
    </div>
  )
}

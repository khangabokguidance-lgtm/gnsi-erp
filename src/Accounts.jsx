import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const emptyForm = {
  entry_date: new Date().toLocaleDateString('en-CA'),
  type: 'Income',
  category: '',
  amount: '',
  payment_mode: 'Cash',
  note: '',
}

function Accounts() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [form, setForm] = useState(emptyForm)

  const fetchEntries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) console.error('Error fetching accounts:', error)
    else setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      entry_date: form.entry_date,
      type: form.type,
      category: form.category,
      amount: Number(form.amount) || 0,
      payment_mode: form.payment_mode,
      note: form.note,
    }

    const { error } = await supabase.from('accounts').insert([payload])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setForm(emptyForm)
      setShowForm(false)
      fetchEntries()
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

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const matchesType = typeFilter === 'All' || item.type === typeFilter
      const q = search.toLowerCase()
      const matchesSearch =
        (item.category || '').toLowerCase().includes(q) ||
        (item.payment_mode || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q)

      return matchesType && matchesSearch
    })
  }, [entries, search, typeFilter])

  const totalIncome = entries
    .filter(e => e.type === 'Income')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const totalExpense = entries
    .filter(e => e.type === 'Expense')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const netBalance = totalIncome - totalExpense

  const statusCard = [
    { label: 'Total Income', value: totalIncome, color: '#16a34a', bg: '#dcfce7', icon: '📈' },
    { label: 'Total Expense', value: totalExpense, color: '#dc2626', bg: '#fee2e2', icon: '📉' },
    { label: 'Net Balance', value: netBalance, color: '#1e3a5f', bg: '#eff6ff', icon: '💼' },
    { label: 'Transactions', value: entries.length, color: '#7c3aed', bg: '#f3e8ff', icon: '🧾' },
  ]

  const incomeCategories = ['Admission', 'Fees', 'Hostel', 'Donation', 'Registration', 'Other']
  const expenseCategories = ['Salary', 'Electricity', 'Stationery', 'Maintenance', 'Transport', 'Event', 'Other']

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f' }}>💼 Accounts</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Manage income and expense transactions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          {showForm ? '✖ Cancel' : '➕ Add Entry'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statusCard.map(card => (
          <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{card.icon}</div>
            <p style={{ fontSize: '13px', color: card.color, fontWeight: '600' }}>{card.label}</p>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: card.color, marginTop: '4px' }}>
              {card.label === 'Transactions' ? card.value : `₹${Number(card.value).toLocaleString('en-IN')}`}
            </h2>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a5f', marginBottom: '16px' }}>Add Account Entry</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date</label>
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={e => setForm({ ...form, entry_date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value, category: '' })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="">Select Category</option>
                  {(form.type === 'Income' ? incomeCategories : expenseCategories).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Amount</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter amount"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Payment Mode</label>
                <select
                  value={form.payment_mode}
                  onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Note</label>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ marginTop: '16px', backgroundColor: saving ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}
            >
              {saving ? '⏳ Saving...' : '✅ Save Entry'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <input
          placeholder="🔍 Search by category, mode, type, note..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' }}
        >
          <option value="All">All Types</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading accounts...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Date', 'Type', 'Category', 'Amount', 'Mode', 'Note', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '13px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.entry_date}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fee2e2',
                      color: item.type === 'Income' ? '#16a34a' : '#dc2626',
                    }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1e293b' }}>{item.category}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: item.type === 'Income' ? '#16a34a' : '#dc2626' }}>
                    ₹{Number(item.amount).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.payment_mode}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.note || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No account entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Accounts
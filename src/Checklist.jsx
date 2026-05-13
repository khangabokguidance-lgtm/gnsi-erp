import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hiqaqdfhopuakaydfkgb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcWFxZGZob3B1YWtheWRma2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mzc4MzMsImV4cCI6MjA5MDExMzgzM30.kJ7dL57alviRjOLc0BsEk9eS_90wwQahvQfYD2GLZ68'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function ManagementChecklist() {
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('daily')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    period: 'daily',
    section: '',
    task: '',
    owner: '',
    status: 'Pending',
    priority: 'Medium',
  })

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('management_checklist')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      setMessage('Failed to load checklist data')
      setLoading(false)
      return
    }

    setItems(data || [])
    setLoading(false)
  }

  const currentItems = useMemo(() => items.filter(item => item.period === activeTab), [items, activeTab])

  const filteredItems = useMemo(() => {
    return currentItems.filter(item => {
      const q = search.toLowerCase()
      const matchesSearch = (item.section || '').toLowerCase().includes(q) || (item.task || '').toLowerCase().includes(q) || (item.owner || '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [currentItems, search, statusFilter, priorityFilter])

  async function addTask(e) {
    e.preventDefault()
    if (!form.section || !form.task || !form.owner) {
      setMessage('Please fill all required fields')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('management_checklist')
      .insert([{ ...form }])
      .select()

    if (error) {
      setMessage('Failed to add task')
      setSaving(false)
      return
    }

    setItems(prev => [...prev, ...(data || [])])
    setForm({ period: activeTab, section: '', task: '', owner: '', status: 'Pending', priority: 'Medium' })
    setMessage('Task added successfully')
    setSaving(false)
  }

  async function toggleStatus(item) {
    const newStatus = item.status === 'Done' ? 'Pending' : 'Done'
    const { data, error } = await supabase
      .from('management_checklist')
      .update({ status: newStatus })
      .eq('id', item.id)
      .select()

    if (error) {
      setMessage('Failed to update status')
      return
    }

    setItems(prev => prev.map(row => (row.id === item.id ? (data && data[0] ? data[0] : row) : row)))
    setMessage('Status updated successfully')
  }

  async function deleteTask(id) {
    const confirmDelete = window.confirm('Are you sure you want to delete this task?')
    if (!confirmDelete) return

    const { error } = await supabase.from('management_checklist').delete().eq('id', id)
    if (error) {
      setMessage('Failed to delete task')
      return
    }

    setItems(prev => prev.filter(item => item.id !== id))
    setMessage('Task deleted successfully')
  }

  const total = filteredItems.length
  const doneCount = filteredItems.filter(item => item.status === 'Done').length
  const pendingCount = filteredItems.filter(item => item.status === 'Pending').length
  const highCount = filteredItems.filter(item => item.priority === 'High').length

  const cardStyle = { background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }
  const tabStyle = (tab) => ({ padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', background: activeTab === tab ? '#1e3a5f' : '#e2e8f0', color: activeTab === tab ? '#fff' : '#334155' })

  const badgeStyle = (value, type) => {
    let bg = '#e2e8f0', color = '#334155'
    if (type === 'status') {
      if (value === 'Done') { bg = '#dcfce7'; color = '#166534' } else { bg = '#fee2e2'; color = '#991b1b' }
    }
    if (type === 'priority') {
      if (value === 'High') { bg = '#fef3c7'; color = '#92400e' } else { bg = '#dbeafe'; color = '#1d4ed8' }
    }
    return { display: 'inline-block', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', background: bg, color }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>✅ Management Checklist</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Supabase-powered daily, weekly, and monthly management checklist</p>
      </div>

      {message && <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', fontSize: '14px' }}>{message}</div>}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('daily')} style={tabStyle('daily')}>Daily</button>
        <button onClick={() => setActiveTab('weekly')} style={tabStyle('weekly')}>Weekly</button>
        <button onClick={() => setActiveTab('monthly')} style={tabStyle('monthly')}>Monthly</button>
      </div>

      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add New Task</h2>
        <form onSubmit={addTask}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Period</label>
              <select style={inputStyle} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Section</label>
              <input style={inputStyle} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Admissions / Finance / Academics" />
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <input style={inputStyle} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Admin / Accounts / Reception" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Task</label>
              <input style={inputStyle} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="Enter task details" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: '600' }}>{saving ? 'Saving...' : 'Add Task'}</button>
        </form>
      </div>

      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Filters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Search</label>
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search section, task, owner..." />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="Done">Done</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select style={inputStyle} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}><div style={{ fontSize: '13px', color: '#64748b' }}>Total Tasks</div><div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{total}</div></div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}><div style={{ fontSize: '13px', color: '#64748b' }}>Completed</div><div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{doneCount}</div></div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626' }}><div style={{ fontSize: '13px', color: '#64748b' }}>Pending</div><div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{pendingCount}</div></div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}><div style={{ fontSize: '13px', color: '#64748b' }}>High Priority</div><div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{highCount}</div></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginBottom: '16px', color: '#1e3a5f', textTransform: 'capitalize' }}>{activeTab} Checklist</h2>
        {loading ? <div style={{ padding: '20px', color: '#64748b' }}>Loading checklist...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>#</th><th style={thStyle}>Section</th><th style={thStyle}>Task</th><th style={thStyle}>Owner</th><th style={thStyle}>Status</th><th style={thStyle}>Priority</th><th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle}>{item.section}</td>
                    <td style={tdStyle}>{item.task}</td>
                    <td style={tdStyle}>{item.owner}</td>
                    <td style={tdStyle}><span style={badgeStyle(item.status, 'status')}>{item.status}</span></td>
                    <td style={tdStyle}><span style={badgeStyle(item.priority, 'priority')}>{item.priority}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => toggleStatus(item)} style={{ background: item.status === 'Done' ? '#dc2626' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{item.status === 'Done' ? 'Mark Pending' : 'Mark Done'}</button>
                        <button onClick={() => deleteTask(item.id)} style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No checklist items found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '12px', fontSize: '13px', color: '#475569', borderBottom: '1px solid #e5e7eb' }
const tdStyle = { padding: '12px', color: '#334155', verticalAlign: 'top' }

export default ManagementChecklist

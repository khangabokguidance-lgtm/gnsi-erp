import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

// ── constants ──────────────────────────────────────────────────────────────
const CATEGORIES     = ['Construction', 'Maintenance']
const STATUS_OPTIONS = ['Planned', 'Ongoing', 'Completed', 'On Hold', 'Cancelled']
const PAYMENT_MODES  = ['Cash', 'Bank', 'UPI', 'Card']

const STATUS_COLORS = {
  Planned:   { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  Ongoing:   { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  Completed: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  'On Hold': { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  Cancelled: { bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb' },
}

const CATEGORY_ICON = { Construction: '🏗️', Maintenance: '🔧' }

const emptyProject = {
  name: '', category: 'Construction', description: '',
  contractor: '', contractor_phone: '', budget_amount: '',
  status: 'Ongoing', start_date: new Date().toLocaleDateString('en-CA'),
  target_end_date: '', notes: '',
}

const emptyPayment = {
  amount: '', pay_date: new Date().toLocaleDateString('en-CA'),
  pay_mode: 'Cash', txn_ref: '', paid_by: '', received_by: '', notes: '',
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const card = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
  padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}
const btnPrimary = {
  background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 9,
  padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
}
const btnGhost = {
  background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0',
  borderRadius: 9, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
}
const inputStyle = {
  padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
}
const label = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }

export default function ConstructionMaintenance() {
  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      return s ? JSON.parse(s).user : {}
    } catch {
      return {}
    }
  }, [])
  const myName  = currentUser?.userName || currentUser?.name || ''

  const [projects, setProjects] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)

  const [statusFilter, setStatusFilter]     = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch]                 = useState('')

  const [showAddProject, setShowAddProject] = useState(false)
  const [newProject, setNewProject]         = useState(emptyProject)
  const [savingProject, setSavingProject]   = useState(false)

  const [editingProject, setEditingProject] = useState(null)
  const [editDraft, setEditDraft]           = useState(null)

  const [expandedId, setExpandedId]     = useState(null)
  const [showAddPayment, setShowAddPayment] = useState(null) // project id
  const [newPayment, setNewPayment]     = useState(emptyPayment)
  const [savingPayment, setSavingPayment] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [{ data: p, error: pErr }, { data: pay, error: payErr }] = await Promise.all([
        supabase.from('cm_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('cm_project_payments').select('*').order('pay_date', { ascending: false }),
      ])
      if (pErr) console.warn('cm_projects load failed (has the migration been run?):', pErr.message)
      if (payErr) console.warn('cm_project_payments load failed:', payErr.message)
      setProjects(p || [])
      setPayments(pay || [])
    } catch (err) {
      console.warn('Construction & Maintenance load failed:', err.message)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const paymentsByProject = useMemo(() => {
    const m = {}
    payments.forEach(pm => {
      if (!m[pm.project_id]) m[pm.project_id] = []
      m[pm.project_id].push(pm)
    })
    return m
  }, [payments])

  const projectRows = useMemo(() => {
    return projects.map(p => {
      const pays = paymentsByProject[p.id] || []
      const paid = pays.reduce((s, x) => s + (Number(x.amount) || 0), 0)
      const budget = Number(p.budget_amount) || 0
      return {
        ...p,
        paid,
        remaining: budget - paid,
        pctPaid: budget > 0 ? Math.min(100, (paid / budget) * 100) : 0,
        paymentCount: pays.length,
      }
    })
  }, [projects, paymentsByProject])

  const filteredProjects = useMemo(() => {
    return projectRows.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false
      if (search.trim() && !`${p.name} ${p.contractor || ''}`.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [projectRows, statusFilter, categoryFilter, search])

  const summary = useMemo(() => {
    const totalBudget = projectRows.reduce((s, p) => s + (Number(p.budget_amount) || 0), 0)
    const totalPaid   = projectRows.reduce((s, p) => s + p.paid, 0)
    const ongoing     = projectRows.filter(p => p.status === 'Ongoing').length
    const completed   = projectRows.filter(p => p.status === 'Completed').length
    return { totalBudget, totalPaid, remaining: totalBudget - totalPaid, ongoing, completed, count: projectRows.length }
  }, [projectRows])

  const addProject = async () => {
    if (!newProject.name.trim()) { alert('Project name is required.'); return }
    setSavingProject(true)
    try {
      const payload = {
        name: newProject.name.trim(),
        category: newProject.category,
        description: newProject.description || null,
        contractor: newProject.contractor || null,
        contractor_phone: newProject.contractor_phone || null,
        budget_amount: Number(newProject.budget_amount) || 0,
        status: newProject.status,
        start_date: newProject.start_date || null,
        target_end_date: newProject.target_end_date || null,
        notes: newProject.notes || null,
        created_by: myName || null,
      }
      const { error } = await supabase.from('cm_projects').insert(payload)
      if (error) { alert('Could not add project: ' + error.message); setSavingProject(false); return }
      setNewProject(emptyProject)
      setShowAddProject(false)
      await loadAll()
    } catch (err) {
      alert('Could not add project: ' + err.message)
    }
    setSavingProject(false)
  }

  const startEdit = (p) => {
    setEditingProject(p.id)
    setEditDraft({
      name: p.name || '', category: p.category || 'Construction',
      description: p.description || '', contractor: p.contractor || '',
      contractor_phone: p.contractor_phone || '', budget_amount: p.budget_amount || '',
      status: p.status || 'Ongoing', start_date: p.start_date || '',
      target_end_date: p.target_end_date || '', completed_date: p.completed_date || '',
      notes: p.notes || '',
    })
  }

  const saveEdit = async () => {
    if (!editDraft.name.trim()) { alert('Project name is required.'); return }
    try {
      const payload = {
        name: editDraft.name.trim(), category: editDraft.category,
        description: editDraft.description || null, contractor: editDraft.contractor || null,
        contractor_phone: editDraft.contractor_phone || null,
        budget_amount: Number(editDraft.budget_amount) || 0,
        status: editDraft.status, start_date: editDraft.start_date || null,
        target_end_date: editDraft.target_end_date || null,
        completed_date: editDraft.status === 'Completed' ? (editDraft.completed_date || new Date().toLocaleDateString('en-CA')) : null,
        notes: editDraft.notes || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('cm_projects').update(payload).eq('id', editingProject)
      if (error) { alert('Could not save changes: ' + error.message); return }
      setEditingProject(null)
      setEditDraft(null)
      await loadAll()
    } catch (err) {
      alert('Could not save changes: ' + err.message)
    }
  }

  const deleteProject = async (p) => {
    if (!window.confirm(`Delete "${p.name}" and all ${p.paymentCount} payment(s) recorded against it? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('cm_projects').delete().eq('id', p.id)
      if (error) { alert('Could not delete: ' + error.message); return }
      await loadAll()
    } catch (err) {
      alert('Could not delete: ' + err.message)
    }
  }

  const addPayment = async (projectId) => {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) { alert('Enter a valid payment amount.'); return }
    setSavingPayment(true)
    try {
      const payload = {
        project_id: projectId,
        amount: Number(newPayment.amount),
        pay_date: newPayment.pay_date || new Date().toLocaleDateString('en-CA'),
        pay_mode: newPayment.pay_mode,
        txn_ref: newPayment.txn_ref || null,
        paid_by: newPayment.paid_by || myName || null,
        received_by: newPayment.received_by || null,
        notes: newPayment.notes || null,
        created_by: myName || null,
      }
      const { error } = await supabase.from('cm_project_payments').insert(payload)
      if (error) { alert('Could not record payment: ' + error.message); setSavingPayment(false); return }
      setNewPayment(emptyPayment)
      setShowAddPayment(null)
      await loadAll()
    } catch (err) {
      alert('Could not record payment: ' + err.message)
    }
    setSavingPayment(false)
  }

  const deletePayment = async (pm) => {
    if (!window.confirm(`Delete this payment of ${fmt(pm.amount)}?`)) return
    try {
      const { error } = await supabase.from('cm_project_payments').delete().eq('id', pm.id)
      if (error) { alert('Could not delete payment: ' + error.message); return }
      await loadAll()
    } catch (err) {
      alert('Could not delete payment: ' + err.message)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Construction &amp; Maintenance…</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1e293b' }}>🏗️ Construction &amp; Maintenance</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Track projects, budgets, and payments — kept separate from the main accounts ledger.</p>
        </div>
        <button style={btnPrimary} onClick={() => setShowAddProject(v => !v)}>
          {showAddProject ? '✖ Cancel' : '+ New Project'}
        </button>
      </div>

      {/* summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Total Budget', val: fmt(summary.totalBudget), color: '#1e3a5f' },
          { lbl: 'Total Paid', val: fmt(summary.totalPaid), color: '#16a34a' },
          { lbl: 'Remaining', val: fmt(summary.remaining), color: summary.remaining < 0 ? '#dc2626' : '#7c3aed' },
          { lbl: 'Ongoing', val: summary.ongoing, color: '#b45309' },
          { lbl: 'Completed', val: summary.completed, color: '#15803d' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{s.lbl}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* new project form */}
      {showAddProject && (
        <div style={{ ...card, marginBottom: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>New Project</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <div>
              <label style={label}>Project Name *</label>
              <input style={inputStyle} value={newProject.name} onChange={e => setNewProject(v => ({ ...v, name: e.target.value }))} placeholder="e.g. New Hostel Block" />
            </div>
            <div>
              <label style={label}>Category</label>
              <select style={inputStyle} value={newProject.category} onChange={e => setNewProject(v => ({ ...v, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Status</label>
              <select style={inputStyle} value={newProject.status} onChange={e => setNewProject(v => ({ ...v, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Budget Amount (₹)</label>
              <input style={inputStyle} type="number" value={newProject.budget_amount} onChange={e => setNewProject(v => ({ ...v, budget_amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={label}>Contractor / Vendor</label>
              <input style={inputStyle} value={newProject.contractor} onChange={e => setNewProject(v => ({ ...v, contractor: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Contractor Phone</label>
              <input style={inputStyle} value={newProject.contractor_phone} onChange={e => setNewProject(v => ({ ...v, contractor_phone: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Start Date</label>
              <input style={inputStyle} type="date" value={newProject.start_date} onChange={e => setNewProject(v => ({ ...v, start_date: e.target.value }))} />
            </div>
            <div>
              <label style={label}>Target End Date</label>
              <input style={inputStyle} type="date" value={newProject.target_end_date} onChange={e => setNewProject(v => ({ ...v, target_end_date: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Description</label>
              <input style={inputStyle} value={newProject.description} onChange={e => setNewProject(v => ({ ...v, description: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Notes</label>
              <input style={inputStyle} value={newProject.notes} onChange={e => setNewProject(v => ({ ...v, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button style={btnPrimary} disabled={savingProject} onClick={addProject}>
              {savingProject ? 'Saving…' : '✅ Add Project'}
            </button>
            <button style={btnGhost} onClick={() => { setShowAddProject(false); setNewProject(emptyProject) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input style={{ ...inputStyle, maxWidth: 240 }} placeholder="Search project / contractor…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inputStyle, maxWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...inputStyle, maxWidth: 160 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* project list */}
      {filteredProjects.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#94a3b8', padding: 40 }}>
          {projects.length === 0
            ? 'No construction/maintenance projects yet — click "+ New Project" to add one.'
            : 'No projects match the current filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredProjects.map(p => {
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.Ongoing
            const isExpanded = expandedId === p.id
            const isEditing = editingProject === p.id && !!editDraft
            const pays = paymentsByProject[p.id] || []
            return (
              <div key={p.id} style={card}>
                {isEditing ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                      <div>
                        <label style={label}>Project Name *</label>
                        <input style={inputStyle} value={editDraft.name} onChange={e => setEditDraft(v => ({ ...v, name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Category</label>
                        <select style={inputStyle} value={editDraft.category} onChange={e => setEditDraft(v => ({ ...v, category: e.target.value }))}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={label}>Status</label>
                        <select style={inputStyle} value={editDraft.status} onChange={e => setEditDraft(v => ({ ...v, status: e.target.value }))}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={label}>Budget Amount (₹)</label>
                        <input style={inputStyle} type="number" value={editDraft.budget_amount} onChange={e => setEditDraft(v => ({ ...v, budget_amount: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Contractor / Vendor</label>
                        <input style={inputStyle} value={editDraft.contractor} onChange={e => setEditDraft(v => ({ ...v, contractor: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Contractor Phone</label>
                        <input style={inputStyle} value={editDraft.contractor_phone} onChange={e => setEditDraft(v => ({ ...v, contractor_phone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Start Date</label>
                        <input style={inputStyle} type="date" value={editDraft.start_date} onChange={e => setEditDraft(v => ({ ...v, start_date: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Target End Date</label>
                        <input style={inputStyle} type="date" value={editDraft.target_end_date} onChange={e => setEditDraft(v => ({ ...v, target_end_date: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={label}>Description</label>
                        <input style={inputStyle} value={editDraft.description} onChange={e => setEditDraft(v => ({ ...v, description: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={label}>Notes</label>
                        <input style={inputStyle} value={editDraft.notes} onChange={e => setEditDraft(v => ({ ...v, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                      <button style={btnPrimary} onClick={saveEdit}>💾 Save Changes</button>
                      <button style={btnGhost} onClick={() => { setEditingProject(null); setEditDraft(null) }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 20 }}>{CATEGORY_ICON[p.category] || '📁'}</span>
                          <strong style={{ fontSize: 16, color: '#1e293b' }}>{p.name}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: sc.bg, color: sc.fg, border: `1px solid ${sc.border}` }}>{p.status}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.category}</span>
                        </div>
                        {p.description && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>{p.description}</p>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#64748b' }}>
                          {p.contractor && <span>👷 {p.contractor}{p.contractor_phone ? ` · ${p.contractor_phone}` : ''}</span>}
                          {p.start_date && <span>📅 Started {p.start_date}</span>}
                          {p.target_end_date && <span>🎯 Target {p.target_end_date}</span>}
                          {p.completed_date && <span>✅ Completed {p.completed_date}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={btnGhost} onClick={() => startEdit(p)}>✏️ Edit</button>
                        <button style={{ ...btnGhost, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => deleteProject(p)}>🗑️ Delete</button>
                      </div>
                    </div>

                    {/* budget progress */}
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 4 }}>
                        <span>Paid: <strong style={{ color: '#16a34a' }}>{fmt(p.paid)}</strong> of <strong>{fmt(p.budget_amount)}</strong></span>
                        <span style={{ color: p.remaining < 0 ? '#dc2626' : '#64748b' }}>
                          {p.remaining < 0 ? `Over budget by ${fmt(Math.abs(p.remaining))}` : `Remaining: ${fmt(p.remaining)}`}
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.pctPaid}%`, background: p.remaining < 0 ? '#dc2626' : '#1e3a5f', borderRadius: 999 }} />
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button style={btnGhost} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                        {isExpanded ? '▲ Hide' : '▼ Show'} Payments ({p.paymentCount})
                      </button>
                      <button style={btnPrimary} onClick={() => { setShowAddPayment(showAddPayment === p.id ? null : p.id); setExpandedId(p.id) }}>
                        + Record Payment
                      </button>
                    </div>

                    {showAddPayment === p.id && (
                      <div style={{ marginTop: 12, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                          <div>
                            <label style={label}>Amount (₹) *</label>
                            <input style={inputStyle} type="number" value={newPayment.amount} onChange={e => setNewPayment(v => ({ ...v, amount: e.target.value }))} />
                          </div>
                          <div>
                            <label style={label}>Date</label>
                            <input style={inputStyle} type="date" value={newPayment.pay_date} onChange={e => setNewPayment(v => ({ ...v, pay_date: e.target.value }))} />
                          </div>
                          <div>
                            <label style={label}>Mode</label>
                            <select style={inputStyle} value={newPayment.pay_mode} onChange={e => setNewPayment(v => ({ ...v, pay_mode: e.target.value }))}>
                              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={label}>Txn Ref</label>
                            <input style={inputStyle} value={newPayment.txn_ref} onChange={e => setNewPayment(v => ({ ...v, txn_ref: e.target.value }))} />
                          </div>
                          <div>
                            <label style={label}>Paid By</label>
                            <input style={inputStyle} placeholder={myName || ''} value={newPayment.paid_by} onChange={e => setNewPayment(v => ({ ...v, paid_by: e.target.value }))} />
                          </div>
                          <div>
                            <label style={label}>Received By (contractor side)</label>
                            <input style={inputStyle} value={newPayment.received_by} onChange={e => setNewPayment(v => ({ ...v, received_by: e.target.value }))} />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={label}>Notes</label>
                            <input style={inputStyle} value={newPayment.notes} onChange={e => setNewPayment(v => ({ ...v, notes: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                          <button style={btnPrimary} disabled={savingPayment} onClick={() => addPayment(p.id)}>
                            {savingPayment ? 'Saving…' : '✅ Save Payment'}
                          </button>
                          <button style={btnGhost} onClick={() => { setShowAddPayment(null); setNewPayment(emptyPayment) }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                        {pays.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No payments recorded yet.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                                <th style={{ padding: '4px 8px' }}>Date</th>
                                <th style={{ padding: '4px 8px' }}>Amount</th>
                                <th style={{ padding: '4px 8px' }}>Mode</th>
                                <th style={{ padding: '4px 8px' }}>Ref</th>
                                <th style={{ padding: '4px 8px' }}>Paid By</th>
                                <th style={{ padding: '4px 8px' }}>Received By</th>
                                <th style={{ padding: '4px 8px' }}>Notes</th>
                                <th style={{ padding: '4px 8px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {pays.sort((a, b) => (b.pay_date || '').localeCompare(a.pay_date || '')).map(pm => (
                                <tr key={pm.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px' }}>{pm.pay_date}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#16a34a' }}>{fmt(pm.amount)}</td>
                                  <td style={{ padding: '6px 8px' }}>{pm.pay_mode || '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>{pm.txn_ref || '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>{pm.paid_by || '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>{pm.received_by || '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>{pm.notes || '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => deletePayment(pm)}>Delete</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

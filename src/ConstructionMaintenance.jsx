import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── constants ──────────────────────────────────────────────────────────────
const CATEGORIES     = ['Construction', 'Maintenance']
const STATUS_OPTIONS = ['Planned', 'Ongoing', 'Completed', 'On Hold', 'Cancelled']
const PAYMENT_MODES  = ['Cash', 'Bank', 'UPI', 'Card']
const CM_BUCKET       = 'cm-attachments'
const CHART_COLORS    = ['#1e3a5f', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2', '#be185d', '#047857']

const STATUS_COLORS = {
  Planned:   { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  Ongoing:   { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  Completed: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  'On Hold': { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  Cancelled: { bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb' },
}

const CATEGORY_ICON = { Construction: '🏗️', Maintenance: '🔧' }

const INSTITUTE_INFO = {
  name: 'GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI)',
  tagline: 'NVS · Sainik School · RMS Entrance Coaching',
  address: 'Khangabok, Thoubal, Manipur, India',
}

const emptyProject = {
  name: '', category: 'Construction', description: '',
  contractor: '', contractor_phone: '', budget_amount: '',
  status: 'Ongoing', start_date: new Date().toLocaleDateString('en-CA'),
  target_end_date: '', notes: '', progress_pct: 0,
}

const emptyPayment = {
  amount: '', pay_date: new Date().toLocaleDateString('en-CA'),
  pay_mode: 'Cash', txn_ref: '', paid_by: '', received_by: '', notes: '',
}

const emptyMilestone = {
  label: '', due_date: '', planned_amount: '',
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const today = () => new Date().toLocaleDateString('en-CA')

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
const btnSmall = { padding: '5px 11px', fontSize: 12, borderRadius: 7 }
const inputStyle = {
  padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
}
const label = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }

// Logs a row into cm_activity_log. Fire-and-forget from the caller's
// perspective — a logging failure should never block the actual action it
// describes, so errors here are swallowed (with a console.warn) rather than
// surfaced to the user.
async function logActivity(projectId, action, detail, actor) {
  try {
    await supabase.from('cm_activity_log').insert({ project_id: projectId, action, detail, actor: actor || null })
  } catch (err) {
    console.warn('cm_activity_log insert failed:', err.message)
  }
}

export default function ConstructionMaintenance() {
  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      return s ? JSON.parse(s).user : {}
    } catch {
      return {}
    }
  }, [])
  const myName = currentUser?.userName || currentUser?.name || ''

  const [projects, setProjects]   = useState([])
  const [payments, setPayments]   = useState([])
  const [milestones, setMilestones] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [loading, setLoading]     = useState(true)

  const [statusFilter, setStatusFilter]     = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch]                 = useState('')

  const [showAddProject, setShowAddProject] = useState(false)
  const [newProject, setNewProject]         = useState(emptyProject)
  const [contractFile, setContractFile]     = useState(null)
  const [savingProject, setSavingProject]   = useState(false)

  const [editingProject, setEditingProject] = useState(null)
  const [editDraft, setEditDraft]           = useState(null)
  const [editContractFile, setEditContractFile] = useState(null)

  const [expandedId, setExpandedId]         = useState(null)
  const [activeSubTab, setActiveSubTab]     = useState({}) // { [projectId]: 'payments'|'milestones'|'activity' }

  const [showAddPayment, setShowAddPayment] = useState(null) // project id
  const [newPayment, setNewPayment]         = useState(emptyPayment)
  const [paymentReceiptFile, setPaymentReceiptFile] = useState(null)
  const [savingPayment, setSavingPayment]   = useState(false)

  const [showAddMilestone, setShowAddMilestone] = useState(null) // project id
  const [newMilestone, setNewMilestone]     = useState(emptyMilestone)
  const [savingMilestone, setSavingMilestone] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [
        { data: p, error: pErr },
        { data: pay, error: payErr },
        { data: ms, error: msErr },
        { data: log, error: logErr },
      ] = await Promise.all([
        supabase.from('cm_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('cm_project_payments').select('*').order('pay_date', { ascending: false }),
        supabase.from('cm_milestones').select('*').order('sort_order', { ascending: true }),
        supabase.from('cm_activity_log').select('*').order('at', { ascending: false }).limit(500),
      ])
      if (pErr) console.warn('cm_projects load failed (has the migration been run?):', pErr.message)
      if (payErr) console.warn('cm_project_payments load failed:', payErr.message)
      if (msErr) console.warn('cm_milestones load failed (has the v2 migration been run?):', msErr.message)
      if (logErr) console.warn('cm_activity_log load failed (has the v2 migration been run?):', logErr.message)
      setProjects(p || [])
      setPayments(pay || [])
      setMilestones(ms || [])
      setActivityLog(log || [])
    } catch (err) {
      console.warn('Construction & Maintenance load failed:', err.message)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const paymentsByProject = useMemo(() => {
    const m = {}
    payments.forEach(pm => { (m[pm.project_id] ??= []).push(pm) })
    return m
  }, [payments])

  const milestonesByProject = useMemo(() => {
    const m = {}
    milestones.forEach(ms => { (m[ms.project_id] ??= []).push(ms) })
    return m
  }, [milestones])

  const activityByProject = useMemo(() => {
    const m = {}
    activityLog.forEach(a => { (m[a.project_id] ??= []).push(a) })
    return m
  }, [activityLog])

  const projectRows = useMemo(() => {
    return projects.map(p => {
      const pays = paymentsByProject[p.id] || []
      const paid = pays.reduce((s, x) => s + (Number(x.amount) || 0), 0)
      const budget = Number(p.budget_amount) || 0
      const isOverdue = p.target_end_date && p.status === 'Ongoing' && p.target_end_date < today()
      return {
        ...p,
        paid,
        remaining: budget - paid,
        pctPaid: budget > 0 ? Math.min(100, (paid / budget) * 100) : 0,
        paymentCount: pays.length,
        isOverBudget: budget > 0 && paid > budget,
        isOverdue,
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

  // ── Feature 1 & 2: alert banners ──────────────────────────────────────
  const overBudgetProjects = useMemo(() => projectRows.filter(p => p.isOverBudget), [projectRows])
  const overdueProjects    = useMemo(() => projectRows.filter(p => p.isOverdue), [projectRows])

  // ── Feature 7: contractor-wise spend ──────────────────────────────────
  const contractorSpend = useMemo(() => {
    const m = {}
    projectRows.forEach(p => {
      const key = p.contractor?.trim() || 'Unassigned'
      if (!m[key]) m[key] = { contractor: key, budget: 0, paid: 0, projectCount: 0 }
      m[key].budget += Number(p.budget_amount) || 0
      m[key].paid += p.paid
      m[key].projectCount += 1
    })
    return Object.values(m).sort((a, b) => b.paid - a.paid)
  }, [projectRows])

  // ── Feature 8: category spend chart ───────────────────────────────────
  const categorySpend = useMemo(() => {
    return CATEGORIES.map(cat => ({
      category: cat,
      budget: projectRows.filter(p => p.category === cat).reduce((s, p) => s + (Number(p.budget_amount) || 0), 0),
      paid: projectRows.filter(p => p.category === cat).reduce((s, p) => s + p.paid, 0),
    }))
  }, [projectRows])

  // ── project CRUD ───────────────────────────────────────────────────────
  const uploadContract = async (file, projectId) => {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `contracts/${projectId || Date.now()}.${ext}`
    const { error } = await supabase.storage.from(CM_BUCKET).upload(path, file, { upsert: true })
    if (error) { alert('Contract upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from(CM_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const uploadReceipt = async (file, paymentId) => {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `receipts/${paymentId || Date.now()}.${ext}`
    const { error } = await supabase.storage.from(CM_BUCKET).upload(path, file, { upsert: true })
    if (error) { alert('Receipt upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from(CM_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

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
        progress_pct: Number(newProject.progress_pct) || 0,
        created_by: myName || null,
      }
      const { data: inserted, error } = await supabase.from('cm_projects').insert(payload).select().single()
      if (error) { alert('Could not add project: ' + error.message); setSavingProject(false); return }
      if (contractFile && inserted?.id) {
        const url = await uploadContract(contractFile, inserted.id)
        if (url) await supabase.from('cm_projects').update({ contract_file_url: url }).eq('id', inserted.id)
      }
      await logActivity(inserted?.id, 'created', `Project "${payload.name}" created`, myName)
      setNewProject(emptyProject)
      setContractFile(null)
      setShowAddProject(false)
      await loadAll()
    } catch (err) {
      alert('Could not add project: ' + err.message)
    }
    setSavingProject(false)
  }

  const startEdit = (p) => {
    setEditingProject(p.id)
    setEditContractFile(null)
    setEditDraft({
      name: p.name || '', category: p.category || 'Construction',
      description: p.description || '', contractor: p.contractor || '',
      contractor_phone: p.contractor_phone || '', budget_amount: p.budget_amount || '',
      status: p.status || 'Ongoing', start_date: p.start_date || '',
      target_end_date: p.target_end_date || '', completed_date: p.completed_date || '',
      notes: p.notes || '', progress_pct: p.progress_pct || 0,
    })
  }

  const saveEdit = async (original) => {
    if (!editDraft.name.trim()) { alert('Project name is required.'); return }
    try {
      const payload = {
        name: editDraft.name.trim(), category: editDraft.category,
        description: editDraft.description || null, contractor: editDraft.contractor || null,
        contractor_phone: editDraft.contractor_phone || null,
        budget_amount: Number(editDraft.budget_amount) || 0,
        status: editDraft.status, start_date: editDraft.start_date || null,
        target_end_date: editDraft.target_end_date || null,
        completed_date: editDraft.status === 'Completed' ? (editDraft.completed_date || today()) : null,
        notes: editDraft.notes || null,
        progress_pct: editDraft.status === 'Completed' ? 100 : (Number(editDraft.progress_pct) || 0),
        updated_at: new Date().toISOString(),
      }
      if (editContractFile) {
        const url = await uploadContract(editContractFile, editingProject)
        if (url) payload.contract_file_url = url
      }
      const { error } = await supabase.from('cm_projects').update(payload).eq('id', editingProject)
      if (error) { alert('Could not save changes: ' + error.message); return }
      const changeNotes = []
      if (original && original.status !== payload.status) changeNotes.push(`Status changed from ${original.status} to ${payload.status}`)
      if (original && Number(original.budget_amount) !== payload.budget_amount) changeNotes.push(`Budget changed from ${fmt(original.budget_amount)} to ${fmt(payload.budget_amount)}`)
      if (editContractFile) changeNotes.push('Contract file uploaded')
      await logActivity(editingProject, 'edited', changeNotes.length ? changeNotes.join('; ') : 'Project details updated', myName)
      setEditingProject(null)
      setEditDraft(null)
      setEditContractFile(null)
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

  const updateProgress = async (p, pct) => {
    try {
      const { error } = await supabase.from('cm_projects').update({ progress_pct: pct, updated_at: new Date().toISOString() }).eq('id', p.id)
      if (error) { alert('Could not update progress: ' + error.message); return }
      await logActivity(p.id, 'edited', `Progress updated to ${pct}%`, myName)
      await loadAll()
    } catch (err) {
      alert('Could not update progress: ' + err.message)
    }
  }

  // ── payments ─────────────────────────────────────────────────────────
  const addPayment = async (projectId) => {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) { alert('Enter a valid payment amount.'); return }
    setSavingPayment(true)
    try {
      const payload = {
        project_id: projectId,
        amount: Number(newPayment.amount),
        pay_date: newPayment.pay_date || today(),
        pay_mode: newPayment.pay_mode,
        txn_ref: newPayment.txn_ref || null,
        paid_by: newPayment.paid_by || myName || null,
        received_by: newPayment.received_by || null,
        notes: newPayment.notes || null,
        created_by: myName || null,
      }
      const { data: inserted, error } = await supabase.from('cm_project_payments').insert(payload).select().single()
      if (error) { alert('Could not record payment: ' + error.message); setSavingPayment(false); return }
      if (paymentReceiptFile && inserted?.id) {
        const url = await uploadReceipt(paymentReceiptFile, inserted.id)
        if (url) await supabase.from('cm_project_payments').update({ receipt_url: url }).eq('id', inserted.id)
      }
      await logActivity(projectId, 'payment_added', `Payment of ${fmt(payload.amount)} recorded (${payload.pay_mode})`, myName)
      setNewPayment(emptyPayment)
      setPaymentReceiptFile(null)
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
      await logActivity(pm.project_id, 'payment_deleted', `Payment of ${fmt(pm.amount)} deleted`, myName)
      await loadAll()
    } catch (err) {
      alert('Could not delete payment: ' + err.message)
    }
  }

  // ── Feature 9: milestones ────────────────────────────────────────────
  const addMilestone = async (projectId) => {
    if (!newMilestone.label.trim()) { alert('Milestone label is required.'); return }
    setSavingMilestone(true)
    try {
      const existing = milestonesByProject[projectId] || []
      const payload = {
        project_id: projectId,
        label: newMilestone.label.trim(),
        due_date: newMilestone.due_date || null,
        planned_amount: Number(newMilestone.planned_amount) || 0,
        sort_order: existing.length,
        created_by: myName || null,
      }
      const { error } = await supabase.from('cm_milestones').insert(payload)
      if (error) { alert('Could not add milestone: ' + error.message); setSavingMilestone(false); return }
      await logActivity(projectId, 'milestone_added', `Milestone "${payload.label}" added (${fmt(payload.planned_amount)} due ${payload.due_date || 'no date set'})`, myName)
      setNewMilestone(emptyMilestone)
      setShowAddMilestone(null)
      await loadAll()
    } catch (err) {
      alert('Could not add milestone: ' + err.message)
    }
    setSavingMilestone(false)
  }

  const toggleMilestonePaid = async (ms) => {
    try {
      const payload = ms.is_paid
        ? { is_paid: false, paid_at: null, linked_payment_id: null }
        : { is_paid: true, paid_at: new Date().toISOString() }
      const { error } = await supabase.from('cm_milestones').update(payload).eq('id', ms.id)
      if (error) { alert('Could not update milestone: ' + error.message); return }
      await logActivity(ms.project_id, 'milestone_paid', `Milestone "${ms.label}" marked as ${payload.is_paid ? 'paid' : 'unpaid'}`, myName)
      await loadAll()
    } catch (err) {
      alert('Could not update milestone: ' + err.message)
    }
  }

  const deleteMilestone = async (ms) => {
    if (!window.confirm(`Delete milestone "${ms.label}"?`)) return
    try {
      const { error } = await supabase.from('cm_milestones').delete().eq('id', ms.id)
      if (error) { alert('Could not delete milestone: ' + error.message); return }
      await loadAll()
    } catch (err) {
      alert('Could not delete milestone: ' + err.message)
    }
  }

  // ── Feature 6: single-project PDF report ────────────────────────────
  const generateProjectReport = (p) => {
    const pays = (paymentsByProject[p.id] || []).slice().sort((a, b) => (a.pay_date || '').localeCompare(b.pay_date || ''))
    const ms = milestonesByProject[p.id] || []
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFontSize(14); doc.setFont(undefined, 'bold')
    doc.text(INSTITUTE_INFO.name, pageW / 2, 42, { align: 'center' })
    doc.setFontSize(9); doc.setFont(undefined, 'normal')
    doc.text(INSTITUTE_INFO.tagline, pageW / 2, 56, { align: 'center' })
    doc.text(INSTITUTE_INFO.address, pageW / 2, 68, { align: 'center' })

    doc.setFontSize(13); doc.setFont(undefined, 'bold')
    doc.text(`Project Report — ${p.name}`, 40, 100)
    doc.setFontSize(10); doc.setFont(undefined, 'normal')
    let y = 122
    const line = (t) => { doc.text(t, 40, y); y += 16 }
    line(`Category: ${p.category}    Status: ${p.status}    Progress: ${p.progress_pct || 0}%`)
    line(`Contractor: ${p.contractor || '—'}${p.contractor_phone ? ' · ' + p.contractor_phone : ''}`)
    line(`Budget: ${fmt(p.budget_amount)}    Paid: ${fmt(p.paid)}    Remaining: ${fmt(p.remaining)}`)
    line(`Start: ${p.start_date || '—'}    Target End: ${p.target_end_date || '—'}    Completed: ${p.completed_date || '—'}`)
    if (p.description) line(`Description: ${p.description}`)
    if (p.notes) line(`Notes: ${p.notes}`)
    y += 6

    if (pays.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Amount', 'Mode', 'Ref', 'Paid By', 'Received By', 'Has Receipt']],
        body: pays.map(pm => [pm.pay_date, fmt(pm.amount), pm.pay_mode || '—', pm.txn_ref || '—', pm.paid_by || '—', pm.received_by || '—', pm.receipt_url ? 'Yes' : 'No']),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 95] },
        margin: { left: 40, right: 40 },
      })
      y = doc.lastAutoTable.finalY + 20
    } else {
      doc.text('No payments recorded.', 40, y); y += 20
    }

    if (ms.length > 0) {
      doc.setFontSize(11); doc.setFont(undefined, 'bold')
      doc.text('Payment Milestones', 40, y); y += 6
      autoTable(doc, {
        startY: y,
        head: [['Milestone', 'Due Date', 'Planned Amount', 'Status']],
        body: ms.map(m => [m.label, m.due_date || '—', fmt(m.planned_amount), m.is_paid ? 'Paid' : 'Pending']),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 95] },
        margin: { left: 40, right: 40 },
      })
    }

    doc.save(`${p.name.replace(/[^a-z0-9]+/gi, '_')}_report.pdf`)
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

      {/* Feature 1: budget overrun alerts */}
      {overBudgetProjects.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
          <strong style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {overBudgetProjects.length} project{overBudgetProjects.length === 1 ? '' : 's'} over budget</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#991b1b' }}>
            {overBudgetProjects.map(p => (
              <li key={p.id}>{p.name} — paid {fmt(p.paid)} of {fmt(p.budget_amount)} budget (over by {fmt(p.paid - p.budget_amount)})</li>
            ))}
          </ul>
        </div>
      )}

      {/* Feature 2: overdue/stalled project alerts */}
      {overdueProjects.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
          <strong style={{ color: '#92400e', fontSize: 13 }}>⏰ {overdueProjects.length} project{overdueProjects.length === 1 ? '' : 's'} past target date, still Ongoing</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#b45309' }}>
            {overdueProjects.map(p => (
              <li key={p.id}>{p.name} — target was {p.target_end_date}</li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Feature 7 & 8: contractor spend + category chart */}
      {projectRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 18 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>👷 Contractor-wise Spend</h3>
            {contractorSpend.length === 0 ? (
              <p style={{ fontSize: 12.5, color: '#94a3b8' }}>No data yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 10.5, textTransform: 'uppercase' }}>
                    <th style={{ padding: '4px 6px' }}>Contractor</th>
                    <th style={{ padding: '4px 6px' }}>Projects</th>
                    <th style={{ padding: '4px 6px' }}>Budget</th>
                    <th style={{ padding: '4px 6px' }}>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {contractorSpend.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 6px' }}>{c.contractor}</td>
                      <td style={{ padding: '5px 6px' }}>{c.projectCount}</td>
                      <td style={{ padding: '5px 6px' }}>{fmt(c.budget)}</td>
                      <td style={{ padding: '5px 6px', fontWeight: 600, color: '#16a34a' }}>{fmt(c.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>📊 Category Spend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categorySpend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budget" name="Budget" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
            {/* Feature 3: progress % */}
            <div>
              <label style={label}>Progress (%)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={newProject.progress_pct} onChange={e => setNewProject(v => ({ ...v, progress_pct: e.target.value }))} />
            </div>
            {/* Feature 5: contract file upload */}
            <div>
              <label style={label}>Contract / Agreement File</label>
              <input style={inputStyle} type="file" onChange={e => setContractFile(e.target.files?.[0] || null)} />
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
            <button style={btnGhost} onClick={() => { setShowAddProject(false); setNewProject(emptyProject); setContractFile(null) }}>Cancel</button>
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
            const msList = milestonesByProject[p.id] || []
            const logList = activityByProject[p.id] || []
            const subTab = activeSubTab[p.id] || 'payments'
            const setSubTab = (t) => setActiveSubTab(v => ({ ...v, [p.id]: t }))
            return (
              <div key={p.id} style={{ ...card, ...(p.isOverBudget ? { borderColor: '#fecaca' } : p.isOverdue ? { borderColor: '#fde68a' } : {}) }}>
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
                      <div>
                        <label style={label}>Progress (%)</label>
                        <input style={inputStyle} type="number" min="0" max="100" disabled={editDraft.status === 'Completed'} value={editDraft.status === 'Completed' ? 100 : editDraft.progress_pct} onChange={e => setEditDraft(v => ({ ...v, progress_pct: e.target.value }))} />
                      </div>
                      <div>
                        <label style={label}>Replace Contract File</label>
                        <input style={inputStyle} type="file" onChange={e => setEditContractFile(e.target.files?.[0] || null)} />
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
                      <button style={btnPrimary} onClick={() => saveEdit(p)}>💾 Save Changes</button>
                      <button style={btnGhost} onClick={() => { setEditingProject(null); setEditDraft(null); setEditContractFile(null) }}>Cancel</button>
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
                          {p.isOverBudget && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c' }}>⚠ Over Budget</span>}
                          {p.isOverdue && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309' }}>⏰ Overdue</span>}
                        </div>
                        {p.description && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>{p.description}</p>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#64748b' }}>
                          {p.contractor && <span>👷 {p.contractor}{p.contractor_phone ? ` · ${p.contractor_phone}` : ''}</span>}
                          {p.start_date && <span>📅 Started {p.start_date}</span>}
                          {p.target_end_date && <span>🎯 Target {p.target_end_date}</span>}
                          {p.completed_date && <span>✅ Completed {p.completed_date}</span>}
                          {p.contract_file_url && <a href={p.contract_file_url} target="_blank" rel="noreferrer" style={{ color: '#1e3a5f', fontWeight: 600 }}>📄 Contract File</a>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button style={btnGhost} onClick={() => generateProjectReport(p)}>📄 Report</button>
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

                    {/* Feature 3: work progress slider */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 4 }}>
                        <span>Work Progress</span>
                        <span style={{ fontWeight: 700, color: '#7c3aed' }}>{p.progress_pct || 0}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" value={p.progress_pct || 0}
                        disabled={p.status === 'Completed'}
                        onChange={e => updateProgress(p, Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                      <button style={{ ...btnGhost, ...btnSmall, ...(subTab === 'payments' && isExpanded ? { background: '#1e3a5f', color: '#fff' } : {}) }} onClick={() => { setSubTab('payments'); setExpandedId(p.id) }}>
                        💳 Payments ({p.paymentCount})
                      </button>
                      <button style={{ ...btnGhost, ...btnSmall, ...(subTab === 'milestones' && isExpanded ? { background: '#1e3a5f', color: '#fff' } : {}) }} onClick={() => { setSubTab('milestones'); setExpandedId(p.id) }}>
                        🎯 Milestones ({msList.length})
                      </button>
                      <button style={{ ...btnGhost, ...btnSmall, ...(subTab === 'activity' && isExpanded ? { background: '#1e3a5f', color: '#fff' } : {}) }} onClick={() => { setSubTab('activity'); setExpandedId(p.id) }}>
                        📜 Activity ({logList.length})
                      </button>
                      {isExpanded && (
                        <button style={{ ...btnGhost, ...btnSmall, marginLeft: 'auto' }} onClick={() => setExpandedId(null)}>▲ Hide</button>
                      )}
                    </div>

                    {isExpanded && subTab === 'payments' && (
                      <div style={{ marginTop: 12 }}>
                        <button style={btnPrimary} onClick={() => setShowAddPayment(showAddPayment === p.id ? null : p.id)}>
                          {showAddPayment === p.id ? '✖ Cancel' : '+ Record Payment'}
                        </button>

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
                              {/* Feature 4: receipt/photo upload */}
                              <div>
                                <label style={label}>Receipt / Photo</label>
                                <input style={inputStyle} type="file" accept="image/*,.pdf" onChange={e => setPaymentReceiptFile(e.target.files?.[0] || null)} />
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
                              <button style={btnGhost} onClick={() => { setShowAddPayment(null); setNewPayment(emptyPayment); setPaymentReceiptFile(null) }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: 12 }}>
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
                                  <th style={{ padding: '4px 8px' }}>Receipt</th>
                                  <th style={{ padding: '4px 8px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {pays.slice().sort((a, b) => (b.pay_date || '').localeCompare(a.pay_date || '')).map(pm => (
                                  <tr key={pm.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 8px' }}>{pm.pay_date}</td>
                                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#16a34a' }}>{fmt(pm.amount)}</td>
                                    <td style={{ padding: '6px 8px' }}>{pm.pay_mode || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>{pm.txn_ref || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>{pm.paid_by || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>{pm.received_by || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>{pm.notes || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      {pm.receipt_url ? <a href={pm.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#1e3a5f', fontWeight: 600 }}>View</a> : '—'}
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => deletePayment(pm)}>Delete</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Feature 9: milestones/schedule */}
                    {isExpanded && subTab === 'milestones' && (
                      <div style={{ marginTop: 12 }}>
                        <button style={btnPrimary} onClick={() => setShowAddMilestone(showAddMilestone === p.id ? null : p.id)}>
                          {showAddMilestone === p.id ? '✖ Cancel' : '+ Add Milestone'}
                        </button>

                        {showAddMilestone === p.id && (
                          <div style={{ marginTop: 12, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                              <div>
                                <label style={label}>Milestone Label *</label>
                                <input style={inputStyle} value={newMilestone.label} onChange={e => setNewMilestone(v => ({ ...v, label: e.target.value }))} placeholder="e.g. Foundation complete" />
                              </div>
                              <div>
                                <label style={label}>Due Date</label>
                                <input style={inputStyle} type="date" value={newMilestone.due_date} onChange={e => setNewMilestone(v => ({ ...v, due_date: e.target.value }))} />
                              </div>
                              <div>
                                <label style={label}>Planned Amount (₹)</label>
                                <input style={inputStyle} type="number" value={newMilestone.planned_amount} onChange={e => setNewMilestone(v => ({ ...v, planned_amount: e.target.value }))} />
                              </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                              <button style={btnPrimary} disabled={savingMilestone} onClick={() => addMilestone(p.id)}>
                                {savingMilestone ? 'Saving…' : '✅ Save Milestone'}
                              </button>
                              <button style={btnGhost} onClick={() => { setShowAddMilestone(null); setNewMilestone(emptyMilestone) }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: 12 }}>
                          {msList.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No milestones scheduled yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {msList.map(ms => {
                                const msOverdue = ms.due_date && !ms.is_paid && ms.due_date < today()
                                return (
                                  <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: ms.is_paid ? '#f0fdf4' : msOverdue ? '#fef2f2' : '#f8fafc', borderRadius: 8, border: `1px solid ${ms.is_paid ? '#bbf7d0' : msOverdue ? '#fecaca' : '#e2e8f0'}` }}>
                                    <input type="checkbox" checked={!!ms.is_paid} onChange={() => toggleMilestonePaid(ms)} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', textDecoration: ms.is_paid ? 'line-through' : 'none' }}>{ms.label}</div>
                                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                        Due {ms.due_date || '—'} · {fmt(ms.planned_amount)}
                                        {msOverdue && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · Overdue</span>}
                                      </div>
                                    </div>
                                    <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => deleteMilestone(ms)}>Delete</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Feature 10: activity/audit log */}
                    {isExpanded && subTab === 'activity' && (
                      <div style={{ marginTop: 12 }}>
                        {logList.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No activity recorded yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {logList.map(a => (
                              <div key={a.id} style={{ fontSize: 12.5, color: '#475569', padding: '6px 10px', borderLeft: '2px solid #e2e8f0' }}>
                                <span style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(a.at).toLocaleString('en-IN')}</span>
                                {' — '}
                                <strong>{a.actor || 'Unknown'}</strong>: {a.detail || a.action}
                              </div>
                            ))}
                          </div>
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
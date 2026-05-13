import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const ADMIN_PIN = '1234' // Change this to your actual admin PIN

const LEVELS = [
  { min: 90, max: 100, label: 'Elite',        emoji: '💎', color: '#7c3aed', bg: '#f3e8ff', border: '#7c3aed' },
  { min: 75, max: 89,  label: 'Outstanding',  emoji: '🥇', color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
  { min: 60, max: 74,  label: 'Excellent',    emoji: '🥈', color: '#374151', bg: '#f1f5f9', border: '#94a3b8' },
  { min: 45, max: 59,  label: 'Good',         emoji: '🥉', color: '#92400e', bg: '#fde68a', border: '#d97706' },
  { min: 0,  max: 44,  label: 'Probation',    emoji: '🔰', color: '#dc2626', bg: '#fee2e2', border: '#f87171' },
]

const getLevel = (score) => {
  if (score === null || score === undefined) return null
  return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[4]
}

const calcScores = (row) => {
  const p1 = row.working_days > 0
    ? Math.min(30, (row.days_present / row.working_days) * 30)
    : 0
  const p2 = Math.max(0, 20 - (row.late_count || 0) * 1 - (row.early_leave_count || 0) * 0.5)
  const p3 = row.tasks_assigned > 0
    ? Math.min(20, (row.tasks_completed_on_time / row.tasks_assigned) * 20)
    : 0
  const p4 = row.feedback_avg > 0
    ? Math.min(15, (row.feedback_avg / 5) * 15)
    : 0
  const p5 = row.initiative_score > 0
    ? Math.min(15, (row.initiative_score / 5) * 15)
    : 0
  const total = parseFloat((p1 + p2 + p3 + p4 + p5).toFixed(1))
  return {
    p1: parseFloat(p1.toFixed(1)),
    p2: parseFloat(p2.toFixed(1)),
    p3: parseFloat(p3.toFixed(1)),
    p4: parseFloat(p4.toFixed(1)),
    p5: parseFloat(p5.toFixed(1)),
    total,
  }
}

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatMonth = (m) => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const fmt = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

const emptyForm = {
  name: '', phone: '', email: '', department: '',
  designation: '', joining_date: '', qualification: '', status: 'Active',
}

const emptyScore = {
  working_days: 26, days_present: 0, late_count: 0,
  early_leave_count: 0, tasks_assigned: 0, tasks_completed_on_time: 0,
  feedback_avg: 0, initiative_score: 0,
}

const emptySalary = {
  basic_salary: 0,
  seniority_allowance: 0,
  loyalty_bonus: 0,
  role_bonus: 0,
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '24px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  card: { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '20px' },
  btn: (color = '#1e3a5f', disabled = false) => ({
    backgroundColor: disabled ? '#94a3b8' : color,
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '10px 20px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px', transition: 'opacity 0.2s',
  }),
  btnSm: (color = '#1e3a5f') => ({
    backgroundColor: color, color: 'white', border: 'none',
    borderRadius: '6px', padding: '6px 12px', fontWeight: '600',
    cursor: 'pointer', fontSize: '12px',
  }),
  input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' },
  tab: (active) => ({
    padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottomWidth: '3px', borderBottomStyle: 'solid',
    borderBottomColor: active ? '#1e3a5f' : 'transparent',
    color: active ? '#1e3a5f' : '#64748b',
  }),
}

// ─── Admin PIN Gate ───────────────────────────────────────────────────────────

function AdminPinModal({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleVerify = () => {
    if (pin === ADMIN_PIN) {
      onSuccess()
    } else {
      setError('Incorrect PIN. Admin access only.')
      setPin('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '36px',
        width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔐</div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: '0 0 6px' }}>
          Admin Access Required
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>
          Salary configuration is restricted to administrators only.
        </p>
        <input
          type="password"
          placeholder="Enter Admin PIN"
          value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          style={{
            ...S.input,
            textAlign: 'center',
            fontSize: '20px',
            letterSpacing: '8px',
            marginBottom: '12px',
          }}
          autoFocus
        />
        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', borderRadius: '8px',
            padding: '8px 12px', fontSize: '13px', fontWeight: '600', marginBottom: '12px',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ ...S.btn('#64748b'), flex: 1 }}>
            Cancel
          </button>
          <button onClick={handleVerify} style={{ ...S.btn('#1e3a5f'), flex: 1 }}>
            🔓 Verify
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Staff Modal ────────────────────────────────────────────────────────

function EditStaffModal({ staffMember, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staffMember.name || '',
    phone: staffMember.phone || '',
    email: staffMember.email || '',
    department: staffMember.department || '',
    designation: staffMember.designation || '',
    joining_date: staffMember.joining_date || '',
    qualification: staffMember.qualification || '',
    status: staffMember.status || 'Active',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_profiles')
        .update({
          name: form.name,
          phone: form.phone,
          email: form.email,
          department: form.department,
          designation: form.designation,
          joining_date: form.joining_date || null,
          qualification: form.qualification,
          status: form.status,
        })
        .eq('id', staffMember.id)

      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      alert('Error updating staff: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '540px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #254e91 100%)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
              ✏️ Edit Staff Profile
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginTop: '4px' }}>
              {staffMember.name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { key: 'name',         label: 'Full Name',      required: true },
              { key: 'phone',        label: 'Phone' },
              { key: 'email',        label: 'Email',          type: 'email' },
              { key: 'designation',  label: 'Designation',    placeholder: 'Teacher / Accountant / Clerk', required: true },
              { key: 'joining_date', label: 'Joining Date',   type: 'date' },
              { key: 'qualification',label: 'Qualification',  placeholder: 'B.Ed / M.A / B.Com' },
            ].map(f => (
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                  required={f.required}
                  placeholder={f.placeholder || ''}
                  style={S.input}
                />
              </div>
            ))}
            <div>
              <label style={S.label}>Department</label>
              <select value={form.department} onChange={e => handleChange('department', e.target.value)} required style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="">Select Department</option>
                {['Academic','Administration','Accounts','Hostel','Reception','Transport','Maintenance'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select value={form.status} onChange={e => handleChange('status', e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ ...S.btn('#64748b'), flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...S.btn('#16a34a', saving), flex: 2 }}>
              {saving ? '⏳ Saving...' : '💾 Update Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Salary Setup Modal ───────────────────────────────────────────────────────

function SalarySetupModal({ staffMember, onClose, onSaved }) {
  const [salaryForm, setSalaryForm] = useState({
    basic_salary: staffMember.basic_salary || 0,
    seniority_allowance: staffMember.seniority_allowance || 0,
    loyalty_bonus: staffMember.loyalty_bonus || 0,
    role_bonus: staffMember.role_bonus || 0,
  })
  const [saving, setSaving] = useState(false)

  const gross =
    Number(salaryForm.basic_salary) +
    Number(salaryForm.seniority_allowance) +
    Number(salaryForm.loyalty_bonus) +
    Number(salaryForm.role_bonus)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff_profiles')
        .update({
          basic_salary: Number(salaryForm.basic_salary) || 0,
          seniority_allowance: Number(salaryForm.seniority_allowance) || 0,
          loyalty_bonus: Number(salaryForm.loyalty_bonus) || 0,
          role_bonus: Number(salaryForm.role_bonus) || 0,
        })
        .eq('id', staffMember.id)

      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving salary: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'basic_salary',         label: 'Basic Salary',         icon: '💰', color: '#0C447C', desc: 'Fixed monthly base pay' },
    { key: 'seniority_allowance',  label: 'Seniority Allowance',  icon: '⭐', color: '#7c3aed', desc: 'Based on years of service' },
    { key: 'loyalty_bonus',        label: 'Loyalty Bonus',        icon: '🎖️', color: '#b45309', desc: 'Long-term retention reward' },
    { key: 'role_bonus',           label: 'Role Bonus',           icon: '🏅', color: '#16a34a', desc: 'Position-specific incentive' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #254e91 100%)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
              🔐 Admin · Salary Configuration
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginTop: '4px' }}>
              {staffMember.name}
            </div>
            <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '2px' }}>
              {staffMember.designation || staffMember.department || '—'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {fields.map(f => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: '#f8fafc', borderRadius: '10px', padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'white', border: `1.5px solid ${f.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>{f.label}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{f.desc}</div>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '13px', fontWeight: '700', color: f.color,
                  }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    value={salaryForm[f.key]}
                    onChange={e => setSalaryForm({ ...salaryForm, [f.key]: e.target.value })}
                    style={{
                      width: '110px', padding: '8px 8px 8px 24px',
                      borderRadius: '8px', border: `1.5px solid ${f.color}44`,
                      fontSize: '14px', fontWeight: '700', color: f.color,
                      background: 'white', textAlign: 'right',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Gross Summary */}
          <div style={{
            background: 'linear-gradient(135deg, #E6F1FB 0%, #EAF3DE 100%)',
            borderRadius: '10px', padding: '14px 16px',
            border: '1.5px solid #1B3A6B22',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Gross Monthly Salary
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Basic + all allowances & bonuses
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0C447C' }}>
              {fmt(gross)}
            </div>
          </div>

          {/* Breakdown pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {fields.map(f => (
              <div key={f.key} style={{
                background: 'white', border: `1px solid ${f.color}33`,
                borderRadius: '999px', padding: '4px 12px',
                fontSize: '12px', color: f.color, fontWeight: '600',
              }}>
                {f.icon} {fmt(salaryForm[f.key])}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ ...S.btn('#64748b'), flex: 1 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ ...S.btn('#1e3a5f', saving), flex: 2 }}>
              {saving ? '⏳ Saving...' : '💾 Save Salary Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Level Badge ─────────────────────────────────────────────────────────────

function LevelBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
  const lvl = getLevel(score)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
      fontWeight: '700', background: lvl.bg, color: lvl.color,
      border: `1px solid ${lvl.border}`,
    }}>
      {lvl.emoji} {lvl.label}
    </span>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max, color = '#1e3a5f' }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: '700', color, minWidth: '36px', textAlign: 'right' }}>{value}/{max}</span>
    </div>
  )
}

// ─── Scorecard Modal ──────────────────────────────────────────────────────────

function ScorecardModal({ record, staffName, onClose }) {
  if (!record) return null
  const { p1, p2, p3, p4, p5, total } = calcScores(record)
  const lvl = getLevel(total)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{staffName}</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{formatMonth(record.month)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ textAlign: 'center', padding: '20px', background: lvl.bg, borderRadius: '12px', marginBottom: '24px', border: `2px solid ${lvl.border}` }}>
          <div style={{ fontSize: '36px' }}>{lvl.emoji}</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: lvl.color }}>{total}</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: lvl.color }}>{lvl.label}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Attendance',      score: p1, max: 30, color: '#0ea5e9', detail: `${record.days_present}/${record.working_days} days` },
            { label: 'Punctuality',     score: p2, max: 20, color: '#10b981', detail: `${record.late_count} late, ${record.early_leave_count} early leaves` },
            { label: 'Task Completion', score: p3, max: 20, color: '#f59e0b', detail: `${record.tasks_completed_on_time}/${record.tasks_assigned} tasks` },
            { label: 'Feedback',        score: p4, max: 15, color: '#8b5cf6', detail: `Avg rating: ${record.feedback_avg}/5` },
            { label: 'Initiative',      score: p5, max: 15, color: '#ec4899', detail: `Authority rating: ${record.initiative_score}/5` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{item.label}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.detail}</span>
              </div>
              <ScoreBar value={item.score} max={item.max} color={item.color} />
            </div>
          ))}
        </div>
        {record.is_confirmed && (
          <div style={{ marginTop: '20px', padding: '10px 14px', background: '#dcfce7', borderRadius: '8px', fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
            ✅ Confirmed by {record.confirmed_by} on {record.confirmed_at ? new Date(record.confirmed_at).toLocaleDateString() : '—'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Score Entry Row ──────────────────────────────────────────────────────────

function ScoreEntryRow({ staff, score, onChange }) {
  const computed = score ? calcScores(score) : null
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b', minWidth: '140px' }}>
        {staff.name}
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>{staff.designation}</div>
      </td>
      {[
        { key: 'days_present',            label: 'Present',          max: score?.working_days || 26 },
        { key: 'late_count',              label: 'Late' },
        { key: 'early_leave_count',       label: 'Early Out' },
        { key: 'tasks_assigned',          label: 'Tasks' },
        { key: 'tasks_completed_on_time', label: 'Done' },
        { key: 'feedback_avg',            label: 'Feedback (1-5)', step: 0.1, max: 5 },
        { key: 'initiative_score',        label: 'Initiative (1-5)', max: 5 },
      ].map(field => (
        <td key={field.key} style={{ padding: '8px' }}>
          <input
            type="number"
            min="0"
            max={field.max || 99}
            step={field.step || 1}
            value={score?.[field.key] ?? 0}
            onChange={e => onChange(staff.id, field.key, parseFloat(e.target.value) || 0)}
            style={{ width: '70px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', textAlign: 'center' }}
          />
        </td>
      ))}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {computed ? (
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>{computed.total}</div>
            <LevelBadge score={computed.total} />
          </div>
        ) : '—'}
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [form, setForm] = useState(emptyForm)
  const [activeTab, setActiveTab] = useState('staff')
  const [scoreMonth, setScoreMonth] = useState(currentMonth())
  const [scores, setScores] = useState({})
  const [scoreSaving, setScoreSaving] = useState(false)
  const [allMonthlyScores, setAllMonthlyScores] = useState([])
  const [selectedScorecard, setSelectedScorecard] = useState(null)
  const [historyStaffId, setHistoryStaffId] = useState('')
  const [workingDays, setWorkingDays] = useState(26)

  // ── Salary Setup State ──
  const [salaryTarget, setSalaryTarget]   = useState(null) // staff to configure
  const [showPinModal, setShowPinModal]   = useState(false)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showSalaryModal, setShowSalaryModal] = useState(false)

  // ── Edit Staff State ──
  const [editingStaff, setEditingStaff] = useState(null)

  // ── Fetch ──

  const fetchStaff = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setStaff(data || [])
    setLoading(false)
  }

  const fetchScoresForMonth = async (month) => {
    const { data } = await supabase.from('staff_monthly_scores').select('*').eq('month', month)
    if (data) {
      const map = {}
      data.forEach(r => { map[r.staff_id] = r })
      setScores(map)
      setWorkingDays(data[0]?.working_days || 26)
    } else {
      setScores({})
    }
  }

  const fetchAllScores = async () => {
    const { data } = await supabase.from('staff_monthly_scores').select('*').order('month', { ascending: false })
    if (data) setAllMonthlyScores(data)
  }

  useEffect(() => { fetchStaff() }, [])
  useEffect(() => { if (activeTab === 'scoring') fetchScoresForMonth(scoreMonth) }, [activeTab, scoreMonth])
  useEffect(() => { if (activeTab === 'leaderboard') { fetchScoresForMonth(scoreMonth); fetchAllScores() } }, [activeTab, scoreMonth])
  useEffect(() => { if (activeTab === 'history') fetchAllScores() }, [activeTab])

  // ── Staff CRUD ──

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('staff_profiles').insert([{
      name: form.name, phone: form.phone, email: form.email,
      department: form.department, designation: form.designation,
      joining_date: form.joining_date || null,
      qualification: form.qualification, status: form.status,
      // salary fields default to 0 on creation — admin sets later
      basic_salary: 0, seniority_allowance: 0, loyalty_bonus: 0, role_bonus: 0,
    }])
    if (error) alert('Error: ' + error.message)
    else { setForm(emptyForm); setShowForm(false); fetchStaff() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this staff record?')) {
      const { error } = await supabase.from('staff_profiles').delete().eq('id', id)
      if (error) alert('Error: ' + error.message)
      else fetchStaff()
    }
  }

  // ── Edit Staff ──
  const handleOpenEdit = (staffMember) => {
    setEditingStaff(staffMember)
  }

  const handleEditSaved = () => {
    fetchStaff()
    setEditingStaff(null)
  }

  // ── Salary Setup Flow ──

  const handleOpenSalarySetup = (staffMember) => {
    setSalaryTarget(staffMember)
    if (adminUnlocked) {
      setShowSalaryModal(true)
    } else {
      setShowPinModal(true)
    }
  }

  const handlePinSuccess = () => {
    setAdminUnlocked(true)
    setShowPinModal(false)
    setShowSalaryModal(true)
  }

  const handleSalarySaved = () => {
    fetchStaff() // re-fetch so Salary.jsx also gets fresh data from staff_profiles
  }

  // ── Score Entry ──

  const handleScoreChange = (staffId, field, value) => {
    setScores(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || { ...emptyScore, working_days: workingDays, staff_id: staffId, month: scoreMonth }),
        [field]: value,
      }
    }))
  }

  const handleSaveScores = async () => {
    setScoreSaving(true)
    const rows = staff.map(s => {
      const row = scores[s.id] || { ...emptyScore, working_days: workingDays }
      const computed = calcScores({ ...row, working_days: workingDays })
      return {
        staff_id: s.id,
        month: scoreMonth,
        working_days: workingDays,
        days_present: row.days_present || 0,
        late_count: row.late_count || 0,
        early_leave_count: row.early_leave_count || 0,
        tasks_assigned: row.tasks_assigned || 0,
        tasks_completed_on_time: row.tasks_completed_on_time || 0,
        feedback_avg: row.feedback_avg || 0,
        initiative_score: row.initiative_score || 0,
        p1_attendance: computed.p1,
        p2_punctuality: computed.p2,
        p3_tasks: computed.p3,
        p4_feedback: computed.p4,
        p5_initiative: computed.p5,
        total_score: computed.total,
        level: getLevel(computed.total)?.label || 'Probation',
      }
    })
    const { error } = await supabase.from('staff_monthly_scores').upsert(rows, { onConflict: 'staff_id,month' })
    if (error) alert('Error saving scores: ' + error.message)
    else { alert('✅ Scores saved for ' + formatMonth(scoreMonth)); fetchScoresForMonth(scoreMonth) }
    setScoreSaving(false)
  }

  const handleConfirmScores = async () => {
    if (!window.confirm(`Confirm and lock scores for ${formatMonth(scoreMonth)}?`)) return
    const { error } = await supabase
      .from('staff_monthly_scores')
      .update({ is_confirmed: true, confirmed_by: 'Authority', confirmed_at: new Date().toISOString() })
      .eq('month', scoreMonth)
    if (error) alert('Error: ' + error.message)
    else { alert('✅ Scores confirmed and locked!'); fetchScoresForMonth(scoreMonth) }
  }

  // ── Derived ──

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase()
    return staff.filter(item => {
      const matchSearch = ['name','phone','email','department','designation','qualification']
        .some(k => (item[k] || '').toLowerCase().includes(q))
      const matchStatus = statusFilter === 'All' || item.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [staff, search, statusFilter])

  const leaderboard = useMemo(() => {
    return staff.map(s => {
      const sc = scores[s.id]
      const computed = sc ? calcScores(sc) : null
      return { ...s, score: computed?.total ?? null }
    }).filter(s => s.score !== null).sort((a, b) => b.score - a.score)
  }, [staff, scores])

  const historyData = useMemo(() => {
    if (!historyStaffId) return []
    return allMonthlyScores
      .filter(r => r.staff_id === historyStaffId)
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [allMonthlyScores, historyStaffId])

  const statsCards = [
    { label: 'Total Staff',    value: staff.length,                                                      color: '#1e3a5f', bg: '#eff6ff', icon: '👨‍🏫' },
    { label: 'Active Staff',   value: staff.filter(s => s.status === 'Active').length,                   color: '#16a34a', bg: '#dcfce7', icon: '✅' },
    { label: 'Inactive Staff', value: staff.filter(s => s.status === 'Inactive').length,                 color: '#dc2626', bg: '#fee2e2', icon: '⏸️' },
    { label: 'Salary Set',     value: staff.filter(s => Number(s.basic_salary) > 0).length,              color: '#7c3aed', bg: '#f3e8ff', icon: '💰' },
  ]

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>👨‍🏫 Staff Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Manage profiles, performance scoring, leaderboard & history</p>
        </div>
        {activeTab === 'staff' && (
          <button onClick={() => setShowForm(!showForm)} style={S.btn()}>
            {showForm ? '✖ Cancel' : '➕ Add Staff'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', gap: '4px' }}>
        {[
          { key: 'staff',       label: '👥 Staff List' },
          { key: 'scoring',     label: '📊 Monthly Scoring' },
          { key: 'leaderboard', label: '🏆 Leaderboard' },
          { key: 'history',     label: '📅 Score History' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: STAFF LIST ── */}
      {activeTab === 'staff' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {statsCards.map(card => (
              <div key={card.label} style={{ backgroundColor: card.bg, borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{card.icon}</div>
                <p style={{ fontSize: '13px', color: card.color, fontWeight: '600', margin: 0 }}>{card.label}</p>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: card.color, margin: '4px 0 0' }}>{card.value}</h2>
              </div>
            ))}
          </div>

          {/* Add Form */}
          {showForm && (
            <div style={S.card}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e3a5f', marginTop: 0 }}>Add Staff Profile</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '-8px', marginBottom: '16px' }}>
                💡 Salary will be configured separately by admin after staff is added.
              </p>
              <form onSubmit={handleAdd}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { key: 'name',         label: 'Full Name',      required: true },
                    { key: 'phone',        label: 'Phone' },
                    { key: 'email',        label: 'Email',          type: 'email' },
                    { key: 'designation',  label: 'Designation',    placeholder: 'Teacher / Accountant / Clerk', required: true },
                    { key: 'joining_date', label: 'Joining Date',   type: 'date' },
                    { key: 'qualification',label: 'Qualification',  placeholder: 'B.Ed / M.A / B.Com' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <input
                        type={f.type || 'text'}
                        value={form[f.key]}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        required={f.required}
                        placeholder={f.placeholder || ''}
                        style={S.input}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Department</label>
                    <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required style={{ ...S.input, backgroundColor: 'white' }}>
                      <option value="">Select Department</option>
                      {['Academic','Administration','Accounts','Hostel','Reception','Transport','Maintenance'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...S.input, backgroundColor: 'white' }}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={{ ...S.btn('#1e3a5f', saving), marginTop: '16px' }}>
                  {saving ? '⏳ Saving...' : '✅ Save Staff'}
                </button>
              </form>
            </div>
          )}

          {/* Search & Filter */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <input placeholder="🔍 Search by name, phone, email, department..." value={search} onChange={e => setSearch(e.target.value)} style={S.input} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...S.input, backgroundColor: 'white' }}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
            Showing {filteredStaff.length} of {staff.length} staff
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>⏳ Loading staff...</div>
          ) : (
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#','Name','Department','Designation','Phone','Joining Date','Status','Gross Salary','Level','Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '13px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((item, i) => {
                    const sc = scores[item.id]
                    const computed = sc ? calcScores(sc) : null
                    const gross = (Number(item.basic_salary) || 0) +
                      (Number(item.seniority_allowance) || 0) +
                      (Number(item.loyalty_bonus) || 0) +
                      (Number(item.role_bonus) || 0)
                    const salarySet = gross > 0

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{item.email || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.department || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.designation || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.phone || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.joining_date || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                            backgroundColor: item.status === 'Active' ? '#dcfce7' : '#fee2e2',
                            color: item.status === 'Active' ? '#16a34a' : '#dc2626',
                          }}>
                            {item.status}
                          </span>
                        </td>

                        {/* Gross Salary Cell — shows amount or "Not Set" */}
                        <td style={{ padding: '12px 16px' }}>
                          {salarySet ? (
                            <div>
                              <div style={{ fontWeight: '700', color: '#0C447C', fontSize: '14px' }}>{fmt(gross)}</div>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                Basic {fmt(item.basic_salary)}
                              </div>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '11px', fontWeight: '600',
                              color: '#dc2626', background: '#fee2e2',
                              padding: '3px 8px', borderRadius: '6px',
                            }}>
                              ⚠ Not Set
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <LevelBadge score={computed?.total} />
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEdit(item)}
                              style={{
                                ...S.btnSm('#0891b2'),
                                display: 'flex', alignItems: 'center', gap: '4px',
                              }}
                              title="Edit Staff Profile"
                            >
                              ✏️
                            </button>
                            {/* Salary Setup Button */}
                            <button
                              onClick={() => handleOpenSalarySetup(item)}
                              style={{
                                ...S.btnSm(salarySet ? '#0C447C' : '#dc2626'),
                                display: 'flex', alignItems: 'center', gap: '4px',
                              }}
                              title="Configure Salary (Admin Only)"
                            >
                              🔐 Salary
                            </button>
                            {computed && (
                              <button onClick={() => setSelectedScorecard({ record: { ...sc, ...computed }, staffName: item.name })} style={S.btnSm('#7c3aed')}>
                                📊
                              </button>
                            )}
                            <button onClick={() => handleDelete(item.id)} style={S.btnSm('#dc2626')}>
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No staff records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Admin lock status notice */}
          <div style={{
            marginTop: '12px', padding: '10px 16px',
            background: adminUnlocked ? '#dcfce7' : '#f1f5f9',
            borderRadius: '8px', fontSize: '12px',
            color: adminUnlocked ? '#16a34a' : '#94a3b8',
            fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            {adminUnlocked ? '🔓 Admin session active — salary edits unlocked' : '🔒 Salary setup requires admin PIN'}
          </div>
        </>
      )}

      {/* ── TAB: MONTHLY SCORING ── */}
      {activeTab === 'scoring' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>📊 Monthly Performance Entry</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Fill scores for all staff. System auto-calculates totals.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ ...S.label, display: 'inline', marginRight: '8px' }}>Working Days:</label>
                <input type="number" min="1" max="31" value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value) || 26)}
                  style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ ...S.label, display: 'inline', marginRight: '8px' }}>Month:</label>
                <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }} />
              </div>
              <button onClick={handleSaveScores} disabled={scoreSaving} style={S.btn('#16a34a', scoreSaving)}>
                {scoreSaving ? '⏳ Saving...' : '💾 Save Scores'}
              </button>
              <button onClick={handleConfirmScores} style={S.btn('#7c3aed')}>
                ✅ Confirm & Lock
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            {LEVELS.map(l => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: l.color }}>
                {l.emoji} {l.label}: {l.min}–{l.max}
              </span>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1e3a5f', color: 'white' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Staff</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Present<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>Max {workingDays} (30pts)</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Late<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>Count (20pts)</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Early Out<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>Count</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Tasks<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>Assigned (20pts)</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Done<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>On Time</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Feedback<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>Avg 1-5 (15pts)</span></th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Initiative<br/><span style={{ fontWeight: '400', fontSize: '11px' }}>1-5 (15pts)</span></th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Score / Level</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <ScoreEntryRow
                    key={s.id}
                    staff={s}
                    score={scores[s.id] ? { ...scores[s.id], working_days: workingDays } : { ...emptyScore, working_days: workingDays }}
                    onChange={handleScoreChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: LEADERBOARD ── */}
      {activeTab === 'leaderboard' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>🏆 Performance Leaderboard</h2>
            <div>
              <label style={{ ...S.label, display: 'inline', marginRight: '8px' }}>Month:</label>
              <input type="month" value={scoreMonth} onChange={e => setScoreMonth(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }} />
            </div>
          </div>
          {leaderboard.length >= 3 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '32px' }}>
              {[leaderboard[1], leaderboard[0], leaderboard[2]].map((s, i) => {
                const heights = [160, 200, 140]
                const rank = i === 1 ? 1 : i === 0 ? 2 : 3
                const medals = ['🥇', '🥈', '🥉']
                const colors = ['#f59e0b', '#94a3b8', '#b45309']
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '24px' }}>{medals[rank - 1]}</div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', textAlign: 'center', maxWidth: '100px' }}>{s.name}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: colors[rank - 1] }}>{s.score}</div>
                    <LevelBadge score={s.score} />
                    <div style={{
                      width: '100px', height: `${heights[rank - 1]}px`,
                      background: `linear-gradient(to top, ${colors[rank - 1]}, ${colors[rank - 1]}88)`,
                      borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'center', paddingTop: '8px',
                      color: 'white', fontWeight: '800', fontSize: '20px',
                    }}>
                      #{rank}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Rank','Staff','Department','Attendance','Punctuality','Tasks','Feedback','Initiative','Total','Level'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((s, i) => {
                  const sc = scores[s.id]
                  const computed = sc ? calcScores({ ...sc, working_days: workingDays }) : null
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: i < 3 ? '#fffbeb' : 'white' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#64748b', fontSize: '16px' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.designation}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px' }}>{s.department}</td>
                      {computed ? (
                        <>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0ea5e9' }}>{computed.p1}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: '#10b981' }}>{computed.p2}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: '#f59e0b' }}>{computed.p3}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: '#8b5cf6' }}>{computed.p4}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: '#ec4899' }}>{computed.p5}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{computed.total}</td>
                        </>
                      ) : <td colSpan="5" style={{ padding: '12px 14px', color: '#94a3b8' }}>No data</td>}
                      <td style={{ padding: '12px 14px' }}><LevelBadge score={s.score} /></td>
                    </tr>
                  )
                })}
                {leaderboard.length === 0 && (
                  <tr><td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No scores for this month yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: HISTORY ── */}
      {activeTab === 'history' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>📅 Score History</h2>
            <div>
              <label style={{ ...S.label, display: 'inline', marginRight: '8px' }}>Select Staff:</label>
              <select value={historyStaffId} onChange={e => setHistoryStaffId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white', minWidth: '200px' }}>
                <option value="">-- Select Staff --</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>)}
              </select>
            </div>
          </div>
          {historyStaffId && historyData.length > 0 && (
            <>
              <div style={S.card}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f', marginTop: 0 }}>Score Trend</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px' }}>
                  {[...historyData].reverse().map(r => {
                    const lvl = getLevel(r.total_score)
                    const height = Math.max(20, (r.total_score / 100) * 100)
                    return (
                      <div key={r.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: lvl?.color }}>{r.total_score}</div>
                        <div style={{ width: '100%', height: `${height}px`, background: lvl?.border, borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                        <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>{formatMonth(r.month).split(' ')[0]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Month','Attendance','Punctuality','Tasks','Feedback','Initiative','Total','Level','Details'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(r => (
                      <tr key={r.month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b' }}>{formatMonth(r.month)}</td>
                        <td style={{ padding: '12px 14px', color: '#0ea5e9', fontWeight: '600' }}>{r.p1_attendance}</td>
                        <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: '600' }}>{r.p2_punctuality}</td>
                        <td style={{ padding: '12px 14px', color: '#f59e0b', fontWeight: '600' }}>{r.p3_tasks}</td>
                        <td style={{ padding: '12px 14px', color: '#8b5cf6', fontWeight: '600' }}>{r.p4_feedback}</td>
                        <td style={{ padding: '12px 14px', color: '#ec4899', fontWeight: '600' }}>{r.p5_initiative}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{r.total_score}</td>
                        <td style={{ padding: '12px 14px' }}><LevelBadge score={r.total_score} /></td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => setSelectedScorecard({ record: r, staffName: staff.find(s => s.id === historyStaffId)?.name })}
                            style={S.btnSm('#7c3aed')}
                          >
                            📊 View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {historyStaffId && historyData.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>No score history found for this staff member.</div>
          )}
          {!historyStaffId && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Select a staff member above to view their score history.</div>
          )}
        </>
      )}

      {/* ── Modals ── */}

      {editingStaff && (
        <EditStaffModal
          staffMember={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={handleEditSaved}
        />
      )}

      {showPinModal && (
        <AdminPinModal
          onSuccess={handlePinSuccess}
          onClose={() => { setShowPinModal(false); setSalaryTarget(null) }}
        />
      )}

      {showSalaryModal && salaryTarget && (
        <SalarySetupModal
          staffMember={salaryTarget}
          onClose={() => { setShowSalaryModal(false); setSalaryTarget(null) }}
          onSaved={handleSalarySaved}
        />
      )}

      {selectedScorecard && (
        <ScorecardModal
          record={selectedScorecard.record}
          staffName={selectedScorecard.staffName}
          onClose={() => setSelectedScorecard(null)}
        />
      )}
    </div>
  )
}

export default Staff

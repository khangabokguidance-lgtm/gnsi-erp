import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { staffDB, useStaffDB } from './staffDB'

// ─── constants ────────────────────────────────────────────────────────────────

const REQUIRED_DOCS = ['Aadhaar', 'PAN', 'Appointment Letter', 'Resume']

const DOC_TYPES = ['Aadhaar', 'PAN', 'Resume', 'Appointment Letter', 'Certificate', 'Contract', 'Other']

const ALERT_DAYS = 30 // warn if expiring within 30 days

const STATUTORY_RULES = [
  { id: 'pf',        label: 'PF Eligible',        months: 0,  desc: 'Eligible from day 1 of employment' },
  { id: 'esi',       label: 'ESI Eligible',        months: 0,  desc: 'Eligible from day 1 of employment' },
  { id: 'gratuity',  label: 'Gratuity Eligible',   months: 60, desc: 'Eligible after 5 years of service' },
  { id: 'bonus',     label: 'Statutory Bonus',     months: 12, desc: 'Eligible after 1 year of service' },
]

const WARNING_TEMPLATES = [
  {
    id: 'absence',
    label: 'Unauthorised Absence',
    body: (name, dept) =>
      `Dear ${name},\n\nThis letter is to formally warn you regarding your unauthorised absence from duty without prior intimation or approval from your reporting manager in the ${dept} department.\n\nYou are hereby directed to ensure regular attendance and comply with the leave application process as per company policy. Any further instance of unauthorised absence may result in disciplinary action, including termination of employment.\n\nPlease acknowledge receipt of this warning letter and provide a written explanation within 3 working days.\n\nYours sincerely,\nHR Department`,
  },
  {
    id: 'misconduct',
    label: 'Misconduct',
    body: (name, dept) =>
      `Dear ${name},\n\nThis letter serves as a formal warning regarding your conduct at the workplace in the ${dept} department, which has been found to be in violation of the company's Code of Conduct.\n\nYour behaviour is unacceptable and cannot be tolerated. You are hereby advised to immediately rectify your conduct and adhere strictly to the rules and regulations of the organisation. Failure to do so will result in strict disciplinary action.\n\nPlease sign and return a copy of this letter as acknowledgement.\n\nYours sincerely,\nHR Department`,
  },
  {
    id: 'performance',
    label: 'Poor Performance',
    body: (name, dept) =>
      `Dear ${name},\n\nThis letter is to formally notify you that your performance in the ${dept} department has been consistently below the expected standards set by the organisation.\n\nDespite previous verbal counselling sessions, there has been no noticeable improvement in your work output and quality. You are hereby placed on a Performance Improvement Plan (PIP) for a period of 30 days, during which your progress will be closely monitored.\n\nFailure to meet the targets outlined in the PIP may result in further disciplinary action. Please treat this matter with utmost seriousness.\n\nYours sincerely,\nHR Department`,
  },
  {
    id: 'insubordination',
    label: 'Insubordination',
    body: (name, dept) =>
      `Dear ${name},\n\nThis letter is to formally warn you regarding your act of insubordination towards your supervisor in the ${dept} department. Refusing to follow reasonable instructions from management is a serious breach of workplace discipline.\n\nYou are strongly advised to maintain professional decorum and comply with all lawful directions from your supervisors. Any repetition of such behaviour will be viewed very seriously and may lead to termination of your services.\n\nYours sincerely,\nHR Department`,
  },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date()

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - today()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const monthsSince = (dateStr) => {
  if (!dateStr) return 0
  const start = new Date(dateStr)
  const now = today()
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const expiryColor = (days) => {
  if (days === null) return null
  if (days < 0)   return { bg: '#fee2e2', color: '#dc2626', label: 'Expired' }
  if (days <= 7)  return { bg: '#fee2e2', color: '#dc2626', label: `${days}d left` }
  if (days <= 30) return { bg: '#fef9c3', color: '#ca8a04', label: `${days}d left` }
  return { bg: '#dcfce7', color: '#16a34a', label: `${days}d left` }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>{icon} {title}</h2>
        {subtitle && <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: '24px', ...style }}>
      {children}
    </div>
  )
}

// ── 1. Probation Expiry Alerts ────────────────────────────────────────────────
function ProbationAlerts({ records, staff }) {
  const alerts = useMemo(() => {
    return records
      .filter(r => r.employment_status === 'Probation' && r.probation_end_date)
      .map(r => ({ ...r, days: daysUntil(r.probation_end_date) }))
      .filter(r => r.days !== null && r.days <= 60)
      .sort((a, b) => a.days - b.days)
  }, [records])

  if (alerts.length === 0) return (
    <Card>
      <SectionHeader icon="⏳" title="Probation Expiry Alerts" subtitle="Staff whose probation ends within 60 days" />
      <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
        <p style={{ margin: 0, fontSize: '14px' }}>No probation periods expiring soon</p>
      </div>
    </Card>
  )

  return (
    <Card>
      <SectionHeader icon="⏳" title="Probation Expiry Alerts" subtitle={`${alerts.length} staff need attention`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {alerts.map(r => {
          const meta = r.days < 0 ? { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' }
            : r.days <= 7  ? { bg: '#fee2e2', color: '#dc2626', label: `${r.days} days left` }
            : r.days <= 30 ? { bg: '#fef9c3', color: '#ca8a04', label: `${r.days} days left` }
            : { bg: '#eff6ff', color: '#2563eb', label: `${r.days} days left` }
          const s = staff.find(x => x.id === r.staff_id)
          return (
            <div key={r.id} style={{ borderRadius: '10px', border: `1.5px solid ${meta.color}33`, backgroundColor: meta.bg, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{s?.name || r.staff_profiles?.name || '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{s?.department || r.staff_profiles?.department || '—'} · {s?.designation || r.staff_profiles?.designation || '—'}</p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: meta.color, backgroundColor: 'white', padding: '4px 10px', borderRadius: '999px', border: `1px solid ${meta.color}44` }}>
                  {meta.label}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#374151' }}>📅 Probation ends: <strong>{fmtDate(r.probation_end_date)}</strong></p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── 2. Document Checklist ─────────────────────────────────────────────────────
function DocumentChecklist({ staff, documents }) {
  const [selectedStaff, setSelectedStaff] = useState(staff[0]?.id || '')

  const checklist = useMemo(() => {
    const staffDocs = documents.filter(d => String(d.staff_id) === String(selectedStaff))
    const submittedTypes = staffDocs.map(d => d.document_type)
    return REQUIRED_DOCS.map(doc => ({
      doc,
      submitted: submittedTypes.includes(doc),
      record: staffDocs.find(d => d.document_type === doc),
    }))
  }, [selectedStaff, documents])

  const missing = checklist.filter(c => !c.submitted).length
  const s = staff.find(x => x.id === Number(selectedStaff))

  return (
    <Card>
      <SectionHeader
        icon="📋"
        title="Document Checklist"
        subtitle="Track required documents per employee"
        action={
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white', color: '#374151' }}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      />

      {s && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', flexShrink: 0 }}>
            {s.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{s.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{s.designation} · {s.department}</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: missing > 0 ? '#dc2626' : '#16a34a' }}>
              {missing > 0 ? `${missing} missing` : 'All complete ✅'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{checklist.filter(c => c.submitted).length}/{REQUIRED_DOCS.length} submitted</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', backgroundColor: missing === 0 ? '#16a34a' : '#f59e0b', width: `${(checklist.filter(c => c.submitted).length / REQUIRED_DOCS.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {checklist.map(({ doc, submitted, record }) => (
          <div key={doc} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', backgroundColor: submitted ? '#f0fdf4' : '#fff7ed', border: `1px solid ${submitted ? '#bbf7d0' : '#fed7aa'}` }}>
            <span style={{ fontSize: '18px' }}>{submitted ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{doc}</p>
              {submitted && record?.document_number && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>#{record.document_number}</p>}
            </div>
            <span style={{ fontSize: '12px', fontWeight: '600', color: submitted ? '#16a34a' : '#ea580c' }}>
              {submitted ? 'Submitted' : 'Missing'}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── 3. File Attachments ───────────────────────────────────────────────────────
function FileAttachments({ staff, onUploadComplete }) {
  const [selectedStaff, setSelectedStaff] = useState('')
  const [docType, setDocType] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [loadingAttach, setLoadingAttach] = useState(false)

  const fetchAttachments = useCallback(async () => {
    setLoadingAttach(true)
    const { data } = await supabase.from('hr_documents')
      .select('*, staff_profiles(name, department)')
      .order('created_at', { ascending: false })
    setAttachments(data || [])
    setLoadingAttach(false)
  }, [])

  useEffect(() => { fetchAttachments() }, [fetchAttachments])

  const handleUpload = async () => {
    if (!selectedStaff || !docType || !file) return alert('Please fill required fields and select a file.')
    setUploading(true)

    // Upload file to Supabase Storage
    const ext = file.name.split('.').pop()
    const path = `hr-docs/${selectedStaff}/${Date.now()}_${docType.replace(/\s/g, '_')}.${ext}`
    const { error: storageError } = await supabase.storage.from('hr-attachments').upload(path, file)

    if (storageError) { alert('Upload error: ' + storageError.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('hr-attachments').getPublicUrl(path)

    const { error: dbError } = await supabase.from('hr_documents').insert([{
      staff_id: Number(selectedStaff),
      document_type: docType,
      document_number: docNumber,
      expiry_date: expiryDate || null,
      file_path: path,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
    }])

    if (dbError) { alert('DB error: ' + dbError.message) }
    else {
      setFile(null); setDocType(''); setDocNumber(''); setExpiryDate(''); setSelectedStaff('')
      fetchAttachments()
      onUploadComplete?.()
    }
    setUploading(false)
  }

  const handleDelete = async (doc) => {
    if (!window.confirm('Delete this document?')) return
    await supabase.storage.from('hr-attachments').remove([doc.file_path])
    await supabase.from('hr_documents').delete().eq('id', doc.id)
    fetchAttachments()
  }

  const fmt = (bytes) => bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)}KB` : `${(bytes/1048576).toFixed(1)}MB`

  return (
    <Card>
      <SectionHeader icon="📎" title="File Attachments" subtitle="Upload and manage staff documents" />

      {/* Upload form */}
      <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '18px', marginBottom: '20px', border: '1px dashed #cbd5e1' }}>
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Upload New Document</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white' }}>
            <option value="">Select Staff *</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={docType} onChange={e => setDocType(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white' }}>
            <option value="">Doc Type *</option>
            {DOC_TYPES.map(d => <option key={d}>{d}</option>)}
          </select>
          <input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Doc number (optional)"
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
            title="Expiry date (optional)" />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            📁 {file ? file.name : 'Choose file (PDF, JPG, PNG)'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
          </label>
          <button onClick={handleUpload} disabled={uploading}
            style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: uploading ? '#94a3b8' : '#1e3a5f', color: 'white', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>
            {uploading ? '⏳ Uploading...' : '⬆️ Upload'}
          </button>
        </div>
      </div>

      {/* Attachments list */}
      {loadingAttach ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p> : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {attachments.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No documents uploaded yet</p>}
          {attachments.map(doc => {
            const days = daysUntil(doc.expiry_date)
            const exp = expiryColor(days)
            return (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '24px' }}>{doc.file_name?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{doc.staff_profiles?.name} — {doc.document_type}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>{doc.file_name} · {fmt(doc.file_size || 0)}</p>
                </div>
                {exp && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: exp.color, backgroundColor: exp.bg, padding: '4px 10px', borderRadius: '999px' }}>
                    {exp.label}
                  </span>
                )}
                {doc.expiry_date && !exp && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Exp: {fmtDate(doc.expiry_date)}</span>}
                <a href={doc.file_url} target="_blank" rel="noreferrer"
                  style={{ color: '#2563eb', fontSize: '12px', fontWeight: '600', textDecoration: 'none', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#eff6ff' }}>
                  👁 View
                </a>
                <button onClick={() => handleDelete(doc)}
                  style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600', border: 'none', backgroundColor: '#fee2e2', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── 4. Document Expiry Tracking ───────────────────────────────────────────────
function ExpiryTracker({ staff }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase.from('hr_documents')
        .select('*, staff_profiles(name, department, designation)')
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
      setDocs(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const days = daysUntil(d.expiry_date)
      if (filter === 'expired') return days !== null && days < 0
      if (filter === 'critical') return days !== null && days >= 0 && days <= 7
      if (filter === 'warning')  return days !== null && days > 7 && days <= 30
      return true
    })
  }, [docs, filter])

  const counts = useMemo(() => ({
    expired:  docs.filter(d => { const n = daysUntil(d.expiry_date); return n !== null && n < 0 }).length,
    critical: docs.filter(d => { const n = daysUntil(d.expiry_date); return n !== null && n >= 0 && n <= 7 }).length,
    warning:  docs.filter(d => { const n = daysUntil(d.expiry_date); return n !== null && n > 7 && n <= 30 }).length,
  }), [docs])

  return (
    <Card>
      <SectionHeader icon="📅" title="Document Expiry Tracker" subtitle="Monitor document validity and renewals" />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: `All (${docs.length})`,          bg: '#f1f5f9', color: '#374151' },
          { key: 'expired',  label: `Expired (${counts.expired})`,   bg: '#fee2e2', color: '#dc2626' },
          { key: 'critical', label: `Critical (${counts.critical})`, bg: '#fef3c7', color: '#d97706' },
          { key: 'warning',  label: `Warning (${counts.warning})`,   bg: '#fffbeb', color: '#ca8a04' },
        ].map(btn => (
          <button key={btn.key} onClick={() => setFilter(btn.key)}
            style={{ padding: '7px 14px', borderRadius: '999px', border: `1.5px solid ${filter === btn.key ? btn.color : 'transparent'}`, backgroundColor: filter === btn.key ? btn.bg : '#f8fafc', color: btn.color, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            {btn.label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Staff', 'Department', 'Document', 'Expiry Date', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '12px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => {
              const days = daysUntil(doc.expiry_date)
              const exp = expiryColor(days)
              return (
                <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>{doc.staff_profiles?.name}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{doc.staff_profiles?.department}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{doc.document_type}{doc.document_number ? ` — ${doc.document_number}` : ''}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{fmtDate(doc.expiry_date)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {exp
                      ? <span style={{ fontSize: '11px', fontWeight: '700', color: exp.color, backgroundColor: exp.bg, padding: '4px 10px', borderRadius: '999px' }}>{exp.label}</span>
                      : <span style={{ fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '999px', fontWeight: '700' }}>Valid</span>
                    }
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No documents match this filter</td></tr>
            )}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ── 5. Statutory Compliance ───────────────────────────────────────────────────
function StatutoryCompliance({ staff, records }) {
  const [selected, setSelected] = useState(staff[0]?.id || '')

  const staffRecord = useMemo(() => {
    return records.filter(r => r.staff_id === Number(selected)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
  }, [selected, records])

  const joinDate = staffRecord?.created_at
  const tenure = joinDate ? monthsSince(joinDate) : 0
  const s = staff.find(x => x.id === Number(selected))

  return (
    <Card>
      <SectionHeader
        icon="⚖️"
        title="Statutory Compliance"
        subtitle="PF, ESI, Gratuity & Bonus eligibility by tenure"
        action={
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white', color: '#374151' }}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      />

      {s && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px' }}>
            {s.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{s.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{s.designation} · {s.department}</p>
          </div>
          <div style={{ marginLeft: 'auto', padding: '8px 14px', backgroundColor: '#eff6ff', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>{tenure}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>months tenure</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {STATUTORY_RULES.map(rule => {
          const eligible = tenure >= rule.months
          return (
            <div key={rule.id} style={{ borderRadius: '10px', padding: '14px 16px', border: `1.5px solid ${eligible ? '#bbf7d0' : '#e2e8f0'}`, backgroundColor: eligible ? '#f0fdf4' : '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: eligible ? '#15803d' : '#374151' }}>{rule.label}</p>
                <span style={{ fontSize: '18px' }}>{eligible ? '✅' : '🔒'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{rule.desc}</p>
              {!eligible && rule.months > 0 && (
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>
                  {rule.months - tenure} more month{rule.months - tenure !== 1 ? 's' : ''} required
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── 6. Warning Letter Generator ───────────────────────────────────────────────
function WarningLetterGenerator({ staff, records }) {
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [preview, setPreview] = useState('')
  const [copied, setCopied] = useState(false)
  const [customSubject, setCustomSubject] = useState('')

  const s = staff.find(x => x.id === Number(selectedStaff))
  const r = records.filter(x => x.staff_id === Number(selectedStaff))[0]

  const generate = () => {
    if (!s || !selectedTemplate) return
    const tmpl = WARNING_TEMPLATES.find(t => t.id === selectedTemplate)
    if (!tmpl) return
    const dept = s.department || r?.staff_profiles?.department || 'your department'
    setPreview(tmpl.body(s.name, dept))
    setCustomSubject(`Warning Letter — ${tmpl.label} — ${s.name}`)
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`Subject: ${customSubject}\n\n${preview}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTxt = () => {
    const content = `Subject: ${customSubject}\n\nDate: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n${preview}`
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `warning_letter_${s?.name?.replace(/\s/g, '_')}_${selectedTemplate}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Card>
      <SectionHeader icon="📝" title="Warning Letter Generator" subtitle="Auto-draft professional warning letters from templates" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Select Staff</label>
          <select value={selectedStaff} onChange={e => { setSelectedStaff(e.target.value); setPreview('') }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white' }}>
            <option value="">Choose employee...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || 'Staff'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Warning Type</label>
          <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); setPreview('') }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white' }}>
            <option value="">Choose template...</option>
            {WARNING_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <button onClick={generate} disabled={!selectedStaff || !selectedTemplate}
        style={{ padding: '10px 24px', borderRadius: '8px', backgroundColor: selectedStaff && selectedTemplate ? '#1e3a5f' : '#94a3b8', color: 'white', border: 'none', cursor: selectedStaff && selectedTemplate ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '13px', marginBottom: preview ? '16px' : 0 }}>
        ✍️ Generate Letter
      </button>

      {preview && (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Subject</label>
            <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <textarea value={preview} onChange={e => setPreview(e.target.value)} rows={14}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '13px', lineHeight: '1.7', fontFamily: 'Georgia, serif', boxSizing: 'border-box', backgroundColor: '#fafaf8', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button onClick={copyToClipboard}
              style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: copied ? '#dcfce7' : '#eff6ff', color: copied ? '#16a34a' : '#2563eb', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
            </button>
            <button onClick={downloadTxt}
              style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              ⬇️ Download .txt
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Main HRDocuments Component ───────────────────────────────────────────────

function HRDocuments() {
  const [staff, setStaff]     = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('all')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const [{ data: staffData }, { data: hrData }] = await Promise.all([
        supabase.from('staff_profiles').select('id, name, department, designation').order('name'),
        supabase.from('hr_records').select('*, staff_profiles(name, department, designation)').eq('is_archived', false).order('created_at', { ascending: false }),
      ])
      setStaff(staffData || [])
      setRecords(hrData || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const sections = [
    { key: 'all',        label: '🗂 All' },
    { key: 'probation',  label: '⏳ Probation Alerts' },
    { key: 'checklist',  label: '📋 Doc Checklist' },
    { key: 'files',      label: '📎 File Attachments' },
    { key: 'expiry',     label: '📅 Expiry Tracker' },
    { key: 'statutory',  label: '⚖️ Statutory' },
    { key: 'warning',    label: '📝 Warning Letters' },
  ]

  const show = (key) => activeSection === 'all' || activeSection === key

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>⏳ Loading HR Documents module...</div>
  )

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>📂 HR Documents & Compliance</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Probation alerts, document checklists, file uploads, expiry tracking, statutory compliance & warning letters</p>
      </div>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px', padding: '6px', backgroundColor: '#f1f5f9', borderRadius: '12px', width: 'fit-content' }}>
        {sections.map(sec => (
          <button key={sec.key} onClick={() => setActiveSection(sec.key)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
              backgroundColor: activeSection === sec.key ? 'white' : 'transparent',
              color: activeSection === sec.key ? '#1e3a5f' : '#64748b',
              boxShadow: activeSection === sec.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {sec.label}
          </button>
        ))}
      </div>

      {show('probation') && <ProbationAlerts records={records} staff={staff} />}
      {show('checklist') && staff.length > 0 && <DocumentChecklist staff={staff} documents={records} />}
      {show('files')     && <FileAttachments staff={staff} onUploadComplete={() => {}} />}
      {show('expiry')    && <ExpiryTracker staff={staff} />}
      {show('statutory') && staff.length > 0 && <StatutoryCompliance staff={staff} records={records} />}
      {show('warning')   && staff.length > 0 && <WarningLetterGenerator staff={staff} records={records} />}
    </div>
  )
}

export default HRDocuments
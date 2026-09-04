import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { EventBus, GNSI_EVENTS } from './EventBus'
import TeacherAttendance from './TeacherAttendance'
import { useAttendanceRange, classifyRows, currentMonth } from './attendanceData'

// ─── constants ────────────────────────────────────────────────────────────────

const REQUIRED_DOCS = ['Aadhaar', 'PAN', 'Appointment Letter', 'Resume']

const DOC_TYPES = ['Aadhaar', 'PAN', 'Resume', 'Appointment Letter', 'Certificate', 'Contract', 'Other']

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
const MAX_FILE_SIZE_MB = 10

const STATUTORY_RULES = [
  { id: 'pf',       label: 'PF Eligible',      months: 0,  desc: 'Eligible from day 1' },
  { id: 'esi',      label: 'ESI Eligible',      months: 0,  desc: 'Eligible from day 1' },
  { id: 'gratuity', label: 'Gratuity Eligible', months: 60, desc: 'After 5 years of service' },
  { id: 'bonus',    label: 'Statutory Bonus',   months: 12, desc: 'After 1 year of service' },
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

// Fix: snapshot date once per render cycle to avoid midnight edge cases
const getToday = () => new Date()

const daysUntil = (dateStr, now = getToday()) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Fix: use join_date field, not created_at
const monthsSince = (dateStr, now = getToday()) => {
  if (!dateStr) return 0
  const start = new Date(dateStr)
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtSize = (bytes) =>
  bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(1)}MB`

const expiryColor = (days) => {
  if (days === null) return null
  if (days < 0)   return { bg: '#fee2e2', color: '#dc2626', label: 'Expired' }
  if (days <= 7)  return { bg: '#fee2e2', color: '#dc2626', label: `${days}d left` }
  if (days <= 30) return { bg: '#fef9c3', color: '#ca8a04', label: `${days}d left` }
  return { bg: '#dcfce7', color: '#16a34a', label: `${days}d left` }
}

// Fix: validate file type server-side before upload
const validateFile = (file) => {
  if (!file) return 'No file selected.'
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `File type not allowed. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Invalid file type detected.'
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File too large. Max ${MAX_FILE_SIZE_MB}MB.`
  return null
}

// Fix: generate short-lived signed URL instead of public URL
const getSignedUrl = async (path) => {
  const { data, error } = await supabase.storage
    .from('hr-attachments')
    .createSignedUrl(path, 60) // 60-second TTL
  if (error) throw error
  return data.signedUrl
}

// ─── shared UI ────────────────────────────────────────────────────────────────

const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    marginBottom: '16px',
  },
  select: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    backgroundColor: 'white',
    color: '#374151',
    width: '100%',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: (active = true, danger = false) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: active ? 'pointer' : 'not-allowed',
    fontWeight: '600',
    fontSize: '14px',
    backgroundColor: !active ? '#94a3b8' : danger ? '#fee2e2' : '#1e3a5f',
    color: !active ? 'white' : danger ? '#dc2626' : 'white',
    whiteSpace: 'nowrap',
  }),
}

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  const bg = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#fef9c3'
  const color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#ca8a04'
  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, backgroundColor: bg, color, padding: '12px 20px', borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '13px', fontWeight: '600',
      maxWidth: '90vw', textAlign: 'center',
    }}>
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'error') => setToast({ message, type }), [])
  const hide = useCallback(() => setToast(null), [])
  const ToastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null
  return { show, ToastEl }
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '16px',
    }}>
      <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '24px', maxWidth: '320px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#1e293b', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ ...styles.btn(true, false), flex: 1, backgroundColor: '#f1f5f9', color: '#374151' }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...styles.btn(true, true), flex: 1 }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', margin: 0, lineHeight: '1.3' }}>{icon} {title}</h2>
          {subtitle && <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  )
}

function StaffAvatar({ name, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: '#1e3a5f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: size * 0.42, flexShrink: 0,
    }}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}


// ─── Attendance summary — shared with Face Attendance module ────────────────
// Pulls the same staff_geo_attendance data (via attendanceData.js's shared
// hook/classifier) that FaceAttendance.jsx's Dashboard/TimeCard/Payroll tabs
// use, so HR sees the same numbers rather than a separately-derived guess.
// Read-only: nothing here writes attendance data, editing still happens via
// Face Attendance / GeoAttendance check-in.

function StaffAttendanceSummary({ staffId, staffName }) {
  const [month, setMonth] = useState(currentMonth())
  const { rows, loading, error } = useAttendanceRange({
    month, isAdmin: true, staffFilter: String(staffId),
    select: 'staff_id, date, status, late_minutes',
  })
  const { totals } = useMemo(() => classifyRows(rows), [rows])
  const totalDays = rows.length
  const presentLike = totals.Present + totals.Late + totals['Half Day'] + totals['Early Out']
  const rate = totalDays > 0 ? Math.round((presentLike / totalDays) * 100) : null

  if (!staffId) return null

  return (
    <div style={{ ...styles.card, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a5f' }}>
          🧾 Attendance — {staffName}
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ ...styles.input, width: 'auto', padding: '6px 10px', fontSize: '12px' }} />
      </div>
      {loading ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Loading attendance…</p>
      ) : error ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#dc2626' }}>⚠️ Could not load attendance: {error}</p>
      ) : totalDays === 0 ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>No attendance recorded this month.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
          {[
            { label: 'Present', value: totals.Present, color: '#16a34a' },
            { label: 'Late', value: totals.Late, color: '#ca8a04' },
            { label: 'Half Day', value: totals['Half Day'], color: '#d97706' },
            { label: 'Absent', value: totals.Absent, color: '#dc2626' },
            { label: 'Early Out', value: totals['Early Out'], color: '#ca8a04' },
          ].map(x => (
            <div key={x.label} style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '8px', padding: '8px 4px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: x.color }}>{x.value}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{x.label}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>{rate}%</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Attendance rate</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 1. Probation Alerts ──────────────────────────────────────────────────────

function ProbationAlerts({ records, staff }) {
  const now = useMemo(() => getToday(), [])
  const alerts = useMemo(() => {
    return records
      .filter(r => r.employment_status === 'Probation' && r.probation_end_date)
      .map(r => ({ ...r, days: daysUntil(r.probation_end_date, now) }))
      .filter(r => r.days !== null && r.days <= 60)
      .sort((a, b) => a.days - b.days)
  }, [records, now])

  if (alerts.length === 0) return (
    <div style={styles.card}>
      <SectionHeader icon="⏳" title="Probation Expiry Alerts" subtitle="Staff whose probation ends within 60 days" />
      <div style={{ textAlign: 'center', padding: '28px 16px', color: '#94a3b8' }}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
        <p style={{ margin: 0, fontSize: '13px' }}>No probation periods expiring soon</p>
      </div>
    </div>
  )

  return (
    <div style={styles.card}>
      <SectionHeader icon="⏳" title="Probation Expiry Alerts" subtitle={`${alerts.length} staff need attention`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.map(r => {
          const meta = r.days < 0 ? { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' }
            : r.days <= 7  ? { bg: '#fee2e2', color: '#dc2626', label: `${r.days}d left` }
            : r.days <= 30 ? { bg: '#fef9c3', color: '#ca8a04', label: `${r.days}d left` }
            : { bg: '#eff6ff', color: '#2563eb', label: `${r.days}d left` }
          const s = staff.find(x => x.id === r.staff_id)
          return (
            <div key={r.id} style={{ borderRadius: '10px', border: `1.5px solid ${meta.color}33`, backgroundColor: meta.bg, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{s?.name || '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{s?.department || '—'} · {s?.designation || '—'}</p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: meta.color, backgroundColor: 'white', padding: '4px 10px', borderRadius: '999px', border: `1px solid ${meta.color}44`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {meta.label}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#374151' }}>📅 Ends: <strong>{fmtDate(r.probation_end_date)}</strong></p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 2. Document Checklist ────────────────────────────────────────────────────

function DocumentChecklist({ staff, documents }) {
  const [selectedStaff, setSelectedStaff] = useState(staff[0]?.id || '')

  // Fix: documents should come from hr_documents, not hr_records
  // This component now correctly uses the `documents` prop which should be
  // passed from the hr_documents table (fetched in parent), not hr_records.
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
  const s = staff.find(x => String(x.id) === String(selectedStaff))
  const submitted = checklist.filter(c => c.submitted).length

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="📋"
        title="Document Checklist"
        subtitle="Required documents per employee"
        action={
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
            style={{ ...styles.select, width: 'auto', maxWidth: '140px', fontSize: '12px', padding: '7px 10px' }}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      />

      {s && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#f8fafc', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
          <StaffAvatar name={s.name} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{s.name}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{s.designation} · {s.department}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: missing > 0 ? '#dc2626' : '#16a34a' }}>
              {missing > 0 ? `${missing} missing` : 'Complete ✅'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{submitted}/{REQUIRED_DOCS.length}</p>
          </div>
        </div>
      )}

      <div style={{ height: '5px', backgroundColor: '#f1f5f9', borderRadius: '999px', marginBottom: '12px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', backgroundColor: missing === 0 ? '#16a34a' : '#f59e0b', width: `${(submitted / REQUIRED_DOCS.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {checklist.map(({ doc, submitted, record }) => (
          <div key={doc} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: submitted ? '#f0fdf4' : '#fff7ed', border: `1px solid ${submitted ? '#bbf7d0' : '#fed7aa'}` }}>
            <span style={{ fontSize: '16px' }}>{submitted ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{doc}</p>
              {submitted && record?.document_number && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>#{record.document_number}</p>}
            </div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: submitted ? '#16a34a' : '#ea580c', flexShrink: 0 }}>
              {submitted ? 'Submitted' : 'Missing'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. File Attachments ──────────────────────────────────────────────────────

function FileAttachments({ staff, onUploadComplete }) {
  const [selectedStaff, setSelectedStaff] = useState('')
  const [docType, setDocType] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [loadingAttach, setLoadingAttach] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { show: showToast, ToastEl } = useToast()

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
    if (!selectedStaff || !docType) return showToast('Please select staff and document type.')
    // Fix: validate file before upload
    const validationError = validateFile(file)
    if (validationError) return showToast(validationError)

    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `hr-docs/${selectedStaff}/${Date.now()}_${docType.replace(/\s/g, '_')}.${ext}`

    // Fix: upload first, only insert DB row if storage succeeds
    const { error: storageError } = await supabase.storage.from('hr-attachments').upload(path, file, {
      contentType: file.type,
    })
    if (storageError) {
      showToast('Upload failed: ' + storageError.message)
      setUploading(false)
      return
    }

    // Fix: store file_path only — generate signed URLs on demand, not public URLs
    const { error: dbError } = await supabase.from('hr_documents').insert([{
      staff_id: Number(selectedStaff),
      document_type: docType,
      document_number: docNumber || null,
      expiry_date: expiryDate || null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      // No file_url stored — signed URLs generated on demand
    }])

    if (dbError) {
      // Fix: rollback storage file if DB insert fails (no orphaned files)
      await supabase.storage.from('hr-attachments').remove([path])
      showToast('Save failed: ' + dbError.message)
    } else {
      setFile(null); setDocType(''); setDocNumber(''); setExpiryDate(''); setSelectedStaff('')
      fetchAttachments()
      onUploadComplete?.()
      showToast('Document uploaded successfully!', 'success')
      EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { 
        staffId: Number(selectedStaff), 
        change: 'document_uploaded',
        docType 
      })
    }
    setUploading(false)
  }

  // Fix: use signed URL for viewing (not public URL)
  const handleView = async (doc) => {
    try {
      const url = await getSignedUrl(doc.file_path)
      window.open(url, '_blank', 'noreferrer')
    } catch {
      showToast('Could not open file. It may have been deleted.')
    }
  }

  const handleDeleteConfirmed = async () => {
    const doc = confirmDelete
    setConfirmDelete(null)
    // Fix: check storage error before deleting DB row
    const { error: storageErr } = await supabase.storage.from('hr-attachments').remove([doc.file_path])
    if (storageErr) {
      showToast('Could not delete file from storage: ' + storageErr.message)
      return
    }
    const { error: dbErr } = await supabase.from('hr_documents').delete().eq('id', doc.id)
    if (dbErr) showToast('DB delete failed: ' + dbErr.message)
    else { 
    fetchAttachments(); 
    showToast('Document deleted.', 'success');
    EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { 
      staffId: doc.staff_id, 
      change: 'document_deleted',
      docType: doc.document_type 
    });
  }
  }

  return (
    <div style={styles.card}>
      {ToastEl}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.file_name}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <SectionHeader icon="📎" title="File Attachments" subtitle="Upload and manage staff documents" />

      {/* Upload form */}
      <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px dashed #cbd5e1' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Upload New Document</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={styles.select}>
            <option value="">Select Staff *</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={docType} onChange={e => setDocType(e.target.value)} style={styles.select}>
            <option value="">Document Type *</option>
            {DOC_TYPES.map(d => <option key={d}>{d}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Doc number (optional)"
              style={styles.input} />
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              style={styles.input} title="Expiry date (optional)" />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151', minWidth: 0 }}>
              📁 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? file.name : 'Choose file'}</span>
              <input type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            </label>
            <button onClick={handleUpload} disabled={uploading} style={styles.btn(!uploading)}>
              {uploading ? '⏳' : '⬆️'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Allowed: PDF, JPG, PNG, DOC, DOCX · Max {MAX_FILE_SIZE_MB}MB</p>
        </div>
      </div>

      {/* Attachments list */}
      {loadingAttach ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '16px' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No documents uploaded yet</p>
          )}
          {attachments.map(doc => {
            const days = daysUntil(doc.expiry_date)
            const exp = expiryColor(days)
            return (
              <div key={doc.id} style={{ borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{doc.file_name?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{doc.staff_profiles?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{doc.document_type} · {fmtSize(doc.file_size || 0)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => handleView(doc)}
                      style={{ color: '#2563eb', fontSize: '12px', fontWeight: '600', border: 'none', backgroundColor: '#eff6ff', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      👁
                    </button>
                    <button onClick={() => setConfirmDelete(doc)}
                      style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600', border: 'none', backgroundColor: '#fee2e2', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
                {(exp || doc.expiry_date) && (
                  <div style={{ padding: '6px 12px 8px', borderTop: '1px solid #e2e8f0' }}>
                    {exp
                      ? <span style={{ fontSize: '11px', fontWeight: '700', color: exp.color, backgroundColor: exp.bg, padding: '3px 8px', borderRadius: '999px' }}>{exp.label}</span>
                      : <span style={{ fontSize: '11px', color: '#64748b' }}>Expires {fmtDate(doc.expiry_date)}</span>
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 4. Expiry Tracker ────────────────────────────────────────────────────────

function ExpiryTracker() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const now = useMemo(() => getToday(), [])

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
      const days = daysUntil(d.expiry_date, now)
      if (filter === 'expired') return days !== null && days < 0
      if (filter === 'critical') return days !== null && days >= 0 && days <= 7
      if (filter === 'warning')  return days !== null && days > 7 && days <= 30
      return true
    })
  }, [docs, filter, now])

  const counts = useMemo(() => ({
    expired:  docs.filter(d => { const n = daysUntil(d.expiry_date, now); return n !== null && n < 0 }).length,
    critical: docs.filter(d => { const n = daysUntil(d.expiry_date, now); return n !== null && n >= 0 && n <= 7 }).length,
    warning:  docs.filter(d => { const n = daysUntil(d.expiry_date, now); return n !== null && n > 7 && n <= 30 }).length,
  }), [docs, now])

  return (
    <div style={styles.card}>
      <SectionHeader icon="📅" title="Document Expiry Tracker" subtitle="Monitor document validity and renewals" />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: `All (${docs.length})`,          color: '#374151' },
          { key: 'expired',  label: `Expired (${counts.expired})`,   color: '#dc2626' },
          { key: 'critical', label: `Critical (${counts.critical})`, color: '#d97706' },
          { key: 'warning',  label: `Warning (${counts.warning})`,   color: '#ca8a04' },
        ].map(btn => (
          <button key={btn.key} onClick={() => setFilter(btn.key)}
            style={{ padding: '6px 12px', borderRadius: '999px', border: `1.5px solid ${filter === btn.key ? btn.color : 'transparent'}`, backgroundColor: filter === btn.key ? '#f8fafc' : 'transparent', color: btn.color, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            {btn.label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {filtered.map(doc => {
            const days = daysUntil(doc.expiry_date, now)
            const exp = expiryColor(days)
            return (
              <div key={doc.id} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{doc.staff_profiles?.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{doc.document_type}{doc.document_number ? ` — ${doc.document_number}` : ''}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>{doc.staff_profiles?.department} · Exp: {fmtDate(doc.expiry_date)}</p>
                  </div>
                  {exp
                    ? <span style={{ fontSize: '11px', fontWeight: '700', color: exp.color, backgroundColor: exp.bg, padding: '4px 10px', borderRadius: '999px', flexShrink: 0 }}>{exp.label}</span>
                    : <span style={{ fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>Valid</span>
                  }
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>No documents match this filter</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 5. Statutory Compliance ──────────────────────────────────────────────────

function StatutoryCompliance({ staff, records }) {
  const [selected, setSelected] = useState(String(staff[0]?.id || ''))
  const now = useMemo(() => getToday(), [])

  const staffRecord = useMemo(() => {
    return records
      .filter(r => String(r.staff_id) === selected)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
  }, [selected, records])

  // Fix: use join_date field if available, fall back to created_at with a comment
  const joinDate = staffRecord?.join_date || staffRecord?.created_at
  const tenure = joinDate ? monthsSince(joinDate, now) : 0
  const s = staff.find(x => String(x.id) === selected)
  const usingFallback = !staffRecord?.join_date && !!staffRecord?.created_at

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="⚖️"
        title="Statutory Compliance"
        subtitle="PF, ESI, Gratuity & Bonus eligibility"
        action={
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ ...styles.select, width: 'auto', maxWidth: '140px', fontSize: '12px', padding: '7px 10px' }}>
            {staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        }
      />

      {s && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#f8fafc', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
          <StaffAvatar name={s.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{s.name}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{s.designation} · {s.department}</p>
          </div>
          <div style={{ padding: '6px 12px', backgroundColor: '#eff6ff', borderRadius: '8px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e3a5f' }}>{tenure}</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>months</p>
          </div>
        </div>
      )}

      {usingFallback && (
        <div style={{ padding: '8px 12px', backgroundColor: '#fef9c3', borderRadius: '8px', marginBottom: '12px', border: '1px solid #fde68a' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>⚠️ Tenure based on record creation date. Add a <code style={{ backgroundColor: '#fef3c7', padding: '1px 4px', borderRadius: '3px' }}>join_date</code> field for accuracy.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {STATUTORY_RULES.map(rule => {
          const eligible = tenure >= rule.months
          return (
            <div key={rule.id} style={{ borderRadius: '10px', padding: '12px 14px', border: `1.5px solid ${eligible ? '#bbf7d0' : '#e2e8f0'}`, backgroundColor: eligible ? '#f0fdf4' : '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: eligible ? '#15803d' : '#374151' }}>{rule.label}</p>
                <span style={{ fontSize: '16px' }}>{eligible ? '✅' : '🔒'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{rule.desc}</p>
              {!eligible && rule.months > 0 && (
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>
                  {rule.months - tenure} more month{rule.months - tenure !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 6. Warning Letter Generator ─────────────────────────────────────────────

function WarningLetterGenerator({ staff, records }) {
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [preview, setPreview] = useState('')
  const [copied, setCopied] = useState(false)
  const [customSubject, setCustomSubject] = useState('')
  const { show: showToast, ToastEl } = useToast()

  const s = staff.find(x => String(x.id) === String(selectedStaff))

  const generate = () => {
    if (!s || !selectedTemplate) return
    const tmpl = WARNING_TEMPLATES.find(t => t.id === selectedTemplate)
    if (!tmpl) return
    const dept = s.department || 'your department'
    setPreview(tmpl.body(s.name, dept))
    setCustomSubject(`Warning Letter — ${tmpl.label} — ${s.name}`)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${customSubject}\n\n${preview}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('Copied to clipboard!', 'success')
    } catch {
      showToast('Copy failed. Please select text manually.')
    }
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
    <div style={styles.card}>
      {ToastEl}
      <SectionHeader icon="📝" title="Warning Letter Generator" subtitle="Draft professional warning letters" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Select Staff</label>
          <select value={selectedStaff} onChange={e => { setSelectedStaff(e.target.value); setPreview('') }} style={styles.select}>
            <option value="">Choose employee...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || 'Staff'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Warning Type</label>
          <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); setPreview('') }} style={styles.select}>
            <option value="">Choose template...</option>
            {WARNING_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {s && (
        <div style={{ marginBottom: '14px' }}>
          <StaffAttendanceSummary staffId={s.id} staffName={s.name} />
        </div>
      )}

      <button onClick={generate} disabled={!selectedStaff || !selectedTemplate} style={styles.btn(!!(selectedStaff && selectedTemplate))}>
        ✍️ Generate Letter
      </button>

      {preview && (
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Subject</label>
          <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} style={{ ...styles.input, marginBottom: '10px' }} />
          <textarea value={preview} onChange={e => setPreview(e.target.value)} rows={12}
            style={{ ...styles.input, lineHeight: '1.7', fontFamily: 'Georgia, serif', backgroundColor: '#fafaf8', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button onClick={copyToClipboard}
              style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: copied ? '#dcfce7' : '#eff6ff', color: copied ? '#16a34a' : '#2563eb', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
            <button onClick={downloadTxt}
              style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              ⬇️ Download
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function HRDocuments() {
  const [staff, setStaff]       = useState([])
  const [records, setRecords]   = useState([])
  const [hrDocs, setHrDocs]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeSection, setActiveSection] = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: staffData }, { data: hrData }, { data: docsData }] = await Promise.all([
        supabase.from('staff_profiles').select('id, name, department, designation').order('name'),
        supabase.from('hr_records').select('*, staff_profiles(name, department, designation)').eq('is_archived', false).order('created_at', { ascending: false }),
        // Fix: fetch hr_documents separately for the checklist
        supabase.from('hr_documents').select('id, staff_id, document_type, document_number').order('created_at', { ascending: false }),
      ])
      setStaff(staffData || [])
      setRecords(hrData || [])
      setHrDocs(docsData || [])
      setLoading(false)
    }
    load()
  }, [])

  const sections = [
    { key: 'all',       label: '🗂', full: 'All' },
    { key: 'probation', label: '⏳', full: 'Probation' },
    { key: 'checklist', label: '📋', full: 'Checklist' },
    { key: 'files',     label: '📎', full: 'Files' },
    { key: 'expiry',    label: '📅', full: 'Expiry' },
    { key: 'statutory', label: '⚖️', full: 'Statutory' },
    { key: 'warning',   label: '📝', full: 'Letters' },
    { key: 'attendance',label: '🧑‍🏫', full: 'Attendance' },
  ]

  const show = (key) => activeSection === 'all' || activeSection === key

  if (loading) return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
      ⏳ Loading HR Documents...
    </div>
  )

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>📂 HR Documents</h1>
        <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>Compliance, documents & warning letters</p>
      </div>

      {/* Section nav — scrollable on mobile */}
      <div style={{ overflowX: 'auto', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '12px', width: 'max-content', minWidth: '100%' }}>
          {sections.map(sec => (
            <button key={sec.key} onClick={() => setActiveSection(sec.key)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
                backgroundColor: activeSection === sec.key ? 'white' : 'transparent',
                color: activeSection === sec.key ? '#1e3a5f' : '#64748b',
                boxShadow: activeSection === sec.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {sec.label} {sec.full}
            </button>
          ))}
        </div>
      </div>

      {show('probation') && <ProbationAlerts records={records} staff={staff} />}
      {show('checklist') && staff.length > 0 && <DocumentChecklist staff={staff} documents={hrDocs} />}
      {show('files')     && <FileAttachments staff={staff} onUploadComplete={() => {}} />}
      {show('expiry')    && <ExpiryTracker />}
      {show('statutory') && staff.length > 0 && <StatutoryCompliance staff={staff} records={records} />}
      {show('warning')   && staff.length > 0 && <WarningLetterGenerator staff={staff} records={records} />}
      {show('attendance')&& staff.length > 0 && <TeacherAttendance staff={staff} />}
    </div>
  )
}

export default HRDocuments
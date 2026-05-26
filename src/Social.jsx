import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'

const tabs = ['Daily', 'Enquiries', 'Applications', 'Entrance', 'New Comers']

// ─── Default Form States ─────────────────────────────────────────────────────

const enquiryDefault = {
  student_name: '',
  parent_name: '',
  phone: '',
  email: '',
  class_interest: '',
  batch_preference: '',
  source: 'Walk-in',
  status: 'New',
  enquiry_date: new Date().toISOString().split('T')[0],
  follow_up_date: '',
  remarks: '',
}

const applicationDefault = {
  student_name: '',
  parent_name: '',
  phone: '',
  email: '',
  dob: '',
  address: '',
  previous_school: '',
  percentage_marks: '',
  applied_batch: '',
  application_date: new Date().toISOString().split('T')[0],
  status: 'Submitted',
  documents_uploaded: false,
  remarks: '',
}

const examDefault = {
  exam_name: '',
  batch: '',
  exam_date: '',
  total_marks: '100',
  status: 'Scheduled',
  remarks: '',
}

const resultDefault = {
  exam_id: '',
  student_name: '',
  application_id: '',
  marks_obtained: '',
  status: 'Pending',
}

const newComerDefault = {
  student_name: '',
  parent_name: '',
  phone: '',
  email: '',
  batch: '',
  entrance_score: '',
  application_ref: '',
  fee_status: 'Pending',
  documents_verified: 'Pending',
  joining_date: '',
  remarks: '',
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '18px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  fontSize: '13px',
  color: '#475569',
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle = {
  padding: '12px',
  color: '#334155',
}

const deleteBtnStyle = {
  background: '#fee2e2',
  color: '#dc2626',
  border: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600',
}

const saveBtnStyle = {
  marginTop: '16px',
  background: '#1e3a5f',
  color: '#fff',
  padding: '10px 18px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
}

const badgeStyle = (type) => {
  const map = {
    red: { background: '#fee2e2', color: '#dc2626' },
    amber: { background: '#fef3c7', color: '#d97706' },
    blue: { background: '#dbeafe', color: '#2563eb' },
    green: { background: '#d1fae5', color: '#065f46' },
    purple: { background: '#ede9fe', color: '#7c3aed' },
    gray: { background: '#f1f5f9', color: '#475569' },
  }
  return {
    ...map[type] || map.gray,
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-block',
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const formatDate = () => {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const todayStr = () => new Date().toISOString().split('T')[0]

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'

const avatarColor = (urgency) => {
  if (urgency === 'overdue') return { background: '#fee2e2', color: '#dc2626' }
  if (urgency === 'today') return { background: '#fef3c7', color: '#d97706' }
  return { background: '#dbeafe', color: '#2563eb' }
}

const overdueDays = (dateStr) => Math.floor((new Date(todayStr()) - new Date(dateStr)) / 86400000)

// ─── Daily Dashboard ───────────────────────────────────────────────────────────

function DailyDashboard({ enquiries, applications, exams, results, newComers, fetchAllData }) {
  const [dailyTab, setDailyTab] = useState('followups')
  const [quickEnquiry, setQuickEnquiry] = useState('')
  const [quickNote, setQuickNote] = useState('')
  const [quickStatus, setQuickStatus] = useState('Contacted')
  const [savingNote, setSavingNote] = useState(false)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState({ student_name: '', phone: '', class_interest: '', batch_preference: '', source: 'Walk-in' })
  const [savingWalkIn, setSavingWalkIn] = useState(false)

  const today = todayStr()

  const overdue = useMemo(() => enquiries.filter(e => e.follow_up_date && e.follow_up_date < today && !['Converted to App', 'Closed'].includes(e.status)), [enquiries, today])
  const dueToday = useMemo(() => enquiries.filter(e => e.follow_up_date === today && !['Converted to App', 'Closed'].includes(e.status)), [enquiries, today])
  const upcoming = useMemo(() => enquiries.filter(e => e.follow_up_date > today && !['Converted to App', 'Closed'].includes(e.status)).slice(0, 5), [enquiries, today])
  const newEnquiries = useMemo(() => enquiries.filter(e => e.enquiry_date === today), [enquiries, today])
  const todayExams = useMemo(() => exams.filter(e => e.exam_date === today), [exams, today])
  const pendingFees = useMemo(() => newComers.filter(n => n.fee_status !== 'Paid'), [newComers])
  const pendingDocs = useMemo(() => newComers.filter(n => n.documents_verified !== 'Verified'), [newComers])

  const stats = {
    overdue: overdue.length,
    today: dueToday.length,
    newEnq: newEnquiries.length,
    examsToday: todayExams.length,
    pendingApps: applications.filter(a => a.status === 'Submitted').length,
    pendingFees: pendingFees.length,
  }

  const handleQuickLog = async () => {
    if (!quickEnquiry || !quickNote.trim()) return
    setSavingNote(true)
    const enq = enquiries.find(e => e.id === quickEnquiry)
    if (!enq) { setSavingNote(false); return }
    const updatedRemarks = `${enq.remarks || ''}\n[${new Date().toLocaleString('en-IN')}] ${quickNote.trim()}`
    const { error } = await supabase.from('enquiries').update({ remarks: updatedRemarks.trim(), status: quickStatus }).eq('id', quickEnquiry)
    if (error) alert(error.message)
    else { setQuickNote(''); fetchAllData() }
    setSavingNote(false)
  }

  const handleWalkIn = async (e) => {
    e.preventDefault()
    if (!walkInForm.student_name.trim()) return
    setSavingWalkIn(true)
    const payload = { ...walkInForm, enquiry_date: today, status: 'New', remarks: 'Walk-in enquiry' }
    const { error } = await supabase.from('enquiries').insert([payload])
    if (error) alert(error.message)
    else { setWalkInOpen(false); setWalkInForm({ student_name: '', phone: '', class_interest: '', batch_preference: '', source: 'Walk-in' }); fetchAllData() }
    setSavingWalkIn(false)
  }

  const dailyTabBtn = (key, label) => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: dailyTab === key ? 'none' : '1px solid #e2e8f0',
    background: dailyTab === key ? '#1e3a5f' : 'transparent',
    color: dailyTab === key ? '#fff' : '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  })

  const EnquiryRow = ({ enq, urgency }) => (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      borderLeft: urgency === 'overdue' ? '3px solid #dc2626' : urgency === 'today' ? '3px solid #d97706' : '3px solid #e2e8f0',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, ...avatarColor(urgency) }}>
        {initials(enq.student_name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{enq.student_name}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{enq.batch_preference || '—'}</span>
          <span>·</span>
          <span>{enq.source}</span>
          <span>·</span>
          {urgency === 'overdue' && <span style={badgeStyle('red')}>Overdue {overdueDays(enq.follow_up_date)}d</span>}
          {urgency === 'today' && <span style={badgeStyle('amber')}>Due today</span>}
          {urgency === 'upcoming' && <span style={badgeStyle('gray')}>Upcoming</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {enq.phone && <a href={`tel:${enq.phone}`} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bbf7d0', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13, color: '#16a34a' }} title="Call">📞</a>}
        {enq.phone && <a href={`https://wa.me/91${enq.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13, color: '#2563eb' }} title="WhatsApp">💬</a>}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, color: '#1e3a5f', fontWeight: 700 }}>{greeting()} 👋</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{formatDate()} — Pre-admission daily briefing</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Overdue', val: stats.overdue, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Due today', val: stats.today, color: '#d97706', bg: '#fef3c7' },
          { label: 'New enquiries', val: stats.newEnq, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Exams today', val: stats.examsToday, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Pending apps', val: stats.pendingApps, color: '#0f766e', bg: '#ccfbf1' },
          { label: 'Fee pending', val: stats.pendingFees, color: '#c2410c', bg: '#ffedd5' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: '14px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['followups', '📞 Follow-ups'], ['exams', '📝 Exams today'], ['apps', '📄 Applications'], ['alerts', '🔔 Alerts'], ['score', '📊 Scorecard']].map(([key, label]) => (
          <button key={key} style={dailyTabBtn(key, label)} onClick={() => setDailyTab(key)}>{label}</button>
        ))}
      </div>

      {/* Follow-ups */}
      {dailyTab === 'followups' && (
        <div>
          {overdue.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>🔴 Overdue ({overdue.length})</div><div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>{overdue.map(e => <EnquiryRow key={e.id} enq={e} urgency="overdue" />)}</div></div>}
          {dueToday.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>🟡 Due today ({dueToday.length})</div><div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>{dueToday.map(e => <EnquiryRow key={e.id} enq={e} urgency="today" />)}</div></div>}
          {upcoming.length > 0 && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>🔵 Upcoming ({upcoming.length})</div><div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>{upcoming.map(e => <EnquiryRow key={e.id} enq={e} urgency="upcoming" />)}</div></div>}
          {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', padding: 32 }}>✅ No follow-ups scheduled. You're all caught up!</div>}

          <button onClick={() => setWalkInOpen(v => !v)} style={{ width: '100%', marginTop: 4, padding: '14px', borderRadius: '10px', border: '2px dashed #cbd5e1', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            👤 {walkInOpen ? 'Close walk-in form' : 'Log a walk-in enquiry'}
          </button>

          {walkInOpen && (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <h3 style={{ marginBottom: 14, color: '#1e3a5f', fontSize: 15 }}>Quick Walk-in Capture</h3>
              <form onSubmit={handleWalkIn}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Student Name *</label><input style={inputStyle} required value={walkInForm.student_name} onChange={e => setWalkInForm({ ...walkInForm, student_name: e.target.value })} /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={walkInForm.phone} onChange={e => setWalkInForm({ ...walkInForm, phone: e.target.value })} /></div>
                  <div><label style={labelStyle}>Class interest</label><input style={inputStyle} value={walkInForm.class_interest} onChange={e => setWalkInForm({ ...walkInForm, class_interest: e.target.value })} /></div>
                  <div><label style={labelStyle}>Batch preference</label><input style={inputStyle} value={walkInForm.batch_preference} onChange={e => setWalkInForm({ ...walkInForm, batch_preference: e.target.value })} /></div>
                  <div><label style={labelStyle}>Source</label>
                    <select style={inputStyle} value={walkInForm.source} onChange={e => setWalkInForm({ ...walkInForm, source: e.target.value })}>
                      <option>Walk-in</option><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>Google</option><option>Referral</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={savingWalkIn} style={{ ...saveBtnStyle, marginTop: 12 }}>{savingWalkIn ? 'Saving...' : '⚡ Save walk-in'}</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Exams today */}
      {dailyTab === 'exams' && (
        <div>
          {todayExams.length === 0 ? <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No entrance exams scheduled for today.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {todayExams.map(ex => (
                <div key={ex.id} style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{ex.exam_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Batch: {ex.batch} · Total marks: {ex.total_marks}</div>
                  <div style={{ marginTop: 8 }}><span style={badgeStyle(ex.status === 'Scheduled' ? 'purple' : 'green')}>{ex.status}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applications */}
      {dailyTab === 'apps' && (
        <div>
          {applications.filter(a => a.application_date === today).length === 0 ? <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No new applications submitted today.</div> : (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {applications.filter(a => a.application_date === today).map(a => (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{initials(a.student_name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.student_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{a.applied_batch} · {a.previous_school || '—'}</div>
                  </div>
                  <span style={badgeStyle(a.status === 'Submitted' ? 'blue' : a.status === 'Accepted' ? 'green' : a.status === 'Rejected' ? 'red' : 'amber')}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {dailyTab === 'alerts' && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {overdue.map(e => (
            <div key={e.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🔴</div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}><strong>{e.student_name}</strong> — follow-up overdue by {overdueDays(e.follow_up_date)} day(s). Batch: {e.batch_preference || '—'}</div>
            </div>
          ))}
          {pendingDocs.slice(0, 5).map(n => (
            <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📄</div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}><strong>Pending docs:</strong> {n.student_name} ({n.batch}) — documents not yet verified.</div>
            </div>
          ))}
          {pendingFees.slice(0, 5).map(n => (
            <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>💰</div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}><strong>Fee pending:</strong> {n.student_name} ({n.batch}) — status: {n.fee_status}.</div>
            </div>
          ))}
          {todayExams.map(ex => (
            <div key={ex.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📝</div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}><strong>Exam today:</strong> {ex.exam_name} for batch {ex.batch}.</div>
            </div>
          ))}
          {overdue.length === 0 && pendingDocs.length === 0 && pendingFees.length === 0 && todayExams.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>✅ No alerts right now. Everything is on track!</div>}
        </div>
      )}

      {/* Scorecard */}
      {dailyTab === 'score' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total enquiries', val: enquiries.length, color: '#2563eb' },
              { label: 'Applications', val: applications.length, color: '#0f766e' },
              { label: 'Exams conducted', val: exams.filter(e => e.status === 'Completed').length, color: '#7c3aed' },
              { label: 'New comers', val: newComers.length, color: '#059669' },
            ].map(s => (
              <div key={s.label} style={{ ...cardStyle, padding: '16px' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${Math.min(100, enquiries.length > 0 ? (s.val / Math.max(enquiries.length, 1)) * 100 : 0)}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>Enquiry status breakdown</div>
            {['New', 'Contacted', 'Follow Up', 'Converted to App', 'Closed'].map(status => {
              const count = enquiries.filter(e => e.status === status).length
              const pct = enquiries.length > 0 ? Math.round((count / enquiries.length) * 100) : 0
              const colors = { New: '#2563eb', Contacted: '#7c3aed', 'Follow Up': '#d97706', 'Converted to App': '#059669', Closed: '#64748b' }
              return (
                <div key={status} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{status}</span><span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: colors[status], width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick note */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>⚡ Quick note on enquiry</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...inputStyle, maxWidth: 180 }} value={quickEnquiry} onChange={e => setQuickEnquiry(e.target.value)}>
            <option value="">Select enquiry…</option>
            {enquiries.map(e => <option key={e.id} value={e.id}>{e.student_name}</option>)}
          </select>
          <select style={{ ...inputStyle, maxWidth: 150 }} value={quickStatus} onChange={e => setQuickStatus(e.target.value)}>
            <option>New</option><option>Contacted</option><option>Follow Up</option><option>Converted to App</option><option>Closed</option>
          </select>
          <input style={{ ...inputStyle, flex: 1, minWidth: 180 }} placeholder="Add a note…" value={quickNote} onChange={e => setQuickNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuickLog()} />
          <button disabled={savingNote || !quickEnquiry || !quickNote.trim()} onClick={handleQuickLog} style={{ ...saveBtnStyle, marginTop: 0, opacity: (!quickEnquiry || !quickNote.trim()) ? 0.5 : 1 }}>
            {savingNote ? 'Saving…' : 'Log note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PreAdmissionPlatform() {
  const [activeTab, setActiveTab] = useState('Daily')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('All')

  const [enquiries, setEnquiries] = useState([])
  const [applications, setApplications] = useState([])
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [newComers, setNewComers] = useState([])

  const [enquiryForm, setEnquiryForm] = useState(enquiryDefault)
  const [applicationForm, setApplicationForm] = useState(applicationDefault)
  const [examForm, setExamForm] = useState(examDefault)
  const [resultForm, setResultForm] = useState(resultDefault)
  const [newComerForm, setNewComerForm] = useState(newComerDefault)

  const [selectedExamForResults, setSelectedExamForResults] = useState('')

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    const [enqRes, appRes, examRes, resRes, ncRes] = await Promise.all([
      supabase.from('enquiries').select('*').order('created_at', { ascending: false }),
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      supabase.from('entrance_exams').select('*').order('exam_date', { ascending: true }),
      supabase.from('entrance_results').select('*').order('created_at', { ascending: false }),
      supabase.from('new_comers').select('*').order('created_at', { ascending: false }),
    ])
    if (!enqRes.error) setEnquiries(enqRes.data || [])
    if (!appRes.error) setApplications(appRes.data || [])
    if (!examRes.error) setExams(examRes.data || [])
    if (!resRes.error) setResults(resRes.data || [])
    if (!ncRes.error) setNewComers(ncRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAllData() }, [fetchAllData])

  const handleInsert = async (table, payload, resetForm) => {
    setSaving(true)
    const { error } = await supabase.from(table).insert([payload])
    if (error) alert(error.message)
    else { resetForm(); fetchAllData() }
    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm('Delete this record?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert(error.message)
    else fetchAllData()
  }

  const handleResultInsert = async (e) => {
    e.preventDefault()
    if (!resultForm.exam_id || !resultForm.student_name.trim() || !resultForm.marks_obtained) return
    setSaving(true)
    const payload = { ...resultForm, marks_obtained: Number(resultForm.marks_obtained) }
    const { error } = await supabase.from('entrance_results').insert([payload])
    if (error) alert(error.message)
    else { setResultForm({ ...resultDefault, exam_id: resultForm.exam_id }); fetchAllData() }
    setSaving(false)
  }

  const allBatches = useMemo(() => {
    const set = new Set()
    enquiries.forEach(e => e.batch_preference && set.add(e.batch_preference))
    applications.forEach(a => a.applied_batch && set.add(a.applied_batch))
    exams.forEach(ex => ex.batch && set.add(ex.batch))
    newComers.forEach(n => n.batch && set.add(n.batch))
    return Array.from(set).sort()
  }, [enquiries, applications, exams, newComers])

  const filteredEnquiries = useMemo(() => {
    const q = search.toLowerCase()
    return enquiries.filter(e => {
      const matchesBatch = batchFilter === 'All' || e.batch_preference === batchFilter
      const matchesSearch = (e.student_name || '').toLowerCase().includes(q) || (e.phone || '').toLowerCase().includes(q) || (e.source || '').toLowerCase().includes(q)
      return matchesBatch && matchesSearch
    })
  }, [enquiries, search, batchFilter])

  const filteredApplications = useMemo(() => {
    const q = search.toLowerCase()
    return applications.filter(a => {
      const matchesBatch = batchFilter === 'All' || a.applied_batch === batchFilter
      const matchesSearch = (a.student_name || '').toLowerCase().includes(q) || (a.phone || '').toLowerCase().includes(q) || (a.status || '').toLowerCase().includes(q)
      return matchesBatch && matchesSearch
    })
  }, [applications, search, batchFilter])

  const filteredNewComers = useMemo(() => {
    const q = search.toLowerCase()
    return newComers.filter(n => {
      const matchesBatch = batchFilter === 'All' || n.batch === batchFilter
      const matchesSearch = (n.student_name || '').toLowerCase().includes(q) || (n.phone || '').toLowerCase().includes(q)
      return matchesBatch && matchesSearch
    })
  }, [newComers, search, batchFilter])

  const meritList = useMemo(() => {
    if (!selectedExamForResults) return []
    const exam = exams.find(e => e.id === selectedExamForResults)
    if (!exam) return []
    const list = results.filter(r => r.exam_id === selectedExamForResults).sort((a, b) => b.marks_obtained - a.marks_obtained)
    return list.map((r, idx) => ({ ...r, rank: idx + 1 }))
  }, [selectedExamForResults, results, exams])

  const tabButtonStyle = (tab) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    backgroundColor: activeTab === tab ? '#1e3a5f' : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#334155',
    position: 'relative',
  })

  const stats = {
    enquiries: enquiries.length,
    applications: applications.length,
    exams: exams.length,
    newComers: newComers.length,
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>🎓 Pre-Admission Platform</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Enquiries · Applications · Entrance · New Comers</p>
      </div>

      {/* Global stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Enquiries</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.enquiries}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Applications</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.applications}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Entrance Exams</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.exams}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #ca8a04' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>New Comers</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.newComers}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabButtonStyle(tab)}>
            {tab === 'Daily' && '🌅 '}
            {tab === 'Enquiries' && '📞 '}
            {tab === 'Applications' && '📄 '}
            {tab === 'Entrance' && '📝 '}
            {tab === 'New Comers' && '🎓 '}
            {tab}
            {tab === 'Daily' && enquiries.filter(e => e.follow_up_date && e.follow_up_date <= todayStr() && !['Converted to App', 'Closed'].includes(e.status)).length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {enquiries.filter(e => e.follow_up_date && e.follow_up_date <= todayStr() && !['Converted to App', 'Closed'].includes(e.status)).length}
              </span>
            )}
          </button>
        ))}

        {activeTab !== 'Daily' && (
          <select style={{ ...inputStyle, maxWidth: 160, marginLeft: 'auto' }} value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="All">All Batches</option>
            {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {/* Daily */}
      {activeTab === 'Daily' && !loading && (
        <DailyDashboard enquiries={enquiries} applications={applications} exams={exams} results={results} newComers={newComers} fetchAllData={fetchAllData} />
      )}
      {loading && activeTab === 'Daily' && <div style={{ color: '#64748b', padding: 32, textAlign: 'center' }}>Loading data…</div>}

      {/* Search (non-daily) */}
      {activeTab !== 'Daily' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <input style={inputStyle} placeholder={`Search ${activeTab.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* ── Enquiries ── */}
      {activeTab === 'Enquiries' && (
        <>
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Enquiry</h2>
            <form onSubmit={e => { e.preventDefault(); handleInsert('enquiries', enquiryForm, () => setEnquiryForm({ ...enquiryDefault, enquiry_date: todayStr() })) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Student Name *</label><input style={inputStyle} required value={enquiryForm.student_name} onChange={e => setEnquiryForm({ ...enquiryForm, student_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Parent Name</label><input style={inputStyle} value={enquiryForm.parent_name} onChange={e => setEnquiryForm({ ...enquiryForm, parent_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={enquiryForm.phone} onChange={e => setEnquiryForm({ ...enquiryForm, phone: e.target.value })} /></div>
                <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={enquiryForm.email} onChange={e => setEnquiryForm({ ...enquiryForm, email: e.target.value })} /></div>
                <div><label style={labelStyle}>Class Interest</label><input style={inputStyle} value={enquiryForm.class_interest} onChange={e => setEnquiryForm({ ...enquiryForm, class_interest: e.target.value })} /></div>
                <div><label style={labelStyle}>Batch Preference</label><input style={inputStyle} value={enquiryForm.batch_preference} onChange={e => setEnquiryForm({ ...enquiryForm, batch_preference: e.target.value })} /></div>
                <div><label style={labelStyle}>Source</label>
                  <select style={inputStyle} value={enquiryForm.source} onChange={e => setEnquiryForm({ ...enquiryForm, source: e.target.value })}>
                    <option>Walk-in</option><option>Facebook</option><option>Instagram</option><option>WhatsApp</option><option>Google</option><option>Referral</option><option>Call</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={enquiryForm.status} onChange={e => setEnquiryForm({ ...enquiryForm, status: e.target.value })}>
                    <option>New</option><option>Contacted</option><option>Follow Up</option><option>Converted to App</option><option>Closed</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Enquiry Date</label><input type="date" style={inputStyle} value={enquiryForm.enquiry_date} onChange={e => setEnquiryForm({ ...enquiryForm, enquiry_date: e.target.value })} /></div>
                <div><label style={labelStyle}>Follow Up Date</label><input type="date" style={inputStyle} value={enquiryForm.follow_up_date} onChange={e => setEnquiryForm({ ...enquiryForm, follow_up_date: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Remarks</label><textarea rows="3" style={inputStyle} value={enquiryForm.remarks} onChange={e => setEnquiryForm({ ...enquiryForm, remarks: e.target.value })} /></div>
              </div>
              <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Enquiry'}</button>
            </form>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Enquiries Records</h2>
            {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th><th style={thStyle}>Student</th><th style={thStyle}>Batch</th><th style={thStyle}>Source</th><th style={thStyle}>Follow Up</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                  </tr></thead>
                  <tbody>
                    {filteredEnquiries.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}><div style={{ fontWeight: 600 }}>{item.student_name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{item.phone || '—'}</div></td>
                        <td style={tdStyle}>{item.batch_preference || '—'}</td>
                        <td style={tdStyle}>{item.source}</td>
                        <td style={tdStyle}>{item.follow_up_date || '—'}</td>
                        <td style={tdStyle}><span style={badgeStyle(item.status === 'New' ? 'blue' : item.status === 'Closed' ? 'gray' : item.status === 'Converted to App' ? 'green' : 'amber')}>{item.status}</span></td>
                        <td style={tdStyle}><button onClick={() => handleDelete('enquiries', item.id)} style={deleteBtnStyle}>Delete</button></td>
                      </tr>
                    ))}
                    {filteredEnquiries.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Applications ── */}
      {activeTab === 'Applications' && (
        <>
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Application</h2>
            <form onSubmit={e => { e.preventDefault(); handleInsert('applications', applicationForm, () => setApplicationForm({ ...applicationDefault, application_date: todayStr() })) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Student Name *</label><input style={inputStyle} required value={applicationForm.student_name} onChange={e => setApplicationForm({ ...applicationForm, student_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Parent Name</label><input style={inputStyle} value={applicationForm.parent_name} onChange={e => setApplicationForm({ ...applicationForm, parent_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={applicationForm.phone} onChange={e => setApplicationForm({ ...applicationForm, phone: e.target.value })} /></div>
                <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={applicationForm.email} onChange={e => setApplicationForm({ ...applicationForm, email: e.target.value })} /></div>
                <div><label style={labelStyle}>Date of Birth</label><input type="date" style={inputStyle} value={applicationForm.dob} onChange={e => setApplicationForm({ ...applicationForm, dob: e.target.value })} /></div>
                <div><label style={labelStyle}>Previous School</label><input style={inputStyle} value={applicationForm.previous_school} onChange={e => setApplicationForm({ ...applicationForm, previous_school: e.target.value })} /></div>
                <div><label style={labelStyle}>Percentage / Marks</label><input style={inputStyle} value={applicationForm.percentage_marks} onChange={e => setApplicationForm({ ...applicationForm, percentage_marks: e.target.value })} /></div>
                <div><label style={labelStyle}>Applied Batch</label><input style={inputStyle} value={applicationForm.applied_batch} onChange={e => setApplicationForm({ ...applicationForm, applied_batch: e.target.value })} /></div>
                <div><label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={applicationForm.status} onChange={e => setApplicationForm({ ...applicationForm, status: e.target.value })}>
                    <option>Submitted</option><option>Under Review</option><option>Accepted</option><option>Rejected</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Documents Uploaded</label>
                  <select style={inputStyle} value={applicationForm.documents_uploaded} onChange={e => setApplicationForm({ ...applicationForm, documents_uploaded: e.target.value === 'true' })}>
                    <option value="false">No</option><option value="true">Yes</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address</label><textarea rows="2" style={inputStyle} value={applicationForm.address} onChange={e => setApplicationForm({ ...applicationForm, address: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Remarks</label><textarea rows="2" style={inputStyle} value={applicationForm.remarks} onChange={e => setApplicationForm({ ...applicationForm, remarks: e.target.value })} /></div>
              </div>
              <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Application'}</button>
            </form>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Applications Records</h2>
            {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th><th style={thStyle}>Student</th><th style={thStyle}>Batch</th><th style={thStyle}>Prev School</th><th style={thStyle}>Docs</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                  </tr></thead>
                  <tbody>
                    {filteredApplications.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}><div style={{ fontWeight: 600 }}>{item.student_name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{item.phone || '—'}</div></td>
                        <td style={tdStyle}>{item.applied_batch || '—'}</td>
                        <td style={tdStyle}>{item.previous_school || '—'}</td>
                        <td style={tdStyle}>{item.documents_uploaded ? '✅' : '❌'}</td>
                        <td style={tdStyle}><span style={badgeStyle(item.status === 'Submitted' ? 'blue' : item.status === 'Accepted' ? 'green' : item.status === 'Rejected' ? 'red' : 'amber')}>{item.status}</span></td>
                        <td style={tdStyle}><button onClick={() => handleDelete('applications', item.id)} style={deleteBtnStyle}>Delete</button></td>
                      </tr>
                    ))}
                    {filteredApplications.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Entrance ── */}
      {activeTab === 'Entrance' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Exam schedule */}
            <div style={cardStyle}>
              <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Schedule Exam</h2>
              <form onSubmit={e => { e.preventDefault(); handleInsert('entrance_exams', examForm, () => setExamForm(examDefault)) }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div><label style={labelStyle}>Exam Name *</label><input style={inputStyle} required value={examForm.exam_name} onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })} /></div>
                  <div><label style={labelStyle}>Batch</label><input style={inputStyle} value={examForm.batch} onChange={e => setExamForm({ ...examForm, batch: e.target.value })} /></div>
                  <div><label style={labelStyle}>Exam Date</label><input type="date" style={inputStyle} value={examForm.exam_date} onChange={e => setExamForm({ ...examForm, exam_date: e.target.value })} /></div>
                  <div><label style={labelStyle}>Total Marks</label><input style={inputStyle} value={examForm.total_marks} onChange={e => setExamForm({ ...examForm, total_marks: e.target.value })} /></div>
                  <div><label style={labelStyle}>Status</label>
                    <select style={inputStyle} value={examForm.status} onChange={e => setExamForm({ ...examForm, status: e.target.value })}>
                      <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Schedule Exam'}</button>
              </form>
            </div>

            {/* Result entry */}
            <div style={cardStyle}>
              <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Enter Result</h2>
              <form onSubmit={handleResultInsert}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Select Exam *</label>
                    <select style={inputStyle} required value={resultForm.exam_id} onChange={e => setResultForm({ ...resultForm, exam_id: e.target.value })}>
                      <option value="">Choose exam…</option>
                      {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.batch})</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>Student Name *</label><input style={inputStyle} required value={resultForm.student_name} onChange={e => setResultForm({ ...resultForm, student_name: e.target.value })} /></div>
                  <div><label style={labelStyle}>Application ID</label><input style={inputStyle} value={resultForm.application_id} onChange={e => setResultForm({ ...resultForm, application_id: e.target.value })} /></div>
                  <div><label style={labelStyle}>Marks Obtained *</label><input type="number" style={inputStyle} required value={resultForm.marks_obtained} onChange={e => setResultForm({ ...resultForm, marks_obtained: e.target.value })} /></div>
                  <div><label style={labelStyle}>Status</label>
                    <select style={inputStyle} value={resultForm.status} onChange={e => setResultForm({ ...resultForm, status: e.target.value })}>
                      <option>Pending</option><option>Passed</option><option>Failed</option><option>Absent</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Result'}</button>
              </form>
            </div>
          </div>

          {/* Exams table */}
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Exam Schedule</h2>
            {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th><th style={thStyle}>Exam</th><th style={thStyle}>Batch</th><th style={thStyle}>Date</th><th style={thStyle}>Total Marks</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                  </tr></thead>
                  <tbody>
                    {exams.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{item.exam_name}</td>
                        <td style={tdStyle}>{item.batch || '—'}</td>
                        <td style={tdStyle}>{item.exam_date || '—'}</td>
                        <td style={tdStyle}>{item.total_marks}</td>
                        <td style={tdStyle}><span style={badgeStyle(item.status === 'Scheduled' ? 'purple' : item.status === 'Completed' ? 'green' : 'gray')}>{item.status}</span></td>
                        <td style={tdStyle}><button onClick={() => handleDelete('entrance_exams', item.id)} style={deleteBtnStyle}>Delete</button></td>
                      </tr>
                    ))}
                    {exams.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No exams scheduled</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Merit list */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ color: '#1e3a5f' }}>Merit List</h2>
              <select style={{ ...inputStyle, maxWidth: 240 }} value={selectedExamForResults} onChange={e => setSelectedExamForResults(e.target.value)}>
                <option value="">Select exam to view results…</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.exam_name} — {ex.batch}</option>)}
              </select>
            </div>
            {selectedExamForResults ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Rank</th><th style={thStyle}>Student</th><th style={thStyle}>Marks</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th>
                  </tr></thead>
                  <tbody>
                    {meritList.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}><span style={{ ...badgeStyle('purple'), fontSize: 12 }}>#{r.rank}</span></td>
                        <td style={tdStyle}>{r.student_name}</td>
                        <td style={tdStyle}><strong>{r.marks_obtained}</strong></td>
                        <td style={tdStyle}><span style={badgeStyle(r.status === 'Passed' ? 'green' : r.status === 'Failed' ? 'red' : 'amber')}>{r.status}</span></td>
                        <td style={tdStyle}><button onClick={() => handleDelete('entrance_results', r.id)} style={deleteBtnStyle}>Delete</button></td>
                      </tr>
                    ))}
                    {meritList.length === 0 && <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No results entered for this exam</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>Select an exam above to view the merit list.</div>}
          </div>
        </>
      )}

      {/* ── New Comers ── */}
      {activeTab === 'New Comers' && (
        <>
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add New Comer</h2>
            <form onSubmit={e => { e.preventDefault(); handleInsert('new_comers', newComerForm, () => setNewComerForm(newComerDefault)) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Student Name *</label><input style={inputStyle} required value={newComerForm.student_name} onChange={e => setNewComerForm({ ...newComerForm, student_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Parent Name</label><input style={inputStyle} value={newComerForm.parent_name} onChange={e => setNewComerForm({ ...newComerForm, parent_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={newComerForm.phone} onChange={e => setNewComerForm({ ...newComerForm, phone: e.target.value })} /></div>
                <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={newComerForm.email} onChange={e => setNewComerForm({ ...newComerForm, email: e.target.value })} /></div>
                <div><label style={labelStyle}>Batch *</label><input style={inputStyle} required value={newComerForm.batch} onChange={e => setNewComerForm({ ...newComerForm, batch: e.target.value })} /></div>
                <div><label style={labelStyle}>Entrance Score</label><input style={inputStyle} value={newComerForm.entrance_score} onChange={e => setNewComerForm({ ...newComerForm, entrance_score: e.target.value })} /></div>
                <div><label style={labelStyle}>Application Ref</label><input style={inputStyle} value={newComerForm.application_ref} onChange={e => setNewComerForm({ ...newComerForm, application_ref: e.target.value })} /></div>
                <div><label style={labelStyle}>Fee Status</label>
                  <select style={inputStyle} value={newComerForm.fee_status} onChange={e => setNewComerForm({ ...newComerForm, fee_status: e.target.value })}>
                    <option>Pending</option><option>Partial</option><option>Paid</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Documents Verified</label>
                  <select style={inputStyle} value={newComerForm.documents_verified} onChange={e => setNewComerForm({ ...newComerForm, documents_verified: e.target.value })}>
                    <option>Pending</option><option>Verified</option><option>Rejected</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Joining Date</label><input type="date" style={inputStyle} value={newComerForm.joining_date} onChange={e => setNewComerForm({ ...newComerForm, joining_date: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Remarks</label><textarea rows="3" style={inputStyle} value={newComerForm.remarks} onChange={e => setNewComerForm({ ...newComerForm, remarks: e.target.value })} /></div>
              </div>
              <button type="submit" disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save New Comer'}</button>
            </form>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>New Comers Data Centre</h2>
            {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th><th style={thStyle}>Student</th><th style={thStyle}>Batch</th><th style={thStyle}>Score</th><th style={thStyle}>Fee</th><th style={thStyle}>Docs</th><th style={thStyle}>Joining</th><th style={thStyle}>Action</th>
                  </tr></thead>
                  <tbody>
                    {filteredNewComers.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}><div style={{ fontWeight: 600 }}>{item.student_name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{item.phone || '—'}</div></td>
                        <td style={tdStyle}>{item.batch || '—'}</td>
                        <td style={tdStyle}>{item.entrance_score || '—'}</td>
                        <td style={tdStyle}><span style={badgeStyle(item.fee_status === 'Paid' ? 'green' : item.fee_status === 'Partial' ? 'amber' : 'red')}>{item.fee_status}</span></td>
                        <td style={tdStyle}><span style={badgeStyle(item.documents_verified === 'Verified' ? 'green' : item.documents_verified === 'Rejected' ? 'red' : 'gray')}>{item.documents_verified}</span></td>
                        <td style={tdStyle}>{item.joining_date || '—'}</td>
                        <td style={tdStyle}><button onClick={() => handleDelete('new_comers', item.id)} style={deleteBtnStyle}>Delete</button></td>
                      </tr>
                    ))}
                    {filteredNewComers.length === 0 && <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import './entrance-mobile.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_TYPES = ['Sainik School', 'Navodaya (JNV)', 'Foundation', 'Combined']
const EXAM_STATUS = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled']
const CANDIDATE_STATUS = ['Registered', 'Hall Ticket Issued', 'Appeared', 'Absent', 'Disqualified']
const RESULT_STATUS = ['Pending', 'Pass', 'Fail', 'Waitlist', 'Admitted', 'Rejected']
const CLASSES = ['Class 5→6', 'Class 6→7', 'Class 8→9', 'Class 9→10', 'Class 11→12']
const SUBJECTS = {
  'Sainik School': ['Mathematics', 'English', 'General Knowledge', 'Intelligence'],
  'Navodaya (JNV)': ['Mental Ability', 'Arithmetic', 'Language'],
  'Foundation': ['Mathematics', 'English', 'Science', 'Social Studies'],
  'Combined': ['Mathematics', 'English', 'General Knowledge', 'Intelligence', 'Reasoning'],
}

const TABS = ['Dashboard', 'Exams', 'Candidates', 'Hall Tickets', 'Answer Key', 'Results', 'Merit List', 'Admission', 'Timeline']

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  wrap: { padding: '24px', fontFamily: "'Outfit', 'Segoe UI', sans-serif", color: '#1e293b' },
  card: { background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e8edf3' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', outline: 'none', fontFamily: 'inherit' },
  label: { display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' },
  th: { padding: '11px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e8edf3', textAlign: 'left', background: '#f8fafc' },
  td: { padding: '12px 14px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9' },
  btn: (color = '#1e3a5f') => ({ background: color, color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit' }),
  ghost: { background: 'transparent', border: '1px solid #d1d5db', color: '#64748b', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit' },
  badge: (color) => {
    const map = {
      blue: ['#dbeafe', '#1d4ed8'], green: ['#d1fae5', '#065f46'], red: ['#fee2e2', '#b91c1c'],
      yellow: ['#fef9c3', '#854d0e'], purple: ['#ede9fe', '#6d28d9'], gray: ['#f1f5f9', '#475569'],
      orange: ['#ffedd5', '#9a3412'], teal: ['#ccfbf1', '#0f766e'],
    }
    const [bg, fg] = map[color] || map.gray
    return { background: bg, color: fg, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'inline-block', whiteSpace: 'nowrap' }
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' },
  section: { marginBottom: '20px' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor = {
  Scheduled: 'blue', Ongoing: 'orange', Completed: 'green', Cancelled: 'red',
  Registered: 'blue', 'Hall Ticket Issued': 'purple', Appeared: 'teal', Absent: 'yellow', Disqualified: 'red',
  Pending: 'gray', Pass: 'green', Fail: 'red', Waitlist: 'yellow', Admitted: 'teal', Rejected: 'red',
}

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const hallTicketNo = (examId, roll) => `GNSI/${examId?.toString().slice(-4).toUpperCase() || 'XXXX'}/${String(roll).padStart(4, '0')}`

function StatCard({ label, val, color, icon, sub }) {
  const colors = { blue: '#2563eb', green: '#059669', purple: '#7c3aed', orange: '#d97706', red: '#dc2626', teal: '#0f766e' }
  const c = colors[color] || '#1e3a5f'
  return (
    <div style={{ ...S.card, borderTop: `3px solid ${c}`, padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: c, lineHeight: 1.1, marginTop: '4px' }}>{val}</div>
          {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
        <div style={{ fontSize: '26px', opacity: 0.6 }}>{icon}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...S.card, maxWidth: 380, width: '90%', padding: '28px' }}>
        <div style={{ fontSize: '16px', color: '#1e293b', marginBottom: '20px', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={S.ghost}>Cancel</button>
          <button onClick={onConfirm} style={S.btn('#dc2626')}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ exams, candidates, results }) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = exams.filter(e => e.exam_date >= today && e.status === 'Scheduled')
  const ongoing = exams.filter(e => e.status === 'Ongoing')
  const appeared = candidates.filter(c => c.status === 'Appeared').length
  const admitted = results.filter(r => r.result_status === 'Admitted').length
  const pass = results.filter(r => r.result_status === 'Pass').length
  const passRate = results.length > 0 ? Math.round((pass / results.filter(r => r.result_status !== 'Pending').length) * 100) : 0

  const byType = EXAM_TYPES.map(t => ({
    type: t, total: candidates.filter(c => exams.find(e => e.id === c.exam_id)?.exam_type === t).length,
    admitted: results.filter(r => r.result_status === 'Admitted' && exams.find(e => e.id === candidates.find(cc => cc.id === r.candidate_id)?.exam_id)?.exam_type === t).length,
  }))

  return (
    <div>
      <div style={{ ...S.grid4, marginBottom: 20 }}>
        <StatCard label="Total Exams" val={exams.length} color="blue" icon="📋" sub={`${ongoing.length} ongoing`} />
        <StatCard label="Candidates" val={candidates.length} color="purple" icon="👥" sub={`${appeared} appeared`} />
        <StatCard label="Pass Rate" val={`${passRate}%`} color="green" icon="📈" sub={`${pass} passed`} />
        <StatCard label="Admitted" val={admitted} color="teal" icon="🎓" sub="final admissions" />
      </div>

      {upcoming.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 12 }}>📅 Upcoming Exams</div>
          {upcoming.map(e => {
            const daysLeft = Math.ceil((new Date(e.exam_date) - new Date()) / 86400000)
            const count = candidates.filter(c => c.exam_id === e.id).length
            return (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{e.exam_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{e.exam_type} · {fmt(e.exam_date)} · {e.venue || 'TBD'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={S.badge('blue')}>{count} candidates</span>
                  <span style={{ ...S.badge(daysLeft <= 3 ? 'red' : 'green'), minWidth: 70, textAlign: 'center' }}>{daysLeft}d left</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>📊 Exam Type Summary</div>
          {byType.map(b => (
            <div key={b.type} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 4 }}>
                <span style={{ fontWeight: '600' }}>{b.type}</span>
                <span style={{ color: '#64748b' }}>{b.admitted}/{b.total} admitted</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                <div style={{ height: '100%', borderRadius: 3, background: '#0f766e', width: b.total > 0 ? `${(b.admitted / b.total) * 100}%` : '0%', transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>🎯 Result Funnel</div>
          {[
            { label: 'Registered', count: candidates.length, color: '#2563eb' },
            { label: 'Appeared', count: appeared, color: '#7c3aed' },
            { label: 'Passed', count: pass, color: '#059669' },
            { label: 'Admitted', count: admitted, color: '#0f766e' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                  <span>{s.label}</span><span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#f1f5f9' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.color, width: candidates.length > 0 ? `${(s.count / candidates.length) * 100}%` : '0%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Exams Tab ────────────────────────────────────────────────────────────────

function ExamsTab({ exams, candidates, onRefresh }) {
  const [form, setForm] = useState({ exam_name: '', exam_type: 'Sainik School', class_target: 'Class 5→6', exam_date: '', exam_time: '09:00', duration_mins: 120, venue: '', total_marks: 100, passing_marks: 40, status: 'Scheduled', instructions: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = exams.filter(e => (e.exam_name + e.exam_type + e.status).toLowerCase().includes(search.toLowerCase()))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('entrance_exams').insert([form])
    if (error) alert(error.message)
    else { setShowForm(false); setForm({ exam_name: '', exam_type: 'Sainik School', class_target: 'Class 5→6', exam_date: '', exam_time: '09:00', duration_mins: 120, venue: '', total_marks: 100, passing_marks: 40, status: 'Scheduled', instructions: '' }); onRefresh() }
    setSaving(false)
  }

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('entrance_exams').update({ status }).eq('id', id)
    if (error) alert(error.message)
    else onRefresh()
  }

  const del = async (id) => {
    setConfirm({ msg: 'Delete this exam and all its data?', action: async () => {
      await supabase.from('entrance_exams').delete().eq('id', id)
      onRefresh()
    }})
  }

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.msg} onConfirm={() => { confirm.action(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <input style={{ ...S.input, maxWidth: 280 }} placeholder="Search exams…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={S.btn()} onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Close' : '+ Schedule Exam'}</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a5f', marginBottom: 16 }}>📋 Schedule New Entrance Exam</div>
          <form onSubmit={save}>
            <div style={{ ...S.grid3, marginBottom: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Exam Name *</label>
                <input style={S.input} required value={form.exam_name} onChange={e => setForm({ ...form, exam_name: e.target.value })} placeholder="e.g. Sainik School Entrance 2025 Batch A" />
              </div>
              <div>
                <label style={S.label}>Exam Type</label>
                <select style={S.input} value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })}>
                  {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Class Target</label>
                <select style={S.input} value={form.class_target} onChange={e => setForm({ ...form, class_target: e.target.value })}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Status</label>
                <select style={S.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {EXAM_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Exam Date *</label>
                <input type="date" style={S.input} required value={form.exam_date} onChange={e => setForm({ ...form, exam_date: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Start Time</label>
                <input type="time" style={S.input} value={form.exam_time} onChange={e => setForm({ ...form, exam_time: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Duration (mins)</label>
                <input type="number" style={S.input} value={form.duration_mins} onChange={e => setForm({ ...form, duration_mins: Number(e.target.value) })} />
              </div>
              <div>
                <label style={S.label}>Total Marks</label>
                <input type="number" style={S.input} value={form.total_marks} onChange={e => setForm({ ...form, total_marks: Number(e.target.value) })} />
              </div>
              <div>
                <label style={S.label}>Passing Marks</label>
                <input type="number" style={S.input} value={form.passing_marks} onChange={e => setForm({ ...form, passing_marks: Number(e.target.value) })} />
              </div>
              <div>
                <label style={S.label}>Venue</label>
                <input style={S.input} value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Exam hall / room" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Exam Instructions</label>
                <textarea rows="3" style={S.input} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions printed on hall ticket…" />
              </div>
            </div>
            <button type="submit" disabled={saving} style={S.btn()}>{saving ? 'Saving…' : '✓ Schedule Exam'}</button>
          </form>
        </div>
      )}

      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {['Exam', 'Type', 'Class', 'Date & Time', 'Venue', 'Marks', 'Candidates', 'Status', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ background: e.status === 'Ongoing' ? '#fffbeb' : 'transparent' }}>
                <td style={S.td}><div style={{ fontWeight: '600', color: '#1e293b' }}>{e.exam_name}</div></td>
                <td style={S.td}>{e.exam_type}</td>
                <td style={S.td}>{e.class_target}</td>
                <td style={S.td}>{fmt(e.exam_date)}<div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.exam_time} · {e.duration_mins}m</div></td>
                <td style={S.td}>{e.venue || '—'}</td>
                <td style={S.td}><span style={{ fontWeight: '600' }}>{e.total_marks}</span><span style={{ color: '#94a3b8', fontSize: 11 }}> / pass {e.passing_marks}</span></td>
                <td style={S.td}><span style={S.badge('blue')}>{candidates.filter(c => c.exam_id === e.id).length}</span></td>
                <td style={S.td}><span style={S.badge(statusColor[e.status])}>{e.status}</span></td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {e.status === 'Scheduled' && <button onClick={() => updateStatus(e.id, 'Ongoing')} style={{ ...S.btn('#d97706'), padding: '5px 10px', fontSize: '11px' }}>▶ Start</button>}
                    {e.status === 'Ongoing' && <button onClick={() => updateStatus(e.id, 'Completed')} style={{ ...S.btn('#059669'), padding: '5px 10px', fontSize: '11px' }}>✓ End</button>}
                    <button onClick={() => del(e.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="9" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No exams scheduled yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Candidates Tab ───────────────────────────────────────────────────────────

function CandidatesTab({ exams, candidates, onRefresh }) {
  const [form, setForm] = useState({ exam_id: '', student_name: '', dob: '', father_name: '', mother_name: '', phone: '', address: '', school: '', class_studying: '', photo_url: '', status: 'Registered', remarks: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterExam, setFilterExam] = useState('')
  const [bulkFile, setBulkFile] = useState(null)

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    const examMatch = !filterExam || c.exam_id === filterExam
    return examMatch && (c.student_name + c.phone + c.school + c.status).toLowerCase().includes(q)
  })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    // auto-assign roll number
    const existing = candidates.filter(c => c.exam_id === form.exam_id).length
    const payload = { ...form, roll_number: existing + 1 }
    const { error } = await supabase.from('entrance_candidates').insert([payload])
    if (error) alert(error.message)
    else { setShowForm(false); setForm({ exam_id: '', student_name: '', dob: '', father_name: '', mother_name: '', phone: '', address: '', school: '', class_studying: '', photo_url: '', status: 'Registered', remarks: '' }); onRefresh() }
    setSaving(false)
  }

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('entrance_candidates').update({ status }).eq('id', id)
    if (error) alert(error.message)
    else onRefresh()
  }

  const del = async (id) => {
    if (!window.confirm('Remove candidate?')) return
    await supabase.from('entrance_candidates').delete().eq('id', id)
    onRefresh()
  }

  // Parse CSV bulk import
  const handleBulkImport = async () => {
    if (!bulkFile || !form.exam_id) { alert('Select exam and CSV file'); return }
    const text = await bulkFile.text()
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1).map((line, i) => {
      const vals = line.split(',').map(v => v.trim())
      const obj = {}
      headers.forEach((h, j) => { obj[h] = vals[j] || '' })
      return { exam_id: form.exam_id, student_name: obj['student_name'] || obj['name'] || '', father_name: obj['father_name'] || obj['father'] || '', phone: obj['phone'] || obj['mobile'] || '', school: obj['school'] || '', class_studying: obj['class'] || '', dob: obj['dob'] || '', status: 'Registered', roll_number: candidates.filter(c => c.exam_id === form.exam_id).length + i + 1 }
    }).filter(r => r.student_name)
    if (rows.length === 0) { alert('No valid rows found'); return }
    const { error } = await supabase.from('entrance_candidates').insert(rows)
    if (error) alert(error.message)
    else { setBulkFile(null); alert(`${rows.length} candidates imported!`); onRefresh() }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select style={{ ...S.input, maxWidth: 220 }} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
          <option value="">All Exams</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
        <input style={{ ...S.input, maxWidth: 240 }} placeholder="Search candidates…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={S.ghost} onClick={() => setShowForm(v => !v)}>📤 Bulk Import CSV</button>
          <button style={S.btn()} onClick={() => setShowForm(v => !v)}>+ Add Candidate</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a5f', marginBottom: 16 }}>👤 Register Candidate</div>

          {/* Bulk CSV */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>📂 Bulk CSV Import (columns: student_name, father_name, phone, school, class, dob)</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select style={{ ...S.input, maxWidth: 220 }} value={form.exam_id} onChange={e => setForm({ ...form, exam_id: e.target.value })}>
                <option value="">Select Exam</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.exam_name}</option>)}
              </select>
              <input type="file" accept=".csv" onChange={e => setBulkFile(e.target.files[0])} style={{ fontSize: 13 }} />
              <button onClick={handleBulkImport} style={S.btn('#0f766e')}>Import</button>
            </div>
          </div>

          <form onSubmit={save}>
            <div style={{ ...S.grid3, marginBottom: 14 }}>
              <div>
                <label style={S.label}>Exam *</label>
                <select style={S.input} required value={form.exam_id} onChange={e => setForm({ ...form, exam_id: e.target.value })}>
                  <option value="">Select exam</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.exam_name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Student Name *</label>
                <input style={S.input} required value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Date of Birth</label>
                <input type="date" style={S.input} value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Father's Name</label>
                <input style={S.input} value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Mother's Name</label>
                <input style={S.input} value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Phone</label>
                <input style={S.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Current School</label>
                <input style={S.input} value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Class Studying</label>
                <input style={S.input} value={form.class_studying} onChange={e => setForm({ ...form, class_studying: e.target.value })} placeholder="e.g. Class 5" />
              </div>
              <div>
                <label style={S.label}>Status</label>
                <select style={S.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {CANDIDATE_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Address</label>
                <input style={S.input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={S.btn()}>{saving ? 'Saving…' : '✓ Register'}</button>
          </form>
        </div>
      )}

      <div style={{ ...S.card, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f' }}>Candidates ({filtered.length})</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>{['Roll', 'Student', 'Father', 'Phone', 'School', 'Exam', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const exam = exams.find(e => e.id === c.exam_id)
              return (
                <tr key={c.id}>
                  <td style={S.td}><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{exam ? hallTicketNo(exam.id, c.roll_number) : c.roll_number}</span></td>
                  <td style={S.td}><div style={{ fontWeight: 600 }}>{c.student_name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.class_studying}</div></td>
                  <td style={S.td}>{c.father_name || '—'}</td>
                  <td style={S.td}>{c.phone ? <a href={`tel:${c.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{c.phone}</a> : '—'}</td>
                  <td style={S.td}>{c.school || '—'}</td>
                  <td style={S.td}><span style={{ fontSize: 11, color: '#64748b' }}>{exam?.exam_name || '—'}</span></td>
                  <td style={S.td}>
                    <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)} style={{ ...S.input, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
                      {CANDIDATE_STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={S.td}><button onClick={() => del(c.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>✕</button></td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No candidates found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Hall Tickets Tab ─────────────────────────────────────────────────────────

function HallTicketsTab({ exams, candidates }) {
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const printRef = useRef()

  const exam = exams.find(e => e.id === selectedExam)
  const examCandidates = candidates.filter(c => c.exam_id === selectedExam)

  const handlePrint = () => {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Hall Ticket</title><style>
      body { font-family: 'Segoe UI', sans-serif; margin: 0; }
      @media print { body { margin: 0; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`)
    win.document.close()
    win.print()
  }

  const handlePrintAll = () => {
    if (!exam || examCandidates.length === 0) return
    const allHtml = examCandidates.map(c => renderHallTicketHtml(c, exam)).join('<div style="page-break-after:always"></div>')
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Hall Tickets - ${exam.exam_name}</title><style>body{font-family:'Segoe UI',sans-serif;margin:0;}@media print{.ticket{page-break-after:always;}}</style></head><body>${allHtml}</body></html>`)
    win.document.close()
    win.print()
  }

  const renderHallTicketHtml = (c, ex) => `
    <div style="width:560px;border:2px solid #1e3a5f;border-radius:12px;padding:0;overflow:hidden;margin:20px auto;font-family:serif;">
      <div style="background:#1e3a5f;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="font-size:20px;font-weight:800;letter-spacing:0.05em">GNSI</div><div style="font-size:11px;opacity:0.8">Guidance Navodaya & Sainik Institute</div><div style="font-size:10px;opacity:0.7">Khangabok, Thoubal, Manipur</div></div>
        <div style="text-align:right"><div style="font-size:14px;font-weight:700">HALL TICKET</div><div style="font-size:11px;opacity:0.8">Entrance Examination</div></div>
      </div>
      <div style="background:#f4a61c;height:3px;"></div>
      <div style="padding:16px 20px;">
        <div style="font-size:15px;font-weight:700;color:#1e3a5f;text-align:center;margin-bottom:12px;border-bottom:1px dashed #cbd5e1;padding-bottom:10px;">${ex.exam_name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:13px;">
          <div><b>Roll No:</b> ${hallTicketNo(ex.id, c.roll_number)}</div>
          <div><b>Date:</b> ${fmt(ex.exam_date)}</div>
          <div><b>Time:</b> ${ex.exam_time}</div>
          <div><b>Duration:</b> ${ex.duration_mins} minutes</div>
          <div><b>Venue:</b> ${ex.venue || 'GNSI, Khangabok'}</div>
          <div><b>Total Marks:</b> ${ex.total_marks}</div>
        </div>
        <div style="border-top:1px solid #e2e8f0;padding-top:10px;font-size:13px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div><b>Name:</b> ${c.student_name}</div>
            <div><b>DOB:</b> ${fmt(c.dob)}</div>
            <div><b>Father:</b> ${c.father_name || '—'}</div>
            <div><b>Class:</b> ${ex.class_target}</div>
            <div style="grid-column:1/-1"><b>School:</b> ${c.school || '—'}</div>
          </div>
        </div>
        ${ex.instructions ? `<div style="margin-top:12px;background:#fef9c3;border-radius:6px;padding:10px;font-size:11px;color:#854d0e;"><b>Instructions:</b> ${ex.instructions}</div>` : ''}
        <div style="margin-top:14px;display:flex;justify-content:space-between;font-size:11px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px;">
          <div>Candidate Signature: _______________</div>
          <div>Invigilator: _______________</div>
        </div>
      </div>
    </div>`

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...S.input, maxWidth: 300 }} value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setSelectedCandidate(null) }}>
          <option value="">Select Exam</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
        {exam && (
          <>
            <select style={{ ...S.input, maxWidth: 260 }} value={selectedCandidate || ''} onChange={e => setSelectedCandidate(e.target.value)}>
              <option value="">Select Candidate</option>
              {examCandidates.map(c => <option key={c.id} value={c.id}>{c.student_name} (Roll {c.roll_number})</option>)}
            </select>
            <button style={S.btn('#7c3aed')} onClick={handlePrint} disabled={!selectedCandidate}>🖨️ Print Selected</button>
            <button style={S.btn('#059669')} onClick={handlePrintAll}>🖨️ Print All ({examCandidates.length})</button>
          </>
        )}
      </div>

      {exam && selectedCandidate && (() => {
        const c = candidates.find(cc => cc.id === selectedCandidate)
        if (!c) return null
        return (
          <div>
            <div ref={printRef} style={{ maxWidth: 580, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: renderHallTicketHtml(c, exam) }} />
          </div>
        )
      })()}

      {exam && !selectedCandidate && (
        <div style={{ ...S.card, overflowX: 'auto' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>{exam.exam_name} — {examCandidates.length} candidates registered</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr>{['Roll No', 'Candidate', 'Status', 'Hall Ticket'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {examCandidates.map(c => (
                <tr key={c.id}>
                  <td style={S.td}><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{hallTicketNo(exam.id, c.roll_number)}</span></td>
                  <td style={S.td}><div style={{ fontWeight: 600 }}>{c.student_name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.father_name}</div></td>
                  <td style={S.td}><span style={S.badge(statusColor[c.status])}>{c.status}</span></td>
                  <td style={S.td}><button onClick={() => setSelectedCandidate(c.id)} style={{ ...S.btn('#7c3aed'), padding: '5px 10px', fontSize: 11 }}>Preview</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!exam && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎫</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Select an exam to view or print hall tickets</div>
        </div>
      )}
    </div>
  )
}

// ─── Answer Key Tab ───────────────────────────────────────────────────────────

function AnswerKeyTab({ exams, onRefresh }) {
  const [selectedExam, setSelectedExam] = useState('')
  const [answerKeys, setAnswerKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ subject: '', q_number: '', correct_option: '', marks: 1 })
  const [saving, setSaving] = useState(false)

  const exam = exams.find(e => e.id === selectedExam)
  const subjects = SUBJECTS[exam?.exam_type] || SUBJECTS['Foundation']

  const fetchKeys = useCallback(async (examId) => {
    if (!examId) return
    setLoading(true)
    const { data } = await supabase.from('entrance_answer_keys').select('*').eq('exam_id', examId).order('subject').order('q_number')
    setAnswerKeys(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchKeys(selectedExam) }, [selectedExam, fetchKeys])

  const saveKey = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('entrance_answer_keys').insert([{ ...form, exam_id: selectedExam, q_number: Number(form.q_number), marks: Number(form.marks) }])
    if (error) alert(error.message)
    else { setForm({ subject: '', q_number: '', correct_option: '', marks: 1 }); fetchKeys(selectedExam) }
    setSaving(false)
  }

  const del = async (id) => {
    await supabase.from('entrance_answer_keys').delete().eq('id', id)
    fetchKeys(selectedExam)
  }

  const grouped = subjects.reduce((acc, s) => {
    acc[s] = answerKeys.filter(k => k.subject === s)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select style={{ ...S.input, maxWidth: 320 }} value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">Select Exam</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
      </div>

      {selectedExam && (
        <>
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>➕ Add Answer Key Entry</div>
            <form onSubmit={saveKey}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={S.label}>Subject</label>
                  <select style={{ ...S.input, width: 180 }} required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                    <option value="">Select</option>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Q. No.</label>
                  <input type="number" style={{ ...S.input, width: 80 }} required value={form.q_number} onChange={e => setForm({ ...form, q_number: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Correct Option</label>
                  <select style={{ ...S.input, width: 100 }} required value={form.correct_option} onChange={e => setForm({ ...form, correct_option: e.target.value })}>
                    <option value="">Pick</option>
                    {['A', 'B', 'C', 'D'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Marks</label>
                  <input type="number" style={{ ...S.input, width: 70 }} value={form.marks} onChange={e => setForm({ ...form, marks: e.target.value })} />
                </div>
                <button type="submit" disabled={saving} style={S.btn()}>+ Add</button>
              </div>
            </form>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {subjects.map(subject => {
                const keys = grouped[subject] || []
                return (
                  <div key={subject} style={S.card}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e3a5f', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{subject}</span>
                      <span style={S.badge('blue')}>{keys.length} Q</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {keys.sort((a, b) => a.q_number - b.q_number).map(k => (
                        <div key={k.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8' }}>Q{k.q_number}</span>
                          <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{k.correct_option}</span>
                          <span style={{ color: '#94a3b8' }}>{k.marks}m</span>
                          <button onClick={() => del(k.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                        </div>
                      ))}
                      {keys.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>No answers added</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ exams, candidates, results, onRefresh }) {
  const [selectedExam, setSelectedExam] = useState('')
  const [editingResult, setEditingResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [subjectScores, setSubjectScores] = useState({})
  const [bulkOpen, setBulkOpen] = useState(false)

  const exam = exams.find(e => e.id === selectedExam)
  const examCandidates = candidates.filter(c => c.exam_id === selectedExam)
  const examResults = results.filter(r => examCandidates.some(c => c.id === r.candidate_id))

  const openEntry = (candidate) => {
    const existing = results.find(r => r.candidate_id === candidate.id) || {}
    setEditingResult({ ...candidate, resultId: existing.id, total_marks: existing.total_marks || '', result_status: existing.result_status || 'Pending', remarks: existing.remarks || '' })
    const scores = {}
    if (existing.subject_scores) {
      Object.assign(scores, typeof existing.subject_scores === 'string' ? JSON.parse(existing.subject_scores) : existing.subject_scores)
    }
    setSubjectScores(scores)
  }

  const subjects = SUBJECTS[exam?.exam_type] || []

  const computedTotal = subjects.reduce((sum, s) => sum + (Number(subjectScores[s]) || 0), 0)

  const saveResult = async () => {
    if (!editingResult) return
    setSaving(true)
    const payload = {
      candidate_id: editingResult.id,
      exam_id: selectedExam,
      total_marks: computedTotal || Number(editingResult.total_marks) || 0,
      subject_scores: JSON.stringify(subjectScores),
      result_status: editingResult.result_status,
      remarks: editingResult.remarks,
    }
    if (editingResult.resultId) {
      await supabase.from('entrance_results').update(payload).eq('id', editingResult.resultId)
    } else {
      await supabase.from('entrance_results').insert([payload])
    }
    setEditingResult(null)
    setSubjectScores({})
    onRefresh()
    setSaving(false)
  }

  const autoCompute = async () => {
    if (!exam) return
    const { data: keys } = await supabase.from('entrance_answer_keys').select('*').eq('exam_id', selectedExam)
    if (!keys?.length) { alert('No answer key found. Add answer key first.'); return }
    alert(`Auto-compute would match OMR responses against ${keys.length} answer key entries. Integration with OMR sheet upload coming soon.`)
  }

  const resultForCandidate = (candidateId) => results.find(r => r.candidate_id === candidateId)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...S.input, maxWidth: 320 }} value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setEditingResult(null) }}>
          <option value="">Select Exam</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
        {exam && (
          <>
            <button onClick={autoCompute} style={S.btn('#7c3aed')}>⚙️ Auto-Compute (OMR)</button>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{examResults.length} / {examCandidates.length} results entered</span>
          </>
        )}
      </div>

      {/* Result entry modal */}
      {editingResult && exam && (
        <div style={{ ...S.card, marginBottom: 20, border: '2px solid #1e3a5f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#1e3a5f' }}>📝 Enter Marks — {editingResult.student_name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{hallTicketNo(exam.id, editingResult.roll_number)} · {exam.exam_name}</div>
            </div>
            <button onClick={() => setEditingResult(null)} style={S.ghost}>✕ Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            {subjects.map(s => (
              <div key={s}>
                <label style={S.label}>{s}</label>
                <input type="number" style={S.input} placeholder="Score" value={subjectScores[s] || ''} onChange={e => setSubjectScores(prev => ({ ...prev, [s]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Total Score: </span>
              <span style={{ fontSize: 22, fontWeight: '800', color: computedTotal >= exam.passing_marks ? '#059669' : '#dc2626' }}>{computedTotal}</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}> / {exam.total_marks}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Pass mark: </span>
              <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{exam.passing_marks}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Percentage: </span>
              <span style={{ fontWeight: 700 }}>{exam.total_marks > 0 ? ((computedTotal / exam.total_marks) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Result Status</label>
              <select style={S.input} value={editingResult.result_status} onChange={e => setEditingResult({ ...editingResult, result_status: e.target.value })}>
                {RESULT_STATUS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={S.label}>Remarks</label>
              <input style={S.input} value={editingResult.remarks} onChange={e => setEditingResult({ ...editingResult, remarks: e.target.value })} placeholder="Optional remarks" />
            </div>
          </div>

          <button onClick={saveResult} disabled={saving} style={S.btn()}>{saving ? 'Saving…' : '✓ Save Result'}</button>
        </div>
      )}

      {exam && (
        <div style={{ ...S.card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>{['Roll', 'Candidate', 'Status', 'Total Marks', '% Score', 'Result', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {examCandidates.map(c => {
                const res = resultForCandidate(c.id)
                const pct = res && exam.total_marks > 0 ? ((res.total_marks / exam.total_marks) * 100).toFixed(1) : '—'
                return (
                  <tr key={c.id} style={{ background: res?.result_status === 'Admitted' ? '#f0fdf4' : res?.result_status === 'Fail' ? '#fef2f2' : 'transparent' }}>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{hallTicketNo(exam.id, c.roll_number)}</span></td>
                    <td style={S.td}><div style={{ fontWeight: 600 }}>{c.student_name}</div></td>
                    <td style={S.td}><span style={S.badge(statusColor[c.status])}>{c.status}</span></td>
                    <td style={S.td}>{res ? <span style={{ fontWeight: 700, fontSize: 15, color: res.total_marks >= exam.passing_marks ? '#059669' : '#dc2626' }}>{res.total_marks}</span> : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                    <td style={S.td}>{pct !== '—' ? `${pct}%` : '—'}</td>
                    <td style={S.td}>{res ? <span style={S.badge(statusColor[res.result_status])}>{res.result_status}</span> : <span style={S.badge('gray')}>Not entered</span>}</td>
                    <td style={S.td}><button onClick={() => openEntry(c)} style={{ ...S.btn('#1e3a5f'), padding: '5px 10px', fontSize: 11 }}>{res ? '✏️ Edit' : '+ Enter'}</button></td>
                  </tr>
                )
              })}
              {examCandidates.length === 0 && <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No candidates for this exam</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Merit List Tab ───────────────────────────────────────────────────────────

function MeritListTab({ exams, candidates, results }) {
  const [selectedExam, setSelectedExam] = useState('')
  const [cutoff, setCutoff] = useState('')

  const exam = exams.find(e => e.id === selectedExam)
  const examCandidates = candidates.filter(c => c.exam_id === selectedExam)

  const meritList = useMemo(() => {
    if (!selectedExam) return []
    return examCandidates
      .map(c => {
        const res = results.find(r => r.candidate_id === c.id)
        return { ...c, total_marks: res?.total_marks ?? null, result_status: res?.result_status || 'Pending', subject_scores: res?.subject_scores }
      })
      .filter(c => c.status === 'Appeared' && c.total_marks !== null)
      .sort((a, b) => b.total_marks - a.total_marks)
      .map((c, i) => ({ ...c, rank: i + 1 }))
  }, [selectedExam, examCandidates, results])

  const cutoffVal = cutoff ? Number(cutoff) : (exam?.passing_marks || 0)
  const qualified = meritList.filter(c => c.total_marks >= cutoffVal)
  const disqualified = meritList.filter(c => c.total_marks < cutoffVal)

  const handlePrint = () => {
    const rows = meritList.map(c => `<tr><td>${c.rank}</td><td>${hallTicketNo(exam.id, c.roll_number)}</td><td>${c.student_name}</td><td>${c.father_name || ''}</td><td>${c.total_marks}</td><td>${exam.total_marks > 0 ? ((c.total_marks / exam.total_marks) * 100).toFixed(1) : 0}%</td><td>${c.total_marks >= cutoffVal ? 'QUALIFIED' : 'NOT QUALIFIED'}</td></tr>`).join('')
    const html = `<html><head><title>Merit List</title><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#1e3a5f;color:#fff}</style></head><body><h2 style="font-family:serif">GNSI — Merit List: ${exam?.exam_name}</h2><p>Cutoff: ${cutoffVal} / ${exam?.total_marks} | Total qualified: ${qualified.length}</p><table><thead><tr><th>Rank</th><th>Roll No</th><th>Name</th><th>Father</th><th>Score</th><th>%</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...S.input, maxWidth: 320 }} value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">Select Exam</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
        {selectedExam && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Custom Cutoff:</label>
              <input type="number" style={{ ...S.input, width: 90 }} placeholder={exam?.passing_marks || 40} value={cutoff} onChange={e => setCutoff(e.target.value)} />
            </div>
            <button onClick={handlePrint} style={S.btn('#7c3aed')}>🖨️ Print Merit List</button>
          </>
        )}
      </div>

      {exam && meritList.length > 0 && (
        <>
          <div style={{ ...S.grid3, marginBottom: 20 }}>
            <StatCard label="Appeared" val={meritList.length} color="blue" icon="✍️" />
            <StatCard label="Qualified" val={qualified.length} color="green" icon="✅" sub={`≥ ${cutoffVal} marks`} />
            <StatCard label="Not Qualified" val={disqualified.length} color="red" icon="❌" />
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>🏆 Merit List — {exam.exam_name}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Rank', 'Roll No', 'Candidate', 'Father', 'Score', '%', 'Qualified'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {meritList.map(c => {
                  const pct = exam.total_marks > 0 ? ((c.total_marks / exam.total_marks) * 100).toFixed(1) : 0
                  const q = c.total_marks >= cutoffVal
                  return (
                    <tr key={c.id} style={{ background: c.rank <= 3 ? '#fffbeb' : q ? '#f0fdf4' : 'transparent' }}>
                      <td style={S.td}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.rank === 1 ? '#f59e0b' : c.rank === 2 ? '#94a3b8' : c.rank === 3 ? '#cd7c5a' : '#f1f5f9', color: c.rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                          {c.rank}
                        </div>
                      </td>
                      <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{hallTicketNo(exam.id, c.roll_number)}</span></td>
                      <td style={S.td}><div style={{ fontWeight: 600 }}>{c.student_name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.school}</div></td>
                      <td style={S.td}>{c.father_name || '—'}</td>
                      <td style={S.td}><span style={{ fontWeight: 800, fontSize: 16, color: q ? '#059669' : '#dc2626' }}>{c.total_marks}</span><span style={{ fontSize: 11, color: '#94a3b8' }}> / {exam.total_marks}</span></td>
                      <td style={S.td}><span style={{ fontWeight: 600 }}>{pct}%</span></td>
                      <td style={S.td}><span style={S.badge(q ? 'green' : 'red')}>{q ? '✓ Qualified' : '✕ Not Qualified'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedExam && meritList.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14 }}>No results entered yet. Go to Results tab to enter marks.</div>
        </div>
      )}
    </div>
  )
}

// ─── Admission Tab ────────────────────────────────────────────────────────────

function AdmissionTab({ exams, candidates, results, onRefresh }) {
  const [selectedExam, setSelectedExam] = useState('')
  const [saving, setSaving] = useState(null)

  const exam = exams.find(e => e.id === selectedExam)
  const examCandidates = candidates.filter(c => c.exam_id === selectedExam)

  const admissionList = useMemo(() => {
    return examCandidates.map(c => {
      const res = results.find(r => r.candidate_id === c.id)
      return { ...c, total_marks: res?.total_marks ?? null, result_status: res?.result_status || 'Pending', resultId: res?.id }
    }).filter(c => c.total_marks !== null).sort((a, b) => b.total_marks - a.total_marks)
  }, [examCandidates, results])

  const updateAdmission = async (candidateId, resultId, status) => {
    setSaving(candidateId)
    if (resultId) {
      await supabase.from('entrance_results').update({ result_status: status }).eq('id', resultId)
    }
    // Also update candidate status
    const newCandStatus = status === 'Admitted' ? 'Appeared' : 'Appeared'
    onRefresh()
    setSaving(null)
  }

  const admitted = admissionList.filter(c => c.result_status === 'Admitted').length
  const waitlist = admissionList.filter(c => c.result_status === 'Waitlist').length
  const rejected = admissionList.filter(c => c.result_status === 'Rejected').length

  const printAdmitList = () => {
    const rows = admissionList.filter(c => c.result_status === 'Admitted').map(c =>
      `<tr><td>${c.student_name}</td><td>${c.father_name || ''}</td><td>${c.total_marks}</td><td>${c.phone || ''}</td><td>ADMITTED</td></tr>`
    ).join('')
    const html = `<html><head><title>Admission List</title><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#1e3a5f;color:#fff}</style></head><body><h2>GNSI — Final Admission List: ${exam?.exam_name}</h2><p>Total Admitted: ${admitted}</p><table><thead><tr><th>Name</th><th>Father</th><th>Score</th><th>Phone</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...S.input, maxWidth: 320 }} value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">Select Exam</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
        </select>
        {exam && <button onClick={printAdmitList} style={S.btn('#059669')}>🖨️ Print Admission List</button>}
      </div>

      {exam && (
        <>
          <div style={{ ...S.grid4, marginBottom: 20 }}>
            <StatCard label="Total Qualified" val={admissionList.length} color="blue" icon="📋" />
            <StatCard label="Admitted" val={admitted} color="teal" icon="🎓" />
            <StatCard label="Waitlist" val={waitlist} color="orange" icon="⏳" />
            <StatCard label="Rejected" val={rejected} color="red" icon="✕" />
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e3a5f', marginBottom: 14 }}>🎓 Final Admission Decisions — {exam.exam_name}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Rank', 'Candidate', 'Score', 'Phone', 'Current Decision', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {admissionList.map((c, i) => (
                  <tr key={c.id} style={{ background: c.result_status === 'Admitted' ? '#f0fdf4' : c.result_status === 'Rejected' ? '#fef2f2' : c.result_status === 'Waitlist' ? '#fffbeb' : 'transparent' }}>
                    <td style={S.td}><span style={{ fontWeight: 700, color: '#64748b' }}>#{i + 1}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{c.student_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.father_name} · {c.school}</div>
                    </td>
                    <td style={S.td}><span style={{ fontWeight: 800, fontSize: 16, color: '#1e3a5f' }}>{c.total_marks}</span><span style={{ fontSize: 11, color: '#94a3b8' }}> / {exam.total_marks}</span></td>
                    <td style={S.td}>{c.phone ? <a href={`tel:${c.phone}`} style={{ color: '#2563eb' }}>{c.phone}</a> : '—'}</td>
                    <td style={S.td}><span style={S.badge(statusColor[c.result_status])}>{c.result_status}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={saving === c.id} onClick={() => updateAdmission(c.id, c.resultId, 'Admitted')} style={{ ...S.btn('#059669'), padding: '5px 10px', fontSize: 11, opacity: c.result_status === 'Admitted' ? 0.5 : 1 }}>✓ Admit</button>
                        <button disabled={saving === c.id} onClick={() => updateAdmission(c.id, c.resultId, 'Waitlist')} style={{ ...S.btn('#d97706'), padding: '5px 10px', fontSize: 11, opacity: c.result_status === 'Waitlist' ? 0.5 : 1 }}>⏳ Wait</button>
                        <button disabled={saving === c.id} onClick={() => updateAdmission(c.id, c.resultId, 'Rejected')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', opacity: c.result_status === 'Rejected' ? 0.5 : 1 }}>✕ Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admissionList.length === 0 && <tr><td colSpan="6" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No results available. Enter marks in Results tab first.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Entrance() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [exams, setExams] = useState([])
  const [candidates, setCandidates] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [timeline, setTimeline] = useState([])

  const fetchAll = useCallback(async () => {
    const fetchTimeline = useCallback(async () => {
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  setTimeline(data || [])
}, [])
    setLoading(true)
    const [examRes, candRes, resRes] = await Promise.all([
      supabase.from('entrance_exams').select('*').order('exam_date', { ascending: false }),
      supabase.from('entrance_candidates').select('*').order('roll_number'),
      supabase.from('entrance_results').select('*'),
    ])
    if (!examRes.error) setExams(examRes.data || [])
    if (!candRes.error) setCandidates(candRes.data || [])
    if (!resRes.error) setResults(resRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll(); fetchTimeline() }, [fetchAll, fetchTimeline])

  const tabStyle = (t) => ({
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: activeTab === t ? '#1e3a5f' : '#f1f5f9',
    color: activeTab === t ? '#fff' : '#475569',
    transition: 'all 0.15s',
  })

  return (
    <div className="entrance-root" style={S.wrap}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '26px', color: '#1e3a5f', fontWeight: '800', marginBottom: 4 }}>🎓 Entrance Examination</h1>
        <p style={{ color: '#64748b', fontSize: '13px' }}>Manage Sainik, Navodaya & Foundation entrance exams — scheduling, candidates, hall tickets, results, merit list & admissions</p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map(t => <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>{t}</button>)}
        <button onClick={fetchAll} style={{ ...S.ghost, marginLeft: 'auto' }} title="Refresh">↻ Refresh</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</div>}

      {!loading && (
        <>
          {activeTab === 'Dashboard' && <Dashboard exams={exams} candidates={candidates} results={results} />}
          {activeTab === 'Exams' && <ExamsTab exams={exams} candidates={candidates} onRefresh={fetchAll} />}
          {activeTab === 'Candidates' && <CandidatesTab exams={exams} candidates={candidates} onRefresh={fetchAll} />}
          {activeTab === 'Hall Tickets' && <HallTicketsTab exams={exams} candidates={candidates} />}
          {activeTab === 'Answer Key' && <AnswerKeyTab exams={exams} onRefresh={fetchAll} />}
          {activeTab === 'Results' && <ResultsTab exams={exams} candidates={candidates} results={results} onRefresh={fetchAll} />}
          {activeTab === 'Merit List' && <MeritListTab exams={exams} candidates={candidates} results={results} />}
          {activeTab === 'Admission' && <AdmissionTab exams={exams} candidates={candidates} results={results} onRefresh={fetchAll} />}
          {activeTab === 'Timeline' && (
  <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
    <div style={{fontWeight:800,fontSize:16,color:'#1e3a5f',marginBottom:16}}>🕐 Activity Timeline</div>
    {timeline.length===0
      ? <div style={{textAlign:'center',padding:48,color:'#94a3b8'}}>No activity recorded yet.</div>
      : timeline.map((log,i)=>{
          const actionColor={insert:'#059669',update:'#d97706',delete:'#dc2626',restore:'#7c3aed',bulk_delete:'#dc2626'}[log.action]||'#64748b'
          const actionIcon={insert:'➕',update:'✏️',delete:'🗑',restore:'↩️',bulk_delete:'🗑'}[log.action]||'•'
          return(
            <div key={i} style={{display:'flex',gap:14,paddingBottom:16,borderBottom:'1px solid #f1f5f9',marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:'50%',backgroundColor:actionColor+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{actionIcon}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:13,color:'#1e293b',textTransform:'capitalize'}}>{log.action.replace('_',' ')}</span>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):''}</span>
                </div>
                <div style={{fontSize:12,color:'#64748b',marginTop:2}}>By <strong style={{color:actionColor}}>{log.changed_by||'system'}</strong>{log.target_id?` · ID: ${log.target_id}`:''}</div>
                {log.new_values&&<div style={{fontSize:11,color:'#94a3b8',marginTop:4,fontFamily:'monospace',background:'#f8fafc',padding:'4px 8px',borderRadius:4,maxWidth:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.new_values}</div>}
              </div>
            </div>
          )
        })
    }
  </div>
)}
        </>
      )}
    </div>
  )
}
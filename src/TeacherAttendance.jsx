import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { BATCHES, TIMETABLE_ROWS, flattenPeriods } from './timetableData'

// ─── shared styles (mirrors HR.jsx conventions) ───────────────────────────

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

const todayISO = () => new Date().toISOString().slice(0, 10)

const STATUS_META = {
  present:     { label: 'Present',    bg: '#dcfce7', color: '#16a34a', icon: '✅' },
  absent:      { label: 'Absent',     bg: '#fee2e2', color: '#dc2626', icon: '❌' },
  late:        { label: 'Late',       bg: '#fef9c3', color: '#ca8a04', icon: '⏰' },
  substitute:  { label: 'Substitute', bg: '#eff6ff', color: '#2563eb', icon: '🔁' },
}

// ─── 1. Teacher Attendance (period-level, from the timetable grid) ────────

function PeriodAttendance({ staff, showToast }) {
  const [date, setDate] = useState(todayISO())
  const [batchFilter, setBatchFilter] = useState('all')
  const [records, setRecords] = useState({}) // key: batch|from|to|teacher -> row
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const periods = useMemo(() => flattenPeriods(), [])

  const keyOf = (p) => `${p.batch}|${p.period_from}|${p.period_to}|${p.teacher_name}`

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('period_attendance')
      .select('*')
      .eq('attendance_date', date)
    if (!error) {
      const map = {}
      for (const r of data || []) {
        map[`${r.batch}|${r.period_from}|${r.period_to}|${r.teacher_name}`] = r
      }
      setRecords(map)
    }
    setLoading(false)
  }, [date])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  const matchStaff = (teacherName) => {
    // Best-effort match "Sir Himan" / "Madam Sandhya" -> staff_profiles.name containing that token
    const token = teacherName.replace(/^(Sir|Madam)\s+/i, '').trim().toLowerCase()
    return staff.find(s => s.name?.toLowerCase().includes(token))
  }

  const setStatus = async (p, status) => {
    const k = keyOf(p)
    setSaving(k)
    const existing = records[k]
    const matched = matchStaff(p.teacher_name)
    const payload = {
      attendance_date: date,
      batch: p.batch,
      period_from: p.period_from,
      period_to: p.period_to,
      subject: p.subject,
      teacher_name: p.teacher_name,
      staff_id: matched?.id || null,
      status,
    }
    const { data, error } = existing
      ? await supabase.from('period_attendance').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('period_attendance').insert([payload]).select().single()

    if (error) {
      showToast('Could not save attendance: ' + error.message)
    } else {
      setRecords(prev => ({ ...prev, [k]: data }))
      EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { change: 'period_attendance', batch: p.batch, teacher: p.teacher_name, status })
    }
    setSaving(null)
  }

  const setSubstitute = async (p, substituteName) => {
    const k = keyOf(p)
    const existing = records[k]
    const subStaff = staff.find(s => String(s.id) === String(substituteName))
    if (!existing) {
      showToast('Mark a status first, then assign substitute.')
      return
    }
    const { data, error } = await supabase
      .from('period_attendance')
      .update({ status: 'substitute', substitute_staff_id: subStaff?.id || null, substitute_teacher_name: subStaff?.name || null })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) showToast('Could not assign substitute: ' + error.message)
    else setRecords(prev => ({ ...prev, [k]: data }))
  }

  const filteredPeriods = batchFilter === 'all' ? periods : periods.filter(p => p.batch === batchFilter)

  const summary = useMemo(() => {
    const list = filteredPeriods.map(p => records[keyOf(p)]).filter(Boolean)
    return {
      total: filteredPeriods.length,
      marked: list.length,
      present: list.filter(r => r.status === 'present').length,
      absent: list.filter(r => r.status === 'absent').length,
      substitute: list.filter(r => r.status === 'substitute').length,
    }
  }, [filteredPeriods, records])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="🧑‍🏫"
        title="Teacher Attendance"
        subtitle="Mark attendance against each timetable period"
        action={
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }} />
        }
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button onClick={() => setBatchFilter('all')}
          style={{ padding: '6px 12px', borderRadius: '999px', border: `1.5px solid ${batchFilter === 'all' ? '#1e3a5f' : 'transparent'}`, backgroundColor: batchFilter === 'all' ? '#f8fafc' : 'transparent', color: '#1e3a5f', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All Batches
        </button>
        {BATCHES.map(b => (
          <button key={b.name} onClick={() => setBatchFilter(b.name)}
            style={{ padding: '6px 12px', borderRadius: '999px', border: `1.5px solid ${batchFilter === b.name ? b.color : 'transparent'}`, backgroundColor: batchFilter === b.name ? '#f8fafc' : 'transparent', color: b.color, fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {b.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'Total', value: summary.total, color: '#374151' },
          { label: 'Present', value: summary.present, color: '#16a34a' },
          { label: 'Absent', value: summary.absent, color: '#dc2626' },
          { label: 'Substitute', value: summary.substitute, color: '#2563eb' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '16px' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPeriods.map(p => {
            const k = keyOf(p)
            const rec = records[k]
            const batchMeta = BATCHES.find(b => b.name === p.batch)
            return (
              <div key={k} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: batchMeta?.light || '#f8fafc', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{p.subject}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#374151' }}>{p.teacher_name} · <span style={{ fontWeight: '700', color: batchMeta?.color }}>{p.batch}</span></p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{p.period_from} – {p.period_to}</p>
                    </div>
                    {rec && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: STATUS_META[rec.status].color, backgroundColor: STATUS_META[rec.status].bg, padding: '4px 10px', borderRadius: '999px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {STATUS_META[rec.status].icon} {STATUS_META[rec.status].label}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_META).map(([key, meta]) => (
                      <button key={key} disabled={saving === k} onClick={() => setStatus(p, key)}
                        style={{
                          padding: '6px 10px', borderRadius: '7px', border: `1.5px solid ${rec?.status === key ? meta.color : '#d1d5db'}`,
                          backgroundColor: rec?.status === key ? meta.bg : 'white', color: rec?.status === key ? meta.color : '#374151',
                          fontSize: '11px', fontWeight: '600', cursor: saving === k ? 'wait' : 'pointer',
                        }}>
                        {meta.icon} {meta.label}
                      </button>
                    ))}
                  </div>

                  {rec?.status === 'substitute' && (
                    <div style={{ marginTop: '8px' }}>
                      <select
                        value={rec.substitute_staff_id || ''}
                        onChange={e => setSubstitute(p, e.target.value)}
                        style={{ ...styles.select, fontSize: '12px', padding: '7px 10px' }}>
                        <option value="">Assign substitute teacher...</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {rec.substitute_teacher_name && (
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#2563eb' }}>🔁 Covering: {rec.substitute_teacher_name}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {filteredPeriods.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>No periods for this filter</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 2. Doubt Log ───────────────────────────────────────────────────────────
// Uses the EXISTING doubt_sessions table (per-student doubt log, not slot scheduling):
// student_name, batch_name, subject, topic, raised_date, resolved_date, status,
// teacher_name, teacher_staff_id, hm_name, hm_id (uuid, from a separate
// housemasters_auth-style table — not FK'd here), resolution_note, doubt_date,
// doubt_time_slot, teacher_instructions, key_concepts, etc.

const DOUBT_STATUS_META = {
  open:      { label: 'Open',      bg: '#fee2e2', color: '#dc2626' },
  reviewing: { label: 'Reviewing', bg: '#fef9c3', color: '#ca8a04' },
  resolved:  { label: 'Resolved',  bg: '#dcfce7', color: '#16a34a' },
}

function DoubtSessions({ staff, showToast }) {
  const [date, setDate] = useState(todayISO())
  const [batchFilter, setBatchFilter] = useState('all')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    student_name: '', batch_name: BATCHES[0].name, subject: '', topic: '',
    staff_id: '', doubt_time_slot: '', teacher_instructions: '',
  })
  const [saving, setSaving] = useState(false)
  const [resolveNote, setResolveNote] = useState({}) // id -> note text

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('doubt_sessions')
      .select('*')
      .eq('doubt_date', date)
      .order('created_at', { ascending: false })
    if (!error) setEntries(data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const filtered = batchFilter === 'all' ? entries : entries.filter(e => e.batch_name === batchFilter)

  const logDoubt = async () => {
    if (!form.student_name || !form.batch_name || !form.topic) {
      showToast('Student name, batch, and topic are required.')
      return
    }
    setSaving(true)
    const teacher = staff.find(s => String(s.id) === String(form.staff_id))
    const { error } = await supabase.from('doubt_sessions').insert([{
      student_name: form.student_name,
      batch_name: form.batch_name,
      subject: form.subject || null,
      topic: form.topic,
      doubt_date: date,
      raised_date: date,
      doubt_time_slot: form.doubt_time_slot || null,
      teacher_name: teacher?.name || null,
      teacher_staff_id: teacher?.id || null,
      teacher_instructions: form.teacher_instructions || null,
      status: 'open',
    }])
    if (error) {
      showToast('Could not log doubt: ' + error.message)
    } else {
      showToast('Doubt logged!', 'success')
      setForm({ student_name: '', batch_name: BATCHES[0].name, subject: '', topic: '', staff_id: '', doubt_time_slot: '', teacher_instructions: '' })
      fetchEntries()
    }
    setSaving(false)
  }

  const setStatus = async (entry, status) => {
    const payload = { status }
    if (status === 'resolved') {
      payload.resolved_date = todayISO()
      payload.resolution_note = resolveNote[entry.id] || null
    }
    const { error } = await supabase.from('doubt_sessions').update(payload).eq('id', entry.id)
    if (error) showToast('Update failed: ' + error.message)
    else fetchEntries()
  }

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="❓"
        title="Doubt Log"
        subtitle="Log, track, and resolve student doubts"
        action={
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }} />
        }
      />

      <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px dashed #cbd5e1' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Log New Doubt</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))}
            placeholder="Student name *" style={styles.input} />
          <select value={form.batch_name} onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))} style={styles.select}>
            {BATCHES.map(b => <option key={b.name} value={b.name}>{b.name} ({b.sub})</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject" style={styles.input} />
            <input value={form.doubt_time_slot} onChange={e => setForm(f => ({ ...f, doubt_time_slot: e.target.value }))}
              placeholder="Time slot (e.g. 4:00 PM)" style={styles.input} />
          </div>
          <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
            placeholder="Topic / doubt *" style={styles.input} />
          <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} style={styles.select}>
            <option value="">Assign teacher (optional)...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={form.teacher_instructions} onChange={e => setForm(f => ({ ...f, teacher_instructions: e.target.value }))}
            placeholder="Notes for teacher (optional)" style={styles.input} />
          <button onClick={logDoubt} disabled={saving} style={styles.btn(!saving)}>
            {saving ? '⏳ Logging...' : '➕ Log Doubt'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button onClick={() => setBatchFilter('all')}
          style={{ padding: '6px 12px', borderRadius: '999px', border: `1.5px solid ${batchFilter === 'all' ? '#1e3a5f' : 'transparent'}`, backgroundColor: batchFilter === 'all' ? '#f8fafc' : 'transparent', color: '#1e3a5f', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All Batches
        </button>
        {BATCHES.map(b => (
          <button key={b.name} onClick={() => setBatchFilter(b.name)}
            style={{ padding: '6px 12px', borderRadius: '999px', border: `1.5px solid ${batchFilter === b.name ? b.color : 'transparent'}`, backgroundColor: batchFilter === b.name ? '#f8fafc' : 'transparent', color: b.color, fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {b.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '16px' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(e => {
            const batchMeta = BATCHES.find(b => b.name === e.batch_name)
            const status = DOUBT_STATUS_META[e.status] || DOUBT_STATUS_META.open
            return (
              <div key={e.id} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: batchMeta?.light || '#f8fafc', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                      {e.student_name} · <span style={{ color: batchMeta?.color }}>{e.batch_name}</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#374151' }}>{e.subject ? `${e.subject} — ` : ''}{e.topic}</p>
                    {e.doubt_time_slot && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>🕐 {e.doubt_time_slot}</p>}
                    {e.teacher_name && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>👤 {e.teacher_name}</p>}
                    {e.hm_name && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>🏠 HM: {e.hm_name}</p>}
                    {e.resolution_note && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#16a34a' }}>✅ {e.resolution_note}</p>}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: status.color, backgroundColor: status.bg, padding: '4px 10px', borderRadius: '999px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                </div>

                {e.status !== 'resolved' && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      {e.status !== 'reviewing' && (
                        <button onClick={() => setStatus(e, 'reviewing')}
                          style={{ padding: '6px 10px', borderRadius: '7px', border: 'none', backgroundColor: '#fef9c3', color: '#ca8a04', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                          👀 Mark Reviewing
                        </button>
                      )}
                    </div>
                    <input
                      value={resolveNote[e.id] || ''}
                      onChange={ev => setResolveNote(prev => ({ ...prev, [e.id]: ev.target.value }))}
                      placeholder="Resolution note..."
                      style={{ ...styles.input, fontSize: '12px', padding: '7px 10px', marginBottom: '6px' }}
                    />
                    <button onClick={() => setStatus(e, 'resolved')}
                      style={{ padding: '6px 10px', borderRadius: '7px', border: 'none', backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      ✅ Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>No doubts logged for this date</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 3. House Master Duty Assigner ─────────────────────────────────────────
// Pulls from the EXISTING `housemasters` table (id uuid, name, house, phone, staff_profile_id)

function HouseMasterAssigner({ showToast }) {
  const [date, setDate] = useState(todayISO())
  const [housemasters, setHousemasters] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ housemaster_id: '', period_from: '', period_to: '', batch: '', duty_type: 'general', notes: '' })
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: hmData }, { data: dutyData }] = await Promise.all([
      supabase.from('housemasters').select('id, name, house, phone, staff_profile_id, status').order('name'),
      supabase.from('housemaster_duty_assignments').select('*, housemasters(name, house)').eq('duty_date', date).order('period_from'),
    ])
    setHousemasters(hmData || [])
    setAssignments(dutyData || [])
    setLoading(false)
  }, [date])

  useEffect(() => { fetchAll() }, [fetchAll])

  const assign = async () => {
    if (!form.housemaster_id || !form.period_from || !form.period_to) {
      showToast('House master, period start, and period end are required.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('housemaster_duty_assignments').insert([{
      duty_date: date,
      housemaster_id: form.housemaster_id,
      period_from: form.period_from,
      period_to: form.period_to,
      batch: form.batch || null,
      duty_type: form.duty_type,
      notes: form.notes || null,
    }])
    if (error) {
      showToast('Could not assign duty: ' + error.message)
    } else {
      showToast('House master duty assigned!', 'success')
      setForm({ housemaster_id: '', period_from: '', period_to: '', batch: '', duty_type: 'general', notes: '' })
      fetchAll()
    }
    setSaving(false)
  }

  const removeAssignment = async (id) => {
    const { error } = await supabase.from('housemaster_duty_assignments').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message)
    else fetchAll()
  }

  const dutyTypeLabel = { general: 'General Duty', doubt_session: 'Doubt Session', evening_study: 'Evening Study', roll_call: 'Roll Call' }
  const dutyTypeColor = { general: '#374151', doubt_session: '#2563eb', evening_study: '#6A2C70', roll_call: '#A05A00' }

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="🏠"
        title="House Master Duty Assigner"
        subtitle="Assign house masters to periods, doubt sessions & duties"
        action={
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }} />
        }
      />

      <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px dashed #cbd5e1' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>New Duty Assignment</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select value={form.housemaster_id} onChange={e => setForm(f => ({ ...f, housemaster_id: e.target.value }))} style={styles.select}>
            <option value="">Select House Master *</option>
            {housemasters.filter(h => h.status !== 'inactive').map(h => <option key={h.id} value={h.id}>{h.name} — {h.house}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))}
              placeholder="From (e.g. 6:00 PM)" style={styles.input} />
            <input value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))}
              placeholder="To (e.g. 7:00 PM)" style={styles.input} />
          </div>
          <select value={form.duty_type} onChange={e => setForm(f => ({ ...f, duty_type: e.target.value }))} style={styles.select}>
            <option value="general">General Duty</option>
            <option value="doubt_session">Doubt Session</option>
            <option value="evening_study">Evening Study</option>
            <option value="roll_call">Roll Call</option>
          </select>
          <input value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
            placeholder="Batch / wing (optional)" style={styles.input} />
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" style={styles.input} />
          <button onClick={assign} disabled={saving} style={styles.btn(!saving)}>
            {saving ? '⏳ Assigning...' : '🏠 Assign Duty'}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '16px' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {assignments.map(a => (
            <div key={a.id} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{a.housemasters?.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{a.housemasters?.house}{a.batch ? ` · ${a.batch}` : ''}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#374151' }}>{a.period_from} – {a.period_to}</p>
                  {a.notes && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>{a.notes}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: dutyTypeColor[a.duty_type], backgroundColor: 'white', padding: '4px 10px', borderRadius: '999px', border: `1px solid ${dutyTypeColor[a.duty_type]}33`, whiteSpace: 'nowrap' }}>
                    {dutyTypeLabel[a.duty_type]}
                  </span>
                  <button onClick={() => removeAssignment(a.id)}
                    style={{ fontSize: '11px', color: '#dc2626', border: 'none', backgroundColor: '#fee2e2', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                    🗑 Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {assignments.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>No house master duties assigned for this date</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Export — combined Attendance tab for HR.jsx ─────────────────────

export default function TeacherAttendance({ staff }) {
  const [tab, setTab] = useState('attendance')
  const { show: showToast, ToastEl } = useToast()

  const tabs = [
    { key: 'attendance', label: '🧑‍🏫', full: 'Attendance' },
    { key: 'doubt',      label: '❓',    full: 'Doubt Sessions' },
    { key: 'housemaster',label: '🏠',    full: 'House Master' },
  ]

  return (
    <div>
      {ToastEl}
      <div style={{ overflowX: 'auto', marginBottom: '12px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '12px', width: 'max-content', minWidth: '100%' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
                backgroundColor: tab === t.key ? 'white' : 'transparent',
                color: tab === t.key ? '#1e3a5f' : '#64748b',
                boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {t.label} {t.full}
            </button>
          ))}
        </div>
      </div>

      {tab === 'attendance'  && <PeriodAttendance staff={staff} showToast={showToast} />}
      {tab === 'doubt'       && <DoubtSessions staff={staff} showToast={showToast} />}
      {tab === 'housemaster' && <HouseMasterAssigner showToast={showToast} />}
    </div>
  )
}
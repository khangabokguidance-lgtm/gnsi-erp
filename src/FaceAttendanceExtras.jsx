// FaceAttendanceExtras.jsx — additional PagarBook-style views for
// FaceAttendance.jsx: Attendance summary (with manual P/HD/AB marking),
// Reports, Broadcast Messages, and Notifications.
//
// AttendanceSummaryView writes to the new staff_attendance_marks table
// (separate from staff_geo_attendance, which stays GPS/face check-in only).
// Reports reads across existing tables. Broadcasts/Notifications use the
// new staff_broadcasts / staff_notifications tables.

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

const S = {
  card: { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 20, marginBottom: 16 },
  input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' },
  inputFull: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', background: '#f8fafc' },
  td: { padding: '10px 12px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },
  tab: (active) => ({
    padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
    background: 'none', border: 'none', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${active ? '#0B1E3D' : 'transparent'}`,
    color: active ? '#0B1E3D' : '#64748b',
  }),
  pill: (active) => ({
    padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? '#0B1E3D' : '#d1d5db'}`,
    background: active ? '#0B1E3D' : 'white', color: active ? 'white' : '#374151',
  }),
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const isoDate = (d) => d.toISOString().slice(0, 10)
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

// ─── Attendance summary — daily overview + manual P/HD/AB/Leave marking ────

const MARK_META = {
  Present:   { label: 'P',  color: '#16a34a', bg: '#dcfce7' },
  'Half Day':{ label: 'HD', color: '#ca8a04', bg: '#fef9c3' },
  Absent:    { label: 'AB', color: '#dc2626', bg: '#fee2e2' },
  Leave:     { label: 'L',  color: '#2563eb', bg: '#dbeafe' },
}

export function AttendanceSummaryView({ isAdmin, staffList, showToast }) {
  const [date, setDate] = useState(isoDate(new Date()))
  const [search, setSearch] = useState('')
  const [geoRows, setGeoRows] = useState([])
  const [marks, setMarks] = useState({}) // staff_id -> mark row
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const fetchDay = useCallback(async () => {
    setLoading(true)
    const [{ data: geo }, { data: markRows }] = await Promise.all([
      supabase.from('staff_geo_attendance').select('staff_id, late_minutes, status, check_in_time, check_out_time').eq('date', date),
      supabase.from('staff_attendance_marks').select('*').eq('date', date),
    ])
    setGeoRows(geo || [])
    const m = {}
    for (const r of markRows || []) m[r.staff_id] = r
    setMarks(m)
    setLoading(false)
  }, [date])

  useEffect(() => { fetchDay() }, [fetchDay])

  const geoByStaff = useMemo(() => {
    const m = {}
    for (const r of geoRows) m[r.staff_id] = r
    return m
  }, [geoRows])

  const summary = useMemo(() => {
    const counts = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0 }
    let totalLateMin = 0
    let punchIn = 0, punchOut = 0
    for (const s of staffList) {
      const mark = marks[s.id]
      const geo = geoByStaff[s.id]
      if (mark) counts[mark.status] = (counts[mark.status] || 0) + 1
      else if (geo) counts.Present += 1
      if (geo) {
        totalLateMin += geo.late_minutes || 0
        if (geo.check_in_time) punchIn += 1
        if (geo.check_out_time) punchOut += 1
      }
    }
    return { ...counts, fineMinutes: totalLateMin, punchIn, punchOut }
  }, [staffList, marks, geoByStaff])

  const setMark = async (staffId, status) => {
    setSavingId(staffId)
    const { error } = await supabase.from('staff_attendance_marks').upsert(
      { staff_id: staffId, date, status, updated_at: new Date().toISOString() },
      { onConflict: 'staff_id,date' }
    )
    if (error) showToast?.('Could not save: ' + error.message, 'err')
    else { showToast?.(`Marked ${status}`, 'ok'); fetchDay() }
    setSavingId(null)
  }

  const filteredStaff = staffList.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))
  const unmarked = filteredStaff.filter(s => !marks[s.id] && !geoByStaff[s.id])
  const marked = filteredStaff.filter(s => marks[s.id] || geoByStaff[s.id])

  const shiftDate = (deltaDays) => {
    const d = new Date(date)
    d.setDate(d.getDate() + deltaDays)
    setDate(isoDate(d))
  }

  return (
    <div>
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <button onClick={() => shiftDate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748b' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0B1E3D' }}>{fmtDate(date)}</div>
        <button onClick={() => shiftDate(1)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748b' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 4 }}>
        {[
          { label: 'Present', value: summary.Present, color: '#16a34a' },
          { label: 'Absent', value: summary.Absent, color: '#dc2626' },
          { label: 'Half day', value: summary['Half Day'], color: '#ca8a04' },
          { label: 'Leave', value: summary.Leave, color: '#2563eb' },
          { label: 'Fine (min)', value: summary.fineMinutes, color: '#b45309' },
          { label: 'Punch in', value: summary.punchIn, color: '#0B1E3D' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 10, padding: 12, boxShadow: '0 2px 6px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 16 }} />

      {isAdmin && (
        <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
      ) : (
        <>
          {unmarked.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Not marked ({unmarked.length})</div>
              {unmarked.map(s => (
                <StaffMarkRow key={s.id} staff={s} mark={null} onMark={setMark} saving={savingId === s.id} disabled={!isAdmin} />
              ))}
            </div>
          )}
          {marked.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Marked ({marked.length})</div>
              {marked.map(s => (
                <StaffMarkRow key={s.id} staff={s} mark={marks[s.id]} geo={geoByStaff[s.id]} onMark={setMark} saving={savingId === s.id} disabled={!isAdmin} />
              ))}
            </div>
          )}
          {!filteredStaff.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No staff found.</p>}
        </>
      )}
    </div>
  )
}

function StaffMarkRow({ staff, mark, geo, onMark, saving, disabled }) {
  const currentStatus = mark?.status || (geo ? 'Present' : null)
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{staff.name}</div>
        <div style={{ fontSize: 11, color: currentStatus ? '#94a3b8' : '#dc2626', fontWeight: 600 }}>
          {geo ? `In ${geo.check_in_time ? new Date(geo.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}` : currentStatus || 'Not marked'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Object.entries(MARK_META).map(([status, meta]) => (
          <button key={status} disabled={disabled || saving} onClick={() => onMark(staff.id, status)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${currentStatus === status ? meta.color : '#e2e8f0'}`,
              background: currentStatus === status ? meta.bg : 'white',
              color: currentStatus === status ? meta.color : '#94a3b8',
            }}>
            {meta.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Reports — drill-down list into existing data ──────────────────────────

const REPORT_DEFS = [
  { key: 'attendance', title: 'Attendance report', subtitle: 'Staff-level summary for the selected month' },
  { key: 'payroll',    title: 'Staff payroll report', subtitle: 'Complete payroll report of all staff' },
  { key: 'advances',   title: 'Payment logs report', subtitle: 'Advance issue and repayment logs' },
  { key: 'fines',      title: 'Fines report', subtitle: 'Late check-ins and fine minutes by staff' },
]

export function ReportsView({ isAdmin, staffList }) {
  const [openReport, setOpenReport] = useState(null)
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const runReport = useCallback(async (key) => {
    setLoading(true)
    setOpenReport(key)
    if (key === 'attendance') {
      const { data } = await supabase.from('staff_geo_attendance').select('staff_id, date, status, late_minutes, staff_profiles(name)').gte('date', `${month}-01`).lte('date', `${month}-31`)
      const byStaff = {}
      for (const r of data || []) {
        const id = r.staff_id
        byStaff[id] = byStaff[id] || { name: r.staff_profiles?.name, present: 0, late: 0 }
        byStaff[id].present += 1
        if ((r.late_minutes || 0) > 0) byStaff[id].late += 1
      }
      setRows(Object.values(byStaff))
    } else if (key === 'payroll') {
      const { data } = await supabase.from('salary').select('staff_id, net_salary, status, staff_profiles(name)').eq('month', month)
      setRows((data || []).map(r => ({ name: r.staff_profiles?.name, net: r.net_salary, status: r.status })))
    } else if (key === 'advances') {
      const { data } = await supabase.from('staff_advances').select('amount, repaid_amount, issued_month, status, staff_profiles(name)').eq('issued_month', month)
      setRows((data || []).map(r => ({ name: r.staff_profiles?.name, amount: r.amount, repaid: r.repaid_amount, status: r.status })))
    } else if (key === 'fines') {
      const { data } = await supabase.from('staff_geo_attendance').select('staff_id, late_minutes, staff_profiles(name)').gte('date', `${month}-01`).lte('date', `${month}-31`).gt('late_minutes', 0)
      const byStaff = {}
      for (const r of data || []) {
        const id = r.staff_id
        byStaff[id] = byStaff[id] || { name: r.staff_profiles?.name, instances: 0, minutes: 0 }
        byStaff[id].instances += 1
        byStaff[id].minutes += r.late_minutes || 0
      }
      setRows(Object.values(byStaff))
    }
    setLoading(false)
  }, [month])

  if (!isAdmin) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Reports are available to admins.</p>

  if (!openReport) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REPORT_DEFS.map(r => (
          <button key={r.key} onClick={() => runReport(r.key)} style={{ ...S.card, marginBottom: 0, textAlign: 'left', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{r.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{r.subtitle}</div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>
    )
  }

  const def = REPORT_DEFS.find(r => r.key === openReport)
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => setOpenReport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#0B1E3D' }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0B1E3D' }}>{def.title}</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...S.input, marginLeft: 'auto' }} />
      </div>
      <div style={S.card}>
        {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {openReport === 'attendance' && ['Staff', 'Present days', 'Late instances'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  {openReport === 'payroll' && ['Staff', 'Net salary', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  {openReport === 'advances' && ['Staff', 'Amount', 'Repaid', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  {openReport === 'fines' && ['Staff', 'Late instances', 'Total minutes'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={S.td}>{r.name || '—'}</td>
                    {openReport === 'attendance' && <><td style={S.td}>{r.present}</td><td style={S.td}>{r.late}</td></>}
                    {openReport === 'payroll' && <><td style={S.td}>₹{Math.round(r.net || 0).toLocaleString('en-IN')}</td><td style={S.td}>{r.status}</td></>}
                    {openReport === 'advances' && <><td style={S.td}>₹{r.amount}</td><td style={S.td}>₹{r.repaid}</td><td style={S.td}>{r.status}</td></>}
                    {openReport === 'fines' && <><td style={S.td}>{r.instances}</td><td style={S.td}>{r.minutes} min</td></>}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan="4" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No data for this month.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Broadcast Messages ─────────────────────────────────────────────────────

export function BroadcastView({ isAdmin, currentAdminId, showToast }) {
  const [tab, setTab] = useState('history') // history | drafts | scheduled
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })
  const [sending, setSending] = useState(false)

  const statusFor = { history: 'sent', drafts: 'draft', scheduled: 'scheduled' }[tab]

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('staff_broadcasts').select('*').eq('status', statusFor).order('created_at', { ascending: false })
    if (!error) setBroadcasts(data || [])
    setLoading(false)
  }, [statusFor])

  useEffect(() => { fetchBroadcasts() }, [fetchBroadcasts])

  const send = async () => {
    if (!form.title.trim() || !form.body.trim()) { showToast?.('Enter a title and message', 'err'); return }
    setSending(true)
    const { error } = await supabase.from('staff_broadcasts').insert([{
      title: form.title.trim(), body: form.body.trim(), audience: 'all',
      status: 'sent', sent_at: new Date().toISOString(), created_by: currentAdminId,
    }])
    if (error) showToast?.('Could not send: ' + error.message, 'err')
    else { showToast?.('Broadcast sent', 'ok'); setForm({ title: '', body: '' }); setComposing(false); setTab('history'); fetchBroadcasts() }
    setSending(false)
  }

  if (!isAdmin) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Broadcasts are sent by admins.</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        {['history', 'drafts', 'scheduled'].map(k => (
          <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
        ))}
      </div>

      {composing ? (
        <div style={S.card}>
          <input style={{ ...S.inputFull, marginBottom: 10 }} placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea style={{ ...S.inputFull, minHeight: 100, resize: 'vertical' }} placeholder="Write your message to all staff…" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setComposing(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={send} disabled={sending} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              {sending ? 'Sending…' : 'Send to all staff'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {loading ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {broadcasts.map(b => (
                <div key={b.id} style={S.card}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{b.title}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{b.body}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{new Date(b.created_at).toLocaleString('en-IN')}</div>
                </div>
              ))}
              {!broadcasts.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No broadcasts yet.</p>}
            </div>
          )}
          <button onClick={() => setComposing(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Create broadcast
          </button>
        </>
      )}
    </div>
  )
}

// ─── Notifications ──────────────────────────────────────────────────────────

export function NotificationsView({ staffId, isAdmin }) {
  const [tab, setTab] = useState('all')
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('staff_notifications').select('*').order('created_at', { ascending: false })
    if (!isAdmin && staffId) q = q.or(`staff_id.eq.${staffId},staff_id.is.null`)
    if (tab === 'all') q = q.eq('is_read', false)
    else q = q.eq('is_read', true)
    const { data, error } = await q
    if (!error) setRows(data || [])
    setLoading(false)
  }, [tab, isAdmin, staffId])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markRead = async (id) => {
    await supabase.from('staff_notifications').update({ is_read: true }).eq('id', id)
    fetchNotifications()
  }

  const filtered = rows.filter(r => !search || r.title?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
        <button style={S.tab(tab === 'all')} onClick={() => setTab('all')}>All</button>
        <button style={S.tab(tab === 'cleared')} onClick={() => setTab('cleared')}>Cleared</button>
      </div>
      <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search notifications" value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(n => (
            <div key={n.id} style={{ ...S.card, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{new Date(n.created_at).toLocaleString('en-IN')}</div>
              </div>
              {tab === 'all' && (
                <button onClick={() => markRead(n.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Clear</button>
              )}
            </div>
          ))}
          {!filtered.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>{tab === 'all' ? 'No notifications yet.' : 'No cleared notifications.'}</p>}
        </div>
      )}
    </div>
  )
}
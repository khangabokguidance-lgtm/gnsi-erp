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

export function AttendanceSummaryView({ isAdmin, staffId, staffList, showToast, onNavigate, currentUsername }) {
  return isAdmin
    ? <AdminAttendanceRoster staffList={staffList} showToast={showToast} onNavigate={onNavigate} currentUsername={currentUsername} />
    : <MyAttendanceHistory staffId={staffId} />
}

// ─── My Attendance History — what a logged-in staff member sees ───────────
// Read-only, scoped to their own staff_id only. No other staff member's
// name, status, or check-in time is fetched or rendered here — replaces
// the old behaviour where every staff account saw the full roster (with
// disabled mark buttons) for all other staff, which leaked everyone's
// daily attendance status to anyone logged in.

function MyAttendanceHistory({ staffId }) {
  const todayIso = isoDate(new Date())
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d) })
  const [toDate, setToDate] = useState(todayIso)
  const [geoRows, setGeoRows] = useState([])
  const [markRows, setMarkRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMine = useCallback(async () => {
    if (!staffId) { setLoading(false); return }
    if (fromDate > toDate) { setLoading(false); return }
    setLoading(true)
    const [{ data: geo }, { data: marks }] = await Promise.all([
      supabase.from('staff_geo_attendance')
        .select('date, status, late_minutes, check_in_time, check_out_time')
        .eq('staff_id', staffId)
        .gte('date', fromDate).lte('date', toDate),
      supabase.from('staff_attendance_marks')
        .select('date, status')
        .eq('staff_id', staffId)
        .gte('date', fromDate).lte('date', toDate),
    ])
    setGeoRows(geo || [])
    setMarkRows(marks || [])
    setLoading(false)
  }, [staffId, fromDate, toDate])

  useEffect(() => { fetchMine() }, [fetchMine])

  const days = useMemo(() => {
    const byDate = {}
    for (const r of geoRows) byDate[r.date] = { ...byDate[r.date], geo: r }
    for (const r of markRows) byDate[r.date] = { ...byDate[r.date], mark: r }
    return Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [geoRows, markRows])

  const summary = useMemo(() => {
    const counts = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0 }
    let fineMinutes = 0
    for (const d of days) {
      // BUGFIX: use the geo row's real status instead of hardcoding
      // 'Present' whenever a geo row exists (see StaffMarkRow fix below —
      // same underlying bug, occurs three times in this file).
      const status = d.mark?.status || d.geo?.status || null
      if (status) counts[status] = (counts[status] || 0) + 1
      if (d.geo) fineMinutes += d.geo.late_minutes || 0
    }
    return { ...counts, fineMinutes }
  }, [days])

  const invalidRange = fromDate > toDate

  const applyPreset = (preset) => {
    const today = new Date()
    if (preset === 'today') { setFromDate(todayIso); setToDate(todayIso) }
    else if (preset === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); setFromDate(isoDate(d)); setToDate(todayIso) }
    else if (preset === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); setFromDate(isoDate(d)); setToDate(todayIso) }
    else if (preset === 'month') { setFromDate(`${currentMonth()}-01`); setToDate(todayIso) }
  }

  if (!staffId) {
    return <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Your account isn't linked to a staff profile.</p>
  }

  return (
    <div>
      <div style={{ ...S.card, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>From</label>
          <input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} style={{ ...S.input, flex: '1 1 130px' }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>To</label>
          <input type="date" value={toDate} min={fromDate} max={todayIso} onChange={e => setToDate(e.target.value)} style={{ ...S.input, flex: '1 1 130px' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month']].map(([key, label]) => (
            <button key={key} onClick={() => applyPreset(key)} style={S.pill(false)}>{label}</button>
          ))}
        </div>
      </div>

      {invalidRange ? (
        <p style={{ textAlign: 'center', color: '#dc2626', padding: 20 }}>"From" date must be on or before "To" date.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Present', value: summary.Present, color: '#16a34a' },
              { label: 'Absent', value: summary.Absent, color: '#dc2626' },
              { label: 'Half day', value: summary['Half Day'], color: '#ca8a04' },
              { label: 'Leave', value: summary.Leave, color: '#2563eb' },
              { label: 'Fine (min)', value: summary.fineMinutes, color: '#b45309' },
            ].map(c => (
              <div key={c.label} style={{ background: 'white', borderRadius: 10, padding: 12, boxShadow: '0 2px 6px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {days.map(d => {
                // BUGFIX: same pattern as StaffMarkRow/summary above — use
                // the geo row's real status instead of hardcoding Present
                // whenever any geo row exists. This is what let auto-marked
                // Absent days show as a green "Present" pill.
                const status = d.mark?.status || d.geo?.status || null
                const meta = status ? MARK_META[status] : null
                return (
                  <div key={d.date} style={{ background: 'white', borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{fmtDate(d.date)}</div>
                      {d.geo && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {d.geo.check_in_time
                            ? `In ${new Date(d.geo.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Auto-marked (no check-in)'}
                          {(d.geo.late_minutes || 0) > 0 && <span style={{ color: '#b45309', fontWeight: 700 }}> · +{d.geo.late_minutes}m late</span>}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, color: meta?.color || '#94a3b8', background: meta?.bg || '#f1f5f9' }}>
                      {status || 'Not marked'}
                    </span>
                  </div>
                )
              })}
              {!days.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No attendance records for this date range.</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Admin roster — the original full-staff overview + manual marking ─────
// Admin-only now (enforced by the branch in AttendanceSummaryView above,
// not just a disabled prop on the buttons) so no other staff member's
// per-day status is ever fetched into a non-admin's browser.

function AdminAttendanceRoster({ staffList, showToast, onNavigate, currentUsername }) {
  const [view, setView] = useState('mark') // 'mark' | 'range'
  const [date, setDate] = useState(isoDate(new Date()))
  const [search, setSearch] = useState('')
  const [geoRows, setGeoRows] = useState([])
  const [marks, setMarks] = useState({}) // staff_id -> mark row
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const fetchDay = useCallback(async () => {
    setLoading(true)
    const [{ data: geo }, { data: markRows }] = await Promise.all([
      supabase.from('staff_geo_attendance').select('staff_id, late_minutes, status, check_in_time, check_out_time, marked_by').eq('date', date),
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
      // BUGFIX: use geo.status instead of assuming every geo row means
      // Present — an auto-marked-absent or Flagged/Late row was inflating
      // this count (e.g. dashboard showing "14 Present" while most of the
      // list actually shows AB).
      const status = mark?.status || geo?.status || null
      if (status) counts[status] = (counts[status] || 0) + 1
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
    // Server-side enforced: set_attendance_mark checks the caller's actual
    // portal_users role before writing, so this can't be bypassed by
    // disabling the UI check alone (see 009_secure_attendance_marks.sql).
    const { data, error } = await supabase.rpc('set_attendance_mark', {
      p_acting_username: currentUsername,
      p_staff_id: staffId,
      p_date: date,
      p_status: status,
    })
    if (error) showToast?.('Could not save: ' + error.message, 'err')
    else if (!data?.success) showToast?.(data?.message || 'Not allowed', 'err')
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
        <button style={S.tab(view === 'mark')} onClick={() => setView('mark')}>Mark attendance</button>
        <button style={S.tab(view === 'range')} onClick={() => setView('range')}>Date-range report</button>
      </div>

      {view === 'range' ? (
        <AdminDateRangeReport staffList={staffList} search={search} setSearch={setSearch} />
      ) : (
        <>
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

      <div style={S.card}>
        <button onClick={() => onNavigate?.('staff')} style={{
          background: 'none', border: 'none', cursor: 'pointer', width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'inherit',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: '#EEE9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>Roster schedule</span>
        </button>
      </div>

      <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
      ) : (
        <>
          {unmarked.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Not marked ({unmarked.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {unmarked.map(s => (
                  <StaffMarkRow key={s.id} staff={s} mark={null} onMark={setMark} saving={savingId === s.id} disabled={false} />
                ))}
              </div>
            </div>
          )}
          {marked.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Marked ({marked.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {marked.map(s => (
                  <StaffMarkRow key={s.id} staff={s} mark={marks[s.id]} geo={geoByStaff[s.id]} onMark={setMark} saving={savingId === s.id} disabled={false} />
                ))}
              </div>
            </div>
          )}
          {!filteredStaff.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No staff found.</p>}
        </>
      )}
        </>
      )}
    </div>
  )
}

// ─── Admin date-range report — all staff, multi-day, read-only table ──────
// Separate from the single-day marking view above: this fetches every
// staff_geo_attendance / staff_attendance_marks row across the chosen
// range and renders one row per staff with day-by-day status dots, so an
// admin can review a week/month at a glance instead of paging day by day.

function AdminDateRangeReport({ staffList, search, setSearch }) {
  const todayIso = isoDate(new Date())
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return isoDate(d) })
  const [toDate, setToDate] = useState(todayIso)
  const [geoRows, setGeoRows] = useState([])
  const [markRows, setMarkRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRange = useCallback(async () => {
    if (fromDate > toDate) { setLoading(false); return }
    setLoading(true)
    const [{ data: geo }, { data: marks }] = await Promise.all([
      supabase.from('staff_geo_attendance')
        .select('staff_id, date, status, late_minutes, check_in_time, check_out_time')
        .gte('date', fromDate).lte('date', toDate),
      supabase.from('staff_attendance_marks')
        .select('staff_id, date, status')
        .gte('date', fromDate).lte('date', toDate),
    ])
    setGeoRows(geo || [])
    setMarkRows(marks || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { fetchRange() }, [fetchRange])

  const dateList = useMemo(() => {
    if (fromDate > toDate) return []
    const list = []
    const d = new Date(fromDate)
    const end = new Date(toDate)
    while (d <= end) { list.push(isoDate(d)); d.setDate(d.getDate() + 1) }
    return list
  }, [fromDate, toDate])

  // staff_id -> date -> { status, late_minutes? }
  const byStaffDate = useMemo(() => {
    const m = {}
    for (const r of geoRows) {
      m[r.staff_id] = m[r.staff_id] || {}
      m[r.staff_id][r.date] = { status: 'Present', late_minutes: r.late_minutes || 0 }
    }
    for (const r of markRows) {
      m[r.staff_id] = m[r.staff_id] || {}
      m[r.staff_id][r.date] = { status: r.status } // an explicit mark overrides the geo-derived Present
    }
    return m
  }, [geoRows, markRows])

  const staffSummary = useMemo(() => {
    return staffList.map(s => {
      const days = byStaffDate[s.id] || {}
      const counts = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0, notMarked: 0 }
      let fineMinutes = 0
      for (const date of dateList) {
        const d = days[date]
        if (d) { counts[d.status] = (counts[d.status] || 0) + 1; fineMinutes += d.late_minutes || 0 }
        else counts.notMarked++
      }
      return { staff: s, days, counts, fineMinutes }
    }).filter(r => !search || r.staff.name?.toLowerCase().includes(search.toLowerCase()))
  }, [staffList, byStaffDate, dateList, search])

  const invalidRange = fromDate > toDate

  const applyPreset = (preset) => {
    if (preset === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); setFromDate(isoDate(d)); setToDate(todayIso) }
    else if (preset === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); setFromDate(isoDate(d)); setToDate(todayIso) }
    else if (preset === 'month') { setFromDate(`${currentMonth()}-01`); setToDate(todayIso) }
  }

  return (
    <div>
      <div style={{ ...S.card, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>From</label>
          <input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} style={{ ...S.input, flex: '1 1 130px' }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>To</label>
          <input type="date" value={toDate} min={fromDate} max={todayIso} onChange={e => setToDate(e.target.value)} style={{ ...S.input, flex: '1 1 130px' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month']].map(([key, label]) => (
            <button key={key} onClick={() => applyPreset(key)} style={S.pill(false)}>{label}</button>
          ))}
        </div>
      </div>

      <input style={{ ...S.inputFull, marginBottom: 14 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />

      {invalidRange ? (
        <p style={{ textAlign: 'center', color: '#dc2626', padding: 20 }}>"From" date must be on or before "To" date.</p>
      ) : dateList.length > 31 ? (
        <p style={{ textAlign: 'center', color: '#dc2626', padding: 20 }}>Please pick a range of 31 days or fewer.</p>
      ) : loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>Staff</th>
                {dateList.map(d => (
                  <th key={d} style={{ ...S.th, textAlign: 'center' }}>{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</th>
                ))}
                <th style={{ ...S.th, textAlign: 'center' }}>P</th>
                <th style={{ ...S.th, textAlign: 'center' }}>AB</th>
                <th style={{ ...S.th, textAlign: 'center' }}>HD</th>
                <th style={{ ...S.th, textAlign: 'center' }}>L</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Fine (min)</th>
              </tr>
            </thead>
            <tbody>
              {staffSummary.map(r => (
                <tr key={r.staff.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ ...S.td, position: 'sticky', left: 0, background: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.staff.name}</td>
                  {dateList.map(d => {
                    const day = r.days[d]
                    const meta = day ? MARK_META[day.status] : null
                    return (
                      <td key={d} style={{ ...S.td, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: meta?.color || '#cbd5e1', background: meta?.bg || '#f8fafc',
                        }} title={day ? `${day.status}${day.late_minutes ? ` · +${day.late_minutes}m late` : ''}` : 'Not marked'}>
                          {meta?.label || '·'}
                        </span>
                      </td>
                    )
                  })}
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{r.counts.Present}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{r.counts.Absent}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#ca8a04' }}>{r.counts['Half Day']}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{r.counts.Leave}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#b45309' }}>{r.fineMinutes || '—'}</td>
                </tr>
              ))}
              {!staffSummary.length && (
                <tr><td colSpan={dateList.length + 6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No staff found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StaffMarkRow({ staff, mark, geo, onMark, saving, disabled }) {
  // BUGFIX: this used to fall back to a hardcoded 'Present' whenever ANY
  // geo row existed for the day, ignoring geo.status entirely — so a
  // Flagged/fraud-suspected/EarlyOut/auto-marked-Absent row still rendered
  // as a clean green "P". Use the geo row's actual status instead.
  const currentStatus = mark?.status || geo?.status || null
  // A geo row with no check_in_time is an auto-absent-sweep entry, not a
  // real check-in attempt — label it plainly instead of implying "In —"
  // ever happened. (Not relying on marked_by here: sample data shows the
  // sweep writes marked_by='self', which is itself a separate mislabel
  // worth fixing in mark_absent_no_checkin — flagging, not fixing here.)
  const subtitle = geo?.check_in_time
    ? `In ${new Date(geo.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    : geo && !mark
      ? 'Auto-marked (no check-in)'
      : (currentStatus || 'Not marked')
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.name}</div>
      <div style={{ fontSize: 10.5, color: currentStatus === 'Present' ? '#94a3b8' : '#dc2626', fontWeight: 600, marginBottom: 8 }}>
        {subtitle}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Object.entries(MARK_META).map(([status, meta]) => (
          <button key={status} disabled={disabled || saving} onClick={() => onMark(staff.id, status)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
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

// ─── Attendance Regularization — staff request + admin approval ───────────

export function RegularizationView({ staffId, isAdmin, showToast, currentUsername }) {
  const [tab, setTab] = useState(isAdmin ? 'queue' : 'mine')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: isoDate(new Date()), requested_status: 'Present', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('staff_regularization_requests').select('*, staff_profiles(name)').order('created_at', { ascending: false })
    if (tab === 'mine' && staffId) q = q.eq('staff_id', staffId)
    else if (tab === 'queue') q = q.eq('status', 'pending')
    const { data, error } = await q
    if (error) showToast?.('Could not load requests: ' + error.message, 'err')
    setRequests(data || [])
    setLoading(false)
  }, [tab, staffId, showToast])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const submitRequest = async () => {
    if (!form.reason.trim()) { showToast?.('Enter a reason for this correction', 'err'); return }
    setSubmitting(true)
    const { error } = await supabase.from('staff_regularization_requests').insert([{
      staff_id: staffId, date: form.date, requested_status: form.requested_status, reason: form.reason.trim(),
    }])
    if (error) showToast?.('Could not submit: ' + error.message, 'err')
    else {
      showToast?.('Request submitted for approval', 'ok')
      setForm({ date: isoDate(new Date()), requested_status: 'Present', reason: '' })
      setShowForm(false)
      fetchRequests()
    }
    setSubmitting(false)
  }

  const decide = async (req, status) => {
    const { error: updateErr } = await supabase.from('staff_regularization_requests').update({
      status, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (updateErr) { showToast?.('Could not update: ' + updateErr.message, 'err'); return }

    if (status === 'approved') {
      // Server-side enforced via the same RPC manual marking uses — approval
      // is only allowed for an actual admin account, checked in Postgres,
      // not just gated by this screen being hidden from non-admins.
      const { data, error: markErr } = await supabase.rpc('set_attendance_mark', {
        p_acting_username: currentUsername,
        p_staff_id: req.staff_id,
        p_date: req.date,
        p_status: req.requested_status,
      })
      if (markErr || !data?.success) {
        showToast?.('Approved, but could not update attendance: ' + (markErr?.message || data?.message), 'err')
        fetchRequests()
        return
      }
    }
    showToast?.(status === 'approved' ? 'Approved and attendance updated' : 'Rejected', status === 'approved' ? 'ok' : 'warn')
    fetchRequests()
  }

  const statusMeta = {
    pending:  { label: 'Pending', color: '#ca8a04', bg: '#fef9c3' },
    approved: { label: 'Approved', color: '#16a34a', bg: '#dcfce7' },
    rejected: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
        <button style={S.tab(tab === 'mine')} onClick={() => setTab('mine')}>My requests</button>
        {isAdmin && <button style={S.tab(tab === 'queue')} onClick={() => setTab('queue')}>Pending queue</button>}
      </div>

      {tab === 'mine' && (
        showForm ? (
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0B1E3D', marginBottom: 12 }}>Request attendance correction</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" style={{ ...S.inputFull, marginBottom: 10 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Mark as</label>
            <select style={{ ...S.inputFull, marginBottom: 10 }} value={form.requested_status} onChange={e => setForm(f => ({ ...f, requested_status: e.target.value }))}>
              <option value="Present">Present</option>
              <option value="Half Day">Half Day</option>
            </select>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Reason</label>
            <textarea style={{ ...S.inputFull, minHeight: 80, resize: 'vertical', marginBottom: 14 }} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Forgot to check in, was on campus all day" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitRequest} disabled={submitting} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#0B1E3D', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
            + Request correction
          </button>
        )
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => {
            const meta = statusMeta[r.status]
            return (
              <div key={r.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                      {isAdmin && tab === 'queue' ? (r.staff_profiles?.name || '—') + ' · ' : ''}{fmtDate(r.date)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Requesting: {r.requested_status}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: meta.color, background: meta.bg }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: r.status === 'pending' && isAdmin ? 10 : 0 }}>{r.reason}</div>
                {r.status === 'pending' && isAdmin && tab === 'queue' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => decide(r, 'approved')} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => decide(r, 'rejected')} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Reject</button>
                  </div>
                )}
              </div>
            )
          })}
          {!requests.length && (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
              {tab === 'queue' ? 'No pending requests.' : 'No correction requests yet.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
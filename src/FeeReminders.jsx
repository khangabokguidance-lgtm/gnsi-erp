// FeeReminders.jsx — WhatsApp fee reminders, reminder log and promise-to-pay.
// Log table: fee_reminders (supabase/migrations/20261008_fee_reminders_installments.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'

const n = v => Number(v || 0).toLocaleString('en-IN')
const NAVY = '#1e3a6e'
const BORDER = '#e8e3d8'
const INSTITUTE = 'Guidance Navodaya & Sainik Institute (GNSI)'
const SETUP_MSG = 'Run supabase/migrations/20261008_fee_reminders_installments.sql in the Supabase SQL editor to switch on reminder history and promise-to-pay.'
const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /fee_reminders/.test(err.message || ''))

const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }
const label = { fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' }
const input = { padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12.5, background: '#fff', minWidth: 0 }
const btn = (bg = NAVY, fg = '#fff') => ({ padding: '7px 13px', borderRadius: 8, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: '#fff', background: NAVY, whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 12, borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' }

const DEFAULT_TEMPLATE = `Dear Parent,

This is a gentle reminder from ${INSTITUTE}. The fee due for {name} (GCC-{gcc}) is ₹{due}.

You can check dues & pay online here: {link}

Kindly ignore this message if the payment has already been made. Thank you.
{institute}`

function getParentPhone(student) {
  if (!student) return null
  const raw = student.guardian_phone || student.father_phone || student.mother_phone ||
    student.parent_phone || student.guardian_mobile || student.mobile || student.phone ||
    student.contact_no || student.contact_number || ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.length === 10 ? `91${digits}` : digits
}

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

async function fetchLogs() {
  const { data, error } = await supabase.from('fee_reminders').select('*').order('created_at', { ascending: false }).limit(5000)
  return { data: data || [], error }
}

export default function FeeReminders({ students = [], liveRows = [], isAdmin, currentUser }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [courseF, setCourseF] = useState('All')
  const [hostelF, setHostelF] = useState('All')
  const [minDue, setMinDue] = useState('')
  const [notDays, setNotDays] = useState('')
  const [promisePassed, setPromisePassed] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sentNow, setSentNow] = useState(() => new Set())
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [promiseEdit, setPromiseEdit] = useState({})
  const [flash, setFlash] = useState('')

  const link = typeof location !== 'undefined' ? `${location.origin}/` : ''
  const who = currentUser?.name || currentUser?.username || currentUser?.email || ''

  const applyResult = useCallback(({ data, error }) => {
    if (error) { if (missingTable(error)) setMissing(true); else setLoadErr(error.message || 'Could not load reminders') }
    else { setLogs(data); setMissing(false); setLoadErr('') }
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    fetchLogs().then(r => { if (alive) applyResult(r) }).catch(e => { if (alive) { setLoadErr(e.message || 'Could not load reminders'); setLoading(false) } })
    return () => { alive = false }
  }, [applyResult])

  const studentByGcc = useMemo(() => {
    const m = new Map()
    students.forEach(s => m.set(String(s.gcc_no), s))
    return m
  }, [students])

  // gcc -> { last, count, promise }
  const stats = useMemo(() => {
    const m = new Map()
    logs.forEach(l => { // logs are newest first
      const k = String(l.gcc)
      const e = m.get(k) || { last: null, count: 0, promise: null }
      if (l.channel !== 'promise') { e.count += 1; if (!e.last) e.last = l.created_at }
      if (l.promise_date && !e.promise) e.promise = { date: l.promise_date, note: l.note }
      m.set(k, e)
    })
    return m
  }, [logs])

  const owing = useMemo(() => liveRows
    .filter(r => Number(r.totalDue) > 0)
    .map(r => {
      const gcc = String(r.gcc_no)
      return { ...r, _gcc: gcc, _phone: getParentPhone(r) || getParentPhone(studentByGcc.get(gcc)), _due: Number(r.totalDue) }
    }), [liveRows, studentByGcc])

  const courses = useMemo(() => ['All', ...Array.from(new Set(owing.map(r => r.course).filter(Boolean))).sort()], [owing])
  const hostels = useMemo(() => ['All', ...Array.from(new Set(owing.map(r => r.hostel_type).filter(Boolean))).sort()], [owing])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minD = Number(minDue) || 0
    const nd = Number(notDays) || 0
    const today = todayIso()
    const cutoff = new Date(today).getTime() + 86400000 - nd * 86400000
    return owing.filter(r => {
      if (courseF !== 'All' && r.course !== courseF) return false
      if (hostelF !== 'All' && r.hostel_type !== hostelF) return false
      if (r._due < minD) return false
      const st = stats.get(r._gcc)
      if (nd > 0 && st?.last && new Date(st.last).getTime() > cutoff) return false
      if (promisePassed && !(st?.promise && st.promise.date < today)) return false
      if (q && !`${r.name || ''} ${r.gcc_no || ''}`.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => b._due - a._due)
  }, [owing, courseF, hostelF, minDue, notDays, promisePassed, search, stats])

  const promisesKept = useMemo(() => {
    const dueSet = new Set(owing.map(r => r._gcc))
    let c = 0
    stats.forEach((v, k) => { if (v.promise && !dueSet.has(k)) c += 1 })
    return c
  }, [stats, owing])

  const buildMsg = r => template
    .replaceAll('{name}', r.name || '')
    .replaceAll('{gcc}', r.gcc_no || '')
    .replaceAll('{due}', n(r._due))
    .replaceAll('{institute}', INSTITUTE)
    .replaceAll('{link}', link)

  const note = msg => { setFlash(msg); setTimeout(() => setFlash(''), 3500) }

  const writeLog = async (row, extra) => {
    if (missing) return
    const { data, error } = await supabase.from('fee_reminders').insert({
      gcc: row._gcc, student_name: row.name || null, due_amount: row._due, sent_by: who || null, ...extra,
    }).select().single()
    if (error) { if (missingTable(error)) setMissing(true); else note(`Could not save log: ${error.message}`); return false }
    setLogs(prev => [data, ...prev])
    return true
  }

  const sendOne = async row => {
    if (!row._phone) { note(`No phone number on file for ${row.name}`); return }
    const message = buildMsg(row)
    window.open(`https://wa.me/${row._phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
    setSentNow(prev => new Set(prev).add(row._gcc))
    await writeLog(row, { channel: 'whatsapp', message })
  }

  const copyOne = async row => {
    const message = buildMsg(row)
    try { await navigator.clipboard.writeText(message); note('Message copied') } catch { note('Copy failed — select the text manually') }
    await writeLog(row, { channel: 'copy', message })
  }

  const selectedRows = rows.filter(r => selected.has(r._gcc))
  const nextRow = selectedRows.find(r => r._phone && !sentNow.has(r._gcc))
  const remaining = selectedRows.filter(r => r._phone && !sentNow.has(r._gcc)).length

  const allChecked = rows.length > 0 && rows.every(r => selected.has(r._gcc))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map(r => r._gcc)))
  const toggleOne = g => setSelected(prev => { const s = new Set(prev); if (s.has(g)) s.delete(g); else s.add(g); return s })

  const savePromise = async row => {
    const e = promiseEdit[row._gcc] || {}
    if (!e.date) { note('Pick a promise date first'); return }
    const ok = await writeLog(row, { channel: 'promise', promise_date: e.date, note: (e.note || '').trim() || null })
    if (ok) { setPromiseEdit(p => { const c = { ...p }; delete c[row._gcc]; return c }); note('Promise saved') }
  }

  const exportList = () => downloadCsv('fee_reminder_list.csv', rows.map(r => {
    const st = stats.get(r._gcc)
    return {
      'GCC No': r.gcc_no, Name: r.name || '', Course: r.course || '', Batch: r.batch || '', Hostel: r.hostel_type || '',
      'Paid (₹)': Number(r.grandTotal) || 0, 'Due (₹)': r._due, Phone: r._phone || '',
      'Last Reminded': st?.last ? new Date(st.last).toISOString().slice(0, 10) : '', Reminders: st?.count || 0,
      'Promise Date': st?.promise?.date || '', 'Promise Note': st?.promise?.note || '',
    }
  }))

  const promiseChip = (st, today) => {
    if (!st?.promise) return null
    const over = st.promise.date < today
    return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: over ? '#fee2e2' : '#dcfce7', color: over ? '#b91c1c' : '#166534', whiteSpace: 'nowrap' }}>
      {over ? 'Overdue' : 'Promised'} · {fmtDate(st.promise.date)}</span>
  }
  const today = todayIso()
  const totalDue = rows.reduce((t, r) => t + r._due, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {missing && <div role="alert" style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d', fontSize: 12.5, fontWeight: 600, color: '#92400e' }}>
        Reminder history is not set up yet. {SETUP_MSG} Reminders can still be sent, but they will not be logged.</div>}
      {loadErr && <div role="alert" style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', fontSize: 12.5, color: '#991b1b' }}>{loadErr}</div>}

      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div><span style={label}>Search</span><input style={{ ...input, width: 150 }} placeholder="Name / GCC" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div><span style={label}>Course</span><select style={input} value={courseF} onChange={e => setCourseF(e.target.value)}>{courses.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><span style={label}>Hostel</span><select style={input} value={hostelF} onChange={e => setHostelF(e.target.value)}>{hostels.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><span style={label}>Min due (₹)</span><input style={{ ...input, width: 90 }} type="number" min="0" value={minDue} onChange={e => setMinDue(e.target.value)} /></div>
          <div><span style={label}>Not reminded in (days)</span><input style={{ ...input, width: 90 }} type="number" min="0" value={notDays} onChange={e => setNotDays(e.target.value)} placeholder="off" /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#374151', paddingBottom: 7 }}>
            <input type="checkbox" checked={promisePassed} onChange={e => setPromisePassed(e.target.checked)} /> Promise date passed
          </label>
        </div>
      </div>

      <div style={card}>
        <span style={label}>Message template — use {'{name} {gcc} {due} {institute} {link}'}</span>
        <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={7} style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn('#eef2f9', NAVY)} onClick={() => setTemplate(DEFAULT_TEMPLATE)}>Reset template</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151' }}>
          {rows.length} students · ₹{n(totalDue)} due · {selectedRows.length} selected
          {promisesKept > 0 && <span style={{ marginLeft: 10, color: '#166534' }}>{promisesKept} promise{promisesKept > 1 ? 's' : ''} kept (cleared dues)</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...btn('#25d366'), opacity: nextRow ? 1 : 0.5 }} disabled={!nextRow} onClick={() => nextRow && sendOne(nextRow)}>
            Open next{nextRow ? ` (${remaining} left)` : ''}
          </button>
          <button type="button" style={btn('#eef2f9', NAVY)} onClick={exportList} disabled={!rows.length}>Export CSV</button>
        </div>
      </div>
      {flash && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{flash}</div>}

      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead><tr>
            <th style={th}><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
            <th style={th}>Student</th><th style={th}>Course / Batch</th><th style={{ ...th, textAlign: 'right' }}>Due</th>
            <th style={th}>Reminders</th><th style={th}>Promise to pay</th><th style={th}>Send</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#6b7280' }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#6b7280', padding: 24 }}>No students match — nobody owes, or the filters are too narrow.</td></tr>}
            {rows.map(r => {
              const st = stats.get(r._gcc)
              const pe = promiseEdit[r._gcc] || {}
              return (
                <tr key={r._gcc}>
                  <td style={td}><input type="checkbox" checked={selected.has(r._gcc)} onChange={() => toggleOne(r._gcc)} aria-label={`Select ${r.name}`} /></td>
                  <td style={td}><div style={{ fontWeight: 800 }}>{r.name}</div><div style={{ fontSize: 10.5, color: '#6b7280' }}>GCC-{r.gcc_no} · {r._phone ? `+${r._phone}` : <span style={{ color: '#b91c1c' }}>no phone</span>}</div></td>
                  <td style={td}>{r.course || '—'}<div style={{ fontSize: 10.5, color: '#6b7280' }}>{[r.batch, r.hostel_type].filter(Boolean).join(' · ')}</div></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 900, color: '#dc2626' }}>₹{n(r._due)}</td>
                  <td style={td}>
                    {st?.count ? <><div style={{ fontWeight: 700 }}>{st.count}×</div><div style={{ fontSize: 10.5, color: '#6b7280' }}>last {fmtDate(st.last)}</div></> : <span style={{ color: '#9ca3af' }}>Never</span>}
                  </td>
                  <td style={td}>
                    {promiseChip(st, today)}
                    {st?.promise?.note && <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 2 }}>{st.promise.note}</div>}
                    {!missing && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        <input type="date" style={{ ...input, padding: '4px 6px', fontSize: 11 }} value={pe.date || ''} onChange={e => setPromiseEdit(p => ({ ...p, [r._gcc]: { ...pe, date: e.target.value } }))} />
                        <input style={{ ...input, padding: '4px 6px', fontSize: 11, width: 90 }} placeholder="Note" value={pe.note || ''} onChange={e => setPromiseEdit(p => ({ ...p, [r._gcc]: { ...pe, note: e.target.value } }))} />
                        <button type="button" style={{ ...btn('#eef2f9', NAVY), padding: '4px 9px', fontSize: 11 }} onClick={() => savePromise(r)}>Save</button>
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...btn('#25d366'), padding: '5px 10px', opacity: r._phone ? 1 : 0.4 }} disabled={!r._phone} onClick={() => sendOne(r)}>WhatsApp</button>
                      <button type="button" style={{ ...btn('#eef2f9', NAVY), padding: '5px 10px' }} onClick={() => copyOne(r)}>Copy message</button>
                    </div>
                    {sentNow.has(r._gcc) && <div style={{ fontSize: 10, color: '#166534', marginTop: 3, fontWeight: 700 }}>Opened this session</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!isAdmin && <div style={{ fontSize: 11, color: '#6b7280' }}>Reminder history can be edited or deleted by admins only.</div>}
    </div>
  )
}

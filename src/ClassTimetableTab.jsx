// ClassTimetableTab.jsx — GNSI Portal
// Editable timetable with Supabase persistence + version history
// ─────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ── Design tokens ─────────────────────────────────────────────
const C = {
  navy:    '#1e3a5f',
  navyDk:  '#0f2340',
  gold:    '#c9a84c',
  bg:      '#f0f4f8',
  white:   '#ffffff',
  border:  '#e2e8f0',
  muted:   '#94a3b8',
  text:    '#1e293b',
  textSm:  '#64748b',
}

const card  = { background: C.white, borderRadius: 14, padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,.07)' }
const inp   = { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const lbl   = { display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, color: C.textSm, textTransform: 'uppercase', letterSpacing: '.04em' }

// ── Batch palette ─────────────────────────────────────────────
const BATCH_PALETTE = {
  Achiever:  { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  Leader:    { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  Champion:  { color: '#16a34a', bg: '#dcfce7', border: '#6ee7b7' },
  Lakshya:   { color: '#ca8a04', bg: '#fef9c3', border: '#fde047' },
  Umeed:     { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  Elite:     { color: '#0891b2', bg: '#e0f2fe', border: '#7dd3fc' },
  Prime:     { color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
}
const batchPalette = name => {
  for (const key of Object.keys(BATCH_PALETTE)) {
    if ((name || '').includes(key)) return BATCH_PALETTE[key]
  }
  return { color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
}

// ── Subject colours ───────────────────────────────────────────
const SUBJECT_COLORS = {
  Mathematics: '#1d4ed8', Maths: '#1d4ed8', Mental: '#1d4ed8',
  Science: '#16a34a',
  Grammar: '#dc2626', Vocabulary: '#b45309', Passage: '#b45309',
  GK: '#7c3aed', 'General Knowledge': '#7c3aed',
  Reasoning: '#0891b2',
  'Meitei Mayek': '#059669',
  Hindi: '#ca8a04',
  'Self Practice': '#94a3b8',
}
const subjectColor = s => {
  for (const key of Object.keys(SUBJECT_COLORS)) {
    if ((s || '').toLowerCase().includes(key.toLowerCase())) return SUBJECT_COLORS[key]
  }
  return C.navy
}

const CLASS_BATCHES = [
  'Achiever (Combined)', 'Leader (Sainik)', 'Champion (Sainik)',
  'Lakshya (Navodaya)', 'Umeed (Navodaya)', 'Elite (Foundation)', 'Prime (Foundation)',
]
const DOUBT_BATCHES = [
  'Achiever A', 'Achiever B', 'Leader A', 'Leader B',
  'Champion A', 'Champion B', 'Lakshya', 'Umeed', 'Elite', 'Prime',
]

const SUBJECTS = [
  'Mathematics I', 'Mathematics II', 'Maths I', 'Maths II', 'Mental Maths',
  'Science', 'Grammar', 'Vocabulary', 'Passage', 'GK', 'General Knowledge',
  'Reasoning', 'Meitei Mayek', 'Hindi', 'Self Practice', 'Other',
]

// ── Pill component ────────────────────────────────────────────
function SubjectPill({ subject, teacher, compact = false, onClick, editable }) {
  if (!subject) return (
    <div onClick={onClick} style={{
      padding: compact ? '4px 6px' : '8px 10px', borderRadius: 8,
      background: editable ? '#fafafa' : '#f8fafc',
      color: editable ? '#cbd5e1' : '#e2e8f0',
      fontSize: 11, textAlign: 'center',
      minHeight: compact ? 'auto' : 54,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: editable ? 'pointer' : 'default',
      border: editable ? `1.5px dashed ${C.border}` : 'none',
      transition: 'all .15s',
    }}
      onMouseEnter={e => { if (editable) e.currentTarget.style.borderColor = C.navy }}
      onMouseLeave={e => { if (editable) e.currentTarget.style.borderColor = C.border }}
    >
      {editable ? '+ Add' : '—'}
    </div>
  )
  const c = subjectColor(subject)
  return (
    <div onClick={onClick} style={{
      borderRadius: 8, background: c + '12', borderLeft: `3px solid ${c}`,
      padding: compact ? '6px 8px' : '8px 10px',
      minHeight: compact ? 'auto' : 54,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
      cursor: editable ? 'pointer' : 'default',
      transition: 'all .15s',
      outline: editable ? `0px solid ${c}40` : 'none',
    }}
      onMouseEnter={e => { if (editable) { e.currentTarget.style.outline = `2px solid ${c}40`; e.currentTarget.style.transform = 'scale(1.01)' } }}
      onMouseLeave={e => { if (editable) { e.currentTarget.style.outline = 'none'; e.currentTarget.style.transform = 'scale(1)' } }}
    >
      <div style={{ fontSize: compact ? 10 : 12, fontWeight: 700, color: c, lineHeight: 1.2 }}>{subject}</div>
      <div style={{ fontSize: 11, color: C.textSm, lineHeight: 1.2 }}>{teacher}</div>
      {editable && <div style={{ fontSize: 9, color: c + '80', marginTop: 2 }}>✏️ click to edit</div>}
    </div>
  )
}

// ── Slot edit modal ───────────────────────────────────────────
function SlotModal({ slot, batches, onSave, onDelete, onClose }) {
  const [subject, setSubject]   = useState(slot?.subject || '')
  const [teacher, setTeacher]   = useState(slot?.teacher || '')
  const [customSub, setCustom]  = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{ ...card, width: '100%', maxWidth: 400, zIndex: 10000 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Edit Slot</div>
            <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
              {slot.from} – {slot.to} · <b style={{ color: batchPalette(slot.batch).color }}>{slot.batch}</b>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Subject</label>
            {!customSub ? (
              <select style={inp} value={subject} onChange={e => {
                if (e.target.value === 'Other') { setCustom(true); setSubject('') }
                else setSubject(e.target.value)
              }}>
                <option value="">— None / Remove —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input style={inp} value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Type subject name…" autoFocus />
            )}
            {customSub && <button onClick={() => setCustom(false)} style={{ fontSize: 11, color: C.navy, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>← Back to list</button>}
          </div>

          <div>
            <label style={lbl}>Teacher</label>
            <input style={inp} value={teacher} onChange={e => setTeacher(e.target.value)}
              placeholder="e.g. Sir Himan, Miss Priya…" />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => onSave({ subject, teacher })} style={{
              flex: 1, padding: '10px', borderRadius: 9, border: 'none',
              background: C.navy, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>Save</button>
            {slot.subject && (
              <button onClick={onDelete} style={{
                padding: '10px 16px', borderRadius: 9, border: 'none',
                background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Clear</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row edit modal (add/edit time row) ────────────────────────
function RowModal({ row, isNew, onSave, onDelete, onClose }) {
  const [fromTime,  setFrom]     = useState(row?.from_time  || '')
  const [toTime,    setTo]       = useState(row?.to_time    || '')
  const [isBreak,   setIsBreak]  = useState(row?.is_break   || false)
  const [breakLabel, setBreakLbl]= useState(row?.break_label|| '')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{ ...card, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{isNew ? 'Add Time Row' : 'Edit Time Row'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>From Time</label>
              <input style={inp} value={fromTime} onChange={e => setFrom(e.target.value)} placeholder="e.g. 7:20 AM" />
            </div>
            <div>
              <label style={lbl}>To Time</label>
              <input style={inp} value={toTime} onChange={e => setTo(e.target.value)} placeholder="e.g. 8:10 AM" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="isBreak" checked={isBreak} onChange={e => setIsBreak(e.target.checked)} />
            <label htmlFor="isBreak" style={{ fontSize: 13, fontWeight: 600, color: C.text, cursor: 'pointer' }}>This is a break row</label>
          </div>

          {isBreak && (
            <div>
              <label style={lbl}>Break Label</label>
              <input style={inp} value={breakLabel} onChange={e => setBreakLbl(e.target.value)} placeholder="e.g. ☕ Tea Break" />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => onSave({ from_time: fromTime, to_time: toTime, is_break: isBreak, break_label: breakLabel })}
              style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', background: C.navy, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Save
            </button>
            {!isNew && (
              <button onClick={onDelete}
                style={{ padding: '10px 16px', borderRadius: 9, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Delete Row
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Version history panel ─────────────────────────────────────
function HistoryPanel({ type, onClose, onRestore }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase.from('timetable_history')
      .select('*').eq('timetable_type', type)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setHistory(data || []); setLoading(false) })
  }, [type])

  const fmtDate = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{ ...card, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>📜 Version History</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Loading history…</div>}
          {!loading && history.length === 0 && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>No history yet</div>}
          {history.map((h, i) => (
            <div key={h.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: expanded === i ? '#f0f4f8' : 'white' }}
                onClick={() => setExpanded(expanded === i ? null : i)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{h.change_summary || 'Timetable updated'}</div>
                  <div style={{ fontSize: 11, color: C.textSm, marginTop: 2 }}>
                    👤 {h.changed_by} · {fmtDate(h.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {onRestore && (
                    <button onClick={e => { e.stopPropagation(); onRestore(h.snapshot) }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.navy}`, background: 'white', color: C.navy, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Restore
                    </button>
                  )}
                  <span style={{ color: C.muted, fontSize: 14 }}>{expanded === i ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded === i && h.snapshot && (
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: '#f8fafc' }}>
                  <div style={{ fontSize: 11, color: C.textSm, fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto' }}>
                    {JSON.stringify(h.snapshot, null, 2).slice(0, 800)}…
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main editable timetable grid ──────────────────────────────
function EditableGrid({ type, batches, editable, currentUser }) {
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [editSlot,  setEditSlot]  = useState(null)  // { rowId, batchName, from, to, subject, teacher, slotId }
  const [editRow,   setEditRow]   = useState(null)  // { row } | { isNew: true }
  const [showHist,  setShowHist]  = useState(false)
  const [view,      setView]      = useState('grid') // grid | batch | teacher
  const [selBatch,  setSelBatch]  = useState(batches[0])
  const [tSearch,   setTSearch]   = useState('')
  const [toast,     setToast]     = useState(null)
  const [sessionFilter, setSF]    = useState('All')

  const showToast = (msg, color = '#166534', bg = '#dcfce7') => {
    setToast({ msg, color, bg })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load from Supabase ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('timetable_type', type)
      .order('sort_order')
      .order('from_time')
    if (error) { showToast('Load error: ' + error.message, '#dc2626', '#fee2e2'); setLoading(false); return }

    // Group into time rows
    const rowMap = {}
    ;(data || []).forEach(slot => {
      const key = `${slot.from_time}||${slot.to_time}`
      if (!rowMap[key]) rowMap[key] = {
        id: key, from_time: slot.from_time, to_time: slot.to_time,
        is_break: slot.is_break, break_label: slot.break_label,
        sort_order: slot.sort_order, slots: {},
      }
      if (slot.batch_name) rowMap[key].slots[slot.batch_name] = { id: slot.id, subject: slot.subject, teacher: slot.teacher }
    })
    setRows(Object.values(rowMap).sort((a, b) => a.sort_order - b.sort_order))
    setLoading(false)
  }, [type])

  useEffect(() => { load() }, [load])

  // ── Save snapshot to history ────────────────────────────────
  const saveHistory = async (summary) => {
    const snapshot = rows.map(r => ({ ...r }))
    await supabase.from('timetable_history').insert([{
      timetable_type: type,
      changed_by: currentUser || 'Admin',
      change_summary: summary,
      snapshot,
    }])
  }

  // ── Update a slot ───────────────────────────────────────────
  const handleSlotSave = async ({ subject, teacher }) => {
    if (!editSlot) return
    setSaving(true)
    const { rowId, batchName, slotId, from, to } = editSlot

    if (!subject) {
      // Clear slot — delete from DB
      if (slotId) {
        await supabase.from('timetable_slots').delete().eq('id', slotId)
        await saveHistory(`Cleared ${batchName} at ${from}`)
        showToast('Slot cleared')
      }
    } else if (slotId) {
      // Update existing
      await supabase.from('timetable_slots').update({ subject, teacher }).eq('id', slotId)
      await saveHistory(`Updated ${batchName} at ${from}: ${subject} (${teacher})`)
      showToast('Slot updated ✓')
    } else {
      // Insert new slot
      const rowSortOrder = rows.find(r => r.id === rowId)?.sort_order || 0
      await supabase.from('timetable_slots').insert([{
        timetable_type: type, from_time: from, to_time: to,
        batch_name: batchName, subject, teacher,
        sort_order: rowSortOrder, is_break: false,
      }])
      await saveHistory(`Added ${batchName} at ${from}: ${subject} (${teacher})`)
      showToast('Slot added ✓')
    }

    setEditSlot(null)
    setSaving(false)
    load()
  }

  // ── Add/edit time row ───────────────────────────────────────
  const handleRowSave = async (data) => {
    setSaving(true)
    if (editRow?.isNew) {
      // Insert break row or empty row — one slot per batch
      const sortOrder = rows.length * 10
      if (data.is_break) {
        await supabase.from('timetable_slots').insert([{
          timetable_type: type, from_time: data.from_time, to_time: data.to_time,
          is_break: true, break_label: data.break_label, batch_name: null,
          subject: null, teacher: null, sort_order: sortOrder,
        }])
      } else {
        // Insert empty placeholder per batch
        const inserts = batches.map((b, i) => ({
          timetable_type: type, from_time: data.from_time, to_time: data.to_time,
          is_break: false, batch_name: b, subject: null, teacher: null,
          sort_order: sortOrder,
        }))
        await supabase.from('timetable_slots').insert(inserts)
      }
      await saveHistory(`Added time row ${data.from_time} – ${data.to_time}`)
      showToast('Row added ✓')
    } else {
      // Update all slots in this row's time
      const row = editRow.row
      await supabase.from('timetable_slots')
        .update({ from_time: data.from_time, to_time: data.to_time, is_break: data.is_break, break_label: data.break_label })
        .eq('timetable_type', type)
        .eq('from_time', row.from_time)
        .eq('to_time', row.to_time)
      await saveHistory(`Updated time row to ${data.from_time} – ${data.to_time}`)
      showToast('Row updated ✓')
    }
    setEditRow(null)
    setSaving(false)
    load()
  }

  const handleRowDelete = async () => {
    if (!editRow?.row) return
    setSaving(true)
    const row = editRow.row
    await supabase.from('timetable_slots')
      .delete()
      .eq('timetable_type', type)
      .eq('from_time', row.from_time)
      .eq('to_time', row.to_time)
    await saveHistory(`Deleted time row ${row.from_time} – ${row.to_time}`)
    showToast('Row deleted')
    setEditRow(null)
    setSaving(false)
    load()
  }

  // ── Restore snapshot ────────────────────────────────────────
  const handleRestore = async (snapshot) => {
    if (!window.confirm('Restore this version? Current timetable will be overwritten.')) return
    setSaving(true)
    await supabase.from('timetable_slots').delete().eq('timetable_type', type)
    // Re-insert from snapshot — flatten rows back to slots
    const inserts = []
    snapshot.forEach(row => {
      if (row.is_break) {
        inserts.push({ timetable_type: type, from_time: row.from_time, to_time: row.to_time, is_break: true, break_label: row.break_label, batch_name: null, subject: null, teacher: null, sort_order: row.sort_order })
      } else {
        Object.entries(row.slots || {}).forEach(([batch, slot]) => {
          inserts.push({ timetable_type: type, from_time: row.from_time, to_time: row.to_time, is_break: false, batch_name: batch, subject: slot.subject, teacher: slot.teacher, sort_order: row.sort_order })
        })
      }
    })
    if (inserts.length) await supabase.from('timetable_slots').insert(inserts)
    await saveHistory('Restored from version history')
    showToast('Restored ✓')
    setShowHist(false)
    setSaving(false)
    load()
  }

  // ── Teacher view data ─────────────────────────────────────────
  const allTeachers = useMemo(() => {
    const set = new Set()
    rows.forEach(row => Object.values(row.slots || {}).forEach(s => { if (s?.teacher) set.add(s.teacher) }))
    return [...set].sort()
  }, [rows])

  const teacherSlots = useMemo(() => {
    if (!tSearch.trim()) return []
    return rows.filter(r => !r.is_break).flatMap(row =>
      Object.entries(row.slots || {})
        .filter(([, s]) => s?.teacher?.toLowerCase().includes(tSearch.toLowerCase()))
        .map(([batch, s]) => ({ from: row.from_time, to: row.to_time, subject: s.subject, batch }))
    )
  }, [tSearch, rows])

  // ── Session filter for doubt ──────────────────────────────────
  const sessionOf = from => {
    const ampm = from.includes('PM') ? 'PM' : 'AM'
    const h = parseInt(from.split(':')[0])
    if (ampm === 'AM') return 'Morning'
    if (h >= 9) return 'Night'
    return 'Evening'
  }
  const visibleRows = useMemo(() => {
    if (type !== 'doubt' || sessionFilter === 'All') return rows
    return rows.filter(r => r.is_break || sessionOf(r.from_time) === sessionFilter)
  }, [rows, sessionFilter, type])

  const batchIndex = batches.indexOf(selBatch)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>⏳ Loading timetable…</div>

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: toast.bg, color: toast.color, padding: '10px 20px',
          borderRadius: 10, fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,.15)',
          animation: 'fadeIn .2s ease',
        }}>{toast.msg}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        {/* View switcher */}
        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          {[['grid', '⊞ Grid'], ['batch', '👥 Batch'], ['teacher', '👤 Teacher']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
              background: view === id ? C.navy : 'transparent',
              color: view === id ? 'white' : C.textSm, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 12, color: C.muted }}>Saving…</span>}
          <button onClick={() => setShowHist(true)} style={{
            padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`,
            background: 'white', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>📜 History</button>
          {editable && (
            <button onClick={() => setEditRow({ isNew: true })} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: C.navy, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ Add Row</button>
          )}
        </div>
      </div>

      {/* Session filter (doubt only) */}
      {type === 'doubt' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {['All', 'Morning', 'Evening', 'Night'].map(s => (
            <button key={s} onClick={() => setSF(s)} style={{
              padding: '6px 14px', borderRadius: 99, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              background: sessionFilter === s ? C.navy : '#f1f5f9',
              color: sessionFilter === s ? 'white' : C.textSm,
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* ── GRID VIEW ──────────────────────────────────────── */}
      {view === 'grid' && (
        <div style={{ overflowX: 'auto', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: batches.length * 120 + 150 }}>
            <thead>
              <tr style={{ background: C.navy }}>
                <th style={{ padding: '12px 14px', color: 'white', fontWeight: 700, textAlign: 'left', minWidth: 150 }}>Time</th>
                {batches.map(b => {
                  const p = batchPalette(b)
                  return (
                    <th key={b} style={{ padding: '10px 6px', textAlign: 'center', minWidth: 120 }}>
                      <div style={{ background: p.bg, color: p.color, borderRadius: 8, padding: '4px 8px', fontWeight: 700, fontSize: 11 }}>{b}</div>
                    </th>
                  )
                })}
                {editable && <th style={{ padding: '10px 8px', color: 'white', fontSize: 11, minWidth: 60 }}>Edit</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => {
                if (row.is_break) return (
                  <tr key={ri} style={{ background: '#fef9c3' }}>
                    <td colSpan={batches.length + (editable ? 2 : 1)} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#92400e', fontSize: 13 }}>
                      {row.break_label || '☕ Break'} · {row.from_time} – {row.to_time}
                      {editable && (
                        <button onClick={() => setEditRow({ row })} style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 5, border: `1px solid #92400e`, background: 'transparent', color: '#92400e', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                      )}
                    </td>
                  </tr>
                )
                return (
                  <tr key={ri} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, color: C.navy, fontWeight: 700, background: '#f8fafc', borderRight: `2px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                      {row.from_time}<br />
                      <span style={{ color: C.muted, fontSize: 11 }}>{row.to_time}</span>
                    </td>
                    {batches.map(b => {
                      const s = row.slots?.[b]
                      return (
                        <td key={b} style={{ padding: '5px 5px', verticalAlign: 'top' }}>
                          <SubjectPill
                            subject={s?.subject} teacher={s?.teacher}
                            editable={editable}
                            onClick={editable ? () => setEditSlot({
                              rowId: row.id, batchName: b,
                              from: row.from_time, to: row.to_time,
                              subject: s?.subject, teacher: s?.teacher,
                              slotId: s?.id,
                            }) : undefined}
                          />
                        </td>
                      )
                    })}
                    {editable && (
                      <td style={{ padding: '5px 5px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <button onClick={() => setEditRow({ row })} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: C.textSm }}>✏️</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BATCH VIEW ─────────────────────────────────────── */}
      {view === 'batch' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {batches.map(b => {
              const p = batchPalette(b)
              return (
                <button key={b} onClick={() => setSelBatch(b)} style={{
                  padding: '7px 14px', borderRadius: 10,
                  border: `2px solid ${selBatch === b ? p.color : p.border}`,
                  background: selBatch === b ? p.bg : 'white',
                  color: p.color, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>{b}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleRows.map((row, ri) => {
              if (row.is_break) return (
                <div key={ri} style={{ background: '#fef9c3', borderRadius: 8, padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#92400e', fontSize: 13 }}>
                  {row.break_label || '☕ Break'} · {row.from_time} – {row.to_time}
                </div>
              )
              const s = row.slots?.[selBatch]
              return (
                <div key={ri} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  background: 'white', borderRadius: 10, padding: '12px 16px',
                  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
                  borderLeft: `4px solid ${s ? subjectColor(s.subject) : C.border}`,
                  opacity: s ? 1 : 0.5,
                }}>
                  <div style={{ minWidth: 130, fontFamily: 'monospace', fontSize: 12, color: C.navy, fontWeight: 700 }}>{row.from_time} – {row.to_time}</div>
                  {s ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: subjectColor(s.subject) }}>{s.subject}</div>
                      <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>👨‍🏫 {s.teacher}</div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, fontSize: 13, color: C.muted }}>— No class</div>
                  )}
                  {editable && (
                    <button onClick={() => setEditSlot({
                      rowId: row.id, batchName: selBatch,
                      from: row.from_time, to: row.to_time,
                      subject: s?.subject, teacher: s?.teacher, slotId: s?.id,
                    })} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'white', color: C.textSm, fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TEACHER VIEW ───────────────────────────────────── */}
      {view === 'teacher' && (
        <div>
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={lbl}>Search Teacher</label>
            <input value={tSearch} onChange={e => setTSearch(e.target.value)}
              placeholder="Type teacher name…" style={inp} />
          </div>

          {tSearch.trim() ? (
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.navy, marginBottom: 10 }}>📋 {tSearch}'s Schedule</div>
              {teacherSlots.length === 0
                ? <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>No slots found for "{tSearch}"</div>
                : teacherSlots.map((s, i) => {
                  const p = batchPalette(s.batch)
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 12, alignItems: 'center',
                      background: 'white', borderRadius: 10, padding: '10px 16px', marginBottom: 8,
                      boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderLeft: `4px solid ${p.color}`,
                    }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.navy, fontWeight: 700, minWidth: 130 }}>{s.from} – {s.to}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: subjectColor(s.subject) }}>{s.subject}</div>
                        <div style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>{s.batch}</div>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
              {allTeachers.map(t => {
                const count = rows.filter(r => !r.is_break).flatMap(r => Object.values(r.slots || {})).filter(s => s?.teacher === t).length
                return (
                  <button key={t} onClick={() => setTSearch(t)} style={{
                    background: 'white', borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>👤 {t}</div>
                    <div style={{ fontSize: 11, color: C.textSm, marginTop: 4 }}>{count} slot{count !== 1 ? 's' : ''}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editSlot && <SlotModal slot={editSlot} batches={batches} onSave={handleSlotSave} onDelete={() => handleSlotSave({ subject: '', teacher: '' })} onClose={() => setEditSlot(null)} />}
      {editRow  && <RowModal  row={editRow.row} isNew={!!editRow.isNew} onSave={handleRowSave} onDelete={handleRowDelete} onClose={() => setEditRow(null)} />}
      {showHist && <HistoryPanel type={type} onClose={() => setShowHist(false)} onRestore={handleRestore} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  EXPORTED TABS
// ══════════════════════════════════════════════════════════════
export function ClassTimetableTab({ editable = true, currentUser = 'Admin' }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>🗓️ Class Timetable</h2>
          <p style={{ fontSize: 13, color: C.textSm, margin: '4px 0 0' }}>Mon–Sat · {CLASS_BATCHES.length} batches · {editable ? 'Click any slot to edit' : 'View only'}</p>
        </div>
        {editable && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            ✏️ Edit mode on
          </div>
        )}
      </div>
      <EditableGrid type="class" batches={CLASS_BATCHES} editable={editable} currentUser={currentUser} />
    </div>
  )
}

export function DoubtSessionTab({ editable = true, currentUser = 'Admin' }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>🙋 Doubt Sessions</h2>
          <p style={{ fontSize: 13, color: C.textSm, margin: '4px 0 0' }}>Mon–Sat · Morning, Evening & Night · {DOUBT_BATCHES.length} sub-batches · {editable ? 'Click any slot to edit' : 'View only'}</p>
        </div>
        {editable && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            ✏️ Edit mode on
          </div>
        )}
      </div>
      <EditableGrid type="doubt" batches={DOUBT_BATCHES} editable={editable} currentUser={currentUser} />
    </div>
  )
}
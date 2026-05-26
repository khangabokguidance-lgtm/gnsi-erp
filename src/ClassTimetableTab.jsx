// ══════════════════════════════════════════════════════════════
//  TAB: CLASS TIMETABLE & DOUBT SESSIONS
//  Drop this file next to your Hostel module and import it.
//  Then add the two new TABS entries and wire up tabContent.
// ══════════════════════════════════════════════════════════════
//
//  STEP 1 — Add to your TABS array (in the root Hostel file):
//    { id: 'classtimetable', label: '🗓️ Classes' },
//    { id: 'doubtsession',   label: '🙋 Doubt'   },
//
//  STEP 2 — Add to tabContent in Hostel():
//    classtimetable: <ClassTimetableTab />,
//    doubtsession:   <DoubtSessionTab  />,
//
//  STEP 3 — Import at top of Hostel file:
//    import { ClassTimetableTab, DoubtSessionTab } from './ClassTimetableTab'
// ══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react'

// ─── Shared style tokens (mirrors the Hostel module) ──────────
const inp = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #d1d5db', fontSize: '16px',
  boxSizing: 'border-box', backgroundColor: 'white', minHeight: '44px',
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}
const btn = (bg = '#1e3a5f', c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: '10px',
  padding: '10px 18px', fontWeight: '600', cursor: 'pointer', fontSize: '13px',
  minHeight: '40px',
})

// ─── Colour per batch ─────────────────────────────────────────
const BATCH_PALETTE = {
  'Achiever':   { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  'Leader':     { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  'Champion':   { color: '#16a34a', bg: '#dcfce7', border: '#6ee7b7' },
  'Lakshya':    { color: '#ca8a04', bg: '#fef9c3', border: '#fde047' },
  'Umeed':      { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  'Elite':      { color: '#0891b2', bg: '#e0f2fe', border: '#7dd3fc' },
  'Prime':      { color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
}
const batchPalette = (name) => {
  for (const key of Object.keys(BATCH_PALETTE)) {
    if ((name || '').includes(key)) return BATCH_PALETTE[key]
  }
  return { color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
}

// ─── Subject colour map ───────────────────────────────────────
const SUBJECT_COLORS = {
  'Mathematics': '#1d4ed8', 'Maths': '#1d4ed8', 'Mental': '#1d4ed8',
  'Science': '#16a34a',
  'Grammar': '#dc2626', 'Vocabulary': '#b45309', 'Passage': '#b45309',
  'GK': '#7c3aed', 'General Knowledge': '#7c3aed',
  'Reasoning': '#0891b2',
  'Meitei Mayek': '#059669',
  'Hindi': '#ca8a04',
  'Self Practice': '#94a3b8',
}
const subjectColor = (subject) => {
  for (const key of Object.keys(SUBJECT_COLORS)) {
    if ((subject || '').toLowerCase().includes(key.toLowerCase())) return SUBJECT_COLORS[key]
  }
  return '#1e3a5f'
}

// ══════════════════════════════════════════════════════════════
//  DATA  —  Class Timetable  (Mon–Sat)
// ══════════════════════════════════════════════════════════════
const CLASS_BATCHES = [
  'Achiever (Combined)',
  'Leader (Sainik)',
  'Champion (Sainik)',
  'Lakshya (Navodaya)',
  'Umeed (Navodaya)',
  'Elite (Foundation)',
  'Prime (Foundation)',
]

// Each slot: { from, to, slots: [ { batch, subject, teacher } | null ] }
// null = no class for that batch in that slot
const CLASS_TIMETABLE = [
  {
    from: '7:20 AM', to: '8:10 AM',
    note: 'Morning slot',
    slots: [
      { subject: 'Maths II',     teacher: 'Sir Himan' },
      null, null, null, null, null, null,
    ],
  },
  {
    from: '10:20 AM', to: '11:10 AM',
    slots: [
      { subject: 'Mathematics I',  teacher: 'Sir Sumanta' },
      { subject: 'Science',        teacher: 'Sir Arunkumar' },
      { subject: 'GK',             teacher: 'Sir Deepak' },
      { subject: 'Meitei Mayek',   teacher: 'Sir Pawan' },
      { subject: 'Grammar',        teacher: 'Sir Lenin' },
      { subject: 'Mathematics I',  teacher: 'Sunder' },
      { subject: 'Reasoning',      teacher: 'Sir Roshan' },
    ],
  },
  {
    from: '11:10 AM', to: '12:00 PM',
    slots: [
      { subject: 'GK',             teacher: 'Sir Deepak' },
      { subject: 'Reasoning',      teacher: 'Sir Johny' },
      { subject: 'Grammar',        teacher: 'Sir Bidyachandra' },
      { subject: 'Mathematics',    teacher: 'Sir Himan' },
      { subject: 'Meitei Mayek',   teacher: 'Sir Pawan' },
      { subject: 'Grammar',        teacher: 'Sir Chetan' },
      { subject: 'Science',        teacher: 'Sir Arjun' },
    ],
  },
  {
    from: '12:00 PM', to: '12:50 PM',
    slots: [
      { subject: 'Grammar',        teacher: 'Sir Bidyachandra' },
      { subject: 'Mathematics',    teacher: 'Sir Sumanta' },
      { subject: 'Mathematics II', teacher: 'Sir Sunder' },
      { subject: 'Mathematics',    teacher: 'Sir Himan' },
      { subject: 'Mental',         teacher: 'Sir Johny' },
      { subject: 'Reasoning',      teacher: 'Sir Lenin' },
      { subject: 'Meitei Mayek',   teacher: 'Madam Sandhya' },
    ],
  },
  {
    from: '12:50 PM', to: '1:20 PM',
    isBreak: true,
    label: '☕ Tea Break',
    slots: [],
  },
  {
    from: '1:20 PM', to: '2:10 PM',
    slots: [
      { subject: 'Reasoning',         teacher: 'Sir Roshan' },
      { subject: 'Grammar',           teacher: 'Miss Fedrava' },
      { subject: 'Mathematics',       teacher: 'Sir Sumanta' },
      { subject: 'Grammar & Vocab',   teacher: 'Sir Chetan' },
      { subject: 'Mathematics',       teacher: 'Sir Himan' },
      { subject: 'Meitei Mayek',      teacher: 'Madam Sandhya' },
      { subject: 'Mathematics I',     teacher: 'Sir Sunder' },
    ],
  },
  {
    from: '2:10 PM', to: '2:55 PM',
    slots: [
      { subject: 'Vocabulary',     teacher: 'Sir Pawan' },
      { subject: 'Vocabulary',     teacher: 'Sir Chetan' },
      { subject: 'Reasoning',      teacher: 'Sir Johny' },
      { subject: 'Mental',         teacher: 'Sir Roshan' },
      { subject: 'Mathematics',    teacher: 'Sir Himan' },
      { subject: 'Science',        teacher: 'Sir Arjun' },
      { subject: 'Grammar',        teacher: 'Sir Lenin' },
    ],
  },
  {
    from: '2:55 PM', to: '3:40 PM',
    slots: [
      { subject: 'Science',        teacher: 'Sir Arunkumar' },
      { subject: 'GK',             teacher: 'Sir Deepak' },
      { subject: 'Vocabulary',     teacher: 'Sir Pawan' },
      null, null, null, null,
    ],
  },
  {
    from: '3:40 PM', to: '5:30 PM',
    isBreak: true,
    label: '⚽ Recreation · 🍵 Tea Break',
    slots: [],
  },
  {
    from: '5:30 PM', to: '6:20 PM',
    slots: [
      null, null, null,
      { subject: 'Mathematics',    teacher: 'Sir Bronson' },
      { subject: 'Hindi',          teacher: 'Sir Boy' },
      null, null,
    ],
  },
  {
    from: '6:20 PM', to: '7:10 PM',
    slots: [
      null,
      { subject: 'Maths II',       teacher: 'Sir Himan' },
      null, null,
      { subject: 'Vocabulary',     teacher: 'Sir Arjun' },
      null, null,
    ],
  },
  {
    from: '7:10 PM', to: '8:00 PM',
    slots: [
      null, null,
      { subject: 'Science',        teacher: 'Sir Arunkumar' },
      null, null, null, null,
    ],
  },
]

// ══════════════════════════════════════════════════════════════
//  DATA  —  Doubt Sessions  (Mon–Sat)
// ══════════════════════════════════════════════════════════════
// All 10 sub-batches
const DOUBT_BATCHES = [
  'Achiever A',
  'Achiever B',
  'Leader A',
  'Leader B',
  'Champion A',
  'Champion B',
  'Lakshya',
  'Umeed',
  'Elite',
  'Prime',
]

const DOUBT_SESSIONS = [
  // ── Morning ──────────────────────────────────────────────
  {
    from: '6:30 AM', to: '7:20 AM',
    slots: [
      { subject: 'GK & Science',   teacher: 'Miss Geetanjali' },
      { subject: 'GK & Science',   teacher: 'Sir Romesh' },
      { subject: 'Reasoning',      teacher: 'Sir James' },
      { subject: 'Grammar',        teacher: 'Sir Adison' },
      { subject: 'Reasoning',      teacher: 'Sir Umesh' },
      { subject: 'Passage',        teacher: 'Miss Devia' },
      { subject: 'Grammar',        teacher: 'Miss Fedrava' },
      { subject: 'Grammar',        teacher: 'Sir Bidyachandra' },
      { subject: 'Passage',        teacher: 'Miss Bidyarani' },
      { subject: 'Science',        teacher: 'Sir Shrinivash' },
    ],
  },
  {
    from: '7:20 AM', to: '8:10 AM',
    slots: [
      { subject: 'Maths II',       teacher: 'Sir Himan' },
      { subject: 'Reasoning',      teacher: 'Sir James' },
      { subject: 'GK & Science',   teacher: 'Sir Romesh' },
      { subject: 'Reasoning',      teacher: 'Sir Umesh' },
      { subject: 'Grammar',        teacher: 'Sir Adison' },
      { subject: 'Grammar',        teacher: 'Miss Fedrava' },
      { subject: 'Passage',        teacher: 'Miss Devia' },
      { subject: 'Passage',        teacher: 'Miss Bidyarani' },
      { subject: 'Grammar',        teacher: 'Sir Bidyachandra' },
      { subject: 'Reasoning',      teacher: 'Miss Geetanjali' },
    ],
  },
  // ── Evening ───────────────────────────────────────────────
  {
    from: '5:30 PM', to: '6:20 PM',
    slots: [
      { subject: 'Reasoning',      teacher: 'Sir Umesh' },
      { subject: 'Vocabulary',     teacher: 'Sir James' },
      { subject: 'Maths I',        teacher: 'Sir Himan' },
      { subject: 'General Knowledge', teacher: 'Miss Geetanjali' },
      { subject: 'Vocabulary',     teacher: 'Miss Bindyarani' },
      { subject: 'Maths II',       teacher: 'Sir Bronson' },
      { subject: 'Mental',         teacher: 'Sir Shrinivash' },
      { subject: 'Hindi',          teacher: 'Sir Boy' },
      null,
      null,
    ],
  },
  {
    from: '6:20 PM', to: '7:10 PM',
    slots: [
      { subject: 'Grammar',        teacher: 'Sir Adison' },
      { subject: 'Reasoning',      teacher: 'Sir Umesh' },
      { subject: 'Vocabulary',     teacher: 'Sir Romesh' },
      { subject: 'Grammar',        teacher: 'Miss Fedrava' },
      { subject: 'Vocabulary',     teacher: 'Miss Bindyarani' },
      { subject: 'General Knowledge', teacher: 'Miss Geetanjali' },
      { subject: 'Maths II',       teacher: 'Miss Deviya' },
      { subject: 'Maths I',        teacher: 'Sir Bidyachandra' },
      { subject: 'Vocabulary',     teacher: 'Sir Arjun' },
      null,
    ],
  },
  {
    from: '7:10 PM', to: '8:00 PM',
    slots: [
      { subject: 'Vocabulary',     teacher: 'Sir James' },
      { subject: 'Grammar',        teacher: 'Sir Adison' },
      { subject: 'Grammar',        teacher: 'Miss Fedrava' },
      { subject: 'Vocabulary',     teacher: 'Sir Romesh' },
      { subject: 'Science',        teacher: 'Sir Arunkumar' },
      { subject: 'Mental',         teacher: 'Sir Shrinivash' },
      null,
      { subject: 'Mathematics',    teacher: 'Miss Deviya' },
      null,
      null,
    ],
  },
  // ── Night ─────────────────────────────────────────────────
  {
    from: '9:00 PM', to: '10:00 PM',
    slots: [
      { subject: 'Mathematics I & II', teacher: 'Sir Bidyachandra' },
      { subject: 'Mathematics I & II', teacher: 'Miss Geetanjali & Miss Deviya' },
      { subject: 'Mathematics I & II', teacher: 'Sir Shrinivash & Sir Umesh' },
      { subject: 'Self Practice',  teacher: 'Miss Bidyarani' },
      { subject: 'Self Practice',  teacher: 'Sir Romesh' },
      { subject: 'Grammar',        teacher: 'Miss Fredava' },
      null, null, null, null,
    ],
  },
]

// ══════════════════════════════════════════════════════════════
//  SHARED — SubjectPill
// ══════════════════════════════════════════════════════════════
function SubjectPill({ subject, teacher, compact = false }) {
  if (!subject) return (
    <div style={{ padding: compact ? '4px 6px' : '8px 10px', borderRadius: '8px', background: '#f8fafc', color: '#cbd5e1', fontSize: '11px', textAlign: 'center', minHeight: compact ? 'auto' : '54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      —
    </div>
  )
  const c = subjectColor(subject)
  return (
    <div style={{
      borderRadius: '8px',
      background: c + '12',
      borderLeft: `3px solid ${c}`,
      padding: compact ? '6px 8px' : '8px 10px',
      minHeight: compact ? 'auto' : '54px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '2px',
    }}>
      <div style={{ fontSize: compact ? '10px' : '12px', fontWeight: '700', color: c, lineHeight: 1.2 }}>{subject}</div>
      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.2 }}>{teacher}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  SHARED — TeacherView: all classes for one teacher
// ══════════════════════════════════════════════════════════════
function TeacherSchedule({ teacher, timetableData, batches, title }) {
  const slots = timetableData
    .filter(row => !row.isBreak)
    .flatMap(row => {
      const matches = (row.slots || [])
        .map((s, i) => s && s.teacher && s.teacher.toLowerCase().includes(teacher.toLowerCase())
          ? { from: row.from, to: row.to, subject: s.subject, batch: batches[i] }
          : null
        )
        .filter(Boolean)
      return matches
    })

  if (slots.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
      No classes found for "{teacher}" in {title}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {slots.map((s, i) => {
        const p = batchPalette(s.batch)
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'white', borderRadius: '10px', padding: '10px 14px',
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            borderLeft: `4px solid ${p.color}`,
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: '700', whiteSpace: 'nowrap', minWidth: '120px' }}>
              {s.from} – {s.to}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: subjectColor(s.subject) }}>{s.subject}</div>
              <div style={{ fontSize: '12px', color: p.color, fontWeight: '600' }}>{s.batch}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: CLASS TIMETABLE
// ══════════════════════════════════════════════════════════════
export function ClassTimetableTab() {
  const [view, setView] = useState('grid')          // 'grid' | 'batch' | 'teacher'
  const [selectedBatch, setSelectedBatch] = useState(CLASS_BATCHES[0])
  const [teacherSearch, setTeacherSearch] = useState('')
  const [highlightSubject, setHighlightSubject] = useState('')

  // Collect unique teachers from class timetable
  const allTeachers = useMemo(() => {
    const set = new Set()
    CLASS_TIMETABLE.forEach(row => {
      ;(row.slots || []).forEach(s => { if (s?.teacher) set.add(s.teacher) })
    })
    return [...set].sort()
  }, [])

  const teacherMatches = useMemo(() => {
    if (!teacherSearch.trim()) return []
    return allTeachers.filter(t => t.toLowerCase().includes(teacherSearch.toLowerCase())).slice(0, 8)
  }, [teacherSearch, allTeachers])

  const batchIndex = CLASS_BATCHES.indexOf(selectedBatch)
  const batchSlots = CLASS_TIMETABLE.filter(r => !r.isBreak && r.slots[batchIndex])

  const uniqueSubjects = useMemo(() => {
    const set = new Set()
    CLASS_TIMETABLE.forEach(r => (r.slots || []).forEach(s => { if (s?.subject) set.add(s.subject) }))
    return [...set].sort()
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>🗓️ Class Timetable</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Mon–Sat · {CLASS_BATCHES.length} batches · Fixed schedule</p>
        </div>
        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
          {[['grid', '⊞ Full Grid'], ['batch', '👥 By Batch'], ['teacher', '👤 By Teacher']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600',
              background: view === id ? '#1e3a5f' : 'transparent',
              color: view === id ? 'white' : '#64748b', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── FULL GRID VIEW ─────────────────────────────────── */}
      {view === 'grid' && (
        <>
          {/* Subject highlight filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Highlight:</span>
            <button onClick={() => setHighlightSubject('')} style={{
              ...btn(highlightSubject === '' ? '#1e3a5f' : '#f1f5f9', highlightSubject === '' ? 'white' : '#374151'),
              padding: '5px 12px', fontSize: '11px',
            }}>All</button>
            {uniqueSubjects.map(s => (
              <button key={s} onClick={() => setHighlightSubject(s === highlightSubject ? '' : s)} style={{
                padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: '600',
                cursor: 'pointer',
                background: highlightSubject === s ? subjectColor(s) : subjectColor(s) + '18',
                color: highlightSubject === s ? 'white' : subjectColor(s),
              }}>{s}</button>
            ))}
          </div>

          {/* Batch legend */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {CLASS_BATCHES.map(b => {
              const p = batchPalette(b)
              return (
                <span key={b} style={{
                  padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                  background: p.bg, color: p.color, border: `1px solid ${p.border}`,
                }}>{b}</span>
              )
            })}
          </div>

          {/* Full table */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  <th style={{ padding: '12px 14px', color: 'white', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap', minWidth: '140px' }}>Time</th>
                  {CLASS_BATCHES.map(b => {
                    const p = batchPalette(b)
                    return (
                      <th key={b} style={{ padding: '10px 8px', textAlign: 'center', minWidth: '120px' }}>
                        <div style={{ background: p.bg, color: p.color, borderRadius: '8px', padding: '4px 8px', fontWeight: '700', fontSize: '11px' }}>{b}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {CLASS_TIMETABLE.map((row, ri) => {
                  if (row.isBreak) return (
                    <tr key={ri} style={{ background: '#fef9c3' }}>
                      <td colSpan={CLASS_BATCHES.length + 1} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#92400e', fontSize: '13px' }}>
                        {row.label}  ·  {row.from} – {row.to}
                      </td>
                    </tr>
                  )
                  return (
                    <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: '700', whiteSpace: 'nowrap', background: '#f8fafc', borderRight: '2px solid #e2e8f0' }}>
                        {row.from}<br />
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>{row.to}</span>
                      </td>
                      {CLASS_BATCHES.map((b, bi) => {
                        const s = row.slots[bi]
                        const dimmed = highlightSubject && s?.subject !== highlightSubject
                        return (
                          <td key={b} style={{ padding: '6px 6px', verticalAlign: 'top', opacity: dimmed ? 0.25 : 1, transition: 'opacity .15s' }}>
                            <SubjectPill subject={s?.subject} teacher={s?.teacher} />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── BY BATCH VIEW ─────────────────────────────────── */}
      {view === 'batch' && (
        <div>
          {/* Batch selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {CLASS_BATCHES.map(b => {
              const p = batchPalette(b)
              return (
                <button key={b} onClick={() => setSelectedBatch(b)} style={{
                  padding: '8px 16px', borderRadius: '10px', border: `2px solid ${selectedBatch === b ? p.color : p.border}`,
                  background: selectedBatch === b ? p.bg : 'white', color: p.color,
                  fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all .15s',
                }}>{b}</button>
              )
            })}
          </div>

          {/* Batch schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CLASS_TIMETABLE.map((row, ri) => {
              if (row.isBreak) return (
                <div key={ri} style={{ background: '#fef9c3', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#92400e', fontSize: '13px' }}>
                  {row.label}  ·  {row.from} – {row.to}
                </div>
              )
              const s = row.slots[batchIndex]
              if (!s) return (
                <div key={ri} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', opacity: 0.5 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', minWidth: '140px' }}>{row.from} – {row.to}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>— No class</span>
                </div>
              )
              const p = batchPalette(selectedBatch)
              return (
                <div key={ri} style={{
                  display: 'flex', gap: '12px', alignItems: 'center',
                  background: 'white', borderRadius: '10px', padding: '12px 16px',
                  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
                  borderLeft: `4px solid ${subjectColor(s.subject)}`,
                }}>
                  <div style={{ minWidth: '140px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: '700' }}>
                    {row.from} – {row.to}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: subjectColor(s.subject) }}>{s.subject}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>👨‍🏫 {s.teacher}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BY TEACHER VIEW ────────────────────────────────── */}
      {view === 'teacher' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <label style={lbl}>Search Teacher</label>
            <div style={{ position: 'relative' }}>
              <input
                value={teacherSearch}
                onChange={e => setTeacherSearch(e.target.value)}
                placeholder="Type a teacher's name..."
                style={inp}
                type="search"
              />
              {teacherMatches.length > 0 && !allTeachers.includes(teacherSearch) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                  border: '1px solid #d1d5db', borderRadius: '10px', zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: '4px', overflow: 'hidden',
                }}>
                  {teacherMatches.map(t => (
                    <div key={t} onClick={() => setTeacherSearch(t)}
                      style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >{t}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {teacherSearch.trim() && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e3a5f', margin: '0 0 12px' }}>
                📋 {teacherSearch}'s Class Schedule
              </h3>
              <TeacherSchedule teacher={teacherSearch} timetableData={CLASS_TIMETABLE} batches={CLASS_BATCHES} title="Class Timetable" />
            </div>
          )}

          {!teacherSearch.trim() && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {allTeachers.map(t => {
                const classCount = CLASS_TIMETABLE.filter(r => !r.isBreak)
                  .flatMap(r => r.slots || [])
                  .filter(s => s?.teacher === t).length
                return (
                  <button key={t} onClick={() => setTeacherSearch(t)} style={{
                    background: 'white', borderRadius: '10px', padding: '12px 14px',
                    border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#1e3a5f' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>👤 {t}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{classCount} class slot{classCount !== 1 ? 's' : ''}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: DOUBT SESSION
// ══════════════════════════════════════════════════════════════
export function DoubtSessionTab() {
  const [view, setView] = useState('grid')           // 'grid' | 'batch' | 'teacher'
  const [selectedBatch, setSelectedBatch] = useState(DOUBT_BATCHES[0])
  const [teacherSearch, setTeacherSearch] = useState('')
  const [sessionFilter, setSessionFilter] = useState('All')  // All | Morning | Evening | Night

  // Unique teachers from doubt sessions
  const allTeachers = useMemo(() => {
    const set = new Set()
    DOUBT_SESSIONS.forEach(row => (row.slots || []).forEach(s => { if (s?.teacher) set.add(s.teacher) }))
    return [...set].sort()
  }, [])

  const teacherMatches = useMemo(() => {
    if (!teacherSearch.trim()) return []
    return allTeachers.filter(t => t.toLowerCase().includes(teacherSearch.toLowerCase())).slice(0, 8)
  }, [teacherSearch, allTeachers])

  const sessionOf = (from) => {
    const h = parseInt(from.split(':')[0])
    const ampm = from.includes('PM') ? 'PM' : 'AM'
    if (ampm === 'AM') return 'Morning'
    if (h >= 9) return 'Night'
    return 'Evening'
  }

  const filteredRows = useMemo(() => {
    if (sessionFilter === 'All') return DOUBT_SESSIONS
    return DOUBT_SESSIONS.filter(r => sessionOf(r.from) === sessionFilter)
  }, [sessionFilter])

  const batchIndex = DOUBT_BATCHES.indexOf(selectedBatch)

  // Colour for 10 sub-batches (extend batch palette logic)
  const batchPaletteDoubt = (name) => {
    if (name.includes('Achiever')) return BATCH_PALETTE['Achiever']
    if (name.includes('Leader'))   return BATCH_PALETTE['Leader']
    if (name.includes('Champion')) return BATCH_PALETTE['Champion']
    if (name.includes('Lakshya'))  return BATCH_PALETTE['Lakshya']
    if (name.includes('Umeed'))    return BATCH_PALETTE['Umeed']
    if (name.includes('Elite'))    return BATCH_PALETTE['Elite']
    if (name.includes('Prime'))    return BATCH_PALETTE['Prime']
    return { color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
  }

  const SESSION_ICONS = { Morning: '🌅', Evening: '🌆', Night: '🌙' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a5f', margin: 0 }}>🙋 Doubt Sessions</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Mon–Sat · Morning, Evening & Night slots · {DOUBT_BATCHES.length} sub-batches</p>
        </div>
        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
          {[['grid', '⊞ Full Grid'], ['batch', '👥 By Batch'], ['teacher', '👤 By Teacher']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600',
              background: view === id ? '#1e3a5f' : 'transparent',
              color: view === id ? 'white' : '#64748b', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Session filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['All', 'Morning', 'Evening', 'Night'].map(s => (
          <button key={s} onClick={() => setSessionFilter(s)} style={{
            padding: '7px 16px', borderRadius: '99px', border: 'none', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
            background: sessionFilter === s ? '#1e3a5f' : '#f1f5f9',
            color: sessionFilter === s ? 'white' : '#64748b',
          }}>
            {SESSION_ICONS[s] || '•'} {s}
          </button>
        ))}
      </div>

      {/* ── FULL GRID VIEW ─────────────────────────────────── */}
      {view === 'grid' && (
        <>
          {/* Sub-batch legend */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {DOUBT_BATCHES.map(b => {
              const p = batchPaletteDoubt(b)
              return (
                <span key={b} style={{
                  padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                  background: p.bg, color: p.color, border: `1px solid ${p.border}`,
                }}>{b}</span>
              )
            })}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  <th style={{ padding: '12px 14px', color: 'white', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap', minWidth: '130px' }}>Time</th>
                  {DOUBT_BATCHES.map(b => {
                    const p = batchPaletteDoubt(b)
                    return (
                      <th key={b} style={{ padding: '8px 6px', textAlign: 'center', minWidth: '105px' }}>
                        <div style={{ background: p.bg, color: p.color, borderRadius: '8px', padding: '4px 6px', fontWeight: '700', fontSize: '10px' }}>{b}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, ri) => {
                  const session = sessionOf(row.from)
                  return (
                    <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '8px 14px', background: '#f8fafc', borderRight: '2px solid #e2e8f0', verticalAlign: 'middle' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#1e3a5f', fontWeight: '700' }}>{row.from}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94a3b8' }}>{row.to}</div>
                        <div style={{ fontSize: '10px', marginTop: '4px' }}>{SESSION_ICONS[session]} {session}</div>
                      </td>
                      {DOUBT_BATCHES.map((b, bi) => {
                        const s = row.slots[bi]
                        return (
                          <td key={b} style={{ padding: '5px 5px', verticalAlign: 'top' }}>
                            <SubjectPill subject={s?.subject} teacher={s?.teacher} compact />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── BY BATCH VIEW ─────────────────────────────────── */}
      {view === 'batch' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {DOUBT_BATCHES.map(b => {
              const p = batchPaletteDoubt(b)
              return (
                <button key={b} onClick={() => setSelectedBatch(b)} style={{
                  padding: '7px 14px', borderRadius: '10px',
                  border: `2px solid ${selectedBatch === b ? p.color : p.border}`,
                  background: selectedBatch === b ? p.bg : 'white',
                  color: p.color, fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                }}>{b}</button>
              )
            })}
          </div>

          {/* Group by session */}
          {['Morning', 'Evening', 'Night'].map(session => {
            const rows = filteredRows.filter(r => sessionOf(r.from) === session)
            if (rows.length === 0) return null
            const batchRows = rows.filter(r => r.slots[batchIndex])
            if (batchRows.length === 0 && sessionFilter !== 'All') return null
            return (
              <div key={session} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e3a5f', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {SESSION_ICONS[session]} {session} Doubt
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rows.map((row, ri) => {
                    const s = row.slots[batchIndex]
                    if (!s) return (
                      <div key={ri} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', opacity: 0.5 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', minWidth: '130px' }}>{row.from} – {row.to}</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>— No session</span>
                      </div>
                    )
                    return (
                      <div key={ri} style={{
                        display: 'flex', gap: '12px', alignItems: 'center',
                        background: 'white', borderRadius: '10px', padding: '12px 16px',
                        boxShadow: '0 1px 6px rgba(0,0,0,.06)',
                        borderLeft: `4px solid ${subjectColor(s.subject)}`,
                      }}>
                        <div style={{ minWidth: '130px', fontFamily: 'monospace', fontSize: '12px', color: '#1e3a5f', fontWeight: '700' }}>{row.from} – {row.to}</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: subjectColor(s.subject) }}>{s.subject}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>👨‍🏫 {s.teacher}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── BY TEACHER VIEW ────────────────────────────────── */}
      {view === 'teacher' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <label style={lbl}>Search Teacher</label>
            <div style={{ position: 'relative' }}>
              <input
                value={teacherSearch}
                onChange={e => setTeacherSearch(e.target.value)}
                placeholder="Type a teacher's name..."
                style={inp}
                type="search"
              />
              {teacherMatches.length > 0 && !allTeachers.includes(teacherSearch) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                  border: '1px solid #d1d5db', borderRadius: '10px', zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: '4px', overflow: 'hidden',
                }}>
                  {teacherMatches.map(t => (
                    <div key={t} onClick={() => setTeacherSearch(t)}
                      style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >{t}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {teacherSearch.trim() && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e3a5f', margin: '0 0 12px' }}>
                📋 {teacherSearch}'s Doubt Session Schedule
              </h3>
              <TeacherSchedule teacher={teacherSearch} timetableData={filteredRows} batches={DOUBT_BATCHES} title="Doubt Session" />
            </div>
          )}

          {!teacherSearch.trim() && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {allTeachers.map(t => {
                const slotCount = DOUBT_SESSIONS.flatMap(r => r.slots || []).filter(s => s?.teacher === t).length
                return (
                  <button key={t} onClick={() => setTeacherSearch(t)} style={{
                    background: 'white', borderRadius: '10px', padding: '12px 14px',
                    border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#1e3a5f' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>👤 {t}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{slotCount} doubt slot{slotCount !== 1 ? 's' : ''}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
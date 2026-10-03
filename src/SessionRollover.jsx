import { useMemo, useState } from 'react'

// April-changeover PLANNER. Read-only: nothing here writes to the database.
// Plan choices are local component state; checklist ticks live in localStorage.

const NAVY = '#1e3a6e'
const n = v => Number(v || 0).toLocaleString('en-IN')
const s = v => String(v ?? '').trim()
const LS_KEY = 'gnsi_session_rollover_checklist'

const STEPS = [
  { key: 'fee_setup', label: 'Set the new fee structure for the next session in Fee Setup' },
  { key: 'promote', label: 'Run promotions in the Students module (batch / class update)' },
  { key: 'dues', label: 'Clear or resolve outstanding dues (carry forward or settle)' },
  { key: 'gcc', label: 'Issue new GCC / admission for the new batch intake' },
  { key: 'daybooks', label: 'Close the Day books for March' },
]

function sessionLabels() {
  const d = new Date()
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const fmt = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  return { current: fmt(startYear), next: fmt(startYear + 1), startYear }
}

function readChecks() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {} } catch { return {} }
}

function downloadCsv(rows, filename) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function SessionRollover({ students = [], liveRows = [], isAdmin }) {
  const [choices, setChoices] = useState({})
  const [checks, setChecks] = useState(readChecks)
  const [q, setQ] = useState('')
  const [courseF, setCourseF] = useState('All')

  const sess = useMemo(() => sessionLabels(), [])

  const people = useMemo(() => {
    const dueById = new Map(), dueByGcc = new Map()
    for (const r of liveRows || []) {
      const d = Number(r.totalDue ?? r.dues?.totalDue ?? 0) || 0
      if (r.id != null) dueById.set(String(r.id), d)
      if (s(r.gcc_no)) dueByGcc.set(s(r.gcc_no), d)
    }
    return (students || [])
      .filter(x => !x.deleted_at && (!s(x.status) || s(x.status).toLowerCase() === 'active'))
      .map(x => ({
        id: String(x.id ?? x.gcc_no), gcc: s(x.gcc_no), name: s(x.name) || '—', course: s(x.course) || '—',
        batch: s(x.batch) || s(x.class_name) || '—', repeater: !!x.is_repeater,
        due: dueById.get(String(x.id)) ?? dueByGcc.get(s(x.gcc_no)) ?? 0,
      }))
      .sort((a, b) => a.course.localeCompare(b.course) || a.batch.localeCompare(b.batch) || a.name.localeCompare(b.name))
  }, [students, liveRows])

  const choiceOf = p => choices[p.id] || (p.repeater ? 'Repeat' : 'Promote')

  const groups = useMemo(() => {
    const m = new Map()
    for (const p of people) {
      const k = `${p.course}||${p.batch}`
      const g = m.get(k) || { course: p.course, batch: p.batch, active: 0, repeaters: 0, withDues: 0, dues: 0 }
      g.active++
      if (p.repeater) g.repeaters++
      if (p.due > 0) { g.withDues++; g.dues += p.due }
      m.set(k, g)
    }
    return [...m.values()]
  }, [people])

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: '#8a93a6' }}>🔒 Admin only</div>

  const courses = ['All', ...Array.from(new Set(people.map(p => p.course))).sort()]
  const needle = q.trim().toLowerCase()
  const shown = people.filter(p => (courseF === 'All' || p.course === courseF) &&
    (!needle || [p.name, p.gcc, p.batch, p.course].some(v => String(v).toLowerCase().includes(needle))))
  const totalDues = people.reduce((t, p) => t + p.due, 0)
  const tally = { Promote: 0, Repeat: 0, Leaving: 0 }
  for (const p of people) tally[choiceOf(p)]++
  const doneCount = STEPS.filter(x => checks[x.key]).length

  const toggle = key => {
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  const exportPlan = () => downloadCsv(people.map(p => ({
    gcc_no: p.gcc, name: p.name, course: p.course, current_batch: p.batch, current_session: sess.current,
    next_session: sess.next, plan: choiceOf(p), repeater: p.repeater ? 'Yes' : 'No', dues_carried_forward: p.due,
  })), `session_rollover_plan_${sess.next}.csv`)

  const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
  const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }
  const card = { background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }
  const cardHead = { padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: NAVY }
  const btn = { padding: '7px 12px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
  const choiceColor = { Promote: '#16a34a', Repeat: '#b45309', Leaving: '#dc2626' }

  return (
    <div>
      <div style={{ padding: '12px 16px', marginBottom: 14, background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 12, color: '#92400e', fontSize: 13, fontWeight: 700 }}>
        ⚠ Planning tool only — this page does NOT change any student, fee or session data. Your choices below are not saved.
      </div>

      <div style={{ ...card, padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>🔁 Session rollover planner</div>
          <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>Current session {sess.current} (April–March) → next session {sess.next} (from 1 April {sess.startYear + 1})</div>
        </div>
        {[['Active', people.length, NAVY], ['Promote', tally.Promote, '#16a34a'], ['Repeat', tally.Repeat, '#b45309'], ['Leaving', tally.Leaving, '#dc2626'], ['Dues carried', `₹${n(totalDues)}`, '#dc2626']].map(([l, v, c]) => (
          <div key={l} style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5d6b82', textTransform: 'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={cardHead}>✅ Changeover checklist ({doneCount}/{STEPS.length})</div>
        <div style={{ padding: '8px 16px' }}>
          {STEPS.map(x => (
            <label key={x.key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 13, color: checks[x.key] ? '#8a93a6' : '#14213d', textDecoration: checks[x.key] ? 'line-through' : 'none', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!checks[x.key]} onChange={() => toggle(x.key)} style={{ width: 16, height: 16 }} />
              {x.label}
            </label>
          ))}
          <div style={{ fontSize: 11, color: '#8a93a6', paddingTop: 4 }}>Ticks are remembered in this browser only.</div>
        </div>
      </div>

      <div style={card}>
        <div style={cardHead}>By course and batch</div>
        {groups.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#8a93a6', fontSize: 13 }}>No active students.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Course', 'Batch', 'Active', 'Repeaters', 'With dues', 'Dues carried forward'].map((h, i) => <th key={h} style={{ ...head, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={`${g.course}${g.batch}`}>
                    <td style={{ ...cell, fontWeight: 700 }}>{g.course}</td>
                    <td style={cell}>{g.batch}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{g.active}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{g.repeaters}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{g.withDues}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 800, color: g.dues ? '#dc2626' : '#14213d' }}>₹{n(g.dues)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ ...cardHead, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 140 }}>Per-student plan ({shown.length})</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC…" style={{ padding: '7px 10px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 12.5, minWidth: 150, fontWeight: 400 }} />
          <select value={courseF} onChange={e => setCourseF(e.target.value)} style={{ padding: '7px 8px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 12.5 }}>
            {courses.map(c => <option key={c}>{c}</option>)}
          </select>
          <button style={btn} onClick={() => setChoices({})}>Reset choices</button>
          <button style={btn} disabled={!people.length} onClick={exportPlan}>⬇ Export plan CSV</button>
        </div>
        {shown.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#8a93a6', fontSize: 13 }}>No students match.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['GCC', 'Name', 'Course', 'Batch', 'Repeater', 'Dues carried', 'Plan'].map((h, i) => <th key={h} style={{ ...head, textAlign: h === 'Dues carried' ? 'right' : 'left', ...(i === 6 ? {} : {}) }}>{h}</th>)}</tr></thead>
              <tbody>
                {shown.slice(0, 600).map(p => {
                  const c = choiceOf(p)
                  return (
                    <tr key={p.id}>
                      <td style={{ ...cell, fontWeight: 700 }}>{p.gcc || '—'}</td>
                      <td style={cell}>{p.name}</td>
                      <td style={cell}>{p.course}</td>
                      <td style={cell}>{p.batch}</td>
                      <td style={cell}>{p.repeater ? 'Yes' : '—'}</td>
                      <td style={{ ...cell, textAlign: 'right', color: p.due ? '#dc2626' : '#14213d', fontWeight: p.due ? 800 : 400 }}>₹{n(p.due)}</td>
                      <td style={cell}>
                        <select value={c} onChange={e => setChoices(prev => ({ ...prev, [p.id]: e.target.value }))}
                          style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${choiceColor[c]}`, color: choiceColor[c], fontWeight: 800, fontSize: 12, background: 'white' }}>
                          <option>Promote</option><option>Repeat</option><option>Leaving</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 600 && <div style={{ padding: '8px 16px', fontSize: 11, color: '#5d6b82' }}>Showing first 600; filter or export CSV for all.</div>}
      </div>
    </div>
  )
}

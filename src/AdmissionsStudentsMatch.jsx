// AdmissionsStudentsMatch.jsx — "Admissions ↔ Students": every GCC number checked on both sides — records that exist
// in only one module, duplicate GCC numbers, and shared fields (name, course, batch, phone…) that disagree. Read-only.
import { useEffect, useMemo, useState } from 'react'
import { fetchAll } from './duesSnapshot'
import { matchAdmissionsStudents } from './lib/admStudentMatch'

const INK = '#0b1730', NAVY = '#132a4f', SUB = '#6a7592'
const card = { background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 8px 24px -14px rgba(20,33,61,.35)' }
const btn = { padding: '7px 13px', borderRadius: 10, border: '1px solid #d6dae6', background: '#fff', color: INK, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: SUB, background: '#f4f6fb', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid #eef0f6', verticalAlign: 'top' }

const SECTIONS = [
  { key: 'enrolledNoStudent', tone: 'bad', module: 'students', title: 'Enrolled in Admissions, but no student record', help: 'The application says Enrolled but there is no student with that GCC number — enrolment did not complete, or the GCC differs.', cols: [] },
  { key: 'studentNoAdmission', tone: 'warn', module: 'admissions', title: 'Active students with no admission record', help: 'Added straight to the roster (or bulk-imported) — fees and reports that start from Admissions cannot see them.', cols: [] },
  { key: 'studentButNotEnrolled', tone: 'warn', module: 'admissions', title: 'Student exists, but the admission is not marked Enrolled', help: 'The admission status is behind the student record.', cols: [['Admission', 'admStatus'], ['Student', 'stuStatus']] },
  { key: 'statusDiff', tone: 'warn', module: 'students', title: 'Dropout / inactive student whose admission still says Enrolled', help: 'Status changed in Students only.', cols: [['Admission', 'admStatus'], ['Student', 'stuStatus']] },
  { key: 'duplicates', tone: 'bad', module: 'students', title: 'Duplicate GCC numbers', help: 'The same GCC number appears more than once in one module.', cols: [['Module', 'where'], ['Rows', 'count']] },
  { key: 'fieldDiffs', tone: 'warn', module: 'students', title: 'Fields that disagree between the two modules', help: 'Editing one side should update the other; these were changed outside the sync (or before it existed).', cols: [['Field', 'field'], ['Admissions', 'adm'], ['Students', 'stu'], ['Problem', 'type']] },
]

export default function AdmissionsStudentsMatch({ onNavigate }) {
  const [raw, setRaw] = useState(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState({})
  const [field, setField] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [admissions, students] = await Promise.all([fetchAll('admissions', '*'), fetchAll('students', '*')])
        if (live) { setRaw({ admissions, students }); setErr('') }
      } catch (e) { if (live) setErr(e.message || 'Could not load') }
    })()
    return () => { live = false }
  }, [tick])
  const r = useMemo(() => raw ? matchAdmissionsStudents(raw) : null, [raw])

  const exportCsv = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = []
    for (const s of SECTIONS) for (const x of r[s.key]) rows.push([s.title, x.gcc, x.name, x.field || '', x.adm ?? x.admStatus ?? '', x.stu ?? x.stuStatus ?? '', x.type || x.where || ''])
    const text = '﻿' + [['Issue', 'GCC', 'Name', 'Field', 'Admissions', 'Students', 'Problem'], ...rows].map(a => a.map(q).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = 'admissions-vs-students.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const reload = () => { setRaw(null); setTick(t => t + 1) }

  if (err) return <div style={{ ...card, color: '#b23a48' }}>Could not run the check: {err} <button type="button" style={btn} onClick={reload}>Retry</button></div>
  if (!r) return <div style={{ ...card, color: SUB }}>Comparing Admissions with Students…</div>
  const total = SECTIONS.reduce((t, s) => t + r[s.key].length, 0)
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Admissions', r.admissionsCount], ['Students', r.studentsCount], ['Matched by GCC', r.paired], ['Things to fix', total]].map(([k, v]) => (
          <div key={k} style={{ ...card, flex: '1 1 140px', padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, color: SUB }}>{k}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k === 'Things to fix' ? (total ? '#b23a48' : '#1e7a55') : INK, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-IN')}</div>
          </div>))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" style={btn} onClick={reload}>↻ Re-check</button>
          {total > 0 && <button type="button" style={{ ...btn, background: NAVY, color: '#fff', borderColor: NAVY }} onClick={exportCsv}>⬇ Export</button>}
        </div>
      </div>
      {SECTIONS.map(s => {
        const all = r[s.key], rows = s.key === 'fieldDiffs' && field ? all.filter(x => x.field === field) : all
        const on = !!open[s.key], color = !all.length ? '#1e7a55' : s.tone === 'bad' ? '#b23a48' : '#8a6a1f'
        return (
          <div key={s.key} style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 10 }}>
            <button type="button" disabled={!all.length} onClick={() => setOpen(o => ({ ...o, [s.key]: !on }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 0, background: 'transparent', textAlign: 'left', cursor: all.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: INK }}>{s.title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: SUB, marginTop: 1 }}>{all.length ? s.help : 'All good ✓'}</span>
              </span>
              <span style={{ fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{all.length}</span>
              {all.length > 0 && <span style={{ color: SUB }}>{on ? '▾' : '▸'}</span>}
            </button>
            {on && all.length > 0 && (
              <div style={{ borderTop: '1px solid #eef0f6' }}>
                {s.key === 'fieldDiffs' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px' }}>
                    <button type="button" style={{ ...btn, ...(field ? {} : { background: NAVY, color: '#fff' }) }} onClick={() => setField('')}>All ({all.length})</button>
                    {Object.entries(r.fieldCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => <button key={f} type="button" style={{ ...btn, ...(field === f ? { background: NAVY, color: '#fff' } : {}) }} onClick={() => setField(f)}>{f} ({n})</button>)}
                  </div>)}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead><tr><th style={th}>GCC</th><th style={th}>Name</th>{s.cols.map(([h]) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{rows.slice(0, 300).map((x, i) => (
                      <tr key={i}><td style={td}>{x.gcc}</td><td style={td}>{x.name}</td>{s.cols.map(([h, k]) => <td key={h} style={td}>{String(x[k] === '' || x[k] == null ? '—' : x[k])}</td>)}</tr>))}
                    </tbody>
                  </table>
                  {rows.length > 300 && <div style={{ padding: 10, fontSize: 12, color: SUB }}>Showing the first 300 of {rows.length} — use Export for all.</div>}
                </div>
                {onNavigate && <div style={{ padding: '10px 14px' }}><button type="button" style={btn} onClick={() => onNavigate(s.module)}>Open {s.module === 'students' ? 'Students' : 'Admissions'} →</button></div>}
              </div>)}
          </div>)
      })}
    </div>
  )
}

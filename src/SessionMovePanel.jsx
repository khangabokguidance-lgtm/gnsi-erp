// SessionMovePanel.jsx — move every current student to one session, with a preview first.
// Nothing is written until the admin confirms; a CSV of the old sessions is saved first so it can be undone.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { fetchAll } from './duesSnapshot'
import { planSessionMove } from './lib/sessionMove'
import { NAVY, cardFlush as card, btn, cell, head } from './feeTheme'

const csv = (rows, name) => {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const cols = Object.keys(rows[0] || {})
  const text = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function SessionMovePanel() {
  const [students, setStudents] = useState(null)
  const [sessions, setSessions] = useState([])
  const [target, setTarget] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [stu, ses] = await Promise.all([
          fetchAll('students', 'id, gcc_no, name, course, batch, session, status, deleted_at'),
          supabase.from('admission_sessions').select('*'),
        ])
        if (!live) return
        const rows = [...(ses.data || [])].sort((x, y) => String(y.session_name).localeCompare(String(x.session_name)))   // newest first
        const names = rows.map(x => x.session_name).filter(Boolean)
        setStudents(stu); setSessions(names)
        setTarget(t => t || rows.find(x => x.is_active)?.session_name || names[0] || '')
      } catch (e) { if (live) setErr(e.message || 'Could not load students') }
    })()
    return () => { live = false }
  }, [tick])

  const plan = useMemo(() => (students && target ? planSessionMove(students, target) : null), [students, target])

  const apply = async () => {
    if (!plan?.moves.length) return
    if (!window.confirm(`Move ${plan.moves.length} student${plan.moves.length > 1 ? 's' : ''} to session ${target}?\n\nA file with their current sessions is saved first so this can be undone.`)) return
    setBusy(true); setErr('')
    try {
      csv(plan.moves.map(m => ({ id: m.id, gcc_no: m.gcc, name: m.name, old_session: m.from, new_session: m.to })), `students_session_before_${target}_${new Date().toISOString().slice(0, 10)}.csv`)
      let ok = 0
      for (let i = 0; i < plan.moves.length; i += 200) {
        const ids = plan.moves.slice(i, i + 200).map(m => m.id)
        const { error } = await supabase.from('students').update({ session: target }).in('id', ids)
        if (error) throw new Error(`${ok} moved, then: ${error.message}`)
        ok += ids.length
      }
      try { window.dispatchEvent(new CustomEvent('gnsi:students-updated', { detail: { type: 'session_move', session: target } })) } catch { /* other modules refresh on their own */ }
      setDone({ ok, target })
      setStudents(null); setTick(t => t + 1)
    } catch (e) { setErr(e.message || 'Could not update'); }
    setBusy(false)
  }

  const th = { ...head, textAlign: 'left' }
  return (
    <div style={{ ...card, padding: 0, marginBottom: 14 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: NAVY }}>Move students to a session</div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12.5, color: '#5a6b7f', marginBottom: 10 }}>
          Sets the session of every <strong>current</strong> student (not archived, not Dropout / Inactive / Passed Out) to the session you pick. Nothing changes until you press Apply; a file with the old sessions is saved first.
        </div>
        {err && <div style={{ color: '#b42318', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        {done && <div style={{ color: '#047857', fontSize: 13, marginBottom: 8 }}>✓ Moved {done.ok} student{done.ok > 1 ? 's' : ''} to {done.target}.</div>}
        {!students && !err && <div style={{ color: '#8a93a6', fontSize: 13 }}>Loading students…</div>}
        {students && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5a6b7f' }}>Move to</label>
              <select value={target} onChange={e => { setTarget(e.target.value); setDone(null) }} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d9d4c5', fontSize: 13 }}>
                {sessions.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <button type="button" style={btn} onClick={() => { setStudents(null); setTick(t => t + 1) }}>↻ Reload</button>
              <span style={{ flex: 1 }} />
              <button type="button" disabled={busy || !plan?.moves.length} onClick={apply}
                style={{ ...btn, background: plan?.moves.length ? NAVY : '#cbd5e1', color: '#fff', borderColor: 'transparent', opacity: busy ? .6 : 1 }}>
                {busy ? 'Updating…' : `Apply to ${plan?.moves.length || 0} student${plan?.moves.length === 1 ? '' : 's'}`}
              </button>
            </div>
            {plan && (
              <>
                <div style={{ fontSize: 12.5, color: '#3a4b60', marginBottom: 8 }}>
                  <strong>{plan.moves.length}</strong> to move · {plan.alreadyThere} already in {target} · {plan.notCurrent} not current (left alone)
                  {Object.keys(plan.bySource).length > 0 && <> · from: {Object.entries(plan.bySource).map(([k, v]) => `${k} (${v})`).join(', ')}</>}
                </div>
                {plan.moves.length > 0 && (
                  <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #e8e3d8', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                      <thead><tr>{['GCC', 'Name', 'Course', 'Batch', 'Session now', 'Session after'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>{plan.moves.slice(0, 300).map(m => (
                        <tr key={m.id}><td style={cell}>{m.gcc}</td><td style={cell}>{m.name}</td><td style={cell}>{m.course}</td><td style={cell}>{m.batch}</td><td style={cell}>{m.from || '—'}</td><td style={{ ...cell, fontWeight: 700, color: '#047857' }}>{m.to}</td></tr>))}
                      </tbody>
                    </table>
                    {plan.moves.length > 300 && <div style={{ padding: 8, fontSize: 12, color: '#8a93a6' }}>Showing the first 300 of {plan.moves.length}.</div>}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

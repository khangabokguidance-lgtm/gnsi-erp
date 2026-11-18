import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

// Group list: every housemaster's class and saved groups, with the students in each (read-only, all staff).
const NAVY = '#0B1E3D', GOLD = '#C9A24B', LINE = '#e2e8f0'
const CLASS_ROW = '__my_class__'
const card = { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 1px 2px rgba(11,30,61,.04), 0 14px 30px -22px rgba(11,30,61,.28)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: NAVY }
const inp = { padding: '9px 12px', border: '1.5px solid #d3dbe7', borderRadius: 11, fontSize: 14, boxSizing: 'border-box', minHeight: 42, background: '#fff', color: NAVY, fontFamily: 'inherit', minWidth: 0 }
const btn = { padding: '9px 16px', borderRadius: 11, border: '1.5px solid #d3dbe7', background: '#fff', color: NAVY, fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 42, fontFamily: 'inherit' }
const h = { fontSize: 11.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 12px' }

export default function HouseMarksGroups({ school = [], isAdmin = false }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState('')
  const [open, setOpen] = useState({})
  const [busy, setBusy] = useState(false)
  const [addQ, setAddQ] = useState({})
  const [note, setNote] = useState('')
  // admin only: change any housemaster's list
  const setIds = async (g, ids) => {
    const { error } = await supabase.from('house_test_groups').update({ student_ids: ids, updated_at: new Date().toISOString() }).eq('id', g.id)
    if (error) { setNote('Could not save: ' + error.message); return }
    setRows(rs => (rs || []).map(r => r.id === g.id ? { ...r, student_ids: ids } : r)); setNote('')
  }
  const delGroup = async g => {
    if (!window.confirm(`Delete "${g.name}" of ${g.owner}? The students themselves are not affected.`)) return
    const { error } = await supabase.from('house_test_groups').delete().eq('id', g.id)
    if (error) { setNote('Could not delete: ' + error.message); return }
    setRows(rs => (rs || []).filter(r => r.id !== g.id)); setNote('')
  }

  const load = async () => {
    setRows(null); setErr('')
    const { data, error } = await supabase.from('house_test_groups').select('id,owner,name,student_ids,updated_at').order('owner').order('name').limit(1000)
    if (error) { setErr(/house_test_groups/i.test(error.message || '') ? 'Groups are not set up yet: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Could not load: ' + error.message); setRows([]); return }
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const byId = useMemo(() => { const m = {}; school.forEach(s => { m[s.id] = s }); return m }, [school])
  const lists = useMemo(() => (rows || []).map(r => {
    const ids = Array.isArray(r.student_ids) ? r.student_ids : []
    const students = ids.map(id => byId[id] || { id, name: 'Student (not in school list)', gcc_no: '', class_name: '' })
    return { id: r.id, owner: r.owner || 'Not recorded', name: r.name === CLASS_ROW ? 'My class (extra students)' : r.name, isClass: r.name === CLASS_ROW, students, updated: r.updated_at }
  }).filter(g => g.students.length || !g.isClass), [rows, byId])
  const owners = useMemo(() => [...new Set(lists.map(g => g.owner))].sort((a, b) => a.localeCompare(b)), [lists])
  // students who appear in the lists of two or more different housemasters
  const dupe = useMemo(() => {
    const m = new Map()
    lists.forEach(g => g.students.forEach(s => { if (!m.has(s.id)) m.set(s.id, new Set()); m.get(s.id).add(g.owner) }))
    const d = new Set(); m.forEach((set, id) => { if (set.size > 1) d.add(id) }); return d
  }, [lists])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return lists.filter(g => (!owner || g.owner === owner) && (!t || g.name.toLowerCase().includes(t) || g.owner.toLowerCase().includes(t) || g.students.some(s => (s.name || '').toLowerCase().includes(t) || String(s.gcc_no || '').includes(t))))
  }, [lists, q, owner])
  const flat = () => shown.flatMap(g => g.students.map(s => [g.owner, g.name, s.name || '', s.gcc_no || '', s.class_name || '']))

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Housemaster', 'Group', 'Student', 'GCC', 'Class'], ...flat()]), 'Group list')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Housemaster', 'Group', 'Students'], ...shown.map(g => [g.owner, g.name, g.students.length])]), 'Summary')
    XLSX.writeFile(wb, 'Group_list.xlsx')
  }
  const exportPdf = async () => {
    if (!shown.length) return
    setBusy(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, { pdfLetterhead, pdfFooters }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./reportKit')])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' }), mx = 12
      let y = pdfLetterhead(doc, { title: 'Group list – all housemasters', margin: mx, date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) })
      for (const g of shown) {
        autoTable(doc, {
          startY: y, head: [[{ content: `${g.owner}  ·  ${g.name}  (${g.students.length})`, colSpan: 4, styles: { fillColor: [11, 30, 61], textColor: 255, halign: 'left' } }], ['#', 'Student', 'GCC', 'Class']],
          body: g.students.map((s, i) => [i + 1, s.name || '', s.gcc_no || '', s.class_name || '']),
          margin: { left: mx, right: mx, bottom: 16 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
          headStyles: { fillColor: [201, 162, 75], textColor: [11, 30, 61], fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
        })
        y = (doc.lastAutoTable?.finalY || y) + 6
      }
      pdfFooters(doc, { margin: mx })
      doc.save('Group_list.pdf')
    } catch (e) { setErr('Could not make the PDF: ' + (e?.message || e)) }
    setBusy(false)
  }

  return (
    <div>
      {note && <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>{note}</div>}
      {err && <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>{err}</div>}
      <div style={card}>
        <p style={h}>👥 Group list · every housemaster</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, flex: '2 1 200px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search group, housemaster or student" aria-label="Search the group list" />
          <select style={{ ...inp, flex: '1 1 170px' }} value={owner} onChange={e => setOwner(e.target.value)} aria-label="Housemaster"><option value="">All housemasters</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}</select>
          <button type="button" style={btn} onClick={load}>↻ Refresh</button>
          <button type="button" style={btn} onClick={exportXlsx} disabled={!shown.length}>📊 Excel</button>
          <button type="button" style={btn} onClick={exportPdf} disabled={!shown.length || busy}>{busy ? 'Making…' : '📄 PDF'}</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#64748b' }}>{shown.length} group{shown.length === 1 ? '' : 's'} · {shown.reduce((a, g) => a + g.students.length, 0)} students{dupe.size ? ` · ⚠ ${dupe.size} student${dupe.size === 1 ? ' is' : 's are'} in more than one housemaster's list (marked ⚠)` : ''}</div>
      </div>
      {rows == null ? <div style={{ ...card, color: '#64748b' }}>Loading…</div> : !shown.length ? (
        <div style={{ ...card, color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>{err ? 'Could not load the group list.' : !lists.length ? <>No group has been saved yet.<br />A housemaster saves one in <b>Enter marks → My class → Save my class as a group</b>.</> : 'No group matches. Clear the search.'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {shown.map(g => {
            const isOpen = !!open[g.id], list = isOpen ? g.students : g.students.slice(0, 5)
            return (
              <div key={g.id} style={{ ...card, marginBottom: 0, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}><b style={{ fontSize: 15 }}>{g.name}</b><span style={{ fontSize: 12.5, fontWeight: 800, color: NAVY, background: '#fffaf0', border: `1.5px solid ${GOLD}`, borderRadius: 99, padding: '1px 10px' }}>{g.students.length}</span></div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 8 }}>🧑‍🏫 {g.owner}</div>
                {list.map(s => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, padding: '4px 0', borderTop: `1px solid ${LINE}`, alignItems: 'center' }}><span>{dupe.has(s.id) ? '⚠ ' : ''}{s.name}</span><span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{s.class_name || ''}{s.gcc_no ? ` · ${s.gcc_no}` : ''}{isAdmin && <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setIds(g, g.students.map(x => x.id).filter(id => id !== s.id))} style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 15, padding: '0 0 0 8px' }}>✕</button>}</span></div>)}
                {isAdmin && (() => {
                  const t = (addQ[g.id] || '').trim().toLowerCase()
                  const have = new Set(g.students.map(x => x.id))
                  const hits = t.length < 2 ? [] : school.filter(x => !have.has(x.id) && ((x.name || '').toLowerCase().includes(t) || String(x.gcc_no || '').includes(t))).slice(0, 5)
                  return (
                    <div style={{ marginTop: 8, borderTop: `1px dashed ${LINE}`, paddingTop: 8 }}>
                      <input style={{ ...inp, width: '100%', minHeight: 38 }} value={addQ[g.id] || ''} onChange={e => setAddQ(a => ({ ...a, [g.id]: e.target.value }))} placeholder="＋ Add a student: type a name or GCC" aria-label={`Add a student to ${g.name}`} />
                      {hits.map(x => <button key={x.id} type="button" onClick={() => { setIds(g, [...g.students.map(y => y.id), x.id]); setAddQ(a => ({ ...a, [g.id]: '' })) }} style={{ ...btn, display: 'block', width: '100%', textAlign: 'left', minHeight: 36, padding: '4px 10px', fontSize: 13, marginTop: 4 }}>＋ {x.name} <span style={{ color: '#64748b' }}>· {x.class_name || ''} {x.gcc_no || ''}</span></button>)}
                      <button type="button" onClick={() => delGroup(g)} style={{ ...btn, marginTop: 8, minHeight: 36, padding: '4px 12px', fontSize: 13, color: '#b91c1c', borderColor: '#fecaca' }}>🗑 Delete this group</button>
                    </div>
                  )
                })()}
                {g.students.length > 5 && <button type="button" style={{ ...btn, marginTop: 8, minHeight: 36, padding: '4px 12px', fontSize: 13 }} onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))}>{isOpen ? 'Show less' : `Show all ${g.students.length}`}</button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

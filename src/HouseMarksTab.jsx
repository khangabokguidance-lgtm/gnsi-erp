import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { isAdminRole } from './roles'

// ══════════════════════════════════════════════════════════════
//  HOUSE MARKS TAB  (Hostel → 📝 Marks)
//  Mark uploader for a house test. The roster is the housemaster's own
//  house (the `students` prop is already house-scoped by Hostel.jsx when
//  the user is a housemaster; admins see everyone). Marks are typed into
//  the grid, or pasted / uploaded from Excel or CSV and matched to the
//  roster by GCC number (falling back to exact name). Totals, percentage
//  and rank (ties share a rank) update live; invalid cells are flagged
//  before saving. One row per test is stored in `house_test_marks`
//  (see supabase/RUN_house_test_marks.sql). Nothing here touches
//  exam_marks or the Mock Analyzer tables.
// ══════════════════════════════════════════════════════════════

const NAVY = '#0B1E3D', GOLD = '#C9A24B', LINE = '#e2e8f0'
const PRESETS = {
  jnvst: { label: 'JNVST (Mental Ability 50 · Arithmetic 25 · Language 25)', subjects: [{ n: 'Mental Ability', max: 50, min: '' }, { n: 'Arithmetic', max: 25, min: 7 }, { n: 'Language', max: 25, min: '' }] },
  arith: { label: 'Arithmetic only (25)', subjects: [{ n: 'Arithmetic', max: 25, min: 7 }] },
  custom: { label: 'Custom subjects', subjects: [{ n: 'Marks', max: 100, min: '' }] },
}

const digits = v => String(v ?? '').replace(/\D/g, '')
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const clone = o => JSON.parse(JSON.stringify(o))
const todayStr = () => new Date().toLocaleDateString('en-CA')

function parseMark(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s === '-') return null
  if (/^(ab|a|abs|absent)$/i.test(s)) return 'AB'
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  return s // invalid text — kept so it gets flagged
}
function cellState(v, sub) {
  if (v === null || v === undefined || v === 'AB') return ''
  if (typeof v === 'string') return 'err'
  if (v < 0 || v > Number(sub.max)) return 'err'
  if (sub.min !== '' && sub.min != null && v < Number(sub.min)) return 'low'
  return ''
}
function splitLine(l, d) {
  if (d !== ',') return l.split(d)
  const out = []; let cur = '', q = false
  for (let i = 0; i < l.length; i++) {
    const ch = l[i]
    if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur); return out
}
function textToMatrix(t) {
  const lines = t.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '')
  if (!lines.length) return []
  const d = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : '\t'
  return lines.map(l => splitLine(l, d).map(c => c.trim()))
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }

export default function HouseMarksTab({ students = [], lockHouse = '', currentUser }) {
  const canDelete = isAdminRole(currentUser?.role)
  const [test, setTest] = useState(() => ({ id: null, name: '', date: todayStr(), preset: 'jnvst', subjects: clone(PRESETS.jnvst.subjects) }))
  const [marks, setMarks] = useState({})          // { [student.id]: [mark per subject] }
  const [saved, setSaved] = useState([])
  const [msg, setMsg] = useState(null)             // { kind: 'ok'|'err', text }
  const [dirty, setDirty] = useState(false)
  const [paste, setPaste] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const roster = useMemo(() => (students || [])
    .filter(s => s.status !== 'Inactive' && s.status !== 'Dropout')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [students])

  const flash = (kind, text) => { setMsg({ kind, text }); setTimeout(() => setMsg(m => (m && m.text === text ? null : m)), 5000) }

  const loadSaved = useCallback(async () => {
    let q = supabase.from('house_test_marks').select('id,test_name,test_date,house,subjects,marks,updated_at').order('test_date', { ascending: false }).limit(100)
    if (lockHouse) q = q.eq('house', lockHouse)
    const { data, error } = await q
    if (error) { setSaved([]); if (/house_test_marks/i.test(error.message || '')) flash('err', 'Saving is not set up yet: run supabase/RUN_house_test_marks.sql once in Supabase.'); return }
    setSaved(data || [])
  }, [lockHouse])
  useEffect(() => { loadSaved() }, [loadSaved])

  const maxTotal = test.subjects.reduce((a, s) => a + Number(s.max || 0), 0)

  // ── computed per student ──
  const calc = useMemo(() => {
    const out = {}
    roster.forEach(s => {
      const m = marks[s.id] || []
      let tot = 0, n = 0, ab = 0, bad = false, low = false
      test.subjects.forEach((sub, i) => {
        const v = m[i] ?? null, st = cellState(v, sub)
        if (st === 'err') bad = true
        if (st === 'low') low = true
        if (typeof v === 'number' && st !== 'err') { tot += v; n++ } else if (v === 'AB') ab++
      })
      out[s.id] = { tot, n, bad, low, absent: test.subjects.length > 0 && ab === test.subjects.length, pct: maxTotal ? tot / maxTotal * 100 : 0, rank: null }
    })
    const ids = Object.keys(out).filter(id => out[id].n > 0 && !out[id].bad).sort((a, b) => out[b].tot - out[a].tot)
    let rk = 0, prev = null
    ids.forEach((id, k) => { if (out[id].tot !== prev) { rk = k + 1; prev = out[id].tot } out[id].rank = rk })
    return out
  }, [roster, marks, test.subjects, maxTotal])

  const stats = useMemo(() => {
    const vals = Object.values(calc)
    const ranked = vals.filter(c => c.rank)
    const tots = ranked.map(c => c.tot)
    return {
      students: roster.length,
      entered: vals.filter(c => c.n > 0 || c.absent).length,
      ranked: ranked.length,
      bad: vals.filter(c => c.bad).length,
      low: vals.filter(c => c.low).length,
      absent: vals.filter(c => c.absent).length,
      avg: tots.length ? tots.reduce((a, b) => a + b, 0) / tots.length : null,
      high: tots.length ? Math.max(...tots) : null,
    }
  }, [calc, roster])

  const setCell = (sid, i, raw) => {
    setMarks(prev => {
      const row = (prev[sid] || test.subjects.map(() => null)).slice()
      while (row.length < test.subjects.length) row.push(null)
      row[i] = parseMark(raw)
      return { ...prev, [sid]: row }
    })
    setDirty(true)
  }

  const setPreset = p => {
    setTest(t => ({ ...t, preset: p, subjects: clone(PRESETS[p].subjects) }))
    setMarks({}); setDirty(true)
  }
  const updSubject = (i, field, val) => {
    setTest(t => { const subjects = clone(t.subjects); subjects[i][field] = field === 'n' ? val : (val === '' ? '' : Number(val)); return { ...t, preset: 'custom', subjects } })
    setDirty(true)
  }
  const addSubject = () => { setTest(t => ({ ...t, preset: 'custom', subjects: [...t.subjects, { n: 'Subject ' + (t.subjects.length + 1), max: 25, min: '' }] })); setMarks(m => { const c = {}; Object.keys(m).forEach(k => { c[k] = [...m[k], null] }); return c }); setDirty(true) }
  const delSubject = i => {
    if (test.subjects.length < 2) return
    setTest(t => ({ ...t, preset: 'custom', subjects: t.subjects.filter((_, j) => j !== i) }))
    setMarks(m => { const c = {}; Object.keys(m).forEach(k => { c[k] = m[k].filter((_, j) => j !== i) }); return c })
    setDirty(true)
  }

  // ── import (paste / file): match to roster by GCC, else exact name ──
  const importMatrix = mx => {
    mx = mx.filter(r => r.some(c => String(c ?? '').trim() !== ''))
    if (!mx.length) { flash('err', 'No rows found.'); return }
    const hdr = mx[0].map(norm)
    const hasHeader = hdr.some(h => /^(gcc|gccno|roll|rollno|name|studentname)/.test(h)) || test.subjects.some(s => hdr.includes(norm(s.n)))
    let iG = 0, iN = 1, map = test.subjects.map((_, i) => i + 2)
    if (hasHeader) {
      iG = hdr.findIndex(h => /^(gcc|gccno|roll|rollno|id|admno)/.test(h))
      iN = hdr.findIndex(h => /name/.test(h))
      map = test.subjects.map(s => { const k = norm(s.n); return hdr.findIndex(h => h && (h === k || h.includes(k) || k.includes(h)) && !/^(gcc|roll|name|id)/.test(h)) })
      mx = mx.slice(1)
    }
    const byGcc = new Map(), byName = new Map()
    roster.forEach(s => { if (digits(s.gcc_no)) byGcc.set(digits(s.gcc_no), s); byName.set(norm(s.name), s) })
    let ok = 0; const miss = []
    const next = { ...marks }
    mx.forEach(row => {
      const g = iG >= 0 ? digits(row[iG]) : ''
      const nm = iN >= 0 ? norm(row[iN]) : ''
      const st = (g && byGcc.get(g)) || (nm && byName.get(nm))
      if (!st) { miss.push(String(row[iN >= 0 ? iN : iG] ?? row[0] ?? '?')); return }
      const cur = (next[st.id] || test.subjects.map(() => null)).slice()
      map.forEach((j, i) => { if (j >= 0) { const v = parseMark(row[j]); if (v !== null) cur[i] = v } })
      next[st.id] = cur; ok++
    })
    setMarks(next); setDirty(true)
    const noCols = map.filter(j => j < 0).length
    flash(miss.length || noCols ? 'err' : 'ok',
      `${ok} matched${miss.length ? `, ${miss.length} not in this house (${miss.slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''})` : ''}${noCols ? `. ${noCols} subject column(s) not found in the header.` : '.'}`)
  }
  const onFile = f => {
    if (!f) return
    const reader = new FileReader()
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      reader.onload = () => { try { const wb = XLSX.read(reader.result, { type: 'array' }); importMatrix(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })) } catch { flash('err', 'Could not read that Excel file.') } }
      reader.readAsArrayBuffer(f)
    } else { reader.onload = () => importMatrix(textToMatrix(String(reader.result))); reader.readAsText(f) }
  }

  // ── export ──
  const sortedForExport = () => [...roster].sort((a, b) => (calc[a.id].rank || 9999) - (calc[b.id].rank || 9999) || String(a.name).localeCompare(String(b.name)))
  const headRow = () => ['Rank', 'GCC No', 'Name', 'Class', ...test.subjects.map(s => s.n), 'Total', 'Percent', 'Remark']
  const bodyRows = () => sortedForExport().map(s => {
    const c = calc[s.id], m = marks[s.id] || []
    return [c.rank || '', s.gcc_no || '', s.name || '', s.class_name || '', ...test.subjects.map((_, i) => m[i] ?? ''), c.n ? c.tot : '', c.n ? c.pct.toFixed(1) : '', c.absent ? 'Absent' : c.bad ? 'Check marks' : c.low ? 'Below minimum' : '']
  })
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
  const baseName = () => ((test.name || 'house-test') + (lockHouse ? '-' + lockHouse : '')).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const exportCsv = () => {
    const top = [['Test', test.name], ['House', lockHouse || 'All houses'], ['Date', test.date], ['Maximum total', maxTotal], []].map(r => r.map(csvCell).join(','))
    const csv = [...top, headRow().map(csvCell).join(','), ...bodyRows().map(r => r.map(csvCell).join(','))].join('\n')
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), baseName() + '.csv')
  }
  const exportXlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Test', test.name], ['House', lockHouse || 'All houses'], ['Date', test.date], ['Maximum total', maxTotal], [], headRow(), ...bodyRows()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Results'); XLSX.writeFile(wb, baseName() + '.xlsx')
  }
  const template = () => {
    const rows = [['GCC No', 'Name', ...test.subjects.map(s => s.n)], ...roster.map(s => [s.gcc_no || '', s.name || '', ...test.subjects.map(() => '')])]
    download(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), 'marks-template-' + (lockHouse || 'all').toLowerCase().replace(/\W+/g, '-') + '.csv')
  }

  // ── save / open / delete ──
  const save = async () => {
    if (!test.name.trim()) { flash('err', 'Give the test a name first.'); return }
    if (stats.bad) { flash('err', `Fix ${stats.bad} red cell(s) first.`); return }
    const compact = {}
    roster.forEach(s => {
      const m = marks[s.id]; if (!m || m.every(v => v === null || v === undefined)) return
      compact[s.id] = { gcc: s.gcc_no || '', name: s.name || '', m }
    })
    if (!Object.keys(compact).length) { flash('err', 'No marks entered yet.'); return }
    setBusy(true)
    const row = { test_name: test.name.trim(), test_date: test.date || todayStr(), house: lockHouse || 'All', subjects: test.subjects, marks: compact, created_by: currentUser?.username || currentUser?.name || null, updated_at: new Date().toISOString() }
    const q = test.id ? supabase.from('house_test_marks').update(row).eq('id', test.id).select('id').single() : supabase.from('house_test_marks').insert(row).select('id').single()
    const { data, error } = await q
    setBusy(false)
    if (error) { flash('err', /house_test_marks/i.test(error.message || '') && /exist|schema/i.test(error.message || '') ? 'Table missing: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Save failed: ' + error.message); return }
    setTest(t => ({ ...t, id: data.id })); setDirty(false); flash('ok', `Saved ${Object.keys(compact).length} students.`); loadSaved()
  }
  const openSaved = r => {
    const byId = {}; roster.forEach(s => { byId[s.id] = s })
    const mk = {}; Object.entries(r.marks || {}).forEach(([sid, v]) => { if (byId[sid]) mk[sid] = v.m })
    setTest({ id: r.id, name: r.test_name, date: r.test_date, preset: 'custom', subjects: r.subjects || clone(PRESETS.jnvst.subjects) })
    setMarks(mk); setDirty(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const delSaved = async r => {
    if (!window.confirm(`Delete saved test "${r.test_name}"?`)) return
    const { error } = await supabase.from('house_test_marks').delete().eq('id', r.id)
    if (error) { flash('err', 'Delete failed: ' + error.message); return }
    if (test.id === r.id) setTest(t => ({ ...t, id: null }))
    loadSaved()
  }
  const newTest = () => {
    if (dirty && !window.confirm('Discard unsaved marks and start a new test?')) return
    setTest({ id: null, name: '', date: todayStr(), preset: 'jnvst', subjects: clone(PRESETS.jnvst.subjects) }); setMarks({}); setDirty(false)
  }

  const shown = roster.filter(s => !search.trim() || (String(s.name || '') + ' ' + String(s.gcc_no || '')).toLowerCase().includes(search.trim().toLowerCase()))

  // ── styles ──
  const card = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 14 }
  const h = { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 10px' }
  const inp = { padding: '8px 10px', border: `1px solid #cbd5e1`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 38, width: '100%', background: '#fff' }
  const btn = (primary) => ({ padding: '8px 14px', borderRadius: 8, border: `1px solid ${primary ? NAVY : '#cbd5e1'}`, background: primary ? NAVY : '#fff', color: primary ? '#fff' : NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 38 })
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b', minWidth: 0 }
  const cellBg = st => st === 'err' ? { background: '#fee2e2', color: '#b91c1c' } : st === 'low' ? { background: '#fef3c7', color: '#92400e' } : {}
  const th = { padding: '8px 8px', background: '#f1f5f9', fontSize: 12, color: '#475569', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 }
  const td = { padding: 0, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ ...card, background: NAVY, color: '#fff', border: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#E2C57E' }}>{lockHouse ? `🏠 ${lockHouse}` : 'All houses'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif' }}>📝 Test Marks Uploader</div>
        <div style={{ fontSize: 13, opacity: .85 }}>Enter or upload marks for your house, fix flagged cells, save, and download the ranked result sheet.</div>
      </div>

      {msg && <div role="status" style={{ ...card, padding: '10px 14px', background: msg.kind === 'ok' ? '#ecfdf5' : '#fef2f2', borderColor: msg.kind === 'ok' ? '#a7f3d0' : '#fecaca', color: msg.kind === 'ok' ? '#047857' : '#b91c1c', fontSize: 13 }}>{msg.text}</div>}

      <div style={card}>
        <p style={h}>1 · Test details</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ ...lab, flex: '2 1 220px' }}>Test name<input style={inp} value={test.name} placeholder="e.g. Weekly Test 7 – JNVST" onChange={e => { setTest(t => ({ ...t, name: e.target.value })); setDirty(true) }} /></label>
          <label style={{ ...lab, flex: '1 1 150px' }}>Date<input style={inp} type="date" value={test.date} onChange={e => { setTest(t => ({ ...t, date: e.target.value })); setDirty(true) }} /></label>
          <label style={{ ...lab, flex: '2 1 240px' }}>Subject preset
            <select style={inp} value={test.preset} onChange={e => setPreset(e.target.value)}>
              {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
        </div>
        {test.subjects.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px 84px 34px', gap: 8, marginBottom: 6, alignItems: 'end' }}>
            <label style={lab}>{i === 0 ? 'Subject' : <span style={{ visibility: 'hidden' }}>Subject</span>}<input style={inp} value={s.n} onChange={e => updSubject(i, 'n', e.target.value)} /></label>
            <label style={lab}>{i === 0 ? 'Max' : <span style={{ visibility: 'hidden' }}>Max</span>}<input style={inp} type="number" min="1" value={s.max} onChange={e => updSubject(i, 'max', e.target.value)} /></label>
            <label style={lab}>{i === 0 ? 'Min' : <span style={{ visibility: 'hidden' }}>Min</span>}<input style={inp} type="number" min="0" value={s.min} onChange={e => updSubject(i, 'min', e.target.value)} /></label>
            <button type="button" style={{ ...btn(false), padding: 0 }} aria-label="Remove subject" onClick={() => delSubject(i)} disabled={test.subjects.length < 2}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={btn(false)} onClick={addSubject}>+ Add subject</button>
          <span style={{ fontSize: 12, color: '#64748b' }}>“Min” is optional; below it a mark turns amber. JNVST needs 7 in Arithmetic.</span>
        </div>
      </div>

      <div style={card}>
        <p style={h}>2 · Bring in marks</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
              style={{ border: '1.5px dashed #94a3b8', borderRadius: 10, padding: 16, textAlign: 'center', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Drop an Excel or CSV file here, or click to choose
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Columns: GCC No, Name, then one column per subject (names must match). Rows are matched to your roster by GCC No, else by exact name. Use <b>AB</b> for absent.</div>
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <textarea style={{ ...inp, minHeight: 90, fontFamily: 'monospace', fontSize: 12.5 }} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'…or paste rows copied from Excel\nGCC No\tName\tMental Ability\tArithmetic\tLanguage'} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn(false)} onClick={() => { importMatrix(textToMatrix(paste)); setPaste('') }} disabled={!paste.trim()}>Add pasted rows</button>
              <button type="button" style={btn(false)} onClick={template}>Download roster template</button>
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ ...h, margin: 0 }}>3 · Mark sheet {dirty && <span style={{ color: '#b45309', textTransform: 'none', letterSpacing: 0 }}>· unsaved changes</span>}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn(true)} onClick={save} disabled={busy}>{busy ? 'Saving…' : test.id ? 'Update test' : 'Save test'}</button>
            <button type="button" style={btn(false)} onClick={exportCsv}>CSV</button>
            <button type="button" style={btn(false)} onClick={exportXlsx}>Excel</button>
            <button type="button" style={btn(false)} onClick={newTest}>New test</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
          {[['Students', stats.students], ['Entered', stats.entered], ['Absent', stats.absent], [`Average (of ${maxTotal})`, stats.avg == null ? '–' : stats.avg.toFixed(1)], ['Highest', stats.high ?? '–'], ['Below minimum', stats.low], ['Need fixing', stats.bad]].map(([l, v]) => (
            <div key={l} style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>{v}</div><div style={{ fontSize: 11, color: '#64748b' }}>{l}</div></div>
          ))}
        </div>
        <input style={{ ...inp, marginBottom: 10, maxWidth: 320 }} placeholder="Search name or GCC No" value={search} onChange={e => setSearch(e.target.value)} />
        {!roster.length ? <div style={{ color: '#64748b', fontSize: 13 }}>No students in this house yet.</div> : (
          <div style={{ overflowX: 'auto', border: `1px solid ${LINE}`, borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
              <thead><tr>
                <th style={th}>#</th><th style={th}>GCC</th><th style={th}>Name</th>
                {test.subjects.map((s, i) => <th key={i} style={th}>{s.n || 'Subject'}<div style={{ fontWeight: 400 }}>out of {s.max}</div></th>)}
                <th style={th}>Total<div style={{ fontWeight: 400 }}>out of {maxTotal}</div></th><th style={th}>%</th><th style={th}>Rank</th>
              </tr></thead>
              <tbody>
                {shown.map((s, idx) => {
                  const c = calc[s.id] || {}, m = marks[s.id] || []
                  return (
                    <tr key={s.id}>
                      <td style={{ ...td, padding: '6px 8px', color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ ...td, padding: '6px 8px', fontFamily: 'monospace' }}>{s.gcc_no || '–'}</td>
                      <td style={{ ...td, padding: '6px 8px', minWidth: 150 }}>{s.name}<div style={{ fontSize: 11, color: '#94a3b8' }}>{s.class_name || ''}</div></td>
                      {test.subjects.map((sub, i) => (
                        <td key={i} style={td}>
                          <input aria-label={`${s.name} ${sub.n}`} inputMode="decimal" value={m[i] ?? ''} onChange={e => setCell(s.id, i, e.target.value)}
                            style={{ width: 74, border: 0, padding: '8px', textAlign: 'right', fontFamily: 'monospace', background: 'transparent', ...cellBg(cellState(m[i] ?? null, sub)) }} />
                        </td>
                      ))}
                      <td style={{ ...td, padding: '6px 8px', fontFamily: 'monospace' }}>{c.absent ? 'Absent' : c.n ? c.tot : '–'}</td>
                      <td style={{ ...td, padding: '6px 8px', fontFamily: 'monospace' }}>{c.n ? c.pct.toFixed(1) : '–'}</td>
                      <td style={{ ...td, padding: '6px 8px', fontWeight: 700, color: NAVY }}>{c.rank || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Red = invalid or above the maximum. Amber = below the minimum. Ties share a rank.</div>
      </div>

      <div style={card}>
        <p style={h}>Saved tests</p>
        {!saved.length ? <div style={{ color: '#64748b', fontSize: 13 }}>Nothing saved yet.</div> : saved.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${r.id === test.id ? NAVY : LINE}`, borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.test_name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{r.test_date} · {r.house} · {Object.keys(r.marks || {}).length} students</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={btn(false)} onClick={() => openSaved(r)}>Open</button>
              {canDelete && <button type="button" style={{ ...btn(false), color: '#b91c1c' }} onClick={() => delSaved(r)} aria-label="Delete saved test">✕</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

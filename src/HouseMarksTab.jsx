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
  single: { label: 'One subject only', subjects: [{ n: 'Subject', max: 25, min: '' }], locked: true },
  custom: { label: 'Custom subjects', subjects: [{ n: 'Marks', max: 100, min: '' }] },
}

const digits = v => String(v ?? '').replace(/\D/g, '')
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const clone = o => JSON.parse(JSON.stringify(o))
const todayStr = () => new Date().toLocaleDateString('en-CA')

// ── Remembering: unsaved work (draft) and the last test setup live in this browser ──
const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode / full */ } }
const lsDel = k => { try { localStorage.removeItem(k) } catch { /* ignore */ } }
const SETUP_KEY = 'house_marks_last_setup'
const lastSetup = () => { const l = lsGet(SETUP_KEY); return l && PRESETS[l.preset] && Array.isArray(l.subjects) && l.subjects.length ? l : null }

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

export default function HouseMarksTab({ students = [], allStudents = null, lockHouse = '', currentUser }) {
  const canDelete = isAdminRole(currentUser?.role)
  const [test, setTest] = useState(() => { const l = lastSetup(); return { id: null, name: '', group: '', date: todayStr(), preset: l?.preset || 'jnvst', subjects: clone(l?.subjects || PRESETS.jnvst.subjects) } })
  const [marks, setMarks] = useState({})          // { [student.id]: [mark per subject] }
  const [saved, setSaved] = useState([])
  const [msg, setMsg] = useState(null)             // { kind: 'ok'|'err', text }
  const [dirty, setDirty] = useState(false)
  const [paste, setPaste] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('all')          // 'all' = whole house, 'selected' = hand-picked students
  const [picked, setPicked] = useState([])         // student ids when mode === 'selected'
  const [pickQ, setPickQ] = useState('')
  const [ticks, setTicks] = useState([])           // multi-picker: ticked, not yet added
  const [fHouse, setFHouse] = useState('')
  const [fClass, setFClass] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const tableRef = useRef(null)
  const [filt, setFilt] = useState('all')         // tile filter: all | entered | absent | low | bad
  const [showImport, setShowImport] = useState(false)
  const [activeRow, setActiveRow] = useState(null)
  const groupsKey = 'house_marks_groups_' + (lockHouse || 'all')
  const [groups, setGroups] = useState(() => { const g = lsGet('house_marks_groups_' + (lockHouse || 'all')); return Array.isArray(g) ? g : [] })   // [{ id, name, ids }] — manual groups / class names
  const [groupName, setGroupName] = useState('')
  const [progId, setProgId] = useState('')           // student whose progress is shown
  const [progRows, setProgRows] = useState(null)     // null = not loaded, [] = none
  const [progErr, setProgErr] = useState('')
  const draftKey = 'house_marks_draft_' + (lockHouse || 'all')
  const [draft, setDraft] = useState(() => { const d = lsGet('house_marks_draft_' + (lockHouse || 'all')); return d && d.marks && Object.keys(d.marks).length ? d : null })

  const pool = useMemo(() => (students || [])
    .filter(s => s.status !== 'Inactive' && s.status !== 'Dropout')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [students])
  // Whole-school list: in "Pick students" mode any housemaster can add a
  // student from any house (or a day scholar), not only their own.
  const school = useMemo(() => (allStudents || students || [])
    .filter(s => s.status !== 'Inactive' && s.status !== 'Dropout')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [allStudents, students])
  const roster = useMemo(() => mode === 'all' ? pool : school.filter(s => picked.includes(s.id)), [pool, school, mode, picked])
  const houses = useMemo(() => [...new Set(school.map(s => s.house).filter(Boolean))].sort(), [school])
  const classes = useMemo(() => [...new Set(school.map(s => s.class_name).filter(Boolean))].sort(), [school])
  // Everyone matching the search / house / class filters who is not already on the sheet.
  const addable = useMemo(() => {
    const q = pickQ.trim().toLowerCase()
    return school.filter(s => (!fHouse || s.house === fHouse) && (!fClass || s.class_name === fClass)
      && (!q || (String(s.name || '') + ' ' + String(s.gcc_no || '')).toLowerCase().includes(q)))
  }, [school, picked, pickQ, fHouse, fClass])
  const shownAddable = addable.slice(0, 200)
  const tickable = shownAddable.filter(s => !picked.includes(s.id))
  // Sheet search also looks at the whole school: matches not yet on the sheet can be added in one tap.
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const onSheet = new Set(roster.map(s => s.id))
    return school.filter(s => !onSheet.has(s.id) && (String(s.name || '') + ' ' + String(s.gcc_no || '')).toLowerCase().includes(q)).slice(0, 8)
  }, [search, school, roster])
  const addFromSearch = id => {
    setPicked(p => [...new Set([...(mode === 'all' ? pool.map(s => s.id) : p), id])])
    setMode('selected'); setDirty(true)
  }
  const toggleTick = id => setTicks(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])
  const tickAllShown = () => setTicks(t => [...new Set([...t, ...tickable.map(s => s.id)])])
  const addTicked = () => { if (!ticks.length) return; const n = ticks.length; setPicked(p => [...new Set([...p, ...ticks])]); setTicks([]); setDirty(true); flash('ok', `${n} student${n === 1 ? '' : 's'} added.`) }
  const unpickStudent = id => { setPicked(p => p.filter(x => x !== id)); setMarks(m => { const c = { ...m }; delete c[id]; return c }); setDirty(true) }
  const pickMyHouse = () => { setPicked(p => [...new Set([...p, ...pool.map(s => s.id)])]); setDirty(true) }
  const subjectLocked = !!PRESETS[test.preset]?.locked

  const flash = (kind, text) => { setMsg({ kind, text }); setTimeout(() => setMsg(m => (m && m.text === text ? null : m)), 5000) }

  // Auto-remember: every edit is kept on this computer (debounced), and the test setup is the next default.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => lsSet(draftKey, { ts: Date.now(), test, marks, mode, picked }), 400)
    return () => clearTimeout(t)
  }, [dirty, test, marks, mode, picked, draftKey])
  useEffect(() => { lsSet(SETUP_KEY, { preset: test.preset, subjects: test.subjects }) }, [test.preset, test.subjects])
  const restoreDraft = () => {
    if (!draft) return
    setTest(draft.test); setMarks(draft.marks || {}); setMode(draft.mode || 'all'); setPicked(draft.picked || []); setDirty(true); setDraft(null)
    flash('ok', 'Your unsaved marks are back.')
  }
  const saveGroups = next => { setGroups(next); lsSet(groupsKey, next) }
  const saveAsGroup = () => {
    const name = groupName.trim()
    if (!name) { flash('err', 'Type a group or class name first, e.g. “Class VI Navodaya”.'); return }
    if (!picked.length) { flash('err', 'Pick the students for this group first.'); return }
    const others = groups.filter(g => g.name.toLowerCase() !== name.toLowerCase())
    saveGroups([...others, { id: Date.now(), name, ids: picked }].sort((a, b) => a.name.localeCompare(b.name)))
    setGroupName(''); flash('ok', `Group “${name}” saved with ${picked.length} student${picked.length === 1 ? '' : 's'}.`)
  }
  const useGroup = g => {
    const live = new Set(school.map(s => s.id))
    const ids = g.ids.filter(id => live.has(id))
    setMode('selected'); setPicked(ids); setDirty(true)
    setTest(t => ({ ...t, group: g.name, name: t.name.trim() ? t.name : g.name + ' – ' }))
    flash('ok', `${g.name}: ${ids.length} student${ids.length === 1 ? '' : 's'} loaded${ids.length < g.ids.length ? ` (${g.ids.length - ids.length} no longer active)` : ''}.`)
  }
  const delGroup = g => { if (window.confirm(`Delete the group “${g.name}”? The students themselves are not affected.`)) saveGroups(groups.filter(x => x.id !== g.id)) }
  const discardDraft = () => { lsDel(draftKey); setDraft(null) }

  useEffect(() => {
    if (!progId) { setProgRows(null); setProgErr(''); return }
    let live = true
    supabase.from('house_test_results').select('test_id,test_name,test_date,group_name,total,max_total,percent,rank,ranked_of,class_avg_pct,absent,subjects,marks').eq('student_id', String(progId)).order('test_date', { ascending: true }).limit(200)
      .then(({ data, error }) => {
        if (!live) return
        if (error) { setProgRows([]); setProgErr(/house_test_results/i.test(error.message || '') ? 'Progress records are not set up yet: run the new part of supabase/RUN_house_test_marks.sql once in Supabase.' : error.message); return }
        setProgErr(''); setProgRows(data || [])
      })
    return () => { live = false }
  }, [progId, saved])

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
    setTest(t => { const subjects = clone(t.subjects); subjects[i][field] = field === 'n' ? val : (val === '' ? '' : Number(val)); return { ...t, preset: t.preset === 'single' ? 'single' : 'custom', subjects } })
    setDirty(true)
  }
  const addSubject = () => { if (subjectLocked) return; setTest(t => ({ ...t, preset: 'custom', subjects: [...t.subjects, { n: 'Subject ' + (t.subjects.length + 1), max: 25, min: '' }] })); setMarks(m => { const c = {}; Object.keys(m).forEach(k => { c[k] = [...m[k], null] }); return c }); setDirty(true) }
  const delSubject = i => {
    if (test.subjects.length < 2 || subjectLocked) return
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
    ;(mode === 'selected' ? school : roster).forEach(s => { if (digits(s.gcc_no)) byGcc.set(digits(s.gcc_no), s); byName.set(norm(s.name), s) })
    const added = []
    let ok = 0; const miss = []
    const next = { ...marks }
    mx.forEach(row => {
      const g = iG >= 0 ? digits(row[iG]) : ''
      const nm = iN >= 0 ? norm(row[iN]) : ''
      const st = (g && byGcc.get(g)) || (nm && byName.get(nm))
      if (!st) { miss.push(String(row[iN >= 0 ? iN : iG] ?? row[0] ?? '?')); return }
      const cur = (next[st.id] || test.subjects.map(() => null)).slice()
      map.forEach((j, i) => { if (j >= 0) { const v = parseMark(row[j]); if (v !== null) cur[i] = v } })
      next[st.id] = cur; ok++; added.push(st.id)
    })
    if (mode === 'selected' && added.length) setPicked(p => [...new Set([...p, ...added])])
    setMarks(next); setDirty(true)
    const noCols = map.filter(j => j < 0).length
    flash(miss.length || noCols ? 'err' : 'ok',
      `${ok} matched${miss.length ? `, ${miss.length} not found (${miss.slice(0, 4).join(', ')}${miss.length > 4 ? '…' : ''})` : ''}${noCols ? `. ${noCols} subject column(s) not found in the header.` : '.'}`)
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
      const m = marks[s.id] || test.subjects.map(() => null)
      if (mode === 'all' && m.every(v => v === null || v === undefined)) return
      compact[s.id] = { gcc: s.gcc_no || '', name: s.name || '', m }
    })
    if (!Object.keys(compact).length) { flash('err', mode === 'selected' ? 'Add at least one student first.' : 'No marks entered yet.'); return }
    if (!Object.values(compact).some(v => v.m.some(x => x !== null && x !== undefined))) { flash('err', 'No marks entered yet.'); return }
    setBusy(true)
    const row = { test_name: test.name.trim(), test_date: test.date || todayStr(), house: lockHouse || 'All', subjects: test.subjects, marks: compact, created_by: currentUser?.username || currentUser?.name || null, updated_at: new Date().toISOString() }
    const q = test.id ? supabase.from('house_test_marks').update(row).eq('id', test.id).select('id').single() : supabase.from('house_test_marks').insert(row).select('id').single()
    const { data, error } = await q
    setBusy(false)
    if (error) { flash('err', /house_test_marks/i.test(error.message || '') && /exist|schema/i.test(error.message || '') ? 'Table missing: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Save failed: ' + error.message); return }
    setTest(t => ({ ...t, id: data.id })); setDirty(false); lsDel(draftKey); loadSaved()
    // Progress records: one row per student per test, so a student's results can be followed over time.
    const rankedPcts = Object.values(calc).filter(c => c.rank).map(c => c.pct)
    const classAvg = rankedPcts.length ? rankedPcts.reduce((a, b) => a + b, 0) / rankedPcts.length : null
    const results = roster.filter(s => compact[s.id] && (calc[s.id].n > 0 || calc[s.id].absent)).map(s => {
      const c = calc[s.id]
      return { test_id: data.id, student_id: String(s.id), gcc_no: s.gcc_no ? String(s.gcc_no) : null, student_name: s.name || null, class_name: s.class_name || null, group_name: test.group || null,
        house: lockHouse || 'All', test_name: test.name.trim(), test_date: test.date || todayStr(), subjects: test.subjects, marks: compact[s.id].m,
        total: c.n ? c.tot : null, max_total: maxTotal, percent: c.n ? Math.round(c.pct * 10) / 10 : null, rank: c.rank || null, ranked_of: stats.ranked || null,
        class_avg_pct: classAvg == null ? null : Math.round(classAvg * 10) / 10, absent: !!c.absent, updated_at: new Date().toISOString() }
    })
    const del = await supabase.from('house_test_results').delete().eq('test_id', data.id)
    const ins = !del.error && results.length ? await supabase.from('house_test_results').insert(results) : { error: del.error }
    if (ins.error) flash('err', /house_test_results/i.test(ins.error.message || '') ? 'Marks saved, but progress records are not set up: run the new part of supabase/RUN_house_test_marks.sql once in Supabase.' : 'Marks saved, but progress records failed: ' + ins.error.message)
    else flash('ok', `Saved ${Object.keys(compact).length} students and their progress records.`)
  }
  const openSaved = r => {
    const byId = {}; school.forEach(s => { byId[s.id] = s })
    const mk = {}; Object.entries(r.marks || {}).forEach(([sid, v]) => { if (byId[sid]) mk[sid] = v.m })
    const ids = Object.keys(mk)
    const subs = r.subjects || clone(PRESETS.jnvst.subjects)
    setTest({ id: r.id, name: r.test_name, date: r.test_date, preset: subs.length === 1 ? 'single' : 'custom', subjects: subs })
    const inHouse = ids.length > 0 && ids.every(id => pool.some(s => s.id === id))
    if (ids.length < pool.length || !inHouse) { setMode('selected'); setPicked(ids) } else { setMode('all'); setPicked([]) }
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
    const l = lastSetup(); setTest({ id: null, name: '', group: '', date: todayStr(), preset: l?.preset || 'jnvst', subjects: clone(l?.subjects || PRESETS.jnvst.subjects) }); setMarks({}); setMode('all'); setPicked([]); setDirty(false); lsDel(draftKey); setDraft(null)
  }

  const shown = roster
    .filter(s => !search.trim() || (String(s.name || '') + ' ' + String(s.gcc_no || '')).toLowerCase().includes(search.trim().toLowerCase()))
    .filter(s => {
      const c = calc[s.id] || {}
      return filt === 'entered' ? (c.n > 0 || c.absent) : filt === 'absent' ? c.absent : filt === 'low' ? c.low : filt === 'bad' ? c.bad : true
    })

  // ── keyboard flow: Enter / ↓ next student, ↑ / Shift+Enter previous, same subject column ──
  const focusCell = (r, c) => {
    const el = tableRef.current?.querySelector(`input[data-r="${r}"][data-c="${c}"]`)
    if (el) { el.focus(); el.select?.() }
    return !!el
  }
  const onCellKey = (e, r, c) => {
    const down = e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)
    const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)
    if (!down && !up) return
    e.preventDefault()
    if (down) { if (!focusCell(r + 1, c)) focusCell(0, c + 1) }
    else if (!focusCell(r - 1, c) && c > 0) focusCell(shown.length - 1, c - 1)
  }
  const jumpNextEmpty = () => {
    for (let r = 0; r < shown.length; r++) {
      const m = marks[shown[r].id] || []
      for (let c = 0; c < test.subjects.length; c++) {
        if (m[c] === null || m[c] === undefined) { focusCell(r, c); tableRef.current?.querySelector(`input[data-r="${r}"][data-c="${c}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
      }
    }
    flash('ok', 'Every shown student has all marks. 🎉')
  }
  const progressPct = stats.students ? Math.round(stats.entered / stats.students * 100) : 0

  // ── styles ──
  const card = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 14 }
  const h = { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 10px' }
  const inp = { padding: '8px 10px', border: `1px solid #cbd5e1`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 38, width: '100%', background: '#fff' }
  const btn = (primary) => ({ padding: '8px 14px', borderRadius: 8, border: `1px solid ${primary ? NAVY : '#cbd5e1'}`, background: primary ? NAVY : '#fff', color: primary ? '#fff' : NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 38 })
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b', minWidth: 0 }
  const th = { padding: '8px 8px', background: '#f1f5f9', fontSize: 12, color: '#475569', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 }
  const thG = { padding: '12px 10px', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: `3px solid ${GOLD}` }
  const markBox = st => st === 'err' ? { background: '#fee2e2', color: '#b91c1c', border: '2px solid #ef4444' } : st === 'low' ? { background: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b' } : { background: '#fff', color: NAVY, border: '2px solid #cbd5e1' }
  const td = { padding: 0, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ ...card, color: '#fff', border: 'none', padding: '20px 22px', background: 'radial-gradient(120% 140% at 100% 0%,#1F4E8C 0%,#132B52 45%,#0B1E3D 85%)', boxShadow: '0 18px 40px -22px rgba(11,30,61,.6), inset 0 0 0 1px rgba(226,197,126,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#E2C57E' }}>{lockHouse ? `🏠 ${lockHouse}` : 'All houses'} · Test marks</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fraunces',Georgia,serif", marginTop: 2 }}>{test.name.trim() || 'New test'}</div>
            <div style={{ fontSize: 12.5, opacity: .8, marginTop: 2 }}>{test.date} · out of {maxTotal} · {test.subjects.map(x => x.n).join(' + ')}</div>
          </div>
          <div style={{ minWidth: 190, flex: '0 1 240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><span style={{ opacity: .8 }}>Entered</span><b>{stats.entered} / {stats.students} · {progressPct}%</b></div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}><div style={{ width: progressPct + '%', height: '100%', borderRadius: 99, background: progressPct === 100 ? '#4ade80' : 'linear-gradient(90deg,#E2C57E,#C9A24B)', transition: 'width .25s' }} /></div>
          </div>
        </div>
      </div>

      {draft && !dirty && (
        <div style={{ ...card, padding: '12px 16px', background: '#fff9ec', borderColor: '#eadbb2', color: '#7a4a00', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ flex: 1, minWidth: 200 }}>📝 You have unsaved marks{draft.test?.name ? <> for <b>{draft.test.name}</b></> : null} from {new Date(draft.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.</span>
          <button type="button" style={btn(true)} onClick={restoreDraft}>Restore</button>
          <button type="button" style={btn(false)} onClick={discardDraft}>Discard</button>
        </div>
      )}
      {msg && <div role="status" style={{ ...card, padding: '10px 14px', background: msg.kind === 'ok' ? '#ecfdf5' : '#fef2f2', borderColor: msg.kind === 'ok' ? '#a7f3d0' : '#fecaca', color: msg.kind === 'ok' ? '#047857' : '#b91c1c', fontSize: 13 }}>{msg.text}</div>}

      <div style={card}>
        <p style={h}>Test details</p>
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
            <button type="button" style={{ ...btn(false), padding: 0 }} aria-label="Remove subject" onClick={() => delSubject(i)} disabled={test.subjects.length < 2 || subjectLocked}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!subjectLocked && <button type="button" style={btn(false)} onClick={addSubject}>+ Add subject</button>}
          <span style={{ fontSize: 12, color: '#64748b' }}>{subjectLocked ? 'One-subject test: name it and set the maximum.' : '“Min” is optional; below it a mark turns amber. JNVST needs 7 in Arithmetic.'}</span>
        </div>
      </div>

      <div style={card}>
        <p style={h}>Students in this test</p>
        {groups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>My groups:</span>
            {groups.map(g => (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, border: `1.5px solid ${GOLD}`, background: '#fffaf0', overflow: 'hidden' }}>
                <button type="button" onClick={() => useGroup(g)} title={`Load ${g.ids.length} students`} style={{ border: 0, background: 'transparent', padding: '6px 6px 6px 12px', fontWeight: 700, fontSize: 12.5, color: NAVY, cursor: 'pointer', fontFamily: 'inherit' }}>{g.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {g.ids.length}</span></button>
                <button type="button" aria-label={`Delete group ${g.name}`} onClick={() => delGroup(g)} style={{ border: 0, background: 'transparent', padding: '6px 10px 6px 4px', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" style={btn(mode === 'all')} onClick={() => { setMode('all'); setDirty(true) }}>Whole house ({pool.length})</button>
          <button type="button" style={btn(mode === 'selected' && picked.length === school.length && school.length > 0)} onClick={() => { setMode('selected'); setPicked(school.map(x => x.id)); setDirty(true) }}>Whole school ({school.length})</button>
          <button type="button" style={btn(mode === 'selected')} onClick={() => { setMode('selected'); setDirty(true) }}>Pick students{mode === 'selected' ? ` (${picked.length})` : ''}</button>
        </div>
        {mode === 'selected' && (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <input style={{ ...inp, flex: '2 1 220px', width: 'auto' }} placeholder="Search any student by name or GCC No" value={pickQ} onChange={e => setPickQ(e.target.value)} />
              <select style={{ ...inp, flex: '1 1 130px', width: 'auto' }} value={fHouse} onChange={e => setFHouse(e.target.value)} aria-label="Filter by house"><option value="">All houses</option>{houses.map(x => <option key={x} value={x}>{x}</option>)}</select>
              <select style={{ ...inp, flex: '1 1 130px', width: 'auto' }} value={fClass} onChange={e => setFClass(e.target.value)} aria-label="Filter by class"><option value="">All classes</option>{classes.map(x => <option key={x} value={x}>{x}</option>)}</select>
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
              {shownAddable.length ? shownAddable.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 13, background: ticks.includes(s.id) ? '#eff6ff' : '#fff', flexDirection: 'row', color: 'inherit' }}>
                  <input type="checkbox" checked={picked.includes(s.id) || ticks.includes(s.id)} disabled={picked.includes(s.id)} onChange={() => toggleTick(s.id)} style={{ width: 18, height: 18, flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.name}<span style={{ color: '#94a3b8' }}> · {s.class_name || ''}{s.house ? ' · ' + s.house : ''}</span></span>
                  <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{s.gcc_no || ''}</span>
                  {picked.includes(s.id)
                    ? <button type="button" onClick={e => { e.preventDefault(); unpickStudent(s.id) }} style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', flex: 'none' }}>✓ On sheet · Remove</button>
                    : <button type="button" onClick={e => { e.preventDefault(); setPicked(p => [...new Set([...p, s.id])]); setTicks(t => t.filter(x => x !== s.id)); setDirty(true) }} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: NAVY, border: 0, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', flex: 'none' }}>＋ Add</button>}
                </label>
              )) : <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>No student matches.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <button type="button" style={btn(true)} onClick={addTicked} disabled={!ticks.length}>{ticks.length ? `Add ${ticks.length} selected` : 'Add selected'}</button>
              <button type="button" style={btn(false)} onClick={tickAllShown} disabled={!tickable.length}>Tick all shown ({tickable.length})</button>
              <button type="button" style={btn(false)} onClick={() => setTicks([])} disabled={!ticks.length}>Clear ticks</button>
              {addable.length > 200 && <span style={{ fontSize: 12, color: '#64748b' }}>Showing first 200 of {addable.length}. Narrow with the filters.</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {roster.map(s => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 99, padding: '4px 6px 4px 10px', fontSize: 12 }}>
                  {s.name}
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => unpickStudent(s.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>✕</button>
                </span>
              ))}
              {!picked.length && <span style={{ fontSize: 12, color: '#64748b' }}>No students picked yet.</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <button type="button" style={btn(false)} onClick={pickMyHouse}>Add my whole house ({pool.length})</button>
              <input style={{ ...inp, maxWidth: 240, flex: '1 1 180px' }} placeholder="Group / class name, e.g. Class VI" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAsGroup() }} />
              <button type="button" style={btn(true)} onClick={saveAsGroup} disabled={!picked.length}>💾 Save as group</button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Save the picked students once under a name; next time one tap loads the whole group. Groups are kept on this computer for {lockHouse || 'all houses'}.</div>
          </div>
        )}
      </div>

      {showImport && <div style={card}>
        <p style={h}>Import marks</p>
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
      </div>}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ ...h, margin: 0 }}>Mark sheet {dirty && <span style={{ color: '#b45309', textTransform: 'none', letterSpacing: 0 }}>· unsaved changes</span>}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn(true)} onClick={save} disabled={busy}>{busy ? 'Saving…' : test.id ? 'Update test' : 'Save test'}</button>
            <button type="button" style={btn(false)} onClick={exportCsv}>CSV</button>
            <button type="button" style={btn(false)} onClick={exportXlsx}>Excel</button>
            <button type="button" style={btn(false)} onClick={newTest}>New test</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8, marginBottom: 12 }}>
          {[
            ['all', 'Students', stats.students, '#1e3a6e'],
            ['entered', 'Entered', stats.entered, '#047857'],
            ['absent', 'Absent', stats.absent, '#64748b'],
            [null, `Average (of ${maxTotal})`, stats.avg == null ? '–' : stats.avg.toFixed(1), '#0e7490'],
            [null, 'Highest', stats.high ?? '–', '#b8923a'],
            ['low', 'Below minimum', stats.low, '#b45309'],
            ['bad', 'Need fixing', stats.bad, '#b91c1c'],
          ].map(([key, l, v, color]) => {
            const on = key && filt === key
            return (
              <button key={l} type="button" disabled={!key} onClick={() => key && setFilt(on && key !== 'all' ? 'all' : key)} aria-pressed={!!on}
                style={{ textAlign: 'left', cursor: key ? 'pointer' : 'default', background: on ? color : '#fff', color: on ? '#fff' : '#0f1f3d', border: `1.5px solid ${on ? color : LINE}`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: '9px 12px', fontFamily: 'inherit', boxShadow: on ? `0 8px 18px -10px ${color}` : 'none', opacity: key || true ? 1 : 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',Georgia,serif", lineHeight: 1.1 }}>{v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: on ? .9 : .6, marginTop: 2 }}>{l}</div>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input style={{ ...inp, maxWidth: 300, flex: '1 1 200px' }} placeholder="🔍 Search any student by name or GCC No" value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" style={btn(false)} onClick={jumpNextEmpty}>⏭ Next empty</button>
          <button type="button" style={btn(showImport)} onClick={() => setShowImport(v => !v)}>⬆ Import Excel / paste</button>
          {filt !== 'all' && <button type="button" style={{ ...btn(false), color: '#b45309' }} onClick={() => setFilt('all')}>✕ Clear filter</button>}
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>⌨ Enter / ↓ next student · ↑ previous · type <b>A</b> for absent</span>
        </div>
        {searchHits.length > 0 && (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, marginBottom: 10, maxWidth: 520, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f8fafc' }}>FROM THE WHOLE SCHOOL · tap to add to this sheet</div>
            {searchHits.map(s => (
              <button key={s.id} type="button" onClick={() => addFromSearch(s.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', padding: '8px 10px', background: '#fff', border: 0, borderTop: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
                <span>{s.name}<span style={{ color: '#94a3b8' }}> · {s.class_name || ''}{s.house ? ' · ' + s.house : ''}</span></span>
                <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{s.gcc_no || ''} ＋</span>
              </button>
            ))}
          </div>
        )}
        {!roster.length ? <div style={{ color: '#64748b', fontSize: 13 }}>No students in this house yet.</div> : (
          <div style={{ overflow: 'auto', maxHeight: '72vh', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 10px 30px -18px rgba(11,30,61,.45)' }}>
            <style>{`.hm-in{transition:border-color .12s,box-shadow .12s}.hm-in:focus{border-color:${NAVY}!important;box-shadow:0 0 0 4px rgba(201,162,75,.55);background:#fffdf5!important}.hm-in::placeholder{color:#cbd5e1}`}</style>
            <table ref={tableRef} style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 560 }}>
              <thead><tr>
                <th style={{ ...thG, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, minWidth: 118 }}>Student</th>
                {test.subjects.map((s, i) => <th key={i} style={thG}>{s.n || 'Subject'}<div style={{ fontWeight: 500, opacity: .75, fontSize: 11 }}>out of {s.max}</div></th>)}
                <th style={thG}>Total<div style={{ fontWeight: 500, opacity: .75, fontSize: 11 }}>out of {maxTotal}</div></th><th style={thG}>%</th><th style={thG}>Rank</th>
              </tr></thead>
              <tbody>
                {shown.map((s, idx) => {
                  const c = calc[s.id] || {}, m = marks[s.id] || []
                  const rowBg = activeRow === s.id ? '#fff8e6' : idx % 2 ? '#f8fafc' : '#fff'
                  const cell = { borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px' }
                  return (
                    <tr key={s.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: rowBg, minWidth: 118, maxWidth: 150, whiteSpace: 'normal', boxShadow: activeRow === s.id ? `inset 4px 0 0 ${GOLD}` : 'none', padding: '8px 10px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}><span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12, marginRight: 6 }}>{idx + 1}</span>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{s.gcc_no ? `GCC ${s.gcc_no}` : ''}{s.class_name ? ` · ${s.class_name}` : ''}{s.house ? ` · ${s.house}` : ''}</div>
                      </td>
                      {test.subjects.map((sub, i) => {
                        const v = m[i] ?? null, st = cellState(v, sub), filled = v !== null && v !== ''
                        return (
                          <td key={i} style={cell}>
                            <input className="hm-in" aria-label={`${s.name} ${sub.n}`} inputMode="decimal" enterKeyHint="next" data-r={idx} data-c={i} value={m[i] ?? ''} onChange={e => setCell(s.id, i, e.target.value)}
                              onFocus={e => { e.target.select(); setActiveRow(s.id) }} onKeyDown={e => onCellKey(e, idx, i)} placeholder="–"
                              style={{ width: 72, height: 48, boxSizing: 'border-box', textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 20, fontWeight: 800, borderRadius: 12, outline: 'none', ...markBox(st), ...(st === '' && filled ? { background: '#f0fdf4', borderColor: '#86efac', color: '#065f46' } : {}) }} />
                          </td>
                        )
                      })}
                      <td style={cell}>{c.absent ? <span style={{ fontWeight: 700, color: '#b45309' }}>Absent</span> : c.n ? <span style={{ display: 'inline-block', minWidth: 46, padding: '6px 10px', borderRadius: 10, background: NAVY, color: '#fff', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 17, fontWeight: 800 }}>{c.tot}</span> : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                      <td style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15, fontWeight: 800, color: !c.n ? '#cbd5e1' : c.pct >= 60 ? '#047857' : c.pct >= 40 ? '#a16207' : '#b91c1c' }}>{c.n ? c.pct.toFixed(1) : '–'}</td>
                      <td style={{ ...cell, fontSize: 16, fontWeight: 800, color: NAVY }}>{c.rank ? (c.rank === 1 ? '🥇 1' : c.rank === 2 ? '🥈 2' : c.rank === 3 ? '🥉 3' : c.rank) : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Green = entered · Red = invalid or above the maximum · Amber = below the minimum. Ties share a rank.</div>
      </div>

      <div style={card}>
        <p style={h}>📈 Student progress</p>
        <select style={{ ...inp, maxWidth: 360 }} value={progId} onChange={e => setProgId(e.target.value)} aria-label="Choose a student to see progress">
          <option value="">Choose a student…</option>
          {school.map(s => <option key={s.id} value={s.id}>{s.name}{s.gcc_no ? ` · ${s.gcc_no}` : ''}</option>)}
        </select>
        {progErr && <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 8 }}>{progErr}</div>}
        {progId && progRows && !progErr && !progRows.length && <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>No saved tests for this student yet. Save a test with their marks and the trend appears here.</div>}
        {progRows && progRows.length > 0 && (() => {
          const scored = progRows.filter(r => r.percent != null)
          const avg = scored.length ? scored.reduce((a, r) => a + Number(r.percent), 0) / scored.length : null
          const last = scored[scored.length - 1], prev = scored[scored.length - 2]
          const delta = last && prev ? Number(last.percent) - Number(prev.percent) : null
          const W = 560, H = 130, padL = 30, padR = 10, padT = 10, padB = 20
          const xs = i => padL + (scored.length < 2 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (scored.length - 1))
          const ys = v => padT + (H - padT - padB) * (1 - Math.max(0, Math.min(100, v)) / 100)
          const line = key => scored.map((r, i) => r[key] == null ? null : `${xs(i)},${ys(Number(r[key]))}`).filter(Boolean).join(' ')
          return (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[['Tests', progRows.length], ['Average', avg == null ? '–' : avg.toFixed(1) + '%'], ['Latest', last ? Number(last.percent).toFixed(1) + '%' : '–'], ['Change', delta == null ? '–' : (delta >= 0 ? '▲ +' : '▼ ') + delta.toFixed(1)]].map(([l, v]) => (
                  <div key={l} style={{ background: '#f1f5f9', borderRadius: 10, padding: '8px 14px', minWidth: 90 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces',Georgia,serif", color: l === 'Change' && delta != null ? (delta >= 0 ? '#047857' : '#b91c1c') : '#0f1f3d' }}>{v}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{l}</div>
                  </div>
                ))}
              </div>
              {scored.length > 0 && (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 640, height: 'auto', display: 'block', marginBottom: 10 }} role="img" aria-label="Percentage by test">
                  {[0, 25, 50, 75, 100].map(g => <g key={g}><line x1={padL} x2={W - padR} y1={ys(g)} y2={ys(g)} stroke="#e2e8f0" strokeWidth="1" /><text x={padL - 4} y={ys(g) + 3} fontSize="9" textAnchor="end" fill="#94a3b8">{g}</text></g>)}
                  <polyline points={line('class_avg_pct')} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
                  <polyline points={line('percent')} fill="none" stroke={NAVY} strokeWidth="2.5" />
                  {scored.map((r, i) => <circle key={r.test_id} cx={xs(i)} cy={ys(Number(r.percent))} r="3.5" fill={GOLD} stroke={NAVY} strokeWidth="1.5"><title>{`${r.test_name}: ${r.percent}%`}</title></circle>)}
                </svg>
              )}
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}><span style={{ color: NAVY, fontWeight: 800 }}>━</span> student % &nbsp; <span style={{ color: '#94a3b8', fontWeight: 800 }}>╌</span> house average %</div>
              <div style={{ overflowX: 'auto', border: `1px solid ${LINE}`, borderRadius: 10 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520, fontSize: 13 }}>
                  <thead><tr>{['Date', 'Test', 'Group', 'Total', '%', 'Rank', 'vs avg'].map(x => <th key={x} style={th}>{x}</th>)}</tr></thead>
                  <tbody>{[...progRows].reverse().map(r => {
                    const d = r.percent != null && r.class_avg_pct != null ? Number(r.percent) - Number(r.class_avg_pct) : null
                    return (
                      <tr key={r.test_id}>
                        <td style={{ ...td, padding: '7px 8px' }}>{r.test_date}</td>
                        <td style={{ ...td, padding: '7px 8px' }}>{r.test_name}</td>
                        <td style={{ ...td, padding: '7px 8px', color: '#64748b' }}>{r.group_name || '–'}</td>
                        <td style={{ ...td, padding: '7px 8px', fontFamily: 'monospace' }}>{r.absent ? 'Absent' : r.total == null ? '–' : `${r.total}/${r.max_total}`}</td>
                        <td style={{ ...td, padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{r.percent == null ? '–' : Number(r.percent).toFixed(1)}</td>
                        <td style={{ ...td, padding: '7px 8px' }}>{r.rank ? `${r.rank}${r.ranked_of ? ' / ' + r.ranked_of : ''}` : '–'}</td>
                        <td style={{ ...td, padding: '7px 8px', fontFamily: 'monospace', color: d == null ? '#94a3b8' : d >= 0 ? '#047857' : '#b91c1c' }}>{d == null ? '–' : (d >= 0 ? '+' : '') + d.toFixed(1)}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </div>
            </div>
          )
        })()}
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

      <div style={{ position: 'sticky', bottom: 10, zIndex: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(11,30,61,.96)', color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 14px 30px -12px rgba(11,30,61,.7)' }}>
        <div style={{ flex: '1 1 200px', fontSize: 13 }}>
          <b>{stats.entered}/{stats.students}</b> entered{stats.bad ? <span style={{ color: '#fca5a5' }}> · {stats.bad} need fixing</span> : null}{dirty ? <span style={{ color: '#fcd34d' }}> · ● unsaved</span> : <span style={{ color: '#86efac' }}> · saved</span>}
        </div>
        <button type="button" onClick={exportXlsx} style={{ ...btn(false), background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}>⬇ Excel</button>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn(false), background: 'linear-gradient(135deg,#E2C57E,#C9A24B)', color: '#0B1E3D', border: 'none', padding: '9px 22px' }}>{busy ? 'Saving…' : test.id ? '💾 Update test' : '💾 Save test'}</button>
      </div>
    </div>
  )
}

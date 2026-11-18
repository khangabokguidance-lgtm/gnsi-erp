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

// Numbered section header: gold badge + title + optional hint / right-side actions.
function Step({ n, title, hint, right, summary, open = true, onToggle }) {
  const collapsible = !!onToggle
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: collapsible && !open ? 0 : 14, flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,#E2C57E,${GOLD})`, color: NAVY, fontWeight: 800, fontSize: 14, boxShadow: '0 6px 12px -6px rgba(201,162,75,.9)', flex: 'none' }}>{n}</span>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 19, fontWeight: 700, color: NAVY, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, overflow: collapsible && !open ? 'hidden' : 'visible', textOverflow: 'ellipsis', whiteSpace: collapsible && !open ? 'nowrap' : 'normal' }}>{collapsible && !open ? (summary || hint) : hint}</div>
      </div>
      {right}
      {collapsible && <button type="button" onClick={onToggle} aria-expanded={open} style={{ border: '1.5px solid #d3dbe7', background: '#fff', color: NAVY, borderRadius: 11, padding: '7px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 38, fontFamily: 'inherit' }}>{open ? 'Done ▴' : '✎ Edit'}</button>}
    </div>
  )
}

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
  const [showAllChips, setShowAllChips] = useState(false)
  const [fHouse, setFHouse] = useState('')
  const [fClass, setFClass] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const tableRef = useRef(null)
  const [filt, setFilt] = useState('all')         // tile filter: all | entered | absent | low | bad
  const [showImport, setShowImport] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [openDet, setOpenDet] = useState(() => !test.name.trim())   // step 1 starts open only for a brand-new test
  const [openStu, setOpenStu] = useState(false)                       // step 2 starts as a one-line summary
  const [justSaved, setJustSaved] = useState(false)
  const nameRef = useRef(null)
  const [bulkCols, setBulkCols] = useState([])        // one text block per subject, one line per student (sheet order)
  const [saveAfter, setSaveAfter] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
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
  const onSheet = useMemo(() => new Set(roster.map(x => x.id)), [roster])
  const searching = !!(pickQ.trim() || fHouse || fClass)
  // Sheet search also looks at the whole school: matches not yet on the sheet can be added in one tap.
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const onSheet = new Set(roster.map(s => s.id))
    return school.filter(s => !onSheet.has(s.id) && (String(s.name || '') + ' ' + String(s.gcc_no || '')).toLowerCase().includes(q)).slice(0, 8)
  }, [search, school, roster])
  const addFromSearch = id => addStudents([id])
  // Every change to the student list goes through here: the first change turns the default
  // "whole house" into an explicit list, so there is only one thing to understand.
  const editPicked = fn => { setPicked(fn(mode === 'all' ? pool.map(x => x.id) : picked)); setMode('selected'); setDirty(true) }
  const addStudents = ids => editPicked(p => [...new Set([...p, ...ids])])
  const unpickStudent = id => { editPicked(p => p.filter(x => x !== id)); setMarks(m => { const c = { ...m }; delete c[id]; return c }) }
  const clearStudents = () => { editPicked(() => []); setMarks({}) }
  const subjectLocked = !!PRESETS[test.preset]?.locked

  useEffect(() => { if (saveAfter) { setSaveAfter(false); save() } })
  useEffect(() => { if (dirty) setJustSaved(false) }, [dirty])
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
  // Saved student lists live in the database (house_test_groups) so they follow the
  // housemaster to any phone or computer. If the table is not created yet, they fall back
  // to this computer only.
  const gHouse = lockHouse || 'All'
  const [groupsDb, setGroupsDb] = useState(null)   // null = unknown, true = database, false = this computer only
  // Every housemaster keeps their own lists: they are stored under the logged-in user (owner).
  const me = String(currentUser?.username || currentUser?.name || currentUser?.id || '')
  const loadGroups = useCallback(async () => {
    const q = () => supabase.from('house_test_groups').select('id,name,student_ids').eq('owner', me).order('name')
    let { data, error } = await q()
    if (error) { setGroupsDb(false); return }
    setGroupsDb(true)
    let rows = data || []
    // Lists made before owners existed (owner '') in this house are claimed by the first housemaster who opens the tab.
    const legacy = await supabase.from('house_test_groups').select('id,name').eq('owner', '').eq('house', gHouse)
    if (me && legacy.data && legacy.data.length) {
      const mine = new Set(rows.map(r => r.name.toLowerCase()))
      for (const l of legacy.data) { if (!mine.has(l.name.toLowerCase())) await supabase.from('house_test_groups').update({ owner: me }).eq('id', l.id) }
      rows = (await q()).data || []
    }
    const local = lsGet('house_marks_groups_' + gHouse.replace(/^All$/, 'all'))
    if (!rows.length && Array.isArray(local) && local.length) {   // one-time move of lists saved on this computer
      await supabase.from('house_test_groups').upsert(local.map(g => ({ owner: me, house: gHouse, name: g.name, student_ids: g.ids || [], updated_at: new Date().toISOString() })), { onConflict: 'owner,name' })
      rows = (await q()).data || []
    }
    setGroups(rows.map(r => ({ id: r.id, name: r.name, ids: Array.isArray(r.student_ids) ? r.student_ids : [] })))
  }, [gHouse, me])
  useEffect(() => { loadGroups() }, [loadGroups])
  const saveAsGroup = async () => {
    const name = groupName.trim()
    if (!name) { flash('err', 'Type a name for this list first, e.g. “Class VI Navodaya”.'); return }
    if (!roster.length) { flash('err', 'Add some students first.'); return }
    const ids = roster.map(x => x.id)
    const overlap = new Set()
    groups.filter(g => g.name.toLowerCase() !== name.toLowerCase()).forEach(g => g.ids.forEach(i => { if (ids.includes(i)) overlap.add(i) }))
    const { error } = await supabase.from('house_test_groups').upsert({ owner: me, house: gHouse, name, student_ids: ids, created_by: me || null, updated_at: new Date().toISOString() }, { onConflict: 'owner,name' })
    if (error) {
      const others = groups.filter(g => g.name.toLowerCase() !== name.toLowerCase())
      const next = [...others, { id: Date.now(), name, ids }].sort((a, b) => a.name.localeCompare(b.name))
      setGroups(next); lsSet(groupsKey, next); setGroupsDb(false)
      flash('err', 'Saved on this computer only. Run supabase/RUN_house_test_marks.sql to save lists in the database.'); setGroupName(''); return
    }
    setGroupName(''); await loadGroups(); flash(overlap.size ? 'err' : 'ok', `List “${name}” saved with ${ids.length} student${ids.length === 1 ? '' : 's'}.${overlap.size ? ` ⚠ ${overlap.size} of them are also in another list — see “Check lists”.` : ''}`)
  }
  const useGroup = g => {
    const live = new Set(school.map(s => s.id))
    const ids = g.ids.filter(id => live.has(id))
    setMode('selected'); setPicked(ids); setDirty(true)
    setTest(t => ({ ...t, group: g.name, name: t.name.trim() ? t.name : g.name + ' – ' }))
    flash('ok', `${g.name}: ${ids.length} student${ids.length === 1 ? '' : 's'} loaded${ids.length < g.ids.length ? ` (${g.ids.length - ids.length} no longer active)` : ''}.`)
  }
  const delGroup = async g => {
    if (!window.confirm(`Delete the list “${g.name}”? The students themselves are not affected.`)) return
    if (groupsDb) { const { error } = await supabase.from('house_test_groups').delete().eq('id', g.id); if (error) { flash('err', 'Could not delete: ' + error.message); return }; await loadGroups() }
    else { const next = groups.filter(x => x.id !== g.id); setGroups(next); lsSet(groupsKey, next) }
  }
  // Students who sit in more than one saved list.
  const dupes = useMemo(() => {
    const m = new Map()
    groups.forEach(g => g.ids.forEach(id => { if (!m.has(id)) m.set(id, []); m.get(id).push(g.name) }))
    return [...m].filter(([, n]) => n.length > 1).map(([id, names]) => ({ id, names, name: (school.find(x => x.id === id) || {}).name || 'Unknown student' }))
  }, [groups, school])
  const dupLists = useMemo(() => { const m = {}; dupes.forEach(d => d.names.forEach(n => { m[n] = (m[n] || 0) + 1 })); return m }, [dupes])
  const [mgrOpen, setMgrOpen] = useState(false)
  const [mgrList, setMgrList] = useState(null)
  const removeFromGroup = async (g, sid) => {
    const ids = g.ids.filter(i => i !== sid)
    if (groupsDb) { const { error } = await supabase.from('house_test_groups').update({ student_ids: ids, updated_at: new Date().toISOString() }).eq('id', g.id); if (error) { flash('err', 'Could not update: ' + error.message); return } }
    const next = groups.map(x => x.id === g.id ? { ...x, ids } : x)
    setGroups(next); if (!groupsDb) lsSet(groupsKey, next)
  }
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

  // One tap marks a student absent in every subject (or clears it) - handy on phones, where the number keypad has no letters.
  const toggleAbsentRow = sid => {
    setMarks(prev => {
      const cur = prev[sid] || []
      const allAb = test.subjects.length > 0 && test.subjects.every((_, i) => cur[i] === 'AB')
      return { ...prev, [sid]: test.subjects.map(() => allAb ? null : 'AB') }
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
  // ── PDF result sheet: school letterhead, ranked table, ready to share ──
  const exportPdf = async (share) => {
    if (!roster.length || !stats.entered) { flash('err', 'Enter some marks first.'); return }
    setPdfBusy(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, { pdfLetterhead, pdfFooters }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./reportKit')])
      const landscape = test.subjects.length > 4
      const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const mx = 12, W = doc.internal.pageSize.getWidth()
      let y = pdfLetterhead(doc, { title: 'Test Result' + (test.name ? ' – ' + test.name : ''), margin: mx, date: test.date ? new Date(test.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105)
      const info = [lockHouse ? `House: ${lockHouse}` : 'All houses', test.group ? `Group: ${test.group}` : null, `Students: ${roster.length}`, `Maximum: ${maxTotal}`, stats.avg == null ? null : `Average: ${stats.avg.toFixed(1)}`, stats.high == null ? null : `Highest: ${stats.high}`, stats.absent ? `Absent: ${stats.absent}` : null].filter(Boolean).join('   ·   ')
      doc.text(info, mx, y); y += 4
      const sorted = sortedForExport()
      const body = sorted.map(st => {
        const c = calc[st.id], m = marks[st.id] || []
        return [c.rank || '–', st.name || '', st.gcc_no || '', st.class_name || '', ...test.subjects.map((_, i) => m[i] ?? '–'), c.absent ? 'AB' : c.n ? c.tot : '–', c.n ? c.pct.toFixed(1) + '%' : '–', c.absent ? 'Absent' : c.bad ? 'Check marks' : c.low ? 'Below minimum' : '']
      })
      const nSub = test.subjects.length
      autoTable(doc, {
        startY: y,
        head: [['Rank', 'Student', 'GCC', 'Class', ...test.subjects.map(x => `${x.n}\n/${x.max}`), 'Total\n/' + maxTotal, '%', 'Remark']],
        body,
        margin: { left: mx, right: mx, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [11, 30, 61], textColor: 255, halign: 'center', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 }, 1: { fontStyle: 'bold', cellWidth: 'auto' } },
        didParseCell: d => {
          if (d.section !== 'body') return
          const ci = d.column.index
          if (ci >= 4 && ci < 4 + nSub) {
            d.cell.styles.halign = 'center'
            const st = sorted[d.row.index], v = (marks[st.id] || [])[ci - 4]
            const cs = cellState(v ?? null, test.subjects[ci - 4])
            if (cs === 'err') { d.cell.styles.fillColor = [254, 226, 226]; d.cell.styles.textColor = [185, 28, 28] }
            else if (cs === 'low') { d.cell.styles.fillColor = [254, 243, 199]; d.cell.styles.textColor = [146, 64, 14] }
          }
          if (ci === 4 + nSub || ci === 5 + nSub) { d.cell.styles.halign = 'center'; d.cell.styles.fontStyle = 'bold' }
          if (ci === 0 && Number(d.cell.raw) >= 1 && Number(d.cell.raw) <= 3) { d.cell.styles.fillColor = [[226, 197, 126], [226, 232, 240], [231, 200, 160]][Number(d.cell.raw) - 1] }
        },
      })
      const endY = doc.lastAutoTable?.finalY || y
      doc.setFontSize(8); doc.setTextColor(100, 116, 139)
      if (endY < doc.internal.pageSize.getHeight() - 24) doc.text('Amber = below the minimum mark · Red = invalid mark · AB = absent · Equal totals share a rank.', mx, endY + 6)
      pdfFooters(doc, { margin: mx })
      const blob = doc.output('blob'), fname = baseName() + '.pdf'
      const file = new File([blob], fname, { type: 'application/pdf' })
      if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: test.name || 'Test result', text: `${test.name || 'Test result'} – result sheet` }); flash('ok', 'Shared.') }
        catch (e) { if (e?.name !== 'AbortError') { download(blob, fname); flash('ok', 'Could not open sharing, so the PDF was downloaded instead.') } }
      } else { download(blob, fname); flash('ok', share ? 'Sharing is not available on this device, so the PDF was downloaded.' : 'PDF downloaded.') }
    } catch (e) { flash('err', 'Could not make the PDF: ' + (e?.message || e)) }
    setPdfBusy(false)
  }
  const template = () => {
    const rows = [['GCC No', 'Name', ...test.subjects.map(s => s.n)], ...roster.map(s => [s.gcc_no || '', s.name || '', ...test.subjects.map(() => '')])]
    download(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), 'marks-template-' + (lockHouse || 'all').toLowerCase().replace(/\W+/g, '-') + '.csv')
  }

  // ── save / open / delete ──
  // ── Enter all marks at once: one column of text per subject, one line per student ──
  const openBulk = () => {
    setBulkCols(test.subjects.map((_, j) => roster.map(s => { const v = (marks[s.id] || [])[j]; return v === null || v === undefined ? '' : String(v) }).join('\n')))
    setBulkOpen(true); setShowImport(false)
  }
  const bulkLines = j => (bulkCols[j] ?? '').split('\n')
  const bulkExtra = Math.max(0, ...bulkCols.map((c, j) => bulkLines(j).filter(x => x.trim() !== '').length - roster.length))
  const applyBulk = (thenSave) => {
    const next = { ...marks }
    roster.forEach((s, i) => { next[s.id] = test.subjects.map((_, j) => parseMark((bulkLines(j)[i] ?? '').trim())) })
    setMarks(next); setDirty(true); setBulkOpen(false)
    if (thenSave) setSaveAfter(true)
    else flash('ok', `Marks applied to ${roster.length} students. Check the sheet, then save.`)
  }
  const save = async () => {
    if (!test.name.trim()) { setOpenDet(true); flash('err', 'Give the test a name first.'); setTimeout(() => { nameRef.current?.focus(); nameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 80); return }
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
    setTest(t => ({ ...t, id: data.id })); setDirty(false); setJustSaved(true); lsDel(draftKey); loadSaved()
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
  const card = { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 1px 2px rgba(11,30,61,.04), 0 14px 30px -22px rgba(11,30,61,.28)' }
  const h = { fontSize: 11.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }
  const inp = { padding: '9px 12px', border: '1.5px solid #d3dbe7', borderRadius: 11, fontSize: 14.5, boxSizing: 'border-box', minHeight: 42, width: '100%', background: '#fff', color: NAVY, fontFamily: 'inherit' }
  const btn = (primary) => ({ padding: '9px 16px', borderRadius: 11, border: `1.5px solid ${primary ? NAVY : '#d3dbe7'}`, background: primary ? `linear-gradient(180deg,#16335f,${NAVY})` : '#fff', color: primary ? '#fff' : NAVY, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', minHeight: 42, fontFamily: 'inherit', boxShadow: primary ? '0 6px 14px -8px rgba(11,30,61,.7)' : 'none' })
  const lab = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#64748b', minWidth: 0 }
  const bulkHead = { padding: '12px 10px', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: `3px solid ${GOLD}` }
  const th = { padding: '8px 8px', background: '#f1f5f9', fontSize: 12, color: '#475569', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 }
  const thG = { padding: '12px 10px', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: `3px solid ${GOLD}` }
  const markBox = st => st === 'err' ? { background: '#fee2e2', color: '#b91c1c', border: '2px solid #ef4444' } : st === 'low' ? { background: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b' } : { background: '#fff', color: NAVY, border: '2px solid #cbd5e1' }
  const td = { padding: 0, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }

  return (
    <div className="hm-root" style={{ maxWidth: 1180, margin: '0 auto', fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif", color: NAVY }}>
      <style>{`
        .hm-root *{box-sizing:border-box}
        .hm-root button{transition:transform .12s ease,box-shadow .12s ease,background-color .12s ease,border-color .12s ease,filter .12s ease}
        .hm-root button:not(:disabled):hover{filter:brightness(.97);transform:translateY(-1px)}
        .hm-root button:not(:disabled):active{transform:translateY(0);filter:brightness(.94)}
        .hm-root button:disabled{opacity:.45;cursor:not-allowed}
        .hm-root button.hm-tile:disabled{opacity:1;cursor:default}
        .hm-root button:focus-visible,.hm-root [role=button]:focus-visible{outline:3px solid rgba(201,162,75,.65);outline-offset:2px}
        .hm-root input:not([type=checkbox]),.hm-root select,.hm-root textarea{transition:border-color .12s ease,box-shadow .12s ease}
        .hm-root input:not([type=checkbox]):focus,.hm-root select:focus,.hm-root textarea:focus{outline:none;border-color:${NAVY};box-shadow:0 0 0 4px rgba(201,162,75,.30)}
        .hm-root ::placeholder{color:#9aa8bb}
        .hm-seg{display:inline-flex;border:1.5px solid #d3dbe7;border-radius:12px;overflow:hidden;background:#fff}
        .hm-seg button{border:0!important;border-radius:0!important;min-height:40px!important;box-shadow:none!important;border-right:1px solid #e3e9f1!important}
        .hm-seg button:last-child{border-right:0!important}
        .hm-seg button:not(:disabled):hover{background:#f4f7fb!important;transform:none!important}
        .hm-subrow{display:grid;grid-template-columns:28px minmax(0,1fr) 84px 84px 40px;gap:8px;align-items:center}
        .hm-subhead{padding:0 2px 6px;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
        .hm-cap{display:none;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;margin-bottom:3px}
        @media (max-width:560px){
          .hm-subhead{display:none}
          .hm-subrow{grid-template-columns:28px minmax(0,1fr) minmax(0,1fr) 40px;row-gap:6px;padding-bottom:12px;border-bottom:1px dashed #d3dbe7}
          .hm-subrow:last-child{padding-bottom:0;border-bottom:0}
          .hm-subrow .hm-badge{grid-row:1 / 3;align-self:start;margin-top:6px}
          .hm-subrow .hm-nm{grid-column:2 / 5}
          .hm-subrow .hm-cap{display:block}
        }
        .hm-lift{transition:box-shadow .15s ease,transform .15s ease,border-color .15s ease}
        .hm-lift:hover{box-shadow:0 12px 26px -16px rgba(11,30,61,.4);transform:translateY(-1px);border-color:#c7d2e2!important}
        @media (prefers-reduced-motion:reduce){.hm-root *{transition:none!important;animation:none!important}}
      `}</style>
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
      {justSaved && !dirty && (
        <div role="status" style={{ ...card, padding: '14px 16px', background: 'linear-gradient(135deg,#ecfdf5,#f0fdf9)', borderColor: '#a7f3d0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 200px', color: '#047857', fontWeight: 700, fontSize: 14 }}>✅ Saved{test.name ? <> “{test.name}”</> : null}. Send the result sheet now:</span>
          <button type="button" style={{ ...btn(true), background: '#128C4A', borderColor: '#128C4A' }} onClick={() => exportPdf(true)} disabled={pdfBusy}>📤 Share PDF</button>
          <button type="button" style={btn(false)} onClick={() => exportPdf(false)} disabled={pdfBusy}>📄 Download PDF</button>
          <button type="button" style={{ ...btn(false), border: '1.5px solid transparent', color: '#64748b' }} onClick={() => setJustSaved(false)}>Dismiss</button>
        </div>
      )}
      {msg && <div role="status" style={{ ...card, padding: '10px 14px', background: msg.kind === 'ok' ? '#ecfdf5' : '#fef2f2', borderColor: msg.kind === 'ok' ? '#a7f3d0' : '#fecaca', color: msg.kind === 'ok' ? '#047857' : '#b91c1c', fontSize: 13 }}>{msg.text}</div>}

      <div style={card}>
        <Step n={1} title="Test details" hint="Name the test, set the date and choose the subjects." open={openDet} onToggle={() => setOpenDet(v => !v)}
          summary={`${test.name.trim() || 'Untitled test'} · ${test.date} · ${test.subjects.map(x => `${x.n} ${x.max}`).join(' + ')}`} />
        {openDet && <div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ ...lab, flex: '2 1 220px' }}>Test name<input ref={nameRef} style={inp} value={test.name} placeholder="e.g. Weekly Test 7 – JNVST" onChange={e => { setTest(t => ({ ...t, name: e.target.value })); setDirty(true) }} /></label>
          <label style={{ ...lab, flex: '1 1 150px' }}>Date<input style={inp} type="date" value={test.date} onChange={e => { setTest(t => ({ ...t, date: e.target.value })); setDirty(true) }} /></label>
          <label style={{ ...lab, flex: '2 1 240px' }}>Subject preset
            <select style={inp} value={test.preset} onChange={e => setPreset(e.target.value)}>
              {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
        </div>
        <div style={{ background: '#f6f8fb', border: '1px solid #e3e9f1', borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <div className="hm-subrow hm-subhead">
            <span /><span>Subject</span><span>Max marks</span><span>Min to pass</span><span />
          </div>
          {test.subjects.map((s, i) => (
            <div key={i} className="hm-subrow" style={{ marginBottom: i === test.subjects.length - 1 ? 0 : 8 }}>
              <span aria-hidden="true" className="hm-badge" style={{ width: 28, height: 28, borderRadius: 9, background: NAVY, color: '#E2C57E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{i + 1}</span>
              <div className="hm-nm"><span className="hm-cap">Subject</span><input style={inp} value={s.n} aria-label={`Subject ${i + 1} name`} onChange={e => updSubject(i, 'n', e.target.value)} /></div>
              <div><span className="hm-cap">Max marks</span><input style={{ ...inp, textAlign: 'center' }} type="number" min="1" aria-label={`Subject ${i + 1} maximum`} value={s.max} onChange={e => updSubject(i, 'max', e.target.value)} /></div>
              <div><span className="hm-cap">Min to pass</span><input style={{ ...inp, textAlign: 'center' }} type="number" min="0" aria-label={`Subject ${i + 1} minimum`} placeholder="–" value={s.min} onChange={e => updSubject(i, 'min', e.target.value)} /></div>
              <button type="button" style={{ ...btn(false), padding: 0, color: '#94a3b8' }} aria-label="Remove subject" onClick={() => delSubject(i)} disabled={test.subjects.length < 2 || subjectLocked}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!subjectLocked && <button type="button" style={btn(false)} onClick={addSubject}>+ Add subject</button>}
          <span style={{ fontSize: 12, color: '#64748b' }}>{subjectLocked ? 'One-subject test: name it and set the maximum.' : '“Min” is optional; below it a mark turns amber. JNVST needs 7 in Arithmetic.'}</span>
        </div>
        </div>}
      </div>

      <div style={card}>
        <Step n={2} title="Students" hint="Who is sitting this test. Use your house, the whole school, or a saved list." open={openStu} onToggle={() => setOpenStu(v => !v)}
          summary={`${roster.length} student${roster.length === 1 ? '' : 's'} on the sheet${mode === 'all' ? ` · your house${lockHouse ? ' (' + lockHouse + ')' : ''}` : test.group ? ' · ' + test.group : ''}`} />
        {openStu && <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginRight: 4 }}>{roster.length} on this sheet</span>
          <button type="button" style={btn(false)} onClick={() => editPicked(() => pool.map(x => x.id))}>🏠 My house ({pool.length})</button>
          <button type="button" style={btn(false)} onClick={() => editPicked(() => school.map(x => x.id))}>🏫 Whole school ({school.length})</button>
          <button type="button" style={{ ...btn(false), color: '#b91c1c' }} onClick={clearStudents} disabled={!roster.length}>Clear all</button>
        </div>

        {groups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Saved lists:</span>
            {groups.map(g => (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, border: `1.5px solid ${GOLD}`, background: '#fffaf0', overflow: 'hidden' }}>
                <button type="button" onClick={() => useGroup(g)} title={`Load ${g.ids.length} students`} style={{ border: 0, background: 'transparent', padding: '6px 6px 6px 12px', fontWeight: 700, fontSize: 12.5, color: NAVY, cursor: 'pointer', fontFamily: 'inherit' }}>{g.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {g.ids.length}</span></button>
                <button type="button" aria-label={`Delete list ${g.name}`} onClick={() => delGroup(g)} style={{ border: 0, background: 'transparent', padding: '6px 10px 6px 4px', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
              </span>
            ))}
          </div>
        )}

        {groups.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setMgrOpen(v => !v)} style={{ ...btn(false), minHeight: 34, fontSize: 12.5, borderColor: dupes.length ? '#f59e0b' : LINE, background: dupes.length ? '#fffbeb' : '#fff' }}>
              {dupes.length ? `⚠ ${dupes.length} student${dupes.length === 1 ? ' is' : 's are'} in 2+ lists · Check lists` : '🗂 Manage my lists'} {mgrOpen ? '▴' : '▾'}
            </button>
            {mgrOpen && (
              <div style={{ marginTop: 8, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, background: '#fbfcfe' }}>
                {dupes.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 10px', marginBottom: 10, fontSize: 12.5, color: '#92400e' }}>
                    <b>Duplicates</b> — same student in more than one list:
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{dupes.map(d => <li key={d.id}><b>{d.name}</b> → {d.names.join(', ')}</li>)}</ul>
                  </div>
                )}
                {groups.map(g => {
                  const open = mgrList === g.id
                  return (
                    <div key={g.id} style={{ borderTop: `1px solid ${LINE}`, padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setMgrList(open ? null : g.id)} style={{ border: 0, background: 'transparent', fontWeight: 800, color: NAVY, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{open ? '▾' : '▸'} {g.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {g.ids.length} students</span></button>
                        {dupLists[g.name] ? <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', background: '#fef3c7', borderRadius: 99, padding: '2px 8px' }}>{dupLists[g.name]} shared</span> : null}
                        <span style={{ flex: 1 }} />
                        <button type="button" style={{ ...btn(false), minHeight: 28, padding: '3px 10px', fontSize: 12 }} onClick={() => useGroup(g)}>Use</button>
                        <button type="button" style={{ ...btn(false), minHeight: 28, padding: '3px 10px', fontSize: 12, color: '#b91c1c' }} onClick={() => delGroup(g)}>Delete list</button>
                      </div>
                      {open && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                          {g.ids.length === 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Empty list.</span>}
                          {g.ids.map(id => {
                            const st = school.find(x => x.id === id); const also = groups.filter(o => o.id !== g.id && o.ids.includes(id)).map(o => o.name)
                            return (
                              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 8px', borderRadius: 8, background: also.length ? '#fffbeb' : '#fff', border: `1px solid ${also.length ? '#fcd34d' : LINE}` }}>
                                <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: NAVY }}>{st ? st.name : 'Student no longer active'}</b>{st && st.class_name ? <span style={{ color: '#64748b' }}> · {st.class_name}</span> : null}{also.length ? <span style={{ color: '#92400e', fontSize: 11.5 }}> · also in {also.join(', ')}</span> : null}</span>
                                <button type="button" aria-label={`Remove from ${g.name}`} onClick={() => removeFromGroup(g, id)} style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Remove</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <input style={{ ...inp, flex: '2 1 220px', width: 'auto' }} placeholder="🔍 Find a student to add: name or GCC No" value={pickQ} onChange={e => setPickQ(e.target.value)} />
          <select style={{ ...inp, flex: '1 1 120px', width: 'auto' }} value={fHouse} onChange={e => setFHouse(e.target.value)} aria-label="Filter by house"><option value="">All houses</option>{houses.map(x => <option key={x} value={x}>{x}</option>)}</select>
          <select style={{ ...inp, flex: '1 1 120px', width: 'auto' }} value={fClass} onChange={e => setFClass(e.target.value)} aria-label="Filter by class"><option value="">All classes</option>{classes.map(x => <option key={x} value={x}>{x}</option>)}</select>
        </div>
        {searching ? (
          <div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, maxHeight: 260, overflowY: 'auto' }}>
              {shownAddable.length ? shownAddable.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${LINE}`, fontSize: 13, background: onSheet.has(s.id) ? '#f0fdf4' : '#fff' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: NAVY }}>{s.name}</b><span style={{ color: '#94a3b8' }}> · {s.gcc_no || ''} · {s.class_name || ''}{s.house ? ' · ' + s.house : ''}</span></span>
                  {onSheet.has(s.id)
                    ? <button type="button" onClick={() => unpickStudent(s.id)} style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', flex: 'none' }}>✓ Added · Remove</button>
                    : <button type="button" onClick={() => addStudents([s.id])} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: NAVY, border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', flex: 'none' }}>＋ Add</button>}
                </div>
              )) : <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>No student matches.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <button type="button" style={btn(true)} onClick={() => addStudents(addable.map(x => x.id))} disabled={!addable.some(x => !onSheet.has(x.id))}>＋ Add all {addable.filter(x => !onSheet.has(x.id)).length} shown</button>
              <button type="button" style={btn(false)} onClick={() => { setPickQ(''); setFHouse(''); setFClass('') }}>Done</button>
              {addable.length > 200 && <span style={{ fontSize: 12, color: '#64748b' }}>Showing 200 of {addable.length}; “Add all” adds every match.</span>}
            </div>
          </div>
        ) : <div style={{ fontSize: 12, color: '#64748b' }}>Type a name or GCC No, or pick a house or class, to add students from the whole school.</div>}

        {roster.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(showAllChips ? roster : roster.slice(0, 24)).map(s => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 99, padding: '4px 6px 4px 10px', fontSize: 12 }}>
                  {s.name}
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => unpickStudent(s.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>✕</button>
                </span>
              ))}
              {roster.length > 24 && <button type="button" onClick={() => setShowAllChips(v => !v)} style={{ ...btn(false), minHeight: 28, padding: '3px 10px', fontSize: 12 }}>{showAllChips ? 'Show fewer' : `Show all ${roster.length}`}</button>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
              <input style={{ ...inp, maxWidth: 260, flex: '1 1 180px' }} placeholder="Name this list, e.g. Class VI" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAsGroup() }} />
              <button type="button" style={btn(true)} onClick={saveAsGroup}>💾 Save this list</button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{groupsDb === false ? 'Lists are saved on this computer only (database table not created yet).' : 'Your saved lists are stored in the database under your login, so only you see them and you can load them on any phone or computer.'}</div>
          </div>
        )}
        </div>}
      </div>

      {bulkOpen && <div style={{ ...card, border: `2px solid ${GOLD}` }}>
        <p style={h}>⚡ Enter all marks at once</p>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
          Type each mark on its own line (press Enter for the next student), or paste a whole column from Excel. Lines match the students in the order shown. Write <b>AB</b> for absent; leave a line empty for no mark.
        </div>
        <div style={{ overflow: 'auto', maxHeight: '60vh', border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', minWidth: 'max-content' }}>
            <div style={{ position: 'sticky', left: 0, zIndex: 1, background: '#f8fafc', borderRight: `2px solid ${LINE}`, minWidth: 150, maxWidth: 190 }}>
              <div style={{ ...bulkHead, textAlign: 'left', height: 46, boxSizing: 'border-box' }}>Student</div>
              <div style={{ padding: '8px 0' }}>
                {roster.map((s, i) => <div key={s.id} style={{ height: 30, lineHeight: '30px', padding: '0 10px', fontSize: 13.5, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11.5, marginRight: 6 }}>{i + 1}</span>{s.name}</div>)}
              </div>
            </div>
            {test.subjects.map((sub, j) => (
              <div key={j} style={{ borderRight: `1px solid ${LINE}`, minWidth: 110 }}>
                <div style={{ ...bulkHead, height: 46, boxSizing: 'border-box', padding: '6px 10px' }}>{sub.n || 'Subject'}<div style={{ fontWeight: 500, opacity: .75, fontSize: 11 }}>out of {sub.max}</div></div>
                <div style={{ padding: '8px 0' }}>
                  <textarea aria-label={`${sub.n} marks, one line per student`} wrap="off" spellCheck={false} inputMode="decimal" value={bulkCols[j] ?? ''}
                    onChange={e => setBulkCols(c => c.map((x, k) => k === j ? e.target.value : x))}
                    style={{ display: 'block', width: 110, height: Math.max(roster.length, 1) * 30 + 30, border: 0, outline: 'none', resize: 'none', overflow: 'hidden', padding: '0 10px', margin: 0, lineHeight: '30px', fontSize: 16, fontWeight: 800, fontFamily: 'ui-monospace, Menlo, monospace', color: NAVY, textAlign: 'center', background: 'repeating-linear-gradient(to bottom,#fff 0,#fff 30px,#f1f5f9 30px,#f1f5f9 60px)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {bulkExtra > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b45309', fontWeight: 700 }}>⚠ A column has {bulkExtra} more line{bulkExtra === 1 ? '' : 's'} than students ({roster.length}). Extra lines are ignored.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" style={btn(true)} onClick={() => applyBulk(true)} disabled={busy}>💾 Apply &amp; save test</button>
          <button type="button" style={btn(false)} onClick={() => applyBulk(false)}>Apply to sheet</button>
          <button type="button" style={btn(false)} onClick={() => setBulkOpen(false)}>Cancel</button>
        </div>
      </div>}

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
        <Step n={3} title="Enter marks" hint={dirty ? 'You have unsaved changes.' : 'Type in the grid, enter everything at once, or import a sheet.'}
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={{ ...btn(true), padding: '9px 20px' }} onClick={save} disabled={busy}>{busy ? 'Saving…' : test.id ? '💾 Update test' : '💾 Save test'}</button>
              <div className="hm-seg" role="group" aria-label="Export">
                <button type="button" style={btn(false)} onClick={() => exportPdf(false)} disabled={pdfBusy} title="Download a PDF result sheet">{pdfBusy ? '…' : '📄 PDF'}</button>
                <button type="button" style={{ ...btn(false), color: '#128C4A' }} onClick={() => exportPdf(true)} disabled={pdfBusy} title="Share the PDF on WhatsApp or any app">📤 Share</button>
                <button type="button" style={btn(false)} onClick={exportXlsx}>Excel</button>
                <button type="button" style={btn(false)} onClick={exportCsv}>CSV</button>
              </div>
              <button type="button" style={{ ...btn(false), border: '1.5px solid transparent', color: '#64748b' }} onClick={newTest}>＋ New test</button>
            </div>
          } />
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
              <button key={l} type="button" className="hm-tile" disabled={!key} onClick={() => key && setFilt(on && key !== 'all' ? 'all' : key)} aria-pressed={!!on}
                style={{ textAlign: 'left', cursor: key ? 'pointer' : 'default', background: on ? color : '#fff', color: on ? '#fff' : '#0f1f3d', border: `1.5px solid ${on ? color : LINE}`, borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '11px 14px', fontFamily: 'inherit', boxShadow: on ? `0 8px 18px -10px ${color}` : '0 1px 2px rgba(11,30,61,.04)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',Georgia,serif", lineHeight: 1.1 }}>{v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: on ? .9 : .6, marginTop: 2 }}>{l}</div>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input style={{ ...inp, maxWidth: 300, flex: '1 1 200px' }} placeholder="🔍 Search any student by name or GCC No" value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" style={btn(false)} onClick={jumpNextEmpty}>⏭ Next empty</button>
          <button type="button" style={{ ...btn(true), background: bulkOpen ? '#1e3a66' : NAVY }} onClick={() => bulkOpen ? setBulkOpen(false) : openBulk()} disabled={!roster.length}>⚡ Enter all marks at once</button>
          <button type="button" style={btn(showImport)} onClick={() => { setShowImport(v => !v); setBulkOpen(false) }}>⬆ Import Excel / paste</button>
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
          <div className="hm-gridwrap" style={{ overflow: 'auto', maxHeight: '72vh', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 10px 30px -18px rgba(11,30,61,.45)' }}>
            <style>{`.hm-in{transition:border-color .12s,box-shadow .12s}.hm-in:focus{border-color:${NAVY}!important;box-shadow:0 0 0 4px rgba(201,162,75,.55);background:#fffdf5!important}.hm-in::placeholder{color:#cbd5e1}
              @media (max-width:640px){
                .hm-gridwrap{overflow:visible!important;max-height:none!important;border:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important}
                .hm-grid{display:block!important;min-width:0!important;width:100%!important}
                .hm-grid thead{display:none!important}
                .hm-grid tbody{display:block!important}
                .hm-grid tr{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px 10px;background:#fff!important;border:1.5px solid #dbe3ee!important;border-radius:18px;padding:14px!important;margin:0 0 14px!important;box-shadow:0 2px 8px rgba(11,30,61,.07)}
                .hm-grid tr[data-active]{border-color:#C9A24B!important;background:#fffaf0!important;box-shadow:0 0 0 3px rgba(201,162,75,.35)}
                .hm-grid td{display:block!important;position:static!important;border:0!important;padding:0!important;min-width:0!important;max-width:none!important;background:transparent!important;box-shadow:none!important;text-align:left!important;white-space:normal!important}
                .hm-grid td.hm-c-stu{grid-column:1/-1;padding-bottom:8px!important;border-bottom:1px solid #e2e8f0!important}
                .hm-grid td.hm-c-mark::before{content:attr(data-sub);display:block;font-size:11.5px;font-weight:800;color:#0B1E3D;margin-bottom:5px;line-height:1.2}
                .hm-grid td.hm-c-mark input{width:100%!important;height:58px!important;font-size:26px!important}
                .hm-grid td.hm-c-sum{background:#f1f5f9!important;border-radius:12px;padding:7px 10px!important}
                .hm-grid td.hm-c-sum::before{content:attr(data-sub);display:block;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-bottom:2px}
              }
            `}</style>
            <table ref={tableRef} data-rt-skip className="hm-grid" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 560 }}>
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
                    <tr key={s.id} data-active={activeRow === s.id ? '1' : undefined} style={{ background: rowBg }}>
                      <td className="hm-c-stu" style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: rowBg, minWidth: 118, maxWidth: 150, whiteSpace: 'normal', boxShadow: activeRow === s.id ? `inset 4px 0 0 ${GOLD}` : 'none', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}><span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12, marginRight: 6 }}>{idx + 1}</span>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{s.gcc_no ? `GCC ${s.gcc_no}` : ''}{s.class_name ? ` · ${s.class_name}` : ''}{s.house ? ` · ${s.house}` : ''}</div>
                          </div>
                          <button type="button" onClick={() => toggleAbsentRow(s.id)} aria-label={`Mark ${s.name} absent`} title="Absent in all subjects" style={{ flex: 'none', minHeight: 28, padding: '2px 7px', fontSize: 11, fontWeight: 800, borderRadius: 8, border: `1.5px solid ${c.absent ? '#f59e0b' : '#d3dbe7'}`, background: c.absent ? '#fef3c7' : '#fff', color: c.absent ? '#92400e' : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>AB</button>
                        </div>
                      </td>
                      {test.subjects.map((sub, i) => {
                        const v = m[i] ?? null, st = cellState(v, sub), filled = v !== null && v !== ''
                        return (
                          <td key={i} className="hm-c-mark" data-sub={`${sub.n || 'Subject'} (${sub.max})`} style={cell}>
                            <input className="hm-in" aria-label={`${s.name} ${sub.n}`} inputMode="decimal" enterKeyHint="next" data-r={idx} data-c={i} value={m[i] ?? ''} onChange={e => setCell(s.id, i, e.target.value)}
                              onFocus={e => { e.target.select(); setActiveRow(s.id) }} onKeyDown={e => onCellKey(e, idx, i)} placeholder="–"
                              style={{ width: 72, height: 48, boxSizing: 'border-box', textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 20, fontWeight: 800, borderRadius: 12, outline: 'none', ...markBox(st), ...(st === '' && filled ? { background: '#f0fdf4', borderColor: '#86efac', color: '#065f46' } : {}) }} />
                          </td>
                        )
                      })}
                      <td className="hm-c-sum" data-sub="Total" style={cell}>{c.absent ? <span style={{ fontWeight: 700, color: '#b45309' }}>Absent</span> : c.n ? <span style={{ display: 'inline-block', minWidth: 46, padding: '6px 10px', borderRadius: 10, background: NAVY, color: '#fff', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 17, fontWeight: 800 }}>{c.tot}</span> : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                      <td className="hm-c-sum" data-sub="Percent" style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15, fontWeight: 800, color: !c.n ? '#cbd5e1' : c.pct >= 60 ? '#047857' : c.pct >= 40 ? '#a16207' : '#b91c1c' }}>{c.n ? c.pct.toFixed(1) : '–'}</td>
                      <td className="hm-c-sum" data-sub="Rank" style={{ ...cell, fontSize: 16, fontWeight: 800, color: NAVY }}>{c.rank ? (c.rank === 1 ? '🥇 1' : c.rank === 2 ? '🥈 2' : c.rank === 3 ? '🥉 3' : c.rank) : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
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
        <Step n="📈" title="Student progress" hint="Pick a student to see their results across tests." />
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
        <Step n="★" title="Saved tests" hint={saved.length ? `${saved.length} saved · tap Open to continue or reshare` : 'Tests you save will appear here.'} />
        {!saved.length ? <div style={{ color: '#64748b', fontSize: 13, padding: '14px', border: '1.5px dashed #d3dbe7', borderRadius: 14, textAlign: 'center' }}>Nothing saved yet.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
            {saved.map(r => {
              const d = new Date(r.test_date + 'T00:00:00'), cur = r.id === test.id
              return (
                <div key={r.id} className="hm-lift" style={{ display: 'flex', gap: 12, alignItems: 'center', border: `1.5px solid ${cur ? GOLD : '#e3e9f1'}`, background: cur ? '#fffaf0' : '#fff', borderRadius: 14, padding: '10px 12px' }}>
                  <div aria-hidden="true" style={{ width: 46, flex: 'none', textAlign: 'center', borderRadius: 11, background: NAVY, color: '#fff', padding: '5px 0', lineHeight: 1.05 }}>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{isNaN(d) ? '–' : d.getDate()}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: '#E2C57E', textTransform: 'uppercase' }}>{isNaN(d) ? '' : d.toLocaleDateString('en-IN', { month: 'short' })}</div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.test_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.house} · {Object.keys(r.marks || {}).length} students{cur ? ' · open now' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    <button type="button" style={{ ...btn(!cur), padding: '7px 14px', minHeight: 38 }} onClick={() => openSaved(r)}>Open</button>
                    {canDelete && <button type="button" style={{ ...btn(false), color: '#b91c1c', padding: '7px 11px', minHeight: 38 }} onClick={() => delSaved(r)} aria-label="Delete saved test">✕</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 10, zIndex: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(11,30,61,.96)', color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 14px 30px -12px rgba(11,30,61,.7)' }}>
        <div style={{ flex: '1 1 200px', fontSize: 13 }}>
          <b>{stats.entered}/{stats.students}</b> entered{stats.bad ? <span style={{ color: '#fca5a5' }}> · {stats.bad} need fixing</span> : null}{dirty ? <span style={{ color: '#fcd34d' }}> · ● unsaved</span> : <span style={{ color: '#86efac' }}> · saved</span>}
        </div>
        <button type="button" onClick={() => exportPdf(true)} disabled={pdfBusy || !stats.entered} style={{ ...btn(false), background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}>📤 Share PDF</button>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn(false), background: 'linear-gradient(135deg,#E2C57E,#C9A24B)', color: '#0B1E3D', border: 'none', padding: '9px 22px' }}>{busy ? 'Saving…' : test.id ? '💾 Update test' : '💾 Save test'}</button>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { GRADES, gradeOf, gradeColor, medal, buildCalc, subjSig, parseMark, cellState } from './houseMarksCalc'
import HouseMarksPast from './HouseMarksPast'
import HouseMarksGroups from './HouseMarksGroups'

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
  arith50: { label: 'Arithmetic only (50) · Tests 1 to 9', subjects: [{ n: 'Arithmetic', max: 50, min: '' }] },
  arith: { label: 'Arithmetic only (25)', subjects: [{ n: 'Arithmetic', max: 25, min: 7 }] },
  single: { label: 'One subject only', subjects: [{ n: 'Subject', max: 25, min: '' }], locked: true },
  custom: { label: 'Custom subjects', subjects: [{ n: 'Marks', max: 100, min: '' }] },
}

// JNVST 2027 Arithmetic booklet: 9 chapters (50 questions each) + the full mock paper (20 Q, 25 marks)
const BOOKLET = [
  { n: 1, t: 'Fractions' }, { n: 2, t: 'Measurement: length, mass, capacity, time, money' }, { n: 3, t: 'Perimeter and area' },
  { n: 4, t: 'Simplification of numerical expressions' }, { n: 5, t: 'Number and numeric system' }, { n: 6, t: 'Four fundamental operations on whole numbers' },
  { n: 7, t: 'Factors and multiples including their properties' }, { n: 8, t: 'Types of angles and simple applications' }, { n: 9, t: 'Data analysis: bar diagram, table and pictograph' },
]
const MOCK_NAME = 'Full mock paper'
const chapterName = c => c === 'mock' ? MOCK_NAME : `Ch ${c} · ${BOOKLET[c - 1].t}`
const chapterOf = name => { const n = String(name || ''); if (n === MOCK_NAME) return 'mock'; const m = n.match(/^Ch (\d) · /); return m && BOOKLET[+m[1] - 1] ? +m[1] : '' }

// Sainik School (AISSEE Class VI) sections: Language 50, Mathematics 150, Intelligence 50, General Knowledge 50 = 300
const SAINIK = {
  lang: { t: 'Language', subjects: [{ n: 'Language', max: 50, min: '' }] },
  maths: { t: 'Mathematics', subjects: [{ n: 'Mathematics', max: 150, min: '' }] },
  intel: { t: 'Intelligence', subjects: [{ n: 'Intelligence', max: 50, min: '' }] },
  gk: { t: 'General Knowledge', subjects: [{ n: 'General Knowledge', max: 50, min: '' }] },
  full: { t: 'Full paper (300)', subjects: [{ n: 'Language', max: 50, min: '' }, { n: 'Mathematics', max: 150, min: '' }, { n: 'Intelligence', max: 50, min: '' }, { n: 'General Knowledge', max: 50, min: '' }] },
}
const sainikOf = name => { const m = String(name || '').match(/^Sainik · (.+)$/); return m ? (Object.keys(SAINIK).find(k => SAINIK[k].t === m[1]) || '') : '' }

const digits = v => String(v ?? '').replace(/\D/g, '')
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const clone = o => JSON.parse(JSON.stringify(o))
const todayStr = () => new Date().toLocaleDateString('en-CA')

// ── Remembering: unsaved work (draft) and the last test setup live in this browser ──
const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode / full */ } }
const lsDel = k => { try { localStorage.removeItem(k) } catch { /* ignore */ } }
const CLASS_ROW = '__my_class__'   // reserved list name that stores the extra students in My class
const SETUP_KEY = 'house_marks_last_setup'
const lastSetup = () => { const l = lsGet(SETUP_KEY); return l && PRESETS[l.preset] && Array.isArray(l.subjects) && l.subjects.length ? l : null }

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

function HouseMarksEntry({ students = [], allStudents = null, lockHouse = '', currentUser, openRequest = null }) {
  const canDelete = isAdminRole(currentUser?.role)
  const [test, setTest] = useState(() => { const l = lastSetup(); return { id: null, kind: 'booklet', chapter: '', name: '', group: '', date: todayStr(), preset: l?.preset || 'jnvst', subjects: clone(l?.subjects || PRESETS.jnvst.subjects) } })
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
  const fHouse = ''   // the picker no longer filters by house
  const [fClass, setFClass] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const tableRef = useRef(null)
  const [rowLimit, setRowLimit] = useState(60)   // big sheets (whole school) render in chunks so phones stay fast
  const [filt, setFilt] = useState('all')         // tile filter: all | entered | absent | low | bad
  const [showImport, setShowImport] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [openDet, setOpenDet] = useState(() => !test.name.trim())   // step 1 starts open only for a brand-new test
  const [openStu, setOpenStu] = useState(true)                       // step 2 starts as a one-line summary
  const [justSaved, setJustSaved] = useState(false)
  const nameRef = useRef(null)
  const groupRef = useRef(null)
  const [bulkCols, setBulkCols] = useState([])        // one text block per subject, one line per student (sheet order)
  const [saveAfter, setSaveAfter] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [activeRow, setActiveRow] = useState(null)
  const groupsKey = 'house_marks_groups_' + (lockHouse || 'all')
  const [groups, setGroups] = useState(() => { const g = lsGet('house_marks_groups_' + (lockHouse || 'all')); return Array.isArray(g) ? g : [] })   // [{ id, name, ids }] — manual groups / class names
  const [groupName, setGroupName] = useState('')
  const [shared, setShared] = useState(null)     // latest copy of the open shared test (all teachers' marks)
  const [classExtra, setClassExtra] = useState([])   // students any housemaster added to My class from the whole school list
  const [progId, setProgId] = useState('')           // student whose progress is shown
  const [progRows, setProgRows] = useState(null)     // null = not loaded, [] = none
  const [progErr, setProgErr] = useState('')
  const meKey = String(currentUser?.username || currentUser?.name || currentUser?.id || '')
  const draftKey = 'house_marks_draft_' + (lockHouse || 'all') + (meKey ? '_' + meKey : '')
  const [draft, setDraft] = useState(() => { const d = lsGet('house_marks_draft_' + (lockHouse || 'all')); return d && d.marks && Object.keys(d.marks).length ? d : null })

  const school = useMemo(() => (allStudents || students || [])
    .filter(s => s.status !== 'Inactive' && s.status !== 'Dropout')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [allStudents, students])
  // My class = exactly the students this teacher added (saved under their login). Nothing is added automatically.
  const pool = useMemo(() => school.filter(x => classExtra.includes(x.id)), [school, classExtra])
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
  const addStudents = ids => { setMyClass([...new Set([...classExtra, ...ids])]); setDirty(true) }
  const unpickStudent = id => { setMyClass(classExtra.filter(x => x !== id)); setMarks(m => { const c = { ...m }; delete c[id]; return c }); setDirty(true) }
  const clearStudents = () => { if (roster.length > 1 && !window.confirm(`Remove all ${roster.length} students from My class?`)) return; setMyClass([]); setMarks({}); setDirty(true) }
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
    setTest({ group: '', kind: 'other', chapter: '', ...draft.test }); setMarks(draft.marks || {}); setMode('all'); setPicked([]); if (draft.picked && draft.picked.length) setMyClass([...new Set([...classExtra, ...draft.picked])]); setDirty(true); setDraft(null)
    flash('ok', 'Your unsaved marks are back.')
  }
  // Saved student lists live in the database (house_test_groups) so they follow the
  // housemaster to any phone or computer. If the table is not created yet, they fall back
  // to this computer only.
  const gHouse = lockHouse || 'All'
  const [groupsDb, setGroupsDb] = useState(null)   // null = unknown, true = database, false = this computer only
  // Every housemaster keeps their own lists: they are stored under the logged-in user (owner).
  const classKey = 'house_marks_class_' + gHouse + '_' + String(currentUser?.username || currentUser?.name || currentUser?.id || '')
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
    const mine = rows.find(r => r.name === CLASS_ROW)
    setClassExtra(mine ? (Array.isArray(mine.student_ids) ? mine.student_ids : []) : (lsGet(classKey) || []))
    setGroups(rows.filter(r => r.name !== CLASS_ROW).map(r => ({ id: r.id, name: r.name, ids: Array.isArray(r.student_ids) ? r.student_ids : [] })))
  }, [gHouse, me])
  useEffect(() => { loadGroups() }, [loadGroups])
  const saveAsGroup = async () => {
    const name = groupName.trim()
    if (!name) { flash('err', 'Type a name for your group first, e.g. “Class VI Navodaya”.'); return }
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
    setTest(t => t.group.trim() ? t : { ...t, group: name })
    setGroupName(''); await loadGroups(); flash(overlap.size ? 'err' : 'ok', `List “${name}” saved with ${ids.length} student${ids.length === 1 ? '' : 's'}.${overlap.size ? ` ⚠ ${overlap.size} of them are also in another list — see “Check groups”.` : ''}`)
  }
  const useGroup = g => {
    const live = new Set(school.map(x => x.id))
    const ids = g.ids.filter(id => live.has(id))
    setMyClass(ids); setMode('all'); setDirty(true)
    setTest(t => ({ ...t, group: g.name, name: t.name.trim() ? t.name : g.name + ' – ' }))
    flash('ok', `My class is now “${g.name}”: ${ids.length} student${ids.length === 1 ? '' : 's'}${ids.length < g.ids.length ? ` (${g.ids.length - ids.length} no longer active)` : ''}.`)
  }
  const delGroup = async g => {
    if (!window.confirm(`Delete the list “${g.name}”? The students themselves are not affected.`)) return
    if (groupsDb) { const { error } = await supabase.from('house_test_groups').delete().eq('id', g.id); if (error) { flash('err', 'Could not delete: ' + error.message); return }; await loadGroups() }
    else { const next = groups.filter(x => x.id !== g.id); setGroups(next); lsSet(groupsKey, next) }
  }
  // ── add students from the school list to My class or to one of my groups ──
  const upsertRow = async (name, ids) => supabase.from('house_test_groups').upsert({ owner: me, house: gHouse, name, student_ids: ids, created_by: me || null, updated_at: new Date().toISOString() }, { onConflict: 'owner,name' })
  const setMyClass = async ids => {
    setClassExtra(ids); lsSet(classKey, ids)
    const { error } = await upsertRow(CLASS_ROW, ids)
    if (error) flash('err', 'Saved on this computer only: run supabase/RUN_house_test_marks.sql so My class follows you to other devices.')
  }
  const addToClass = id => {
    if (!classExtra.includes(id)) setMyClass([...classExtra, id])
    if (mode === 'selected') addStudents([id])
    flash('ok', 'Added to My class.')
  }
  const removeFromClass = id => { setMyClass(classExtra.filter(x => x !== id)); if (mode === 'selected') setPicked(p => p.filter(x => x !== id)); flash('ok', 'Removed from My class.') }
  const addToGroup = async (g, ids) => {
    const next = [...new Set([...g.ids, ...ids])]
    if (groupsDb) { const { error } = await supabase.from('house_test_groups').update({ student_ids: next, updated_at: new Date().toISOString() }).eq('id', g.id); if (error) { flash('err', 'Could not update the group: ' + error.message); return } }
    const upd = groups.map(x => x.id === g.id ? { ...x, ids: next } : x)
    setGroups(upd); if (!groupsDb) lsSet(groupsKey, upd)
    flash('ok', `Added to group “${g.name}” (${next.length} students).`)
  }
  const addToNewGroup = async ids => {
    const name = (window.prompt('Name for the new group, e.g. Class VI Navodaya') || '').trim()
    if (!name || name === CLASS_ROW) return
    const exist = groups.find(g => g.name.toLowerCase() === name.toLowerCase())
    if (exist) { addToGroup(exist, ids); return }
    const { error } = await upsertRow(name, ids)
    if (error) { const next = [...groups, { id: Date.now(), name, ids }]; setGroups(next); lsSet(groupsKey, next); setGroupsDb(false); flash('err', 'Group saved on this computer only.'); return }
    await loadGroups(); flash('ok', `Group “${name}” created with ${ids.length} student${ids.length === 1 ? '' : 's'}.`)
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
    let q = supabase.from('house_test_marks').select('id,test_name,test_date,house,subjects,marks,updated_at,created_by').order('test_date', { ascending: false }).limit(100)
    const { data, error } = await q   // every teacher sees every test: one shared test, everyone enters their own students
    if (error) { setSaved([]); if (/house_test_marks/i.test(error.message || '')) flash('err', 'Saving is not set up yet: run supabase/RUN_house_test_marks.sql once in Supabase.'); return }
    setSaved(data || [])
  }, [lockHouse])
  useEffect(() => { loadSaved() }, [loadSaved])

  const maxTotal = test.subjects.reduce((a, s) => a + Number(s.max || 0), 0)

  // ── computed per student ──
  const calc = useMemo(() => buildCalc(roster.map(s => ({ id: s.id, m: marks[s.id] || [] })), test.subjects, maxTotal), [roster, marks, test.subjects, maxTotal])

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
      partial: vals.filter(c => c.partial).length,
      absent: vals.filter(c => c.absent).length,
      avg: tots.length ? tots.reduce((a, b) => a + b, 0) / tots.length : null,
      high: tots.length ? Math.max(...tots) : null,
    }
  }, [calc, roster])

  // ── Analyser: toppers and averages by saved list / class / house, plus subject-wise ──
  const [anOnce, setAnOnce] = useState(false)
  const analysis = useMemo(() => {
    const byTot = (a, b) => calc[b.id].tot - calc[a.id].tot || String(a.name).localeCompare(String(b.name))
    const mk = (label, members) => {
      if (!members.length) return null
      const r = members.filter(x => calc[x.id]?.rank).sort(byTot)
      const topTot = r.length ? calc[r[0].id].tot : null
      return {
        label, total: members.length, ranked: r.length, topTot,
        toppers: r.filter(x => calc[x.id].tot === topTot),
        top3: r.slice(0, 3),
        avgPct: r.length ? r.reduce((a, x) => a + calc[x.id].pct, 0) / r.length : null,
        passPct: r.length ? r.filter(x => calc[x.id].pass).length / r.length * 100 : null,
      }
    }
    const by = f => { const m = new Map(); roster.forEach(x => { const k = f(x); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(x) } }); return [...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([k, v]) => mk(String(k), v)) }
    const subjects = test.subjects.map((sub, i) => {
      const vals = roster.map(x => ({ x, v: (marks[x.id] || [])[i] })).filter(o => typeof o.v === 'number' && cellState(o.v, sub) !== 'err')
      if (!vals.length) return { n: sub.n, max: sub.max, count: 0 }
      const hi = Math.max(...vals.map(o => o.v)), lo = Math.min(...vals.map(o => o.v))
      const minV = sub.min === '' || sub.min == null ? null : Number(sub.min)
      return { n: sub.n, max: sub.max, count: vals.length, avg: vals.reduce((a, o) => a + o.v, 0) / vals.length, hi, lo,
        hiNames: vals.filter(o => o.v === hi).map(o => o.x.name), passPct: minV == null ? null : vals.filter(o => o.v >= minV).length / vals.length * 100 }
    })
    const gradeCount = {}; Object.values(calc).forEach(c => { if (c.rank) gradeCount[c.grade] = (gradeCount[c.grade] || 0) + 1 })
    const seen = new Set()
    const lists = groups.map(g => { const mem = roster.filter(x => g.ids.includes(x.id) && !(anOnce && seen.has(x.id))); if (anOnce) mem.forEach(x => seen.add(x.id)); return mk(g.name, mem) }).filter(Boolean)
    return { lists, classes: by(x => x.class_name), houses: by(x => x.house), overall: mk('Overall', roster), subjects, gradeCount }
  }, [calc, roster, marks, test.subjects, groups, anOnce])
  const [anTab, setAnTab] = useState('lists')

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
  // One tap: "Test 1" … "Test 9", Arithmetic out of 50.
  // Test templates (name + subjects) are kept in the database for every teacher to reuse.
  const [templates, setTemplates] = useState(() => { const l = lsGet('house_marks_templates'); return Array.isArray(l) ? l : [] })
  const [tplDb, setTplDb] = useState(null)
  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase.from('house_test_templates').select('id,name,subjects,created_by').order('name')
    if (error) { setTplDb(false); return }
    setTplDb(true); setTemplates((data || []).filter(t => Array.isArray(t.subjects) && t.subjects.length)); lsSet('house_marks_templates', data || [])
  }, [])
  useEffect(() => { loadTemplates() }, [loadTemplates])
  const saveTemplate = async () => {
    const name = test.name.trim()
    if (!name) { setOpenDet(true); flash('err', 'Type the test name first, then save it as a template.'); setTimeout(() => nameRef.current?.focus(), 80); return }
    if (!test.subjects.length) { flash('err', 'Add at least one subject first.'); return }
    const row = { name, subjects: test.subjects, created_by: meKey || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('house_test_templates').upsert(row, { onConflict: 'name' })
    if (error) {
      const next = [...templates.filter(t => t.name.toLowerCase() !== name.toLowerCase()), { id: 'l' + Date.now(), ...row }].sort((a, b) => a.name.localeCompare(b.name))
      setTemplates(next); lsSet('house_marks_templates', next); setTplDb(false)
      flash('err', 'Template saved on this computer only. Run supabase/RUN_house_test_marks.sql so every teacher can use it.'); return
    }
    await loadTemplates(); flash('ok', `Template “${name}” saved for all teachers.`)
  }
  const useTemplate = t => {
    if (dirty && Object.keys(marks).length && !window.confirm('Switch to this template? Marks you typed for the current sheet will be cleared.')) return
    setTest(x => ({ ...x, id: null, kind: 'other', chapter: '', name: t.name, preset: t.subjects.length === 1 ? 'single' : 'custom', subjects: clone(t.subjects) }))
    setMarks({}); setDirty(true); setTestOwner(null); setShared(null)
  }
  const delTemplate = async t => {
    if (!window.confirm(`Delete the template “${t.name}”? Saved tests are not affected.`)) return
    if (tplDb) { const { error } = await supabase.from('house_test_templates').delete().eq('id', t.id); if (error) { flash('err', 'Could not delete: ' + error.message); return }; await loadTemplates() }
    else { const next = templates.filter(x => x.id !== t.id); setTemplates(next); lsSet('house_marks_templates', next) }
  }
  const chooseChapter = c => {
    if (test.chapter === c) return
    if (dirty && Object.keys(marks).length && !window.confirm('Switch chapter? Marks you typed for the current sheet will be cleared.')) return
    const mock = c === 'mock'
    setTest(t => ({ ...t, id: null, kind: 'booklet', chapter: c, name: chapterName(c), preset: mock ? 'arith' : 'arith50', subjects: clone((mock ? PRESETS.arith : PRESETS.arith50).subjects) }))
    setMarks({}); setDirty(true); setTestOwner(null); setShared(null)
  }
  const chooseSection = k => {
    if (test.chapter === k) return
    if (dirty && Object.keys(marks).length && !window.confirm('Switch section? Marks you typed for the current sheet will be cleared.')) return
    setTest(t => ({ ...t, id: null, kind: 'sainik', chapter: k, name: 'Sainik · ' + SAINIK[k].t, preset: 'custom', subjects: clone(SAINIK[k].subjects) }))
    setMarks({}); setDirty(true); setTestOwner(null); setShared(null)
  }
  const setKind = k => {
    if (test.kind === k) return
    if (dirty && Object.keys(marks).length && !window.confirm('Change the test type? Marks you typed for the current sheet will be cleared.')) return
    setTest(t => ({ ...t, id: null, kind: k, chapter: '', name: '' }))
    setMarks({}); setDirty(true); setTestOwner(null); setShared(null)
  }
  const needChapter = () => {
    if ((test.kind !== 'booklet' && test.kind !== 'sainik') || test.chapter) return false
    setOpenDet(true); flash('err', test.kind === 'sainik' ? 'Choose the Sainik section first (Language, Mathematics, Intelligence, General Knowledge or Full paper).' : 'Choose the chapter first. Tap one chapter of the booklet (or Full mock paper).')
    setTimeout(() => { chapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 80)
    return true
  }
  const quickTest = n => {
    if (dirty && Object.keys(marks).length && !window.confirm('Switch to this test? Marks you typed for the current sheet will be cleared.')) return
    setTest(t => ({ ...t, id: null, kind: 'other', chapter: '', name: `Test ${n}`, preset: 'arith50', subjects: clone(PRESETS.arith50.subjects) }))
    setMarks({}); setDirty(true); setTestOwner(null); setShared(null)
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
  const headRow = () => ['Rank', 'GCC No', 'Name', 'Class', ...test.subjects.map(s => s.n), 'Total', 'Percent', 'Grade', 'Percentile', 'Remark']
  const bodyRows = () => sortedForExport().map(s => {
    const c = calc[s.id], m = marks[s.id] || []
    return [c.rank || '', s.gcc_no || '', s.name || '', s.class_name || '', ...test.subjects.map((_, i) => m[i] ?? ''), c.n ? c.tot : '', c.n ? c.pct.toFixed(1) : '', c.rank ? c.grade : '', c.rank ? c.percentile.toFixed(0) : '', c.absent ? 'Absent' : c.bad ? 'Check marks' : c.partial ? 'Incomplete' : c.low ? 'Below minimum' : '']
  })
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
  const baseName = () => ((test.name || 'house-test') + (test.group ? '-' + test.group : '')).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const exportCsv = () => {
    const top = [['Test', test.name], ['Teacher', currentUser?.name || meKey || ''], ['Date', test.date], ['Maximum total', maxTotal], []].map(r => r.map(csvCell).join(','))
    const csv = [...top, headRow().map(csvCell).join(','), ...bodyRows().map(r => r.map(csvCell).join(','))].join('\n')
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), baseName() + '.csv')
  }
  const exportXlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Test', test.name], ['Teacher', currentUser?.name || meKey || ''], ['Date', test.date], ['Maximum total', maxTotal], [], headRow(), ...bodyRows()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Results'); XLSX.writeFile(wb, baseName() + '.xlsx')
  }
  // ── PDF result sheet: school letterhead, ranked table, ready to share ──
  const exportPdf = async (share) => {
    if (!roster.length || !stats.entered) { flash('err', 'Enter some marks first.'); return }
    if (needChapter() || needGroup()) return
    setPdfBusy(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, { pdfLetterhead, pdfFooters }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./reportKit')])
      const landscape = test.subjects.length > 4
      const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const mx = 12, W = doc.internal.pageSize.getWidth()
      let y = pdfLetterhead(doc, { title: 'Test Result' + (test.name ? ' – ' + test.name : ''), margin: mx, date: test.date ? new Date(test.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105)
      const info = [test.group ? `Group: ${test.group}` : null, `Students: ${roster.length}`, `Maximum: ${maxTotal}`, stats.avg == null ? null : `Average: ${stats.avg.toFixed(1)}`, stats.high == null ? null : `Highest: ${stats.high}`, stats.absent ? `Absent: ${stats.absent}` : null].filter(Boolean).join('   ·   ')
      doc.text(info, mx, y); y += 4
      const sorted = sortedForExport()
      const body = sorted.map(st => {
        const c = calc[st.id], m = marks[st.id] || []
        return [c.rank || '–', st.name || '', st.gcc_no || '', st.class_name || '', ...test.subjects.map((_, i) => m[i] ?? '–'), c.absent ? 'AB' : c.n ? c.tot : '–', c.n ? c.pct.toFixed(1) + '%' + (c.rank ? ' · ' + c.grade : '') : '–', c.absent ? 'Absent' : c.bad ? 'Check marks' : c.partial ? 'Incomplete' : c.low ? 'Below minimum' : '']
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
      let endY = doc.lastAutoTable?.finalY || y
      const tops = [...analysis.lists.map(g => ['List', g]), ...analysis.classes.map(g => ['Class', g]), ].filter(([, g]) => g.ranked)
      if (tops.length) {
        autoTable(doc, {
          startY: endY + 10,
          head: [['Group', 'Topper', 'Score', 'Students', 'Avg %', 'Pass %', '2nd & 3rd']],
          body: tops.map(([k, g]) => [`${k}: ${g.label}`, g.toppers.map(x => x.name).join(', '), `${g.topTot}/${maxTotal} (${(g.topTot / (maxTotal || 1) * 100).toFixed(1)}%)`, `${g.ranked}/${g.total}`, g.avgPct == null ? '–' : g.avgPct.toFixed(1), g.passPct == null ? '–' : g.passPct.toFixed(0), g.top3.filter(x => !g.toppers.includes(x)).map(x => `${x.name} (${calc[x.id].tot})`).join(', ') || '–']),
          margin: { left: mx, right: mx, bottom: 16 },
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
          headStyles: { fillColor: [201, 162, 75], textColor: [11, 30, 61], fontStyle: 'bold' },
          columnStyles: { 0: { fontStyle: 'bold' }, 1: { fontStyle: 'bold' } },
          didDrawPage: undefined,
        })
        endY = doc.lastAutoTable?.finalY || endY
      }
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
  const combined = useMemo(() => {
    if (!shared || shared.id !== test.id) return null
    const subs = shared.subjects || test.subjects
    const mx = subs.reduce((a, x) => a + Number(x.max || 0), 0)
    const entries = Object.entries(shared.marks || {})
    const cc = buildCalc(entries.map(([id, e]) => ({ id, m: e.m || [] })), subs, mx)
    const rows = entries.map(([id, e]) => { const st = school.find(x => x.id === id) || {}; return { id, name: st.name || e.name || 'Student', gcc: st.gcc_no || e.gcc || '', cls: st.class_name || '', teacher: e.byName || e.by || 'Teacher', c: cc[id], m: e.m || [] } })
    const ranked = rows.filter(r => r.c && r.c.rank).sort((a, b) => a.c.rank - b.c.rank || String(a.name).localeCompare(String(b.name)))
    const rest = rows.filter(r => !(r.c && r.c.rank)).sort((a, b) => String(a.name).localeCompare(String(b.name)))
    const tm = new Map(); rows.forEach(r => { if (!tm.has(r.teacher)) tm.set(r.teacher, []); tm.get(r.teacher).push(r) })
    const teachers = [...tm].map(([name, list]) => { const rk = list.filter(r => r.c && r.c.rank).sort((a, b) => a.c.rank - b.c.rank); return { name, count: list.length, ranked: rk.length, avg: rk.length ? rk.reduce((a, r) => a + r.c.pct, 0) / rk.length : null, top: rk[0] || null } }).sort((a, b) => a.name.localeCompare(b.name))
    return { subs, mx, rows, ranked, rest, teachers, avg: ranked.length ? ranked.reduce((a, r) => a + r.c.pct, 0) / ranked.length : null }
  }, [shared, test.id, test.subjects, school])
  const deliverPdf = async (doc, fname, share, title) => {
    const blob = doc.output('blob'), file = new File([blob], fname, { type: 'application/pdf' })
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: title }); flash('ok', 'Shared.') }
      catch (e) { if (e?.name !== 'AbortError') { download(blob, fname); flash('ok', 'Could not open sharing, so the PDF was downloaded instead.') } }
    } else { download(blob, fname); flash('ok', share ? 'Sharing is not available on this device, so the PDF was downloaded.' : 'PDF downloaded.') }
  }
  const exportCombinedPdf = async share => {
    if (!combined || !combined.rows.length) { flash('err', 'Nothing saved in this test yet.'); return }
    setPdfBusy(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, { pdfLetterhead, pdfFooters }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./reportKit')])
      const landscape = combined.subs.length > 3
      const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const mx = 12
      let y = pdfLetterhead(doc, { title: 'Combined Test Result – ' + (test.name || ''), margin: mx, date: test.date ? new Date(test.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105)
      doc.text([`Students: ${combined.rows.length}`, `Teachers: ${combined.teachers.length}`, `Maximum: ${combined.mx}`, combined.avg == null ? null : `Average: ${combined.avg.toFixed(1)}%`].filter(Boolean).join('   ·   '), mx, y); y += 4
      const all = [...combined.ranked, ...combined.rest]
      autoTable(doc, {
        startY: y,
        head: [['Rank', 'Student', 'GCC', 'Class', 'Teacher', ...combined.subs.map(x => `${x.n}\n/${x.max}`), 'Total\n/' + combined.mx, '%', 'Grade']],
        body: all.map(r => [r.c && r.c.rank ? r.c.rank : '–', r.name, r.gcc, r.cls, r.teacher, ...combined.subs.map((_, i) => r.m[i] ?? '–'), r.c && r.c.absent ? 'AB' : r.c && r.c.n ? r.c.tot : '–', r.c && r.c.n ? r.c.pct.toFixed(1) + '%' : '–', r.c && r.c.rank ? r.c.grade : (r.c && r.c.partial ? 'Incomplete' : '')]),
        margin: { left: mx, right: mx, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [11, 30, 61], textColor: 255, halign: 'center', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { halign: 'center', fontStyle: 'bold', cellWidth: 11 }, 1: { fontStyle: 'bold' } },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 0 && Number(d.cell.raw) >= 1 && Number(d.cell.raw) <= 3) d.cell.styles.fillColor = [[226, 197, 126], [226, 232, 240], [231, 200, 160]][Number(d.cell.raw) - 1] },
      })
      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || y) + 8,
        head: [['Teacher', 'Students', 'Average %', 'Topper']],
        body: combined.teachers.map(t => [t.name, `${t.ranked}/${t.count}`, t.avg == null ? '–' : t.avg.toFixed(1), t.top ? `${t.top.name} (${t.top.c.tot}/${combined.mx})` : '–']),
        margin: { left: mx, right: mx, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [201, 162, 75], textColor: [11, 30, 61], fontStyle: 'bold' },
      })
      pdfFooters(doc, { margin: mx })
      await deliverPdf(doc, (baseName() + '-combined.pdf'), share, (test.name || 'Test') + ' – combined result')
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
  const bulkShort = bulkCols.map((c, j) => ({ n: test.subjects[j]?.n || 'Subject', k: bulkLines(j).filter(x => x.trim() !== '').length })).filter(x => x.k > 0 && x.k < roster.length)
  const bulkExtra = Math.max(0, ...bulkCols.map((c, j) => bulkLines(j).filter(x => x.trim() !== '').length - roster.length))
  const applyBulk = (thenSave) => {
    const next = { ...marks }
    roster.forEach((s, i) => { next[s.id] = test.subjects.map((_, j) => parseMark((bulkLines(j)[i] ?? '').trim())) })
    setMarks(next); setDirty(true); setBulkOpen(false)
    if (thenSave) setSaveAfter(true)
    else flash('ok', `Marks applied to ${roster.length} students. Check the sheet, then save.`)
  }
  const chapRef = useRef(null)
  const fixedKind = test.kind === 'booklet' || test.kind === 'sainik'
  const needGroup = () => {
    if (test.group.trim()) return false
    setOpenDet(true); flash('err', 'Name of the group is compulsory. Type it (or pick one of your groups).')
    setTimeout(() => { groupRef.current?.focus(); groupRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 80)
    return true
  }
  const save = async () => {
    if (needChapter()) return
    if (!test.name.trim()) { setOpenDet(true); flash('err', 'Give the test a name first.'); setTimeout(() => { nameRef.current?.focus(); nameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 80); return }
    if (needGroup()) return
    if (stats.bad) { flash('err', `Fix ${stats.bad} red cell(s) first.`); return }
    const mine = {}
    roster.forEach(s => {
      const m = marks[s.id] || test.subjects.map(() => null)
      if (mode === 'all' && m.every(v => v === null || v === undefined)) return
      mine[s.id] = { gcc: s.gcc_no || '', name: s.name || '', m, by: meKey, byName: currentUser?.name || meKey, group: test.group.trim() }
    })
    if (!Object.keys(mine).length) { flash('err', mode === 'selected' ? 'Add at least one student first.' : 'No marks entered yet.'); return }
    if (!Object.values(mine).some(v => v.m.some(x => x !== null && x !== undefined))) { flash('err', 'No marks entered yet.'); return }
    if (stats.partial && !window.confirm(`${stats.partial} student${stats.partial === 1 ? ' has' : 's have'} some marks missing and will not be ranked yet. Save anyway?`)) return
    setBusy(true)
    let rowId = test.id, merged = mine
    if (!rowId) {
      const row = { test_name: test.name.trim(), test_date: test.date || todayStr(), house: lockHouse || 'All', subjects: test.subjects, marks: mine, created_by: meKey || null, updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('house_test_marks').insert(row).select('id,updated_at').single()
      if (error) { setBusy(false); flash('err', /house_test_marks/i.test(error.message || '') && /exist|schema/i.test(error.message || '') ? 'Table missing: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Save failed: ' + error.message); return }
      rowId = data.id; setTestOwner(meKey || null)
    } else {
      // Shared test: only this teacher's students are written; everyone else's marks are kept exactly as they are.
      const r = await mergeSave(mine)
      if (r.error) { setBusy(false); flash('err', r.error.code === 'subjects' ? 'Not saved: the subjects of this shared test were changed by another teacher. Open it again from Saved tests.' : 'Save failed: ' + r.error.message); return }
      merged = r.merged
    }
    setBusy(false)
    setTest(t => ({ ...t, id: rowId })); setDirty(false); setJustSaved(true); lsDel(draftKey); loadSaved(); loadShared(rowId)
    // Progress records for every student in the shared test, ranked across all teachers.
    const cc = buildCalc(Object.entries(merged).map(([id, e]) => ({ id, m: e.m || [] })), test.subjects, maxTotal)
    const rankedPcts = Object.values(cc).filter(c => c.rank).map(c => c.pct)
    const classAvg = rankedPcts.length ? rankedPcts.reduce((a, b) => a + b, 0) / rankedPcts.length : null
    const byId = {}; school.forEach(x => { byId[x.id] = x })
    const results = Object.entries(merged).filter(([id]) => cc[id] && (cc[id].n > 0 || cc[id].absent)).map(([id, e]) => {
      const c = cc[id], st = byId[id] || {}
      return { test_id: rowId, student_id: String(id), gcc_no: (st.gcc_no || e.gcc) ? String(st.gcc_no || e.gcc) : null, student_name: st.name || e.name || null, class_name: st.class_name || null, group_name: e.group || test.group || null,
        house: st.house || lockHouse || 'All', test_name: test.name.trim(), test_date: test.date || todayStr(), subjects: test.subjects, marks: e.m,
        total: c.n ? c.tot : null, max_total: maxTotal, percent: c.n ? Math.round(c.pct * 10) / 10 : null, rank: c.rank || null, ranked_of: rankedPcts.length || null,
        class_avg_pct: classAvg == null ? null : Math.round(classAvg * 10) / 10, absent: !!c.absent, updated_at: new Date().toISOString() }
    })
    const ins = results.length ? await supabase.from('house_test_results').upsert(results, { onConflict: 'test_id,student_id' }) : { error: null }
    if (!ins.error) {
      const keep = Object.keys(merged).map(k => `"${String(k).replace(/"/g, '')}"`).join(',')
      await supabase.from('house_test_results').delete().eq('test_id', rowId).not('student_id', 'in', `(${keep})`)
    }
    if (ins.error) flash('err', /house_test_results/i.test(ins.error.message || '') ? 'Marks saved, but progress records are not set up: run the new part of supabase/RUN_house_test_marks.sql once in Supabase.' : 'Marks saved, but progress records failed: ' + ins.error.message)
    else flash('ok', `Saved ${Object.keys(mine).length} of your students. The shared test now has ${Object.keys(merged).length} students.`)
  }
  const mergeSave = async mine => {
    const touched = roster.map(x => x.id)
    const canRename = !testOwner || testOwner === meKey
    for (let k = 0; k < 4; k++) {
      const cur = await supabase.from('house_test_marks').select('id,subjects,marks,updated_at').eq('id', test.id).single()
      if (cur.error || !cur.data) return { error: cur.error || { message: 'This test no longer exists.' } }
      if (subjSig(cur.data.subjects) !== subjSig(test.subjects)) return { error: { code: 'subjects', message: 'subjects changed' } }
      const merged = { ...(cur.data.marks || {}) }
      touched.forEach(id => { const e = merged[id]; if (!mine[id] && e && (!e.by || e.by === meKey)) delete merged[id] })
      Object.assign(merged, mine)
      const upd = { marks: merged, updated_at: new Date().toISOString(), ...(canRename ? { test_name: test.name.trim(), test_date: test.date || todayStr() } : {}) }
      const r = await supabase.from('house_test_marks').update(upd).eq('id', test.id).eq('updated_at', cur.data.updated_at).select('id,updated_at')
      if (r.error) return { error: r.error }
      if (r.data && r.data[0]) return { merged, data: r.data[0] }
    }
    return { error: { message: 'Several teachers are saving at the same moment. Tap Save again.' } }
  }
  // The whole shared test (every teacher's students), used for the combined ranking and PDF.
  const loadShared = useCallback(async id => {
    if (!id) { setShared(null); return }
    const { data, error } = await supabase.from('house_test_marks').select('id,test_name,test_date,subjects,marks,updated_at').eq('id', id).single()
    if (!error && data) setShared({ ...data })
  }, [])
  const [testOwner, setTestOwner] = useState(null)
  const openSaved = r => {
    const byId = {}; school.forEach(s => { byId[s.id] = s })
    setTestOwner(r.created_by || null); loadShared(r.id)
    const subs = r.subjects || clone(PRESETS.jnvst.subjects)
    setTest({ id: r.id, kind: chapterOf(r.test_name) ? 'booklet' : sainikOf(r.test_name) ? 'sainik' : 'other', chapter: chapterOf(r.test_name) || sainikOf(r.test_name), group: '', name: r.test_name, date: r.test_date, preset: subs.length === 1 ? 'single' : 'custom', subjects: subs })
    // Shared test: this teacher sees and edits only their own students; everyone else's marks stay untouched in the database.
    const ent = r.marks || {}
    const mineIds = Object.keys(ent).filter(id => byId[id] && (ent[id].by === meKey || (!ent[id].by && pool.some(x => x.id === id))))
    const mk = {}; mineIds.forEach(id => { mk[id] = ent[id].m })
    const myGroup = mineIds.map(id => ent[id].group).find(Boolean)
    if (myGroup) setTest(t => t.id === r.id && !t.group ? { ...t, group: myGroup } : t)
    else supabase.from('house_test_results').select('group_name').eq('test_id', r.id).limit(1).then(({ data }) => { const gname = data && data[0] && data[0].group_name; if (gname) setTest(t => t.id === r.id && !t.group ? { ...t, group: gname } : t) }, () => {})
    const missing = mineIds.filter(id => !classExtra.includes(id))
    if (missing.length) setMyClass([...classExtra, ...missing])
    setMode('all'); setPicked([])
    setMarks(mk); setDirty(false); window.scrollTo({ top: 0, behavior: 'smooth' })
    const others = Object.keys(ent).filter(id => !mineIds.includes(id)).length
    if (others) flash('ok', `Shared test opened. ${others} student${others === 1 ? '' : 's'} entered by other teachers ${others === 1 ? 'is' : 'are'} kept safe. Enter marks for yours and save.`)
  }
  // A test chosen in the Past results view is opened here so any housemaster can continue it.
  useEffect(() => { if (openRequest && openRequest.row) openSaved(openRequest.row) }, [openRequest])  // eslint-disable-line react-hooks/exhaustive-deps
  const delSaved = async r => {
    if (!window.confirm(`Delete saved test "${r.test_name}"?`)) return
    const { error } = await supabase.from('house_test_marks').delete().eq('id', r.id)
    if (error) { flash('err', 'Delete failed: ' + error.message); return }
    if (test.id === r.id) setTest(t => ({ ...t, id: null }))
    loadSaved()
  }
  const newTest = () => {
    if (dirty && !window.confirm('Discard unsaved marks and start a new test?')) return
    setTestOwner(null); setShared(null)
    const l = lastSetup(); setTest({ id: null, kind: 'booklet', chapter: '', name: '', group: '', date: todayStr(), preset: l?.preset || 'jnvst', subjects: clone(l?.subjects || PRESETS.jnvst.subjects) }); setMarks({}); setMode('all'); setPicked([]); setDirty(false); lsDel(draftKey); setDraft(null)
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
    else if (r >= rowLimit && r < shown.length) { setRowLimit(r + 30); setTimeout(() => focusCell(r, c), 80); return true }
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
  useEffect(() => { setRowLimit(60) }, [search, filt, roster.length])
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
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#E2C57E' }}>🎓 My class · Test marks</div>
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
        <Step n={1} title="Test details" hint="Choose the booklet chapter (compulsory) and the group name, then set the date." open={openDet} onToggle={() => setOpenDet(v => !v)}
          summary={`${test.name.trim() || 'Untitled test'} · ${test.group.trim() || '⚠ group name missing'} · ${test.date} · ${test.subjects.map(x => `${x.n} ${x.max}`).join(' + ')}`} />
        {openDet && <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 2 }}>Test type:</span>
          {[['booklet', '📘 Navodaya booklet chapter'], ['sainik', '🪖 Sainik section'], ['other', '📝 Any subject']].map(([k, l]) => {
            const on = (test.kind || 'other') === k
            return <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={on} style={{ minHeight: 38, padding: '4px 14px', borderRadius: 10, border: `1.5px solid ${on ? NAVY : '#d3dbe7'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : NAVY, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          })}
        </div>
        {test.kind === 'sainik' && (
          <div ref={chapRef} style={{ border: `1.5px solid ${test.chapter ? '#a7f3d0' : '#f59e0b'}`, background: test.chapter ? '#f0fdf4' : '#fffbeb', borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Choose the Sainik section <span style={{ color: '#dc2626' }}>*</span> <span style={{ fontWeight: 600, color: '#64748b' }}>· you can still add any other subject below</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 6 }}>
              {Object.entries(SAINIK).map(([k, v]) => {
                const on = test.chapter === k
                return <button key={k} type="button" onClick={() => chooseSection(k)} aria-pressed={on} style={{ textAlign: 'left', minHeight: 44, padding: '6px 10px', borderRadius: 10, border: `1.5px solid ${on ? NAVY : '#d3dbe7'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.25 }}>{v.t}{k !== 'full' ? <span style={{ color: on ? '#E2C57E' : GOLD }}> · {v.subjects[0].max}</span> : null}</button>
              })}
            </div>
            {test.chapter && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#047857' }}>✓ Test: {test.name}</div>}
          </div>
        )}
        {test.kind === 'booklet' && (
          <div ref={chapRef} style={{ border: `1.5px solid ${test.chapter ? '#a7f3d0' : '#f59e0b'}`, background: test.chapter ? '#f0fdf4' : '#fffbeb', borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Choose the chapter <span style={{ color: '#dc2626' }}>*</span> <span style={{ fontWeight: 600, color: '#64748b' }}>· JNVST 2027 Arithmetic Booklet · each chapter is out of 50</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 6 }}>
              {BOOKLET.map(c => {
                const on = test.chapter === c.n
                return <button key={c.n} type="button" onClick={() => chooseChapter(c.n)} aria-pressed={on} style={{ textAlign: 'left', minHeight: 44, padding: '6px 10px', borderRadius: 10, border: `1.5px solid ${on ? NAVY : '#d3dbe7'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.25 }}><b style={{ color: on ? '#E2C57E' : GOLD }}>Ch {c.n}</b> · {c.t}</button>
              })}
              <button type="button" onClick={() => chooseChapter('mock')} aria-pressed={test.chapter === 'mock'} style={{ textAlign: 'left', minHeight: 44, padding: '6px 10px', borderRadius: 10, border: `1.5px solid ${test.chapter === 'mock' ? NAVY : GOLD}`, background: test.chapter === 'mock' ? NAVY : '#fffaf0', color: test.chapter === 'mock' ? '#fff' : NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.25 }}><b style={{ color: test.chapter === 'mock' ? '#E2C57E' : GOLD }}>Day 10</b> · Full mock paper (25 marks, pass 7)</button>
            </div>
            {test.chapter && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#047857' }}>✓ Test: {test.name}</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {!fixedKind && <label style={{ ...lab, flex: '2 1 220px' }}>Test name<input ref={nameRef} style={inp} value={test.name} placeholder="e.g. Weekly Test 7 – JNVST" onChange={e => { setTest(t => ({ ...t, name: e.target.value })); setDirty(true) }} /></label>}
          <label style={{ ...lab, flex: '1 1 200px' }}>Name of the group <span style={{ color: '#dc2626' }}>*</span>
            <input ref={groupRef} list="hm-group-names" style={{ ...inp, borderColor: test.group.trim() ? undefined : '#f59e0b' }} value={test.group} placeholder="e.g. Class VI Navodaya" required aria-required="true" onChange={e => { setTest(t => ({ ...t, group: e.target.value })); setDirty(true) }} />
            <datalist id="hm-group-names">{groups.map(g => <option key={g.id} value={g.name} />)}</datalist>
          </label>
          <label style={{ ...lab, flex: '1 1 150px' }}>Date<input style={inp} type="date" value={test.date} onChange={e => { setTest(t => ({ ...t, date: e.target.value })); setDirty(true) }} /></label>
          {!fixedKind && <label style={{ ...lab, flex: '2 1 240px' }}>Subject preset
            <select style={inp} value={test.preset} onChange={e => setPreset(e.target.value)}>
              {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>}
        </div>
        {!fixedKind && <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 2 }}>Quick test · Arithmetic / 50:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
            const on = test.name === `Test ${n}` && test.preset === 'arith50'
            return <button key={n} type="button" onClick={() => quickTest(n)} aria-pressed={on} style={{ minWidth: 64, minHeight: 38, padding: '4px 12px', borderRadius: 10, border: `1.5px solid ${on ? NAVY : '#d3dbe7'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : NAVY, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Test {n}</button>
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 2 }}>Saved templates:</span>
          {templates.map(t => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, border: `1.5px solid ${GOLD}`, background: '#fffaf0', overflow: 'hidden' }}>
              <button type="button" onClick={() => useTemplate(t)} title={t.subjects.map(x => `${x.n} ${x.max}`).join(' + ')} style={{ border: 0, background: 'transparent', padding: '7px 6px 7px 12px', fontWeight: 700, fontSize: 12.5, color: NAVY, cursor: 'pointer', fontFamily: 'inherit' }}>{t.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {t.subjects.reduce((a, x) => a + Number(x.max || 0), 0)}</span></button>
              {(canDelete || !t.created_by || t.created_by === meKey) && <button type="button" aria-label={`Delete template ${t.name}`} onClick={() => delTemplate(t)} style={{ border: 0, background: 'transparent', padding: '7px 10px 7px 4px', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>}
            </span>
          ))}
          {!templates.length && <span style={{ fontSize: 12, color: '#94a3b8' }}>none yet</span>}
          <button type="button" onClick={saveTemplate} style={{ ...btn(false), minHeight: 34, padding: '4px 12px', fontSize: 12.5 }}>💾 Save this test setup as template</button>
        </div>
        </>}
        {test.kind === 'booklet' ? (
          <div style={{ fontSize: 12.5, color: '#64748b' }}>Marks: {test.subjects.map(x => `${x.n} out of ${x.max}${x.min !== '' ? ` (pass ${x.min})` : ''}`).join(' + ')}. Fixed by the booklet.</div>
        ) : <>
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
        </>}
        </div>}
      </div>

      <div style={card}>
        <Step n={2} title="My class" hint="The students who sit this test. Search the school list and tap Add. Only you see your class." open={openStu} onToggle={() => setOpenStu(v => !v)}
          summary={`${roster.length} student${roster.length === 1 ? '' : 's'} in my class${test.group ? ' · ' + test.group : ''}`} />
        {openStu && <div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 14px', borderRadius: 14, background: roster.length ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${roster.length ? '#bbf7d0' : '#fcd34d'}` }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🎓 {roster.length} student{roster.length === 1 ? '' : 's'} in my class</span>
          <span style={{ flex: 1 }} />
          <button type="button" style={{ ...btn(false), color: '#b91c1c', minHeight: 36 }} onClick={clearStudents} disabled={!roster.length}>Clear all</button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 6 }}>① Find students and tap Add</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <input style={{ ...inp, flex: '2 1 220px', width: 'auto' }} placeholder="🔍 Type a name or GCC No" value={pickQ} onChange={e => setPickQ(e.target.value)} />
          <select style={{ ...inp, flex: '1 1 150px', width: 'auto' }} value={fClass} onChange={e => setFClass(e.target.value)} aria-label="Show one class"><option value="">All classes</option>{classes.map(x => <option key={x} value={x}>{x}</option>)}</select>
        </div>
        {searching ? (
          <div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, maxHeight: 280, overflowY: 'auto' }}>
              {shownAddable.length ? shownAddable.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderBottom: `1px solid ${LINE}`, fontSize: 13.5, background: onSheet.has(s.id) ? '#f0fdf4' : '#fff' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: NAVY }}>{s.name}</b><span style={{ color: '#94a3b8' }}> · {s.gcc_no || ''}{s.class_name ? ' · ' + s.class_name : ''}</span></span>
                  {onSheet.has(s.id)
                    ? <button type="button" onClick={() => unpickStudent(s.id)} style={{ fontSize: 12.5, fontWeight: 700, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', flex: 'none' }}>✓ Added · Remove</button>
                    : <button type="button" onClick={() => addStudents([s.id])} style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: NAVY, border: 0, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', flex: 'none' }}>＋ Add</button>}
                </div>
              )) : <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>No student matches.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <button type="button" style={btn(true)} onClick={() => addStudents(addable.map(x => x.id))} disabled={!addable.some(x => !onSheet.has(x.id))}>＋ Add all {addable.filter(x => !onSheet.has(x.id)).length} shown</button>
              <button type="button" style={btn(false)} onClick={() => { setPickQ(''); setFClass('') }}>Done</button>
              {addable.length > 200 && <span style={{ fontSize: 12, color: '#64748b' }}>Showing 200 of {addable.length}; “Add all” adds every match.</span>}
            </div>
          </div>
        ) : <div style={{ fontSize: 12.5, color: '#64748b' }}>{roster.length ? 'Search again to add more students.' : 'Your class is empty. Type a name, or pick a class and tap “Add all”.'}</div>}

        {roster.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 6 }}>② My class</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(showAllChips ? roster : roster.slice(0, 24)).map(s => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 99, padding: '5px 6px 5px 11px', fontSize: 12.5 }}>
                  {s.name}
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => unpickStudent(s.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>✕</button>
                </span>
              ))}
              {roster.length > 24 && <button type="button" onClick={() => setShowAllChips(v => !v)} style={{ ...btn(false), minHeight: 28, padding: '3px 10px', fontSize: 12 }}>{showAllChips ? 'Show fewer' : `Show all ${roster.length}`}</button>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${LINE}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Optional · saved groups</div>
          {groups.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              {groups.map(g => (
                <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, border: `1.5px solid ${GOLD}`, background: '#fffaf0', overflow: 'hidden' }}>
                  <button type="button" onClick={() => useGroup(g)} title={`Make My class = ${g.ids.length} students`} style={{ border: 0, background: 'transparent', padding: '7px 6px 7px 12px', fontWeight: 700, fontSize: 12.5, color: NAVY, cursor: 'pointer', fontFamily: 'inherit' }}>{g.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {g.ids.length}</span></button>
                  <button type="button" aria-label={`Delete group ${g.name}`} onClick={() => delGroup(g)} style={{ border: 0, background: 'transparent', padding: '7px 10px 7px 4px', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {roster.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...inp, maxWidth: 260, flex: '1 1 180px' }} placeholder="Name this group, e.g. Class VI" value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAsGroup() }} />
              <button type="button" style={btn(false)} onClick={saveAsGroup}>💾 Save my class as a group</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Tap a saved group to switch My class to it. {groupsDb === false ? 'Groups are saved on this computer only (database table not created yet).' : 'Groups are stored under your login.'}</div>
        </div>

        {groups.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setMgrOpen(v => !v)} style={{ ...btn(false), minHeight: 34, fontSize: 12.5, borderColor: dupes.length ? '#f59e0b' : LINE, background: dupes.length ? '#fffbeb' : '#fff' }}>
              {dupes.length ? `⚠ ${dupes.length} student${dupes.length === 1 ? ' is' : 's are'} in 2+ groups · Check groups` : '🗂 Manage my groups'} {mgrOpen ? '▴' : '▾'}
            </button>
            {mgrOpen && (
              <div style={{ marginTop: 8, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, background: '#fbfcfe' }}>
                {dupes.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 10px', marginBottom: 10, fontSize: 12.5, color: '#92400e' }}>
                    <b>Duplicates</b> — same student in more than one list:
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{dupes.map(d => <li key={d.id}><b>{d.name}</b> → {d.names.join(', ')}</li>)}</ul>
                  </div>
                )}
                {classExtra.length > 0 && (
                  <div style={{ paddingBottom: 8 }}>
                    <b style={{ color: NAVY, fontSize: 14 }}>🎓 Added to My class <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {classExtra.length}</span></b>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                      {classExtra.map(id => { const st = school.find(x => x.id === id); return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 8px', borderRadius: 8, background: '#fff', border: `1px solid ${LINE}` }}>
                          <span style={{ flex: 1 }}><b style={{ color: NAVY }}>{st ? st.name : 'Student no longer active'}</b>{st && st.class_name ? <span style={{ color: '#64748b' }}> · {st.class_name}</span> : null}</span>
                          <button type="button" onClick={() => removeFromClass(id)} style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Remove</button>
                        </div>) })}
                    </div>
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
        {bulkShort.length > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b45309', fontWeight: 700 }}>⚠ Check the order: {bulkShort.map(x => `${x.n} has ${x.k} of ${roster.length} marks`).join(' · ')}. Marks go to students by line number (see the names on the left), so a skipped line shifts everyone below it.</div>}
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
        {!roster.length ? <div style={{ color: '#64748b', fontSize: 13 }}>No students in your class yet. Search the institute's list above to add some.</div> : (
          <div className="hm-gridwrap" style={{ overflow: 'auto', maxHeight: '72vh', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 10px 30px -18px rgba(11,30,61,.45)' }}>
            <style>{`.hm-in{transition:border-color .12s,box-shadow .12s}.hm-in:focus{border-color:${NAVY}!important;box-shadow:0 0 0 4px rgba(201,162,75,.55);background:#fffdf5!important}.hm-in::placeholder{color:#cbd5e1}
                .hm-ab1{display:none}
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
                .hm-grid td.hm-c-mark .hm-ab1{display:block!important;width:100%;margin-top:5px;min-height:32px;font-size:11px;font-weight:800;border:1.5px solid #d3dbe7;border-radius:9px;background:#fff;color:#64748b;cursor:pointer;font-family:inherit}
                .hm-grid td.hm-c-sum{background:#f1f5f9!important;border-radius:12px;padding:7px 10px!important}
                .hm-grid td.hm-c-sum::before{content:attr(data-sub);display:block;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-bottom:2px}
              }
            `}</style>
            <table ref={tableRef} data-rt-skip className="hm-grid" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 560 }}>
              <thead><tr>
                <th style={{ ...thG, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, minWidth: 118 }}>Student</th>
                {test.subjects.map((s, i) => <th key={i} style={thG}>{s.n || 'Subject'}<div style={{ fontWeight: 500, opacity: .75, fontSize: 11 }}>out of {s.max}</div></th>)}
                <th style={thG}>Total<div style={{ fontWeight: 500, opacity: .75, fontSize: 11 }}>out of {maxTotal}</div></th><th style={thG}>%</th><th style={thG}>Grade</th><th style={thG}>Rank</th>
              </tr></thead>
              <tbody>
                {shown.slice(0, rowLimit).map((s, idx) => {
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
                          
                            <button type="button" className="hm-ab1" tabIndex={-1} aria-label={`${s.name} ${sub.n} absent`} onClick={() => setCell(s.id, i, v === 'AB' ? '' : 'AB')} style={v === 'AB' ? { background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' } : undefined}>AB (absent)</button>
                          </td>
                        )
                      })}
                      <td className="hm-c-sum" data-sub="Total" style={cell}>{c.absent ? <span style={{ fontWeight: 700, color: '#b45309' }}>Absent</span> : c.n ? <span style={{ display: 'inline-block', minWidth: 46, padding: '6px 10px', borderRadius: 10, background: NAVY, color: '#fff', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 17, fontWeight: 800 }}>{c.tot}</span> : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                      <td className="hm-c-sum" data-sub="Percent" style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15, fontWeight: 800, color: !c.n ? '#cbd5e1' : c.pct >= 60 ? '#047857' : c.pct >= 40 ? '#a16207' : '#b91c1c' }}>{c.n ? c.pct.toFixed(1) : '–'}</td>
                      <td className="hm-c-sum" data-sub="Grade" style={{ ...cell, fontSize: 15, fontWeight: 800, color: c.n && !c.bad ? gradeColor(c.grade) : '#cbd5e1' }}>{c.rank ? c.grade : '–'}</td>
                      <td className="hm-c-sum" data-sub="Rank" style={{ ...cell, fontSize: 16, fontWeight: 800, color: NAVY }}>{c.partial ? <span title="Some marks are missing, so no rank yet" style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>⏳ incomplete</span> : c.rank ? (c.rank === 1 ? '🥇 1' : c.rank === 2 ? '🥈 2' : c.rank === 3 ? '🥉 3' : c.rank) : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > rowLimit && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" style={btn(true)} onClick={() => setRowLimit(l => l + 60)}>Show next 60 students ({shown.length - rowLimit} more)</button>
            <button type="button" style={{ ...btn(false), marginLeft: 8 }} onClick={() => setRowLimit(shown.length)}>Show all</button>
          </div>
        )}
        {stats.partial > 0 && <div style={{ fontSize: 13, color: '#b45309', fontWeight: 700, marginTop: 8 }}>⏳ {stats.partial} student{stats.partial === 1 ? ' has' : 's have'} some marks missing, so no rank, grade or topper yet. Type AB for a subject they missed.</div>}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Green = entered · Red = invalid or above the maximum · Amber = below the minimum. Ties share a rank.</div>
      </div>

      <div style={card}>
        <Step n="🤝" title="Whole test · all teachers" hint="Every teacher opens the same test, enters marks for their own students and saves. All marks are combined here." right={test.id ? <button type="button" style={{ ...btn(false), minHeight: 36 }} onClick={() => loadShared(test.id)}>↻ Refresh</button> : null} />
        {!test.id ? <div style={{ fontSize: 13, color: '#64748b' }}>Save this test first. Other teachers will then see it under “Saved tests”, open it and add their students.</div>
          : !combined ? <div style={{ fontSize: 13, color: '#64748b' }}>Loading…</div> : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {[['Students', combined.rows.length], ['Teachers', combined.teachers.length], ['Ranked', combined.ranked.length], ['Average', combined.avg == null ? '–' : combined.avg.toFixed(1) + '%']].map(([l, v]) => (
                <div key={l} style={{ flex: '1 1 110px', border: `1px solid ${LINE}`, borderRadius: 14, padding: '8px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: '#64748b', textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginBottom: 12 }}>
              {combined.teachers.map(t => (
                <div key={t.name} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', background: t.name === (currentUser?.name || meKey) ? '#fffaf0' : '#fff' }}>
                  <div style={{ fontWeight: 800, color: NAVY }}>{t.name}{t.name === (currentUser?.name || meKey) ? ' (you)' : ''}</div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{t.count} students · avg {t.avg == null ? '–' : t.avg.toFixed(1) + '%'}</div>
                  {t.top && <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 2 }}>🥇 {t.top.name} · {t.top.c.tot}/{combined.mx}</div>}
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
              {combined.ranked.slice(0, 10).map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: `1px solid ${LINE}`, fontSize: 13.5, background: '#fff' }}>
                  <b style={{ width: 34, color: NAVY }}>{r.c.rank <= 3 ? medal(r.c.rank - 1) : ''}{r.c.rank}</b>
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: NAVY }}>{r.name}</b><span style={{ color: '#94a3b8' }}> · {r.cls} · {r.teacher}</span></span>
                  <b>{r.c.tot}</b><span style={{ color: gradeColor(r.c.grade), fontWeight: 800, width: 24, textAlign: 'right' }}>{r.c.grade}</span>
                </div>
              ))}
              {!combined.ranked.length && <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>No complete marks yet.</div>}
            </div>
            {combined.ranked.length > 10 && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Top 10 of {combined.ranked.length}. The PDF has everyone.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" style={btn(true)} onClick={() => exportCombinedPdf(true)} disabled={pdfBusy}>📤 Share combined PDF</button>
              <button type="button" style={btn(false)} onClick={() => exportCombinedPdf(false)} disabled={pdfBusy}>📄 Download</button>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <Step n="🏆" title="Analyser" hint="Toppers, averages and pass rates for every list, class and house on this sheet." />
        {!stats.ranked ? <div style={{ fontSize: 13, color: '#64748b' }}>Enter some marks to see the analysis.</div> : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {analysis.overall.toppers.length > 0 && (
                <div style={{ flex: '1 1 240px', borderRadius: 16, padding: '12px 14px', color: '#fff', background: `linear-gradient(135deg,${NAVY},#17325f)` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: GOLD }}>🥇 OVERALL TOPPER{analysis.overall.toppers.length > 1 ? 'S' : ''}</div>
                  <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 19, fontWeight: 700, marginTop: 2 }}>{analysis.overall.toppers.map(x => x.name).join(', ')}</div>
                  <div style={{ fontSize: 13, opacity: .85 }}>{analysis.overall.topTot} / {maxTotal} · {(analysis.overall.topTot / (maxTotal || 1) * 100).toFixed(1)}%</div>
                </div>
              )}
              <div style={{ flex: '1 1 240px', border: `1px solid ${LINE}`, borderRadius: 16, padding: '12px 14px', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#64748b' }}>GRADES</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {GRADES.map(([, g]) => <span key={g} style={{ borderRadius: 10, padding: '4px 10px', background: '#f1f5f9', fontWeight: 800, fontSize: 13, color: gradeColor(g) }}>{g} · {analysis.gradeCount[g] || 0}</span>)}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>A+ 90+ · A 80+ · B+ 70+ · B 60+ · C 50+ · D 40+ · E below 40 (percent of maximum). Pass = every mark at or above its minimum (or 40%+ overall when no minimums are set). Students with missing marks are not ranked.</div>
              </div>
            </div>
            <div className="hm-seg" role="group" aria-label="Analyse by" style={{ marginBottom: 12, flexWrap: 'wrap', maxWidth: '100%' }}>
              {[['lists', `My groups (${analysis.lists.length})`], ['classes', `Class (${analysis.classes.length})`], ['houses', `House (${analysis.houses.length})`], ['subjects', 'Subjects']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={anTab === k} onClick={() => setAnTab(k)} style={anTab === k ? { background: NAVY, color: '#fff', fontWeight: 800 } : { fontWeight: 700, color: NAVY }}>{l}</button>
              ))}
            </div>
            {anTab === 'subjects' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
                {analysis.subjects.map((sb, i) => (
                  <div key={i} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', background: '#fff' }}>
                    <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{sb.n || 'Subject'} <span style={{ color: '#94a3b8', fontWeight: 600 }}>/ {sb.max}</span></div>
                    {!sb.count ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>No marks yet.</div> : (
                      <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.7 }}>
                        <div>🥇 <b>{sb.hi}</b> · {sb.hiNames.slice(0, 3).join(', ')}{sb.hiNames.length > 3 ? ` +${sb.hiNames.length - 3}` : ''}</div>
                        <div>Average <b>{sb.avg.toFixed(1)}</b> ({(sb.avg / (Number(sb.max) || 1) * 100).toFixed(0)}%) · Lowest <b>{sb.lo}</b></div>
                        {sb.passPct != null && <div>Passed minimum: <b>{sb.passPct.toFixed(0)}%</b></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (analysis[anTab].length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b' }}>{anTab === 'lists' ? 'None of your groups contain students on this sheet. Save a group in step 2 to compare groups.' : 'Nothing to group yet.'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
                {[...analysis[anTab]].sort((a, b) => (b.avgPct ?? -1) - (a.avgPct ?? -1)).map(g => (
                  <div key={g.label} style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: '12px 14px', background: '#fff', boxShadow: '0 1px 2px rgba(11,30,61,.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <b style={{ color: NAVY, fontSize: 15 }}>{g.label}</b>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{g.ranked}/{g.total} marked</span>
                    </div>
                    {!g.ranked ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>No marks entered for this group.</div> : (
                      <>
                        <div style={{ marginTop: 6, background: '#fffaf0', border: `1.5px solid ${GOLD}`, borderRadius: 12, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: '#a16207' }}>TOPPER{g.toppers.length > 1 ? 'S' : ''}</div>
                          <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>🥇 {g.toppers.map(x => x.name).join(', ')}</div>
                          <div style={{ fontSize: 12.5, color: '#475569' }}>{g.topTot} / {maxTotal} · {(g.topTot / (maxTotal || 1) * 100).toFixed(1)}%</div>
                        </div>
                        {g.top3.filter(x => !g.toppers.includes(x)).map((x, k) => (
                          <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 2px 0', color: '#334155' }}><span>{medal(k + 1)} {x.name}</span><b>{calc[x.id].tot}</b></div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <span style={{ flex: 1, background: '#f1f5f9', borderRadius: 10, padding: '5px 8px', fontSize: 12 }}>Avg <b style={{ fontSize: 14 }}>{g.avgPct.toFixed(1)}%</b></span>
                          <span style={{ flex: 1, background: '#f1f5f9', borderRadius: 10, padding: '5px 8px', fontSize: 12 }}>Pass <b style={{ fontSize: 14 }}>{g.passPct.toFixed(0)}%</b></span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {anTab === 'lists' && dupes.length > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#92400e', marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={anOnce} onChange={e => setAnOnce(e.target.checked)} />
                ⚠ {dupes.length} student{dupes.length === 1 ? ' is' : 's are'} in more than one group. Tick to count each student only in the first group they appear in.
              </label>
            )}
          </>
        )}
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
        <Step n="★" title="Saved tests" hint={saved.length ? `${saved.length} shared with all teachers · Open one, enter your students' marks, save` : 'Tests you save are shared with every teacher.'} />
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
                    <div style={{ fontSize: 12, color: '#64748b' }}>Shared · {Object.keys(r.marks || {}).length} students · {new Set(Object.values(r.marks || {}).map(v => v.by).filter(Boolean)).size || 1} teacher{(new Set(Object.values(r.marks || {}).map(v => v.by).filter(Boolean)).size || 1) === 1 ? '' : 's'}{r.created_by ? ` · by ${r.created_by}` : ''}{cur ? ' · open now' : ''}</div>
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

// Two views: enter marks, and look back at every shared test with analysis. The entry view stays mounted so unsaved marks are never lost when switching.
export default function HouseMarksTab(props) {
  const [view, setView] = useState('enter')
  const [openReq, setOpenReq] = useState(null)
  const NAVY = '#0B1E3D', GOLD = '#C9A24B'
  const tab = (k, label) => (
    <button type="button" onClick={() => setView(k)} aria-pressed={view === k}
      style={{ flex: 1, minHeight: 46, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, borderRadius: 12, background: view === k ? `linear-gradient(180deg,#16335f,${NAVY})` : 'transparent', color: view === k ? '#fff' : NAVY, boxShadow: view === k ? '0 6px 14px -8px rgba(11,30,61,.6)' : 'none' }}>{label}</button>
  )
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div role="tablist" style={{ display: 'flex', gap: 6, padding: 5, marginBottom: 14, background: '#fff', border: `1.5px solid ${GOLD}`, borderRadius: 16, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        {tab('enter', '✏️ Enter marks')}{tab('past', '📚 Past results & analysis')}{tab('groups', '👥 Group list')}
      </div>
      <div style={{ display: view === 'enter' ? 'block' : 'none' }}><HouseMarksEntry {...props} openRequest={openReq} /></div>
      {view === 'groups' && <HouseMarksGroups school={props.allStudents || props.students || []} />}
      {view === 'past' && <HouseMarksPast school={props.allStudents || props.students || []} currentUser={props.currentUser} onOpenTest={row => { setOpenReq({ row, n: Date.now() }); setView('enter') }} />}
    </div>
  )
}

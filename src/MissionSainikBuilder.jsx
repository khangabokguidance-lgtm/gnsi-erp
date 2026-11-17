// MissionSainikBuilder.jsx — Pre Mock Test Builder (PMT, 150 Q) and Mega Mock Test Builder (MT, 125 Q) for Mission Sainik.
// Teachers upload their questions per section; the paper and answer key assemble automatically (no build step).
// Only the section's own setter (or an admin) can upload / delete. Everyone else can only view and print.
// Questions live in `mission_sainik_questions` (migration 20261206_mission_sainik_questions.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { PremiumCard, PX } from './premiumUI'
import MultiQuestionAdder, { blankCard, cardsToText } from './MultiQuestionAdder'
import { CountPill, Pill, MiniBar } from './MissionSainikUI'
import { parseQuestions, fetchAll } from './lib/missionSainikQuestions'
import { makeVersion, paperHealth, csvToQuestionText, CSV_TEMPLATE, omrHtml, wordWrap, mergePaperConfig, orderedSections, FONT_STACKS } from './lib/missionSainikPaper'
import { TESTS, MOCK_TESTS, SUBJECTS, PANEL, PRACTICE_PANEL, MOCK_SECTIONS, fullName, nameMatches } from './missionSainikData'

const TABLE = 'mission_sainik_questions'
const line = PX.line || '#eef1f6'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Which panel subjects may upload each Mega Mock section.
const MEGA_PANEL = { Mathematics: ['maths'], Intelligence: ['reasoning'], 'Grammar + Vocabulary': ['grammar', 'vocab'], 'Science + GK': ['science', 'gk'] }

const SUBJ = Object.fromEntries(SUBJECTS.map(x => [x.key, x]))
const DAILY_SECTIONS = [['maths', 20, 3], ['reasoning', 10, 2], ['grammar', 10, 2], ['gk', 10, 2]]
  .map(([k, q, marks]) => ({ label: SUBJ[k].label, short: SUBJ[k].short, q, marks, key: k }))
const CFG = {
  daily: {
    name: 'Daily Class Test', prefix: 'T', tests: TESTS.map(t => ({ no: t.no, date: t.date })), noun: 'Test',
    sections: DAILY_SECTIONS, duration: 'as notified', panel: 'practice',
  },
  practice: {
    name: 'Practice Bank', prefix: 'Set', noun: 'Set', restart: true, noMarks: true, panel: 'practice',
    tests: [1, 2, 3].map(no => ({ no, date: null })),
    sections: SUBJECTS.map(x => ({ label: x.label, short: x.short, q: 25, marks: 0, key: x.key, sets: PRACTICE_PANEL[x.key].sets })),
    duration: '',
  },
  pre: {
    name: 'Pre Mock', prefix: 'PMT', tests: TESTS, perQ: 2,
    sections: SUBJECTS.map(s => ({ label: s.label, short: s.short, q: 25, marks: 2, key: s.key })),
    duration: 'as notified',
  },
  mega: {
    name: 'Mega Mock', prefix: 'MT', tests: MOCK_TESTS,
    sections: MOCK_SECTIONS.map(s => ({ label: s.label, short: s.label, q: s.q, marks: s.marks / s.q })),
    duration: '150 minutes',
  },
}

// Resize a picked image to at most 640px wide and return a compact data: URL (figures are stored with the question).
function figFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file.'))
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Could not read the image.'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not open the image.'))
      img.onload = () => {
        const k = Math.min(1, 640 / img.width), c = document.createElement('canvas')
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
        const out = c.toDataURL('image/jpeg', 0.8)
        out.length > 350000 ? reject(new Error('Figure is too large — use a smaller or simpler image.')) : resolve(out)
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

export default function MissionSainikBuilder({ series, tasks, saveTask, currentUser, setMsg, isMobile, institute, embargo = false, audit = () => {}, today = '', panel = null, startTest, startSection, locks = {}, onLock }) {
  const cfg = CFG[series]
  const isAdmin = isAdminRole(currentUser?.role)
  const isMe = n => nameMatches(currentUser?.name, n)
  const [qs, setQs] = useState([])
  const [setup, setSetup] = useState(false)
  const [testNo, setTestNo] = useState(startTest || 1)
  const [sectionSel, setSection] = useState(startSection || cfg.sections[0].label)
  const [text, setText] = useState('')
  const [addMode, setAddMode] = useState('cards')   // cards | paste
  const [cards, setCards] = useState(() => [blankCard()])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState('')
  const [signoffs, setSignoffs] = useState([])
  const [bin, setBin] = useState([])
  const [showBin, setShowBin] = useState(false)
  const [editQ, setEditQ] = useState(null)   // question being edited (draft copy)
  const [ver, setVer] = useState({ sets: 1, shuffleQ: false, shuffleOpts: false, layout: 'book' })   // paper versions (Set A, B, C…)
  const [preview, setPreview] = useState(null)   // { html, title }
  const LS_PC = 'ms_paper_cfg_' + series
  const [pc, setPc] = useState(() => { try { return mergePaperConfig(cfg.sections, JSON.parse(localStorage.getItem(LS_PC) || 'null')) } catch { return mergePaperConfig(cfg.sections, null) } })
  const [showSettings, setShowSettings] = useState(false)
  const [showTools, setShowTools] = useState(false)   // Paper tools: collapsed on phones
  useEffect(() => {
    supabase.from('mission_sainik_paper_cfg').select('config').eq('series', series).maybeSingle?.().then?.(({ data }) => { if (data?.config) setPc(mergePaperConfig(cfg.sections, data.config)) }, () => {})
  }, [series]) // eslint-disable-line react-hooks/exhaustive-deps
  const savePc = async () => {
    try { localStorage.setItem(LS_PC, JSON.stringify(pc)) } catch { /* storage blocked */ }
    const { error } = await supabase.from('mission_sainik_paper_cfg').upsert({ series, config: pc, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }, { onConflict: 'series' })
    audit('paper_settings', series, { columns: pc.columns, font: pc.font })
    setMsg(error ? (isAdmin ? '✅ Saved on this device. Run migration 20261212 to share these settings with everyone.' : '🔒 Only admins can change paper settings for everyone.') : '✅ Paper settings saved for everyone')
  }
  const patchSection = (label, patch) => setPc({ ...pc, sections: pc.sections.map(x => (x.label === label ? { ...x, ...patch } : x)) })
  const moveSection = (label, d) => { const a = [...pc.sections], i = a.findIndex(x => x.label === label), j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; setPc({ ...pc, sections: a }) }
  const [picked, setPicked] = useState([])       // ids ticked for bulk actions
  const [moveTo, setMoveTo] = useState({ test: '', section: '' })
  const [reviews, setReviews] = useState([])
  const [newNote, setNewNote] = useState('')
  const [qSearch, setQSearch] = useState(''), [qLevel, setQLevel] = useState('')
  const [soft, setSoft] = useState(true)   // false until the launch migration (deleted_at column) has been run

  const load = useCallback(async () => {
    let { data, error } = await fetchAll(() => supabase.from(TABLE).select('*').eq('series', series).is('deleted_at', null).order('id'))
    if (error && /deleted_at/.test(error.message || '')) {            // launch migration not run yet → fall back to hard-delete mode
      setSoft(false)
      ;({ data, error } = await fetchAll(() => supabase.from(TABLE).select('*').eq('series', series).order('id')))
    }
    if (error) { setSetup(true); setQs([]) } else { setSetup(false); setQs(data || []) }
    const rv = await supabase.from('mission_sainik_reviews').select('*').eq('series', series).order('id')
    setReviews(rv.error ? [] : rv.data || [])
    const so = await supabase.from('mission_sainik_signoffs').select('*').eq('series', series)
    setSignoffs(so.error ? [] : so.data || [])
    const b = await fetchAll(() => supabase.from(TABLE).select('*').eq('series', series).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }))
    setBin(b.error ? [] : b.data || [])
  }, [series])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  const bySec = useMemo(() => {
    const m = {}; qs.forEach(q => { (m[q.test_no + '|' + q.section] = m[q.test_no + '|' + q.section] || []).push(q) }); return m
  }, [qs])
  const get = (t, s) => bySec[t + '|' + s] || []
  const avail = (t, s) => !s.sets || t <= s.sets                       // practice: not every subject has a 3rd set
  const live = t => cfg.sections.filter(s => avail(t, s))
  const section = (live(testNo).find(s => s.label === sectionSel) || live(testNo)[0]).label   // falls back when a set lacks this subject
  const testReady = t => live(t).every(s => get(t, s.label).length >= s.q)
  const testCount = t => live(t).reduce((a, s) => a + Math.min(get(t, s.label).length, s.q), 0)
  const totalQ = t => live(t).reduce((a, s) => a + s.q, 0)

  // Who may upload to a section: its setter (Pre Mock: the allotted setter; Mega Mock: the panel of its subjects) or an admin.
  const settersOf = (t, s) => cfg.panel === 'practice'
    ? (() => { const key = cfg.sections.find(x => x.label === s)?.key; if (panel?.practice?.[key]?.length) return panel.practice[key]; const p = PRACTICE_PANEL[key]; return p ? [p.verifier, ...p.assistants] : [] })()
    : series === 'pre'
    ? (tasks || []).filter(r => r.kind === 'test' && r.test_no === t && r.subject === s).map(r => r.setter)
    : (MEGA_PANEL[s] || []).flatMap(k => (panel?.setters?.[k] ?? PANEL[k]) || [])
  const isLocked = t => locks?.[`lock:${series}:${t}`] === 'on'
  const canEdit = (t, s) => isAdmin || (!isLocked(t) && settersOf(t, s).some(isMe))
  // Embargo (admin setting): until the test date only the section's setter and admins can read questions / answers or print.
  const dateOf = t => cfg.tests.find(x => x.no === t)?.date
  const embargoed = (t, s) => !!embargo && !!dateOf(t) && !!today && today < dateOf(t) && !canEdit(t, s)
  const signoff = (t, s) => signoffs.find(x => x.test_no === t && x.section === s)
  // Verifier: a different person from the uploader (admins may always verify).
  const verifiersOf = (t, s) => (cfg.panel === 'practice' || series === 'mega') ? settersOf(t, s)
    : (tasks || []).filter(r => r.kind === 'test' && r.test_no === t && r.subject === s).map(r => r.verifier).filter(Boolean)
  const notesOf = (t, s) => reviews.filter(r => r.test_no === t && r.section === s)
  const openNotes = (t, s) => notesOf(t, s).filter(r => r.status === 'open').length
  const addNote = async () => {
    const note = newNote.trim(); if (!note) return setMsg('❌ Write the note first.')
    const { error } = await supabase.from('mission_sainik_reviews').insert({ series, test_no: testNo, section, note, author: currentUser?.name || '', status: 'open' })
    if (error) return setMsg('❌ ' + error.message + ' (run migration 20261213)')
    audit('review_note', `${series}:${testNo}:${section}`, null); setNewNote(''); setMsg('✅ Note added — the setter will see it'); load()
  }
  const setNoteStatus = async (r, status) => {
    const { error } = await supabase.from('mission_sainik_reviews').update({ status, resolved_by: status === 'resolved' ? currentUser?.name || '' : null, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', r.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('review_' + status, `${series}:${r.test_no}:${r.section}`, { id: r.id }); load()
  }
  const delNote = async r => { if (!window.confirm('Delete this note?')) return; const { error } = await supabase.from('mission_sainik_reviews').delete().eq('id', r.id); if (error) return setMsg('❌ ' + error.message); load() }
  const canVerify = (t, s) => {
    const list = get(t, s); if (!list.length) return false
    if (isAdmin) return true
    if (openNotes(t, s) > 0) return false                     // unresolved review notes block verification
    const mine = list.every(q => nameMatches(q.uploaded_by, currentUser?.name?.split(/\s+/)[0]) || q.uploaded_by === currentUser?.name)
    return verifiersOf(t, s).some(isMe) && !mine
  }
  const clearSignoff = async (t, s) => { if (signoff(t, s)) await supabase.from('mission_sainik_signoffs').delete().eq('series', series).eq('test_no', t).eq('section', s) }
  const verify = async (t, s) => {
    if (!canVerify(t, s)) return setMsg('❌ A different panel member (not the uploader) must verify.')
    const n = get(t, s).length
    const { error } = await supabase.from('mission_sainik_signoffs').upsert({ series, test_no: t, section: s, verified_by: currentUser?.name || '', verified_at: new Date().toISOString() }, { onConflict: 'series,test_no,section' })
    if (error) return setMsg('❌ ' + error.message)
    audit('verify_section', `${series}:${t}:${s}`, { questions: n }); setMsg('✅ Section verified'); load()
  }

  const tid = n => (cfg.noun === 'Set' ? `Set ${n}` : `${cfg.prefix}-${String(n).padStart(2, '0')}`)
  const parsed = useMemo(() => parseQuestions(addMode === 'cards' ? cardsToText(cards) : text), [text, cards, addMode])
  const upload = async () => {
    if (!canEdit(testNo, section)) return setMsg('❌ Only the section setter or an admin can upload here.')
    if (parsed.errors.length) return setMsg('❌ ' + parsed.errors.slice(0, 3).join(' · '))
    if (!parsed.questions.length) return setMsg('❌ No questions found — check the format.')
    const have = get(testNo, section).length
    if (parsed.questions.length > 200) return setMsg('❌ Upload at most 200 questions at a time.')
    const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim()
    const seen = new Set(get(testNo, section).map(q => norm(q.question)))
    const dupes = parsed.questions.filter((q, i) => seen.has(norm(q.question)) || parsed.questions.findIndex(z => norm(z.question) === norm(q.question)) !== i)
    if (dupes.length) return setMsg(`❌ ${dupes.length} duplicate question(s) already in this section, e.g. “${dupes[0].question.slice(0, 50)}”. Remove them and upload again.`)
    if (have + parsed.questions.length > sec.q && !window.confirm(`${section} needs ${sec.q} questions; this makes ${have + parsed.questions.length}. Upload anyway?`)) return
    setBusy(true)
    const rows = parsed.questions.map(q => ({ ...q, series, test_no: testNo, section, uploaded_by: currentUser?.name || '' }))
    const { error } = await supabase.from(TABLE).insert(rows)
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message + (/passage|image_data/.test(error.message) ? ' (run migration 20261211 for passages and figures)' : ''))
    setText(''); setCards([blankCard()]); setMsg(`✅ ${rows.length} question(s) added to ${tid(testNo)} · ${section}`)
    audit('upload_questions', `${series}:${testNo}:${section}`, { count: rows.length })
    await clearSignoff(testNo, section)
    await load()
    // Pre Mock: when the section is complete, mark the allotted task as submitted automatically.
    if (series === 'pre' && have + rows.length >= sec.q) {
      const task = (tasks || []).find(r => r.kind === 'test' && r.test_no === testNo && r.subject === section)
      if (task && task.status === 'Pending' && saveTask) await saveTask(task, { status: 'Submitted', question_count: have + rows.length })
    }
  }
  const removeRows = async (match, label, ids) => {
    if (soft) {
      const { error } = await match(supabase.from(TABLE).update({ deleted_at: new Date().toISOString(), deleted_by: currentUser?.name || '' }))
      if (error) return setMsg('❌ ' + error.message)
    } else {
      const { error } = await match(supabase.from(TABLE).delete())
      if (error) return setMsg('❌ ' + error.message)
    }
    audit('delete_questions', label, { count: ids, recoverable: soft })
    await clearSignoff(testNo, section); load()
    setMsg(soft ? '🗑 Moved to the recycle bin — you can restore it.' : '🗑 Deleted.')
  }
  const del = async q => {
    if (!canEdit(q.test_no, q.section)) return
    if (!window.confirm('Delete this question?' + (soft ? ' (it goes to the recycle bin)' : ' This cannot be undone.'))) return
    await removeRows(x => x.eq('id', q.id), `${series}:${q.test_no}:${q.section}`, 1)
  }
  const clearSection = async () => {
    const list = get(testNo, section)
    if (!list.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Delete all ${list.length} questions of ${section} for ${tid(testNo)}?`)) return
    await removeRows(x => x.eq('series', series).eq('test_no', testNo).eq('section', section).is('deleted_at', null), `${series}:${testNo}:${section}`, list.length)
  }
  const saveEdit = async () => {
    const d = editQ
    if (!canEdit(d.test_no, d.section)) return setMsg('❌ Only the section setter or an admin can edit this question.')
    if (!d.question.trim() || !d.option_a.trim() || !d.option_b.trim() || !d.option_c.trim() || !d.option_d.trim()) return setMsg('❌ The question and all four options are required.')
    if (!['A', 'B', 'C', 'D'].includes(d.answer)) return setMsg('❌ Choose the correct answer.')
    const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim()
    if (get(d.test_no, d.section).some(q => q.id !== d.id && norm(q.question) === norm(d.question))) return setMsg('❌ Another question in this section has the same text.')
    const patch = { question: d.question.trim(), option_a: d.option_a.trim(), option_b: d.option_b.trim(), option_c: d.option_c.trim(), option_d: d.option_d.trim(), answer: d.answer, explanation: d.explanation?.trim() || null, topic: d.topic?.trim() || null, difficulty: d.difficulty || null }
    if ('passage' in d) patch.passage = d.passage?.trim() || null
    if ('image_data' in d) patch.image_data = d.image_data || null
    const { error } = await supabase.from(TABLE).update(patch).eq('id', d.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('edit_question', `${series}:${d.test_no}:${d.section}`, { id: d.id })
    await clearSignoff(d.test_no, d.section); setEditQ(null); setMsg('✅ Question updated (verification reset)'); load()
  }
  const restore = async q => {
    if (!(isAdmin || canEdit(q.test_no, q.section))) return
    const { error } = await supabase.from(TABLE).update({ deleted_at: null, deleted_by: null }).eq('id', q.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('restore_question', `${series}:${q.test_no}:${q.section}`, { id: q.id }); clearSignoff(q.test_no, q.section); load()
  }
  const purge = async q => {
    if (!isAdmin || !window.confirm('Delete this question forever? This cannot be undone.')) return
    const { error } = await supabase.from(TABLE).delete().eq('id', q.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('purge_question', `${series}:${q.test_no}:${q.section}`, { id: q.id }); load()
  }
  // Backup: the whole bank of this series as CSV (answers included), formula-injection safe.
  const exportCsv = () => {
    const cell = v => { const t = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"' }
    const head = ['Series', 'Test', 'Section', 'Q no', 'Question', 'A', 'B', 'C', 'D', 'Answer', 'Explanation', 'Topic', 'Level', 'Uploaded by', 'Verified by']
    const lines = [head.map(cell).join(',')]
    cfg.tests.forEach(t => live(t.no).forEach(sc => get(t.no, sc.label).forEach((q, i) => lines.push([cfg.name, tid(t.no), sc.label, startOf(sc.label) + i, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, q.explanation, q.topic, q.difficulty, q.uploaded_by, signoff(t.no, sc.label)?.verified_by || ''].map(cell).join(',')))))
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `Mission_Sainik_${cfg.name.replace(/\s+/g, '_')}_questions.csv`; a.click(); URL.revokeObjectURL(url)
    audit('export_questions', series, { rows: lines.length - 1 })
  }
  const loadFile = e => {
    const f = e.target.files?.[0]; if (!f) return
    const isCsv = /\.csv$/i.test(f.name)
    const r = new FileReader(); r.onload = () => setText(isCsv ? csvToQuestionText(String(r.result || '')) : String(r.result || '')); r.readAsText(f); e.target.value = ''
  }

  // ── automatic assembly → printable paper / key ─────────────────────────
  // Serial numbers are fixed by section (Annexure-II: Maths Q1–25, Reasoning Q26–50, Science Q51–75, GK Q76–100, Grammar Q101–125,
  // Vocabulary Q126–150), so a partly uploaded section never shifts the numbers of the sections after it.
  const ordSecs = orderedSections(cfg.sections, pc)                       // printed order, hidden sections removed
  const printLive = t => ordSecs.filter(sc => avail(t, sc))
  const printTotal = t => printLive(t).reduce((a, sc) => a + sc.q, 0)
  const startOf = label => {
    if (cfg.restart) return 1
    const i = ordSecs.findIndex(s => s.label === label)
    return i < 0 ? cfg.sections.slice(0, cfg.sections.findIndex(s => s.label === label)).reduce((a, s) => a + s.q, 0) + 1 : ordSecs.slice(0, i).reduce((a, s) => a + s.q, 0) + 1
  }
  const range = s => `Q${startOf(s.label)}–Q${startOf(s.label) + s.q - 1}`
  const SET_LETTERS = ['A', 'B', 'C', 'D']
  const assemble = (t, setIdx = 0) => printLive(t).map(sc => {
    let items = get(t, sc.label).slice(0, sc.q)
    if (ver.shuffleQ || ver.shuffleOpts) items = makeVersion(items, { seed: `${series}|${t}|${sc.label}|${SET_LETTERS[setIdx]}`, shuffleQ: ver.shuffleQ, shuffleOpts: ver.shuffleOpts })
    return { ...sc, from: startOf(sc.label), items: items.map((q, i) => ({ ...q, no: startOf(sc.label) + i })) }
  })
  const blocked = t => embargo && !isAdmin && dateOf(t) && today < dateOf(t)
  const F = FONT_STACKS[pc.font][1]
  const docCss = `@page{size:A4;margin:14mm}body{font-family:${F};color:#111827;font-size:${(pc.size * 1.2).toFixed(1)}px;line-height:${pc.line + 0.15}}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:6px;margin-bottom:8px}.lh h1{margin:0;font-size:19px;color:#132a4f}.lh div{font-size:11.5px;color:#555}
.meta{display:flex;justify-content:space-between;font-weight:700;margin:6px 0 8px}.note{font-size:11.5px;color:#444;margin-bottom:6px}
.sec{background:#eef1f6;border:1px solid #c9d1de;padding:4px 8px;font-weight:700;margin:10px 0 6px}
.q{margin:0 0 7px;page-break-inside:avoid}.o{display:grid;grid-template-columns:1fr 1fr;gap:1px 14px;margin-left:18px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eef1f6}
.conf{margin-top:10px;font-size:10.5px;color:#a00;text-align:center}.pb{page-break-after:always}`
  // One document body for one version (Set A/B/…) — paper or answer key.
  // "Exam book" layout (modelled on printed Sainik School papers): two columns, small-caps section boxes, bold numbers,
  // italic (a)(b)(c)(d) options laid out 4-up / 2-up / stacked by length, running header and page badge.
  const bookCss = `@page{size:A4;margin:16mm 12mm 14mm 12mm;@top-center{content:"${esc(cfg.name).toUpperCase()} TEST (MODEL SET)  ●●  MISSION SAINIK 2027";font:700 8.5pt ${F};color:#222;vertical-align:bottom;padding-bottom:2mm}
@bottom-center{content:"P-" counter(page);font:800 9.5pt ${F};color:#111}}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:${F};color:#111;font-size:${pc.size}pt;line-height:${pc.line};margin:0}
.banner{background:#d9dbe0;border-radius:2pt;padding:7mm 8mm;display:flex;align-items:center;gap:7mm;margin:0 0 4mm}
.badge{width:20mm;height:20mm;border:2.2pt solid #111;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.badge b{font:800 24pt ${F};line-height:1}.badge i{font:700 5.5pt ${F};font-style:normal;letter-spacing:.06em;margin-top:1pt}
.banner h1{margin:0;font:800 19pt ${F};font-variant:small-caps;letter-spacing:.02em;line-height:1.1}.banner div.s{font:600 9pt ${F};margin-top:2mm;color:#333}
.cols{column-count:${pc.columns};column-gap:9mm;column-rule:${pc.rule && pc.columns > 1 ? '.7pt solid #333' : 'none'}}
.sec{break-inside:avoid;break-after:avoid;border:1pt solid #111;background:#e4e5e9;text-align:center;font-variant:small-caps;font-weight:800;font-size:10.5pt;letter-spacing:.03em;padding:2pt 4pt;margin:3mm 0 2.5mm}
.ins{font-style:italic;font-weight:700;margin:1mm 0}.q{break-inside:avoid;margin:0 0 2.2mm;padding-left:7mm;text-indent:-7mm}
.q>b{display:inline-block;width:7mm;text-indent:0}.q .t{display:inline}.o{display:block;margin:.6mm 0 0 0;text-indent:0;padding-left:7mm;font-style:italic}
.o.four{display:flex;gap:3mm;flex-wrap:wrap}.o.four span{flex:1 1 auto;white-space:nowrap}.o.two{display:grid;grid-template-columns:1fr 1fr;gap:.4mm 3mm}.o span{display:block}.o.one span{display:block}
.key{width:100%;border-collapse:collapse;font-size:9.5pt}.key td,.key th{border:.6pt solid #666;padding:1.5pt 4pt;text-align:left;vertical-align:top}.key th{background:#e4e5e9}
.pass{text-align:justify;margin:0 0 2mm;text-indent:4mm}.fig{text-align:center;margin:1.5mm 0 1mm;text-indent:0;padding-left:0}.fig img{max-width:100%;max-height:48mm}
.sol{padding-left:7mm;text-indent:-7mm;margin:0 0 1.6mm;break-inside:avoid}.sol>b:first-child{display:inline-block;width:7mm;text-indent:0}.sol .m{font-size:8.5pt;color:#555;font-style:italic}
.conf{margin-top:3mm;font-size:8.5pt;color:#a00;text-align:center;break-inside:avoid}.meta{font-weight:700;font-size:9.5pt;display:flex;justify-content:space-between;margin:0 0 2mm}.note{font-size:9.5pt;font-style:italic;margin-bottom:2mm}`
  // ── Branding: logo, name, tagline, cover page, watermark, footer ──
  const brand = pc.brand || {}
  const instName = brand.name?.trim() || institute?.name || 'Guidance Navodaya & Sainik Institute'
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent || '') ? brand.accent : '#132a4f'
  const logoImg = brand.logo && /^data:image\//.test(brand.logo) ? `<img class="logo" src="${brand.logo}" alt="">` : ''
  const brandCss = `.logo{max-height:18mm;max-width:34mm;object-fit:contain;flex:none}.bn-t{font:600 8.5pt ${F};color:#444;margin-top:1mm}
.cover{min-height:255mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:6mm 4mm 0;break-after:page;page-break-after:always}
.cover .logo{max-height:30mm;max-width:60mm;margin-bottom:4mm}.cover h1{margin:0;font:800 22pt ${F};color:${accent};font-variant:small-caps}.cover .tag{font:600 10pt ${F};color:#555;margin:1mm 0 8mm}
.cover h2{margin:0 0 2mm;font:800 17pt ${F};border-top:2.2pt solid ${accent};border-bottom:2.2pt solid ${accent};padding:3mm 8mm}.cover .facts{font:700 10.5pt ${F};margin:3mm 0 7mm}
.cover table{width:100%;border-collapse:collapse;margin-bottom:7mm}.cover td{border:.8pt solid #333;padding:4mm 3mm;font:700 10.5pt ${F};text-align:left;width:50%}.cover td span{display:inline-block;min-width:60%;border-bottom:.6pt dotted #666}
.cover ol{text-align:left;margin:0;padding-left:6mm;font:10.5pt ${F};line-height:1.55;width:100%}.cover .dn{margin-top:auto;padding-top:8mm;font:800 11pt ${F};color:#a00;letter-spacing:.06em}
.wm{position:fixed;left:0;right:0;top:42%;text-align:center;font:800 64pt ${F};color:rgba(19,42,79,.07);transform:rotate(-28deg);z-index:0;pointer-events:none;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ftr{position:fixed;left:0;right:0;bottom:0;text-align:center;font:600 8pt ${F};color:#555;border-top:.5pt solid #bbb;padding-top:1mm}`
  const coverHtml = (t, key, setIdx) => {
    if (!brand.cover || key) return ''
    const secs = assemble(t, setIdx)
    const id = cfg.noun === 'Set' ? `Practice Set ${t}` : `${cfg.prefix}-${String(t).padStart(2, '0')}`
    const date = cfg.tests.find(x => x.no === t)?.date
    const setTag = ver.sets > 1 ? ` · Set ${SET_LETTERS[setIdx]}` : ''
    const marks = secs.reduce((a, x) => a + x.q * x.marks, 0)
    const lines = String(brand.instructions || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    return `<div class="cover">${logoImg}<h1>${esc(instName)}</h1>${brand.tagline ? `<div class="tag">${esc(brand.tagline)}</div>` : '<div class="tag">&nbsp;</div>'}
<h2>${esc(cfg.name)} Test — ${esc(id)}${esc(setTag)}</h2><div class="facts">${[date ? fmtShort(date) : '', cfg.noMarks ? '' : `${printTotal(t)} questions`, cfg.noMarks ? '' : `${marks} marks`, cfg.noMarks ? '' : cfg.duration].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
<table><tr><td>Candidate's name: <span></span></td><td>Roll / GCC no.: <span></span></td></tr><tr><td>Batch: <span></span></td><td>Signature: <span></span></td></tr></table>
${lines.length ? `<ol>${lines.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}<div class="dn">DO NOT OPEN UNTIL TOLD TO DO SO</div></div>`
  }
  const optLayout = q => {
    const o = (q.opts || ['A', 'B', 'C', 'D'].map(k => ({ k, text: q['option_' + k.toLowerCase()] }))).map(x => ({ k: x.k.toLowerCase(), text: String(x.text ?? '') }))
    const len = Math.max(...o.map(x => x.text.length))
    const cls = pc.optStyle === 'two' ? 'two' : pc.optStyle === 'one' ? 'one' : len <= 11 ? 'four' : len <= 27 ? 'two' : 'one'
    return `<div class="o ${cls}">${o.map(x => `<span>(${x.k}) ${esc(x.text)}</span>`).join('')}</div>`
  }
  // Passage header for the first question of a run that shares a passage, plus the figure under a stem.
  const passageHtml = (items, i) => {
    const q = items[i]; if (!q.passage || (i > 0 && items[i - 1].passage === q.passage)) return ''
    let j = i; while (j + 1 < items.length && items[j + 1].passage === q.passage) j++
    return `<div class="ins">Read the following passage and answer the questions (Q. ${q.no}${j > i ? '–' + items[j].no : ''}):</div><div class="pass">${esc(q.passage)}</div>`
  }
  const figHtml = q => (q.image_data && /^data:image\//.test(q.image_data) ? `<div class="fig"><img src="${q.image_data}" alt="Figure"></div>` : '')
  const bookBody = (t, key, setIdx, first) => {
    const secs = assemble(t, setIdx); const count = secs.reduce((a, x) => a + x.items.length, 0)
    const allVerified = live(t).every(x => signoff(t, x.label))
    const id = cfg.noun === 'Set' ? `Practice Set ${t}` : `${cfg.prefix}-${String(t).padStart(2, '0')}`
    const setTag = ver.sets > 1 ? ` · Set ${SET_LETTERS[setIdx]}` : ''
    const date = cfg.tests.find(x => x.no === t)?.date
    const letter = i => String.fromCharCode(65 + i)
    const banner = `<div class="banner">${logoImg}<div class="badge"><b>${cfg.noun === 'Set' ? t : String(t).padStart(2, '0')}</b><i>${key ? 'KEY' : 'MODEL SET'}</i></div><div><h1>${esc(instName)}<br>${esc(cfg.name)} Test — ${esc(id)}${esc(setTag)}${key ? ' · Answer Key' : ''}</h1>${brand.tagline ? `<div class="bn-t">${esc(brand.tagline)}</div>` : ''}<div class="s">Mission Sainik 2027${date ? ' · ' + esc(fmtShort(date)) : ''}${cfg.noMarks ? '' : ` · ${printTotal(t)} questions · ${secs.reduce((a, x) => a + x.q * x.marks, 0)} marks · ${esc(cfg.duration)}`}</div></div></div>`
    const sections = secs.map((x, si) => {
      const head = `<div class="sec">Section–${letter(si)}: ${esc(x.title)}</div>${x.instruction && !key ? `<div class="ins">${esc(x.instruction)}</div>` : ''}`
      if (key) return head + x.items.map(q => `<div class="sol"><b>${q.no}.</b><span><b>(${q.answer.toLowerCase()})</b> ${esc(q.explanation || '')}${q.topic || q.difficulty ? ` <span class="m">[${esc([q.topic, q.difficulty].filter(Boolean).join(' · '))}]</span>` : ''}</span></div>`).join('')
      return head + (x.items.length ? '' : `<div class="empty">No questions uploaded yet — Q${x.from}–Q${x.from + x.q - 1}</div>`) + x.items.map((q, i) => `${passageHtml(x.items, i)}<div class="q"><b>${q.no}.</b><span class="t">${esc(q.question)}</span>${figHtml(q)}${optLayout(q)}</div>`).join('')
    }).join('')
    return `${first && pc.banner ? banner : ''}${key || !pc.note ? '' : '<div class="note">Read each question carefully. Each question has four options; choose the one correct answer and darken its bubble on the OMR sheet. There is no negative marking.</div>'}
<div class="cols">${sections}</div>
${count < printTotal(t) ? `<div class="conf">DRAFT — ${count} of ${printTotal(t)} questions uploaded so far.</div>` : ''}${allVerified ? '' : '<div class="conf">NOT FULLY VERIFIED — some sections have no verification sign-off.</div>'}
<div class="conf">All questions are confidential until the test is held.</div>`
  }
  const docBody = (t, key, setIdx) => {
    const secs = assemble(t, setIdx); const count = secs.reduce((a, x) => a + x.items.length, 0)
    const allVerified = live(t).every(x => signoff(t, x.label))
    const id = cfg.noun === 'Set' ? `Practice Set ${t}` : `${cfg.prefix}-${String(t).padStart(2, '0')}`
    const date = cfg.tests.find(x => x.no === t)?.date
    const setTag = ver.sets > 1 ? ` · SET ${SET_LETTERS[setIdx]}` : ''
    const opts = q => (q.opts || ['A', 'B', 'C', 'D'].map(k => ({ k, text: q['option_' + k.toLowerCase()] }))).map(o => `<span>(${o.k}) ${esc(o.text)}</span>`).join('')
    const body = key
      ? `<table><tr><th>Q</th><th>Ans</th><th>Topic</th><th>Level</th><th>Explanation</th></tr>${secs.flatMap(x => [`<tr><td colspan="5" class="sec">${esc(x.label)} · Q${x.from}–Q${x.from + x.q - 1}</td></tr>`, ...x.items.map(q => `<tr><td>${q.no}</td><td><b>${q.answer}</b></td><td>${esc(q.topic || '')}</td><td>${esc(q.difficulty || '')}</td><td>${esc(q.explanation || '')}</td></tr>`)]).join('')}</table>`
      : secs.map(x => `<div class="sec">${esc(x.title)} · Q${x.from}–Q${x.from + x.q - 1} — ${x.q} question(s)${cfg.noMarks ? '' : ' × ' + x.marks + ' mark(s)'}</div>${x.items.map((q, i) => `${passageHtml(x.items, i).replace('class="pass"', 'class="pass" style="font-size:12px;margin:0 0 6px;text-align:justify"')}<div class="q"><b>${q.no}.</b> ${esc(q.question)}${figHtml(q)}<div class="o">${opts(q)}</div></div>`).join('')}`).join('')
    return `<div class="lh">${logoImg}<h1>${esc(instName)}</h1>${brand.tagline ? `<div>${esc(brand.tagline)}</div>` : ''}<div>Mission Sainik 2027 · ${cfg.name} Test${esc(setTag)} ${key ? '· ANSWER KEY (CONFIDENTIAL)' : ''}</div></div>
<div class="meta"><span>${id}${date ? ' · ' + esc(fmtShort(date)) : ''}${esc(setTag)}</span>${cfg.noMarks ? '' : `<span>Marks: ${secs.reduce((a, x) => a + x.q * x.marks, 0)}</span><span>Time: ${esc(cfg.duration)}</span>`}</div>
${key ? '' : '<div class="note">Each question has four options. Choose the one correct answer and darken the bubble on the OMR sheet. There is no negative marking.</div>'}
${body}${count < printTotal(t) ? `<div class="conf">DRAFT — ${count} of ${printTotal(t)} questions uploaded so far.</div>` : ''}${allVerified ? '' : '<div class="conf">NOT FULLY VERIFIED — some sections have no verification sign-off.</div>'}
<div class="conf">All questions are confidential until the test is held.</div>`
  }
  const allBodies = (t, key) => Array.from({ length: ver.sets }, (_, i) => coverHtml(t, key, i) + (ver.layout === 'book' ? bookBody(t, key, i, true) : docBody(t, key, i)))
  // On screen (the preview) the print CSS is shown as an A4 sheet on a grey desk — margins, running header and page frame
  // that @page rules only give when printing. Print output is unchanged.
  const previewCss = `.empty{display:none}@media screen{html{background:#cfd4dc}body{margin:0;padding:18px 10px}.sheet{box-sizing:border-box;width:210mm;max-width:100%;min-height:297mm;margin:0 auto 18px;background:#fff;box-shadow:0 4px 22px rgba(15,27,46,.28);padding:16mm 12mm 14mm}
.run{font:700 8.5pt ${F};text-align:center;letter-spacing:.04em;color:#222;border-bottom:.7pt solid #bbb;padding-bottom:2mm;margin-bottom:4mm}.pgno{font:800 9.5pt ${F};text-align:center;margin-top:6mm;color:#111}
.empty{display:block;text-align:center;font-style:italic;color:#8a93a6;border:1pt dashed #c9cfda;border-radius:3pt;padding:5pt;margin:0 0 2.5mm;font-size:9.5pt}}@media print{.run,.pgno{display:none}}`
  const shell = (bodies, title, auto) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${ver.layout === 'book' ? bookCss : docCss}${brandCss}${previewCss}</style></head><body>${brand.watermark?.trim() ? `<div class="wm">${esc(brand.watermark.trim())}</div>` : ''}${brand.footer?.trim() ? `<div class="ftr">${esc(brand.footer.trim())}</div>` : ''}${bodies.map((b, i) => `<div class="sheet"><div class="run">${esc(cfg.name).toUpperCase()} TEST (MODEL SET) ●● MISSION SAINIK 2027</div><div class="${i < bodies.length - 1 ? 'pb' : ''}">${b}</div><div class="pgno">P-${i + 1}</div></div>`).join('')}${auto ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
  const docTitle = (t, key) => `${cfg.noun === 'Set' ? 'Practice Set ' + t : cfg.prefix + '-' + String(t).padStart(2, '0')} ${key ? 'Answer Key' : 'Question Paper'}`
  const ready0 = t => { if (blocked(t)) { setMsg(`🔒 Locked until ${fmtShort(dateOf(t))} (embargo). Ask an admin.`); return false } if (!live(t).some(x => get(t, x.label).length)) { setMsg('❌ No questions uploaded for this test yet.'); return false } return true }
  const printDoc = (t, key) => {
    if (!ready0(t)) return
    audit(key ? 'print_key' : 'print_paper', `${series}:${t}`, { verified: live(t).every(x => signoff(t, x.label)), sets: ver.sets, shuffled: ver.shuffleQ || ver.shuffleOpts })
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    w.document.write(shell(allBodies(t, key), docTitle(t, key), true)); w.document.close()
  }
  const previewDoc = (t, key) => { if (!ready0(t)) return; setPreview({ html: shell(allBodies(t, key), docTitle(t, key), false), title: docTitle(t, key) }) }
  const exportWord = (t, key) => {
    if (!ready0(t)) return
    const html = wordWrap(`<style>${ver.layout === 'book' ? bookCss.replace(/@page\{[\s\S]*?\}\}/, '') : docCss}${brandCss.replace(/\.wm\{[^}]*\}|\.ftr\{[^}]*\}/g, '')}</style>` + allBodies(t, key).map(b => `<div style="page-break-after:always">${b}</div>`).join(''), docTitle(t, key))
    const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = docTitle(t, key).replace(/\s+/g, '_') + '.doc'; a.click(); URL.revokeObjectURL(url)
    audit('export_word', `${series}:${t}`, { key })
  }
  const printOmr = t => {
    if (blocked(t)) return setMsg('🔒 Locked until the test date (embargo).')
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    w.document.write(omrHtml({ title: docTitle(t, false).replace(' Question Paper', ''), institute: institute?.name || '', total: totalQ(t), setLabel: ver.sets > 1 ? '____' : '' })); w.document.close()
    audit('print_omr', `${series}:${t}`, null)
  }
  // ── Portable question bank (JSON): back up, share between institutes, reuse in another series ──
  const bankRows = scope => {
    const out = []
    const tests = scope === 'all' ? cfg.tests : cfg.tests.filter(t => t.no === testNo)
    tests.forEach(t => cfg.sections.forEach(sc => {
      if (scope === 'section' && !(t.no === testNo && sc.label === section)) return
      get(t.no, sc.label).forEach(q => out.push({ test_no: t.no, section: sc.label, question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, answer: q.answer, explanation: q.explanation || '', topic: q.topic || '', difficulty: q.difficulty || null, ...(q.passage ? { passage: q.passage } : {}) }))
    }))
    return out
  }
  const exportBank = scope => {
    if (embargo && !isAdmin) return setMsg('🔒 Bank export is locked until the test dates (embargo).')
    if (!isAdmin && (scope !== 'section' || !canEdit(testNo, section))) return setMsg('🔒 Staff can export only their own section. Ask an admin for a full export.')
    const list = bankRows(scope)
    if (!list.length) return setMsg('❌ Nothing to export here yet.')
    const data = { format: 'gnsi-qbank', version: 1, series, institute: instName, exported_at: new Date().toISOString(), count: list.length, questions: list }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `QBank_${series}_${scope === 'all' ? 'all' : scope === 'test' ? tid(testNo) : tid(testNo) + '_' + sec.short}.json`.replace(/\s+/g, '_'); a.click(); URL.revokeObjectURL(url)
    audit('bank_export', `${series}:${scope}`, { count: list.length }); setMsg(`✅ ${list.length} question(s) exported`)
  }
  const importBank = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    let data
    try { data = JSON.parse(await file.text()) } catch { return setMsg('❌ That file is not valid JSON.') }
    if (data?.format !== 'gnsi-qbank' || !Array.isArray(data.questions)) return setMsg('❌ Not a question-bank file (expected format “gnsi-qbank”).')
    const ok = x => x && String(x.question || '').trim() && ['option_a', 'option_b', 'option_c', 'option_d'].every(k => String(x[k] || '').trim()) && /^[A-D]$/i.test(String(x.answer || ''))
    const list = data.questions.filter(ok)
    if (!list.length) return setMsg('❌ No valid questions in the file.')
    if (list.length > 600) return setMsg('❌ Import at most 600 questions at a time.')
    const places = new Set(list.map(q => `${q.test_no}|${q.section}`))
    const keep = places.size > 1 && window.confirm(`The file has ${list.length} questions from ${places.size} places.\n\nOK = keep their original test and section.\nCancel = add all of them to ${tid(testNo)} · ${section}.`)
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const seen = new Map(), rows = []; let dupes = 0, denied = 0
    for (const q of list) {
      const t = keep ? Number(q.test_no) : testNo, sc = keep ? q.section : section
      if (!cfg.tests.some(x => x.no === t) || !cfg.sections.some(x => x.label === sc)) { denied++; continue }
      if (!canEdit(t, sc)) { denied++; continue }
      const key = `${t}|${sc}`
      if (!seen.has(key)) seen.set(key, new Set(get(t, sc).map(x => norm(x.question))))
      const set = seen.get(key), n = norm(q.question)
      if (set.has(n)) { dupes++; continue }
      set.add(n)
      rows.push({ question: String(q.question).trim(), option_a: String(q.option_a).trim(), option_b: String(q.option_b).trim(), option_c: String(q.option_c).trim(), option_d: String(q.option_d).trim(), answer: String(q.answer).toUpperCase(), explanation: q.explanation || '', topic: q.topic || '', difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : null, ...(q.passage ? { passage: String(q.passage) } : {}), series, test_no: t, section: sc, uploaded_by: currentUser?.name || '' })
    }
    if (!rows.length) return setMsg(`❌ Nothing imported — ${dupes} duplicate(s), ${denied} not allowed or not matching this series.`)
    if (!window.confirm(`Import ${rows.length} question(s)?${dupes ? `\n${dupes} duplicate(s) will be skipped.` : ''}${denied ? `\n${denied} not allowed here will be skipped.` : ''}`)) return
    setBusy(true)
    const { error } = await supabase.from(TABLE).insert(rows)
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message + (/passage|image_data/.test(error.message) ? ' (run migration 20261211 for passages)' : ''))
    audit('bank_import', series, { count: rows.length, dupes, denied, keep })
    for (const key of seen.keys()) { const [t, sc] = key.split('|'); await clearSignoff(Number(t), sc) }
    setMsg(`✅ ${rows.length} question(s) imported${dupes ? ` · ${dupes} duplicate(s) skipped` : ''}`); load()
  }
  const downloadTemplate = () => { const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'Mission_Sainik_questions_template.csv'; a.click(); URL.revokeObjectURL(url) }
  // Bulk actions on the ticked questions of the current section
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const moveSelected = async copy => {
    const rowsSel = secList.filter(q => picked.includes(q.id)); if (!rowsSel.length) return
    const tt = Number(moveTo.test || testNo), ss = moveTo.section || section
    if (!canEdit(tt, ss)) return setMsg('❌ Only the target section’s setter or an admin can add questions there.')
    if (tt === testNo && ss === section) return setMsg('❌ Choose a different test or section.')
    if (!window.confirm(`${copy ? 'Copy' : 'Move'} ${rowsSel.length} question(s) to ${tid(tt)} · ${ss}?`)) return
    let error
    if (copy) ({ error } = await supabase.from(TABLE).insert(rowsSel.map(({ id, created_at, deleted_at, deleted_by, ...r }) => ({ ...r, test_no: tt, section: ss, uploaded_by: currentUser?.name || '' }))))  // eslint-disable-line no-unused-vars
    else ({ error } = await supabase.from(TABLE).update({ test_no: tt, section: ss }).in('id', rowsSel.map(q => q.id)))
    if (error) return setMsg('❌ ' + error.message)
    audit(copy ? 'copy_questions' : 'move_questions', `${series}:${testNo}:${section}`, { to: `${tt}:${ss}`, count: rowsSel.length })
    await clearSignoff(tt, ss); await clearSignoff(testNo, section); setPicked([]); setMsg(`✅ ${copy ? 'Copied' : 'Moved'} ${rowsSel.length} question(s)`); load()
  }
  const deletePicked = async () => {
    const ids = picked.filter(id => secList.some(q => q.id === id)); if (!ids.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Delete ${ids.length} selected question(s)?${soft ? ' They go to the recycle bin.' : ''}`)) return
    await removeRows(x => x.in('id', ids), `${series}:${testNo}:${section}`, ids.length); setPicked([])
  }
  const secStatus = (t, s) => { const n = get(t, s.label).length; return n >= s.q ? 'ok' : n ? 'part' : 'none' }
  const col = st => (st === 'ok' ? PX.ok : st === 'part' ? PX.warn : PX.faint || '#9aa5b8')
  const sec = cfg.sections.find(s => s.label === section)
  const secList = get(testNo, sec.label)
  const mayEdit = canEdit(testNo, sec.label)
  const listShown = secList.map((q, i) => ({ q, i })).filter(({ q }) => (!qLevel || q.difficulty === qLevel) && (!qSearch.trim() || [q.question, q.topic, q.explanation, q.option_a, q.option_b, q.option_c, q.option_d].join(' ').toLowerCase().includes(qSearch.trim().toLowerCase())))
  const ready = testReady(testNo)
  const health = paperHealth(live(testNo).map(x => ({ label: x.label, q: x.q, items: get(testNo, x.label) })), qs, testNo)
  const lvl = { Easy: 0, Medium: 0, Hard: 0 }; secList.forEach(q => { if (lvl[q.difficulty] != null) lvl[q.difficulty]++ })

  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const stepTest = d => { const i = cfg.tests.findIndex(t => t.no === testNo); const n = cfg.tests[i + d]; if (n) setTestNo(n.no) }
  const msbCss = `.msb .msb-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.msb .msb-strip::-webkit-scrollbar{display:none}.msb .msb-chip{scroll-snap-align:center;flex:0 0 auto;min-width:92px;text-align:left;padding:9px 12px;border-radius:14px;border:2px solid #e8e3d8;background:#fff;cursor:pointer;font-family:inherit}
.msb .msb-chip.on{border-color:#b8923a;background:#faf1d9}.msb .msb-fab{position:fixed;right:14px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:34;border:none;border-radius:16px;background:#b8923a;color:#fff;font:800 14px inherit;font-family:inherit;padding:14px 18px;box-shadow:0 10px 24px rgba(184,146,58,.5)}
@media (max-width:640px){.msb input:not([type=checkbox]):not([type=file]),.msb select,.msb textarea{font-size:16px!important}.msb .px-hbtn,.msb .px-btn{min-height:42px}.msb .px-card{border-radius:16px}}`
  return (
    <div className="msb">
      <style>{msbCss}</style>
      {setup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261206_mission_sainik_questions.sql</b> in Supabase to enable the builders.</div>}
      <PremiumCard title={`${cfg.name} ${cfg.noun === 'Set' ? '' : cfg.noun === 'Test' ? 'Builder' : 'Test Builder'}`.trim()} subtitle={`Assembles automatically as setters upload — ${cfg.noun === 'Set' ? '25 questions per subject set' : totalQ(1) + ' questions per test'}. Only a section's own setter (or an admin) can upload; everyone else can view and print.`}
        bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        {isMobile && (
          <div className="msb-strip" role="tablist" aria-label={cfg.noun === 'Set' ? 'Choose a set' : 'Choose a test'} style={{ padding: '12px 12px 4px' }}>
            {cfg.tests.map(t => {
              const n = testCount(t.no), tot = totalQ(t.no), done = testReady(t.no)
              return (
                <button key={t.no} type="button" role="tab" aria-selected={t.no === testNo} className={'msb-chip' + (t.no === testNo ? ' on' : '')} onClick={() => setTestNo(t.no)} ref={el => { if (el && t.no === testNo) el.scrollIntoView?.({ inline: 'center', block: 'nearest' }) }}>
                  <div style={{ fontWeight: 800, color: PX.navy, fontSize: 14 }}>{tid(t.no)}</div>
                  <div style={{ fontSize: 11, color: PX.sub }}>{t.date ? fmtShort(t.date) : cfg.noun === 'Set' ? '25 per subject' : ' '}</div>
                  <div style={{ height: 5, borderRadius: 99, background: '#f1ede3', margin: '6px 0 3px', overflow: 'hidden' }}><div style={{ width: Math.min(100, tot ? (n / tot) * 100 : 0) + '%', height: '100%', background: done ? PX.ok : PX.gold }} /></div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: done ? PX.ok : PX.sub }}>{done ? '✓ Ready' : `${n}/${tot}`}</div>
                </button>
              )
            })}
          </div>
        )}
        {!isMobile && <table className="px-table" style={{ minWidth: 640 }}>
          <thead><tr><th>{cfg.noun === 'Set' ? 'Set' : 'Test'}</th>{cfg.sections.map(s => <th key={s.label}>{s.short}</th>)}<th>Total</th><th /></tr></thead>
          <tbody>{cfg.tests.map(t => (
            <tr key={t.no} style={t.no === testNo ? { background: PX.tint } : undefined}>
              <td><button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: PX.navy }} onClick={() => setTestNo(t.no)}>{tid(t.no)}</button><div style={{ fontSize: 11, color: PX.sub }}>{t.date ? fmtShort(t.date) : ''}</div></td>
              {cfg.sections.map(s => avail(t.no, s) ? <td key={s.label}><CountPill n={get(t.no, s.label).length} q={s.q} /></td> : <td key={s.label} style={{ color: PX.faint || '#9aa5b8' }}>—</td>)}
              <td><b>{testCount(t.no)}/{totalQ(t.no)}</b></td>
              <td>{testReady(t.no) ? <Pill tone="ok">Ready</Pill> : null}</td>
            </tr>))}
          </tbody>
        </table>}
      </PremiumCard>

      <PremiumCard title={`${tid(testNo)}${ready ? ' · Ready to print' : ''}`} subtitle={`${testCount(testNo)} of ${totalQ(testNo)} questions in`}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(!embargo || isAdmin) && <button className="px-hbtn" onClick={exportCsv}>⬇ Export bank</button>}<button className="px-hbtn" onClick={() => printDoc(testNo, false)}>🖨 Question paper</button><button className="px-hbtn" onClick={() => printDoc(testNo, true)}>🔑 Answer key</button></span>}>
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" className="px-btn ghost" style={{ flex: 1 }} disabled={cfg.tests[0].no === testNo} onClick={() => stepTest(-1)}>‹ Previous</button>
            <button type="button" className="px-btn ghost" style={{ flex: 1 }} disabled={cfg.tests[cfg.tests.length - 1].no === testNo} onClick={() => stepTest(1)}>Next ›</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${live(testNo).length}, 1fr)`, gap: 8 }}>
          {live(testNo).map(s => {
            const n = get(testNo, s.label).length, st = secStatus(testNo, s)
            const ups = [...new Set(get(testNo, s.label).map(q => q.uploaded_by).filter(Boolean))]
            return (
              <button key={s.label} onClick={() => setSection(s.label)} style={{ all: 'unset', cursor: 'pointer', padding: 10, borderRadius: 12, background: s.label === section ? '#fff' : PX.tint, border: `2px solid ${s.label === section ? PX.gold : 'transparent'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>{s.short} <span style={{ fontWeight: 400 }}>· {range(s)}</span></div>
                <div style={{ fontFamily: PX.serif, fontSize: 22, color: col(st) }}>{n}/{s.q}</div>
                <div style={{ fontSize: 11, color: PX.sub }}>{ups.length ? ups.map(fullName).join(', ') : settersOf(testNo, s.label).map(fullName).join(', ') || '—'}</div>
                {openNotes(testNo, s.label) > 0 && <div style={{ fontSize: 11, color: PX.warn, fontWeight: 700 }}>💬 {openNotes(testNo, s.label)} open note{openNotes(testNo, s.label) > 1 ? 's' : ''}</div>}
                {signoff(testNo, s.label) ? <div style={{ fontSize: 11, color: PX.ok, fontWeight: 700 }}>✓ Verified</div> : n >= s.q ? <div style={{ fontSize: 11, color: PX.warn }}>Awaiting verification</div> : null}
              </button>
            )
          })}
        </div>
      </PremiumCard>

      {isMobile && !showTools && <button type="button" className="px-btn ghost" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', margin: '0 0 12px', padding: '14px 16px', textAlign: 'left' }} onClick={() => setShowTools(true)}><span><b>🖨 Paper tools</b> <span style={{ color: PX.sub, fontSize: 12.5 }}>· health check, print, Word, OMR</span></span><span>▸</span></button>}
      {(!isMobile || showTools) && <PremiumCard title="Paper tools" subtitle={`${tid(testNo)} · health check, shuffled sets, OMR, Word and preview`}
        right={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{isAdmin && onLock && <button className="px-hbtn" onClick={() => onLock(`lock:${series}:${testNo}`, !isLocked(testNo))}>{isLocked(testNo) ? '🔓 Unlock paper' : '🔒 Lock paper'}</button>}<span className="px-hbtn" style={{ pointerEvents: 'none' }}>{health.score}% healthy</span></span>}>
        {isLocked(testNo) && <div role="status" style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 12, background: '#fff6dc', border: '1px solid #e9d9b0', color: '#5c4510', fontSize: 13, fontWeight: 600 }}>🔒 This paper is locked by an admin. It can be viewed and printed but not changed{isAdmin ? ' (you can, as an admin)' : ''}.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><MiniBar pct={health.score} tone={health.score >= 85 ? 'ok' : health.score >= 55 ? 'gold' : 'bad'} width={140} /><b style={{ fontSize: 13 }}>Paper health</b></div>
            {health.checks.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0', color: c.ok ? PX.ink : PX.warn }}>
                <span style={{ width: 18 }}>{c.ok ? '✅' : '⚠️'}</span><span>{c.text}</span>
              </div>))}
            {health.dupAcross.length > 0 && <div style={{ fontSize: 12, color: PX.sub, marginTop: 4 }}>Reused: {health.dupAcross.slice(0, 3).map(d => `“${d.question.slice(0, 30)}…” (test ${d.test})`).join(', ')}</div>}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Paper versions</div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginBottom: 8 }}>Print layout
              <select className="px-input" value={ver.layout} onChange={e => setVer({ ...ver, layout: e.target.value })} style={{ marginTop: 4 }}><option value="book">Exam book style (2 columns, like printed Sainik papers)</option><option value="simple">Simple (1 column)</option></select>
            </label>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub }}>Number of sets
              <select className="px-input" value={ver.sets} onChange={e => setVer({ ...ver, sets: Number(e.target.value) })} style={{ marginTop: 4 }}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 1 ? '1 (single paper)' : `${n} sets (A${n > 1 ? '–' + SET_LETTERS[n - 1] : ''})`}</option>)}</select>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8 }}><input type="checkbox" checked={ver.shuffleQ} onChange={e => setVer({ ...ver, shuffleQ: e.target.checked })} />Shuffle question order inside each section</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 6 }}><input type="checkbox" checked={ver.shuffleOpts} onChange={e => setVer({ ...ver, shuffleOpts: e.target.checked })} />Shuffle the options A–D</label>
            <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 6 }}>{ver.sets > 1 && !ver.shuffleQ && !ver.shuffleOpts ? '⚠ Several sets without shuffling will be identical. ' : ''}The same shuffle is reproduced every time you print, and each answer key matches its set.</div>
          </div>
        </div>
        {isAdmin && <div style={{ marginTop: 14 }}>
          <button className="px-hbtn" aria-expanded={showSettings} onClick={() => setShowSettings(v => !v)}>{showSettings ? '▾' : '▸'} Layout, fonts &amp; section builder</button>
        </div>}
        {isAdmin && showSettings && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: PX.tint, border: `1px solid ${line}` }}>
            {(() => {
              const lab = { display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub }
              const chk = (k, text) => <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={pc[k]} onChange={e => setPc({ ...pc, [k]: e.target.checked })} />{text}</label>
              return (
                <>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Layout &amp; fonts</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
                    <label style={lab}>Columns<select className="px-input" value={pc.columns} onChange={e => setPc({ ...pc, columns: Number(e.target.value) })}><option value={2}>2 columns</option><option value={1}>1 column</option></select></label>
                    <label style={lab}>Font<select className="px-input" value={pc.font} onChange={e => setPc({ ...pc, font: e.target.value })}>{Object.entries(FONT_STACKS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label>
                    <label style={lab}>Size ({pc.size} pt)<input type="range" min="8" max="14" step="0.2" value={pc.size} onChange={e => setPc({ ...pc, size: Number(e.target.value) })} style={{ width: '100%' }} /></label>
                    <label style={lab}>Line spacing<select className="px-input" value={pc.line} onChange={e => setPc({ ...pc, line: Number(e.target.value) })}>{[1.1, 1.2, 1.28, 1.4, 1.6, 1.8].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
                    <label style={lab}>Options<select className="px-input" value={pc.optStyle} onChange={e => setPc({ ...pc, optStyle: e.target.value })}><option value="auto">Automatic (4-up / 2-up / stacked)</option><option value="two">Always 2 × 2</option><option value="one">Always stacked</option></select></label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>{chk('rule', 'Line between columns')}{chk('banner', 'Title banner')}{chk('note', 'Instruction note')}</div>
                  </div>
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${line}`, fontFamily: FONT_STACKS[pc.font][1], fontSize: `${pc.size}pt`, lineHeight: pc.line }}>
                    <b>1.</b> Sample question — what is the value of 3/4 + 1/4?&nbsp;&nbsp;<i>(a) 1/2&nbsp;&nbsp;(b) 1&nbsp;&nbsp;(c) 3/4&nbsp;&nbsp;(d) 2</i>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13, margin: '14px 0 6px' }}>Branding, cover page &amp; watermark</div>
                  <div style={{ fontSize: 12, color: PX.sub, marginBottom: 8 }}>Make printed papers carry your institute's identity — also lets another institute use the portal with its own name and logo. Leave a box empty to use the default.</div>
                  {(() => {
                    const b = pc.brand || {}, setB = patch => setPc({ ...pc, brand: { ...b, ...patch } })
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                        <label style={lab}>Institute name on papers<input className="px-input" value={b.name || ''} onChange={e => setB({ name: e.target.value })} placeholder={institute?.name || 'Institute name'} /></label>
                        <label style={lab}>Tagline<input className="px-input" value={b.tagline || ''} onChange={e => setB({ tagline: e.target.value })} placeholder="e.g. Coaching for Sainik · Navodaya · RMS" /></label>
                        <label style={lab}>Watermark (printed faintly on every page)<input className="px-input" value={b.watermark || ''} onChange={e => setB({ watermark: e.target.value })} placeholder="e.g. CONFIDENTIAL or institute name" /></label>
                        <label style={lab}>Footer line<input className="px-input" value={b.footer || ''} onChange={e => setB({ footer: e.target.value })} placeholder="e.g. Khangabok, Thoubal · Ph 98xxxxxx" /></label>
                        <div style={{ ...lab, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span>Logo</span>
                          {b.logo && <img src={b.logo} alt="Logo" style={{ maxHeight: 44, maxWidth: 90, objectFit: 'contain', borderRadius: 6, border: `1px solid ${line}`, background: '#fff' }} />}
                          <input type="file" accept="image/*" aria-label="Upload logo" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { setB({ logo: await figFromFile(f) }) } catch (er) { setMsg('❌ ' + er.message) } e.target.value = '' }} />
                          {b.logo && <button type="button" className="px-btn ghost" onClick={() => setB({ logo: '' })}>Remove</button>}
                        </div>
                        <label style={lab}>Accent colour<input type="color" value={accent} onChange={e => setB({ accent: e.target.value })} style={{ display: 'block', width: 56, height: 36, border: `1px solid ${line}`, borderRadius: 8, padding: 2, background: '#fff' }} /></label>
                        <label style={{ ...lab, gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: PX.ink }}><input type="checkbox" checked={!!b.cover} onChange={e => setB({ cover: e.target.checked })} />Print a cover page (name, roll no., instructions, “do not open”) before the questions</label>
                        {b.cover && <label style={{ ...lab, gridColumn: '1 / -1' }}>Cover-page instructions (one per line)<textarea className="px-input" rows={5} value={b.instructions || ''} onChange={e => setB({ instructions: e.target.value })} /></label>}
                      </div>
                    )
                  })()}
                  <div style={{ fontWeight: 800, fontSize: 13, margin: '14px 0 6px' }}>Section builder</div>
                  <div style={{ fontSize: 12, color: PX.sub, marginBottom: 6 }}>Rename, reorder or hide sections and add an instruction line under each heading. Question serials (Q1, Q2…) follow this order.</div>
                  {pc.sections.map((x, i) => (
                    <div key={x.label} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto auto 1.2fr 1.6fr', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? `1px solid ${line}` : 'none', opacity: x.include ? 1 : 0.55 }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button className="px-hbtn" aria-label={`Move ${x.label} up`} disabled={i === 0} onClick={() => moveSection(x.label, -1)}>↑</button>
                        <button className="px-hbtn" aria-label={`Move ${x.label} down`} disabled={i === pc.sections.length - 1} onClick={() => moveSection(x.label, 1)}>↓</button>
                      </span>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}><input type="checkbox" checked={x.include} onChange={e => patchSection(x.label, { include: e.target.checked })} />Print</label>
                      <input className="px-input" aria-label={`Title for ${x.label}`} value={x.title} onChange={e => patchSection(x.label, { title: e.target.value })} placeholder={x.label} />
                      <input className="px-input" aria-label={`Instruction for ${x.label}`} value={x.instruction} onChange={e => patchSection(x.label, { instruction: e.target.value })} placeholder="Instruction line (optional), e.g. Read the passage and answer Q.1–5" />
                    </div>))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="px-btn gold" onClick={savePc}>Save for everyone</button>
                    <button className="px-btn ghost" onClick={() => setPc(mergePaperConfig(cfg.sections, null))}>Reset to default</button>
                  </div>
                </>
              )
            })()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="px-hbtn" onClick={() => previewDoc(testNo, false)}>👁 Preview paper</button>
          <button className="px-hbtn" onClick={() => previewDoc(testNo, true)}>👁 Preview key</button>
          <button className="px-hbtn" onClick={() => exportWord(testNo, false)}>📝 Word paper</button>
          <button className="px-hbtn" onClick={() => exportWord(testNo, true)}>📝 Word key</button>
          <button className="px-hbtn" onClick={() => printOmr(testNo)}>⭕ OMR sheet</button>
        </div>
      </PremiumCard>}

      <div id="msb-editor" style={{ scrollMarginTop: 70 }}>
      <PremiumCard title={`${section} · ${range(sec)}`} subtitle={`${secList.length}/${sec.q} questions · Easy ${lvl.Easy} · Medium ${lvl.Medium} · Hard ${lvl.Hard} (aim ≈ 40/40/20)`}
        right={<span style={{ display: 'flex', gap: 8 }}>{secList.length >= sec.q && !signoff(testNo, section) && canVerify(testNo, section) && <button className="px-hbtn" onClick={() => verify(testNo, section)}>✓ Mark verified</button>}{mayEdit && secList.length ? <button className="px-hbtn" onClick={clearSection}>🗑 Clear section</button> : null}</span>}>
        {mayEdit ? (
          <>
            {secList.length > sec.q && <div style={{ fontSize: 12.5, color: PX.warn, marginBottom: 8 }}>⚠ {secList.length - sec.q} extra question(s): only the first {sec.q} are used in the paper. Delete the extras you don't want.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px', padding: '8px 10px', borderRadius: 12, background: '#faf8f3', border: `1px solid ${line}` }}>
              <b style={{ fontSize: 12.5 }}>📦 Question bank</b>
              <button type="button" className="px-hbtn" onClick={() => exportBank('section')}>⬇ This section</button>
              {isAdmin && <button type="button" className="px-hbtn" onClick={() => exportBank('test')}>⬇ This {cfg.noun === 'Set' ? 'set' : 'test'}</button>}
              {isAdmin && <button type="button" className="px-hbtn" onClick={() => exportBank('all')}>⬇ Everything</button>}
              <label className="px-hbtn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>⬆ Import JSON<input type="file" accept=".json,application/json" aria-label="Import a question bank file" onChange={importBank} style={{ display: 'none' }} /></label>
              <span style={{ fontSize: 11.5, color: PX.sub }}>{isAdmin ? 'Back up, move to another series, or share with another institute. Duplicates are skipped.' : 'You can export or import your own section. Duplicates are skipped.'}</span>
            </div>
            <div role="tablist" aria-label="How to add questions" style={{ display: 'inline-flex', padding: 3, background: '#f4f1e8', borderRadius: 12, gap: 2, marginBottom: 12 }}>
              {[['cards', '🗂️ Question cards'], ['paste', '📋 Paste / file']].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={addMode === k} onClick={() => setAddMode(k)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: addMode === k ? '#fff' : 'transparent', boxShadow: addMode === k ? '0 1px 4px rgba(15,27,46,.15)' : 'none', color: addMode === k ? PX.ink : PX.sub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
              ))}
            </div>
            {addMode === 'cards' ? (
              <>
                <MultiQuestionAdder key={`${series}:${testNo}:${section}`} draftKey={`msb-draft:${series}:${testNo}:${section}`} cards={cards} setCards={setCards} remaining={sec.q - secList.length} startNo={startOf(section) + secList.length} title={`Section: ${sec.title || section}`} existing={secList.map(q => q.question)} isMobile={isMobile} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, position: 'sticky', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 0, zIndex: 4, background: '#fff', padding: '10px 0', borderTop: `1px solid ${line}` }}>
                  <span style={{ fontSize: 12.5, color: parsed.errors.length ? PX.bad : PX.sub }}>{parsed.errors.length ? parsed.errors.slice(0, 2).join(' · ') : `${parsed.questions.length} question(s) ready to upload`}</span>
                  <button className="px-btn ghost" onClick={() => setCards([blankCard()])} disabled={cards.length === 1 && !cards[0].question}>Clear all</button>
                  <button className="px-btn gold" style={{ marginLeft: 'auto' }} disabled={busy || !parsed.questions.length || parsed.errors.length > 0} onClick={upload}>{busy ? 'Uploading…' : `⬆ Upload ${parsed.questions.length || ''} question${parsed.questions.length === 1 ? '' : 's'}`}</button>
                </div>
              </>
            ) : (
              <>
            <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 8 }}>
              Paste your questions in this format (or load a .txt / .csv file). For a reading passage, put a “Passage: …” line before its questions and “End passage” after them; attach figures with ✎ on a question:
              <pre style={{ background: PX.tint, padding: 8, borderRadius: 8, fontSize: 12, margin: '6px 0', whiteSpace: 'pre-wrap' }}>{`Q1. What is 3/4 + 1/4?\nA) 1/2\nB) 1\nC) 3/4\nD) 2\nAns: B\nExp: Same denominator, add numerators.\nTopic: Fractions\nLevel: Easy`}</pre>
            </div>
            <textarea className="px-input" rows={9} value={text} onChange={e => setText(e.target.value)} aria-label="Paste questions here" placeholder="Paste questions here…" style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <button className="px-hbtn" onClick={downloadTemplate} type="button">⬇ CSV template</button>
              <input type="file" aria-label="Load questions from a .txt or .csv file" accept=".txt,.csv,text/plain,text/csv" onChange={loadFile} style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12.5, color: parsed.errors.length ? PX.bad : PX.sub }}>
                {text.trim() ? (parsed.errors.length ? parsed.errors.slice(0, 2).join(' · ') : `${parsed.questions.length} question(s) ready to upload`) : ''}
              </span>
              <button className="px-btn gold" style={{ marginLeft: 'auto' }} disabled={busy || !parsed.questions.length || parsed.errors.length > 0} onClick={upload}>{busy ? 'Uploading…' : '⬆ Upload questions'}</button>
            </div>
              </>
            )}
          </>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: PX.tint, fontSize: 13, color: PX.sub }}>
            🔒 View only. Only {settersOf(testNo, section).map(fullName).join(' / ') || 'the section setter'} (or an admin) can upload to this section.
          </div>
        )}
      </PremiumCard>
      </div>

      <PremiumCard title={`Review notes (${notesOf(testNo, section).length})`} subtitle={`${tid(testNo)} · ${section} — a verifier can ask for changes here; open notes block verification until they are resolved`}>
        {notesOf(testNo, section).length === 0 && <div style={{ fontSize: 13, color: PX.sub, marginBottom: 8 }}>No notes yet.</div>}
        {notesOf(testNo, section).map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${line}`, opacity: r.status === 'resolved' ? 0.65 : 1 }}>
            <span style={{ fontSize: 18 }}>{r.status === 'resolved' ? '✅' : '💬'}</span>
            <div style={{ flex: 1, fontSize: 13.5 }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div>
              <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 2 }}>{r.author}{r.status === 'resolved' ? ` · resolved by ${r.resolved_by || '?'}` : ''}</div>
            </div>
            {r.status === 'open' ? <button className="px-hbtn" onClick={() => setNoteStatus(r, 'resolved')}>Resolve</button> : isAdmin ? <button className="px-hbtn" onClick={() => setNoteStatus(r, 'open')}>Reopen</button> : null}
            {(isAdmin || nameMatches(r.author, currentUser?.name?.split(/\s+/)[0])) && <button className="px-hbtn" onClick={() => delNote(r)} aria-label="Delete note">🗑</button>}
          </div>))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="px-input" style={{ flex: '1 1 240px' }} value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="e.g. Q7 has two correct answers; Q12 needs an explanation" aria-label="New review note" />
          <button className="px-btn gold" onClick={addNote}>Add note</button>
        </div>
      </PremiumCard>

      <PremiumCard title="Questions in this section" subtitle={secList.length ? 'Click a question to see options, answer and explanation' : ''}
        right={mayEdit && secList.length ? <button className="px-hbtn" onClick={() => setPicked(picked.length === secList.length ? [] : secList.map(q => q.id))}>{picked.length === secList.length ? 'Clear selection' : 'Select all'}</button> : null}>
        {secList.length > 5 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input className="px-input" style={{ flex: '1 1 200px' }} type="search" value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Search questions, topics, options…" aria-label="Search questions" />
            <select className="px-input" style={{ flex: '0 1 140px' }} value={qLevel} onChange={e => setQLevel(e.target.value)} aria-label="Filter by level"><option value="">Any level</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
            {(qSearch || qLevel) && <span style={{ alignSelf: 'center', fontSize: 12.5, color: PX.sub }}>{listShown.length} of {secList.length}</span>}
          </div>)}
        {mayEdit && picked.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '8px 10px', margin: '0 0 8px', borderRadius: 12, background: '#fff6dc', border: '1px solid #e9d9b0', position: 'sticky', top: 0, zIndex: 3 }}>
            <b style={{ fontSize: 13 }}>{picked.length} selected</b>
            <select className="px-input" style={{ width: 'auto' }} aria-label="Target test" value={moveTo.test || testNo} onChange={e => setMoveTo({ ...moveTo, test: e.target.value })}>{cfg.tests.map(t => <option key={t.no} value={t.no}>{tid(t.no)}</option>)}</select>
            <select className="px-input" style={{ width: 'auto' }} aria-label="Target section" value={moveTo.section || section} onChange={e => setMoveTo({ ...moveTo, section: e.target.value })}>{cfg.sections.map(x => <option key={x.label} value={x.label}>{x.short}</option>)}</select>
            <button className="px-btn gold" onClick={() => moveSelected(false)}>Move</button>
            <button className="px-btn ghost" onClick={() => moveSelected(true)}>Copy</button>
            <button className="px-btn ghost" style={{ color: PX.bad }} onClick={deletePicked}>🗑 Delete</button>
          </div>)}
        {embargoed(testNo, section) ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>🔒 {secList.length} question(s) uploaded. The questions stay hidden from other staff until {fmtShort(dateOf(testNo))} (embargo).</div>
          : !secList.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Nothing uploaded yet.</div> : listShown.map(({ q, i }) => (
          <div key={q.id} style={{ borderTop: i ? `1px solid ${line}` : 'none', padding: isMobile ? '12px 0' : '8px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: isMobile ? 'center' : 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {mayEdit && <input type="checkbox" aria-label={`Select question ${i + 1}`} checked={picked.includes(q.id)} onChange={() => toggle(q.id)} style={{ marginTop: 4 }} />}
              <button style={{ all: 'unset', cursor: 'pointer', flex: isMobile ? '1 1 calc(100% - 36px)' : 1, fontSize: isMobile ? 14.5 : 13.5, lineHeight: 1.45 }} onClick={() => setOpen(open === q.id ? '' : q.id)}><b>Q{startOf(section) + i}.</b> {q.passage ? <span title="Has a reading passage">📖 </span> : null}{q.image_data ? <span title="Has a figure">🖼 </span> : null}{q.question}</button>
              {q.difficulty && <span style={{ fontSize: 11, color: PX.sub }}>{q.difficulty}</span>}
              {mayEdit && <button className="px-hbtn" onClick={() => { setEditQ({ ...q }); setOpen('') }} aria-label="Edit question">✎</button>}
              {mayEdit && <button className="px-hbtn" onClick={() => del(q)} aria-label="Delete question">🗑</button>}
            </div>
            {editQ && editQ.id === q.id && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 14, background: PX.tint, border: `1px solid ${line}` }}>
                {(() => {
                  const set = patch => setEditQ({ ...editQ, ...patch }), lab = { display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginTop: 8 }
                  return (
                    <>
                      <label style={{ ...lab, marginTop: 0 }}>Question<textarea className="px-input" rows={3} value={editQ.question} onChange={e => set({ question: e.target.value })} /></label>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                        {['a', 'b', 'c', 'd'].map(k => <label key={k} style={lab}>Option {k.toUpperCase()}<input className="px-input" value={editQ['option_' + k]} onChange={e => set({ ['option_' + k]: e.target.value })} /></label>)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 2fr 1fr', gap: 8 }}>
                        <label style={lab}>Answer<select className="px-input" value={editQ.answer} onChange={e => set({ answer: e.target.value })}>{['A', 'B', 'C', 'D'].map(k => <option key={k}>{k}</option>)}</select></label>
                        <label style={lab}>Level<select className="px-input" value={editQ.difficulty || ''} onChange={e => set({ difficulty: e.target.value })}><option value="">—</option><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
                        <label style={lab}>Topic<input className="px-input" value={editQ.topic || ''} onChange={e => set({ topic: e.target.value })} /></label>
                      </div>
                      <label style={lab}>Explanation<input className="px-input" value={editQ.explanation || ''} onChange={e => set({ explanation: e.target.value })} /></label>
                      {('passage' in editQ || 'image_data' in editQ) ? (
                        <>
                          <label style={lab}>Reading passage (printed once above a run of questions that share it)<textarea className="px-input" rows={3} value={editQ.passage || ''} onChange={e => set({ passage: e.target.value })} /></label>
                          <div style={{ ...lab, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>Figure</span>
                            {editQ.image_data && <img src={editQ.image_data} alt="Figure" style={{ maxHeight: 70, borderRadius: 8, border: `1px solid ${line}` }} />}
                            <input type="file" accept="image/*" aria-label="Attach a figure" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { set({ image_data: await figFromFile(f) }) } catch (er) { setMsg('❌ ' + er.message) } e.target.value = '' }} />
                            {editQ.image_data && <button className="px-btn ghost" type="button" onClick={() => set({ image_data: '' })}>Remove figure</button>}
                          </div>
                        </>
                      ) : <div style={{ fontSize: 12, color: PX.sub, marginTop: 8 }}>Run migration 20261211 to add passages and figures.</div>}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}><button className="px-btn ghost" onClick={() => setEditQ(null)}>Cancel</button><button className="px-btn gold" onClick={saveEdit}>Save question</button></div>
                    </>
                  )
                })()}
              </div>
            )}
            {open === q.id && (
              <div style={{ marginTop: 6, marginLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {['A', 'B', 'C', 'D'].map(k => <div key={k} style={{ fontWeight: q.answer === k ? 700 : 400, color: q.answer === k ? PX.ok : undefined }}>({k}) {q['option_' + k.toLowerCase()]}{q.answer === k ? ' ✓' : ''}</div>)}
                {q.explanation && <div style={{ color: PX.sub }}>Exp: {q.explanation}</div>}
                <div style={{ color: PX.sub, fontSize: 12 }}>{[q.topic, q.uploaded_by].filter(Boolean).join(' · ')}</div>
              </div>
            )}
          </div>
        ))}
      </PremiumCard>
      <PremiumCard title={`Recycle bin (${bin.length})`} subtitle="Deleted questions can be restored by the setter or an admin" right={<button className="px-hbtn" onClick={() => setShowBin(v => !v)}>{showBin ? 'Hide' : 'Show'}</button>}>
        {showBin && (!bin.length ? <div style={{ padding: 12, color: PX.sub, fontSize: 13 }}>Empty.</div> : bin.slice(0, 100).map(q => (
          <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: `1px solid ${line}`, fontSize: 13 }}>
            <span style={{ flex: 1 }}>{embargoed(q.test_no, q.section) ? '(hidden until test date)' : q.question.slice(0, 90)} <span style={{ color: PX.sub, fontSize: 11 }}>· {tid(q.test_no)} · {q.section} · deleted by {q.deleted_by || '?'}</span></span>
            {(isAdmin || canEdit(q.test_no, q.section)) && <button className="px-hbtn" onClick={() => restore(q)}>↩ Restore</button>}
            {isAdmin && <button className="px-hbtn" onClick={() => purge(q)} aria-label="Delete forever">✖</button>}
          </div>)))}
      </PremiumCard>
      {preview && (
        <div className="msx-overlay" onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div className="msx-dialog" role="dialog" aria-modal="true" aria-label="Paper preview" onClick={e => e.stopPropagation()} style={{ width: 'min(900px,100%)', height: '88vh', background: '#fff', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${line}` }}>
              <b style={{ flex: 1, fontSize: 14 }}>{preview.title}</b>
              <button className="px-btn gold" onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(preview.html.replace('</body>', '<script>window.onload=()=>window.print()</script></body>')); w.document.close() } }}>🖨 Print</button>
              <button className="px-btn ghost" onClick={() => setPreview(null)}>Close</button>
            </div>
            <iframe title="Paper preview" srcDoc={preview.html} style={{ flex: 1, border: 0, width: '100%', background: '#eef1f6' }} sandbox="" />
          </div>
        </div>
      )}
      {isMobile && mayEdit && !embargoed(testNo, section) && <button type="button" className="msb-fab" onClick={() => jump('msb-editor')}>＋ Add questions</button>}
    </div>
  )
}

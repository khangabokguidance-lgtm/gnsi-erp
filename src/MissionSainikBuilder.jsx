// MissionSainikBuilder.jsx — Pre Mock Test Builder (PMT, 150 Q) and Mega Mock Test Builder (MT, 125 Q) for Mission Sainik.
// Teachers upload their questions per section; the paper and answer key assemble automatically (no build step).
// Only the section's own setter (or an admin) can upload / delete. Everyone else can only view and print.
// Questions live in `mission_sainik_questions` (migration 20261206_mission_sainik_questions.sql).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { isAdminRole } from './roles'
import { PremiumCard, PX } from './premiumUI'
import MissionSainikQuickAdd from './MissionSainikQuickAdd'
import MultiQuestionAdder, { blankCard, cardsToText, isEmptyCard, cardsProblems, PastePreview } from './MultiQuestionAdder'
import { figFromFile } from './lib/figImage'
import ScanFigure from './ScanFigure'
import QuestionEditor from './QuestionEditor'
import { mathToHtml, mathPlain, setMathStacked, MATH_CSS } from './lib/mathText'
import { CountPill, Pill, MiniBar } from './MissionSainikUI'
import { Icon } from './MissionSainikIcons'
import { routePreMock, matchChapter, offPlan, planState } from './lib/missionSainikPlanRule'
import { settersOfRow } from './lib/missionSainikAllot'
import { findNear } from './lib/missionSainikSimilar'
import { parseQuestions, fetchAll } from './lib/missionSainikQuestions'
import { detectQuestions } from './lib/detectQuestions'
import { usedQuestions, pickSummary, contributors, flavours, flavourItems, flavourStatus } from './lib/missionSainikPick'
import { makeVersion, paperHealth, csvToQuestionText, CSV_TEMPLATE, omrHtml, wordWrap, mergePaperConfig, orderedSections, FONT_STACKS } from './lib/missionSainikPaper'
import PaperPreview from './PaperPreview'
import MissionSainikStaffBoard from './MissionSainikStaffBoard'
import { TESTS, MOCK_TESTS, SUBJECTS, PANEL, PRACTICE_PANEL, MOCK_SECTIONS, fullName, nameMatches, matchesOne, staffMatching } from './missionSainikData'

const TABLE = 'mission_sainik_questions'
const line = PX.line || '#eef1f6'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Which panel subjects may upload each Mega Mock section.
const MEGA_PANEL = { Mathematics: ['maths'], Intelligence: ['reasoning'], 'Grammar + Vocabulary': ['grammar', 'vocab'], 'Science + GK': ['science', 'gk'] }

const normQ = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
// The first word of a name that is not a title ("Sir Kabiraj Singh" -> "Kabiraj"), so that every teacher's "Sir" does not match every other teacher's.
const realFirst = n => String(n || '').split(/\s+/).find(w => w && !/^(sir|miss|mr|mrs|ms|dr)\.?$/i.test(w)) || ''
const SUBJ_HUE = { maths: '#1d4f91', reasoning: '#6d28d9', science: '#0f7a4c', gk: '#c2410c', grammar: '#be185d', vocab: '#0e7490' }
const SUBJ = Object.fromEntries(SUBJECTS.map(x => [x.key, x]))
const DAILY_SECTIONS = [['maths', 20, 3], ['reasoning', 10, 2], ['grammar', 10, 2], ['gk', 10, 2]]
  .map(([k, q, marks]) => ({ label: SUBJ[k].label, short: SUBJ[k].short, q, marks, key: k }))
const CFG = {
  daily: {
    name: 'Daily Class Test', prefix: 'T', tests: TESTS.map(t => ({ no: t.no, date: t.date })), noun: 'Test',
    sections: DAILY_SECTIONS, duration: 'as notified', panel: 'practice',
  },
  practice: {
    name: 'Practice Maker', paper: 'Practice Set', prefix: 'PB', noun: 'Test', perTest: true, restart: true, noMarks: true, panel: 'practice',
    tests: TESTS.map(t => ({ no: t.no, date: null, plan: t.date })),   // one practice set for EVERY Pre Mock test, on that test's planned chapter (no embargo: `plan` is only shown)
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

export default function MissionSainikBuilder({ syllabus = null, practiceQ = null, staffNames = [], onSetting = null, series, tasks, saveTask, currentUser, setMsg, isMobile, institute, embargo = false, audit = () => {}, today = '', panel = null, startTest, startSection, locks = {}, onLock }) {
  // Practice bank: the admin sets how many questions each teacher sets per practice set, per subject (Panel → Practice panel).
  const cfg0 = CFG[series]
  const cfg = useMemo(() => (series === 'practice' && practiceQ ? { ...cfg0, sections: cfg0.sections.map(x => ({ ...x, q: Number(practiceQ[x.key]) || x.q })) } : cfg0), [series, practiceQ]) // eslint-disable-line react-hooks/exhaustive-deps
  // Printed name of the paper: practice sets are "Practice Set PB-NN", never "… Test", so they can't be mistaken for a Pre Mock test.
  const paperName = cfg.paper || `${cfg.name} Test`
  const runHead = `${paperName.toUpperCase()}${cfg.paper ? '' : ' (MODEL SET)'}  ●●  MISSION SAINIK 2027`
  const isPractice = series === 'practice'   // practice bank: every teacher sets their OWN set of questions for the same practice test; students get the different versions
  // Several sets on the same syllabus: every teacher writes their OWN full set; students get Version A, B, C. Always on for the practice bank; an admin switch for the Pre Mock series.
  const byVersion = isPractice || (series === 'pre' && locks?.pre_versions === 'on')
  const isAdmin = isAdminRole(currentUser?.role)
  const isMe = n => matchesOne(currentUser?.matchName || currentUser?.name, n, staffNames)   // a panel name counts only when it points at exactly one staff member
  const [qs, setQs] = useState([])
  const [setup, setSetup] = useState(false)
  const [testNo, setTestNo] = useState(() => startTest || (cfg.tests.find(t => (t.date || t.plan) && today && (t.date || t.plan) >= today)?.no ?? (today && cfg.tests.some(t => t.date || t.plan) ? cfg.tests[cfg.tests.length - 1].no : 1)))   // opens on the present test: the next one not yet held
  const [showAll, setShowAll] = useState(false)
  const [showNotes, setShowNotes] = useState(false)   // review notes stay folded unless there are open notes
  const [lim, setLim] = useState({ k: '', n: 10 })   // questions listed before "Show more"   // false: only the present test is listed; true: every test
  const [sectionSel, setSection] = useState(startSection || cfg.sections[0].label)
  const [text, setText] = useState('')
  // The pasted text is kept on this device per test and section, so a reload (pull-down on a phone, a dropped connection) loses nothing
  const textKey = `msb-text:${series}:${testNo}:${sectionSel}`
  useEffect(() => { try { setText(localStorage.getItem(textKey) || '') } catch { setText('') } }, [textKey])
  useEffect(() => {
    const t = setTimeout(() => { try { text ? localStorage.setItem(textKey, text) : localStorage.removeItem(textKey) } catch { /* storage unavailable */ } }, 500)
    return () => clearTimeout(t)
  }, [text, textKey])
  useEffect(() => {   // warn before leaving with pasted questions that are not uploaded yet
    if (!text.trim()) return undefined
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [text])
  const [addMode, setAddMode] = useState(isMobile ? 'one' : 'cards')   // one (a question at a time, saved as you go) | cards | paste
  const [editorInView, setEditorInView] = useState(false)   // the floating "Add questions" button is hidden while the editor itself is on screen
  const [cards, setCards] = useState(() => [blankCard()])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState('')
  const [signoffs, setSignoffs] = useState([])
  const [bin, setBin] = useState(null)   // deleted questions: loaded only when the recycle bin is opened (null = not loaded yet)
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [editQ, setEditQ] = useState(null)   // question being edited (draft copy)
  const [scanEdit, setScanEdit] = useState(false)
  const [studio, setStudio] = useState(null)   // id of the question open in the full-screen editor
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
    setMsg(error ? '✅ Saved on this device. Run migration 20261212 to share these settings with everyone.' : '✅ Paper settings saved for everyone')
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
    const bc = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('series', series).not('deleted_at', 'is', null)   // just the number; the rows load when the bin is opened
    setBinCount(bc.error ? 0 : bc.count || 0)
  }, [series])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!showBin) return undefined
    let live = true
    ;(async () => {
      const b = await fetchAll(() => supabase.from(TABLE).select('*').eq('series', series).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }))
      if (live) setBin(b.error ? [] : b.data || [])
    })()
    return () => { live = false }
  }, [showBin, binCount, series])

  const bySec = useMemo(() => {
    const m = {}; qs.forEach(q => { (m[q.test_no + '|' + q.section] = m[q.test_no + '|' + q.section] || []).push(q) }); return m
  }, [qs])
  const get = (t, s) => bySec[t + '|' + s] || []
  // The syllabus plan (Mission Sainik → Syllabus): the chapter(s) planned for this test and section. Pre Mock and Daily tests follow it.
  const chaptersOf = (t, label) => ((series === 'pre' || series === 'daily' || series === 'practice') && syllabus ? String(syllabus[t + '|' + label] || '').split(';').map(x => x.trim()).filter(Boolean) : [])
  // Pre Mock follows the Syllabus Plan for each test only, and holds exactly the section's 25 questions; extras go to the Practice bank.
  const chapterRule = series === 'pre' || series === 'practice'   // questions must be on the chapter the Syllabus Plan gives that test
  const strictPlan = series === 'pre'                                // Pre Mock only: the paper holds exactly 25 per section; extras go to that test's practice set
  const [chapterPick, setChapterPick] = useState('')
  const avail = (t, s) => !s.sets || t <= s.sets                       // practice: not every subject has a 3rd set
  const live = t => cfg.sections.filter(s => avail(t, s))
  const section = (live(testNo).find(s => s.label === sectionSel) || live(testNo)[0]).label   // falls back when a set lacks this subject
  const testReady = t => live(t).every(s => (byVersion ? flavourStatus(setRows(t, s.label), s.q) === 'ok' : get(t, s.label).length >= s.q))
  const testCount = t => live(t).reduce((a, s) => a + Math.min(get(t, s.label).length, s.q), 0)
  const totalQ = t => live(t).reduce((a, s) => a + s.q, 0)

  const mineAt = (t, s) => !isAdmin && settersOf(t, s.label).some(isMe)
  // Who may upload to a section: its setter (Pre Mock: the allotted setter; Mega Mock: the panel of its subjects) or an admin.
  const practicePanelOf = s => { const key = cfg.sections.find(x => x.label === s)?.key; if (panel?.practice?.[key]?.length) return panel.practice[key]; const p = PRACTICE_PANEL[key]; return p ? [p.verifier, ...p.assistants] : [] }   // setters + verifier
  const settersOf = (t, s) => cfg.panel === 'practice'
    ? (() => { const key = cfg.sections.find(x => x.label === s)?.key; if (panel?.practiceSetters?.[key]?.length) return panel.practiceSetters[key]; return PRACTICE_PANEL[key]?.assistants || [] })()   // only the practice SETTERS upload; the verifier does not
    : series === 'pre'
    ? (tasks || []).filter(r => r.kind === 'test' && r.test_no === t && r.subject === s).flatMap(r => [r.setter, ...String(r.co_setters || '').split(';').map(x => x.trim())].filter(Boolean))
    : (MEGA_PANEL[s] || []).flatMap(k => (panel?.setters?.[k] ?? PANEL[k]) || [])
  const isLocked = t => locks?.[`lock:${series}:${t}`] === 'on'
  const canEdit = (t, s) => isAdmin || (!isLocked(t) && settersOf(t, s).some(isMe))
  // Pre Mock, Mock (Mega) and Practice: ONLY the section's own setter can add questions. Admins can still verify, edit, delete, lock and choose; they cannot upload.
  const setterOnly = series === 'pre' || series === 'mega' || series === 'practice'
  // Where each teacher writes their OWN set (Practice, and Pre Mock with several sets) only the author — or an admin — may change or delete a question.
  const canModify = q => isAdmin || (canEdit(q.test_no, q.section) && (!byVersion || q.uploaded_by === (currentUser?.name || '')))
  const canUpload = (t, s) => (setterOnly ? !isLocked(t) && settersOf(t, s).some(isMe) : canEdit(t, s))
  // Embargo (admin setting): until the test date only the section's setter and admins can read questions / answers or print.
  const dateOf = t => cfg.tests.find(x => x.no === t)?.date
  const planDate = t => cfg.tests.find(x => x.no === t)?.plan   // Practice: the date of the Pre Mock test it prepares for (shown only)
  const embargoed = (t, s) => !!embargo && !!dateOf(t) && !!today && today < dateOf(t) && !canEdit(t, s)
  const signoff = (t, s) => signoffs.find(x => x.test_no === t && x.section === s)
  // Verifier: a different person from the uploader (admins may always verify).
  // Practice: only the practice setters' own sets decide whether a test is complete. A Pre Mock setter's overflow questions sit in the same
  // practice test, but must not make it look unfinished (they are not a set of their own). Without any setter's questions, show what exists.
  const setRows = (t, s) => { const all = get(t, s); if (series !== 'practice') return all; const own = all.filter(q => settersOf(t, s).some(n => matchesOne(q.uploaded_by, n, staffNames))); return own.length ? own : all }
  const verifiersOf = (t, s) => cfg.panel === 'practice' ? practicePanelOf(s) : series === 'mega' ? settersOf(t, s)
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
    const byMe = q => nameMatches(q.uploaded_by, realFirst(currentUser?.matchName || currentUser?.name)) || q.uploaded_by === currentUser?.name
    // Pre Mock and Practice: nobody who wrote any of the section may verify it. Elsewhere it is enough that the section is not ALL their own.
    const mine = chapterRule ? list.some(byMe) : list.every(byMe)
    return verifiersOf(t, s).some(isMe) && !mine
  }
  const clearSignoff = async (t, s) => { if (signoff(t, s)) { await supabase.from('mission_sainik_signoffs').delete().eq('series', series).eq('test_no', t).eq('section', s); setSignoffs(a => a.filter(x => !(x.test_no === t && x.section === s))) } }
  const verify = async (t, s) => {
    if (!canVerify(t, s)) return setMsg('❌ A different panel member (not the uploader) must verify.')
    if (chapterRule) {
      const pl = chaptersOf(t, s)
      if (planState(pl) === 'multi') return setMsg(`❌ ${tid(t)} · ${s} lists ${pl.length} chapters in the Syllabus Plan; keep just one before verifying.`)
      const off = offPlan(get(t, s), pl)
      if (off.length) return setMsg(`❌ ${off.length} question${off.length === 1 ? ' is' : 's are'} not on the planned chapter “${pl[0]}”. Fix or delete ${off.length === 1 ? 'it' : 'them'} before verifying.`)
    }
    const n = get(t, s).length
    const { error } = await supabase.from('mission_sainik_signoffs').upsert({ series, test_no: t, section: s, verified_by: currentUser?.name || '', verified_at: new Date().toISOString() }, { onConflict: 'series,test_no,section' })
    if (error) return setMsg('❌ ' + error.message)
    audit('verify_section', `${series}:${t}:${s}`, { questions: n }); setMsg('✅ Section verified'); load()
  }

  const tid = n => (cfg.noun === 'Set' ? `Set ${n}` : `${cfg.prefix}-${String(n).padStart(2, '0')}`)
  const parsedBase = useMemo(() => parseQuestions(addMode === 'cards' ? cardsToText(cards) : text), [text, cards, addMode])
  // Question cards can carry a picture (figure / passage questions); parsed questions line up with the filled cards in order.
  const parsed = useMemo(() => {
    if (addMode !== 'cards') return parsedBase
    const filled = cards.filter(c => !isEmptyCard(c))
    const problems = cardsProblems(cards)
    return { ...parsedBase, errors: problems && !parsedBase.errors.length ? [`${problems} question card(s) incomplete — see the red notes`] : parsedBase.errors, questions: parsedBase.questions.map((q, i) => (filled[i]?.image && filled[i].type !== 'normal' ? { ...q, image_data: filled[i].image } : q)) }
  }, [parsedBase, cards, addMode])
  // Saves questions that are already parsed (from the paste box, the cards, or one question at a time): duplicates, count warning, insert, sign-off reset, auto-submit.
  const uploadDeniedMsg = (t, sc) => {
    if (setterOnly) {
      const who = [...new Set(settersOf(t, sc).map(fullName))]
      return isLocked(t) && who.length ? '❌ This paper is locked by an admin.' : who.length ? `❌ Only the section setter can upload here: ${who.join(' / ')}.${isAdmin ? ' As an admin you can verify, edit or delete.' : ''}` : '❌ No setter is allotted to this section yet. An admin must allot one first (Panel).'
    }
    return '❌ Only the section setter or an admin can upload here.'
  }
  // Pre Mock <-> Practice of the SAME test and section: a practice set that repeats the paper would give the paper away.
  const otherSeriesTexts = async (t, sc) => {
    const other = series === 'pre' ? 'practice' : series === 'practice' ? 'pre' : null
    if (!other) return { rows: [], texts: new Set() }
    const { data } = await supabase.from(TABLE).select('question,option_a,option_b,option_c,option_d,answer').eq('series', other).eq('test_no', t).eq('section', sc).is('deleted_at', null)
    return { rows: data || [], texts: new Set((data || []).map(x => normQ(x.question))) }
  }
  const otherName = series === 'pre' ? 'practice set' : 'Pre Mock paper'
  const insertQuestions = async (list, { clear = false } = {}) => {
    if (!canUpload(testNo, section)) { setMsg(uploadDeniedMsg(testNo, section)); return false }
    const ownOf = l => (byVersion ? l.filter(x => x.uploaded_by === (currentUser?.name || '')) : l)   // several sets: each teacher's own set
    const have = ownOf(get(testNo, section)).length
    if (list.length > 200) { setMsg('❌ Upload at most 200 questions at a time.'); return false }
    const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim()
    const seen = new Set(ownOf(get(testNo, section)).map(q => norm(q.question)))
    const dupes = list.filter((q, i) => seen.has(norm(q.question)) || list.findIndex(z => norm(z.question) === norm(q.question)) !== i)
    if (dupes.length) { setMsg(`❌ ${dupes.length} duplicate question(s) already in this section, e.g. “${dupes[0].question.slice(0, 50)}”.${list.length > 1 ? ' Remove them and upload again.' : ''}`); return false }
    const other = chapterRule ? await otherSeriesTexts(testNo, section) : { rows: [], texts: new Set() }
    if (chapterRule) {
      const clash = list.filter(q => other.texts.has(normQ(q.question)))
      if (clash.length) { setMsg(`❌ ${clash.length} question${clash.length === 1 ? ' is' : 's are'} already in the ${otherName} for ${tid(testNo)} · ${section}, e.g. “${clash[0].question.slice(0, 50)}”. The practice set must not repeat the paper.`); return false }
    }
    // The same question REWORDED (same options and answer, similar wording) in this section or in the matching practice set / paper: ask first.
    const near = findNear(list, [...ownOf(get(testNo, section)), ...other.rows])
    if (near.length && !window.confirm(`${near.length} of these ${near.length === 1 ? 'looks' : 'look'} like ${near.length === 1 ? 'a question' : 'questions'} already set for ${tid(testNo)} · ${section} (${near[0].why}):\n\n“${near[0].q.question.slice(0, 70)}”\n≈ “${String(near[0].like.question).slice(0, 70)}”\n\nUpload anyway?`)) return false
    const chs = chaptersOf(testNo, section), defTopic = chs.includes(chapterPick) ? chapterPick : chs.length === 1 ? chs[0] : ''   // a question without a topic gets the planned chapter
    let paperList = list.map(q => ({ ...q, topic: q.topic || defTopic || q.topic })), extra = []
    if (chapterRule && planState(chs) === 'multi') { setMsg(`❌ ${tid(testNo)} · ${section} has ${chs.length} chapters in the Syllabus Plan. Every teacher must set the one same chapter, so an admin must keep just one (Mission Sainik → Syllabus).`); return false }
    if (chapterRule) {
      const r = routePreMock({ list, chapters: chs, defTopic, room: strictPlan ? sec.q - have : Infinity })   // Practice has no 25-cap: only the chapter rule
      if (r.error) { setMsg(`❌ ${tid(testNo)} · ${section} follows the Syllabus Plan: ${r.planned.join(' / ')}. ${r.bad[0].topic ? `“${r.bad[0].topic}” is not planned for this test.` : 'Choose the chapter first.'}${r.bad.length > 1 ? ` (${r.bad.length} questions)` : ''}`); return false }
      paperList = r.paper; extra = r.extra
      if (strictPlan && extra.length) {   // the practice set for this test holds one set: a Pre Mock setter can send at most that many extras
        const cap = Number(practiceQ?.[cfg.sections.find(x => x.label === section)?.key]) || 25
        const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('series', 'practice').eq('test_no', testNo).eq('section', section).eq('uploaded_by', currentUser?.name || '').is('deleted_at', null)
        if ((count || 0) + extra.length > cap) { setMsg(`❌ The practice set for ${tid(testNo)} · ${section} takes at most ${cap} questions from you and already has ${count || 0}. ${extra.length} extra do not fit${cap - (count || 0) > 0 ? ` (room for ${cap - (count || 0)})` : ''}. The practice teachers add the rest.`); return false }
      }
      if (extra.length && list.length > 1 && !window.confirm(`${tid(testNo)} · ${section} has room for ${paperList.length} more (limit ${sec.q}).\n\nThe other ${extra.length} will be saved to the practice set for ${tid(testNo)} (${section}), on the same chapter.\n\nContinue?`)) return false
      if (!strictPlan && have + list.length > sec.q && !window.confirm(`${section} needs ${sec.q} questions; this makes ${have + list.length}. Upload anyway?`)) return false
    } else if (have + list.length > sec.q && !window.confirm(`${section} needs ${sec.q} questions; this makes ${have + list.length}. Upload anyway?`)) return false
    setBusy(true)
    const rows = paperList.map(q => ({ ...q, series, test_no: testNo, section, uploaded_by: currentUser?.name || '' }))
    const xrows = extra.map(q => ({ ...q, series: 'practice', test_no: testNo, section, uploaded_by: currentUser?.name || '' }))
    const { data: inserted, error } = await supabase.from(TABLE).insert([...rows, ...xrows]).select()
    setBusy(false)
    if (error) { setMsg('❌ ' + error.message + (/passage|image_data/.test(error.message) ? ' (run migration 20261211 for passages and figures)' : '')); return false }
    if (clear) { setText(''); setCards([blankCard()]) }
    const xTxt = xrows.length ? `${xrows.length === 1 ? '1 question' : xrows.length + ' questions'} saved to the practice set for ${tid(testNo)} (${section}${xrows[0].topic ? ' · ' + xrows[0].topic : ''})` : ''
    setMsg(rows.length ? `✅ ${rows.length === 1 ? 'Question' : rows.length + ' questions'} added to ${tid(testNo)} · ${section} · ${Math.min(have + rows.length, sec.q)} of ${sec.q}${xTxt ? ' — ' + xTxt : ''}` : `✅ ${tid(testNo)} · ${section} is full (${sec.q}). ${xTxt}`)
    audit('upload_questions', `${series}:${testNo}:${section}`, { count: rows.length, ...(xrows.length ? { to_practice: xrows.length, practice_test: testNo } : {}) })
    await clearSignoff(testNo, section)
    // Add just the new rows to the screen. Re-downloading the whole question bank after every save is slow once thousands of questions exist.
    if (Array.isArray(inserted) && inserted.length === rows.length + xrows.length) { const mine = inserted.filter(r => r.series === series); if (mine.length) setQs(prev => [...prev, ...mine]) } else await load()
    // Pre Mock: when the section is complete, mark the allotted task as submitted automatically.
    if (series === 'pre' && (byVersion ? flavourStatus([...get(testNo, section), ...rows], sec.q) === 'ok' : have + rows.length >= sec.q)) {
      const task = (tasks || []).find(r => r.kind === 'test' && r.test_no === testNo && r.subject === section)
      if (task && task.status === 'Pending' && saveTask) await saveTask(task, { status: 'Submitted', question_count: have + rows.length })
    }
    // Practice: a practice teacher sets questions for EVERY test. When their full quota is in for all of them, hand in their practice task automatically.
    if (series === 'practice' && saveTask) {
      const me = currentUser?.name || '', pool = [...qs, ...(Array.isArray(inserted) ? inserted.filter(r => r.series === series) : rows)]
      const own = t => pool.filter(x => x.test_no === t && x.section === section && x.uploaded_by === me).length
      if (cfg.tests.every(t => own(t.no) >= sec.q)) {
        const task = (tasks || []).find(r => r.kind === 'practice' && r.subject === section && settersOfRow(r).some(isMe))
        if (task && task.status === 'Pending') await saveTask(task, { status: 'Submitted', question_count: pool.filter(x => x.section === section && x.uploaded_by === me).length })
      }
    }
    return true
  }
  const upload = async () => {
    if (!canUpload(testNo, section)) return setMsg(uploadDeniedMsg(testNo, section))
    if (parsed.errors.length) return setMsg('❌ ' + parsed.errors.slice(0, 3).join(' · '))
    if (!parsed.questions.length) return setMsg('❌ No questions found — check the format.')
    await insertQuestions(parsed.questions, { clear: true })
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
    if (!canModify(q)) return setMsg('❌ Only the teacher who set this question (or an admin) can delete it.')
    if (!window.confirm('Delete this question?' + (soft ? ' (it goes to the recycle bin)' : ' This cannot be undone.'))) return
    await removeRows(x => x.eq('id', q.id), `${series}:${q.test_no}:${q.section}`, 1)
  }
  // Questions with NO chapter get the section's one planned chapter in a single step. Questions on a different chapter are never changed: someone must look at those.
  const tagUntagged = async () => {
    const pl = chaptersOf(testNo, section), ids = get(testNo, section).filter(q => !String(q.topic || '').trim()).map(q => q.id)
    if (pl.length !== 1 || !ids.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Tag ${ids.length} question${ids.length === 1 ? '' : 's'} with no chapter as “${pl[0]}”?\n\nQuestions already on another chapter are not changed. Verification is reset.`)) return
    const { error } = await supabase.from(TABLE).update({ topic: pl[0] }).in('id', ids)
    if (error) return setMsg('❌ ' + error.message)
    audit('tag_chapter', `${series}:${testNo}:${section}`, { count: ids.length, chapter: pl[0], ids: ids.slice(0, 500) })   // ids, so it can be undone
    await clearSignoff(testNo, section); setMsg(`✅ ${ids.length} question${ids.length === 1 ? '' : 's'} tagged “${pl[0]}”`); load()
  }
  const clearSection = async () => {
    const list = get(testNo, section)
    if (!list.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Delete all ${list.length} questions of ${section} for ${tid(testNo)}?`)) return
    await removeRows(x => x.eq('series', series).eq('test_no', testNo).eq('section', section).is('deleted_at', null), `${series}:${testNo}:${section}`, list.length)
  }
  const saveEdit = async () => {
    const d = editQ
    if (!canModify(d)) return setMsg('❌ Only the teacher who set this question (or an admin) can edit it.')
    if (!d.question.trim() || !d.option_a.trim() || !d.option_b.trim() || !d.option_c.trim() || !d.option_d.trim()) return setMsg('❌ The question and all four options are required.')
    if (!['A', 'B', 'C', 'D'].includes(d.answer)) return setMsg('❌ Choose the correct answer.')
    const norm = x => x.toLowerCase().replace(/\s+/g, ' ').trim()
    if (get(d.test_no, d.section).some(q => q.id !== d.id && norm(q.question) === norm(d.question))) return setMsg('❌ Another question in this section has the same text.')
    const planned = chapterRule ? chaptersOf(d.test_no, d.section) : []
    if (planned.length && d.topic?.trim() && !matchChapter(planned, d.topic)) return setMsg(`❌ “${d.topic.trim()}” is not planned for this test. Use: ${planned.join(' / ')}`)
    const patch = { question: d.question.trim(), option_a: d.option_a.trim(), option_b: d.option_b.trim(), option_c: d.option_c.trim(), option_d: d.option_d.trim(), answer: d.answer, explanation: d.explanation?.trim() || null, topic: (planned.length && matchChapter(planned, d.topic)) || d.topic?.trim() || null, difficulty: d.difficulty || null }
    if ('passage' in d) patch.passage = d.passage?.trim() || null
    if ('image_data' in d) patch.image_data = d.image_data || null
    const { error } = await supabase.from(TABLE).update(patch).eq('id', d.id)
    if (error) return setMsg('❌ ' + error.message)
    audit('edit_question', `${series}:${d.test_no}:${d.section}`, { id: d.id })
    await clearSignoff(d.test_no, d.section); setEditQ(null); setMsg('✅ Question updated (verification reset)'); load()
  }
  // Save one question from the full-screen editor (same rules as the old inline form).
  const saveQuestionPatch = async (q, patch) => {
    if (!canModify(q)) { setMsg('❌ Only the teacher who set this question (or an admin) can edit it.'); return false }
    const planned = chapterRule && 'topic' in patch ? chaptersOf(q.test_no, q.section) : []
    if (planned.length && patch.topic && !matchChapter(planned, patch.topic)) { setMsg(`❌ “${patch.topic}” is not planned for this test. Use: ${planned.join(' / ')}`); return false }
    if (planned.length && patch.topic) patch = { ...patch, topic: matchChapter(planned, patch.topic) }
    const { error } = await supabase.from(TABLE).update(patch).eq('id', q.id)
    if (error) { setMsg('❌ ' + error.message + (/passage|image_data/.test(error.message) ? ' (run migration 20261211 for passages and figures)' : '')); return false }
    audit('edit_question', `${series}:${q.test_no}:${q.section}`, { id: q.id })
    await clearSignoff(q.test_no, q.section); setMsg('✅ Question saved (verification reset)'); await load(); return true
  }
  const restore = async q => {
    if (!canModify(q)) return setMsg('❌ Only the teacher who set this question (or an admin) can restore it.')
    if (strictPlan) {   // Pre Mock: a restored question counts toward the 25 again
      const cap = cfg.sections.find(x => x.label === q.section)?.q || 25
      const live = get(q.test_no, q.section).filter(x => !byVersion || x.uploaded_by === q.uploaded_by).length
      if (live >= cap) return setMsg(`❌ ${tid(q.test_no)} · ${q.section} already holds ${cap}. Delete another question first, or leave this one in the bin.`)
    }
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
    const r = new FileReader()
    r.onload = () => {
      const t = isCsv ? csvToQuestionText(String(r.result || '')) : String(r.result || '')
      setText(t)
      const det = detectQuestions(t)   // tell the teacher straight away whether the file really holds questions
      setMsg(det.questions ? '✅ ' + det.text : '⚠ ' + (det.kind === 'empty' ? 'The file is empty.' : det.text + ' Nothing to upload from this file.'))
    }
    r.readAsText(f); e.target.value = ''
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
    // Practice bank: Version A is the first teacher's own set, B the second's … Other series: the admin's chosen questions (or the first q).
    let items = byVersion ? flavourItems(setRows(t, sc.label), sc.q, setIdx) : usedQuestions(get(t, sc.label), sc.q)
    if (ver.shuffleQ || ver.shuffleOpts) items = makeVersion(items, { seed: `${series}|${t}|${sc.label}|${SET_LETTERS[setIdx]}`, shuffleQ: ver.shuffleQ, shuffleOpts: ver.shuffleOpts })
    return { ...sc, from: startOf(sc.label), items: items.map((q, i) => ({ ...q, no: startOf(sc.label) + i })) }
  })
  const blocked = t => embargo && !isAdmin && dateOf(t) && today < dateOf(t)
  const F = FONT_STACKS[pc.font][1]
  // A CSS string literal (for @page margin boxes) and the page footer: the institute's footer line, then the page number.
  const cssStr = v => String(v ?? '').replace(/[\\"]/g, m => '\\' + m).replace(/[\r\n]+/g, ' ')
  const footStr = (pc.brand?.footer?.trim() ? `"${cssStr(pc.brand.footer.trim())}   ·   P-"` : '"P-"') + ' counter(page)'
  const docCss = `@page{size:A4;margin:14mm 14mm 16mm;@bottom-center{content:${footStr};font:600 8pt ${F};color:#333}}body{font-family:${F};color:#111827;font-size:${(pc.size * 1.2).toFixed(1)}px;line-height:${pc.line + 0.15}}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:6px;margin-bottom:8px}.lh h1{margin:0;font-size:19px;color:#132a4f}.lh div{font-size:11.5px;color:#555}
.meta{display:flex;justify-content:space-between;font-weight:700;margin:6px 0 8px}.note{font-size:11.5px;color:#444;margin-bottom:6px}
.sec{background:#eef1f6;border:1px solid #c9d1de;padding:4px 8px;font-weight:700;margin:10px 0 6px}
.q{margin:0 0 7px;page-break-inside:avoid}.o{display:grid;grid-template-columns:1fr 1fr;gap:1px 14px;margin-left:18px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eef1f6}
.conf{margin-top:10px;font-size:10.5px;color:#a00;text-align:center}.pb{page-break-after:always}`
  // One document body for one version (Set A/B/…) — paper or answer key.
  // "Exam book" layout (modelled on printed Sainik School papers): two columns, small-caps section boxes, bold numbers,
  // italic (a)(b)(c)(d) options laid out 4-up / 2-up / stacked by length, running header and page badge.
  const bookCss = `@page{size:A4;margin:16mm 12mm 14mm 12mm;@top-center{content:"${cssStr(runHead)}";font:700 8.5pt ${F};color:#222;vertical-align:bottom;padding-bottom:2mm}
@bottom-center{content:${footStr};font:700 8.5pt ${F};color:#222}}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:${F};color:#111;font-size:${pc.size}pt;line-height:${pc.line};margin:0}
.banner{background:#d9dbe0;border-radius:2pt;padding:7mm 8mm;display:flex;align-items:center;gap:7mm;margin:0 0 4mm}
.badge{width:20mm;height:20mm;border:2.2pt solid #111;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.badge b{font:800 24pt ${F};line-height:1}.badge i{font:700 5.5pt ${F};font-style:normal;letter-spacing:.06em;margin-top:1pt}
.banner h1{margin:0;font:800 19pt ${F};font-variant:small-caps;letter-spacing:.02em;line-height:1.1}.banner div.s{font:600 9pt ${F};margin-top:2mm;color:#333}
.cols{column-count:${pc.columns};column-gap:9mm;column-rule:${pc.rule && pc.columns > 1 ? '.7pt solid #333' : 'none'}}
.sec{break-inside:avoid;break-after:avoid;border:1pt solid #111;background:#e4e5e9;text-align:center;font-variant:small-caps;font-weight:800;font-size:10.5pt;letter-spacing:.03em;padding:2pt 4pt;margin:3mm 0 2.5mm}
.ins{font-style:italic;font-weight:700;margin:1mm 0}.q{break-inside:avoid;margin:0 0 2.4mm;padding-left:7mm;text-indent:-7mm;orphans:3;widows:3;hyphens:none}
.q>b{display:inline-block;width:7mm;text-indent:0}.q .t{display:inline}.o{display:block;margin:.6mm 0 0 0;text-indent:0;padding-left:7mm;font-style:normal}.o span{padding-left:5.5mm;text-indent:-5.5mm}.o span i{font-style:normal;font-weight:700}
.o.four{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4mm 2mm}.o.four span{white-space:nowrap}.o.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4mm 3mm}.o span{display:block}.o.one span{display:block}
.key{width:100%;border-collapse:collapse;font-size:9.5pt}.key td,.key th{border:.6pt solid #666;padding:1.5pt 4pt;text-align:left;vertical-align:top}.key th{background:#e4e5e9}
.pass{text-align:justify;margin:0 0 2mm;text-indent:4mm}.fig{text-align:center;margin:1.5mm 0 1mm;text-indent:0;padding-left:0}.fig img{max-width:100%;max-height:48mm}
.sol{padding-left:7mm;text-indent:-7mm;margin:0 0 1.6mm;break-inside:avoid}.sol>b:first-child{display:inline-block;width:7mm;text-indent:0}.sol .m{font-size:8.5pt;color:#555;font-style:italic}
.conf{margin-top:3mm;font-size:8.5pt;color:#a00;text-align:center;break-inside:avoid}.meta{font-weight:700;font-size:9.5pt;display:flex;justify-content:space-between;margin:0 0 2mm}.note{font-size:9.5pt;font-style:italic;margin-bottom:2mm}`
  // ── Branding: logo, name, tagline, cover page, watermark, footer ──
  const brand = pc.brand || {}
  const instName = brand.name?.trim() || institute?.name || 'Guidance Navodaya & Sainik Institute'
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent || '') ? brand.accent : '#132a4f'
  const logoImg = brand.logo && /^data:image\//.test(brand.logo) ? `<img class="logo" src="${brand.logo}" alt="">` : ''
  const brandCss = `${MATH_CSS}.logo{max-height:18mm;max-width:34mm;object-fit:contain;flex:none}.bn-t{font:600 8.5pt ${F};color:#444;margin-top:1mm}
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
    const id = `${cfg.prefix}-${String(t).padStart(2, '0')}${series === 'practice' ? ` (for PMT-${String(t).padStart(2, '0')})` : ''}`
    const date = cfg.tests.find(x => x.no === t)?.date
    const setTag = ver.sets > 1 ? ` · Set ${SET_LETTERS[setIdx]}` : ''
    const marks = secs.reduce((a, x) => a + x.q * x.marks, 0)
    const lines = String(brand.instructions || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    return `<div class="cover">${logoImg}<h1>${esc(instName)}</h1>${brand.tagline ? `<div class="tag">${esc(brand.tagline)}</div>` : '<div class="tag">&nbsp;</div>'}
<h2>${esc(paperName)} — ${esc(id)}${esc(setTag)}</h2><div class="facts">${[date ? fmtShort(date) : '', cfg.noMarks ? '' : `${printTotal(t)} questions`, cfg.noMarks ? '' : `${marks} marks`, cfg.noMarks ? '' : cfg.duration].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
<table><tr><td>Candidate's name: <span></span></td><td>Roll / GCC no.: <span></span></td></tr><tr><td>Batch: <span></span></td><td>Signature: <span></span></td></tr></table>
${lines.length ? `<ol>${lines.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}<div class="dn">DO NOT OPEN UNTIL TOLD TO DO SO</div></div>`
  }
  const optLayout = q => {
    const o = (q.opts || ['A', 'B', 'C', 'D'].map(k => ({ k, text: q['option_' + k.toLowerCase()] }))).map(x => ({ k: x.k.toLowerCase(), text: String(x.text ?? '') }))
    const len = Math.max(...o.map(x => mathPlain(x.text).length))
    const wide = pc.columns === 1 || ver.layout !== 'book'   // a one-column page has about twice the room per option
    const cls = pc.optStyle === 'two' ? 'two' : pc.optStyle === 'one' ? 'one' : len <= (wide ? 20 : 8) ? 'four' : len <= (wide ? 42 : 19) ? 'two' : 'one'
    return `<div class="o ${cls}">${o.map(x => `<span><i>(${x.k})</i> ${mathToHtml(x.text)}</span>`).join('')}</div>`
  }
  // Passage header for the first question of a run that shares a passage, plus the figure under a stem.
  const passageHtml = (items, i) => {
    const q = items[i]; if (!q.passage || (i > 0 && items[i - 1].passage === q.passage)) return ''
    let j = i; while (j + 1 < items.length && items[j + 1].passage === q.passage) j++
    return `<div class="ins">Read the following passage and answer the questions (Q. ${q.no}${j > i ? '–' + items[j].no : ''}):</div><div class="pass">${esc(q.passage)}</div>`
  }
  const figHtml = q => (q.image_data && /^data:image\//.test(q.image_data) ? `<div class="fig"><img src="${q.image_data}" alt="Figure"></div>` : '')
  // Shown at the TOP of an incomplete paper, naming each section that has no (or too few) questions yet.
  const draftTop = secs => {
    const short = secs.filter(x => x.items.length < x.q)
    if (!short.length) return ''
    return `<div class="draft">INCOMPLETE PAPER — ${short.map(x => `${esc(x.title || x.label)}: ${x.items.length ? `${x.items.length} of ${x.q}` : 'no'} questions`).join(' · ')}. Shown here only: the printed paper leaves these sections out.</div>`
  }
  const bookBody = (t, key, setIdx, first) => {
    const secs = assemble(t, setIdx); const count = secs.reduce((a, x) => a + x.items.length, 0)
    const allVerified = live(t).every(x => signoff(t, x.label))
    const id = `${cfg.prefix}-${String(t).padStart(2, '0')}${series === 'practice' ? ` (for PMT-${String(t).padStart(2, '0')})` : ''}`
    const setTag = ver.sets > 1 ? ` · Set ${SET_LETTERS[setIdx]}` : ''
    const date = cfg.tests.find(x => x.no === t)?.date
    const letter = i => String.fromCharCode(65 + i)
    const banner = `<div class="banner">${logoImg}<div class="badge"><b>${cfg.noun === 'Set' ? t : String(t).padStart(2, '0')}</b><i>${key ? 'KEY' : cfg.paper ? 'PRACTICE' : 'MODEL SET'}</i></div><div><h1>${esc(instName)}<br>${esc(paperName)} — ${esc(id)}${esc(setTag)}${key ? ' · Answer Key' : ''}</h1>${brand.tagline ? `<div class="bn-t">${esc(brand.tagline)}</div>` : ''}<div class="s">Mission Sainik 2027${date ? ' · ' + esc(fmtShort(date)) : ''}${cfg.noMarks ? '' : ` · ${printTotal(t)} questions · ${secs.reduce((a, x) => a + x.q * x.marks, 0)} marks · ${esc(cfg.duration)}`}</div></div></div>`
    let li = 0   // section letters count only the sections that are printed (an empty one is left out)
    const sections = secs.map(x => {
      const head = `<div class="sec">${x.items.length ? `Section–${letter(li++)}: ` : ''}${esc(x.title)}</div>${x.instruction && !key ? `<div class="ins">${esc(x.instruction)}</div>` : ''}`
      if (key) return head + x.items.map(q => `<div class="sol"><b>${q.no}.</b><span><b>(${q.answer.toLowerCase()})</b> ${mathToHtml(q.explanation || '')}${q.topic || q.difficulty ? ` <span class="m">[${esc([q.topic, q.difficulty].filter(Boolean).join(' · '))}]</span>` : ''}</span></div>`).join('')
      if (!x.items.length) return `<div class="emptysec">${head}<div class="empty">No questions uploaded yet for this section (Q${x.from}–Q${x.from + x.q - 1}). It is left out of the printed paper.</div></div>`
      return head + x.items.map((q, i) => `${passageHtml(x.items, i)}<div class="q"><b>${q.no}.</b><span class="t">${mathToHtml(q.question)}</span>${figHtml(q)}${optLayout(q)}</div>`).join('')
    }).join('')
    return `${first && pc.banner ? banner : ''}${draftTop(secs)}${key || !pc.note ? '' : '<div class="note">Read each question carefully. Each question has four options; choose the one correct answer and darken its bubble on the OMR sheet. There is no negative marking.</div>'}
<div class="cols">${sections}</div>
${count < printTotal(t) ? `<div class="conf">DRAFT — ${count} of ${printTotal(t)} questions uploaded so far.</div>` : ''}${allVerified ? '' : '<div class="conf">NOT FULLY VERIFIED — some sections have no verification sign-off.</div>'}
<div class="conf">All questions are confidential until the test is held.</div>`
  }
  const docBody = (t, key, setIdx) => {
    const secs = assemble(t, setIdx); const count = secs.reduce((a, x) => a + x.items.length, 0)
    const allVerified = live(t).every(x => signoff(t, x.label))
    const id = `${cfg.prefix}-${String(t).padStart(2, '0')}${series === 'practice' ? ` (for PMT-${String(t).padStart(2, '0')})` : ''}`
    const date = cfg.tests.find(x => x.no === t)?.date
    const setTag = ver.sets > 1 ? ` · SET ${SET_LETTERS[setIdx]}` : ''
    const opts = q => (q.opts || ['A', 'B', 'C', 'D'].map(k => ({ k, text: q['option_' + k.toLowerCase()] }))).map(o => `<span>(${o.k}) ${mathToHtml(o.text)}</span>`).join('')
    const body = key
      ? `<table><tr><th>Q</th><th>Ans</th><th>Topic</th><th>Level</th><th>Explanation</th></tr>${secs.flatMap(x => [`<tr><td colspan="5" class="sec">${esc(x.label)} · Q${x.from}–Q${x.from + x.q - 1}</td></tr>`, ...x.items.map(q => `<tr><td>${q.no}</td><td><b>${q.answer}</b></td><td>${esc(q.topic || '')}</td><td>${esc(q.difficulty || '')}</td><td>${mathToHtml(q.explanation || '')}</td></tr>`)]).join('')}</table>`
      : secs.map(x => (x.items.length ? s => s : s => `<div class="emptysec">${s}</div>`)(`<div class="sec">${esc(x.title)} · Q${x.from}–Q${x.from + x.q - 1} — ${x.q} question(s)${cfg.noMarks ? '' : ' × ' + x.marks + ' mark(s)'}</div>${x.items.length || key ? '' : '<div class="empty">No questions uploaded yet for this section</div>'}${x.items.map((q, i) => `${passageHtml(x.items, i).replace('class="pass"', 'class="pass" style="font-size:12px;margin:0 0 6px;text-align:justify"')}<div class="q"><b>${q.no}.</b> ${mathToHtml(q.question)}${figHtml(q)}<div class="o">${opts(q)}</div></div>`).join('')}`)).join('')
    return `<div class="lh">${logoImg}<h1>${esc(instName)}</h1>${brand.tagline ? `<div>${esc(brand.tagline)}</div>` : ''}<div>Mission Sainik 2027 · ${esc(paperName)}${esc(setTag)} ${key ? '· ANSWER KEY (CONFIDENTIAL)' : ''}</div></div>
${draftTop(secs)}<div class="meta"><span>${id}${date ? ' · ' + esc(fmtShort(date)) : ''}${esc(setTag)}</span>${cfg.noMarks ? '' : `<span>Marks: ${secs.reduce((a, x) => a + x.q * x.marks, 0)}</span><span>Time: ${esc(cfg.duration)}</span>`}</div>
${key ? '' : '<div class="note">Each question has four options. Choose the one correct answer and darken the bubble on the OMR sheet. There is no negative marking.</div>'}
${body}${count < printTotal(t) ? `<div class="conf">DRAFT — ${count} of ${printTotal(t)} questions uploaded so far.</div>` : ''}${allVerified ? '' : '<div class="conf">NOT FULLY VERIFIED — some sections have no verification sign-off.</div>'}
<div class="conf">All questions are confidential until the test is held.</div>`
  }
  const allBodies = (t, key) => Array.from({ length: ver.sets }, (_, i) => coverHtml(t, key, i) + (ver.layout === 'book' ? bookBody(t, key, i, true) : docBody(t, key, i)))
  // On screen (the preview) the print CSS is shown as an A4 sheet on a grey desk — margins, running header and page frame
  // that @page rules only give when printing. Print output is unchanged.
  const previewCss = `@media print{.draft,.emptysec,.empty{display:none!important}}.draft{border:1.5pt solid #b91c1c;color:#b91c1c;font-weight:800;text-align:center;padding:2mm 3mm;margin:0 0 3mm;font-size:9.5pt;break-inside:avoid}.empty{display:block;text-align:center;font-style:italic;color:#555;border:1pt dashed #999;padding:4pt;margin:0 0 2.5mm;font-size:9.5pt}@media screen{html{background:#cfd4dc}body{margin:0;padding:18px 10px}.sheet{box-sizing:border-box;width:210mm;max-width:100%;min-height:297mm;margin:0 auto 18px;background:#fff;box-shadow:0 4px 22px rgba(15,27,46,.28);padding:16mm 12mm 14mm}
.run{font:700 8.5pt ${F};text-align:center;letter-spacing:.04em;color:#222;border-bottom:.7pt solid #bbb;padding-bottom:2mm;margin-bottom:4mm}.pgno{font:800 9.5pt ${F};text-align:center;margin-top:6mm;color:#111}
.empty{display:block;text-align:center;font-style:italic;color:#8a93a6;border:1pt dashed #c9cfda;border-radius:3pt;padding:5pt;margin:0 0 2.5mm;font-size:9.5pt}}@media print{.run,.pgno{display:none}}`
  const shell = (bodies, title, auto) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${ver.layout === 'book' ? bookCss : docCss}${brandCss}${previewCss}</style></head><body>${brand.watermark?.trim() ? `<div class="wm">${esc(brand.watermark.trim())}</div>` : ''}${bodies.map((b, i) => `<div class="sheet"><div class="run">${esc(runHead)}</div><div class="${i < bodies.length - 1 ? 'pb' : ''}">${b}</div><div class="pgno">${brand.footer?.trim() ? esc(brand.footer.trim()) + ' · ' : ''}P-${i + 1}</div></div>`).join('')}${auto ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
  const docTitle = (t, key) => `${cfg.prefix}-${String(t).padStart(2, '0')} ${key ? 'Answer Key' : 'Question Paper'}`
  const ready0 = t => { if (blocked(t)) { setMsg(`🔒 Locked until ${fmtShort(dateOf(t))} (embargo). Ask an admin.`); return false } if (!live(t).some(x => get(t, x.label).length)) { setMsg('❌ No questions uploaded for this test yet.'); return false } return true }
  // Sections with no questions are left out of a printed paper; say so first.
  const okToPrint = t => {
    const empty = printLive(t).filter(sc => !get(t, sc.label).length).map(sc => sc.title || sc.label)
    return !empty.length || window.confirm(`${empty.join(', ')} ${empty.length > 1 ? 'have' : 'has'} no questions yet and will be left out of the printed paper. Print anyway?`)
  }
  const printDoc = (t, key) => {
    if (!ready0(t) || (!key && !okToPrint(t))) return
    audit(key ? 'print_key' : 'print_paper', `${series}:${t}`, { verified: live(t).every(x => signoff(t, x.label)), sets: ver.sets, shuffled: ver.shuffleQ || ver.shuffleOpts })
    const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print')
    w.document.write(shell(allBodies(t, key), docTitle(t, key), true)); w.document.close()
  }
  const previewDoc = (t, key) => { if (!ready0(t)) return; setPreview({ html: shell(allBodies(t, key), docTitle(t, key), false), title: docTitle(t, key), t, key }) }
  const exportWord = (t, key) => {
    if (!ready0(t)) return
    setMathStacked(false)
    let html
    try { html = wordWrap(`<style>${ver.layout === 'book' ? bookCss.replace(/@page\{[\s\S]*?\}\}/, '') : docCss}${brandCss.replace(/\.wm\{[^}]*\}|\.ftr\{[^}]*\}/g, '')}</style>` + allBodies(t, key).map(b => `<div style="page-break-after:always">${b}</div>`).join(''), docTitle(t, key))
    } finally { setMathStacked(true) }
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
    const seen = new Map(), others = new Map(), added = {}, rows = [], extraRows = [], poolAll = []; let dupes = 0, denied = 0, offChap = 0
    for (const q of list) {
      const t = keep ? Number(q.test_no) : testNo, sc = keep ? q.section : section
      if (!cfg.tests.some(x => x.no === t) || !cfg.sections.some(x => x.label === sc)) { denied++; continue }
      if (!canUpload(t, sc)) { denied++; continue }
      let planTopic
      if (chapterRule) {   // Pre Mock: only the one planned chapter of that test and section
        const pl = chaptersOf(t, sc)
        if (pl.length > 1) { offChap++; continue }
        if (pl.length) { planTopic = matchChapter(pl, q.topic); if (!planTopic) { offChap++; continue } }
      }
      const key = `${t}|${sc}`
      if (!seen.has(key)) { seen.set(key, new Set(get(t, sc).map(x => norm(x.question)))); poolAll.push(...get(t, sc)) }
      const set = seen.get(key), n = norm(q.question)
      if (set.has(n)) { dupes++; continue }
      if (chapterRule) { if (!others.has(key)) { const o = await otherSeriesTexts(t, sc); others.set(key, o); poolAll.push(...o.rows) } if (others.get(key).texts.has(n)) { dupes++; continue } }
      set.add(n)
      const row = { question: String(q.question).trim(), option_a: String(q.option_a).trim(), option_b: String(q.option_b).trim(), option_c: String(q.option_c).trim(), option_d: String(q.option_d).trim(), answer: String(q.answer).toUpperCase(), explanation: q.explanation || '', topic: planTopic || q.topic || '', difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : null, ...(q.passage ? { passage: String(q.passage) } : {}), series, test_no: t, section: sc, uploaded_by: currentUser?.name || '' }
      const capHere = cfg.sections.find(x => x.label === sc)?.q || 25
      const haveHere = (byVersion ? get(t, sc).filter(x => x.uploaded_by === (currentUser?.name || '')) : get(t, sc)).length + (added[key] || 0)
      if (strictPlan && haveHere >= capHere) extraRows.push({ ...row, series: 'practice' })   // the paper is full: it goes to that test's practice set
      else { rows.push(row); added[key] = (added[key] || 0) + 1 }
    }
    if (!rows.length && !extraRows.length) return setMsg(`❌ Nothing imported — ${dupes} duplicate(s), ${denied} not allowed or not matching this series${offChap ? `, ${offChap} not on the planned chapter` : ''}.`)
    const nearImp = findNear([...rows, ...extraRows], poolAll)
    if (!window.confirm(`Import ${rows.length} question(s)?${nearImp.length ? `\n${nearImp.length} may be reworded copies of questions already set (they are imported anyway; check them afterwards).` : ''}${extraRows.length ? `\n${extraRows.length} more do not fit (the paper holds only ${25} per section) and go to the practice set of their test.` : ''}${dupes ? `\n${dupes} duplicate(s) will be skipped.` : ''}${denied ? `\n${denied} not allowed here will be skipped.` : ''}${offChap ? `\n${offChap} not on the planned chapter of their test will be skipped.` : ''}`)) return
    setBusy(true)
    const { error } = await supabase.from(TABLE).insert([...rows, ...extraRows])
    setBusy(false)
    if (error) return setMsg('❌ ' + error.message + (/passage|image_data/.test(error.message) ? ' (run migration 20261211 for passages)' : ''))
    audit('bank_import', series, { count: rows.length, to_practice: extraRows.length, dupes, denied, off_chapter: offChap, keep })
    for (const key of seen.keys()) { const [t, sc] = key.split('|'); await clearSignoff(Number(t), sc) }
    setMsg(`✅ ${rows.length} question(s) imported${dupes ? ` · ${dupes} duplicate(s) skipped` : ''}`); load()
  }
  const downloadTemplate = () => { const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'Mission_Sainik_questions_template.csv'; a.click(); URL.revokeObjectURL(url) }
  // Bulk actions on the ticked questions of the current section
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const moveSelected = async copy => {
    const rowsSel = secList.filter(q => picked.includes(q.id) && (copy || canModify(q))); if (!rowsSel.length) return
    const tt = Number(moveTo.test || testNo), ss = moveTo.section || section
    if (!canUpload(tt, ss)) return setMsg(setterOnly ? uploadDeniedMsg(tt, ss) : '❌ Only the target section’s setter or an admin can add questions there.')
    if (tt === testNo && ss === section) return setMsg('❌ Choose a different test or section.')
    if (chapterRule) {
      const pl = chaptersOf(tt, ss)
      if (planState(pl) === 'multi') return setMsg(`❌ ${tid(tt)} · ${ss} lists ${pl.length} chapters in the Syllabus Plan; keep just one first.`)
      const off = offPlan(rowsSel, pl)
      if (off.length) return setMsg(`❌ ${tid(tt)} · ${ss} is planned for “${pl[0]}”. ${off.length} of the selected question${off.length === 1 ? ' is' : 's are'} on a different chapter, so ${off.length === 1 ? 'it' : 'they'} cannot go there.`)
    }
    if (strictPlan) {   // Pre Mock: the target section holds 25 (per teacher while several sets are on)
      const cap = cfg.sections.find(x => x.label === ss)?.q || 25
      const have = (byVersion ? get(tt, ss).filter(x => x.uploaded_by === (currentUser?.name || '')) : get(tt, ss)).length
      if (have + rowsSel.length > cap) return setMsg(`❌ ${tid(tt)} · ${ss} holds ${cap} and already has ${have}. It has room for ${Math.max(0, cap - have)} more.`)
    }
    if (chapterRule) {
      const other = await otherSeriesTexts(tt, ss), clash = rowsSel.filter(q => other.texts.has(normQ(q.question)))
      if (clash.length) return setMsg(`❌ ${clash.length} of these ${clash.length === 1 ? 'is' : 'are'} already in the ${otherName} for ${tid(tt)} · ${ss}.`)
    }
    if (!window.confirm(`${copy ? 'Copy' : 'Move'} ${rowsSel.length} question(s) to ${tid(tt)} · ${ss}?`)) return
    let error
    if (copy) ({ error } = await supabase.from(TABLE).insert(rowsSel.map(({ id, created_at, deleted_at, deleted_by, ...r }) => ({ ...r, test_no: tt, section: ss, uploaded_by: currentUser?.name || '' }))))  // eslint-disable-line no-unused-vars
    else ({ error } = await supabase.from(TABLE).update({ test_no: tt, section: ss }).in('id', rowsSel.map(q => q.id)))
    if (error) return setMsg('❌ ' + error.message)
    audit(copy ? 'copy_questions' : 'move_questions', `${series}:${testNo}:${section}`, { to: `${tt}:${ss}`, count: rowsSel.length })
    await clearSignoff(tt, ss); await clearSignoff(testNo, section); setPicked([]); setMsg(`✅ ${copy ? 'Copied' : 'Moved'} ${rowsSel.length} question(s)`); load()
  }
  const deletePicked = async () => {
    const ids = picked.filter(id => secList.some(q => q.id === id && canModify(q))); if (!ids.length || !canEdit(testNo, section)) return
    if (!window.confirm(`Delete ${ids.length} selected question(s)?${soft ? ' They go to the recycle bin.' : ''}`)) return
    await removeRows(x => x.in('id', ids), `${series}:${testNo}:${section}`, ids.length); setPicked([])
  }
  // Admin: choose the best questions when several teachers have set the same paper / set.
  const savePicks = async (ids, on, label) => {
    if (!isAdmin || !ids.length) return
    const { error } = await supabase.from(TABLE).update({ in_paper: on, in_paper_by: on ? (currentUser?.name || '') : null }).in('id', ids)
    if (error) return setMsg('❌ ' + error.message + ' (run supabase/migrations/20261219_mission_sainik_question_pick.sql)')
    audit('question_pick', `${series}:${testNo}:${section}`, { ids: ids.length, on, how: label }); await load()
  }
  const toggleInPaper = q => savePicks([q.id], !q.in_paper, 'toggle')
  const pickFirst = () => { const list = get(testNo, section), keep = new Set(list.slice(0, sec.q).map(x => x.id)); const clear = list.filter(x => x.in_paper && !keep.has(x.id)).map(x => x.id); return savePicks(list.filter(x => keep.has(x.id) && !x.in_paper).map(x => x.id), true, 'first').then(() => clear.length && savePicks(clear, false, 'first-clear')) }
  const clearPicks = () => savePicks(get(testNo, section).filter(x => x.in_paper).map(x => x.id), false, 'clear')
  // Practice bank: print one version per teacher's set (up to 4) so students get different flavours; the admin can still change it in Paper tools.
  const flavourCount = byVersion ? Math.max(1, ...live(testNo).map(x => flavours(setRows(testNo, x.label), x.q).filter(f => f.complete).length)) : 1
  useEffect(() => { if (byVersion && flavourCount > 1) setVer(v => (v.sets < Math.min(4, flavourCount) ? { ...v, sets: Math.min(4, flavourCount) } : v)) }, [byVersion, flavourCount, testNo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isMobile || typeof IntersectionObserver === 'undefined') return undefined
    const el = document.getElementById('msb-editor'); if (!el) return undefined
    const io = new IntersectionObserver(([e]) => setEditorInView(e.isIntersecting), { rootMargin: '-30% 0px -15% 0px', threshold: 0 })   // "on screen" = reaches the middle of the screen
    io.observe(el)
    return () => io.disconnect()
  }, [isMobile, testNo, section, addMode])
  const secStatus = (t, s) => { if (byVersion) return flavourStatus(setRows(t, s.label), s.q); const n = get(t, s.label).length; return n >= s.q ? 'ok' : n ? 'part' : 'none' }
  const sec = cfg.sections.find(s => s.label === section)
  const secList = get(testNo, sec.label)
  const mayEdit = canEdit(testNo, sec.label)
  const pickInfo = pickSummary(secList, sec.q), contribs = contributors(secList, sec.q)
  const usedList = usedQuestions(secList, sec.q), usedIds = new Set(usedList.map(x => x.id))
  const multiTeachers = contribs.length > 1
  const myName = currentUser?.name || ''
  // Practice: every practice teacher sets questions for EVERY test. Which tests has this teacher finished (all their subjects)?
  const mySecs = series === 'practice' ? cfg.sections.filter(x => settersOf(testNo, x.label).some(isMe)) : []
  const myDone = t => mySecs.length > 0 && mySecs.every(x => get(t, x.label).filter(q => q.uploaded_by === myName).length >= x.q)
  const myDoneN = mySecs.length ? cfg.tests.filter(t => myDone(t.no)).length : 0
  const chapters = chaptersOf(testNo, sec.label)
  // Practice, admin: questions saved in the old "Set 1–3" days sit on the wrong test. Each moves to the test whose planned chapter is its own topic,
  // but only when exactly ONE test has that chapter (a chapter used by two tests is ambiguous, so it is left for a person to decide).
  const refile = (() => {
    const out = { by: {}, n: 0, amb: 0 }
    if (series !== 'practice' || !isAdmin) return out
    qs.filter(q => q.section === section).forEach(q => {
      if (!String(q.topic || '').trim() || matchChapter(chaptersOf(q.test_no, section), q.topic)) return
      const tg = cfg.tests.filter(t => matchChapter(chaptersOf(t.no, section), q.topic))
      if (tg.length === 1) { (out.by[tg[0].no] = out.by[tg[0].no] || []).push(q); out.n++ } else out.amb++
    })
    return out
  })()
  const refileNow = async () => {
    if (!refile.n || !isAdmin) return
    if (!window.confirm(`Move ${refile.n} question${refile.n === 1 ? '' : 's'} of ${section} to the test whose planned chapter they are on?${refile.amb ? `\n\n${refile.amb} more are on a chapter used by several tests, or have none; they stay where they are.` : ''}\n\nVerification of the tests involved is reset.`)) return
    for (const [t, list] of Object.entries(refile.by)) {
      const { error } = await supabase.from(TABLE).update({ test_no: Number(t) }).in('id', list.map(q => q.id))
      if (error) return setMsg('❌ ' + error.message)
      await clearSignoff(Number(t), section)
    }
    for (const t of new Set(Object.values(refile.by).flat().map(q => q.test_no))) await clearSignoff(t, section)
    audit('refile_practice', `practice:${section}`, { moved: refile.n, left: refile.amb, moves: Object.entries(refile.by).flatMap(([to, l]) => l.map(q => [q.id, q.test_no, Number(to)])).slice(0, 500) })   // ids and old tests, so it can be undone
    setMsg(`✅ ${refile.n} question${refile.n === 1 ? '' : 's'} moved to the right test${refile.amb ? ` · ${refile.amb} left for you to decide` : ''}`); load()
  }
  const offList = chapterRule && chapters.length === 1 ? offPlan(secList, chapters) : []   // questions here that are not on the planned chapter
  const normT = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const chapterCount = ch => secList.filter(q => normT(q.topic) === normT(ch)).length
  const untagged = chapters.length ? secList.filter(q => !chapters.some(ch => normT(ch) === normT(q.topic))).length : 0
  const flav = flavours(setRows(testNo, sec.label), sec.q)
  const secHue = SUBJ_HUE[sec.key] || Object.values(SUBJ_HUE)[Math.max(0, cfg.sections.indexOf(sec)) % 6]
  const myCount = byVersion ? secList.filter(x => x.uploaded_by === myName).length : secList.length   // what the logged-in teacher has set in this practice section
  const mayAdd = canUpload(testNo, sec.label)   // may add questions (setter only on Pre Mock, Mock and Practice)
  const overview = !mayAdd || (byVersion && myCount === 0 && secList.length > 0 && !settersOf(testNo, section).some(isMe))   // an admin / verifier looking at the section, not a setter with a set of their own
  const listShown = secList.map((q, i) => ({ q, i })).filter(({ q }) => (!qLevel || q.difficulty === qLevel) && (!qSearch.trim() || [q.question, q.topic, q.explanation, q.option_a, q.option_b, q.option_c, q.option_d].join(' ').toLowerCase().includes(qSearch.trim().toLowerCase())))
  const limN = lim.k === `${testNo}|${section}|${qSearch}|${qLevel}` ? lim.n : 10
  const ready = testReady(testNo)
  const health = paperHealth(live(testNo).map(x => ({ label: x.label, q: x.q, items: get(testNo, x.label) })), qs, testNo)
  const lvl = { Easy: 0, Medium: 0, Hard: 0 }; secList.forEach(q => { if (lvl[q.difficulty] != null) lvl[q.difficulty]++ })

  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const stepTest = d => { const i = cfg.tests.findIndex(t => t.no === testNo); const n = cfg.tests[i + d]; if (n) setTestNo(n.no) }
  const msbCss = `${MATH_CSS}.msb-prog .chipsrow{display:flex;flex-wrap:wrap;gap:7px}.msb-prog .chipsrow span{display:inline-flex;align-items:center;gap:7px;padding:4px 12px 4px 5px;border-radius:99px;background:#fff;border:1px solid #f1c9c4;font-size:12.5px;font-weight:700;color:#8a3a2f}
.msb-prog .chipsrow span.ok{border-color:#bfe3cc;color:#0f7a4c}.msb-prog .chipsrow i{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--c);color:#fff;font:800 11px/1 inherit;font-style:normal}
.msb-prog{margin:0 0 16px;padding:16px 18px;border-radius:16px;border:1px solid color-mix(in srgb,var(--c) 28%,#fff);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 9%,#fff),#fff 70%)}
.msb-prog .hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}.msb-prog .ttl{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--c)}
.msb-prog .cnt{white-space:nowrap;font-size:14px;color:#5d6b82;font-weight:700}.msb-prog .cnt b{font-family:'Fraunces',Georgia,serif;font-size:28px;color:var(--c);margin-right:2px}
.msb-prog .dots{display:flex;flex-wrap:wrap;gap:5px}.msb-prog .dots i{width:14px;height:14px;border-radius:50%;background:#e3e8f1;transition:background .3s,transform .3s}
.msb-prog .dots i.on{background:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 25%,transparent)}.msb-prog .dots i.next{background:#fff;box-shadow:inset 0 0 0 2px var(--c);animation:msb-pulse 1.6s ease-in-out infinite}
@keyframes msb-pulse{50%{transform:scale(1.25)}}
.msb-prog .msg{display:flex;align-items:center;gap:7px;margin-top:11px;font-size:14px;font-weight:600;color:#26354f;line-height:1.45}.msb-prog .msg svg{color:#0f7a4c;flex:none}
.msb-meth{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 10px}
.msb-meth button{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:14px;border:1.5px solid #dfe5ef;background:#fff;transition:transform .18s,box-shadow .18s,border-color .18s}
.msb-meth button:hover{transform:translateY(-2px);border-color:#9fb4d6;box-shadow:0 12px 22px -16px rgba(19,42,79,.5)}.msb-meth button:focus-visible{outline:3px solid #f2c94c;outline-offset:2px}
.msb-meth button.on{border-color:#132a4f;background:linear-gradient(180deg,#eef3fc,#fff);box-shadow:0 0 0 3px rgba(19,42,79,.12)}
.msb-meth .ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#e6edf9;color:#132a4f;margin-bottom:4px}.msb-meth button.on .ic{background:#132a4f;color:#fff}
.msb-meth b{font-size:15px;color:#0e2a55}.msb-meth small{font-size:12.5px;color:#5d6b82;line-height:1.35}
.msb-meth em{position:absolute;top:10px;right:10px;font-style:normal;font-size:10px;font-weight:800;letter-spacing:.04em;padding:2px 8px;border-radius:99px;background:#fff3d6;color:#8a5500}
.msb-how{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 14px;padding:10px 14px;border-radius:12px;background:#f6f8fc;border:1px dashed #cdd6e6;font-size:13px;color:#26354f;font-weight:600}
.msb-how span{display:inline-flex;align-items:center;gap:8px}.msb-how i{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#132a4f;color:#fff;font:800 12px/1 inherit;font-style:normal}
.msb-off{font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;background:#fdecea;color:#b42318;border:1px solid #f5c2bd;white-space:nowrap}
.msb-rule{display:flex;gap:11px;align-items:flex-start;margin:0 0 14px;padding:11px 14px;border-radius:12px;background:#f6f1ff;border:1px solid #d9ccf5;color:#2d1b69;font-size:13px;line-height:1.5}.msb-rule svg{flex:none;margin-top:2px;color:#6d28d9}.msb-rule.warn{background:#fff7e6;border-color:#f0d9a0;color:#6b4300}.msb-rule.warn svg{color:#b45309}
.msb-more{margin-top:16px;border:1px solid #e3e8f1;border-radius:14px;background:#fbfcfe}.msb-more>summary{cursor:pointer;padding:13px 16px;font-weight:800;font-size:14px;color:#0e2a55;list-style:none}.msb-more>summary::-webkit-details-marker{display:none}
.msb-more>summary::before{content:'▸';display:inline-block;margin-right:9px;transition:transform .2s;color:#8a6a1f}.msb-more[open]>summary::before{transform:rotate(90deg)}.msb-more>summary small{font-weight:500;color:#5d6b82}
.msb-more .in{padding:0 16px 14px}
@media (max-width:700px){.msb-meth{gap:8px}.msb-meth button{padding:12px 6px;align-items:center;text-align:center}.msb-meth small,.msb-meth em{display:none}.msb-meth b{font-size:13.5px}.msb-prog{padding:13px 14px}.msb-prog .dots i{width:12px;height:12px}}
.msb-wrap{background:#fff;border:1px solid #e3e8f1;border-radius:20px;box-shadow:0 1px 2px rgba(19,42,79,.06),0 18px 40px -24px rgba(19,42,79,.4);overflow:hidden;margin-bottom:18px}
.msb-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;padding:20px 28px 22px;color:#fff;background:radial-gradient(70% 140% at 100% 0%,rgba(230,195,94,.24),transparent 60%),linear-gradient(135deg,#081a38,#14336a 70%,#1b4388);isolation:isolate;overflow:hidden}
.msb-hero::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.09) 1px,transparent 1px);background-size:16px 16px;-webkit-mask-image:linear-gradient(90deg,transparent,#000);mask-image:linear-gradient(90deg,transparent,#000);z-index:-1}
.msb-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#8a6a1f,#e6c35e 50%,#8a6a1f)}
.msb-hero.ready::after{height:5px;box-shadow:0 0 18px rgba(230,195,94,.9)}
.msb-hero .k{display:inline-flex;align-items:center;gap:10px;font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#f1dca0}.msb-hero .k::before{content:'';width:26px;height:2px;background:#e6c35e}
.msb-hero h2{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:6px 0 10px;font-family:'Fraunces','Playfair Display',Georgia,serif;font-size:38px;line-height:1.05;font-weight:700;letter-spacing:-.01em;text-shadow:0 2px 14px rgba(0,0,0,.3)}
.msb-hero .rd{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:#16a34a;color:#fff;font:800 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.04em;text-shadow:none;box-shadow:0 6px 16px -6px rgba(22,163,74,.9)}
.msb-hero .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.msb-hero .ch{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border:1px solid rgba(233,217,176,.4);border-radius:99px;background:rgba(255,255,255,.08);font-size:13px;font-weight:600;backdrop-filter:blur(4px)}
.msb-hero .ch.hot{background:rgba(252,165,165,.18);border-color:rgba(252,165,165,.7);color:#ffe3e0}
.msb-hero .acts{display:flex;gap:8px;flex-wrap:wrap}
.msb-hero .acts button{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;transition:background .15s,transform .15s}
.msb-hero .acts button:hover{background:rgba(255,255,255,.2);transform:translateY(-1px)}
.msb-hero .acts button.gold{background:linear-gradient(180deg,#d9b657,#b8923a);border-color:#9c7a2b;color:#2b1f03;box-shadow:0 8px 18px -8px rgba(184,146,58,.9)}.msb-hero .acts button.gold:hover{background:linear-gradient(180deg,#e2c068,#c49d42)}
.msb-hero .r{text-align:center}.msb-hero .ring{position:relative;width:118px;height:118px;margin:0 auto}.msb-hero .ring svg{width:118px;height:118px}
.msb-hero .ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.msb-hero .ring b{font-family:'Fraunces',Georgia,serif;font-size:36px;line-height:1;background:linear-gradient(180deg,#fff,#f1dca0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.msb-hero .ring span{font-size:12px;color:#cfdbf2;font-weight:600;margin-top:2px}
.msb-hero .cap{margin-top:6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9d9b0;font-weight:700}
.msb-tiles{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:12px}
.msb-tile{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:flex;flex-direction:column;gap:7px;padding:14px 14px 12px;border-radius:16px;background:#fff;border:1.5px solid #e3e8f1;border-top:5px solid var(--c);box-shadow:0 1px 2px rgba(19,42,79,.05);transition:transform .2s,box-shadow .2s,border-color .2s}
.msb-tile:hover{transform:translateY(-3px);box-shadow:0 16px 28px -16px color-mix(in srgb,var(--c) 60%,#0b1c36)}
.msb-tile:focus-visible{outline:3px solid #f2c94c;outline-offset:2px}
.msb-tile.on{border-color:var(--c);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 9%,#fff),#fff 60%);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 24%,transparent),0 16px 28px -18px color-mix(in srgb,var(--c) 70%,#0b1c36)}
.msb-tile .top{display:flex;align-items:center;gap:10px}
.msb-tile .mk{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 65%,#fff));color:#fff;font-weight:800;font-size:13px;box-shadow:0 6px 12px -6px var(--c)}
.msb-tile .rg{font-weight:800;font-size:14px;color:#0e2a55;line-height:1.15;min-width:0}.msb-tile .rg small{display:block;font-weight:600;font-size:11.5px;color:#5d6b82}
.msb-tile .num{font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:700;line-height:1;color:var(--c)}
.msb-tile .tr{height:7px;border-radius:99px;background:#eceff5;overflow:hidden}.msb-tile .tr i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--c),color-mix(in srgb,var(--c) 60%,#fff));transition:width .8s ease}
.msb-tile .st{display:flex;gap:5px;flex-wrap:wrap;min-height:22px}
.msb-tile .p{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap}
.msb-tile .p.ok{background:#e6f5ec;color:#0f7a4c}.msb-tile .p.warn{background:#fff3d6;color:#8a5500}.msb-tile .p.info{background:#e8f0fe;color:#1d4ed8}.msb-tile .p.mute{background:#f0f2f7;color:#6b778c}
.msb-tile .who{font-size:11.5px;color:#5d6b82;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msb .msb-q{border-radius:10px;padding-left:6px!important;padding-right:6px!important;transition:background .15s}.msb .msb-q:hover{background:#f6f9fe}
.msb .msb-q>div>button b:first-child{display:inline-flex;align-items:center;justify-content:center;min-width:38px;margin-right:8px;padding:2px 8px;border-radius:7px;background:#e6edf9;color:#10305f;font-size:12px;font-weight:800}
@media (max-width:700px){.msb-hero{grid-template-columns:1fr;padding:16px 16px 18px;text-align:left}.msb-hero h2{font-size:30px;margin:4px 0 8px;padding-right:84px}.msb-hero .r{position:absolute;top:14px;right:14px;z-index:1}.msb-hero .cap{display:none}.msb-hero .ring,.msb-hero .ring svg{width:78px;height:78px}.msb-hero .ring b{font-size:22px}.msb-hero .ring span{font-size:10px}.msb-hero .k{font-size:10.5px}.msb-hero .ch{padding:5px 11px;font-size:12.5px}.msb-hero .acts button{flex:1 1 140px;justify-content:center}.msb-tile .num{font-size:26px}.msb-wrap{border-radius:16px}}
.msb .msb-q .px-hbtn{height:32px!important;min-height:32px!important;padding:0 10px!important}.msb .msb-q input[type=checkbox]{margin-top:6px!important}.msb img.oi{max-height:70px}.msb .msb-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.msb .msb-strip::-webkit-scrollbar{display:none}.msb .msb-chip{scroll-snap-align:center;flex:0 0 auto;min-width:92px;text-align:left;padding:9px 12px;border-radius:14px;border:2px solid #e8e3d8;background:#fff;cursor:pointer;font-family:inherit}
.msb .msb-chip.on{border-color:#b8923a;background:#faf1d9}.msb .msb-fab{position:fixed;right:14px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:34;border:none;border-radius:16px;background:#b8923a;color:#fff;font:800 14px inherit;font-family:inherit;padding:14px 18px;box-shadow:0 10px 24px rgba(184,146,58,.5)}
@media (max-width:640px){.msb input:not([type=checkbox]):not([type=file]),.msb select,.msb textarea{font-size:16px!important}.msb .px-hbtn,.msb .px-btn{min-height:42px}.msb .px-card{border-radius:16px}}`
  const nextMine = (() => { for (const t of cfg.tests) for (const s of live(t.no)) if (mineAt(t.no, s) && get(t.no, s.label).length < s.q) return { t: t.no, s }; return null })()
  return (
    <div className="msb">
      <style>{msbCss}</style>
      {setup && <div style={{ padding: 12, marginBottom: 12, borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 13 }}>Run <b>supabase/migrations/20261206_mission_sainik_questions.sql</b> in Supabase to enable the builders.</div>}
      <div className="msb-wrap">
        <div className={'msb-hero' + (ready ? ' ready' : '')}>
          <div className="l">
            <div className="k">{isPractice ? 'Practice Maker · practice sets, not Pre Mock tests' : `${cfg.name} ${cfg.noun === 'Set' ? 'bank' : 'builder'}`}</div>
            <h2>{tid(testNo)}{ready && <span className="rd"><Icon name="check" size={14} stroke={2.6} />Ready to print</span>}</h2>
            <div className="chips">
              {(dateOf(testNo) || planDate(testNo)) && <span className="ch"><Icon name="schedule" size={15} />{series === 'practice' ? 'Test on ' : ''}{new Date((dateOf(testNo) || planDate(testNo)) + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              {(dateOf(testNo) || planDate(testNo)) && today && (() => { const d = Math.round((new Date((dateOf(testNo) || planDate(testNo)) + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5); return <span className={'ch' + (d >= 0 && d <= 3 ? ' hot' : '')}><Icon name="clock" size={15} />{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 0 ? `In ${d} days` : `${-d} day${d === -1 ? '' : 's'} ago`}</span> })()}
              <span className="ch"><Icon name="practice" size={15} />{live(testNo).length} {cfg.noun === 'Set' ? 'subjects' : 'sections'}</span>
              {series === 'practice' && mySecs.length > 0 && <span className={'ch' + (myDoneN === cfg.tests.length ? '' : ' hot')} title="Practice teachers set questions for every test"><Icon name="check" size={15} stroke={2.4} />You: {myDoneN} of {cfg.tests.length} tests done</span>}
            </div>
            <div className="acts">
              {(!embargo || isAdmin) && <button type="button" onClick={exportCsv}><Icon name="upload" size={16} style={{ transform: 'rotate(180deg)' }} />Export bank</button>}
              <button type="button" onClick={() => printDoc(testNo, false)}><Icon name="print" size={16} />Question paper</button>
              <button type="button" className="gold" onClick={() => printDoc(testNo, true)}><Icon name="certs" size={16} />Answer key</button>
            </div>
          </div>
          <div className="r" role="img" aria-label={`${testCount(testNo)} of ${totalQ(testNo)} questions uploaded`}>
            {(() => { const n = testCount(testNo), tot = totalQ(testNo), pct = tot ? Math.min(100, (n / tot) * 100) : 0, R = 52, C = 2 * Math.PI * R; return (
              <div className="ring"><svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="11" />
                <circle cx="66" cy="66" r={R} fill="none" stroke="url(#msbg)" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .9s ease' }} />
                <defs><linearGradient id="msbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8923a" /><stop offset="1" stopColor="#f6e3a8" /></linearGradient></defs></svg>
                <div className="c"><b>{n}</b><span>of {tot}</span></div></div>) })()}
            <div className="cap">questions in</div>
          </div>
        </div>
        {isMobile && showAll && (
          <div className="msb-strip" data-ti-skip role="tablist" aria-label={cfg.noun === 'Set' ? 'Choose a set' : 'Choose a test'} style={{ padding: '12px 12px 4px' }}>
            {cfg.tests.map(t => {
              const n = testCount(t.no), tot = totalQ(t.no), done = testReady(t.no)
              return (
                <button key={t.no} type="button" role="tab" aria-selected={t.no === testNo} className={'msb-chip' + (t.no === testNo ? ' on' : '')} onClick={() => setTestNo(t.no)} ref={el => { if (el && t.no === testNo) el.scrollIntoView?.({ inline: 'center', block: 'nearest' }) }}>
                  <div style={{ fontWeight: 800, color: PX.navy, fontSize: 14 }}>{tid(t.no)}</div>
                  <div style={{ fontSize: 11, color: PX.sub }}>{t.date ? fmtShort(t.date) : cfg.noun === 'Set' ? 'one set per subject' : ' '}</div>
                  <div style={{ height: 5, borderRadius: 99, background: '#f1ede3', margin: '6px 0 3px', overflow: 'hidden' }}><div style={{ width: Math.min(100, tot ? (n / tot) * 100 : 0) + '%', height: '100%', background: done ? PX.ok : PX.gold }} /></div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: done ? PX.ok : PX.sub }}>{done ? '✓ Ready' : `${n}/${tot}`}</div>
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: `1px solid ${PX.line}`, background: PX.tint }}>
          <button type="button" className="px-btn ghost" aria-label={`Previous ${(cfg.noun || 'Test').toLowerCase()}`} disabled={cfg.tests[0].no === testNo} onClick={() => stepTest(-1)} style={{ minWidth: 44 }}>‹</button>
          <select aria-label={`Choose a ${(cfg.noun || 'Test').toLowerCase()}`} value={testNo} onChange={e => setTestNo(Number(e.target.value))} style={{ flex: '1 1 180px', maxWidth: 320, fontWeight: 700 }}>
            {cfg.tests.map(t => <option key={t.no} value={t.no}>{tid(t.no)}{(t.date || t.plan) ? ` · ${fmtShort(t.date || t.plan)}` : ''}{testReady(t.no) ? ' · ready' : ''}{series === 'practice' && myDone(t.no) ? ' · ✓ yours done' : ''}</option>)}
          </select>
          <button type="button" className="px-btn ghost" aria-label={`Next ${(cfg.noun || 'Test').toLowerCase()}`} disabled={cfg.tests[cfg.tests.length - 1].no === testNo} onClick={() => stepTest(1)} style={{ minWidth: 44 }}>›</button>
          <button type="button" className="px-btn ghost" style={{ marginLeft: 'auto' }} aria-pressed={showAll} onClick={() => setShowAll(v => !v)}>{showAll ? `Show present ${(cfg.noun || 'Test').toLowerCase()} only` : `Show all ${cfg.tests.length} ${(cfg.noun || 'Test').toLowerCase()}s`}</button>
        </div>
        {nextMine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 16px', background: PX.goldBg, borderBottom: `1px solid ${PX.goldLine}` }}>
            <span style={{ flex: '1 1 220px', fontSize: 13, color: PX.ink }}>⭐ <b>Yours:</b> {tid(nextMine.t)} · {nextMine.s.short} — {get(nextMine.t, nextMine.s.label).length}/{nextMine.s.q} questions in</span>
            <button type="button" className="px-btn gold" onClick={() => { setTestNo(nextMine.t); setSection(nextMine.s.label) }}>Continue →</button>
          </div>)}
        {!isMobile && showAll && <table className="px-table" style={{ minWidth: 640 }}>
          <thead><tr><th>{cfg.noun === 'Set' ? 'Set' : 'Test'}</th>{cfg.sections.map(s => <th key={s.label}>{s.short}</th>)}<th>Total</th><th /></tr></thead>
          <tbody>{cfg.tests.filter(t => showAll || t.no === testNo).map(t => (
            <tr key={t.no} style={t.no === testNo ? { background: PX.tint } : undefined}>
              <td><button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: PX.navy }} onClick={() => setTestNo(t.no)}>{tid(t.no)}</button><div style={{ fontSize: 11, color: PX.sub }}>{t.date ? fmtShort(t.date) : ''}</div></td>
              {cfg.sections.map(s => avail(t.no, s) ? <td key={s.label} style={mineAt(t.no, s) ? { boxShadow: `inset 0 0 0 2px ${PX.gold}`, borderRadius: 8 } : undefined} title={mineAt(t.no, s) ? 'Your section' : undefined}><CountPill n={get(t.no, s.label).length} q={s.q} /></td> : <td key={s.label} style={{ color: PX.faint || '#9aa5b8' }}>—</td>)}
              <td><b>{testCount(t.no)}/{totalQ(t.no)}</b></td>
              <td>{testReady(t.no) ? <Pill tone="ok">Ready</Pill> : null}</td>
            </tr>))}
          </tbody>
        </table>}
        <div className="msb-tiles" style={{ padding: isMobile ? '12px' : '16px 18px 18px', '--cols': isMobile ? 2 : live(testNo).length }}>
          {live(testNo).map((s, si) => {
            const n = get(testNo, s.label).length, st = secStatus(testNo, s)
            const ups = [...new Set(get(testNo, s.label).map(q => q.uploaded_by).filter(Boolean))]
            const hue = SUBJ_HUE[s.key] || Object.values(SUBJ_HUE)[si % 6], on = s.label === section
            const verified = !!signoff(testNo, s.label), full = byVersion ? flavourStatus(setRows(testNo, s.label), s.q) === 'ok' : n >= s.q
            const label = byVersion ? (() => { const f = flavours(setRows(testNo, s.label), s.q); return f.length > 1 ? `${f.filter(x => x.complete).length}/${f.length} sets` : `${n}/${s.q}` })() : `${n}/${s.q}`
            const who = ups.length ? ups.map(fullName).join(', ') : settersOf(testNo, s.label).map(fullName).join(', ') || '—'
            return (
              <button key={s.label} type="button" className={'msb-tile' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setSection(s.label)} style={{ '--c': hue }}>
                <div className="top"><span className="mk">{String(s.short).slice(0, 2)}</span><span className="rg">{s.short}<small>{range(s)}</small></span></div>
                <div className="num" style={{ color: st === 'none' ? '#8a93a6' : undefined }}>{label}</div>
                <div className="tr"><i style={{ width: Math.min(100, s.q ? (n / s.q) * 100 : 0) + '%' }} /></div>
                <div className="st">
                  {verified ? <span className="p ok"><Icon name="check" size={12} stroke={2.6} />Verified</span> : full ? <span className="p warn">Awaiting verification</span> : n ? <span className="p info">In progress</span> : <span className="p mute">Not started</span>}
                  {openNotes(testNo, s.label) > 0 && <span className="p warn">{openNotes(testNo, s.label)} note{openNotes(testNo, s.label) > 1 ? 's' : ''}</span>}
                </div>
                <div className="who">{who}</div>
              </button>
            )
          })}
        </div>
      </div>

      {(series === 'practice' || series === 'pre') && <MissionSainikStaffBoard series={series} tests={cfg.tests} currentTest={testNo} tid={tid} sectionsOf={live} settersOf={settersOf} byVersion={byVersion}
        rows={qs} signoffs={signoffs} same={(who, name) => matchesOne(who, name, staffNames)} displayName={n => (/\s/.test(n) ? n : fullName(n))} photoOf={n => (staffMatching(n, staffNames).length === 1 ? staffMatching(n, staffNames)[0] : n)} isMobile={isMobile} />}

      {!showTools && <button type="button" className="px-btn ghost" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', margin: '0 0 12px', padding: '14px 16px', textAlign: 'left' }} onClick={() => setShowTools(true)}><span><b>🖨 Paper tools</b> <span style={{ color: PX.sub, fontSize: 12.5 }}>· {health.score}% healthy{isMobile ? '' : ' · versions, preview, Word, OMR'}</span></span><span>▸</span></button>}
      {showTools && <PremiumCard title="Paper tools" subtitle={`${tid(testNo)} · health check, shuffled sets, OMR, Word and preview`}
        right={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{isAdmin && onLock && <button className="px-hbtn" onClick={() => onLock(`lock:${series}:${testNo}`, !isLocked(testNo))}>{isLocked(testNo) ? '🔓 Unlock paper' : '🔒 Lock paper'}</button>}<span className="px-hbtn" style={{ pointerEvents: 'none' }}>{health.score}% healthy</span><button className="px-hbtn" onClick={() => setShowTools(false)}>Hide</button></span>}>
        {isLocked(testNo) && <div role="status" style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 12, background: '#fff6dc', border: '1px solid #e9d9b0', color: '#5c4510', fontSize: 13, fontWeight: 600 }}>🔒 This paper is locked by an admin. It can be viewed and printed but not changed{isAdmin ? ' (you can, as an admin)' : ''}.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><MiniBar pct={health.score} tone={health.score >= 85 ? 'ok' : health.score >= 55 ? 'gold' : 'bad'} width={140} /><b style={{ fontSize: 13 }}>Paper health</b></div>
            {[...health.checks, ...(chapterRule && chapters.length === 1 ? [{ id: 'plan', ok: offList.length === 0, text: offList.length ? `${offList.length} question${offList.length === 1 ? '' : 's'} not on the planned chapter “${chapters[0]}”` : `Every question is on the planned chapter (${chapters[0]})` }] : [])].map(c => (
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
        <div style={{ marginTop: 14 }}>
          <button className="px-hbtn" aria-expanded={showSettings} onClick={() => setShowSettings(v => !v)}>{showSettings ? '▾' : '▸'} Layout, fonts &amp; section builder</button>
        </div>
        {showSettings && (
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
                  {isAdmin ? <><div style={{ fontWeight: 800, fontSize: 13, margin: '14px 0 6px' }}>Branding, cover page &amp; watermark</div>
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
                  </> : <div style={{ fontSize: 12, color: PX.sub, margin: '12px 0 0' }}>🔒 Institute name, logo, watermark and cover page are set by an admin.</div>}
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

      <div id="msb-editor" style={{ scrollMarginTop: 140 }}>
      <PremiumCard title={`${section} · ${range(sec)}`} subtitle={`${byVersion && flav.length > 1 ? `${flav.length} teachers · yours ${myCount}/${sec.q}` : (secList.length > sec.q ? `${secList.length} uploaded · ${sec.q} needed` : `${secList.length}/${sec.q} questions`)} · Easy ${lvl.Easy} · Medium ${lvl.Medium} · Hard ${lvl.Hard} (aim ≈ 40/40/20)`}
        right={<span style={{ display: 'flex', gap: 8 }}>{(byVersion ? flavourStatus(setRows(testNo, sec.label), sec.q) === 'ok' : secList.length >= sec.q) && !signoff(testNo, section) && canVerify(testNo, section) && <button className="px-hbtn" onClick={() => verify(testNo, section)}>✓ Mark verified</button>}{mayEdit && secList.length ? <button className="px-hbtn" onClick={clearSection}>🗑 Clear section</button> : null}</span>}>
            {overview ? (
              <div className="msb-prog" style={{ '--c': secHue }}>
                <div className="hd"><span className="ttl">{sec.short || section} · section overview</span><span className="cnt"><b>{secList.length}</b> uploaded · {sec.q} needed</span></div>
                {(byVersion ? flav.length > 0 : contribs.length > 0) && <div className="chipsrow">{byVersion
                  ? flav.map(f => <span key={f.by} className={f.complete ? 'ok' : 'part'}><i>{f.letter}</i>{fullName(f.by)} · {Math.min(f.count, sec.q)}/{sec.q}{f.complete ? <Icon name="check" size={12} stroke={3} /> : null}</span>)
                  : contribs.map(c => <span key={c.name} className="ok"><i>{String(fullName(c.name)).replace(/^Sir |^Miss /, '').charAt(0)}</i>{fullName(c.name)} · {c.n}</span>)}</div>}
                <div className="msg">{signoff(testNo, section) ? <><Icon name="check" size={15} stroke={2.6} />Verified — this section is locked in.</>
                  : (byVersion ? flav.length > 0 && flav.every(f => f.complete) : secList.length >= sec.q) ? <><Icon name="check" size={15} stroke={2.6} />{byVersion && flav.length > 1 ? `All ${flav.length} sets are complete` : 'The section is complete'} — ready for verification.</>
                    : secList.length === 0 ? <>Nothing uploaded yet. Waiting for {[...new Set(settersOf(testNo, section).map(fullName))].join(' / ') || 'a setter to be allotted'}.</>
                      : byVersion ? <>{flav.filter(f => f.complete).length} of {flav.length} set{flav.length === 1 ? '' : 's'} complete.</> : <>{secList.length} of {sec.q} questions in so far.</>}</div>
              </div>
            ) : (
            <div className="msb-prog" style={{ '--c': secHue }}>
              <div className="hd"><span className="ttl">Your progress in {sec.short || section}</span><span className="cnt"><b>{Math.min(myCount, sec.q)}</b> of {sec.q}</span></div>
              {sec.q <= 60 ? <div className="dots" role="img" aria-label={`${Math.min(myCount, sec.q)} of ${sec.q} questions added`}>{Array.from({ length: sec.q }, (_, i) => <i key={i} className={i < myCount ? 'on' : i === myCount ? 'next' : ''} />)}</div>
                : <MiniBar pct={(myCount / sec.q) * 100} width={'100%'} />}
              <div className="msg">{signoff(testNo, section) ? <><Icon name="check" size={15} stroke={2.6} />Verified — this section is locked in. Well done.</>
                : myCount >= sec.q ? <><Icon name="check" size={15} stroke={2.6} />Section complete — it is ready for verification.{strictPlan ? ` New questions you add now go to the practice set for ${tid(testNo)} (${section}).` : ''}</>
                  : myCount === 0 ? <>Let's begin. Choose how you want to add questions below — your first one takes about a minute.</>
                    : myCount < sec.q / 2 ? <>Good start. {sec.q - myCount} more to go — every question is saved the moment you add it.</>
                      : <>Over halfway. Just {sec.q - myCount} more.</>}</div>
            </div>)}
            {refile.n + refile.amb > 0 && <div className="msb-rule warn" role="alert"><Icon name="alert" size={18} /><span><b>{refile.n + refile.amb} {section} practice question{refile.n + refile.amb === 1 ? ' is' : 's are'} on the wrong test</b> (saved before practice became one set per test). {refile.n > 0 ? `${refile.n} can be moved automatically to the test whose planned chapter they are on.` : ''}{refile.amb > 0 ? ` ${refile.amb} are on a chapter used by several tests, or have no chapter, so someone must decide.` : ''}</span>{refile.n > 0 && <button type="button" className="px-btn ghost" style={{ marginLeft: 'auto', flex: 'none' }} onClick={refileNow}>Move {refile.n} to the right test</button>}</div>}
            {chapterRule && planState(chapters) === 'multi' && <div className="msb-rule warn" role="alert"><Icon name="alert" size={18} /><span><b>The plan lists {chapters.length} chapters for {tid(testNo)} · {sec.short || section}.</b> Every teacher must set the one same chapter, so uploads are paused. An admin must keep just one in Mission Sainik → Syllabus.</span></div>}
            {offList.length > 0 && <div className="msb-rule warn" role="alert"><Icon name="alert" size={18} /><span><b>{offList.length} question{offList.length === 1 ? ' is' : 's are'} not on the planned chapter “{chapters[0]}”.</b> They are marked <i>Off plan</i> below. Fix or delete {offList.length === 1 ? 'it' : 'them'}; the section cannot be verified until then.</span>{mayEdit && offList.some(q => !String(q.topic || '').trim()) && <button type="button" className="px-btn ghost" style={{ marginLeft: 'auto', flex: 'none' }} onClick={tagUntagged}>Tag {offList.filter(q => !String(q.topic || '').trim()).length} untagged as this chapter</button>}</div>}
            {chapterRule && (chapters.length ? (
              <div className="msb-rule" role="note"><Icon name="syllabus" size={18} />{strictPlan
                ? <span><b>The paper holds {sec.q} questions per section.</b> Only {chapters.length === 1 ? 'the planned chapter is' : 'the planned chapters are'} accepted. Extra questions are saved to the practice set for {tid(testNo)} ({section}) under the same chapter.</span>
                : <span><b>Practice for {tid(testNo)} · {sec.short || section}.</b> Every practice teacher sets questions for every test, on that test's planned chapter — the same chapter as the Pre Mock test. Other chapters are not accepted.</span>}</div>
            ) : (
              <div className="msb-rule warn" role="note"><Icon name="alert" size={18} /><span><b>No chapter is planned yet</b> for {tid(testNo)} · {sec.short || section} (Mission Sainik → Syllabus). Any chapter is accepted until it is.{strictPlan ? ` The paper holds ${sec.q}; extras go to the practice set for ${tid(testNo)}.` : ''}</span></div>
            ))}
        {mayAdd ? (
          <>
            {chapters.length > 0 && (
              <div role="note" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 14, background: '#f6f1ff', border: '1px solid #d9ccf5' }}>
                <datalist id="msb-chapters">{chapters.map(ch => <option key={ch} value={ch} />)}</datalist>
                <b style={{ fontSize: 13, color: PX.navy }}>📘 Syllabus plan · {tid(testNo)} · {section}</b>
                <div style={{ fontSize: 12.5, color: PX.sub, margin: '2px 0 8px' }}>Set the questions on {chapters.length === 1 ? 'this chapter' : 'these chapters'}. {chapters.length > 1 ? 'Tap a chapter to tag the next upload with it. ' : 'New questions are tagged with it automatically. '}The number shows how many questions you already have on each.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {chapters.map(ch => { const on = chapterPick === ch || chapters.length === 1; return (
                    <button key={ch} type="button" aria-pressed={on} onClick={() => setChapterPick(chapterPick === ch ? '' : ch)} style={{ padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? '#7c3aed' : '#d9ccf5'}`, background: on ? '#ede4ff' : '#fff', color: '#4c1d95', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{ch} · {chapterCount(ch)}</button>) })}
                </div>
                {untagged > 0 && <div style={{ fontSize: 12, color: PX.warn, marginTop: 6 }}>{untagged} question{untagged === 1 ? '' : 's'} not tagged with a planned chapter.</div>}
              </div>)}
            <div className="msb-meth" data-ti-skip role="tablist" aria-label="How to add questions">
              {[['one', 'marks', 'One by one', 'Type a question, tap the answer. Saved instantly.', isMobile ? 'Best on a phone' : 'Easy to start'], ['cards', 'practice', 'Many at once', 'Fill several question cards, then upload together.', isMobile ? '' : 'Fastest on a computer'], ['paste', 'material', 'Paste or file', 'Bring questions from Word, a .txt or a .csv file.', 'Already typed?']].map(([k, ic, t, d, tag]) => (
                <button key={k} type="button" role="tab" aria-selected={addMode === k} className={addMode === k ? 'on' : ''} onClick={() => setAddMode(k)}>
                  <span className="ic"><Icon name={ic} size={20} /></span><b>{t}</b><small>{d}</small>{tag ? <em>{tag}</em> : null}
                </button>))}
            </div>
            {addMode !== 'one' && <div className="msb-how" aria-label="How it works">
              {(addMode === 'cards' ? ['Fill one card per question', 'Mark the answer (Alt + A to D)', 'Upload all cards together'] : ['Paste text or load a file', 'Check the preview it builds', 'Upload when it looks right']).map((t, i) => <span key={t}><i>{i + 1}</i>{t}</span>)}
            </div>}
            {addMode === 'one' ? (
              <MissionSainikQuickAdd key={`${testNo}:${section}`} chapters={chaptersOf(testNo, section)} strict={chapterRule && chaptersOf(testNo, section).length > 0} overflowLabel={strictPlan ? `${section} · practice for ${tid(testNo)}` : ''} count={myCount} need={sec.q} startNo={startOf(section) + myCount} busy={busy} isMobile={isMobile} onSave={q => insertQuestions([q])} />
            ) : addMode === 'cards' ? (
              <>
                <MultiQuestionAdder noExplanation chapters={chaptersOf(testNo, section)} key={`${series}:${testNo}:${section}`} draftKey={`msb-draft:${series}:${testNo}:${section}`} cards={cards} setCards={setCards} remaining={sec.q - myCount} startNo={startOf(section) + myCount} title={`Section: ${sec.title || section}`} existing={secList.map(q => q.question)} isMobile={isMobile} />
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
                {text.trim() ? (parsed.errors.length ? parsed.errors.slice(0, 2).join(' · ') : parsed.questions.length ? `${parsed.questions.length} question(s) ready to upload` : '⚠ ' + detectQuestions(text).text) : ''}
              </span>
              <button className="px-btn gold" style={{ marginLeft: 'auto' }} disabled={busy || !parsed.questions.length || parsed.errors.length > 0} onClick={upload}>{busy ? 'Uploading…' : '⬆ Upload questions'}</button>
            </div>
            <PastePreview questions={parsed.questions} errors={parsed.errors} startNo={startOf(section) + get(testNo, section).length} title={`Section: ${sec.title || section}`} />
              </>
            )}
            <details className="msb-more" open={byVersion || secList.length > sec.q || multiTeachers}>
              <summary>More about this section <small>· teachers, versions, backup &amp; restore</small></summary>
              <div className="in">
            {byVersion && flav.length > 0 && (
              <div role="note" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 14, background: '#f3f8ff', border: '1px solid #c9dcf7' }}>
                <b style={{ fontSize: 13, color: PX.navy }}>{flav.length > 1 ? `${flav.length} teachers each set their own ${sec.q} questions` : 'Each teacher sets their own set'}</b>
                <div style={{ fontSize: 12.5, color: PX.sub, marginTop: 2 }}>Every teacher writes a full set of {sec.q} questions for this practice test, so students receive different versions. Version A is the first teacher's set, B the second's, and so on.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {flav.map(f => <span key={f.by} style={{ padding: '3px 10px', borderRadius: 99, background: '#fff', border: `1px solid ${f.complete ? '#bfe3cc' : '#f1c9c4'}`, fontSize: 12, fontWeight: 700, color: f.complete ? PX.ok : PX.bad }}>Version {f.letter} · {fullName(f.by)} · {Math.min(f.count, sec.q)}/{sec.q}{f.complete ? ' ✓' : ''}</span>)}
                </div>
              </div>)}
            {!byVersion && (secList.length > sec.q || multiTeachers) && secList.length > 0 && (
              <div role="note" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 14, background: '#fffaf0', border: '1px solid #ecdcae' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13, color: PX.navy }}>{multiTeachers ? `${contribs.length} teachers set this ${cfg.noun === 'Set' ? 'set' : 'paper'}` : 'More questions than needed'}</b>
                  <span style={{ fontSize: 12.5, color: PX.sub }}>{secList.length} uploaded · the paper uses {Math.min(sec.q, secList.length)}{pickInfo.chosen ? ` · ${pickInfo.chosen} chosen by the admin` : ''}</span>
                  {isAdmin && secList.length > sec.q && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button type="button" className="px-hbtn" onClick={pickFirst} title={`Mark the first ${sec.q} questions as In paper`}>★ Pick first {sec.q}</button>
                    {pickInfo.chosen > 0 && <button type="button" className="px-hbtn" onClick={clearPicks}>Clear choices</button>}
                  </span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {contribs.map(c => <span key={c.name} style={{ padding: '3px 10px', borderRadius: 99, background: '#fff', border: `1px solid ${line}`, fontSize: 12, fontWeight: 700, color: PX.ink }}>{fullName(c.name)} · {c.n}{pickInfo.chosen || secList.length > sec.q ? <span style={{ color: PX.ok }}> · {c.used} in paper</span> : null}</span>)}
                </div>
                {secList.length > sec.q && <div style={{ fontSize: 12, color: pickInfo.over ? PX.bad : PX.sub, marginTop: 8 }}>
                  {isAdmin
                    ? (pickInfo.over ? `⚠ ${pickInfo.chosen} chosen but the paper needs ${sec.q}: only the first ${sec.q} chosen are used. Un-star the extras.`
                      : pickInfo.short ? `★ ${pickInfo.chosen} chosen; the other ${pickInfo.filled} places are filled with the earliest unchosen questions until you choose more.`
                        : `Star ★ the best ${sec.q} questions below. Until you do, the first ${sec.q} uploaded are used.`)
                    : 'The admin chooses which questions go into the paper.'}
                </div>}
              </div>)}
            {series === 'pre' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 12px', padding: '9px 12px', borderRadius: 14, background: byVersion ? '#f3f8ff' : '#fff', border: `1px solid ${byVersion ? '#c9dcf7' : line}`, cursor: isAdmin && onSetting ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={byVersion} disabled={!isAdmin || !onSetting} onChange={e => onSetting?.('pre_versions', e.target.checked)} />
                <span style={{ flex: '1 1 260px' }}><b style={{ fontSize: 13, color: PX.navy }}>Multiple sets on the same syllabus</b><span style={{ display: 'block', fontSize: 12.5, color: PX.sub }}>{byVersion ? 'Each teacher writes their own full set of questions for the same chapter. The paper prints as Version A, B, C so students get different versions.' : (isAdmin ? 'Off: teachers share one set (the admin picks the best questions). Turn on to let each teacher write a full set.' : 'Off: teachers share one set.')}</span></span>
              </label>)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px', padding: '8px 10px', borderRadius: 12, background: '#faf8f3', border: `1px solid ${line}` }}>
              <b style={{ fontSize: 12.5 }}>📦 Question bank</b>
              <button type="button" className="px-hbtn" onClick={() => exportBank('section')}>⬇ This section</button>
              {isAdmin && <button type="button" className="px-hbtn" onClick={() => exportBank('test')}>⬇ This {cfg.noun === 'Set' ? 'set' : 'test'}</button>}
              {isAdmin && <button type="button" className="px-hbtn" onClick={() => exportBank('all')}>⬇ Everything</button>}
              <label className="px-hbtn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>⬆ Import JSON<input type="file" accept=".json,application/json" aria-label="Import a question bank file" onChange={importBank} style={{ display: 'none' }} /></label>
              <span style={{ fontSize: 11.5, color: PX.sub }}>{isAdmin ? 'Back up, move to another series, or share with another institute. Duplicates are skipped.' : 'You can export or import your own section. Duplicates are skipped.'}</span>
            </div>
              </div>
            </details>
          </>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: PX.tint, fontSize: 13, color: PX.sub }}>
            🔒 {setterOnly ? <>Only the section setter can upload here: <b>{[...new Set(settersOf(testNo, section).map(fullName))].join(' / ') || 'none allotted yet — an admin must allot one in Panel'}</b>.{isAdmin ? ' As an admin you can verify, edit, delete, lock and choose questions.' : ''}</> : <>View only. Only {settersOf(testNo, section).map(fullName).join(' / ') || 'the section setter'} (or an admin) can upload to this section.</>}
          </div>
        )}
      </PremiumCard>
      </div>

      {!(showNotes || openNotes(testNo, section) > 0) ? <button type="button" className="px-btn ghost" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', margin: '0 0 14px', padding: '12px 16px', textAlign: 'left' }} onClick={() => setShowNotes(true)}><span><b>💬 Review notes ({notesOf(testNo, section).length})</b> <span style={{ color: PX.sub, fontSize: 12.5 }}>· ask a verifier for changes</span></span><span>▸</span></button> : <PremiumCard title={`Review notes (${notesOf(testNo, section).length})`} subtitle={`${tid(testNo)} · ${section} — a verifier can ask for changes here; open notes block verification until they are resolved`}>
        {openNotes(testNo, section) === 0 && <div style={{ textAlign: 'right', marginBottom: 6 }}><button type="button" className="px-hbtn" onClick={() => setShowNotes(false)}>Hide</button></div>}
        {notesOf(testNo, section).length === 0 && <div style={{ fontSize: 13, color: PX.sub, marginBottom: 8 }}>No notes yet.</div>}
        {notesOf(testNo, section).map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${line}`, opacity: r.status === 'resolved' ? 0.65 : 1 }}>
            <span style={{ fontSize: 18 }}>{r.status === 'resolved' ? '✅' : '💬'}</span>
            <div style={{ flex: 1, fontSize: 13.5 }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div>
              <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 2 }}>{r.author}{r.status === 'resolved' ? ` · resolved by ${r.resolved_by || '?'}` : ''}</div>
            </div>
            {r.status === 'open' ? <button className="px-hbtn" onClick={() => setNoteStatus(r, 'resolved')}>Resolve</button> : isAdmin ? <button className="px-hbtn" onClick={() => setNoteStatus(r, 'open')}>Reopen</button> : null}
            {(isAdmin || nameMatches(r.author, realFirst(currentUser?.matchName || currentUser?.name))) && <button className="px-hbtn" onClick={() => delNote(r)} aria-label="Delete note">🗑</button>}
          </div>))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="px-input" style={{ flex: '1 1 240px' }} value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="e.g. Q7 has two correct answers; Q12 needs an explanation" aria-label="New review note" />
          <button className="px-btn gold" onClick={addNote}>Add note</button>
        </div>
      </PremiumCard>}

      <PremiumCard title="Questions in this section" subtitle={secList.length ? 'Click a question to see its options and answer' : ''}
        right={mayEdit && secList.length ? <button className="px-hbtn" onClick={() => setPicked(picked.length === secList.filter(canModify).length ? [] : secList.filter(canModify).map(q => q.id))}>{picked.length === secList.filter(canModify).length ? 'Clear selection' : 'Select all'}</button> : null}>
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
          : !secList.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Nothing uploaded yet.</div> : listShown.slice(0, limN).map(({ q, i }) => (
          <div key={q.id} className="msb-q" style={{ borderTop: i ? `1px solid ${line}` : 'none', padding: isMobile ? '12px 0' : '8px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: isMobile ? 'center' : 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {canModify(q) && <input type="checkbox" aria-label={`Select question ${i + 1}`} checked={picked.includes(q.id)} onChange={() => toggle(q.id)} style={{ marginTop: 4 }} />}
              <button style={{ all: 'unset', cursor: 'pointer', flex: isMobile ? '1 1 calc(100% - 36px)' : 1, fontSize: isMobile ? 14.5 : 13.5, lineHeight: 1.45 }} onClick={() => setOpen(open === q.id ? '' : q.id)}><b>Q{startOf(section) + i}.</b> {q.passage ? <span title="Has a reading passage">📖 </span> : null}{q.image_data ? <span title="Has a figure">🖼 </span> : null}<span dangerouslySetInnerHTML={{ __html: mathToHtml(q.question) }} /></button>
              {secList.length > sec.q || multiTeachers ? <span title={q.uploaded_by ? `Set by ${fullName(q.uploaded_by)}` : ''} style={{ fontSize: 11, color: PX.sub, whiteSpace: 'nowrap' }}>{q.uploaded_by ? fullName(q.uploaded_by) : ''}</span> : null}
              {byVersion && flav.length > 0 && (() => { const f = flav.find(x => x.by === (String(q.uploaded_by || '').trim() || '(unknown)')); const idx = f ? f.items.findIndex(x => x.id === q.id) : -1; return f && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', background: idx < sec.q ? '#e8f0fe' : '#f1f3f7', color: idx < sec.q ? '#1d4ed8' : '#7b8799' }}>{idx < sec.q ? `Version ${f.letter} · Q${idx + 1}` : 'Extra'}</span> })()}
              {!byVersion && (secList.length > sec.q || pickInfo.chosen > 0) && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', background: usedIds.has(q.id) ? '#e6f5ec' : '#f1f3f7', color: usedIds.has(q.id) ? '#0f7a4c' : '#7b8799' }}>{usedIds.has(q.id) ? `In paper · Q${startOf(section) + usedList.findIndex(x => x.id === q.id)}` : 'Not used'}</span>}
              {isAdmin && !byVersion && (secList.length > sec.q || pickInfo.chosen > 0) && <button type="button" className="px-hbtn" onClick={() => toggleInPaper(q)} aria-pressed={!!q.in_paper} aria-label={q.in_paper ? 'Remove from the paper' : 'Use this question in the paper'} title={q.in_paper ? 'Chosen for the paper. Click to un-choose' : 'Choose this question for the paper'} style={{ color: q.in_paper ? '#b8923a' : undefined, fontSize: 16 }}>{q.in_paper ? '★' : '☆'}</button>}
              {chapterRule && chapters.length === 1 && !matchChapter(chapters, q.topic) && <span className="msb-off" title={`Planned chapter: ${chapters[0]}`}>Off plan</span>}
              {q.difficulty && <span style={{ fontSize: 11, color: PX.sub }}>{q.difficulty}</span>}
              {<button className="px-hbtn" onClick={() => { setStudio(q.id); setOpen('') }} aria-label={canModify(q) ? 'Edit question' : 'Open question'}>{canModify(q) ? '✎' : '👁'}</button>}
              {canModify(q) && <button className="px-hbtn" onClick={() => del(q)} aria-label="Delete question">🗑</button>}
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
                        <label style={lab}>Topic<input className="px-input" list="msb-chapters" value={editQ.topic || ''} onChange={e => set({ topic: e.target.value })} /></label>
                      </div>
                      {('passage' in editQ || 'image_data' in editQ) ? (
                        <>
                          <label style={lab}>Reading passage (printed once above a run of questions that share it)<textarea className="px-input" rows={3} value={editQ.passage || ''} onChange={e => set({ passage: e.target.value })} /></label>
                          <div style={{ ...lab, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>Figure</span>
                            {editQ.image_data && <img src={editQ.image_data} alt="Figure" style={{ maxHeight: 70, borderRadius: 8, border: `1px solid ${line}` }} />}
                            <input type="file" accept="image/*" aria-label="Attach a figure" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { set({ image_data: await figFromFile(f) }) } catch (er) { setMsg('❌ ' + er.message) } e.target.value = '' }} />
                            <button className="px-btn ghost" type="button" onClick={() => setScanEdit(true)}>📷 Scan figure</button>
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
                {['A', 'B', 'C', 'D'].map(k => <div key={k} style={{ fontWeight: q.answer === k ? 700 : 400, color: q.answer === k ? PX.ok : undefined }}>({k}) <span dangerouslySetInnerHTML={{ __html: mathToHtml(q['option_' + k.toLowerCase()]) }} />{q.answer === k ? ' ✓' : ''}</div>)}
                {q.explanation && <div style={{ color: PX.sub }}>Exp: <span dangerouslySetInnerHTML={{ __html: mathToHtml(q.explanation) }} /></div>}
                <div style={{ color: PX.sub, fontSize: 12 }}>{[q.topic, q.uploaded_by].filter(Boolean).join(' · ')}</div>
              </div>
            )}
          </div>
        ))}
        {listShown.length > limN && <div style={{ textAlign: 'center', paddingTop: 10, borderTop: `1px solid ${line}` }}><button type="button" className="px-btn ghost" onClick={() => setLim({ k: `${testNo}|${section}|${qSearch}|${qLevel}`, n: limN + 15 })}>Show {Math.min(15, listShown.length - limN)} more · {limN} of {listShown.length} shown</button></div>}
      </PremiumCard>
      {binCount > 0 && (!showBin ? <button type="button" className="px-btn ghost" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', margin: '0 0 14px', padding: '12px 16px', textAlign: 'left' }} onClick={() => setShowBin(true)}><span><b>🗑 Recycle bin ({binCount})</b> <span style={{ color: PX.sub, fontSize: 12.5 }}>· restore deleted questions</span></span><span>▸</span></button> : <PremiumCard title={`Recycle bin (${binCount})`} subtitle="Deleted questions can be restored by the setter or an admin" right={<button className="px-hbtn" onClick={() => setShowBin(v => !v)}>{showBin ? 'Hide' : 'Show'}</button>}>
        {showBin && (bin === null ? <div style={{ padding: 12, color: PX.sub, fontSize: 13 }}>Loading…</div> : !bin.length ? <div style={{ padding: 12, color: PX.sub, fontSize: 13 }}>Empty.</div> : bin.slice(0, 100).map(q => (
          <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: `1px solid ${line}`, fontSize: 13 }}>
            <span style={{ flex: 1 }}>{embargoed(q.test_no, q.section) ? '(hidden until test date)' : q.question.slice(0, 90)} <span style={{ color: PX.sub, fontSize: 11 }}>· {tid(q.test_no)} · {q.section} · deleted by {q.deleted_by || '?'}</span></span>
            {canModify(q) && <button className="px-hbtn" onClick={() => restore(q)}>↩ Restore</button>}
            {isAdmin && <button className="px-hbtn" onClick={() => purge(q)} aria-label="Delete forever">✖</button>}
          </div>)))}
      </PremiumCard>)}
      {preview && (
        <PaperPreview html={preview.html} title={preview.title} isAdmin={isAdmin} restart={!!cfg.restart} onClose={() => setPreview(null)}
          onPrint={out => { if (!preview.key && !okToPrint(preview.t)) return; audit(preview.key ? 'print_key' : 'print_paper', `${series}:${preview.t}`, { from: 'preview' }); const w = window.open('', '_blank'); if (!w) return setMsg('❌ Allow pop-ups to print'); w.document.write(out.replace('</body>', '<script>window.onload=()=>window.print()</script></body>')); w.document.close() }} />
      )}
      {studio != null && secList.some(x => x.id === studio) && (
        <QuestionEditor list={secList} startIndex={secList.findIndex(x => x.id === studio)} startNo={startOf(section)} title={`${sec.title || section}`} subtitle={`${tid(testNo)} · ${section}`}
          canEdit={(() => { const sq = secList.find(x => x.id === studio); return !!sq && canModify(sq) && !embargoed(testNo, section) })()} hasPictureCols={secList.some(x => 'passage' in x || 'image_data' in x)} isMobile={isMobile} onSave={saveQuestionPatch} onDelete={del} onClose={() => setStudio(null)} setMsg={setMsg} />
      )}
      {scanEdit && editQ && <ScanFigure onDone={u => { setEditQ(q => ({ ...q, image_data: u })); setScanEdit(false) }} onClose={() => setScanEdit(false)} />}
      {isMobile && mayAdd && !editorInView && !embargoed(testNo, section) && <button type="button" className="msb-fab" onClick={() => jump('msb-editor')}>＋ Add questions</button>}
    </div>
  )
}

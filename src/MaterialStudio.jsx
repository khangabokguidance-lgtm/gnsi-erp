// MaterialStudio.jsx — GNSI Portal · Teaching → Material Studio
//
// One place for any teaching staff member to prepare class material:
//   1. Search every Question Bank question and every study material together
//      (course / subject / chapter / difficulty / type filters, text search).
//   2. Collect what they want into a tray (kept per user in this browser).
//   3. Turn the tray into a finished design — worksheet, test paper (A/B),
//      slides, revision notes or flashcards — with a live preview, print /
//      PDF, Word and PowerPoint downloads.
// Teaching staff may correct a question or material in place; only admins
// may delete (row-level security enforces the same on the server).

import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { PX, PremiumCard, PIcon } from './premiumUI'
import { COURSES, COURSE_LIST } from './qbankTaxonomy'
import { SUBJECT_TO_QBANK, normalizeToQBank, openChapterIn } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { isAdminRole } from './roles'
import {
  DESIGNS, DEFAULT_OPTIONS, MATERIAL_TYPES, buildHtml, openPrintWindow, downloadWord, downloadPptx, questionsOf, materialsOf,
} from './studioDesigns'

const PAGE = 30
const Q_FIELDS = 'id,question,option_a,option_b,option_c,option_d,correct_option,subject,chapter,subsection,difficulty,diagram_url,course,marks'
const DIFFS = ['Easy', 'Medium', 'Hard']
const clean = s => String(s || '').replace(/[%_,()"'\\*]/g, ' ').replace(/\s+/g, ' ').trim()
const trayKey = u => `gnsi_studio_tray_${u?.username || u?.name || 'me'}`
const readTray = u => { try { return JSON.parse(localStorage.getItem(trayKey(u)) || '[]') } catch { return [] } }

const STYLES = `
  .ms-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
  .ms-compose{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:980px){.ms-grid,.ms-compose{grid-template-columns:minmax(0,1fr)}}
  .ms-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  .ms-item{border:1px solid ${PX.line};border-radius:14px;padding:12px 14px;background:#fff;transition:border-color .15s}
  .ms-item.in{border-color:${PX.gold};background:#fffcf4}
  .ms-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#f3f0e8;color:${PX.sub};white-space:nowrap}
  .ms-chip.gold{background:${PX.goldBg};color:#8a6118}.ms-chip.navy{background:#e4ebf6;color:${PX.navy}}.ms-chip.ok{background:${PX.okBg};color:${PX.ok}}
  .ms-opt{padding:3px 8px;border-radius:8px;background:${PX.tint};font-size:12.5px}
  .ms-opt.ok{background:${PX.okBg};color:${PX.ok};font-weight:700}
  .ms-sm{padding:6px 11px!important;font-size:12px!important;border-radius:9px!important}
  .ms-design{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:10px 12px;border:1px solid ${PX.line};border-radius:12px;background:#fff;cursor:pointer;font-family:inherit;width:100%}
  .ms-design.on{border-color:${PX.gold};background:${PX.goldBg};box-shadow:0 0 0 3px rgba(184,146,58,.14)}
  .ms-label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${PX.sub};margin:10px 0 4px}
  .ms-seg{display:inline-flex;gap:3px;padding:3px;border:1px solid ${PX.line};border-radius:11px;background:#fff}
  .ms-seg button{border:none;background:none;padding:6px 12px;border-radius:8px;font:600 12.5px/1 inherit;cursor:pointer;color:${PX.sub};font-family:inherit}
  .ms-seg button.on{background:${PX.navy};color:#fff}
  .ms-modal-bg{position:fixed;inset:0;background:rgba(14,32,63,.45);display:flex;align-items:flex-start;justify-content:center;z-index:1000;padding:4vh 12px;overflow-y:auto}
  .ms-modal{background:#fff;border-radius:18px;width:100%;max-width:760px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(14,32,63,.5)}
`

// ═══════════════════════════════════════════════════════════════════════════
export default function MaterialStudio({ currentUser, onNavigate }) {
  const canDelete = isAdminRole(currentUser?.role)
  const [view, setView] = useState('search')
  const [tray, setTray] = useState(() => readTray(currentUser))
  const [toast, setToast] = useState(null)
  useEffect(() => { try { localStorage.setItem(trayKey(currentUser), JSON.stringify(tray)) } catch { /* storage full / private mode */ } }, [tray, currentUser])

  const notify = (msg, tone = 'navy') => {
    const at = Date.now()
    setToast({ msg, tone, at })
    setTimeout(() => setToast(t => (t?.at === at ? null : t)), 3200)
  }
  const inTray = (kind, id) => tray.some(t => t.kind === kind && t.id === id)
  const toggle = (kind, row) => setTray(t => (t.some(x => x.kind === kind && x.id === row.id) ? t.filter(x => !(x.kind === kind && x.id === row.id)) : [...t, { kind, id: row.id, row }]))
  const addMany = (kind, rows) => setTray(t => [...t, ...rows.filter(r => !t.some(x => x.kind === kind && x.id === r.id)).map(r => ({ kind, id: r.id, row: r }))])
  const updateRow = (kind, row) => setTray(t => t.map(x => (x.kind === kind && x.id === row.id ? { ...x, row } : x)))
  const removeRow = (kind, id) => setTray(t => t.filter(x => !(x.kind === kind && x.id === id)))

  return (
    <div>
      <style>{STYLES}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="px-eyebrow">Material Studio</div>
          <div className="px-h2">Find it, collect it, design it</div>
        </div>
        <div className="ms-seg" role="tablist" aria-label="Studio view">
          <button role="tab" aria-selected={view === 'search'} className={view === 'search' ? 'on' : ''} onClick={() => setView('search')}>① Search & collect</button>
          <button role="tab" aria-selected={view === 'compose'} className={view === 'compose' ? 'on' : ''} onClick={() => setView('compose')}>② Design ({tray.length})</button>
        </div>
      </div>

      {view === 'search' ? (
        <div className="ms-grid">
          <SearchPanel inTray={inTray} toggle={toggle} addMany={addMany} canDelete={canDelete} notify={notify} onNavigate={onNavigate}
            onEdited={updateRow} onDeleted={removeRow} user={currentUser} />
          <TrayPanel tray={tray} setTray={setTray} onCompose={() => setView('compose')} />
        </div>
      ) : (
        <Composer tray={tray} setTray={setTray} user={currentUser} notify={notify} onBack={() => setView('search')} />
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: toast.tone === 'bad' ? PX.bad : toast.tone === 'ok' ? PX.ok : PX.navy, color: '#fff', padding: '11px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: '0 14px 30px -10px rgba(0,0,0,.4)', maxWidth: 'calc(100vw - 32px)' }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════════════════
function SearchPanel({ inTray, toggle, addMany, canDelete, notify, onNavigate, onEdited, onDeleted, user }) {
  const [f, setF] = useState({ text: '', scope: 'all', course: '', subject: '', chapter: '', difficulty: '', type: '' })
  const [applied, setApplied] = useState(f)
  const [res, setRes] = useState({ key: '', qs: [], qCount: 0, mats: [], mCount: 0, qPage: 0, mPage: 0 })
  const [busy, setBusy] = useState(false)
  const [editQ, setEditQ] = useState(null)
  const [editM, setEditM] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const set = p => setF(x => ({ ...x, ...p }))

  const subjects = f.course ? Object.keys(COURSES[f.course]?.subjects || {}) : [...new Set(Object.values(COURSES).flatMap(c => Object.keys(c.subjects)))]
  const chapters = f.course && f.subject ? COURSES[f.course]?.subjects?.[f.subject] || [] : []
  const key = JSON.stringify(applied) + refresh

  // Fresh search whenever the applied filters change.
  useEffect(() => {
    let live = true
    Promise.all([runQ(applied, 0), runM(applied, 0)]).then(([q, m]) => {
      if (live) setRes({ key, qs: q.data, qCount: q.count, mats: m.data, mCount: m.count, qPage: 0, mPage: 0, error: q.error || m.error })
    })
    return () => { live = false }
  }, [key, applied])
  const loading = res.key !== key

  const more = async kind => {
    setBusy(true)
    if (kind === 'q') { const p = res.qPage + 1; const q = await runQ(applied, p); setRes(r => ({ ...r, qs: [...r.qs, ...q.data], qPage: p })) }
    else { const p = res.mPage + 1; const m = await runM(applied, p); setRes(r => ({ ...r, mats: [...r.mats, ...m.data], mPage: p })) }
    setBusy(false)
  }

  const delQ = async q => {
    if (!confirm('Delete this question from the Question Bank for everyone?')) return
    const { error, count } = await supabase.from('qbank_questions').delete({ count: 'exact' }).eq('id', q.id)
    if (error || !count) return notify(error?.message || 'Not deleted — you may lack permission', 'bad')
    EventBus.emit(GNSI_EVENTS.QUESTION_SAVED, { deleted: q.id })
    onDeleted('q', q.id); notify('Question deleted', 'ok'); setRefresh(n => n + 1)
  }
  const delM = async m => {
    if (!confirm(`Delete "${m.title}" from Study Materials for everyone?`)) return
    const { error, count } = await supabase.from('study_materials').delete({ count: 'exact' }).eq('id', m.id)
    if (error || !count) return notify(error?.message || 'Not deleted — you may lack permission', 'bad')
    EventBus.emit(GNSI_EVENTS.MATERIAL_SAVED, { deleted: m.id })
    onDeleted('m', m.id); notify('Material deleted', 'ok'); setRefresh(n => n + 1)
  }

  const showQ = applied.scope !== 'materials', showM = applied.scope !== 'questions'
  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      <PremiumCard title="Search everything" subtitle="Question Bank questions and study materials, all courses">
        <form onSubmit={e => { e.preventDefault(); setApplied(f) }} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="px-input" style={{ fontSize: 15 }} placeholder="Search words in questions, material titles and notes…" value={f.text} onChange={e => set({ text: e.target.value })} aria-label="Search text" />
            <button className="px-btn" type="submit">Search</button>
          </div>
          <div className="ms-filters">
            <select className="px-input" value={f.scope} onChange={e => set({ scope: e.target.value })} aria-label="Search in">
              <option value="all">Questions + materials</option><option value="questions">Questions only</option><option value="materials">Materials only</option>
            </select>
            <select className="px-input" value={f.course} onChange={e => set({ course: e.target.value, subject: '', chapter: '' })} aria-label="Course">
              <option value="">All courses</option>{COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}
            </select>
            <select className="px-input" value={f.subject} onChange={e => set({ subject: e.target.value, chapter: '' })} aria-label="Subject">
              <option value="">All subjects</option>{subjects.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="px-input" value={f.chapter} disabled={!chapters.length} onChange={e => set({ chapter: e.target.value })} aria-label="Chapter">
              <option value="">{chapters.length ? 'All chapters' : 'Pick course + subject'}</option>{chapters.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="px-input" value={f.difficulty} onChange={e => set({ difficulty: e.target.value })} aria-label="Difficulty">
              <option value="">Any difficulty</option>{DIFFS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="px-input" value={f.type} onChange={e => set({ type: e.target.value })} aria-label="Material type">
              <option value="">Any material type</option>{Object.entries(MATERIAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: PX.faint }}>Filters apply when you press Search. Difficulty applies to questions, type to materials.</span>
            <button type="button" className="px-btn ghost ms-sm" onClick={() => { const blank = { text: '', scope: 'all', course: '', subject: '', chapter: '', difficulty: '', type: '' }; setF(blank); setApplied(blank) }}>Clear</button>
          </div>
        </form>
      </PremiumCard>

      {res.error && <div style={{ background: PX.badBg, color: PX.bad, borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>Search failed: {res.error.message}</div>}

      {showQ && (
        <PremiumCard title={`Questions${loading ? '' : ` · ${res.qCount}`}`} subtitle="Tick to add to your tray. Answers are shown in green."
          right={!loading && res.qs.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => addMany('q', res.qs)}>+ Add all {res.qs.length}</button>}>
          {loading ? <Muted>Searching…</Muted> : res.qs.length === 0 ? <Muted>No questions match.</Muted> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {res.qs.map(q => <QuestionItem key={q.id} q={q} on={inTray('q', q.id)} onToggle={() => toggle('q', q)} onEdit={() => setEditQ(q)} onDelete={canDelete ? () => delQ(q) : null} onNavigate={onNavigate} />)}
              {res.qs.length < res.qCount && <button className="px-btn ghost" disabled={busy} onClick={() => more('q')}>{busy ? 'Loading…' : `Show more (${res.qCount - res.qs.length} left)`}</button>}
            </div>
          )}
        </PremiumCard>
      )}

      {showM && (
        <PremiumCard title={`Study materials${loading ? '' : ` · ${res.mCount}`}`} subtitle="Notes, formula sheets, practice sets, videos and more"
          right={!loading && res.mats.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => addMany('m', res.mats)}>+ Add all {res.mats.length}</button>}>
          {loading ? <Muted>Searching…</Muted> : res.mats.length === 0 ? <Muted>No materials match.</Muted> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {res.mats.map(m => <MaterialItem key={m.id} m={m} on={inTray('m', m.id)} onToggle={() => toggle('m', m)} onEdit={() => setEditM(m)} onDelete={canDelete ? () => delM(m) : null} />)}
              {res.mats.length < res.mCount && <button className="px-btn ghost" disabled={busy} onClick={() => more('m')}>{busy ? 'Loading…' : `Show more (${res.mCount - res.mats.length} left)`}</button>}
            </div>
          )}
        </PremiumCard>
      )}

      {editQ && <EditQuestion q={editQ} user={user} onClose={() => setEditQ(null)} notify={notify}
        onSaved={row => { setRes(r => ({ ...r, qs: r.qs.map(x => (x.id === row.id ? row : x)) })); onEdited('q', row); setEditQ(null) }} />}
      {editM && <EditMaterial m={editM} onClose={() => setEditM(null)} notify={notify}
        onSaved={row => { setRes(r => ({ ...r, mats: r.mats.map(x => (x.id === row.id ? row : x)) })); onEdited('m', row); setEditM(null) }} />}
    </div>
  )
}

// Question Bank query. Untagged (course null) questions are Sainik-shaped
// legacy rows, so a Sainik search includes them — same as the Question Bank.
async function runQ(f, page) {
  if (f.scope === 'materials') return { data: [], count: 0 }
  let q = supabase.from('qbank_questions').select(Q_FIELDS, { count: 'exact' })
  if (f.course === 'sainik') q = q.or('course.eq.sainik,course.is.null')
  else if (f.course) q = q.eq('course', f.course)
  if (f.subject) q = q.eq('subject', f.subject)
  if (f.chapter) q = q.eq('chapter', f.chapter)
  if (f.difficulty) q = q.eq('difficulty', f.difficulty)
  for (const w of clean(f.text).split(' ').filter(Boolean)) q = q.ilike('question', `%${w}%`)
  const { data, count, error } = await q.order('id', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
  return { data: data || [], count: count || 0, error }
}

// Study materials use each module's own subject names (English Language,
// Arithmetic…), so a subject filter matches every name that maps to it.
async function runM(f, page) {
  if (f.scope === 'questions') return { data: [], count: 0 }
  let q = supabase.from('study_materials').select('id,title,description,material_type,file_url,course,subject,chapter,created_at', { count: 'exact' })
  if (f.course) q = q.eq('course', f.course)
  if (f.subject) {
    const target = normalizeToQBank(f.subject)
    q = q.in('subject', [...new Set([f.subject, ...Object.keys(SUBJECT_TO_QBANK).filter(k => SUBJECT_TO_QBANK[k] === target)])])
  }
  if (f.chapter) q = q.eq('chapter', f.chapter)
  if (f.type) q = q.eq('material_type', f.type)
  const t = clean(f.text)
  if (t) q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%,chapter.ilike.%${t}%`)
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
  return { data: data || [], count: count || 0, error }
}

const Muted = ({ children }) => <div style={{ color: PX.sub, fontSize: 13, padding: '8px 0' }}>{children}</div>

function QuestionItem({ q, on, onToggle, onEdit, onDelete, onNavigate }) {
  return (
    <div className={'ms-item' + (on ? ' in' : '')}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={on} onChange={onToggle} aria-label="Add question to tray" style={{ marginTop: 4, width: 17, height: 17, accentColor: PX.gold }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: PX.ink, whiteSpace: 'pre-wrap' }}>{q.question}</div>
          {q.diagram_url && <img src={q.diagram_url} alt="" style={{ maxHeight: 90, maxWidth: '100%', marginTop: 6, borderRadius: 8 }} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 4, marginTop: 6 }}>
            {['a', 'b', 'c', 'd'].filter(k => q[`option_${k}`]).map(k => (
              <div key={k} className={'ms-opt' + (q.correct_option === k.toUpperCase() ? ' ok' : '')}>({k.toUpperCase()}) {q[`option_${k}`]}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
            {q.course && <span className="ms-chip navy">{COURSES[q.course]?.short || q.course}</span>}
            <span className="ms-chip">{q.subject}</span>
            {q.chapter && <button className="ms-chip gold" style={{ border: 'none', cursor: 'pointer' }} title="Open this chapter in the Chapter Hub"
              onClick={() => openChapterIn('hub', { course: q.course || 'sainik', subject: q.subject, chapter: q.chapter }, onNavigate)}>🎯 {q.chapter}</button>}
            {q.difficulty && <span className={'ms-chip' + (q.difficulty === 'Easy' ? ' ok' : '')}>{q.difficulty}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="px-btn ghost ms-sm" onClick={onEdit}>Edit</button>
              {onDelete && <button className="px-btn ghost ms-sm" style={{ color: PX.bad }} onClick={onDelete}>Delete</button>}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MaterialItem({ m, on, onToggle, onEdit, onDelete }) {
  const t = MATERIAL_TYPES[m.material_type] || { label: m.material_type || 'Material', icon: '📄' }
  return (
    <div className={'ms-item' + (on ? ' in' : '')}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={on} onChange={onToggle} aria-label="Add material to tray" style={{ marginTop: 4, width: 17, height: 17, accentColor: PX.gold }} />
        <div style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: PX.ink }}>{m.title}</div>
          {m.description && <div style={{ fontSize: 12.5, color: PX.sub, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.description}</div>}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
            <span className="ms-chip gold">{t.label}</span>
            {m.course && <span className="ms-chip navy">{COURSES[m.course]?.short || m.course}</span>}
            {m.subject && <span className="ms-chip">{m.subject}</span>}
            {m.chapter && <span className="ms-chip">{m.chapter}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {m.file_url && <a className="px-btn ghost ms-sm" href={m.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Open ↗</a>}
              <button className="px-btn ghost ms-sm" onClick={onEdit}>Edit</button>
              {onDelete && <button className="px-btn ghost ms-sm" style={{ color: PX.bad }} onClick={onDelete}>Delete</button>}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tray
// ═══════════════════════════════════════════════════════════════════════════
function TrayPanel({ tray, setTray, onCompose }) {
  const move = (i, d) => setTray(t => { const a = [...t]; const j = i + d; if (j < 0 || j >= a.length) return a;[a[i], a[j]] = [a[j], a[i]]; return a })
  const nq = questionsOf(tray).length, nm = materialsOf(tray).length
  return (
    <div style={{ position: 'sticky', top: 12 }}>
      <PremiumCard title="Your tray" subtitle={`${nq} question${nq === 1 ? '' : 's'} · ${nm} material${nm === 1 ? '' : 's'}`}
        right={tray.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => confirm('Empty the tray?') && setTray([])}>Clear</button>}
        bodyStyle={{ padding: '12px 14px' }}>
        {tray.length === 0 ? <Muted>Tick questions and materials to collect them here. The tray is saved in this browser.</Muted> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 6, maxHeight: '52vh', overflowY: 'auto' }}>
            {tray.map((it, i) => (
              <div key={it.kind + it.id} style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, border: `1px solid ${PX.line}`, borderRadius: 10, padding: '6px 8px', fontSize: 12.5 }}>
                <span style={{ color: PX.faint, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                <span title={it.kind === 'q' ? 'Question' : 'Material'}>{it.kind === 'q' ? '❓' : (MATERIAL_TYPES[it.row.material_type]?.icon || '📄')}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.kind === 'q' ? it.row.question : it.row.title}</span>
                <button className="px-btn ghost ms-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button className="px-btn ghost ms-sm" onClick={() => move(i, 1)} disabled={i === tray.length - 1} aria-label="Move down">↓</button>
                <button className="px-btn ghost ms-sm" style={{ color: PX.bad }} onClick={() => setTray(t => t.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
        )}
        <button className="px-btn gold" style={{ width: '100%', marginTop: 12 }} disabled={!tray.length} onClick={onCompose}>Design material →</button>
      </PremiumCard>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Composer — pick a design, set options, preview, export
// ═══════════════════════════════════════════════════════════════════════════
function Composer({ tray, setTray, user, notify, onBack }) {
  const [design, setDesign] = useState('worksheet')
  const [o, setO] = useState(() => ({ ...DEFAULT_OPTIONS, teacher: user?.name || '' }))
  const [html, setHtml] = useState({ key: '', doc: '' })
  const [busy, setBusy] = useState('')
  const set = p => setO(x => ({ ...x, ...p }))
  const key = JSON.stringify([design, o, tray.map(t => t.kind + t.id + (t.row.question || t.row.title || '') + (t.row.correct_option || ''))])
  const nq = questionsOf(tray).length, nm = materialsOf(tray).length

  useEffect(() => {
    let live = true
    const t = setTimeout(() => { buildHtml(design, tray, o).then(doc => { if (live) setHtml({ key, doc }) }) }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [key, design, tray, o])

  const needs = useMemo(() => {
    if (['worksheet', 'test', 'flashcards'].includes(design) && !nq && !(design === 'flashcards' && nm)) return 'This design needs questions in the tray.'
    if (design === 'notes' && !nm && !nq) return 'Add study materials (and optionally questions) to the tray.'
    return ''
  }, [design, nq, nm])

  const print = async () => {
    const w = openPrintWindow()
    if (!w) return notify('Allow pop-ups for this site to print', 'bad')
    const doc = await buildHtml(design, tray, o, { autoPrint: true })
    w.document.open(); w.document.write(doc); w.document.close()
  }
  const word = async () => { setBusy('word'); try { await downloadWord(design, tray, o); notify('Word file downloaded', 'ok') } catch (e) { notify(e.message, 'bad') } setBusy('') }
  const pptx = async () => { setBusy('pptx'); try { await downloadPptx(tray, o); notify('PowerPoint downloaded', 'ok') } catch (e) { notify(e.message, 'bad') } setBusy('') }

  const isPrint = design !== 'slides'
  return (
    <div className="ms-compose">
      <div style={{ display: 'grid', gap: 14 }}>
        <PremiumCard title="Design" subtitle={`${nq} questions · ${nm} materials in the tray`} right={<button className="px-btn ghost ms-sm" onClick={onBack}>← Tray</button>} bodyStyle={{ padding: '12px 14px' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {DESIGNS.map(d => (
              <button key={d.id} className={'ms-design' + (design === d.id ? ' on' : '')} onClick={() => setDesign(d.id)} aria-pressed={design === d.id}>
                <span style={{ fontSize: 22 }}>{d.icon}</span>
                <span><b style={{ color: PX.ink }}>{d.label}</b><br /><span style={{ fontSize: 12, color: PX.sub }}>{d.desc}</span></span>
              </button>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard title="Options" bodyStyle={{ padding: '4px 14px 14px' }}>
          <label className="ms-label">Title</label>
          <input className="px-input" value={o.title} onChange={e => set({ title: e.target.value })} placeholder={DESIGNS.find(d => d.id === design).label} />
          <label className="ms-label">Class / batch · subtitle</label>
          <input className="px-input" value={o.subtitle} onChange={e => set({ subtitle: e.target.value })} placeholder="e.g. Sainik 6A · Mathematics" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label className="ms-label">Date</label><input type="date" className="px-input" value={o.date} onChange={e => set({ date: e.target.value })} /></div>
            <div><label className="ms-label">Teacher</label><input className="px-input" value={o.teacher} onChange={e => set({ teacher: e.target.value })} /></div>
          </div>
          {design !== 'flashcards' && <><label className="ms-label">Instructions</label><textarea rows={2} className="px-input" value={o.instructions} onChange={e => set({ instructions: e.target.value })} /></>}

          {(design === 'worksheet' || design === 'test') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label className="ms-label">Columns</label><select className="px-input" value={o.columns} onChange={e => set({ columns: Number(e.target.value) })}><option value={1}>One</option><option value={2}>Two</option></select></div>
              <div><label className="ms-label">Group by</label><select className="px-input" value={o.sectionBy} onChange={e => set({ sectionBy: e.target.value })}><option value="subject">Subject</option><option value="chapter">Chapter</option><option value="none">No sections</option></select></div>
              <div><label className="ms-label">Answer space</label><select className="px-input" value={o.answerSpace} onChange={e => set({ answerSpace: e.target.value })}><option value="none">None (MCQ)</option><option value="lines">Lines</option><option value="box">Working box</option></select></div>
              <div><label className="ms-label">Text size</label><select className="px-input" value={o.fontSize} onChange={e => set({ fontSize: e.target.value })}><option value="S">Small</option><option value="M">Medium</option><option value="L">Large</option></select></div>
            </div>
          )}
          {design === 'test' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><label className="ms-label">Marks each</label><input type="number" min="0" step="0.5" className="px-input" value={o.marksEach} onChange={e => set({ marksEach: e.target.value })} /></div>
              <div><label className="ms-label">Minutes</label><input type="number" min="1" className="px-input" value={o.duration} onChange={e => set({ duration: e.target.value })} /></div>
              <div><label className="ms-label">Versions</label><select className="px-input" value={o.versions} onChange={e => set({ versions: Number(e.target.value) })}><option value={1}>A only</option><option value={2}>A + B</option></select></div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 13 }}>
            {(design === 'worksheet' || design === 'test') && <Check label="Separate answer key page" v={o.answerKey} on={v => set({ answerKey: v })} />}
            {design === 'test' && <Check label="Shuffle question order (version A too)" v={o.shuffle} on={v => set({ shuffle: v })} />}
            {design !== 'flashcards' && <Check label="Show subject · chapter tags" v={o.showTags} on={v => set({ showTags: v })} />}
            {(design === 'slides' || design === 'notes') && <Check label={design === 'slides' ? 'Add an answer-reveal slide after each question' : 'Show answers to key questions'} v={o.revealAnswers} on={v => set({ revealAnswers: v })} />}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard title="Preview" subtitle={isPrint ? 'Exactly what prints — A4' : 'Slide preview — download for the real PowerPoint'}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isPrint && <button className="px-btn gold ms-sm" disabled={!!needs} onClick={print}><PIcon.print size={13} />Print / PDF</button>}
          {isPrint && <button className="px-btn ghost ms-sm" disabled={!!needs || !!busy} onClick={word}><PIcon.download size={13} />{busy === 'word' ? 'Preparing…' : 'Word'}</button>}
          {!isPrint && <button className="px-btn gold ms-sm" disabled={!tray.length || !!busy} onClick={pptx}><PIcon.download size={13} />{busy === 'pptx' ? 'Building…' : 'PowerPoint (.pptx)'}</button>}
        </div>}
        bodyStyle={{ padding: 12, background: PX.tint }}>
        {!tray.length ? <Muted>The tray is empty — go back and collect some questions or materials.</Muted> : (
          <>
            {needs && <div style={{ background: PX.warnBg, color: PX.warn, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 10 }}>{needs}</div>}
            <iframe title="Design preview" sandbox="" srcDoc={html.doc} style={{ width: '100%', height: '78vh', border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff', opacity: html.key === key ? 1 : 0.6, transition: 'opacity .15s' }} />
            <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 8 }}>Tip: reorder items in the tray to change the order here. {design === 'flashcards' && 'Print double-sided (flip on long edge) so answers land behind their questions.'}</div>
            <button className="px-btn ghost ms-sm" style={{ marginTop: 8 }} onClick={() => confirm('Empty the tray?') && setTray([])}>Empty tray</button>
          </>
        )}
      </PremiumCard>
    </div>
  )
}

const Check = ({ label, v, on }) => (
  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
    <input type="checkbox" checked={!!v} onChange={e => on(e.target.checked)} style={{ accentColor: PX.gold }} />{label}
  </label>
)

// ═══════════════════════════════════════════════════════════════════════════
// Editors (teaching staff edit; delete stays admin-only)
// ═══════════════════════════════════════════════════════════════════════════
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="ms-modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="ms-modal" role="dialog" aria-label={title}>
        <div className="px-card-h"><span className="bar" /><div className="px-card-t" style={{ flex: 1 }}>{title}</div><button className="px-btn ghost ms-sm" onClick={onClose} aria-label="Close">✕</button></div>
        <div style={{ padding: '6px 20px 16px', maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${PX.line}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: PX.tint }}>{footer}</div>
      </div>
    </div>
  )
}

function EditQuestion({ q, onClose, onSaved, notify }) {
  const [f, setF] = useState(q)
  const [saving, setSaving] = useState(false)
  const set = p => setF(x => ({ ...x, ...p }))
  const course = f.course || 'sainik'
  const chapters = COURSES[course]?.subjects?.[f.subject] || []
  const save = async () => {
    const missing = []
    if (!f.question?.trim()) missing.push('question')
    if (!f.option_a?.trim() || !f.option_b?.trim()) missing.push('options A and B')
    if (!['A', 'B', 'C', 'D'].includes(f.correct_option)) missing.push('correct answer')
    if (missing.length) return notify(`Fill in: ${missing.join(', ')}`, 'bad')
    setSaving(true)
    const patch = { question: f.question.trim(), option_a: f.option_a, option_b: f.option_b, option_c: f.option_c || '', option_d: f.option_d || '', correct_option: f.correct_option, chapter: f.chapter, difficulty: f.difficulty }
    const { data, error } = await supabase.from('qbank_questions').update(patch).eq('id', q.id).select(Q_FIELDS)
    setSaving(false)
    if (error || !data?.length) return notify(error?.message || 'Not saved — you may lack permission', 'bad')
    EventBus.emit(GNSI_EVENTS.QUESTION_SAVED, { id: q.id })
    notify('Question updated', 'ok'); onSaved(data[0])
  }
  return (
    <Modal title="Edit question" onClose={onClose} footer={<><button className="px-btn ghost" onClick={onClose}>Cancel</button><button className="px-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <label className="ms-label">Question</label>
      <textarea rows={3} className="px-input" value={f.question || ''} onChange={e => set({ question: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['a', 'b', 'c', 'd'].map(k => (
          <div key={k}><label className="ms-label">Option {k.toUpperCase()}{f.correct_option === k.toUpperCase() ? ' ✓' : ''}</label>
            <input className="px-input" value={f[`option_${k}`] || ''} onChange={e => set({ [`option_${k}`]: e.target.value })} /></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><label className="ms-label">Correct</label><select className="px-input" value={f.correct_option || ''} onChange={e => set({ correct_option: e.target.value })}><option value="">—</option>{['A', 'B', 'C', 'D'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><label className="ms-label">Difficulty</label><select className="px-input" value={f.difficulty || 'Medium'} onChange={e => set({ difficulty: e.target.value })}>{DIFFS.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label className="ms-label">Chapter</label><select className="px-input" value={f.chapter || ''} onChange={e => set({ chapter: e.target.value })}>
          {!chapters.includes(f.chapter) && <option value={f.chapter || ''}>{f.chapter || '—'}</option>}{chapters.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 10 }}>Changes apply to the Question Bank for everyone. Only admins can delete questions.</div>
    </Modal>
  )
}

function EditMaterial({ m, onClose, onSaved, notify }) {
  const [f, setF] = useState(m)
  const [saving, setSaving] = useState(false)
  const set = p => setF(x => ({ ...x, ...p }))
  const save = async () => {
    if (!f.title?.trim()) return notify('Title is required', 'bad')
    if (f.file_url && !/^https?:\/\//i.test(f.file_url.trim())) return notify('Link must start with http:// or https://', 'bad')
    setSaving(true)
    const patch = { title: f.title.trim(), description: f.description || '', material_type: f.material_type, file_url: (f.file_url || '').trim(), chapter: f.chapter || '' }
    const { data, error } = await supabase.from('study_materials').update(patch).eq('id', m.id).select('id,title,description,material_type,file_url,course,subject,chapter,created_at')
    setSaving(false)
    if (error || !data?.length) return notify(error?.message || 'Not saved — you may lack permission', 'bad')
    EventBus.emit(GNSI_EVENTS.MATERIAL_SAVED, { id: m.id })
    notify('Material updated', 'ok'); onSaved(data[0])
  }
  return (
    <Modal title="Edit study material" onClose={onClose} footer={<><button className="px-btn ghost" onClick={onClose}>Cancel</button><button className="px-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <label className="ms-label">Title</label>
      <input className="px-input" value={f.title || ''} onChange={e => set({ title: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label className="ms-label">Type</label><select className="px-input" value={f.material_type || 'notes'} onChange={e => set({ material_type: e.target.value })}>{Object.entries(MATERIAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div><label className="ms-label">Chapter</label><input className="px-input" value={f.chapter || ''} onChange={e => set({ chapter: e.target.value })} /></div>
      </div>
      <label className="ms-label">Notes / description</label>
      <textarea rows={5} className="px-input" value={f.description || ''} onChange={e => set({ description: e.target.value })} />
      <label className="ms-label">Link (PDF, video…)</label>
      <input className="px-input" value={f.file_url || ''} onChange={e => set({ file_url: e.target.value })} placeholder="https://…" />
      <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 10 }}>Only admins can delete materials.</div>
    </Modal>
  )
}

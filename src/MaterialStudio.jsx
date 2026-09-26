// MaterialStudio.jsx — GNSI Portal · Teaching → Material Studio
//
// One place for any teaching staff member to prepare class material:
//   1. Search every Question Bank question and every study material together
//      (filters, search inside options, diagrams only, "more like this"), or
//      let the auto-builder fill the tray from a chapter/difficulty blueprint.
//   2. Collect into a tray (kept per user in this browser) with duplicate
//      guard, shuffle/sort and live insights (difficulty mix, time, marks).
//   3. Turn the tray into a finished design — worksheet, differentiated
//      sheets, test paper (versions A–D), slides, revision notes or
//      flashcards — themed and branded, in English / Meitei Mayek / both,
//      with print / PDF, Word, PowerPoint, WhatsApp text and CSV outputs, or
//      present it full-screen as a class quiz.
//   Sets can be saved to a personal library, shared as a file and reopened
//   from the print history.
// Teaching staff may correct a question or material in place; only admins
// may delete (row-level security enforces the same on the server).

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { PX, PremiumCard, PIcon } from './premiumUI'
import { COURSES, COURSE_LIST } from './qbankTaxonomy'
import { SUBJECT_TO_QBANK, normalizeToQBank, openChapterIn, fetchAllPages } from './StudyMaterialBridge'
import { EventBus, GNSI_EVENTS } from './EventBus'
import { isAdminRole } from './roles'
import {
  DESIGNS, THEMES, INSTRUCTION_PRESETS, DEFAULT_OPTIONS, MATERIAL_TYPES, buildHtml, openPrintWindow, downloadWord, downloadPptx,
  downloadBlob, fileBase, questionsOf, materialsOf, marksFor, hasMayek,
} from './studioDesigns'
import {
  duplicateIndexes, sortTray, shuffleTray, insights, autoPick, loadLibrary, saveLibrary, loadHistory, pushHistory,
  loadBrand, saveBrand, newSetId, exportSet, importSet, whatsappText, trayCSV, resizeLogo,
} from './studioTools'
import StudioPresenter from './StudioPresenter'

const PAGE = 30
const Q_FIELDS = 'id,question,question_mayek,question_mayek_font,option_a,option_b,option_c,option_d,option_a_mayek,option_b_mayek,option_c_mayek,option_d_mayek,correct_option,subject,chapter,subsection,difficulty,diagram_url,course,marks'
const DIFFS = ['Easy', 'Medium', 'Hard']
const BLANK_FILTERS = { text: '', scope: 'all', course: '', subject: '', chapter: '', difficulty: '', type: '', inOptions: false, diagram: false, sort: 'new' }
const clean = s => String(s || '').replace(/[%_,()"'\\*:]/g, ' ').replace(/\s+/g, ' ').trim()
const trayKey = u => `gnsi_studio_tray_${u?.username || u?.name || 'me'}`
const readTray = u => { try { return JSON.parse(localStorage.getItem(trayKey(u)) || '[]') } catch { return [] } }
const BRAND_FIELDS = ['brandName', 'tagline', 'logo', 'watermark', 'theme']

const STYLES = `
  .ms-grid{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:16px;align-items:start}
  .ms-compose{display:grid;grid-template-columns:370px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:980px){.ms-grid,.ms-compose{grid-template-columns:minmax(0,1fr)}}
  .ms-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  .ms-item{border:1px solid ${PX.line};border-radius:14px;padding:12px 14px;background:#fff;transition:border-color .15s}
  .ms-item.in{border-color:${PX.gold};background:#fffcf4}
  .ms-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#f3f0e8;color:${PX.sub};white-space:nowrap;border:none;font-family:inherit}
  .ms-chip.gold{background:${PX.goldBg};color:#8a6118}.ms-chip.navy{background:#e4ebf6;color:${PX.navy}}.ms-chip.ok{background:${PX.okBg};color:${PX.ok}}.ms-chip.bad{background:${PX.badBg};color:${PX.bad}}
  .ms-opt{padding:3px 8px;border-radius:8px;background:${PX.tint};font-size:12.5px}
  .ms-opt.ok{background:${PX.okBg};color:${PX.ok};font-weight:700}
  .ms-sm{padding:6px 11px!important;font-size:12px!important;border-radius:9px!important}
  .ms-xs{padding:3px 8px!important;font-size:11.5px!important;border-radius:8px!important}
  .ms-design{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:9px 12px;border:1px solid ${PX.line};border-radius:12px;background:#fff;cursor:pointer;font-family:inherit;width:100%}
  .ms-design.on{border-color:${PX.gold};background:${PX.goldBg};box-shadow:0 0 0 3px rgba(184,146,58,.14)}
  .ms-label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${PX.sub};margin:10px 0 4px}
  .ms-seg{display:inline-flex;gap:3px;padding:3px;border:1px solid ${PX.line};border-radius:11px;background:#fff;flex-wrap:wrap}
  .ms-seg button{border:none;background:none;padding:6px 12px;border-radius:8px;font:600 12.5px/1 inherit;cursor:pointer;color:${PX.sub};font-family:inherit}
  .ms-seg button.on{background:${PX.navy};color:#fff}
  .ms-modal-bg{position:fixed;inset:0;background:rgba(14,32,63,.45);display:flex;align-items:flex-start;justify-content:center;z-index:1000;padding:4vh 12px;overflow-y:auto}
  .ms-modal{background:#fff;border-radius:18px;width:100%;max-width:760px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(14,32,63,.5)}
  .ms-bar{display:flex;height:9px;border-radius:9px;overflow:hidden;background:#f1ede3}
  .ms-theme{border:1px solid ${PX.line};border-radius:10px;padding:7px 8px;background:#fff;cursor:pointer;font-family:inherit;text-align:left;font-size:12px}
  .ms-theme.on{border-color:${PX.gold};box-shadow:0 0 0 3px rgba(184,146,58,.14)}
  .ms-group{border-top:1px solid ${PX.line};margin-top:12px;padding-top:4px}
  .ms-group > summary{cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${PX.ink2};padding:8px 0;list-style:none}
  .ms-group > summary::-webkit-details-marker{display:none}
  .ms-group > summary::before{content:'▸ ';color:${PX.gold}}.ms-group[open] > summary::before{content:'▾ '}
`

// ═══════════════════════════════════════════════════════════════════════════
export default function MaterialStudio({ currentUser, onNavigate }) {
  const canDelete = isAdminRole(currentUser?.role)
  const [view, setView] = useState('search')
  const [tray, setTray] = useState(() => readTray(currentUser))
  const [design, setDesign] = useState('worksheet')
  const [opts, setOpts] = useState(() => ({ ...DEFAULT_OPTIONS, teacher: currentUser?.name || '', ...(loadBrand(currentUser) || {}) }))
  const [library, setLibrary] = useState(() => loadLibrary(currentUser))
  const [history, setHistory] = useState(() => loadHistory(currentUser))
  const [libOpen, setLibOpen] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [toast, setToast] = useState(null)
  useEffect(() => { try { localStorage.setItem(trayKey(currentUser), JSON.stringify(tray)) } catch { /* storage full / private mode */ } }, [tray, currentUser])

  const notify = (msg, tone = 'navy') => {
    const at = Date.now()
    setToast({ msg, tone, at })
    setTimeout(() => setToast(t => (t?.at === at ? null : t)), 3200)
  }
  const inTray = (kind, id) => tray.some(t => t.kind === kind && t.id === id)
  const toggle = (kind, row) => setTray(t => (t.some(x => x.kind === kind && x.id === row.id) ? t.filter(x => !(x.kind === kind && x.id === row.id)) : [...t, { kind, id: row.id, row }]))
  const addMany = (kind, rows) => {
    const fresh = rows.filter(r => !tray.some(x => x.kind === kind && x.id === r.id))
    setTray(t => [...t, ...fresh.filter(r => !t.some(x => x.kind === kind && x.id === r.id)).map(r => ({ kind, id: r.id, row: r }))])
    return fresh.length
  }
  const updateRow = (kind, row) => setTray(t => t.map(x => (x.kind === kind && x.id === row.id ? { ...x, row } : x)))
  const removeRow = (kind, id) => setTray(t => t.filter(x => !(x.kind === kind && x.id === id)))

  const updateLibrary = list => { setLibrary(list); if (!saveLibrary(currentUser, list)) notify('Browser storage is full — delete some saved sets', 'bad') }
  const record = what => setHistory(pushHistory(currentUser, { design, title: opts.title || DESIGNS.find(d => d.id === design)?.label, what, n: tray.length, snapshot: { tray, design, options: opts } }))
  const openSet = (s, mode = 'replace') => {
    if (mode === 'append') {
      const fresh = s.tray.filter(x => !tray.some(y => y.kind === x.kind && y.id === x.id))
      setTray(t => [...t, ...fresh.filter(x => !t.some(y => y.kind === x.kind && y.id === x.id))])
      notify(`Added ${fresh.length} item(s) from "${s.name}"`, 'ok'); return
    }
    setTray(s.tray); setDesign(s.design || 'worksheet'); setOpts(o => ({ ...o, ...(s.options || {}) })); setView('compose'); setLibOpen(false)
    notify(`Opened "${s.name || s.title || 'set'}"`, 'ok')
  }

  return (
    <div>
      <style>{STYLES}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="px-eyebrow">Material Studio</div>
          <div className="px-h2">Find it, collect it, design it</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="px-btn ghost ms-sm" onClick={() => setLibOpen(true)}>📚 Library ({library.length})</button>
          <button className="px-btn ghost ms-sm" disabled={!tray.length} onClick={() => setPresenting(true)}>▶ Present</button>
          <div className="ms-seg" role="tablist" aria-label="Studio view">
            <button role="tab" aria-selected={view === 'search'} className={view === 'search' ? 'on' : ''} onClick={() => setView('search')}>① Search & collect</button>
            <button role="tab" aria-selected={view === 'compose'} className={view === 'compose' ? 'on' : ''} onClick={() => setView('compose')}>② Design ({tray.length})</button>
          </div>
        </div>
      </div>

      {view === 'search' ? (
        <div className="ms-grid">
          <SearchPanel inTray={inTray} toggle={toggle} addMany={addMany} canDelete={canDelete} notify={notify} onNavigate={onNavigate}
            onEdited={updateRow} onDeleted={removeRow} user={currentUser} tray={tray} />
          <TrayPanel tray={tray} setTray={setTray} opts={opts} notify={notify} onCompose={() => setView('compose')} />
        </div>
      ) : (
        <Composer tray={tray} setTray={setTray} design={design} setDesign={setDesign} o={opts} setO={setOpts} user={currentUser} notify={notify}
          onBack={() => setView('search')} onPresent={() => setPresenting(true)} record={record}
          onSave={name => { updateLibrary([{ id: newSetId(), name, tray, design, options: opts, savedAt: new Date().toISOString() }, ...library]); notify(`Saved "${name}" to your library`, 'ok') }} />
      )}

      {libOpen && <LibraryModal library={library} history={history} onClose={() => setLibOpen(false)} update={updateLibrary} openSet={openSet} notify={notify}
        canSave={tray.length > 0} onSaveCurrent={name => updateLibrary([{ id: newSetId(), name, tray, design, options: opts, savedAt: new Date().toISOString() }, ...library])} />}
      {presenting && <StudioPresenter tray={tray} options={opts} onClose={() => setPresenting(false)} />}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: toast.tone === 'bad' ? PX.bad : toast.tone === 'ok' ? PX.ok : PX.navy, color: '#fff', padding: '11px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: '0 14px 30px -10px rgba(0,0,0,.4)', maxWidth: 'calc(100vw - 32px)' }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════════════════
function SearchPanel({ inTray, toggle, addMany, canDelete, notify, onNavigate, onEdited, onDeleted, user, tray }) {
  const [f, setF] = useState(BLANK_FILTERS)
  const [applied, setApplied] = useState(BLANK_FILTERS)
  const [res, setRes] = useState({ key: '', qs: [], qCount: 0, mats: [], mCount: 0, qPage: 0, mPage: 0 })
  const [busy, setBusy] = useState(false)
  const [editQ, setEditQ] = useState(null)
  const [editM, setEditM] = useState(null)
  const [builder, setBuilder] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const set = p => setF(x => ({ ...x, ...p }))

  const subjects = f.course ? Object.keys(COURSES[f.course]?.subjects || {}) : [...new Set(Object.values(COURSES).flatMap(c => Object.keys(c.subjects)))]
  const chapters = f.course && f.subject ? COURSES[f.course]?.subjects?.[f.subject] || [] : []
  const key = JSON.stringify(applied) + refresh

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

  // "More like this": same course / subject / chapter / difficulty.
  const likeThis = q => {
    const next = { ...BLANK_FILTERS, scope: 'questions', course: q.course || 'sainik', subject: q.subject || '', chapter: q.chapter || '', difficulty: q.difficulty || '' }
    setF(next); setApplied(next)
    notify(`Showing more ${q.difficulty || ''} questions from ${q.chapter || q.subject}`)
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
      <PremiumCard title="Search everything" subtitle="Question Bank questions and study materials, all courses"
        right={<button className="px-btn gold ms-sm" onClick={() => setBuilder(true)}>✦ Auto-build</button>}>
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
            <select className="px-input" value={f.sort} onChange={e => set({ sort: e.target.value })} aria-label="Sort">
              <option value="new">Newest first</option><option value="old">Oldest first</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <Check label="Also search inside answer options" v={f.inOptions} on={v => set({ inOptions: v })} />
            <Check label="Only questions with a diagram" v={f.diagram} on={v => set({ diagram: v })} />
            <button type="button" className="px-btn ghost ms-sm" style={{ marginLeft: 'auto' }} onClick={() => { setF(BLANK_FILTERS); setApplied(BLANK_FILTERS) }}>Clear</button>
          </div>
        </form>
      </PremiumCard>

      {res.error && <div style={{ background: PX.badBg, color: PX.bad, borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>Search failed: {res.error.message}</div>}

      {showQ && (
        <PremiumCard title={`Questions${loading ? '' : ` · ${res.qCount}`}`} subtitle="Tick to add to your tray. Answers are shown in green."
          right={!loading && res.qs.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => notify(`Added ${addMany('q', res.qs) || 'no new'} question(s)`, 'ok')}>+ Add all {res.qs.length}</button>}>
          {loading ? <Muted>Searching…</Muted> : res.qs.length === 0 ? <Muted>No questions match.</Muted> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {res.qs.map(q => <QuestionItem key={q.id} q={q} on={inTray('q', q.id)} onToggle={() => toggle('q', q)} onEdit={() => setEditQ(q)} onDelete={canDelete ? () => delQ(q) : null} onNavigate={onNavigate} onLike={() => likeThis(q)} />)}
              {res.qs.length < res.qCount && <button className="px-btn ghost" disabled={busy} onClick={() => more('q')}>{busy ? 'Loading…' : `Show more (${res.qCount - res.qs.length} left)`}</button>}
            </div>
          )}
        </PremiumCard>
      )}

      {showM && (
        <PremiumCard title={`Study materials${loading ? '' : ` · ${res.mCount}`}`} subtitle="Notes, formula sheets, practice sets, videos and more"
          right={!loading && res.mats.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => notify(`Added ${addMany('m', res.mats) || 'no new'} material(s)`, 'ok')}>+ Add all {res.mats.length}</button>}>
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
      {builder && <AutoBuilder tray={tray} addMany={addMany} notify={notify} onClose={() => setBuilder(false)} />}
    </div>
  )
}

// All question filters go into one PostgREST logic tree — and(...) inside a
// single or= param — so the Sainik "course or untagged" rule, per-word
// search across question + options and the diagram filter combine safely.
function questionQuery(f) {
  let q = supabase.from('qbank_questions').select(Q_FIELDS, { count: 'exact' })
  const conds = []
  if (f.course === 'sainik') conds.push('or(course.eq.sainik,course.is.null)')
  else if (f.course) q = q.eq('course', f.course)
  if (f.subject) q = q.eq('subject', f.subject)
  if (f.chapter) q = q.eq('chapter', f.chapter)
  if (f.difficulty) q = q.eq('difficulty', f.difficulty)
  for (const w of clean(f.text).split(' ').filter(Boolean)) {
    conds.push(f.inOptions ? `or(${['question', 'option_a', 'option_b', 'option_c', 'option_d'].map(c => `${c}.ilike.*${w}*`).join(',')})` : `question.ilike.*${w}*`)
  }
  if (f.diagram) conds.push('diagram_url.like.http*')
  if (conds.length) q = q.or(`and(${conds.join(',')})`)
  return q
}
async function runQ(f, page) {
  if (f.scope === 'materials') return { data: [], count: 0 }
  const { data, count, error } = await questionQuery(f).order('id', { ascending: f.sort === 'old' }).range(page * PAGE, page * PAGE + PAGE - 1)
  return { data: data || [], count: count || 0, error }
}

// Study materials use each module's own subject names (English Language,
// Arithmetic…), so a subject filter matches every name that maps to it.
async function runM(f, page) {
  if (f.scope === 'questions' || f.diagram) return { data: [], count: 0 }
  let q = supabase.from('study_materials').select('id,title,description,material_type,file_url,course,subject,chapter,created_at', { count: 'exact' })
  if (f.course) q = q.eq('course', f.course)
  if (f.subject) {
    const target = normalizeToQBank(f.subject)
    q = q.in('subject', [...new Set([f.subject, ...Object.keys(SUBJECT_TO_QBANK).filter(k => SUBJECT_TO_QBANK[k] === target)])])
  }
  if (f.chapter) q = q.eq('chapter', f.chapter)
  if (f.type) q = q.eq('material_type', f.type)
  const t = clean(f.text)
  if (t) q = q.or(`title.ilike.*${t}*,description.ilike.*${t}*,chapter.ilike.*${t}*`)
  const { data, count, error } = await q.order('created_at', { ascending: f.sort === 'old' }).range(page * PAGE, page * PAGE + PAGE - 1)
  return { data: data || [], count: count || 0, error }
}

const Muted = ({ children }) => <div style={{ color: PX.sub, fontSize: 13, padding: '8px 0' }}>{children}</div>

function QuestionItem({ q, on, onToggle, onEdit, onDelete, onNavigate, onLike }) {
  return (
    <div className={'ms-item' + (on ? ' in' : '')}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={on} onChange={onToggle} aria-label="Add question to tray" style={{ marginTop: 4, width: 17, height: 17, accentColor: PX.gold }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: PX.ink, whiteSpace: 'pre-wrap' }}>{q.question}</div>
          {q.question_mayek && <div style={{ fontSize: 13.5, color: PX.ink2, marginTop: 2, fontFamily: q.question_mayek_font === 'bmei04' ? "'BMEI04',sans-serif" : "'Noto Sans Meetei Mayek',sans-serif" }}>{q.question_mayek}</div>}
          {q.diagram_url && <img src={q.diagram_url} alt="" style={{ maxHeight: 90, maxWidth: '100%', marginTop: 6, borderRadius: 8 }} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 4, marginTop: 6 }}>
            {['a', 'b', 'c', 'd'].filter(k => q[`option_${k}`]).map(k => (
              <div key={k} className={'ms-opt' + (q.correct_option === k.toUpperCase() ? ' ok' : '')}>({k.toUpperCase()}) {q[`option_${k}`]}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
            {q.course && <span className="ms-chip navy">{COURSES[q.course]?.short || q.course}</span>}
            <span className="ms-chip">{q.subject}</span>
            {q.chapter && <button className="ms-chip gold" style={{ cursor: 'pointer' }} title="Open this chapter in the Chapter Hub"
              onClick={() => openChapterIn('hub', { course: q.course || 'sainik', subject: q.subject, chapter: q.chapter }, onNavigate)}>🎯 {q.chapter}</button>}
            {q.difficulty && <span className={'ms-chip' + (q.difficulty === 'Easy' ? ' ok' : '')}>{q.difficulty}</span>}
            {q.question_mayek && <span className="ms-chip">ꯃꯩꯇꯩ</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="px-btn ghost ms-sm" onClick={onLike} title="Same chapter and difficulty">More like this</button>
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
              {m.file_url && /^https?:/i.test(m.file_url) && <a className="px-btn ghost ms-sm" href={m.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Open ↗</a>}
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
// Auto-builder — fill the tray from a blueprint
// ═══════════════════════════════════════════════════════════════════════════
function AutoBuilder({ tray, addMany, notify, onClose }) {
  const [course, setCourse] = useState('sainik')
  const [subject, setSubject] = useState('Mathematics')
  const [picked, setPicked] = useState(null)             // null = all chapters
  const [count, setCount] = useState(20)
  const [mix, setMix] = useState({ Easy: 30, Medium: 50, Hard: 20 })
  const [skipTray, setSkipTray] = useState(true)
  const [busy, setBusy] = useState(false)
  const subjects = Object.keys(COURSES[course]?.subjects || {})
  const chapters = COURSES[course]?.subjects?.[subject] || []
  const chosen = picked || chapters

  const build = async () => {
    if (!chosen.length) return notify('Pick at least one chapter', 'bad')
    setBusy(true)
    const { data, error } = await fetchAllPages(() => {
      let q = supabase.from('qbank_questions').select(Q_FIELDS).eq('subject', subject)
      q = course === 'sainik' ? q.or('course.eq.sainik,course.is.null') : q.eq('course', course)
      return q.order('id', { ascending: true })
    })
    setBusy(false)
    if (error) return notify(error.message, 'bad')
    const want = new Set(chosen)
    const pool = (data || []).filter(q => want.has(q.chapter) && /^[ABCD]$/.test(q.correct_option || ''))
    const exclude = new Set(skipTray ? tray.filter(t => t.kind === 'q').map(t => t.id) : [])
    const pick = autoPick(pool, Number(count) || 0, { mix, exclude })
    const n = addMany('q', pick)
    notify(pick.length < count ? `Added ${n} — only ${pick.length} matching questions available` : `Added ${n} questions across ${new Set(pick.map(q => q.chapter)).size} chapters`, pick.length < count ? 'bad' : 'ok')
    if (pick.length) onClose()
  }

  return (
    <Modal title="Auto-build from a blueprint" onClose={onClose}
      footer={<><button className="px-btn ghost" onClick={onClose}>Cancel</button><button className="px-btn gold" disabled={busy} onClick={build}>{busy ? 'Picking…' : `✦ Add ${count} questions`}</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 8 }}>
        <div><label className="ms-label">Course</label><select className="px-input" value={course} onChange={e => { const c = e.target.value; setCourse(c); setSubject(Object.keys(COURSES[c].subjects)[0]); setPicked(null) }} aria-label="Builder course">{COURSE_LIST.map(c => <option key={c} value={c}>{COURSES[c].label}</option>)}</select></div>
        <div><label className="ms-label">Subject</label><select className="px-input" value={subject} onChange={e => { setSubject(e.target.value); setPicked(null) }} aria-label="Builder subject">{subjects.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="ms-label">Questions</label><input type="number" min="1" max="200" className="px-input" value={count} onChange={e => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} aria-label="Question count" /></div>
      </div>
      <label className="ms-label">Chapters ({chosen.length} of {chapters.length})</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button className="px-btn ghost ms-xs" onClick={() => setPicked(null)}>All</button>
        <button className="px-btn ghost ms-xs" onClick={() => setPicked([])}>None</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 4, maxHeight: 190, overflowY: 'auto', border: `1px solid ${PX.line}`, borderRadius: 10, padding: 8, fontSize: 12.5 }}>
        {chapters.map(c => (
          <label key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={chosen.includes(c)} onChange={e => setPicked(p => { const cur = p || chapters; return e.target.checked ? [...cur, c] : cur.filter(x => x !== c) })} style={{ accentColor: PX.gold }} />{c}
          </label>
        ))}
      </div>
      <label className="ms-label">Difficulty mix (%)</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {DIFFS.map(d => <div key={d}><span style={{ fontSize: 12, color: PX.sub }}>{d}</span><input type="number" min="0" max="100" className="px-input" value={mix[d]} onChange={e => setMix(m => ({ ...m, [d]: Number(e.target.value) || 0 }))} aria-label={`${d} percent`} /></div>)}
      </div>
      <div style={{ marginTop: 12, fontSize: 13 }}><Check label="Skip questions already in the tray" v={skipTray} on={setSkipTray} /></div>
      <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 10 }}>Questions are spread across the chosen chapters so no single chapter dominates. Only questions with a marked answer are used.</div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tray — tools, duplicate guard, insights
// ═══════════════════════════════════════════════════════════════════════════
function TrayPanel({ tray, setTray, opts, notify, onCompose }) {
  const move = (i, d) => setTray(t => { const a = [...t]; const j = i + d; if (j < 0 || j >= a.length) return a;[a[i], a[j]] = [a[j], a[i]]; return a })
  const dups = useMemo(() => duplicateIndexes(tray), [tray])
  const ins = useMemo(() => insights(tray, q => marksFor(q, opts)), [tray, opts])
  const totalQ = ins.questions || 1
  return (
    <div style={{ position: 'sticky', top: 12, display: 'grid', gap: 14 }}>
      <PremiumCard title="Your tray" subtitle={`${ins.questions} question${ins.questions === 1 ? '' : 's'} · ${ins.materials} material${ins.materials === 1 ? '' : 's'}`}
        right={tray.length > 0 && <button className="px-btn ghost ms-sm" onClick={() => confirm('Empty the tray?') && setTray([])}>Clear</button>}
        bodyStyle={{ padding: '12px 14px' }}>
        {tray.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className="px-btn ghost ms-xs" onClick={() => { setTray(t => shuffleTray(t)); notify('Tray shuffled') }}>🔀 Shuffle</button>
            <select className="px-input" style={{ width: 'auto', padding: '3px 8px', fontSize: 11.5 }} value="" onChange={e => { if (e.target.value) { setTray(t => sortTray(t, e.target.value)); notify(`Sorted by ${e.target.value}`) } }} aria-label="Sort tray">
              <option value="">Sort by…</option><option value="subject">Subject</option><option value="chapter">Chapter</option><option value="difficulty">Difficulty</option>
            </select>
            {dups.size > 0 && <button className="px-btn ghost ms-xs" style={{ color: PX.bad }} onClick={() => { setTray(t => t.filter((_, i) => !dups.has(i))); notify(`Removed ${dups.size} duplicate(s)`, 'ok') }}>Remove {dups.size} duplicate{dups.size > 1 ? 's' : ''}</button>}
          </div>
        )}
        {tray.length === 0 ? <Muted>Tick questions and materials to collect them here, or use Auto-build. The tray is saved in this browser.</Muted> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 6, maxHeight: '44vh', overflowY: 'auto' }}>
            {tray.map((it, i) => (
              <div key={it.kind + it.id + i} style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, border: `1px solid ${dups.has(i) ? '#f5c2bd' : PX.line}`, background: dups.has(i) ? PX.badBg : '#fff', borderRadius: 10, padding: '6px 8px', fontSize: 12.5 }}>
                <span style={{ color: PX.faint, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                <span title={it.kind === 'q' ? 'Question' : 'Material'}>{it.kind === 'q' ? '❓' : (MATERIAL_TYPES[it.row.material_type]?.icon || '📄')}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dups.has(i) ? 'Looks like a duplicate of an earlier question' : ''}>{dups.has(i) && '⚠ '}{it.kind === 'q' ? it.row.question : it.row.title}</span>
                <button className="px-btn ghost ms-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button className="px-btn ghost ms-sm" onClick={() => move(i, 1)} disabled={i === tray.length - 1} aria-label="Move down">↓</button>
                <button className="px-btn ghost ms-sm" style={{ color: PX.bad }} onClick={() => setTray(t => t.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
        )}
        <button className="px-btn gold" style={{ width: '100%', marginTop: 12 }} disabled={!tray.length} onClick={onCompose}>Design material →</button>
      </PremiumCard>

      {ins.questions > 0 && (
        <PremiumCard title="Tray insights" bodyStyle={{ padding: '12px 14px' }}>
          <div className="ms-bar" aria-label={`Easy ${ins.diff.Easy}, Medium ${ins.diff.Medium}, Hard ${ins.diff.Hard}`}>
            <div style={{ width: `${(ins.diff.Easy / totalQ) * 100}%`, background: '#34a36b' }} />
            <div style={{ width: `${(ins.diff.Medium / totalQ) * 100}%`, background: PX.gold }} />
            <div style={{ width: `${(ins.diff.Hard / totalQ) * 100}%`, background: PX.bad }} />
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: PX.sub, marginTop: 5 }}>
            <span>● Easy {ins.diff.Easy}</span><span style={{ color: '#8a6118' }}>● Medium {ins.diff.Medium}</span><span style={{ color: PX.bad }}>● Hard {ins.diff.Hard}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 10, textAlign: 'center' }}>
            {[['Chapters', ins.chapters.length], ['≈ Minutes', ins.minutes], ['Marks', ins.marks]].map(([k, v]) => (
              <div key={k} style={{ background: PX.tint, borderRadius: 10, padding: '6px 4px' }}><div style={{ fontFamily: PX.serif, fontSize: 19, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 10.5, color: PX.sub, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div></div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 8 }}>{ins.chapters.slice(0, 4).map(([c, n]) => `${c.split(' · ').pop()} (${n})`).join(', ')}{ins.chapters.length > 4 ? ` · +${ins.chapters.length - 4} more` : ''}</div>
        </PremiumCard>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Library — saved sets, sharing, recent history
// ═══════════════════════════════════════════════════════════════════════════
function LibraryModal({ library, history, onClose, update, openSet, notify, canSave, onSaveCurrent }) {
  const [tab, setTab] = useState('sets')
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(null)
  const fileRef = useRef(null)
  const share = s => downloadBlob(`${fileBase({ title: s.name })}.gnsi-set.json`, new Blob([exportSet(s)], { type: 'application/json' }))
  const importFile = async file => {
    try { const s = importSet(await file.text()); update([s, ...library]); notify(`Imported "${s.name}" (${s.tray.length} items)`, 'ok') } catch (e) { notify(e.message, 'bad') }
  }
  const when = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <Modal title="Your material library" onClose={onClose} footer={<button className="px-btn ghost" onClick={onClose}>Close</button>}>
      <div className="ms-seg" style={{ marginTop: 6 }}>
        <button className={tab === 'sets' ? 'on' : ''} onClick={() => setTab('sets')}>Saved sets ({library.length})</button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recent ({history.length})</button>
      </div>
      {tab === 'sets' ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="px-input" style={{ flex: 1, minWidth: 180 }} placeholder="Name for the current tray…" value={name} onChange={e => setName(e.target.value)} aria-label="Set name" disabled={!canSave} />
            <button className="px-btn ms-sm" disabled={!canSave || !name.trim()} onClick={() => { onSaveCurrent(name.trim()); setName(''); notify('Saved to library', 'ok') }}>Save current tray</button>
            <button className="px-btn ghost ms-sm" onClick={() => fileRef.current?.click()}>Import shared set</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f) }} aria-label="Import set file" />
          </div>
          {library.length === 0 ? <Muted>No saved sets yet. Save a tray to reuse it next term, or import a set a colleague shared.</Muted> : library.map(s => (
            <div key={s.id} className="ms-item" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                {renaming === s.id
                  ? <input className="px-input" autoFocus defaultValue={s.name} aria-label="Rename set" onBlur={e => { update(library.map(x => (x.id === s.id ? { ...x, name: e.target.value.trim() || x.name } : x))); setRenaming(null) }} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                  : <div style={{ fontWeight: 700, color: PX.ink }}>{s.name}{s.imported && <span className="ms-chip gold" style={{ marginLeft: 6 }}>shared</span>}</div>}
                <div style={{ fontSize: 12, color: PX.sub }}>{questionsOf(s.tray).length} questions · {materialsOf(s.tray).length} materials · {DESIGNS.find(d => d.id === s.design)?.label || s.design} · {when(s.savedAt)}</div>
              </div>
              <button className="px-btn ms-sm" onClick={() => openSet(s)}>Open</button>
              <button className="px-btn ghost ms-sm" onClick={() => openSet(s, 'append')}>+ Add to tray</button>
              <button className="px-btn ghost ms-sm" onClick={() => share(s)} title="Download a file to share with a colleague">Share</button>
              <button className="px-btn ghost ms-sm" onClick={() => setRenaming(s.id)}>Rename</button>
              <button className="px-btn ghost ms-sm" style={{ color: PX.bad }} onClick={() => confirm(`Delete "${s.name}" from your library?`) && update(library.filter(x => x.id !== s.id))}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {history.length === 0 ? <Muted>Everything you print or download appears here, ready to reopen.</Muted> : history.map(h => (
            <div key={h.id} className="ms-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>{DESIGNS.find(d => d.id === h.design)?.icon || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: PX.ink }}>{h.title}</div><div style={{ fontSize: 12, color: PX.sub }}>{h.what} · {h.n} items · {when(h.at)}</div></div>
              <button className="px-btn ghost ms-sm" onClick={() => openSet({ ...h.snapshot, name: h.title })}>Open again</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Composer — pick a design, set options, preview, export
// ═══════════════════════════════════════════════════════════════════════════
function Composer({ tray, setTray, design, setDesign, o, setO, user, notify, onBack, onPresent, record, onSave }) {
  const [html, setHtml] = useState({ key: '', doc: '' })
  const [busy, setBusy] = useState('')
  const [saveName, setSaveName] = useState('')
  const set = p => setO(x => ({ ...x, ...p }))
  const key = JSON.stringify([design, o, tray.map(t => t.kind + t.id + (t.row.question || t.row.title || '') + (t.row.correct_option || ''))])
  const nq = questionsOf(tray).length, nm = materialsOf(tray).length
  const anyMayek = questionsOf(tray).some(hasMayek)
  const isPrint = design !== 'slides'
  const qDesign = ['worksheet', 'levels', 'test'].includes(design)

  useEffect(() => {
    let live = true
    const t = setTimeout(() => { buildHtml(design, tray, o).then(doc => { if (live) setHtml({ key, doc }) }) }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [key, design, tray, o])

  const needs = useMemo(() => {
    if (qDesign && !nq) return 'This design needs questions in the tray.'
    if (design === 'flashcards' && !nq && !nm) return 'Add questions or materials to the tray.'
    if (design === 'notes' && !nm && !nq) return 'Add study materials (and optionally questions) to the tray.'
    return ''
  }, [design, nq, nm, qDesign])

  const print = async () => {
    const w = openPrintWindow()
    if (!w) return notify('Allow pop-ups for this site to print', 'bad')
    const doc = await buildHtml(design, tray, o, { autoPrint: true })
    w.document.open(); w.document.write(doc); w.document.close()
    record('Printed')
  }
  const run = async (label, fn, done) => { setBusy(label); try { await fn(); record(done); notify(`${done}`, 'ok') } catch (e) { notify(e.message || String(e), 'bad') } setBusy('') }
  const copyWhatsApp = async () => {
    const text = whatsappText(tray, { title: o.title })
    try { await navigator.clipboard.writeText(text); notify('Copied — paste it into WhatsApp', 'ok') } catch { notify('Copy failed — your browser blocked the clipboard', 'bad') }
    record('Copied for WhatsApp')
  }
  const onLogo = async file => { try { set({ logo: await resizeLogo(file) }) } catch (e) { notify(e.message, 'bad') } }

  return (
    <div className="ms-compose">
      <div style={{ display: 'grid', gap: 14 }}>
        <PremiumCard title="Design" subtitle={`${nq} questions · ${nm} materials in the tray`} right={<button className="px-btn ghost ms-sm" onClick={onBack}>← Tray</button>} bodyStyle={{ padding: '12px 14px' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {DESIGNS.map(d => (
              <button key={d.id} className={'ms-design' + (design === d.id ? ' on' : '')} onClick={() => setDesign(d.id)} aria-pressed={design === d.id}>
                <span style={{ fontSize: 21 }}>{d.icon}</span>
                <span><b style={{ color: PX.ink }}>{d.label}</b><br /><span style={{ fontSize: 12, color: PX.sub }}>{d.desc}</span></span>
              </button>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard title="Options" bodyStyle={{ padding: '4px 14px 14px' }}>
          <label className="ms-label">Title</label>
          <input className="px-input" value={o.title} onChange={e => set({ title: e.target.value })} placeholder={DESIGNS.find(d => d.id === design).label} aria-label="Title" />
          <label className="ms-label">Class / batch · subtitle</label>
          <input className="px-input" value={o.subtitle} onChange={e => set({ subtitle: e.target.value })} placeholder="e.g. Sainik 6A · Mathematics" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label className="ms-label">Date</label><input type="date" className="px-input" value={o.date} onChange={e => set({ date: e.target.value })} /></div>
            <div><label className="ms-label">Teacher</label><input className="px-input" value={o.teacher} onChange={e => set({ teacher: e.target.value })} /></div>
          </div>
          {design !== 'flashcards' && design !== 'slides' && <>
            <label className="ms-label">Instructions</label>
            <textarea rows={2} className="px-input" value={o.instructions} onChange={e => set({ instructions: e.target.value })} aria-label="Instructions" />
            <select className="px-input" style={{ marginTop: 6, fontSize: 12.5 }} value="" onChange={e => e.target.value && set({ instructions: [o.instructions, e.target.value].filter(Boolean).join('\n') })} aria-label="Insert instruction preset">
              <option value="">+ Insert a standard instruction…</option>{INSTRUCTION_PRESETS.map(p => <option key={p}>{p}</option>)}
            </select>
          </>}

          <details className="ms-group" open>
            <summary>Look</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {THEMES.map(t => <button key={t.id} className={'ms-theme' + (o.theme === t.id ? ' on' : '')} onClick={() => set({ theme: t.id })} aria-pressed={o.theme === t.id}><b>{t.label}</b><br /><span style={{ color: PX.sub }}>{t.hint}</span></button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label className="ms-label">Language</label><select className="px-input" value={o.lang} onChange={e => set({ lang: e.target.value })} aria-label="Language">
                <option value="en">English</option><option value="mm">Meitei Mayek</option><option value="both">Both</option></select></div>
              <div><label className="ms-label">Text size</label><select className="px-input" value={o.fontSize} onChange={e => set({ fontSize: e.target.value })}><option value="S">Small</option><option value="M">Medium</option><option value="L">Large</option></select></div>
            </div>
            {o.lang !== 'en' && !anyMayek && <div style={{ fontSize: 11.5, color: PX.warn, marginTop: 4 }}>No question in the tray has Meitei Mayek text yet — English is used.</div>}
            {isPrint && design !== 'flashcards' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label className="ms-label">Paper</label><select className="px-input" value={o.paper} onChange={e => set({ paper: e.target.value })} aria-label="Paper size"><option value="A4">A4</option><option value="A5">A5</option></select></div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 9, fontSize: 12.5 }}><Check label="2 copies per sheet" v={o.twoUp} on={v => set({ twoUp: v })} /></div>
              </div>
            )}
          </details>

          {(qDesign || design === 'notes') && (
            <details className="ms-group" open>
              <summary>Layout & marks</summary>
              {qDesign && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label className="ms-label">Columns</label><select className="px-input" value={o.columns} onChange={e => set({ columns: Number(e.target.value) })}><option value={1}>One</option><option value={2}>Two</option></select></div>
                <div><label className="ms-label">Group by</label><select className="px-input" value={o.sectionBy} onChange={e => set({ sectionBy: e.target.value })}><option value="subject">Subject</option><option value="chapter">Chapter</option><option value="none">No sections</option></select></div>
                {design !== 'test' && <div><label className="ms-label">Answer space</label><select className="px-input" value={o.answerSpace} onChange={e => set({ answerSpace: e.target.value })}><option value="none">None (MCQ)</option><option value="lines">Lines</option><option value="box">Working box</option></select></div>}
                <div><label className="ms-label">Marks</label><select className="px-input" value={o.marksMode} onChange={e => set({ marksMode: e.target.value })} aria-label="Marks mode"><option value="flat">Same for all</option><option value="difficulty">By difficulty</option></select></div>
              </div>}
              {qDesign && (o.marksMode === 'difficulty'
                ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>{DIFFS.map(d => <div key={d}><label className="ms-label">{d}</label><input type="number" min="0" step="0.5" className="px-input" value={o.weights[d]} onChange={e => set({ weights: { ...o.weights, [d]: e.target.value } })} aria-label={`${d} marks`} /></div>)}</div>
                : <div><label className="ms-label">Marks each</label><input type="number" min="0" step="0.5" className="px-input" value={o.marksEach} onChange={e => set({ marksEach: e.target.value })} /></div>)}
              {design === 'test' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div><label className="ms-label">Minutes</label><input type="number" min="1" className="px-input" value={o.duration} onChange={e => set({ duration: e.target.value })} /></div>
                  <div><label className="ms-label">Versions</label><select className="px-input" value={o.versions} onChange={e => set({ versions: Number(e.target.value) })} aria-label="Versions">{[1, 2, 3, 4].map(n => <option key={n} value={n}>{'ABCD'.slice(0, n).split('').join(' · ')}</option>)}</select></div>
                  <div><label className="ms-label">− per wrong</label><input type="number" min="0" step="0.25" className="px-input" value={o.negative} onChange={e => set({ negative: e.target.value })} aria-label="Negative marks" /></div>
                </div>
              )}
              <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 13 }}>
                {qDesign && <Check label="Separate answer key page" v={o.answerKey} on={v => set({ answerKey: v })} />}
                {design === 'test' && <Check label="Shuffle question order (version A too)" v={o.shuffle} on={v => set({ shuffle: v })} />}
                {design === 'test' && <Check label="Shuffle answer options between versions" v={o.shuffleOptions} on={v => set({ shuffleOptions: v })} />}
                {design === 'test' && <Check label="OMR bubble answer sheet" v={o.omr} on={v => set({ omr: v })} />}
                {(design === 'test' || design === 'worksheet') && <Check label="Teacher blueprint page (chapter × difficulty)" v={o.blueprint} on={v => set({ blueprint: v })} />}
                <Check label="Show subject · chapter tags" v={o.showTags} on={v => set({ showTags: v })} />
                {design === 'notes' && <Check label="Show answers to key questions" v={o.revealAnswers} on={v => set({ revealAnswers: v })} />}
              </div>
            </details>
          )}
          {design === 'slides' && <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 13 }}>
            <Check label="Add an answer-reveal slide after each question" v={o.revealAnswers} on={v => set({ revealAnswers: v })} />
            <Check label="Show subject · chapter tags" v={o.showTags} on={v => set({ showTags: v })} />
          </div>}

          {(design === 'worksheet' || design === 'levels' || design === 'notes') && (
            <details className="ms-group" open={o.homework}>
              <summary>Homework</summary>
              <Check label="Homework mode (due date + parent's signature)" v={o.homework} on={v => set({ homework: v })} />
              {o.homework && <><label className="ms-label">Due date</label><input type="date" className="px-input" value={o.dueDate} onChange={e => set({ dueDate: e.target.value })} aria-label="Due date" /></>}
            </details>
          )}

          <details className="ms-group">
            <summary>Branding</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label className="ms-label">Institute name</label><input className="px-input" value={o.brandName} onChange={e => set({ brandName: e.target.value })} aria-label="Institute name" /></div>
              <div><label className="ms-label">Watermark</label><input className="px-input" value={o.watermark} placeholder="e.g. GNSI · DRAFT" onChange={e => set({ watermark: e.target.value })} aria-label="Watermark" /></div>
            </div>
            <label className="ms-label">Tagline</label>
            <input className="px-input" value={o.tagline} onChange={e => set({ tagline: e.target.value })} />
            <label className="ms-label">Logo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {o.logo && <img src={o.logo} alt="Logo" style={{ height: 36, borderRadius: 6, border: `1px solid ${PX.line}` }} />}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="px-input" style={{ padding: 6, flex: 1 }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onLogo(f) }} aria-label="Logo file" />
              {o.logo && <button className="px-btn ghost ms-xs" onClick={() => set({ logo: '' })}>Remove</button>}
            </div>
            <button className="px-btn ghost ms-sm" style={{ marginTop: 10 }} onClick={() => { saveBrand(user, Object.fromEntries(BRAND_FIELDS.map(k => [k, o[k]]))); notify('Branding saved as your default', 'ok') }}>Save as my default</button>
          </details>
        </PremiumCard>
      </div>

      <PremiumCard title="Preview" subtitle={isPrint ? `Exactly what prints — ${o.twoUp && design !== 'flashcards' ? 'A4 landscape, 2 copies' : o.paper}` : 'Slide preview — download for the real PowerPoint'}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isPrint && <button className="px-btn gold ms-sm" disabled={!!needs} onClick={print}><PIcon.print size={13} />Print / PDF</button>}
          {isPrint && <button className="px-btn ghost ms-sm" disabled={!!needs || !!busy} onClick={() => run('word', () => downloadWord(design, tray, o), 'Word file downloaded')}><PIcon.download size={13} />{busy === 'word' ? 'Preparing…' : 'Word'}</button>}
          {!isPrint && <button className="px-btn gold ms-sm" disabled={!tray.length || !!busy} onClick={() => run('pptx', () => downloadPptx(tray, o), 'PowerPoint downloaded')}><PIcon.download size={13} />{busy === 'pptx' ? 'Building…' : 'PowerPoint (.pptx)'}</button>}
          <button className="px-btn ghost ms-sm" disabled={!tray.length} onClick={onPresent}>▶ Present</button>
        </div>}
        bodyStyle={{ padding: 12, background: PX.tint }}>
        {!tray.length ? <Muted>The tray is empty — go back and collect some questions or materials, or open a saved set from the Library.</Muted> : (
          <>
            {needs && <div style={{ background: PX.warnBg, color: PX.warn, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 10 }}>{needs}</div>}
            <iframe title="Design preview" sandbox="" srcDoc={html.doc} style={{ width: '100%', height: '74vh', border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff', opacity: html.key === key ? 1 : 0.6, transition: 'opacity .15s' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <button className="px-btn ghost ms-sm" onClick={copyWhatsApp}>💬 Copy for WhatsApp</button>
              <button className="px-btn ghost ms-sm" onClick={() => { downloadBlob(`${fileBase(o)}.csv`, new Blob([trayCSV(tray)], { type: 'text/csv' })); record('Exported CSV') }}>⬇ CSV / Excel</button>
              <span style={{ flex: 1 }} />
              <input className="px-input" style={{ width: 200, padding: '6px 10px', fontSize: 12.5 }} placeholder="Save as… (name)" value={saveName} onChange={e => setSaveName(e.target.value)} aria-label="Save set name" />
              <button className="px-btn ms-sm" disabled={!saveName.trim()} onClick={() => { onSave(saveName.trim()); setSaveName('') }}>Save to library</button>
            </div>
            <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 8 }}>Reorder items in the tray to change the order here. {design === 'flashcards' && 'Print double-sided (flip on long edge) so answers land behind their questions.'} {o.twoUp && isPrint && design !== 'flashcards' && 'Two-up works best for sheets that fit on one page.'}</div>
            <button className="px-btn ghost ms-xs" style={{ marginTop: 8 }} onClick={() => confirm('Empty the tray?') && setTray([])}>Empty tray</button>
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
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
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
      <textarea rows={3} className="px-input" value={f.question || ''} onChange={e => set({ question: e.target.value })} aria-label="Question text" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['a', 'b', 'c', 'd'].map(k => (
          <div key={k}><label className="ms-label">Option {k.toUpperCase()}{f.correct_option === k.toUpperCase() ? ' ✓' : ''}</label>
            <input className="px-input" value={f[`option_${k}`] || ''} onChange={e => set({ [`option_${k}`]: e.target.value })} /></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><label className="ms-label">Correct</label><select className="px-input" value={f.correct_option || ''} onChange={e => set({ correct_option: e.target.value })}><option value="">—</option>{['A', 'B', 'C', 'D'].map(x => <option key={x}>{x}</option>)}</select></div>
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

// Mission Foundation — study material written in the portal. Teachers type notes in a simple markup
// (headings, lists, tables, callouts, maths, figures), watch them as a printed page, and save them with the
// subject and test they are for. Saved notes are printable and editable; files and links are still possible
// from the "Attach a file or link" side of the Study material screen.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { MATH_TOOLS } from './MultiQuestionAdder'
import { figFromFile } from './lib/figImage'
import { figureLine } from './lib/materialMarkup'
import { renderMaterial, MATERIAL_CSS, wordCount } from './lib/materialMarkup'
import { MATH_CSS } from './lib/mathText'
import { printPremium } from './lib/printPremium'
import { getInstitute } from './systemSettings'
import { MISSION_NAME, SUBJECTS } from './missionFoundationData'
import ScanFigure from './ScanFigure'
import { useSmartNotes } from './SmartNotes'

const T_MAT = 'mission_foundation_materials'
const DRAFT = 'mfm-draft:v1'
export const blankNote = { id: null, title: '', subject: '', test_id: '', body: '' }

const TEMPLATES = {
  'Chapter notes': '# Chapter title\n\n## Key ideas\n- Idea one\n- Idea two\n\n> Formula: area = \\frac{1}{2} \\times b \\times h\n\n## Worked example\n> Example: Find the area of a triangle with base 6 cm and height 4 cm.\n\nArea = \\frac{1}{2} \\times 6 \\times 4 = 12 cm^2\n\n## Remember\n- Write the unit in the answer.\n',
  'Formula sheet': '# Formula sheet\n\n| Shape | Area | Perimeter |\n|---|---|---|\n| Square | a^2 | 4a |\n| Rectangle | l \\times b | 2(l + b) |\n| Triangle | \\frac{1}{2} b h | a + b + c |\n',
  'Worksheet': '# Practice worksheet\n\nName: ____________   Date: ________\n\n## Section A — Short answers\n1. ______________________________\n2. ______________________________\n3. ______________________________\n\n## Section B — Solve\n1. ______________________________\n',
}

const load = () => { try { return JSON.parse(localStorage.getItem(DRAFT)) } catch { return null } }
const store = v => { try { v ? localStorage.setItem(DRAFT, JSON.stringify(v)) : localStorage.removeItem(DRAFT) } catch { /* private mode */ } }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// The page a note prints on: title block, then the rendered notes.
export function noteHtml(n, tests, by) {
  const test = (tests || []).find(t => t.id === n.test_id)
  const meta = [n.subject || 'All subjects', test ? (test.title || 'Test ' + test.test_no) : '', by].filter(Boolean).join(' · ')
  return `<style>${MATH_CSS}${MATERIAL_CSS}</style><div class="title">${esc(n.title || 'Study material')}</div><div class="sub">${esc(meta)}</div><div class="md">${renderMaterial(n.body || '')}</div>`
}
export const printNote = (n, tests, by) => printPremium(noteHtml(n, tests, by), { title: n.title || 'Study material', institute: getInstitute(), docLabel: `${MISSION_NAME} · Study material`, official: true })

export default function NotesStudio({ tests, me, editing, onSaved, flash }) {
  const [d, setD] = useState(() => editing ? { ...blankNote, ...editing } : (load() || blankNote))
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [view, setView] = useState('write')   // phones show one pane at a time: write | page
  const ta = useRef(null)
  const set = patch => setD(x => ({ ...x, ...patch }))

  // keep an unsaved draft on this device (new notes only)
  useEffect(() => {
    if (editing) return undefined
    const t = setTimeout(() => store(d.title || d.body ? d : null), 600)
    return () => clearTimeout(t)
  }, [d, editing])

  const html = useMemo(() => renderMaterial(d.body || ''), [d.body])
  const smart = useSmartNotes({ body: d.body, setBody: t => set({ body: t }), flash })

  const edit = fn => {
    const el = ta.current, v = d.body, a = el?.selectionStart ?? v.length, b = el?.selectionEnd ?? a
    const r = fn(v, a, b)
    set({ body: r.text })
    setTimeout(() => { try { el?.focus(); el?.setSelectionRange(r.start, r.start) } catch { /* gone */ } }, 0)
  }
  const insertAt = (txt, caret) => edit((v, a, b) => ({ text: v.slice(0, a) + txt + v.slice(b), start: a + (caret ?? txt.length) }))
  const insertBlock = txt => edit((v, a) => { const pre = a > 0 && v[a - 1] !== '\n' ? '\n' : ''; return { text: v.slice(0, a) + pre + txt + '\n' + v.slice(a), start: a + pre.length + txt.length + 1 } })
  const useTemplate = name => { if (d.body.trim() && !window.confirm('Replace what you have typed with this template?')) return; set({ body: TEMPLATES[name] }) }
  const addFigure = async file => { try { insertBlock(figureLine(await figFromFile(file, { maxW: 640, quality: 0.8 }), '')) } catch (e) { flash(e.message, true) } }

  const save = async () => {
    if (!d.title.trim()) return flash('Give the notes a title.', true)
    if (!d.body.trim()) return flash('Write something first.', true)
    setBusy(true)
    const row = { title: d.title.trim(), subject: d.subject || null, test_id: d.test_id || null, body: d.body }
    const { error } = d.id
      ? await supabase.from(T_MAT).update({ ...row, updated_at: new Date().toISOString() }).eq('id', d.id)
      : await supabase.from(T_MAT).insert({ ...row, uploaded_by: me || 'Staff' })
    setBusy(false)
    if (error) return flash(/body|updated_at|column/i.test(error.message) ? 'Run migration 20261221 (study notes) in Supabase first. ' + error.message : 'Not saved: ' + error.message, true)
    store(null); flash(d.id ? 'Notes updated.' : 'Notes saved.'); setD(blankNote); onSaved?.()
  }

  const tb = { padding: '6px 10px', borderRadius: 8, border: `1px solid ${PX.line}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
  const field = { width: '100%', boxSizing: 'border-box' }
  return (
    <PremiumCard title={d.id ? 'Edit notes' : 'Write study material'} subtitle="Type the notes here — headings, lists, tables, formulas and pictures — and see the printed page beside them. Nothing to upload."
      right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {d.id && <button type="button" className="px-btn ghost" onClick={() => { setD(blankNote); onSaved?.(true) }}>Cancel</button>}
        <button type="button" className="px-btn ghost" disabled={!d.body.trim()} onClick={() => printNote(d, tests, me)}>🖨 Print</button>
      </div>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 12 }}>
        <label>Title<input className="px-input" style={field} value={d.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Fractions — chapter notes" /></label>
        <label>Subject<select className="px-input" style={field} value={d.subject} onChange={e => set({ subject: e.target.value })}><option value="">All subjects</option>{SUBJECTS.map(s => <option key={s.key}>{s.label}</option>)}</select></label>
        <label>For test<select className="px-input" style={field} value={d.test_id} onChange={e => set({ test_id: e.target.value })}><option value="">Any test</option>{tests.map(t => <option key={t.id} value={t.id}>{t.title || 'Test ' + t.test_no}</option>)}</select></label>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }} role="toolbar" aria-label="Formatting">
        {Object.keys(TEMPLATES).map(n => <button key={n} type="button" style={{ ...tb, background: '#fffaf0', borderColor: '#e8d9aa' }} onClick={() => useTemplate(n)}>{n}</button>)}
        <span style={{ width: 1, height: 22, background: PX.line }} aria-hidden="true" />
        <button type="button" style={tb} onClick={() => insertBlock('## Heading')}>H</button>
        <button type="button" style={tb} onClick={() => insertBlock('- Point')}>• List</button>
        <button type="button" style={tb} onClick={() => insertBlock('| Name | Value |\n|---|---|\n| One | 1 |\n| Two | 2 |')}>▦ Table</button>
        <button type="button" style={tb} onClick={() => insertBlock('> Note: ')}>💡 Box</button>
        <button type="button" style={tb} onClick={() => insertAt('**bold**', 2)}><b>B</b></button>
        <label style={{ ...tb, display: 'inline-flex', alignItems: 'center' }}>🖼 Picture<input type="file" accept="image/*" aria-label="Add a picture" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFigure(f) }} /></label>
        <button type="button" style={tb} onClick={() => setScan(true)}>📷 Scan</button>
      </div>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8 }} role="toolbar" aria-label="Maths symbols">
        {MATH_TOOLS.map(([l, t, c, title]) => <button key={title} type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => insertAt(t, c)} style={{ ...tb, minWidth: 34, flexShrink: 0, fontFamily: 'Georgia,serif', fontSize: 15 }}>{l}</button>)}
      </div>

      {smart.bar}
      <style>{`.mfn-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}.mfn-seg{display:none}@media (max-width:760px){.mfn-panes{grid-template-columns:minmax(0,1fr)}.mfn-seg{display:flex}.mfn-panes[data-view="write"] .mfn-page{display:none}.mfn-panes[data-view="page"] .mfn-write{display:none}}${MATH_CSS}${MATERIAL_CSS}`}</style>
      <div className="mfn-seg" role="tablist" aria-label="Notes view" data-ti-skip style={{ gap: 6, marginBottom: 8 }}>
        {[['write', '✍ Write'], ['page', '📄 Printed page']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} style={{ ...tb, flex: 1, background: view === k ? '#e4ebf6' : '#fff', borderColor: view === k ? PX.navy : PX.line }}>{l}</button>)}
      </div>
      <div className="mfn-panes" data-view={view}>
        <div className="mfn-write">
          <textarea ref={ta} value={d.body} onChange={e => set({ body: e.target.value })} onPaste={smart.onPaste} aria-label="Notes" placeholder={'# Title\n\n## Heading\n- a point\n\n> Formula: area = \\frac{1}{2} \\times b \\times h'} spellCheck
            style={{ ...field, minHeight: 360, border: `1.5px solid ${PX.line}`, borderRadius: 12, padding: 12, fontSize: 15, lineHeight: 1.55, fontFamily: "'IBM Plex Mono',ui-monospace,Menlo,monospace", resize: 'vertical' }} />
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 4 }}>{wordCount(d.body)} words · # heading · - list · | table | · &gt; note · **bold** · \frac{'{1}{2}'} fraction</div>
        </div>
        <div className="mfn-page" style={{ border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff', padding: 16, minHeight: 200, maxHeight: 520, overflow: 'auto' }}>
          {d.title && <div style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 18, color: '#132a4f', marginBottom: 2 }}>{d.title}</div>}
          <div style={{ fontSize: 12, color: PX.sub, marginBottom: 10 }}>{[d.subject || 'All subjects', MISSION_NAME].join(' · ')}</div>
          {d.body.trim() ? <div className="md" dangerouslySetInnerHTML={{ __html: html }} /> : <div style={{ color: PX.sub, fontSize: 13.5 }}>The page appears here as you type.</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="px-btn gold" disabled={busy} style={{ minHeight: 46 }} onClick={save}>{busy ? 'Saving…' : d.id ? 'Update notes' : 'Save notes'}</button>
        {!d.id && (d.title || d.body) && <button type="button" className="px-btn ghost" onClick={() => { if (window.confirm('Clear everything you have typed?')) { setD(blankNote); store(null) } }}>Clear</button>}
        {!d.id && (d.title || d.body) && <span style={{ alignSelf: 'center', fontSize: 12, color: PX.sub }}>Draft kept on this device until you save.</span>}
      </div>
      {scan && <ScanFigure onDone={url => { setScan(false); insertBlock(figureLine(url, '')) }} onClose={() => setScan(false)} />}
    </PremiumCard>
  )
}

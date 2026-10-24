// NoticeMaker.jsx — build a formal notice on the institute letterhead:
// pick a ready-made notice or start blank, edit the fields and blocks with a
// live preview, then print / save as PDF, download Word, copy the text, share
// on WhatsApp, keep drafts, or post it to the Notice Board.
import { useEffect, useMemo, useState } from 'react'
import { getInstitute } from './systemSettings'
import { setInstitute, PRESETS, BLOCK_LABEL, blankNotice, newBlock, noticeHTML, noticeText, printNotice, downloadNoticeDocx } from './noticeMaker'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }
const btn = { border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: '8px 12px', fontFamily: 'inherit', background: '#f1f5f9', color: '#334155' }
const gold = { ...btn, background: 'linear-gradient(180deg,#D9B566,#C9A24B)', color: '#0B1E3D' }
const card = { background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 12 }
const DRAFTS_KEY = 'gnsi:notice-maker-drafts'
const SEQ_KEY = 'gnsi:notice-maker-seq'

const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const Field = ({ label, children, style }) => <label style={{ display: 'block', ...style }}><span style={lbl}>{label}</span>{children}</label>
const move = (xs, i, d) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c }

export default function NoticeMaker({ onPost, mobile }) {
  const [n, setN] = useState(() => { setInstitute(getInstitute()); return PRESETS['Fee Collection Drive']() })
  const [drafts, setDrafts] = useState(() => readJSON(DRAFTS_KEY, []))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState('edit')
  const [post, setPost] = useState({ category: 'General', audience: 'Staff', status: 'Published', expiry_date: '' })

  const set = patch => setN(v => ({ ...v, ...patch }))
  const setLh = patch => setN(v => ({ ...v, letterhead: { ...v.letterhead, ...patch } }))
  const setBlock = (id, patch) => setN(v => ({ ...v, blocks: v.blocks.map(b => b.id === id ? { ...b, ...patch } : b) }))
  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

  const html = useMemo(() => noticeHTML(n), [n])
  useEffect(() => { writeJSON(DRAFTS_KEY, drafts) }, [drafts])

  const loadPreset = name => { if (!name) return; if (window.confirm(`Replace what you have written with “${name}”?`)) setN(name === 'Blank notice' ? blankNotice() : PRESETS[name]()) }
  const numberIt = () => {
    const year = new Date().getFullYear()
    const seq = readJSON(SEQ_KEY, {})
    const key = `${n.refPrefix}/${year}`
    const next = (seq[key] || 0) + 1
    writeJSON(SEQ_KEY, { ...seq, [key]: next })
    set({ ref: `${key}/${String(next).padStart(3, '0')}` })
  }
  const saveDraft = () => {
    const name = window.prompt('Name this draft', n.subject || n.heading)
    if (!name) return
    setDrafts(d => [{ id: Date.now(), name, saved: new Date().toLocaleString('en-IN'), doc: n }, ...d].slice(0, 30))
    flash('Draft saved on this computer.')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(noticeText(n)); flash('Notice text copied.') } catch { flash('Could not copy — select the text in the preview instead.') }
  }
  const word = async () => { setBusy(true); try { await downloadNoticeDocx(n) } catch (e) { flash('Word file failed: ' + e.message) } setBusy(false) }
  const doPost = async () => {
    if (!n.subject.trim() && !n.heading.trim()) return flash('Add a subject first.')
    setBusy(true)
    const err = await onPost({
      title: n.subject || n.heading, description: noticeText(n), category: post.category, audience: post.audience, class_target: '',
      publish_date: new Date().toISOString().split('T')[0], expiry_date: post.expiry_date || '', priority: n.urgent ? 'Urgent' : 'Normal', status: post.status,
      attachment_url: '', created_by: '', pinned: false, template_name: 'Notice Maker', is_public: false,
    })
    setBusy(false)
    flash(err ? 'Could not post: ' + err : 'Posted to the Notice Board (internal, not public).')
  }

  const addBlock = type => set({ blocks: [...n.blocks, newBlock(type)] })
  const delBlock = id => set({ blocks: n.blocks.filter(b => b.id !== id) })
  const rowBtn = { ...btn, padding: '4px 8px' }

  const blockEditor = (b, i) => (
    <div key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 10, background: '#fafbfd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
        <b style={{ fontSize: 12, color: '#1e3a5f' }}>{BLOCK_LABEL[b.type]}</b>
        <span style={{ display: 'flex', gap: 4 }}>
          <button style={rowBtn} onClick={() => set({ blocks: move(n.blocks, i, -1) })} disabled={i === 0} aria-label="Move up">↑</button>
          <button style={rowBtn} onClick={() => set({ blocks: move(n.blocks, i, 1) })} disabled={i === n.blocks.length - 1} aria-label="Move down">↓</button>
          <button style={{ ...rowBtn, background: '#fee2e2', color: '#dc2626' }} onClick={() => delBlock(b.id)} aria-label="Delete block">🗑</button>
        </span>
      </div>
      {(b.type === 'para' || b.type === 'list') && <textarea style={{ ...inp, minHeight: 70 }} value={b.text} onChange={e => setBlock(b.id, { text: e.target.value })} placeholder="Write the paragraph…" />}
      {b.type === 'list' && <>
        {b.items.map((x, k) => (
          <div key={k} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, paddingTop: 9 }}>({String.fromCharCode(97 + k)})</span>
            <textarea style={{ ...inp, minHeight: 44 }} value={x} onChange={e => setBlock(b.id, { items: b.items.map((y, m) => m === k ? e.target.value : y) })} />
            <button style={rowBtn} onClick={() => setBlock(b.id, { items: b.items.filter((_, m) => m !== k) })} aria-label="Remove item">✕</button>
          </div>
        ))}
        <button style={{ ...btn, marginTop: 6 }} onClick={() => setBlock(b.id, { items: [...b.items, ''] })}>＋ Add item</button>
      </>}
      {b.type === 'steps' && <>
        <Field label="Heading"><input style={inp} value={b.heading} onChange={e => setBlock(b.id, { heading: e.target.value })} /></Field>
        <Field label="Note under the heading (optional)" style={{ marginTop: 6 }}><input style={inp} value={b.note} onChange={e => setBlock(b.id, { note: e.target.value })} /></Field>
        {b.items.map((s, k) => (
          <div key={k} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span style={{ fontWeight: 800, color: '#B8913F', paddingTop: 8 }}>{k + 1}</span>
            <div style={{ flex: 1, display: 'grid', gap: 4 }}>
              <input style={inp} placeholder="Step title" value={s.title} onChange={e => setBlock(b.id, { items: b.items.map((y, m) => m === k ? { ...y, title: e.target.value } : y) })} />
              <textarea style={{ ...inp, minHeight: 44 }} placeholder="What to do" value={s.text} onChange={e => setBlock(b.id, { items: b.items.map((y, m) => m === k ? { ...y, text: e.target.value } : y) })} />
            </div>
            <button style={rowBtn} onClick={() => setBlock(b.id, { items: b.items.filter((_, m) => m !== k) })} aria-label="Remove step">✕</button>
          </div>
        ))}
        <button style={{ ...btn, marginTop: 8 }} onClick={() => setBlock(b.id, { items: [...b.items, { title: '', text: '' }] })}>＋ Add step</button>
      </>}
      {b.type === 'table' && <>
        <Field label="Heading"><input style={inp} value={b.heading} onChange={e => setBlock(b.id, { heading: e.target.value })} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 6, marginTop: 6 }}>
          {b.head.map((h, k) => <input key={k} style={{ ...inp, fontWeight: 700 }} aria-label={`Column ${k + 1} title`} value={h} onChange={e => setBlock(b.id, { head: b.head.map((y, m) => m === k ? e.target.value : y) })} />)}
        </div>
        {b.rows.map((r, k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr auto', gap: 6, marginTop: 6, alignItems: 'start' }}>
            <span style={{ fontSize: 12, paddingTop: 9 }}>{k + 1}</span>
            <textarea style={{ ...inp, minHeight: 40 }} value={r.a} onChange={e => setBlock(b.id, { rows: b.rows.map((y, m) => m === k ? { ...y, a: e.target.value } : y) })} />
            <textarea style={{ ...inp, minHeight: 40 }} value={r.b} onChange={e => setBlock(b.id, { rows: b.rows.map((y, m) => m === k ? { ...y, b: e.target.value } : y) })} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, display: 'flex', gap: 3, alignItems: 'center', color: '#b42318' }}><input type="checkbox" checked={!!r.final} onChange={e => setBlock(b.id, { rows: b.rows.map((y, m) => m === k ? { ...y, final: e.target.checked } : y) })} />Final</label>
              <button style={rowBtn} onClick={() => setBlock(b.id, { rows: b.rows.filter((_, m) => m !== k) })} aria-label="Remove row">✕</button>
            </span>
          </div>
        ))}
        <button style={{ ...btn, marginTop: 8 }} onClick={() => setBlock(b.id, { rows: [...b.rows, { a: '', b: '', final: false }] })}>＋ Add row</button>
      </>}
      {b.type === 'box' && <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 6 }}>
          <Field label="Heading"><input style={inp} value={b.heading} onChange={e => setBlock(b.id, { heading: e.target.value })} /></Field>
          <Field label="Colour"><select style={inp} value={b.tone} onChange={e => setBlock(b.id, { tone: e.target.value })}><option value="red">Red</option><option value="blue">Blue</option><option value="grey">Grey</option></select></Field>
        </div>
        <textarea style={{ ...inp, minHeight: 70, marginTop: 6 }} value={b.text} onChange={e => setBlock(b.id, { text: e.target.value })} />
      </>}
    </div>
  )

  const editor = (
    <div>
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8 }}>
          <Field label="Start from">
            <select style={inp} value="" onChange={e => loadPreset(e.target.value)}>
              <option value="">— choose a ready-made notice —</option>
              {Object.keys(PRESETS).map(k => <option key={k}>{k}</option>)}<option>Blank notice</option>
            </select>
          </Field>
          <Field label="Saved drafts">
            <select style={inp} value="" onChange={e => { const d = drafts.find(x => String(x.id) === e.target.value); if (d && window.confirm(`Open “${d.name}”? Your current text will be replaced.`)) setN(d.doc) }}>
              <option value="">{drafts.length ? `— ${drafts.length} saved —` : '— none yet —'}</option>
              {drafts.map(d => <option key={d.id} value={d.id}>{d.name} · {d.saved}</option>)}
            </select>
          </Field>
        </div>
        {drafts.length > 0 && <button style={{ ...btn, marginTop: 8, color: '#dc2626' }} onClick={() => { const id = window.prompt('Type the exact name of the draft to delete'); if (id) setDrafts(d => d.filter(x => x.name !== id)) }}>🗑 Delete a draft</button>}
      </div>

      <div style={card}>
        <b style={{ fontSize: 13, color: '#1e3a5f' }}>Heading and addressee</b>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8, marginTop: 8 }}>
          <Field label="Title"><input style={inp} value={n.heading} onChange={e => set({ heading: e.target.value })} placeholder="NOTICE / CIRCULAR / ORDER" /></Field>
          <Field label="Line under the title"><input style={inp} value={n.subtitle} onChange={e => set({ subtitle: e.target.value })} /></Field>
          <Field label="Ref. No. prefix"><input style={inp} value={n.refPrefix} onChange={e => set({ refPrefix: e.target.value })} /></Field>
          <Field label="Reference number">
            <span style={{ display: 'flex', gap: 6 }}><input style={inp} value={n.ref} onChange={e => set({ ref: e.target.value })} placeholder="e.g. GN&SI/Fees/2026/001" /><button style={btn} onClick={numberIt} title="Next number for this prefix">🔢 Number it</button></span>
          </Field>
          <Field label="Date"><input style={inp} value={n.date} onChange={e => set({ date: e.target.value })} /></Field>
          <Field label="To"><input style={inp} value={n.to} onChange={e => set({ to: e.target.value })} /></Field>
        </div>
        <Field label="Subject" style={{ marginTop: 8 }}><input style={inp} value={n.subject} onChange={e => set({ subject: e.target.value })} /></Field>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={n.urgent} onChange={e => set({ urgent: e.target.checked })} /> Mark as URGENT</label>
      </div>

      <div style={card}>
        <b style={{ fontSize: 13, color: '#1e3a5f' }}>Body</b>
        <div style={{ fontSize: 11, color: '#64748b', margin: '4px 0 10px' }}>Type <code>**text**</code> for bold and <code>[[text]]</code> for red bold. Paragraph numbers are added automatically.</div>
        {n.blocks.map(blockEditor)}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(BLOCK_LABEL).map(([t, l]) => <button key={t} style={btn} onClick={() => addBlock(t)}>＋ {l}</button>)}
        </div>
      </div>

      <div style={card}>
        <b style={{ fontSize: 13, color: '#1e3a5f' }}>Closing and signature</b>
        <Field label="Closing line (bold)" style={{ marginTop: 8 }}><textarea style={{ ...inp, minHeight: 50 }} value={n.closing} onChange={e => set({ closing: e.target.value })} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <Field label="Signed as"><input style={inp} value={n.signBy} onChange={e => set({ signBy: e.target.value })} /></Field>
          <Field label="Designation"><input style={inp} value={n.signTitle} onChange={e => set({ signTitle: e.target.value })} /></Field>
          <Field label="Institute"><input style={inp} value={n.signOrg} onChange={e => set({ signOrg: e.target.value })} /></Field>
        </div>
        <Field label="Copy to (one per line)" style={{ marginTop: 8 }}><textarea style={{ ...inp, minHeight: 60 }} value={n.copyTo.join('\n')} onChange={e => set({ copyTo: e.target.value.split('\n') })} /></Field>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={n.ack} onChange={e => set({ ack: e.target.checked })} /> Add a tear-off acknowledgement slip</label>
      </div>

      <details style={card}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>Letterhead</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <Field label="Institute name"><input style={inp} value={n.letterhead.name} onChange={e => setLh({ name: e.target.value })} /></Field>
          <Field label="Tagline"><input style={inp} value={n.letterhead.tagline} onChange={e => setLh({ tagline: e.target.value })} /></Field>
          <Field label="Address line"><input style={inp} value={n.letterhead.address} onChange={e => setLh({ address: e.target.value })} /></Field>
          <Field label="Registration line"><input style={inp} value={n.letterhead.regd} onChange={e => setLh({ regd: e.target.value })} /></Field>
          <Field label="Logo web link (optional)"><input style={inp} value={n.letterhead.logoUrl} onChange={e => setLh({ logoUrl: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </details>
    </div>
  )

  const actions = (
    <div style={card}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={gold} onClick={() => printNotice(n)}>🖨️ Print / Save as PDF</button>
        <button style={gold} disabled={busy} onClick={word}>📄 Download Word</button>
        <button style={btn} onClick={copy}>📋 Copy text</button>
        <a style={{ ...btn, textDecoration: 'none', display: 'inline-block' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(noticeText(n))}`}>📲 WhatsApp</a>
        <button style={btn} onClick={saveDraft}>💾 Save draft</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr) auto', gap: 8, marginTop: 12, alignItems: 'end' }}>
        <Field label="Category"><select style={inp} value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))}>{['General', 'Exam', 'Holiday', 'Fee', 'Event', 'Academic'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Audience"><select style={inp} value={post.audience} onChange={e => setPost(p => ({ ...p, audience: e.target.value }))}>{['All', 'Students', 'Parents', 'Staff', 'Teachers'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Status"><select style={inp} value={post.status} onChange={e => setPost(p => ({ ...p, status: e.target.value }))}><option>Published</option><option>Draft</option></select></Field>
        <Field label="Expiry (optional)"><input type="date" style={inp} value={post.expiry_date} onChange={e => setPost(p => ({ ...p, expiry_date: e.target.value }))} /></Field>
        <button style={gold} disabled={busy} onClick={doPost}>📌 Post to Notice Board</button>
      </div>
      {msg && <div role="status" style={{ marginTop: 10, fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '6px 10px' }}>{msg}</div>}
    </div>
  )

  const preview = <iframe title="Notice preview" srcDoc={html} style={{ width: '100%', height: mobile ? '75vh' : '86vh', border: '1px solid #cbd5e1', borderRadius: 10, background: '#e9ecf2' }} />

  return (
    <div>
      {actions}
      {mobile && (
        <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['edit', '✍️ Edit'], ['preview', '👁 Preview']].map(([id, l]) => <button key={id} role="tab" aria-selected={view === id} style={{ ...btn, flex: 1, background: view === id ? '#1e3a5f' : '#f1f5f9', color: view === id ? '#fff' : '#334155' }} onClick={() => setView(id)}>{l}</button>)}
        </div>
      )}
      {mobile ? (view === 'edit' ? editor : preview) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 5fr) 6fr', gap: 14, alignItems: 'start' }}>
          <div>{editor}</div>
          <div style={{ position: 'sticky', top: 8 }}>{preview}</div>
        </div>
      )}
    </div>
  )
}

// PaperPreview.jsx — the question-paper preview with an advanced editor for admins.
// The paper is shown in a same-origin, script-free iframe. Admins can change the layout (size, spacing, columns,
// option layout, banner, instructions, watermark), edit any text on the page, and move, delete or page-break
// questions before printing. Edits change only this printout, never the question bank.
import { useEffect, useRef, useState } from 'react'

const DEFAULTS = { size: 0, line: 0, cols: 0, opts: 'auto', gap: 0, banner: true, note: true, wm: true, rule: true }

// CSS that applies the editor's choices over the paper's own stylesheet.
export function editorCss(o) {
  const r = []
  if (o.size) r.push(`body,.q,.o,.pass,.ins{font-size:${o.size}pt!important}`)
  if (o.line) r.push(`body,.q,.o{line-height:${o.line}!important}`)
  if (o.cols) r.push(`.cols{column-count:${o.cols}!important}`)
  if (!o.rule) r.push('.cols{column-rule:none!important}')
  if (o.opts !== 'auto') {
    const n = { four: 4, two: 2, one: 1 }[o.opts] || 2
    r.push(`.o{display:grid!important;grid-template-columns:repeat(${n},minmax(0,1fr))!important;gap:.4mm 3mm!important}.o span{white-space:normal!important}`)
  }
  if (o.gap) r.push(`.q{margin-bottom:${o.gap}mm!important}`)
  if (!o.banner) r.push('.banner{display:none!important}')
  if (!o.note) r.push('.note{display:none!important}')
  if (!o.wm) r.push('.wm{display:none!important}')
  r.push('.pe-sel{outline:1.5pt dashed #c58b00;outline-offset:1.5pt}.pe-break{break-before:column}.pe-pbreak{break-before:page}@media print{.pe-sel{outline:none}}')
  return r.join('\n')
}

// Renumber the questions on the page: from 1 in every section when `restart`, otherwise straight through.
export function renumber(doc, restart) {
  let n = 0
  doc.querySelectorAll('.sec, .q').forEach(el => {
    if (el.classList.contains('sec')) { if (restart) n = 0; return }
    const b = el.querySelector(':scope > b'); if (b) b.textContent = `${++n}.`
  })
}

export default function PaperPreview({ html, title, isAdmin, restart = false, onClose, onPrint }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)          // editor panel shown
  const [editing, setEditing] = useState(false)    // text editing on the page
  const [o, setO] = useState(DEFAULTS)
  const [sel, setSel] = useState(null)
  const [src, setSrc] = useState(html)
  const doc = () => ref.current?.contentDocument

  useEffect(() => { setSrc(html) }, [html])
  // Apply the layout choices and keep text editing in step with the switch.
  const apply = () => {
    const d = doc(); if (!d?.head) return
    let st = d.getElementById('pe-style'); if (!st) { st = d.createElement('style'); st.id = 'pe-style'; d.head.appendChild(st) }
    st.textContent = editorCss(o)
    d.designMode = editing ? 'on' : 'off'
  }
  useEffect(apply)   // eslint-disable-line react-hooks/exhaustive-deps

  const onLoad = () => {
    const d = doc(); if (!d) return
    apply()
    d.addEventListener('click', e => {
      const q = e.target.closest?.('.q, .sec, .pass, .ins, .note'); d.querySelectorAll('.pe-sel').forEach(x => x.classList.remove('pe-sel'))
      if (q) { q.classList.add('pe-sel'); setSel(q.classList.contains('q') ? 'q' : 'block') } else setSel(null)
    })
  }
  const cur = () => doc()?.querySelector('.pe-sel')
  const move = dir => {
    const el = cur(); if (!el) return
    const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling
    if (!sib || sib.classList.contains('sec')) return
    if (dir < 0) sib.before(el); else sib.after(el)
    renumber(doc(), restart)
  }
  const remove = () => { const el = cur(); if (!el) return; el.remove(); setSel(null); renumber(doc(), restart) }
  const brk = kind => { const el = cur(); if (!el) return; el.classList.toggle(kind === 'page' ? 'pe-pbreak' : 'pe-break') }
  const reset = () => { setO(DEFAULTS); setEditing(false); setSel(null); setSrc(html + ' ') }   // a changed srcDoc reloads the original paper
  const print = () => {
    const d = doc(); if (!d) return
    d.querySelectorAll('.pe-sel').forEach(x => x.classList.remove('pe-sel'))
    d.designMode = 'off'
    const out = '<!doctype html>\n' + d.documentElement.outerHTML
    if (onPrint) onPrint(out)
    else { const w = window.open('', '_blank'); if (w) { w.document.write(out.replace('</body>', '<script>window.onload=()=>window.print()</script></body>')); w.document.close() } }
    if (editing) d.designMode = 'on'
  }

  const lab = { display: 'grid', gap: 3, fontSize: 12, fontWeight: 700, color: '#334155' }
  const set = patch => setO(x => ({ ...x, ...patch }))
  return (
    <div className="msx-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div className="msx-dialog" role="dialog" aria-modal="true" aria-label="Paper preview" onClick={e => e.stopPropagation()} style={{ width: open ? 'min(1180px,100%)' : 'min(900px,100%)', height: '90vh', background: '#fff', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <b style={{ flex: 1, fontSize: 14, minWidth: 160 }}>{title}</b>
          {isAdmin && <button className={'px-btn ' + (open ? 'gold' : 'ghost')} aria-pressed={open} onClick={() => setOpen(v => !v)}>✏️ Advanced editor</button>}
          <button className="px-btn gold" onClick={print}>🖨 Print</button>
          <button className="px-btn ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {open && (
            <div style={{ width: 270, flex: 'none', borderRight: '1px solid #e2e8f0', padding: 12, overflowY: 'auto', display: 'grid', gap: 12, alignContent: 'start', background: '#f8fafc' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Changes apply to this printout only. To fix a question for good, edit it in the question list.</div>
              <label style={{ ...lab, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={editing} onChange={e => setEditing(e.target.checked)} />Edit text on the page</label>
              <div style={{ fontWeight: 800, fontSize: 12.5 }}>Layout</div>
              <label style={lab}>Text size ({o.size || 'paper default'}{o.size ? ' pt' : ''})<input type="range" min="0" max="13" step="0.2" value={o.size || 0} onChange={e => set({ size: Number(e.target.value) < 8 ? 0 : Number(e.target.value) })} /></label>
              <label style={lab}>Line spacing<select className="px-input" value={o.line} onChange={e => set({ line: Number(e.target.value) })}><option value={0}>Paper default</option><option value={1.1}>Tight (1.1)</option><option value={1.25}>Normal (1.25)</option><option value={1.4}>Relaxed (1.4)</option><option value={1.6}>Wide (1.6)</option></select></label>
              <label style={lab}>Columns<select className="px-input" value={o.cols} onChange={e => set({ cols: Number(e.target.value) })}><option value={0}>Paper default</option><option value={1}>1 column</option><option value={2}>2 columns</option></select></label>
              <label style={lab}>Options<select className="px-input" value={o.opts} onChange={e => set({ opts: e.target.value })}><option value="auto">Automatic (by length)</option><option value="four">4 in a row</option><option value="two">2 × 2</option><option value="one">One per line</option></select></label>
              <label style={lab}>Space between questions ({o.gap || 'default'}{o.gap ? ' mm' : ''})<input type="range" min="0" max="8" step="0.5" value={o.gap} onChange={e => set({ gap: Number(e.target.value) })} /></label>
              <div style={{ display: 'grid', gap: 6 }}>
                {[['banner', 'Title banner'], ['note', 'Instruction line'], ['wm', 'Watermark'], ['rule', 'Line between columns']].map(([k, l]) => <label key={k} style={{ ...lab, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={o[k]} onChange={e => set({ [k]: e.target.checked })} />{l}</label>)}
              </div>
              <div style={{ fontWeight: 800, fontSize: 12.5 }}>Selected question</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{sel ? 'Click another question to switch.' : 'Click a question on the paper to select it.'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button className="px-hbtn" disabled={sel !== 'q'} onClick={() => move(-1)}>↑ Up</button>
                <button className="px-hbtn" disabled={sel !== 'q'} onClick={() => move(1)}>↓ Down</button>
                <button className="px-hbtn" disabled={!sel} onClick={() => brk('col')}>Column break</button>
                <button className="px-hbtn" disabled={!sel} onClick={() => brk('page')}>Page break</button>
                <button className="px-hbtn" disabled={!sel} onClick={remove} style={{ color: '#b91c1c' }}>Remove</button>
              </div>
              <button className="px-hbtn" onClick={() => renumber(doc(), restart)}>Renumber questions</button>
              <button className="px-btn ghost" onClick={reset}>Undo all changes</button>
            </div>
          )}
          <iframe ref={ref} title="Paper preview" srcDoc={src} onLoad={onLoad} style={{ flex: 1, border: 0, width: '100%', background: '#eef1f6' }} sandbox="allow-same-origin allow-modals" />
        </div>
      </div>
    </div>
  )
}

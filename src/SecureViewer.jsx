// SecureViewer.jsx — shows a PDF / image on screen only: pages are painted onto canvases (no PDF toolbar, no
// download or print button, no file link), the viewer's name + date is tiled across every page, and
// right-click, copy, save and print are blocked while it is open.
// Honest limit: a browser can never fully stop a screenshot or a determined developer; this stops the
// ordinary download / print / "save as" routes and makes any leaked copy traceable to the viewer.
import { useEffect, useRef, useState } from 'react'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { fetchFile } from './lib/classMaterialStore'

const wmSvg = (text) => {
  const t = String(text).replace(/[<>&"]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="330" height="230"><text x="165" y="115" transform="rotate(-28 165 115)" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="rgba(15,27,46,0.13)">${t}</text></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}
const BLOCK = new Set(['s', 'p', 'c', 'x', 'a', 'u'])

export default function SecureViewer({ item, viewer, onClose }) {
  const box = useRef(null)
  const [state, setState] = useState({ phase: 'loading', pages: 0, done: 0, error: '' })

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if ((e.ctrlKey || e.metaKey) && BLOCK.has(e.key.toLowerCase())) { e.preventDefault(); e.stopPropagation() }
      if (e.key === 'PrintScreen') { try { navigator.clipboard?.writeText('') } catch { /* ignore */ } }
    }
    window.addEventListener('keydown', key, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key, true); document.body.style.overflow = prevOverflow }
  }, [onClose])

  useEffect(() => {
    let dead = false
    let pdf = null
    const host = box.current
    ;(async () => {
      try {
        const blob = await fetchFile(item)
        if (dead) return
        const width = Math.min(host.clientWidth - 8, 980)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const add = () => { const c = document.createElement('canvas'); c.style.cssText = 'display:block;margin:0 auto 12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25);max-width:100%;height:auto;pointer-events:none'; host.appendChild(c); return c }
        if (item.file_type === 'image') {
          const bmp = await createImageBitmap(blob)
          const scale = Math.min(1, width / bmp.width)
          const c = add(); c.width = bmp.width; c.height = bmp.height; c.style.width = bmp.width * scale + 'px'
          c.getContext('2d').drawImage(bmp, 0, 0)
          setState({ phase: 'ready', pages: 1, done: 1, error: '' })
          return
        }
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
        pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise
        setState({ phase: 'ready', pages: pdf.numPages, done: 0, error: '' })
        for (let n = 1; n <= pdf.numPages && !dead; n += 1) {
          const page = await pdf.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: (width / base.width) * dpr })
          const c = add(); c.width = vp.width; c.height = vp.height; c.style.width = vp.width / dpr + 'px'
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
          if (!dead) setState((s) => ({ ...s, done: n }))
        }
      } catch (e) {
        if (!dead) setState({ phase: 'error', pages: 0, done: 0, error: e.message || 'Could not open this file.' })
      }
    })()
    return () => { dead = true; try { pdf?.destroy() } catch { /* ignore */ }; if (host) host.replaceChildren() }
  }, [item])

  const mark = `${viewer || 'GNSI staff'} · ${new Date().toLocaleDateString('en-IN')}`
  return (
    <div role="dialog" aria-label={item.title} onContextMenu={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}
      className="sv-root" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#1e293b', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <style>{'@media print{.sv-root{display:none!important}}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f1b2e', color: '#fff', flexWrap: 'wrap' }}>
        <b style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👁 {item.title}</b>
        <span style={{ fontSize: 11, opacity: .75 }}>View only — download &amp; print are disabled{state.pages > 1 ? ` · ${state.done}/${state.pages} pages` : ''}</span>
        <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', borderRadius: 10, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', minHeight: 38 }}>✕ Close</button>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'auto' }}>
        <div ref={box} style={{ padding: '12px 4px 40px', minHeight: '100%' }} />
        <div aria-hidden style={{ position: 'fixed', inset: 0, top: 52, pointerEvents: 'none', backgroundImage: wmSvg(mark), backgroundRepeat: 'repeat' }} />
        {state.phase === 'loading' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>⏳ Opening…</div>}
        {state.phase === 'error' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fecaca', padding: 24, textAlign: 'center' }}>⚠️ {state.error}</div>}
      </div>
    </div>
  )
}

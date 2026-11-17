// ScanFigure.jsx — scan a figure with the camera (or pick a photo), then clean it up: rotate, enhance, crop.
// Used for question figures, Venn / non-verbal figures and picture options. Calls onDone(dataUrl) with a compact JPEG.
import { useState, useEffect, useRef, useCallback } from 'react'
import { PX } from './premiumUI'
import { autoLevels, blackAndWhite, trimBox } from './lib/scanImage'

const MAX_SRC = 1600   // working size: plenty for a figure, small enough for phones

const toCanvas = (img, max = MAX_SRC) => {
  const k = Math.min(1, max / Math.max(img.width || img.videoWidth, img.height || img.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.round((img.width || img.videoWidth) * k); c.height = Math.round((img.height || img.videoHeight) * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c
}

export default function ScanFigure({ title = 'Scan a figure', onDone, onClose, maxW = 640, quality = 0.82, cap = 350000, label = 'Figure' }) {
  const [src, setSrc] = useState(null)               // source canvas
  const [rot, setRot] = useState(0)                   // quarter turns
  const [mode, setMode] = useState('clean')           // orig | clean | bw
  const [crop, setCrop] = useState(null)              // { x, y, w, h } in display pixels
  const [err, setErr] = useState('')
  const [camOn, setCamOn] = useState(false)
  const video = useRef(null), stream = useRef(null), view = useRef(null), work = useRef(null), drag = useRef(null)

  const stopCam = useCallback(() => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamOn(false) }, [])
  useEffect(() => () => stopCam(), [stopCam])
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const startCam = async () => {
    setErr('')
    if (!navigator.mediaDevices?.getUserMedia) return setErr('This browser cannot open the camera here. Choose a photo instead.')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      stream.current = s; setCamOn(true)
      setTimeout(() => { if (video.current) { video.current.srcObject = s; video.current.play?.() } }, 0)
    } catch { setErr('Camera blocked or not available. Allow camera access, or choose a photo instead.') }
  }
  const snap = () => { const v = video.current; if (!v?.videoWidth) return; setSrc(toCanvas(v)); setRot(0); setCrop(null); stopCam() }
  const pickFile = e => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!/^image\//.test(f.type)) return setErr('Choose an image file.')
    const url = URL.createObjectURL(f), img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); setErr('Could not open that image.') }
    img.onload = () => { setSrc(toCanvas(img)); setRot(0); setCrop(null); setErr(''); URL.revokeObjectURL(url) }
    img.src = url
  }

  // Rebuild the working picture (rotate + enhance) whenever the source, rotation or mode changes, and draw it scaled to fit.
  useEffect(() => {
    if (!src) return
    const q = rot % 4, w = q % 2 ? src.height : src.width, h = q % 2 ? src.width : src.height
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); g.translate(w / 2, h / 2); g.rotate((q * Math.PI) / 2); g.drawImage(src, -src.width / 2, -src.height / 2)
    if (mode !== 'orig') {
      const id = g.getImageData(0, 0, w, h)
      autoLevels(id); if (mode === 'bw') blackAndWhite(id)
      g.putImageData(id, 0, 0)
    }
    work.current = c
    const out = view.current
    if (out) { const k = Math.min(1, 520 / w, (window.innerHeight * 0.5) / h); out.width = Math.round(w * k); out.height = Math.round(h * k); out.getContext('2d').drawImage(c, 0, 0, out.width, out.height) }
  }, [src, rot, mode])

  const rel = e => { const r = view.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)), r } }
  const down = e => { e.currentTarget.setPointerCapture?.(e.pointerId); const p = rel(e); drag.current = { x: p.x, y: p.y }; setCrop(null) }
  const move = e => { if (!drag.current) return; const p = rel(e), d = drag.current; setCrop({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) }) }
  const up = () => { drag.current = null; setCrop(c => (c && c.w > 12 && c.h > 12 ? c : null)) }
  const autoTrim = () => {
    const c = work.current, out = view.current; if (!c || !out) return
    const id = c.getContext('2d').getImageData(0, 0, c.width, c.height), b = trimBox(id)
    if (!b) return setErr('Nothing to trim — the page looks blank.')
    const k = out.width / c.width; setErr(''); setCrop({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k })
  }
  const use = () => {
    const c = work.current, out = view.current; if (!c || !out) return
    const k = c.width / out.width
    const r = crop && crop.w > 12 ? { x: crop.x * k, y: crop.y * k, w: crop.w * k, h: crop.h * k } : { x: 0, y: 0, w: c.width, h: c.height }
    let scale = Math.min(1, maxW / r.w), q = quality
    for (let i = 0; i < 8; i++) {
      const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(r.w * scale)); o.height = Math.max(1, Math.round(r.h * scale))
      const g = o.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, r.x, r.y, r.w, r.h, 0, 0, o.width, o.height)
      const url = o.toDataURL('image/jpeg', q)
      if (url.length <= cap) { onDone(url); return }
      if (q > 0.55) q -= 0.12; else scale *= 0.8                 // shrink quality first, then size, until it fits
    }
    setErr(`${label} is too detailed to fit — crop closer or try black & white.`)
  }

  const btn = { padding: '9px 14px', borderRadius: 12, border: `1.5px solid ${PX.line}`, background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink }
  const on = a => ({ ...btn, borderColor: a ? PX.gold : PX.line, background: a ? PX.goldBg : '#fff' })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.62)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{ width: 'min(600px,100%)', maxHeight: '94vh', overflow: 'auto', background: '#fff', borderRadius: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <b style={{ flex: 1, fontSize: 17 }}>{title}</b>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: '#f1ede3', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 17 }}>×</button>
        </div>
        {err && <div role="alert" style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: '#fdecea', color: '#8f1d14', fontSize: 13 }}>{err}</div>}

        {!src && !camOn && (
          <div style={{ display: 'grid', gap: 10, padding: '6px 0 4px' }}>
            <div style={{ fontSize: 13, color: PX.sub }}>Photograph the figure from a printed page, or pick a photo / screenshot. You can rotate, clean up and crop it next.</div>
            <button type="button" onClick={startCam} style={{ ...btn, padding: '16px', fontSize: 15 }}>📷 Open camera</button>
            <label style={{ ...btn, padding: '16px', fontSize: 15, textAlign: 'center', display: 'block' }}>🖼️ Choose a photo or file
              <input type="file" accept="image/*" aria-label="Choose a photo" style={{ display: 'none' }} onChange={pickFile} /></label>
            <label style={{ ...btn, padding: '12px', textAlign: 'center', display: 'block', fontSize: 13 }}>📱 Use the phone's camera app instead
              <input type="file" accept="image/*" capture="environment" aria-label="Take a photo with the camera app" style={{ display: 'none' }} onChange={pickFile} /></label>
          </div>
        )}

        {camOn && (
          <div>
            <video ref={video} playsInline muted style={{ width: '100%', maxHeight: '58vh', background: '#000', borderRadius: 12, objectFit: 'contain' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={snap} style={{ ...btn, flex: 1, background: PX.gold, color: '#fff', borderColor: PX.gold, fontSize: 15 }}>● Capture</button>
              <button type="button" onClick={stopCam} style={btn}>Cancel</button>
            </div>
            <div style={{ fontSize: 12, color: PX.sub, marginTop: 6 }}>Hold the page flat and steady with good light, filling the frame with the figure.</div>
          </div>
        )}

        {src && (
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button type="button" style={btn} onClick={() => { setRot(r => (r + 3) % 4); setCrop(null) }} aria-label="Rotate left">⟲</button>
              <button type="button" style={btn} onClick={() => { setRot(r => (r + 1) % 4); setCrop(null) }} aria-label="Rotate right">⟳</button>
              {[['orig', 'Original'], ['clean', '✨ Clean'], ['bw', '◐ Black & white']].map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} style={on(mode === k)} onClick={() => setMode(k)}>{l}</button>)}
              <button type="button" style={btn} onClick={autoTrim}>✂️ Auto-trim</button>
              {crop && <button type="button" style={btn} onClick={() => setCrop(null)}>Reset crop</button>}
            </div>
            <div style={{ fontSize: 12, color: PX.sub, marginBottom: 6 }}>Drag on the picture to crop. “Clean” whitens the paper and darkens the lines; “Black &amp; white” is best for line diagrams.</div>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', touchAction: 'none', cursor: 'crosshair', background: '#e9e5da', borderRadius: 8, lineHeight: 0 }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <canvas ref={view} style={{ maxWidth: '100%', display: 'block', borderRadius: 8 }} />
              {crop && (
                <div style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: '2px solid #b8923a', background: 'rgba(184,146,58,.12)', boxShadow: '0 0 0 9999px rgba(0,0,0,.35)', pointerEvents: 'none' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setSrc(null); setCrop(null) }} style={btn}>↺ Retake / choose another</button>
              <button type="button" onClick={use} style={{ ...btn, marginLeft: 'auto', background: PX.gold, color: '#fff', borderColor: PX.gold }}>Use this figure</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

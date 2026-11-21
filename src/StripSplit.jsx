// "Strip → question + 4 options". The setter uploads one picture the way model papers are drawn (question figure,
// a divider, four option figures, printed (A)–(D) captions). We find the divider and the caption band, let the setter
// nudge them, and hand back one question picture plus four option pictures. The (A)–(D) labels are then printed as real
// text by the paper, so they line up and the options can be shuffled.
import { useEffect, useMemo, useRef, useState } from 'react'
import { PX } from './premiumUI'
import { planSplit } from './lib/stripSplit'
import { WORD_PICTURE, WORD_PICTURE_HELP } from './lib/figImage'

const MAX_W = 2400
const LABELS = ['A', 'B', 'C', 'D']

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (WORD_PICTURE.test(file.name || '')) return reject(new Error(WORD_PICTURE_HELP))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ img, url }) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a picture we can read.')) }
    img.src = url
  })
}

// box is in the original picture's pixels; the result is shrunk to at most maxW wide.
function crop(img, box, maxW, quality) {
  const sw = box.x1 - box.x0, sh = box.y1 - box.y0
  const k = Math.min(1, maxW / sw)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k))
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, box.x0, box.y0, sw, sh, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}
// working-pixel box (the analysis is done on a possibly smaller copy) → original pixels
const toOriginal = (b, scale) => ({ x0: b.x0 / scale, x1: b.x1 / scale, y0: b.y0 / scale, y1: b.y1 / scale })

// Split a picture with no questions asked: detected divider and captions, four equal-size option pictures.
// Used when a whole section of strip pictures is added in one go.
export async function splitFileAuto(file) {
  const { img, url } = await loadImage(file)
  try {
    const scale = Math.min(1, MAX_W / img.naturalWidth)
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h)
    const px = g.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) lum[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000
    const plan = planSplit(lum, w, h)
    return {
      image: plan.question ? crop(img, toOriginal(plan.question, scale), 640, 0.82) : '',
      options: plan.options.map(b => crop(img, toOriginal(b, scale), 260, 0.74)),
      checked: plan.detected.divider && plan.detected.caption && plan.detected.frames,   // everything was found without guessing
    }
  } finally { URL.revokeObjectURL(url) }
}

export default function StripSplit({ file, onDone, onClose }) {
  const [state, setState] = useState({ phase: 'loading' })   // loading | ready | error
  const [divider, setDivider] = useState(null)               // x in work pixels, null = detected
  const [cut, setCut] = useState(null)                       // y in work pixels, null = detected
  const raw = useRef(null)                                   // { img, scale, w, h, lum }

  useEffect(() => {
    let dead = false
    loadImage(file).then(({ img, url }) => {
      const scale = Math.min(1, MAX_W / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h)
      const px = g.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) lum[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000
      raw.current = { img, url, scale, w, h, lum }
      if (!dead) setState({ phase: 'ready' })
    }).catch(e => { if (!dead) setState({ phase: 'error', msg: e.message }) })
    return () => { dead = true; if (raw.current?.url) URL.revokeObjectURL(raw.current.url) }
  }, [file])

  const plan = useMemo(() => {
    if (state.phase !== 'ready') return null
    const { lum, w, h } = raw.current
    return planSplit(lum, w, h, { dividerX: divider, cutY: cut })
  }, [state.phase, divider, cut])

  // small previews of the five pieces
  const previews = useMemo(() => {
    if (!plan) return null
    const { img, scale } = raw.current
    try { return { q: plan.question ? crop(img, toOriginal(plan.question, scale), 360, 0.7) : null, o: plan.options.map(b => crop(img, toOriginal(b, scale), 160, 0.7)) } } catch { return null }
  }, [plan])

  const apply = () => {
    const { img, scale } = raw.current
    const q = plan.question ? crop(img, toOriginal(plan.question, scale), 640, 0.82) : ''
    const opts = plan.options.map(b => crop(img, toOriginal(b, scale), 260, 0.74))
    onDone({ image: q, options: opts })
  }

  const { w, h } = raw.current || { w: 1, h: 1 }
  const pct = (v, total) => Math.round((v / total) * 100)
  const slider = { width: '100%' }
  return (
    <div role="dialog" aria-label="Split a strip picture" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,27,46,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(640px,100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <b style={{ fontSize: 16, flex: 1 }}>✂ Split strip → question + 4 options</b>
          <button type="button" className="px-btn ghost" onClick={onClose}>Close</button>
        </div>
        {state.phase === 'loading' && <div style={{ padding: 20, color: PX.sub }}>Reading the picture…</div>}
        {state.phase === 'error' && <div role="alert" style={{ padding: 12, color: PX.bad, fontWeight: 700 }}>{state.msg}</div>}
        {state.phase === 'ready' && plan && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 12.5, color: PX.sub, lineHeight: 1.5 }}>
              We looked for the line between the question and the options{plan.detected.divider ? ' (found)' : ' (not found — set it below)'} and for the printed (A)–(D) captions under the options{plan.detected.caption ? ' (found and removed)' : ' (none found)'}. The A–D labels are printed as text by the paper.
            </p>
            {previews?.q && (
              <div style={{ border: `1px solid ${PX.line}`, borderRadius: 12, padding: 8, marginBottom: 8, background: '#fafafa' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub, marginBottom: 4 }}>Question figure</div>
                <img src={previews.q} alt="Question figure" style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto' }} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, marginBottom: 12 }}>
              {(previews?.o || []).map((u, i) => (
                <div key={i} style={{ border: `1px solid ${PX.line}`, borderRadius: 10, padding: 6, textAlign: 'center', background: '#fafafa' }}>
                  <img src={u} alt={`Option ${LABELS[i]}`} style={{ maxWidth: '100%', maxHeight: 90, display: 'block', margin: '0 auto 4px' }} />
                  <b style={{ fontSize: 13 }}>({LABELS[i]})</b>
                </div>
              ))}
            </div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
              Line between question and options · {pct(plan.divider, w)}% across
              <input type="range" min={5} max={90} step={1} value={pct(plan.divider, w)} onChange={e => setDivider(Math.round((+e.target.value / 100) * w))} style={slider} />
            </label>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>
              Cut off the printed captions below · {pct(plan.cut, h)}% down {plan.cut >= h ? '(nothing removed)' : ''}
              <input type="range" min={30} max={100} step={1} value={pct(plan.cut, h)} onChange={e => setCut(Math.round((+e.target.value / 100) * h))} style={slider} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="px-btn gold" style={{ flex: 1, minHeight: 46 }} onClick={apply}>Use these 5 pictures</button>
              <button type="button" className="px-btn ghost" onClick={() => { setDivider(null); setCut(null) }}>Reset</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Chart maker for exam figures (bar graph, line graph, pie chart). The setter types the numbers and the labels —
// in English or in Meetei Mayek (the Bmei04 keyboard types straight into the label fields) — and gets a clean picture
// to put under a Maths question. Nothing is stored except the finished picture (and, while the paper is a draft,
// the numbers, so the chart can be reopened and relabelled for another language).
import { useEffect, useMemo, useRef, useState } from 'react'
import { PX } from './premiumUI'
import { drawChart, cleanRows, CHART_FONT } from './lib/chartDraw'
import { useBmeiKeyboard } from './useBmeiKeyboard'
import { BmeiKeyboardToggle, BmeiKeyPad } from './BmeiKeyboard'

const W = 640, H = 380, CAP = 350000
export const blankChart = () => ({ type: 'bar', title: '', xLabel: '', yLabel: '', values: true, percent: false, rows: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }] })
const KINDS = [['bar', '📊 Bar graph'], ['line', '📈 Line graph'], ['pie', '🥧 Pie chart']]

// The Meetei Mayek font loads only when a page shows its letters, so ask for it before we draw them onto a picture.
async function ready(spec) {
  const sample = [spec.title, spec.xLabel, spec.yLabel, ...(spec.rows || []).map(r => r.label)].join(' ')
  if (/[\uAAE0-\uAAFF\uABC0-\uABFF]/.test(sample) && document.fonts?.load) { try { await document.fonts.load(`600 14px ${CHART_FONT}`, sample) } catch { /* draw with the fallback font */ } }
}

export default function ChartMaker({ initial, onDone, onClose }) {
  const [spec, setSpec] = useState(() => ({ ...blankChart(), ...(initial || {}), rows: (initial?.rows?.length ? initial.rows : blankChart().rows).map(r => ({ ...r })) }))
  const [err, setErr] = useState('')
  const cv = useRef(null)
  const { areaRef, kb } = useBmeiKeyboard()
  const rows = useMemo(() => cleanRows(spec.rows), [spec.rows])
  const set = patch => setSpec(s => ({ ...s, ...patch }))
  const setRow = (i, patch) => setSpec(s => ({ ...s, rows: s.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) }))

  useEffect(() => {
    let dead = false
    ;(async () => {
      await ready(spec)
      if (dead || !cv.current) return
      drawChart(cv.current.getContext('2d'), spec, W, H)
    })()
    return () => { dead = true }
  }, [spec])

  const apply = async () => {
    if (rows.length < 2) return setErr('Add at least two rows with a name and a number.')
    await ready(spec)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    drawChart(c.getContext('2d'), spec, W, H)
    const url = c.toDataURL('image/jpeg', 0.85)
    if (url.length > CAP) return setErr('The picture is too large — use fewer rows.')
    onDone({ image: url, spec })
  }

  const lab = { display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 700 }
  const inp = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 10, padding: '9px 10px', fontSize: 16, fontFamily: 'inherit' }
  return (
    <div role="dialog" aria-label="Chart maker" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,27,46,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={areaRef} onClick={e => e.stopPropagation()} style={{ width: 'min(680px,100%)', maxHeight: '94vh', overflow: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 16, flex: 1 }}>📊 Chart maker</b>
          <button type="button" className="px-btn ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={spec.type === k} onClick={() => set({ type: k })} style={{ padding: '7px 13px', borderRadius: 99, border: `1.5px solid ${spec.type === k ? PX.navy : PX.line}`, background: spec.type === k ? '#e4ebf6' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
        </div>
        <div style={{ border: `1px solid ${PX.line}`, borderRadius: 12, background: '#fff', padding: 6, marginBottom: 10 }}>
          <canvas ref={cv} width={W} height={H} aria-label="Chart preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <BmeiKeyboardToggle kb={kb} />
          <span style={{ fontSize: 12, color: PX.sub }}>Type the names in Meetei Mayek with the Bmei keys, or in English.</span>
        </div>
        <BmeiKeyPad kb={kb} />
        <div style={{ display: 'grid', gap: 10, margin: '10px 0' }}>
          <label style={lab}>Title (optional)<input data-bmei style={inp} value={spec.title} onChange={e => set({ title: e.target.value })} aria-label="Chart title" /></label>
          {spec.type !== 'pie' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              <label style={lab}>Bottom label<input data-bmei style={inp} value={spec.xLabel} onChange={e => set({ xLabel: e.target.value })} aria-label="Bottom label" placeholder="e.g. MONTH" /></label>
              <label style={lab}>Side label<input data-bmei style={inp} value={spec.yLabel} onChange={e => set({ yLabel: e.target.value })} aria-label="Side label" placeholder="e.g. Rainfall (mm)" /></label>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub, marginBottom: 4 }}>{spec.type === 'pie' ? 'Parts' : 'Bars / points'}</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {spec.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input data-bmei style={{ ...inp, flex: '1 1 55%' }} value={r.label} onChange={e => setRow(i, { label: e.target.value })} aria-label={`Name ${i + 1}`} placeholder={`Name ${i + 1}`} />
              <input style={{ ...inp, flex: '1 1 30%' }} inputMode="decimal" value={r.value} onChange={e => setRow(i, { value: e.target.value })} aria-label={`Number ${i + 1}`} placeholder="Number" />
              <button type="button" aria-label={`Remove row ${i + 1}`} className="px-btn ghost" onClick={() => setSpec(s => ({ ...s, rows: s.rows.length > 1 ? s.rows.filter((_, k) => k !== i) : s.rows }))}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
          <button type="button" className="px-btn ghost" onClick={() => setSpec(s => ({ ...s, rows: [...s.rows, { label: '', value: '' }] }))}>＋ Add row</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={!!spec.values} onChange={e => set({ values: e.target.checked })} /> Show the numbers on the chart</label>
          {spec.type === 'pie' && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={!!spec.percent} onChange={e => set({ percent: e.target.checked })} /> as percentages</label>}
        </div>
        {err && <div role="alert" style={{ padding: '8px 12px', borderRadius: 10, background: '#fdecea', color: PX.bad, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button type="button" className="px-btn gold" style={{ width: '100%', minHeight: 48 }} onClick={apply}>Use this chart</button>
      </div>
    </div>
  )
}

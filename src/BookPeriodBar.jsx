// BookPeriodBar.jsx — the date-range picker shared by the day books:
// preset chips (Today … Last month), prev/next stepping and from/to dates.
import { presetRange, shiftDay, localISO } from './feeBooks'

const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month']]
const spanDays = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1

export function BookPeriodBar({ preset, from, to, onChange, label = 'Period', children }) {
  const today = localISO(new Date())
  const set = (p, f, t) => onChange({ preset: p, from: f <= t ? f : t, to: f <= t ? t : f })
  const step = n => { const k = spanDays(from, to) * n; set('custom', shiftDay(from, k), shiftDay(to, k)) }
  return (
    <>
      <div className="fbk-bar" role="group" aria-label={`${label} presets`}>
        {PRESETS.map(([k, l]) => <button key={k} className={`fbk-chip${preset === k ? ' on' : ''}`} onClick={() => { const [f, t] = presetRange(k); set(k, f, t) }}>{l}</button>)}
      </div>
      <div className="fbk-bar" style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <button className="fbk-chip" aria-label="Previous period" onClick={() => step(-1)}>‹</button>
        <label className="fbk-lbl">From<input type="date" className="fbk-in" aria-label={`${label} from`} value={from} onChange={e => e.target.value && set('custom', e.target.value, to)} /></label>
        <label className="fbk-lbl">To<input type="date" className="fbk-in" aria-label={`${label} to`} value={to} onChange={e => e.target.value && set('custom', from, e.target.value)} /></label>
        <button className="fbk-chip" aria-label="Next period" onClick={() => step(1)} disabled={to >= today}>›</button>
        {children}
      </div>
    </>
  )
}

export function Bars({ title, pairs, total, tone }) {
  return (
    <div className="fbk-card fbk-bars" style={{ margin: 0 }}>
      <h4>{title}</h4>
      {pairs.length === 0 ? <p className="muted">—</p> : pairs.map(([k, v]) => (
        <p key={k}><span><span>{k}</span><b className="num">₹{v.toLocaleString('en-IN')}</b></span><i><em style={{ width: `${total ? (v / total) * 100 : 0}%`, ...(tone ? { background: tone } : {}) }} /></i></p>
      ))}
    </div>
  )
}

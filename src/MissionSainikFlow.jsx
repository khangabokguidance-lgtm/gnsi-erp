// MissionSainikFlow.jsx — the guided "mission flow": a step tracker for Home and a Back / Next bar for every screen in the flow.
import { FLOW, flowStatus, flowNeighbors } from './lib/missionSainikFlow'
import { PX } from './premiumUI'

const CSS = `
.msf-track{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
.msf-step{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:11px 12px 10px;border-radius:16px;border:1.5px solid #e8e2d2;background:#fff;text-align:left;cursor:pointer;font-family:inherit;transition:transform .12s,box-shadow .15s,border-color .15s}
.msf-step:hover{transform:translateY(-1px);box-shadow:0 8px 18px -12px rgba(19,42,79,.45)}
.msf-step.now{border-color:#b8923a;background:#fff9e8;box-shadow:0 0 0 3px rgba(184,146,58,.16)}
.msf-step.done{background:#f3fbf6;border-color:#bfe3cc}
.msf-n{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:#eef2f9;color:#132a4f}
.msf-step.now .msf-n{background:#b8923a;color:#fff}.msf-step.done .msf-n{background:#0f7a4c;color:#fff}
.msf-step b{font-size:13.5px;color:#0f1b2e;line-height:1.2}
.msf-step small{font-size:11.5px;color:#5d6b82;font-weight:600}
.msf-step .bar{height:5px;border-radius:3px;background:#eef1f6;width:100%;overflow:hidden;margin-top:2px}.msf-step .bar i{display:block;height:100%;background:linear-gradient(90deg,#b8923a,#0f7a4c)}
.msf-nav{display:flex;align-items:stretch;gap:10px;margin:18px 0 6px;flex-wrap:wrap}
.msf-nav button{flex:1 1 200px;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;border:1.5px solid #e1dac8;background:#fff;font-family:inherit;cursor:pointer;text-align:left;transition:transform .12s,box-shadow .15s}
.msf-nav button:hover{transform:translateY(-1px);box-shadow:0 8px 18px -12px rgba(19,42,79,.5)}
.msf-nav button.go{background:linear-gradient(135deg,#132a4f,#1e3a6e);border-color:#132a4f;color:#fff;justify-content:flex-end;text-align:right}
.msf-nav small{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.msf-nav b{display:block;font-size:14.5px}
.msf-nav .ar{font-size:22px;font-weight:800;color:#b8923a}.msf-nav .go .ar{color:#e9d9b0}
.msf-where{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:12.5px;font-weight:700;color:#5d6b82}
.msf-where .dots{display:flex;gap:4px}.msf-where .dots i{width:18px;height:5px;border-radius:3px;background:#e3dcc8}.msf-where .dots i.on{background:#b8923a}.msf-where .dots i.dn{background:#0f7a4c}
@media print{.msf-nav,.msf-where{display:none}}
`

// Home: the whole flow at a glance. progress = { plan:{done,total}, assign:{…}, set:{…}, marks:{…} }
export function FlowTracker({ progress, onGo, flow = FLOW, heading = 'MISSION FLOW · ONE STEP AT A TIME' }) {
  const steps = flowStatus(progress, flow)
  const now = steps.find(s => s.status === 'now')
  return (
    <div style={{ background: '#fff', borderRadius: 24, padding: 16, boxShadow: '0 2px 14px rgba(19,42,79,.08)', marginBottom: 12, animation: 'msx-in .35s ease both' }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: PX.sub }}>{heading}</div>
        {now && <button type="button" className="msx-tap" onClick={() => onGo(now.tab)} style={{ fontSize: 13, fontWeight: 800, color: PX.navy, background: '#fff6dc', borderRadius: 99, padding: '6px 14px' }}>You are here: {now.label} ›</button>}
      </div>
      <div className="msf-track" role="list">
        {steps.map(s => (
          <button key={s.id} type="button" role="listitem" className={'msf-step ' + s.status} onClick={() => onGo(s.tab)} title={s.hint}>
            <span className="msf-n">{s.status === 'done' ? '✓' : s.n}</span>
            <b>{s.icon} {s.label}</b>
            <small>{s.label2 || (s.status === 'now' ? 'Do this next' : s.hint)}</small>
            {s.pct !== null && <span className="bar"><i style={{ width: s.pct + '%' }} /></span>}
          </button>))}
      </div>
    </div>
  )
}

// Bottom of every screen in the flow: where you are, where you came from, where to go next.
export function FlowNav({ tab, onGo, progress, flow = FLOW, home = 'overview' }) {
  const [prev, cur, next] = flowNeighbors(tab, flow)
  if (!cur) return null
  const status = flowStatus(progress, flow)
  return (
    <>
      <style>{CSS}</style>
      <div className="msf-nav" aria-label="Mission flow">
        {prev ? <button type="button" onClick={() => onGo(prev.tab)}><span className="ar">‹</span><span><small>Before · step {flow.indexOf(prev) + 1}</small><b>{prev.icon} {prev.label}</b></span></button> : <span style={{ flex: '1 1 200px' }} />}
        {next ? <button type="button" className="go" onClick={() => onGo(next.tab)}><span><small>Next · step {flow.indexOf(next) + 1} of {flow.length}</small><b>{next.icon} {next.label}</b></span><span className="ar">›</span></button>
          : <button type="button" className="go" onClick={() => onGo(home)}><span><small>All steps done</small><b>🏠 Back to Home</b></span><span className="ar">›</span></button>}
      </div>
      <div className="msf-where" style={{ justifyContent: 'center' }}>
        <span className="dots" aria-hidden="true">{status.map((s, i) => <i key={s.id} className={i === flow.indexOf(cur) ? 'on' : s.status === 'done' ? 'dn' : ''} />)}</span>
        Step {flow.indexOf(cur) + 1} of {flow.length} · {cur.label}
      </div>
    </>
  )
}

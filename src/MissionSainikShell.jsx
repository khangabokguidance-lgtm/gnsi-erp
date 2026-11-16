// MissionSainikShell.jsx — Android-style app shell for the Mission Sainik module:
// top app bar, bottom navigation (phones) / navigation rail (desktop), an "All tabs" bottom sheet, snackbar, FAB and confetti.
import { useState, useEffect } from 'react'
import { NAV_GROUPS } from './lib/missionSainikNav'

const BOTTOM = [['overview', '🏠', 'Home'], ['mine', '✅', 'Tasks'], ['prebuilder', '🧱', 'Build'], ['insights', '💡', 'Insights']]

const CSS = `
.msx{--navy:#132a4f;--navy2:#1e3a6e;--gold:#b8923a;--goldlt:#e9d9b0;--bg:#f2f4f8;--card:#fff;--ink:#0f1b2e;--sub:#5d6b82;--ok:#0f7a4c;--bad:#b42318;
  font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;position:relative;-webkit-tap-highlight-color:transparent}
.msx *{box-sizing:border-box}
.msx button{font-family:inherit}
.msx-tap{cursor:pointer;border:0;background:none;position:relative;overflow:hidden;transition:transform .12s,background .15s}
.msx-tap:active{transform:scale(.96)}
.msx-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:6px;height:60px;padding:0 8px 0 6px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;box-shadow:0 4px 18px rgba(14,32,63,.35)}
.msx-top h1{flex:1;margin:0;font-size:19px;font-weight:700;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx-top h1 small{display:block;font-size:11px;font-weight:600;color:var(--goldlt);letter-spacing:.12em;text-transform:uppercase}
.msx-ic{width:44px;height:44px;border-radius:50%;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center}
.msx-ic:hover{background:rgba(255,255,255,.12)}
.msx-body{display:flex;max-width:1280px;margin:0 auto}
.msx-rail{display:none;width:230px;flex:none;padding:14px 10px 40px;position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto}
.msx-rail h4{margin:14px 10px 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.msx-ri{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:999px;font-size:14px;font-weight:600;color:var(--ink);text-align:left}
.msx-ri:hover{background:#e6ebf4}.msx-ri.on{background:var(--goldlt);color:var(--navy)}
.msx-main{flex:1;min-width:0;padding:14px 12px 120px;animation:msx-in .28s ease both}
.msx-main .px-card{border-radius:22px;border:1px solid #ece6d6;box-shadow:0 4px 22px rgba(19,42,79,.07);overflow:hidden}
/* Premium data tables */
.msx-main .px-table{border-collapse:separate;border-spacing:0}
.msx-main .px-table th{background:linear-gradient(180deg,#fbf7ea,#f3ebd5);color:#6b5a2a;border-bottom:2px solid #e0b95a;padding:14px 16px;font-size:10.5px;letter-spacing:.12em}
.msx-main .px-table td{padding:14px 16px;border-bottom:1px solid #f1ece0;font-variant-numeric:tabular-nums;transition:background .15s;white-space:nowrap}
.msx-main .px-table tbody tr:nth-child(even) td{background:#fdfbf6}
.msx-main .px-table tbody tr:hover td{background:#f9f1da}
.msx-main .px-table tbody tr:last-child td{border-bottom:0}
.msx-main .px-table td:first-child{font-weight:800;color:var(--navy)}
.msx-main .px-table td.msx-click{cursor:pointer}
.msx-main .px-table td.msx-click:hover{background:#f5e9c4!important;box-shadow:inset 0 0 0 2px #e0b95a;border-radius:6px}
.msx-main .px-table input.px-input{height:36px;padding:0 11px;border-radius:11px;font-size:12.5px;background:#fff;border:1px solid #e6dfcc;transition:border-color .15s,box-shadow .15s}
.msx-main .px-table input.px-input:focus{outline:0;border-color:#b8923a;box-shadow:0 0 0 3px rgba(184,146,58,.22)}
.msx-main .px-table input.px-input::placeholder{color:#b3ab98}
/* The module's inner screens were designed for a dark hero; on light cards their .px-hbtn buttons need a light skin. */
.msx-main .px-hbtn{background:#fff;color:var(--navy);border:1px solid #d9d2c2;height:38px;box-shadow:0 1px 2px rgba(19,42,79,.08)}
.msx-main .px-hbtn:hover{background:#f6efdc;transform:none}
.msx-main select,.msx-main input[type=file]{background:#fff;color:var(--ink)}
.msx-main input[type=file]{padding:8px!important}
.msx-main .px-table td:first-child,.msx-main .px-table th:first-child{white-space:nowrap}
.msx-bottom{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;background:#fff;border-top:1px solid #e3e7ef;padding:8px 6px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(14,32,63,.10)}
.msx-bi{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;font-weight:600;color:var(--sub);padding:2px 0}
.msx-pill{position:relative;width:62px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:20px;transition:background .2s,transform .2s}
.msx-bi.on{color:var(--navy);font-weight:800}.msx-bi.on .msx-pill{background:var(--goldlt);transform:scale(1.05)}
.msx-badge{position:absolute;top:-3px;right:6px;min-width:17px;height:17px;border-radius:9px;background:var(--bad);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}
.msx-fab{position:fixed;right:16px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:35;display:flex;align-items:center;gap:8px;height:56px;padding:0 20px;border-radius:18px;background:var(--gold);color:#fff;font-weight:800;font-size:14px;box-shadow:0 10px 24px rgba(184,146,58,.55)}
.msx-scrim{position:fixed;inset:0;z-index:50;background:rgba(10,20,40,.5);animation:msx-fade .2s both}
.msx-sheet{position:fixed;left:0;right:0;bottom:0;z-index:51;max-height:86vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:10px 16px calc(24px + env(safe-area-inset-bottom));animation:msx-up .28s cubic-bezier(.2,.9,.3,1) both;box-shadow:0 -12px 40px rgba(0,0,0,.25)}
.msx-sheet .grab{width:42px;height:5px;border-radius:3px;background:#cfd6e4;margin:2px auto 12px}
.msx-sheet h4{margin:14px 4px 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.msx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.msx-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 2px;border-radius:18px;font-size:11.5px;font-weight:700;color:var(--ink);text-align:center}
.msx-tile span{width:52px;height:52px;border-radius:18px;background:#eef2f9;display:flex;align-items:center;justify-content:center;font-size:25px}
.msx-tile.on span{background:var(--goldlt);box-shadow:0 0 0 2px var(--gold)}
.msx-snack{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:60;margin:0 auto;max-width:520px;padding:13px 16px;border-radius:14px;font-size:13.5px;font-weight:600;color:#fff;background:#243049;box-shadow:0 8px 24px rgba(0,0,0,.3);animation:msx-up .25s both}
.msx-snack.bad{background:#8f1d14}.msx-snack.ok{background:#14633f}
.msx-confetti{position:fixed;inset:0;z-index:70;pointer-events:none;overflow:hidden}
.msx-confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:msx-fall 1.7s ease-in forwards}
.msx-overlay{align-items:flex-end!important}
.msx-dialog{border-radius:26px 26px 0 0!important;width:100%!important;max-width:560px!important;animation:msx-up .28s cubic-bezier(.2,.9,.3,1) both}
@media (max-width:700px){
  /* Wide data tables become stacked cards on phones (labels come from each column's heading, set in the Shell effect). */
  .msx-main table.px-table,.msx-main table.px-table tbody{display:block;width:100%;min-width:0!important}
  .msx-main .px-table thead{display:none}
  .msx-main .px-table tr{display:block;margin:10px;padding:6px 14px;border:1px solid #e8e3d8;border-radius:18px;background:#fff;box-shadow:0 1px 6px rgba(19,42,79,.06)}
  .msx-main .px-table td{display:flex;justify-content:space-between;align-items:center;gap:14px;border:0!important;padding:7px 0!important;text-align:right;position:static!important;background:transparent!important;white-space:normal!important}
  .msx-main .px-table td::before{content:attr(data-label);flex:none;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);text-align:left}
  .msx-main .px-table td:first-child{justify-content:flex-start;font-size:15.5px;font-weight:800;padding-bottom:9px!important;margin-bottom:3px;border-bottom:1px solid #eef1f6!important}
  .msx-main .px-table td:first-child::before,.msx-main .px-table td[data-label=""]::before{display:none}
  .msx-main .px-table td:empty{display:none}
  /* card headers: title first, action buttons on their own row */
  .msx-main .px-card-h{flex-wrap:wrap}
  .msx-main .px-card-h>div:first-of-type{flex:1 1 calc(100% - 28px)!important}
  .msx-main .px-card-h>*:not(.bar):not(div:first-of-type){margin-left:14px}
}
@keyframes msx-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes msx-up{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
@keyframes msx-fade{from{opacity:0}to{opacity:1}}
@keyframes msx-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}
@keyframes msx-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@media (min-width:900px){.msx-rail{display:block}.msx-bottom{display:none}.msx-fab{bottom:24px}.msx-snack{bottom:24px}.msx-main{padding:22px 24px 60px}.msx-overlay{align-items:center!important}.msx-dialog{border-radius:22px!important}}
@media (prefers-reduced-motion:reduce){.msx *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`

export function Confetti({ show }) {
  if (!show) return null
  const colors = ['#b8923a', '#132a4f', '#0f7a4c', '#e9d9b0', '#1d4ed8', '#c2410c']
  return (
    <div className="msx-confetti" aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => (
        <i key={i} style={{ left: ((i * 37) % 100) + '%', background: colors[i % colors.length], animationDelay: (i % 9) * 0.07 + 's', transform: `rotate(${i * 25}deg)` }} />
      ))}
    </div>
  )
}

export default function MissionSainikShell({ active, onChange, title, subtitle, onBack, actions = [], badges = {}, isAdmin, fab, msg, confetti, children }) {
  const [sheet, setSheet] = useState(false)
  useEffect(() => { if (sheet) { const k = e => e.key === 'Escape' && setSheet(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) } }, [sheet])
  // Label every table cell with its column heading so the phone card layout can show it.
  useEffect(() => {
    document.querySelectorAll('.msx-main table.px-table').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim())
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { td.dataset.label = heads[i] || '' }))
    })
  })
  const go = id => { try { navigator.vibrate?.(8) } catch { /* not supported */ } setSheet(false); onChange(id); window.scrollTo?.({ top: 0 }) }
  const groups = NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i[0] !== 'admin' || isAdmin) }))
  const inBottom = BOTTOM.some(b => b[0] === active)
  const bad = msg && msg.startsWith('❌')
  return (
    <div className="msx">
      <style>{CSS}</style>
      <header className="msx-top">
        {onBack ? <button className="msx-tap msx-ic" aria-label="Back to Home" onClick={onBack}>←</button> : <span className="msx-ic" aria-hidden="true">🎖️</span>}
        <h1><small>{subtitle}</small>{title}</h1>
        {actions.map(a => <button key={a.label} className="msx-tap msx-ic" aria-label={a.label} title={a.label} onClick={a.onClick}>{a.icon}</button>)}
      </header>
      <div className="msx-body">
        <nav className="msx-rail" aria-label="Mission Sainik sections">
          {groups.map(g => (
            <div key={g.title}><h4>{g.title}</h4>
              {g.items.map(([id, ic, label]) => (
                <button key={id} className={'msx-tap msx-ri' + (active === id ? ' on' : '')} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)}>
                  <span style={{ fontSize: 19 }}>{ic}</span>{label}{badges[id] ? <span className="msx-badge" style={{ position: 'static', marginLeft: 'auto' }}>{badges[id]}</span> : null}
                </button>))}
            </div>))}
        </nav>
        <main className="msx-main" key={active}>{children}</main>
      </div>
      <nav className="msx-bottom" aria-label="Primary">
        {BOTTOM.map(([id, ic, label]) => (
          <button key={id} className={'msx-tap msx-bi' + (active === id ? ' on' : '')} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)}>
            <span className="msx-pill">{ic}{badges[id] ? <span className="msx-badge">{badges[id]}</span> : null}</span>{label}
          </button>))}
        <button className={'msx-tap msx-bi' + (!inBottom ? ' on' : '')} aria-haspopup="dialog" onClick={() => setSheet(true)}>
          <span className="msx-pill">⠿</span>More
        </button>
      </nav>
      {fab && <button className="msx-tap msx-fab" onClick={fab.onClick}><span style={{ fontSize: 20 }}>{fab.icon}</span>{fab.label}</button>}
      {sheet && (
        <>
          <div className="msx-scrim" onClick={() => setSheet(false)} />
          <div className="msx-sheet" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="grab" />
            {groups.map(g => (
              <div key={g.title}><h4>{g.title}</h4>
                <div className="msx-grid">
                  {g.items.map(([id, ic, label]) => (
                    <button key={id} className={'msx-tap msx-tile' + (active === id ? ' on' : '')} onClick={() => go(id)}><span>{ic}</span>{label}</button>))}
                </div>
              </div>))}
          </div>
        </>
      )}
      {msg && <div role="status" className={'msx-snack ' + (bad ? 'bad' : 'ok')}>{msg}</div>}
      <Confetti show={confetti} />
    </div>
  )
}

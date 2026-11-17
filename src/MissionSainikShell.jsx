// MissionSainikShell.jsx — Android-style app shell for the Mission Sainik module:
// top app bar, bottom navigation (phones) / navigation rail (desktop), an "All tabs" bottom sheet, snackbar, FAB and confetti.
import { useState, useEffect, useRef, useMemo } from 'react'
import { NAV_GROUPS } from './lib/missionSainikNav'

const BOTTOM = [['overview', '🏠', 'Home'], ['mine', '✅', 'Tasks'], ['prebuilder', '🧱', 'Build'], ['insights', '💡', 'Insights']]

// What each section is for — shown in search results and used as search keywords.
const HINTS = {
  overview: 'Dashboard, countdown, what needs attention', schedule: 'Test dates and deadlines calendar', mock: 'Mock series list and results', allotment: 'Who sets which paper',
  syllabus: 'Chapter plan for each test', panel: 'Teachers, setters, verifiers', mine: 'My assigned tasks, submit and verify', practice: 'Practice sets and questions',
  material: 'Notes, PDFs, links for students', prebuilder: 'Build Pre Mock test papers, upload questions', megabuilder: 'Build Mega Mock papers', dailybuilder: 'Build Daily class tests',
  practicebuilder: 'Build practice sets (25 per subject)', marks: 'Enter and import test marks', premock: 'Analyse Pre Mock results', megamock: 'Analyse Mega Mock results',
  activity: 'Teacher upload and task activity', insights: 'Weak chapters, trends, tips', guide: 'Step-by-step help for every screen', admin: 'Locks, approvals, backup, audit log',
}
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
}

const CSS = `
/* ── Comfort baseline: calmer surfaces, easier-to-read text, friendlier controls ── */
.msx{--bg:#f4f6fa;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
.msx ::selection{background:rgba(184,146,58,.28)}
.msx-main{font-size:15px;line-height:1.5}
.msx-main .px-card{margin-bottom:16px;border-radius:20px;border-color:#ebe6da;box-shadow:0 1px 2px rgba(19,42,79,.04),0 10px 28px -20px rgba(19,42,79,.28)}
.msx-main .px-card-h{padding:16px 20px}.msx-main .px-card-t{font-size:17px;letter-spacing:.005em}.msx-main .px-card-s{font-size:13px;line-height:1.45;color:#56647c}
.msx-main .px-input,.msx-main select,.msx-main textarea{font-size:15px;padding:11px 14px;border-radius:12px;border:1.5px solid #ddd6c6;background:#fff;transition:border-color .15s,box-shadow .15s}
.msx-main .px-input:hover,.msx-main select:hover,.msx-main textarea:hover{border-color:#cbbf9f}
.msx-main .px-input:focus,.msx-main select:focus,.msx-main textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px rgba(184,146,58,.18)}
.msx-main ::placeholder{color:#7c869a;opacity:1}
.msx-main input[type=checkbox],.msx-main input[type=radio]{width:19px;height:19px;accent-color:var(--navy);cursor:pointer}
.msx-main .px-btn,.msx-main .px-hbtn{min-height:42px;font-size:14px;border-radius:12px;transition:transform .12s,box-shadow .15s,background .15s,filter .15s}
.msx-main .px-btn:hover:not(:disabled){filter:brightness(1.06);box-shadow:0 6px 16px -8px rgba(19,42,79,.5)}.msx-main .px-btn:active:not(:disabled),.msx-main .px-hbtn:active{transform:scale(.97)}
.msx-main .px-btn:disabled{opacity:.5;cursor:not-allowed}
.msx-main .px-table th{font-size:11.5px;letter-spacing:.07em;padding:13px 16px}.msx-main .px-table td{font-size:14.5px}
.msx-main .px-table tbody tr{transition:background .12s}.msx-main .px-table tbody tr:hover{background:#faf6ea}
.msx-main .px-tabs{gap:4px}.msx-main .px-tab{font-size:14px;padding:9px 15px;border-radius:11px;transition:background .15s,color .15s}
.msx-main button:disabled{cursor:not-allowed}
.msx-main *{scrollbar-width:thin;scrollbar-color:#cfd6e4 transparent}
.msx-main details>summary{cursor:pointer;padding:6px 0}
.msx-snack{font-size:14.5px;line-height:1.4;border-radius:16px}.msx-snack.ok{background:#14532d}.msx-snack.bad{background:#7f1d1d}
.msx-ri{font-size:14.5px;padding:11px 14px}.msx-ri.on{box-shadow:inset 3px 0 0 var(--gold)}
@media (max-width:700px){.msx-main{padding:12px 10px 128px}.msx-main .px-card-h{padding:14px 16px}.msx-bi{font-size:12px}}
.msx-disp{position:fixed;top:64px;right:10px;z-index:80;width:min(320px,calc(100vw - 20px));background:#fff;border-radius:20px;padding:16px;box-shadow:0 16px 48px rgba(10,20,40,.35);animation:msx-up .2s both;color:var(--ink)}
.msx-disp h3{margin:0 0 2px;font-size:16px}.msx-disp p{margin:0 0 10px;font-size:12px;color:var(--sub)}.msx-disp h5{margin:12px 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--sub)}
.msx-seg{display:flex;gap:4px;background:#f1ede3;border-radius:12px;padding:3px}.msx-seg button{flex:1;padding:9px 4px;border-radius:9px;font-size:13px;font-weight:700;color:var(--sub);background:transparent}
.msx-seg button.on{background:#fff;color:var(--navy);box-shadow:0 1px 4px rgba(15,27,46,.18)}
.msx[data-size=lg] .msx-main,.msx[data-size=lg] .msx-rail{zoom:1.12}.msx[data-size=xl] .msx-main,.msx[data-size=xl] .msx-rail{zoom:1.26}
.msx[data-comfort=roomy] .msx-main .px-card,.msx[data-comfort=roomy] .msx-main .px-table td{line-height:1.6}.msx[data-comfort=roomy] .msx-main button,.msx[data-comfort=roomy] .msx-main input,.msx[data-comfort=roomy] .msx-main select{min-height:44px}
html.msx-warm{filter:sepia(.2) brightness(.97) saturate(.95)}
html.msx-dark{filter:invert(.9) hue-rotate(180deg);background:#fff}html.msx-dark img,html.msx-dark video,html.msx-dark iframe,html.msx-dark canvas{filter:invert(1) hue-rotate(180deg)}
@media print{html.msx-warm,html.msx-dark{filter:none!important}}
.msx-find{position:relative;margin:0 4px 6px}.msx-find input{width:100%;height:42px;border-radius:999px;border:1.5px solid #d9d2c2;background:#fff;padding:0 40px 0 38px;font:600 14px inherit;font-family:inherit;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.msx-find input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,58,.2)}.msx-find .ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;opacity:.6}
.msx-find kbd{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:700 11px inherit;font-family:inherit;color:var(--sub);border:1px solid #d9d2c2;border-radius:6px;padding:1px 6px;background:#faf8f3}
.msx-find .x{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;font-size:16px;color:var(--sub)}
.msx-res{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:14px;text-align:left;animation:msx-fade .15s both}.msx-res:hover,.msx-res.hi{background:#f6efdc}
.msx-res b{display:block;font-size:14px;color:var(--ink)}.msx-res small{display:block;font-size:12px;color:var(--sub);margin-top:1px}.msx-res .ic{font-size:22px;width:38px;height:38px;border-radius:12px;background:#eef2f9;display:flex;align-items:center;justify-content:center;flex:none}
.msx-pin{width:28px;height:28px;border-radius:50%;font-size:15px;color:#b8b2a2;flex:none;margin-left:auto}.msx-pin.on{color:var(--gold)}.msx-pin:hover{background:rgba(184,146,58,.15)}
.msx-ri .msx-pin{opacity:0;transition:opacity .15s}.msx-ri:hover .msx-pin,.msx-ri .msx-pin.on{opacity:1}
.msx-tile{position:relative}.msx-tile .msx-pin{position:absolute;top:2px;right:6px;width:24px;height:24px;font-size:13px;margin:0;opacity:.85}
.msx-sheet .msx-sticky{position:sticky;top:-10px;z-index:2;background:#fff;padding:2px 0 8px}
.msx button:focus-visible,.msx input:focus-visible{outline:2.5px solid var(--gold);outline-offset:2px}
.msx-ri{transition:background .15s,transform .12s,padding-left .15s}.msx-ri:hover{padding-left:18px}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
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
.msx-main{flex:1;min-width:0;padding:14px 12px 120px;animation:msx-in .28s ease backwards}
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
  const [q, setQ] = useState('')
  const [disp, setDisp] = useState(false)
  const [prefs, setPrefs] = useState(() => ({ size: 'md', theme: 'light', comfort: 'normal', ...store.get('msx-prefs', {}) }))
  const setPref = patch => setPrefs(p => { const n = { ...p, ...patch }; store.set('msx-prefs', n); return n })
  // Eye-comfort themes tint the whole page (so dialogs and previews follow); removed again when leaving the module.
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('msx-warm', prefs.theme === 'warm'); el.classList.toggle('msx-dark', prefs.theme === 'dark')
    return () => el.classList.remove('msx-warm', 'msx-dark')
  }, [prefs.theme])
  useEffect(() => { if (disp) { const k = e => e.key === 'Escape' && setDisp(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) } }, [disp])
  const [hi, setHi] = useState(0)
  const [pins, setPins] = useState(() => store.get('msx-pins', []))
  const [recent, setRecent] = useState(() => store.get('msx-recent', []))
  const railFind = useRef(null), sheetFind = useRef(null)
  const togglePin = id => setPins(p => { const n = p.includes(id) ? p.filter(x => x !== id) : [...p, id]; store.set('msx-pins', n); return n })
  // "/" or Ctrl+K jumps to search: the rail on desktop, the All-sections sheet on phones.
  useEffect(() => {
    const k = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        if (window.matchMedia('(min-width:900px)').matches) railFind.current?.focus(); else { setSheet(true); setTimeout(() => sheetFind.current?.focus(), 60) }
      }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => { if (sheet) { const k = e => e.key === 'Escape' && setSheet(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) } }, [sheet])
  // Label every table cell with its column heading so the phone card layout can show it.
  useEffect(() => {
    document.querySelectorAll('.msx-main table.px-table').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim())
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { td.dataset.label = heads[i] || '' }))
    })
  })
  const go = id => {
    try { navigator.vibrate?.(8) } catch { /* not supported */ }
    setSheet(false); setQ(''); onChange(id); window.scrollTo?.({ top: 0 })
    setRecent(r => { const n = [id, ...r.filter(x => x !== id)].slice(0, 5); store.set('msx-recent', n); return n })
  }
  const groups = NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i[0] !== 'admin' || isAdmin) }))
  const inBottom = BOTTOM.some(b => b[0] === active)
  const flat = useMemo(() => groups.flatMap(g => g.items.map(([id, ic, label]) => ({ id, ic, label, group: g.title, hint: HINTS[id] || '' }))), [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = Object.fromEntries(flat.map(x => [x.id, x]))
  const needle = q.trim().toLowerCase()
  const results = needle ? flat.filter(x => (x.label + ' ' + x.hint + ' ' + x.group).toLowerCase().includes(needle)) : []
  const pinned = pins.map(id => byId[id]).filter(Boolean)
  const recents = recent.filter(id => id !== active && !pins.includes(id)).map(id => byId[id]).filter(Boolean).slice(0, 4)
  const onFindKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(results.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && results[hi]) go(results[hi].id)
    else if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() }
  }
  const finder = (ref, placeholder) => (
    <div className="msx-find">
      <span className="ic" aria-hidden="true">🔍</span>
      <input ref={ref} type="search" value={q} onChange={e => { setQ(e.target.value); setHi(0) }} onKeyDown={onFindKey} placeholder={placeholder} aria-label="Find a section" enterKeyHint="go" />
      {q ? <button type="button" className="msx-tap x" aria-label="Clear search" onClick={() => setQ('')}>×</button> : <kbd aria-hidden="true">/</kbd>}
    </div>
  )
  const resultList = (
    <div role="listbox" aria-label="Search results">
      {results.length === 0 && <div style={{ padding: '14px 12px', fontSize: 13.5, color: 'var(--sub)' }}>No section matches “{q}”. Try “marks”, “paper”, “syllabus” or “teacher”.</div>}
      {results.map((x, i) => (
        <button key={x.id} type="button" role="option" aria-selected={i === hi} className={'msx-tap msx-res' + (i === hi ? ' hi' : '')} onClick={() => go(x.id)} onMouseEnter={() => setHi(i)}>
          <span className="ic">{x.ic}</span><span style={{ minWidth: 0 }}><b>{x.label}</b><small>{x.group} · {x.hint}</small></span>
        </button>))}
    </div>
  )
  const bad = msg && msg.startsWith('❌')
  return (
    <div className="msx" data-size={prefs.size} data-comfort={prefs.comfort}>
      <style>{CSS}</style>
      <header className="msx-top">
        {onBack ? <button className="msx-tap msx-ic" aria-label="Back to Home" onClick={onBack}>←</button> : <span className="msx-ic" aria-hidden="true">🎖️</span>}
        <h1><small>{subtitle}</small>{title}</h1>
        <button className="msx-tap msx-ic" aria-label="Display comfort: text size and theme" title="Display comfort" aria-expanded={disp} onClick={() => setDisp(v => !v)} style={{ fontSize: 15, fontWeight: 800 }}>Aa</button>
        <button className="msx-tap msx-ic" aria-label="Find a section" title="Find a section ( / )" onClick={() => { if (window.matchMedia('(min-width:900px)').matches) railFind.current?.focus(); else { setSheet(true); setTimeout(() => sheetFind.current?.focus(), 60) } }}>🔍</button>
        {actions.map(a => <button key={a.label} className="msx-tap msx-ic" aria-label={a.label} title={a.label} onClick={a.onClick}>{a.icon}</button>)}
      </header>
      <div className="msx-body">
        <nav className="msx-rail" aria-label="Mission Sainik sections">
          {finder(railFind, 'Find a section…')}
          {needle ? resultList : (
            <>
              {pinned.length > 0 && <div><h4>⭐ Pinned</h4>
                {pinned.map(x => (
                  <button key={x.id} className={'msx-tap msx-ri' + (active === x.id ? ' on' : '')} aria-current={active === x.id ? 'page' : undefined} onClick={() => go(x.id)}>
                    <span style={{ fontSize: 19 }}>{x.ic}</span>{x.label}<span role="button" tabIndex={0} aria-label={`Unpin ${x.label}`} className="msx-pin on" onClick={e => { e.stopPropagation(); togglePin(x.id) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(x.id) } }}>★</span>
                  </button>))}
              </div>}
              {groups.map(g => (
                <div key={g.title}><h4>{g.title}</h4>
                  {g.items.map(([id, ic, label]) => (
                    <button key={id} className={'msx-tap msx-ri' + (active === id ? ' on' : '')} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)}>
                      <span style={{ fontSize: 19 }}>{ic}</span>{label}{badges[id] ? <span className="msx-badge" style={{ position: 'static', marginLeft: 'auto' }}>{badges[id]}</span> : null}
                      <span role="button" tabIndex={0} aria-label={(pins.includes(id) ? 'Unpin ' : 'Pin ') + label} title={pins.includes(id) ? 'Unpin' : 'Pin to top'} className={'msx-pin' + (pins.includes(id) ? ' on' : '')} style={badges[id] ? { marginLeft: 6 } : undefined} onClick={e => { e.stopPropagation(); togglePin(id) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(id) } }}>{pins.includes(id) ? '★' : '☆'}</span>
                    </button>))}
                </div>))}
            </>
          )}
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
            <div className="msx-sticky">{finder(sheetFind, 'Find a section… e.g. marks, paper')}</div>
            {needle ? resultList : (
              <>
                {[['⭐ Pinned', pinned], ['🕘 Recent', recents]].filter(([, l]) => l.length).map(([t, list]) => (
                  <div key={t}><h4>{t}</h4>
                    <div className="msx-grid">{list.map(x => <button key={x.id} className={'msx-tap msx-tile' + (active === x.id ? ' on' : '')} onClick={() => go(x.id)}><span>{x.ic}</span>{x.label}</button>)}</div>
                  </div>))}
                {groups.map(g => (
                  <div key={g.title}><h4>{g.title}</h4>
                    <div className="msx-grid">
                      {g.items.map(([id, ic, label]) => (
                        <button key={id} className={'msx-tap msx-tile' + (active === id ? ' on' : '')} onClick={() => go(id)}><span>{ic}</span>{label}
                          <span role="button" tabIndex={0} aria-label={(pins.includes(id) ? 'Unpin ' : 'Pin ') + label} className={'msx-pin' + (pins.includes(id) ? ' on' : '')} onClick={e => { e.stopPropagation(); togglePin(id) }}>{pins.includes(id) ? '★' : '☆'}</span>
                        </button>))}
                    </div>
                  </div>))}
                <div style={{ fontSize: 12, color: 'var(--sub)', textAlign: 'center', marginTop: 14 }}>Tap ☆ on any section to pin it here and in the side menu.</div>
              </>
            )}
          </div>
        </>
      )}
      {disp && (
        <>
          <div onClick={() => setDisp(false)} style={{ position: 'fixed', inset: 0, zIndex: 79 }} />
          <div className="msx-disp" role="dialog" aria-label="Display comfort">
            <h3>Display comfort</h3><p>Pick what is easiest on your eyes. Saved on this device.</p>
            <h5>Text size</h5>
            <div className="msx-seg" role="group" aria-label="Text size">{[['md', 'A', 'Normal'], ['lg', 'A+', 'Large'], ['xl', 'A++', 'Extra large']].map(([k, t, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.size === k ? ' on' : '')} aria-pressed={prefs.size === k} title={l} onClick={() => setPref({ size: k })}>{t}</button>)}</div>
            <h5>Colours</h5>
            <div className="msx-seg" role="group" aria-label="Colour theme">{[['light', '☀️ Light'], ['warm', '🌅 Warm'], ['dark', '🌙 Dark']].map(([k, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.theme === k ? ' on' : '')} aria-pressed={prefs.theme === k} onClick={() => setPref({ theme: k })}>{l}</button>)}</div>
            <h5>Spacing</h5>
            <div className="msx-seg" role="group" aria-label="Spacing">{[['normal', 'Normal'], ['roomy', 'Roomy (bigger buttons)']].map(([k, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.comfort === k ? ' on' : '')} aria-pressed={prefs.comfort === k} onClick={() => setPref({ comfort: k })}>{l}</button>)}</div>
            <button type="button" className="msx-tap" style={{ marginTop: 14, width: '100%', padding: 10, borderRadius: 12, background: '#f1ede3', fontWeight: 700, fontSize: 13 }} onClick={() => setPref({ size: 'md', theme: 'light', comfort: 'normal' })}>Reset to default</button>
          </div>
        </>
      )}
      {msg && <div role="status" className={'msx-snack ' + (bad ? 'bad' : 'ok')}>{msg}</div>}
      <Confetti show={confetti} />
    </div>
  )
}

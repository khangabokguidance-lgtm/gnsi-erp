// HelpCenter.jsx — "Help & Training": what changed, step-by-step guides for every
// module, role-based training paths and a personal progress tracker.
// Guides are plain data files in src/data/tutorials/<module-id>.js; the change
// list is src/data/changelog.js. Progress is stored in this browser only.
import { useMemo, useState } from 'react'
import { CHANGELOG, TYPE_META } from './data/changelog'

const modules = import.meta.glob('./data/tutorials/*.js', { eager: true })
const GUIDES = Object.values(modules).map(m => m.default).filter(Boolean)

const NAVY = '#1e3a6e', GOLD = '#a7771f', LINE = '#e8e3d8'
const PROGRESS_KEY = 'gnsi_training_done_v1'
const loadDone = () => { try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')) } catch { return new Set() } }
const saveDone = set => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...set])) } catch { /* storage unavailable */ } }

// Recommended order per job. Modules that don't exist in this install are skipped.
const PATHS = [
  { id: 'new', title: 'Everyone — start here', who: 'Any new staff member', minutes: 20, modules: ['dashboard', 'students', 'leave', 'notice', 'faceattendance'] },
  { id: 'accounts', title: 'Fees & Accounts', who: 'Accountant / fee counter', minutes: 60, modules: ['fees', 'studentfeeledger', 'feesetup', 'accounts', 'students', 'reports'] },
  { id: 'reception', title: 'Reception & Admissions', who: 'Reception / admission desk', minutes: 50, modules: ['reception', 'admissions', 'bulkadmission', 'students', 'fees', 'notice', 'invitation'] },
  { id: 'teacher', title: 'Teaching staff', who: 'Teachers', minutes: 55, modules: ['attendance', 'timetable', 'teaching', 'exams', 'learninghub', 'courses', 'leave'] },
  { id: 'hostel', title: 'Housemaster / Warden', who: 'Hostel staff', minutes: 50, modules: ['hostel', 'attendance', 'kitchen', 'leave', 'notice'] },
  { id: 'admin', title: 'Administrator', who: 'Admins and managers', minutes: 90, modules: ['dashboard', 'fees', 'feesetup', 'students', 'admin', 'system', 'adminlink', 'student360', 'reports', 'checklist', 'hr', 'staff'] },
]

const Chip = ({ children, bg = '#eef3fb', fg = NAVY }) => (
  <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: bg, color: fg, letterSpacing: '.02em' }}>{children}</span>
)
const card = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 14, padding: '16px 18px' }

function printGuide(g) {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('')
  const html = `<html><head><title>${esc(g.title)} — training guide</title><style>
    body{font:13px/1.55 system-ui,sans-serif;color:#14213d;margin:28px;max-width:780px}h1{color:#1e3a6e;margin:0 0 4px}h2{color:#a7771f;margin:22px 0 6px;font-size:15px}
    h3{margin:14px 0 4px;font-size:13.5px}.m{color:#64748b;font-size:12px}ol,ul{margin:4px 0 8px 20px;padding:0}.tip{background:#fffbeb;border-left:3px solid #f59e0b;padding:5px 9px;margin:4px 0}
    table{border-collapse:collapse;width:100%}td{border:1px solid #e8e3d8;padding:5px 8px;vertical-align:top}td:first-child{font-weight:700;width:28%}</style></head><body>
    <h1>${esc(g.title)}</h1><div class="m">GNSI ERP training guide · ${esc(g.group || '')} · used by ${esc((g.roles || []).join(', '))}</div><p>${esc(g.summary)}</p>
    ${g.before?.length ? `<h2>Before you start</h2><ul>${li(g.before)}</ul>` : ''}
    ${g.tabs?.length ? `<h2>Screens</h2><table>${g.tabs.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.what)}</td></tr>`).join('')}</table>` : ''}
    <h2>How to…</h2>${(g.steps || []).map((s, i) => `<h3>${i + 1}. ${esc(s.title)}</h3><ol>${li(s.body)}</ol>${s.tip ? `<div class="tip">Tip: ${esc(s.tip)}</div>` : ''}`).join('')}
    ${g.tips?.length ? `<h2>Tips</h2><ul>${li(g.tips)}</ul>` : ''}${g.mistakes?.length ? `<h2>Common mistakes</h2><ul>${li(g.mistakes)}</ul>` : ''}
    ${g.faq?.length ? `<h2>Questions</h2>${g.faq.map(f => `<p><b>${esc(f.q)}</b><br>${esc(f.a)}</p>`).join('')}` : ''}
    <script>window.onload=function(){window.print()}</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Allow pop-ups to print the guide.'); return }
  w.document.write(html); w.document.close()
}

function Guide({ g, done, onToggle, onOpenModule, canOpen, onSelect }) {
  const byId = useMemo(() => Object.fromEntries(GUIDES.map(x => [x.id, x])), [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, background: 'linear-gradient(135deg,#fffaf0,#fff)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: '.14em' }}>{g.group}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, fontFamily: "'Fraunces',Georgia,serif" }}>{g.title}</div>
            <div style={{ fontSize: 13, color: '#475569', margin: '6px 0 8px', maxWidth: 640 }}>{g.summary}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(g.roles || []).map(r => <Chip key={r}>{r}</Chip>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canOpen && <button type="button" onClick={() => onOpenModule(g.id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: NAVY, color: 'white', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Open {g.title} →</button>}
            <button type="button" onClick={() => printGuide(g)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'white', color: NAVY, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>🖨 Print guide</button>
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 700, color: done ? '#166534' : '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={done} onChange={() => onToggle(g.id)} /> {done ? 'I have learned this module ✓' : 'Mark as learned'}
        </label>
      </div>

      {g.before?.length > 0 && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffdf5' }}>
          <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 6 }}>Before you start</div>
          <ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13, color: '#44403c' }}>{g.before.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}

      {g.tabs?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8 }}>The screens in this module</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
            {g.tabs.map(t => (
              <div key={t.name} style={{ background: '#f8fafc', borderRadius: 10, padding: '8px 11px' }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: NAVY }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{t.what}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10 }}>Step by step</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(g.steps || []).map((s, i) => (
            <details key={i} open={i === 0} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800, color: NAVY, fontSize: 13.5 }}>{i + 1}. {s.title}</summary>
              <ol style={{ margin: '10px 0 6px 20px', padding: 0, fontSize: 13, color: '#1f2937', lineHeight: 1.6 }}>{(s.body || []).map((b, j) => <li key={j} style={{ marginBottom: 3 }}>{b}</li>)}</ol>
              {s.tip && <div style={{ fontSize: 12, background: '#fffbeb', borderLeft: '3px solid #f59e0b', padding: '5px 10px', color: '#78350f' }}>💡 {s.tip}</div>}
            </details>
          ))}
        </div>
      </div>

      {(g.tips?.length > 0 || g.mistakes?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          {g.tips?.length > 0 && <div style={{ ...card, borderColor: '#bbf7d0' }}><div style={{ fontWeight: 800, color: '#166534', marginBottom: 6 }}>Good habits</div><ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13 }}>{g.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {g.mistakes?.length > 0 && <div style={{ ...card, borderColor: '#fecaca' }}><div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>Common mistakes</div><ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13 }}>{g.mistakes.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        </div>
      )}

      {g.faq?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8 }}>Questions people ask</div>
          {g.faq.map((f, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{f.q}</div><div style={{ fontSize: 13, color: '#475569' }}>{f.a}</div></div>)}
        </div>
      )}

      {g.related?.length > 0 && (
        <div style={{ fontSize: 12.5, color: '#475569' }}>Related guides: {g.related.filter(id => byId[id]).map(id => (
          <button key={id} type="button" onClick={() => onSelect(id)} style={{ marginRight: 6, padding: '3px 10px', borderRadius: 99, border: `1px solid ${LINE}`, background: 'white', color: NAVY, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{byId[id].title}</button>
        ))}</div>
      )}
    </div>
  )
}

export default function HelpCenter({ currentUser, canAccess, onNavigate }) {
  const [view, setView] = useState(() => {
    try { if (sessionStorage.getItem('gnsi_help_open')) return 'guides' } catch { /* storage unavailable */ }
    return 'new'
  })
  const [sel, setSel] = useState(() => {
    try { const id = sessionStorage.getItem('gnsi_help_open'); if (id) { sessionStorage.removeItem('gnsi_help_open'); return id } } catch { /* storage unavailable */ }
    return null
  })
  const [q, setQ] = useState('')
  const [onlyMine, setOnlyMine] = useState(true)
  const [done, setDone] = useState(loadDone)
  const [typeF, setTypeF] = useState('all')

  const toggle = id => setDone(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); saveDone(n); return n })
  const usable = g => !canAccess || canAccess(g.id)
  const byId = useMemo(() => Object.fromEntries(GUIDES.map(g => [g.id, g])), [])
  const mine = GUIDES.filter(g => g.id === 'help' || usable(g))
  const doneMine = mine.filter(g => done.has(g.id)).length
  const pct = mine.length ? Math.round((doneMine / mine.length) * 100) : 0

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return GUIDES.filter(g => (!onlyMine || usable(g)) && (!t || [g.title, g.summary, ...(g.steps || []).flatMap(s => [s.title, ...(s.body || [])]), ...(g.tabs || []).map(x => x.name), ...(g.faq || []).map(f => f.q)].join(' ').toLowerCase().includes(t)))
      .sort((a, b) => a.title.localeCompare(b.title))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canAccess is stable per render of the app shell
  }, [q, onlyMine])
  const groups = useMemo(() => {
    const m = new Map()
    shown.forEach(g => { const k = g.group || 'OTHER'; if (!m.has(k)) m.set(k, []); m.get(k).push(g) })
    return [...m.entries()]
  }, [shown])

  const openGuide = id => { setSel(id); setView('guides'); window.scrollTo?.({ top: 0 }) }
  const goModule = id => onNavigate?.(id)
  const g = sel ? byId[sel] : null

  const tabBtn = (id, label) => (
    <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
      style={{ padding: '8px 16px', borderRadius: 999, border: view === id ? `1px solid ${NAVY}` : `1px solid ${LINE}`, background: view === id ? NAVY : 'white', color: view === id ? 'white' : NAVY, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ padding: '18px 20px 40px', maxWidth: 1180, margin: '0 auto', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, fontFamily: "'Fraunces',Georgia,serif" }}>📖 Help &amp; Training</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Hello {currentUser?.name || 'there'} — learn each module step by step, and see what has changed.</div>
        </div>
        <div style={{ ...card, padding: '10px 16px', minWidth: 220 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: '.1em' }}>YOUR TRAINING</div>
          <div style={{ height: 8, background: '#eef0f4', borderRadius: 4, overflow: 'hidden', margin: '6px 0 4px' }}><div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', transition: 'width .4s' }} /></div>
          <div style={{ fontSize: 12, color: '#475569' }}>{doneMine} of {mine.length} modules learned ({pct}%)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabBtn('new', "✨ What's new")}{tabBtn('guides', '📚 Module guides')}{tabBtn('paths', '🎯 Training paths')}
      </div>

      {view === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'new', 'improved', 'fixed', 'security'].map(t => (
              <button key={t} type="button" onClick={() => setTypeF(t)} style={{ padding: '4px 12px', borderRadius: 99, border: `1px solid ${typeF === t ? NAVY : LINE}`, background: typeF === t ? NAVY : 'white', color: typeF === t ? 'white' : NAVY, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t === 'all' ? 'Everything' : TYPE_META[t].label}</button>
            ))}
          </div>
          {CHANGELOG.map(e => {
            const items = e.items.filter(i => typeF === 'all' || i.type === typeF)
            if (!items.length) return null
            return (
              <div key={e.title} style={card}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {items.map((i, k) => (
                    <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ flex: '0 0 74px' }}><Chip bg={TYPE_META[i.type].bg} fg={TYPE_META[i.type].fg}>{TYPE_META[i.type].label}</Chip></span>
                      <div style={{ flex: 1, fontSize: 13, color: '#1f2937' }}>{i.text}
                        {i.module && byId[i.module] && <button type="button" onClick={() => openGuide(i.module)} style={{ marginLeft: 8, border: 'none', background: 'none', color: GOLD, fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: 0 }}>Learn how →</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'guides' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="hc-grid">
          <style>{'@media(max-width:820px){.hc-grid{grid-template-columns:1fr!important}}'}</style>
          <div style={{ ...card, padding: 12, position: 'sticky', top: 70, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search guides… e.g. receipt, leave" aria-label="Search guides" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', margin: '8px 2px' }}><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Only modules I can open</label>
            {groups.length === 0 && <div style={{ fontSize: 12.5, color: '#94a3b8', padding: 8 }}>No guide matches.</div>}
            {groups.map(([grp, list]) => (
              <div key={grp} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: GOLD, margin: '4px 4px' }}>{grp}</div>
                {list.map(x => (
                  <button key={x.id} type="button" onClick={() => setSel(x.id)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 6, textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: sel === x.id ? '#eef3fb' : 'transparent', color: NAVY, fontWeight: sel === x.id ? 800 : 600, fontSize: 13 }}>
                    <span>{x.title}</span>{done.has(x.id) && <span style={{ color: '#16a34a' }}>✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div>
            {g ? <Guide g={g} done={done.has(g.id)} onToggle={toggle} onOpenModule={goModule} canOpen={usable(g) && g.id !== 'help'} onSelect={setSel} />
              : <div style={{ ...card, textAlign: 'center', color: '#64748b', padding: 40 }}>Choose a module on the left to see its guide.<br /><br />New here? Try the “Training paths” tab for a recommended order.</div>}
          </div>
        </div>
      )}

      {view === 'paths' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
          {PATHS.map(p => {
            const list = p.modules.map(id => byId[id]).filter(Boolean)
            const dn = list.filter(x => done.has(x.id)).length
            return (
              <div key={p.id} style={card}>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{p.who} · about {p.minutes} minutes · {dn}/{list.length} done</div>
                <div style={{ height: 6, background: '#eef0f4', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}><div style={{ height: '100%', width: `${list.length ? (dn / list.length) * 100 : 0}%`, background: '#16a34a' }} /></div>
                <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13 }}>
                  {list.map(x => (
                    <li key={x.id} style={{ marginBottom: 4 }}>
                      <button type="button" onClick={() => openGuide(x.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: NAVY, fontWeight: 700, fontSize: 13 }}>{x.title}</button> {done.has(x.id) && <span style={{ color: '#16a34a' }}>✓</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

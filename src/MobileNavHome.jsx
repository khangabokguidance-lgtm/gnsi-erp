// MobileNavHome.jsx — the phone menu, laid out like a payments-app home
// screen: big round quick-access icons at the top, then one white card per
// module group with a 4-column grid of tappable icons, search, and a
// floating "Dashboard" pill. Replaces the dark slide-in list on phones only.
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavIcon } from './navIcons'

const NAVY = '#0B1E3D', NAVY2 = '#1F4E8C', GOLD = '#C9A24B', INK = '#1c2433', SUB = '#5d6b82'
const DEFAULT_QUICK = ['dashboard', 'students', 'fees', 'attendance', 'hostel', 'teaching', 'studentfeeledger', 'leave']
const GROUP_TITLES = { CORE: 'Students & Admissions', FINANCE: 'Fees & Finance', ACADEMIC: 'Academics', PEOPLE: 'Staff & Hostel', OPERATIONS: 'Front Office', MANAGEMENT: 'Management' }
const PREVIEW = 8 // two rows of four, then "View All"
// Shorter names for the icon grid so every label fits in two lines.
const SHORT = { construction: 'Campus Works', questionbankviewer: 'QB Viewer', studentfeeledger: 'Fee Ledger', bulkadmission: 'Bulk Admission', faceattendance: 'Face Attendance', website: 'Website', studymaterial: 'Study Material' }
const short = it => SHORT[it.id] || it.label

const CSS = `
.mnh{position:fixed;inset:0;z-index:299;background:#f3f4f7;display:flex;flex-direction:column;font-family:'Plus Jakarta Sans','Inter',system-ui,sans-serif;color:${INK};transform:translateX(-100%);transition:transform .26s cubic-bezier(.4,0,.2,1);visibility:hidden}
.mnh.open{transform:none;visibility:visible}
.mnh-top{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;background:#f3f4f7;position:sticky;top:0;z-index:2}
.mnh-logo{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px #fff,0 4px 12px rgba(11,30,61,.25);flex-shrink:0}
.mnh-brand{flex:1;min-width:0;line-height:1.05}
.mnh-brand b{font-size:20px;font-weight:900;letter-spacing:-.02em;color:${NAVY}}
.mnh-brand b span{color:${GOLD}}
.mnh-brand small{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;white-space:nowrap;text-transform:uppercase;color:${SUB};margin-top:3px}
.mnh-ib{width:42px;height:42px;border-radius:50%;border:none;background:transparent;color:${INK};display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;flex-shrink:0}
.mnh-ib:active{background:#e6e8ee}
.mnh-dot{position:absolute;top:8px;right:9px;width:9px;height:9px;border-radius:50%;background:#e53935;border:2px solid #f3f4f7}
.mnh-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 120px}
.mnh-search{display:flex;align-items:center;gap:8px;margin:0 2px 14px;padding:0 14px;height:46px;border-radius:14px;background:#fff;border:1.5px solid #dfe3ea;color:${SUB}}
.mnh-search input{flex:1;border:none;outline:none;font:600 15px inherit;font-family:inherit;color:${INK};background:transparent;min-width:0}
.mnh-h1{font-size:23px;font-weight:800;letter-spacing:-.01em;margin:8px 6px 16px;color:#141a26}
.mnh-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 6px;margin-bottom:20px}
.mnh-q{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;color:${INK};-webkit-tap-highlight-color:transparent;position:relative}
.mnh-qc{width:62px;height:62px;border-radius:50%;background:linear-gradient(160deg,${NAVY2},${NAVY});color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -8px rgba(11,30,61,.7);transition:transform .12s}
.mnh-q:active .mnh-qc{transform:scale(.93)}
.mnh-q.on .mnh-qc{box-shadow:0 0 0 3px #fff,0 0 0 5px ${GOLD}}
.mnh-ql{font-size:12.5px;font-weight:600;line-height:1.25;text-align:center;max-width:84px}
.mnh-card{background:#fff;border-radius:22px;padding:18px 12px 14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.mnh-ch{display:flex;align-items:center;justify-content:space-between;padding:0 8px 14px}
.mnh-ch h2{font-family:inherit;font-size:19px;font-weight:800;margin:0;color:#141a26;letter-spacing:-.01em}
.mnh-va{display:flex;align-items:center;gap:3px;background:none;border:none;color:#1a73e8;font:700 14px inherit;font-family:inherit;cursor:pointer;padding:4px}
.mnh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 4px}
.mnh-g{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:4px 0;font-family:inherit;color:${INK};-webkit-tap-highlight-color:transparent;position:relative;border-radius:14px}
.mnh-g:active{background:#f1f4f9}
.mnh-gi{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:${NAVY2};background:#eef3fb}
.mnh-g.on .mnh-gi{background:linear-gradient(160deg,${NAVY2},${NAVY});color:#fff}
.mnh-gl{font-size:12px;font-weight:600;line-height:1.25;text-align:center;max-width:82px;color:#2b3445;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mnh-badge{position:absolute;top:0;right:calc(50% - 32px);min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#e53935;color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.mnh-promo{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:22px;margin-bottom:14px;background:linear-gradient(120deg,#dff1fb,#d3ebf9);border:none;width:100%;text-align:left;cursor:pointer;font-family:inherit;color:#141a26}
.mnh-promo .av{width:48px;height:48px;border-radius:50%;background:linear-gradient(160deg,${NAVY2},${NAVY});color:${GOLD};display:flex;align-items:center;justify-content:center;font:800 17px Georgia,serif;flex-shrink:0}
.mnh-promo b{display:block;font-size:17px;font-weight:800}
.mnh-promo small{font-size:13px;color:${SUB};font-weight:600}
.mnh-out{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:16px;border:1.5px solid #f3c6cd;background:#fff;color:#b3273f;font:700 14.5px inherit;font-family:inherit;cursor:pointer;margin-top:6px}
.mnh-fab{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:0 30px;height:58px;border-radius:999px;border:none;background:linear-gradient(180deg,#1b3f7a,${NAVY});color:#fff;font:700 18px inherit;font-family:inherit;box-shadow:0 14px 30px -10px rgba(11,30,61,.75),inset 0 0 0 1.5px rgba(255,255,255,.18);cursor:pointer;z-index:3;white-space:nowrap}
.mnh-fab:active{transform:translateX(-50%) scale(.97)}
.mnh-empty{text-align:center;color:${SUB};padding:30px 10px;font-weight:600}
@media (prefers-reduced-motion:reduce){.mnh{transition:none}}
`

export default function MobileNavHome({ open, onClose, groups, allowedModules, activePage, onNavigate, badges = {}, currentUser, onLogout, logoSrc }) {
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [expanded, setExpanded] = useState({})
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const visibleGroups = useMemo(() => groups
    .map(g => ({ ...g, items: g.items.filter(i => allowedModules.has(i.id)) }))
    .filter(g => g.items.length), [groups, allowedModules])
  const allItems = useMemo(() => visibleGroups.flatMap(g => g.items), [visibleGroups])

  // Quick access: the user's pinned modules, then recent ones, then defaults.
  const quick = useMemo(() => {
    const read = k => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
    const ids = [...read('gnsi_nav_pins'), ...read('gnsi_nav_recents'), ...DEFAULT_QUICK]
    const seen = new Set(), out = []
    for (const id of ids) {
      const it = allItems.find(i => i.id === id)
      if (it && !seen.has(id)) { seen.add(id); out.push(it) }
      if (out.length === 4) break
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read pins/recents each time the menu opens
  }, [allItems, open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (showSearch) inputRef.current?.focus() }, [showSearch])

  const go = id => {
    try {
      const rec = JSON.parse(localStorage.getItem('gnsi_nav_recents') || '[]')
      localStorage.setItem('gnsi_nav_recents', JSON.stringify([id, ...rec.filter(r => r !== id)].slice(0, 5)))
    } catch { /* storage unavailable — navigation still works */ }
    setQuery(''); setShowSearch(false)
    onNavigate(id)
    onClose()
  }

  const q = query.trim().toLowerCase()
  const hits = q ? allItems.filter(i => i.label.toLowerCase().includes(q)) : []
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = (currentUser?.name || 'there').split(' ')[0]
  const initials = (currentUser?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const noticeCount = badges.notice?.count || 0

  const Tile = ({ it }) => (
    <button type="button" className={'mnh-g' + (activePage === it.id ? ' on' : '')} onClick={() => go(it.id)} aria-current={activePage === it.id ? 'page' : undefined}>
      <span className="mnh-gi"><NavIcon id={it.id} size={24} /></span>
      <span className="mnh-gl">{short(it)}</span>
      {badges[it.id]?.count > 0 && <span className="mnh-badge">{badges[it.id].count}</span>}
    </button>
  )

  return (
    <div className={'mnh' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
      <style>{CSS}</style>
      <div className="mnh-top">
        {logoSrc && <img className="mnh-logo" src={logoSrc} alt="GNSI" />}
        <div className="mnh-brand"><b>GNSI <span>ERP</span></b><small>School Management</small></div>
        <button type="button" className="mnh-ib" aria-label="Search modules" onClick={() => setShowSearch(v => !v)}><NavIcon id="search" size={25} stroke={2} /></button>
        <button type="button" className="mnh-ib" aria-label="Notices" onClick={() => go('notice')}>
          <NavIcon id="notice" size={25} stroke={2} />{noticeCount > 0 && <span className="mnh-dot" />}
        </button>
        <button type="button" className="mnh-ib" aria-label="Close menu" onClick={onClose}><NavIcon id="close" size={24} stroke={2.2} /></button>
      </div>

      <div className="mnh-scroll" ref={scrollRef}>
        {(showSearch || q) && (
          <label className="mnh-search">
            <NavIcon id="search" size={19} />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search modules…" aria-label="Search modules" />
            {query && <button type="button" className="mnh-ib" style={{ width: 30, height: 30 }} aria-label="Clear search" onClick={() => setQuery('')}><NavIcon id="close" size={16} /></button>}
          </label>
        )}

        {q ? (
          <div className="mnh-card">
            <div className="mnh-ch"><h2>Results</h2></div>
            {hits.length ? <div className="mnh-grid">{hits.map(it => <Tile key={it.id} it={it} />)}</div> : <div className="mnh-empty">No module matches “{query}”.</div>}
          </div>
        ) : (
          <>
            <div className="mnh-h1">Quick Access</div>
            <div className="mnh-quick">
              {quick.map(it => (
                <button type="button" key={it.id} className={'mnh-q' + (activePage === it.id ? ' on' : '')} onClick={() => go(it.id)}>
                  <span className="mnh-qc"><NavIcon id={it.id} size={27} /></span>
                  <span className="mnh-ql">{short(it)}</span>
                  {badges[it.id]?.count > 0 && <span className="mnh-badge" style={{ right: 'calc(50% - 36px)' }}>{badges[it.id].count}</span>}
                </button>
              ))}
            </div>

            <button type="button" className="mnh-promo" onClick={() => go('dashboard')}>
              <span className="av">{initials}</span>
              <span style={{ flex: 1, minWidth: 0 }}><b>{greet}, {first}!</b><small>{currentUser?.role || 'Staff'} · open today's dashboard</small></span>
              <NavIcon id="chevron" size={22} stroke={2.2} />
            </button>

            {visibleGroups.map(g => {
              const isOpen = expanded[g.group]
              const items = isOpen ? g.items : g.items.slice(0, PREVIEW)
              return (
                <div key={g.group} className="mnh-card">
                  <div className="mnh-ch">
                    <h2>{GROUP_TITLES[g.group] || g.group}</h2>
                    {g.items.length > PREVIEW && (
                      <button type="button" className="mnh-va" onClick={() => setExpanded(e => ({ ...e, [g.group]: !isOpen }))}>
                        {isOpen ? 'Show less' : 'View All'} <span aria-hidden="true" style={{ display: 'inline-flex', transform: isOpen ? 'rotate(-90deg)' : 'none' }}><NavIcon id="chevron" size={17} stroke={2.4} /></span>
                      </button>
                    )}
                  </div>
                  <div className="mnh-grid">{items.map(it => <Tile key={it.id} it={it} />)}</div>
                </div>
              )
            })}

            <button type="button" className="mnh-out" onClick={onLogout}><NavIcon id="logout" size={19} /> Sign out</button>
          </>
        )}
      </div>

      {allowedModules.has('dashboard') && (
        <button type="button" className="mnh-fab" onClick={() => go('dashboard')}><NavIcon id="home" size={23} stroke={2} /> Dashboard</button>
      )}
    </div>
  )
}

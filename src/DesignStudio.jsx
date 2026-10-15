import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import InvitationGenerator from './InvitationGenerator'
import CertificateGenerator from './CertificateGenerator'
import TeachersDayFrame from './TeachersDayFrame'

// Design Studio — a Canva/Photoshop-style workspace.
//   left rail  : tools (Home, Banner Maker, Invitation Maker, Invitation, Certificates, Teachers' Day)
//   home       : start-a-design gallery (opens Banner Maker on the chosen template)
//   focus mode : takes over the whole screen, like a real design app
// The two makers are self-contained editors served from /design-studio/*.html.
const BASE = '/design-studio'
const INK = '#14161b', RAIL = '#0e1013', PANEL = '#1b1e25', LINE = '#2a2e38', GOLD = '#d8b25a', MUT = '#9aa3b5'

const TOOLS = [
  { id: 'home',        label: 'Home',        icon: '🏠', perm: null },
  { id: 'banner',      label: 'Banners',     icon: '🖼️', perm: 'designstudio' },
  { id: 'invmaker',    label: 'Invites',     icon: '💌', perm: 'designstudio' },
  { id: 'invitation',  label: 'Invitation',  icon: '✉️', perm: 'invitation' },
  { id: 'certificate', label: 'Certificates', icon: '📜', perm: 'certificate' },
  { id: 'teachersday', label: "Teachers' Day", icon: '🎓', perm: 'teachersday' },
]

const TEMPLATES = [
  { id: 'gnsi',      name: 'GNSI Premium',        size: '7 × 21 ft · Landscape', cat: 'Banners' },
  { id: 'portrait4', name: 'Portrait Banner',     size: '4 × 8 ft · Portrait',   cat: 'Banners' },
  { id: 'stepP4',    name: 'Step & Repeat',       size: '4 × 8 ft · Portrait',   cat: 'Media walls' },
  { id: 'step',      name: 'Step & Repeat Wall',  size: '7 × 21 ft · Landscape', cat: 'Media walls' },
  { id: 'grid',      name: 'Checkerboard Wall',   size: '7 × 21 ft · Landscape', cat: 'Media walls' },
  { id: 'red',       name: 'Red Carpet',          size: '7 × 21 ft · Landscape', cat: 'Banners' },
  { id: 'a4',        name: 'A4 Poster',           size: '210 × 297 mm',          cat: 'Posters' },
]

export default function DesignStudio({ currentUser, perms, canAccess, topOffset = 0 }) {
  const tools = TOOLS.filter(t => !t.perm || !canAccess || canAccess(t.perm))
  const [tool, setTool] = useState('home')
  const [tpl, setTpl] = useState('')
  const [nonce, setNonce] = useState(0)     // remounts the editor iframe when a new template is picked
  const [focus, setFocus] = useState(false)
  const root = useRef(null)

  // Full screen is app-level: the whole portal goes full screen and the ERP sidebar
  // stays (folded to its icon rail), like a desktop design app. Nothing is overlaid.
  useEffect(() => {
    const sync = () => setFocus(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  useEffect(() => {
    const k = e => { if (e.key === 'F11') { e.preventDefault(); toggleFull() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [toggleFull])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')

  const canBanner = tools.some(t => t.id === 'banner')
  const cats = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.cat)))]
  const list = useMemo(() => TEMPLATES.filter(t =>
    (cat === 'All' || t.cat === cat) && (t.name + t.size + t.cat).toLowerCase().includes(q.toLowerCase())), [q, cat])

  const open = (id, template = '') => { setTpl(template); setNonce(n => n + 1); setTool(id) }
  const cur = tools.find(t => t.id === tool) || tools[0]

  const frame = (file, hash = '') => (
    <iframe key={file + hash + nonce} title={file} src={`${BASE}/${file}${hash}`}
      style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: '#fff' }} />
  )

  const home = (
    <div style={{ flex: 1, overflow: 'auto', background: INK, color: '#eef1f8' }}>
      <div style={{ padding: '44px 56px 28px', background: 'radial-gradient(900px 300px at 20% 0%,#27427f55,transparent),linear-gradient(180deg,#171b27,#14161b)', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 700, color: GOLD }}>What will you design today?</div>
        <div style={{ color: MUT, marginTop: 6, fontSize: 15 }}>Banners, media walls, posters, invitations and certificates — all in one studio.</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search designs, sizes…"
          style={{ marginTop: 22, width: 'min(560px,100%)', padding: '14px 18px', borderRadius: 999, border: `1px solid ${LINE}`, background: PANEL, color: '#fff', fontSize: 15, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {tools.filter(t => t.id !== 'home').map(t => (
            <button key={t.id} onClick={() => open(t.id)} style={quick}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      {canBanner && (
        <div style={{ padding: '28px 56px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginRight: 10 }}>Start from a template</div>
            {cats.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{ ...chip, ...(c === cat ? chipOn : null) }}>{c}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 22 }}>
            <button onClick={() => open('banner', 'blank')} style={card}>
              <div style={{ ...thumb, display: 'grid', placeItems: 'center', fontSize: 44, color: GOLD, background: '#222733' }}>＋</div>
              <div style={cardT}>Blank canvas</div><div style={cardS}>Custom size</div>
            </button>
            {list.map(t => (
              <button key={t.id} onClick={() => open('banner', t.id)} style={card}>
                <div style={{ ...thumb, background: '#0b0d12' }}>
                  <img src={`${BASE}/thumbs/${t.id}.jpg`} alt={t.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
                <div style={cardT}>{t.name}</div><div style={cardS}>{t.size}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const body = {
    home,
    banner:      frame('banner-maker.html', tpl ? `#tpl=${tpl}` : ''),
    invmaker:    frame('invitation-maker.html'),
    invitation:  <div style={light}><InvitationGenerator currentUser={currentUser} /></div>,
    certificate: <div style={light}><CertificateGenerator currentUser={currentUser} perms={perms ? perms('certificate') : undefined} /></div>,
    teachersday: <div style={light}><TeachersDayFrame /></div>,
  }[cur.id]

  return (
    <div ref={root} style={{ display: 'flex', height: `calc(100vh - ${topOffset}px)`, minHeight: 520, background: INK }}>
      <nav style={{ width: 84, flex: 'none', background: RAIL, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4 }}>
        <div title="Design Studio" style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,#b8892b,${GOLD})`, display: 'grid', placeItems: 'center', fontSize: 22, marginBottom: 10 }}>🎨</div>
        {tools.map(t => (
          <button key={t.id} onClick={() => { setTpl(''); setTool(t.id) }} title={t.label}
            style={{ width: 72, padding: '10px 0 8px', border: 0, cursor: 'pointer', borderRadius: 12, color: t.id === cur.id ? '#fff' : MUT,
              background: t.id === cur.id ? '#272c38' : 'transparent', borderLeft: `3px solid ${t.id === cur.id ? GOLD : 'transparent'}` }}>
            <div style={{ fontSize: 22 }}>{t.icon}</div>
            <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600 }}>{t.label}</div>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={toggleFull} title={focus ? 'Exit full screen (F11)' : 'Full screen (F11)'}
          style={{ width: 72, padding: '10px 0', border: 0, cursor: 'pointer', borderRadius: 12, background: 'transparent', color: MUT }}>
          <div style={{ fontSize: 20 }}>{focus ? '🗗' : '⛶'}</div>
          <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600 }}>{focus ? 'Exit' : 'Full screen'}</div>
        </button>
      </nav>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {cur.id !== 'home' && (
          <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: PANEL, borderBottom: `1px solid ${LINE}`, color: '#dfe5f3', fontSize: 13 }}>
            <button onClick={() => setTool('home')} style={{ ...quick, padding: '5px 12px', fontSize: 12 }}>← Home</button>
            <b style={{ color: GOLD }}>{cur.icon} {cur.label}</b>
            <span style={{ color: MUT }}>Design Studio</span>
            <span style={{ flex: 1 }} />
            <button onClick={toggleFull} style={{ ...quick, padding: '5px 12px', fontSize: 12 }}>{focus ? '🗗 Exit full screen' : '⛶ Full screen'}</button>
            {(cur.id === 'banner' || cur.id === 'invmaker') && (
              <button onClick={() => window.open(`${BASE}/${cur.id === 'banner' ? 'banner-maker' : 'invitation-maker'}.html`, '_blank')} style={{ ...quick, padding: '5px 12px', fontSize: 12 }}>Open in new tab ↗</button>
            )}
          </div>
        )}
        {body}
      </main>
    </div>
  )
}

const light = { flex: 1, overflow: 'auto', background: '#fff' }
const quick = { border: `1px solid ${LINE}`, background: PANEL, color: '#eef1f8', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }
const chip = { border: `1px solid ${LINE}`, background: 'transparent', color: MUT, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const chipOn = { background: GOLD, color: '#1a1a1a', borderColor: GOLD }
const card = { border: `1px solid ${LINE}`, background: PANEL, borderRadius: 14, padding: 12, cursor: 'pointer', textAlign: 'left', color: '#eef1f8', transition: 'transform .15s, border-color .15s' }
const thumb = { height: 170, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }
const cardT = { marginTop: 10, fontWeight: 700, fontSize: 14 }
const cardS = { color: MUT, fontSize: 12, marginTop: 2 }

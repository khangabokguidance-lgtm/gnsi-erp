// ════════════════════════════════════════════════════════════════════════
//  staffPhotos.jsx — one place for staff/faculty photos + premium UI bits
//  Photos come from (in order):
//    1. staff_profiles.photo_url / photo / avatar_url (if the column exists)
//    2. website_faculty.photo_url  (the Faculty cards you manage in
//       Website Manager) — matched to staff by name
//  Loaded ONCE per page and shared by every avatar.
// ════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const norm = (s) => String(s || '').toLowerCase().replace(/^(dr|mr|mrs|ms|miss|prof|sir)\.?\s+/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s) => norm(s).split(' ').filter(t => t.length > 1)

let cache = null          // { byId: Map, byName: Map, list: [{toks, url}] }
let loading = null
const subs = new Set()

async function loadPhotos() {
  const byId = new Map(), byName = new Map(), list = []
  const add = (name, url) => {
    if (!name || !url) return
    const n = norm(name); if (!byName.has(n)) byName.set(n, url)
    list.push({ toks: tokens(name), url })
  }
  try {
    const { data } = await supabase.from('staff_profiles').select('*').limit(2000)
    ;(data || []).forEach(r => {
      const url = r.photo_url || r.photo || r.avatar_url || r.image_url || null
      if (url) { byId.set(String(r.id), url); add(r.name, url) }
    })
  } catch (_) {}
  try {
    const { data } = await supabase.from('website_faculty').select('name, photo_url').limit(500)
    ;(data || []).forEach(r => add(r.name, r.photo_url))
  } catch (_) {}
  cache = { byId, byName, list }
  subs.forEach(f => f())
  return cache
}

export function refreshStaffPhotos() { loading = loadPhotos(); return loading }

export function findStaffPhoto(name, id) {
  if (!cache) return null
  if (id != null && cache.byId.has(String(id))) return cache.byId.get(String(id))
  const n = norm(name); if (!n) return null
  if (cache.byName.has(n)) return cache.byName.get(n)
  // Loose match: every word of the shorter name appears in the other (≥2 words)
  const t = tokens(name); if (t.length < 2) return null
  let best = null
  for (const e of cache.list) {
    if (e.toks.length < 2) continue
    const [a, b] = t.length <= e.toks.length ? [t, e.toks] : [e.toks, t]
    if (a.every(x => b.includes(x))) { best = e.url; break }
  }
  return best
}

export function useStaffPhotos() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force(x => x + 1)
    subs.add(f)
    if (!cache && !loading) loading = loadPhotos()
    return () => subs.delete(f)
  }, [])
  return findStaffPhoto
}

// Drop-in replacement for an initials circle: keeps the same size/shape/border,
// shows the real photo when one is found, otherwise the original initials.
export function StaffAvatar({ name, id, style = {}, children, title }) {
  useStaffPhotos()
  const [broken, setBroken] = useState(false)
  const url = !broken ? findStaffPhoto(name, id) : null
  if (!url) return <div style={style} title={title || name}>{children}</div>
  const { width = 40, height = 40, borderRadius = '50%', border, boxShadow, flexShrink = 0, margin } = style
  return (
    <img src={url} alt={name || ''} title={title || name} loading="lazy" onError={() => setBroken(true)}
      style={{ width, height, borderRadius, border: border || '2px solid #E2C57E', boxShadow: boxShadow || '0 4px 12px rgba(11,30,61,.18)',
               objectFit: 'cover', objectPosition: 'center top', flexShrink, margin, background: '#F4F1EA', display: 'block' }}/>
  )
}

// ── Premium "Ledger & Crest" header used by Staff / Salary / Fee Ledger ──
export const PREMIUM = { navy: '#0B1E3D', navy2: '#132B52', gold: '#C9A24B', gold2: '#E2C57E', ivory: '#F4F1EA', ink: '#1B2437' }
export const PREMIUM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .gp-serif{font-family:'Playfair Display',Georgia,serif}
  .gp-card{background:#fff;border:1px solid #E8E1D0;border-radius:16px;box-shadow:0 10px 30px rgba(11,30,61,.06)}
  .gp-lift{transition:transform .18s ease, box-shadow .18s ease}
  .gp-lift:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(11,30,61,.12)}
  @keyframes gpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .gp-in{animation:gpIn .35s ease both}
`
export function PremiumHero({ icon, title, subtitle, eyebrow = 'GNSI · Guidance Navodaya & Sainik Institute', right, mobile, stats }) {
  return (
    <div className="gp-in" style={{ position: 'relative', overflow: 'hidden', borderRadius: mobile ? 16 : 22, padding: mobile ? '18px 16px' : '26px 28px', marginBottom: 18,
      background: 'radial-gradient(120% 140% at 100% 0%, #1F4E8C 0%, #132B52 42%, #0B1E3D 80%)', color: '#fff',
      boxShadow: '0 22px 50px rgba(11,30,61,.25), inset 0 0 0 1px rgba(226,197,126,.22)' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'linear-gradient(90deg,#B8913F,#E2C57E,#B8913F)' }}/>
      <div style={{ position: 'absolute', right: -40, bottom: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(226,197,126,.16), transparent 70%)' }}/>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: mobile ? 44 : 54, height: mobile ? 44 : 54, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: mobile ? 22 : 26,
          background: 'linear-gradient(180deg,rgba(226,197,126,.25),rgba(226,197,126,.08))', border: '1px solid rgba(226,197,126,.45)', flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', color: '#E2C57E', textTransform: 'uppercase' }}>{eyebrow}</div>
          <h1 className="gp-serif" style={{ margin: '4px 0 2px', fontSize: mobile ? 22 : 30, fontWeight: 700, lineHeight: 1.15 }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)' }}>{subtitle}</div>}
        </div>
        {right && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${mobile ? 2 : Math.min(stats.length, 5)}, minmax(0,1fr))`, gap: 10, marginTop: 18 }}>
          {stats.map(s => (
            <div key={s.label} style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(226,197,126,.22)', minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.62)' }}>{s.icon} {s.label}</div>
              <div className="gp-serif" style={{ fontSize: mobile ? 19 : 24, fontWeight: 700, color: s.color || '#fff', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export const goldBtn = { padding: '10px 18px', borderRadius: 999, border: '1px solid #E2C57E', background: 'linear-gradient(180deg,#D9B566,#C9A24B)', color: '#0B1E3D', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 24px rgba(201,162,75,.3)' }
export const ghostBtn = { padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

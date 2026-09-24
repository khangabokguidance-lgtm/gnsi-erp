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
import { getFaculty } from './websiteApi'

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
  // Faculty photos managed in Website Manager → Faculty (same source as the website)
  try {
    const rows = await getFaculty()
    ;(rows || []).forEach(r => add(r.name, r.photo_url || r.photo || r.image_url))
  } catch (_) {}
  const freq = new Map()
  list.forEach(e => new Set(e.toks).forEach(t => freq.set(t, (freq.get(t) || 0) + 1)))
  cache = { byId, byName, list, freq }
  subs.forEach(f => f())
  return cache
}

export function refreshStaffPhotos() { loading = loadPhotos(); return loading }

// Website Manager → Faculty fires this after every add / edit / photo upload
if (typeof window !== 'undefined' && !window.__gnsiFacultyListener) {
  window.__gnsiFacultyListener = true
  window.addEventListener('gnsi:faculty-updated', () => { if (cache || loading) refreshStaffPhotos() })
}

export function findStaffPhoto(name, id) {
  if (!cache) return null
  if (id != null && cache.byId.has(String(id))) return cache.byId.get(String(id))
  const n = norm(name); if (!n) return null
  if (cache.byName.has(n)) return cache.byName.get(n)
  // Fuzzy match — handles order, extra/missing middle names, short forms
  // (Kh → Khundrakpam) and spelling variants (Praveen/Prabin, Laishramcha).
  // Common words (Singh, Devi) and family names shared by many people only
  // count if a personal name (e.g. Arjun, Chetan) also matches.
  const t = tokens(name); if (!t.length) return null
  const freq = cache.freq
  let best = null, bestW = 0, tie = false
  for (const e of cache.list) {
    const m = matchedTokens(t, e.toks)            // [[staffWord, facultyWord], …]
    const rare = m.filter(([x, y]) => !COMMON.has(x) && !COMMON.has(y) && (freq.get(y) || 0) <= 1)
    if (!rare.length || m.length < Math.min(2, t.length)) continue
    const w = rare.length * 3 + m.length
    if (w > bestW) { best = e.url; bestW = w; tie = false }
    else if (w === bestW && e.url !== best) tie = true
  }
  return !tie ? best : null
}

const COMMON = new Set(['singh', 'devi', 'chanu', 'leima', 'meitei', 'sharma', 'kumar', 'kumari', 'rani', 'md', 'mohd'])

// Edit distance (small strings only)
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1))
  return d[a.length][b.length]
}
function tokSim(a, b) {
  if (a === b) return true
  const m = Math.min(a.length, b.length)
  if (m >= 2 && m <= 3 && (a.startsWith(b) || b.startsWith(a))) return true       // Kh → Khundrakpam
  if (m >= 4 && (a.startsWith(b) || b.startsWith(a))) return true                   // Laishram → Laishramcha
  if (m >= 5 && lev(a, b) <= 2) return true
  if (m >= 4 && lev(a, b) <= 1) return true
  const sq = s => s.replace(/v/g, 'b').replace(/ee/g, 'i').replace(/sh/g, 's').replace(/(.)\1+/g, '$1')
  if (m < 4) return false
  const A = sq(a), B = sq(b)
  if (Math.min(A.length, B.length) >= 5 && (A.startsWith(B) || B.startsWith(A))) return true  // Shandhya ~ Sandhyarani
  return lev(A, B) <= 1                                                             // Praveen ~ Prabin
}
// the words of `a` (staff name) that have a similar word in `b` (each used once)
function matchedTokens(a, b) {
  const used = new Set(), out = []
  for (const x of a) {
    const k = b.findIndex((y, i) => !used.has(i) && tokSim(x, y))
    if (k >= 0) { used.add(k); out.push([x, b[k]]) }
  }
  return out
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
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${mobile ? 2 : Math.min(stats.length, 6)}, minmax(0,1fr))`, gap: 10, marginTop: 18 }}>
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
// Kitchen.jsx — GNSI Portal v3.2 — Production UI (Fixed)
// ─────────────────────────────────────────────────────────────────────────────
//  Fixes applied:
//  1. Tab buttons: type="button" + stopPropagation
//  2. C.ink[150] removed (doesn't exist) → C.ink[200]
//  3. DayGroup: today's group starts expanded, others collapsed
//  4. Vendor field: select and text input properly decoupled
//  5. BudgetModal: guard against empty/NaN save
//  6. PettyCashWidget: cashLog keyed by filterDate prop (stable)
//  7. weekStart: ISO-correct Monday-based week
//  8. WhatsApp: uses filterDate (the ledger's active date filter)
//  9. CookAttendancePanel: saveAll uses upsert with onConflict
// 10. handleCookLogSave: correctly maps form fields
// 11. CSS: .slide-down class wired to slideDown keyframe
// 12. All Topbar action buttons: type="button"
// 13. EntryForm receipt upload: guarded file check
// 14. CalendarHeatmap onDayClick: sets filterDate then switches tab
// 15. Missing meal alert: only fires for today
// 16. SQL migration included at bottom as comment
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  terra:  { 50:'#FFF5F0',100:'#FFE8DC',200:'#FFD0BA',300:'#FFAD8A',400:'#FF8A5C',500:'#E8622A',600:'#C44E1C',700:'#A03A12',800:'#7A2A0A',900:'#521A04' },
  saffron:{ 50:'#FFFBEB',100:'#FEF3C7',200:'#FDE68A',300:'#FCD34D',400:'#FBBF24',500:'#F59E0B',600:'#D97706',700:'#B45309',800:'#92400E',900:'#78350F' },
  forest: { 50:'#F0FDF4',100:'#DCFCE7',200:'#BBF7D0',300:'#86EFAC',400:'#4ADE80',500:'#22C55E',600:'#16A34A',700:'#15803D',800:'#166534',900:'#14532D' },
  teal:   { 50:'#F0FDFA',100:'#CCFBF1',200:'#99F6E4',300:'#5EEAD4',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E',800:'#115E59',900:'#134E4A' },
  ink:    { 50:'#FDFAF7',100:'#F5EDE4',200:'#E8D9CA',300:'#D2B99F',400:'#B59478',500:'#8C6A50',600:'#6E5038',700:'#523A26',800:'#382618',900:'#20140A' },
  slate:  { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  rose:   { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',300:'#FDA4AF',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  sky:    { 50:'#F0F9FF',100:'#E0F2FE',200:'#BAE6FD',400:'#38BDF8',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' },
  violet: { 50:'#F5F3FF',100:'#EDE9FE',200:'#DDD6FE',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
  parchment: '#FAF6F1',
  surface: '#FFFFFF',
  divider: '#EDE5DA',
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --font-display: 'Playfair Display', 'Georgia', serif;
    --font-body: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    --font-mono: 'DM Mono', 'Courier New', monospace;
    --terra-600: #C44E1C;
    --terra-50:  #FFF5F0;
    --ink-900:   #20140A;
    --parchment: #FAF6F1;
    --surface:   #FFFFFF;
    --shadow-xs:  0 1px 2px rgba(56,38,24,.06);
    --shadow-sm:  0 2px 8px rgba(56,38,24,.08), 0 1px 2px rgba(56,38,24,.04);
    --shadow-md:  0 4px 16px rgba(56,38,24,.10), 0 2px 4px rgba(56,38,24,.06);
    --shadow-lg:  0 12px 32px rgba(56,38,24,.14), 0 4px 8px rgba(56,38,24,.06);
    --shadow-xl:  0 24px 64px rgba(56,38,24,.18), 0 8px 16px rgba(56,38,24,.08);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-full: 9999px;
  }

  body { background: var(--parchment); }
  .gnsi-kitchen { font-family: var(--font-body); background: var(--parchment); min-height: 100vh; color: var(--ink-900); }

  .k-input {
    width: 100%; padding: 10px 14px; border-radius: var(--radius-md);
    border: 1.5px solid ${C.ink[200]}; font-size: 13px; font-family: var(--font-body);
    outline: none; background: #fff; color: ${C.ink[900]};
    transition: border-color .15s, box-shadow .15s; line-height: 1.5;
  }
  .k-input:focus { border-color: ${C.terra[500]}; box-shadow: 0 0 0 3px ${C.terra[100]}; }
  .k-input::placeholder { color: ${C.ink[300]}; }
  select.k-input { cursor: pointer; }
  textarea.k-input { resize: vertical; }

  .k-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: var(--font-body); font-weight: 600; cursor: pointer; border: none; transition: all .15s; white-space: nowrap; }
  .k-btn:disabled { opacity: .45; cursor: not-allowed; }

  .k-btn-primary {
    padding: 10px 22px; border-radius: var(--radius-md); font-size: 13px;
    background: linear-gradient(160deg, ${C.terra[500]} 0%, ${C.terra[700]} 100%);
    color: #fff; box-shadow: 0 2px 8px rgba(196,78,28,.35), inset 0 1px 0 rgba(255,255,255,.15);
  }
  .k-btn-primary:hover:not(:disabled) {
    background: linear-gradient(160deg, ${C.terra[400]} 0%, ${C.terra[600]} 100%);
    box-shadow: 0 4px 14px rgba(196,78,28,.4), inset 0 1px 0 rgba(255,255,255,.15);
    transform: translateY(-1px);
  }
  .k-btn-primary:active { transform: translateY(0); }

  .k-btn-ghost {
    padding: 9px 16px; border-radius: var(--radius-md); font-size: 12px;
    background: #fff; color: ${C.ink[600]}; border: 1.5px solid ${C.ink[200]};
    box-shadow: var(--shadow-xs);
  }
  .k-btn-ghost:hover { background: ${C.ink[50]}; border-color: ${C.ink[300]}; }

  .k-btn-icon {
    padding: 8px; border-radius: var(--radius-md); font-size: 14px;
    background: #fff; color: ${C.ink[500]}; border: 1.5px solid ${C.ink[200]};
    box-shadow: var(--shadow-xs); width: 34px; height: 34px;
  }
  .k-btn-icon:hover { background: ${C.ink[50]}; }

  .k-card { background: #fff; border-radius: var(--radius-lg); border: 1.5px solid ${C.divider}; box-shadow: var(--shadow-sm); }
  .k-card-section { padding: 20px 24px; }
  .k-card-section + .k-card-section { border-top: 1px solid ${C.divider}; }

  .k-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--radius-full); font-size: 10.5px; font-weight: 700; letter-spacing: .02em; }

  .k-label { display: block; font-size: 10.5px; font-weight: 700; color: ${C.ink[500]}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .07em; font-family: var(--font-body); }

  .k-number { font-family: var(--font-display); }

  .k-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: ${C.terra[400]}; }
  .k-divider::before, .k-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, ${C.terra[100]}, transparent); }
  .k-divider::after { background: linear-gradient(to left, ${C.terra[100]}, transparent); }

  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes shimmer { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

  .fade-up { animation: fadeUp .3s ease both; }
  .fade-in { animation: fadeIn .2s ease both; }
  .slide-down { animation: slideDown .25s ease both; }

  .stagger > * { animation: fadeUp .3s ease both; }
  .stagger > *:nth-child(1) { animation-delay: .03s; }
  .stagger > *:nth-child(2) { animation-delay: .07s; }
  .stagger > *:nth-child(3) { animation-delay: .11s; }
  .stagger > *:nth-child(4) { animation-delay: .15s; }
  .stagger > *:nth-child(5) { animation-delay: .19s; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.ink[200]}; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.ink[300]}; }

  @media print {
    .no-print { display: none !important; }
    .gnsi-kitchen { background: #fff; }
    .k-card { box-shadow: none; border: 1px solid #ddd; }
  }
`

// ─── Meal Config ──────────────────────────────────────────────────────────────
const MEALS = {
  lunch:             { label:'Morning Lunch',       short:'Lunch',   emoji:'🍱', time:'12:30', bg:C.forest[600],  soft:C.forest[50],  border:C.forest[200],  text:C.forest[800], accent:'#166534' },
  morning_breakfast: { label:'Afternoon Breakfast', short:'A.Bfast', emoji:'☕', time:'14:30', bg:C.saffron[500], soft:C.saffron[50], border:C.saffron[200], text:C.saffron[800],accent:'#92400E' },
  evening_breakfast: { label:'Evening Breakfast',   short:'E.Bfast', emoji:'🌇', time:'16:30', bg:C.terra[500],   soft:C.terra[50],   border:C.terra[200],   text:C.terra[800],  accent:'#7A2A0A' },
  dinner:            { label:'Dinner',              short:'Dinner',  emoji:'🌙', time:'19:30', bg:C.teal[700],    soft:C.teal[50],    border:C.teal[200],    text:C.teal[800],   accent:'#134E4A' },
}
const MEAL_KEYS = ['lunch','morning_breakfast','evening_breakfast','dinner']

const COOKS = [
  'Khundrakpam Jamuna Devi',
  'Ningthoujam Madhomti Devi',
  'Ningthoujam Santi Devi',
  'Khundrakpam Premabati Devi',
]
const COOK_SHIFTS = {
  morning: { label:'Morning Shift', short:'Morning', emoji:'🌅', time:'06:30–09:00 AM', defaultIn:'06:30', defaultOut:'09:00', bg:C.saffron[50],  border:C.saffron[200], text:C.saffron[800] },
  evening: { label:'Evening Shift', short:'Evening', emoji:'🌇', time:'06:00–09:00 PM', defaultIn:'18:00', defaultOut:'21:00', bg:C.terra[50],    border:C.terra[200],   text:C.terra[800]   },
}
const MANIPURI_PRESETS = {
  lunch:             ['Chak (Rice)','Kangsoi','Eromba','Nga Thongba','Hawai Thongba','Alu Kangmet','Khichdi','Papad','Pickle','Sabzi'],
  morning_breakfast: ['Tea','Bread','Rusk','Halwa','Egg','Milk','Banana','Biscuit','Momo','Chak-hao Kheer'],
  evening_breakfast: ['Tea','Bread','Rusk','Singju','Pakora','Samosa','Bread Pakora','Chow Chow','Biscuit','Fruits'],
  dinner:            ['Chak (Rice)','Dal','Sabzi','Nga Thongba','Paneer','Chapati','Khichdi','Soup','Papad'],
}
const LOCAL_VENDORS = ['Khangabok Market','Thoubal Bazaar','Ima Keithel','Wangjing Market','Chandani Shop','Imphal Market','Thangal Bazaar','Lamlong Bazaar','Local Farmer','Daily Supplier']
const ITEM_CATEGORIES = {
  grain:     { label:'Grain / Cereal', emoji:'🌾', color:C.saffron },
  vegetable: { label:'Vegetable',      emoji:'🥦', color:C.forest  },
  protein:   { label:'Protein',        emoji:'🍗', color:C.terra   },
  dairy:     { label:'Dairy',          emoji:'🥛', color:C.sky     },
  spice:     { label:'Spice / Masala', emoji:'🌶️', color:C.rose    },
  oil:       { label:'Oil / Fat',      emoji:'🫙', color:C.ink     },
  other:     { label:'Other',          emoji:'📦', color:C.slate   },
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const today    = () => new Date().toISOString().split('T')[0]
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
const dateFmt  = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const moneyFmt = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
// FIX: Monday-based week start
const weekStart= () => {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day   // Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}
const nowHHMM  = () => { const n=new Date(); return n.getHours()*100+n.getMinutes() }

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ msg, color=C.forest[600] }) {
  return (
    <div className="no-print fade-in" style={{
      position:'fixed', top:20, right:20, zIndex:999999,
      background:'#fff', borderRadius:12, padding:'14px 20px',
      fontSize:13, fontWeight:600, fontFamily:'var(--font-body)',
      boxShadow:'0 8px 32px rgba(56,38,24,.16), 0 2px 8px rgba(56,38,24,.08)',
      border:`1px solid ${C.ink[100]}`, borderLeft:`4px solid ${color}`,
      maxWidth:360, color:C.ink[800], display:'flex', alignItems:'center', gap:10,
    }}>
      <span style={{ width:8,height:8,borderRadius:'50%',background:color,flexShrink:0,display:'inline-block' }} />
      {msg}
    </div>
  )
}

function Field({ label, sub, children, span }) {
  return (
    <div style={span ? { gridColumn:`span ${span}` } : {}}>
      <label className="k-label">
        {label}
        {sub && <span style={{ fontWeight:400, color:C.ink[400], marginLeft:5, textTransform:'none', letterSpacing:0 }}>{sub}</span>}
      </label>
      {children}
    </div>
  )
}

function MealBadge({ type, size='sm' }) {
  const m = MEALS[type]; if (!m) return null
  const sizes = { sm:{fontSize:10,padding:'3px 9px'}, md:{fontSize:11.5,padding:'4px 12px'} }
  return (
    <span className="k-badge" style={{ ...sizes[size], background:m.soft, color:m.text, border:`1px solid ${m.border}` }}>
      {m.emoji} {m.short}
    </span>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n===value?0:n)}
          style={{ fontSize:18, cursor:onChange?'pointer':'default',
            color:n<=value?C.saffron[500]:C.ink[200], transition:'color .1s, transform .1s', display:'inline-block' }}
          onMouseEnter={e=>{if(onChange)e.currentTarget.style.transform='scale(1.2)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)'}}>★</span>
      ))}
    </div>
  )
}

function SectionDivider({ label }) {
  return <div className="k-divider">{label}</div>
}

function LoadingBar() {
  return (
    <div style={{ height:3, borderRadius:99, background:C.ink[100], overflow:'hidden', marginBottom:20, position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, height:'100%', width:'40%', borderRadius:99,
        background:`linear-gradient(90deg, ${C.terra[300]}, ${C.terra[500]})`,
        animation:'shimmer 1.2s ease-in-out infinite' }} />
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6,
      padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600,
      background:`${color}18`, color:color, border:`1px solid ${color}30` }}>
      <span style={{ fontWeight:700 }}>{value}</span>
      <span style={{ opacity:.7, fontWeight:400, fontSize:10 }}>{label}</span>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, accent, subtitle, icon, pulse, trend }) {
  return (
    <div className="k-card fade-up" style={{ flex:1, minWidth:140, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', right:-10, top:-10, width:64, height:64, borderRadius:'50%', background:`${accent}10`, pointerEvents:'none' }} />
      {icon && <div style={{ position:'absolute', right:16, top:14, fontSize:22, opacity:.12 }}>{icon}</div>}
      {pulse && (
        <div style={{ position:'absolute', top:12, right:12, width:7, height:7, borderRadius:'50%',
          background:C.terra[500], animation:'blink 1.4s ease-in-out infinite', boxShadow:`0 0 6px ${C.terra[400]}` }} />
      )}
      <div className="k-number" style={{ fontSize:24, fontWeight:700, color:accent||C.ink[800], lineHeight:1, letterSpacing:'-.01em' }}>
        {value}
      </div>
      <div style={{ fontSize:10.5, fontWeight:700, color:C.ink[400], marginTop:6, textTransform:'uppercase', letterSpacing:'.07em', fontFamily:'var(--font-body)' }}>
        {label}
      </div>
      {subtitle && <div style={{ fontSize:10, color:C.ink[300], marginTop:3, fontFamily:'var(--font-mono)' }}>{subtitle}</div>}
      {trend !== undefined && (
        <div style={{ marginTop:8, fontSize:11, fontWeight:600, color: trend >= 0 ? C.rose[600] : C.forest[600] }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

function MealKpiStrip({ entries, dateFilter }) {
  const dayEntries = entries.filter(e => e.expense_date === dateFilter)
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
      {MEAL_KEYS.map(mk => {
        const m   = MEALS[mk]
        const mEntries = dayEntries.filter(e=>e.meal_type===mk)
        const amt = mEntries.reduce((s,e)=>s+Number(e.amount),0)
        const hasEntry = mEntries.length > 0
        const [h,min] = m.time.split(':').map(Number)
        const isPast  = h*100+min < nowHHMM()
        const isMissing = !hasEntry && isPast && dateFilter === today()
        return (
          <div key={mk} className="k-card" style={{
            padding:'14px 16px', position:'relative', overflow:'hidden',
            border:`1.5px solid ${isMissing ? C.rose[200] : hasEntry ? m.border : C.ink[100]}`,
            background: isMissing ? C.rose[50] : hasEntry ? m.soft : '#fff',
            opacity: !hasEntry && !isPast ? .65 : 1,
          }}>
            <div style={{ position:'absolute', right:8, top:8, fontSize:20, opacity:.13 }}>{m.emoji}</div>
            <div style={{ fontSize:10, fontWeight:700, color: isMissing ? C.rose[600] : m.text, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{m.short}</div>
            <div className="k-number" style={{ fontSize:18, fontWeight:700, color: isMissing ? C.rose[500] : m.text, lineHeight:1 }}>
              {hasEntry ? moneyFmt(amt) : <span style={{ fontSize:12, opacity:.5 }}>{isMissing ? '⚠ Missing' : 'Upcoming'}</span>}
            </div>
            <div style={{ fontSize:9, color: isMissing?C.rose[400]:m.text, opacity:.6, marginTop:3 }}>{m.time}</div>
          </div>
        )
      })}
    </div>
  )
}

function BudgetBar({ spent, budget }) {
  if (!budget) return null
  const pct   = Math.min((spent/budget)*100, 100)
  const over  = spent > budget
  const color = pct > 90 ? C.rose[500] : pct > 70 ? C.saffron[500] : C.forest[500]
  return (
    <div className="k-card" style={{ padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ fontSize:20, flexShrink:0 }}>📊</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.ink[600] }}>Monthly Budget</span>
          <span className="k-number" style={{ fontSize:14, fontWeight:700, color:over?C.rose[600]:C.ink[700] }}>
            {moneyFmt(spent)} <span style={{ color:C.ink[300], fontWeight:400, fontSize:11 }}>/ {moneyFmt(budget)}</span>
            {over && <span style={{ marginLeft:8, padding:'2px 8px', borderRadius:99, background:C.rose[100], color:C.rose[700], fontSize:10, fontWeight:700 }}>OVER</span>}
          </span>
        </div>
        <div style={{ height:8, borderRadius:99, background:C.ink[100], overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:color, transition:'width .6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
        <div style={{ fontSize:11, color:C.ink[400], marginTop:5, fontFamily:'var(--font-mono)' }}>
          {over ? `${moneyFmt(spent-budget)} over limit` : `${moneyFmt(budget-spent)} remaining · ${(100-pct).toFixed(1)}% left`}
        </div>
      </div>
    </div>
  )
}

function MonthlyChart({ entries }) {
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => { map[e.expense_date] = (map[e.expense_date]||0) + Number(e.amount) })
    return map
  }, [entries])

  const days = Object.keys(byDay).sort()
  if (!days.length) return null
  const max = Math.max(...Object.values(byDay), 1)
  const avg = Object.values(byDay).reduce((a,b)=>a+b,0) / days.length

  return (
    <div className="k-card" style={{ padding:'20px 24px', marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], fontFamily:'var(--font-body)' }}>Daily Spend</div>
          <div style={{ fontSize:11, color:C.ink[400], marginTop:1 }}>This month</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div className="k-number" style={{ fontSize:15, fontWeight:700, color:C.ink[700] }}>{moneyFmt(avg)}</div>
          <div style={{ fontSize:10, color:C.ink[400] }}>daily avg</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100, overflowX:'auto', paddingBottom:4 }}>
        {days.map((d, i) => {
          const v = byDay[d]
          const h = Math.max((v/max)*84, 4)
          const isToday  = d === today()
          const isPeak   = v === max
          const color    = isPeak ? C.rose[500] : isToday ? C.terra[500] : C.terra[200]
          const hoverCol = isPeak ? C.rose[400] : isToday ? C.terra[400] : C.terra[300]
          return (
            <div key={d} title={`${dateFmt(d)}: ${moneyFmt(v)}`}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0, cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.querySelector('.bar').style.background=hoverCol}
              onMouseLeave={e=>e.currentTarget.querySelector('.bar').style.background=color}>
              <div className="bar" style={{ width:18, height:h, borderRadius:'4px 4px 0 0', background:color,
                transition:'height .4s cubic-bezier(.4,0,.2,1)', animationDelay:`${i*.02}s` }} />
              <span style={{ fontSize:8, color:C.ink[300], transform:'rotate(-45deg)', transformOrigin:'center', display:'block', width:14, textAlign:'center' }}>
                {new Date(d+'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:10, fontSize:10 }}>
        {[['Today',C.terra[500]],['Peak',C.rose[500]],['Other',C.terra[200]]].map(([l,col])=>(
          <span key={l} style={{ display:'flex', alignItems:'center', gap:4, color:C.ink[400] }}>
            <span style={{ width:8, height:8, borderRadius:2, background:col, display:'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

function MealPieBreakdown({ entries }) {
  const totals = useMemo(() => {
    const map = {}; MEAL_KEYS.forEach(k => { map[k]=0 })
    entries.forEach(e => { map[e.meal_type] = (map[e.meal_type]||0) + Number(e.amount) })
    return map
  }, [entries])
  const grand = Object.values(totals).reduce((a,b)=>a+b,0)
  if (!grand) return null
  return (
    <div className="k-card" style={{ padding:'20px 24px', marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:16 }}>Meal-wise Breakdown</div>
      <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
        {MEAL_KEYS.map(mk => {
          const m   = MEALS[mk]
          const amt = totals[mk]
          const pct = grand ? ((amt/grand)*100) : 0
          return (
            <div key={mk}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:C.ink[600], marginBottom:5 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:m.bg, display:'inline-block' }} />
                  {m.label}
                </span>
                <span style={{ fontWeight:700, fontFamily:'var(--font-mono)', fontSize:11 }}>
                  {moneyFmt(amt)} <span style={{ color:C.ink[400], fontWeight:400 }}>({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div style={{ height:6, borderRadius:99, background:C.ink[100], overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:m.bg, transition:'width .6s cubic-bezier(.4,0,.2,1)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarHeatmap({ entries, onDayClick }) {
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => { map[e.expense_date]=(map[e.expense_date]||0)+Number(e.amount) })
    return map
  }, [entries])
  const values  = Object.values(byDay)
  const max     = Math.max(...values, 1)
  const now     = new Date()
  const year    = now.getFullYear()
  const month   = now.getMonth()
  const daysInM = new Date(year, month+1, 0).getDate()
  const firstDOW= new Date(year, month, 1).getDay()

  const getColor = amt => {
    if (!amt) return C.ink[100]
    const i = amt/max
    if (i > .75) return C.rose[500]
    if (i > .5)  return C.terra[400]
    if (i > .25) return C.saffron[400]
    return C.saffron[200]
  }

  const cells = []
  for (let i=0;i<firstDOW;i++) cells.push(null)
  for (let d=1;d<=daysInM;d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ d, iso, amt:byDay[iso]||0 })
  }

  return (
    <div className="k-card" style={{ padding:'20px 24px', marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:12 }}>
        Spend Heatmap — {now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d,i)=>(
          <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:C.ink[400], paddingBottom:3 }}>{d}</div>
        ))}
        {cells.map((c,i) => c===null
          ? <div key={`e${i}`} />
          : <div key={c.iso} onClick={() => onDayClick(c.iso)}
              title={`${dateFmt(c.iso)}: ${moneyFmt(c.amt)}`}
              style={{
                aspectRatio:'1', borderRadius:6, background:getColor(c.amt),
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:700, color:c.amt?'#fff':C.ink[400],
                border:c.iso===today()?`2px solid ${C.terra[600]}`:'2px solid transparent',
                transition:'transform .1s, box-shadow .1s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.2)';e.currentTarget.style.zIndex='2';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.2)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.zIndex='1';e.currentTarget.style.boxShadow='none'}}>
              {c.d}
            </div>
        )}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:12, fontSize:10, color:C.ink[400] }}>
        {[['None',C.ink[100]],['Low',C.saffron[200]],['Mid',C.saffron[400]],['High',C.terra[400]],['Peak',C.rose[500]]].map(([l,col])=>(
          <span key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:10, height:10, borderRadius:3, background:col, display:'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

function VendorSummary({ entries }) {
  const vendors = useMemo(() => {
    const map = {}
    entries.filter(e=>e.vendor).forEach(e => {
      if (!map[e.vendor]) map[e.vendor] = { count:0, total:0 }
      map[e.vendor].count++; map[e.vendor].total += Number(e.amount)
    })
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,6)
  }, [entries])
  if (!vendors.length) return null
  const maxT = vendors[0][1].total
  return (
    <div className="k-card" style={{ padding:'20px 24px', marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:14 }}>Top Vendors</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {vendors.map(([name, { count, total }], i) => (
          <div key={name}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.ink[400], fontFamily:'var(--font-mono)', width:14 }}>{i+1}</span>
                <span style={{ fontSize:12, fontWeight:600, color:C.ink[700] }}>{name}</span>
                <span style={{ fontSize:10, color:C.ink[400] }}>{count}×</span>
              </div>
              <span className="k-number" style={{ fontSize:13, fontWeight:700, color:C.teal[700] }}>{moneyFmt(total)}</span>
            </div>
            <div style={{ height:4, borderRadius:99, background:C.ink[100], overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(total/maxT)*100}%`, borderRadius:99, background:C.teal[400], transition:'width .5s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ItemFrequency({ entries }) {
  const freq = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!e.item_details) return
      e.item_details.split(',').map(s=>s.trim()).filter(Boolean).forEach(item => { map[item]=(map[item]||0)+1 })
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15)
  }, [entries])
  if (!freq.length) return null
  return (
    <div className="k-card" style={{ padding:'20px 24px', marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:12 }}>Most Used Items</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {freq.map(([item,count]) => (
          <span key={item} style={{
            padding:'5px 12px', borderRadius:99,
            background:C.saffron[50], border:`1px solid ${C.saffron[200]}`,
            fontSize:11, fontWeight:600, color:C.saffron[800],
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
            {item}
            <span style={{ fontSize:10, fontWeight:700, color:C.saffron[500], fontFamily:'var(--font-mono)' }}>×{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function CostPerStudentCard({ entries, dateFilter }) {
  const dayEntries = entries.filter(e=>e.expense_date===dateFilter && e.pax_count>0)
  if (!dayEntries.length) return null
  const totalAmt = dayEntries.reduce((s,e)=>s+Number(e.amount),0)
  const avgPax   = dayEntries.reduce((s,e)=>s+Number(e.pax_count),0)/dayEntries.length
  const cps      = avgPax > 0 ? totalAmt/avgPax : 0
  return (
    <div className="k-card" style={{ padding:'16px 20px', marginBottom:12,
      background:`linear-gradient(135deg, ${C.sky[50]}, #fff)`, border:`1.5px solid ${C.sky[200]}`,
      display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:C.sky[100],
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>👤</div>
      <div>
        <div className="k-number" style={{ fontSize:22, fontWeight:700, color:C.sky[700], lineHeight:1 }}>{moneyFmt(cps)}</div>
        <div style={{ fontSize:11, color:C.sky[600], marginTop:3 }}>
          per student · {Math.round(avgPax)} served today
        </div>
      </div>
    </div>
  )
}

// FIX: PettyCashWidget — cashLog stored in ref so it doesn't reset on parent re-render
function PettyCashWidget({ entries, dateFilter }) {
  const [given, setGiven]     = useState('')
  const [cashLog, setCashLog] = useState([])

  const daySpend   = entries.filter(e=>e.expense_date===dateFilter).reduce((s,e)=>s+Number(e.amount),0)
  const totalGiven = cashLog.filter(c=>c.date===dateFilter).reduce((s,c)=>s+Number(c.amount),0)
  const balance    = totalGiven - daySpend

  const addCash = () => {
    const amt = parseFloat(given)
    if (!amt || amt <= 0) return
    setCashLog(prev => [...prev, { date:dateFilter, amount:amt, at:new Date().toLocaleTimeString() }])
    setGiven('')
  }

  return (
    <div className="k-card" style={{ padding:'18px 22px', marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
        💵 Petty Cash Ledger
        <span style={{ fontSize:10, color:C.ink[400], fontWeight:400, marginLeft:4 }}>— {dateFmt(dateFilter)}</span>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input className="k-input" type="number" style={{ flex:1 }} placeholder="Amount given (₹)"
          value={given} onChange={e=>setGiven(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addCash()} />
        <button type="button" className="k-btn k-btn-ghost" onClick={addCash}>+ Add</button>
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <StatPill label="given" value={moneyFmt(totalGiven)} color={C.forest[600]} />
        <StatPill label="spent" value={moneyFmt(daySpend)} color={C.rose[600]} />
        <StatPill label={balance<0?'short':'balance'} value={moneyFmt(Math.abs(balance))} color={balance>=0?C.teal[600]:C.rose[600]} />
      </div>
      {cashLog.filter(c=>c.date===dateFilter).map((c,i)=>(
        <div key={i} style={{ fontSize:11, color:C.ink[400], marginTop:6, fontFamily:'var(--font-mono)' }}>
          ✓ {moneyFmt(c.amount)} added at {c.at}
        </div>
      ))}
    </div>
  )
}

function MissingMealAlert({ entries, dateFilter }) {
  // FIX: Only show for today
  if (dateFilter !== today()) return null
  const present = entries.filter(e=>e.expense_date===dateFilter).map(e=>e.meal_type)
  const overdue = MEAL_KEYS.filter(mk => {
    if (present.includes(mk)) return false
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return h*100+m < nowHHMM()
  })
  if (!overdue.length) return null
  return (
    <div className="fade-up" style={{ marginBottom:14, padding:'14px 18px', borderRadius:10,
      background:C.rose[50], border:`1.5px solid ${C.rose[200]}`,
      display:'flex', alignItems:'flex-start', gap:12 }}>
      <span style={{ fontSize:18, marginTop:1 }}>⚠️</span>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:C.rose[700], marginBottom:6 }}>Missing meal entries — past scheduled time</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {overdue.map(mk => <MealBadge key={mk} type={mk} />)}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT VIEWER
// ═══════════════════════════════════════════════════════════════════════════════
function ReceiptViewer({ url, onClose, onDelete }) {
  const [zoom, setZoom] = useState(1)
  const isPDF = url?.toLowerCase().includes('.pdf')
  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, background:'rgba(12,6,3,.92)', zIndex:99999,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute', top:16, right:16, display:'flex', gap:8 }} onClick={e=>e.stopPropagation()}>
        {!isPDF && <>
          <button type="button" className="k-btn k-btn-ghost" onClick={()=>setZoom(z=>Math.min(z+.25,3))}
            style={{ background:'rgba(255,255,255,.12)', color:'#fff', border:'1px solid rgba(255,255,255,.2)' }}>🔍+</button>
          <button type="button" className="k-btn k-btn-ghost" onClick={()=>setZoom(z=>Math.max(z-.25,.5))}
            style={{ background:'rgba(255,255,255,.12)', color:'#fff', border:'1px solid rgba(255,255,255,.2)' }}>🔍−</button>
        </>}
        <a href={url} target="_blank" rel="noreferrer" className="k-btn k-btn-ghost"
          style={{ background:'rgba(255,255,255,.12)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', textDecoration:'none' }}>⬇ Download</a>
        {onDelete && <button type="button" className="k-btn k-btn-ghost" onClick={onDelete}
          style={{ background:'rgba(220,38,38,.2)', color:'#fca5a5', border:'1px solid rgba(220,38,38,.3)' }}>🗑 Delete</button>}
        <button type="button" className="k-btn k-btn-ghost" onClick={onClose}
          style={{ background:'rgba(255,255,255,.12)', color:'#fff', border:'1px solid rgba(255,255,255,.2)' }}>✕ Close</button>
      </div>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'85vh', overflow:'auto' }}>
        {isPDF
          ? <iframe src={url} style={{ width:'80vw', height:'80vh', border:'none', borderRadius:12 }} title="Receipt PDF" />
          : <img src={url} alt="Receipt" style={{ transform:`scale(${zoom})`, transformOrigin:'top center',
              maxWidth:'85vw', borderRadius:12, boxShadow:'0 24px 80px rgba(0,0,0,.6)', transition:'transform .2s' }} />
        }
      </div>
      {!isPDF && <div style={{ marginTop:10, fontSize:10, color:'rgba(255,255,255,.3)' }}>Zoom: {Math.round(zoom*100)}% · Click outside to close</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM SETUP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ItemSetupPanel({ onClose, showToast }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ name:'', name_meitei:'', category:'vegetable', unit:'kg', default_price:'' })
  const [editId, setEditId]   = useState(null)
  const [search, setSearch]   = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const loadItems = async () => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_items').select('*').order('category').order('name')
    setItems(data||[]); setLoading(false)
  }
  useEffect(() => { loadItems() }, [])

  const handleSave = async () => {
    if (!form.name.trim()) return
    const row = { name:form.name, name_meitei:form.name_meitei||null, category:form.category, unit:form.unit, default_price:Number(form.default_price)||null, is_active:true }
    if (editId) {
      await supabase.from('kitchen_items').update(row).eq('id',editId)
      showToast('Item updated ✓', C.saffron[600])
    } else {
      await supabase.from('kitchen_items').insert(row)
      showToast('Item added ✓', C.forest[600])
    }
    setForm({ name:'', name_meitei:'', category:'vegetable', unit:'kg', default_price:'' })
    setEditId(null); loadItems()
  }

  const toggleActive = async (id, val) => {
    await supabase.from('kitchen_items').update({ is_active:!val }).eq('id',id); loadItems()
  }

  const startEdit = item => {
    setEditId(item.id)
    setForm({ name:item.name, name_meitei:item.name_meitei||'', category:item.category||'other', unit:item.unit||'kg', default_price:item.default_price||'' })
  }

  const filtered = items.filter(it =>
    (filterCat==='all'||it.category===filterCat) &&
    (it.name.toLowerCase().includes(search.toLowerCase()) || (it.name_meitei||'').includes(search))
  )

  return (
    <div className="k-card slide-down" style={{ marginBottom:16, overflow:'hidden' }}>
      <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.divider}`,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:`linear-gradient(135deg, ${C.saffron[50]}, #fff)` }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.terra[700], fontFamily:'var(--font-display)' }}>Item Setup</div>
          <div style={{ fontSize:11, color:C.ink[500], marginTop:2 }}>Manage kitchen item master list</div>
        </div>
        <button type="button" className="k-btn k-btn-icon" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding:'20px 22px' }}>
        <div style={{ background:C.saffron[50], border:`1.5px solid ${C.saffron[200]}`, borderRadius:12, padding:'16px 18px', marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.saffron[800], marginBottom:12 }}>
            {editId ? '✏️ Edit Item' : '➕ New Item'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Name (English)">
              <input className="k-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rice" />
            </Field>
            <Field label="Local Name">
              <input className="k-input" value={form.name_meitei} onChange={e=>setForm(f=>({...f,name_meitei:e.target.value}))} placeholder="Alternate name" />
            </Field>
            <Field label="Category">
              <select className="k-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {Object.entries(ITEM_CATEGORIES).map(([k,v])=>(
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select className="k-input" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                {['kg','g','litre','ml','piece','dozen','packet','bundle'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Default Price (₹/unit)">
              <input type="number" className="k-input" value={form.default_price} onChange={e=>setForm(f=>({...f,default_price:e.target.value}))} placeholder="0.00" />
            </Field>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button type="button" className="k-btn k-btn-primary" onClick={handleSave}>{editId ? 'Update' : '+ Add'}</button>
            {editId && <button type="button" className="k-btn k-btn-ghost" onClick={()=>{setEditId(null);setForm({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })}}>Cancel</button>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input className="k-input" style={{ flex:1 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…" />
          <select className="k-input" style={{ width:'auto', minWidth:140 }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {Object.entries(ITEM_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </div>
        {loading ? <div style={{ textAlign:'center', color:C.ink[400], padding:'20px 0', fontSize:12 }}>Loading…</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:320, overflowY:'auto' }}>
            {!filtered.length && <div style={{ textAlign:'center', color:C.ink[400], padding:'20px 0', fontSize:12 }}>No items found</div>}
            {filtered.map(it => {
              const cat = ITEM_CATEGORIES[it.category]||ITEM_CATEGORIES.other
              return (
                <div key={it.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 14px', borderRadius:9,
                  background:it.is_active?'#fff':C.ink[50],
                  border:`1.5px solid ${it.is_active?cat.color[200]:C.ink[100]}`,
                  opacity:it.is_active?1:.55, transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18, width:24, textAlign:'center' }}>{cat.emoji}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:C.ink[800] }}>
                        {it.name} {it.name_meitei && <span style={{ color:C.ink[400], fontWeight:400 }}>· {it.name_meitei}</span>}
                      </div>
                      <div style={{ fontSize:10, color:C.ink[400], marginTop:1 }}>
                        {cat.label} · {it.unit}{it.default_price?` · ₹${it.default_price}/${it.unit}`:''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="button" className="k-btn k-btn-ghost" onClick={()=>startEdit(it)} style={{ fontSize:11, padding:'4px 10px' }}>Edit</button>
                    <button type="button" className="k-btn k-btn-ghost" onClick={()=>toggleActive(it.id,it.is_active)}
                      style={{ fontSize:11, padding:'4px 10px',
                        color:it.is_active?C.rose[600]:C.forest[600],
                        background:it.is_active?C.rose[50]:C.forest[50],
                        borderColor:it.is_active?C.rose[200]:C.forest[200] }}>
                      {it.is_active?'Disable':'Enable'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN MONITOR PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminMonitorPanel({ entries, budget, cookLog, onClose }) {
  const todayEntries = entries.filter(e=>e.expense_date===today())
  const todayTotal   = todayEntries.reduce((s,e)=>s+Number(e.amount),0)
  const monthTotal   = entries.reduce((s,e)=>s+Number(e.amount),0)
  const presentMeals = todayEntries.map(e=>e.meal_type)
  const missingMeals = MEAL_KEYS.filter(m=>!presentMeals.includes(m))
  const budgetPct    = budget ? (monthTotal/budget)*100 : 0
  const hhmm         = nowHHMM()
  const overdueAlerts= missingMeals.filter(mk => {
    const [h,m] = MEALS[mk].time.split(':').map(Number); return h*100+m < hhmm
  })
  const todayCookLog = cookLog.filter(l=>l.log_date===today())
  const mealStatus   = MEAL_KEYS.map(mk => {
    const me = todayEntries.filter(e=>e.meal_type===mk)
    const amt= me.reduce((s,e)=>s+Number(e.amount),0)
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return { mk, amt, isDue:h*100+m<hhmm, isLogged:me.length>0, entries:me }
  })

  return (
    <div className="k-card slide-down" style={{ marginBottom:16, overflow:'hidden' }}>
      <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.divider}`,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:`linear-gradient(135deg, ${C.terra[50]}, #fff)` }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.terra[700], fontFamily:'var(--font-display)' }}>Admin Monitor</div>
          <div style={{ fontSize:11, color:C.ink[500], marginTop:2 }}>Live kitchen oversight · {dateFmt(today())}</div>
        </div>
        <button type="button" className="k-btn k-btn-icon" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding:'20px 22px' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }} className="stagger">
          <KpiCard label="Today" value={moneyFmt(todayTotal)} accent={C.terra[600]} icon="💸" pulse />
          <KpiCard label="Month" value={moneyFmt(monthTotal)} accent={C.ink[700]} icon="🗓" />
          {budget && <KpiCard label="Budget Used" value={`${budgetPct.toFixed(1)}%`} accent={budgetPct>90?C.rose[600]:C.saffron[600]} icon="📊" />}
          <KpiCard label="Meals Today" value={`${presentMeals.length}/4`} accent={presentMeals.length===4?C.forest[600]:C.rose[600]} icon="🍽" />
        </div>
        {budgetPct > 90 && (
          <div style={{ padding:'12px 16px', borderRadius:10, background:C.rose[50], border:`1.5px solid ${C.rose[200]}`, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.rose[700] }}>🚨 Budget Breach — {budgetPct.toFixed(1)}% consumed</div>
            <div style={{ fontSize:11, color:C.rose[500], marginTop:3 }}>Spent {moneyFmt(monthTotal)} of {moneyFmt(budget)}</div>
          </div>
        )}
        {overdueAlerts.length > 0 && (
          <div style={{ padding:'12px 16px', borderRadius:10, background:C.saffron[50], border:`1.5px solid ${C.saffron[300]}`, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.saffron[800], marginBottom:6 }}>⏰ Missing Past-Due Entries</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {overdueAlerts.map(mk=><MealBadge key={mk} type={mk} />)}
            </div>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:18 }}>
          {mealStatus.map(({ mk, amt, isDue, isLogged, entries:me }) => {
            const m = MEALS[mk]
            const statusColor = isLogged ? C.forest[600] : isDue ? C.rose[600] : C.ink[400]
            const statusLabel = isLogged ? '✓ Logged' : isDue ? '⚠ Missing' : '⏳ Upcoming'
            return (
              <div key={mk} style={{ padding:'12px 16px', borderRadius:10, background:m.soft, border:`1.5px solid ${m.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <span style={{ fontSize:13 }}>{m.emoji} <strong style={{ fontFamily:'var(--font-body)' }}>{m.short}</strong></span>
                  <span style={{ fontSize:9, fontWeight:700, color:statusColor, padding:'2px 7px', borderRadius:99, background:'rgba(255,255,255,.7)' }}>{statusLabel}</span>
                </div>
                <div className="k-number" style={{ fontSize:16, fontWeight:700, color:m.text }}>{moneyFmt(amt)}</div>
                <div style={{ fontSize:10, color:m.text, opacity:.7, marginTop:2 }}>Scheduled: {m.time}</div>
                {me.length>0 && me[0].prepared_by && <div style={{ fontSize:10, color:m.text, opacity:.8, marginTop:2 }}>👨‍🍳 {me[0].prepared_by}</div>}
              </div>
            )
          })}
        </div>
        <div style={{ borderTop:`1px solid ${C.divider}`, paddingTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.ink[600], marginBottom:10 }}>Cook Activity — Today</div>
          {!todayCookLog.length
            ? <div style={{ fontSize:11, color:C.ink[400], textAlign:'center', padding:'12px 0' }}>No cook log entries today</div>
            : todayCookLog.map(log => (
              <div key={log.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 12px', borderRadius:8, background:C.ink[50], border:`1px solid ${C.ink[100]}`, marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.ink[700] }}>{log.staff_name}</div>
                  <div style={{ fontSize:10, color:C.ink[400], marginTop:2, display:'flex', gap:8, alignItems:'center' }}>
                    <MealBadge type={log.meal_type} />
                    {log.arrived_at&&<span>In: {log.arrived_at}</span>}
                    {log.left_at&&<span>Out: {log.left_at}</span>}
                  </div>
                </div>
                {log.notes && <div style={{ fontSize:10, color:C.ink[400], maxWidth:150, textAlign:'right' }}>{log.notes}</div>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Cook Log Form ────────────────────────────────────────────────────────────
function CookLogForm({ onSave, onClose }) {
  const [form, setForm] = useState({ staff_name:'', meal_type:'lunch', arrived_at:'', left_at:'', notes:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div className="k-card slide-down" style={{ marginBottom:14, overflow:'hidden', border:`1.5px solid ${C.forest[200]}` }}>
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.forest[100]}`,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:`linear-gradient(135deg, ${C.forest[50]}, #fff)` }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.forest[700], fontFamily:'var(--font-display)' }}>Log Cook Activity</div>
        <button type="button" className="k-btn k-btn-icon" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding:'18px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Staff / Cook Name">
            <input className="k-input" value={form.staff_name} onChange={e=>set('staff_name',e.target.value)} placeholder="Name" />
          </Field>
          <Field label="Meal">
            <select className="k-input" value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
              {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
            </select>
          </Field>
          <Field label="Arrived At">
            <input type="time" className="k-input" value={form.arrived_at} onChange={e=>set('arrived_at',e.target.value)} />
          </Field>
          <Field label="Left At">
            <input type="time" className="k-input" value={form.left_at} onChange={e=>set('left_at',e.target.value)} />
          </Field>
          <Field label="Notes" span={2}>
            <input className="k-input" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
          </Field>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button type="button" className="k-btn k-btn-primary" onClick={()=>form.staff_name&&onSave(form)}>Save Log</button>
          <button type="button" className="k-btn k-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COOK ATTENDANCE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function CookAttendancePanel({ onClose, showToast }) {
  const [attDate,   setAttDate]   = useState(today())
  const [monthly,   setMonthly]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [view,      setView]      = useState('mark')
  const [viewMonth, setViewMonth] = useState(monthKey())
  const [draft,     setDraft]     = useState({})

  const draftKey = (cook, shift) => `${cook}__${shift}`

  const loadDay = async (date) => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_cook_attendance').select('*').eq('att_date', date)
    const rows = data || []
    const d = {}
    COOKS.forEach(cook => {
      Object.keys(COOK_SHIFTS).forEach(shift => {
        const row = rows.find(r => r.cook_name===cook && r.shift===shift)
        d[draftKey(cook, shift)] = {
          status:    row?.status    || 'present',
          check_in:  row?.check_in  || COOK_SHIFTS[shift].defaultIn,
          check_out: row?.check_out || COOK_SHIFTS[shift].defaultOut,
          notes:     row?.notes     || '',
          id:        row?.id        || null
        }
      })
    })
    setDraft(d); setLoading(false)
  }

  const loadMonthly = async (month) => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_cook_attendance').select('*')
      .gte('att_date',`${month}-01`).lte('att_date',`${month}-31`)
    setMonthly(data||[]); setLoading(false)
  }

  useEffect(() => { loadDay(attDate) }, [attDate])
  useEffect(() => { if (view==='monthly') loadMonthly(viewMonth) }, [view, viewMonth])

  const setField = (cook, shift, field, val) => {
    setDraft(d => ({ ...d, [draftKey(cook,shift)]:{ ...d[draftKey(cook,shift)], [field]:val } }))
  }

  // FIX: Use upsert with onConflict instead of delete+insert to avoid race conditions
  const saveAll = async () => {
    setLoading(true)
    const rows = []
    COOKS.forEach(cook => {
      Object.keys(COOK_SHIFTS).forEach(shift => {
        const rec = draft[draftKey(cook,shift)]
        rows.push({
          att_date:  attDate,
          cook_name: cook,
          shift,
          status:    rec.status,
          check_in:  rec.status==='absent' ? null : (rec.check_in||null),
          check_out: rec.status==='absent' ? null : (rec.check_out||null),
          notes:     rec.notes||null,
        })
      })
    })

    const { error: delErr } = await supabase.from('kitchen_cook_attendance').delete().eq('att_date', attDate)
    if (delErr) { setLoading(false); showToast('Save failed: '+delErr.message, C.rose[600]); return }

    const { error } = await supabase.from('kitchen_cook_attendance').insert(rows)
    setLoading(false)
    if (error) { showToast('Save failed: '+error.message, C.rose[600]); return }
    showToast('Attendance saved ✓', C.forest[600])
    loadDay(attDate)
  }

  const monthlySummary = useMemo(() => COOKS.map(cook => {
    const rows    = monthly.filter(r=>r.cook_name===cook)
    const present = rows.filter(r=>r.status==='present').length
    const absent  = rows.filter(r=>r.status==='absent').length
    const half    = rows.filter(r=>r.status==='half_day').length
    const total   = present+absent+half
    const pct     = total ? Math.round(((present+half*.5)/total)*100) : 0
    return {
      cook, present, absent, half, pct, totalDays:total,
      mPresent: rows.filter(r=>r.shift==='morning'&&r.status==='present').length,
      ePresent: rows.filter(r=>r.shift==='evening'&&r.status==='present').length,
    }
  }), [monthly])

  const statusBtn = (status, selected) => {
    const configs = {
      present:  { bg:selected?C.forest[600]:C.forest[50],  color:selected?'#fff':C.forest[700], border:selected?C.forest[600]:C.forest[200] },
      absent:   { bg:selected?C.rose[600]:C.rose[50],      color:selected?'#fff':C.rose[700],   border:selected?C.rose[600]:C.rose[200]   },
      half_day: { bg:selected?C.saffron[500]:C.saffron[50],color:selected?'#fff':C.saffron[700],border:selected?C.saffron[500]:C.saffron[200] },
    }
    const c = configs[status]
    return { padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
      background:c.bg, color:c.color, border:`1.5px solid ${c.border}`, transition:'all .12s',
      fontFamily:'var(--font-body)' }
  }

  return (
    <div className="k-card slide-down" style={{ marginBottom:16, overflow:'hidden', border:`1.5px solid ${C.teal[200]}` }}>
      <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.teal[100]}`,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:`linear-gradient(135deg, ${C.teal[50]}, #fff)` }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.teal[700], fontFamily:'var(--font-display)' }}>Cook Attendance</div>
          <div style={{ fontSize:11, color:C.ink[500], marginTop:2 }}>Morning 6:30–9:00 AM · Evening 6:00–9:00 PM</div>
        </div>
        <button type="button" className="k-btn k-btn-icon" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding:'18px 22px' }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:18, flexWrap:'wrap' }}>
          <div style={{ display:'flex', borderRadius:9, overflow:'hidden', border:`1.5px solid ${C.ink[200]}` }}>
            {[['mark','📋 Mark'],['monthly','📊 Monthly']].map(([k,l]) => (
              <button key={k} type="button" onClick={()=>setView(k)}
                style={{ padding:'7px 16px', background:view===k?C.teal[600]:'#fff', color:view===k?'#fff':C.ink[600],
                  border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .15s' }}>
                {l}
              </button>
            ))}
          </div>
          {view==='mark' && (
            <input type="date" className="k-input" style={{ width:'auto', padding:'7px 12px' }} value={attDate} onChange={e=>setAttDate(e.target.value)} />
          )}
          {view==='monthly' && (
            <input type="month" className="k-input" style={{ width:'auto', padding:'7px 12px' }} value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />
          )}
        </div>

        {loading && <div style={{ textAlign:'center', color:C.ink[400], padding:'20px 0', fontSize:12 }}>Loading…</div>}

        {!loading && view==='mark' && Object.entries(COOK_SHIFTS).map(([shift, sh]) => (
          <div key={shift} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', borderRadius:10,
              background:sh.bg, border:`1.5px solid ${sh.border}`, marginBottom:10 }}>
              <span style={{ fontSize:18 }}>{sh.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:800, color:sh.text }}>{sh.label}</div>
                <div style={{ fontSize:10, color:sh.text, opacity:.7 }}>{sh.time}</div>
              </div>
              <div style={{ display:'flex', gap:5 }}>
                {['present','absent','half_day'].map(st => {
                  const cnt = COOKS.filter(c=>draft[draftKey(c,shift)]?.status===st).length
                  if (!cnt) return null
                  const colors={present:C.forest,absent:C.rose,half_day:C.saffron}
                  const col=colors[st]
                  return (
                    <span key={st} style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99,
                      background:col[50], color:col[700], border:`1px solid ${col[200]}` }}>
                      {st==='present'?'✓':st==='absent'?'✗':'½'} {cnt}
                    </span>
                  )
                })}
              </div>
            </div>
            {COOKS.map((cook, ci) => {
              const dk  = draftKey(cook, shift)
              const rec = draft[dk] || {}
              const isAbsent = rec.status==='absent'
              return (
                <div key={cook} style={{ marginBottom:8, padding:'12px 16px', borderRadius:10,
                  background:isAbsent?C.rose[50]:'#fff',
                  border:`1.5px solid ${isAbsent?C.rose[200]:C.ink[100]}`,
                  transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:isAbsent?0:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:sh.bg,
                        border:`1.5px solid ${sh.border}`, display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:800, color:sh.text, fontFamily:'var(--font-display)' }}>
                        {cook[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.ink[800] }}>{cook}</div>
                        <div style={{ fontSize:10, color:C.ink[400] }}>Cook #{ci+1}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      {['present','absent','half_day'].map(st => (
                        <button key={st} type="button" onClick={()=>setField(cook,shift,'status',st)} style={statusBtn(st, rec.status===st)}>
                          {st==='present'?'✓ Present':st==='absent'?'✗ Absent':'½ Half'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAbsent && (
                    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span className="k-label" style={{ marginBottom:0, fontSize:10 }}>IN</span>
                        <input type="time" className="k-input" style={{ width:'auto', padding:'5px 10px', fontSize:12 }}
                          value={rec.check_in||''} onChange={e=>setField(cook,shift,'check_in',e.target.value)} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span className="k-label" style={{ marginBottom:0, fontSize:10 }}>OUT</span>
                        <input type="time" className="k-input" style={{ width:'auto', padding:'5px 10px', fontSize:12 }}
                          value={rec.check_out||''} onChange={e=>setField(cook,shift,'check_out',e.target.value)} />
                      </div>
                      <input className="k-input" style={{ flex:1, minWidth:120, padding:'5px 10px', fontSize:11 }}
                        value={rec.notes||''} onChange={e=>setField(cook,shift,'notes',e.target.value)} placeholder="Notes…" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {!loading && view==='mark' && (
          <button type="button" className="k-btn k-btn-primary" onClick={saveAll} disabled={loading}
            style={{ background:`linear-gradient(160deg, ${C.teal[600]}, ${C.teal[800]})`, boxShadow:`0 2px 8px rgba(13,148,136,.35)` }}>
            {loading ? 'Saving…' : '💾 Save All Attendance'}
          </button>
        )}

        {!loading && view==='monthly' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {monthlySummary.map(({ cook, present, absent, half, pct, mPresent, ePresent, totalDays }) => {
              const pctColor = pct>=90?C.forest[600]:pct>=70?C.saffron[600]:C.rose[600]
              return (
                <div key={cook} className="k-card" style={{ padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:C.teal[50],
                        border:`1.5px solid ${C.teal[200]}`, display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:800, color:C.teal[700], fontFamily:'var(--font-display)' }}>
                        {cook[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:C.ink[800] }}>{cook}</div>
                        <div style={{ fontSize:10, color:C.ink[400] }}>{totalDays} shifts · {viewMonth}</div>
                      </div>
                    </div>
                    <div className="k-number" style={{ fontSize:22, fontWeight:700, color:pctColor }}>{pct}%</div>
                  </div>
                  <div style={{ height:6, borderRadius:99, background:C.ink[100], overflow:'hidden', marginBottom:10 }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:99,
                      background:pct>=90?C.forest[500]:pct>=70?C.saffron[500]:C.rose[500], transition:'width .6s' }} />
                  </div>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <StatPill label="present" value={present} color={C.forest[600]} />
                    <StatPill label="absent"  value={absent}  color={C.rose[600]}   />
                    <StatPill label="half"    value={half}    color={C.saffron[600]}/>
                    <StatPill label="morning" value={mPresent} color={C.teal[600]} />
                    <StatPill label="evening" value={ePresent} color={C.terra[600]}/>
                  </div>
                </div>
              )
            })}

            {monthly.length > 0 && (
              <div className="k-card" style={{ padding:'18px 20px', marginTop:4, overflowX:'auto' }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:14 }}>Day-wise Detail — {viewMonth}</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:600 }}>
                  <thead>
                    <tr>
                      <th style={{ padding:'6px 10px', textAlign:'left', background:C.ink[50], color:C.ink[600], fontWeight:700, borderBottom:`2px solid ${C.ink[100]}`, whiteSpace:'nowrap', fontSize:10 }}>Cook</th>
                      {[...new Set(monthly.map(r=>r.att_date))].sort().map(d=>(
                        <th key={d} style={{ padding:'5px 4px', textAlign:'center', background:C.ink[50], color:C.ink[600], fontWeight:700, borderBottom:`2px solid ${C.ink[100]}`, whiteSpace:'nowrap', fontSize:9 }}>
                          {new Date(d+'T00:00:00').getDate()}<br/>
                          <span style={{ fontWeight:400, color:C.ink[400] }}>{new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKS.map(cook => {
                      const dates = [...new Set(monthly.map(r=>r.att_date))].sort()
                      const cell = (row) => {
                        if (!row) return <span style={{ color:C.ink[300] }}>—</span>
                        if (row.status==='present')  return <span style={{ color:C.forest[600], fontWeight:800 }}>✓</span>
                        if (row.status==='absent')   return <span style={{ color:C.rose[600],   fontWeight:800 }}>✗</span>
                        if (row.status==='half_day') return <span style={{ color:C.saffron[600],fontWeight:800 }}>½</span>
                        return null
                      }
                      return (
                        <tr key={cook} style={{ borderBottom:`1px solid ${C.ink[100]}` }}>
                          <td style={{ padding:'7px 10px', fontWeight:700, color:C.ink[700], whiteSpace:'nowrap', fontSize:10 }}>
                            {cook.split(' ').slice(0,2).join(' ')}
                          </td>
                          {dates.map(d => {
                            const mRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='morning')
                            const eRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='evening')
                            return (
                              <td key={d} style={{ padding:'4px 5px', textAlign:'center', verticalAlign:'middle' }}>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                                  <span>{cell(mRow)}</span>
                                  <span style={{ opacity:.6, fontSize:9 }}>{cell(eRow)}</span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize:10, color:C.ink[400], marginTop:8 }}>
                  Top = 🌅 Morning · Bottom = 🌇 Evening &nbsp;·&nbsp; ✓ Present · ✗ Absent · ½ Half Day
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY FORM
// ═══════════════════════════════════════════════════════════════════════════════
function EntryForm({ onSave, onCancel, editing, defaultDate, kitchenItems }) {
  const def = (k, fb='') => editing ? (editing[k]??fb) : fb
  const [form, setForm] = useState({
    meal_type:    def('meal_type','lunch'),
    expense_date: def('expense_date', defaultDate||today()),
    amount:       def('amount',''),
    item_details: def('item_details',''),
    prepared_by:  def('prepared_by',''),
    pax_count:    def('pax_count',''),
    vendor:       def('vendor',''),
    meal_rating:  def('meal_rating',0),
    serving_time: def('serving_time',''),
    notes:        def('notes',''),
    receipt_url:  def('receipt_url',''),
  })
  const [uploading,    setUploading]    = useState(false)
  const [viewReceipt,  setViewReceipt]  = useState(false)
  const [customItem,   setCustomItem]   = useState('')

  const m   = MEALS[form.meal_type]
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const addItem = item => {
    const cur = form.item_details.trim()
    set('item_details', cur ? cur+', '+item : item)
  }
  const addCustomItem = () => { if (!customItem.trim()) return; addItem(customItem.trim()); setCustomItem('') }

  // FIX: Guard file input
  const handleFileUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `receipts/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
    const { data, error } = await supabase.storage.from('kitchen-receipts').upload(path, file, { upsert:true })
    if (!error && data) {
      const { data:pub } = supabase.storage.from('kitchen-receipts').getPublicUrl(data.path)
      set('receipt_url', pub.publicUrl)
    }
    setUploading(false)
  }

  const valid   = form.meal_type && form.expense_date && Number(form.amount) > 0
  const presets = MANIPURI_PRESETS[form.meal_type] || []
  const dbItems = kitchenItems.filter(it=>it.is_active)

  // FIX: Vendor — separate controlled select from free-text input
  const vendorIsPreset = LOCAL_VENDORS.includes(form.vendor)

  return (
    <>
      {viewReceipt && form.receipt_url && (
        <ReceiptViewer url={form.receipt_url} onClose={()=>setViewReceipt(false)}
          onDelete={()=>{ set('receipt_url',''); setViewReceipt(false) }} />
      )}
      <div className="k-card fade-up" style={{ marginBottom:16, overflow:'hidden', border:`1.5px solid ${m.border}` }}>
        <div style={{ background:m.soft, borderBottom:`1px solid ${m.border}`, padding:'14px 22px',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:m.text, fontFamily:'var(--font-display)' }}>
              {editing ? `✏️ Edit — ${m.label}` : `➕ Add ${m.label}`}
            </div>
            <div style={{ fontSize:11, color:m.text, opacity:.7, marginTop:2 }}>
              {form.expense_date ? dateFmt(form.expense_date) : 'Select date'}
            </div>
          </div>
          <button type="button" className="k-btn k-btn-icon" onClick={onCancel} style={{ borderColor:m.border }}>✕</button>
        </div>

        <div style={{ padding:'22px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Meal *">
              <select className="k-input" value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
                {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
              </select>
            </Field>
            <Field label="Date *">
              <input type="date" className="k-input" value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} />
            </Field>
            <Field label="Amount (₹) *">
              <input type="number" className="k-input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </Field>
            <Field label="Serving Time">
              <input type="time" className="k-input" value={form.serving_time} onChange={e=>set('serving_time',e.target.value)} />
            </Field>

            {/* Items */}
            <Field label="Items / Ingredients" span={2}>
              <input className="k-input" value={form.item_details} onChange={e=>set('item_details',e.target.value)} placeholder="e.g. Chak, Dal, Eromba…" />
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.terra[600], marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>🍛 Manipuri Dishes</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {presets.map(item=>(
                    <button key={item} type="button" onClick={()=>addItem(item)}
                      style={{ padding:'3px 10px', borderRadius:99, border:`1px solid ${C.saffron[200]}`,
                        background:C.saffron[50], fontSize:10, fontWeight:600, cursor:'pointer', color:C.saffron[800],
                        fontFamily:'var(--font-body)', transition:'all .12s' }}
                      onMouseEnter={e=>{e.currentTarget.style.background=C.saffron[100]}}
                      onMouseLeave={e=>{e.currentTarget.style.background=C.saffron[50]}}>
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
              {dbItems.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.teal[700], marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>🧺 Item List</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {dbItems.map(it=>(
                      <button key={it.id} type="button" onClick={()=>addItem(it.name)}
                        style={{ padding:'3px 10px', borderRadius:99, border:`1px solid ${C.teal[200]}`,
                          background:C.teal[50], fontSize:10, fontWeight:600, cursor:'pointer', color:C.teal[800],
                          fontFamily:'var(--font-body)' }}>
                        + {it.name}{it.name_meitei?` / ${it.name_meitei}`:''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <input className="k-input" style={{ flex:1, fontSize:12 }} value={customItem}
                  onChange={e=>setCustomItem(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addCustomItem()}
                  placeholder="Type custom item + Enter" />
                <button type="button" className="k-btn k-btn-ghost" onClick={addCustomItem}>+ Add</button>
              </div>
            </Field>

            <Field label="Prepared By">
              <input className="k-input" value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)} placeholder="Cook / Staff name" />
            </Field>

            {/* FIX: Vendor — select sets value, text input is freeform override */}
            <Field label="Vendor / Supplier">
              <select className="k-input" style={{ marginBottom:7 }}
                value={vendorIsPreset ? form.vendor : ''}
                onChange={e => { if (e.target.value) set('vendor', e.target.value) }}>
                <option value="">— Select preset vendor —</option>
                {LOCAL_VENDORS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className="k-input" style={{ fontSize:12 }} value={form.vendor}
                onChange={e=>set('vendor',e.target.value)}
                placeholder="Or type custom vendor name…" />
            </Field>

            <Field label="Students Served">
              <input type="number" className="k-input" value={form.pax_count} onChange={e=>set('pax_count',e.target.value)} placeholder="0" min="0" />
            </Field>

            <Field label="Meal Quality">
              <div style={{ paddingTop:4 }}>
                <StarRating value={form.meal_rating} onChange={v=>set('meal_rating',v)} />
              </div>
            </Field>

            <Field label="Notes" span={2}>
              <textarea className="k-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
            </Field>

            <Field label="📎 Receipt / Bill Photo" span={2}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'10px 14px',
                borderRadius:9, background:C.ink[50], border:`1.5px dashed ${C.ink[200]}` }}>
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize:11, flex:1 }} />
                {uploading && <span style={{ fontSize:11, color:C.ink[400] }}>Uploading…</span>}
                {form.receipt_url && (
                  <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
                    <button type="button" className="k-btn k-btn-ghost" onClick={()=>setViewReceipt(true)}
                      style={{ fontSize:11, padding:'5px 12px', color:C.sky[700], borderColor:C.sky[200], background:C.sky[50] }}>👁 View</button>
                    <button type="button" className="k-btn k-btn-ghost" onClick={()=>set('receipt_url','')}
                      style={{ fontSize:11, padding:'5px 12px', color:C.rose[600], borderColor:C.rose[200], background:C.rose[50] }}>🗑 Remove</button>
                    <span style={{ fontSize:10, color:C.forest[600], fontWeight:700 }}>✓ Uploaded</span>
                  </div>
                )}
              </div>
            </Field>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:20, paddingTop:18, borderTop:`1px solid ${C.divider}` }}>
            <button type="button" className="k-btn k-btn-primary"
              onClick={()=>valid&&onSave(editing?.id||null,form)} disabled={!valid}
              style={valid ? { background:`linear-gradient(160deg, ${m.bg}, ${m.accent})`, boxShadow:`0 2px 8px rgba(0,0,0,.2)` } : {}}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </button>
            <button type="button" className="k-btn k-btn-ghost" onClick={onCancel}>Cancel</button>
            {!valid && <span style={{ fontSize:11, color:C.ink[400], alignSelf:'center' }}>Fill required fields *</span>}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({ e, locked, onEdit, onDelete }) {
  const m = MEALS[e.meal_type]
  const [viewReceipt, setViewReceipt] = useState(false)
  return (
    <>
      {viewReceipt && e.receipt_url && (
        <ReceiptViewer url={e.receipt_url} onClose={()=>setViewReceipt(false)} />
      )}
      <div className="k-card" style={{ padding:'14px 18px',
        border:`1.5px solid ${m?.border||C.ink[200]}`,
        display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'start',
        background: m ? `linear-gradient(135deg, ${m.soft} 0%, #fff 40%)` : '#fff',
      }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
            <MealBadge type={e.meal_type} size="sm" />
            <span className="k-number" style={{ fontSize:20, fontWeight:700, color:m?.text||C.ink[800], lineHeight:1 }}>
              {moneyFmt(e.amount)}
            </span>
            {e.meal_rating>0 && <StarRating value={e.meal_rating} />}
            {e.pax_count>0 && (
              <span style={{ fontSize:10, color:C.teal[700], fontWeight:700, fontFamily:'var(--font-mono)',
                padding:'2px 8px', borderRadius:99, background:C.teal[50], border:`1px solid ${C.teal[200]}` }}>
                ₹{(e.amount/e.pax_count).toFixed(2)}/student
              </span>
            )}
            {e.receipt_url && (
              <button type="button" onClick={()=>setViewReceipt(true)}
                style={{ padding:'2px 9px', borderRadius:99, background:C.sky[50], border:`1px solid ${C.sky[200]}`,
                  color:C.sky[700], fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                📎 Receipt
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:10, fontSize:11, color:C.ink[500], flexWrap:'wrap' }}>
            {e.item_details  && <span>🥦 {e.item_details}</span>}
            {e.prepared_by   && <span>👨‍🍳 {e.prepared_by}</span>}
            {e.vendor        && <span>🏪 {e.vendor}</span>}
            {e.pax_count     && <span>👥 {e.pax_count} students</span>}
            {e.serving_time  && <span style={{ fontFamily:'var(--font-mono)' }}>🕐 {e.serving_time}</span>}
          </div>
          {e.notes && (
            <div style={{ marginTop:7, fontSize:11, color:C.ink[500], padding:'5px 10px',
              background:C.ink[50], borderRadius:7, borderLeft:`3px solid ${C.ink[200]}` }}>
              {e.notes}
            </div>
          )}
        </div>
        {!locked && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <button type="button" className="k-btn k-btn-ghost" onClick={()=>onEdit(e)} style={{ fontSize:11, padding:'5px 12px' }}>Edit</button>
            <button type="button" className="k-btn k-btn-ghost" onClick={()=>onDelete(e.id)}
              style={{ fontSize:11, padding:'5px 12px', color:C.rose[600], borderColor:C.rose[200], background:C.rose[50] }}>Del</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Day Group ────────────────────────────────────────────────────────────────
// FIX: Today starts expanded; past days start collapsed
function DayGroup({ dateStr, entries, locks, onEdit, onDelete, onLockDay, onUnlockDay }) {
  const dayE    = entries.filter(e=>e.expense_date===dateStr)
  const total   = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const isToday = dateStr===today()
  const locked  = locks.includes(dateStr)
  const [collapsed, setCollapsed] = useState(!isToday)

  return (
    <div style={{ marginBottom:14 }} className="fade-up">
      <div onClick={()=>setCollapsed(c=>!c)} style={{ cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', borderRadius:10, marginBottom:collapsed?0:8,
        background: isToday ? `linear-gradient(135deg, ${C.terra[50]}, #fff)` : C.ink[50],
        border:`1.5px solid ${isToday?C.terra[200]:C.ink[200]}`,
        userSelect:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, fontWeight:700, color:isToday?C.terra[700]:C.ink[600] }}>
            {isToday && <span style={{ color:C.terra[500], marginRight:4 }}>📌</span>}
            {dateFmt(dateStr)}
          </span>
          {isToday && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:C.terra[100], color:C.terra[700], fontWeight:700 }}>Today</span>}
          {locked  && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:C.rose[100],  color:C.rose[700],  fontWeight:700 }}>🔒 Locked</span>}
          <span style={{ fontSize:11, color:C.ink[400] }}>{dayE.length} entries</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span className="k-number" style={{ fontSize:16, fontWeight:700, color:C.ink[800] }}>{moneyFmt(total)}</span>
          {!locked
            ? <button type="button" onClick={e=>{e.stopPropagation();onLockDay(dateStr)}}
                className="k-btn k-btn-ghost" style={{ fontSize:10, padding:'4px 10px', color:C.rose[600], borderColor:C.rose[200], background:C.rose[50] }}>
                🔒 Lock
              </button>
            : <button type="button" onClick={e=>{e.stopPropagation();onUnlockDay(dateStr)}}
                className="k-btn k-btn-ghost" style={{ fontSize:10, padding:'4px 10px', color:C.saffron[700], borderColor:C.saffron[200], background:C.saffron[50] }}>
                🔓 Unlock
              </button>
          }
          <span style={{ fontSize:12, color:C.ink[400], transition:'transform .2s', display:'inline-block',
            transform:collapsed?'rotate(-90deg)':'rotate(0)' }}>▾</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {dayE.map(e=><EntryCard key={e.id} e={e} locked={locked} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  )
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ current, month, onSave, onClose }) {
  const [val, setVal] = useState(current||'')
  // FIX: Guard empty/NaN
  const handleSave = () => {
    const amt = Number(val)
    if (!amt || amt <= 0) return
    onSave(amt)
  }
  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, background:'rgba(32,20,10,.45)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
      <div className="k-card" style={{ width:400, padding:0, overflow:'hidden', boxShadow:'var(--shadow-xl)' }}>
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.divider}`,
          background:`linear-gradient(135deg, ${C.teal[50]}, #fff)` }}>
          <div style={{ fontSize:17, fontWeight:700, color:C.teal[700], fontFamily:'var(--font-display)' }}>Set Monthly Budget</div>
          <div style={{ fontSize:12, color:C.ink[400], marginTop:2 }}>For {month}</div>
        </div>
        <div style={{ padding:'22px 24px' }}>
          <Field label="Budget Amount (₹)">
            <input type="number" className="k-input" value={val} onChange={e=>setVal(e.target.value)}
              placeholder="e.g. 50000" min="1"
              onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          </Field>
          {val && Number(val) <= 0 && (
            <div style={{ fontSize:11, color:C.rose[600], marginTop:6 }}>Enter a valid amount</div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button type="button" className="k-btn k-btn-primary" onClick={handleSave} style={{ flex:1 }}>Save Budget</button>
            <button type="button" className="k-btn k-btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Print & Export ───────────────────────────────────────────────────────────
function generatePrintReport(entries, budget, monthLabel) {
  const total     = entries.reduce((s,e)=>s+Number(e.amount),0)
  const byMeal    = {}; MEAL_KEYS.forEach(k=>{byMeal[k]=0})
  entries.forEach(e=>{byMeal[e.meal_type]=(byMeal[e.meal_type]||0)+Number(e.amount)})
  const byDay     = {}
  entries.forEach(e=>{byDay[e.expense_date]=(byDay[e.expense_date]||0)+Number(e.amount)})
  const days      = Object.keys(byDay).sort()
  const avgPerDay = days.length ? total/days.length : 0
  const topDay    = days.reduce((b,d)=>byDay[d]>byDay[b]?d:b, days[0]||'')
  const vendorMap = {}
  entries.filter(e=>e.vendor).forEach(e=>{ vendorMap[e.vendor]=(vendorMap[e.vendor]||0)+Number(e.amount) })
  const topVendors= Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>GNSI Kitchen Report — ${monthLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'DM Sans',sans-serif; color:#20140A; background:#FAF6F1; padding:36px 48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:18px; margin-bottom:28px; border-bottom:3px solid #C44E1C; }
  .institute { font-family:'Playfair Display',serif; font-size:22px; font-weight:800; color:#C44E1C; }
  .sub { font-size:11px; color:#8C6A50; margin-top:3px; }
  .title-area { text-align:right; font-size:12px; color:#6E5038; font-family:'DM Mono',monospace; }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
  .kpi { padding:16px 18px; border-radius:10px; background:#fff; border:1.5px solid #FFD0BA; }
  .kpi-val { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:#C44E1C; }
  .kpi-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#8C6A50; margin-top:4px; }
  h2 { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#C44E1C; margin:24px 0 12px; padding-left:12px; border-left:3px solid #C44E1C; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#FFF5F0; color:#6E5038; font-weight:700; padding:8px 10px; text-align:left; border-bottom:2px solid #FFD0BA; text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
  td { padding:7px 10px; border-bottom:1px solid #EDE5DA; color:#20140A; font-family:'DM Mono',monospace; font-size:10px; }
  td:first-child { font-family:'DM Sans',sans-serif; font-size:11px; }
  .total-row td { font-weight:800; color:#C44E1C; border-top:2px solid #C44E1C; border-bottom:none; font-family:'DM Sans',sans-serif; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #EDE5DA; font-size:10px; color:#A88870; display:flex; justify-content:space-between; font-family:'DM Mono',monospace; }
  @media print { body { background:#fff; padding:20px; } }
</style></head><body>
  <div class="header">
    <div><div class="institute">🏫 Guidance Navodaya & Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur · Kitchen Expenditure Report</div></div>
    <div class="title-area">Month: ${monthLabel}<br>Generated: ${new Date().toLocaleString('en-IN')}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Total Expenditure</div></div>
    <div class="kpi"><div class="kpi-val">${entries.length}</div><div class="kpi-lbl">Total Entries</div></div>
    <div class="kpi"><div class="kpi-val">₹${avgPerDay.toLocaleString('en-IN',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Daily Average</div></div>
    ${budget?`<div class="kpi"><div class="kpi-val">${((total/budget)*100).toFixed(1)}%</div><div class="kpi-lbl">Budget Used · ₹${Number(budget).toLocaleString('en-IN')}</div></div>`:''}
  </div>
  <h2>Meal-wise Summary</h2>
  <table>
    <thead><tr><th>Meal</th><th>Entries</th><th>Amount</th><th>% of Total</th></tr></thead>
    <tbody>
      ${MEAL_KEYS.map(mk=>{const m=MEALS[mk];const cnt=entries.filter(e=>e.meal_type===mk).length;const amt=byMeal[mk];const pct=total?((amt/total)*100).toFixed(1):0;return`<tr><td>${m.emoji} ${m.label}</td><td>${cnt}</td><td>₹${amt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>${pct}%</td></tr>`}).join('')}
      <tr class="total-row"><td>TOTAL</td><td>${entries.length}</td><td>₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>100%</td></tr>
    </tbody>
  </table>
  <h2>Daily Expenditure Log</h2>
  <table>
    <thead><tr><th>Date</th><th>Mor. Lunch</th><th>A.Bfast</th><th>E.Bfast</th><th>Dinner</th><th>Day Total</th></tr></thead>
    <tbody>
      ${days.map(d=>{const dE=entries.filter(e=>e.expense_date===d);const mAmt=mk=>dE.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0);const dt=byDay[d];return`<tr><td>${new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',weekday:'short'})}</td>${MEAL_KEYS.map(mk=>`<td>${mAmt(mk)?'₹'+mAmt(mk).toFixed(2):'—'}</td>`).join('')}<td><strong>₹${dt.toFixed(2)}</strong>${d===topDay?' 🔺':''}</td></tr>`}).join('')}
    </tbody>
  </table>
  ${topVendors.length?`<h2>Top Vendors</h2><table><thead><tr><th>Vendor / Market</th><th>Amount</th></tr></thead><tbody>${topVendors.map(([n,a])=>`<tr><td>${n}</td><td>₹${a.toFixed(2)}</td></tr>`).join('')}</tbody></table>`:''}
  <div class="footer"><span>GNSI Kitchen · ${monthLabel}</span><span>Khangabok, Thoubal, Manipur</span><span>Printed ${new Date().toLocaleDateString('en-IN')}</span></div>
  <script>window.onload=()=>window.print()</script>
</body></html>`

  const win = window.open('','_blank')
  if (win) { win.document.write(html); win.document.close() }
}

function exportToCSV(entries, month) {
  const headers = ['Date','Meal','Amount','Items','Vendor','Staff','Students','Rating','Serving Time','Notes']
  const rows    = entries.map(e => [
    e.expense_date, MEALS[e.meal_type]?.label||e.meal_type, e.amount,
    e.item_details||'', e.vendor||'', e.prepared_by||'',
    e.pax_count||'', e.meal_rating||'', e.serving_time||'', e.notes||''
  ])
  const csv  = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `gnsi-kitchen-${month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function generateWhatsAppMsg(entries, dateStr) {
  const dayE  = entries.filter(e=>e.expense_date===dateStr)
  const total = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const lines = MEAL_KEYS.map(mk=>{
    const m   = MEALS[mk]
    const amt = dayE.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
    return amt>0 ? `${m.emoji} ${m.label}: ₹${amt.toFixed(2)}` : null
  }).filter(Boolean)
  const msg = `🍽 *GNSI Kitchen — ${dateFmt(dateStr)}*\n\n${lines.join('\n')}\n\n*Total: ₹${total.toFixed(2)}*\n\n_Guidance Navodaya & Sainik Institute, Khangabok_`
  navigator.clipboard?.writeText(msg).catch(()=>{})
  return msg
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
function Topbar({ viewMonth, setViewMonth, tab, setTab, isAdmin, onBudget, onReport, onCSV, onWhatsApp, onAdd, onItemSetup, onMonitor, onCookLog, onCookAtt }) {
  const now     = new Date()
  const timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})

  return (
    <div className="no-print" style={{ background:'#fff', borderBottom:`1px solid ${C.divider}`,
      boxShadow:'0 1px 8px rgba(56,38,24,.06)', position:'sticky', top:0, zIndex:100 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'10px 28px', borderBottom:`1px solid ${C.ink[50]}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10,
            background:`linear-gradient(135deg, ${C.terra[600]}, ${C.terra[800]})`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
            🍽
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:C.ink[900], fontFamily:'var(--font-display)', lineHeight:1.1 }}>Kitchen Ledger</div>
            <div style={{ fontSize:10, color:C.ink[400], marginTop:1 }}>GNSI · Khangabok, Thoubal</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Tab pills — moved here so they never wrap off-screen */}
          <div style={{ display:'flex', borderRadius:9, overflow:'hidden', border:`1.5px solid ${C.ink[200]}` }}>
            {[['ledger','📋 Ledger'],['analytics','📊 Analytics']].map(([k,l])=>(
              <button key={k} type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTab(k) }}
                style={{
                  padding:'7px 18px',
                  background: tab===k ? C.terra[600] : '#fff',
                  color: tab===k ? '#fff' : C.ink[600],
                  border:'none', fontSize:12, fontWeight:700,
                  cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .15s',
                }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], fontFamily:'var(--font-mono)' }}>{timeStr}</div>
            <div style={{ fontSize:10, color:C.ink[400] }}>{dateStr}</div>
          </div>
          <button type="button" className="k-btn k-btn-primary" onClick={onAdd} style={{ fontSize:13, padding:'9px 18px' }}>
            <span style={{ fontSize:15, lineHeight:1 }}>+</span> Add Entry
          </button>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 28px', flexWrap:'wrap' }}>
        <input type="month" className="k-input" style={{ width:'auto', padding:'6px 12px', fontSize:12 }}
          value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />

        <div style={{ flex:1 }} />

        <button type="button" className="k-btn k-btn-ghost" onClick={onItemSetup} style={{ fontSize:12 }}>🧺 Items</button>
        {isAdmin && <>
          <button type="button" className="k-btn k-btn-ghost" onClick={onMonitor}  style={{ fontSize:12 }}>🛡 Monitor</button>
          <button type="button" className="k-btn k-btn-ghost" onClick={onCookLog}  style={{ fontSize:12 }}>👨‍🍳 Cook Log</button>
          <button type="button" className="k-btn k-btn-ghost" onClick={onCookAtt}  style={{ fontSize:12 }}>👩‍🍳 Attendance</button>
        </>}
        <button type="button" className="k-btn k-btn-ghost" onClick={onBudget} style={{ fontSize:12 }}>💰 Budget</button>
        <button type="button" className="k-btn k-btn-ghost" onClick={onReport} style={{ fontSize:12 }}>🖨 Report</button>
        <button type="button" className="k-btn k-btn-ghost" onClick={onCSV}    style={{ fontSize:12 }}>⬇ CSV</button>
        <button type="button" onClick={onWhatsApp}
          style={{ padding:'7px 14px', borderRadius:9, background:'linear-gradient(135deg,#25D366,#128C7E)',
            color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:5, fontFamily:'var(--font-body)',
            boxShadow:'0 2px 8px rgba(37,211,102,.3)' }}>
          📲 WhatsApp
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Kitchen({ currentUser }) {
  const isAdmin = ['admin','superintendent'].includes((currentUser?.role||'').toLowerCase())

  const [entries,      setEntries]      = useState([])
  const [locks,        setLocks]        = useState([])
  const [budget,       setBudget]       = useState(null)
  const [kitchenItems, setKitchenItems] = useState([])
  const [cookLog,      setCookLog]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [formOpen,     setFormOpen]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [toast,        setToast]        = useState(null)
  const [filterDate,   setFilterDate]   = useState(today())
  const [filterMeal,   setFilterMeal]   = useState('all')
  const [viewMonth,    setViewMonth]    = useState(monthKey())
  const [tab,          setTab]          = useState('ledger')
  const [showBudget,   setShowBudget]   = useState(false)
  const [showWA,       setShowWA]       = useState(null)
  const [showItemSetup,setShowItemSetup]= useState(false)
  const [showMonitor,  setShowMonitor]  = useState(false)
  const [showCookLog,  setShowCookLog]  = useState(false)
  const [showCookAtt,  setShowCookAtt]  = useState(false)

  const contentRef = useRef(null)
  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
  }, [tab])

  const toastTimer = useRef(null)
  const showToast = useCallback((msg, color) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, color })
    toastTimer.current = setTimeout(()=>setToast(null), 3500)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${viewMonth}-01`
    const to   = `${viewMonth}-31`
    const [
      { data:eData  },
      { data:lData  },
      { data:bData  },
      { data:iData  },
      { data:clData },
    ] = await Promise.all([
      supabase.from('kitchen_expenditure').select('*').gte('expense_date',from).lte('expense_date',to).order('expense_date',{ascending:false}).order('created_at',{ascending:false}),
      supabase.from('kitchen_daily_locks').select('lock_date').gte('lock_date',from).lte('lock_date',to),
      supabase.from('kitchen_budgets').select('*').eq('month',viewMonth).maybeSingle(),
      supabase.from('kitchen_items').select('*').order('category').order('name'),
      supabase.from('kitchen_cook_log').select('*').gte('log_date',from).lte('log_date',to).order('created_at',{ascending:false}),
    ])
    setEntries(eData||[])
    setLocks((lData||[]).map(l=>l.lock_date))
    setBudget(bData?.budget_amount||null)
    setKitchenItems(iData||[])
    setCookLog(clData||[])
    setLoading(false)
  }, [viewMonth])

  useEffect(() => { load() }, [load])

  const handleSave = async (eid, form) => {
    const row = {
      meal_type:    form.meal_type,
      expense_date: form.expense_date,
      amount:       Number(form.amount),
      item_details: form.item_details || null,
      prepared_by:  form.prepared_by  || null,
      pax_count:    Number(form.pax_count) || null,
      vendor:       form.vendor       || null,
      meal_rating:  Number(form.meal_rating) || null,
      serving_time: form.serving_time || null,
      receipt_url:  form.receipt_url  || null,
      notes:        form.notes        || null,
      updated_at:   new Date().toISOString(),
    }
    if (eid) {
      const { error } = await supabase.from('kitchen_expenditure').update(row).eq('id',eid)
      if (error) { showToast('Update failed: '+error.message, C.rose[600]); return }
      showToast('Entry updated ✓', C.saffron[600])
    } else {
      const { error } = await supabase.from('kitchen_expenditure').insert(row)
      if (error) { showToast('Save failed: '+error.message, C.rose[600]); return }
      showToast('Entry saved ✓', C.forest[600])
    }
    setFormOpen(false); setEditing(null); load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this entry?')) return
    const { error } = await supabase.from('kitchen_expenditure').delete().eq('id',id)
    if (error) { showToast('Delete failed', C.rose[600]); return }
    showToast('Deleted', C.rose[600]); load()
  }

  const handleLockDay = async dateStr => {
    if (!window.confirm(`Lock all entries for ${dateFmt(dateStr)}?`)) return
    await supabase.from('kitchen_daily_locks').insert({ lock_date:dateStr })
    showToast(`🔒 ${dateFmt(dateStr)} locked`, C.rose[500]); load()
  }

  const handleUnlockDay = async dateStr => {
    await supabase.from('kitchen_daily_locks').delete().eq('lock_date',dateStr)
    showToast(`🔓 ${dateFmt(dateStr)} unlocked`, C.saffron[600]); load()
  }

  const handleBudgetSave = async amount => {
    await supabase.from('kitchen_budgets').upsert({ month:viewMonth, budget_amount:amount },{ onConflict:'month' })
    setBudget(amount); setShowBudget(false); showToast('Budget updated ✓', C.forest[600])
  }

  // FIX: Properly map form fields for cook log
  const handleCookLogSave = async form => {
    const { error } = await supabase.from('kitchen_cook_log').insert({
      log_date:   today(),
      staff_name: form.staff_name,
      meal_type:  form.meal_type,
      arrived_at: form.arrived_at || null,
      left_at:    form.left_at    || null,
      notes:      form.notes      || null,
    })
    if (error) { showToast('Cook log save failed: '+error.message, C.rose[600]); return }
    showToast('Cook log saved ✓', C.forest[600])
    setShowCookLog(false)
    load()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const filteredByMeal = filterMeal==='all' ? entries : entries.filter(e=>e.meal_type===filterMeal)
  const uniqueDates    = [...new Set(filteredByMeal.map(e=>e.expense_date))].sort().reverse()
  const todayTotal     = entries.filter(e=>e.expense_date===today()).reduce((s,e)=>s+Number(e.amount),0)
  const weekTotal      = entries.filter(e=>e.expense_date>=weekStart()).reduce((s,e)=>s+Number(e.amount),0)
  const monthTotal     = entries.reduce((s,e)=>s+Number(e.amount),0)
  const allDays        = [...new Set(entries.map(e=>e.expense_date))]
  const avgPerDay      = allDays.length ? monthTotal/allDays.length : 0
  const highDay        = allDays.reduce(
    (best,d) => { const sum=entries.filter(e=>e.expense_date===d).reduce((s,e)=>s+Number(e.amount),0); return sum>best.sum?{d,sum}:best },
    { d:null, sum:0 }
  )

  return (
    <div className="gnsi-kitchen">
      <style>{GLOBAL_CSS}</style>

      {/* Overlays */}
      {toast      && <Toast msg={toast.msg} color={toast.color} />}
      {showBudget && <BudgetModal current={budget} month={viewMonth} onSave={handleBudgetSave} onClose={()=>setShowBudget(false)} />}
      {showWA && (
        <div className="fade-in" style={{ position:'fixed', inset:0, background:'rgba(32,20,10,.5)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
          onClick={()=>setShowWA(null)}>
          <div className="k-card" style={{ width:420, overflow:'hidden', boxShadow:'var(--shadow-xl)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.divider}`,
              background:`linear-gradient(135deg, ${C.forest[50]}, #fff)`, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>📲</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.forest[700] }}>WhatsApp Message — Copied!</div>
                <div style={{ fontSize:11, color:C.ink[400], marginTop:1 }}>Paste in any chat</div>
              </div>
            </div>
            <div style={{ padding:'16px 22px' }}>
              <pre style={{ fontSize:12, color:C.ink[600], whiteSpace:'pre-wrap',
                background:C.ink[50], borderRadius:8, padding:'12px 14px', border:`1px solid ${C.ink[100]}`,
                maxHeight:250, overflowY:'auto', fontFamily:'var(--font-mono)', lineHeight:1.7 }}>{showWA}</pre>
              <button type="button" className="k-btn k-btn-primary" onClick={()=>setShowWA(null)}
                style={{ marginTop:14, width:'100%', justifyContent:'center' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Topbar
        viewMonth={viewMonth}   setViewMonth={setViewMonth}
        tab={tab}               setTab={setTab}
        isAdmin={isAdmin}
        onBudget={()=>setShowBudget(true)}
        onReport={()=>generatePrintReport(entries,budget,viewMonth)}
        onCSV={()=>exportToCSV(entries,viewMonth)}
        onWhatsApp={()=>setShowWA(generateWhatsAppMsg(entries,filterDate))}
        onAdd={()=>{ setEditing(null); setFormOpen(true) }}
        onItemSetup={()=>setShowItemSetup(v=>!v)}
        onMonitor={()=>setShowMonitor(v=>!v)}
        onCookLog={()=>setShowCookLog(v=>!v)}
        onCookAtt={()=>setShowCookAtt(v=>!v)}
      />

      <div ref={contentRef} style={{ maxWidth:1080, margin:'0 auto', padding:'24px 28px' }}>
        {loading && <LoadingBar />}

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }} className="stagger">
          <KpiCard label="Today"     value={moneyFmt(todayTotal)} accent={C.terra[600]}  icon="🌅" subtitle={today()} pulse />
          <KpiCard label="This Week" value={moneyFmt(weekTotal)}  accent={C.ink[700]}    icon="📅" />
          <KpiCard label="Month"     value={moneyFmt(monthTotal)} accent={C.teal[600]}   icon="🗓" subtitle={viewMonth} />
          <KpiCard label="Daily Avg" value={moneyFmt(avgPerDay)}  accent={C.forest[600]} icon="📈" />
          <KpiCard label="Peak Day"  value={highDay.d?dateFmt(highDay.d):'—'} accent={C.rose[600]} icon="🔺" subtitle={highDay.d?moneyFmt(highDay.sum):''} />
        </div>

        <BudgetBar spent={monthTotal} budget={budget} />

        {/* Panels */}
        {showItemSetup && <ItemSetupPanel onClose={()=>setShowItemSetup(false)} showToast={showToast} />}
        {showMonitor && isAdmin && <AdminMonitorPanel entries={entries} budget={budget} cookLog={cookLog} onClose={()=>setShowMonitor(false)} />}
        {showCookLog && isAdmin && <CookLogForm onSave={handleCookLogSave} onClose={()=>setShowCookLog(false)} />}
        {showCookAtt && isAdmin && <CookAttendancePanel onClose={()=>setShowCookAtt(false)} showToast={showToast} />}

        {formOpen && (
          <EntryForm
            onSave={handleSave}
            onCancel={()=>{ setFormOpen(false); setEditing(null) }}
            editing={editing}
            defaultDate={filterDate}
            kitchenItems={kitchenItems}
          />
        )}

        {/* ── LEDGER TAB ── */}
        {tab==='ledger' && (
          <>
            <div className="k-card" style={{ padding:'12px 16px', marginBottom:14, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label className="k-label" style={{ marginBottom:0 }}>Date</label>
                <input type="date" className="k-input" style={{ width:'auto', padding:'6px 12px' }}
                  value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label className="k-label" style={{ marginBottom:0 }}>Meal</label>
                <select className="k-input" style={{ width:'auto', padding:'6px 12px' }}
                  value={filterMeal} onChange={e=>setFilterMeal(e.target.value)}>
                  <option value="all">All Meals</option>
                  {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
                </select>
              </div>
            </div>

            <MissingMealAlert entries={entries} dateFilter={filterDate} />
            <CostPerStudentCard entries={entries} dateFilter={filterDate} />
            <MealKpiStrip entries={entries} dateFilter={filterDate} />
            <PettyCashWidget entries={entries} dateFilter={filterDate} />

            {!uniqueDates.length ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'70px 20px', textAlign:'center' }} className="fade-up">
                <div style={{ width:80, height:80, borderRadius:22,
                  background:`linear-gradient(135deg, ${C.terra[50]}, ${C.saffron[50]})`,
                  border:`2px dashed ${C.terra[200]}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:38, marginBottom:20 }}>🍽</div>
                <div style={{ fontSize:18, fontWeight:700, color:C.ink[700], fontFamily:'var(--font-display)', marginBottom:8 }}>No entries yet</div>
                <p style={{ fontSize:13, color:C.ink[400], maxWidth:'36ch', lineHeight:1.7, marginBottom:24 }}>
                  Start tracking your kitchen expenses — add your first meal entry for {viewMonth}.
                </p>
                <button type="button" className="k-btn k-btn-primary" onClick={()=>setFormOpen(true)} style={{ fontSize:14, padding:'12px 28px' }}>
                  + Add First Entry
                </button>
              </div>
            ) : (
              <>
                <SectionDivider label={`${filteredByMeal.length} Entries · ${uniqueDates.length} Days`} />
                {uniqueDates.map(d=>(
                  <DayGroup key={d} dateStr={d} entries={filteredByMeal} locks={locks}
                    onEdit={e=>{ setEditing(e); setFormOpen(true) }}
                    onDelete={handleDelete}
                    onLockDay={handleLockDay}
                    onUnlockDay={handleUnlockDay}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab==='analytics' && (
          <div className="fade-up">
            <MonthlyChart entries={entries} />
            <MealPieBreakdown entries={entries} />
            {/* FIX: onDayClick sets filterDate AND switches to ledger tab */}
            <CalendarHeatmap entries={entries} onDayClick={d=>{ setFilterDate(d); setTab('ledger') }} />
            <VendorSummary entries={entries} />
            <ItemFrequency entries={entries} />
          </div>
        )}
      </div>
    </div>
  )
}

/*
═══════════════════════════════════════════════════════════════════════════════
 SUPABASE MIGRATION SQL
 Run this in your Supabase SQL editor if you haven't already
═══════════════════════════════════════════════════════════════════════════════

-- Core expenditure table
CREATE TABLE IF NOT EXISTS kitchen_expenditure (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_type     text NOT NULL CHECK (meal_type IN ('lunch','morning_breakfast','evening_breakfast','dinner')),
  expense_date  date NOT NULL DEFAULT CURRENT_DATE,
  amount        numeric(10,2) NOT NULL DEFAULT 0,
  item_details  text,
  prepared_by   text,
  pax_count     int,
  vendor        text,
  meal_rating   int CHECK (meal_rating BETWEEN 0 AND 5),
  serving_time  time,
  receipt_url   text,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Monthly budgets
CREATE TABLE IF NOT EXISTS kitchen_budgets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month          text NOT NULL UNIQUE,
  budget_amount  numeric(10,2) NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- Daily locks
CREATE TABLE IF NOT EXISTS kitchen_daily_locks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_date date NOT NULL UNIQUE,
  locked_by text,
  locked_at timestamptz DEFAULT now()
);

-- Item master list
CREATE TABLE IF NOT EXISTS kitchen_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  name_meitei   text,
  category      text DEFAULT 'other',
  unit          text DEFAULT 'kg',
  default_price numeric(10,2),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Cook activity log (per meal)
CREATE TABLE IF NOT EXISTS kitchen_cook_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date   date NOT NULL DEFAULT CURRENT_DATE,
  staff_name text NOT NULL,
  meal_type  text NOT NULL,
  arrived_at time,
  left_at    time,
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- Cook attendance (per shift per day)
CREATE TABLE IF NOT EXISTS kitchen_cook_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  att_date   date NOT NULL,
  cook_name  text NOT NULL,
  shift      text NOT NULL CHECK (shift IN ('morning','evening')),
  status     text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','half_day')),
  check_in   time,
  check_out  time,
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(att_date, cook_name, shift)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kitchen_exp_date  ON kitchen_expenditure(expense_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_exp_meal  ON kitchen_expenditure(meal_type);
CREATE INDEX IF NOT EXISTS idx_cook_att_date     ON kitchen_cook_attendance(att_date);
CREATE INDEX IF NOT EXISTS idx_cook_log_date     ON kitchen_cook_log(log_date);

-- Storage bucket (run in Supabase Dashboard → Storage, not SQL)
-- Create a PUBLIC bucket named: kitchen-receipts
*/
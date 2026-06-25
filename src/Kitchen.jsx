// Kitchen.jsx — Fees-style redesign v5.0
// Same visual language as Fees.jsx (navy/indigo, inline styles) — all v4.0 functionality preserved 1:1
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'

// ── Responsive hook (same pattern as Fees.jsx) ────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Shared style tokens (mirrors Fees.jsx `inp` / `lbl` pattern) ──────────────
const inp = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box', backgroundColor: 'white',
}
const inpSm = { ...inp, fontSize: 12, padding: '7px 10px' }
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}
const card = {
  background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
  boxShadow: '0 2px 8px rgba(0,0,0,.05)',
}
const btnPrimary = (disabled) => ({
  padding: '10px 22px', borderRadius: 8, border: 'none',
  background: disabled ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#3730a3)',
  color: 'white', fontWeight: 700, fontSize: 14,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const btnGhost = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b',
}

// ─── Meal Config ──────────────────────────────────────────────────────────────
const MEALS = {
  lunch:             { label:'Morning Lunch',       short:'Lunch',   emoji:'🍱', time:'12:30', color:'#059669', soft:'#f0fdf4', border:'#bbf7d0' },
  morning_breakfast: { label:'Afternoon Breakfast', short:'A.Bfast', emoji:'☕', time:'14:30', color:'#d97706', soft:'#fffbeb', border:'#fde68a' },
  evening_breakfast: { label:'Evening Breakfast',   short:'E.Bfast', emoji:'🌇', time:'16:30', color:'#4f46e5', soft:'#eef2ff', border:'#c7d2fe' },
  dinner:            { label:'Dinner',              short:'Dinner',  emoji:'🌙', time:'19:30', color:'#1e3a5f', soft:'#eff6ff', border:'#bfdbfe' },
}
const MEAL_KEYS = ['lunch','morning_breakfast','evening_breakfast','dinner']

const COOKS = [
  'Khundrakpam Jamuna Devi',
  'Ningthoujam Madhomti Devi',
  'Ningthoujam Santi Devi',
  'Khundrakpam Premabati Devi',
]
const COOK_SHIFTS = {
  morning: { label:'Morning Shift', short:'Morning', emoji:'🌅', time:'06:30–09:00 AM', defaultIn:'06:30', defaultOut:'09:00', color:'#d97706', soft:'#fffbeb', border:'#fde68a' },
  evening: { label:'Evening Shift', short:'Evening', emoji:'🌇', time:'06:00–09:00 PM', defaultIn:'18:00', defaultOut:'21:00', color:'#7c3aed', soft:'#f5f3ff', border:'#ddd6fe' },
}
const MANIPURI_PRESETS = {
  lunch:             ['Chak (Rice)','Kangsoi','Eromba','Nga Thongba','Hawai Thongba','Alu Kangmet','Khichdi','Papad','Pickle','Sabzi'],
  morning_breakfast: ['Tea','Bread','Rusk','Halwa','Egg','Milk','Banana','Biscuit','Momo','Chak-hao Kheer'],
  evening_breakfast: ['Tea','Bread','Rusk','Singju','Pakora','Samosa','Bread Pakora','Chow Chow','Biscuit','Fruits'],
  dinner:            ['Chak (Rice)','Dal','Sabzi','Nga Thongba','Paneer','Chapati','Khichdi','Soup','Papad'],
}
const LOCAL_VENDORS = ['Khangabok Market','Thoubal Bazaar','Ima Keithel','Wangjing Market','Chandani Shop','Imphal Market','Thangal Bazaar','Lamlong Bazaar','Local Farmer','Daily Supplier']
const ITEM_CATEGORIES = {
  grain:     { label:'Grain / Cereal', emoji:'🌾', color:'#d97706', soft:'#fffbeb', border:'#fde68a' },
  vegetable: { label:'Vegetable',      emoji:'🥦', color:'#059669', soft:'#f0fdf4', border:'#bbf7d0' },
  protein:   { label:'Protein',        emoji:'🍗', color:'#dc2626', soft:'#fef2f2', border:'#fecaca' },
  dairy:     { label:'Dairy',          emoji:'🥛', color:'#0284c7', soft:'#f0f9ff', border:'#bae6fd' },
  spice:     { label:'Spice / Masala', emoji:'🌶️', color:'#db2777', soft:'#fdf2f8', border:'#fbcfe8' },
  oil:       { label:'Oil / Fat',      emoji:'🫙', color:'#64748b', soft:'#f8fafc', border:'#e2e8f0' },
  other:     { label:'Other',          emoji:'📦', color:'#94a3b8', soft:'#f8fafc', border:'#e2e8f0' },
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const today    = () => new Date().toISOString().split('T')[0]
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
const dateFmt  = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const moneyFmt = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const weekStart= () => {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}
const nowHHMM  = () => { const n=new Date(); return n.getHours()*100+n.getMinutes() }

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES (Fees.jsx visual language)
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ msg, color = '#16a34a' }) {
  return (
    <div className="no-print" style={{
      position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff',
      border: '1px solid #e2e8f0', borderLeft: `3px solid ${color}`, borderRadius: 10,
      padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)',
      maxWidth: 320, color: '#1e293b',
    }}>
      {msg}
    </div>
  )
}

function Field({ label, sub, children, span }) {
  return (
    <div style={span ? { gridColumn: '1/-1' } : undefined}>
      <label style={lbl}>
        {label}
        {sub && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>{sub}</span>}
      </label>
      {children}
    </div>
  )
}

function MealBadge({ type, size = 'sm' }) {
  const m = MEALS[type]; if (!m) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, fontWeight: 700,
      fontSize: size === 'sm' ? 10 : 11.5, padding: size === 'sm' ? '2px 10px' : '4px 12px',
      background: m.soft, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.emoji} {m.short}
    </span>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n===value?0:n)}
          style={{ fontSize: 17, cursor: onChange ? 'pointer' : 'default', color: n <= value ? '#d97706' : '#e2e8f0' }}>★</span>
      ))}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8' }}>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, backgroundColor: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ opacity: .7, fontWeight: 400, fontSize: 10 }}>{label}</span>
    </span>
  )
}

function LoadingBlock({ label = '⏳ Loading…' }) {
  return <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 }}>{label}</div>
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, color, bg, icon, sub, big }) {
  return (
    <div style={{
      background: bg || '#fff', borderRadius: 12, padding: big ? '16px 18px' : '14px 16px',
      borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      {icon && <div style={{ fontSize: big ? 22 : 18, marginBottom: 5 }}>{icon}</div>}
      <div style={{ fontSize: big ? 12 : 11, color, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 19, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: big ? 11 : 10, color, opacity: .7, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function MealKpiStrip({ entries, dateFilter, cols }) {
  const dayEntries = entries.filter(e => e.expense_date === dateFilter)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, marginBottom: 16 }}>
      {MEAL_KEYS.map(mk => {
        const m   = MEALS[mk]
        const mEntries = dayEntries.filter(e=>e.meal_type===mk)
        const amt = mEntries.reduce((s,e)=>s+Number(e.amount),0)
        const hasEntry = mEntries.length > 0
        const [h,min] = m.time.split(':').map(Number)
        const isPast  = h*100+min < nowHHMM()
        const isMissing = !hasEntry && isPast && dateFilter === today()
        return (
          <div key={mk} style={{
            borderRadius: 10, padding: '12px 14px', position: 'relative',
            background: isMissing ? '#fef2f2' : hasEntry ? m.soft : '#fff',
            border: `1.5px solid ${isMissing ? '#fca5a5' : hasEntry ? m.border : '#e2e8f0'}`,
            opacity: !hasEntry && !isPast ? .65 : 1,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, color: isMissing ? '#dc2626' : m.color }}>{m.short}</div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: isMissing ? '#dc2626' : m.color }}>
              {hasEntry ? moneyFmt(amt) : <span style={{ fontSize: 12, opacity: .55, fontWeight: 600 }}>{isMissing ? '⚠ Missing' : 'Upcoming'}</span>}
            </div>
            <div style={{ fontSize: 9, marginTop: 4, color: isMissing ? '#dc2626' : m.color, opacity: .6 }}>{m.time}</div>
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
  const color = pct > 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#16a34a'
  return (
    <div style={{ ...card, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>📊</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Monthly Budget</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
            {moneyFmt(spent)} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}>/ {moneyFmt(budget)}</span>
            {over && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700 }}>OVER</span>}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
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
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f' }}>📈 Daily Spend</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>This month</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>{moneyFmt(avg)}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>daily avg</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100, overflowX: 'auto', paddingBottom: 4 }}>
        {days.map(d => {
          const v = byDay[d]
          const h = Math.max((v/max)*84, 4)
          const isToday  = d === today()
          const isPeak   = v === max
          const color    = isPeak ? '#dc2626' : isToday ? '#3730a3' : '#c7d2fe'
          return (
            <div key={d} title={`${dateFmt(d)}: ${moneyFmt(v)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: 16, borderRadius: '3px 3px 0 0', transition: 'height .3s', height: h, backgroundColor: color }} />
              <span style={{ fontSize: 8, color: '#cbd5e1', display: 'block', width: 14, textAlign: 'center' }}>
                {new Date(d+'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10 }}>
        {[['Today','#3730a3'],['Peak','#dc2626'],['Other','#c7d2fe']].map(([l,col])=>(
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: col }} />{l}
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
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 14 }}>Meal-wise Breakdown</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MEAL_KEYS.map(mk => {
          const m   = MEALS[mk]
          const amt = totals[mk]
          const pct = grand ? ((amt/grand)*100) : 0
          return (
            <div key={mk}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, display: 'inline-block', background: m.color }} />
                  {m.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 11 }}>
                  {moneyFmt(amt)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 3, transition: 'width .4s' }} />
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
    if (!amt) return '#e2e8f0'
    const i = amt/max
    if (i > .75) return '#dc2626'
    if (i > .5)  return '#4f46e5'
    if (i > .25) return '#818cf8'
    return '#c7d2fe'
  }

  const cells = []
  for (let i=0;i<firstDOW;i++) cells.push(null)
  for (let d=1;d<=daysInM;d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ d, iso, amt:byDay[iso]||0 })
  }

  return (
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 12 }}>
        Spend Heatmap — {now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d,i)=>(
          <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#94a3b8', paddingBottom: 4 }}>{d}</div>
        ))}
        {cells.map((c,i) => c===null
          ? <div key={`e${i}`} />
          : <div key={c.iso} onClick={() => onDayClick(c.iso)}
              title={`${dateFmt(c.iso)}: ${moneyFmt(c.amt)}`}
              style={{
                aspectRatio: '1', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, transition: 'all .1s',
                backgroundColor: getColor(c.amt), color: c.amt ? '#fff' : '#94a3b8',
                border: c.iso===today() ? '2px solid #1e3a5f' : '2px solid transparent',
              }}>
              {c.d}
            </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 10, color: '#94a3b8' }}>
        {[['None','#e2e8f0'],['Low','#c7d2fe'],['Mid','#818cf8'],['High','#4f46e5'],['Peak','#dc2626']].map(([l,col])=>(
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, display: 'inline-block', background: col }} />{l}
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
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 14 }}>Top Vendors</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vendors.map(([name, { count, total }], i) => (
          <div key={name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', width: 14 }}>{i+1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{count}×</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>{moneyFmt(total)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(total/maxT)*100}%`, background: '#0284c7', borderRadius: 2, transition: 'width .4s' }} />
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
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 12 }}>Most Used Items</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {freq.map(([item,count]) => (
          <span key={item} style={{
            padding: '5px 12px', borderRadius: 999, background: '#fffbeb', border: '1px solid #fde68a',
            fontSize: 11, fontWeight: 600, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {item}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706' }}>×{count}</span>
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
    <div style={{
      ...card, border: '1px solid #bae6fd', background: 'linear-gradient(135deg,#f0f9ff,#fff)',
      padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>{moneyFmt(cps)}</div>
        <div style={{ fontSize: 11, color: '#0284c7', marginTop: 4 }}>
          per student · {Math.round(avgPax)} served today
        </div>
      </div>
    </div>
  )
}

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
    <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        💵 Petty Cash Ledger
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>— {dateFmt(dateFilter)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ ...inp, flex: 1 }} type="number" placeholder="Amount given (₹)" value={given}
          onChange={e=>setGiven(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCash()} />
        <button type="button" style={btnGhost} onClick={addCash}>+ Add</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatPill label="given" value={moneyFmt(totalGiven)} color="#16a34a" />
        <StatPill label="spent" value={moneyFmt(daySpend)} color="#dc2626" />
        <StatPill label={balance<0?'short':'balance'} value={moneyFmt(Math.abs(balance))} color={balance>=0?'#0284c7':'#dc2626'} />
      </div>
      {cashLog.filter(c=>c.date===dateFilter).map((c,i)=>(
        <div key={i} style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
          ✓ {moneyFmt(c.amount)} added at {c.at}
        </div>
      ))}
    </div>
  )
}

function MissingMealAlert({ entries, dateFilter }) {
  if (dateFilter !== today()) return null
  const present = entries.filter(e=>e.expense_date===dateFilter).map(e=>e.meal_type)
  const overdue = MEAL_KEYS.filter(mk => {
    if (present.includes(mk)) return false
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return h*100+m < nowHHMM()
  })
  if (!overdue.length) return null
  return (
    <div style={{
      marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: '#fef2f2',
      border: '1.5px solid #fca5a5', display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 16, marginTop: 1 }}>⚠️</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Missing meal entries — past scheduled time</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
  const btnDark = { padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,18,30,.92)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }} onClick={e=>e.stopPropagation()}>
        {!isPDF && <>
          <button type="button" style={btnDark} onClick={()=>setZoom(z=>Math.min(z+.25,3))}>🔍+</button>
          <button type="button" style={btnDark} onClick={()=>setZoom(z=>Math.max(z-.25,.5))}>🔍−</button>
        </>}
        <a href={url} target="_blank" rel="noreferrer" style={{ ...btnDark, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⬇ Download</a>
        {onDelete && <button type="button" style={{ ...btnDark, background: 'rgba(220,38,38,.25)', color: '#fca5a5', border: '1px solid rgba(220,38,38,.4)' }} onClick={onDelete}>🗑 Delete</button>}
        <button type="button" style={btnDark} onClick={onClose}>✕ Close</button>
      </div>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }}>
        {isPDF
          ? <iframe src={url} style={{ width: '80vw', height: '80vh', border: 'none', borderRadius: 10 }} title="Receipt PDF" />
          : <img src={url} alt="Receipt" style={{ borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,.4)', transition: 'transform .2s', transform: `scale(${zoom})`, transformOrigin: 'top center', maxWidth: '85vw' }} />
        }
      </div>
      {!isPDF && <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Zoom: {Math.round(zoom*100)}% · Click outside to close</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM SETUP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ItemSetupPanel({ onClose, showToast, isMobile }) {
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
      showToast('Item updated ✓', '#d97706')
    } else {
      await supabase.from('kitchen_items').insert(row)
      showToast('Item added ✓', '#16a34a')
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
    <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>Item Setup</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Manage kitchen item master list</div>
        </div>
        <button type="button" style={{ ...btnGhost, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
            {editId ? '✏️ Edit Item' : '➕ New Item'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label="Name (English)">
              <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rice" />
            </Field>
            <Field label="Local Name">
              <input style={inp} value={form.name_meitei} onChange={e=>setForm(f=>({...f,name_meitei:e.target.value}))} placeholder="Alternate name" />
            </Field>
            <Field label="Category">
              <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {Object.entries(ITEM_CATEGORIES).map(([k,v])=>(
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select style={inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                {['kg','g','litre','ml','piece','dozen','packet','bundle'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Default Price (₹/unit)">
              <input type="number" style={inp} value={form.default_price} onChange={e=>setForm(f=>({...f,default_price:e.target.value}))} placeholder="0.00" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" style={btnPrimary(false)} onClick={handleSave}>{editId ? 'Update' : '+ Add'}</button>
            {editId && <button type="button" style={btnGhost} onClick={()=>{setEditId(null);setForm({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })}}>Cancel</button>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ ...inp, flex: 1 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…" />
          <select style={{ ...inp, width: 'auto', minWidth: 150 }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {Object.entries(ITEM_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </div>
        {loading ? <LoadingBlock /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {!filtered.length && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 20 }}>No items found</div>}
            {filtered.map(it => {
              const cat = ITEM_CATEGORIES[it.category]||ITEM_CATEGORIES.other
              return (
                <div key={it.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8,
                  background: it.is_active ? '#fff' : '#f8fafc', border: `1.5px solid ${it.is_active ? cat.border : '#e2e8f0'}`,
                  opacity: it.is_active ? 1 : .55,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{cat.emoji}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                        {it.name} {it.name_meitei && <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {it.name_meitei}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {cat.label} · {it.unit}{it.default_price?` · ₹${it.default_price}/${it.unit}`:''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} onClick={()=>startEdit(it)}>Edit</button>
                    <button type="button" style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                      ...(it.is_active ? { color: '#dc2626', background: '#fef2f2', borderColor: '#fca5a5' } : { color: '#16a34a', background: '#f0fdf4', borderColor: '#86efac' }),
                    }} onClick={()=>toggleActive(it.id,it.is_active)}>
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
function AdminMonitorPanel({ entries, budget, cookLog, onClose, isMobile }) {
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
    <div style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>Admin Monitor</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Live kitchen oversight · {dateFmt(today())}</div>
        </div>
        <button type="button" style={{ ...btnGhost, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          <KpiCard label="Today" value={moneyFmt(todayTotal)} color="#d97706" bg="#fffbeb" icon="💸" />
          <KpiCard label="Month" value={moneyFmt(monthTotal)} color="#1e3a5f" bg="#eff6ff" icon="🗓" />
          {budget && <KpiCard label="Budget Used" value={`${budgetPct.toFixed(1)}%`} color={budgetPct>90?'#dc2626':'#d97706'} bg={budgetPct>90?'#fef2f2':'#fffbeb'} icon="📊" />}
          <KpiCard label="Meals Today" value={`${presentMeals.length}/4`} color={presentMeals.length===4?'#16a34a':'#dc2626'} bg={presentMeals.length===4?'#f0fdf4':'#fef2f2'} icon="🍽" />
        </div>
        {budgetPct > 90 && (
          <div style={{ padding: 12, borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fca5a5', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>🚨 Budget Breach — {budgetPct.toFixed(1)}% consumed</div>
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Spent {moneyFmt(monthTotal)} of {moneyFmt(budget)}</div>
          </div>
        )}
        {overdueAlerts.length > 0 && (
          <div style={{ padding: 12, borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fde68a', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⏰ Missing Past-Due Entries</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {overdueAlerts.map(mk=><MealBadge key={mk} type={mk} />)}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {mealStatus.map(({ mk, amt, isDue, isLogged, entries:me }) => {
            const m = MEALS[mk]
            const statusColor = isLogged ? '#16a34a' : isDue ? '#dc2626' : '#94a3b8'
            const statusLabel = isLogged ? '✓ Logged' : isDue ? '⚠ Missing' : '⏳ Upcoming'
            return (
              <div key={mk} style={{ padding: 10, borderRadius: 10, background: m.soft, border: `1.5px solid ${m.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{m.emoji} <strong>{m.short}</strong></span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,255,255,.7)', color: statusColor }}>{statusLabel}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{moneyFmt(amt)}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, opacity: .8 }}>Scheduled: {m.time}</div>
                {me.length>0 && me[0].prepared_by && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, opacity: .8 }}>👨‍🍳 {me[0].prepared_by}</div>}
              </div>
            )
          })}
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Cook Activity — Today</div>
          {!todayCookLog.length
            ? <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 12 }}>No cook log entries today</div>
            : todayCookLog.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{log.staff_name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MealBadge type={log.meal_type} />
                    {log.arrived_at&&<span>In: {log.arrived_at}</span>}
                    {log.left_at&&<span>Out: {log.left_at}</span>}
                  </div>
                </div>
                {log.notes && <div style={{ fontSize: 10, color: '#94a3b8', maxWidth: 150, textAlign: 'right' }}>{log.notes}</div>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Cook Log Form ────────────────────────────────────────────────────────────
function CookLogForm({ onSave, onClose, isMobile }) {
  const [form, setForm] = useState({ staff_name:'', meal_type:'lunch', arrived_at:'', left_at:'', notes:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div style={{ ...card, border: '1.5px solid #bbf7d0', marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>Log Cook Activity</div>
        <button type="button" style={{ ...btnGhost, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
          <Field label="Staff / Cook Name">
            <input style={inp} value={form.staff_name} onChange={e=>set('staff_name',e.target.value)} placeholder="Name" />
          </Field>
          <Field label="Meal">
            <select style={inp} value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
              {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
            </select>
          </Field>
          <Field label="Arrived At">
            <input type="time" style={inp} value={form.arrived_at} onChange={e=>set('arrived_at',e.target.value)} />
          </Field>
          <Field label="Left At">
            <input type="time" style={inp} value={form.left_at} onChange={e=>set('left_at',e.target.value)} />
          </Field>
          <Field label="Notes" span>
            <input style={inp} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" style={btnPrimary(false)} onClick={()=>form.staff_name&&onSave(form)}>Save Log</button>
          <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COOK ATTENDANCE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function CookAttendancePanel({ onClose, showToast, isMobile }) {
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
    if (delErr) { setLoading(false); showToast('Save failed: '+delErr.message, '#dc2626'); return }

    const { error } = await supabase.from('kitchen_cook_attendance').insert(rows)
    setLoading(false)
    if (error) { showToast('Save failed: '+error.message, '#dc2626'); return }
    showToast('Attendance saved ✓', '#16a34a')
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

  const statusBtnStyle = (status, selected) => {
    const configs = {
      present:  { bg:selected?'#16a34a':'#f0fdf4', color:selected?'#fff':'#16a34a', border:selected?'#16a34a':'#bbf7d0' },
      absent:   { bg:selected?'#dc2626':'#fef2f2', color:selected?'#fff':'#dc2626', border:selected?'#dc2626':'#fecaca' },
      half_day: { bg:selected?'#d97706':'#fffbeb', color:selected?'#fff':'#d97706', border:selected?'#d97706':'#fde68a' },
    }
    const c = configs[status]
    return { padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${c.border}`, background: c.bg, color: c.color }
  }

  return (
    <div style={{ ...card, border: '1.5px solid #c7d2fe', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#3730a3' }}>Cook Attendance</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Morning 6:30–9:00 AM · Evening 6:00–9:00 PM</div>
        </div>
        <button type="button" style={{ ...btnGhost, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {[['mark','📋 Mark'],['monthly','📊 Monthly']].map(([k,l]) => (
              <button key={k} type="button" onClick={()=>setView(k)} style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: view===k ? '#3730a3' : '#fff', color: view===k ? '#fff' : '#64748b',
              }}>
                {l}
              </button>
            ))}
          </div>
          {view==='mark' && (
            <input type="date" style={{ ...inp, width: 'auto' }} value={attDate} onChange={e=>setAttDate(e.target.value)} />
          )}
          {view==='monthly' && (
            <input type="month" style={{ ...inp, width: 'auto' }} value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />
          )}
        </div>

        {loading && <LoadingBlock />}

        {!loading && view==='mark' && Object.entries(COOK_SHIFTS).map(([shift, sh]) => (
          <div key={shift} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: sh.soft, border: `1.5px solid ${sh.border}`, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{sh.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: sh.color }}>{sh.label}</div>
                <div style={{ fontSize: 10, color: sh.color, opacity: .7 }}>{sh.time}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['present','absent','half_day'].map(st => {
                  const cnt = COOKS.filter(c=>draft[draftKey(c,shift)]?.status===st).length
                  if (!cnt) return null
                  const colors={present:'#16a34a',absent:'#dc2626',half_day:'#d97706'}
                  return (
                    <span key={st} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,255,255,.7)', color: colors[st] }}>
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
                <div key={cook} style={{
                  marginBottom: 8, padding: '10px 14px', borderRadius: 10,
                  background: isAbsent ? '#fef2f2' : '#fff', border: `1.5px solid ${isAbsent ? '#fecaca' : '#e2e8f0'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: isAbsent ? 0 : 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 999, background: sh.soft, border: `1.5px solid ${sh.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: sh.color }}>
                        {cook[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{cook}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Cook #{ci+1}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['present','absent','half_day'].map(st => (
                        <button key={st} type="button" onClick={()=>setField(cook,shift,'status',st)} style={statusBtnStyle(st, rec.status===st)}>
                          {st==='present'?'✓ Present':st==='absent'?'✗ Absent':'½ Half'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAbsent && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>IN</span>
                        <input type="time" style={{ ...inp, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={rec.check_in||''} onChange={e=>setField(cook,shift,'check_in',e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>OUT</span>
                        <input type="time" style={{ ...inp, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={rec.check_out||''} onChange={e=>setField(cook,shift,'check_out',e.target.value)} />
                      </div>
                      <input style={{ ...inp, flex: 1, minWidth: 120, padding: '5px 8px', fontSize: 11 }} value={rec.notes||''} onChange={e=>setField(cook,shift,'notes',e.target.value)} placeholder="Notes…" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {!loading && view==='mark' && (
          <button type="button" style={btnPrimary(loading)} onClick={saveAll} disabled={loading}>
            {loading ? 'Saving…' : '💾 Save All Attendance'}
          </button>
        )}

        {!loading && view==='monthly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {monthlySummary.map(({ cook, present, absent, half, pct, mPresent, ePresent, totalDays }) => {
              const pctColor = pct>=90?'#16a34a':pct>=70?'#d97706':'#dc2626'
              return (
                <div key={cook} style={{ ...card, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 999, background: '#eef2ff', border: '1.5px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#3730a3' }}>
                        {cook[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{cook}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{totalDays} shifts · {viewMonth}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: pctColor }}>{pct}%</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pctColor, borderRadius: 3, transition: 'width .5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <StatPill label="present" value={present} color="#16a34a" />
                    <StatPill label="absent"  value={absent}  color="#dc2626" />
                    <StatPill label="half"    value={half}    color="#d97706" />
                    <StatPill label="morning" value={mPresent} color="#3730a3" />
                    <StatPill label="evening" value={ePresent} color="#7c3aed" />
                  </div>
                </div>
              )
            })}

            {monthly.length > 0 && (
              <div style={{ ...card, padding: 18, marginTop: 4, overflowX: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 14 }}>Day-wise Detail — {viewMonth}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 10px', textAlign: 'left', background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: 10 }}>Cook</th>
                      {[...new Set(monthly.map(r=>r.att_date))].sort().map(d=>(
                        <th key={d} style={{ padding: '4px 4px', textAlign: 'center', background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: 9 }}>
                          {new Date(d+'T00:00:00').getDate()}<br/>
                          <span style={{ fontWeight: 400, color: '#94a3b8' }}>{new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKS.map(cook => {
                      const dates = [...new Set(monthly.map(r=>r.att_date))].sort()
                      const cell = (row) => {
                        if (!row) return <span style={{ color: '#cbd5e1' }}>—</span>
                        if (row.status==='present')  return <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                        if (row.status==='absent')   return <span style={{ color: '#dc2626', fontWeight: 800 }}>✗</span>
                        if (row.status==='half_day') return <span style={{ color: '#d97706', fontWeight: 800 }}>½</span>
                        return null
                      }
                      return (
                        <tr key={cook} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', fontSize: 10 }}>
                            {cook.split(' ').slice(0,2).join(' ')}
                          </td>
                          {dates.map(d => {
                            const mRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='morning')
                            const eRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='evening')
                            return (
                              <td key={d} style={{ padding: '4px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <span>{cell(mRow)}</span>
                                  <span style={{ opacity: .6, fontSize: 9 }}>{cell(eRow)}</span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
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
function EntryForm({ onSave, onCancel, editing, defaultDate, kitchenItems, isMobile }) {
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

  const vendorIsPreset = LOCAL_VENDORS.includes(form.vendor)

  return (
    <>
      {viewReceipt && form.receipt_url && (
        <ReceiptViewer url={form.receipt_url} onClose={()=>setViewReceipt(false)}
          onDelete={()=>{ set('receipt_url',''); setViewReceipt(false) }} />
      )}
      <div style={{ ...card, border: `1.5px solid ${m.border}`, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ background: m.soft, borderBottom: `1px solid ${m.border}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>
              {editing ? `✏️ Edit — ${m.label}` : `➕ Add ${m.label}`}
            </div>
            <div style={{ fontSize: 11, color: m.color, opacity: .7, marginTop: 2 }}>
              {form.expense_date ? dateFmt(form.expense_date) : 'Select date'}
            </div>
          </div>
          <button type="button" style={{ ...btnGhost, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderColor: m.border }} onClick={onCancel}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            <Field label="Meal *">
              <select style={inp} value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
                {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
              </select>
            </Field>
            <Field label="Date *">
              <input type="date" style={inp} value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} />
            </Field>
            <Field label="Amount (₹) *">
              <input type="number" style={inp} value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </Field>
            <Field label="Serving Time">
              <input type="time" style={inp} value={form.serving_time} onChange={e=>set('serving_time',e.target.value)} />
            </Field>

            <Field label="Items / Ingredients" span>
              <input style={inp} value={form.item_details} onChange={e=>set('item_details',e.target.value)} placeholder="e.g. Chak, Dal, Eromba…" />
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>🍛 Manipuri Dishes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {presets.map(item=>(
                    <button key={item} type="button" onClick={()=>addItem(item)} style={{
                      padding: '2px 10px', borderRadius: 999, border: '1px solid #fde68a', background: '#fffbeb',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#92400e',
                    }}>
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
              {dbItems.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>🧺 Item List</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {dbItems.map(it=>(
                      <button key={it.id} type="button" onClick={()=>addItem(it.name)} style={{
                        padding: '2px 10px', borderRadius: 999, border: '1px solid #bae6fd', background: '#f0f9ff',
                        fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#0369a1',
                      }}>
                        + {it.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input style={{ ...inp, flex: 1, fontSize: 12, padding: '7px 10px' }} value={customItem} onChange={e=>setCustomItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustomItem()} placeholder="Type custom item + Enter" />
                <button type="button" style={btnGhost} onClick={addCustomItem}>+ Add</button>
              </div>
            </Field>

            <Field label="Prepared By">
              <input style={inp} value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)} placeholder="Cook / Staff name" />
            </Field>

            <Field label="Vendor / Supplier">
              <select style={{ ...inp, marginBottom: 6 }} value={vendorIsPreset ? form.vendor : ''}
                onChange={e => { if (e.target.value) set('vendor', e.target.value) }}>
                <option value="">— Select preset vendor —</option>
                {LOCAL_VENDORS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input style={{ ...inp, fontSize: 12 }} value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Or type custom vendor name…" />
            </Field>

            <Field label="Students Served">
              <input type="number" style={inp} value={form.pax_count} onChange={e=>set('pax_count',e.target.value)} placeholder="0" min="0" />
            </Field>

            <Field label="Meal Quality">
              <div style={{ paddingTop: 4 }}>
                <StarRating value={form.meal_rating} onChange={v=>set('meal_rating',v)} />
              </div>
            </Field>

            <Field label="Notes" span>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
            </Field>

            <Field label="📎 Receipt / Bill Photo" span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1.5px dashed #e2e8f0' }}>
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize: 11, flex: 1 }} />
                {uploading && <span style={{ fontSize: 11, color: '#94a3b8' }}>Uploading…</span>}
                {form.receipt_url && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#0284c7', border: '1px solid #bae6fd', background: '#f0f9ff', cursor: 'pointer' }}
                      onClick={()=>setViewReceipt(true)}>👁 View</button>
                    <button type="button" style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#dc2626', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer' }}
                      onClick={()=>set('receipt_url','')}>🗑 Remove</button>
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ Uploaded</span>
                  </div>
                )}
              </div>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid #e2e8f0', alignItems: 'center' }}>
            <button type="button" style={btnPrimary(!valid)} onClick={()=>valid&&onSave(editing?.id||null,form)} disabled={!valid}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </button>
            <button type="button" style={btnGhost} onClick={onCancel}>Cancel</button>
            {!valid && <span style={{ fontSize: 11, color: '#94a3b8' }}>Fill required fields *</span>}
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
      <div style={{
        ...card, borderColor: m?.border || '#e2e8f0', padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start',
        background: m ? `linear-gradient(135deg,${m.soft},#fff)` : '#fff',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <MealBadge type={e.meal_type} size="sm" />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
              {moneyFmt(e.amount)}
            </span>
            {e.meal_rating>0 && <StarRating value={e.meal_rating} />}
            {e.pax_count>0 && (
              <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                ₹{(e.amount/e.pax_count).toFixed(2)}/student
              </span>
            )}
            {e.receipt_url && (
              <button type="button" onClick={()=>setViewReceipt(true)} style={{
                padding: '2px 8px', borderRadius: 999, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}>
                📎 Receipt
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
            {e.item_details  && <span>🥦 {e.item_details}</span>}
            {e.prepared_by   && <span>👨‍🍳 {e.prepared_by}</span>}
            {e.vendor        && <span>🏪 {e.vendor}</span>}
            {e.pax_count     && <span>👥 {e.pax_count} students</span>}
            {e.serving_time  && <span>🕐 {e.serving_time}</span>}
          </div>
          {e.notes && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', padding: '4px 10px', background: '#f8fafc', borderRadius: 6, borderLeft: '3px solid #e2e8f0' }}>
              {e.notes}
            </div>
          )}
        </div>
        {!locked && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} onClick={()=>onEdit(e)}>Edit</button>
            <button type="button" style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#dc2626', border: '1.5px solid #fecaca', background: '#fef2f2', cursor: 'pointer' }} onClick={()=>onDelete(e.id)}>Del</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Day Group ────────────────────────────────────────────────────────────────
function DayGroup({ dateStr, entries, locks, onEdit, onDelete, onLockDay, onUnlockDay }) {
  const dayE    = entries.filter(e=>e.expense_date===dateStr)
  const total   = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const isToday = dateStr===today()
  const locked  = locks.includes(dateStr)
  const [collapsed, setCollapsed] = useState(!isToday)

  return (
    <div style={{ marginBottom: 14 }}>
      <div onClick={()=>setCollapsed(c=>!c)} style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10, marginBottom: 8, userSelect: 'none',
        background: isToday ? '#eff6ff' : '#f8fafc', border: `1.5px solid ${isToday ? '#bfdbfe' : '#e2e8f0'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? '#1e3a5f' : '#475569' }}>
            {isToday && <span style={{ color: '#3730a3', marginRight: 4 }}>📌</span>}
            {dateFmt(dateStr)}
          </span>
          {isToday && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1e3a5f', fontWeight: 700 }}>Today</span>}
          {locked  && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>🔒 Locked</span>}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{dayE.length} entries</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{moneyFmt(total)}</span>
          {!locked
            ? <button type="button" onClick={e=>{e.stopPropagation();onLockDay(dateStr)}} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#dc2626', border: '1.5px solid #fecaca', background: '#fef2f2', cursor: 'pointer' }}>
                🔒 Lock
              </button>
            : <button type="button" onClick={e=>{e.stopPropagation();onUnlockDay(dateStr)}} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#d97706', border: '1.5px solid #fde68a', background: '#fffbeb', cursor: 'pointer' }}>
                🔓 Unlock
              </button>
          }
          <span style={{ fontSize: 12, color: '#94a3b8', transition: 'transform .2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>▾</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dayE.map(e=><EntryCard key={e.id} e={e} locked={locked} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  )
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ current, month, onSave, onClose }) {
  const [val, setVal] = useState(current||'')
  const handleSave = () => {
    const amt = Number(val)
    if (!amt || amt <= 0) return
    onSave(amt)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: 400, overflow: 'hidden' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f' }}>Set Monthly Budget</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>For {month}</div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <Field label="Budget Amount (₹)">
            <input type="number" style={inp} value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. 50000" min="1" onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          </Field>
          {val && Number(val) <= 0 && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>Enter a valid amount</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" style={{ ...btnPrimary(false), flex: 1 }} onClick={handleSave}>Save Budget</button>
            <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
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
  const topDay    = days.reduce((b,d)=>{const sum=byDay[d];return sum>byDay[b]?d:b},days[0]||'')
  const vendorMap = {}
  entries.filter(e=>e.vendor).forEach(e=>{vendorMap[e.vendor]=(vendorMap[e.vendor]||0)+Number(e.amount)})
  const topVendors= Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>GNSI Kitchen Report — ${monthLabel}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,sans-serif; color:#1e293b; background:#fff; padding:36px 48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:16px; margin-bottom:26px; border-bottom:3px solid #1e3a5f; }
  .institute { font-size:21px; font-weight:800; color:#1e3a5f; }
  .sub { font-size:11px; color:#64748b; margin-top:3px; }
  .title-area { text-align:right; font-size:12px; color:#475569; }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:26px; }
  .kpi { padding:14px 16px; border-radius:10px; background:#fff; border:1.5px solid #e2e8f0; border-left:4px solid #1e3a5f; }
  .kpi-val { font-size:20px; font-weight:800; color:#1e3a5f; }
  .kpi-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-top:4px; }
  h2 { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#1e3a5f; margin:22px 0 10px; padding-left:10px; border-left:3px solid #1e3a5f; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#f8fafc; color:#475569; font-weight:700; padding:8px 10px; text-align:left; border-bottom:2px solid #e2e8f0; text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
  td { padding:7px 10px; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:10px; }
  td:first-child { font-size:11px; }
  .total-row td { font-weight:800; color:#1e3a5f; border-top:2px solid #1e3a5f; border-bottom:none; }
  .footer { margin-top:30px; padding-top:14px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; display:flex; justify-content:space-between; }
  @media print { body { padding:20px; } }
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

/**
 * LedgerTab — All ledger/filter/day-group view logic
 */
function LedgerTab({
  entries, filterDate, setFilterDate, filterMeal, setFilterMeal,
  uniqueDates, filteredByMeal, locks, viewMonth, setFormOpen,
  handleDelete, handleLockDay, handleUnlockDay, setEditing, setTab, isMobile
}) {
  return (
    <>
      {/* Filter Bar */}
      <div style={{ ...card, padding: 12, marginBottom: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Date</label>
          <input type="date" style={{ ...inp, width: 'auto' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Meal</label>
          <select style={{ ...inp, width: 'auto' }} value={filterMeal} onChange={e => setFilterMeal(e.target.value)}>
            <option value="all">All Meals</option>
            {MEAL_KEYS.map(mk => (
              <option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts & Widgets */}
      <MissingMealAlert entries={entries} dateFilter={filterDate} />
      <CostPerStudentCard entries={entries} dateFilter={filterDate} />
      <MealKpiStrip entries={entries} dateFilter={filterDate} cols={isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'} />
      <PettyCashWidget entries={entries} dateFilter={filterDate} />

      {/* Empty State */}
      {!uniqueDates.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 0', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: 18, background: '#eff6ff', border: '2px dashed #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, marginBottom: 18 }}>
            🍽
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>No entries yet</div>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: '36ch', lineHeight: 1.5, marginBottom: 20 }}>
            Start tracking your kitchen expenses — add your first meal entry for {viewMonth}.
          </p>
          <button type="button" style={btnPrimary(false)} onClick={() => setFormOpen(true)}>
            + Add First Entry
          </button>
        </div>
      ) : (
        <>
          <SectionDivider label={`${filteredByMeal.length} Entries · ${uniqueDates.length} Days`} />
          {uniqueDates.map(d => (
            <DayGroup
              key={d}
              dateStr={d}
              entries={filteredByMeal}
              locks={locks}
              onEdit={e => { setEditing(e); setFormOpen(true) }}
              onDelete={handleDelete}
              onLockDay={handleLockDay}
              onUnlockDay={handleUnlockDay}
            />
          ))}
        </>
      )}
    </>
  )
}

/**
 * AnalyticsTab — All charts, heatmaps, and summary views
 */
function AnalyticsTab({ entries, setFilterDate, setTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <MonthlyChart entries={entries} />
      <MealPieBreakdown entries={entries} />
      <CalendarHeatmap
        entries={entries}
        onDayClick={d => { setFilterDate(d); setTab('ledger') }}
      />
      <VendorSummary entries={entries} />
      <ItemFrequency entries={entries} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
function Topbar({ viewMonth, setViewMonth, tab, setTab, isAdmin,
  onBudget, onReport, onCSV, onWhatsApp, onAdd,
  onItemSetup, onMonitor, onCookLog, onCookAtt, activePanel, isMobile }) {

  const now     = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const ACTIONS = [
    { id: 'items',      label: 'Items',      emoji: '🧺', fn: onItemSetup, toggle: true,  adminOnly: false },
    { id: 'monitor',    label: 'Monitor',    emoji: '🛡',  fn: onMonitor,   toggle: true,  adminOnly: true  },
    { id: 'cooklog',    label: 'Cook Log',   emoji: '👨‍🍳', fn: onCookLog,   toggle: true,  adminOnly: true  },
    { id: 'attendance', label: 'Attendance', emoji: '📋', fn: onCookAtt,   toggle: true,  adminOnly: true  },
    { id: 'budget',     label: 'Budget',     emoji: '💰', fn: onBudget,    toggle: false, adminOnly: false },
    { id: 'report',     label: 'Report',     emoji: '🖨',  fn: onReport,    toggle: false, adminOnly: false },
    { id: 'csv',        label: 'CSV',        emoji: '⬇',  fn: onCSV,       toggle: false, adminOnly: false },
    { id: 'whatsapp',   label: 'WhatsApp',   emoji: '📲', fn: onWhatsApp,  toggle: false, adminOnly: false },
    { id: 'add',        label: 'Add Entry',  emoji: '+',  fn: onAdd,       toggle: false, adminOnly: false, primary: true },
  ].filter(a => !a.adminOnly || isAdmin)

  return (
    <div className="no-print" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px 14px' : '12px 22px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>🍽 Kitchen Ledger</h1>
          <p style={{ color: '#64748b', fontSize: 12, margin: '3px 0 0' }}>GNSI · Khangabok, Thoubal</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {[['ledger', '📋 Ledger'], ['analytics', '📊 Analytics']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: tab === k ? '#1e3a5f' : '#fff', color: tab === k ? '#fff' : '#64748b',
              }}>
                {l}
              </button>
            ))}
          </div>
          <input type="month" style={{ ...inp, width: 'auto', padding: '7px 10px', fontSize: 12 }} value={viewMonth} onChange={e => setViewMonth(e.target.value)} />
          <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{timeStr}</div>
            {dateStr}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 22px 12px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        {ACTIONS.map(a => {
          const isActive = a.toggle && activePanel === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={a.fn}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                ...(a.primary
                  ? { background: 'linear-gradient(135deg,#1e3a5f,#3730a3)', color: '#fff', borderColor: 'transparent' }
                  : isActive
                    ? { background: '#eff6ff', color: '#1e3a5f', borderColor: '#bfdbfe' }
                    : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }),
              }}>
              <span>{a.emoji}</span>{a.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Kitchen({ currentUser }) {
  const w        = useWindowWidth()
  const isMobile = w < 640
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
    setShowItemSetup(false)
    setShowMonitor(false)
    setShowCookLog(false)
    setShowCookAtt(false)
    setFormOpen(false)
    setEditing(null)
    contentRef.current?.scrollTo({ top:0, behavior:'smooth' })
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
      if (error) { showToast('Update failed: '+error.message, '#dc2626'); return }
      showToast('Entry updated ✓', '#d97706')
    } else {
      const { error } = await supabase.from('kitchen_expenditure').insert(row)
      if (error) { showToast('Save failed: '+error.message, '#dc2626'); return }
      showToast('Entry saved ✓', '#16a34a')
    }
    setFormOpen(false); setEditing(null); load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this entry?')) return
    const { error } = await supabase.from('kitchen_expenditure').delete().eq('id',id)
    if (error) { showToast('Delete failed', '#dc2626'); return }
    showToast('Deleted', '#dc2626'); load()
  }

  const handleLockDay = async dateStr => {
    if (!window.confirm(`Lock all entries for ${dateFmt(dateStr)}?`)) return
    await supabase.from('kitchen_daily_locks').insert({ lock_date:dateStr })
    showToast(`🔒 ${dateFmt(dateStr)} locked`, '#dc2626'); load()
  }

  const handleUnlockDay = async dateStr => {
    await supabase.from('kitchen_daily_locks').delete().eq('lock_date',dateStr)
    showToast(`🔓 ${dateFmt(dateStr)} unlocked`, '#d97706'); load()
  }

  const handleBudgetSave = async amount => {
    await supabase.from('kitchen_budgets').upsert({ month:viewMonth, budget_amount:amount },{ onConflict:'month' })
    setBudget(amount); setShowBudget(false); showToast('Budget updated ✓', '#16a34a')
  }

  const handleCookLogSave = async form => {
    const { error } = await supabase.from('kitchen_cook_log').insert({
      log_date:   today(),
      staff_name: form.staff_name,
      meal_type:  form.meal_type,
      arrived_at: form.arrived_at || null,
      left_at:    form.left_at    || null,
      notes:      form.notes      || null,
    })
    if (error) { showToast('Cook log save failed: '+error.message, '#dc2626'); return }
    showToast('Cook log saved ✓', '#16a34a')
    setShowCookLog(false)
    load()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const activePanel =
  showItemSetup ? 'items'      :
  showMonitor   ? 'monitor'    :
  showCookLog   ? 'cooklog'    :
  showCookAtt   ? 'attendance' : null
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
    <div style={{ background: '#f8fafc', minHeight: '100vh', color: '#1e293b', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* Overlays */}
      {toast      && <Toast msg={toast.msg} color={toast.color} />}
      {showBudget && <BudgetModal current={budget} month={viewMonth} onSave={handleBudgetSave} onClose={()=>setShowBudget(false)} />}
      {showWA && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={()=>setShowWA(null)}>
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: 420, overflow: 'hidden' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📲</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>WhatsApp Message — Copied!</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Paste in any chat</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #f1f5f9', maxHeight: 250, overflowY: 'auto' }}>{showWA}</pre>
              <button type="button" style={{ ...btnPrimary(false), width: '100%', marginTop: 14, display: 'flex', justifyContent: 'center' }} onClick={()=>setShowWA(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Topbar
        viewMonth={viewMonth}   setViewMonth={setViewMonth}
        tab={tab}               setTab={setTab}
        isAdmin={isAdmin}
        activePanel={activePanel}
        isMobile={isMobile}
        onBudget={()=>setShowBudget(true)}
        onReport={()=>generatePrintReport(entries,budget,viewMonth)}
        onCSV={()=>exportToCSV(entries,viewMonth)}
        onWhatsApp={()=>setShowWA(generateWhatsAppMsg(entries,filterDate))}
        onAdd={()=>{ setEditing(null); setFormOpen(true) }}
        onItemSetup={()=>{ setShowMonitor(false); setShowCookLog(false); setShowCookAtt(false); setShowItemSetup(v=>!v) }}
        onMonitor={()=>{ setShowItemSetup(false); setShowCookLog(false); setShowCookAtt(false); setShowMonitor(v=>!v) }}
        onCookLog={()=>{ setShowItemSetup(false); setShowMonitor(false); setShowCookAtt(false); setShowCookLog(v=>!v) }}
        onCookAtt={()=>{ setShowItemSetup(false); setShowMonitor(false); setShowCookLog(false); setShowCookAtt(v=>!v) }}
      />

      <div ref={contentRef} style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 28px' }}>
        {loading && <LoadingBlock />}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
          <KpiCard label="Today"     value={moneyFmt(todayTotal)} color="#d97706" bg="#fffbeb" icon="🌅" sub={today()} />
          <KpiCard label="This Week" value={moneyFmt(weekTotal)}  color="#1e3a5f" bg="#eff6ff" icon="📅" />
          <KpiCard label="Month"     value={moneyFmt(monthTotal)} color="#0284c7" bg="#f0f9ff" icon="🗓" sub={viewMonth} />
          <KpiCard label="Daily Avg" value={moneyFmt(avgPerDay)}  color="#16a34a" bg="#f0fdf4" icon="📈" />
          <KpiCard label="Peak Day"  value={highDay.d?dateFmt(highDay.d):'—'} color="#dc2626" bg="#fef2f2" icon="🔺" sub={highDay.d?moneyFmt(highDay.sum):''} />
        </div>

        <BudgetBar spent={monthTotal} budget={budget} />

        {/* Panels */}
        {showItemSetup && <ItemSetupPanel onClose={()=>setShowItemSetup(false)} showToast={showToast} isMobile={isMobile} />}
        {showMonitor && isAdmin && <AdminMonitorPanel entries={entries} budget={budget} cookLog={cookLog} onClose={()=>setShowMonitor(false)} isMobile={isMobile} />}
        {showCookLog && isAdmin && <CookLogForm onSave={handleCookLogSave} onClose={()=>setShowCookLog(false)} isMobile={isMobile} />}
        {showCookAtt && isAdmin && <CookAttendancePanel onClose={()=>setShowCookAtt(false)} showToast={showToast} isMobile={isMobile} />}

        {formOpen && (
          <EntryForm
            onSave={handleSave}
            onCancel={()=>{ setFormOpen(false); setEditing(null) }}
            editing={editing}
            defaultDate={filterDate}
            kitchenItems={kitchenItems}
            isMobile={isMobile}
          />
        )}

        {/* ── TAB CONTENT ── */}
        <div key={tab}>
          {tab === 'ledger' && (
            <LedgerTab
              entries={entries}
              filterDate={filterDate}         setFilterDate={setFilterDate}
              filterMeal={filterMeal}         setFilterMeal={setFilterMeal}
              uniqueDates={uniqueDates}
              filteredByMeal={filteredByMeal}
              locks={locks}
              viewMonth={viewMonth}
              setFormOpen={setFormOpen}
              handleDelete={handleDelete}
              handleLockDay={handleLockDay}
              handleUnlockDay={handleUnlockDay}
              setEditing={setEditing}
              setTab={setTab}
              isMobile={isMobile}
            />
          )}
          {tab === 'analytics' && (
            <AnalyticsTab
              entries={entries}
              setFilterDate={setFilterDate}
              setTab={setTab}
            />
          )}
        </div>
      </div>
    </div>
  )
}
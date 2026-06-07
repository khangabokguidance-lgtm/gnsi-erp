// Kitchen.jsx — GNSI Portal v3.0
// ─────────────────────────────────────────────────────────────────────────────
//  Daily Kitchen Expenditure Tracker — Upgraded Edition
//
//  NEW FEATURES:
//  1. Custom Item Manager  — add/edit/delete named items with default prices
//  2. Receipt Viewer       — full-screen image viewer with zoom + delete
//  3. UI Upgrade           — warm terracotta + saffron theme, Manipur-native feel
//  4. Item Setup System    — category-tagged item master with unit/price tracking
//  5. Professional Report  — print-ready monthly PDF report
//  6. Admin Monitor System — live dashboard, missing meal alerts, cook log,
//                            budget breach notifications
//  7. Day-to-day Manipur   — Meitei UI labels, Manipuri dish presets,
//                            local vendor names, INR-first formatting
//
//  Supabase Tables (new additions beyond v2):
//
//  kitchen_items
//    id           uuid PK DEFAULT gen_random_uuid()
//    name         text NOT NULL
//    name_meitei  text            -- Meitei name
//    category     text            -- 'grain','vegetable','protein','dairy','spice','oil','other'
//    unit         text            -- 'kg','g','litre','ml','piece','dozen'
//    default_price numeric(10,2)
//    is_active    boolean DEFAULT true
//    created_at   timestamptz DEFAULT now()
//
//  kitchen_cook_log
//    id           uuid PK DEFAULT gen_random_uuid()
//    log_date     date NOT NULL DEFAULT CURRENT_DATE
//    staff_name   text NOT NULL
//    meal_type    text NOT NULL
//    arrived_at   time
//    left_at      time
//    notes        text
//    created_at   timestamptz DEFAULT now()
//
//  (plus existing: kitchen_expenditure, kitchen_budgets, kitchen_daily_locks)
//  Enable Storage bucket: "kitchen-receipts" (public)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase.js'

// ─── Design Tokens — Warm Terracotta × Saffron (Manipur palette) ─────────────
const C = {
  terra:  { 50:'#FFF5F0',100:'#FFE8DC',200:'#FFD0BA',300:'#FFAD8A',400:'#FF8A5C',500:'#E8622A',600:'#C44E1C',700:'#A03A12',800:'#7A2A0A',900:'#521A04' },
  saffron:{ 50:'#FFFBEB',100:'#FEF3C7',200:'#FDE68A',300:'#FCD34D',400:'#FBBF24',500:'#F59E0B',600:'#D97706',700:'#B45309',800:'#92400E',900:'#78350F' },
  forest: { 50:'#F0FDF4',100:'#DCFCE7',200:'#BBF7D0',300:'#86EFAC',400:'#4ADE80',500:'#22C55E',600:'#16A34A',700:'#15803D',800:'#166534',900:'#14532D' },
  teal:   { 50:'#F0FDFA',100:'#CCFBF1',200:'#99F6E4',300:'#5EEAD4',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E',800:'#115E59',900:'#134E4A' },
  ink:    { 50:'#F8F4F0',100:'#EDE5DC',200:'#D9CCBE',300:'#C2AA96',400:'#A88870',500:'#8C6A50',600:'#6E5038',700:'#523A26',800:'#382618',900:'#20140A' },
  slate:  { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  rose:   { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  sky:    { 50:'#F0F9FF',100:'#E0F2FE',400:'#38BDF8',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' },
  violet: { 50:'#F5F3FF',100:'#EDE9FE',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
}

// ─── Meal Config ──────────────────────────────────────────────────────────────
const MEALS = {
  lunch:             { label:'Morning Lunch',       meitei:'Morning Lunch',       short:'Lunch',    emoji:'🍱', time:'12:30', bg:C.forest[600],  soft:C.forest[50],  border:C.forest[200],  text:C.forest[800]  },
  morning_breakfast: { label:'Afternoon Breakfast', meitei:'Afternoon Breakfast', short:'A.Bfast',  emoji:'☕', time:'14:30', bg:C.saffron[500], soft:C.saffron[50], border:C.saffron[200], text:C.saffron[800] },
  evening_breakfast: { label:'Evening Breakfast',   meitei:'Evening Breakfast',   short:'E.Bfast',  emoji:'🌇', time:'16:30', bg:C.terra[500],   soft:C.terra[50],   border:C.terra[200],   text:C.terra[800]   },
  dinner:            { label:'Dinner',              meitei:'Dinner',              short:'Dinner',   emoji:'🌙', time:'19:30', bg:C.teal[700],    soft:C.teal[50],    border:C.teal[200],    text:C.teal[800]    },
}
const MEAL_KEYS = ['lunch','morning_breakfast','evening_breakfast','dinner']
// ─── Cook Attendance Config ───────────────────────────────────────────────────
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

// ─── Manipuri Dish Presets by meal ───────────────────────────────────────────
  const MANIPURI_PRESETS = {
  lunch:             ['Chak (Rice)','Kangsoi','Eromba','Nga Thongba (Fish Curry)','Hawai Thongba','Alu Kangmet','Khichdi','Papad','Pickle','Sabzi'],
  morning_breakfast: ['Tea','Bread','Rusk','Halwa','Egg','Milk','Banana','Biscuit','Momo','Chak-hao Kheer'],
  evening_breakfast: ['Tea','Bread','Rusk','Singju','Pakora','Samosa','Bread Pakora','Chow Chow','Biscuit','Fruits'],
  dinner:            ['Chak (Rice)','Dal','Sabzi','Nga Thongba','Paneer','Chapati','Khichdi','Soup','Papad'],
}

// ─── Local Vendor Presets ─────────────────────────────────────────────────────
const LOCAL_VENDORS = ['Khangabok Market','Thoubal Bazaar','Ima Keithel','Wangjing Market','Chandani Shop','Imphal Market','Thangal Bazaar','Lamlong Bazaar','Local Farmer','Daily Supplier']

// ─── Item Categories ──────────────────────────────────────────────────────────
const ITEM_CATEGORIES = {
  grain:     { label:'Grain / Cereal',  meitei:'Grain', emoji:'🌾', color:C.saffron },
  vegetable: { label:'Vegetable',        meitei:'Vegetable',  emoji:'🥦', color:C.forest  },
  protein:   { label:'Protein',          meitei:'Protein',emoji:'🍗', color:C.terra   },
  dairy:     { label:'Dairy',            meitei:'Dairy',   emoji:'🥛', color:C.sky     },
  spice:     { label:'Spice / Masala',   meitei:'Spice',  emoji:'🌶️', color:C.rose    },
  oil:       { label:'Oil / Fat',        meitei:'Oil',  emoji:'🫙', color:C.ink     },
  other:     { label:'Other',            meitei:'Other', emoji:'📦', color:C.slate   },
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1.5px solid ${C.ink[200]}`, fontSize:13,
  outline:'none', boxSizing:'border-box', backgroundColor:'#fffaf7',
  color:C.ink[900], fontFamily:"'Georgia', 'Times New Roman', serif",
  transition:'border-color .15s, box-shadow .15s',
}
const labelSt = {
  display:'block', fontSize:11, fontWeight:700, color:C.ink[500],
  marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em',
  fontFamily:"system-ui, sans-serif",
}
const card = {
  background:'#fff', border:`1.5px solid ${C.ink[100]}`,
  borderRadius:12, padding:'16px 20px', marginBottom:16,
  boxShadow:'0 1px 4px rgba(164,100,50,.07)',
}
const btnPrimary = {
  padding:'10px 20px', borderRadius:9,
  background:`linear-gradient(135deg, ${C.terra[600]}, ${C.terra[400]})`,
  color:'#fff', border:'none', fontSize:13, fontWeight:700,
  cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6,
  boxShadow:`0 3px 10px rgba(196,78,28,.25)`,
}
const btnSecondary = (color=C.ink) => ({
  padding:'8px 16px', borderRadius:8,
  background:color[50], color:color[700],
  border:`1.5px solid ${color[200]}`, fontSize:12,
  fontWeight:700, cursor:'pointer',
  display:'inline-flex', alignItems:'center', gap:5,
})

// ─── Utilities ────────────────────────────────────────────────────────────────
const today    = () => new Date().toISOString().split('T')[0]
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
const dateFmt  = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const moneyFmt = n  => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const weekStart= () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0] }
const nowHHMM  = () => { const n=new Date(); return n.getHours()*100+n.getMinutes() }

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, color=C.forest[600] }) {
  return (
    <div style={{ position:'fixed',top:20,right:20,zIndex:999999,background:'#fff',
      border:`1px solid ${C.ink[100]}`,borderLeft:`4px solid ${color}`,
      borderRadius:10,padding:'12px 18px',fontSize:13,fontWeight:600,
      boxShadow:'0 8px 32px rgba(0,0,0,.14)',maxWidth:380,color:C.ink[800],
      fontFamily:"system-ui,sans-serif" }}>
      {msg}
    </div>
  )
}

// ─── Field Row ────────────────────────────────────────────────────────────────
function FieldRow({ label: lbl, sub, children }) {
  return (
    <div>
      <label style={labelSt}>{lbl}{sub && <span style={{ fontWeight:400,color:C.ink[400],marginLeft:4 }}>{sub}</span>}</label>
      {children}
    </div>
  )
}

// ─── Section Divider ─────────────────────────────────────────────────────────
function SectionDivider({ label: lbl }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,margin:'20px 0 14px',color:C.ink[300] }}>
      <div style={{ flex:1,height:1,background:`linear-gradient(to right,${C.terra[200]},transparent)` }} />
      <span style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',color:C.terra[500] }}>{lbl}</span>
      <div style={{ flex:1,height:1,background:`linear-gradient(to left,${C.terra[200]},transparent)` }} />
    </div>
  )
}

// ─── Meal Badge ───────────────────────────────────────────────────────────────
function MealBadge({ type, showMeitei=false }) {
  const m = MEALS[type]
  if (!m) return null
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',
      borderRadius:99,fontSize:11,fontWeight:700,
      background:m.soft,color:m.text,border:`1px solid ${m.border}` }}>
      {m.emoji} {m.short}
    </span>
  )
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  return (
    <div style={{ display:'flex',gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n===value?0:n)}
          style={{ fontSize:20,cursor:onChange?'pointer':'default',
            color:n<=value?C.saffron[500]:C.ink[200],transition:'color .1s' }}>★</span>
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label: lbl, value, accent, subtitle, icon, pulse }) {
  return (
    <div style={{ flex:1,minWidth:130,padding:'16px 18px',borderRadius:12,
      background:'#fff',border:`1.5px solid ${C.ink[100]}`,
      position:'relative',overflow:'hidden',
      boxShadow:'0 2px 8px rgba(164,100,50,.06)' }}>
      {pulse && <div style={{ position:'absolute',top:10,right:10,width:8,height:8,borderRadius:'50%',background:C.terra[500],animation:'blink 1.4s ease-in-out infinite' }} />}
      {icon && <div style={{ position:'absolute',right:14,top:12,fontSize:24,opacity:.1 }}>{icon}</div>}
      <div style={{ fontSize:22,fontWeight:800,color:accent||C.ink[800],lineHeight:1,fontFamily:"'Georgia',serif" }}>{value}</div>
      <div style={{ fontSize:10,fontWeight:700,color:C.ink[400],marginTop:5,textTransform:'uppercase',letterSpacing:'.06em',fontFamily:"system-ui,sans-serif" }}>{lbl}</div>
      {subtitle && <div style={{ fontSize:11,color:C.ink[300],marginTop:2 }}>{subtitle}</div>}
    </div>
  )
}

// ─── Meal KPI Strip ───────────────────────────────────────────────────────────
function MealKpiStrip({ entries, dateFilter }) {
  const dayEntries = entries.filter(e => e.expense_date === dateFilter)
  return (
    <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:14 }}>
      {MEAL_KEYS.map(mk => {
        const m   = MEALS[mk]
        const amt = dayEntries.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
        return (
          <div key={mk} style={{ flex:1,minWidth:110,padding:'12px 14px',borderRadius:10,
            background:m.soft,border:`1.5px solid ${m.border}`,position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',right:8,top:8,fontSize:20,opacity:.15 }}>{m.emoji}</div>
            <div style={{ fontSize:10,fontWeight:700,color:m.text,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2 }}>{m.short}</div>
            <div style={{ fontSize:16,fontWeight:800,color:m.text,lineHeight:1 }}>{moneyFmt(amt)}</div>
            <div style={{ fontSize:9,color:m.text,opacity:.7,marginTop:2 }}>{m.short}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Budget Progress Bar ──────────────────────────────────────────────────────
function BudgetBar({ spent, budget }) {
  if (!budget) return null
  const pct  = Math.min((spent/budget)*100, 100)
  const over = spent > budget
  const color= pct > 90 ? C.rose[500] : pct > 70 ? C.saffron[500] : C.forest[500]
  return (
    <div style={{ ...card, marginBottom:14 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <span style={{ fontSize:12,fontWeight:700,color:C.ink[600],fontFamily:"system-ui,sans-serif" }}>📊 Monthly Budget</span>
        <span style={{ fontSize:12,fontWeight:700,color:over?C.rose[600]:C.ink[700] }}>
          {moneyFmt(spent)} / {moneyFmt(budget)} {over && '⚠ OVER'}
        </span>
      </div>
      <div style={{ height:10,borderRadius:99,background:C.ink[100],overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${pct}%`,borderRadius:99,background:color,transition:'width .5s' }} />
      </div>
      <div style={{ fontSize:11,color:C.ink[400],marginTop:5,fontFamily:"system-ui,sans-serif" }}>
        {over ? `Over budget by ${moneyFmt(spent-budget)}` : `${moneyFmt(budget-spent)} (${(100-pct).toFixed(1)}% remaining)`}
      </div>
    </div>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function MonthlyChart({ entries }) {
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => { map[e.expense_date] = (map[e.expense_date]||0) + Number(e.amount) })
    return map
  }, [entries])

  const days = Object.keys(byDay).sort()
  if (days.length === 0) return null
  const max = Math.max(...Object.values(byDay), 1)
  const avg = Object.values(byDay).reduce((a,b)=>a+b,0) / days.length

  return (
    <div style={{ ...card }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
        <span style={{ fontSize:13,fontWeight:700,color:C.ink[700] }}>📈 Daily Spend — This Month</span>
        <span style={{ fontSize:11,color:C.ink[400] }}>Avg: {moneyFmt(avg)}/day</span>
      </div>
      <div style={{ display:'flex',alignItems:'flex-end',gap:3,height:90,overflowX:'auto' }}>
        {days.map(d => {
          const v = byDay[d]
          const h = Math.max((v/max)*78, 4)
          const isToday = d === today()
          const isHigh  = v === max
          return (
            <div key={d} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,flexShrink:0 }} title={`${dateFmt(d)}: ${moneyFmt(v)}`}>
              <div style={{ width:20,height:h,borderRadius:'4px 4px 0 0',
                background: isHigh ? C.rose[500] : isToday ? C.terra[500] : C.terra[300],
                transition:'height .3s' }} />
              <span style={{ fontSize:8,color:C.ink[400],transform:'rotate(-45deg)',transformOrigin:'center',display:'block',width:16,textAlign:'center' }}>
                {new Date(d+'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Meal Pie Breakdown ───────────────────────────────────────────────────────
function MealPieBreakdown({ entries }) {
  const totals = useMemo(() => {
    const map = {}
    MEAL_KEYS.forEach(k => { map[k]=0 })
    entries.forEach(e => { map[e.meal_type] = (map[e.meal_type]||0) + Number(e.amount) })
    return map
  }, [entries])
  const grand = Object.values(totals).reduce((a,b)=>a+b,0)
  if (grand === 0) return null
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13,fontWeight:700,color:C.ink[700],marginBottom:12 }}>🥧 Meal-wise Breakdown</div>
      <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
        {MEAL_KEYS.map(mk => {
          const m   = MEALS[mk]
          const amt = totals[mk]
          const pct = grand ? ((amt/grand)*100).toFixed(1) : 0
          return (
            <div key={mk}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:C.ink[600],marginBottom:3 }}>
                <span>{m.emoji} {m.label}</span>
                <span style={{ fontWeight:700 }}>{moneyFmt(amt)} ({pct}%)</span>
              </div>
              <div style={{ height:7,borderRadius:99,background:C.ink[100],overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${pct}%`,borderRadius:99,background:m.bg,transition:'width .5s' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────
function CalendarHeatmap({ entries, onDayClick }) {
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => { map[e.expense_date]=(map[e.expense_date]||0)+Number(e.amount) })
    return map
  }, [entries])
  const values   = Object.values(byDay)
  const max      = Math.max(...values, 1)
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth()
  const daysInM  = new Date(year, month+1, 0).getDate()
  const firstDOW = new Date(year, month, 1).getDay()
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
    cells.push({ d, iso, amt: byDay[iso]||0 })
  }
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13,fontWeight:700,color:C.ink[700],marginBottom:10 }}>
        🗓 Spend Heatmap — {now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4 }}>
        {['S','M','T','W','T','F','S'].map((d,i)=>(
          <div key={i} style={{ textAlign:'center',fontSize:9,fontWeight:700,color:C.ink[400],paddingBottom:2 }}>{d}</div>
        ))}
        {cells.map((c,i) => c===null
          ? <div key={`e${i}`} />
          : <div key={c.iso} onClick={() => onDayClick(c.iso)}
              title={`${dateFmt(c.iso)}: ${moneyFmt(c.amt)}`}
              style={{ aspectRatio:'1',borderRadius:5,background:getColor(c.amt),
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:9,fontWeight:700,color:c.amt?'#fff':C.ink[400],
                transition:'transform .1s',border:c.iso===today()?`2px solid ${C.terra[600]}`:'none' }}>
              {c.d}
            </div>
        )}
      </div>
      <div style={{ display:'flex',gap:8,marginTop:10,fontSize:10,color:C.ink[400],flexWrap:'wrap' }}>
        {[['None',C.ink[100]],['Low',C.saffron[200]],['Mid',C.saffron[400]],['High',C.terra[400]],['Peak',C.rose[500]]].map(([l,col])=>(
          <span key={l} style={{ display:'flex',alignItems:'center',gap:3 }}>
            <span style={{ width:10,height:10,borderRadius:2,background:col,display:'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Missing Meal Alert ───────────────────────────────────────────────────────
function MissingMealAlert({ entries, dateFilter }) {
  const present = entries.filter(e=>e.expense_date===dateFilter).map(e=>e.meal_type)
  const missing = MEAL_KEYS.filter(m => !present.includes(m))
  const hhmm    = nowHHMM()
  const overdue = missing.filter(mk => {
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return h*100+m < hhmm
  })
  if (overdue.length === 0 || dateFilter !== today()) return null
  return (
    <div style={{ marginBottom:14,padding:'12px 16px',borderRadius:10,
      background:C.rose[50],border:`1px solid ${C.rose[200]}` }}>
      <div style={{ fontSize:12,fontWeight:700,color:C.rose[700],marginBottom:6 }}>
        ⚠ Missing Meal Entries Today
      </div>
      <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
        {overdue.map(mk => <MealBadge key={mk} type={mk} />)}
      </div>
      <div style={{ fontSize:11,color:C.rose[500],marginTop:5 }}>
        These meals are past their scheduled time with no entry recorded.
      </div>
    </div>
  )
}

// ─── Vendor Summary ───────────────────────────────────────────────────────────
function VendorSummary({ entries }) {
  const vendors = useMemo(() => {
    const map = {}
    entries.filter(e=>e.vendor).forEach(e => {
      if (!map[e.vendor]) map[e.vendor] = { count:0, total:0 }
      map[e.vendor].count++
      map[e.vendor].total += Number(e.amount)
    })
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,6)
  }, [entries])
  if (vendors.length===0) return null
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13,fontWeight:700,color:C.ink[700],marginBottom:10 }}>🏪 Top Vendors (This Month)</div>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
        {vendors.map(([name, { count, total }]) => (
          <div key={name} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'7px 12px',borderRadius:8,background:C.ink[50],border:`1px solid ${C.ink[100]}` }}>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:C.ink[700] }}>{name}</div>
              <div style={{ fontSize:10,color:C.ink[400] }}>{count} purchases</div>
            </div>
            <div style={{ fontSize:14,fontWeight:800,color:C.teal[600] }}>{moneyFmt(total)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Item Frequency ───────────────────────────────────────────────────────────
function ItemFrequency({ entries }) {
  const freq = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!e.item_details) return
      e.item_details.split(',').map(s=>s.trim()).filter(Boolean).forEach(item => {
        map[item] = (map[item]||0)+1
      })
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12)
  }, [entries])
  if (freq.length===0) return null
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13,fontWeight:700,color:C.ink[700],marginBottom:10 }}>🥦 Most Used Items</div>
      <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
        {freq.map(([item,count]) => (
          <span key={item} style={{ padding:'4px 11px',borderRadius:99,background:C.saffron[50],
            border:`1px solid ${C.saffron[200]}`,fontSize:11,fontWeight:700,color:C.saffron[800] }}>
            {item} <span style={{ color:C.saffron[500] }}>×{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Cost Per Student ─────────────────────────────────────────────────────────
function CostPerStudentCard({ entries, dateFilter }) {
  const dayEntries = entries.filter(e=>e.expense_date===dateFilter && e.pax_count>0)
  if (dayEntries.length===0) return null
  const totalAmt = dayEntries.reduce((s,e)=>s+Number(e.amount),0)
  const avgPax   = dayEntries.reduce((s,e)=>s+Number(e.pax_count),0)/dayEntries.length
  const cps      = avgPax > 0 ? totalAmt/avgPax : 0
  return (
    <div style={{ padding:'12px 16px',borderRadius:10,background:C.sky[50],
      border:`1px solid ${C.sky[200]}`,marginBottom:14,display:'flex',alignItems:'center',gap:14 }}>
      <span style={{ fontSize:28 }}>👤</span>
      <div>
        <div style={{ fontSize:18,fontWeight:800,color:C.sky[700] }}>{moneyFmt(cps)}</div>
        <div style={{ fontSize:11,color:C.sky[600] }}>
          Cost per student today · Avg {Math.round(avgPax)} served
        </div>
      </div>
    </div>
  )
}

// ─── Petty Cash Widget ────────────────────────────────────────────────────────
function PettyCashWidget({ entries, dateFilter }) {
  const [given, setGiven]     = useState('')
  const [cashLog, setCashLog] = useState([])
  const daySpend   = entries.filter(e=>e.expense_date===dateFilter).reduce((s,e)=>s+Number(e.amount),0)
  const totalGiven = cashLog.filter(c=>c.date===dateFilter).reduce((s,c)=>s+Number(c.amount),0)
  const balance    = totalGiven - daySpend
  const addCash    = () => {
    const amt = parseFloat(given)
    if (!amt||amt<=0) return
    setCashLog(prev => [...prev, { date:dateFilter,amount:amt,at:new Date().toLocaleTimeString() }])
    setGiven('')
  }
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13,fontWeight:700,color:C.ink[700],marginBottom:10 }}>💵 Petty Cash Ledger</div>
      <div style={{ display:'flex',gap:8,marginBottom:10 }}>
        <input type="number" style={{ ...inp,flex:1 }} placeholder="Cash given (₹)" value={given} onChange={e=>setGiven(e.target.value)} />
        <button onClick={addCash} style={{ ...btnSecondary(C.teal) }}>+ Add</button>
      </div>
      <div style={{ display:'flex',gap:14,fontSize:12 }}>
        <span>Given: <strong style={{ color:C.forest[600] }}>{moneyFmt(totalGiven)}</strong></span>
        <span>Spent: <strong style={{ color:C.rose[600] }}>{moneyFmt(daySpend)}</strong></span>
        <span>Balance: <strong style={{ color: balance>=0?C.forest[600]:C.rose[600] }}>{moneyFmt(Math.abs(balance))} {balance<0?'short':''}</strong></span>
      </div>
      {cashLog.filter(c=>c.date===dateFilter).map((c,i)=>(
        <div key={i} style={{ fontSize:11,color:C.ink[400],marginTop:5 }}>✓ {moneyFmt(c.amount)} at {c.at}</div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 1 — RECEIPT VIEWER
// ═══════════════════════════════════════════════════════════════════════════════
function ReceiptViewer({ url, onClose, onDelete }) {
  const [zoom, setZoom] = useState(1)
  if (!url) return null
  const isPDF = url.toLowerCase().includes('.pdf')
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(20,10,5,.92)',zIndex:99999,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute',top:16,right:16,display:'flex',gap:10 }}>
        {!isPDF && <>
          <button onClick={e=>{e.stopPropagation();setZoom(z=>Math.min(z+.25,3))}} style={{ ...btnSecondary(C.ink),background:'rgba(255,255,255,.15)',color:'#fff',border:'none' }}>🔍+</button>
          <button onClick={e=>{e.stopPropagation();setZoom(z=>Math.max(z-.25,.5))}} style={{ ...btnSecondary(C.ink),background:'rgba(255,255,255,.15)',color:'#fff',border:'none' }}>🔍−</button>
        </>}
        <a href={url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
          style={{ ...btnSecondary(C.teal),background:'rgba(255,255,255,.15)',color:'#fff',border:'none',textDecoration:'none' }}>⬇ Download</a>
        {onDelete && <button onClick={e=>{e.stopPropagation();onDelete()}} style={{ ...btnSecondary(C.rose),background:'rgba(255,255,255,.15)',color:C.rose[300],border:'none' }}>🗑 Delete</button>}
        <button onClick={onClose} style={{ ...btnSecondary(C.ink),background:'rgba(255,255,255,.15)',color:'#fff',border:'none' }}>✕ Close</button>
      </div>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:'90vw',maxHeight:'85vh',overflow:'auto' }}>
        {isPDF
          ? <iframe src={url} style={{ width:'80vw',height:'80vh',border:'none',borderRadius:10 }} title="Receipt PDF" />
          : <img src={url} alt="Receipt" style={{ transform:`scale(${zoom})`,transformOrigin:'top center',maxWidth:'85vw',borderRadius:10,boxShadow:'0 20px 60px rgba(0,0,0,.5)',transition:'transform .2s' }} />
        }
      </div>
      {!isPDF && <div style={{ marginTop:10,fontSize:11,color:'rgba(255,255,255,.4)' }}>Zoom: {Math.round(zoom*100)}% · Click outside to close</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 4 — ITEM SETUP SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function ItemSetupPanel({ onClose, showToast }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })
  const [editId, setEditId]   = useState(null)
  const [search, setSearch]   = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const loadItems = async () => {
    setLoading(true)
    const { data } = await supabase.from('kitchen_items').select('*').order('category').order('name')
    setItems(data||[])
    setLoading(false)
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
    setForm({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })
    setEditId(null)
    loadItems()
  }

  const toggleActive = async (id, val) => {
    await supabase.from('kitchen_items').update({ is_active:!val }).eq('id',id)
    loadItems()
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
    <div style={{ ...card, border:`1.5px solid ${C.saffron[200]}`, marginBottom:16 }}>
      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:800,color:C.terra[700] }}>🧺 Item Setup System</div>
          <div style={{ fontSize:11,color:C.ink[400] }}>Manage your kitchen item master list</div>
        </div>
        <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${C.ink[200]}`,background:'#fff',cursor:'pointer',fontSize:16,color:C.ink[500] }}>✕</button>
      </div>

      {/* Add/Edit Form */}
      <div style={{ background:C.saffron[50],border:`1px solid ${C.saffron[200]}`,borderRadius:10,padding:'14px 16px',marginBottom:16 }}>
        <div style={{ fontSize:12,fontWeight:700,color:C.saffron[800],marginBottom:10 }}>{editId ? '✏️ Edit Item' : '➕ Add New Item'}</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <FieldRow label="Item Name (English)">
            <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rice" />
          </FieldRow>
          <FieldRow label="Local Name (Optional)">
            <input style={inp} value={form.name_meitei} onChange={e=>setForm(f=>({...f,name_meitei:e.target.value}))} placeholder="e.g. local/alternate name" />
          </FieldRow>
          <FieldRow label="Category">
            <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              {Object.entries(ITEM_CATEGORIES).map(([k,v])=>(
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Unit">
            <select style={inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
              {['kg','g','litre','ml','piece','dozen','packet','bundle'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Default Price (₹ per unit)">
            <input type="number" style={inp} value={form.default_price} onChange={e=>setForm(f=>({...f,default_price:e.target.value}))} placeholder="0.00" />
          </FieldRow>
        </div>
        <div style={{ display:'flex',gap:8,marginTop:12 }}>
          <button onClick={handleSave} style={{ ...btnPrimary }}>{editId ? 'Update' : '+ Add Item'}</button>
          {editId && <button onClick={()=>{setEditId(null);setForm({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })}} style={{ ...btnSecondary(C.ink) }}>Cancel</button>}
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <input style={{ ...inp,flex:1,minWidth:120 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…" />
        <select style={{ ...inp,width:'auto' }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {Object.entries(ITEM_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
      </div>

      {/* Item List */}
      {loading ? <div style={{ textAlign:'center',color:C.ink[400],padding:'20px 0' }}>Loading…</div> : (
        <div style={{ display:'flex',flexDirection:'column',gap:6,maxHeight:320,overflowY:'auto' }}>
          {filtered.length===0 && <div style={{ textAlign:'center',color:C.ink[400],padding:'20px 0',fontSize:12 }}>No items found</div>}
          {filtered.map(it => {
            const cat = ITEM_CATEGORIES[it.category]||ITEM_CATEGORIES.other
            return (
              <div key={it.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'9px 12px',borderRadius:8,
                background:it.is_active?'#fff':C.ink[50],
                border:`1px solid ${it.is_active?cat.color[200]:C.ink[100]}`,
                opacity:it.is_active?1:.6 }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <span style={{ fontSize:16 }}>{cat.emoji}</span>
                  <div>
                    <div style={{ fontSize:12,fontWeight:700,color:C.ink[800] }}>
                      {it.name} {it.name_meitei && <span style={{ color:C.ink[400],fontWeight:400 }}>· {it.name_meitei}</span>}
                    </div>
                    <div style={{ fontSize:10,color:C.ink[400] }}>{cat.label} · {it.unit}{it.default_price?` · ₹${it.default_price}/${it.unit}`:''}</div>
                  </div>
                </div>
                <div style={{ display:'flex',gap:6 }}>
                  <button onClick={()=>startEdit(it)} style={{ padding:'4px 10px',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',border:`1px solid ${C.ink[200]}`,background:C.ink[50],color:C.ink[600] }}>Edit</button>
                  <button onClick={()=>toggleActive(it.id,it.is_active)} style={{ padding:'4px 10px',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',border:`1px solid ${it.is_active?C.rose[200]:C.forest[200]}`,background:it.is_active?C.rose[50]:C.forest[50],color:it.is_active?C.rose[600]:C.forest[600] }}>
                    {it.is_active?'Disable':'Enable'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 5 — ADMIN MONITOR SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function AdminMonitorPanel({ entries, budget, cookLog, onClose }) {
  const todayEntries  = entries.filter(e=>e.expense_date===today())
  const todayTotal    = todayEntries.reduce((s,e)=>s+Number(e.amount),0)
  const monthTotal    = entries.reduce((s,e)=>s+Number(e.amount),0)
  const presentMeals  = todayEntries.map(e=>e.meal_type)
  const missingMeals  = MEAL_KEYS.filter(m=>!presentMeals.includes(m))
  const budgetPct     = budget ? (monthTotal/budget)*100 : 0
  const hhmm          = nowHHMM()
  const overdueAlerts = missingMeals.filter(mk => {
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return h*100+m < hhmm
  })
  const todayCookLog  = cookLog.filter(l=>l.log_date===today())

  // Per-meal spend status
  const mealStatus = MEAL_KEYS.map(mk => {
    const mealEntries = todayEntries.filter(e=>e.meal_type===mk)
    const amt         = mealEntries.reduce((s,e)=>s+Number(e.amount),0)
    const [h,m]       = MEALS[mk].time.split(':').map(Number)
    const isDue       = h*100+m < hhmm
    const isLogged    = mealEntries.length > 0
    return { mk, amt, isDue, isLogged, entries: mealEntries }
  })

  return (
    <div style={{ ...card, border:`1.5px solid ${C.terra[200]}`, marginBottom:16 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <div>
          <div style={{ fontSize:15,fontWeight:800,color:C.terra[700] }}>🛡 Admin Monitor Dashboard</div>
          <div style={{ fontSize:11,color:C.ink[400] }}>Live kitchen oversight — {dateFmt(today())}</div>
        </div>
        <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${C.ink[200]}`,background:'#fff',cursor:'pointer',fontSize:16,color:C.ink[500] }}>✕</button>
      </div>

      {/* Live KPIs */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:14 }}>
        <KpiCard label="Today Spend" value={moneyFmt(todayTotal)} accent={C.terra[600]} icon="💸" pulse />
        <KpiCard label="Month Spend" value={moneyFmt(monthTotal)} accent={C.ink[700]} icon="🗓" />
        {budget && <KpiCard label="Budget Used" value={`${budgetPct.toFixed(1)}%`} accent={budgetPct>90?C.rose[600]:C.saffron[600]} icon="📊" />}
        <KpiCard label="Meals Today" value={`${presentMeals.length}/4`} accent={presentMeals.length===4?C.forest[600]:C.rose[600]} icon="🍽" />
      </div>

      {/* Budget Breach Alert */}
      {budgetPct > 90 && (
        <div style={{ padding:'12px 16px',borderRadius:10,background:C.rose[50],border:`1px solid ${C.rose[200]}`,marginBottom:12 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.rose[700] }}>
            🚨 Budget Breach Alert — {budgetPct.toFixed(1)}% consumed!
          </div>
          <div style={{ fontSize:11,color:C.rose[500],marginTop:3 }}>
            Spent {moneyFmt(monthTotal)} of {moneyFmt(budget)} monthly budget
          </div>
        </div>
      )}

      {/* Overdue Meal Alerts */}
      {overdueAlerts.length > 0 && (
        <div style={{ padding:'12px 16px',borderRadius:10,background:C.saffron[50],border:`1px solid ${C.saffron[300]}`,marginBottom:12 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.saffron[800],marginBottom:6 }}>
            ⏰ Missing Meal Entries (Past Due)
          </div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {overdueAlerts.map(mk=><MealBadge key={mk} type={mk} />)}
          </div>
        </div>
      )}

      {/* Meal-by-meal status grid */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14 }}>
        {mealStatus.map(({ mk, amt, isDue, isLogged, entries: me }) => {
          const m = MEALS[mk]
          const statusColor = isLogged ? C.forest[600] : isDue ? C.rose[600] : C.ink[400]
          const statusLabel = isLogged ? '✓ Logged' : isDue ? '⚠ Missing' : '⏳ Upcoming'
          return (
            <div key={mk} style={{ padding:'10px 14px',borderRadius:10,background:m.soft,border:`1.5px solid ${m.border}` }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                <span style={{ fontSize:13 }}>{m.emoji} <strong>{m.short}</strong></span>
                <span style={{ fontSize:10,fontWeight:700,color:statusColor,padding:'2px 7px',borderRadius:99,background:'rgba(255,255,255,.7)' }}>{statusLabel}</span>
              </div>
              <div style={{ fontSize:14,fontWeight:800,color:m.text }}>{moneyFmt(amt)}</div>
              <div style={{ fontSize:10,color:m.text,opacity:.7 }}>Scheduled: {m.time}</div>
              {me.length>0 && me[0].prepared_by && (
                <div style={{ fontSize:10,color:m.text,opacity:.8,marginTop:3 }}>👨‍🍳 {me[0].prepared_by}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cook/Staff Activity Log */}
      <div style={{ borderTop:`1px solid ${C.ink[100]}`,paddingTop:14 }}>
        <div style={{ fontSize:12,fontWeight:700,color:C.ink[600],marginBottom:10 }}>👨‍🍳 Cook Activity Log — Today</div>
        {todayCookLog.length===0
          ? <div style={{ fontSize:11,color:C.ink[400],textAlign:'center',padding:'12px 0' }}>No cook log entries today</div>
          : todayCookLog.map(log => (
            <div key={log.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderRadius:7,background:C.ink[50],border:`1px solid ${C.ink[100]}`,marginBottom:5 }}>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:C.ink[700] }}>{log.staff_name}</div>
                <div style={{ fontSize:10,color:C.ink[400] }}><MealBadge type={log.meal_type} /> {log.arrived_at&&`In: ${log.arrived_at}`} {log.left_at&&`· Out: ${log.left_at}`}</div>
              </div>
              {log.notes && <div style={{ fontSize:10,color:C.ink[400],maxWidth:160,textAlign:'right' }}>{log.notes}</div>}
            </div>
          ))
        }
      </div>

      {/* Last updated */}
      <div style={{ textAlign:'right',fontSize:10,color:C.ink[300],marginTop:10 }}>
        🔄 Live data · Refreshes on each page load
      </div>
    </div>
  )
}

// ─── Cook Log Entry Form ──────────────────────────────────────────────────────
function CookLogForm({ onSave, onClose }) {
  const [form, setForm] = useState({ staff_name:'',meal_type:'lunch',arrived_at:'',left_at:'',notes:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const valid = form.staff_name && form.meal_type
  return (
    <div style={{ ...card, border:`1.5px solid ${C.forest[200]}`, marginBottom:14 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
        <div style={{ fontSize:14,fontWeight:800,color:C.forest[700] }}>👨‍🍳 Log Cook Activity</div>
        <button onClick={onClose} style={{ width:28,height:28,borderRadius:7,border:`1px solid ${C.ink[200]}`,background:'#fff',cursor:'pointer',color:C.ink[500] }}>✕</button>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        <FieldRow label="Staff / Cook Name">
          <input style={inp} value={form.staff_name} onChange={e=>set('staff_name',e.target.value)} placeholder="Name" />
        </FieldRow>
        <FieldRow label="Meal">
          <select style={inp} value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
            {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Arrived At">
          <input type="time" style={inp} value={form.arrived_at} onChange={e=>set('arrived_at',e.target.value)} />
        </FieldRow>
        <FieldRow label="Left At">
          <input type="time" style={inp} value={form.left_at} onChange={e=>set('left_at',e.target.value)} />
        </FieldRow>
        <div style={{ gridColumn:'1/-1' }}>
          <FieldRow label="Notes">
            <input style={inp} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
          </FieldRow>
        </div>
      </div>
      <div style={{ display:'flex',gap:8,marginTop:12 }}>
        <button onClick={()=>valid&&onSave(form)} disabled={!valid} style={{ ...btnPrimary }}>Save Log</button>
        <button onClick={onClose} style={{ ...btnSecondary(C.ink) }}>Cancel</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 5 — PROFESSIONAL REPORT (Print / PDF)
// ═══════════════════════════════════════════════════════════════════════════════
function generatePrintReport(entries, budget, monthLabel) {
  const total     = entries.reduce((s,e)=>s+Number(e.amount),0)
  const byMeal    = {}
  MEAL_KEYS.forEach(k=>{byMeal[k]=0})
  entries.forEach(e=>{byMeal[e.meal_type]=(byMeal[e.meal_type]||0)+Number(e.amount)})
  const byDay     = {}
  entries.forEach(e=>{byDay[e.expense_date]=(byDay[e.expense_date]||0)+Number(e.amount)})
  const days      = Object.keys(byDay).sort()
  const avgPerDay = days.length ? total/days.length : 0
  const topDay    = days.reduce((b,d)=>byDay[d]>byDay[b]?d:b, days[0])

  const vendorMap = {}
  entries.filter(e=>e.vendor).forEach(e=>{ vendorMap[e.vendor]=(vendorMap[e.vendor]||0)+Number(e.amount) })
  const topVendors = Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>GNSI Kitchen Report — ${monthLabel}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Georgia',serif; color:#2a1a0a; background:#fff; padding:32px 40px; }
  .header { border-bottom:3px solid #c44e1c; padding-bottom:16px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:flex-end; }
  .institute { font-size:20px; font-weight:800; color:#c44e1c; }
  .sub { font-size:11px; color:#8c6a50; margin-top:2px; }
  .report-title { font-size:13px; font-weight:700; color:#6e5038; text-align:right; }
  .kpi-row { display:flex; gap:16px; margin-bottom:24px; }
  .kpi { flex:1; padding:14px 18px; border-radius:8px; background:#fff5f0; border:1.5px solid #ffd0ba; }
  .kpi-val { font-size:22px; font-weight:800; color:#c44e1c; }
  .kpi-lbl { font-size:10px; color:#8c6a50; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-top:3px; font-family:system-ui,sans-serif; }
  h2 { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#c44e1c; margin:20px 0 10px; border-left:3px solid #c44e1c; padding-left:10px; font-family:system-ui,sans-serif; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#fff5f0; color:#6e5038; font-weight:700; padding:7px 10px; text-align:left; border-bottom:2px solid #ffd0ba; text-transform:uppercase; letter-spacing:.04em; font-family:system-ui,sans-serif; }
  td { padding:6px 10px; border-bottom:1px solid #ede5dc; color:#2a1a0a; }
  tr:last-child td { border-bottom:none; }
  .total-row td { font-weight:800; color:#c44e1c; border-top:2px solid #c44e1c; }
  .meal-dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:5px; vertical-align:middle; }
  .footer { margin-top:30px; padding-top:12px; border-top:1px solid #ede5dc; font-size:10px; color:#a88870; display:flex; justify-content:space-between; font-family:system-ui,sans-serif; }
  @media print { body { padding:20px; } button { display:none; } }
</style></head><body>
  <div class="header">
    <div>
      <div class="institute">🏫 Guidance Navodaya & Sainik Institute</div>
      <div class="sub">Khangabok, Thoubal, Manipur · Kitchen Expenditure Report</div>
    </div>
    <div class="report-title">Month: ${monthLabel}<br>Generated: ${new Date().toLocaleString('en-IN')}</div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Total Expenditure</div></div>
    <div class="kpi"><div class="kpi-val">${entries.length}</div><div class="kpi-lbl">Total Entries</div></div>
    <div class="kpi"><div class="kpi-val">₹${avgPerDay.toLocaleString('en-IN',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Daily Average</div></div>
    ${budget?`<div class="kpi"><div class="kpi-val">${((total/budget)*100).toFixed(1)}%</div><div class="kpi-lbl">Budget Used (₹${Number(budget).toLocaleString('en-IN')})</div></div>`:''}
  </div>

  <h2>Meal-wise Summary</h2>
  <table>
    <thead><tr><th>Meal</th><th>Entries</th><th>Amount</th><th>% of Total</th></tr></thead>
    <tbody>
      ${MEAL_KEYS.map(mk=>{
        const m = MEALS[mk]
        const cnt = entries.filter(e=>e.meal_type===mk).length
        const amt = byMeal[mk]
        const pct = total ? ((amt/total)*100).toFixed(1) : 0
        return `<tr><td>${m.emoji} ${m.label}</td><td>${cnt}</td><td>₹${amt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>${pct}%</td></tr>`
      }).join('')}
      <tr class="total-row"><td>TOTAL</td><td>${entries.length}</td><td>₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>100%</td></tr>
    </tbody>
  </table>

  <h2>Daily Expenditure Log</h2>
  <table>
    <thead><tr><th>Date</th><th>Mor. Lunch</th><th>A.Bfast</th><th>E.Bfast</th><th>Dinner</th><th>Day Total</th></tr></thead>    <tbody>
      ${days.map(d=>{
        const dE = entries.filter(e=>e.expense_date===d)
        const mAmt = mk => dE.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
        const dt = byDay[d]
        return `<tr><td>${new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',weekday:'short'})}</td>
          ${MEAL_KEYS.map(mk=>`<td>${mAmt(mk)?'₹'+mAmt(mk).toFixed(2):'—'}</td>`).join('')}
          <td><strong>₹${dt.toFixed(2)}</strong>${d===topDay?' 🔺':''}</td></tr>`
      }).join('')}
    </tbody>
  </table>

  ${topVendors.length>0?`
  <h2>Top Vendors</h2>
  <table>
    <thead><tr><th>Vendor / Market</th><th>Amount</th></tr></thead>
    <tbody>${topVendors.map(([name,amt])=>`<tr><td>${name}</td><td>₹${amt.toFixed(2)}</td></tr>`).join('')}</tbody>
  </table>`:''}

  <div class="footer">
    <span>GNSI Kitchen Report · ${monthLabel}</span>
    <span>Khangabok, Thoubal, Manipur · guidancekhangabok.in</span>
    <span>Page 1 of 1</span>
  </div>

  <script>window.onload = () => window.print()</script>
</body></html>`

  const win = window.open('','_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Export to CSV ────────────────────────────────────────────────────────────
function exportToCSV(entries, month) {
  const headers = ['Date','Meal','Amount','Items','Vendor','Staff','Students','Rating','Serving Time','Notes']
  const rows = entries.map(e => [
    e.expense_date, MEALS[e.meal_type]?.label||e.meal_type,
    e.amount, e.item_details||'', e.vendor||'', e.prepared_by||'',
    e.pax_count||'', e.meal_rating||'', e.serving_time||'', e.notes||'',
  ])
  const csv  = [headers, ...rows].map(r => r.map(c=>`"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv'})
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `gnsi-kitchen-${month}.csv`
  a.click()
}

function generateWhatsAppMsg(entries, dateStr) {
  const dayE  = entries.filter(e=>e.expense_date===dateStr)
  const total = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const lines = MEAL_KEYS.map(mk=>{
    const m   = MEALS[mk]
    const amt = dayE.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
    return amt > 0 ? `${m.emoji} ${m.label}: ₹${amt.toFixed(2)}` : null
  }).filter(Boolean)
  const msg = `🍽 *GNSI Kitchen Report — ${dateFmt(dateStr)}*\n\n${lines.join('\n')}\n\n*Total: ₹${total.toFixed(2)}*\n\n_Guidance Navodaya & Sainik Institute, Khangabok_`
  navigator.clipboard?.writeText(msg).catch(()=>{})
  return msg
}

// ═══════════════════════════════════════════════════════════════════════════════
// COOK ATTENDANCE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function CookAttendancePanel({ onClose, showToast }) {
  const [attDate,   setAttDate]   = useState(today())
  const [monthly,   setMonthly]   = useState([])   // month summary rows
  const [loading,   setLoading]   = useState(false)
  const [view,      setView]      = useState('mark') // 'mark' | 'monthly'
  const [viewMonth, setViewMonth] = useState(monthKey())

  // local draft: { 'CookName__shift': { status, check_in, check_out, notes } }
  const [draft, setDraft] = useState({})

  const draftKey = (cook, shift) => `${cook}__${shift}`

  // ── Load day records ────────────────────────────────────────────────────
  const loadDay = async (date) => {
    setLoading(true)
    const { data } = await supabase
      .from('kitchen_cook_attendance')
      .select('*')
      .eq('att_date', date)
   const rows = data || []
    // seed draft from DB
    const d = {}
    COOKS.forEach(cook => {
      Object.keys(COOK_SHIFTS).forEach(shift => {
        const row = rows.find(r => r.cook_name === cook && r.shift === shift)
        d[draftKey(cook, shift)] = {
          status:    row?.status    || 'present',
          check_in:  row?.check_in  || COOK_SHIFTS[shift].defaultIn,
          check_out: row?.check_out || COOK_SHIFTS[shift].defaultOut,
          notes:     row?.notes     || '',
          id:        row?.id        || null,
        }
      })
    })
    setDraft(d)
    setLoading(false)
  }

  // ── Load monthly summary ────────────────────────────────────────────────
  const loadMonthly = async (month) => {
    setLoading(true)
    const from = `${month}-01`
    const to   = `${month}-31`
    const { data } = await supabase
      .from('kitchen_cook_attendance')
      .select('*')
      .gte('att_date', from)
      .lte('att_date', to)
    setMonthly(data || [])
    setLoading(false)
  }

  useEffect(() => { loadDay(attDate) }, [attDate])
  useEffect(() => { if (view === 'monthly') loadMonthly(viewMonth) }, [view, viewMonth])

  const setField = (cook, shift, field, val) => {
    setDraft(d => ({ ...d, [draftKey(cook, shift)]: { ...d[draftKey(cook, shift)], [field]: val } }))
  }

  // ── Save one row ────────────────────────────────────────────────────────
  const saveRow = async (cook, shift) => {
    const dk  = draftKey(cook, shift)
    const rec = draft[dk]
    const row = {
      att_date:  attDate,
      cook_name: cook,
      shift,
      status:    rec.status,
      check_in:  rec.status === 'absent' ? null : (rec.check_in  || null),
      check_out: rec.status === 'absent' ? null : (rec.check_out || null),
      notes:     rec.notes || null,
    }
    const { error } = await supabase
      .from('kitchen_cook_attendance')
      .upsert(row, { onConflict: 'att_date,cook_name,shift' })
    if (error) { showToast('Save failed: ' + error.message, C.rose[600]); return }
    showToast(`${cook.split(' ')[0]} ${COOK_SHIFTS[shift].short} saved ✓`, C.forest[600])
    loadDay(attDate)
  }

  // ── Save all ────────────────────────────────────────────────────────────
  const saveAll = async () => {
    setLoading(true)
    const rows = []
    COOKS.forEach(cook => {
      Object.keys(COOK_SHIFTS).forEach(shift => {
        const rec = draft[draftKey(cook, shift)]
        rows.push({
          att_date:  attDate,
          cook_name: cook,
          shift,
          status:    rec.status,
          check_in:  rec.status === 'absent' ? null : (rec.check_in  || null),
          check_out: rec.status === 'absent' ? null : (rec.check_out || null),
          notes:     rec.notes || null,
        })
      })
    })
    const { error } = await supabase
      .from('kitchen_cook_attendance')
      .upsert(rows, { onConflict: 'att_date,cook_name,shift' })
    setLoading(false)
    if (error) { showToast('Save failed: ' + error.message, C.rose[600]); return }
    showToast('All attendance saved ✓', C.forest[600])
    loadDay(attDate)
  }

  // ── Monthly summary calc ────────────────────────────────────────────────
  const monthlySummary = useMemo(() => {
    return COOKS.map(cook => {
      const rows = monthly.filter(r => r.cook_name === cook)
      const present   = rows.filter(r => r.status === 'present').length
      const absent    = rows.filter(r => r.status === 'absent').length
      const half      = rows.filter(r => r.status === 'half_day').length
      const totalDays = present + absent + half
      const pct       = totalDays ? Math.round(((present + half * 0.5) / totalDays) * 100) : 0
      // per shift
      const mPresent = rows.filter(r => r.shift === 'morning' && r.status === 'present').length
      const ePresent = rows.filter(r => r.shift === 'evening' && r.status === 'present').length
      return { cook, present, absent, half, pct, mPresent, ePresent, totalDays }
    })
  }, [monthly])

  const statusStyle = (status, selected) => {
    const base = { padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', border:'1.5px solid transparent', transition:'all .15s' }
    if (status === 'present')  return { ...base, background: selected ? C.forest[600] : C.forest[50],  color: selected ? '#fff' : C.forest[700], border: `1.5px solid ${selected ? C.forest[600] : C.forest[200]}` }
    if (status === 'absent')   return { ...base, background: selected ? C.rose[600]   : C.rose[50],    color: selected ? '#fff' : C.rose[700],   border: `1.5px solid ${selected ? C.rose[600]   : C.rose[200]  }` }
    if (status === 'half_day') return { ...base, background: selected ? C.saffron[500]: C.saffron[50], color: selected ? '#fff' : C.saffron[700],border: `1.5px solid ${selected ? C.saffron[500]: C.saffron[200]}` }
    return base
  }

  return (
    <div style={{ ...card, border:`1.5px solid ${C.teal[200]}`, marginBottom:16 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.teal[700] }}>👩‍🍳 Cook Attendance</div>
          <div style={{ fontSize:11, color:C.ink[400] }}>Morning 6:30–9:00 AM · Evening 6:00–9:00 PM</div>
        </div>
        <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.ink[200]}`, background:'#fff', cursor:'pointer', fontSize:16, color:C.ink[500] }}>✕</button>
      </div>

      {/* ── View Toggle + Date ── */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:`1.5px solid ${C.ink[200]}` }}>
          {[['mark','📋 Mark'],['monthly','📊 Monthly']].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ padding:'7px 16px', background: view===k ? C.teal[600] : '#fff', color: view===k ? '#fff' : C.ink[600], border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        {view === 'mark' && (
          <input type="date" style={{ ...inp, width:'auto', padding:'7px 12px', fontSize:12 }}
            value={attDate} onChange={e => { setAttDate(e.target.value) }} />
        )}
        {view === 'monthly' && (
          <input type="month" style={{ ...inp, width:'auto', padding:'7px 12px', fontSize:12 }}
            value={viewMonth} onChange={e => setViewMonth(e.target.value)} />
        )}
      </div>

      {/* ══ MARK VIEW ══ */}
      {view === 'mark' && (
        <>
          {loading
            ? <div style={{ textAlign:'center', color:C.ink[400], padding:'20px 0', fontSize:12 }}>Loading…</div>
            : Object.entries(COOK_SHIFTS).map(([shift, sh]) => (
              <div key={shift} style={{ marginBottom:18 }}>
                {/* Shift Header */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:9,
                  background:sh.bg, border:`1.5px solid ${sh.border}`, marginBottom:10 }}>
                  <span style={{ fontSize:16 }}>{sh.emoji}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:sh.text }}>{sh.label}</div>
                    <div style={{ fontSize:10, color:sh.text, opacity:.7 }}>🕐 {sh.time}</div>
                  </div>
                  {/* Shift summary badges */}
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    {['present','absent','half_day'].map(st => {
                      const cnt = COOKS.filter(c => draft[draftKey(c, shift)]?.status === st).length
                      if (!cnt) return null
                      const colors = { present:C.forest, absent:C.rose, half_day:C.saffron }
                      const col = colors[st]
                      return (
                        <span key={st} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                          background:col[50], color:col[700], border:`1px solid ${col[200]}` }}>
                          {st === 'present' ? '✓' : st === 'absent' ? '✗' : '½'} {cnt}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Cook rows */}
                {COOKS.map((cook, ci) => {
                  const dk  = draftKey(cook, shift)
                  const rec = draft[dk] || {}
                  const isAbsent = rec.status === 'absent'
                  return (
                    <div key={cook} style={{ marginBottom:8, padding:'12px 14px', borderRadius:10,
                      background: isAbsent ? C.rose[50] : '#fff',
                      border:`1.5px solid ${isAbsent ? C.rose[200] : C.ink[100]}`,
                      opacity: isAbsent ? .85 : 1 }}>

                      {/* Cook name + status buttons */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom: isAbsent ? 0 : 10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:30, height:30, borderRadius:'50%', background:sh.bg, border:`1.5px solid ${sh.border}`,
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:sh.text }}>
                            {cook[0]}
                          </div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:C.ink[800] }}>{cook}</div>
                            <div style={{ fontSize:10, color:C.ink[400] }}>Cook #{ci + 1}</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          {['present','absent','half_day'].map(st => (
                            <button key={st} onClick={() => setField(cook, shift, 'status', st)}
                              style={statusStyle(st, rec.status === st)}>
                              {st === 'present' ? '✓ Present' : st === 'absent' ? '✗ Absent' : '½ Half Day'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Check-in / Check-out — hidden if absent */}
                      {!isAbsent && (
                        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <label style={{ ...labelSt, marginBottom:0, fontSize:10 }}>IN</label>
                            <input type="time" style={{ ...inp, width:'auto', padding:'5px 9px', fontSize:12 }}
                              value={rec.check_in || ''} onChange={e => setField(cook, shift, 'check_in', e.target.value)} />
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <label style={{ ...labelSt, marginBottom:0, fontSize:10 }}>OUT</label>
                            <input type="time" style={{ ...inp, width:'auto', padding:'5px 9px', fontSize:12 }}
                              value={rec.check_out || ''} onChange={e => setField(cook, shift, 'check_out', e.target.value)} />
                          </div>
                          <div style={{ flex:1, minWidth:120 }}>
                            <input style={{ ...inp, padding:'5px 9px', fontSize:11 }}
                              value={rec.notes || ''} onChange={e => setField(cook, shift, 'notes', e.target.value)}
                              placeholder="Notes…" />
                          </div>
                          <button onClick={() => saveRow(cook, shift)}
                            style={{ padding:'5px 12px', borderRadius:7, background:C.teal[50], color:C.teal[700],
                              border:`1px solid ${C.teal[200]}`, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          }

          {/* Save All button */}
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={saveAll} disabled={loading}
              style={{ ...btnPrimary, background:`linear-gradient(135deg,${C.teal[700]},${C.teal[500]})`,
                boxShadow:`0 3px 10px rgba(13,148,136,.25)` }}>
              {loading ? 'Saving…' : '💾 Save All Attendance'}
            </button>
          </div>
        </>
      )}

      {/* ══ MONTHLY VIEW ══ */}
      {view === 'monthly' && (
        <div>
          {loading
            ? <div style={{ textAlign:'center', color:C.ink[400], padding:'20px 0', fontSize:12 }}>Loading…</div>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {monthlySummary.map(({ cook, present, absent, half, pct, mPresent, ePresent, totalDays }) => {
                  const pctColor = pct >= 90 ? C.forest[600] : pct >= 70 ? C.saffron[600] : C.rose[600]
                  return (
                    <div key={cook} style={{ padding:'14px 16px', borderRadius:10, background:'#fff',
                      border:`1.5px solid ${C.ink[100]}`, boxShadow:'0 1px 4px rgba(164,100,50,.05)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background:C.teal[50],
                            border:`1.5px solid ${C.teal[200]}`, display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:14, fontWeight:800, color:C.teal[700] }}>
                            {cook[0]}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:C.ink[800] }}>{cook}</div>
                            <div style={{ fontSize:10, color:C.ink[400] }}>{totalDays} shifts recorded · {viewMonth}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:20, fontWeight:800, color:pctColor }}>{pct}%</div>
                      </div>

                      {/* Attendance bar */}
                      <div style={{ height:8, borderRadius:99, background:C.ink[100], overflow:'hidden', marginBottom:8 }}>
                        <div style={{ height:'100%', width:`${pct}%`, borderRadius:99,
                          background: pct >= 90 ? C.forest[500] : pct >= 70 ? C.saffron[500] : C.rose[500],
                          transition:'width .5s' }} />
                      </div>

                      {/* Stats row */}
                      <div style={{ display:'flex', gap:14, fontSize:11, flexWrap:'wrap' }}>
                        <span style={{ color:C.forest[600], fontWeight:700 }}>✓ Present: {present}</span>
                        <span style={{ color:C.rose[600],   fontWeight:700 }}>✗ Absent: {absent}</span>
                        <span style={{ color:C.saffron[600],fontWeight:700 }}>½ Half: {half}</span>
                        <span style={{ color:C.teal[600],   fontWeight:700 }}>🌅 Morning: {mPresent}</span>
                        <span style={{ color:C.terra[600],  fontWeight:700 }}>🌇 Evening: {ePresent}</span>
                      </div>
                    </div>
                  )
                })}

                {/* Monthly shift-wise grid */}
                {monthly.length > 0 && (
                  <div style={{ ...card, marginTop:4 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.ink[700], marginBottom:12 }}>
                      📅 Day-wise Detail — {viewMonth}
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding:'6px 10px', textAlign:'left', background:C.ink[50], color:C.ink[600], fontWeight:700, borderBottom:`2px solid ${C.ink[100]}`, whiteSpace:'nowrap' }}>Cook</th>
                            {[...new Set(monthly.map(r => r.att_date))].sort().map(d => (
                              <th key={d} style={{ padding:'6px 6px', textAlign:'center', background:C.ink[50], color:C.ink[600], fontWeight:700, borderBottom:`2px solid ${C.ink[100]}`, whiteSpace:'nowrap', fontSize:9 }}>
                                {new Date(d+'T00:00:00').getDate()}<br/>
                                <span style={{ fontWeight:400, color:C.ink[400] }}>{new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {COOKS.map(cook => {
                            const dates = [...new Set(monthly.map(r => r.att_date))].sort()
                            return (
                              <tr key={cook} style={{ borderBottom:`1px solid ${C.ink[100]}` }}>
                                <td style={{ padding:'7px 10px', fontWeight:700, color:C.ink[700], whiteSpace:'nowrap', fontSize:10 }}>
                                  {cook.split(' ').slice(0,2).join(' ')}
                                </td>
                                {dates.map(d => {
                                  const mRow = monthly.find(r => r.cook_name===cook && r.att_date===d && r.shift==='morning')
                                  const eRow = monthly.find(r => r.cook_name===cook && r.att_date===d && r.shift==='evening')
                                  const cell = (row) => {
                                    if (!row) return <span style={{ color:C.ink[300] }}>—</span>
                                    if (row.status==='present')  return <span style={{ color:C.forest[600], fontWeight:800 }}>✓</span>
                                    if (row.status==='absent')   return <span style={{ color:C.rose[600],   fontWeight:800 }}>✗</span>
                                    if (row.status==='half_day') return <span style={{ color:C.saffron[600],fontWeight:800 }}>½</span>
                                  }
                                  return (
                                    <td key={d} style={{ padding:'5px 6px', textAlign:'center', verticalAlign:'middle' }}>
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1, fontSize:11 }}>
                                        <span title="Morning">{cell(mRow)}</span>
                                        <span title="Evening" style={{ fontSize:9, opacity:.7 }}>{cell(eRow)}</span>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize:10, color:C.ink[400], marginTop:8 }}>
                      Top row = 🌅 Morning · Bottom row = 🌇 Evening &nbsp;·&nbsp; ✓ Present &nbsp;✗ Absent &nbsp;½ Half Day
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
// ENTRY FORM (upgraded)
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
  const [uploading, setUploading] = useState(false)
  const [viewReceipt, setViewReceipt] = useState(false)
  const [customItem, setCustomItem]   = useState('')
  const m   = MEALS[form.meal_type]
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const addItem = item => {
    const cur = form.item_details.trim()
    set('item_details', cur ? cur + ', ' + item : item)
  }

  const addCustomItem = () => {
    if (!customItem.trim()) return
    addItem(customItem.trim())
    setCustomItem('')
  }

  const handleFileUpload = async e => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `receipts/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('kitchen-receipts').upload(path, file, { upsert:true })
    if (!error) {
      const { data: pub } = supabase.storage.from('kitchen-receipts').getPublicUrl(data.path)
      set('receipt_url', pub.publicUrl)
    }
    setUploading(false)
  }

  const handleDeleteReceipt = async () => {
    set('receipt_url', '')
    setViewReceipt(false)
  }

  const valid = form.meal_type && form.expense_date && Number(form.amount) > 0
  const presets = MANIPURI_PRESETS[form.meal_type] || []
  const dbItems = kitchenItems.filter(it=>it.is_active)

  return (
    <>
      {viewReceipt && form.receipt_url && (
        <ReceiptViewer url={form.receipt_url} onClose={()=>setViewReceipt(false)} onDelete={handleDeleteReceipt} />
      )}
      <div style={{ background:'#fff',border:`1.5px solid ${m.border}`,borderRadius:14,overflow:'hidden',marginBottom:16 }}>
        <div style={{ background:m.soft,borderBottom:`1px solid ${m.border}`,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div style={{ fontSize:15,fontWeight:800,color:m.text }}>
            {editing ? `✏️ Edit — ${m.label}` : `➕ Add ${m.label}`}
          </div>
          <button onClick={onCancel} style={{ width:30,height:30,borderRadius:8,border:`1px solid ${m.border}`,background:'#fff',cursor:'pointer',fontSize:16,color:C.ink[500] }}>✕</button>
        </div>

        <div style={{ padding:'20px' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4 }}>

            <FieldRow label="Meal *">
              <select style={inp} value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
                {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
              </select>
            </FieldRow>

            <FieldRow label="Date *">
              <input type="date" style={inp} value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} />
            </FieldRow>

            <FieldRow label="Amount (₹) *">
              <input type="number" style={inp} value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </FieldRow>

            <FieldRow label="Serving Time">
              <input type="time" style={inp} value={form.serving_time} onChange={e=>set('serving_time',e.target.value)} />
            </FieldRow>

            {/* Items */}
            <div style={{ gridColumn:'1/-1' }}>
              <FieldRow label="Items / Ingredients">
                <input style={inp} value={form.item_details} onChange={e=>set('item_details',e.target.value)} placeholder="e.g. Chak, Dal, Eromba…" />

                {/* Manipuri dish presets */}
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:10,fontWeight:700,color:C.terra[600],marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em' }}>
                    🍛 Manipuri Dishes (Quick Add)
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                    {presets.map(item=>(
                      <button key={item} onClick={()=>addItem(item)}
                        style={{ padding:'3px 9px',borderRadius:99,border:`1px solid ${C.saffron[200]}`,background:C.saffron[50],fontSize:10,fontWeight:600,cursor:'pointer',color:C.saffron[800] }}>
                        +{item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DB Items */}
                {dbItems.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:10,fontWeight:700,color:C.teal[700],marginBottom:5,textTransform:'uppercase',letterSpacing:'.06em' }}>
                      🧺 Your Item List (Quick Add)
                    </div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                      {dbItems.map(it=>(
                        <button key={it.id} onClick={()=>addItem(it.name)}
                          style={{ padding:'3px 9px',borderRadius:99,border:`1px solid ${C.teal[200]}`,background:C.teal[50],fontSize:10,fontWeight:600,cursor:'pointer',color:C.teal[800] }}>
                          +{it.name}{it.name_meitei?` / ${it.name_meitei}`:''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom item input */}
                <div style={{ display:'flex',gap:8,marginTop:8 }}>
                  <input style={{ ...inp,flex:1,fontSize:12 }} value={customItem}
                    onChange={e=>setCustomItem(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&addCustomItem()}
                    placeholder="Type custom item + Enter" />
                  <button onClick={addCustomItem} style={{ ...btnSecondary(C.terra) }}>+ Add</button>
                </div>
              </FieldRow>
            </div>

            <FieldRow label="Prepared By">
              <input style={inp} value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)} placeholder="Cook / Staff name" />
            </FieldRow>

            <FieldRow label="Vendor / Supplier">
              <select style={inp} value={form.vendor} onChange={e=>set('vendor',e.target.value)}>
                <option value="">— Select or type —</option>
                {LOCAL_VENDORS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              {!LOCAL_VENDORS.includes(form.vendor) && form.vendor && (
                <input style={{ ...inp,marginTop:5,fontSize:12 }} value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Custom vendor name" />
              )}
              {LOCAL_VENDORS.includes(form.vendor) || !form.vendor ? (
                <input style={{ ...inp,marginTop:5,fontSize:12 }} value={form.vendor==='—'?'':form.vendor}
                  onChange={e=>set('vendor',e.target.value)} placeholder="Or type custom vendor…" />
              ) : null}
            </FieldRow>

            <FieldRow label="Students Served">
              <input type="number" style={inp} value={form.pax_count} onChange={e=>set('pax_count',e.target.value)} placeholder="0" min="0" />
            </FieldRow>

            <FieldRow label="Meal Quality Rating">
              <StarRating value={form.meal_rating} onChange={v=>set('meal_rating',v)} />
            </FieldRow>

            <div style={{ gridColumn:'1/-1' }}>
              <FieldRow label="Notes">
                <textarea style={{ ...inp,resize:'vertical' }} rows={2} value={form.notes}
                  onChange={e=>set('notes',e.target.value)} placeholder="Any observations about this meal…" />
              </FieldRow>
            </div>

            {/* Receipt Upload — FEATURE 2 */}
            <div style={{ gridColumn:'1/-1' }}>
              <FieldRow label="📎 Receipt Photo / Bill">
                <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize:11 }} />
                  {uploading && <span style={{ fontSize:11,color:C.ink[400],animation:'pulse 1s ease-in-out infinite' }}>Uploading…</span>}
                  {form.receipt_url && (
                    <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                      <button onClick={()=>setViewReceipt(true)}
                        style={{ padding:'5px 12px',borderRadius:7,background:C.sky[50],border:`1px solid ${C.sky[200]}`,color:C.sky[700],fontSize:11,fontWeight:700,cursor:'pointer' }}>
                        👁 View Receipt
                      </button>
                      <button onClick={handleDeleteReceipt}
                        style={{ padding:'5px 12px',borderRadius:7,background:C.rose[50],border:`1px solid ${C.rose[200]}`,color:C.rose[600],fontSize:11,fontWeight:700,cursor:'pointer' }}>
                        🗑 Remove
                      </button>
                      <span style={{ fontSize:10,color:C.forest[600],fontWeight:700 }}>✓ Uploaded</span>
                    </div>
                  )}
                </div>
                {form.receipt_url && (
                  <div style={{ marginTop:8,padding:'8px 10px',borderRadius:8,background:C.sky[50],border:`1px solid ${C.sky[200]}`,fontSize:11,color:C.sky[600] }}>
                    Receipt stored · <a href={form.receipt_url} target="_blank" rel="noreferrer" style={{ color:C.sky[600],fontWeight:700 }}>Open in new tab ↗</a>
                  </div>
                )}
              </FieldRow>
            </div>

          </div>

          <div style={{ display:'flex',gap:10,marginTop:16 }}>
            <button onClick={()=>valid&&onSave(editing?.id||null,form)} disabled={!valid}
              style={{ ...btnPrimary, background:valid?`linear-gradient(135deg,${m.bg},${m.bg}cc)`:`linear-gradient(135deg,${C.ink[200]},${C.ink[100]})`, cursor:valid?'pointer':'not-allowed', boxShadow:valid?`0 3px 10px rgba(0,0,0,.2)`:'none' }}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </button>
            <button onClick={onCancel} style={{ ...btnSecondary(C.ink) }}>Cancel</button>
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
      <div style={{ background:'#fff',border:`1.5px solid ${m?.border||C.ink[200]}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap',boxShadow:'0 1px 4px rgba(164,100,50,.05)' }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap' }}>
            <MealBadge type={e.meal_type} />
            <span style={{ fontSize:18,fontWeight:800,color:m?.text||C.ink[800],fontFamily:"'Georgia',serif" }}>{moneyFmt(e.amount)}</span>
            {e.meal_rating>0 && <StarRating value={e.meal_rating} />}
            {e.receipt_url && (
              <button onClick={()=>setViewReceipt(true)}
                style={{ padding:'2px 9px',borderRadius:99,background:C.sky[50],border:`1px solid ${C.sky[200]}`,color:C.sky[700],fontSize:10,fontWeight:700,cursor:'pointer' }}>
                📎 Receipt
              </button>
            )}
          </div>
          <div style={{ display:'flex',gap:12,fontSize:11,color:C.ink[500],flexWrap:'wrap' }}>
            {e.item_details && <span>🥦 {e.item_details}</span>}
            {e.prepared_by  && <span>👨‍🍳 {e.prepared_by}</span>}
            {e.vendor       && <span>🏪 {e.vendor}</span>}
            {e.pax_count    && <span>👥 {e.pax_count} students</span>}
            {e.serving_time && <span>🕐 {e.serving_time}</span>}
            {e.pax_count>0  && <span style={{ color:C.teal[600],fontWeight:600 }}>₹{(e.amount/e.pax_count).toFixed(2)}/student</span>}
          </div>
          {e.notes && <div style={{ marginTop:6,fontSize:11,color:C.ink[400],padding:'4px 8px',background:C.ink[50],borderRadius:6 }}>{e.notes}</div>}
        </div>
        {!locked && (
          <div style={{ display:'flex',gap:6,flexShrink:0 }}>
            <button onClick={()=>onEdit(e)} style={{ padding:'5px 12px',borderRadius:7,background:C.ink[50],color:C.ink[600],border:`1px solid ${C.ink[200]}`,fontSize:11,fontWeight:700,cursor:'pointer' }}>Edit</button>
            <button onClick={()=>onDelete(e.id)} style={{ padding:'5px 12px',borderRadius:7,background:C.rose[50],color:C.rose[500],border:`1px solid ${C.rose[200]}`,fontSize:11,fontWeight:700,cursor:'pointer' }}>Del</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Day Group ────────────────────────────────────────────────────────────────
function DayGroup({ dateStr, entries, locks, onEdit, onDelete, onLockDay, onUnlockDay }) {
  const dayE   = entries.filter(e=>e.expense_date===dateStr)
  const total  = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const isToday= dateStr===today()
  const locked = locks.includes(dateStr)
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,
        padding:'9px 14px',borderRadius:9,
        background: isToday ? C.terra[50] : C.ink[50],
        border:`1.5px solid ${isToday?C.terra[200]:C.ink[200]}` }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:12,fontWeight:800,color:isToday?C.terra[700]:C.ink[700] }}>
            {isToday ? '📌 Today — ' : ''}{dateFmt(dateStr)}
          </span>
          {locked && <span style={{ fontSize:10,fontWeight:700,color:C.rose[600],padding:'2px 8px',borderRadius:99,background:C.rose[50],border:`1px solid ${C.rose[200]}` }}>🔒 Locked</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:15,fontWeight:800,color:C.ink[800],fontFamily:"'Georgia',serif" }}>{moneyFmt(total)}</span>
          {!locked
            ? <button onClick={()=>onLockDay(dateStr)} style={{ padding:'4px 10px',borderRadius:7,background:C.rose[50],color:C.rose[600],border:`1px solid ${C.rose[200]}`,fontSize:10,fontWeight:700,cursor:'pointer' }}>🔒 Lock Day</button>
            : <button onClick={()=>onUnlockDay(dateStr)} style={{ padding:'4px 10px',borderRadius:7,background:C.saffron[50],color:C.saffron[700],border:`1px solid ${C.saffron[200]}`,fontSize:10,fontWeight:700,cursor:'pointer' }}>🔓 Unlock</button>
          }
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {dayE.map(e=><EntryCard key={e.id} e={e} locked={locked} onEdit={onEdit} onDelete={onDelete} />)}
        {dayE.length===0 && <div style={{ fontSize:12,color:C.ink[400],textAlign:'center',padding:'12px 0' }}>No entries for this date</div>}
      </div>
    </div>
  )
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ current, month, onSave, onClose }) {
  const [val, setVal] = useState(current||'')
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(40,20,10,.4)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#fff',borderRadius:16,padding:28,width:380,boxShadow:'0 20px 60px rgba(0,0,0,.25)',border:`1.5px solid ${C.terra[200]}` }}>
        <div style={{ fontSize:16,fontWeight:800,color:C.terra[700],marginBottom:3 }}>💰 Set Monthly Budget</div>
        <div style={{ fontSize:12,color:C.ink[400],marginBottom:16 }}>For {month}</div>
        <input type="number" style={{ ...inp,marginBottom:16 }} value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. 50000" />
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={()=>onSave(Number(val))} style={{ ...btnPrimary, flex:1, justifyContent:'center' }}>Save Budget</button>
          <button onClick={onClose} style={{ ...btnSecondary(C.ink) }}>Cancel</button>
        </div>
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
  const [showCookAtt, setShowCookAtt] = useState(false)

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(()=>setToast(null),3500) }

  // ─── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [from, to] = [`${viewMonth}-01`, `${viewMonth}-31`]

    const [{ data: eData }, { data: lData }, { data: bData }, { data: iData }, { data: clData }] = await Promise.all([
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

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleSave = async (eid, form) => {
    const row = {
      meal_type:    form.meal_type,
      expense_date: form.expense_date,
      amount:       Number(form.amount),
      item_details: form.item_details||null,
      prepared_by:  form.prepared_by||null,
      pax_count:    Number(form.pax_count)||null,
      vendor:       form.vendor||null,
      meal_rating:  Number(form.meal_rating)||null,
      serving_time: form.serving_time||null,
      receipt_url:  form.receipt_url||null,
      notes:        form.notes||null,
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
    if (!confirm('Delete this entry?')) return
    const { error } = await supabase.from('kitchen_expenditure').delete().eq('id',id)
    if (error) { showToast('Delete failed: '+error.message, C.rose[600]); return }
    showToast('Deleted', C.rose[600]); load()
  }

  const handleLockDay = async dateStr => {
    if (!confirm(`Lock all entries for ${dateFmt(dateStr)}?`)) return
    const { error } = await supabase.from('kitchen_daily_locks').insert({ lock_date:dateStr })
    if (error) { showToast('Lock failed: '+error.message, C.rose[600]); return }
    showToast(`🔒 ${dateFmt(dateStr)} locked`, C.rose[500]); load()
  }

  const handleUnlockDay = async dateStr => {
    const { error } = await supabase.from('kitchen_daily_locks').delete().eq('lock_date',dateStr)
    if (error) { showToast('Unlock failed', C.rose[600]); return }
    showToast(`🔓 ${dateFmt(dateStr)} unlocked`, C.saffron[600]); load()
  }

  const handleBudgetSave = async amount => {
    const { error } = await supabase.from('kitchen_budgets').upsert({ month:viewMonth, budget_amount:amount },{ onConflict:'month' })
    if (error) { showToast('Budget save failed', C.rose[600]); return }
    setBudget(amount); setShowBudget(false); showToast('Budget updated ✓', C.forest[600])
  }

  const handleCookLogSave = async form => {
    const { error } = await supabase.from('kitchen_cook_log').insert({
      log_date:   today(),
      staff_name: form.staff_name,
      meal_type:  form.meal_type,
      arrived_at: form.arrived_at||null,
      left_at:    form.left_at||null,
      notes:      form.notes||null,
    })
    if (error) { showToast('Cook log save failed', C.rose[600]); return }
    showToast('Cook log saved ✓', C.forest[600]); setShowCookLog(false); load()
  }

  // ─── Derived ─────────────────────────────────────────────────────────────
  const filteredByMeal = filterMeal==='all' ? entries : entries.filter(e=>e.meal_type===filterMeal)
  const uniqueDates    = [...new Set(filteredByMeal.map(e=>e.expense_date))].sort().reverse()
  const todayTotal     = entries.filter(e=>e.expense_date===today()).reduce((s,e)=>s+Number(e.amount),0)
  const weekTotal      = entries.filter(e=>e.expense_date>=weekStart()).reduce((s,e)=>s+Number(e.amount),0)
  const monthTotal     = entries.reduce((s,e)=>s+Number(e.amount),0)
  const allDays        = [...new Set(entries.map(e=>e.expense_date))]
  const avgPerDay      = allDays.length ? monthTotal/allDays.length : 0
  const highDay        = allDays.reduce((best,d)=>{
    const sum=entries.filter(e=>e.expense_date===d).reduce((s,e)=>s+Number(e.amount),0)
    return sum>best.sum?{d,sum}:best
  },{ d:null,sum:0 })

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:14,color:C.ink[400],fontFamily:"system-ui,sans-serif" }}>
      <div style={{ width:22,height:22,border:`2.5px solid ${C.ink[100]}`,borderTopColor:C.terra[600],borderRadius:'50%',animation:'spin .7s linear infinite' }} />
      <span style={{ fontWeight:600 }}>Loading kitchen data…</span>
    </div>
  )

  return (
    <div style={{ padding:'0 24px 40px',fontFamily:"system-ui,'Segoe UI',sans-serif",background:'#faf7f4',minHeight:'100vh' }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        select:focus, input:focus, textarea:focus {
          border-color:${C.terra[400]}!important;
          box-shadow:0 0 0 3px ${C.terra[100]}!important;
        }
      `}</style>

      {toast    && <Toast msg={toast.msg} color={toast.color} />}
      {showBudget && <BudgetModal current={budget} month={viewMonth} onSave={handleBudgetSave} onClose={()=>setShowBudget(false)} />}
      {showWA && (
        <div style={{ position:'fixed',inset:0,background:'rgba(20,10,5,.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={()=>setShowWA(null)}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:400,boxShadow:'0 20px 60px rgba(0,0,0,.3)',border:`1.5px solid ${C.forest[200]}` }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:14,fontWeight:700,color:C.forest[700],marginBottom:10 }}>📲 WhatsApp Message — Copied!</div>
            <pre style={{ fontSize:12,color:C.ink[600],whiteSpace:'pre-wrap',background:C.ink[50],borderRadius:8,padding:12,border:`1px solid ${C.ink[100]}`,maxHeight:280,overflowY:'auto' }}>{showWA}</pre>
            <button onClick={()=>setShowWA(null)} style={{ marginTop:12,...btnPrimary }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding:'28px 0 16px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:14 }}>
        <div>
          <div style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.14em',color:C.terra[400],marginBottom:5 }}>GNSI Portal · Khangabok</div>
          <div style={{ fontSize:27,fontWeight:800,color:C.ink[900],letterSpacing:'-.02em',lineHeight:1.1,fontFamily:"'Georgia',serif" }}>
            🍽 Kitchen Expenditure
          </div>
          <div style={{ fontSize:14,color:C.ink[500],marginTop:4 }}>Kitchen Expenditure · {viewMonth}</div>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <button onClick={()=>setShowItemSetup(v=>!v)} style={{ ...btnSecondary(C.saffron) }}>🧺 Items</button>
          {isAdmin && <button onClick={()=>setShowMonitor(v=>!v)} style={{ ...btnSecondary(C.terra) }}>🛡 Monitor</button>}
         {isAdmin && <button onClick={()=>setShowCookLog(v=>!v)} style={{ ...btnSecondary(C.forest) }}>👨‍🍳 Cook Log</button>}
          {isAdmin && <button onClick={()=>setShowCookAtt(v=>!v)} style={{ ...btnSecondary(C.forest) }}>👩‍🍳 Cook Att.</button>}
          <button onClick={()=>setShowBudget(true)} style={{ ...btnSecondary(C.teal) }}>💰 Budget</button>
          <button onClick={()=>generatePrintReport(entries, budget, viewMonth)} style={{ ...btnSecondary(C.violet) }}>🖨 Report</button>
          <button onClick={()=>exportToCSV(entries,viewMonth)} style={{ ...btnSecondary(C.ink) }}>⬇ CSV</button>
          <button onClick={()=>{ const msg=generateWhatsAppMsg(entries,filterDate); setShowWA(msg) }}
            style={{ padding:'8px 16px',borderRadius:8,background:'linear-gradient(135deg,#25D366,#128C7E)',color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5 }}>
            📲 WhatsApp
          </button>
          <button onClick={()=>{ setEditing(null); setFormOpen(true) }} style={{ ...btnPrimary, fontSize:13 }}>
            <span style={{ fontSize:16 }}>+</span> Add Entry
          </button>
        </div>
      </div>

      {/* ── Month Picker + Tabs ── */}
      <div style={{ display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap' }}>
        <input type="month" style={{ ...inp,width:'auto',padding:'7px 12px',fontSize:13 }} value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />
        <div style={{ display:'flex',borderRadius:10,overflow:'hidden',border:`1.5px solid ${C.ink[200]}` }}>
          {[['ledger','📋 Ledger'],['analytics','📊 Analytics']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{ padding:'8px 20px',background:tab===k?C.terra[500]:'#fff',color:tab===k?'#fff':C.ink[600],border:'none',fontSize:12,fontWeight:700,cursor:'pointer',transition:'background .2s' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16 }}>
        <KpiCard label="Today"     value={moneyFmt(todayTotal)} accent={C.terra[600]} icon="🌅" subtitle={today()} pulse />
        <KpiCard label="This Week"          value={moneyFmt(weekTotal)}  accent={C.ink[700]}   icon="📅" />
        <KpiCard label="Month"     value={moneyFmt(monthTotal)} accent={C.teal[600]}  icon="🗓" subtitle={viewMonth} />
        <KpiCard label="Daily Avg"          value={moneyFmt(avgPerDay)}  accent={C.forest[600]}icon="📈" />
        <KpiCard label="Peak Day"           value={highDay.d?dateFmt(highDay.d):'—'} accent={C.rose[600]} icon="🔺" subtitle={highDay.d?moneyFmt(highDay.sum):''} />
      </div>

      {/* ── Budget Bar ── */}
      <BudgetBar spent={monthTotal} budget={budget} />

      {/* ── Item Setup System ── */}
      {showItemSetup && <ItemSetupPanel onClose={()=>setShowItemSetup(false)} showToast={showToast} />}

      {/* ── Admin Monitor ── */}
      {showMonitor && isAdmin && <AdminMonitorPanel entries={entries} budget={budget} cookLog={cookLog} onClose={()=>setShowMonitor(false)} />}

      {/* ── Cook Log Form ── */}
      {showCookLog && isAdmin && <CookLogForm onSave={handleCookLogSave} onClose={()=>setShowCookLog(false)} />}

      {/* ── Cook Attendance Panel ── */}
      {showCookAtt && isAdmin && <CookAttendancePanel onClose={()=>setShowCookAtt(false)} showToast={showToast} />}

      {/* ── Entry Form ── */}
      {formOpen && (
        <EntryForm
          onSave={handleSave}
          onCancel={()=>{ setFormOpen(false); setEditing(null) }}
          editing={editing}
          defaultDate={filterDate}
          kitchenItems={kitchenItems}
        />
      )}

      {/* ══ LEDGER TAB ══ */}
      {tab==='ledger' && (
        <>
          <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <label style={{ ...labelSt,marginBottom:0 }}>Date</label>
              <input type="date" style={{ ...inp,width:'auto',padding:'7px 12px' }} value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <label style={{ ...labelSt,marginBottom:0 }}>Meal</label>
              <select style={{ ...inp,width:'auto',padding:'7px 12px' }} value={filterMeal} onChange={e=>setFilterMeal(e.target.value)}>
                <option value="all">All Meals</option>
                {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
              </select>
            </div>
          </div>

          <MissingMealAlert entries={entries} dateFilter={filterDate} />
          <CostPerStudentCard entries={entries} dateFilter={filterDate} />
          <MealKpiStrip entries={entries} dateFilter={filterDate} />
          <PettyCashWidget entries={entries} dateFilter={filterDate} />

          {uniqueDates.length===0 && (
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center' }}>
              <div style={{ width:70,height:70,borderRadius:18,background:C.terra[50],border:`2px dashed ${C.terra[200]}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,marginBottom:16 }}>🍽</div>
              <div style={{ fontSize:16,fontWeight:700,color:C.ink[700],marginBottom:6 }}>No entries yet</div>
              <p style={{ fontSize:13,color:C.ink[400],maxWidth:'38ch',lineHeight:1.6,margin:'0 0 20px' }}>Start by adding your first kitchen entry for today's meals.</p>
              <button onClick={()=>setFormOpen(true)} style={{ ...btnPrimary }}>+ Add First Entry</button>
            </div>
          )}

          {uniqueDates.length>0 && (
            <>
              <SectionDivider label={`Entries (${filteredByMeal.length})`} />
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

      {/* ══ ANALYTICS TAB ══ */}
      {tab==='analytics' && (
        <>
          <MonthlyChart entries={entries} />
          <MealPieBreakdown entries={entries} />
          <CalendarHeatmap entries={entries} onDayClick={d=>{ setFilterDate(d); setTab('ledger') }} />
          <VendorSummary entries={entries} />
          <ItemFrequency entries={entries} />
        </>
      )}
    </div>
  )
}